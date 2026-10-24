/* ============================================================================
 * ISABI Systems — Rev 10 "Ledger" Institutional Vector Icon System (js/icons.js)
 * Uniform 24x24 geometric stroke icons (stroke="currentColor", 100% offline).
 * Replaces inconsistent OS cartoon emojis & broken monochrome Unicode dingbats.
 * ============================================================================ */
(function () {
  'use strict';

  function s(inner, vb) {
    return '<svg class="ic" viewBox="' + (vb || '0 0 24 24') + '" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  }

  const ICONS = {
    // ---- Executive & Governance ----
    overview: s('<rect x="3" y="3" width="7.5" height="8.5" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="5" rx="1.6"/><rect x="13.5" y="11" width="7.5" height="10" rx="1.6"/><rect x="3" y="14.5" width="7.5" height="6.5" rx="1.6"/>'),
    entities: s('<rect x="3" y="4" width="8" height="16" rx="1.4"/><rect x="13" y="8" width="8" height="12" rx="1.4"/><line x1="6" y1="8" x2="8" y2="8"/><line x1="6" y1="12" x2="8" y2="12"/><line x1="16" y1="12" x2="18" y2="12"/>'),
    pbi: s('<rect x="3.5" y="13" width="4.2" height="8" rx="1"/><rect x="9.9" y="8" width="4.2" height="13" rx="1"/><rect x="16.3" y="3" width="4.2" height="18" rx="1"/>'),
    tables: s('<rect x="3" y="3.5" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="14.8" x2="21" y2="14.8"/><line x1="9.2" y1="9" x2="9.2" y2="20.5"/>'),
    sentinels: s('<path d="M12 21.5s7.5-3.8 7.5-9.5V5.4L12 2.5 4.5 5.4V12c0 5.7 7.5 9.5 7.5 9.5z"/><path d="m8.8 12 2.2 2.2 4.4-4.5"/>'),
    statements: s('<path d="M14 2.5H6.5A2 2 0 0 0 4.5 4.5v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8z"/><polyline points="14 2.5 14 8 19.5 8"/><line x1="8.2" y1="12.5" x2="15.8" y2="12.5"/><line x1="8.2" y1="16.5" x2="13.8" y2="16.5"/>'),
    users: s('<path d="M16 21v-1.8a3.8 3.8 0 0 0-3.8-3.8H6.8A3.8 3.8 0 0 0 3 19.2V21"/><circle cx="9.5" cy="7.5" r="3.6"/><path d="M19 8v6"/><path d="M22 11h-6"/>'),
    showcase: s('<line x1="19" y1="12" x2="5" y2="12"/><polyline points="11 18 5 12 11 6"/>'),
    sales_vat: s('<path d="M5.5 3h13v18l-2.2-1.6-2.1 1.6-2.2-1.6-2.2 1.6-2.1-1.6L5.5 21V3z"/><line x1="9" y1="9" x2="15" y2="15"/><circle cx="9.5" cy="9.5" r="1"/><circle cx="14.5" cy="14.5" r="1"/>'),
    sales_analytics: s('<rect x="3.5" y="13" width="4.2" height="8" rx="1"/><rect x="9.9" y="8" width="4.2" height="13" rx="1"/><rect x="16.3" y="3" width="4.2" height="18" rx="1"/>'),
    raw_analytics: s('<rect x="3.5" y="13" width="4.2" height="8" rx="1"/><rect x="9.9" y="8" width="4.2" height="13" rx="1"/><rect x="16.3" y="3" width="4.2" height="18" rx="1"/>'),
    fleet_analytics: s('<rect x="3.5" y="13" width="4.2" height="8" rx="1"/><rect x="9.9" y="8" width="4.2" height="13" rx="1"/><rect x="16.3" y="3" width="4.2" height="18" rx="1"/>'),
    cashflow_analytics: s('<rect x="3.5" y="13" width="4.2" height="8" rx="1"/><rect x="9.9" y="8" width="4.2" height="13" rx="1"/><rect x="16.3" y="3" width="4.2" height="18" rx="1"/>'),
    expenses_analytics: s('<rect x="3.5" y="13" width="4.2" height="8" rx="1"/><rect x="9.9" y="8" width="4.2" height="13" rx="1"/><rect x="16.3" y="3" width="4.2" height="18" rx="1"/>'),
    payroll_attendance: s('<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/>'),
    payroll_contracts: s('<path d="M14 2.5H6.5A2 2 0 0 0 4.5 4.5v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8z"/><polyline points="14 2.5 14 8 19.5 8"/><path d="m9 14.5 2 2 4-4"/>'),
    payroll_analytics: s('<rect x="3.5" y="13" width="4.2" height="8" rx="1"/><rect x="9.9" y="8" width="4.2" height="13" rx="1"/><rect x="16.3" y="3" width="4.2" height="18" rx="1"/>'),
    ledger_treasury: s('<polyline points="17 2.5 21 6.5 17 10.5"/><line x1="3" y1="6.5" x2="21" y2="6.5"/><polyline points="7 21.5 3 17.5 7 13.5"/><line x1="21" y1="17.5" x2="3" y2="17.5"/>'),

    // ---- Plant, Dispatch & Kiosks ----
    sales: s('<rect x="1.8" y="5" width="12.7" height="11" rx="1.5"/><path d="M14.5 8.5h4.2l3.1 3.6V16h-7.3V8.5z"/><circle cx="6.2" cy="18" r="2.2"/><circle cx="18" cy="18" r="2.2"/>'),
    truck: s('<rect x="1.8" y="5" width="12.7" height="11" rx="1.5"/><path d="M14.5 8.5h4.2l3.1 3.6V16h-7.3V8.5z"/><circle cx="6.2" cy="18" r="2.2"/><circle cx="18" cy="18" r="2.2"/>'),
    hauler: s('<path d="M2 16V8.5l2.5-2.5h8.5v10H2z"/><path d="M13 9.5h4.5l3.5 3.5V16h-8V9.5z"/><circle cx="6" cy="18" r="2.1"/><circle cx="10.5" cy="18" r="2.1"/><circle cx="18" cy="18" r="2.1"/>'),
    raw: s('<path d="m2.5 19.5 6.3-11.2 4.2 6.4 3.3-4.9 5.2 9.7H2.5z"/><path d="m11.2 9.8 2.1-3.3 4.2 6.5"/>'),
    quarry: s('<path d="m2.5 19.5 6.3-11.2 4.2 6.4 3.3-4.9 5.2 9.7H2.5z"/><path d="m11.2 9.8 2.1-3.3 4.2 6.5"/>'),
    fleet: s('<rect x="4" y="3.5" width="10" height="17" rx="1.8"/><line x1="2.5" y1="20.5" x2="15.5" y2="20.5"/><rect x="6.5" y="6.2" width="5" height="3.8" rx="0.6"/><path d="M14 8.5h2.5a2 2 0 0 1 2 2v5a1.8 1.8 0 0 0 3.6 0V9.5l-2.4-2.8"/>'),
    fuel: s('<rect x="4" y="3.5" width="10" height="17" rx="1.8"/><line x1="2.5" y1="20.5" x2="15.5" y2="20.5"/><rect x="6.5" y="6.2" width="5" height="3.8" rx="0.6"/><path d="M14 8.5h2.5a2 2 0 0 1 2 2v5a1.8 1.8 0 0 0 3.6 0V9.5l-2.4-2.8"/>'),
    droplet: s('<path d="M12 2.8s6.5 6.8 6.5 11.7a6.5 6.5 0 0 1-13 0C5.5 9.6 12 2.8 12 2.8z"/><path d="M9.5 15.2a2.8 2.8 0 0 0 2.8 2.3"/>'),
    pricing: s('<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.8" cy="7.8" r="1.4" fill="currentColor"/>'),
    kiosks: s('<path d="M3.5 7.5V5.5a2 2 0 0 1 2-2h2"/><path d="M16.5 3.5h2a2 2 0 0 1 2 2v2"/><path d="M20.5 16.5v2a2 2 0 0 1-2 2h-2"/><path d="M7.5 20.5h-2a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="10" r="2.8"/><path d="M7.6 17.6a5.2 5.2 0 0 1 8.8 0"/>'),
    plant: s('<path d="M3 20.5h18"/><path d="M4.2 20.5V8.5l4.8 2.8V8.5l4.8 2.8V5h6v15.5"/><line x1="16.6" y1="9" x2="17.8" y2="9"/><line x1="16.6" y1="13" x2="17.8" y2="13"/>'),

    // ---- Treasury & Books ----
    cashflow: s('<rect x="2.5" y="5.5" width="19" height="13" rx="2"/><circle cx="12" cy="12" r="2.8"/><line x1="6" y1="9" x2="6.01" y2="9"/><line x1="18" y1="9" x2="18.01" y2="9"/><line x1="6" y1="15" x2="6.01" y2="15"/><line x1="18" y1="15" x2="18.01" y2="15"/>'),
    customers: s('<rect x="2.5" y="5" width="19" height="14" rx="2"/><line x1="2.5" y1="10" x2="21.5" y2="10"/><line x1="6.5" y1="14.8" x2="11.5" y2="14.8"/>'),
    suppliers: s('<polygon points="12 2.8 2.5 7.6 12 12.4 21.5 7.6 12 2.8"/><polyline points="2.5 12.2 12 17 21.5 12.2"/><polyline points="2.5 16.8 12 21.6 21.5 16.8"/>'),
    expenses: s('<path d="M5.5 3h13v18l-2.2-1.6-2.1 1.6-2.2-1.6-2.2 1.6-2.1-1.6L5.5 21V3z"/><line x1="9" y1="8.2" x2="15" y2="8.2"/><line x1="9" y1="12.2" x2="15" y2="12.2"/><line x1="9" y1="16" x2="12.5" y2="16"/>'),
    receipt: s('<path d="M5.5 3h13v18l-2.2-1.6-2.1 1.6-2.2-1.6-2.2 1.6-2.1-1.6L5.5 21V3z"/><line x1="9" y1="8.2" x2="15" y2="8.2"/><line x1="9" y1="12.2" x2="15" y2="12.2"/><line x1="9" y1="16" x2="12.5" y2="16"/>'),
    payroll: s('<path d="M16.5 21v-1.8a3.8 3.8 0 0 0-3.8-3.8H6.8A3.8 3.8 0 0 0 3 19.2V21"/><circle cx="9.8" cy="7.5" r="3.6"/><path d="M21 21v-1.8a3.6 3.6 0 0 0-2.7-3.5"/><path d="M15.6 4.1a3.6 3.6 0 0 1 0 6.9"/>'),
    ledger: s('<path d="M4.5 19.2A2.3 2.3 0 0 1 6.8 17H19.8"/><path d="M6.8 2.5h13v19h-13a2.3 2.3 0 0 1-2.3-2.3V4.8a2.3 2.3 0 0 1 2.3-2.3z"/><line x1="9" y1="7.5" x2="16.2" y2="7.5"/><line x1="9" y1="11.5" x2="14.5" y2="11.5"/>'),

    // ---- Universal Registries ----
    reg_equipment: s('<circle cx="6.2" cy="18" r="2.2"/><circle cx="17.8" cy="18" r="2.2"/><path d="M4 18H2.2V7.2a1.2 1.2 0 0 1 1.2-1.2h8.8l2.8 4.8h4.8a2 2 0 0 1 2 2V18H20"/><line x1="8.4" y1="18" x2="15.6" y2="18"/>'),
    reg_drivers: s('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.4"/><line x1="12" y1="3" x2="12" y2="9.6"/><line x1="4.2" y1="16.5" x2="9.9" y2="13.2"/><line x1="19.8" y1="16.5" x2="14.1" y2="13.2"/>'),
    reg_sites: s('<path d="M20 10c0 5.8-8 11.5-8 11.5S4 15.8 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="2.8"/>'),
    reg_regions: s('<polygon points="2.5 6 8.8 3 15.2 6 21.5 3 21.5 18 15.2 21 8.8 18 2.5 21 2.5 6"/><line x1="8.8" y1="3" x2="8.8" y2="18"/><line x1="15.2" y1="6" x2="15.2" y2="21"/>'),
    reg_products: s('<path d="M20.5 16V8a2 2 0 0 0-1-1.73l-6.5-3.75a2 2 0 0 0-2 0L4.5 6.27A2 2 0 0 0 3.5 8v8a2 2 0 0 0 1 1.73l6.5 3.75a2 2 0 0 0 2 0l6.5-3.75a2 2 0 0 0 1-1.73z"/><polyline points="3.8 7 12 11.8 20.2 7"/><line x1="12" y1="21.6" x2="12" y2="11.8"/>'),
    reg_customers: s('<rect x="4" y="3" width="9.5" height="18" rx="1.2"/><path d="M13.5 9h6.5v12h-6.5"/><line x1="7.2" y1="7" x2="10.3" y2="7"/><line x1="7.2" y1="11" x2="10.3" y2="11"/><line x1="7.2" y1="15" x2="10.3" y2="15"/><line x1="16.2" y1="13" x2="17.4" y2="13"/><line x1="16.2" y1="17" x2="17.4" y2="17"/>'),
    reg_suppliers: s('<path d="M3 20.5V8.5L12 3.5l9 5v12"/><path d="M7.5 20.5v-6.5h9v6.5"/><line x1="7.5" y1="17.2" x2="16.5" y2="17.2"/>'),
    reg_categories: s('<path d="M21.5 18.5a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h4.8l2.2 2.8h8a2 2 0 0 1 2 2z"/>'),

    // ---- Thermal Printing, Actions & UI Controls ----
    printer: s('<path d="M6.5 8.5V3.5h11v5"/><rect x="3" y="8.5" width="18" height="7.5" rx="1.8"/><path d="M6.5 13.5h11V21l-2.2-1.4-1.8 1.4-1.5-1.4-1.8 1.4-1.7-1.4-2 1.4v-7.5z"/>'),
    bluetooth: s('<polyline points="6.8 6.8 17.2 17.2 12 22 12 2 17.2 6.8 6.8 17.2"/>'),
    window: s('<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="8.5" x2="21" y2="8.5"/><line x1="6.5" y1="6.2" x2="6.6" y2="6.2"/><line x1="9.5" y1="6.2" x2="9.6" y2="6.2"/>'),
    download: s('<path d="M20.5 15v3.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V15"/><polyline points="7.5 10.5 12 15 16.5 10.5"/><line x1="12" y1="15" x2="12" y2="3.5"/>'),
    plus: s('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'),
    dollar: s('<line x1="12" y1="2.5" x2="12" y2="21.5"/><path d="M16.5 6.5H9.8a3.2 3.2 0 0 0 0 6.4h4.4a3.2 3.2 0 0 1 0 6.4H7"/>'),
    building: s('<rect x="4" y="3" width="9.5" height="18" rx="1.2"/><path d="M13.5 9h6.5v12h-6.5"/><line x1="7.2" y1="7" x2="10.3" y2="7"/><line x1="7.2" y1="11" x2="10.3" y2="11"/><line x1="7.2" y1="15" x2="10.3" y2="15"/>'),
    user: s('<path d="M19.5 21v-2a4 4 0 0 0-4-4h-7a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7.5" r="3.8"/>'),
    lock: s('<rect x="4.5" y="11" width="15" height="9.5" rx="2"/><path d="M8 11V7.2a4 4 0 0 1 8 0V11"/>'),
    unlock: s('<rect x="4.5" y="11" width="15" height="9.5" rx="2"/><path d="M8 11V7.2a4 4 0 0 1 7.6-1.5"/>'),
    shield: s('<path d="M12 21.5s7.5-3.8 7.5-9.5V5.4L12 2.5 4.5 5.4V12c0 5.7 7.5 9.5 7.5 9.5z"/><path d="m8.8 12 2.2 2.2 4.4-4.5"/>'),
    sliders: s('<line x1="4" y1="6.5" x2="20" y2="6.5"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17.5" x2="20" y2="17.5"/><circle cx="9" cy="6.5" r="2"/><circle cx="15.5" cy="12" r="2"/><circle cx="10.5" cy="17.5" r="2"/>'),
    link: s('<path d="M10 13a5 5 0 0 0 7.1 0l2.8-2.8a5 5 0 0 0-7.1-7.1L11.2 4.7"/><path d="M14 11a5 5 0 0 0-7.1 0l-2.8 2.8a5 5 0 0 0 7.1 7.1l1.6-1.6"/>'),
    calendar: s('<rect x="3.5" y="4.5" width="17" height="16" rx="2"/><line x1="8" y1="2.5" x2="8" y2="6.2"/><line x1="16" y1="2.5" x2="16" y2="6.2"/><line x1="3.5" y1="9.5" x2="20.5" y2="9.5"/>'),
    calendar_grid: s('<rect x="3.5" y="4.5" width="17" height="16" rx="2"/><line x1="8" y1="2.5" x2="8" y2="6.2"/><line x1="16" y1="2.5" x2="16" y2="6.2"/><line x1="3.5" y1="9.5" x2="20.5" y2="9.5"/><line x1="9.2" y1="9.5" x2="9.2" y2="20.5"/><line x1="14.8" y1="9.5" x2="14.8" y2="20.5"/><line x1="3.5" y1="15" x2="20.5" y2="15"/>'),
    calendar_week: s('<rect x="3.5" y="4.5" width="17" height="16" rx="2"/><line x1="8" y1="2.5" x2="8" y2="6.2"/><line x1="16" y1="2.5" x2="16" y2="6.2"/><line x1="3.5" y1="9.5" x2="20.5" y2="9.5"/><rect x="6.5" y="12.5" width="11" height="4.5" rx="1"/>'),
    sun: s('<circle cx="12" cy="12" r="4"/><line x1="12" y1="2.5" x2="12" y2="4.5"/><line x1="12" y1="19.5" x2="12" y2="21.5"/><line x1="5.3" y1="5.3" x2="6.7" y2="6.7"/><line x1="17.3" y1="17.3" x2="18.7" y2="18.7"/><line x1="2.5" y1="12" x2="4.5" y2="12"/><line x1="19.5" y1="12" x2="21.5" y2="12"/><line x1="5.3" y1="18.7" x2="6.7" y2="17.3"/><line x1="17.3" y1="6.7" x2="18.7" y2="5.3"/>'),
    moon: s('<path d="M20.4 13.4A8.4 8.4 0 1 1 10.6 3.6a6.6 6.6 0 0 0 9.8 9.8z"/>'),
    bolt: s('<polygon points="13 2.5 4 13.8 11.8 13.8 11 21.5 20 10.2 12.2 10.2 13 2.5"/>'),
    edit: s('<path d="M16.8 3.5a2.4 2.4 0 0 1 3.4 3.4L7.8 19.3 3 20.8l1.5-4.8L16.8 3.5z"/>'),
    trash: s('<polyline points="3.5 6 5.5 6 20.5 6"/><path d="M8.5 6V4a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 15.5 4v2"/><path d="M18.5 6v13a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V6"/><line x1="10" y1="10.5" x2="10" y2="16.5"/><line x1="14" y1="10.5" x2="14" y2="16.5"/>'),
    ruler: s('<path d="M21 7.5 7.5 21 3 16.5 16.5 3 21 7.5z"/><line x1="13.5" y1="6" x2="15.5" y2="8"/><line x1="10.5" y1="9" x2="12.5" y2="11"/><line x1="7.5" y1="12" x2="9.5" y2="14"/>'),
    rotate: s('<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5"/><polyline points="3.5 3.5 3.5 8.5 8.5 8.5"/>'),
    expand: s('<polyline points="15 3.5 20.5 3.5 20.5 9"/><polyline points="9 20.5 3.5 20.5 3.5 15"/><line x1="20.5" y1="3.5" x2="14" y2="10"/><line x1="3.5" y1="20.5" x2="10" y2="14"/>'),
    info: s('<circle cx="12" cy="12" r="9"/><line x1="12" y1="16" x2="12" y2="11.5"/><line x1="12" y1="8" x2="12.01" y2="8"/>'),
    warn: s('<path d="M10.3 3.9 2.1 18a2 2 0 0 0 1.7 3h16.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13.2"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
    clock_in: s('<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>'),
    clock_out: s('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>'),
    clock: s('<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/>'),
    check_circle: s('<circle cx="12" cy="12" r="9"/><path d="m8.5 12.2 2.3 2.3 4.8-4.8"/>'),
    camera: s('<path d="M21 18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2h3.2L9.8 4h4.4l1.6 2.5H19a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="3.6"/>'),
    swap: s('<polyline points="17 2.5 21 6.5 17 10.5"/><line x1="3" y1="6.5" x2="21" y2="6.5"/><polyline points="7 21.5 3 17.5 7 13.5"/><line x1="21" y1="17.5" x2="3" y2="17.5"/>'),
    globe: s('<circle cx="12" cy="12" r="9"/><line x1="3" y1="12" x2="21" y2="12"/><path d="M12 3a14 14 0 0 0 0 18 14 14 0 0 0 0-18z"/>')
  };

  function svg(name, extraCls) {
    const raw = ICONS[name] || ICONS.info;
    if (!extraCls) return raw;
    return raw.replace('class="ic"', 'class="ic ' + extraCls + '"');
  }

  function nav(viewKey, cls) {
    const iconName = ICONS[viewKey] ? viewKey : 'overview';
    return '<i class="' + (cls || 'nav-ico') + '" aria-hidden="true">' + svg(iconName) + '</i>';
  }

  window.MFG_ICONS = {
    ICONS: ICONS,
    svg: svg,
    nav: nav
  };
})();
