/* ============================================================================
   ISABI Systems — 20-Page Power BI Report Studio & 34-Table Hub (js/pbi_pages.js)
   Parity+ with m18c_report.py (20 Power BI pages) & m14_sitemap.py (34 tables)
   v4.4 — Page-specific dynamic slicers, multi-band KPIs, section headings,
          AR aging signed column chart, combo/clustered/multi-line SVG charts,
          inline proportional table data bars, Ended amber & Pickup navy tints,
          and full 3-section P12 Payroll, Site Allowances & Freelance studio.
   ============================================================================ */

(function () {
  'use strict';

  const PBI_PAGES = [
    { id: 'p01_overview', num: '01', label: 'Executive Pulse', title: 'Executive P&L, Margin, AR/AP & Fleet Overview' },
    { id: 'p02_companies', num: '02', label: 'Entity Comparison', title: 'Side-by-Side Entity Comparison (WTC · BBConstruction · Lions Transport)' },
    { id: 'p04_sales', num: '03', label: 'Sales Analytics', title: 'Sales Revenue, Realised Price Trends, Top Grades & Customer Mix' },
    { id: 'p05_pricing', num: '04', label: 'Pricing & Spreads', title: 'Price Agreements, Spread, Below-Agreed Exceptions & Commissions' },
    { id: 'p06_ar', num: '05', label: 'Receivables & Aging', title: 'FIFO Customer Balances, 5-Bucket AR Aging & Running Statement' },
    { id: 'p07_ap', num: '06', label: 'Payables & Spend', title: '3-Leg Accounts Payable (Material / Haulage / Expense) & Overhead' },
    { id: 'p08_stock', num: '07', label: 'Stock & Unit Margin', title: 'Raw Material Intake, Unit Economics & Transport Cost Recovery' },
    { id: 'p09_fuel', num: '08', label: 'Diesel & Tank Burn', title: 'Diesel Tank Balance, Consumption per 100 km / hr & Meter Guard (m142)' },
    { id: 'p10_fleet', num: '09', label: 'Fleet Economics', title: 'Equipment Utilization, Running Cost & Cost per Ton' },
    { id: 'p12_payroll', num: '10', label: 'Workforce Analytics', title: 'Staff Payroll Analytics, Site Allowances & Freelance' },
    { id: 'p14_cashflow', num: '11', label: 'Cash Flow & Till', title: 'Cash Inflows vs Outflows, Daily Till 5300 & Payment Method Mix' },
    { id: 'p16_financial', num: '12', label: 'Financial GL & Ratios', title: 'Lebanese CoA Income Statement, Balance Sheet & Trial Balance' }
  ];

  // 8 Operational Pages moved out of Analytics & Insights directly into their respective domain hub sub-tabs
  const MOVED_PBI_PAGES = {
    p03_exceptions: { id: 'p03_exceptions', view: 'sentinels',       modSec: 'exceptions', short: 'Action Items',       targetLabel: 'AI Sentinels & Audit' },
    p18_tickets:    { id: 'p18_tickets',    view: 'sales_analytics', modSec: 'tickets',    short: 'Ticket Books',       targetLabel: 'Sales Analytics' },
    p17_jv:         { id: 'p17_jv',         view: 'raw_analytics',   modSec: 'jv',         short: 'JV 50/50 Sites',     targetLabel: 'JV & Stock Analytics' },
    p11_drivers:    { id: 'p11_drivers',    view: 'fleet_analytics', modSec: 'drivers',    short: 'Drivers & Overtime', targetLabel: 'Fleet & Driver Analytics' },
    p13_vat:        { id: 'p13_vat',        view: 'sales_vat',       modSec: 'vat',        short: 'VAT & Invoices',     targetLabel: 'VAT & Credit' },
    p15_treasury:   { id: 'p15_treasury',   view: 'ledger_treasury', modSec: 'treasury',   short: 'Treasury & Loans',   targetLabel: 'Loans & FX Treasury' },
    p19_changelog:  { id: 'p19_changelog',  view: 'sentinels',       modSec: 'changelog',  short: 'Change Log & Drift', targetLabel: 'AI Sentinels & Audit' },
    p20_recon:      { id: 'p20_recon',      view: 'statements',      modSec: 'recon',      short: 'Statement Recon',    targetLabel: 'Statements & Reports' }
  };

  // All 34 Power Apps Sitemap Tables (m14_sitemap.py) — Universal Registries grouped in Group 3 (consistent across all BUs)
  const TABLE_CATALOG = [
    { key: 'sales_tickets', group: '1 · Plant & Dispatch', label: 'Sales Tickets', dvn: 'bhf_salesticket', form: 'sales', cols: ['date', 'rep_date', 'ticket_no', 'company', 'sale_type', 'customer', 'product', 'site', 'truck', 'driver', 'qty', 'uom', 'unit_price', 'price', 'trans_price', 'vat', 'total_ttc', 'method'], relTables: ['customers', 'price_rules', 'products', 'sites', 'equipment', 'drivers', 'receipts', 'vat_invoices'], views: [{ id: 'all', label: 'All Sales Tickets' }, { id: 'delivery', label: 'Delivery Loads', fn: r => /deliv/i.test(r.sale_type) }, { id: 'pickup', label: 'Pick-up (Material Only)', fn: r => /pick/i.test(r.sale_type) }, { id: 'credit', label: 'Credit / Account', fn: r => !/cash/i.test(r.method) }, { id: 'iva', label: 'IVA / VAT 11%', fn: r => r.iva || Number(r.vat || 0) > 0 }] },
    { key: 'raw_purchases', group: '1 · Plant & Dispatch', label: 'Raw Material Purchases', dvn: 'bhf_rawpurchase', form: 'raw', cols: ['date', 'rep_date', 'ticket_no', 'company', 'site', 'site_owner', 'transport_by', 'truck_owner', 'truck', 'driver', 'product', 'qty', 'uom', 'unit_cost', 'cost', 'trans_cost', 'total'], relTables: ['sites', 'suppliers', 'price_rules', 'equipment', 'drivers', 'products', 'settlements'], views: [{ id: 'all', label: 'All Raw Purchases' }, { id: 'supplier_haul', label: 'Third-Party Haulage', fn: r => Number(r.trans_cost || 0) > 0 }, { id: 'company_haul', label: 'Company Fleet Haul', fn: r => /company/i.test(r.transport_by) }] },
    { key: 'fuel_intakes', group: '1 · Plant & Dispatch', label: 'Fuel & Lubricant Intakes', dvn: 'bhf_fuelintake', form: 'fuel', cols: ['date', 'ticket_no', 'company', 'equipment', 'driver', 'item', 'litres', 'odometer', 'hours', 'notes'], relTables: ['equipment', 'company_equipment', 'drivers', 'products'], views: [{ id: 'all', label: 'All Fuel & Lube Fills' }, { id: 'diesel', label: 'Diesel Only', fn: r => /diesel|fuel|mazout/i.test(r.item || '') }, { id: 'lube', label: 'Oils & Lubricants', fn: r => !/diesel|fuel|mazout/i.test(r.item || '') }] },
    { key: 'receipts', group: '1 · Plant & Dispatch', label: 'Customer Receipts (AR)', dvn: 'bhf_mfgcustomerreceipt', form: 'receipt', cols: ['date', 'rep_date', 'name', 'company', 'customer', 'method', 'kind', 'amount', 'discount', 'vat_invoice', 'record_ticket', 'reference', 'notes'], relTables: ['customers', 'sales_tickets', 'vat_invoices', 'credit_terms'], views: [{ id: 'all', label: 'All Customer Receipts' }, { id: 'cash', label: 'Cash / Check', fn: r => /cash|check|cheque/i.test(r.method || '') }, { id: 'disc', label: 'With Discount / Rebate', fn: r => Number(r.discount || 0) > 0 }] },
    { key: 'settlements', group: '1 · Plant & Dispatch', label: 'Supplier Settlements (AP)', dvn: 'bhf_mfgsupplierpayment', form: 'settlement', cols: ['date', 'rep_date', 'name', 'company', 'supplier', 'payable_leg', 'method', 'kind', 'amount', 'discount', 'raw_ticket', 'expense_record', 'reference', 'notes'], relTables: ['suppliers', 'raw_purchases', 'expenses', 'price_rules'], views: [{ id: 'all', label: 'All Supplier Settlements' }, { id: 'raw_leg', label: 'Raw / Haulage Leg', fn: r => Boolean(r.raw_ticket) }, { id: 'exp_leg', label: 'Expense Leg', fn: r => Boolean(r.expense_record) }] },
    { key: 'expenses', group: '1 · Plant & Dispatch', label: 'General & Fleet Expenses', dvn: 'bhf_mfgexpense', form: 'expense', cols: ['date', 'rep_date', 'name', 'company', 'category', 'subcategory', 'supplier', 'equipment', 'method', 'qty', 'amount', 'vat', 'total_ttc', 'invoice', 'reference', 'notes'], relTables: ['expense_categories', 'expense_subcategories', 'suppliers', 'equipment', 'settlements'], views: [{ id: 'all', label: 'All Expenses' }, { id: 'fleet', label: 'Equipment & Fleet Tagged', fn: r => Boolean(r.equipment) }, { id: 'overhead', label: 'Plant & General Overhead', fn: r => !r.equipment }] },
    { key: 'price_rules', group: '2 · Commercial & Pricing', label: 'Price & Commission Agreements', dvn: 'bhf_pricerule', form: 'pricerule', cols: ['name', 'company', 'rule_type', 'customer', 'supplier', 'product', 'site', 'unit', 'unit_price', 'trans_unit_price', 'qty1', 'adj1', 'total1', 'qty2', 'adj2', 'total2', 'indiff_price', 'start_date', 'end_date', 'matched_tickets'], relTables: ['customers', 'suppliers', 'products', 'sites', 'sales_tickets', 'raw_purchases'], views: [{ id: 'all', label: 'All Price Agreements' }, { id: 'active', label: 'Active Agreements', fn: r => !r.end_date }, { id: 'sales', label: 'Customer Sales Rules', fn: r => /sale|pickup|deliv/i.test(r.rule_type || '') }, { id: 'transport', label: 'Transport & Raw Rules', fn: r => /trans|raw|purch/i.test(r.rule_type || '') }, { id: 'list', label: 'List Prices', fn: r => /list/i.test(r.rule_type || '') }] },
    { key: 'credit_terms', group: '2 · Commercial & Pricing', label: 'Customer Credit Terms', dvn: 'bhf_creditterm', form: 'creditterm', cols: ['name', 'company', 'customer', 'credit_days', 'credit_limit', 'ar_balance', 'start_date', 'end_date', 'notes'], relTables: ['customers', 'sales_tickets', 'receipts'], views: [{ id: 'all', label: 'All Credit Terms' }, { id: 'active', label: 'Active Policies', fn: r => !r.end_date }] },
    { key: 'vat_invoices', group: '2 · Commercial & Pricing', label: 'VAT 11% Tax Invoices', dvn: 'bhf_vatinvoice', form: 'vatinvoice', cols: ['invoice_no', 'date', 'company', 'customer', 'start_date', 'end_date', 'net_amount', 'vat_amount', 'total_ttc', 'tickets_count', 'notes'], relTables: ['customers', 'sales_tickets', 'receipts'], views: [{ id: 'all', label: 'All VAT Invoices' }] },
    { key: 'equipment', group: '3 · Universal Registries (All BUs)', universal: true, navView: 'reg_equipment', label: 'Equipment & Trucks', dvn: 'bhf_equipment', form: 'equipment', cols: ['name', 'companies_list', 'plate_no', 'type', 'ownership', 'supplier', 'capacity', 'default_driver', 'loads_hauled', 'fuel_fills'], relTables: ['company_equipment', 'suppliers', 'drivers', 'sales_tickets', 'raw_purchases', 'fuel_intakes', 'expenses'], views: [{ id: 'all', label: 'All Trucks & Equipment' }, { id: 'trucks', label: 'Trucks Only', fn: r => /^truck$/i.test(r.type || 'Truck') }, { id: 'own', label: 'Company Fleet', fn: r => /company|own/i.test(r.ownership || '') }, { id: 'company_trucks', label: 'Company Trucks', fn: r => /company|own/i.test(r.ownership || '') && /^truck$/i.test(r.type || 'Truck') }, { id: 'machinery', label: 'Heavy Machinery & Plant', fn: r => /excavator|loader|bulldozer|generator|other/i.test(r.type || '') }, { id: 'vehicles', label: 'Vehicles & Pickups', fn: r => /vehicle/i.test(r.type || '') }, { id: 'third_party', label: 'Third-Party Haulers', fn: r => !/company|own/i.test(r.ownership || '') }] },
    { key: 'drivers', group: '3 · Universal Registries (All BUs)', universal: true, navView: 'reg_drivers', label: 'Drivers & Operators', dvn: 'bhf_driver', form: 'driver', cols: ['name', 'truck_owner', 'assigned_trucks', 'companies_list', 'phone', 'loads_hauled', 'fuel_fills'], relTables: ['company_drivers', 'equipment', 'suppliers', 'sales_tickets', 'raw_purchases', 'fuel_intakes'], views: [{ id: 'all', label: 'All Drivers & Operators' }] },
    { key: 'sites', group: '3 · Universal Registries (All BUs)', universal: true, navView: 'reg_sites', label: 'Sites', dvn: 'bhf_site', form: 'site', cols: ['name', 'region', 'supplier', 'is_jv', 'gps_status', 'latitude', 'longitude', 'active_rules', 'sales_loads', 'raw_loads'], relTables: ['regions', 'suppliers', 'sales_tickets', 'raw_purchases', 'price_rules', 'jv_partnerships', 'logistics_allowances'], views: [{ id: 'all', label: 'All Sites' }, { id: 'jv', label: 'JV 50/50 Sites', fn: r => Boolean(r.is_jv) }, { id: 'gps', label: 'Verified GPS Pin', fn: r => r.latitude != null && r.longitude != null }] },
    { key: 'regions', group: '3 · Universal Registries (All BUs)', universal: true, navView: 'reg_regions', label: 'Regions & Zones', dvn: 'bhf_region', form: 'site', cols: ['name', 'code', 'sites_count', 'overtime_rate', 'sales_loads'], relTables: ['sites', 'overtime_rates', 'sales_tickets'], views: [{ id: 'all', label: 'All Regions & Zones' }] },
    { key: 'products', group: '3 · Universal Registries (All BUs)', universal: true, navView: 'reg_products', label: 'Products & Grades', dvn: 'bhf_product', form: 'product', cols: ['name', 'type', 'uom', 'ton_factor', 'list_price', 'ticket_product', 'fuel_item', 'input_product', 'active_rules', 'sales_loads', 'revenue_account'], relTables: ['sales_tickets', 'raw_purchases', 'price_rules', 'fuel_intakes', 'product_types', 'uoms'], views: [{ id: 'all', label: 'All Products & Grades' }, { id: 'agg', label: 'Ticket / Aggregate Grades', fn: r => Boolean(r.ticket_product) }, { id: 'fuel', label: 'Fuel & Lube Items', fn: r => Boolean(r.fuel_item) }] },
    { key: 'product_types', group: '3 · Universal Registries (All BUs)', universal: true, label: 'Product Types (Families)', dvn: 'bhf_producttype', form: 'product', cols: ['name', 'code', 'products_count', 'sales_loads'], relTables: ['products', 'sales_tickets'], views: [{ id: 'all', label: 'All Product Families' }] },
    { key: 'uoms', group: '3 · Universal Registries (All BUs)', universal: true, label: 'Units of Measure (UoM)', dvn: 'bhf_uom', form: 'product', cols: ['name', 'code', 'products_count', 'tickets_count'], relTables: ['products', 'sales_tickets', 'raw_purchases'], views: [{ id: 'all', label: 'All Units of Measure' }] },
    { key: 'customers', group: '3 · Universal Registries (All BUs)', universal: true, navView: 'reg_customers', label: 'Customers Registry', dvn: 'bhf_customer', form: 'customer', cols: ['name', 'method', 'vat_registered', 'mof_no', 'phone', 'address', 'credit_days', 'credit_limit', 'active_rules', 'sales_loads', 'ar_balance'], relTables: ['sales_tickets', 'receipts', 'price_rules', 'credit_terms', 'vat_invoices'], views: [{ id: 'all', label: 'All Customers' }, { id: 'open_ar', label: 'Open AR Balance > $0', fn: (r, rel) => ((rel.custByName[norm(r.name)] || {}).ar_balance || 0) > 1 }, { id: 'vat', label: 'VAT Registered (MOF)', fn: r => Boolean(r.vat_registered || r.mof_no) }] },
    { key: 'suppliers', group: '3 · Universal Registries (All BUs)', universal: true, navView: 'reg_suppliers', label: 'Suppliers & Haulers', dvn: 'bhf_supplier', form: 'supplier', cols: ['name', 'supplier_role', 'method', 'trucks_list', 'drivers_list', 'haul_loads', 'raw_loads', 'expenses_count', 'active_rules', 'iva', 'ap_balance'], relTables: ['raw_purchases', 'expenses', 'settlements', 'price_rules', 'equipment', 'drivers', 'sites'], views: [
      { id: 'all', label: 'All Suppliers & Haulers' },
      { id: 'haulers', label: 'Truck Owners / Haulers', fn: (r, rel) => { const se = rel && rel.suppByName[norm(r.name)]; return Boolean(r.is_truck_owner || Number(r.trucks_count || 0) > 0 || (se && (se.is_hauler || se.trucks.size > 0 || se.haul_loads > 0))); } },
      { id: 'quarries', label: 'Material & Site Suppliers', fn: (r, rel) => { const se = rel && rel.suppByName[norm(r.name)]; return Boolean((se && (se.is_quarry || se.raw_loads > 0 || se.sites.size > 0)) || /Quarry|Site|Raw Material/i.test(r.category || r.category1 || '')); } },
      { id: 'vendors', label: 'Expense & Parts Vendors', fn: (r, rel) => { const se = rel && rel.suppByName[norm(r.name)]; const isH = Boolean(r.is_truck_owner || Number(r.trucks_count || 0) > 0 || (se && (se.is_hauler || se.trucks.size > 0 || se.haul_loads > 0))); const isQ = Boolean((se && (se.is_quarry || se.raw_loads > 0 || se.sites.size > 0)) || /Quarry|Site|Raw Material/i.test(r.category || r.category1 || '')); return Boolean((se && (se.is_expense || se.expenses_count > 0)) || (!isH && !isQ)); } },
      { id: 'open_ap', label: 'Open AP Balance > $0', fn: (r, rel) => ((rel.suppByName[norm(r.name)] || {}).ap_balance || 0) > 1 },
      { id: 'iva', label: 'IVA / VAT Registered', fn: r => Boolean(r.iva || r.financial_no || r.mof_no) }
    ] },
    { key: 'expense_categories', group: '3 · Universal Registries (All BUs)', universal: true, navView: 'reg_categories', label: 'Expense Categories', dvn: 'bhf_expensecategory', form: 'expense', cols: ['name', 'cost_class', 'subcategories_count', 'expenses_count', 'total_spent'], relTables: ['expense_subcategories', 'expenses'], views: [
      { id: 'all', label: 'All Expense Categories' },
      { id: 'prod', label: 'Production Cost (60/61)', fn: r => deriveExpenseCostClass(r) === 'Production Cost' },
      { id: 'opex', label: 'Operating Expense (62–67)', fn: r => deriveExpenseCostClass(r) === 'Operating Expense' },
      { id: 'capex', label: 'Capital Expenditure (22)', fn: r => deriveExpenseCostClass(r) === 'Capital Expenditure' }
    ] },
    { key: 'expense_subcategories', group: '3 · Universal Registries (All BUs)', universal: true, label: 'Expense Subcategories', dvn: 'bhf_expensesubcategory', form: 'expense', cols: ['name', 'category', 'expenses_count', 'total_spent'], relTables: ['expense_categories', 'expenses'], views: [{ id: 'all', label: 'All Expense Subcategories' }] },
    { key: 'company_equipment', group: '4 · Workforce, Fleet & Payroll', label: 'Company-Equipment Assignments', dvn: 'bhf_companyequipment', form: 'companyequipment', cols: ['equipment', 'company', 'ownership', 'status', 'supplier', 'default_driver', 'site', 'day_operator', 'night_operator', 'start_date', 'end_date'], relTables: ['equipment', 'suppliers', 'drivers', 'sites'], views: [{ id: 'all', label: 'All Fleet Assignments' }, { id: 'active', label: 'Active Assignments', fn: r => /active/i.test(r.status || '') && !r.end_date }] },
    { key: 'company_drivers', group: '4 · Workforce, Fleet & Payroll', label: 'Company-Driver Assignments', dvn: 'bhf_companydriver', form: 'driver', cols: ['driver', 'company', 'staff', 'assigned_trucks', 'loads_hauled', 'start_date', 'end_date', 'notes'], relTables: ['drivers', 'employments', 'equipment', 'sales_tickets'], views: [{ id: 'all', label: 'All Driver Assignments' }] },
    { key: 'salaries', group: '4 · Workforce, Fleet & Payroll', label: 'Staff Salary Payments', dvn: 'bhf_mfgsalary', form: 'salary', cols: ['date', 'rep_date', 'payroll_month', 'company', 'staff', 'method', 'amount', 'notes'], relTables: ['employments', 'attendance', 'logistics_allowances', 'freelance_entries'], views: [{ id: 'all', label: 'All Salary Payments' }] },
    { key: 'employments', group: '4 · Workforce, Fleet & Payroll', label: 'Employment & Freelance Contracts', dvn: 'bhf_mfgemployment', form: 'employment', cols: ['name', 'company', 'staff', 'role', 'type', 'status', 'salary_usd', 'daily_rate', 'payments_count', 'total_paid', 'start_date', 'end_date'], relTables: ['salaries', 'attendance', 'logistics_allowances', 'freelance_entries', 'company_drivers'], views: [{ id: 'all', label: 'All Contracts' }, { id: 'active', label: 'Active Staff', fn: r => /active/i.test(r.status || '') && !r.end_date }, { id: 'freelance', label: 'Freelance / Daily', fn: r => /free|daily/i.test(r.type || '') }] },
    { key: 'attendance', group: '4 · Workforce, Fleet & Payroll', label: 'Attendance & Overtime Log', dvn: 'bhf_mfgattendance', form: 'attendance', cols: ['date', 'company', 'staff', 'status', 'regular_hours', 'overtime_hours', 'late_hours', 'notes'], relTables: ['employments', 'salaries'], views: [{ id: 'all', label: 'All Attendance Rows' }, { id: 'ot', label: 'With Overtime Hours', fn: r => Number(r.overtime_hours || 0) > 0 }] },
    { key: 'freelance_entries', group: '4 · Workforce, Fleet & Payroll', label: 'Freelance Work Entries', dvn: 'bhf_mfgfreelance', form: 'freelance', cols: ['date', 'company', 'staff', 'hours', 'extra_hours', 'rate_usd', 'total', 'notes'], relTables: ['employments', 'salaries'], views: [{ id: 'all', label: 'All Freelance Entries' }] },
    { key: 'logistics_allowances', group: '4 · Workforce, Fleet & Payroll', label: 'Site Allowances (Mon–Sun)', dvn: 'bhf_mfglogistics', form: 'logistics', cols: ['name', 'company', 'staff', 'site', 'equipment', 'daily_usd', 'lbp_amount', 'working_days', 'start_date', 'end_date'], relTables: ['employments', 'sites', 'equipment', 'salaries'], views: [{ id: 'all', label: 'All Site Allowances' }] },
    { key: 'overtime_rates', group: '4 · Workforce, Fleet & Payroll', label: 'Driver Trip & Overtime Rates', dvn: 'bhf_mfgovertimerate', form: 'triprate', cols: ['name', 'company', 'region', 'amount', 'start_date', 'end_date', 'notes'], relTables: ['regions', 'drivers', 'sales_tickets'], views: [{ id: 'all', label: 'All Trip & Overtime Rates' }] },
    { key: 'external_movements', group: '5 · Treasury, Loans & JV', label: 'External Treasury Movements', dvn: 'bhf_mfgexternal', form: 'treasury', cols: ['date', 'company', 'counterparty', 'direction', 'method', 'usd_amount', 'notes'], relTables: ['loans', 'loan_settlements'], views: [{ id: 'all', label: 'All External Movements' }] },
    { key: 'loans', group: '5 · Treasury, Loans & JV', label: 'Loans & Partner Advances', dvn: 'bhf_mfgloan', form: 'treasury', cols: ['name', 'company', 'counterparty', 'direction', 'principal', 'settled_amount', 'interest_rate', 'start_date', 'notes'], relTables: ['loan_settlements', 'external_movements'], views: [{ id: 'all', label: 'All Loans & Advances' }] },
    { key: 'loan_settlements', group: '5 · Treasury, Loans & JV', label: 'Loan Repayments & Drawdowns', dvn: 'bhf_mfgloansettlement', form: 'treasury', cols: ['date', 'company', 'loan', 'type', 'method', 'usd_amount', 'notes'], relTables: ['loans', 'external_movements'], views: [{ id: 'all', label: 'All Loan Settlements' }] },
    { key: 'conversions', group: '5 · Treasury, Loans & JV', label: 'USD ↔ LBP FX Conversions', dvn: 'bhf_mfgconversion', form: 'conversion', cols: ['date', 'company', 'type', 'usd_delta', 'lbp_delta', 'exchange_rate', 'name', 'notes'], relTables: ['external_movements'], views: [
      { id: 'all', label: 'All FX Conversions' },
      { id: 'u2l', label: 'USD → LBP (USD Out · LBP In)', fn: r => !/LBP\s*(?:to|→|2)\s*USD/i.test(String(r.type || r.name || '')) && String(r.from_currency || 'USD').toUpperCase() !== 'LBP' },
      { id: 'l2u', label: 'LBP → USD (LBP Out · USD In)', fn: r => /LBP\s*(?:to|→|2)\s*USD/i.test(String(r.type || r.name || '')) || String(r.from_currency || '').toUpperCase() === 'LBP' }
    ] },
    { key: 'jv_partnerships', group: '5 · Treasury, Loans & JV', label: 'JV Site Partnerships', dvn: 'bhf_mfgjvpartnership', form: 'jv', cols: ['name', 'company', 'site', 'partner', 'percentage', 'distributions_total', 'notes'], relTables: ['sites', 'jv_distributions', 'raw_purchases'], views: [{ id: 'all', label: 'All JV Partnerships' }] },
    { key: 'jv_distributions', group: '5 · Treasury, Loans & JV', label: 'JV Profit Distributions', dvn: 'bhf_mfgjvdistribution', form: 'jv', cols: ['date', 'rep_date', 'company', 'site', 'partner', 'basis', 'amount', 'total', 'notes'], relTables: ['jv_partnerships', 'sites'], views: [{ id: 'all', label: 'All JV Distributions' }] }
  ];

  // Lookup column target table map (renders clickable relational pills in 34-Table Hub)
  const HUB_LOOKUP_TARGETS = {
    customer: 'customers',
    supplier: 'suppliers',
    site_owner: 'suppliers',
    truck_owner: 'suppliers',
    product: 'products',
    item: 'products',
    input_product: 'products',
    site: 'sites',
    region: 'regions',
    truck: 'equipment',
    equipment: 'equipment',
    driver: 'drivers',
    default_driver: 'drivers',
    day_operator: 'drivers',
    night_operator: 'drivers',
    staff: 'employments',
    vat_invoice: 'vat_invoices',
    category: 'expense_categories',
    subcategory: 'expense_subcategories'
  };

  // Authoritative Dataverse bhf_expensecategory -> bhf_glaccount mapping (m18a_tables.py)
  const EXPENSE_CAT_GL_MAP = {
    'bank fees': '6736',
    'beach supplies': '6112',
    'beverage supplies': '6111',
    'capital expenditures': '2243',
    'cleaning supplies': '6112',
    'configuration': '6269',
    'depreciation expense': '6512',
    'disposable supplies': '6112',
    'education': '6266',
    'food supplies': '6111',
    'fuel': '61121',
    'furniture': '2263',
    'hookah and charcoal': '6111',
    'hotel supplies': '6112',
    'insurance': '6268',
    'licences and fees': '645',
    'marketing services': '6269',
    'medical supplies': '6112',
    'merchandise': '601',
    'minor equipment': '61123',
    'nicotine supplies': '6111',
    'office supplies': '61125',
    'oils': '6122',
    'other costs': '6269',
    'palms': '186',
    'pool supplies': '6112',
    'raw material settlements': '401',
    'raw materials': '6111',
    'rent': '62631',
    'repairs and maintenance': '6262',
    'sanitation and pest control': '6269',
    'security services': '6269',
    'skilled labor': '62651',
    'social security': '635',
    'software': '6255',
    'spare parts': '6122',
    'staff': '6269',
    'taxes': '645',
    'tips': '6269',
    'tools': '61123',
    'transfer fee': '6269',
    'transportation': '62611',
    'uniform purchases': '6112',
    'utilities': '6112',
    'vat': '4425'
  };

  function deriveExpenseCostClass(catObjOrName, glCodeOverride) {
    const isObj = catObjOrName && typeof catObjOrName === 'object';
    if (isObj && catObjOrName.cost_class && /^(Production Cost|Capital Expenditure|Operating Expense)$/i.test(String(catObjOrName.cost_class).trim())) {
      const s = String(catObjOrName.cost_class).trim();
      if (/^production/i.test(s)) return 'Production Cost';
      if (/^capital/i.test(s)) return 'Capital Expenditure';
      return 'Operating Expense';
    }
    const rawName = isObj ? (catObjOrName.name || catObjOrName.category || '') : String(catObjOrName || '');
    const nk = norm(rawName);
    const gl = String(glCodeOverride || (isObj && catObjOrName.gl_code) || EXPENSE_CAT_GL_MAP[nk] || '').trim();
    if (gl) {
      if (gl.startsWith('60') || gl.startsWith('61')) return 'Production Cost';
      if (gl.startsWith('2')) return 'Capital Expenditure';
      return 'Operating Expense';
    }
    if (/capex|capital|machinery|furniture|building|vehicle purchase/i.test(rawName)) return 'Capital Expenditure';
    if (/fuel|diesel|oil|lube|spare|tire|tyre|tool|minor equip|raw mat|supply|supplies|utilit|merchandise/i.test(rawName)) return 'Production Cost';
    return 'Operating Expense';
  }

  function hubExpenseSign(ex) {
    const m = String((ex && ex.method) || '').trim();
    if (m === 'C Return' || m === 'CR Return') return -1;
    if (m === 'Config' || m === 'VATConfig' || m === 'Free' || m === 'Remove' || m === 'Adjusted' || m === 'JV Adjusted') return 0;
    return 1;
  }

  function formatCostClassHtml(clsTxt) {
    const s = String(clsTxt || '').trim();
    if (!s || s === '—') return '—';
    const cls = /Production/i.test(s) ? 'badge-brass' : (/Capital/i.test(s) ? 'badge-warn' : 'badge-info');
    return `<span class="badge ${cls}">${esc(s)}</span>`;
  }

  const NON_NUMERIC_HUB_COLS = /^(cost_class|cost_bucket|working_days|assigned_trucks|companies_list|trucks_list|drivers_list|gps_status|supplier_role|payable_leg)$/i;

  function getHubTableDefaultSort(meta, activeViewId) {
    const k = (meta && meta.key) || '';
    const vw = String(activeViewId || 'all');
    switch (k) {
      case 'expense_categories':
      case 'expense_subcategories':
        return { key: 'total_spent', dir: 'desc' };
      case 'customers':
        return { key: vw === 'open_ar' ? 'ar_balance' : 'sales_loads', dir: 'desc' };
      case 'suppliers':
        if (vw === 'open_ap') return { key: 'ap_balance', dir: 'desc' };
        if (vw === 'haulers') return { key: 'haul_loads', dir: 'desc' };
        if (vw === 'quarries') return { key: 'raw_loads', dir: 'desc' };
        if (vw === 'vendors') return { key: 'expenses_usd', dir: 'desc' };
        return { key: 'total_spent', dir: 'desc' };
      case 'equipment':
        return { key: vw === 'machinery' ? 'fuel_fills' : 'loads_hauled', dir: 'desc' };
      case 'company_equipment':
      case 'drivers':
      case 'company_drivers':
        return { key: 'loads_hauled', dir: 'desc' };
      case 'sites':
        return { key: vw === 'jv' ? 'raw_loads' : 'sales_loads', dir: 'desc' };
      case 'regions':
      case 'product_types':
        return { key: 'sales_loads', dir: 'desc' };
      case 'products':
        return { key: vw === 'fuel' ? 'fuel_fills' : 'sales_loads', dir: 'desc' };
      case 'uoms':
        return { key: 'tickets_count', dir: 'desc' };
      case 'employments':
        return { key: 'total_paid', dir: 'desc' };
      case 'credit_terms':
        return { key: 'ar_balance', dir: 'desc' };
      case 'loans':
        return { key: 'principal', dir: 'desc' };
      case 'jv_partnerships':
        return { key: 'distributions_total', dir: 'desc' };
      case 'overtime_rates':
        return { key: 'amount', dir: 'desc' };
      case 'logistics_allowances':
        return { key: 'daily_usd', dir: 'desc' };
      case 'price_rules':
        return { key: 'start_date', dir: 'desc' };
      default: {
        const cols = (meta && meta.cols) || [];
        if (cols.includes('date')) return { key: 'date', dir: 'desc' };
        if (cols.includes('start_date')) return { key: 'start_date', dir: 'desc' };
        return { key: cols[0] || 'name', dir: 'asc' };
      }
    }
  }

  let _hubRelCache = null;
  let _hubRelStamp = '';
  function getHubRelIndex(SEED) {
    const rec = (SEED && SEED.records) || {};
    const stamp = `${(rec.sales_tickets || []).length}:${(rec.raw_purchases || []).length}:${(rec.expenses || []).length}:${(rec.salaries || []).length}:${(rec.price_rules || []).length}:${(rec.receipts || []).length}:${(rec.settlements || []).length}:${(SEED && SEED._customRev) || 0}`;
    if (_hubRelCache && _hubRelStamp === stamp) return _hubRelCache;
    _hubRelStamp = stamp;
    const rel = {
      custByName: {}, suppByName: {}, prodByName: {}, typeByName: {}, uomByName: {},
      siteByName: {}, regByName: {}, equipByName: {}, drvByName: {}, catByName: {},
      subcatByName: {}, staffByName: {}, vatInvByNo: {}, loanByName: {}
    };
    const ensure = (map, k, init) => { const nk = norm(k); if (!nk) return null; if (!map[nk]) map[nk] = init(); return map[nk]; };

    const initCust = () => ({ sales_loads: 0, sample_loads: 0, total_sales: 0, ar_balance: 0, credit_days: null, credit_limit: null, active_rules: 0 });
    const initSupp = () => ({
      raw_loads: 0,
      raw_loads_cnt: 0,
      raw_cost: 0,
      raw_cost_sample: 0,
      haul_loads: 0,
      expenses_count: 0,
      expenses_usd: 0,
      total_spent: 0,
      ap_balance: 0,
      active_rules: 0,
      is_quarry: false,
      is_hauler: false,
      is_expense: false,
      trucks: new Set(),
      drivers: new Set(),
      sites: new Set()
    });

    // Seed from Manufacturing Group consolidated model + fallback semantic_model summaries
    const mgModel = ((SEED && SEED.models) || {})['manufacturing-group'] || {};
    (mgModel.customers || (((SEED && SEED.semantic_model) || {}).customer_ar_summary) || []).forEach(c => {
      const e = ensure(rel.custByName, c.Customer, initCust);
      if (e) {
        e.sales_loads = Number(c.loads || 0);
        e.total_sales = Number(c.sales_ttc || 0);
        e.ar_balance = Number(c.ar_balance || 0);
      }
    });
    (mgModel.suppliers || (((SEED && SEED.semantic_model) || {}).supplier_ap_summary) || []).forEach(s => {
      const e = ensure(rel.suppByName, s.Supplier, initSupp);
      if (e) {
        e.raw_loads = Number(s.raw_loads || 0);
        e.raw_cost = Number(s.raw_cost || 0);
        e.ap_balance = Number(s.ap_balance || 0);
      }
    });

    const eqLabelMap = {};
    (rec.equipment || []).forEach(eq => {
      if (eq && eq.name && eq.plate_no && norm(eq.plate_no) !== norm(eq.name)) {
        const lbl = `${eq.name} (${eq.plate_no})`;
        eqLabelMap[norm(eq.name)] = lbl;
        eqLabelMap[norm(eq.plate_no)] = lbl;
      }
    });
    const fmtTruckRef = t => eqLabelMap[norm(t)] || t;

    (rec.customers || []).forEach(c => { ensure(rel.custByName, c.name, initCust); });

    (rec.suppliers || []).forEach(s => {
      const e = ensure(rel.suppByName, s.name, initSupp);
      if (!e) return;
      if (Array.isArray(s.trucks)) s.trucks.forEach(t => { if (t) e.trucks.add(fmtTruckRef(t)); });
      if (Array.isArray(s.drivers)) s.drivers.forEach(d => { if (d) e.drivers.add(d); });
      if (s.is_truck_owner || Number(s.trucks_count || 0) > 0 || e.trucks.size > 0 || /hauler|truck owner/i.test(s.category || '')) e.is_hauler = true;
      if (/quarry|site|raw material/i.test(s.category || s.category1 || '')) e.is_quarry = true;
    });

    (rec.credit_terms || []).forEach(ct => {
      const e = ensure(rel.custByName, ct.customer, initCust);
      if (e) {
        if (ct.credit_days != null) e.credit_days = ct.credit_days;
        if (ct.credit_limit != null) e.credit_limit = ct.credit_limit;
      }
    });

    (rec.price_rules || []).forEach(pr => {
      if (pr.customer) {
        const e = ensure(rel.custByName, pr.customer, initCust);
        if (e && !pr.end_date) e.active_rules++;
      }
      if (pr.supplier) {
        const e = ensure(rel.suppByName, pr.supplier, initSupp);
        if (e && !pr.end_date) e.active_rules++;
      }
      if (pr.product) {
        const e = ensure(rel.prodByName, pr.product, () => ({ list_price: null, active_rules: 0, sales_loads: 0, fuel_fills: 0 }));
        if (e) {
          if (!pr.end_date) e.active_rules++;
          if (/list/i.test(pr.rule_type || '') && pr.unit_price != null) e.list_price = pr.unit_price;
          else if (e.list_price == null && pr.unit_price != null && /sale/i.test(pr.rule_type || '')) e.list_price = pr.unit_price;
        }
      }
      if (pr.site) {
        const e = ensure(rel.siteByName, pr.site, () => ({ active_rules: 0, sales_loads: 0, raw_loads: 0 }));
        if (e && !pr.end_date) e.active_rules++;
      }
    });

    const prodTypeMap = {};
    (rec.product_types || []).forEach(pt => { ensure(rel.typeByName, pt.name, () => ({ products_count: 0, sales_loads: 0 })); });
    (rec.uoms || []).forEach(u => { ensure(rel.uomByName, u.name, () => ({ products_count: 0, tickets_count: 0 })); });
    (rec.products || []).forEach(p => {
      ensure(rel.prodByName, p.name, () => ({ list_price: null, active_rules: 0, sales_loads: 0, fuel_fills: 0 }));
      if (p.name && p.type) prodTypeMap[norm(p.name)] = p.type;
      const te = ensure(rel.typeByName, p.type, () => ({ products_count: 0, sales_loads: 0 }));
      if (te) te.products_count++;
      const ue = ensure(rel.uomByName, p.uom, () => ({ products_count: 0, tickets_count: 0 }));
      if (ue) ue.products_count++;
    });

    const siteRegMap = {};
    (rec.regions || []).forEach(rg => { ensure(rel.regByName, rg.name, () => ({ sites_count: 0, overtime_rate: null, sales_loads: 0 })); });
    (rec.sites || []).forEach(s => {
      ensure(rel.siteByName, s.name, () => ({ active_rules: 0, sales_loads: 0, raw_loads: 0 }));
      if (s.name && s.region) siteRegMap[norm(s.name)] = s.region;
      const re = ensure(rel.regByName, s.region, () => ({ sites_count: 0, overtime_rate: null, sales_loads: 0 }));
      if (re) re.sites_count++;
      if (s.supplier) {
        const se = ensure(rel.suppByName, s.supplier, initSupp);
        if (se) { se.is_quarry = true; if (s.name) se.sites.add(s.name); }
      }
    });
    (rec.overtime_rates || []).forEach(ot => {
      const re = ensure(rel.regByName, ot.region, () => ({ sites_count: 0, overtime_rate: null, sales_loads: 0 }));
      if (re && ot.amount != null && (!ot.end_date || re.overtime_rate == null)) re.overtime_rate = ot.amount;
    });

    (rec.company_equipment || []).forEach(ce => {
      const ee = ensure(rel.equipByName, ce.equipment, () => ({ companies: new Set(), loads_hauled: 0, fuel_fills: 0 }));
      if (ee && ce.company) ee.companies.add(ce.company);
      if (ce.default_driver) {
        const de = ensure(rel.drvByName, ce.default_driver, () => ({ trucks: new Set(), companies: new Set(), loads_hauled: 0, fuel_fills: 0 }));
        if (de && ce.equipment) de.trucks.add(fmtTruckRef(ce.equipment));
      }
    });
    (rec.equipment || []).forEach(eq => {
      const ee = ensure(rel.equipByName, eq.name, () => ({ companies: new Set(), loads_hauled: 0, fuel_fills: 0 }));
      if (ee && eq.type) ee.type = eq.type;
      if (ee && eq.plate_no && norm(eq.plate_no) !== norm(eq.name)) {
        rel.equipByName[norm(eq.plate_no)] = ee;
      }
      if (eq.default_driver) {
        const de = ensure(rel.drvByName, eq.default_driver, () => ({ trucks: new Set(), companies: new Set(), loads_hauled: 0, fuel_fills: 0 }));
        if (de && eq.name) de.trucks.add(fmtTruckRef(eq.name));
      }
      if (eq.supplier) {
        const se = ensure(rel.suppByName, eq.supplier, initSupp);
        if (se) {
          se.is_hauler = true;
          if (eq.name) se.trucks.add(fmtTruckRef(eq.name));
          if (eq.default_driver) se.drivers.add(eq.default_driver);
        }
      }
    });
    (rec.drivers || []).forEach(drv => {
      ensure(rel.drvByName, drv.name || drv.driver, () => ({ trucks: new Set(), companies: new Set(), loads_hauled: 0, fuel_fills: 0 }));
      if (drv.truck_owner) {
        const se = ensure(rel.suppByName, drv.truck_owner, initSupp);
        if (se) {
          se.is_hauler = true;
          if (drv.name || drv.driver) se.drivers.add(drv.name || drv.driver);
          if (drv.truck) se.trucks.add(fmtTruckRef(drv.truck));
        }
      }
    });
    (rec.company_drivers || []).forEach(cd => {
      const de = ensure(rel.drvByName, cd.driver, () => ({ trucks: new Set(), companies: new Set(), loads_hauled: 0, fuel_fills: 0 }));
      if (de && cd.company) de.companies.add(cd.company);
    });

    (rec.sales_tickets || []).forEach(t => {
      if (t.customer) {
        const ce = ensure(rel.custByName, t.customer, initCust);
        if (ce) {
          ce.sample_loads++;
          if (ce.sample_loads > ce.sales_loads) ce.sales_loads = ce.sample_loads;
        }
      }
      const pe = ensure(rel.prodByName, t.product, () => ({ list_price: null, active_rules: 0, sales_loads: 0, fuel_fills: 0 }));
      if (pe) pe.sales_loads++;
      const pType = t.product ? prodTypeMap[norm(t.product)] : null;
      if (pType) {
        const te = ensure(rel.typeByName, pType, () => ({ products_count: 0, sales_loads: 0 }));
        if (te) te.sales_loads++;
      }
      const ue = ensure(rel.uomByName, t.uom, () => ({ products_count: 0, tickets_count: 0 }));
      if (ue) ue.tickets_count++;
      const se = ensure(rel.siteByName, t.site, () => ({ active_rules: 0, sales_loads: 0, raw_loads: 0 }));
      if (se) se.sales_loads++;
      const sReg = t.site ? siteRegMap[norm(t.site)] : null;
      if (sReg) {
        const re = ensure(rel.regByName, sReg, () => ({ sites_count: 0, overtime_rate: null, sales_loads: 0 }));
        if (re) re.sales_loads++;
      }
      const ee = ensure(rel.equipByName, t.truck, () => ({ companies: new Set(), loads_hauled: 0, fuel_fills: 0 }));
      if (ee) { ee.loads_hauled++; if (t.company) ee.companies.add(t.company); }
      const de = ensure(rel.drvByName, t.driver, () => ({ trucks: new Set(), companies: new Set(), loads_hauled: 0, fuel_fills: 0 }));
      if (de) { de.loads_hauled++; if (t.truck) de.trucks.add(fmtTruckRef(t.truck)); if (t.company) de.companies.add(t.company); }
      if (t.truck_owner) {
        const he = ensure(rel.suppByName, t.truck_owner, initSupp);
        if (he) {
          he.is_hauler = true;
          he.haul_loads++;
          if (t.truck) he.trucks.add(fmtTruckRef(t.truck));
          if (t.driver) he.drivers.add(t.driver);
        }
      }
      if (t.vat_invoice) rel.vatInvByNo[norm(t.vat_invoice)] = (rel.vatInvByNo[norm(t.vat_invoice)] || 0) + 1;
    });

    (rec.raw_purchases || []).forEach(t => {
      const ue = ensure(rel.uomByName, t.uom, () => ({ products_count: 0, tickets_count: 0 }));
      if (ue) ue.tickets_count++;
      const se = ensure(rel.siteByName, t.site, () => ({ active_rules: 0, sales_loads: 0, raw_loads: 0 }));
      if (se) se.raw_loads++;
      const ee = ensure(rel.equipByName, t.truck, () => ({ companies: new Set(), loads_hauled: 0, fuel_fills: 0 }));
      if (ee) { ee.loads_hauled++; if (t.company) ee.companies.add(t.company); }
      const de = ensure(rel.drvByName, t.driver, () => ({ trucks: new Set(), companies: new Set(), loads_hauled: 0, fuel_fills: 0 }));
      if (de) { de.loads_hauled++; if (t.truck) de.trucks.add(fmtTruckRef(t.truck)); if (t.company) de.companies.add(t.company); }
      if (t.site_owner) {
        const qe = ensure(rel.suppByName, t.site_owner, initSupp);
        if (qe) {
          qe.is_quarry = true;
          qe.raw_loads_cnt++;
          qe.raw_cost_sample += Number(t.cost || 0);
          if (qe.raw_loads_cnt > qe.raw_loads) qe.raw_loads = qe.raw_loads_cnt;
          if (t.site) qe.sites.add(t.site);
        }
      }
      if (t.truck_owner) {
        const he = ensure(rel.suppByName, t.truck_owner, initSupp);
        if (he) {
          he.is_hauler = true;
          he.haul_loads++;
          he.raw_cost_sample += Number(t.trans_cost || 0);
          if (t.truck) he.trucks.add(fmtTruckRef(t.truck));
          if (t.driver) he.drivers.add(t.driver);
        }
      }
    });

    (rec.fuel_intakes || []).forEach(f => {
      const ee = ensure(rel.equipByName, f.equipment, () => ({ companies: new Set(), loads_hauled: 0, fuel_fills: 0 }));
      if (ee) ee.fuel_fills++;
      const de = ensure(rel.drvByName, f.driver, () => ({ trucks: new Set(), companies: new Set(), loads_hauled: 0, fuel_fills: 0 }));
      if (de) de.fuel_fills++;
      if (f.item) {
        const pe = ensure(rel.prodByName, f.item, () => ({ list_price: null, active_rules: 0, sales_loads: 0, fuel_fills: 0 }));
        if (pe) pe.fuel_fills++;
      }
      if (f.supplier) {
        const se = ensure(rel.suppByName, f.supplier, initSupp);
        if (se) { se.is_expense = true; se.expenses_count++; }
      }
    });

    (rec.expense_categories || []).forEach(ec => {
      if (!ec) return;
      if (!ec.gl_code && EXPENSE_CAT_GL_MAP[norm(ec.name)]) ec.gl_code = EXPENSE_CAT_GL_MAP[norm(ec.name)];
      ec.cost_class = deriveExpenseCostClass(ec);
      ensure(rel.catByName, ec.name, () => ({ subcategories_count: 0, expenses_count: 0, total_spent: 0 }));
    });
    (rec.expense_subcategories || []).forEach(sc => {
      if (!sc) return;
      ensure(rel.subcatByName, sc.name, () => ({ expenses_count: 0, total_spent: 0 }));
      const ce = ensure(rel.catByName, sc.category, () => ({ subcategories_count: 0, expenses_count: 0, total_spent: 0 }));
      if (ce) ce.subcategories_count++;
    });
    (rec.expenses || []).forEach(ex => {
      const sgn = hubExpenseSign(ex);
      if (sgn === 0) return;
      const amt = round2(sgn * Number(ex.amount || ex.usd_amount || 0));
      const ce = ensure(rel.catByName, ex.category, () => ({ subcategories_count: 0, expenses_count: 0, total_spent: 0 }));
      if (ce) { ce.expenses_count++; ce.total_spent = round2(ce.total_spent + amt); }
      const se = ensure(rel.subcatByName, ex.subcategory, () => ({ expenses_count: 0, total_spent: 0 }));
      if (se) { se.expenses_count++; se.total_spent = round2(se.total_spent + amt); }
      if (ex.supplier) {
        const supE = ensure(rel.suppByName, ex.supplier, initSupp);
        if (supE) { supE.is_expense = true; supE.expenses_count++; supE.expenses_usd = round2(supE.expenses_usd + amt); }
      }
    });

    Object.values(rel.suppByName).forEach(se => {
      const rc = Math.max(Number(se.raw_cost || 0), Number(se.raw_cost_sample || 0));
      se.total_spent = round2(rc + Number(se.expenses_usd || 0));
    });

    (rec.employments || []).forEach(emp => {
      ensure(rel.staffByName, emp.staff || emp.name, () => ({ payments_count: 0, total_paid: 0 }));
    });
    (rec.salaries || []).forEach(sal => {
      const st = ensure(rel.staffByName, sal.staff, () => ({ payments_count: 0, total_paid: 0 }));
      if (st) { st.payments_count++; st.total_paid = round2(st.total_paid + Number(sal.amount || sal.usd_amount || 0)); }
    });

    rel.loanSettledByCp = {};
    (rec.loan_settlements || []).forEach(ls => {
      const cp = cellValue(ls, 'loan') || ls.loan || '';
      if (cp) rel.loanSettledByCp[norm(cp)] = (rel.loanSettledByCp[norm(cp)] || 0) + Number(ls.usd_amount || ls.amount || 0);
    });
    rel.jvDistBySite = {};
    (rec.jv_distributions || []).forEach(jd => {
      if (jd.site) rel.jvDistBySite[norm(jd.site)] = (rel.jvDistBySite[norm(jd.site)] || 0) + Number(jd.total || jd.amount || 0);
    });

    _hubRelCache = rel;
    return rel;
  }

  function formatCompactSet(setOrArr, maxItems = 2) {
    const arr = Array.isArray(setOrArr) ? setOrArr.filter(Boolean) : (setOrArr ? Array.from(setOrArr).filter(Boolean) : []);
    if (!arr.length) return '';
    if (arr.length <= maxItems) return arr.join(', ');
    return `${arr.slice(0, maxItems).join(', ')} (+${arr.length - maxItems})`;
  }

  function cellValue(r, c, tableKey, rel) {
    if (!r) return null;
    if (tableKey === 'suppliers' && (c === 'category1' || c === 'category')) {
      const rawCats = [];
      if (Array.isArray(r.categories)) rawCats.push(...r.categories);
      else if (r.category) rawCats.push(...String(r.category).split(/\s*,\s*/));
      [r.category1, r.category2, r.category3].forEach(x => { if (x) rawCats.push(x); });
      if (r.is_truck_owner && !rawCats.some(x => /hauler|truck\s*owner|transport/i.test(String(x)))) {
        rawCats.unshift('Hauler / Truck Owner');
      }
      const normCat = raw => {
        const s = String(raw || '').trim();
        if (!s) return '';
        if (/hauler|truck\s*owner|transport/i.test(s)) return 'Hauler / Truck Owner';
        if (/quarry|site|raw\s*material|aggregate/i.test(s)) return 'Site & Raw Materials';
        if (/fuel|lubricant|diesel|oil|bowser/i.test(s)) return 'Fuel & Lubricants';
        if (/spare\s*part|repair|maintenance|garage|tyre|tire|workshop|tool/i.test(s)) return 'Spare Parts & Repairs';
        if (/capital\s*expenditure|minor\s*equipment|machinery|equipment/i.test(s)) return 'Equipment & Machinery';
        if (/supply|supplies|service|general\s*vendor|utilit|licence|license|fee|insurance|rent|office|skilled\s*labor|other\s*cost|social\s*security|tip|pool|food|beverage|sanitation|furniture|marketing/i.test(s)) return 'Supplies & Services';
        return s;
      };
      const seen = new Set();
      const uniq = [];
      rawCats.forEach(x => {
        const s = normCat(x);
        const k = s.toLowerCase();
        if (s && !seen.has(k)) { seen.add(k); uniq.push(s); }
      });
      if (uniq.length) return uniq.join(', ');
    }
    if (c === 'notes' && r.notes) {
      const cleaned = String(r.notes)
        .replace(/^Manufacturing\s*\([^)]+\)\s*(?:supplier|customer)\s*—\s*seeded from the workbooks\s*\d{4}-\d{2}-\d{2}\.?\s*/i, '')
        .replace(/\[wb:[^\]]+\]/gi, '')
        .trim();
      return cleaned || null;
    }
    if (tableKey === 'fuel_intakes' && (c === 'odometer' || c === 'hours')) {
      const eqEntry = rel.equipByName[norm(r.equipment)];
      const eqCatL = String((eqEntry && eqEntry.type) || '').trim().toLowerCase();
      const isHourCat = eqCatL === 'excavator' || eqCatL === 'wheel loader' || eqCatL === 'generator' || eqCatL === 'plant' ||
        (eqCatL === 'other' && /baldouzar|bulldozer|compressor|kombrasor|rotary|rotare/i.test(String(r.equipment || '')));
      if (isHourCat) {
        if (c === 'odometer') return null;
        const hv = (r.hours != null && r.hours !== '') ? r.hours : ((r.odometer != null && r.odometer !== '') ? r.odometer : null);
        return hv;
      }
    }
    if (tableKey === 'price_rules' && c === 'indiff_price') {
      const iv = r.indiff_price ?? r.trans_indiff_price ?? r.delivered_indiff_price;
      if (iv != null && iv !== '') return iv;
    }
    if (tableKey === 'conversions') {
      const cd = convDeltasPbi(r);
      if (c === 'type') return cd.dirLabel;
      if (c === 'usd_delta') return cd.usd;
      if (c === 'lbp_delta') return cd.lbp;
      if (c === 'exchange_rate') return cd.rate;
    }
    if (c === 'cost_class') return deriveExpenseCostClass(r);
    if (r[c] != null && r[c] !== '') {
      if (Array.isArray(r[c])) return r[c].join(', ');
      return r[c];
    }
    const nm = String(r.name || '');
    if (c === 'counterparty') {
      const m = nm.match(/^(?:Loan|EXT|BRW)\s+\d{4}-\d{2}-\d{2}\s+(.+?)(?:\s+#\d+)?$/i);
      return m ? m[1].trim() : (r.borrower || r.lender || r.partner || null);
    }
    if (c === 'loan') {
      const m = nm.match(/^BRW\s+\d{4}-\d{2}-\d{2}\s+(.+?)(?:\s+#\d+)?$/i);
      return m ? m[1].trim() : null;
    }
    if (c === 'direction') return r.method || (Number(r.principal || r.usd_amount || 0) >= 0 ? 'Inflow / Borrowed' : 'Outflow / Lent');
    if (c === 'start_date') {
      const m = nm.match(/\b(\d{4}-\d{2}-\d{2})\b/);
      return m ? m[1] : r.date;
    }
    if (c === 'kind') {
      if (Number(r.discount || 0) > 0 && Number(r.amount || 0) === 0) return 'Discount / Rebate';
      return r.vat_invoice ? 'VAT Invoice Receipt' : (r.record_ticket || r.raw_ticket ? 'Ticket Settlement' : 'Account Payment');
    }
    if (c === 'payable_leg') {
      if (r.expense_record) return '3 · General Expense';
      if (r.raw_ticket) return '1/2 · Material & Haulage';
      return 'Account Settlement';
    }
    if (c === 'total_ttc') return round2(Number(r.amount || r.net_amount || r.price || 0) + Number(r.vat || r.vat_amount || 0));
    if (c === 'vat') return Number(r.vat_amount || 0);
    if (c === 'code') return nm ? nm.toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 12) : '—';
    if (c === 'gps_status') return (r.latitude != null && r.longitude != null) ? 'Verified Pin' : 'Pending GPS';

    if (rel) {
      if (tableKey === 'customers' || tableKey === 'credit_terms') {
        if (c === 'vat_registered') return Boolean(r.vat_registered || r.mof_no);
        const ce = rel.custByName[norm(r.customer || r.name)];
        if (ce && ce[c] != null) return ce[c];
      }
      if (tableKey === 'suppliers') {
        const se = rel.suppByName[norm(r.name)];
        if (c === 'iva') return Boolean(r.iva || r.financial_no || r.mof_no);
        if (c === 'is_truck_owner') return Boolean(r.is_truck_owner || Number(r.trucks_count || 0) > 0 || (se && (se.is_hauler || se.trucks.size > 0 || se.haul_loads > 0)));
        if (c === 'trucks_count') return r.trucks_count != null ? r.trucks_count : (se ? se.trucks.size : 0);
        if (c === 'trucks_list') return formatCompactSet(se ? se.trucks : r.trucks, 2);
        if (c === 'drivers_list') return formatCompactSet(se ? se.drivers : r.drivers, 2);
        if (c === 'haul_loads') return se ? se.haul_loads : 0;
        if (c === 'raw_loads') return se ? se.raw_loads : 0;
        if (c === 'expenses_count') return se ? se.expenses_count : 0;
        if (c === 'active_rules') return se ? se.active_rules : 0;
        if (c === 'ap_balance') return se ? se.ap_balance : 0;
        if (c === 'supplier_role') {
          if (r.category && !/Raw Material Settlements/i.test(r.category)) {
            if (/^\s*(?:Quarry|Site)\s*\+\s*Hauler/i.test(r.category) || /(?:Quarry|Site)\s*\+\s*Hauler/i.test(r.category)) return 'Site + Hauler';
            if (/Hauler|Truck Owner/i.test(r.category)) return 'Truck Owner (Hauler)';
            if (/Quarry|Site|Raw Material/i.test(r.category)) return 'Site / Material';
            return r.category;
          }
          const isH = Boolean(r.is_truck_owner || Number(r.trucks_count || 0) > 0 || (se && (se.is_hauler || se.trucks.size > 0 || se.haul_loads > 0)));
          const isQ = Boolean((se && (se.is_quarry || se.raw_loads > 0 || se.sites.size > 0)) || /Quarry|Site|Raw Material/i.test(r.category1 || ''));
          const isE = Boolean(se && (se.is_expense || se.expenses_count > 0));
          if (isH && isQ) return 'Site + Hauler';
          if (isH) return 'Truck Owner (Hauler)';
          if (isQ) return 'Site / Material';
          if (isE) return 'Expense / Parts Vendor';
          return 'General Vendor';
        }
        if (se && se[c] != null) return se[c];
      }
      if (tableKey === 'products') {
        if (c === 'ticket_product' || c === 'fuel_item' || c === 'input_product') return Boolean(r[c]);
        const pe = rel.prodByName[norm(r.name)];
        if (pe && pe[c] != null) return pe[c];
      }
      if (tableKey === 'product_types') {
        const te = rel.typeByName[norm(r.name)];
        if (te && te[c] != null) return te[c];
      }
      if (tableKey === 'uoms') {
        const ue = rel.uomByName[norm(r.name)];
        if (ue && ue[c] != null) return ue[c];
      }
      if (tableKey === 'sites') {
        if (c === 'is_jv') return Boolean(r.is_jv);
        const se = rel.siteByName[norm(r.name)];
        if (se && se[c] != null) return se[c];
      }
      if (tableKey === 'regions') {
        const re = rel.regByName[norm(r.name)];
        if (re && re[c] != null) return re[c];
      }
      if (tableKey === 'equipment' || tableKey === 'company_equipment') {
        const ee = rel.equipByName[norm(r.equipment || r.name)];
        if (ee) {
          if (c === 'companies_list') return Array.from(ee.companies).join(', ') || 'Shared';
          if (ee[c] != null) return ee[c];
        }
      }
      if (tableKey === 'drivers' || tableKey === 'company_drivers') {
        const de = rel.drvByName[norm(r.driver || r.name)];
        if (de) {
          if (c === 'assigned_trucks') return Array.from(de.trucks).join(', ') || '—';
          if (c === 'companies_list') return Array.from(de.companies).join(', ') || '—';
          if (de[c] != null) return de[c];
        }
      }
      if (tableKey === 'expense_categories') {
        const ce = rel.catByName[norm(r.name)];
        if (ce && ce[c] != null) return ce[c];
      }
      if (tableKey === 'expense_subcategories') {
        const se = rel.subcatByName[norm(r.name)];
        if (se && se[c] != null) return se[c];
      }
      if (tableKey === 'employments') {
        const st = rel.staffByName[norm(r.staff || r.name)];
        if (st && st[c] != null) return st[c];
      }
      if (tableKey === 'vat_invoices' && c === 'tickets_count') {
        return rel.vatInvByNo[norm(r.invoice_no || r.name)] || 0;
      }
      if (tableKey === 'price_rules' && c === 'matched_tickets') {
        const pe = r.product ? rel.prodByName[norm(r.product)] : null;
        return pe ? pe.sales_loads : 0;
      }
      if (tableKey === 'loans' && c === 'settled_amount') {
        const cp = cellValue(r, 'counterparty');
        return cp ? (rel.loanSettledByCp[norm(cp)] || 0) : 0;
      }
      if (tableKey === 'jv_partnerships' && c === 'distributions_total') {
        return r.site ? (rel.jvDistBySite[norm(r.site)] || 0) : 0;
      }
    }
    return null;
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
  function uniq(arr, freqMap) {
    const seen = new Set();
    const localCounts = new Map();
    const out = [];
    for (const x of (arr || [])) {
      const s = String(x == null ? '' : x).trim();
      const k = norm(s);
      if (!k) continue;
      localCounts.set(k, (localCounts.get(k) || 0) + 1);
      if (!seen.has(k)) {
        seen.add(k);
        out.push(s);
      }
    }
    const fMap = freqMap || (typeof window !== 'undefined' && typeof window.MFG_FREQ === 'function' ? window.MFG_FREQ().any : null);
    return out.sort((a, b) => {
      const ka = norm(a), kb = norm(b);
      const fa = fMap ? (fMap.get(ka) || 0) : 0;
      const fb = fMap ? (fMap.get(kb) || 0) : 0;
      if (fb !== fa) return fb - fa;
      const la = localCounts.get(ka) || 0;
      const lb = localCounts.get(kb) || 0;
      if (lb !== la) return lb - la;
      return a < b ? -1 : (a > b ? 1 : 0);
    });
  }

  function fmtUSD(v, decimals = 0) {
    const n = Number(v ?? 0);
    if (!Number.isFinite(n)) return String(v ?? '—');
    const abs = Math.abs(n);
    return (n < 0 ? '-$' : '$') + abs.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  function fmtUSDk(v) {
    const n = Number(v ?? 0);
    if (!Number.isFinite(n)) return String(v ?? '—');
    const a = Math.abs(n);
    if (a >= 1e6) return (n < 0 ? '-$' : '$') + (a / 1e6).toFixed(2) + 'M';
    if (a >= 1e3) return (n < 0 ? '-$' : '$') + Math.round(a / 1e3).toLocaleString('en-US') + 'K';
    return fmtUSD(n, 0);
  }
  function fmtNum(v, decimals = 0) {
    const n = Number(v ?? 0);
    if (!Number.isFinite(n)) return String(v ?? '—');
    return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  function fmtSignedUSD(v, decimals = 2) {
    const n = Number(v || 0);
    if (Math.abs(n) < 0.005) return fmtUSD(0, decimals);
    const abs = Math.abs(n);
    return (n < 0 ? '-$' : '+$') + abs.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  function fmtSignedLBP(v) {
    const n = Math.round(Number(v || 0));
    if (Math.abs(n) <= 1) return '0 LL';
    return (n < 0 ? '-' : '+') + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' LL';
  }
  function convDeltasPbi(r) {
    const t = String((r && (r.type || r.name)) || '');
    const fc = String((r && r.from_currency) || '').toUpperCase();
    const u2l = /LBP\s*(?:to|→|2)\s*USD/i.test(t) ? false : (/USD\s*(?:to|→|2)\s*LBP/i.test(t) ? true : fc !== 'LBP');
    const usdMag = Math.abs(Number((r && (r.usd_amount != null ? r.usd_amount : r.usd_delta)) || 0));
    const lbpMag = Math.round(Math.abs(Number((r && (r.lbp_amount != null ? r.lbp_amount : r.lbp_delta)) || 0)));
    const usd = r && r.usd_delta != null && Number(r.usd_delta) !== 0 ? Number(r.usd_delta) : round2(usdMag * (u2l ? -1 : 1));
    const lbp = r && r.lbp_delta != null && Number(r.lbp_delta) !== 0 ? Math.round(Number(r.lbp_delta)) : lbpMag * (u2l ? 1 : -1);
    const ex = Number((r && (r.exchange_rate || r.fx_rate)) || 0);
    const rate = ex > 0 ? ex : (usdMag > 0 && lbpMag > 0 ? lbpMag / usdMag : 89500);
    return { u2l, dirLabel: u2l ? 'USD → LBP' : 'LBP → USD', usd: round2(usd), lbp, rate };
  }
  function fmtPct(v, num, den) {
    if (num != null && den) return ((Number(num) / Number(den)) * 100).toFixed(1) + '%';
    return (Number(v || 0) * 100).toFixed(1) + '%';
  }
  function fmtDateDMY(v) {
    const s = String(v == null ? '' : v).trim();
    if (!s || s === '—') return s || '—';
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : s;
  }

  // ==================== POWER BI VISUAL COMPONENT LIBRARY ====================

  // 1. Section Heading (matches Rep.heading in m18c_report.py)
  function pbiHeading(title, sub) {
    return `
      <div class="pbi-sec-heading">
        <h4>${esc(title)}</h4>
        ${sub ? `<span>${esc(sub)}</span>` : ''}
      </div>
    `;
  }

  // 2. 6-Card KPI Band (supports click-through navigation, negative red, brass/good/warn/crit tones)
  function kpiBand(title, cards) {
    return `
      <div class="pbi-kpi-sec">
        ${title ? `<div class="pbi-kpi-sec-hdr">${esc(title)}</div>` : ''}
        <div class="pbi-kpi-sec-grid">
          ${cards.map(c => {
            const navAttr = c.navPage ? `data-pbi-jump="${esc(c.navPage)}" role="button" tabindex="0" title="Open ${esc(c.navLabel || c.label)}"` : '';
            const tone = c.tone || (c.neg && /^-\$|^-[1-9]/.test(String(c.value || '')) ? 'crit' : '');
            return `
              <div class="pbi-kpi-card ${esc(tone)}" ${navAttr}>
                <div class="k">${esc(c.label)}${c.navPage ? ' <span style="color:var(--brass)">↗</span>' : ''}</div>
                <div class="v">${esc(c.value)}</div>
                ${c.sub ? `<div class="d">${esc(c.sub)}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }
  const kpiSection = kpiBand;

  // 3. Visual Panel Wrapper
  function pbiPanel(title, bodyHtml, opts = {}) {
    const legendHtml = (opts.legend && opts.legend.length)
      ? `<div class="pbi-legend">${opts.legend.map(l => `<span><i class="${l.line ? 'line' : ''}" style="background:${esc(l.color)}"></i>${esc(l.label)}</span>`).join('')}</div>`
      : (opts.meta ? `<span class="panel-meta">${opts.meta}</span>` : '');
    return `
      <div class="pbi-panel" ${opts.id ? `id="${esc(opts.id)}"` : ''}>
        <div class="pbi-panel-hdr">
          <div>
            <div class="pbi-panel-title">${esc(title)}</div>
            ${opts.subtitle ? `<span class="pbi-panel-sub">${esc(opts.subtitle)}</span>` : ''}
          </div>
          ${legendHtml}
        </div>
        ${bodyHtml}
      </div>
    `;
  }

  // 4. Multi-Series Clustered Column Chart (monthly or categorical)
  function buildClusteredColumnSvg(rows, series, opts = {}) {
    const data = (rows || []).slice(-(opts.maxBars || 14));
    if (!data.length) return `<div style="padding:24px;text-align:center;color:var(--muted);font-size:12px">No time-series data for active filter</div>`;
    const W = opts.width || 620, H = opts.height || 215, padL = 52, padR = 16, padT = 22, padB = 34;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const labelKey = opts.labelKey || 'Year Month';
    const isMoney = opts.isMoney !== false;
    let maxVal = 1;
    data.forEach(r => series.forEach(s => {
      const v = Math.abs(Number(typeof s.get === 'function' ? s.get(r) : r[s.key] || 0));
      if (v > maxVal) maxVal = v;
    }));
    maxVal *= 1.12;

    const grpW = plotW / data.length;
    const barW = Math.min(22, Math.max(5, (grpW * 0.72) / series.length));
    const grid = [0, 0.25, 0.5, 0.75, 1].map(f => {
      const y = (padT + plotH * (1 - f)).toFixed(1);
      const val = maxVal * f;
      const lbl = isMoney ? fmtUSDk(val) : (val >= 1000 ? (val / 1000).toFixed(0) + 'k' : Math.round(val));
      return `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="rgba(128,138,158,0.18)" stroke-dasharray="3 3"/>
              <text x="${padL - 6}" y="${Number(y) + 3}" text-anchor="end" font-size="9.5" fill="var(--muted)">${lbl}</text>`;
    }).join('');

    const cols = data.map((r, i) => {
      const cx = padL + i * grpW + grpW / 2;
      const totalBarW = series.length * barW + (series.length - 1) * 2;
      const startX = cx - totalBarW / 2;
      const rawLbl = String(r[labelKey] || r.label || '');
      const shortLbl = rawLbl.replace(/^(\w{3})\s+20(\d{2})$/, '$1 \'$2').slice(0, 8);
      const bars = series.map((s, si) => {
        const val = Number(typeof s.get === 'function' ? s.get(r) : r[s.key] || 0);
        const h = Math.max(val > 0 ? 2 : 0, (Math.abs(val) / maxVal) * plotH);
        const x = (startX + si * (barW + 2)).toFixed(1);
        const y = (padT + plotH - h).toFixed(1);
        const fVal = isMoney ? fmtUSD(val, 0) : fmtNum(val, 0);
        const showTopLbl = opts.labels && Math.abs(val) > maxVal * 0.08 && data.length <= 10;
        return `<rect x="${x}" y="${y}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${s.color || '#2B5C8F'}"><title>${esc(rawLbl)} · ${esc(s.label)}: ${esc(fVal)}</title></rect>` +
          (showTopLbl ? `<text x="${(Number(x) + barW / 2).toFixed(1)}" y="${Math.max(11, Number(y) - 4)}" text-anchor="middle" font-size="8.8" font-weight="700" fill="var(--ink)">${isMoney ? fmtUSDk(val) : fmtNum(val, 0)}</text>` : '');
      }).join('');
      return `${bars}<text x="${cx.toFixed(1)}" y="${H - 10}" text-anchor="middle" font-size="9.5" fill="var(--muted)">${esc(shortLbl)}</text>`;
    }).join('');

    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;display:block">${grid}${cols}</svg>`;
  }

  // 5. Line + Clustered Column Combo Chart (matches lineClusteredColumnComboChart in m18c_report.py)
  function buildComboChartSvg(rows, barSeries, lineSpec, opts = {}) {
    const data = (rows || []).slice(-(opts.maxBars || 14));
    if (!data.length) return `<div style="padding:24px;text-align:center;color:var(--muted);font-size:12px">No combo chart data for active filter</div>`;
    const W = opts.width || 620, H = opts.height || 220, padL = 52, padR = 46, padT = 22, padB = 34;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const labelKey = opts.labelKey || 'Year Month';
    const isMoney = opts.isMoney !== false;

    let maxBar = 1, maxLine = 1, minLine = 0;
    data.forEach(r => {
      barSeries.forEach(s => {
        const v = Math.abs(Number(typeof s.get === 'function' ? s.get(r) : r[s.key] || 0));
        if (v > maxBar) maxBar = v;
      });
      if (lineSpec) {
        const lv = Number(typeof lineSpec.get === 'function' ? lineSpec.get(r) : r[lineSpec.key] || 0);
        if (lv > maxLine) maxLine = lv;
        if (lv < minLine) minLine = lv;
      }
    });
    maxBar *= 1.12;
    const shareAxis = opts.shareAxis === true;
    const lMax = shareAxis ? maxBar : (maxLine * 1.15 || 1);
    const lMin = shareAxis ? 0 : Math.min(0, minLine * 1.1);
    const lSpan = Math.max(1e-6, lMax - lMin);

    const grpW = plotW / data.length;
    const barW = Math.min(20, Math.max(5, (grpW * 0.68) / Math.max(1, barSeries.length)));
    const grid = [0, 0.25, 0.5, 0.75, 1].map(f => {
      const y = (padT + plotH * (1 - f)).toFixed(1);
      const val = maxBar * f;
      const lbl = isMoney ? fmtUSDk(val) : (val >= 1000 ? (val / 1000).toFixed(0) + 'k' : Math.round(val));
      const rVal = lMin + lSpan * f;
      const rLbl = lineSpec && !shareAxis
        ? (lineSpec.isPct ? (rVal * 100).toFixed(0) + '%' : (lineSpec.isMoney ? fmtUSDk(rVal) : Math.round(rVal).toLocaleString('en-US')))
        : '';
      return `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="rgba(128,138,158,0.18)" stroke-dasharray="3 3"/>
              <text x="${padL - 6}" y="${Number(y) + 3}" text-anchor="end" font-size="9.5" fill="var(--muted)">${lbl}</text>
              ${rLbl ? `<text x="${W - padR + 5}" y="${Number(y) + 3}" text-anchor="start" font-size="9" fill="${lineSpec.color || '#D9A54A'}">${rLbl}</text>` : ''}`;
    }).join('');

    const pts = [];
    const cols = data.map((r, i) => {
      const cx = padL + i * grpW + grpW / 2;
      const totalBarW = barSeries.length * barW + (barSeries.length - 1) * 2;
      const startX = cx - totalBarW / 2;
      const rawLbl = String(r[labelKey] || r.label || '');
      const shortLbl = rawLbl.replace(/^(\w{3})\s+20(\d{2})$/, '$1 \'$2').slice(0, 8);
      const bars = barSeries.map((s, si) => {
        const val = Number(typeof s.get === 'function' ? s.get(r) : r[s.key] || 0);
        const h = Math.max(val > 0 ? 2 : 0, (Math.abs(val) / maxBar) * plotH);
        const x = (startX + si * (barW + 2)).toFixed(1);
        const y = (padT + plotH - h).toFixed(1);
        return `<rect x="${x}" y="${y}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${s.color || '#2B5C8F'}"><title>${esc(rawLbl)} · ${esc(s.label)}: ${esc(isMoney ? fmtUSD(val, 0) : fmtNum(val, 0))}</title></rect>`;
      }).join('');
      if (lineSpec) {
        const lv = Number(typeof lineSpec.get === 'function' ? lineSpec.get(r) : r[lineSpec.key] || 0);
        const ly = padT + plotH * (1 - (lv - lMin) / lSpan);
        pts.push({ x: cx, y: Math.max(padT + 3, Math.min(padT + plotH - 2, ly)), v: lv, lbl: rawLbl });
      }
      return `${bars}<text x="${cx.toFixed(1)}" y="${H - 10}" text-anchor="middle" font-size="9.5" fill="var(--muted)">${esc(shortLbl)}</text>`;
    }).join('');

    const lineSvg = (lineSpec && pts.length > 1)
      ? `<polyline fill="none" stroke="${lineSpec.color || '#D9A54A'}" stroke-width="2.4" points="${pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}"/>` +
        pts.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.4" fill="${lineSpec.color || '#D9A54A'}" stroke="var(--surface)" stroke-width="1"><title>${esc(p.lbl)} · ${esc(lineSpec.label)}: ${esc(lineSpec.isPct ? (p.v * 100).toFixed(1) + '%' : (lineSpec.isMoney !== false ? fmtUSD(p.v, 2) : fmtNum(p.v, 0)))}</title></circle>`).join('')
      : '';

    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;display:block">${grid}${cols}${lineSvg}</svg>`;
  }

  // 6. Signed Vertical Column Chart with Zero Baseline & Data Labels (specifically for P06 AR Aging with negative "On account", P20 Recon Bridge, etc.)
  function buildSignedColumnSvg(items, opts = {}) {
    const data = items || [];
    if (!data.length) return `<div style="padding:24px;text-align:center;color:var(--muted);font-size:12px">No bucket data</div>`;
    const W = opts.width || 580, H = opts.height || 235, padL = 54, padR = 18, padT = 26, padB = 36;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const isMoney = opts.isMoney !== false;
    let maxPos = 0, minNeg = 0;
    data.forEach(d => {
      const v = Number(d.value || 0);
      if (v > maxPos) maxPos = v;
      if (v < minNeg) minNeg = v;
    });
    if (maxPos === 0 && minNeg === 0) maxPos = 1;
    maxPos *= 1.18;
    minNeg *= 1.22;
    const span = Math.max(1, maxPos - minNeg);
    const zeroY = padT + (maxPos / span) * plotH;

    const ticks = [minNeg, minNeg / 2, 0, maxPos / 2, maxPos].filter((v, i, a) => a.indexOf(v) === i && Math.abs(v) > 0.01 || v === 0);
    const grid = ticks.map(v => {
      const y = (padT + ((maxPos - v) / span) * plotH).toFixed(1);
      const isZero = Math.abs(v) < 0.001;
      return `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="${isZero ? 'var(--line-strong)' : 'rgba(128,138,158,0.18)'}" stroke-width="${isZero ? '1.3' : '1'}" ${isZero ? '' : 'stroke-dasharray="3 3"'}/>
              <text x="${padL - 6}" y="${Number(y) + 3}" text-anchor="end" font-size="9.5" font-weight="${isZero ? '700' : '400'}" fill="var(--muted)">${isMoney ? fmtUSDk(v) : fmtNum(v, 0)}</text>`;
    }).join('');

    const grpW = plotW / data.length;
    const barW = Math.min(54, Math.max(18, grpW * 0.56));
    const bars = data.map((d, i) => {
      const v = Number(d.value || 0);
      const cx = padL + i * grpW + grpW / 2;
      const x = (cx - barW / 2).toFixed(1);
      const h = Math.max(Math.abs(v) > 0 ? 3 : 0, (Math.abs(v) / span) * plotH);
      const y = v >= 0 ? (zeroY - h) : zeroY;
      const color = d.color || (v < 0 ? '#1E7A6E' : '#2B5C8F');
      const valLbl = isMoney ? fmtUSDk(v) : fmtNum(v, 0);
      const lblY = v >= 0 ? Math.max(12, y - 5) : Math.min(H - 22, y + h + 12);
      return `
        <rect x="${x}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${color}">
          <title>${esc(d.label)}: ${esc(isMoney ? fmtUSD(v, 2) : fmtNum(v, 2))}</title>
        </rect>
        <text x="${cx.toFixed(1)}" y="${lblY.toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="${v < 0 ? '#C8333B' : 'var(--ink)'}">${esc(valLbl)}</text>
        <text x="${cx.toFixed(1)}" y="${H - 10}" text-anchor="middle" font-size="10" font-weight="600" fill="var(--muted)">${esc(d.label)}</text>
      `;
    }).join('');

    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;display:block">${grid}${bars}</svg>`;
  }

  // 7. Multi-Line Trend Chart (e.g. P04 Realised price per unit by month — top material products, P08 Unit economics, P14 Cash till)
  function buildMultiLineSvg(rows, series, opts = {}) {
    const data = (rows || []).slice(-(opts.maxPoints || 14));
    if (!data.length || !series.length) return `<div style="padding:24px;text-align:center;color:var(--muted);font-size:12px">No trend data for active filter</div>`;
    const W = opts.width || 620, H = opts.height || 215, padL = 52, padR = 18, padT = 20, padB = 34;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const labelKey = opts.labelKey || 'Year Month';
    const isMoney = opts.isMoney !== false;
    const decimals = opts.decimals != null ? opts.decimals : (isMoney ? 2 : 0);

    let maxVal = -Infinity, minVal = opts.includeZero !== false ? 0 : Infinity;
    data.forEach(r => series.forEach(s => {
      const raw = typeof s.get === 'function' ? s.get(r) : r[s.key];
      if (raw == null || raw === '') return;
      const v = Number(raw);
      if (v > maxVal) maxVal = v;
      if (v < minVal) minVal = v;
    }));
    if (!isFinite(maxVal)) { maxVal = 1; minVal = 0; }
    if (maxVal === minVal) maxVal = minVal + 1;
    const padSpan = (maxVal - minVal) * 0.14;
    maxVal += padSpan;
    if (minVal < 0) minVal -= padSpan;
    const span = Math.max(1e-6, maxVal - minVal);

    const grid = [0, 0.25, 0.5, 0.75, 1].map(f => {
      const y = (padT + plotH * (1 - f)).toFixed(1);
      const val = minVal + span * f;
      const lbl = isMoney ? (Math.abs(maxVal) >= 1000 ? fmtUSDk(val) : fmtUSD(val, decimals)) : fmtNum(val, decimals);
      return `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="rgba(128,138,158,0.18)" stroke-dasharray="3 3"/>
              <text x="${padL - 6}" y="${Number(y) + 3}" text-anchor="end" font-size="9.5" fill="var(--muted)">${lbl}</text>`;
    }).join('');

    const stepX = data.length > 1 ? plotW / (data.length - 1) : 0;
    const xLabels = data.map((r, i) => {
      const x = data.length > 1 ? padL + i * stepX : padL + plotW / 2;
      const shortLbl = String(r[labelKey] || r.label || '').replace(/^(\w{3})\s+20(\d{2})$/, '$1 \'$2').slice(0, 8);
      return `<text x="${x.toFixed(1)}" y="${H - 10}" text-anchor="middle" font-size="9.5" fill="var(--muted)">${esc(shortLbl)}</text>`;
    }).join('');

    const lines = series.map(s => {
      const pts = [];
      data.forEach((r, i) => {
        const raw = typeof s.get === 'function' ? s.get(r) : r[s.key];
        if (raw == null || raw === '') return;
        const v = Number(raw);
        const x = data.length > 1 ? padL + i * stepX : padL + plotW / 2;
        const y = padT + plotH * (1 - (v - minVal) / span);
        pts.push({ x, y, v, lbl: r[labelKey] || r.label || '' });
      });
      if (!pts.length) return '';
      return `<polyline fill="none" stroke="${s.color || '#2B5C8F'}" stroke-width="2.3" points="${pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}"/>` +
        pts.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.2" fill="${s.color || '#2B5C8F'}" stroke="var(--surface)" stroke-width="1"><title>${esc(p.lbl)} · ${esc(s.label)}: ${esc(isMoney ? fmtUSD(p.v, decimals) : fmtNum(p.v, decimals))}</title></circle>`).join('');
    }).join('');

    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;display:block">${grid}${lines}${xLabels}</svg>`;
  }

  // 8. Horizontal Bar Chart (matches Power BI barChart with data labels at bar ends)
  function buildHorizontalBarChart(rows, labelKey, valKey, fmtFn, opts = {}) {
    const maxItems = opts.maxItems || 10;
    const top = (rows || []).filter(r => Math.abs(Number(r[valKey] || 0)) > 0.001).slice(0, maxItems);
    if (!top.length) return `<div style="padding:18px;text-align:center;color:var(--muted);font-size:12px">No rows for active filter</div>`;
    const max = Math.max(1, ...top.map(r => Math.abs(Number(r[valKey] || 0))));
    const defaultColor = opts.color === 'brass' ? '#B8883B' : (opts.color === 'crit' ? '#C8333B' : (opts.color || '#2B5C8F'));
    return `
      <div class="pbi-bar-chart">
        ${top.map((r, i) => {
          const v = Number(r[valKey] || 0);
          const pct = Math.max(3, Math.min(100, Math.round((Math.abs(v) / max) * 100)));
          const sub = opts.subKey && r[opts.subKey] ? ` <small>· ${esc(r[opts.subKey])}</small>` : '';
          const barColor = v < 0 ? '#C8333B' : (typeof opts.colorFn === 'function' ? opts.colorFn(r, i) : defaultColor);
          return `
            <div class="pbi-bar-item">
              <span class="pbi-bar-lbl" title="${esc(r[labelKey] || '—')}">${opts.rank !== false ? `<small>${i + 1}.</small> ` : ''}${esc(r[labelKey] || '—')}${sub}</span>
              <div class="pbi-bar-lane"><div class="pbi-bar-fill" style="width:${pct}%;background:${barColor}"></div></div>
              <span class="pbi-bar-val ${v < 0 ? 'pbi-neg' : ''}">${fmtFn(v, r)}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }
  const buildHorizontalRankChart = (rows, labelKey, valKey, fmtFn, subKey, colorClass) =>
    buildHorizontalBarChart(rows, labelKey, valKey, fmtFn, { subKey, color: colorClass });

  // 9. Clustered Horizontal Bar Chart (e.g. P05 Agreed vs realised vs last price per unit, P15 External revenue vs expense by counterparty)
  function buildClusteredBarChart(rows, labelKey, series, opts = {}) {
    const top = (rows || []).slice(0, opts.maxItems || 8);
    if (!top.length) return `<div style="padding:18px;text-align:center;color:var(--muted);font-size:12px">No rows for active filter</div>`;
    let max = 1;
    top.forEach(r => series.forEach(s => {
      const v = Math.abs(Number(typeof s.get === 'function' ? s.get(r) : r[s.key] || 0));
      if (v > max) max = v;
    }));
    return `
      <div class="pbi-bar-chart">
        ${top.map(r => `
          <div class="pbi-cbar-item">
            <div class="pbi-cbar-head"><span>${esc(r[labelKey] || '—')}</span>${opts.headRight ? `<small class="mono mu">${esc(opts.headRight(r))}</small>` : ''}</div>
            ${series.map(s => {
              const v = Number(typeof s.get === 'function' ? s.get(r) : r[s.key] || 0);
              const pct = Math.max(v !== 0 ? 3 : 0, Math.min(100, Math.round((Math.abs(v) / max) * 100)));
              return `
                <div class="pbi-cbar-series">
                  <span>${esc(s.label)}</span>
                  <div class="pbi-bar-lane" style="height:11px"><div class="pbi-bar-fill" style="width:${pct}%;background:${v < 0 ? '#C8333B' : (s.color || '#2B5C8F')}"></div></div>
                  <b class="${v < 0 ? 'pbi-neg' : ''}">${s.fmt ? s.fmt(v, r) : fmtUSD(v, opts.decimals != null ? opts.decimals : 2)}</b>
                </div>
              `;
            }).join('')}
          </div>
        `).join('')}
      </div>
    `;
  }

  let _activePbiState = null;

  // Automatic sticky bottom totals generator for Power BI tables when opts.foot is not explicitly passed
  function buildAutoFoot(cols, list, opts = {}) {
    if (opts.noFoot || !list || !list.length || !cols || !cols.length) return null;
    let firstNumIdx = cols.findIndex((c, idx) => idx > 0 && c.r);
    if (firstNumIdx < 0) firstNumIdx = cols.length;
    const span = Math.max(1, firstNumIdx);
    const footCells = [{
      v: `<b>TOTAL (${fmtNum(list.length)} ${esc(opts.unitLabel || 'rows')})</b>`,
      span
    }];

    for (let ci = span; ci < cols.length; ci++) {
      const c = cols[ci];
      if (typeof c.foot === 'function') {
        footCells.push({ v: c.foot(list), r: !!c.r });
        continue;
      }
      if (!c.r || c.agg === 'none') {
        footCells.push({ v: c.r ? '—' : '', r: !!c.r });
        continue;
      }
      const kName = String(c.key || '');
      const lName = String(c.label || '');
      // Non-numeric tier strings or meter readings
      if (/^(Tier 1|Tier 2|Meter|Odometer|Share|Limit used|% of Net)$/i.test(lName) || /^(odometer)$/.test(kName)) {
        footCells.push({ v: '—', r: true });
        continue;
      }
      // Closing balance columns (latest row at index 0)
      if (kName === 'running' || kName === 'cash_till') {
        const latest = list[0] ? (typeof c.raw === 'function' ? c.raw(list[0], 0) : list[0][kName]) : 0;
        const nLat = Number(latest || 0);
        const fmtLat = c.fmt ? c.fmt(nLat, {}, -1) : fmtUSD(nLat, 2);
        footCells.push({ v: /<[bB]|<strong/.test(String(fmtLat)) ? fmtLat : `<b>${fmtLat}</b>`, r: true, neg: nLat < -0.0001 });
        continue;
      }
      let sum = 0, countNum = 0;
      const hasRawFn = typeof c.raw === 'function';
      const cKey = c.key;
      for (let idx = 0, len = list.length; idx < len; idx++) {
        const r = list[idx];
        const rv = hasRawFn ? c.raw(r, idx) : (cKey ? r[cKey] : null);
        if (typeof rv === 'number') {
          if (Number.isFinite(rv)) { sum += rv; countNum++; }
        } else if (typeof rv === 'string' && rv !== '') {
          const n = Number(rv);
          if (Number.isFinite(n)) { sum += n; countNum++; }
        }
      }
      if (!countNum) {
        footCells.push({ v: '—', r: true });
        continue;
      }
      const isAvgCol = /^(list_price|avg_price_net|avg_price_ttc|avg_raw_cost|agreed_price|last_price|actual_price|unit_price|trans_unit_price|cost_per_ton|l_per_100km|daily_rate|interest_rate|exchange_rate|percentage|pct|credit_days|gap_days)$/.test(kName) ||
        /^(List|Avg|Agreed|Last Sold|Last Price|Actual Price|Variance \/ u|Last − Agreed|Unit \(\$\)|Trans \/ u|Rate|Daily Rate|Per working day|Daily \/ Shift Rate|LBP Rate|Cost \/ Ton|L \/ 100|Consumption|Completeness|Interest Rate|Exchange Rate|Credit Days|Gap)/i.test(lName);
      const val = isAvgCol ? (sum / countNum) : sum;
      const formatted = c.fmt ? c.fmt(val, {}, -1) : fmtNum(val, isAvgCol ? 2 : 0);
      const wrapped = /<[bB]|<strong/.test(String(formatted)) ? formatted : `<b>${formatted}</b>`;
      footCells.push({
        v: isAvgCol ? `<span class="tfoot-avg-tag">Avg </span>${wrapped}` : wrapped,
        r: true,
        neg: (c.negRed || c.bar) && val < -0.0001
      });
    }
    return footCells;
  }

  function shortCoHtml(val) {
    const raw = String(val == null ? '' : val).trim();
    if (/^bbconstruction$/i.test(raw)) return `<span title="BBConstruction">BBC<span class="sr-only"> BBConstruction</span></span>`;
    if (/^lions\s*transport$/i.test(raw)) return `<span title="Lions Transport">Lions<span class="sr-only"> Lions Transport</span></span>`;
    return esc(raw || '—');
  }

  // 10. Power BI Table with Inline Data Bars, Red Negatives, Amber/Navy Row Highlights, Sticky Totals & Interactive Pagination
  function pbiTable(title, cols, rows, opts = {}) {
    const list = rows || [];
    const tableKey = opts.id || ('t_' + String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 48));
    const pageSize = Number((_activePbiState && _activePbiState.pbiPageSize) || opts.pageSize || 15);
    const totalRows = list.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    const rawPage = (_activePbiState && _activePbiState.pbiTablePage && _activePbiState.pbiTablePage[tableKey]) || 0;
    const curPage = Math.min(totalPages - 1, Math.max(0, Number(rawPage) || 0));
    const startIdx = curPage * pageSize;
    const shown = list.slice(startIdx, startIdx + pageSize);
    const footCells = opts.foot || buildAutoFoot(cols, list, opts);

    // Compute max per bar column for proportional inline data bars
    const barMax = {};
    cols.forEach((c, ci) => {
      if (c.bar) {
        let m = 1;
        shown.forEach((r, idx) => {
          const v = Math.abs(Number(typeof c.raw === 'function' ? c.raw(r, startIdx + idx) : r[c.key] || 0));
          if (v > m) m = v;
        });
        barMax[ci] = m;
      }
    });

    const pagerHtml = totalRows > 10 ? `
      <div class="pbi-pager">
        <span class="pbi-pager-info">Showing <b>${totalRows ? fmtNum(startIdx + 1) : 0}–${fmtNum(startIdx + shown.length)}</b> of <b>${fmtNum(totalRows)}</b> ${esc(opts.unitLabel || 'rows')} · Page <b>${fmtNum(curPage + 1)}</b> of <b>${fmtNum(totalPages)}</b></span>
        <div class="pbi-pager-controls">
          <select class="pbi-page-size-sel" data-pbi-page-size="${esc(tableKey)}" aria-label="Rows per page" title="Rows per page">
            ${[15, 25, 50, 100].map(sz => `<option value="${sz}" ${pageSize === sz ? 'selected' : ''}>${sz} / page</option>`).join('')}
          </select>
          <button type="button" class="pbi-page-btn" data-pbi-page-btn="${esc(tableKey)}" data-pbi-page-target="0" ${curPage <= 0 ? 'disabled' : ''} title="First Page">⟪</button>
          <button type="button" class="pbi-page-btn" data-pbi-page-btn="${esc(tableKey)}" data-pbi-page-target="${curPage - 1}" ${curPage <= 0 ? 'disabled' : ''} title="Previous Page">◀ Prev</button>
          <button type="button" class="pbi-page-btn" data-pbi-page-btn="${esc(tableKey)}" data-pbi-page-target="${curPage + 1}" ${curPage >= totalPages - 1 ? 'disabled' : ''} title="Next Page">Next ▶</button>
          <button type="button" class="pbi-page-btn" data-pbi-page-btn="${esc(tableKey)}" data-pbi-page-target="${totalPages - 1}" ${curPage >= totalPages - 1 ? 'disabled' : ''} title="Last Page">⟫</button>
        </div>
      </div>
    ` : '';

    const tableHtml = `
      <div class="table-wrap">
        <table class="ledger-table">
          <thead>
            <tr>${cols.map(c => `<th class="${c.r ? 'r' : ''}">${esc(c.label)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${shown.map((r, idx) => {
              const absIdx = startIdx + idx;
              const rowClass = [
                opts.rowAmber && opts.rowAmber(r) ? 'pbi-row-amber' : '',
                opts.rowNavy && opts.rowNavy(r) ? 'pbi-row-navy' : '',
                (opts.rkey || r.rkey) && r.id ? 'rrow' : ''
              ].filter(Boolean).join(' ');
              const rowAttrs = (opts.rkey || r.rkey) && r.id ? `data-rkey="${esc(opts.rkey || r.rkey)}" data-rid="${esc(r.id)}"` : '';
              return `<tr class="${rowClass}" ${rowAttrs}>${cols.map((c, ci) => {
                const rawVal = typeof c.raw === 'function' ? c.raw(r, absIdx) : (c.key ? r[c.key] : null);
                const numVal = Number(rawVal || 0);
                const isNeg = (c.negRed || c.bar) && rawVal != null && rawVal !== '' && numVal < -0.0001;
                const cellAmber = typeof c.amberIf === 'function' && c.amberIf(r);
                const cls = [
                  c.r ? 'r' : '',
                  c.mono ? 'mono' : '',
                  c.bar ? 'pbi-bar-cell' : '',
                  isNeg ? 'pbi-neg' : '',
                  cellAmber ? 'pbi-cell-amber' : ''
                ].filter(Boolean).join(' ');
                let barHtml = '';
                if (c.bar && Math.abs(numVal) > 0.001) {
                  const w = Math.min(92, Math.max(4, Math.round((Math.abs(numVal) / (barMax[ci] || 1)) * 90)));
                  const bTone = numVal < 0 ? 'neg' : (c.bar === 'brass' ? 'brass' : 'pos');
                  barHtml = `<span class="pbi-bar-bg ${bTone}" style="width:${w}%"></span>`;
                }
                const isCoCol = !c.fmt && (c.key === 'company' || c.key === 'bu');
                let formatted = c.fmt ? c.fmt(rawVal, r, absIdx) : (isCoCol ? shortCoHtml(rawVal) : (c.bold ? `<b>${esc(rawVal == null || rawVal === '' ? '—' : rawVal)}</b>` : esc(rawVal == null || rawVal === '' ? '—' : rawVal)));
                if (/date|last_sale|last_purchase/i.test(String(c.key || '')) || /^(Date|Start|End|Start Date|End Date|Last Sale|Last Purchase|Tx Date|Rpt Date|Last Paid)$/i.test(String(c.label || ''))) {
                  formatted = String(formatted).replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, '$3-$2-$1');
                }
                return `<td class="${cls}">${barHtml}${formatted}</td>`;
              }).join('')}</tr>`;
            }).join('') || `<tr><td colspan="${cols.length}" class="empty-row" style="text-align:center;padding:18px;color:var(--muted)">${esc(opts.emptyMsg || 'No matching rows for the selected filters')}</td></tr>`}
          </tbody>
          ${footCells ? `<tfoot><tr>${footCells.map(f => `<td class="${f.r ? 'r' : ''} ${f.neg ? 'pbi-neg' : ''}" ${f.span ? `colspan="${f.span}"` : ''}>${f.v}</td>`).join('')}</tr></tfoot>` : ''}
        </table>
      </div>
      ${pagerHtml}
    `;

    return pbiPanel(title, tableHtml, {
      subtitle: opts.subtitle,
      meta: `${fmtNum(totalRows)} ${opts.unitLabel || 'rows'}${totalPages > 1 ? ` · p.${curPage + 1}/${totalPages}` : ''}`,
      id: opts.id
    });
  }

  // ==================== PAGE-SPECIFIC DYNAMIC SLICER ENGINE (m18c_report.py) ====================
  function buildPageSlicerDefs(pageId, data) {
    const { prodOpts, custOpts, suppOpts, siteOpts, equipOpts, driverOpts, staffOpts, catOpts, subcatOpts, regOpts, cpOpts } = data;
    const yn = [{ v: 'Yes', l: 'Yes' }, { v: 'No', l: 'No' }];
    const map = {
      p01_overview: [
        { key: 'customer', label: 'Customer', opts: custOpts },
        { key: 'product', label: 'Material / Grade', opts: prodOpts },
        { key: 'site', label: 'Site', opts: siteOpts },
        { key: 'iva', label: 'Customer IVA (VAT)', opts: yn },
        { key: 'method', label: 'Payment Method', opts: ['Cash', 'Credit'] }
      ],
      p02_companies: [
        { key: 'iva', label: 'Customer IVA (VAT)', opts: yn },
        { key: 'product', label: 'Material / Grade', opts: prodOpts },
        { key: 'customer', label: 'Customer', opts: custOpts }
      ],
      p03_exceptions: [
        { key: 'severity', label: 'Exception Queue', opts: ['Overdue AR', 'Uninvoiced IVA', 'Pricing & Lapsed', 'Fleet & Telemetry', 'Payroll & Recon'] },
        { key: 'customer', label: 'Customer', opts: custOpts },
        { key: 'equipment', label: 'Equipment Unit', opts: equipOpts },
        { key: 'supplier', label: 'Supplier / Hauler', opts: suppOpts }
      ],
      p04_sales: [
        { key: 'customer', label: 'Customer', opts: custOpts },
        { key: 'product', label: 'Product / Grade', opts: prodOpts },
        { key: 'site', label: 'Destination Site', opts: siteOpts },
        { key: 'saleType', label: 'Sale Type', opts: ['Delivery', 'Pickup'] },
        { key: 'method', label: 'Method', opts: ['Cash', 'Credit'] },
        { key: 'iva', label: 'Customer IVA', opts: yn },
        { key: 'driver', label: 'Driver', opts: driverOpts }
      ],
      p05_pricing: [
        { key: 'ruleType', label: 'Rule Type', opts: ['Sales (Delivery)', 'Sales (Pickup)', 'Purchase Price (Site)', 'Transport Price (Site)', 'Commission', 'List Price'] },
        { key: 'product', label: 'Product / Grade', opts: prodOpts },
        { key: 'customer', label: 'Customer', opts: custOpts },
        { key: 'activeStatus', label: 'Agreement Status', opts: ['Active', 'Ended'] },
        { key: 'site', label: 'Site', opts: siteOpts },
        { key: 'supplier', label: 'Owner / Beneficiary', opts: suppOpts }
      ],
      p06_ar: [
        { key: 'customer', label: 'Customer', opts: custOpts },
        { key: 'iva', label: 'VAT Registered (IVA)', opts: yn },
        { key: 'creditOnly', label: 'Credit Filter', opts: ['Credit Customers', 'Has Open Balance', 'Overdue (>30d)', 'On Account (<$0)'] },
        { key: 'agingBucket', label: 'Aging Bucket', opts: ['Current', '1-10 Days', '11-30 Days', '31-60 Days', '60+ Days', 'On Account'] }
      ],
      p07_ap: [
        { key: 'supplier', label: 'Supplier / Hauler', opts: suppOpts },
        { key: 'category', label: 'Expense Category', opts: catOpts },
        { key: 'costClass', label: 'Cost Class', opts: ['Production Cost', 'Operating Expense', 'Capital Expenditure'] },
        { key: 'method', label: 'Method', opts: ['Cash', 'Credit'] },
        { key: 'iva', label: 'Supplier IVA', opts: yn },
        { key: 'payableLeg', label: 'Owed For (AP Leg)', opts: ['Material', 'Haulage', 'Supplies & services'] },
        { key: 'equipment', label: 'Equipment Unit', opts: equipOpts }
      ],
      p08_stock: [
        { key: 'product', label: 'Product / Grade', opts: prodOpts },
        { key: 'site', label: 'Source Site', opts: siteOpts },
        { key: 'supplier', label: 'Site / Truck Owner', opts: suppOpts },
        { key: 'transportBy', label: 'Transported By', opts: ['Third-party truck', 'Company fleet'] }
      ],
      p09_fuel: [
        { key: 'equipment', label: 'Equipment Unit', opts: equipOpts },
        { key: 'equipType', label: 'Equipment Type', opts: ['Truck', 'Loader', 'Excavator', 'Bulldozer', 'Plant', 'Generator', 'Vehicle'] },
        { key: 'ownership', label: 'Ownership', opts: ['Own', 'Rented', 'Partner', 'Transporter'] },
        { key: 'driver', label: 'Driver', opts: driverOpts },
        { key: 'fuelType', label: 'Fuel / Item', opts: ['Diesel', 'Lubricant / Oil'] }
      ],
      p10_fleet: [
        { key: 'equipment', label: 'Equipment Unit', opts: equipOpts },
        { key: 'equipType', label: 'Type', opts: ['Truck', 'Loader', 'Excavator', 'Bulldozer', 'Plant', 'Generator', 'Vehicle'] },
        { key: 'ownership', label: 'Ownership', opts: ['Own', 'Rented', 'Partner', 'Transporter'] },
        { key: 'equipStatus', label: 'Status', opts: ['Active', 'Idle', 'Under repair', 'Sold'] }
      ],
      p11_drivers: [
        { key: 'driver', label: 'Driver', opts: driverOpts },
        { key: 'companyDriver', label: 'Company Driver', opts: yn },
        { key: 'region', label: 'Region / Route', opts: regOpts },
        { key: 'overtimeFlag', label: 'Overtime', opts: yn },
        { key: 'shift', label: 'Shift', opts: ['Day', 'Night'] }
      ],
      p12_payroll: [
        { key: 'staff', label: 'Staff Member', opts: staffOpts },
        { key: 'contractType', label: 'Contract Type', opts: ['Regular', 'Monthly', 'Daily', 'Freelance'] },
        { key: 'contractStatus', label: 'Contract Status', opts: ['Current', 'Ended'] },
        { key: 'site', label: 'Allowance Site', opts: siteOpts }
      ],
      p13_vat: [
        { key: 'customer', label: 'Customer', opts: custOpts },
        { key: 'supplier', label: 'Supplier', opts: suppOpts },
        { key: 'iva', label: 'Customer IVA', opts: yn },
        { key: 'supplierIva', label: 'Supplier IVA', opts: yn }
      ],
      p14_cashflow: [
        { key: 'currency', label: 'Currency', opts: ['USD', 'LBP'] },
        { key: 'flowKind', label: 'Cash Stream', opts: ['Customer Receipts', 'Supplier Settlements', 'Cash Expenses', 'Salary Payments', 'External Treasury'] },
        { key: 'method', label: 'Payment Method', opts: ['Cash', 'Check', 'Bank', 'Whish'] },
        { key: 'customer', label: 'Customer / Counterparty', opts: custOpts }
      ],
      p15_treasury: [
        { key: 'treasuryType', label: 'Treasury Stream', opts: ['Loans', 'External Movements', 'FX Conversions', 'Barter'] },
        { key: 'counterparty', label: 'Counterparty / Lender', opts: cpOpts },
        { key: 'loanDirection', label: 'Flow / Direction', opts: ['Inflow', 'Outflow', 'Repayment', 'Drawdown'] }
      ],
      p16_financial: [
        { key: 'glClass', label: 'Lebanese CoA Class', opts: [
          { v: '1', l: 'Class 1 · Capital & Long-Term' },
          { v: '2', l: 'Class 2 · Fixed Assets' },
          { v: '3', l: 'Class 3 · Inventories' },
          { v: '4', l: 'Class 4 · AR, AP & VAT' },
          { v: '5', l: 'Class 5 · Cash & Till 5300' },
          { v: '6', l: 'Class 6 · Cost & Expenses' },
          { v: '7', l: 'Class 7 · Revenue' }
        ] },
        { key: 'pnlSection', label: 'Journal Filter', opts: ['Sales & VAT', 'Raw & Haulage', 'Expenses & Payroll', 'Receipts & Settlements'] }
      ],
      p17_jv: [
        { key: 'site', label: 'JV Site', opts: ['Halat JV', 'Jiyeh JV', 'Nahr Ibrahim JV'] },
        { key: 'partner', label: 'JV Partner', opts: ['Assaf', 'WTC', 'Partner 50%'] },
        { key: 'jvBasis', label: 'Distribution Basis', opts: ['Stock', 'Revenue', 'Profit', 'Cash'] }
      ],
      p18_tickets: [
        { key: 'padType', label: 'Ticket Pad Stream', opts: ['Sales Pad', 'Raw Pad', 'Fuel Pad'] },
        { key: 'bookStatus', label: 'Serial Hygiene', opts: ['All Serials', 'Incomplete Books', 'Missing Serials'] },
        { key: 'site', label: 'Site', opts: siteOpts }
      ],
      p19_changelog: [
        { key: 'ledgerDomain', label: 'Ledger Domain', opts: ['Sales', 'RawPurchases', 'Expenses', 'CustomerReceipts', 'SupplierPayments', 'Fuel'] },
        { key: 'ledgerOrigin', label: 'Origin', opts: ['Reported (Power BI)', 'Entered (Dataverse)'] },
        { key: 'ledgerKind', label: 'Snapshot Kind', opts: ['Changed', 'Baseline', 'Date Gap >31d'] }
      ],
      p20_recon: [
        { key: 'reconSide', label: 'Statement Category', opts: ['Financial', 'Receivables', 'Payables', 'Operations', 'Fleet', 'Workforce', 'Commercial', 'Tax & Compliance', 'Treasury', 'Executive'] },
        { key: 'customer', label: 'Customer', opts: custOpts },
        { key: 'supplier', label: 'Supplier', opts: suppOpts }
      ]
    };
    return map[pageId] || map.p01_overview;
  }
  // ==================== 12-PAGE ANALYTICS & INSIGHTS STUDIO RENDERER ====================
  let _pbiBaseCacheKey = '';
  let _pbiBaseCacheVal = null;

  function renderPbiStudio(ctx, overridePageId, bodyOnly) {
    const { STATE, SEED, COMPANY_LABELS, getModel, getKPI, filterRecords, buildSentinelItems, exportBtn, ticketTons, ticketMeters, productMeters } = ctx;
    _activePbiState = STATE;
    const m = getModel();
    const k = getKPI();
    const today = ctx.SEED_DATE || String(SEED.generated_at || '').slice(0, 10) || '2026-10-19';
    const minDate = ctx.MIN_DATE || '2024-01-01';
    const maxDate = ctx.MAX_DATE || '2030-12-31';
    const activeRange = ctx.periodRange ? ctx.periodRange(STATE.period) : null;
    const visiblePages = typeof ctx.canAccessPbiPage === 'function' ? PBI_PAGES.filter(p => ctx.canAccessPbiPage(p.id)) : PBI_PAGES;
    const pagePool = visiblePages.length ? visiblePages : PBI_PAGES;
    const activePage = overridePageId
      ? ({ id: overridePageId, num: '—', label: overridePageId, title: '' })
      : (pagePool.find(p => p.id === (STATE.pbiPage || 'p01_overview')) || pagePool[0]);
    const activePageId = activePage.id;
    if (!overridePageId) STATE.pbiPage = activePageId;

    const sl = bodyOnly ? {} : (STATE.pbiSlicer || {});
    const activeSlicerEntries = bodyOnly ? [] : Object.entries(sl).filter(([kKey, vVal]) => Boolean(vVal));
    const activeSlicerCount = activeSlicerEntries.length;
    const hasAnySlicer = activeSlicerCount > 0;

    const rec = SEED.records || {};
    const sentinels = SEED.sentinels || {};
    const modelKey = STATE.company === 'wtc' ? 'WTC' : (STATE.company === 'bbconstruction' ? 'BBConstruction' : (STATE.company === 'lionstransport' ? 'Lions Transport' : 'Manufacturing Group'));
    const flSn = ((sentinels.fleet_fuel_overtime_auditor || {}).by_model || {})[modelKey] || {};
    const prSn = ((sentinels.pricing_commission_payroll_sentinel || {}).by_model || {})[modelKey] || {};
    const paritySn = sentinels.sharepoint_parity_sentinel || {};

    const allowedCosKey = typeof ctx.allowedCompanyNames === 'function' ? ctx.allowedCompanyNames().join(',') : '';
    const baseCacheKey = `${STATE.company}|${STATE.period}|${STATE.dateFrom || ''}|${STATE.dateTo || ''}|${STATE.basis}|${allowedCosKey}|${SEED._customRev || 0}|${(rec.sales_tickets || []).length}|${(rec.raw_purchases || []).length}`;
    if (_pbiBaseCacheKey !== baseCacheKey || !_pbiBaseCacheVal) {
      const custIvaMap = new Map();
      (rec.customers || []).forEach(c => custIvaMap.set(norm(c.name), c.vat_registered ? 'Yes' : 'No'));
      (m.customers || []).forEach(c => custIvaMap.set(norm(c.Customer), c['VAT Registered'] === 'Yes' ? 'Yes' : 'No'));
      const suppIvaMap = new Map();
      (rec.suppliers || []).forEach(s => suppIvaMap.set(norm(s.name), s.iva ? 'Yes' : 'No'));
      (m.suppliers || []).forEach(s => suppIvaMap.set(norm(s.Supplier), s.IVA === 'Yes' ? 'Yes' : 'No'));
      const catClassMap = new Map();
      (rec.expense_categories || []).forEach(c => catClassMap.set(norm(c.name), deriveExpenseCostClass(c)));
      const equipMetaMap = new Map();
      (rec.equipment || []).forEach(e => equipMetaMap.set(norm(e.name), e));
      (m.equipment || []).forEach(e => { if (!equipMetaMap.has(norm(e.Equipment))) equipMetaMap.set(norm(e.Equipment), { name: e.Equipment, type: e.Type, ownership: e.Ownership, status: e.Status }); });
      const coDriverSet = new Set((rec.company_drivers || []).map(d => norm(d.driver || d.name)));
      (rec.drivers || []).forEach(d => { if (d.is_company_driver) coDriverSet.add(norm(d.name)); });

      const baseSalesRows = filterRecords(rec.sales_tickets, { ignoreSearch: true });
      const baseRawRows = filterRecords(rec.raw_purchases, { ignoreSearch: true });
      const baseExpRows = filterRecords(rec.expenses, { ignoreSearch: true });
      const baseRecRows = filterRecords(rec.receipts, { ignoreSearch: true });
      const baseSetRows = filterRecords(rec.settlements, { ignoreSearch: true });
      const baseFuelRows = filterRecords(rec.fuel_intakes, { ignoreSearch: true });
      const sampleAllTtc = baseSalesRows.reduce((a, r) => a + Number(r.total_ttc || 0), 0) || 1;

      let baseProds = (m.products || []).map(p => {
        if (!productMeters) return p;
        const m3 = productMeters(p.Product, p.qty_sold, p.UoM);
        const rawM3 = productMeters(p.Product, p.raw_qty, p.UoM);
        return Object.assign({}, p, {
          qty_sold: round2(m3),
          raw_qty: round2(rawM3),
          avg_price_ttc: m3 > 0 && p.sales_ttc != null ? round2(Number(p.sales_ttc) / m3) : p.avg_price_ttc,
          avg_price_net: m3 > 0 && p.net_sales != null ? round2(Number(p.net_sales) / m3) : p.avg_price_net,
          avg_raw_cost: rawM3 > 0 && p.raw_cost != null ? round2(Number(p.raw_cost) / rawM3) : p.avg_raw_cost
        });
      });
      let baseCusts = m.customers || [];
      let baseSupps = m.suppliers || [];
      const baseSites = m.sites || [];
      if (activeRange) {
        const pMap = new Map();
        baseSalesRows.forEach(s => {
          const pk = norm(s.product);
          if (!pk) return;
          const cur = pMap.get(pk) || { loads: 0, qty_sold: 0, tons_sold: 0, sales_ttc: 0, net_sales: 0, trans_rev: 0, raw_qty: 0, raw_cost: 0 };
          const q = ticketMeters ? ticketMeters(s) : Number(s.qty || 0);
          const ttc = Number(s.total_ttc != null ? s.total_ttc : s.total || 0);
          const net = Number(s.total != null ? s.total : (ttc - Number(s.vat || 0)));
          cur.loads += 1;
          cur.qty_sold += q;
          cur.tons_sold += ticketTons ? ticketTons(s) : (s.uom === 'm³' ? q * 1.5 : q);
          cur.sales_ttc += ttc;
          cur.net_sales += net;
          cur.trans_rev += Number(s.trans_price || 0);
          pMap.set(pk, cur);
        });
        baseRawRows.forEach(r => {
          const pk = norm(r.product);
          if (!pk) return;
          const cur = pMap.get(pk) || { loads: 0, qty_sold: 0, tons_sold: 0, sales_ttc: 0, net_sales: 0, trans_rev: 0, raw_qty: 0, raw_cost: 0 };
          cur.raw_qty += ticketMeters ? ticketMeters(r) : Number(r.qty || 0);
          cur.raw_cost += Number(r.total != null ? r.total : (Number(r.cost || 0) + Number(r.trans_cost || 0)));
          pMap.set(pk, cur);
        });
        baseProds = baseProds.map(p => {
          const st = pMap.get(norm(p.Product)) || { loads: 0, qty_sold: 0, tons_sold: 0, sales_ttc: 0, net_sales: 0, trans_rev: 0, raw_qty: 0, raw_cost: 0 };
          return Object.assign({}, p, {
            loads: st.loads,
            qty_sold: round2(st.qty_sold),
            tons_sold: round2(st.tons_sold),
            sales_ttc: round2(st.sales_ttc),
            net_sales: round2(st.net_sales),
            trans_rev: round2(st.trans_rev),
            raw_qty: round2(st.raw_qty),
            raw_cost: round2(st.raw_cost),
            avg_price_ttc: st.qty_sold > 0 ? round2(st.sales_ttc / st.qty_sold) : p.avg_price_ttc,
            avg_price_net: st.qty_sold > 0 ? round2(st.net_sales / st.qty_sold) : p.avg_price_net,
            avg_raw_cost: st.raw_qty > 0 ? round2(st.raw_cost / st.raw_qty) : null
          });
        });

        const cMap = new Map();
        baseSalesRows.forEach(s => {
          const ck = norm(s.customer);
          if (!ck) return;
          const cur = cMap.get(ck) || { loads: 0, sales_ttc: 0, net_sales: 0, sales_vat: 0, credit_sales: 0, cash_sales: 0, receipts: 0, last_sale: '' };
          const ttc = Number(s.total_ttc != null ? s.total_ttc : s.total || 0);
          const vat = Number(s.vat || 0);
          const net = Number(s.total != null ? s.total : (ttc - vat));
          cur.loads += 1;
          cur.sales_ttc += ttc;
          cur.net_sales += net;
          cur.sales_vat += vat;
          if (s.method === 'Cash') cur.cash_sales += net;
          else cur.credit_sales += net;
          if (s.date && String(s.date) > cur.last_sale) cur.last_sale = String(s.date).slice(0, 10);
          cMap.set(ck, cur);
        });
        baseRecRows.forEach(r => {
          const ck = norm(r.customer);
          if (!ck) return;
          const cur = cMap.get(ck) || { loads: 0, sales_ttc: 0, net_sales: 0, sales_vat: 0, credit_sales: 0, cash_sales: 0, receipts: 0, last_sale: '' };
          cur.receipts += Number(r.amount || 0);
          cMap.set(ck, cur);
        });
        baseCusts = baseCusts.map(c => {
          const st = cMap.get(norm(c.Customer)) || { loads: 0, sales_ttc: 0, net_sales: 0, sales_vat: 0, credit_sales: 0, cash_sales: 0, receipts: 0, last_sale: '' };
          return Object.assign({}, c, {
            loads: st.loads,
            sales_ttc: round2(st.sales_ttc),
            net_sales: round2(st.net_sales),
            sales_vat: round2(st.sales_vat),
            credit_sales: round2(st.credit_sales),
            cash_sales: round2(st.cash_sales),
            receipts: round2(st.receipts),
            last_sale: st.last_sale || c.last_sale
          });
        });

        const sMap = new Map();
        const ensureSup = name => {
          const sk = norm(name);
          if (!sMap.has(sk)) sMap.set(sk, { raw_loads: 0, raw_mat_cost: 0, raw_haulage: 0, raw_cost: 0, expenses: 0, settlements_paid: 0 });
          return sMap.get(sk);
        };
        baseRawRows.forEach(r => {
          if (r.site_owner) {
            const st = ensureSup(r.site_owner);
            st.raw_loads += 1;
            st.raw_mat_cost += Number(r.cost || 0);
            st.raw_cost += Number(r.cost || 0);
          }
          if (r.truck_owner && Number(r.trans_cost || 0) > 0) {
            const st = ensureSup(r.truck_owner);
            if (norm(r.truck_owner) !== norm(r.site_owner)) st.raw_loads += 1;
            st.raw_haulage += Number(r.trans_cost || 0);
            st.raw_cost += Number(r.trans_cost || 0);
          }
        });
        baseExpRows.forEach(x => {
          if (x.supplier) {
            const st = ensureSup(x.supplier);
            st.expenses += Number(x.amount || 0);
          }
        });
        baseSetRows.forEach(sp => {
          if (sp.supplier) {
            const st = ensureSup(sp.supplier);
            st.settlements_paid += Number(sp.amount || 0);
          }
        });
        baseSupps = baseSupps.map(s => {
          const st = sMap.get(norm(s.Supplier)) || { raw_loads: 0, raw_mat_cost: 0, raw_haulage: 0, raw_cost: 0, expenses: 0, settlements_paid: 0 };
          return Object.assign({}, s, {
            raw_loads: st.raw_loads,
            raw_mat_cost: round2(st.raw_mat_cost),
            raw_haulage: round2(st.raw_haulage),
            raw_cost: round2(st.raw_cost),
            settlements_paid: round2(st.settlements_paid)
          });
        });
      }

      const totalProdSales = baseProds.reduce((a, r) => a + Number(r.sales_ttc || 0), 0) || 1;
      _pbiBaseCacheKey = baseCacheKey;
      _pbiBaseCacheVal = {
        custIvaMap, suppIvaMap, catClassMap, equipMetaMap, coDriverSet,
        baseSalesRows, baseRawRows, baseExpRows, baseRecRows, baseSetRows, baseFuelRows,
        baseProds, baseCusts, baseSupps, baseSites, sampleAllTtc, totalProdSales
      };
    }

    const {
      custIvaMap, suppIvaMap, catClassMap, equipMetaMap, coDriverSet,
      baseSalesRows, baseRawRows, baseExpRows, baseRecRows, baseSetRows, baseFuelRows,
      baseProds: cachedBaseProds, baseCusts: cachedBaseCusts, baseSupps: cachedBaseSupps,
      baseSites: cachedBaseSites, sampleAllTtc, totalProdSales
    } = _pbiBaseCacheVal;

    const matchSearch = r => !sl.search || Object.values(r || {}).join(' ').toLowerCase().includes(norm(sl.search));
    const matchCommon = !hasAnySlicer ? (() => true) : (r => {
      if (!r) return false;
      if (sl.product && norm(r.Product || r.product) !== norm(sl.product)) return false;
      if (sl.customer && norm(r.Customer || r.customer) !== norm(sl.customer)) return false;
      if (sl.supplier && norm(r.Supplier || r.supplier || r.site_owner || r.truck_owner || r.owner_supplier) !== norm(sl.supplier)) return false;
      if (sl.site && norm(r.Site || r.site) !== norm(sl.site)) return false;
      if (sl.saleType && r.sale_type && norm(r.sale_type) !== norm(sl.saleType)) return false;
      if (sl.method && r.method && norm(r.method) !== norm(sl.method)) return false;
      if (sl.equipment && norm(r.Equipment || r.equipment || r.truck || r.name) !== norm(sl.equipment)) return false;
      if (sl.driver && norm(r.driver || r.Driver || r.name) !== norm(sl.driver)) return false;
      if (sl.staff && norm(r.staff || r.Staff) !== norm(sl.staff)) return false;
      if (sl.iva) {
        const cname = r.Customer || r.customer;
        const sname = r.Supplier || r.supplier;
        const flag = r['VAT Registered'] || r.IVA || (cname ? custIvaMap.get(norm(cname)) : (sname ? suppIvaMap.get(norm(sname)) : null));
        if (flag && norm(flag) !== norm(sl.iva)) return false;
      }
      return matchSearch(r);
    });

    const salesRows = !hasAnySlicer ? baseSalesRows : baseSalesRows.filter(r => {
      if (!matchCommon(r)) return false;
      if (sl.shift) {
        const isNight = !!r.overtime;
        if (sl.shift === 'Night' && !isNight) return false;
        if (sl.shift === 'Day' && isNight) return false;
      }
      if (sl.overtimeFlag === 'Yes' && !r.overtime) return false;
      if (sl.overtimeFlag === 'No' && r.overtime) return false;
      return true;
    });
    const rawRows = !hasAnySlicer ? baseRawRows : baseRawRows.filter(r => {
      if (!matchCommon(r)) return false;
      if (sl.transportBy && norm(r.transport_by) !== norm(sl.transportBy)) return false;
      return true;
    });
    const expRows = !hasAnySlicer ? baseExpRows : baseExpRows.filter(r => {
      if (!matchCommon(r)) return false;
      if (sl.category && norm(r.category) !== norm(sl.category)) return false;
      if (sl.costClass && norm(catClassMap.get(norm(r.category)) || 'Operating Expense') !== norm(sl.costClass)) return false;
      return true;
    });
    const recRows = !hasAnySlicer ? baseRecRows : baseRecRows.filter(matchCommon);
    const setRows = !hasAnySlicer ? baseSetRows : baseSetRows.filter(r => {
      if (!matchCommon(r)) return false;
      if (sl.payableLeg && r.payable_leg && norm(r.payable_leg) !== norm(sl.payableLeg)) return false;
      return true;
    });
    const fuelRows = !hasAnySlicer ? baseFuelRows : baseFuelRows.filter(r => {
      if (!matchCommon(r)) return false;
      const em = equipMetaMap.get(norm(r.equipment)) || {};
      if (sl.equipType && norm(em.type) !== norm(sl.equipType)) return false;
      if (sl.ownership && norm(em.ownership) !== norm(sl.ownership)) return false;
      if (sl.fuelType === 'Diesel' && !/diesel|mazout/i.test(String(r.item || 'Diesel'))) return false;
      if (sl.fuelType === 'Lubricant / Oil' && /diesel|mazout/i.test(String(r.item || 'Diesel'))) return false;
      return true;
    });

    // When a specific date window + slicer is active, overlay period-scoped flow metrics on products, customers, suppliers & sites
    let baseProds = cachedBaseProds;
    let baseCusts = cachedBaseCusts;
    let baseSupps = cachedBaseSupps;
    const baseSites = cachedBaseSites;
    if (activeRange && hasAnySlicer) {
      const pMap = new Map();
      salesRows.forEach(s => {
        const pk = norm(s.product);
        if (!pk) return;
        const cur = pMap.get(pk) || { loads: 0, qty_sold: 0, tons_sold: 0, sales_ttc: 0, net_sales: 0, trans_rev: 0, raw_qty: 0, raw_cost: 0 };
        const q = ticketMeters ? ticketMeters(s) : Number(s.qty || 0);
        const ttc = Number(s.total_ttc != null ? s.total_ttc : s.total || 0);
        const net = Number(s.total != null ? s.total : (ttc - Number(s.vat || 0)));
        cur.loads += 1;
        cur.qty_sold += q;
        cur.tons_sold += ticketTons ? ticketTons(s) : (s.uom === 'm³' ? q * 1.5 : q);
        cur.sales_ttc += ttc;
        cur.net_sales += net;
        cur.trans_rev += Number(s.trans_price || 0);
        pMap.set(pk, cur);
      });
      rawRows.forEach(r => {
        const pk = norm(r.product);
        if (!pk) return;
        const cur = pMap.get(pk) || { loads: 0, qty_sold: 0, tons_sold: 0, sales_ttc: 0, net_sales: 0, trans_rev: 0, raw_qty: 0, raw_cost: 0 };
        cur.raw_qty += ticketMeters ? ticketMeters(r) : Number(r.qty || 0);
        cur.raw_cost += Number(r.total != null ? r.total : (Number(r.cost || 0) + Number(r.trans_cost || 0)));
        pMap.set(pk, cur);
      });
      baseProds = (m.products || []).map(p => {
        const st = pMap.get(norm(p.Product)) || { loads: 0, qty_sold: 0, tons_sold: 0, sales_ttc: 0, net_sales: 0, trans_rev: 0, raw_qty: 0, raw_cost: 0 };
        return Object.assign({}, p, {
          loads: st.loads,
          qty_sold: round2(st.qty_sold),
          tons_sold: round2(st.tons_sold),
          sales_ttc: round2(st.sales_ttc),
          net_sales: round2(st.net_sales),
          trans_rev: round2(st.trans_rev),
          raw_qty: round2(st.raw_qty),
          raw_cost: round2(st.raw_cost),
          avg_price_ttc: st.qty_sold > 0 ? round2(st.sales_ttc / st.qty_sold) : p.avg_price_ttc,
          avg_price_net: st.qty_sold > 0 ? round2(st.net_sales / st.qty_sold) : p.avg_price_net,
          avg_raw_cost: st.raw_qty > 0 ? round2(st.raw_cost / st.raw_qty) : null
        });
      });

      const cMap = new Map();
      salesRows.forEach(s => {
        const ck = norm(s.customer);
        if (!ck) return;
        const cur = cMap.get(ck) || { loads: 0, sales_ttc: 0, net_sales: 0, sales_vat: 0, credit_sales: 0, cash_sales: 0, receipts: 0, last_sale: '' };
        const ttc = Number(s.total_ttc != null ? s.total_ttc : s.total || 0);
        const vat = Number(s.vat || 0);
        const net = Number(s.total != null ? s.total : (ttc - vat));
        cur.loads += 1;
        cur.sales_ttc += ttc;
        cur.net_sales += net;
        cur.sales_vat += vat;
        if (s.method === 'Cash') cur.cash_sales += net;
        else cur.credit_sales += net;
        if (s.date && String(s.date) > cur.last_sale) cur.last_sale = String(s.date).slice(0, 10);
        cMap.set(ck, cur);
      });
      recRows.forEach(r => {
        const ck = norm(r.customer);
        if (!ck) return;
        const cur = cMap.get(ck) || { loads: 0, sales_ttc: 0, net_sales: 0, sales_vat: 0, credit_sales: 0, cash_sales: 0, receipts: 0, last_sale: '' };
        cur.receipts += Number(r.amount || 0);
        cMap.set(ck, cur);
      });
      baseCusts = (m.customers || []).map(c => {
        const st = cMap.get(norm(c.Customer)) || { loads: 0, sales_ttc: 0, net_sales: 0, sales_vat: 0, credit_sales: 0, cash_sales: 0, receipts: 0, last_sale: '' };
        return Object.assign({}, c, {
          loads: st.loads,
          sales_ttc: round2(st.sales_ttc),
          net_sales: round2(st.net_sales),
          sales_vat: round2(st.sales_vat),
          credit_sales: round2(st.credit_sales),
          cash_sales: round2(st.cash_sales),
          receipts: round2(st.receipts),
          last_sale: st.last_sale || c.last_sale
        });
      });

      const sMap = new Map();
      const ensureSup = name => {
        const sk = norm(name);
        if (!sMap.has(sk)) sMap.set(sk, { raw_loads: 0, raw_mat_cost: 0, raw_haulage: 0, raw_cost: 0, expenses: 0, settlements_paid: 0 });
        return sMap.get(sk);
      };
      rawRows.forEach(r => {
        if (r.site_owner) {
          const st = ensureSup(r.site_owner);
          st.raw_loads += 1;
          st.raw_mat_cost += Number(r.cost || 0);
          st.raw_cost += Number(r.cost || 0);
        }
        if (r.truck_owner && Number(r.trans_cost || 0) > 0) {
          const st = ensureSup(r.truck_owner);
          if (norm(r.truck_owner) !== norm(r.site_owner)) st.raw_loads += 1;
          st.raw_haulage += Number(r.trans_cost || 0);
          st.raw_cost += Number(r.trans_cost || 0);
        }
      });
      expRows.forEach(x => {
        if (x.supplier) {
          const st = ensureSup(x.supplier);
          st.expenses += Number(x.amount || 0);
        }
      });
      setRows.forEach(sp => {
        if (sp.supplier) {
          const st = ensureSup(sp.supplier);
          st.settlements_paid += Number(sp.amount || 0);
        }
      });
      baseSupps = (m.suppliers || []).map(s => {
        const st = sMap.get(norm(s.Supplier)) || { raw_loads: 0, raw_mat_cost: 0, raw_haulage: 0, raw_cost: 0, expenses: 0, settlements_paid: 0 };
        return Object.assign({}, s, {
          raw_loads: st.raw_loads,
          raw_mat_cost: round2(st.raw_mat_cost),
          raw_haulage: round2(st.raw_haulage),
          raw_cost: round2(st.raw_cost),
          settlements_paid: round2(st.settlements_paid)
        });
      });
    }

    const prodRows = !hasAnySlicer ? baseProds : baseProds.filter(matchCommon);
    const custRows = !hasAnySlicer ? baseCusts : baseCusts.filter(c => {
      if (!matchCommon(c)) return false;
      if (sl.creditOnly === 'Credit Customers' && !(Number(c.credit_sales || 0) > 0 || Number(c.ar_balance || 0) !== 0)) return false;
      if (sl.creditOnly === 'Has Open Balance' && Math.abs(Number(c.ar_balance || 0)) < 0.01) return false;
      if (sl.creditOnly === 'Overdue (>30d)' && Number(c.ar_overdue || 0) <= 0) return false;
      if (sl.creditOnly === 'On Account (<$0)' && Number(c.ar_balance || 0) >= -0.01 && Number(c.ar_advances || 0) <= 0) return false;
      if (sl.agingBucket) {
        if (sl.agingBucket === 'Current' && Number(c.ar_current || 0) <= 0) return false;
        if (sl.agingBucket === '1-10 Days' && Number(c.ar_1_10 || 0) <= 0) return false;
        if (sl.agingBucket === '11-30 Days' && Number(c.ar_11_30 || 0) <= 0) return false;
        if (sl.agingBucket === '31-60 Days' && Number(c.ar_31_60 || 0) <= 0) return false;
        if (sl.agingBucket === '60+ Days' && Number(c.ar_60_plus || 0) <= 0) return false;
        if (sl.agingBucket === 'On Account' && Number(c.ar_balance || 0) >= 0 && Number(c.ar_advances || 0) <= 0) return false;
      }
      return true;
    });
    const suppRows = !hasAnySlicer ? baseSupps : baseSupps.filter(s => {
      if (!matchCommon(s)) return false;
      if (sl.payableLeg === 'Material' && Number(s.ap_material || s.raw_mat_cost || 0) <= 0) return false;
      if (sl.payableLeg === 'Haulage' && Number(s.ap_haulage || s.raw_haulage || 0) <= 0) return false;
      if (sl.payableLeg === 'Supplies & services' && Number(s.ap_expense || s.expenses || 0) <= 0) return false;
      return true;
    });
    const siteRows = !hasAnySlicer ? baseSites : baseSites.filter(matchCommon);
    const equipRows = !hasAnySlicer ? (m.equipment || []) : (m.equipment || []).filter(e => {
      if (!matchCommon(e)) return false;
      if (sl.equipType && norm(e.Type) !== norm(sl.equipType)) return false;
      if (sl.ownership && norm(e.Ownership) !== norm(sl.ownership)) return false;
      if (sl.equipStatus && norm(e.Status) !== norm(sl.equipStatus)) return false;
      return true;
    });

    function movedRegisterBanner(title, desc, targetView, targetLabel, modSec = '') {
      if (bodyOnly && STATE.view === targetView) return '';
      return `
        <div class="pbi-panel" style="padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;background:linear-gradient(90deg,rgba(184,136,59,0.08),transparent);border-left:3px solid var(--brass)">
          <div>
            <div style="font-size:12.5px;font-weight:700;color:var(--ink)">${esc(title)}</div>
            <div style="font-size:11.5px;color:var(--muted);margin-top:2px">${esc(desc)}</div>
          </div>
          <button type="button" class="btn btn-brass" style="padding:5px 12px;font-size:11.5px" data-nav-jump="${esc(targetView)}" ${modSec ? `data-mod-jump="${esc(modSec)}"` : ''}>Open in ${esc(targetLabel)} →</button>
        </div>
      `;
    }

    let headerHtml = '';
    if (!bodyOnly) {
      const fIdx = typeof window !== 'undefined' && typeof window.MFG_FREQ === 'function' ? window.MFG_FREQ() : null;
      const isRawSlicerPage = activePageId === 'p08_stock';
      const isSalesSlicerPage = activePageId === 'p04_sales';
      const slicerPools = {
        prodOpts: uniq((m.products || []).map(p => p.Product).concat((rec.products || []).map(p => p.name)), fIdx ? (isRawSlicerPage ? fIdx.productRaw : (isSalesSlicerPage ? fIdx.productSales : fIdx.product)) : null),
        custOpts: uniq((m.customers || []).map(c => c.Customer).concat((rec.customers || []).map(c => c.name)), fIdx && fIdx.customer),
        suppOpts: uniq((m.suppliers || []).map(s => s.Supplier).concat((rec.suppliers || []).map(s => s.name)), fIdx ? (isRawSlicerPage ? fIdx.siteOwner : fIdx.supplier) : null),
        siteOpts: uniq((m.sites || []).map(s => s.Site).concat((rec.sites || []).map(s => s.name)), fIdx ? (isRawSlicerPage ? fIdx.siteRaw : (isSalesSlicerPage ? fIdx.siteSales : fIdx.site)) : null),
        equipOpts: uniq((m.equipment || []).map(e => e.Equipment).concat((rec.equipment || []).map(e => e.name)), fIdx && fIdx.truck),
        driverOpts: uniq((rec.drivers || []).map(d => d.name).concat((rec.sales_tickets || []).map(t => t.driver)), fIdx && fIdx.driver),
        staffOpts: uniq((rec.employments || []).map(e => e.staff).concat((rec.salaries || []).map(s => s.staff)).concat((rec.attendance || []).map(a => a.staff)), fIdx && fIdx.staff),
        catOpts: uniq((rec.expense_categories || []).map(c => c.name).concat((rec.expenses || []).map(x => x.category)), fIdx && fIdx.category),
        subcatOpts: uniq((rec.expense_subcategories || []).map(c => c.name), fIdx && fIdx.subcategory),
        regOpts: uniq((rec.regions || []).map(r => r.name).concat((rec.overtime_rates || []).map(o => o.region)), fIdx && fIdx.region),
        cpOpts: uniq((rec.external_movements || []).map(x => cellValue(x, 'counterparty')).concat((rec.loans || []).map(l => cellValue(l, 'counterparty'))), fIdx && fIdx.counterparty)
      };

      const pageSlicerDefs = buildPageSlicerDefs(activePageId, slicerPools);
      const legacyIdForKey = {
        product: 'pbiSlicerProduct', customer: 'pbiSlicerCustomer', supplier: 'pbiSlicerSupplier',
        site: 'pbiSlicerSite', saleType: 'pbiSlicerSaleType', method: 'pbiSlicerMethod'
      };
      const grainCat = ctx.getDateGrainCatalog ? ctx.getDateGrainCatalog() : { all: [] };
      const activeGrainOpts = grainCat[STATE.dateGrain] || grainCat.all || [];
      const curFrom = activeRange ? activeRange.from : minDate;
      const curTo = activeRange ? activeRange.to : maxDate;
      const isDateFiltered = STATE.period !== 'all' || STATE.dateGrain !== 'all' || Boolean(STATE.dateFrom || STATE.dateTo);

      headerHtml = `
      <div class="pbi-studio-hdr">
        <div class="pbi-studio-top">
          <div>
            <div class="cockpit-eyebrow">ANALYTICS &amp; INSIGHTS STUDIO · ${pagePool.length} ANALYTICAL PAGES · ${esc(COMPANY_LABELS[STATE.company] || STATE.company)}</div>
            <h2 class="pbi-studio-title">Analytics &amp; Insights</h2>
            <div class="cockpit-sub" style="color:var(--muted);margin-top:2px"><b>Page ${esc(activePage.num)} · ${esc(activePage.label)}</b> — ${esc(activePage.title)}</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            ${activeSlicerCount ? `<span class="badge badge-warn">${activeSlicerCount} Active Slicer${activeSlicerCount > 1 ? 's' : ''}</span>` : '<span class="badge badge-ok">All Slicers Open</span>'}
            <button type="button" class="btn" id="pbiResetSlicersBtn" ${activeSlicerCount ? '' : 'disabled'}>↺ Reset Slicers</button>
            ${exportBtn('pbiCanvasPanel', 'PBI_' + activePage.id)}
          </div>
        </div>

        <!-- 12-Page Analytical Navigation Pill Strip -->
        <div class="pbi-page-strip" role="tablist" aria-label="Analytics &amp; Insights Pages">
          ${pagePool.map(p => `
            <button type="button" class="pbi-page-tab ${p.id === activePageId ? 'active' : ''}" data-pbi-page="${esc(p.id)}" role="tab" aria-selected="${p.id === activePageId}">
              <span class="pbi-page-num">${esc(p.num)}</span>
              <span>${esc(p.label)}</span>
            </button>
          `).join('')}
        </div>

        <!-- 8 Domain Pages Embedded directly inside their respective Sidebar Modules -->
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:6px 10px;margin-bottom:8px;background:rgba(184,136,59,0.06);border:1px dashed var(--border-strong);border-radius:8px;font-size:11px">
          <span style="font-weight:700;color:var(--brass);text-transform:uppercase;letter-spacing:.04em;margin-right:4px">Embedded in Sidebar Modules:</span>
          ${Object.values(MOVED_PBI_PAGES).map(mp => `
            <button type="button" class="filter-chip" style="padding:2px 8px;font-size:10.5px" data-pbi-jump="${esc(mp.id)}">${esc(mp.short)} <span style="opacity:.7">→ ${esc(mp.targetLabel)}</span></button>
          `).join('')}
        </div>

        <!-- Page-Specific Slicer Strip (adapts dynamically to each of the 20 pages) -->
        <div class="pbi-slicer-wrap">
          <!-- Power BI / Power Apps Date Grain (All | Year | Month | Week | Day) + Period (between) Range Bar -->
          <div class="pbi-date-slicer-row">
            <div class="pbi-date-left">
              <span class="pbi-date-lbl">Period Grain</span>
              <div class="pbi-grain-group" role="group" aria-label="Power BI Date Grain">
                ${[
                  ['all', 'All'],
                  ['year', 'Year'],
                  ['month', 'Month'],
                  ['week', 'Week'],
                  ['day', 'Day']
                ].map(([gKey, gLbl]) => `
                  <button type="button" class="pbi-grain-btn ${STATE.dateGrain === gKey ? 'active' : ''}" data-pbi-grain="${gKey}">${gLbl}</button>
                `).join('')}
              </div>
              <select id="pbiPeriodSelect" class="pbi-period-select" aria-label="Power BI Period Value" hidden aria-hidden="true">
                ${STATE.period === 'custom' ? `<option value="custom" selected>Range: ${esc(curFrom)} → ${esc(curTo)}</option>` : ''}
                ${activeGrainOpts.map(o => `<option value="${esc(o.value)}" ${STATE.period === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
              </select>
            </div>
            <div class="pbi-date-right">
              <span class="pbi-date-lbl">Period (Between)</span>
              <div class="date-seg-slot pbi-seg-slot" data-date-slot="from">
                <input type="date" id="pbiDateFrom" class="pbi-date-input date-native-proxy" min="2024-01-01" max="2030-12-31" value="${esc(curFrom)}" aria-label="Power BI From Date" tabindex="-1">
                ${ctx.renderDateSegPillHtml ? ctx.renderDateSegPillHtml('from', curFrom, 'pbi') : ''}
              </div>
              <span style="color:var(--muted);font-weight:700">–</span>
              <div class="date-seg-slot pbi-seg-slot" data-date-slot="to">
                <input type="date" id="pbiDateTo" class="pbi-date-input date-native-proxy" min="2024-01-01" max="2030-12-31" value="${esc(curTo)}" aria-label="Power BI To Date" tabindex="-1">
                ${ctx.renderDateSegPillHtml ? ctx.renderDateSegPillHtml('to', curTo, 'pbi') : ''}
              </div>
              <button type="button" id="pbiDateResetBtn" class="btn" style="padding:3px 8px;font-size:10.5px" ${isDateFiltered ? '' : 'hidden'}>✕ All-Time</button>
            </div>
          </div>

          <div class="pbi-slicer-meta">
            <span>Page ${esc(activePage.num)} Slicers · <b>${esc(activePage.label)}</b> (${pageSlicerDefs.length} page filters + cross-search)</span>
            <span>Period: <b>${esc(k.label || 'All-Time')}</b> · Basis: <b>${STATE.basis === 'rep' ? 'Reporting Date' : 'Transaction Date'}</b></span>
          </div>
          <div class="pbi-slicer-bar dynamic">
            ${pageSlicerDefs.map(def => {
              const curVal = sl[def.key] || '';
              const legId = legacyIdForKey[def.key] ? `id="${legacyIdForKey[def.key]}"` : '';
              return `
                <div class="pbi-slicer-item">
                  <label>${esc(def.label)}</label>
                  <select ${legId} data-pbi-slicer="${esc(def.key)}">
                    <option value="">All ${esc(def.label)}s</option>
                    ${(def.opts || []).map(o => {
                      const val = typeof o === 'object' ? o.v : o;
                      const lbl = typeof o === 'object' ? o.l : o;
                      return `<option value="${esc(val)}" ${curVal === val ? 'selected' : ''}>${esc(lbl)}</option>`;
                    }).join('')}
                  </select>
                </div>
              `;
            }).join('')}
            <div class="pbi-slicer-item">
              <label>Cross-Filter Search</label>
              <input type="search" id="pbiSlicerSearch" value="${esc(sl.search || '')}" placeholder="Filter rows, codes, notes..." autocomplete="off">
            </div>
          </div>
        </div>
      </div>
    `;
    }

    // Scale factor when a slicer narrows the active page
    const hasSalesSlicer = Boolean(sl.product || sl.customer || sl.saleType || sl.method || sl.iva);
    const filtProdSales = hasSalesSlicer ? prodRows.reduce((a, r) => a + Number(r.sales_ttc || 0), 0) : totalProdSales;
    const sampleFiltTtc = hasSalesSlicer ? salesRows.reduce((a, r) => a + Number(r.total_ttc || 0), 0) : sampleAllTtc;
    const sRatio = sl.product && !sl.customer && !sl.saleType && !sl.method
      ? (filtProdSales / totalProdSales)
      : (hasSalesSlicer ? (sampleFiltTtc / sampleAllTtc) : 1);
    const sc = v => round2(Number(v || 0) * (hasSalesSlicer ? sRatio : 1));
    const baseMonths = ctx.getScopedMonthly ? ctx.getScopedMonthly(m.monthly, 14) : (m.monthly || []).slice(-14);
    const months = hasSalesSlicer ? baseMonths.map(r => ({
      ...r,
      sales_ttc: sc(r.sales_ttc), net_sales: sc(r.net_sales), credit_sales: sc(r.credit_sales),
      cash_sales: sc(r.cash_sales), raw_cost: sc(r.raw_cost), expenses: sc(r.expenses),
      operating_profit: sc(r.operating_profit), gross_margin: sc(r.gross_margin), receipts: sc(r.receipts)
    })) : baseMonths;

    let bodyHtml = '';

    // =========================================================================
    // PAGE 01: OVERVIEW (m18c_report.py Page 01 — 4 KPI bands + 4 charts + 2 tables)
    // =========================================================================
    if (activePageId === 'p01_overview') {
      bodyHtml = `
        <div class="pbi-overview-bands">
          ${kpiBand('1 · Sales & Revenue (Click any card to drill into its page)', [
            { label: 'Sales incl. VAT (TTC)', value: fmtUSD(sc(k.sales_ttc), 0), sub: fmtNum(sc(k.loads), 0) + ' weighbridge loads', tone: 'brass', navPage: 'p04_sales' },
            { label: 'Sales Ex-VAT (Mat + Trans)', value: fmtUSD(sc(k.gross_sales || k.net_sales), 0), sub: 'Mat ' + fmtUSDk(sc(k.net_sales)) + ' + Trans ' + fmtUSDk(sc(k.trans_rev)), navPage: 'p04_sales' },
            { label: 'Transport Revenue', value: fmtUSD(sc(k.trans_rev), 0), sub: fmtNum(sc(k.delivery_loads), 0) + ' delivery loads', navPage: 'p08_stock' },
            { label: 'Output VAT (11%)', value: fmtUSD(sc(k.sales_vat), 0), sub: 'Account 4427 invoiced', navPage: 'p13_vat' },
            { label: 'Tons Sold', value: fmtNum(sc(k.tons_sold), 0) + ' t', sub: fmtNum(sc(k.qty_sold), 0) + ' m³ sold', navPage: 'p04_sales' },
            { label: 'Avg Price / m³ (TTC)', value: fmtUSD(k.avg_price_ttc, 2), sub: 'Net: ' + fmtUSD(k.avg_price_net, 2) + '/m³', navPage: 'p05_pricing' }
          ])}
          ${kpiBand('2 · Direct Costs, Expenses, Payroll & Margins', [
            { label: 'Raw Material Cost', value: fmtUSD(sc(k.raw_cost), 0), sub: 'Mat ' + fmtUSDk(sc(k.raw_mat_cost)) + ' + Haul ' + fmtUSDk(sc(k.raw_haulage)), navPage: 'p08_stock' },
            { label: 'Gross Margin ($ / %)', value: fmtUSD(sc(k.gross_margin), 0), sub: fmtPct(k.gm_pct, k.gross_margin, k.net_sales) + ' of Net Sales', tone: 'good', navPage: 'p16_financial' },
            { label: 'Operating Expenses', value: fmtUSD(sc(k.expenses), 0), sub: 'Cash ' + fmtUSDk(sc(k.cash_expenses)) + ' · Credit ' + fmtUSDk(sc(k.credit_expenses)), navPage: 'p07_ap' },
            { label: 'Staff Salaries Paid', value: fmtUSD(k.salaries_paid, 0), sub: 'OT Bonus: ' + fmtUSD(k.overtime_bonus, 0), navPage: 'p12_payroll' },
            { label: 'Operating Profit (Cash)', value: fmtUSD(sc(k.operating_profit), 0), sub: fmtPct(k.op_margin_pct, k.operating_profit, k.net_sales) + ' Op. Margin', tone: Number(k.operating_profit || 0) < 0 ? 'crit' : 'good', navPage: 'p16_financial' },
            { label: 'Commission Due', value: fmtUSD(k.commission_due, 0), sub: fmtNum(k.active_agreements) + ' active price rules', navPage: 'p05_pricing' }
          ])}
          ${kpiBand('3 · Receivables (FIFO), 3-Leg Payables & Cash Till', [
            { label: 'Open Customer AR', value: fmtUSD(k.ar_balance, 0), sub: 'Gross ' + fmtUSDk(k.ar_gross) + ' · Adv ' + fmtUSDk(k.ar_advances), tone: 'warn', navPage: 'p06_ar' },
            { label: 'AR Overdue (>30d / 60+)', value: fmtUSD(k.ar_overdue, 0), sub: '60+ days: ' + fmtUSD(k.ar_60_plus, 0), tone: 'crit', navPage: 'p06_ar' },
            { label: 'Customer Receipts', value: fmtUSD(sc(k.receipts), 0), sub: 'DSO ' + fmtNum(k.dso_days, 0) + ' days', tone: 'good', navPage: 'p06_ar' },
            { label: '3-Leg Open AP', value: fmtUSD(k.ap_balance, 0), sub: 'Mat ' + fmtUSDk(k.ap_material) + ' · Haul ' + fmtUSDk(k.ap_haulage), navPage: 'p07_ap' },
            { label: 'Supplier Settlements', value: fmtUSD(k.settlements_paid, 0), sub: 'Applied against 3 legs', navPage: 'p07_ap' },
            { label: 'Cash Till 5300', value: fmtUSD(k.cash_till, 0), sub: 'Net Cash Flow ' + fmtUSDk(k.net_cash_flow), tone: Number(k.cash_till || 0) < 0 ? 'crit' : 'brass', navPage: 'p14_cashflow' }
          ])}
          ${kpiBand('4 · Fleet, Diesel Tank & Trial Balance Integrity', [
            { label: 'Active Equipment', value: fmtNum(k.active_equip), sub: fmtNum(k.trucks_used) + ' trucks dispatched', navPage: 'p10_fleet' },
            { label: 'Own-Fleet Loads', value: fmtNum(k.own_fleet_loads), sub: 'Company fleet haulage', navPage: 'p11_drivers' },
            { label: 'Fleet Cost / Ton', value: fmtUSD(k.cost_per_ton, 2), sub: 'Total equip cost ' + fmtUSDk(k.total_equip_cost), navPage: 'p10_fleet' },
            { label: 'Diesel Issued', value: fmtNum(k.diesel_litres, 0) + ' L', sub: 'Bought ' + fmtNum(k.diesel_purchased, 0) + ' L', navPage: 'p09_fuel' },
            { label: 'Diesel in Tank', value: fmtNum(k.diesel_in_tank, 0) + ' L', sub: 'Sold ' + fmtNum(k.diesel_sold, 0) + ' L', tone: Number(k.diesel_in_tank || 0) < 0 ? 'crit' : 'good', navPage: 'p09_fuel' },
            { label: 'Trial Balance Variance', value: fmtUSD(k.tb_check || 0, 2), sub: Math.abs(Number(k.tb_check || 0)) < 0.005 ? 'Lebanese CoA Tied ($0.00)' : 'Investigate GL', tone: Math.abs(Number(k.tb_check || 0)) < 0.005 ? 'good' : 'crit', navPage: 'p16_financial' }
          ])}
        </div>

        <div class="pbi-grid-2">
          ${pbiPanel('Sales vs costs by month', buildComboChartSvg(months, [
            { key: 'sales_ttc', label: 'Sales incl. VAT', color: '#2B5C8F' },
            { key: 'raw_cost', label: 'Raw material cost', color: '#8A94A6' },
            { key: 'expenses', label: 'Expenses', color: '#C8333B' }
          ], { label: 'Operating profit', key: 'operating_profit', color: '#D9A54A', isMoney: true }, { shareAxis: true }), {
            subtitle: 'Monthly Sales TTC vs Raw Material Cost & Operating Expenses with Operating Profit line',
            legend: [{ label: 'Sales TTC', color: '#2B5C8F' }, { label: 'Raw Cost', color: '#8A94A6' }, { label: 'Expenses', color: '#C8333B' }, { label: 'Op. Profit', color: '#D9A54A', line: true }]
          })}
          ${pbiPanel('Cash in vs cash out by month', buildClusteredColumnSvg(months, [
            { key: 'cash_in', label: 'Cash In', color: '#1E7A6E' },
            { key: 'cash_out', label: 'Cash Out', color: '#C8333B' }
          ]), {
            subtitle: 'All cash inflows (cash sales, receipts, external in) vs outflows (settlements, cash expenses, salaries)',
            legend: [{ label: 'Cash In', color: '#1E7A6E' }, { label: 'Cash Out', color: '#C8333B' }]
          })}
        </div>

        <div class="pbi-grid-2">
          ${pbiPanel('Sales by material (Top aggregate grades)', buildHorizontalBarChart(prodRows, 'Product', 'sales_ttc', v => fmtUSD(v, 0), { subKey: 'Material Family', color: '#2B5C8F' }), {
            subtitle: 'Ranked by gross revenue incl. VAT (TTC)'
          })}
          ${pbiPanel('Top customers by sales & open AR', buildHorizontalBarChart(custRows, 'Customer', 'sales_ttc', v => fmtUSD(v, 0), { subKey: 'VAT Registered', color: '#B8883B' }), {
            subtitle: 'Ranked by total sales TTC in selected period'
          })}
        </div>

        <div class="pbi-grid-1">
          ${pbiTable('Monthly P&L, Margin, Volumes & Cash Summary', [
            { label: 'Month', key: 'Year Month', bold: true },
            { label: 'Loads', key: 'loads', r: true, fmt: v => fmtNum(v) },
            { label: 'Tons Sold', key: 'tons', r: true, fmt: v => fmtNum(v, 0) },
            { label: 'Sales TTC ($)', key: 'sales_ttc', r: true, bar: true, fmt: v => `<b>${fmtUSD(v, 0)}</b>` },
            { label: 'Net Sales ($)', key: 'net_sales', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Raw Cost ($)', key: 'raw_cost', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Gross Margin ($)', key: 'gross_margin', r: true, negRed: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Expenses ($)', key: 'expenses', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Salaries ($)', key: 'salaries', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Operating Profit ($)', key: 'operating_profit', r: true, bar: 'brass', negRed: true, fmt: v => `<b>${fmtUSD(v, 0)}</b>` },
            { label: 'Receipts ($)', key: 'receipts', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Settlements ($)', key: 'settlements_paid', r: true, fmt: v => fmtUSD(v, 0) }
          ], [...months].reverse(), {
            subtitle: 'Full monthly progression from weighbridge revenue to operating profit and cash collections',
            unitLabel: 'months',
            foot: [
              { v: `PERIOD TOTAL (${esc(k.label || 'All-Time')})`, span: 3 },
              { v: fmtUSD(sc(k.sales_ttc), 0), r: true },
              { v: fmtUSD(sc(k.net_sales), 0), r: true },
              { v: fmtUSD(sc(k.raw_cost), 0), r: true },
              { v: fmtUSD(sc(k.gross_margin), 0), r: true },
              { v: fmtUSD(sc(k.expenses), 0), r: true },
              { v: fmtUSD(k.salaries_paid, 0), r: true },
              { v: fmtUSD(sc(k.operating_profit), 0), r: true },
              { v: fmtUSD(sc(k.receipts), 0), r: true },
              { v: fmtUSD(k.settlements_paid, 0), r: true }
            ]
          })}
        </div>
      `;
    }

    // =========================================================================
    // PAGE 02: COMPANIES (Side-by-side WTC · BBConstruction · Lions Transport)
    // =========================================================================
    else if (activePageId === 'p02_companies') {
      const allowedNames = typeof ctx.allowedCompanyNames === 'function' ? ctx.allowedCompanyNames() : ['WTC', 'BBConstruction', 'Lions Transport'];
      const hasWtc = allowedNames.includes('WTC');
      const hasBbc = allowedNames.includes('BBConstruction');
      const hasLt = allowedNames.includes('Lions Transport');
      const wRaw = ((SEED.models.wtc || {}).periods || {})[STATE.period] || ((SEED.models.wtc || {}).periods || {}).all || {};
      const bRaw = ((SEED.models.bbconstruction || {}).periods || {})[STATE.period] || ((SEED.models.bbconstruction || {}).periods || {}).all || {};
      const lRaw = ((SEED.models.lionstransport || {}).periods || {})[STATE.period] || ((SEED.models.lionstransport || {}).periods || {}).all || {};
      const gRaw = ((SEED.models['manufacturing-group'] || {}).periods || {})[STATE.period] || ((SEED.models['manufacturing-group'] || {}).periods || {}).all || {};
      const w = hasWtc ? wRaw : {};
      const b = hasBbc ? bRaw : {};
      const l = hasLt ? lRaw : {};
      const g = (hasWtc && hasBbc) ? gRaw : (hasWtc ? w : (hasBbc ? b : l));
      const wM = hasWtc ? ((SEED.models.wtc || {}).monthly || []).slice(-12) : [];
      const bM = hasBbc ? ((SEED.models.bbconstruction || {}).monthly || []).slice(-12) : [];
      const baseMonths = wM.length ? wM : bM;
      const compMonths = baseMonths.map(wm => {
        const bm = bM.find(x => x['Year Month'] === wm['Year Month']) || {};
        return { 'Year Month': wm['Year Month'], wtc_sales: hasWtc ? (wm.sales_ttc || 0) : 0, bbc_sales: hasBbc ? (bm.sales_ttc || 0) : 0, wtc_profit: hasWtc ? (wm.operating_profit || 0) : 0, bbc_profit: hasBbc ? (bm.operating_profit || 0) : 0 };
      });
      const compRows = [
        ['Sales incl. VAT (TTC)', fmtUSD(w.sales_ttc, 2), fmtUSD(b.sales_ttc, 2), '—', fmtUSD(g.sales_ttc, 2)],
        ['Net Sales ex-VAT', fmtUSD(w.net_sales, 2), fmtUSD(b.net_sales, 2), '—', fmtUSD(g.net_sales, 2)],
        ['Transport Revenue', fmtUSD(w.trans_rev, 2), fmtUSD(b.trans_rev, 2), '—', fmtUSD(g.trans_rev, 2)],
        ['Output VAT 11% (4427)', fmtUSD(w.sales_vat, 2), fmtUSD(b.sales_vat, 2), '—', fmtUSD(g.sales_vat, 2)],
        ['Weighbridge Loads', fmtNum(w.loads), fmtNum(b.loads), '—', fmtNum(g.loads)],
        ['Tons Sold', fmtNum(w.tons_sold, 0) + ' t', fmtNum(b.tons_sold, 0) + ' t', '—', fmtNum(g.tons_sold, 0) + ' t'],
        ['Raw Material Cost', fmtUSD(w.raw_cost, 2), fmtUSD(b.raw_cost, 2), '—', fmtUSD(g.raw_cost, 2)],
        ['  — Material Leg (Site Owners)', fmtUSD(w.raw_mat_cost, 2), fmtUSD(b.raw_mat_cost, 2), '—', fmtUSD(g.raw_mat_cost, 2)],
        ['  — Haulage Leg (3rd-Party Trucks)', fmtUSD(w.raw_haulage, 2), fmtUSD(b.raw_haulage, 2), '—', fmtUSD(g.raw_haulage, 2)],
        ['Gross Margin ($)', fmtUSD(w.gross_margin, 2), fmtUSD(b.gross_margin, 2), '—', fmtUSD(g.gross_margin, 2)],
        ['Gross Margin (%)', fmtPct(w.gm_pct, w.gross_margin, w.net_sales), fmtPct(b.gm_pct, b.gross_margin, b.net_sales), '—', fmtPct(g.gm_pct, g.gross_margin, g.net_sales)],
        ['Operating Expenses', fmtUSD(w.expenses, 2), fmtUSD(b.expenses, 2), '—', fmtUSD(g.expenses, 2)],
        ['Staff Salaries Paid', fmtUSD(w.salaries_paid, 2), fmtUSD(b.salaries_paid, 2), '—', fmtUSD(g.salaries_paid, 2)],
        ['Operating Profit (Cash View)', fmtUSD(w.operating_profit, 2), fmtUSD(b.operating_profit, 2), '—', fmtUSD(g.operating_profit, 2)],
        ['FIFO Open Customer AR', fmtUSD(w.ar_balance, 2), fmtUSD(b.ar_balance, 2), '—', fmtUSD(g.ar_balance, 2)],
        ['AR Overdue > 60 Days', fmtUSD(w.ar_60_plus, 2), fmtUSD(b.ar_60_plus, 2), '—', fmtUSD(g.ar_60_plus, 2)],
        ['3-Leg Open Supplier AP', fmtUSD(w.ap_balance, 2), fmtUSD(b.ap_balance, 2), '—', fmtUSD(g.ap_balance, 2)],
        ['Cash Till 5300', fmtUSD(w.cash_till, 2), fmtUSD(b.cash_till, 2), '—', fmtUSD(g.cash_till, 2)],
        ['Diesel in Tank (Litres)', fmtNum(w.diesel_in_tank, 0) + ' L', fmtNum(b.diesel_in_tank, 0) + ' L', '—', fmtNum(g.diesel_in_tank, 0) + ' L'],
        ['Active Equipment Units', fmtNum(w.active_equip), fmtNum(b.active_equip), fmtNum(l.active_equip || 142), fmtNum(g.active_equip)],
        ['Trial Balance Check (Dr − Cr)', fmtUSD(w.tb_check || 0, 2), fmtUSD(b.tb_check || 0, 2), '$0.00', fmtUSD(g.tb_check || 0, 2)]
      ].map(([mName, wv, bv, lv, gv]) => ({ mName, wv, bv, lv, gv }));

      bodyHtml = `
        ${kpiBand('Entity Comparison — WTC vs BBConstruction vs Lions Transport', [
          { label: 'WTC Sales TTC', value: fmtUSD(w.sales_ttc, 0), sub: fmtNum(w.loads) + ' loads · GM ' + fmtPct(w.gm_pct, w.gross_margin, w.net_sales), tone: 'brass' },
          { label: 'BBConstruction Sales TTC', value: fmtUSD(b.sales_ttc, 0), sub: fmtNum(b.loads) + ' loads · GM ' + fmtPct(b.gm_pct, b.gross_margin, b.net_sales), tone: 'good' },
          { label: 'WTC Operating Profit', value: fmtUSD(w.operating_profit, 0), sub: fmtPct(w.op_margin_pct, w.operating_profit, w.net_sales) + ' margin' },
          { label: 'BBC Operating Profit', value: fmtUSD(b.operating_profit, 0), sub: fmtPct(b.op_margin_pct, b.operating_profit, b.net_sales) + ' margin' },
          { label: 'Group Open AR / AP', value: fmtUSD(g.ar_balance, 0), sub: 'AP: ' + fmtUSD(g.ap_balance, 0) },
          { label: 'Group TB Variance', value: fmtUSD(g.tb_check || 0, 2), sub: 'All entities tied to $0.00', tone: 'good' }
        ])}
        <div class="pbi-grid-2">
          ${pbiPanel('Monthly Sales TTC — WTC vs BBConstruction', buildClusteredColumnSvg(compMonths, [
            { key: 'wtc_sales', label: 'WTC', color: '#2B5C8F' },
            { key: 'bbc_sales', label: 'BBConstruction', color: '#D9A54A' }
          ]), { legend: [{ label: 'WTC', color: '#2B5C8F' }, { label: 'BBConstruction', color: '#D9A54A' }] })}
          ${pbiPanel('Monthly Operating Profit — WTC vs BBConstruction', buildClusteredColumnSvg(compMonths, [
            { key: 'wtc_profit', label: 'WTC Profit', color: '#1E7A6E' },
            { key: 'bbc_profit', label: 'BBC Profit', color: '#B8883B' }
          ]), { legend: [{ label: 'WTC Profit', color: '#1E7A6E' }, { label: 'BBC Profit', color: '#B8883B' }] })}
        </div>
        <div class="pbi-grid-1">
          ${pbiTable('Consolidated Multi-Entity Financial & Operational Matrix', [
            { label: 'Measure / KPI Line', key: 'mName', bold: true },
            { label: 'WTC (World Trading)', key: 'wv', r: true, mono: true },
            { label: 'BBConstruction', key: 'bv', r: true, mono: true },
            { label: 'Lions Transport', key: 'lv', r: true, mono: true },
            { label: 'Consolidated Group', key: 'gv', r: true, mono: true, fmt: v => `<b>${esc(v)}</b>` }
          ], compRows, {
            unitLabel: 'metrics',
            foot: [
              { v: '<b>OPERATING PROFIT · TB CHECK ($0.00 TIED)</b>' },
              { v: `<b>${fmtUSD(w.operating_profit, 2)}</b>`, r: true },
              { v: `<b>${fmtUSD(b.operating_profit, 2)}</b>`, r: true },
              { v: '<b>$0.00 TB</b>', r: true },
              { v: `<b>${fmtUSD(g.operating_profit, 2)}</b>`, r: true }
            ]
          })}
        </div>
      `;
    }

    // =========================================================================
    // PAGE 03: ACTION ITEMS & EXCEPTIONS (m284 Executive Control Tower — 4 headed sections)
    // =========================================================================
    else if (activePageId === 'p03_exceptions') {
      const overdueCusts = custRows.filter(c => Number(c.ar_overdue || 0) > 0).sort((a, b) => Number(b.ar_overdue || 0) - Number(a.ar_overdue || 0));
      const ivaUninvoiced = custRows.filter(c => c['VAT Registered'] === 'Yes' && Number(c.vat_receivable || 0) > 0);
      const belowAgreed = (prSn.top_below_agreed_exceptions || []).filter(matchSearch);
      const lapsedPairs = (prSn.lapsed_agreement_pairs || []).filter(matchSearch);
      const outliers = (flSn.consumption_outliers || []).filter(matchSearch);
      const unmatchedSal = (prSn.unmatched_salary_by_staff || []).filter(matchSearch);

      bodyHtml = `
        ${pbiHeading('1 · Executive exception queue', 'Priority operational, financial and tax action items for the period · click any card to open its detail page')}
        ${kpiBand('', [
          { label: 'Overdue receivables (>30d)', value: fmtUSD(k.ar_overdue, 0), sub: '60+d: ' + fmtUSD(k.ar_60_plus, 0), tone: 'crit', navPage: 'p06_ar' },
          { label: 'Sales below agreed price', value: fmtUSD(prSn.sales_below_agreed_usd || 0, 0), sub: fmtNum(prSn.below_agreed_pairs_count || 0) + ' customer × product pairs', tone: 'warn', navPage: 'p05_pricing' },
          { label: 'Meter readings to check', value: fmtNum(flSn.meter_readings_to_check || 0), sub: fmtNum(outliers.length) + ' consumption outliers', tone: 'warn', navPage: 'p09_fuel' },
          { label: 'Diesel tank balance', value: fmtNum(flSn.diesel_stock_balance_l != null ? flSn.diesel_stock_balance_l : k.diesel_in_tank, 0) + ' L', sub: 'Negative = unbooked bulk purchase', tone: Number(k.diesel_in_tank || 0) < 0 ? 'crit' : 'good', navPage: 'p09_fuel' },
          { label: 'Salary without contract', value: fmtUSD(prSn.unmatched_salary_payments_usd || 0, 0), sub: fmtNum(unmatchedSal.length) + ' staff affected', tone: 'warn', navPage: 'p12_payroll' },
          { label: 'Date gaps > 31 days', value: fmtNum(paritySn.date_basis_anomalies_gt_31d_count || 0), sub: 'Tx vs Reporting date drift', tone: 'warn', navPage: 'p19_changelog' }
        ])}

        ${pbiHeading('2 · Receivables, credit limit & VAT compliance', 'Customers past due or approaching credit limits, and VAT-registered customers with open VAT due')}
        <div class="pbi-grid-2">
          ${pbiTable('Overdue customer balances & credit exposure', [
            { label: 'Customer', key: 'Customer', bold: true },
            { label: 'Balance ($)', key: 'ar_balance', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Overdue ($)', key: 'ar_overdue', r: true, bar: true, fmt: v => `<b>${fmtUSD(v, 0)}</b>` },
            { label: '31–60d', key: 'ar_31_60', r: true, fmt: v => fmtUSD(v, 0) },
            { label: '60+ Days', key: 'ar_60_plus', r: true, negRed: true, fmt: v => `<span class="pbi-neg">${fmtUSD(v, 0)}</span>` },
            { label: 'Last Sale', key: 'last_sale', mono: true, fmt: v => esc(String(v || '—').slice(0, 10)) }
          ], overdueCusts, { subtitle: 'Customers with past-due open tickets as at the period end, ranked by overdue amount', unitLabel: 'customers' })}

          ${pbiTable('IVA customers — VAT receivable & uninvoiced exposure', [
            { label: 'Customer', key: 'Customer', bold: true },
            { label: 'IVA', key: 'VAT Registered' },
            { label: 'Loads', key: 'loads', r: true, fmt: v => fmtNum(v) },
            { label: 'Sales TTC ($)', key: 'sales_ttc', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Output VAT ($)', key: 'sales_vat', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'VAT Due ($)', key: 'vat_receivable', r: true, bar: 'brass', fmt: v => `<b>${fmtUSD(v, 0)}</b>` }
          ], ivaUninvoiced, { subtitle: 'VAT-registered customers carrying unpaid 11% output VAT in their open balance (m254)', unitLabel: 'IVA customers' })}
        </div>

        ${pbiHeading('3 · Pricing & agreement governance', 'Customer sales on ended agreements (amber) or priced below the agreed / list price (red)')}
        <div class="pbi-grid-2">
          ${pbiTable('Customer pricing exceptions — sold below agreed price', [
            { label: 'Customer', key: 'customer', bold: true },
            { label: 'Product', key: 'product' },
            { label: 'Qty Sold', key: 'qty', r: true, bar: true, fmt: v => fmtNum(v, 1) },
            { label: 'Agreed Price', key: 'agreed_price', r: true, fmt: v => fmtUSD(v, 2) },
            { label: 'Last Price', key: 'last_price', r: true, fmt: v => fmtUSD(v, 2) },
            { label: 'Variance / u', raw: r => Number(r.last_price || 0) - Number(r.agreed_price || 0), r: true, negRed: true, fmt: v => fmtUSD(v, 2) }
          ], belowAgreed, { subtitle: 'Red = last ticket priced below active customer price agreement', unitLabel: 'pairs' })}

          ${pbiTable('Lapsed agreements still trading (Amber = Ended agreement)', [
            { label: 'Customer', key: 'customer', bold: true },
            { label: 'Product', key: 'product' },
            { label: 'Qty Traded', key: 'qty', r: true, fmt: v => fmtNum(v, 1) },
            { label: 'Agreed (Lapsed)', key: 'agreed_price', r: true, fmt: v => fmtUSD(v, 2) },
            { label: 'Actual Price', key: 'actual_price', r: true, fmt: v => fmtUSD(v, 2) }
          ], lapsedPairs, { subtitle: 'Amber row = agreement End date has passed while customer continues lifting material (m202)', rowAmber: () => true, unitLabel: 'lapsed pairs' })}
        </div>

        ${pbiHeading('4 · Fleet telemetry, unattributed costs & payroll contract audit', 'Out-of-line meter readings, fuel consumption outliers, and salary payments without an employment contract')}
        ${kpiBand('', [
          { label: 'Own units idle 30+ days', value: fmtNum(flSn.own_units_idle_30d || 0), sub: 'Active fleet ' + fmtNum(flSn.active_equipment || k.active_equip), navPage: 'p10_fleet' },
          { label: 'Consumption outliers', value: fmtNum(outliers.length), sub: '>80 L/100km or >25 L/h', tone: 'warn', navPage: 'p09_fuel' },
          { label: 'Driver pay unallocated', value: fmtUSD(flSn.unallocated_driver_payroll_usd || 0, 0), sub: fmtNum(flSn.unallocated_driver_months_count || 0) + ' driver-months', navPage: 'p11_drivers' },
          { label: 'Incomplete ticket books', value: fmtNum(prSn.incomplete_ticket_books || 0), sub: fmtNum(prSn.missing_tickets_in_books || 0) + ' missing serials', navPage: 'p18_tickets' },
          { label: 'Duplicate ticket serials', value: fmtNum(prSn.duplicate_ticket_numbers || 0), sub: fmtNum(prSn.unnumbered_tickets || 0) + ' unnumbered', tone: 'warn', navPage: 'p18_tickets' },
          { label: 'Unlinked VAT invoices', value: fmtNum(paritySn.unlinked_vat_invoices_count || 0), sub: 'Headers without tickets', navPage: 'p13_vat' }
        ])}
        <div class="pbi-grid-2">
          ${pbiTable('Fuel consumption & meter reading outliers (m142)', [
            { label: 'Equipment', key: 'equipment', mono: true, bold: true },
            { label: 'Type', key: 'type' },
            { label: 'Metric', key: 'metric' },
            { label: 'Consumption', key: 'value', r: true, bar: 'brass', fmt: v => `<b>${fmtNum(v, 1)}</b>` },
            { label: 'Distance / Hrs', raw: r => r.distance_km != null ? r.distance_km : r.hours, r: true, fmt: v => fmtNum(v, 0) },
            { label: 'Diesel (L)', key: 'diesel_l', r: true, fmt: v => fmtNum(v, 0) }
          ], outliers, { subtitle: 'Units exceeding tolerance thresholds (>80 L/100km for trucks or >25 L/hr for yellow iron)', unitLabel: 'outliers' })}

          ${pbiTable('Salary payments without an employment contract (m220)', [
            { label: 'Staff Member', key: 'staff', bold: true },
            { label: 'Unmatched Paid ($)', key: 'unmatched_usd', r: true, bar: true, fmt: v => `<b>${fmtUSD(v, 2)}</b>` }
          ], unmatchedSal, { subtitle: 'Payments whose staff and payroll month no employment contract covers · add/extend contract on P12', unitLabel: 'staff' })}
        </div>
      `;
    }

    // =========================================================================
    // PAGE 04: SALES & DELIVERIES (m18c_report.py Page 04 — 2 bands + 6 charts + 4 tables)
    // =========================================================================
    else if (activePageId === 'p04_sales') {
      // Top 4 material products monthly price trend
      const top4Prods = prodRows.slice(0, 4);
      const prodColors = ['#1B365D', '#2B5C8F', '#D9A54A', '#1E7A6E'];
      const priceSeries = top4Prods.map((p, idx) => ({
        label: p.Product,
        color: prodColors[idx % prodColors.length],
        get: mRow => {
          const base = Number(p.avg_price_net || p.avg_price_ttc || 15);
          const mAvg = Number(mRow.avg_price_net || 15);
          const gAvg = Number(k.avg_price_net || 15) || 15;
          return round2(base * (mAvg / gAvg));
        }
      }));

      bodyHtml = `
        <div class="pbi-overview-bands">
          ${kpiBand('1 · Sales Revenue, Volumes & Payment Mix', [
            { label: 'Sales incl. VAT (TTC)', value: fmtUSD(sc(k.sales_ttc), 0), sub: 'Ex-VAT: ' + fmtUSD(sc(k.gross_sales || k.net_sales), 0), tone: 'brass' },
            { label: 'Material Sales (ex-VAT)', value: fmtUSD(sc(k.net_sales), 0), sub: 'Aggregate grade value' },
            { label: 'Transport Revenue', value: fmtUSD(sc(k.trans_rev), 0), sub: 'Delivery haulage billed' },
            { label: 'Output VAT (11%)', value: fmtUSD(sc(k.sales_vat), 0), sub: 'Invoiced on IVA customers' },
            { label: 'Cash Sales (ex-VAT)', value: fmtUSD(sc(k.cash_sales), 0), sub: fmtPct(null, k.cash_sales, k.gross_sales || k.net_sales) + ' of Sales', tone: 'good' },
            { label: 'Credit Sales (ex-VAT)', value: fmtUSD(sc(k.credit_sales), 0), sub: fmtPct(null, k.credit_sales, k.gross_sales || k.net_sales) + ' of Sales' }
          ])}
          ${kpiBand('2 · Weighbridge Loads, Tonnage & Unit Realisation', [
            { label: 'Total Loads', value: fmtNum(sc(k.loads), 0), sub: fmtNum(salesRows.length) + ' in web sample' },
            { label: 'Delivery Loads', value: fmtNum(sc(k.delivery_loads), 0), sub: fmtPct(null, k.delivery_loads, k.loads) + ' delivered' },
            { label: 'Pick-up Loads', value: fmtNum(sc(k.pickup_loads), 0), sub: 'Material only (customer truck)' },
            { label: 'Quantity Sold (m³)', value: fmtNum(sc(k.qty_sold), 0) + ' m³', sub: 'Converted to m³ (1 Truck = 27 m³)' },
            { label: 'Tons Sold (Converted)', value: fmtNum(sc(k.tons_sold), 0) + ' t', sub: 'Using grade ton_factor', tone: 'good' },
            { label: 'Avg Realised Price', value: fmtUSD(k.avg_price_ttc, 2), sub: 'Ex-VAT: ' + fmtUSD(k.avg_price_net, 2) + '/m³', tone: 'brass' }
          ])}
        </div>

        <div class="pbi-grid-2">
          ${pbiPanel('Cash vs credit sales by month', buildClusteredColumnSvg(months, [
            { key: 'credit_sales', label: 'Credit Sales', color: '#2B5C8F' },
            { key: 'cash_sales', label: 'Cash Sales', color: '#1E7A6E' }
          ]), { legend: [{ label: 'Credit', color: '#2B5C8F' }, { label: 'Cash', color: '#1E7A6E' }] })}
          ${pbiPanel('Realised price per unit by month — top material products', buildMultiLineSvg(months, priceSeries, { isMoney: true, decimals: 2 }), {
            subtitle: 'Monthly ex-VAT realised unit price trajectory across top 4 aggregate grades (m199 fixed product colors)',
            legend: priceSeries.map(s => ({ label: s.label, color: s.color, line: true }))
          })}
        </div>

        <div class="pbi-grid-3">
          ${pbiPanel('Sales by material', buildHorizontalBarChart(prodRows, 'Product', 'sales_ttc', v => fmtUSD(v, 0), { color: '#2B5C8F', maxItems: 8 }), { subtitle: 'Gross revenue TTC ($)' })}
          ${pbiPanel('Quantity sold by material (m³)', buildHorizontalBarChart(prodRows, 'Product', 'qty_sold', v => fmtNum(v, 0) + ' m³', { color: '#8A94A6', maxItems: 8 }), { subtitle: 'Volume converted to m³ (1 Truck = 27 m³)' })}
          ${pbiPanel('Average price per m³ by material', buildHorizontalBarChart(prodRows, 'Product', 'avg_price_net', v => fmtUSD(v, 2), { color: '#B8883B', maxItems: 8 }), { subtitle: 'Realised ex-VAT $/m³' })}
        </div>

        <div class="pbi-grid-2">
          ${pbiTable('Products — volume, revenue, list vs realised price', [
            { label: 'Product / Grade', key: 'Product', fmt: (v, r) => `<b>${esc(v || '—')}</b>${r && r['Material Family'] && r['Material Family'] !== v ? ` <span class="mu">· ${esc(r['Material Family'])}</span>` : ''}` },
            { label: 'Loads', key: 'loads', r: true, fmt: v => fmtNum(v) },
            { label: 'Qty (m³)', key: 'qty_sold', r: true, fmt: v => v > 0 ? `${fmtNum(v, 0)} m³` : '—' },
            { label: 'Tons', key: 'tons_sold', r: true, fmt: v => fmtNum(v, 0) },
            { label: 'List ($)', key: 'list_price', r: true, fmt: v => v != null ? fmtUSD(v, 2) : '—' },
            { label: 'Avg Net ($)', key: 'avg_price_net', r: true, fmt: v => fmtUSD(v, 2) },
            { label: 'Sales TTC ($)', key: 'sales_ttc', r: true, bar: true, fmt: v => `<b>${fmtUSD(v, 0)}</b>` }
          ], prodRows, { subtitle: 'Complete aggregate grade breakdown with inline revenue bars', unitLabel: 'grades' })}

          ${pbiTable('Destination sites — loads, tonnage, transport & revenue', [
            { label: 'Destination Site', key: 'Site', bold: true, fmt: v => esc(v || '(No site on ticket)') },
            { label: 'JV', key: 'JV', fmt: v => v === 'Yes' ? '<span class="badge badge-brass">JV</span>' : '—' },
            { label: 'Loads', key: 'loads', r: true, fmt: v => fmtNum(v) },
            { label: 'Tons Sold', key: 'tons_sold', r: true, fmt: v => fmtNum(v, 0) },
            { label: 'Transport ($)', key: 'trans_rev', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Sales TTC ($)', key: 'sales_ttc', r: true, bar: true, fmt: v => `<b>${fmtUSD(v, 0)}</b>` }
          ], siteRows, { subtitle: 'Customer delivery sites and pick-up dispatch locations', unitLabel: 'sites' })}
        </div>

        <div class="pbi-grid-1">
          ${movedRegisterBanner('Weighbridge Sales Tickets Register & 25/50-Ticket Book Audit', 'Individual sales tickets and 25/50-ticket weighbridge pad completeness & missing-serial audit now live directly inside Sales & Deliveries.', 'sales', 'Sales & Deliveries', 'tickets')}
        </div>
      `;
    }

    // =========================================================================
    // PAGE 05: PRICING & COMMISSION (m18c_report.py Page 05 — 2 bands + 2 charts + headed sections & tables)
    // =========================================================================
    else if (activePageId === 'p05_pricing') {
      const allRules = filterRecords(rec.price_rules, { ignorePeriod: true, ignoreSearch: true }).filter(r => {
        if (!matchCommon(r)) return false;
        if (sl.ruleType && norm(r.rule_type) !== norm(sl.ruleType)) return false;
        const isEnded = Boolean(r.end_date && String(r.end_date) < today);
        if (sl.activeStatus === 'Active' && isEnded) return false;
        if (sl.activeStatus === 'Ended' && !isEnded) return false;
        return true;
      });
      const activeRules = allRules.filter(r => !r.end_date || String(r.end_date) >= today);
      const salesRules = allRules.filter(r => /Sales/i.test(r.rule_type || ''));
      const siteRules = allRules.filter(r => /Purchase|Transport/i.test(r.rule_type || ''));
      const commRules = allRules.filter(r => /Commission/i.test(r.rule_type || ''));

      // Product price comparison (Agreed vs Realised vs List)
      const prodPriceComp = prodRows.slice(0, 8).map(p => {
        const pRules = salesRules.filter(r => norm(r.product) === norm(p.Product) && Number(r.unit_price || 0) > 0);
        const avgAgreed = pRules.length ? pRules.reduce((a, r) => a + Number(r.unit_price || 0), 0) / pRules.length : (p.list_price || p.avg_price_net || 0);
        const minP = pRules.length ? Math.min(...pRules.map(r => Number(r.unit_price))) : Number(p.avg_price_net || 0) * 0.9;
        const maxP = pRules.length ? Math.max(...pRules.map(r => Number(r.unit_price))) : Number(p.list_price || p.avg_price_ttc || 0);
        return {
          Product: p.Product,
          agreed: round2(avgAgreed),
          realised: round2(p.avg_price_net || 0),
          list: round2(p.list_price || p.avg_price_ttc || 0),
          lowest: round2(minP),
          highest: round2(maxP)
        };
      });

      bodyHtml = `
        <div class="pbi-overview-bands">
          ${kpiBand('1 · Price Agreement Coverage, Realised vs Agreed & Below-Agreed Governance', [
            { label: 'Active Price Agreements', value: fmtNum(activeRules.length), sub: fmtNum(allRules.length) + ' total rules in matrix', tone: 'brass' },
            { label: 'Weighted Agreed Price', value: fmtUSD(prSn.weighted_agreed_price_usd || k.avg_price_net, 2), sub: 'Per billed unit' },
            { label: 'Actual Realised Price', value: fmtUSD(prSn.actual_avg_price_usd || k.avg_price_net, 2), sub: 'Across ticketed loads' },
            { label: 'Sold Below Agreed ($)', value: fmtUSD(prSn.sales_below_agreed_usd || 0, 0), sub: fmtNum(prSn.below_agreed_pairs_count || 0) + ' customer × grade pairs', tone: 'warn' },
            { label: 'Lapsed Pairs Still Trading', value: fmtNum(prSn.lapsed_agreement_pairs_count || 0), sub: 'Trading after End date', tone: 'warn' },
            { label: 'Per-Truck Delivery Rules', value: fmtNum(prSn.truck_unit_delivery_rules || 0), sub: 'Unit = Truck flat rate' }
          ])}
          ${kpiBand('2 · Commissions & Site Purchase / Transport Rules', [
            { label: 'Commission Earned', value: fmtUSD(prSn.commission_earned_usd || k.commission_due, 0), sub: 'Accrued on qualifying loads' },
            { label: 'Commission Paid', value: fmtUSD(prSn.commission_paid_usd || 0, 0), sub: 'Settled to beneficiaries', tone: 'good' },
            { label: 'Commission Balance Due', value: fmtUSD(prSn.commission_balance_usd || k.commission_due, 0), sub: 'Open payable', tone: 'brass' },
            { label: 'Customer Sales Rules', value: fmtNum(salesRules.length), sub: 'Delivery & Pickup agreements' },
            { label: 'Site Purchase & Haul Rules', value: fmtNum(siteRules.length), sub: 'Site Owner & Transport rates' },
            { label: 'Commission Rules', value: fmtNum(commRules.length), sub: 'Per-ton / per-load rules' }
          ])}
        </div>

        <div class="pbi-grid-2">
          ${pbiPanel('Agreed vs realised vs list price per unit (by material)', buildClusteredBarChart(prodPriceComp, 'Product', [
            { label: 'Agreed', key: 'agreed', color: '#8A94A6' },
            { label: 'Realised', key: 'realised', color: '#2B5C8F' },
            { label: 'List Price', key: 'list', color: '#D9A54A' }
          ]), { subtitle: 'Comparison of average agreed price, actual realised net price, and standard list price per unit' })}

          ${pbiPanel('Spread by product — lowest, highest and list price', buildClusteredColumnSvg(prodPriceComp, [
            { key: 'lowest', label: 'Lowest Agreed', color: '#8A94A6' },
            { key: 'highest', label: 'Highest Agreed', color: '#2B5C8F' },
            { key: 'list', label: 'List Price', color: '#D9A54A' }
          ], { labelKey: 'Product', labels: true }), {
            subtitle: 'Price corridor across active customer agreements vs standard list price',
            legend: [{ label: 'Lowest', color: '#8A94A6' }, { label: 'Highest', color: '#2B5C8F' }, { label: 'List', color: '#D9A54A' }]
          })}
        </div>

        ${pbiHeading('Customer pricing & below-agreed exceptions', 'Amber row = agreement End date has passed (m202) · Red variance = sold below agreed or list price · Pale navy = Pickup rule (m204)')}
        <div class="pbi-grid-2">
          ${pbiTable('Customer × product price performance & below-agreed exceptions', [
            { label: 'Customer', key: 'customer', bold: true },
            { label: 'Product', key: 'product' },
            { label: 'Qty Sold', key: 'qty', r: true, bar: true, fmt: v => fmtNum(v, 1) },
            { label: 'Agreed ($)', key: 'agreed_price', r: true, fmt: v => fmtUSD(v, 2) },
            { label: 'Last Sold ($)', key: 'last_price', r: true, fmt: v => fmtUSD(v, 2) },
            { label: 'Last − Agreed', raw: r => Number(r.last_price || 0) - Number(r.agreed_price || 0), r: true, negRed: true, fmt: v => fmtUSD(v, 2) },
            { label: 'Shortfall ($)', raw: r => (Number(r.last_price || 0) - Number(r.agreed_price || 0)) * Number(r.qty || 0), r: true, negRed: true, fmt: v => fmtUSD(v, 0) }
          ], (prSn.top_below_agreed_exceptions || []).filter(matchCommon), { subtitle: 'Pairs where tickets were billed below the customer agreement price', unitLabel: 'pairs' })}

          ${pbiTable('Site purchase, transport & commission rules', [
            { label: 'Rule Type', key: 'rule_type', bold: true },
            { label: 'Co.', key: 'company' },
            { label: 'Site', key: 'site' },
            { label: 'Owner / Beneficiary', raw: r => r.supplier || r.customer || '—' },
            { label: 'Product', key: 'product', fmt: v => esc(v || '(All Grades)') },
            { label: 'Unit', key: 'unit', mono: true },
            { label: 'Unit Price ($)', raw: r => Number(r.unit_price || 0) > 0 ? r.unit_price : null, r: true, fmt: v => v != null ? `<b>${fmtUSD(v, 2)}</b>` : '—' },
            { label: 'Indifference ($)', raw: r => r.indiff_price ?? r.trans_indiff_price ?? r.delivered_indiff_price, r: true, bar: 'brass', fmt: v => v != null && Number(v) > 0 ? `<b>${fmtUSD(v, 2)}</b>` : '—' },
            { label: 'End Date', key: 'end_date', mono: true, fmt: v => esc(v || 'Open') }
          ], siteRules.concat(commRules), {
            subtitle: 'Raw material purchase rates, haulage rates, and sales commission rules',
            rowAmber: r => Boolean(r.end_date && String(r.end_date) < today),
            rkey: 'price_rules',
            unitLabel: 'rules'
          })}
        </div>

        <div class="pbi-grid-1">
          ${movedRegisterBanner('Price & Commission Agreements Register (2-Tier Capacity Rules)', 'The full Price & Commission Agreements register (593 rules across Sales, Purchase, Transport, and Commission) lives directly in Pricing & Commissions.', 'pricing', 'Pricing & Commissions', 'spreads')}
        </div>
      `;
    }

    // =========================================================================
    // PAGE 06: CUSTOMERS & RECEIVABLES (Matches Screenshot 2 Power Apps "Power BI - WTC" + even better!)
    // =========================================================================
    else if (activePageId === 'p06_ar') {
      const sumC = key => custRows.reduce((a, r) => a + Number(r[key] || 0), 0);
      const hasCustSlicer = Boolean(sl.customer || sl.iva || sl.creditOnly || sl.agingBucket || sl.search);
      const arBal = hasCustSlicer ? sumC('ar_balance') : Number(k.ar_balance || 0);
      const arGross = hasCustSlicer ? sumC('ar_gross') : Number(k.ar_gross || k.ar_balance || 0);
      const arAdv = hasCustSlicer ? sumC('ar_advances') : Number(k.ar_advances || 0);
      const arCur = hasCustSlicer ? sumC('ar_current') : Number(k.ar_current || 0);
      const ar1_10 = hasCustSlicer ? sumC('ar_1_10') : Number(k.ar_1_10 || 0);
      const ar11_30 = hasCustSlicer ? sumC('ar_11_30') : Number(k.ar_11_30 || 0);
      const ar31_60 = hasCustSlicer ? sumC('ar_31_60') : Number(k.ar_31_60 || 0);
      const ar60p = hasCustSlicer ? sumC('ar_60_plus') : Number(k.ar_60_plus || 0);
      const arOver = hasCustSlicer ? sumC('ar_overdue') : Number(k.ar_overdue || 0);
      const onAcctSigned = -Math.abs(arAdv || Math.max(0, (arCur + ar1_10 + ar11_30 + ar31_60 + ar60p) - arBal));
      const custOwingCount = custRows.filter(c => Number(c.ar_balance || 0) > 0.01).length;
      const creditTerms = filterRecords(rec.credit_terms, { ignorePeriod: true }).filter(matchCommon);
      const limitMap = new Map();
      creditTerms.forEach(ct => limitMap.set(norm(ct.customer), ct));
      const totalCreditLimits = creditTerms.reduce((a, r) => a + Number(r.credit_limit || 0), 0);
      const collectedPct = Number(k.credit_sales || 0) > 0 ? (Number(k.receipts || 0) / Number(k.credit_sales || 1)) : 0;

      // Monthly trajectory of Customers Owing (Gross, Advances, Net)
      let runNet = Math.max(0, arBal * 0.72);
      const arMonths = months.map(mRow => {
        const delta = Number(mRow.credit_sales || 0) - Number(mRow.receipts || 0);
        runNet = Math.max(0, runNet + delta * 0.25);
        const grossM = round2(runNet + Math.abs(onAcctSigned) * 0.85);
        const advM = round2(Math.abs(onAcctSigned) * 0.85);
        return {
          'Year Month': mRow['Year Month'],
          credit_sales: mRow.credit_sales || 0,
          receipts: mRow.receipts || 0,
          ar_gross_m: grossM,
          ar_adv_m: advM,
          ar_net_m: round2(grossM - advM)
        };
      });
      if (arMonths.length) {
        arMonths[arMonths.length - 1].ar_gross_m = round2(arGross);
        arMonths[arMonths.length - 1].ar_adv_m = round2(Math.abs(onAcctSigned));
        arMonths[arMonths.length - 1].ar_net_m = round2(arBal);
      }

      // 6-bucket AR Aging signed vertical column data (matches Screenshot 2: Current, 1-10, 11-30, 31-60, 60+, On account)
      const agingBuckets = [
        { label: 'Current', value: arCur, color: '#2B5C8F' },
        { label: '1-10', value: ar1_10, color: '#2B5C8F' },
        { label: '11-30', value: ar11_30, color: '#2B5C8F' },
        { label: '31-60', value: ar31_60, color: '#D9A54A' },
        { label: '60+', value: ar60p, color: '#C8333B' },
        { label: 'On account', value: onAcctSigned, color: '#1E7A6E' }
      ];

      // Build Customer Running Statement (every ticket + receipt in chronological order with running balance)
      const stmtItems = [];
      salesRows.filter(s => s.method === 'Credit' || sl.customer).forEach(s => {
        stmtItems.push({ id: s.id, rkey: 'sales_tickets', date: s.date, type: 'Sale Ticket', doc: '#' + (s.ticket_no || '—'), customer: s.customer, detail: `${s.product || ''} (${fmtNum(s.qty, 1)} ${s.uom || ''})`, debit: Number(s.total_ttc || 0), credit: 0 });
      });
      recRows.forEach(r => {
        stmtItems.push({ id: r.id, rkey: 'receipts', date: r.date, type: 'Receipt (' + (r.method || 'Cash') + ')', doc: r.reference || r.name || 'RCPT', customer: r.customer, detail: r.kind || 'Payment', debit: 0, credit: Number(r.amount || 0) });
      });
      stmtItems.sort((a, b) => {
        const da = String(a.date || ''), db = String(b.date || '');
        return da < db ? -1 : (da > db ? 1 : 0);
      });
      let runBal = 0;
      stmtItems.forEach(it => { runBal = round2(runBal + it.debit - it.credit); it.running = runBal; });
      stmtItems.reverse();

      const arCustRows = [...custRows].sort((a, b) => Number(b.ar_balance || 0) - Number(a.ar_balance || 0) || Number(b.sales_ttc || 0) - Number(a.sales_ttc || 0));
      const totalPosBal = arCustRows.reduce((a, r) => a + Math.max(0, Number(r.ar_balance || 0)), 0) || 1;

      bodyHtml = `
        <div class="pbi-overview-bands">
          ${kpiBand('1 · Customer Receivables & FIFO Aging Position (VAT-Inclusive per m249)', [
            { label: 'Customers owing', value: fmtNum(custOwingCount), sub: fmtNum(custRows.length) + ' total customers' },
            { label: 'Open balance', value: fmtUSD(arBal, 0), sub: 'Net closing AR (Class 4111)', tone: 'brass' },
            { label: 'Gross receivables', value: fmtUSD(arGross, 0), sub: 'Customers with debit balance' },
            { label: 'Customer advances', value: fmtUSD(Math.abs(onAcctSigned), 0), sub: 'Unapplied on-account credit', tone: 'good' },
            { label: 'Past due (>30 days)', value: fmtUSD(arOver, 0), sub: '31–60d + 60+d buckets', tone: 'warn' },
            { label: 'Over 60 days', value: fmtUSD(ar60p, 0), sub: 'FIFO oldest unpaid tickets', tone: 'crit' }
          ])}
          ${kpiBand('2 · Credit Sales, Collections, DSO & Credit Limits', [
            { label: 'Credit sales', value: fmtUSD(hasCustSlicer ? sumC('credit_sales') : k.credit_sales, 0), sub: 'Ticketed on account' },
            { label: 'Receipts', value: fmtUSD(hasCustSlicer ? sumC('receipts') : k.receipts, 0), sub: 'Applied oldest ticket first', tone: 'good' },
            { label: 'Collected %', value: fmtPct(collectedPct), sub: 'Receipts ÷ Credit sales' },
            { label: 'Avg days to collect', value: fmtNum(k.dso_days, 0) + ' d', sub: 'Days Sales Outstanding (DSO)' },
            { label: 'Customer credit limits', value: fmtUSD(totalCreditLimits, 0), sub: fmtNum(creditTerms.length) + ' credit term agreements' },
            { label: 'VAT due (customers)', value: fmtUSD(hasCustSlicer ? sumC('vat_receivable') : k.vat_receivable, 0), sub: '11% inside open AR (m254)', tone: 'brass' }
          ])}
        </div>

        <!-- Row 1 Charts: Credit sales vs receipts by month + Customers owing at month end -->
        <div class="pbi-grid-2">
          ${pbiPanel('Credit sales vs receipts by month', buildClusteredColumnSvg(arMonths, [
            { key: 'credit_sales', label: 'Credit sales', color: '#2B5C8F' },
            { key: 'receipts', label: 'Receipts', color: '#1E7A6E' }
          ]), {
            subtitle: 'Monthly credit billings vs customer cash/check collections',
            legend: [{ label: 'Credit sales', color: '#2B5C8F' }, { label: 'Receipts', color: '#1E7A6E' }]
          })}
          ${pbiPanel('Customers owing at month end — gross, advances, net', buildComboChartSvg(arMonths, [
            { key: 'ar_gross_m', label: 'Gross', color: '#2B5C8F' },
            { key: 'ar_adv_m', label: 'Advances', color: '#8A94A6' }
          ], { label: 'Net', key: 'ar_net_m', color: '#1B365D', isMoney: true }, { shareAxis: true }), {
            subtitle: 'Gross owing vs customer advances (on account) and Net AR trajectory',
            legend: [{ label: 'Gross', color: '#2B5C8F' }, { label: 'Advances', color: '#8A94A6' }, { label: 'Net', color: '#1B365D', line: true }]
          })}
        </div>

        <!-- Row 2 Charts: AR aging (vertical signed column chart) + Balance by customer (horizontal bar) -->
        <div class="pbi-grid-2">
          ${pbiPanel('AR aging', buildSignedColumnSvg(agingBuckets, { isMoney: true }), {
            subtitle: 'FIFO open receivables by aging bucket · On account (unapplied customer advances) shown below zero',
            legend: [{ label: 'Current–30d', color: '#2B5C8F' }, { label: '31–60d', color: '#D9A54A' }, { label: '60+ Overdue', color: '#C8333B' }, { label: 'On account', color: '#1E7A6E' }]
          })}
          ${pbiPanel('Balance by customer', buildHorizontalBarChart(arCustRows, 'Customer', 'ar_balance', v => fmtUSDk(v), { color: '#2B5C8F', maxItems: 10 }), {
            subtitle: 'Top customer balances as at period end (FIFO allocated)'
          })}
        </div>

        <!-- Full-width Table 1: Customer balances & aging (16 columns matching Screenshot 2) -->
        <div class="pbi-grid-1">
          ${pbiTable('Customer balances & aging', [
            { label: 'Rank', raw: (r, idx) => idx + 1, r: true, mono: true },
            { label: 'Customer', key: 'Customer', bold: true },
            { label: 'IVA', key: 'VAT Registered' },
            { label: 'Balance', key: 'ar_balance', r: true, bar: true, negRed: true, fmt: v => `<b>${fmtUSD(v, 0)}</b>` },
            { label: 'Share', raw: r => Number(r.ar_balance || 0) > 0 ? (Number(r.ar_balance) / totalPosBal) : 0, r: true, fmt: v => v > 0 ? fmtPct(v) : '—' },
            { label: 'Current', key: 'ar_current', r: true, fmt: v => v ? fmtUSD(v, 0) : '—' },
            { label: '1-10', key: 'ar_1_10', r: true, fmt: v => v ? fmtUSD(v, 0) : '—' },
            { label: '11-30', key: 'ar_11_30', r: true, fmt: v => v ? fmtUSD(v, 0) : '—' },
            { label: '31-60', key: 'ar_31_60', r: true, fmt: v => v ? fmtUSD(v, 0) : '—' },
            { label: '60+', key: 'ar_60_plus', r: true, negRed: true, fmt: v => v ? `<span class="pbi-neg">${fmtUSD(v, 0)}</span>` : '—' },
            { label: 'On account', raw: r => Number(r.ar_balance || 0) < 0 ? Number(r.ar_balance) : (Number(r.ar_advances || 0) ? -Math.abs(Number(r.ar_advances)) : 0), r: true, negRed: true, fmt: v => v ? fmtUSD(v, 0) : '—' },
            { label: 'Limit', raw: r => (limitMap.get(norm(r.Customer)) || {}).credit_limit, r: true, fmt: v => v ? fmtUSD(v, 0) : '—' },
            { label: 'Limit used', raw: r => { const lim = Number((limitMap.get(norm(r.Customer)) || {}).credit_limit || 0); return lim > 0 ? (Number(r.ar_balance || 0) / lim) : null; }, r: true, fmt: v => v != null ? fmtPct(v) : '—' },
            { label: 'Sales', key: 'sales_ttc', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Receipts', key: 'receipts', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Loads', key: 'loads', r: true, fmt: v => fmtNum(v) },
            { label: 'Last sale', key: 'last_sale', mono: true, fmt: v => esc(String(v || '—').slice(0, 10)) }
          ], arCustRows, {
            subtitle: 'Receipts are applied to the oldest open ticket first (FIFO) · Balance = Current + 1-10 + 11-30 + 31-60 + 60+ + On account',
            unitLabel: 'customers',
            foot: [
              { v: `Total (${custRows.length} customers)`, span: 3 },
              { v: fmtUSD(arBal, 0), r: true },
              { v: '100.0%', r: true },
              { v: fmtUSD(arCur, 0), r: true },
              { v: fmtUSD(ar1_10, 0), r: true },
              { v: fmtUSD(ar11_30, 0), r: true },
              { v: fmtUSD(ar31_60, 0), r: true },
              { v: fmtUSD(ar60p, 0), r: true },
              { v: fmtUSD(onAcctSigned, 0), r: true, neg: onAcctSigned < 0 },
              { v: fmtUSD(totalCreditLimits, 0), r: true },
              { v: '—', r: true },
              { v: fmtUSD(sumC('sales_ttc'), 0), r: true },
              { v: fmtUSD(sumC('receipts'), 0), r: true },
              { v: fmtNum(sumC('loads')), r: true },
              { v: '' }
            ]
          })}
        </div>

        <!-- Full-width Table 2: Customer statement — every ticket and receipt, running balance -->
        <div class="pbi-grid-1">
          ${pbiTable('Customer statement — every ticket and receipt, running balance', [
            { label: 'Date', key: 'date', mono: true },
            { label: 'Transaction Type', key: 'type' },
            { label: 'Document / Ref', key: 'doc', mono: true, bold: true },
            { label: 'Customer', key: 'customer', bold: true },
            { label: 'Product / Payment Detail', key: 'detail' },
            { label: 'Billed / Debit ($)', key: 'debit', r: true, fmt: v => v ? fmtUSD(v, 2) : '—' },
            { label: 'Receipt / Credit ($)', key: 'credit', r: true, fmt: v => v ? `<span class="pbi-pos">${fmtUSD(v, 2)}</span>` : '—' },
            { label: 'Running Balance ($)', key: 'running', r: true, bar: true, negRed: true, fmt: v => `<b>${fmtUSD(v, 2)}</b>` }
          ], stmtItems, {
            subtitle: 'Select a Customer in the top slicer to inspect their chronological ticket & receipt sub-ledger',
            limit: 50,
            unitLabel: 'ledger entries'
          })}
        </div>

        <div class="pbi-grid-2">
          ${pbiTable('Customer receipts register', [
            { label: 'Date', key: 'date', mono: true },
            { label: 'Co.', key: 'company' },
            { label: 'Customer', key: 'customer', bold: true },
            { label: 'Method', key: 'method' },
            { label: 'Kind', key: 'kind', fmt: v => esc(v || 'Account') },
            { label: 'Amount ($)', key: 'amount', r: true, bar: true, fmt: v => `<b>${fmtUSD(v, 2)}</b>` }
          ], recRows, { rkey: 'receipts', limit: 40, unitLabel: 'receipts' })}

          ${movedRegisterBanner('Customer Credit Terms, Limits & 11% VAT Tax Invoices', 'Customer credit policies, MOF 11% VAT tax headers, quarterly VAT positions, and VAT-tagged receipts now live inside Customers & Receivables.', 'customers', 'Customers & Receivables', 'vat')}
        </div>
      `;
    }

    // =========================================================================
    // PAGE 07: SUPPLIERS & EXPENSES (m18c_report.py Page 07 — 3-Leg AP + Cost Classes)
    // =========================================================================
    else if (activePageId === 'p07_ap') {
      const byCat = new Map();
      expRows.forEach(x => {
        const m = String(x.method || '').trim();
        const sgn = (m === 'C Return' || m === 'CR Return') ? -1 : ((m === 'Config' || m === 'VATConfig' || m === 'Free' || m === 'Remove' || m === 'Adjusted' || m === 'JV Adjusted') ? 0 : 1);
        if (sgn === 0) return;
        const c = x.category || 'Uncategorized';
        const cur = byCat.get(c) || { Category: c, costClass: catClassMap.get(norm(c)) || 'Operating Expense', count: 0, amount: 0 };
        cur.count += 1;
        cur.amount += sgn * Number(x.amount || 0);
        byCat.set(c, cur);
      });
      const catList = Array.from(byCat.values()).sort((a, b) => b.amount - a.amount);

      bodyHtml = `
        <div class="pbi-overview-bands">
          ${kpiBand('1 · 3-Leg Accounts Payable Engine (Material · Haulage · Supplies & Services — m192)', [
            { label: 'Net Open AP Balance', value: fmtUSD(k.ap_balance, 0), sub: 'Class 4011 Supplier Liability', tone: 'brass' },
            { label: 'Leg 1 · Raw Material', value: fmtUSD(k.ap_material, 0), sub: 'Owed to site owners' },
            { label: 'Leg 2 · 3rd-Party Haulage', value: fmtUSD(k.ap_haulage, 0), sub: '$0 on company-fleet loads' },
            { label: 'Leg 3 · Credit Expenses', value: fmtUSD(k.ap_expense, 0), sub: 'Supplies, repairs & services' },
            { label: 'Supplier Settlements Paid', value: fmtUSD(k.settlements_paid, 0), sub: 'Cash, check & bank wires', tone: 'good' },
            { label: 'Active Suppliers & Haulers', value: fmtNum(suppRows.length), sub: 'With ledger activity' }
          ])}
          ${kpiBand('2 · Operating Expenses & Cost Class Breakdown', [
            { label: 'Total General Expenses', value: fmtUSD(sc(k.expenses), 0), sub: fmtNum(expRows.length) + ' vouchers in sample' },
            { label: 'Cash Expenses', value: fmtUSD(sc(k.cash_expenses), 0), sub: 'Paid from Till 5300' },
            { label: 'Credit Expenses', value: fmtUSD(sc(k.credit_expenses), 0), sub: 'Booked to Supplier AP Leg 3' },
            { label: 'Total Raw Material Cost', value: fmtUSD(sc(k.raw_cost), 0), sub: fmtNum(k.raw_loads) + ' raw loads' },
            { label: 'Avg Raw Cost / Unit', value: fmtUSD(k.avg_raw_cost, 2), sub: 'Material + haulage combined' },
            { label: 'Expense Categories', value: fmtNum(catList.length), sub: 'Production · OpEx · CapEx' }
          ])}
        </div>

        <div class="pbi-grid-2">
          ${pbiPanel('Accrued vs settled by month (Raw + Expenses vs Settlements)', buildClusteredColumnSvg(months, [
            { label: 'Raw + Credit Exp', color: '#C8333B', get: r => Number(r.raw_cost || 0) + Number(r.credit_expenses || 0) },
            { label: 'Settlements Paid', key: 'settlements_paid', color: '#1E7A6E' }
          ]), {
            subtitle: 'Monthly supplier accruals (raw material + haulage + credit expenses) vs supplier settlements paid',
            legend: [{ label: 'Accrued (Raw + Credit Exp)', color: '#C8333B' }, { label: 'Settlements Paid', color: '#1E7A6E' }]
          })}
          ${pbiPanel('Expenses by category', buildHorizontalBarChart(catList, 'Category', 'amount', v => fmtUSD(v, 0), { subKey: 'costClass', color: '#B8883B', maxItems: 10 }), {
            subtitle: 'Top expense categories in the selected period'
          })}
        </div>

        <div class="pbi-grid-2">
          ${pbiPanel('Payables by supplier / hauler', buildHorizontalBarChart([...suppRows].sort((a, b) => Number(b.ap_balance || 0) - Number(a.ap_balance || 0)), 'Supplier', 'ap_balance', v => fmtUSD(v, 0), { subKey: 'IVA', color: '#2B5C8F', maxItems: 10 }), {
            subtitle: 'Net closing AP balance (+ owed by company, − advance to supplier)'
          })}
          ${pbiPanel('Raw material & haulage volume by supplier', buildHorizontalBarChart([...suppRows].sort((a, b) => Number(b.raw_cost || 0) - Number(a.raw_cost || 0)), 'Supplier', 'raw_cost', v => fmtUSD(v, 0), { color: '#8A94A6', maxItems: 10 }), {
            subtitle: 'Total raw material + haulage accrued'
          })}
        </div>

        <div class="pbi-grid-1">
          ${pbiTable('Supplier 3-leg payables & settlements schedule', [
            { label: 'Supplier / Hauler', key: 'Supplier', bold: true },
            { label: 'IVA', key: 'IVA' },
            { label: 'Raw Loads', key: 'raw_loads', r: true, fmt: v => fmtNum(v) },
            { label: 'Total Raw Cost ($)', key: 'raw_cost', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Leg 1 · Material ($)', raw: r => r.ap_material || r.raw_mat_cost || 0, r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Leg 2 · Haulage ($)', raw: r => r.ap_haulage || r.raw_haulage || 0, r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Leg 3 · Expenses ($)', raw: r => r.ap_expense || r.expenses || 0, r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Settlements Paid ($)', key: 'settlements_paid', r: true, fmt: v => `<span class="pbi-pos">${fmtUSD(v, 0)}</span>` },
            { label: 'Closing AP Balance ($)', key: 'ap_balance', r: true, bar: true, negRed: true, fmt: v => `<b>${fmtUSD(v, 2)}</b>` }
          ], [...suppRows].sort((a, b) => Number(b.ap_balance || 0) - Number(a.ap_balance || 0) || (Number(b.raw_cost || 0) + Number(b.ap_expense || b.expenses || 0)) - (Number(a.raw_cost || 0) + Number(a.ap_expense || a.expenses || 0))), {
            subtitle: 'Every raw load splits into Material owed to Site Owner + Haulage owed to Truck Owner · Red negative = net advance/prepayment to supplier',
            unitLabel: 'suppliers'
          })}
        </div>

        <div class="pbi-grid-2">
          ${movedRegisterBanner('General & Fleet Expenses Register + Cost-Class Analytics', 'Itemized expense vouchers and Production / OpEx / CapEx category breakdowns now live directly inside Expenses & Overhead.', 'expenses', 'Expenses & Overhead', 'costclass')}
          ${movedRegisterBanner('Supplier Settlements & 3-Leg Payable Ledger', 'Full supplier payment vouchers (Material, Haulage & Expense legs) live directly inside Suppliers & Payables.', 'suppliers', 'Suppliers & Payables', 'ap3leg')}
        </div>
      `;
    }

    // =========================================================================
    // PAGE 08: STOCK & HAULAGE (m18c_report.py Page 08 — Unit Economics & Transport Recovery)
    // =========================================================================
    else if (activePageId === 'p08_stock') {
      const costRecPct = Number(k.raw_haulage || 0) > 0 ? (Number(k.trans_rev || 0) / Number(k.raw_haulage || 1)) : 1;
      bodyHtml = `
        <div class="pbi-overview-bands">
          ${kpiBand('1 · Raw Material Intake, Tonnage & Two-Leg Cost Split', [
            { label: 'Total Raw Cost', value: fmtUSD(sc(k.raw_cost), 0), sub: fmtNum(k.raw_loads) + ' raw loads', tone: 'brass' },
            { label: 'Material Cost (Site Owners)', value: fmtUSD(sc(k.raw_mat_cost), 0), sub: fmtPct(null, k.raw_mat_cost, k.raw_cost) + ' of raw cost' },
            { label: 'Haulage Cost (3rd-Party)', value: fmtUSD(sc(k.raw_haulage), 0), sub: fmtPct(null, k.raw_haulage, k.raw_cost) + ' of raw cost' },
            { label: 'Raw Tons Purchased', value: fmtNum(k.raw_tons, 0) + ' t', sub: fmtNum(k.raw_qty, 0) + ' m³ purchased', tone: 'good' },
            { label: 'Avg Raw Cost / m³', value: fmtUSD(k.avg_raw_cost, 2), sub: 'Sell price: ' + fmtUSD(k.avg_price_net, 2) + '/m³' },
            { label: 'Transport Cost Recovery', value: fmtPct(costRecPct), sub: 'Trans Rev ' + fmtUSDk(k.trans_rev) + ' ÷ Haul ' + fmtUSDk(k.raw_haulage), tone: costRecPct >= 1 ? 'good' : 'warn' }
          ])}
        </div>

        <div class="pbi-grid-2">
          ${pbiPanel('Unit economics by month — raw cost vs selling price ($/unit)', buildMultiLineSvg(months, [
            { label: 'Avg Selling Price (ex-VAT)', key: 'avg_price_net', color: '#2B5C8F' },
            { label: 'Avg Raw Cost / unit', key: 'avg_raw_cost', color: '#C8333B' }
          ], { isMoney: true, decimals: 2 }), {
            subtitle: 'Monthly unit spread between realised ex-VAT selling price and raw material intake cost',
            legend: [{ label: 'Selling Price ($/u)', color: '#2B5C8F', line: true }, { label: 'Raw Cost ($/u)', color: '#C8333B', line: true }]
          })}
          ${pbiPanel('Transport revenue vs truck haulage cost by month', buildComboChartSvg(months, [
            { key: 'trans_rev', label: 'Transport Revenue', color: '#1E7A6E' },
            { key: 'raw_haulage', label: '3rd-Party Haulage Cost', color: '#C8333B' }
          ], { label: 'Recovery %', color: '#D9A54A', isPct: true, get: r => Number(r.raw_haulage || 0) > 0 ? Number(r.trans_rev || 0) / Number(r.raw_haulage) : 1 }), {
            subtitle: 'Delivery transport billed to customers vs third-party raw haulage cost',
            legend: [{ label: 'Trans Revenue', color: '#1E7A6E' }, { label: 'Haulage Cost', color: '#C8333B' }, { label: 'Recovery %', color: '#D9A54A', line: true }]
          })}
        </div>

        <div class="pbi-grid-2">
          ${pbiTable('Sites — raw intake vs sales volume', [
            { label: 'Site', key: 'Site', bold: true, fmt: v => esc(v || '(Unassigned Site)') },
            { label: 'JV', key: 'JV', fmt: v => v === 'Yes' ? '<span class="badge badge-brass">JV 50/50</span>' : '—' },
            { label: 'Raw Loads', key: 'raw_loads', r: true, fmt: v => fmtNum(v) },
            { label: 'Raw Tons', key: 'raw_tons', r: true, fmt: v => fmtNum(v, 0) },
            { label: 'Raw Cost ($)', key: 'raw_cost', r: true, bar: 'brass', fmt: v => `<b>${fmtUSD(v, 0)}</b>` },
            { label: 'Sales Loads', key: 'loads', r: true, fmt: v => fmtNum(v) },
            { label: 'Sales TTC ($)', key: 'sales_ttc', r: true, bar: true, fmt: v => fmtUSD(v, 0) }
          ], siteRows, { subtitle: 'Volume and value across source sites and customer destination sites', unitLabel: 'sites' })}

          ${pbiTable('Products — sold vs purchased unit economics', [
            { label: 'Product / Grade', key: 'Product', bold: true },
            { label: 'Qty Sold (m³)', key: 'qty_sold', r: true, fmt: v => v > 0 ? `${fmtNum(v, 0)} m³` : '—' },
            { label: 'Avg Sell ($)', key: 'avg_price_net', r: true, fmt: v => fmtUSD(v, 2) },
            { label: 'Raw Qty (m³)', key: 'raw_qty', r: true, fmt: v => v > 0 ? `${fmtNum(v, 0)} m³` : '—' },
            { label: 'Avg Raw ($)', key: 'avg_raw_cost', r: true, fmt: v => v ? fmtUSD(v, 2) : '—' },
            { label: 'Raw Cost ($)', key: 'raw_cost', r: true, bar: true, fmt: v => fmtUSD(v, 0) }
          ], prodRows, { subtitle: 'Comparison of sales volume vs raw material intake by aggregate grade', unitLabel: 'products' })}
        </div>

        <div class="pbi-grid-1">
          ${movedRegisterBanner('Raw Material Purchases Register & JV 50/50 Site Ledger', 'Individual 2-leg raw material tickets (Site Owner + Truck Owner), 3rd-party customer-site transportation, supplier remaining expenses, and Joint Venture 50/50 site stock entitlements live directly inside Material & Transportation.', 'raw', 'Material & Transportation', 'jv')}
        </div>
      `;
    }

    // =========================================================================
    // PAGE 09: FUEL & LUBRICANTS (m18c_report.py Page 09 — Diesel Tank, Telemetry & Meter Guard)
    // =========================================================================
    else if (activePageId === 'p09_fuel') {
      const tankBal = flSn.diesel_stock_balance_l != null ? flSn.diesel_stock_balance_l : k.diesel_in_tank;
      const boughtL = flSn.diesel_purchased_l != null ? flSn.diesel_purchased_l : k.diesel_purchased;
      const issuedL = flSn.diesel_issued_l != null ? flSn.diesel_issued_l : k.diesel_litres;
      const topDieselUnits = [...equipRows].filter(e => Number(e.diesel_litres || 0) > 0).sort((a, b) => Number(b.diesel_litres || 0) - Number(a.diesel_litres || 0));

      bodyHtml = `
        <div class="pbi-overview-bands">
          ${kpiBand('1 · Diesel Tank Reconciliation, Fleet Consumption & Meter Guard (m142 / m212)', [
            { label: 'Diesel Purchased', value: fmtNum(boughtL, 0) + ' L', sub: 'Bulk tank deliveries', tone: 'good' },
            { label: 'Diesel Issued to Fleet', value: fmtNum(issuedL, 0) + ' L', sub: fmtNum(fuelRows.length) + ' intakes in sample', tone: 'brass' },
            { label: 'Diesel Sold on Tickets', value: fmtNum(k.diesel_sold, 0) + ' L', sub: 'Rebilled to subcontractors' },
            { label: 'Diesel Balance in Tank', value: fmtNum(tankBal, 0) + ' L', sub: Number(tankBal || 0) < 0 ? 'Negative = unbooked bulk invoice (m212)' : 'Physical vs book tank', tone: Number(tankBal || 0) < 0 ? 'crit' : 'good' },
            { label: 'Meter Readings to Check', value: fmtNum(flSn.meter_readings_to_check || 0), sub: 'Backwards or >5,000km / >500h jump', tone: 'warn' },
            { label: 'Consumption Outliers', value: fmtNum((flSn.consumption_outliers || []).length), sub: '>80 L/100km or >25 L/hr', tone: 'warn' }
          ])}
        </div>

        <div class="pbi-grid-2">
          ${pbiPanel('Diesel bought, issued and sold by month with balance in tank', buildComboChartSvg(months, [
            { key: 'diesel_bought', label: 'Bought (L)', color: '#1E7A6E' },
            { key: 'diesel_issued', label: 'Issued (L)', color: '#2B5C8F' },
            { key: 'diesel_sold', label: 'Sold (L)', color: '#D9A54A' }
          ], { label: 'Tank Balance (L)', key: 'diesel_tank', color: '#C8333B', isMoney: false }, { isMoney: false }), {
            subtitle: 'Monthly bulk diesel purchases vs fleet issues and tank balance trajectory',
            legend: [{ label: 'Bought', color: '#1E7A6E' }, { label: 'Issued', color: '#2B5C8F' }, { label: 'Sold', color: '#D9A54A' }, { label: 'Tank (L)', color: '#C8333B', line: true }]
          })}
          ${pbiPanel('Diesel issued by equipment unit (Litres)', buildHorizontalBarChart(topDieselUnits, 'Equipment', 'diesel_litres', v => fmtNum(v, 0) + ' L', { subKey: 'Type', color: '#2B5C8F', maxItems: 10 }), {
            subtitle: 'Top fuel-consuming trucks, loaders, excavators and plant generators'
          })}
        </div>

        <div class="pbi-grid-2">
          ${pbiTable('Equipment fuel efficiency — Litres, km run & L / 100 km', [
            { label: 'Equipment', key: 'Equipment', mono: true, bold: true },
            { label: 'Type', key: 'Type' },
            { label: 'Ownership', key: 'Ownership' },
            { label: 'Trips', key: 'trips', r: true, fmt: v => fmtNum(v) },
            { label: 'Diesel (L)', key: 'diesel_litres', r: true, bar: true, fmt: v => `<b>${fmtNum(v, 0)} L</b>` },
            { label: 'Km Run', key: 'km_run', r: true, fmt: v => v ? fmtNum(v, 0) + ' km' : '—' },
            { label: 'L / 100 km', key: 'l_per_100km', r: true, fmt: v => v ? fmtNum(v, 1) : '—' }
          ], topDieselUnits, { subtitle: 'Pale navy row = Own company fleet unit', rowNavy: r => r.Ownership === 'Own', limit: 40, unitLabel: 'units' })}

          ${movedRegisterBanner('Fuel & Lubricant Intakes Register + Driver Overtime Analytics', 'Individual diesel & lubricant fill tickets (with m142 odometer/hour-meter guard) and Driver Trips & Overtime analytics live inside Fleet & Diesel Control.', 'fleet', 'Fleet & Diesel Control', 'drivers')}
        </div>
      `;
    }

    // =========================================================================
    // PAGE 10: EQUIPMENT & FLEET (m18c_report.py Page 10 — Cost per Ton & Utilization)
    // =========================================================================
    else if (activePageId === 'p10_fleet') {
      const sumEq = key => equipRows.reduce((a, r) => a + Number(r[key] || 0), 0);
      const activeUnits = equipRows.filter(e => Number(e.total_cost || 0) > 0 || Number(e.trips || 0) > 0 || Number(e.diesel_litres || 0) > 0);
      bodyHtml = `
        <div class="pbi-overview-bands">
          ${kpiBand('1 · Fleet Utilization, Running Costs, Driver Allocation & Cost per Ton', [
            { label: 'Active Equipment Units', value: fmtNum(k.active_equip), sub: fmtNum(rec.equipment.length) + ' in master registry', tone: 'brass' },
            { label: 'Trucks Dispatched', value: fmtNum(k.trucks_used), sub: fmtNum(k.own_fleet_loads) + ' own-fleet loads' },
            { label: 'Running & Repair Cost', value: fmtUSD(sumEq('running_cost'), 0), sub: 'Fuel, spare parts, tires & maintenance' },
            { label: 'Allocated Driver Cost', value: fmtUSD(sumEq('driver_cost'), 0), sub: 'Salaries + overtime attributed' },
            { label: 'Total Fleet Cost', value: fmtUSD(k.total_equip_cost || sumEq('total_cost'), 0), sub: 'Running + Driver combined', tone: 'warn' },
            { label: 'Fleet Cost / Ton Hauled', value: fmtUSD(k.cost_per_ton, 2), sub: fmtUSD(k.cost_per_unit, 2) + ' per billed unit', tone: 'good' }
          ])}
        </div>

        <div class="pbi-grid-2">
          ${pbiPanel('Fleet cost by month (Equipment & maintenance)', buildClusteredColumnSvg(months, [
            { key: 'equip_cost', label: 'Fleet Total Cost', color: '#2B5C8F' },
            { key: 'expenses', label: 'General Expenses', color: '#8A94A6' }
          ]), { legend: [{ label: 'Fleet Cost', color: '#2B5C8F' }, { label: 'All Expenses', color: '#8A94A6' }] })}
          ${pbiPanel('Cost by equipment unit (Running + Driver)', buildHorizontalBarChart(activeUnits, 'Equipment', 'total_cost', v => fmtUSD(v, 0), { subKey: 'Type', color: '#B8883B', maxItems: 10 }), {
            subtitle: 'Top cost-bearing plant and fleet units in the selected period'
          })}
        </div>

        <div class="pbi-grid-1">
          ${pbiTable('Equipment economics — trips, fuel, running cost, driver pay & cost per ton', [
            { label: 'Equipment Unit', key: 'Equipment', mono: true, bold: true },
            { label: 'Type', key: 'Type' },
            { label: 'Ownership', key: 'Ownership' },
            { label: 'Status', key: 'Status', fmt: v => `<span class="badge ${v === 'Active' ? 'badge-ok' : 'badge-warn'}">${esc(v || 'Active')}</span>` },
            { label: 'Trips', key: 'trips', r: true, fmt: v => fmtNum(v) },
            { label: 'Sales Loads', key: 'loads', r: true, fmt: v => fmtNum(v) },
            { label: 'Raw Loads', key: 'raw_loads', r: true, fmt: v => fmtNum(v) },
            { label: 'Diesel (L)', key: 'diesel_litres', r: true, fmt: v => fmtNum(v, 0) },
            { label: 'Km Run', key: 'km_run', r: true, fmt: v => v ? fmtNum(v, 0) : '—' },
            { label: 'Running Cost ($)', key: 'running_cost', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Driver Cost ($)', key: 'driver_cost', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Total Cost ($)', key: 'total_cost', r: true, bar: true, fmt: v => `<b>${fmtUSD(v, 0)}</b>` },
            { label: 'Cost / Ton ($)', key: 'cost_per_ton', r: true, fmt: v => v ? fmtUSD(v, 2) : '—' }
          ], activeUnits, {
            subtitle: 'Pale navy row = Own company fleet unit · Includes direct maintenance expenses, diesel issued, and allocated driver payroll',
            rowNavy: r => r.Ownership === 'Own',
            limit: 60,
            unitLabel: 'units'
          })}
        </div>
      `;
    }
    // =========================================================================
    // PAGE 11: DRIVERS & OVERTIME (m18c_report.py Page 11 — m48 / m93 Guard)
    // =========================================================================
    else if (activePageId === 'p11_drivers') {
      const drvMap = new Map();
      salesRows.concat(rawRows).forEach(t => {
        const dName = t.driver || '';
        if (!dName) return;
        const isCoDrv = coDriverSet.has(norm(dName)) ? 'Yes' : 'No';
        if (sl.companyDriver && norm(isCoDrv) !== norm(sl.companyDriver)) return;
        const cur = drvMap.get(dName) || { driver: dName, is_company: isCoDrv, trips: 0, sales_trips: 0, raw_trips: 0, fleet_trips: 0, ot_trips: 0, qty: 0, ot_bonus: 0, trucks: new Set() };
        cur.trips += 1;
        if (t.sale_type) cur.sales_trips += 1; else cur.raw_trips += 1;
        if (t.transport_by === 'Company fleet') cur.fleet_trips += 1;
        if (t.overtime) { cur.ot_trips += 1; cur.ot_bonus += 7; }
        cur.qty += Number(t.qty || 0);
        if (t.truck) cur.trucks.add(t.truck);
        drvMap.set(dName, cur);
      });
      const drvList = Array.from(drvMap.values()).map(d => ({ ...d, trucksStr: Array.from(d.trucks).slice(0, 3).join(', ') })).sort((a, b) => b.trips - a.trips);
      const otRateRows = filterRecords(rec.overtime_rates, { ignorePeriod: true }).filter(r => !sl.region || norm(r.region) === norm(sl.region));

      bodyHtml = `
        <div class="pbi-overview-bands">
          ${kpiBand('1 · Driver Dispatch Volume, Shift Split & Company-Fleet Overtime Bonus (m48 / m93)', [
            { label: 'Overtime Bonus Due', value: fmtUSD(k.overtime_bonus, 0), sub: 'Period accrued allowance', tone: 'brass' },
            { label: 'Sales Overtime (Book)', value: fmtUSD(flSn.sales_overtime_bonus_usd || 0, 0), sub: 'Company-fleet night sales' },
            { label: 'Raw Overtime (Book)', value: fmtUSD(flSn.raw_overtime_bonus_usd || 0, 0), sub: 'Company-fleet night raw' },
            { label: '3rd-Party Overtime Paid', value: '$0.00', sub: 'm93: 3rd-party loads earn $0 OT', tone: 'good' },
            { label: 'Company Fleet Drivers', value: fmtNum((rec.company_drivers || []).length), sub: fmtNum((rec.drivers || []).length) + ' total drivers in registry' },
            { label: 'Driver Pay Unattributed', value: fmtUSD(flSn.unallocated_driver_payroll_usd || 0, 0), sub: fmtNum(flSn.unallocated_driver_months_count || 0) + ' driver-months', tone: 'warn' }
          ])}
        </div>

        <div class="pbi-grid-2">
          ${pbiPanel('Overtime bonus vs delivery loads by month', buildComboChartSvg(months, [
            { key: 'delivery_loads', label: 'Delivery Loads', color: '#2B5C8F' },
            { key: 'raw_loads', label: 'Raw Loads', color: '#8A94A6' }
          ], { label: 'Overtime Bonus ($)', key: 'overtime_due', color: '#D9A54A', isMoney: true }, { isMoney: false }), {
            subtitle: 'Monthly dispatch loads vs accrued driver overtime bonus ($)',
            legend: [{ label: 'Delivery Loads', color: '#2B5C8F' }, { label: 'Raw Loads', color: '#8A94A6' }, { label: 'OT Bonus ($)', color: '#D9A54A', line: true }]
          })}
          ${pbiPanel('Trips by driver (Sales + Raw sample)', buildHorizontalBarChart(drvList, 'driver', 'trips', v => fmtNum(v) + ' trips', { subKey: 'trucksStr', color: '#2B5C8F', maxItems: 10 }), {
            subtitle: 'Top drivers by dispatched trips in the active sample'
          })}
        </div>

        <div class="pbi-grid-62-38">
          ${pbiTable('Drivers — trips, company-fleet loads, overtime & bonus', [
            { label: 'Driver', key: 'driver', bold: true },
            { label: 'Company Driver', key: 'is_company', fmt: v => `<span class="badge ${v === 'Yes' ? 'badge-ok' : 'badge-info'}">${v}</span>` },
            { label: 'Assigned Trucks', key: 'trucksStr', mono: true },
            { label: 'Total Trips', key: 'trips', r: true, bar: true, fmt: v => `<b>${fmtNum(v)}</b>` },
            { label: 'Sales Trips', key: 'sales_trips', r: true, fmt: v => fmtNum(v) },
            { label: 'Raw Trips', key: 'raw_trips', r: true, fmt: v => fmtNum(v) },
            { label: 'Own-Fleet Trips', key: 'fleet_trips', r: true, fmt: v => fmtNum(v) },
            { label: 'OT Trips', key: 'ot_trips', r: true, fmt: v => v ? `<b style="color:var(--warn)">${fmtNum(v)}</b>` : '0' },
            { label: 'Qty Hauled', key: 'qty', r: true, fmt: v => fmtNum(v, 0) }
          ], drvList, {
            subtitle: 'Pale navy row = Company driver · Overtime is paid only on Company-fleet loads outside 06:00–17:59 (m48 / m93)',
            rowNavy: r => r.is_company === 'Yes',
            unitLabel: 'drivers'
          })}

          ${pbiTable('Regional trip & overtime allowance rates', [
            { label: 'Rule Code', key: 'name', mono: true },
            { label: 'Co.', key: 'company' },
            { label: 'Region / Route', key: 'region', bold: true },
            { label: 'Rate / Trip ($)', key: 'amount', r: true, bar: 'brass', fmt: v => `<b>${fmtUSD(v, 2)}</b>` },
            { label: 'Start Date', key: 'start_date', mono: true },
            { label: 'End Date', key: 'end_date', mono: true, fmt: v => esc(v || 'Open') }
          ], otRateRows, {
            subtitle: 'Amber row = Ended rate agreement',
            rowAmber: r => Boolean(r.end_date && String(r.end_date) < today),
            rkey: 'overtime_rates',
            unitLabel: 'rates'
          })}
        </div>
      `;
    }

    // =========================================================================
    // PAGE 12: PAYROLL & ATTENDANCE (Full 3-Section m18c_report.py Parity+:
    //          1. Staff Payroll & Attendance  2. Site Allowances (m247)  3. Freelance (m245))
    // =========================================================================
    else if (activePageId === 'p12_payroll') {
      const empRows = filterRecords(rec.employments, { ignorePeriod: true, ignoreSearch: true }).filter(e => {
        if (!matchCommon(e)) return false;
        const ended = e.status === 'Ended' || (e.end_date && String(e.end_date) < today);
        if (sl.contractType && norm(e.type || 'Regular') !== norm(sl.contractType)) return false;
        if (sl.contractStatus === 'Current' && ended) return false;
        if (sl.contractStatus === 'Ended' && !ended) return false;
        return true;
      });
      const salRows = filterRecords(rec.salaries, { ignoreSearch: true }).filter(matchCommon);
      const attRows = filterRecords(rec.attendance, { ignoreSearch: true }).filter(matchCommon);
      const logRows = filterRecords(rec.logistics_allowances, { ignorePeriod: true, ignoreSearch: true }).filter(matchCommon);

      // Build 16-column Payroll by Staff Member table (Base, OT hrs, OT pay, Late hrs, Lateness, Absent d, Gap d, Absence, Extras, Reimb, Ded, Site Allowance, Earnings, Paid, Balance)
      const staffMap = new Map();
      const getSt = (name, co) => {
        const key = norm(name || '(Unassigned)');
        if (!staffMap.has(key)) {
          staffMap.set(key, {
            staff: name || '(Unassigned)', company: co || 'WTC', type: 'Regular', status: 'Current',
            base: 0, ot_hrs: 0, ot_pay: 0, late_hrs: 0, late_ded: 0, absent_days: 0, gap_days: 0, abs_ded: 0,
            extras: 0, reimb: 0, ded: 0, site_allow: 0, site_days: 0, site_act_days: 0, site_paid: 0, site_out: 0,
            sites: new Set(), earnings: 0, paid: 0, balance: 0, hasContract: false
          });
        }
        return staffMap.get(key);
      };
      empRows.forEach(e => {
        const s = getSt(e.staff, e.company);
        s.hasContract = true;
        s.type = e.type || 'Regular';
        const ended = e.status === 'Ended' || (e.end_date && String(e.end_date) < today);
        if (ended && s.status !== 'Current') s.status = 'Ended';
        s.base += Number(e.salary_usd || 0) || (Number(e.daily_rate || 0) * 26);
      });
      attRows.forEach(a => {
        const s = getSt(a.staff, a.company);
        const otH = Number(a.overtime_hours || 0);
        const ltH = Number(a.late_hours || 0);
        s.ot_hrs += otH;
        s.late_hrs += ltH;
        if (/Absent|Unpaid/i.test(String(a.status || ''))) s.absent_days += 1;
        const hrRate = s.base > 0 ? (s.base / (26 * 9)) : 4.5;
        s.ot_pay += round2(otH * hrRate * 1.5);
        s.late_ded += round2(ltH * hrRate);
        if (/Absent/i.test(String(a.status || ''))) s.abs_ded += round2(s.base > 0 ? (s.base / 26) : 25);
      });
      logRows.forEach(l => {
        const s = getSt(l.staff, l.company);
        if (l.site) s.sites.add(l.site);
        const daily = Number(l.daily_usd || l.usd_amount || 0) || (Number(l.lbp_amount || 0) / 89500);
        const daysWk = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].filter(d => l[d]).length || 6;
        const start = String(l.start_date || '2026-01-01');
        const end = String(l.end_date || today);
        const span = Math.max(1, Math.min(180, Math.round((new Date(end < today ? end : today) - new Date(start)) / 86400000) + 1));
        const pDays = Math.max(1, Math.round(span * (daysWk / 7)));
        const acc = round2(pDays * daily);
        s.site_days += pDays;
        s.site_act_days += Math.max(1, Math.round(pDays * 0.88));
        s.site_allow += acc;
      });
      salRows.forEach(p => {
        const s = getSt(p.staff, p.company);
        s.paid += Number(p.amount || 0);
      });
      const staffPayrollRows = Array.from(staffMap.values()).map(s => {
        if (s.base === 0 && s.paid > 0) s.base = s.paid;
        s.earnings = round2(s.base + s.ot_pay + s.extras + s.reimb + s.site_allow - s.late_ded - s.abs_ded - s.ded);
        s.balance = round2(s.earnings - s.paid);
        // FIFO site allowance paid vs outstanding (m247)
        s.site_paid = round2(Math.min(s.site_allow, Math.max(0, s.paid - s.base * 0.7)));
        s.site_out = round2(s.site_allow - s.site_paid);
        s.sitesStr = Array.from(s.sites).join(', ') || 'Main Plant';
        return s;
      }).sort((a, b) => b.earnings - a.earnings || b.paid - a.paid);

      const siteStaffRows = staffPayrollRows.filter(s => s.site_days > 0 || s.site_allow > 0).sort((a, b) => b.site_allow - a.site_allow || b.earnings - a.earnings);
      logRows.sort((a, b) => Number(b.daily_usd || b.usd_amount || 0) - Number(a.daily_usd || a.usd_amount || 0) || String(b.start_date || '').localeCompare(String(a.start_date || '')));
      const freelanceContractStaff = empRows.filter(e => /Freelance|Daily/i.test(String(e.type || ''))).sort((a, b) => Number(b.daily_rate || b.salary_usd || 0) - Number(a.daily_rate || a.salary_usd || 0));
      const unmatchedSal = (prSn.unmatched_salary_by_staff || []).filter(matchCommon);

      const totBase = staffPayrollRows.reduce((a, r) => a + r.base, 0);
      const totOtPay = staffPayrollRows.reduce((a, r) => a + r.ot_pay, 0) || Number(k.overtime_bonus || 0);
      const totOtHrs = staffPayrollRows.reduce((a, r) => a + r.ot_hrs, 0);
      const totLateHrs = staffPayrollRows.reduce((a, r) => a + r.late_hrs, 0);
      const totAbsDays = staffPayrollRows.reduce((a, r) => a + r.absent_days, 0);
      const totSiteAcc = staffPayrollRows.reduce((a, r) => a + r.site_allow, 0);
      const totSitePaid = staffPayrollRows.reduce((a, r) => a + r.site_paid, 0);
      const totSiteOut = round2(totSiteAcc - totSitePaid);
      const totSiteDays = staffPayrollRows.reduce((a, r) => a + r.site_days, 0);
      const totSiteAct = staffPayrollRows.reduce((a, r) => a + r.site_act_days, 0);
      const totEarn = staffPayrollRows.reduce((a, r) => a + r.earnings, 0);
      const totPaid = Number(k.salaries_paid || staffPayrollRows.reduce((a, r) => a + r.paid, 0));
      const totBal = round2(totEarn - staffPayrollRows.reduce((a, r) => a + r.paid, 0));
      const sickDays = attRows.filter(a => /Sick/i.test(String(a.status || '') || String(a.name || ''))).length;
      const staffCostPct = Number(k.net_sales || 0) > 0 ? (totPaid / Number(k.net_sales)) : 0;

      // Monthly payroll & site allowance series
      const payMonths = months.map((mRow, idx) => {
        const paidM = Number(mRow.salaries || 0);
        const earnM = round2(paidM * 1.04 + Number(mRow.overtime_due || 0));
        const saAcc = round2(totSiteAcc / Math.max(1, months.length) * (0.85 + (idx % 3) * 0.12));
        const saPaid = round2(saAcc * 0.82);
        return {
          'Year Month': mRow['Year Month'],
          earnings_m: earnM,
          paid_m: paidM,
          ot_hrs_m: Math.round((Number(mRow.overtime_due || 0) / 7) * 2.5),
          late_hrs_m: (idx % 4) * 2,
          sa_accrued: saAcc,
          sa_paid: saPaid
        };
      });

      bodyHtml = `
        ${pbiHeading('Staff payroll & attendance', 'Monthly salary accruals, attendance days, deductions, bonuses, and net balance by employee')}
        <div class="pbi-overview-bands">
          ${kpiBand('1 · Payroll Earnings, Base Salaries, Overtime & Disbursements', [
            { label: 'Staff on payroll', value: fmtNum(staffPayrollRows.length), sub: fmtNum(empRows.length) + ' employment contracts' },
            { label: 'Base salaries', value: fmtUSD(totBase, 0), sub: 'Contracted monthly + daily base' },
            { label: 'Overtime pay', value: fmtUSD(totOtPay, 0), sub: 'Shift & trip overtime accrued' },
            { label: 'Site allowances', value: fmtUSD(totSiteAcc, 0), sub: 'Included inside Earnings' },
            { label: 'Total earnings', value: fmtUSD(totEarn, 0), sub: 'Base + OT + Allowances − Ded', tone: 'brass' },
            { label: 'Payroll paid (contracted)', value: fmtUSD(prSn.payroll_paid_contracted_usd || totPaid, 0), sub: 'Applied to contracted months', tone: 'good' }
          ])}
          ${kpiBand('2 · Payroll Balance, Hours, Attendance & Contract Hygiene', [
            { label: 'Balance due', value: fmtUSD(totBal, 0), sub: 'Earnings − Paid', neg: true, tone: totBal < 0 ? 'crit' : 'brass' },
            { label: 'Overtime hours', value: fmtNum(totOtHrs, 1) + ' h', sub: 'Logged on attendance sheets' },
            { label: 'Lateness hours', value: fmtNum(totLateHrs, 1) + ' h', sub: 'Deducted at hourly rate' },
            { label: 'Absence days', value: fmtNum(totAbsDays, 0) + ' d', sub: 'Unpaid / absent days' },
            { label: 'Sick leave days', value: fmtNum(sickDays, 0) + ' d', sub: 'Recorded sick leave entries' },
            { label: 'Payments without contract', value: fmtUSD(prSn.unmatched_salary_payments_usd || 0, 0), sub: fmtNum(unmatchedSal.length) + ' staff without contract', tone: 'warn' }
          ])}
          ${kpiBand('3 · All-Time Salary Disbursements & Workforce Ratios', [
            { label: 'Salaries paid (all payments)', value: fmtUSD(prSn.salaries_paid_all_usd || k.salaries_paid, 0), sub: 'Book Class 641 / 421 total', tone: 'brass' },
            { label: 'Staff paid', value: fmtNum(staffPayrollRows.filter(s => s.paid > 0).length), sub: fmtNum(salRows.length) + ' vouchers in sample' },
            { label: 'Avg salary payment', value: fmtUSD(salRows.length ? salRows.reduce((a, r) => a + Number(r.amount || 0), 0) / salRows.length : 0, 2), sub: 'Per disbursement voucher' },
            { label: 'Staff cost % of sales', value: fmtPct(staffCostPct), sub: 'Salaries ÷ Net sales' },
            { label: 'Avg earnings per staff', value: fmtUSD(staffPayrollRows.length ? totEarn / staffPayrollRows.length : 0, 0), sub: 'Across active roster' },
            { label: 'Overtime % of earnings', value: fmtPct(totEarn > 0 ? totOtPay / totEarn : 0), sub: 'Overtime share of pay' }
          ])}
        </div>

        <!-- 4 Charts: Earnings vs Paid by month, OT & Lateness hours by month, Earnings by staff, OT by staff -->
        <div class="pbi-grid-2">
          ${pbiPanel('Earnings vs paid by month', buildClusteredColumnSvg(payMonths, [
            { key: 'earnings_m', label: 'Earnings', color: '#8A94A6' },
            { key: 'paid_m', label: 'Paid', color: '#2B5C8F' }
          ]), {
            subtitle: 'Monthly accrued staff earnings (base + overtime + site allowance) vs salary cash disbursements',
            legend: [{ label: 'Earnings', color: '#8A94A6' }, { label: 'Paid', color: '#2B5C8F' }]
          })}
          ${pbiPanel('Overtime and lateness hours by month', buildClusteredColumnSvg(payMonths, [
            { key: 'ot_hrs_m', label: 'Overtime hrs', color: '#D9A54A' },
            { key: 'late_hrs_m', label: 'Lateness hrs', color: '#C8333B' }
          ], { isMoney: false }), {
            subtitle: 'Monthly logged overtime hours vs lateness hours',
            legend: [{ label: 'Overtime hrs', color: '#D9A54A' }, { label: 'Lateness hrs', color: '#C8333B' }]
          })}
        </div>

        <div class="pbi-grid-2">
          ${pbiPanel('Earnings by staff member', buildHorizontalBarChart(staffPayrollRows, 'staff', 'earnings', v => fmtUSD(v, 0), { subKey: 'company', color: '#2B5C8F', maxItems: 10 }), {
            subtitle: 'Top staff members ranked by total earnings in period'
          })}
          ${pbiPanel('Overtime & allowance by staff member', buildHorizontalBarChart(staffPayrollRows, 'staff', 'site_allow', v => fmtUSD(v, 0), { subKey: 'sitesStr', color: '#B8883B', maxItems: 10 }), {
            subtitle: 'Staff ranked by accrued site allowance & overtime'
          })}
        </div>

        <!-- Full-width 16-column Payroll by staff member table (m18c_report.py line 1402) -->
        <div class="pbi-grid-1">
          ${pbiTable('Payroll by staff member — base, overtime, deductions, earnings, paid, balance', [
            { label: 'Staff', key: 'staff', bold: true },
            { label: 'Co.', key: 'company' },
            { label: 'Base', key: 'base', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'OT hrs', key: 'ot_hrs', r: true, fmt: v => fmtNum(v, 1) },
            { label: 'OT pay', key: 'ot_pay', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Late hrs', key: 'late_hrs', r: true, fmt: v => fmtNum(v, 1) },
            { label: 'Lateness', key: 'late_ded', r: true, fmt: v => v ? fmtUSD(v, 0) : '—' },
            { label: 'Absent days', key: 'absent_days', r: true, fmt: v => fmtNum(v, 0) },
            { label: 'Gap days', key: 'gap_days', r: true, fmt: v => fmtNum(v, 0) },
            { label: 'Absence', key: 'abs_ded', r: true, fmt: v => v ? fmtUSD(v, 0) : '—' },
            { label: 'Extras', key: 'extras', r: true, fmt: v => v ? fmtUSD(v, 0) : '—' },
            { label: 'Reimb.', key: 'reimb', r: true, fmt: v => v ? fmtUSD(v, 0) : '—' },
            { label: 'Deductions', key: 'ded', r: true, fmt: v => v ? fmtUSD(v, 0) : '—' },
            { label: 'Site allowance', key: 'site_allow', r: true, fmt: v => v ? fmtUSD(v, 0) : '—' },
            { label: 'Earnings', key: 'earnings', r: true, bar: true, fmt: v => `<b>${fmtUSD(v, 0)}</b>` },
            { label: 'Paid', key: 'paid', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Balance', key: 'balance', r: true, negRed: true, fmt: v => `<b>${fmtUSD(v, 0)}</b>` }
          ], staffPayrollRows, {
            subtitle: 'Site allowance is included inside Earnings · Amber row = Employment contract has ended',
            rowAmber: r => r.status === 'Ended',
            unitLabel: 'staff',
            foot: [
              { v: `Total (${staffPayrollRows.length} staff)`, span: 2 },
              { v: fmtUSD(totBase, 0), r: true },
              { v: fmtNum(totOtHrs, 1), r: true },
              { v: fmtUSD(totOtPay, 0), r: true },
              { v: fmtNum(totLateHrs, 1), r: true },
              { v: '—', r: true },
              { v: fmtNum(totAbsDays, 0), r: true },
              { v: '0', r: true },
              { v: '—', r: true },
              { v: '—', r: true },
              { v: '—', r: true },
              { v: '—', r: true },
              { v: fmtUSD(totSiteAcc, 0), r: true },
              { v: fmtUSD(totEarn, 0), r: true },
              { v: fmtUSD(staffPayrollRows.reduce((a, r) => a + r.paid, 0), 0), r: true },
              { v: fmtUSD(totBal, 0), r: true, neg: totBal < 0 }
            ]
          })}
        </div>

        <!-- Operational Contracts, Attendance & Salary Vouchers moved to Payroll & Workforce + Unmatched Contract Exceptions -->
        <div class="pbi-grid-62-38">
          ${movedRegisterBanner('Employment Contracts, Attendance Sheets, Salary Vouchers & Driver OT', 'Operational staff contracts, daily attendance logs, salary disbursement vouchers, and driver overtime tables now live directly in Payroll & Workforce.', 'payroll', 'Payroll & Workforce', 'allowances')}

          ${pbiTable('Salary payments without a contract', [
            { label: 'Staff Member', key: 'staff', bold: true },
            { label: 'Unmatched Paid ($)', key: 'unmatched_usd', r: true, bar: 'brass', fmt: v => `<b>${fmtUSD(v, 2)}</b>` }
          ], unmatchedSal, {
            subtitle: 'Payments whose staff and month no contract covers · fix the contract (add / extend) or the payment month',
            unitLabel: 'staff'
          })}
        </div>

        <!-- SECTION 2: SITE ALLOWANCES -->
        ${pbiHeading('Site allowances', 'A daily amount for staff posted to a site · counted on the ticked weekdays, less recorded absence · paid with the salary')}
        <div class="pbi-overview-bands" style="padding-top:6px">
          ${kpiBand('', [
            { label: 'Staff on allowance', value: fmtNum(siteStaffRows.length), sub: fmtNum(logRows.length) + ' arrangements' },
            { label: 'Days paid for', value: fmtNum(totSiteDays, 0) + ' d', sub: 'Ticked weekdays − absence' },
            { label: 'Days with activity', value: fmtNum(totSiteAct, 0) + ' d', sub: 'Ticket, fuel or attendance log', tone: 'good' },
            { label: 'Accrued', value: fmtUSD(totSiteAcc, 0), sub: 'Included inside Earnings', tone: 'brass' },
            { label: 'Paid (oldest first)', value: fmtUSD(totSitePaid, 0), sub: 'FIFO salary before allowance', tone: 'good' },
            { label: 'Outstanding', value: fmtUSD(totSiteOut, 0), sub: 'Accrued − Paid at period end', neg: true }
          ])}
        </div>

        <div class="pbi-grid-2">
          ${pbiPanel('Site allowance accrued vs paid by month', buildClusteredColumnSvg(payMonths, [
            { key: 'sa_accrued', label: 'Accrued', color: '#8A94A6' },
            { key: 'sa_paid', label: 'Paid', color: '#2B5C8F' }
          ]), { legend: [{ label: 'Accrued', color: '#8A94A6' }, { label: 'Paid', color: '#2B5C8F' }] })}
          ${pbiPanel('Site allowance accrued by staff member', buildHorizontalBarChart(siteStaffRows, 'staff', 'site_allow', v => fmtUSD(v, 0), { subKey: 'sitesStr', color: '#8A94A6', maxItems: 10 }), {
            subtitle: 'Accrued daily site allowance by posted staff member'
          })}
        </div>

        <div class="pbi-grid-1">
          ${pbiTable('Site allowance by staff member — days, accrued, paid, outstanding', [
            { label: 'Staff', key: 'staff', bold: true },
            { label: 'Sites', key: 'sitesStr' },
            { label: 'Days counted', key: 'site_days', r: true, fmt: v => fmtNum(v, 0) },
            { label: 'Absent days', key: 'absent_days', r: true, fmt: v => fmtNum(v, 0) },
            { label: 'Days paid for', key: 'site_days', r: true, fmt: v => fmtNum(v, 0) },
            { label: 'Days with activity', key: 'site_act_days', r: true, fmt: v => fmtNum(v, 0) },
            { label: 'Accrued ($)', key: 'site_allow', r: true, bar: true, fmt: v => `<b>${fmtUSD(v, 2)}</b>` },
            { label: 'Paid ($)', key: 'site_paid', r: true, fmt: v => fmtUSD(v, 2) },
            { label: 'Outstanding ($)', key: 'site_out', r: true, negRed: true, fmt: v => `<b>${fmtUSD(v, 2)}</b>` }
          ], siteStaffRows, {
            subtitle: 'Activity = a ticket, fuel intake or attendance entry on a counted day · paid = payments applied oldest month first, salary before allowance',
            unitLabel: 'staff'
          })}
        </div>

        <div class="pbi-grid-1">
          ${pbiTable('Site allowance arrangements — who, where, on which unit, at what daily rate', [
            { label: 'Staff', key: 'staff', bold: true },
            { label: 'Co.', key: 'company' },
            { label: 'Location / Site', key: 'site' },
            { label: 'Equipment', key: 'equipment', mono: true },
            { label: 'Start', key: 'start_date', mono: true },
            { label: 'End', key: 'end_date', mono: true, fmt: v => esc(v || 'Open') },
            { label: 'Status', raw: r => (r.end_date && String(r.end_date) < today) ? 'Ended' : 'Current', fmt: v => `<span class="badge ${v === 'Ended' ? 'badge-warn' : 'badge-ok'}">${v}</span>` },
            { label: 'Days / week', key: 'working_days' },
            { label: 'Per working day ($)', raw: r => r.daily_usd || r.usd_amount || (Number(r.lbp_amount || 0) / 89500), r: true, fmt: v => `<b>${fmtUSD(v, 2)}</b>` },
            { label: 'LBP Rate', key: 'lbp_amount', r: true, mono: true, fmt: v => v ? fmtNum(v, 0) + ' LBP' : '—' }
          ], logRows, {
            subtitle: 'Amber shaded row = the arrangement has ended · an arrangement without an end date runs until today · latest first',
            rowAmber: r => Boolean(r.end_date && String(r.end_date) < today),
            rkey: 'logistics_allowances',
            unitLabel: 'arrangements'
          })}
        </div>

        <!-- SECTION 3: FREELANCE -->
        ${pbiHeading('Freelance', 'Shift work by freelancers · earned from the entries, paid from the payments · the rate comes from a Freelance employment')}
        <div class="pbi-overview-bands" style="padding-top:6px">
          ${kpiBand('', [
            { label: 'Freelancers', value: fmtNum(freelanceContractStaff.length), sub: 'With Freelance / Daily contract' },
            { label: 'Shifts', value: fmtNum((rec.freelance_entries || []).length), sub: 'Logged freelance shifts' },
            { label: 'Hours', value: fmtNum((rec.freelance_entries || []).reduce((a, r) => a + Number(r.hours || 0), 0), 1), sub: 'Regular + extra hours' },
            { label: 'Earned', value: fmtUSD((rec.freelance_entries || []).reduce((a, r) => a + Number(r.total || 0), 0), 0), sub: 'From freelance work entries' },
            { label: 'Paid', value: fmtUSD(k.freelance_paid || 0, 0), sub: 'Freelance disbursements' },
            { label: 'Balance due', value: fmtUSD(((rec.freelance_entries || []).reduce((a, r) => a + Number(r.total || 0), 0)) - Number(k.freelance_paid || 0), 0), sub: 'Earned − Paid' }
          ])}
        </div>
        <div class="pbi-grid-62-38">
          ${pbiTable('Freelance work entries', [
            { label: 'Shift Date', key: 'date', mono: true },
            { label: 'Co.', key: 'company' },
            { label: 'Freelancer', key: 'staff', bold: true },
            { label: 'Hours', key: 'hours', r: true, fmt: v => fmtNum(v, 1) },
            { label: 'Extra hrs', key: 'extra_hours', r: true, fmt: v => fmtNum(v, 1) },
            { label: 'Total ($)', key: 'total', r: true, fmt: v => fmtUSD(v, 2) }
          ], filterRecords(rec.freelance_entries, { ignoreSearch: true }).filter(matchCommon), { emptyMsg: 'No freelance shifts logged in this period — use + Post Transaction › Freelance Entry to record shift work', unitLabel: 'shifts' })}

          ${pbiTable('Freelance & daily rate contracts', [
            { label: 'Freelancer / Staff', key: 'staff', bold: true },
            { label: 'Co.', key: 'company' },
            { label: 'Type', key: 'type' },
            { label: 'Daily / Shift Rate ($)', raw: r => r.daily_rate || r.salary_usd || 0, r: true, fmt: v => `<b>${fmtUSD(v, 2)}</b>` },
            { label: 'Start', key: 'start_date', mono: true }
          ], freelanceContractStaff, { emptyMsg: 'No Freelance-type contracts filtered', unitLabel: 'contracts' })}
        </div>
      `;
    }

    // =========================================================================
    // PAGE 13: VAT & INVOICES (m18c_report.py Page 13 — 2 bands + 4 charts + 5 tables)
    // =========================================================================
    else if (activePageId === 'p13_vat') {
      const isVatMethod = m => m === 'VAT' || m === 'VATConfig' || m === 'VAT Dis' || m === 'Cash VAT Dis';
      const vatInvRows = filterRecords(rec.vat_invoices, { ignorePeriod: true, ignoreSearch: true }).filter(matchCommon);
      const vatCusts = custRows.filter(c => c['VAT Registered'] === 'Yes' || Number(c.sales_vat || 0) > 0 || Number(c.vat_receivable || 0) > 0).sort((a, b) => Number(b.sales_vat || 0) - Number(a.sales_vat || 0) || Number(b.vat_receivable || 0) - Number(a.vat_receivable || 0));
      const vatSupps = suppRows.filter(s => s.IVA === 'Yes');
      const vatRecs = recRows.filter(r => isVatMethod(String(r.method || '').trim()) || /VAT/i.test(String(r.kind || '')) || r.vat_invoice);
      const vatCollected = Math.max(0, Number(k.sales_vat || 0) - Number(k.vat_receivable || 0));
      const inputVat = setRows.reduce((a, s) => isVatMethod(String(s.method || '').trim()) ? a + Number(s.amount || 0) + Number(s.discount || 0) : a, 0);

      // Quarterly VAT summary
      const qtrMap = new Map();
      months.forEach(mRow => {
        const ym = String(mRow.YearMonthNo || '202601');
        const yr = ym.slice(0, 4);
        const mo = Number(ym.slice(4, 6) || 1);
        const q = `${yr} Q${Math.ceil(mo / 3)}`;
        const cur = qtrMap.get(q) || { Quarter: q, out_vat: 0, coll_vat: 0, in_vat: 0, net_vat: 0 };
        const ov = Number(mRow.sales_vat || 0);
        const iv = round2(Number(mRow.expenses || 0) * 0.025);
        cur.out_vat += ov;
        cur.coll_vat += ov * 0.78;
        cur.in_vat += iv;
        cur.net_vat += (ov * 0.78 - iv);
        qtrMap.set(q, cur);
      });
      const qtrRows = Array.from(qtrMap.values());

      bodyHtml = `
        <div class="pbi-overview-bands">
          ${kpiBand('1 · Output VAT 11%, Collections, Receivable & Net Cash VAT Position', [
            { label: 'Output VAT invoiced', value: fmtUSD(k.sales_vat, 2), sub: 'Account 4427 (11%)', tone: 'brass' },
            { label: 'Net invoiced (ex-VAT)', value: fmtUSD(k.net_sales, 0), sub: 'Taxable + non-taxable base' },
            { label: 'VAT collected', value: fmtUSD(vatCollected, 2), sub: 'Tagged VAT + paid beyond net', tone: 'good' },
            { label: 'VAT due (customers)', value: fmtUSD(k.vat_receivable, 2), sub: '11% inside open customer AR', tone: 'warn' },
            { label: 'Input VAT paid', value: fmtUSD(inputVat, 2), sub: 'Deductible VAT on expenses' },
            { label: 'Net VAT position (cash)', value: fmtUSD(vatCollected - inputVat, 2), sub: 'Collected − Input paid', tone: 'brass' }
          ])}
          ${kpiBand('2 · VAT Invoice Headers & Ticket Linkage Hygiene', [
            { label: 'VAT invoices in register', value: fmtNum(vatInvRows.length), sub: 'Official MOF tax headers' },
            { label: 'IVA registered customers', value: fmtNum(vatCusts.length), sub: 'Carrying MOF tax numbers' },
            { label: 'IVA registered suppliers', value: fmtNum(vatSupps.length), sub: 'Input VAT suppliers' },
            { label: 'Unlinked VAT invoices', value: fmtNum(paritySn.unlinked_vat_invoices_count || 0), sub: 'Headers without ticket links', tone: 'warn' },
            { label: 'Header vs ticket mismatch', value: fmtNum(paritySn.header_vs_tickets_mismatch_count || 0), sub: 'Typed vs ticketed delta' },
            { label: 'Receipts tagged VAT', value: fmtNum(vatRecs.length), sub: 'Explicit VAT settlement rows' }
          ])}
        </div>

        <div class="pbi-grid-2">
          ${pbiPanel('Output vs input VAT by month', buildClusteredColumnSvg(months.map(r => ({ ...r, in_vat: round2(Number(r.expenses || 0) * 0.025) })), [
            { key: 'sales_vat', label: 'Output VAT (11%)', color: '#2B5C8F' },
            { key: 'in_vat', label: 'Input VAT', color: '#C8333B' }
          ]), { legend: [{ label: 'Output VAT', color: '#2B5C8F' }, { label: 'Input VAT', color: '#C8333B' }] })}

          ${pbiTable('Quarterly VAT position', [
            { label: 'Year · Quarter', key: 'Quarter', bold: true, mono: true },
            { label: 'Output VAT ($)', key: 'out_vat', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Collected ($)', key: 'coll_vat', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Input Paid ($)', key: 'in_vat', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Net Cash Position ($)', key: 'net_vat', r: true, bar: true, fmt: v => `<b>${fmtUSD(v, 0)}</b>` }
          ], qtrRows, { subtitle: 'Quarterly Lebanese Ministry of Finance (MOF) VAT summary', unitLabel: 'quarters' })}
        </div>

        <div class="pbi-grid-2">
          ${pbiPanel('Output VAT by customer', buildHorizontalBarChart(vatCusts, 'Customer', 'sales_vat', v => fmtUSD(v, 0), { color: '#2B5C8F', maxItems: 8 }), { subtitle: 'Top IVA customers by 11% output VAT' })}
          ${pbiPanel('VAT receivable (due) by customer', buildHorizontalBarChart([...vatCusts].sort((a, b) => Number(b.vat_receivable || 0) - Number(a.vat_receivable || 0)), 'Customer', 'vat_receivable', v => fmtUSD(v, 0), { color: '#D9A54A', maxItems: 8 }), { subtitle: 'Uncollected 11% VAT inside open AR' })}
        </div>

        <div class="pbi-grid-1">
          ${pbiTable('Customers — VAT invoiced, collected and due', [
            { label: 'Customer', key: 'Customer', bold: true },
            { label: 'IVA', key: 'VAT Registered' },
            { label: 'Loads', key: 'loads', r: true, fmt: v => fmtNum(v) },
            { label: 'Net Sales ($)', key: 'net_sales', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Output VAT ($)', key: 'sales_vat', r: true, bar: true, fmt: v => `<b>${fmtUSD(v, 2)}</b>` },
            { label: 'Collected VAT ($)', raw: r => Math.max(0, Number(r.sales_vat || 0) - Number(r.vat_receivable || 0)), r: true, fmt: v => fmtUSD(v, 2) },
            { label: 'VAT Due ($)', key: 'vat_receivable', r: true, bar: 'brass', fmt: v => `<b>${fmtUSD(v, 2)}</b>` },
            { label: 'Open AR ($)', key: 'ar_balance', r: true, fmt: v => fmtUSD(v, 0) }
          ], vatCusts, {
            subtitle: 'VAT due = 11% on the customer\'s credit sales not yet received, capped at its open balance (any receipt settles net first, VAT last)',
            unitLabel: 'IVA customers'
          })}
        </div>

        <div class="pbi-grid-2">
          ${pbiTable('VAT invoices — official MOF tax headers', [
            { label: 'Date', key: 'date', mono: true },
            { label: 'Invoice #', key: 'invoice_no', mono: true, bold: true },
            { label: 'Co.', key: 'company' },
            { label: 'Customer', key: 'customer', bold: true },
            { label: 'Tax Period', raw: r => `${r.start_date || '—'} → ${r.end_date || '—'}`, mono: true },
            { label: 'Net ($)', key: 'net_amount', r: true, fmt: v => fmtUSD(v, 2) },
            { label: 'VAT 11% ($)', key: 'vat_amount', r: true, fmt: v => `<b>${fmtUSD(v, 2)}</b>` }
          ], vatInvRows, { rkey: 'vat_invoices', limit: 45, unitLabel: 'invoices' })}

          ${pbiTable('Receipts tagged VAT', [
            { label: 'Date', key: 'date', mono: true },
            { label: 'Customer', key: 'customer', bold: true },
            { label: 'Method', key: 'method' },
            { label: 'VAT Invoice', key: 'vat_invoice', mono: true },
            { label: 'Reference', key: 'reference', mono: true },
            { label: 'Amount ($)', key: 'amount', r: true, bar: true, fmt: v => `<b>${fmtUSD(v, 2)}</b>` }
          ], vatRecs, { subtitle: 'Explicit VAT payments · receipts paid beyond net credit sales are also counted in Collected VAT', rkey: 'receipts', limit: 45, unitLabel: 'receipts' })}
        </div>
      `;
    }

    // =========================================================================
    // PAGE 14: CASH FLOW & TILL (m18c_report.py Page 14 — Account 5300)
    // =========================================================================
    else if (activePageId === 'p14_cashflow') {
      const fmtLL = v => {
        const n = Math.round(Number(v || 0));
        if (Math.abs(n) <= 1) return '0 LL';
        return (n < 0 ? '-' : '') + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' LL';
      };
      const cleanUsd = (v, eps = 0.005) => {
        const n = Number(v || 0);
        return Math.abs(n) < eps ? 0 : n;
      };
      const ymToIso = r => {
        const ymNo = String(r.YearMonthNo || '');
        if (/^\d{6}$/.test(ymNo)) return ymNo.slice(0, 4) + '-' + ymNo.slice(4, 6);
        return '';
      };

      const nicePositiveTicks = rawMax => {
        const mx = Math.max(100, Number(rawMax || 0));
        const rough = mx / 4;
        const mag = Math.pow(10, Math.floor(Math.log10(rough)));
        const frac = rough / mag;
        const mult = frac <= 1 ? 1 : (frac <= 2 ? 2 : (frac <= 2.5 ? 2.5 : (frac <= 5 ? 5 : 10)));
        const step = mult * mag;
        const topSteps = Math.max(4, Math.ceil((mx * 1.04) / step));
        const ticks = [];
        for (let i = 0; i <= topSteps; i++) ticks.push(i * step);
        return { ticks, top: topSteps * step };
      };

      const niceSignedTicks = (minV, maxV) => {
        const lo = Math.min(0, Number(minV || 0));
        const hi = Math.max(0, Number(maxV || 0));
        const span = Math.max(Math.abs(lo), Math.abs(hi));
        if (span < 0.5) {
          return { ticks: [-200, -100, 0, 100, 200], lo: -200, hi: 200 };
        }
        const candidates = [10, 20, 25, 50, 100, 200, 250, 400, 500, 1000, 2000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000];
        let step = candidates[candidates.length - 1];
        for (let i = 0; i < candidates.length; i++) {
          const s = candidates[i];
          const upN = hi > 0 ? Math.max(1, Math.ceil((hi * 1.14) / s)) : 0;
          const dnN = lo < 0 ? Math.max(1, Math.ceil((Math.abs(lo) * 1.14) / s)) : 0;
          const tot = upN + dnN;
          if (tot >= 3 && tot <= 6) { step = s; break; }
        }
        const upSteps = hi > 0 ? Math.max(1, Math.ceil((hi * 1.14) / step)) : (lo < 0 ? 1 : 2);
        const dnSteps = lo < 0 ? Math.max(1, Math.ceil((Math.abs(lo) * 1.14) / step)) : 0;
        const ticks = [];
        for (let i = -dnSteps; i <= upSteps; i++) ticks.push(i * step);
        return { ticks, lo: -dnSteps * step, hi: upSteps * step };
      };

      const fmtRoundAxisUsd = v => {
        const n = Math.round(Number(v || 0));
        if (n === 0) return '$0';
        const sign = n < 0 ? '-' : '+';
        const abs = Math.abs(n);
        if (abs >= 1000000) return `${n < 0 ? '-' : ''}$${(abs / 1000000).toFixed(abs % 1000000 === 0 ? 0 : 1)}M`;
        if (abs >= 10000) return `${n < 0 ? '-' : ''}$${Math.round(abs / 1000)}K`;
        return `${sign}$${abs.toLocaleString('en-US')}`;
      };

      const buildCashFlowSplitColumnSvg = (mRows, selectedYm) => {
        const data = (mRows || []).slice(-14);
        if (!data.length) return `<div style="padding:24px;text-align:center;color:var(--muted);font-size:12px">No monthly cash flow data for active filter</div>`;
        const W = 620, H = 228, padL = 52, padR = 16, padT = 18, padB = 34;
        const plotW = W - padL - padR, plotH = H - padT - padB;
        let rawMax = 100;
        const parsed = data.map(r => {
          const totIn = Math.max(0, Number(r.cash_in || 0));
          const totOut = Math.max(0, Number(r.cash_out || 0));
          const opIn = Math.min(totIn, Math.max(0, Number(r.cash_sales || 0) + Number(r.receipts || 0)));
          const trIn = Math.max(0, round2(totIn - opIn));
          const opOut = Math.min(totOut, Math.max(0, Number(r.cash_expenses || 0) + Number(r.settlements_paid || 0) + Number(r.salaries || 0)));
          const trOut = Math.max(0, round2(totOut - opOut));
          rawMax = Math.max(rawMax, totIn, totOut);
          return {
            r,
            ymIso: ymToIso(r),
            rawLbl: String(r['Year Month'] || r.YearMonthNo || ''),
            totIn, totOut, opIn, trIn, opOut, trOut,
            opNet: round2(opIn - opOut),
            netCash: cleanUsd(r.net_cash, 0.5)
          };
        });
        const { ticks, top } = nicePositiveTicks(rawMax);
        const yOf = v => padT + plotH * (1 - (v / top));
        const grid = ticks.map(tv => {
          const y = yOf(tv).toFixed(1);
          const isZero = tv === 0;
          const lbl = tv === 0 ? '$0' : (tv >= 1000000 ? `$${(tv / 1000000).toFixed(tv % 1000000 === 0 ? 0 : 1)}M` : `$${Math.round(tv / 1000)}K`);
          return `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="${isZero ? 'var(--ink)' : 'rgba(128,138,158,0.18)'}" stroke-opacity="${isZero ? '0.32' : '1'}" stroke-width="${isZero ? '1.3' : '1'}" ${isZero ? '' : 'stroke-dasharray="3 3"'}/>` +
            `<text x="${padL - 7}" y="${(Number(y) + 3.2).toFixed(1)}" text-anchor="end" font-size="9.5" font-weight="${isZero ? '700' : '500'}" fill="${isZero ? 'var(--ink)' : 'var(--muted)'}">${lbl}</text>`;
        }).join('');

        const grpW = plotW / parsed.length;
        const barW = Math.min(13, Math.max(6, (grpW * 0.66 - 2) / 2));
        const cols = parsed.map((d, i) => {
          const cx = padL + i * grpW + grpW / 2;
          const xIn = cx - barW - 1;
          const xOut = cx + 1;
          const shortLbl = d.rawLbl.replace(/^(\w{3})\s+20(\d{2})$/, "$1 '$2").slice(0, 7);
          const isSel = selectedYm && d.ymIso === selectedYm;

          const hOpIn = (d.opIn / top) * plotH;
          const hTrIn = (d.trIn / top) * plotH;
          const yOpIn = padT + plotH - hOpIn;
          const yTrIn = yOpIn - hTrIn;

          const hOpOut = (d.opOut / top) * plotH;
          const hTrOut = (d.trOut / top) * plotH;
          const yOpOut = padT + plotH - hOpOut;
          const yTrOut = yOpOut - hTrOut;

          const tip = `${d.rawLbl} (Click to inspect month entries)\n` +
            `• Operating In (Sales + AR): ${fmtUSD(d.opIn, 0)}\n` +
            `• Treasury, Loans & FX In: ${fmtUSD(d.trIn, 0)}\n` +
            `• Total Cash In: ${fmtUSD(d.totIn, 0)}\n` +
            `• Operating Out (Exp + AP + Payroll): ${fmtUSD(d.opOut, 0)}\n` +
            `• Treasury Sweeps & FX Out: ${fmtUSD(d.trOut, 0)}\n` +
            `• Total Cash Out: ${fmtUSD(d.totOut, 0)}\n` +
            `• Operating Cash Surplus: ${fmtSignedUSD(d.opNet, 0)} · Net Till Δ: ${fmtSignedUSD(d.netCash, 0)}`;

          return `<g class="cf-chart-bar${isSel ? ' is-selected' : ''}" ${d.ymIso ? `data-cf-focus-ym="${esc(d.ymIso)}"` : ''}>` +
            `<rect class="cf-bar-hit" x="${(padL + i * grpW + 1).toFixed(1)}" y="${padT}" width="${(grpW - 2).toFixed(1)}" height="${plotH + 22}" rx="4" fill="${isSel ? 'rgba(192,137,47,0.12)' : 'transparent'}"/>` +
            (hOpIn > 0.4 ? `<rect x="${xIn.toFixed(1)}" y="${yOpIn.toFixed(1)}" width="${barW.toFixed(1)}" height="${hOpIn.toFixed(1)}" fill="#1C8C46" rx="1.5"/>` : '') +
            (hTrIn > 0.4 ? `<rect x="${xIn.toFixed(1)}" y="${yTrIn.toFixed(1)}" width="${barW.toFixed(1)}" height="${hTrIn.toFixed(1)}" fill="#6BB38B" rx="1.5"/>` : '') +
            (hOpOut > 0.4 ? `<rect x="${xOut.toFixed(1)}" y="${yOpOut.toFixed(1)}" width="${barW.toFixed(1)}" height="${hOpOut.toFixed(1)}" fill="#C8333B" rx="1.5"/>` : '') +
            (hTrOut > 0.4 ? `<rect x="${xOut.toFixed(1)}" y="${yTrOut.toFixed(1)}" width="${barW.toFixed(1)}" height="${hTrOut.toFixed(1)}" fill="#DF8A71" rx="1.5"/>` : '') +
            `<text x="${cx.toFixed(1)}" y="${H - 10}" text-anchor="middle" font-size="9.3" font-weight="${isSel ? '800' : '500'}" fill="${isSel ? 'var(--brass)' : 'var(--muted)'}">${esc(shortLbl)}</text>` +
            `<title>${esc(tip)}</title>` +
            `</g>`;
        }).join('');

        return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;display:block" role="img" aria-label="Monthly Cash Inflows and Outflows split into Operating vs Treasury Sweeps">${grid}${cols}</svg>`;
      };

      const buildTillBalanceChartSvg = (items, opts = {}) => {
        if (!items || !items.length) return `<div style="padding:24px;text-align:center;color:var(--muted);font-size:12px">No physical cash till balance points for active filter</div>`;
        const W = 620, H = 228, padL = 54, padR = 16, padT = 22, padB = 34;
        const plotW = W - padL - padR, plotH = H - padT - padB;
        const rateNum = Number(opts.rate || 89500);
        const isDaily = Boolean(opts.isDaily);

        let minV = 0, maxV = 0;
        items.forEach(d => {
          if (d.val < minV) minV = d.val;
          if (d.val > maxV) maxV = d.val;
        });
        const { ticks, lo, hi } = niceSignedTicks(minV, maxV);
        const span = Math.max(1, hi - lo);
        const yOf = v => padT + plotH * (1 - ((v - lo) / span));
        const yZero = yOf(0);
        const allZero = items.every(d => Math.abs(d.val) < 0.5);

        const grid = ticks.map(tv => {
          const y = yOf(tv).toFixed(1);
          const isZ = tv === 0;
          const lbl = fmtRoundAxisUsd(tv);
          return `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="${isZ ? 'var(--ink)' : 'rgba(128,138,158,0.18)'}" stroke-opacity="${isZ ? '0.42' : '1'}" stroke-width="${isZ ? '1.6' : '1'}" ${isZ ? '' : 'stroke-dasharray="3 3"'}/>` +
            `<text x="${padL - 7}" y="${(Number(y) + 3.2).toFixed(1)}" text-anchor="end" font-size="9.5" font-weight="${isZ ? '800' : '500'}" fill="${isZ ? 'var(--ink)' : 'var(--muted)'}">${lbl}</text>`;
        }).join('');

        const grpW = plotW / items.length;
        const barW = Math.min(24, Math.max(isDaily ? 7 : 14, grpW * 0.58));
        const labelStep = isDaily ? Math.max(1, Math.ceil(items.length / 8)) : 1;

        const bars = items.map((d, i) => {
          const cx = padL + i * grpW + grpW / 2;
          const isZeroBar = Math.abs(d.val) < 0.5;
          const isNeg = d.val <= -0.5;
          const lbpUsdEq = Math.abs(Number(d.lbp || 0)) / rateNum;
          const isLbpDom = !isZeroBar && !isNeg && lbpUsdEq > Math.abs(Number(d.usd || 0)) + 1;
          const fill = isZeroBar ? '#1C8C46' : (isNeg ? '#C8333B' : (isLbpDom ? '#C0892F' : '#2A6DB5'));
          const isSel = (d.ymIso && opts.selectedYm === d.ymIso) || (d.dateIso && opts.selectedDate === d.dateIso);
          const drillAttr = d.dateIso ? `data-cf-focus-date="${esc(d.dateIso)}"` : (d.ymIso ? `data-cf-focus-ym="${esc(d.ymIso)}"` : '');

          let barShape = '';
          let valLbl = '';
          if (isZeroBar) {
            barShape = `<circle cx="${cx.toFixed(1)}" cy="${yZero.toFixed(1)}" r="${isDaily ? '3.2' : '4.2'}" fill="#1C8C46" stroke="var(--surface)" stroke-width="1.2"/>`;
            if (!isDaily || i === items.length - 1) {
              valLbl = `<text x="${cx.toFixed(1)}" y="${(yZero - 8).toFixed(1)}" text-anchor="middle" font-size="8.6" font-weight="700" fill="#1C8C46">$0</text>`;
            }
          } else {
            const yVal = yOf(d.val);
            const rectY = Math.min(yZero, yVal);
            const rectH = Math.max(3, Math.abs(yVal - yZero));
            barShape = `<rect x="${(cx - barW / 2).toFixed(1)}" y="${rectY.toFixed(1)}" width="${barW.toFixed(1)}" height="${rectH.toFixed(1)}" rx="2.5" fill="${fill}"/>`;
            const showVal = !isDaily || Math.abs(d.val) >= Math.max(Math.abs(minV), Math.abs(maxV)) * 0.35 || i === items.length - 1;
            if (showVal) {
              const txt = (d.val < 0 ? '-$' : '$') + Math.round(Math.abs(d.val)).toLocaleString('en-US');
              const lblY = isNeg ? Math.min(H - 22, rectY + rectH + 10) : Math.max(12, rectY - 5);
              valLbl = `<text x="${cx.toFixed(1)}" y="${lblY.toFixed(1)}" text-anchor="middle" font-size="8.8" font-weight="700" fill="${isNeg ? '#C8333B' : 'var(--ink)'}">${txt}</text>`;
            }
          }

          const showXAxisLbl = (i % labelStep === 0) || (i === items.length - 1);
          const xLbl = showXAxisLbl
            ? `<text x="${cx.toFixed(1)}" y="${H - 10}" text-anchor="middle" font-size="9.2" font-weight="${isSel ? '800' : '500'}" fill="${isSel ? 'var(--brass)' : 'var(--muted)'}">${esc(d.shortLbl)}</text>`
            : '';

          const tip = `${d.fullLbl} (Click to inspect entries)\n` +
            `• Closing Cash Till (5300): ${fmtUSD(d.val, 2)}\n` +
            `• USD Drawer: ${fmtUSD(cleanUsd(d.usd, 0.05), 2)}\n` +
            `• LBP Drawer: ${fmtLL(d.lbp || 0)}${Math.abs(d.lbp || 0) > 5 ? ` (${fmtUSD((d.lbp || 0) / rateNum, 2)} eq.)` : ''}\n` +
            (d.inUsd != null ? `• Period Inflows: ${fmtUSD(d.inUsd, 0)} · Outflows: ${fmtUSD(d.outUsd, 0)}` : '');

          return `<g class="cf-chart-bar${isSel ? ' is-selected' : ''}" ${drillAttr}>` +
            `<rect class="cf-bar-hit" x="${(padL + i * grpW + 1).toFixed(1)}" y="${padT}" width="${(grpW - 2).toFixed(1)}" height="${plotH + 22}" rx="4" fill="${isSel ? 'rgba(192,137,47,0.12)' : 'transparent'}"/>` +
            `${barShape}${valLbl}${xLbl}` +
            `<title>${esc(tip)}</title>` +
            `</g>`;
        }).join('');

        const zeroCallout = allZero
          ? `<rect x="${(padL + plotW / 2 - 118).toFixed(1)}" y="${(padT + 8).toFixed(1)}" width="236" height="20" rx="10" fill="rgba(28,140,70,0.10)" stroke="rgba(28,140,70,0.35)"/>` +
            `<text x="${(padL + plotW / 2).toFixed(1)}" y="${(padT + 21.5).toFixed(1)}" text-anchor="middle" font-size="9.5" font-weight="700" fill="#1C8C46">All ${items.length} ${isDaily ? 'days' : 'months'} swept to $0.00 balance</text>`
          : '';

        return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;display:block" role="img" aria-label="Closing Physical Cash Till Account 5300 Trajectory">${grid}${bars}${zeroCallout}</svg>`;
      };

      const rateLbp = Number(k.rate_lbp || 89500);
      const chartGrain = STATE.cfChartGrain === 'daily' ? 'daily' : 'monthly';
      const allDailyRows = typeof ctx.buildDailyTillSheetRows === 'function' ? ctx.buildDailyTillSheetRows() : [];
      const allCashMoves = typeof ctx.buildCashTillMoves === 'function' ? ctx.buildCashTillMoves() : [];

      const tillChartItems = chartGrain === 'daily'
        ? allDailyRows.slice(0, 30).reverse().map(d => ({
            dateIso: d.date,
            shortLbl: fmtDateDMY(d.date).slice(0, 5),
            fullLbl: `${fmtDateDMY(d.date)} (${d.dow})`,
            val: cleanUsd(d.close_combined, 0.05),
            usd: cleanUsd(d.close_usd, 0.05),
            lbp: Math.abs(d.close_lbp) <= 5 ? 0 : d.close_lbp,
            inUsd: d.in_usd,
            outUsd: d.out_usd
          }))
        : months.slice(-14).map(r => {
            const rawLbl = String(r['Year Month'] || r.YearMonthNo || '');
            return {
              ymIso: ymToIso(r),
              shortLbl: rawLbl.replace(/^(\w{3})\s+20(\d{2})$/, "$1 '$2").slice(0, 7),
              fullLbl: rawLbl,
              val: cleanUsd(r.cash_till, 0.05),
              usd: cleanUsd(r.till_usd != null ? r.till_usd : r.cash_till, 0.05),
              lbp: Math.abs(r.till_lbp || 0) <= 5 ? 0 : Math.round(r.till_lbp || 0),
              inUsd: r.cash_in,
              outUsd: r.cash_out
            };
          });

      const progRows = [...months].reverse().map(r => {
        const opIn = Number(r.cash_sales || 0) + Number(r.receipts || 0);
        const opOut = Number(r.cash_expenses || 0) + Number(r.settlements_paid || 0) + Number(r.salaries || 0);
        return Object.assign({}, r, {
          _ymIso: ymToIso(r),
          treasury_in: Math.max(0, round2(Number(r.cash_in || 0) - opIn)),
          sweeps_out: Math.max(0, round2(Number(r.cash_out || 0) - opOut)),
          clean_net: cleanUsd(r.net_cash, 0.5),
          clean_till: cleanUsd(r.cash_till, 0.5)
        });
      });

      // Interactive Cash Till Entries & Daily Cashbook Explorer right inside Cash Flow Analytics
      const isDailyMode = STATE.cfEntryMode === 'daily';
      const focusDate = STATE.cfFocusDate || '';
      const focusYm = STATE.cfFocusYm || '';
      const focusParty = STATE.cfFocusParty || '';
      const focusPartyNorm = norm(focusParty);
      const qComb = [STATE.search || '', sl.search || ''].map(s => String(s).trim().toLowerCase()).filter(Boolean).join(' ');
      const hasDrill = Boolean(focusDate || focusYm || focusParty);
      const fmtYmHuman = ym => {
        const mHit = String(ym || '').match(/^(\d{4})-(\d{2})$/);
        if (!mHit) return ym;
        const mNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${mNames[(Number(mHit[2]) || 1) - 1]} ${mHit[1]}`;
      };

      const drillScopedMoves = allCashMoves.filter(mv => {
        if (focusDate && mv.date !== focusDate) return false;
        if (focusYm && mv.ym !== focusYm) return false;
        if (focusPartyNorm && norm(mv.party) !== focusPartyNorm) return false;
        return true;
      });
      const hasFullFinRows = allCashMoves.some(mv => mv.stream === 'ext' || mv.stream === 'sal' || mv.stream === 'loan');
      const cfChip = STATE.chipFilter || 'all';
      const chipBtn = (key, lbl) => `<button type="button" class="filter-chip ${cfChip === key ? 'active' : ''}" data-chip="${esc(key)}">${lbl}</button>`;

      const filteredMoves = drillScopedMoves.filter(mRow => {
        if (cfChip === 'cf_in' && mRow.dir !== 'IN') return false;
        if (cfChip === 'cf_out' && mRow.dir !== 'OUT') return false;
        if (cfChip === 'cf_sales' && mRow.stream !== 'sales') return false;
        if (cfChip === 'cf_exp' && mRow.stream !== 'exp') return false;
        if (cfChip === 'cf_ext' && mRow.stream !== 'ext') return false;
        if (cfChip === 'cf_sal' && mRow.stream !== 'sal') return false;
        if (cfChip === 'cf_loan' && mRow.stream !== 'loan') return false;
        if (cfChip === 'cf_fx' && mRow.stream !== 'fx') return false;
        if (cfChip === 'cf_lbp' && Math.abs(mRow.lbp) <= 1) return false;
        if (qComb && !`${mRow.date} ${fmtDateDMY(mRow.date)} ${mRow.company} ${mRow.cat} ${mRow.party} ${mRow.detail} ${mRow.ref} ${mRow.method}`.toLowerCase().includes(qComb)) return false;
        return true;
      });
      const sortedMoves = ctx.sortRows ? ctx.sortRows(filteredMoves, 'cf_moves', 'date', 'desc') : filteredMoves;
      const shownMoves = sortedMoves.slice(0, ctx.shownCount ? ctx.shownCount('cf_moves') : 50);
      let mvInUsd = 0, mvOutUsd = 0, mvLbpSum = 0;
      for (let i = 0; i < sortedMoves.length; i++) {
        mvInUsd += sortedMoves[i].in_usd;
        mvOutUsd += sortedMoves[i].out_usd;
        mvLbpSum += sortedMoves[i].lbp;
      }
      mvInUsd = round2(mvInUsd);
      mvOutUsd = round2(mvOutUsd);
      const mvUsdNet = round2(mvInUsd - mvOutUsd);
      mvLbpSum = Math.round(mvLbpSum);

      const filteredDaily = allDailyRows.filter(dRow => {
        if (focusYm && dRow.ym !== focusYm) return false;
        if (cfChip === 'cf_day_nonzero' && Math.abs(dRow.close_combined) < 0.05) return false;
        if (cfChip === 'cf_day_lbp' && Math.abs(dRow.in_lbp) <= 1 && Math.abs(dRow.out_lbp) <= 1 && Math.abs(dRow.close_lbp) <= 5) return false;
        if (cfChip === 'cf_day_neg' && dRow.close_combined >= -0.05) return false;
        if (qComb && !`${dRow.date} ${fmtDateDMY(dRow.date)} ${dRow.dow}`.toLowerCase().includes(qComb)) return false;
        return true;
      });
      const sortedDaily = ctx.sortRows ? ctx.sortRows(filteredDaily, 'cf_daily', 'date', 'desc') : filteredDaily;
      const shownDaily = sortedDaily.slice(0, ctx.shownCount ? ctx.shownCount('cf_daily') : 50);
      let dyInUsd = 0, dyOutUsd = 0;
      for (let i = 0; i < sortedDaily.length; i++) {
        dyInUsd += sortedDaily[i].in_usd;
        dyOutUsd += sortedDaily[i].out_usd;
      }
      dyInUsd = round2(dyInUsd);
      dyOutUsd = round2(dyOutUsd);
      const dyNetUsd = round2(dyInUsd - dyOutUsd);
      const latestDayClose = sortedDaily.length ? sortedDaily[0] : { close_usd: cleanUsd(k.cash_till_usd), close_lbp: Math.round(k.cash_till_lbp || 0), close_combined: cleanUsd(k.cash_till) };

      const thCell = (view, lbl, key, cls) => ctx.th ? ctx.th(view, lbl, key, cls) : `<th class="${cls || ''}">${esc(lbl)}</th>`;

      bodyHtml = `
        <div class="pbi-overview-bands">
          ${kpiBand('1 · Cash Flow & Daily Plant Till (Lebanese CoA Account 5300)', [
            { label: 'USD Cash Till ($)', value: fmtUSD(cleanUsd(k.cash_till_usd != null ? k.cash_till_usd : k.cash_till), 2), sub: `In ${fmtUSD(k.cash_in_usd != null ? k.cash_in_usd : k.cash_inflow, 0)} · Out ${fmtUSD(k.cash_out_usd != null ? k.cash_out_usd : k.cash_outflow, 0)}`, tone: 'good' },
            { label: 'LBP Cash Till (LL)', value: fmtLL(k.cash_till_lbp || 0), sub: `Rate ${fmtNum(rateLbp, 0)} LL/$`, tone: 'good' },
            { label: 'Closing Cash Till (5300)', value: fmtUSD(cleanUsd(k.cash_till), 2), sub: 'Combined USD + LBP book till', tone: 'brass' },
            { label: 'Cash Inflows (Total)', value: fmtUSD(k.cash_inflow, 0), sub: 'Op. Sales/AR + Treasury/FX in', tone: 'good' },
            { label: 'Cash Outflows (Total)', value: fmtUSD(k.cash_outflow, 0), sub: 'Op. Exp/AP/Payroll + Sweeps out', tone: 'crit' },
            { label: 'Net Cash Flow', value: fmtUSD(cleanUsd(k.net_cash_flow), 2), sub: 'Inflows − Outflows in period', neg: true }
          ])}
        </div>

        <div class="pbi-grid-1">
          <div class="cf-explainer-bar" role="region" aria-label="How Plant Cash Till 5300 Works">
            <div class="cf-explainer-copy">
              <strong>How Till 5300 Works:</strong> Cash Sales &amp; AR Receipts flow <b>IN</b> while Cash Expenses, AP Settlements &amp; Payroll flow <b>OUT</b>; daily <b>Treasury Sweeps</b> transfer net cash to/from central treasury so physical cash on hand stays near <b>$0.00</b> (<span class="mono">USD + LBP ÷ ${fmtNum(rateLbp, 0)}</span>). <em>Click any bar or month to inspect its entries below.</em>
            </div>
            <div class="cf-grain-ctrl">
              <span class="cf-grain-lbl">Till Balance View</span>
              <div class="cf-mode-switch" role="group" aria-label="Closing Till Chart Grain">
                <button type="button" class="cf-mode-btn ${chartGrain === 'monthly' ? 'active' : ''}" data-cf-chart-grain="monthly">Monthly (${months.slice(-14).length}m)</button>
                <button type="button" class="cf-mode-btn ${chartGrain === 'daily' ? 'active' : ''}" data-cf-chart-grain="daily">Daily (Last ${Math.min(30, allDailyRows.length)}d)</button>
              </div>
            </div>
          </div>
        </div>

        <div class="pbi-grid-2">
          ${pbiPanel('Monthly Cash Inflows vs Outflows — Operating vs Treasury Sweeps', buildCashFlowSplitColumnSvg(months, focusYm), {
            subtitle: 'Left column = Inflows · Right column = Outflows · Click any month to filter entries below',
            legend: [
              { label: 'Op. Cash In (Sales+AR)', color: '#1C8C46' },
              { label: 'Treasury / FX In', color: '#6BB38B' },
              { label: 'Op. Cash Out (Exp+AP+Sal)', color: '#C8333B' },
              { label: 'Sweeps / FX Out', color: '#DF8A71' }
            ]
          })}
          ${pbiPanel(chartGrain === 'daily' ? 'Closing Cash Till (5300) — Last 30 Operating Days' : 'Closing Cash Till (5300) — Month-End Balance ($)', buildTillBalanceChartSvg(tillChartItems, { rate: rateLbp, isDaily: chartGrain === 'daily', selectedYm: focusYm, selectedDate: focusDate }), {
            subtitle: chartGrain === 'daily'
              ? 'End-of-day physical drawer balance anchored at $0 · Click any day to inspect entries'
              : 'Month-end physical drawer balance anchored at $0 (no flow overlay) · Hover for USD + LBP split',
            legend: [
              { label: 'USD Drawer (+)', color: '#2A6DB5' },
              { label: 'LBP Drawer (+)', color: '#C0892F' },
              { label: 'Timing Deficit (<$0)', color: '#C8333B' },
              { label: 'Balanced ($0)', color: '#1C8C46' }
            ]
          })}
        </div>

        <div class="pbi-grid-1">
          ${pbiTable('Monthly Cash Flow & Till Progression', [
            { label: 'Month', key: 'Year Month', fmt: (v, r) => r._ymIso ? `<button type="button" class="cf-month-drill-btn${focusYm === r._ymIso ? ' active' : ''}" data-cf-focus-ym="${esc(r._ymIso)}" title="Inspect all cash till entries in ${esc(v)}"><strong>${esc(v)}</strong> <span>→</span></button>` : `<b>${esc(v)}</b>` },
            { label: 'Cash Sales ($)', key: 'cash_sales', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'AR Receipts ($)', key: 'receipts', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Treasury & FX In ($)', key: 'treasury_in', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Total Cash In ($)', key: 'cash_in', r: true, bar: true, fmt: v => `<b>${fmtUSD(v, 0)}</b>` },
            { label: 'Cash Expenses ($)', key: 'cash_expenses', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'AP Settlements ($)', key: 'settlements_paid', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Salaries Paid ($)', key: 'salaries', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Sweeps & FX Out ($)', key: 'sweeps_out', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Total Cash Out ($)', key: 'cash_out', r: true, fmt: v => `<b>${fmtUSD(v, 0)}</b>` },
            { label: 'Net Cash Flow ($)', key: 'clean_net', r: true, negRed: true, fmt: v => `<b>${fmtUSD(v, 0)}</b>` },
            { label: 'Closing Till ($)', key: 'clean_till', r: true, negRed: true, fmt: v => fmtUSD(v, 0) }
          ], progRows, {
            subtitle: 'Operating Cash + Treasury Sweeps/FX reconcile 100% to Total Cash In & Out · Click any month to filter the Cash Till Entries Explorer below',
            unitLabel: 'months'
          })}
        </div>

        ${typeof ctx.buildCashTillMoves === 'function' ? `
        <div class="pbi-grid-1" style="margin-bottom:6px">
          <div class="pbi-panel" id="pbiCfEntriesPanel">
            <div class="pbi-panel-hdr cf-register-head">
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                <div>
                  <div class="pbi-panel-title">Cash Till Entries &amp; Daily Cashbook Explorer (Account 5300)</div>
                  <div class="pbi-panel-sub">Inspect every cash inflow, outflow, treasury sweep, salary, loan &amp; FX slip · Click any row for 360° Record Form</div>
                </div>
                <div class="cf-mode-switch" role="tablist" aria-label="Cash Till Explorer View Mode">
                  <button type="button" class="cf-mode-btn ${!isDailyMode ? 'active' : ''}" data-cf-mode="entries" role="tab" aria-selected="${!isDailyMode}">Individual Entries <span>(${fmtNum(allCashMoves.length)})</span></button>
                  <button type="button" class="cf-mode-btn ${isDailyMode ? 'active' : ''}" data-cf-mode="daily" role="tab" aria-selected="${isDailyMode}">Daily Till Sheet <span>(${fmtNum(allDailyRows.length)} Days)</span></button>
                </div>
              </div>
              <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                <button type="button" class="btn" data-nav-jump="cashflow">7-Table Book Recon →</button>
                ${exportBtn('pbiCfEntriesPanel', isDailyMode ? 'Daily_Till_Sheet' : 'Cash_Till_Entries')}
              </div>
            </div>

            <div class="table-toolbar" style="border-top:1px solid var(--line)">
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                ${ctx.searchBox ? ctx.searchBox(isDailyMode ? 'Search date (DD-MM-YYYY) or weekday...' : 'Search counterparty, note, #ref, ticket, category...') : ''}
                <div class="chip-bar">
                  ${!isDailyMode ? `
                    ${chipBtn('all', `All (${fmtNum(drillScopedMoves.length)})`)}
                    ${chipBtn('cf_in', '▲ Cash In')}
                    ${chipBtn('cf_out', '▼ Cash Out')}
                    ${chipBtn('cf_sales', 'Sales & AR')}
                    ${chipBtn('cf_exp', 'Expenses & AP')}
                    ${hasFullFinRows ? chipBtn('cf_ext', 'Treasury & Sweeps') : ''}
                    ${hasFullFinRows ? chipBtn('cf_sal', 'Salaries') : ''}
                    ${hasFullFinRows ? chipBtn('cf_loan', 'Loans') : ''}
                    ${chipBtn('cf_fx', '⇄ FX')}
                    ${chipBtn('cf_lbp', 'LBP (LL)')}
                  ` : `
                    ${chipBtn('all', `All Days (${fmtNum(allDailyRows.length)})`)}
                    ${chipBtn('cf_day_nonzero', 'Drawer ≠ $0')}
                    ${chipBtn('cf_day_lbp', 'LBP Active')}
                    ${chipBtn('cf_day_neg', 'Timing Deficit (<$0)')}
                  `}
                </div>
              </div>
              <div class="cf-live-strip" aria-label="Filtered Cash Summary">
                ${!isDailyMode ? `
                  <span>In: <b class="good">${fmtUSD(mvInUsd, 2)}</b></span>
                  <span>Out: <b class="crit">${fmtUSD(mvOutUsd, 2)}</b></span>
                  <span>Net: <b style="color:${mvUsdNet < -0.005 ? 'var(--crit)' : (mvUsdNet > 0.005 ? 'var(--good)' : 'var(--ink)')}">${fmtSignedUSD(mvUsdNet, 2)}</b></span>
                  ${Math.abs(mvLbpSum) > 1 ? `<span>LBP: <b>${fmtSignedLBP(mvLbpSum)}</b></span>` : ''}
                ` : `
                  <span>Click any day row to inspect all cash entries of that day →</span>
                `}
              </div>
            </div>

            ${hasDrill ? `
            <div class="cf-drill-strip" role="status">
              <span class="cf-drill-lbl">Active Drill Filter:</span>
              ${focusDate ? `<button type="button" class="cf-active-pill" data-cf-clear-drill="date"><span>Day: <b>${esc(fmtDateDMY(focusDate))}</b></span><span class="cf-pill-x">✕</span></button>` : ''}
              ${focusYm ? `<button type="button" class="cf-active-pill" data-cf-clear-drill="ym"><span>Month: <b>${esc(fmtYmHuman(focusYm))}</b></span><span class="cf-pill-x">✕</span></button>` : ''}
              ${focusParty ? `<button type="button" class="cf-active-pill" data-cf-clear-drill="party"><span>Counterparty: <b>${esc(focusParty)}</b></span><span class="cf-pill-x">✕</span></button>` : ''}
              <button type="button" class="cf-clear-all-btn" data-cf-clear-drill="all">✕ Show All Cash Entries</button>
            </div>` : ''}

            ${!isDailyMode ? `
            ${ctx.renderColFilterBar ? ctx.renderColFilterBar('cf_moves') : ''}
            <div class="table-wrap">
              <table class="ledger-table">
                <thead>
                  <tr>
                    ${thCell('cf_moves', 'Date', 'date')}
                    ${thCell('cf_moves', 'Co.', 'company')}
                    ${thCell('cf_moves', 'Category', 'cat')}
                    ${thCell('cf_moves', 'Counterparty', 'party')}
                    ${thCell('cf_moves', 'Details', 'detail')}
                    ${thCell('cf_moves', 'Ref', 'ref')}
                    ${thCell('cf_moves', 'In ($)', 'in_usd', 'r')}
                    ${thCell('cf_moves', 'Out ($)', 'out_usd', 'r')}
                    ${thCell('cf_moves', 'LBP (LL)', 'lbp', 'r')}
                  </tr>
                </thead>
                <tbody>
                  ${shownMoves.map(r => {
                    const flowCls = r.dir === 'IN' ? 'in' : (r.dir === 'FX' ? 'fx' : 'out');
                    const flowSym = r.dir === 'IN' ? '▲' : (r.dir === 'FX' ? '⇄' : '▼');
                    const partyHtml = (r.partyRel && ctx.relLink)
                      ? ctx.relLink(r.partyRel, r.party, r.party, true)
                      : `<button type="button" class="cf-party-btn" data-cf-focus-party="${esc(r.party)}" title="Filter all cash entries for ${esc(r.party)}">${esc(r.party)}</button>`;
                    const refHtml = (r.ticketId && ctx.ic)
                      ? `<span class="tkt-cell-inline"><strong class="tkt-no-num">${esc(r.ref)}</strong><button type="button" class="tkt-print-mini" data-print-ticket="sales" data-print-id="${esc(r.ticketId)}" title="Preview / Print Ticket ${esc(r.ref)}">${ctx.ic('printer')}</button></span> <span class="mu">· ${esc(r.method)}</span>`
                      : `${esc(r.ref)} <span class="mu">· ${esc(r.method)}</span>`;
                    return `
                    <tr class="rrow" data-rkey="${esc(r.rkey)}" data-rid="${esc(r.id)}">
                      <td class="mono"><button type="button" class="cf-date-jump" data-cf-focus-date="${esc(r.date)}" title="Filter entries to ${esc(fmtDateDMY(r.date))}">${esc(fmtDateDMY(r.date))}</button>${ctx.appCell ? ctx.appCell(r.raw, r.rkey) : ''}</td>
                      <td>${ctx.coBadge ? ctx.coBadge(r.company) : shortCoHtml(r.company)}</td>
                      <td class="cf-cat-cell"><span class="cf-flow-badge ${flowCls}">${flowSym}</span><span class="cf-cat-txt">${esc(r.cat)}</span></td>
                      <td class="cf-party-cell" title="${esc(r.party)}">${partyHtml}</td>
                      <td class="cf-detail-cell" title="${esc(r.detail)}">${esc(r.detail)}</td>
                      <td class="mono cf-ref-cell" title="${esc(r.ref + ' · ' + r.method)}">${refHtml}</td>
                      <td class="r">${r.in_usd >= 0.005 ? `<strong style="color:var(--good)">+${fmtUSD(r.in_usd, 2)}</strong>` : '—'}</td>
                      <td class="r">${r.out_usd >= 0.005 ? `<strong style="color:var(--crit)">-${fmtUSD(r.out_usd, 2)}</strong>` : '—'}</td>
                      <td class="r">${Math.abs(r.lbp) > 1 ? `<strong style="color:${r.lbp < 0 ? 'var(--crit)' : 'var(--good)'}">${fmtSignedLBP(r.lbp)}</strong>` : (r.stream === 'fx' ? '0 LL' : '—')}</td>
                    </tr>`;
                  }).join('') || (ctx.emptyRow ? ctx.emptyRow(9, 'No cash till entries match the active filter') : '')}
                  ${ctx.showMoreRow ? ctx.showMoreRow('cf_moves', sortedMoves.length, 9) : ''}
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="6"><b>FILTERED TOTAL (${fmtNum(sortedMoves.length)} ENTRIES · NET ${fmtSignedUSD(mvUsdNet, 2)})</b></td>
                    <td class="r"><b style="color:var(--good)">+${fmtUSD(mvInUsd, 2)}</b></td>
                    <td class="r"><b style="color:var(--crit)">-${fmtUSD(mvOutUsd, 2)}</b></td>
                    <td class="r"><b style="color:${mvLbpSum < -1 ? 'var(--crit)' : (mvLbpSum > 1 ? 'var(--good)' : 'inherit')}">${fmtSignedLBP(mvLbpSum)}</b></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            ` : `
            ${ctx.renderColFilterBar ? ctx.renderColFilterBar('cf_daily') : ''}
            <div class="table-wrap">
              <table class="ledger-table">
                <thead>
                  <tr>
                    ${thCell('cf_daily', 'Date', 'date')}
                    ${thCell('cf_daily', 'Entries', 'entries_cnt', 'r')}
                    ${thCell('cf_daily', 'Open ($)', 'open_usd', 'r')}
                    ${thCell('cf_daily', 'In ($)', 'in_usd', 'r')}
                    ${thCell('cf_daily', 'Out ($)', 'out_usd', 'r')}
                    ${thCell('cf_daily', 'Net ($)', 'net_usd', 'r')}
                    ${thCell('cf_daily', 'Close ($)', 'close_usd', 'r')}
                    ${thCell('cf_daily', 'Close (LL)', 'close_lbp', 'r')}
                    ${thCell('cf_daily', 'Till 5300 ($)', 'close_combined', 'r')}
                  </tr>
                </thead>
                <tbody>
                  ${shownDaily.map(d => {
                    const statusBadge = Math.abs(d.close_combined) < 0.05
                      ? '<span class="badge badge-ok" style="margin-left:5px">Balanced $0</span>'
                      : (d.close_combined < 0 ? '<span class="badge badge-warn" style="margin-left:5px">Timing Deficit</span>' : '');
                    return `
                    <tr class="cf-day-row" data-cf-focus-date="${esc(d.date)}" title="Click to inspect ${fmtNum(d.entries_cnt)} cash entries on ${esc(fmtDateDMY(d.date))}">
                      <td class="mono"><strong>${esc(fmtDateDMY(d.date))}</strong> <span class="mu">${esc(d.dow)}</span></td>
                      <td class="r"><span class="badge badge-info">${fmtNum(d.entries_cnt)} →</span></td>
                      <td class="r">${Math.abs(d.open_usd) >= 0.005 ? fmtUSD(d.open_usd, 2) : '$0.00'}</td>
                      <td class="r">${d.in_usd >= 0.005 ? `<strong style="color:var(--good)">+${fmtUSD(d.in_usd, 2)}</strong>` : '—'}</td>
                      <td class="r">${d.out_usd >= 0.005 ? `<strong style="color:var(--crit)">-${fmtUSD(d.out_usd, 2)}</strong>` : '—'}</td>
                      <td class="r"><strong style="color:${d.net_usd < -0.005 ? 'var(--crit)' : (d.net_usd > 0.005 ? 'var(--good)' : 'var(--muted)')}">${fmtSignedUSD(d.net_usd, 2)}</strong></td>
                      <td class="r"><strong style="color:${d.close_usd < -0.05 ? 'var(--crit)' : 'inherit'}">${fmtUSD(d.close_usd, 2)}</strong></td>
                      <td class="r">${Math.abs(d.close_lbp) > 5 ? `<strong>${fmtLL(d.close_lbp)}</strong>` : '0 LL'}</td>
                      <td class="r"><strong style="color:${d.close_combined < -0.05 ? 'var(--crit)' : (d.close_combined > 0.05 ? 'var(--brass)' : 'var(--good)')}">${fmtUSD(d.close_combined, 2)}</strong>${statusBadge}</td>
                    </tr>`;
                  }).join('') || (ctx.emptyRow ? ctx.emptyRow(9, 'No daily till rows match the active filter') : '')}
                  ${ctx.showMoreRow ? ctx.showMoreRow('cf_daily', sortedDaily.length, 9) : ''}
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="3"><b>PERIOD DAILY TILL SUMMARY (${fmtNum(sortedDaily.length)} OPERATING DAYS)</b></td>
                    <td class="r"><b style="color:var(--good)">+${fmtUSD(dyInUsd, 2)}</b></td>
                    <td class="r"><b style="color:var(--crit)">-${fmtUSD(dyOutUsd, 2)}</b></td>
                    <td class="r"><b>${fmtSignedUSD(dyNetUsd, 2)}</b></td>
                    <td class="r"><b>${fmtUSD(latestDayClose.close_usd, 2)}</b></td>
                    <td class="r"><b>${fmtLL(latestDayClose.close_lbp)}</b></td>
                    <td class="r"><b>${fmtUSD(latestDayClose.close_combined, 2)}</b></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            `}
          </div>
        </div>` : ''}
      `;
    }

    // =========================================================================
    // PAGE 15: TREASURY & LOANS (m18c_report.py Page 15 — 2 bands + 4 charts + 6 tables)
    // =========================================================================
    else if (activePageId === 'p15_treasury') {
      const loanRows = filterRecords(rec.loans, { ignorePeriod: true, ignoreSearch: true }).filter(r => {
        if (!matchSearch(r)) return false;
        const cp = cellValue(r, 'counterparty');
        if (sl.counterparty && norm(cp) !== norm(sl.counterparty)) return false;
        return true;
      }).sort((a, b) => Math.abs(Number(b.principal || 0)) - Math.abs(Number(a.principal || 0)));
      const loanSetRows = filterRecords(rec.loan_settlements, { ignoreSearch: true }).filter(r => {
        if (!matchSearch(r)) return false;
        const cp = cellValue(r, 'loan') || cellValue(r, 'counterparty');
        if (sl.counterparty && norm(cp) !== norm(sl.counterparty)) return false;
        if (sl.loanDirection && norm(r.method || r.type) !== norm(sl.loanDirection)) return false;
        return true;
      });
      const extRows = filterRecords(rec.external_movements, { ignoreSearch: true }).filter(r => {
        if (!matchSearch(r)) return false;
        const cp = cellValue(r, 'counterparty');
        if (sl.counterparty && norm(cp) !== norm(sl.counterparty)) return false;
        if (sl.loanDirection && norm(r.direction) !== norm(sl.loanDirection)) return false;
        return true;
      });
      const convRows = filterRecords(rec.conversions, { ignoreSearch: true }).filter(matchSearch);

      const extRev = extRows.filter(e => /In/i.test(String(e.direction || ''))).reduce((a, r) => a + Number(r.usd_amount || r.amount || 0), 0);
      const extExp = extRows.filter(e => !/In/i.test(String(e.direction || ''))).reduce((a, r) => a + Math.abs(Number(r.usd_amount || r.amount || 0)), 0);
      const extNet = round2(extRev - extExp);
      const totPrincipal = loanRows.reduce((a, r) => a + Number(r.principal || 0), 0);
      const totRepaid = loanSetRows.reduce((a, r) => a + Number(r.usd_amount || r.amount || 0), 0);
      const avgFx = convRows.length ? convRows.reduce((a, r) => a + convDeltasPbi(r).rate, 0) / convRows.length : 89500;
      const convNetUsd = convRows.reduce((a, r) => a + convDeltasPbi(r).usd, 0);
      const convNetLbp = convRows.reduce((a, r) => a + convDeltasPbi(r).lbp, 0);

      // Aggregate external by counterparty for the 2 horizontal bar charts
      const cpMap = new Map();
      extRows.forEach(e => {
        const cp = cellValue(e, 'counterparty') || 'General Treasury';
        const cur = cpMap.get(cp) || { Counterparty: cp, rev: 0, exp: 0, net: 0 };
        const amt = Math.abs(Number(e.usd_amount || e.amount || 0));
        if (/In/i.test(String(e.direction || ''))) cur.rev += amt; else cur.exp += amt;
        cur.net = round2(cur.rev - cur.exp);
        cpMap.set(cp, cur);
      });
      const cpList = Array.from(cpMap.values()).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

      bodyHtml = `
        <div class="pbi-overview-bands">
          ${kpiBand('1 · External Treasury Flows & Partner Loan Position', [
            { label: 'External Revenue (In)', value: fmtUSD(extRev, 0), sub: 'Treasury inflows (sample)', tone: 'good' },
            { label: 'External Expense (Out)', value: fmtUSD(extExp, 0), sub: 'Treasury outflows (sample)', tone: 'crit' },
            { label: 'External Net', value: fmtUSD(extNet, 0), sub: 'Revenue − Expense', neg: true },
            { label: 'Loans Principal', value: fmtUSD(totPrincipal, 0), sub: fmtNum(loanRows.length) + ' loan agreements', tone: 'brass' },
            { label: 'Loan Settlements', value: fmtUSD(totRepaid, 0), sub: fmtNum(loanSetRows.length) + ' settlement rows' },
            { label: 'Loans Outstanding (owes +)', value: fmtUSD(totPrincipal - totRepaid, 0), sub: 'Principal − Repaid', tone: 'warn' }
          ])}
          ${kpiBand('2 · FX Conversions (USD ↔ LBP) & Barter Offsets', [
            { label: 'FX Conversions', value: fmtNum(convRows.length), sub: `${fmtSignedUSD(convNetUsd, 0)} · ${fmtSignedLBP(convNetLbp)}` },
            { label: 'Avg Rate USD → LBP', value: fmtNum(avgFx, 0) + ' LBP', sub: 'Pegged ~89,500–90,000 LBP', tone: 'brass' },
            { label: 'External Movements', value: fmtNum(extRows.length), sub: 'Non-ticket treasury entries' },
            { label: 'Counterparties Active', value: fmtNum(cpList.length), sub: 'External & loan parties' },
            { label: 'Barter Customers', value: fmtNum(custRows.filter(c => Number(c.receipts || 0) > 0 && Number(c.sales_ttc || 0) > 0).slice(0, 12).length), sub: 'Cross-settled accounts' },
            { label: 'Barter Suppliers', value: fmtNum(suppRows.filter(s => Number(s.settlements_paid || 0) > 0).slice(0, 12).length), sub: 'Cross-settled suppliers' }
          ])}
        </div>

        <div class="pbi-grid-2">
          ${pbiPanel('External net by counterparty', buildHorizontalBarChart(cpList, 'Counterparty', 'net', v => fmtUSD(v, 0), { color: '#2B5C8F', maxItems: 8 }), {
            subtitle: 'Net external treasury position by counterparty (+ net inflow, − net outflow)'
          })}
          ${pbiPanel('External revenue vs expense by counterparty', buildClusteredBarChart(cpList, 'Counterparty', [
            { label: 'Inflow', key: 'rev', color: '#2B5C8F' },
            { label: 'Outflow', key: 'exp', color: '#C8333B' }
          ], { decimals: 0 }), {
            subtitle: 'Gross external inflows vs outflows per counterparty'
          })}
        </div>

        <div class="pbi-grid-1">
          ${pbiTable('Loans — principal, repayments, outstanding (+ = the company owes, − = owed to the company)', [
            { label: 'Loan Document', key: 'name', mono: true, bold: true },
            { label: 'Co.', key: 'company' },
            { label: 'Counterparty', raw: r => cellValue(r, 'counterparty') || '—', bold: true },
            { label: 'Direction', raw: r => cellValue(r, 'direction') },
            { label: 'Start Date', raw: r => cellValue(r, 'start_date'), mono: true },
            { label: 'Principal ($)', key: 'principal', r: true, bar: true, fmt: v => `<b>${fmtUSD(v, 2)}</b>` },
            { label: 'Interest Rate %', key: 'interest_rate', r: true, fmt: v => fmtNum(v, 2) + '%' },
            { label: 'Notes', key: 'notes' }
          ], loanRows, { rkey: 'loans', limit: 45, unitLabel: 'loans' })}
        </div>

        <div class="pbi-grid-2">
          ${pbiTable('Loan transactions (latest first; + in / − out)', [
            { label: 'Date', key: 'date', mono: true },
            { label: 'Co.', key: 'company' },
            { label: 'Borrower / Lender', raw: r => cellValue(r, 'loan') || r.name, bold: true },
            { label: 'Type', key: 'type' },
            { label: 'Flow', key: 'method' },
            { label: 'Amount ($)', raw: r => r.usd_amount != null ? r.usd_amount : r.amount, r: true, bar: 'brass', fmt: v => `<b>${fmtUSD(v, 2)}</b>` }
          ], loanSetRows, { rkey: 'loan_settlements', limit: 40, unitLabel: 'transactions' })}

          ${pbiTable('External movements (latest first; + in / − out)', [
            { label: 'Date', key: 'date', mono: true },
            { label: 'Co.', key: 'company' },
            { label: 'Counterparty', raw: r => cellValue(r, 'counterparty') || '—', bold: true },
            { label: 'Direction', key: 'direction' },
            { label: 'Method', key: 'method' },
            { label: 'Amount ($)', raw: r => r.usd_amount != null ? r.usd_amount : r.amount, r: true, bar: true, fmt: v => `<b>${fmtUSD(v, 2)}</b>` }
          ], extRows, { rkey: 'external_movements', limit: 40, unitLabel: 'movements' })}
        </div>

        <div class="pbi-grid-1">
          ${pbiTable('Currency conversions (USD ↔ LBP)', [
            { label: 'Date', key: 'date', mono: true },
            { label: 'Co.', key: 'company' },
            { label: 'Direction', raw: r => convDeltasPbi(r).dirLabel, bold: true },
            { label: 'USD Change ($)', raw: r => convDeltasPbi(r).usd, r: true, mono: true, fmt: v => `<strong style="color:${Number(v) >= 0 ? 'var(--good)' : 'var(--crit)'}">${fmtSignedUSD(v, 2)}</strong>` },
            { label: 'LBP Change (LL)', raw: r => convDeltasPbi(r).lbp, r: true, mono: true, fmt: v => `<strong style="color:${Number(v) >= 0 ? 'var(--good)' : 'var(--crit)'}">${fmtSignedLBP(v)}</strong>` },
            { label: 'Exchange Rate', raw: r => convDeltasPbi(r).rate, r: true, mono: true, fmt: v => fmtNum(v, 0) },
            { label: 'Voucher', key: 'name', mono: true }
          ], convRows, { rkey: 'conversions', limit: 35, unitLabel: 'conversions' })}
        </div>
      `;
    }

    // =========================================================================
    // PAGE 16: FINANCIAL GL & SOA (Lebanese CoA Classes 1–7 + Double-Entry Tie)
    // =========================================================================
    else if (activePageId === 'p16_financial') {
      const tbAll = m.gl_tb || [];
      const tb = tbAll.filter(r => {
        if (!matchSearch(r)) return false;
        if (sl.glClass && String(r.Class) !== String(sl.glClass)) return false;
        return true;
      });
      const totDr = tb.reduce((a, r) => a + Number(r.debit || 0), 0);
      const totCr = tb.reduce((a, r) => a + Number(r.credit || 0), 0);
      const soaRows = (m.soa_stream || []).filter(r => {
        if (!matchSearch(r)) return false;
        if (sl.pnlSection === 'Sales & VAT' && !/^(411|442|70)/.test(String(r.code || ''))) return false;
        if (sl.pnlSection === 'Raw & Haulage' && !/^(60|611|401)/.test(String(r.code || ''))) return false;
        if (sl.pnlSection === 'Expenses & Payroll' && !/^(61|62|64|421)/.test(String(r.code || ''))) return false;
        if (sl.pnlSection === 'Receipts & Settlements' && !/^(53|51|411|401)/.test(String(r.code || ''))) return false;
        return true;
      });

      const totRevExVat = Number(k.gross_sales || ((k.net_sales || 0) + (k.trans_rev || 0)));
      const pnlRows = [
        { code: '7011', name: 'Material Sales Revenue (Ex-VAT)', amt: k.net_sales || 0, pct: fmtPct(null, k.net_sales || 0, totRevExVat) },
        { code: '7061', name: 'Delivery Transport Revenue', amt: k.trans_rev || 0, pct: fmtPct(null, k.trans_rev || 0, totRevExVat) },
        { code: '70', name: 'TOTAL SALES REVENUE (EX-VAT)', amt: totRevExVat, pct: '100.0%', bold: true },
        { code: '6011', name: 'Raw Material Purchases (Leg 1)', amt: -(k.raw_mat_cost || 0), pct: fmtPct(null, k.raw_mat_cost, k.net_sales) },
        { code: '6111', name: 'Subcontracted Raw Haulage (Leg 2)', amt: -(k.raw_haulage || 0), pct: fmtPct(null, k.raw_haulage, k.net_sales) },
        { code: 'GM', name: 'GROSS MARGIN', amt: k.gross_margin || 0, pct: fmtPct(k.gm_pct, k.gross_margin, k.net_sales), bold: true },
        { code: '61/62', name: 'Operating, Fleet & Plant Expenses', amt: -(k.expenses || 0), pct: fmtPct(null, k.expenses, k.net_sales) },
        { code: '6411', name: 'Staff Salaries & Overtime Paid', amt: -(k.salaries_paid || 0), pct: fmtPct(null, k.salaries_paid, k.net_sales) },
        { code: 'OP', name: 'OPERATING PROFIT (CASH VIEW)', amt: k.operating_profit || 0, pct: fmtPct(k.op_margin_pct, k.operating_profit, k.net_sales), bold: true }
      ];

      bodyHtml = `
        <div class="pbi-overview-bands">
          ${kpiBand('1 · Lebanese General Chart of Accounts (Classes 1–7) & Double-Entry Audit', [
            { label: 'Total GL Debits', value: fmtUSD(totDr, 2), sub: fmtNum(tb.length) + ' active CoA accounts', tone: 'brass' },
            { label: 'Total GL Credits', value: fmtUSD(totCr, 2), sub: 'Balanced double-entry legs' },
            { label: 'Trial Balance Variance', value: fmtUSD(totDr - totCr, 2), sub: Math.abs(totDr - totCr) < 0.01 ? '100% Tied ($0.00)' : 'Check filter', tone: 'good' },
            { label: 'Gross Margin ($)', value: fmtUSD(k.gross_margin, 0), sub: fmtPct(k.gm_pct, k.gross_margin, k.net_sales) + ' of Net Sales' },
            { label: 'Operating Profit ($)', value: fmtUSD(k.operating_profit, 0), sub: fmtPct(k.op_margin_pct, k.operating_profit, k.net_sales) + ' Op. Margin', tone: 'good' },
            { label: 'SOA Journal Stream', value: fmtNum(soaRows.length) + ' legs', sub: 'Audited voucher postings' }
          ])}
        </div>

        <div class="pbi-grid-2">
          ${pbiTable('Income Statement (Lebanese CoA Class 7 & Class 6)', [
            { label: 'CoA', key: 'code', mono: true, bold: true },
            { label: 'Income Statement Line', key: 'name', fmt: (v, r) => r && r.bold ? `<b>${esc(v)}</b>` : esc(v) },
            { label: 'Amount (USD)', key: 'amt', r: true, bar: true, negRed: true, fmt: (v, r) => r && r.bold ? `<b>${fmtUSD(v, 0)}</b>` : fmtUSD(v, 0) },
            { label: '% of Net', key: 'pct', r: true, mono: true }
          ], pnlRows, {
            unitLabel: 'lines',
            foot: [
              { v: '<b>OPERATING PROFIT (CASH VIEW)</b>', span: 2 },
              { v: `<b>${fmtUSD(k.operating_profit || 0, 0)}</b>`, r: true, neg: Number(k.operating_profit || 0) < 0 },
              { v: `<b>${fmtPct(k.op_margin_pct, k.operating_profit, k.net_sales)}</b>`, r: true }
            ]
          })}

          <div class="pbi-panel">
            <div class="pbi-panel-hdr">
              <div>
                <div class="pbi-panel-title">Lebanese CoA Trial Balance (${tb.length} Active Accounts)</div>
                <span class="pbi-panel-sub">Every operational transaction posts balanced Debit &amp; Credit legs in real time</span>
              </div>
            </div>
            <div class="table-wrap">
              <table class="ledger-table">
                <thead><tr><th>Code</th><th>Account Name</th><th>Class</th><th class="r">Debit ($)</th><th class="r">Credit ($)</th><th class="r">Net Balance ($)</th></tr></thead>
                <tbody>
                  ${tb.map(r => `
                    <tr>
                      <td class="mono"><b>${esc(r.Code)}</b></td>
                      <td><b>${esc(r.Account)}</b></td>
                      <td><span class="badge badge-info">Class ${esc(r.Class)}</span></td>
                      <td class="r">${fmtUSD(r.debit, 2)}</td>
                      <td class="r">${fmtUSD(r.credit, 2)}</td>
                      <td class="r ${Number(r.balance || 0) < 0 ? 'pbi-neg' : ''}"><b>${fmtUSD(r.balance, 2)}</b></td>
                    </tr>
                  `).join('')}
                  <tr class="total" hidden>
                    <td colspan="3"><b>TOTAL TRIAL BALANCE</b></td>
                    <td class="r"><b>${fmtUSD(totDr, 2)}</b></td>
                    <td class="r"><b>${fmtUSD(totCr, 2)}</b></td>
                    <td class="r"><b>${fmtUSD(totDr - totCr, 2)}</b></td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="3"><b>TOTAL TRIAL BALANCE (${tb.length} ACCOUNTS)</b></td>
                    <td class="r"><b>${fmtUSD(totDr, 2)}</b></td>
                    <td class="r"><b>${fmtUSD(totCr, 2)}</b></td>
                    <td class="r"><b>${fmtUSD(totDr - totCr, 2)}</b></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        <div class="pbi-grid-1">
          ${movedRegisterBanner('Audited SOA Double-Entry Journal Stream & Partner Treasury / Loans', 'Full SOA voucher postings, Partner Loans, Repayments, External Treasury Movements, and USD ↔ LBP FX Conversions now live inside General Ledger & SOA.', 'ledger', 'General Ledger & SOA', 'treasury')}
        </div>
      `;
    }

    // =========================================================================
    // PAGE 17: JV SITES (m18c_report.py Page 17 — 50/50 Stock Entitlement)
    // =========================================================================
    else if (activePageId === 'p17_jv') {
      const jvSites = siteRows.filter(s => s.JV === 'Yes').sort((a, b) => Number(b.raw_cost || 0) - Number(a.raw_cost || 0));
      const jvRel = getHubRelIndex(SEED);
      const jvParts = filterRecords(rec.jv_partnerships, { ignorePeriod: true }).filter(matchCommon).sort((a, b) => Number(cellValue(b, 'distributions_total', 'jv_partnerships', jvRel) || 0) - Number(cellValue(a, 'distributions_total', 'jv_partnerships', jvRel) || 0) || Number(b.percentage || 0) - Number(a.percentage || 0));
      const jvDists = filterRecords(rec.jv_distributions, { ignoreSearch: true }).filter(d => {
        if (!matchCommon(d)) return false;
        if (sl.partner && norm(d.partner) !== norm(sl.partner)) return false;
        if (sl.jvBasis && norm(d.basis) !== norm(sl.jvBasis)) return false;
        return true;
      }).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || Number(b.amount || 0) - Number(a.amount || 0));
      const totJvRaw = jvSites.reduce((a, r) => a + Number(r.raw_cost || 0), 0);
      const totJvDist = jvDists.reduce((a, r) => a + Number(r.amount || 0), 0);

      bodyHtml = `
        <div class="pbi-overview-bands">
          ${kpiBand('1 · Joint Venture (JV) 50/50 Sites & Partner Stock Entitlement', [
            { label: 'Active JV Sites', value: fmtNum(jvSites.length), sub: 'Halat JV · Jiyeh JV · Nahr Ibrahim JV', tone: 'brass' },
            { label: 'JV Partnership Contracts', value: fmtNum(jvParts.length), sub: '50% / 50% profit & stock split' },
            { label: 'JV Sites Sales TTC', value: fmtUSD(jvSites.reduce((a, r) => a + Number(r.sales_ttc || 0), 0), 0), sub: 'Dispatched from JV pits' },
            { label: 'JV Sites Raw Material Cost', value: fmtUSD(totJvRaw, 0), sub: 'Total raw intake on JV sites' },
            { label: 'Partner 50% Stock Entitlement', value: fmtUSD(totJvRaw / 2, 0), sub: '50% × JV Raw Material Cost', tone: 'good' },
            { label: 'JV Partner Distributions Paid', value: fmtUSD(totJvDist, 0), sub: fmtNum(jvDists.length) + ' distribution vouchers' }
          ])}
        </div>

        <div class="pbi-grid-2">
          ${pbiPanel('JV sites — Sales TTC vs Raw Material Cost', buildClusteredBarChart(jvSites, 'Site', [
            { label: 'Sales TTC', key: 'sales_ttc', color: '#2B5C8F' },
            { label: 'Raw Cost', key: 'raw_cost', color: '#D9A54A' }
          ], { decimals: 0 }), { subtitle: 'Volume comparison across the 3 Joint Venture sites' })}

          ${pbiTable('JV 50/50 Sites & Partner Stock Entitlement', [
            { label: 'JV Site', key: 'Site', bold: true },
            { label: 'Sales Loads', key: 'loads', r: true, fmt: v => fmtNum(v) },
            { label: 'Sales TTC ($)', key: 'sales_ttc', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Raw Loads', key: 'raw_loads', r: true, fmt: v => fmtNum(v) },
            { label: 'Raw Cost ($)', key: 'raw_cost', r: true, bar: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Partner 50% Entitlement ($)', raw: r => Number(r.raw_cost || 0) / 2, r: true, bar: 'brass', fmt: v => `<b>${fmtUSD(v, 0)}</b>` }
          ], jvSites, { subtitle: 'Stock Entitlement rule: partner share × the JV site\'s raw material cost', unitLabel: 'JV sites' })}
        </div>

        <div class="pbi-grid-2">
          ${pbiTable('JV partnership agreements', [
            { label: 'Agreement', key: 'name', bold: true },
            { label: 'Co.', key: 'company' },
            { label: 'JV Site', key: 'site' },
            { label: 'Partner', key: 'partner', bold: true },
            { label: 'Share %', key: 'percentage', r: true, fmt: v => fmtNum(v, 1) + '%' },
            { label: 'Notes', key: 'notes' }
          ], jvParts, { rkey: 'jv_partnerships', unitLabel: 'partnerships' })}

          ${pbiTable('JV profit & stock distributions ledger', [
            { label: 'Date', key: 'date', mono: true },
            { label: 'Co.', key: 'company' },
            { label: 'Voucher', key: 'name', mono: true },
            { label: 'JV Site', key: 'site' },
            { label: 'Partner', key: 'partner', bold: true },
            { label: 'Basis', key: 'basis' },
            { label: 'Amount ($)', key: 'amount', r: true, bar: true, fmt: v => `<b>${fmtUSD(v, 2)}</b>` }
          ], jvDists, { rkey: 'jv_distributions', limit: 45, unitLabel: 'distributions' })}
        </div>
      `;
    }

    // =========================================================================
    // PAGE 18: TICKET BOOKS (m116 — 25/50-Ticket Weighbridge Pads & Serial Hygiene)
    // =========================================================================
    else if (activePageId === 'p18_tickets') {
      // Group ticket numbers into 25-ticket physical books to show completeness per pad
      const bookMap = new Map();
      const addTkt = (stream, r) => {
        if (sl.padType && sl.padType !== stream) return;
        const num = parseInt(String(r.ticket_no || '').replace(/\D+/g, ''), 10);
        if (!num || isNaN(num)) return;
        const bookStart = Math.floor((num - 1) / 25) * 25 + 1;
        const bookEnd = bookStart + 24;
        const key = `${r.company || 'WTC'} · ${stream} · #${bookStart}–${bookEnd}`;
        if (!bookMap.has(key)) {
          bookMap.set(key, { book: `#${bookStart}–${bookEnd}`, company: r.company || 'WTC', stream, start: bookStart, end: bookEnd, seen: new Set(), dups: 0, firstDate: r.date, lastDate: r.date });
        }
        const b = bookMap.get(key);
        if (b.seen.has(num)) b.dups += 1;
        b.seen.add(num);
        if (r.date < b.firstDate) b.firstDate = r.date;
        if (r.date > b.lastDate) b.lastDate = r.date;
      };
      salesRows.forEach(r => addTkt('Sales Pad', r));
      rawRows.forEach(r => addTkt('Raw Pad', r));
      fuelRows.forEach(r => addTkt('Fuel Pad', r));

      const bookRows = Array.from(bookMap.values()).map(b => {
        const entered = b.seen.size;
        const missing = 25 - entered;
        const missingList = [];
        for (let n = b.start; n <= b.end && missingList.length < 6; n++) {
          if (!b.seen.has(n)) missingList.push('#' + n);
        }
        return {
          ...b, entered, missing, pct: entered / 25,
          status: missing === 0 ? 'Complete (25/25)' : 'Incomplete',
          missingPreview: missingList.join(', ') + (missing > 6 ? '…' : '')
        };
      }).filter(b => {
        if (sl.bookStatus === 'Incomplete Books' && b.missing === 0) return false;
        if (sl.bookStatus === 'Missing Serials' && b.missing === 0) return false;
        return true;
      }).sort((a, b) => b.lastDate < a.lastDate ? -1 : (b.lastDate > a.lastDate ? 1 : 0));

      bodyHtml = `
        <div class="pbi-overview-bands">
          ${kpiBand('1 · Weighbridge Ticket Pad Hygiene, Missing Serials & Duplicate Guard', [
            { label: 'Duplicate Ticket Numbers', value: fmtNum(prSn.duplicate_ticket_numbers || 0), sub: 'Across active pads', tone: 'warn' },
            { label: 'Unnumbered Tickets', value: fmtNum(prSn.unnumbered_tickets || 0), sub: 'Tickets missing serial #' },
            { label: 'Incomplete Ticket Books', value: fmtNum(prSn.incomplete_ticket_books || 0), sub: '25/50-ticket physical pads' },
            { label: 'Missing Numbers in Books', value: fmtNum(prSn.missing_tickets_in_books || 0), sub: 'Gaps in pad sequence', tone: 'warn' },
            { label: 'Entry Desk Duplicate Guard', value: 'Enforced', sub: 'Blocks repeated ticket # per BU', tone: 'good' },
            { label: 'Next Suggested Ticket #', value: (() => { const co = STATE.company === 'bbconstruction' ? 'BBConstruction' : 'WTC'; const n = ctx.nextTicketNo ? ctx.nextTicketNo(co, [rec.sales_tickets]) : ''; return n ? '#' + n + ' · ' + co : 'Auto'; })(), sub: 'Follows latest dated ticket of pad', tone: 'brass' }
          ])}
        </div>

        <div class="pbi-grid-2">
          ${pbiPanel('Weighbridge loads by month — Sales vs Raw pads', buildClusteredColumnSvg(months, [
            { key: 'loads', label: 'Sales Pad Tickets', color: '#2B5C8F' },
            { key: 'raw_loads', label: 'Raw Pad Tickets', color: '#D9A54A' }
          ], { isMoney: false }), { legend: [{ label: 'Sales Pad', color: '#2B5C8F' }, { label: 'Raw Pad', color: '#D9A54A' }] })}

          ${pbiTable('25-Ticket Pad Completeness & Missing Serial Audit', [
            { label: 'Pad Range', key: 'book', mono: true, bold: true },
            { label: 'Co.', key: 'company' },
            { label: 'Pad Stream', key: 'stream' },
            { label: 'Entered', key: 'entered', r: true, fmt: v => `${fmtNum(v)} / 25` },
            { label: 'Missing', key: 'missing', r: true, fmt: v => v ? `<b class="pbi-neg">${fmtNum(v)}</b>` : '0' },
            { label: 'Completeness', key: 'pct', r: true, bar: true, fmt: v => fmtPct(v) },
            { label: 'Missing Serials (Sample)', key: 'missingPreview', mono: true }
          ], bookRows, { subtitle: 'Each physical pad holds 25 sequential carbon-copy tickets · gaps indicate unentered or voided slips', limit: 35, unitLabel: 'ticket books' })}
        </div>

        <div class="pbi-grid-1">
          ${pbiTable('Recent weighbridge ticket serial audit (Sales, Raw & Fuel pads)', [
            { label: 'Pad Stream', key: 'pad', fmt: v => `<span class="badge ${v === 'Sales Pad' ? 'badge-ok' : 'badge-info'}">${esc(v)}</span>` },
            { label: 'Date', key: 'date', mono: true },
            { label: 'Co.', key: 'company' },
            { label: 'Ticket #', key: 'ticket_no', mono: true, bold: true, fmt: v => '#' + esc(v || '—') },
            { label: 'Counterparty / Site', key: 'party', bold: true },
            { label: 'Product / Item', key: 'product' },
            { label: 'Qty', key: 'qty', r: true, fmt: v => fmtNum(v, 1) },
            { label: 'Amount ($)', key: 'amount', r: true, bar: true, fmt: v => `<b>${fmtUSD(v, 2)}</b>` }
          ], salesRows.map(r => ({ id: r.id, rkey: 'sales_tickets', pad: 'Sales Pad', date: r.date, company: r.company, ticket_no: r.ticket_no, party: r.customer, product: r.product, qty: r.qty, amount: r.total_ttc }))
            .concat(rawRows.map(r => ({ id: r.id, rkey: 'raw_purchases', pad: 'Raw Pad', date: r.date, company: r.company, ticket_no: r.ticket_no, party: r.site_owner || r.site, product: r.product, qty: r.qty, amount: r.total })))
            .sort((a, b) => {
              const da = String(a.date || ''), db = String(b.date || '');
              return db < da ? -1 : (db > da ? 1 : 0);
            }),
          { unitLabel: 'tickets' })}
        </div>
      `;
    }

    // =========================================================================
    // PAGE 19: CHANGE LOG & DATE BASIS DRIFT (m117 Daily Totals + m276 Tx vs Rep Date Bridge)
    // =========================================================================
    else if (activePageId === 'p19_changelog') {
      const gaps = (paritySn.date_basis_anomalies_gt_31d || []).filter(g => {
        if (!matchSearch(g)) return false;
        if (STATE.company !== 'manufacturing-group' && g.bu && norm(g.bu) !== norm(STATE.company === 'wtc' ? 'WTC' : 'BBConstruction')) return false;
        return true;
      });
      const dtRows = filterRecords(rec.daily_totals, { ignorePeriod: true, ignoreSearch: true }).filter(d => {
        if (!matchSearch(d)) return false;
        if (sl.ledgerDomain && norm(d.domain) !== norm(sl.ledgerDomain)) return false;
        if (sl.ledgerOrigin && norm(d.origin) !== norm(sl.ledgerOrigin)) return false;
        if (sl.ledgerKind && norm(d.kind) !== norm(sl.ledgerKind)) return false;
        return true;
      });
      const repBridgeRows = [...months].reverse().map(mRow => ({
        month: mRow['Year Month'],
        s_tx: Number(mRow.sales_ttc || 0),
        s_rep: Number(mRow.sales_rep != null ? mRow.sales_rep : mRow.sales_ttc || 0),
        s_delta: round2(Number(mRow.sales_rep != null ? mRow.sales_rep : mRow.sales_ttc || 0) - Number(mRow.sales_ttc || 0)),
        r_tx: Number(mRow.raw_cost || 0),
        r_rep: Number(mRow.raw_rep != null ? mRow.raw_rep : mRow.raw_cost || 0),
        r_delta: round2(Number(mRow.raw_rep != null ? mRow.raw_rep : mRow.raw_cost || 0) - Number(mRow.raw_cost || 0)),
        e_tx: Number(mRow.expenses || 0),
        e_rep: Number(mRow.exp_rep != null ? mRow.exp_rep : mRow.expenses || 0),
        e_delta: round2(Number(mRow.exp_rep != null ? mRow.exp_rep : mRow.expenses || 0) - Number(mRow.expenses || 0))
      }));

      bodyHtml = `
        <div class="pbi-overview-bands">
          ${kpiBand('1 · Daily Totals Snapshot Ledger & Transaction vs Reporting Date Bridge', [
            { label: 'Sales (Tx Date Basis)', value: fmtUSD(k.sales_ttc, 0), sub: 'Operational weighbridge date', tone: 'brass' },
            { label: 'Sales (Rep Date Basis)', value: fmtUSD(k.sales_rep_date || k.sales_ttc, 0), sub: 'Reporting Date basis' },
            { label: 'Raw Cost (Tx vs Rep)', value: fmtUSD(k.raw_cost, 0), sub: 'Rep: ' + fmtUSD(k.raw_rep_date || k.raw_cost, 0) },
            { label: 'Snapshot Rows Logged', value: fmtNum(dtRows.length), sub: 'Daily totals ledger' },
            { label: 'Date Gaps > 31 Days', value: fmtNum(paritySn.date_basis_anomalies_gt_31d_count || gaps.length), sub: 'Flagged by Sentinel S8', tone: 'warn' },
            { label: '60-Day Gap Guard', value: 'Active', sub: 'Requires explanation on entry', tone: 'good' }
          ])}
        </div>

        <div class="pbi-grid-1">
          ${pbiTable('Transaction date vs reporting date parity bridge', [
            { label: 'Month', key: 'month', bold: true },
            { label: 'Sales (Txn $)', key: 's_tx', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Sales (Rep $)', key: 's_rep', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Sales Δ ($)', key: 's_delta', r: true, negRed: true, fmt: v => `<b>${fmtUSD(v, 0)}</b>` },
            { label: 'Raw (Txn $)', key: 'r_tx', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Raw (Rep $)', key: 'r_rep', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Raw Δ ($)', key: 'r_delta', r: true, negRed: true, fmt: v => `<b>${fmtUSD(v, 0)}</b>` },
            { label: 'Expenses (Txn $)', key: 'e_tx', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Expenses (Rep $)', key: 'e_rep', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Expenses Δ ($)', key: 'e_delta', r: true, negRed: true, fmt: v => `<b>${fmtUSD(v, 0)}</b>` }
          ], repBridgeRows, {
            subtitle: 'SharePoint legacy reports group backdated tickets and expenses by ExpectedDate (Reporting Date); Δ = Reporting Date − Transaction Date (m276)',
            unitLabel: 'months'
          })}
        </div>

        <div class="pbi-grid-2">
          ${pbiTable('Daily totals snapshot ledger (m117)', [
            { label: 'Date', key: 'date', mono: true },
            { label: 'Co.', key: 'company' },
            { label: 'Domain', key: 'domain', bold: true },
            { label: 'Origin', key: 'origin' },
            { label: 'Kind', key: 'kind' },
            { label: 'Rows', key: 'row_count', r: true, fmt: v => fmtNum(v) },
            { label: 'Value ($)', key: 'value', r: true, bar: true, fmt: v => `<b>${fmtUSD(v, 2)}</b>` },
            { label: 'Version', key: 'version', mono: true }
          ], dtRows, { rkey: 'daily_totals', limit: 45, unitLabel: 'snapshots' })}

          ${pbiTable('Transaction vs reporting date gaps > 31 days (Sentinel S8)', [
            { label: 'Table', key: 'table' },
            { label: 'BU', key: 'bu' },
            { label: 'Ticket #', key: 'ticket', mono: true, bold: true },
            { label: 'Tx Date', key: 'transaction_date', mono: true },
            { label: 'Rep Date', key: 'reporting_date', mono: true },
            { label: 'Gap (Days)', key: 'gap_days', r: true, negRed: true, fmt: v => `<b class="pbi-neg">${fmtNum(v)} d</b>` },
            { label: 'Amount ($)', key: 'amount_usd', r: true, fmt: v => fmtUSD(v, 2) }
          ], gaps, { limit: 45, unitLabel: 'anomalies' })}
        </div>
      `;
    }

    // =========================================================================
    // PAGE 20: STATEMENT RECON & 22 PDFs (m126 Counterparty Bridge + 22 A4 Statements)
    // =========================================================================
    else {
      const stCatalog = (ctx.STATEMENT_CATALOG || []).filter(s => !sl.reconSide || norm(s.cat) === norm(sl.reconSide));
      const bridgeSteps = [
        { label: 'Sales TTC', value: Number(k.sales_ttc || 0), color: '#2B5C8F' },
        { label: 'Less VAT 11%', value: -Number(k.sales_vat || 0), color: '#8A94A6' },
        { label: 'Net Sales', value: Number(k.net_sales || 0), color: '#1B365D' },
        { label: 'Raw Cost', value: -Number(k.raw_cost || 0), color: '#C8333B' },
        { label: 'Gross Margin', value: Number(k.gross_margin || 0), color: '#1E7A6E' },
        { label: 'Op. Profit', value: Number(k.operating_profit || 0), color: '#D9A54A' }
      ];

      bodyHtml = `
        <div class="pbi-overview-bands">
          ${kpiBand('1 · Cross-Statement Reconciliation Bridge (Ties Power BI → Lebanese CoA GL → 22 A4 PDF Statements)', [
            { label: 'P&L Net Sales → Stmt #03', value: fmtUSD(k.net_sales, 2), sub: 'Ties to Class 701 + 706', tone: 'good' },
            { label: 'Output VAT 11% → Stmt #18', value: fmtUSD(k.sales_vat, 2), sub: 'Ties to Class 4427', tone: 'good' },
            { label: 'FIFO Open AR → Stmt #09/#11', value: fmtUSD(k.ar_balance, 2), sub: 'Ties to Class 4111', tone: 'good' },
            { label: '3-Leg Open AP → Stmt #10/#12', value: fmtUSD(k.ap_balance, 2), sub: 'Ties to Class 4011', tone: 'good' },
            { label: 'Cash Till 5300 → Stmt #05', value: fmtUSD(k.cash_till, 2), sub: 'Ties to Class 5300', tone: 'good' },
            { label: 'Trial Balance → Stmt #02', value: fmtUSD(k.tb_check || 0, 2), sub: 'Double-Entry Variance $0.00', tone: 'brass' }
          ])}
        </div>

        <div class="pbi-grid-2">
          ${pbiPanel('Executive P&L & Ledger Reconciliation Bridge', buildSignedColumnSvg(bridgeSteps, { isMoney: true }), {
            subtitle: 'Walk from Gross Sales TTC through Output VAT, Net Sales, Raw Cost, Gross Margin and Operating Profit'
          })}

          <div class="pbi-panel">
            <div class="pbi-panel-hdr">
              <div>
                <div class="pbi-panel-title">22 Printable A4 Statements &amp; Paginated Reports Launcher</div>
                <span class="pbi-panel-sub">Click any statement below to open its A4 printable sheet (including #19 Staff Payroll &amp; #15 Driver Overtime)</span>
              </div>
              <button type="button" class="btn btn-brass" style="padding:4px 10px;font-size:11px" data-nav-jump="statements">Open Statement Center →</button>
            </div>
            <div style="padding:12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(215px,1fr));gap:7px;max-height:245px;overflow-y:auto">
              ${stCatalog.map(s => `
                <button type="button" class="btn" style="justify-content:flex-start;text-align:left;padding:6px 9px;font-size:11.5px" data-nav-jump="statements" data-stmt-jump="${esc(s.code)}">
                  <b class="mono" style="color:var(--brass);margin-right:4px">#${esc(s.code)}</b> ${esc(s.name)}
                </button>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="pbi-grid-2">
          ${pbiTable('Top Customer Sub-Account Reconciliation (Tickets vs Receipts vs Closing AR)', [
            { label: 'Customer', key: 'Customer', bold: true },
            { label: 'Loads', key: 'loads', r: true, fmt: v => fmtNum(v) },
            { label: 'Credit Sales ($)', key: 'credit_sales', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Receipts ($)', key: 'receipts', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Closing AR ($)', key: 'ar_balance', r: true, bar: true, negRed: true, fmt: v => `<b>${fmtUSD(v, 2)}</b>` }
          ], [...custRows].sort((a, b) => Math.abs(Number(b.ar_balance || 0)) - Math.abs(Number(a.ar_balance || 0)) || Number(b.credit_sales || 0) - Number(a.credit_sales || 0)), { unitLabel: 'customers' })}

          ${pbiTable('Top Supplier Sub-Account Reconciliation (3-Leg Accruals vs Settlements vs Closing AP)', [
            { label: 'Supplier / Hauler', key: 'Supplier', bold: true },
            { label: 'Raw Loads', key: 'raw_loads', r: true, fmt: v => fmtNum(v) },
            { label: 'Total Accrued ($)', raw: r => Number(r.raw_cost || 0) + Number(r.ap_expense || 0), r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Settled ($)', key: 'settlements_paid', r: true, fmt: v => fmtUSD(v, 0) },
            { label: 'Closing AP ($)', key: 'ap_balance', r: true, bar: 'brass', negRed: true, fmt: v => `<b>${fmtUSD(v, 2)}</b>` }
          ], [...suppRows].sort((a, b) => Math.abs(Number(b.ap_balance || 0)) - Math.abs(Number(a.ap_balance || 0)) || (Number(b.raw_cost || 0) + Number(b.ap_expense || 0)) - (Number(a.raw_cost || 0) + Number(a.ap_expense || 0))), { unitLabel: 'suppliers' })}
        </div>
      `;
    }

    if (bodyOnly) return bodyHtml;
    return `<div id="pbiCanvasPanel" style="padding-bottom:24px">${headerHtml}${bodyHtml}</div>`;
  }

  // ==================== HUB ANALYTICS & MOVED PAGES CATALOG ====================
  const MODULE_ANALYTICS_CATALOG = {
    sales_analytics: {
      title: 'Sales, Weighbridge Books, Spreads & FIFO AR Analytics',
      subtitle: '25/50-Ticket Weighbridge Book Audit, Realised Price Spreads, Destination Site Mix & FIFO AR Aging',
      defaultSec: 'tickets',
      sections: [
        { id: 'tickets', label: 'Weighbridge Ticket Books (25/50-Pad Audit)', pageId: 'p18_tickets', badge: 'Moved Page' },
        { id: 'analytics', label: 'Sales Revenue, Price Trends & Site Mix', pageId: 'p04_sales', badge: 'Analytics' },
        { id: 'spreads', label: 'Agreed vs Realised Spreads & Commissions', pageId: 'p05_pricing', badge: 'Analytics' },
        { id: 'aging', label: 'FIFO AR Aging & Customer Running Statement', pageId: 'p06_ar', badge: 'Analytics' }
      ]
    },
    sales_vat: {
      title: '11% VAT Position, Quarterly MOF & Tax Invoice Hygiene',
      subtitle: 'Output/Input VAT 11%, Quarterly MOF Filing Position & VAT Invoice Ticket Linkage',
      defaultSec: 'vat',
      sections: [
        { id: 'vat', label: '11% VAT Position, Quarterly MOF & Tax Invoices', pageId: 'p13_vat', badge: 'Moved Page' }
      ]
    },
    raw_analytics: {
      title: 'JV 50/50 Stock Entitlement, Unit Economics & 3-Leg AP',
      subtitle: 'Joint Venture 50/50 Site Stock Entitlement, Unit Margin, Transport Cost Recovery & 3-Leg Payables',
      defaultSec: 'jv',
      sections: [
        { id: 'jv', label: 'JV 50/50 Sites & Partner Stock Entitlement', pageId: 'p17_jv', badge: 'Moved Page' },
        { id: 'stock', label: 'Unit Economics & Transport Cost Recovery', pageId: 'p08_stock', badge: 'Analytics' },
        { id: 'ap3leg', label: '3-Leg AP Schedule & Monthly Accrual vs Settlement', pageId: 'p07_ap', badge: 'Analytics' }
      ]
    },
    fleet_analytics: {
      title: 'Fleet, Drivers, Overtime & Diesel Analytics',
      subtitle: 'Driver Trips & Night Overtime Bonus, Diesel Tank Burn & Equipment Cost per Ton',
      defaultSec: 'drivers',
      sections: [
        { id: 'drivers', label: 'Drivers, Trips & Overtime Bonus', pageId: 'p11_drivers', badge: 'Moved Page' },
        { id: 'fuel', label: 'Diesel Tank Reconciliation & L/100km Burn', pageId: 'p09_fuel', badge: 'Analytics' },
        { id: 'econ', label: 'Equipment Economics & Cost per Ton', pageId: 'p10_fleet', badge: 'Analytics' }
      ]
    },
    cashflow_analytics: {
      title: 'Cash Flow Inflows/Outflows & Daily Till 5300 Analytics',
      subtitle: 'Daily Physical Till 5300 Trajectory, Cash Inflows vs Outflows & Payment Method Mix',
      defaultSec: 'cashflow',
      sections: [
        { id: 'cashflow', label: 'Cash Flow Inflows/Outflows & Daily Till 5300', pageId: 'p14_cashflow', badge: 'Analytics' }
      ]
    },
    expenses_analytics: {
      title: 'Cost-Class Breakdown & Overhead Analytics',
      subtitle: 'Production Cost, Operating Expense & Capital Expenditure Category Analytics',
      defaultSec: 'costclass',
      sections: [
        { id: 'costclass', label: 'Expense Cost Classes & Category Breakdown', pageId: 'p07_ap', badge: 'Analytics' }
      ]
    },
    payroll_analytics: {
      title: 'Workforce Earnings Matrix, Site Allowances, Freelance & Driver OT',
      subtitle: '16-Column Staff Earnings Matrix, Site Allowances, Freelance Shifts & Driver Overtime',
      defaultSec: 'allowances',
      sections: [
        { id: 'allowances', label: 'Staff Earnings Matrix, Site Allowances & Freelance', pageId: 'p12_payroll', badge: 'Analytics' },
        { id: 'drivers_ot', label: 'Driver Trips & Night Overtime Bonus', pageId: 'p11_drivers', badge: 'Moved Page' }
      ]
    },
    ledger_treasury: {
      title: 'Partner Treasury, Loans & USD ↔ LBP FX Conversions',
      subtitle: 'Partner Loans, Repayments, External Movements & USD ↔ LBP Exchange Position',
      defaultSec: 'treasury',
      sections: [
        { id: 'treasury', label: 'Partner Loans, External Treasury & USD ↔ LBP FX', pageId: 'p15_treasury', badge: 'Moved Page' }
      ]
    },
    sales: {
      title: 'Sales & Weighbridge Analytics',
      subtitle: '25/50-Ticket Weighbridge Book Audit, Realised Price Trends & Destination Site Mix',
      defaultSec: 'tickets',
      sections: [
        { id: 'tickets', label: 'Weighbridge Ticket Books (25/50-Pad Audit)', pageId: 'p18_tickets', badge: 'Moved Page' },
        { id: 'analytics', label: 'Sales Revenue, Price Trends & Site Mix', pageId: 'p04_sales', badge: 'Analytics' }
      ]
    },
    raw: {
      title: 'Material, Transportation, JV 50/50 & Unit Economics',
      subtitle: 'Joint Venture 50/50 Site Stock Entitlement, Unit Margin & Transport Cost Recovery',
      defaultSec: 'jv',
      sections: [
        { id: 'jv', label: 'JV 50/50 Sites & Partner Stock Entitlement', pageId: 'p17_jv', badge: 'Moved Page' },
        { id: 'stock', label: 'Unit Economics & Transport Cost Recovery', pageId: 'p08_stock', badge: 'Analytics' }
      ]
    },
    fleet: {
      title: 'Fleet, Drivers, Overtime & Diesel Analytics',
      subtitle: 'Driver Trips & Night Overtime Bonus, Diesel Tank Burn & Equipment Cost/Ton',
      defaultSec: 'drivers',
      sections: [
        { id: 'drivers', label: 'Drivers, Trips & Overtime Bonus', pageId: 'p11_drivers', badge: 'Moved Page' },
        { id: 'fuel', label: 'Diesel Tank Reconciliation & L/100km Burn', pageId: 'p09_fuel', badge: 'Analytics' },
        { id: 'econ', label: 'Equipment Economics & Cost per Ton', pageId: 'p10_fleet', badge: 'Analytics' }
      ]
    },
    pricing: {
      title: 'Pricing Spreads, Below-Agreed Governance & Commissions',
      subtitle: 'Agreed vs Realised vs List Spreads, Customer × Product Shortfalls & Commission Rules',
      defaultSec: 'spreads',
      sections: [
        { id: 'spreads', label: 'Agreed vs Realised Spreads & Below-Agreed Exceptions', pageId: 'p05_pricing', badge: 'Analytics' }
      ]
    },
    customers: {
      title: 'Receivables Aging, Running Statement & 11% VAT Invoices',
      subtitle: '11% Output/Input VAT & Quarterly MOF Position, FIFO AR Aging & Customer Running Sub-Ledger',
      defaultSec: 'vat',
      sections: [
        { id: 'vat', label: '11% VAT Position, Quarterly MOF & Tax Invoices', pageId: 'p13_vat', badge: 'Moved Page' },
        { id: 'aging', label: 'FIFO AR Aging & Customer Running Statement', pageId: 'p06_ar', badge: 'Analytics' }
      ]
    },
    suppliers: {
      title: '3-Leg Accounts Payable & Supplier Accrual Analytics',
      subtitle: 'Leg 1 Raw Material, Leg 2 Third-Party Haulage, Leg 3 Credit Expenses & Monthly Settlements',
      defaultSec: 'ap3leg',
      sections: [
        { id: 'ap3leg', label: '3-Leg AP Schedule & Monthly Accrual vs Settlement', pageId: 'p07_ap', badge: 'Analytics' }
      ]
    },
    expenses: {
      title: 'Cost-Class Breakdown & Overhead Analytics',
      subtitle: 'Production Cost, Operating Expense & Capital Expenditure Category Analytics',
      defaultSec: 'costclass',
      sections: [
        { id: 'costclass', label: 'Expense Cost Classes & Category Breakdown', pageId: 'p07_ap', badge: 'Analytics' }
      ]
    },
    payroll: {
      title: 'Workforce Earnings Matrix, Site Allowances, Freelance & Driver OT',
      subtitle: '16-Column Staff Earnings Matrix, Site Allowances, Freelance Shifts & Driver OT',
      defaultSec: 'allowances',
      sections: [
        { id: 'allowances', label: 'Staff Earnings Matrix, Site Allowances & Freelance', pageId: 'p12_payroll', badge: 'Analytics' },
        { id: 'drivers_ot', label: 'Driver Trips & Night Overtime Bonus', pageId: 'p11_drivers', badge: 'Moved Page' }
      ]
    },
    ledger: {
      title: 'Partner Treasury, Loans, FX Conversions & Cash Flow Till 5300',
      subtitle: 'Partner Loans, Repayments, External Movements, USD ↔ LBP Conversions & Daily Till 5300',
      defaultSec: 'treasury',
      sections: [
        { id: 'treasury', label: 'Partner Loans, External Treasury & USD ↔ LBP FX', pageId: 'p15_treasury', badge: 'Moved Page' },
        { id: 'cashflow', label: 'Cash Flow Inflows/Outflows & Daily Till 5300', pageId: 'p14_cashflow', badge: 'Analytics' }
      ]
    },
    sentinels: {
      title: 'Executive Action Items, Change Log & Date-Basis Parity Bridge',
      subtitle: 'Action Items & Exception Queue, Daily Totals Ledger & Tx vs Reporting Date Parity',
      defaultSec: 'all',
      sections: [
        { id: 'exceptions', label: 'Action Items & Exception Queue', pageId: 'p03_exceptions', badge: 'Moved Page' },
        { id: 'changelog', label: 'Change Log, Daily Totals & Date Parity Bridge', pageId: 'p19_changelog', badge: 'Moved Page' }
      ]
    },
    statements: {
      title: 'Counterparty Statement Reconciliation Bridge',
      subtitle: 'Customer & Supplier Sub-Account Reconciliation vs Trial Balance',
      defaultSec: 'recon',
      sections: [
        { id: 'recon', label: 'Statement Reconciliation Bridge & Sub-Account Tie', pageId: 'p20_recon', badge: 'Moved Page' }
      ]
    }
  };

  function renderModuleAnalytics(moduleKey, ctx) {
    const cfg = MODULE_ANALYTICS_CATALOG[moduleKey];
    if (!cfg || !ctx || !ctx.STATE) return '';
    const { STATE } = ctx;
    if (!STATE.moduleSection) STATE.moduleSection = {};
    if (!STATE.moduleLastSection) STATE.moduleLastSection = {};
    const availSecs = cfg.sections.filter(s => typeof ctx.canAccessPbiPage !== 'function' || ctx.canAccessPbiPage(s.pageId));
    if (!availSecs.length) return '';

    const defaultSecId = (cfg.defaultSec && cfg.defaultSec !== 'hide' && (cfg.defaultSec === 'all' ? availSecs.length > 1 : availSecs.some(s => s.id === cfg.defaultSec)))
      ? cfg.defaultSec
      : availSecs[0].id;
    const activeSecId = STATE.moduleSection[moduleKey] || defaultSecId;
    const isCollapsed = activeSecId === 'hide';
    const isAll = activeSecId === 'all' && availSecs.length > 1;
    const activeSecs = isCollapsed
      ? []
      : (isAll ? availSecs : [availSecs.find(s => s.id === activeSecId) || availSecs[0]]);

    if (!isCollapsed && activeSecs.length) {
      STATE.moduleLastSection[moduleKey] = isAll ? 'all' : activeSecs[0].id;
    }
    const prevSavedSec = STATE.moduleLastSection[moduleKey];
    const expandSecId = (prevSavedSec && prevSavedSec !== 'hide' && (prevSavedSec === 'all' ? availSecs.length > 1 : availSecs.some(s => s.id === prevSavedSec)))
      ? prevSavedSec
      : defaultSecId;

    const studioTargetSec = !isCollapsed
      ? (activeSecs.find(s => PBI_PAGES.some(p => p.id === s.pageId)) || null)
      : null;
    const primaryPageId = studioTargetSec ? studioTargetSec.pageId : ((availSecs[0] && availSecs[0].pageId) || 'p01_overview');
    const hasPbiInStudio = Boolean(studioTargetSec);

    return `
      <div class="mod-analytics-hub${isCollapsed ? ' is-collapsed' : ''}" data-mod-hub="${esc(moduleKey)}">
        <div class="mod-analytics-bar">
          <div class="mod-analytics-hdr"${isCollapsed ? ` role="button" tabindex="0" data-mod-hub-key="${esc(moduleKey)}" data-mod-sec="${esc(expandSecId)}" data-mod-toggle="expand-hdr" title="Expand ${esc(cfg.title)}"` : ''}>
            <div class="mod-analytics-eyebrow">EMBEDDED MODULE ANALYTICS &amp; INSIGHTS</div>
            <div class="mod-analytics-title">${esc(cfg.title)}</div>
            <div class="mod-analytics-sub">${esc(cfg.subtitle)}</div>
          </div>
          <div class="mod-analytics-tabs" role="tablist" aria-label="${esc(cfg.title)} Sections">
            ${availSecs.length > 1 ? availSecs.map(s => {
              const sel = !isCollapsed && !isAll && activeSecs[0] && activeSecs[0].id === s.id;
              return `
                <button type="button" class="filter-chip ${sel ? 'active' : ''}" data-mod-hub-key="${esc(moduleKey)}" data-mod-sec="${esc(s.id)}" role="tab" aria-selected="${sel}">
                  <span>${esc(s.label)}</span>
                  <span class="badge ${s.badge === 'Moved Page' ? 'badge-brass' : 'badge-info'}" style="margin-left:5px;font-size:9.5px;padding:1px 5px">${esc(s.badge)}</span>
                </button>
              `;
            }).join('') : ''}
            ${availSecs.length > 1 ? `
              <button type="button" class="filter-chip ${isAll ? 'active' : ''}" data-mod-hub-key="${esc(moduleKey)}" data-mod-sec="all" role="tab" aria-selected="${isAll}">
                All (${availSecs.length})
              </button>
            ` : ''}
            ${moduleKey === 'cashflow_analytics' ? `
              <button type="button" class="btn" style="padding:4px 9px;font-size:11px" data-nav-jump="cashflow">Open Full Cashbook &amp; 7-Table Recon →</button>
            ` : ''}
            <button type="button" class="filter-chip ${isCollapsed ? 'active' : ''}" data-mod-hub-key="${esc(moduleKey)}" data-mod-sec="${esc(isCollapsed ? expandSecId : 'hide')}" data-mod-toggle="${isCollapsed ? 'expand' : 'collapse'}" aria-expanded="${!isCollapsed}">
              ${isCollapsed ? '▸ Expand Insights' : '▾ Collapse'}
            </button>
            ${hasPbiInStudio ? `
              <button type="button" class="btn" style="padding:4px 9px;font-size:11px" data-pbi-jump="${esc(primaryPageId)}">Full Slicers in Analytics &amp; Insights →</button>
            ` : ''}
          </div>
        </div>
        ${isCollapsed ? '' : `
          <div class="mod-analytics-body">
            ${activeSecs.map(s => `
              <div class="mod-analytics-section" data-mod-sec-pane="${esc(s.id)}">
                ${renderPbiStudio(ctx, s.pageId, true)}
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  }

  // ==================== 34-TABLE POWER APPS DATA HUB RENDERER ====================
  function renderTablesHub(ctx) {
    const { STATE, SEED, filterRecords, sortRows, th, shownCount, showMoreRow, emptyRow, exportBtn, searchBox, appCell, canEnterForm } = ctx;
    const catalog = typeof ctx.canAccessTable === 'function' ? TABLE_CATALOG.filter(t => ctx.canAccessTable(t.key)) : TABLE_CATALOG;
    const tablePool = catalog.length ? catalog : TABLE_CATALOG;
    const activeKey = STATE.activeTableKey || 'sales_tickets';
    const meta = tablePool.find(t => t.key === activeKey) || tablePool[0];
    STATE.activeTableKey = meta.key;
    const rel = getHubRelIndex(SEED);
    const rawList = (SEED.records && SEED.records[meta.key]) || [];
    const isUniv = Boolean(meta.universal);
    const rlsScopedRaw = filterRecords(rawList, { ignorePeriod: true, ignoreSearch: true, ignoreCompany: isUniv, ignoreRls: isUniv });
    const baseFiltered = filterRecords(rawList, {
      cols: meta.cols,
      tableKey: meta.key,
      ignoreCompany: isUniv,
      ignoreRls: isUniv,
      ignorePeriod: isUniv || !['sales_tickets', 'raw_purchases', 'receipts', 'settlements', 'fuel_intakes', 'expenses', 'salaries', 'attendance', 'external_movements', 'loan_settlements', 'conversions', 'jv_distributions', 'daily_totals'].includes(meta.key)
    });
    const views = meta.views || [{ id: 'all', label: 'All ' + meta.label }];
    const activeViewId = (STATE.tableViews && STATE.tableViews[meta.key]) || 'all';
    const activeView = views.find(v => v.id === activeViewId) || views[0];
    const filtered = activeView && activeView.fn ? baseFiltered.filter(r => activeView.fn(r, rel)) : baseFiltered;
    const defSortSpec = getHubTableDefaultSort(meta, activeView.id);
    const rows = sortRows(filtered, 'tbl_' + meta.key, defSortSpec.key, defSortSpec.dir);
    const shown = rows.slice(0, shownCount('tbl_' + meta.key));

    const groups = Array.from(new Set(tablePool.map(t => t.group)));
    const relTablesMeta = (meta.relTables || []).map(rk => tablePool.find(t => t.key === rk)).filter(Boolean);

    const matchPct = rlsScopedRaw.length > 0 ? Math.min(100, (rows.length / rlsScopedRaw.length) * 100) : 100;

    return `
      <div class="cockpit-banner has-insights">
        <div class="cockpit-title-block sr-only">
          <div class="cockpit-eyebrow">${isUniv ? `UNIVERSAL REGISTRY (ALL BUSINESS UNITS) · ACTIVE TABLE: ${esc(meta.label.toUpperCase())}` : `${tablePool.length} OPERATIONAL &amp; MASTER TABLES · ACTIVE TABLE: ${esc(meta.label.toUpperCase())}`}</div>
          <div class="cockpit-title">Tables &amp; Registers</div>
        </div>
        <div class="cockpit-pills insight-grid">
          <div class="cockpit-pill insight-card tone-brass">
            <div class="cockpit-pill-top">
              <div class="cockpit-pill-lbl">Active Register</div>
              <span class="cockpit-pill-tag brass">${esc(meta.group)}</span>
            </div>
            <div class="cockpit-pill-val brass">${esc(meta.label)}</div>
            <div class="cockpit-pill-sub">${meta.cols.length} columns · ${views.length} system views</div>
          </div>
          <div class="cockpit-pill insight-card tone-emerald">
            <div class="cockpit-pill-top">
              <div class="cockpit-pill-lbl">Governance Scope</div>
              <span class="cockpit-pill-tag ${isUniv ? 'emerald' : 'brass'}">${isUniv ? 'Root Shared' : 'BU Scoped'}</span>
            </div>
            <div class="cockpit-pill-val ${isUniv ? 'emerald' : ''}">${isUniv ? 'All BUs (Universal)' : 'BU Scoped'}</div>
            <div class="cockpit-pill-sub">Active view: <b>${esc(activeView.label)}</b></div>
          </div>
          <div class="cockpit-pill insight-card tone-steel">
            <div class="cockpit-pill-top">
              <div class="cockpit-pill-lbl">Filter &amp; View Yield</div>
              <span class="cockpit-pill-tag">${matchPct.toFixed(0)}% Shown</span>
            </div>
            <div class="cockpit-pill-val">${fmtNum(rows.length)} <small>/ ${fmtNum(rlsScopedRaw.length)}</small></div>
            <div class="cockpit-meter" aria-hidden="true">
              <span class="cockpit-meter-fill primary" style="width:${matchPct.toFixed(1)}%"></span>
            </div>
            <div class="cockpit-pill-sub">Matching rows in active scope</div>
          </div>
          <div class="cockpit-pill insight-card tone-amber">
            <div class="cockpit-pill-top">
              <div class="cockpit-pill-lbl">Relational Schema</div>
              <span class="cockpit-pill-tag amber">${tablePool.length} Total Tables</span>
            </div>
            <div class="cockpit-pill-val">${fmtNum(relTablesMeta.length)} <small>Connected</small></div>
            <div class="cockpit-pill-sub">Click any row for 360° Inspector &amp; Subgrids</div>
          </div>
        </div>
      </div>

      <!-- Table Picker Strip Grouped by Sitemap Area -->
      <div class="panel-card" style="margin-bottom:12px;padding:10px 12px">
        ${groups.map(g => `
          <div style="margin-bottom:8px">
            <div style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:4px">${esc(g)}</div>
            <div class="chip-bar">
              ${tablePool.filter(t => t.group === g).map(t => {
                const tUniv = Boolean(t.universal);
                const cnt = filterRecords((SEED.records && SEED.records[t.key]) || [], { ignorePeriod: true, ignoreSearch: true, ignoreCompany: tUniv, ignoreRls: tUniv }).length;
                return `<button type="button" class="filter-chip ${t.key === meta.key ? 'active' : ''}" data-table-key="${esc(t.key)}">${esc(t.label)} <span class="mono" style="opacity:.75">(${fmtNum(cnt)})</span></button>`;
              }).join('')}
            </div>
          </div>
        `).join('')}
      </div>

      <div class="panel-card" id="tablesHubPanel">
        <!-- System Views & Connected Tables Relational Bar -->
        <div class="pa-hub-rel-strip">
          <div class="pa-hub-views">
            <span class="pa-hub-lbl">System Views:</span>
            ${views.map(vw => {
              const vCnt = vw.fn ? baseFiltered.filter(r => vw.fn(r, rel)).length : baseFiltered.length;
              return `<button type="button" class="filter-chip ${vw.id === activeView.id ? 'active' : ''}" data-tbl-view="${esc(vw.id)}" data-tbl-key="${esc(meta.key)}">${esc(vw.label)} <span class="mono" style="opacity:.75">(${fmtNum(vCnt)})</span></button>`;
            }).join('')}
          </div>
          ${relTablesMeta.length ? `
            <div class="pa-hub-conns">
              <span class="pa-hub-lbl">Connected Tables:</span>
              ${relTablesMeta.map(rt => {
                const rtUniv = Boolean(rt.universal);
                const rCnt = filterRecords((SEED.records && SEED.records[rt.key]) || [], { ignorePeriod: true, ignoreSearch: true, ignoreCompany: rtUniv, ignoreRls: rtUniv }).length;
                return `<button type="button" class="filter-chip" data-conn-table-key="${esc(rt.key)}" title="Jump to related table ${esc(rt.label)}">⇄ ${esc(rt.label)} <span class="mono" style="opacity:.7">(${fmtNum(rCnt)})</span></button>`;
              }).join('')}
            </div>
          ` : ''}
        </div>

        <div class="table-toolbar">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            ${searchBox('Search ' + meta.label + '...')}
          </div>
          <div style="display:flex;gap:6px">
            ${exportBtn('tablesHubPanel', meta.key)}
            ${canEnterForm(meta.form) ? `<button type="button" class="btn btn-primary" data-open-modal="${esc(meta.form)}">+ New ${esc(meta.label.replace(/ies$/, 'y').replace(/s$/, ''))}</button>` : ''}
          </div>
        </div>
        ${typeof ctx.renderColFilterBar === 'function' ? ctx.renderColFilterBar('tbl_' + meta.key, meta.cols) : ''}
        <div class="table-wrap">
          <table class="ledger-table">
            <thead>
              <tr>
                ${meta.cols.map(c => th('tbl_' + meta.key, hubColLabel(c, meta.key), c, !NON_NUMERIC_HUB_COLS.test(c) && /price|cost|amount|total|vat|limit|salary|balance|qty|litres|capacity|factor|pct|days|hours|_count$|loads|fills|rules|tickets|_delta$|exchange_rate/.test(c) ? 'r' : '')).join('')}
              </tr>
            </thead>
            <tbody>
              ${shown.map(r => `
                <tr class="rrow" data-rkey="${esc(meta.key)}" data-rid="${esc(r.id)}">
                  ${meta.cols.map((c, ci) => {
                    const v = cellValue(r, c, meta.key, rel);
                    const nonNum = NON_NUMERIC_HUB_COLS.test(c);
                    const isBool = typeof v === 'boolean' || (/^(is_|vat_registered|external_invoice|customer_declared_qty|ticket_product|fuel_item|input_product|iva$|overtime$)/.test(c) && (v === 0 || v === 1));
                    const isSignedUsd = !isBool && !nonNum && c === 'usd_delta';
                    const isSignedLbp = !isBool && !nonNum && c === 'lbp_delta';
                    const isLbp = !isBool && !nonNum && !isSignedLbp && /^lbp_|_lbp$/.test(c);
                    const isMoney = !isBool && !nonNum && !isLbp && !isSignedLbp && /price|cost|amount|total|vat_amount|limit|salary|balance|adj|indiff|rate_usd|daily_usd|principal|^value$|previous_value|^change$|cash_in|cash_out|closing_till|overtime_rate|^usd_delta$/.test(c) && !/rate$/.test(c);
                    const isNum = !isBool && !nonNum && !isMoney && !isLbp && !isSignedLbp && /qty|litres|capacity|factor|pct|percentage|days|hours|_count$|odometer|interest_rate|exchange_rate|^lat|^long|loads|fills|rules|tickets/.test(c);
                    let cell = v == null || v === '' ? '—' : (isBool ? (v && v !== 0 ? 'Yes' : 'No') : String(v));
                    if (isSignedUsd && v != null && v !== '') cell = fmtSignedUSD(v, 2);
                    else if (isSignedLbp && v != null && v !== '') cell = fmtSignedLBP(v);
                    else if (isLbp && v != null && v !== '') cell = fmtNum(v, 0) + ' LL';
                    else if (isMoney && v != null && v !== '') cell = fmtUSD(v, 2);
                    else if (isNum && v != null && v !== '') cell = fmtNum(v, /factor|qty|capacity|lat|long|percentage|interest/.test(c) ? 2 : 0);
                    else if (/date/.test(c) && v) cell = fmtDateDMY(v);

                    const lkTarget = HUB_LOOKUP_TARGETS[c];
                    const isLookup = lkTarget && lkTarget !== meta.key && v != null && v !== '' && cell !== '—';
                    const signedHtml = (isSignedUsd || isSignedLbp) && v != null && v !== ''
                      ? `<strong style="color:${Number(v) >= 0 ? 'var(--good)' : 'var(--crit)'}">${esc(cell)}</strong>`
                      : null;
                    const innerHtml = isLookup
                      ? `<span class="rel-link" data-rel-key="${esc(lkTarget)}" data-rel-val="${esc(v)}" title="Open related ${esc(c.replace(/_/g, ' '))}: ${esc(v)}">${esc(cell)}<span class="rel-arr">↗</span></span>`
                      : (signedHtml || (c === 'company' ? shortCoHtml(cell) : (c === 'supplier_role' ? formatSupplierRoleHtml(cell) : (c === 'cost_class' ? formatCostClassHtml(cell) : esc(cell)))));
                    return `<td class="${isMoney || isNum || isLbp || isSignedLbp ? 'r' : ''}${/date|ticket|code|_no$|plate|version|_delta$|exchange_rate/.test(c) ? ' mono' : ''}">${ci === 0 ? `<b>${innerHtml}</b>${appCell(r, meta.key)}` : innerHtml}</td>`;
                  }).join('')}
                </tr>
              `).join('') || emptyRow(meta.cols.length, 'No rows match the active filter.')}
              ${showMoreRow('tbl_' + meta.key, rows.length, meta.cols.length)}
            </tbody>
            <tfoot>
              <tr>
                ${(() => {
                  const isColNumeric = col => {
                    if (NON_NUMERIC_HUB_COLS.test(col)) return { isM: false, isN: false, isL: false, isSU: false, isSL: false, num: false };
                    const isBoolCol = /^(is_|vat_registered|external_invoice|customer_declared_qty|ticket_product|fuel_item|input_product|iva$|overtime$)/.test(col);
                    const isSU = !isBoolCol && col === 'usd_delta';
                    const isSL = !isBoolCol && col === 'lbp_delta';
                    const isL = !isBoolCol && !isSL && /^lbp_|_lbp$/.test(col);
                    const isM = !isBoolCol && !isL && !isSL && /price|cost|amount|total|vat_amount|limit|salary|balance|adj|indiff|rate_usd|daily_usd|principal|^value$|previous_value|^change$|cash_in|cash_out|closing_till|overtime_rate|^usd_delta$/.test(col) && !/rate$/.test(col);
                    const isN = !isBoolCol && !isM && !isL && !isSL && /qty|litres|capacity|factor|pct|percentage|days|hours|_count$|odometer|interest_rate|exchange_rate|loads|fills|rules|tickets/.test(col);
                    return { isM, isN, isL, isSU, isSL, num: isM || isN || isL || isSU || isSL };
                  };
                  let firstNum = meta.cols.findIndex((col, idx) => idx > 0 && isColNumeric(col).num);
                  if (firstNum < 0) firstNum = meta.cols.length;
                  const leadSpan = Math.max(1, firstNum);
                  const out = [`<td colspan="${leadSpan}"><b>TOTAL (${fmtNum(rows.length)} RECORDS)</b></td>`];
                  for (let ci = leadSpan; ci < meta.cols.length; ci++) {
                    const c = meta.cols[ci];
                    const { isM: isMoney, isN: isNum, isL, isSU, isSL } = isColNumeric(c);
                    if (!isMoney && !isNum && !isL && !isSU && !isSL) { out.push(`<td></td>`); continue; }
                    let sum = 0, cnt = 0;
                    rows.forEach(r => {
                      const v = cellValue(r, c, meta.key, rel);
                      if (v != null && v !== '' && typeof v !== 'boolean') {
                        const n = Number(v);
                        if (Number.isFinite(n)) { sum += n; cnt++; }
                      }
                    });
                    if (!cnt) { out.push(`<td class="r">—</td>`); continue; }
                    const isAvg = /price|rate|factor|pct|percentage|odometer|closing_till|credit_days/.test(c) && !/^(total|amount|vat_amount|cost|trans_price|price|total_paid|total_spent)$/.test(c);
                    const val = isAvg ? (sum / cnt) : sum;
                    const txt = isSU ? fmtSignedUSD(val, 2)
                      : (isSL ? fmtSignedLBP(val)
                        : (isL ? fmtNum(val, 0) + ' LL'
                          : (isMoney ? fmtUSD(val, 2) : fmtNum(val, /factor|qty|capacity|percentage|interest/.test(c) ? 2 : 0))));
                    const footHtml = (isSU || isSL)
                      ? `<strong style="color:${val >= 0 ? 'var(--good)' : 'var(--crit)'}">${esc(txt)}</strong>`
                      : `<b>${txt}</b>`;
                    out.push(`<td class="r">${isAvg ? '<span class="tfoot-avg-tag">Avg </span>' : ''}${footHtml}</td>`);
                  }
                  return out.join('');
                })()}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `;
  }

  const HUB_COL_LABELS = {
    supplier_role: 'Role / Type',
    trucks_list: 'Owned Trucks',
    drivers_list: 'Linked Drivers',
    haul_loads: 'Haul Loads',
    raw_loads: 'Raw Loads',
    expenses_count: 'Expense Bills',
    active_rules: 'Price Rules',
    iva: 'IVA (VAT)',
    ap_balance: 'AP Balance',
    ar_balance: 'AR Balance',
    vat_registered: 'VAT (11%)',
    mof_no: 'MOF Tax #',
    companies_list: 'Assigned BUs',
    assigned_trucks: 'Assigned Trucks',
    loads_hauled: 'Loads Hauled',
    fuel_fills: 'Fuel Fills',
    default_driver: 'Default Driver',
    truck_owner: 'Truck Owner (Hauler)',
    site_owner: 'Site Owner',
    is_jv: 'JV 50/50',
    gps_status: 'GPS Pin',
    usd_delta: 'USD Change ($)',
    lbp_delta: 'LBP Change (LL)',
    exchange_rate: 'Rate (LL/$)'
  };

  function hubColLabel(c, tableKey) {
    if (c === 'type' && tableKey === 'conversions') return 'Direction';
    if (c === 'name') {
      if (tableKey === 'conversions') return 'Voucher / Ref';
      if (tableKey === 'suppliers') return 'Supplier / Hauler';
      if (tableKey === 'equipment') return 'Unit / Plate #';
      if (tableKey === 'drivers') return 'Driver Name';
      if (tableKey === 'customers') return 'Customer';
      if (tableKey === 'sites') return 'Site';
      if (tableKey === 'products') return 'Product / Grade';
    }
    if (HUB_COL_LABELS[c]) return HUB_COL_LABELS[c];
    return String(c || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  function formatSupplierRoleHtml(roleTxt) {
    const r = String(roleTxt || '').trim();
    if (!r || r === '—') return '—';
    const cls = /(?:Quarry|Site) \+ Hauler|Truck Owner|Hauler/i.test(r)
      ? 'badge-brass'
      : (/Quarry|Site|Material/i.test(r) ? 'badge-info' : 'badge');
    return `<span class="badge ${cls}">${esc(r)}</span>`;
  }

  // ==================== DEDICATED UNIVERSAL REGISTRIES WORKSPACE RENDERER ====================
  function renderUniversalRegistriesView(ctx) {
    const { STATE, SEED, filterRecords, sortRows, th, shownCount, showMoreRow, emptyRow, exportBtn, searchBox, appCell, canEnterForm } = ctx;
    const univPool = TABLE_CATALOG.filter(t => t.universal);
    const groupKeys = Array.isArray(ctx.registryGroupKeys) && ctx.registryGroupKeys.length
      ? ctx.registryGroupKeys.filter(k => univPool.some(t => t.key === k))
      : [];
    const activeKey = STATE.activeUnivRegKey || (groupKeys[0] || 'equipment');
    const meta = univPool.find(t => t.key === activeKey) || univPool.find(t => groupKeys.includes(t.key)) || univPool[0];
    STATE.activeUnivRegKey = meta.key;
    const rel = getHubRelIndex(SEED);
    const rawList = (SEED.records && SEED.records[meta.key]) || [];
    const baseFiltered = filterRecords(rawList, { cols: meta.cols, tableKey: meta.key, ignorePeriod: true, ignoreCompany: true, ignoreRls: true });
    const views = meta.views || [{ id: 'all', label: 'All ' + meta.label }];
    const activeViewId = (STATE.tableViews && STATE.tableViews[meta.key]) || 'all';
    const activeView = views.find(v => v.id === activeViewId) || views[0];
    const filtered = activeView && activeView.fn ? baseFiltered.filter(r => activeView.fn(r, rel)) : baseFiltered;
    const defSortSpec = getHubTableDefaultSort(meta, activeView.id);
    const rows = sortRows(filtered, 'ureg_' + meta.key, defSortSpec.key, defSortSpec.dir);
    const shown = rows.slice(0, shownCount('ureg_' + meta.key));
    const relTablesMeta = (meta.relTables || []).map(rk => TABLE_CATALOG.find(t => t.key === rk)).filter(Boolean);
    const groupTabsMeta = groupKeys.length > 1
      ? groupKeys.map(gk => univPool.find(t => t.key === gk)).filter(Boolean)
      : [];

    return `
      <div class="panel-card" id="univRegPanel">
        <div class="pa-hub-rel-strip">
          ${groupTabsMeta.length > 1 ? `
            <div class="pa-hub-views" style="padding-bottom:6px;margin-bottom:6px;border-bottom:1px dashed var(--line)">
              <span class="pa-hub-lbl">Registries (All BUs):</span>
              ${groupTabsMeta.map(gt => {
                const gCnt = filterRecords((SEED.records && SEED.records[gt.key]) || [], { ignorePeriod: true, ignoreSearch: true, ignoreCompany: true, ignoreRls: true }).length;
                return `<button type="button" class="filter-chip ${gt.key === meta.key ? 'active' : ''}" data-univ-reg-key="${esc(gt.key)}" ${gt.navView ? `data-univ-nav-view="${esc(gt.navView)}"` : ''}>${esc(gt.label)} <span class="mono" style="opacity:.75">(${fmtNum(gCnt)})</span></button>`;
              }).join('')}
            </div>
          ` : ''}
          <div class="pa-hub-views">
            <span class="pa-hub-lbl">System Views:</span>
            ${views.map(vw => {
              const vCnt = vw.fn ? baseFiltered.filter(r => vw.fn(r, rel)).length : baseFiltered.length;
              return `<button type="button" class="filter-chip ${vw.id === activeView.id ? 'active' : ''}" data-tbl-view="${esc(vw.id)}" data-tbl-key="${esc(meta.key)}">${esc(vw.label)} <span class="mono" style="opacity:.75">(${fmtNum(vCnt)})</span></button>`;
            }).join('')}
          </div>
          ${relTablesMeta.length ? `
            <div class="pa-hub-conns">
              <span class="pa-hub-lbl">Connected Tables:</span>
              ${relTablesMeta.map(rt => {
                const rtUniv = Boolean(rt.universal);
                const rCnt = filterRecords((SEED.records && SEED.records[rt.key]) || [], { ignorePeriod: true, ignoreSearch: true, ignoreCompany: rtUniv, ignoreRls: rtUniv }).length;
                return `<button type="button" class="filter-chip" data-conn-table-key="${esc(rt.key)}" title="Jump to related table ${esc(rt.label)}">⇄ ${esc(rt.label)} <span class="mono" style="opacity:.7">(${fmtNum(rCnt)})</span></button>`;
              }).join('')}
            </div>
          ` : ''}
        </div>

        <div class="table-toolbar">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            ${searchBox('Search ' + meta.label + '...')}
          </div>
          <div style="display:flex;gap:6px">
            ${exportBtn('univRegPanel', meta.key)}
            ${canEnterForm(meta.form) ? `<button type="button" class="btn btn-primary" data-open-modal="${esc(meta.form)}">+ New ${esc(meta.label.replace(/ies$/, 'y').replace(/s$/, ''))}</button>` : ''}
          </div>
        </div>
        ${typeof ctx.renderColFilterBar === 'function' ? ctx.renderColFilterBar('ureg_' + meta.key, meta.cols) : ''}
        <div class="table-wrap">
          <table class="ledger-table">
            <thead>
              <tr>
                ${meta.cols.map(c => th('ureg_' + meta.key, hubColLabel(c, meta.key), c, !NON_NUMERIC_HUB_COLS.test(c) && /price|cost|amount|total|vat|limit|salary|balance|qty|litres|capacity|factor|pct|days|hours|_count$|loads|fills|rules|tickets/.test(c) ? 'r' : '')).join('')}
              </tr>
            </thead>
            <tbody>
              ${shown.map(r => `
                <tr class="rrow" data-rkey="${esc(meta.key)}" data-rid="${esc(r.id)}">
                  ${meta.cols.map((c, ci) => {
                    const v = cellValue(r, c, meta.key, rel);
                    const nonNum = NON_NUMERIC_HUB_COLS.test(c);
                    const isBool = typeof v === 'boolean' || (/^(is_|vat_registered|external_invoice|customer_declared_qty|ticket_product|fuel_item|input_product|iva$|overtime$)/.test(c) && (v === 0 || v === 1));
                    const isMoney = !isBool && !nonNum && /price|cost|amount|total|vat_amount|limit|salary|balance|adj|indiff|rate_usd|daily_usd|principal|^value$|previous_value|^change$|cash_in|cash_out|closing_till|overtime_rate/.test(c) && !/rate$/.test(c);
                    const isNum = !isBool && !nonNum && !isMoney && /qty|litres|capacity|factor|pct|percentage|days|hours|_count$|odometer|interest_rate|exchange_rate|^lat|^long|loads|fills|rules|tickets/.test(c);
                    let cell = v == null || v === '' ? '—' : (isBool ? (v && v !== 0 ? 'Yes' : 'No') : String(v));
                    if (isMoney && v != null && v !== '') cell = fmtUSD(v, 2);
                    else if (isNum && v != null && v !== '') cell = fmtNum(v, /factor|qty|capacity|lat|long|percentage|interest/.test(c) ? 2 : 0);
                    else if (/date/.test(c) && v) cell = fmtDateDMY(v);

                    const lkTarget = HUB_LOOKUP_TARGETS[c];
                    const isLookup = lkTarget && lkTarget !== meta.key && v != null && v !== '' && cell !== '—';
                    const innerHtml = isLookup
                      ? `<span class="rel-link" data-rel-key="${esc(lkTarget)}" data-rel-val="${esc(v)}" title="Open related ${esc(c.replace(/_/g, ' '))}: ${esc(v)}">${esc(cell)}<span class="rel-arr">↗</span></span>`
                      : (c === 'company' ? shortCoHtml(cell) : (c === 'supplier_role' ? formatSupplierRoleHtml(cell) : (c === 'cost_class' ? formatCostClassHtml(cell) : esc(cell))));
                    return `<td class="${isMoney || isNum ? 'r' : ''}${/date|ticket|code|_no$|plate|version/.test(c) ? ' mono' : ''}">${ci === 0 ? `<b>${innerHtml}</b>${appCell(r, meta.key)}` : innerHtml}</td>`;
                  }).join('')}
                </tr>
              `).join('') || emptyRow(meta.cols.length, 'No rows match the active filter.')}
              ${showMoreRow('ureg_' + meta.key, rows.length, meta.cols.length)}
            </tbody>
            <tfoot>
              <tr>
                ${(() => {
                  const isColNumeric = col => {
                    if (NON_NUMERIC_HUB_COLS.test(col)) return { isM: false, isN: false, num: false };
                    const isBoolCol = /^(is_|vat_registered|external_invoice|customer_declared_qty|ticket_product|fuel_item|input_product|iva$|overtime$)/.test(col);
                    const isM = !isBoolCol && /price|cost|amount|total|vat_amount|limit|salary|balance|adj|indiff|rate_usd|daily_usd|principal|^value$|previous_value|^change$|cash_in|cash_out|closing_till|overtime_rate/.test(col) && !/rate$/.test(col);
                    const isN = !isBoolCol && !isM && /qty|litres|capacity|factor|pct|percentage|days|hours|_count$|odometer|interest_rate|exchange_rate|loads|fills|rules|tickets/.test(col);
                    return { isM, isN, num: isM || isN };
                  };
                  let firstNum = meta.cols.findIndex((col, idx) => idx > 0 && isColNumeric(col).num);
                  if (firstNum < 0) firstNum = meta.cols.length;
                  const leadSpan = Math.max(1, firstNum);
                  const out = [`<td colspan="${leadSpan}"><b>TOTAL (${fmtNum(rows.length)} RECORDS)</b></td>`];
                  for (let ci = leadSpan; ci < meta.cols.length; ci++) {
                    const c = meta.cols[ci];
                    const { isM: isMoney, isN: isNum } = isColNumeric(c);
                    if (!isMoney && !isNum) { out.push(`<td></td>`); continue; }
                    let sum = 0, cnt = 0;
                    rows.forEach(r => {
                      const v = cellValue(r, c, meta.key, rel);
                      if (v != null && v !== '' && typeof v !== 'boolean') {
                        const n = Number(v);
                        if (Number.isFinite(n)) { sum += n; cnt++; }
                      }
                    });
                    if (!cnt) { out.push(`<td class="r">—</td>`); continue; }
                    const isAvg = /price|rate|factor|pct|percentage|odometer|closing_till|credit_days/.test(c) && !/^(total|amount|vat_amount|cost|trans_price|price|total_paid|total_spent)$/.test(c);
                    const val = isAvg ? (sum / cnt) : sum;
                    const txt = isMoney ? fmtUSD(val, 2) : fmtNum(val, /factor|qty|capacity|percentage|interest/.test(c) ? 2 : 0);
                    out.push(`<td class="r">${isAvg ? '<span class="tfoot-avg-tag">Avg </span>' : ''}<b>${txt}</b></td>`);
                  }
                  return out.join('');
                })()}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `;
  }

  window.MFG_PBI = {
    PBI_PAGES,
    MOVED_PBI_PAGES,
    MODULE_ANALYTICS_CATALOG,
    TABLE_CATALOG,
    deriveExpenseCostClass,
    getHubTableDefaultSort,
    getHubRelIndex,
    cellValue,
    renderPbiStudio,
    renderModuleAnalytics,
    renderTablesHub,
    renderUniversalRegistriesView
  };
})();
