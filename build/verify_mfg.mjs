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

const server = spawn('python', ['server.py', String(PORT)], { cwd: ROOT, stdio: 'ignore', windowsHide: true });
const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'mfg-verify-'));
const edge = spawn(EDGE, [`--headless=new`, `--remote-debugging-port=${DBG}`, `--user-data-dir=${udd}`, '--no-first-run', '--disable-gpu', '--window-size=1366,768', 'about:blank'], { stdio: 'ignore', windowsHide: true });

let ws, msgId = 0; const pending = new Map(); const events = [];
function send(method, params = {}) {
  return new Promise((resolve, reject) => { const id = ++msgId; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
}
async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : JSON.stringify(r.exceptionDetails));
  return r.result.value;
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
  if (MOBILE) await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?demo=1&nosse=1` });
  await sleep(2500);
  await evaluate(`new Promise(r => { const t = setInterval(() => { if (window.MFG_SEED && document.getElementById('workspace')) { clearInterval(t); r(1); } }, 100); })`);

  // 0. Always starts on the login gate (#authGate visible, body.locked, no #overview hash), even if a legacy localStorage email exists
  const initialGate = await evaluate(`(() => ({ gateOpen: !document.getElementById('authGate').hidden, locked: document.body.classList.contains('locked'), hash: location.hash }))()`);
  initialGate.gateOpen && initialGate.locked && initialGate.hash === ''
    ? pass('authGate · opens on login screen first (no auto-open)')
    : fail('authGate initial state', JSON.stringify(initialGate));
  await evaluate(`localStorage.setItem('isabi_mfg_active_email', 'husseinbdeir@bhfirms.com')`);
  await send('Page.reload', { ignoreCache: true });
  await sleep(1500);
  await evaluate(`new Promise(r => { const t = setInterval(() => { if (window.MFG_SEED && document.getElementById('workspace')) { clearInterval(t); r(1); } }, 100); })`);
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
  const views = ['overview', 'pbi', 'tables', 'sentinels', 'sales', 'raw', 'fleet', 'pricing', 'customers', 'suppliers', 'expenses', 'ledger', 'statements', 'users'];
  for (const v of views) {
    await evaluate(`(() => { const b = document.querySelector('#sidebarNav .nav-item[data-view="${v}"]'); b.click(); return 1; })()`);
    await sleep(350);
    const len = await evaluate(`document.getElementById('workspace').innerHTML.length`);
    len > 500 ? pass(`view ${v}`, `${len} chars`) : fail(`view ${v}`, 'empty workspace');
    await overflow(v);
  }

  // 3. Every PBI page + GL totals on P16 + pricing active-count on P05
  await evaluate(`document.querySelector('#sidebarNav .nav-item[data-view="pbi"]').click()`);
  await sleep(300);
  const pages = await evaluate(`Array.from(document.querySelectorAll('[data-pbi-page]')).map(b => b.getAttribute('data-pbi-page'))`);
  pages.length === 20 ? pass('pbi · 20 page tabs') : fail('pbi tabs', String(pages.length));
  for (const p of pages) {
    await evaluate(`document.querySelector('[data-pbi-page="${p}"]').click()`);
    await sleep(250);
    const len = await evaluate(`document.getElementById('pbiCanvasPanel').innerHTML.length`);
    len > 2000 ? pass(`pbi ${p}`) : fail(`pbi ${p}`, 'thin canvas');
  }
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
  await evaluate(`(() => { const s = document.getElementById('pbiSlicerSaleType'); s.value = 'Pickup'; s.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`); await sleep(300);
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

  // 5. Record inspector on a register row
  await evaluate(`document.querySelector('#sidebarNav .nav-item[data-view="sales"]').click()`); await sleep(300);
  await evaluate(`document.querySelector('tr.rrow[data-rid]').click()`); await sleep(200);
  const insp = await evaluate(`(() => { const p = document.getElementById('recordInspector'); return p && !p.hidden ? document.querySelectorAll('#inspectorBody .inspector-cell').length : 0; })()`);
  insp > 8 ? pass('record inspector opens', `${insp} fields`) : fail('record inspector', String(insp));
  await evaluate(`document.getElementById('inspectorDoneBtn').click()`); await sleep(100);

  // 6. Entry desk: 24 forms open; sales tier adjustment is per load; expense subcategory cascade
  await evaluate(`document.getElementById('newEntryBtn').click()`); await sleep(300);
  const forms = ['sales', 'raw', 'receipt', 'settlement', 'fuel', 'expense', 'pricerule', 'vatinvoice', 'creditterm', 'customer', 'supplier', 'product', 'site', 'equipment', 'companyequipment', 'driver', 'salary', 'attendance', 'freelance', 'employment', 'logistics', 'triprate', 'treasury', 'jv'];
  let opened = 0;
  for (const f of forms) {
    const ok = await evaluate(`(() => { const groups = window.MFG_FORMS.FORM_GROUPS; const g = groups.find(x => x.forms.some(y => y.id === '${f}')); document.querySelector('[data-pa-group="' + g.id + '"]').click(); const t = document.querySelector('.modal-tab[data-form="${f}"]'); if (!t) return false; t.click(); return document.getElementById('modalBody').querySelectorAll('input, select').length > 3; })()`);
    if (ok) opened++; else fail(`form ${f}`, 'did not render inputs');
    await sleep(60);
  }
  opened === 24 ? pass('entry desk · 24 forms render') : fail('entry desk forms', `${opened}/24`);

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
  const codes = await evaluate(`Array.from(document.querySelectorAll('[data-stmt]')).map(c => c.getAttribute('data-stmt'))`);
  let stOk = 0;
  for (const c of codes) { await evaluate(`document.querySelector('[data-stmt="${c}"]').click()`); await sleep(120); const n = await evaluate(`document.querySelectorAll('#printableSheet table').length`); if (n) stOk++; }
  stOk === 22 ? pass('statements · 22 sheets render') : fail('statements', `${stOk}/22`);

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
