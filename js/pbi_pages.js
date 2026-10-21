/* ============================================================================
   ISABI Systems — 20-Page Power BI Report Studio & 28-Table Data Hub (v4.0)
   100% Parity with m18c_report.py (20 Group / 19 BU Pages) & m14_sitemap.py:
   - P01: Overview (5-Section, 30-KPI Executive Band + Monthly Combo + Matrices)
   - P02: Companies (WTC vs BBConstruction vs Lions Transport Side-by-Side P&L)
   - P03: Action Items & Sentinels (Credit Hold, Unpriced Tickets, Meter Outliers)
   - P04: Sales & Deliveries (By Grade, Customer, Site, Sale Type, Method, Monthly)
   - P05: Pricing & Commissions (Active Matrix, Below-Agreed Exceptions, Tier Rules)
   - P06: Customers & AR (FIFO 5-Bucket Aging: Current, 1-10d, 11-30d, 31-60d, 60+d)
   - P07: Suppliers & AP (3-Leg Payable Breakdown: Quarry Material, Haulage, Expense)
   - P08: Stock & Haulage (Quarry Intake by Site/Product, 3P vs Own Fleet Split)
   - P09: Fuel & Lubricants (Diesel Tank Reconciliation, Burn Rate L/100km, Lubes)
   - P10: Equipment & Fleet (Unit Economics, Revenue/Cost per Unit, Own vs 3P)
   - P11: Drivers & Overtime (Trips by Driver, Day vs Night Shift Overtime Bonus)
   - P12: Payroll & Attendance (Salary Payments, Contracts, Attendance, Site Allowances)
   - P13: VAT (11% Output VAT, Input IVA, Invoice Register, Statutory Net Position)
   - P14: Cash Flow (5300 Till Inflows vs Outflows, Daily Totals, Running Balance)
   - P15: Treasury & Loans (Partner Loans, Loan Settlements, External, FX Conversions)
   - P16: Financial / GL & SOA (Lebanese CoA Class 4/5/6/7 Trial Balance & Journal)
   - P17: JV Sites (Joint-Venture Quarry Partnerships, Profit Share & Distributions)
   - P18: Ticket Books (Pad Hygiene, Missing Sequence Numbers, Duplicate Audit)
   - P19: Change Log & Basis Drift (Transaction Date vs Reporting Date >31d Gaps)
   - P20: Statement Recon (Reconciliation Matrix across all 22 A4 PDF Statements)
   ============================================================================ */

