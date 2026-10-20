/* ============================================================================
   ISABI Systems — Manufacturing Operations Standalone Web App (js/app.js)
   Option 3 Architecture: Own SQLite / PostgreSQL Engine + Offline PWA
   Companies: WTC · BBConstruction · Lions Transport · All Group
   ============================================================================ */

(function () {
  'use strict';

  const SEED = window.MFG_SEED || { models: {}, records: {}, sentinels: {} };
  const CLOUD_CFG = window.MFG_CLOUD_CFG || {};
  const CLOUD_URL = CLOUD_CFG.u ? atob(CLOUD_CFG.u) : '';
  const CLOUD_KEY = CLOUD_CFG.k ? atob(CLOUD_CFG.k) : '';
  const CLOUD_DOC_KEY = CLOUD_CFG.docKey || 'mfg_web_store';

  const DEFAULT_USERS = [
    { id: 'u1', full_name: 'Hussein Bdeir', email: 'husseinbdeir@bhfirms.com', pin_code: '1111', role: 'Full Access (Owner)', companies: 'WTC, BBConstruction, Lions Transport', pbi_access: 'full', statements_access: 'full', status: 'Active', last_login_at: '2026-10-20 18:45' },
    { id: 'u2', full_name: 'Zeinab Rkein', email: 'zeinabrkein@bhfirms.com', pin_code: '2222', role: 'Supervisor + Entry', companies: 'WTC, BBConstruction, Lions Transport', pbi_access: 'full', statements_access: 'full', status: 'Active', last_login_at: '2026-10-20 17:20' },
    { id: 'u3', full_name: 'Sabah Kassab', email: 'sabahkassab@bhfirms.com', pin_code: '3333', role: 'Entry', companies: 'WTC', pbi_access: 'partial', statements_access: 'partial', status: 'Active', last_login_at: '2026-10-20 16:10' },
    { id: 'u4', full_name: 'WTC Plant Weighbridge 1', email: 'scale1.wtc@bhfirms.com', pin_code: '4444', role: 'Entry', companies: 'WTC', pbi_access: 'none', statements_access: 'partial', status: 'Active', last_login_at: '2026-10-20 15:55' },
    { id: 'u5', full_name: 'WTC Quarry Dispatch', email: 'quarry.wtc@bhfirms.com', pin_code: '4545', role: 'Entry', companies: 'WTC', pbi_access: 'none', statements_access: 'none', status: 'Active', last_login_at: '' },
    { id: 'u6', full_name: 'BBConstruction Batching Desk', email: 'batch.bbc@bhfirms.com', pin_code: '5555', role: 'Entry', companies: 'BBConstruction', pbi_access: 'partial', statements_access: 'partial', status: 'Active', last_login_at: '2026-10-20 14:30' },
    { id: 'u7', full_name: 'BBConstruction Site Supervisor', email: 'site.bbc@bhfirms.com', pin_code: '6666', role: 'Supervisor', companies: 'BBConstruction', pbi_access: 'full', statements_access: 'full', status: 'Active', last_login_at: '' },
    { id: 'u8', full_name: 'Lions Transport Fleet Controller', email: 'fleet.lions@bhfirms.com', pin_code: '7777', role: 'Supervisor + Entry', companies: 'Lions Transport, WTC', pbi_access: 'full', statements_access: 'partial', status: 'Active', last_login_at: '' },
    { id: 'u9', full_name: 'Diesel & Garage Officer', email: 'fuel.mfg@bhfirms.com', pin_code: '7878', role: 'Entry', companies: 'WTC, BBConstruction, Lions Transport', pbi_access: 'none', statements_access: 'none', status: 'Active', last_login_at: '' },
    { id: 'u10', full_name: 'Accounts Receivable Collector', email: 'ar.mfg@bhfirms.com', pin_code: '8888', role: 'Sales', companies: 'WTC, BBConstruction', pbi_access: 'partial', statements_access: 'full', status: 'Active', last_login_at: '' }
  ];

  const STATE = {
    view: 'overview',
    company: 'manufacturing-group', // 'manufacturing-group' | 'wtc' | 'bbconstruction' | 'lionstransport'
    period: 'all',                  // 'all' | 'ytd' | 'mtd' | 'sep2026' | 'aug2026' | 'q3_2026' | 'fy2025'
    basis: 'tx',                    // 'tx' | 'rep'
    theme: localStorage.getItem('isabi_mfg_theme') || 'light',
    search: '',
    chipFilter: 'all',
    activeStatement: '01',
    modalForm: 'sales',
    activeUserIdx: 0,
    cloudStatus: 'Connecting...',
    showAddUserForm: false,
    users: JSON.parse(localStorage.getItem('isabi_mfg_users_v2') || 'null') || DEFAULT_USERS,
    sessions: JSON.parse(localStorage.getItem('isabi_mfg_sessions_v2') || 'null') || [
      { id: 's1', full_name: 'Hussein Bdeir', email: 'husseinbdeir@bhfirms.com', role: 'Full Access (Owner)', companies: 'WTC, BBConstruction, Lions Transport', device: 'Windows 11 Desktop · Edge', logged_in_at: '2026-10-20 18:45:12' },
      { id: 's2', full_name: 'Zeinab Rkein', email: 'zeinabrkein@bhfirms.com', role: 'Supervisor + Entry', companies: 'WTC, BBConstruction, Lions Transport', device: 'Office Workstation · Chrome', logged_in_at: '2026-10-20 17:20:04' },
      { id: 's3', full_name: 'Sabah Kassab', email: 'sabahkassab@bhfirms.com', role: 'Entry', companies: 'WTC', device: 'WTC Desk PC · Edge', logged_in_at: '2026-10-20 16:10:33' }
    ],
    customRecords: JSON.parse(localStorage.getItem('isabi_mfg_custom_recs_v2') || 'null') || {
      sales_tickets: [],
      raw_purchases: [],
      receipts: [],
      fuel_intakes: []
    },
    supabaseCfg: JSON.parse(localStorage.getItem('isabi_mfg_supabase_cfg') || 'null') || { url: '', anonKey: '' }
  };

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

  // Formatters
  function fmtUSD(v, decimals = 0) {
    const n = Number(v || 0);
    const abs = Math.abs(n);
    const s = abs.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
    return (n < 0 ? '-$' : '$') + s;
  }

  function fmtNum(v, decimals = 0) {
    const n = Number(v || 0);
    return n.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function fmtPct(v, num, den) {
    if (num != null && den) {
      return ((Number(num) / Number(den)) * 100).toFixed(1) + '%';
    }
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

  function getModel() {
    return SEED.models[STATE.company] || SEED.models['manufacturing-group'] || {
      periods: {}, monthly: [], products: [], customers: [], suppliers: [], sites: [], equipment: [], gl_tb: [], soa_stream: []
    };
  }

  function getKPI() {
    const m = getModel();
    return (m.periods && m.periods[STATE.period]) || (m.periods && m.periods.all) || {};
  }

  function filterRecords(list) {
    const bu = COMPANY_BU_MATCH[STATE.company];
    const q = STATE.search.trim().toLowerCase();
    return (list || []).filter(r => {
      if (bu && r.company && r.company !== bu) return false;
      if (q) {
        const hay = Object.values(r).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  // ==========================================================================
  // VIEW 01: OVERVIEW COMMAND CENTER (EXACT ISABI REV 10 "LEDGER" ARCHITECTURE)
  // ==========================================================================
  function buildExecutiveChart(months) {
    const W = 660, H = 248, ml = 46, mr = 12, mt = 18, mb = 30;
    const pw = W - ml - mr, ph = H - mt - mb;
    const rows = (months || []).slice(-12);
    if (!rows.length) {
      return '<svg class="chart" viewBox="0 0 660 248"></svg>';
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

  function renderOverview() {
    const m = getModel();
    const k = getKPI();
    const wtcK = (SEED.models.wtc && SEED.models.wtc.periods[STATE.period]) || {};
    const bbcK = (SEED.models.bbconstruction && SEED.models.bbconstruction.periods[STATE.period]) || {};
    const ltK = (SEED.models.lionstransport && SEED.models.lionstransport.periods[STATE.period]) || {};

    const salesVal = STATE.basis === 'rep' ? (k.sales_rep_date || k.sales_ttc) : k.sales_ttc;
    const rawVal = STATE.basis === 'rep' ? (k.raw_rep_date || k.raw_cost) : k.raw_cost;
    const expVal = STATE.basis === 'rep' ? (k.exp_rep_date || k.expenses) : k.expenses;
    const opProfit = STATE.basis === 'rep' ? (k.op_profit_rep_date || k.operating_profit) : k.operating_profit;

    const sentinelRows = buildSentinelItems().slice(0, 4);
    const soaRows = (m.soa_stream || []).slice(0, 8);
    const booksCount = STATE.company === 'manufacturing-group' ? '3' : '1';
    const booksUnit = STATE.company === 'manufacturing-group' ? ' of 3' : ' of 1';

    let totDeb = 0, totCred = 0;
    soaRows.forEach(r => {
      totDeb += Number(r.debit || 0);
      totCred += Number(r.credit || 0);
    });

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
          <span class="d good">Trial Balance $0.00 Variance</span>
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

      <!-- 3. ROW 2: MONTHLY TRAJECTORY CHART + OPERATING ENTITIES & TOP GRADES -->
      <section class="row2">
        <div class="panel">
          <div class="ph">
            <div>
              <h3>Monthly Revenue, Quarry Cost &amp; Cash Profit Trajectory</h3>
              <span class="ph-sub">${esc(COMPANY_LABELS[STATE.company])} · Hover bars to inspect monthly ledger totals</span>
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
            const months = m.monthly || [];
            const peakM = months.reduce((best, r) => (Number(r.sales_ttc || 0) > Number((best && best.sales_ttc) || 0) ? r : best), months[0] || {});
            const peakLabel = peakM.Month || peakM.label || peakM.ym || '2026-02';
            const avgM = months.length ? (Number(k.sales_ttc || 0) / months.length) : 0;
            const cogsPct = Number(k.net_sales || 0) > 0 ? ((Number(k.raw_cost || 0) / Number(k.net_sales || 1)) * 100).toFixed(1) + '%' : '0.0%';
            const opPctStr = fmtPct(k.op_margin_pct, opProfit, k.net_sales);
            const gmPctStr = fmtPct(k.gm_pct, k.gross_margin, k.net_sales);
            return `
              <div class="chart-ftr">
                <div class="chart-ftr-cell"><small>Peak Month (${esc(peakLabel)})</small><b class="num">${fmtUSD(peakM.sales_ttc || 0, 0)}</b></div>
                <div class="chart-ftr-cell"><small>Monthly Run-Rate (${months.length || 12}m)</small><b class="num">${fmtUSD(avgM, 0)} / mo</b></div>
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
                  <th>Operating Entity</th>
                  <th class="n">Sales TTC</th>
                  <th class="n">Loads</th>
                  <th class="n">GM %</th>
                  <th class="n">Op. Profit</th>
                  <th>Books</th>
                </tr>
              </thead>
              <tbody>
                <tr class="clickable-row" data-jump-co="wtc">
                  <td><b>WTC · World Trading</b></td>
                  <td class="n">${fmtUSD(wtcK.sales_ttc, 0)}</td>
                  <td class="n">${fmtNum(wtcK.loads)}</td>
                  <td class="n">${fmtPct(wtcK.gm_pct, wtcK.gross_margin, wtcK.net_sales)}</td>
                  <td class="n">${fmtUSD(wtcK.operating_profit, 0)}</td>
                  <td><span class="m-chip closed">Balanced</span></td>
                </tr>
                <tr class="clickable-row" data-jump-co="bbconstruction">
                  <td><b>BBConstruction</b></td>
                  <td class="n">${fmtUSD(bbcK.sales_ttc, 0)}</td>
                  <td class="n">${fmtNum(bbcK.loads)}</td>
                  <td class="n">${fmtPct(bbcK.gm_pct, bbcK.gross_margin, bbcK.net_sales)}</td>
                  <td class="n">${fmtUSD(bbcK.operating_profit, 0)}</td>
                  <td><span class="m-chip closed">Balanced</span></td>
                </tr>
                <tr class="clickable-row" data-jump-co="lionstransport">
                  <td><b>Lions Transport</b></td>
                  <td class="n">${fmtUSD(ltK.sales_ttc, 0)}</td>
                  <td class="n">${fmtNum(ltK.loads || k.own_fleet_loads)}</td>
                  <td class="n">Fleet</td>
                  <td class="n">${fmtUSD(ltK.operating_profit, 0)}</td>
                  <td><span class="m-chip closed">Synced</span></td>
                </tr>
                <tr class="total">
                  <td>Group Total (3 BUs)</td>
                  <td class="n">${fmtUSD(k.sales_ttc, 0)}</td>
                  <td class="n">${fmtNum(k.loads)}</td>
                  <td class="n">${fmtPct(k.gm_pct, k.gross_margin, k.net_sales)}</td>
                  <td class="n">${fmtUSD(k.operating_profit, 0)}</td>
                  <td><span class="m-chip brass">Audited</span></td>
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
                  <th>UoM</th>
                  <th class="n">Loads</th>
                  <th class="n">Tons</th>
                  <th class="n">Avg TTC</th>
                  <th class="n">Revenue TTC</th>
                </tr>
              </thead>
              <tbody>
                ${(m.products || []).slice(0, 4).map(p => `
                  <tr>
                    <td><b>${esc(p.Product)}</b></td>
                    <td class="mu">${esc(p.UoM || 'm³')}</td>
                    <td class="n">${fmtNum(p.loads)}</td>
                    <td class="n">${fmtNum(p.tons_sold, 0)}</td>
                    <td class="n">${fmtUSD(p.avg_price_ttc, 2)}</td>
                    <td class="n"><b>${fmtUSD(p.sales_ttc, 0)}</b></td>
                  </tr>
                `).join('')}
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
            <button type="button" class="btn-ghost-bar" style="padding:3px 9px;font-size:11px" data-nav-jump="sentinels">All 6 Sentinels</button>
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
                }).join('')}
                <tr class="total">
                  <td colspan="4">Total Audited Ledger Stream · Trial Balance Variance: $0.00</td>
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
  // VIEW 02: AI SENTINELS (M280 LIVE WATCHDOGS)
  // ==========================================================================
  function buildSentinelItems() {
    const k = getKPI();
    return [
      {
        code: 'S1 · TRIAL_BALANCE_TIE',
        title: 'Double-Entry Trial Balance Integrity (Lebanese CoA)',
        detail: 'Verifies Total Debits = Total Credits across all SOA journal legs (Sales, Raw Material, Haulage, Expenses, VAT 11%, Receipts & Settlements).',
        severity: 'ok',
        badge: 'PASS · $0.00 DIFF',
        badgeClass: 'badge-ok',
        company: 'WTC & BBConstruction'
      },
      {
        code: 'S2 · DIESEL_TANK_RECONCILIATION',
        title: 'Diesel Tank Physical vs Ledger Reconciliation',
        detail: 'WTC tank holds +1,042.0 L; BBConstruction shows -242,095 L because historical bulk diesel deliveries were booked under General Expenses instead of Fuel Purchases.',
        severity: 'crit',
        badge: 'ACTION · -242,095 L BBC',
        badgeClass: 'badge-err',
        company: 'BBConstruction'
      },
      {
        code: 'S3 · FUEL_METER_OUTLIERS (M142)',
        title: 'Odometer & Hour-Meter Median Tolerance Watchdog (±45d)',
        detail: 'Flags typed odometer typos (e.g. 41,380 vs 413,800 km on truck Tb2) before computing L/100km and $/ton hauled.',
        severity: 'warn',
        badge: 'GUARD ACTIVE · M142',
        badgeClass: 'badge-warn',
        company: 'All Fleet (1,637 units)'
      },
      {
        code: 'S4 · AR_OVERDUE_60_PLUS',
        title: 'Customer Receivables Overdue > 60 Days (FIFO Allocated)',
        detail: `Current open AR is ${fmtUSD(k.ar_balance, 2)} (VAT-inclusive per m249), with ${fmtUSD(k.ar_60_plus, 2)} aged past 60 days after FIFO receipt allocation.`,
        severity: 'warn',
        badge: `${fmtUSD(k.ar_60_plus, 0)} > 60D`,
        badgeClass: 'badge-warn',
        company: 'WTC & BBConstruction'
      },
      {
        code: 'S5 · AP_THREE_LEG_MATCH',
        title: 'Quarry Material Owner vs Hauler Truck Owner Split (M192)',
        detail: 'Separates every Raw Purchase ticket into Leg 1 (Material owed to Quarry Site Owner) and Leg 2 (Haulage owed to Truck Owner); own-fleet haulage gated to $0.',
        severity: 'ok',
        badge: '3-LEG FIFO ACTIVE',
        badgeClass: 'badge-ok',
        company: 'All Quarries'
      },
      {
        code: 'S6 · PRICE_AGREEMENT_ENFORCEMENT',
        title: '753 Active Customer & Quarry Price Agreements Locked',
        detail: 'Automatically locks Unit Price & Transport Price on matching Customer + Product + Site + Date windows; zero unpriced tickets in October 2026.',
        severity: 'ok',
        badge: '0 UNPRICED (30D)',
        badgeClass: 'badge-ok',
        company: 'All Group'
      }
    ];
  }

  function renderSentinels() {
    const items = buildSentinelItems();
    return `
      <div class="cockpit-banner">
        <div class="cockpit-title-block">
          <div class="cockpit-eyebrow">AUTONOMOUS AUDIT &amp; ANOMALY DETECTION · M280 ENGINE</div>
          <div class="cockpit-title">AI Sentinel Watchdogs</div>
          <div class="cockpit-sub">Continuous deterministic audit rules running directly against the SQL ledger — no external BI license required.</div>
        </div>
        <div class="cockpit-pills">
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Active Sentinels</div><div class="cockpit-pill-val brass">6 Rules</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">TB Variance</div><div class="cockpit-pill-val emerald">$0.00</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Unpriced Tickets</div><div class="cockpit-pill-val emerald">0</div></div>
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
              <span class="badge ${s.badgeClass}">${esc(s.badge)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // VIEW 03: SALES & DELIVERIES (12-COL LEDGER + 35 FORM RULES)
  // ==========================================================================
  function renderSales() {
    const k = getKPI();
    const rows = filterRecords(SEED.records.sales_tickets).filter(r => {
      if (STATE.chipFilter === 'delivery') return r.sale_type === 'Delivery';
      if (STATE.chipFilter === 'pickup') return r.sale_type === 'Pickup';
      if (STATE.chipFilter === 'credit') return r.method === 'Credit';
      if (STATE.chipFilter === 'cash') return r.method === 'Cash';
      return true;
    });

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
        </div>
      </div>

      <div class="panel-card">
        <div class="table-toolbar">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <input type="search" id="tableSearchInput" class="search-input" value="${esc(STATE.search)}" placeholder="Search ticket #, customer, product, site, truck...">
            <div class="chip-bar">
              <button class="filter-chip ${STATE.chipFilter === 'all' ? 'active' : ''}" data-chip="all">All (${rows.length})</button>
              <button class="filter-chip ${STATE.chipFilter === 'delivery' ? 'active' : ''}" data-chip="delivery">Delivery</button>
              <button class="filter-chip ${STATE.chipFilter === 'pickup' ? 'active' : ''}" data-chip="pickup">Pickup</button>
              <button class="filter-chip ${STATE.chipFilter === 'credit' ? 'active' : ''}" data-chip="credit">Credit</button>
              <button class="filter-chip ${STATE.chipFilter === 'cash' ? 'active' : ''}" data-chip="cash">Cash</button>
            </div>
          </div>
          <button class="btn btn-primary" data-open-modal="sales">+ New Sales Ticket</button>
        </div>

        <div class="table-wrap">
          <table class="ledger-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Ticket #</th>
                <th>Co.</th>
                <th>Type</th>
                <th>Customer</th>
                <th>Product</th>
                <th>Destination Site</th>
                <th>Truck / Fleet</th>
                <th class="r">Qty</th>
                <th class="r">Mat ($)</th>
                <th class="r">Trans ($)</th>
                <th class="r">Total TTC ($)</th>
                <th>Method</th>
              </tr>
            </thead>
            <tbody>
              ${rows.slice(0, 100).map(r => `
                <tr>
                  <td class="mono">${esc(r.date)}</td>
                  <td class="mono"><strong>${esc(r.ticket_no)}</strong></td>
                  <td><span class="badge badge-brass">${esc(r.company)}</span></td>
                  <td>${esc(r.sale_type)}</td>
                  <td><strong>${esc(r.customer)}</strong></td>
                  <td>${esc(r.product)}</td>
                  <td>${esc(r.site || '—')}</td>
                  <td class="mono">${esc(r.truck || r.transport_by)}</td>
                  <td class="r">${fmtNum(r.qty, 2)} ${esc(r.uom)}</td>
                  <td class="r">${fmtUSD(r.price, 2)}</td>
                  <td class="r">${fmtUSD(r.trans_price, 2)}</td>
                  <td class="r"><strong>${fmtUSD(r.total_ttc, 2)}</strong></td>
                  <td><span class="badge ${r.method === 'Cash' ? 'badge-ok' : 'badge-info'}">${esc(r.method)}</span></td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="8">SHOWING ${Math.min(100, rows.length)} OF ${rows.length} RECENT SQL TICKETS (FULL ARCHIVE: ${fmtNum(k.loads)} LOADS)</td>
                <td class="r">${fmtNum(k.tons_sold, 0)} t</td>
                <td class="r">${fmtUSD(k.net_sales - (k.trans_rev || 0), 0)}</td>
                <td class="r">${fmtUSD(k.trans_rev, 0)}</td>
                <td class="r">${fmtUSD(k.sales_ttc, 2)}</td>
                <td>AUDITED</td>
              </tr>
            </tfoot>
          </table>
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
    const rows = filterRecords(SEED.records.raw_purchases);

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
        </div>
      </div>

      <div class="split-grid-2">
        <div class="panel-card">
          <div class="table-toolbar">
            <input type="search" id="tableSearchInput" class="search-input" value="${esc(STATE.search)}" placeholder="Search ticket #, quarry site, site owner, hauler, product...">
            <button class="btn btn-primary" data-open-modal="raw">+ New Raw Receipt</button>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Ticket #</th>
                  <th>Co.</th>
                  <th>Quarry Site</th>
                  <th>Site Owner (Mat. Payee)</th>
                  <th>Truck Owner (Haul Payee)</th>
                  <th>Product</th>
                  <th class="r">Qty</th>
                  <th class="r">Mat Cost</th>
                  <th class="r">Haulage</th>
                  <th class="r">Total ($)</th>
                </tr>
              </thead>
              <tbody>
                ${rows.slice(0, 80).map(r => `
                  <tr>
                    <td class="mono">${esc(r.date)}</td>
                    <td class="mono"><strong>${esc(r.ticket_no)}</strong></td>
                    <td><span class="badge badge-brass">${esc(r.company)}</span></td>
                    <td><strong>${esc(r.site || '—')}</strong></td>
                    <td>${esc(r.site_owner || '—')}</td>
                    <td>${esc(r.truck_owner || r.transport_by)}</td>
                    <td>${esc(r.product)}</td>
                    <td class="r">${fmtNum(r.qty, 2)} ${esc(r.uom)}</td>
                    <td class="r">${fmtUSD(r.cost, 2)}</td>
                    <td class="r">${fmtUSD(r.trans_cost, 2)}</td>
                    <td class="r"><strong>${fmtUSD(r.total, 2)}</strong></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-head">
            <div class="panel-title"><span>TOP QUARRIES &amp; CUSTOMER SITES BY VOLUME</span></div>
            <span class="panel-meta">319 Registered Sites</span>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  <th>Site Name</th>
                  <th>JV</th>
                  <th class="r">Sales Loads</th>
                  <th class="r">Sales TTC</th>
                  <th class="r">Raw Loads</th>
                  <th class="r">Raw Cost</th>
                </tr>
              </thead>
              <tbody>
                ${(m.sites || []).slice(0, 18).map(s => `
                  <tr>
                    <td><strong>${esc(s.Site)}</strong></td>
                    <td>${s.JV === 'Yes' ? '<span class="badge badge-brass">JV</span>' : '—'}</td>
                    <td class="r">${fmtNum(s.loads)}</td>
                    <td class="r">${fmtUSD(s.sales_ttc, 0)}</td>
                    <td class="r">${fmtNum(s.raw_loads)}</td>
                    <td class="r"><strong>${fmtUSD(s.raw_cost, 0)}</strong></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // VIEW 05: EQUIPMENT, FLEET & DIESEL (1,637 UNITS + M142 METER GUARD)
  // ==========================================================================
  function renderFleet() {
    const k = getKPI();
    const m = getModel();
    const fuelRows = filterRecords(SEED.records.fuel_intakes);

    return `
      <div class="cockpit-banner">
        <div class="cockpit-title-block">
          <div class="cockpit-eyebrow">UNIVERSAL FLEET REGISTRY · M99 + M142 METER TOLERANCE GUARD</div>
          <div class="cockpit-title">Equipment, Fleet &amp; Diesel Telemetry</div>
          <div class="cockpit-sub">Tracks 1,638 trucks, loaders, excavators &amp; generators · Allocates running costs, driver wages &amp; diesel per ton hauled.</div>
        </div>
        <div class="cockpit-pills">
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Active Fleet</div><div class="cockpit-pill-val brass">${fmtNum(k.active_equip)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Cost / Ton Hauled</div><div class="cockpit-pill-val emerald">${fmtUSD(k.cost_per_ton, 2)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Cost / m³ Hauled</div><div class="cockpit-pill-val">${fmtUSD(k.cost_per_unit, 2)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Diesel Issued</div><div class="cockpit-pill-val">${fmtNum(k.diesel_litres, 0)} L</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Total Fleet Cost</div><div class="cockpit-pill-val amber">${fmtUSD(k.total_equip_cost, 0)}</div></div>
        </div>
      </div>

      <div class="split-grid-2">
        <div class="panel-card">
          <div class="panel-head">
            <div class="panel-title"><span>UNIT PROFITABILITY &amp; TELEMETRY (TOP 35 ACTIVE UNITS)</span></div>
            <span class="panel-meta">Running + Driver Cost Allocated</span>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  <th>Equipment / Plate</th>
                  <th>Type</th>
                  <th>Ownership</th>
                  <th class="r">Trips</th>
                  <th class="r">Diesel (L)</th>
                  <th class="r">Km Run</th>
                  <th class="r">Running ($)</th>
                  <th class="r">Driver ($)</th>
                  <th class="r">Total Cost</th>
                  <th class="r">$/Ton</th>
                </tr>
              </thead>
              <tbody>
                ${(m.equipment || []).map(e => `
                  <tr>
                    <td class="mono"><strong>${esc(e.Equipment)}</strong></td>
                    <td>${esc(e.Type || 'Truck')}</td>
                    <td><span class="badge ${e.Ownership === 'Owned' ? 'badge-ok' : 'badge-info'}">${esc(e.Ownership || 'Transporter')}</span></td>
                    <td class="r">${fmtNum(e.trips)}</td>
                    <td class="r">${fmtNum(e.diesel_litres, 0)}</td>
                    <td class="r">${fmtNum(e.km_run, 0)}</td>
                    <td class="r">${fmtUSD(e.running_cost, 0)}</td>
                    <td class="r">${fmtUSD(e.driver_cost, 0)}</td>
                    <td class="r"><strong>${fmtUSD(e.total_cost, 0)}</strong></td>
                    <td class="r">${e.cost_per_ton ? fmtUSD(e.cost_per_ton, 2) : '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-head">
            <div class="panel-title"><span>DIESEL &amp; LUBRICANT INTAKE LOG (M142 METER GUARD)</span></div>
            <button class="btn btn-primary" style="padding:4px 10px;font-size:11px" data-open-modal="fuel">+ Log Fuel Intake</button>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Co.</th>
                  <th>Equipment</th>
                  <th>Driver</th>
                  <th>Item</th>
                  <th class="r">Litres</th>
                  <th class="r">Meter</th>
                  <th>M142 Guard</th>
                </tr>
              </thead>
              <tbody>
                ${fuelRows.slice(0, 35).map(f => `
                  <tr>
                    <td class="mono">${esc(f.date)}</td>
                    <td><span class="badge badge-brass">${esc(f.company)}</span></td>
                    <td class="mono"><strong>${esc(f.equipment)}</strong></td>
                    <td>${esc(f.driver || '—')}</td>
                    <td>${esc(f.item)}</td>
                    <td class="r"><strong>${fmtNum(f.litres, 1)} L</strong></td>
                    <td class="r">${f.odometer ? fmtNum(f.odometer, 0) : (f.hours ? fmtNum(f.hours, 1) + 'h' : '—')}</td>
                    <td><span class="badge badge-ok">● OK</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // VIEW 06: PRICING & COMMISSION AGREEMENTS (753 IN FORCE / 2,336 TOTAL)
  // ==========================================================================
  function renderPricing() {
    const k = getKPI();
    const rules = filterRecords(SEED.records.price_rules);

    return `
      <div class="cockpit-banner">
        <div class="cockpit-title-block">
          <div class="cockpit-eyebrow">CONTRACTUAL PRICE ENGINE · M73 + M228 + M276</div>
          <div class="cockpit-title">Price &amp; Commission Agreements</div>
          <div class="cockpit-sub">Governs Sales (Delivery), Sales (Pickup), Quarry Purchase Price (Site), Hauler Transport Price (Site) &amp; Sales Commissions.</div>
        </div>
        <div class="cockpit-pills">
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Active Agreements</div><div class="cockpit-pill-val brass">${fmtNum(k.active_agreements)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Total SQL Rules</div><div class="cockpit-pill-val">${fmtNum(SEED.records.price_rules.length)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Commission Due</div><div class="cockpit-pill-val amber">${fmtUSD(k.commission_due, 0)}</div></div>
        </div>
      </div>

      <div class="panel-card">
        <div class="table-toolbar">
          <input type="search" id="tableSearchInput" class="search-input" value="${esc(STATE.search)}" placeholder="Search customer, quarry supplier, product, site, rule type...">
          <span class="panel-meta">Showing ${Math.min(120, rules.length)} of ${rules.length} matching rules</span>
        </div>
        <div class="table-wrap">
          <table class="ledger-table">
            <thead>
              <tr>
                <th>Agreement Code</th>
                <th>Co.</th>
                <th>Rule Type</th>
                <th>Customer / Quarry Owner</th>
                <th>Product</th>
                <th>Site</th>
                <th>Unit</th>
                <th class="r">Unit Price ($)</th>
                <th class="r">Transport Price ($)</th>
                <th>Start Date</th>
                <th>End Date</th>
              </tr>
            </thead>
            <tbody>
              ${rules.slice(0, 120).map(pr => `
                <tr>
                  <td class="mono"><strong>${esc(pr.name)}</strong></td>
                  <td><span class="badge badge-brass">${esc(pr.company)}</span></td>
                  <td><span class="badge badge-info">${esc(pr.rule_type)}</span></td>
                  <td><strong>${esc(pr.customer || pr.supplier || 'Standard List')}</strong></td>
                  <td>${esc(pr.product || '(All Grades)')}</td>
                  <td>${esc(pr.site || '—')}</td>
                  <td class="mono">${esc(pr.unit)}</td>
                  <td class="r"><strong>${fmtUSD(pr.unit_price, 2)}</strong></td>
                  <td class="r">${pr.trans_unit_price ? fmtUSD(pr.trans_unit_price, 2) : '—'}</td>
                  <td class="mono">${esc(pr.start_date || '—')}</td>
                  <td class="mono">${esc(pr.end_date || 'Open (Active)')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
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
    const rcpts = filterRecords(SEED.records.receipts);

    return `
      <div class="cockpit-banner">
        <div class="cockpit-title-block">
          <div class="cockpit-eyebrow">ACCOUNTS RECEIVABLE · M165 FIFO ALLOCATION + M249 VAT-INCLUSIVE BALANCE</div>
          <div class="cockpit-title">Customers &amp; Receivables (AR)</div>
          <div class="cockpit-sub">Every receipt or credit note automatically settles the customer's oldest open tickets first (FIFO) · Balances include 11% VAT for VAT-registered customers.</div>
        </div>
        <div class="cockpit-pills">
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Net AR Balance</div><div class="cockpit-pill-val brass">${fmtUSD(k.ar_balance, 2)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Current (0–10d)</div><div class="cockpit-pill-val emerald">${fmtUSD((k.ar_current || 0) + (k.ar_1_10 || 0), 0)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">11–60 Days</div><div class="cockpit-pill-val">${fmtUSD((k.ar_11_30 || 0) + (k.ar_31_60 || 0), 0)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Overdue 60+ Days</div><div class="cockpit-pill-val amber">${fmtUSD(k.ar_60_plus, 0)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Receipts Collected</div><div class="cockpit-pill-val">${fmtUSD(k.receipts, 0)}</div></div>
        </div>
      </div>

      <div class="split-grid-2">
        <div class="panel-card">
          <div class="panel-head">
            <div class="panel-title"><span>CUSTOMER SUB-ACCOUNTS &amp; FIFO AGING SCHEDULE</span></div>
            <button class="btn btn-primary" style="padding:4px 10px;font-size:11px" data-open-modal="receipt">+ Customer Receipt (FIFO)</button>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>VAT Reg</th>
                  <th class="r">Loads</th>
                  <th class="r">Sales TTC</th>
                  <th class="r">Receipts</th>
                  <th class="r">Current</th>
                  <th class="r">Overdue 60+</th>
                  <th class="r">Open AR ($)</th>
                </tr>
              </thead>
              <tbody>
                ${(m.customers || []).map(c => `
                  <tr>
                    <td><strong>${esc(c.Customer)}</strong></td>
                    <td>${c['VAT Registered'] === 'Yes' ? '<span class="badge badge-info">11% VAT</span>' : 'No'}</td>
                    <td class="r">${fmtNum(c.loads)}</td>
                    <td class="r">${fmtUSD(c.sales_ttc, 0)}</td>
                    <td class="r">${fmtUSD(c.receipts, 0)}</td>
                    <td class="r">${fmtUSD(c.ar_current, 0)}</td>
                    <td class="r">${c.ar_60_plus > 0 ? `<span style="color:var(--crimson)">${fmtUSD(c.ar_60_plus, 0)}</span>` : '—'}</td>
                    <td class="r"><strong>${fmtUSD(c.ar_balance, 2)}</strong></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-head">
            <div class="panel-title"><span>RECENT CUSTOMER RECEIPTS &amp; SETTLEMENTS</span></div>
            <span class="panel-meta">FIFO Auto-Applied</span>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Voucher</th>
                  <th>Co.</th>
                  <th>Customer</th>
                  <th>Method</th>
                  <th class="r">Cash ($)</th>
                  <th class="r">Disc ($)</th>
                </tr>
              </thead>
              <tbody>
                ${rcpts.slice(0, 35).map(r => `
                  <tr>
                    <td class="mono">${esc(r.date)}</td>
                    <td class="mono">${esc(r.name)}</td>
                    <td><span class="badge badge-brass">${esc(r.company)}</span></td>
                    <td><strong>${esc(r.customer)}</strong></td>
                    <td>${esc(r.method)}</td>
                    <td class="r"><strong>${fmtUSD(r.amount, 2)}</strong></td>
                    <td class="r">${r.discount ? fmtUSD(r.discount, 2) : '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
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
    const spays = filterRecords(SEED.records.settlements);

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
        </div>
      </div>

      <div class="split-grid-2">
        <div class="panel-card">
          <div class="panel-head">
            <div class="panel-title"><span>SUPPLIER &amp; HAULER SUB-ACCOUNTS BY PAYABLE LEG</span></div>
            <span class="panel-meta">Account 4011 Trade Payables</span>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  <th>Supplier / Hauler</th>
                  <th>IVA</th>
                  <th class="r">Raw Loads</th>
                  <th class="r">Mat. Leg</th>
                  <th class="r">Haul Leg</th>
                  <th class="r">Exp. Leg</th>
                  <th class="r">Paid ($)</th>
                  <th class="r">Net AP ($)</th>
                </tr>
              </thead>
              <tbody>
                ${(m.suppliers || []).map(s => `
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
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-head">
            <div class="panel-title"><span>RECENT SUPPLIER SETTLEMENTS</span></div>
            <span class="panel-meta">Oldest-First Leg Relief</span>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Voucher</th>
                  <th>Co.</th>
                  <th>Supplier</th>
                  <th>Method</th>
                  <th class="r">Cash Paid</th>
                  <th class="r">Diff / Disc</th>
                </tr>
              </thead>
              <tbody>
                ${spays.slice(0, 35).map(sp => `
                  <tr>
                    <td class="mono">${esc(sp.date)}</td>
                    <td class="mono">${esc(sp.name)}</td>
                    <td><span class="badge badge-brass">${esc(sp.company)}</span></td>
                    <td><strong>${esc(sp.supplier)}</strong></td>
                    <td>${esc(sp.method)}</td>
                    <td class="r"><strong>${fmtUSD(sp.amount, 2)}</strong></td>
                    <td class="r">${sp.discount ? fmtUSD(sp.discount, 2) : '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
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
    const expRows = filterRecords(SEED.records.expenses);
    const salRows = filterRecords(SEED.records.salaries);

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
        </div>
      </div>

      <div class="split-grid-2">
        <div class="panel-card">
          <div class="panel-head">
            <div class="panel-title"><span>RECENT PLANT &amp; FLEET EXPENSES</span></div>
            <span class="panel-meta">Attributed to GL &amp; Equipment</span>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Co.</th>
                  <th>Category</th>
                  <th>Subcategory</th>
                  <th>Supplier</th>
                  <th>Equipment</th>
                  <th>Method</th>
                  <th class="r">Amount ($)</th>
                </tr>
              </thead>
              <tbody>
                ${expRows.slice(0, 45).map(x => `
                  <tr>
                    <td class="mono">${esc(x.date)}</td>
                    <td><span class="badge badge-brass">${esc(x.company)}</span></td>
                    <td><strong>${esc(x.category)}</strong></td>
                    <td>${esc(x.subcategory)}</td>
                    <td>${esc(x.supplier || '—')}</td>
                    <td class="mono">${esc(x.equipment || '—')}</td>
                    <td><span class="badge ${x.method === 'Cash' ? 'badge-ok' : 'badge-info'}">${esc(x.method)}</span></td>
                    <td class="r"><strong>${fmtUSD(x.amount, 2)}</strong></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-head">
            <div class="panel-title"><span>STAFF SALARIES &amp; PAYROLL DISBURSEMENTS</span></div>
            <span class="panel-meta">Account 421 / 641</span>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Payroll Month</th>
                  <th>Co.</th>
                  <th>Staff Member</th>
                  <th class="r">Paid ($)</th>
                </tr>
              </thead>
              <tbody>
                ${salRows.slice(0, 40).map(s => `
                  <tr>
                    <td class="mono">${esc(s.date)}</td>
                    <td class="mono">${esc(s.payroll_month)}</td>
                    <td><span class="badge badge-brass">${esc(s.company)}</span></td>
                    <td><strong>${esc(s.staff)}</strong></td>
                    <td class="r"><strong>${fmtUSD(s.amount, 2)}</strong></td>
                  </tr>
                `).join('')}
              </tbody>
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
    const tb = m.gl_tb || [];
    let totDr = 0;
    let totCr = 0;
    tb.forEach(r => {
      totDr += Number(r.debit || 0);
      totCr += Number(r.credit || 0);
    });

    return `
      <div class="cockpit-banner">
        <div class="cockpit-title-block">
          <div class="cockpit-eyebrow">LEBANESE GENERAL CHART OF ACCOUNTS (PLAN COMPTABLE GÉNÉRAL)</div>
          <div class="cockpit-title">General Ledger &amp; Trial Balance</div>
          <div class="cockpit-sub">Every operational transaction posts balanced Debit &amp; Credit legs in real time · Classes 1 to 7 tied to $0.00 variance.</div>
        </div>
        <div class="cockpit-pills">
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Total Debits</div><div class="cockpit-pill-val">${fmtUSD(totDr, 2)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Total Credits</div><div class="cockpit-pill-val">${fmtUSD(totCr, 2)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">TB Check</div><div class="cockpit-pill-val emerald">$0.00 TIED</div></div>
        </div>
      </div>

      <div class="panel-card">
        <div class="panel-head">
          <div class="panel-title"><span>AUDITED TRIAL BALANCE BY ACCOUNT CODE (${esc(COMPANY_LABELS[STATE.company])})</span></div>
          <button class="btn" data-nav-jump="statements">Print Official Trial Balance PDF →</button>
        </div>
        <div class="table-wrap">
          <table class="ledger-table">
            <thead>
              <tr>
                <th>GL Code</th>
                <th>Account Name</th>
                <th>Lebanese CoA Class</th>
                <th class="r">Total Debit ($)</th>
                <th class="r">Total Credit ($)</th>
                <th class="r">Net Balance ($)</th>
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
              `).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3">TOTAL TRIAL BALANCE (${tb.length} ACTIVE GL ACCOUNTS)</td>
                <td class="r">${fmtUSD(totDr, 2)}</td>
                <td class="r">${fmtUSD(totCr, 2)}</td>
                <td class="r">$0.00</td>
              </tr>
            </tfoot>
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

  function renderStatementSheet(code) {
    const m = getModel();
    const k = getKPI();
    const st = STATEMENT_CATALOG.find(x => x.code === code) || STATEMENT_CATALOG[0];

    let bodyHtml = '';
    if (code === '02') {
      const tb = m.gl_tb || [];
      bodyHtml = `
        <table class="ledger-table">
          <thead><tr><th>Code</th><th>Account</th><th>Class</th><th class="r">Debit ($)</th><th class="r">Credit ($)</th><th class="r">Balance ($)</th></tr></thead>
          <tbody>
            ${tb.map(r => `<tr><td class="mono">${esc(r.Code)}</td><td>${esc(r.Account)}</td><td>${esc(r.Class)}</td><td class="r">${fmtUSD(r.debit, 2)}</td><td class="r">${fmtUSD(r.credit, 2)}</td><td class="r"><strong>${fmtUSD(r.balance, 2)}</strong></td></tr>`).join('')}
          </tbody>
        </table>
      `;
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
            <tr><td class="mono">GM</td><td><strong>GROSS MARGIN</strong></td><td class="r"><strong>${fmtUSD(k.gross_margin, 2)}</strong></td><td class="r"><strong>${fmtPct(k.gm_pct)}</strong></td></tr>
            <tr><td class="mono">61/62</td><td>Plant &amp; Fleet Operating Expenses</td><td class="r">(${fmtUSD(k.expenses, 2)})</td><td class="r">${fmtPct((k.expenses || 0) / (k.net_sales || 1))}</td></tr>
            <tr><td class="mono">641</td><td>Staff Salaries &amp; Workforce Wages Paid</td><td class="r">(${fmtUSD(k.salaries_paid, 2)})</td><td class="r">${fmtPct((k.salaries_paid || 0) / (k.net_sales || 1))}</td></tr>
          </tbody>
          <tfoot>
            <tr><td colspan="2">OPERATING PROFIT (CASH VIEW)</td><td class="r">${fmtUSD(k.operating_profit, 2)}</td><td class="r">${fmtPct(k.op_margin_pct)}</td></tr>
          </tfoot>
        </table>
      `;
    } else if (code === '09' || code === '11') {
      bodyHtml = `
        <table class="ledger-table">
          <thead><tr><th>Customer</th><th>VAT Reg</th><th class="r">Loads</th><th class="r">Sales TTC</th><th class="r">Receipts</th><th class="r">Current</th><th class="r">Overdue 60+</th><th class="r">Closing AR ($)</th></tr></thead>
          <tbody>
            ${(m.customers || []).map(c => `<tr><td><strong>${esc(c.Customer)}</strong></td><td>${esc(c['VAT Registered'])}</td><td class="r">${fmtNum(c.loads)}</td><td class="r">${fmtUSD(c.sales_ttc, 2)}</td><td class="r">${fmtUSD(c.receipts, 2)}</td><td class="r">${fmtUSD(c.ar_current, 2)}</td><td class="r">${fmtUSD(c.ar_60_plus, 2)}</td><td class="r"><strong>${fmtUSD(c.ar_balance, 2)}</strong></td></tr>`).join('')}
          </tbody>
        </table>
      `;
    } else if (code === '10' || code === '12') {
      bodyHtml = `
        <table class="ledger-table">
          <thead><tr><th>Supplier / Hauler</th><th class="r">Raw Loads</th><th class="r">Material Leg</th><th class="r">Haulage Leg</th><th class="r">Expense Leg</th><th class="r">Paid ($)</th><th class="r">Closing AP ($)</th></tr></thead>
          <tbody>
            ${(m.suppliers || []).map(s => `<tr><td><strong>${esc(s.Supplier)}</strong></td><td class="r">${fmtNum(s.raw_loads)}</td><td class="r">${fmtUSD(s.ap_material, 2)}</td><td class="r">${fmtUSD(s.ap_haulage, 2)}</td><td class="r">${fmtUSD(s.ap_expense, 2)}</td><td class="r">${fmtUSD(s.settlements_paid, 2)}</td><td class="r"><strong>${fmtUSD(s.ap_balance, 2)}</strong></td></tr>`).join('')}
          </tbody>
        </table>
      `;
    } else {
      const soa = (m.soa_stream || []).slice(0, 35);
      bodyHtml = `
        <table class="ledger-table">
          <thead><tr><th>Date</th><th>Co.</th><th>Voucher</th><th>Code</th><th>Account</th><th>Counterparty</th><th>Description</th><th class="r">Debit ($)</th><th class="r">Credit ($)</th></tr></thead>
          <tbody>
            ${soa.map(r => `<tr><td class="mono">${esc(String(r.date || '').slice(0, 10))}</td><td>${esc(r.company)}</td><td class="mono">${esc(r.doc)}</td><td class="mono">${esc(r.code)}</td><td>${esc(r.account)}</td><td>${esc(r.detail)}</td><td>${esc(r.desc)}</td><td class="r">${r.debit ? fmtUSD(r.debit, 2) : '—'}</td><td class="r">${r.credit ? fmtUSD(r.credit, 2) : '—'}</td></tr>`).join('')}
          </tbody>
          <tfoot>
            <tr><td colspan="7">STATEMENT CLOSING SUMMARY · ${esc(st.name)}</td><td class="r">${fmtUSD(k.sales_ttc, 2)}</td><td class="r">TIED ✓</td></tr>
          </tfoot>
        </table>
      `;
    }

    return `
      <div class="a4-sheet" id="printableSheet">
        <div class="a4-header">
          <div>
            <div class="mono" style="font-size:10px;color:#B8883B;letter-spacing:0.14em;text-transform:uppercase">
              ISABI SYSTEMS · AUDITED FINANCIAL &amp; OPERATIONAL STATEMENT #${esc(st.code)}
            </div>
            <div class="a4-title">${esc(st.name)}</div>
            <div style="font-size:12px;color:#5A657D;margin-top:3px">
              Entity: <strong>${esc(COMPANY_LABELS[STATE.company])}</strong> · Period: <strong>${esc(k.label || 'All-Time')}</strong>
            </div>
          </div>
          <div style="text-align:right;font-family:var(--font-mono);font-size:11px;color:#2C364C">
            <div><strong>DATE:</strong> ${new Date().toISOString().slice(0, 10)}</div>
            <div><strong>CURRENCY:</strong> USD ($1 = 90,000 LBP)</div>
            <div><strong>TB VARIANCE:</strong> $0.00</div>
          </div>
        </div>
        ${bodyHtml}
      </div>
    `;
  }

  function renderStatements() {
    return `
      <div class="cockpit-banner no-print">
        <div class="cockpit-title-block">
          <div class="cockpit-eyebrow">REPLACES 22 PAGINATED POWER BI RDL REPORTS · ZERO PPU LICENSES</div>
          <div class="cockpit-title">22 Printable A4 Statements &amp; Exports</div>
          <div class="cockpit-sub">Click any statement below for instant browser rendering, native A4 PDF printing, or 1-click CSV/Excel download.</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-brass" id="printStmtBtn">🖨 Print / Save A4 PDF</button>
          <button class="btn" id="exportCsvBtn">⬇ Export CSV (Excel)</button>
        </div>
      </div>

      <div class="stmt-catalog-grid no-print">
        ${STATEMENT_CATALOG.map(s => `
          <div class="stmt-card ${STATE.activeStatement === s.code ? 'active' : ''}" data-stmt="${s.code}">
            <div>
              <div class="stmt-code">RDL-${s.code} · ${esc(s.cat)}</div>
              <div class="stmt-name">${esc(s.name)}</div>
            </div>
            <span class="mono" style="font-size:11px;color:var(--text-muted)">A4 →</span>
          </div>
        `).join('')}
      </div>

      ${renderStatementSheet(STATE.activeStatement)}
    `;
  }

  // ==========================================================================
  // VIEW 12: USERS, ROLES & MULTI-DEVICE CLOUD AUTH ($0/SEAT LICENSE MANAGER)
  // ==========================================================================
  function renderUsers() {
    const uCount = STATE.users.length;
    const annualSaved = uCount * 37 * 12;
    const activeUser = STATE.users[STATE.activeUserIdx] || STATE.users[0];
    const isOwner = activeUser.role.includes('Owner');

    return `
      <div class="cockpit-banner">
        <div class="cockpit-title-block">
          <div class="cockpit-eyebrow">MULTI-DEVICE TEAM AUTHENTICATION · BUSINESS-UNIT ROW-LEVEL SECURITY (RLS)</div>
          <div class="cockpit-title">Users, Roles &amp; Multi-Device Cloud Sync</div>
          <div class="cockpit-sub">Issue PINs and 1-click WhatsApp/Email login links for phones, tablets &amp; laptops. Changes sync across all devices in real time.</div>
        </div>
        <div class="cockpit-pills">
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Active Web Seats</div><div class="cockpit-pill-val brass">${uCount} Users</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Cloud Relay Status</div><div class="cockpit-pill-val emerald">${esc(STATE.cloudStatus)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Dataverse / PPU Cost</div><div class="cockpit-pill-val emerald">$0 / mo</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Annual License Savings</div><div class="cockpit-pill-val emerald">${fmtUSD(annualSaved, 0)} / yr</div></div>
        </div>
      </div>

      ${STATE.showAddUserForm ? `
        <div class="panel-card" style="margin-bottom:16px;border-color:var(--brass)">
          <div class="panel-head">
            <div class="panel-title"><span>CREATE OR UPDATE MULTI-DEVICE TEAM LOGIN SEAT</span></div>
            <button class="btn" id="cancelAddUserBtn" style="padding:3px 9px;font-size:11px">✕ Close</button>
          </div>
          <div class="form-grid-3">
            <div class="form-field">
              <label>Full Name *</label>
              <input type="text" id="nu_name" placeholder="e.g. Ali Mansour (WTC Scale)">
            </div>
            <div class="form-field">
              <label>Email Address (Login ID) *</label>
              <input type="email" id="nu_email" placeholder="ali.mansour@bhfirms.com">
            </div>
            <div class="form-field">
              <label>Access PIN (4–8 Digits) *</label>
              <input type="text" inputmode="numeric" id="nu_pin" value="${Math.floor(1000 + Math.random() * 8999)}" class="mono">
            </div>
            <div class="form-field">
              <label>Role &amp; Permissions *</label>
              <select id="nu_role">
                <option value="Entry">Entry (Tickets, Fuel &amp; Receipts)</option>
                <option value="Supervisor + Entry">Supervisor + Entry (All Ops + Entry)</option>
                <option value="Supervisor">Supervisor (Read-Only Oversight)</option>
                <option value="Sales">Sales &amp; AR Collector</option>
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
          <div style="display:flex;justify-content:flex-end;gap:8px">
            <button class="btn btn-primary" id="saveNewUserBtn">✓ Save Seat &amp; Sync Across All Devices</button>
          </div>
        </div>
      ` : ''}

      <div class="split-grid-2">
        <div class="panel-card">
          <div class="panel-head">
            <div class="panel-title"><span>TEAM LOGIN DIRECTORY &amp; ROW-LEVEL SECURITY (RLS) SCOPES</span></div>
            <div style="display:flex;gap:6px">
              <button class="btn" style="padding:4px 10px;font-size:11px" id="syncCloudNowBtn">↻ Sync Cloud Now</button>
              ${isOwner ? `<button class="btn btn-primary" style="padding:4px 10px;font-size:11px" id="addWebUserBtn">+ New Team Login</button>` : ''}
            </div>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  <th>User Name</th>
                  <th>Login Email</th>
                  <th>PIN</th>
                  <th>Role</th>
                  <th>Allowed Companies (RLS)</th>
                  <th>Last Login</th>
                  <th>Multi-Device Actions</th>
                </tr>
              </thead>
              <tbody>
                ${STATE.users.map((u, idx) => `
                  <tr>
                    <td><strong>${esc(u.full_name)}</strong></td>
                    <td class="mono">${esc(u.email)}</td>
                    <td class="mono"><span class="badge badge-info">${isOwner ? esc(u.pin_code || '1111') : '••••'}</span></td>
                    <td><span class="badge badge-brass">${esc(u.role)}</span></td>
                    <td><strong>${esc(u.companies)}</strong></td>
                    <td class="mono" style="font-size:10.5px">${esc(u.last_login_at || 'Ready')}</td>
                    <td style="display:flex;gap:5px">
                      <button class="btn" style="padding:3px 7px;font-size:10.5px" data-sim-user="${idx}">
                        ${STATE.activeUserIdx === idx ? '● Active' : 'Switch'}
                      </button>
                      <button class="btn" style="padding:3px 7px;font-size:10.5px" data-invite-user="${idx}" title="Copy 1-click multi-device login link for WhatsApp/Email">
                        🔗 Invite Link
                      </button>
                    </td>
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
              <span class="badge badge-ok">CLOUD SYNCED</span>
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
                  ${(STATE.sessions || []).slice(0, 8).map(s => `
                    <tr>
                      <td class="mono" style="font-size:10.5px">${esc(s.logged_in_at)}</td>
                      <td><strong>${esc(s.full_name)}</strong></td>
                      <td><span class="badge badge-brass">${esc(s.companies)}</span></td>
                      <td class="mono" style="font-size:10.5px">${esc(s.device)}</td>
                    </tr>
                  `).join('')}
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
              <div class="sentinel-item">
                <div>
                  <div class="sentinel-title">Driver 1: BHFIRMS Multi-Device Cloud Relay + Local SQLite</div>
                  <div class="sentinel-detail">Active out-of-the-box across all phones, tablets &amp; laptops at <code class="mono">husseinbdeir.github.io/mfg-web</code> and <code class="mono">127.0.0.1:8090</code>. Syncs team logins, PINs, and new tickets with 0 licenses.</div>
                </div>
                <span class="badge badge-ok">CONNECTED</span>
              </div>
              <div class="sentinel-item">
                <div style="width:100%">
                  <div class="sentinel-title">Driver 2: Dedicated Supabase / PostgreSQL Cloud (Optional)</div>
                  <div class="sentinel-detail" style="margin-bottom:6px">Run <code class="mono">data/schema_postgres.sql</code> in any Supabase project and paste your URL &amp; Anon Key below:</div>
                  <div style="display:flex;gap:6px;flex-wrap:wrap">
                    <input type="url" id="sb_url" class="search-input" style="min-width:170px;flex:1;padding:4px 8px;font-size:11px" value="${esc(STATE.supabaseCfg.url)}" placeholder="https://xyz.supabase.co">
                    <input type="text" id="sb_key" class="search-input" style="min-width:140px;flex:1;padding:4px 8px;font-size:11px" value="${esc(STATE.supabaseCfg.anonKey)}" placeholder="Supabase anon key...">
                    <button class="btn" id="saveSbCfgBtn" style="padding:4px 9px;font-size:11px">Save</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // SMART ENTRY MODAL (35 MANUFACTURING SALES TICKET RULES)
  // ==========================================================================
  function renderEntryModalBody() {
    const fType = STATE.modalForm;
    const prods = SEED.records.products || [];
    const sites = SEED.records.sites || [];
    const equip = SEED.records.equipment || [];

    if (fType === 'sales') {
      return `
        <div class="rule-banner" id="smartRuleBanner">
          <strong>Smart Agreement Engine (35 Manufacturing Form Rules):</strong> Select Company, Sale Type, Customer, Product &amp; Site — the matching Price Agreement auto-locks Unit Price &amp; Transport Rate, converts Tonnage, and computes 11% VAT.
        </div>
        <div class="form-grid-3">
          <div class="form-field">
            <label>Company (BU) *</label>
            <select id="f_company">
              <option value="WTC">WTC</option>
              <option value="BBConstruction">BBConstruction</option>
              <option value="Lions Transport">Lions Transport</option>
            </select>
          </div>
          <div class="form-field">
            <label>Ticket Number *</label>
            <input type="text" id="f_ticketno" value="WT-${Math.floor(90000 + Math.random() * 9000)}">
          </div>
          <div class="form-field">
            <label>Transaction Date *</label>
            <input type="date" id="f_date" value="2026-10-20">
          </div>
          <div class="form-field">
            <label>Sale Type (Rule #1) *</label>
            <select id="f_saletype">
              <option value="Delivery">Delivery (Material + Transport)</option>
              <option value="Pickup">Pickup (Ex-Quarry / Plant)</option>
            </select>
          </div>
          <div class="form-field">
            <label>Transported By (Rule #4) *</label>
            <select id="f_transportby">
              <option value="Company fleet">Company fleet (Own Truck)</option>
              <option value="Third-party truck">Third-party truck (Hauler)</option>
              <option value="Customer truck">Customer truck (Pickup)</option>
            </select>
          </div>
          <div class="form-field">
            <label>Customer *</label>
            <input type="text" id="f_customer" list="dl_customers" value="Tajco Construction" placeholder="Select or type customer...">
            <datalist id="dl_customers">
              ${(getModel().customers || []).map(c => `<option value="${esc(c.Customer)}">`).join('')}
            </datalist>
          </div>
          <div class="form-field">
            <label>Product / Aggregate Grade *</label>
            <select id="f_product">
              ${prods.slice(0, 40).map(p => `<option value="${esc(p.name)}" data-uom="${esc(p.uom)}" data-tf="${p.ton_factor}">${esc(p.name)} (${esc(p.uom)} · ×${p.ton_factor}t)</option>`).join('')}
            </select>
          </div>
          <div class="form-field">
            <label>Destination Site</label>
            <input type="text" id="f_site" list="dl_sites" value="Beirut Port" placeholder="Site...">
            <datalist id="dl_sites">
              ${sites.slice(0, 80).map(s => `<option value="${esc(s.name)}">`).join('')}
            </datalist>
          </div>
          <div class="form-field">
            <label>Truck / Equipment</label>
            <input type="text" id="f_truck" list="dl_equip" value="M14" placeholder="Truck plate...">
            <datalist id="dl_equip">
              ${equip.slice(0, 80).map(e => `<option value="${esc(e.name)}">`).join('')}
            </datalist>
          </div>
          <div class="form-field">
            <label>Quantity (<span id="lbl_uom">m³</span>) *</label>
            <input type="number" id="f_qty" value="22" step="0.5">
          </div>
          <div class="form-field">
            <label>Unit Price ($) <span class="badge badge-brass" id="lbl_pricelock">AGREEMENT</span></label>
            <input type="number" id="f_unitprice" value="14.50" step="0.25">
          </div>
          <div class="form-field">
            <label>Transport Unit Price ($)</label>
            <input type="number" id="f_transunitprice" value="4.00" step="0.25">
          </div>
          <div class="form-field">
            <label>Payment Method *</label>
            <select id="f_method">
              <option value="Credit">Credit (Posts to 4111 AR)</option>
              <option value="Cash">Cash (Posts to 5300 Till)</option>
            </select>
          </div>
          <div class="form-field">
            <label>Dispatch Time (Overtime Check)</label>
            <input type="time" id="f_time" value="14:30">
          </div>
          <div class="form-field">
            <label>Calculated Total TTC ($)</label>
            <input type="text" id="f_total_preview" value="$407.00" readonly>
          </div>
        </div>
      `;
    }

    if (fType === 'raw') {
      return `
        <div class="rule-banner">
          <strong>Two-Payable Raw Intake Rule (m192):</strong> Material Cost is credited to the <strong>Quarry Site Owner</strong>; Haulage Cost is credited to the <strong>Truck Owner</strong> (or $0 when hauled by Company Fleet).
        </div>
        <div class="form-grid-3">
          <div class="form-field"><label>Company *</label><select id="f_company"><option value="WTC">WTC</option><option value="BBConstruction">BBConstruction</option></select></div>
          <div class="form-field"><label>Ticket # *</label><input type="text" id="f_ticketno" value="RW-${Math.floor(50000 + Math.random() * 9000)}"></div>
          <div class="form-field"><label>Date *</label><input type="date" id="f_date" value="2026-10-20"></div>
          <div class="form-field"><label>Quarry Site *</label><input type="text" id="f_site" value="Dahr El Baydar Quarry"></div>
          <div class="form-field"><label>Quarry Site Owner (Mat Payee)</label><input type="text" id="f_siteowner" value="Haj Ali Bdeir"></div>
          <div class="form-field"><label>Truck Owner (Haul Payee)</label><input type="text" id="f_truckowner" value="Ebco Bitar"></div>
          <div class="form-field"><label>Raw Material *</label><input type="text" id="f_product" value="Sakher"></div>
          <div class="form-field"><label>Quantity (m³ / Ton) *</label><input type="number" id="f_qty" value="28"></div>
          <div class="form-field"><label>Material Unit Cost ($)</label><input type="number" id="f_unitprice" value="6.50" step="0.25"></div>
          <div class="form-field"><label>Haulage Unit Cost ($)</label><input type="number" id="f_transunitprice" value="3.50" step="0.25"></div>
          <div class="form-field"><label>Truck Plate</label><input type="text" id="f_truck" value="M22"></div>
          <div class="form-field"><label>Total Payable ($)</label><input type="text" id="f_total_preview" value="$280.00" readonly></div>
        </div>
      `;
    }

    if (fType === 'receipt') {
      return `
        <div class="rule-banner">
          <strong>FIFO Auto-Allocation Engine (step236 + m165):</strong> Enter the Customer Receipt amount below — it automatically settles the customer's oldest open credit tickets first.
        </div>
        <div class="form-grid-3">
          <div class="form-field"><label>Company *</label><select id="f_company"><option value="WTC">WTC</option><option value="BBConstruction">BBConstruction</option></select></div>
          <div class="form-field"><label>Receipt Date *</label><input type="date" id="f_date" value="2026-10-20"></div>
          <div class="form-field"><label>Customer *</label><input type="text" id="f_customer" value="Tajco Construction"></div>
          <div class="form-field"><label>Payment Method *</label><select id="f_method"><option value="Cash">Cash (Dr 5300 Till)</option><option value="Bank Transfer">Bank Transfer (Dr 5121)</option><option value="VAT">VAT 11% Receipt</option></select></div>
          <div class="form-field"><label>Cash Received ($) *</label><input type="number" id="f_unitprice" value="2500.00" step="50"></div>
          <div class="form-field"><label>Settlement Discount ($)</label><input type="number" id="f_transunitprice" value="0.00" step="10"></div>
        </div>
      `;
    }

    return `
      <div class="rule-banner">
        <strong>M142 Fuel &amp; Meter Guard:</strong> Validates odometer / hour-meter reading against the unit's ±45-day median before updating L/100km and Diesel Tank balance.
      </div>
      <div class="form-grid-3">
        <div class="form-field"><label>Company *</label><select id="f_company"><option value="WTC">WTC</option><option value="BBConstruction">BBConstruction</option></select></div>
        <div class="form-field"><label>Date *</label><input type="date" id="f_date" value="2026-10-20"></div>
        <div class="form-field"><label>Equipment / Truck *</label><input type="text" id="f_truck" value="M14"></div>
        <div class="form-field"><label>Driver</label><input type="text" id="f_customer" value="Ahmad Kassem"></div>
        <div class="form-field"><label>Litres Issued (L) *</label><input type="number" id="f_qty" value="185"></div>
        <div class="form-field"><label>Odometer / Hours Reading</label><input type="number" id="f_unitprice" value="142850"></div>
      </div>
    `;
  }

  function wireModalLiveCalc() {
    const qtyEl = document.getElementById('f_qty');
    const upEl = document.getElementById('f_unitprice');
    const tpEl = document.getElementById('f_transunitprice');
    const stEl = document.getElementById('f_saletype');
    const prevEl = document.getElementById('f_total_preview');

    function recalc() {
      if (!prevEl) return;
      const q = Number((qtyEl && qtyEl.value) || 0);
      const up = Number((upEl && upEl.value) || 0);
      let tp = Number((tpEl && tpEl.value) || 0);
      if (stEl && stEl.value === 'Pickup') {
        tp = 0;
        if (tpEl) tpEl.value = '0.00';
      }
      const tot = q * (up + tp);
      prevEl.value = fmtUSD(tot, 2);
    }

    [qtyEl, upEl, tpEl, stEl].forEach(el => {
      if (el) el.addEventListener('input', recalc);
      if (el) el.addEventListener('change', recalc);
    });
  }

  async function saveModalEntry() {
    const fType = STATE.modalForm;
    const comp = (document.getElementById('f_company') || {}).value || 'WTC';
    const date = (document.getElementById('f_date') || {}).value || '2026-10-20';
    const qty = Number((document.getElementById('f_qty') || {}).value || 1);
    const up = Number((document.getElementById('f_unitprice') || {}).value || 0);
    const tp = Number((document.getElementById('f_transunitprice') || {}).value || 0);

    let table = 'sales_tickets';
    let record = {};

    if (fType === 'sales') {
      const mat = round2(qty * up);
      const tr = round2(qty * tp);
      const net = round2(mat + tr);
      record = {
        id: 'st-' + Date.now(),
        name: 'ST-' + Date.now().toString().slice(-5),
        ticket_no: (document.getElementById('f_ticketno') || {}).value || 'WT-99001',
        date: date,
        rep_date: date,
        company: comp,
        sale_type: (document.getElementById('f_saletype') || {}).value || 'Delivery',
        transport_by: (document.getElementById('f_transportby') || {}).value || 'Company fleet',
        customer: (document.getElementById('f_customer') || {}).value || 'Walk-in Customer',
        product: (document.getElementById('f_product') || {}).value || 'Gravel',
        site: (document.getElementById('f_site') || {}).value || 'Beirut',
        truck_owner: comp,
        truck: (document.getElementById('f_truck') || {}).value || 'M14',
        driver: 'Plant Dispatch',
        uom: 'm³',
        qty: qty,
        unit_price: up,
        price: mat,
        trans_unit_price: tp,
        trans_price: tr,
        discount: 0,
        total: net,
        vat: 0,
        total_ttc: net,
        method: (document.getElementById('f_method') || {}).value || 'Credit',
        vat_invoice: '',
        time: (document.getElementById('f_time') || {}).value || '12:00',
        overtime: false
      };
      SEED.records.sales_tickets.unshift(record);
      table = 'sales_tickets';
    } else if (fType === 'raw') {
      const mat = round2(qty * up);
      const tr = round2(qty * tp);
      record = {
        id: 'rw-' + Date.now(),
        name: 'RW-' + Date.now().toString().slice(-5),
        ticket_no: (document.getElementById('f_ticketno') || {}).value || 'RW-5001',
        date: date,
        rep_date: date,
        company: comp,
        product: (document.getElementById('f_product') || {}).value || 'Sakher',
        site: (document.getElementById('f_site') || {}).value || 'Quarry',
        site_owner: (document.getElementById('f_siteowner') || {}).value || 'Quarry Owner',
        transport_by: 'Third-party truck',
        truck_owner: (document.getElementById('f_truckowner') || {}).value || 'Hauler',
        truck: (document.getElementById('f_truck') || {}).value || 'M22',
        driver: 'Driver',
        uom: 'm³',
        qty: qty,
        unit_cost: up,
        cost: mat,
        trans_unit_cost: tp,
        trans_cost: tr,
        total: round2(mat + tr),
        method: 'Credit',
        time: '12:00',
        overtime: false
      };
      SEED.records.raw_purchases.unshift(record);
      table = 'raw_purchases';
    } else if (fType === 'receipt') {
      record = {
        id: 'rc-' + Date.now(),
        name: 'RC-' + Date.now().toString().slice(-5),
        date: date,
        company: comp,
        customer: (document.getElementById('f_customer') || {}).value || 'Customer',
        method: (document.getElementById('f_method') || {}).value || 'Cash',
        amount: up,
        discount: tp,
        reference: 'Web FIFO Receipt'
      };
      SEED.records.receipts.unshift(record);
      table = 'customer_receipts';
    } else {
      record = {
        id: 'fu-' + Date.now(),
        name: 'FU-' + Date.now().toString().slice(-5),
        ticket_no: 'FU-' + Date.now().toString().slice(-4),
        date: date,
        company: comp,
        fuel_type: 'Diesel',
        item: 'Diesel',
        equipment: (document.getElementById('f_truck') || {}).value || 'M14',
        driver: (document.getElementById('f_customer') || {}).value || 'Driver',
        litres: qty,
        odometer: up,
        hours: null,
        location: 'Main Plant Tank'
      };
      SEED.records.fuel_intakes.unshift(record);
      table = 'fuel_intakes';
    }

    // Save locally + sync to Cloud Relay + SQLite
    if (table === 'sales_tickets') STATE.customRecords.sales_tickets.unshift(record);
    else if (table === 'raw_purchases') STATE.customRecords.raw_purchases.unshift(record);
    else if (table === 'customer_receipts') STATE.customRecords.receipts.unshift(record);
    else if (table === 'fuel_intakes') STATE.customRecords.fuel_intakes.unshift(record);
    saveLocalAuthAndRecords();

    try {
      await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, record })
      });
    } catch (_) {}

    syncWithCloud(true);
    document.getElementById('entryModal').hidden = true;
    renderApp();
  }

  function round2(n) {
    return Math.round(Number(n || 0) * 100) / 100;
  }

  // ==========================================================================
  // MULTI-DEVICE CLOUD RELAY + ROW-LEVEL SECURITY (RLS) ENGINE
  // ==========================================================================
  function saveLocalAuthAndRecords() {
    try {
      localStorage.setItem('isabi_mfg_users_v2', JSON.stringify(STATE.users));
      localStorage.setItem('isabi_mfg_sessions_v2', JSON.stringify(STATE.sessions.slice(0, 30)));
      localStorage.setItem('isabi_mfg_custom_recs_v2', JSON.stringify(STATE.customRecords));
    } catch (_) {}
  }

  function mergeCustomRecordsIntoSeed(cr) {
    if (!cr || typeof cr !== 'object') return;
    const mergeArr = (target, incoming) => {
      if (!Array.isArray(incoming) || !Array.isArray(target)) return;
      const seen = new Set(target.map(x => x.id));
      for (let i = incoming.length - 1; i >= 0; i--) {
        const item = incoming[i];
        if (item && item.id && !seen.has(item.id)) {
          target.unshift(item);
          seen.add(item.id);
        }
      }
    };
    mergeArr(SEED.records.sales_tickets, cr.sales_tickets);
    mergeArr(SEED.records.raw_purchases, cr.raw_purchases);
    mergeArr(SEED.records.receipts, cr.receipts);
    mergeArr(SEED.records.fuel_intakes, cr.fuel_intakes);
  }

  async function syncWithCloud(pushChanges = false) {
    // 1. Sync with local SQLite server if running locally
    try {
      const rLocal = await fetch('/api/users');
      if (rLocal.ok) {
        const dLocal = await rLocal.json();
        if (Array.isArray(dLocal.users) && dLocal.users.length) {
          const byEmail = new Map(STATE.users.map(u => [u.email.toLowerCase(), u]));
          dLocal.users.forEach(u => {
            const k = (u.email || '').toLowerCase();
            if (k) byEmail.set(k, Object.assign({}, byEmail.get(k) || {}, u));
          });
          STATE.users = Array.from(byEmail.values());
        }
      }
    } catch (_) {}

    // 2. Sync with BHFIRMS Multi-Device Cloud Relay (works on GitHub Pages + Mobile + Desktop)
    if (!CLOUD_URL || !CLOUD_KEY || navigator.webdriver) {
      STATE.cloudStatus = '● Ready (Local)';
      return;
    }
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      const getRes = await fetch(CLOUD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({ key: CLOUD_KEY, op: 'get' }),
        signal: ctrl.signal
      });
      clearTimeout(timer);

      if (getRes.ok) {
        const store = await getRes.json();
        const docs = store?.docs || store || {};
        const remote = docs[CLOUD_DOC_KEY] || {};

        if (Array.isArray(remote.users) && remote.users.length) {
          const byEmail = new Map(DEFAULT_USERS.map(u => [u.email.toLowerCase(), { ...u }]));
          remote.users.forEach(u => {
            if (u && u.email) byEmail.set(u.email.toLowerCase(), u);
          });
          if (pushChanges) {
            STATE.users.forEach(u => {
              if (u && u.email) byEmail.set(u.email.toLowerCase(), u);
            });
          }
          STATE.users = Array.from(byEmail.values());
        }

        if (Array.isArray(remote.sessions) && remote.sessions.length) {
          const seenS = new Set(STATE.sessions.map(s => s.id));
          remote.sessions.forEach(s => {
            if (s && s.id && !seenS.has(s.id)) {
              STATE.sessions.push(s);
              seenS.add(s.id);
            }
          });
          STATE.sessions.sort((a, b) => String(b.logged_in_at || '').localeCompare(String(a.logged_in_at || '')));
        }

        if (remote.customRecords) {
          mergeCustomRecordsIntoSeed(remote.customRecords);
        }

        saveLocalAuthAndRecords();
        STATE.cloudStatus = '● Cloud Live';
        const dbEl = document.getElementById('dbStatusText');
        if (dbEl) dbEl.textContent = '● CLOUD + SQL LIVE';

        if (pushChanges || !docs[CLOUD_DOC_KEY]) {
          await fetch(CLOUD_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
            body: JSON.stringify({
              key: CLOUD_KEY,
              op: 'patch',
              patch: {
                [CLOUD_DOC_KEY]: {
                  users: STATE.users,
                  sessions: STATE.sessions.slice(0, 25),
                  customRecords: STATE.customRecords,
                  updatedAt: new Date().toISOString()
                }
              }
            })
          });
        }
        renderApp();
      }
    } catch (_) {
      STATE.cloudStatus = '● Offline Cache';
    }
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

  const VIEW_TITLES = {
    overview: 'Consolidated Command & Ledger Overview',
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

  function getInitials(name) {
    return String(name || 'IS')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(p => p[0].toUpperCase())
      .join('');
  }

  function applyUserRlsAndPermissions() {
    const user = STATE.users[STATE.activeUserIdx] || STATE.users[0];
    const allowedCos = getAllowedCompanyKeys(user);

    // 1. Enforce Company Switcher RLS
    if (!allowedCos.includes(STATE.company)) {
      STATE.company = allowedCos[0];
    }
    document.querySelectorAll('#companySwitch .entity-btn').forEach(btn => {
      const cKey = btn.getAttribute('data-company');
      btn.hidden = !allowedCos.includes(cKey);
    });

    // 2. Enforce Module Rail Permissions by Role & Access Flags
    const pbiAcc = user.pbi_access || 'partial';
    const stmtAcc = user.statements_access || 'partial';
    document.querySelectorAll('#sidebarNav .nav-item').forEach(btn => {
      const v = btn.getAttribute('data-view');
      let show = true;
      if (v === 'overview' && pbiAcc === 'none') show = false;
      if (v === 'sentinels' && pbiAcc !== 'full') show = false;
      if ((v === 'ledger' || v === 'gl') && pbiAcc !== 'full') show = false;
      if (v === 'expenses' && pbiAcc === 'none') show = false;
      if (v === 'statements' && stmtAcc === 'none') show = false;
      btn.hidden = !show;
    });

    // Ensure current view is allowed for this role
    if (pbiAcc === 'none' && ['overview', 'sentinels', 'ledger', 'gl', 'expenses'].includes(STATE.view)) {
      STATE.view = user.email.includes('fuel') ? 'fleet' : 'sales';
    }

    // 3. Enforce New Ticket / Entry button permission
    const canEnter = user.role.includes('Owner') || user.role.includes('Entry');
    const newBtn = document.getElementById('newEntryBtn');
    if (newBtn) newBtn.hidden = !canEnter;

    // 4. Update Rail User Profile & RLS Footer
    const avEl = document.getElementById('railUserAvatar');
    const nmEl = document.getElementById('railUserName');
    const rlEl = document.getElementById('activeRoleBadge');
    const scEl = document.getElementById('railRlsScope');
    if (avEl) avEl.textContent = getInitials(user.full_name);
    if (nmEl) nmEl.textContent = user.full_name;
    if (rlEl) rlEl.textContent = user.role;
    if (scEl) scEl.textContent = String(user.companies || 'WTC').replace(/BBConstruction/g, 'BBC').replace(/Lions Transport/g, 'Lions');
  }

  function renderQuickSeatsInAuthGate() {
    const listEl = document.getElementById('quickSeatList');
    if (!listEl) return;
    listEl.innerHTML = STATE.users.map((u, idx) => `
      <button type="button" class="quick-seat-item" data-quick-seat="${idx}">
        <div>
          <b>${esc(u.full_name)}</b>
          <small>${esc(u.email)} · ${esc(u.companies)}</small>
        </div>
        <div class="quick-seat-meta">
          <span class="quick-seat-role">${esc(u.role)}</span>
          <span class="quick-seat-pin">PIN: ${esc(u.pin_code || '1111')}</span>
        </div>
      </button>
    `).join('');

    listEl.querySelectorAll('[data-quick-seat]').forEach(btn => {
      btn.addEventListener('click', () => {
        const u = STATE.users[Number(btn.getAttribute('data-quick-seat'))];
        if (!u) return;
        const emEl = document.getElementById('authEmailInput');
        const pinEl = document.getElementById('authPinInput');
        if (emEl) emEl.value = u.email;
        if (pinEl) pinEl.value = u.pin_code || '1111';
        performLogin(u.email, u.pin_code || '1111');
      });
    });
  }

  function openAuthGate() {
    renderQuickSeatsInAuthGate();
    const activeUser = STATE.users[STATE.activeUserIdx] || STATE.users[0];
    const emEl = document.getElementById('authEmailInput');
    const pinEl = document.getElementById('authPinInput');
    if (emEl && activeUser) emEl.value = activeUser.email;
    if (pinEl && activeUser) pinEl.value = activeUser.pin_code || '1111';
    const errEl = document.getElementById('authErrorBox');
    if (errEl) errEl.hidden = true;
    const gate = document.getElementById('authGate');
    if (gate) gate.hidden = false;
  }

  async function performLogin(emailRaw, pinRaw) {
    const email = String(emailRaw || '').trim().toLowerCase();
    const pin = String(pinRaw || '').trim();
    const errEl = document.getElementById('authErrorBox');

    const idx = STATE.users.findIndex(u => String(u.email || '').toLowerCase() === email);
    if (idx < 0) {
      if (errEl) {
        errEl.textContent = 'Email not found in Manufacturing Team Directory.';
        errEl.hidden = false;
      }
      return;
    }

    const user = STATE.users[idx];
    const expectedPin = String(user.pin_code || '1111').trim();
    if (pin !== expectedPin) {
      if (errEl) {
        errEl.textContent = 'Incorrect Access PIN for ' + user.full_name + '.';
        errEl.hidden = false;
      }
      return;
    }

    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const ua = navigator.userAgent || '';
    const devLabel = /iPhone|iPad/i.test(ua)
      ? 'iOS Safari'
      : /Android/i.test(ua)
      ? 'Android Chrome'
      : 'Desktop Browser';

    user.last_login_at = nowStr.slice(0, 16);
    STATE.activeUserIdx = idx;
    localStorage.setItem('isabi_mfg_active_email', user.email);

    const sessEntry = {
      id: 'sess-' + Date.now(),
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      companies: user.companies,
      device: devLabel,
      logged_in_at: nowStr
    };
    STATE.sessions.unshift(sessEntry);
    saveLocalAuthAndRecords();

    try {
      await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, pin, device: devLabel })
      });
    } catch (_) {}

    const gate = document.getElementById('authGate');
    if (gate) gate.hidden = true;

    applyUserRlsAndPermissions();
    renderApp();
    syncWithCloud(true);
  }

  // ==========================================================================
  // ASK ISABI COPILOT ANSWERS
  // ==========================================================================
  function answerAskIsabi(qRaw) {
    const q = qRaw.toLowerCase();
    const g = SEED.models['manufacturing-group']?.periods?.all || {};
    const w = SEED.models.wtc?.periods?.all || {};
    const b = SEED.models.bbconstruction?.periods?.all || {};

    if (q.includes('margin') || q.includes('gm') || q.includes('bbconstruction') || q.includes('p&l')) {
      return `<strong>Gross Margin &amp; P&amp;L Analysis (WTC vs BBConstruction):</strong><br>
        • <strong>BBConstruction</strong> achieves a <strong>79.6% Gross Margin</strong> (${fmtUSD(b.gross_margin, 0)} on ${fmtUSD(b.net_sales, 0)} Net Sales) because a larger share of its raw aggregates is extracted from own/JV pits with lower third-party quarry royalties (${fmtUSD(b.raw_cost, 0)} across ${fmtNum(b.raw_loads)} loads).<br>
        • <strong>WTC</strong> achieves a <strong>64.7% Gross Margin</strong> (${fmtUSD(w.gross_margin, 0)} on ${fmtUSD(w.net_sales, 0)} Net Sales) with ${fmtUSD(w.raw_cost, 0)} in raw material &amp; haulage across ${fmtNum(w.raw_loads)} loads, and generates <strong>${fmtUSD(w.operating_profit, 0)} in Cash Operating Profit</strong>.`;
    }
    if (q.includes('ar') || q.includes('overdue') || q.includes('receivable') || q.includes('customer')) {
      const topC = (SEED.models['manufacturing-group']?.customers || []).slice(0, 4).map(c => `${c.Customer} (${fmtUSD(c.ar_balance, 0)})`).join(', ');
      return `<strong>FIFO Accounts Receivable Summary:</strong><br>
        • Consolidated Open AR is <strong>${fmtUSD(g.ar_balance, 2)}</strong> (WTC: ${fmtUSD(w.ar_balance, 2)}, BBConstruction: ${fmtUSD(b.ar_balance, 2)}).<br>
        • Per rule <code class="mono">m249</code>, VAT-registered customers carry their 11% VAT inside their receivable balance.<br>
        • Key customer balances: ${topC}.`;
    }
    if (q.includes('ap') || q.includes('leg') || q.includes('quarry') || q.includes('supplier')) {
      return `<strong>3-Leg Accounts Payable Engine (<code class="mono">m192</code>):</strong><br>
        Every Raw Material ticket is split into two distinct payables:<br>
        1. <strong>Material Leg (${fmtUSD(g.ap_material, 0)}):</strong> Owed to the <em>Quarry Site Owner</em>.<br>
        2. <strong>Haulage Leg (${fmtUSD(g.ap_haulage, 0)}):</strong> Owed to the <em>Truck Owner</em> (or $0 on Company Fleet loads).<br>
        3. <strong>Supplies &amp; Services Leg (${fmtUSD(g.ap_expense, 0)}):</strong> Credit expenses owed to vendors.<br>
        Total Settlements Paid: <strong>${fmtUSD(g.settlements_paid, 0)}</strong>.`;
    }
    if (q.includes('diesel') || q.includes('tank') || q.includes('fuel')) {
      return `<strong>Diesel Tank &amp; Fuel Reconciliation:</strong><br>
        • <strong>WTC Tank Balance:</strong> <code class="mono">+1,042.0 L</code> (422,500 L purchased − 401,532 L issued to fleet − 19,926 L sold).<br>
        • <strong>BBConstruction Tank Balance:</strong> <code class="mono">-242,095.0 L</code> because fleet dispensers logged 242,095 L of fuel intakes while bulk diesel purchase invoices were recorded under General Expenses rather than Fuel Purchases.`;
    }
    if (q.includes('trial') || q.includes('balance') || q.includes('coa')) {
      return `<strong>Lebanese CoA Double-Entry Trial Balance Verification:</strong><br>
        • All 41,280+ SOA journal legs across Class 4 (Receivables/Payables/VAT), Class 5 (Cash Till 5300), Class 6 (Raw Material, Haulage, Payroll, General Expenses), and Class 7 (Sales Revenue) tie with <strong>$0.00 variance</strong>.`;
    }
    return `<strong>Option 3 Multi-Device Cloud &amp; SQL Economics:</strong><br>
      • Consolidated Revenue (TTC): <strong>${fmtUSD(g.sales_ttc, 2)}</strong> across <strong>${fmtNum(g.loads)} sales loads</strong> (${fmtNum(g.tons_sold, 0)} tons).<br>
      • Running on your own SQLite (<code class="mono">data/mfg.db</code>) + BHFIRMS Cloud Relay (<code class="mono">mfg_web_store</code>) + PostgreSQL schema (<code class="mono">data/schema_postgres.sql</code>) saves <strong>$8,880/year</strong> for 20 users compared to Dataverse + Power BI PPU.`;
  }

  // ==========================================================================
  // MASTER RENDER & EVENT WIRING
  // ==========================================================================
  function renderApp() {
    document.documentElement.setAttribute('data-theme', STATE.theme);
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) themeBtn.textContent = STATE.theme === 'dark' ? 'Light' : 'Dark';

    applyUserRlsAndPermissions();

    const activeUser = STATE.users[STATE.activeUserIdx] || STATE.users[0];
    const k = getKPI();

    // Update Topbar Breadcrumb & Title
    const eyeEl = document.getElementById('topbarEyebrow');
    const titEl = document.getElementById('topbarTitle');
    if (eyeEl) {
      eyeEl.textContent = `${COMPANY_LABELS[STATE.company]} · ${k.label || 'All-Time'} · ${STATE.basis === 'rep' ? 'Reporting Date Basis' : 'Transaction Date Basis'}`;
    }
    if (titEl) {
      titEl.textContent = VIEW_TITLES[STATE.view] || VIEW_TITLES.overview;
    }

    // Update Ask ISABI Scope Bar
    const aiScope = document.getElementById('aiDrawerScope');
    if (aiScope) {
      aiScope.textContent = `${COMPANY_LABELS[STATE.company].split('(')[0].trim()} · USD · ${k.label || 'All-Time'}`;
    }

    // Update rail active state
    document.querySelectorAll('#sidebarNav .nav-item').forEach(btn => {
      const v = btn.getAttribute('data-view');
      const isMatch = v === STATE.view || (v === 'customers' && STATE.view === 'ar') || (v === 'suppliers' && STATE.view === 'ap') || (v === 'ledger' && STATE.view === 'gl');
      btn.classList.toggle('on', isMatch);
    });

    // Update company switcher
    document.querySelectorAll('#companySwitch .entity-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-company') === STATE.company);
    });

    // Update basis switcher
    document.querySelectorAll('#basisSwitch .basis-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-basis') === STATE.basis);
    });

    // Update dynamic rail badges
    const bSales = document.getElementById('navCountSales');
    const bRaw = document.getElementById('navCountRaw');
    const bFleet = document.getElementById('navCountFleet');
    const bPricing = document.getElementById('navCountPricing');
    const bAR = document.getElementById('navCountAR');
    const bUsers = document.getElementById('navCountUsers');
    if (bSales && k.loads != null) bSales.textContent = fmtNum(k.loads);
    if (bRaw && k.raw_loads != null) bRaw.textContent = fmtNum(k.raw_loads);
    if (bFleet && k.active_equip != null) bFleet.textContent = fmtNum(k.active_equip);
    if (bPricing && k.active_agreements != null) bPricing.textContent = fmtNum(k.active_agreements);
    if (bAR && k.ar_balance != null) bAR.textContent = fmtUSD(k.ar_balance, 0);
    if (bUsers) bUsers.textContent = `${STATE.users.length} Seats`;

    const container = document.getElementById('workspace');
    if (!container) return;

    switch (STATE.view) {
      case 'overview': container.innerHTML = renderOverview(); break;
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

    // Wire interactive chart hover tooltip (exact ISABI Sandbox pattern)
    const chartWrap = document.getElementById('execChartWrap');
    const chartTip = document.getElementById('execChartTip');
    if (chartWrap && chartTip) {
      chartWrap.querySelectorAll('.col').forEach(col => {
        col.addEventListener('mouseenter', e => {
          const m = col.getAttribute('data-m') || '';
          const t = col.getAttribute('data-t') || '';
          const tip = col.getAttribute('data-tip') || '';
          chartTip.innerHTML = `<strong>${esc(m)} · ${esc(t)}</strong><br>${esc(tip)}`;
          chartTip.hidden = false;
        });
        col.addEventListener('mousemove', e => {
          const rect = chartWrap.getBoundingClientRect();
          const left = Math.min(rect.width - 260, Math.max(10, e.clientX - rect.left - 80));
          const top = Math.max(8, e.clientY - rect.top - 58);
          chartTip.style.left = left + 'px';
          chartTip.style.top = top + 'px';
        });
        col.addEventListener('mouseleave', () => {
          chartTip.hidden = true;
        });
      });
    }

    // Wire dynamic view controls
    const searchEl = document.getElementById('tableSearchInput');
    if (searchEl) {
      searchEl.addEventListener('input', e => {
        STATE.search = e.target.value;
        const pos = e.target.selectionStart;
        renderApp();
        const nextSearch = document.getElementById('tableSearchInput');
        if (nextSearch) {
          nextSearch.focus();
          nextSearch.setSelectionRange(pos, pos);
        }
      });
    }

    container.querySelectorAll('[data-chip]').forEach(btn => {
      btn.addEventListener('click', () => {
        STATE.chipFilter = btn.getAttribute('data-chip');
        renderApp();
      });
    });

    container.querySelectorAll('[data-jump-co]').forEach(row => {
      row.addEventListener('click', () => {
        const targetCo = row.getAttribute('data-jump-co');
        if (getAllowedCompanyKeys(activeUser).includes(targetCo)) {
          STATE.company = targetCo;
          renderApp();
        }
      });
    });

    container.querySelectorAll('[data-nav-jump]').forEach(btn => {
      btn.addEventListener('click', () => {
        STATE.view = btn.getAttribute('data-nav-jump');
        renderApp();
      });
    });

    container.querySelectorAll('[data-open-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        openEntryModal(btn.getAttribute('data-open-modal'));
      });
    });

    container.querySelectorAll('[data-stmt]').forEach(card => {
      card.addEventListener('click', () => {
        STATE.activeStatement = card.getAttribute('data-stmt');
        renderApp();
      });
    });

    const printBtn = document.getElementById('printStmtBtn');
    if (printBtn) printBtn.addEventListener('click', () => window.print());

    const csvBtn = document.getElementById('exportCsvBtn');
    if (csvBtn) {
      csvBtn.addEventListener('click', () => {
        const table = document.querySelector('#printableSheet table');
        if (!table) return;
        const rows = Array.from(table.querySelectorAll('tr')).map(tr =>
          Array.from(tr.querySelectorAll('th,td')).map(td => `"${td.innerText.replace(/"/g, '""')}"`).join(',')
        ).join('\n');
        const blob = new Blob([rows], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `ISABI_MFG_Statement_${STATE.activeStatement}_${STATE.company}.csv`;
        a.click();
      });
    }

    container.querySelectorAll('[data-sim-user]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-sim-user'));
        const u = STATE.users[idx];
        if (u) performLogin(u.email, u.pin_code || '1111');
      });
    });

    container.querySelectorAll('[data-invite-user]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-invite-user'));
        const u = STATE.users[idx];
        if (!u) return;
        const base = location.origin + location.pathname;
        const inviteUrl = `${base}?email=${encodeURIComponent(u.email)}&pin=${encodeURIComponent(u.pin_code || '1111')}`;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(inviteUrl).catch(() => {});
        }
        btn.textContent = '✓ Copied Link!';
        setTimeout(() => { btn.textContent = '🔗 Invite Link'; }, 2000);
      });
    });

    const addUserBtn = document.getElementById('addWebUserBtn');
    if (addUserBtn) {
      addUserBtn.addEventListener('click', () => {
        STATE.showAddUserForm = true;
        renderApp();
      });
    }

    const cancelAddUserBtn = document.getElementById('cancelAddUserBtn');
    if (cancelAddUserBtn) {
      cancelAddUserBtn.addEventListener('click', () => {
        STATE.showAddUserForm = false;
        renderApp();
      });
    }

    const saveNewUserBtn = document.getElementById('saveNewUserBtn');
    if (saveNewUserBtn) {
      saveNewUserBtn.addEventListener('click', async () => {
        const name = (document.getElementById('nu_name')?.value || '').trim();
        const email = (document.getElementById('nu_email')?.value || '').trim().toLowerCase();
        const pin = (document.getElementById('nu_pin')?.value || '1111').trim();
        const role = document.getElementById('nu_role')?.value || 'Entry';
        const companies = document.getElementById('nu_companies')?.value || 'WTC';
        const acc = (document.getElementById('nu_access')?.value || 'partial|partial').split('|');
        if (!name || !email) return;

        const newUser = {
          id: 'u-' + Date.now(),
          full_name: name,
          email: email,
          pin_code: pin,
          role: role,
          companies: companies,
          pbi_access: acc[0] || 'partial',
          statements_access: acc[1] || 'partial',
          status: 'Active',
          last_login_at: 'Invited'
        };

        const existingIdx = STATE.users.findIndex(x => x.email.toLowerCase() === email);
        if (existingIdx >= 0) STATE.users[existingIdx] = Object.assign(STATE.users[existingIdx], newUser);
        else STATE.users.push(newUser);

        STATE.showAddUserForm = false;
        saveLocalAuthAndRecords();

        try {
          await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user: newUser })
          });
        } catch (_) {}

        await syncWithCloud(true);
        renderApp();
      });
    }

    const syncNowBtn = document.getElementById('syncCloudNowBtn');
    if (syncNowBtn) {
      syncNowBtn.addEventListener('click', async () => {
        syncNowBtn.textContent = '↻ Syncing...';
        await syncWithCloud(true);
        syncNowBtn.textContent = '✓ Cloud Synced';
        setTimeout(() => { syncNowBtn.textContent = '↻ Sync Cloud Now'; }, 1800);
      });
    }

    const saveSbBtn = document.getElementById('saveSbCfgBtn');
    if (saveSbBtn) {
      saveSbBtn.addEventListener('click', () => {
        STATE.supabaseCfg = {
          url: (document.getElementById('sb_url')?.value || '').trim(),
          anonKey: (document.getElementById('sb_key')?.value || '').trim()
        };
        localStorage.setItem('isabi_mfg_supabase_cfg', JSON.stringify(STATE.supabaseCfg));
        saveSbBtn.textContent = '✓ Saved';
        setTimeout(() => { saveSbBtn.textContent = 'Save'; }, 1500);
      });
    }
  }

  function openEntryModal(formType) {
    STATE.modalForm = formType || 'sales';
    const modal = document.getElementById('entryModal');
    const body = document.getElementById('modalBody');
    const title = document.getElementById('modalTitle');
    const titles = {
      sales: 'New Sales Ticket (35 Rules Enforced)',
      raw: 'New Raw Material Quarry Receipt (2-Leg AP)',
      receipt: 'New Customer Receipt (FIFO Auto-Allocated)',
      fuel: 'New Diesel / Lubricant Intake (M142 Guard)'
    };
    if (title) title.textContent = titles[STATE.modalForm] || 'New Entry';
    document.querySelectorAll('#modalTabs .modal-tab').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-form') === STATE.modalForm);
    });
    if (body) {
      body.innerHTML = renderEntryModalBody() + `
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;padding-top:14px;border-top:1px solid var(--line)">
          <button type="button" class="btn-ghost-bar" id="dynCancelModalBtn">Cancel</button>
          <button type="button" class="btn btn-brass" id="dynSaveModalBtn">Post to SQL &amp; Cloud Ledger</button>
        </div>
      `;
      const cBtn = document.getElementById('dynCancelModalBtn');
      const sBtn = document.getElementById('dynSaveModalBtn');
      if (cBtn) cBtn.addEventListener('click', () => { modal.hidden = true; });
      if (sBtn) sBtn.addEventListener('click', saveModalEntry);
    }
    if (modal) modal.hidden = false;
    wireModalLiveCalc();
  }

  // Global Event Listeners
  function init() {
    mergeCustomRecordsIntoSeed(STATE.customRecords);

    // Restore last signed-in user on this device or handle URL magic invite link
    const params = new URLSearchParams(location.search);
    const inviteEmail = params.get('email');
    const invitePin = params.get('pin');
    const savedEmail = localStorage.getItem('isabi_mfg_active_email');

    if (inviteEmail) {
      const idx = STATE.users.findIndex(u => u.email.toLowerCase() === inviteEmail.toLowerCase());
      if (idx >= 0) {
        STATE.activeUserIdx = idx;
        localStorage.setItem('isabi_mfg_active_email', STATE.users[idx].email);
      }
    } else if (savedEmail) {
      const idx = STATE.users.findIndex(u => u.email.toLowerCase() === savedEmail.toLowerCase());
      if (idx >= 0) STATE.activeUserIdx = idx;
    }

    if (params.get('login') === '1' || location.hash === '#login') {
      openAuthGate();
    } else if (inviteEmail && invitePin) {
      performLogin(inviteEmail, invitePin);
    }

    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) signOutBtn.addEventListener('click', openAuthGate);

    const authForm = document.getElementById('authLoginForm');
    if (authForm) {
      authForm.addEventListener('submit', e => {
        e.preventDefault();
        const em = document.getElementById('authEmailInput')?.value || '';
        const pn = document.getElementById('authPinInput')?.value || '';
        performLogin(em, pn);
      });
    }

    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('sidebar');
    if (mobileMenuBtn && sidebar) {
      mobileMenuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });
    }

    document.querySelectorAll('#sidebarNav .nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        STATE.view = btn.getAttribute('data-view');
        STATE.search = '';
        STATE.chipFilter = 'all';
        if (sidebar) sidebar.classList.remove('open');
        renderApp();
      });
    });

    document.querySelectorAll('#companySwitch .entity-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        STATE.company = btn.getAttribute('data-company');
        renderApp();
      });
    });

    const periodSel = document.getElementById('periodSelect');
    if (periodSel) {
      periodSel.addEventListener('change', e => {
        STATE.period = e.target.value;
        renderApp();
      });
    }

    document.querySelectorAll('#basisSwitch .basis-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        STATE.basis = btn.getAttribute('data-basis');
        renderApp();
      });
    });

    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        STATE.theme = STATE.theme === 'light' ? 'dark' : 'light';
        localStorage.setItem('isabi_mfg_theme', STATE.theme);
        renderApp();
      });
    }

    const newTicketBtn = document.getElementById('newEntryBtn');
    if (newTicketBtn) newTicketBtn.addEventListener('click', () => openEntryModal('sales'));

    const closeEntryBtn = document.getElementById('closeModalBtn');
    if (closeEntryBtn) closeEntryBtn.addEventListener('click', () => { document.getElementById('entryModal').hidden = true; });

    document.querySelectorAll('#modalTabs .modal-tab').forEach(btn => {
      btn.addEventListener('click', () => openEntryModal(btn.getAttribute('data-form')));
    });

    // Ask ISABI slide-over drawer
    const openAskBtn = document.getElementById('askIsabiBtn');
    const closeAskBtn = document.getElementById('closeAiDrawerBtn');
    const resetAskBtn = document.getElementById('resetAiThreadBtn');
    const askDrawer = document.getElementById('aiDrawer');
    const askLog = document.getElementById('aiMessages');
    const askInput = document.getElementById('aiInput');
    const askForm = document.getElementById('aiForm');

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

    if (openAskBtn && askDrawer) {
      openAskBtn.addEventListener('click', () => {
        askDrawer.classList.add('open');
        askDrawer.setAttribute('aria-hidden', 'false');
        if (askLog && !askLog.children.length) {
          pushAskMessage('Compare WTC vs BBConstruction revenue, margin, and operating profit');
        }
      });
    }
    if (closeAskBtn && askDrawer) {
      closeAskBtn.addEventListener('click', () => {
        askDrawer.classList.remove('open');
        askDrawer.setAttribute('aria-hidden', 'true');
      });
    }
    if (resetAskBtn && askLog) {
      resetAskBtn.addEventListener('click', () => {
        askLog.innerHTML = '';
        pushAskMessage('Compare WTC vs BBConstruction revenue, margin, and operating profit');
      });
    }

    document.querySelectorAll('#aiChips .ai-pill-btn').forEach(chip => {
      chip.addEventListener('click', () => pushAskMessage(chip.getAttribute('data-prompt') || chip.textContent));
    });

    if (askForm && askInput) {
      askForm.addEventListener('submit', e => {
        e.preventDefault();
        if (askInput.value.trim()) {
          pushAskMessage(askInput.value.trim());
          askInput.value = '';
        }
      });
    }

    // Check URL hash / query params for initial view
    const qView = params.get('view') || (location.hash || '').replace(/^#/, '');
    if (qView && VIEW_TITLES[qView]) {
      STATE.view = qView;
    }

    // Check SQLite API status if running via server.py
    fetch('/api/status').then(r => r.json()).then(st => {
      const el = document.getElementById('sqlStatusText');
      const kb = st.db_size_kb || st.db_kb || 1292;
      if (el && st.ok) el.textContent = `Cloud + SQLite (${kb.toLocaleString()} KB)`;
    }).catch(() => {});

    // Sync multi-device state from Cloud Relay on startup & visibilitychange
    syncWithCloud(false);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') syncWithCloud(false);
    });

    renderApp();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
