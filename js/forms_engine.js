/* ============================================================================
   ISABI Systems — Power Apps Form Automation & 24-Table Data Entry Engine (v4.0)
   100% Parity with m12_forms.py + bhf_manufacturing.js + m14_sitemap.py:
   - Embedded 4-Card Executive Cockpit (bhf_mfgCockpit.htm m283)
   - Live Contextual Intelligence Banner (bhf_live_banner m281)
   - Cascading Truck Owner -> Truck -> Driver locks & single-match auto-fill (m125/m126b/m130/m131)
   - Locked Truck Quick-View strip (qv_truck m99: Plate No · Type · Ownership · Capacity m³ · Default Driver)
   - Site -> Default Site Owner & Truck Owner auto-fill on Raw Material Ticket (m84/m125)
   - Sale Type (Delivery / Pickup / Unregistered) & Transport (Third-party / Company fleet) gating
   - Price Agreement engine with Tier 1 / Tier 2 truck capacity adjustments & List Price fallback (m70/m73/m103/m125/m136)
   - Unit override & per-load (Truck = 1) rules + Capacity Learn & Driver Owner Learn (m128/m222/m228/m229)
   - Customer Method lock (Cash/Credit m50/m58) + Customer-declared Qty & External Invoice flag gating (m60)
   - Diesel Tank balance guard (m207/m212) + Odometer/Hours rollback & spike guard (m277) + Burn rate L/100km
   - Duplicate Ticket No guard & Discount/60-Day Reporting Date guard (m277)
   - Dual-Currency (USD Amount + LBP Amount -> locked USD Value at 90,000 FX rate, bhf_usdPreview.js)
   - Category -> Subcategory strict cascade (bhf_subcatFilter.js) + Cash/Credit Expense scope (m140)
   - Live Open-Ticket / 3-Leg AP FIFO Allocation Preview on Customer & Supplier Settlements (step236/step240/step241)
   - All 24 Operational, Setup, HQ Master Data, Payroll, Logistics, Treasury & JV Forms
   ============================================================================ */

