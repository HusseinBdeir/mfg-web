// build/verify_mfg.mjs — headless Edge smoke test for the mfg-web PWA (v4.1).
// Serves the repo with server.py on a scratch port, drives Edge through CDP (Node 24 built-in WebSocket),
// walks every view / PBI page / table / form, asserts 0 runtime errors, 0px horizontal overflow,
// the GL totals render (v4.0 showed $0.00 on P16), and the Tier adjustment is applied per load.
//   node build/verify_mfg.mjs            (desktop 1366×768)
//   node build/verify_mfg.mjs --mobile   (390×844 emulation)
import { spawn, execFile, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8097 + Math.floor(Math.random() * 100);
const DBG = 9333 + Math.floor(Math.random() * 100);
const MOBILE = process.argv.includes('--mobile');
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find(p => fs.existsSync(p));
if (!EDGE) { console.error('msedge.exe not found'); process.exit(2); }

const results = [];
const fail = (name, detail) => { results.push({ ok: false, name, detail }); console.log(`FAIL  ${name} — ${detail}`); };
const pass = (name, detail = '') => { results.push({ ok: true, name, detail }); console.log(`ok    ${name}${detail ? ' — ' + detail : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function getJson(url) {
  return new Promise((resolve, reject) => http.get(url, res => { let b = ''; res.on('data', c => b += c); res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } }); }).on('error', reject));
}
async function waitHttp(url, tries = 60) {
  for (let i = 0; i < tries; i++) { try { await getJson(url); return true; } catch (_) { await sleep(250); } }
  return false;
}

const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'mfg-verify-'));
const tempDb = path.join(udd, 'mfg.db');
try { fs.copyFileSync(path.join(ROOT, 'data', 'mfg.db'), tempDb); } catch (_) {}
const server = spawn('python', ['server.py', String(PORT)], { cwd: ROOT, env: Object.assign({}, process.env, { MFG_DB_PATH: tempDb }), stdio: 'ignore', windowsHide: true });
const edge = spawn(EDGE, [`--headless=new`, `--enable-automation`, `--remote-debugging-port=${DBG}`, `--user-data-dir=${udd}`, '--no-first-run', '--disable-gpu', '--window-size=1366,768', 'about:blank'], { stdio: 'ignore', windowsHide: true });

let ws, msgId = 0; const pending = new Map(); const events = [];
function send(method, params = {}, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const timer = setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`CDP timeout (${timeoutMs}ms): ${method} [${String(params.expression || "").replace(/\s+/g, " ").slice(0, 140)}]`));
      }
    }, timeoutMs);
    pending.set(id, {
      resolve: val => { clearTimeout(timer); resolve(val); },
      reject: err => { clearTimeout(timer); reject(err); }
    });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expr, timeoutMs = 15000) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, timeoutMs);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
async function waitPageReady(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const ok = await evaluate(
        `Boolean(document.readyState === 'complete' && window.MFG_SEED && window.MFG_PBI && window.MFG_FACE_TEST && document.getElementById('workspace'))`,
        3000
      );
      if (ok) return true;
    } catch {}
    await sleep(200);
  }
  throw new Error('Page ready timeout');
}

try {
  if (!(await waitHttp(`http://127.0.0.1:${PORT}/api/status`))) throw new Error('server.py did not start');
  if (!(await waitHttp(`http://127.0.0.1:${DBG}/json/version`))) throw new Error('Edge devtools did not start');
  const targets = await getJson(`http://127.0.0.1:${DBG}/json`);
  const page = targets.find(t => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
    else if (m.method) events.push(m);
  };
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__MFG_HEADLESS_TEST = true;' });
  await send('Emulation.setDeviceMetricsOverride', MOBILE
    ? { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }
    : { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?demo=1&nosse=1` });
  await sleep(600);
  await waitPageReady();

  // 0. Always starts on the login gate (#authGate visible, body.locked, no #overview hash), even if a legacy localStorage email exists
  const initialGate = await evaluate(`(() => ({ gateOpen: !document.getElementById('authGate').hidden, locked: document.body.classList.contains('locked'), hash: location.hash }))()`);
  initialGate.gateOpen && initialGate.locked && initialGate.hash === ''
    ? pass('authGate · opens on login screen first (no auto-open)')
    : fail('authGate initial state', JSON.stringify(initialGate));
  await evaluate(`localStorage.setItem('isabi_mfg_active_email', 'husseinbdeir@bhfirms.com')`);
  await send('Page.reload', { ignoreCache: false });
  await sleep(500);
  await waitPageReady();
  const reloadGate = await evaluate(`(() => ({ gateOpen: !document.getElementById('authGate').hidden, locked: document.body.classList.contains('locked'), purged: localStorage.getItem('isabi_mfg_active_email') === null }))()`);
  reloadGate.gateOpen && reloadGate.locked && reloadGate.purged
    ? pass('authGate · legacy localStorage email purged & still requires login first')
    : fail('authGate legacy localStorage', JSON.stringify(reloadGate));

  // 1. Login (demo mode fills the PIN on tap)
  await evaluate(`(() => { const b = document.querySelector('[data-quick-seat="husseinbdeir@bhfirms.com"]'); b && b.click(); return 1; })()`);
  await sleep(600);
  const authed = await evaluate(`document.getElementById('authGate').hidden === true`);
  authed ? pass('login · owner seat via demo quick-seat') : fail('login', 'auth gate still visible');

  const errsBefore = events.filter(e => e.method === 'Runtime.exceptionThrown').length;
  const overflow = async label => {
    const o = await evaluate(`(() => {
      const de = document.documentElement;
      const sh = document.getElementById('appShell');
      const r = sh ? sh.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
      return {
        horiz: Math.max(0, de.scrollWidth - de.clientWidth),
        vertRoot: Math.max(0, de.scrollHeight - window.innerHeight),
        scrollY: Math.round(window.scrollY || de.scrollTop || 0),
        shellTop: Math.round(r.top),
        shellBottomGap: Math.abs(Math.round(r.bottom) - window.innerHeight)
      };
    })()`);
    (o.horiz === 0 && o.vertRoot <= 1 && o.scrollY === 0 && o.shellTop === 0 && o.shellBottomGap <= 1)
      ? pass(`overflow 0px · ${label}`)
      : fail(`overflow · ${label}`, `horiz=${o.horiz}px vertRoot=${o.vertRoot}px scrollY=${o.scrollY}px shellTop=${o.shellTop}px bottomGap=${o.shellBottomGap}px`);
  };

  // 2. Option A 10-Hub Left Sidebar Architecture + 28 Sub-Views + 1-to-1 Title & Overflow Parity
  await evaluate(`(() => {
    window.__navToView = function(v) {
      const H = window.MFG_HUBS;
      const hubId = (H && H.VIEW_TO_HUB && H.VIEW_TO_HUB[v]) || v;
      const hubBtn = document.querySelector('#sidebarNav .nav-item[data-hub="' + hubId + '"]');
      if (hubBtn && !hubBtn.hidden) hubBtn.click();
      if (v === 'reg_products') {
        const sub = document.querySelector('#hubSubtabBar [data-hub-subtab="reg_customers"]');
        if (sub && !sub.classList.contains('active')) sub.click();
        const pill = document.querySelector('[data-univ-reg-key="products"]');
        if (pill) pill.click();
        return 1;
      }
      if (v === 'reg_regions') {
        const sub = document.querySelector('#hubSubtabBar [data-hub-subtab="reg_sites"]');
        if (sub && !sub.classList.contains('active')) sub.click();
        const pill = document.querySelector('[data-univ-reg-key="regions"]');
        if (pill) pill.click();
        return 1;
      }
      if (v === 'reg_customers' || v === 'reg_sites' || v === 'reg_categories') {
        const sub = document.querySelector('#hubSubtabBar [data-hub-subtab="' + v + '"]');
        if (sub) sub.click();
        const defKey = v === 'reg_customers' ? 'customers' : (v === 'reg_sites' ? 'sites' : 'expense_categories');
        const pill = document.querySelector('[data-univ-reg-key="' + defKey + '"]');
        if (pill && !pill.classList.contains('active')) pill.click();
        return 1;
      }
      const subBtn = document.querySelector('#hubSubtabBar [data-hub-subtab="' + v + '"]');
      if (subBtn && !subBtn.classList.contains('active')) subBtn.click();
      else if (H && H.setView && location.hash !== '#' + v) H.setView(v);
      return 1;
    };
    return 1;
  })()`);

  const hubRailProbe = await evaluate(`(() => {
    const grps = Array.from(document.querySelectorAll('#sidebarNav .grp')).map(g => g.textContent.trim());
    const hubs = Array.from(document.querySelectorAll('#sidebarNav button.nav-item[data-hub]')).map(b => b.getAttribute('data-hub'));
    const cleanFooter = !document.querySelector('#sidebar #railShowcaseLink') && !document.querySelector('#sidebar .rail-status-row') && !document.querySelector('#sidebar #sqlStatusText') && !document.querySelector('#sidebar #railRlsScope') && Boolean(document.querySelector('.rail-footer .me'));
    const navEl = document.getElementById('sidebarNav');
    const railVertScrollPx = navEl ? Math.max(0, navEl.scrollHeight - navEl.clientHeight) : 999;
    return {
      ok: grps.join('|') === 'Executive|Plant & Dispatch|Treasury & Governance' &&
          hubs.join(',') === 'overview,sales,raw,fleet,kiosks,cashflow,expenses,payroll,ledger,users' &&
          cleanFooter &&
          (window.innerWidth <= 860 || railVertScrollPx <= 1),
      grps,
      hubs,
      cleanFooter,
      railVertScrollPx
    };
  })()`);
  hubRailProbe.ok
    ? pass('10-hub left sidebar architecture · 3 business-cycle groups, 10 parent hubs, clean user-only footer & 0px vertical rail scroll at 1366×768', `hubs=${hubRailProbe.hubs.length} · railScroll=${hubRailProbe.railVertScrollPx}px`)
    : fail('10-hub left sidebar architecture', JSON.stringify(hubRailProbe));

  const views = [
    'overview', 'entities', 'pbi', 'tables', 'sentinels', 'kiosks',
    'sales', 'customers', 'pricing', 'sales_vat', 'sales_analytics',
    'raw', 'suppliers', 'raw_analytics',
    'fleet', 'fleet_analytics',
    'cashflow',
    'expenses', 'expenses_analytics',
    'payroll', 'payroll_attendance', 'payroll_contracts', 'payroll_analytics',
    'ledger', 'ledger_treasury', 'statements', 'users'
  ];
  const titleMismatches = [];
  for (const v of views) {
    await evaluate(`window.__navToView('${v}')`);
    await sleep(260);
    const len = await evaluate(`document.getElementById('workspace').innerHTML.length`);
    len > 500 ? pass(`view ${v}`, `${len} chars`) : fail(`view ${v}`, 'empty workspace');
    const titleProbe = await evaluate(`(() => {
      const H = window.MFG_HUBS;
      const hubId = (H && H.VIEW_TO_HUB && H.VIEW_TO_HUB['${v}']) || 'overview';
      const expectedHubTitle = (H && H.HUB_TITLES && H.HUB_TITLES[hubId]) || '';
      const navBtn = document.querySelector('#sidebarNav .nav-item.on[data-hub="' + hubId + '"]');
      const navSpan = navBtn ? navBtn.querySelector('span') : null;
      const railLabel = navSpan ? navSpan.textContent.trim() : '';
      const navAriaLabel = navBtn ? (navBtn.getAttribute('aria-label') || '') : '';
      const hasNativeTitleAttr = Boolean((navBtn && navBtn.hasAttribute('title')) || (navSpan && navSpan.hasAttribute('title')));
      const subnavBtn = document.querySelector('#mobileSubnav [data-subnav-hub="' + hubId + '"].on span');
      const subnavLabel = subnavBtn ? subnavBtn.textContent.trim() : railLabel;
      const topbarTitle = (document.getElementById('topbarTitle') || {}).textContent?.trim() || '';
      const heroEl = document.querySelector('#workspace .cockpit-title, #workspace .pbi-studio-title, #workspace .rdl-suite-title');
      const heroTitle = heroEl ? heroEl.textContent.trim() : topbarTitle;
      const docTitlePrefix = (document.title || '').split(' · ')[0].trim();
      const subtabBar = document.getElementById('hubSubtabBar');
      const activeSubtabLbl = subtabBar ? (subtabBar.querySelector('.hub-subtab.active .hub-subtab-lbl')?.textContent?.trim() || '') : topbarTitle;
      const subtabCountOk = ('${v}' === 'kiosks' || '${v}' === 'cashflow') ? !subtabBar : Boolean(subtabBar && activeSubtabLbl === topbarTitle);
      const allMatch = Boolean(
        railLabel &&
        railLabel === expectedHubTitle &&
        railLabel === navAriaLabel &&
        railLabel === subnavLabel &&
        !hasNativeTitleAttr &&
        topbarTitle &&
        topbarTitle === heroTitle &&
        topbarTitle === docTitlePrefix &&
        subtabCountOk
      );
      return { allMatch, hubId, railLabel, expectedHubTitle, subnavLabel, topbarTitle, heroTitle, docTitlePrefix, activeSubtabLbl, hasNativeTitleAttr };
    })()`);
    if (!titleProbe.allMatch) titleMismatches.push(`${v}:${JSON.stringify(titleProbe)}`);
    await overflow(v);
    if (!MOBILE) {
      const tblFit = await evaluate(`(() => {
        const wraps = Array.from(document.querySelectorAll('#workspace .table-wrap'));
        const bad = wraps
          .filter(w => w.clientWidth > 0 && (w.scrollWidth - w.clientWidth) > 1)
          .map(w => ((w.closest('[id]') || {}).id || 'wrap') + ':' + (w.scrollWidth - w.clientWidth) + 'px');
        return { total: wraps.length, bad };
      })()`);
      if (tblFit.total > 0) {
        tblFit.bad.length === 0
          ? pass(`table-wrap fit · ${v}`, `${tblFit.total} table(s) 0px horizontal clip`)
          : fail(`table-wrap fit · ${v}`, tblFit.bad.join(', '));
      }
    }
  }
  titleMismatches.length === 0
    ? pass('page & hub titles · 1-to-1 identical across 10 Parent Hubs, Horizontal Sub-Tabs, Topbar, Page Hero, Mobile Subnav & Browser Tab (all 28 views)')
    : fail('page titles consistency', titleMismatches.join(' | '));

  // 2a-2. Left sidebar truncated (...) hover tooltip (#railHoverTooltip + title attributes)
  if (!MOBILE) {
    const railHoverProbe = await evaluate(`(() => {
      const sidebar = document.getElementById('sidebar');
      const narrowBtn = document.getElementById('railNarrowBtn');
      const resizer = document.getElementById('railResizer');
      const tipEl = document.getElementById('railHoverTooltip');
      // Narrow sidebar to minimum width (176px) so items truncate with ...
      for (let i = 0; i < 4; i++) narrowBtn.click();
      const navItems = Array.from(document.querySelectorAll('#sidebarNav button.nav-item'));
      const footerItems = Array.from(document.querySelectorAll('#railUserName, #activeRoleBadge, #railRlsScope, #sqlStatusText'));
      const noDuplicateNativeTitles = navItems.every(b => {
        const sp = b.querySelector('span');
        const txt = sp ? sp.textContent.trim() : '';
        return txt && b.getAttribute('aria-label') === txt && !b.hasAttribute('title') && (!sp || !sp.hasAttribute('title'));
      }) && footerItems.every(el => !el.hasAttribute('title'));
      const truncatedBtn = navItems.find(b => {
        const sp = b.querySelector('span');
        return sp && sp.scrollWidth > sp.clientWidth;
      });
      let hoverShown = false, hoverText = '', expectedText = '', tipRightOfRail = false;
      if (truncatedBtn) {
        const sp = truncatedBtn.querySelector('span');
        expectedText = sp.textContent.trim();
        sp.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        hoverShown = !!(tipEl && !tipEl.hidden);
        hoverText = tipEl ? tipEl.textContent.trim() : '';
        const tRect = tipEl.getBoundingClientRect();
        const sRect = sidebar.getBoundingClientRect();
        tipRightOfRail = tRect.left >= sRect.right;
      }
      sidebar.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
      const hiddenOnLeave = !!(tipEl && tipEl.hidden);
      // Reset sidebar width back to default
      resizer.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      return {
        ok: noDuplicateNativeTitles && !!truncatedBtn && hoverShown && hoverText === expectedText && tipRightOfRail && hiddenOnLeave,
        noDuplicateNativeTitles,
        hasTruncated: !!truncatedBtn,
        hoverShown,
        hoverText,
        expectedText,
        tipRightOfRail,
        hiddenOnLeave
      };
    })()`);
    railHoverProbe.ok
      ? pass('left sidebar hover tooltip · single styled tooltip on truncated (...) items (0 duplicate native browser tooltips)', `"${railHoverProbe.hoverText}"`)
      : fail('left sidebar hover tooltip', JSON.stringify(railHoverProbe));
  }

  // 2b. Operational & Financial module primary-ticket-first table order & toolbar parity (Sales, Raw, Fleet, Pricing, VAT & Credit, Customers, Suppliers, Expenses, Payroll, Ledger, Treasury)
  const moduleToolbarSpecs = [
    { view: 'sales', panel: '#salesPanel', modal: 'sales', secondPanel: '#salesProdPanel' },
    { view: 'raw', panel: '#rawPanel', modal: 'raw', secondPanel: '#rawSupPanel' },
    { view: 'fleet', panel: '#fuelPanel', modal: 'fuel', secondPanel: '#equipPanel' },
    { view: 'pricing', panel: '#pricingPanel', modal: 'pricerule', secondPanel: '#listPricePanel' },
    { view: 'sales_vat', panel: '#vatInvPanel', modal: 'vatinvoice', secondPanel: '#creditTermsPanel' },
    { view: 'customers', panel: '#rcptPanel', modal: 'receipt', secondPanel: '#custPanel' },
    { view: 'suppliers', panel: '#settlePanel', modal: 'settlement', secondPanel: '#supPanel' },
    { view: 'expenses', panel: '#expPanel', modal: 'expense', secondPanel: '#expCatPanel' },
    { view: 'payroll', panel: '#paySalPanel', modal: 'salary', secondPanel: '#payStaffRegPanel' },
    { view: 'ledger', panel: '#soaPanel', modal: 'treasury', secondPanel: '#glPanel' },
    { view: 'ledger_treasury', panel: '#treasuryLoansPanel', modal: 'treasury', secondPanel: '#treasuryExtPanel' }
  ];
  for (const spec of moduleToolbarSpecs) {
    await evaluate(`window.__navToView('${spec.view}')`);
    await sleep(220);
    const tb = await evaluate(`(() => {
      const panel = document.querySelector('${spec.panel}');
      if (!panel) return { ok: false, reason: 'missing panel' };
      const allPanels = Array.from(document.querySelectorAll('#workspace .panel-card'));
      const isFirstPanel = allPanels[0] === panel;
      const secondPanel = document.querySelector('${spec.secondPanel}');
      const secondAfterFirst = Boolean(secondPanel && allPanels.indexOf(secondPanel) === 1);
      const toolbar = panel.querySelector('.table-toolbar');
      if (!toolbar) return { ok: false, reason: 'missing .table-toolbar' };
      const search = panel.querySelector('#tableSearchInput');
      const chips = panel.querySelectorAll('.chip-bar .filter-chip').length;
      const csvBtn = panel.querySelector('[data-export-csv]') || document.querySelector('#workspace [data-export-csv]');
      const newBtn = panel.querySelector('.btn-primary[data-open-modal="${spec.modal}"]');
      const dupSearch = document.querySelectorAll('#tableSearchInput').length;
      const tbRect = toolbar.getBoundingClientRect();
      const newRect = newBtn ? newBtn.getBoundingClientRect() : null;
      const rightAligned = newRect ? (tbRect.right - newRect.right <= 200) : false;
      return {
        ok: Boolean(isFirstPanel && secondAfterFirst && search && chips >= 4 && csvBtn && newBtn && dupSearch === 1),
        isFirstPanel,
        secondAfterFirst,
        firstId: allPanels[0] ? allPanels[0].id : '',
        secondId: allPanels[1] ? allPanels[1].id : '',
        chips,
        dupSearch,
        btnText: newBtn ? newBtn.textContent.trim() : '',
        rightAligned
      };
    })()`);
    tb.ok && (MOBILE || tb.rightAligned)
      ? pass(`primary ticket table 1st & toolbar parity · ${spec.view}`, `1st=#${tb.firstId} → 2nd=#${tb.secondId} · ${tb.chips} chips + CSV + "${tb.btnText}"`)
      : fail(`primary ticket table 1st & toolbar parity · ${spec.view}`, JSON.stringify(tb));
  }

  // 3. Every PBI page + GL totals on P16 + pricing active-count on P05 + dynamic per-page slicers + header button contrast
  await evaluate(`window.__navToView('pbi')`);
  await sleep(300);
  // Check top header button contrast (fix for white square button on dark navy header)
  const hdrBtnContrast = await evaluate(`(() => {
    const btn = document.getElementById('pbiResetSlicersBtn');
    if (!btn) return null;
    const cs = getComputedStyle(btn);
    return { bg: cs.backgroundColor, color: cs.color };
  })()`);
  hdrBtnContrast && hdrBtnContrast.bg !== 'rgb(255, 255, 255)' ? pass('pbi · header buttons styled for dark header (no white square)', `${hdrBtnContrast.bg} / ${hdrBtnContrast.color}`) : fail('pbi header button contrast', JSON.stringify(hdrBtnContrast));

  const pages = await evaluate(`Array.from(document.querySelectorAll('[data-pbi-page]')).map(b => b.getAttribute('data-pbi-page'))`);
  pages.length === 12 ? pass('pbi · 12 analytical page tabs (+ 8 moved to sidebar modules)') : fail('pbi tabs', String(pages.length));
  for (const p of pages) {
    await evaluate(`document.querySelector('[data-pbi-page="${p}"]').click()`);
    await sleep(250);
    const len = await evaluate(`document.getElementById('pbiCanvasPanel').innerHTML.length`);
    len > 2000 ? pass(`pbi ${p}`) : fail(`pbi ${p}`, 'thin canvas');
  }
  // Check dynamic per-page slicers switch between P05, P06, P12
  await evaluate(`document.querySelector('[data-pbi-page="p05_pricing"]').click()`); await sleep(200);
  const p05Slicers = await evaluate(`Array.from(document.querySelectorAll('[data-pbi-slicer]')).map(s => s.getAttribute('data-pbi-slicer')).join(',')`);
  /ruleType/.test(p05Slicers) && /activeStatus/.test(p05Slicers) ? pass('pbi · P05 dynamic slicers', p05Slicers) : fail('pbi P05 dynamic slicers', p05Slicers);

  await evaluate(`document.querySelector('[data-pbi-page="p06_ar"]').click()`); await sleep(200);
  const p06Info = await evaluate(`(() => {
    const slicers = Array.from(document.querySelectorAll('[data-pbi-slicer]')).map(s => s.getAttribute('data-pbi-slicer')).join(',');
    const txt = document.getElementById('pbiCanvasPanel').innerText;
    const tables = document.querySelectorAll('#pbiCanvasPanel table').length;
    const bars = document.querySelectorAll('#pbiCanvasPanel .pbi-bar-fill').length;
    return { slicers, hasAging: /AR aging/i.test(txt) && /On account/i.test(txt), hasStatement: /Customer statement/i.test(txt), tables, bars };
  })()`);
  p06Info.hasAging && p06Info.hasStatement && p06Info.tables >= 3 && p06Info.bars > 5
    ? pass('pbi · P06 Customers & Receivables matches & exceeds Power Apps PBI', `${p06Info.tables} tables, ${p06Info.bars} inline data bars, slicers=${p06Info.slicers}`)
    : fail('pbi P06 parity', JSON.stringify(p06Info));

  await evaluate(`document.querySelector('[data-pbi-page="p12_payroll"]').click()`); await sleep(200);
  const p12Info = await evaluate(`(() => {
    const slicers = Array.from(document.querySelectorAll('[data-pbi-slicer]')).map(s => s.getAttribute('data-pbi-slicer')).join(',');
    const headings = Array.from(document.querySelectorAll('#pbiCanvasPanel .pbi-sec-heading')).map(h => h.textContent.trim().split('\\n')[0].trim());
    return { slicers, headings, kpis: document.querySelectorAll('#pbiCanvasPanel .pbi-kpi-card').length };
  })()`);
  p12Info.headings.length >= 3 && /contractStatus/.test(p12Info.slicers) && p12Info.kpis >= 18
    ? pass('pbi · P12 Payroll & Attendance 3 sections + dynamic slicers', `${p12Info.headings.join(' | ')} · ${p12Info.kpis} KPIs`)
    : fail('pbi P12 payroll', JSON.stringify(p12Info));

  await evaluate(`document.querySelector('[data-pbi-page="p16_financial"]').click()`); await sleep(250);
  const glText = await evaluate(`(() => { const t = Array.from(document.querySelectorAll('#pbiCanvasPanel table tbody tr.total td')).map(td => td.textContent.trim()); return t.join('|'); })()`);
  /TOTAL/.test(glText) && !/\$0\.00\|\$0\.00\|\$0\.00/.test(glText) ? pass('pbi P16 GL totals populated', glText.slice(0, 80)) : fail('pbi P16 GL totals', glText.slice(0, 120));
  await evaluate(`document.querySelector('[data-pbi-page="p07_ap"]').click()`); await sleep(250);
  const apNonZero = await evaluate(`Array.from(document.querySelectorAll('#pbiCanvasPanel table tbody tr')).slice(0, 5).some(tr => /\\$[1-9]/.test(tr.children[3] ? tr.children[3].textContent : ''))`);
  apNonZero ? pass('pbi P07 supplier legs populated') : fail('pbi P07 supplier legs', 'all $0');
  await evaluate(`document.querySelector('[data-pbi-page="p10_fleet"]').click()`); await sleep(250);
  const fleetNonZero = await evaluate(`Array.from(document.querySelectorAll('#pbiCanvasPanel table tbody tr')).slice(0, 10).some(tr => /\\$[1-9]/.test(tr.children[10] ? tr.children[10].textContent : ''))`);
  fleetNonZero ? pass('pbi P10 equipment total cost populated') : fail('pbi P10 equipment', 'all $0');
  // slicer round-trip
  await evaluate(`document.querySelector('[data-pbi-page="p04_sales"]').click()`); await sleep(250);
  await evaluate(`(() => { const s = document.querySelector('[data-pbi-slicer="saleType"]') || document.getElementById('pbiSlicerSaleType'); if (s) { s.value = 'Pickup'; s.dispatchEvent(new Event('change', { bubbles: true })); } return 1; })()`); await sleep(300);
  const slicerBadge = await evaluate(`!!document.querySelector('.pbi-studio-top .badge-warn')`);
  slicerBadge ? pass('pbi slicer badge shows active slicer') : fail('pbi slicer badge', 'missing');
  await evaluate(`document.getElementById('pbiResetSlicersBtn').click()`); await sleep(250);

  // 4. Tables hub: all 34 tables render without $1.00 booleans
  await evaluate(`window.__navToView('tables')`); await sleep(300);
  const tkeys = await evaluate(`Array.from(document.querySelectorAll('[data-table-key]')).map(b => b.getAttribute('data-table-key'))`);
  tkeys.length === 34 ? pass('tables · 34 chips') : fail('tables chips', String(tkeys.length));
  let boolMoney = 0, emptyTables = [];
  for (const k of tkeys) {
    await evaluate(`document.querySelector('[data-table-key="${k}"]').click()`); await sleep(120);
    const info = await evaluate(`(() => { const rows = document.querySelectorAll('#tablesHubPanel tbody tr.rrow'); const txt = document.getElementById('tablesHubPanel').innerText; return { rows: rows.length, bad: (txt.match(/\\$1\\.00\\b/g) || []).length, dash: (txt.match(/—/g) || []).length }; })()`);
    if (info.bad > 3) boolMoney += info.bad;
    if (!info.rows && !['freelance_entries', 'statements'].includes(k)) emptyTables.push(k);
  }
  boolMoney === 0 ? pass('tables · no boolean rendered as $1.00') : fail('tables boolean money', String(boolMoney));
  emptyTables.length === 0 ? pass('tables · every table has rows') : fail('tables empty', emptyTables.join(','));
  await evaluate(`document.querySelector('[data-table-key="loans"]').click()`); await sleep(150);
  const loanCell = await evaluate(`(() => { const tr = document.querySelector('#tablesHubPanel tbody tr.rrow'); return tr ? tr.innerText : ''; })()`);
  /\$\d/.test(loanCell) && !/^—/.test(loanCell) ? pass('tables · loans show principal + date', loanCell.replace(/\s+/g, ' ').slice(0, 70)) : fail('tables loans', loanCell.slice(0, 80));

  // 5. Record inspector on a register row + full-dataset tfoot totals (no "Show more" or "SHOWN OF")
  await evaluate(`window.__navToView('sales')`); await sleep(300);
  const salesTotalsProbe = await evaluate(`(() => {
    const showMoreBtns = document.querySelectorAll('[data-show-more], tr.show-more-row').length;
    const tfootTxt = (document.querySelector('#salesPanel tfoot tr') || {}).innerText || '';
    const hasShownWord = /SHOWN|SHOWING/i.test(tfootTxt);
    // Click Pickup filter chip and verify total updates only on filter change
    const pickupChip = document.querySelector('#salesPanel [data-chip="pickup"]');
    if (pickupChip) pickupChip.click();
    const filteredTxt = (document.querySelector('#salesPanel tfoot tr') || {}).innerText || '';
    const allChip = document.querySelector('#salesPanel [data-chip="all"]');
    if (allChip) allChip.click();
    const truckCell = document.querySelector('#salesPanel td.td-truck-drv');
    const truckColW = truckCell ? Math.round(truckCell.getBoundingClientRect().width) : 0;
    const bodyFontPx = truckCell ? parseFloat(getComputedStyle(truckCell).fontSize) : 0;
    const dateCell = document.querySelector('#salesPanel tbody tr td:first-child');
    const dateTxt = dateCell ? dateCell.textContent.trim() : '';
    const dmyDateOk = /^\\d{2}-\\d{2}-\\d{4}/.test(dateTxt) && (!dateCell || getComputedStyle(dateCell).whiteSpace === 'nowrap');
    const tfootTds = Array.from(document.querySelectorAll('#salesPanel tfoot tr td'));
    const tfootColSpanSum = tfootTds.reduce((a, td) => a + (Number(td.getAttribute('colspan')) || 1), 0);
    const tfootNoStackedLbls = document.querySelectorAll('#salesPanel tfoot .tfoot-col-lbl').length === 0;
    const tfootNumNoWrap = Array.from(document.querySelectorAll('#salesPanel tfoot tr td.r')).every(td => getComputedStyle(td).whiteSpace === 'nowrap' && td.clientHeight <= 38);
    const wrapEl = document.querySelector('#salesPanel .table-wrap');
    const wrapMaxH = wrapEl ? parseFloat(getComputedStyle(wrapEl).maxHeight) : 0;
    const tktCells = Array.from(document.querySelectorAll('#salesPanel tbody tr.rrow td:nth-child(2)'));
    const allTktNoWrap = tktCells.length > 0 && tktCells.every(td => {
      const sp = td.querySelector('.tkt-cell-inline');
      return getComputedStyle(td).whiteSpace === 'nowrap' && sp && sp.getBoundingClientRect().height <= 24;
    });
    const otCell = tktCells.find(td => td.querySelector('.tkt-ot-badge'));
    const nonOtCell = tktCells.find(td => !td.querySelector('.tkt-ot-badge'));
    let otSingleRowAligned = false;
    if (otCell && nonOtCell) {
      const otNumR = otCell.querySelector('.tkt-no-num').getBoundingClientRect();
      const otPrnR = otCell.querySelector('.tkt-print-mini').getBoundingClientRect();
      const otBdgR = otCell.querySelector('.tkt-ot-badge').getBoundingClientRect();
      const nonPrnR = nonOtCell.querySelector('.tkt-print-mini').getBoundingClientRect();
      otSingleRowAligned =
        Math.abs((otNumR.top + otNumR.height / 2) - (otPrnR.top + otPrnR.height / 2)) <= 3 &&
        Math.abs((otPrnR.top + otPrnR.height / 2) - (otBdgR.top + otBdgR.height / 2)) <= 3 &&
        Math.abs(otPrnR.left - nonPrnR.left) <= 2 &&
        otBdgR.left >= otPrnR.right - 1;
    }
    return {
      showMoreBtns,
      tfootTxt: tfootTxt.replace(/\\s+/g, ' ').trim(),
      hasShownWord,
      filteredTxt: filteredTxt.replace(/\\s+/g, ' ').trim(),
      truckColW,
      bodyFontPx,
      dateTxt,
      dmyDateOk,
      tfootColSpanSum,
      tfootNoStackedLbls,
      tfootNumNoWrap,
      wrapMaxH: Math.round(wrapMaxH || 0),
      allTktNoWrap,
      otSingleRowAligned
    };
  })()`);
  salesTotalsProbe.showMoreBtns === 0 && !salesTotalsProbe.hasShownWord && /2[56],\d\d\d LOADS/.test(salesTotalsProbe.tfootTxt) && salesTotalsProbe.filteredTxt !== salesTotalsProbe.tfootTxt && salesTotalsProbe.dmyDateOk && salesTotalsProbe.tfootColSpanSum === 15 && salesTotalsProbe.tfootNoStackedLbls && salesTotalsProbe.tfootNumNoWrap && salesTotalsProbe.allTktNoWrap && salesTotalsProbe.otSingleRowAligned && (MOBILE || (salesTotalsProbe.truckColW <= 110 && salesTotalsProbe.bodyFontPx >= 11.4 && salesTotalsProbe.wrapMaxH >= 300))
    ? pass('sales tfoot, single-line Ticket # (OT aligned), DD-MM-YYYY date & taller table-wrap · 15-col aligned tfoot, single-line totals & OT badges', `date=${salesTotalsProbe.dateTxt} · otSingleRow=${salesTotalsProbe.otSingleRowAligned} · wrapMaxH=${salesTotalsProbe.wrapMaxH}px · truckW=${salesTotalsProbe.truckColW}px · font=${salesTotalsProbe.bodyFontPx}px · ${salesTotalsProbe.tfootTxt}`)
    : fail('sales tfoot totals / DD-MM-YYYY / typography', JSON.stringify(salesTotalsProbe));
  await evaluate(`document.querySelector('tr.rrow[data-rid]').click()`); await sleep(220);
  const insp = await evaluate(`(() => {
    const p = document.getElementById('recordInspector');
    if (!p || p.hidden) return { ok: false };
    const cells = document.querySelectorAll('#inspectorBody .inspector-cell').length;
    const hasBanner = !!document.getElementById('inspLiveBanner');
    const cockpitCards = document.querySelectorAll('#inspCockpit .pa-rec-kcard').length;
    const qvCards = document.querySelectorAll('#inspectorBody .pa-qv-card').length;
    const sections = document.querySelectorAll('#inspectorBody .pa-form-section').length;
    const subgrids = document.querySelectorAll('#inspectorBody .pa-subgrid-box').length;
    const relLinks = document.querySelectorAll('#inspectorBody [data-rel-key]');
    // Click the first lookup pill inside the form to drill into the related record and verify breadcrumb trail
    if (relLinks.length) relLinks[0].click();
    const crumbsAfterDrill = document.querySelectorAll('#inspectorBody [data-crumb-idx]').length;
    const backBtn = document.getElementById('inspBackBtn');
    if (backBtn) backBtn.click();
    const crumbsAfterBack = document.querySelectorAll('#inspectorBody [data-crumb-idx]').length;
    return { ok: true, cells, hasBanner, cockpitCards, qvCards, sections, subgrids, crumbsAfterDrill, crumbsAfterBack };
  })()`);
  insp.ok && insp.cells > 8 && insp.hasBanner && insp.cockpitCards === 4 && insp.qvCards >= 2 && insp.sections >= 2 && insp.subgrids >= 3 && insp.crumbsAfterDrill === 2 && insp.crumbsAfterBack === 1
    ? pass('Power Apps 360° Record Form · Live Banner + 4-Card Cockpit + Quick Views + Related Subgrids + Breadcrumb Drill', `${insp.cells} fields, ${insp.cockpitCards} KPI cards, ${insp.qvCards} quick-views, ${insp.subgrids} related subgrids`)
    : fail('Power Apps Record Form', JSON.stringify(insp));
  await evaluate(`document.getElementById('inspectorDoneBtn').click()`); await sleep(100);

  // 6. Entry desk: 24 forms open; switching groups/tabs (especially Group 4 Payroll) never scrolls the modal card downward; sales tier adjustment is per load; expense subcategory cascade
  await evaluate(`document.getElementById('newEntryBtn').click()`); await sleep(300);
  const groupScrollShifts = [];
  for (const gid of ['dispatch', 'pricing', 'hq', 'ops']) {
    await evaluate(`document.querySelector('[data-pa-group="${gid}"]').click()`);
    await sleep(110);
    const sc = await evaluate(`(() => { const c = document.querySelector('#entryModal .modal-card'); const b = document.getElementById('modalBody'); return { card: c ? c.scrollTop : 0, body: b ? b.scrollTop : 0, win: window.scrollY }; })()`);
    if (sc.card !== 0 || sc.body !== 0 || sc.win !== 0) groupScrollShifts.push(`${gid}:${JSON.stringify(sc)}`);
  }
  groupScrollShifts.length === 0 ? pass('entry desk · group tabs 1–4 keep scrollTop at 0px (no downward push on Group 4 Payroll)') : fail('entry desk group scroll', groupScrollShifts.join(', '));
  const forms = ['sales', 'raw', 'receipt', 'settlement', 'fuel', 'expense', 'pricerule', 'vatinvoice', 'creditterm', 'customer', 'supplier', 'product', 'site', 'equipment', 'companyequipment', 'driver', 'salary', 'attendance', 'freelance', 'employment', 'logistics', 'triprate', 'treasury', 'jv'];
  let opened = 0, formScrollShifts = [], cockpitLeaks = [];
  for (const f of forms) {
    const ok = await evaluate(`(() => { const groups = window.MFG_FORMS.FORM_GROUPS; const g = groups.find(x => x.forms.some(y => y.id === '${f}')); document.querySelector('[data-pa-group="' + g.id + '"]').click(); const t = document.querySelector('.modal-tab[data-form="${f}"]'); if (!t) return false; t.click(); return document.getElementById('modalBody').querySelectorAll('input, select').length > 3; })()`);
    if (ok) opened++; else fail(`form ${f}`, 'did not render inputs');
    await sleep(80);
    const sc = await evaluate(`(() => { const c = document.querySelector('#entryModal .modal-card'); const b = document.getElementById('modalBody'); const hasPa = !!(document.getElementById('paCockpit') || document.getElementById('paLiveBanner')); return { scroll: (c ? c.scrollTop : 0) + (b ? b.scrollTop : 0), hasPa }; })()`);
    if (sc.scroll !== 0) formScrollShifts.push(`${f}:${sc.scroll}px`);
    if (sc.hasPa) cockpitLeaks.push(f);
  }
  opened === 24 ? pass('entry desk · 24 forms render') : fail('entry desk forms', `${opened}/24`);
  formScrollShifts.length === 0 ? pass('entry desk · all 24 forms keep scrollTop at 0px after 80ms') : fail('entry desk form scroll', formScrollShifts.join(', '));
  cockpitLeaks.length === 0 ? pass('entry desk · no Power Apps Executive Cockpit or Power Apps form rules banner on new entries') : fail('entry desk cockpit/banner leak', cockpitLeaks.join(', '));

  // sales tier test: find a tiered Sales (Pickup) rule with an active window and a truck of that capacity
  const tierProbe = await evaluate(`(() => {
    const S = window.MFG_SEED; const today = S.generated_at.slice(0, 10);
    const rule = S.records.price_rules.find(r => r.qty1 != null && r.customer && /Sales/.test(r.rule_type || '') && (!r.end_date || r.end_date >= today) && r.start_date <= today);
    if (!rule) return { skip: 'no live tiered rule' };
    const truck = S.records.equipment.find(e => Number(e.capacity) === Number(rule.qty1));
    if (!truck) return { skip: 'no truck with capacity ' + rule.qty1 };
    document.querySelector('[data-pa-group="dispatch"]').click(); document.querySelector('.modal-tab[data-form="sales"]').click();
    const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
    set('f_company', rule.company); set('f_saletype', /Pickup/.test(rule.rule_type) ? 'Pickup' : 'Delivery'); set('f_customer', rule.customer); set('f_product', rule.product); if (rule.site) set('f_site', rule.site); set('f_truck', truck.name);
    const qty = Number(document.getElementById('f_qty').value), up = Number(document.getElementById('f_unitprice').value);
    const mat = document.getElementById('calc_mat').textContent;
    return { rule: rule.name, qty1: rule.qty1, adj1: rule.adj1, unit: rule.unit_price, qty, up, mat, expected: Math.round((qty * Number(rule.unit_price) + Number(rule.adj1 || 0)) * 100) / 100 };
  })()`);
  if (tierProbe.skip) pass('sales tier · skipped', tierProbe.skip);
  else {
    const shown = Number(String(tierProbe.mat).replace(/[^0-9.\-]/g, '').split('(')[0]);
    const matNum = Number((String(tierProbe.mat).match(/\$([0-9,]+\.\d{2})/) || [0, '0'])[1].replace(/,/g, ''));
    Math.abs(matNum - tierProbe.expected) < 0.011 && Math.abs(tierProbe.up - tierProbe.unit) < 0.011
      ? pass('sales tier · per-load adjustment', `${tierProbe.rule}: qty ${tierProbe.qty} × $${tierProbe.unit} + ${tierProbe.adj1} = ${tierProbe.mat}`)
      : fail('sales tier', `shown ${tierProbe.mat} vs expected ${tierProbe.expected} (unit price ${tierProbe.up} vs ${tierProbe.unit})`);
  }
  // expense cascade
  const casc = await evaluate(`(() => {
    document.querySelector('[data-pa-group="dispatch"]').click(); document.querySelector('.modal-tab[data-form="expense"]').click();
    const cat = document.getElementById('f_category'); const all = document.getElementById('dl_subcats').options.length;
    const withSubs = Array.from(cat.options).map(o => o.value).filter(Boolean);
    let pick = null; for (const c of withSubs) { cat.value = c; cat.dispatchEvent(new Event('change', { bubbles: true })); const n = document.getElementById('dl_subcats').options.length; if (n < all) { pick = { c, n, all }; break; } }
    return pick || { all };
  })()`);
  casc.c ? pass('expense subcategory cascade', `${casc.c}: ${casc.n} of ${casc.all}`) : fail('expense cascade', 'datalist never narrows');
  // Enter-key listener bound once
  const wired = await evaluate(`document.getElementById('modalBody').dataset.enterWired`);
  wired === '1' ? pass('modal Enter listener bound once') : fail('modal Enter', String(wired));

  // Blank ticket number on New Entry + per-table duplicate ticket isolation + custom Rev 10 suggestion popover (no native [list] or scrollbar)
  const ticketAndSuggestProbe = await evaluate(`(() => {
    document.querySelector('[data-pa-group="dispatch"]').click();
    document.querySelector('.modal-tab[data-form="sales"]').click();
    const salesBlankOnOpen = document.getElementById('f_ticketno').value === '';
    const salesHintOnOpen = (document.getElementById('hint_ticket') || {}).textContent || '';
    // Switching company must NOT auto-fill a ticket number
    const coEl = document.getElementById('f_company');
    coEl.value = 'BBConstruction';
    coEl.dispatchEvent(new Event('change', { bubbles: true }));
    const salesBlankAfterCoChange = document.getElementById('f_ticketno').value === '';
    coEl.value = 'WTC';
    coEl.dispatchEvent(new Event('change', { bubbles: true }));

    // Duplicate ticket 3-band date rule (2026-10-22):
    // 1) Same day / day before (<=1d): red 'crit' ("Not accepted"), wrap_dupok hidden
    // 2) 2..30 days (up to a month before): yellow 'warn' ("days ago — accepted"), wrap_dupok hidden
    // 3) >30 days (more than a month before) or another table: no warning needed ('')
    const dEl = document.getElementById('f_date');
    const tEl = document.getElementById('f_ticketno');
    dEl.value = '2026-10-21';
    dEl.dispatchEvent(new Event('change', { bubbles: true }));
    tEl.value = '19805'; // exists in WTC sales_tickets dated 2026-10-21
    tEl.dispatchEvent(new Event('input', { bubbles: true }));
    const salesSameDayHint = (document.getElementById('hint_ticket') || {}).textContent || '';
    const salesSameDayCls = (document.getElementById('hint_ticket') || {}).className || '';
    const salesSameDayWrapHidden = document.getElementById('wrap_dupok').hidden === true;

    dEl.value = '2026-10-22'; // 1 day after 2026-10-21 (day before -> still blocked)
    dEl.dispatchEvent(new Event('change', { bubbles: true }));
    const salesDayBeforeHint = (document.getElementById('hint_ticket') || {}).textContent || '';
    const salesDayBeforeCls = (document.getElementById('hint_ticket') || {}).className || '';

    // Pick a ticket dated ~10-15 days before 2026-10-21 (e.g. 2026-10-08 in WTC sales_tickets)
    const midRow = (window.MFG_SEED.records.sales_tickets || []).find(r => r && !r.voided && r.company === 'WTC' && r.ticket_no && String(r.date).slice(0, 10) === '2026-10-08');
    dEl.value = '2026-10-21';
    dEl.dispatchEvent(new Event('change', { bubbles: true }));
    tEl.value = midRow ? String(midRow.ticket_no) : '19805';
    tEl.dispatchEvent(new Event('input', { bubbles: true }));
    const salesWithinMonthHint = (document.getElementById('hint_ticket') || {}).textContent || '';
    const salesWithinMonthCls = (document.getElementById('hint_ticket') || {}).className || '';

    // Ticket 19950 exists in WTC raw_purchases (2026-02-28, > 30 days ago) and not in sales_tickets -> no warning
    tEl.value = '19950';
    tEl.dispatchEvent(new Event('input', { bubbles: true }));
    const sales19950Hint = (document.getElementById('hint_ticket') || {}).textContent || '';
    const sales19950DupWrapHidden = document.getElementById('wrap_dupok').hidden === true;

    // Custom suggestion popover on f_product (searchable combobox with UoM/ton-factor metadata badges) & f_truck
    const nativeListCount = document.querySelectorAll('#modalBody input[list]').length;
    const unwiredSelectCount = document.querySelectorAll('#modalBody select:not([data-select-wired="1"])').length;
    const suggestWrapCount = document.querySelectorAll('#modalBody .pa-suggest-wrap').length;

    const prodEl = document.getElementById('f_product');
    const prodIsInputCombobox = prodEl && prodEl.tagName === 'INPUT' && prodEl.dataset.suggestList === 'dl_sales_prods' && !!prodEl.closest('.pa-suggest-wrap');
    prodEl.value = '';
    prodEl.click();
    const prodMenu = prodEl.closest('.pa-suggest-wrap').querySelector('.pa-suggest-menu');
    const prodMenuOpen = prodMenu && !prodMenu.hidden;
    const prodMetaBadges = prodMenu ? prodMenu.querySelectorAll('.pa-suggest-meta').length : 0;
    const firstProdItem = prodMenu ? prodMenu.querySelector('.pa-suggest-item') : null;
    if (firstProdItem) firstProdItem.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    const pickedProd = prodEl.value;
    const prodClosedAfterPick = prodMenu ? prodMenu.hidden === true : false;
    // Clicking an already-selected grade must re-open the full list with .is-selected highlighted
    prodEl.click();
    const prodReopensWhenFilled = prodMenu && !prodMenu.hidden && prodMenu.querySelectorAll('.pa-suggest-item').length > 1 && !!prodMenu.querySelector('.pa-suggest-item.is-selected');
    prodMenu.hidden = true;

    // Sales form on Delivery + Company fleet filters f_truck strictly to the selected company's own fleet trucks
    const stEl = document.getElementById('f_saletype');
    stEl.value = 'Delivery';
    stEl.dispatchEvent(new Event('change', { bubbles: true }));
    const trk = document.getElementById('f_truck');
    trk.value = 'TB';
    trk.dispatchEvent(new Event('input', { bubbles: true }));
    const menu = trk.closest('.pa-suggest-wrap').querySelector('.pa-suggest-menu');
    const menuOpen = menu && !menu.hidden;
    const menuItems = menu ? menu.querySelectorAll('.pa-suggest-item').length : 0;
    const menuOverflowY = menu ? getComputedStyle(menu).overflowY : '';
    const firstItem = menu ? menu.querySelector('.pa-suggest-item') : null;
    if (firstItem) firstItem.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    const pickedTruck = trk.value;
    const menuClosedAfterPick = menu ? menu.hidden === true : false;
    trk.value = '';
    stEl.value = 'Pickup';
    stEl.dispatchEvent(new Event('change', { bubbles: true }));

    // Now switch to Raw Quarry Purchase form: 1) f_ticketno starts blank; 2) 19950 (2026-02-28) is >30d before 2026-10-22 so no warning; 3) setting date to 2026-03-01 (1d after 2026-02-28) blocks it; 4) setting date to 2026-03-15 (15d after) shows yellow warn
    document.querySelector('.modal-tab[data-form="raw"]').click();
    const rawBlankOnOpen = document.getElementById('f_ticketno').value === '';
    const rawCo = document.getElementById('f_company');
    rawCo.value = 'WTC';
    rawCo.dispatchEvent(new Event('change', { bubbles: true }));
    const rawD = document.getElementById('f_date');
    const rawT = document.getElementById('f_ticketno');
    rawD.value = '2026-10-22';
    rawD.dispatchEvent(new Event('change', { bubbles: true }));
    rawT.value = '19950';
    rawT.dispatchEvent(new Event('input', { bubbles: true }));
    const rawOverMonthHint = (document.getElementById('hint_ticket') || {}).textContent || '';
    const rawOverMonthCls = (document.getElementById('hint_ticket') || {}).className || '';
    rawD.value = '2026-03-15';
    rawD.dispatchEvent(new Event('change', { bubbles: true }));
    const rawWithinMonthHint = (document.getElementById('hint_ticket') || {}).textContent || '';
    const rawWithinMonthCls = (document.getElementById('hint_ticket') || {}).className || '';
    rawD.value = '2026-03-01';
    rawD.dispatchEvent(new Event('change', { bubbles: true }));
    const rawDayBeforeHint = (document.getElementById('hint_ticket') || {}).textContent || '';
    const rawDayBeforeCls = (document.getElementById('hint_ticket') || {}).className || '';
    rawD.value = '2026-10-23';
    rawD.dispatchEvent(new Event('change', { bubbles: true }));
    rawT.value = '19119';
    rawT.dispatchEvent(new Event('input', { bubbles: true }));
    const raw19119Hint = (document.getElementById('hint_ticket') || {}).textContent || '';
    const raw19119Cls = (document.getElementById('hint_ticket') || {}).className || '';
    const rawDupWrapHidden = document.getElementById('wrap_dupok').hidden === true;
    const rawProdEl = document.getElementById('f_product');
    if (rawProdEl) { rawProdEl.value = ''; rawProdEl.click(); }
    const rawProdMenu = rawProdEl ? rawProdEl.closest('.pa-suggest-wrap')?.querySelector('.pa-suggest-menu') : null;
    const rawTopProd = rawProdMenu?.querySelector('.pa-suggest-item .pa-suggest-label')?.textContent?.trim() || '';
    if (rawProdMenu) rawProdMenu.hidden = true;
    const rawTopSite = (document.querySelector('#dl_sites option') || {}).value || '';
    const rawTopOwner = (document.querySelector('#dl_suppliers option') || {}).value || '';

    return {
      salesBlankOnOpen,
      salesHintOnOpen,
      salesBlankAfterCoChange,
      salesSameDayHint,
      salesSameDayCls,
      salesSameDayWrapHidden,
      salesDayBeforeHint,
      salesDayBeforeCls,
      salesWithinMonthHint,
      salesWithinMonthCls,
      sales19950Hint,
      sales19950DupWrapHidden,
      nativeListCount,
      unwiredSelectCount,
      suggestWrapCount,
      prodIsInputCombobox,
      prodMenuOpen,
      prodMetaBadges,
      pickedProd,
      prodClosedAfterPick,
      prodReopensWhenFilled,
      menuOpen,
      menuItems,
      menuOverflowY,
      pickedTruck,
      menuClosedAfterPick,
      rawBlankOnOpen,
      rawOverMonthHint,
      rawOverMonthCls,
      rawWithinMonthHint,
      rawWithinMonthCls,
      rawDayBeforeHint,
      rawDayBeforeCls,
      raw19119Hint,
      raw19119Cls,
      rawDupWrapHidden,
      rawTopProd,
      rawTopSite,
      rawTopOwner
    };
  })()`);
  ticketAndSuggestProbe.salesBlankOnOpen && ticketAndSuggestProbe.rawBlankOnOpen && ticketAndSuggestProbe.salesBlankAfterCoChange && ticketAndSuggestProbe.salesHintOnOpen === ''
    ? pass('entry desk · Ticket Number starts blank on New Entry & stays blank on company switch')
    : fail('entry desk blank ticket number', JSON.stringify(ticketAndSuggestProbe));
  /Not accepted/i.test(ticketAndSuggestProbe.salesSameDayHint) && /\bcrit\b/.test(ticketAndSuggestProbe.salesSameDayCls) && ticketAndSuggestProbe.salesSameDayWrapHidden &&
  /Not accepted/i.test(ticketAndSuggestProbe.salesDayBeforeHint) && /\bcrit\b/.test(ticketAndSuggestProbe.salesDayBeforeCls) &&
  /days ago — accepted/i.test(ticketAndSuggestProbe.salesWithinMonthHint) && /\bwarn\b/.test(ticketAndSuggestProbe.salesWithinMonthCls) &&
  ticketAndSuggestProbe.sales19950Hint === '' && ticketAndSuggestProbe.sales19950DupWrapHidden &&
  ticketAndSuggestProbe.rawOverMonthHint === '' && !/\b(warn|crit)\b/.test(ticketAndSuggestProbe.rawOverMonthCls) &&
  /days ago — accepted/i.test(ticketAndSuggestProbe.rawWithinMonthHint) && /\bwarn\b/.test(ticketAndSuggestProbe.rawWithinMonthCls) &&
  /Not accepted/i.test(ticketAndSuggestProbe.rawDayBeforeHint) && /\bcrit\b/.test(ticketAndSuggestProbe.rawDayBeforeCls) &&
  /dated 2026-10-20.*3 days ago — accepted/i.test(ticketAndSuggestProbe.raw19119Hint) && /\bwarn\b/.test(ticketAndSuggestProbe.raw19119Cls) && ticketAndSuggestProbe.rawDupWrapHidden
    ? pass('entry desk · 3-band duplicate ticket guard (<=1d blocked red · 2–30d yellow warning · >30d no warning · Raw #19119 rep_date 3d warn)', `${ticketAndSuggestProbe.salesSameDayHint} | ${ticketAndSuggestProbe.raw19119Hint}`)
    : fail('entry desk 3-band duplicate ticket guard', JSON.stringify(ticketAndSuggestProbe));
  ticketAndSuggestProbe.nativeListCount === 0 && ticketAndSuggestProbe.unwiredSelectCount === 0 && ticketAndSuggestProbe.suggestWrapCount >= 10 && ticketAndSuggestProbe.prodIsInputCombobox && ticketAndSuggestProbe.prodMenuOpen && ticketAndSuggestProbe.prodMetaBadges > 0 && ticketAndSuggestProbe.pickedProd === 'Mghasal' && ticketAndSuggestProbe.rawTopProd === 'Ramel Mrml' && ticketAndSuggestProbe.rawTopSite === 'spinneys Mar Elias' && ticketAndSuggestProbe.rawTopOwner === 'Dabousi' && ticketAndSuggestProbe.prodClosedAfterPick && ticketAndSuggestProbe.prodReopensWhenFilled && ticketAndSuggestProbe.menuOpen && ticketAndSuggestProbe.menuItems > 0 && ticketAndSuggestProbe.menuItems <= 7 && ticketAndSuggestProbe.menuOverflowY === 'hidden' && /^TB/i.test(ticketAndSuggestProbe.pickedTruck) && ticketAndSuggestProbe.menuClosedAfterPick
    ? pass('entry desk · Rev 10 frequency-ranked combobox & select popover (Raw #1="Ramel Mrml", Sales #1="Mghasal", 0 native popups, 0 scrollbars)', `raw#1="${ticketAndSuggestProbe.rawTopProd}" (site="${ticketAndSuggestProbe.rawTopSite}", owner="${ticketAndSuggestProbe.rawTopOwner}") · sales#1="${ticketAndSuggestProbe.pickedProd}" · truck=${ticketAndSuggestProbe.pickedTruck}`)
    : fail('entry desk custom suggestion popover', JSON.stringify(ticketAndSuggestProbe));

  // 6c. Intuitive Ticket Entry v7.0: Ordering, Conditional Column Hiding, Reporting Date & Policy Lock + Admin Unlock Process
  const intuitiveEntryProbe = await evaluate(`(() => {
    document.querySelector('.modal-tab[data-form="sales"]').click();
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    // (1) Check canonical ordering: Company (BU) -> Transaction Date -> Reporting Date -> Dispatch Time -> Sale Type -> Transported By -> Ticket # -> Product -> Customer -> Site -> Truck -> Driver -> Method -> Qty -> Unit -> Unit Price -> Totals
    const orderedIds = Array.from(document.querySelectorAll('#modalBody input[id], #modalBody select[id]')).map(e => e.id);
    const idx = id => orderedIds.indexOf(id);
    const orderingOk =
      idx('f_company') < idx('f_date') &&
      idx('f_date') < idx('f_repdate') &&
      idx('f_repdate') < idx('f_time') &&
      idx('f_time') < idx('f_saletype') &&
      idx('f_saletype') < idx('f_transportby') &&
      idx('f_transportby') < idx('f_ticketno') &&
      idx('f_ticketno') < idx('f_product') &&
      idx('f_product') < idx('f_customer') &&
      idx('f_customer') < idx('f_site') &&
      idx('f_site') < idx('f_truck') &&
      idx('f_truck') < idx('f_truckowner') &&
      idx('f_truckowner') < idx('f_driver') &&
      idx('f_driver') < idx('f_method') &&
      idx('f_method') < idx('f_qty') &&
      idx('f_qty') < idx('f_uom') &&
      idx('f_uom') < idx('f_unitprice') &&
      idx('f_unitprice') < idx('f_mat_total');

    // (2) Check Sale Type default = Pickup (1st Pick-up, 2nd Delivery, 3rd Unregistered) & conditional column visibility
    const stSelect = document.getElementById('f_saletype');
    const saleTypeDefaultIsPickup = stSelect && stSelect.value === 'Pickup';
    const saleTypeOptVals = stSelect ? Array.from(stSelect.options).map(o => o.value).join(',') : '';
    const saleTypeOptLabels = stSelect ? Array.from(stSelect.options).map(o => o.textContent.trim()).join('|') : '';
    const methSelect = document.getElementById('f_method');
    const methOptLabels = methSelect ? Array.from(methSelect.options).map(o => o.textContent.trim()).join('|') : '';
    const saleTypeOrderOk = saleTypeDefaultIsPickup && saleTypeOptVals === 'Pickup,Delivery,Unregistered' && saleTypeOptLabels === 'Pick-up (Material Only)|Delivery (Material + Transport)|Unregistered (Spot Cash)' && methOptLabels === 'Credit|Cash';
    const pickupSiteHidden = document.getElementById('wrap_f_site').hidden === true;
    const pickupTransByHidden = document.getElementById('wrap_f_transportby').hidden === true;
    const pickupOvertimeHidden = document.getElementById('wrap_f_overtime').hidden === true;
    const pickupTransPriceHidden = document.getElementById('wrap_f_transunitprice').hidden === true;
    const pickupTransTotHidden = document.getElementById('wrap_f_trans_total').hidden === true;
    const pickupTruckOwnerVisible = document.getElementById('wrap_f_truckowner').hidden === false;
    const stWrap = document.getElementById('wrap_f_saletype');
    const stRectPickup = stWrap ? stWrap.getBoundingClientRect() : { left: 0, top: 0 };
    const otInsideTimeField = !!document.querySelector('#wrap_f_time #wrap_f_overtime #toggleOvertimeBtn');
    set('f_saletype', 'Delivery');
    const stRectDeliv = stWrap ? stWrap.getBoundingClientRect() : { left: 99, top: 99 };
    const saleTypeRowStable = otInsideTimeField && Math.abs(stRectPickup.left - stRectDeliv.left) < 1 && Math.abs(stRectPickup.top - stRectDeliv.top) < 1;
    set('f_time', '04:25');
    const otAutoOnAtNight = document.getElementById('f_overtime')?.checked === true && /Overtime Registered/i.test(document.getElementById('toggleOvertimeBtn')?.textContent || '');
    document.getElementById('toggleOvertimeBtn')?.click();
    const otManualCleared = document.getElementById('f_overtime')?.checked === false && /No Overtime/i.test(document.getElementById('toggleOvertimeBtn')?.textContent || '');
    set('f_time', '10:30');
    const otAutoDayShift = document.getElementById('f_overtime')?.checked === false && /Day Shift/i.test(document.getElementById('toggleOvertimeBtn')?.textContent || '');
    const overtimeLinkedToTimeOk = saleTypeRowStable && otAutoOnAtNight && otManualCleared && otAutoDayShift;
    const delivSiteVisible = !document.getElementById('wrap_f_site').hidden;
    const delivTransVisible = !document.getElementById('wrap_f_transunitprice').hidden;
    const delivOwnerHiddenOnCoFleet = document.getElementById('wrap_f_truckowner').hidden;
    set('f_saletype', 'Pickup');

    // (3) Check Policy-Locked Transaction Date (f_date) + On-Demand Collapsible Reporting Date (f_repdate)
    const dEl = document.getElementById('f_date');
    const dWrap = document.getElementById('wrap_f_date');
    const repEl = document.getElementById('f_repdate');
    const repWrap = document.getElementById('wrap_f_repdate');
    const toggleRepBtn = document.getElementById('toggleRepDateBtn');
    const resetRepBtn = document.getElementById('resetRepDateBtn');
    const dateStartsLocked = dEl && dEl.readOnly === true && dWrap && dWrap.classList.contains('is-policy-locked');
    const repStartsHiddenAndSynced = repWrap && repWrap.hidden === true && repEl.value === dEl.value && toggleRepBtn && !toggleRepBtn.hidden;
    if (toggleRepBtn) toggleRepBtn.click();
    const repRevealedOnClick = repWrap && repWrap.hidden === false;
    set('f_repdate', '2026-06-12');
    const repKeptWhenDifferent = repWrap && repWrap.hidden === false && repEl.value === '2026-06-12';
    if (resetRepBtn) resetRepBtn.click();
    const repResetAndCollapsed = repWrap && repWrap.hidden === true && repEl.value === dEl.value;
    const repSynced = dateStartsLocked && repStartsHiddenAndSynced && repRevealedOnClick && repKeptWhenDifferent && repResetAndCollapsed;

    // Verify zero (m66) / (mNN) / bhf_* internal strings in modal UI
    const modalText = (document.getElementById('modalBody')?.textContent || '') + ' ' + (document.getElementById('paModalSubtabs')?.textContent || '');
    const noInternalCodes = !/\\(m\\d+/i.test(modalText) && !/\\bbhf_[a-z]/i.test(modalText);

    // (4) Check Policy-Locked state + Admin Privilege Unlock Process (no redundant "Policy Lock Guard" box)
    const upEl = document.getElementById('f_unitprice');
    const upWrap = document.getElementById('wrap_f_unitprice');
    const upPill = document.querySelector('[data-lock-pill="f_unitprice"]');
    const adminBar = document.getElementById('paAdminLockBar');
    const noRedundantPolicyGuardBox = !adminBar || adminBar.hidden === true || getComputedStyle(adminBar).display === 'none';
    const startsLocked = upEl.readOnly === true && upWrap.classList.contains('is-policy-locked') && /LOCKED/i.test(upPill.textContent) && noRedundantPolicyGuardBox;

    // Click the lock pill on Unit Price to open the Admin Privilege Unlock Process
    upPill.click();
    const unlockBox = document.getElementById('paAdminUnlockBox');
    const boxOpened = unlockBox && !unlockBox.hidden && /Admin Privilege Unlock Process/i.test(unlockBox.textContent);
    const confirmBtn = document.getElementById('paConfirmFieldUnlockBtn');
    if (confirmBtn) confirmBtn.click();
    const unlockedNow = upEl.readOnly === false && upWrap.classList.contains('is-admin-unlocked') && /ADMIN OVERRIDE/i.test(upPill.textContent);
    set('f_unitprice', '19.75');
    const manualPriceKept = document.getElementById('f_unitprice').value === '19.75';

    // Click pill again to re-lock
    upPill.click();
    const relockedNow = upEl.readOnly === true && upWrap.classList.contains('is-policy-locked');

    // (5) Check Pick-up hides & clears Driver; Company fleet filters Truck strictly to the selected Company's own fleet trucks, and Driver is strictly policy-locked to the Equipment Log's single active driver
    const truckLabelIsTruckOnly = (document.querySelector('#wrap_f_truck .pa-fld-lbl')?.textContent || '').trim() === 'Truck *';
    set('f_company', 'WTC');
    set('f_saletype', 'Delivery');
    set('f_transportby', 'Company fleet');
    set('f_truck', '');
    const wtcCoFleetTrucks = Array.from(document.querySelectorAll('#dl_equip option')).map(o => o.value);
    const wtcCoFleetMetas = Array.from(document.querySelectorAll('#dl_equip option')).map(o => o.getAttribute('data-meta') || '');
    const wtcNoTruckDrivers = Array.from(document.querySelectorAll('#dl_drivers option')).map(o => o.value);
    const salesDrvStartsLocked = document.getElementById('f_driver').readOnly === true && document.getElementById('f_driver').dataset.policyLockedNow === '1' && wtcNoTruckDrivers.length === 0;
    const wtcCoFleetScopedOk = salesDrvStartsLocked && wtcCoFleetTrucks.length === 9 && wtcCoFleetTrucks.includes('Camion Jiyeh') && wtcCoFleetTrucks.includes('TB3') && wtcCoFleetTrucks.includes('TB8') && !wtcCoFleetTrucks.includes('355948') && !wtcCoFleetTrucks.includes('MB460') && !wtcCoFleetTrucks.includes('TB5') && !wtcCoFleetTrucks.includes('TB1') && !wtcCoFleetTrucks.includes('Tb7') && !wtcCoFleetTrucks.includes('Tb9');
    set('f_truck', 'TB3');
    const wtcTb3DrvOpts = Array.from(document.querySelectorAll('#dl_drivers option')).map(o => o.value);
    const wtcTb3DrvOk = document.getElementById('f_driver').value === 'Ismael' && document.getElementById('f_driver').readOnly === true && document.getElementById('f_driver').dataset.policyLockedNow === '1' && wtcTb3DrvOpts.length === 1 && wtcTb3DrvOpts[0] === 'Ismael';
    const wtcTb3HintTxt = (document.getElementById('hint_truck')?.textContent || '').trim();
    const coFleetTruckNoRedundantFleetBadge = wtcCoFleetMetas.every(m => !/fleet/i.test(m)) && wtcCoFleetMetas.some(m => m.includes('354578 · Hussein Saleh')) && wtcCoFleetMetas.some(m => m.includes('358943 · Ali el Hajj')) && wtcCoFleetMetas.some(m => m.includes('358599 · Ismael')) && !/fleet/i.test(wtcTb3HintTxt);

    // Reproduce exact SharePoint Row 8007 (Screenshot 1 & 2): Company=WTC, Sale Type=Delivery, Transported By=Company fleet, Product=Mghasal, Customer=Sabeh Beton S.R.L, Site=Gisr al bacha, Truck=354578 (TB8) -> Driver=Hussein Saleh, Qty=27.00, Unit Price=$23.50, Mat Total=$634.50, Trans Unit Price=$2.00, Trans Total=$54.00, Total Ex-VAT=$688.50
    set('f_product', 'Mghasal');
    set('f_customer', 'Sabeh Beton S.R.L');
    set('f_site', 'Gisr al bacha');
    set('f_truck', '354578');
    const sp8007Ok =
      document.getElementById('f_driver').value === 'Hussein Saleh' &&
      document.getElementById('f_qty').value === '27.00' &&
      document.getElementById('f_unitprice').value === '23.50' &&
      document.getElementById('f_mat_total').value === '634.50' &&
      document.getElementById('f_transunitprice').value === '2.00' &&
      document.getElementById('f_trans_total').value === '54.00' &&
      document.getElementById('f_total_usd').value === '688.50';
    // Verify 364168 (Tb9 -> Jad Bdeir / Ali Saleh / 27 m³), 360676 (TB1 -> Karim Bdeir / 29 m³), 364656 (Tb7 -> Hussein Bdeir / Mohamad Habib / 29 m³) on Third-party truck from 2026-08-24 onwards
    set('f_transportby', 'Third-party truck');
    set('f_truck', '364168');
    const sp8005Ok = document.getElementById('f_truckowner').value === 'Jad Bdeir' && document.getElementById('f_driver').value === 'Ali Saleh' && document.getElementById('f_qty').value === '27.00';
    set('f_truck', '360676');
    const sp8008Ok = document.getElementById('f_truckowner').value === 'Karim Bdeir' && document.getElementById('f_qty').value === '29.00';
    set('f_truck', '364656');
    const sp8009Ok = document.getElementById('f_truckowner').value === 'Hussein Bdeir' && document.getElementById('f_driver').value === 'Mohamad Habib' && document.getElementById('f_qty').value === '29.00';
    const spFleetParityOk = sp8007Ok && sp8005Ok && sp8008Ok && sp8009Ok;

    set('f_transportby', 'Company fleet');
    set('f_truck', 'TB3');
    set('f_company', 'BBConstruction');
    const bbcCoFleetTrucks = Array.from(document.querySelectorAll('#dl_equip option')).map(o => o.value);
    const bbcCoFleetDrivers = Array.from(document.querySelectorAll('#dl_drivers option')).map(o => o.value);
    const bbcTb3DrvUpdatedOk = document.getElementById('f_driver').value === 'Ismael' && document.getElementById('f_driver').readOnly === true;
    const bbcCoFleetScopedOk = bbcCoFleetTrucks.length === 13 && bbcCoFleetTrucks.includes('TB5') && !bbcCoFleetTrucks.includes('Camion Jiyeh') && !bbcCoFleetTrucks.includes('355948') && !bbcCoFleetTrucks.includes('TB1') && !bbcCoFleetTrucks.includes('Tb7') && !bbcCoFleetTrucks.includes('Tb9') && bbcCoFleetDrivers.length === 1 && bbcCoFleetDrivers[0] === 'Ismael';
    set('f_truck', 'TB5');
    set('f_company', 'WTC');
    const coSwitchClearedMismatchedFleetTruck = document.getElementById('f_truck').value === '';

    set('f_saletype', 'Pickup');
    const pickupDriverHidden = document.getElementById('wrap_f_driver').hidden === true;
    const truckUnlockedByDefault = document.getElementById('f_truck').readOnly === false;
    set('f_truck', '355948');
    const pickupNoDriverNeeded = document.getElementById('wrap_f_driver').hidden === true && document.getElementById('f_driver').value === '' && document.getElementById('f_truckowner').value === 'Ali Khalife';

    // Switch to Delivery (Third-party truck): Driver becomes visible, strictly policy-locked to the Equipment Log's single active driver
    set('f_saletype', 'Delivery');
    set('f_transportby', 'Third-party truck');
    const delivDriverVisible = document.getElementById('wrap_f_driver').hidden === false;
    set('f_truck', 'Aahed');
    const aahedPopulatedOwner = document.getElementById('f_truckowner').value === 'Aahed';
    const aahedOwnerLocked = document.getElementById('f_truckowner').readOnly === true;
    const aahedPopulatedDriver = document.getElementById('f_driver').value === 'Aahed' && document.getElementById('f_driver').readOnly === true && document.getElementById('f_driver').dataset.policyLockedNow === '1';
    const aahedPopulatedQty = document.getElementById('f_qty').value === '20.00';
    const aahedDrvOpts = Array.from(document.querySelectorAll('#dl_drivers option')).map(o => o.value);
    const driverFilteredToOwnerOnly = aahedDrvOpts.length === 1 && aahedDrvOpts[0] === 'Aahed';

    // Strict lock tamper guard: attempting to change Driver without Admin Unlock or Equipment Log update snaps back to 'Aahed'
    set('f_driver', 'Unauthorized Driver');
    const substituteDriverKept = document.getElementById('f_driver').value === 'Aahed' && document.getElementById('f_driver').readOnly === true;

    // Changing Truck Owner from 'Aahed' to 'Aawad' MUST immediately clear mismatched Truck ('Aahed'), Driver, and Quantity ('20.00')
    set('f_truckowner', 'Aawad');
    const ownerChangeClearedTruck = document.getElementById('f_truck').value === '';
    const ownerChangeClearedDriver = document.getElementById('f_driver').value === '';
    const ownerChangeClearedQty = document.getElementById('f_qty').value === '';

    // Picking 'Aahed' again and then clearing truck updates/clears Owner, Driver, and Qty
    set('f_truck', 'Aahed');
    set('f_truck', '');
    const truckClearClearedAll = document.getElementById('f_truckowner').value === '' && document.getElementById('f_driver').value === '' && document.getElementById('f_qty').value === '';

    // Check Raw Purchase form: Transported By matches Sales (Company fleet first, then Third-party truck, with identical labeling), Truck comes before Truck Owner & Driver, and cascades identically
    document.querySelector('.modal-tab[data-form="raw"]').click();
    const rawTransEl = document.getElementById('f_transportby');
    const rawTransOptVals = rawTransEl ? Array.from(rawTransEl.options).map(o => o.value).join(',') : '';
    const rawTransOptLabels = rawTransEl ? Array.from(rawTransEl.options).map(o => o.textContent.trim()).join('|') : '';
    const rawTransMatchesSalesOk = rawTransEl && rawTransEl.value === 'Company fleet' && rawTransOptVals === 'Company fleet,Third-party truck' && rawTransOptLabels === 'Company fleet (Own Truck)|Third-party truck (Hauler)';
    const rawTruckLabelsMatchSalesOk = (document.querySelector('#wrap_f_truck .pa-fld-lbl')?.textContent || '').trim() === 'Truck *' && (document.querySelector('#wrap_f_truckowner .pa-fld-lbl')?.textContent || '').trim() === 'Truck Owner (Hauler) *';
    const rawIds = Array.from(document.querySelectorAll('#modalBody input[id], #modalBody select[id]')).map(e => e.id);
    const rIdx = id => rawIds.indexOf(id);
    const rawOrderingOk = rawTransMatchesSalesOk && rawTruckLabelsMatchSalesOk && rIdx('f_siteowner') < rIdx('f_truck') && rIdx('f_truck') < rIdx('f_truckowner') && rIdx('f_truckowner') < rIdx('f_driver');
    set('f_transportby', 'Third-party truck');
    set('f_truck', 'Aahed');
    const rawAahedDrvOpts = Array.from(document.querySelectorAll('#dl_drivers option')).map(o => o.value);
    set('f_driver', 'Tamper Raw Driver');
    const rawAahedCascadeOk = document.getElementById('f_truckowner').value === 'Aahed' && document.getElementById('f_driver').value === 'Aahed' && document.getElementById('f_driver').readOnly === true && document.getElementById('f_driver').dataset.policyLockedNow === '1' && rawAahedDrvOpts.length === 1 && rawAahedDrvOpts[0] === 'Aahed' && document.getElementById('f_qty').value === '20.00';
    set('f_truckowner', 'Aawad');
    const rawOwnerChangeClearedOk = document.getElementById('f_truck').value === '' && document.getElementById('f_driver').value === '' && document.getElementById('f_qty').value === '';

    // Check Truck Owner (Supplier) form: concise 6-category multi-select (no 50-item filter, no explanation badges, fixed 36px trigger height)
    document.querySelector('[data-pa-group="hq"]').click();
    document.querySelector('.modal-tab[data-form="supplier"]').click();
    const trigEl = document.getElementById('supCategoryTrigger');
    const noTruckOwnerButton = !document.getElementById('f_istruckowner') && !!trigEl;
    if (trigEl) trigEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    const menuOpts = Array.from(document.querySelectorAll('#supCategoryMenu .pa-ms-option'));
    const noExplanationBadges = document.querySelectorAll('#supCategoryMenu .pa-suggest-meta').length === 0 && !document.querySelector('#supCategoryMenu .pa-select-filter');
    const sixCleanCategoriesOk = menuOpts.length === 6 && noExplanationBadges;
    if (trigEl) trigEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    // Selecting 'Aahed' hydrates normalized categories ('Hauler / Truck Owner, Site & Raw Materials') and keeps trigger single-line <= 40px
    set('f_supplier', 'Aahed');
    const aahedChips = Array.from(document.querySelectorAll('#supCategoryChips .pa-ms-chip')).map(c => c.getAttribute('data-ms-val'));
    const multiCatHydratedOk = aahedChips.includes('Hauler / Truck Owner') && aahedChips.includes('Site & Raw Materials') && (trigEl ? trigEl.getBoundingClientRect().height <= 40 : false);
    // Selecting 'IPT' deduplicates legacy 'Fuel' + 'Oils' into 1 category ('Fuel & Lubricants')
    set('f_supplier', 'IPT');
    const iptChips = Array.from(document.querySelectorAll('#supCategoryChips .pa-ms-chip')).map(c => c.getAttribute('data-ms-val'));
    const iptNormalizedOk = iptChips.length === 1 && iptChips[0] === 'Fuel & Lubricants';
    // Removing Hauler / Truck Owner and picking non-hauler categories hides #wrap_sup_drivers automatically & keeps single-line height
    set('f_supplier', 'New Garage Vendor');
    set('f_category', 'Fuel & Lubricants, Spare Parts & Repairs, Supplies & Services');
    const nonHaulerHidesDriversWrap = document.getElementById('wrap_sup_drivers')?.hidden === true && document.querySelectorAll('#supCategoryChips .pa-ms-chip').length === 3 && (trigEl ? trigEl.getBoundingClientRect().height <= 40 : false) && document.getElementById('supCategoryCount')?.textContent === '3';
    // Selecting 'Ali Lakis' re-hydrates Hauler / Truck Owner, reveals #wrap_sup_drivers, shows his 7 trucks, and stages a driver
    set('f_supplier', 'Ali Lakis');
    const supDriversWrapVisible = document.getElementById('wrap_sup_drivers') && !document.getElementById('wrap_sup_drivers').hidden;
    set('f_sup_drv_name', 'Karim Substitute');
    document.getElementById('btnAddSupDriver')?.click();
    const supPanelTxt = document.getElementById('supOwnerDriversList')?.textContent || '';
    const supDriverStagedOk = noTruckOwnerButton && sixCleanCategoriesOk && multiCatHydratedOk && iptNormalizedOk && nonHaulerHidesDriversWrap && supDriversWrapVisible && /Karim Substitute/i.test(supPanelTxt) && /355948/.test(supPanelTxt);

    // Check Truck (Equipment) form: has Default Driver location filtered to the Truck Owner's drivers + inline Equipment Driver Log (#wrap_eq_driver_log)
    document.querySelector('[data-pa-group="hq"]').click();
    document.querySelector('.modal-tab[data-form="equipment"]').click();
    set('f_truck', '339216');
    const eqAutoFilledOwnerAndDefaultDrv = document.getElementById('f_supplier')?.value === 'Ibrahim Bdeir' && document.getElementById('f_driver')?.value === 'sharif al khodr';
    const eqDrvOpts = Array.from(document.querySelectorAll('#dl_drivers option')).map(o => o.value);
    const eqDriverFilteredToOwnerOk = eqAutoFilledOwnerAndDefaultDrv && !document.getElementById('wrap_eq_driver_log')?.hidden && eqDrvOpts.length > 0 && eqDrvOpts.length < 25 && eqDrvOpts[0] === 'sharif al khodr' && eqDrvOpts.includes('Ibrahim Barakat');

    // Check Price Rule form: switching Rule Type to List Price clears hidden Customer, Site, and Tier 1/2 fields
    document.querySelector('[data-pa-group="pricing"]').click();
    document.querySelector('.modal-tab[data-form="pricerule"]').click();
    set('f_ruletype', 'Sales (Delivery)');
    set('f_customer', 'Kenyar');
    set('f_site', 'Beirut');
    set('f_qty1', '20');
    set('f_adj1', '5');
    set('f_ruletype', 'List Price');
    const priceRuleClearedHiddenOk = document.getElementById('f_customer').value === '' && document.getElementById('f_site').value === '' && document.getElementById('f_qty1').value === '' && document.getElementById('f_adj1').value === '0.00';

    // Return to Group 1 -> Check Fuel & Lubricant Intake form:
    // 1. Driver * is strictly policy-locked BOTH before AND after Equipment / Truck * is chosen, with ONLY the Equipment Log's single active driver present (m297)
    // 2. Meter Type is policy-locked & auto-loaded from Equipment Category (Excavator/Wheel Loader/Generator PB*/Plant -> hours, Truck/Vehicle -> odometer, Sundry Other -> none) and normalises legacy WTC readings!
    document.querySelector('[data-pa-group="dispatch"]').click();
    document.querySelector('.modal-tab[data-form="fuel"]').click();
    set('f_company', 'WTC');
    const fuelDrvEl = document.getElementById('f_driver');
    const fuelDrvWrap = document.getElementById('wrap_f_driver');
    const fuelMtEl = document.getElementById('f_metertype');
    const fuelMtWrap = document.getElementById('wrap_f_metertype');
    const fuelMeterEl = document.getElementById('f_meter');
    const fuelMeterWrap = document.getElementById('wrap_f_meter');
    const fuelDriverStartsLocked = !!(fuelDrvEl && fuelDrvEl.readOnly === true && fuelDrvEl.dataset.policyLockedNow === '1' && fuelDrvWrap && fuelDrvWrap.classList.contains('is-policy-locked') && fuelDrvEl.value === '' && document.querySelectorAll('#dl_drivers option').length === 0);
    const fuelMeterStartsLocked = !!(fuelMtEl && fuelMtEl.dataset.policyLockedNow === '1' && fuelMtWrap && fuelMtWrap.classList.contains('is-policy-locked') && fuelMtEl.value === '' && fuelMeterEl && fuelMeterEl.readOnly === true);
    set('f_truck', 'Mb4');
    const fuelMb4DrvOpts = Array.from(document.querySelectorAll('#dl_drivers option'));
    const fuelMb4AutoFilledOk = !!(fuelDrvEl && fuelDrvEl.readOnly === true && fuelDrvEl.dataset.policyLockedNow === '1' && fuelDrvWrap.classList.contains('is-policy-locked') && fuelDrvEl.value === 'ibrahim Mortada' && fuelMb4DrvOpts.length === 1 && fuelMb4DrvOpts[0].value === 'ibrahim Mortada' && (fuelMb4DrvOpts[0].getAttribute('data-meta') || '').includes('Active Equipment Driver (Mb4)'));
    const fuelMb4HoursOk = !!(fuelMtEl && fuelMtEl.value === 'hours' && fuelMtEl.dataset.policyLockedNow === '1' && document.getElementById('lbl_meter_reading')?.textContent === 'Meter Reading (h)' && (document.getElementById('calc_prev')?.textContent || '').startsWith('16,270 h'));
    set('f_driver', 'Unauthorized Fuel Driver');
    const fuelTamperBlockedOk = !!(fuelDrvEl && fuelDrvEl.value === 'ibrahim Mortada' && fuelDrvEl.readOnly === true);
    set('f_fueltype', 'Lubricant');
    const lubMb4DrvOpts = Array.from(document.querySelectorAll('#dl_drivers option')).map(o => o.value);
    const lubMb4LockedOk = !!(fuelDrvEl && fuelDrvEl.value === 'ibrahim Mortada' && fuelDrvEl.readOnly === true && lubMb4DrvOpts.length === 1 && lubMb4DrvOpts[0] === 'ibrahim Mortada');
    set('f_fueltype', 'Diesel');
    const fuelSubstituteKeptOk = fuelTamperBlockedOk && lubMb4LockedOk;
    set('f_truck', 'Sb1');
    const fuelSb1AutoFilledOk = !!(fuelDrvEl && fuelDrvEl.value === 'Khalil Al Sharif' && fuelMtEl.value === 'hours' && (document.getElementById('calc_prev')?.textContent || '').startsWith('4,495 h'));
    set('f_truck', 'Pb1');
    const fuelPb1AutoFilledOk = !!(fuelDrvEl && fuelDrvEl.value === 'Ali Najdeh' && fuelMtEl.value === 'hours' && (document.getElementById('calc_prev')?.textContent || '').startsWith('57,470 h'));
    set('f_truck', 'Caterpillar');
    set('f_qty', '50');
    set('f_meter', '1862');
    const fuelCatAutoFilledOk = !!(fuelDrvEl && fuelDrvEl.value === 'abdallah smael' && fuelMtEl.value === 'hours' && fuelMtEl.dataset.policyLockedNow === '1' && (document.getElementById('calc_prev')?.textContent || '').startsWith('1,854 h') && document.getElementById('calc_delta')?.textContent === '8 h' && document.getElementById('calc_rate')?.textContent === '6.25 L/h');
    set('f_meter', '');
    set('f_truck', 'Tb7');
    const fuelTb7OdoOk = !!(fuelMtEl && fuelMtEl.value === 'odometer' && fuelMtEl.dataset.policyLockedNow === '1' && document.getElementById('lbl_meter_reading')?.textContent === 'Meter Reading (km)' && (document.getElementById('calc_prev')?.textContent || '').startsWith('497,370 km'));
    set('f_truck', 'Gallon');
    const fuelGallonNoMeterOk = !!(fuelMtEl && fuelMtEl.value === 'none' && fuelMtEl.dataset.policyLockedNow === '1' && fuelMeterWrap && fuelMeterWrap.hidden === true);
    set('f_truck', '');
    const fuelClearRelocksDriverOk = !!(fuelDrvEl && fuelDrvEl.readOnly === true && fuelDrvEl.dataset.policyLockedNow === '1' && fuelDrvWrap && fuelDrvWrap.classList.contains('is-policy-locked') && fuelDrvEl.value === '' && fuelMtEl.value === '' && fuelMeterEl.readOnly === true && fuelMeterWrap && fuelMeterWrap.hidden === false);
    const fuelDriverLockAndCascadeOk = fuelDriverStartsLocked && fuelMeterStartsLocked && fuelMb4AutoFilledOk && fuelMb4HoursOk && fuelSubstituteKeptOk && fuelSb1AutoFilledOk && fuelPb1AutoFilledOk && fuelCatAutoFilledOk && fuelTb7OdoOk && fuelGallonNoMeterOk && fuelClearRelocksDriverOk;

    // End-to-End Equipment Driver Assignment Log (1-Day Absence Substitute) across ALL 4 flows: Sales Delivery, Raw Material, Diesel & Lubricant
    document.querySelector('[data-pa-group="hq"]').click();
    document.querySelector('.modal-tab[data-form="equipment"]').click();
    set('f_truck', 'TB3');
    const subDay = document.getElementById('f_effdate')?.value || '2026-10-24';
    const prevDay = '2026-10-15';
    set('f_log_co', 'WTC');
    set('f_log_start', subDay);
    set('f_log_end', subDay);
    set('f_log_driver', 'Ali Saleh');
    document.getElementById('btnLogEquipDriver')?.click();

    // 1) Sales Delivery: on subDay -> ONLY 'Ali Saleh' (locked); on prevDay -> reverts to 'Ismael' (locked)
    document.querySelector('[data-pa-group="dispatch"]').click();
    document.querySelector('.modal-tab[data-form="sales"]').click();
    set('f_company', 'WTC');
    set('f_saletype', 'Delivery');
    set('f_transportby', 'Company fleet');
    set('f_truck', 'TB3');
    const subSalesDrv = document.getElementById('f_driver')?.value;
    const subSalesOpts = Array.from(document.querySelectorAll('#dl_drivers option')).map(o => o.value);
    const subSalesLocked = document.getElementById('f_driver')?.readOnly === true;
    document.getElementById('toggleRepDateBtn')?.click();
    set('f_repdate', prevDay);
    const revSalesDrv = document.getElementById('f_driver')?.value;
    const revSalesOpts = Array.from(document.querySelectorAll('#dl_drivers option')).map(o => o.value);
    document.getElementById('resetRepDateBtn')?.click();

    // 2) Raw Material: on subDay -> ONLY 'Ali Saleh' (locked); on prevDay -> reverts to 'Ismael'
    document.querySelector('.modal-tab[data-form="raw"]').click();
    set('f_company', 'WTC');
    set('f_transportby', 'Company fleet');
    set('f_truck', 'TB3');
    const subRawDrv = document.getElementById('f_driver')?.value;
    const subRawOpts = Array.from(document.querySelectorAll('#dl_drivers option')).map(o => o.value);
    document.getElementById('toggleRepDateBtn')?.click();
    set('f_repdate', prevDay);
    const revRawDrv = document.getElementById('f_driver')?.value;
    document.getElementById('resetRepDateBtn')?.click();

    // 3) Diesel & 4) Lubricant: on subDay -> ONLY 'Ali Saleh' (locked); on prevDay -> reverts to 'Ismael'
    document.querySelector('.modal-tab[data-form="fuel"]').click();
    set('f_company', 'WTC');
    set('f_fueltype', 'Diesel');
    set('f_truck', 'TB3');
    const subDieselDrv = document.getElementById('f_driver')?.value;
    const subDieselOpts = Array.from(document.querySelectorAll('#dl_drivers option')).map(o => o.value);
    set('f_fueltype', 'Lubricant');
    const subLubDrv = document.getElementById('f_driver')?.value;
    const subLubOpts = Array.from(document.querySelectorAll('#dl_drivers option')).map(o => o.value);
    document.getElementById('toggleRepDateBtn')?.click();
    set('f_repdate', prevDay);
    const revLubDrv = document.getElementById('f_driver')?.value;
    document.getElementById('resetRepDateBtn')?.click();

    // Clean up temporary substitute window on TB3 so downstream probes see clean baseline seed state
    document.querySelector('[data-pa-group="hq"]').click();
    document.querySelector('.modal-tab[data-form="equipment"]').click();
    set('f_truck', 'TB3');
    const delSubBtn = Array.from(document.querySelectorAll('[data-del-modal-tw-idx]')).find(b => (b.closest('tr')?.textContent || '').includes('Ali Saleh'));
    if (delSubBtn) delSubBtn.click();

    // Return to Group 1 -> Sales and verify TB3 is back to baseline 'Ismael'
    document.querySelector('[data-pa-group="dispatch"]').click();
    document.querySelector('.modal-tab[data-form="sales"]').click();
    set('f_company', 'WTC');
    set('f_saletype', 'Delivery');
    set('f_transportby', 'Company fleet');
    set('f_truck', 'TB3');
    const restoredSalesDrv = document.getElementById('f_driver')?.value;
    set('f_truck', '');
    set('f_saletype', 'Pickup');

    const equipLogAbsenceSubstituteOk =
      subSalesDrv === 'Ali Saleh' && subSalesLocked && subSalesOpts.length === 1 && subSalesOpts[0] === 'Ali Saleh' &&
      revSalesDrv === 'Ismael' && revSalesOpts.length === 1 && revSalesOpts[0] === 'Ismael' &&
      subRawDrv === 'Ali Saleh' && subRawOpts.length === 1 && subRawOpts[0] === 'Ali Saleh' && revRawDrv === 'Ismael' &&
      subDieselDrv === 'Ali Saleh' && subDieselOpts.length === 1 && subDieselOpts[0] === 'Ali Saleh' &&
      subLubDrv === 'Ali Saleh' && subLubOpts.length === 1 && subLubOpts[0] === 'Ali Saleh' && revLubDrv === 'Ismael' &&
      restoredSalesDrv === 'Ismael';

    const cascadeDiag = {
      truckLabelIsTruckOnly, wtcCoFleetScopedOk, wtcTb3DrvOk, coFleetTruckNoRedundantFleetBadge, spFleetParityOk, bbcCoFleetScopedOk, bbcTb3DrvUpdatedOk, coSwitchClearedMismatchedFleetTruck,
      pickupDriverHidden, pickupNoDriverNeeded, delivDriverVisible,
      truckUnlockedByDefault, aahedPopulatedOwner, aahedOwnerLocked, aahedPopulatedDriver, aahedPopulatedQty,
      driverFilteredToOwnerOnly, substituteDriverKept,
      ownerChangeClearedTruck, ownerChangeClearedDriver, ownerChangeClearedQty, truckClearClearedAll,
      rawOrderingOk, rawAahedCascadeOk, rawOwnerChangeClearedOk,
      supDriverStagedOk, eqDriverFilteredToOwnerOk, priceRuleClearedHiddenOk,
      fuelDriverLockAndCascadeOk, equipLogAbsenceSubstituteOk
    };
    const fleetCascadeAndStaleClearOk = Object.values(cascadeDiag).every(Boolean);

    return {
      orderingOk, saleTypeOrderOk, overtimeLinkedToTimeOk,
      delivSiteVisible, delivTransVisible, delivOwnerHiddenOnCoFleet,
      pickupSiteHidden, pickupTransByHidden, pickupOvertimeHidden, pickupTransPriceHidden, pickupTransTotHidden, pickupTruckOwnerVisible,
      repSynced, noInternalCodes,
      startsLocked, boxOpened, unlockedNow, manualPriceKept, relockedNow,
      fleetCascadeAndStaleClearOk,
      failedCascadeKeys: Object.entries(cascadeDiag).filter(([, v]) => !v).map(([k]) => k)
    };
  })()`);
  intuitiveEntryProbe.orderingOk && intuitiveEntryProbe.saleTypeOrderOk && intuitiveEntryProbe.overtimeLinkedToTimeOk && intuitiveEntryProbe.delivSiteVisible && intuitiveEntryProbe.delivTransVisible && intuitiveEntryProbe.delivOwnerHiddenOnCoFleet &&
  intuitiveEntryProbe.pickupSiteHidden && intuitiveEntryProbe.pickupTransByHidden && intuitiveEntryProbe.pickupOvertimeHidden && intuitiveEntryProbe.pickupTransPriceHidden && intuitiveEntryProbe.pickupTransTotHidden && intuitiveEntryProbe.pickupTruckOwnerVisible &&
  intuitiveEntryProbe.repSynced && intuitiveEntryProbe.noInternalCodes && intuitiveEntryProbe.startsLocked && intuitiveEntryProbe.boxOpened && intuitiveEntryProbe.unlockedNow && intuitiveEntryProbe.manualPriceKept && intuitiveEntryProbe.relockedNow && intuitiveEntryProbe.fleetCascadeAndStaleClearOk
    ? pass('entry desk · v13.6 Strict Equipment Log Driver Lock & 1-Day Absence Substitute across Sales, Raw, Lubricant & Diesel + Admin Unlock')
    : fail('entry desk v13.6 intuitive entry probe', JSON.stringify(intuitiveEntryProbe));

  // 6d. Strict Multi-Column Control Box Alignment (locked + unlocked fields stay on 1-line labels with 0px vertical input offset across columns)
  const colAlignmentProbe = await evaluate(`(() => {
    const checkForms = ['sales', 'raw', 'receipt', 'fuel', 'expense', 'settlement', 'vatinvoice', 'salary', 'logistics', 'treasury'];
    const groups = window.MFG_FORMS.FORM_GROUPS;
    const misalignments = [];
    let rowsChecked = 0;
    for (const fid of checkForms) {
      const g = groups.find(x => x.forms.some(y => y.id === fid));
      if (g) document.querySelector('[data-pa-group="' + g.id + '"]').click();
      const tab = document.querySelector('.modal-tab[data-form="' + fid + '"]');
      if (!tab) continue;
      tab.click();
      const fields = Array.from(document.querySelectorAll('#modalBody .form-field:not(.check-field)')).filter(f => !f.hidden && f.offsetParent !== null);
      const byRow = new Map();
      for (const f of fields) {
        const fr = f.getBoundingClientRect();
        const key = Array.from(byRow.keys()).find(k => Math.abs(k - fr.top) <= 6) ?? Math.round(fr.top);
        if (!byRow.has(key)) byRow.set(key, []);
        const ctrl = f.querySelector('.pa-suggest-wrap, .pa-select-wrap, input:not([type="checkbox"]):not([type="radio"]), select');
        const lbl = f.querySelector(':scope > label');
        if (ctrl && lbl) {
          const cr = ctrl.getBoundingClientRect();
          const lr = lbl.getBoundingClientRect();
          byRow.get(key).push({
            id: f.id || (ctrl.querySelector('input,select') || ctrl).id || 'field',
            ctrlTop: Math.round(cr.top),
            ctrlH: Math.round(cr.height),
            lblH: Math.round(lr.height)
          });
        }
      }
      for (const [, cols] of byRow.entries()) {
        if (cols.length < 2) continue;
        rowsChecked++;
        const baseTop = cols[0].ctrlTop;
        const baseH = cols[0].ctrlH;
        for (const c of cols) {
          if (Math.abs(c.ctrlTop - baseTop) > 1 || Math.abs(c.ctrlH - baseH) > 1 || c.lblH > 22) {
            misalignments.push(fid + ':' + cols.map(x => x.id + '@' + x.ctrlTop + '(' + x.ctrlH + 'h,lbl=' + x.lblH + ')').join('|'));
            break;
          }
        }
      }
    }
    return { ok: misalignments.length === 0 && rowsChecked >= 15, rowsChecked, misalignments };
  })()`);
  colAlignmentProbe.ok
    ? pass('entry desk · multi-column input & search-box top/height alignment (0px offset across locked & unlocked columns)', `${colAlignmentProbe.rowsChecked} multi-col rows verified`)
    : fail('entry desk multi-column alignment', JSON.stringify(colAlignmentProbe));

  // 6e. Post-Attempt Validation & Targeted Red Highlighting (Fix before posting appears only on failed post; only neglected fields & sections turn red)
  const postValidationProbe = await evaluate(`(() => {
    document.querySelector('[data-pa-group="dispatch"]').click();
    document.querySelector('.modal-tab[data-form="sales"]').click();
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    // 1. Before clicking Post: #formErrors is hidden/absent, 0 .field-neglected, 0 .sec-neglected
    const errBoxBefore = document.getElementById('formErrors');
    const hiddenBeforePost = !errBoxBefore || errBoxBefore.hidden === true;
    const neglectedBeforePost = document.querySelectorAll('#modalBody .field-neglected, #modalBody .sec-neglected').length;

    // 2. Typing Ticket # and pressing Enter advances focus to Product instead of triggering Fix before posting
    const tEl = document.getElementById('f_ticketno');
    tEl.focus();
    set('f_ticketno', '99401');
    tEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    const errBoxAfterEnter = document.getElementById('formErrors');
    const enterDidNotTriggerPost = (!errBoxAfterEnter || errBoxAfterEnter.hidden === true) && document.querySelectorAll('#modalBody .field-neglected').length === 0;
    const enterFocusedNext = document.activeElement && document.activeElement.id === 'f_product';

    // 3. Fill Product & Truck (so Quantity, Unit Price, Material Total & Total Ex-VAT are populated), leave Customer blank, then click Post
    const firstProd = (window.MFG_SEED.records.products.find(p => p && p.name && Number(p.list_price) > 0) || window.MFG_SEED.records.products[0]).name;
    set('f_product', firstProd);
    set('f_truck', 'Aahed'); // capacity 20 m³
    // Ensure unit price is populated (unlock if no list price on that grade)
    if (!Number(document.getElementById('f_unitprice').value)) {
      document.querySelector('[data-lock-pill="f_unitprice"]').click();
      const cBtn = document.getElementById('paConfirmFieldUnlockBtn');
      if (cBtn) cBtn.click();
      set('f_unitprice', '21.00');
    }
    const matTotalVal = Number(document.getElementById('f_mat_total').value);
    document.getElementById('dynSaveModalBtn').click();

    const errBoxAfterFail = document.getElementById('formErrors');
    const errShownOnFailedPost = !!(errBoxAfterFail && errBoxAfterFail.hidden === false);
    const errText = errBoxAfterFail ? errBoxAfterFail.innerText : '';
    const onlyCustomerErrorListed = /Customer is required/i.test(errText) && !/Product is required/i.test(errText) && !/Quantity must be above zero/i.test(errText) && !/free ticket/i.test(errText);
    const neglectedFields = Array.from(document.querySelectorAll('#modalBody .form-field.field-neglected')).map(el => el.id);
    const secHdrs = Array.from(document.querySelectorAll('#modalBody .pa-form-sec-hdr'));
    const neglectedSecIndices = secHdrs.map((h, i) => h.classList.contains('sec-neglected') ? i + 1 : null).filter(Boolean);

    // 4. Filling the neglected Customer field immediately clears red highlights and hides Fix before posting
    set('f_customer', window.MFG_SEED.records.customers[0].Customer || window.MFG_SEED.records.customers[0].name);
    const clearedAfterFix = errBoxAfterFail.hidden === true &&
      document.querySelectorAll('#modalBody .field-neglected').length === 0 &&
      document.querySelectorAll('#modalBody .sec-neglected').length === 0;

    return {
      ok: hiddenBeforePost && neglectedBeforePost === 0 && enterDidNotTriggerPost && enterFocusedNext &&
          matTotalVal > 0 && errShownOnFailedPost && onlyCustomerErrorListed &&
          neglectedFields.length === 1 && neglectedFields[0] === 'wrap_f_customer' &&
          neglectedSecIndices.length === 1 && neglectedSecIndices[0] === 1 && clearedAfterFix,
      hiddenBeforePost, neglectedBeforePost, enterDidNotTriggerPost, enterFocusedNext,
      matTotalVal, errShownOnFailedPost, errText, onlyCustomerErrorListed,
      neglectedFields, neglectedSecIndices, clearedAfterFix
    };
  })()`);
  postValidationProbe.ok
    ? pass('entry desk · Fix before posting appears only on failed post & highlights only neglected fields/sections in red', `neglected=${postValidationProbe.neglectedFields.join(',')} · sec=${postValidationProbe.neglectedSecIndices.join(',')} · autoCleared=${postValidationProbe.clearedAfterFix}`)
    : fail('entry desk post-attempt validation & red highlights', JSON.stringify(postValidationProbe));

  await evaluate(`document.getElementById('closeModalBtn').click()`); await sleep(150);

  // 7. Statements all 22
  await evaluate(`window.__navToView('statements')`); await sleep(300);
  const codes = await evaluate(`Array.from(document.querySelectorAll('.stmt-card[data-stmt]')).map(c => c.getAttribute('data-stmt'))`);
  let stOk = 0;
  for (const c of codes) { await evaluate(`document.querySelector('.stmt-card[data-stmt="${c}"]').click()`); await sleep(120); const n = await evaluate(`document.querySelectorAll('#printableSheet table').length`); if (n) stOk++; }
  stOk === 22 ? pass('statements · 22 sheets render') : fail('statements', `${stOk}/22`);
  const rdlParity = await evaluate(`(() => {
    document.querySelector('.stmt-card[data-stmt="08"]').click();
    const salesParams = Array.from(document.querySelectorAll('#rdlParamBar [data-rdl-param]')).map(el => el.getAttribute('data-rdl-param')).join(',');
    const nativeSelects08 = document.querySelectorAll('#rdlParamBar select').length;
    document.querySelector('.stmt-card[data-stmt="20"]').click();
    const invParams = Array.from(document.querySelectorAll('#rdlParamBar [data-rdl-param]')).map(el => el.getAttribute('data-rdl-param')).join(',');
    const cats = document.querySelectorAll('[data-rdl-cat]').length;
    const hasViewBtn = !!document.getElementById('rdlViewReportBtn');
    const titleTxt = (document.querySelector('#printableSheet .rdl-title-text') || {}).textContent || '';

    // Open RDL-21 Delivery Ticket and test live customer-name search in the custom combobox (menu opens strictly BELOW input)
    document.querySelector('.stmt-card[data-stmt="21"]').click();
    const nativeSelects21 = document.querySelectorAll('#rdlParamBar select').length;
    const tkInp = document.querySelector('#rdlParamBar [data-rdl-param="ticketId"]');
    const tkMenu = document.querySelector('#rdlParamBar [data-combo-menu="ticketId"]');
    tkInp.click();
    tkInp.value = 'Kenyar';
    tkInp.dispatchEvent(new Event('input', { bubbles: true }));
    const inpRect = tkInp.getBoundingClientRect();
    const menuRect = tkMenu.getBoundingClientRect();
    const menuBelowInput = !tkMenu.hidden && menuRect.top >= inpRect.bottom;
    const matchedItems = tkMenu.querySelectorAll('.rdl-combo-item').length;
    const firstOpt = tkMenu.querySelector('.rdl-combo-item');
    if (firstOpt) firstOpt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    const sheetTextAfterPick = (document.getElementById('printableSheet') || {}).innerText || '';
    const pickedKenyar = /Kenyar/i.test(sheetTextAfterPick);

    return {
      ok: salesParams === 'from,to,customer,product,site' && invParams === 'invoiceNo' && cats === 8 && hasViewBtn && titleTxt.includes('Sales Invoice') && nativeSelects08 === 0 && nativeSelects21 === 0 && menuBelowInput && matchedItems > 0 && pickedKenyar,
      salesParams, invParams, cats, titleTxt, nativeSelects08, nativeSelects21, menuBelowInput, matchedItems, pickedKenyar
    };
  })()`);
  rdlParity.ok ? pass('statements · RDL Paginated Suite + Rev 10 searchable combobox (0 native <select>, popover strictly below input, instant name search)', `${rdlParity.salesParams} | Kenyars=${rdlParity.matchedItems}`) : fail('statements RDL parity', JSON.stringify(rdlParity));

  // 7b. Biometric Face ID (Attendance PWA parity: 128-d models, 3-pose enrolment, duplicate guard, 2FA step-up, 3-frame biometric sign-in)
  await evaluate(`window.__navToView('users')`); await sleep(250);
  const modelsLoaded = await evaluate(`(async () => { await window.Face.load('./vendor/models'); return { ready: window.Face.ready, backend: window.Face.backend }; })()`);
  modelsLoaded.ready ? pass('face-api · 128-d neural models loaded', `backend=${modelsLoaded.backend}`) : fail('face-api models', JSON.stringify(modelsLoaded));

  const enrolFlow = await evaluate(`(async () => {
    const T = window.MFG_FACE_TEST;
    // Start from a clean slate in the isolated test browser
    for (const em of T.state().enrolledSeats) { T.selectEnrolSeat(em); await T.clearEnrolment(); }
    const vidBefore = document.getElementById('enrolFaceVideo');
    const cbWidth = document.getElementById('enrolRequire2faCb') ? document.getElementById('enrolRequire2faCb').getBoundingClientRect().width : 999;
    T.selectEnrolSeat('husseinbdeir@bhfirms.com');
    const c1 = await T.captureSyntheticPose(T.makeSyntheticVector(1, 0.002));
    // Verify Pose 1 is already auto-stored in enrolledSeats immediately upon capture (before clicking Save)
    const autoStoredAfterPose1 = T.state().enrolledSeats.includes('husseinbdeir@bhfirms.com');
    const c2 = await T.captureSyntheticPose(T.makeSyntheticVector(1, 0.005));
    const c3 = await T.captureSyntheticPose(T.makeSyntheticVector(1, 0.008));
    await T.saveEnrolment();
    const capturedSlotsAfterSave = document.querySelectorAll('#enrolThumbStrip .enrol-thumb-slot.captured').length;
    const sameVideoNode = document.getElementById('enrolFaceVideo') === vidBefore;

    // Select Zeinab and verify duplicate-person guard blocks Hussein's face vector
    T.selectEnrolSeat('zeinabrkein@bhfirms.com');
    const dup = await T.captureSyntheticPose(T.makeSyntheticVector(1, 0.003));
    const z1 = await T.captureSyntheticPose(T.makeSyntheticVector(2, 0.002));
    const z2 = await T.captureSyntheticPose(T.makeSyntheticVector(2, 0.005));
    const z3 = await T.captureSyntheticPose(T.makeSyntheticVector(2, 0.008));
    await T.saveEnrolment();
    const cal = T.runCalibration();
    return {
      cCount: c3.count,
      autoStoredAfterPose1,
      capturedSlotsAfterSave,
      sameVideoNode,
      cbWidth,
      dupReason: dup.reason,
      dupOther: dup.other,
      zCount: z3.count,
      enrolled: T.state().enrolledSeats,
      calPairs: cal ? cal.pairs.length : 0,
      calMinDist: cal && cal.pairs[0] ? cal.pairs[0].d : 0
    };
  })()`);
  enrolFlow.cCount === 3 && enrolFlow.zCount === 3 && enrolFlow.enrolled.length === 2 && enrolFlow.autoStoredAfterPose1 && enrolFlow.capturedSlotsAfterSave === 3 && enrolFlow.sameVideoNode && enrolFlow.cbWidth <= 20
    ? pass('face enrolment · auto-stores on every capture, keeps 3 stored cards visible, preserves live <video>, crisp checkbox layout', enrolFlow.enrolled.join(', '))
    : fail('face enrolment', JSON.stringify(enrolFlow));
  enrolFlow.dupReason === 'duplicate-person' && enrolFlow.dupOther === 'husseinbdeir@bhfirms.com'
    ? pass('face duplicate guard · blocks enrolling same face on a second seat')
    : fail('face duplicate guard', JSON.stringify(enrolFlow));
  enrolFlow.calPairs === 1 && enrolFlow.calMinDist > 0.55
    ? pass('face calibration · 128-d Euclidean separation matrix', `d=${enrolFlow.calMinDist.toFixed(3)}`)
    : fail('face calibration', JSON.stringify(enrolFlow));

  // Sign out to #authGate and test Step-Up 2FA + 3-frame Biometric Sign-In + 1024x514 scaled laptop viewport fit
  let scaledFit = { topOk: true, fitsAll: true, h: 0 };
  if (!MOBILE) {
    await evaluate(`window.MFG_FACE_TEST.signOut()`);
    await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 514, deviceScaleFactor: 1, mobile: false });
    await sleep(80);
    scaledFit = await evaluate(`(() => { const r = document.querySelector('.auth-card').getBoundingClientRect(); return { topOk: r.top >= 0, fitsAll: r.top >= 0 && r.bottom <= window.innerHeight, h: Math.round(r.height), top: Math.round(r.top), bot: Math.round(r.bottom) }; })()`);
    await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
    await sleep(60);
  }
  const authFaceFlow = await evaluate(`(async () => {
    const T = window.MFG_FACE_TEST;
    T.signOut();
    const gateOverflow = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const stageVisible = !!document.getElementById('authFaceStage') && !document.getElementById('authGate').hidden;
    const cardRect = document.querySelector('.auth-card').getBoundingClientRect();
    const cardTopOk = cardRect.top >= 0;
    const cardFitsDesktop = window.innerHeight < 520 || (cardRect.top >= 0 && cardRect.bottom <= window.innerHeight);
    const vpRect = document.getElementById('authCamViewport').getBoundingClientRect();
    const hintRect = document.querySelector('#authFaceStage .auth-hint-wrap').getBoundingClientRect();
    const camAspect4x3 = vpRect.height >= 100 && Math.abs((vpRect.width / vpRect.height) - (4 / 3)) < 0.08;
    const hintNoOverlap = hintRect.left >= vpRect.right - 2 || hintRect.top >= vpRect.bottom - 2;
    const noSoundBtn = !document.getElementById('authSoundBtn') && window.Face && window.Face.Sound && window.Face.Sound.enabled === false;

    // 1. Verify 'both' (PIN + Face ID 2FA) mode: entering PIN for an enrolled seat triggers Step-Up 2FA instead of unlocking immediately
    T.setAuthMode('both');
    const pinStep = await T.performLogin('husseinbdeir@bhfirms.com', '1111');
    const bannerVisible = !document.getElementById('authFaceTargetBanner').hidden;
    const stillLockedAfterPin = !document.getElementById('authGate').hidden;

    // 2. Feeding Zeinab's face during Hussein's 2FA step-up is refused
    const wrongPerson = await T.feedAuthFrame(T.makeSyntheticVector(2, 0.002));

    // 3. Anti-Screenshot Test A: Static 2D phone screenshot (constant EAR=0.29, yaw=0.01, parallax3d=0 across 4 frames) is REJECTED
    T.resetLiveness();
    await T.performLogin('husseinbdeir@bhfirms.com', '1111');
    const ss1 = await T.feedLiveAuthFrame(T.makeSyntheticVector(1, 0.002), { ear: 0.29, yaw: 0.01, parallax3d: 0.0 });
    const ss2 = await T.feedLiveAuthFrame(T.makeSyntheticVector(1, 0.003), { ear: 0.29, yaw: 0.01, parallax3d: 0.0 });
    const ss3 = await T.feedLiveAuthFrame(T.makeSyntheticVector(1, 0.002), { ear: 0.29, yaw: 0.01, parallax3d: 0.0 });
    const ss4 = await T.feedLiveAuthFrame(T.makeSyntheticVector(1, 0.003), { ear: 0.29, yaw: 0.01, parallax3d: 0.0 });
    const staticScreenshotBlocked = ss1.status === 'streak' && ss2.status === 'streak' && ss3.status === 'awaiting-blink' && ss4.status === 'awaiting-blink' && !document.getElementById('authGate').hidden;

    // 4. Anti-Screenshot Test B: Rigid tilted 2D phone screenshot (2D yaw changes -0.06 -> +0.06, but 3D nose-vs-eye parallax=0 and EAR=0.29 stays flat) is REJECTED
    T.resetLiveness();
    await T.performLogin('husseinbdeir@bhfirms.com', '1111');
    await T.feedLiveAuthFrame(T.makeSyntheticVector(1, 0.002), { ear: 0.29, yaw: -0.06, parallax3d: 0.0 });
    await T.feedLiveAuthFrame(T.makeSyntheticVector(1, 0.003), { ear: 0.29, yaw: 0.00, parallax3d: 0.0 });
    const tiltSS = await T.feedLiveAuthFrame(T.makeSyntheticVector(1, 0.002), { ear: 0.29, yaw: 0.06, parallax3d: 0.0 });
    const tiltedScreenshotBlocked = tiltSS.status === 'awaiting-blink' && !document.getElementById('authGate').hidden;

    // 5. Option 1 (Live Blink Liveness + >=3 Consecutive Frames): Open (0.29) -> Blink Closed (0.17) -> Open (0.29) unlocks on Frame 3!
    T.resetLiveness();
    await T.performLogin('husseinbdeir@bhfirms.com', '1111');
    const f1 = await T.feedLiveAuthFrame(T.makeSyntheticVector(1, 0.002), { ear: 0.29, yaw: 0.00, parallax3d: 0.0 });
    const f2 = await T.feedLiveAuthFrame(T.makeSyntheticVector(1, 0.004), { ear: 0.17, yaw: 0.00, parallax3d: 0.0 });
    const f3 = await T.feedLiveAuthFrame(T.makeSyntheticVector(1, 0.003), { ear: 0.29, yaw: 0.00, parallax3d: 0.0 });
    const unlocked2FA = document.getElementById('authGate').hidden === true && T.state().activeEmail === 'husseinbdeir@bhfirms.com';

    // 6. Option 2 (Live 3D Head-Turn Parallax + >=3 Consecutive Frames) + 'either' mode for Zeinab
    T.signOut();
    T.setAuthMode('either');
    const t1 = await T.feedLiveAuthFrame(T.makeSyntheticVector(2, 0.002), { ear: 0.28, yaw: -0.05, parallax3d: -0.022 });
    const t2 = await T.feedLiveAuthFrame(T.makeSyntheticVector(2, 0.004), { ear: 0.29, yaw: 0.00, parallax3d: 0.000 });
    const zLogin = await T.feedLiveAuthFrame(T.makeSyntheticVector(2, 0.003), { ear: 0.305, yaw: 0.06, parallax3d: 0.024 });
    const unlockedDirect = document.getElementById('authGate').hidden === true && T.state().activeEmail === 'zeinabrkein@bhfirms.com';

    // 7. Test Sign-In Requirement Selection modes:
    //    - 'face_only': blocks PIN-only login, allows Live Face ID
    //    - 'pin_only': blocks Face ID camera login, allows PIN
    //    - 'both' (Face first -> PIN second): scanning Live Face ID prompts for PIN Step 2, then PIN unlocks
    T.signOut();
    T.setAuthMode('face_only');
    const faceOnlyPinBlocked = await T.performLogin('zeinabrkein@bhfirms.com', '2222');
    T.setAuthMode('pin_only');
    const pinOnlyFaceBlocked = await T.feedLiveAuthFrame(T.makeSyntheticVector(2, 0.002), { ear: 0.29, yaw: 0.0, parallax3d: 0.0 });
    T.setAuthMode('both');
    T.resetLiveness();
    await T.feedLiveAuthFrame(T.makeSyntheticVector(2, 0.002), { ear: 0.29, yaw: 0.0, parallax3d: 0.0 });
    await T.feedLiveAuthFrame(T.makeSyntheticVector(2, 0.003), { ear: 0.17, yaw: 0.0, parallax3d: 0.0 });
    const faceFirstStep = await T.feedLiveAuthFrame(T.makeSyntheticVector(2, 0.002), { ear: 0.29, yaw: 0.0, parallax3d: 0.0 });
    // Subsequent camera frames while waiting on PIN Step 2 must hold '2fa-pin-pending' steady (never re-loop 1/3..3/3 or wipe typed PIN)
    document.getElementById('authPinInput').value = '22';
    const holdWhileTypingPin = await T.feedLiveAuthFrame(T.makeSyntheticVector(2, 0.002), { ear: 0.29, yaw: 0.0, parallax3d: 0.0 });
    const pinPreservedDuringScan = document.getElementById('authPinInput').value === '22' && holdWhileTypingPin.status === '2fa-pin-pending';
    const pinSecondStep = await T.performLogin('zeinabrkein@bhfirms.com', '2222');
    const bothFaceThenPinOk = faceFirstStep.status === '2fa-pin-pending' && pinPreservedDuringScan && pinSecondStep === true && T.state().activeEmail === 'zeinabrkein@bhfirms.com';

    // Clean up test enrolments and test blank-email + unique-PIN sign-in
    await T.performLogin('husseinbdeir@bhfirms.com', '1111', { bypass2FA: true });
    T.selectEnrolSeat('husseinbdeir@bhfirms.com'); await T.clearEnrolment();
    T.selectEnrolSeat('zeinabrkein@bhfirms.com'); await T.clearEnrolment();
    T.setAuthMode('either');
    T.signOut();
    const pinOnlyLogin = await T.performLogin('', '1111');
    const unlockedPinOnly = pinOnlyLogin === true && document.getElementById('authGate').hidden === true && T.state().activeEmail === 'husseinbdeir@bhfirms.com';
    const camStoppedOnEnter = !document.getElementById('authFaceVideo').srcObject && !T.state().camActive;
    // Verify post-login late camera frame guard & pre-paint sw-resuming CSS rule (prevents post-login portal flash)
    const lateFrameRes = await T.feedLiveAuthFrame(T.makeSyntheticVector(1, 0.002), { ear: 0.28, yaw: 0.0 });
    const lateFrameBlockedOk = lateFrameRes && lateFrameRes.status === 'already-authed';
    const gateEl = document.getElementById('authGate');
    gateEl.hidden = false;
    document.documentElement.classList.add('sw-resuming');
    const swResumeGateHidden = getComputedStyle(gateEl).display === 'none';
    document.documentElement.classList.remove('sw-resuming');
    gateEl.hidden = true;

    return {
      gateOverflow,
      stageVisible,
      cardTopOk,
      cardFitsDesktop,
      cardHeight: Math.round(cardRect.height),
      camAspect4x3,
      camSize: Math.round(vpRect.width) + 'x' + Math.round(vpRect.height),
      hintNoOverlap,
      noSoundBtn,
      camStoppedOnEnter,
      lateFrameBlockedOk,
      swResumeGateHidden,
      pinStep,
      bannerVisible,
      stillLockedAfterPin,
      wrongPerson: wrongPerson.status,
      staticScreenshotBlocked,
      tiltedScreenshotBlocked,
      f1: f1.status,
      f2: f2.status,
      f3: f3.status,
      f3Method: f3.method,
      f3Liveness: f3.liveness,
      unlocked2FA,
      t1: t1.status,
      t2: t2.status,
      zLogin: zLogin.status,
      zMethod: zLogin.method,
      zLiveness: zLogin.liveness,
      unlockedDirect,
      faceOnlyPinBlocked,
      pinOnlyFaceBlocked: pinOnlyFaceBlocked.status,
      faceFirstStep: faceFirstStep.status,
      pinSecondStep,
      bothFaceThenPinOk,
      unlockedPinOnly
    };
  })()`);
  authFaceFlow.stageVisible && authFaceFlow.gateOverflow === 0 && authFaceFlow.cardTopOk && (MOBILE || authFaceFlow.cardFitsDesktop)
    && scaledFit.topOk && scaledFit.fitsAll ? pass('authGate · Face ID scanner stage visible, 0px overflow & 0px top/bottom cutoff (1366×768 & 1024×514)', `1366x768=${authFaceFlow.cardHeight}px · 1024x514=${scaledFit.h}px`)
    : fail('authGate Face ID stage', JSON.stringify(authFaceFlow));
  authFaceFlow.camAspect4x3 && authFaceFlow.hintNoOverlap && authFaceFlow.noSoundBtn && authFaceFlow.camStoppedOnEnter
    ? pass('authGate camera · 4:3 uncropped viewport, 0px banner overlap, no voice toggle & camera stops on sign-in', authFaceFlow.camSize)
    : fail('authGate camera geometry & lifecycle', JSON.stringify(authFaceFlow));
  authFaceFlow.pinStep === '2fa_pending' && authFaceFlow.bannerVisible && authFaceFlow.stillLockedAfterPin && authFaceFlow.wrongPerson === '2fa-mismatch'
    ? pass('authGate 2FA · enrolled seat requires Face ID after PIN & rejects wrong face')
    : fail('authGate 2FA enforcement', JSON.stringify(authFaceFlow));
  authFaceFlow.staticScreenshotBlocked && authFaceFlow.tiltedScreenshotBlocked
    ? pass('authGate anti-screenshot · rejects both static 2D phone screenshots and tilted rigid 2D screenshots')
    : fail('authGate anti-screenshot rejection', JSON.stringify(authFaceFlow));
  authFaceFlow.f1 === 'streak' && authFaceFlow.f2 === 'streak' && authFaceFlow.f3 === 'verified' && authFaceFlow.unlocked2FA && authFaceFlow.f3Liveness === 'blink'
    ? pass('authGate Option 1 (Blink Liveness + >=3 frames) · 3 consecutive frames + live blink unlock session', authFaceFlow.f3Method)
    : fail('authGate Option 1 Blink Liveness unlock', JSON.stringify(authFaceFlow));
  authFaceFlow.t1 === 'streak' && authFaceFlow.t2 === 'streak' && authFaceFlow.zLogin === 'verified' && authFaceFlow.unlockedDirect && authFaceFlow.zLiveness === 'turn3d'
    ? pass('authGate Option 2 (3D Head-Turn Parallax + >=3 frames) · 3 consecutive frames + 3D nose/eye parallax unlock session', authFaceFlow.zMethod)
    : fail('authGate Option 2 3D Head-Turn Parallax', JSON.stringify(authFaceFlow));
  authFaceFlow.faceOnlyPinBlocked === 'face_only_required' && authFaceFlow.pinOnlyFaceBlocked === 'face-disabled' && authFaceFlow.bothFaceThenPinOk
    ? pass('authGate Sign-In Requirement modes · Either, Both (PIN->Face & Face->PIN), Face ID Only & PIN Only enforced')
    : fail('authGate Sign-In Requirement modes', JSON.stringify(authFaceFlow));
  authFaceFlow.unlockedPinOnly && authFaceFlow.lateFrameBlockedOk && authFaceFlow.swResumeGateHidden
    ? pass('authGate PIN-only & no post-login portal flash · blank email + 4-digit PIN signs in, late camera frames ignored & SW-resume pre-paint guard active')
    : fail('authGate PIN-only sign-in', JSON.stringify(authFaceFlow));

  // 7b2. Team Seat Inspector (#seatEditorPanel) — inspect all 10 current users & update in-place
  await evaluate(`window.__navToView('users')`); await sleep(200);
  const seatInspectorProbe = await evaluate(`(async () => {
    const T = window.MFG_FACE_TEST;
    const seatIds = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9', 'u10'];
    const inspected = [];
    for (const id of seatIds) {
      const btn = document.querySelector('[data-edit-user="' + id + '"]');
      if (btn) btn.click();
      else T.selectSeatForEdit(id);
      const nameVal = (document.getElementById('nu_name') || {}).value || '';
      const emailVal = (document.getElementById('nu_email') || {}).value || '';
      const pinVal = (document.getElementById('nu_pin') || {}).value || '';
      const roleVal = (document.getElementById('nu_role') || {}).value || '';
      const compVal = (document.getElementById('nu_companies') || {}).value || '';
      const accVal = (document.getElementById('nu_access') || {}).value || '';
      const statusVal = (document.getElementById('nu_status') || {}).value || '';
      inspected.push({ id, nameVal, emailVal, pinVal, roleVal, compVal, accVal, statusVal });
    }
    const all10Populated = inspected.length === 10 && inspected.every(x =>
      x.nameVal.length > 2 && x.emailVal.includes('@') && /^\\d{4,8}$/.test(x.pinVal) && x.roleVal && x.compVal && x.accVal.includes('|')
    );

    // Update u7 (Ali Mansour) in-place, verify table & form reflect update, then restore original values
    T.selectSeatForEdit('u7');
    const origName = document.getElementById('nu_name').value;
    const origRole = document.getElementById('nu_role').value;
    const origComp = document.getElementById('nu_companies').value;
    const origAcc = document.getElementById('nu_access').value;
    document.getElementById('nu_name').value = 'Ali Mansour (WTC Lead Scale)';
    document.getElementById('nu_role').value = 'Supervisor + Entry';
    document.getElementById('nu_companies').value = 'WTC, BBConstruction';
    document.getElementById('nu_access').value = 'full|partial';
    await T.saveSeatEditorForm();
    const rowAfterUpdate = (document.querySelector('tr[data-user-row="u7"]') || {}).textContent || '';
    const updatedOk = rowAfterUpdate.includes('Ali Mansour (WTC Lead Scale)') &&
      rowAfterUpdate.includes('Supervisor + Entry') &&
      rowAfterUpdate.includes('WTC, BBConstruction') &&
      rowAfterUpdate.includes('Full PBI + Ops Statements');

    // Restore u7 original state
    document.getElementById('nu_name').value = origName;
    document.getElementById('nu_role').value = origRole;
    document.getElementById('nu_companies').value = origComp;
    document.getElementById('nu_access').value = origAcc;
    await T.saveSeatEditorForm();
    T.selectSeatForEdit('u1');
    return { all10Populated, count: inspected.length, updatedOk, sampleU4: inspected[3], sampleU9: inspected[8] };
  })()`);
  seatInspectorProbe && seatInspectorProbe.all10Populated && seatInspectorProbe.updatedOk
    ? pass('users seat inspector · all 10 current users inspectable & editable in-place (name, email, PIN, role, companies RLS, dashboards & status)', `${seatInspectorProbe.count}/10 seats verified · u4=${seatInspectorProbe.sampleU4.accVal} · u9=${seatInspectorProbe.sampleU9.compVal}`)
    : fail('users seat inspector', JSON.stringify(seatInspectorProbe));

  // 7b3. Scalable Multi-Select Company Selector (100-Company Stress Test) + End-to-End 3-Dimensional Access & RLS Consistency
  const multiCoAndAccessProbe = await evaluate(`(async () => {
    const T = window.MFG_FACE_TEST;
    // 1. Test Multi-Select Company Selector & 100-Company Scalability
    const extraCos = [];
    for (let i = 4; i <= 100; i++) {
      const num = String(i).padStart(3, '0');
      extraCos.push({ key: 'co_' + num, name: 'Company ' + num, label: 'Company ' + num, sector: 'Plant #' + num });
    }
    window.MFG_COMPANIES = extraCos;
    T.selectSeatForEdit('u8');

    const selRoot = document.getElementById('nuCompanySelector');
    const trigger = document.getElementById('nuCompanyTrigger');
    const popover = document.getElementById('nuCompanyPopover');
    const searchInp = document.getElementById('nuCompanySearch');
    const selectAllBtn = document.getElementById('nuCompanySelectAllBtn');
    const clearBtn = document.getElementById('nuCompanyClearBtn');
    const countPill = document.getElementById('nuCompanyCountPill');
    const hiddenInput = document.getElementById('nu_companies');
    const isNativeSelect = hiddenInput && hiddenInput.tagName === 'SELECT';

    // Open popover
    trigger.click();
    const popOpen = popover && !popover.hidden;
    const totalRenderedOpts = document.querySelectorAll('#nuCompanyList .co-multi-opt').length;
    const initialSelectedVal = hiddenInput ? hiddenInput.value : '';

    // Filter to "Company 042"
    searchInp.value = 'Company 042';
    searchInp.dispatchEvent(new Event('input', { bubbles: true }));
    const visibleOnSearch = Array.from(document.querySelectorAll('#nuCompanyList .co-multi-opt')).filter(el => !el.hidden).length;

    // Clear search and click Select All (100)
    searchInp.value = '';
    searchInp.dispatchEvent(new Event('input', { bubbles: true }));
    selectAllBtn.click();
    const all100CountText = countPill ? countPill.textContent.trim() : '';
    const all100ChipsMore = (document.querySelector('#nuCompanyChips .co-multi-chip-more') || {}).textContent || '';
    const all100CsvCount = (hiddenInput.value || '').split(',').map(s => s.trim()).filter(Boolean).length;

    // Click Clear -> clears selection and shows validation hint until at least 1 company is picked
    clearBtn.click();
    const afterClearCount = (hiddenInput.value || '').split(',').map(s => s.trim()).filter(Boolean).length;

    // Clean up synthetic 100 companies and configure u8 & u10 via the multi-select selector before testing their sessions
    window.MFG_COMPANIES = null;
    T.selectSeatForEdit('u8');
    const u8Orig = {
      role: document.getElementById('nu_role').value,
      comp: document.getElementById('nu_companies').value,
      acc: document.getElementById('nu_access').value,
      email: document.getElementById('nu_email').value,
      pin: document.getElementById('nu_pin').value
    };
    document.getElementById('nuCompanyClearBtn').click();
    document.querySelectorAll('#nuCompanyList .co-multi-cb').forEach(cb => {
      if (cb.value === 'WTC' || cb.value === 'Lions Transport') {
        cb.checked = true;
        cb.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    document.getElementById('nu_role').value = 'Supervisor + Entry';
    document.getElementById('nu_access').value = 'full|partial';
    await T.saveSeatEditorForm();

    T.selectSeatForEdit('u10');
    const u10Orig = {
      role: document.getElementById('nu_role').value,
      comp: document.getElementById('nu_companies').value,
      acc: document.getElementById('nu_access').value,
      email: document.getElementById('nu_email').value,
      pin: document.getElementById('nu_pin').value
    };
    document.getElementById('nuCompanyClearBtn').click();
    document.querySelectorAll('#nuCompanyList .co-multi-cb').forEach(cb => {
      if (cb.value === 'WTC' || cb.value === 'BBConstruction') {
        cb.checked = true;
        cb.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    document.getElementById('nu_role').value = 'Sales';
    document.getElementById('nu_access').value = 'partial|full';
    await T.saveSeatEditorForm();

    // 2. Test Multi-Company Subset RLS (u8: WTC + Lions Transport | Supervisor + Entry | full|partial)
    await T.performLogin(u8Orig.email, u8Orig.pin, { bypass2FA: true });
    const u8GroupBtn = document.querySelector('#companySwitch .entity-btn[data-company="manufacturing-group"]');
    const u8WtcBtn = document.querySelector('#companySwitch .entity-btn[data-company="wtc"]');
    const u8BbcBtn = document.querySelector('#companySwitch .entity-btn[data-company="bbconstruction"]');
    const u8LtBtn = document.querySelector('#companySwitch .entity-btn[data-company="lionstransport"]');
    const u8CompanySwitchOk = !!(u8GroupBtn && !u8GroupBtn.hidden && /All Assigned \\(2\\)/.test(u8GroupBtn.textContent) &&
      u8WtcBtn && !u8WtcBtn.hidden && u8LtBtn && !u8LtBtn.hidden && u8BbcBtn && u8BbcBtn.hidden);

    // Switch u8 to All Assigned (2) on Sales and verify BBConstruction recon card is hidden & 0 BBConstruction rows leak
    u8GroupBtn.click();
    window.__navToView('sales');
    const u8BbcReconHidden = (document.querySelector('.sales-recon-card[data-jump-co="bbconstruction"]') || {}).hidden === true;
    const u8SalesRows = Array.from(document.querySelectorAll('#salesPanel table.ledger-table tbody tr.rrow'));
    const u8LeakedBbcSales = u8SalesRows.some(tr => tr.children[2] && /BBConstruction/i.test(tr.children[2].textContent));

    window.__navToView('statements');
    const u8StmtTabs = document.querySelectorAll('.stmt-card[data-stmt]').length;

    // 3. Test Partial Access Single-Company Entry Seat (u3: Sabah Kassab — WTC | Entry | partial|partial)
    await T.performLogin('sabahkassab@bhfirms.com', '3333', { bypass2FA: true });
    const u3NavPayrollHidden = (document.querySelector('#sidebarNav .nav-item[data-hub="payroll"]') || {}).hidden === true;
    const u3LedgerHubBtn = document.querySelector('#sidebarNav .nav-item[data-hub="ledger"]');
    const u3NavLedgerVisible = Boolean(u3LedgerHubBtn && !u3LedgerHubBtn.hidden);
    const u3NavTbPillText = (document.getElementById('navCountTB') || {}).textContent?.trim() || '';
    if (u3LedgerHubBtn) u3LedgerHubBtn.click();
    const u3LedgerOpensStatements = location.hash === '#statements' && !document.getElementById('hubSubtabBar') && !document.querySelector('#hubSubtabBar [data-hub-subtab="ledger"]') && !document.querySelector('#hubSubtabBar [data-hub-subtab="ledger_treasury"]');

    const u3OverviewHubBtn = document.querySelector('#sidebarNav .nav-item[data-hub="overview"]');
    if (u3OverviewHubBtn) u3OverviewHubBtn.click();
    const u3NavSentinelsHidden = !document.querySelector('#hubSubtabBar [data-hub-subtab="sentinels"]') && !document.querySelector('#hubSubtabBar [data-hub-subtab="entities"]');
    const u3NavPbiText = (document.querySelector('#hubSubtabBar [data-hub-subtab="pbi"] .hub-subtab-pill') || {}).textContent?.trim() || '';

    window.__navToView('pbi');
    const u3PbiTabs = document.querySelectorAll('.pbi-page-tab[data-pbi-page]').length;

    window.__navToView('tables');
    const u3TableChips = document.querySelectorAll('[data-table-key]').length;
    const u3HasSalariesTable = !!document.querySelector('[data-table-key="salaries"]');

    // 4. Test Sales & AR Collector Seat (u10: WTC + BBConstruction | Sales | partial|full)
    await T.performLogin(u10Orig.email, u10Orig.pin, { bypass2FA: true });
    const u10VisibleNavHubs = Array.from(document.querySelectorAll('#sidebarNav .nav-item[data-hub]'))
      .filter(b => !b.hidden)
      .map(b => b.getAttribute('data-hub'));
    document.getElementById('newEntryBtn').click();
    const u10VisibleForms = Array.from(document.querySelectorAll('.modal-tab[data-form]'))
      .filter(b => !b.hidden)
      .map(b => b.getAttribute('data-form'));
    document.getElementById('closeModalBtn').click();

    // Restore Owner session (Hussein Bdeir), restore u8 & u10 original seats, and return to All-Time Group scope
    await T.performLogin('husseinbdeir@bhfirms.com', '1111', { bypass2FA: true });
    window.__navToView('users');
    T.selectSeatForEdit('u8');
    document.getElementById('nu_role').value = u8Orig.role;
    document.getElementById('nu_companies').value = u8Orig.comp;
    document.getElementById('nu_companies').dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('nu_access').value = u8Orig.acc;
    await T.saveSeatEditorForm();

    T.selectSeatForEdit('u10');
    document.getElementById('nu_role').value = u10Orig.role;
    document.getElementById('nu_companies').value = u10Orig.comp;
    document.getElementById('nu_companies').dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('nu_access').value = u10Orig.acc;
    await T.saveSeatEditorForm();

    T.selectSeatForEdit('u1');
    document.querySelector('#companySwitch .entity-btn[data-company="manufacturing-group"]').click();

    return {
      selectorOk: !!selRoot && !isNativeSelect && popOpen && totalRenderedOpts === 100 &&
        initialSelectedVal.length > 0 && visibleOnSearch === 1 &&
        all100CountText === '100 / 100 selected' && /\\+92 more selected/.test(all100ChipsMore) &&
        all100CsvCount === 100 && afterClearCount === 0,
      totalRenderedOpts, visibleOnSearch, all100CountText, all100ChipsMore,
      u8ConsistencyOk: u8CompanySwitchOk && u8BbcReconHidden && !u8LeakedBbcSales && u8StmtTabs === 13,
      u3ConsistencyOk: u3NavPayrollHidden && u3NavLedgerVisible && u3NavTbPillText === '13 A4' && u3LedgerOpensStatements && u3NavSentinelsHidden &&
        u3NavPbiText === '9 Pages' && u3PbiTabs === 9 && u3TableChips === 23 && !u3HasSalariesTable,
      u10ConsistencyOk: u10VisibleNavHubs.join(',') === 'overview,sales,kiosks,ledger,users' &&
        u10VisibleForms.join(',') === 'sales,receipt',
      u8CompanySwitchOk, u8BbcReconHidden, u8LeakedBbcSales, u8StmtTabs, u3NavTbPillText, u3LedgerOpensStatements, u3PbiTabs, u3TableChips, u10VisibleNavViews: u10VisibleNavHubs, u10VisibleForms
    };
  })()`);
  multiCoAndAccessProbe && multiCoAndAccessProbe.selectorOk
    ? pass('users company selector · searchable multi-select scales to 100 companies (live filter, Select All 100, chip overflow +92, Clear)', `${multiCoAndAccessProbe.totalRenderedOpts} cos · search=${multiCoAndAccessProbe.visibleOnSearch} · ${multiCoAndAccessProbe.all100CountText}`)
    : fail('users company multi-select selector', JSON.stringify(multiCoAndAccessProbe));
  multiCoAndAccessProbe && multiCoAndAccessProbe.u8ConsistencyOk && multiCoAndAccessProbe.u3ConsistencyOk && multiCoAndAccessProbe.u10ConsistencyOk
    ? pass('access & RLS consistency · multi-company subset (All Assigned 2, 0 leaked rows, 13 RDL) + Entry (15 PBI / 23 tbls) + Sales gating', `u8 RDL=${multiCoAndAccessProbe.u8StmtTabs} · u3=${multiCoAndAccessProbe.u3PbiTabs} PBI/${multiCoAndAccessProbe.u3TableChips} tbls · u10 views=${multiCoAndAccessProbe.u10VisibleNavViews.join(',')}`)
    : fail('access & RLS consistency', JSON.stringify(multiCoAndAccessProbe));

  // 7b-2. 10-Industry × 15–20 Company Enterprise Scale Test (Topbar #companySwitch + Seat Inspector #nuCompanySelector)
  const tenIndustryProbe = await evaluate(`(async () => {
    const T = window.MFG_FACE_TEST;
    const swBox = document.getElementById('companySwitch');
    const wBefore = swBox ? Math.round(swBox.getBoundingClientRect().width) : 0;
    const demoBtn = document.getElementById('companySwitchScalePreviewBtn');
    if (demoBtn) demoBtn.click();
    const wAfter = swBox ? Math.round(swBox.getBoundingClientRect().width) : 0;
    const topbarIndTabs = document.querySelectorAll('#companySwitchIndustryList .ep-ind-tab').length;
    const topbarCoBtns = document.querySelectorAll('#companySwitchList .entity-btn').length;
    // Filter topbar by Hospitality & Resorts industry
    const hspTab = document.querySelector('#companySwitchIndustryList .ep-ind-tab[data-ep-ind="Hospitality & Resorts"]');
    if (hspTab) hspTab.click();
    const visibleHspBtns = Array.from(document.querySelectorAll('#companySwitchList .entity-btn')).filter(b => !b.hidden).length;
    // Check Seat Inspector 2-column Industry -> Company grouping
    const rlsIndTabs = document.querySelectorAll('#nuCompanyIndustryBar .co-multi-ind-tab').length;
    const rlsIndHdrs = document.querySelectorAll('#nuCompanyList .co-multi-ind-hdr').length;
    const trdToggle = document.querySelector('#nuCompanyList [data-toggle-industry="Automotive & Heavy Trading"]');
    if (trdToggle) trdToggle.click();
    const chipsH = Math.round(document.getElementById('nuCompanyChips').getBoundingClientRect().height);
    // Reset preview back to 3 companies
    if (demoBtn) demoBtn.click();
    T.selectSeatForEdit('u1');
    return {
      ok: wBefore > 0 && Math.abs(wAfter - wBefore) <= 1 && topbarIndTabs === 11 && topbarCoBtns >= 150 &&
          visibleHspBtns >= 15 && rlsIndTabs === 11 && rlsIndHdrs === 10 && chipsH <= 30,
      wBefore, wAfter, topbarIndTabs, topbarCoBtns, visibleHspBtns, rlsIndTabs, rlsIndHdrs, chipsH
    };
  })()`);
  tenIndustryProbe && tenIndustryProbe.ok
    ? pass('10-industry × 150-company scale · fixed topbar box (0px width growth), 2-col industry→company popovers & 1-click industry toggle', `width=${tenIndustryProbe.wBefore}px→${tenIndustryProbe.wAfter}px · indTabs=${tenIndustryProbe.topbarIndTabs} · cos=${tenIndustryProbe.topbarCoBtns} · chipsH=${tenIndustryProbe.chipsH}px`)
    : fail('10-industry × 150-company scale', JSON.stringify(tenIndustryProbe));

  // 7b-3. Roles, Check-Permissions Matrix, Custom Role Granular Checkboxes, Policy-Lock Field Unlocks & Linked Dashboards/Statements
  const customRoleProbe = await evaluate(`(async () => {
    const T = window.MFG_FACE_TEST;
    window.__navToView('users');
    // Click the role badge button in the Team Directory for u3 (Sabah Kassab) to open its permissions matrix
    const dirRoleBtn = document.querySelector('[data-check-perms="u3"]');
    if (dirRoleBtn) dirRoleBtn.click();
    else T.selectSeatForEdit('u3', { openPerms: true });

    const u3Orig = {
      role: document.getElementById('nu_role').value,
      comp: document.getElementById('nu_companies').value,
      acc: document.getElementById('nu_access').value
    };

    const matrixOpenOnInspect = !!document.getElementById('rolePermissionsMatrixPanel');
    const roleOpts = Array.from(document.getElementById('nu_role').options).map(o => o.value);
    const hasDefaultAndCustomRoles = ['Entry', 'Supervisor', 'Supervisor + Entry', 'Full Access (Owner)', 'Sales', 'Custom'].every(r => roleOpts.includes(r));

    // Verify role -> Executive Dashboards & Statements auto-linking on default roles
    const roleEl = document.getElementById('nu_role');
    const accEl = document.getElementById('nu_access');
    roleEl.value = 'Full Access (Owner)';
    roleEl.dispatchEvent(new Event('change', { bubbles: true }));
    const ownerLinkedAcc = accEl.value;

    roleEl.value = 'Sales';
    roleEl.dispatchEvent(new Event('change', { bubbles: true }));
    const salesLinkedAcc = accEl.value;

    // Switch to Custom Role -> auto-links to custom|custom and unlocks granular checkboxes
    roleEl.value = 'Custom';
    roleEl.dispatchEvent(new Event('change', { bubbles: true }));
    const customLinkedAcc = accEl.value;

    // Configure Custom Role permissions:
    // 1. Clear unlocks, dashboards, statements and set rights to read-only first, then pick specific ones
    const clickBulk = val => {
      const alt = val.replace(':none', ':off');
      const btn = document.querySelector('[data-perm-bulk="' + val + '"], [data-perm-bulk="' + alt + '"]');
      if (btn) btn.click();
    };
    clickBulk('rights:readonly');
    clickBulk('unlocks:off');
    clickBulk('dashboards:off');
    clickBulk('statements:off');

    const setPerm = (cat, id, on) => {
      const cb = document.querySelector('[data-perm-cat="' + cat + '"][data-perm-id="' + id + '"]');
      if (cb && cb.checked !== on) {
        cb.checked = on;
        cb.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };
    // Rights: Read Ops (on), Read Fin (off), Enter Dispatch (on), Modify Existing Records (on), Void (off)
    setPerm('rights', 'read_ops', true);
    setPerm('rights', 'read_fin', false);
    setPerm('rights', 'enter_dispatch', true);
    setPerm('rights', 'modify_data', true);
    setPerm('rights', 'void_data', false);
    // Unlocks: Allow unlocking Unit Price (f_unitprice) and Quantity Cap (f_qty) WITHOUT Admin PIN
    setPerm('unlocks', 'unlock_unit_price', true);
    setPerm('unlocks', 'unlock_qty_cap', true);
    // Dashboards: Overview (3 pages; 2 for single-company WTC) + Commercial (5) + Financial GL (3) = 10 PBI Pages for WTC
    setPerm('dashboards', 'dash_overview', true);
    setPerm('dashboards', 'dash_commercial', true);
    setPerm('dashboards', 'dash_financial_gl', true);
    // Statements: Daily Digest (5) + Financial Board Pack (8) = 13 Printable A4 Statements
    setPerm('statements', 'stmt_digest_ops', true);
    setPerm('statements', 'stmt_financial_board', true);

    await T.saveSeatEditorForm();

    // Sign in as u3 (Sabah Kassab) and verify Custom Role enforcement end-to-end
    await T.performLogin('sabahkassab@bhfirms.com', '3333', { bypass2FA: true });
    window.__navToView('pbi');
    const customPbiTabs = document.querySelectorAll('.pbi-page-tab[data-pbi-page]').length;
    const hasGlPage = !!document.querySelector('.pbi-page-tab[data-pbi-page="p16_financial"]');

    window.__navToView('statements');
    const customStmtCards = document.querySelectorAll('.stmt-card[data-stmt]').length;
    const hasPlStmt = !!document.querySelector('.stmt-card[data-stmt="03"]');

    // Open Entry Desk -> Sales form: verify f_unitprice can be unlocked by Custom Role without Admin PIN, while f_total_usd still requires Admin PIN
    document.getElementById('newEntryBtn').click();
    const canUnlockUnitPrice = T.canUnlockField('f_unitprice');
    const canUnlockQty = T.canUnlockField('f_qty');
    const canUnlockFormulaTotals = T.canUnlockField('f_total_usd');
    const unitPriceInpBefore = document.getElementById('f_unitprice');
    const lockedInitially = !!(unitPriceInpBefore && unitPriceInpBefore.readOnly);
    const unitPriceLockPill = document.querySelector('[data-lock-pill="f_unitprice"]');
    if (unitPriceLockPill) unitPriceLockPill.click();
    const noPinInputRequired = !document.getElementById('paAdminPinInput');
    const confirmUnlockBtn = document.getElementById('paConfirmFieldUnlockBtn');
    if (confirmUnlockBtn) confirmUnlockBtn.click();
    const unitPriceInpAfter = document.getElementById('f_unitprice');
    const unlockedWithoutPin = !!(noPinInputRequired && unitPriceInpAfter && !unitPriceInpAfter.readOnly);
    document.getElementById('closeModalBtn').click();

    // Open Record Inspector on Sales -> verify Modify Record button is present while Void Record button is hidden
    window.__navToView('sales');
    const firstRow = document.querySelector('#salesPanel tr.rrow[data-rid]');
    if (firstRow) firstRow.click();
    const hasModifyBtn = !!document.getElementById('inspModifyRecordBtn');
    const hasVoidBtn = !!document.getElementById('inspectorVoidBtn');
    const doneBtn = document.getElementById('inspectorDoneBtn');
    if (doneBtn) doneBtn.click();

    // Restore Owner session & restore u3 original seat
    await T.performLogin('husseinbdeir@bhfirms.com', '1111', { bypass2FA: true });
    window.__navToView('users');
    T.selectSeatForEdit('u3');
    document.getElementById('nu_role').value = u3Orig.role;
    document.getElementById('nu_role').dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('nu_companies').value = u3Orig.comp;
    document.getElementById('nu_companies').dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('nu_access').value = u3Orig.acc;
    await T.saveSeatEditorForm();
    T.selectSeatForEdit('u1');
    const overflowUsers = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);

    return {
      ok: matrixOpenOnInspect && hasDefaultAndCustomRoles &&
          ownerLinkedAcc === 'full|full' && salesLinkedAcc === 'partial|full' && customLinkedAcc === 'custom|custom' &&
          customPbiTabs === 5 && hasGlPage && customStmtCards === 13 && hasPlStmt &&
          canUnlockUnitPrice && canUnlockQty && !canUnlockFormulaTotals &&
          lockedInitially && unlockedWithoutPin && hasModifyBtn && !hasVoidBtn && overflowUsers === 0,
      matrixOpenOnInspect, hasDefaultAndCustomRoles, ownerLinkedAcc, salesLinkedAcc, customLinkedAcc,
      customPbiTabs, hasGlPage, customStmtCards, hasPlStmt,
      canUnlockUnitPrice, canUnlockQty, canUnlockFormulaTotals,
      lockedInitially, unlockedWithoutPin, hasModifyBtn, hasVoidBtn, overflowUsers
    };
  })()`);
  customRoleProbe && customRoleProbe.ok
    ? pass('roles, permissions & linked dashboards · default + Custom roles, Check Permissions matrix, field-level lock overrides without PIN, Modify Data & custom PBI/RDL', `PBI=${customRoleProbe.customPbiTabs}/12 · RDL=${customRoleProbe.customStmtCards}/22 · unlockUnitPrice=${customRoleProbe.unlockedWithoutPin} · modify=${customRoleProbe.hasModifyBtn}`)
    : fail('roles, permissions & linked dashboards', JSON.stringify(customRoleProbe));

  // 7c. Full 2024–2026 Historical Transactions + Power BI Date Grain/Range Slicer + Compact Paginated Tables
  await evaluate(`window.__navToView('pbi')`); await sleep(200);
  await evaluate(`document.querySelector('[data-pbi-page="p06_ar"]').click()`); await sleep(250);
  const pbiHistoryProbe = await evaluate(`(() => {
    const rec = window.MFG_SEED.records;
    const salesCnt = (rec.sales_tickets || []).length;
    const rawCnt = (rec.raw_purchases || []).length;
    const minSalesDate = (rec.sales_tickets || []).reduce((m, r) => (r.date && r.date < m ? r.date : m), '9999-99-99');

    // Check compact paginated tables on P06
    const tables = Array.from(document.querySelectorAll('#pbiCanvasPanel table.ledger-table'));
    const maxBodyRows = Math.max(...tables.map(t => t.querySelectorAll('tbody tr').length));
    const pagers = document.querySelectorAll('#pbiCanvasPanel .pbi-pager').length;
    const wrapMaxH = getComputedStyle(document.querySelector('#pbiCanvasPanel .table-wrap')).maxHeight;

    // Click Next page on the first paginated table on P06
    const nextBtn = document.querySelector('#pbiCanvasPanel .pbi-pager [data-pbi-page-target="1"]');
    if (nextBtn) nextBtn.click();
    const page2Text = (document.querySelector('#pbiCanvasPanel .pbi-pager .pbi-pager-info') || {}).textContent || '';

    // Test grain buttons (Year, Month, Week, Day) & custom From-To range
    document.querySelector('[data-pbi-grain="year"]').click();
    const yearOpts = document.getElementById('pbiPeriodSelect').options.length;
    const yearOptgroups = document.getElementById('pbiPeriodSelect').querySelectorAll('optgroup').length;
    const topYearOptgroups = (document.getElementById('periodSelect') || document.createElement('select')).querySelectorAll('optgroup').length;
    document.querySelector('[data-pbi-grain="month"]').click();
    const monthOpts = document.getElementById('pbiPeriodSelect').options.length;
    document.querySelector('[data-pbi-grain="week"]').click();
    const weekOpts = document.getElementById('pbiPeriodSelect').options.length;
    document.querySelector('[data-pbi-grain="day"]').click();
    const dayOpts = document.getElementById('pbiPeriodSelect').options.length;

    // Verify dynamic real-time presets rollover (Oct 2026 -> Nov 2026 -> Jan 2027) & no static FY year rows in presets
    const dtApi = window.MFG_DATE_TEST;
    const catOct = dtApi ? dtApi.catalogFor('2026-10-22') : null;
    const catNov = dtApi ? dtApi.catalogFor('2026-11-15') : null;
    const catJan = dtApi ? dtApi.catalogFor('2027-01-10') : null;
    const findPre = (cat, v) => (cat && cat.all ? cat.all.find(o => o.value === v) : null);
    const hasYearRowsInPresets = Boolean(catOct && catOct.all.some(o => /^fy202[0-9]$/i.test(o.value) || /Full Year/i.test(o.label)));
    const octMtd = findPre(catOct, 'mtd');
    const octPrev1 = findPre(catOct, 'prev_m1');
    const novMtd = findPre(catNov, 'mtd');
    const novPrev1 = findPre(catNov, 'prev_m1');
    const novPrev2 = findPre(catNov, 'prev_m2');
    const janMtd = findPre(catJan, 'mtd');
    const janPrev1 = findPre(catJan, 'prev_m1');
    const janQtd = findPre(catJan, 'qtd');
    const janLastQ = findPre(catJan, 'last_q');
    const janYtd = findPre(catJan, 'ytd');
    const dynamicRolloverOk = Boolean(
      yearOptgroups === 0 && topYearOptgroups === 0 && !hasYearRowsInPresets &&
      octMtd && octMtd.label === 'October 2026 (MTD)' && octPrev1 && octPrev1.label === 'September 2026' &&
      novMtd && novMtd.label === 'November 2026 (MTD)' && novMtd.from === '2026-11-01' && novMtd.to === '2026-11-30' &&
      novPrev1 && novPrev1.label === 'October 2026' && novPrev1.from === '2026-10-01' && novPrev1.to === '2026-10-31' &&
      novPrev2 && novPrev2.label === 'September 2026' &&
      janMtd && janMtd.label === 'January 2027 (MTD)' && janPrev1 && janPrev1.label === 'December 2026' &&
      janQtd && /Q1 2027/.test(janQtd.label) && janLastQ && /Q4 2026/.test(janLastQ.label) && janYtd && /2027 YTD/.test(janYtd.label)
    );

    // Test custom date range 2024-06-01 .. 2024-06-30
    const df = document.getElementById('pbiDateFrom');
    const dt = document.getElementById('pbiDateTo');
    df.value = '2024-06-01'; df.dispatchEvent(new Event('change', { bubbles: true }));
    dt.value = '2024-06-30'; dt.dispatchEvent(new Event('change', { bubbles: true }));
    const rangeMeta = (document.querySelector('.pbi-slicer-meta') || {}).textContent || '';

    // Reset back to All-Time
    const rst = document.getElementById('pbiDateResetBtn');
    if (rst) rst.click();
    const resetFrom = (document.getElementById('dateFromInput') || {}).value || '';
    const resetTo = (document.getElementById('dateToInput') || {}).value || '';
    const maxAttr = (document.getElementById('dateToInput') || {}).max || '';
    const overflowP06 = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);

    return {
      salesCnt, rawCnt, minSalesDate,
      maxBodyRows, pagers, wrapMaxH, page2Text,
      yearOpts, monthOpts, weekOpts, dayOpts,
      dynamicRolloverOk, novPrev1Label: novPrev1 ? novPrev1.label : '', novMtdLabel: novMtd ? novMtd.label : '',
      rangeMeta, resetFrom, resetTo, maxAttr, overflowP06
    };
  })()`);
  pbiHistoryProbe.salesCnt >= 25000 && pbiHistoryProbe.rawCnt >= 24000 && pbiHistoryProbe.minSalesDate.startsWith('2024-01-')
    ? pass('history · full 2024–2026 Dataverse transactions unpacked', `sales=${pbiHistoryProbe.salesCnt}, raw=${pbiHistoryProbe.rawCnt}, earliest=${pbiHistoryProbe.minSalesDate}`)
    : fail('history coverage', JSON.stringify(pbiHistoryProbe));
  pbiHistoryProbe.maxBodyRows <= 15 && pbiHistoryProbe.pagers >= 3 && /Page 2/.test(pbiHistoryProbe.page2Text) && pbiHistoryProbe.wrapMaxH !== 'none'
    ? pass('pbiTable · compact 15-row pages, bounded scroll & interactive pager', `${pbiHistoryProbe.pagers} pagers, maxRows=${pbiHistoryProbe.maxBodyRows}, maxH=${pbiHistoryProbe.wrapMaxH}`)
    : fail('pbiTable pagination', JSON.stringify(pbiHistoryProbe));
  pbiHistoryProbe.yearOpts === 7 && pbiHistoryProbe.monthOpts >= 84 && pbiHistoryProbe.weekOpts >= 360 && pbiHistoryProbe.dayOpts >= 700 && pbiHistoryProbe.dynamicRolloverOk && /2024-06-01/.test(pbiHistoryProbe.rangeMeta) && pbiHistoryProbe.resetFrom === '2024-01-01' && pbiHistoryProbe.resetTo === '2030-12-31' && pbiHistoryProbe.maxAttr === '2030-12-31' && pbiHistoryProbe.overflowP06 === 0
    ? pass('date slicer · dynamic real-time presets (no Quick Presets header / no FY year rows; Nov rolls to Oct) + 2024–2030 grains', `Y=${pbiHistoryProbe.yearOpts}, M=${pbiHistoryProbe.monthOpts}, Nov=[${pbiHistoryProbe.novMtdLabel}, ${pbiHistoryProbe.novPrev1Label}]`)
    : fail('date slicer grains/range', JSON.stringify(pbiHistoryProbe));

  // 7d. Sticky tfoot Totals, Unjammed P04 Tables & Collapsible Left Rail (Manufacturing Command)
  await evaluate(`document.querySelector('[data-pbi-page="p04_sales"]').click()`); await sleep(250);
  const p04LayoutAndFoot = await evaluate(`(() => {
    const tables = Array.from(document.querySelectorAll('#pbiCanvasPanel table.ledger-table'));
    const tfoots = tables.map(t => {
      const tf = t.querySelector('tfoot tr');
      return tf ? tf.innerText.replace(/\\s+/g, ' ').trim() : '';
    });
    const allHaveTfoot = tables.length >= 2 && tfoots.every(txt => /TOTAL/i.test(txt) && /\\$[0-9]/.test(txt));
    // Verify no cell breaks 'Litres' mid-word across lines
    const brokenLitres = Array.from(document.querySelectorAll('#pbiCanvasPanel td')).some(td => {
      const txt = (td.innerText || '').trim();
      return /Litre\\s*\\n\\s*s/i.test(txt);
    });
    return { tableCount: tables.length, allHaveTfoot, sampleFoot: tfoots[0] || '', brokenLitres };
  })()`);
  p04LayoutAndFoot.allHaveTfoot && !p04LayoutAndFoot.brokenLitres
    ? pass('pbi P04 · all tables have sticky tfoot TOTAL row & zero mid-word wrapping', `${p04LayoutAndFoot.tableCount} tables · ${p04LayoutAndFoot.sampleFoot.slice(0, 70)}`)
    : fail('pbi P04 tfoot / wrapping', JSON.stringify(p04LayoutAndFoot));

  // 7d-2. Analytics & Insights Rename + 8 Moved Pages & Dedicated Horizontal Analytics Sub-Tabs (Zero Stacked Analytics on Operational Registers)
  const modAnalyticsProbe = await evaluate(`(() => {
    window.__navToView('pbi');
    const pbiTitle = (document.querySelector('.pbi-studio-title') || {}).textContent || '';
    const pbiTopTitle = (document.getElementById('topbarTitle') || {}).textContent || '';
    const pbiPageCount = document.querySelectorAll('.pbi-page-tab[data-pbi-page]').length;
    const movedJumpCount = document.querySelectorAll('.pbi-studio-hdr [data-pbi-jump]').length;

    // Test jumping from Analytics & Insights to a moved page (p18_tickets -> Sales Analytics sub-tab)
    const jumpTickets = document.querySelector('.pbi-studio-hdr [data-pbi-jump="p18_tickets"]');
    if (jumpTickets) jumpTickets.click();
    const afterJumpTopTitle = (document.getElementById('topbarTitle') || {}).textContent || '';
    const salesHubPresent = !!document.querySelector('#workspace .mod-analytics-hub[data-mod-hub="sales_analytics"]');

    // Verify operational register tabs have ZERO stacked .mod-analytics-hub at the bottom
    const opsViews = ['sales', 'raw', 'fleet', 'pricing', 'customers', 'suppliers', 'expenses', 'payroll', 'ledger'];
    const noStackedOnOps = opsViews.every(v => {
      window.__navToView(v);
      return !document.querySelector('#workspace .mod-analytics-hub');
    });

    // Verify all 9 dedicated analytics/audit/recon sub-views render their .mod-analytics-hub with KPIs, charts/tables & 0px overflow
    const modViews = ['sales_analytics', 'sales_vat', 'raw_analytics', 'fleet_analytics', 'expenses_analytics', 'payroll_analytics', 'ledger_treasury', 'sentinels', 'statements'];
    const modResults = [];
    for (const v of modViews) {
      window.__navToView(v);
      const hub = document.querySelector('#workspace .mod-analytics-hub[data-mod-hub="' + v + '"]');
      const kpis = hub ? hub.querySelectorAll('.pbi-kpi-card').length : 0;
      const panels = hub ? hub.querySelectorAll('.pbi-panel').length : 0;
      const overflow = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);
      modResults.push({ v, hasHub: !!hub, kpis, panels, overflow });
    }
    const allModsOk = modResults.every(r => r.hasHub && r.kpis >= 4 && r.panels >= 1 && r.overflow === 0);

    // Verify Collapse -> Expand Insights toggle round-trip & last-section restoration on #sales_analytics
    window.__navToView('sales_analytics');
    const secAnalyticsBtn = document.querySelector('#workspace .mod-analytics-hub[data-mod-hub="sales_analytics"] [data-mod-sec="analytics"]');
    if (secAnalyticsBtn) secAnalyticsBtn.click();
    const collapseBtn = document.querySelector('#workspace .mod-analytics-hub[data-mod-hub="sales_analytics"] [data-mod-toggle="collapse"]');
    if (collapseBtn) collapseBtn.click();
    const collapsedHub = document.querySelector('#workspace .mod-analytics-hub[data-mod-hub="sales_analytics"]');
    const collapsedBodyAbsent = !!(collapsedHub && !collapsedHub.querySelector('.mod-analytics-body'));
    const expandBtn = collapsedHub ? collapsedHub.querySelector('[data-mod-toggle="expand"]') : null;
    const expandBtnText = expandBtn ? expandBtn.textContent.trim() : '';
    if (expandBtn) expandBtn.click();
    const expandedHub = document.querySelector('#workspace .mod-analytics-hub[data-mod-hub="sales_analytics"]');
    const expandedBodyPresent = !!(expandedHub && expandedHub.querySelector('.mod-analytics-body'));
    const restoredAnalyticsPane = !!(expandedHub && expandedHub.querySelector('[data-mod-sec-pane="analytics"]'));
    const expandedKpis = expandedHub ? expandedHub.querySelectorAll('.pbi-kpi-card').length : 0;
    const collapseRestored = !!(expandedHub && expandedHub.querySelector('[data-mod-toggle="collapse"]'));
    // Restore default tickets section cleanly
    const secTicketsBtn = expandedHub ? expandedHub.querySelector('[data-mod-sec="tickets"]') : null;
    if (secTicketsBtn) secTicketsBtn.click();
    const expandToggleOk = collapsedBodyAbsent && expandBtnText.includes('Expand Insights') && expandedBodyPresent && restoredAnalyticsPane && expandedKpis >= 4 && collapseRestored;

    return {
      ok: pbiTitle === 'Analytics & Insights' && pbiTopTitle === 'Analytics & Insights' &&
          pbiPageCount === 12 && movedJumpCount === 8 &&
          afterJumpTopTitle === 'Sales Analytics' && salesHubPresent && noStackedOnOps && allModsOk && expandToggleOk,
      pbiTitle, pbiPageCount, movedJumpCount, afterJumpTopTitle, salesHubPresent, noStackedOnOps, expandToggleOk, modResults
    };
  })()`);
  modAnalyticsProbe && modAnalyticsProbe.ok
    ? pass('Analytics & Insights · 12 core pages + 8 moved pages routed to dedicated Analytics sub-tabs (0 stacked analytics on operational registers)', `studio=${modAnalyticsProbe.pbiPageCount} pages · moved=${modAnalyticsProbe.movedJumpCount} · hubs=${modAnalyticsProbe.modResults.length}/10`)
    : fail('Analytics & Insights + dedicated analytics sub-tabs', JSON.stringify(modAnalyticsProbe));

  if (!MOBILE) {
    const railToggleProbe = await evaluate(`(() => {
      const shell = document.getElementById('appShell');
      const sidebar = document.getElementById('sidebar');
      const main = document.querySelector('.main-area');
      const collapseBtn = document.getElementById('railCollapseBtn');
      const narrowBtn = document.getElementById('railNarrowBtn');
      const widerBtn = document.getElementById('railWiderBtn');
      const resizer = document.getElementById('railResizer');
      const topToggleBtn = document.getElementById('mobileMenuBtn');
      const railDefaultW = Math.round(sidebar.getBoundingClientRect().width);
      narrowBtn.click();
      narrowBtn.click();
      const railNarrowW = Math.round(sidebar.getBoundingClientRect().width);
      widerBtn.click();
      widerBtn.click();
      widerBtn.click();
      widerBtn.click();
      const railWideW = Math.round(sidebar.getBoundingClientRect().width);
      resizer.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      const railResetW = Math.round(sidebar.getBoundingClientRect().width);
      // Verify brand header buttons never touch or overlap "MANUFACTURING COMMAND" or "ISABI SYSTEMS"
      const wmRect = document.querySelector('.brand-wordmark').getBoundingClientRect();
      const subRect = document.querySelector('.brand-sub').getBoundingClientRect();
      const actRect = document.querySelector('.rail-head-actions').getBoundingClientRect();
      const btnRect = collapseBtn.getBoundingClientRect();
      const brandClearanceOk = (actRect.left - wmRect.right >= 12) && (subRect.top - actRect.bottom >= 6) && (btnRect.left - subRect.right >= 8);
      // Verify sticky tfoot uses separate border-collapse with zero bottom bleed-through gap
      const sampleTable = document.querySelector('table.ledger-table');
      const borderCollapseMode = sampleTable ? getComputedStyle(sampleTable).borderCollapse : '';
      const wBefore = main.getBoundingClientRect().width;
      collapseBtn.click();
      const collapsedClass = shell.classList.contains('rail-collapsed');
      const wCollapsed = main.getBoundingClientRect().width;
      const overflowCollapsed = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);
      topToggleBtn.click();
      const restoredClass = !shell.classList.contains('rail-collapsed');
      const wRestored = main.getBoundingClientRect().width;

      // Verify Tx Date / Rep Date (#basisSwitch) stays on the exact same row & position when filtering by any date grain or custom range
      const basisPos = () => {
        const b = document.getElementById('basisSwitch').getBoundingClientRect();
        const c = document.getElementById('companySwitch').getBoundingClientRect();
        return { top: Math.round(b.top), left: Math.round(b.left), sameRowAsCompany: Math.abs(b.top - c.top) <= 6 };
      };
      document.querySelector('#grainSwitch [data-grain="all"]').click();
      const posAll = basisPos();
      document.querySelector('#grainSwitch [data-grain="day"]').click();
      const posDay = basisPos();
      document.querySelector('#grainSwitch [data-grain="year"]').click();
      const posYear = basisPos();
      const df = document.getElementById('dateFromInput');
      df.value = '2026-06-01'; df.dispatchEvent(new Event('change', { bubbles: true }));
      const posCustom = basisPos();
      document.getElementById('dateRangeResetBtn').click();
      const basisBtns = Array.from(document.querySelectorAll('#basisSwitch .basis-btn')); const basisOrderOk = basisBtns.map(b => b.getAttribute('data-basis')).join(',') === 'rep,tx' && basisBtns[0].classList.contains('active'); const basisStable = basisOrderOk && posAll.sameRowAsCompany && posAll.top === posDay.top && posAll.top === posYear.top && posAll.top === posCustom.top && posAll.left === posDay.left && posAll.left === posCustom.left;

      return {
        railDefaultW,
        railNarrowW,
        railWideW,
        railResetW,
        brandClearanceOk,
        borderCollapseMode,
        collapsedClass,
        restoredClass,
        gainedPx: Math.round(wCollapsed - wBefore),
        restoredDiff: Math.round(Math.abs(wRestored - wBefore)),
        overflowCollapsed,
        basisStable
      };
    })()`);
    railToggleProbe.collapsedClass && railToggleProbe.restoredClass && railToggleProbe.gainedPx >= 220 && railToggleProbe.overflowCollapsed === 0 && railToggleProbe.railNarrowW < railToggleProbe.railDefaultW && railToggleProbe.railWideW > railToggleProbe.railDefaultW && railToggleProbe.railResetW === railToggleProbe.railDefaultW && railToggleProbe.brandClearanceOk && railToggleProbe.borderCollapseMode === 'separate' && railToggleProbe.basisStable
      ? pass('desktop sidebar resize & toggle · wider/narrower + drag resizer + collapse + brand clearance + sticky tfoot + locked Tx/Rep Date bar', `narrow ${railToggleProbe.railNarrowW}px · default ${railToggleProbe.railDefaultW}px · wide ${railToggleProbe.railWideW}px · +${railToggleProbe.gainedPx}px collapsed · basisStable=${railToggleProbe.basisStable}`)
      : fail('desktop sidebar resize & toggle', JSON.stringify(railToggleProbe));
  }

  // 7b. Light vs. Dark mode full-surface visual parity (zero dark navy holdovers in Light mode)
  const themeParity = await evaluate(`(() => {
    const lum = bg => {
      const m = String(bg || '').match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
      if (!m) return 128;
      return 0.2126 * Number(m[1]) + 0.7152 * Number(m[2]) + 0.0722 * Number(m[3]);
    };
    const btn = document.getElementById('${MOBILE ? 'mobileThemeBtn' : 'themeToggleBtn'}');
    if (document.documentElement.getAttribute('data-theme') !== 'light' && btn) btn.click();

    window.__navToView('pbi');
    const pbiLight = {
      rail: lum(getComputedStyle(document.getElementById('sidebar')).backgroundColor),
      hubSubtabBar: lum(getComputedStyle(document.getElementById('hubSubtabBar')).backgroundColor),
      pbiHdr: lum(getComputedStyle(document.querySelector('.pbi-studio-hdr')).backgroundColor),
      pbiTab: lum(getComputedStyle(document.querySelector('.pbi-page-tab:not(.active)')).backgroundColor),
      pbiDateBar: lum(getComputedStyle(document.querySelector('.pbi-date-slicer-row')).backgroundColor),
      pbiSlicerSelect: lum(getComputedStyle(document.querySelector('.pbi-slicer-item select')).backgroundColor),
      aiDrawer: lum(getComputedStyle(document.getElementById('aiDrawer')).backgroundColor),
      authCard: lum(getComputedStyle(document.querySelector('.auth-card')).backgroundColor)
    };
    window.__navToView('sales');
    const salesLight = {
      cockpitBanner: lum(getComputedStyle(document.querySelector('.cockpit-banner')).backgroundColor)
    };
    window.__navToView('statements');
    const rdlLight = {
      rdlHdr: lum(getComputedStyle(document.querySelector('.rdl-suite-hdr')).backgroundColor),
      rdlTabs: lum(getComputedStyle(document.querySelector('.rdl-tab-bar')).backgroundColor)
    };
    window.__navToView('users');
    const usersLight = {
      enrolViewport: lum(getComputedStyle(document.querySelector('.enrol-cam-viewport')).backgroundColor),
      enrolPlaceholderTitle: lum(getComputedStyle(document.querySelector('.enrol-cam-placeholder-title')).color) < 60 ? 250 : 0
    };

    if (btn) btn.click(); // switch to Dark mode
    const usersDark = {
      enrolViewport: lum(getComputedStyle(document.querySelector('.enrol-cam-viewport')).backgroundColor),
      enrolPlaceholderTitle: lum(getComputedStyle(document.querySelector('.enrol-cam-placeholder-title')).color) > 200 ? 15 : 255
    };
    window.__navToView('statements');
    const rdlDark = {
      rdlHdr: lum(getComputedStyle(document.querySelector('.rdl-suite-hdr')).backgroundColor),
      rdlTabs: lum(getComputedStyle(document.querySelector('.rdl-tab-bar')).backgroundColor)
    };
    window.__navToView('sales');
    const salesDark = {
      cockpitBanner: lum(getComputedStyle(document.querySelector('.cockpit-banner')).backgroundColor)
    };
    window.__navToView('pbi');
    const pbiDark = {
      rail: lum(getComputedStyle(document.getElementById('sidebar')).backgroundColor),
      hubSubtabBar: lum(getComputedStyle(document.getElementById('hubSubtabBar')).backgroundColor),
      pbiHdr: lum(getComputedStyle(document.querySelector('.pbi-studio-hdr')).backgroundColor),
      pbiTab: lum(getComputedStyle(document.querySelector('.pbi-page-tab:not(.active)')).backgroundColor),
      pbiDateBar: lum(getComputedStyle(document.querySelector('.pbi-date-slicer-row')).backgroundColor),
      pbiSlicerSelect: lum(getComputedStyle(document.querySelector('.pbi-slicer-item select')).backgroundColor),
      aiDrawer: lum(getComputedStyle(document.getElementById('aiDrawer')).backgroundColor),
      authCard: lum(getComputedStyle(document.querySelector('.auth-card')).backgroundColor)
    };

    if (btn) btn.click(); // restore Light mode
    window.__navToView('overview');

    const lightVals = { ...pbiLight, ...salesLight, ...rdlLight, ...usersLight };
    const darkVals = { ...pbiDark, ...salesDark, ...rdlDark, ...usersDark };
    const allLightOk = Object.values(lightVals).every(v => v > 220);
    const allDarkOk = Object.values(darkVals).every(v => v < 50);
    return { allLightOk, allDarkOk, lightVals, darkVals };
  })()`);
  themeParity && themeParity.allLightOk && themeParity.allDarkOk
    ? pass('theme parity · Light mode vs Dark mode across rail, PBI studio, slicers, module banners, RDL suite, AI drawer & auth card', `light minLum=${Math.round(Math.min(...Object.values(themeParity.lightVals)))} (>220) · dark maxLum=${Math.round(Math.max(...Object.values(themeParity.darkVals)))} (<50)`)
    : fail('theme parity · Light vs Dark', JSON.stringify(themeParity));

  // 7c. Contextual Universal Registries ("All BUs" sub-tabs + inline registry pills), All-BU consistency & form separation
  const univProbe = await evaluate(`(() => {
    // 1. Sidebar retired separate "Universal Registries" section; all 8 reg_* views + 3 inline registries live inside contextual parent hubs
    const navGrps = Array.from(document.querySelectorAll('#sidebarNav .grp')).map(g => g.textContent.trim());
    const hasUnivSection = !navGrps.includes('Universal Registries');
    const regViews = ['reg_equipment', 'reg_drivers', 'reg_sites', 'reg_regions', 'reg_products', 'reg_customers', 'reg_suppliers', 'reg_categories'];
    const allSidebarTabsExist = regViews.every(v => {
      window.__navToView(v);
      const expectedKey = v === 'reg_equipment' ? 'equipment'
        : v === 'reg_drivers' ? 'drivers'
        : v === 'reg_sites' ? 'sites'
        : v === 'reg_regions' ? 'regions'
        : v === 'reg_products' ? 'products'
        : v === 'reg_customers' ? 'customers'
        : v === 'reg_suppliers' ? 'suppliers'
        : 'expense_categories';
      const meta = (window.MFG_PBI.TABLE_CATALOG || []).find(t => t.key === expectedKey);
      const topbarTitle = (document.getElementById('topbarTitle')?.textContent || '').trim();
      const docTitlePrefix = (document.title || '').split(' · ')[0].trim();
      const firstPanel = document.querySelector('#workspace .panel-card');
      const subBar = document.getElementById('hubSubtabBar');
      const noTopBloat = Boolean(subBar && firstPanel && firstPanel.id === 'univRegPanel' && !document.querySelector('#workspace .cockpit-banner') && !document.getElementById('univRegTabBar') && !document.getElementById('fleetCounterpartyGuide'));
      return Boolean(meta && topbarTitle === meta.label && docTitlePrefix === meta.label && noTopBloat);
    });
    // Also verify the 3 inline registry pills (product_types, uoms, expense_subcategories)
    window.__navToView('reg_customers');
    const ptPill = document.querySelector('[data-univ-reg-key="product_types"]');
    if (ptPill) ptPill.click();
    const ptTitleOk = (document.getElementById('topbarTitle')?.textContent || '').trim() === ((window.MFG_PBI.TABLE_CATALOG.find(t => t.key === 'product_types') || {}).label || '');
    const uomPill = document.querySelector('[data-univ-reg-key="uoms"]');
    if (uomPill) uomPill.click();
    const uomTitleOk = (document.getElementById('topbarTitle')?.textContent || '').trim() === ((window.MFG_PBI.TABLE_CATALOG.find(t => t.key === 'uoms') || {}).label || '');
    window.__navToView('reg_categories');
    const subcatPill = document.querySelector('[data-univ-reg-key="expense_subcategories"]');
    if (subcatPill) subcatPill.click();
    const subcatTitleOk = (document.getElementById('topbarTitle')?.textContent || '').trim() === ((window.MFG_PBI.TABLE_CATALOG.find(t => t.key === 'expense_subcategories') || {}).label || '');
    const inlinePillsOk = ptTitleOk && uomTitleOk && subcatTitleOk;

    // 2. Fleet & Diesel Control (#fleet) no longer mixes Universal Equipment & Driver Registry onto a BU page
    window.__navToView('fleet');
    const fleetHasOldUnivPanel = Boolean(document.getElementById('driverPanel')) || /UNIVERSAL EQUIPMENT & DRIVER REGISTRY/i.test(document.getElementById('workspace').innerText);
    const fleetHasBuAssignPanel = Boolean(document.getElementById('coFleetAssignPanel'));

    // 3. TABLE_CATALOG groups all 11 universal registries in "3 · Universal Registries (All BUs)" and separates BU-specific company_equipment / company_drivers
    const cat = window.MFG_PBI.TABLE_CATALOG;
    const univGroupTables = cat.filter(t => t.group === '3 · Universal Registries (All BUs)').map(t => t.key);
    const expectedUniv = ['equipment', 'drivers', 'sites', 'regions', 'products', 'product_types', 'uoms', 'customers', 'suppliers', 'expense_categories', 'expense_subcategories'];
    const catalogGroupedCleanly = univGroupTables.length === 11 && expectedUniv.every(k => univGroupTables.includes(k)) &&
      !univGroupTables.includes('company_equipment') && !univGroupTables.includes('company_drivers');

    // 4. Universal Registries stay 100% consistent across BU switches (WTC vs BBConstruction vs All Group) with table panel directly at top
    window.__navToView('reg_equipment');
    const noRedundantBoxes = !document.querySelector('#workspace .cockpit-banner') && !document.getElementById('univRegTabBar') && !document.getElementById('fleetCounterpartyGuide');
    document.querySelector('#companySwitch .entity-btn[data-company="wtc"]').click();
    const wtcCountTxt = document.querySelector('#univRegPanel [data-tbl-view="all"]')?.textContent || '';
    const wtcTitle = document.getElementById('topbarTitle')?.textContent?.trim();
    document.querySelector('#companySwitch .entity-btn[data-company="bbconstruction"]').click();
    const bbcCountTxt = document.querySelector('#univRegPanel [data-tbl-view="all"]')?.textContent || '';
    document.querySelector('#companySwitch .entity-btn[data-company="manufacturing-group"]').click();
    const allCountTxt = document.querySelector('#univRegPanel [data-tbl-view="all"]')?.textContent || '';
    const connLblTxt = document.querySelector('#univRegPanel .pa-hub-conns .pa-hub-lbl')?.textContent?.trim() || '';
    const connLabelClean = connLblTxt === 'Connected Tables:' && !/1:N|N:1/i.test(connLblTxt);
    const consistentAcrossBUs = Boolean(noRedundantBoxes && wtcCountTxt && wtcCountTxt === bbcCountTxt && bbcCountTxt === allCountTxt && wtcTitle === 'Equipment & Trucks' && connLabelClean);

    // 5. Entry Desk Group 3 ("3. Universal Registries (6)") has only Universal Registries without Company (BU) * (#f_company), while companyequipment is in Group 4 (ops) with #f_company
    document.getElementById('newEntryBtn').click();
    const hqGrp = window.MFG_FORMS.FORM_GROUPS.find(g => g.id === 'hq');
    const opsGrp = window.MFG_FORMS.FORM_GROUPS.find(g => g.id === 'ops');
    const hqForms = (hqGrp?.forms || []).map(f => f.id);
    const opsForms = (opsGrp?.forms || []).map(f => f.id);
    const hqSeparatedCleanly = /Universal Registries/i.test(hqGrp?.label || '') &&
      hqForms.length === 6 && !hqForms.includes('companyequipment') && opsForms.includes('companyequipment');
    document.querySelector('[data-pa-group="hq"]').click();
    const hqHasNoCompanyField = hqForms.every(fid => {
      document.querySelector('.modal-tab[data-form="' + fid + '"]').click();
      return !document.getElementById('f_company');
    });
    document.querySelector('[data-pa-group="ops"]').click();
    document.querySelector('.modal-tab[data-form="companyequipment"]').click();
    const coEquipHasCompanyField = Boolean(document.getElementById('f_company'));

    // 6. Verify Universal Registry duplicate main-column guard blocks duplicates across Supplier ("Aahed Jomaa"), Customer, Product, Site, Equipment & Driver
    const setField = (id, v) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    document.querySelector('[data-pa-group="hq"]').click();
    const supCountBefore = (window.MFG_SEED.records.suppliers || []).length;
    document.querySelector('.modal-tab[data-form="supplier"]').click();
    setField('f_supplier', 'aahed jomaa');
    const supLiveDupHint = Boolean(document.querySelector('#modalBody .univ-dup-hint'));
    document.getElementById('dynSaveModalBtn').click();
    const supErrBox = document.getElementById('formErrors');
    const supDupBlocked = Boolean(supErrBox && !supErrBox.hidden && /already exists in the Universal Supplier Registry/i.test(supErrBox.innerText));
    const supCountAfter = (window.MFG_SEED.records.suppliers || []).length;
    const aahedRows = (window.MFG_SEED.records.suppliers || []).filter(s => s && String(s.name || '').trim().toLowerCase() === 'aahed jomaa');

    document.querySelector('.modal-tab[data-form="customer"]').click();
    setField('f_customer', (window.MFG_SEED.records.customers[0].name || window.MFG_SEED.records.customers[0].Customer));
    document.getElementById('dynSaveModalBtn').click();
    const custDupBlocked = Boolean(document.getElementById('formErrors') && !document.getElementById('formErrors').hidden && /already exists in the Universal Customer Registry/i.test(document.getElementById('formErrors').innerText));

    document.querySelector('.modal-tab[data-form="equipment"]').click();
    setField('f_truck', '339216');
    document.getElementById('dynSaveModalBtn').click();
    const eqDupBlocked = Boolean(document.getElementById('formErrors') && !document.getElementById('formErrors').hidden && /already exists in the Universal Equipment Registry/i.test(document.getElementById('formErrors').innerText));

    document.querySelector('.modal-tab[data-form="driver"]').click();
    setField('f_driver', 'Aahed Jomaa');
    document.getElementById('dynSaveModalBtn').click();
    const drvDupBlocked = Boolean(document.getElementById('formErrors') && !document.getElementById('formErrors').hidden && /already exists in the Universal Driver Registry/i.test(document.getElementById('formErrors').innerText));

    const univDupGuardOk = supLiveDupHint && supDupBlocked && supCountBefore >= 1166 && supCountAfter === supCountBefore && aahedRows.length === 1 && custDupBlocked && eqDupBlocked && drvDupBlocked;

    document.getElementById('closeModalBtn').click();
    window.__navToView('overview');

    return {
      hasUnivSection,
      allSidebarTabsExist: allSidebarTabsExist && inlinePillsOk,
      inlinePillsOk,
      fleetHasOldUnivPanel,
      fleetHasBuAssignPanel,
      catalogGroupedCleanly,
      noRedundantBoxes,
      consistentAcrossBUs,
      hqSeparatedCleanly,
      hqHasNoCompanyField,
      coEquipHasCompanyField,
      univDupGuardOk,
      supCountAfter,
      aahedCount: aahedRows.length
    };
  })()`);
  univProbe.hasUnivSection && univProbe.allSidebarTabsExist && !univProbe.fleetHasOldUnivPanel && univProbe.fleetHasBuAssignPanel &&
  univProbe.catalogGroupedCleanly && univProbe.noRedundantBoxes && univProbe.consistentAcrossBUs &&
  univProbe.hqSeparatedCleanly && univProbe.hqHasNoCompanyField && univProbe.coEquipHasCompanyField && univProbe.univDupGuardOk
    ? pass('universal registries · dedicated sidebar section (8 tabs) + table directly at top (no redundant banner/tab/guide boxes) + removed from BU Fleet page + All-BU consistency + Group 3 forms without BU field + duplicate main-column guard')
    : fail('universal registries separation', JSON.stringify(univProbe));

  // 7e. Unified 4-Kiosk Suite (Sales · Raw Material · Fuel & Lubricants · Attendance Biometric) + Bluetooth ESC/POS Printer (80mm/58mm · Priced/Unpriced)
  const kioskSuiteProbe = await evaluate(`(async () => {
    const K = window.MFG_KIOSK_TEST;
    const P = window.MFG_PRINT;
    if (!K || !P) return { ok: false, err: 'missing MFG_KIOSK_TEST or MFG_PRINT' };

    // 1. Open Kiosk 1: Sales Dispatch Kiosk
    K.switchKiosk('sales');
    K.setPrintConfig({ paperWidth: 80, priceMode: 'priced', channel: 'rawbt' });
    const salesTabsCount = document.querySelectorAll('#kioskControlDeck [data-kiosk-tab]').length;
    const salesLiveRoll80Priced = document.querySelector('#kioskLiveThermalPreview .thermal-paper-roll');
    const sales80PricedHasWidth = !!(salesLiveRoll80Priced && salesLiveRoll80Priced.classList.contains('paper-80mm'));
    const salesDraft = K.buildDraftRecord();
    const salesBytes80Priced = P.buildEscPosBytes('sales', salesDraft, { paperWidth: '80mm', priceMode: 'priced' });
    const salesHtml80Priced = P.renderThermalTicketHtml('sales', Object.assign({}, salesDraft, { qty: 24, unit_price: 12, price: 288, total: 288, total_ttc: 288 }), { paperWidth: '80mm', priceMode: 'priced' });

    // Toggle to 58mm + Unpriced Gate Pass (Preference 1 & Preference 2)
    K.setPrintConfig({ paperWidth: 58, priceMode: 'unpriced' });
    const salesLiveRoll58Unpriced = document.querySelector('#kioskLiveThermalPreview .thermal-paper-roll');
    const sales58UnpricedClass = !!(salesLiveRoll58Unpriced && salesLiveRoll58Unpriced.classList.contains('paper-58mm'));
    const salesBytes58Unpriced = P.buildEscPosBytes('sales', Object.assign({}, salesDraft, { qty: 24, unit_price: 12, price: 288, total: 288, total_ttc: 288 }), { paperWidth: '58mm', priceMode: 'unpriced' });
    const salesHtml58Unpriced = P.renderThermalTicketHtml('sales', Object.assign({}, salesDraft, { qty: 24, unit_price: 12, price: 288, total: 288, total_ttc: 288 }), { paperWidth: '58mm', priceMode: 'unpriced' });
    const salesUnpricedHidesDollars = !/\\$288\\.00/.test(salesHtml58Unpriced) && /GATE PASS/i.test(salesHtml58Unpriced);
    const salesPricedShowsDollars = /\\$288\\.00/.test(salesHtml80Priced);
    const salesOverflow = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);

    // 2. Open Kiosk 2: Raw Material Quarry Receiving Kiosk (Bluetooth Thermal Linked!)
    K.switchKiosk('raw');
    K.setPrintConfig({ paperWidth: 80, priceMode: 'priced' });
    const rawDraft = Object.assign({}, K.buildDraftRecord(), { qty: 30, unit_cost: 6, cost: 180, trans_unit_cost: 4, trans_cost: 120, total: 300 });
    const rawBytes80Priced = P.buildEscPosBytes('raw', rawDraft, { paperWidth: '80mm', priceMode: 'priced' });
    const rawHtml80Priced = P.renderThermalTicketHtml('raw', rawDraft, { paperWidth: '80mm', priceMode: 'priced' });
    const rawPricedShows2Legs = /Leg 1/i.test(rawHtml80Priced) && /Leg 2/i.test(rawHtml80Priced) && /\\$300\\.00/.test(rawHtml80Priced);

    K.setPrintConfig({ paperWidth: 58, priceMode: 'unpriced' });
    const rawBytes58Unpriced = P.buildEscPosBytes('raw', rawDraft, { paperWidth: '58mm', priceMode: 'unpriced' });
    const rawHtml58Unpriced = P.renderThermalTicketHtml('raw', rawDraft, { paperWidth: '58mm', priceMode: 'unpriced' });
    const rawUnpricedHidesDollars = !/\\$300\\.00/.test(rawHtml58Unpriced) && /SCALE QTY/i.test(rawHtml58Unpriced);
    const rawPrintRes = P.printThermalTicket('raw', rawDraft, { paperWidth: '80mm', priceMode: 'priced', openModal: true });
    const modalOpenAfterPrint = !document.getElementById('thermalPrintModal').hidden;
    P.closeThermalModal();
    const rawOverflow = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);

    // 3. Open Kiosk 3: Fuel & Lubricants Kiosk (Dispense + Bulk Tank Refill)
    K.switchKiosk('fuel', 'dispense');
    const fuelDispenseHasMeter = !!document.getElementById('f_meter');
    const fuelDraft = Object.assign({}, K.buildDraftRecord(), { litres: 125, odometer: 148200, meter_delta: 380 });
    const fuelBytes80 = P.buildEscPosBytes('fuel', fuelDraft, { paperWidth: '80mm', priceMode: 'priced' });
    const fuelHtml80 = P.renderThermalTicketHtml('fuel', fuelDraft, { paperWidth: '80mm', priceMode: 'priced' });
    const fuelSlipOk = /125\\.0 L/.test(fuelHtml80) && fuelBytes80.length > 200;
    K.switchKiosk('fuel', 'refill');
    const fuelRefillHasCategory = !!document.getElementById('f_category');
    const fuelOverflow = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);

    // 4. Open Kiosk 4: Attendance Biometric Kiosk (4:3 Camera + 4-Digit PIN + 2-Min Debounce + Direction Flip)
    K.switchKiosk('attendance');
    const attViewport = document.getElementById('kioskAttViewport');
    const attHasPinPad = document.querySelectorAll('#kioskAttPinPad [data-kiosk-pin-key]').length === 12;
    const punchRes1 = K.recordAttendancePunch({ staff: 'Sabah Kassab', method: 'PIN', bypassDebounce: true });
    // Immediate second punch within 120s should be debounced
    const punchResDebounce = K.recordAttendancePunch({ staff: 'Sabah Kassab', method: 'PIN' });
    // Instant flip direction button
    const dirBeforeFlip = punchRes1.punch ? punchRes1.punch.direction : '';
    const flipRes = K.flipPunchDirection(punchRes1.punch ? punchRes1.punch.id : '');
    const dirAfterFlip = flipRes.punch ? flipRes.punch.direction : '';
    const attOverflow = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);

    // 5. Locked Tablet Kiosk Shell Mode (PIN 2401)
    K.setKioskLock(true);
    const lockedBodyClass = document.body.classList.contains('kiosk-locked');
    const wrongPinUnlock = K.setKioskLock(false, '0000');
    const rightPinUnlock = K.setKioskLock(false, '2401');
    const unlockedBodyClass = !document.body.classList.contains('kiosk-locked');

    // Reset to Sales Kiosk 80mm Priced & return to Overview
    K.setPrintConfig({ paperWidth: 80, priceMode: 'priced' });
    K.switchKiosk('sales');
    window.__navToView('overview');

    return {
      ok: salesTabsCount === 4 && sales80PricedHasWidth && sales58UnpricedClass &&
          salesBytes80Priced.length > 300 && salesBytes58Unpriced.length > 250 &&
          salesPricedShowsDollars && salesUnpricedHidesDollars &&
          rawBytes80Priced.length > 300 && rawBytes58Unpriced.length > 250 &&
          rawPricedShows2Legs && rawUnpricedHidesDollars && rawPrintRes.ok && modalOpenAfterPrint &&
          fuelDispenseHasMeter && fuelSlipOk && fuelRefillHasCategory &&
          !!attViewport && attHasPinPad && punchRes1.ok &&
          !punchResDebounce.ok && punchResDebounce.reason === 'debounced' &&
          flipRes.ok && dirBeforeFlip !== dirAfterFlip &&
          lockedBodyClass && !wrongPinUnlock && rightPinUnlock && unlockedBodyClass &&
          salesOverflow === 0 && rawOverflow === 0 && fuelOverflow === 0 && attOverflow === 0,
      salesTabsCount,
      salesBytes80: salesBytes80Priced.length,
      salesBytes58: salesBytes58Unpriced.length,
      rawBytes80: rawBytes80Priced.length,
      rawBytes58: rawBytes58Unpriced.length,
      fuelBytes80: fuelBytes80.length,
      salesPricedShowsDollars,
      salesUnpricedHidesDollars,
      rawPricedShows2Legs,
      rawUnpricedHidesDollars,
      debounced: punchResDebounce.reason,
      flipped: dirBeforeFlip + '->' + dirAfterFlip,
      lockedBodyClass,
      unlockedBodyClass,
      overflows: { salesOverflow, rawOverflow, fuelOverflow, attOverflow }
    };
  })()`);
  kioskSuiteProbe && kioskSuiteProbe.ok
    ? pass('4-kiosk suite & bluetooth thermal printer · Sales/Raw/Fuel/Attendance + 80mm/58mm ESC/POS + Priced vs Unpriced Gate Pass + 2m debounce & flip + Kiosk Lock', `sales=${kioskSuiteProbe.salesBytes80}B/80mm & ${kioskSuiteProbe.salesBytes58}B/58mm · raw=${kioskSuiteProbe.rawBytes80}B/80mm & ${kioskSuiteProbe.rawBytes58}B/58mm · att=${kioskSuiteProbe.flipped}`)
    : fail('4-kiosk suite & bluetooth thermal printer', JSON.stringify(kioskSuiteProbe));

  // 7f. Search-box & combobox first-click stability (no 120ms blur-timer closeAll race across sequential fields + DOM node preservation on #tableSearchInput)
  const searchFocusStability = await evaluate(`(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    window.__navToView('sales');
    await wait(80);

    // 1. Verify #tableSearchInput keeps exact DOM node reference & activeElement focus across debounced typing re-renders
    const searchBefore = document.getElementById('tableSearchInput');
    searchBefore.focus();
    searchBefore.value = 'Sabeh';
    searchBefore.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(220);
    const searchAfter = document.getElementById('tableSearchInput');
    const sameSearchDomNode = (searchBefore === searchAfter) && (document.activeElement === searchAfter);
    searchAfter.value = '';
    searchAfter.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(200);

    // 2. Open Sales Ticket modal, switch Sale Type to Delivery (as in user screenshot) and perform Product -> Customer -> Destination Site
    const openBtn = document.querySelector('[data-open-modal="sales"]');
    if (openBtn) openBtn.click();
    await wait(90);

    const fSaleType = document.getElementById('f_saletype');
    if (fSaleType) {
      fSaleType.value = 'Delivery';
      fSaleType.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const fProd = document.getElementById('f_product');
    const fCust = document.getElementById('f_customer');
    const fSite = document.getElementById('f_site');
    const prodMenu = fProd.closest('.pa-suggest-wrap').querySelector('.pa-suggest-menu');
    const custMenu = fCust.closest('.pa-suggest-wrap').querySelector('.pa-suggest-menu');
    const siteMenu = fSite.closest('.pa-suggest-wrap').querySelector('.pa-suggest-menu');

    // Click Product and pick first item while keeping focus on fProd (as mousedown preventDefault does)
    fProd.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fProd.focus();
    fProd.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const prodOpenedFirstClick = !prodMenu.hidden;
    const prodItem0 = prodMenu.querySelector('.pa-suggest-item');
    if (prodItem0) prodItem0.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));

    // Immediately click Customer (simulating user clicking next search box while fProd blurs and starts 120ms timer)
    fCust.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fCust.focus();
    fCust.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const custOpenedImmediately = !custMenu.hidden;
    await wait(180); // Wait past the 120ms blur timer of fProd!
    const custStayedOpenAfter180ms = !custMenu.hidden && document.activeElement === fCust;

    // Pick a customer from Customer menu
    const custItem0 = custMenu.querySelector('.pa-suggest-item');
    if (custItem0) custItem0.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));

    // Immediately click Destination Site (exact reproduction of user's screenshot!)
    fSite.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fSite.focus();
    fSite.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const siteOpenedImmediately = !siteMenu.hidden;
    await wait(180); // Wait past the 120ms blur timer of fCust!
    const siteStayedOpenAfter180ms = !siteMenu.hidden && document.activeElement === fSite;

    document.getElementById('closeModalBtn').click();
    window.__navToView('overview');

    return {
      ok: sameSearchDomNode && prodOpenedFirstClick && custOpenedImmediately && custStayedOpenAfter180ms && siteOpenedImmediately && siteStayedOpenAfter180ms,
      sameSearchDomNode,
      prodOpenedFirstClick,
      custOpenedImmediately,
      custStayedOpenAfter180ms,
      siteOpenedImmediately,
      siteStayedOpenAfter180ms
    };
  })()`);
  searchFocusStability && searchFocusStability.ok
    ? pass('search-box & combobox first-click stability · Product→Customer→Site sequential click stays open past 120ms blur timer + #tableSearchInput DOM node preserved', JSON.stringify(searchFocusStability))
    : fail('search-box & combobox first-click stability', JSON.stringify(searchFocusStability));

  // 7g. Command Center 2-word subtitle & Public Showcase navigation links (#railShowcaseLink in System & Access #users + #authShowcaseLink in auth gate)
  const showcaseBrandProbe = await evaluate(`(() => {
    window.__navToView('users');
    const brandSub = (document.querySelector('.brand-sub') || {}).textContent?.trim() || '';
    const panel = document.getElementById('systemShowcasePanel');
    const railLink = document.getElementById('railShowcaseLink');
    const inSystemUsers = Boolean(panel && railLink && panel.contains(railLink) && !document.querySelector('#sidebar #railShowcaseLink'));
    const hasWording = Boolean(panel && panel.querySelector('.system-showcase-title') && panel.querySelector('.system-showcase-sub'));
    const authLink = document.getElementById('authShowcaseLink');
    const railHref = railLink ? (railLink.getAttribute('href') || '') : '';
    const authHref = authLink ? (authLink.getAttribute('href') || '') : '';
    return {
      ok: brandSub === 'Command Center' && inSystemUsers && hasWording && !!railLink && !!authLink && (railHref === '../' || railHref === '/showcase/') && railHref === authHref && /ISABI Command Center/.test(document.title),
      brandSub,
      inSystemUsers,
      hasWording,
      railHref,
      authHref,
      docTitle: document.title
    };
  })()`);
  showcaseBrandProbe && showcaseBrandProbe.ok
    ? pass('Command Center branding & Public Showcase in System & Access · .brand-sub="Command Center" + #systemShowcasePanel (#railShowcaseLink) & #authShowcaseLink', `${showcaseBrandProbe.brandSub} · href=${showcaseBrandProbe.railHref}`)
    : fail('Command Center branding & Public Showcase navigation', JSON.stringify(showcaseBrandProbe));

  // 7h. Universal Record Void / Delete (inline row ✕ + 360° Record Inspector top Command Bar & footer + 1-click Undo restore + Role Gate: Supervisor / Admin / Custom only, blocked for Entry & Sales)
  const voidAnyRecordProbe = await evaluate(`(async () => {
    const T = window.MFG_FACE_TEST;
    const ownerCanVoid = T.canVoid('husseinbdeir@bhfirms.com') === true;
    const supEntryCanVoid = T.canVoid('zeinabrkein@bhfirms.com') === true;
    const supOnlyCanVoid = T.canVoid('site.bbc@bhfirms.com') === true;
    const entryBlocked = T.canVoid('sabahkassab@bhfirms.com') === false && T.canVoid('scale1.wtc@bhfirms.com') === false;
    const salesBlocked = T.canVoid('ar.mfg@bhfirms.com') === false;

    // Verify Entry seat (u3) renders 0 row-hover void buttons and 0 Record Inspector void buttons
    await T.performLogin('sabahkassab@bhfirms.com', '3333', { bypass2FA: true });
    window.__navToView('reg_equipment');
    const entryRow = document.querySelector('#univRegPanel tbody tr.rrow[data-rid]');
    const entryHasNoRowVoidBtn = !(entryRow && entryRow.querySelector('.void-btn'));
    if (entryRow) entryRow.click();
    const entryHasNoInspVoidBtns = !document.getElementById('inspCmdVoidBtn') && !document.getElementById('inspectorVoidBtn');
    const doneBtn = document.getElementById('inspectorDoneBtn');
    if (doneBtn) doneBtn.click();

    // Restore Owner session (u1) and test 2-click Void/Delete + 1-click Undo restore
    await T.performLogin('husseinbdeir@bhfirms.com', '1111', { bypass2FA: true });
    document.querySelector('#companySwitch .entity-btn[data-company="manufacturing-group"]').click();
    window.__navToView('reg_equipment');
    const countBefore = (window.MFG_SEED.records.equipment || []).length;
    const firstRow = document.querySelector('#univRegPanel tbody tr.rrow[data-rid]');
    const hasRowHoverVoidBtn = !!(firstRow && firstRow.querySelector('.void-btn[data-void="equipment"]'));
    if (firstRow) firstRow.click();
    const cmdVoidBtn = document.getElementById('inspCmdVoidBtn');
    const footVoidBtn = document.getElementById('inspectorVoidBtn');
    const hasBothInspectorVoidBtns = !!(cmdVoidBtn && footVoidBtn);
    // Click 1: arm confirmation
    if (cmdVoidBtn) cmdVoidBtn.click();
    const armedOk = !!(cmdVoidBtn && cmdVoidBtn.dataset.armed === '1' && /Confirm/i.test(cmdVoidBtn.textContent));
    // Click 2: execute void/delete
    if (cmdVoidBtn) cmdVoidBtn.click();
    const countAfterVoid = (window.MFG_SEED.records.equipment || []).length;
    const voidDecremented = countAfterVoid === countBefore - 1;
    // Click Undo in toast to restore cleanly
    const undoBtn = document.getElementById('toastUndoBtn');
    const hasUndoBtn = !!undoBtn;
    if (undoBtn) undoBtn.click();
    const countAfterUndo = (window.MFG_SEED.records.equipment || []).length;
    const restoredOk = countAfterUndo === countBefore;
    const roleGatesOk = ownerCanVoid && supEntryCanVoid && supOnlyCanVoid && entryBlocked && salesBlocked && entryHasNoRowVoidBtn && entryHasNoInspVoidBtns;
    window.__navToView('overview');
    return {
      ok: roleGatesOk && hasRowHoverVoidBtn && hasBothInspectorVoidBtns && armedOk && voidDecremented && hasUndoBtn && restoredOk,
      roleGatesOk, ownerCanVoid, supEntryCanVoid, supOnlyCanVoid, entryBlocked, salesBlocked, entryHasNoRowVoidBtn, entryHasNoInspVoidBtns,
      countBefore, countAfterVoid, countAfterUndo, hasRowHoverVoidBtn, hasBothInspectorVoidBtns, armedOk, hasUndoBtn, restoredOk
    };
  })()`);
  voidAnyRecordProbe && voidAnyRecordProbe.ok
    ? pass('record void / delete & undo · Supervisor/Admin/Custom only (Entry & Sales blocked) + inline row ✕ + 360° Record Inspector top/footer 🗑 Void / Delete + 1-click Undo', `${voidAnyRecordProbe.countBefore} → ${voidAnyRecordProbe.countAfterVoid} → ${voidAnyRecordProbe.countAfterUndo} · entryBlocked=${voidAnyRecordProbe.entryBlocked}`)
    : fail('record void / delete & undo', JSON.stringify(voidAnyRecordProbe));

  // 7i. Interactive Table Column Manager (Hide / Show columns, Widen / Narrow columns, tfoot colspan sync, 1-click Default reset & automatic revert on view switch)
  const tableColMgrProbe = await evaluate(`(() => {
    window.__navToView('reg_equipment');
    const panel = document.getElementById('univRegPanel');
    const tbl = panel ? panel.querySelector('table.ledger-table') : null;
    if (!tbl || !window.MFG_TABLE_COLS) return { ok: false, reason: 'missing table or MFG_TABLE_COLS' };

    const mgrWrap = panel.querySelector('.tbl-col-mgr-wrap');
    const trigBtn = mgrWrap ? mgrWrap.querySelector('.tbl-col-trigger-btn') : null;
    const inlineResetBtn = mgrWrap ? mgrWrap.querySelector('.tbl-col-inline-reset') : null;
    const popover = mgrWrap ? mgrWrap.querySelector('.tbl-col-popover') : null;
    const ths = Array.from(tbl.querySelectorAll('thead tr th'));
    const hasResizersAndTools = ths.length >= 8 && ths.every(th => th.querySelector('.tbl-col-resizer') && th.querySelector('.tbl-th-tools'));

    const origW0 = Math.round(ths[0].getBoundingClientRect().width);
    const origW3 = Math.round(ths[3].getBoundingClientRect().width);
    const tfootFirstTd = tbl.querySelector('tfoot tr td:first-child');
    const origTfootColspan = Number(tfootFirstTd ? tfootFirstTd.getAttribute('colspan') : 0);

    // 1. Open Columns popover & hide col 1 (Co.) via checkbox + hide col 2 (Category) via header quick-tool
    trigBtn.click();
    const popOpened = popover && !popover.hidden;
    const chk1 = popover.querySelector('[data-col-toggle-idx="1"]');
    if (chk1) {
      chk1.checked = false;
      chk1.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const hideBtn2 = ths[2].querySelector('[data-th-hide="2"]');
    if (hideBtn2) hideBtn2.click();

    const col1Hidden = ths[1].classList.contains('tbl-col-hidden') && getComputedStyle(ths[1]).display === 'none';
    const col2Hidden = ths[2].classList.contains('tbl-col-hidden') && getComputedStyle(ths[2]).display === 'none';
    const bodyRow0 = tbl.querySelector('tbody tr');
    const bodyCellsHidden = bodyRow0 && getComputedStyle(bodyRow0.children[1]).display === 'none' && getComputedStyle(bodyRow0.children[2]).display === 'none';
    const tfootSpanAfterHide2 = Number(tfootFirstTd ? tfootFirstTd.getAttribute('colspan') : 0);

    // 2. Widen col 0 twice (+48px) and narrow col 3 once (-24px)
    const widen0 = popover.querySelector('[data-col-widen-idx="0"]');
    if (widen0) { widen0.click(); widen0.click(); }
    const narrow3 = popover.querySelector('[data-col-narrow-idx="3"]');
    if (narrow3) { narrow3.click(); }

    const widenedW0 = Math.round(ths[0].getBoundingClientRect().width);
    const narrowedW3 = Math.round(ths[3].getBoundingClientRect().width);
    const widenOk = widenedW0 >= origW0 + 40;
    const narrowOk = narrowedW3 <= origW3 - 18 || narrowedW3 === 34;
    const resetBtnVisible = inlineResetBtn && !inlineResetBtn.hidden;

    // 3. Click "Default" inline reset button -> verify immediate revert to default
    inlineResetBtn.click();
    const revertedHiddenCount = tbl.querySelectorAll('.tbl-col-hidden').length;
    const revertedHasResize = tbl.classList.contains('has-col-resize');
    const revertedTfootSpan = Number(tfootFirstTd ? tfootFirstTd.getAttribute('colspan') : 0);
    const revertedW0 = Math.round(ths[0].getBoundingClientRect().width);
    const manualResetOk = revertedHiddenCount === 0 && !revertedHasResize && revertedTfootSpan === origTfootColspan && Math.abs(revertedW0 - origW0) <= 2;

    // 4. Customize again (hide col 1 + widen col 0), then switch view to Drivers & back to Equipment -> verify automatic revert to default
    window.MFG_TABLE_COLS.toggleColumnVisible(tbl, 1, false);
    window.MFG_TABLE_COLS.nudgeColumnWidth(tbl, 0, 48);
    const customizedBeforeNav = tbl.querySelectorAll('.tbl-col-hidden').length > 0 && tbl.classList.contains('has-col-resize');

    window.__navToView('reg_drivers');
    window.__navToView('reg_equipment');

    const tblAfterNav = document.querySelector('#univRegPanel table.ledger-table');
    const autoRevertedOnNav = tblAfterNav && tblAfterNav.querySelectorAll('.tbl-col-hidden').length === 0 && !tblAfterNav.classList.contains('has-col-resize') && Number(tblAfterNav.querySelector('tfoot tr td:first-child').getAttribute('colspan')) === origTfootColspan;

    window.__navToView('overview');
    return {
      ok: hasResizersAndTools && popOpened && col1Hidden && col2Hidden && bodyCellsHidden &&
          origTfootColspan >= 3 && tfootSpanAfterHide2 === origTfootColspan - 2 &&
          widenOk && narrowOk && resetBtnVisible && manualResetOk &&
          customizedBeforeNav && autoRevertedOnNav,
      hasResizersAndTools, popOpened, col1Hidden, col2Hidden, bodyCellsHidden,
      origTfootColspan, tfootSpanAfterHide2,
      origW0, widenedW0, origW3, narrowedW3,
      manualResetOk, customizedBeforeNav, autoRevertedOnNav
    };
  })()`);
  tableColMgrProbe && tableColMgrProbe.ok
    ? pass('table column manager · hide/show columns (tfoot colspan 4→2), widen/narrow columns & revert to default (manual Default button + auto-revert on view switch)', `col0 ${tableColMgrProbe.origW0}px→${tableColMgrProbe.widenedW0}px · col3 ${tableColMgrProbe.origW3}px→${tableColMgrProbe.narrowedW3}px · tfoot colspan ${tableColMgrProbe.origTfootColspan}→${tableColMgrProbe.tfootSpanAfterHide2}→${tableColMgrProbe.origTfootColspan}`)
    : fail('table column manager', JSON.stringify(tableColMgrProbe));

  // 7j. Multi-Column Filter Engine, Clean Equipment Search ("truck"), Smart Sort Direction & Computed Column Sorting
  const multiColFilterProbe = await evaluate(`(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    window.__navToView('reg_equipment');
    await wait(60);

    // 1. Verify zero "(m89)" / "Merged trucks" internal migration tags remain in equipment notes
    const eqPool = window.MFG_SEED.records.equipment || [];
    const dirtyNotesCount = eqPool.filter(r => /Merged trucks|\\(m\\d+|Workbook status/i.test(String(r.notes || ''))).length;

    // 2. Reproduce exact user screenshot: click "Company Fleet" view chip, search "truck" -> must show ONLY Truck rows (20), zero Wheel Loader / Vehicle / Excavator
    const ownViewBtn = document.querySelector('#univRegPanel [data-tbl-view="own"]');
    if (ownViewBtn) ownViewBtn.click();
    const searchInp = document.getElementById('tableSearchInput');
    searchInp.value = 'truck';
    searchInp.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(220);

    const ownTruckTypes = Array.from(document.querySelectorAll('#univRegPanel tbody tr.rrow td:nth-child(4)')).map(td => td.textContent.trim());
    const ownTruckFoot = (document.querySelector('#univRegPanel tfoot tr')?.textContent || '').trim();
    const ownSearchOnlyTrucks = ownTruckTypes.length === 17 && ownTruckTypes.every(t => t === 'Truck') && ownTruckFoot.includes('TOTAL (17');

    // 3. Switch back to "All Trucks & Equipment" while searching "truck" -> all visible rows are Type = Truck
    const expectedAllTrucks = eqPool.filter(r => r.type === 'Truck').length.toLocaleString('en-US');
    const allViewBtn = document.querySelector('#univRegPanel [data-tbl-view="all"]');
    if (allViewBtn) allViewBtn.click();
    const allTruckTypes = Array.from(document.querySelectorAll('#univRegPanel tbody tr.rrow td:nth-child(4)')).map(td => td.textContent.trim());
    const allTruckFoot = (document.querySelector('#univRegPanel tfoot tr')?.textContent || '').trim();
    const allSearchOnlyTrucks = allTruckTypes.length > 0 && allTruckTypes.every(t => t === 'Truck') && allTruckFoot.includes('TOTAL (' + expectedAllTrucks);

    // Clear search
    const clearSearch = document.getElementById('tableSearchInput');
    clearSearch.value = '';
    clearSearch.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(220);

    // 4. Click "TYPE" column header -> first click sorts A → Z (asc: Excavator first), NOT Z → A (Wheel Loader first)
    const typeTh = document.querySelector('#univRegPanel th.sortable[data-sort-key="type"]');
    if (typeTh) typeTh.click();
    const firstTypeAfterClick = (document.querySelector('#univRegPanel tbody tr.rrow td:nth-child(4)')?.textContent || '').trim();
    const typeSortedAscFirst = firstTypeAfterClick === 'Excavator';

    // 5. Click "LOADS HAULED" column header -> sorts numerically descending by computed loads_hauled (top > 1,000)
    const loadsTh = document.querySelector('#univRegPanel th.sortable[data-sort-key="loads_hauled"]');
    if (loadsTh) loadsTh.click();
    const firstLoadsTxt = (document.querySelector('#univRegPanel tbody tr.rrow td:nth-child(9)')?.textContent || '').replace(/[^0-9]/g, '');
    const loadsSortedDescNumerically = Number(firstLoadsTxt) >= 1000;

    // 6. Multi-Column Filter Bar: combine Type = "Truck" + Co. = "WTC" + Ownership = "Own"
    const selType = document.querySelector('#univRegPanel .cf-select[data-cf-key="type"]');
    if (selType) { selType.value = 'Truck'; selType.dispatchEvent(new Event('change', { bubbles: true })); }
    const selCo = document.querySelector('#univRegPanel .cf-select[data-cf-key="companies_list"]');
    if (selCo) { selCo.value = 'WTC'; selCo.dispatchEvent(new Event('change', { bubbles: true })); }
    const selOwn = document.querySelector('#univRegPanel .cf-select[data-cf-key="ownership"]');
    if (selOwn) { selOwn.value = 'Own'; selOwn.dispatchEvent(new Event('change', { bubbles: true })); }

    const multiRows = Array.from(document.querySelectorAll('#univRegPanel tbody tr.rrow'));
    const multiAllMatch = (multiRows.length === 9 || multiRows.length === 10 || multiRows.length === 12 || multiRows.length === 13 || multiRows.length === 15) && multiRows.every(tr =>
      /WTC/i.test(tr.children[1].textContent) &&
      tr.children[3].textContent.trim() === 'Truck' &&
      /Own/i.test(tr.children[4].textContent)
    );
    const activePillsCount = document.querySelectorAll('#univRegPanel .cf-active-pill').length;

    // 7. Header Filter Popover: open on Capacity (m³), enter ">=25" and apply
    const capFilterBtn = document.querySelector('#univRegPanel [data-th-filter-key="capacity"]');
    if (capFilterBtn) capFilterBtn.click();
    const pop = document.getElementById('colFilterPopover');
    const popOpened = !!(pop && !pop.hidden);
    const popInp = document.getElementById('cfpSearchInput');
    if (popInp) {
      popInp.value = '>=25';
      document.getElementById('cfpApplyBtn').click();
    }
    const rowsCap25 = Array.from(document.querySelectorAll('#univRegPanel tbody tr.rrow'));
    const capFilterOk = rowsCap25.length > 0 && rowsCap25.length < multiRows.length && rowsCap25.every(tr => Number(tr.children[6].textContent.trim()) >= 25);

    // Clear all column filters via Reset All button
    const expectedTotalEq = eqPool.length.toLocaleString('en-US');
    const clearAllBtn = document.querySelector('#univRegPanel [data-cf-clear-all]');
    if (clearAllBtn) clearAllBtn.click();
    const restoredAllFoot = (document.querySelector('#univRegPanel tfoot tr')?.textContent || '').trim();
    const resetRestoredAll = restoredAllFoot.includes('TOTAL (' + expectedTotalEq);

    // 7b. Verify Suppliers & Haulers logical columns, role badges, 6 System Views, no redundant header/guide boxes, clean header hover, wide search box & custom pill popover
    window.__navToView('reg_suppliers');
    await wait(60);
    const noGuideOrBanner = !document.getElementById('fleetCounterpartyGuide') && !document.getElementById('univRegTabBar') && !document.querySelector('#workspace .cockpit-banner');
    const supViews = document.querySelectorAll('#univRegPanel [data-tbl-view]');
    const supHeaders = Array.from(document.querySelectorAll('#univRegPanel thead th')).map(th => th.textContent.replace(/⧩/g, '').trim());
    const supSearchEl = document.querySelector('#univRegPanel .table-toolbar .search-input');
    const supSearchPlaceholderClean = supSearchEl && supSearchEl.placeholder === 'Search Suppliers & Haulers...';
    const supSearchWidthOk = Boolean(supSearchEl && (window.innerWidth < 768 || supSearchEl.getBoundingClientRect().width >= 235));
    const methodTh = document.querySelector('#univRegPanel th[data-sort-key="method"]');
    const methodFilterBtn = methodTh ? methodTh.querySelector('.th-filter-btn') : null;
    const methodTools = methodTh ? methodTh.querySelector('.tbl-th-tools') : null;
    const thLbls = Array.from(document.querySelectorAll('#univRegPanel thead tr th .th-lbl'));
    const thTops = thLbls.map(el => el.getBoundingClientRect().top);
    const thMaxTopDelta = thTops.length ? (Math.max(...thTops) - Math.min(...thTops)) : 99;
    const thAllSingleLine = thLbls.length >= 10 && thLbls.every(el => el.getClientRects().length === 1);
    const headerNoJamOk = Boolean(
      methodFilterBtn && getComputedStyle(methodFilterBtn).position === 'absolute' &&
      (window.innerWidth < 768 || getComputedStyle(methodFilterBtn).opacity === '0') &&
      methodTools && getComputedStyle(methodTools).opacity === '0' &&
      thAllSingleLine && thMaxTopDelta <= 1.5
    );
    const trucksThBtn = document.querySelector('#univRegPanel .th-filter-btn[data-th-filter-key="trucks_list"]');
    if (trucksThBtn) trucksThBtn.click();
    const supPop = document.getElementById('colFilterPopover');
    const supPopInputsCount = supPop ? supPop.querySelectorAll('input').length : 0;
    const supPopOptTexts = supPop ? Array.from(supPop.querySelectorAll('.cf-pop-opt-lbl')).map(el => el.textContent.trim()) : [];
    const supPopTokenizedOk = supPop && !supPop.hidden && supPopInputsCount === 1 &&
      supPopOptTexts.length > 10 &&
      !supPopOptTexts.some(t => /\\(\\+\\d+\\)/.test(t)) &&
      Boolean(document.getElementById('cfPopWidenBtn'));
    const closePopBtn = document.getElementById('cfPopCloseBtn');
    if (closePopBtn) closePopBtn.click();
    const supLogicalOk = noGuideOrBanner && supViews.length === 6 &&
      supHeaders.some(h => /Role/i.test(h)) &&
      supHeaders.some(h => /Owned Trucks/i.test(h)) &&
      supHeaders.some(h => /Linked Drivers/i.test(h)) &&
      supHeaders.some(h => /Haul Loads/i.test(h)) &&
      !supHeaders.some(h => /Official Name/i.test(h)) &&
      supSearchPlaceholderClean && supSearchWidthOk && headerNoJamOk && supPopTokenizedOk;

    // 8. Verify Column Filter Bar on Operational Sales & Deliveries (#sales):
    // NEVER render the redundant "FILTER BY COLUMN [Company ▾] [Sale Type ▾]..." row (columns already have .th-filter-btn);
    // keep .col-filter-bar hidden when unfiltered and show ONLY .cf-active-strip when a column filter is active.
    window.__navToView('sales');
    await wait(60);
    const salesFilterBarBefore = document.querySelector('#salesPanel .col-filter-bar');
    const salesHasFilterBar = !!salesFilterBarBefore;
    const noRedundantFilterByColBar =
      document.querySelectorAll('.cf-bar-lbl, .cf-pill-trigger').length === 0 &&
      Boolean(salesFilterBarBefore && salesFilterBarBefore.hidden && getComputedStyle(salesFilterBarBefore).display === 'none');
    const salesCoSel = document.querySelector('#salesPanel .cf-select[data-cf-key="company"]');
    if (salesCoSel) { salesCoSel.value = 'BBConstruction'; salesCoSel.dispatchEvent(new Event('change', { bubbles: true })); }
    const salesFilterBarAfter = document.querySelector('#salesPanel .col-filter-bar');
    const salesActiveStripOnlyOk = Boolean(
      salesFilterBarAfter && !salesFilterBarAfter.hidden &&
      getComputedStyle(salesFilterBarAfter).display !== 'none' &&
      salesFilterBarAfter.querySelector('.cf-active-strip') &&
      getComputedStyle(salesFilterBarAfter.querySelector('.cf-controls')).display === 'none'
    );
    const salesRowsBbc = Array.from(document.querySelectorAll('#salesPanel tbody tr.rrow'));
    const salesBbcFilteredOk = salesRowsBbc.length > 0 && salesRowsBbc.every(tr => /BBC/i.test(tr.children[2].textContent));
    const salesClearBtn = document.querySelector('#salesPanel [data-cf-clear-all]');
    if (salesClearBtn) salesClearBtn.click();

    window.__navToView('overview');
    return {
      ok: dirtyNotesCount === 0 && ownSearchOnlyTrucks && allSearchOnlyTrucks &&
          typeSortedAscFirst && loadsSortedDescNumerically &&
          multiAllMatch && activePillsCount === 3 && popOpened && capFilterOk &&
          resetRestoredAll && supLogicalOk && salesHasFilterBar &&
          noRedundantFilterByColBar && salesActiveStripOnlyOk && salesBbcFilteredOk,
      dirtyNotesCount, ownSearchOnlyTrucks, allSearchOnlyTrucks,
      firstTypeAfterClick, firstLoadsTxt,
      multiCount: multiRows.length, activePillsCount, popOpened, cap25Count: rowsCap25.length,
      resetRestoredAll, supLogicalOk, salesHasFilterBar,
      noRedundantFilterByColBar, salesActiveStripOnlyOk, salesBbcFilteredOk
    };
  })()`);
  multiColFilterProbe && multiColFilterProbe.ok
    ? pass('column header filter engine & zero redundant "Filter by Column" bar · "truck" returns 100% Truck rows + TYPE sorts A→Z + LOADS HAULED sorts numerically + header .th-filter-btn popover & active-only strip', `noRedundantBar=${multiColFilterProbe.noRedundantFilterByColBar} · WTC+Own+Truck=${multiColFilterProbe.multiCount} · Cap>=25=${multiColFilterProbe.cap25Count}`)
    : fail('column header filter engine & zero redundant "Filter by Column" bar', JSON.stringify(multiColFilterProbe));

  // 7g. Dated Truck Adjustment Windows (Start Date -> End Date) + Client/Site Truck Size Overrides on Price Agreements (Sales & Raw/Transport)
  const truckSizeWindowsAndAgreementProbe = await evaluate(`(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    // 1. Open Truck 360° Inspector for Tb7 (364656) and verify Dated Adjustment Windows panel + adding a window
    window.__navToView('reg_equipment');
    await wait(80);
    const allViewBtn = document.querySelector('#univRegPanel [data-tbl-view="all"]');
    if (allViewBtn) allViewBtn.click();
    const eqSearch = document.getElementById('tableSearchInput');
    if (eqSearch) { eqSearch.value = 'Tb7'; eqSearch.dispatchEvent(new Event('input', { bubbles: true })); }
    await wait(220);
    const tb7Row = document.querySelector('#univRegPanel tbody tr.rrow');
    if (tb7Row) tb7Row.click();
    await wait(80);
    const winPanel = document.getElementById('subgrid_truck_windows');
    const winRowsBefore = winPanel ? winPanel.querySelectorAll('tbody tr').length : 0;
    const addWinBtn = document.getElementById('inspAddTruckWinBtn');
    const inspClose = document.getElementById('inspectorDoneBtn') || document.getElementById('inspectorCloseBtn');
    if (inspClose) inspClose.click();
    if (eqSearch) { eqSearch.value = ''; eqSearch.dispatchEvent(new Event('input', { bubbles: true })); }
    await wait(220);

    // 2. Open New Sales Ticket and verify date-aware truck capacity resolution on Tb7 (364656):
    //    - 2026-10-15 -> 29.00 m³ (Hussein Bdeir)
    //    - 2026-09-15 -> 28.00 m³ (Hussein Bdeir)
    //    - 2026-06-15 -> 27.00 m³ (WTC)
    //    - 2024-02-15 + Customer 'SOIME Dawra' -> 26.00 m³ (Client-specific window)
    document.getElementById('newEntryBtn').click();
    await wait(60);
    document.querySelector('[data-pa-group="dispatch"]').click();
    document.querySelector('.modal-tab[data-form="sales"]').click();
    set('f_company', 'WTC');
    set('f_saletype', 'Delivery');
    set('f_transportby', 'Third-party truck');
    set('f_date', '2026-10-15');
    set('f_truck', '364656');
    const oct2026Qty = document.getElementById('f_qty')?.value;
    const oct2026Owner = document.getElementById('f_truckowner')?.value;
    set('f_date', '2026-09-15');
    const sep2026Qty = document.getElementById('f_qty')?.value;
    set('f_date', '2026-06-15');
    const jun2026Qty = document.getElementById('f_qty')?.value;
    set('f_date', '2024-02-15');
    set('f_customer', 'SOIME Dawra');
    const feb2024SoimeQty = document.getElementById('f_qty')?.value;

    // 3. Verify Price Agreement Client / Site Truck Size Override on BOTH Sales and Raw Material / Transport sides
    document.querySelector('[data-pa-group="pricing"]').click();
    document.querySelector('.modal-tab[data-form="pricerule"]').click();
    const hasTruckSizeField = Boolean(document.getElementById('f_trucksize') && !document.getElementById('wrap_pr_trucksize').hidden);
    set('f_company', 'WTC');
    set('f_date', '2026-01-01');
    set('f_ruletype', 'Sales (Delivery)');
    set('f_customer', 'Kenyar');
    set('f_site', 'Beirut');
    set('f_product', 'Ramel Mrml');
    set('f_unitprice', '10.00');
    set('f_transunitprice', '3.00');
    set('f_trucksize', '25.5');
    document.getElementById('dynSaveModalBtn').click();
    await wait(60);

    // Re-open modal and create a Transport Price (Site) agreement on the Raw Material / Transport side with Client/Site Truck Size = 24.5 m³
    document.getElementById('newEntryBtn').click();
    await wait(60);
    document.querySelector('[data-pa-group="pricing"]').click();
    document.querySelector('.modal-tab[data-form="pricerule"]').click();
    set('f_company', 'WTC');
    set('f_date', '2026-01-01');
    set('f_ruletype', 'Transport Price (Site)');
    set('f_site', 'Aaraya');
    set('f_supplier', 'Hussein Bdeir');
    set('f_transunitprice', '3.25');
    set('f_trucksize', '24.5');
    document.getElementById('dynSaveModalBtn').click();
    await wait(60);

    // Verify Sales Ticket picks up the 25.50 m³ Client/Site agreement truck size override
    document.getElementById('newEntryBtn').click();
    await wait(60);
    document.querySelector('[data-pa-group="dispatch"]').click();
    document.querySelector('.modal-tab[data-form="sales"]').click();
    set('f_company', 'WTC');
    set('f_date', '2026-10-15');
    set('f_saletype', 'Delivery');
    set('f_transportby', 'Third-party truck');
    set('f_customer', 'Kenyar');
    set('f_site', 'Beirut');
    set('f_product', 'Ramel Mrml');
    set('f_truck', '364656');
    const salesAgrOverrideQty = document.getElementById('f_qty')?.value;

    // Verify Raw Material Ticket picks up the 24.50 m³ Quarry Site / Hauler agreement truck size override
    document.querySelector('.modal-tab[data-form="raw"]').click();
    set('f_company', 'WTC');
    set('f_date', '2026-10-15');
    set('f_transportby', 'Third-party truck');
    set('f_site', 'Aaraya');
    set('f_product', 'Ramel Mrml');
    set('f_truck', '364656');
    const rawAgrOverrideQty = document.getElementById('f_qty')?.value;
    const rawMatTotal = document.getElementById('f_mat_total')?.value;
    const rawTransTotal = document.getElementById('f_trans_total')?.value;

    // Clean up the 2 test custom price_rules so downstream state stays pristine
    const closeBtn = document.getElementById('closeModalBtn');
    if (closeBtn) closeBtn.click();
    const prs = (window.MFG_SEED && window.MFG_SEED.records && window.MFG_SEED.records.price_rules) || [];
    for (let i = prs.length - 1; i >= 0; i--) {
      if (prs[i] && prs[i].source === 'app' && (Number(prs[i].truck_size) === 25.5 || Number(prs[i].truck_size) === 24.5)) {
        prs.splice(i, 1);
      }
    }

    // 4. Verify 2026-08-24 cutover for TB1 (Karim Bdeir), Tb7 (Hussein Bdeir), and Tb9 (Jad Bdeir) across BOTH WTC and BBConstruction
    const bdeirExpected = { tb1: 'Karim Bdeir', tb7: 'Hussein Bdeir', tb9: 'Jad Bdeir' };
    const salesRecs = (window.MFG_SEED && window.MFG_SEED.records && window.MFG_SEED.records.sales_tickets) || [];
    const rawRecs = (window.MFG_SEED && window.MFG_SEED.records && window.MFG_SEED.records.raw_purchases) || [];
    let bdeirTxMismatch = 0;
    for (const r of salesRecs.concat(rawRecs)) {
      const tk = String(r.truck || '').trim().toLowerCase();
      if (!bdeirExpected[tk] || !r.date) continue;
      if (r.date >= '2026-08-24') {
        if (r.truck_owner !== bdeirExpected[tk]) bdeirTxMismatch++;
      } else {
        const wantPre = r.company === 'WTC' ? '' : 'WTC';
        if ((r.truck_owner || '') !== wantPre) bdeirTxMismatch++;
      }
    }

    return {
      ok: Boolean(winPanel && winRowsBefore >= 10 && addWinBtn &&
          oct2026Qty === '29.00' && oct2026Owner === 'Hussein Bdeir' &&
          sep2026Qty === '28.00' && jun2026Qty === '27.00' && feb2024SoimeQty === '26.00' &&
          hasTruckSizeField && salesAgrOverrideQty === '25.50' && rawAgrOverrideQty === '24.50' &&
          bdeirTxMismatch === 0),
      winRowsBefore, oct2026Qty, oct2026Owner, sep2026Qty, jun2026Qty, feb2024SoimeQty,
      hasTruckSizeField, salesAgrOverrideQty, rawAgrOverrideQty, rawMatTotal, rawTransTotal,
      bdeirTxMismatch
    };
  })()`);
  truckSizeWindowsAndAgreementProbe && truckSizeWindowsAndAgreementProbe.ok
    ? pass('dated truck adjustment windows (Start Date → End Date) & price agreement client/site truck size override (Sales & Raw/Transport)', `Tb7: Oct=${truckSizeWindowsAndAgreementProbe.oct2026Qty} · Sep=${truckSizeWindowsAndAgreementProbe.sep2026Qty} · Jun=${truckSizeWindowsAndAgreementProbe.jun2026Qty} · SOIME=${truckSizeWindowsAndAgreementProbe.feb2024SoimeQty} · SalesAgr=${truckSizeWindowsAndAgreementProbe.salesAgrOverrideQty} · RawAgr=${truckSizeWindowsAndAgreementProbe.rawAgrOverrideQty}`)
    : fail('dated truck adjustment windows & price agreement client/site truck size override', JSON.stringify(truckSizeWindowsAndAgreementProbe));

  // 7h. Interactive Segmented Date Control ([DD]-[MMM]-[YYYY]) & Date/Period Facilitator Popover (#dateFacilitatorPopover) + Partial-Year Guard
  const dateFacilitatorProbe = await evaluate(`(() => {
    const dt = window.MFG_DATE_TEST;
    if (!dt) return { ok: false, err: 'missing MFG_DATE_TEST' };

    // Reset to All-Time baseline first & verify redundant middle period dropdown (#periodSelect & #pbiPeriodSelect) is retired/hidden
    document.getElementById('dateRangeResetBtn').click();
    const periodSelEl = document.getElementById('periodSelect');
    const periodSelectHiddenOk = Boolean(periodSelEl && periodSelEl.hidden === true && getComputedStyle(periodSelEl).display === 'none');

    // 1. Verify partial-year "0002-12-31" is rejected and never corrupts From or To
    const dtTo = document.getElementById('dateToInput');
    dtTo.value = '0002-12-31';
    dtTo.dispatchEvent(new Event('change', { bubbles: true }));
    const partialYearRejectedOk =
      document.getElementById('dateFromInput').value === '2024-01-01' &&
      document.getElementById('dateToInput').value === '2030-12-31' &&
      dt.normalizeDate('0002-12-31', null) === null;

    // 2. Click To-Year segment ("2030") -> opens Facilitator in 'year' view targeting 'to'; pick 2026 -> updates To Date to 2026-12-31 ("31 - Dec - 2026")
    const toYrBtn = document.querySelector('#dateToSegPill [data-date-part="year"]');
    if (toYrBtn) toYrBtn.click();
    const pop = document.getElementById('dateFacilitatorPopover');
    const yrViewOpened = Boolean(pop && !pop.hidden && dt.facState().tab === 'year' && dt.facState().targetMode === 'to' && pop.querySelectorAll('[data-df-pick-year]').length === 7);
    const pick2026 = pop ? pop.querySelector('[data-df-pick-year="2026"]') : null;
    if (pick2026) pick2026.click();
    const toYrUpdatedOk = document.getElementById('dateToInput').value === '2026-12-31' &&
      (document.querySelector('#dateToSegPill [data-date-part="year"]')?.textContent || '') === '2026';

    // 3. Click From-Month segment ("Jan") -> opens Facilitator in 'month' 4x3 grid view targeting 'from'; pick June (6) -> updates From Date to 2024-06-01 ("01 - Jun - 2024")
    const fromMoBtn = document.querySelector('#dateFromSegPill [data-date-part="month"]');
    if (fromMoBtn) fromMoBtn.click();
    const moViewOpened = Boolean(pop && !pop.hidden && dt.facState().tab === 'month' && dt.facState().targetMode === 'from' && pop.querySelectorAll('[data-df-pick-month]').length === 12);
    const pickJun = pop ? pop.querySelector('[data-df-pick-month="6"]') : null;
    if (pickJun) pickJun.click();
    const fromMoUpdatedOk = document.getElementById('dateFromInput').value === '2024-06-01' &&
      (document.querySelector('#dateFromSegPill [data-date-part="month"]')?.textContent || '') === 'Jun';

    // 4. Click From-Day segment ("01") -> opens Facilitator in 'day' calendar view; pick 2024-06-15 -> updates From Date to 2024-06-15 ("15 - Jun - 2024")
    const fromDayBtn = document.querySelector('#dateFromSegPill [data-date-part="day"]');
    if (fromDayBtn) fromDayBtn.click();
    const dayViewOpened = Boolean(pop && !pop.hidden && dt.facState().tab === 'day' && pop.querySelectorAll('[data-df-pick-day]').length >= 28);
    const pick15 = pop ? pop.querySelector('[data-df-pick-day="2024-06-15"]') : null;
    if (pick15) pick15.click();
    const fromDayUpdatedOk = document.getElementById('dateFromInput').value === '2024-06-15' &&
      (document.querySelector('#dateFromSegPill [data-date-part="day"]')?.textContent || '') === '15';

    // 5. ArrowUp / ArrowDown stepping on Day, Month & Year segments + Whole Month action
    fromDayBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    const steppedDayOk = document.getElementById('dateFromInput').value === '2024-06-16';
    dt.stepPart('to', 'month', -2);
    const steppedMoOk = document.getElementById('dateToInput').value === '2026-10-31';

    // Reset back to All-Time and verify popover closes cleanly
    document.getElementById('dateRangeResetBtn').click();
    const resetClosedOk = pop && pop.hidden === true && document.getElementById('dateFromInput').value === '2024-01-01' && document.getElementById('dateToInput').value === '2030-12-31';

    return {
      ok: Boolean(periodSelectHiddenOk && partialYearRejectedOk && yrViewOpened && toYrUpdatedOk && moViewOpened && fromMoUpdatedOk && dayViewOpened && fromDayUpdatedOk && steppedDayOk && steppedMoOk && resetClosedOk),
      periodSelectHiddenOk, partialYearRejectedOk, yrViewOpened, toYrUpdatedOk, moViewOpened, fromMoUpdatedOk, dayViewOpened, fromDayUpdatedOk, steppedDayOk, steppedMoOk, resetClosedOk
    };
  })()`);
  dateFacilitatorProbe && dateFacilitatorProbe.ok
    ? pass('interactive segmented date control & facilitator popover · Day/Month/Year segments open Calendar, 12-Month Grid & Year Grid + Arrow/Wheel stepping + partial-year 0002 guard')
    : fail('interactive segmented date control & facilitator popover', JSON.stringify(dateFacilitatorProbe));

  // 7i. Indifference Price (Flat / Load) vs Per-Unit Price Parity (#pricing table column + #raw Ali Klait / Jad Bdeir / Tb9 $50 haulage + flat Purchase Price (Site))
  const indiffPriceProbe = await evaluate(`(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    // 1. Navigate to #pricing and verify Indifference ($) column & Indifference filter chip
    window.__navToView('pricing');
    await wait(120);
    const prHeaders = Array.from(document.querySelectorAll('#pricingPanel table.ledger-table thead th')).map(th => (th.dataset.colCleanLabel || th.textContent || '').trim());
    const hasIndiffCol = prHeaders.some(h => /Indifference/i.test(h));
    const indiffChip = document.querySelector('#pricingPanel [data-chip="indiff"]');
    const hasIndiffChip = Boolean(indiffChip && /Indifference/i.test(indiffChip.textContent));
    if (indiffChip) indiffChip.click();
    await wait(80);
    const prSearch = document.querySelector('#pricingPanel [data-search]');
    if (prSearch) {
      prSearch.value = 'Ali Klait';
      prSearch.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await wait(80);
    const matchingRows = Array.from(document.querySelectorAll('#pricingPanel table.ledger-table tbody tr')).map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim().replace(/\\s+/g, ' ')));
    const jadRow = matchingRows.find(cells => /Jad Bdeir/i.test(cells[3] || '')) || matchingRows[0] || [];
    // Columns: Code(0), Co(1), Rule Type(2), Customer/Owner(3), Product(4), Site(5), Unit(6), Unit $(7), Transport $(8), Indifference $(9)
    const unitPriceIsDash = jadRow[7] === '—';
    const indiffPriceShows50Flat = /\\$50\\.00/.test(jadRow[9] || '') && /Flat/i.test(jadRow[9] || '');
    if (prSearch) {
      prSearch.value = '';
      prSearch.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const allChip = document.querySelector('#pricingPanel [data-chip="all"]');
    if (allChip) allChip.click();
    await wait(60);

    // 2. Open Entry Modal -> Raw Material Purchase (#raw) and reproduce Ali Klait + Ramel Mrml + Tb9 (Jad Bdeir / Ali Saleh / 27 m³)
    document.getElementById('newEntryBtn').click();
    await wait(80);
    document.querySelector('[data-pa-group="dispatch"]').click();
    document.querySelector('.modal-tab[data-form="raw"]').click();
    await wait(60);
    set('f_company', 'WTC');
    set('f_date', '2026-10-20');
    set('f_transportby', 'Third-party truck');
    set('f_product', 'Ramel Mrml');
    set('f_site', 'Ali Klait');
    set('f_truck', 'Tb9');
    await wait(60);

    const rawQty = document.getElementById('f_qty')?.value;
    const rawUom = document.getElementById('f_uom')?.value;
    const rawOwner = document.getElementById('f_truckowner')?.value;
    const rawDriver = document.getElementById('f_driver')?.value;
    const rawMatUnit = document.getElementById('f_unitprice')?.value;
    const rawMatCost = document.getElementById('f_mat_total')?.value;
    const rawHaulUnit = document.getElementById('f_transunitprice')?.value;
    const rawHaulCost = document.getElementById('f_trans_total')?.value;
    const rawTotal = document.getElementById('f_total_usd')?.value;
    const rawHaulHint = (document.getElementById('hint_trans')?.textContent || '').trim();

    const aliKlaitHaulIndiffOk =
      rawQty === '27.00' &&
      rawUom === 'm³' &&
      rawOwner === 'Jad Bdeir' &&
      rawDriver === 'Ali Saleh' &&
      rawMatUnit === '6.00' &&
      rawMatCost === '162.00' &&
      rawHaulUnit === '50.00' &&
      rawHaulCost === '50.00' &&
      rawTotal === '212.00' &&
      /Indifference Price \\(Flat \\/ Load\\)/i.test(rawHaulHint);

    // 3. Switch site to 'Boudi Saliba' with 'Ramel Mrml' (Purchase Price (Site) Indifference Price = $150.00 flat per load, PRC-20240101-PURCHASEPRICE(SITE)-RAMELMRML-014)
    set('f_site', 'Boudi Saliba');
    await wait(40);
    const blockMatUnit = document.getElementById('f_unitprice')?.value;
    const blockMatCost = document.getElementById('f_mat_total')?.value;
    const blockMatHint = (document.getElementById('hint_price')?.textContent || '').trim();
    const aliKlaitMatIndiffOk =
      blockMatUnit === '150.00' &&
      blockMatCost === '150.00' &&
      /Indifference Price \\(Flat \\/ Load\\)/i.test(blockMatHint);

    const closeBtn = document.getElementById('closeModalBtn');
    if (closeBtn) closeBtn.click();

    return {
      ok: Boolean(hasIndiffCol && hasIndiffChip && unitPriceIsDash && indiffPriceShows50Flat && aliKlaitHaulIndiffOk && aliKlaitMatIndiffOk),
      hasIndiffCol, hasIndiffChip, unitPriceIsDash, indiffPriceShows50Flat, jadRow,
      rawQty, rawUom, rawOwner, rawDriver, rawMatUnit, rawMatCost, rawHaulUnit, rawHaulCost, rawTotal, rawHaulHint,
      blockMatUnit, blockMatCost, blockMatHint
    };
  })()`);
  indiffPriceProbe && indiffPriceProbe.ok
    ? pass('indifference price (flat / load) parity · #pricing Indifference Price ($) column + #raw Ali Klait × Ramel Mrml × Tb9 ($162 mat + $50 flat haul = $212 total, never 27×$50=$1,350)', `mat=$${indiffPriceProbe.rawMatCost} + haul=$${indiffPriceProbe.rawHaulCost} = $${indiffPriceProbe.rawTotal} · flatMat=$${indiffPriceProbe.blockMatCost}`)
    : fail('indifference price (flat / load) parity', JSON.stringify(indiffPriceProbe));

  // 7o. Entity Split & Reconciliation Card Parity across Multi-Group (2 cards) and Single-Group (structured .sales-recon-card.single-card with 6 stacked metric columns & inline header reset button)
  const singleGroupReconProbe = await evaluate(`(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    window.__navToView('sales');
    const grpBtn = document.querySelector('#companySwitch .entity-btn[data-company="manufacturing-group"]');
    if (grpBtn) grpBtn.click();
    await wait(30);
    const multiCards = Array.from(document.querySelectorAll('#salesPanel .sales-entity-recon:not(.single) .sales-recon-card:not([hidden])'));
    const multiOk = multiCards.length === 2 && multiCards.every(c => c.querySelectorAll('.sales-recon-metrics span small').length === 6);

    const wtcBtn = document.querySelector('#companySwitch .entity-btn[data-company="wtc"]');
    if (wtcBtn) wtcBtn.click();
    await wait(30);
    const singleCard = document.querySelector('#salesPanel .sales-entity-recon.single .sales-recon-card.single-card');
    const head = singleCard ? singleCard.querySelector('.sales-recon-head') : null;
    const badge = head ? head.querySelector('.badge') : null;
    const resetBtn = head ? head.querySelector('.sales-recon-reset') : null;
    const metricSpans = singleCard ? Array.from(singleCard.querySelectorAll('.sales-recon-metrics > span')) : [];
    const metricLabels = metricSpans.map(s => (s.querySelector('small')?.textContent || '').trim());
    const metricVals = metricSpans.map(s => (s.querySelector('b')?.textContent || '').trim());
    const bRect = badge ? badge.getBoundingClientRect() : null;
    const rRect = resetBtn ? resetBtn.getBoundingClientRect() : null;
    const sameHeaderRow = Boolean(bRect && rRect && Math.abs((bRect.top + bRect.height / 2) - (rRect.top + rRect.height / 2)) < 14);
    const singleOk = Boolean(
      singleCard &&
      head &&
      resetBtn &&
      !resetBtn.hidden &&
      sameHeaderRow &&
      metricSpans.length === 6 &&
      metricLabels[0] === 'Sales Ex-VAT' &&
      metricLabels[4] === 'Sales VAT Incl.' &&
      metricVals.every(v => v.startsWith('$'))
    );

    if (grpBtn) grpBtn.click();
    await wait(20);
    return { ok: Boolean(multiOk && singleOk), multiCount: multiCards.length, singleMetricCount: metricSpans.length, sameHeaderRow, metricLabels };
  })()`);
  singleGroupReconProbe && singleGroupReconProbe.ok
    ? pass('entity recon card parity · Multi-Group (2 structured cards) & Single-Group (structured .sales-recon-card.single-card with 6 stacked metric columns & inline header Show All Group button)', `multi=${singleGroupReconProbe.multiCount} cards · single=${singleGroupReconProbe.singleMetricCount} metrics · sameHeaderRow=${singleGroupReconProbe.sameHeaderRow}`)
    : fail('entity recon card parity (Multi-Group vs Single-Group)', JSON.stringify(singleGroupReconProbe));

  // 7o-2. Full Company Name Visibility in #companySwitch, Architectural Recon Metric Tiles (.num-cents/.recon-tile-bar/.recon-co-pills), Inline Data Bars (.td-databar) & Live Multi-Row Calculator (#liveSelectionBar)
  const v164VisualProbe = await evaluate(`(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    window.__navToView('sales');
    const coTextEl = document.getElementById('companySwitchCoText');
    const coVisibility = {};
    for (const coKey of ['bbconstruction', 'lionstransport', 'wtc', 'manufacturing-group']) {
      const btn = document.querySelector('#companySwitch .entity-btn[data-company="' + coKey + '"]');
      if (btn) btn.click();
      await wait(20);
      coVisibility[coKey] = {
        text: coTextEl ? coTextEl.textContent.trim() : '',
        scrollW: coTextEl ? coTextEl.scrollWidth : 0,
        clientW: coTextEl ? coTextEl.clientWidth : 0,
        fullVisible: Boolean(coTextEl && coTextEl.scrollWidth <= coTextEl.clientWidth + 1)
      };
    }
    const bbcBtn = document.querySelector('#companySwitch .entity-btn[data-company="bbconstruction"]');
    if (bbcBtn) bbcBtn.click();
    await wait(25);
    const singleCard = document.querySelector('#salesPanel .sales-recon-card.single-card');
    const hasCentsTypography = Boolean(singleCard && singleCard.querySelectorAll('.sales-recon-metrics b .num-cents').length >= 4);
    const hasTileBars = Boolean(singleCard && singleCard.querySelectorAll('.sales-recon-metrics u.recon-tile-bar > i').length === 6);
    const hasTileSubs = Boolean(singleCard && singleCard.querySelectorAll('.sales-recon-metrics em.recon-tile-sub').length === 6);
    const hasHeadMix = Boolean(singleCard && singleCard.querySelector('.sales-recon-head .recon-head-mix'));
    const hasInlineCoPills = Boolean(singleCard && singleCard.querySelectorAll('.sales-recon-head .recon-co-pills .recon-co-pill').length >= 2);
    const dataBarCount = document.querySelectorAll('#salesPanel table.ledger-table tbody td.td-databar').length;

    // Select 2 rows via .row-sel-dot and verify #liveSelectionBar
    const dots = Array.from(document.querySelectorAll('#salesPanel tbody tr.rrow u.row-sel-dot')).slice(0, 2);
    dots.forEach(d => d.click());
    await wait(20);
    const lsb = document.getElementById('liveSelectionBar');
    const lsbShown = Boolean(lsb && !lsb.hidden && /2 Rows Selected/.test(lsb.textContent));
    const clrBtn = document.getElementById('lsbClearSelBtn');
    if (clrBtn) clrBtn.click();
    await wait(15);
    const lsbCleared = Boolean(lsb && lsb.hidden);

    const grpBtn = document.querySelector('#companySwitch .entity-btn[data-company="manufacturing-group"]');
    if (grpBtn) grpBtn.click();
    await wait(20);
    const allCosFull = Object.values(coVisibility).every(v => v.fullVisible);
    return {
      ok: Boolean((window.innerWidth <= 860 || allCosFull) && hasCentsTypography && hasTileBars && hasTileSubs && hasHeadMix && hasInlineCoPills && dataBarCount > 0 && lsbShown && lsbCleared),
      coVisibility,
      hasCentsTypography,
      hasTileBars,
      hasTileSubs,
      hasHeadMix,
      hasInlineCoPills,
      dataBarCount,
      lsbShown,
      lsbCleared
    };
  })()`);
  v164VisualProbe && v164VisualProbe.ok
    ? pass('company switch full-name visibility, architectural recon tiles (.num-cents + share bars + inline entity pills), table data bars & live multi-row calculator', `BBC="${v164VisualProbe.coVisibility.bbconstruction.text}" (${v164VisualProbe.coVisibility.bbconstruction.scrollW}/${v164VisualProbe.coVisibility.bbconstruction.clientW}px) · dataBars=${v164VisualProbe.dataBarCount} · liveCalc=2 rows->clear`)
    : fail('v16.4 visual & interactive enhancements', JSON.stringify(v164VisualProbe));

  // 7p. iOS Standalone & Mobile Bottom Dock Flush Viewport Parity (PWA.md §3.1 — zero dead bottom rectangle)
  const iosStandaloneDockProbe = await evaluate(`(() => {
    const de = document.documentElement;
    const hadStandalone = de.classList.contains('ios-standalone');
    de.classList.add('ios-standalone');
    const sh = document.getElementById('appShell');
    const ma = document.querySelector('.main-area');
    const dock = document.getElementById('mobileBottomDock');
    const shCs = getComputedStyle(sh);
    const shRect = sh.getBoundingClientRect();
    const maRect = ma.getBoundingClientRect();
    const dockRect = dock ? dock.getBoundingClientRect() : null;
    const dockCs = dock ? getComputedStyle(dock) : null;
    let standaloneRuleHasDvh = false;
    for (const sheet of Array.from(document.styleSheets)) {
      let rules = [];
      try { rules = Array.from(sheet.cssRules || []); } catch (_) {}
      for (const r of rules) {
        if (r.selectorText && r.selectorText.includes('html.ios-standalone') && !r.selectorText.includes(':not(.ios-standalone)')) {
          const txt = r.cssText || '';
          if (/height\\s*:\\s*100dvh/i.test(txt)) standaloneRuleHasDvh = true;
        }
      }
    }
    const shPos = shCs.position;
    const dockPadBottom = dockCs ? dockCs.paddingBottom : null;
    const isMobile = window.innerWidth <= 860;
    const shellFlush = Math.abs(Math.round(shRect.bottom) - window.innerHeight) <= 1 && Math.abs(Math.round(maRect.bottom) - window.innerHeight) <= 1 && shPos === 'fixed';
    const dockFlush = !isMobile || (dockRect && Math.abs(Math.round(dockRect.bottom) - window.innerHeight) <= 1 && dockPadBottom === '22px');
    if (!hadStandalone) de.classList.remove('ios-standalone');
    return {
      ok: Boolean(!standaloneRuleHasDvh && shellFlush && dockFlush),
      standaloneRuleHasDvh,
      shellFlush,
      dockFlush,
      shPos,
      shBottom: Math.round(shRect.bottom),
      dockBottom: dockRect ? Math.round(dockRect.bottom) : null,
      dockPadBottom,
      vh: window.innerHeight
    };
  })()`);
  iosStandaloneDockProbe && iosStandaloneDockProbe.ok
    ? pass('iOS standalone & mobile bottom dock flush parity (PWA.md §3.1 — 100vh shell, 0px bottom gap, 22px dock home-indicator clearance)', `pos=${iosStandaloneDockProbe.shPos} · bottom=${iosStandaloneDockProbe.shBottom}/${iosStandaloneDockProbe.vh}px · dockPadBottom=${iosStandaloneDockProbe.dockPadBottom}`)
    : fail('iOS standalone & mobile bottom dock flush parity', JSON.stringify(iosStandaloneDockProbe));

  // 7q. Cash Flow & Till Dual-Currency SharePoint Parity ($0.00 & 0 LL WTC, $622.00 & 5,035,000 LL BBConstruction) + Entry-User Access (no Physical Cash Drawer Verification card)
  const cashFlowTillProbe = await evaluate(`(async () => {
    const T = window.MFG_FACE_TEST;
    const wait = ms => new Promise(r => setTimeout(r, ms));
    await T.performLogin('husseinbdeir@bhfirms.com', '1111', { bypass2FA: true });

    // 1. WTC All-Time on Executive Overview + Custom Range (2024-01-01 .. 2026-09-30 on Rep Date)
    document.querySelector('#companySwitch .entity-btn[data-company="wtc"]').click();
    window.__navToView('overview');
    const grainAllBtn = document.querySelector('#grainSwitch .grain-btn[data-grain="all"]');
    if (grainAllBtn) grainAllBtn.click();
    await wait(30);
    const wtcTillCardAll = document.querySelector('#workspace .kpi[data-nav-jump="cashflow"]');
    const wtcAllText = (wtcTillCardAll ? wtcTillCardAll.textContent : '').replace(/\\s+/g, ' ').trim();
    const wtcNavPillAll = (document.getElementById('navCountTill') || {}).textContent?.trim() || '';

    // Apply custom range 2024-01-01 .. 2026-09-30 + Rep Date (the exact screenshot scenario)
    const setDate = (id, v) => {
      const inp = document.getElementById(id);
      if (!inp) return;
      inp.value = v;
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    };
    setDate('dateFromInput', '2024-01-01');
    setDate('dateToInput', '2026-09-30');
    const repBtn = document.querySelector('#basisSwitch [data-basis="rep"]');
    if (repBtn) repBtn.click();
    await wait(30);
    const wtcTillCardCustom = document.querySelector('#workspace .kpi[data-nav-jump="cashflow"]');
    const wtcCustomText = (wtcTillCardCustom ? wtcTillCardCustom.textContent : '').replace(/\\s+/g, ' ').trim();
    const noStale996Or32M = !/\\$996\\.08|32,812,134/.test(wtcCustomText) && !/\\$996\\.08|32,812,134/.test(wtcAllText);

    // Reset back to All-Time Tx Date
    const txBtn = document.querySelector('#basisSwitch [data-basis="tx"]');
    if (txBtn) txBtn.click();
    const rstBtn = document.getElementById('dateRangeResetBtn') || document.querySelector('#grainSwitch .grain-btn[data-grain="all"]');
    if (rstBtn) rstBtn.click();
    await wait(30);

    // 2. Open dedicated #cashflow page on WTC: verify $0.00 & 0 LL, SharePoint 7-table parity, FX Conversion dual-currency signed deltas & Physical Drawer Check removed
    window.__navToView('cashflow');
    await wait(40);
    const wtcCfHeroText = (document.querySelector('#workspace .cockpit-banner') || {}).textContent?.replace(/\\s+/g, ' ').trim() || '';
    const wtcSalesTfoot = (document.querySelector('#cfSalesPanel tfoot') || {}).textContent?.replace(/\\s+/g, ' ').trim() || '';
    const wtcExpTfoot = (document.querySelector('#cfExpPanel tfoot') || {}).textContent?.replace(/\\s+/g, ' ').trim() || '';
    const wtcBridgeTfoot = (document.querySelector('#tillBridgePanel tfoot') || {}).textContent?.replace(/\\s+/g, ' ').trim() || '';
    const wtcConvSummaryTxt = (document.getElementById('cfExtdConvPanel') || {}).textContent?.replace(/\\s+/g, ' ').trim() || '';
    const noDrawerVerifyCard = !document.getElementById('tillVerifyPanel') && !document.getElementById('tillCountUsdInput') && !document.getElementById('tillCountLbpInput');

    const wtcFxChip = document.querySelector('#tillRecentPanel [data-chip="cf_fx"]');
    if (wtcFxChip) wtcFxChip.click();
    await wait(30);
    const wtcFxTfoot = (document.querySelector('#tillRecentPanel tfoot') || {}).textContent?.replace(/\\s+/g, ' ').trim() || '';
    const wtcFxRows = Array.from(document.querySelectorAll('#tillRecentPanel tbody tr.rrow')).map(tr => {
      const tds = tr.querySelectorAll('td');
      const inTxt = (tds[6] ? tds[6].textContent : '').trim();
      const outTxt = (tds[7] ? tds[7].textContent : '').trim();
      return {
        dir: (tds[3] ? tds[3].textContent : '').replace(/\\s+/g, ' ').trim(),
        ref: ((tds[4] ? tds[4].textContent : '') + ' ' + (tds[5] ? tds[5].textContent : '')).replace(/\\s+/g, ' ').trim(),
        usd: inTxt && inTxt !== '—' ? inTxt : outTxt,
        lbp: (tds[8] ? tds[8].textContent : '').trim()
      };
    });
    const wtcFxNoDashes = wtcFxRows.length >= 25 && wtcFxRows.slice(0, 25).every(r => (r.usd.startsWith('+$') || r.usd.startsWith('-$')) && (r.lbp.startsWith('+') || r.lbp.startsWith('-')) && r.lbp.endsWith(' LL'));
    const wtcFx709 = wtcFxRows.find(r => r.ref.includes('#709')) || {};
    const wtcFx707 = wtcFxRows.find(r => r.ref.includes('#707')) || {};
    const wtcAllChip = document.querySelector('#tillRecentPanel [data-chip="all"]');
    if (wtcAllChip) wtcAllChip.click();
    await wait(25);

    // 3. Switch to BBConstruction: verify $0.00 & 0 LL ($0.00 combined matching SharePoint Daily CF) + 336 FX Conversions + Sales & Borrowing stream parity
    document.querySelector('#companySwitch .entity-btn[data-company="bbconstruction"]').click();
    await wait(30);
    const bbcCfHeroText = (document.querySelector('#workspace .cockpit-banner') || {}).textContent?.replace(/\\s+/g, ' ').trim() || '';
    const bbcNavPill = (document.getElementById('navCountTill') || {}).textContent?.trim() || '';
    const bbcLiveStrip = (document.querySelector('#tillRecentPanel .cf-live-strip') || {}).textContent?.replace(/\\s+/g, ' ').trim() || '';
    const bbcAllTfoot = (document.querySelector('#tillRecentPanel tfoot') || {}).textContent?.replace(/\\s+/g, ' ').trim() || '';
    const bbcBorTfoot = (document.querySelector('#cfBorPanel tfoot') || {}).textContent?.replace(/\\s+/g, ' ').trim() || '';
    const bbcSalesChip = document.querySelector('#tillRecentPanel [data-chip="cf_sales"]');
    if (bbcSalesChip) bbcSalesChip.click();
    await wait(25);
    const bbcSalesMoveTfoot = (document.querySelector('#tillRecentPanel tfoot') || {}).textContent?.replace(/\\s+/g, ' ').trim() || '';
    const bbcFxChip = document.querySelector('#tillRecentPanel [data-chip="cf_fx"]');
    if (bbcFxChip) bbcFxChip.click();
    await wait(25);
    const bbcFxTfoot = (document.querySelector('#tillRecentPanel tfoot') || {}).textContent?.replace(/\\s+/g, ' ').trim() || '';
    const bbcAllChip = document.querySelector('#tillRecentPanel [data-chip="all"]');
    if (bbcAllChip) bbcAllChip.click();
    await wait(20);
    const wtcAllKpi = window.MFG_SEED?.models?.wtc?.periods?.all || {};
    const bbcAllKpi = window.MFG_SEED?.models?.bbconstruction?.periods?.all || {};
    const spKpiParityOk = wtcAllKpi.qty_sold === 617374.16 && wtcAllKpi.raw_qty === 557963 && wtcAllKpi.ap_on_credit === 7257690.97 && wtcAllKpi.settlements_paid === 7965358.69 && wtcAllKpi.ap_balance === -707667.73 && wtcAllKpi.ar_balance === 20949.85 && wtcAllKpi.salaries_paid === 754416.51 && wtcAllKpi.overtime_bonus === 129492.2 && bbcAllKpi.qty_sold === 179984.99 && bbcAllKpi.raw_qty === 144533.67 && bbcAllKpi.ap_on_credit === 1371884.66 && bbcAllKpi.settlements_paid === 1255386.19 && bbcAllKpi.ap_balance === 116498.48 && bbcAllKpi.ar_balance === 104078.5 && bbcAllKpi.salaries_paid === 413319 && bbcAllKpi.overtime_bonus === 15210.17 && bbcAllKpi.diesel_litres === 714101.94 && bbcAllKpi.diesel_sold === 421932;

    // 4. Entry User Access: u4 (scale1.wtc@bhfirms.com, Entry, pbi_access: 'none') & u6 (batch.bbc@bhfirms.com, Entry, BBConstruction)
    await T.performLogin('scale1.wtc@bhfirms.com', '4444', { bypass2FA: true });
    const u4NavBtn = document.querySelector('#sidebarNav .nav-item[data-hub="cashflow"]');
    const u4NavVisible = Boolean(u4NavBtn && !u4NavBtn.hidden);
    if (u4NavBtn) u4NavBtn.click();
    await wait(30);
    const u4BridgePanel = Boolean(document.getElementById('tillBridgePanel'));
    const u4NoVerifyPanel = !document.getElementById('tillVerifyPanel');
    const u4ConfSalHidden = !document.getElementById('cfSalPanel') && !document.getElementById('cfBorPanel');
    const u4HeroText = (document.querySelector('#workspace .cockpit-banner') || {}).textContent?.replace(/\\s+/g, ' ').trim() || '';

    await T.performLogin('batch.bbc@bhfirms.com', '5555', { bypass2FA: true });
    const u6NavBtn = document.querySelector('#sidebarNav .nav-item[data-hub="cashflow"]');
    if (u6NavBtn) u6NavBtn.click();
    await wait(30);
    const u6HeroText = (document.querySelector('#workspace .cockpit-banner') || {}).textContent?.replace(/\\s+/g, ' ').trim() || '';

    // Restore Owner & Group All-Time
    await T.performLogin('husseinbdeir@bhfirms.com', '1111', { bypass2FA: true });
    document.querySelector('#companySwitch .entity-btn[data-company="manufacturing-group"]').click();
    window.__navToView('overview');
    await wait(30);

    const wtcZeroOk = /\\$0\\.00/.test(wtcAllText) && /0 LL/.test(wtcAllText) && /\\$0\\.00/.test(wtcCustomText) && /0 LL/.test(wtcCustomText) && wtcNavPillAll === '$0 · 0 LL';
    const wtcTablesOk = /\\$9,994,762\\.51/.test(wtcSalesTfoot) && /30,125,396,148 LL/.test(wtcSalesTfoot) && /\\$8,311,011\\.29/.test(wtcExpTfoot) && /\\$0\\.00/.test(wtcBridgeTfoot) && /0 LL/.test(wtcBridgeTfoot);
    const fxConversionsOk = wtcFxNoDashes
      && wtcFxTfoot.includes('710 ENTRIES') && wtcFxTfoot.includes('+$154,694.10') && wtcFxTfoot.includes('-13,853,604,456 LL')
      && (wtcFx709.dir || '').includes('LBP → USD') && (wtcFx709.ref || '').includes('@ 89,502') && wtcFx709.usd === '+$855.50' && wtcFx709.lbp === '-76,569,040 LL'
      && (wtcFx707.dir || '').includes('USD → LBP') && (wtcFx707.ref || '').includes('@ 89,671') && wtcFx707.usd === '-$209.72' && wtcFx707.lbp === '+18,805,740 LL'
      && wtcConvSummaryTxt.includes('-$187,211.84') && wtcConvSummaryTxt.includes('+16,747,731,907 LL')
      && wtcConvSummaryTxt.includes('+$341,980.74') && wtcConvSummaryTxt.includes('-30,608,030,963 LL')
      && bbcFxTfoot.includes('336 ENTRIES') && bbcFxTfoot.includes('-$62,630.07') && bbcFxTfoot.includes('+5,577,835,762 LL');
    const bbcParityOk = /\\$0\\.00/.test(bbcCfHeroText) && /0 LL/.test(bbcCfHeroText) && bbcNavPill === '$0 · 0 LL'
      && bbcLiveStrip.includes('Net: $0.00') && bbcLiveStrip.includes('LBP: 0 LL')
      && bbcAllTfoot.includes('NET $0.00') && bbcAllTfoot.includes('0 LL')
      && bbcBorTfoot.includes('697,000,000 LL')
      && bbcSalesMoveTfoot.includes('+$2,463,238.97') && bbcSalesMoveTfoot.includes('-2,829,334,860 LL')
      && spKpiParityOk;
    const entryUsersOk = u4NavVisible && u4BridgePanel && u4NoVerifyPanel && u4ConfSalHidden && /\\$0\\.00/.test(u4HeroText) && /0 LL/.test(u4HeroText) && /\\$0\\.00/.test(u6HeroText) && /0 LL/.test(u6HeroText);

    return {
      ok: Boolean(noStale996Or32M && wtcZeroOk && wtcTablesOk && fxConversionsOk && noDrawerVerifyCard && bbcParityOk && entryUsersOk),
      noStale996Or32M, wtcZeroOk, wtcTablesOk, fxConversionsOk, noDrawerVerifyCard, bbcParityOk, entryUsersOk,
      wtcFxTfoot, bbcFxTfoot, wtcFx709, wtcFx707,
      wtcAllText, wtcCustomText, wtcNavPillAll, bbcNavPill
    };
  })()`);
  cashFlowTillProbe && cashFlowTillProbe.ok
    ? pass('cash flow & till parity · WTC $0.00 & 0 LL, BBC $0.00 & 0 LL, FX Conversion signed USD ↔ LBP drawer deltas (710 WTC + 336 BBC), SharePoint 7-table parity & Entry-seat access', `WTC=${cashFlowTillProbe.wtcNavPillAll} · BBC=${cashFlowTillProbe.bbcNavPill} · FX=${cashFlowTillProbe.wtcFxTfoot}`)
    : fail('cash flow & till parity + fx conversions + entry-seat access', JSON.stringify(cashFlowTillProbe));

  // 7q. Institutional Vector Icon System & #fleet Thermal Ticket Cell Parity (js/icons.js)
  const iconSystemProbe = await evaluate(`(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const hasIconsApi = Boolean(window.MFG_ICONS && typeof window.MFG_ICONS.svg === 'function' && typeof window.MFG_ICONS.nav === 'function');
    const navBtns = Array.from(document.querySelectorAll('#sidebarNav button.nav-item'));
    const allNavHaveSvg = navBtns.length === 10 && navBtns.every(b => {
      const ico = b.querySelector('i.nav-ico svg.ic');
      const sp = b.querySelector('span');
      return Boolean(ico && sp && sp.textContent.trim().length > 0 && !b.hasAttribute('title') && !sp.hasAttribute('title'));
    });
    window.__navToView('users');
    await wait(30);
    const showcaseHasSvg = Boolean(document.querySelector('#systemShowcasePanel #railShowcaseLink i.nav-ico svg.ic'));

    // Navigate to #fleet and verify sub-tabs SVGs + Ticket column parity + thermal preview click
    window.__navToView('fleet');
    await wait(40);
    const subBtns = Array.from(document.querySelectorAll('#hubSubtabBar button.hub-subtab'));
    const allSubHaveSvg = subBtns.length === 4 && subBtns.every(b => Boolean(b.querySelector('i.nav-ico svg.ic')));
    const fuelTd = document.querySelector('#fuelPanel table.ledger-table tbody tr.rrow td:nth-child(2)');
    const fuelInline = fuelTd ? fuelTd.querySelector('.tkt-cell-inline') : null;
    const fuelNum = fuelInline ? fuelInline.querySelector('strong.tkt-no-num') : null;
    const fuelPrintBtn = fuelInline ? fuelInline.querySelector('button.tkt-print-mini[data-print-ticket="fuel"][data-print-id]') : null;
    const fuelPrintSvg = fuelPrintBtn ? fuelPrintBtn.querySelector('svg.ic') : null;
    const noUnstyledBtn = !document.querySelector('#fuelPanel .tbl-print-icon');
    const fuelNowrap = fuelTd ? getComputedStyle(fuelTd).whiteSpace === 'nowrap' : false;
    const numBeforeBtn = Boolean(fuelInline && fuelNum && fuelPrintBtn && (fuelNum.compareDocumentPosition(fuelPrintBtn) & Node.DOCUMENT_POSITION_FOLLOWING));

    // Click #fleet print button -> verify #thermalPrintModal actually opens for this fuel slip
    let modalOpenedForFuel = false;
    if (fuelPrintBtn) {
      fuelPrintBtn.click();
      await wait(30);
      const tm = document.getElementById('thermalPrintModal');
      const tmTitle = document.getElementById('thermalModalTitle')?.textContent || '';
      const browserSvg = !!document.querySelector('#thermalBrowserPrintBtn svg.ic');
      const rawBtSvg = !!document.querySelector('#thermalRawBtBtn svg.ic');
      modalOpenedForFuel = Boolean(tm && !tm.hidden && tmTitle.includes(fuelNum.textContent.trim()) && browserSvg && rawBtSvg);
      document.getElementById('closeThermalModalBtn')?.click();
      await wait(20);
    }

    // Verify zero ugly bare monochrome dingbats (U+1F5A8 without FE0F, U+1F5D1, U+1F5D4) across key modules
    let uglyGlyphHits = [];
    for (const v of ['sales', 'raw', 'fleet', 'kiosks', 'statements', 'users']) {
      window.__navToView(v);
      await wait(25);
      const wsTxt = document.getElementById('workspace')?.textContent || '';
      if (/[\u{1F5A8}\u{1F5D1}\u{1F5D4}]/u.test(wsTxt)) uglyGlyphHits.push(v);
    }

    window.__navToView('overview');
    await wait(20);

    return {
      ok: Boolean(hasIconsApi && allNavHaveSvg && allSubHaveSvg && showcaseHasSvg && fuelInline && fuelNum && fuelPrintBtn && fuelPrintSvg && noUnstyledBtn && fuelNowrap && numBeforeBtn && modalOpenedForFuel && uglyGlyphHits.length === 0),
      hasIconsApi,
      navCount: navBtns.length,
      subCount: subBtns.length,
      allNavHaveSvg,
      allSubHaveSvg,
      showcaseHasSvg,
      noUnstyledBtn,
      fuelNowrap,
      numBeforeBtn,
      modalOpenedForFuel,
      uglyGlyphHits
    };
  })()`);
  iconSystemProbe && iconSystemProbe.ok
    ? pass('Institutional Vector Icon System & #fleet thermal ticket button parity (10 rail SVGs + horizontal sub-tab SVGs, .tkt-print-mini click -> modal, 0 monochrome dingbats)', `nav=${iconSystemProbe.navCount} SVGs · sub=${iconSystemProbe.subCount} SVGs · fleetNowrap=${iconSystemProbe.fuelNowrap} · modalOpened=${iconSystemProbe.modalOpenedForFuel}`)
    : fail('Institutional Vector Icon System & #fleet thermal ticket button parity', JSON.stringify(iconSystemProbe));

  // 7r. Material & Transportation 4-Table Suite & WTC Old Stock Penny Parity (#raw)
  const matTransProbe = await evaluate(`(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const rawBtn = document.querySelector('#sidebarNav .nav-item[data-hub="raw"]');
    const navLabel = (rawBtn?.querySelector('span')?.textContent || '').trim();
    window.__navToView('raw');
    await wait(35);

    const activeSubLabel = (document.querySelector('#hubSubtabBar .hub-subtab.active .hub-subtab-lbl')?.textContent || '').trim();
    const topbarTitle = (document.getElementById('topbarTitle')?.textContent || '').trim();
    const cockpitTitle = (document.querySelector('#workspace .cockpit-title')?.textContent || '').trim();
    const namingOk = navLabel === 'Material & Suppliers' && activeSubLabel === 'Material & Transportation' && topbarTitle === 'Material & Transportation' && cockpitTitle === 'Material & Transportation';

    // Apply WTC + 2024-01-01 .. 2026-09-30 + Rep Date (exact WTC Old Stock screenshot baseline)
    document.querySelector('#companySwitch .entity-btn[data-company="wtc"]').click();
    const setDate = (id, v) => {
      const inp = document.getElementById(id);
      if (!inp) return;
      inp.value = v;
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    };
    setDate('dateFromInput', '2024-01-01');
    setDate('dateToInput', '2026-09-30');
    const repBtn = document.querySelector('#basisSwitch [data-basis="rep"]');
    if (repBtn) repBtn.click();
    await wait(50);

    const panelIds = Array.from(document.querySelectorAll('#workspace .panel-card')).map(p => p.id);
    const fourPanelsOk = panelIds.length === 4 && panelIds[0] === 'rawPanel' && panelIds[1] === 'rawSupPanel' && panelIds[2] === 'rawSalesHaulPanel' && panelIds[3] === 'sitesPanel';

    const rawTfoot = (document.querySelector('#rawPanel tfoot')?.textContent || '').replace(/\\s+/g, ' ').trim();
    const supTfoot = (document.querySelector('#rawSupPanel tfoot')?.textContent || '').replace(/\\s+/g, ' ').trim();
    const shTfoot = (document.querySelector('#rawSalesHaulPanel tfoot')?.textContent || '').replace(/\\s+/g, ' ').trim();
    const siteTfoot = (document.querySelector('#sitesPanel tfoot')?.textContent || '').replace(/\\s+/g, ' ').trim();

    const rawIntakeOk = rawTfoot.includes('19,936') && rawTfoot.includes('$2,993,037.79') && rawTfoot.includes('$332,592.25') && rawTfoot.includes('$3,325,630.04');
    const supParityOk =
      supTfoot.includes('$2,993,037.79') &&
      supTfoot.includes('$332,592.25') &&
      supTfoot.includes('$19,414.72') &&
      supTfoot.includes('$352,006.97') &&
      supTfoot.includes('$3,345,044.76') &&
      supTfoot.includes('$4,020,861.84') &&
      (supTfoot.includes('-$675,817.08') || supTfoot.includes('−$675,817.08'));
    const salesHaulOk = shTfoot.includes('283 LOADS') && shTfoot.includes('$19,414.72') && shTfoot.includes('$19,614.72');
    const siteParityOk =
      siteTfoot.includes('$2,993,037.79') &&
      siteTfoot.includes('$332,592.25') &&
      siteTfoot.includes('$19,414.72') &&
      siteTfoot.includes('$3,345,044.76') &&
      siteTfoot.includes('$4,020,861.84') &&
      (siteTfoot.includes('-$675,817.08') || siteTfoot.includes('−$675,817.08'));

    // Test chip filters on #rawSupPanel & #rawSalesHaulPanel + jump button on #rawPanel
    document.querySelector('[data-rawsup-chip="haul"]')?.click();
    await wait(25);
    const haulOnlyTfoot = (document.querySelector('#rawSupPanel tfoot')?.textContent || '').replace(/\\s+/g, ' ').trim();
    const haulChipOk = haulOnlyTfoot.includes('$332,592.25') && haulOnlyTfoot.includes('$19,414.72') && haulOnlyTfoot.includes('$352,006.97');
    document.querySelector('[data-rawsup-chip="all"]')?.click();

    document.querySelector('[data-saleshaul-chip="credit"]')?.click();
    await wait(25);
    const shCreditTfoot = (document.querySelector('#rawSalesHaulPanel tfoot')?.textContent || '').replace(/\\s+/g, ' ').trim();
    const shCreditChipOk = shCreditTfoot.includes('281 LOADS') && shCreditTfoot.includes('$19,414.72') && !shCreditTfoot.includes('$19,614.72');
    document.querySelector('[data-saleshaul-chip="all"]')?.click();

    const jumpBtn = document.querySelector('#rawPanel [data-scroll-panel="rawSalesHaulPanel"]');
    const hasJumpBtn = Boolean(jumpBtn);

    // Restore Group + All-Time + Tx Date + Overview
    const txBtn = document.querySelector('#basisSwitch [data-basis="tx"]');
    if (txBtn) txBtn.click();
    const grainAllBtn = document.querySelector('#dateGrainBar [data-grain="all"]');
    if (grainAllBtn) grainAllBtn.click();
    document.querySelector('#companySwitch .entity-btn[data-company="manufacturing-group"]').click();
    window.__navToView('overview');
    await wait(30);

    return {
      ok: Boolean(namingOk && fourPanelsOk && rawIntakeOk && supParityOk && salesHaulOk && siteParityOk && haulChipOk && shCreditChipOk && hasJumpBtn),
      namingOk, fourPanelsOk, rawIntakeOk, supParityOk, salesHaulOk, siteParityOk, haulChipOk, shCreditChipOk, hasJumpBtn,
      panelIds, supTfoot, shTfoot, siteTfoot
    };
  })()`);
  matTransProbe && matTransProbe.ok
    ? pass('Material & Transportation 4-table suite & WTC Old Stock penny parity (#rawPanel, #rawSupPanel, #rawSalesHaulPanel, #sitesPanel · Credit $3,345,044.76 · Paid $4,020,861.84 · Rem -$675,817.08 · 283 3rd-party customer loads)', `panels=${matTransProbe.panelIds.join('→')}`)
    : fail('Material & Transportation 4-table suite & WTC Old Stock penny parity', JSON.stringify(matTransProbe));

  // 7s. Cash Till 5300 Charts, Daily Till Sheet & Interactive Cashbook Explorer (#cashflow & #cashflow_analytics)
  const cashTillUxProbe = await evaluate(`(async () => {
    const T = window.MFG_FACE_TEST;
    const wait = ms => new Promise(r => setTimeout(r, ms));
    await T.performLogin('husseinbdeir@bhfirms.com', '1111', { bypass2FA: true });
    document.querySelector('#companySwitch .entity-btn[data-company="wtc"]').click();
    const txBtn = document.querySelector('#basisSwitch [data-basis="tx"]');
    if (txBtn) txBtn.click();
    const rstBtn = document.getElementById('dateRangeResetBtn') || document.querySelector('#grainSwitch .grain-btn[data-grain="all"]');
    if (rstBtn) rstBtn.click();
    await wait(30);

    // A. #cashflow: #tillRecentPanel FIRST at top (Rule 16c, zero card above #tillRecentPanel), defaults to Individual Entries, 0 "Account 5300"/"Till 5300", all 7 SharePoint streams, Daily Till Sheet & Day Drill
    window.__navToView('cashflow');
    await wait(40);
    const cfPanelIds = Array.from(document.querySelectorAll('#workspace .panel-card[id]')).map(el => el.id);
    const noCardBetweenBannerAndTill = Boolean(document.querySelector('#tillRecentPanel .sales-entity-recon')) && !document.querySelector('#workspace > .sales-entity-recon');
    const recentFirstOk = cfPanelIds[0] === 'tillRecentPanel' && cfPanelIds[1] === 'tillBridgePanel' && noCardBetweenBannerAndTill;
    const defaultIndivOk = Boolean(document.querySelector('#tillRecentPanel [data-cf-mode="entries"].active') && !document.querySelector('#tillRecentPanel [data-cf-mode="daily"].active'));
    const cfPageTxt = document.getElementById('workspace')?.textContent || '';
    const no5300CfOk = !/Account\\s*5300|Till\\s*5300|\\(5300\\)|Class\\s*5300/i.test(cfPageTxt);
    const allEntriesTfoot = (document.querySelector('#tillRecentPanel tfoot')?.textContent || '').replace(/\\s+/g, ' ').trim();

    // Verify External (5,467 WTC rows: +$10,920,786.96 In / -$12,078,057.02 Out / +1,200,340,363 LL), Extended (336 WTC rows: NET +$15,221.69 / -2,550,000 LL), Salary (3,069 WTC rows: NET -$754,416.51 / -501,121,595 LL) & Borrowing (1,058 WTC rows)
    document.querySelector('#tillRecentPanel [data-chip="cf_ext"]')?.click();
    await wait(25);
    const extTfoot = (document.querySelector('#tillRecentPanel tfoot')?.textContent || '').replace(/\\s+/g, ' ').trim();
    const extChipOk = extTfoot.includes('5,467 ENTRIES') && extTfoot.includes('+$10,920,786.96') && extTfoot.includes('-$12,078,057.02') && extTfoot.includes('+1,200,340,363 LL');

    document.querySelector('#tillRecentPanel [data-chip="cf_extd"]')?.click();
    await wait(25);
    const extdTfoot = (document.querySelector('#tillRecentPanel tfoot')?.textContent || '').replace(/\\s+/g, ' ').trim();
    const extdChipOk = extdTfoot.includes('336 ENTRIES') && extdTfoot.includes('+$15,221.69') && extdTfoot.includes('+$609,147.11') && extdTfoot.includes('-$593,925.42') && extdTfoot.includes('-2,550,000 LL');

    document.querySelector('#tillRecentPanel [data-chip="cf_sal"]')?.click();
    await wait(25);
    const salTfoot = (document.querySelector('#tillRecentPanel tfoot')?.textContent || '').replace(/\\s+/g, ' ').trim();
    const salChipOk = salTfoot.includes('3,055 ENTRIES') && salTfoot.includes('-$754,416.51') && salTfoot.includes('-501,121,595 LL');

    document.querySelector('#tillRecentPanel [data-chip="cf_loan"]')?.click();
    await wait(25);
    const loanTfoot = (document.querySelector('#tillRecentPanel tfoot')?.textContent || '').replace(/\\s+/g, ' ').trim();
    const loanChipOk = loanTfoot.includes('1,058 ENTRIES');

    document.querySelector('#tillRecentPanel [data-chip="all"]')?.click();
    await wait(25);
    const hasNineStreamTotal = Boolean(extChipOk && extdChipOk && salChipOk && loanChipOk && allEntriesTfoot.includes('20,495 ENTRIES'));

    // Toggle to Daily Till Sheet (610 operating days for WTC)
    document.querySelector('#tillRecentPanel [data-cf-mode="daily"]')?.click();
    await wait(35);
    const dailyTfoot = (document.querySelector('#tillRecentPanel tfoot')?.textContent || '').replace(/\\s+/g, ' ').trim();
    const dailyOk = dailyTfoot.includes('610 OPERATING DAYS') && dailyTfoot.includes('$0.00');

    // Click 2026-10-24 day row -> drills back into Individual Entries for 24-10-2026 (76 entries: +$62,520.00 In / -$62,975.00 Out = -$455.00 Net matching dt25)
    document.querySelector('#tillRecentPanel tr.cf-day-row[data-cf-focus-date="2026-10-24"]')?.click();
    await wait(35);
    const drillDayTfoot = (document.querySelector('#tillRecentPanel tfoot')?.textContent || '').replace(/\\s+/g, ' ').trim();
    const drillDayOk = drillDayTfoot.includes('76 ENTRIES') && drillDayTfoot.includes('+$62,520.00') && drillDayTfoot.includes('-$62,975.00') && Boolean(document.querySelector('[data-cf-clear-drill="date"]'));

    // Clear active drill & verify switching to Daily -> leaving view -> reopening #cashflow resets to Individual Entries
    document.querySelector('[data-cf-clear-drill="all"]')?.click();
    await wait(30);
    const clearedOk = !document.querySelector('[data-cf-clear-drill="date"]');
    document.querySelector('#tillRecentPanel [data-cf-mode="daily"]')?.click();
    await wait(25);
    window.__navToView('overview');
    await wait(25);
    window.__navToView('cashflow');
    await wait(30);
    const resetToIndivOk = Boolean(document.querySelector('#tillRecentPanel [data-cf-mode="entries"].active') && !document.querySelector('#tillRecentPanel [data-cf-mode="daily"].active'));

    // B. Unified single-page #cashflow: zero sub-tab bar (#hubSubtabBar absent), embedded visual charts (clean round $0 ticks, Operating vs Treasury split, Daily 30d toggle) & #tillBridgePanel By Stream <-> Monthly Progression toggle
    const noSubtabBarOnCf = !document.getElementById('hubSubtabBar');
    const hasExplainer = Boolean(document.querySelector('#workspace .cf-explainer-bar'));
    const svgTexts = Array.from(document.querySelectorAll('#workspace svg text')).map(t => t.textContent.trim());
    const cleanTicksOk = svgTexts.includes('$0') && !svgTexts.includes('$32') && !svgTexts.includes('-$504') && !svgTexts.includes('$568') && !svgTexts.includes('$2.13M');

    // Toggle #tillBridgePanel to Monthly Progression (22 Months)
    const defaultStreamModeOk = Boolean(document.querySelector('#tillBridgePanel [data-cf-bridge-mode="streams"].active'));
    document.querySelector('#tillBridgePanel [data-cf-bridge-mode="months"]')?.click();
    await wait(35);
    const progPanel = document.getElementById('tillBridgePanel');
    const progTxt = (progPanel ? progPanel.textContent : '').replace(/\\s+/g, ' ');
    const progCells = progPanel ? Array.from(progPanel.querySelectorAll('td')).map(td => td.textContent.trim()) : [];
    const horizReconOk = progTxt.toUpperCase().includes('TREASURY & FX IN ($)') && progTxt.toUpperCase().includes('SWEEPS & FX OUT ($)') && !progCells.includes('-$0') && !progCells.includes('-$0.00');

    // Click Oct 2026 month drill button inside #tillBridgePanel -> filters #tillRecentPanel on the same page to Oct 2026
    document.querySelector('#tillBridgePanel .cf-month-drill-btn[data-cf-focus-ym="2026-10"]')?.click();
    await wait(35);
    const octDrillPill = (document.querySelector('#tillRecentPanel .cf-drill-strip')?.textContent || '').replace(/\\s+/g, ' ').trim();
    const octDrillOk = octDrillPill.includes('Oct 2026');
    document.querySelector('#tillRecentPanel [data-cf-clear-drill="all"]')?.click();
    await wait(25);
    document.querySelector('#tillBridgePanel [data-cf-bridge-mode="streams"]')?.click();
    await wait(25);

    // Toggle Till Balance chart to Daily (Last 30d) right on #cashflow
    document.querySelector('[data-cf-chart-grain="daily"]')?.click();
    await wait(35);
    const dailyChartTitle = (document.getElementById('workspace')?.textContent || '');
    const dailyBarCnt = document.querySelectorAll('#workspace svg g.cf-chart-bar[data-cf-focus-date]').length;
    const dailyChartOk = dailyChartTitle.includes('Last 30 Operating Days') && dailyBarCnt === 30;
    document.querySelector('[data-cf-chart-grain="monthly"]')?.click();
    await wait(25);

    const overflowPx = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);

    // Entry seat u4 confidentiality check on #cashflow (#tillRecentPanel 1st, 0 confidential salary/external/extended/borrowing chips or rows)
    await T.performLogin('scale1.wtc@bhfirms.com', '4444', { bypass2FA: true });
    window.__navToView('cashflow');
    await wait(35);
    const u4FirstPanel = (document.querySelector('#workspace .panel-card[id]') || {}).id || '';
    const u4NoConfChips = !document.querySelector('#tillRecentPanel [data-chip="cf_sal"]') && !document.querySelector('#tillRecentPanel [data-chip="cf_ext"]') && !document.querySelector('#tillRecentPanel [data-chip="cf_extd"]') && !document.querySelector('#tillRecentPanel [data-chip="cf_loan"]');
    const u4BodyTxt = (document.querySelector('#tillRecentPanel tbody')?.textContent || '');
    const u4NoConfRows = !u4BodyTxt.includes('Salary Paid') && !u4BodyTxt.includes('External Out') && !u4BodyTxt.includes('Extended Out');

    // Restore Owner & Overview
    await T.performLogin('husseinbdeir@bhfirms.com', '1111', { bypass2FA: true });
    document.querySelector('#companySwitch .entity-btn[data-company="manufacturing-group"]').click();
    window.__navToView('overview');
    await wait(30);

    return {
      ok: Boolean(recentFirstOk && defaultIndivOk && resetToIndivOk && noSubtabBarOnCf && defaultStreamModeOk && no5300CfOk && hasNineStreamTotal && dailyOk && drillDayOk && clearedOk && hasExplainer && cleanTicksOk && horizReconOk && octDrillOk && dailyChartOk && overflowPx === 0 && u4FirstPanel === 'tillRecentPanel' && u4NoConfChips && u4NoConfRows),
      recentFirstOk, defaultIndivOk, resetToIndivOk, noSubtabBarOnCf, defaultStreamModeOk, no5300CfOk, extChipOk, extdChipOk, salChipOk, loanChipOk, hasNineStreamTotal, dailyOk, drillDayOk, clearedOk, hasExplainer, cleanTicksOk, horizReconOk, octDrillOk, dailyChartOk, overflowPx, u4FirstPanel, u4NoConfChips, u4NoConfRows,
      allEntriesTfoot, extTfoot, extdTfoot, salTfoot, loanTfoot, drillDayTfoot
    };
  })()`);
  cashTillUxProbe && cashTillUxProbe.ok
    ? pass('Cash Till UX & Analytics (#tillRecentPanel 1st at top, defaults to Individual Entries, 0 "Account 5300"/"Till 5300", External + Extended + Salary + Borrowing + FX streams, Daily Till Sheet + drill & Entry RLS)', `WTC=${cashTillUxProbe.allEntriesTfoot} · overflow=${cashTillUxProbe.overflowPx}px`)
    : fail('Cash Till UX & Analytics', JSON.stringify(cashTillUxProbe));

  // 7t. Expense Categories & Subcategories Total-Spent Descending Sort, GL-Backed Cost Class Badges (0 $NaN), & Activity-First Registry Sorting
  const catSortAndCostClassProbe = await evaluate(`(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const parseMoney = s => Number(String(s || '').replace(/[^0-9.-]+/g, '')) || 0;
    const parseCount = s => Number(String(s || '').replace(/[^0-9.-]+/g, '')) || 0;

    document.querySelector('#companySwitch .entity-btn[data-company="manufacturing-group"]')?.click();
    document.querySelector('#dateGrainBar [data-grain="all"]')?.click();
    await wait(30);

    // 1. #reg_categories -> Expense Categories (45)
    window.__navToView('reg_categories');
    await wait(50);
    document.querySelector('#univRegPanel [data-univ-reg-key="expense_categories"]')?.click();
    await wait(40);
    document.querySelector('#univRegPanel [data-tbl-view="all"]')?.click();
    await wait(30);

    const catPanelText = document.getElementById('univRegPanel')?.textContent || '';
    const catNoNaN = !/\\$NaN|\\bNaN\\b/.test(catPanelText);
    const catRows = Array.from(document.querySelectorAll('#univRegPanel tbody tr.rrow')).map(tr => {
      const tds = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.replace(/\\s+/g, ' ').trim());
      return { name: tds[0], costClass: tds[1], subCount: parseCount(tds[2]), bills: parseCount(tds[3]), spent: parseMoney(tds[4]), spentTxt: tds[4] };
    });
    const catTopIsFuel = catRows.length >= 10 && /^Fuel\\b/.test(catRows[0].name) && catRows[0].costClass === 'Production Cost' && Math.abs(catRows[0].spent - 2499933.55) < 1;
    const catSecondIsCapex = catRows.length >= 2 && /^Capital Expenditures\\b/.test(catRows[1].name) && catRows[1].costClass === 'Capital Expenditure' && Math.abs(catRows[1].spent - 1776293.00) < 1;
    const prodBadgeEl = document.querySelectorAll('#univRegPanel tbody tr.rrow')[0]?.querySelector('td:nth-child(2) .badge');
    const capexBadgeEl = document.querySelectorAll('#univRegPanel tbody tr.rrow')[1]?.querySelector('td:nth-child(2) .badge');
    const opexBadgeEl = document.querySelectorAll('#univRegPanel tbody tr.rrow')[2]?.querySelector('td:nth-child(2) .badge');
    const catCapexBadgeOk = Boolean(
      prodBadgeEl && prodBadgeEl.classList.contains('badge-cost-prod') &&
      capexBadgeEl && capexBadgeEl.classList.contains('badge-cost-capex') && !capexBadgeEl.classList.contains('badge-warn') &&
      opexBadgeEl && opexBadgeEl.classList.contains('badge-cost-opex')
    );
    const catMonotonicDesc = catRows.every((r, i) => i === 0 || r.spent <= catRows[i - 1].spent + 0.01);
    const catAllClassesValid = catRows.every(r => /^(Production Cost|Operating Expense|Capital Expenditure)$/.test(r.costClass));
    const catViewBtns = Array.from(document.querySelectorAll('#univRegPanel [data-tbl-view]'));
    const catFourViewsOk = catViewBtns.length === 4;

    // Open Fuel 360° Inspector -> verify Subcategories subgrid sorted by total_spent desc
    const fuelRowEl = document.querySelector('#univRegPanel tbody tr.rrow');
    if (fuelRowEl) fuelRowEl.click();
    await wait(60);
    const sgEcSub = document.getElementById('subgrid_sg_ec_sub');
    const sgEcSubText = sgEcSub ? sgEcSub.textContent : '';
    const sgEcRows = sgEcSub ? Array.from(sgEcSub.querySelectorAll('tbody tr.rrow')).map(tr => {
      const tds = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.replace(/\\s+/g, ' ').trim());
      return { name: tds[0], spent: parseMoney(tds[3]) };
    }) : [];
    const sgEcSubOk = sgEcRows.length >= 5 && sgEcRows[0].spent > 0 && sgEcRows.every((r, i) => i === 0 || r.spent <= sgEcRows[i - 1].spent + 0.01) && !/\\$NaN|\\bNaN\\b/.test(sgEcSubText);
    (document.getElementById('inspectorDoneBtn') || document.getElementById('inspectorCloseBtn'))?.click();
    await wait(30);

    // 2. Expense Subcategories (644) -> sorted by total_spent desc, 0 $NaN
    document.querySelector('#univRegPanel [data-univ-reg-key="expense_subcategories"]')?.click();
    await wait(50);
    const subPanelText = document.getElementById('univRegPanel')?.textContent || '';
    const subNoNaN = !/\\$NaN|\\bNaN\\b/.test(subPanelText);
    const subRows = Array.from(document.querySelectorAll('#univRegPanel tbody tr.rrow')).map(tr => {
      const tds = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.replace(/\\s+/g, ' ').trim());
      return { name: tds[0], category: tds[1], bills: parseCount(tds[2]), spent: parseMoney(tds[3]) };
    });
    const subSortedDescOk = subRows.length >= 15 && subRows[0].spent > 500000 && subRows.every((r, i) => i === 0 || r.spent <= subRows[i - 1].spent + 0.01);

    // 3. Universal Registries activity-first default sorting (Customers, Drivers, Products, Regions)
    window.__navToView('reg_customers');
    await wait(45);
    const custLoads = Array.from(document.querySelectorAll('#univRegPanel tbody tr.rrow')).slice(0, 10).map(tr => parseCount(tr.querySelectorAll('td')[9]?.textContent));
    const custSortedOk = custLoads.length >= 5 && custLoads[0] > 500 && custLoads.every((v, i) => i === 0 || v <= custLoads[i - 1]);

    window.__navToView('reg_drivers');
    await wait(45);
    const drvLoads = Array.from(document.querySelectorAll('#univRegPanel tbody tr.rrow')).slice(0, 10).map(tr => parseCount(tr.querySelectorAll('td')[5]?.textContent));
    const drvSortedOk = drvLoads.length >= 5 && drvLoads[0] > 500 && drvLoads.every((v, i) => i === 0 || v <= drvLoads[i - 1]);

    window.__navToView('reg_products');
    await wait(45);
    const prodLoads = Array.from(document.querySelectorAll('#univRegPanel tbody tr.rrow')).slice(0, 8).map(tr => parseCount(tr.querySelectorAll('td')[9]?.textContent));
    const prodSortedOk = prodLoads.length >= 5 && prodLoads[0] > 1000 && prodLoads.every((v, i) => i === 0 || v <= prodLoads[i - 1]);

    // 4. 34-Table Hub (#tables) -> logistics_allowances has 0 NaN on working_days & sorts by daily_usd desc
    window.__navToView('tables');
    await wait(45);
    document.querySelector('[data-hub-tbl="logistics_allowances"]')?.click();
    await wait(45);
    const logHubText = document.getElementById('tablesHubPanel')?.textContent || '';
    const logHubRates = Array.from(document.querySelectorAll('#tablesHubPanel tbody tr.rrow')).slice(0, 10).map(tr => parseMoney(tr.querySelectorAll('td')[5]?.textContent));
    const logHubOk = !/\\$NaN|\\bNaN\\b/.test(logHubText) && logHubRates.length >= 3 && logHubRates[0] >= logHubRates[logHubRates.length - 1];

    window.__navToView('overview');
    await wait(30);

    return {
      ok: Boolean(catNoNaN && catTopIsFuel && catSecondIsCapex && catCapexBadgeOk && catMonotonicDesc && catAllClassesValid && catFourViewsOk && sgEcSubOk && subNoNaN && subSortedDescOk && custSortedOk && drvSortedOk && prodSortedOk && logHubOk),
      catNoNaN, catTopIsFuel, catSecondIsCapex, catCapexBadgeOk, catMonotonicDesc, catAllClassesValid, catFourViewsOk,
      sgEcSubOk, subNoNaN, subSortedDescOk, custSortedOk, drvSortedOk, prodSortedOk, logHubOk,
      topCat: catRows[0], secondCat: catRows[1], topSub: subRows[0]
    };
  })()`);
  catSortAndCostClassProbe && catSortAndCostClassProbe.ok
    ? pass('Expense Categories & Subcategories total_spent desc sort (Fuel $2,499,933.55 #1), Lebanese CoA Cost Class badges (0 $NaN), 360° subgrid & Universal Registry activity-first default sorts', `topCat=${catSortAndCostClassProbe.topCat?.name} (${catSortAndCostClassProbe.topCat?.spentTxt}, ${catSortAndCostClassProbe.topCat?.costClass}) · topSub=${catSortAndCostClassProbe.topSub?.name}`)
    : fail('Expense Categories/Subcategories sort, Cost Class $NaN fix & activity-first registry sorting', JSON.stringify(catSortAndCostClassProbe));

  // Institutional Chart Explanation Popover Card (#mfgChartPopover & #execChartTip) — 0 native <title> black boxes
  const chartPopoverProbe = await evaluate(`(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    window.__navToView('overview');
    await wait(50);
    const ovSvgTitles = document.querySelectorAll('#workspace svg title').length;
    const execCol = document.querySelector('#execChartWrap .col[data-chart-pop]');
    if (execCol) {
      const r = execCol.getBoundingClientRect();
      execCol.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + 20 }));
      execCol.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + 20 }));
    }
    const execTip = document.getElementById('execChartTip');
    const execTipOpen = Boolean(execTip && !execTip.hidden && execTip.querySelector('.chart-pop-hdr') && execTip.querySelectorAll('.chart-pop-row').length === 3);
    const execTipBg = execTip ? getComputedStyle(execTip).backgroundColor : '';
    const execTipLightOk = /255,\\s*255,\\s*255/.test(execTipBg);

    window.__navToView('cashflow_analytics');
    await wait(60);
    const cfSvgTitles = document.querySelectorAll('#workspace svg title').length;
    const cfCol = document.querySelector('#workspace svg [data-chart-pop], #workspace [data-chart-pop]');
    if (cfCol) {
      const r = cfCol.getBoundingClientRect();
      cfCol.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + 20 }));
    }
    const popEl = document.getElementById('mfgChartPopover');
    const popOpen = Boolean(popEl && !popEl.hidden && popEl.querySelector('.chart-pop-hdr') && popEl.querySelectorAll('.chart-pop-row').length >= 1);
    const popBg = popEl ? getComputedStyle(popEl).backgroundColor : '';
    const popLightOk = /255,\\s*255,\\s*255/.test(popBg);
    const popTitle = popEl?.querySelector('.chart-pop-title')?.textContent?.trim() || '';

    window.__navToView('pbi');
    await wait(60);
    const pbiSvgTitles = document.querySelectorAll('#workspace svg title').length;
    const pbiPopCount = document.querySelectorAll('#workspace [data-chart-pop]').length;
    const pbiCol = document.querySelector('#workspace svg [data-chart-pop]');
    if (pbiCol) {
      const r = pbiCol.getBoundingClientRect();
      pbiCol.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + 20 }));
    }
    const pbiPopOpen = Boolean(popEl && !popEl.hidden && popEl.querySelector('.chart-pop-hdr') && popEl.querySelectorAll('.chart-pop-row').length >= 1);
    window.__navToView('overview');
    await wait(30);
    return {
      ok: Boolean(ovSvgTitles === 0 && cfSvgTitles === 0 && pbiSvgTitles === 0 && execTipOpen && execTipLightOk && popOpen && pbiPopOpen && popLightOk && pbiPopCount >= 10),
      ovSvgTitles, cfSvgTitles, pbiSvgTitles, execTipOpen, execTipBg, popOpen, pbiPopOpen, popBg, popTitle, pbiPopCount
    };
  })()`);
  chartPopoverProbe && chartPopoverProbe.ok
    ? pass('Institutional Chart Explanation Popover (#mfgChartPopover & #execChartTip) · 0 native <title> black boxes, light Rev 10 Ledger card + multi-series swatches', `popTitle=${chartPopoverProbe.popTitle} · pbiPopCount=${chartPopoverProbe.pbiPopCount} · bg=${chartPopoverProbe.popBg}`)
    : fail('Institutional Chart Explanation Popover', JSON.stringify(chartPopoverProbe));

  // Overhead Analytics (#expenses_analytics / p07_ap) horizontal bar chart & 3-leg schedule descending ranking (All-Time & Period-filtered)
  const apRankingProbe = await evaluate(`(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const parseMoney = s => {
      const m = String(s || '').replace(/,/g, '').match(/-?\\$?\\d+(?:\\.\\d+)?/);
      if (!m) return 0;
      const clean = m[0].replace('$', '');
      return Number(clean) || 0;
    };
    // Switch to WTC + #expenses_analytics
    const wtcBtn = document.querySelector('#companySwitchList [data-company="wtc"]');
    if (wtcBtn) wtcBtn.click();
    window.__navToView('expenses_analytics');
    await wait(60);
    const resetBtn = document.getElementById('dateRangeResetBtn');
    if (resetBtn && !resetBtn.hidden) resetBtn.click();
    await wait(40);

    const getBarPanelVals = titleText => {
      const panels = Array.from(document.querySelectorAll('#workspace .pbi-panel'));
      const pnl = panels.find(p => (p.querySelector('.pbi-panel-title')?.textContent || '').includes(titleText));
      if (!pnl) return [];
      return Array.from(pnl.querySelectorAll('.pbi-bar-item')).map(r => {
        let label = '';
        try { label = JSON.parse(r.getAttribute('data-chart-pop') || '{}').title || ''; } catch (_) {}
        if (!label) label = (r.querySelector('.pbi-bar-lbl')?.textContent || '').replace(/^\d+\.\s*/, '').split('·')[0].trim();
        return {
          label: label.trim(),
          val: parseMoney(r.querySelector('.pbi-bar-val')?.textContent || '')
        };
      });
    };

    const allTimeApBars = getBarPanelVals('Payables by supplier / hauler');
    const allTimeVolBars = getBarPanelVals('Raw material & haulage volume by supplier');
    const allTimeApSorted = allTimeApBars.length >= 5 && allTimeApBars.every((r, i) => i === 0 || r.val <= allTimeApBars[i - 1].val + 0.01);
    const allTimeVolSorted = allTimeVolBars.length >= 5 && allTimeVolBars.every((r, i) => i === 0 || r.val <= allTimeVolBars[i - 1].val + 0.01);

    // Apply 2025-12-31 to 2027-01-01 date range
    const df = document.getElementById('dateFromInput');
    const dt = document.getElementById('dateToInput');
    if (df && dt) {
      df.value = '2025-12-31';
      df.dispatchEvent(new Event('change', { bubbles: true }));
      dt.value = '2027-01-01';
      dt.dispatchEvent(new Event('change', { bubbles: true }));
    }
    await wait(60);

    const periodApBars = getBarPanelVals('Payables by supplier / hauler');
    const periodVolBars = getBarPanelVals('Raw material & haulage volume by supplier');
    const periodApSorted = periodApBars.length >= 5 && periodApBars[0].label === 'Shacman Lebanon s.a.l' && periodApBars.every((r, i) => i === 0 || r.val <= periodApBars[i - 1].val + 0.01);
    const periodVolSorted = periodVolBars.length >= 5 && periodVolBars[0].label === 'ALI KLAIT' && periodVolBars[1].label === 'Haj Ibrahim' && periodVolBars.every((r, i) => i === 0 || r.val <= periodVolBars[i - 1].val + 0.01);

    // Check 3-leg schedule table sorted by Closing AP Balance desc & Leg 1 + Leg 2 (+ Leg 3) == Total
    const schedPanel = Array.from(document.querySelectorAll('#workspace .pbi-panel')).find(p => (p.querySelector('.pbi-panel-title')?.textContent || '').includes('Supplier 3-leg payables'));
    const ths = schedPanel ? Array.from(schedPanel.querySelectorAll('thead th')).map(th => th.textContent.trim()) : [];
    const idxLeg1 = ths.findIndex(t => /Leg 1/i.test(t));
    const idxLeg2 = ths.findIndex(t => /Leg 2/i.test(t));
    const idxLeg3 = ths.findIndex(t => /Leg 3/i.test(t));
    const idxTotCr = ths.findIndex(t => /Total on Credit/i.test(t));
    const idxRawCost = ths.findIndex(t => /Total Raw Cost/i.test(t));
    const schedRows = schedPanel ? Array.from(schedPanel.querySelectorAll('tbody tr')).slice(0, 10).map(tr => {
      const tds = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
      return {
        supp: tds[0],
        leg1: idxLeg1 >= 0 ? parseMoney(tds[idxLeg1]) : 0,
        leg2: idxLeg2 >= 0 ? parseMoney(tds[idxLeg2]) : 0,
        leg3: idxLeg3 >= 0 ? parseMoney(tds[idxLeg3]) : 0,
        totCr: idxTotCr >= 0 ? parseMoney(tds[idxTotCr]) : 0,
        rawCost: idxRawCost >= 0 ? parseMoney(tds[idxRawCost]) : 0,
        closingAp: parseMoney(tds[tds.length - 1])
      };
    }) : [];
    const schedSortedOk = schedRows.length >= 5 && schedRows[0].supp === 'Shacman Lebanon s.a.l' && schedRows.every((r, i) => i === 0 || r.closingAp <= schedRows[i - 1].closingAp + 0.01);
    const schedLegsConsistent = schedRows.length >= 5 && schedRows.every(r => idxTotCr >= 0 ? Math.abs((r.leg1 + r.leg2 + r.leg3) - r.totCr) <= 2 : Math.abs((r.leg1 + r.leg2) - r.rawCost) <= 2);

    // Restore All-Time + All Group
    const rst = document.getElementById('dateRangeResetBtn');
    if (rst && !rst.hidden) rst.click();
    const allGrpBtn = document.querySelector('#companySwitchList [data-company="manufacturing-group"]');
    if (allGrpBtn) allGrpBtn.click();
    window.__navToView('overview');
    await wait(40);

    return {
      ok: Boolean(allTimeApSorted && allTimeVolSorted && periodApSorted && periodVolSorted && schedSortedOk && schedLegsConsistent),
      allTimeApSorted,
      allTimeVolSorted,
      periodApSorted,
      periodVolSorted,
      schedSortedOk,
      schedLegsConsistent,
      topAp: periodApBars.slice(0, 3).map(x => x.label + ':' + x.val).join(', '),
      topVol: periodVolBars.slice(0, 3).map(x => x.label + ':' + x.val).join(', ')
    };
  })()`);
  apRankingProbe && apRankingProbe.ok
    ? pass('Overhead Analytics (#expenses_analytics) bar chart & 3-leg schedule ranking · descending by metric (All-Time & Period-filtered) + period Leg 1+Leg 2 = Total Raw Cost', `AP=[${apRankingProbe.topAp}] · Vol=[${apRankingProbe.topVol}]`)
    : fail('Overhead Analytics bar chart & 3-leg schedule ranking', JSON.stringify(apRankingProbe));


  // 8. Runtime errors
  const errs = events.filter(e => e.method === 'Runtime.exceptionThrown').map(e => (e.params.exceptionDetails.exception || {}).description || e.params.exceptionDetails.text);
  const logErrs = events.filter(e => e.method === 'Log.entryAdded' && e.params.entry.level === 'error' && !/favicon|fonts|net::ERR|relay|404/.test(e.params.entry.text)).map(e => e.params.entry.text);
  errs.length === 0 ? pass('0 runtime exceptions') : fail('runtime exceptions', errs.slice(0, 3).join(' || '));
  logErrs.length === 0 ? pass('0 console errors') : fail('console errors', logErrs.slice(0, 3).join(' || '));
} catch (e) {
  fail('harness', e.message);
} finally {
  try { ws && ws.close(); } catch (_) {}
  try { execFileSync('taskkill', ['/F', '/T', '/PID', String(edge.pid)], { stdio: 'ignore', windowsHide: true }); } catch (_) { try { edge.kill(); } catch (__) {} }
  try { execFileSync('taskkill', ['/F', '/T', '/PID', String(server.pid)], { stdio: 'ignore', windowsHide: true }); } catch (_) { try { server.kill(); } catch (__) {} }
  await sleep(400);
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch (_) {}
  const failed = results.filter(r => !r.ok);
  console.log(`\n${failed.length ? 'VERIFY FAILED' : 'VERIFY ALL GREEN'} · ${results.length - failed.length} pass / ${failed.length} fail · ${MOBILE ? 'mobile 390×844' : 'desktop 1366×768'}`);
  process.exit(failed.length ? 1 : 0);
}
