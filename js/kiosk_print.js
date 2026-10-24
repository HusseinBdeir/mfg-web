/* ============================================================================
   ISABI MANUFACTURING — BLUETOOTH ESC/POS & THERMAL RECEIPT ENGINE (v9.0)
   Supports:
   - Sales Dispatch Tickets / 11% VAT Invoices / Unpriced Delivery Gate Passes
   - Raw Material Quarry Receiving Vouchers (2-Leg AP) / Unpriced Scale Slips
   - Fuel & Lubricant Pump Dispense Slips & Bulk Tank Refill Vouchers
   - 1-Tap Toggle: Priced (Invoice / Voucher) vs Unpriced (Gate Pass / Driver Slip)
   - Dual Paper Widths: 80mm (48 chars / 576 dots) & 58mm (32 chars / 384 dots)
   - 3 Transports: RawBT (rawbt:base64,...), Web Bluetooth GATT, & Browser Print
   ============================================================================ */
(function () {
  'use strict';

  const ic = (name, cls) => (typeof window !== 'undefined' && window.MFG_ICONS ? window.MFG_ICONS.svg(name, cls) : '');

  const STORAGE_KEY = 'isabi_mfg_printer_cfg_v1';

  const DEFAULT_CFG = {
    paperWidth: '80mm',   // '80mm' (48 cols, 576 dots) | '58mm' (32 cols, 384 dots)
    priceMode: 'priced',  // 'priced' (Invoice/Voucher) | 'unpriced' (Gate Pass/Scale Slip)
    autoPrint: true,      // Auto-trigger thermal print on Kiosk Post & Print
    transport: 'rawbt',   // 'rawbt' | 'webbt' | 'browser'
    copies: 1,
    deviceName: ''
  };

  let _cfg = null;
  let _bleDevice = null;
  let _bleCharacteristic = null;
  let _lastJob = null;

  const SETTINGS = {
    paperWidth: 80,
    priceMode: 'priced',
    channel: 'rawbt',
    autoPrintOnPost: true,
    bleDeviceName: ''
  };

  function normWidthStr(w) {
    if (w === 58 || w === '58' || String(w || '').toLowerCase() === '58mm') return '58mm';
    return '80mm';
  }

  function normWidthNum(w) {
    return normWidthStr(w) === '58mm' ? 58 : 80;
  }

  function syncSettingsObj(cfg) {
    SETTINGS.paperWidth = normWidthNum(cfg.paperWidth);
    SETTINGS.priceMode = cfg.priceMode === 'unpriced' ? 'unpriced' : 'priced';
    SETTINGS.channel = cfg.transport === 'webbt' ? 'web_bluetooth' : (cfg.transport || 'rawbt');
    SETTINGS.autoPrintOnPost = cfg.autoPrint !== false;
    SETTINGS.bleDeviceName = cfg.deviceName || '';
    return SETTINGS;
  }

  function resolveDocArgs(a, b, c) {
    if (typeof a === 'string' && ['sales', 'raw', 'fuel'].includes(a.toLowerCase())) {
      return { docType: a.toLowerCase(), record: b || {}, opts: c || {} };
    }
    const record = (a && typeof a === 'object') ? a : {};
    const opts = (b && typeof b === 'object') ? b : {};
    let docType = String(opts.docType || record.docType || '').toLowerCase();
    if (!['sales', 'raw', 'fuel'].includes(docType)) {
      if (record.litres != null || record.fuel_type || /^DRAFT-FUEL/i.test(record.id || '')) docType = 'fuel';
      else if (record.site_owner != null || record.unit_cost != null || /^DRAFT-RAW/i.test(record.id || '')) docType = 'raw';
      else docType = 'sales';
    }
    return { docType, record, opts };
  }

  function loadCfg() {
    if (_cfg) {
      syncSettingsObj(_cfg);
      return _cfg;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        _cfg = Object.assign({}, DEFAULT_CFG, parsed || {});
      } else {
        _cfg = Object.assign({}, DEFAULT_CFG);
      }
    } catch (_) {
      _cfg = Object.assign({}, DEFAULT_CFG);
    }
    _cfg.paperWidth = normWidthStr(_cfg.paperWidth);
    if (_cfg.priceMode !== 'unpriced' && _cfg.priceMode !== 'priced') _cfg.priceMode = 'priced';
    syncSettingsObj(_cfg);
    return _cfg;
  }

  function saveCfg(patch = {}) {
    const cur = loadCfg();
    if (patch.paperWidth != null) cur.paperWidth = normWidthStr(patch.paperWidth);
    if (patch.priceMode != null) cur.priceMode = patch.priceMode === 'unpriced' ? 'unpriced' : 'priced';
    if (patch.channel != null || patch.transport != null) {
      const ch = String(patch.channel || patch.transport || 'rawbt');
      cur.transport = ch === 'web_bluetooth' ? 'webbt' : ch;
    }
    if (patch.autoPrint != null || patch.autoPrintOnPost != null) {
      cur.autoPrint = (patch.autoPrint != null ? patch.autoPrint : patch.autoPrintOnPost) !== false;
    }
    if (patch.deviceName != null || patch.bleDeviceName != null) {
      cur.deviceName = String(patch.deviceName != null ? patch.deviceName : patch.bleDeviceName);
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cur));
    } catch (_) {}
    syncSettingsObj(cur);
    return cur;
  }

  function savePrintSettings(patch = {}) {
    saveCfg(patch);
    return SETTINGS;
  }

  function paperCols(widthOverride) {
    const w = widthOverride != null ? normWidthStr(widthOverride) : loadCfg().paperWidth;
    return w === '58mm' ? 32 : 48;
  }

  function paperDots(widthOverride) {
    const w = widthOverride != null ? normWidthStr(widthOverride) : loadCfg().paperWidth;
    return w === '58mm' ? 384 : 576;
  }

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtMoney(n, dp = 2) {
    const v = Number(n || 0);
    const sign = v < 0 ? '-' : '';
    const abs = Math.abs(v);
    return sign + '$' + abs.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  }

  function fmtQty(n, dp = 2) {
    const v = Number(n || 0);
    return v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  }

  // ---- ESC/POS Command Primitives (ported from bhfirms/pos/js/print.js) ----
  const ESC = 0x1B;
  const GS = 0x1D;
  const LF = 0x0A;

  const P = {
    INIT: [ESC, 0x40],
    ALIGN_L: [ESC, 0x61, 0x00],
    ALIGN_C: [ESC, 0x61, 0x01],
    ALIGN_R: [ESC, 0x61, 0x02],
    BOLD_ON: [ESC, 0x45, 0x01],
    BOLD_OFF: [ESC, 0x45, 0x00],
    DBL_ON: [GS, 0x21, 0x11],     // 2x width + 2x height
    TALL_ON: [GS, 0x21, 0x01],    // 1x width + 2x height
    WIDE_ON: [GS, 0x21, 0x10],    // 2x width + 1x height
    NORMAL: [GS, 0x21, 0x00],
    FEED: n => [ESC, 0x64, n],
    CUT: [GS, 0x56, 0x42, 0x00]   // GS V 66 0 — feed & partial cut
  };

  function asciiClean(str) {
    return String(str == null ? '' : str)
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/\u2026/g, '...')
      .replace(/\u00B3/g, '3')
      .replace(/\u00B2/g, '2')
      .replace(/\u00D7/g, 'x')
      .replace(/\u2192/g, '->')
      .replace(/[^\x20-\x7E]/g, '');
  }

  function encodeAscii(str) {
    const clean = asciiClean(str);
    const out = [];
    for (let i = 0; i < clean.length; i++) {
      out.push(clean.charCodeAt(i) & 0x7F);
    }
    return out;
  }

  function padLR(left, right, width) {
    const l = asciiClean(left);
    const r = asciiClean(right);
    const gap = width - l.length - r.length;
    if (gap >= 1) return l + ' '.repeat(gap) + r;
    const maxLeft = Math.max(0, width - r.length - 1);
    return l.slice(0, maxLeft) + ' ' + r;
  }

  function centerText(text, width) {
    const t = asciiClean(text).slice(0, width);
    const pad = Math.max(0, Math.floor((width - t.length) / 2));
    return ' '.repeat(pad) + t;
  }

  // ---- GS v 0 Monochrome Raster Packer (1-bit thermal bitmap) --------------
  function packRaster(widthDots, heightDots, getBit) {
    const wBytes = Math.ceil(widthDots / 8);
    const header = [
      GS, 0x76, 0x30, 0x00,
      wBytes & 0xFF, (wBytes >> 8) & 0xFF,
      heightDots & 0xFF, (heightDots >> 8) & 0xFF
    ];
    const data = new Array(wBytes * heightDots).fill(0);
    for (let y = 0; y < heightDots; y++) {
      const rowBase = y * wBytes;
      for (let x = 0; x < widthDots; x++) {
        if (getBit(x, y)) {
          data[rowBase + (x >> 3)] |= (0x80 >> (x & 7));
        }
      }
    }
    return header.concat(data);
  }

  // ---- Monochrome ISABI + Company Crest Raster (GS v 0) --------------------
  function buildBrandLogoRaster(companyName, paperWidth) {
    try {
      if (typeof document === 'undefined') return null;
      const maxDots = paperDots(paperWidth);
      const w = Math.min(paperWidth === '58mm' ? 200 : 256, maxDots);
      const h = paperWidth === '58mm' ? 64 : 76;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);

      // Draw official ISABI 2-pillar + double-bar mark centered at top
      ctx.fillStyle = '#000000';
      const cx = Math.floor(w / 2);
      const markTop = 4;
      const pillarW = 7;
      const pillarH = 22;
      ctx.fillRect(cx - 12, markTop, pillarW, pillarH);
      ctx.fillRect(cx + 5, markTop, pillarW, pillarH);
      ctx.fillRect(cx - 12, markTop + pillarH + 3, 24, 2);
      ctx.fillRect(cx - 12, markTop + pillarH + 7, 24, 2);

      ctx.textAlign = 'center';
      ctx.font = '900 13px Arial, sans-serif';
      const coShort = String(companyName || 'WTC').toUpperCase();
      ctx.fillText(`ISABI · ${coShort}`, cx, markTop + pillarH + 23);

      ctx.font = '700 9px monospace';
      ctx.fillText('WEIGHBRIDGE & PLANT TERMINAL', cx, markTop + pillarH + 35);

      const img = ctx.getImageData(0, 0, w, h).data;
      return packRaster(w, h, (x, y) => {
        const i = (y * w + x) * 4;
        const a = img[i + 3];
        if (a < 64) return false;
        const lum = 0.299 * img[i] + 0.587 * img[i + 1] + 0.114 * img[i + 2];
        return lum < 165;
      });
    } catch (_) {
      return null;
    }
  }

  // ---- CODE128-C Barcode Generator (Raster GS v 0 + SVG for Preview) -------
  const C128_PATTERNS = [
    '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
    '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
    '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
    '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
    '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
    '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
    '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
    '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
    '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
    '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
    '114131','311141','411131','211412','211214','211232','2331112'
  ];

  function makeNumericBarcodeDigits(docType, record) {
    const prefix = docType === 'raw' ? '20' : (docType === 'fuel' ? '30' : '10');
    const rawNum = String((record && (record.ticket_no || record.invoice_no || record.id)) || '')
      .replace(/\D/g, '');
    const padded = (rawNum || '00000001').slice(-8).padStart(8, '0');
    return prefix + padded; // 10 digits (even length for CODE128-C)
  }

  function encodeCode128C(digits) {
    const clean = String(digits || '').replace(/\D/g, '');
    const even = clean.length % 2 === 0 ? clean : ('0' + clean);
    if (!even.length) return [];
    const codes = [105]; // Start C
    for (let i = 0; i < even.length; i += 2) {
      codes.push(parseInt(even.slice(i, i + 2), 10));
    }
    let sum = codes[0];
    for (let i = 1; i < codes.length; i++) sum += codes[i] * i;
    codes.push(sum % 103);
    codes.push(106); // Stop
    const bits = [];
    for (const c of codes) {
      const pat = C128_PATTERNS[c];
      let bar = 1;
      for (let i = 0; i < pat.length; i++) {
        const w = pat.charCodeAt(i) - 48;
        for (let k = 0; k < w; k++) bits.push(bar);
        bar = 1 - bar;
      }
    }
    return bits;
  }

  function buildBarcodeRaster(digits, paperWidth, heightDots = 54) {
    const bits = encodeCode128C(digits);
    if (!bits.length) return [];
    const maxDots = paperDots(paperWidth);
    const scale = Math.max(1, Math.min(3, Math.floor((maxDots - 32) / bits.length)));
    const totalW = bits.length * scale;
    const padLeft = Math.max(0, Math.floor((maxDots - totalW) / 2));
    return packRaster(maxDots, heightDots, (x) => {
      const bx = x - padLeft;
      if (bx < 0 || bx >= totalW) return false;
      return bits[Math.floor(bx / scale)] === 1;
    });
  }

  function renderBarcodeSvg(digits, heightPx = 42) {
    const bits = encodeCode128C(digits);
    if (!bits.length) return '';
    const quiet = 10;
    const totalMods = bits.length + quiet * 2;
    let rects = '';
    let i = 0;
    while (i < bits.length) {
      if (bits[i] === 1) {
        let run = 1;
        while (i + run < bits.length && bits[i + run] === 1) run++;
        rects += `<rect x="${quiet + i}" y="0" width="${run}" height="${heightPx}" fill="#000"/>`;
        i += run;
      } else {
        i++;
      }
    }
    return `<svg class="thermal-barcode-svg" viewBox="0 0 ${totalMods} ${heightPx}" preserveAspectRatio="none" aria-label="Barcode ${escHtml(digits)}">${rects}</svg>`;
  }

  // ---- Normalize Ticket Data from Form or Register Row ---------------------
  function normalizeTicketPayload(a, b, c) {
    const resolved = resolveDocArgs(a, b, c);
    const docType = resolved.docType;
    const record = resolved.record || {};
    const opts = resolved.opts || {};
    const cfg = loadCfg();
    const paperWidth = normWidthStr(opts.paperWidth || cfg.paperWidth || '80mm');
    const priceMode = (opts.priceMode || cfg.priceMode || 'priced') === 'unpriced' ? 'unpriced' : 'priced';
    const company = record.company || 'WTC';
    const coFull = company === 'BBConstruction'
      ? 'BBCONSTRUCTION S.A.R.L.'
      : (company === 'Lions Transport' ? 'LIONS TRANSPORT & FLEET' : 'WTC · WORLD TRADING & CONSTRUCTION');

    const dateStr = String(record.date || new Date().toISOString().slice(0, 10)).slice(0, 10);
    const repDateStr = String(record.rep_date || dateStr).slice(0, 10);
    const timeStr = String(record.time || new Date().toTimeString().slice(0, 5)).slice(0, 5);
    const ticketNo = String(record.ticket_no || record.invoice_no || record.id || 'PENDING').trim();
    const uom = record.uom || 'm³';
    const qty = Number(record.qty != null ? record.qty : (record.litres || 0));
    const tonFactor = Number(record.ton_factor || 1);
    const tons = uom === 'Ton' ? qty : (tonFactor && tonFactor !== 1 ? qty * tonFactor : qty);
    const barcodeDigits = makeNumericBarcodeDigits(docType, record);

    if (docType === 'raw') {
      const unitCost = Number(record.unit_cost != null ? record.unit_cost : (record.unit_price || 0));
      const matCost = Number(record.cost != null ? record.cost : (qty * unitCost));
      const haulRate = Number(record.trans_unit_cost != null ? record.trans_unit_cost : (record.trans_unit_price || 0));
      const haulCost = Number(record.trans_cost != null ? record.trans_cost : (record.trans_price || 0));
      const disc = Number(record.discount || 0);
      const totalUsd = Number(record.total != null ? record.total : (matCost + haulCost));
      return {
        docType: 'raw',
        paperWidth,
        priceMode,
        company,
        coFull,
        title: priceMode === 'priced' ? 'RAW MATERIAL RECEIVING VOUCHER' : 'RAW MATERIAL SCALE SLIP',
        badge: priceMode === 'priced' ? 'PRICED 2-LEG VOUCHER' : 'UNPRICED SCALE SLIP',
        ticketNo,
        dateStr,
        repDateStr,
        timeStr,
        overtime: !!record.overtime,
        product: record.product || 'Raw Aggregate',
        site: record.site || '—',
        siteOwner: record.site_owner || '—',
        transportBy: record.transport_by || 'Third-party truck',
        truck: record.truck || '—',
        truckOwner: record.truck_owner || (record.transport_by === 'Company fleet' ? company : '—'),
        driver: record.driver || '—',
        qty,
        uom,
        tons,
        tonFactor,
        unitCost,
        matCost,
        haulRate,
        haulCost,
        disc,
        totalUsd,
        method: record.method || 'Credit',
        extInvoice: record.external_invoice || '',
        reference: record.reference || '',
        notes: record.notes || '',
        enteredBy: record.entered_by || 'Weighbridge Operator',
        barcodeDigits
      };
    }

    if (docType === 'fuel') {
      const fuelType = record.fuel_type || (/diesel/i.test(record.item || '') ? 'Diesel' : 'Lubricant');
      const item = record.item || fuelType || 'Diesel';
      const litres = Number(record.litres != null ? record.litres : (record.qty || 0));
      const eqNm = String(record.equipment || record.truck || '').trim();
      const eqList = (typeof window !== 'undefined' && window.MFG_SEED && window.MFG_SEED.records && window.MFG_SEED.records.equipment) || [];
      const eqRec = eqNm ? eqList.find(e => e && String(e.name || '').trim().toLowerCase() === eqNm.toLowerCase()) : null;
      const eqCatL = String((eqRec && (eqRec.type || eqRec.category)) || '').trim().toLowerCase();
      const isHourCat = eqCatL === 'excavator' || eqCatL === 'wheel loader' || eqCatL === 'generator' || eqCatL === 'plant' ||
        (eqCatL === 'other' && /baldouzar|bulldozer|compressor|kombrasor|rotary|rotare/i.test(eqNm)) ||
        (!eqCatL && /^(pb\d|mb\d|mbs\d|sb\d|cat\b|caterpillar|volvo|bobcat|kasara|kassara|maghsal|mowaled|mwaled|welding)/i.test(eqNm));
      const rawOdo = record.odometer != null && record.odometer !== '' ? Number(record.odometer) : null;
      const rawHrs = record.hours != null && record.hours !== '' ? Number(record.hours) : null;
      const reading = isHourCat
        ? (rawHrs != null ? rawHrs : rawOdo)
        : (rawOdo != null ? rawOdo : rawHrs);
      const meterUnit = reading == null
        ? ''
        : (isHourCat ? 'h' : (rawOdo != null ? 'km' : 'h'));
      const delta = record.meter_delta != null ? Number(record.meter_delta) : null;
      return {
        docType: 'fuel',
        paperWidth,
        priceMode,
        company,
        coFull,
        title: record.is_tank_refill ? 'BULK FUEL TANK REFILL VOUCHER' : 'FUEL & LUBRICANT PUMP SLIP',
        badge: record.is_tank_refill ? 'TANK REFILL' : `${fuelType.toUpperCase()} ISSUE`,
        ticketNo,
        dateStr,
        repDateStr,
        timeStr,
        fuelType,
        item,
        equipment: record.equipment || record.truck || '—',
        driver: record.driver || '—',
        location: record.location || 'Main Plant Tank',
        litres,
        reading,
        meterUnit,
        delta,
        unitCost: Number(record.unit_cost || 0),
        totalUsd: Number(record.amount || record.total || 0),
        supplier: record.supplier || '',
        notes: record.notes || '',
        enteredBy: record.entered_by || 'Depot Officer',
        barcodeDigits
      };
    }

    // Default: 'sales' (Sales Dispatch Ticket / VAT Invoice / Delivery Gate Pass)
    const saleType = record.sale_type || 'Pickup';
    const unitPrice = Number(record.unit_price || 0);
    const tierAdj = Number(record.tier_adj || 0);
    const disc = Number(record.discount || 0);
    const matTotal = Number(record.price != null ? record.price : Math.max(0, qty * unitPrice + tierAdj - disc));
    const transRate = Number(record.trans_unit_price || 0);
    const transTotal = Number(record.trans_price || 0);
    const tip = Number(record.tip || 0);
    const netUsd = Number(record.total != null ? record.total : (matTotal + transTotal));
    const vatUsd = Number(record.vat || 0);
    const ttcUsd = Number(record.total_ttc != null ? record.total_ttc : (netUsd + vatUsd));

    return {
      docType: 'sales',
      paperWidth,
      priceMode,
      company,
      coFull,
      title: priceMode === 'priced'
        ? (vatUsd > 0 ? 'TAX INVOICE & WEIGHBRIDGE TICKET' : 'SALES & DISPATCH INVOICE')
        : 'DELIVERY TICKET & GATE PASS',
      badge: priceMode === 'priced'
        ? (vatUsd > 0 ? 'PRICED · 11% VAT INVOICE' : 'PRICED SALES INVOICE')
        : 'UNPRICED DRIVER GATE PASS',
      ticketNo,
      dateStr,
      repDateStr,
      timeStr,
      overtime: !!record.overtime,
      saleType,
      transportBy: record.transport_by || 'Company fleet',
      customer: record.customer || 'Walk-in Customer',
      product: record.product || 'Aggregate',
      site: record.site || '',
      truck: record.truck || '—',
      truckOwner: record.truck_owner || (record.transport_by === 'Company fleet' ? company : '—'),
      driver: record.driver || '',
      qty,
      uom,
      tons,
      tonFactor,
      extQty: record.external_qty != null && record.external_qty !== '' ? Number(record.external_qty) : null,
      unitPrice,
      tierAdj,
      disc,
      matTotal,
      transRate,
      transTotal,
      tip,
      netUsd,
      vatUsd,
      ttcUsd,
      method: record.method || 'Credit',
      vatInvoice: record.vat_invoice || '',
      extInvoice: record.external_invoice || '',
      reference: record.reference || '',
      priceRule: record.price_rule || '',
      notes: record.notes || '',
      enteredBy: record.entered_by || 'Weighbridge Operator',
      barcodeDigits
    };
  }

  // ---- Build ESC/POS Binary Stream (80mm / 58mm, Priced / Unpriced) --------
  function buildEscPosBytes(a, b, c) {
    const d = normalizeTicketPayload(a, b, c);
    const W = paperCols(d.paperWidth);
    const SEP = '-'.repeat(W);
    const DSEP = '='.repeat(W);
    const bytes = [];
    const emit = (...arrs) => { for (const a of arrs) for (const b of a) bytes.push(b); };
    const line = (s = '') => emit(encodeAscii(s), [LF]);
    const lr = (l, r) => line(padLR(l, r, W));

    emit(P.INIT);

    // 1. Monochrome Raster ISABI + Company Crest
    const logoRaster = buildBrandLogoRaster(d.company, d.paperWidth);
    if (logoRaster && logoRaster.length) {
      emit(P.ALIGN_C, logoRaster, [LF]);
    } else {
      emit(P.ALIGN_C, P.BOLD_ON, P.DBL_ON);
      line(`ISABI - ${d.company.toUpperCase()}`);
      emit(P.NORMAL, P.BOLD_OFF);
    }

    // 2. Company & Document Title Header
    emit(P.ALIGN_C, P.BOLD_ON);
    line(d.coFull);
    line(d.title);
    emit(P.BOLD_OFF);
    line(`[${d.badge}]`);
    line(DSEP);

    // 3. Ticket Number & Date/Time
    emit(P.ALIGN_L, P.BOLD_ON, P.TALL_ON);
    lr(`TICKET #${d.ticketNo}`, d.overtime ? '[OVERTIME]' : d.dateStr);
    emit(P.NORMAL, P.BOLD_OFF);
    lr('Date / Time:', `${d.dateStr} ${d.timeStr}`);
    if (d.repDateStr && d.repDateStr !== d.dateStr) {
      lr('Reporting Date:', d.repDateStr);
    }
    lr('Company (BU):', d.company);
    line(SEP);

    // 4. Body by Document Type
    if (d.docType === 'sales') {
      lr('Sale Type:', d.saleType);
      lr('Customer:', d.customer);
      if (d.site) lr('Dest. Site:', d.site);
      lr('Truck Plate:', d.truck);
      if (d.truckOwner && d.truckOwner !== '—') lr('Hauler / Owner:', d.truckOwner);
      if (d.driver) lr('Driver:', d.driver);
      line(SEP);

      emit(P.BOLD_ON);
      line('MATERIAL & LOAD QUANTITY');
      emit(P.BOLD_OFF);
      emit(P.BOLD_ON, P.TALL_ON);
      line(d.product);
      emit(P.NORMAL, P.BOLD_OFF);
      emit(P.BOLD_ON);
      lr('Net Quantity:', `${fmtQty(d.qty, 2)} ${d.uom}`);
      emit(P.BOLD_OFF);
      if (d.uom !== 'Ton' && d.tonFactor && d.tonFactor !== 1) {
        lr('Tonnage Equiv:', `${fmtQty(d.tons, 2)} Tons (x${d.tonFactor})`);
      }
      if (d.extQty != null) {
        lr('Customer Qty:', `${fmtQty(d.extQty, 2)} ${d.uom}`);
      }

      if (d.priceMode === 'priced') {
        line(SEP);
        lr(`Unit Price (${d.uom}):`, fmtMoney(d.unitPrice));
        if (d.tierAdj) lr('Tier Adjustment:', (d.tierAdj > 0 ? '+' : '') + fmtMoney(d.tierAdj));
        if (d.disc > 0) lr('Discount:', '-' + fmtMoney(d.disc));
        lr('Material Subtotal:', fmtMoney(d.matTotal));
        if (d.saleType === 'Delivery' || d.transTotal > 0) {
          lr(`Transport Rate (${d.uom}):`, fmtMoney(d.transRate));
          lr('Transport Total:', fmtMoney(d.transTotal));
        }
        if (d.tip > 0) lr('Driver Tip:', fmtMoney(d.tip));
        line(SEP);
        emit(P.BOLD_ON);
        lr('TOTAL EX-VAT (USD):', fmtMoney(d.netUsd));
        emit(P.BOLD_OFF);
        if (d.vatUsd > 0) {
          lr('Statutory VAT 11%:', fmtMoney(d.vatUsd));
          if (d.vatInvoice) lr('VAT Invoice #:', d.vatInvoice);
        }
        line(DSEP);
        emit(P.BOLD_ON, P.TALL_ON);
        lr('TOTAL USD:', fmtMoney(d.ttcUsd));
        emit(P.NORMAL, P.BOLD_OFF);
        lr('Payment Method:', d.method.toUpperCase());
      } else {
        line(DSEP);
        emit(P.ALIGN_C, P.BOLD_ON, P.TALL_ON);
        line(`GATE PASS QTY: ${fmtQty(d.qty, 2)} ${d.uom}`);
        emit(P.NORMAL, P.BOLD_OFF);
        line('UNPRICED DELIVERY TICKET - DRIVER COPY');
        emit(P.ALIGN_L);
      }
    } else if (d.docType === 'raw') {
      lr('Site:', d.site);
      lr('Site Owner:', d.siteOwner);
      lr('Transport By:', d.transportBy);
      lr('Truck Plate:', d.truck);
      lr('Truck Owner:', d.truckOwner);
      if (d.driver && d.driver !== '—') lr('Driver:', d.driver);
      line(SEP);

      emit(P.BOLD_ON);
      line('RAW MATERIAL RECEIVED');
      emit(P.BOLD_OFF);
      emit(P.BOLD_ON, P.TALL_ON);
      line(d.product);
      emit(P.NORMAL, P.BOLD_OFF);
      emit(P.BOLD_ON);
      lr('Quantity Received:', `${fmtQty(d.qty, 2)} ${d.uom}`);
      emit(P.BOLD_OFF);
      if (d.uom !== 'Ton' && d.tonFactor && d.tonFactor !== 1) {
        lr('Tonnage Equiv:', `${fmtQty(d.tons, 2)} Tons`);
      }

      if (d.priceMode === 'priced') {
        line(SEP);
        lr(`Mat. Unit Cost (${d.uom}):`, fmtMoney(d.unitCost));
        if (d.disc > 0) lr('Discount:', '-' + fmtMoney(d.disc));
        lr('Leg 1 Material (Site):', fmtMoney(d.matCost));
        lr(`Haulage Rate (${d.uom}):`, fmtMoney(d.haulRate));
        lr('Leg 2 Haulage (Truck):', fmtMoney(d.haulCost));
        line(DSEP);
        emit(P.BOLD_ON, P.TALL_ON);
        lr('TOTAL PAYABLE:', fmtMoney(d.totalUsd));
        emit(P.NORMAL, P.BOLD_OFF);
        lr('Settlement Method:', d.method.toUpperCase());
      } else {
        line(DSEP);
        emit(P.ALIGN_C, P.BOLD_ON, P.TALL_ON);
        line(`SCALE QTY: ${fmtQty(d.qty, 2)} ${d.uom}`);
        emit(P.NORMAL, P.BOLD_OFF);
        line('UNPRICED SCALE RECEIVING SLIP');
        emit(P.ALIGN_L);
      }
    } else if (d.docType === 'fuel') {
      lr('Tank / Depot:', d.location);
      lr('Fuel / Item:', d.item);
      lr('Equipment / Unit:', d.equipment);
      if (d.driver && d.driver !== '—') lr('Driver / Operator:', d.driver);
      line(SEP);
      emit(P.BOLD_ON, P.TALL_ON);
      lr('LITRES ISSUED:', `${fmtQty(d.litres, 1)} L`);
      emit(P.NORMAL, P.BOLD_OFF);
      if (d.reading != null) {
        lr('Meter Reading:', `${fmtQty(d.reading, 0)} ${d.meterUnit}`);
      }
      if (d.delta != null && d.delta > 0) {
        lr('Delta Since Last:', `+${fmtQty(d.delta, 0)} ${d.meterUnit}`);
      }
      if (d.priceMode === 'priced' && d.totalUsd > 0) {
        line(SEP);
        lr('Total Fuel Cost:', fmtMoney(d.totalUsd));
      }
    }

    if (d.reference) lr('Reference:', d.reference);
    if (d.extInvoice) lr('Ext. Invoice #:', d.extInvoice);
    if (d.notes) {
      line(SEP);
      line('Notes: ' + d.notes.slice(0, W - 7));
    }

    // 5. Signatures & Gate Stamp Block
    line(SEP);
    lr('Operator:', d.enteredBy);
    line('');
    line(padLR('Driver Sign:', '__________________', W));
    line('');
    line(padLR('Scale / Gate:', '__________________', W));
    line(SEP);

    // 6. Raster CODE128-C Barcode + Human Readable Code
    const barcodeBytes = buildBarcodeRaster(d.barcodeDigits, d.paperWidth, 52);
    if (barcodeBytes && barcodeBytes.length) {
      emit(P.ALIGN_C, barcodeBytes);
      line(d.barcodeDigits);
    }
    emit(P.ALIGN_C);
    line(`ISABI MFG v9.0 · ${d.paperWidth.toUpperCase()} THERMAL`);
    emit(P.ALIGN_L, P.FEED(4), P.CUT);

    return new Uint8Array(bytes);
  }

  function bytesToBase64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) {
      bin += String.fromCharCode(bytes[i]);
    }
    return btoa(bin);
  }

  // ---- Transport 1: RawBT Android / Tablet Bridge (rawbt:base64,...) -------
  function sendToRawBt(bytes, meta = {}) {
    const b64 = bytesToBase64(bytes);
    const uri = 'rawbt:base64,' + b64;
    _lastJob = {
      ts: new Date().toISOString(),
      transport: 'rawbt',
      byteLength: bytes.length,
      base64Length: b64.length,
      uriPrefix: uri.slice(0, 32),
      meta
    };
    // Guard navigation during headless Edge verification so CDP test page doesn't unload
    if (typeof navigator !== 'undefined' && (navigator.webdriver || window.__MFG_HEADLESS_TEST)) {
      return { ok: true, simulated: true, job: _lastJob };
    }
    try {
      const a = document.createElement('a');
      a.href = uri;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => a.remove(), 1200);
      return { ok: true, job: _lastJob };
    } catch (err) {
      return { ok: false, error: String(err && err.message || err) };
    }
  }

  // ---- Transport 2: Direct Web Bluetooth GATT (BLE Thermal Printers) -------
  const BLE_PRINTER_SERVICES = [
    '000018f0-0000-1000-8000-00805f9b34fb',
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
    '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    '0000ff00-0000-1000-8000-00805f9b34fb'
  ];

  async function pairWebBluetoothPrinter() {
    if (typeof navigator === 'undefined' || !navigator.bluetooth) {
      return { ok: false, reason: 'Web Bluetooth API is not supported in this browser — use Chrome/Edge or RawBT.' };
    }
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: BLE_PRINTER_SERVICES
      });
      const server = await device.gatt.connect();
      const services = await server.getPrimaryServices();
      let writeChar = null;
      for (const svc of services) {
        const chars = await svc.getCharacteristics();
        for (const ch of chars) {
          if (ch.properties && (ch.properties.write || ch.properties.writeWithoutResponse)) {
            writeChar = ch;
            break;
          }
        }
        if (writeChar) break;
      }
      if (!writeChar) {
        return { ok: false, reason: 'Connected to Bluetooth device, but no writable ESC/POS characteristic was found.' };
      }
      _bleDevice = device;
      _bleCharacteristic = writeChar;
      saveCfg({ deviceName: device.name || 'Bluetooth Thermal Printer', transport: 'webbt' });
      device.addEventListener('gattserverdisconnected', () => {
        _bleCharacteristic = null;
      });
      return { ok: true, deviceName: device.name || 'Bluetooth Thermal Printer' };
    } catch (err) {
      return { ok: false, reason: String(err && err.message || err) };
    }
  }

  async function sendToWebBluetooth(bytes, meta = {}) {
    if (!_bleCharacteristic) {
      const paired = await pairWebBluetoothPrinter();
      if (!paired.ok) return paired;
    }
    try {
      const CHUNK = 180;
      for (let offset = 0; offset < bytes.length; offset += CHUNK) {
        const slice = bytes.slice(offset, offset + CHUNK);
        if (_bleCharacteristic.properties.writeWithoutResponse && _bleCharacteristic.writeValueWithoutResponse) {
          await _bleCharacteristic.writeValueWithoutResponse(slice);
        } else {
          await _bleCharacteristic.writeValue(slice);
        }
      }
      _lastJob = {
        ts: new Date().toISOString(),
        transport: 'webbt',
        deviceName: (_bleDevice && _bleDevice.name) || 'BLE Printer',
        byteLength: bytes.length,
        meta
      };
      return { ok: true, job: _lastJob };
    } catch (err) {
      return { ok: false, reason: String(err && err.message || err) };
    }
  }

  // ---- Visual HTML Thermal Ticket Renderer (80mm & 58mm Preview + Print) ---
  function renderThermalTicketHtml(a, b, c) {
    const d = normalizeTicketPayload(a, b, c);
    const is58 = d.paperWidth === '58mm';

    let bodyRowsHtml = '';
    if (d.docType === 'sales') {
      bodyRowsHtml = `
        <div class="th-kv"><span>Sale Type</span><b>${escHtml(d.saleType)}</b></div>
        <div class="th-kv"><span>Customer</span><b>${escHtml(d.customer)}</b></div>
        ${d.site ? `<div class="th-kv"><span>Destination Site</span><b>${escHtml(d.site)}</b></div>` : ''}
        <div class="th-kv"><span>Truck Plate</span><b class="mono">${escHtml(d.truck)}</b></div>
        ${d.truckOwner && d.truckOwner !== '—' ? `<div class="th-kv"><span>Hauler / Owner</span><b>${escHtml(d.truckOwner)}</b></div>` : ''}
        ${d.driver ? `<div class="th-kv"><span>Driver</span><b>${escHtml(d.driver)}</b></div>` : ''}
        <div class="th-sep"></div>
        <div class="th-sec-lbl">MATERIAL &amp; LOAD QUANTITY</div>
        <div class="th-item-title">${escHtml(d.product)}</div>
        <div class="th-kv th-kv-lg"><span>Net Quantity</span><b>${fmtQty(d.qty, 2)} ${escHtml(d.uom)}</b></div>
        ${d.uom !== 'Ton' && d.tonFactor && d.tonFactor !== 1 ? `<div class="th-kv"><span>Tonnage Equiv.</span><b>${fmtQty(d.tons, 2)} Tons (×${d.tonFactor})</b></div>` : ''}
        ${d.extQty != null ? `<div class="th-kv"><span>Customer Declared</span><b>${fmtQty(d.extQty, 2)} ${escHtml(d.uom)}</b></div>` : ''}
        ${d.priceMode === 'priced' ? `
          <div class="th-sep"></div>
          <div class="th-kv"><span>Unit Price (${escHtml(d.uom)})</span><b>${fmtMoney(d.unitPrice)}</b></div>
          ${d.tierAdj ? `<div class="th-kv"><span>Tier Adjustment</span><b>${(d.tierAdj > 0 ? '+' : '') + fmtMoney(d.tierAdj)}</b></div>` : ''}
          ${d.disc > 0 ? `<div class="th-kv"><span>Discount</span><b>-${fmtMoney(d.disc)}</b></div>` : ''}
          <div class="th-kv"><span>Material Subtotal</span><b>${fmtMoney(d.matTotal)}</b></div>
          ${(d.saleType === 'Delivery' || d.transTotal > 0) ? `
            <div class="th-kv"><span>Transport Rate (${escHtml(d.uom)})</span><b>${fmtMoney(d.transRate)}</b></div>
            <div class="th-kv"><span>Transport Total</span><b>${fmtMoney(d.transTotal)}</b></div>
          ` : ''}
          ${d.tip > 0 ? `<div class="th-kv"><span>Driver Tip</span><b>${fmtMoney(d.tip)}</b></div>` : ''}
          <div class="th-sep"></div>
          <div class="th-kv"><span>TOTAL EX-VAT (USD)</span><b>${fmtMoney(d.netUsd)}</b></div>
          ${d.vatUsd > 0 ? `
            <div class="th-kv"><span>Statutory VAT (11%)</span><b>${fmtMoney(d.vatUsd)}</b></div>
            ${d.vatInvoice ? `<div class="th-kv"><span>VAT Invoice #</span><b class="mono">${escHtml(d.vatInvoice)}</b></div>` : ''}
          ` : ''}
          <div class="th-dsep"></div>
          <div class="th-total-row"><span>TOTAL USD</span><b>${fmtMoney(d.ttcUsd)}</b></div>
          <div class="th-kv"><span>Payment Method</span><b>${escHtml(d.method.toUpperCase())}</b></div>
        ` : `
          <div class="th-dsep"></div>
          <div class="th-gatepass-box">
            <div class="th-gatepass-qty">GATE PASS: ${fmtQty(d.qty, 2)} ${escHtml(d.uom)}</div>
            <div class="th-gatepass-sub">UNPRICED DELIVERY TICKET · DRIVER COPY</div>
          </div>
        `}
      `;
    } else if (d.docType === 'raw') {
      bodyRowsHtml = `
        <div class="th-kv"><span>Site</span><b>${escHtml(d.site)}</b></div>
        <div class="th-kv"><span>Site Owner (Mat.)</span><b>${escHtml(d.siteOwner)}</b></div>
        <div class="th-kv"><span>Transport By</span><b>${escHtml(d.transportBy)}</b></div>
        <div class="th-kv"><span>Truck Plate</span><b class="mono">${escHtml(d.truck)}</b></div>
        <div class="th-kv"><span>Truck Owner (Haul)</span><b>${escHtml(d.truckOwner)}</b></div>
        ${d.driver && d.driver !== '—' ? `<div class="th-kv"><span>Driver</span><b>${escHtml(d.driver)}</b></div>` : ''}
        <div class="th-sep"></div>
        <div class="th-sec-lbl">RAW MATERIAL RECEIVED</div>
        <div class="th-item-title">${escHtml(d.product)}</div>
        <div class="th-kv th-kv-lg"><span>Received Qty</span><b>${fmtQty(d.qty, 2)} ${escHtml(d.uom)}</b></div>
        ${d.uom !== 'Ton' && d.tonFactor && d.tonFactor !== 1 ? `<div class="th-kv"><span>Tonnage Equiv.</span><b>${fmtQty(d.tons, 2)} Tons</b></div>` : ''}
        ${d.priceMode === 'priced' ? `
          <div class="th-sep"></div>
          <div class="th-kv"><span>Mat. Unit Cost (${escHtml(d.uom)})</span><b>${fmtMoney(d.unitCost)}</b></div>
          ${d.disc > 0 ? `<div class="th-kv"><span>Discount</span><b>-${fmtMoney(d.disc)}</b></div>` : ''}
          <div class="th-kv"><span>Leg 1 · Material (Site)</span><b>${fmtMoney(d.matCost)}</b></div>
          <div class="th-kv"><span>Haulage Rate (${escHtml(d.uom)})</span><b>${fmtMoney(d.haulRate)}</b></div>
          <div class="th-kv"><span>Leg 2 · Haulage (Truck)</span><b>${fmtMoney(d.haulCost)}</b></div>
          <div class="th-dsep"></div>
          <div class="th-total-row"><span>TOTAL PAYABLE</span><b>${fmtMoney(d.totalUsd)}</b></div>
          <div class="th-kv"><span>Settlement Method</span><b>${escHtml(d.method.toUpperCase())}</b></div>
        ` : `
          <div class="th-dsep"></div>
          <div class="th-gatepass-box">
            <div class="th-gatepass-qty">SCALE QTY: ${fmtQty(d.qty, 2)} ${escHtml(d.uom)}</div>
            <div class="th-gatepass-sub">UNPRICED SCALE RECEIVING SLIP</div>
          </div>
        `}
      `;
    } else {
      bodyRowsHtml = `
        <div class="th-kv"><span>Tank / Depot</span><b>${escHtml(d.location)}</b></div>
        <div class="th-kv"><span>Fuel / Lubricant</span><b>${escHtml(d.item)}</b></div>
        <div class="th-kv"><span>Equipment / Unit</span><b class="mono">${escHtml(d.equipment)}</b></div>
        ${d.driver && d.driver !== '—' ? `<div class="th-kv"><span>Driver / Operator</span><b>${escHtml(d.driver)}</b></div>` : ''}
        <div class="th-sep"></div>
        <div class="th-total-row"><span>LITRES ISSUED</span><b>${fmtQty(d.litres, 1)} L</b></div>
        ${d.reading != null ? `<div class="th-kv"><span>Meter Reading</span><b>${fmtQty(d.reading, 0)} ${escHtml(d.meterUnit)}</b></div>` : ''}
        ${d.delta != null && d.delta > 0 ? `<div class="th-kv"><span>Distance / Hours</span><b>+${fmtQty(d.delta, 0)} ${escHtml(d.meterUnit)}</b></div>` : ''}
        ${d.priceMode === 'priced' && d.totalUsd > 0 ? `
          <div class="th-sep"></div>
          <div class="th-kv"><span>Total Fuel Cost</span><b>${fmtMoney(d.totalUsd)}</b></div>
        ` : ''}
      `;
    }

    return `
      <div class="thermal-paper-roll ${is58 ? 'paper-58mm' : 'paper-80mm'}" data-paper-width="${escHtml(d.paperWidth)}" data-price-mode="${escHtml(d.priceMode)}" data-doc-type="${escHtml(d.docType)}">
        <div class="th-brand-crest">
          <svg viewBox="-9.5 -78.8 74.66 109.7" width="28" height="34" aria-hidden="true">
            <g fill="#000">
              <path transform="translate(-8.45,0)" d="M8.45 0V-68.75H28.81V0Z"/>
              <path transform="translate(-10.45,0)" d="M45.75 0V-68.75H66.11V0Z"/>
              <rect x="0" y="9.5" width="55.66" height="4.2"/>
              <rect x="0" y="18.2" width="55.66" height="4.2"/>
            </g>
          </svg>
          <div class="th-co-name">${escHtml(d.coFull)}</div>
          <div class="th-doc-title">${escHtml(d.title)}</div>
          <div class="th-mode-pill">${escHtml(d.badge)} · ${escHtml(d.paperWidth.toUpperCase())}</div>
        </div>
        <div class="th-dsep"></div>
        <div class="th-ticket-head">
          <span class="th-tkt-num">TICKET #${escHtml(d.ticketNo)}</span>
          ${d.overtime ? '<span class="th-ot-tag">OVERTIME</span>' : `<span class="th-tkt-date">${escHtml(d.dateStr)} ${escHtml(d.timeStr)}</span>`}
        </div>
        <div class="th-kv"><span>Date / Time</span><b class="mono">${escHtml(d.dateStr)} ${escHtml(d.timeStr)}</b></div>
        ${d.repDateStr && d.repDateStr !== d.dateStr ? `<div class="th-kv"><span>Reporting Date</span><b class="mono">${escHtml(d.repDateStr)}</b></div>` : ''}
        <div class="th-kv"><span>Company (BU)</span><b>${escHtml(d.company)}</b></div>
        <div class="th-sep"></div>
        ${bodyRowsHtml}
        ${d.reference ? `<div class="th-kv"><span>Reference</span><b>${escHtml(d.reference)}</b></div>` : ''}
        ${d.extInvoice ? `<div class="th-kv"><span>Ext. Invoice #</span><b class="mono">${escHtml(d.extInvoice)}</b></div>` : ''}
        ${d.notes ? `<div class="th-sep"></div><div class="th-notes"><b>Notes:</b> ${escHtml(d.notes)}</div>` : ''}
        <div class="th-sep"></div>
        <div class="th-kv"><span>Operator</span><b>${escHtml(d.enteredBy)}</b></div>
        <div class="th-sig-grid">
          <div class="th-sig-box"><span>Driver Signature</span></div>
          <div class="th-sig-box"><span>Scale / Gate Stamp</span></div>
        </div>
        <div class="th-barcode-wrap">
          ${renderBarcodeSvg(d.barcodeDigits, 38)}
          <div class="th-barcode-num">${escHtml(d.barcodeDigits)}</div>
        </div>
        <div class="th-foot-caption">ISABI WEIGHBRIDGE &amp; KIOSK SUITE · ${escHtml(d.paperWidth.toUpperCase())} ESC/POS</div>
      </div>
    `;
  }

  // ---- Interactive Thermal Preview & Bluetooth Dispatch Modal --------------
  let _activeModalState = null;

  function ensureThermalModalDom() {
    let modal = document.getElementById('thermalPrintModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'thermalPrintModal';
    modal.className = 'modal-backdrop thermal-modal-backdrop';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="modal-card thermal-modal-card" role="dialog" aria-modal="true" aria-labelledby="thermalModalTitle">
        <div class="modal-head thermal-modal-head">
          <div>
            <div class="cockpit-eyebrow">BLUETOOTH ESC/POS THERMAL PRINTER · RAWBT &amp; WEB BLUETOOTH</div>
            <h3 id="thermalModalTitle">Bluetooth Thermal Ticket</h3>
          </div>
          <button type="button" class="btn-icon" id="closeThermalModalBtn" aria-label="Close thermal preview">✕</button>
        </div>
        <div class="thermal-modal-controls">
          <div class="thermal-ctrl-group">
            <span class="thermal-ctrl-lbl">Ticket Format (Pref 1):</span>
            <div class="grain-switch" id="thermalModeSwitch">
              <button type="button" class="grain-btn" data-th-mode="priced">${ic('receipt')} Priced (Invoice / Voucher)</button>
              <button type="button" class="grain-btn" data-th-mode="unpriced">${ic('truck')} Unpriced (Gate Pass / Slip)</button>
            </div>
          </div>
          <div class="thermal-ctrl-group">
            <span class="thermal-ctrl-lbl">Paper Roll Width (Pref 2):</span>
            <div class="grain-switch" id="thermalWidthSwitch">
              <button type="button" class="grain-btn" data-th-width="80mm">80mm (48 cols · Standard)</button>
              <button type="button" class="grain-btn" data-th-width="58mm">58mm (32 cols · Mobile)</button>
            </div>
          </div>
        </div>
        <div class="thermal-modal-body" id="thermalModalPreviewWrap"></div>
        <div class="modal-foot thermal-modal-foot">
          <span class="form-note" id="thermalModalStatusNote">Ready to print via Bluetooth ESC/POS</span>
          <div class="thermal-modal-actions">
            <button type="button" class="btn" id="thermalBrowserPrintBtn" title="Print via system / browser thermal printer dialog">${ic('window')} Browser Print</button>
            <button type="button" class="btn" id="thermalWebBtBtn" title="Pair &amp; print directly via Web Bluetooth GATT">${ic('bluetooth')} Web Bluetooth</button>
            <button type="button" class="btn btn-brass" id="thermalRawBtBtn" title="Send ESC/POS raster + barcode to Bluetooth printer via RawBT">${ic('printer')} Print Bluetooth (RawBT)</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', e => {
      if (e.target === modal) closeThermalModal();
    });
    const closeBtn = document.getElementById('closeThermalModalBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeThermalModal);

    modal.querySelectorAll('[data-th-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-th-mode');
        saveCfg({ priceMode: mode });
        if (_activeModalState) {
          _activeModalState.opts.priceMode = mode;
          refreshThermalModalDom();
        }
        if (typeof window.__mfgSyncKioskPrintControls === 'function') window.__mfgSyncKioskPrintControls();
      });
    });

    modal.querySelectorAll('[data-th-width]').forEach(btn => {
      btn.addEventListener('click', () => {
        const w = btn.getAttribute('data-th-width');
        saveCfg({ paperWidth: w });
        if (_activeModalState) {
          _activeModalState.opts.paperWidth = w;
          refreshThermalModalDom();
        }
        if (typeof window.__mfgSyncKioskPrintControls === 'function') window.__mfgSyncKioskPrintControls();
      });
    });

    const rawBtBtn = document.getElementById('thermalRawBtBtn');
    if (rawBtBtn) {
      rawBtBtn.addEventListener('click', () => {
        if (!_activeModalState) return;
        const res = printThermalTicket(_activeModalState.docType, _activeModalState.record, Object.assign({}, _activeModalState.opts, { transport: 'rawbt', openModal: false }));
        const note = document.getElementById('thermalModalStatusNote');
        if (note && res && res.ok) {
          note.textContent = `✓ Sent ${res.byteLength} ESC/POS bytes (${res.paperWidth} · ${res.priceMode}) to Bluetooth printer`;
        }
      });
    }

    const webBtBtn = document.getElementById('thermalWebBtBtn');
    if (webBtBtn) {
      webBtBtn.addEventListener('click', async () => {
        if (!_activeModalState) return;
        const note = document.getElementById('thermalModalStatusNote');
        if (note) note.textContent = 'Connecting to Bluetooth thermal printer…';
        const bytes = buildEscPosBytes(_activeModalState.docType, _activeModalState.record, _activeModalState.opts);
        const res = await sendToWebBluetooth(bytes, _activeModalState.opts);
        if (note) {
          note.textContent = res.ok
            ? `✓ Printed ${bytes.length} bytes on ${res.job.deviceName}`
            : `⚠ ${res.reason || 'Bluetooth pairing cancelled'}`;
        }
      });
    }

    const browserBtn = document.getElementById('thermalBrowserPrintBtn');
    if (browserBtn) {
      browserBtn.addEventListener('click', () => {
        document.body.classList.add('printing-thermal-ticket');
        window.print();
        setTimeout(() => document.body.classList.remove('printing-thermal-ticket'), 500);
      });
    }

    return modal;
  }

  function refreshThermalModalDom() {
    if (!_activeModalState) return;
    const modal = ensureThermalModalDom();
    const { docType, record, opts } = _activeModalState;
    const d = normalizeTicketPayload(docType, record, opts);
    const bytes = buildEscPosBytes(docType, record, opts);

    const titleEl = document.getElementById('thermalModalTitle');
    if (titleEl) {
      titleEl.textContent = `${d.company} · Ticket #${d.ticketNo} (${d.paperWidth.toUpperCase()} · ${d.priceMode === 'priced' ? 'Priced' : 'Unpriced Gate Pass'})`;
    }
    modal.querySelectorAll('[data-th-mode]').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-th-mode') === d.priceMode);
    });
    modal.querySelectorAll('[data-th-width]').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-th-width') === d.paperWidth);
    });
    const wrap = document.getElementById('thermalModalPreviewWrap');
    if (wrap) {
      wrap.innerHTML = renderThermalTicketHtml(docType, record, opts);
    }
    const note = document.getElementById('thermalModalStatusNote');
    if (note) {
      note.textContent = `ESC/POS payload ready: ${bytes.length.toLocaleString()} bytes · ${paperCols(d.paperWidth)} cols (${paperDots(d.paperWidth)} dots) · Barcode ${d.barcodeDigits}`;
    }
  }

  function openThermalPreviewModal(a, b, c) {
    const resolved = resolveDocArgs(a, b, c);
    const cfg = loadCfg();
    _activeModalState = {
      docType: resolved.docType || 'sales',
      record: resolved.record || {},
      opts: {
        paperWidth: normWidthStr(resolved.opts.paperWidth || cfg.paperWidth || '80mm'),
        priceMode: (resolved.opts.priceMode || cfg.priceMode || 'priced') === 'unpriced' ? 'unpriced' : 'priced'
      }
    };
    const modal = ensureThermalModalDom();
    refreshThermalModalDom();
    modal.hidden = false;
    return {
      ok: true,
      paperWidth: _activeModalState.opts.paperWidth,
      priceMode: _activeModalState.opts.priceMode
    };
  }

  function closeThermalModal() {
    const modal = document.getElementById('thermalPrintModal');
    if (modal) modal.hidden = true;
  }

  // ---- Main Entry Point: Print + Preview Thermal Ticket --------------------
  function printThermalTicket(a, b, c) {
    const resolved = resolveDocArgs(a, b, c);
    const docType = resolved.docType;
    const record = resolved.record;
    const opts = resolved.opts || {};
    const cfg = loadCfg();
    const paperWidth = normWidthStr(opts.paperWidth || cfg.paperWidth || '80mm');
    const priceMode = (opts.priceMode || cfg.priceMode || 'priced') === 'unpriced' ? 'unpriced' : 'priced';
    const rawCh = opts.transport || opts.channel || cfg.transport || 'rawbt';
    const transport = rawCh === 'web_bluetooth' ? 'webbt' : rawCh;
    const normOpts = { paperWidth, priceMode };
    const normalized = normalizeTicketPayload(docType, record, normOpts);
    const bytes = buildEscPosBytes(docType, record, normOpts);
    const asciiPreview = asciiClean(new TextDecoder('ascii', { fatal: false }).decode(bytes));

    let sendRes = { ok: true };
    if (transport === 'rawbt') {
      sendRes = sendToRawBt(bytes, {
        docType: normalized.docType,
        ticketNo: normalized.ticketNo,
        paperWidth,
        priceMode,
        barcode: normalized.barcodeDigits
      });
    } else if (transport === 'webbt') {
      sendToWebBluetooth(bytes, normOpts);
    }

    if (opts.openModal !== false) {
      openThermalPreviewModal(docType, record, normOpts);
    }

    return {
      ok: sendRes.ok !== false,
      docType: normalized.docType,
      ticketNo: normalized.ticketNo,
      paperWidth: normWidthNum(paperWidth),
      paperWidthStr: paperWidth,
      priceMode,
      channel: SETTINGS.channel,
      cols: paperCols(paperWidth),
      dots: paperDots(paperWidth),
      byteLength: bytes.length,
      barcodeDigits: normalized.barcodeDigits,
      asciiPreview,
      job: _lastJob
    };
  }

  loadCfg();

  window.MFG_PRINT = {
    SETTINGS,
    loadCfg,
    saveCfg,
    savePrintSettings,
    paperCols,
    paperDots,
    normalizeTicketPayload,
    buildEscPosBytes,
    renderThermalTicketHtml,
    openThermalPreviewModal,
    closeThermalModal,
    printThermalTicket,
    pairWebBluetoothPrinter,
    getLastJob: () => _lastJob
  };
})();
