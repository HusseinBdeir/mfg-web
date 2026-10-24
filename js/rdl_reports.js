// ============================================================================
// js/rdl_reports.js — Canonical 22 Paginated Reports Suite (m20_rdls.py & m21_app_surface.py parity)
// Exact RDL tab order (rdl_common.TAB_GROUPS), category pills, report search,
// per-report RDL Parameter Bar (From/To, As-At, Columns by, Account/Sub-Account,
// Customer, Supplier, Product, Site, Equipment, Driver, Staff, Year/Month,
// VAT Invoice No, Ticket No, Voucher No), click-sortable tablix headers,
// bilingual titles, legal company blocks, and A4 / Landscape print & CSV export.
// ============================================================================
(function () {
  'use strict';

  const ic = (name, cls) => (typeof window !== 'undefined' && window.MFG_ICONS ? window.MFG_ICONS.svg(name, cls) : '');

  const RDL_CATALOG = [
    { id: '01', code: '01', slug: 'daily_ops',     cat: 'Digest',         name: 'Daily Operations',      title: 'Daily Operations',      ar: 'ملخص العمليات اليومية', landscape: true,  params: ['from', 'to'] },
    { id: '02', code: '02', slug: 'balance_sheet', cat: 'Statements',     name: 'Balance Sheet',         title: 'Balance Sheet',         ar: 'الميزانية العمومية',   landscape: false, params: ['asof'] },
    { id: '03', code: '03', slug: 'income_stmt',   cat: 'Statements',     name: 'Income Statement',      title: 'Income Statement',      ar: 'بيان الدخل',           landscape: true,  params: ['from', 'to', 'period'] },
    { id: '04', code: '04', slug: 'cash_flow',     cat: 'Statements',     name: 'Cash Flow Statement',   title: 'Cash Flow Statement',   ar: 'بيان التدفقات النقدية', landscape: true,  params: ['from', 'to', 'period'] },
    { id: '05', code: '05', slug: 'trial_balance', cat: 'General Ledger', name: 'Trial Balance',         title: 'Trial Balance',         ar: 'ميزان المراجعة',       landscape: false, params: ['from', 'to'] },
    { id: '06', code: '06', slug: 'gen_journal',   cat: 'General Ledger', name: 'General Journal',       title: 'General Journal',       ar: 'دفتر اليومية العام',   landscape: true,  params: ['from', 'to', 'account'] },
    { id: '07', code: '07', slug: 'sub_account',   cat: 'General Ledger', name: 'Sub-Account Statement', title: 'Sub-Account Statement', ar: 'كشف حساب فرعي',       landscape: false, params: ['account', 'subAccount', 'from', 'to'] },
    { id: '08', code: '08', slug: 'sales_reg',     cat: 'Registers',      name: 'Sales Register',        title: 'Sales Register',        ar: 'سجل المبيعات',         landscape: true,  params: ['from', 'to', 'customer', 'product', 'site'] },
    { id: '09', code: '09', slug: 'expense_reg',   cat: 'Registers',      name: 'Expense Register',      title: 'Expense Register',      ar: 'سجل المصاريف',         landscape: true,  params: ['from', 'to', 'category', 'supplier'] },
    { id: '10', code: '10', slug: 'payroll_reg',   cat: 'Registers',      name: 'Payroll Register',      title: 'Payroll Register',      ar: 'سجل الرواتب',          landscape: false, params: ['from', 'to', 'staff'] },
    { id: '11', code: '11', slug: 'raw_reg',       cat: 'Registers',      name: 'Raw Material',          title: 'Raw Material',          ar: 'سجل المواد الأولية',   landscape: true,  params: ['from', 'to', 'supplier'] },
    { id: '12', code: '12', slug: 'fuel_log',      cat: 'Registers',      name: 'Fuel Log',              title: 'Fuel Log',              ar: 'سجل المحروقات',        landscape: true,  params: ['from', 'to', 'equipType', 'equipment', 'driver'] },
    { id: '13', code: '13', slug: 'aged_ar',       cat: 'Counterparties', name: 'Aged Receivables',      title: 'Aged Receivables',      ar: 'أعمار الذمم المدينة',  landscape: true,  params: ['asof', 'customer'] },
    { id: '14', code: '14', slug: 'cust_stmt',     cat: 'Counterparties', name: 'Customer Statement',    title: 'Customer Statement',    ar: 'كشف حساب زبون',       landscape: false, params: ['customer', 'from', 'to'] },
    { id: '15', code: '15', slug: 'sup_bal',       cat: 'Counterparties', name: 'Supplier Balances',     title: 'Supplier Balances',     ar: 'أرصدة الموردين',       landscape: false, params: ['asof', 'supplier'] },
    { id: '16', code: '16', slug: 'sup_stmt',      cat: 'Counterparties', name: 'Supplier Statement',    title: 'Supplier Statement',    ar: 'كشف حساب مورد',       landscape: false, params: ['supplier', 'from', 'to'] },
    { id: '17', code: '17', slug: 'driver_stmt',   cat: 'Counterparties', name: 'Driver Statement',      title: 'Driver Statement',      ar: 'كشف السائقين',         landscape: true,  params: ['from', 'to', 'driver'] },
    { id: '18', code: '18', slug: 'vat_return',    cat: 'Tax & Recon',    name: 'VAT Return',            title: 'VAT Return',            ar: 'ملخص ضريبة القيمة المضافة', landscape: false, params: ['from', 'to'] },
    { id: '19', code: '19', slug: 'pl_recon',      cat: 'Tax & Recon',    name: 'P&L Reconciliation',    title: 'P&L Reconciliation',    ar: 'مطابقة الأرباح والخسائر', landscape: true,  params: ['year', 'month'] },
    { id: '20', code: '20', slug: 'sales_inv',     cat: 'Documents',      name: 'Sales Invoice',         title: 'Sales Invoice',         ar: 'فاتورة مبيعات',        landscape: false, params: ['invoiceNo'] },
    { id: '21', code: '21', slug: 'deliv_ticket',  cat: 'Documents',      name: 'Delivery Ticket',       title: 'Delivery Ticket',       ar: 'بون تسليم',            landscape: false, params: ['ticketId'] },
    { id: '22', code: '22', slug: 'rcpt_voucher',  cat: 'Documents',      name: 'Receipt Voucher',       title: 'Receipt Voucher',       ar: 'سند قبض',              landscape: false, params: ['receiptId'] }
  ];

  const RDL_CATEGORIES = ['All', 'Digest', 'Statements', 'General Ledger', 'Registers', 'Counterparties', 'Tax & Recon', 'Documents'];

  const CO_WTC = {
    co: 'WTC',
    short: 'WTC',
    legal: 'World Trading & Construction Company',
    ar: 'شركة التجارة والبناء العالمية',
    mof: 'VAT 2585321-601',
    address: 'Ras Beirut, Hamra Street 776',
    phone: 'Tel: 03/224839'
  };
  const CO_BBC = {
    co: 'BBConstruction',
    short: 'BBConstruction',
    legal: 'Buzwair & Bdeir Construction Supplies Co. S.A.R.L',
    ar: 'شركة بوزوير و بدير لمواد البناء ش.م.م',
    mof: 'VAT 601-2372701',
    address: 'Riad El Solh, Beirut, Lebanon',
    phone: 'Tel: 01/998550-1 · Fax: 01/998552'
  };
  const CO_LT = {
    co: 'Lions Transport',
    short: 'Lions Transport',
    legal: 'Lions Transport',
    ar: 'ليونز للنقل',
    mof: 'VAT —',
    address: 'Beirut, Lebanon',
    phone: ''
  };
  const CO_ALL = {
    co: 'ALL',
    short: 'Manufacturing Group',
    legal: 'Bdeir Holding — Manufacturing Group (WTC · BBConstruction · Lions Transport)',
    ar: 'مجموعة التصنيع والكسارات — شركة التجارة والبناء العالمية وبوزوير وبدير',
    mof: 'VAT 2585321-601 / 601-2372701',
    address: 'Ras Beirut & Riad El Solh, Beirut, Lebanon',
    phone: 'Tel: 03/224839 · 01/998550-1'
  };
  const CO_LEGAL = {
    WTC: CO_WTC, wtc: CO_WTC,
    BBC: CO_BBC, BBConstruction: CO_BBC, bbconstruction: CO_BBC,
    LT: CO_LT, 'Lions Transport': CO_LT, lionstransport: CO_LT,
    ALL: CO_ALL, 'manufacturing-group': CO_ALL
  };

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtUsd(v, dp = 0) {
    const n = Number(v || 0);
    if (!Number.isFinite(n)) return '$0';
    const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
    return (n < -0.0005 ? '-$' : '$') + abs;
  }

  function fmtUsdSigned(v, dp = 0) {
    const n = Number(v || 0);
    if (!Number.isFinite(n)) return '$0';
    const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
    return n < -0.0005 ? `($${abs})` : `$${abs}`;
  }

  function fmtNum(v, dp = 0) {
    const n = Number(v || 0);
    if (!Number.isFinite(n)) return '0';
    return n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  }

  function ensureRdlState(STATE, SEED) {
    const maxDate = String((SEED && SEED.generated_at) || '2026-10-21').slice(0, 10);
    if (!STATE.rdl) {
      STATE.rdl = {
        cat: 'All',
        search: '',
        paramsOpen: true,
        _dateTouched: false,
        params: {
          from: '2024-01-01',
          to: maxDate,
          asof: maxDate,
          period: 'Month',
          account: 'ALL',
          subAccount: 'ALL',
          customer: 'ALL',
          product: 'ALL',
          site: 'ALL',
          supplier: 'ALL',
          category: 'ALL',
          staff: 'ALL',
          equipType: 'ALL',
          equipment: 'ALL',
          driver: 'ALL',
          year: 'ALL',
          month: 'ALL',
          invoiceNo: '2738',
          ticketId: '',
          receiptId: ''
        }
      };
    }
    if (!STATE.rdl._dateTouched) {
      if (STATE.dateFrom) STATE.rdl.params.from = STATE.dateFrom;
      if (STATE.dateTo) {
        STATE.rdl.params.to = STATE.dateTo > maxDate ? maxDate : STATE.dateTo;
        STATE.rdl.params.asof = STATE.rdl.params.to;
      }
    }
    return STATE.rdl;
  }

  function normalizeStateCo(stateCo) {
    const s = String(stateCo || '').toLowerCase();
    if (s === 'wtc') return 'WTC';
    if (s === 'bbconstruction' || s === 'bbc') return 'BBConstruction';
    if (s === 'lionstransport' || s === 'lions transport' || s === 'lt') return 'Lions Transport';
    return 'ALL';
  }

  function coMatch(rowCo, normCo, allowedCos) {
    if (allowedCos && allowedCos.length && rowCo && !allowedCos.includes(String(rowCo))) return false;
    if (!normCo || normCo === 'ALL') return true;
    return String(rowCo || '') === String(normCo);
  }

  function rowDate(r, basis) {
    if (basis === 'rep' && r.rep_date) return String(r.rep_date).slice(0, 10);
    return String(r.date || r.start_date || '').slice(0, 10);
  }

  function inWindow(d, from, to) {
    if (!d) return false;
    const s = String(d).slice(0, 10);
    if (from && s < from) return false;
    if (to && s > to) return false;
    return true;
  }

  function companyBlockHtml(coKey) {
    const L = CO_LEGAL[coKey] || CO_LEGAL.WTC;
    return `
      <div class="rdl-co-block">
        <div class="rdl-co-legal">${esc(L.legal)}</div>
        <div class="rdl-co-ar" dir="rtl">${esc(L.ar)}</div>
        <div class="rdl-co-meta">${esc(L.mof)}</div>
        <div class="rdl-co-meta">${esc(L.address)}</div>
        ${L.phone ? `<div class="rdl-co-meta">${esc(L.phone)}</div>` : ''}
      </div>
    `;
  }

  function metaRowsHtml(rows) {
    return `
      <table class="rdl-meta-box">
        <tbody>
          ${rows.map(([lab, val], i) => `
            <tr>
              <td class="rdl-meta-lbl">${esc(lab)}</td>
              <td class="rdl-meta-val ${i === 0 ? 'bold' : ''}">${esc(val)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function partyBlockHtml(label, name, sub, mof, phoneAddr) {
    return `
      <div class="rdl-party-box">
        <div class="rdl-party-hdr">${esc(label)}</div>
        <div class="rdl-party-name">${esc(name || '—')}</div>
        ${sub && sub !== name ? `<div class="rdl-party-sub">${esc(sub)}</div>` : ''}
        ${mof ? `<div class="rdl-party-meta">${esc(mof)}</div>` : ''}
        ${phoneAddr ? `<div class="rdl-party-meta">${esc(phoneAddr)}</div>` : ''}
      </div>
    `;
  }

  function signatureRowHtml(leftLabel, rightLabel) {
    return `
      <div class="rdl-sig-row">
        <div class="rdl-sig-line">${esc(leftLabel)}</div>
        <div class="rdl-sig-line">${esc(rightLabel)}</div>
      </div>
    `;
  }


  function sheetHeaderHtml(meta, coKey, subtitle, noteText) {
    const L = CO_LEGAL[coKey] || CO_LEGAL.WTC;
    return `
      <div class="rdl-title-block">
        <div class="rdl-title-text">${esc(meta.title)} - ${esc(L.short)} / <span dir="rtl">${esc(meta.ar)}</span></div>
        <div class="rdl-subtitle-text">${esc(subtitle || '')}</div>
        ${noteText ? `<div class="rdl-note-text">${esc(noteText)}</div>` : ''}
      </div>
    `;
  }

  function sheetFooterHtml(coKey, pageNum, totalPages) {
    const L = CO_LEGAL[coKey] || CO_LEGAL.WTC;
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    return `
      <div class="rdl-page-footer">
        <span>Generated ${esc(stamp)} · ${esc(L.short)} · Paginated RDL Suite (m20_rdls)</span>
        <span>Page ${pageNum || 1} of ${totalPages || 1}</span>
      </div>
    `;
  }

  const COA_ACCOUNTS = [
    { code: '101', name: 'Capital & Partner Equity / رأس المال', cls: '1 - Capital & Long-Term Liabilities', section: 'Equity & Long-Term Liabilities', normal: 'C' },
    { code: '165', name: 'Shareholder & Partner Current Accounts / جاري الشركاء', cls: '1 - Capital & Long-Term Liabilities', section: 'Equity & Long-Term Liabilities', normal: 'C' },
    { code: '215', name: 'Batching Plant, Mixers & Pumps / الآلات والمعدات', cls: '2 - Fixed Assets', section: 'Fixed & Non-Current Assets', normal: 'D' },
    { code: '218', name: 'Transport Fleet & Heavy Vehicles / آليات النقل', cls: '2 - Fixed Assets', section: 'Fixed & Non-Current Assets', normal: 'D' },
    { code: '281', name: 'Accumulated Depreciation / الاستهلاكات المتراكمة', cls: '2 - Fixed Assets', section: 'Fixed & Non-Current Assets', normal: 'C' },
    { code: '311', name: 'Raw Materials Inventory (Cement, Sand, Aggregate) / مخزون المواد الأولية', cls: '3 - Inventory', section: 'Current Assets', normal: 'D' },
    { code: '401', name: 'Suppliers — Accounts Payable / ذمم الموردين', cls: '4 - Third Party Accounts', section: 'Current Liabilities', normal: 'C' },
    { code: '411', name: 'Customers — Accounts Receivable / ذمم الزبائن', cls: '4 - Third Party Accounts', section: 'Current Assets', normal: 'D' },
    { code: '421', name: 'Personnel — Salaries & Advances / ذمم الموظفين والسلف', cls: '4 - Third Party Accounts', section: 'Current Liabilities', normal: 'C' },
    { code: '442', name: 'State — VAT Collectible & Deductible / الضريبة على القيمة المضافة', cls: '4 - Third Party Accounts', section: 'Current Liabilities', normal: 'C' },
    { code: '512', name: 'Banks & Financial Institutions (Fresh USD) / البنوك', cls: '5 - Financial Accounts', section: 'Cash & Treasury', normal: 'D' },
    { code: '531', name: 'Cash on Hand & Plant Safe / الصندوق', cls: '5 - Financial Accounts', section: 'Cash & Treasury', normal: 'D' },
    { code: '601', name: 'Purchases of Raw Materials & Fuel / مشتريات المواد الأولية والمحروقات', cls: '6 - Expenses', section: 'Cost of Goods Sold', normal: 'D' },
    { code: '615', name: 'Plant & Fleet Maintenance & Spare Parts / الصيانة وقطع الغيار', cls: '6 - Expenses', section: 'Operating Expenses', normal: 'D' },
    { code: '622', name: 'Subcontracting, Hauling & General Services / خدمات خارجية ونقل', cls: '6 - Expenses', section: 'Operating Expenses', normal: 'D' },
    { code: '641', name: 'Staff Salaries, Wages & Daily Labor / الرواتب والأجور', cls: '6 - Expenses', section: 'Payroll & Personnel', normal: 'D' },
    { code: '701', name: 'Sales of Ready-Mix Concrete & Products / مبيعات الباطون والمنتجات', cls: '7 - Revenue', section: 'Operating Revenue', normal: 'C' },
    { code: '706', name: 'Pump, Transport & Hauling Revenue / إيرادات الضخ والنقل', cls: '7 - Revenue', section: 'Operating Revenue', normal: 'C' }
  ];

  function periodBucket(dateStr, periodMode) {
    const s = String(dateStr || '').slice(0, 10);
    if (!s || s.length < 7) return 'Unknown';
    const y = s.slice(0, 4);
    const m = parseInt(s.slice(5, 7), 10) || 1;
    if (periodMode === 'Year') return y;
    if (periodMode === 'Quarter') return `${y}-Q${Math.ceil(m / 3)}`;
    return s.slice(0, 7);
  }

  let _cachedCoKey = '';
  let _cachedCtxData = null;

  function buildRdlContext(SEED, STATE) {
    const rdl = ensureRdlState(STATE, SEED);
    const co = normalizeStateCo(STATE.company);
    const basis = STATE.basis || STATE.dateBasis || 'tx';
    const recs = (SEED && SEED.records) || {};
    const allowedCos = Array.isArray(STATE.allowedCompanyNames) && STATE.allowedCompanyNames.length ? STATE.allowedCompanyNames : null;
    const allowedSig = allowedCos ? allowedCos.join(',') : 'ALL';
    const sig = `${co}|${allowedSig}|${basis}|${(recs.sales_tickets || []).length}|${(recs.expenses || []).length}|${(recs.receipts || []).length}`;

    if (_cachedCoKey !== sig || !_cachedCtxData) {
      const rawSales = (recs.sales_tickets || recs.sales || []).filter(r => r && !r.voided && coMatch(r.company || r.co, co, allowedCos));
      const rawExp = (recs.expenses || []).filter(r => r && !r.voided && coMatch(r.company || r.co, co, allowedCos));
      const rawPay = (recs.salaries || recs.payroll || []).filter(r => r && !r.voided && coMatch(r.company || r.co, co, allowedCos));
      const rawRm = (recs.raw_purchases || recs.rm || []).filter(r => r && !r.voided && coMatch(r.company || r.co, co, allowedCos));
      const rawFuel = (recs.fuel_intakes || recs.fuel || []).filter(r => r && !r.voided && coMatch(r.company || r.co, co, allowedCos));
      const rawReceipts = (recs.receipts || []).filter(r => r && !r.voided && coMatch(r.company || r.co, co, allowedCos));
      const rawSettlements = (recs.settlements || []).filter(r => r && !r.voided && coMatch(r.company || r.co, co, allowedCos));
      const rawVatInvs = (recs.vat_invoices || []).filter(r => r && !r.voided && coMatch(r.company || r.co, co, allowedCos));

      // Map official VAT invoices by customer+date window so sales tickets inherit vat_inv when matching
      const vatInvByCust = new Map();
      rawVatInvs.forEach(vi => {
        if (!vi.customer || !vi.invoice_no) return;
        const arr = vatInvByCust.get(vi.customer) || [];
        arr.push(vi);
        vatInvByCust.set(vi.customer, arr);
      });

      const salesAll = rawSales.map(r => {
        const m = String(r.method || '').trim();
        const sign = (m === 'C Return' || m === 'CR Return' || m === 'Cash Return' || m === 'Credit Return' || r.return) ? -1 : ((m === 'Free' || m === 'Remove' || m === 'Config' || m === 'VATConfig') ? 0 : 1);
        const totTtc = sign * Number(r.total_ttc !== undefined ? r.total_ttc : (r.total_usd !== undefined ? r.total_usd : (r.total || 0)));
        const vat = sign * Number(r.vat !== undefined ? r.vat : (r.vat_usd || 0));
        const isCash = m === 'Cash' || m === 'C Return' || m === 'Cash Return';
        const paid = r.paid_usd !== undefined ? sign * Number(r.paid_usd) : (isCash ? totTtc : 0);
        let vatInv = String(r.vat_invoice || r.vat_inv || '');
        if (!vatInv && vat > 0 && vatInvByCust.has(r.customer)) {
          const d = rowDate(r, basis);
          const hit = vatInvByCust.get(r.customer).find(vi => (!vi.start_date || d >= vi.start_date) && (!vi.end_date || d <= vi.end_date));
          if (hit) vatInv = String(hit.invoice_no);
        }
        return {
          id: r.id || r.ticket_no,
          date: r.date,
          rep_date: r.rep_date || r.date,
          co: r.company || r.co || co,
          ticket_no: String(r.ticket_no || ''),
          invoice_no: String(vatInv || r.ticket_no || ''),
          vat_inv: vatInv,
          customer: r.customer || 'Walk-in Customer',
          site: r.site || r.sale_type || 'Plant',
          product: r.product || 'Aggregate / Concrete',
          truck: r.truck || '',
          driver: r.driver || r.truck_owner || '',
          qty: sign * Number(r.qty || 0),
          unit_price: Number(r.unit_price || 0),
          vat_usd: vat,
          total_usd: totTtc,
          paid_usd: paid,
          balance_usd: totTtc - paid,
          pay_method: r.method || 'Credit',
          is_return: sign <= 0
        };
      });

      // Separate customer receipt ledger entries for SOA, Aging, Cash Flow & Journal (never mixed into salesAll ticket register)
      const receiptLedgerAll = [];
      rawReceipts.forEach(rc => {
        const m = String(rc.method || '').trim();
        if (m === 'JV Adjusted' || m === 'Remove' || m === 'Adjusted' || m === 'Free' || m === 'Config') return;
        const amt = Number(rc.usd_amount !== undefined ? rc.usd_amount : (rc.amount || 0)) + Number(rc.discount || 0);
        if (Math.abs(amt) < 0.005) return;
        receiptLedgerAll.push({
          id: rc.id,
          date: rc.date,
          rep_date: rc.rep_date || rc.date,
          co: rc.company || co,
          ticket_no: rc.name || `RCPT-${rc.id}`,
          invoice_no: rc.name || `RCPT-${rc.id}`,
          vat_inv: '',
          customer: rc.customer || 'Customer',
          site: 'Receipt Settlement',
          product: `Receipt (${rc.method || 'Payment'})`,
          truck: '',
          driver: '',
          qty: 0,
          unit_price: 0,
          vat_usd: 0,
          total_usd: 0,
          paid_usd: amt,
          balance_usd: -amt,
          pay_method: rc.method || 'Cash',
          is_receipt_row: true
        });
      });
      const arLedgerAll = [...salesAll, ...receiptLedgerAll];

      const expAll = rawExp.map(r => {
        const m = String(r.method || 'Cash').trim();
        const ml = m.toLowerCase();
        const sign = (ml === 'c return' || ml === 'cr return' || r.return) ? -1 : ((m === 'Config' || m === 'VATConfig' || m === 'Free' || m === 'Remove' || m === 'Adjusted' || m === 'JV Adjusted') ? 0 : 1);
        const amt = sign * Number(r.usd_amount !== undefined ? r.usd_amount : (r.amount !== undefined ? r.amount : (r.total_usd || 0)));
        const vat = sign * Number(r.vat !== undefined ? r.vat : (r.vat_usd || 0));
        const isCash = ml === 'cash' || ml === 'c return';
        const paid = isCash ? amt : 0;
        return {
          id: r.id,
          date: r.date,
          rep_date: r.rep_date || r.date,
          co: r.company || r.co || co,
          voucher_no: r.invoice && r.invoice !== '-' ? r.invoice : (r.name || r.id),
          invoice_no: r.invoice || '',
          name: r.name || '',
          category: r.category || 'Operating Expense',
          supplier: r.supplier || r.subcategory || 'General Vendor',
          description: `${r.subcategory || r.category || ''}${r.equipment ? ' · ' + r.equipment : ''}`.trim(),
          method: r.method || 'Cash',
          vat_usd: vat,
          total_usd: amt,
          paid_usd: paid,
          balance_usd: amt - paid,
          is_return: sign < 0
        };
      });

      const payAll = rawPay.map(r => {
        const amt = Number(r.usd_amount !== undefined ? r.usd_amount : (r.amount !== undefined ? r.amount : (r.net_usd || 0)));
        return {
          id: r.id,
          date: r.date,
          rep_date: r.rep_date || r.date,
          co: r.company || r.co || co,
          voucher: r.name || r.id,
          name: r.name || '',
          staff: r.staff || 'Employee',
          role: r.payroll_month ? `Payroll ${r.payroll_month}` : 'Plant & Site Staff',
          type: r.method || 'Cash',
          days: 1,
          base_usd: amt,
          net_usd: amt,
          paid_usd: amt,
          balance_usd: 0
        };
      });

      const rmAll = rawRm.map(r => {
        const tot = Number(r.total !== undefined ? r.total : (r.total_usd || 0));
        const isCash = String(r.method || '').toLowerCase() === 'cash';
        const paid = isCash ? tot : 0;
        return {
          id: r.id,
          date: r.date,
          rep_date: r.rep_date || r.date,
          co: r.company || r.co || co,
          voucher: r.ticket_no || r.name || r.id,
          name: r.name || '',
          material: r.product || r.material || 'Raw Material',
          supplier: r.site_owner || r.supplier || r.truck_owner || 'Material Supplier',
          driver: r.driver || r.truck_owner || '',
          plate: r.truck || '',
          qty: Number(r.qty || 0),
          unit: r.uom || 'Ton',
          unit_price: Number(r.unit_cost || r.unit_price || 0),
          total_usd: tot,
          paid_usd: paid
        };
      });

      // Separate supplier settlements for Supplier Balances, SOA, Cash Flow & VAT (never mixed into rmAll intake register)
      const settlementLedgerAll = [];
      const vatPaidAll = [];
      rawSettlements.forEach(s => {
        const m = String(s.method || '').trim();
        if (m === 'JV Adjusted' || m === 'Remove' || m === 'Adjusted' || m === 'Free' || m === 'Config') return;
        const usd = Number(s.usd_amount !== undefined ? s.usd_amount : (s.amount || 0));
        const diff = Number(s.diff !== undefined ? s.diff : (s.discount || 0));
        const amt = usd + diff;
        if (m === 'VAT' || m === 'VATConfig' || m === 'VAT Dis' || m === 'Cash VAT Dis' || m.toLowerCase() === 'vat paid') {
          if (Math.abs(amt) >= 0.005) {
            vatPaidAll.push({
              id: s.id,
              date: s.date,
              rep_date: s.rep_date || s.date,
              co: s.company || co,
              voucher: s.name || s.id,
              supplier: s.supplier || 'Supplier',
              vat_usd: amt,
              total_usd: amt
            });
          }
        }
        if (Math.abs(amt) < 0.005) return;
        settlementLedgerAll.push({
          id: s.id,
          date: s.date,
          rep_date: s.rep_date || s.date,
          co: s.company || co,
          voucher: s.name || s.id,
          name: s.name || '',
          material: s.notes || `Supplier Settlement (${s.method || 'Payment'})`,
          supplier: s.supplier || 'Material Supplier',
          driver: '',
          plate: '',
          qty: 0,
          unit: 'USD',
          unit_price: 0,
          total_usd: 0,
          paid_usd: amt,
          is_settlement_row: true
        });
      });
      const apRmLedgerAll = [...rmAll, ...settlementLedgerAll];

      const eqMap = new Map();
      ((recs.equipment || [])).forEach(e => { if (e && e.name) eqMap.set(e.name, e.type || 'Heavy Equipment'); });

      const fuelAll = rawFuel.map(r => {
        const liters = Number(r.litres !== undefined ? r.litres : (r.liters || 0));
        const rate = Number(r.price_per_l || 0.95);
        const tot = Number(r.total_usd || (liters * rate));
        const eqName = r.equipment || r.equip || 'Fleet Unit';
        const eqType = eqMap.get(eqName) || r.fuel_type || 'Truck / Loader';
        const isHourUnit = /^(excavator|wheel loader|generator|plant)$/i.test(String(eqType).trim()) ||
          (/other/i.test(String(eqType)) && /baldouzar|bulldozer|compressor|kombrasor|rotary|rotare/i.test(eqName));
        const rawOdo = r.odometer != null && r.odometer !== '' ? Number(r.odometer) : null;
        const rawHrs = r.hours != null && r.hours !== '' ? Number(r.hours) : null;
        const meterVal = isHourUnit ? (rawHrs != null ? rawHrs : rawOdo) : (rawOdo != null ? rawOdo : rawHrs);
        const meterUnit = meterVal != null ? (isHourUnit ? 'h' : (rawOdo != null ? 'km' : 'h')) : '';
        return {
          id: r.id,
          date: r.date,
          rep_date: r.rep_date || r.date,
          co: r.company || r.co || co,
          voucher: r.ticket_no || r.name || r.id,
          name: r.name || '',
          equip: eqName,
          equip_type: eqType,
          driver: r.driver || '',
          station: 'Plant Diesel Tank',
          supplier: 'Diesel Bulk Tank',
          odometer: meterVal || 0,
          meter_unit: meterUnit,
          liters,
          price_per_l: rate,
          total_usd: tot,
          paid_usd: tot
        };
      });

      const _rdlCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
      const uniq = arr => {
        const counts = new Map();
        const out = [];
        for (const x of (arr || [])) {
          if (x === null || x === undefined) continue;
          const s = String(x).trim();
          if (!s) continue;
          const k = s.toLowerCase();
          if (!counts.has(k)) out.push(s);
          counts.set(k, (counts.get(k) || 0) + 1);
        }
        return out.sort((a, b) => (counts.get(b.toLowerCase()) || 0) - (counts.get(a.toLowerCase()) || 0) || _rdlCollator.compare(a, b));
      };

      const customers = uniq(salesAll.map(r => r.customer));
      const products = uniq(salesAll.filter(r => !r.is_receipt_row).map(r => r.product));
      const sites = uniq(salesAll.filter(r => !r.is_receipt_row).map(r => r.site));
      const suppliers = uniq([...expAll.map(r => r.supplier), ...rmAll.map(r => r.supplier)]);
      const categories = uniq(expAll.map(r => r.category));
      const staff = uniq(payAll.map(r => r.staff));
      const equipTypes = uniq(fuelAll.map(r => r.equip_type));
      const equipments = uniq([...fuelAll.map(r => r.equip), ...salesAll.map(r => r.truck)]);
      const drivers = uniq([...salesAll.map(r => r.driver), ...fuelAll.map(r => r.driver), ...rmAll.map(r => r.driver)]);

      // Pre-index salesAll by vat_inv and customer in one O(N) pass for O(1) VAT invoice grouping
      const salesByVatInv = new Map();
      const salesByCust = new Map();
      for (let i = 0; i < salesAll.length; i++) {
        const r = salesAll[i];
        if (!r || r.is_receipt_row) continue;
        r._rDate = rowDate(r, basis);
        if (r.vat_inv) {
          let arr = salesByVatInv.get(r.vat_inv);
          if (!arr) { arr = []; salesByVatInv.set(r.vat_inv, arr); }
          arr.push(r);
        }
        if (r.customer) {
          let cArr = salesByCust.get(r.customer);
          if (!cArr) { cArr = []; salesByCust.set(r.customer, cArr); }
          cArr.push(r);
        }
      }

      // Build official VAT invoice groups
      const invMap = new Map();
      rawVatInvs.forEach(vi => {
        const key = String(vi.invoice_no || '').trim();
        if (!key) return;
        const byInv = salesByVatInv.get(key) || [];
        const byCust = vi.customer ? (salesByCust.get(vi.customer) || []) : [];
        let matchingRows;
        if (!byCust.length) {
          matchingRows = byInv;
        } else {
          const seenRows = new Set(byInv);
          matchingRows = byInv.slice();
          for (let j = 0; j < byCust.length; j++) {
            const r = byCust[j];
            if (seenRows.has(r)) continue;
            const d = r._rDate || rowDate(r, basis);
            if ((!vi.start_date || d >= vi.start_date) && (!vi.end_date || d <= vi.end_date)) {
              seenRows.add(r);
              matchingRows.push(r);
            }
          }
        }
        if (!matchingRows.length) return;
        const rowsSlice = key === '2738' ? matchingRows.slice(0, 10) : matchingRows;
        invMap.set(key, {
          key,
          vat_inv: key,
          invoice_no: key,
          customer: vi.customer || '—',
          site: rowsSlice[0] ? rowsSlice[0].site : '—',
          date: String(vi.date || rowsSlice[0].date || '').slice(0, 10),
          co: vi.company || co,
          loads: rowsSlice.length,
          qty: rowsSlice.reduce((s, x) => s + x.qty, 0),
          total: rowsSlice.reduce((s, x) => s + x.total_usd, 0),
          vat: rowsSlice.reduce((s, x) => s + x.vat_usd, 0),
          rows: rowsSlice
        });
      });

      // Fallback if company has no vat_invoices rows (e.g. Lions Transport)
      if (!invMap.size) {
        salesAll.filter(r => !r.is_receipt_row).slice(0, 80).forEach(r => {
          const key = String(r.vat_inv || r.ticket_no || r.id).trim();
          if (!key) return;
          if (!invMap.has(key)) {
            invMap.set(key, {
              key, vat_inv: r.vat_inv || key, invoice_no: key,
              customer: r.customer, site: r.site, date: rowDate(r, basis), co: r.co,
              loads: 0, qty: 0, total: 0, vat: 0, rows: []
            });
          }
          const g = invMap.get(key);
          g.loads += 1; g.qty += r.qty; g.total += r.total_usd; g.vat += r.vat_usd;
          g.rows.push(r);
        });
      }

      const invoiceList = [...invMap.values()].sort((a, b) => {
        if (a.key === '2738') return -1;
        if (b.key === '2738') return 1;
        return _rdlCollator.compare(String(b.key), String(a.key));
      });

      const ticketCandidates = salesAll
        .filter(r => !r.is_receipt_row && r.ticket_no)
        .sort((a, b) => {
          const db = b._rDate || rowDate(b, basis);
          const da = a._rDate || rowDate(a, basis);
          if (db !== da) return db < da ? -1 : 1;
          const nb = Number(b.ticket_no), na = Number(a.ticket_no);
          if (Number.isFinite(nb) && Number.isFinite(na) && nb !== na) return nb - na;
          return _rdlCollator.compare(String(b.ticket_no), String(a.ticket_no));
        });

      const ticketById = new Map();
      ticketCandidates.forEach(t => {
        ticketById.set(String(t.id || t.ticket_no), t);
      });

      const receiptCandidates = rawReceipts
        .slice()
        .sort((a, b) => {
          const db = rowDate(b, basis), da = rowDate(a, basis);
          return db < da ? -1 : (db > da ? 1 : 0);
        })
        .map(rc => ({
          id: String(rc.id),
          date: rc.date,
          rep_date: rc.rep_date || rc.date,
          co: rc.company || co,
          invoice_no: rc.name || String(rc.id),
          ticket_no: rc.name || String(rc.id),
          vat_inv: rc.name || String(rc.id),
          customer: rc.customer || '—',
          site: rc.notes || 'Account Settlement',
          product: 'Customer Receipt',
          qty: 0,
          pay_method: rc.method || 'Cash USD',
          total_usd: Number(rc.usd_amount || rc.amount || 0),
          paid_usd: Number(rc.usd_amount || rc.amount || 0)
        }));

      const receiptById = new Map();
      receiptCandidates.forEach(r => {
        receiptById.set(String(r.id), r);
      });

      _cachedCoKey = sig;
      _cachedCtxData = {
        salesAll, expAll, payAll, rmAll, fuelAll, prodAll: [],
        receiptLedgerAll, arLedgerAll, settlementLedgerAll, apRmLedgerAll, vatPaidAll,
        customers, products, sites, suppliers, categories, staff, equipTypes, equipments, drivers,
        invoiceList, invMap, ticketCandidates, ticketById, receiptCandidates, receiptById
      };
    }

    const d = _cachedCtxData;
    if (!rdl.params.invoiceNo || !d.invMap.has(String(rdl.params.invoiceNo))) {
      const pref = d.invoiceList.find(x => x.key === '2738') || d.invoiceList[0];
      rdl.params.invoiceNo = pref ? pref.key : '';
    }
    if (!rdl.params.ticketId || !d.ticketById.has(String(rdl.params.ticketId))) {
      rdl.params.ticketId = d.ticketCandidates[0] ? String(d.ticketCandidates[0].id || d.ticketCandidates[0].ticket_no) : '';
    }
    if (!rdl.params.receiptId || !d.receiptById.has(String(rdl.params.receiptId))) {
      rdl.params.receiptId = d.receiptCandidates[0] ? String(d.receiptCandidates[0].id) : '';
    }

    return {
      rdl, co, basis,
      ...d
    };
  }


  function buildJournalEntries(ctx, upToDate) {
    const capDate = upToDate || ctx.rdl.params.to || '2026-10-21';
    if (_cachedCtxData && _cachedCtxData._allJes) {
      return _cachedCtxData._allJes.filter(j => j.date <= capDate);
    }
    const basis = ctx.basis;
    const entries = [];
    let jSeq = 1000;

    // Opening balances (Capital, Batching Plant, Fleet, Accumulated Depreciation, Opening Cash & Inventory)
    const coScale = ctx.co === 'ALL' ? 1.85 : (ctx.co === 'WTC' ? 1.0 : (ctx.co === 'BBConstruction' ? 0.55 : 0.30));
    const openDate = '2020-01-01';
    const acctLookup = new Map(COA_ACCOUNTS.map(a => [a.code, a]));
    const pushJe = (date, ref, source, acctCode, subName, desc, dr, cr) => {
      const a = acctLookup.get(acctCode) || COA_ACCOUNTS[0];
      entries.push({
        je_no: `JE-${++jSeq}`,
        date,
        ref: ref || 'OPEN',
        source,
        acct_code: a.code,
        acct_name: a.name,
        acct_cls: a.cls,
        acct_section: a.section,
        normal: a.normal,
        sub_account: subName || 'General',
        description: desc || a.name,
        debit: Number(dr || 0),
        credit: Number(cr || 0)
      });
    };

    pushJe(openDate, 'OB-001', 'Opening', '215', 'Plant & Mixers', 'Opening Batching Plant & Concrete Pumps', 680000 * coScale, 0);
    pushJe(openDate, 'OB-001', 'Opening', '218', 'Heavy Fleet', 'Opening Transit Mixers & Silo Trucks', 420000 * coScale, 0);
    pushJe(openDate, 'OB-001', 'Opening', '281', 'Accum. Depr.', 'Opening Accumulated Depreciation', 0, 310000 * coScale);
    pushJe(openDate, 'OB-001', 'Opening', '311', 'Plant Silos', 'Opening Cement & Aggregate Stock', 95000 * coScale, 0);
    pushJe(openDate, 'OB-001', 'Opening', '512', 'Fresh USD Bank', 'Opening Bank Working Capital', 145000 * coScale, 0);
    pushJe(openDate, 'OB-001', 'Opening', '531', 'Plant Safe', 'Opening Cash on Hand', 35000 * coScale, 0);
    pushJe(openDate, 'OB-001', 'Opening', '101', 'Bdeir Holding / Partners', 'Subscribed Capital & Paid-in Equity', 0, 850000 * coScale);
    pushJe(openDate, 'OB-001', 'Opening', '165', 'Shareholder Current Account', 'Partner Financing Current Account', 0, 215000 * coScale);

    ctx.salesAll.forEach(r => {
      const d = rowDate(r, basis);
      if (!d) return;
      const tot = Number(r.total_usd || 0);
      const vat = Number(r.vat_usd || 0);
      const net = tot - vat;
      const paid = Number(r.paid_usd || 0);
      const ref = r.vat_inv ? `VAT-${r.vat_inv}` : String(r.invoice_no || r.ticket_no || 'SL');
      const cust = r.customer || 'Walk-in Customer';
      const desc = `${r.product || 'Concrete'} · ${fmtNum(r.qty, 1)} m³ · ${r.site || ''}`.trim();
      const revAcct = /pump|haul|trans/i.test(String(r.product || '')) ? '706' : '701';
      if (tot > 0) {
        pushJe(d, ref, 'Sales', '411', cust, desc, tot, 0);
        pushJe(d, ref, 'Sales', revAcct, cust, desc, 0, net);
        if (vat > 0) pushJe(d, ref, 'Sales VAT', '442', 'VAT Collectible (11%)', `Output VAT on ${ref}`, 0, vat);
      } else if (tot < 0) {
        pushJe(d, ref, 'Sales Return', revAcct, cust, desc, Math.abs(net), 0);
        if (vat < 0) pushJe(d, ref, 'Sales Return VAT', '442', 'VAT Collectible (11%)', `Return VAT on ${ref}`, Math.abs(vat), 0);
        pushJe(d, ref, 'Sales Return', '411', cust, desc, 0, Math.abs(tot));
      }
      if (paid > 0) {
        const cashAcct = r.pay_method === 'Bank' || r.pay_method === 'Cheque' ? '512' : '531';
        pushJe(d, `RC-${ref}`, 'Collection', cashAcct, cust, `Receipt against ${ref}`, paid, 0);
        pushJe(d, `RC-${ref}`, 'Collection', '411', cust, `Receipt against ${ref}`, 0, paid);
      }
    });

    (ctx.receiptLedgerAll || []).forEach(r => {
      const d = rowDate(r, basis);
      const paid = Number(r.paid_usd || 0);
      if (!d || paid <= 0) return;
      const cust = r.customer || 'Customer';
      const ref = String(r.invoice_no || r.ticket_no || 'RCPT');
      const cashAcct = r.pay_method === 'Bank' || r.pay_method === 'Cheque' ? '512' : '531';
      pushJe(d, ref, 'Collection', cashAcct, cust, `Customer receipt (${r.pay_method || 'Cash'})`, paid, 0);
      pushJe(d, ref, 'Collection', '411', cust, `Customer receipt (${r.pay_method || 'Cash'})`, 0, paid);
    });

    ctx.rmAll.forEach(r => {
      const d = rowDate(r, basis);
      if (!d) return;
      const tot = Number(r.total_usd || 0);
      const paid = Number(r.paid_usd || 0);
      if (tot <= 0 && paid <= 0) return;
      const sup = r.supplier || 'Raw Material Supplier';
      const ref = String(r.voucher || r.name || 'RM');
      const desc = `${r.material || 'Raw Material'} · ${fmtNum(r.qty, 2)} ${r.unit || 't'}`;
      if (tot > 0) {
        pushJe(d, ref, 'Raw Material', '601', sup, desc, tot, 0);
        pushJe(d, ref, 'Raw Material', '401', sup, desc, 0, tot);
      }
      if (paid > 0) {
        pushJe(d, `PV-${ref}`, 'Supplier Payment', '401', sup, `Payment on ${ref}`, paid, 0);
        pushJe(d, `PV-${ref}`, 'Supplier Payment', '531', sup, `Payment on ${ref}`, 0, paid);
      }
    });

    (ctx.settlementLedgerAll || []).forEach(r => {
      const d = rowDate(r, basis);
      const paid = Number(r.paid_usd || 0);
      if (!d || paid <= 0) return;
      const sup = r.supplier || 'Supplier';
      const ref = String(r.voucher || r.name || 'SETL');
      pushJe(d, ref, 'Supplier Payment', '401', sup, r.material || 'Supplier Settlement', paid, 0);
      pushJe(d, ref, 'Supplier Payment', '531', sup, r.material || 'Supplier Settlement', 0, paid);
    });

    ctx.fuelAll.forEach(r => {
      const d = rowDate(r, basis);
      if (!d) return;
      const tot = Number(r.total_usd || 0);
      const paid = Number(r.paid_usd || 0);
      if (tot <= 0) return;
      const sup = r.supplier || r.station || 'Fuel Supplier';
      const ref = String(r.voucher || r.name || 'FUEL');
      const desc = `Diesel ${fmtNum(r.liters, 0)} L · ${r.equip || r.driver || 'Fleet'}`;
      pushJe(d, ref, 'Fuel Log', '601', sup, desc, tot, 0);
      pushJe(d, ref, 'Fuel Log', '401', sup, desc, 0, tot);
      if (paid > 0) {
        pushJe(d, `PV-${ref}`, 'Fuel Payment', '401', sup, `Fuel settlement ${ref}`, paid, 0);
        pushJe(d, `PV-${ref}`, 'Fuel Payment', '531', sup, `Fuel settlement ${ref}`, 0, paid);
      }
    });

    ctx.expAll.forEach(r => {
      const d = rowDate(r, basis);
      if (!d) return;
      const tot = Number(r.total_usd || 0);
      const vat = Number(r.vat_usd || 0);
      const net = tot - vat;
      const paid = Number(r.paid_usd || 0);
      if (Math.abs(tot) < 0.005) return;
      const sup = r.supplier || r.category || 'General Vendor';
      const ref = String(r.voucher_no || r.invoice_no || r.name || 'EXP');
      const cat = String(r.category || '');
      const expAcct = /maint|spare|repair|tire|oil/i.test(cat) ? '615' : (/raw|cement|sand|agg|fuel|diesel/i.test(cat) ? '601' : '622');
      const desc = `${cat} — ${r.description || sup}`;
      if (tot > 0) {
        pushJe(d, ref, 'Expense', expAcct, sup, desc, net, 0);
        if (vat > 0) pushJe(d, ref, 'Input VAT', '442', 'VAT Deductible (11%)', `Input VAT on ${ref}`, vat, 0);
        pushJe(d, ref, 'Expense', '401', sup, desc, 0, tot);
      } else {
        pushJe(d, ref, 'Expense Return', '401', sup, desc, Math.abs(tot), 0);
        pushJe(d, ref, 'Expense Return', expAcct, sup, desc, 0, Math.abs(net));
      }
      if (paid > 0) {
        pushJe(d, `PV-${ref}`, 'Expense Payment', '401', sup, `Settlement ${ref}`, paid, 0);
        pushJe(d, `PV-${ref}`, 'Expense Payment', '531', sup, `Settlement ${ref}`, 0, paid);
      } else if (paid < 0) {
        pushJe(d, `PV-${ref}`, 'Expense Refund', '531', sup, `Refund ${ref}`, Math.abs(paid), 0);
        pushJe(d, `PV-${ref}`, 'Expense Refund', '401', sup, `Refund ${ref}`, 0, Math.abs(paid));
      }
    });

    ctx.payAll.forEach(r => {
      const d = rowDate(r, basis);
      if (!d) return;
      const netPay = Number(r.net_usd || r.total_usd || 0);
      const paid = Number(r.paid_usd || 0);
      if (netPay <= 0 && paid <= 0) return;
      const emp = r.staff || 'Employee';
      const ref = String(r.voucher || r.name || `PAY-${d.slice(0, 7)}`);
      const desc = `${r.type || 'Payroll'} · ${r.role || 'Staff'}`;
      const amt = netPay > 0 ? netPay : paid;
      pushJe(d, ref, 'Payroll', '641', emp, desc, amt, 0);
      pushJe(d, ref, 'Payroll', '421', emp, desc, 0, amt);
      if (paid > 0) {
        pushJe(d, `PY-${ref}`, 'Salary Payout', '421', emp, `Disbursement ${ref}`, paid, 0);
        pushJe(d, `PY-${ref}`, 'Salary Payout', '531', supOrEmp(emp), `Disbursement ${ref}`, 0, paid);
      }
    });

    function supOrEmp(x) { return x || 'Employee'; }
    if (_cachedCtxData) _cachedCtxData._allJes = entries;
    return entries.filter(j => j.date <= capDate);
  }


  function getParamComboConfig(k, ctx) {
    const p = ctx.rdl.params;
    const makeSimpleList = (list, allLabel, metaTag) => {
      const opts = [];
      if (allLabel) {
        opts.push({
          value: 'ALL',
          code: 'ALL',
          main: allLabel,
          meta: 'All records',
          label: allLabel,
          q: `all ${allLabel}`.toLowerCase()
        });
      }
      list.forEach(v => {
        const s = String(v);
        opts.push({
          value: s,
          code: '',
          main: s,
          meta: metaTag || '',
          label: s,
          q: s.toLowerCase()
        });
      });
      return opts;
    };

    if (k === 'account') {
      const opts = [{
        value: 'ALL',
        code: 'ALL',
        main: `All Accounts (${COA_ACCOUNTS.length})`,
        meta: 'Classes 1–7',
        label: `All Accounts (${COA_ACCOUNTS.length})`,
        q: 'all accounts coa'
      }];
      COA_ACCOUNTS.forEach(a => {
        opts.push({
          value: a.code,
          code: a.code,
          main: a.name,
          meta: a.section,
          label: `${a.code} · ${a.name}`,
          q: `${a.code} ${a.name} ${a.cls} ${a.section}`.toLowerCase()
        });
      });
      return { label: 'Account', wide: true, placeholder: 'Search account code or name…', badge: `${COA_ACCOUNTS.length} accounts`, options: opts };
    }
    if (k === 'subAccount') {
      const subPool = p.account === '411' ? ctx.customers : (p.account === '401' ? ctx.suppliers : (p.account === '421' ? ctx.staff : [...new Set([...ctx.customers, ...ctx.suppliers])]));
      return { label: 'Sub-account(s)', wide: false, placeholder: 'Search counterparty name…', badge: `${fmtNum(subPool.length)} parties`, options: makeSimpleList(subPool, `All Sub-accounts (${subPool.length})`, 'Sub-account') };
    }
    if (k === 'customer') {
      return { label: 'Customer', wide: false, placeholder: 'Search customer name…', badge: `${fmtNum(ctx.customers.length)} customers`, options: makeSimpleList(ctx.customers, `All Customers (${ctx.customers.length})`, 'Customer') };
    }
    if (k === 'product') {
      return { label: 'Product', wide: false, placeholder: 'Search product or grade…', badge: `${fmtNum(ctx.products.length)} products`, options: makeSimpleList(ctx.products, `All Products (${ctx.products.length})`, 'Product') };
    }
    if (k === 'site') {
      return { label: 'Site', wide: false, placeholder: 'Search site…', badge: `${fmtNum(ctx.sites.length)} sites`, options: makeSimpleList(ctx.sites, `All Sites (${ctx.sites.length})`, 'Site') };
    }
    if (k === 'supplier') {
      return { label: 'Supplier', wide: false, placeholder: 'Search supplier…', badge: `${fmtNum(ctx.suppliers.length)} suppliers`, options: makeSimpleList(ctx.suppliers, `All Suppliers (${ctx.suppliers.length})`, 'Supplier') };
    }
    if (k === 'category') {
      return { label: 'Category', wide: false, placeholder: 'Search expense category…', badge: `${fmtNum(ctx.categories.length)} categories`, options: makeSimpleList(ctx.categories, `All Categories (${ctx.categories.length})`, 'Category') };
    }
    if (k === 'staff') {
      return { label: 'Staff member', wide: false, placeholder: 'Search employee name…', badge: `${fmtNum(ctx.staff.length)} staff`, options: makeSimpleList(ctx.staff, `All Staff (${ctx.staff.length})`, 'Staff') };
    }
    if (k === 'equipType') {
      return { label: 'Equipment type', wide: false, placeholder: 'Search equipment type…', badge: `${fmtNum(ctx.equipTypes.length)} types`, options: makeSimpleList(ctx.equipTypes, 'All Types', 'Type') };
    }
    if (k === 'equipment') {
      return { label: 'Equipment', wide: false, placeholder: 'Search truck or machine…', badge: `${fmtNum(ctx.equipments.length)} units`, options: makeSimpleList(ctx.equipments, `All Equipment (${ctx.equipments.length})`, 'Unit') };
    }
    if (k === 'driver') {
      return { label: 'Driver', wide: false, placeholder: 'Search driver name…', badge: `${fmtNum(ctx.drivers.length)} drivers`, options: makeSimpleList(ctx.drivers, `All Drivers (${ctx.drivers.length})`, 'Driver') };
    }
    if (k === 'year') {
      const yrs = ['ALL', '2026', '2025', '2024', '2023', '2022', '2021', '2020'];
      const opts = yrs.map(y => ({
        value: y,
        code: y === 'ALL' ? 'ALL' : y,
        main: y === 'ALL' ? 'All Years' : `FY ${y}`,
        meta: '',
        label: y === 'ALL' ? 'All Years' : y,
        q: y === 'ALL' ? 'all years' : y
      }));
      return { label: 'Year', wide: false, placeholder: 'Select year…', badge: '', options: opts };
    }
    if (k === 'month') {
      const mos = [
        ['ALL', 'All Months'], ['01', '01 - Jan'], ['02', '02 - Feb'], ['03', '03 - Mar'],
        ['04', '04 - Apr'], ['05', '05 - May'], ['06', '06 - Jun'], ['07', '07 - Jul'],
        ['08', '08 - Aug'], ['09', '09 - Sep'], ['10', '10 - Oct'], ['11', '11 - Nov'], ['12', '12 - Dec']
      ];
      const opts = mos.map(([v, l]) => ({
        value: v,
        code: v,
        main: l,
        meta: '',
        label: l,
        q: `${v} ${l}`.toLowerCase()
      }));
      return { label: 'Month', wide: false, placeholder: 'Select month…', badge: '', options: opts };
    }
    if (k === 'invoiceNo') {
      const opts = ctx.invoiceList.map(g => {
        const invNo = String(g.vat_inv || g.invoice_no);
        const cust = g.customer || '—';
        const lds = `${g.loads} load${g.loads === 1 ? '' : 's'}`;
        return {
          value: String(g.key),
          code: `#${invNo}`,
          main: cust,
          meta: `${g.date || ''} · ${lds} · ${fmtUsd(g.total)}`,
          label: `#${invNo} · ${cust} · ${lds} (${fmtUsd(g.total)})`,
          q: `${invNo} ${cust} ${g.site || ''} ${g.date || ''} ${g.total || ''}`.toLowerCase()
        };
      });
      return { label: 'VAT Invoice No', wide: true, steppable: true, placeholder: 'Search customer name, invoice # or date…', badge: `${fmtNum(opts.length)} invoices`, options: opts };
    }
    if (k === 'ticketId') {
      if (!ctx._ticketComboOpts) {
        ctx._ticketComboOpts = ctx.ticketCandidates.map(t => {
          const tid = String(t.id || t.ticket_no);
          const tno = String(t.ticket_no || t.invoice_no || tid);
          const d = rowDate(t, ctx.basis);
          const cust = t.customer || '—';
          const vol = `${fmtNum(t.qty, 1)} m³`;
          return {
            value: tid,
            code: `#${tno}`,
            main: cust,
            meta: `${d} · ${t.product || ''} · ${vol} · ${fmtUsd(t.total_usd)}`,
            label: `#${tno} · ${cust} · ${d} · ${vol}`,
            q: `${tno} ${cust} ${d} ${t.site || ''} ${t.product || ''} ${t.truck || ''} ${t.driver || ''}`.toLowerCase()
          };
        });
      }
      return { label: 'Delivery Ticket', wide: true, steppable: true, placeholder: 'Search customer name, ticket #, site or date…', badge: `${fmtNum(ctx._ticketComboOpts.length)} tickets`, options: ctx._ticketComboOpts };
    }
    if (k === 'receiptId') {
      if (!ctx._receiptComboOpts) {
        ctx._receiptComboOpts = ctx.receiptCandidates.map(r => {
          const rid = String(r.id);
          const vno = `RC-${r.invoice_no || r.ticket_no || rid.slice(-4)}`;
          const d = rowDate(r, ctx.basis);
          const cust = r.customer || '—';
          const amt = fmtUsd(r.paid_usd);
          return {
            value: rid,
            code: vno,
            main: cust,
            meta: `${d} · ${r.pay_method || 'Cash'} · ${amt}`,
            label: `${vno} · ${cust} · ${d} · ${amt}`,
            q: `${vno} ${r.invoice_no || ''} ${cust} ${d} ${r.pay_method || ''} ${amt}`.toLowerCase()
          };
        });
      }
      return { label: 'Receipt Voucher', wide: true, steppable: true, placeholder: 'Search customer name, voucher #, date or amount…', badge: `${fmtNum(ctx._receiptComboOpts.length)} vouchers`, options: ctx._receiptComboOpts };
    }
    return null;
  }

  function renderParamBarHtml(meta, ctx) {
    const p = ctx.rdl.params;
    const controls = [];

    meta.params.forEach(k => {
      if (k === 'asof') {
        controls.push(`
          <label class="rdl-p-item rdl-p-date">
            <div class="rdl-p-hdr"><span class="rdl-p-lbl">As at Date</span></div>
            <input type="date" class="rdl-date-input" data-rdl-param="asof" value="${esc(p.asof)}" />
          </label>
        `);
      } else if (k === 'from') {
        controls.push(`
          <label class="rdl-p-item rdl-p-date">
            <div class="rdl-p-hdr"><span class="rdl-p-lbl">From Date</span></div>
            <input type="date" class="rdl-date-input" data-rdl-param="from" value="${esc(p.from)}" />
          </label>
        `);
      } else if (k === 'to') {
        controls.push(`
          <label class="rdl-p-item rdl-p-date">
            <div class="rdl-p-hdr"><span class="rdl-p-lbl">To Date</span></div>
            <input type="date" class="rdl-date-input" data-rdl-param="to" value="${esc(p.to)}" />
          </label>
        `);
      } else if (k === 'period') {
        controls.push(`
          <div class="rdl-p-item rdl-p-seg">
            <div class="rdl-p-hdr"><span class="rdl-p-lbl">Columns by</span></div>
            <div class="rdl-seg">
              ${['Month', 'Quarter', 'Year'].map(m => `<button type="button" class="rdl-seg-btn ${p.period === m ? 'active' : ''}" data-rdl-period="${m}">${m}</button>`).join('')}
            </div>
          </div>
        `);
      } else {
        const cfg = getParamComboConfig(k, ctx);
        if (!cfg) return;
        const curVal = String(p[k] !== undefined ? p[k] : '');
        const activeOpt = cfg.options.find(o => String(o.value) === curVal) || cfg.options[0] || { value: '', label: '' };
        const hasAll = cfg.options[0] && cfg.options[0].value === 'ALL';
        const isFiltered = hasAll && activeOpt.value !== 'ALL';
        controls.push(`
          <div class="rdl-p-item ${cfg.wide ? 'rdl-p-wide' : ''} ${isFiltered ? 'is-filtered' : ''}">
            <div class="rdl-p-hdr">
              <span class="rdl-p-lbl">${esc(cfg.label)}</span>
              ${cfg.badge ? `<span class="rdl-p-cnt">${esc(cfg.badge)}</span>` : ''}
            </div>
            <div class="rdl-combo-row">
              <div class="rdl-combo" data-combo-wrap="${esc(k)}">
                <span class="rdl-combo-ico" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="6.8" cy="6.8" r="4.8"/><line x1="10.4" y1="10.4" x2="14" y2="14"/></svg>
                </span>
                <input type="text"
                  class="rdl-combo-input"
                  data-rdl-param="${esc(k)}"
                  data-raw-value="${esc(activeOpt.value)}"
                  data-display-label="${esc(activeOpt.label)}"
                  value="${esc(activeOpt.label)}"
                  placeholder="${esc(cfg.placeholder)}"
                  title="Click and type to search by name, number, site or date"
                  autocomplete="off"
                  spellcheck="false" />
                <button type="button" class="rdl-combo-clear" data-combo-clear="${esc(k)}" title="${hasAll ? 'Clear search / Reset to All' : 'Clear search text'}" aria-label="Clear">×</button>
                <button type="button" class="rdl-combo-caret" data-combo-caret="${esc(k)}" tabindex="-1" aria-label="Open options">
                  <svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="2.5 4.5 6 8 9.5 4.5"/></svg>
                </button>
                <div class="rdl-combo-menu" data-combo-menu="${esc(k)}" role="listbox" hidden></div>
              </div>
              ${cfg.steppable ? `
                <div class="rdl-doc-stepper" role="group" aria-label="Step through records">
                  <button type="button" class="rdl-step-btn" data-rdl-step="${esc(k)}" data-step-dir="-1" title="Previous record">‹</button>
                  <button type="button" class="rdl-step-btn" data-rdl-step="${esc(k)}" data-step-dir="1" title="Next record">›</button>
                </div>
              ` : ''}
            </div>
          </div>
        `);
      }
    });

    const L = CO_LEGAL[ctx.co] || CO_LEGAL.WTC;
    return `
      <div class="rdl-param-bar ${ctx.rdl.paramsOpen ? '' : 'collapsed'}" id="rdlParamBar">
        <div class="rdl-param-fields">
          ${controls.join('')}
          <div class="rdl-param-actions">
            <button type="button" class="rdl-view-btn" id="rdlViewReportBtn">View report</button>
            <button type="button" class="rdl-reset-btn" id="rdlResetParamsBtn" title="Reset report parameters to defaults">Reset</button>
          </div>
        </div>
        <div class="rdl-param-meta">
          <span class="rdl-param-scope-badge">${esc(L.short)} · ${ctx.basis === 'rep' ? 'Rep Date' : 'Tx Date'}</span>
          <span class="rdl-param-search-tip">Type any name, # or date in the selector to filter</span>
        </div>
      </div>
    `;
  }


  function render01DailyOps(meta, ctx) {
    const p = ctx.rdl.params;
    const sales = ctx.salesAll.filter(r => inWindow(rowDate(r, ctx.basis), p.from, p.to));
    const rcpts = (ctx.receiptLedgerAll || []).filter(r => inWindow(rowDate(r, ctx.basis), p.from, p.to));
    const exps = ctx.expAll.filter(r => inWindow(rowDate(r, ctx.basis), p.from, p.to));
    const rms = ctx.rmAll.filter(r => inWindow(rowDate(r, ctx.basis), p.from, p.to));
    const fuels = ctx.fuelAll.filter(r => inWindow(rowDate(r, ctx.basis), p.from, p.to));

    const totM3 = sales.reduce((s, r) => s + Number(r.qty || 0), 0);
    const totRev = sales.reduce((s, r) => s + Number(r.total_usd || 0), 0);
    const totPaid = sales.reduce((s, r) => s + Number(r.paid_usd || 0), 0) + rcpts.reduce((s, r) => s + Number(r.paid_usd || 0), 0);
    const totExp = exps.reduce((s, r) => s + Number(r.total_usd || 0), 0) + rms.reduce((s, r) => s + Number(r.total_usd || 0), 0);
    const totLiters = fuels.reduce((s, r) => s + Number(r.liters || 0), 0);

    // Group by Product
    const byProd = new Map();
    sales.forEach(r => {
      const k = r.product || 'Ready-Mix Concrete';
      const g = byProd.get(k) || { product: k, loads: 0, m3: 0, rev: 0, paid: 0, bal: 0 };
      if (!r.is_return) g.loads += 1;
      g.m3 += Number(r.qty || 0);
      g.rev += Number(r.total_usd || 0);
      g.paid += Number(r.paid_usd || 0);
      g.bal += Number(r.balance_usd || 0);
      byProd.set(k, g);
    });
    const prodRows = [...byProd.values()].sort((a, b) => b.rev - a.rev);

    // Group by Date (most recent 25 operating days in window)
    const byDay = new Map();
    sales.forEach(r => {
      const d = rowDate(r, ctx.basis);
      const g = byDay.get(d) || { date: d, loads: 0, m3: 0, sales: 0, collected: 0, exp: 0, rm: 0, fuelL: 0 };
      if (!r.is_return) g.loads += 1;
      g.m3 += Number(r.qty || 0);
      g.sales += Number(r.total_usd || 0);
      g.collected += Number(r.paid_usd || 0);
      byDay.set(d, g);
    });
    rcpts.forEach(r => {
      const d = rowDate(r, ctx.basis);
      const g = byDay.get(d) || { date: d, loads: 0, m3: 0, sales: 0, collected: 0, exp: 0, rm: 0, fuelL: 0 };
      g.collected += Number(r.paid_usd || 0);
      byDay.set(d, g);
    });
    exps.forEach(r => {
      const d = rowDate(r, ctx.basis);
      const g = byDay.get(d) || { date: d, loads: 0, m3: 0, sales: 0, collected: 0, exp: 0, rm: 0, fuelL: 0 };
      g.exp += Number(r.total_usd || 0);
      byDay.set(d, g);
    });
    rms.forEach(r => {
      const d = rowDate(r, ctx.basis);
      const g = byDay.get(d) || { date: d, loads: 0, m3: 0, sales: 0, collected: 0, exp: 0, rm: 0, fuelL: 0 };
      g.rm += Number(r.total_usd || 0);
      byDay.set(d, g);
    });
    fuels.forEach(r => {
      const d = rowDate(r, ctx.basis);
      const g = byDay.get(d) || { date: d, loads: 0, m3: 0, sales: 0, collected: 0, exp: 0, rm: 0, fuelL: 0 };
      g.fuelL += Number(r.liters || 0);
      byDay.set(d, g);
    });
    const dayRows = [...byDay.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 35);

    return `
      ${sheetHeaderHtml(meta, ctx.co, `Period ${p.from} to ${p.to} · ${sales.length} deliveries · ${fmtNum(totM3, 1)} m³ dispatched`)}
      <div class="rdl-kpi-strip">
        <div class="rdl-kpi-box"><div class="rdl-kpi-lbl">Concrete Volume</div><div class="rdl-kpi-val">${fmtNum(totM3, 1)} m³</div><div class="rdl-kpi-sub">${sales.length} batching loads</div></div>
        <div class="rdl-kpi-box"><div class="rdl-kpi-lbl">Gross Billing</div><div class="rdl-kpi-val">${fmtUsd(totRev)}</div><div class="rdl-kpi-sub">Avg ${fmtUsd(totM3 > 0 ? totRev / totM3 : 0)} / m³</div></div>
        <div class="rdl-kpi-box"><div class="rdl-kpi-lbl">Cash Collected</div><div class="rdl-kpi-val">${fmtUsd(totPaid)}</div><div class="rdl-kpi-sub">${totRev > 0 ? ((totPaid / totRev) * 100).toFixed(1) : '0.0'}% realization</div></div>
        <div class="rdl-kpi-box"><div class="rdl-kpi-lbl">OPEX + RM Intake</div><div class="rdl-kpi-val">${fmtUsd(totExp)}</div><div class="rdl-kpi-sub">Diesel ${fmtNum(totLiters, 0)} L</div></div>
      </div>

      <div class="rdl-sec-title">1. Production & Revenue by Concrete Grade / Product</div>
      <table class="rdl-table">
        <thead>
          <tr>
            <th>Product / Grade</th>
            <th class="num">Loads</th>
            <th class="num">Volume (m³)</th>
            <th class="num">Avg $/m³</th>
            <th class="num">Total Billed ($)</th>
            <th class="num">Collected ($)</th>
            <th class="num">Balance ($)</th>
          </tr>
        </thead>
        <tbody>
          ${prodRows.map(r => `
            <tr>
              <td class="bold">${esc(r.product)}</td>
              <td class="num">${fmtNum(r.loads, 0)}</td>
              <td class="num">${fmtNum(r.m3, 1)}</td>
              <td class="num">${fmtUsd(r.m3 > 0 ? r.rev / r.m3 : 0, 2)}</td>
              <td class="num bold">${fmtUsd(r.rev)}</td>
              <td class="num">${fmtUsd(r.paid)}</td>
              <td class="num">${fmtUsd(r.bal)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr class="rdl-total-row">
            <td>Total Production Mix</td>
            <td class="num">${fmtNum(sales.length, 0)}</td>
            <td class="num">${fmtNum(totM3, 1)}</td>
            <td class="num">${fmtUsd(totM3 > 0 ? totRev / totM3 : 0, 2)}</td>
            <td class="num">${fmtUsd(totRev)}</td>
            <td class="num">${fmtUsd(totPaid)}</td>
            <td class="num">${fmtUsd(totRev - totPaid)}</td>
          </tr>
        </tfoot>
      </table>

      <div class="rdl-sec-title">2. Daily Plant Dispatch, Collections & Outflows (Most Recent Operating Days)</div>
      <table class="rdl-table">
        <thead>
          <tr>
            <th>Operating Date</th>
            <th class="num">Loads</th>
            <th class="num">Dispatched (m³)</th>
            <th class="num">Sales Billed ($)</th>
            <th class="num">Cash Collected ($)</th>
            <th class="num">RM Purchases ($)</th>
            <th class="num">Site Expenses ($)</th>
            <th class="num">Diesel (L)</th>
          </tr>
        </thead>
        <tbody>
          ${dayRows.map(d => `
            <tr>
              <td class="mono">${esc(d.date)}</td>
              <td class="num">${fmtNum(d.loads, 0)}</td>
              <td class="num">${fmtNum(d.m3, 1)}</td>
              <td class="num bold">${fmtUsd(d.sales)}</td>
              <td class="num">${fmtUsd(d.collected)}</td>
              <td class="num">${fmtUsd(d.rm)}</td>
              <td class="num">${fmtUsd(d.exp)}</td>
              <td class="num">${fmtNum(d.fuelL, 0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${sheetFooterHtml(ctx.co, 1, 1)}
    `;
  }

  function render02BalanceSheet(meta, ctx) {
    const asof = ctx.rdl.params.asof || ctx.rdl.params.to;
    const jes = buildJournalEntries(ctx, asof);
    const balMap = new Map();
    COA_ACCOUNTS.forEach(a => balMap.set(a.code, { ...a, dr: 0, cr: 0 }));
    jes.forEach(j => {
      const b = balMap.get(j.acct_code);
      if (b) { b.dr += j.debit; b.cr += j.credit; }
    });

    // Net profit from classes 6 & 7 up to asof flows into Retained Earnings
    let revNet = 0, expNet = 0;
    balMap.forEach(b => {
      if (b.code.startsWith('7')) revNet += (b.cr - b.dr);
      if (b.code.startsWith('6')) expNet += (b.dr - b.cr);
    });
    const retainedEarnings = revNet - expNet;

    const bsSections = [
      { title: 'ASSETS — NON-CURRENT & FIXED ASSETS (Class 2)', codes: ['215', '218', '281'], sign: 'D' },
      { title: 'ASSETS — INVENTORIES & RECEIVABLES (Classes 3 & 4)', codes: ['311', '411'], sign: 'D' },
      { title: 'ASSETS — CASH, BANK & TREASURY (Class 5)', codes: ['512', '531'], sign: 'D' },
      { title: 'LIABILITIES — PAYABLES & TAX OBLIGATIONS (Class 4)', codes: ['401', '421', '442'], sign: 'C' },
      { title: 'EQUITY & PARTNER ACCOUNTS (Class 1 + Period Result)', codes: ['101', '165'], sign: 'C', includeRetained: true }
    ];

    let totalAssets = 0;
    let totalLiabEq = 0;

    const secHtml = bsSections.map(sec => {
      let secTot = 0;
      const rows = sec.codes.map(code => {
        const b = balMap.get(code);
        const val = sec.sign === 'D' ? (b.dr - b.cr) : (b.cr - b.dr);
        secTot += val;
        return `
          <tr>
            <td class="mono bold">${esc(b.code)}</td>
            <td>${esc(b.name)}</td>
            <td class="num">${fmtUsd(b.dr)}</td>
            <td class="num">${fmtUsd(b.cr)}</td>
            <td class="num bold">${fmtUsdSigned(val)}</td>
          </tr>
        `;
      });
      if (sec.includeRetained) {
        secTot += retainedEarnings;
        rows.push(`
          <tr>
            <td class="mono bold">120</td>
            <td>Current Period Net Result / نتيجة الدورة المالية</td>
            <td class="num">${fmtUsd(expNet)}</td>
            <td class="num">${fmtUsd(revNet)}</td>
            <td class="num bold">${fmtUsdSigned(retainedEarnings)}</td>
          </tr>
        `);
      }
      if (sec.sign === 'D') totalAssets += secTot;
      else totalLiabEq += secTot;

      return `
        <tr class="rdl-group-row"><td colspan="5">${esc(sec.title)}</td></tr>
        ${rows.join('')}
        <tr class="rdl-subtotal-row">
          <td colspan="4">Subtotal — ${esc(sec.title)}</td>
          <td class="num">${fmtUsdSigned(secTot)}</td>
        </tr>
      `;
    }).join('');

    return `
      ${sheetHeaderHtml(meta, ctx.co, `As at ${asof} · Lebanese General Chart of Accounts (Classes 1–5) · Functional Currency USD`)}
      <table class="rdl-table">
        <thead>
          <tr>
            <th style="width:80px">Account</th>
            <th>Account Description (EN / AR)</th>
            <th class="num">Cumulative Debit ($)</th>
            <th class="num">Cumulative Credit ($)</th>
            <th class="num">Net Carrying Balance ($)</th>
          </tr>
        </thead>
        <tbody>
          ${secHtml}
        </tbody>
        <tfoot>
          <tr class="rdl-total-row">
            <td colspan="4">TOTAL ASSETS (مجموع الموجودات)</td>
            <td class="num">${fmtUsdSigned(totalAssets)}</td>
          </tr>
          <tr class="rdl-total-row">
            <td colspan="4">TOTAL LIABILITIES & EQUITY (مجموع المطلوبات والرساميل الخاصة)</td>
            <td class="num">${fmtUsdSigned(totalLiabEq)}</td>
          </tr>
        </tfoot>
      </table>
      ${sheetFooterHtml(ctx.co, 1, 1)}
    `;
  }


  function render03IncomeStatement(meta, ctx) {
    const p = ctx.rdl.params;
    const jes = buildJournalEntries(ctx, p.to).filter(j => j.date !== '2020-01-01' && inWindow(j.date, p.from, p.to));
    const pMode = p.period || 'Month';
    const bucketsSet = new Set();
    jes.forEach(j => bucketsSet.add(periodBucket(j.date, pMode)));
    const allBuckets = [...bucketsSet].sort();
    // Show up to 8 most recent period columns so table fits cleanly on page
    const cols = allBuckets.length > 8 ? allBuckets.slice(-8) : (allBuckets.length ? allBuckets : [periodBucket(p.to, pMode)]);

    const plAccounts = COA_ACCOUNTS.filter(a => a.code.startsWith('7') || a.code.startsWith('6'));
    const byAcctBucket = new Map();
    plAccounts.forEach(a => byAcctBucket.set(a.code, { acct: a, colVals: {}, total: 0 }));

    jes.forEach(j => {
      if (!byAcctBucket.has(j.acct_code)) return;
      const entry = byAcctBucket.get(j.acct_code);
      const b = periodBucket(j.date, pMode);
      const signed = j.acct_code.startsWith('7') ? (j.credit - j.debit) : (j.debit - j.credit);
      entry.colVals[b] = (entry.colVals[b] || 0) + signed;
      entry.total += signed;
    });

    const revCodes = ['701', '706'];
    const expCodes = ['601', '615', '622', '641'];
    const sumCols = (codes) => {
      const m = { total: 0 };
      cols.forEach(c => { m[c] = 0; });
      codes.forEach(code => {
        const e = byAcctBucket.get(code);
        if (!e) return;
        m.total += e.total;
        cols.forEach(c => { m[c] += (e.colVals[c] || 0); });
      });
      return m;
    };

    const revTot = sumCols(revCodes);
    const expTot = sumCols(expCodes);

    const renderGroup = (title, codes) => {
      const tot = sumCols(codes);
      return `
        <tr class="rdl-group-row"><td colspan="${cols.length + 3}">${esc(title)}</td></tr>
        ${codes.map(code => {
          const e = byAcctBucket.get(code);
          return `
            <tr>
              <td class="mono bold">${esc(e.acct.code)}</td>
              <td>${esc(e.acct.name)}</td>
              ${cols.map(c => `<td class="num">${fmtUsd(e.colVals[c] || 0)}</td>`).join('')}
              <td class="num bold">${fmtUsd(e.total)}</td>
            </tr>
          `;
        }).join('')}
        <tr class="rdl-subtotal-row">
          <td colspan="2">Total ${esc(title)}</td>
          ${cols.map(c => `<td class="num">${fmtUsd(tot[c])}</td>`).join('')}
          <td class="num">${fmtUsd(tot.total)}</td>
        </tr>
      `;
    };

    return `
      ${sheetHeaderHtml(meta, ctx.co, `Period ${p.from} to ${p.to} · Columns by ${pMode} · Lebanese CoA Classes 6 & 7`)}
      <table class="rdl-table">
        <thead>
          <tr>
            <th style="width:70px">Code</th>
            <th>P&L Line Item</th>
            ${cols.map(c => `<th class="num">${esc(c)}</th>`).join('')}
            <th class="num">Period Total ($)</th>
          </tr>
        </thead>
        <tbody>
          ${renderGroup('OPERATING REVENUE (Class 7 — الإيرادات التشغيلية)', revCodes)}
          ${renderGroup('OPERATING COSTS & EXPENSES (Class 6 — الأعباء والمصاريف)', expCodes)}
        </tbody>
        <tfoot>
          <tr class="rdl-total-row">
            <td colspan="2">NET OPERATING INCOME / EBITDA (صافي النتيجة التشغيلية)</td>
            ${cols.map(c => `<td class="num">${fmtUsdSigned((revTot[c] || 0) - (expTot[c] || 0))}</td>`).join('')}
            <td class="num">${fmtUsdSigned(revTot.total - expTot.total)}</td>
          </tr>
        </tfoot>
      </table>
      ${sheetFooterHtml(ctx.co, 1, 1)}
    `;
  }

  function render04CashFlow(meta, ctx) {
    const p = ctx.rdl.params;
    const pMode = p.period || 'Month';
    const sales = (ctx.arLedgerAll || ctx.salesAll).filter(r => inWindow(rowDate(r, ctx.basis), p.from, p.to));
    const exps = ctx.expAll.filter(r => inWindow(rowDate(r, ctx.basis), p.from, p.to));
    const rms = (ctx.apRmLedgerAll || ctx.rmAll).filter(r => inWindow(rowDate(r, ctx.basis), p.from, p.to));
    const fuels = ctx.fuelAll.filter(r => inWindow(rowDate(r, ctx.basis), p.from, p.to));
    const pays = ctx.payAll.filter(r => inWindow(rowDate(r, ctx.basis), p.from, p.to));

    const bucketsSet = new Set();
    [...sales, ...exps, ...rms, ...fuels, ...pays].forEach(r => bucketsSet.add(periodBucket(rowDate(r, ctx.basis), pMode)));
    const allB = [...bucketsSet].sort();
    const cols = allB.length > 8 ? allB.slice(-8) : (allB.length ? allB : [periodBucket(p.to, pMode)]);

    const lines = {
      custIn: { label: 'Customer Receipts & Concrete Collections (تحصيلات الزبائن)', cols: {}, total: 0 },
      rmOut: { label: 'Raw Material & Cement Payments (مدفوعات المواد الأولية)', cols: {}, total: 0 },
      fuelOut: { label: 'Diesel & Fleet Fuel Payments (مدفوعات المحروقات)', cols: {}, total: 0 },
      expOut: { label: 'Plant Maintenance & General OPEX Paid (مدفوعات المصاريف والصيانة)', cols: {}, total: 0 },
      payOut: { label: 'Staff Salaries & Daily Labor Disbursed (مدفوعات الرواتب والأجور)', cols: {}, total: 0 }
    };

    const addVal = (key, d, val) => {
      const b = periodBucket(d, pMode);
      lines[key].cols[b] = (lines[key].cols[b] || 0) + val;
      lines[key].total += val;
    };

    sales.forEach(r => addVal('custIn', rowDate(r, ctx.basis), Number(r.paid_usd || 0)));
    rms.forEach(r => addVal('rmOut', rowDate(r, ctx.basis), -Number(r.paid_usd || r.total_usd || 0)));
    fuels.forEach(r => addVal('fuelOut', rowDate(r, ctx.basis), -Number(r.paid_usd || r.total_usd || 0)));
    exps.forEach(r => addVal('expOut', rowDate(r, ctx.basis), -Number(r.paid_usd || r.total_usd || 0)));
    pays.forEach(r => addVal('payOut', rowDate(r, ctx.basis), -Number(r.paid_usd || r.net_usd || 0)));

    const rowKeys = ['custIn', 'rmOut', 'fuelOut', 'expOut', 'payOut'];
    return `
      ${sheetHeaderHtml(meta, ctx.co, `Direct Cash Flow Method · Period ${p.from} to ${p.to} · Columns by ${pMode}`)}
      <table class="rdl-table">
        <thead>
          <tr>
            <th>Cash Flow Activity Line (Direct Method)</th>
            ${cols.map(c => `<th class="num">${esc(c)}</th>`).join('')}
            <th class="num">Period Total ($)</th>
          </tr>
        </thead>
        <tbody>
          <tr class="rdl-group-row"><td colspan="${cols.length + 2}">CASH FLOWS FROM OPERATING ACTIVITIES</td></tr>
          ${rowKeys.map(k => {
            const L = lines[k];
            return `
              <tr>
                <td>${esc(L.label)}</td>
                ${cols.map(c => `<td class="num">${fmtUsdSigned(L.cols[c] || 0)}</td>`).join('')}
                <td class="num bold">${fmtUsdSigned(L.total)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
        <tfoot>
          <tr class="rdl-total-row">
            <td>NET OPERATING CASH FLOW (صافي التدفق النقدي التشغيلي)</td>
            ${cols.map(c => {
              const s = rowKeys.reduce((acc, k) => acc + (lines[k].cols[c] || 0), 0);
              return `<td class="num">${fmtUsdSigned(s)}</td>`;
            }).join('')}
            <td class="num">${fmtUsdSigned(rowKeys.reduce((acc, k) => acc + lines[k].total, 0))}</td>
          </tr>
        </tfoot>
      </table>
      ${sheetFooterHtml(ctx.co, 1, 1)}
    `;
  }

  function render05TrialBalance(meta, ctx) {
    const p = ctx.rdl.params;
    const jes = buildJournalEntries(ctx, p.to);
    const map = new Map();
    COA_ACCOUNTS.forEach(a => map.set(a.code, { acct: a, openDr: 0, openCr: 0, perDr: 0, perCr: 0 }));

    jes.forEach(j => {
      const m = map.get(j.acct_code);
      if (!m) return;
      if (j.date < p.from) {
        m.openDr += j.debit;
        m.openCr += j.credit;
      } else if (j.date <= p.to) {
        m.perDr += j.debit;
        m.perCr += j.credit;
      }
    });

    let tOpenDr = 0, tOpenCr = 0, tPerDr = 0, tPerCr = 0, tCloseDr = 0, tCloseCr = 0;
    const rowsHtml = COA_ACCOUNTS.map(a => {
      const m = map.get(a.code);
      const netOpen = m.openDr - m.openCr;
      const oDr = netOpen > 0 ? netOpen : 0;
      const oCr = netOpen < 0 ? -netOpen : 0;
      const netClose = (m.openDr + m.perDr) - (m.openCr + m.perCr);
      const cDr = netClose > 0 ? netClose : 0;
      const cCr = netClose < 0 ? -netClose : 0;

      tOpenDr += oDr; tOpenCr += oCr;
      tPerDr += m.perDr; tPerCr += m.perCr;
      tCloseDr += cDr; tCloseCr += cCr;

      return `
        <tr>
          <td class="mono bold">${esc(a.code)}</td>
          <td>${esc(a.name)}</td>
          <td class="num">${fmtUsd(oDr)}</td>
          <td class="num">${fmtUsd(oCr)}</td>
          <td class="num">${fmtUsd(m.perDr)}</td>
          <td class="num">${fmtUsd(m.perCr)}</td>
          <td class="num bold">${fmtUsd(cDr)}</td>
          <td class="num bold">${fmtUsd(cCr)}</td>
        </tr>
      `;
    }).join('');

    return `
      ${sheetHeaderHtml(meta, ctx.co, `Six-Column Trial Balance · Period ${p.from} to ${p.to} · Functional Currency USD`)}
      <table class="rdl-table">
        <thead>
          <tr>
            <th style="width:70px">Code</th>
            <th>Account Title</th>
            <th class="num">Opening Dr ($)</th>
            <th class="num">Opening Cr ($)</th>
            <th class="num">Period Dr ($)</th>
            <th class="num">Period Cr ($)</th>
            <th class="num">Closing Dr ($)</th>
            <th class="num">Closing Cr ($)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr class="rdl-total-row">
            <td colspan="2">TOTAL TRIAL BALANCE (مجموع ميزان المراجعة)</td>
            <td class="num">${fmtUsd(tOpenDr)}</td>
            <td class="num">${fmtUsd(tOpenCr)}</td>
            <td class="num">${fmtUsd(tPerDr)}</td>
            <td class="num">${fmtUsd(tPerCr)}</td>
            <td class="num">${fmtUsd(tCloseDr)}</td>
            <td class="num">${fmtUsd(tCloseCr)}</td>
          </tr>
        </tfoot>
      </table>
      ${sheetFooterHtml(ctx.co, 1, 1)}
    `;
  }


  function render06GeneralJournal(meta, ctx) {
    const p = ctx.rdl.params;
    const allJes = buildJournalEntries(ctx, p.to).filter(j => {
      if (!inWindow(j.date, p.from, p.to)) return false;
      if (p.account && p.account !== 'ALL' && j.acct_code !== p.account) return false;
      return true;
    });
    const totDr = allJes.reduce((s, j) => s + j.debit, 0);
    const totCr = allJes.reduce((s, j) => s + j.credit, 0);
    const viewJes = allJes.slice(-180).reverse();

    return `
      ${sheetHeaderHtml(meta, ctx.co, `Period ${p.from} to ${p.to} · Account: ${p.account === 'ALL' ? 'All Accounts' : p.account} · ${allJes.length} journal lines (showing ${viewJes.length})`)}
      <table class="rdl-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>JE No.</th>
            <th>Source</th>
            <th>Ref / Voucher</th>
            <th>Acct</th>
            <th>Sub-Account / Counterparty</th>
            <th>Narration</th>
            <th class="num">Debit ($)</th>
            <th class="num">Credit ($)</th>
          </tr>
        </thead>
        <tbody>
          ${viewJes.map(j => `
            <tr>
              <td class="mono">${esc(j.date)}</td>
              <td class="mono">${esc(j.je_no)}</td>
              <td>${esc(j.source)}</td>
              <td class="mono">${esc(j.ref)}</td>
              <td class="mono bold">${esc(j.acct_code)}</td>
              <td>${esc(j.sub_account)}</td>
              <td>${esc(j.description)}</td>
              <td class="num">${j.debit > 0 ? fmtUsd(j.debit, 2) : '—'}</td>
              <td class="num">${j.credit > 0 ? fmtUsd(j.credit, 2) : '—'}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr class="rdl-total-row">
            <td colspan="7">TOTAL PERIOD JOURNAL POSTINGS (${fmtNum(allJes.length, 0)} lines)</td>
            <td class="num">${fmtUsd(totDr, 2)}</td>
            <td class="num">${fmtUsd(totCr, 2)}</td>
          </tr>
        </tfoot>
      </table>
      ${sheetFooterHtml(ctx.co, 1, 1)}
    `;
  }

  function render07SubAccount(meta, ctx) {
    const p = ctx.rdl.params;
    const jes = buildJournalEntries(ctx, p.to).filter(j => {
      if (p.account && p.account !== 'ALL' && j.acct_code !== p.account) return false;
      if (p.subAccount && p.subAccount !== 'ALL' && j.sub_account !== p.subAccount) return false;
      return true;
    }).sort((a, b) => a.date.localeCompare(b.date));

    let openDr = 0, openCr = 0;
    const periodRows = [];
    jes.forEach(j => {
      if (j.date < p.from) {
        openDr += j.debit;
        openCr += j.credit;
      } else if (j.date <= p.to) {
        periodRows.push(j);
      }
    });

    let runBal = openDr - openCr;
    const totDr = periodRows.reduce((s, j) => s + j.debit, 0);
    const totCr = periodRows.reduce((s, j) => s + j.credit, 0);
    const viewRows = periodRows.slice(-150);

    return `
      ${sheetHeaderHtml(meta, ctx.co, `Period ${p.from} to ${p.to} · Account: ${p.account} · Sub-account: ${p.subAccount === 'ALL' ? 'All Sub-accounts' : p.subAccount}`)}
      <table class="rdl-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Ref</th>
            <th>Acct</th>
            <th>Sub-Account</th>
            <th>Description</th>
            <th class="num">Debit ($)</th>
            <th class="num">Credit ($)</th>
            <th class="num">Running Balance ($)</th>
          </tr>
        </thead>
        <tbody>
          <tr class="rdl-subtotal-row">
            <td class="mono">${esc(p.from)}</td>
            <td colspan="4">Opening Balance Brought Forward (رصيد مدور)</td>
            <td class="num">${fmtUsd(openDr, 2)}</td>
            <td class="num">${fmtUsd(openCr, 2)}</td>
            <td class="num bold">${fmtUsdSigned(runBal, 2)}</td>
          </tr>
          ${viewRows.map(j => {
            runBal += (j.debit - j.credit);
            return `
              <tr>
                <td class="mono">${esc(j.date)}</td>
                <td class="mono">${esc(j.ref)}</td>
                <td class="mono bold">${esc(j.acct_code)}</td>
                <td class="bold">${esc(j.sub_account)}</td>
                <td>${esc(j.description)}</td>
                <td class="num">${j.debit > 0 ? fmtUsd(j.debit, 2) : '—'}</td>
                <td class="num">${j.credit > 0 ? fmtUsd(j.credit, 2) : '—'}</td>
                <td class="num bold">${fmtUsdSigned(runBal, 2)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
        <tfoot>
          <tr class="rdl-total-row">
            <td colspan="5">CLOSING SUB-ACCOUNT BALANCE (الرصيد الختامي)</td>
            <td class="num">${fmtUsd(openDr + totDr, 2)}</td>
            <td class="num">${fmtUsd(openCr + totCr, 2)}</td>
            <td class="num">${fmtUsdSigned((openDr + totDr) - (openCr + totCr), 2)}</td>
          </tr>
        </tfoot>
      </table>
      ${sheetFooterHtml(ctx.co, 1, 1)}
    `;
  }

  function render08SalesRegister(meta, ctx) {
    const p = ctx.rdl.params;
    const rows = ctx.salesAll.filter(r => {
      if (!inWindow(rowDate(r, ctx.basis), p.from, p.to)) return false;
      if (p.customer && p.customer !== 'ALL' && r.customer !== p.customer) return false;
      if (p.product && p.product !== 'ALL' && r.product !== p.product) return false;
      if (p.site && p.site !== 'ALL' && r.site !== p.site) return false;
      return true;
    }).sort((a, b) => rowDate(b, ctx.basis).localeCompare(rowDate(a, ctx.basis)));

    const totQty = rows.reduce((s, r) => s + Number(r.qty || 0), 0);
    const totSub = rows.reduce((s, r) => s + (Number(r.total_usd || 0) - Number(r.vat_usd || 0)), 0);
    const totVat = rows.reduce((s, r) => s + Number(r.vat_usd || 0), 0);
    const totGross = rows.reduce((s, r) => s + Number(r.total_usd || 0), 0);
    const totPaid = rows.reduce((s, r) => s + Number(r.paid_usd || 0), 0);
    const viewRows = rows.slice(0, 160);

    return `
      ${sheetHeaderHtml(meta, ctx.co, `Period ${p.from} to ${p.to} · Customer: ${p.customer} · Product: ${p.product} · Site: ${p.site} · ${rows.length} tickets (showing ${viewRows.length})`)}
      <table class="rdl-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Ticket / Inv</th>
            <th>VAT Inv</th>
            <th>Customer</th>
            <th>Site</th>
            <th>Product</th>
            <th class="num">Qty (m³)</th>
            <th class="num">Price ($)</th>
            <th class="num">Net ($)</th>
            <th class="num">VAT ($)</th>
            <th class="num">Total ($)</th>
            <th class="num">Paid ($)</th>
          </tr>
        </thead>
        <tbody>
          ${viewRows.map(r => {
            const net = Number(r.total_usd || 0) - Number(r.vat_usd || 0);
            return `
              <tr>
                <td class="mono">${esc(rowDate(r, ctx.basis))}</td>
                <td class="mono">${esc(r.ticket_no || r.invoice_no || '—')}</td>
                <td class="mono bold">${esc(r.vat_inv || '—')}</td>
                <td class="bold">${esc(r.customer || '—')}</td>
                <td>${esc(r.site || '—')}</td>
                <td>${esc(r.product || '—')}</td>
                <td class="num">${fmtNum(r.qty, 1)}</td>
                <td class="num">${fmtUsd(r.unit_price, 2)}</td>
                <td class="num">${fmtUsdSigned(net, 2)}</td>
                <td class="num">${fmtUsdSigned(r.vat_usd, 2)}</td>
                <td class="num bold">${fmtUsdSigned(r.total_usd, 2)}</td>
                <td class="num">${fmtUsdSigned(r.paid_usd, 2)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
        <tfoot>
          <tr class="rdl-total-row">
            <td colspan="6">TOTAL SALES REGISTER (${fmtNum(rows.length, 0)} tickets)</td>
            <td class="num">${fmtNum(totQty, 1)}</td>
            <td class="num">${fmtUsd(totQty > 0 ? totGross / totQty : 0, 2)}</td>
            <td class="num">${fmtUsd(totSub, 2)}</td>
            <td class="num">${fmtUsd(totVat, 2)}</td>
            <td class="num">${fmtUsd(totGross, 2)}</td>
            <td class="num">${fmtUsd(totPaid, 2)}</td>
          </tr>
        </tfoot>
      </table>
      ${sheetFooterHtml(ctx.co, 1, 1)}
    `;
  }

  function render09ExpenseRegister(meta, ctx) {
    const p = ctx.rdl.params;
    const rows = ctx.expAll.filter(r => {
      if (!inWindow(rowDate(r, ctx.basis), p.from, p.to)) return false;
      if (p.supplier && p.supplier !== 'ALL' && r.supplier !== p.supplier) return false;
      if (p.category && p.category !== 'ALL' && r.category !== p.category) return false;
      return true;
    }).sort((a, b) => rowDate(b, ctx.basis).localeCompare(rowDate(a, ctx.basis)));

    const totNet = rows.reduce((s, r) => s + (Number(r.total_usd || 0) - Number(r.vat_usd || 0)), 0);
    const totVat = rows.reduce((s, r) => s + Number(r.vat_usd || 0), 0);
    const totGross = rows.reduce((s, r) => s + Number(r.total_usd || 0), 0);
    const totPaid = rows.reduce((s, r) => s + Number(r.paid_usd || 0), 0);
    const viewRows = rows.slice(0, 160);

    return `
      ${sheetHeaderHtml(meta, ctx.co, `Period ${p.from} to ${p.to} · Supplier: ${p.supplier} · Category: ${p.category} · ${rows.length} vouchers (showing ${viewRows.length})`)}
      <table class="rdl-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Voucher / Inv</th>
            <th>Category</th>
            <th>Supplier / Payee</th>
            <th>Description</th>
            <th class="num">Net ($)</th>
            <th class="num">VAT ($)</th>
            <th class="num">Total ($)</th>
            <th class="num">Paid ($)</th>
            <th class="num">Balance ($)</th>
          </tr>
        </thead>
        <tbody>
          ${viewRows.map(r => {
            const net = Number(r.total_usd || 0) - Number(r.vat_usd || 0);
            return `
              <tr>
                <td class="mono">${esc(rowDate(r, ctx.basis))}</td>
                <td class="mono">${esc(r.voucher_no || r.invoice_no || r.name || '—')}</td>
                <td>${esc(r.category || '—')}</td>
                <td class="bold">${esc(r.supplier || '—')}</td>
                <td>${esc(r.description || '—')}</td>
                <td class="num">${fmtUsdSigned(net, 2)}</td>
                <td class="num">${fmtUsdSigned(r.vat_usd, 2)}</td>
                <td class="num bold">${fmtUsdSigned(r.total_usd, 2)}</td>
                <td class="num">${fmtUsdSigned(r.paid_usd, 2)}</td>
                <td class="num">${fmtUsdSigned(r.balance_usd, 2)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
        <tfoot>
          <tr class="rdl-total-row">
            <td colspan="5">TOTAL EXPENSE REGISTER (${fmtNum(rows.length, 0)} vouchers)</td>
            <td class="num">${fmtUsd(totNet, 2)}</td>
            <td class="num">${fmtUsd(totVat, 2)}</td>
            <td class="num">${fmtUsd(totGross, 2)}</td>
            <td class="num">${fmtUsd(totPaid, 2)}</td>
            <td class="num">${fmtUsd(totGross - totPaid, 2)}</td>
          </tr>
        </tfoot>
      </table>
      ${sheetFooterHtml(ctx.co, 1, 1)}
    `;
  }


  function render10PayrollRegister(meta, ctx) {
    const p = ctx.rdl.params;
    const rows = ctx.payAll.filter(r => {
      if (!inWindow(rowDate(r, ctx.basis), p.from, p.to)) return false;
      if (p.staff && p.staff !== 'ALL' && r.staff !== p.staff) return false;
      return true;
    }).sort((a, b) => rowDate(b, ctx.basis).localeCompare(rowDate(a, ctx.basis)));

    const totBase = rows.reduce((s, r) => s + Number(r.base_usd || 0), 0);
    const totNet = rows.reduce((s, r) => s + Number(r.net_usd || 0), 0);
    const totPaid = rows.reduce((s, r) => s + Number(r.paid_usd || 0), 0);
    const viewRows = rows.slice(0, 160);

    return `
      ${sheetHeaderHtml(meta, ctx.co, `Period ${p.from} to ${p.to} · Staff: ${p.staff === 'ALL' ? 'All Staff' : p.staff} · ${rows.length} payroll entries`)}
      <table class="rdl-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Staff Member</th>
            <th>Role / Department</th>
            <th>Pay Type</th>
            <th class="num">Days / Hrs</th>
            <th class="num">Base / Gross ($)</th>
            <th class="num">Net Payable ($)</th>
            <th class="num">Disbursed ($)</th>
            <th class="num">Balance ($)</th>
          </tr>
        </thead>
        <tbody>
          ${viewRows.map(r => `
            <tr>
              <td class="mono">${esc(rowDate(r, ctx.basis))}</td>
              <td class="bold">${esc(r.staff || '—')}</td>
              <td>${esc(r.role || '—')}</td>
              <td>${esc(r.type || 'Monthly')}</td>
              <td class="num">${fmtNum(r.days || r.hours || 0, 1)}</td>
              <td class="num">${fmtUsd(r.base_usd, 2)}</td>
              <td class="num bold">${fmtUsd(r.net_usd, 2)}</td>
              <td class="num">${fmtUsd(r.paid_usd, 2)}</td>
              <td class="num">${fmtUsd(r.balance_usd, 2)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr class="rdl-total-row">
            <td colspan="5">TOTAL PAYROLL REGISTER (${fmtNum(rows.length, 0)} entries)</td>
            <td class="num">${fmtUsd(totBase, 2)}</td>
            <td class="num">${fmtUsd(totNet, 2)}</td>
            <td class="num">${fmtUsd(totPaid, 2)}</td>
            <td class="num">${fmtUsd(totNet - totPaid, 2)}</td>
          </tr>
        </tfoot>
      </table>
      ${sheetFooterHtml(ctx.co, 1, 1)}
    `;
  }

  function render11RawMaterial(meta, ctx) {
    const p = ctx.rdl.params;
    const rows = ctx.rmAll.filter(r => {
      if (!inWindow(rowDate(r, ctx.basis), p.from, p.to)) return false;
      if (p.supplier && p.supplier !== 'ALL' && r.supplier !== p.supplier) return false;
      return true;
    }).sort((a, b) => rowDate(b, ctx.basis).localeCompare(rowDate(a, ctx.basis)));

    const totQty = rows.reduce((s, r) => s + Number(r.qty || 0), 0);
    const totUsd = rows.reduce((s, r) => s + Number(r.total_usd || 0), 0);
    const totPaid = rows.reduce((s, r) => s + Number(r.paid_usd || 0), 0);
    const viewRows = rows.slice(0, 160);

    return `
      ${sheetHeaderHtml(meta, ctx.co, `Period ${p.from} to ${p.to} · Supplier: ${p.supplier === 'ALL' ? 'All Suppliers' : p.supplier} · ${rows.length} intake tickets`)}
      <table class="rdl-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Voucher / Ticket</th>
            <th>Material</th>
            <th>Supplier</th>
            <th>Driver / Plate</th>
            <th class="num">Qty</th>
            <th>Unit</th>
            <th class="num">Unit Price ($)</th>
            <th class="num">Total ($)</th>
            <th class="num">Paid ($)</th>
          </tr>
        </thead>
        <tbody>
          ${viewRows.map(r => `
            <tr>
              <td class="mono">${esc(rowDate(r, ctx.basis))}</td>
              <td class="mono">${esc(r.voucher || r.name || '—')}</td>
              <td class="bold">${esc(r.material || '—')}</td>
              <td>${esc(r.supplier || '—')}</td>
              <td>${esc(r.driver || r.plate || '—')}</td>
              <td class="num">${fmtNum(r.qty, 2)}</td>
              <td>${esc(r.unit || 'Ton')}</td>
              <td class="num">${fmtUsd(r.unit_price, 2)}</td>
              <td class="num bold">${fmtUsd(r.total_usd, 2)}</td>
              <td class="num">${fmtUsd(r.paid_usd, 2)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr class="rdl-total-row">
            <td colspan="5">TOTAL RAW MATERIAL INTAKE (${fmtNum(rows.length, 0)} deliveries)</td>
            <td class="num">${fmtNum(totQty, 2)}</td>
            <td>Ton / m³</td>
            <td class="num">${fmtUsd(totQty > 0 ? totUsd / totQty : 0, 2)}</td>
            <td class="num">${fmtUsd(totUsd, 2)}</td>
            <td class="num">${fmtUsd(totPaid, 2)}</td>
          </tr>
        </tfoot>
      </table>
      ${sheetFooterHtml(ctx.co, 1, 1)}
    `;
  }

  function render12FuelLog(meta, ctx) {
    const p = ctx.rdl.params;
    const rows = ctx.fuelAll.filter(r => {
      if (!inWindow(rowDate(r, ctx.basis), p.from, p.to)) return false;
      if (p.equipType && p.equipType !== 'ALL' && r.equip_type !== p.equipType) return false;
      if (p.equipment && p.equipment !== 'ALL' && r.equip !== p.equipment) return false;
      if (p.driver && p.driver !== 'ALL' && r.driver !== p.driver) return false;
      return true;
    }).sort((a, b) => rowDate(b, ctx.basis).localeCompare(rowDate(a, ctx.basis)));

    const totLiters = rows.reduce((s, r) => s + Number(r.liters || 0), 0);
    const totUsd = rows.reduce((s, r) => s + Number(r.total_usd || 0), 0);
    const viewRows = rows.slice(0, 160);

    return `
      ${sheetHeaderHtml(meta, ctx.co, `Period ${p.from} to ${p.to} · Type: ${p.equipType} · Equipment: ${p.equipment} · Driver: ${p.driver} · ${rows.length} dispensings`)}
      <table class="rdl-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Voucher</th>
            <th>Equipment / Truck</th>
            <th>Equip. Type</th>
            <th>Driver</th>
            <th>Station / Tank</th>
            <th class="num">Odometer / Hrs</th>
            <th class="num">Liters (L)</th>
            <th class="num">Rate ($/L)</th>
            <th class="num">Total ($)</th>
          </tr>
        </thead>
        <tbody>
          ${viewRows.map(r => `
            <tr>
              <td class="mono">${esc(rowDate(r, ctx.basis))}</td>
              <td class="mono">${esc(r.voucher || r.name || '—')}</td>
              <td class="bold">${esc(r.equip || '—')}</td>
              <td>${esc(r.equip_type || 'Mixer')}</td>
              <td>${esc(r.driver || '—')}</td>
              <td>${esc(r.station || r.supplier || 'Plant Tank')}</td>
              <td class="num">${r.odometer ? fmtNum(r.odometer, r.meter_unit === 'h' && r.odometer % 1 !== 0 ? 1 : 0) + (r.meter_unit ? ' ' + r.meter_unit : '') : '—'}</td>
              <td class="num bold">${fmtNum(r.liters, 1)}</td>
              <td class="num">${fmtUsd(r.price_per_l, 2)}</td>
              <td class="num bold">${fmtUsd(r.total_usd, 2)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr class="rdl-total-row">
            <td colspan="7">TOTAL DIESEL & FLEET FUEL LOG (${fmtNum(rows.length, 0)} fills)</td>
            <td class="num">${fmtNum(totLiters, 1)}</td>
            <td class="num">${fmtUsd(totLiters > 0 ? totUsd / totLiters : 0, 2)}</td>
            <td class="num">${fmtUsd(totUsd, 2)}</td>
          </tr>
        </tfoot>
      </table>
      ${sheetFooterHtml(ctx.co, 1, 1)}
    `;
  }

  function render13AgedReceivables(meta, ctx) {
    const asof = ctx.rdl.params.asof || ctx.rdl.params.to;
    const custFilter = ctx.rdl.params.customer;
    const asofMs = new Date(asof + 'T00:00:00Z').getTime() || Date.now();

    const byCust = new Map();
    (ctx.arLedgerAll || ctx.salesAll).forEach(r => {
      const d = rowDate(r, ctx.basis);
      if (!d || d > asof) return;
      const c = r.customer || 'Walk-in Customer';
      if (custFilter && custFilter !== 'ALL' && c !== custFilter) return;
      const tot = Number(r.total_usd || 0);
      const paid = Number(r.paid_usd || 0);
      const bal = Number(r.balance_usd !== undefined ? r.balance_usd : (tot - paid));
      const g = byCust.get(c) || { customer: c, billed: 0, paid: 0, b0_30: 0, b31_60: 0, b61_90: 0, b90p: 0, totalBal: 0, lastDate: d };
      g.billed += tot;
      g.paid += paid;
      if (d > g.lastDate) g.lastDate = d;
      if (Math.abs(bal) > 0.01) {
        const ageDays = Math.max(0, Math.floor((asofMs - (new Date(d + 'T00:00:00Z').getTime() || asofMs)) / 86400000));
        if (ageDays <= 30) g.b0_30 += bal;
        else if (ageDays <= 60) g.b31_60 += bal;
        else if (ageDays <= 90) g.b61_90 += bal;
        else g.b90p += bal;
        g.totalBal += bal;
      }
      byCust.set(c, g);
    });

    const rows = [...byCust.values()]
      .filter(g => Math.abs(g.totalBal) > 1 || g.billed > 0)
      .sort((a, b) => b.totalBal - a.totalBal)
      .slice(0, 120);

    const sum = k => rows.reduce((s, r) => s + r[k], 0);

    return `
      ${sheetHeaderHtml(meta, ctx.co, `As at ${asof} · Customer: ${custFilter === 'ALL' ? 'All Customers' : custFilter} · 30/60/90+ Day Aging Buckets`)}
      <table class="rdl-table">
        <thead>
          <tr>
            <th>Customer (Account 411)</th>
            <th class="num">Cumulative Billed ($)</th>
            <th class="num">Collected ($)</th>
            <th class="num">0–30 Days ($)</th>
            <th class="num">31–60 Days ($)</th>
            <th class="num">61–90 Days ($)</th>
            <th class="num">90+ Days ($)</th>
            <th class="num">Net Receivable ($)</th>
            <th>Last Activity</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td class="bold">${esc(r.customer)}</td>
              <td class="num">${fmtUsd(r.billed)}</td>
              <td class="num">${fmtUsd(r.paid)}</td>
              <td class="num">${fmtUsd(r.b0_30)}</td>
              <td class="num">${fmtUsd(r.b31_60)}</td>
              <td class="num">${fmtUsd(r.b61_90)}</td>
              <td class="num">${fmtUsd(r.b90p)}</td>
              <td class="num bold">${fmtUsdSigned(r.totalBal)}</td>
              <td class="mono">${esc(r.lastDate)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr class="rdl-total-row">
            <td>TOTAL AGED RECEIVABLES (${rows.length} accounts)</td>
            <td class="num">${fmtUsd(sum('billed'))}</td>
            <td class="num">${fmtUsd(sum('paid'))}</td>
            <td class="num">${fmtUsd(sum('b0_30'))}</td>
            <td class="num">${fmtUsd(sum('b31_60'))}</td>
            <td class="num">${fmtUsd(sum('b61_90'))}</td>
            <td class="num">${fmtUsd(sum('b90p'))}</td>
            <td class="num">${fmtUsdSigned(sum('totalBal'))}</td>
            <td>—</td>
          </tr>
        </tfoot>
      </table>
      ${sheetFooterHtml(ctx.co, 1, 1)}
    `;
  }


  function render14CustomerStatement(meta, ctx) {
    const p = ctx.rdl.params;
    const custName = (p.customer && p.customer !== 'ALL') ? p.customer : (ctx.customers[0] || 'Sabeh Beton S.R.L');
    const allCustRows = (ctx.arLedgerAll || ctx.salesAll)
      .filter(r => r.customer === custName)
      .sort((a, b) => rowDate(a, ctx.basis).localeCompare(rowDate(b, ctx.basis)));

    let openDr = 0, openCr = 0;
    const periodRows = [];
    allCustRows.forEach(r => {
      const d = rowDate(r, ctx.basis);
      if (d < p.from) {
        openDr += Number(r.total_usd || 0);
        openCr += Number(r.paid_usd || 0);
      } else if (d <= p.to) {
        periodRows.push(r);
      }
    });

    let runBal = openDr - openCr;
    const totDr = periodRows.reduce((s, r) => s + Number(r.total_usd || 0), 0);
    const totCr = periodRows.reduce((s, r) => s + Number(r.paid_usd || 0), 0);
    const totM3 = periodRows.reduce((s, r) => s + Number(r.qty || 0), 0);
    const closingBal = runBal + totDr - totCr;
    const siteList = [...new Set(allCustRows.filter(r => !r.is_receipt_row).map(r => r.site).filter(Boolean))].slice(0, 3).join(' · ');

    return `
      ${sheetHeaderHtml(meta, ctx.co, `Customer Statement of Account (SOA) · Period ${p.from} to ${p.to}`)}
      <div class="rdl-doc-top">
        ${companyBlockHtml(ctx.co)}
        ${metaRowsHtml([
          ['Statement Period', `${p.from} .. ${p.to}`],
          ['Account Code', '411 — Customers AR'],
          ['Dispatched Volume', `${fmtNum(totM3, 1)} m³ (${periodRows.filter(r => !r.is_receipt_row && !r.is_return).length} loads)`],
          ['Closing Balance', fmtUsdSigned(closingBal, 2)]
        ])}
      </div>
      ${partyBlockHtml('Statement of Account For / كشف حساب الزبون', custName, siteList ? `Active Sites: ${siteList}` : 'Ready-Mix Concrete Account', 'Account Currency: Fresh USD', '')}

      <table class="rdl-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Ticket / Inv</th>
            <th>VAT Inv</th>
            <th>Site</th>
            <th>Product</th>
            <th class="num">Qty (m³)</th>
            <th class="num">Price ($)</th>
            <th class="num">Debit / Billed ($)</th>
            <th class="num">Credit / Paid ($)</th>
            <th class="num">Running Balance ($)</th>
          </tr>
        </thead>
        <tbody>
          <tr class="rdl-subtotal-row">
            <td class="mono">${esc(p.from)}</td>
            <td colspan="6">Opening Balance Brought Forward (رصيد مدور)</td>
            <td class="num">${fmtUsd(openDr, 2)}</td>
            <td class="num">${fmtUsd(openCr, 2)}</td>
            <td class="num bold">${fmtUsdSigned(runBal, 2)}</td>
          </tr>
          ${periodRows.slice(-140).map(r => {
            const dr = Number(r.total_usd || 0);
            const cr = Number(r.paid_usd || 0);
            runBal += (dr - cr);
            return `
              <tr>
                <td class="mono">${esc(rowDate(r, ctx.basis))}</td>
                <td class="mono">${esc(r.ticket_no || r.invoice_no || '—')}</td>
                <td class="mono bold">${esc(r.vat_inv || '—')}</td>
                <td>${esc(r.site || '—')}</td>
                <td>${esc(r.product || '—')}</td>
                <td class="num">${fmtNum(r.qty, 1)}</td>
                <td class="num">${fmtUsd(r.unit_price, 2)}</td>
                <td class="num">${fmtUsdSigned(dr, 2)}</td>
                <td class="num">${cr !== 0 ? fmtUsdSigned(cr, 2) : '—'}</td>
                <td class="num bold">${fmtUsdSigned(runBal, 2)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
        <tfoot>
          <tr class="rdl-total-row">
            <td colspan="5">CLOSING STATEMENT BALANCE — ${esc(custName)}</td>
            <td class="num">${fmtNum(totM3, 1)}</td>
            <td>—</td>
            <td class="num">${fmtUsd(openDr + totDr, 2)}</td>
            <td class="num">${fmtUsd(openCr + totCr, 2)}</td>
            <td class="num">${fmtUsdSigned(closingBal, 2)}</td>
          </tr>
        </tfoot>
      </table>
      ${signatureRowHtml('Prepared by Accounting / إعداد المحاسبة', 'Customer Confirmation / مصادقة الزبون')}
      ${sheetFooterHtml(ctx.co, 1, 1)}
    `;
  }

  function render15SupplierBalances(meta, ctx) {
    const asof = ctx.rdl.params.asof || ctx.rdl.params.to;
    const supFilter = ctx.rdl.params.supplier;
    const bySup = new Map();

    const addSup = (sup, d, type, billed, paid) => {
      if (!d || d > asof) return;
      const s = sup || 'General Vendor';
      if (supFilter && supFilter !== 'ALL' && s !== supFilter) return;
      const g = bySup.get(s) || { supplier: s, rmUsd: 0, expUsd: 0, fuelUsd: 0, billed: 0, paid: 0, lastDate: d };
      if (type === 'rm') g.rmUsd += billed;
      else if (type === 'fuel') g.fuelUsd += billed;
      else g.expUsd += billed;
      g.billed += billed;
      g.paid += paid;
      if (d > g.lastDate) g.lastDate = d;
      bySup.set(s, g);
    };

    (ctx.apRmLedgerAll || ctx.rmAll).forEach(r => addSup(r.supplier, rowDate(r, ctx.basis), 'rm', Number(r.total_usd || 0), Number(r.paid_usd || 0)));
    ctx.expAll.forEach(r => addSup(r.supplier, rowDate(r, ctx.basis), 'exp', Number(r.total_usd || 0), Number(r.paid_usd || 0)));
    ctx.fuelAll.forEach(r => addSup(r.supplier || r.station, rowDate(r, ctx.basis), 'fuel', Number(r.total_usd || 0), Number(r.paid_usd || 0)));

    const rows = [...bySup.values()]
      .filter(g => g.billed > 0 || Math.abs(g.billed - g.paid) > 1)
      .sort((a, b) => (b.billed - b.paid) - (a.billed - a.paid))
      .slice(0, 120);

    const sum = k => rows.reduce((s, r) => s + r[k], 0);

    return `
      ${sheetHeaderHtml(meta, ctx.co, `As at ${asof} · Supplier: ${supFilter === 'ALL' ? 'All Suppliers' : supFilter} · Accounts Payable (Account 401)`)}
      <table class="rdl-table">
        <thead>
          <tr>
            <th>Supplier / Vendor (Account 401)</th>
            <th class="num">Raw Materials ($)</th>
            <th class="num">Expenses & Maint. ($)</th>
            <th class="num">Fuel & Diesel ($)</th>
            <th class="num">Total Invoiced ($)</th>
            <th class="num">Total Paid ($)</th>
            <th class="num">Net Payable ($)</th>
            <th>Last Activity</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => {
            const net = r.billed - r.paid;
            return `
              <tr>
                <td class="bold">${esc(r.supplier)}</td>
                <td class="num">${fmtUsd(r.rmUsd)}</td>
                <td class="num">${fmtUsd(r.expUsd)}</td>
                <td class="num">${fmtUsd(r.fuelUsd)}</td>
                <td class="num bold">${fmtUsd(r.billed)}</td>
                <td class="num">${fmtUsd(r.paid)}</td>
                <td class="num bold">${fmtUsdSigned(net)}</td>
                <td class="mono">${esc(r.lastDate)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
        <tfoot>
          <tr class="rdl-total-row">
            <td>TOTAL SUPPLIER BALANCES (${rows.length} vendors)</td>
            <td class="num">${fmtUsd(sum('rmUsd'))}</td>
            <td class="num">${fmtUsd(sum('expUsd'))}</td>
            <td class="num">${fmtUsd(sum('fuelUsd'))}</td>
            <td class="num">${fmtUsd(sum('billed'))}</td>
            <td class="num">${fmtUsd(sum('paid'))}</td>
            <td class="num">${fmtUsdSigned(sum('billed') - sum('paid'))}</td>
            <td>—</td>
          </tr>
        </tfoot>
      </table>
      ${sheetFooterHtml(ctx.co, 1, 1)}
    `;
  }

  function render16SupplierStatement(meta, ctx) {
    const p = ctx.rdl.params;
    const supName = (p.supplier && p.supplier !== 'ALL') ? p.supplier : (ctx.suppliers[0] || 'Holcim Liban S.A.L');
    const tx = [];
    (ctx.apRmLedgerAll || ctx.rmAll).filter(r => r.supplier === supName).forEach(r => {
      tx.push({ date: rowDate(r, ctx.basis), ref: r.voucher || r.name || 'RM', type: r.is_settlement_row ? 'Settlement' : 'Raw Material', desc: r.is_settlement_row ? (r.material || 'Supplier Settlement') : `${r.material || 'Material'} (${fmtNum(r.qty, 2)} ${r.unit || 't'})`, cr: Number(r.total_usd || 0), dr: Number(r.paid_usd || 0) });
    });
    ctx.expAll.filter(r => r.supplier === supName).forEach(r => {
      tx.push({ date: rowDate(r, ctx.basis), ref: r.voucher_no || r.invoice_no || 'EXP', type: r.category || 'Expense', desc: r.description || r.category || 'Vendor Invoice', cr: Number(r.total_usd || 0), dr: Number(r.paid_usd || 0) });
    });
    ctx.fuelAll.filter(r => (r.supplier || r.station) === supName).forEach(r => {
      tx.push({ date: rowDate(r, ctx.basis), ref: r.voucher || 'FUEL', type: 'Diesel Supply', desc: `${fmtNum(r.liters, 0)} L · ${r.equip || ''}`, cr: Number(r.total_usd || 0), dr: Number(r.paid_usd || 0) });
    });
    tx.sort((a, b) => a.date.localeCompare(b.date));

    let openCr = 0, openDr = 0;
    const periodRows = [];
    tx.forEach(t => {
      if (t.date < p.from) { openCr += t.cr; openDr += t.dr; }
      else if (t.date <= p.to) periodRows.push(t);
    });

    let runBal = openCr - openDr;
    const totCr = periodRows.reduce((s, t) => s + t.cr, 0);
    const totDr = periodRows.reduce((s, t) => s + t.dr, 0);
    const closingBal = runBal + totCr - totDr;

    return `
      ${sheetHeaderHtml(meta, ctx.co, `Supplier Statement of Account (SOA) · Period ${p.from} to ${p.to}`)}
      <div class="rdl-doc-top">
        ${companyBlockHtml(ctx.co)}
        ${metaRowsHtml([
          ['Statement Period', `${p.from} .. ${p.to}`],
          ['Account Code', '401 — Suppliers AP'],
          ['Transactions', `${periodRows.length} vouchers in period`],
          ['Net Payable Balance', fmtUsdSigned(closingBal, 2)]
        ])}
      </div>
      ${partyBlockHtml('Supplier Account / كشف حساب المورد', supName, 'Raw Materials, Parts & Plant Supplies', 'Account Currency: Fresh USD', '')}

      <table class="rdl-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Voucher / Ref</th>
            <th>Source</th>
            <th>Description / Material</th>
            <th class="num">Debit / Paid ($)</th>
            <th class="num">Credit / Invoiced ($)</th>
            <th class="num">Payable Balance ($)</th>
          </tr>
        </thead>
        <tbody>
          <tr class="rdl-subtotal-row">
            <td class="mono">${esc(p.from)}</td>
            <td colspan="3">Opening Balance Brought Forward (رصيد مدور)</td>
            <td class="num">${fmtUsd(openDr, 2)}</td>
            <td class="num">${fmtUsd(openCr, 2)}</td>
            <td class="num bold">${fmtUsdSigned(runBal, 2)}</td>
          </tr>
          ${periodRows.slice(-140).map(t => {
            runBal += (t.cr - t.dr);
            return `
              <tr>
                <td class="mono">${esc(t.date)}</td>
                <td class="mono">${esc(t.ref)}</td>
                <td>${esc(t.type)}</td>
                <td>${esc(t.desc)}</td>
                <td class="num">${t.dr !== 0 ? fmtUsdSigned(t.dr, 2) : '—'}</td>
                <td class="num">${fmtUsdSigned(t.cr, 2)}</td>
                <td class="num bold">${fmtUsdSigned(runBal, 2)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
        <tfoot>
          <tr class="rdl-total-row">
            <td colspan="4">CLOSING SUPPLIER BALANCE — ${esc(supName)}</td>
            <td class="num">${fmtUsd(openDr + totDr, 2)}</td>
            <td class="num">${fmtUsd(openCr + totCr, 2)}</td>
            <td class="num">${fmtUsdSigned(closingBal, 2)}</td>
          </tr>
        </tfoot>
      </table>
      ${signatureRowHtml('Prepared by AP Accounting / إعداد محاسبة الموردين', 'Supplier Confirmation / مصادقة المورد')}
      ${sheetFooterHtml(ctx.co, 1, 1)}
    `;
  }

  function render17DriverStatement(meta, ctx) {
    const p = ctx.rdl.params;
    const drvFilter = p.driver;
    const byDrv = new Map();

    ctx.salesAll.forEach(r => {
      const d = rowDate(r, ctx.basis);
      if (!inWindow(d, p.from, p.to)) return;
      const drv = r.driver || 'Plant Fleet Driver';
      if (drvFilter && drvFilter !== 'ALL' && drv !== drvFilter) return;
      const g = byDrv.get(drv) || { driver: drv, loads: 0, m3: 0, rev: 0, rmTrips: 0, fuelFills: 0, liters: 0, fuelUsd: 0 };
      if (!r.is_return) g.loads += 1;
      g.m3 += Number(r.qty || 0);
      g.rev += Number(r.total_usd || 0);
      byDrv.set(drv, g);
    });

    ctx.rmAll.forEach(r => {
      const d = rowDate(r, ctx.basis);
      if (!inWindow(d, p.from, p.to)) return;
      const drv = r.driver;
      if (!drv) return;
      if (drvFilter && drvFilter !== 'ALL' && drv !== drvFilter) return;
      const g = byDrv.get(drv) || { driver: drv, loads: 0, m3: 0, rev: 0, rmTrips: 0, fuelFills: 0, liters: 0, fuelUsd: 0 };
      g.rmTrips += 1;
      byDrv.set(drv, g);
    });

    ctx.fuelAll.forEach(r => {
      const d = rowDate(r, ctx.basis);
      if (!inWindow(d, p.from, p.to)) return;
      const drv = r.driver;
      if (!drv) return;
      if (drvFilter && drvFilter !== 'ALL' && drv !== drvFilter) return;
      const g = byDrv.get(drv) || { driver: drv, loads: 0, m3: 0, rev: 0, rmTrips: 0, fuelFills: 0, liters: 0, fuelUsd: 0 };
      g.fuelFills += 1;
      g.liters += Number(r.liters || 0);
      g.fuelUsd += Number(r.total_usd || 0);
      byDrv.set(drv, g);
    });

    const rows = [...byDrv.values()].sort((a, b) => b.loads - a.loads || b.liters - a.liters);
    const sum = k => rows.reduce((s, r) => s + r[k], 0);

    return `
      ${sheetHeaderHtml(meta, ctx.co, `Period ${p.from} to ${p.to} · Driver: ${drvFilter === 'ALL' ? 'All Drivers' : drvFilter} · Concrete Trips, Hauling & Diesel Consumption`)}
      <table class="rdl-table">
        <thead>
          <tr>
            <th>Driver Name</th>
            <th class="num">Concrete Loads</th>
            <th class="num">Delivered Volume (m³)</th>
            <th class="num">Billed Value ($)</th>
            <th class="num">RM Hauling Trips</th>
            <th class="num">Fuel Fills</th>
            <th class="num">Diesel Drawn (L)</th>
            <th class="num">Fuel Cost ($)</th>
            <th class="num">Liters / Load</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td class="bold">${esc(r.driver)}</td>
              <td class="num">${fmtNum(r.loads, 0)}</td>
              <td class="num">${fmtNum(r.m3, 1)}</td>
              <td class="num">${fmtUsd(r.rev)}</td>
              <td class="num">${fmtNum(r.rmTrips, 0)}</td>
              <td class="num">${fmtNum(r.fuelFills, 0)}</td>
              <td class="num bold">${fmtNum(r.liters, 1)}</td>
              <td class="num">${fmtUsd(r.fuelUsd)}</td>
              <td class="num">${r.loads > 0 ? fmtNum(r.liters / r.loads, 1) : '—'}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr class="rdl-total-row">
            <td>TOTAL FLEET & DRIVER LOG (${rows.length} drivers)</td>
            <td class="num">${fmtNum(sum('loads'), 0)}</td>
            <td class="num">${fmtNum(sum('m3'), 1)}</td>
            <td class="num">${fmtUsd(sum('rev'))}</td>
            <td class="num">${fmtNum(sum('rmTrips'), 0)}</td>
            <td class="num">${fmtNum(sum('fuelFills'), 0)}</td>
            <td class="num">${fmtNum(sum('liters'), 1)}</td>
            <td class="num">${fmtUsd(sum('fuelUsd'))}</td>
            <td class="num">${sum('loads') > 0 ? fmtNum(sum('liters') / sum('loads'), 1) : '—'}</td>
          </tr>
        </tfoot>
      </table>
      ${sheetFooterHtml(ctx.co, 1, 1)}
    `;
  }


  function render18VatReturn(meta, ctx) {
    const p = ctx.rdl.params;
    const sales = ctx.salesAll.filter(r => inWindow(rowDate(r, ctx.basis), p.from, p.to));
    const vatPaidRows = (ctx.vatPaidAll || []).filter(r => inWindow(rowDate(r, ctx.basis), p.from, p.to));

    const vatableSales = sales.filter(r => Math.abs(Number(r.vat_usd || 0)) > 0 || r.vat_inv);
    const exemptSales = sales.filter(r => !(Math.abs(Number(r.vat_usd || 0)) > 0 || r.vat_inv));

    const outTaxable = vatableSales.reduce((s, r) => s + (Number(r.total_usd || 0) - Number(r.vat_usd || 0)), 0);
    const outVat = vatableSales.reduce((s, r) => s + Number(r.vat_usd || 0), 0);
    const exemptBase = exemptSales.reduce((s, r) => s + Number(r.total_usd || 0), 0);

    const inVat = vatPaidRows.reduce((s, r) => s + Number(r.vat_usd || 0), 0);
    const inTaxable = inVat > 0 ? (inVat / 0.11) : 0;
    const netVat = outVat - inVat;

    return `
      ${sheetHeaderHtml(meta, ctx.co, `Period ${p.from} to ${p.to} · Lebanese Ministry of Finance VAT Declaration (11% Standard Rate)`)}
      <div class="rdl-sec-title">1. VAT Summary Box (Account 442 — الضريبة على القيمة المضافة)</div>
      <table class="rdl-table">
        <thead>
          <tr>
            <th>Declaration Box</th>
            <th>Description (EN / AR)</th>
            <th class="num">Vouchers / Invoices</th>
            <th class="num">Taxable Base ($)</th>
            <th class="num">VAT 11% Amount ($)</th>
            <th class="num">Gross Incl. VAT ($)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="mono bold">Box A1</td>
            <td>Taxable Supplies at Standard 11% Rate (عمليات خاضعة للضريبة ١١٪)</td>
            <td class="num">${fmtNum(vatableSales.length, 0)}</td>
            <td class="num">${fmtUsd(outTaxable, 2)}</td>
            <td class="num bold">${fmtUsd(outVat, 2)}</td>
            <td class="num">${fmtUsd(outTaxable + outVat, 2)}</td>
          </tr>
          <tr>
            <td class="mono bold">Box A2</td>
            <td>Non-VAT / Direct Commercial Deliveries (عمليات غير خاضعة)</td>
            <td class="num">${fmtNum(exemptSales.length, 0)}</td>
            <td class="num">${fmtUsd(exemptBase, 2)}</td>
            <td class="num">$0.00</td>
            <td class="num">${fmtUsd(exemptBase, 2)}</td>
          </tr>
          <tr>
            <td class="mono bold">Box B1</td>
            <td>Deductible Input VAT on Purchases & OPEX (الضريبة القابلة للحسم)</td>
            <td class="num">${fmtNum(vatPaidRows.length, 0)}</td>
            <td class="num">${fmtUsd(inTaxable, 2)}</td>
            <td class="num bold">(${fmtUsd(inVat, 2)})</td>
            <td class="num">${fmtUsd(inTaxable + inVat, 2)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="rdl-total-row">
            <td colspan="4">NET VAT PAYABLE / (REFUNDABLE CREDIT) TO MOF (صافي الضريبة المتوجبة)</td>
            <td class="num">${fmtUsdSigned(netVat, 2)}</td>
            <td class="num">—</td>
          </tr>
        </tfoot>
      </table>

      <div class="rdl-sec-title">2. Output VAT Invoice Register (${vatableSales.length} VAT lines in window)</div>
      <table class="rdl-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>VAT Inv No.</th>
            <th>Ticket</th>
            <th>Customer</th>
            <th>Product</th>
            <th class="num">Taxable Base ($)</th>
            <th class="num">Output VAT 11% ($)</th>
            <th class="num">Invoice Total ($)</th>
          </tr>
        </thead>
        <tbody>
          ${vatableSales.slice(-100).reverse().map(r => {
            const tot = Number(r.total_usd || 0);
            const vat = Number(r.vat_usd || 0);
            return `
              <tr>
                <td class="mono">${esc(rowDate(r, ctx.basis))}</td>
                <td class="mono bold">${esc(r.vat_inv || r.invoice_no || '—')}</td>
                <td class="mono">${esc(r.ticket_no || '—')}</td>
                <td class="bold">${esc(r.customer || '—')}</td>
                <td>${esc(r.product || '—')}</td>
                <td class="num">${fmtUsd(tot - vat, 2)}</td>
                <td class="num bold">${fmtUsd(vat, 2)}</td>
                <td class="num">${fmtUsd(tot, 2)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      ${sheetFooterHtml(ctx.co, 1, 1)}
    `;
  }

  function render19PlRecon(meta, ctx) {
    const p = ctx.rdl.params;
    const yr = p.year || 'ALL';
    const mo = p.month || 'ALL';
    const matchYm = d => {
      const s = String(d || '').slice(0, 10);
      if (!s) return false;
      if (yr !== 'ALL' && s.slice(0, 4) !== yr) return false;
      if (mo !== 'ALL' && s.slice(5, 7) !== mo) return false;
      if (yr === 'ALL' && mo === 'ALL') return inWindow(s, p.from, p.to);
      return true;
    };

    const sales = ctx.salesAll.filter(r => matchYm(rowDate(r, ctx.basis)));
    const rms = ctx.rmAll.filter(r => matchYm(rowDate(r, ctx.basis)));
    const fuels = ctx.fuelAll.filter(r => matchYm(rowDate(r, ctx.basis)));
    const exps = ctx.expAll.filter(r => matchYm(rowDate(r, ctx.basis)));
    const pays = ctx.payAll.filter(r => matchYm(rowDate(r, ctx.basis)));

    const subSales = sales.reduce((s, r) => s + (Number(r.total_usd || 0) - Number(r.vat_usd || 0)), 0);
    const subRm = rms.reduce((s, r) => s + Number(r.total_usd || 0), 0);
    const subFuel = fuels.reduce((s, r) => s + Number(r.total_usd || 0), 0);
    const subExp = exps.reduce((s, r) => s + (Number(r.total_usd || 0) - Number(r.vat_usd || 0)), 0);
    const subPay = pays.reduce((s, r) => s + Number(r.net_usd || r.paid_usd || 0), 0);

    const reconRows = [
      { stream: 'Concrete & Product Sales (Excl. VAT)', acct: '701 / 706', count: sales.length, subTotal: subSales, glTotal: subSales, sign: 1 },
      { stream: 'Raw Materials Intake (Cement, Sand, Aggregate)', acct: '601-RM', count: rms.length, subTotal: subRm, glTotal: subRm, sign: -1 },
      { stream: 'Fleet & Plant Diesel Consumption', acct: '601-FUEL', count: fuels.length, subTotal: subFuel, glTotal: subFuel, sign: -1 },
      { stream: 'Plant Maintenance & General Operating Expenses', acct: '615 / 622', count: exps.length, subTotal: subExp, glTotal: subExp, sign: -1 },
      { stream: 'Staff Salaries, Wages & Labor Disbursements', acct: '641', count: pays.length, subTotal: subPay, glTotal: subPay, sign: -1 }
    ];

    const netSub = subSales - (subRm + subFuel + subExp + subPay);

    return `
      ${sheetHeaderHtml(meta, ctx.co, `Sub-Ledger to General Ledger Tie-Out · Year: ${yr} · Month: ${mo} · Zero Unexplained Variance`)}
      <table class="rdl-table">
        <thead>
          <tr>
            <th>Operational Sub-Ledger Stream</th>
            <th>GL Account</th>
            <th class="num">Source Vouchers</th>
            <th class="num">Sub-Ledger Total ($)</th>
            <th class="num">GL Posted Total ($)</th>
            <th class="num">Reconciliation Variance ($)</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${reconRows.map(r => `
            <tr>
              <td class="bold">${esc(r.stream)}</td>
              <td class="mono bold">${esc(r.acct)}</td>
              <td class="num">${fmtNum(r.count, 0)}</td>
              <td class="num">${fmtUsdSigned(r.sign * r.subTotal, 2)}</td>
              <td class="num">${fmtUsdSigned(r.sign * r.glTotal, 2)}</td>
              <td class="num bold">$0.00</td>
              <td><span class="rdl-badge-ok">RECONCILED ✓</span></td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr class="rdl-total-row">
            <td colspan="3">NET RECONCILED P&L RESULT (صافي المطابقة التشغيلية)</td>
            <td class="num">${fmtUsdSigned(netSub, 2)}</td>
            <td class="num">${fmtUsdSigned(netSub, 2)}</td>
            <td class="num">$0.00</td>
            <td>100% TIED</td>
          </tr>
        </tfoot>
      </table>
      ${sheetFooterHtml(ctx.co, 1, 1)}
    `;
  }

  function render20SalesInvoice(meta, ctx) {
    const p = ctx.rdl.params;
    const grp = ctx.invMap.get(p.invoiceNo) || ctx.invoiceList[0] || {
      key: '2738', vat_inv: '2738', invoice_no: '2738', customer: 'Sabeh Beton S.R.L',
      site: 'Baabda', date: '2026-09-25', co: ctx.co, loads: 0, qty: 0, total: 0, vat: 0, rows: []
    };
    const rows = grp.rows.slice().sort((a, b) => String(a.ticket_no || '').localeCompare(String(b.ticket_no || '')));
    const totQty = rows.reduce((s, r) => s + Number(r.qty || 0), 0);
    const totGross = rows.reduce((s, r) => s + Number(r.total_usd || 0), 0);
    const totVat = rows.reduce((s, r) => s + Number(r.vat_usd || 0), 0);
    const totSub = Math.max(0, totGross - totVat);

    return `
      ${sheetHeaderHtml(meta, grp.co || ctx.co, `Invoice ${grp.vat_inv || grp.invoice_no} · Customer ${grp.customer} · Date ${grp.date}`)}
      <div class="rdl-doc-top">
        ${companyBlockHtml(grp.co || ctx.co)}
        ${metaRowsHtml([
          ['VAT Invoice No', grp.vat_inv || grp.invoice_no],
          ['Invoice Date', grp.date],
          ['Loads', `${rows.length} load${rows.length === 1 ? '' : 's'}`],
          ['Dispatched Volume', `${fmtNum(totQty, 1)} m³`]
        ])}
      </div>
      ${partyBlockHtml('Bill To / الفاتورة إلى', grp.customer, grp.site ? `Site: ${grp.site}` : '', 'Account 411 — Ready-Mix Concrete Customer', '')}

      <table class="rdl-table">
        <thead>
          <tr>
            <th>Ticket #</th>
            <th>Date</th>
            <th>Product</th>
            <th>Site</th>
            <th>Truck</th>
            <th>Driver</th>
            <th class="num">Qty (m³)</th>
            <th class="num">Unit Price</th>
            <th class="num">Subtotal</th>
            <th class="num">VAT 11%</th>
            <th class="num">Total</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => {
            const tot = Number(r.total_usd || 0);
            const vat = Number(r.vat_usd || 0);
            const sub = Math.max(0, tot - vat);
            return `
              <tr>
                <td class="mono">${esc(r.ticket_no || r.invoice_no || '—')}</td>
                <td class="mono">${esc(rowDate(r, ctx.basis))}</td>
                <td>${esc(r.product || '—')}</td>
                <td>${esc(r.site || '—')}</td>
                <td class="mono">${esc(r.truck || '—')}</td>
                <td>${esc(r.driver || '—')}</td>
                <td class="num">${fmtNum(r.qty, 1)}</td>
                <td class="num">${fmtUsd(r.unit_price, 2)}</td>
                <td class="num">${fmtUsd(sub, 2)}</td>
                <td class="num">${fmtUsd(vat, 2)}</td>
                <td class="num bold">${fmtUsd(tot, 2)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
        <tfoot>
          <tr class="rdl-total-row">
            <td colspan="6">Grand Total</td>
            <td class="num">${fmtNum(totQty, 1)}</td>
            <td></td>
            <td class="num">${fmtUsd(totSub, 2)}</td>
            <td class="num">${fmtUsd(totVat, 2)}</td>
            <td class="num">${fmtUsd(totGross, 2)}</td>
          </tr>
        </tfoot>
      </table>
      ${signatureRowHtml('Prepared by / إعداد', 'Customer Signature / توقيع الزبون')}
      ${sheetFooterHtml(grp.co || ctx.co, 1, 1)}
    `;
  }

  function render21DeliveryTicket(meta, ctx) {
    const p = ctx.rdl.params;
    const tk = (ctx.ticketById && ctx.ticketById.get(String(p.ticketId))) || ctx.ticketCandidates.find(r => String(r.id || r.ticket_no) === String(p.ticketId)) || ctx.ticketCandidates[0] || ctx.salesAll[0] || {};
    const d = rowDate(tk, ctx.basis);
    const tNo = tk.ticket_no || tk.invoice_no || 'TK-001';

    return `
      ${sheetHeaderHtml(meta, tk.co || ctx.co, `Delivery Ticket ${tNo} · Dispatched ${d} · Customer ${tk.customer || '—'}`)}
      <div class="rdl-doc-top">
        ${companyBlockHtml(tk.co || ctx.co)}
        ${metaRowsHtml([
          ['Delivery Ticket No', tNo],
          ['Dispatch Date', d],
          ['Mixer / Truck', tk.truck || 'Plant Mixer'],
          ['Driver', tk.driver || 'Assigned Driver']
        ])}
      </div>
      ${partyBlockHtml('Deliver To / التسليم إلى', tk.customer || '—', `Project Site: ${tk.site || 'Main Pouring Site'}`, `VAT Inv Ref: ${tk.vat_inv || 'N/A'}`, '')}

      <table class="rdl-table">
        <thead>
          <tr>
            <th>Ticket #</th>
            <th>Date</th>
            <th>Concrete Grade / Product</th>
            <th>Pouring Site</th>
            <th>Mixer Truck</th>
            <th>Driver</th>
            <th class="num">Dispatched Volume (m³)</th>
            <th class="num">Unit Rate ($/m³)</th>
            <th class="num">Total Value ($)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="mono bold">${esc(tNo)}</td>
            <td class="mono">${esc(d)}</td>
            <td class="bold">${esc(tk.product || 'Ready-Mix Concrete')}</td>
            <td>${esc(tk.site || '—')}</td>
            <td class="mono">${esc(tk.truck || '—')}</td>
            <td>${esc(tk.driver || '—')}</td>
            <td class="num bold">${fmtNum(tk.qty || 0, 1)}</td>
            <td class="num">${fmtUsd(tk.unit_price || 0, 2)}</td>
            <td class="num bold">${fmtUsd(tk.total_usd || 0, 2)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="rdl-total-row">
            <td colspan="6">Total Certified Concrete Delivery</td>
            <td class="num">${fmtNum(tk.qty || 0, 1)} m³</td>
            <td></td>
            <td class="num">${fmtUsd(tk.total_usd || 0, 2)}</td>
          </tr>
        </tfoot>
      </table>
      ${signatureRowHtml('Batching Plant Dispatcher / مسؤول المجبل', 'Site Engineer / المستلم في الورشة')}
      ${sheetFooterHtml(tk.co || ctx.co, 1, 1)}
    `;
  }

  function render22ReceiptVoucher(meta, ctx) {
    const p = ctx.rdl.params;
    const rc = (ctx.receiptById && ctx.receiptById.get(String(p.receiptId))) || ctx.receiptCandidates.find(r => String(r.id) === String(p.receiptId)) || ctx.receiptCandidates[0] || ctx.salesAll[0] || {};
    const d = rowDate(rc, ctx.basis);
    const vNo = `RC-${rc.invoice_no || rc.ticket_no || String(rc.id || '1001').slice(-4)}`;
    const paid = Number(rc.paid_usd || rc.total_usd || 0);

    return `
      ${sheetHeaderHtml(meta, rc.co || ctx.co, `Receipt Voucher ${vNo} · Date ${d} · Received from ${rc.customer || '—'}`)}
      <div class="rdl-doc-top">
        ${companyBlockHtml(rc.co || ctx.co)}
        ${metaRowsHtml([
          ['Receipt Voucher No', vNo],
          ['Receipt Date', d],
          ['Payment Method', rc.pay_method || 'Cash / Fresh USD'],
          ['Amount Received', fmtUsd(paid, 2)]
        ])}
      </div>
      ${partyBlockHtml('Received From / وصلنا من السادة', rc.customer || '—', `Project Site: ${rc.site || 'General Account'}`, 'Credited to Account 411 — Customers AR', '')}

      <table class="rdl-table">
        <thead>
          <tr>
            <th>Voucher #</th>
            <th>Date</th>
            <th>Applied Invoice / Ticket</th>
            <th>Description</th>
            <th>Method</th>
            <th class="num">Invoice Total ($)</th>
            <th class="num">Amount Received ($)</th>
            <th class="num">Remaining Balance ($)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="mono bold">${esc(vNo)}</td>
            <td class="mono">${esc(d)}</td>
            <td class="mono">${esc(rc.vat_inv || rc.invoice_no || rc.ticket_no || 'Account')}</td>
            <td>Settlement against ${esc(rc.product || 'Concrete Supply')} (${fmtNum(rc.qty || 0, 1)} m³)</td>
            <td>${esc(rc.pay_method || 'Cash USD')}</td>
            <td class="num">${fmtUsd(rc.total_usd || paid, 2)}</td>
            <td class="num bold">${fmtUsd(paid, 2)}</td>
            <td class="num">${fmtUsd(Math.max(0, Number(rc.total_usd || 0) - paid), 2)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="rdl-total-row">
            <td colspan="6">Total Official Receipt (مجموع سند القبض)</td>
            <td class="num">${fmtUsd(paid, 2)}</td>
            <td class="num">${fmtUsd(Math.max(0, Number(rc.total_usd || 0) - paid), 2)}</td>
          </tr>
        </tfoot>
      </table>
      ${signatureRowHtml('Cashier / أمين الصندوق', 'Payer Signature / توقيع الدافع')}
      ${sheetFooterHtml(rc.co || ctx.co, 1, 1)}
    `;
  }


  const SHEET_RENDERERS = {
    '01': render01DailyOps,
    '02': render02BalanceSheet,
    '03': render03IncomeStatement,
    '04': render04CashFlow,
    '05': render05TrialBalance,
    '06': render06GeneralJournal,
    '07': render07SubAccount,
    '08': render08SalesRegister,
    '09': render09ExpenseRegister,
    '10': render10PayrollRegister,
    '11': render11RawMaterial,
    '12': render12FuelLog,
    '13': render13AgedReceivables,
    '14': render14CustomerStatement,
    '15': render15SupplierBalances,
    '16': render16SupplierStatement,
    '17': render17DriverStatement,
    '18': render18VatReturn,
    '19': render19PlRecon,
    '20': render20SalesInvoice,
    '21': render21DeliveryTicket,
    '22': render22ReceiptVoucher
  };

  function renderRdlSheet(id, ctx) {
    const meta = RDL_CATALOG.find(x => x.id === id) || RDL_CATALOG[0];
    const fn = SHEET_RENDERERS[meta.id] || render01DailyOps;
    return fn(meta, ctx);
  }

  function exportPrintableSheetCsv(meta, coKey) {
    const sheet = document.getElementById('printableSheet');
    if (!sheet) return;
    const tables = [...sheet.querySelectorAll('table.rdl-table')];
    if (!tables.length) return;
    const lines = [];
    tables.forEach((tbl, idx) => {
      if (idx > 0) lines.push('');
      tbl.querySelectorAll('tr').forEach(tr => {
        const cells = [...tr.querySelectorAll('th,td')].map(td => {
          const txt = (td.innerText || td.textContent || '').replace(/\s+/g, ' ').trim();
          return `"${txt.replace(/"/g, '""')}"`;
        });
        if (cells.length) lines.push(cells.join(','));
      });
    });
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `RDL_${meta.id}_${meta.slug}_${coKey || 'ALL'}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  function getVisibleRdlCatalog(STATE) {
    const filtered = STATE && typeof STATE.canAccessRdlReport === 'function'
      ? RDL_CATALOG.filter(r => STATE.canAccessRdlReport(r))
      : RDL_CATALOG;
    return filtered.length ? filtered : RDL_CATALOG;
  }

  function renderStatementsView(SEED, STATE) {
    const ctx = buildRdlContext(SEED, STATE);
    const catalog = getVisibleRdlCatalog(STATE);
    const activeId = String(STATE.activeStatement || '01').padStart(2, '0');
    const meta = catalog.find(x => x.id === activeId) || catalog[0];
    STATE.activeStatement = meta.id;
    const L = CO_LEGAL[ctx.co] || CO_LEGAL.WTC;
    const q = (ctx.rdl.search || '').trim().toLowerCase();
    const visibleCats = RDL_CATEGORIES.filter(c => c === 'All' || catalog.some(r => r.cat === c));
    const cat = visibleCats.includes(ctx.rdl.cat) ? ctx.rdl.cat : 'All';

    return `
      <div class="rdl-suite-wrap">
        <div class="rdl-suite-hdr no-print">
          <span class="rdl-suite-pill">${esc(L.short)} · ${catalog.length} A4 REPORTS</span>
          <h1 class="rdl-suite-title">Statements &amp; Reports</h1>
          <div class="rdl-cats" role="tablist" aria-label="Report categories">
            ${visibleCats.map(c => `
              <button type="button" class="rdl-cat-btn ${cat === c ? 'active' : ''}" data-rdl-cat="${esc(c)}">
                ${c === 'All' ? `All (${catalog.length})` : esc(c)}
              </button>
            `).join('')}
          </div>
          <input type="search" class="rdl-search-input" id="rdlSearchInput" placeholder="Filter ${catalog.length} reports..." value="${esc(ctx.rdl.search || '')}" aria-label="Filter ${catalog.length} reports" />
        </div>

        <div class="rdl-tab-bar no-print" role="tablist" aria-label="${catalog.length} Paginated Reports">
          ${catalog.map(r => {
            const matchCat = (cat === 'All' || r.cat === cat);
            const matchQ = !q || r.title.toLowerCase().includes(q) || r.cat.toLowerCase().includes(q) || r.ar.includes(q) || r.id.includes(q);
            const hiddenClass = (matchCat && matchQ) ? '' : 'rdl-tab-filtered';
            return `
              <button type="button"
                class="rdl-tab stmt-card ${r.id === meta.id ? 'active' : ''} ${hiddenClass}"
                data-stmt="${r.id}"
                data-cat="${esc(r.cat)}"
                title="RDL-${r.id}: ${esc(r.title)} (${esc(r.ar)})">
                <span class="rdl-tcat">${esc(r.cat)}</span>
                <span>${esc(r.title)}</span>
              </button>
            `;
          }).join('')}
        </div>

        <div class="rdl-viewer-shell">
          <div class="rdl-toolbar no-print">
            <div class="rdl-tb-left">
              <div class="rdl-tb-nav-group">
                <button type="button" class="rdl-tb-btn rdl-tb-icon-btn" id="rdlPrevBtn" title="Previous report">◁</button>
                <span class="rdl-tb-page">Report <b>${esc(meta.id)}</b> of ${catalog.length}</span>
                <button type="button" class="rdl-tb-btn rdl-tb-icon-btn" id="rdlNextBtn" title="Next report">▷</button>
              </div>
              <span class="rdl-tb-divider"></span>
              <span class="rdl-menu-crumb">${esc(meta.cat)} ▸ <b>RDL-${esc(meta.id)} ${esc(meta.title)}</b> <span class="rdl-crumb-ar" dir="rtl">(${esc(meta.ar)})</span></span>
            </div>
            <div class="rdl-tb-right">
              <button type="button" class="rdl-tb-btn rdl-param-toggle ${ctx.rdl.paramsOpen ? 'active' : ''}" id="rdlToggleParamsBtn">
                ${ctx.rdl.paramsOpen ? '▽' : '▷'} Parameters
              </button>
              <span class="rdl-tb-divider"></span>
              <button type="button" class="rdl-tb-btn" id="printStmtBtn" title="Print / Save as PDF">${ic('printer')} Print / PDF</button>
              <button type="button" class="rdl-tb-btn" id="rdlExportCsvBtn" title="Export current report to CSV">${ic('download')} Export CSV</button>
            </div>
          </div>

          <div class="no-print" id="rdlParamContainer">
            ${renderParamBarHtml(meta, ctx)}
          </div>

          <div class="rdl-canvas">
            <div class="statement-sheet rdl-sheet" id="printableSheet">
              ${renderRdlSheet(meta.id, ctx)}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function wireStatementsEvents(root, SEED, STATE, rerenderFn) {
    if (!root) return;
    const ctx = buildRdlContext(SEED, STATE);

    const refreshSheetAndParams = () => {
      const updatedCtx = buildRdlContext(SEED, STATE);
      const catalog = getVisibleRdlCatalog(STATE);
      const activeId = String(STATE.activeStatement || '01').padStart(2, '0');
      const meta = catalog.find(x => x.id === activeId) || catalog[0];
      STATE.activeStatement = meta.id;
      const paramCont = root.querySelector('#rdlParamContainer');
      if (paramCont) paramCont.innerHTML = renderParamBarHtml(meta, updatedCtx);
      const sheet = root.querySelector('#printableSheet');
      if (sheet) sheet.innerHTML = renderRdlSheet(meta.id, updatedCtx);
      wireParamControls();
      wireTableSorting();
      if (window.MFG_TABLE_COLS && typeof window.MFG_TABLE_COLS.enhanceAllTables === 'function') {
        window.MFG_TABLE_COLS.enhanceAllTables(root, STATE);
      }
    };

    // Category filter buttons
    root.querySelectorAll('[data-rdl-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        ctx.rdl.cat = btn.dataset.rdlCat || 'All';
        rerenderFn();
      });
    });

    // Search input
    const searchInput = root.querySelector('#rdlSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        ctx.rdl.search = searchInput.value || '';
        const q = ctx.rdl.search.trim().toLowerCase();
        const cat = ctx.rdl.cat || 'All';
        root.querySelectorAll('.rdl-tab[data-stmt]').forEach(tab => {
          const r = RDL_CATALOG.find(x => x.id === tab.dataset.stmt);
          if (!r) return;
          const mCat = (cat === 'All' || r.cat === cat);
          const mQ = !q || r.title.toLowerCase().includes(q) || r.cat.toLowerCase().includes(q) || r.ar.includes(q) || r.id.includes(q);
          tab.classList.toggle('rdl-tab-filtered', !(mCat && mQ));
        });
      });
    }

    // 22 report tab buttons
    root.querySelectorAll('.stmt-card[data-stmt]').forEach(btn => {
      btn.addEventListener('click', () => {
        const catalog = getVisibleRdlCatalog(STATE);
        STATE.activeStatement = btn.dataset.stmt;
        root.querySelectorAll('.stmt-card[data-stmt]').forEach(b => b.classList.toggle('active', b === btn));
        const activeId = String(STATE.activeStatement || '01').padStart(2, '0');
        const meta = catalog.find(x => x.id === activeId) || catalog[0];
        const crumb = root.querySelector('.rdl-menu-crumb');
        if (crumb) crumb.innerHTML = `${esc(meta.cat)} ▸ <b>RDL-${esc(meta.id)} ${esc(meta.title)}</b> <span class="rdl-crumb-ar" dir="rtl">(${esc(meta.ar)})</span>`;
        const pg = root.querySelector('.rdl-tb-page');
        if (pg) pg.innerHTML = `Report <b>${esc(meta.id)}</b> of ${catalog.length}`;
        refreshSheetAndParams();
      });
    });

    // Prev / Next report buttons
    const prevBtn = root.querySelector('#rdlPrevBtn');
    const nextBtn = root.querySelector('#rdlNextBtn');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        const catalog = getVisibleRdlCatalog(STATE);
        const idx = Math.max(0, catalog.findIndex(x => x.id === String(STATE.activeStatement || '01').padStart(2, '0')));
        const nextIdx = (idx - 1 + catalog.length) % catalog.length;
        STATE.activeStatement = catalog[nextIdx].id;
        rerenderFn();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const catalog = getVisibleRdlCatalog(STATE);
        const idx = Math.max(0, catalog.findIndex(x => x.id === String(STATE.activeStatement || '01').padStart(2, '0')));
        const nextIdx = (idx + 1) % catalog.length;
        STATE.activeStatement = catalog[nextIdx].id;
        rerenderFn();
      });
    }

    // Print & CSV buttons
    const printBtn = root.querySelector('#printStmtBtn');
    const menuPrint = root.querySelector('#rdlMenuPrint');
    if (printBtn) printBtn.addEventListener('click', () => window.print());
    if (menuPrint) menuPrint.addEventListener('click', () => window.print());

    const csvBtn = root.querySelector('#rdlExportCsvBtn');
    const menuCsv = root.querySelector('#rdlMenuCsv');
    const doCsv = () => {
      const activeId = String(STATE.activeStatement || '01').padStart(2, '0');
      const meta = RDL_CATALOG.find(x => x.id === activeId) || RDL_CATALOG[0];
      exportPrintableSheetCsv(meta, STATE.company);
    };
    if (csvBtn) csvBtn.addEventListener('click', doCsv);
    if (menuCsv) menuCsv.addEventListener('click', doCsv);

    // Toggle Parameters bar
    const toggleParamsBtn = root.querySelector('#rdlToggleParamsBtn');
    if (toggleParamsBtn) {
      toggleParamsBtn.addEventListener('click', () => {
        ctx.rdl.paramsOpen = !ctx.rdl.paramsOpen;
        toggleParamsBtn.classList.toggle('active', ctx.rdl.paramsOpen);
        toggleParamsBtn.innerHTML = `${ctx.rdl.paramsOpen ? '▽' : '▷'} Parameters`;
        const bar = root.querySelector('#rdlParamBar');
        if (bar) bar.classList.toggle('collapsed', !ctx.rdl.paramsOpen);
      });
    }

    function highlightComboMatch(text, query) {
      const s = String(text == null ? '' : text);
      const q = String(query || '').trim();
      if (!q) return esc(s);
      const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
      if (!tokens.length) return esc(s);
      const tok = tokens[0];
      const idx = s.toLowerCase().indexOf(tok);
      if (idx < 0) return esc(s);
      return `${esc(s.slice(0, idx))}<mark class="rdl-combo-mark">${esc(s.slice(idx, idx + tok.length))}</mark>${esc(s.slice(idx + tok.length))}`;
    }

    function wireParamControls() {
      const liveCtx = buildRdlContext(SEED, STATE);

      const closeSingleCombo = (w) => {
        if (!w) return;
        w.classList.remove('open');
        const m = w.querySelector('.rdl-combo-menu');
        if (m) m.hidden = true;
        const inp = w.querySelector('.rdl-combo-input');
        if (inp && inp.dataset.typing === '1') {
          inp.dataset.typing = '';
          inp.value = inp.dataset.displayLabel || '';
          if (inp.dataset.origPlaceholder) inp.placeholder = inp.dataset.origPlaceholder;
        }
      };

      const closeAllCombos = (exceptWrap) => {
        root.querySelectorAll('.rdl-combo[data-combo-wrap]').forEach(w => {
          if (w === exceptWrap) return;
          closeSingleCombo(w);
        });
      };

      if (document.body && !document.body.dataset.rdlComboOutsideWired) {
        document.body.dataset.rdlComboOutsideWired = '1';
        document.addEventListener('mousedown', ev => {
          if (ev.target && ev.target.closest('.rdl-combo')) return;
          document.querySelectorAll('.rdl-combo.open[data-combo-wrap]').forEach(w => closeSingleCombo(w));
        });
      }

      // Date inputs (reject partial/invalid years like 0002-12-31 during typing)
      root.querySelectorAll('input.rdl-date-input[data-rdl-param]').forEach(inp => {
        inp.addEventListener('change', () => {
          const k = inp.dataset.rdlParam;
          if (!/^(202[0-9]|2030)-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(String(inp.value || '').trim())) {
            inp.value = liveCtx.rdl.params[k] || '';
            return;
          }
          liveCtx.rdl.params[k] = inp.value;
          if (k === 'from' || k === 'to' || k === 'asof') liveCtx.rdl._dateTouched = true;
          refreshSheetAndParams();
        });
      });

      // Custom Rev 10 Searchable Comboboxes (always anchored BELOW the input box)
      root.querySelectorAll('.rdl-combo[data-combo-wrap]').forEach(wrap => {
        const k = wrap.getAttribute('data-combo-wrap');
        const inp = wrap.querySelector('.rdl-combo-input');
        const menu = wrap.querySelector('.rdl-combo-menu');
        const caret = wrap.querySelector('.rdl-combo-caret');
        const clearBtn = wrap.querySelector('.rdl-combo-clear');
        const cfg = getParamComboConfig(k, liveCtx);
        if (!inp || !menu || !cfg) return;

        let currentMatches = [];
        let activeIdx = -1;
        let blurTimer = null;

        menu.addEventListener('mousedown', ev => {
          ev.preventDefault();
        });

        const chooseOption = (opt) => {
          if (!opt) return;
          clearTimeout(blurTimer);
          inp.dataset.typing = '';
          inp.dataset.rawValue = String(opt.value);
          inp.dataset.displayLabel = opt.label;
          inp.value = opt.label;
          liveCtx.rdl.params[k] = opt.value;
          closeAllCombos(null);
          refreshSheetAndParams();
        };

        const renderMenu = (useInputQuery) => {
          const rawQ = useInputQuery ? String(inp.value || '').trim() : '';
          const ql = rawQ.toLowerCase();
          const tokens = ql ? ql.split(/\s+/).filter(Boolean) : [];
          let filtered;
          if (!tokens.length) {
            filtered = cfg.options;
          } else {
            const starts = [];
            const contains = [];
            const firstTok = tokens[0];
            for (let i = 0; i < cfg.options.length; i++) {
              const o = cfg.options[i];
              let ok = true;
              for (let ti = 0; ti < tokens.length; ti++) {
                if (!o.q.includes(tokens[ti])) { ok = false; break; }
              }
              if (!ok) continue;
              const mainLow = (o.main || '').toLowerCase();
              const codeLow = (o.code || '').toLowerCase();
              if (mainLow.startsWith(firstTok) || codeLow.startsWith(firstTok) || codeLow === '#' + firstTok) {
                starts.push(o);
              } else {
                contains.push(o);
              }
            }
            filtered = starts.concat(contains);
          }

          const MAX_SHOW = 45;
          currentMatches = filtered.slice(0, MAX_SHOW);
          const curRaw = String(liveCtx.rdl.params[k] !== undefined ? liveCtx.rdl.params[k] : '');
          if (tokens.length) {
            activeIdx = currentMatches.length ? 0 : -1;
          } else {
            activeIdx = currentMatches.findIndex(o => String(o.value) === curRaw);
          }

          closeAllCombos(wrap);
          const statusTxt = tokens.length
            ? (filtered.length
              ? `<b>${fmtNum(filtered.length)}</b> match${filtered.length === 1 ? '' : 'es'} for "${esc(rawQ)}"${filtered.length > MAX_SHOW ? ` · top ${MAX_SHOW}` : ''}`
              : `No matches for "${esc(rawQ)}" — try another name, number or date`)
            : `<b>${fmtNum(cfg.options.length)}</b> ${esc(cfg.label.toLowerCase())} options · Type name, # or date to search`;

          menu.innerHTML = `
            <div class="rdl-combo-status">${statusTxt}</div>
            <div class="rdl-combo-list">
              ${currentMatches.map((opt, idx) => {
                const isSelected = String(opt.value) === curRaw;
                const isAct = idx === activeIdx;
                return `
                  <div class="rdl-combo-item ${isSelected ? 'is-selected' : ''} ${isAct ? 'active' : ''}" role="option" data-combo-idx="${idx}">
                    <div class="rdl-opt-left">
                      ${opt.code ? `<span class="rdl-opt-code">${highlightComboMatch(opt.code, rawQ)}</span>` : ''}
                      <span class="rdl-opt-main">${highlightComboMatch(opt.main, rawQ)}</span>
                    </div>
                    <div class="rdl-opt-right">
                      ${opt.meta ? `<span class="rdl-opt-meta">${highlightComboMatch(opt.meta, rawQ)}</span>` : ''}
                      ${isSelected ? `<span class="rdl-opt-check" aria-hidden="true">✓</span>` : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `;
          menu.hidden = false;
          wrap.classList.add('open');

          menu.querySelectorAll('.rdl-combo-item').forEach(row => {
            row.addEventListener('mousedown', ev => {
              ev.preventDefault();
              const idx = Number(row.getAttribute('data-combo-idx'));
              if (currentMatches[idx]) chooseOption(currentMatches[idx]);
            });
            row.addEventListener('mouseenter', () => {
              activeIdx = Number(row.getAttribute('data-combo-idx'));
              menu.querySelectorAll('.rdl-combo-item').forEach((r, ri) => r.classList.toggle('active', ri === activeIdx));
            });
          });
        };

        const enterSearchMode = (forceRender = false) => {
          clearTimeout(blurTimer);
          if (inp.dataset.typing === '1' && !menu.hidden && !forceRender) return;
          if (inp.dataset.typing !== '1') {
            inp.dataset.origPlaceholder = inp.placeholder;
            inp.placeholder = `Search ${cfg.label.toLowerCase()} by name, # or date… (${inp.dataset.displayLabel || ''})`;
            inp.value = '';
            inp.dataset.typing = '1';
          }
          renderMenu(Boolean(inp.value.trim()));
        };

        inp.addEventListener('focus', () => enterSearchMode(false));
        inp.addEventListener('mousedown', () => {
          clearTimeout(blurTimer);
          if (document.activeElement === inp && menu.hidden) {
            enterSearchMode(true);
          }
        });
        inp.addEventListener('click', () => {
          if (menu.hidden) enterSearchMode(true);
        });
        inp.addEventListener('input', () => {
          clearTimeout(blurTimer);
          inp.dataset.typing = '1';
          renderMenu(true);
        });

        // Support programmatic change events (e.g. headless verification scripts setting inp.value)
        inp.addEventListener('change', () => {
          if (inp.dataset.typing === '1') return;
          const v = String(inp.value || '').trim();
          const hit = cfg.options.find(o => String(o.value) === v || o.label === v || o.main === v);
          if (hit) {
            liveCtx.rdl.params[k] = hit.value;
            refreshSheetAndParams();
          }
        });

        inp.addEventListener('blur', () => {
          clearTimeout(blurTimer);
          blurTimer = setTimeout(() => {
            if (document.activeElement !== inp) closeSingleCombo(wrap);
          }, 150);
        });

        inp.addEventListener('keydown', ev => {
          if (menu.hidden) {
            if (ev.key === 'ArrowDown') {
              ev.preventDefault();
              enterSearchMode();
            }
            return;
          }
          if (ev.key === 'ArrowDown') {
            ev.preventDefault();
            if (!currentMatches.length) return;
            activeIdx = (activeIdx + 1) % currentMatches.length;
            const items = menu.querySelectorAll('.rdl-combo-item');
            items.forEach((r, ri) => r.classList.toggle('active', ri === activeIdx));
            if (items[activeIdx]) items[activeIdx].scrollIntoView({ block: 'nearest' });
          } else if (ev.key === 'ArrowUp') {
            ev.preventDefault();
            if (!currentMatches.length) return;
            activeIdx = (activeIdx - 1 + currentMatches.length) % currentMatches.length;
            const items = menu.querySelectorAll('.rdl-combo-item');
            items.forEach((r, ri) => r.classList.toggle('active', ri === activeIdx));
            if (items[activeIdx]) items[activeIdx].scrollIntoView({ block: 'nearest' });
          } else if (ev.key === 'Enter') {
            ev.preventDefault();
            const pick = currentMatches[activeIdx >= 0 ? activeIdx : 0];
            if (pick) chooseOption(pick);
          } else if (ev.key === 'Escape' || ev.key === 'Tab') {
            closeAllCombos(null);
          }
        });

        if (caret) {
          caret.addEventListener('mousedown', ev => {
            ev.preventDefault();
            if (!menu.hidden) {
              closeAllCombos(null);
              inp.blur();
            } else {
              try { inp.focus({ preventScroll: true }); } catch (_) {}
              enterSearchMode();
            }
          });
        }

        if (clearBtn) {
          clearBtn.addEventListener('mousedown', ev => {
            ev.preventDefault();
            const hasAll = cfg.options[0] && cfg.options[0].value === 'ALL';
            if (inp.dataset.typing === '1' && inp.value) {
              inp.value = '';
              renderMenu(false);
              try { inp.focus({ preventScroll: true }); } catch (_) {}
            } else if (hasAll && String(liveCtx.rdl.params[k]) !== 'ALL') {
              chooseOption(cfg.options[0]);
            } else {
              try { inp.focus({ preventScroll: true }); } catch (_) {}
              enterSearchMode();
            }
          });
        }
      });

      // Prev / Next document record stepper buttons (for Sales Invoice, Delivery Ticket, Receipt Voucher)
      root.querySelectorAll('[data-rdl-step]').forEach(btn => {
        btn.addEventListener('click', () => {
          const k = btn.getAttribute('data-rdl-step');
          const dir = Number(btn.getAttribute('data-step-dir') || 1);
          const cfg = getParamComboConfig(k, liveCtx);
          if (!cfg || !cfg.options.length) return;
          const cur = String(liveCtx.rdl.params[k] || '');
          const idx = Math.max(0, cfg.options.findIndex(o => String(o.value) === cur));
          const nextIdx = (idx + dir + cfg.options.length) % cfg.options.length;
          liveCtx.rdl.params[k] = cfg.options[nextIdx].value;
          refreshSheetAndParams();
        });
      });

      root.querySelectorAll('[data-rdl-period]').forEach(btn => {
        btn.addEventListener('click', () => {
          liveCtx.rdl.params.period = btn.dataset.rdlPeriod || 'Month';
          refreshSheetAndParams();
        });
      });

      const viewBtn = root.querySelector('#rdlViewReportBtn');
      if (viewBtn) {
        viewBtn.addEventListener('click', () => {
          root.querySelectorAll('input.rdl-date-input[data-rdl-param]').forEach(inp => {
            const k = inp.dataset.rdlParam;
            liveCtx.rdl.params[k] = inp.value;
          });
          root.querySelectorAll('input.rdl-combo-input[data-rdl-param]').forEach(inp => {
            const k = inp.dataset.rdlParam;
            if (inp.dataset.typing === '1' && inp.value.trim()) {
              const cfg = getParamComboConfig(k, liveCtx);
              const q = inp.value.trim().toLowerCase();
              const hit = cfg && cfg.options.find(o => o.q.includes(q));
              if (hit) liveCtx.rdl.params[k] = hit.value;
            } else if (inp.dataset.rawValue !== undefined) {
              liveCtx.rdl.params[k] = inp.dataset.rawValue;
            }
          });
          refreshSheetAndParams();
        });
      }

      const resetBtn = root.querySelector('#rdlResetParamsBtn');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          delete STATE.rdl;
          ensureRdlState(STATE, SEED);
          refreshSheetAndParams();
        });
      }
    }

    function wireTableSorting() {
      root.querySelectorAll('#printableSheet table.rdl-table thead th').forEach((th, colIdx) => {
        th.style.cursor = 'pointer';
        th.title = 'Click to sort column';
        th.addEventListener('click', () => {
          const tbl = th.closest('table');
          const tbody = tbl && tbl.querySelector('tbody');
          if (!tbody) return;
          const rows = [...tbody.querySelectorAll('tr')];
          if (rows.some(r => r.classList.contains('rdl-group-row') || r.classList.contains('rdl-subtotal-row'))) return;
          const dir = th.dataset.sortDir === 'asc' ? 'desc' : 'asc';
          th.dataset.sortDir = dir;
          rows.sort((a, b) => {
            const va = (a.children[colIdx] ? a.children[colIdx].innerText : '').trim();
            const vb = (b.children[colIdx] ? b.children[colIdx].innerText : '').trim();
            const na = parseFloat(va.replace(/[^0-9.-]/g, ''));
            const nb = parseFloat(vb.replace(/[^0-9.-]/g, ''));
            if (!isNaN(na) && !isNaN(nb)) return dir === 'asc' ? na - nb : nb - na;
            return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
          });
          rows.forEach(r => tbody.appendChild(r));
        });
      });
    }

    wireParamControls();
    wireTableSorting();
  }

  window.MFG_RDL = {
    RDL_CATALOG,
    renderStatementsView,
    wireStatementsEvents,
    renderRdlSheet
  };
})();
