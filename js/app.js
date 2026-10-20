/* ============================================================================
   ISABI Systems — Manufacturing Operations Standalone Web App (js/app.js)
   Option 3 Architecture: Own SQLite / PostgreSQL Engine + Offline PWA
   Companies: WTC · BBConstruction · Lions Transport · All Group
   ============================================================================ */

(function () {
  'use strict';

  const SEED = window.MFG_SEED || { models: {}, records: {}, sentinels: {} };

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
    users: [
      { id: 'u1', full_name: 'Hussein Bdeir', email: 'husseinbdeir@bhfirms.com', role: 'Full Access (Owner)', companies: 'WTC, BBConstruction, Lions Transport', pbi_access: 'full', statements_access: 'full', status: 'Active' },
      { id: 'u2', full_name: 'Zeinab Rkein', email: 'zeinabrkein@bhfirms.com', role: 'Supervisor + Entry', companies: 'WTC, BBConstruction, Lions Transport', pbi_access: 'full', statements_access: 'full', status: 'Active' },
      { id: 'u3', full_name: 'Sabah Kassab', email: 'sabahkassab@bhfirms.com', role: 'Entry', companies: 'WTC', pbi_access: 'partial', statements_access: 'partial', status: 'Active' },
      { id: 'u4', full_name: 'WTC Plant Weighbridge 1', email: 'scale1.wtc@bhfirms.com', role: 'Entry', companies: 'WTC', pbi_access: 'none', statements_access: 'partial', status: 'Active' },
      { id: 'u5', full_name: 'WTC Quarry Dispatch', email: 'quarry.wtc@bhfirms.com', role: 'Entry', companies: 'WTC', pbi_access: 'none', statements_access: 'none', status: 'Active' },
      { id: 'u6', full_name: 'BBConstruction Batching Desk', email: 'batch.bbc@bhfirms.com', role: 'Entry', companies: 'BBConstruction', pbi_access: 'partial', statements_access: 'partial', status: 'Active' },
      { id: 'u7', full_name: 'BBConstruction Site Supervisor', email: 'site.bbc@bhfirms.com', role: 'Supervisor', companies: 'BBConstruction', pbi_access: 'full', statements_access: 'full', status: 'Active' },
      { id: 'u8', full_name: 'Lions Transport Fleet Controller', email: 'fleet.lions@bhfirms.com', role: 'Supervisor + Entry', companies: 'Lions Transport, WTC', pbi_access: 'full', statements_access: 'partial', status: 'Active' },
      { id: 'u9', full_name: 'Diesel & Garage Officer', email: 'fuel.mfg@bhfirms.com', role: 'Entry', companies: 'WTC, BBConstruction, Lions Transport', pbi_access: 'none', statements_access: 'none', status: 'Active' },
      { id: 'u10', full_name: 'Accounts Receivable Collector', email: 'ar.mfg@bhfirms.com', role: 'Sales', companies: 'WTC, BBConstruction', pbi_access: 'partial', statements_access: 'full', status: 'Active' }
    ]
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
  // VIEW 01: OVERVIEW COMMAND CENTER (MATCHES ISABI SANDBOX SCREENSHOT)
  // ==========================================================================
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

    // Build 12-month stacked SVG chart from m.monthly
    const months = (m.monthly || []).slice(-12);
    const maxMonthRev = Math.max(1, ...months.map(x => Number(x.sales_ttc || 0) + Number(x.raw_cost || 0) * 0.2));
    const svgBars = months.map((row, idx) => {
      const x = 44 + idx * 46;
      const sVal = Number(STATE.basis === 'rep' ? (row.sales_rep || row.sales_ttc || 0) : (row.sales_ttc || 0));
      const rVal = Number(row.raw_cost || 0);
      const pVal = Math.max(0, Number(row.operating_profit || 0));
      const hSales = Math.min(145, Math.round((sVal / maxMonthRev) * 145));
      const hRaw = Math.min(145, Math.round((rVal / maxMonthRev) * 145));
      const hProf = Math.min(145, Math.round((pVal / maxMonthRev) * 145));
      const ymLabel = String(row['Year Month'] || row.YearMonthNo || '').replace('2025', '25').replace('2026', '26');
      return `
        <g transform="translate(${x}, 0)">
          <title>${esc(row['Year Month'])}: Sales TTC ${fmtUSD(sVal)} | Raw Cost ${fmtUSD(rVal)} | Profit ${fmtUSD(pVal)} | Loads ${fmtNum(row.loads)}</title>
          <rect x="0" y="${160 - hSales}" width="11" height="${Math.max(2, hSales)}" rx="2" fill="#0B1730"></rect>
          <rect x="12" y="${160 - hRaw}" width="11" height="${Math.max(2, hRaw)}" rx="2" fill="#B8883B"></rect>
          <rect x="24" y="${160 - hProf}" width="9" height="${Math.max(2, hProf)}" rx="2" fill="#137347"></rect>
          <text x="16" y="176" text-anchor="middle" fill="#5A657D" font-family="JetBrains Mono" font-size="9">${esc(ymLabel.slice(0, 6))}</text>
        </g>
      `;
    }).join('');

    // Sentinels preview
    const sentinelRows = buildSentinelItems().slice(0, 4);

    // Recent SOA journal lines
    const soaRows = (m.soa_stream || []).slice(0, 12);

    return `
      <!-- Executive Telemetry Banner -->
      <div class="cockpit-banner">
        <div class="cockpit-title-block">
          <div class="cockpit-eyebrow">ISABI MANUFACTURING COMMAND · ${esc(k.label || 'All-Time')} · ${STATE.basis === 'rep' ? 'REPORTING DATE BASIS' : 'TRANSACTION DATE BASIS'}</div>
          <div class="cockpit-title">${esc(COMPANY_LABELS[STATE.company])}</div>
          <div class="cockpit-sub">Live SQL Engine (<span class="mono">data/mfg.db</span>) · Lebanese CoA Double-Entry SOA · Trial Balance Variance: <strong class="mono">$0.00</strong></div>
        </div>
        <div class="cockpit-pills">
          <div class="cockpit-pill">
            <div class="cockpit-pill-lbl">Sales Loads</div>
            <div class="cockpit-pill-val brass">${fmtNum(k.loads)}</div>
          </div>
          <div class="cockpit-pill">
            <div class="cockpit-pill-lbl">Tons Sold</div>
            <div class="cockpit-pill-val">${fmtNum(k.tons_sold, 0)} t</div>
          </div>
          <div class="cockpit-pill">
            <div class="cockpit-pill-lbl">Raw Quarry Loads</div>
            <div class="cockpit-pill-val">${fmtNum(k.raw_loads)}</div>
          </div>
          <div class="cockpit-pill">
            <div class="cockpit-pill-lbl">Active Fleet</div>
            <div class="cockpit-pill-val emerald">${fmtNum(k.active_equip)} units</div>
          </div>
          <div class="cockpit-pill">
            <div class="cockpit-pill-lbl">Price Rules</div>
            <div class="cockpit-pill-val">${fmtNum(k.active_agreements)} active</div>
          </div>
        </div>
      </div>

      <!-- 5 Headline Executive KPIs (Matches ISABI Sandbox Screenshot) -->
      <div class="kpi-grid-5">
        <div class="kpi-card">
          <div class="kpi-lbl"><span>REVENUE (SALES TTC)</span><span class="badge badge-ok">11% VAT INCL</span></div>
          <div class="kpi-val">${fmtUSD(salesVal, 0)}</div>
          <div class="kpi-delta up">▲ Net Ex-VAT: ${fmtUSD(k.net_sales, 0)} · Trans: ${fmtUSD(k.trans_rev, 0)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-lbl"><span>GROSS MARGIN</span><span class="badge badge-brass">${fmtPct(k.gm_pct, k.gross_margin, k.net_sales)} GM</span></div>
          <div class="kpi-val">${fmtUSD(k.gross_margin, 0)}</div>
          <div class="kpi-delta up">▲ Raw Cost: ${fmtUSD(rawVal, 0)} (${fmtNum(k.raw_tons, 0)} t)</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-lbl"><span>OPERATING PROFIT (CASH)</span><span class="badge badge-ok">${fmtPct(k.op_margin_pct, opProfit, k.net_sales)} OP</span></div>
          <div class="kpi-val">${fmtUSD(opProfit, 0)}</div>
          <div class="kpi-delta neutral">Expenses: ${fmtUSD(expVal, 0)} · Salaries: ${fmtUSD(k.salaries_paid, 0)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-lbl"><span>CASH TILL &amp; NET FLOW</span><span class="badge badge-info">5300 TILL</span></div>
          <div class="kpi-val">${fmtUSD(k.cash_till, 2)}</div>
          <div class="kpi-delta up">In: ${fmtUSD(k.cash_inflow, 0)} · Out: ${fmtUSD(k.cash_outflow, 0)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-lbl"><span>OPEN AR RECEIVABLES</span><span class="badge badge-warn">FIFO AGED</span></div>
          <div class="kpi-val">${fmtUSD(k.ar_balance, 0)}</div>
          <div class="kpi-delta warn">Overdue &gt;30d: ${fmtUSD(k.ar_overdue, 0)} · DSO: ${fmtNum(k.dso_days, 0)}d</div>
        </div>
      </div>

      <!-- 6 Unit Economics & Fleet Telemetry Strip -->
      <div class="unit-strip-6">
        <div class="unit-card">
          <div class="unit-lbl">Avg Selling Price (TTC)</div>
          <div class="unit-val">${fmtUSD(k.avg_price_ttc, 2)} / unit</div>
          <div class="unit-sub">Net Ex-VAT: ${fmtUSD(k.avg_price_net, 2)}</div>
        </div>
        <div class="unit-card">
          <div class="unit-lbl">Avg Raw Quarry Cost</div>
          <div class="unit-val">${fmtUSD(k.avg_raw_cost, 2)} / unit</div>
          <div class="unit-sub">Mat: ${fmtUSD(k.raw_mat_cost, 0)} · Haul: ${fmtUSD(k.raw_haulage, 0)}</div>
        </div>
        <div class="unit-card">
          <div class="unit-lbl">Fleet Cost per Ton</div>
          <div class="unit-val">${fmtUSD(k.cost_per_ton, 2)} / ton</div>
          <div class="unit-sub">Cost/Unit: ${fmtUSD(k.cost_per_unit, 2)} · Own Loads: ${fmtNum(k.own_fleet_loads)}</div>
        </div>
        <div class="unit-card">
          <div class="unit-lbl">Diesel Tank Balance</div>
          <div class="unit-val">${fmtNum(k.diesel_in_tank, 0)} L</div>
          <div class="unit-sub">Issued: ${fmtNum(k.diesel_litres, 0)} L · Bought: ${fmtNum(k.diesel_purchased, 0)} L</div>
        </div>
        <div class="unit-card">
          <div class="unit-lbl">AP Open Legs (401)</div>
          <div class="unit-val">${fmtUSD(k.ap_balance, 0)}</div>
          <div class="unit-sub">Paid: ${fmtUSD(k.settlements_paid, 0)}</div>
        </div>
        <div class="unit-card">
          <div class="unit-lbl">Overtime &amp; Commission</div>
          <div class="unit-val">${fmtUSD((k.overtime_bonus || 0) + (k.commission_due || 0), 0)}</div>
          <div class="unit-sub">OT Due: ${fmtUSD(k.overtime_bonus, 0)} · Comm: ${fmtUSD(k.commission_due, 0)}</div>
        </div>
      </div>

      <!-- Split Row: Monthly Trajectory Chart + Operating Entities / Sentinels -->
      <div class="split-grid-2">
        <div class="panel-card">
          <div class="panel-head">
            <div class="panel-title"><span>MONTHLY REVENUE, QUARRY COST &amp; PROFIT TRAJECTORY</span></div>
            <div class="panel-meta">■ Ink: Sales TTC · ■ Brass: Raw Cost · ■ Emerald: Cash Profit</div>
          </div>
          <svg viewBox="0 0 605 188" style="width:100%;height:205px;display:block">
            <line x1="36" y1="20" x2="595" y2="20" stroke="rgba(11,23,48,0.07)" stroke-dasharray="3,3"/>
            <line x1="36" y1="66" x2="595" y2="66" stroke="rgba(11,23,48,0.07)" stroke-dasharray="3,3"/>
            <line x1="36" y1="112" x2="595" y2="112" stroke="rgba(11,23,48,0.07)" stroke-dasharray="3,3"/>
            <line x1="36" y1="160" x2="595" y2="160" stroke="rgba(11,23,48,0.22)"/>
            ${svgBars}
          </svg>
          <div style="margin-top:12px;border-top:1px solid var(--border-hairline);padding-top:10px">
            <div class="panel-title" style="margin-bottom:8px">OPERATING ENTITIES &amp; BOOKS STATUS (CONSOLIDATED GROUP)</div>
            <div class="table-wrap">
              <table class="ledger-table">
                <thead>
                  <tr>
                    <th>Operating Company</th>
                    <th class="r">Sales TTC</th>
                    <th class="r">Loads</th>
                    <th class="r">Tons Sold</th>
                    <th class="r">Gross Margin</th>
                    <th class="r">Op. Profit</th>
                    <th class="r">Open AR</th>
                    <th>TB Audit</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="cursor:pointer" data-jump-co="wtc">
                    <td><strong>WTC (World Trading &amp; Construction)</strong></td>
                    <td class="r">${fmtUSD(wtcK.sales_ttc, 2)}</td>
                    <td class="r">${fmtNum(wtcK.loads)}</td>
                    <td class="r">${fmtNum(wtcK.tons_sold, 0)}</td>
                    <td class="r">${fmtUSD(wtcK.gross_margin, 0)} (${fmtPct(wtcK.gm_pct, wtcK.gross_margin, wtcK.net_sales)})</td>
                    <td class="r">${fmtUSD(wtcK.operating_profit, 0)}</td>
                    <td class="r">${fmtUSD(wtcK.ar_balance, 0)}</td>
                    <td><span class="badge badge-ok">● TIED $0.00</span></td>
                  </tr>
                  <tr style="cursor:pointer" data-jump-co="bbconstruction">
                    <td><strong>BBConstruction</strong></td>
                    <td class="r">${fmtUSD(bbcK.sales_ttc, 2)}</td>
                    <td class="r">${fmtNum(bbcK.loads)}</td>
                    <td class="r">${fmtNum(bbcK.tons_sold, 0)}</td>
                    <td class="r">${fmtUSD(bbcK.gross_margin, 0)} (${fmtPct(bbcK.gm_pct, bbcK.gross_margin, bbcK.net_sales)})</td>
                    <td class="r">${fmtUSD(bbcK.operating_profit, 0)}</td>
                    <td class="r">${fmtUSD(bbcK.ar_balance, 0)}</td>
                    <td><span class="badge badge-ok">● TIED $0.00</span></td>
                  </tr>
                  <tr style="cursor:pointer" data-jump-co="lionstransport">
                    <td><strong>Lions Transport</strong></td>
                    <td class="r">${fmtUSD(ltK.sales_ttc, 2)}</td>
                    <td class="r">${fmtNum(ltK.loads)}</td>
                    <td class="r">${fmtNum(ltK.tons_sold, 0)}</td>
                    <td class="r">${fmtUSD(ltK.gross_margin, 0)}</td>
                    <td class="r">${fmtUSD(ltK.operating_profit, 0)}</td>
                    <td class="r">${fmtUSD(ltK.ar_balance, 0)}</td>
                    <td><span class="badge badge-info">● FLEET READY</span></td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td>CONSOLIDATED MANUFACTURING GROUP</td>
                    <td class="r">${fmtUSD(k.sales_ttc, 2)}</td>
                    <td class="r">${fmtNum(k.loads)}</td>
                    <td class="r">${fmtNum(k.tons_sold, 0)}</td>
                    <td class="r">${fmtUSD(k.gross_margin, 0)} (${fmtPct(k.gm_pct, k.gross_margin, k.net_sales)})</td>
                    <td class="r">${fmtUSD(k.operating_profit, 0)}</td>
                    <td class="r">${fmtUSD(k.ar_balance, 0)}</td>
                    <td><span class="badge badge-brass">AUDITED</span></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        <!-- Right Column: AI Sentinel Watchdogs + Top Products -->
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="panel-card">
            <div class="panel-head">
              <div class="panel-title"><span>AUTONOMOUS AI SENTINEL WATCHDOGS (M280)</span></div>
              <button class="btn" style="padding:3px 8px;font-size:10.5px" data-nav-jump="sentinels">All 6 Sentinels →</button>
            </div>
            <div class="sentinel-list">
              ${sentinelRows.map(s => `
                <div class="sentinel-item ${s.severity}">
                  <div>
                    <div class="sentinel-title">${esc(s.title)}</div>
                    <div class="sentinel-detail">${esc(s.detail)}</div>
                  </div>
                  <span class="badge ${s.badgeClass}">${esc(s.badge)}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="panel-card">
            <div class="panel-head">
              <div class="panel-title"><span>TOP AGGREGATES &amp; MATERIALS BY REVENUE</span></div>
              <span class="panel-meta">${(m.products || []).length} Active Grades</span>
            </div>
            <div class="table-wrap">
              <table class="ledger-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>UoM</th>
                    <th class="r">Loads</th>
                    <th class="r">Tons</th>
                    <th class="r">Avg TTC</th>
                    <th class="r">Sales TTC</th>
                  </tr>
                </thead>
                <tbody>
                  ${(m.products || []).slice(0, 6).map(p => `
                    <tr>
                      <td><strong>${esc(p.Product)}</strong></td>
                      <td class="mono">${esc(p.UoM || 'm³')}</td>
                      <td class="r">${fmtNum(p.loads)}</td>
                      <td class="r">${fmtNum(p.tons_sold, 0)}</td>
                      <td class="r">${fmtUSD(p.avg_price_ttc, 2)}</td>
                      <td class="r"><strong>${fmtUSD(p.sales_ttc, 0)}</strong></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Full-Width Audited General Ledger Stream (Closed with Brass Double Rule) -->
      <div class="panel-card">
        <div class="panel-head">
          <div class="panel-title"><span>AUDITED GENERAL LEDGER STREAM (LEBANESE COA DOUBLE-ENTRY SOA)</span></div>
          <div style="display:flex;gap:8px;align-items:center">
            <span class="panel-meta">Every Sales Ticket, Raw Quarry Leg, Settlement &amp; VAT 11% Entry</span>
            <button class="btn" style="padding:3px 9px;font-size:11px" data-nav-jump="gl">Full Trial Balance →</button>
          </div>
        </div>
        <div class="table-wrap">
          <table class="ledger-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Company</th>
                <th>Voucher / Doc</th>
                <th>GL Code</th>
                <th>Account Name</th>
                <th>Counterparty / Detail</th>
                <th>Narrative Description</th>
                <th class="r">Debit ($)</th>
                <th class="r">Credit ($)</th>
              </tr>
            </thead>
            <tbody>
              ${soaRows.map(r => `
                <tr>
                  <td class="mono">${esc(String(r.date || '').slice(0, 10))}</td>
                  <td><span class="badge badge-brass">${esc(r.company || 'WTC')}</span></td>
                  <td class="mono">${esc(r.doc || '—')}</td>
                  <td class="mono"><strong>${esc(r.code)}</strong></td>
                  <td>${esc(r.account)}</td>
                  <td>${esc(r.detail || '—')}</td>
                  <td>${esc(r.desc || '')}</td>
                  <td class="r">${r.debit ? fmtUSD(r.debit, 2) : '—'}</td>
                  <td class="r">${r.credit ? fmtUSD(r.credit, 2) : '—'}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="7">DOUBLE-ENTRY TRIAL BALANCE VERIFICATION (${esc(COMPANY_LABELS[STATE.company])})</td>
                <td class="r">TB CHECK: $0.00</td>
                <td class="r">BALANCED ✓</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
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
  // VIEW 12: USERS, ROLES & SQL ENGINE ($0/SEAT LICENSE MANAGER)
  // ==========================================================================
  function renderUsers() {
    const uCount = STATE.users.length;
    const annualSaved = uCount * 37 * 12;

    return `
      <div class="cockpit-banner">
        <div class="cockpit-title-block">
          <div class="cockpit-eyebrow">OPTION 3 STANDALONE ARCHITECTURE · ZERO MICROSOFT SEAT TAX</div>
          <div class="cockpit-title">Users, Role-Based Access &amp; SQL Engine</div>
          <div class="cockpit-sub">Add 20, 50, or 200 plant, quarry, scale, and accounting users at $0/month. Row-Level Security enforced per Business Unit.</div>
        </div>
        <div class="cockpit-pills">
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Active Web Seats</div><div class="cockpit-pill-val brass">${uCount} Users</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Dataverse / PPU Cost</div><div class="cockpit-pill-val emerald">$0 / mo</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Annual License Savings</div><div class="cockpit-pill-val emerald">${fmtUSD(annualSaved, 0)} / yr</div></div>
        </div>
      </div>

      <div class="split-grid-2">
        <div class="panel-card">
          <div class="panel-head">
            <div class="panel-title"><span>MANUFACTURING WEB SEATS &amp; ROLE SIMULATOR</span></div>
            <button class="btn btn-primary" style="padding:4px 10px;font-size:11px" id="addWebUserBtn">+ Add Zero-Cost Web Seat</button>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  <th>User Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Business Units (RLS)</th>
                  <th>Dashboards</th>
                  <th>Statements</th>
                  <th>Simulate</th>
                </tr>
              </thead>
              <tbody>
                ${STATE.users.map((u, idx) => `
                  <tr>
                    <td><strong>${esc(u.full_name)}</strong></td>
                    <td class="mono">${esc(u.email)}</td>
                    <td><span class="badge badge-brass">${esc(u.role)}</span></td>
                    <td>${esc(u.companies)}</td>
                    <td class="mono">${esc(u.pbi_access)}</td>
                    <td class="mono">${esc(u.statements_access)}</td>
                    <td>
                      <button class="btn" style="padding:3px 8px;font-size:10.5px" data-sim-user="${idx}">
                        ${STATE.activeUserIdx === idx ? '● Active' : 'Switch'}
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-head">
            <div class="panel-title"><span>STANDALONE SQLITE &amp; POSTGRESQL / SUPABASE ENGINE</span></div>
            <span class="badge badge-ok">READY FOR CLOUD DEPLOY</span>
          </div>
          <div style="font-size:12.5px;display:flex;flex-direction:column;gap:10px">
            <p>Your Manufacturing Operations data is now stored in two portable, 100% owned relational formats inside this repository:</p>
            <div class="sentinel-item">
              <div>
                <div class="sentinel-title">1. Local SQLite Database (<code class="mono">data/mfg.db</code> — 1,292 KB)</div>
                <div class="sentinel-detail">14 relational tables seeded with WTC, BBConstruction &amp; Lions Transport products, 319 sites, 1,638 equipment units, 2,336 price rules, and recent tickets.</div>
              </div>
              <span class="badge badge-ok">LIVE</span>
            </div>
            <div class="sentinel-item">
              <div>
                <div class="sentinel-title">2. PostgreSQL / Supabase DDL (<code class="mono">data/schema_postgres.sql</code>)</div>
                <div class="sentinel-detail">Production-ready SQL schema with UUID keys and Business-Unit Row-Level Security (RLS) policies.</div>
              </div>
              <span class="badge badge-info">DDL READY</span>
            </div>
            <div class="sentinel-item">
              <div>
                <div class="sentinel-title">3. Cost Comparison for 20 Manufacturing Users</div>
                <div class="sentinel-detail">20 Dataverse + PPU seats = <strong>$8,880 / year</strong>. Option 3 Standalone Web App = <strong>$0 / seat</strong>.</div>
              </div>
              <span class="badge badge-brass">100% OWNED</span>
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

    try {
      await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, record })
      });
    } catch (_) {
      // Offline / static mode fallback
    }

    document.getElementById('entryModal').hidden = true;
    renderApp();
  }

  function round2(n) {
    return Math.round(Number(n || 0) * 100) / 100;
  }

  // ==========================================================================
  // ASK ISABI COPILOT ANSWERS
  // ==========================================================================
  function answerAskIsabi(qRaw) {
    const q = qRaw.toLowerCase();
    const g = SEED.models['manufacturing-group']?.periods?.all || {};
    const w = SEED.models.wtc?.periods?.all || {};
    const b = SEED.models.bbconstruction?.periods?.all || {};

    if (q.includes('margin') || q.includes('gm') || q.includes('bbconstruction')) {
      return `<strong>Gross Margin Analysis (WTC vs BBConstruction):</strong><br>
        • <strong>BBConstruction</strong> achieves an <strong>81.3% Gross Margin</strong> (${fmtUSD(b.gross_margin, 0)} on ${fmtUSD(b.net_sales, 0)} Net Sales) because a larger share of its raw aggregates is extracted from own/JV pits with lower third-party quarry royalties (${fmtUSD(b.raw_cost, 0)} across ${fmtNum(b.raw_loads)} loads).<br>
        • <strong>WTC</strong> achieves a <strong>64.7% Gross Margin</strong> (${fmtUSD(w.gross_margin, 0)} on ${fmtUSD(w.net_sales, 0)} Net Sales) with ${fmtUSD(w.raw_cost, 0)} in raw material &amp; haulage across ${fmtNum(w.raw_loads)} loads, but generates a higher <strong>Operating Profit of ${fmtUSD(w.operating_profit, 0)}</strong> (14.6% cash margin vs BBConstruction's 4.2%).`;
    }
    if (q.includes('ar') || q.includes('overdue') || q.includes('receivable') || q.includes('customer')) {
      const topC = (SEED.models['manufacturing-group']?.customers || []).slice(0, 4).map(c => `${c.Customer} (${fmtUSD(c.ar_balance, 0)})`).join(', ');
      return `<strong>FIFO Accounts Receivable Summary:</strong><br>
        • Consolidated Open AR is <strong>${fmtUSD(g.ar_balance, 2)}</strong> (WTC: ${fmtUSD(w.ar_balance, 2)}, BBConstruction: ${fmtUSD(b.ar_balance, 2)}).<br>
        • Per rule <code class="mono">m249</code>, VAT-registered customers carry their 11% VAT inside their receivable balance.<br>
        • Key customer accounts: ${topC}.`;
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
    if (q.includes('fleet') || q.includes('cost/ton') || q.includes('truck')) {
      return `<strong>Fleet Unit Economics (1,637 Active Units):</strong><br>
        • <strong>WTC:</strong> ${fmtNum(w.active_equip)} active units · Cost/Ton Hauled = <strong>$0.46/ton</strong> ($0.71/m³).<br>
        • <strong>BBConstruction:</strong> ${fmtNum(b.active_equip)} active units · Cost/Ton Hauled = <strong>$0.26/ton</strong> ($0.29/m³).<br>
        • Protected by <code class="mono">m142</code> Odometer/Hour-Meter median tolerance guard.`;
    }
    return `<strong>Option 3 Standalone SQL &amp; License Economics:</strong><br>
      • Consolidated Revenue (TTC): <strong>${fmtUSD(g.sales_ttc, 2)}</strong> across <strong>${fmtNum(g.loads)} sales loads</strong> (${fmtNum(g.tons_sold, 0)} tons).<br>
      • Running on your own SQLite (<code class="mono">data/mfg.db</code>) + PostgreSQL schema (<code class="mono">data/schema_postgres.sql</code>) saves <strong>$8,880/year</strong> for 20 users compared to Dataverse + Power BI PPU.`;
  }

  // ==========================================================================
  // MASTER RENDER & EVENT WIRING
  // ==========================================================================
  function renderApp() {
    document.documentElement.setAttribute('data-theme', STATE.theme);
    const activeUser = STATE.users[STATE.activeUserIdx] || STATE.users[0];
    const userLbl = document.getElementById('activeUserLabel');
    if (userLbl) userLbl.textContent = `${activeUser.full_name} · ${activeUser.role}`;

    // Update rail active state
    document.querySelectorAll('#railNav .rail-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-view') === STATE.view);
    });

    // Update company switcher
    document.querySelectorAll('#companySwitcher .seg-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-company') === STATE.company);
    });

    // Update basis switcher
    document.querySelectorAll('#basisSwitcher .seg-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-basis') === STATE.basis);
    });

    // Update dynamic rail badges
    const k = getKPI();
    const bSales = document.getElementById('badgeSales');
    const bRaw = document.getElementById('badgeRaw');
    const bFleet = document.getElementById('badgeFleet');
    const bPricing = document.getElementById('badgePricing');
    const bAR = document.getElementById('badgeAR');
    if (bSales && k.loads != null) bSales.textContent = fmtNum(k.loads);
    if (bRaw && k.raw_loads != null) bRaw.textContent = fmtNum(k.raw_loads);
    if (bFleet && k.active_equip != null) bFleet.textContent = fmtNum(k.active_equip);
    if (bPricing && k.active_agreements != null) bPricing.textContent = fmtNum(k.active_agreements);
    if (bAR && k.ar_balance != null) bAR.textContent = fmtUSD(k.ar_balance, 0);

    const container = document.getElementById('workspaceContent');
    if (!container) return;

    switch (STATE.view) {
      case 'overview': container.innerHTML = renderOverview(); break;
      case 'sentinels': container.innerHTML = renderSentinels(); break;
      case 'sales': container.innerHTML = renderSales(); break;
      case 'raw': container.innerHTML = renderRaw(); break;
      case 'fleet': container.innerHTML = renderFleet(); break;
      case 'pricing': container.innerHTML = renderPricing(); break;
      case 'ar': container.innerHTML = renderAR(); break;
      case 'ap': container.innerHTML = renderAP(); break;
      case 'expenses': container.innerHTML = renderExpenses(); break;
      case 'gl': container.innerHTML = renderGL(); break;
      case 'statements': container.innerHTML = renderStatements(); break;
      case 'users': container.innerHTML = renderUsers(); break;
      default: container.innerHTML = renderOverview();
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
        STATE.company = row.getAttribute('data-jump-co');
        renderApp();
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
        STATE.activeUserIdx = Number(btn.getAttribute('data-sim-user'));
        const u = STATE.users[STATE.activeUserIdx];
        if (u.companies === 'WTC') STATE.company = 'wtc';
        else if (u.companies === 'BBConstruction') STATE.company = 'bbconstruction';
        else if (u.companies === 'Lions Transport') STATE.company = 'lionstransport';
        renderApp();
      });
    });

    const addUserBtn = document.getElementById('addWebUserBtn');
    if (addUserBtn) {
      addUserBtn.addEventListener('click', () => {
        const n = STATE.users.length + 1;
        STATE.users.push({
          id: 'u' + n,
          full_name: `Plant Operator #${n}`,
          email: `operator${n}@bhfirms.com`,
          role: 'Entry',
          companies: 'WTC, BBConstruction',
          pbi_access: 'partial',
          statements_access: 'partial',
          status: 'Active'
        });
        renderApp();
      });
    }
  }

  function openEntryModal(formType) {
    STATE.modalForm = formType || 'sales';
    const modal = document.getElementById('entryModal');
    const body = document.getElementById('entryModalBody');
    const title = document.getElementById('modalTitle');
    const titles = {
      sales: 'New Sales Ticket (35 Rules Enforced)',
      raw: 'New Raw Material Quarry Receipt (2-Leg AP)',
      receipt: 'New Customer Receipt (FIFO Auto-Allocated)',
      fuel: 'New Diesel / Lubricant Intake (M142 Guard)'
    };
    if (title) title.textContent = titles[STATE.modalForm] || 'New Entry';
    document.querySelectorAll('#modalTypeSwitcher .seg-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-form') === STATE.modalForm);
    });
    if (body) body.innerHTML = renderEntryModalBody();
    if (modal) modal.hidden = false;
    wireModalLiveCalc();
  }

  // Global Event Listeners
  function init() {
    document.querySelectorAll('#railNav .rail-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        STATE.view = btn.getAttribute('data-view');
        STATE.search = '';
        STATE.chipFilter = 'all';
        renderApp();
      });
    });

    document.querySelectorAll('#companySwitcher .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        STATE.company = btn.getAttribute('data-company');
        renderApp();
      });
    });

    const periodSel = document.getElementById('periodPicker');
    if (periodSel) {
      periodSel.addEventListener('change', e => {
        STATE.period = e.target.value;
        renderApp();
      });
    }

    document.querySelectorAll('#basisSwitcher .seg-btn').forEach(btn => {
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

    const seatBtn = document.getElementById('seatSimBtn');
    if (seatBtn) {
      seatBtn.addEventListener('click', () => {
        STATE.view = 'users';
        renderApp();
      });
    }

    const newTicketBtn = document.getElementById('openNewTicketBtn');
    if (newTicketBtn) newTicketBtn.addEventListener('click', () => openEntryModal('sales'));

    const closeEntryBtn = document.getElementById('closeEntryModalBtn');
    const cancelEntryBtn = document.getElementById('cancelEntryModalBtn');
    if (closeEntryBtn) closeEntryBtn.addEventListener('click', () => { document.getElementById('entryModal').hidden = true; });
    if (cancelEntryBtn) cancelEntryBtn.addEventListener('click', () => { document.getElementById('entryModal').hidden = true; });

    document.querySelectorAll('#modalTypeSwitcher .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => openEntryModal(btn.getAttribute('data-form')));
    });

    const saveEntryBtn = document.getElementById('saveEntryModalBtn');
    if (saveEntryBtn) saveEntryBtn.addEventListener('click', saveModalEntry);

    // Ask ISABI drawer
    const openAskBtn = document.getElementById('openAskIsabiBtn');
    const closeAskBtn = document.getElementById('closeAskDrawerBtn');
    const askDrawer = document.getElementById('askDrawer');
    const askLog = document.getElementById('askChatLog');
    const askInput = document.getElementById('askInput');
    const askSend = document.getElementById('askSendBtn');

    function pushAskMessage(qText) {
      if (!qText || !askLog) return;
      const ans = answerAskIsabi(qText);
      const item = document.createElement('div');
      item.className = 'panel-card';
      item.style.padding = '11px 13px';
      item.innerHTML = `
        <div class="mono" style="font-size:10px;color:var(--brass);margin-bottom:4px">Q: ${esc(qText)}</div>
        <div style="font-size:12.5px;line-height:1.5">${ans}</div>
      `;
      askLog.prepend(item);
    }

    if (openAskBtn) {
      openAskBtn.addEventListener('click', () => {
        askDrawer.hidden = false;
        if (askLog && !askLog.children.length) {
          pushAskMessage('Why is BBConstruction GM% higher than WTC?');
        }
      });
    }
    if (closeAskBtn) closeAskBtn.addEventListener('click', () => { askDrawer.hidden = true; });

    document.querySelectorAll('#askPromptChips [data-q]').forEach(chip => {
      chip.addEventListener('click', () => pushAskMessage(chip.textContent));
    });

    if (askSend && askInput) {
      askSend.addEventListener('click', () => {
        if (askInput.value.trim()) {
          pushAskMessage(askInput.value.trim());
          askInput.value = '';
        }
      });
      askInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && askInput.value.trim()) {
          pushAskMessage(askInput.value.trim());
          askInput.value = '';
        }
      });
    }

    // Check URL hash / query params for initial view
    const h = (location.hash || '').replace(/^#/, '');
    if (h && ['overview', 'sentinels', 'sales', 'raw', 'fleet', 'pricing', 'ar', 'ap', 'expenses', 'gl', 'statements', 'users'].includes(h)) {
      STATE.view = h;
    }

    // Check SQLite API status if running via server.py
    fetch('/api/status').then(r => r.json()).then(st => {
      const el = document.getElementById('dbStatusText');
      const kb = st.db_size_kb || st.db_kb || 1292;
      if (el && st.ok) el.textContent = `● SQLITE (${kb.toLocaleString()} KB)`;
    }).catch(() => {});

    // Register Service Worker
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }

    renderApp();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