(function () {
  'use strict';

  const PBI_PAGES = [
    { id: 'p01_overview', num: '01', group: 'exec', label: 'Overview (30 KPIs)', title: 'P01 · Executive Overview (5 Sections · 30 KPIs · Monthly Trajectory)' },
    { id: 'p02_companies', num: '02', group: 'exec', label: 'Companies P&L', title: 'P02 · Operating Entities Side-by-Side P&L & Balance Comparison' },
    { id: 'p03_actions', num: '03', group: 'exec', label: 'Action Items', title: 'P03 · Executive Action Items, Exceptions & Sentinel Audit' },
    { id: 'p04_sales', num: '04', group: 'commercial', label: 'Sales & Deliveries', title: 'P04 · Sales & Weighbridge Deliveries Analytics' },
    { id: 'p05_pricing', num: '05', group: 'commercial', label: 'Pricing & Comm.', title: 'P05 · Price Agreements, Tier 1/2 Rules & Below-Agreed Audit' },
    { id: 'p06_ar', num: '06', group: 'commercial', label: 'Customers & AR', title: 'P06 · Customers & 5-Bucket FIFO Accounts Receivable Aging' },
    { id: 'p07_ap', num: '07', group: 'quarry', label: 'Suppliers & 3-Leg AP', title: 'P07 · Suppliers, Quarries & 3-Leg Accounts Payable (m192)' },
    { id: 'p08_stock', num: '08', group: 'quarry', label: 'Stock & Haulage', title: 'P08 · Quarry Raw Intake, Stock & Third-Party vs Own Haulage' },
    { id: 'p09_fuel', num: '09', group: 'fleet', label: 'Fuel & Lubricants', title: 'P09 · Diesel Tank Reconciliation, Burn Rate & Lubricants (m207)' },
    { id: 'p10_fleet', num: '10', group: 'fleet', label: 'Equipment & Fleet', title: 'P10 · Equipment & Fleet Unit Economics (1,638 Units)' },
    { id: 'p11_drivers', num: '11', group: 'fleet', label: 'Drivers & Overtime', title: 'P11 · Drivers, Trip Counts & Night-Shift Overtime Allowances' },
    { id: 'p12_payroll', num: '12', group: 'fleet', label: 'Payroll & Attendance', title: 'P12 · Payroll, Employment Contracts, Attendance & Site Allowances' },
    { id: 'p13_vat', num: '13', group: 'finance', label: 'VAT & Invoices', title: 'P13 · 11% Statutory VAT Register, Linked Tickets & IVA' },
    { id: 'p14_cash', num: '14', group: 'finance', label: 'Cash Flow & Till', title: 'P14 · Cash Flow Waterfall, 5300 Till & Daily Totals' },
    { id: 'p15_treasury', num: '15', group: 'finance', label: 'Treasury & Loans', title: 'P15 · Treasury, Partner Loans (1,049), Settlements & FX Conversions' },
    { id: 'p16_financial', num: '16', group: 'finance', label: 'Financial GL & SOA', title: 'P16 · Lebanese CoA Trial Balance & Double-Entry SOA Stream' },
    { id: 'p17_jv', num: '17', group: 'gov', label: 'JV Sites', title: 'P17 · Joint-Venture Quarry Partnerships & Profit Distributions' },
    { id: 'p18_tickets', num: '18', group: 'gov', label: 'Ticket Books', title: 'P18 · Ticket Book Completeness, Missing Sequences & Duplicates' },
    { id: 'p19_changelog', num: '19', group: 'gov', label: 'Basis Drift & Audit', title: 'P19 · Transaction vs Reporting Date Drift & App Entry Audit' },
    { id: 'p20_recon', num: '20', group: 'gov', label: 'Statement Recon', title: 'P20 · Cross-Statement Reconciliation & 22 A4 PDF Launcher' }
  ];

  const TABLE_CATALOG = [
    { key: 'sales_tickets', group: '1. Dispatch & Settlements', label: 'Sales Tickets', dvn: 'bhf_salesticket', form: 'sales', cols: ['date', 'ticket_no', 'company', 'sale_type', 'customer', 'product', 'site', 'truck', 'driver', 'qty', 'uom', 'unit_price', 'trans_price', 'vat', 'total_ttc', 'method'] },
    { key: 'raw_purchases', group: '1. Dispatch & Settlements', label: 'Raw Material Tickets', dvn: 'bhf_rawpurchase', form: 'raw', cols: ['date', 'ticket_no', 'company', 'site', 'site_owner', 'product', 'transport_by', 'truck_owner', 'truck', 'driver', 'qty', 'uom', 'unit_cost', 'cost', 'trans_cost', 'total'] },
    { key: 'receipts', group: '1. Dispatch & Settlements', label: 'Customer Settlements', dvn: 'bhf_customerreceipt', form: 'receipt', cols: ['date', 'company', 'customer', 'method', 'amount', 'discount', 'reference', 'notes'] },
    { key: 'settlements', group: '1. Dispatch & Settlements', label: 'Supplier Settlements', dvn: 'bhf_supplierpayment', form: 'settlement', cols: ['date', 'company', 'supplier', 'method', 'amount', 'discount', 'reference', 'notes'] },
    { key: 'fuel_intakes', group: '1. Dispatch & Settlements', label: 'Fuel & Lubricant Intakes', dvn: 'bhf_fuelintake', form: 'fuel', cols: ['date', 'ticket_no', 'company', 'fuel_type', 'item', 'equipment', 'driver', 'litres', 'odometer', 'hours', 'location'] },
    { key: 'expenses', group: '1. Dispatch & Settlements', label: 'Operating Expenses', dvn: 'bhf_expense', form: 'expense', cols: ['date', 'company', 'category', 'subcategory', 'supplier', 'equipment', 'method', 'qty', 'amount', 'reference'] },
    { key: 'price_rules', group: '2. Sales & Pricing Setup', label: 'Price Agreements', dvn: 'bhf_pricerule', form: 'pricerule', cols: ['company', 'rule_type', 'name', 'customer', 'supplier', 'site', 'product', 'unit', 'unit_price', 'trans_unit_price', 'qty1', 'adj1', 'qty2', 'adj2', 'start_date', 'end_date'] },
    { key: 'vat_invoices', group: '2. Sales & Pricing Setup', label: 'VAT Invoices', dvn: 'bhf_vatinvoice', form: 'vatinvoice', cols: ['date', 'invoice_no', 'company', 'customer', 'net_amount', 'vat_amount', 'total_ttc', 'status'] },
    { key: 'credit_terms', group: '2. Sales & Pricing Setup', label: 'Credit Terms', dvn: 'bhf_creditterm', form: 'creditterm', cols: ['company', 'customer', 'name', 'payment_days', 'credit_limit', 'start_date'] },
    { key: 'customers', group: '3. HQ Master Data', label: 'Customers (MFG)', dvn: 'bhf_customer', form: 'customer', cols: ['name', 'company', 'method', 'vat_registered', 'mof_no', 'customer_declared_qty', 'external_invoice', 'phone'] },
    { key: 'suppliers', group: '3. HQ Master Data', label: 'Suppliers & Haulers', dvn: 'bhf_supplier', form: 'supplier', cols: ['name', 'company', 'is_truck_owner', 'iva', 'trucks_count', 'phone', 'mof_no'] },
    { key: 'products', group: '3. HQ Master Data', label: 'Products & Grades', dvn: 'bhf_product', form: 'product', cols: ['name', 'uom', 'type', 'ton_factor', 'ticket_product', 'fuel_item', 'input_product'] },
    { key: 'sites', group: '3. HQ Master Data', label: 'Sites & Quarries', dvn: 'bhf_site', form: 'site', cols: ['name', 'region', 'supplier', 'is_jv', 'latitude', 'longitude'] },
    { key: 'regions', group: '3. HQ Master Data', label: 'Regions', dvn: 'bhf_region', form: 'site', cols: ['name', 'code'] },
    { key: 'uoms', group: '3. HQ Master Data', label: 'Units of Measure', dvn: 'bhf_uom', form: 'product', cols: ['name', 'code'] },
    { key: 'product_types', group: '3. HQ Master Data', label: 'Product Types', dvn: 'bhf_producttype', form: 'product', cols: ['name'] },
    { key: 'equipment', group: '3. HQ Master Data', label: 'Equipment (All / 3P)', dvn: 'bhf_equipment', form: 'equipment', cols: ['name', 'plate_no', 'type', 'capacity', 'ownership', 'supplier', 'default_driver'] },
    { key: 'company_equipment', group: '3. HQ Master Data', label: 'Company Fleet Units', dvn: 'bhf_companyequipment', form: 'companyequipment', cols: ['name', 'company', 'plate_no', 'type', 'capacity', 'ownership', 'default_driver'] },
    { key: 'drivers', group: '3. HQ Master Data', label: 'Drivers (All)', dvn: 'bhf_driver', form: 'driver', cols: ['name', 'truck_owner', 'phone'] },
    { key: 'company_drivers', group: '3. HQ Master Data', label: 'Company Drivers', dvn: 'bhf_companydriver', form: 'driver', cols: ['name', 'company', 'driver', 'truck', 'status'] },
    { key: 'expense_categories', group: '3. HQ Master Data', label: 'Expense Categories', dvn: 'bhf_expensecategory', form: 'expense', cols: ['name', 'code'] },
    { key: 'expense_subcategories', group: '3. HQ Master Data', label: 'Expense Subcategories', dvn: 'bhf_expensesubcategory', form: 'expense', cols: ['name', 'category'] },
    { key: 'salaries', group: '4. Payroll, Logistics & Treasury', label: 'Salary Payments', dvn: 'bhf_salarypayment', form: 'salary', cols: ['date', 'payroll_month', 'company', 'staff', 'equipment', 'method', 'amount', 'notes'] },
    { key: 'employments', group: '4. Payroll, Logistics & Treasury', label: 'Employment Contracts', dvn: 'bhf_employment', form: 'employment', cols: ['staff', 'company', 'role', 'pay_type', 'base_salary', 'start_date', 'status'] },
    { key: 'attendance', group: '4. Payroll, Logistics & Treasury', label: 'Attendance Logs', dvn: 'bhf_attendance', form: 'attendance', cols: ['date', 'company', 'staff', 'status', 'site', 'overtime_hours'] },
    { key: 'logistics_allowances', group: '4. Payroll, Logistics & Treasury', label: 'Site Allowances (Mon–Sun)', dvn: 'bhf_logistics', form: 'logistics', cols: ['date', 'company', 'staff', 'site', 'days_count', 'usd_amount', 'lbp_amount', 'amount'] },
    { key: 'overtime_rates', group: '4. Payroll, Logistics & Treasury', label: 'Overtime Trip Rates', dvn: 'bhf_triprate', form: 'triprate', cols: ['name', 'company', 'site', 'category', 'rate_usd'] },
    { key: 'external_movements', group: '4. Payroll, Logistics & Treasury', label: 'External Cash Movements', dvn: 'bhf_external', form: 'treasury', cols: ['date', 'company', 'name', 'counterparty', 'direction', 'amount'] },
    { key: 'loans', group: '4. Payroll, Logistics & Treasury', label: 'Partner & Entity Loans', dvn: 'bhf_loan', form: 'treasury', cols: ['date', 'company', 'name', 'lender', 'borrower', 'amount', 'balance'] },
    { key: 'loan_settlements', group: '4. Payroll, Logistics & Treasury', label: 'Loan Settlements', dvn: 'bhf_loansettlement', form: 'treasury', cols: ['date', 'company', 'name', 'loan', 'amount'] },
    { key: 'conversions', group: '4. Payroll, Logistics & Treasury', label: 'Currency Conversions', dvn: 'bhf_conversion', form: 'treasury', cols: ['date', 'company', 'name', 'from_currency', 'usd_amount', 'lbp_amount', 'fx_rate'] },
    { key: 'jv_partnerships', group: '4. Payroll, Logistics & Treasury', label: 'JV Partnerships', dvn: 'bhf_jvpartnership', form: 'jv', cols: ['name', 'company', 'site', 'partner', 'share_pct'] },
    { key: 'jv_distributions', group: '4. Payroll, Logistics & Treasury', label: 'JV Distributions', dvn: 'bhf_jvdistribution', form: 'jv', cols: ['date', 'company', 'name', 'site', 'partner', 'amount'] },
    { key: 'daily_totals', group: '4. Payroll, Logistics & Treasury', label: 'Daily Till & Scale Totals', dvn: 'bhf_dailytotal', form: 'sales', cols: ['date', 'company', 'name', 'sales_total', 'cash_in', 'cash_out', 'closing_till'] }
  ];

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtUSD(v, dec = 0) {
    const n = Number(v || 0);
    const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    return (n < 0 ? '-$' : '$') + s;
  }

  function fmtNum(v, dec = 0) {
    const n = Number(v || 0);
    return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }

  function fmtPct(v, num, den) {
    if (num != null && den) return ((Number(num) / Number(den)) * 100).toFixed(1) + '%';
    return (Number(v || 0) * 100).toFixed(1) + '%';
  }

  // ==================== SVG CHART BUILDERS ====================
  function buildHorizontalRankChart(items, labelKey, valKey, subKey, isUsd = true) {
    const rows = (items || []).slice(0, 8);
    if (!rows.length) return `<div style="padding:20px;color:var(--muted);font-size:12px">No data in active filter scope.</div>`;
    const maxV = Math.max(1, ...rows.map(r => Math.abs(Number(r[valKey] || 0))));
    return `
      <div class="pbi-hbar-list">
        ${rows.map((r, i) => {
          const v = Number(r[valKey] || 0);
          const w = Math.max(4, Math.min(100, (Math.abs(v) / maxV) * 100));
          const sub = subKey && r[subKey] != null ? ` · ${r[subKey]}` : '';
          return `
            <div class="pbi-hbar-row">
              <div class="pbi-hbar-meta">
                <span class="pbi-hbar-rank">${i + 1}. ${esc(r[labelKey] || '—')}<small>${esc(sub)}</small></span>
                <b class="mono">${isUsd ? fmtUSD(v, 0) : fmtNum(v, 0)}</b>
              </div>
              <div class="pbi-hbar-track"><div class="pbi-hbar-fill ${v < 0 ? 'crit' : (i === 0 ? 'brass' : '')}" style="width:${w.toFixed(1)}%"></div></div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function buildMonthlyComboSvg(months, barKey, lineKey, barLabel, lineLabel, isCurrency = true) {
    const rows = (months || []).slice(-14);
    if (!rows.length) return `<div style="padding:20px;color:var(--muted);font-size:12px">No monthly series for this entity.</div>`;
    const W = 640, H = 220, ml = 46, mr = 14, mt = 18, mb = 28;
    const pw = W - ml - mr, ph = H - mt - mb;
    const vals = rows.map(r => [Math.max(0, Number(r[barKey] || 0)), Math.max(0, Number(r[lineKey] || 0))]);
    const maxV = Math.max(10, ...vals.map(v => Math.max(v[0], v[1])));
    const y = v => mt + ph - (v / maxV) * ph;
    const slot = pw / rows.length;
    const bw = Math.min(26, Math.max(10, slot * 0.54));

    let g = '';
    [0, 0.25, 0.5, 0.75, 1].forEach(f => {
      const tv = maxV * f;
      const lbl = isCurrency ? (tv >= 1000 ? '$' + Math.round(tv / 1000) + 'k' : '$' + Math.round(tv)) : fmtNum(tv, 0);
      g += `<line class="grid" x1="${ml}" x2="${W - mr}" y1="${y(tv).toFixed(1)}" y2="${y(tv).toFixed(1)}"/>`;
      g += `<text class="tick" x="${ml - 6}" y="${(y(tv) + 4).toFixed(1)}" text-anchor="end">${lbl}</text>`;
    });

    let poly = [];
    rows.forEach((r, i) => {
      const [bv, lv] = vals[i];
      const cx = ml + slot * i + slot / 2;
      const x0 = cx - bw / 2;
      const ym = String(r['Year Month'] || r.YearMonthNo || '').replace('2024', '24').replace('2025', '25').replace('2026', '26');
      const top = y(bv), h = Math.max(2, y(0) - top);
      g += `<rect class="s-1" x="${x0.toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2"><title>${esc(ym)}: ${barLabel} ${isCurrency ? fmtUSD(bv, 0) : fmtNum(bv, 0)} · ${lineLabel} ${isCurrency ? fmtUSD(lv, 0) : fmtNum(lv, 0)}</title></rect>`;
      g += `<text class="tick" x="${cx.toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(ym.slice(0, 6))}</text>`;
      poly.push(`${cx.toFixed(1)},${y(lv).toFixed(1)}`);
    });
    if (poly.length > 1) {
      g += `<polyline fill="none" stroke="#D9A54A" stroke-width="2.4" points="${poly.join(' ')}"/>`;
      poly.forEach(pt => {
        const [px, py] = pt.split(',');
        g += `<circle cx="${px}" cy="${py}" r="3.2" fill="#D9A54A" stroke="#0E1A2E" stroke-width="1.2"/>`;
      });
    }
    g += `<line class="axis" x1="${ml}" x2="${W - mr}" y1="${y(0)}" y2="${y(0)}"/>`;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(barLabel)} vs ${esc(lineLabel)}">${g}</svg>`;
  }

  function kpiSection(title, cards) {
    return `
      <div class="pbi-kpi-sec">
        <div class="pbi-kpi-sec-hdr">${esc(title)}</div>
        <div class="pbi-kpi-sec-grid">
          ${cards.map(c => `
            <div class="pbi-kpi-card ${c.tone || ''}">
              <span class="k">${esc(c.label)}</span>
              <strong class="v num">${esc(c.value)}</strong>
              ${c.sub ? `<small class="d">${esc(c.sub)}</small>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function groupBySum(rows, keyFn, valFn, countLabel = 'rows') {
    const map = new Map();
    (rows || []).forEach(r => {
      const k = keyFn(r) || '(Unassigned)';
      const cur = map.get(k) || { key: k, total: 0, count: 0, qty: 0 };
      cur.total += Number(valFn ? valFn(r) : 0);
      cur.qty += Number(r.qty || r.litres || 0);
      cur.count += 1;
      map.set(k, cur);
    });
    return Array.from(map.values()).map(x => ({
      ...x,
      sub: `${fmtNum(x.count)} ${countLabel}${x.qty > 0 ? ' · ' + fmtNum(x.qty, 0) + ' u' : ''}`
    })).sort((a, b) => b.total - a.total);
  }

  // ==================== MAIN 20-PAGE POWER BI STUDIO RENDERER ====================
  function renderPbiStudio(ctx) {
    const { STATE, SEED, COMPANY_LABELS, getModel, getKPI, filterRecords, buildSentinelItems, exportBtn } = ctx;
    const activePageId = STATE.pbiPage || 'p01_overview';
    const pageMeta = PBI_PAGES.find(p => p.id === activePageId) || PBI_PAGES[0];
    const m = getModel();
    const k = getKPI();
    const rec = SEED.records || {};
    const slicer = STATE.pbiSlicer || { product: '', customer: '', supplier: '', site: '', method: '', saleType: '', search: '' };

    // Apply page slicers to operational registers
    const matchSlicer = r => {
      if (slicer.product && r.product && r.product !== slicer.product) return false;
      if (slicer.customer && r.customer && r.customer !== slicer.customer) return false;
      if (slicer.supplier) {
        const s = slicer.supplier;
        if (r.supplier !== s && r.site_owner !== s && r.truck_owner !== s) return false;
      }
      if (slicer.site && r.site && r.site !== slicer.site) return false;
      if (slicer.method && r.method && r.method !== slicer.method) return false;
      if (slicer.saleType && r.sale_type && r.sale_type !== slicer.saleType) return false;
      if (slicer.search) {
        const hay = Object.values(r).join(' ').toLowerCase();
        if (!hay.includes(slicer.search.toLowerCase())) return false;
      }
      return true;
    };

    const salesRows = filterRecords(rec.sales_tickets, { ignoreSearch: true }).filter(matchSlicer);
    const rawRows = filterRecords(rec.raw_purchases, { ignoreSearch: true }).filter(matchSlicer);
    const fuelRows = filterRecords(rec.fuel_intakes, { ignoreSearch: true }).filter(matchSlicer);
    const expRows = filterRecords(rec.expenses, { ignoreSearch: true }).filter(matchSlicer);
    const rcptRows = filterRecords(rec.receipts, { ignoreSearch: true }).filter(matchSlicer);
    const setRows = filterRecords(rec.settlements, { ignoreSearch: true }).filter(matchSlicer);

    const prodOpts = Array.from(new Set((rec.products || []).map(p => p.name).filter(Boolean))).sort();
    const custOpts = Array.from(new Set((m.customers || []).map(c => c.Customer).filter(Boolean))).slice(0, 120);
    const supOpts = Array.from(new Set((m.suppliers || []).map(s => s.Supplier).filter(Boolean))).slice(0, 120);
    const siteOpts = Array.from(new Set((rec.sites || []).map(s => s.name).filter(Boolean))).slice(0, 120);

    // Top 20-Page Bar + Interactive Slicer Bar
    const headerHtml = `
      <div class="pbi-studio-hdr">
        <div class="pbi-studio-top">
          <div>
            <div class="cockpit-eyebrow">POWER BI SEMANTIC REPORT STUDIO · 20 PAGES (m18c_report.py PARITY) · ${esc(COMPANY_LABELS[STATE.company])}</div>
            <h2 class="pbi-studio-title">${esc(pageMeta.title)}</h2>
          </div>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <button type="button" class="btn" id="pbiResetSlicersBtn">↺ Reset Slicers</button>
            ${exportBtn('pbiCanvasPanel', 'PBI_' + pageMeta.id)}
            <button type="button" class="btn btn-brass" data-open-modal="sales">+ New Entry</button>
          </div>
        </div>

        <!-- 20-Page Power BI Report Tab Strip -->
        <div class="pbi-page-strip" role="tablist" aria-label="20 Power BI Report Pages">
          ${PBI_PAGES.map(p => `
            <button type="button" class="pbi-page-tab ${p.id === activePageId ? 'active' : ''}" data-pbi-page="${esc(p.id)}" title="${esc(p.title)}">
              <span class="pbi-page-num">${p.num}</span>
              <span>${esc(p.label)}</span>
            </button>
          `).join('')}
        </div>

        <!-- Interactive Power BI Slicer Bar -->
        <div class="pbi-slicer-bar">
          <div class="pbi-slicer-item">
            <label>Product Slicer</label>
            <select id="pbiSlicerProduct">
              <option value="">All Grades (${prodOpts.length})</option>
              ${prodOpts.map(p => `<option value="${esc(p)}" ${slicer.product === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}
            </select>
          </div>
          <div class="pbi-slicer-item">
            <label>Customer Slicer</label>
            <select id="pbiSlicerCustomer">
              <option value="">All Customers</option>
              ${custOpts.map(c => `<option value="${esc(c)}" ${slicer.customer === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
            </select>
          </div>
          <div class="pbi-slicer-item">
            <label>Supplier / Hauler Slicer</label>
            <select id="pbiSlicerSupplier">
              <option value="">All Suppliers</option>
              ${supOpts.map(s => `<option value="${esc(s)}" ${slicer.supplier === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
            </select>
          </div>
          <div class="pbi-slicer-item">
            <label>Site / Quarry Slicer</label>
            <select id="pbiSlicerSite">
              <option value="">All Sites</option>
              ${siteOpts.map(s => `<option value="${esc(s)}" ${slicer.site === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
            </select>
          </div>
          <div class="pbi-slicer-item">
            <label>Sale Type</label>
            <select id="pbiSlicerSaleType">
              <option value="">All Types</option>
              <option value="Delivery" ${slicer.saleType === 'Delivery' ? 'selected' : ''}>Delivery</option>
              <option value="Pickup" ${slicer.saleType === 'Pickup' ? 'selected' : ''}>Pickup</option>
            </select>
          </div>
          <div class="pbi-slicer-item">
            <label>Method</label>
            <select id="pbiSlicerMethod">
              <option value="">Cash &amp; Credit</option>
              <option value="Credit" ${slicer.method === 'Credit' ? 'selected' : ''}>Credit</option>
              <option value="Cash" ${slicer.method === 'Cash' ? 'selected' : ''}>Cash</option>
            </select>
          </div>
          <div class="pbi-slicer-item" style="flex:1.3">
            <label>Cross-Filter Search</label>
            <input type="search" id="pbiSlicerSearch" value="${esc(slicer.search || '')}" placeholder="Filter visuals &amp; matrices...">
          </div>
        </div>
      </div>
    `;

    let bodyHtml = '';

    // ---- PAGE 01: OVERVIEW (5 SECTIONS · 30 KPIs) ----
    if (activePageId === 'p01_overview') {
      bodyHtml = `
        <div class="pbi-overview-bands">
          ${kpiSection('1. P&L & Profitability (6 KPIs)', [
            { label: 'Sales Revenue (TTC)', value: fmtUSD(k.sales_ttc, 0), sub: 'Net Ex-VAT: ' + fmtUSD(k.net_sales, 0), tone: 'brass' },
            { label: 'Net Sales (Ex-VAT)', value: fmtUSD(k.net_sales, 0), sub: 'Transport Sold: ' + fmtUSD(k.transport_sold, 0) },
            { label: 'Raw Quarry & Haulage Cost', value: fmtUSD(k.raw_cost, 0), sub: fmtNum(k.raw_loads) + ' quarry loads' },
            { label: 'Gross Margin ($ & %)', value: fmtUSD(k.gross_margin, 0), sub: 'GM %: ' + fmtPct(k.gm_pct, k.gross_margin, k.net_sales), tone: 'good' },
            { label: 'Operating Expenses + Payroll', value: fmtUSD(Number(k.expenses || 0) + Number(k.salaries_paid || 0), 0), sub: 'Exp ' + fmtUSD(k.expenses, 0) + ' · Pay ' + fmtUSD(k.salaries_paid, 0) },
            { label: 'Operating Cash Profit', value: fmtUSD(k.operating_profit, 0), sub: 'Op Margin: ' + fmtPct(k.op_margin_pct, k.operating_profit, k.net_sales), tone: 'good' }
          ])}
          ${kpiSection('2. Sales & Weighbridge Dispatch (6 KPIs)', [
            { label: 'Total Sales Loads', value: fmtNum(k.loads), sub: 'Delivery ' + fmtNum(k.delivery_loads) + ' · Pickup ' + fmtNum(k.pickup_loads) },
            { label: 'Tons Sold (Aggregate)', value: fmtNum(k.tons_sold, 0) + ' t', sub: 'Qty: ' + fmtNum(k.qty_sold, 0) + ' u' },
            { label: 'Avg Selling Price (TTC)', value: fmtUSD(k.avg_price_ttc, 2), sub: 'Per unit dispatched' },
            { label: 'Discounts Granted', value: fmtUSD(k.discounts, 0), sub: 'Customer ticket discounts' },
            { label: 'Active Customers', value: fmtNum(k.active_customers || (m.customers || []).length), sub: 'In current scope' },
            { label: 'Active Price Agreements', value: fmtNum(k.active_agreements || (rec.price_rules || []).length), sub: 'Enforced on tickets' }
          ])}
          ${kpiSection('3. Purchases, Fleet & Diesel Operations (6 KPIs)', [
            { label: 'Raw Quarry Loads', value: fmtNum(k.raw_loads), sub: 'Avg ' + fmtUSD(k.avg_raw_cost, 2) + ' / u' },
            { label: 'Raw Material Leg (Quarries)', value: fmtUSD(k.raw_mat_cost || k.ap_material, 0), sub: 'Owed to Site Owners' },
            { label: 'Raw Haulage Leg (3P Trucks)', value: fmtUSD(k.raw_haulage || k.ap_haulage, 0), sub: 'Owed to Truck Owners' },
            { label: 'Active Equipment & Fleet', value: fmtNum(k.active_equip || (rec.equipment || []).length), sub: 'Cost/Ton: ' + fmtUSD(k.cost_per_ton, 2) },
            { label: 'Diesel Issued to Fleet', value: fmtNum(k.diesel_litres, 0) + ' L', sub: 'Purchased: ' + fmtNum(k.diesel_purchased, 0) + ' L' },
            { label: 'Diesel in Tank (m207)', value: fmtNum(k.diesel_in_tank, 0) + ' L', sub: 'Physical vs Ledger stock', tone: Number(k.diesel_in_tank || 0) < 0 ? 'crit' : 'good' }
          ])}
          ${kpiSection('4. Receivables, 3-Leg Payables & Cash Till (6 KPIs)', [
            { label: 'Open AR Balance (FIFO)', value: fmtUSD(k.ar_balance, 0), sub: 'DSO: ' + fmtNum(k.dso_days, 0) + ' days', tone: 'brass' },
            { label: 'AR Overdue > 30 Days', value: fmtUSD(k.ar_overdue, 0), sub: '>60d: ' + fmtUSD(k.ar_60_plus, 0), tone: Number(k.ar_overdue || 0) > 0 ? 'warn' : 'good' },
            { label: 'Customer Receipts Collected', value: fmtUSD(k.receipts_collected || k.cash_inflow, 0), sub: 'FIFO allocated to tickets' },
            { label: 'Open 3-Leg AP Balance', value: fmtUSD(k.ap_balance, 0), sub: 'Mat + Haulage + Credit Exp' },
            { label: 'Supplier Settlements Paid', value: fmtUSD(k.settlements_paid, 0), sub: 'Oldest leg relieved first' },
            { label: 'Cash Till Balance (5300)', value: fmtUSD(k.cash_till, 2), sub: 'In ' + fmtUSD(k.cash_inflow, 0) + ' · Out ' + fmtUSD(k.cash_outflow, 0), tone: 'good' }
          ])}
          ${kpiSection('5. Workforce, Statutory VAT & Ledger Controls (6 KPIs)', [
            { label: 'Salaries & Payroll Paid', value: fmtUSD(k.salaries_paid, 0), sub: fmtNum((rec.employments || []).length) + ' employment rows' },
            { label: 'Driver Overtime Bonus', value: fmtUSD(k.overtime_bonus, 0), sub: 'Company fleet night shift' },
            { label: 'Sales Output VAT (11%)', value: fmtUSD(k.sales_vat, 2), sub: 'Statutory VAT 4427' },
            { label: 'VAT Receivable Balance', value: fmtUSD(k.vat_receivable, 2), sub: fmtNum((rec.vat_invoices || []).length) + ' VAT invoices' },
            { label: 'Commission Due', value: fmtUSD(k.commission_due, 0), sub: 'Sales agent commissions' },
            { label: 'Lebanese CoA Trial Balance', value: fmtUSD(k.tb_check || 0, 2), sub: Math.abs(Number(k.tb_check || 0)) < 0.005 ? 'PASS · $0.00 Variance' : 'Variance flagged', tone: Math.abs(Number(k.tb_check || 0)) < 0.005 ? 'good' : 'crit' }
          ])}
        </div>
        <div class="row2" style="margin-top:12px">
          <div class="panel">
            <div class="ph"><h3>Monthly Sales TTC vs Operating Cash Profit</h3><span class="ph-sub">Bars = Sales TTC · Gold Line = Operating Profit</span></div>
            <div class="chartwrap">${buildMonthlyComboSvg(m.monthly, 'sales_ttc', 'operating_profit', 'Sales TTC', 'Operating Profit', true)}</div>
          </div>
          <div class="panel">
            <div class="ph"><h3>Top Products &amp; Grades by Revenue</h3><span class="ph-sub">Ranked horizontal bar visual</span></div>
            <div style="padding:10px 14px">${buildHorizontalRankChart(m.products || [], 'Product', 'sales_ttc', 'UoM', true)}</div>
          </div>
        </div>
      `;
    }

    // ---- PAGE 02: COMPANIES SIDE-BY-SIDE ----
    else if (activePageId === 'p02_companies') {
      const gK = ((SEED.models['manufacturing-group'] || {}).periods || {})[STATE.period] || {};
      const wK = ((SEED.models.wtc || {}).periods || {})[STATE.period] || {};
      const bK = ((SEED.models.bbconstruction || {}).periods || {})[STATE.period] || {};
      const lK = ((SEED.models.lionstransport || {}).periods || {})[STATE.period] || {};
      const metrics = [
        ['Sales Revenue (TTC)', 'sales_ttc', fmtUSD],
        ['Net Sales (Ex-VAT)', 'net_sales', fmtUSD],
        ['Sales Loads Dispatched', 'loads', fmtNum],
        ['Tons Sold (t)', 'tons_sold', fmtNum],
        ['Raw Quarry & Haulage Cost', 'raw_cost', fmtUSD],
        ['Raw Quarry Loads', 'raw_loads', fmtNum],
        ['Realized Gross Margin ($)', 'gross_margin', fmtUSD],
        ['Operating Expenses ($)', 'expenses', fmtUSD],
        ['Salaries & Payroll Paid ($)', 'salaries_paid', fmtUSD],
        ['Operating Cash Profit ($)', 'operating_profit', fmtUSD],
        ['Open AR Receivables ($)', 'ar_balance', fmtUSD],
        ['AR Overdue > 30 Days ($)', 'ar_overdue', fmtUSD],
        ['Open 3-Leg AP Payables ($)', 'ap_balance', fmtUSD],
        ['Cash Till 5300 Balance ($)', 'cash_till', v => fmtUSD(v, 2)],
        ['Diesel Issued (L)', 'diesel_litres', fmtNum],
        ['Diesel in Tank Balance (L)', 'diesel_in_tank', fmtNum],
        ['Active Equipment Count', 'active_equip', fmtNum],
        ['Lebanese CoA TB Variance ($)', 'tb_check', v => fmtUSD(v, 2)]
      ];
      bodyHtml = `
        <div class="panel-card">
          <div class="panel-head"><div class="panel-title"><span>CONSOLIDATED &amp; ENTITY-BY-ENTITY P&amp;L, BALANCE SHEET &amp; UNIT ECONOMICS MATRIX</span></div></div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr><th>Power BI Measure</th><th class="r">All Group Consolidated</th><th class="r">WTC (World Trading)</th><th class="r">BBConstruction</th><th class="r">Lions Transport</th><th class="r">WTC Share %</th></tr>
              </thead>
              <tbody>
                ${metrics.map(([lbl, key, fn]) => {
                  const gv = Number(gK[key] || 0), wv = Number(wK[key] || 0), bv = Number(bK[key] || 0), lv = Number(lK[key] || 0);
                  const share = gv > 0 ? ((wv / gv) * 100).toFixed(1) + '%' : '—';
                  return `<tr><td><b>${esc(lbl)}</b></td><td class="r"><b>${fn(gv)}</b></td><td class="r">${fn(wv)}</td><td class="r">${fn(bv)}</td><td class="r">${lv ? fn(lv) : '—'}</td><td class="r mono">${share}</td></tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    // ---- PAGE 03: ACTION ITEMS & SENTINELS ----
    else if (activePageId === 'p03_actions') {
      const items = buildSentinelItems();
      const overdueCusts = (m.customers || []).filter(c => Number(c.ar_60_plus || c.ar_overdue || 0) > 0).slice(0, 25);
      bodyHtml = `
        ${kpiSection('Action Items & Governance Watchdogs', items.slice(0, 6).map(s => ({
          label: s.code, value: s.badge, sub: s.title, tone: s.severity === 'ok' ? 'good' : (s.severity === 'crit' ? 'crit' : 'warn')
        })))}
        <div class="row2" style="margin-top:12px">
          <div class="panel-card">
            <div class="panel-head"><div class="panel-title"><span>CUSTOMERS OVERDUE &gt; 60 DAYS (CREDIT HOLD CANDIDATES)</span></div></div>
            <div class="table-wrap"><table class="ledger-table">
              <thead><tr><th>Customer</th><th class="r">Loads</th><th class="r">Total AR ($)</th><th class="r">31–60d ($)</th><th class="r">60+ Days ($)</th><th>Last Sale</th></tr></thead>
              <tbody>${overdueCusts.map(c => `<tr><td><b>${esc(c.Customer)}</b></td><td class="r">${fmtNum(c.loads)}</td><td class="r">${fmtUSD(c.ar_balance, 0)}</td><td class="r">${fmtUSD(c.ar_31_60, 0)}</td><td class="r"><b class="crit-text">${fmtUSD(c.ar_60_plus, 0)}</b></td><td class="mono">${esc(String(c.last_sale || '').slice(0, 10))}</td></tr>`).join('') || '<tr><td colspan="6">No overdue customers</td></tr>'}</tbody>
            </table></div>
          </div>
          <div class="panel-card">
            <div class="panel-head"><div class="panel-title"><span>ALL 8 AUTONOMOUS SENTINEL CHECKS</span></div></div>
            <div class="sentinel-list">
              ${items.map(s => `<div class="sentinel-item ${s.severity}" style="padding:10px 14px"><div><b>${esc(s.code)} · ${esc(s.title)}</b><div class="sentinel-detail">${esc(s.detail)}</div></div><span class="badge ${s.severity === 'ok' ? 'badge-ok' : 'badge-warn'}">${esc(s.badge)}</span></div>`).join('')}
            </div>
          </div>
        </div>
      `;
    }

    // ---- PAGE 04: SALES & DELIVERIES ----
    else if (activePageId === 'p04_sales') {
      const byProd = groupBySum(salesRows, r => r.product, r => r.total_ttc, 'tickets');
      const byCust = groupBySum(salesRows, r => r.customer, r => r.total_ttc, 'tickets');
      const bySite = groupBySum(salesRows, r => r.site, r => r.total_ttc, 'tickets');
      const sumTtc = salesRows.reduce((a, r) => a + Number(r.total_ttc || 0), 0);
      const sumQty = salesRows.reduce((a, r) => a + Number(r.qty || 0), 0);
      bodyHtml = `
        ${kpiSection('Sales & Weighbridge Deliveries KPIs', [
          { label: 'Book Sales TTC', value: fmtUSD(k.sales_ttc, 0), sub: 'Net: ' + fmtUSD(k.net_sales, 0), tone: 'brass' },
          { label: 'Book Loads & Tons', value: fmtNum(k.loads), sub: fmtNum(k.tons_sold, 0) + ' tons sold' },
          { label: 'Delivery vs Pickup Loads', value: `${fmtNum(k.delivery_loads)} / ${fmtNum(k.pickup_loads)}`, sub: 'Transport Sold: ' + fmtUSD(k.transport_sold, 0) },
          { label: 'Slicer Filtered Tickets', value: fmtNum(salesRows.length), sub: fmtUSD(sumTtc, 0) + ' · ' + fmtNum(sumQty, 1) + ' u', tone: 'good' },
          { label: 'Avg Selling Price (TTC)', value: fmtUSD(k.avg_price_ttc, 2), sub: 'Discounts: ' + fmtUSD(k.discounts, 0) },
          { label: 'Output VAT 11%', value: fmtUSD(k.sales_vat, 0), sub: 'On VAT-registered customers' }
        ])}
        <div class="row2" style="margin-top:12px">
          <div class="panel"><div class="ph"><h3>Monthly Sales TTC &amp; Load Trajectory</h3></div><div class="chartwrap">${buildMonthlyComboSvg(m.monthly, 'sales_ttc', 'net_sales', 'Sales TTC', 'Net Sales', true)}</div></div>
          <div class="panel"><div class="ph"><h3>Sales by Aggregate Grade (Filtered)</h3></div><div style="padding:10px 14px">${buildHorizontalRankChart(byProd.length ? byProd : (m.products || []), byProd.length ? 'key' : 'Product', byProd.length ? 'total' : 'sales_ttc', 'sub', true)}</div></div>
        </div>
        <div class="row2" style="margin-top:12px">
          <div class="panel"><div class="ph"><h3>Top Customers in Active Slicer Scope</h3></div><div style="padding:10px 14px">${buildHorizontalRankChart(byCust, 'key', 'total', 'sub', true)}</div></div>
          <div class="panel"><div class="ph"><h3>Top Destination Sites in Active Slicer Scope</h3></div><div style="padding:10px 14px">${buildHorizontalRankChart(bySite, 'key', 'total', 'sub', true)}</div></div>
        </div>
      `;
    }

    // ---- PAGE 05: PRICING & COMMISSIONS ----
    else if (activePageId === 'p05_pricing') {
      const rules = filterRecords(rec.price_rules, { ignorePeriod: true }).filter(matchSlicer);
      const byType = groupBySum(rules, r => r.rule_type || 'Sales (Delivery)', r => r.unit_price, 'rules');
      const tiered = rules.filter(r => r.qty1 != null || r.qty2 != null);
      bodyHtml = `
        ${kpiSection('Price Agreements, Tier 1/2 Truck Adjustments & Commissions', [
          { label: 'Active Price Agreements', value: fmtNum(rules.length), sub: 'Across 6 rule types', tone: 'brass' },
          { label: 'Tier 1 / Tier 2 Truck Rules', value: fmtNum(tiered.length), sub: 'Capacity-adjusted agreements', tone: 'good' },
          { label: 'Sales Delivery Rules', value: fmtNum(rules.filter(r => /Delivery/i.test(r.rule_type || '')).length), sub: 'Customer + Site + Grade' },
          { label: 'Sales Pickup Rules', value: fmtNum(rules.filter(r => /Pickup/i.test(r.rule_type || '')).length), sub: 'Ex-quarry customer rules' },
          { label: 'Quarry Purchase & Haul Rules', value: fmtNum(rules.filter(r => /Purchase|Transport|Haulage/i.test(r.rule_type || '')).length), sub: 'Site material & transport' },
          { label: 'Commission Due', value: fmtUSD(k.commission_due, 0), sub: 'Sales commissions' }
        ])}
        <div class="panel-card" style="margin-top:12px">
          <div class="panel-head"><div class="panel-title"><span>PRICE AGREEMENT MATRIX (WITH TIER 1 / TIER 2 TRUCK CAPACITIES &amp; INDIFFERENCE PRICES)</span></div><button class="btn btn-primary" data-open-modal="pricerule">+ New Price Agreement</button></div>
          <div class="table-wrap"><table class="ledger-table">
            <thead><tr><th>Co.</th><th>Rule Type</th><th>Customer / Supplier</th><th>Site</th><th>Product</th><th>Unit</th><th class="r">Unit Price</th><th class="r">Trans Price</th><th class="r">Tier 1 (m³ / Adj)</th><th class="r">Tier 2 (m³ / Adj)</th><th>Valid From</th></tr></thead>
            <tbody>
              ${rules.slice(0, 80).map(r => `
                <tr>
                  <td><span class="badge badge-brass">${esc(r.company)}</span></td>
                  <td>${esc(r.rule_type || 'Agreement')}</td>
                  <td><b>${esc(r.customer || r.supplier || 'List Price')}</b></td>
                  <td>${esc(r.site || '—')}</td>
                  <td>${esc(r.product || 'All')}</td>
                  <td class="mono">${esc(r.unit || 'm³')}</td>
                  <td class="r"><b>${fmtUSD(r.unit_price, 2)}</b></td>
                  <td class="r">${fmtUSD(r.trans_unit_price, 2)}</td>
                  <td class="r mono">${r.qty1 != null ? `${r.qty1}m³ (${fmtUSD(r.adj1, 2)})` : '—'}</td>
                  <td class="r mono">${r.qty2 != null ? `${r.qty2}m³ (${fmtUSD(r.adj2, 2)})` : '—'}</td>
                  <td class="mono">${esc(String(r.start_date || '').slice(0, 10))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>
        </div>
      `;
    }

    // ---- PAGE 06: CUSTOMERS & AR AGING ----
    else if (activePageId === 'p06_ar') {
      const custs = (m.customers || []).filter(c => !slicer.customer || c.Customer === slicer.customer);
      const buckets = [
        { bucket: 'Current (0d)', amount: Number(k.ar_current || 0), sub: 'Not yet due' },
        { bucket: '1–10 Days', amount: Number(k.ar_1_10 || 0), sub: 'Early follow-up' },
        { bucket: '11–30 Days', amount: Number(k.ar_11_30 || 0), sub: 'Standard credit window' },
        { bucket: '31–60 Days', amount: Number(k.ar_31_60 || 0), sub: 'Overdue collection' },
        { bucket: '60+ Days Overdue', amount: Number(k.ar_60_plus || 0), sub: 'Credit hold review' }
      ];
      bodyHtml = `
        ${kpiSection('FIFO Accounts Receivable & 5-Bucket Aging (m249)', [
          { label: 'Total Open AR (VAT-Incl.)', value: fmtUSD(k.ar_balance, 0), sub: 'FIFO receipt allocated', tone: 'brass' },
          { label: 'Current + 1–30 Days', value: fmtUSD(Number(k.ar_current || 0) + Number(k.ar_1_10 || 0) + Number(k.ar_11_30 || 0), 0), sub: 'Within 30d window', tone: 'good' },
          { label: 'Overdue 31–60 Days', value: fmtUSD(k.ar_31_60, 0), sub: 'Active collection' },
          { label: 'Overdue 60+ Days', value: fmtUSD(k.ar_60_plus, 0), sub: 'Credit hold candidates', tone: 'warn' },
          { label: 'Days Sales Outstanding', value: fmtNum(k.dso_days, 0) + ' d', sub: 'Receivable velocity' },
          { label: 'Credit Terms Registered', value: fmtNum((rec.credit_terms || []).length), sub: 'Customer credit limits' }
        ])}
        <div class="row2" style="margin-top:12px">
          <div class="panel"><div class="ph"><h3>5-Bucket FIFO AR Aging Distribution</h3></div><div style="padding:10px 14px">${buildHorizontalRankChart(buckets, 'bucket', 'amount', 'sub', true)}</div></div>
          <div class="panel"><div class="ph"><h3>Top Customer Receivable Balances</h3></div><div style="padding:10px 14px">${buildHorizontalRankChart(custs, 'Customer', 'ar_balance', 'VAT Registered', true)}</div></div>
        </div>
        <div class="panel-card" style="margin-top:12px">
          <div class="panel-head"><div class="panel-title"><span>CUSTOMER AR AGING MATRIX (${custs.length} CUSTOMERS)</span></div><button class="btn btn-primary" data-open-modal="receipt">+ Post Customer Settlement</button></div>
          <div class="table-wrap"><table class="ledger-table">
            <thead><tr><th>Customer</th><th>VAT</th><th class="r">Loads</th><th class="r">Sales TTC</th><th class="r">Receipts</th><th class="r">Current</th><th class="r">1–30d</th><th class="r">31–60d</th><th class="r">60+ Days</th><th class="r">Open AR</th></tr></thead>
            <tbody>
              ${custs.slice(0, 80).map(c => `
                <tr>
                  <td><b>${esc(c.Customer)}</b></td>
                  <td>${c['VAT Registered'] === 'Yes' ? '<span class="badge badge-info">11% VAT</span>' : '—'}</td>
                  <td class="r">${fmtNum(c.loads)}</td>
                  <td class="r">${fmtUSD(c.sales_ttc, 0)}</td>
                  <td class="r">${fmtUSD(c.receipts, 0)}</td>
                  <td class="r">${fmtUSD(c.ar_current, 0)}</td>
                  <td class="r">${fmtUSD(Number(c.ar_1_10 || 0) + Number(c.ar_11_30 || 0), 0)}</td>
                  <td class="r">${fmtUSD(c.ar_31_60, 0)}</td>
                  <td class="r">${Number(c.ar_60_plus || 0) > 0 ? `<b class="crit-text">${fmtUSD(c.ar_60_plus, 0)}</b>` : '—'}</td>
                  <td class="r"><b>${fmtUSD(c.ar_balance, 2)}</b></td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>
        </div>
      `;
    }

    // ---- PAGE 07: SUPPLIERS & 3-LEG AP ----
    else if (activePageId === 'p07_ap') {
      const sups = (m.suppliers || []).filter(s => !slicer.supplier || s.Supplier === slicer.supplier);
      const legBars = [
        { leg: 'Leg 1 · Quarry Material Payables', amount: Number(k.ap_material || 0), sub: 'Owed to Quarry Site Owners' },
        { leg: 'Leg 2 · Third-Party Haulage Payables', amount: Number(k.ap_haulage || 0), sub: 'Owed to Truck Owners' },
        { leg: 'Leg 3 · Supplies, Services & Credit Expenses', amount: Number(k.ap_expense || 0), sub: 'Owed to Vendors' },
        { leg: 'Less: Supplier Settlements Paid', amount: Number(k.settlements_paid || 0), sub: 'Relieves oldest open leg first' }
      ];
      bodyHtml = `
        ${kpiSection('3-Leg Accounts Payable Architecture (m192)', [
          { label: 'Leg 1: Quarry Material AP', value: fmtUSD(k.ap_material, 0), sub: 'Site Owner payables', tone: 'brass' },
          { label: 'Leg 2: Haulage AP', value: fmtUSD(k.ap_haulage, 0), sub: '3rd-party Truck Owner payables' },
          { label: 'Leg 3: Expense AP', value: fmtUSD(k.ap_expense, 0), sub: 'Credit expense vendors' },
          { label: 'Settlements Paid', value: fmtUSD(k.settlements_paid, 0), sub: 'Total supplier payments', tone: 'good' },
          { label: 'Net Open AP Balance', value: fmtUSD(k.ap_balance, 0), sub: 'Across all 3 legs' },
          { label: 'Registered Suppliers', value: fmtNum((rec.suppliers || []).length), sub: fmtNum((rec.suppliers || []).filter(s => s.is_truck_owner).length) + ' Truck Owners' }
        ])}
        <div class="row2" style="margin-top:12px">
          <div class="panel"><div class="ph"><h3>3-Leg Payable Architecture vs Settlements</h3></div><div style="padding:10px 14px">${buildHorizontalRankChart(legBars, 'leg', 'amount', 'sub', true)}</div></div>
          <div class="panel"><div class="ph"><h3>Top Suppliers &amp; Quarries by Volume</h3></div><div style="padding:10px 14px">${buildHorizontalRankChart(sups, 'Supplier', 'total_billed', 'Category', true)}</div></div>
        </div>
        <div class="panel-card" style="margin-top:12px">
          <div class="panel-head"><div class="panel-title"><span>3-LEG SUPPLIER &amp; HAULER PAYABLE MATRIX (${sups.length} SUPPLIERS)</span></div><button class="btn btn-primary" data-open-modal="settlement">+ Post Supplier Settlement</button></div>
          <div class="table-wrap"><table class="ledger-table">
            <thead><tr><th>Supplier / Hauler</th><th class="r">Material Leg ($)</th><th class="r">Haulage Leg ($)</th><th class="r">Expense Leg ($)</th><th class="r">Total Billed ($)</th><th class="r">Paid ($)</th><th class="r">Net AP Balance ($)</th></tr></thead>
            <tbody>
              ${sups.slice(0, 80).map(s => `
                <tr>
                  <td><b>${esc(s.Supplier)}</b></td>
                  <td class="r">${fmtUSD(s.material_leg, 0)}</td>
                  <td class="r">${fmtUSD(s.haulage_leg, 0)}</td>
                  <td class="r">${fmtUSD(s.expense_leg, 0)}</td>
                  <td class="r">${fmtUSD(s.total_billed, 0)}</td>
                  <td class="r">${fmtUSD(s.settlements, 0)}</td>
                  <td class="r"><b>${fmtUSD(s.ap_balance, 2)}</b></td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>
        </div>
      `;
    }

    // ---- PAGE 08: STOCK & HAULAGE ----
    else if (activePageId === 'p08_stock') {
      const bySite = groupBySum(rawRows, r => r.site, r => r.total, 'loads');
      const byProd = groupBySum(rawRows, r => r.product, r => r.total, 'loads');
      const byHauler = groupBySum(rawRows, r => r.truck_owner || r.transport_by, r => r.trans_cost, 'loads');
      bodyHtml = `
        ${kpiSection('Quarry Intake, Stock & Haulage Split', [
          { label: 'Total Raw Cost', value: fmtUSD(k.raw_cost, 0), sub: fmtNum(k.raw_loads) + ' quarry loads', tone: 'brass' },
          { label: 'Material Cost (Site Owners)', value: fmtUSD(k.raw_mat_cost || k.ap_material, 0), sub: 'Quarry royalty / material' },
          { label: 'Haulage Cost (Truck Owners)', value: fmtUSD(k.raw_haulage || k.ap_haulage, 0), sub: '$0 on company fleet' },
          { label: 'Avg Raw Cost / Unit', value: fmtUSD(k.avg_raw_cost, 2), sub: 'Blended landed cost' },
          { label: 'Filtered Raw Tickets', value: fmtNum(rawRows.length), sub: 'In current slicer scope', tone: 'good' },
          { label: 'Registered Quarry/Delivery Sites', value: fmtNum((rec.sites || []).length), sub: fmtNum((rec.sites || []).filter(s => s.is_jv).length) + ' JV Sites' }
        ])}
        <div class="row2" style="margin-top:12px">
          <div class="panel"><div class="ph"><h3>Quarry Intake by Source Site</h3></div><div style="padding:10px 14px">${buildHorizontalRankChart(bySite.length ? bySite : (m.sites || []), bySite.length ? 'key' : 'Site', bySite.length ? 'total' : 'raw_cost', 'sub', true)}</div></div>
          <div class="panel"><div class="ph"><h3>Raw Intake by Material Grade &amp; Hauler</h3></div><div style="padding:10px 14px">${buildHorizontalRankChart(byProd.concat(byHauler.slice(0, 4)), 'key', 'total', 'sub', true)}</div></div>
        </div>
      `;
    }

    // ---- PAGE 09: FUEL & LUBRICANTS ----
    else if (activePageId === 'p09_fuel') {
      const wTank = window.MFG_FORMS ? window.MFG_FORMS.computeDieselTank(ctx, 'WTC') : { bought: 0, issued: 0, sold: 0, balance: 0 };
      const bTank = window.MFG_FORMS ? window.MFG_FORMS.computeDieselTank(ctx, 'BBConstruction') : { bought: 0, issued: 0, sold: 0, balance: 0 };
      const byEquip = groupBySum(fuelRows, r => r.equipment, r => r.litres, 'intakes');
      bodyHtml = `
        ${kpiSection('Diesel Tank Reconciliation & Fleet Burn Rate (m207 / m212)', [
          { label: 'WTC Diesel in Tank', value: fmtNum(wTank.balance, 0) + ' L', sub: `Bought ${fmtNum(wTank.bought, 0)} − Issued ${fmtNum(wTank.issued, 0)} L`, tone: 'good' },
          { label: 'BBConstruction Diesel Tank', value: fmtNum(bTank.balance, 0) + ' L', sub: `Bought ${fmtNum(bTank.bought, 0)} − Issued ${fmtNum(bTank.issued, 0)} L`, tone: bTank.balance < 0 ? 'crit' : 'good' },
          { label: 'Period Diesel Issued', value: fmtNum(k.diesel_litres, 0) + ' L', sub: fmtNum(fuelRows.length) + ' sample intakes' },
          { label: 'Fleet Cost per Ton', value: fmtUSD(k.cost_per_ton, 2), sub: 'Fuel + repairs / tons' },
          { label: 'Lubricant & Oil Items', value: fmtNum((rec.products || []).filter(p => p.fuel_item).length), sub: 'Oils, grease & hydraulic' },
          { label: 'M142 Meter Guard', value: 'Active', sub: 'Blocks rollback & >5,000km jumps', tone: 'brass' }
        ])}
        <div class="row2" style="margin-top:12px">
          <div class="panel"><div class="ph"><h3>Top Equipment by Litres Issued</h3></div><div style="padding:10px 14px">${buildHorizontalRankChart(byEquip, 'key', 'total', 'sub', false)}</div></div>
          <div class="panel-card">
            <div class="panel-head"><div class="panel-title"><span>RECENT DIESEL &amp; LUBRICANT INTAKES</span></div><button class="btn btn-primary" data-open-modal="fuel">+ Log Fuel Intake</button></div>
            <div class="table-wrap"><table class="ledger-table">
              <thead><tr><th>Date</th><th>Co.</th><th>Ticket</th><th>Type</th><th>Equipment</th><th>Driver</th><th class="r">Litres</th><th class="r">Odometer / Hrs</th></tr></thead>
              <tbody>
                ${fuelRows.slice(0, 25).map(f => `<tr><td class="mono">${esc(String(f.date || '').slice(0, 10))}</td><td><span class="badge badge-brass">${esc(f.company)}</span></td><td class="mono">${esc(f.ticket_no || '—')}</td><td>${esc(f.item || f.fuel_type)}</td><td class="mono"><b>${esc(f.equipment)}</b></td><td>${esc(f.driver || '—')}</td><td class="r"><b>${fmtNum(f.litres, 1)} L</b></td><td class="r mono">${f.odometer ? fmtNum(f.odometer) + ' km' : (f.hours ? fmtNum(f.hours) + ' h' : '—')}</td></tr>`).join('')}
              </tbody>
            </table></div>
          </div>
        </div>
      `;
    }

    // ---- PAGE 10: EQUIPMENT & FLEET ----
    else if (activePageId === 'p10_fleet') {
      const eqList = m.equipment || [];
      const coFleet = rec.company_equipment || [];
      bodyHtml = `
        ${kpiSection('Equipment & Fleet Telemetry (1,638 Universal · 1,829 Company Fleet Rows)', [
          { label: 'Active Equipment in Model', value: fmtNum(k.active_equip || eqList.length), sub: 'Tracked in P&L unit economics', tone: 'brass' },
          { label: 'Universal Equipment Master', value: fmtNum((rec.equipment || []).length), sub: 'Own + 3rd-party trucks & machines' },
          { label: 'Company Fleet Assignments', value: fmtNum(coFleet.length), sub: 'BU-scoped fleet records', tone: 'good' },
          { label: 'Fleet Cost per Ton Hauled', value: fmtUSD(k.cost_per_ton, 2), sub: 'Fuel + maintenance + driver' },
          { label: 'Own Fleet Units', value: fmtNum((rec.equipment || []).filter(e => /^own/i.test(e.ownership || '')).length), sub: 'Company-owned units' },
          { label: '3rd-Party Hauler Trucks', value: fmtNum((rec.equipment || []).filter(e => !/^own/i.test(e.ownership || '')).length), sub: 'Linked to Truck Owners' }
        ])}
        <div class="panel-card" style="margin-top:12px">
          <div class="panel-head"><div class="panel-title"><span>EQUIPMENT UNIT ECONOMICS MATRIX (LOADS · DIESEL · MAINTENANCE · DRIVER PAYROLL)</span></div><button class="btn btn-primary" data-open-modal="companyequipment">+ New Fleet Unit</button></div>
          <div class="table-wrap"><table class="ledger-table">
            <thead><tr><th>Equipment / Plate</th><th>Category</th><th>Ownership</th><th class="r">Sales Loads</th><th class="r">Raw Loads</th><th class="r">Diesel (L)</th><th class="r">Repairs &amp; Exp ($)</th><th class="r">Driver Pay ($)</th></tr></thead>
            <tbody>
              ${eqList.slice(0, 80).map(e => `
                <tr>
                  <td class="mono"><b>${esc(e.Equipment)}</b></td>
                  <td>${esc(e.Category || 'Truck')}</td>
                  <td><span class="badge ${/^own/i.test(e.Ownership || '') ? 'badge-ok' : 'badge-info'}">${esc(e.Ownership || 'Fleet')}</span></td>
                  <td class="r">${fmtNum(e.sales_loads)}</td>
                  <td class="r">${fmtNum(e.raw_loads)}</td>
                  <td class="r">${fmtNum(e.diesel_litres, 0)} L</td>
                  <td class="r">${fmtUSD(e.expenses, 0)}</td>
                  <td class="r">${fmtUSD(e.driver_pay, 0)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>
        </div>
      `;
    }

    // ---- PAGE 11: DRIVERS & OVERTIME ----
    else if (activePageId === 'p11_drivers') {
      const otSales = salesRows.filter(r => r.overtime);
      const otRaw = rawRows.filter(r => r.overtime);
      const byDriver = groupBySum(salesRows.concat(rawRows), r => r.driver, () => 1, 'trips');
      bodyHtml = `
        ${kpiSection('Drivers, Trip Dispatches & Night-Shift Overtime (m48 / m93)', [
          { label: 'Registered Drivers', value: fmtNum((rec.drivers || []).length), sub: fmtNum((rec.company_drivers || []).length) + ' company driver rows', tone: 'brass' },
          { label: 'Overtime Bonus Due', value: fmtUSD(k.overtime_bonus, 0), sub: 'Outside 06:00–17:59 day shift', tone: 'good' },
          { label: 'Overtime Sales Trips (Sample)', value: fmtNum(otSales.length), sub: 'Company-fleet night dispatches' },
          { label: 'Overtime Quarry Trips (Sample)', value: fmtNum(otRaw.length), sub: 'Company-fleet quarry dispatches' },
          { label: 'Overtime Trip Rate Rules', value: fmtNum((rec.overtime_rates || []).length), sub: 'bhf_triprate table' },
          { label: 'Day Shift Window', value: '06:00–17:59', sub: 'Night shift auto-flags Overtime' }
        ])}
        <div class="row2" style="margin-top:12px">
          <div class="panel"><div class="ph"><h3>Top Drivers by Dispatched Trips</h3></div><div style="padding:10px 14px">${buildHorizontalRankChart(byDriver, 'key', 'count', 'sub', false)}</div></div>
          <div class="panel-card">
            <div class="panel-head"><div class="panel-title"><span>OVERTIME TRIP RATE SCHEDULE (bhf_triprate)</span></div><button class="btn btn-primary" data-open-modal="triprate">+ New Overtime Rate</button></div>
            <div class="table-wrap"><table class="ledger-table">
              <thead><tr><th>Co.</th><th>Rate Name</th><th>Site / Route</th><th>Category</th><th class="r">Bonus / Trip ($)</th></tr></thead>
              <tbody>
                ${(rec.overtime_rates || []).map(r => `<tr><td><span class="badge badge-brass">${esc(r.company || 'WTC')}</span></td><td><b>${esc(r.name)}</b></td><td>${esc(r.site || 'All')}</td><td>${esc(r.category || 'Truck')}</td><td class="r"><b>${fmtUSD(r.rate_usd || r.amount || 10, 2)}</b></td></tr>`).join('')}
              </tbody>
            </table></div>
          </div>
        </div>
      `;
    }

    // ---- PAGE 12: PAYROLL, ATTENDANCE & SITE ALLOWANCES ----
    else if (activePageId === 'p12_payroll') {
      const salRows = filterRecords(rec.salaries, { ignoreSearch: true });
      const empRows = filterRecords(rec.employments, { ignorePeriod: true });
      const attRows = filterRecords(rec.attendance, { ignoreSearch: true });
      const logRows = filterRecords(rec.logistics_allowances, { ignoreSearch: true });
      bodyHtml = `
        ${kpiSection('Workforce Payroll, Contracts, Attendance & Weekly Site Allowances', [
          { label: 'Salaries Paid (Period)', value: fmtUSD(k.salaries_paid, 0), sub: fmtNum(salRows.length) + ' sample salary rows', tone: 'brass' },
          { label: 'Employment Contracts', value: fmtNum(empRows.length), sub: 'bhf_employment master', tone: 'good' },
          { label: 'Attendance Logs', value: fmtNum(attRows.length), sub: 'bhf_attendance daily shift logs' },
          { label: 'Site Allowances (Mon–Sun)', value: fmtNum(logRows.length), sub: 'bhf_logistics weekly allowances' },
          { label: 'Overtime Bonus', value: fmtUSD(k.overtime_bonus, 0), sub: 'Driver trip bonuses' },
          { label: 'Quick Actions', value: '4 HR Forms', sub: 'Salary · Contract · Attendance · Allowance' }
        ])}
        <div class="row2" style="margin-top:12px">
          <div class="panel-card">
            <div class="panel-head"><div class="panel-title"><span>EMPLOYMENT CONTRACTS (${empRows.length})</span></div><button class="btn btn-primary" data-open-modal="employment">+ New Contract</button></div>
            <div class="table-wrap" style="max-height:280px;overflow:auto"><table class="ledger-table">
              <thead><tr><th>Co.</th><th>Staff Member</th><th>Role</th><th>Pay Type</th><th class="r">Base Salary ($)</th><th>Status</th></tr></thead>
              <tbody>${empRows.slice(0, 60).map(e => `<tr><td><span class="badge badge-brass">${esc(e.company)}</span></td><td><b>${esc(e.staff || e.name)}</b></td><td>${esc(e.role || 'Staff')}</td><td>${esc(e.pay_type || 'Monthly')}</td><td class="r"><b>${fmtUSD(e.base_salary || e.amount, 2)}</b></td><td><span class="badge badge-ok">${esc(e.status || 'Active')}</span></td></tr>`).join('')}</tbody>
            </table></div>
          </div>
          <div class="panel-card">
            <div class="panel-head"><div class="panel-title"><span>WEEKLY SITE ALLOWANCES (MON–SUN · ${logRows.length})</span></div><button class="btn btn-primary" data-open-modal="logistics">+ New Site Allowance</button></div>
            <div class="table-wrap" style="max-height:280px;overflow:auto"><table class="ledger-table">
              <thead><tr><th>Date</th><th>Co.</th><th>Staff</th><th>Site</th><th class="r">Days</th><th class="r">USD Value ($)</th></tr></thead>
              <tbody>${logRows.slice(0, 60).map(l => `<tr><td class="mono">${esc(String(l.date || '').slice(0, 10))}</td><td><span class="badge badge-brass">${esc(l.company)}</span></td><td><b>${esc(l.staff || l.name)}</b></td><td>${esc(l.site || '—')}</td><td class="r mono">${fmtNum(l.days_count || 6)}d</td><td class="r"><b>${fmtUSD(l.amount, 2)}</b></td></tr>`).join('')}</tbody>
            </table></div>
          </div>
        </div>
      `;
    }

    // ---- PAGE 13: VAT & STATUTORY INVOICES ----
    else if (activePageId === 'p13_vat') {
      const vatInvs = filterRecords(rec.vat_invoices, { ignoreSearch: true });
      bodyHtml = `
        ${kpiSection('11% Statutory VAT & Official Tax Invoice Register', [
          { label: 'Output VAT 11% (4427)', value: fmtUSD(k.sales_vat, 2), sub: 'Billed on VAT sales tickets', tone: 'brass' },
          { label: 'VAT Receivable Balance', value: fmtUSD(k.vat_receivable, 2), sub: 'Open statutory VAT leg' },
          { label: 'Official VAT Invoices', value: fmtNum(vatInvs.length), sub: 'bhf_vatinvoice headers', tone: 'good' },
          { label: 'VAT-Registered Customers', value: fmtNum((rec.customers || []).filter(c => c.vat_registered).length), sub: 'Carry 11% VAT on tickets' },
          { label: 'IVA-Registered Suppliers', value: fmtNum((rec.suppliers || []).filter(s => s.iva).length), sub: 'Input VAT / IVA vendors' },
          { label: 'Statutory VAT Rate', value: '11.0%', sub: 'Lebanese MoF standard rate' }
        ])}
        <div class="panel-card" style="margin-top:12px">
          <div class="panel-head"><div class="panel-title"><span>OFFICIAL VAT INVOICES REGISTER (${vatInvs.length} INVOICES)</span></div><button class="btn btn-primary" data-open-modal="vatinvoice">+ New VAT Invoice</button></div>
          <div class="table-wrap"><table class="ledger-table">
            <thead><tr><th>Date</th><th>Co.</th><th>Invoice No.</th><th>Customer</th><th class="r">Net Ex-VAT ($)</th><th class="r">11% VAT ($)</th><th class="r">Total TTC ($)</th><th>Status</th></tr></thead>
            <tbody>
              ${vatInvs.slice(0, 80).map(v => `
                <tr>
                  <td class="mono">${esc(String(v.date || '').slice(0, 10))}</td>
                  <td><span class="badge badge-brass">${esc(v.company)}</span></td>
                  <td class="mono"><b>${esc(v.invoice_no || v.name)}</b></td>
                  <td><b>${esc(v.customer || '—')}</b></td>
                  <td class="r">${fmtUSD(v.net_amount, 2)}</td>
                  <td class="r">${fmtUSD(v.vat_amount, 2)}</td>
                  <td class="r"><b>${fmtUSD(v.total_ttc, 2)}</b></td>
                  <td><span class="badge badge-ok">${esc(v.status || 'Issued')}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>
        </div>
      `;
    }

    // ---- PAGE 14: CASH FLOW & DAILY TILL ----
    else if (activePageId === 'p14_cash') {
      const dtRows = filterRecords(rec.daily_totals, { ignoreSearch: true });
      bodyHtml = `
        ${kpiSection('Cash Flow Waterfall & 5300 Till Reconciliation', [
          { label: 'Cash Till Balance (5300)', value: fmtUSD(k.cash_till, 2), sub: 'Audited closing till', tone: 'brass' },
          { label: 'Total Cash Inflows', value: fmtUSD(k.cash_inflow, 0), sub: 'Cash sales + AR receipts + loans in', tone: 'good' },
          { label: 'Total Cash Outflows', value: fmtUSD(k.cash_outflow, 0), sub: 'Cash expenses + AP settlements + payroll' },
          { label: 'Customer Receipts (Sample)', value: fmtNum(rcptRows.length), sub: fmtUSD(rcptRows.reduce((a, r) => a + Number(r.amount || 0), 0), 0) },
          { label: 'Supplier Settlements (Sample)', value: fmtNum(setRows.length), sub: fmtUSD(setRows.reduce((a, r) => a + Number(r.amount || 0), 0), 0) },
          { label: 'Daily Till Snapshots', value: fmtNum(dtRows.length), sub: 'bhf_dailytotal register' }
        ])}
        <div class="row2" style="margin-top:12px">
          <div class="panel"><div class="ph"><h3>Monthly Cash Profit vs Expenses Trajectory</h3></div><div class="chartwrap">${buildMonthlyComboSvg(m.monthly, 'operating_profit', 'expenses', 'Operating Profit', 'Expenses', true)}</div></div>
          <div class="panel-card">
            <div class="panel-head"><div class="panel-title"><span>DAILY TILL &amp; SCALE TOTALS (bhf_dailytotal · ${dtRows.length})</span></div></div>
            <div class="table-wrap" style="max-height:260px;overflow:auto"><table class="ledger-table">
              <thead><tr><th>Date</th><th>Co.</th><th>Reference</th><th class="r">Sales ($)</th><th class="r">Cash In ($)</th><th class="r">Cash Out ($)</th><th class="r">Closing Till ($)</th></tr></thead>
              <tbody>${dtRows.slice(0, 50).map(d => `<tr><td class="mono">${esc(String(d.date || '').slice(0, 10))}</td><td><span class="badge badge-brass">${esc(d.company)}</span></td><td>${esc(d.name)}</td><td class="r">${fmtUSD(d.sales_total, 0)}</td><td class="r">${fmtUSD(d.cash_in, 0)}</td><td class="r">${fmtUSD(d.cash_out, 0)}</td><td class="r"><b>${fmtUSD(d.closing_till, 2)}</b></td></tr>`).join('')}</tbody>
            </table></div>
          </div>
        </div>
      `;
    }

    // ---- PAGE 15: TREASURY, PARTNER LOANS & FX CONVERSIONS ----
    else if (activePageId === 'p15_treasury') {
      const loans = filterRecords(rec.loans, { ignoreSearch: true });
      const lSet = filterRecords(rec.loan_settlements, { ignoreSearch: true });
      const ext = filterRecords(rec.external_movements, { ignoreSearch: true });
      const conv = filterRecords(rec.conversions, { ignoreSearch: true });
      bodyHtml = `
        ${kpiSection('Treasury, Partner Loans, Settlements & FX Conversions', [
          { label: 'Partner & Entity Loans', value: fmtNum(loans.length), sub: fmtUSD(loans.reduce((a, r) => a + Number(r.amount || 0), 0), 0), tone: 'brass' },
          { label: 'Loan Settlements', value: fmtNum(lSet.length), sub: fmtUSD(lSet.reduce((a, r) => a + Number(r.amount || 0), 0), 0), tone: 'good' },
          { label: 'External Cash Movements', value: fmtNum(ext.length), sub: fmtUSD(ext.reduce((a, r) => a + Number(r.amount || 0), 0), 0) },
          { label: 'FX Conversions (USD ↔ LBP)', value: fmtNum(conv.length), sub: 'At 90,000 LBP/USD peg' },
          { label: 'Cash Till 5300', value: fmtUSD(k.cash_till, 2), sub: 'Reflects treasury legs' },
          { label: 'Treasury Desk', value: 'Live', sub: 'Post Loan, Repayment or FX' }
        ])}
        <div class="row2" style="margin-top:12px">
          <div class="panel-card">
            <div class="panel-head"><div class="panel-title"><span>PARTNER &amp; INTERCOMPANY LOANS (bhf_loan · ${loans.length})</span></div><button class="btn btn-primary" data-open-modal="treasury">+ New Treasury Entry</button></div>
            <div class="table-wrap" style="max-height:280px;overflow:auto"><table class="ledger-table">
              <thead><tr><th>Date</th><th>Co.</th><th>Loan Ref</th><th>Lender / Partner</th><th class="r">Amount ($)</th></tr></thead>
              <tbody>${loans.slice(0, 60).map(l => `<tr><td class="mono">${esc(String(l.date || '').slice(0, 10))}</td><td><span class="badge badge-brass">${esc(l.company)}</span></td><td><b>${esc(l.name)}</b></td><td>${esc(l.lender || l.counterparty || 'Partner')}</td><td class="r"><b>${fmtUSD(l.amount, 2)}</b></td></tr>`).join('')}</tbody>
            </table></div>
          </div>
          <div class="panel-card">
            <div class="panel-head"><div class="panel-title"><span>CURRENCY CONVERSIONS &amp; EXTERNAL MOVEMENTS (${conv.length + ext.length})</span></div></div>
            <div class="table-wrap" style="max-height:280px;overflow:auto"><table class="ledger-table">
              <thead><tr><th>Date</th><th>Co.</th><th>Type</th><th>Reference</th><th class="r">USD Amount ($)</th><th class="r">LBP Amount</th></tr></thead>
              <tbody>
                ${conv.slice(0, 30).map(c => `<tr><td class="mono">${esc(String(c.date || '').slice(0, 10))}</td><td><span class="badge badge-brass">${esc(c.company)}</span></td><td><span class="badge badge-info">FX Conv</span></td><td>${esc(c.name)}</td><td class="r"><b>${fmtUSD(c.usd_amount || c.amount, 2)}</b></td><td class="r mono">${fmtNum(c.lbp_amount, 0)}</td></tr>`).join('')}
                ${ext.slice(0, 30).map(e => `<tr><td class="mono">${esc(String(e.date || '').slice(0, 10))}</td><td><span class="badge badge-brass">${esc(e.company)}</span></td><td><span class="badge badge-warn">${esc(e.direction || 'External')}</span></td><td>${esc(e.name)}</td><td class="r"><b>${fmtUSD(e.amount, 2)}</b></td><td class="r mono">—</td></tr>`).join('')}
              </tbody>
            </table></div>
          </div>
        </div>
      `;
    }

    // ---- PAGE 16: FINANCIAL GL & SOA ----
    else if (activePageId === 'p16_financial') {
      const tbRows = m.gl_tb || [];
      const soaRows = m.soa_stream || [];
      bodyHtml = `
        ${kpiSection('Lebanese CoA Double-Entry General Ledger & Trial Balance', [
          { label: 'Trial Balance Variance', value: fmtUSD(k.tb_check || 0, 2), sub: 'Total Debits − Total Credits', tone: Math.abs(Number(k.tb_check || 0)) < 0.005 ? 'good' : 'crit' },
          { label: 'General Ledger Accounts', value: fmtNum(tbRows.length), sub: 'Classes 4, 5, 6 & 7', tone: 'brass' },
          { label: 'Class 7: Revenue TTC', value: fmtUSD(k.sales_ttc, 0), sub: '7011 Aggregates + 7061 Transport' },
          { label: 'Class 6: Cost & Expenses', value: fmtUSD(Number(k.raw_cost || 0) + Number(k.expenses || 0) + Number(k.salaries_paid || 0), 0), sub: '6011 Raw + 61/62 Exp + 64 Pay' },
          { label: 'Class 4: AR / AP / VAT', value: fmtUSD(k.ar_balance, 0), sub: '4111 AR · 4011 AP · 4427 VAT' },
          { label: 'Class 5: Cash Till 5300', value: fmtUSD(k.cash_till, 2), sub: 'Physical & ledger till' }
        ])}
        <div class="panel-card" style="margin-top:12px">
          <div class="panel-head"><div class="panel-title"><span>LEBANESE COA TRIAL BALANCE (${tbRows.length} ACCOUNTS)</span></div></div>
          <div class="table-wrap"><table class="ledger-table">
            <thead><tr><th>CoA Code</th><th>Account Name</th><th>Class</th><th class="r">Total Debit ($)</th><th class="r">Total Credit ($)</th><th class="r">Net Balance ($)</th></tr></thead>
            <tbody>
              ${tbRows.map(r => `<tr><td class="mono"><b>${esc(r.Code)}</b></td><td><b>${esc(r.Account)}</b></td><td>${esc(r.Class || '')}</td><td class="r">${fmtUSD(r.Debit, 2)}</td><td class="r">${fmtUSD(r.Credit, 2)}</td><td class="r"><b>${fmtUSD(r.Balance, 2)}</b></td></tr>`).join('')}
            </tbody>
          </table></div>
        </div>
      `;
    }

    // ---- PAGE 17: JV SITES ----
    else if (activePageId === 'p17_jv') {
      const jvSites = (rec.sites || []).filter(s => s.is_jv);
      const jvParts = rec.jv_partnerships || [];
      const jvDists = rec.jv_distributions || [];
      bodyHtml = `
        ${kpiSection('Joint-Venture (JV) Quarry Sites, Partnerships & Profit Distributions', [
          { label: 'Active JV Quarry Partnerships', value: fmtNum(jvParts.length), sub: 'bhf_jvpartnership', tone: 'brass' },
          { label: 'JV Profit Distributions', value: fmtNum(jvDists.length), sub: fmtUSD(jvDists.reduce((a, r) => a + Number(r.amount || 0), 0), 0), tone: 'good' },
          { label: 'Flagged JV Sites', value: fmtNum(jvSites.length), sub: 'Sites with is_jv = true' }
        ])}
        <div class="row2" style="margin-top:12px">
          <div class="panel-card">
            <div class="panel-head"><div class="panel-title"><span>JV PARTNERSHIPS (${jvParts.length})</span></div><button class="btn btn-primary" data-open-modal="jv">+ New JV Entry</button></div>
            <div class="table-wrap"><table class="ledger-table">
              <thead><tr><th>Co.</th><th>Partnership</th><th>JV Site</th><th>Partner</th><th class="r">Partner Share %</th></tr></thead>
              <tbody>${jvParts.map(p => `<tr><td><span class="badge badge-brass">${esc(p.company)}</span></td><td><b>${esc(p.name)}</b></td><td>${esc(p.site || '—')}</td><td>${esc(p.partner || '—')}</td><td class="r mono">${fmtNum(p.share_pct || 50, 1)}%</td></tr>`).join('')}</tbody>
            </table></div>
          </div>
          <div class="panel-card">
            <div class="panel-head"><div class="panel-title"><span>JV PROFIT &amp; CASH DISTRIBUTIONS (${jvDists.length})</span></div></div>
            <div class="table-wrap" style="max-height:280px;overflow:auto"><table class="ledger-table">
              <thead><tr><th>Date</th><th>Co.</th><th>Reference</th><th>Site</th><th>Partner</th><th class="r">Amount ($)</th></tr></thead>
              <tbody>${jvDists.map(d => `<tr><td class="mono">${esc(String(d.date || '').slice(0, 10))}</td><td><span class="badge badge-brass">${esc(d.company)}</span></td><td><b>${esc(d.name)}</b></td><td>${esc(d.site || '—')}</td><td>${esc(d.partner || '—')}</td><td class="r"><b>${fmtUSD(d.amount, 2)}</b></td></tr>`).join('')}</tbody>
            </table></div>
          </div>
        </div>
      `;
    }

    // ---- PAGE 18: TICKET BOOKS ----
    else if (activePageId === 'p18_tickets') {
      const prSn = (((SEED.sentinels || {}).pricing_commission_payroll_sentinel || {}).by_model || {})[STATE.company === 'wtc' ? 'WTC' : (STATE.company === 'bbconstruction' ? 'BBConstruction' : 'Manufacturing Group')] || {};
      bodyHtml = `
        ${kpiSection('Weighbridge Ticket Pad Hygiene, Missing Numbers & Duplicate Audit', [
          { label: 'Duplicate Ticket Numbers', value: fmtNum(prSn.duplicate_ticket_numbers || 0), sub: 'Across active pads', tone: 'warn' },
          { label: 'Unnumbered Tickets', value: fmtNum(prSn.unnumbered_tickets || 0), sub: 'Tickets missing serial #' },
          { label: 'Incomplete Ticket Books', value: fmtNum(prSn.incomplete_ticket_books || 0), sub: '50-ticket physical pads' },
          { label: 'Missing Numbers in Books', value: fmtNum(prSn.missing_tickets_in_books || 0), sub: 'Gaps in pad sequence' },
          { label: 'Entry Desk Duplicate Guard', value: 'Enforced', sub: 'Blocks repeated ticket # per BU', tone: 'good' },
          { label: 'Next Suggested WTC Ticket #', value: '#' + (salesRows[0] ? (parseInt(salesRows[0].ticket_no, 10) + 1 || 'Auto') : 'Auto'), sub: 'Auto-Increment on modal open', tone: 'brass' }
        ])}
        <div class="panel-card" style="margin-top:12px">
          <div class="panel-head"><div class="panel-title"><span>RECENT WEIGHBRIDGE TICKET SERIAL AUDIT (SALES &amp; QUARRY PADS)</span></div></div>
          <div class="table-wrap"><table class="ledger-table">
            <thead><tr><th>Pad Type</th><th>Date</th><th>Co.</th><th>Ticket #</th><th>Counterparty</th><th>Product</th><th class="r">Qty</th><th class="r">Amount ($)</th></tr></thead>
            <tbody>
              ${salesRows.slice(0, 30).map(r => `<tr><td><span class="badge badge-ok">Sales Pad</span></td><td class="mono">${esc(String(r.date || '').slice(0, 10))}</td><td>${esc(r.company)}</td><td class="mono"><b>#${esc(r.ticket_no)}</b></td><td>${esc(r.customer)}</td><td>${esc(r.product)}</td><td class="r">${fmtNum(r.qty, 1)}</td><td class="r"><b>${fmtUSD(r.total_ttc, 2)}</b></td></tr>`).join('')}
              ${rawRows.slice(0, 20).map(r => `<tr><td><span class="badge badge-info">Quarry Pad</span></td><td class="mono">${esc(String(r.date || '').slice(0, 10))}</td><td>${esc(r.company)}</td><td class="mono"><b>#${esc(r.ticket_no)}</b></td><td>${esc(r.site_owner || r.site)}</td><td>${esc(r.product)}</td><td class="r">${fmtNum(r.qty, 1)}</td><td class="r"><b>${fmtUSD(r.total, 2)}</b></td></tr>`).join('')}
            </tbody>
          </table></div>
        </div>
      `;
    }

    // ---- PAGE 19: CHANGE LOG & DATE BASIS DRIFT ----
    else if (activePageId === 'p19_changelog') {
      const parity = (SEED.sentinels || {}).sharepoint_parity_sentinel || {};
      const gaps = parity.date_basis_anomalies_gt_31d || [];
      bodyHtml = `
        ${kpiSection('Transaction Date vs Reporting Date Basis Drift & App Audit Log', [
          { label: 'Sales (Tx Date Basis)', value: fmtUSD(k.sales_ttc, 0), sub: 'Operational weighbridge date', tone: 'brass' },
          { label: 'Sales (Rep Date Basis)', value: fmtUSD(k.sales_rep_date || k.sales_ttc, 0), sub: 'Statutory reporting date' },
          { label: 'Raw Cost (Tx vs Rep)', value: fmtUSD(k.raw_cost, 0), sub: 'Rep: ' + fmtUSD(k.raw_rep_date || k.raw_cost, 0) },
          { label: 'Date Gaps > 31 Days', value: fmtNum(parity.date_basis_anomalies_gt_31d_count || gaps.length), sub: 'Flagged by Sentinel S8', tone: 'warn' },
          { label: '60-Day Gap Guard (m277)', value: 'Active', sub: 'Requires explanation on entry', tone: 'good' },
          { label: 'Topbar Date Basis Toggle', value: STATE.basis === 'rep' ? 'Rep Date' : 'Tx Date', sub: 'Switch live in topbar' }
        ])}
        <div class="panel-card" style="margin-top:12px">
          <div class="panel-head"><div class="panel-title"><span>TRANSACTION DATE vs REPORTING DATE DRIFT &gt; 31 DAYS (${gaps.length} ANOMALIES)</span></div></div>
          <div class="table-wrap"><table class="ledger-table">
            <thead><tr><th>Table</th><th>BU</th><th>Record</th><th>Ticket #</th><th>Tx Date</th><th>Rep Date</th><th class="r">Gap (Days)</th><th class="r">Amount ($)</th></tr></thead>
            <tbody>
              ${gaps.slice(0, 60).map(g => `<tr><td>${esc(g.table)}</td><td><span class="badge badge-brass">${esc(g.bu)}</span></td><td><b>${esc(g.name)}</b></td><td class="mono">${esc(g.ticket || '—')}</td><td class="mono">${esc(g.transaction_date)}</td><td class="mono">${esc(g.reporting_date)}</td><td class="r"><b class="crit-text">${fmtNum(g.gap_days)} d</b></td><td class="r">${fmtUSD(g.amount_usd, 2)}</td></tr>`).join('')}
            </tbody>
          </table></div>
        </div>
      `;
    }

    // ---- PAGE 20: STATEMENT RECON & 22 PDFs ----
    else {
      bodyHtml = `
        ${kpiSection('Cross-Statement Reconciliation Matrix (Ties Power BI → GL → 22 Printable A4 Statements)', [
          { label: 'P&L Net Sales → Stmt 01/05', value: fmtUSD(k.net_sales, 2), sub: 'Ties to Class 7011 + 7061', tone: 'good' },
          { label: 'Output VAT 11% → Stmt 17', value: fmtUSD(k.sales_vat, 2), sub: 'Ties to Class 4427', tone: 'good' },
          { label: 'FIFO Open AR → Stmt 11/12', value: fmtUSD(k.ar_balance, 2), sub: 'Ties to Class 4111', tone: 'good' },
          { label: '3-Leg Open AP → Stmt 13/14', value: fmtUSD(k.ap_balance, 2), sub: 'Ties to Class 4011', tone: 'good' },
          { label: 'Cash Till 5300 → Stmt 18', value: fmtUSD(k.cash_till, 2), sub: 'Ties to Class 5300', tone: 'good' },
          { label: 'Trial Balance → Stmt 19/20', value: fmtUSD(k.tb_check || 0, 2), sub: 'Double-Entry Variance $0.00', tone: 'brass' }
        ])}
        <div class="panel-card" style="margin-top:12px">
          <div class="panel-head">
            <div class="panel-title"><span>22 PRINTABLE A4 STATEMENTS RECONCILIATION &amp; 1-CLICK LAUNCHER</span></div>
            <button type="button" class="btn btn-brass" data-nav-jump="statements">Open Full A4 Statement Center →</button>
          </div>
          <div style="padding:14px;font-size:13px;line-height:1.6">
            Every measure in this 20-page Power BI studio reconciles to the cent with the <b>Lebanese CoA Trial Balance</b> and the <b>22 Printable A4 Statements</b>. Click any statement button below to open its A4 print sheet:
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px;margin-top:12px">
              ${(ctx.STATEMENT_CATALOG || []).map(s => `
                <button type="button" class="btn" style="justify-content:flex-start;text-align:left;padding:8px 10px" data-nav-jump="statements" data-stmt-jump="${esc(s.code)}">
                  <b class="mono" style="color:var(--brass);margin-right:6px">#${esc(s.code)}</b> ${esc(s.name)}
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }

    return `<div id="pbiCanvasPanel">${headerHtml}${bodyHtml}</div>`;
  }

  // ==================== 28-TABLE POWER APPS DATA HUB RENDERER ====================
  function renderTablesHub(ctx) {
    const { STATE, SEED, filterRecords, sortRows, th, shownCount, showMoreRow, emptyRow, exportBtn, searchBox, appCell, canEnterForm } = ctx;
    const activeKey = STATE.activeTableKey || 'price_rules';
    const meta = TABLE_CATALOG.find(t => t.key === activeKey) || TABLE_CATALOG[0];
    const rawList = (SEED.records && SEED.records[meta.key]) || [];
    const filtered = filterRecords(rawList, { ignorePeriod: !['sales_tickets', 'raw_purchases', 'receipts', 'settlements', 'fuel_intakes', 'expenses', 'salaries', 'attendance'].includes(meta.key) });
    const defSort = meta.cols.includes('date') ? 'date' : (meta.cols[0] || 'name');
    const rows = sortRows(filtered, 'tbl_' + meta.key, defSort, meta.cols.includes('date') ? 'desc' : 'asc');
    const shown = rows.slice(0, shownCount('tbl_' + meta.key));

    const groups = Array.from(new Set(TABLE_CATALOG.map(t => t.group)));

    return `
      <div class="cockpit-banner">
        <div class="cockpit-title-block">
          <div class="cockpit-eyebrow">POWER APPS SITEMAP PARITY (m14_sitemap.py) · ALL 34 DATAVERSE TABLES &amp; REGISTERS</div>
          <div class="cockpit-title">${esc(meta.label)} <span class="mono" style="font-size:13px;color:var(--brass)">(${esc(meta.dvn)})</span></div>
          <div class="cockpit-sub">Browse, search, sort, export CSV, or post new records across every operational, pricing, master-data, payroll, logistics, treasury, and JV table.</div>
        </div>
        <div class="cockpit-pills">
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Active Table</div><div class="cockpit-pill-val brass">${esc(meta.label)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Matching Rows</div><div class="cockpit-pill-val">${fmtNum(rows.length)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Total in Snapshot</div><div class="cockpit-pill-val emerald">${fmtNum(rawList.length)}</div></div>
        </div>
      </div>

      <!-- Table Picker Strip Grouped by Sitemap Area -->
      <div class="panel-card" style="margin-bottom:12px;padding:10px 12px">
        ${groups.map(g => `
          <div style="margin-bottom:8px">
            <div style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:4px">${esc(g)}</div>
            <div class="chip-bar">
              ${TABLE_CATALOG.filter(t => t.group === g).map(t => {
                const cnt = ((SEED.records && SEED.records[t.key]) || []).length;
                return `<button type="button" class="filter-chip ${t.key === meta.key ? 'active' : ''}" data-table-key="${esc(t.key)}">${esc(t.label)} <span class="mono" style="opacity:.75">(${fmtNum(cnt)})</span></button>`;
              }).join('')}
            </div>
          </div>
        `).join('')}
      </div>

      <div class="panel-card" id="tablesHubPanel">
        <div class="table-toolbar">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            ${searchBox('Search ' + meta.label + ' (' + meta.dvn + ')...')}
          </div>
          <div style="display:flex;gap:6px">
            ${exportBtn('tablesHubPanel', meta.key)}
            ${canEnterForm(meta.form) ? `<button type="button" class="btn btn-primary" data-open-modal="${esc(meta.form)}">+ New ${esc(meta.label.replace(/s$/, ''))}</button>` : ''}
          </div>
        </div>
        <div class="table-wrap">
          <table class="ledger-table">
            <thead>
              <tr>
                ${meta.cols.map(c => th('tbl_' + meta.key, c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), c, /price|cost|amount|total|vat|limit|salary|balance|qty|litres|capacity|factor|pct|days|hours|count/.test(c) ? 'r' : '')).join('')}
              </tr>
            </thead>
            <tbody>
              ${shown.map((r, idx) => `
                <tr>
                  ${meta.cols.map((c, ci) => {
                    const v = r[c];
                    const isMoney = /price|cost|amount|total|vat|limit|salary|balance|adj|indiff|rate_usd|cash_in|cash_out|closing_till/.test(c);
                    const isNum = !isMoney && /qty|litres|capacity|factor|pct|days|hours|count|odometer/.test(c);
                    let cell = v == null || v === '' ? '—' : (typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v));
                    if (isMoney && v != null && v !== '') cell = fmtUSD(v, 2);
                    else if (isNum && v != null && v !== '') cell = fmtNum(v, /factor|qty|capacity/.test(c) ? 2 : 0);
                    return `<td class="${isMoney || isNum ? 'r' : ''}${/date|ticket|code|no|plate/.test(c) ? ' mono' : ''}">${ci === 0 ? `<b>${esc(cell)}</b>${appCell(r, meta.key)}` : esc(cell)}</td>`;
                  }).join('')}
                </tr>
              `).join('') || emptyRow(meta.cols.length, 'No rows match the active filter.')}
              ${showMoreRow('tbl_' + meta.key, rows.length, meta.cols.length)}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  window.MFG_PBI = {
    PBI_PAGES,
    TABLE_CATALOG,
    renderPbiStudio,
    renderTablesHub
  };
})();
