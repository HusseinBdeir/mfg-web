// ISABI Manufacturing Command — On-Device Biometric Face ID Engine (js/face.js)
// Shared architecture with BHFIRMS Attendance PWA (Attendance.md / PWA.md §4):
//   - Pipeline: SSD MobileNet v1 detector (Tiny Face Detector fallback + liveness fast path)
//               -> Full 68-point face landmarks -> 128-d Euclidean descriptor.
//   - Accept rule (Face.decide): nearest sample <= threshold (0.50) AND nearest sample of
//     any OTHER user is >= margin (0.08) further away; 3 consecutive frames confirm match.
//   - Enrolment: 3 guided poses (straight, slightly left, slightly right) with camera-top
//     SVG pictograms (poseSvg), minFaceFrac 14%, enrolScore 0.70, and separation check.
//   - Models are served from ./vendor/models and cached by sw.js for 100% offline operation.

const MFG_FACE_CONFIG = {
  match: {
    detector: "ssd",          // "ssd" = SSD MobileNet v1 (~5.6 MB) | "tiny" = Tiny Face Detector
    threshold: 0.50,
    margin: 0.08,             // required gap between best match and runner-up person
    weakAbove: 0.45,          // accepted but flagged as weak match above this distance
    minSamples: 3,            // 3 guided poses required before a seat's Face ID is active
    maxSamples: 3,
    confirmFrames: 3,         // same user across 3 consecutive frames before sign-in
    unknownFrames: 3,         // unknown face across 3 consecutive frames before PIN hint
    minFaceFrac: 0.14,        // ignore background faces narrower than 14% of frame width
    detectorInputSize: 320,
    detectorScore: 0.24,      // single-pass backlit-friendly threshold (avoids duplicate SSD pass)
    enrolScore: 0.70,
    poses: [
      "Look straight at the camera",
      "Turn your head slightly LEFT — just a little, keep both eyes on the camera",
      "Turn your head slightly RIGHT — just a little, keep both eyes on the camera"
    ],
    poseIcons: ["straight", "left", "right"]
  },
  liveness: {
    enabled: true,
    mode: "blink_or_turn",    // "blink_or_turn" | "blink_strict" | "multiframe_only"
    earClosed: 0.228,
    earOpen: 0.240,
    earDropMin: 0.024,        // relative EAR drop from open baseline for fast webcam blinks
    yawSpanMin: 0.020,        // 3D nose-to-jaw yaw span across frames
    parallaxSpanMin: 0.010,   // 3D nose-over-cheek vs nose-over-eye differential parallax
    earVarianceMin: 0.005,    // non-rigid eye variance required alongside head turn (rejects tilted 2D photos)
    windowSec: 6
  },
  snapshotWidth: 240,
  snapshotQuality: 0.78
};

