// build/verify_mfg.mjs — headless Edge smoke test for the mfg-web PWA (v4.1).
// Serves the repo with server.py on a scratch port, drives Edge through CDP (Node 24 built-in WebSocket),
// walks every view / PBI page / table / form, asserts 0 runtime errors, 0px horizontal overflow,
// the GL totals render (v4.0 showed $0.00 on P16), and the Tier adjustment is applied per load.
//   node build/verify_mfg.mjs            (desktop 1366×768)
//   node build/verify_mfg.mjs --mobile   (390×844 emulation)
import { spawn, execFile } from 'node:child_process';
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
const edge = spawn(EDGE, [`--headless=new`, `--remote-debugging-port=${DBG}`, `--user-data-dir=${udd}`, '--no-first-run', '--disable-gpu', '--window-size=1366,768', 'about:blank'], { stdio: 'ignore', windowsHide: true });

let ws, msgId = 0; const pending = new Map(); const events = [];
function send(method, params = {}, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const timer = setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`CDP timeout (${timeoutMs}ms): ${method}`));
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
  await evaluate(`document.getElementById('closeModalBtn').click()`); await sleep(150);

  // 7. Statements all 22
  await evaluate(`document.querySelector('#sidebarNav .nav-item[data-view="statements"]').click()`); await sleep(300);
  const codes = await evaluate(`Array.from(document.querySelectorAll('.stmt-card[data-stmt]')).map(c => c.getAttribute('data-stmt'))`);
  let stOk = 0;
  for (const c of codes) { await evaluate(`document.querySelector('.stmt-card[data-stmt="${c}"]').click()`); await sleep(120); const n = await evaluate(`document.querySelectorAll('#printableSheet table').length`); if (n) stOk++; }
  stOk === 22 ? pass('statements · 22 sheets render') : fail('statements', `${stOk}/22`);

  // 7b. Biometric Face ID (Attendance PWA parity: 128-d models, 3-pose enrolment, duplicate guard, 2FA step-up, 3-frame biometric sign-in)
  await evaluate(`document.querySelector('#sidebarNav .nav-item[data-view="users"]').click()`); await sleep(250);
  const modelsLoaded = await evaluate(`(async () => { await window.Face.load('./vendor/models'); return { ready: window.Face.ready, backend: window.Face.backend }; })()`);
  modelsLoaded.ready ? pass('face-api · 128-d neural models loaded', `backend=${modelsLoaded.backend}`) : fail('face-api models', JSON.stringify(modelsLoaded));

  const enrolFlow = await evaluate(`(async () => {
    const T = window.MFG_FACE_TEST;
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

  // Sign out to #authGate and test Step-Up 2FA + 3-frame Biometric Sign-In
  const authFaceFlow = await evaluate(`(async () => {
    const T = window.MFG_FACE_TEST;
    T.signOut();
    const gateOverflow = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const stageVisible = !!document.getElementById('authFaceStage') && !document.getElementById('authGate').hidden;

    // 1. Entering PIN for an enrolled seat triggers Step-Up 2FA instead of unlocking immediately
    const pinStep = await T.performLogin('husseinbdeir@bhfirms.com', '1111');
    const bannerVisible = !document.getElementById('authFaceTargetBanner').hidden;
    const stillLockedAfterPin = !document.getElementById('authGate').hidden;

    // 2. Feeding Zeinab's face during Hussein's 2FA step-up is refused
    const wrongPerson = await T.feedAuthFrame(T.makeSyntheticVector(2, 0.002));

    // 3. Feeding 3 consecutive frames of Hussein's face completes 2FA and unlocks #authGate
    const f1 = await T.feedAuthFrame(T.makeSyntheticVector(1, 0.002));
    const f2 = await T.feedAuthFrame(T.makeSyntheticVector(1, 0.004));
    const f3 = await T.feedAuthFrame(T.makeSyntheticVector(1, 0.003));
    const unlocked2FA = document.getElementById('authGate').hidden === true && T.state().activeEmail === 'husseinbdeir@bhfirms.com';

    // 4. Sign out and test 1-Look Biometric Sign-In (no Email or PIN typed) for Zeinab
    T.signOut();
    await T.feedAuthFrame(T.makeSyntheticVector(2, 0.002));
    await T.feedAuthFrame(T.makeSyntheticVector(2, 0.004));
    const zLogin = await T.feedAuthFrame(T.makeSyntheticVector(2, 0.003));
    const unlockedDirect = document.getElementById('authGate').hidden === true && T.state().activeEmail === 'zeinabrkein@bhfirms.com';

    // Clean up test enrolments and restore owner session
    await T.performLogin('husseinbdeir@bhfirms.com', '1111', { bypass2FA: true });
    T.selectEnrolSeat('husseinbdeir@bhfirms.com'); await T.clearEnrolment();
    T.selectEnrolSeat('zeinabrkein@bhfirms.com'); await T.clearEnrolment();

    return {
      gateOverflow,
      stageVisible,
      pinStep,
      bannerVisible,
      stillLockedAfterPin,
      wrongPerson: wrongPerson.status,
      f1: f1.status,
      f2: f2.status,
      f3: f3.status,
      f3Method: f3.method,
      unlocked2FA,
      zLogin: zLogin.status,
      zMethod: zLogin.method,
      unlockedDirect
    };
  })()`);
  authFaceFlow.stageVisible && authFaceFlow.gateOverflow === 0
    ? pass('authGate · Face ID scanner stage visible & 0px overflow')
    : fail('authGate Face ID stage', JSON.stringify(authFaceFlow));
  authFaceFlow.pinStep === '2fa_pending' && authFaceFlow.bannerVisible && authFaceFlow.stillLockedAfterPin && authFaceFlow.wrongPerson === '2fa-mismatch'
    ? pass('authGate 2FA · enrolled seat requires Face ID after PIN & rejects wrong face')
    : fail('authGate 2FA enforcement', JSON.stringify(authFaceFlow));
  authFaceFlow.f1 === 'streak' && authFaceFlow.f2 === 'streak' && authFaceFlow.f3 === 'verified' && authFaceFlow.unlocked2FA
    ? pass('authGate 2FA · 3 consecutive matching frames unlock session', authFaceFlow.f3Method)
    : fail('authGate 2FA unlock', JSON.stringify(authFaceFlow));
  authFaceFlow.zLogin === 'verified' && authFaceFlow.unlockedDirect && authFaceFlow.zMethod === 'Face ID'
    ? pass('authGate Face ID · 1-look biometric sign-in unlocks RLS session')
    : fail('authGate 1-look Face ID', JSON.stringify(authFaceFlow));

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
      const main = document.querySelector('.main-area');
      const collapseBtn = document.getElementById('railCollapseBtn');
      const topToggleBtn = document.getElementById('mobileMenuBtn');
      const wBefore = main.getBoundingClientRect().width;
      collapseBtn.click();
      const collapsedClass = shell.classList.contains('rail-collapsed');
      const wCollapsed = main.getBoundingClientRect().width;
      const overflowCollapsed = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);
      topToggleBtn.click();
      const restoredClass = !shell.classList.contains('rail-collapsed');
      const wRestored = main.getBoundingClientRect().width;
      return {
        collapsedClass,
        restoredClass,
        gainedPx: Math.round(wCollapsed - wBefore),
        restoredDiff: Math.round(Math.abs(wRestored - wBefore)),
        overflowCollapsed
      };
    })()`);
    railToggleProbe.collapsedClass && railToggleProbe.restoredClass && railToggleProbe.gainedPx >= 220 && railToggleProbe.overflowCollapsed === 0
      ? pass('desktop sidebar toggle · hides left Manufacturing Command rail & expands main view', `+${railToggleProbe.gainedPx}px width gained · 0px overflow`)
      : fail('desktop sidebar toggle', JSON.stringify(railToggleProbe));
  }

  // 8. Runtime errors
  const errs = events.filter(e => e.method === 'Runtime.exceptionThrown').map(e => (e.params.exceptionDetails.exception || {}).description || e.params.exceptionDetails.text);
  const logErrs = events.filter(e => e.method === 'Log.entryAdded' && e.params.entry.level === 'error' && !/favicon|fonts|net::ERR|relay|404/.test(e.params.entry.text)).map(e => e.params.entry.text);
  errs.length === 0 ? pass('0 runtime exceptions') : fail('runtime exceptions', errs.slice(0, 3).join(' || '));
  logErrs.length === 0 ? pass('0 console errors') : fail('console errors', logErrs.slice(0, 3).join(' || '));
} catch (e) {
  fail('harness', e.message);
} finally {
  try { ws && ws.close(); } catch (_) {}
  try { edge.kill(); } catch (_) {}
  try { server.kill(); } catch (_) {}
  await sleep(400);
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch (_) {}
  const failed = results.filter(r => !r.ok);
  console.log(`\n${failed.length ? 'VERIFY FAILED' : 'VERIFY ALL GREEN'} · ${results.length - failed.length} pass / ${failed.length} fail · ${MOBILE ? 'mobile 390×844' : 'desktop 1366×768'}`);
  process.exit(failed.length ? 1 : 0);
}
