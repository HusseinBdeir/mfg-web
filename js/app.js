/* ============================================================================
   ISABI Systems — Manufacturing Operations Standalone Web App (js/app.js)
   Option 3 Architecture: Own SQLite / PostgreSQL Engine + Offline PWA
   Companies: WTC · BBConstruction · Lions Transport · All Group
   v3.1 — fail-closed team login, RLS-scoped entry desk, validated forms with
          price-agreement / VAT / meter / duplicate guards, period-aware
          registers, sortable + pageable tables, CSV export, void with cloud
          tombstones, 22 real statements, data-driven sentinels, history nav.
   ============================================================================ */

(function () {
  'use strict';

  const SEED = window.MFG_SEED || {};
  SEED.models = SEED.models || {};
  SEED.records = SEED.records || {};
  SEED.sentinels = SEED.sentinels || {};
  [
    'sales_tickets', 'raw_purchases', 'fuel_intakes', 'expenses', 'receipts', 'settlements', 'salaries',
    'price_rules', 'vat_invoices', 'credit_terms', 'customers', 'suppliers', 'products', 'sites',
    'regions', 'uoms', 'product_types', 'equipment', 'company_equipment', 'drivers', 'company_drivers',
    'expense_categories', 'expense_subcategories', 'employments', 'attendance', 'logistics_allowances',
    'overtime_rates', 'external_movements', 'loans', 'loan_settlements', 'conversions',
    'jv_partnerships', 'jv_distributions', 'daily_totals'
  ].forEach(k => {
    if (!Array.isArray(SEED.records[k])) SEED.records[k] = [];
  });

  const CLOUD_CFG = window.MFG_CLOUD_CFG || {};
  const CLOUD_URL = CLOUD_CFG.u ? atob(CLOUD_CFG.u) : '';
  const CLOUD_KEY = CLOUD_CFG.k ? atob(CLOUD_CFG.k) : '';
  const CLOUD_DOC_KEY = CLOUD_CFG.docKey || 'mfg_web_store';

  const PARAMS = new URLSearchParams(location.search);
  const IS_LOCAL = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.|10\.)/.test(location.hostname);
  // Demo mode = the 1-click seat simulator shows PINs. Only on the local server.py host or with ?demo=1.
  const IS_DEMO = PARAMS.get('demo') !== '0' && (IS_LOCAL || PARAMS.get('demo') === '1');
  const HAS_LOCAL_API = IS_LOCAL; // server.py REST endpoints exist only on the local / LAN host
  const MIN_DATE = '2024-01-01';   // bhf_mindate on every manufacturing BU
  const VAT_RATE = 0.11;
  const DAY_SHIFT_FROM = 6 * 60;   // m48: Day shift 06:00–17:59, Night otherwise
  const DAY_SHIFT_TO = 17 * 60 + 59;
  const PAGE = 100;
  const SEED_DATE = String(SEED.generated_at || '').slice(0, 10) || todayISO();

  const DEFAULT_USERS = [
    { id: 'u1', full_name: 'Hussein Bdeir', email: 'husseinbdeir@bhfirms.com', pin_code: '1111', role: 'Full Access (Owner)', companies: 'WTC, BBConstruction, Lions Transport', pbi_access: 'full', statements_access: 'full', status: 'Active', last_login_at: '' },
    { id: 'u2', full_name: 'Zeinab Rkein', email: 'zeinabrkein@bhfirms.com', pin_code: '2222', role: 'Supervisor + Entry', companies: 'WTC, BBConstruction, Lions Transport', pbi_access: 'full', statements_access: 'full', status: 'Active', last_login_at: '' },
    { id: 'u3', full_name: 'Sabah Kassab', email: 'sabahkassab@bhfirms.com', pin_code: '3333', role: 'Entry', companies: 'WTC', pbi_access: 'partial', statements_access: 'partial', status: 'Active', last_login_at: '' },
    { id: 'u4', full_name: 'WTC Plant Weighbridge 1', email: 'scale1.wtc@bhfirms.com', pin_code: '4444', role: 'Entry', companies: 'WTC', pbi_access: 'none', statements_access: 'partial', status: 'Active', last_login_at: '' },
    { id: 'u5', full_name: 'WTC Quarry Dispatch', email: 'quarry.wtc@bhfirms.com', pin_code: '4545', role: 'Entry', companies: 'WTC', pbi_access: 'none', statements_access: 'none', status: 'Active', last_login_at: '' },
    { id: 'u6', full_name: 'BBConstruction Batching Desk', email: 'batch.bbc@bhfirms.com', pin_code: '5555', role: 'Entry', companies: 'BBConstruction', pbi_access: 'partial', statements_access: 'partial', status: 'Active', last_login_at: '' },
    { id: 'u7', full_name: 'BBConstruction Site Supervisor', email: 'site.bbc@bhfirms.com', pin_code: '6666', role: 'Supervisor', companies: 'BBConstruction', pbi_access: 'full', statements_access: 'full', status: 'Active', last_login_at: '' },
    { id: 'u8', full_name: 'Lions Transport Fleet Controller', email: 'fleet.lions@bhfirms.com', pin_code: '7777', role: 'Supervisor + Entry', companies: 'Lions Transport, WTC', pbi_access: 'full', statements_access: 'partial', status: 'Active', last_login_at: '' },
    { id: 'u9', full_name: 'Diesel & Garage Officer', email: 'fuel.mfg@bhfirms.com', pin_code: '7878', role: 'Entry', companies: 'WTC, BBConstruction, Lions Transport', pbi_access: 'none', statements_access: 'none', status: 'Active', last_login_at: '' },
    { id: 'u10', full_name: 'Accounts Receivable Collector', email: 'ar.mfg@bhfirms.com', pin_code: '8888', role: 'Sales', companies: 'WTC, BBConstruction', pbi_access: 'partial', statements_access: 'full', status: 'Active', last_login_at: '' }
  ];

  function lsGet(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v == null ? fallback : v; } catch (_) { return fallback; }
  }

  const STATE = {
    view: 'overview',
    company: 'manufacturing-group', // 'manufacturing-group' | 'wtc' | 'bbconstruction' | 'lionstransport'
    period: 'all',                  // 'all' | 'ytd' | 'mtd' | 'sep2026' | 'aug2026' | 'q3_2026' | 'fy2025'
    basis: 'tx',                    // 'tx' | 'rep'
    theme: localStorage.getItem('isabi_mfg_theme') || 'light',
    search: '',
    chipFilter: 'all',
    activeStatement: '01',
    pbiPage: 'p01_overview',
    pbiSlicer: { product: '', customer: '', supplier: '', site: '', method: '', saleType: '', search: '' },
    activeTableKey: 'price_rules',
    modalForm: 'sales',
    activeUserIdx: 0,
    authed: false,
    saving: false,
    renderPending: false,
    sortBy: {},
    shown: {},
    cloudStatus: 'Connecting...',
    cloudUpdatedAt: '',
    showAddUserForm: false,
    users: lsGet('isabi_mfg_users_v2', null) || DEFAULT_USERS.map(u => ({ ...u })),
    sessions: lsGet('isabi_mfg_sessions_v2', null) || [],
    customRecords: lsGet('isabi_mfg_custom_recs_v2', null) || {},
    supabaseCfg: lsGet('isabi_mfg_supabase_cfg', null) || { url: '', anonKey: '' }
  };

  // App-entered record pools (localStorage + cloud relay) → server table + SEED list
  const CR_KEYS = [
    'sales_tickets', 'raw_purchases', 'receipts', 'fuel_intakes', 'expenses', 'settlements',
    'price_rules', 'vat_invoices', 'credit_terms', 'customers', 'suppliers', 'products', 'sites',
    'equipment', 'company_equipment', 'drivers', 'salaries', 'attendance', 'employments',
    'logistics_allowances', 'overtime_rates', 'external_movements', 'loans', 'loan_settlements',
    'conversions', 'jv_partnerships', 'jv_distributions'
  ];
  const CR_TABLE = {
    sales_tickets: 'sales_tickets', raw_purchases: 'raw_purchases', receipts: 'customer_receipts',
    fuel_intakes: 'fuel_intakes', expenses: 'expenses', settlements: 'supplier_payments',
    price_rules: 'price_rules', vat_invoices: 'vat_invoices', credit_terms: 'credit_terms',
    customers: 'customers', suppliers: 'suppliers', products: 'products', sites: 'sites',
    equipment: 'equipment', company_equipment: 'company_equipment', drivers: 'drivers',
    salaries: 'salaries', attendance: 'attendance', employments: 'employments',
    logistics_allowances: 'logistics_allowances', overtime_rates: 'overtime_rates',
    external_movements: 'external_movements', loans: 'loans', loan_settlements: 'loan_settlements',
    conversions: 'conversions', jv_partnerships: 'jv_partnerships', jv_distributions: 'jv_distributions'
  };
  const CR_LABEL = {
    sales_tickets: 'sales ticket', raw_purchases: 'raw receipt', receipts: 'customer receipt',
    fuel_intakes: 'fuel intake', expenses: 'expense', settlements: 'supplier settlement',
    price_rules: 'price agreement', vat_invoices: 'VAT invoice', credit_terms: 'credit terms',
    customers: 'customer', suppliers: 'supplier', products: 'product', sites: 'site',
    equipment: 'equipment', company_equipment: 'company fleet unit', drivers: 'driver',
    salaries: 'salary payment', attendance: 'attendance log', employments: 'contract / freelance',
    logistics_allowances: 'site allowance', overtime_rates: 'overtime rate',
    external_movements: 'external movement', loans: 'partner loan', loan_settlements: 'loan settlement',
    conversions: 'currency conversion', jv_partnerships: 'JV partnership', jv_distributions: 'JV distribution'
  };
  CR_KEYS.forEach(k => { if (!Array.isArray(STATE.customRecords[k])) STATE.customRecords[k] = []; });
  if (!Array.isArray(STATE.users) || !STATE.users.length) STATE.users = DEFAULT_USERS.map(u => ({ ...u }));

  const COMPANY_LABELS = {
    'manufacturing-group': 'All Manufacturing Group (WTC · BBConstruction · Lions Transport)',
    'wtc': 'WTC (World Trading & Construction)',
    'bbconstruction': 'BBConstruction',
    'lionstransport': 'Lions Transport'
  };

  const COMPANY_BU_MATCH = {
    'manufacturing-group': null,
    'wtc': 'WTC',
    'bbconstruction': 'BBConstruction',
    'lionstransport': 'Lions Transport'
  };

  const COMPANY_KEY_BY_NAME = { 'WTC': 'wtc', 'BBConstruction': 'bbconstruction', 'Lions Transport': 'lionstransport' };
  const SENTINEL_MODEL_KEY = { 'manufacturing-group': 'Manufacturing Group', 'wtc': 'WTC', 'bbconstruction': 'BBConstruction', 'lionstransport': 'Lions Transport' };

  // ==========================================================================
  // FORMATTERS & SMALL HELPERS
  // ==========================================================================
  function fmtUSD(v, decimals = 0) {
    const n = Number(v || 0);
    const abs = Math.abs(n);
    const s = abs.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return (n < 0 ? '-$' : '$') + s;
  }

  function fmtUSDk(v) {
    const n = Number(v || 0);
    const a = Math.abs(n);
    if (a >= 1e6) return (n < 0 ? '-' : '') + '$' + (a / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return (n < 0 ? '-' : '') + '$' + (a / 1e3).toFixed(1) + 'k';
    return fmtUSD(n, 0);
  }

  function fmtNum(v, decimals = 0) {
    const n = Number(v || 0);
    return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  function fmtPct(v, num, den) {
    if (num != null && den) return ((Number(num) / Number(den)) * 100).toFixed(1) + '%';
    const n = Number(v || 0) * 100;
    return n.toFixed(1) + '%';
  }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function round2(n) { return Math.round(Number(n || 0) * 100) / 100; }

  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function nowStamp() { return new Date().toISOString().replace('T', ' ').slice(0, 19); }
  function uid(prefix) { return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
  function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }

  let toastTimer = null;
  function toast(msg, kind) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast' + (kind ? ' toast-' + kind : '');
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, kind === 'err' ? 5200 : 3000);
  }

  function getModel() {
    return SEED.models[STATE.company] || SEED.models['manufacturing-group'] || {
      periods: {}, monthly: [], products: [], customers: [], suppliers: [], sites: [], equipment: [], gl_tb: [], soa_stream: []
    };
  }

  function getKPI() {
    const m = getModel();
    return (m.periods && m.periods[STATE.period]) || (m.periods && m.periods.all) || {};
  }

  function modelHasLedger(key) {
    const m = SEED.models[key || STATE.company];
    const p = m && m.periods && m.periods.all;
    return !!(p && (p.sales_ttc != null || p.loads != null || p.expenses != null));
  }

  // Reporting period → ISO date window applied to the record registers (null = All-Time)
  function periodRange(p) {
    const y = SEED_DATE.slice(0, 4);
    const ym = SEED_DATE.slice(0, 7);
    switch (p) {
      case 'ytd': return { from: y + '-01-01', to: y + '-12-31' };
      case 'mtd': return { from: ym + '-01', to: ym + '-31' };
      case 'sep2026': return { from: '2026-09-01', to: '2026-09-30' };
      case 'aug2026': return { from: '2026-08-01', to: '2026-08-31' };
      case 'q3_2026': return { from: '2026-07-01', to: '2026-09-30' };
      case 'fy2025': return { from: '2025-01-01', to: '2025-12-31' };
      default: return null;
    }
  }

  function recordDate(r) {
    return String((STATE.basis === 'rep' && r.rep_date) ? r.rep_date : (r.date || '')).slice(0, 10);
  }

  function filterRecords(list, opts = {}) {
    const bu = COMPANY_BU_MATCH[STATE.company];
    const q = opts.ignoreSearch ? '' : STATE.search.trim().toLowerCase();
    const range = opts.ignorePeriod ? null : periodRange(STATE.period);
    return (list || []).filter(r => {
      if (!r || r.voided) return false;
      if (bu && r.company && r.company !== bu) return false;
      if (range) {
        const d = recordDate(r);
        if (d && (d < range.from || d > range.to)) return false;
      }
      if (q) {
        const hay = Object.keys(r).filter(k => k !== 'id').map(k => r[k]).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  // ---- sorting / paging / table helpers --------------------------------------
  function sortRows(rows, view, defKey, defDir) {
    const s = STATE.sortBy[view] || { key: defKey, dir: defDir || 'desc' };
    if (!s.key) return rows;
    const dir = s.dir === 'asc' ? 1 : -1;
    return rows.slice().sort((a, b) => {
      const av = a[s.key], bv = b[s.key];
      if ((av == null || av === '') && (bv == null || bv === '')) return 0;
      if (av == null || av === '') return 1;
      if (bv == null || bv === '') return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      if (typeof av === 'boolean' && typeof bv === 'boolean') return ((av ? 1 : 0) - (bv ? 1 : 0)) * dir;
      return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dir;
    });
  }

  function th(view, label, key, cls) {
    const s = STATE.sortBy[view] || {};
    const on = s.key === key;
    return `<th class="${cls || ''} sortable${on ? ' on' : ''}" data-sort-view="${esc(view)}" data-sort-key="${esc(key)}" title="Sort by ${esc(label)}">${label}<i>${on ? (s.dir === 'asc' ? '▲' : '▼') : ''}</i></th>`;
  }

  function shownCount(view) { return STATE.shown[view] || PAGE; }

  function showMoreRow(view, total, cols) {
    const n = shownCount(view);
    if (total <= n) return '';
    return `<tr class="show-more-row"><td colspan="${cols}"><button type="button" class="btn" data-show-more="${esc(view)}">Show ${Math.min(PAGE, total - n)} more · ${fmtNum(total - n)} remaining</button></td></tr>`;
  }

  function emptyRow(cols, msg) {
    return `<tr class="empty-row"><td colspan="${cols}">${esc(msg)}</td></tr>`;
  }

  function periodEmptyMsg(list, what) {
    const range = periodRange(STATE.period);
    const dates = (list || []).filter(r => r && !r.voided).map(r => String(r.date || '').slice(0, 10)).filter(Boolean).sort();
    const span = dates.length ? `${dates[0]} → ${dates[dates.length - 1]}` : 'none';
    if (STATE.search) return `No ${what} match "${STATE.search}"${range ? ' in ' + range.from + ' → ' + range.to : ''}.`;
    if (range) return `No ${what} dated ${range.from} → ${range.to} in the web sample (the sample holds ${span}; earlier rows live in the SQL archive and are already inside the KPI totals above).`;
    return `No ${what} in the web sample yet.`;
  }

  function isAppRecord(r) {
    return !!(r && (r.source === 'app' || /^(st|rw|rc|fu|ex|sp)-/.test(String(r.id || ''))));
  }

  function appCell(r, crKey) {
    if (!isAppRecord(r)) return '';
    const who = r.entered_by ? ' by ' + r.entered_by : '';
    const when = r.entered_at ? ' · ' + r.entered_at : '';
    return ` <span class="badge badge-app" title="Entered in this web app${esc(who + when)}">APP</span>` +
      (canVoid() ? `<button type="button" class="void-btn" data-void="${esc(crKey)}" data-void-id="${esc(r.id)}" title="Void this app entry (keeps a tombstone so other devices drop it too)">✕</button>` : '');
  }

  function appPill(crKey, amountKey, label) {
    const rows = filterRecords(STATE.customRecords[crKey], { ignoreSearch: true });
    if (!rows.length) return '';
    const sum = rows.reduce((a, r) => a + Number(r[amountKey] || 0), 0);
    return `<div class="cockpit-pill app-pill" title="Entered in this web app · not yet inside the SQL / book totals"><div class="cockpit-pill-lbl">App-entered (unposted)</div><div class="cockpit-pill-val amber">${fmtNum(rows.length)} ${esc(label)} · ${fmtUSD(sum, 0)}</div></div>`;
  }

  function appEnteredSummary() {
    const out = [];
    const spec = [['sales_tickets', 'total_ttc', 'sales tickets'], ['raw_purchases', 'total', 'raw receipts'], ['receipts', 'amount', 'customer receipts'], ['fuel_intakes', 'litres', 'fuel intakes'], ['expenses', 'amount', 'expenses'], ['settlements', 'amount', 'supplier settlements']];
    spec.forEach(([k, amt, label]) => {
      const rows = filterRecords(STATE.customRecords[k], { ignoreSearch: true });
      if (!rows.length) return;
      const sum = rows.reduce((a, r) => a + Number(r[amt] || 0), 0);
      out.push({ key: k, n: rows.length, sum, label, unit: amt === 'litres' ? 'L' : '$' });
    });
    return out;
  }

  function tableToCsv(table) {
    return Array.from(table.querySelectorAll('tr')).map(tr =>
      Array.from(tr.querySelectorAll('th,td')).map(td => '"' + td.innerText.replace(/\s+/g, ' ').trim().replace(/"/g, '""') + '"').join(',')
    ).join('\r\n');
  }

  function downloadCsv(name, csv) {
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }

  function exportBtn(panelId, name) {
    return `<button type="button" class="btn" data-export-csv="${esc(panelId)}" data-export-name="${esc(name)}" title="Download the rows shown as CSV (Excel, UTF-8)">⬇ CSV</button>`;
  }

  function searchBox(placeholder) {
    return `<input type="search" id="tableSearchInput" class="search-input" value="${esc(STATE.search)}" placeholder="${esc(placeholder)}" autocomplete="off">`;
  }

  // ---- seats, roles & row-level security -------------------------------------
  function activeUser() {
    return STATE.users[STATE.activeUserIdx] || STATE.users[0] || DEFAULT_USERS[0];
  }
  function isOwner(u) { return /Owner/i.test(String((u || activeUser()).role || '')); }
  function canEnterForm(form, u) {
    const role = String((u || activeUser()).role || '');
    if (/Owner/i.test(role)) return true;
    if (/Entry/i.test(role)) return true;            // Entry · Supervisor + Entry
    if (/Sales/i.test(role)) return ['receipt', 'pricerule', 'vatinvoice', 'creditterm', 'customer'].includes(form); // AR / commercial seat
    return false;                                      // Supervisor = read-only oversight
  }
  function canEnterAny(u) { return canEnterForm('sales', u) || canEnterForm('receipt', u); }
  function canVoid(u) { return /Owner|Entry/i.test(String((u || activeUser()).role || '')); }

  function canViewView(view, u) {
    u = u || activeUser();
    const pbi = u.pbi_access || 'partial';
    const st = u.statements_access || 'partial';
    if (view === 'overview' || view === 'pbi' || view === 'expenses') return pbi !== 'none';
    if (view === 'sentinels' || view === 'ledger' || view === 'gl') return pbi === 'full';
    if (view === 'statements') return st !== 'none';
    return true;
  }
  function defaultViewFor(u) {
    u = u || activeUser();
    if (canViewView('overview', u)) return 'overview';
    return /fuel/i.test(u.email || '') ? 'fleet' : 'sales';
  }

  function getAllowedCompanyKeys(user) {
    const cStr = String((user && user.companies) || 'WTC');
    const allowed = [];
    const hasWtc = cStr.includes('WTC');
    const hasBbc = cStr.includes('BBConstruction');
    const hasLt = cStr.includes('Lions Transport');
    if (hasWtc && hasBbc && hasLt) allowed.push('manufacturing-group');
    if (hasWtc) allowed.push('wtc');
    if (hasBbc) allowed.push('bbconstruction');
    if (hasLt) allowed.push('lionstransport');
    return allowed.length ? allowed : ['wtc'];
  }
  function allowedCompanyNames(u) {
    return getAllowedCompanyKeys(u || activeUser()).filter(k => k !== 'manufacturing-group').map(k => COMPANY_BU_MATCH[k]);
  }
  function defaultEntryCompany() {
    const names = allowedCompanyNames();
    const cur = COMPANY_BU_MATCH[STATE.company];
    return (cur && names.includes(cur)) ? cur : names[0];
  }

  // ---- master-data lookups for the entry desk ---------------------------------
  function uniqSorted(arr) {
    return Array.from(new Set(arr.map(x => String(x || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }
  function customerNames() {
    const out = [];
    (SEED.records.customers || []).forEach(c => out.push(c.name));
    Object.values(SEED.models).forEach(m => (m.customers || []).forEach(c => out.push(c.Customer)));
    SEED.records.sales_tickets.forEach(r => out.push(r.customer));
    SEED.records.receipts.forEach(r => out.push(r.customer));
    SEED.records.price_rules.forEach(r => out.push(r.customer));
    return uniqSorted(out);
  }
  function supplierNames() {
    const out = [];
    (SEED.records.suppliers || []).forEach(s => out.push(s.name));
    Object.values(SEED.models).forEach(m => (m.suppliers || []).forEach(s => out.push(s.Supplier)));
    SEED.records.raw_purchases.forEach(r => { out.push(r.site_owner); out.push(r.truck_owner); });
    SEED.records.settlements.forEach(r => out.push(r.supplier));
    SEED.records.expenses.forEach(r => out.push(r.supplier));
    SEED.records.price_rules.forEach(r => out.push(r.supplier));
    return uniqSorted(out);
  }
  function truckOwnerNames() {
    const out = [];
    (SEED.records.suppliers || []).forEach(s => { if (s.is_truck_owner || Number(s.trucks_count || 0) > 0) out.push(s.name); });
    (SEED.records.equipment || []).forEach(e => { if (e.supplier) out.push(e.supplier); });
    (SEED.records.drivers || []).forEach(d => { if (d.truck_owner) out.push(d.truck_owner); });
    SEED.records.raw_purchases.forEach(r => { if (r.truck_owner) out.push(r.truck_owner); });
    return uniqSorted(out);
  }
  function trucksForOwner(ownerName, company, isCompanyFleet) {
    if (isCompanyFleet) {
      const coUnits = (SEED.records.company_equipment || []).filter(e => !company || !e.company || e.company === company).map(e => e.name);
      const ownUnits = (SEED.records.equipment || []).filter(e => /^own/i.test(e.ownership || '') || norm(e.supplier) === norm(company)).map(e => e.name);
      return uniqSorted(coUnits.concat(ownUnits));
    }
    const o = norm(ownerName);
    if (!o) return [];
    const fromEq = (SEED.records.equipment || []).filter(e => norm(e.supplier) === o).map(e => e.name);
    const sup = (SEED.records.suppliers || []).find(s => norm(s.name) === o);
    const fromSup = (sup && Array.isArray(sup.trucks)) ? sup.trucks : [];
    const fromRaw = (SEED.records.raw_purchases || []).filter(r => norm(r.truck_owner) === o).map(r => r.truck);
    const fromSales = (SEED.records.sales_tickets || []).filter(r => norm(r.truck_owner) === o).map(r => r.truck);
    return uniqSorted(fromEq.concat(fromSup, fromRaw, fromSales));
  }
  function driversForOwner(ownerName, company, isCompanyFleet) {
    if (isCompanyFleet) {
      const coDrv = (SEED.records.company_drivers || []).filter(d => !company || !d.company || d.company === company).map(d => d.driver || d.name);
      return uniqSorted(coDrv.length ? coDrv : driverNames());
    }
    const o = norm(ownerName);
    if (!o) return [];
    const fromDrv = (SEED.records.drivers || []).filter(d => norm(d.truck_owner) === o).map(d => d.name);
    const sup = (SEED.records.suppliers || []).find(s => norm(s.name) === o);
    const fromSup = (sup && Array.isArray(sup.drivers)) ? sup.drivers : [];
    const fromRaw = (SEED.records.raw_purchases || []).filter(r => norm(r.truck_owner) === o).map(r => r.driver);
    const fromSales = (SEED.records.sales_tickets || []).filter(r => norm(r.truck_owner) === o).map(r => r.driver);
    return uniqSorted(fromDrv.concat(fromSup, fromRaw, fromSales));
  }
  function siteInfo(name) {
    const n = norm(name);
    return (SEED.records.sites || []).find(s => norm(s.name) === n) || null;
  }
  function siteNames() { return uniqSorted(SEED.records.sites.map(s => s.name).concat(SEED.records.sales_tickets.map(r => r.site), SEED.records.raw_purchases.map(r => r.site))); }
  function equipmentNames() { return uniqSorted(SEED.records.equipment.map(e => e.name).concat(SEED.records.fuel_intakes.map(f => f.equipment), SEED.records.sales_tickets.map(r => r.truck))); }
  function driverNames() { return uniqSorted(SEED.records.drivers.map(d => d.name).concat(SEED.records.sales_tickets.map(r => r.driver), SEED.records.fuel_intakes.map(f => f.driver))); }
  function staffNames() { return uniqSorted(SEED.records.salaries.map(s => s.staff).concat((SEED.records.employments || []).map(e => e.staff || e.name))); }
  function expenseCategories() {
    const map = new Map();
    (SEED.records.expense_categories || []).forEach(c => {
      if (c && c.name && !map.has(c.name)) map.set(c.name, new Set());
    });
    (SEED.records.expense_subcategories || []).forEach(sc => {
      if (!sc || !sc.category || !sc.name) return;
      if (!map.has(sc.category)) map.set(sc.category, new Set());
      map.get(sc.category).add(sc.name);
    });
    SEED.records.expenses.forEach(x => {
      if (!x.category) return;
      if (!map.has(x.category)) map.set(x.category, new Set());
      if (x.subcategory) map.get(x.category).add(x.subcategory);
    });
    ['Fuel', 'Repairs and Maintenance', 'Spare Parts', 'Oils', 'Tools', 'Office Supplies', 'Utilities', 'Licences and Fees', 'Transportation', 'Tips', 'Minor Equipment', 'Other Costs'].forEach(c => { if (!map.has(c)) map.set(c, new Set()); });
    return Array.from(map.entries()).map(([c, subs]) => ({ category: c, subs: Array.from(subs).sort() })).sort((a, b) => a.category.localeCompare(b.category));
  }
  function productList(materialOnly) {
    // Grades sold most → first (model products carry revenue), then every other registered product.
    // Tickets carry Material / ticket_product products only (m37 / m54 / m110) — oils and spare parts never go on a weighbridge ticket.
    const pool = materialOnly ? SEED.records.products.filter(p => p.ticket_product !== false && (!p.type || /material/i.test(p.type))) : SEED.records.products;
    const top = ((SEED.models['manufacturing-group'] || {}).products || []).map(p => p.Product);
    const byName = new Map(pool.map(p => [norm(p.name), p]));
    const out = [];
    const seen = new Set();
    top.forEach(n => { const p = byName.get(norm(n)); if (p && !seen.has(norm(n))) { out.push(p); seen.add(norm(n)); } });
    pool.slice().sort((a, b) => String(a.name).localeCompare(String(b.name))).forEach(p => { if (!seen.has(norm(p.name))) { out.push(p); seen.add(norm(p.name)); } });
    return out;
  }
  function customerInfo(name) {
    const n = norm(name);
    if (!n) return null;
    const dvn = (SEED.records.customers || []).find(x => norm(x.name) === n) || null;
    let mdl = null;
    for (const m of Object.values(SEED.models)) {
      const c = (m.customers || []).find(x => norm(x.Customer) === n);
      if (c) { mdl = c; break; }
    }
    if (!dvn && !mdl) return null;
    return Object.assign({}, dvn || {}, mdl || {}, {
      Customer: (mdl && mdl.Customer) || (dvn && dvn.name) || name,
      method: (dvn && dvn.method) || (mdl && mdl.Method) || 'Credit',
      'VAT Registered': ((mdl && mdl['VAT Registered'] === 'Yes') || (dvn && dvn.vat_registered)) ? 'Yes' : 'No',
      customer_declared_qty: !!(dvn && dvn.customer_declared_qty),
      external_invoice: !!(dvn && dvn.external_invoice)
    });
  }
  function supplierInfo(name) {
    const n = norm(name);
    if (!n) return null;
    const dvn = (SEED.records.suppliers || []).find(x => norm(x.name) === n) || null;
    let mdl = null;
    for (const m of Object.values(SEED.models)) {
      const s = (m.suppliers || []).find(x => norm(x.Supplier) === n);
      if (s) { mdl = s; break; }
    }
    if (!dvn && !mdl) return null;
    return Object.assign({}, dvn || {}, mdl || {}, {
      Supplier: (mdl && mdl.Supplier) || (dvn && dvn.name) || name,
      iva: !!(dvn && dvn.iva),
      is_truck_owner: !!(dvn && dvn.is_truck_owner)
    });
  }
  function productInfo(name) {
    const n = norm(name);
    return SEED.records.products.find(p => norm(p.name) === n) || null;
  }
  function listPrice(name) {
    const n = norm(name);
    for (const m of Object.values(SEED.models)) {
      const p = (m.products || []).find(x => norm(x.Product) === n);
      if (p && p.list_price != null) return Number(p.list_price);
    }
    return null;
  }

  // Price Agreement lookup (mirrors fillPrices on the Dataverse ticket form): customer × product × site × date,
  // the most specific active rule wins, ties → the latest start date. Quarry side keys on supplier / site.
  // q.types = the bhf_ruletype labels that may answer (e.g. ['Sales (Delivery)']); rules exported without a type (v3.0 seed) still match
  function findRule(q) {
    const c = norm(q.customer), s = norm(q.site), p = norm(q.product), sup = norm(q.supplier);
    const date = q.date || todayISO();
    const types = q.types || null;
    let best = null, bestScore = -1;
    SEED.records.price_rules.forEach(r => {
      if (q.company && r.company && r.company !== q.company) return;
      if (types && r.rule_type && !types.includes(r.rule_type)) return;
      if (c) { if (!r.customer || norm(r.customer) !== c) return; }
      else if (sup || s) { if (r.customer) return; if (!((sup && norm(r.supplier) === sup) || (s && r.site && norm(r.site) === s))) return; }
      else if (!q.listPrice) return;
      if (q.listPrice && (r.customer || r.supplier)) return;
      if (r.product && norm(r.product) !== p) return;
      if (!r.product && (q.requireProduct || q.listPrice)) return;
      if (r.site && (!s || norm(r.site) !== s)) return;
      if (r.start_date && String(r.start_date) > date) return;
      if (r.end_date && String(r.end_date) < date) return;
      const score = (r.product ? 2 : 0) + (r.site ? 1 : 0) + (sup && norm(r.supplier) === sup ? 0.5 : 0) + (types && r.rule_type ? 0.25 : 0);
      if (score > bestScore || (score === bestScore && String(r.start_date || '') > String((best && best.start_date) || ''))) { best = r; bestScore = score; }
    });
    return best;
  }
  function listPriceRule(company, product, date) {
    return findRule({ company, product, date, listPrice: true, types: ['List Price'] });
  }
  function ownFleetNames(company) {
    return uniqSorted(SEED.records.equipment.filter(e => /^own/i.test(e.ownership || '')).map(e => e.name));
  }

  // Suggest the number after the most recently dated ticket of the pad (not the max — one mistyped
  // 7-digit number would otherwise push every suggestion into the millions)
  function nextTicketNo(company, lists) {
    let latest = null;
    lists.forEach(l => (l || []).forEach(r => {
      if (!r || r.voided || r.company !== company) return;
      const n = parseInt(String(r.ticket_no || '').replace(/\D/g, ''), 10);
      if (!n || n >= 1000000) return;
      const key = String(r.date || '') + '|' + String(n).padStart(7, '0');
      if (!latest || key > latest.key) latest = { key, n };
    }));
    return latest ? String(latest.n + 1) : '';
  }

  // duplicateTicketGuard: the same ticket number on any active sales / raw / fuel row of the same BU
  function ticketExists(company, no) {
    const t = norm(no);
    if (!t) return null;
    const pools = [['sales_tickets', 'Sales Ticket'], ['raw_purchases', 'Raw Material Ticket'], ['fuel_intakes', 'Fuel Intake']];
    for (const [k, label] of pools) {
      const hit = SEED.records[k].find(r => r && !r.voided && r.company === company && norm(r.ticket_no) === t);
      if (hit) return { table: k, label, row: hit };
    }
    return null;
  }

  // meterGuard: the unit's last reading strictly before the new date (prior-day readings preferred)
  function lastMeter(company, equipment, beforeDate) {
    const e = norm(equipment);
    if (!e) return null;
    let best = null;
    SEED.records.fuel_intakes.forEach(f => {
      if (!f || f.voided || norm(f.equipment) !== e) return;
      if (company && f.company && f.company !== company) return;
      if (beforeDate && String(f.date) > beforeDate) return;
      if (f.odometer == null && f.hours == null) return;
      if (!best || String(f.date) > String(best.date)) best = f;
    });
    return best;
  }

  function openArBalance(customer) {
    const c = customerInfo(customer);
    return c ? Number(c.ar_balance || 0) : null;
  }
  function openApBalance(supplier) {
    const s = supplierInfo(supplier);
    return s ? Number(s.ap_balance || 0) : null;
  }

  function isOvertimeTime(hhmm) {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''));
    if (!m) return false;
    const mins = Number(m[1]) * 60 + Number(m[2]);
    return mins < DAY_SHIFT_FROM || mins > DAY_SHIFT_TO;
  }

  // ==========================================================================
  // VIEW 01: OVERVIEW COMMAND CENTER (EXACT ISABI REV 10 "LEDGER" ARCHITECTURE)
  // ==========================================================================
  function buildExecutiveChart(months) {
    const W = 660, H = 248, ml = 46, mr = 12, mt = 18, mb = 30;
    const pw = W - ml - mr, ph = H - mt - mb;
    const rows = (months || []).slice(-12);
    if (!rows.length) {
      return '<svg class="chart" viewBox="0 0 660 248" role="img" aria-label="No monthly ledger data"><text class="tick" x="330" y="124" text-anchor="middle">No monthly ledger data for this entity yet</text></svg>';
    }

    const sValsList = rows.map(r => {
      const s = Math.max(0, Number(STATE.basis === 'rep' ? (r.sales_rep || r.sales_ttc || 0) : (r.sales_ttc || 0))) / 1000;
      const raw = Math.max(0, Number(r.raw_cost || 0)) / 1000;
      const prof = Math.max(0, Number(r.operating_profit || 0)) / 1000;
      return [s, raw, prof];
    });

    const maxVal = Math.max(100, ...sValsList.map(v => Math.max(v[0], v[1] + v[2])));
    const max = Math.ceil(maxVal / 250) * 250;
    const y = v => mt + ph - (v / max) * ph;

    let g = '';
    [0, 0.25, 0.5, 0.75, 1].forEach(f => {
      const tv = Math.round(max * f);
      g += `<line class="grid" x1="${ml}" x2="${W - mr}" y1="${y(tv).toFixed(1)}" y2="${y(tv).toFixed(1)}"/>`;
      g += `<text class="tick" x="${ml - 8}" y="${(y(tv) + 4).toFixed(1)}" text-anchor="end">$${tv.toLocaleString()}k</text>`;
    });
    g += `<text class="tick" x="${ml}" y="${mt - 5}" text-anchor="start">USD thousands</text>`;

    const n = rows.length;
    const slot = pw / n;
    const bw = Math.min(28, Math.max(16, slot * 0.58));
    const subW = (bw - 2) / 3;

    rows.forEach((row, i) => {
      const x0 = ml + slot * i + (slot - bw) / 2;
      const [sK, rK, pK] = sValsList[i];
      const ymFull = String(row['Year Month'] || row.YearMonthNo || '');
      const ymShort = ymFull.replace('2024', '24').replace('2025', '25').replace('2026', '26');

      const bars = [
        { v: sK, cls: 's-1', x: x0 },
        { v: rK, cls: 's-2', x: x0 + subW + 1 },
        { v: pK, cls: 's-3', x: x0 + (subW + 1) * 2 }
      ].map(b => {
        const top = y(b.v);
        const bottom = y(0);
        const h = Math.max(2, bottom - top);
        return `<rect class="${b.cls}" x="${b.x.toFixed(1)}" y="${top.toFixed(1)}" width="${subW.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5"/>`;
      }).join('');

      const tip = `Sales TTC: $${sK.toFixed(1)}k · Raw Cost: $${rK.toFixed(1)}k · Cash Profit: $${pK.toFixed(1)}k · Loads: ${fmtNum(row.loads)}`;
      g += `<g class="col" data-m="${esc(ymFull)}" data-t="$${sK.toFixed(1)}k Sales" data-tip="${esc(tip)}">`
        + `<rect class="hit" x="${(ml + slot * i).toFixed(1)}" y="${mt}" width="${slot.toFixed(1)}" height="${ph}"/>`
        + `${bars}</g>`;
      g += `<text class="tick" x="${(x0 + bw / 2).toFixed(1)}" y="${H - 9}" text-anchor="middle">${esc(ymShort.slice(0, 6))}</text>`;
      if (i === n - 1) {
        g += `<text class="lbl" x="${(x0 + bw / 2).toFixed(1)}" y="${(y(sK) - 6).toFixed(1)}" text-anchor="middle">$${Math.round(sK)}k</text>`;
      }
    });

    g += `<line class="axis" x1="${ml}" x2="${W - mr}" y1="${y(0)}" y2="${y(0)}"/>`;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Monthly revenue, quarry cost, and profit trajectory">${g}</svg>`;
  }

  function tbStatus(k) {
    const v = Number((k || {}).tb_check);
    if (k && k.tb_check == null) return { ok: null, label: 'No ledger' };
    return Math.abs(v) < 0.005 ? { ok: true, label: 'Balanced' } : { ok: false, label: fmtUSD(v, 2) + ' off' };
  }

  function appStrip() {
    const sum = appEnteredSummary();
    if (!sum.length) return '';
    return `<div class="app-strip" role="status"><b>App-entered this period (not yet in the book totals):</b>${sum.map(s => `<span>${fmtNum(s.n)} ${esc(s.label)} · ${s.unit === 'L' ? fmtNum(s.sum, 0) + ' L' : fmtUSD(s.sum, 0)}</span>`).join('')}<button type="button" class="btn" data-nav-jump="sales" style="padding:2px 9px;font-size:11px">Open registers →</button></div>`;
  }

  function renderOverview() {
    const m = getModel();
    const k = getKPI();
    const wtcK = (SEED.models.wtc && SEED.models.wtc.periods[STATE.period]) || {};
    const bbcK = (SEED.models.bbconstruction && SEED.models.bbconstruction.periods[STATE.period]) || {};
    const ltK = (SEED.models.lionstransport && SEED.models.lionstransport.periods && SEED.models.lionstransport.periods[STATE.period]) || {};
    const ltHasLedger = modelHasLedger('lionstransport');

    const salesVal = STATE.basis === 'rep' ? (k.sales_rep_date || k.sales_ttc) : k.sales_ttc;
    const rawVal = STATE.basis === 'rep' ? (k.raw_rep_date || k.raw_cost) : k.raw_cost;
    const expVal = STATE.basis === 'rep' ? (k.exp_rep_date || k.expenses) : k.expenses;
    const opProfit = STATE.basis === 'rep' ? (k.op_profit_rep_date || k.operating_profit) : k.operating_profit;

    const sentinelRows = buildSentinelItems().slice(0, 4);
    const soaRows = (m.soa_stream || []).slice(0, 8);
    const tb = tbStatus(k);
    const booksCount = STATE.company === 'manufacturing-group' ? '2' : (modelHasLedger() ? '1' : '0');
    const booksUnit = STATE.company === 'manufacturing-group' ? ' of 3 live' : ' of 1';

    let totDeb = 0, totCred = 0;
    soaRows.forEach(r => { totDeb += Number(r.debit || 0); totCred += Number(r.credit || 0); });

    if (!modelHasLedger()) {
      return `
        <div class="cockpit-banner">
          <div class="cockpit-title-block">
            <div class="cockpit-eyebrow">${esc(COMPANY_LABELS[STATE.company])}</div>
            <div class="cockpit-title">No ledger published for this entity yet</div>
            <div class="cockpit-sub">The semantic snapshot carries no periods, customers or GL for ${esc(COMPANY_LABELS[STATE.company])}. Transactions keyed here still post to the cloud ledger and appear in the registers.</div>
          </div>
        </div>
        ${appStrip()}
        <div class="panel-card"><div class="panel-head"><div class="panel-title"><span>WHAT YOU CAN DO HERE</span></div></div>
          <div style="padding:14px 16px;font-size:13px;line-height:1.6">
            • Key sales tickets, raw receipts, fuel intakes, expenses and settlements with <b>+ New Entry</b> (they carry the <span class="badge badge-app">APP</span> badge until the books absorb them).<br>
            • Switch to <b>WTC</b>, <b>BBConstruction</b> or <b>All Group</b> in the entity bar for the published KPIs, GL and statements.
          </div></div>`;
    }

    return `
      <!-- 1. UNIFIED 6-COLUMN EXECUTIVE KPI BAND (REV 10 "LEDGER" SURFACE) -->
      <section class="kpis" aria-label="Executive Key Performance Indicators">
        <div class="kpi">
          <span class="k">Consolidated Revenue (TTC)</span>
          <span class="v num">${fmtUSD(salesVal, 0)}</span>
          <span class="d good">Net Ex-VAT: ${fmtUSD(k.net_sales, 0)} · 11% VAT Incl.</span>
        </div>
        <div class="kpi">
          <span class="k">Realized Gross Margin</span>
          <span class="v num">${fmtUSD(k.gross_margin, 0)}<small>${fmtPct(k.gm_pct, k.gross_margin, k.net_sales)}</small></span>
          <span class="d good">Raw Quarry Cost: ${fmtUSD(rawVal, 0)}</span>
        </div>
        <div class="kpi">
          <span class="k">Operating Cash Profit</span>
          <span class="v num">${fmtUSD(opProfit, 0)}<small>${fmtPct(k.op_margin_pct, opProfit, k.net_sales)}</small></span>
          <span class="d">Expenses: ${fmtUSD(expVal, 0)} · Payroll: ${fmtUSD(k.salaries_paid, 0)}</span>
        </div>
        <div class="kpi">
          <span class="k">Cash Till &amp; Net Flow (5300)</span>
          <span class="v num">${fmtUSD(k.cash_till, 2)}</span>
          <span class="d">In: ${fmtUSD(k.cash_inflow, 0)} · Out: ${fmtUSD(k.cash_outflow, 0)}</span>
        </div>
        <div class="kpi">
          <span class="k">Open AR Receivables (FIFO)</span>
          <span class="v num">${fmtUSD(k.ar_balance, 0)}</span>
          <span class="d ${Number(k.ar_overdue || 0) > 0 ? 'crit' : 'good'}">Overdue &gt;30d: ${fmtUSD(k.ar_overdue, 0)} · DSO ${fmtNum(k.dso_days, 0)}d</span>
        </div>
        <div class="kpi books">
          <span class="k">Operating Books Status</span>
          <span class="v num">${booksCount}<small>${booksUnit}</small></span>
          <span class="d ${tb.ok === false ? 'crit' : 'good'}">Trial Balance ${tb.ok === false ? 'variance ' + fmtUSD(k.tb_check, 2) : '$0.00 Variance'}</span>
        </div>
      </section>

      <!-- 2. SECONDARY OPERATIONAL PROOF STRIP -->
      <section class="ops-strip" aria-label="Operational Unit Economics">
        <div class="ops-cell"><span>Sales Loads &amp; Volume</span><b class="num">${fmtNum(k.loads)} (${fmtNum(k.tons_sold, 0)} t)</b></div>
        <div class="ops-cell"><span>Avg Selling Price (TTC)</span><b class="num">${fmtUSD(k.avg_price_ttc, 2)} / unit</b></div>
        <div class="ops-cell"><span>Raw Quarry Intake</span><b class="num">${fmtNum(k.raw_loads)} loads (${fmtUSD(k.avg_raw_cost, 2)}/u)</b></div>
        <div class="ops-cell"><span>Active Fleet &amp; Cost/Ton</span><b class="num">${fmtNum(k.active_equip)} units · ${fmtUSD(k.cost_per_ton, 2)}/t</b></div>
        <div class="ops-cell"><span>Customer Price Matrix</span><b class="num">${fmtNum(k.active_agreements)} active rules</b></div>
        <div class="ops-cell"><span>3-Leg AP Open Balance</span><b class="num">${fmtUSD(k.ap_balance, 0)}</b></div>
      </section>
      ${appStrip()}

      <!-- 3. ROW 2: MONTHLY TRAJECTORY CHART + OPERATING ENTITIES & TOP GRADES -->
      <section class="row2">
        <div class="panel">
          <div class="ph">
            <div>
              <h3>Monthly Revenue, Quarry Cost &amp; Cash Profit Trajectory</h3>
              <span class="ph-sub">${esc(COMPANY_LABELS[STATE.company])} · Tap or hover bars to inspect monthly ledger totals</span>
            </div>
            <div class="legend">
              <span><i class="sw-box s-1"></i>Sales TTC</span>
              <span><i class="sw-box s-2"></i>Raw Quarry Cost</span>
              <span><i class="sw-box s-3"></i>Operating Profit</span>
            </div>
          </div>
          <div class="chartwrap" id="execChartWrap">
            ${buildExecutiveChart(m.monthly)}
            <div class="chart-tip" id="execChartTip" hidden></div>
          </div>
          ${(() => {
            const months = (m.monthly || []).slice(-12);
            const peakM = months.reduce((best, r) => (Number(r.sales_ttc || 0) > Number((best && best.sales_ttc) || 0) ? r : best), months[0] || {});
            const peakLabel = peakM['Year Month'] || peakM.Month || peakM.label || '—';
            const avgM = months.length ? months.reduce((a, r) => a + Number(r.sales_ttc || 0), 0) / months.length : 0;
            const cogsPct = Number(k.net_sales || 0) > 0 ? ((Number(k.raw_cost || 0) / Number(k.net_sales || 1)) * 100).toFixed(1) + '%' : '0.0%';
            const opPctStr = fmtPct(k.op_margin_pct, opProfit, k.net_sales);
            const gmPctStr = fmtPct(k.gm_pct, k.gross_margin, k.net_sales);
            return `
              <div class="chart-ftr">
                <div class="chart-ftr-cell"><small>Peak Month (${esc(peakLabel)})</small><b class="num">${fmtUSD(peakM.sales_ttc || 0, 0)}</b></div>
                <div class="chart-ftr-cell"><small>Monthly Run-Rate (last ${months.length || 12}m)</small><b class="num">${fmtUSD(avgM, 0)} / mo</b></div>
                <div class="chart-ftr-cell"><small>Direct Quarry Ratio</small><b class="num">${cogsPct} of Net</b></div>
                <div class="chart-ftr-cell"><small>Operating Profit %</small><b class="num">${opPctStr} (${gmPctStr} GM)</b></div>
              </div>
            `;
          })()}
        </div>

        <div class="panel">
          <div class="ph">
            <h3>Operating Entities &amp; Books Status</h3>
            <span class="ph-sub">Click any entity to filter workspace</span>
          </div>
          <div class="table-scroll">
            <table class="m-grid">
              <thead>
                <tr>
                  <th>Entity</th>
                  <th class="n">Sales TTC</th>
                  <th class="n hide-xs">Loads</th>
                  <th class="n">GM %</th>
                  <th class="n">Op. Profit</th>
                  <th>Books</th>
                </tr>
              </thead>
              <tbody>
                ${[['wtc', 'WTC<span class="hide-xs"> · World Trading</span>', wtcK], ['bbconstruction', 'BBConstruction', bbcK]].map(([key, label, kk]) => {
                  const t = tbStatus(kk);
                  return `
                <tr class="clickable-row" data-jump-co="${key}">
                  <td><b>${label}</b></td>
                  <td class="n">${fmtUSD(kk.sales_ttc, 0)}</td>
                  <td class="n hide-xs">${fmtNum(kk.loads)}</td>
                  <td class="n">${fmtPct(kk.gm_pct, kk.gross_margin, kk.net_sales)}</td>
                  <td class="n">${fmtUSD(kk.operating_profit, 0)}</td>
                  <td><span class="m-chip ${t.ok === false ? 'crit' : 'closed'}">${esc(t.label)}</span></td>
                </tr>`;
                }).join('')}
                <tr class="clickable-row" data-jump-co="lionstransport">
                  <td><b>Lions Transport</b></td>
                  <td class="n">${ltHasLedger ? fmtUSD(ltK.sales_ttc, 0) : '—'}</td>
                  <td class="n hide-xs">${ltHasLedger ? fmtNum(ltK.loads) : '—'}</td>
                  <td class="n">${ltHasLedger ? fmtPct(ltK.gm_pct, ltK.gross_margin, ltK.net_sales) : 'Fleet'}</td>
                  <td class="n">${ltHasLedger ? fmtUSD(ltK.operating_profit, 0) : '—'}</td>
                  <td><span class="m-chip ${ltHasLedger ? 'closed' : ''}">${ltHasLedger ? 'Balanced' : 'No ledger'}</span></td>
                </tr>
                <tr class="total">
                  <td>Group Total<span class="hide-xs"> (${ltHasLedger ? 3 : 2} live BUs)</span></td>
                  <td class="n">${fmtUSD(k.sales_ttc, 0)}</td>
                  <td class="n hide-xs">${fmtNum(k.loads)}</td>
                  <td class="n">${fmtPct(k.gm_pct, k.gross_margin, k.net_sales)}</td>
                  <td class="n">${fmtUSD(k.operating_profit, 0)}</td>
                  <td><span class="m-chip ${tb.ok === false ? 'crit' : 'brass'}">${tb.ok === false ? 'TB ' + tb.label : 'Audited'}</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="ph" style="border-top:1px solid var(--line);margin-top:4px">
            <h3>Top Aggregates &amp; Materials by Revenue</h3>
            <span class="ph-sub">${(m.products || []).length} Active Grades</span>
          </div>
          <div class="table-scroll">
            <table class="m-grid">
              <thead>
                <tr>
                  <th>Aggregate Grade</th>
                  <th class="hide-xs">UoM</th>
                  <th class="n hide-xs">Loads</th>
                  <th class="n">Tons</th>
                  <th class="n">Avg TTC</th>
                  <th class="n">Revenue TTC</th>
                </tr>
              </thead>
              <tbody>
                ${(m.products || []).slice(0, 4).map(p => `
                  <tr>
                    <td><b>${esc(p.Product)}</b></td>
                    <td class="mu hide-xs">${esc(p.UoM || 'm³')}</td>
                    <td class="n hide-xs">${fmtNum(p.loads)}</td>
                    <td class="n">${fmtNum(p.tons_sold, 0)}</td>
                    <td class="n">${fmtUSD(p.avg_price_ttc, 2)}</td>
                    <td class="n"><b>${fmtUSD(p.sales_ttc, 0)}</b></td>
                  </tr>
                `).join('') || emptyRow(6, 'No product revenue in this snapshot')}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- 4. ROW 3: EXECUTIVE EXCEPTIONS & WATCHDOGS + AUDITED DOUBLE-ENTRY GL STREAM -->
      <section class="row3">
        <div class="panel">
          <div class="ph">
            <h3>Executive Exceptions &amp; Sentinel Watchdogs</h3>
            <button type="button" class="btn-ghost-bar" style="padding:3px 9px;font-size:11px" data-nav-jump="sentinels">All ${buildSentinelItems().length} Sentinels</button>
          </div>
          <ul class="att">
            ${sentinelRows.map(s => {
              const cls = s.severity === 'ok' ? 'good' : s.severity;
              return `
                <li class="${cls}">
                  <b>${esc(s.title)}</b>
                  <span>${esc(s.detail)}</span>
                  <button type="button" class="att-act" data-nav-jump="sentinels">${esc(s.badge)}</button>
                </li>
              `;
            }).join('')}
          </ul>
        </div>

        <div class="panel">
          <div class="ph">
            <div>
              <h3>Audited General Ledger Stream (Double-Entry Lebanese CoA)</h3>
              <span class="ph-sub">Closed with the ISABI Double Rule · Every Sales Ticket, Quarry Leg, VAT 11% &amp; Settlement</span>
            </div>
            <button type="button" class="btn-ghost-bar" style="padding:3px 9px;font-size:11px" data-nav-jump="ledger">Full Trial Balance</button>
          </div>
          <div class="table-scroll">
            <table class="m-grid">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>BU</th>
                  <th>Voucher</th>
                  <th>CoA Account &amp; Counterparty</th>
                  <th class="n">Debit</th>
                  <th class="n">Credit</th>
                </tr>
              </thead>
              <tbody>
                ${soaRows.map(r => {
                  const rawDoc = String(r.doc || '—');
                  const hashMatch = rawDoc.match(/#\d+/);
                  const shortDoc = hashMatch ? ('TKT ' + hashMatch[0]) : rawDoc.slice(0, 14);
                  const cp = String(r.detail || r.desc || '').split('·')[0].trim().slice(0, 20);
                  return `
                  <tr>
                    <td class="mu">${esc(String(r.date || '').slice(0, 10))}</td>
                    <td><span class="m-chip brass">${esc(r.company === 'BBConstruction' ? 'BBC' : (r.company || 'WTC'))}</span></td>
                    <td class="mono">${esc(shortDoc)}</td>
                    <td><b>${esc(r.code)}</b> · ${esc(String(r.account || '').slice(0, 18))}${cp ? ` <span class="mu">(${esc(cp)})</span>` : ''}</td>
                    <td class="n">${r.debit ? fmtUSD(r.debit, 2) : '—'}</td>
                    <td class="n">${r.credit ? fmtUSD(r.credit, 2) : '—'}</td>
                  </tr>
                  `;
                }).join('') || emptyRow(6, 'No journal legs in this snapshot')}
                <tr class="total">
                  <td colspan="4">Last ${soaRows.length} audited legs · Trial Balance variance ${fmtUSD(k.tb_check || 0, 2)}</td>
                  <td class="n">${fmtUSD(totDeb, 2)}</td>
                  <td class="n">${fmtUSD(totCred, 2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    `;
  }

  // ==========================================================================
  // VIEW 02: AI SENTINELS (M280 LIVE WATCHDOGS — DRIVEN BY THE SNAPSHOT DATA)
  // ==========================================================================
  function sentinelSlice() {
    const sn = SEED.sentinels || {};
    const mk = SENTINEL_MODEL_KEY[STATE.company];
    return {
      fleet: (((sn.fleet_fuel_overtime_auditor || {}).by_model) || {})[mk] || {},
      pricing: (((sn.pricing_commission_payroll_sentinel || {}).by_model) || {})[mk] || {},
      parity: sn.sharepoint_parity_sentinel || {},
      generated: sn.generated_at || ''
    };
  }

  function buildSentinelItems() {
    const k = getKPI();
    const { fleet, pricing, parity } = sentinelSlice();
    const scope = STATE.company === 'manufacturing-group' ? 'WTC & BBConstruction' : COMPANY_BU_MATCH[STATE.company];
    const items = [];

    const tbv = k.tb_check == null ? null : Number(k.tb_check);
    items.push({
      code: 'S1 · TRIAL_BALANCE_TIE', title: 'Double-Entry Trial Balance Integrity (Lebanese CoA)',
      detail: tbv == null ? 'No ledger published for this entity yet.' : `Total Debits vs Total Credits across every SOA journal leg (sales, raw material, haulage, expenses, VAT 11%, receipts, settlements): variance ${fmtUSD(tbv, 2)}.`,
      severity: tbv == null ? 'warn' : (Math.abs(tbv) < 0.005 ? 'ok' : 'crit'),
      badge: tbv == null ? 'NO LEDGER' : (Math.abs(tbv) < 0.005 ? 'PASS · $0.00 DIFF' : 'FAIL · ' + fmtUSD(tbv, 2)),
      company: scope
    });

    const tank = fleet.diesel_stock_balance_l != null ? Number(fleet.diesel_stock_balance_l) : (k.diesel_in_tank == null ? null : Number(k.diesel_in_tank));
    items.push({
      code: 'S2 · DIESEL_TANK_RECONCILIATION', title: 'Diesel Tank Physical vs Ledger Reconciliation',
      detail: tank == null ? 'No diesel ledger for this entity.' : `Purchased ${fmtNum(fleet.diesel_purchased_l, 0)} L − issued ${fmtNum(fleet.diesel_issued_l, 0)} L − sold = ${fmtNum(tank, 0)} L in tank.${tank < -1000 ? ' A negative tank means bulk diesel invoices were booked under General Expenses instead of Fuel Purchases — the fuel form refuses new diesel intakes at that BU until the history is corrected (m212).' : ''}`,
      severity: tank == null ? 'warn' : (tank < -1000 ? 'crit' : (tank < 0 ? 'warn' : 'ok')),
      badge: tank == null ? 'NO DATA' : (tank < 0 ? 'ACTION · ' + fmtNum(tank, 0) + ' L' : 'OK · ' + fmtNum(tank, 0) + ' L'),
      company: scope
    });

    const meters = Number(fleet.meter_readings_to_check || 0);
    const outliers = fleet.consumption_outliers || [];
    items.push({
      code: 'S3 · FUEL_METER_OUTLIERS (M142)', title: 'Odometer & Hour-Meter Tolerance Watchdog',
      detail: `${fmtNum(meters)} meter readings to check · ${outliers.length} consumption outlier${outliers.length === 1 ? '' : 's'}${outliers.length ? ' (' + outliers.slice(0, 3).map(o => `${o.equipment} ${fmtNum(o.value, 1)} ${o.metric}`).join(', ') + ')' : ''} · ${fmtNum(fleet.own_units_idle_30d || 0)} own units idle 30+ days.`,
      severity: meters > 0 || outliers.length ? 'warn' : 'ok',
      badge: meters > 0 ? fmtNum(meters) + ' TO CHECK' : (outliers.length ? outliers.length + ' OUTLIER' + (outliers.length === 1 ? '' : 'S') : 'GUARD ACTIVE'),
      company: `${fmtNum(fleet.active_equipment || k.active_equip || 0)} units`
    });

    const ar60 = Number(k.ar_60_plus || 0);
    items.push({
      code: 'S4 · AR_OVERDUE_60_PLUS', title: 'Customer Receivables Overdue > 60 Days (FIFO Allocated)',
      detail: `Open AR ${fmtUSD(k.ar_balance, 2)} (VAT-inclusive per m249) · ${fmtUSD(ar60, 2)} aged past 60 days after FIFO receipt allocation · DSO ${fmtNum(k.dso_days, 0)} days.`,
      severity: ar60 > 0 ? 'warn' : 'ok',
      badge: `${fmtUSD(ar60, 0)} > 60D`,
      company: scope
    });

    const below = Number(pricing.sales_below_agreed_usd || 0);
    const lapsed = Number(pricing.lapsed_agreement_pairs_count || 0);
    items.push({
      code: 'S5 · PRICE_AGREEMENT_ENFORCEMENT', title: `${fmtNum(pricing.active_agreements || k.active_agreements || 0)} Active Price Agreements vs Tickets`,
      detail: `${fmtUSD(below, 0)} sold below the agreed price across ${fmtNum(pricing.below_agreed_pairs_count || 0)} customer × product pairs · ${fmtNum(lapsed)} pairs still trading on lapsed agreements · ${fmtNum(pricing.truck_unit_delivery_rules || 0)} per-truck delivery rules.`,
      severity: below > 0 || lapsed > 0 ? 'warn' : 'ok',
      badge: below > 0 ? fmtUSD(below, 0) + ' BELOW' : 'ENFORCED',
      company: scope
    });

    const dups = Number(pricing.duplicate_ticket_numbers || 0);
    const unnum = Number(pricing.unnumbered_tickets || 0);
    items.push({
      code: 'S6 · TICKET_BOOK_HYGIENE', title: 'Duplicate & Unnumbered Tickets in the Books',
      detail: `${fmtNum(dups)} duplicate ticket numbers · ${fmtNum(unnum)} unnumbered tickets · ${fmtNum(pricing.missing_tickets_in_books || 0)} numbers missing from ${fmtNum(pricing.incomplete_ticket_books || 0)} incomplete pads. The entry desk blocks a repeated number in the same BU unless you confirm it.`,
      severity: dups > 0 || unnum > 0 ? 'warn' : 'ok',
      badge: dups > 0 ? fmtNum(dups) + ' DUPLICATES' : 'CLEAN',
      company: scope
    });

    const unmatched = Number(pricing.unmatched_salary_payments_usd || 0);
    items.push({
      code: 'S7 · PAYROLL_CONTRACT_MATCH', title: 'Salary Payments Without an Employment Contract',
      detail: `${fmtUSD(unmatched, 2)} paid on staff-months with no contract · ${fmtUSD(fleet.unallocated_driver_payroll_usd || 0, 0)} driver payroll not allocated to a unit (${fmtNum(fleet.unallocated_driver_months_count || 0)} months) · commission balance ${fmtUSD(pricing.commission_balance_usd || 0, 0)}.`,
      severity: unmatched > 0 ? 'warn' : 'ok',
      badge: unmatched > 0 ? fmtUSD(unmatched, 0) + ' UNMATCHED' : 'MATCHED',
      company: scope
    });

    const anomalies = Number(parity.date_basis_anomalies_gt_31d_count || 0);
    items.push({
      code: 'S8 · DATE_BASIS_PARITY', title: 'Transaction vs Reporting Date Gaps > 31 Days',
      detail: `${fmtNum(anomalies)} rows carry a reporting date more than 31 days from the transaction date · ${fmtNum(parity.unlinked_vat_invoices_count || 0)} VAT invoices not linked to tickets · ${fmtNum(parity.header_vs_tickets_mismatch_count || 0)} VAT headers disagree with their tickets.`,
      severity: anomalies > 0 ? 'warn' : 'ok',
      badge: anomalies > 0 ? fmtNum(anomalies) + ' GAPS' : 'IN SYNC',
      company: 'SharePoint parity'
    });

    return items;
  }

  function miniTable(title, rows, cols, panelId) {
    return `
      <div class="panel-card" id="${esc(panelId)}">
        <div class="panel-head"><div class="panel-title"><span>${title}</span></div><span class="panel-meta">${fmtNum(rows.length)} rows ${rows.length ? exportBtn(panelId, title.replace(/&amp;/g, 'and')) : ''}</span></div>
        <div class="table-wrap"><table class="ledger-table">
          <thead><tr>${cols.map(c => `<th class="${c.r ? 'r' : ''}">${c.label}</th>`).join('')}</tr></thead>
          <tbody>${rows.slice(0, 60).map(r => `<tr>${cols.map(c => `<td class="${c.r ? 'r' : ''}${c.mono ? ' mono' : ''}">${c.fmt ? c.fmt(r[c.key], r) : esc(r[c.key] == null ? '—' : r[c.key])}</td>`).join('')}</tr>`).join('') || emptyRow(cols.length, 'Nothing flagged')}</tbody>
        </table></div>
      </div>`;
  }

  function renderSentinels() {
    const items = buildSentinelItems();
    const { fleet, pricing, parity, generated } = sentinelSlice();
    const open = items.filter(i => i.severity !== 'ok').length;
    const k = getKPI();
    const usd0 = v => fmtUSD(v, 0);
    const usd2 = v => fmtUSD(v, 2);
    const num1 = v => fmtNum(v, 1);
    return `
      <div class="cockpit-banner">
        <div class="cockpit-title-block">
          <div class="cockpit-eyebrow">AUTONOMOUS AUDIT &amp; ANOMALY DETECTION · M280 ENGINE · RUN ${esc(String(generated).slice(0, 16).replace('T', ' ') || '—')}</div>
          <div class="cockpit-title">AI Sentinel Watchdogs</div>
          <div class="cockpit-sub">Deterministic audit rules evaluated against the SQL ledger snapshot for ${esc(COMPANY_LABELS[STATE.company])} — no external BI license required.</div>
        </div>
        <div class="cockpit-pills">
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Active Sentinels</div><div class="cockpit-pill-val brass">${items.length} Rules</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Needing Action</div><div class="cockpit-pill-val ${open ? 'amber' : 'emerald'}">${open}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">TB Variance</div><div class="cockpit-pill-val ${Math.abs(Number(k.tb_check || 0)) < 0.005 ? 'emerald' : 'amber'}">${fmtUSD(k.tb_check || 0, 2)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Below-Agreed Sales</div><div class="cockpit-pill-val ${Number(pricing.sales_below_agreed_usd || 0) > 0 ? 'amber' : 'emerald'}">${fmtUSD(pricing.sales_below_agreed_usd || 0, 0)}</div></div>
        </div>
      </div>

      <div class="panel-card">
        <div class="panel-head">
          <div class="panel-title"><span>LIVE AUDIT CHECKS &amp; RECOMMENDED ACTIONS</span></div>
          <span class="panel-meta">Verified against SQLite &amp; Semantic Baseline</span>
        </div>
        <div class="sentinel-list">
          ${items.map(s => `
            <div class="sentinel-item ${s.severity}" style="padding:14px 16px">
              <div>
                <div class="mono" style="font-size:10px;color:var(--brass);margin-bottom:2px">${esc(s.code)} · ${esc(s.company)}</div>
                <div class="sentinel-title" style="font-size:14px">${esc(s.title)}</div>
                <div class="sentinel-detail" style="font-size:12.5px;margin-top:4px">${esc(s.detail)}</div>
              </div>
              <span class="badge ${s.severity === 'ok' ? 'badge-ok' : (s.severity === 'crit' ? 'badge-err' : 'badge-warn')}">${esc(s.badge)}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="mini-table-grid">
        ${miniTable('TOP SALES BELOW AGREED PRICE', pricing.top_below_agreed_exceptions || [], [
          { label: 'Customer', key: 'customer' }, { label: 'Product', key: 'product' }, { label: 'Qty', key: 'qty', r: true, fmt: v => fmtNum(v, 1) },
          { label: 'Last Price', key: 'last_price', r: true, fmt: usd2 }, { label: 'Agreed', key: 'agreed_price', r: true, fmt: usd2 }, { label: 'Shortfall', key: 'shortfall_usd', r: true, fmt: (v, r) => v != null ? usd0(v) : (r.agreed_price != null && r.last_price != null ? usd0((Number(r.agreed_price) - Number(r.last_price)) * Number(r.qty || 0)) : '—') }
        ], 'snBelow')}
        ${miniTable('LAPSED AGREEMENTS STILL TRADING', pricing.lapsed_agreement_pairs || [], [
          { label: 'Customer', key: 'customer' }, { label: 'Product', key: 'product' }, { label: 'Qty', key: 'qty', r: true, fmt: v => fmtNum(v, 1) },
          { label: 'Actual', key: 'actual_price', r: true, fmt: usd2 }, { label: 'Agreed (lapsed)', key: 'agreed_price', r: true, fmt: usd2 }
        ], 'snLapsed')}
        ${miniTable('FUEL CONSUMPTION OUTLIERS', fleet.consumption_outliers || [], [
          { label: 'Equipment', key: 'equipment', mono: true }, { label: 'Type', key: 'type' }, { label: 'Metric', key: 'metric' },
          { label: 'Value', key: 'value', r: true, fmt: num1 }, { label: 'Distance / Hours', key: 'distance_km', r: true, fmt: (v, r) => fmtNum(v != null ? v : r.hours, 0) }, { label: 'Diesel (L)', key: 'diesel_l', r: true, fmt: v => fmtNum(v, 0) }
        ], 'snFuel')}
        ${miniTable('SALARY PAYMENTS WITHOUT A CONTRACT', pricing.unmatched_salary_by_staff || [], [
          { label: 'Staff Member', key: 'staff' }, { label: 'Unmatched ($)', key: 'unmatched_usd', r: true, fmt: usd2 }
        ], 'snPayroll')}
        ${miniTable('TRANSACTION vs REPORTING DATE GAPS &gt; 31 DAYS', (parity.date_basis_anomalies_gt_31d || []).filter(r => STATE.company === 'manufacturing-group' || r.bu === COMPANY_BU_MATCH[STATE.company]), [
          { label: 'Table', key: 'table' }, { label: 'BU', key: 'bu' }, { label: 'Record', key: 'name' }, { label: 'Ticket', key: 'ticket', mono: true },
          { label: 'Tx Date', key: 'transaction_date', mono: true }, { label: 'Rep Date', key: 'reporting_date', mono: true }, { label: 'Gap (d)', key: 'gap_days', r: true, fmt: v => fmtNum(v) }, { label: 'Amount', key: 'amount_usd', r: true, fmt: usd2 }
        ], 'snDates')}
        ${miniTable('VAT INVOICES NOT LINKED TO TICKETS (SAMPLE)', (parity.unlinked_vat_invoices_sample || []).filter(r => STATE.company === 'manufacturing-group' || r.bu === COMPANY_BU_MATCH[STATE.company]), [
          { label: 'BU', key: 'bu' }, { label: 'Invoice', key: 'invoice' }, { label: 'No.', key: 'invoiceno', mono: true }, { label: 'Date', key: 'date', mono: true },
          { label: 'Header Net', key: 'header_net', r: true, fmt: usd2 }, { label: 'Header VAT', key: 'header_vat', r: true, fmt: usd2 }
        ], 'snVat')}
      </div>
    `;
  }

  // ==========================================================================
  // VIEW 03: SALES & DELIVERIES (12-COL LEDGER + 35 FORM RULES)
  // ==========================================================================
  function renderSales() {
    const k = getKPI();
    const base = filterRecords(SEED.records.sales_tickets);
    const rows = sortRows(base.filter(r => {
      if (STATE.chipFilter === 'delivery') return r.sale_type === 'Delivery';
      if (STATE.chipFilter === 'pickup') return r.sale_type === 'Pickup';
      if (STATE.chipFilter === 'credit') return r.method === 'Credit';
      if (STATE.chipFilter === 'cash') return r.method === 'Cash';
      if (STATE.chipFilter === 'overtime') return !!r.overtime;
      if (STATE.chipFilter === 'vat') return Number(r.vat || 0) > 0;
      if (STATE.chipFilter === 'app') return isAppRecord(r);
      return true;
    }), 'sales', 'date', 'desc');
    const shown = rows.slice(0, shownCount('sales'));
    const sumQty = shown.reduce((a, r) => a + Number(r.qty || 0), 0);
    const sumMat = shown.reduce((a, r) => a + Number(r.price || 0), 0);
    const sumTr = shown.reduce((a, r) => a + Number(r.trans_price || 0), 0);
    const sumTtc = shown.reduce((a, r) => a + Number(r.total_ttc || 0), 0);
    const chip = (key, label) => `<button class="filter-chip ${STATE.chipFilter === key ? 'active' : ''}" data-chip="${key}">${label}</button>`;

    return `
      <div class="cockpit-banner">
        <div class="cockpit-title-block">
          <div class="cockpit-eyebrow">WEIGHBRIDGE &amp; DISPATCH LEDGER · 35 SMART FORM RULES</div>
          <div class="cockpit-title">Sales &amp; Deliveries Register</div>
          <div class="cockpit-sub">Automatic Price Agreement lookup · Delivery vs Pickup transport gating · 11% VAT invoice calculation · Overtime shift detection.</div>
        </div>
        <div class="cockpit-pills">
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Total Sales TTC</div><div class="cockpit-pill-val brass">${fmtUSD(k.sales_ttc, 0)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Total Loads</div><div class="cockpit-pill-val">${fmtNum(k.loads)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Delivery / Pickup</div><div class="cockpit-pill-val">${fmtNum(k.delivery_loads)} / ${fmtNum(k.pickup_loads)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Tons Sold</div><div class="cockpit-pill-val emerald">${fmtNum(k.tons_sold, 0)} t</div></div>
          ${appPill('sales_tickets', 'total_ttc', 'tickets')}
        </div>
      </div>

      <div class="panel-card" id="salesPanel">
        <div class="table-toolbar">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            ${searchBox('Search ticket #, customer, product, site, truck, driver...')}
            <div class="chip-bar">
              ${chip('all', `All (${base.length})`)}${chip('delivery', 'Delivery')}${chip('pickup', 'Pickup')}${chip('credit', 'Credit')}${chip('cash', 'Cash')}${chip('vat', 'VAT')}${chip('overtime', 'Overtime')}${chip('app', 'App-entered')}
            </div>
          </div>
          <div style="display:flex;gap:6px">
            ${exportBtn('salesPanel', 'Sales_Register')}
            ${canEnterForm('sales') ? '<button class="btn btn-primary" data-open-modal="sales">+ New Sales Ticket</button>' : ''}
          </div>
        </div>

        <div class="table-wrap">
          <table class="ledger-table">
            <thead>
              <tr>
                ${th('sales', 'Date', 'date')}${th('sales', 'Ticket #', 'ticket_no')}${th('sales', 'Co.', 'company')}${th('sales', 'Type', 'sale_type')}
                ${th('sales', 'Customer', 'customer')}${th('sales', 'Product', 'product')}${th('sales', 'Destination Site', 'site')}${th('sales', 'Truck / Driver', 'truck')}
                ${th('sales', 'Qty', 'qty', 'r')}${th('sales', 'Mat ($)', 'price', 'r')}${th('sales', 'Trans ($)', 'trans_price', 'r')}${th('sales', 'VAT ($)', 'vat', 'r')}${th('sales', 'Total TTC ($)', 'total_ttc', 'r')}${th('sales', 'Method', 'method')}
              </tr>
            </thead>
            <tbody>
              ${shown.map(r => `
                <tr>
                  <td class="mono">${esc(recordDate(r))}${appCell(r, 'sales_tickets')}</td>
                  <td class="mono"><strong>${esc(r.ticket_no || '(no number)')}</strong>${r.overtime ? ' <span class="badge badge-warn" title="Overtime load">OT</span>' : ''}</td>
                  <td><span class="badge badge-brass">${esc(r.company)}</span></td>
                  <td>${esc(r.sale_type)}</td>
                  <td><strong>${esc(r.customer)}</strong></td>
                  <td>${esc(r.product)}</td>
                  <td>${esc(r.site || '—')}</td>
                  <td class="mono">${esc(r.truck || r.transport_by || '—')}${r.driver ? ` <span class="mu">· ${esc(r.driver)}</span>` : ''}</td>
                  <td class="r">${fmtNum(r.qty, 2)} ${esc(r.uom)}</td>
                  <td class="r">${fmtUSD(r.price, 2)}</td>
                  <td class="r">${fmtUSD(r.trans_price, 2)}</td>
                  <td class="r">${Number(r.vat || 0) ? fmtUSD(r.vat, 2) : '—'}</td>
                  <td class="r"><strong>${fmtUSD(r.total_ttc, 2)}</strong></td>
                  <td><span class="badge ${r.method === 'Cash' ? 'badge-ok' : 'badge-info'}">${esc(r.method)}</span></td>
                </tr>
              `).join('') || emptyRow(14, periodEmptyMsg(SEED.records.sales_tickets, 'sales tickets'))}
              ${showMoreRow('sales', rows.length, 14)}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="8">SHOWING ${fmtNum(shown.length)} OF ${fmtNum(rows.length)} MATCHING TICKETS · BOOK ARCHIVE ${fmtNum(k.loads)} LOADS</td>
                <td class="r">${fmtNum(sumQty, 0)}</td>
                <td class="r">${fmtUSD(sumMat, 0)}</td>
                <td class="r">${fmtUSD(sumTr, 0)}</td>
                <td class="r"></td>
                <td class="r">${fmtUSD(sumTtc, 2)}</td>
                <td>SHOWN</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div class="split-grid-2">
        <div class="panel-card" id="salesProdPanel">
          <div class="panel-head">
            <div class="panel-title"><span>SALES BY PRODUCT &amp; AGGREGATE GRADE (FULL LEDGER)</span></div>
            <span class="panel-meta">${fmtNum((getModel().products || []).length)} Grades ${exportBtn('salesProdPanel', 'Sales_By_Product')}</span>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  ${th('sprod', 'Product / Grade', 'Product')}${th('sprod', 'Family', 'Material Family')}${th('sprod', 'UoM', 'UoM')}${th('sprod', 'Loads', 'loads', 'r')}
                  ${th('sprod', 'Qty Sold', 'qty_sold', 'r')}${th('sprod', 'Tons Sold', 'tons_sold', 'r')}${th('sprod', 'List Price', 'list_price', 'r')}${th('sprod', 'Avg Net', 'avg_price_net', 'r')}${th('sprod', 'Avg TTC', 'avg_price_ttc', 'r')}${th('sprod', 'Sales TTC ($)', 'sales_ttc', 'r')}
                </tr>
              </thead>
              <tbody>
                ${sortRows((getModel().products || []), 'sprod', 'sales_ttc', 'desc').map(p => `
                  <tr>
                    <td><strong>${esc(p.Product)}</strong></td>
                    <td>${esc(p['Material Family'] || 'Aggregate')}</td>
                    <td class="mono">${esc(p.UoM || 'm³')}</td>
                    <td class="r">${fmtNum(p.loads)}</td>
                    <td class="r">${fmtNum(p.qty_sold, 0)}</td>
                    <td class="r">${fmtNum(p.tons_sold, 0)}</td>
                    <td class="r">${p.list_price != null ? fmtUSD(p.list_price, 2) : '—'}</td>
                    <td class="r">${fmtUSD(p.avg_price_net, 2)}</td>
                    <td class="r">${fmtUSD(p.avg_price_ttc, 2)}</td>
                    <td class="r"><strong>${fmtUSD(p.sales_ttc, 0)}</strong></td>
                  </tr>
                `).join('') || emptyRow(10, 'No product breakdown for this entity')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="panel-card" id="salesSitePanel">
          <div class="panel-head">
            <div class="panel-title"><span>LOADS &amp; REVENUE BY DESTINATION SITE</span></div>
            <span class="panel-meta">${fmtNum((getModel().sites || []).length)} Active Sites ${exportBtn('salesSitePanel', 'Sales_By_Site')}</span>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  ${th('ssite', 'Destination Site', 'Site')}${th('ssite', 'JV', 'JV')}${th('ssite', 'Sales Loads', 'loads', 'r')}${th('ssite', 'Tons Sold', 'tons_sold', 'r')}${th('ssite', 'Transport Rev ($)', 'trans_rev', 'r')}${th('ssite', 'Sales TTC ($)', 'sales_ttc', 'r')}
                </tr>
              </thead>
              <tbody>
                ${sortRows((getModel().sites || []), 'ssite', 'sales_ttc', 'desc').map(s => `
                  <tr>
                    <td><strong>${esc(s.Site || '(no site on ticket)')}</strong></td>
                    <td>${s.JV === 'Yes' ? '<span class="badge badge-brass">JV</span>' : '—'}</td>
                    <td class="r">${fmtNum(s.loads)}</td>
                    <td class="r">${fmtNum(s.tons_sold, 0)}</td>
                    <td class="r">${fmtUSD(s.trans_rev, 0)}</td>
                    <td class="r"><strong>${fmtUSD(s.sales_ttc, 0)}</strong></td>
                  </tr>
                `).join('') || emptyRow(6, 'No site breakdown for this entity')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // VIEW 04: RAW MATERIAL & QUARRIES (2-PAYABLE SPLIT: SITE OWNER + HAULER)
  // ==========================================================================
  function renderRaw() {
    const k = getKPI();
    const m = getModel();
    const base = filterRecords(SEED.records.raw_purchases);
    const rows = sortRows(base.filter(r => {
      if (STATE.chipFilter === 'fleet') return r.transport_by === 'Company fleet';
      if (STATE.chipFilter === 'third') return r.transport_by === 'Third-party truck';
      if (STATE.chipFilter === 'app') return isAppRecord(r);
      return true;
    }), 'raw', 'date', 'desc');
    const shown = rows.slice(0, shownCount('raw'));
    const chip = (key, label) => `<button class="filter-chip ${STATE.chipFilter === key ? 'active' : ''}" data-chip="${key}">${label}</button>`;
    const sumMat = shown.reduce((a, r) => a + Number(r.cost || 0), 0);
    const sumHaul = shown.reduce((a, r) => a + Number(r.trans_cost || 0), 0);

    return `
      <div class="cockpit-banner">
        <div class="cockpit-title-block">
          <div class="cockpit-eyebrow">QUARRY INTAKE &amp; HAULAGE SPLIT · M192 TWO-LEG PAYABLE ENGINE</div>
          <div class="cockpit-title">Raw Material &amp; Quarries</div>
          <div class="cockpit-sub">Every raw load splits cleanly into Leg 1: Material Cost owed to Quarry Site Owner + Leg 2: Haulage owed to Truck Owner.</div>
        </div>
        <div class="cockpit-pills">
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Total Raw Cost</div><div class="cockpit-pill-val brass">${fmtUSD(k.raw_cost, 0)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Material Leg</div><div class="cockpit-pill-val">${fmtUSD(k.raw_mat_cost, 0)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Haulage Leg</div><div class="cockpit-pill-val">${fmtUSD(k.raw_haulage, 0)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Raw Loads / Tons</div><div class="cockpit-pill-val emerald">${fmtNum(k.raw_loads)} / ${fmtNum(k.raw_tons, 0)}t</div></div>
          ${appPill('raw_purchases', 'total', 'receipts')}
        </div>
      </div>

      <div class="split-grid-2">
        <div class="panel-card" id="rawPanel">
          <div class="table-toolbar">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              ${searchBox('Search ticket #, quarry site, site owner, hauler, product...')}
              <div class="chip-bar">${chip('all', `All (${base.length})`)}${chip('fleet', 'Company fleet')}${chip('third', 'Third-party')}${chip('app', 'App-entered')}</div>
            </div>
            <div style="display:flex;gap:6px">
              ${exportBtn('rawPanel', 'Raw_Register')}
              ${canEnterForm('raw') ? '<button class="btn btn-primary" data-open-modal="raw">+ New Raw Receipt</button>' : ''}
            </div>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  ${th('raw', 'Date', 'date')}${th('raw', 'Ticket #', 'ticket_no')}${th('raw', 'Co.', 'company')}${th('raw', 'Quarry Site', 'site')}
                  ${th('raw', 'Site Owner (Mat. Payee)', 'site_owner')}${th('raw', 'Truck Owner (Haul Payee)', 'truck_owner')}${th('raw', 'Product', 'product')}
                  ${th('raw', 'Qty', 'qty', 'r')}${th('raw', 'Mat Cost', 'cost', 'r')}${th('raw', 'Haulage', 'trans_cost', 'r')}${th('raw', 'Total ($)', 'total', 'r')}
                </tr>
              </thead>
              <tbody>
                ${shown.map(r => `
                  <tr>
                    <td class="mono">${esc(recordDate(r))}${appCell(r, 'raw_purchases')}</td>
                    <td class="mono"><strong>${esc(r.ticket_no || '(no number)')}</strong></td>
                    <td><span class="badge badge-brass">${esc(r.company)}</span></td>
                    <td><strong>${esc(r.site || '—')}</strong></td>
                    <td>${esc(r.site_owner || '—')}</td>
                    <td>${esc(r.truck_owner || (r.transport_by === 'Company fleet' ? 'Company fleet' : (r.transport_by || '—')))}</td>
                    <td>${esc(r.product)}</td>
                    <td class="r">${fmtNum(r.qty, 2)} ${esc(r.uom)}</td>
                    <td class="r">${fmtUSD(r.cost, 2)}</td>
                    <td class="r">${fmtUSD(r.trans_cost, 2)}</td>
                    <td class="r"><strong>${fmtUSD(r.total, 2)}</strong></td>
                  </tr>
                `).join('') || emptyRow(11, periodEmptyMsg(SEED.records.raw_purchases, 'raw material receipts'))}
                ${showMoreRow('raw', rows.length, 11)}
              </tbody>
              <tfoot>
                <tr><td colspan="8">SHOWING ${fmtNum(shown.length)} OF ${fmtNum(rows.length)} MATCHING RECEIPTS</td><td class="r">${fmtUSD(sumMat, 0)}</td><td class="r">${fmtUSD(sumHaul, 0)}</td><td class="r">${fmtUSD(sumMat + sumHaul, 2)}</td></tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div class="panel-card" id="sitesPanel">
          <div class="panel-head">
            <div class="panel-title"><span>TOP QUARRIES &amp; CUSTOMER SITES BY VOLUME</span></div>
            <span class="panel-meta">${fmtNum(SEED.records.sites.length)} Registered Sites ${exportBtn('sitesPanel', 'Sites')}</span>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  ${th('sites', 'Site Name', 'Site')}${th('sites', 'JV', 'JV')}${th('sites', 'Sales Loads', 'loads', 'r')}${th('sites', 'Sales TTC', 'sales_ttc', 'r')}${th('sites', 'Raw Loads', 'raw_loads', 'r')}${th('sites', 'Raw Cost', 'raw_cost', 'r')}
                </tr>
              </thead>
              <tbody>
                ${sortRows((m.sites || []), 'sites', 'sales_ttc', 'desc').slice(0, 18).map(s => `
                  <tr>
                    <td><strong>${esc(s.Site || '(no site on ticket)')}</strong></td>
                    <td>${s.JV === 'Yes' ? '<span class="badge badge-brass">JV</span>' : '—'}</td>
                    <td class="r">${fmtNum(s.loads)}</td>
                    <td class="r">${fmtUSD(s.sales_ttc, 0)}</td>
                    <td class="r">${fmtNum(s.raw_loads)}</td>
                    <td class="r"><strong>${fmtUSD(s.raw_cost, 0)}</strong></td>
                  </tr>
                `).join('') || emptyRow(6, 'No site aggregates for this entity')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // VIEW 05: EQUIPMENT, FLEET & DIESEL (M99 REGISTRY + M142 METER GUARD)
  // ==========================================================================
  function meterGuardMap(fuelRows) {
    // Walk each unit's readings in date order; flag backwards readings and > 5,000 km / > 500 h jumps
    const byUnit = new Map();
    fuelRows.forEach(f => {
      const key = norm(f.company) + '|' + norm(f.equipment);
      if (!byUnit.has(key)) byUnit.set(key, []);
      byUnit.get(key).push(f);
    });
    const out = new Map();
    byUnit.forEach(list => {
      list.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));
      let prev = null;
      list.forEach(f => {
        let flag = { cls: 'badge-ok', label: '● OK' };
        const cur = f.odometer != null ? Number(f.odometer) : (f.hours != null ? Number(f.hours) : null);
        const pv = prev ? (prev.odometer != null ? Number(prev.odometer) : (prev.hours != null ? Number(prev.hours) : null)) : null;
        const isHours = f.odometer == null && f.hours != null;
        if (cur == null) flag = { cls: '', label: 'No meter' };
        else if (pv != null) {
          if (cur < pv) flag = { cls: 'badge-err', label: '▼ Backwards' };
          else if (!isHours && cur - pv > 5000) flag = { cls: 'badge-warn', label: '▲ +' + fmtNum(cur - pv, 0) + ' km' };
          else if (isHours && cur - pv > 500) flag = { cls: 'badge-warn', label: '▲ +' + fmtNum(cur - pv, 0) + ' h' };
        }
        out.set(f.id, flag);
        if (cur != null) prev = f;
      });
    });
    return out;
  }

  function renderFleet() {
    const k = getKPI();
    const m = getModel();
    const { fleet } = sentinelSlice();
    const allFuel = filterRecords(SEED.records.fuel_intakes, { ignoreSearch: true, ignorePeriod: true });
    const guards = meterGuardMap(allFuel);
    const base = filterRecords(SEED.records.fuel_intakes);
    const fuelRows = sortRows(base.filter(f => {
      if (STATE.chipFilter === 'flag') { const g = guards.get(f.id); return g && g.cls !== 'badge-ok' && g.cls !== ''; }
      if (STATE.chipFilter === 'diesel') return /diesel/i.test(f.item || f.fuel_type || '');
      if (STATE.chipFilter === 'lube') return !/diesel/i.test(f.item || f.fuel_type || '');
      if (STATE.chipFilter === 'app') return isAppRecord(f);
      return true;
    }), 'fuel', 'date', 'desc');
    const shownFuel = fuelRows.slice(0, shownCount('fuel'));
    const litres = shownFuel.reduce((a, f) => a + Number(f.litres || 0), 0);
    const chip = (key, label) => `<button class="filter-chip ${STATE.chipFilter === key ? 'active' : ''}" data-chip="${key}">${label}</button>`;
    const flagged = allFuel.filter(f => { const g = guards.get(f.id); return g && (g.cls === 'badge-err' || g.cls === 'badge-warn'); }).length;
    const tank = fleet.diesel_stock_balance_l != null ? Number(fleet.diesel_stock_balance_l) : Number(k.diesel_in_tank || 0);
    const equipRows = sortRows((m.equipment || []).filter(e => !STATE.search || Object.values(e).join(' ').toLowerCase().includes(STATE.search.toLowerCase())), 'equip', 'total_cost', 'desc');

    return `
      <div class="cockpit-banner">
        <div class="cockpit-title-block">
          <div class="cockpit-eyebrow">UNIVERSAL FLEET REGISTRY · M99 + M142 METER TOLERANCE GUARD</div>
          <div class="cockpit-title">Equipment, Fleet &amp; Diesel Telemetry</div>
          <div class="cockpit-sub">Tracks ${fmtNum(SEED.records.equipment.length)} trucks, loaders, excavators &amp; generators · Allocates running costs, driver wages &amp; diesel per ton hauled.</div>
        </div>
        <div class="cockpit-pills">
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Active Fleet</div><div class="cockpit-pill-val brass">${fmtNum(k.active_equip)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Cost / Ton Hauled</div><div class="cockpit-pill-val emerald">${fmtUSD(k.cost_per_ton, 2)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Cost / m³ Hauled</div><div class="cockpit-pill-val">${fmtUSD(k.cost_per_unit, 2)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Diesel Issued</div><div class="cockpit-pill-val">${fmtNum(k.diesel_litres, 0)} L</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Diesel In Tank</div><div class="cockpit-pill-val ${tank < 0 ? 'amber' : 'emerald'}">${fmtNum(tank, 0)} L</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Total Fleet Cost</div><div class="cockpit-pill-val amber">${fmtUSD(k.total_equip_cost, 0)}</div></div>
          ${appPill('fuel_intakes', 'litres', 'intakes (L)')}
        </div>
      </div>

      <div class="split-grid-2">
        <div class="panel-card" id="equipPanel">
          <div class="panel-head">
            <div class="panel-title"><span>UNIT PROFITABILITY &amp; TELEMETRY (TOP ${fmtNum((m.equipment || []).length)} ACTIVE UNITS)</span></div>
            <span class="panel-meta">Running + Driver Cost Allocated ${exportBtn('equipPanel', 'Equipment_Costs')}</span>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  ${th('equip', 'Equipment / Plate', 'Equipment')}${th('equip', 'Type', 'Type')}${th('equip', 'Ownership', 'Ownership')}${th('equip', 'Trips', 'trips', 'r')}${th('equip', 'Diesel (L)', 'diesel_litres', 'r')}
                  ${th('equip', 'Km Run', 'km_run', 'r')}${th('equip', 'Running ($)', 'running_cost', 'r')}${th('equip', 'Driver ($)', 'driver_cost', 'r')}${th('equip', 'Total Cost', 'total_cost', 'r')}${th('equip', '$/Ton', 'cost_per_ton', 'r')}
                </tr>
              </thead>
              <tbody>
                ${equipRows.map(e => `
                  <tr>
                    <td class="mono"><strong>${esc(e.Equipment)}</strong></td>
                    <td>${esc(e.Type || 'Truck')}</td>
                    <td><span class="badge ${e.Ownership === 'Owned' || e.Ownership === 'Own' ? 'badge-ok' : 'badge-info'}">${esc(e.Ownership || 'Transporter')}</span></td>
                    <td class="r">${fmtNum(e.trips)}</td>
                    <td class="r">${fmtNum(e.diesel_litres, 0)}</td>
                    <td class="r">${fmtNum(e.km_run, 0)}</td>
                    <td class="r">${fmtUSD(e.running_cost, 0)}</td>
                    <td class="r">${fmtUSD(e.driver_cost, 0)}</td>
                    <td class="r"><strong>${fmtUSD(e.total_cost, 0)}</strong></td>
                    <td class="r">${e.cost_per_ton ? fmtUSD(e.cost_per_ton, 2) : '—'}</td>
                  </tr>
                `).join('') || emptyRow(10, 'No equipment cost rows for this entity')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="panel-card" id="fuelPanel">
          <div class="table-toolbar">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              ${searchBox('Search equipment, driver, ticket #, item...')}
              <div class="chip-bar">${chip('all', `All (${base.length})`)}${chip('diesel', 'Diesel')}${chip('lube', 'Lubricants')}${chip('flag', `Guard flags (${flagged})`)}${chip('app', 'App-entered')}</div>
            </div>
            <div style="display:flex;gap:6px">
              ${exportBtn('fuelPanel', 'Fuel_Intakes')}
              ${canEnterForm('fuel') ? '<button class="btn btn-primary" data-open-modal="fuel">+ Log Fuel Intake</button>' : ''}
            </div>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  ${th('fuel', 'Date', 'date')}${th('fuel', 'Ticket', 'ticket_no')}${th('fuel', 'Co.', 'company')}${th('fuel', 'Equipment', 'equipment')}${th('fuel', 'Driver', 'driver')}${th('fuel', 'Item', 'item')}
                  ${th('fuel', 'Litres', 'litres', 'r')}${th('fuel', 'Meter', 'odometer', 'r')}<th>M142 Guard</th>
                </tr>
              </thead>
              <tbody>
                ${shownFuel.map(f => {
                  const g = guards.get(f.id) || { cls: 'badge-ok', label: '● OK' };
                  return `
                  <tr>
                    <td class="mono">${esc(recordDate(f))}${appCell(f, 'fuel_intakes')}</td>
                    <td class="mono">${esc(f.ticket_no || '—')}</td>
                    <td><span class="badge badge-brass">${esc(f.company)}</span></td>
                    <td class="mono"><strong>${esc(f.equipment)}</strong></td>
                    <td>${esc(f.driver || '—')}</td>
                    <td>${esc(f.item || f.fuel_type || 'Diesel')}</td>
                    <td class="r"><strong>${fmtNum(f.litres, 1)} L</strong></td>
                    <td class="r">${f.odometer != null && f.odometer !== '' ? fmtNum(f.odometer, 0) + ' km' : (f.hours != null && f.hours !== '' ? fmtNum(f.hours, 1) + ' h' : '—')}</td>
                    <td><span class="badge ${g.cls}">${esc(g.label)}</span></td>
                  </tr>`;
                }).join('') || emptyRow(9, periodEmptyMsg(SEED.records.fuel_intakes, 'fuel intakes'))}
                ${showMoreRow('fuel', fuelRows.length, 9)}
              </tbody>
              <tfoot><tr><td colspan="6">SHOWING ${fmtNum(shownFuel.length)} OF ${fmtNum(fuelRows.length)} INTAKES</td><td class="r">${fmtNum(litres, 0)} L</td><td colspan="2"></td></tr></tfoot>
            </table>
          </div>
        </div>

        <div class="panel-card" id="driverPanel">
          <div class="panel-head">
            <div class="panel-title"><span>UNIVERSAL EQUIPMENT &amp; DRIVER REGISTRY (${fmtNum(SEED.records.equipment.length)} UNITS · ${fmtNum(SEED.records.drivers.length)} DRIVERS)</span></div>
            <span class="panel-meta">M99 + M107 Universal Registry ${exportBtn('driverPanel', 'Equipment_Registry')}</span>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  ${th('eqreg', 'Unit / Plate', 'name')}${th('eqreg', 'Category', 'type')}${th('eqreg', 'Ownership', 'ownership')}${th('eqreg', 'Capacity', 'capacity', 'r')}
                  ${th('eqreg', 'Truck Owner / Supplier', 'supplier')}${th('eqreg', 'Customer Link', 'customer')}${th('eqreg', 'Default Driver', 'default_driver')}
                </tr>
              </thead>
              <tbody>
                ${sortRows(SEED.records.equipment.filter(e => !STATE.search || Object.values(e).join(' ').toLowerCase().includes(STATE.search.toLowerCase())), 'eqreg', 'name', 'asc').slice(0, shownCount('eqreg')).map(e => `
                  <tr>
                    <td class="mono"><strong>${esc(e.name)}</strong></td>
                    <td>${esc(e.type || 'Truck')}</td>
                    <td><span class="badge ${/^own/i.test(e.ownership || '') ? 'badge-ok' : 'badge-info'}">${esc(e.ownership || 'Transporter')}</span></td>
                    <td class="r">${e.capacity ? fmtNum(e.capacity, 1) : '—'}</td>
                    <td>${esc(e.supplier || '—')}</td>
                    <td>${esc(e.customer || '—')}</td>
                    <td>${esc(e.default_driver || '—')}</td>
                  </tr>
                `).join('') || emptyRow(7, 'No matching equipment units')}
                ${showMoreRow('eqreg', SEED.records.equipment.filter(e => !STATE.search || Object.values(e).join(' ').toLowerCase().includes(STATE.search.toLowerCase())).length, 7)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // VIEW 06: PRICING & COMMISSION AGREEMENTS
  // ==========================================================================
  function renderPricing() {
    const k = getKPI();
    const today = SEED_DATE;
    const isActive = r => (!r.end_date || String(r.end_date) >= today) && (!r.start_date || String(r.start_date) <= today);
    const base = filterRecords(SEED.records.price_rules, { ignorePeriod: true });
    const types = uniqSorted(base.map(r => r.rule_type));
    const rules = sortRows(base.filter(r => {
      if (STATE.chipFilter === 'active') return isActive(r);
      if (STATE.chipFilter === 'lapsed') return !isActive(r);
      if (STATE.chipFilter === 'customer') return !!r.customer;
      if (STATE.chipFilter === 'quarry') return !r.customer && (r.supplier || r.site);
      if (types.includes(STATE.chipFilter)) return r.rule_type === STATE.chipFilter;
      return true;
    }), 'pricing', 'start_date', 'desc');
    const shown = rules.slice(0, shownCount('pricing'));
    const chip = (key, label) => `<button class="filter-chip ${STATE.chipFilter === key ? 'active' : ''}" data-chip="${key}">${label}</button>`;
    const activeCount = base.filter(isActive).length;
    const typeChips = types.length ? types.map(t => chip(t, t)).join('') : chip('customer', 'Customer rules') + chip('quarry', 'Quarry / hauler rules');

    return `
      <div class="cockpit-banner">
        <div class="cockpit-title-block">
          <div class="cockpit-eyebrow">CONTRACTUAL PRICE ENGINE · M73 + M228 + M276</div>
          <div class="cockpit-title">Price &amp; Commission Agreements</div>
          <div class="cockpit-sub">Governs Sales (Delivery), Sales (Pickup), Quarry Purchase Price (Site), Hauler Transport Price (Site) &amp; Sales Commissions. The entry desk locks ticket prices to the matching active rule.</div>
        </div>
        <div class="cockpit-pills">
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Active Agreements</div><div class="cockpit-pill-val brass">${fmtNum(k.active_agreements != null ? k.active_agreements : activeCount)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Total SQL Rules</div><div class="cockpit-pill-val">${fmtNum(base.length)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Commission Due</div><div class="cockpit-pill-val amber">${fmtUSD(k.commission_due, 0)}</div></div>
        </div>
      </div>

      <div class="panel-card" id="pricingPanel">
        <div class="table-toolbar">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            ${searchBox('Search customer, quarry supplier, product, site, agreement code...')}
            <div class="chip-bar">${chip('all', `All (${base.length})`)}${chip('active', `Active (${activeCount})`)}${chip('lapsed', 'Lapsed')}${typeChips}</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center"><span class="panel-meta">Showing ${fmtNum(shown.length)} of ${fmtNum(rules.length)}</span>${exportBtn('pricingPanel', 'Price_Agreements')}</div>
        </div>
        <div class="table-wrap">
          <table class="ledger-table">
            <thead>
              <tr>
                ${th('pricing', 'Agreement Code', 'name')}${th('pricing', 'Co.', 'company')}${th('pricing', 'Rule Type', 'rule_type')}${th('pricing', 'Customer / Quarry Owner', 'customer')}${th('pricing', 'Product', 'product')}${th('pricing', 'Site', 'site')}
                ${th('pricing', 'Unit', 'unit')}${th('pricing', 'Unit Price ($)', 'unit_price', 'r')}${th('pricing', 'Transport Price ($)', 'trans_unit_price', 'r')}${th('pricing', 'Start Date', 'start_date')}${th('pricing', 'End Date', 'end_date')}<th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${shown.map(pr => `
                <tr>
                  <td class="mono"><strong>${esc(pr.name)}</strong></td>
                  <td><span class="badge badge-brass">${esc(pr.company)}</span></td>
                  <td><span class="badge badge-info">${esc(pr.rule_type || '—')}</span></td>
                  <td><strong>${esc(pr.customer || pr.supplier || (pr.site ? pr.site + ' (site)' : 'Standard List'))}</strong></td>
                  <td>${esc(pr.product || '(All Grades)')}</td>
                  <td>${esc(pr.site || '—')}</td>
                  <td class="mono">${esc(pr.unit)}</td>
                  <td class="r"><strong>${fmtUSD(pr.unit_price, 2)}</strong></td>
                  <td class="r">${pr.trans_unit_price ? fmtUSD(pr.trans_unit_price, 2) : '—'}</td>
                  <td class="mono">${esc(pr.start_date || '—')}</td>
                  <td class="mono">${esc(pr.end_date || 'Open')}</td>
                  <td><span class="badge ${isActive(pr) ? 'badge-ok' : 'badge-warn'}">${isActive(pr) ? 'Active' : 'Lapsed'}</span></td>
                </tr>
              `).join('') || emptyRow(12, STATE.search ? `No agreements match "${STATE.search}".` : 'No agreements for this entity')}
              ${showMoreRow('pricing', rules.length, 12)}
            </tbody>
          </table>
        </div>
      </div>

      <div class="split-grid-2">
        <div class="panel-card" id="listPricePanel">
          <div class="panel-head">
            <div class="panel-title"><span>LIST PRICE BENCHMARK VS. REALIZED SELLING PRICE BY GRADE</span></div>
            <span class="panel-meta">M281 Price vs. List ${exportBtn('listPricePanel', 'Price_Benchmark')}</span>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  ${th('pbench', 'Product / Grade', 'Product')}${th('pbench', 'UoM', 'UoM')}${th('pbench', 'Loads', 'loads', 'r')}${th('pbench', 'List Price ($)', 'list_price', 'r')}
                  ${th('pbench', 'Realized Net ($)', 'avg_price_net', 'r')}${th('pbench', 'Realized TTC ($)', 'avg_price_ttc', 'r')}${th('pbench', 'Sales TTC ($)', 'sales_ttc', 'r')}
                </tr>
              </thead>
              <tbody>
                ${sortRows((getModel().products || []), 'pbench', 'sales_ttc', 'desc').map(p => `
                  <tr>
                    <td><strong>${esc(p.Product)}</strong></td>
                    <td class="mono">${esc(p.UoM || 'm³')}</td>
                    <td class="r">${fmtNum(p.loads)}</td>
                    <td class="r">${p.list_price != null ? fmtUSD(p.list_price, 2) : '—'}</td>
                    <td class="r">${fmtUSD(p.avg_price_net, 2)}</td>
                    <td class="r"><strong>${fmtUSD(p.avg_price_ttc, 2)}</strong></td>
                    <td class="r">${fmtUSD(p.sales_ttc, 0)}</td>
                  </tr>
                `).join('') || emptyRow(7, 'No product benchmark rows for this entity')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // VIEW 07: CUSTOMERS & RECEIVABLES (AR) — FIFO ALLOCATION & AGING
  // ==========================================================================
  function renderAR() {
    const k = getKPI();
    const m = getModel();
    const q = STATE.search.trim().toLowerCase();
    const custs = sortRows((m.customers || []).filter(c => !q || String(c.Customer || '').toLowerCase().includes(q)), 'custs', 'ar_balance', 'desc');
    const base = filterRecords(SEED.records.receipts);
    const rcpts = sortRows(base.filter(r => STATE.chipFilter === 'app' ? isAppRecord(r) : (STATE.chipFilter === 'all' || r.method === STATE.chipFilter)), 'receipts', 'date', 'desc');
    const shown = rcpts.slice(0, shownCount('receipts'));
    const methods = uniqSorted(SEED.records.receipts.map(r => r.method));
    const chip = (key, label) => `<button class="filter-chip ${STATE.chipFilter === key ? 'active' : ''}" data-chip="${key}">${label}</button>`;
    const sumAmt = shown.reduce((a, r) => a + Number(r.amount || 0), 0);

    return `
      <div class="cockpit-banner">
        <div class="cockpit-title-block">
          <div class="cockpit-eyebrow">ACCOUNTS RECEIVABLE · M165 FIFO ALLOCATION + M249 VAT-INCLUSIVE BALANCE</div>
          <div class="cockpit-title">Customers &amp; Receivables (AR)</div>
          <div class="cockpit-sub">Every receipt or credit note settles the customer's oldest open tickets first (FIFO) · Balances include 11% VAT for VAT-registered customers.</div>
        </div>
        <div class="cockpit-pills">
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Net AR Balance</div><div class="cockpit-pill-val brass">${fmtUSD(k.ar_balance, 2)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Current (0–10d)</div><div class="cockpit-pill-val emerald">${fmtUSD((k.ar_current || 0) + (k.ar_1_10 || 0), 0)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">11–60 Days</div><div class="cockpit-pill-val">${fmtUSD((k.ar_11_30 || 0) + (k.ar_31_60 || 0), 0)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Overdue 60+ Days</div><div class="cockpit-pill-val amber">${fmtUSD(k.ar_60_plus, 0)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Receipts Collected</div><div class="cockpit-pill-val">${fmtUSD(k.receipts, 0)}</div></div>
          ${appPill('receipts', 'amount', 'receipts')}
        </div>
      </div>

      <div class="split-grid-2">
        <div class="panel-card" id="custPanel">
          <div class="table-toolbar">
            ${searchBox('Search customer...')}
            <div style="display:flex;gap:6px">
              ${exportBtn('custPanel', 'AR_Aging')}
              ${canEnterForm('receipt') ? '<button class="btn btn-primary" data-open-modal="receipt">+ Customer Receipt (FIFO)</button>' : ''}
            </div>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  ${th('custs', 'Customer', 'Customer')}${th('custs', 'VAT Reg', 'VAT Registered')}${th('custs', 'Loads', 'loads', 'r')}${th('custs', 'Sales TTC', 'sales_ttc', 'r')}${th('custs', 'Receipts', 'receipts', 'r')}
                  ${th('custs', 'Current', 'ar_current', 'r')}${th('custs', 'Overdue 60+', 'ar_60_plus', 'r')}${th('custs', 'Open AR ($)', 'ar_balance', 'r')}${th('custs', 'Last Sale', 'last_sale')}
                </tr>
              </thead>
              <tbody>
                ${custs.map(c => `
                  <tr>
                    <td><strong>${esc(c.Customer)}</strong></td>
                    <td>${c['VAT Registered'] === 'Yes' ? '<span class="badge badge-info">11% VAT</span>' : 'No'}</td>
                    <td class="r">${fmtNum(c.loads)}</td>
                    <td class="r">${fmtUSD(c.sales_ttc, 0)}</td>
                    <td class="r">${fmtUSD(c.receipts, 0)}</td>
                    <td class="r">${fmtUSD(c.ar_current, 0)}</td>
                    <td class="r">${Number(c.ar_60_plus || 0) > 0 ? `<span style="color:var(--crit)">${fmtUSD(c.ar_60_plus, 0)}</span>` : '—'}</td>
                    <td class="r"><strong>${fmtUSD(c.ar_balance, 2)}</strong></td>
                    <td class="mono">${esc(String(c.last_sale || '').slice(0, 10) || '—')}</td>
                  </tr>
                `).join('') || emptyRow(9, q ? `No customers match "${STATE.search}".` : 'No customer balances for this entity')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="panel-card" id="rcptPanel">
          <div class="table-toolbar">
            <div class="chip-bar">${chip('all', `All (${base.length})`)}${methods.map(mm => chip(mm, mm)).join('')}${chip('app', 'App-entered')}</div>
            <span class="panel-meta">FIFO Auto-Applied ${exportBtn('rcptPanel', 'Customer_Receipts')}</span>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  ${th('receipts', 'Date', 'date')}${th('receipts', 'Voucher', 'name')}${th('receipts', 'Co.', 'company')}${th('receipts', 'Customer', 'customer')}${th('receipts', 'Method', 'method')}${th('receipts', 'Cash ($)', 'amount', 'r')}${th('receipts', 'Disc ($)', 'discount', 'r')}
                </tr>
              </thead>
              <tbody>
                ${shown.map(r => `
                  <tr>
                    <td class="mono">${esc(recordDate(r))}${appCell(r, 'receipts')}</td>
                    <td class="mono">${esc(r.name)}${r.reference ? ` <span class="mu">· ${esc(r.reference)}</span>` : ''}</td>
                    <td><span class="badge badge-brass">${esc(r.company)}</span></td>
                    <td><strong>${esc(r.customer)}</strong></td>
                    <td>${esc(r.method)}</td>
                    <td class="r"><strong>${fmtUSD(r.amount, 2)}</strong></td>
                    <td class="r">${r.discount ? fmtUSD(r.discount, 2) : '—'}</td>
                  </tr>
                `).join('') || emptyRow(7, periodEmptyMsg(SEED.records.receipts, 'customer receipts'))}
                ${showMoreRow('receipts', rcpts.length, 7)}
              </tbody>
              <tfoot><tr><td colspan="5">SHOWING ${fmtNum(shown.length)} OF ${fmtNum(rcpts.length)}</td><td class="r">${fmtUSD(sumAmt, 2)}</td><td></td></tr></tfoot>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // VIEW 08: SUPPLIERS & PAYABLES (AP) — 3-LEG QUARRY / HAULER / EXPENSE ENGINE
  // ==========================================================================
  function renderAP() {
    const k = getKPI();
    const m = getModel();
    const q = STATE.search.trim().toLowerCase();
    const sups = sortRows((m.suppliers || []).filter(s => !q || String(s.Supplier || '').toLowerCase().includes(q)), 'sups', 'ap_balance', 'desc');
    const base = filterRecords(SEED.records.settlements);
    const spays = sortRows(base.filter(r => STATE.chipFilter === 'app' ? isAppRecord(r) : (STATE.chipFilter === 'all' || r.method === STATE.chipFilter)), 'settle', 'date', 'desc');
    const shown = spays.slice(0, shownCount('settle'));
    const methods = uniqSorted(SEED.records.settlements.map(r => r.method));
    const chip = (key, label) => `<button class="filter-chip ${STATE.chipFilter === key ? 'active' : ''}" data-chip="${key}">${label}</button>`;
    const sumAmt = shown.reduce((a, r) => a + Number(r.amount || 0), 0);

    return `
      <div class="cockpit-banner">
        <div class="cockpit-title-block">
          <div class="cockpit-eyebrow">ACCOUNTS PAYABLE · M192 THREE-LEG FIFO SETTLEMENT ENGINE</div>
          <div class="cockpit-title">Suppliers, Quarries &amp; Haulers (AP)</div>
          <div class="cockpit-sub">Tracks open payables across Material Legs (Quarry Owner), Haulage Legs (Truck Owner) &amp; Supplies/Services Legs (Credit Expenses).</div>
        </div>
        <div class="cockpit-pills">
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Net AP Balance</div><div class="cockpit-pill-val brass">${fmtUSD(k.ap_balance, 0)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Material Legs</div><div class="cockpit-pill-val">${fmtUSD(k.ap_material, 0)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Haulage Legs</div><div class="cockpit-pill-val">${fmtUSD(k.ap_haulage, 0)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Expense Legs</div><div class="cockpit-pill-val">${fmtUSD(k.ap_expense, 0)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Settlements Paid</div><div class="cockpit-pill-val emerald">${fmtUSD(k.settlements_paid, 0)}</div></div>
          ${appPill('settlements', 'amount', 'settlements')}
        </div>
      </div>

      <div class="split-grid-2">
        <div class="panel-card" id="supPanel">
          <div class="table-toolbar">
            ${searchBox('Search supplier / hauler...')}
            <div style="display:flex;gap:6px">
              ${exportBtn('supPanel', 'AP_Legs')}
              ${canEnterForm('settlement') ? '<button class="btn btn-primary" data-open-modal="settlement">+ Supplier Settlement</button>' : ''}
            </div>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  ${th('sups', 'Supplier / Hauler', 'Supplier')}${th('sups', 'IVA', 'IVA')}${th('sups', 'Raw Loads', 'raw_loads', 'r')}${th('sups', 'Mat. Leg', 'ap_material', 'r')}${th('sups', 'Haul Leg', 'ap_haulage', 'r')}
                  ${th('sups', 'Exp. Leg', 'ap_expense', 'r')}${th('sups', 'Paid ($)', 'settlements_paid', 'r')}${th('sups', 'Net AP ($)', 'ap_balance', 'r')}
                </tr>
              </thead>
              <tbody>
                ${sups.map(s => `
                  <tr>
                    <td><strong>${esc(s.Supplier)}</strong></td>
                    <td>${s.IVA === 'Yes' ? '<span class="badge badge-info">IVA</span>' : '—'}</td>
                    <td class="r">${fmtNum(s.raw_loads)}</td>
                    <td class="r">${fmtUSD(s.ap_material, 0)}</td>
                    <td class="r">${fmtUSD(s.ap_haulage, 0)}</td>
                    <td class="r">${fmtUSD(s.ap_expense, 0)}</td>
                    <td class="r">${fmtUSD(s.settlements_paid, 0)}</td>
                    <td class="r"><strong>${fmtUSD(s.ap_balance, 2)}</strong></td>
                  </tr>
                `).join('') || emptyRow(8, q ? `No suppliers match "${STATE.search}".` : 'No supplier balances for this entity')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="panel-card" id="settlePanel">
          <div class="table-toolbar">
            <div class="chip-bar">${chip('all', `All (${base.length})`)}${methods.map(mm => chip(mm, mm)).join('')}${chip('app', 'App-entered')}</div>
            <span class="panel-meta">Oldest-First Leg Relief ${exportBtn('settlePanel', 'Supplier_Settlements')}</span>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  ${th('settle', 'Date', 'date')}${th('settle', 'Voucher', 'name')}${th('settle', 'Co.', 'company')}${th('settle', 'Supplier', 'supplier')}${th('settle', 'Method', 'method')}${th('settle', 'Cash Paid', 'amount', 'r')}${th('settle', 'Diff / Disc', 'discount', 'r')}
                </tr>
              </thead>
              <tbody>
                ${shown.map(sp => `
                  <tr>
                    <td class="mono">${esc(recordDate(sp))}${appCell(sp, 'settlements')}</td>
                    <td class="mono">${esc(sp.name)}${sp.reference ? ` <span class="mu">· ${esc(sp.reference)}</span>` : ''}</td>
                    <td><span class="badge badge-brass">${esc(sp.company)}</span></td>
                    <td><strong>${esc(sp.supplier)}</strong></td>
                    <td>${esc(sp.method)}</td>
                    <td class="r"><strong>${fmtUSD(sp.amount, 2)}</strong></td>
                    <td class="r">${sp.discount ? fmtUSD(sp.discount, 2) : '—'}</td>
                  </tr>
                `).join('') || emptyRow(7, periodEmptyMsg(SEED.records.settlements, 'supplier settlements'))}
                ${showMoreRow('settle', spays.length, 7)}
              </tbody>
              <tfoot><tr><td colspan="5">SHOWING ${fmtNum(shown.length)} OF ${fmtNum(spays.length)}</td><td class="r">${fmtUSD(sumAmt, 2)}</td><td></td></tr></tfoot>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // VIEW 09: EXPENSES & PAYROLL
  // ==========================================================================
  function renderExpenses() {
    const k = getKPI();
    const base = filterRecords(SEED.records.expenses);
    const expRows = sortRows(base.filter(x => {
      if (STATE.chipFilter === 'cash') return x.method === 'Cash';
      if (STATE.chipFilter === 'credit') return x.method === 'Credit';
      if (STATE.chipFilter === 'app') return isAppRecord(x);
      return true;
    }), 'expenses', 'date', 'desc');
    const shownExp = expRows.slice(0, shownCount('expenses'));
    const salRows = sortRows(filterRecords(SEED.records.salaries), 'salaries', 'date', 'desc');
    const shownSal = salRows.slice(0, shownCount('salaries'));
    const chip = (key, label) => `<button class="filter-chip ${STATE.chipFilter === key ? 'active' : ''}" data-chip="${key}">${label}</button>`;
    const sumExp = shownExp.reduce((a, r) => a + Number(r.amount || 0), 0);
    const sumSal = shownSal.reduce((a, r) => a + Number(r.amount || 0), 0);

    return `
      <div class="cockpit-banner">
        <div class="cockpit-title-block">
          <div class="cockpit-eyebrow">OPERATING COSTS, SPARE PARTS &amp; WORKFORCE PAYROLL</div>
          <div class="cockpit-title">Expenses &amp; Payroll Ledger</div>
          <div class="cockpit-sub">Categorized into Production Cost (Class 60/61), Operating Expenses (Class 62) &amp; Capital Expenditures (Class 2) + Staff Salaries &amp; Overtime.</div>
        </div>
        <div class="cockpit-pills">
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Total Expenses</div><div class="cockpit-pill-val brass">${fmtUSD(k.expenses, 0)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Cash / Credit</div><div class="cockpit-pill-val">${fmtUSD(k.cash_expenses, 0)} / ${fmtUSD(k.credit_expenses, 0)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Salaries Paid</div><div class="cockpit-pill-val emerald">${fmtUSD(k.salaries_paid, 0)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Overtime Due</div><div class="cockpit-pill-val amber">${fmtUSD(k.overtime_bonus, 0)}</div></div>
          ${appPill('expenses', 'amount', 'expenses')}
        </div>
      </div>

      <div class="split-grid-2">
        <div class="panel-card" id="expPanel">
          <div class="table-toolbar">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              ${searchBox('Search category, supplier, equipment, reference...')}
              <div class="chip-bar">${chip('all', `All (${base.length})`)}${chip('cash', 'Cash')}${chip('credit', 'Credit')}${chip('app', 'App-entered')}</div>
            </div>
            <div style="display:flex;gap:6px">
              ${exportBtn('expPanel', 'Expense_Register')}
              ${canEnterForm('expense') ? '<button class="btn btn-primary" data-open-modal="expense">+ New Expense</button>' : ''}
            </div>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  ${th('expenses', 'Date', 'date')}${th('expenses', 'Co.', 'company')}${th('expenses', 'Category', 'category')}${th('expenses', 'Subcategory', 'subcategory')}${th('expenses', 'Supplier', 'supplier')}${th('expenses', 'Equipment', 'equipment')}${th('expenses', 'Method', 'method')}${th('expenses', 'Amount ($)', 'amount', 'r')}
                </tr>
              </thead>
              <tbody>
                ${shownExp.map(x => `
                  <tr>
                    <td class="mono">${esc(recordDate(x))}${appCell(x, 'expenses')}</td>
                    <td><span class="badge badge-brass">${esc(x.company)}</span></td>
                    <td><strong>${esc(x.category)}</strong></td>
                    <td>${esc(x.subcategory || '—')}${x.reference ? ` <span class="mu">· ${esc(x.reference)}</span>` : ''}</td>
                    <td>${esc(x.supplier || '—')}</td>
                    <td class="mono">${esc(x.equipment || '—')}</td>
                    <td><span class="badge ${x.method === 'Cash' ? 'badge-ok' : 'badge-info'}">${esc(x.method)}</span></td>
                    <td class="r"><strong>${fmtUSD(x.amount, 2)}</strong></td>
                  </tr>
                `).join('') || emptyRow(8, periodEmptyMsg(SEED.records.expenses, 'expenses'))}
                ${showMoreRow('expenses', expRows.length, 8)}
              </tbody>
              <tfoot><tr><td colspan="7">SHOWING ${fmtNum(shownExp.length)} OF ${fmtNum(expRows.length)}</td><td class="r">${fmtUSD(sumExp, 2)}</td></tr></tfoot>
            </table>
          </div>
        </div>

        <div class="panel-card" id="salPanel">
          <div class="panel-head">
            <div class="panel-title"><span>STAFF SALARIES &amp; PAYROLL DISBURSEMENTS</span></div>
            <span class="panel-meta">Account 421 / 641 ${exportBtn('salPanel', 'Payroll')}</span>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  ${th('salaries', 'Date', 'date')}${th('salaries', 'Payroll Month', 'payroll_month')}${th('salaries', 'Co.', 'company')}${th('salaries', 'Staff Member', 'staff')}${th('salaries', 'Method', 'method')}${th('salaries', 'Paid ($)', 'amount', 'r')}
                </tr>
              </thead>
              <tbody>
                ${shownSal.map(s => `
                  <tr>
                    <td class="mono">${esc(recordDate(s))}</td>
                    <td class="mono">${esc(s.payroll_month)}</td>
                    <td><span class="badge badge-brass">${esc(s.company)}</span></td>
                    <td><strong>${esc(s.staff)}</strong></td>
                    <td>${esc(s.method || '—')}</td>
                    <td class="r"><strong>${fmtUSD(s.amount, 2)}</strong></td>
                  </tr>
                `).join('') || emptyRow(6, periodEmptyMsg(SEED.records.salaries, 'salary payments'))}
                ${showMoreRow('salaries', salRows.length, 6)}
              </tbody>
              <tfoot><tr><td colspan="5">SHOWING ${fmtNum(shownSal.length)} OF ${fmtNum(salRows.length)}</td><td class="r">${fmtUSD(sumSal, 2)}</td></tr></tfoot>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // VIEW 10: GENERAL LEDGER & TRIAL BALANCE (LEBANESE COA CLASSES 1–7)
  // ==========================================================================
  function renderGL() {
    const m = getModel();
    const k = getKPI();
    const q = STATE.search.trim().toLowerCase();
    const tbAll = m.gl_tb || [];
    const tb = sortRows(tbAll.filter(r => !q || `${r.Code} ${r.Account} ${r.Class}`.toLowerCase().includes(q)), 'gl', 'Code', 'asc');
    let totDr = 0, totCr = 0;
    tbAll.forEach(r => { totDr += Number(r.debit || 0); totCr += Number(r.credit || 0); });
    const diff = round2(totDr - totCr);
    const tied = Math.abs(diff) < 0.005;

    return `
      <div class="cockpit-banner">
        <div class="cockpit-title-block">
          <div class="cockpit-eyebrow">LEBANESE GENERAL CHART OF ACCOUNTS (PLAN COMPTABLE GÉNÉRAL)</div>
          <div class="cockpit-title">General Ledger &amp; Trial Balance</div>
          <div class="cockpit-sub">Every operational transaction posts balanced Debit &amp; Credit legs in real time · Classes 1 to 7 tied to ${tied ? '$0.00' : fmtUSD(diff, 2)} variance.</div>
        </div>
        <div class="cockpit-pills">
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Total Debits</div><div class="cockpit-pill-val">${fmtUSD(totDr, 2)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Total Credits</div><div class="cockpit-pill-val">${fmtUSD(totCr, 2)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">TB Check</div><div class="cockpit-pill-val ${tied ? 'emerald' : 'amber'}">${tied ? '$0.00 TIED' : fmtUSD(diff, 2) + ' OFF'}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Model TB Check</div><div class="cockpit-pill-val ${Math.abs(Number(k.tb_check || 0)) < 0.005 ? 'emerald' : 'amber'}">${fmtUSD(k.tb_check || 0, 2)}</div></div>
        </div>
      </div>

      <div class="panel-card" id="glPanel">
        <div class="table-toolbar">
          ${searchBox('Search GL code, account, class...')}
          <div style="display:flex;gap:6px">${exportBtn('glPanel', 'Trial_Balance')}<button class="btn" data-nav-jump="statements" data-stmt-jump="02">Print Official Trial Balance PDF →</button></div>
        </div>
        <div class="table-wrap">
          <table class="ledger-table">
            <thead>
              <tr>
                ${th('gl', 'GL Code', 'Code')}${th('gl', 'Account Name', 'Account')}${th('gl', 'Lebanese CoA Class', 'Class')}${th('gl', 'Total Debit ($)', 'debit', 'r')}${th('gl', 'Total Credit ($)', 'credit', 'r')}${th('gl', 'Net Balance ($)', 'balance', 'r')}
              </tr>
            </thead>
            <tbody>
              ${tb.map(r => `
                <tr>
                  <td class="mono"><strong>${esc(r.Code)}</strong></td>
                  <td><strong>${esc(r.Account)}</strong></td>
                  <td><span class="badge badge-info">${esc(r.Class)}</span></td>
                  <td class="r">${fmtUSD(r.debit, 2)}</td>
                  <td class="r">${fmtUSD(r.credit, 2)}</td>
                  <td class="r"><strong>${fmtUSD(r.balance, 2)}</strong></td>
                </tr>
              `).join('') || emptyRow(6, tbAll.length ? `No accounts match "${STATE.search}".` : 'No trial balance published for this entity')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3">TOTAL TRIAL BALANCE (${tbAll.length} ACTIVE GL ACCOUNTS)</td>
                <td class="r">${fmtUSD(totDr, 2)}</td>
                <td class="r">${fmtUSD(totCr, 2)}</td>
                <td class="r">${fmtUSD(diff, 2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div class="panel-card" id="soaPanel">
        <div class="panel-head">
          <div class="panel-title"><span>AUDITED SOA DOUBLE-ENTRY JOURNAL STREAM (${fmtNum((m.soa_stream || []).length)} RECENT LEGS)</span></div>
          <span class="panel-meta">Balanced Debit &amp; Credit Postings ${exportBtn('soaPanel', 'SOA_Journal_Stream')}</span>
        </div>
        <div class="table-wrap">
          <table class="ledger-table">
            <thead>
              <tr>
                ${th('soa', 'Date', 'date')}${th('soa', 'Co.', 'company')}${th('soa', 'Voucher / Document', 'doc')}${th('soa', 'GL Code', 'code')}${th('soa', 'Account', 'account')}
                ${th('soa', 'Counterparty / Detail', 'detail')}${th('soa', 'Description', 'desc')}${th('soa', 'Debit ($)', 'debit', 'r')}${th('soa', 'Credit ($)', 'credit', 'r')}
              </tr>
            </thead>
            <tbody>
              ${sortRows((m.soa_stream || []).filter(r => !q || Object.values(r).join(' ').toLowerCase().includes(q)), 'soa', 'date', 'desc').map(r => `
                <tr>
                  <td class="mono">${esc(String(r.date || '').slice(0, 10))}</td>
                  <td><span class="badge badge-brass">${esc(r.company || 'WTC')}</span></td>
                  <td class="mono">${esc(r.doc || '—')}</td>
                  <td class="mono"><strong>${esc(r.code)}</strong></td>
                  <td><strong>${esc(r.account)}</strong></td>
                  <td>${esc(r.detail || '—')}</td>
                  <td>${esc(r.desc || '—')}</td>
                  <td class="r">${r.debit ? fmtUSD(r.debit, 2) : '—'}</td>
                  <td class="r">${r.credit ? fmtUSD(r.credit, 2) : '—'}</td>
                </tr>
              `).join('') || emptyRow(9, 'No SOA journal legs in this snapshot')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // VIEW 11: 22 PRINTABLE STATEMENTS HUB (A4 / PDF / CSV EXPORT)
  // ==========================================================================
  const STATEMENT_CATALOG = [
    { code: '01', name: 'Statement of Account (SOA)', cat: 'Financial' },
    { code: '02', name: 'Trial Balance (Lebanese CoA)', cat: 'Financial' },
    { code: '03', name: 'Income Statement (Profit & Loss)', cat: 'Financial' },
    { code: '04', name: 'Balance Sheet (Classes 1–5)', cat: 'Financial' },
    { code: '05', name: 'Cash Flow & Till Statement', cat: 'Financial' },
    { code: '06', name: 'Daily Operations Executive Digest', cat: 'Executive' },
    { code: '07', name: 'Sales & Deliveries Register (TTC)', cat: 'Operations' },
    { code: '08', name: 'Raw Material & Quarry Intake Register', cat: 'Operations' },
    { code: '09', name: 'Customer Sub-Account Statement (FIFO)', cat: 'Receivables' },
    { code: '10', name: 'Supplier & Hauler Sub-Account Statement', cat: 'Payables' },
    { code: '11', name: 'AR Aging Schedule (Current to 60+d)', cat: 'Receivables' },
    { code: '12', name: 'AP Open Legs Schedule (Mat / Haul / Exp)', cat: 'Payables' },
    { code: '13', name: 'Equipment Cost & Tonnage Profitability', cat: 'Fleet' },
    { code: '14', name: 'Diesel Tank & Fuel Consumption Ledger', cat: 'Fleet' },
    { code: '15', name: 'Driver Trips & Overtime Allowance Sheet', cat: 'Workforce' },
    { code: '16', name: 'Quarry & Customer Site Tonnage Summary', cat: 'Operations' },
    { code: '17', name: 'Active Price & Commission Agreements', cat: 'Commercial' },
    { code: '18', name: 'VAT 11% Output vs Input Declaration', cat: 'Tax & Compliance' },
    { code: '19', name: 'Staff Payroll & Monthly Disbursements', cat: 'Workforce' },
    { code: '20', name: 'Joint Venture (JV) Site Profit Split', cat: 'Commercial' },
    { code: '21', name: 'Treasury, Loans & Partner Current Acct', cat: 'Treasury' },
    { code: '22', name: 'Consolidated Group Board Pack', cat: 'Executive' }
  ];

  function stTable(cols, rows, foot) {
    return `<table class="ledger-table">
      <thead><tr>${cols.map(c => `<th class="${c.r ? 'r' : ''}">${c.label}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${cols.map(c => `<td class="${c.r ? 'r' : ''}${c.mono ? ' mono' : ''}">${c.fmt ? c.fmt(r[c.key], r) : esc(r[c.key] == null || r[c.key] === '' ? '—' : r[c.key])}</td>`).join('')}</tr>`).join('') || emptyRow(cols.length, 'No rows for this entity / period')}</tbody>
      ${foot ? `<tfoot><tr>${foot.map(f => `<td class="${f.r ? 'r' : ''}" ${f.span ? `colspan="${f.span}"` : ''}>${f.v}</td>`).join('')}</tr></tfoot>` : ''}
    </table>`;
  }
  const C = {
    usd0: v => fmtUSD(v, 0), usd2: v => fmtUSD(v, 2), num0: v => fmtNum(v, 0), num1: v => fmtNum(v, 1), num2: v => fmtNum(v, 2),
    date: v => esc(String(v || '').slice(0, 10) || '—')
  };

  function groupBy(rows, keyFn) {
    const map = new Map();
    rows.forEach(r => { const k = keyFn(r); if (!map.has(k)) map.set(k, []); map.get(k).push(r); });
    return map;
  }

  function renderStatementSheet(code) {
    const m = getModel();
    const k = getKPI();
    const st = STATEMENT_CATALOG.find(x => x.code === code) || STATEMENT_CATALOG[0];
    const sum = (rows, key) => rows.reduce((a, r) => a + Number(r[key] || 0), 0);
    let bodyHtml = '';

    if (code === '02') {
      const tb = m.gl_tb || [];
      bodyHtml = stTable([
        { label: 'Code', key: 'Code', mono: true }, { label: 'Account', key: 'Account' }, { label: 'Class', key: 'Class' },
        { label: 'Debit ($)', key: 'debit', r: true, fmt: C.usd2 }, { label: 'Credit ($)', key: 'credit', r: true, fmt: C.usd2 }, { label: 'Balance ($)', key: 'balance', r: true, fmt: v => `<strong>${fmtUSD(v, 2)}</strong>` }
      ], tb, [{ v: `TOTAL (${tb.length} ACCOUNTS)`, span: 3 }, { v: fmtUSD(sum(tb, 'debit'), 2), r: true }, { v: fmtUSD(sum(tb, 'credit'), 2), r: true }, { v: fmtUSD(sum(tb, 'debit') - sum(tb, 'credit'), 2), r: true }]);
    } else if (code === '03') {
      bodyHtml = `
        <table class="ledger-table">
          <thead><tr><th>Code</th><th>Income Statement Line (Lebanese CoA Class 7 &amp; Class 6)</th><th class="r">Amount (USD)</th><th class="r">% of Net Sales</th></tr></thead>
          <tbody>
            <tr><td class="mono">701/7085</td><td><strong>Gross Revenue incl. 11% VAT (Sales TTC)</strong></td><td class="r">${fmtUSD(k.sales_ttc, 2)}</td><td class="r">—</td></tr>
            <tr><td class="mono">4427</td><td>Less: Output VAT 11% Invoiced</td><td class="r">(${fmtUSD(k.sales_vat, 2)})</td><td class="r">—</td></tr>
            <tr><td class="mono">701</td><td><strong>Net Sales Revenue (Ex-VAT)</strong></td><td class="r"><strong>${fmtUSD(k.net_sales, 2)}</strong></td><td class="r">100.0%</td></tr>
            <tr><td class="mono">601</td><td>Raw Material Cost (Quarry Owners)</td><td class="r">(${fmtUSD(k.raw_mat_cost, 2)})</td><td class="r">${fmtPct((k.raw_mat_cost || 0) / (k.net_sales || 1))}</td></tr>
            <tr><td class="mono">611</td><td>Quarry Haulage Cost (Third-Party Trucks)</td><td class="r">(${fmtUSD(k.raw_haulage, 2)})</td><td class="r">${fmtPct((k.raw_haulage || 0) / (k.net_sales || 1))}</td></tr>
            <tr><td class="mono">GM</td><td><strong>GROSS MARGIN</strong></td><td class="r"><strong>${fmtUSD(k.gross_margin, 2)}</strong></td><td class="r"><strong>${fmtPct(k.gm_pct, k.gross_margin, k.net_sales)}</strong></td></tr>
            <tr><td class="mono">61/62</td><td>Plant &amp; Fleet Operating Expenses</td><td class="r">(${fmtUSD(k.expenses, 2)})</td><td class="r">${fmtPct((k.expenses || 0) / (k.net_sales || 1))}</td></tr>
            <tr><td class="mono">641</td><td>Staff Salaries &amp; Workforce Wages Paid</td><td class="r">(${fmtUSD(k.salaries_paid, 2)})</td><td class="r">${fmtPct((k.salaries_paid || 0) / (k.net_sales || 1))}</td></tr>
          </tbody>
          <tfoot>
            <tr><td colspan="2">OPERATING PROFIT (CASH VIEW)</td><td class="r">${fmtUSD(k.operating_profit, 2)}</td><td class="r">${fmtPct(k.op_margin_pct, k.operating_profit, k.net_sales)}</td></tr>
          </tfoot>
        </table>`;
    } else if (code === '04') {
      const tb = (m.gl_tb || []).filter(r => Number(r.Class) >= 1 && Number(r.Class) <= 5);
      const cls = n => tb.filter(r => Number(r.Class) === n);
      const names = { 1: 'Class 1 · Capital, Reserves & Long-Term Liabilities', 2: 'Class 2 · Fixed Assets', 3: 'Class 3 · Inventories', 4: 'Class 4 · Receivables, Payables & VAT', 5: 'Class 5 · Cash, Bank & Till' };
      bodyHtml = [1, 2, 3, 4, 5].map(n => `
        <h4>${names[n]}</h4>
        ${stTable([{ label: 'Code', key: 'Code', mono: true }, { label: 'Account', key: 'Account' }, { label: 'Debit ($)', key: 'debit', r: true, fmt: C.usd2 }, { label: 'Credit ($)', key: 'credit', r: true, fmt: C.usd2 }, { label: 'Net Balance ($)', key: 'balance', r: true, fmt: v => `<strong>${fmtUSD(v, 2)}</strong>` }],
          cls(n), [{ v: 'CLASS TOTAL', span: 2 }, { v: fmtUSD(sum(cls(n), 'debit'), 2), r: true }, { v: fmtUSD(sum(cls(n), 'credit'), 2), r: true }, { v: fmtUSD(sum(cls(n), 'balance'), 2), r: true }])}`).join('');
      const assets = sum(cls(2), 'balance') + sum(cls(3), 'balance') + sum(cls(5), 'balance') + Number(k.ar_balance || 0);
      bodyHtml += `<div class="live-calc" style="margin-top:16px"><div><small>Open AR (Class 4 asset)</small><b>${fmtUSD(k.ar_balance, 0)}</b></div><div><small>Open AP (Class 4 liability)</small><b>${fmtUSD(k.ap_balance, 0)}</b></div><div><small>Cash Till 5300</small><b>${fmtUSD(k.cash_till, 2)}</b></div><div><small>Classes 2+3+5 + AR</small><b>${fmtUSD(assets, 0)}</b></div></div>`;
    } else if (code === '05') {
      const months = (m.monthly || []).slice(-12).map(r => ({ ...r, net: Number(r.cash_in || 0) - Number(r.cash_out || 0) }));
      bodyHtml = stTable([
        { label: 'Month', key: 'Year Month' }, { label: 'Sales TTC', key: 'sales_ttc', r: true, fmt: C.usd0 }, { label: 'Cash In', key: 'cash_in', r: true, fmt: C.usd0 }, { label: 'Cash Out', key: 'cash_out', r: true, fmt: C.usd0 },
        { label: 'Net Cash Flow', key: 'net', r: true, fmt: v => `<strong style="color:${v < 0 ? 'var(--crit)' : 'var(--good)'}">${fmtUSD(v, 0)}</strong>` }, { label: 'Raw Cost', key: 'raw_cost', r: true, fmt: C.usd0 }, { label: 'Expenses', key: 'expenses', r: true, fmt: C.usd0 }, { label: 'Salaries', key: 'salaries', r: true, fmt: C.usd0 }
      ], months, [{ v: `PERIOD (${esc(k.label || 'All-Time')}) · TILL ${fmtUSD(k.cash_till, 2)}`, span: 2 }, { v: fmtUSD(k.cash_inflow, 0), r: true }, { v: fmtUSD(k.cash_outflow, 0), r: true }, { v: fmtUSD(k.net_cash_flow, 0), r: true }, { v: fmtUSD(k.raw_cost, 0), r: true }, { v: fmtUSD(k.expenses, 0), r: true }, { v: fmtUSD(k.salaries_paid, 0), r: true }]);
    } else if (code === '06') {
      const lines = [
        ['Sales TTC', fmtUSD(k.sales_ttc, 2), `${fmtNum(k.loads)} loads · ${fmtNum(k.tons_sold, 0)} t · avg ${fmtUSD(k.avg_price_ttc, 2)}/unit`],
        ['Cash vs Credit Sales', `${fmtUSD(k.cash_sales, 0)} / ${fmtUSD(k.credit_sales, 0)}`, `${fmtNum(k.delivery_loads)} delivery · ${fmtNum(k.pickup_loads)} pickup`],
        ['Raw Material Intake', fmtUSD(k.raw_cost, 2), `${fmtNum(k.raw_loads)} loads · ${fmtNum(k.raw_tons, 0)} t · material ${fmtUSD(k.raw_mat_cost, 0)} + haulage ${fmtUSD(k.raw_haulage, 0)}`],
        ['Expenses', fmtUSD(k.expenses, 2), `cash ${fmtUSD(k.cash_expenses, 0)} · credit ${fmtUSD(k.credit_expenses, 0)}`],
        ['Payroll', fmtUSD(k.salaries_paid, 2), `overtime bonus ${fmtUSD(k.overtime_bonus, 0)} · commission due ${fmtUSD(k.commission_due, 0)}`],
        ['Customer Receipts', fmtUSD(k.receipts, 2), `open AR ${fmtUSD(k.ar_balance, 2)} · overdue ${fmtUSD(k.ar_overdue, 0)} · DSO ${fmtNum(k.dso_days, 0)} d`],
        ['Supplier Settlements', fmtUSD(k.settlements_paid, 2), `open AP ${fmtUSD(k.ap_balance, 0)}`],
        ['Cash Till 5300', fmtUSD(k.cash_till, 2), `in ${fmtUSD(k.cash_inflow, 0)} · out ${fmtUSD(k.cash_outflow, 0)} · net ${fmtUSD(k.net_cash_flow, 0)}`],
        ['Diesel', `${fmtNum(k.diesel_litres, 0)} L issued`, `purchased ${fmtNum(k.diesel_purchased, 0)} L · sold ${fmtNum(k.diesel_sold, 0)} L · tank ${fmtNum(k.diesel_in_tank, 0)} L`],
        ['Fleet', `${fmtNum(k.active_equip)} units`, `${fmtNum(k.trucks_used)} trucks used · ${fmtNum(k.own_fleet_loads)} own-fleet loads · ${fmtUSD(k.cost_per_ton, 2)}/t`],
        ['Gross Margin / Operating Profit', `${fmtUSD(k.gross_margin, 0)} / ${fmtUSD(k.operating_profit, 0)}`, `${fmtPct(k.gm_pct, k.gross_margin, k.net_sales)} GM · ${fmtPct(k.op_margin_pct, k.operating_profit, k.net_sales)} op margin`],
        ['Trial Balance', fmtUSD(k.tb_check || 0, 2), Math.abs(Number(k.tb_check || 0)) < 0.005 ? 'tied' : 'VARIANCE — investigate']
      ].map(([a, b, c]) => ({ a, b, c }));
      bodyHtml = stTable([{ label: 'Measure', key: 'a' }, { label: 'Value', key: 'b', r: true, fmt: v => `<strong>${v}</strong>` }, { label: 'Detail', key: 'c' }], lines);
      const app = appEnteredSummary();
      if (app.length) bodyHtml += `<h4>App-entered this period (not yet in the figures above)</h4>${stTable([{ label: 'Register', key: 'label' }, { label: 'Rows', key: 'n', r: true }, { label: 'Amount', key: 'sum', r: true, fmt: (v, r) => r.unit === 'L' ? fmtNum(v, 0) + ' L' : fmtUSD(v, 2) }], app)}`;
    } else if (code === '07') {
      const rows = sortRows(filterRecords(SEED.records.sales_tickets, { ignoreSearch: true }), 'st07', 'date', 'desc');
      bodyHtml = stTable([
        { label: 'Date', key: 'date', mono: true }, { label: 'Ticket', key: 'ticket_no', mono: true }, { label: 'Co.', key: 'company' }, { label: 'Type', key: 'sale_type' }, { label: 'Customer', key: 'customer' }, { label: 'Product', key: 'product' }, { label: 'Site', key: 'site' }, { label: 'Truck', key: 'truck', mono: true },
        { label: 'Qty', key: 'qty', r: true, fmt: (v, r) => fmtNum(v, 2) + ' ' + esc(r.uom || '') }, { label: 'Material', key: 'price', r: true, fmt: C.usd2 }, { label: 'Transport', key: 'trans_price', r: true, fmt: C.usd2 }, { label: 'VAT', key: 'vat', r: true, fmt: C.usd2 }, { label: 'Total TTC', key: 'total_ttc', r: true, fmt: v => `<strong>${fmtUSD(v, 2)}</strong>` }, { label: 'Method', key: 'method' }
      ], rows, [{ v: `${fmtNum(rows.length)} TICKETS IN THE WEB SAMPLE · BOOK TOTAL ${fmtUSD(k.sales_ttc, 2)} / ${fmtNum(k.loads)} LOADS`, span: 8 }, { v: fmtNum(sum(rows, 'qty'), 0), r: true }, { v: fmtUSD(sum(rows, 'price'), 2), r: true }, { v: fmtUSD(sum(rows, 'trans_price'), 2), r: true }, { v: fmtUSD(sum(rows, 'vat'), 2), r: true }, { v: fmtUSD(sum(rows, 'total_ttc'), 2), r: true }, { v: '' }]);
    } else if (code === '08') {
      const rows = sortRows(filterRecords(SEED.records.raw_purchases, { ignoreSearch: true }), 'st08', 'date', 'desc');
      bodyHtml = stTable([
        { label: 'Date', key: 'date', mono: true }, { label: 'Ticket', key: 'ticket_no', mono: true }, { label: 'Co.', key: 'company' }, { label: 'Quarry Site', key: 'site' }, { label: 'Site Owner', key: 'site_owner' }, { label: 'Transport', key: 'transport_by' }, { label: 'Truck Owner', key: 'truck_owner' }, { label: 'Product', key: 'product' },
        { label: 'Qty', key: 'qty', r: true, fmt: (v, r) => fmtNum(v, 2) + ' ' + esc(r.uom || '') }, { label: 'Material', key: 'cost', r: true, fmt: C.usd2 }, { label: 'Haulage', key: 'trans_cost', r: true, fmt: C.usd2 }, { label: 'Total', key: 'total', r: true, fmt: v => `<strong>${fmtUSD(v, 2)}</strong>` }
      ], rows, [{ v: `${fmtNum(rows.length)} RECEIPTS IN THE WEB SAMPLE · BOOK TOTAL ${fmtUSD(k.raw_cost, 2)} / ${fmtNum(k.raw_loads)} LOADS`, span: 8 }, { v: fmtNum(sum(rows, 'qty'), 0), r: true }, { v: fmtUSD(sum(rows, 'cost'), 2), r: true }, { v: fmtUSD(sum(rows, 'trans_cost'), 2), r: true }, { v: fmtUSD(sum(rows, 'total'), 2), r: true }]);
    } else if (code === '09' || code === '11') {
      const rows = (m.customers || []);
      bodyHtml = stTable([
        { label: 'Customer', key: 'Customer', fmt: v => `<strong>${esc(v)}</strong>` }, { label: 'VAT Reg', key: 'VAT Registered' }, { label: 'Loads', key: 'loads', r: true, fmt: C.num0 }, { label: 'Sales TTC', key: 'sales_ttc', r: true, fmt: C.usd2 }, { label: 'Receipts', key: 'receipts', r: true, fmt: C.usd2 },
        { label: 'Current', key: 'ar_current', r: true, fmt: C.usd2 }, { label: 'Overdue', key: 'ar_overdue', r: true, fmt: C.usd2 }, { label: 'Overdue 60+', key: 'ar_60_plus', r: true, fmt: C.usd2 }, { label: 'VAT Receivable', key: 'vat_receivable', r: true, fmt: C.usd2 }, { label: 'Closing AR ($)', key: 'ar_balance', r: true, fmt: v => `<strong>${fmtUSD(v, 2)}</strong>` }, { label: 'Last Sale', key: 'last_sale', fmt: C.date }
      ], rows, [{ v: `${rows.length} CUSTOMERS · BOOK AR ${fmtUSD(k.ar_balance, 2)}`, span: 5 }, { v: fmtUSD(sum(rows, 'ar_current'), 2), r: true }, { v: fmtUSD(sum(rows, 'ar_overdue'), 2), r: true }, { v: fmtUSD(sum(rows, 'ar_60_plus'), 2), r: true }, { v: fmtUSD(sum(rows, 'vat_receivable'), 2), r: true }, { v: fmtUSD(sum(rows, 'ar_balance'), 2), r: true }, { v: '' }]);
    } else if (code === '10' || code === '12') {
      const rows = (m.suppliers || []);
      bodyHtml = stTable([
        { label: 'Supplier / Hauler', key: 'Supplier', fmt: v => `<strong>${esc(v)}</strong>` }, { label: 'IVA', key: 'IVA' }, { label: 'Raw Loads', key: 'raw_loads', r: true, fmt: C.num0 }, { label: 'Material Leg', key: 'ap_material', r: true, fmt: C.usd2 }, { label: 'Haulage Leg', key: 'ap_haulage', r: true, fmt: C.usd2 }, { label: 'Expense Leg', key: 'ap_expense', r: true, fmt: C.usd2 }, { label: 'Paid ($)', key: 'settlements_paid', r: true, fmt: C.usd2 }, { label: 'Closing AP ($)', key: 'ap_balance', r: true, fmt: v => `<strong>${fmtUSD(v, 2)}</strong>` }
      ], rows, [{ v: `${rows.length} SUPPLIERS · BOOK AP ${fmtUSD(k.ap_balance, 2)}`, span: 3 }, { v: fmtUSD(sum(rows, 'ap_material'), 2), r: true }, { v: fmtUSD(sum(rows, 'ap_haulage'), 2), r: true }, { v: fmtUSD(sum(rows, 'ap_expense'), 2), r: true }, { v: fmtUSD(sum(rows, 'settlements_paid'), 2), r: true }, { v: fmtUSD(sum(rows, 'ap_balance'), 2), r: true }]);
    } else if (code === '13') {
      const rows = (m.equipment || []);
      bodyHtml = stTable([
        { label: 'Equipment', key: 'Equipment', mono: true }, { label: 'Type', key: 'Type' }, { label: 'Ownership', key: 'Ownership' }, { label: 'Trips', key: 'trips', r: true, fmt: C.num0 }, { label: 'Diesel (L)', key: 'diesel_litres', r: true, fmt: C.num0 }, { label: 'Km Run', key: 'km_run', r: true, fmt: C.num0 },
        { label: 'Running ($)', key: 'running_cost', r: true, fmt: C.usd2 }, { label: 'Driver ($)', key: 'driver_cost', r: true, fmt: C.usd2 }, { label: 'Total Cost', key: 'total_cost', r: true, fmt: v => `<strong>${fmtUSD(v, 2)}</strong>` }, { label: '$/Ton', key: 'cost_per_ton', r: true, fmt: v => v ? fmtUSD(v, 2) : '—' }
      ], rows, [{ v: `${rows.length} UNITS · FLEET COST ${fmtUSD(k.total_equip_cost, 2)} · ${fmtUSD(k.cost_per_ton, 2)}/T`, span: 6 }, { v: fmtUSD(sum(rows, 'running_cost'), 2), r: true }, { v: fmtUSD(sum(rows, 'driver_cost'), 2), r: true }, { v: fmtUSD(sum(rows, 'total_cost'), 2), r: true }, { v: '' }]);
    } else if (code === '14') {
      const { fleet } = sentinelSlice();
      const rows = sortRows(filterRecords(SEED.records.fuel_intakes, { ignoreSearch: true }), 'st14', 'date', 'desc');
      bodyHtml = `<div class="live-calc"><div><small>Diesel purchased</small><b>${fmtNum(fleet.diesel_purchased_l != null ? fleet.diesel_purchased_l : k.diesel_purchased, 0)} L</b></div><div><small>Issued to fleet</small><b>${fmtNum(fleet.diesel_issued_l != null ? fleet.diesel_issued_l : k.diesel_litres, 0)} L</b></div><div><small>Sold on tickets</small><b>${fmtNum(k.diesel_sold, 0)} L</b></div><div><small>In tank</small><b>${fmtNum(fleet.diesel_stock_balance_l != null ? fleet.diesel_stock_balance_l : k.diesel_in_tank, 0)} L</b></div></div>
        <h4>Fuel &amp; lubricant intakes (web sample)</h4>` + stTable([
        { label: 'Date', key: 'date', mono: true }, { label: 'Ticket', key: 'ticket_no', mono: true }, { label: 'Co.', key: 'company' }, { label: 'Equipment', key: 'equipment', mono: true }, { label: 'Driver', key: 'driver' }, { label: 'Item', key: 'item' }, { label: 'Litres', key: 'litres', r: true, fmt: C.num1 }, { label: 'Odometer', key: 'odometer', r: true, fmt: v => v != null && v !== '' ? fmtNum(v, 0) : '—' }, { label: 'Hours', key: 'hours', r: true, fmt: v => v != null && v !== '' ? fmtNum(v, 1) : '—' }
      ], rows, [{ v: `${fmtNum(rows.length)} INTAKES`, span: 6 }, { v: fmtNum(sum(rows, 'litres'), 1) + ' L', r: true }, { v: '', span: 2 }]);
    } else if (code === '15') {
      const tickets = filterRecords(SEED.records.sales_tickets, { ignoreSearch: true }).concat(filterRecords(SEED.records.raw_purchases, { ignoreSearch: true }));
      const g = groupBy(tickets.filter(t => t.driver), t => t.driver);
      const rows = Array.from(g.entries()).map(([driver, list]) => ({
        driver, trips: list.length, fleet: list.filter(t => t.transport_by === 'Company fleet').length, overtime: list.filter(t => t.overtime).length,
        qty: sum(list, 'qty'), delivery: list.filter(t => t.sale_type === 'Delivery').length, trucks: uniqSorted(list.map(t => t.truck)).join(', ')
      })).sort((a, b) => b.trips - a.trips);
      const { fleet } = sentinelSlice();
      bodyHtml = `<div class="live-calc"><div><small>Sales overtime bonus (book)</small><b>${fmtUSD(fleet.sales_overtime_bonus_usd, 0)}</b></div><div><small>Raw overtime bonus (book)</small><b>${fmtUSD(fleet.raw_overtime_bonus_usd, 0)}</b></div><div><small>Overtime due (period)</small><b>${fmtUSD(k.overtime_bonus, 0)}</b></div><div><small>Driver payroll unallocated</small><b>${fmtUSD(fleet.unallocated_driver_payroll_usd, 0)}</b></div></div>
        <h4>Driver trips in the web sample (sales + raw)</h4>` + stTable([
        { label: 'Driver', key: 'driver', fmt: v => `<strong>${esc(v)}</strong>` }, { label: 'Trucks', key: 'trucks', mono: true }, { label: 'Trips', key: 'trips', r: true, fmt: C.num0 }, { label: 'Deliveries', key: 'delivery', r: true, fmt: C.num0 }, { label: 'Company-fleet trips', key: 'fleet', r: true, fmt: C.num0 }, { label: 'Overtime trips', key: 'overtime', r: true, fmt: v => v ? `<strong style="color:var(--warn)">${fmtNum(v)}</strong>` : '0' }, { label: 'Qty hauled', key: 'qty', r: true, fmt: C.num0 }
      ], rows, [{ v: `${rows.length} DRIVERS`, span: 2 }, { v: fmtNum(sum(rows, 'trips')), r: true }, { v: fmtNum(sum(rows, 'delivery')), r: true }, { v: fmtNum(sum(rows, 'fleet')), r: true }, { v: fmtNum(sum(rows, 'overtime')), r: true }, { v: fmtNum(sum(rows, 'qty'), 0), r: true }]);
    } else if (code === '16' || code === '20') {
      const rows = (m.sites || []).filter(s => code === '16' || s.JV === 'Yes').map(s => ({ ...s, Site: s.Site || '(no site on ticket)' }));
      bodyHtml = stTable([
        { label: 'Site', key: 'Site', fmt: v => `<strong>${esc(v)}</strong>` }, { label: 'JV', key: 'JV', fmt: v => v === 'Yes' ? '<span class="badge badge-brass">JV 50 / 50</span>' : '—' }, { label: 'Sales Loads', key: 'loads', r: true, fmt: C.num0 }, { label: 'Tons Sold', key: 'tons_sold', r: true, fmt: C.num0 }, { label: 'Sales TTC', key: 'sales_ttc', r: true, fmt: C.usd2 }, { label: 'Transport Rev', key: 'trans_rev', r: true, fmt: C.usd2 },
        { label: 'Raw Loads', key: 'raw_loads', r: true, fmt: C.num0 }, { label: 'Raw Tons', key: 'raw_tons', r: true, fmt: C.num0 }, { label: 'Raw Cost', key: 'raw_cost', r: true, fmt: C.usd2 }, ...(code === '20' ? [{ label: 'Partner 50% of Raw Cost', key: 'raw_cost', r: true, fmt: v => `<strong>${fmtUSD(Number(v || 0) / 2, 2)}</strong>` }] : [])
      ], rows, [{ v: `${rows.length} SITES`, span: 2 }, { v: fmtNum(sum(rows, 'loads')), r: true }, { v: fmtNum(sum(rows, 'tons_sold'), 0), r: true }, { v: fmtUSD(sum(rows, 'sales_ttc'), 2), r: true }, { v: fmtUSD(sum(rows, 'trans_rev'), 2), r: true }, { v: fmtNum(sum(rows, 'raw_loads')), r: true }, { v: fmtNum(sum(rows, 'raw_tons'), 0), r: true }, { v: fmtUSD(sum(rows, 'raw_cost'), 2), r: true }, ...(code === '20' ? [{ v: fmtUSD(sum(rows, 'raw_cost') / 2, 2), r: true }] : [])]);
      if (code === '20') bodyHtml += `<p class="form-note">JV entitlement = partner share × the JV site's raw material cost (Stock Entitlement rule, m114). Revenue-side entitlement is not derivable from tickets because the ticket Site is the delivery site — confirm with the accountant before reading this as a debt.</p>`;
    } else if (code === '17') {
      const today = SEED_DATE;
      const rows = sortRows(filterRecords(SEED.records.price_rules, { ignoreSearch: true, ignorePeriod: true }).filter(r => (!r.end_date || String(r.end_date) >= today) && (!r.start_date || String(r.start_date) <= today)), 'st17', 'customer', 'asc');
      bodyHtml = stTable([
        { label: 'Agreement', key: 'name', mono: true }, { label: 'Co.', key: 'company' }, { label: 'Customer / Owner', key: 'customer', fmt: (v, r) => `<strong>${esc(v || r.supplier || 'Standard List')}</strong>` }, { label: 'Product', key: 'product', fmt: v => esc(v || '(All Grades)') }, { label: 'Site', key: 'site' }, { label: 'Unit', key: 'unit', mono: true }, { label: 'Unit Price', key: 'unit_price', r: true, fmt: C.usd2 }, { label: 'Transport', key: 'trans_unit_price', r: true, fmt: v => v ? fmtUSD(v, 2) : '—' }, { label: 'Start', key: 'start_date', mono: true }, { label: 'End', key: 'end_date', mono: true, fmt: v => esc(v || 'Open') }
      ], rows, [{ v: `${fmtNum(rows.length)} ACTIVE AGREEMENTS AT ${today}`, span: 10 }]);
    } else if (code === '18') {
      const vatTickets = sortRows(filterRecords(SEED.records.sales_tickets, { ignoreSearch: true }).filter(t => Number(t.vat || 0) > 0 || t.vat_invoice), 'st18', 'date', 'desc');
      bodyHtml = `<div class="live-calc"><div><small>Output VAT 11% invoiced (4427)</small><b>${fmtUSD(k.sales_vat, 2)}</b></div><div><small>VAT receivable from customers</small><b>${fmtUSD(k.vat_receivable, 2)}</b></div><div><small>Net sales ex-VAT</small><b>${fmtUSD(k.net_sales, 2)}</b></div><div><small>Sales TTC</small><b>${fmtUSD(k.sales_ttc, 2)}</b></div></div>
        <h4>VAT-bearing tickets in the web sample</h4>` + stTable([
        { label: 'Date', key: 'date', mono: true }, { label: 'Ticket', key: 'ticket_no', mono: true }, { label: 'VAT Invoice', key: 'vat_invoice', mono: true }, { label: 'Co.', key: 'company' }, { label: 'Customer', key: 'customer' }, { label: 'Net', key: 'total', r: true, fmt: C.usd2 }, { label: 'VAT 11%', key: 'vat', r: true, fmt: v => `<strong>${fmtUSD(v, 2)}</strong>` }, { label: 'Total TTC', key: 'total_ttc', r: true, fmt: C.usd2 }
      ], vatTickets, [{ v: `${fmtNum(vatTickets.length)} TICKETS`, span: 5 }, { v: fmtUSD(sum(vatTickets, 'total'), 2), r: true }, { v: fmtUSD(sum(vatTickets, 'vat'), 2), r: true }, { v: fmtUSD(sum(vatTickets, 'total_ttc'), 2), r: true }]);
    } else if (code === '19') {
      const sal = filterRecords(SEED.records.salaries, { ignoreSearch: true });
      const g = groupBy(sal, s => s.staff + '|' + s.payroll_month);
      const rows = Array.from(g.entries()).map(([key, list]) => ({ staff: list[0].staff, month: list[0].payroll_month, company: list[0].company, payments: list.length, amount: sum(list, 'amount'), last: list.map(x => x.date).sort().pop() })).sort((a, b) => String(b.month).localeCompare(String(a.month)) || String(a.staff).localeCompare(String(b.staff)));
      bodyHtml = stTable([
        { label: 'Payroll Month', key: 'month', mono: true }, { label: 'Co.', key: 'company' }, { label: 'Staff Member', key: 'staff', fmt: v => `<strong>${esc(v)}</strong>` }, { label: 'Payments', key: 'payments', r: true, fmt: C.num0 }, { label: 'Last Paid', key: 'last', mono: true }, { label: 'Amount ($)', key: 'amount', r: true, fmt: v => `<strong>${fmtUSD(v, 2)}</strong>` }
      ], rows, [{ v: `${rows.length} STAFF-MONTHS · BOOK PAYROLL ${fmtUSD(k.salaries_paid, 2)}`, span: 3 }, { v: fmtNum(sum(rows, 'payments')), r: true }, { v: '' }, { v: fmtUSD(sum(rows, 'amount'), 2), r: true }]);
    } else if (code === '21') {
      const tb = (m.gl_tb || []).filter(r => [1, 5].includes(Number(r.Class)) || /^(16|17|45|455|53|51|512|5300)/.test(String(r.Code)));
      bodyHtml = stTable([
        { label: 'Code', key: 'Code', mono: true }, { label: 'Account', key: 'Account' }, { label: 'Class', key: 'Class' }, { label: 'Debit ($)', key: 'debit', r: true, fmt: C.usd2 }, { label: 'Credit ($)', key: 'credit', r: true, fmt: C.usd2 }, { label: 'Balance ($)', key: 'balance', r: true, fmt: v => `<strong>${fmtUSD(v, 2)}</strong>` }
      ], tb, [{ v: `TREASURY, LOANS & PARTNER ACCOUNTS · TILL ${fmtUSD(k.cash_till, 2)} · NET CASH FLOW ${fmtUSD(k.net_cash_flow, 2)}`, span: 3 }, { v: fmtUSD(sum(tb, 'debit'), 2), r: true }, { v: fmtUSD(sum(tb, 'credit'), 2), r: true }, { v: fmtUSD(sum(tb, 'balance'), 2), r: true }]);
    } else if (code === '22') {
      const ents = [['WTC', 'wtc'], ['BBConstruction', 'bbconstruction'], ['Lions Transport', 'lionstransport'], ['Group', 'manufacturing-group']];
      const kk = key => ((SEED.models[key] || {}).periods || {})[STATE.period] || {};
      const metric = (label, key, fmt) => ({ label, ...Object.fromEntries(ents.map(([n, kkey]) => [kkey, modelHasLedger(kkey) ? fmt(kk(kkey)[key]) : '—'])) });
      const rows = [
        metric('Sales TTC', 'sales_ttc', C.usd0), metric('Net Sales ex-VAT', 'net_sales', C.usd0), metric('Loads', 'loads', C.num0), metric('Tons Sold', 'tons_sold', C.num0), metric('Avg Price TTC', 'avg_price_ttc', C.usd2),
        metric('Raw Material Cost', 'raw_cost', C.usd0), metric('Gross Margin', 'gross_margin', C.usd0), metric('GM %', 'gm_pct', v => fmtPct(v)), metric('Expenses', 'expenses', C.usd0), metric('Payroll', 'salaries_paid', C.usd0),
        metric('Operating Profit', 'operating_profit', C.usd0), metric('Op Margin %', 'op_margin_pct', v => fmtPct(v)), metric('Open AR', 'ar_balance', C.usd0), metric('AR Overdue 60+', 'ar_60_plus', C.usd0), metric('DSO (days)', 'dso_days', C.num0),
        metric('Open AP', 'ap_balance', C.usd0), metric('Cash Till', 'cash_till', C.usd2), metric('Net Cash Flow', 'net_cash_flow', C.usd0), metric('Diesel in Tank (L)', 'diesel_in_tank', C.num0), metric('Active Fleet', 'active_equip', C.num0), metric('Cost / Ton', 'cost_per_ton', C.usd2), metric('TB Variance', 'tb_check', C.usd2)
      ];
      bodyHtml = stTable([{ label: 'Board Metric', key: 'label', fmt: v => `<strong>${esc(v)}</strong>` }, ...ents.map(([n, kkey]) => ({ label: n, key: kkey, r: true }))], rows);
    } else {
      const soa = sortRows(filterRecords(m.soa_stream || [], { ignoreSearch: true }), 'st01', 'date', 'desc');
      bodyHtml = stTable([
        { label: 'Date', key: 'date', mono: true, fmt: C.date }, { label: 'Co.', key: 'company' }, { label: 'Voucher', key: 'doc', mono: true }, { label: 'Code', key: 'code', mono: true }, { label: 'Account', key: 'account' }, { label: 'Counterparty', key: 'detail' }, { label: 'Description', key: 'desc' },
        { label: 'Debit ($)', key: 'debit', r: true, fmt: v => v ? fmtUSD(v, 2) : '—' }, { label: 'Credit ($)', key: 'credit', r: true, fmt: v => v ? fmtUSD(v, 2) : '—' }
      ], soa, [{ v: `LAST ${soa.length} AUDITED JOURNAL LEGS · TB VARIANCE ${fmtUSD(k.tb_check || 0, 2)}`, span: 7 }, { v: fmtUSD(sum(soa, 'debit'), 2), r: true }, { v: fmtUSD(sum(soa, 'credit'), 2), r: true }]);
    }

    return `
      <div class="a4-sheet" id="printableSheet">
        <div class="a4-header">
          <div>
            <div class="mono" style="font-size:10px;color:#B8883B;letter-spacing:0.14em;text-transform:uppercase">
              ISABI SYSTEMS · AUDITED FINANCIAL &amp; OPERATIONAL STATEMENT #${esc(st.code)} · ${esc(st.cat)}
            </div>
            <div class="a4-title">${esc(st.name)}</div>
            <div style="font-size:12px;color:#5A657D;margin-top:3px">
              Entity: <strong>${esc(COMPANY_LABELS[STATE.company])}</strong> · Period: <strong>${esc(k.label || 'All-Time')}</strong> · Basis: <strong>${STATE.basis === 'rep' ? 'Reporting Date' : 'Transaction Date'}</strong>
            </div>
          </div>
          <div style="text-align:right;font-family:var(--font-mono);font-size:11px;color:#2C364C">
            <div><strong>PRINTED:</strong> ${todayISO()} · ${esc(activeUser().full_name)}</div>
            <div><strong>CURRENCY:</strong> USD ($1 = 90,000 LBP)</div>
            <div><strong>TB VARIANCE:</strong> ${fmtUSD(k.tb_check || 0, 2)}</div>
          </div>
        </div>
        ${bodyHtml}
      </div>
    `;
  }

  function renderStatements() {
    const st = STATEMENT_CATALOG.find(x => x.code === STATE.activeStatement) || STATEMENT_CATALOG[0];
    return `
      <div class="cockpit-banner no-print">
        <div class="cockpit-title-block">
          <div class="cockpit-eyebrow">REPLACES 22 PAGINATED POWER BI RDL REPORTS · ZERO PPU LICENSES</div>
          <div class="cockpit-title">22 Printable A4 Statements &amp; Exports</div>
          <div class="cockpit-sub">Every statement follows the entity, period and date basis selected above. Print to A4 PDF or download the sheet as CSV / Excel.</div>
        </div>
        <div class="stmt-banner-actions">
          <select id="stmtQuickSelect" class="pill-select stmt-quick-select" aria-label="Select Statement">
            ${STATEMENT_CATALOG.map(s => `<option value="${s.code}" ${STATE.activeStatement === s.code ? 'selected' : ''}>RDL-${s.code} · ${esc(s.name)}</option>`).join('')}
          </select>
          <button class="btn btn-brass" id="printStmtBtn">🖨 Print / Save A4 PDF</button>
          <button class="btn btn-outline-bar" id="exportCsvBtn">⬇ Export CSV (Excel)</button>
        </div>
      </div>

      <div class="stmt-catalog-grid no-print">
        ${STATEMENT_CATALOG.map(s => `
          <div class="stmt-card ${STATE.activeStatement === s.code ? 'active' : ''}" data-stmt="${s.code}" role="button" tabindex="0">
            <div>
              <div class="stmt-code">RDL-${s.code} · ${esc(s.cat)}</div>
              <div class="stmt-name">${esc(s.name)}</div>
            </div>
            <span class="mono" style="font-size:11px;color:var(--text-muted)">A4 →</span>
          </div>
        `).join('')}
      </div>

      ${renderStatementSheet(st.code)}
    `;
  }

  // ==========================================================================
  // VIEW 12: USERS, ROLES & MULTI-DEVICE CLOUD AUTH ($0/SEAT LICENSE MANAGER)
  // ==========================================================================
  function renderUsers() {
    const uCount = STATE.users.length;
    const annualSaved = uCount * 37 * 12;
    const me = activeUser();
    const owner = isOwner(me);
    const sbConfigured = !!(STATE.supabaseCfg.url && STATE.supabaseCfg.anonKey);

    return `
      <div class="cockpit-banner">
        <div class="cockpit-title-block">
          <div class="cockpit-eyebrow">MULTI-DEVICE TEAM AUTHENTICATION · BUSINESS-UNIT ROW-LEVEL SECURITY (RLS)</div>
          <div class="cockpit-title">Users, Roles &amp; Multi-Device Cloud Sync</div>
          <div class="cockpit-sub">Issue PINs and 1-click WhatsApp/Email login links for phones, tablets &amp; laptops. Seats, PINs and app entries sync through the BHFIRMS cloud relay.</div>
        </div>
        <div class="cockpit-pills">
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Active Web Seats</div><div class="cockpit-pill-val brass">${uCount} Users</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Cloud Relay Status</div><div class="cockpit-pill-val ${/Live/.test(STATE.cloudStatus) ? 'emerald' : 'amber'}">${esc(STATE.cloudStatus)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Last Cloud Write</div><div class="cockpit-pill-val" style="font-size:13px">${esc(String(STATE.cloudUpdatedAt || '—').replace('T', ' ').slice(0, 16))}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Annual License Savings</div><div class="cockpit-pill-val emerald">${fmtUSD(annualSaved, 0)} / yr</div></div>
        </div>
      </div>

      ${STATE.showAddUserForm && owner ? `
        <div class="panel-card" style="margin-bottom:16px;border-color:var(--brass)">
          <div class="panel-head">
            <div class="panel-title"><span>CREATE OR UPDATE MULTI-DEVICE TEAM LOGIN SEAT</span></div>
            <button class="btn" id="cancelAddUserBtn" style="padding:3px 9px;font-size:11px">✕ Close</button>
          </div>
          <div style="padding:14px 16px 4px">
          <div class="form-grid-3">
            <div class="form-field">
              <label>Full Name *</label>
              <input type="text" id="nu_name" placeholder="e.g. Ali Mansour (WTC Scale)" autocomplete="off">
            </div>
            <div class="form-field">
              <label>Email Address (Login ID) *</label>
              <input type="email" id="nu_email" placeholder="ali.mansour@bhfirms.com" autocomplete="off">
              <span class="hint">An existing email updates that seat instead of creating a new one.</span>
            </div>
            <div class="form-field">
              <label>Access PIN (4–8 Digits) *</label>
              <input type="text" inputmode="numeric" pattern="[0-9]{4,8}" id="nu_pin" value="${Math.floor(1000 + Math.random() * 8999)}" class="mono" autocomplete="off">
            </div>
            <div class="form-field">
              <label>Role &amp; Permissions *</label>
              <select id="nu_role">
                <option value="Entry">Entry (Tickets, Fuel, Expenses &amp; Receipts)</option>
                <option value="Supervisor + Entry">Supervisor + Entry (All Ops + Entry)</option>
                <option value="Supervisor">Supervisor (Read-Only Oversight)</option>
                <option value="Sales">Sales &amp; AR Collector (Receipts only)</option>
                <option value="Full Access (Owner)">Full Access (Owner)</option>
              </select>
            </div>
            <div class="form-field">
              <label>Assigned Companies (Row-Level Security) *</label>
              <select id="nu_companies">
                <option value="WTC">WTC Only</option>
                <option value="BBConstruction">BBConstruction Only</option>
                <option value="Lions Transport">Lions Transport Only</option>
                <option value="WTC, BBConstruction">WTC + BBConstruction</option>
                <option value="Lions Transport, WTC">Lions Transport + WTC</option>
                <option value="WTC, BBConstruction, Lions Transport">All 3 Companies (Full Group)</option>
              </select>
            </div>
            <div class="form-field">
              <label>Executive Dashboards &amp; Statements</label>
              <select id="nu_access">
                <option value="partial|partial">Operational KPIs + Statements</option>
                <option value="full|full">Full Executive PBI + All 22 Statements</option>
                <option value="none|none">Weighbridge / Desk Only (No Financials)</option>
              </select>
            </div>
          </div>
          <div id="nuErrors" class="form-errors" hidden></div>
          <div style="display:flex;justify-content:flex-end;gap:8px;padding:12px 0">
            <button class="btn btn-primary" id="saveNewUserBtn">✓ Save Seat &amp; Sync Across All Devices</button>
          </div>
          </div>
        </div>
      ` : ''}

      <div class="split-grid-2">
        <div class="panel-card">
          <div class="panel-head">
            <div class="panel-title"><span>TEAM LOGIN DIRECTORY &amp; ROW-LEVEL SECURITY (RLS) SCOPES</span></div>
            <div style="display:flex;gap:6px">
              <button class="btn" style="padding:4px 10px;font-size:11px" id="syncCloudNowBtn">↻ Sync Cloud Now</button>
              ${owner ? `<button class="btn btn-primary" style="padding:4px 10px;font-size:11px" id="addWebUserBtn">+ New Team Login</button>` : ''}
            </div>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  <th>User Name</th>
                  <th>Login Email</th>
                  ${owner ? '<th>PIN</th>' : ''}
                  <th>Role</th>
                  <th>Allowed Companies (RLS)</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  ${owner ? '<th>Owner Actions</th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${STATE.users.map((u, idx) => `
                  <tr>
                    <td><strong>${esc(u.full_name)}</strong>${idx === STATE.activeUserIdx ? ' <span class="badge badge-ok">you</span>' : ''}</td>
                    <td class="mono">${esc(u.email)}</td>
                    ${owner ? `<td class="mono"><span class="badge badge-info">${esc(u.pin_code || '1111')}</span></td>` : ''}
                    <td><span class="badge badge-brass">${esc(u.role)}</span></td>
                    <td><strong>${esc(u.companies)}</strong></td>
                    <td><span class="badge ${u.status === 'Suspended' ? 'badge-err' : 'badge-ok'}">${esc(u.status || 'Active')}</span></td>
                    <td class="mono" style="font-size:10.5px">${esc(u.last_login_at || 'Never')}</td>
                    ${owner ? `<td style="white-space:nowrap">
                      <button class="btn" style="padding:3px 7px;font-size:10.5px" data-sim-user="${idx}" title="Open the app as this seat to check their RLS scope">${STATE.activeUserIdx === idx ? '● Active' : 'Impersonate'}</button>
                      <button class="btn" style="padding:3px 7px;font-size:10.5px" data-invite-user="${idx}" title="Copy a 1-click login link for WhatsApp / Email (carries the PIN — share privately)">🔗 Invite Link</button>
                      <button class="btn" style="padding:3px 7px;font-size:10.5px" data-toggle-user="${idx}" title="${u.status === 'Suspended' ? 'Re-activate this seat' : 'Suspend this seat (cannot sign in)'}">${u.status === 'Suspended' ? 'Activate' : 'Suspend'}</button>
                    </td>` : ''}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="panel-card">
            <div class="panel-head">
              <div class="panel-title"><span>LIVE MULTI-DEVICE SESSION AUDIT LOG</span></div>
              <span class="badge ${/Live/.test(STATE.cloudStatus) ? 'badge-ok' : 'badge-warn'}">${/Live/.test(STATE.cloudStatus) ? 'CLOUD SYNCED' : 'LOCAL ONLY'}</span>
            </div>
            <div class="table-wrap">
              <table class="ledger-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Team Member</th>
                    <th>Role / Scope</th>
                    <th>Device</th>
                  </tr>
                </thead>
                <tbody>
                  ${(STATE.sessions || []).slice(0, 10).map(s => `
                    <tr>
                      <td class="mono" style="font-size:10.5px">${esc(s.logged_in_at)}</td>
                      <td><strong>${esc(s.full_name)}</strong></td>
                      <td><span class="badge badge-brass">${esc(s.companies)}</span></td>
                      <td class="mono" style="font-size:10.5px">${esc(s.device)}</td>
                    </tr>
                  `).join('') || emptyRow(4, 'No sign-ins recorded yet')}
                </tbody>
              </table>
            </div>
          </div>

          <div class="panel-card">
            <div class="panel-head">
              <div class="panel-title"><span>CLOUD DATABASE BACKENDS (DUAL-DRIVER)</span></div>
              <span class="badge badge-ok">ACTIVE</span>
            </div>
            <div style="font-size:12px;display:flex;flex-direction:column;gap:8px">
              <div class="sentinel-item ${/Live/.test(STATE.cloudStatus) ? 'ok' : 'warn'}">
                <div>
                  <div class="sentinel-title">Driver 1: BHFIRMS Multi-Device Cloud Relay + Local SQLite</div>
                  <div class="sentinel-detail">Active across phones, tablets &amp; laptops at <code class="mono">husseinbdeir.github.io/mfg-web</code>; on the LAN host <code class="mono">server.py</code> also writes every entry into <code class="mono">data/mfg.db</code>. Syncs seats, PINs, sessions and app entries with 0 licenses.</div>
                </div>
                <span class="badge ${/Live/.test(STATE.cloudStatus) ? 'badge-ok' : 'badge-warn'}">${/Live/.test(STATE.cloudStatus) ? 'CONNECTED' : esc(STATE.cloudStatus.replace('● ', '').toUpperCase())}</span>
              </div>
              <div class="sentinel-item ${sbConfigured ? 'ok' : ''}">
                <div style="width:100%">
                  <div class="sentinel-title">Driver 2: Dedicated Supabase / PostgreSQL Cloud (Optional)</div>
                  <div class="sentinel-detail" style="margin-bottom:6px">Run <code class="mono">data/schema_postgres.sql</code> in a Supabase project and paste the URL &amp; anon key. The keys are kept on this device only; the Postgres writer ships in a later build.</div>
                  ${owner ? `<div style="display:flex;gap:6px;flex-wrap:wrap">
                    <input type="url" id="sb_url" class="search-input" style="min-width:170px;flex:1;padding:4px 8px;font-size:11px" value="${esc(STATE.supabaseCfg.url)}" placeholder="https://xyz.supabase.co">
                    <input type="text" id="sb_key" class="search-input" style="min-width:140px;flex:1;padding:4px 8px;font-size:11px" value="${esc(STATE.supabaseCfg.anonKey)}" placeholder="Supabase anon key...">
                    <button class="btn" id="saveSbCfgBtn" style="padding:4px 9px;font-size:11px">Save</button>
                  </div>` : ''}
                </div>
                <span class="badge ${sbConfigured ? 'badge-ok' : ''}">${sbConfigured ? 'KEYS SAVED' : 'NOT CONFIGURED'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // SMART ENTRY DESK — SIX FORMS WITH THE DATAVERSE FORM RULES
  // ==========================================================================
  const FORM_TITLES = Object.assign({
    sales: 'New Sales Ticket (Price Agreement · VAT · Overtime · Duplicate Guards)',
    raw: 'New Raw Material Quarry Receipt (2-Leg AP Split)',
    receipt: 'New Customer Receipt (FIFO Auto-Allocated)',
    fuel: 'New Diesel / Lubricant Intake (M142 Meter Guard)',
    expense: 'New Expense (Cash Till or Supplier Credit)',
    settlement: 'New Supplier / Hauler Settlement (Oldest Leg First)'
  }, (window.MFG_FORMS && window.MFG_FORMS.FORM_TITLES) || {});
  const FORM_CR_KEY = Object.assign({
    sales: 'sales_tickets', raw: 'raw_purchases', receipt: 'receipts',
    fuel: 'fuel_intakes', expense: 'expenses', settlement: 'settlements'
  }, (window.MFG_FORMS && window.MFG_FORMS.FORM_CR_KEY) || {});

  function fld(label, inner, opts = {}) {
    return `<div class="form-field${opts.span ? ' span-3' : ''}${opts.cls ? ' ' + opts.cls : ''}"${opts.id ? ` id="${opts.id}"` : ''}${opts.hidden ? ' hidden' : ''}><label>${label}</label>${inner}${opts.hint != null ? `<span class="hint"${opts.hintId ? ` id="${opts.hintId}"` : ''}>${opts.hint}</span>` : ''}</div>`;
  }
  function inp(id, type, value, attrs = '') {
    return `<input type="${type}" id="${id}" value="${esc(value == null ? '' : value)}" autocomplete="off" ${attrs}>`;
  }
  function sel(id, options, value, attrs = '') {
    return `<select id="${id}" ${attrs}>${options.map(o => {
      const [v, l] = Array.isArray(o) ? o : [o, o];
      return `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`;
    }).join('')}</select>`;
  }
  function dl(id, values) {
    return `<datalist id="${id}">${values.map(v => `<option value="${esc(v)}">`).join('')}</datalist>`;
  }
  function nowHHMM() {
    const d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function renderEntryModalBody() {
    const fType = STATE.modalForm;
    const comps = allowedCompanyNames();
    const company = defaultEntryCompany();
    const today = todayISO();
    const dateAttrs = `min="${MIN_DATE}" max="${today}" required`;
    const companyField = fld('Company (BU) *', sel('f_company', comps, company), { hint: comps.length === 1 ? 'Your seat is scoped to this entity' : '' });
    const dateField = fld('Transaction Date *', inp('f_date', 'date', today, dateAttrs), { hintId: 'hint_date', hint: '' });
    const notesField = fld('Notes', inp('f_notes', 'text', '', 'placeholder="Required for back-dated entries or discounts above 20%"'), { span: true });
    const cockpitHtml = window.MFG_FORMS ? window.MFG_FORMS.renderExecutiveCockpit({ SEED, STATE }, company) : '';
    const truckQvHtml = window.MFG_FORMS ? `<div id="paTruckQvWrap">${window.MFG_FORMS.renderTruckQuickView(null, true)}</div>` : '';

    if (window.MFG_FORMS && !['sales', 'raw', 'receipt', 'fuel', 'expense', 'settlement'].includes(fType)) {
      return cockpitHtml + window.MFG_FORMS.renderExtendedFormBody(fType, { SEED, STATE }, {
        allowedCompanyNames, defaultEntryCompany, customerNames, supplierNames, siteNames, equipmentNames, driverNames
      });
    }

    if (fType === 'sales') {
      const prods = productList(true);
      return cockpitHtml + `
        <div class="rule-banner" id="smartRuleBanner">
          <strong>Smart Agreement Engine:</strong> Company, Customer, Product &amp; Site pick the active Price Agreement (unit + transport price + Tier 1/2 truck size); the product sets the unit of measure; VAT-registered customers get 11% VAT; Pickup zeroes transport; a company-fleet load outside 06:00–17:59 flags overtime; a repeated ticket number in the same BU is blocked unless you confirm it.
        </div>
        ${truckQvHtml}
        <div class="form-grid-3">
          ${companyField}
          ${fld('Ticket Number *', inp('f_ticketno', 'text', nextTicketNo(company, [SEED.records.sales_tickets]), 'inputmode="numeric" placeholder="Pad number"'), { hintId: 'hint_ticket', hint: 'Next free number suggested' })}
          ${dateField}
          ${fld('Dispatch Time (Overtime Check)', inp('f_time', 'time', nowHHMM()), { hintId: 'hint_time', hint: 'Day shift 06:00–17:59' })}
          ${fld('Sale Type (Rule #1) *', sel('f_saletype', [['Delivery', 'Delivery (Material + Transport)'], ['Pickup', 'Pickup (Ex-Quarry / Plant)']], 'Delivery'))}
          ${fld('Transported By (Rule #4) *', sel('f_transportby', [['Company fleet', 'Company fleet (Own Truck)'], ['Third-party truck', 'Third-party truck (Hauler)'], ['Customer truck', 'Customer truck (Pickup)']], 'Company fleet'))}
          ${fld('Customer *', inp('f_customer', 'text', '', 'list="dl_customers" placeholder="Select or type customer..."') + dl('dl_customers', customerNames()), { hintId: 'hint_customer', hint: '' })}
          ${fld('Product / Aggregate Grade *', sel('f_product', [['', '— pick a grade —']].concat(prods.map(p => [p.name, `${p.name} (${p.uom}${Number(p.ton_factor) && Number(p.ton_factor) !== 1 ? ' · ×' + p.ton_factor + ' t' : ''})`])), ''), { hintId: 'hint_product', hint: '' })}
          ${fld('Destination Site', inp('f_site', 'text', '', 'list="dl_sites" placeholder="Site..."') + dl('dl_sites', siteNames()), { hintId: 'hint_site', hint: 'Required on Delivery' })}
          ${fld('Truck / Equipment', inp('f_truck', 'text', '', 'list="dl_equip" placeholder="Truck plate..."') + dl('dl_equip', equipmentNames()), { hintId: 'hint_truck', hint: 'Required on Delivery' })}
          ${fld('Driver', inp('f_driver', 'text', '', 'list="dl_drivers" placeholder="Driver..."') + dl('dl_drivers', driverNames()), { hint: 'Required on Delivery' })}
          ${fld('Quantity (<span id="lbl_uom">m³</span>) *', inp('f_qty', 'number', '', 'step="0.01" min="0.01" inputmode="decimal"'), { hintId: 'hint_qty', hint: '' })}
          ${fld('Unit Price ($) <span class="badge badge-brass" id="lbl_pricelock">—</span>', inp('f_unitprice', 'number', '', 'step="0.01" min="0" inputmode="decimal"'), { hintId: 'hint_price', hint: '' })}
          ${fld('Transport Unit Price ($)', inp('f_transunitprice', 'number', '0.00', 'step="0.01" min="0" inputmode="decimal"'), { hintId: 'hint_trans', hint: '' })}
          ${fld('Discount ($)', inp('f_discount', 'number', '0.00', 'step="0.01" min="0" inputmode="decimal"'), { hintId: 'hint_disc', hint: '' })}
          ${fld('Payment Method *', sel('f_method', [['Credit', 'Credit (Posts to 4111 AR)'], ['Cash', 'Cash (Posts to 5300 Till)']], 'Credit'))}
          ${fld('VAT Invoice No.', inp('f_vatinvoice', 'text', '', 'placeholder="Invoice serial"'), { id: 'wrap_vatinvoice', hidden: true, hint: '11% VAT applies to this customer' })}
          <div class="form-field check-field"><input type="checkbox" id="f_overtime"><label for="f_overtime">Overtime load (company fleet outside day shift)</label></div>
          <div class="form-field check-field" id="wrap_dupok" hidden><input type="checkbox" id="f_dupok"><label for="f_dupok">Post anyway — duplicate ticket number confirmed</label></div>
          ${notesField}
        </div>
        <div class="live-calc">
          <div><small>Material</small><b id="calc_mat">$0.00</b></div>
          <div><small>Transport</small><b id="calc_tr">$0.00</b></div>
          <div><small>VAT 11%</small><b id="calc_vat">—</b></div>
          <div><small>Total TTC</small><b id="calc_total">$0.00</b></div>
        </div>
      `;
    }

    if (fType === 'raw') {
      return cockpitHtml + `
        <div class="rule-banner" id="smartRuleBanner">
          <strong>Two-Payable Raw Intake Rule (m192):</strong> Material cost is owed to the <strong>Quarry Site Owner</strong>; haulage is owed to the <strong>Truck Owner</strong> and is $0 when a company-fleet truck hauls it. A Purchase Price (Site) agreement for the owner / site fills the unit cost.
        </div>
        ${truckQvHtml}
        <div class="form-grid-3">
          ${companyField}
          ${fld('Ticket # *', inp('f_ticketno', 'text', nextTicketNo(company, [SEED.records.raw_purchases]), 'inputmode="numeric"'), { hintId: 'hint_ticket', hint: 'Next free number suggested' })}
          ${dateField}
          ${fld('Quarry Site *', inp('f_site', 'text', '', 'list="dl_sites"') + dl('dl_sites', siteNames()))}
          ${fld('Quarry Site Owner (Material Payee)', inp('f_siteowner', 'text', '', 'list="dl_suppliers"') + dl('dl_suppliers', supplierNames()), { hintId: 'hint_owner', hint: 'Required when the material has a cost' })}
          ${fld('Raw Material *', inp('f_product', 'text', '', 'list="dl_products"') + dl('dl_products', uniqSorted(SEED.records.raw_purchases.map(r => r.product).concat(SEED.records.products.map(p => p.name)))), { hintId: 'hint_product', hint: '' })}
          ${fld('Transported By *', sel('f_transportby', [['Third-party truck', 'Third-party truck (Hauler paid)'], ['Company fleet', 'Company fleet (Haulage $0)']], 'Third-party truck'))}
          ${fld('Truck Owner (Haulage Payee)', inp('f_truckowner', 'text', '', 'list="dl_suppliers"'), { hintId: 'hint_truckowner', hint: 'Required for third-party haulage' })}
          ${fld('Truck Plate', inp('f_truck', 'text', '', 'list="dl_equip"') + dl('dl_equip', equipmentNames()))}
          ${fld('Driver', inp('f_driver', 'text', '', 'list="dl_drivers"') + dl('dl_drivers', driverNames()))}
          ${fld('Dispatch Time', inp('f_time', 'time', nowHHMM()), { hintId: 'hint_time', hint: 'Day shift 06:00–17:59' })}
          ${fld('Quantity (<span id="lbl_uom">m³</span>) *', inp('f_qty', 'number', '', 'step="0.01" min="0.01" inputmode="decimal"'))}
          ${fld('Material Unit Cost ($) <span class="badge badge-brass" id="lbl_pricelock">—</span>', inp('f_unitprice', 'number', '', 'step="0.01" min="0" inputmode="decimal"'), { hintId: 'hint_price', hint: '' })}
          ${fld('Haulage Unit Cost ($)', inp('f_transunitprice', 'number', '0.00', 'step="0.01" min="0" inputmode="decimal"'), { hintId: 'hint_trans', hint: '' })}
          ${fld('Payment Method *', sel('f_method', [['Credit', 'Credit (owed to payees)'], ['Cash', 'Cash (paid from till)']], 'Credit'))}
          <div class="form-field check-field"><input type="checkbox" id="f_overtime"><label for="f_overtime">Overtime load (company fleet outside day shift)</label></div>
          <div class="form-field check-field" id="wrap_dupok" hidden><input type="checkbox" id="f_dupok"><label for="f_dupok">Post anyway — duplicate ticket number confirmed</label></div>
          ${notesField}
        </div>
        <div class="live-calc">
          <div><small>Material leg → site owner</small><b id="calc_mat">$0.00</b></div>
          <div><small>Haulage leg → truck owner</small><b id="calc_tr">$0.00</b></div>
          <div><small>Quantity</small><b id="calc_qty">0</b></div>
          <div><small>Total payable</small><b id="calc_total">$0.00</b></div>
        </div>
      `;
    }

    if (fType === 'receipt') {
      return cockpitHtml + `
        <div class="rule-banner" id="smartRuleBanner">
          <strong>FIFO Auto-Allocation (step240 + m165):</strong> the receipt settles the customer's oldest open credit tickets first. VAT-registered customers carry 11% inside their balance; a <strong>VAT</strong> method receipt settles only the VAT leg.
        </div>
        <div class="form-grid-3">
          ${companyField}
          ${dateField.replace('Transaction Date', 'Receipt Date')}
          ${fld('Customer *', inp('f_customer', 'text', '', 'list="dl_customers"') + dl('dl_customers', customerNames()), { hintId: 'hint_customer', hint: '' })}
          ${fld('Payment Method *', sel('f_method', [['Payment', 'Payment (Dr 5300 Till / 5121 Bank)'], ['Barter', 'Barter (goods / services)'], ['VAT', 'VAT 11% receipt'], ['Rent', 'Rent offset'], ['VATRent', 'VAT on rent']], 'Payment'))}
          ${fld('Amount Received ($) *', inp('f_amount', 'number', '', 'step="0.01" min="0.01" inputmode="decimal"'), { hintId: 'hint_amount', hint: '' })}
          ${fld('Settlement Discount ($)', inp('f_discount', 'number', '0.00', 'step="0.01" min="0" inputmode="decimal"'), { hintId: 'hint_disc', hint: 'Written off against the oldest ticket' })}
          ${fld('Reference', inp('f_reference', 'text', '', 'placeholder="Cheque / transfer / receipt no."'))}
          ${notesField}
        </div>
        <div id="paCustSubgridWrap"></div>
        <div class="live-calc">
          <div><small>Open AR before</small><b id="calc_before">—</b></div>
          <div><small>Receipt + discount</small><b id="calc_total">$0.00</b></div>
          <div><small>Open AR after</small><b id="calc_after">—</b></div>
          <div><small>Allocation</small><b id="calc_alloc">FIFO oldest first</b></div>
        </div>
      `;
    }

    if (fType === 'fuel') {
      return cockpitHtml + `
        <div class="rule-banner" id="smartRuleBanner">
          <strong>M142 Fuel &amp; Meter Guard:</strong> the reading is checked against the unit's previous intake — a backwards reading, a jump over 5,000 km / 500 h, zero or an impossible value is refused. BBConstruction diesel intakes are refused while its tank reconciliation is negative (m212).
        </div>
        <div class="form-grid-3">
          ${companyField}
          ${fld('Ticket #', inp('f_ticketno', 'text', nextTicketNo(company, [SEED.records.fuel_intakes]), 'inputmode="numeric"'), { hintId: 'hint_ticket', hint: 'Next free number suggested' })}
          ${dateField}
          ${fld('Equipment / Truck *', inp('f_truck', 'text', '', 'list="dl_equip"') + dl('dl_equip', equipmentNames()), { hintId: 'hint_truck', hint: '' })}
          ${fld('Driver', inp('f_driver', 'text', '', 'list="dl_drivers"') + dl('dl_drivers', driverNames()))}
          ${fld('Item *', sel('f_item', [['Diesel', 'Diesel'], ['Oil 15W40', 'Oil 15W40'], ['Oil 68', 'Oil 68'], ['Hydraulic Oil', 'Hydraulic Oil'], ['Grease', 'Grease'], ['Other lubricant', 'Other lubricant']], 'Diesel'))}
          ${fld('Litres Issued (L) *', inp('f_qty', 'number', '', 'step="0.1" min="0.1" inputmode="decimal"'), { hintId: 'hint_qty', hint: '' })}
          ${fld('Meter Type', sel('f_metertype', [['odometer', 'Odometer (km)'], ['hours', 'Hour meter (h)'], ['none', 'No meter']], 'odometer'))}
          ${fld('Meter Reading', inp('f_meter', 'number', '', 'step="1" min="0" inputmode="numeric"'), { hintId: 'hint_meter', hint: '' })}
          ${fld('Tank / Location', inp('f_location', 'text', 'Main Plant Tank'))}
          ${notesField}
        </div>
        <div class="live-calc">
          <div><small>Previous reading</small><b id="calc_prev">—</b></div>
          <div><small>Distance / hours since</small><b id="calc_delta">—</b></div>
          <div><small>Consumption</small><b id="calc_rate">—</b></div>
          <div><small>Guard</small><b id="calc_total">—</b></div>
        </div>
      `;
    }

    if (fType === 'expense') {
      const cats = expenseCategories();
      return cockpitHtml + `
        <div class="rule-banner" id="smartRuleBanner">
          <strong>Expense posting:</strong> Cash expenses credit the till (5300); Credit expenses open a Supplies &amp; Services leg (Class 4) owed to the supplier until a settlement relieves it. Tie plant and fleet costs to the equipment so the unit economics pick them up.
        </div>
        <div class="form-grid-3">
          ${companyField}
          ${dateField}
          ${fld('Category *', sel('f_category', [['', '— pick —']].concat(cats.map(c => [c.category, c.category])), ''))}
          ${fld('Subcategory', inp('f_subcategory', 'text', '', 'list="dl_subcats"') + dl('dl_subcats', uniqSorted(cats.flatMap(c => c.subs))))}
          ${fld('Supplier / Vendor', inp('f_supplier', 'text', '', 'list="dl_suppliers"') + dl('dl_suppliers', supplierNames()), { hintId: 'hint_supplier', hint: 'Required for Credit' })}
          ${fld('Equipment (cost centre)', inp('f_truck', 'text', '', 'list="dl_equip"') + dl('dl_equip', equipmentNames()))}
          ${fld('Payment Method *', sel('f_method', [['Cash', 'Cash (Cr 5300 Till)'], ['Credit', 'Credit (Cr 4011 Supplier)']], 'Cash'))}
          ${fld('Quantity', inp('f_qty', 'number', '1', 'step="0.01" min="0" inputmode="decimal"'))}
          ${fld('Amount ($) *', inp('f_amount', 'number', '', 'step="0.01" min="0.01" inputmode="decimal"'), { hintId: 'hint_amount', hint: '' })}
          ${fld('Reference / Invoice', inp('f_reference', 'text', ''))}
          ${notesField}
        </div>
        <div class="live-calc">
          <div><small>Amount</small><b id="calc_total">$0.00</b></div>
          <div><small>Posts to</small><b id="calc_post">Cash till 5300</b></div>
          <div><small>Open AP to supplier</small><b id="calc_before">—</b></div>
          <div><small>GL class</small><b id="calc_gl">6x · Operating</b></div>
        </div>
      `;
    }

    // settlement
    return cockpitHtml + `
      <div class="rule-banner" id="smartRuleBanner">
        <strong>Supplier settlement (step241):</strong> the payment relieves the supplier's oldest open legs first (material, haulage, then credit expenses). A <strong>VAT / IVA</strong> method settles only the VAT leg of an IVA invoice.
      </div>
      <div class="form-grid-3">
        ${companyField}
        ${dateField.replace('Transaction Date', 'Settlement Date')}
        ${fld('Supplier / Hauler *', inp('f_supplier', 'text', '', 'list="dl_suppliers"') + dl('dl_suppliers', supplierNames()), { hintId: 'hint_supplier', hint: '' })}
        ${fld('Payment Method *', sel('f_method', [['Payment', 'Payment (Cr 5300 Till / 5121 Bank)'], ['Barter', 'Barter'], ['VAT', 'VAT 11% only'], ['IVA', 'IVA invoice (net + VAT)']], 'Payment'))}
        ${fld('Amount Paid ($) *', inp('f_amount', 'number', '', 'step="0.01" min="0.01" inputmode="decimal"'), { hintId: 'hint_amount', hint: '' })}
        ${fld('Difference / Discount ($)', inp('f_discount', 'number', '0.00', 'step="0.01" min="0" inputmode="decimal"'))}
        ${fld('Reference', inp('f_reference', 'text', '', 'placeholder="Cheque / transfer no."'))}
        ${notesField}
      </div>
      <div id="paSupSubgridWrap"></div>
      <div class="live-calc">
        <div><small>Open AP before</small><b id="calc_before">—</b></div>
        <div><small>Paid + discount</small><b id="calc_total">$0.00</b></div>
        <div><small>Open AP after</small><b id="calc_after">—</b></div>
        <div><small>Allocation</small><b id="calc_alloc">Oldest leg first</b></div>
      </div>
    `;
  }

  // ---- live rule engine -------------------------------------------------------
  const FORM_UI = { priceManual: false, otManual: false, ticketManual: false, qtyManual: false, lastCompany: '' };
  const $ = id => document.getElementById(id);
  const qtyEl = () => document.getElementById('f_qty');
  const val = id => { const el = $(id); return el ? String(el.value == null ? '' : el.value).trim() : ''; };
  const num = id => { const v = Number(val(id)); return isFinite(v) ? v : 0; };
  const setHint = (id, text, cls) => { const el = $(id); if (!el) return; el.textContent = text || ''; el.className = 'hint' + (cls ? ' ' + cls : ''); };
  const setText = (id, text) => { const el = $(id); if (el) el.textContent = text; };

  function commonDateChecks(warnings) {
    const d = val('f_date');
    const today = todayISO();
    if (!d) return;
    if (d > today) setHint('hint_date', 'Future dates are blocked', 'crit');
    else if (d < MIN_DATE) setHint('hint_date', 'Before the books opened (' + MIN_DATE + ')', 'crit');
    else if (daysBetween(d, today) > 30) { setHint('hint_date', 'Back-dated ' + daysBetween(d, today) + ' days — add a note', 'warn'); warnings.push('backdated'); }
    else setHint('hint_date', '', '');
  }

  function dupCheck(company) {
    const hit = ticketExists(company, val('f_ticketno'));
    const wrap = $('wrap_dupok');
    if (hit) {
      setHint('hint_ticket', `Already used on ${hit.label} ${hit.row.ticket_no} dated ${String(hit.row.date).slice(0, 10)}${hit.row.customer ? ' · ' + hit.row.customer : ''}`, 'crit');
      if (wrap) wrap.hidden = false;
    } else {
      setHint('hint_ticket', val('f_ticketno') ? 'Number is free in ' + company : 'Required', val('f_ticketno') ? '' : 'crit');
      if (wrap) { wrap.hidden = true; const cb = $('f_dupok'); if (cb) cb.checked = false; }
    }
    return hit;
  }

  function recalcSales() {
    const company = val('f_company');
    const saleType = val('f_saletype');
    const tbEl = $('f_transportby');
    const customer = val('f_customer');
    const product = val('f_product');
    const site = val('f_site');
    const date = val('f_date');
    const warnings = [];

    if (FORM_UI.lastCompany !== company && !FORM_UI.ticketManual) {
      const tEl = $('f_ticketno');
      if (tEl) tEl.value = nextTicketNo(company, [SEED.records.sales_tickets]);
    }
    FORM_UI.lastCompany = company;

    // Rule #1 / #4: Pickup = customer truck, no transport; Delivery = company fleet or hauler
    if (tbEl) {
      if (saleType === 'Pickup') { if (tbEl.value !== 'Customer truck' && tbEl.value !== 'Third-party truck') tbEl.value = 'Customer truck'; }
      else if (tbEl.value === 'Customer truck') tbEl.value = 'Company fleet';
    }
    const transportBy = val('f_transportby');

    // UoM + ton factor from the product
    const prod = productInfo(product);
    const uom = prod ? (prod.uom || 'm³') : 'm³';
    setText('lbl_uom', uom);
    setHint('hint_product', prod ? (Number(prod.ton_factor) && Number(prod.ton_factor) !== 1 ? `1 ${uom} = ${prod.ton_factor} t` : '') : (product ? 'Unknown grade' : ''), '');

    // Customer: AR + VAT status
    const cust = customerInfo(customer);
    const vatReg = !!(cust && cust['VAT Registered'] === 'Yes');
    const ar = cust ? Number(cust.ar_balance || 0) : null;
    setHint('hint_customer', cust ? `Open AR ${fmtUSD(ar, 2)}${vatReg ? ' · VAT-registered (11%)' : ''}` : (customer ? 'New customer — not in the AR book yet' : ''), cust && ar > 0 ? 'warn' : '');
    const vatWrap = $('wrap_vatinvoice');
    if (vatWrap) vatWrap.hidden = !vatReg;

    // Price agreement lock (fillPrices on the Dataverse form): Delivery reads Sales (Delivery) with the ticket's Site,
    // Pickup reads Sales (Pickup); both fall back to the List Price rule, then to the model's list price
    const upEl = $('f_unitprice'), tpEl = $('f_transunitprice');
    const wantType = saleType === 'Pickup' ? 'Sales (Pickup)' : 'Sales (Delivery)';
    let rule = (customer && product) ? findRule({ company, customer, product, site, date, types: [wantType] }) : null;
    const crossType = !rule && customer && product ? findRule({ company, customer, product, site, date, types: [saleType === 'Pickup' ? 'Sales (Delivery)' : 'Sales (Pickup)'] }) : null;
    if (!FORM_UI.priceManual && upEl) {
      if (rule) {
        upEl.value = Number(rule.unit_price || 0).toFixed(2);
        if (tpEl && saleType === 'Delivery') tpEl.value = Number(rule.trans_unit_price || 0).toFixed(2);
        setText('lbl_pricelock', 'AGREEMENT');
        setHint('hint_price', `${rule.rule_type || 'Agreement'} · ${rule.name}${rule.site ? ' · ' + rule.site : ''}${rule.end_date ? ' · to ' + rule.end_date : ''}${rule.unit && rule.unit !== uom ? ' · priced per ' + rule.unit : ''}`, 'ok');
        if (/truck/i.test(rule.unit || '') && qtyEl() && !FORM_UI.qtyManual) qtyEl().value = '1'; // m229: sold per load → Quantity 1
      } else {
        const lpRule = product ? listPriceRule(company, product, date) : null;
        const lp = lpRule ? Number(lpRule.unit_price || 0) : (product ? listPrice(product) : null);
        if (lp != null) { upEl.value = lp.toFixed(2); setText('lbl_pricelock', 'LIST PRICE'); setHint('hint_price', (crossType ? `No ${wantType} agreement (customer has ${crossType.rule_type} at ${fmtUSD(crossType.unit_price, 2)}) — ` : 'No customer agreement — ') + (lpRule ? lpRule.name : 'model list price'), 'warn'); }
        else { setText('lbl_pricelock', 'MANUAL'); setHint('hint_price', product ? 'No agreement or list price — type the price' : '', ''); }
      }
    } else if (upEl) {
      setText('lbl_pricelock', 'MANUAL');
      setHint('hint_price', rule ? `Overrides agreement ${rule.name} (${fmtUSD(rule.unit_price, 2)})` : 'Typed price', rule ? 'warn' : '');
    }
    if (tpEl) {
      if (saleType === 'Pickup') { tpEl.value = '0.00'; tpEl.disabled = true; setHint('hint_trans', 'Pickup — no transport charge', ''); }
      else { tpEl.disabled = false; setHint('hint_trans', transportBy === 'Third-party truck' ? 'Hauler delivers — transport price billed to customer' : '', ''); }
    }
    setHint('hint_site', saleType === 'Delivery' ? (site ? '' : 'Required on Delivery') : 'Optional on Pickup', saleType === 'Delivery' && !site ? 'crit' : '');
    const truckName = val('f_truck');
    const truckRow = truckName ? SEED.records.equipment.find(e => norm(e.name) === norm(truckName)) : null;
    const ownTruck = !!(truckRow && /^own/i.test(truckRow.ownership || ''));
    const qvWrap = $('paTruckQvWrap');
    if (qvWrap && window.MFG_FORMS) qvWrap.innerHTML = window.MFG_FORMS.renderTruckQuickView(truckRow, transportBy === 'Company fleet');
    if (truckRow && truckRow.default_driver && $('f_driver') && !val('f_driver')) $('f_driver').value = truckRow.default_driver;
    if (rule && truckRow && truckRow.capacity && !FORM_UI.priceManual && upEl && window.MFG_FORMS) {
      const tier = window.MFG_FORMS.matchTier(rule, Number(truckRow.capacity));
      if (tier.tier > 0) {
        upEl.value = (Number(rule.unit_price || 0) + tier.adj).toFixed(2);
        if (tpEl && saleType === 'Delivery') tpEl.value = (Number(rule.trans_unit_price || 0) + tier.transAdj).toFixed(2);
      }
    }
    if (saleType === 'Delivery' && !truckName) setHint('hint_truck', 'Required on Delivery', 'crit');
    else if (truckName && transportBy === 'Company fleet' && truckRow && !ownTruck) setHint('hint_truck', `${truckRow.name} is a third-party unit (${truckRow.supplier || 'hauler'}) — switch Transported By or pick an own truck`, 'warn');
    else if (truckName && transportBy === 'Third-party truck' && ownTruck) setHint('hint_truck', `${truckRow.name} is an own-fleet unit — Transported By should be Company fleet`, 'warn');
    else if (truckRow && truckRow.capacity && qtyEl() && !val('f_qty')) setHint('hint_truck', `Capacity ${fmtNum(truckRow.capacity, 1)} ${uom}`, '');
    else setHint('hint_truck', saleType === 'Delivery' ? '' : 'Optional on Pickup', '');
    if (truckRow && truckRow.capacity && qtyEl() && !val('f_qty') && !FORM_UI.qtyManual) { qtyEl().value = Number(truckRow.capacity).toFixed(2); } // m125: Quantity = the truck's capacity

    // Overtime suggestion (m93: only company-fleet loads earn the allowance)
    const otEl = $('f_overtime');
    const otSuggest = transportBy === 'Company fleet' && isOvertimeTime(val('f_time'));
    if (otEl && !FORM_UI.otManual) otEl.checked = otSuggest;
    setHint('hint_time', otSuggest ? 'Outside the day shift → overtime allowance' : 'Day shift 06:00–17:59', otSuggest ? 'warn' : '');

    // Money
    const qty = num('f_qty'), up = num('f_unitprice'), tp = saleType === 'Pickup' ? 0 : num('f_transunitprice'), disc = num('f_discount');
    const mat = round2(qty * up), tr = round2(qty * tp);
    const net = round2(mat + tr - disc);
    const vat = vatReg ? round2(net * VAT_RATE) : 0;
    const ttc = round2(net + vat);
    setText('calc_mat', fmtUSD(mat, 2));
    setText('calc_tr', fmtUSD(tr, 2));
    setText('calc_vat', vatReg ? fmtUSD(vat, 2) : '—');
    setText('calc_total', fmtUSD(ttc, 2));
    setHint('hint_qty', qty > 0 && prod && Number(prod.ton_factor) && Number(prod.ton_factor) !== 1 ? `≈ ${fmtNum(qty * Number(prod.ton_factor), 2)} t` : (qty <= 0 && val('f_qty') ? 'Must be above zero' : ''), qty <= 0 && val('f_qty') ? 'crit' : '');
    if (disc > mat && mat > 0) setHint('hint_disc', 'Discount exceeds the material subtotal', 'crit');
    else if (mat > 0 && disc > mat * 0.2) { setHint('hint_disc', 'Above 20% of material — add a note', 'warn'); }
    else setHint('hint_disc', '', '');

    commonDateChecks(warnings);
    dupCheck(company);
    return { company, saleType, transportBy, customer, product, site, date, prod, uom, cust, vatReg, rule, qty, up, tp, disc, mat, tr, net, vat, ttc };
  }

  function recalcRaw() {
    const company = val('f_company');
    const transportBy = val('f_transportby');
    const site = val('f_site'), product = val('f_product'), date = val('f_date');
    const sInfo = site ? siteInfo(site) : null;
    if (sInfo && sInfo.supplier && $('f_siteowner') && !val('f_siteowner')) $('f_siteowner').value = sInfo.supplier;
    if (sInfo && sInfo.supplier && transportBy !== 'Company fleet' && $('f_truckowner') && !val('f_truckowner')) $('f_truckowner').value = sInfo.supplier;
    const owner = val('f_siteowner');
    const truckName = val('f_truck');
    const truckRow = truckName ? SEED.records.equipment.find(e => norm(e.name) === norm(truckName)) : null;
    const qvWrap = $('paTruckQvWrap');
    if (qvWrap && window.MFG_FORMS) qvWrap.innerHTML = window.MFG_FORMS.renderTruckQuickView(truckRow, transportBy === 'Company fleet');
    if (truckRow && truckRow.default_driver && $('f_driver') && !val('f_driver')) $('f_driver').value = truckRow.default_driver;
    if (truckRow && truckRow.capacity && qtyEl() && !val('f_qty') && !FORM_UI.qtyManual) qtyEl().value = Number(truckRow.capacity).toFixed(2);
    const warnings = [];
    if (FORM_UI.lastCompany !== company && !FORM_UI.ticketManual) { const tEl = $('f_ticketno'); if (tEl) tEl.value = nextTicketNo(company, [SEED.records.raw_purchases]); }
    FORM_UI.lastCompany = company;

    const prod = productInfo(product);
    setText('lbl_uom', prod ? (prod.uom || 'm³') : 'm³');
    const upEl = $('f_unitprice'), tpEl = $('f_transunitprice');
    // fillCost on the raw ticket: Purchase Price (Site) for the material leg, Transport Price (Site) for the haulage leg
    const rule = (owner || site) && product ? findRule({ company, supplier: owner, site, product, date, types: ['Purchase Price (Site)'] }) : null;
    const haulRule = site && product && transportBy !== 'Company fleet' ? findRule({ company, supplier: val('f_truckowner'), site, product, date, types: ['Transport Price (Site)'] }) : null;
    if (!FORM_UI.priceManual && upEl) {
      if (rule) { upEl.value = Number(rule.unit_price || 0).toFixed(2); setText('lbl_pricelock', 'AGREEMENT'); setHint('hint_price', `${rule.rule_type || 'Agreement'} · ${rule.name}`, 'ok'); }
      else { const lpRule = product ? listPriceRule(company, product, date) : null; if (lpRule) { upEl.value = Number(lpRule.unit_price || 0).toFixed(2); setText('lbl_pricelock', 'LIST PRICE'); setHint('hint_price', 'No purchase agreement — ' + lpRule.name, 'warn'); } else { setText('lbl_pricelock', 'MANUAL'); setHint('hint_price', product ? 'No purchase-price agreement for this owner / site' : '', ''); } }
      if (tpEl && transportBy !== 'Company fleet' && haulRule) tpEl.value = Number(haulRule.trans_unit_price || haulRule.unit_price || 0).toFixed(2);
    } else if (upEl) { setText('lbl_pricelock', 'MANUAL'); setHint('hint_price', rule ? `Overrides ${rule.name} (${fmtUSD(rule.unit_price, 2)})` : '', rule ? 'warn' : ''); }

    if (tpEl) {
      if (transportBy === 'Company fleet') { tpEl.value = '0.00'; tpEl.disabled = true; setHint('hint_trans', 'Own truck — haulage leg is $0', ''); }
      else { tpEl.disabled = false; setHint('hint_trans', haulRule ? `${haulRule.rule_type} · ${haulRule.name}` : '', haulRule ? 'ok' : ''); }
    }
    const toEl = $('f_truckowner');
    if (toEl) {
      if (transportBy === 'Company fleet') { toEl.value = company; toEl.disabled = true; setHint('hint_truckowner', 'Hauled by the company fleet', ''); }
      else { if (toEl.disabled) { toEl.disabled = false; if (toEl.value === company) toEl.value = ''; } setHint('hint_truckowner', toEl.value ? '' : 'Required for third-party haulage', toEl.value ? '' : 'crit'); }
    }
    const ap = openApBalance(owner);
    setHint('hint_owner', owner ? (ap != null ? `Open AP ${fmtUSD(ap, 2)}` : 'New payee — not in the AP book yet') : '', '');

    const otEl = $('f_overtime');
    const otSuggest = transportBy === 'Company fleet' && isOvertimeTime(val('f_time'));
    if (otEl && !FORM_UI.otManual) otEl.checked = otSuggest;
    setHint('hint_time', otSuggest ? 'Outside the day shift → overtime allowance' : 'Day shift 06:00–17:59', otSuggest ? 'warn' : '');

    const qty = num('f_qty'), up = num('f_unitprice'), tp = transportBy === 'Company fleet' ? 0 : num('f_transunitprice');
    const mat = round2(qty * up), tr = round2(qty * tp);
    setText('calc_mat', fmtUSD(mat, 2)); setText('calc_tr', fmtUSD(tr, 2)); setText('calc_qty', fmtNum(qty, 2) + ' ' + (prod ? prod.uom : 'm³')); setText('calc_total', fmtUSD(mat + tr, 2));
    commonDateChecks(warnings);
    dupCheck(company);
    return { company, transportBy, site, owner, product, date, prod, rule, qty, up, tp, mat, tr };
  }

  function recalcReceipt() {
    const customer = val('f_customer');
    const cust = customerInfo(customer);
    const before = cust ? Number(cust.ar_balance || 0) : null;
    const amount = num('f_amount'), disc = num('f_discount');
    setHint('hint_customer', cust ? `${cust['VAT Registered'] === 'Yes' ? 'VAT-registered · ' : ''}${fmtNum(cust.loads)} loads · last sale ${String(cust.last_sale || '').slice(0, 10)}` : (customer ? 'Not in the AR book — check the spelling' : ''), customer && !cust ? 'warn' : '');
    setText('calc_before', before == null ? '—' : fmtUSD(before, 2));
    setText('calc_total', fmtUSD(amount + disc, 2));
    setText('calc_after', before == null ? '—' : fmtUSD(before - amount - disc, 2));
    setText('calc_alloc', val('f_method') === 'VAT' ? 'VAT leg only' : 'FIFO oldest ticket first');
    const cSub = $('paCustSubgridWrap');
    if (cSub && window.MFG_FORMS) cSub.innerHTML = window.MFG_FORMS.renderCustomerOpenTicketsSubgrid({ SEED, STATE }, val('f_company'), customer, amount + disc, val('f_method'));
    if (before != null && amount + disc > before + 0.005) setHint('hint_amount', `Exceeds the open balance by ${fmtUSD(amount + disc - before, 2)} — becomes an advance`, 'warn');
    else setHint('hint_amount', amount <= 0 && val('f_amount') ? 'Must be above zero' : '', amount <= 0 && val('f_amount') ? 'crit' : '');
    commonDateChecks([]);
    return { customer, cust, before, amount, disc };
  }

  function recalcFuel() {
    const company = val('f_company'), equipment = val('f_truck'), date = val('f_date');
    const type = val('f_metertype');
    const reading = $('f_meter') && val('f_meter') !== '' ? num('f_meter') : null;
    const litres = num('f_qty');
    const mEl = $('f_meter');
    if (mEl) mEl.disabled = type === 'none';
    if (FORM_UI.lastCompany !== company && !FORM_UI.ticketManual) { const tEl = $('f_ticketno'); if (tEl) tEl.value = nextTicketNo(company, [SEED.records.fuel_intakes]); }
    FORM_UI.lastCompany = company;

    const prev = equipment ? lastMeter(company, equipment, date || undefined) : null;
    const prevVal = prev ? (prev.odometer != null ? Number(prev.odometer) : Number(prev.hours)) : null;
    const prevType = prev ? (prev.odometer != null ? 'odometer' : 'hours') : null;
    setText('calc_prev', prev ? `${fmtNum(prevVal, 0)} ${prevType === 'hours' ? 'h' : 'km'} on ${String(prev.date).slice(0, 10)}` : (equipment ? 'No prior reading' : '—'));
    let guard = { ok: true, label: 'OK', cls: '' };
    let delta = null;
    if (type !== 'none' && reading != null) {
      if (reading <= 0) guard = { ok: false, label: 'Reading must be above zero', cls: 'crit' };
      else if (type === 'odometer' && reading > 1000000) guard = { ok: false, label: 'Over 1,000,000 km — typo?', cls: 'crit' };
      else if (type === 'hours' && reading > 100000) guard = { ok: false, label: 'Over 100,000 h — typo?', cls: 'crit' };
      else if (prev && prevType === type) {
        delta = reading - prevVal;
        if (delta < 0) guard = { ok: false, label: `Backwards by ${fmtNum(-delta, 0)} ${type === 'hours' ? 'h' : 'km'} vs the last intake`, cls: 'crit' };
        else if (type === 'odometer' && delta > 5000) guard = { ok: true, label: `Jump of ${fmtNum(delta, 0)} km — confirm in notes`, cls: 'warn' };
        else if (type === 'hours' && delta > 500) guard = { ok: true, label: `Jump of ${fmtNum(delta, 0)} h — confirm in notes`, cls: 'warn' };
      }
    }
    setHint('hint_meter', guard.label === 'OK' ? '' : guard.label, guard.cls);
    setText('calc_delta', delta == null ? '—' : fmtNum(delta, 0) + (type === 'hours' ? ' h' : ' km'));
    setText('calc_rate', delta && delta > 0 && litres > 0 ? (type === 'hours' ? fmtNum(litres / delta, 2) + ' L/h' : fmtNum(litres / delta * 100, 1) + ' L/100km') : '—');
    setText('calc_total', guard.ok ? (guard.cls === 'warn' ? 'CHECK' : 'PASS') : 'BLOCKED');
    const known = equipmentNames().some(n => norm(n) === norm(equipment));
    setHint('hint_truck', equipment ? (known ? '' : 'Not in the equipment registry — check the plate') : '', equipment && !known ? 'warn' : '');
    const bbcTankNegative = company === 'BBConstruction' && /diesel/i.test(val('f_item')) && Number((((SEED.sentinels.fleet_fuel_overtime_auditor || {}).by_model || {}).BBConstruction || {}).diesel_stock_balance_l || 0) < 0;
    setHint('hint_qty', bbcTankNegative ? 'BBConstruction tank is negative — diesel intakes are refused until the history is corrected (m212)' : (litres <= 0 && val('f_qty') ? 'Must be above zero' : ''), bbcTankNegative || (litres <= 0 && val('f_qty')) ? 'crit' : '');
    commonDateChecks([]);
    return { company, equipment, date, type, reading, litres, prev, delta, guard, bbcTankNegative };
  }

  function recalcExpense() {
    const method = val('f_method'), supplier = val('f_supplier'), amount = num('f_amount');
    setText('calc_total', fmtUSD(amount, 2));
    setText('calc_post', method === 'Cash' ? 'Cash till 5300' : 'Supplier credit 4011');
    const ap = openApBalance(supplier);
    setText('calc_before', ap == null ? '—' : fmtUSD(ap, 2));
    setHint('hint_supplier', method === 'Credit' && !supplier ? 'Required for Credit' : '', method === 'Credit' && !supplier ? 'crit' : '');
    setHint('hint_amount', amount <= 0 && val('f_amount') ? 'Must be above zero' : '', amount <= 0 && val('f_amount') ? 'crit' : '');
    const cat = val('f_category');
    setText('calc_gl', /fuel|oil/i.test(cat) ? '60 · Fuel & lubricants' : (/repair|spare|tool|minor/i.test(cat) ? '61 · Repairs & parts' : (/tip/i.test(cat) ? '64 · Staff' : '62 · Operating')));
    commonDateChecks([]);
    return { method, supplier, amount };
  }

  function recalcSettlement() {
    const supplier = val('f_supplier');
    const before = openApBalance(supplier);
    const amount = num('f_amount'), disc = num('f_discount');
    setHint('hint_supplier', supplier && before == null ? 'Not in the AP book — check the spelling' : '', supplier && before == null ? 'warn' : '');
    setText('calc_before', before == null ? '—' : fmtUSD(before, 2));
    setText('calc_total', fmtUSD(amount + disc, 2));
    setText('calc_after', before == null ? '—' : fmtUSD(before - amount - disc, 2));
    setText('calc_alloc', /VAT|IVA/.test(val('f_method')) ? 'VAT leg only' : 'Oldest leg first');
    const sSub = $('paSupSubgridWrap');
    if (sSub && window.MFG_FORMS) sSub.innerHTML = window.MFG_FORMS.renderSupplierOpenLegsSubgrid({ SEED, STATE }, val('f_company'), supplier, amount + disc, 'all');
    if (before != null && amount + disc > before + 0.005) setHint('hint_amount', `Exceeds the open balance by ${fmtUSD(amount + disc - before, 2)} — becomes a prepayment`, 'warn');
    else setHint('hint_amount', amount <= 0 && val('f_amount') ? 'Must be above zero' : '', amount <= 0 && val('f_amount') ? 'crit' : '');
    commonDateChecks([]);
    return { supplier, before, amount, disc };
  }

  function recalcForm() {
    try {
      if (['salary', 'logistics', 'treasury'].includes(STATE.modalForm)) {
        const usd = num('f_usd'), lbp = num('f_lbp');
        const tot = round2(usd + lbp / 90000);
        const aEl = $('f_amount');
        if (aEl && (usd > 0 || lbp > 0 || !aEl.value)) aEl.value = tot.toFixed(2);
        return { usd, lbp, amount: num('f_amount') };
      }
      if (STATE.modalForm === 'pricerule') {
        const up = num('f_unitprice'), tp = num('f_transunitprice'), q1 = num('f_qty1'), a1 = num('f_adj1'), ta1 = num('f_transadj1'), q2 = num('f_qty2'), a2 = num('f_adj2'), ta2 = num('f_transadj2');
        setText('calc_mat', `${fmtUSD(up, 2)} + ${fmtUSD(tp, 2)} / ${val('f_uom') || 'm³'}`);
        setText('calc_tr', q1 > 0 ? `${q1}m³ → ${fmtUSD(up + a1 + tp + ta1, 2)}` : '—');
        setText('calc_vat', q2 > 0 ? `${q2}m³ → ${fmtUSD(up + a2 + tp + ta2, 2)}` : '—');
        setText('calc_total', fmtUSD(up + tp, 2));
        return { up, tp };
      }
      if (STATE.modalForm === 'vatinvoice') {
        const net = num('f_amount');
        const vEl = $('f_vat');
        if (vEl && !FORM_UI.priceManual && net > 0) vEl.value = round2(net * VAT_RATE).toFixed(2);
        const vat = num('f_vat');
        setText('calc_mat', fmtUSD(net, 2));
        setText('calc_vat', fmtUSD(vat, 2));
        setText('calc_total', fmtUSD(net + vat, 2));
        return { net, vat, ttc: round2(net + vat) };
      }
      switch (STATE.modalForm) {
        case 'sales': return recalcSales();
        case 'raw': return recalcRaw();
        case 'receipt': return recalcReceipt();
        case 'fuel': return recalcFuel();
        case 'expense': return recalcExpense();
        case 'settlement': return recalcSettlement();
        default: return {};
      }
    } catch (e) { console.error('recalc', e); return {}; }
  }

  function wireModalLiveCalc() {
    const body = $('modalBody');
    if (!body) return;
    FORM_UI.priceManual = false; FORM_UI.otManual = false; FORM_UI.ticketManual = false; FORM_UI.qtyManual = false; FORM_UI.lastCompany = val('f_company');
    body.querySelectorAll('input, select').forEach(el => {
      const handler = () => {
        if (el.id === 'f_unitprice') FORM_UI.priceManual = true;
        if (el.id === 'f_qty') FORM_UI.qtyManual = !!el.value;
        if (el.id === 'f_overtime') FORM_UI.otManual = true;
        if (el.id === 'f_ticketno') FORM_UI.ticketManual = !!el.value;
        // a new counterparty / product / site re-runs the agreement lookup; sale type, date or quantity never override a typed price
        if (['f_customer', 'f_product', 'f_site', 'f_siteowner', 'f_company'].includes(el.id)) FORM_UI.priceManual = false;
        recalcForm();
      };
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    });
    recalcForm();
    const first = body.querySelector('#f_ticketno, #f_customer, #f_supplier, #f_truck, #f_category');
    if (first && window.matchMedia('(min-width: 861px)').matches) setTimeout(() => first.focus(), 60);
  }

  // ---- validation + posting ---------------------------------------------------
  function validateAndBuild() {
    const f = STATE.modalForm;
    const errors = [];
    const c = recalcForm();
    const company = val('f_company');
    const date = val('f_date') || todayISO();
    const today = todayISO();
    const notes = val('f_notes');
    const who = activeUser();
    const needsDate = !['customer', 'supplier', 'product', 'site', 'equipment', 'companyequipment', 'driver'].includes(f);
    if (!allowedCompanyNames().includes(company)) errors.push('Your seat cannot post to ' + (company || 'that company') + '.');
    if (needsDate) {
      if (!val('f_date')) errors.push('Date is required.');
      else if (date > today && f !== 'pricerule') errors.push('Future dates are not allowed.');
      else if (date < MIN_DATE) errors.push('Date is before the books opened (' + MIN_DATE + ').');
      else if (daysBetween(date, today) > 30 && !notes && ['sales', 'raw', 'receipt', 'fuel', 'expense', 'settlement'].includes(f)) errors.push('Back-dated more than 30 days — add a note explaining why.');
    }

    const base = { id: uid(f.slice(0, 2)), date, company, notes, source: 'app', entered_by: who.full_name, entered_by_email: who.email, entered_at: nowStamp(), voided: false };
    let record = null;
    let crKey = FORM_CR_KEY[f] || 'sales_tickets';

    if (f === 'sales') {
      const ticket = val('f_ticketno');
      if (!ticket) errors.push('Ticket number is required.');
      const dup = ticketExists(company, ticket);
      if (dup && !($('f_dupok') && $('f_dupok').checked)) errors.push(`Ticket ${ticket} already exists on a ${dup.label} in ${company} — tick "Post anyway" if the pad really repeats.`);
      if (!c.customer) errors.push('Customer is required.');
      if (!c.product) errors.push('Product is required.');
      if (!(c.qty > 0)) errors.push('Quantity must be above zero.');
      if (c.up < 0) errors.push('Unit price cannot be negative.');
      if (c.up === 0 && !notes) errors.push('A free ticket (unit price 0) needs a note.');
      if (c.saleType === 'Delivery') {
        if (!c.site) errors.push('Destination site is required on a Delivery.');
        if (!val('f_truck')) errors.push('Truck is required on a Delivery.');
        if (!val('f_driver')) errors.push('Driver is required on a Delivery.');
      }
      if (c.disc > c.mat && c.mat > 0) errors.push('Discount exceeds the material subtotal.');
      if (c.mat > 0 && c.disc > c.mat * 0.2 && !notes) errors.push('Discount above 20% of material needs a note.');
      if (c.vatReg && !val('f_vatinvoice') && c.method !== 'Cash' && val('f_method') !== 'Cash') { /* VAT invoice number optional — the book links it later */ }
      record = { ...base, name: `TKT ${date} ${c.customer} #${ticket}`, ticket_no: ticket, rep_date: date, sale_type: c.saleType, transport_by: c.transportBy, customer: c.customer, product: c.product, site: c.site, truck_owner: c.transportBy === 'Company fleet' ? company : '', truck: val('f_truck'), driver: val('f_driver'), uom: c.uom, ton_factor: c.prod ? Number(c.prod.ton_factor || 1) : 1, qty: c.qty, unit_price: c.up, price: c.mat, trans_unit_price: c.tp, trans_price: c.tr, discount: c.disc, total: c.net, vat: c.vat, total_ttc: c.ttc, method: val('f_method'), vat_invoice: c.vatReg ? val('f_vatinvoice') : '', time: val('f_time') || '12:00', overtime: !!($('f_overtime') && $('f_overtime').checked), price_rule: c.rule ? c.rule.name : (c.up ? (FORM_UI.priceManual ? 'Manual' : 'List Price') : ''), duplicate_confirmed: !!dup };
    } else if (f === 'raw') {
      const ticket = val('f_ticketno');
      if (!ticket) errors.push('Ticket number is required.');
      const dup = ticketExists(company, ticket);
      if (dup && !($('f_dupok') && $('f_dupok').checked)) errors.push(`Ticket ${ticket} already exists on a ${dup.label} in ${company} — tick "Post anyway" if the pad really repeats.`);
      if (!c.site) errors.push('Quarry site is required.');
      if (!c.product) errors.push('Raw material is required.');
      if (!(c.qty > 0)) errors.push('Quantity must be above zero.');
      if (c.up > 0 && !c.owner) errors.push('Quarry site owner (material payee) is required when the material has a cost.');
      if (c.transportBy !== 'Company fleet' && c.tp > 0 && !val('f_truckowner')) errors.push('Truck owner (haulage payee) is required for third-party haulage.');
      record = { ...base, name: `RAW ${date} ${c.site} #${ticket}`, ticket_no: ticket, rep_date: date, product: c.product, site: c.site, site_owner: c.owner, transport_by: c.transportBy, truck_owner: c.transportBy === 'Company fleet' ? company : val('f_truckowner'), truck: val('f_truck'), driver: val('f_driver'), uom: c.prod ? c.prod.uom : 'm³', qty: c.qty, unit_cost: c.up, cost: c.mat, trans_unit_cost: c.tp, trans_cost: c.tr, total: round2(c.mat + c.tr), method: val('f_method'), time: val('f_time') || '12:00', overtime: !!($('f_overtime') && $('f_overtime').checked), price_rule: c.rule ? c.rule.name : '', duplicate_confirmed: !!dup };
    } else if (f === 'receipt') {
      if (!c.customer) errors.push('Customer is required.');
      if (!(c.amount > 0)) errors.push('Amount must be above zero.');
      if (c.disc < 0) errors.push('Discount cannot be negative.');
      record = { ...base, name: `RCPT ${date} ${c.customer}`, customer: c.customer, method: val('f_method'), amount: round2(c.amount), discount: round2(c.disc), reference: val('f_reference'), ar_before: c.before };
    } else if (f === 'fuel') {
      if (!c.equipment) errors.push('Equipment is required.');
      if (!(c.litres > 0)) errors.push('Litres must be above zero.');
      if (c.bbcTankNegative) errors.push('BBConstruction diesel intakes are refused while the tank reconciliation is negative (m212).');
      if (c.type !== 'none' && c.reading == null) errors.push('Meter reading is required (or choose "No meter").');
      if (!c.guard.ok) errors.push('Meter guard: ' + c.guard.label);
      if (c.guard.cls === 'warn' && !notes) errors.push('Large meter jump — add a note to confirm the reading.');
      const ticket = val('f_ticketno');
      const dup = ticketExists(company, ticket);
      if (dup && ticket) errors.push(`Ticket ${ticket} already exists on a ${dup.label} in ${company}.`);
      record = { ...base, name: `FUEL ${date} ${c.equipment}${ticket ? ' #' + ticket : ''}`, ticket_no: ticket, fuel_type: /diesel/i.test(val('f_item')) ? 'Diesel' : 'Lubricant', item: val('f_item'), equipment: c.equipment, driver: val('f_driver'), litres: round2(c.litres), odometer: c.type === 'odometer' ? c.reading : null, hours: c.type === 'hours' ? c.reading : null, location: val('f_location'), meter_delta: c.delta };
    } else if (f === 'expense') {
      if (!val('f_category')) errors.push('Category is required.');
      if (!(c.amount > 0)) errors.push('Amount must be above zero.');
      if (c.method === 'Credit' && !c.supplier) errors.push('A credit expense needs the supplier it is owed to.');
      record = { ...base, name: `EXP ${date} ${c.supplier || val('f_category')}`, rep_date: date, category: val('f_category'), subcategory: val('f_subcategory'), supplier: c.supplier, equipment: val('f_truck'), method: c.method, qty: num('f_qty') || 1, amount: round2(c.amount), reference: val('f_reference') };
    } else if (f === 'settlement') {
      if (!c.supplier) errors.push('Supplier is required.');
      if (!(c.amount > 0)) errors.push('Amount must be above zero.');
      if (c.disc < 0) errors.push('Discount cannot be negative.');
      record = { ...base, name: `SETTLE ${date} ${c.supplier}`, supplier: c.supplier, method: val('f_method'), amount: round2(c.amount), discount: round2(c.disc), reference: val('f_reference'), ap_before: c.before };
    } else if (f === 'pricerule') {
      const prod = val('f_product'), rt = val('f_ruletype') || 'Sales (Delivery)';
      if (!prod) errors.push('Product / Grade is required.');
      record = { ...base, name: val('f_name') || `PRC-${date.replace(/-/g, '')}-${rt.slice(0, 5).toUpperCase()}-${prod}`, rule_type: rt, customer: val('f_customer'), supplier: val('f_supplier'), site: val('f_site'), product: prod, unit: val('f_uom') || 'm³', rate_per: val('f_rateper') || 'm³', unit_price: round2(num('f_unitprice')), trans_unit_price: round2(num('f_transunitprice')), indiff_price: val('f_indiff') ? round2(num('f_indiff')) : null, qty1: val('f_qty1') ? num('f_qty1') : null, adj1: round2(num('f_adj1')), trans_adj1: round2(num('f_transadj1')), qty2: val('f_qty2') ? num('f_qty2') : null, adj2: round2(num('f_adj2')), trans_adj2: round2(num('f_transadj2')), start_date: date, end_date: val('f_enddate') || '' };
    } else if (f === 'vatinvoice') {
      const inv = val('f_ticketno'), cust = val('f_customer'), net = round2(num('f_amount')), vat = round2(num('f_vat'));
      if (!inv || !cust || !(net > 0)) errors.push('Invoice Serial No., Customer, and Net Amount are required.');
      record = { ...base, name: inv, invoice_no: inv, rep_date: val('f_repdate') || date, customer: cust, net_amount: net, vat_amount: vat, total_ttc: round2(net + vat), status: val('f_status') || 'Open' };
    } else if (f === 'creditterm') {
      const cust = val('f_customer'), days = num('f_days');
      if (!cust) errors.push('Customer is required.');
      record = { ...base, name: `${cust} · Net ${days}d`, customer: cust, payment_days: days, credit_limit: round2(num('f_amount')), start_date: date };
    } else if (f === 'customer') {
      const nm = val('f_customer');
      if (!nm) errors.push('Customer Name is required.');
      record = { ...base, name: nm, method: val('f_method') || 'Credit', vat_registered: val('f_vatreg') === 'Yes', mof_no: val('f_mof'), phone: val('f_phone'), region: val('f_region'), customer_declared_qty: !!($('f_declqty') && $('f_declqty').checked), external_invoice: !!($('f_extinv') && $('f_extinv').checked) };
    } else if (f === 'supplier') {
      const nm = val('f_supplier');
      if (!nm) errors.push('Supplier Name is required.');
      record = { ...base, name: nm, category: val('f_category'), phone: val('f_phone'), mof_no: val('f_mof'), is_truck_owner: !!($('f_istruckowner') && $('f_istruckowner').checked), iva: !!($('f_iva') && $('f_iva').checked), trucks_count: 0 };
    } else if (f === 'product') {
      const nm = val('f_product');
      if (!nm) errors.push('Product Name is required.');
      record = { ...base, name: nm, uom: val('f_uom') || 'm³', type: val('f_prodtype') || 'Material', ton_factor: num('f_tonfactor') || 1, list_price: round2(num('f_unitprice')), ticket_product: !!($('f_ticketprod') && $('f_ticketprod').checked), fuel_item: !!($('f_fuelitem') && $('f_fuelitem').checked), input_product: !!($('f_inputprod') && $('f_inputprod').checked) };
    } else if (f === 'site') {
      const nm = val('f_site');
      if (!nm) errors.push('Site Name is required.');
      record = { ...base, name: nm, region: val('f_region'), supplier: val('f_supplier'), customer: val('f_customer'), latitude: val('f_lat') ? num('f_lat') : null, longitude: val('f_lng') ? num('f_lng') : null, is_jv: !!($('f_isjv') && $('f_isjv').checked) };
    } else if (f === 'equipment' || f === 'companyequipment') {
      const nm = val('f_truck');
      if (!nm) errors.push('Unit Code / Plate Identifier is required.');
      record = { ...base, name: nm, plate_no: val('f_plateno') || nm, type: val('f_category') || 'Truck', capacity: num('f_capacity') || 0, ownership: val('f_ownership') || 'Owned', supplier: val('f_supplier'), default_driver: val('f_driver'), model: val('f_model') };
    } else if (f === 'driver') {
      const nm = val('f_driver');
      if (!nm) errors.push('Driver Name is required.');
      record = { ...base, name: nm, driver: nm, truck_owner: val('f_supplier'), truck: val('f_truck'), phone: val('f_phone'), is_company_driver: !!($('f_iscompanydriver') && $('f_iscompanydriver').checked) };
    } else if (f === 'salary') {
      const st = val('f_staff'), amt = round2(num('f_amount'));
      if (!st || !(amt > 0)) errors.push('Staff Name and Amount > 0 are required.');
      record = { ...base, name: `SAL ${val('f_paymonth') || date.slice(0, 7)} ${st}`, payroll_month: val('f_paymonth') || date.slice(0, 7), staff: st, equipment: val('f_truck'), method: val('f_method') || 'Cash', usd_amount: round2(num('f_usd')), lbp_amount: round2(num('f_lbp')), amount: amt };
    } else if (f === 'attendance') {
      const st = val('f_staff');
      if (!st) errors.push('Staff Member is required.');
      record = { ...base, name: `ATT ${date} ${st}`, staff: st, status: val('f_status') || 'Present', site: val('f_site'), overtime_hours: num('f_hours') || 0 };
    } else if (f === 'freelance' || f === 'employment') {
      const st = val('f_staff'), amt = round2(num('f_amount'));
      if (!st || !(amt > 0)) errors.push('Staff Name and Salary/Rate > 0 are required.');
      record = { ...base, name: `${f === 'employment' ? 'EMP' : 'FRL'} ${st}`, staff: st, role: val('f_role'), pay_type: val('f_paytype'), base_salary: amt, amount: amt, start_date: date, status: 'Active' };
    } else if (f === 'logistics') {
      const st = val('f_staff'), amt = round2(num('f_amount'));
      if (!st || !(amt > 0)) errors.push('Staff Member and Allowance > 0 are required.');
      const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].filter(d => $('f_day_' + d) && $('f_day_' + d).checked).length;
      record = { ...base, name: `ALLOW ${date} ${st}`, staff: st, site: val('f_site'), days_count: days, usd_amount: round2(num('f_usd')), lbp_amount: round2(num('f_lbp')), amount: amt };
    } else if (f === 'triprate') {
      const nm = val('f_name') || val('f_site'), amt = round2(num('f_amount'));
      if (!nm || !(amt > 0)) errors.push('Route/Site and Rate > 0 are required.');
      record = { ...base, name: nm, site: val('f_site'), category: val('f_category') || 'Truck', rate_usd: amt };
    } else if (f === 'treasury') {
      const trt = val('f_trtype') || 'loan', cp = val('f_counterparty'), amt = round2(num('f_amount'));
      if (!cp || !(amt > 0)) errors.push('Counterparty and Amount > 0 are required.');
      crKey = trt === 'loan_settlement' ? 'loan_settlements' : (trt === 'external' ? 'external_movements' : (trt === 'conversion' ? 'conversions' : 'loans'));
      record = { ...base, name: `${trt.toUpperCase()} ${date} ${cp}`, counterparty: cp, lender: cp, borrower: company, loan: cp, direction: val('f_direction') || 'Inflow', from_currency: 'LBP → USD', usd_amount: round2(num('f_usd')), lbp_amount: round2(num('f_lbp')), fx_rate: 90000, amount: amt, balance: amt, reference: val('f_reference') };
    } else if (f === 'jv') {
      const jvt = val('f_jvtype') || 'distribution', st = val('f_site'), pt = val('f_counterparty');
      if (!st || !pt) errors.push('JV Site and JV Partner are required.');
      crKey = jvt === 'partnership' ? 'jv_partnerships' : 'jv_distributions';
      record = { ...base, name: `JV ${st} · ${pt}`, site: st, partner: pt, share_pct: num('f_share') || 50, amount: round2(num('f_amount')) };
    }
    return { errors, record, crKey };
  }

  function showFormErrors(errors) {
    let box = $('formErrors');
    if (!box) {
      box = document.createElement('div');
      box.id = 'formErrors';
      box.className = 'form-errors';
      const body = $('modalBody');
      const foot = body && body.querySelector('.modal-foot');
      if (foot) body.insertBefore(box, foot); else if (body) body.appendChild(box);
    }
    if (!errors.length) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = `<strong>Fix before posting:</strong><ul>${errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul>`;
    box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  async function postRecordToLocalApi(crKey, record) {
    if (!HAS_LOCAL_API) return;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      await fetch('./api/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ table: CR_TABLE[crKey], record }), signal: ctrl.signal });
      clearTimeout(t);
    } catch (_) { /* offline or static host */ }
  }

  async function saveModalEntry() {
    if (STATE.saving) return;
    if (!canEnterForm(STATE.modalForm)) { toast('Your seat cannot post this entry', 'err'); return; }
    const { errors, record, crKey } = validateAndBuild();
    showFormErrors(errors);
    if (errors.length) return;

    STATE.saving = true;
    const sBtn = $('dynSaveModalBtn');
    if (sBtn) { sBtn.disabled = true; sBtn.textContent = 'Posting…'; }
    try {
      STATE.customRecords[crKey].unshift(record);
      applyCustomRecordsToSeed();
      saveLocalAuthAndRecords();           // write-ahead: local first, network after
      closeEntryModal(true);
      toast(`${CR_LABEL[crKey].replace(/^./, ch => ch.toUpperCase())} posted · ${record.name}`, 'ok');
      renderApp();
      await postRecordToLocalApi(crKey, record);
      syncWithCloud(true);
    } finally {
      STATE.saving = false;
    }
  }

  function voidRecord(crKey, id) {
    const list = STATE.customRecords[crKey] || [];
    const r = list.find(x => x.id === id);
    if (!r) { toast('Only app-entered rows can be voided here — book rows are corrected in the workbook', 'err'); return; }
    if (!canVoid()) { toast('Your seat cannot void entries', 'err'); return; }
    r.voided = true;
    r.voided_by = activeUser().full_name;
    r.voided_at = nowStamp();
    applyCustomRecordsToSeed();
    saveLocalAuthAndRecords();
    renderApp();
    toast('Entry voided · ' + (r.name || id));
    postRecordToLocalApi(crKey, r);
    syncWithCloud(true);
  }

  function openEntryModal(formType) {
    const form = FORM_TITLES[formType] ? formType : 'sales';
    if (!canEnterForm(form)) { toast('Your seat has no entry rights for this form', 'err'); return; }
    STATE.modalForm = form;
    const modal = $('entryModal');
    const body = $('modalBody');
    const title = $('modalTitle');
    const tabsWrap = $('modalTabs');
    if (title) title.textContent = FORM_TITLES[form];
    if (tabsWrap && window.MFG_FORMS) {
      tabsWrap.innerHTML = window.MFG_FORMS.renderModalTabsHtml(form, canEnterForm);
      tabsWrap.querySelectorAll('[data-pa-group]').forEach(gBtn => {
        gBtn.addEventListener('click', () => {
          const gid = gBtn.getAttribute('data-pa-group');
          const grp = (window.MFG_FORMS.FORM_GROUPS || []).find(g => g.id === gid);
          const firstForm = grp && grp.forms.find(f => canEnterForm(f.id));
          if (firstForm) openEntryModal(firstForm.id);
        });
      });
      tabsWrap.querySelectorAll('.modal-tab[data-form]').forEach(tBtn => {
        tBtn.addEventListener('click', () => openEntryModal(tBtn.getAttribute('data-form')));
      });
    } else {
      document.querySelectorAll('#modalTabs .modal-tab').forEach(b => {
        const f = b.getAttribute('data-form');
        b.hidden = !canEnterForm(f);
        b.classList.toggle('active', f === form);
      });
    }
    if (body) {
      body.innerHTML = renderEntryModalBody() + `
        <div class="modal-foot">
          <span class="form-note">Posting as <b>${esc(activeUser().full_name)}</b> · stored on this device, the cloud ledger${HAS_LOCAL_API ? ' and SQLite' : ''}</span>
          <div>
            <button type="button" class="btn-ghost-bar" id="dynCancelModalBtn">Cancel</button>
            <button type="button" class="btn btn-brass" id="dynSaveModalBtn">Post to Cloud Ledger</button>
          </div>
        </div>
      `;
      const cBtn = $('dynCancelModalBtn');
      const sBtn = $('dynSaveModalBtn');
      if (cBtn) cBtn.addEventListener('click', () => closeEntryModal());
      if (sBtn) sBtn.addEventListener('click', saveModalEntry);
      body.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') { e.preventDefault(); saveModalEntry(); } });
    }
    if (modal) { modal.hidden = false; modal.scrollTop = 0; }
    document.body.classList.add('modal-open');
    wireModalLiveCalc();
  }

  function closeEntryModal(force) {
    if (STATE.saving && !force) return;
    const modal = $('entryModal');
    if (modal) modal.hidden = true;
    document.body.classList.remove('modal-open');
    if (STATE.renderPending) { STATE.renderPending = false; renderApp(); }
  }

  // ==========================================================================
  // MULTI-DEVICE CLOUD RELAY + LOCAL PERSISTENCE
  // ==========================================================================
  function saveLocalAuthAndRecords() {
    try {
      localStorage.setItem('isabi_mfg_users_v2', JSON.stringify(STATE.users));
      localStorage.setItem('isabi_mfg_sessions_v2', JSON.stringify(STATE.sessions.slice(0, 50)));
      localStorage.setItem('isabi_mfg_custom_recs_v2', JSON.stringify(STATE.customRecords));
    } catch (_) { /* storage full or blocked — the cloud copy still holds the state */ }
  }

  // Union-merge another device's app entries into ours. A void tombstone always wins.
  function mergeCustomRecords(remote) {
    if (!remote || typeof remote !== 'object') return false;
    let changed = false;
    CR_KEYS.forEach(k => {
      const inc = Array.isArray(remote[k]) ? remote[k] : [];
      const mine = STATE.customRecords[k];
      const byId = new Map(mine.map(r => [r.id, r]));
      inc.forEach(r => {
        if (!r || !r.id) return;
        const cur = byId.get(r.id);
        if (!cur) { mine.push(r); byId.set(r.id, r); changed = true; }
        else if (r.voided && !cur.voided) { cur.voided = true; cur.voided_by = r.voided_by; cur.voided_at = r.voided_at; changed = true; }
      });
    });
    return changed;
  }

  // Project the app entries onto the seed registers (voided rows drop out, new rows sort in by date)
  function applyCustomRecordsToSeed() {
    CR_KEYS.forEach(k => {
      const list = SEED.records[k];
      const seen = new Set(list.map(x => x.id));
      let touched = false;
      STATE.customRecords[k].forEach(r => {
        if (r.voided) {
          const i = list.findIndex(x => x.id === r.id);
          if (i >= 0) { list.splice(i, 1); touched = true; }
          return;
        }
        if (!seen.has(r.id)) { list.push(r); seen.add(r.id); touched = true; }
      });
      if (touched) list.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    });
  }

  function cloudPayload() {
    const trimmed = {};
    CR_KEYS.forEach(k => { trimmed[k] = STATE.customRecords[k].slice(0, 1500); });
    return {
      users: STATE.users,
      sessions: STATE.sessions.slice(0, 25),
      customRecords: trimmed,
      updatedAt: new Date().toISOString(),
      updatedBy: activeUser().email,
      appVersion: '4.0'
    };
  }

  function uiBusy() {
    const m = $('entryModal');
    if (m && !m.hidden) return true;
    if (STATE.showAddUserForm) return true;
    const a = document.activeElement;
    return !!(a && ['INPUT', 'SELECT', 'TEXTAREA'].includes(a.tagName) && a.id !== 'aiInput');
  }
  function safeRender() {
    if (uiBusy()) { STATE.renderPending = true; return; }
    renderApp();
  }

  let syncInFlight = null;
  async function syncWithCloud(pushChanges = false) {
    if (syncInFlight) { if (pushChanges) STATE.pushAfterSync = true; return syncInFlight; }
    syncInFlight = doSync(pushChanges || STATE.pushAfterSync).finally(() => {
      syncInFlight = null;
      if (STATE.pushAfterSync) { STATE.pushAfterSync = false; syncWithCloud(true); }
    });
    return syncInFlight;
  }

  async function doSync(pushChanges) {
    // 1. Local SQLite server (LAN host only)
    if (HAS_LOCAL_API) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 6000);
        const rLocal = await fetch('./api/users', { signal: ctrl.signal });
        clearTimeout(t);
        if (rLocal.ok) {
          const dLocal = await rLocal.json();
          if (Array.isArray(dLocal.users) && dLocal.users.length) {
            const byEmail = new Map(STATE.users.map(u => [norm(u.email), u]));
            dLocal.users.forEach(u => { const k = norm(u.email); if (k) byEmail.set(k, Object.assign({}, byEmail.get(k) || {}, u)); });
            STATE.users = Array.from(byEmail.values());
          }
        }
      } catch (_) { /* server.py not running */ }
    }

    // 2. BHFIRMS Multi-Device Cloud Relay (GitHub Pages + mobile + desktop)
    if (!CLOUD_URL || !CLOUD_KEY || navigator.webdriver) {
      STATE.cloudStatus = '● Ready (Local)';
      updateCloudBadges();
      return;
    }
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      const getRes = await fetch(CLOUD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({ key: CLOUD_KEY, op: 'get' }),
        signal: ctrl.signal
      });
      clearTimeout(timer);
      if (!getRes.ok) throw new Error('relay ' + getRes.status);

      const store = await getRes.json();
      const docs = (store && store.docs) || store || {};
      const remote = docs[CLOUD_DOC_KEY] || {};
      let changed = false;

      if (Array.isArray(remote.users) && remote.users.length) {
        const byEmail = new Map();
        remote.users.forEach(u => { if (u && u.email) byEmail.set(norm(u.email), u); });
        if (pushChanges) STATE.users.forEach(u => { if (u && u.email) byEmail.set(norm(u.email), u); });
        else {
          // keep any seat only this device knows about (created offline) so it is not lost before the next push
          STATE.users.forEach(u => { if (u && u.email && !byEmail.has(norm(u.email))) { byEmail.set(norm(u.email), u); pushChanges = true; } });
        }
        const next = Array.from(byEmail.values());
        if (JSON.stringify(next) !== JSON.stringify(STATE.users)) { changed = true; }
        const myEmail = norm(activeUser().email);
        STATE.users = next;
        const idx = STATE.users.findIndex(u => norm(u.email) === myEmail);
        if (idx >= 0) STATE.activeUserIdx = idx;
      }

      if (Array.isArray(remote.sessions) && remote.sessions.length) {
        const seenS = new Set(STATE.sessions.map(s => s.id));
        remote.sessions.forEach(s => { if (s && s.id && !seenS.has(s.id)) { STATE.sessions.push(s); seenS.add(s.id); changed = true; } });
        STATE.sessions.sort((a, b) => String(b.logged_in_at || '').localeCompare(String(a.logged_in_at || '')));
        STATE.sessions = STATE.sessions.slice(0, 50);
      }

      if (remote.customRecords && mergeCustomRecords(remote.customRecords)) { changed = true; applyCustomRecordsToSeed(); }
      // anything only we hold → push
      if (!pushChanges && remote.customRecords) {
        const remoteIds = new Set();
        CR_KEYS.forEach(k => (remote.customRecords[k] || []).forEach(r => r && remoteIds.add(r.id + (r.voided ? '|v' : ''))));
        CR_KEYS.forEach(k => STATE.customRecords[k].forEach(r => { if (!remoteIds.has(r.id + (r.voided ? '|v' : ''))) pushChanges = true; }));
      }

      saveLocalAuthAndRecords();
      STATE.cloudStatus = '● Cloud Live';
      STATE.cloudUpdatedAt = remote.updatedAt || '';

      if (pushChanges || !docs[CLOUD_DOC_KEY]) {
        const payload = cloudPayload();
        const ctrl2 = new AbortController();
        const timer2 = setTimeout(() => ctrl2.abort(), 15000);
        const putRes = await fetch(CLOUD_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body: JSON.stringify({ key: CLOUD_KEY, op: 'patch', patch: { [CLOUD_DOC_KEY]: payload } }),
          signal: ctrl2.signal
        });
        clearTimeout(timer2);
        if (putRes.ok) STATE.cloudUpdatedAt = payload.updatedAt;
        else STATE.cloudStatus = '● Cloud read-only (' + putRes.status + ')';
      }
      updateCloudBadges();
      if (changed) safeRender();
    } catch (_) {
      STATE.cloudStatus = navigator.onLine ? '● Relay unreachable' : '● Offline Cache';
      updateCloudBadges();
    }
  }

  function updateCloudBadges() {
    const el = $('sqlStatusText');
    if (el && !HAS_LOCAL_API) el.textContent = STATE.cloudStatus.replace('● ', '');
    const auth = $('authCloudStatusBadge');
    if (auth) { auth.textContent = STATE.cloudStatus; auth.className = /Live|Ready/.test(STATE.cloudStatus) ? 'auth-cloud-ok' : 'auth-cloud-warn'; }
  }

  // ==========================================================================
  // TEAM SIGN-IN GATE (FAIL-CLOSED) + RLS
  // ==========================================================================
  const VIEW_TITLES = {
    overview: 'Consolidated Command & Ledger Overview',
    pbi: '20-Page Power BI Semantic Report Studio (m18c Parity)',
    tables: 'All 34 Power Apps Dataverse Tables & Registers (m14 Parity)',
    sentinels: 'AI Sentinel Watchdogs & Deterministic Audit (m280)',
    sales: 'Sales & Weighbridge Deliveries Register',
    raw: 'Raw Material & Quarry Intake (2-Leg Payable Split)',
    fleet: 'Equipment, Fleet Telemetry & Diesel Control (m142)',
    pricing: 'Customer & Quarry Price Matrix & Commissions',
    customers: 'Customers & FIFO Accounts Receivable Aging',
    ar: 'Customers & FIFO Accounts Receivable Aging',
    suppliers: 'Suppliers, Quarries & 3-Leg Accounts Payable',
    ap: 'Suppliers, Quarries & 3-Leg Accounts Payable',
    expenses: 'Operating Expenses, Salaries & Overtime',
    ledger: 'Lebanese CoA Trial Balance & SOA Journal Stream',
    gl: 'Lebanese CoA Trial Balance & SOA Journal Stream',
    statements: '22 Printable A4 Financial & Operational Statements',
    users: 'Multi-Device Team Authentication, RLS & Cloud Sync'
  };
  const VIEW_MOBILE_TITLES = {
    overview: 'Command & Ledger Overview',
    pbi: 'Power BI Studio (20 Pages)',
    tables: 'All 34 Tables & Setup',
    sentinels: 'AI Sentinel Audit (m280)',
    sales: 'Sales & Deliveries',
    raw: 'Quarry Intake (2-Leg AP)',
    fleet: 'Fleet & Diesel Control',
    pricing: 'Price Matrix & Rules',
    customers: 'Customers & AR Aging',
    ar: 'Customers & AR Aging',
    suppliers: 'Suppliers & 3-Leg AP',
    ap: 'Suppliers & 3-Leg AP',
    expenses: 'Expenses & Payroll',
    ledger: 'Trial Balance & SOA GL',
    gl: 'Trial Balance & SOA GL',
    statements: '22 Financial Statements',
    users: 'Team Auth & Cloud Sync'
  };
  const COMPANY_MOBILE_LABELS = {
    'manufacturing-group': 'All Group (WTC · BBC · Lions)',
    wtc: 'WTC (World Trading)',
    bbconstruction: 'BBConstruction',
    lionstransport: 'Lions Transport'
  };

  function getInitials(name) {
    return String(name || 'IS').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
  }

  function applyUserRlsAndPermissions() {
    const user = activeUser();
    const allowedCos = getAllowedCompanyKeys(user);

    if (!allowedCos.includes(STATE.company)) STATE.company = allowedCos[0];
    document.querySelectorAll('#companySwitch .entity-btn').forEach(btn => {
      btn.hidden = !allowedCos.includes(btn.getAttribute('data-company'));
    });

    document.querySelectorAll('#sidebarNav .nav-item').forEach(btn => {
      btn.hidden = !canViewView(btn.getAttribute('data-view'), user);
    });
    if (!canViewView(STATE.view, user)) STATE.view = defaultViewFor(user);

    const newBtn = $('newEntryBtn');
    if (newBtn) newBtn.hidden = !canEnterAny(user);

    const avEl = $('railUserAvatar'), nmEl = $('railUserName'), rlEl = $('activeRoleBadge'), scEl = $('railRlsScope');
    if (avEl) avEl.textContent = getInitials(user.full_name);
    if (nmEl) nmEl.textContent = user.full_name;
    if (rlEl) rlEl.textContent = user.role;
    if (scEl) scEl.textContent = String(user.companies || 'WTC').replace(/BBConstruction/g, 'BBC').replace(/Lions Transport/g, 'Lions');
  }

  function renderQuickSeatsInAuthGate() {
    const listEl = $('quickSeatList');
    if (!listEl) return;
    const hdr = document.querySelector('.auth-right-hdr span');
    const sub = document.querySelector('.auth-right-hdr small');
    if (hdr) hdr.textContent = IS_DEMO ? 'Quick Role & Device Simulator (1-Click Fill)' : 'Team Seats on this Workspace';
    if (sub) sub.textContent = IS_DEMO ? 'Demo mode — tap any seat to sign in and see how Row-Level Security scopes the interface:' : 'Tap your seat to fill the email, then type the PIN your administrator gave you:';
    listEl.innerHTML = STATE.users.filter(u => u.status !== 'Suspended').map((u, idx) => `
      <button type="button" class="quick-seat-item" data-quick-seat="${esc(u.email)}">
        <div>
          <b>${esc(u.full_name)}</b>
          <small>${esc(u.email)} · ${esc(u.companies)}</small>
        </div>
        <div class="quick-seat-meta">
          <span class="quick-seat-role">${esc(u.role)}</span>
          ${IS_DEMO ? `<span class="quick-seat-pin">PIN: ${esc(u.pin_code || '1111')}</span>` : ''}
        </div>
      </button>
    `).join('');

    listEl.querySelectorAll('[data-quick-seat]').forEach(btn => {
      btn.addEventListener('click', () => {
        const u = STATE.users.find(x => norm(x.email) === norm(btn.getAttribute('data-quick-seat')));
        if (!u) return;
        const emEl = $('authEmailInput');
        const pinEl = $('authPinInput');
        if (emEl) emEl.value = u.email;
        if (IS_DEMO) { if (pinEl) pinEl.value = u.pin_code || '1111'; performLogin(u.email, u.pin_code || '1111'); }
        else if (pinEl) { pinEl.value = ''; pinEl.focus(); }
      });
    });
  }

  function openAuthGate(prefillEmail) {
    STATE.authed = false;
    renderQuickSeatsInAuthGate();
    updateCloudBadges();
    const emEl = $('authEmailInput');
    const pinEl = $('authPinInput');
    if (emEl) emEl.value = prefillEmail || '';
    if (pinEl) pinEl.value = '';
    const errEl = $('authErrorBox');
    if (errEl) errEl.hidden = true;
    const gate = $('authGate');
    if (gate) gate.hidden = false;
    document.body.classList.add('locked');
    setTimeout(() => { const t = prefillEmail ? pinEl : emEl; if (t) t.focus(); }, 80);
  }

  function closeAuthGate() {
    STATE.authed = true;
    const gate = $('authGate');
    if (gate) gate.hidden = true;
    document.body.classList.remove('locked');
  }

  function signOut() {
    const email = activeUser().email;
    localStorage.removeItem('isabi_mfg_active_email');
    closeEntryModal(true);
    openAuthGate(email);
    toast('Session locked — sign in to continue');
  }

  function authError(msg) {
    const errEl = $('authErrorBox');
    if (errEl) { errEl.textContent = msg; errEl.hidden = false; }
    const card = document.querySelector('.auth-card');
    if (card) { card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake'); }
    const pinEl = $('authPinInput');
    if (pinEl) { pinEl.value = ''; pinEl.focus(); }
  }

  let loginAttempts = 0;
  let loginLockUntil = 0;
  async function performLogin(emailRaw, pinRaw) {
    const email = norm(emailRaw);
    const pin = String(pinRaw || '').trim();
    if (Date.now() < loginLockUntil) { authError(`Too many attempts — wait ${Math.ceil((loginLockUntil - Date.now()) / 1000)} s.`); return false; }
    if (!email) { authError('Enter your team email.'); return false; }
    if (!pin) { authError('Enter your access PIN.'); return false; }

    const idx = STATE.users.findIndex(u => norm(u.email) === email);
    if (idx < 0) { authError('Email not found in the Manufacturing team directory.'); return false; }
    const user = STATE.users[idx];
    if (user.status === 'Suspended') { authError('This seat is suspended — ask the owner to re-activate it.'); return false; }
    if (pin !== String(user.pin_code || '1111').trim()) {
      loginAttempts += 1;
      if (loginAttempts >= 5) { loginLockUntil = Date.now() + 30000; loginAttempts = 0; authError('Too many wrong PINs — locked for 30 seconds.'); }
      else authError('Incorrect access PIN for ' + user.full_name + '.');
      return false;
    }
    loginAttempts = 0;

    const nowStr = nowStamp();
    const ua = navigator.userAgent || '';
    const devLabel = /iPhone|iPad/i.test(ua) ? 'iOS Safari' : (/Android/i.test(ua) ? 'Android Chrome' : (/Edg\//.test(ua) ? 'Desktop Edge' : 'Desktop Browser'));
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    user.last_login_at = nowStr.slice(0, 16);
    STATE.activeUserIdx = idx;
    localStorage.setItem('isabi_mfg_active_email', user.email);
    STATE.sessions.unshift({ id: uid('sess'), full_name: user.full_name, email: user.email, role: user.role, companies: user.companies, device: devLabel + (standalone ? ' · Home Screen app' : ''), logged_in_at: nowStr });
    STATE.sessions = STATE.sessions.slice(0, 50);
    saveLocalAuthAndRecords();

    if (HAS_LOCAL_API) {
      try { await fetch('./api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email, pin, device: devLabel }) }); } catch (_) { /* no server.py */ }
    }

    closeAuthGate();
    if (!getAllowedCompanyKeys(user).includes(STATE.company)) STATE.company = getAllowedCompanyKeys(user)[0];
    if (!canViewView(STATE.view, user)) STATE.view = defaultViewFor(user);
    STATE.search = '';
    STATE.showAddUserForm = false;
    renderApp();
    toast(`Signed in as ${user.full_name} · ${String(user.companies).replace(/BBConstruction/g, 'BBC')}`);
    syncWithCloud(true);
    return true;
  }

  // ==========================================================================
  // ASK ISABI COPILOT ANSWERS (DATA-DRIVEN, WORD-BOUNDARY INTENTS)
  // ==========================================================================
  function answerAskIsabi(qRaw) {
    const q = ' ' + String(qRaw || '').toLowerCase() + ' ';
    const has = re => re.test(q);
    const g = (SEED.models['manufacturing-group'] || {}).periods || {};
    const gk = g[STATE.period] || g.all || {};
    const w = ((SEED.models.wtc || {}).periods || {})[STATE.period] || ((SEED.models.wtc || {}).periods || {}).all || {};
    const b = ((SEED.models.bbconstruction || {}).periods || {})[STATE.period] || ((SEED.models.bbconstruction || {}).periods || {}).all || {};
    const scope = `${COMPANY_LABELS[STATE.company].split('(')[0].trim()} · ${gk.label || 'All-Time'}`;
    const k = getKPI();
    const { fleet, pricing } = sentinelSlice();

    if (has(/\b(margin|gm|p&l|profit|compare|revenue|bbconstruction|wtc)\b/)) {
      return `<strong>P&amp;L — WTC vs BBConstruction (${esc(gk.label || 'All-Time')}):</strong><br>
        • <strong>WTC</strong>: Sales TTC ${fmtUSD(w.sales_ttc, 0)} on ${fmtNum(w.loads)} loads · net ${fmtUSD(w.net_sales, 0)} · raw cost ${fmtUSD(w.raw_cost, 0)} (${fmtNum(w.raw_loads)} loads) · gross margin ${fmtUSD(w.gross_margin, 0)} (<strong>${fmtPct(w.gm_pct, w.gross_margin, w.net_sales)}</strong>) · operating cash profit <strong>${fmtUSD(w.operating_profit, 0)}</strong> (${fmtPct(w.op_margin_pct, w.operating_profit, w.net_sales)}).<br>
        • <strong>BBConstruction</strong>: Sales TTC ${fmtUSD(b.sales_ttc, 0)} on ${fmtNum(b.loads)} loads · net ${fmtUSD(b.net_sales, 0)} · raw cost ${fmtUSD(b.raw_cost, 0)} (${fmtNum(b.raw_loads)} loads) · gross margin ${fmtUSD(b.gross_margin, 0)} (<strong>${fmtPct(b.gm_pct, b.gross_margin, b.net_sales)}</strong>) · operating cash profit <strong>${fmtUSD(b.operating_profit, 0)}</strong> (${fmtPct(b.op_margin_pct, b.operating_profit, b.net_sales)}).<br>
        • BBConstruction's higher GM comes from more own / JV pit material (lower third-party quarry royalties); its operating margin is thinner because expenses and payroll weigh more against a smaller top line.`;
    }
    if (has(/\b(ar|overdue|receivable|receivables|customer|customers|credit hold|dso)\b/)) {
      const topC = ((SEED.models[STATE.company] || SEED.models['manufacturing-group'] || {}).customers || []).slice(0, 5).map(c => `${esc(c.Customer)} (${fmtUSD(c.ar_balance, 0)}${Number(c.ar_60_plus || 0) > 0 ? ', ' + fmtUSD(c.ar_60_plus, 0) + ' past 60d' : ''})`).join(', ');
      return `<strong>FIFO Accounts Receivable — ${esc(scope)}:</strong><br>
        • Open AR <strong>${fmtUSD(k.ar_balance, 2)}</strong> (WTC ${fmtUSD(w.ar_balance, 2)} · BBConstruction ${fmtUSD(b.ar_balance, 2)}) · overdue &gt;30d ${fmtUSD(k.ar_overdue, 0)} · past 60 days <strong>${fmtUSD(k.ar_60_plus, 0)}</strong> · DSO ${fmtNum(k.dso_days, 0)} days.<br>
        • Aging: current ${fmtUSD(k.ar_current, 0)} · 1–10d ${fmtUSD(k.ar_1_10, 0)} · 11–30d ${fmtUSD(k.ar_11_30, 0)} · 31–60d ${fmtUSD(k.ar_31_60, 0)} · 60+ ${fmtUSD(k.ar_60_plus, 0)}. VAT-registered customers carry 11% inside their balance (m249).<br>
        • Largest balances: ${topC || '—'}. Credit hold candidates = anything past 60 days with no receipt this month.`;
    }
    if (has(/\b(ap|leg|legs|quarry|quarries|supplier|suppliers|hauler|payable|payables)\b/)) {
      return `<strong>3-Leg Accounts Payable (m192) — ${esc(scope)}:</strong><br>
        1. <strong>Material leg ${fmtUSD(k.ap_material, 0)}</strong> owed to quarry site owners.<br>
        2. <strong>Haulage leg ${fmtUSD(k.ap_haulage, 0)}</strong> owed to truck owners ($0 on company-fleet loads).<br>
        3. <strong>Supplies &amp; services leg ${fmtUSD(k.ap_expense, 0)}</strong> from credit expenses.<br>
        Settlements paid ${fmtUSD(k.settlements_paid, 0)} · net open AP <strong>${fmtUSD(k.ap_balance, 0)}</strong>${Number(k.ap_balance || 0) < 0 ? ' (negative = prepayments / advances exceed open legs)' : ''}.`;
    }
    if (has(/\b(diesel|tank|fuel|litre|litres|consumption)\b/)) {
      const wf = (((SEED.sentinels.fleet_fuel_overtime_auditor || {}).by_model) || {}).WTC || {};
      const bf = (((SEED.sentinels.fleet_fuel_overtime_auditor || {}).by_model) || {}).BBConstruction || {};
      return `<strong>Diesel Tank &amp; Fuel Reconciliation:</strong><br>
        • <strong>WTC</strong>: purchased ${fmtNum(wf.diesel_purchased_l, 0)} L − issued ${fmtNum(wf.diesel_issued_l, 0)} L − sold → <code class="mono">${fmtNum(wf.diesel_stock_balance_l, 0)} L</code> in tank.<br>
        • <strong>BBConstruction</strong>: purchased ${fmtNum(bf.diesel_purchased_l, 0)} L − issued ${fmtNum(bf.diesel_issued_l, 0)} L − sold → <code class="mono">${fmtNum(bf.diesel_stock_balance_l, 0)} L</code> — negative because bulk diesel invoices were booked under General Expenses instead of Fuel Purchases; new BBConstruction diesel intakes are refused until the history is corrected (m212).<br>
        • Period issued ${fmtNum(k.diesel_litres, 0)} L · fleet cost per ton hauled ${fmtUSD(k.cost_per_ton, 2)} · ${fmtNum((fleet.consumption_outliers || []).length)} consumption outliers flagged by m142.`;
    }
    if (has(/\b(trial|balance|coa|ledger|gl|tie|tied)\b/)) {
      const tb = Number(k.tb_check || 0);
      return `<strong>Lebanese CoA Double-Entry Trial Balance — ${esc(scope)}:</strong><br>
        • Variance <strong>${fmtUSD(tb, 2)}</strong> ${Math.abs(tb) < 0.005 ? '— every SOA journal leg across Class 4 (receivables / payables / VAT), Class 5 (till 5300), Class 6 (raw material, haulage, payroll, expenses) and Class 7 (sales) ties.' : '— open the General Ledger and the Sentinels page: the books do not tie for this scope.'}<br>
        • Output VAT 11% ${fmtUSD(k.sales_vat, 2)} · VAT receivable ${fmtUSD(k.vat_receivable, 2)} · cash till ${fmtUSD(k.cash_till, 2)}.`;
    }
    if (has(/\b(price|prices|pricing|agreement|agreements|below|commission)\b/)) {
      return `<strong>Price Agreements — ${esc(scope)}:</strong><br>
        • ${fmtNum(pricing.active_agreements || k.active_agreements)} active agreements · ${fmtUSD(pricing.sales_below_agreed_usd || 0, 0)} sold below the agreed price across ${fmtNum(pricing.below_agreed_pairs_count || 0)} customer × product pairs · ${fmtNum(pricing.lapsed_agreement_pairs_count || 0)} pairs trading on lapsed agreements.<br>
        • Weighted agreed price ${fmtUSD(pricing.weighted_agreed_price_usd || 0, 2)} vs actual average ${fmtUSD(pricing.actual_avg_price_usd || 0, 2)} · commission due ${fmtUSD(k.commission_due, 0)}.`;
    }
    if (has(/\b(overtime|driver|drivers|payroll|salary|salaries)\b/)) {
      return `<strong>Workforce — ${esc(scope)}:</strong><br>
        • Salaries paid ${fmtUSD(k.salaries_paid, 0)} · overtime bonus due ${fmtUSD(k.overtime_bonus, 0)} (sales ${fmtUSD(fleet.sales_overtime_bonus_usd || 0, 0)} + raw ${fmtUSD(fleet.raw_overtime_bonus_usd || 0, 0)} all-time) · ${fmtUSD(pricing.unmatched_salary_payments_usd || 0, 0)} paid without a contract.<br>
        • Overtime = a company-fleet load dispatched outside the 06:00–17:59 day shift (m48 / m93); third-party loads never earn the allowance.`;
    }
    if (has(/\b(license|licence|licenses|save|savings|cost|option 3|architecture|seat|seats)\b/)) {
      const n = STATE.users.length;
      return `<strong>Option 3 Multi-Device Cloud &amp; SQL Economics:</strong><br>
        • ${n} team seats run on the BHFIRMS cloud relay (<code class="mono">${esc(CLOUD_DOC_KEY)}</code>) + optional local SQLite (<code class="mono">data/mfg.db</code>) + PostgreSQL schema (<code class="mono">data/schema_postgres.sql</code>).<br>
        • Versus Dataverse + Power BI PPU at about $37 / seat / month that is <strong>${fmtUSD(n * 37 * 12, 0)} / year</strong> saved at the current seat count.`;
    }
    return `<strong>${esc(scope)} at a glance:</strong><br>
      • Revenue (TTC) <strong>${fmtUSD(k.sales_ttc, 2)}</strong> across <strong>${fmtNum(k.loads)} loads</strong> (${fmtNum(k.tons_sold, 0)} t) · gross margin ${fmtUSD(k.gross_margin, 0)} · operating cash profit ${fmtUSD(k.operating_profit, 0)}.<br>
      • Open AR ${fmtUSD(k.ar_balance, 0)} · open AP ${fmtUSD(k.ap_balance, 0)} · till ${fmtUSD(k.cash_till, 2)} · diesel in tank ${fmtNum(k.diesel_in_tank, 0)} L.<br>
      Ask about <em>margin</em>, <em>AR</em>, <em>AP legs</em>, <em>diesel</em>, <em>trial balance</em>, <em>pricing</em>, <em>overtime</em> or <em>licenses</em>.`;
  }

  // ==========================================================================
  // MASTER RENDER & EVENT WIRING
  // ==========================================================================
  let searchTimer = null;

  function contextFormForView(view, user) {
    user = user || activeUser();
    const map = { sales: 'sales', raw: 'raw', fleet: 'fuel', pricing: 'pricerule', customers: 'receipt', ar: 'receipt', suppliers: 'settlement', ap: 'settlement', expenses: 'expense', tables: 'pricerule' };
    const preferred = map[view] || 'sales';
    if (canEnterForm(preferred, user)) return preferred;
    if (canEnterForm('sales', user)) return 'sales';
    if (canEnterForm('receipt', user)) return 'receipt';
    return 'sales';
  }

  function renderMobileSubnav(user, k, sentinelsOpen) {
    const el = $('mobileSubnav');
    if (!el) return;
    const v = STATE.view;
    let group = 'exec';
    if (['sales', 'raw', 'fleet', 'pricing'].includes(v)) group = 'dispatch';
    else if (['customers', 'ar', 'suppliers', 'ap', 'expenses', 'ledger', 'gl'].includes(v)) group = 'books';

    const specs = {
      exec: [
        { view: 'overview', label: 'Overview', pill: 'Live' },
        { view: 'pbi', label: 'Power BI', pill: '20' },
        { view: 'tables', label: '34 Tables', pill: '34' },
        { view: 'sentinels', label: 'Sentinels', pill: String(sentinelsOpen) },
        { view: 'statements', label: 'Statements', pill: '22' },
        { view: 'users', label: 'Team', pill: String(STATE.users.length) }
      ],
      dispatch: [
        { view: 'sales', label: 'Sales', pill: k.loads != null ? fmtNum(k.loads) : '' },
        { view: 'raw', label: 'Quarries', pill: k.raw_loads != null ? fmtNum(k.raw_loads) : '' },
        { view: 'fleet', label: 'Fleet', pill: k.active_equip != null ? fmtNum(k.active_equip) : '' },
        { view: 'pricing', label: 'Pricing', pill: k.active_agreements != null ? fmtNum(k.active_agreements) : '' }
      ],
      books: [
        { view: 'customers', match: ['customers', 'ar'], label: 'AR Aging', pill: k.ar_balance != null ? fmtUSDk(k.ar_balance) : '' },
        { view: 'suppliers', match: ['suppliers', 'ap'], label: 'AP 3-Leg', pill: k.ap_balance != null ? fmtUSDk(k.ap_balance) : '' },
        { view: 'expenses', label: 'Expenses', pill: k.expenses != null ? fmtUSDk(k.expenses) : '' },
        { view: 'ledger', match: ['ledger', 'gl'], label: 'GL & SOA', pill: k.tb_check != null && Math.abs(Number(k.tb_check)) < 0.005 ? '$0' : '' }
      ]
    };

    const items = (specs[group] || specs.exec).filter(it => canViewView(it.view, user));
    el.innerHTML = items.map(it => {
      const on = (it.match || [it.view]).includes(v);
      return `<button type="button" class="m-subnav-pill${on ? ' on' : ''}" data-subnav-view="${esc(it.view)}"><span>${esc(it.label)}</span>${it.pill ? `<em>${esc(it.pill)}</em>` : ''}</button>`;
    }).join('');
    el.querySelectorAll('[data-subnav-view]').forEach(btn => btn.addEventListener('click', () => setView(btn.getAttribute('data-subnav-view'))));

    // Sync Mobile Bottom Dock active states
    const dOver = $('dockBtnOverview'), dDisp = $('dockBtnDispatch'), dBooks = $('dockBtnBooks'), dEntry = $('mobileDockEntryBtn'), dEntryLbl = $('mobileDockEntryLabel');
    if (dOver) dOver.classList.toggle('on', group === 'exec');
    if (dDisp) dDisp.classList.toggle('on', group === 'dispatch');
    if (dBooks) dBooks.classList.toggle('on', group === 'books');
    if (dEntry && dEntryLbl) {
      if (canEnterAny(user)) {
        dEntry.hidden = false;
        const formLabels = { sales: 'Post Ticket', raw: 'Post Raw', fuel: 'Log Fuel', receipt: 'Post Receipt', settlement: 'Settle AP', expense: 'Post Expense' };
        dEntryLbl.textContent = formLabels[contextFormForView(v, user)] || 'Post Entry';
      } else {
        dEntry.hidden = true;
      }
    }
  }

  function renderApp() {
    document.documentElement.setAttribute('data-theme', STATE.theme);
    const themeBtn = $('themeToggleBtn');
    if (themeBtn) themeBtn.textContent = STATE.theme === 'dark' ? 'Light' : 'Dark';
    const mThemeBtn = $('mobileThemeBtn');
    if (mThemeBtn) mThemeBtn.textContent = STATE.theme === 'dark' ? '☀' : '☾';
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', STATE.theme === 'dark' ? '#0E1A2E' : '#F4F2EE');

    applyUserRlsAndPermissions();
    const user = activeUser();
    const k = getKPI();

    const eyeEl = $('topbarEyebrow');
    const titEl = $('topbarTitle');
    const isMobileViewport = typeof window !== 'undefined' && window.innerWidth <= 860;
    if (eyeEl) {
      eyeEl.textContent = isMobileViewport
        ? `${COMPANY_MOBILE_LABELS[STATE.company] || COMPANY_LABELS[STATE.company]} · ${STATE.basis === 'rep' ? 'Rep Date' : 'Tx Date'}`
        : `${COMPANY_LABELS[STATE.company]} · ${k.label || 'All-Time'} · ${STATE.basis === 'rep' ? 'Reporting Date Basis' : 'Transaction Date Basis'}`;
    }
    if (titEl) {
      titEl.textContent = isMobileViewport
        ? (VIEW_MOBILE_TITLES[STATE.view] || VIEW_TITLES[STATE.view] || VIEW_MOBILE_TITLES.overview)
        : (VIEW_TITLES[STATE.view] || VIEW_TITLES.overview);
    }
    document.title = `${(VIEW_TITLES[STATE.view] || 'Overview').split('&')[0].trim()} · ISABI Mfg`;

    const aiScope = $('aiDrawerScope');
    if (aiScope) aiScope.textContent = `${COMPANY_LABELS[STATE.company].split('(')[0].trim()} · USD · ${k.label || 'All-Time'}`;

    document.querySelectorAll('#sidebarNav .nav-item').forEach(btn => {
      const v = btn.getAttribute('data-view');
      const isMatch = v === STATE.view || (v === 'customers' && STATE.view === 'ar') || (v === 'suppliers' && STATE.view === 'ap') || (v === 'ledger' && STATE.view === 'gl');
      btn.classList.toggle('on', isMatch);
    });
    document.querySelectorAll('#companySwitch .entity-btn').forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-company') === STATE.company));
    document.querySelectorAll('#basisSwitch .basis-btn').forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-basis') === STATE.basis));
    const periodSel = $('periodSelect');
    if (periodSel && periodSel.value !== STATE.period) periodSel.value = STATE.period;

    // Rail badges follow the active scope
    const setPill = (id, text) => { const el = $(id); if (el) el.textContent = text; };
    const sentinelsOpen = buildSentinelItems().filter(s => s.severity !== 'ok').length;
    setPill('navCountSales', k.loads != null ? fmtNum(k.loads) : '—');
    setPill('navCountRaw', k.raw_loads != null ? fmtNum(k.raw_loads) : '—');
    setPill('navCountFleet', k.active_equip != null ? fmtNum(k.active_equip) : fmtNum(SEED.records.equipment.length));
    setPill('navCountPricing', k.active_agreements != null ? fmtNum(k.active_agreements) : '—');
    setPill('navCountAR', k.ar_balance != null ? fmtUSDk(k.ar_balance) : '—');
    setPill('navCountAP', k.ap_balance != null ? fmtUSDk(k.ap_balance) : '3 Legs');
    setPill('navCountExp', k.expenses != null ? fmtUSDk(k.expenses) : '—');
    setPill('navCountSentinels', String(sentinelsOpen));
    setPill('navCountUsers', `${STATE.users.length} Seats`);
    const tbPill = $('navCountTB');
    if (tbPill) { const tb = Number(k.tb_check); tbPill.textContent = k.tb_check == null ? 'TB —' : (Math.abs(tb) < 0.005 ? 'TB $0' : 'TB ' + fmtUSDk(tb)); tbPill.className = 'nav-pill ' + (k.tb_check == null ? '' : (Math.abs(tb) < 0.005 ? 'good' : 'brass')); }
    const snPill = $('navCountSentinels');
    if (snPill) snPill.className = 'nav-pill ' + (sentinelsOpen ? 'brass' : 'good');

    renderMobileSubnav(user, k, sentinelsOpen);

    const container = $('workspace');
    if (!container) return;

    switch (STATE.view) {
      case 'overview': container.innerHTML = renderOverview(); break;
      case 'pbi': container.innerHTML = window.MFG_PBI ? window.MFG_PBI.renderPbiStudio({ STATE, SEED, COMPANY_LABELS, STATEMENT_CATALOG, getModel, getKPI, filterRecords, buildSentinelItems, exportBtn }) : renderOverview(); break;
      case 'tables': container.innerHTML = window.MFG_PBI ? window.MFG_PBI.renderTablesHub({ STATE, SEED, filterRecords, sortRows, th, shownCount, showMoreRow, emptyRow, exportBtn, searchBox, appCell, canEnterForm }) : renderOverview(); break;
      case 'sentinels': container.innerHTML = renderSentinels(); break;
      case 'sales': container.innerHTML = renderSales(); break;
      case 'raw': container.innerHTML = renderRaw(); break;
      case 'fleet': container.innerHTML = renderFleet(); break;
      case 'pricing': container.innerHTML = renderPricing(); break;
      case 'customers':
      case 'ar': container.innerHTML = renderAR(); break;
      case 'suppliers':
      case 'ap': container.innerHTML = renderAP(); break;
      case 'expenses': container.innerHTML = renderExpenses(); break;
      case 'ledger':
      case 'gl': container.innerHTML = renderGL(); break;
      case 'statements': container.innerHTML = renderStatements(); break;
      case 'users': container.innerHTML = renderUsers(); break;
      default: container.innerHTML = renderOverview();
    }
    wireWorkspace(container, user);
  }

  function wireWorkspace(container, activeUserRow) {
    // Power BI Studio 20-page tabs & slicers + 34-table hub chips
    container.querySelectorAll('[data-pbi-page]').forEach(btn => btn.addEventListener('click', () => {
      STATE.pbiPage = btn.getAttribute('data-pbi-page');
      renderApp();
    }));
    const pbiReset = $('pbiResetSlicersBtn');
    if (pbiReset) pbiReset.addEventListener('click', () => {
      STATE.pbiSlicer = { product: '', customer: '', supplier: '', site: '', method: '', saleType: '', search: '' };
      renderApp();
    });
    const slicerMap = [
      ['pbiSlicerProduct', 'product'], ['pbiSlicerCustomer', 'customer'], ['pbiSlicerSupplier', 'supplier'],
      ['pbiSlicerSite', 'site'], ['pbiSlicerSaleType', 'saleType'], ['pbiSlicerMethod', 'method']
    ];
    slicerMap.forEach(([id, key]) => {
      const el = $(id);
      if (el) el.addEventListener('change', e => { STATE.pbiSlicer[key] = e.target.value; renderApp(); });
    });
    const pbiSearch = $('pbiSlicerSearch');
    if (pbiSearch) {
      pbiSearch.addEventListener('input', e => {
        STATE.pbiSlicer.search = e.target.value;
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          const pos = e.target.selectionStart;
          renderApp();
          const next = $('pbiSlicerSearch');
          if (next) { next.focus(); try { next.setSelectionRange(pos, pos); } catch (_) {} }
        }, 160);
      });
    }
    container.querySelectorAll('[data-table-key]').forEach(btn => btn.addEventListener('click', () => {
      STATE.activeTableKey = btn.getAttribute('data-table-key');
      STATE.search = '';
      STATE.shown = {};
      renderApp();
    }));
    // Chart hover & mobile tap tooltip
    const chartWrap = $('execChartWrap');
    const chartTip = $('execChartTip');
    if (chartWrap && chartTip) {
      const showTip = (col, clientX, clientY) => {
        chartTip.innerHTML = `<strong>${esc(col.getAttribute('data-m') || '')} · ${esc(col.getAttribute('data-t') || '')}</strong><br>${esc(col.getAttribute('data-tip') || '')}`;
        chartTip.hidden = false;
        const rect = chartWrap.getBoundingClientRect();
        const tipW = Math.min(260, rect.width - 16);
        const x = clientX != null ? (clientX - rect.left - tipW / 2) : 10;
        const y = clientY != null ? (clientY - rect.top - 58) : 8;
        chartTip.style.left = Math.min(Math.max(8, rect.width - tipW - 8), Math.max(8, x)) + 'px';
        chartTip.style.top = Math.max(6, y) + 'px';
      };
      chartWrap.querySelectorAll('.col').forEach(col => {
        col.addEventListener('mouseenter', e => showTip(col, e.clientX, e.clientY));
        col.addEventListener('mousemove', e => showTip(col, e.clientX, e.clientY));
        col.addEventListener('mouseleave', () => { chartTip.hidden = true; });
        col.addEventListener('click', e => {
          e.stopPropagation();
          const b = col.getBoundingClientRect();
          showTip(col, b.left + b.width / 2, b.top);
        });
      });
    }

    // Search: debounce, re-render, keep the caret (never re-render while a sync tick lands mid-typing)
    const searchEl = $('tableSearchInput');
    if (searchEl) {
      searchEl.addEventListener('input', e => {
        STATE.search = e.target.value;
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          const pos = e.target.selectionStart;
          STATE.shown = {};
          renderApp();
          const next = $('tableSearchInput');
          if (next) { next.focus(); try { next.setSelectionRange(pos, pos); } catch (_) { /* type=search on some browsers */ } }
        }, 160);
      });
      searchEl.addEventListener('blur', () => { if (STATE.renderPending) { STATE.renderPending = false; renderApp(); } });
    }

    container.querySelectorAll('[data-chip]').forEach(btn => btn.addEventListener('click', () => { STATE.chipFilter = btn.getAttribute('data-chip'); STATE.shown = {}; renderApp(); }));
    container.querySelectorAll('[data-jump-co]').forEach(row => row.addEventListener('click', () => {
      const targetCo = row.getAttribute('data-jump-co');
      if (getAllowedCompanyKeys(activeUserRow).includes(targetCo)) { STATE.company = targetCo; renderApp(); }
      else toast('Your seat is not scoped to that entity', 'err');
    }));
    container.querySelectorAll('[data-nav-jump]').forEach(btn => btn.addEventListener('click', () => {
      const stmt = btn.getAttribute('data-stmt-jump');
      if (stmt) STATE.activeStatement = stmt;
      setView(btn.getAttribute('data-nav-jump'));
    }));
    container.querySelectorAll('[data-open-modal]').forEach(btn => btn.addEventListener('click', () => openEntryModal(btn.getAttribute('data-open-modal'))));
    container.querySelectorAll('[data-stmt]').forEach(card => {
      const go = () => {
        STATE.activeStatement = card.getAttribute('data-stmt');
        renderApp();
        const sheet = $('printableSheet');
        if (sheet) sheet.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      card.addEventListener('click', go);
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    const stmtSel = $('stmtQuickSelect');
    if (stmtSel) stmtSel.addEventListener('change', e => {
      STATE.activeStatement = e.target.value;
      renderApp();
    });
    container.querySelectorAll('th.sortable').forEach(h => h.addEventListener('click', () => {
      const view = h.getAttribute('data-sort-view'), key = h.getAttribute('data-sort-key');
      const cur = STATE.sortBy[view] || {};
      STATE.sortBy[view] = { key, dir: cur.key === key && cur.dir === 'desc' ? 'asc' : (cur.key === key ? 'desc' : (['date', 'start_date', 'name', 'Code', 'Customer', 'Supplier', 'Site', 'Equipment', 'customer', 'supplier', 'staff', 'payroll_month'].includes(key) && !/^(date|start_date)$/.test(key) ? 'asc' : 'desc')) };
      renderApp();
    }));
    container.querySelectorAll('[data-show-more]').forEach(btn => btn.addEventListener('click', () => {
      const v = btn.getAttribute('data-show-more');
      STATE.shown[v] = shownCount(v) + PAGE;
      const ws = $('workspace');
      const y = ws ? ws.scrollTop : 0;
      renderApp();
      if (ws) ws.scrollTop = y;
    }));
    container.querySelectorAll('[data-export-csv]').forEach(btn => btn.addEventListener('click', () => {
      const panel = $(btn.getAttribute('data-export-csv'));
      const tables = panel ? Array.from(panel.querySelectorAll('table')) : [];
      if (!tables.length) { toast('Nothing to export', 'err'); return; }
      const csv = tables.map(tableToCsv).join('\r\n\r\n');
      downloadCsv(`ISABI_MFG_${btn.getAttribute('data-export-name') || 'export'}_${STATE.company}_${STATE.period}_${todayISO()}.csv`, csv);
      toast('CSV downloaded');
    }));
    container.querySelectorAll('[data-void]').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      if (btn.dataset.armed === '1') { voidRecord(btn.getAttribute('data-void'), btn.getAttribute('data-void-id')); return; }
      btn.dataset.armed = '1';
      btn.textContent = 'Void?';
      btn.classList.add('armed');
      setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ''; btn.textContent = '✕'; btn.classList.remove('armed'); } }, 4000);
    }));

    const printBtn = $('printStmtBtn');
    if (printBtn) printBtn.addEventListener('click', () => window.print());
    const csvBtn = $('exportCsvBtn');
    if (csvBtn) csvBtn.addEventListener('click', () => {
      const sheet = $('printableSheet');
      const tables = sheet ? Array.from(sheet.querySelectorAll('table')) : [];
      if (!tables.length) { toast('Nothing to export', 'err'); return; }
      const title = (STATEMENT_CATALOG.find(s => s.code === STATE.activeStatement) || {}).name || 'Statement';
      downloadCsv(`ISABI_MFG_Statement_${STATE.activeStatement}_${STATE.company}_${STATE.period}.csv`, `"${title}","${COMPANY_LABELS[STATE.company]}","${(getKPI().label || 'All-Time')}"\r\n\r\n` + tables.map(tableToCsv).join('\r\n\r\n'));
      toast('Statement CSV downloaded');
    });

    // Users view (owner tools)
    container.querySelectorAll('[data-sim-user]').forEach(btn => btn.addEventListener('click', () => {
      if (!isOwner()) return;
      const u = STATE.users[Number(btn.getAttribute('data-sim-user'))];
      if (u) performLogin(u.email, u.pin_code || '1111');
    }));
    container.querySelectorAll('[data-invite-user]').forEach(btn => btn.addEventListener('click', () => {
      if (!isOwner()) return;
      const u = STATE.users[Number(btn.getAttribute('data-invite-user'))];
      if (!u) return;
      const inviteUrl = `${location.origin}${location.pathname}?email=${encodeURIComponent(u.email)}&pin=${encodeURIComponent(u.pin_code || '1111')}`;
      const done = () => { btn.textContent = '✓ Copied Link!'; setTimeout(() => { btn.textContent = '🔗 Invite Link'; }, 2000); toast('Invite link copied — it carries the PIN, share it privately'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(inviteUrl).then(done).catch(() => { window.prompt('Copy this invite link:', inviteUrl); });
      else window.prompt('Copy this invite link:', inviteUrl);
    }));
    container.querySelectorAll('[data-toggle-user]').forEach(btn => btn.addEventListener('click', async () => {
      if (!isOwner()) return;
      const idx = Number(btn.getAttribute('data-toggle-user'));
      const u = STATE.users[idx];
      if (!u) return;
      if (idx === STATE.activeUserIdx) { toast('You cannot suspend your own seat', 'err'); return; }
      u.status = u.status === 'Suspended' ? 'Active' : 'Suspended';
      saveLocalAuthAndRecords();
      renderApp();
      if (HAS_LOCAL_API) { try { await fetch('./api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: u }) }); } catch (_) { /* no server.py */ } }
      syncWithCloud(true);
      toast(`${u.full_name} ${u.status === 'Suspended' ? 'suspended' : 're-activated'}`);
    }));

    const addUserBtn = $('addWebUserBtn');
    if (addUserBtn) addUserBtn.addEventListener('click', () => { STATE.showAddUserForm = true; renderApp(); setTimeout(() => { const n = $('nu_name'); if (n) n.focus(); }, 50); });
    const cancelAddUserBtn = $('cancelAddUserBtn');
    if (cancelAddUserBtn) cancelAddUserBtn.addEventListener('click', () => { STATE.showAddUserForm = false; renderApp(); });

    const saveNewUserBtn = $('saveNewUserBtn');
    if (saveNewUserBtn) saveNewUserBtn.addEventListener('click', async () => {
      if (!isOwner()) return;
      const name = val('nu_name');
      const email = norm(val('nu_email'));
      const pin = val('nu_pin');
      const role = val('nu_role') || 'Entry';
      const companies = val('nu_companies') || 'WTC';
      const acc = (val('nu_access') || 'partial|partial').split('|');
      const errs = [];
      if (!name) errs.push('Full name is required.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.push('Enter a valid email address.');
      if (!/^\d{4,8}$/.test(pin)) errs.push('PIN must be 4 to 8 digits.');
      const box = $('nuErrors');
      if (box) { box.hidden = !errs.length; box.innerHTML = errs.length ? `<ul>${errs.map(e => `<li>${esc(e)}</li>`).join('')}</ul>` : ''; }
      if (errs.length) return;

      const existingIdx = STATE.users.findIndex(x => norm(x.email) === email);
      const newUser = { id: existingIdx >= 0 ? STATE.users[existingIdx].id : uid('u'), full_name: name, email, pin_code: pin, role, companies, pbi_access: acc[0] || 'partial', statements_access: acc[1] || 'partial', status: 'Active', last_login_at: existingIdx >= 0 ? STATE.users[existingIdx].last_login_at : '' };
      if (existingIdx >= 0) STATE.users[existingIdx] = Object.assign(STATE.users[existingIdx], newUser);
      else STATE.users.push(newUser);
      STATE.showAddUserForm = false;
      saveLocalAuthAndRecords();
      renderApp();
      toast(existingIdx >= 0 ? `Seat updated · ${name}` : `Seat created · ${name} (PIN ${pin})`);
      if (HAS_LOCAL_API) { try { await fetch('./api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: newUser }) }); } catch (_) { /* no server.py */ } }
      await syncWithCloud(true);
    });

    const syncNowBtn = $('syncCloudNowBtn');
    if (syncNowBtn) syncNowBtn.addEventListener('click', async () => {
      syncNowBtn.textContent = '↻ Syncing...';
      syncNowBtn.disabled = true;
      await syncWithCloud(true);
      const b = $('syncCloudNowBtn');
      if (b) { b.disabled = false; b.textContent = /Live/.test(STATE.cloudStatus) ? '✓ Cloud Synced' : '⚠ ' + STATE.cloudStatus.replace('● ', ''); setTimeout(() => { if (b.isConnected) b.textContent = '↻ Sync Cloud Now'; }, 2200); }
      renderApp();
    });

    const saveSbBtn = $('saveSbCfgBtn');
    if (saveSbBtn) saveSbBtn.addEventListener('click', () => {
      STATE.supabaseCfg = { url: val('sb_url'), anonKey: val('sb_key') };
      localStorage.setItem('isabi_mfg_supabase_cfg', JSON.stringify(STATE.supabaseCfg));
      saveSbBtn.textContent = '✓ Saved';
      setTimeout(() => { if (saveSbBtn.isConnected) saveSbBtn.textContent = 'Save'; }, 1500);
    });
  }

  function setView(view, opts = {}) {
    if (!VIEW_TITLES[view]) view = 'overview';
    if (!canViewView(view)) { toast('Your seat has no access to that module', 'err'); view = defaultViewFor(); }
    STATE.view = view;
    if (opts.reset !== false) { STATE.search = ''; STATE.chipFilter = 'all'; STATE.shown = {}; }
    if (!opts.noPush) {
      const h = '#' + view;
      if (location.hash !== h) history.pushState({ view }, '', h);
    }
    const sidebar = $('sidebar');
    if (sidebar) sidebar.classList.remove('open');
    const bd = $('railBackdrop');
    if (bd) bd.hidden = true;
    renderApp();
    const ws = $('workspace');
    if (ws) ws.scrollTop = 0;
  }

  // Global Event Listeners
  function init() {
    applyCustomRecordsToSeed();

    const inviteEmail = PARAMS.get('email');
    const invitePin = PARAMS.get('pin');
    const savedEmail = localStorage.getItem('isabi_mfg_active_email');
    const wantsLogin = PARAMS.get('login') === '1' || location.hash === '#login';
    const qView = PARAMS.get('view') || (location.hash || '').replace(/^#/, '');
    if (qView && VIEW_TITLES[qView]) STATE.view = qView;
    // Keep harmless flags (demo, reset) but strip credentials / one-shot params from the address bar
    const keep = new URLSearchParams();
    ['demo', 'nosse'].forEach(p => { if (PARAMS.has(p)) keep.set(p, PARAMS.get(p)); });
    const cleanUrl = location.pathname + (keep.toString() ? '?' + keep.toString() : '') + (VIEW_TITLES[STATE.view] ? '#' + STATE.view : '');

    const savedIdx = savedEmail ? STATE.users.findIndex(u => norm(u.email) === norm(savedEmail)) : -1;
    if (inviteEmail && invitePin) {
      history.replaceState({ view: STATE.view }, '', cleanUrl); // never leave the PIN in the address bar / history
      performLogin(inviteEmail, invitePin).then(ok => { if (!ok) openAuthGate(inviteEmail); });
    } else if (wantsLogin) {
      history.replaceState({ view: STATE.view }, '', cleanUrl);
      openAuthGate(savedIdx >= 0 ? STATE.users[savedIdx].email : '');
    } else if (savedIdx >= 0 && STATE.users[savedIdx].status !== 'Suspended') {
      STATE.activeUserIdx = savedIdx;
      closeAuthGate();
    } else {
      openAuthGate(inviteEmail || '');
    }
    if (!history.state) history.replaceState({ view: STATE.view }, '', cleanUrl);

    const signOutBtn = $('signOutBtn');
    if (signOutBtn) signOutBtn.addEventListener('click', signOut);

    const authForm = $('authLoginForm');
    if (authForm) authForm.addEventListener('submit', e => { e.preventDefault(); performLogin(val('authEmailInput'), val('authPinInput')); });

    const mobileMenuBtn = $('mobileMenuBtn');
    const mobileDockMenuBtn = $('mobileDockMenuBtn');
    const sidebar = $('sidebar');
    const backdrop = $('railBackdrop');
    const toggleRail = () => { if (!sidebar) return; const open = !sidebar.classList.contains('open'); sidebar.classList.toggle('open', open); if (backdrop) backdrop.hidden = !open; };
    const closeRail = () => { if (sidebar) sidebar.classList.remove('open'); if (backdrop) backdrop.hidden = true; };
    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleRail);
    if (mobileDockMenuBtn) mobileDockMenuBtn.addEventListener('click', toggleRail);
    if (backdrop) backdrop.addEventListener('click', closeRail);

    document.querySelectorAll('#sidebarNav .nav-item').forEach(btn => btn.addEventListener('click', () => setView(btn.getAttribute('data-view'))));
    document.querySelectorAll('#mobileBottomDock [data-dock-view]').forEach(btn => btn.addEventListener('click', () => setView(btn.getAttribute('data-dock-view'))));
    const brand = $('brandHomeLink');
    if (brand) brand.addEventListener('click', e => { e.preventDefault(); setView('overview'); });

    document.querySelectorAll('#companySwitch .entity-btn').forEach(btn => btn.addEventListener('click', () => { STATE.company = btn.getAttribute('data-company'); STATE.shown = {}; renderApp(); }));
    const periodSel = $('periodSelect');
    if (periodSel) periodSel.addEventListener('change', e => { STATE.period = e.target.value; STATE.shown = {}; renderApp(); });
    document.querySelectorAll('#basisSwitch .basis-btn').forEach(btn => btn.addEventListener('click', () => { STATE.basis = btn.getAttribute('data-basis'); renderApp(); }));

    const toggleTheme = () => { STATE.theme = STATE.theme === 'light' ? 'dark' : 'light'; localStorage.setItem('isabi_mfg_theme', STATE.theme); renderApp(); };
    const themeBtn = $('themeToggleBtn');
    const mobileThemeBtn = $('mobileThemeBtn');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
    if (mobileThemeBtn) mobileThemeBtn.addEventListener('click', toggleTheme);

    const newTicketBtn = $('newEntryBtn');
    const mobileDockEntryBtn = $('mobileDockEntryBtn');
    if (newTicketBtn) newTicketBtn.addEventListener('click', () => openEntryModal(contextFormForView(STATE.view)));
    if (mobileDockEntryBtn) mobileDockEntryBtn.addEventListener('click', () => openEntryModal(contextFormForView(STATE.view)));
    const closeEntryBtn = $('closeModalBtn');
    if (closeEntryBtn) closeEntryBtn.addEventListener('click', () => closeEntryModal());
    const modal = $('entryModal');
    if (modal) modal.addEventListener('click', e => { if (e.target === modal) closeEntryModal(); });
    document.querySelectorAll('#modalTabs .modal-tab').forEach(btn => btn.addEventListener('click', () => openEntryModal(btn.getAttribute('data-form'))));

    // Ask ISABI slide-over drawer
    const openAskBtn = $('askIsabiBtn');
    const mobileAskBtn = $('mobileAskIsabiBtn');
    const closeAskBtn = $('closeAiDrawerBtn');
    const resetAskBtn = $('resetAiThreadBtn');
    const askDrawer = $('aiDrawer');
    const askLog = $('aiMessages');
    const askInput = $('aiInput');
    const askForm = $('aiForm');
    const defaultPrompt = 'Compare WTC vs BBConstruction revenue, margin, and operating profit';

    function pushAskMessage(qText) {
      if (!qText || !askLog) return;
      const uBubble = document.createElement('div');
      uBubble.className = 'ai-msg-user';
      uBubble.textContent = qText;
      askLog.appendChild(uBubble);
      const bBubble = document.createElement('div');
      bBubble.className = 'ai-msg-bot';
      bBubble.innerHTML = answerAskIsabi(qText);
      askLog.appendChild(bBubble);
      askLog.scrollTop = askLog.scrollHeight;
    }
    const openDrawer = () => {
      if (!askDrawer) return;
      closeRail();
      askDrawer.classList.add('open');
      askDrawer.setAttribute('aria-hidden', 'false');
      if (askLog && !askLog.children.length) pushAskMessage(defaultPrompt);
      if (askInput && window.matchMedia('(min-width: 861px)').matches) setTimeout(() => askInput.focus(), 200);
    };
    const closeDrawer = () => { if (askDrawer) { askDrawer.classList.remove('open'); askDrawer.setAttribute('aria-hidden', 'true'); } };
    if (openAskBtn) openAskBtn.addEventListener('click', openDrawer);
    if (mobileAskBtn) mobileAskBtn.addEventListener('click', openDrawer);
    if (closeAskBtn) closeAskBtn.addEventListener('click', closeDrawer);
    if (resetAskBtn && askLog) resetAskBtn.addEventListener('click', () => { askLog.innerHTML = ''; pushAskMessage(defaultPrompt); });
    document.querySelectorAll('#aiChips .ai-pill-btn').forEach(chip => chip.addEventListener('click', () => pushAskMessage(chip.getAttribute('data-prompt') || chip.textContent)));
    if (askForm && askInput) askForm.addEventListener('submit', e => { e.preventDefault(); if (askInput.value.trim()) { pushAskMessage(askInput.value.trim()); askInput.value = ''; } });

    // Keyboard: Escape closes the modal / drawer / rail; Ctrl+K focuses search
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        const m = $('entryModal');
        if (m && !m.hidden) { closeEntryModal(); return; }
        if (askDrawer && askDrawer.classList.contains('open')) { closeDrawer(); return; }
        if (sidebar && sidebar.classList.contains('open')) { closeRail(); return; }
        if (STATE.showAddUserForm) { STATE.showAddUserForm = false; renderApp(); }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { const s = $('tableSearchInput'); if (s) { e.preventDefault(); s.focus(); s.select(); } }
    });

    // History: back / forward + hash links move between modules
    window.addEventListener('popstate', e => {
      const v = (e.state && e.state.view) || (location.hash || '').replace(/^#/, '') || 'overview';
      if (VIEW_TITLES[v]) setView(v, { noPush: true });
    });
    window.addEventListener('hashchange', () => {
      const v = (location.hash || '').replace(/^#/, '');
      if (VIEW_TITLES[v] && v !== STATE.view) setView(v, { noPush: true });
    });

    // SQLite API status (LAN host only)
    if (HAS_LOCAL_API) {
      fetch('./api/status').then(r => r.json()).then(st => {
        const el = $('sqlStatusText');
        if (el && st.ok) el.textContent = `Cloud + SQLite (${Number(st.db_size_kb || 0).toLocaleString()} KB)`;
      }).catch(() => { const el = $('sqlStatusText'); if (el) el.textContent = 'Cloud relay (no local SQLite)'; });
    } else {
      const el = $('sqlStatusText');
      if (el) el.textContent = 'Cloud relay';
    }

    // Cloud relay: on start, when the tab comes back, when the network returns
    syncWithCloud(false);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncWithCloud(false); });
    window.addEventListener('online', () => { toast('Back online — syncing'); syncWithCloud(true); });
    window.addEventListener('offline', () => { STATE.cloudStatus = '● Offline Cache'; updateCloudBadges(); toast('Offline — entries are kept on this device and sync later', 'err'); });
    window.addEventListener('pagehide', () => { if (STATE.pushAfterSync) syncWithCloud(true); });

    renderApp();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