const Face = (() => {
  let ready = false;
  let loading = null;
  let backend = "?";
  let detector = "tiny";
  let landmarksTiny = true;

  const M = () => MFG_FACE_CONFIG.match;

  function opts(which) {
    const d = which || detector;
    if (d === "ssd") return new faceapi.SsdMobilenetv1Options({ minConfidence: M().detectorScore });
    return new faceapi.TinyFaceDetectorOptions({ inputSize: M().detectorInputSize, scoreThreshold: M().detectorScore });
  }

  let earlyStreamObj = null;
  let earlyStreamPromise = null;
  let earlyCancelled = false;
  const trackedStreams = new Set();

  function trackStream(s) {
    if (s) trackedStreams.add(s);
    return s;
  }

  function stopStreamTracks(s) {
    if (!s || typeof s.getTracks !== "function") return;
    try { s.getTracks().forEach(t => t.stop()); } catch (_) {}
  }

  function stopAllStreams() {
    earlyCancelled = true;
    if (earlyStreamObj) {
      stopStreamTracks(earlyStreamObj);
      earlyStreamObj = null;
    }
    earlyStreamPromise = null;
    trackedStreams.forEach(s => stopStreamTracks(s));
    trackedStreams.clear();
    if (typeof document !== "undefined") {
      ["authFaceVideo", "enrolFaceVideo"].forEach(id => {
        const v = document.getElementById(id);
        if (v) {
          if (v.srcObject) stopStreamTracks(v.srcObject);
          try { v.pause(); } catch (_) {}
          v.srcObject = null;
        }
      });
    }
  }

  function prewarm() {
    if (typeof window === "undefined" || navigator.webdriver || window.__MFG_HEADLESS_TEST || window.__mfgSwResuming) return;
    // 1. Start loading WebGL + 128-d recognition models immediately (before 10.4 MB seed_data.js parses)
    load().catch(() => {});
    // 2. Request webcam stream immediately if #authGate is visible so the video feed appears in <150ms
    const gate = document.getElementById("authGate");
    const videoEl = document.getElementById("authFaceVideo");
    if (!gate || gate.hidden || !videoEl || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    if (!earlyStreamPromise) {
      earlyCancelled = false;
      earlyStreamPromise = navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      }).then(s => {
        trackStream(s);
        const gNow = document.getElementById("authGate");
        const vNow = document.getElementById("authFaceVideo");
        if (!earlyCancelled && gNow && !gNow.hidden && vNow) {
          earlyStreamObj = s;
          if (vNow.srcObject !== s) vNow.srcObject = s;
          vNow.play().catch(() => {});
          const dot = document.getElementById("authFacePulse");
          if (dot) dot.className = "auth-face-pulse live";
          const btn = document.getElementById("authCamToggleBtn");
          if (btn) btn.textContent = "Turn Off Camera";
          const offEl = document.getElementById("authCamOffOverlay");
          if (offEl) offEl.hidden = true;
          const hint = document.getElementById("authFaceHint");
          if (hint && /Loading Face ID/i.test(hint.textContent || "")) {
            hint.textContent = "Camera active — scanning Face ID…";
            hint.className = "auth-face-hint ok";
          }
        } else {
          stopStreamTracks(s);
          trackedStreams.delete(s);
          earlyStreamObj = null;
        }
        return earlyStreamObj;
      }).catch(() => null);
    }
  }

  async function consumeEarlyStream() {
    earlyCancelled = false;
    if (earlyStreamObj && earlyStreamObj.getVideoTracks && earlyStreamObj.getVideoTracks().some(t => t.readyState === "live")) {
      const s = earlyStreamObj;
      earlyStreamObj = null;
      earlyStreamPromise = null;
      trackStream(s);
      return s;
    }
    if (earlyStreamPromise) {
      const p = earlyStreamPromise;
      earlyStreamPromise = null;
      const s = await p;
      earlyStreamObj = null;
      if (!earlyCancelled && s && s.getVideoTracks && s.getVideoTracks().some(t => t.readyState === "live")) {
        trackStream(s);
        return s;
      }
      if (s) stopStreamTracks(s);
    }
    return null;
  }

  async function load() {
    if (ready) return;
    if (loading) return loading;
    if (typeof faceapi === "undefined") throw new Error("face-api.js not loaded");
    loading = (async () => {
      const base = "./vendor/models";
      try {
        await faceapi.tf.setBackend("webgl");
        await faceapi.tf.ready();
      } catch (e) {
        await faceapi.tf.setBackend("cpu");
        await faceapi.tf.ready();
      }
      backend = faceapi.tf.getBackend();
      // Load all neural nets in parallel: become ready as soon as Tiny + Landmarks + Recognition finish,
      // and upgrade detector to SSD MobileNet v1 as soon as its weights resolve.
      const tinyP = faceapi.nets.tinyFaceDetector.loadFromUri(base);
      const lmP = faceapi.nets.faceLandmark68Net.loadFromUri(base).then(() => {
        landmarksTiny = false;
      }).catch(async e => {
        console.warn("full landmark net unavailable, using tiny", e);
        await faceapi.nets.faceLandmark68TinyNet.loadFromUri(base);
        landmarksTiny = true;
      });
      const recP = faceapi.nets.faceRecognitionNet.loadFromUri(base);
      const ssdP = M().detector === "ssd"
        ? faceapi.nets.ssdMobilenetv1.loadFromUri(base).then(() => { detector = "ssd"; }).catch(e => {
            console.warn("SSD detector unavailable, using tiny", e);
            detector = "tiny";
          })
        : Promise.resolve();

      // Become ready as soon as Tiny + Landmarks + Recognition finish; let 5.6 MB SSD finish in parallel on live browsers
      await Promise.all([tinyP, lmP, recP]);
      ready = true;
      if (typeof navigator !== "undefined" && (navigator.webdriver || window.__MFG_HEADLESS_TEST)) {
        await ssdP;
      } else {
        setTimeout(() => {
          try {
            const wcv = document.createElement("canvas");
            wcv.width = 64; wcv.height = 64;
            faceapi.detectSingleFace(wcv, new faceapi.TinyFaceDetectorOptions({ inputSize: 128, scoreThreshold: 0.9 }))
              .withFaceLandmarks(landmarksTiny).withFaceDescriptor().catch(() => {});
          } catch (_) {}
        }, 15);
      }
    })();
    return loading;
  }

  const frameWidth = src => src.videoWidth || src.naturalWidth || src.width || 0;

  // Offscreen canvas copy: prevents face-api.js awaitMediaLoaded from hanging forever
  // when a MediaStream <video> has readyState < 3 or is hidden (PWA.md §4.2), and
  // downscales live <video> frames to <= 320px width for 4x faster WebGL inference.
  let scratchCanvas = null;
  function frameToCanvas(src, maxDim = 320) {
    if (!src) return null;
    if (src.tagName !== "VIDEO") return src;
    if (src.paused && src.srcObject) src.play().catch(() => {});
    if (src.readyState < 2 || !src.videoWidth || !src.videoHeight) return null;
    const vw = src.videoWidth;
    const vh = src.videoHeight;
    const scale = (maxDim && Math.max(vw, vh) > maxDim) ? (maxDim / Math.max(vw, vh)) : 1;
    const cw = Math.max(64, Math.round(vw * scale));
    const ch = Math.max(48, Math.round(vh * scale));
    const cv = scratchCanvas || (scratchCanvas = document.createElement("canvas"));
    if (cv.width !== cw) cv.width = cw;
    if (cv.height !== ch) cv.height = ch;
    cv._scaleX = vw / cw;
    cv._scaleY = vh / ch;
    cv.getContext("2d").drawImage(src, 0, 0, cw, ch);
    return cv;
  }

  function snapshot(src) {
    if (!src) return "";
    if (src.tagName === "VIDEO" && (src.readyState < 2 || !src.videoWidth || !src.videoHeight)) return "";
    const sw = src.videoWidth || src.naturalWidth || src.width || 320;
    const sh = src.videoHeight || src.naturalHeight || src.height || 240;
    if (!sw || !sh) return "";
    const w = MFG_FACE_CONFIG.snapshotWidth;
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = Math.round((w * sh) / sw);
    try {
      cv.getContext("2d").drawImage(src, 0, 0, cv.width, cv.height);
      return cv.toDataURL("image/jpeg", MFG_FACE_CONFIG.snapshotQuality);
    } catch (_) {
      return "";
    }
  }

  // Eye aspect ratio (Soukupová & Čech 2016) from 68-point layout:
  // left eye = 36..41, right eye = 42..47. Open ~0.30, closed < 0.215.
  function ear(pts) {
    if (!pts || pts.length < 48) return null;
    const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const one = i => (d(pts[i + 1], pts[i + 5]) + d(pts[i + 2], pts[i + 4])) / (2 * d(pts[i], pts[i + 3]) || 1);
    return (one(36) + one(42)) / 2;
  }

  // 3D Head-Turn Parallax (Anti-Screenshot Option 2):
  // Compares protruding 3D nose-tip (30) projection across the jaw contour (2, 14) against
  // the flat inter-ocular nose-bridge (27) between the outer eye corners (36, 45).
  // A real 3D head turning slightly produces differential nose-tip parallax + non-rigid eye
  // variation, whereas a flat 2D screenshot held on a phone moves as a rigid plane.
  function pose(pts) {
    if (!pts || pts.length < 68) return null;
    const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const dLeftJaw = d(pts[30], pts[2]);
    const dRightJaw = d(pts[30], pts[14]);
    const yaw = (dLeftJaw - dRightJaw) / ((dLeftJaw + dRightJaw) || 1);
    const dLeftEye = d(pts[27], pts[36]);
    const dRightEye = d(pts[27], pts[45]);
    const yawEye = (dLeftEye - dRightEye) / ((dLeftEye + dRightEye) || 1);
    const parallax3d = yaw - yawEye;
    const dBridgeNose = d(pts[27], pts[30]);
    const dNoseChin = d(pts[30], pts[8]);
    const pitch = (dBridgeNose - dNoseChin) / ((dBridgeNose + dNoseChin) || 1);
    return {
      yaw: Number(yaw.toFixed(4)),
      yawEye: Number(yawEye.toFixed(4)),
      parallax3d: Number(parallax3d.toFixed(4)),
      pitch: Number(pitch.toFixed(4))
    };
  }

  function pack(r, src, multiple = false) {
    const fw = frameWidth(src);
    const lm = r.landmarks ? r.landmarks.positions : null;
    const sc = r.detection ? r.detection.score : 0;
    const rawBox = r.detection ? r.detection.box : null;
    const fr = fw && rawBox ? rawBox.width / fw : 1;
    const sx = src && src._scaleX ? src._scaleX : 1;
    const sy = src && src._scaleY ? src._scaleY : 1;
    const box = (rawBox && (sx !== 1 || sy !== 1))
      ? { x: rawBox.x * sx, y: rawBox.y * sy, width: rawBox.width * sx, height: rawBox.height * sy }
      : rawBox;
    return {
      descriptor: r.descriptor,
      box,
      score: sc,
      detScore: sc,
      frac: fr,
      faceSizeFrac: fr,
      multiple: !!multiple,
      landmarks: lm,
      ear: lm ? ear(lm) : null,
      pose: lm ? pose(lm) : null
    };
  }

  let boostCanvas = null;
  let cropCanvas = null;
  let liveMissTick = 0;
  async function detectOne(src, allowCropFallback = false) {
    if (!ready) return null;
    const isLiveVideo = !!(src && src.tagName === "VIDEO");
    const frame = frameToCanvas(src, isLiveVideo && !allowCropFallback ? 320 : 480);
    if (!frame) return null;
    let r = null;
    if (isLiveVideo && !allowCropFallback) {
      // Fast live-video path (~25-40ms): TinyFaceDetector(256) on 320x240 frame, with immediate SSD fallback
      const fastTinyOpts = new faceapi.TinyFaceDetectorOptions({ inputSize: 256, scoreThreshold: 0.22 });
      r = await faceapi.detectSingleFace(frame, fastTinyOpts).withFaceLandmarks(landmarksTiny).withFaceDescriptor();
      if (!r && detector === "ssd") {
        r = await faceapi.detectSingleFace(frame, opts("ssd")).withFaceLandmarks(landmarksTiny).withFaceDescriptor();
      }
    } else {
      // Static image / manual capture path: Primary detector -> TinyFaceDetector(416)
      r = await faceapi.detectSingleFace(frame, opts()).withFaceLandmarks(landmarksTiny).withFaceDescriptor();
      if (!r && detector === "ssd") {
        const fallbackOpts = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.24 });
        r = await faceapi.detectSingleFace(frame, fallbackOpts).withFaceLandmarks(landmarksTiny).withFaceDescriptor();
      }
    }
    if (!r && (allowCropFallback || !isLiveVideo || (++liveMissTick % 3 === 0))) {
      // Shadow-lift filter for backlit rooms (run on manual capture or every 3rd missed live frame so live ticks never stall)
      try {
        const bw = frameWidth(frame) || 320;
        const bh = frame.videoHeight || frame.naturalHeight || frame.height || 240;
        const bcv = boostCanvas || (boostCanvas = document.createElement("canvas"));
        if (bcv.width !== bw) bcv.width = bw;
        if (bcv.height !== bh) bcv.height = bh;
        bcv._scaleX = frame._scaleX || 1;
        bcv._scaleY = frame._scaleY || 1;
        const bctx = bcv.getContext("2d");
        bctx.filter = "brightness(1.42) contrast(1.22)";
        bctx.drawImage(frame, 0, 0, bw, bh);
        bctx.filter = "none";
        const boostOpts = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.20 });
        r = await faceapi.detectSingleFace(bcv, boostOpts).withFaceLandmarks(landmarksTiny).withFaceDescriptor();
        if (!r && detector === "ssd" && allowCropFallback) {
          const boostSsdOpts = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.20 });
          r = await faceapi.detectSingleFace(bcv, boostSsdOpts).withFaceLandmarks(landmarksTiny).withFaceDescriptor();
        }
        if (r) return pack(r, bcv, false);
      } catch (_) {}
    }
    if (r) {
      liveMissTick = 0;
      return pack(r, frame, false);
    }
    if (allowCropFallback) {
      // Fallback 3: Explicit manual capture in extreme backlighting -> compute 128-d descriptor from central reticle crop
      try {
        const fw = frameWidth(frame) || 640;
        const fh = frame.videoHeight || frame.naturalHeight || frame.height || 480;
        const ccv = cropCanvas || (cropCanvas = document.createElement("canvas"));
        ccv.width = 160;
        ccv.height = 160;
        const cctx = ccv.getContext("2d");
        cctx.filter = "brightness(1.35) contrast(1.18)";
        const sx = Math.round(fw * 0.24), sy = Math.round(fh * 0.14);
        const sw = Math.round(fw * 0.52), sh = Math.round(fh * 0.72);
        cctx.drawImage(frame, sx, sy, sw, sh, 0, 0, 160, 160);
        cctx.filter = "none";
        const desc = await faceapi.computeFaceDescriptor(ccv);
        if (desc) {
          return {
            descriptor: desc,
            box: { x: sx, y: sy, width: sw, height: sh },
            score: 0.78,
            detScore: 0.78,
            frac: 0.52,
            faceSizeFrac: 0.52,
            multiple: false,
            landmarks: null,
            ear: null,
            cropFallback: true
          };
        }
      } catch (_) {}
    }
    return null;
  }

  async function detectAll(src) {
    if (!ready) return [];
    const frame = frameToCanvas(src);
    if (!frame) return [];
    const rs = await faceapi.detectAllFaces(frame, opts()).withFaceLandmarks(landmarksTiny).withFaceDescriptors();
    return rs.map(r => pack(r, frame));
  }

  async function landmarksOnly(src) {
    if (!ready) return null;
    const frame = frameToCanvas(src);
    if (!frame) return null;
    const r = await faceapi.detectSingleFace(frame, opts("tiny")).withFaceLandmarks(landmarksTiny);
    if (!r) return null;
    const lm = r.landmarks.positions;
    return { box: r.detection.box, landmarks: lm, ear: ear(lm) };
  }

  function euclidean(a, b) {
    if (typeof faceapi !== "undefined" && faceapi.euclideanDistance) return faceapi.euclideanDistance(a, b);
    let sum = 0;
    for (let i = 0; i < 128; i++) {
      const diff = (Number(a[i]) || 0) - (Number(b[i]) || 0);
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  // Supports both [{ id, email, name, samples: [[128], ...] }] and flat [{ staffId, d: [128] }]
  function match(descriptor, enrolled) {
    let best = null, bestDist = 9, second = null, secondDist = 9;
    for (const item of (enrolled || [])) {
      if (!item) continue;
      if (Array.isArray(item.samples)) {
        let empBest = 9;
        for (const s of item.samples) {
          if (!Array.isArray(s) || s.length !== 128) continue;
          const d = euclidean(descriptor, s);
          if (d < empBest) empBest = d;
        }
        if (empBest < bestDist) {
          second = best; secondDist = bestDist;
          best = item; bestDist = empBest;
        } else if (empBest < secondDist) {
          second = item; secondDist = empBest;
        }
      } else if (Array.isArray(item.d) && item.d.length === 128) {
        const d = euclidean(descriptor, item.d);
        const key = item.email || item.staffId || item.id;
        if (d < bestDist) {
          if (best && (best.email || best.staffId || best.id) !== key) { second = best; secondDist = bestDist; }
          best = item; bestDist = d;
        } else if (best && (best.email || best.staffId || best.id) !== key && d < secondDist) {
          second = item; secondDist = d;
        }
      }
    }
    return {
      best,
      bestDist,
      second,
      secondDist,
      staffId: best ? (best.email || best.staffId || best.id) : null,
      distance: bestDist,
      runnerUp: second ? { staffId: second.email || second.staffId || second.id, distance: secondDist } : null,
      margin: second ? (secondDist - bestDist) : 9
    };
  }

  function decide(m, cfgOrThr, meta = {}) {
    const cfg = (cfgOrThr && typeof cfgOrThr === "object")
      ? Object.assign({}, M(), cfgOrThr)
      : Object.assign({}, M(), { threshold: cfgOrThr == null ? M().threshold : Number(cfgOrThr) });
    if (!m || !m.best) return { status: "no-enrolled", ok: false, reason: "no-enrolments" };
    if (meta.faceSizeFrac != null && meta.faceSizeFrac < (cfg.minFaceFrac || 0.14)) {
      return { status: "too-small", ok: false, reason: "too-small", best: m.best, bestDist: m.bestDist };
    }
    if (m.bestDist > cfg.threshold) {
      return { status: "unknown", ok: false, reason: "far", best: m.best, bestDist: m.bestDist };
    }
    if (m.second && (m.secondDist - m.bestDist) < (cfg.margin || 0.08)) {
      return { status: "ambiguous", ok: false, reason: "ambiguous", best: m.best, second: m.second, bestDist: m.bestDist, secondDist: m.secondDist };
    }
    if (cfg.weakAbove && m.bestDist > cfg.weakAbove) {
      return { status: "weak", ok: true, weak: true, reason: "", best: m.best, bestDist: m.bestDist, secondDist: m.secondDist };
    }
    return { status: "ok", ok: true, weak: false, reason: "", best: m.best, bestDist: m.bestDist, secondDist: m.secondDist };
  }

  function calibration(enrolled) {
    const perEmp = [];
    const pairs = [];
    const list = (enrolled || []).filter(e => e && Array.isArray(e.samples) && e.samples.length > 0);
    for (const e of list) {
      let maxIntra = 0;
      const s = e.samples;
      for (let i = 0; i < s.length; i++) {
        for (let j = i + 1; j < s.length; j++) {
          const d = euclidean(s[i], s[j]);
          if (d > maxIntra) maxIntra = d;
        }
      }
      perEmp.push({ id: e.id || e.email, name: e.name || e.email, samples: s.length, spread: maxIntra });
    }
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        let minInter = 9;
        for (const sa of list[i].samples) {
          for (const sb of list[j].samples) {
            const d = euclidean(sa, sb);
            if (d < minInter) minInter = d;
          }
        }
        pairs.push({ a: list[i].name || list[i].email, b: list[j].name || list[j].email, d: minInter });
      }
    }
    pairs.sort((x, y) => x.d - y.d);
    const maxSpread = perEmp.reduce((m, x) => Math.max(m, x.spread), 0);
    const minPair = pairs.length ? pairs[0].d : null;
    const recThr = minPair != null
      ? Math.max(0.40, Math.min(0.55, Number(((maxSpread + minPair) / 2).toFixed(2))))
      : 0.50;
    return { perEmp, pairs, maxSpread, minPair, recommendedThreshold: recThr };
  }

  // Exact Attendance v0.2.4 camera-top pose pictograms (mirrored-preview sense)
  function poseSvg(kind) {
    if (kind === 0) kind = "straight";
    else if (kind === 1) kind = "left";
    else if (kind === 2) kind = "right";
    else if (kind === 3) kind = "done";
    const W = "currentColor", B = "#94A3B8";
    const cam = `<rect x="40" y="2" width="20" height="12" rx="3" fill="${B}"/><circle cx="50" cy="8" r="3.4" fill="#111827"/>`;
    const sight = `<path d="M50 16 V40" fill="none" stroke="${B}" stroke-width="2" stroke-dasharray="3 4" stroke-linecap="round"/>`;
    const earL = `<path d="M24.5 57 q-8 7 0 14" fill="none" stroke="${W}" stroke-width="3.5" stroke-linecap="round"/>`;
    const earR = `<path d="M75.5 57 q8 7 0 14" fill="none" stroke="${W}" stroke-width="3.5" stroke-linecap="round"/>`;
    const head = dx => `<circle cx="50" cy="64" r="26" fill="none" stroke="${W}" stroke-width="4"/>` +
      `<circle cx="${41 + dx}" cy="58" r="${dx < 0 ? 2.7 : 3.3}" fill="${W}"/><circle cx="${59 + dx}" cy="58" r="${dx > 0 ? 2.7 : 3.3}" fill="${W}"/>` +
      `<path d="M${50 + dx * 1.5} 59 v9 h${dx >= 0 ? 5 : -5}" fill="none" stroke="${W}" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M${42 + dx} 76 h16" fill="none" stroke="${W}" stroke-width="3.5" stroke-linecap="round"/>`;
    const arrow = (d, dx) => `<g class="face-pose-arrow" style="--dx:${dx}px;--dy:0px"><path d="${d}" fill="none" stroke="${B}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></g>`;
    let body;
    switch (kind) {
      case "left":  body = cam + head(-6) + earR + arrow("M60 32 Q50 20 38 29 M46 28 L38 29 L41 22", -4); break;
      case "right": body = cam + head(6) + earL + arrow("M40 32 Q50 20 62 29 M54 28 L62 29 L59 22", 4); break;
      case "done":  body = `<circle cx="50" cy="56" r="34" fill="none" stroke="#22c55e" stroke-width="5"/><path d="M32 58 l12 12 l26 -28" fill="none" stroke="#22c55e" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`; break;
      default:      body = cam + sight + head(0) + earL + earR;
    }
    return `<svg viewBox="0 0 100 92" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
  }

  // Biometric HUD reticle overlay (Attendance v0.3.0)
  function drawOverlay(cv, video, det, status) {
    if (!cv || !video) return;
    const wrap = cv.parentElement;
    const cw = wrap ? wrap.clientWidth : 0;
    const ch = wrap ? wrap.clientHeight : 0;
    if (!cw || !ch) return;
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    const g = cv.getContext("2d");
    g.clearRect(0, 0, cw, ch);
    if (!det || !det.box) return;
    const vw = video.videoWidth || cw, vh = video.videoHeight || ch;
    const s = Math.max(cw / vw, ch / vh);
    const ox = (cw - vw * s) / 2, oy = (ch - vh * s) / 2;
    const b = det.box;
    const x = b.x * s + ox, y = b.y * s + oy, w = b.width * s, h = b.height * s;
    const col = (status && status.startsWith("#"))
      ? status
      : ({ ok: "#22c55e", live: "#e2e8f0", warn: "#f59e0b", unknown: "#f59e0b", far: "#94a3b8", scan: "#94A3B8" }[status] || "#94A3B8");
    const L = Math.min(w, h) * 0.22;

    g.save();
    g.strokeStyle = col + "33";
    g.lineWidth = 1.5;
    g.strokeRect(x, y, w, h);

    g.shadowColor = col;
    g.shadowBlur = 12;
    g.lineWidth = 3.5;
    g.strokeStyle = col;
    g.lineCap = "round";
    const corner = (cx, cy, dx, dy) => {
      g.beginPath();
      g.moveTo(cx + dx * L, cy);
      g.lineTo(cx, cy);
      g.lineTo(cx, cy + dy * L);
      g.stroke();
    };
    corner(x, y, 1, 1);
    corner(x + w, y, -1, 1);
    corner(x, y + h, 1, -1);
    corner(x + w, y + h, -1, -1);

    g.shadowBlur = 0;
    g.lineWidth = 2;
    const tick = 5;
    g.beginPath();
    g.moveTo(x + w / 2, y - tick / 2); g.lineTo(x + w / 2, y + tick / 2);
    g.moveTo(x + w / 2, y + h - tick / 2); g.lineTo(x + w / 2, y + h + tick / 2);
    g.moveTo(x - tick / 2, y + h / 2); g.lineTo(x + tick / 2, y + h / 2);
    g.moveTo(x + w - tick / 2, y + h / 2); g.lineTo(x + w + tick / 2, y + h / 2);
    g.stroke();
    g.restore();
  }

  // Synthesized Web Audio feedback (disabled by default — camera-only Face ID)
  const Sound = (() => {
    let ctx = null;
    let enabled = false;
    function getCtx() {
      if (navigator.webdriver || !enabled) return null;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!ctx) ctx = new AC();
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      return ctx;
    }
    function tone(freq, dur, delay, type, gainVal) {
      try {
        const c = getCtx(); if (!c) return;
        const t0 = c.currentTime + (delay || 0);
        const osc = c.createOscillator(), g = c.createGain();
        osc.type = type || "sine";
        osc.frequency.setValueAtTime(freq, t0);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(gainVal || 0.12, t0 + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(g); g.connect(c.destination);
        osc.start(t0); osc.stop(t0 + dur + 0.02);
      } catch (_) {}
    }
    return {
      unlock() { getCtx(); },
      play(kind) {
        if (!enabled || navigator.webdriver) return;
        if (kind === "in" || kind === "ok") { tone(587.33, 0.14, 0, "sine", 0.14); tone(880, 0.24, 0.11, "triangle", 0.16); }
        else if (kind === "warn") { tone(349.23, 0.12, 0, "triangle", 0.12); tone(311.13, 0.18, 0.13, "triangle", 0.12); }
        else if (kind === "capture") { tone(1046.5, 0.09, 0, "sine", 0.10); }
        else if (kind === "tap") { tone(660, 0.035, 0, "sine", 0.05); }
      },
      playSuccess() { this.play("ok"); },
      playWarn() { this.play("warn"); },
      playError() { this.play("warn"); },
      get enabled() { return enabled; },
      set enabled(v) { enabled = !!v; }
    };
  })();

  return {
    config: MFG_FACE_CONFIG,
    CONFIG: MFG_FACE_CONFIG.match,
    load,
    prewarm,
    consumeEarlyStream,
    trackStream,
    stopAllStreams,
    isReady: () => ready,
    getBackend: () => backend,
    detectOne,
    detectAll,
    landmarksOnly,
    match,
    decide,
    calibration,
    ear,
    pose,
    euclidean,
    frameToCanvas,
    snapshot,
    poseSvg,
    drawOverlay,
    Sound,
    get ready() { return ready; },
    get backend() { return backend; },
    get detector() { return detector; },
    get landmarks() { return landmarksTiny ? "68-tiny" : "68"; }
  };
})();
window.Face = Face;
Face.prewarm();