(function () {
  'use strict';

  const FX_RATE = 90000;
  const VAT_RATE = 0.11;
  const MIN_DATE = '2024-01-01';

  const FORM_GROUPS = [
    {
      id: 'dispatch',
      label: '1. Dispatch & Settlements (6)',
      forms: [
        { id: 'sales', label: 'Sales Ticket', badge: 'bhf_salesticket', crKey: 'sales_tickets', title: 'New Sales Ticket' },
        { id: 'raw', label: 'Raw Material Ticket', badge: 'bhf_rawpurchase', crKey: 'raw_purchases', title: 'New Raw Material Ticket' },
        { id: 'receipt', label: 'Customer Settlement', badge: 'bhf_customerreceipt', crKey: 'receipts', title: 'New Customer Settlement' },
        { id: 'settlement', label: 'Supplier Settlement', badge: 'bhf_supplierpayment', crKey: 'settlements', title: 'New Supplier Settlement' },
        { id: 'fuel', label: 'Fuel & Lubricant Intake', badge: 'bhf_fuelintake', crKey: 'fuel_intakes', title: 'New Fuel & Lubricant Intake' },
        { id: 'expense', label: 'Expense (Cash / Credit)', badge: 'bhf_expense', crKey: 'expenses', title: 'New Expense' }
      ]
    },
    {
      id: 'pricing',
      label: '2. Sales & Pricing Setup (3)',
      forms: [
        { id: 'pricerule', label: 'Price Agreement', badge: 'bhf_pricerule', crKey: 'price_rules', title: 'New Price Agreement' },
        { id: 'vatinvoice', label: 'VAT Invoice', badge: 'bhf_vatinvoice', crKey: 'vat_invoices', title: 'New VAT Invoice' },
        { id: 'creditterm', label: 'Credit Terms', badge: 'bhf_creditterm', crKey: 'credit_terms', title: 'New Customer Credit Terms' }
      ]
    },
    {
      id: 'hq',
      label: '3. HQ Master Data (7)',
      forms: [
        { id: 'customer', label: 'Customer', badge: 'bhf_customer', crKey: 'customers', title: 'New Customer' },
        { id: 'supplier', label: 'Supplier / Hauler', badge: 'bhf_supplier', crKey: 'suppliers', title: 'New Supplier / Hauler' },
        { id: 'product', label: 'Product / Grade', badge: 'bhf_product', crKey: 'products', title: 'New Product / Aggregate Grade' },
        { id: 'site', label: 'Site & Quarry GPS', badge: 'bhf_site', crKey: 'sites', title: 'New Site / Quarry' },
        { id: 'equipment', label: 'Equipment (All / 3P)', badge: 'bhf_equipment', crKey: 'equipment', title: 'New Equipment / Third-Party Truck' },
        { id: 'companyequipment', label: 'Company Fleet Unit', badge: 'bhf_companyequipment', crKey: 'company_equipment', title: 'New Company Fleet Unit' },
        { id: 'driver', label: 'Driver', badge: 'bhf_driver', crKey: 'drivers', title: 'New Driver' }
      ]
    },
    {
      id: 'ops',
      label: '4. Payroll, Logistics & Treasury (8)',
      forms: [
        { id: 'salary', label: 'Salary Payment', badge: 'bhf_salarypayment', crKey: 'salaries', title: 'New Salary Payment' },
        { id: 'attendance', label: 'Attendance', badge: 'bhf_attendance', crKey: 'attendance', title: 'New Staff Attendance' },
        { id: 'freelance', label: 'Freelance Work', badge: 'bhf_freelancework', crKey: 'employments', title: 'New Freelance Work' },
        { id: 'employment', label: 'Employment Contract', badge: 'bhf_employment', crKey: 'employments', title: 'New Employment Contract' },
        { id: 'logistics', label: 'Site Allowance (Mon–Sun)', badge: 'bhf_logistics', crKey: 'logistics_allowances', title: 'New Weekly Site Allowance' },
        { id: 'triprate', label: 'Overtime Trip Rate', badge: 'bhf_triprate', crKey: 'overtime_rates', title: 'New Overtime Trip Rate' },
        { id: 'treasury', label: 'Treasury / Loans / FX', badge: 'bhf_external', crKey: 'loans', title: 'New Treasury Entry' },
        { id: 'jv', label: 'JV Partnership & Dist.', badge: 'bhf_jvdistribution', crKey: 'jv_distributions', title: 'New Joint-Venture Entry' }
      ]
    }
  ];

  const FORM_MAP = {};
  const FORM_TITLES = {};
  const FORM_CR_KEY = {};
  FORM_GROUPS.forEach(g => {
    g.forms.forEach(f => {
      FORM_MAP[f.id] = { ...f, groupId: g.id, groupLabel: g.label };
      FORM_TITLES[f.id] = f.title;
      FORM_CR_KEY[f.id] = f.crKey;
    });
  });

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function round2(n) { return Math.round(Number(n || 0) * 100) / 100; }

  function fmtUsd(n, dec = 2) {
    const v = Number(n || 0);
    const sign = v < 0 ? '−' : '';
    return sign + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }

  function fmtNum(n, dec = 0) {
    const v = Number(n || 0);
    return v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }

  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function nowHHMM() {
    const d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function parseTime(raw) {
    if (raw === null || raw === undefined) return null;
    const s = String(raw).trim().toLowerCase().replace(/\s+/g, '');
    if (!s) return null;
    const m = s.match(/^(\d{1,2})[:.h](\d{1,2})(am|pm|a|p)?$/) ||
              s.match(/^(\d{1,2})(\d{2})(am|pm|a|p)?$/) ||
              s.match(/^(\d{1,2})()(am|pm|a|p)?$/);
    if (!m) return undefined;
    let h = parseInt(m[1], 10);
    const mi = m[2] ? parseInt(m[2], 10) : 0;
    const ap = m[3];
    if (ap) {
      if (h < 1 || h > 12) return undefined;
      if (ap.charAt(0) === 'p' && h < 12) h += 12;
      if (ap.charAt(0) === 'a' && h === 12) h = 0;
    }
    if (h > 23 || mi > 59) return undefined;
    return (h < 10 ? '0' : '') + h + ':' + (mi < 10 ? '0' : '') + mi;
  }

  function isOvertimeTime(hhmm) {
    const p = parseTime(hhmm) || hhmm;
    const m = /^(\d{1,2}):(\d{2})/.exec(String(p || ''));
    if (!m) return false;
    const mins = Number(m[1]) * 60 + Number(m[2]);
    return mins < 6 * 60 || mins > 17 * 60 + 59;
  }

  function getRecords(ctx) {
    return (ctx && ctx.SEED && ctx.SEED.records) ? ctx.SEED.records : (window.MFG_SEED && window.MFG_SEED.records) || {};
  }

  function uniqSorted(arr) {
    return Array.from(new Set((arr || []).map(x => String(x || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }

  // ==================== EMBEDDED EXECUTIVE COCKPIT (bhf_mfgCockpit.htm m283) ====================
  function renderExecutiveCockpit() {
    // Removed from New Entry forms (2026-10-21): neither the Power Apps Executive Cockpit nor the
    // Power Apps form rules banner is needed when creating new entries.
    return '';
  }

  // ==================== DIESEL TANK BALANCE ENGINE (m207 / m212) ====================
  function computeDieselTank(ctx, companyName, excludeId) {
    const seed = (ctx && ctx.SEED) || window.MFG_SEED || {};
    const rec = getRecords(ctx);
    const sn = (((seed.sentinels || {}).fleet_fuel_overtime_auditor || {}).by_model || {})[companyName] || {};
    const coKey = companyName === 'BBConstruction' ? 'bbconstruction' : (companyName === 'Lions Transport' ? 'lionstransport' : 'wtc');
    const model = (seed.models && seed.models[coKey]) || {};
    const allKpi = (model.periods && model.periods.all) || {};

    let bought = sn.diesel_purchased_l != null ? Number(sn.diesel_purchased_l) : Number(allKpi.diesel_purchased || 0);
    let issued = sn.diesel_issued_l != null ? Number(sn.diesel_issued_l) : Number(allKpi.diesel_litres || 0);
    let sold = Number(allKpi.diesel_sold || 0);

    (rec.expenses || []).forEach(e => {
      if (e && e.source === 'app' && !e.voided && e.company === companyName && String(e.subcategory || '').toLowerCase() === 'diesel') {
        bought += Number(e.qty || 0);
      }
    });
    (rec.fuel_intakes || []).forEach(f => {
      if (f && f.source === 'app' && !f.voided && f.company === companyName && f.id !== excludeId && String(f.fuel_type || 'Diesel') === 'Diesel') {
        if (f.record_type === 'Bulk Purchase') bought += Number(f.litres || 0);
        else issued += Number(f.litres || 0);
      }
    });
    (rec.sales_tickets || []).forEach(t => {
      if (t && t.source === 'app' && !t.voided && t.company === companyName && t.id !== excludeId &&
          ['diesel', 'diesel trans'].includes(String(t.product || '').toLowerCase())) {
        sold += Number(t.qty || 0);
      }
    });

    const balance = bought - issued - sold;
    return { bought, issued, sold, balance };
  }

  // ==================== PRICE AGREEMENT & TIER 1/2 ENGINE (m70 / m73 / m103 / m106 / m125 / m136) ====================
  // A tier's Adjustment is a PER-LOAD amount (bhf_total1 = Price × Truck Size 1 + Adjustment 1) that rides into the
  // ticket's Material Total (bhf_price = qty × unit price + adjustment − discount) — the unit price itself never changes.
  function matchTier(rule, truckCap) {
    if (!rule) return { tier: 0, qty: truckCap, adj: 0, transAdj: 0 };
    const q1 = rule.qty1 != null && rule.qty1 !== '' ? Number(rule.qty1) : null;
    const q2 = rule.qty2 != null && rule.qty2 !== '' ? Number(rule.qty2) : null;
    let t = 0;
    if (truckCap != null && truckCap > 0) {
      if (q2 !== null && Math.abs(q2 - truckCap) < 0.01) t = 2;
      else if (q1 !== null && Math.abs(q1 - truckCap) < 0.01) t = 1;
    } else if (q1 !== null) {
      t = 1;
    }
    const adj = t === 2 ? Number(rule.adj2 || 0) : (t === 1 ? Number(rule.adj1 || 0) : 0);
    const transAdj = t === 2 ? Number(rule.trans_adj2 || 0) : (t === 1 ? Number(rule.trans_adj1 || 0) : 0);
    const resolvedQty = (truckCap != null && truckCap > 0) ? truckCap : (t === 2 ? q2 : (t === 1 ? q1 : null));
    return { tier: t, qty: resolvedQty, adj, transAdj };
  }

  // ==================== TRUCK QUICK-VIEW STRIP (qv_truck m99) ====================
  function renderTruckQuickView(truckObj, isCompanyFleet) {
    if (!truckObj) {
      return '';
    }
    const cap = Number(truckObj.capacity || 0);
    return `
      <div class="pa-quickview" id="paTruckQuickView">
        <div class="pa-qv-hdr">
          <span class="pa-qv-tag">LOCKED TRUCK QUICK VIEW · m99</span>
          <b>${esc(truckObj.name)}</b>
        </div>
        <div class="pa-qv-cells">
          <div><small>Plate No</small><b>${esc(truckObj.plate_no || truckObj.name)}</b></div>
          <div><small>Category / Type</small><b>${esc(truckObj.type || 'Truck')}</b></div>
          <div><small>Capacity (m³)</small><b class="${cap > 0 ? 'brass-text' : 'warn-text'}">${cap > 0 ? cap + ' m³ (Auto-Sizes Qty)' : 'Unset (CapLearn Active)'}</b></div>
          <div><small>Owner / Fleet</small><b>${esc(isCompanyFleet ? (truckObj.company || 'Company Fleet') : (truckObj.supplier || '3rd-Party Hauler'))}</b></div>
          <div><small>Default Driver</small><b>${esc(truckObj.default_driver || '—')}</b></div>
        </div>
      </div>
    `;
  }

  // ==================== OPEN-TICKET & 3-LEG AP FIFO SUBGRID PREVIEWS (step240 / step241) ====================
  function renderCustomerOpenTicketsSubgrid(ctx, company, customerName, payAmount, method) {
    const rec = getRecords(ctx);
    const cNorm = norm(customerName);
    if (!cNorm) {
      return `<div class="pa-subgrid-empty">Select a <b>Customer</b> to inspect open Credit Tickets &amp; live FIFO receipt allocation (step240).</div>`;
    }
    const tickets = (rec.sales_tickets || []).filter(t =>
      t && !t.voided && (!company || !t.company || t.company === company) &&
      norm(t.customer) === cNorm && String(t.method || 'Credit') === 'Credit'
    ).slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));

    if (!tickets.length) {
      return `<div class="pa-subgrid-empty">No open Credit Sales Tickets in the current sample for <b>${esc(customerName)}</b> — receipt posts against prior book balance / customer advance.</div>`;
    }

    let pool = Math.max(0, Number(payAmount || 0));
    const vatOnly = method === 'VAT' || method === 'VATRent';
    const rowsHtml = tickets.slice(0, 12).map(t => {
      const due = vatOnly ? Number(t.vat || 0) : Number(t.total_ttc || t.total || 0);
      const alloc = Math.min(pool, Math.max(0, due));
      pool = round2(pool - alloc);
      const rem = round2(Math.max(0, due - alloc));
      const status = rem <= 0.005 && due > 0 ? 'SETTLED' : (alloc > 0 ? 'PARTIAL' : 'OPEN');
      const badgeCls = status === 'SETTLED' ? 'badge-ok' : (status === 'PARTIAL' ? 'badge-warn' : 'badge-info');
      return `
        <tr>
          <td class="mono">${esc(String(t.date || '').slice(0, 10))}</td>
          <td class="mono"><b>#${esc(t.ticket_no || '—')}</b></td>
          <td>${esc(t.product || '—')}</td>
          <td>${esc(t.site || '—')}</td>
          <td class="r">${fmtUsd(due)}</td>
          <td class="r"><b>${alloc > 0 ? fmtUsd(alloc) : '—'}</b></td>
          <td class="r">${fmtUsd(rem)}</td>
          <td><span class="badge ${badgeCls}">${status}</span></td>
        </tr>
      `;
    }).join('');

    return `
      <div class="pa-subgrid">
        <div class="pa-subgrid-hdr">
          <span>OPEN CUSTOMER TICKETS · LIVE FIFO ALLOCATION PREVIEW (step240 · Oldest First)</span>
          <span>${tickets.length} Credit Tickets Found${pool > 0 ? ` · Unallocated Advance: ${fmtUsd(pool)}` : ''}</span>
        </div>
        <div class="table-wrap" style="max-height:190px;overflow:auto">
          <table class="ledger-table">
            <thead>
              <tr><th>Date</th><th>Ticket #</th><th>Product</th><th>Site</th><th class="r">${vatOnly ? 'VAT Due ($)' : 'Ticket TTC ($)'}</th><th class="r">Allocated Now</th><th class="r">Remaining</th><th>Status</th></tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderSupplierOpenLegsSubgrid(ctx, company, supplierName, payAmount, legFilter) {
    const rec = getRecords(ctx);
    const sNorm = norm(supplierName);
    if (!sNorm) {
      return `<div class="pa-subgrid-empty">Select a <b>Supplier / Hauler</b> to inspect open 3-Leg Payables (Material Leg · Haulage Leg · Credit Expense Leg) &amp; live FIFO settlement allocation (step241).</div>`;
    }
    const legs = [];
    if (!legFilter || legFilter === 'all' || legFilter === 'material') {
      (rec.raw_purchases || []).forEach(r => {
        if (r && !r.voided && (!company || !r.company || r.company === company) && norm(r.site_owner) === sNorm && Number(r.cost || 0) > 0) {
          legs.push({ date: r.date, ref: `RAW #${r.ticket_no || '—'}`, leg: 'Leg 1 · Quarry Material', detail: `${r.product || ''} @ ${r.site || ''}`, amount: Number(r.cost || 0) });
        }
      });
    }
    if (!legFilter || legFilter === 'all' || legFilter === 'haulage') {
      (rec.raw_purchases || []).forEach(r => {
        if (r && !r.voided && (!company || !r.company || r.company === company) && norm(r.truck_owner) === sNorm && Number(r.trans_cost || 0) > 0) {
          legs.push({ date: r.date, ref: `RAW #${r.ticket_no || '—'}`, leg: 'Leg 2 · Quarry Haulage', detail: `${r.truck || ''} · ${r.product || ''}`, amount: Number(r.trans_cost || 0) });
        }
      });
      (rec.sales_tickets || []).forEach(t => {
        if (t && !t.voided && (!company || !t.company || t.company === company) && norm(t.truck_owner) === sNorm && Number(t.trans_cost || t.trans_price || 0) > 0) {
          legs.push({ date: t.date, ref: `TKT #${t.ticket_no || '—'}`, leg: 'Leg 2 · Sales Haulage', detail: `${t.customer || ''} @ ${t.site || ''}`, amount: Number(t.trans_cost || t.trans_price || 0) });
        }
      });
    }
    if (!legFilter || legFilter === 'all' || legFilter === 'expense') {
      (rec.expenses || []).forEach(e => {
        if (e && !e.voided && (!company || !e.company || e.company === company) && norm(e.supplier) === sNorm && String(e.method || '') === 'Credit' && Number(e.amount || 0) > 0) {
          legs.push({ date: e.date, ref: e.reference || `EXP ${String(e.date || '').slice(5, 10)}`, leg: 'Leg 3 · Credit Expense', detail: `${e.category || ''} · ${e.subcategory || ''}`, amount: Number(e.amount || 0) });
        }
      });
    }

    legs.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    if (!legs.length) {
      return `<div class="pa-subgrid-empty">No open payable rows in the current sample for <b>${esc(supplierName)}</b> — settlement posts against prior book AP balance / supplier advance.</div>`;
    }

    let pool = Math.max(0, Number(payAmount || 0));
    const rowsHtml = legs.slice(0, 12).map(l => {
      const alloc = Math.min(pool, Math.max(0, l.amount));
      pool = round2(pool - alloc);
      const rem = round2(Math.max(0, l.amount - alloc));
      const status = rem <= 0.005 ? 'SETTLED' : (alloc > 0 ? 'PARTIAL' : 'OPEN');
      const badgeCls = status === 'SETTLED' ? 'badge-ok' : (status === 'PARTIAL' ? 'badge-warn' : 'badge-brass');
      return `
        <tr>
          <td class="mono">${esc(String(l.date || '').slice(0, 10))}</td>
          <td class="mono"><b>${esc(l.ref)}</b></td>
          <td><span class="badge badge-info">${esc(l.leg)}</span></td>
          <td>${esc(l.detail)}</td>
          <td class="r">${fmtUsd(l.amount)}</td>
          <td class="r"><b>${alloc > 0 ? fmtUsd(alloc) : '—'}</b></td>
          <td class="r">${fmtUsd(rem)}</td>
          <td><span class="badge ${badgeCls}">${status}</span></td>
        </tr>
      `;
    }).join('');

    return `
      <div class="pa-subgrid">
        <div class="pa-subgrid-hdr">
          <span>OPEN 3-LEG SUPPLIER PAYABLES · LIVE FIFO ALLOCATION PREVIEW (step241 · m192)</span>
          <span>${legs.length} Payable Legs Found${pool > 0 ? ` · Prepayment / Balance Relief: ${fmtUsd(pool)}` : ''}</span>
        </div>
        <div class="table-wrap" style="max-height:190px;overflow:auto">
          <table class="ledger-table">
            <thead>
              <tr><th>Date</th><th>Voucher</th><th>AP Leg</th><th>Description</th><th class="r">Leg Amount</th><th class="r">Allocated Now</th><th class="r">Remaining</th><th>Status</th></tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ==================== MODAL GROUP & TAB BAR RENDERER ====================
  function renderModalTabsHtml(activeForm, canEnterFn) {
    const info = FORM_MAP[activeForm] || FORM_MAP.sales;
    const activeGroup = FORM_GROUPS.find(g => g.id === info.groupId) || FORM_GROUPS[0];
    return `
      <div class="pa-modal-groups">
        ${FORM_GROUPS.map(g => {
          const visibleForms = g.forms.filter(f => !canEnterFn || canEnterFn(f.id));
          if (!visibleForms.length) return '';
          return `<button type="button" class="pa-group-btn ${g.id === activeGroup.id ? 'active' : ''}" data-pa-group="${esc(g.id)}">${esc(g.label)}</button>`;
        }).join('')}
      </div>
      <div class="pa-modal-subtabs">
        ${activeGroup.forms.filter(f => !canEnterFn || canEnterFn(f.id)).map(f => `
          <button type="button" class="modal-tab ${f.id === activeForm ? 'active' : ''}" data-form="${esc(f.id)}">
            <span>${esc(f.label)}</span>
            <small class="mono">${esc(f.badge)}</small>
          </button>
        `).join('')}
      </div>
    `;
  }

  // ==================== SECONDARY FORMS (GROUPS 2, 3, 4 — 18 FORMS) ====================
  function secHdr(title, sub) {
    return `<div class="pa-form-sec-hdr"><span>${title}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
  }
  function fld(label, inner, opts = {}) {
    const lockAttr = opts.lockField ? ` data-policy-lock="${esc(opts.lockField)}" data-lock-reason="${esc(opts.lockReason || 'Locked by business rule')}"` : '';
    const lockPill = opts.lockField ? `<span class="pa-lock-pill locked" data-lock-pill="${esc(opts.lockField)}" title="${esc(opts.lockReason || 'Locked by policy')}">🔒 LOCKED</span>` : '';
    return `<div class="form-field${opts.span ? ' span-3' : ''}${opts.cls ? ' ' + opts.cls : ''}${opts.lockField ? ' is-policy-locked' : ''}"${opts.id ? ` id="${opts.id}"` : ''}${lockAttr}${opts.hidden ? ' hidden' : ''}><label><span class="pa-fld-lbl">${label}</span>${lockPill}</label>${inner}${opts.hint != null ? `<span class="hint"${opts.hintId ? ` id="${opts.hintId}"` : ''}>${opts.hint}</span>` : ''}</div>`;
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
  function dlMeta(id, items) {
    return `<datalist id="${id}">${items.map(it => {
      const [v, m] = Array.isArray(it) ? it : [it, ''];
      return `<option value="${esc(v)}"${m ? ` data-meta="${esc(m)}"` : ''}>`;
    }).join('')}</datalist>`;
  }

  function renderExtendedFormBody(fType, ctx, helpers) {
    const rec = getRecords(ctx);
    const comps = helpers.allowedCompanyNames();
    const company = helpers.defaultEntryCompany();
    const today = todayISO();
    const companyField = fld('Company (BU) *', sel('f_company', comps, company));
    const uoms = uniqSorted((rec.uoms || []).map(u => u.name).concat(['m³', 'Ton', 'Truck', 'Piece', 'Bag', 'Litre']));
    const prodNames = uniqSorted((rec.products || []).map(p => p.name));
    const prodByName = {};
    (rec.products || []).forEach(p => { if (p && p.name && !prodByName[p.name]) prodByName[p.name] = p; });
    const prodMetaItems = prodNames.map(n => {
      const p = prodByName[n];
      const u = (p && p.uom) || 'm³';
      const tf = p && Number(p.ton_factor) ? Number(p.ton_factor) : 0;
      return [n, u + (tf && tf !== 1 ? ` · ×${tf} t` : '')];
    });
    const custNames = helpers.customerNames();
    const supNames = helpers.supplierNames();
    const siteNames = helpers.siteNames();
    const equipNames = helpers.equipmentNames();
    const driverNames = helpers.driverNames();
    const staffNames = uniqSorted((rec.employments || []).map(e => e.staff || e.name).concat((rec.salaries || []).map(s => s.staff)));
    const roleNames = uniqSorted(['Driver', 'Plant Operator', 'Crusher Operator', 'Loader Operator', 'Mechanic', 'Electrician', 'Weighbridge Clerk', 'Site Supervisor', 'Guard', 'General Labour'].concat((rec.employments || []).map(e => e.role)).concat((rec.freelance_sheets || []).map(f => f.role)));
    const counterpartyNames = uniqSorted(['Bdeir Holding', 'WTC', 'BBConstruction', 'Lions Transport', 'Cash Till 5300', 'Bank Audi', 'Blom Bank'].concat((rec.loans || []).map(l => l.lender || l.counterparty || l.name)).concat((rec.external_movements || []).map(x => x.counterparty || x.name)).concat(supNames));
    const regNames = uniqSorted((rec.regions || []).map(r => r.name).concat(['Beirut', 'Mount Lebanon', 'South', 'Bekaa', 'North', 'Nabatieh']));
    const adminHeaderHtml = `<div id="paAdminLockBar"></div><div id="paAdminUnlockBox" hidden></div>`;

    if (fType === 'pricerule') {
      return `
        <div class="rule-banner" id="smartRuleBanner">
          <strong>Price Agreement Engine (bhf_pricerule · m73 / m103 / m136):</strong> Supports all 6 rule types (<i>Sales Delivery, Sales Pickup, List Price, Purchase Price Site, Transport Price Site, Haulage Customer Site</i>), Tier 1 &amp; Tier 2 truck capacity adjustments, and Indifference Pricing. Irrelevant columns hide automatically based on Rule Type.
        </div>
        ${adminHeaderHtml}
        <div class="form-grid-3">
          ${secHdr('1. Agreement Scope & Counterparty', 'Rule Type dynamically shows Customer, Supplier, or Site')}
          ${companyField}
          ${fld('Rule Type (bhf_ruletype) *', sel('f_ruletype', [
            ['Sales (Delivery)', 'Sales (Delivery) — Customer + Site + Material/Trans'],
            ['Sales (Pickup)', 'Sales (Pickup) — Ex-Quarry Customer Price'],
            ['List Price', 'List Price — Benchmark Product Price'],
            ['Purchase Price (Site)', 'Purchase Price (Site) — Quarry Material Cost'],
            ['Transport Price (Site)', 'Transport Price (Site) — Quarry Haulage Rate'],
            ['Haulage (Customer Site)', 'Haulage (Customer Site) — 3P Delivery Hauler Rate']
          ], 'Sales (Delivery)'))}
          ${fld('Agreement Code / Name', inp('f_name', 'text', '', 'placeholder="Auto-named if blank"'))}
          ${fld('Product / Grade *', inp('f_product', 'text', '', 'list="dl_pr_prods" placeholder="Select or type grade..."') + dlMeta('dl_pr_prods', prodMetaItems))}
          ${fld('Customer (Sales Rules) *', inp('f_customer', 'text', '', 'list="dl_customers" placeholder="Select or type customer..."') + dl('dl_customers', custNames), { id: 'wrap_pr_customer' })}
          ${fld('Supplier / Quarry / Hauler *', inp('f_supplier', 'text', '', 'list="dl_suppliers" placeholder="Select or type supplier..."') + dl('dl_suppliers', supNames), { id: 'wrap_pr_supplier', hidden: true })}
          ${fld('Site / Destination', inp('f_site', 'text', '', 'list="dl_sites" placeholder="Select or type site..."') + dl('dl_sites', siteNames), { id: 'wrap_pr_site' })}
          ${secHdr('2. Unit Pricing & Tier 1 / Tier 2 Truck Sizes', 'Tier 2 unlocks once Tier 1 Truck Size is entered (m71/m73)')}
          ${fld('Priced Per Unit (bhf_unit) *', sel('f_uom', uoms, 'm³'))}
          ${fld('Material Unit Price ($) *', inp('f_unitprice', 'number', '0.00', 'step="0.01" min="0"'), { id: 'wrap_pr_matprice' })}
          ${fld('Transport Rate Per', sel('f_rateper', [['m³', 'Per m³'], ['Ton', 'Per Ton (× Ton Factor)'], ['Truck', 'Flat Per Truck Load']], 'm³'), { id: 'wrap_pr_transrate' })}
          ${fld('Transport Unit Price ($)', inp('f_transunitprice', 'number', '0.00', 'step="0.01" min="0"'), { id: 'wrap_pr_transprice' })}
          ${fld('Indifference Price ($)', inp('f_indiff', 'number', '', 'step="0.01" min="0" placeholder="Optional benchmark"'), { id: 'wrap_pr_indiff' })}
          ${fld('Tier 1 Truck Size (m³)', inp('f_qty1', 'number', '', 'step="0.5" min="0" placeholder="e.g. 14 or 20 m³"'), { id: 'wrap_pr_tier1' })}
          ${fld('Tier 1 Price Adj ($)', inp('f_adj1', 'number', '0.00', 'step="0.01"'), { id: 'wrap_pr_adj1' })}
          ${fld('Tier 1 Trans Adj ($)', inp('f_transadj1', 'number', '0.00', 'step="0.01"'), { id: 'wrap_pr_transadj1' })}
          ${fld('Tier 2 Truck Size (m³)', inp('f_qty2', 'number', '', 'step="0.5" min="0" placeholder="e.g. 22 or 25 m³"'), { id: 'wrap_pr_tier2', hidden: true })}
          ${fld('Tier 2 Price Adj ($)', inp('f_adj2', 'number', '0.00', 'step="0.01"'), { id: 'wrap_pr_adj2', hidden: true })}
          ${fld('Tier 2 Trans Adj ($)', inp('f_transadj2', 'number', '0.00', 'step="0.01"'), { id: 'wrap_pr_transadj2', hidden: true })}
          ${secHdr('3. Validity Window & Notes', 'Active date range')}
          ${fld('Start Date *', inp('f_date', 'date', today))}
          ${fld('End Date', inp('f_enddate', 'date', ''))}
          ${fld('Notes', inp('f_notes', 'text', ''))}
        </div>
        <div class="live-calc">
          <div><small>Base Material + Trans</small><b id="calc_mat">$0.00 / u</b></div>
          <div><small>Tier 1 Total per Load (bhf_total1)</small><b id="calc_tr">—</b></div>
          <div><small>Tier 2 Total per Load (bhf_total2)</small><b id="calc_vat">—</b></div>
          <div><small>Delivered Unit Price Total</small><b id="calc_total">$0.00</b></div>
        </div>
      `;
    }

    if (fType === 'vatinvoice') {
      return `
        <div class="rule-banner"><strong>Official VAT Invoice Header (bhf_vatinvoice):</strong> Links statutory 11% VAT invoices to customer sales tickets and tracks Net HT, 11% VAT, and Total TTC.</div>
        ${adminHeaderHtml}
        <div class="form-grid-3">
          ${companyField}
          ${fld('Invoice Serial No. *', inp('f_ticketno', 'text', '', 'placeholder="e.g. VAT-2026-0412"'))}
          ${fld('Invoice Date *', inp('f_date', 'date', today), { hintId: 'hint_date', hint: '' })}
          ${fld('Reporting Date *', inp('f_repdate', 'date', today), { hintId: 'hint_repdate', hint: 'Auto-follows Invoice Date (m66)' })}
          ${fld('Customer *', inp('f_customer', 'text', '', 'list="dl_customers" placeholder="Select or type customer..."') + dl('dl_customers', custNames))}
          ${fld('Net Amount Ex-VAT ($) *', inp('f_amount', 'number', '', 'step="0.01" min="0"'))}
          ${fld('VAT 11% ($)', inp('f_vat', 'number', '', 'step="0.01" min="0" readonly'), { id: 'wrap_f_vat', lockField: 'f_vat', lockReason: 'Locked to 11% Statutory Tax formula (Net HT × 11%)' })}
          ${fld('Payment Status', sel('f_status', [['Open', 'Open'], ['Settled', 'Settled'], ['Partial', 'Partial']], 'Open'))}
          ${fld('Notes', inp('f_notes', 'text', ''))}
        </div>
        <div class="live-calc">
          <div><small>Net HT</small><b id="calc_mat">$0.00</b></div>
          <div><small>11% VAT</small><b id="calc_vat">$0.00</b></div>
          <div><small>Total TTC</small><b id="calc_total">$0.00</b></div>
          <div><small>Posting</small><b>Dr 4111 · Cr 4427</b></div>
        </div>
      `;
    }

    if (fType === 'creditterm') {
      return `
        <div class="rule-banner"><strong>Customer Credit Terms (bhf_creditterm):</strong> Sets the agreed payment window (days), credit limit ($), and grace period for AR aging &amp; DSO alerts.</div>
        <div class="form-grid-3">
          ${companyField}
          ${fld('Customer *', inp('f_customer', 'text', '', 'list="dl_customers" placeholder="Select or type customer..."') + dl('dl_customers', custNames))}
          ${fld('Effective Date *', inp('f_date', 'date', today))}
          ${fld('Payment Days (Net Days) *', inp('f_days', 'number', '30', 'step="1" min="0"'))}
          ${fld('Credit Limit ($)', inp('f_amount', 'number', '25000', 'step="100" min="0"'))}
          ${fld('Notes', inp('f_notes', 'text', ''))}
        </div>
      `;
    }

    if (fType === 'customer') {
      return `
        <div class="rule-banner"><strong>Customer Master Record (bhf_customer · m50 / m58 / m60):</strong> Controls whether Sales Tickets lock to <b>Cash</b> or <b>Credit</b>, whether 11% VAT applies, and whether <i>Customer-declared Qty</i> or <i>External Invoice</i> fields appear on tickets.</div>
        <div class="form-grid-3">
          ${companyField}
          ${fld('Customer Name *', inp('f_customer', 'text', '', 'placeholder="Full legal / trade name"'))}
          ${fld('Default Payment Method (Locks Tickets) *', sel('f_method', [['Credit', 'Credit (4111 AR)'], ['Cash', 'Cash (5300 Till)']], 'Credit'))}
          ${fld('VAT Registered (11%)', sel('f_vatreg', [['No', 'No'], ['Yes', 'Yes — 11% VAT Applies']], 'No'))}
          ${fld('MOF Tax Number', inp('f_mof', 'text', '', 'placeholder="Ministry of Finance # "'), { id: 'wrap_cust_mof', hidden: true })}
          ${fld('Phone / Contact', inp('f_phone', 'text', '', 'placeholder="+961 ..."'))}
          ${fld('Region / Address', inp('f_region', 'text', '', 'list="dl_regions" placeholder="Select or type region..."') + dl('dl_regions', regNames))}
          <div class="form-field check-field"><input type="checkbox" id="f_declqty"><label for="f_declqty">Uses Customer-declared Qty on tickets (m60)</label></div>
          <div class="form-field check-field"><input type="checkbox" id="f_extinv"><label for="f_extinv">Requires External Invoice # on tickets (m60)</label></div>
          ${fld('Notes', inp('f_notes', 'text', ''), { span: true })}
        </div>
      `;
    }

    if (fType === 'supplier') {
      return `
        <div class="rule-banner"><strong>Supplier / Quarry / Hauler Master (bhf_supplier · m125):</strong> Flagging <b>Is Truck Owner</b> adds this supplier to the cascading <i>Truck Owner</i> picker on Sales &amp; Raw Tickets; flagging <b>IVA Registered</b> enables 11% input VAT.</div>
        <div class="form-grid-3">
          ${companyField}
          ${fld('Supplier / Hauler Name *', inp('f_supplier', 'text', '', 'placeholder="Quarry, hauler, or vendor name"'))}
          ${fld('Category', sel('f_category', [['Quarry / Raw Material', 'Quarry / Raw Material'], ['Hauler / Truck Owner', 'Hauler / Truck Owner'], ['Fuel & Lubricants', 'Fuel & Lubricants'], ['Spare Parts & Garage', 'Spare Parts & Garage'], ['General Vendor', 'General Vendor']], 'Hauler / Truck Owner'))}
          ${fld('Phone / Contact', inp('f_phone', 'text', ''))}
          ${fld('MOF Tax Number', inp('f_mof', 'text', ''))}
          <div class="form-field check-field"><input type="checkbox" id="f_istruckowner" checked><label for="f_istruckowner">Is Truck Owner (appears in Hauler cascade)</label></div>
          <div class="form-field check-field"><input type="checkbox" id="f_iva"><label for="f_iva">IVA / VAT Registered (11% Input VAT)</label></div>
          ${fld('Notes', inp('f_notes', 'text', ''), { span: true })}
        </div>
      `;
    }

    if (fType === 'product') {
      return `
        <div class="rule-banner"><strong>Product &amp; Aggregate Grade Master (bhf_product · m110):</strong> Configures default UoM, Ton conversion factor (m³ → Ton), and whether the item appears on Weighbridge Tickets or Fuel/Lubricant Intakes.</div>
        <div class="form-grid-3">
          ${companyField}
          ${fld('Product / Grade Name *', inp('f_product', 'text', '', 'placeholder="e.g. Sand 0-4mm, Gravel 10-20mm"'))}
          ${fld('Default Unit (UoM) *', sel('f_uom', uoms, 'm³'))}
          ${fld('Product Type *', sel('f_prodtype', [['Material', 'Material (Aggregate / Concrete / Block)'], ['Fuel', 'Fuel (Diesel)'], ['Lubricant', 'Lubricant / Oil'], ['Service', 'Service / Transport'], ['Part', 'Spare Part']], 'Material'))}
          ${fld('Ton Conversion Factor (1 m³ = X Tons)', inp('f_tonfactor', 'number', '1.50', 'step="0.01" min="0.1"'))}
          ${fld('Standard List Price ($)', inp('f_unitprice', 'number', '', 'step="0.01" min="0"'))}
          <div class="form-field check-field"><input type="checkbox" id="f_ticketprod" checked><label for="f_ticketprod">Ticket Product (show on Sales/Raw tickets m110)</label></div>
          <div class="form-field check-field"><input type="checkbox" id="f_fuelitem"><label for="f_fuelitem">Fuel / Lubricant Item (show on Fuel Intake m91)</label></div>
          <div class="form-field check-field"><input type="checkbox" id="f_inputprod"><label for="f_inputprod">Quarry Input Material</label></div>
        </div>
      `;
    }

    if (fType === 'site') {
      return `
        <div class="rule-banner"><strong>Site, Quarry &amp; Destination Master (bhf_site · m84 / m125):</strong> Setting <b>Default Quarry / Site Owner</b> automatically fills both <i>Site Owner</i> and <i>Truck Owner</i> when this site is selected on a Raw Material Ticket!</div>
        <div class="form-grid-3">
          ${companyField}
          ${fld('Site / Quarry Name *', inp('f_site', 'text', '', 'placeholder="Site or quarry name"'))}
          ${fld('Region *', inp('f_region', 'text', '', 'list="dl_regions" placeholder="Select or type region..."') + dl('dl_regions', regNames))}
          ${fld('Default Quarry / Site Owner (Supplier)', inp('f_supplier', 'text', '', 'list="dl_suppliers" placeholder="Select or type supplier (auto-fills Raw Tickets)..."') + dl('dl_suppliers', supNames))}
          ${fld('Associated Customer (if Delivery Site)', inp('f_customer', 'text', '', 'list="dl_customers" placeholder="Select or type customer..."') + dl('dl_customers', custNames))}
          ${fld('Latitude (GPS)', inp('f_lat', 'number', '', 'step="0.000001" placeholder="33.8938"'))}
          ${fld('Longitude (GPS)', inp('f_lng', 'number', '', 'step="0.000001" placeholder="35.5018"'))}
          <div class="form-field check-field"><input type="checkbox" id="f_isjv"><label for="f_isjv">Joint-Venture (JV) Quarry Site</label></div>
          ${fld('Notes', inp('f_notes', 'text', ''), { span: true })}
        </div>
      `;
    }

    if (fType === 'equipment' || fType === 'companyequipment') {
      const isCo = fType === 'companyequipment';
      return `
        <div class="rule-banner"><strong>${isCo ? 'Company Fleet Unit (bhf_companyequipment)' : 'Universal / Third-Party Equipment (bhf_equipment)'} · m99 / m125:</strong> Sets the locked <b>Capacity (m³)</b> and <b>Default Driver</b> shown in the Truck Quick-View strip on tickets.</div>
        <div class="form-grid-3">
          ${companyField}
          ${fld('Unit Code / Plate Identifier *', inp('f_truck', 'text', '', 'placeholder="e.g. B-123456 or SHACMAN-04"'))}
          ${fld('License Plate No.', inp('f_plateno', 'text', '', 'placeholder="Plate number"'))}
          ${fld('Equipment Category *', sel('f_category', [['Truck', 'Dump Truck / Tipper'], ['Mixer', 'Transit Mixer'], ['Loader', 'Wheel Loader'], ['Excavator', 'Excavator'], ['Bulldozer', 'Bulldozer'], ['Generator', 'Generator / Crusher'], ['Service Vehicle', 'Pickup / Service Vehicle']], 'Truck'))}
          ${fld('Capacity (m³) *', inp('f_capacity', 'number', '18', 'step="0.5" min="0"'), { id: 'wrap_eq_capacity' })}
          ${fld('Ownership *', sel('f_ownership', isCo ? [['Owned', 'Company Owned Fleet'], ['Rented', 'Long-Term Rented']] : [['Subcontractor', 'Third-Party Hauler / Subcontractor'], ['Owned', 'Company Owned Fleet'], ['Customer', 'Customer Truck']], isCo ? 'Owned' : 'Subcontractor'))}
          ${fld('Truck Owner (Supplier / Hauler)', inp('f_supplier', 'text', isCo ? company : '', 'list="dl_suppliers" placeholder="Select or type truck owner..."') + dl('dl_suppliers', supNames), { id: 'wrap_eq_supplier', hidden: isCo })}
          ${fld('Default Driver', inp('f_driver', 'text', '', 'list="dl_drivers" placeholder="Select or type driver..."') + dl('dl_drivers', driverNames))}
          ${fld('Model / Make', inp('f_model', 'text', '', 'placeholder="Mercedes / Volvo / Shacman / CAT"'))}
        </div>
      `;
    }

    if (fType === 'driver') {
      return `
        <div class="rule-banner"><strong>Driver Master Record (bhf_driver · m126b / m131):</strong> Links drivers to their <b>Truck Owner</b> (for third-party haulers) or marks them as <b>Company Fleet Drivers</b>.</div>
        <div class="form-grid-3">
          ${companyField}
          ${fld('Driver Full Name *', inp('f_driver', 'text', '', 'placeholder="Driver name"'))}
          <div class="form-field check-field"><input type="checkbox" id="f_iscompanydriver"><label for="f_iscompanydriver">Company Fleet Driver (on BU payroll)</label></div>
          ${fld('Truck Owner (Hauler Supplier)', inp('f_supplier', 'text', '', 'list="dl_suppliers" placeholder="Select or type hauler (leave blank if Company Driver)..."') + dl('dl_suppliers', supNames), { id: 'wrap_drv_supplier' })}
          ${fld('Default Truck Plate', inp('f_truck', 'text', '', 'list="dl_equip" placeholder="Select or type truck plate..."') + dl('dl_equip', equipNames))}
          ${fld('Phone Number', inp('f_phone', 'text', '', 'placeholder="+961 ..."'))}
          ${fld('Notes', inp('f_notes', 'text', ''), { span: true })}
        </div>
      `;
    }

    if (fType === 'salary') {
      return `
        <div class="rule-banner"><strong>Salary Payment (bhf_salarypayment · Dual-Currency):</strong> Posts staff payroll with USD + LBP dual-currency conversion and optional equipment cost-centre allocation.</div>
        ${adminHeaderHtml}
        <div class="form-grid-3">
          ${companyField}
          ${fld('Payment Date *', inp('f_date', 'date', today), { hintId: 'hint_date', hint: '' })}
          ${fld('Reporting Date *', inp('f_repdate', 'date', today), { hintId: 'hint_repdate', hint: 'Auto-follows Payment Date (m66)' })}
          ${fld('Payroll Month *', inp('f_paymonth', 'month', today.slice(0, 7)))}
          ${fld('Staff / Driver Name *', inp('f_staff', 'text', '', 'list="dl_staff" placeholder="Select or type staff member..."') + dl('dl_staff', staffNames))}
          ${fld('Allocated Equipment (if Driver)', inp('f_truck', 'text', '', 'list="dl_equip" placeholder="Select or type equipment..."') + dl('dl_equip', equipNames))}
          ${fld('Payment Method *', sel('f_method', [['Cash', 'Cash (Cr 5300 Till)'], ['Bank', 'Bank Transfer']], 'Cash'))}
          ${fld('USD Amount ($)', inp('f_usd', 'number', '', 'step="0.01" min="0" placeholder="0.00"'))}
          ${fld('LBP Amount (L.L.)', inp('f_lbp', 'number', '', 'step="1000" min="0" placeholder="0"'))}
          ${fld('Total USD Value (90k FX) *', inp('f_amount', 'number', '', 'step="0.01" readonly class="pa-locked-input"'), { id: 'wrap_f_amount', lockField: 'f_amount', lockReason: 'Locked to Dual-Currency FX formula (USD + LBP ÷ 90,000 · bhf_usdPreview.js)' })}
          ${fld('Notes', inp('f_notes', 'text', ''), { span: true })}
        </div>
      `;
    }

    if (fType === 'attendance') {
      return `
        <div class="rule-banner"><strong>Staff Attendance &amp; Shift Log (bhf_attendance):</strong> Tracks daily presence, absence, overtime hours, and site assignment.</div>
        <div class="form-grid-3">
          ${companyField}
          ${fld('Attendance Date *', inp('f_date', 'date', today))}
          ${fld('Staff Member *', inp('f_staff', 'text', '', 'list="dl_staff" placeholder="Select or type staff member..."') + dl('dl_staff', staffNames))}
          ${fld('Status *', sel('f_status', [['Present', 'Present (Full Day)'], ['Half Day', 'Half Day'], ['Absent', 'Absent'], ['Paid Leave', 'Paid Leave'], ['Holiday', 'Public Holiday']], 'Present'))}
          ${fld('Site Assignment', inp('f_site', 'text', '', 'list="dl_sites" placeholder="Select or type site..."') + dl('dl_sites', siteNames))}
          ${fld('Overtime Hours', inp('f_hours', 'number', '0', 'step="0.5" min="0"'))}
          ${fld('Notes', inp('f_notes', 'text', ''), { span: true })}
        </div>
      `;
    }

    if (fType === 'freelance' || fType === 'employment') {
      const isContract = fType === 'employment';
      return `
        <div class="rule-banner"><strong>${isContract ? 'Employment Contract (bhf_employment)' : 'Freelance Work &amp; Day-Rate Entry (bhf_freelancework)'}:</strong> ${isContract ? 'Defines base salary and role so Sentinel S7 can audit salary payments against active contracts.' : 'Logs external/casual day-labour work and payment.'}</div>
        <div class="form-grid-3">
          ${companyField}
          ${fld('Staff / Worker Name *', inp('f_staff', 'text', '', 'list="dl_staff" placeholder="Select or type staff / worker..."') + dl('dl_staff', staffNames))}
          ${fld(isContract ? 'Start Date *' : 'Work Date *', inp('f_date', 'date', today))}
          ${fld('Role / Trade *', inp('f_role', 'text', '', 'list="dl_roles" placeholder="Select or type role / trade..."') + dl('dl_roles', roleNames))}
          ${fld('Pay Basis', sel('f_paytype', isContract ? [['Monthly', 'Monthly Salary'], ['Daily', 'Daily Wage']] : [['Daily', 'Daily Freelance Rate'], ['Lump Sum', 'Task Lump Sum']], isContract ? 'Monthly' : 'Daily'))}
          ${fld(isContract ? 'Agreed Base Salary ($) *' : 'Amount ($) *', inp('f_amount', 'number', '', 'step="0.01" min="0"'))}
          ${fld('Assigned Equipment / Site', inp('f_truck', 'text', '', 'list="dl_equip" placeholder="Select or type equipment..."') + dl('dl_equip', equipNames))}
          ${fld('Notes', inp('f_notes', 'text', ''), { span: true })}
        </div>
      `;
    }

    if (fType === 'logistics') {
      return `
        <div class="rule-banner"><strong>Weekly Site Allowance (bhf_logistics):</strong> Marks Mon–Sun active days and computes the dual-currency weekly allowance (USD + LBP ÷ 90,000).</div>
        ${adminHeaderHtml}
        <div class="form-grid-3">
          ${companyField}
          ${fld('Week Ending Date *', inp('f_date', 'date', today), { hintId: 'hint_date', hint: '' })}
          ${fld('Reporting Date *', inp('f_repdate', 'date', today), { hintId: 'hint_repdate', hint: 'Auto-follows Week Ending Date (m66)' })}
          ${fld('Staff / Driver *', inp('f_staff', 'text', '', 'list="dl_staff" placeholder="Select or type staff / driver..."') + dl('dl_staff', staffNames))}
          ${fld('Site', inp('f_site', 'text', '', 'list="dl_sites" placeholder="Select or type site..."') + dl('dl_sites', siteNames))}
          ${fld('USD Allowance ($)', inp('f_usd', 'number', '', 'step="0.01" min="0"'))}
          ${fld('LBP Allowance (L.L.)', inp('f_lbp', 'number', '', 'step="1000" min="0"'))}
          ${fld('Total USD Value *', inp('f_amount', 'number', '', 'step="0.01" readonly class="pa-locked-input"'), { id: 'wrap_f_amount', lockField: 'f_amount', lockReason: 'Locked to Dual-Currency FX formula (USD + LBP ÷ 90,000 · bhf_usdPreview.js)' })}
          <div class="form-field span-3" style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;padding-top:4px">
            <strong style="font-size:12px">Days Worked:</strong>
            ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => `<label style="display:inline-flex;align-items:center;gap:4px;font-size:12px"><input type="checkbox" id="f_day_${d.toLowerCase()}" ${i < 6 ? 'checked' : ''}> ${d}</label>`).join('')}
          </div>
          ${fld('Notes', inp('f_notes', 'text', ''), { span: true })}
        </div>
      `;
    }

    if (fType === 'triprate') {
      return `
        <div class="rule-banner"><strong>Driver Overtime &amp; Per-Trip Allowance Rate (bhf_triprate · m48 / m93):</strong> Sets the per-trip bonus earned on company-fleet loads dispatched outside the 06:00–17:59 day shift.</div>
        <div class="form-grid-3">
          ${companyField}
          ${fld('Route / Rate Name *', inp('f_name', 'text', '', 'placeholder="e.g. WTC Quarry → Beirut Night Trip"'))}
          ${fld('Site / Destination *', inp('f_site', 'text', '', 'list="dl_sites" placeholder="Select or type destination site..."') + dl('dl_sites', siteNames))}
          ${fld('Equipment Category', sel('f_category', [['Truck', 'Dump Truck'], ['Mixer', 'Mixer'], ['All', 'All Fleet Units']], 'Truck'))}
          ${fld('Overtime Bonus per Trip ($) *', inp('f_amount', 'number', '10.00', 'step="0.50" min="0"'))}
          ${fld('Effective From *', inp('f_date', 'date', today))}
          ${fld('Notes', inp('f_notes', 'text', ''), { span: true })}
        </div>
      `;
    }

    if (fType === 'treasury') {
      return `
        <div class="rule-banner"><strong>Treasury, Partner Loans &amp; Currency Conversion Desk (bhf_external / bhf_loan / bhf_conversion):</strong> Logs partner/intercompany cash movements, loan drawdowns/settlements, and LBP ↔ USD till conversions.</div>
        ${adminHeaderHtml}
        <div class="form-grid-3">
          ${companyField}
          ${fld('Treasury Entry Type *', sel('f_trtype', [
            ['loan', 'Partner / Intercompany Loan Drawdown (bhf_loan)'],
            ['loan_settlement', 'Loan Repayment / Settlement (bhf_loansettlement)'],
            ['external', 'External Cash Inflow / Outflow (bhf_external)'],
            ['conversion', 'Currency Conversion USD ↔ LBP (bhf_conversion)']
          ], 'loan'))}
          ${fld('Transaction Date *', inp('f_date', 'date', today), { hintId: 'hint_date', hint: '' })}
          ${fld('Reporting Date *', inp('f_repdate', 'date', today), { hintId: 'hint_repdate', hint: 'Auto-follows Transaction Date (m66)' })}
          ${fld('Counterparty / Partner / Account *', inp('f_counterparty', 'text', '', 'list="dl_counterparties" placeholder="Select or type partner, bank, or entity..."') + dl('dl_counterparties', counterpartyNames))}
          ${fld('Direction / Leg *', sel('f_direction', [['Inflow', 'Cash Inflow / Borrowed (Dr 5300 Till)'], ['Outflow', 'Cash Outflow / Repaid (Cr 5300 Till)']], 'Inflow'))}
          ${fld('USD Amount ($)', inp('f_usd', 'number', '', 'step="0.01" min="0"'))}
          ${fld('LBP Amount (L.L.)', inp('f_lbp', 'number', '', 'step="1000" min="0"'))}
          ${fld('Total USD Value *', inp('f_amount', 'number', '', 'step="0.01" readonly class="pa-locked-input"'), { id: 'wrap_f_amount', lockField: 'f_amount', lockReason: 'Locked to Dual-Currency FX formula (USD + LBP ÷ 90,000 · bhf_usdPreview.js)' })}
          ${fld('Reference / Voucher', inp('f_reference', 'text', ''))}
          ${fld('Notes', inp('f_notes', 'text', ''), { span: true })}
        </div>
      `;
    }

    // jv
    return `
      <div class="rule-banner"><strong>Joint-Venture (JV) Quarry Partnership &amp; Distribution (bhf_jvpartnership / bhf_jvdistribution):</strong> Records JV quarry profit-share distributions or partner capital movements.</div>
      <div class="form-grid-3">
        ${companyField}
        ${fld('JV Entry Type *', sel('f_jvtype', [['distribution', 'JV Profit / Cash Distribution'], ['partnership', 'New JV Quarry Partnership Setup']], 'distribution'))}
        ${fld('Transaction Date *', inp('f_date', 'date', today), { hintId: 'hint_date', hint: '' })}
        ${fld('Reporting Date *', inp('f_repdate', 'date', today), { hintId: 'hint_repdate', hint: 'Auto-follows Transaction Date (m66)' })}
        ${fld('JV Site *', inp('f_site', 'text', '', 'list="dl_sites" placeholder="Select or type JV site..."') + dl('dl_sites', siteNames))}
        ${fld('JV Partner *', inp('f_counterparty', 'text', '', 'list="dl_suppliers" placeholder="Select or type JV partner..."') + dl('dl_suppliers', supNames))}
        ${fld('Partner Share (%)', inp('f_share', 'number', '50', 'step="0.5" min="0" max="100"'), { id: 'wrap_jv_share', hidden: true })}
        ${fld('Distribution Amount ($) *', inp('f_amount', 'number', '', 'step="0.01" min="0"'), { id: 'wrap_jv_amount' })}
        ${fld('Notes', inp('f_notes', 'text', ''), { span: true })}
      </div>
    `;
  }

  // ==================== PUBLIC API MOUNT ====================
  window.MFG_FORMS = {
    FX_RATE,
    VAT_RATE,
    MIN_DATE,
    FORM_GROUPS,
    FORM_MAP,
    FORM_TITLES,
    FORM_CR_KEY,
    parseTime,
    isOvertimeTime,
    renderExecutiveCockpit,
    computeDieselTank,
    matchTier,
    renderTruckQuickView,
    renderCustomerOpenTicketsSubgrid,
    renderSupplierOpenLegsSubgrid,
    renderModalTabsHtml,
    renderExtendedFormBody
  };
})();
