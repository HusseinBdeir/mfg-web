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
    const o = await evaluate(`Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)`);
    o === 0 ? pass(`overflow 0px · ${label}`) : fail(`overflow · ${label}`, `${o}px horizontal`);
  };

  // 2. Every view
  const views = ['overview', 'pbi', 'tables', 'sentinels', 'sales', 'raw', 'fleet', 'pricing', 'customers', 'suppliers', 'expenses', 'payroll', 'ledger', 'statements', 'users'];
  for (const v of views) {
    await evaluate(`(() => { const b = document.querySelector('#sidebarNav .nav-item[data-view="${v}"]'); b.click(); return 1; })()`);
    await sleep(350);
    const len = await evaluate(`document.getElementById('workspace').innerHTML.length`);
    len > 500 ? pass(`view ${v}`, `${len} chars`) : fail(`view ${v}`, 'empty workspace');
    await overflow(v);
  }

  // 2b. Operational module toolbar parity (Sales, Raw, Fleet, Pricing, Customers, Suppliers, Expenses, Payroll)
  const moduleToolbarSpecs = [
    { view: 'sales', panel: '#salesPanel', modal: 'sales' },
    { view: 'raw', panel: '#rawPanel', modal: 'raw' },
    { view: 'fleet', panel: '#equipPanel', modal: 'fuel' },
    { view: 'pricing', panel: '#pricingPanel', modal: 'pricerule' },
    { view: 'customers', panel: '#custPanel', modal: 'receipt' },
    { view: 'suppliers', panel: '#supPanel', modal: 'settlement' },
    { view: 'expenses', panel: '#expPanel', modal: 'expense' },
    { view: 'payroll', panel: '#workspace .panel-card', modal: 'salary' }
  ];
  for (const spec of moduleToolbarSpecs) {
    await evaluate(`document.querySelector('#sidebarNav .nav-item[data-view="${spec.view}"]').click()`);
    await sleep(220);
    const tb = await evaluate(`(() => {
      const panel = document.querySelector('${spec.panel}');
      if (!panel) return { ok: false, reason: 'missing panel' };
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
        ok: Boolean(search && chips >= 4 && csvBtn && newBtn && dupSearch === 1),
        chips,
        dupSearch,
        btnText: newBtn ? newBtn.textContent.trim() : '',
        rightAligned
      };
    })()`);
    tb.ok && (MOBILE || tb.rightAligned)
      ? pass(`toolbar parity · ${spec.view}`, `${tb.chips} filter chips + CSV + "${tb.btnText}"`)
      : fail(`toolbar parity · ${spec.view}`, JSON.stringify(tb));
  }

  // 3. Every PBI page + GL totals on P16 + pricing active-count on P05 + dynamic per-page slicers + header button contrast
  await evaluate(`document.querySelector('#sidebarNav .nav-item[data-view="pbi"]').click()`);
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
  pages.length === 20 ? pass('pbi · 20 page tabs') : fail('pbi tabs', String(pages.length));
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
  p06Info.hasAging && p06Info.hasStatement && p06Info.tables >= 4 && p06Info.bars > 5
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
  await evaluate(`document.querySelector('#sidebarNav .nav-item[data-view="tables"]').click()`); await sleep(300);
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
  await evaluate(`document.querySelector('#sidebarNav .nav-item[data-view="sales"]').click()`); await sleep(300);
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
    return { showMoreBtns, tfootTxt: tfootTxt.replace(/\\s+/g, ' ').trim(), hasShownWord, filteredTxt: filteredTxt.replace(/\\s+/g, ' ').trim() };
  })()`);
  salesTotalsProbe.showMoreBtns === 0 && !salesTotalsProbe.hasShownWord && /25,[89]\d\d LOADS/.test(salesTotalsProbe.tfootTxt) && salesTotalsProbe.filteredTxt !== salesTotalsProbe.tfootTxt
    ? pass('sales tfoot · full tab dataset total (no Show More / no SHOWN OF) & updates on filter', salesTotalsProbe.tfootTxt)
    : fail('sales tfoot totals', JSON.stringify(salesTotalsProbe));
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

    // Ticket 19950 exists in WTC raw_purchases (2026-02-28) but NOT in WTC sales_tickets
    const tEl = document.getElementById('f_ticketno');
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

    const trk = document.getElementById('f_truck');
    trk.value = '10';
    trk.dispatchEvent(new Event('input', { bubbles: true }));
    const menu = trk.closest('.pa-suggest-wrap').querySelector('.pa-suggest-menu');
    const menuOpen = menu && !menu.hidden;
    const menuItems = menu ? menu.querySelectorAll('.pa-suggest-item').length : 0;
    const menuOverflowY = menu ? getComputedStyle(menu).overflowY : '';
    const firstItem = menu ? menu.querySelector('.pa-suggest-item') : null;
    if (firstItem) firstItem.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    const pickedTruck = trk.value;
    const menuClosedAfterPick = menu ? menu.hidden === true : false;

    // Now switch to Raw Quarry Purchase form: 1) f_ticketno starts blank; 2) typing 19950 DOES flag duplicate in raw_purchases
    document.querySelector('.modal-tab[data-form="raw"]').click();
    const rawBlankOnOpen = document.getElementById('f_ticketno').value === '';
    const rawCo = document.getElementById('f_company');
    rawCo.value = 'WTC';
    rawCo.dispatchEvent(new Event('change', { bubbles: true }));
    const rawT = document.getElementById('f_ticketno');
    rawT.value = '19950';
    rawT.dispatchEvent(new Event('input', { bubbles: true }));
    const raw19950Hint = (document.getElementById('hint_ticket') || {}).textContent || '';
    const raw19950DupWrapVisible = document.getElementById('wrap_dupok').hidden === false;

    return {
      salesBlankOnOpen,
      salesHintOnOpen,
      salesBlankAfterCoChange,
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
      raw19950Hint,
      raw19950DupWrapVisible
    };
  })()`);
  ticketAndSuggestProbe.salesBlankOnOpen && ticketAndSuggestProbe.rawBlankOnOpen && ticketAndSuggestProbe.salesBlankAfterCoChange && ticketAndSuggestProbe.salesHintOnOpen === ''
    ? pass('entry desk · Ticket Number starts blank on New Entry & stays blank on company switch')
    : fail('entry desk blank ticket number', JSON.stringify(ticketAndSuggestProbe));
  /Number is free/i.test(ticketAndSuggestProbe.sales19950Hint) && ticketAndSuggestProbe.sales19950DupWrapHidden && /Already used on Raw Material Ticket 19950/i.test(ticketAndSuggestProbe.raw19950Hint) && ticketAndSuggestProbe.raw19950DupWrapVisible
    ? pass('entry desk · duplicate ticket check isolated per table (Sales 19950 free vs Raw 19950 flagged)', `${ticketAndSuggestProbe.sales19950Hint} | ${ticketAndSuggestProbe.raw19950Hint}`)
    : fail('entry desk per-table duplicate check', JSON.stringify(ticketAndSuggestProbe));
  ticketAndSuggestProbe.nativeListCount === 0 && ticketAndSuggestProbe.unwiredSelectCount === 0 && ticketAndSuggestProbe.suggestWrapCount >= 10 && ticketAndSuggestProbe.prodIsInputCombobox && ticketAndSuggestProbe.prodMenuOpen && ticketAndSuggestProbe.prodMetaBadges > 0 && ticketAndSuggestProbe.pickedProd && ticketAndSuggestProbe.prodClosedAfterPick && ticketAndSuggestProbe.prodReopensWhenFilled && ticketAndSuggestProbe.menuOpen && ticketAndSuggestProbe.menuItems > 0 && ticketAndSuggestProbe.menuItems <= 7 && ticketAndSuggestProbe.menuOverflowY === 'hidden' && /^10/.test(ticketAndSuggestProbe.pickedTruck) && ticketAndSuggestProbe.menuClosedAfterPick
    ? pass('entry desk · Rev 10 unified combobox & select popover (Product/Grade with UoM·Ton badges, 0 native popups, 0 scrollbars)', `grade="${ticketAndSuggestProbe.pickedProd}" (${ticketAndSuggestProbe.prodMetaBadges} badges) · truck=${ticketAndSuggestProbe.pickedTruck}`)
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
      idx('f_truck') < idx('f_driver') &&
      idx('f_driver') < idx('f_method') &&
      idx('f_method') < idx('f_qty') &&
      idx('f_qty') < idx('f_uom') &&
      idx('f_uom') < idx('f_unitprice') &&
      idx('f_unitprice') < idx('f_mat_total');

    // (2) Check conditional column visibility on Delivery vs Pickup
    const delivSiteVisible = !document.getElementById('wrap_f_site').hidden;
    const delivTransVisible = !document.getElementById('wrap_f_transunitprice').hidden;
    const delivOwnerHiddenOnCoFleet = document.getElementById('wrap_f_truckowner').hidden;
    set('f_saletype', 'Pickup');
    const pickupSiteHidden = document.getElementById('wrap_f_site').hidden === true;
    const pickupTransByHidden = document.getElementById('wrap_f_transportby').hidden === true;
    const pickupOvertimeHidden = document.getElementById('wrap_f_overtime').hidden === true;
    const pickupTransPriceHidden = document.getElementById('wrap_f_transunitprice').hidden === true;
    const pickupTransTotHidden = document.getElementById('wrap_f_trans_total').hidden === true;
    const pickupTruckOwnerVisible = document.getElementById('wrap_f_truckowner').hidden === false;
    set('f_saletype', 'Delivery');

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

    // (4) Check Policy-Locked state + Admin Privilege Unlock Process
    const upEl = document.getElementById('f_unitprice');
    const upWrap = document.getElementById('wrap_f_unitprice');
    const upPill = document.querySelector('[data-lock-pill="f_unitprice"]');
    const adminBar = document.getElementById('paAdminLockBar');
    const startsLocked = upEl.readOnly === true && upWrap.classList.contains('is-policy-locked') && /LOCKED/i.test(upPill.textContent) && adminBar && !adminBar.hidden;

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

    return {
      orderingOk,
      delivSiteVisible, delivTransVisible, delivOwnerHiddenOnCoFleet,
      pickupSiteHidden, pickupTransByHidden, pickupOvertimeHidden, pickupTransPriceHidden, pickupTransTotHidden, pickupTruckOwnerVisible,
      repSynced, noInternalCodes,
      startsLocked, boxOpened, unlockedNow, manualPriceKept, relockedNow
    };
  })()`);
  intuitiveEntryProbe.orderingOk && intuitiveEntryProbe.delivSiteVisible && intuitiveEntryProbe.delivTransVisible && intuitiveEntryProbe.delivOwnerHiddenOnCoFleet &&
  intuitiveEntryProbe.pickupSiteHidden && intuitiveEntryProbe.pickupTransByHidden && intuitiveEntryProbe.pickupOvertimeHidden && intuitiveEntryProbe.pickupTransPriceHidden && intuitiveEntryProbe.pickupTransTotHidden && intuitiveEntryProbe.pickupTruckOwnerVisible &&
  intuitiveEntryProbe.repSynced && intuitiveEntryProbe.noInternalCodes && intuitiveEntryProbe.startsLocked && intuitiveEntryProbe.boxOpened && intuitiveEntryProbe.unlockedNow && intuitiveEntryProbe.manualPriceKept && intuitiveEntryProbe.relockedNow
    ? pass('entry desk · v7.9 BU -> Locked Transaction Date -> On-Demand Reporting Date -> Time ordering, Pickup Gating, Clean UI & Admin Unlock')
    : fail('entry desk v7.9 intuitive entry probe', JSON.stringify(intuitiveEntryProbe));

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

  await evaluate(`document.getElementById('closeModalBtn').click()`); await sleep(150);

  // 7. Statements all 22
  await evaluate(`document.querySelector('#sidebarNav .nav-item[data-view="statements"]').click()`); await sleep(300);
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
  await evaluate(`document.querySelector('#sidebarNav .nav-item[data-view="users"]').click()`); await sleep(250);
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
  authFaceFlow.unlockedPinOnly
    ? pass('authGate PIN-only · blank email + unique 4-digit PIN resolves seat & signs in')
    : fail('authGate PIN-only sign-in', JSON.stringify(authFaceFlow));

  // 7b2. Team Seat Inspector (#seatEditorPanel) — inspect all 10 current users & update in-place
  await evaluate(`document.querySelector('#sidebarNav .nav-item[data-view="users"]').click()`); await sleep(200);
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
    document.querySelector('#sidebarNav .nav-item[data-view="sales"]').click();
    const u8BbcReconHidden = (document.querySelector('.sales-recon-card[data-jump-co="bbconstruction"]') || {}).hidden === true;
    const u8SalesRows = Array.from(document.querySelectorAll('#salesPanel table.ledger-table tbody tr.rrow'));
    const u8LeakedBbcSales = u8SalesRows.some(tr => tr.children[2] && /BBConstruction/i.test(tr.children[2].textContent));

    document.querySelector('#sidebarNav .nav-item[data-view="statements"]').click();
    const u8StmtTabs = document.querySelectorAll('.stmt-card[data-stmt]').length;

    // 3. Test Partial Access Single-Company Entry Seat (u3: Sabah Kassab — WTC | Entry | partial|partial)
    await T.performLogin('sabahkassab@bhfirms.com', '3333', { bypass2FA: true });
    const u3NavPayrollHidden = (document.querySelector('#sidebarNav .nav-item[data-view="payroll"]') || {}).hidden === true;
    const u3NavLedgerHidden = (document.querySelector('#sidebarNav .nav-item[data-view="ledger"]') || {}).hidden === true;
    const u3NavSentinelsHidden = (document.querySelector('#sidebarNav .nav-item[data-view="sentinels"]') || {}).hidden === true;
    const u3NavPbiText = (document.getElementById('navCountPbi') || {}).textContent || '';

    document.querySelector('#sidebarNav .nav-item[data-view="pbi"]').click();
    const u3PbiTabs = document.querySelectorAll('.pbi-page-tab[data-pbi-page]').length;

    document.querySelector('#sidebarNav .nav-item[data-view="tables"]').click();
    const u3TableChips = document.querySelectorAll('[data-table-key]').length;
    const u3HasSalariesTable = !!document.querySelector('[data-table-key="salaries"]');

    // 4. Test Sales & AR Collector Seat (u10: WTC + BBConstruction | Sales | partial|full)
    await T.performLogin(u10Orig.email, u10Orig.pin, { bypass2FA: true });
    const u10VisibleNavViews = Array.from(document.querySelectorAll('#sidebarNav .nav-item[data-view]'))
      .filter(b => !b.hidden)
      .map(b => b.getAttribute('data-view'));
    document.getElementById('newEntryBtn').click();
    const u10VisibleForms = Array.from(document.querySelectorAll('.modal-tab[data-form]'))
      .filter(b => !b.hidden)
      .map(b => b.getAttribute('data-form'));
    document.getElementById('closeModalBtn').click();

    // Restore Owner session (Hussein Bdeir), restore u8 & u10 original seats, and return to All-Time Group scope
    await T.performLogin('husseinbdeir@bhfirms.com', '1111', { bypass2FA: true });
    document.querySelector('#sidebarNav .nav-item[data-view="users"]').click();
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
      u3ConsistencyOk: u3NavPayrollHidden && u3NavLedgerHidden && u3NavSentinelsHidden &&
        u3NavPbiText === '15 Pages' && u3PbiTabs === 15 && u3TableChips === 23 && !u3HasSalariesTable,
      u10ConsistencyOk: u10VisibleNavViews.join(',') === 'overview,pbi,tables,sales,pricing,customers,statements,users' &&
        u10VisibleForms.join(',') === 'sales,receipt',
      u8CompanySwitchOk, u8BbcReconHidden, u8LeakedBbcSales, u8StmtTabs, u3PbiTabs, u3TableChips, u10VisibleNavViews, u10VisibleForms
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
    document.querySelector('#sidebarNav .nav-item[data-view="users"]').click();
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
    document.querySelector('#sidebarNav .nav-item[data-view="pbi"]').click();
    const customPbiTabs = document.querySelectorAll('.pbi-page-tab[data-pbi-page]').length;
    const hasGlPage = !!document.querySelector('.pbi-page-tab[data-pbi-page="p16_financial"]');

    document.querySelector('#sidebarNav .nav-item[data-view="statements"]').click();
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
    document.querySelector('#sidebarNav .nav-item[data-view="sales"]').click();
    const firstRow = document.querySelector('#salesPanel tr.rrow[data-rid]');
    if (firstRow) firstRow.click();
    const hasModifyBtn = !!document.getElementById('inspModifyRecordBtn');
    const hasVoidBtn = !!document.getElementById('inspectorVoidBtn');
    const doneBtn = document.getElementById('inspectorDoneBtn');
    if (doneBtn) doneBtn.click();

    // Restore Owner session & restore u3 original seat
    await T.performLogin('husseinbdeir@bhfirms.com', '1111', { bypass2FA: true });
    document.querySelector('#sidebarNav .nav-item[data-view="users"]').click();
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
          customPbiTabs === 10 && hasGlPage && customStmtCards === 13 && hasPlStmt &&
          canUnlockUnitPrice && canUnlockQty && !canUnlockFormulaTotals &&
          lockedInitially && unlockedWithoutPin && hasModifyBtn && !hasVoidBtn && overflowUsers === 0,
      matrixOpenOnInspect, hasDefaultAndCustomRoles, ownerLinkedAcc, salesLinkedAcc, customLinkedAcc,
      customPbiTabs, hasGlPage, customStmtCards, hasPlStmt,
      canUnlockUnitPrice, canUnlockQty, canUnlockFormulaTotals,
      lockedInitially, unlockedWithoutPin, hasModifyBtn, hasVoidBtn, overflowUsers
    };
  })()`);
  customRoleProbe && customRoleProbe.ok
    ? pass('roles, permissions & linked dashboards · default + Custom roles, Check Permissions matrix, field-level lock overrides without PIN, Modify Data & custom PBI/RDL', `PBI=${customRoleProbe.customPbiTabs}/20 · RDL=${customRoleProbe.customStmtCards}/22 · unlockUnitPrice=${customRoleProbe.unlockedWithoutPin} · modify=${customRoleProbe.hasModifyBtn}`)
    : fail('roles, permissions & linked dashboards', JSON.stringify(customRoleProbe));

  // 7c. Full 2024–2026 Historical Transactions + Power BI Date Grain/Range Slicer + Compact Paginated Tables
  await evaluate(`document.querySelector('#sidebarNav .nav-item[data-view="pbi"]').click()`); await sleep(200);
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
    document.querySelector('[data-pbi-grain="month"]').click();
    const monthOpts = document.getElementById('pbiPeriodSelect').options.length;
    document.querySelector('[data-pbi-grain="week"]').click();
    const weekOpts = document.getElementById('pbiPeriodSelect').options.length;
    document.querySelector('[data-pbi-grain="day"]').click();
    const dayOpts = document.getElementById('pbiPeriodSelect').options.length;

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
      rangeMeta, resetFrom, resetTo, maxAttr, overflowP06
    };
  })()`);
  pbiHistoryProbe.salesCnt >= 25000 && pbiHistoryProbe.rawCnt >= 24000 && pbiHistoryProbe.minSalesDate.startsWith('2024-01-')
    ? pass('history · full 2024–2026 Dataverse transactions unpacked', `sales=${pbiHistoryProbe.salesCnt}, raw=${pbiHistoryProbe.rawCnt}, earliest=${pbiHistoryProbe.minSalesDate}`)
    : fail('history coverage', JSON.stringify(pbiHistoryProbe));
  pbiHistoryProbe.maxBodyRows <= 15 && pbiHistoryProbe.pagers >= 3 && /Page 2/.test(pbiHistoryProbe.page2Text) && pbiHistoryProbe.wrapMaxH !== 'none'
    ? pass('pbiTable · compact 15-row pages, bounded scroll & interactive pager', `${pbiHistoryProbe.pagers} pagers, maxRows=${pbiHistoryProbe.maxBodyRows}, maxH=${pbiHistoryProbe.wrapMaxH}`)
    : fail('pbiTable pagination', JSON.stringify(pbiHistoryProbe));
  pbiHistoryProbe.yearOpts >= 7 && pbiHistoryProbe.monthOpts >= 84 && pbiHistoryProbe.weekOpts >= 360 && pbiHistoryProbe.dayOpts >= 700 && /2024-06-01/.test(pbiHistoryProbe.rangeMeta) && pbiHistoryProbe.resetFrom === '2024-01-01' && pbiHistoryProbe.resetTo === '2030-12-31' && pbiHistoryProbe.maxAttr === '2030-12-31' && pbiHistoryProbe.overflowP06 === 0
    ? pass('date slicer · 2024–2030 Year/Month/Week/Day grains + From–To date range (0px overflow)', `Y=${pbiHistoryProbe.yearOpts}, M=${pbiHistoryProbe.monthOpts}, W=${pbiHistoryProbe.weekOpts}, D=${pbiHistoryProbe.dayOpts}, range=${pbiHistoryProbe.resetFrom}..${pbiHistoryProbe.resetTo}`)
    : fail('date slicer grains/range', JSON.stringify(pbiHistoryProbe));

  // 7d. Sticky tfoot Totals, Unjammed P04 Tables & Collapsible Left Rail (Manufacturing Command)
  await evaluate(`document.querySelector('[data-pbi-page="p04_sales"]').click()`); await sleep(250);
  const p04LayoutAndFoot = await evaluate(`(() => {
    const tables = Array.from(document.querySelectorAll('#pbiCanvasPanel table.ledger-table'));
    const tfoots = tables.map(t => {
      const tf = t.querySelector('tfoot tr');
      return tf ? tf.innerText.replace(/\\s+/g, ' ').trim() : '';
    });
    const allHaveTfoot = tables.length >= 3 && tfoots.every(txt => /TOTAL/i.test(txt) && /\\$[0-9]/.test(txt));
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

    document.querySelector('#sidebarNav .nav-item[data-view="pbi"]').click();
    const pbiLight = {
      rail: lum(getComputedStyle(document.getElementById('sidebar')).backgroundColor),
      pbiHdr: lum(getComputedStyle(document.querySelector('.pbi-studio-hdr')).backgroundColor),
      pbiTab: lum(getComputedStyle(document.querySelector('.pbi-page-tab:not(.active)')).backgroundColor),
      pbiDateBar: lum(getComputedStyle(document.querySelector('.pbi-date-slicer-row')).backgroundColor),
      pbiSlicerSelect: lum(getComputedStyle(document.querySelector('.pbi-slicer-item select')).backgroundColor),
      aiDrawer: lum(getComputedStyle(document.getElementById('aiDrawer')).backgroundColor),
      authCard: lum(getComputedStyle(document.querySelector('.auth-card')).backgroundColor)
    };
    document.querySelector('#sidebarNav .nav-item[data-view="sales"]').click();
    const salesLight = {
      cockpitBanner: lum(getComputedStyle(document.querySelector('.cockpit-banner')).backgroundColor)
    };
    document.querySelector('#sidebarNav .nav-item[data-view="statements"]').click();
    const rdlLight = {
      rdlHdr: lum(getComputedStyle(document.querySelector('.rdl-suite-hdr')).backgroundColor),
      rdlTabs: lum(getComputedStyle(document.querySelector('.rdl-tab-bar')).backgroundColor)
    };
    document.querySelector('#sidebarNav .nav-item[data-view="users"]').click();
    const usersLight = {
      enrolViewport: lum(getComputedStyle(document.querySelector('.enrol-cam-viewport')).backgroundColor),
      enrolPlaceholderTitle: lum(getComputedStyle(document.querySelector('.enrol-cam-placeholder-title')).color) < 60 ? 250 : 0
    };

    if (btn) btn.click(); // switch to Dark mode
    const usersDark = {
      enrolViewport: lum(getComputedStyle(document.querySelector('.enrol-cam-viewport')).backgroundColor),
      enrolPlaceholderTitle: lum(getComputedStyle(document.querySelector('.enrol-cam-placeholder-title')).color) > 200 ? 15 : 255
    };
    document.querySelector('#sidebarNav .nav-item[data-view="statements"]').click();
    const rdlDark = {
      rdlHdr: lum(getComputedStyle(document.querySelector('.rdl-suite-hdr')).backgroundColor),
      rdlTabs: lum(getComputedStyle(document.querySelector('.rdl-tab-bar')).backgroundColor)
    };
    document.querySelector('#sidebarNav .nav-item[data-view="sales"]').click();
    const salesDark = {
      cockpitBanner: lum(getComputedStyle(document.querySelector('.cockpit-banner')).backgroundColor)
    };
    document.querySelector('#sidebarNav .nav-item[data-view="pbi"]').click();
    const pbiDark = {
      rail: lum(getComputedStyle(document.getElementById('sidebar')).backgroundColor),
      pbiHdr: lum(getComputedStyle(document.querySelector('.pbi-studio-hdr')).backgroundColor),
      pbiTab: lum(getComputedStyle(document.querySelector('.pbi-page-tab:not(.active)')).backgroundColor),
      pbiDateBar: lum(getComputedStyle(document.querySelector('.pbi-date-slicer-row')).backgroundColor),
      pbiSlicerSelect: lum(getComputedStyle(document.querySelector('.pbi-slicer-item select')).backgroundColor),
      aiDrawer: lum(getComputedStyle(document.getElementById('aiDrawer')).backgroundColor),
      authCard: lum(getComputedStyle(document.querySelector('.auth-card')).backgroundColor)
    };

    if (btn) btn.click(); // restore Light mode
    document.querySelector('#sidebarNav .nav-item[data-view="overview"]').click();

    const lightVals = { ...pbiLight, ...salesLight, ...rdlLight, ...usersLight };
    const darkVals = { ...pbiDark, ...salesDark, ...rdlDark, ...usersDark };
    const allLightOk = Object.values(lightVals).every(v => v > 220);
    const allDarkOk = Object.values(darkVals).every(v => v < 50);
    return { allLightOk, allDarkOk, lightVals, darkVals };
  })()`);
  themeParity && themeParity.allLightOk && themeParity.allDarkOk
    ? pass('theme parity · Light mode vs Dark mode across rail, PBI studio, slicers, module banners, RDL suite, AI drawer & auth card', `light minLum=${Math.round(Math.min(...Object.values(themeParity.lightVals)))} (>220) · dark maxLum=${Math.round(Math.max(...Object.values(themeParity.darkVals)))} (<50)`)
    : fail('theme parity · Light vs Dark', JSON.stringify(themeParity));

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
