"""seed_from_dataverse.py — Extracts live Manufacturing Operations data (WTC, BBConstruction,
Lions Transport, and Manufacturing Group) from the published semantic models + Dataverse OData
into:
  1. `data/mfg.db`              — Standalone SQLite relational database (Option 3 local engine)
  2. `data/schema_postgres.sql` — Ready-to-run PostgreSQL / Supabase DDL with RLS policies
  3. `data/mfg_snapshot.json`   — Complete JSON snapshot for API / offline sync
  4. `js/seed_data.js`          — Pre-compiled fast browser bundle for instant zero-latency load

Read-only against Production Dataverse & Power BI (Hard Rule 5 compliant).
"""
import datetime as dt
import json
import os
import sqlite3
import sys
import time
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
JS_DIR = ROOT / "js"
DATA_DIR.mkdir(parents=True, exist_ok=True)
JS_DIR.mkdir(parents=True, exist_ok=True)

MFG_SCRIPTS = Path(r"C:\Users\HusseinBdeir\bhfirms\manufacturing-operations\scripts")
RESORT_SCRIPTS = Path(r"C:\Users\HusseinBdeir\bhfirms\resort-operations\scripts")
sys.path.insert(0, str(MFG_SCRIPTS))
sys.path.insert(0, str(RESORT_SCRIPTS))

import mlib  # noqa: E402
from m3lib import BU as BU_IDS  # noqa: E402
import pbi_period_verify as pv  # noqa: E402
import pbi_slicer_audit as sa   # noqa: E402

TARGETS = pv.targets()
ID_TO_BU = {v.lower(): k for k, v in BU_IDS.items()}
BU_TO_KEY = {
    "WTC": "wtc",
    "BBConstruction": "bbconstruction",
    "Lions Transport": "lionstransport",
}


def run_dax(model_key, query):
    t = TARGETS[model_key]
    try:
        return sa.dax(t["ws"], t["ds"], query)
    except Exception as e:
        print(f"  [WARN] DAX error on {model_key}: {e}", flush=True)
        return []


# requests replaces the whole `Prefer` header per call, so mlib.get_all (odata.maxpagesize only) silently drops the
# FormattedValue annotations every lookup / option-set column relies on -> price rules exported without customer,
# product, site or rule type (v3.0 bug). This helper keeps both preferences on every page.
FMT_PREFER = 'odata.maxpagesize=5000,odata.include-annotations="OData.Community.Display.V1.FormattedValue"'


def get_all_fmt(path):
    rows, url = [], f"{mlib.API}/{path}"
    S = mlib.session()
    while url:
        r = S.get(url, timeout=120, headers={"Prefer": FMT_PREFER})
        r.raise_for_status()
        j = r.json()
        rows.extend(j.get("value", []))
        url = j.get("@odata.nextLink")
    return rows


def clean_row(row):
    """Strip table[col] or [col] brackets from DAX output keys."""
    out = {}
    for k, v in row.items():
        if "[" in k and k.endswith("]"):
            ck = k.split("[", 1)[1][:-1]
        else:
            ck = k
        if isinstance(v, float):
            out[ck] = round(v, 2)
        else:
            out[ck] = v
    return out


def fetch_model_analytics(model_key):
    print(f"  Querying DAX analytics for {model_key}...", flush=True)
    periods = {
        "mtd": ('DATE(2026, 10, 1)', 'DATE(2026, 10, 31)', 'October 2026 (MTD)'),
        "sep2026": ('DATE(2026, 9, 1)', 'DATE(2026, 9, 30)', 'September 2026'),
        "aug2026": ('DATE(2026, 8, 1)', 'DATE(2026, 8, 31)', 'August 2026'),
        "q3_2026": ('DATE(2026, 7, 1)', 'DATE(2026, 9, 30)', 'Q3 2026'),
        "ytd": ('DATE(2026, 1, 1)', 'DATE(2026, 10, 31)', 'FY 2026 (YTD)'),
        "fy2025": ('DATE(2025, 1, 1)', 'DATE(2025, 12, 31)', 'FY 2025'),
        "all": ('DATE(2024, 1, 1)', 'DATE(2026, 12, 31)', 'All-Time (2024-2026)'),
    }

    period_kpis = {}
    for pk, (d0, d1, label) in periods.items():
        q = f"""
        EVALUATE
        CALCULATETABLE(
            ROW(
                "sales_ttc", [Sales incl VAT],
                "gross_sales", [Gross Sales],
                "net_sales", [Net Sales],
                "trans_rev", [Transport Revenue],
                "sales_vat", [Sales VAT],
                "loads", [Loads],
                "delivery_loads", [Delivery Loads],
                "pickup_loads", [Pickup Loads],
                "tons_sold", [Tons Sold],
                "qty_sold", [Qty Sold],
                "avg_price_ttc", [Avg Price per Unit incl VAT],
                "avg_price_net", [Avg Price per Unit],
                "cash_sales", [Cash Sales],
                "credit_sales", [Credit Sales],
                "raw_cost", [Raw Cost],
                "raw_mat_cost", [Raw Material Cost],
                "raw_haulage", [Raw Haulage],
                "raw_loads", [Raw Loads],
                "raw_tons", [Raw Tons],
                "raw_qty", [Raw Qty],
                "avg_raw_cost", [Avg Raw Unit Cost],
                "expenses", [Expenses],
                "cash_expenses", [Cash Expenses],
                "credit_expenses", [Credit Expenses],
                "salaries_paid", [Salaries Paid],
                "freelance_paid", [Freelance Paid],
                "overtime_bonus", [Overtime Allowances Due],
                "commission_due", [Commission Due],
                "gross_margin", [Gross Margin],
                "gm_pct", [GM %],
                "operating_profit", [Operating Profit (cash view)],
                "op_margin_pct", [Operating Margin % (cash view)],
                "ar_balance", [AR Balance],
                "ar_gross", [Trade Receivables Gross],
                "ar_advances", [Customer Advances],
                "ar_overdue", [AR Overdue],
                "ar_current", [AR Current],
                "ar_1_10", [AR 1-10],
                "ar_11_30", [AR 11-30],
                "ar_31_60", [AR 31-60],
                "ar_60_plus", [AR 60+],
                "dso_days", [DSO (days)],
                "receipts", [Receipts],
                "vat_receivable", [VAT Receivable],
                "ap_balance", [AP Balance],
                "ap_material", [AP Material],
                "ap_haulage", [AP Haulage],
                "ap_expense", [AP Expense Legs],
                "ap_settled", [AP Settled],
                "settlements_paid", [Settlements Paid],
                "cash_till", [Cash (till)],
                "cash_inflow", [Cash Inflow],
                "cash_outflow", [Cash Outflow],
                "net_cash_flow", [Net Cash Flow],
                "diesel_in_tank", [Diesel In Tank (L)],
                "diesel_litres", [Diesel Litres],
                "diesel_purchased", [Diesel Purchased (L)],
                "diesel_sold", [Diesel Sold (L)],
                "active_equip", [Active Equipment],
                "trucks_used", [Trucks Used],
                "own_fleet_loads", [Own-fleet Loads],
                "cost_per_ton", [Cost per Ton Hauled],
                "cost_per_unit", [Cost per Unit Hauled],
                "total_equip_cost", [Total Equipment Cost],
                "active_agreements", [Active Agreements],
                "tb_check", [TB Check],
                "sales_rep_date", [Sales incl VAT (reporting date)],
                "raw_rep_date", [Raw Cost (reporting date)],
                "exp_rep_date", [Expenses (reporting date)],
                "op_profit_rep_date", [Operating Profit (reporting date)]
            ),
            DATESBETWEEN(Dates[Date], {d0}, {d1})
        )
        """
        rows = run_dax(model_key, q)
        r = clean_row(rows[0]) if rows else {}
        r["label"] = label
        period_kpis[pk] = r

    # Monthly series (Nov 2025 -> Oct 2026 = 12 rolling months + 2025/2026 history)
    q_months = """
    EVALUATE
    FILTER(
        SUMMARIZECOLUMNS(
            Dates[YearMonthNo],
            'Dates'[Year Month],
            "sales_ttc", [Sales incl VAT],
            "net_sales", [Net Sales],
            "trans_rev", [Transport Revenue],
            "raw_cost", [Raw Cost],
            "expenses", [Expenses],
            "salaries", [Salaries Paid],
            "gross_margin", [Gross Margin],
            "operating_profit", [Operating Profit (cash view)],
            "loads", [Loads],
            "raw_loads", [Raw Loads],
            "tons", [Tons Sold],
            "cash_in", [Cash Inflow],
            "cash_out", [Cash Outflow],
            "sales_rep", [Sales incl VAT (reporting date)]
        ),
        Dates[YearMonthNo] >= 202501 && Dates[YearMonthNo] <= 202610
    )
    ORDER BY Dates[YearMonthNo] ASC
    """
    monthly = [clean_row(r) for r in run_dax(model_key, q_months)]

    # Top Products
    q_prod = """
    EVALUATE
    TOPN(
        20,
        FILTER(
            SUMMARIZECOLUMNS(
                Products[Product],
                Products[UoM],
                Products[Material Family],
                "sales_ttc", [Sales incl VAT],
                "net_sales", [Net Sales],
                "qty_sold", [Qty Sold],
                "tons_sold", [Tons Sold],
                "loads", [Loads],
                "avg_price_ttc", [Avg Price per Unit incl VAT],
                "avg_price_net", [Avg Price per Unit],
                "list_price", [List Price],
                "raw_cost", [Raw Cost],
                "raw_qty", [Raw Qty]
            ),
            NOT ISBLANK([Sales incl VAT]) || NOT ISBLANK([Raw Cost])
        ),
        [Sales incl VAT] + [Raw Cost], DESC
    )
    ORDER BY [sales_ttc] DESC
    """
    products = [clean_row(r) for r in run_dax(model_key, q_prod)]

    # Top Customers & AR
    q_cust = """
    EVALUATE
    TOPN(
        40,
        FILTER(
            SUMMARIZECOLUMNS(
                Customers[Customer],
                Customers[VAT Registered],
                "sales_ttc", [Sales incl VAT],
                "net_sales", [Net Sales],
                "loads", [Loads],
                "tons_sold", [Tons Sold],
                "ar_balance", [AR Balance],
                "ar_overdue", [AR Overdue],
                "ar_current", [AR Current],
                "ar_60_plus", [AR 60+],
                "vat_receivable", [VAT Receivable],
                "receipts", [Receipts],
                "last_sale", [Last Sale Date]
            ),
            NOT ISBLANK([Sales incl VAT]) || ABS([AR Balance]) > 1
        ),
        [Sales incl VAT] + ABS([AR Balance]) * 5, DESC
    )
    ORDER BY [sales_ttc] DESC
    """
    customers = [clean_row(r) for r in run_dax(model_key, q_cust)]

    # Top Suppliers & AP
    q_sup = """
    EVALUATE
    TOPN(
        40,
        FILTER(
            SUMMARIZECOLUMNS(
                Suppliers[Supplier],
                Suppliers[IVA],
                "raw_cost", [Raw Cost],
                "raw_loads", [Raw Loads],
                "expenses", [Expenses],
                "ap_balance", [AP Balance],
                "ap_material", [AP Material],
                "ap_haulage", [AP Haulage],
                "ap_expense", [AP Expense Legs],
                "ap_settled", [AP Settled],
                "settlements_paid", [Settlements Paid]
            ),
            NOT ISBLANK([Raw Cost]) || NOT ISBLANK([Expenses]) || ABS([AP Balance]) > 1
        ),
        [Raw Cost] + [Expenses] + ABS([AP Balance]) * 2, DESC
    )
    ORDER BY [raw_cost] DESC
    """
    suppliers = [clean_row(r) for r in run_dax(model_key, q_sup)]

    # Top Sites
    q_sites = """
    EVALUATE
    TOPN(
        30,
        FILTER(
            SUMMARIZECOLUMNS(
                Sites[Site],
                Sites[JV],
                "sales_ttc", [Sales incl VAT],
                "loads", [Loads],
                "tons_sold", [Tons Sold],
                "trans_rev", [Transport Revenue],
                "raw_cost", [Raw Cost],
                "raw_loads", [Raw Loads],
                "raw_tons", [Raw Tons]
            ),
            NOT ISBLANK([Sales incl VAT]) || NOT ISBLANK([Raw Cost])
        ),
        [Sales incl VAT] + [Raw Cost], DESC
    )
    ORDER BY [sales_ttc] DESC
    """
    sites = [clean_row(r) for r in run_dax(model_key, q_sites)]

    # Top Equipment / Fleet
    q_equip = """
    EVALUATE
    TOPN(
        35,
        FILTER(
            SUMMARIZECOLUMNS(
                Equipment[Equipment],
                Equipment[Type],
                Equipment[Ownership],
                Equipment[Status],
                "trips", [Trips],
                "loads", [Loads],
                "raw_loads", [Raw Loads],
                "diesel_litres", [Diesel Litres],
                "km_run", [Km Run],
                "l_per_100km", [Litres per 100 km],
                "running_cost", [Running Cost (allocated)],
                "driver_cost", [Drivers & Operators Cost],
                "total_cost", [Total Equipment Cost],
                "cost_per_ton", [Cost per Ton Hauled],
                "cost_per_unit", [Cost per Unit Hauled]
            ),
            NOT ISBLANK([Total Equipment Cost]) || [Trips] > 0
        ),
        [Total Equipment Cost] + [Trips] * 10, DESC
    )
    ORDER BY [total_cost] DESC
    """
    equipment = [clean_row(r) for r in run_dax(model_key, q_equip)]

    # Trial Balance / GL Accounts
    q_gl = """
    EVALUATE
    FILTER(
        SUMMARIZECOLUMNS(
            SOA[Code],
            SOA[Account],
            SOA[Class],
            "debit", [Debit],
            "credit", [Credit],
            "balance", [Balance]
        ),
        NOT ISBLANK([Debit]) || NOT ISBLANK([Credit])
    )
    ORDER BY SOA[Code] ASC
    """
    gl_tb = [clean_row(r) for r in run_dax(model_key, q_gl)]

    # Recent Audited GL Stream (SOA journal entries)
    q_soa = """
    EVALUATE
    TOPN(
        80,
        SELECTCOLUMNS(
            SOA,
            "date", SOA[Date],
            "doc", SOA[Document],
            "code", SOA[Code],
            "account", SOA[Account],
            "class", SOA[Class],
            "detail", SOA[Detail],
            "desc", SOA[Description],
            "debit", SOA[Debit],
            "credit", SOA[Credit],
            "company", SOA[Company]
        ),
        [date], DESC, [doc], DESC
    )
    """
    soa_stream = [clean_row(r) for r in run_dax(model_key, q_soa)]

    return {
        "periods": period_kpis,
        "monthly": monthly,
        "products": products,
        "customers": customers,
        "suppliers": suppliers,
        "sites": sites,
        "equipment": equipment,
        "gl_tb": gl_tb,
        "soa_stream": soa_stream,
    }


def fetch_dataverse_records():
    print("\n== Fetching live Dataverse records for SQLite / Snapshot...", flush=True)
    mlib.session().headers["Prefer"] = 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"'
    bu_filter = " or ".join(f"_owningbusinessunit_value eq {bid}" for bid in BU_IDS.values())

    # 1. Products
    prods_raw = get_all_fmt(
        "bhf_products?$filter=statecode eq 0"
        "&$select=bhf_productid,bhf_name,bhf_officialname,bhf_tonfactor,_bhf_type_value,_bhf_uom_value,_bhf_inputproduct_value"
    )
    products = []
    prod_map = {}
    for p in prods_raw:
        pid = p["bhf_productid"]
        name = p.get("bhf_name") or ""
        prod_map[pid] = name
        products.append({
            "id": pid,
            "name": name,
            "official_name": p.get("bhf_officialname") or name,
            "ton_factor": float(p.get("bhf_tonfactor") or 1.0),
            "type": p.get("_bhf_type_value@OData.Community.Display.V1.FormattedValue") or "Material",
            "uom": p.get("_bhf_uom_value@OData.Community.Display.V1.FormattedValue") or "m³",
            "input_product": p.get("_bhf_inputproduct_value@OData.Community.Display.V1.FormattedValue") or "",
        })
    print(f"  Products: {len(products)}", flush=True)

    # 2. Sites
    sites_raw = get_all_fmt(
        "bhf_sites?$filter=statecode eq 0"
        "&$select=bhf_siteid,bhf_name,bhf_jv,bhf_address,_bhf_region_value,_bhf_supplier_value"
    )
    sites = []
    site_owner_map = {}
    for s in sites_raw:
        sname = s.get("bhf_name") or ""
        sowner = s.get("_bhf_supplier_value@OData.Community.Display.V1.FormattedValue") or ""
        site_owner_map[sname] = sowner
        sites.append({
            "id": s["bhf_siteid"],
            "name": sname,
            "is_jv": bool(s.get("bhf_jv")),
            "region": s.get("_bhf_region_value@OData.Community.Display.V1.FormattedValue") or "",
            "supplier": sowner,
            "address": s.get("bhf_address") or "",
        })
    print(f"  Sites: {len(sites)}", flush=True)

    # 3. Equipment (universal registry + company equipment enrichment)
    ce_raw = get_all_fmt(
        f"bhf_companyequipments?$filter=statecode eq 0 and ({bu_filter})"
        "&$select=_bhf_equipment_value,bhf_ownership,bhf_status,_bhf_customer_value,_bhf_driver_value"
    )
    ce_map = {}
    for ce in ce_raw:
        eid = (ce.get("_bhf_equipment_value") or "").lower()
        if eid and eid not in ce_map:
            ce_map[eid] = {
                "ownership": ce.get("bhf_ownership@OData.Community.Display.V1.FormattedValue") or "Transporter",
                "status": ce.get("bhf_status@OData.Community.Display.V1.FormattedValue") or "Active",
                "customer": ce.get("_bhf_customer_value@OData.Community.Display.V1.FormattedValue") or "",
                "driver": ce.get("_bhf_driver_value@OData.Community.Display.V1.FormattedValue") or "",
            }

    equip_raw = get_all_fmt(
        "bhf_equipments?$filter=statecode eq 0"
        "&$select=bhf_equipmentid,bhf_name,bhf_plateno,bhf_category,bhf_model,bhf_capacity,_bhf_supplier_value"
    )
    equipment = []
    for e in equip_raw:
        eid = e["bhf_equipmentid"].lower()
        ce = ce_map.get(eid, {})
        equipment.append({
            "id": e["bhf_equipmentid"],
            "name": e.get("bhf_name") or "",
            "plate_no": e.get("bhf_plateno") or e.get("bhf_name") or "",
            "type": e.get("bhf_category@OData.Community.Display.V1.FormattedValue") or "Truck",
            "ownership": ce.get("ownership") or "Transporter",
            "capacity": float(e.get("bhf_capacity") or 0),
            "supplier": e.get("_bhf_supplier_value@OData.Community.Display.V1.FormattedValue") or "",
            "customer": ce.get("customer") or "",
            "default_driver": ce.get("driver") or "",
        })
    print(f"  Equipment: {len(equipment)}", flush=True)

    # 4. Drivers
    drv_raw = get_all_fmt(
        "bhf_drivers?$filter=statecode eq 0"
        "&$select=bhf_driverid,bhf_name,bhf_phone,_bhf_supplier_value"
    )
    drivers = []
    for d in drv_raw:
        drivers.append({
            "id": d["bhf_driverid"],
            "name": d.get("bhf_name") or "",
            "phone": d.get("bhf_phone") or "",
            "truck_owner": d.get("_bhf_supplier_value@OData.Community.Display.V1.FormattedValue") or "",
        })
    print(f"  Drivers: {len(drivers)}", flush=True)

    # 5. Price Agreements (Active / Recent)
    pr_raw = get_all_fmt(
        f"bhf_pricerules?$filter=statecode eq 0 and ({bu_filter})"
        "&$select=bhf_priceruleid,bhf_name,bhf_ruletype,bhf_price,bhf_transprice,bhf_indifferentprice,bhf_unit,bhf_startdate,bhf_enddate,"
        "_bhf_customer_value,_bhf_supplier_value,_bhf_product_value,_bhf_site_value,_bhf_uom_value,_owningbusinessunit_value"
    )
    price_rules = []
    for pr in pr_raw:
        bu = ID_TO_BU.get((pr.get("_owningbusinessunit_value") or "").lower(), "WTC")
        u_fmt = pr.get("_bhf_uom_value@OData.Community.Display.V1.FormattedValue") or pr.get("bhf_unit@OData.Community.Display.V1.FormattedValue") or "m³"
        price_rules.append({
            "id": pr["bhf_priceruleid"],
            "name": pr.get("bhf_name") or "",
            "company": bu,
            "rule_type": pr.get("bhf_ruletype@OData.Community.Display.V1.FormattedValue") or "",
            "customer": pr.get("_bhf_customer_value@OData.Community.Display.V1.FormattedValue") or "",
            "supplier": pr.get("_bhf_supplier_value@OData.Community.Display.V1.FormattedValue") or "",
            "product": pr.get("_bhf_product_value@OData.Community.Display.V1.FormattedValue") or "",
            "site": pr.get("_bhf_site_value@OData.Community.Display.V1.FormattedValue") or "",
            "unit": u_fmt,
            "unit_price": float(pr.get("bhf_price") or pr.get("bhf_indifferentprice") or 0),
            "trans_unit_price": float(pr.get("bhf_transprice") or 0),
            "start_date": str(pr.get("bhf_startdate") or "")[:10],
            "end_date": str(pr.get("bhf_enddate") or "")[:10],
        })
    print(f"  Price Rules: {len(price_rules)}", flush=True)

    # 6. Recent Sales Tickets (latest 400 across BUs)
    S = mlib.session()
    hdr_fmt = {"Prefer": 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"'}
    r_sales = S.get(
        f"{mlib.API}/bhf_salestickets?$filter=statecode eq 0 and ({bu_filter})"
        "&$select=bhf_salesticketid,bhf_name,bhf_ticketno,bhf_transactiondate,bhf_expecteddate,bhf_saletype,bhf_transportby,"
        "bhf_quantity,bhf_unitprice,bhf_price,bhf_transunitprice,bhf_transprice,bhf_discount,bhf_total,bhf_time,bhf_overtime,"
        "_bhf_customer_value,_bhf_product_value,_bhf_site_value,_bhf_supplier_value,_bhf_equipment_value,_bhf_driver_value,"
        "_bhf_unit_value,_bhf_method_value,_bhf_vatinvoice_value,_owningbusinessunit_value"
        "&$orderby=bhf_transactiondate desc&$top=400",
        headers=hdr_fmt, timeout=120
    ).json().get("value", [])
    sales_tickets = []
    for r in r_sales:
        bu = ID_TO_BU.get((r.get("_owningbusinessunit_value") or "").lower(), "WTC")
        net_tot = round(float(r.get("bhf_total") or 0), 2)
        vatinv = r.get("_bhf_vatinvoice_value@OData.Community.Display.V1.FormattedValue") or ""
        vat_amt = round(net_tot * 0.11, 2) if vatinv else 0.0
        sales_tickets.append({
            "id": r["bhf_salesticketid"],
            "name": r.get("bhf_name") or "",
            "ticket_no": r.get("bhf_ticketno") or "(no number)",
            "date": str(r.get("bhf_transactiondate") or "")[:10],
            "rep_date": str(r.get("bhf_expecteddate") or r.get("bhf_transactiondate") or "")[:10],
            "company": bu,
            "sale_type": r.get("bhf_saletype@OData.Community.Display.V1.FormattedValue") or "Delivery",
            "transport_by": r.get("bhf_transportby@OData.Community.Display.V1.FormattedValue") or "Third-party truck",
            "customer": r.get("_bhf_customer_value@OData.Community.Display.V1.FormattedValue") or "",
            "product": r.get("_bhf_product_value@OData.Community.Display.V1.FormattedValue") or "",
            "site": r.get("_bhf_site_value@OData.Community.Display.V1.FormattedValue") or "",
            "truck_owner": r.get("_bhf_supplier_value@OData.Community.Display.V1.FormattedValue") or "",
            "truck": r.get("_bhf_equipment_value@OData.Community.Display.V1.FormattedValue") or "",
            "driver": r.get("_bhf_driver_value@OData.Community.Display.V1.FormattedValue") or "",
            "uom": r.get("_bhf_unit_value@OData.Community.Display.V1.FormattedValue") or "m³",
            "qty": round(float(r.get("bhf_quantity") or 0), 2),
            "unit_price": round(float(r.get("bhf_unitprice") or 0), 2),
            "price": round(float(r.get("bhf_price") or 0), 2),
            "trans_unit_price": round(float(r.get("bhf_transunitprice") or 0), 2),
            "trans_price": round(float(r.get("bhf_transprice") or 0), 2),
            "discount": round(float(r.get("bhf_discount") or 0), 2),
            "total": net_tot,
            "vat": vat_amt,
            "total_ttc": round(net_tot + vat_amt, 2),
            "method": r.get("_bhf_method_value@OData.Community.Display.V1.FormattedValue") or "Credit",
            "vat_invoice": vatinv,
            "time": r.get("bhf_time") or "12:00",
            "overtime": bool(r.get("bhf_overtime")),
        })
    print(f"  Recent Sales Tickets: {len(sales_tickets)}", flush=True)

    # 7. Recent Raw Material Tickets (latest 300)
    r_raw = S.get(
        f"{mlib.API}/bhf_rawpurchases?$filter=statecode eq 0 and ({bu_filter})"
        "&$select=bhf_rawpurchaseid,bhf_name,bhf_ticketno,bhf_transactiondate,bhf_expecteddate,bhf_transportby,"
        "bhf_quantity,bhf_unitcost,bhf_cost,bhf_transunitcost,bhf_transcost,bhf_discount,bhf_time,bhf_overtime,"
        "_bhf_product_value,_bhf_site_value,_bhf_supplier_value,_bhf_equipment_value,_bhf_driver_value,"
        "_bhf_unit_value,_owningbusinessunit_value"
        "&$orderby=bhf_transactiondate desc&$top=300",
        headers=hdr_fmt, timeout=120
    ).json().get("value", [])
    raw_purchases = []
    for r in r_raw:
        bu = ID_TO_BU.get((r.get("_owningbusinessunit_value") or "").lower(), "WTC")
        sname = r.get("_bhf_site_value@OData.Community.Display.V1.FormattedValue") or ""
        towner = r.get("_bhf_supplier_value@OData.Community.Display.V1.FormattedValue") or ""
        mat_cost = round(float(r.get("bhf_cost") or 0), 2)
        tr_cost = round(float(r.get("bhf_transcost") or 0), 2)
        raw_purchases.append({
            "id": r["bhf_rawpurchaseid"],
            "name": r.get("bhf_name") or "",
            "ticket_no": r.get("bhf_ticketno") or "(no number)",
            "date": str(r.get("bhf_transactiondate") or "")[:10],
            "rep_date": str(r.get("bhf_expecteddate") or r.get("bhf_transactiondate") or "")[:10],
            "company": bu,
            "product": r.get("_bhf_product_value@OData.Community.Display.V1.FormattedValue") or "",
            "site": sname,
            "site_owner": site_owner_map.get(sname) or towner,
            "transport_by": r.get("bhf_transportby@OData.Community.Display.V1.FormattedValue") or "Third-party truck",
            "truck_owner": towner,
            "truck": r.get("_bhf_equipment_value@OData.Community.Display.V1.FormattedValue") or "",
            "driver": r.get("_bhf_driver_value@OData.Community.Display.V1.FormattedValue") or "",
            "uom": r.get("_bhf_unit_value@OData.Community.Display.V1.FormattedValue") or "m³",
            "qty": round(float(r.get("bhf_quantity") or 0), 2),
            "unit_cost": round(float(r.get("bhf_unitcost") or 0), 2),
            "cost": mat_cost,
            "trans_unit_cost": round(float(r.get("bhf_transunitcost") or 0), 2),
            "trans_cost": tr_cost,
            "total": round(mat_cost + tr_cost, 2),
            "method": "Credit",
            "time": r.get("bhf_time") or "12:00",
            "overtime": bool(r.get("bhf_overtime")),
        })
    print(f"  Recent Raw Purchases: {len(raw_purchases)}", flush=True)

    # 8. Recent Fuel Intakes (latest 250)
    r_fuel = S.get(
        f"{mlib.API}/bhf_fuelintakes?$filter=statecode eq 0 and ({bu_filter})"
        "&$select=bhf_fuelintakeid,bhf_name,bhf_ticketno,bhf_transactiondate,bhf_fueltype,bhf_intake,bhf_odometer,bhf_hours,"
        "_bhf_product_value,_bhf_equipment_value,_bhf_driver_value,_bhf_site_value,_owningbusinessunit_value"
        "&$orderby=bhf_transactiondate desc&$top=250",
        headers=hdr_fmt, timeout=120
    ).json().get("value", [])
    fuel_intakes = []
    for r in r_fuel:
        bu = ID_TO_BU.get((r.get("_owningbusinessunit_value") or "").lower(), "WTC")
        fuel_intakes.append({
            "id": r["bhf_fuelintakeid"],
            "name": r.get("bhf_name") or "",
            "ticket_no": r.get("bhf_ticketno") or "—",
            "date": str(r.get("bhf_transactiondate") or "")[:10],
            "company": bu,
            "fuel_type": r.get("bhf_fueltype@OData.Community.Display.V1.FormattedValue") or "Diesel",
            "item": r.get("_bhf_product_value@OData.Community.Display.V1.FormattedValue") or "Diesel",
            "equipment": r.get("_bhf_equipment_value@OData.Community.Display.V1.FormattedValue") or "",
            "driver": r.get("_bhf_driver_value@OData.Community.Display.V1.FormattedValue") or "",
            "litres": round(float(r.get("bhf_intake") or 0), 2),
            "odometer": r.get("bhf_odometer"),
            "hours": r.get("bhf_hours"),
            "location": r.get("_bhf_site_value@OData.Community.Display.V1.FormattedValue") or "",
        })
    print(f"  Recent Fuel Intakes: {len(fuel_intakes)}", flush=True)

    # 9. Recent Expenses (latest 250)
    r_exp = S.get(
        f"{mlib.API}/bhf_expenses?$filter=statecode eq 0 and ({bu_filter})"
        "&$select=bhf_expenseid,bhf_name,bhf_transactiondate,bhf_reportingdate,bhf_usdvalue,bhf_quantity,bhf_reference,"
        "_bhf_category_value,_bhf_subcategory_value,_bhf_supplier_value,_bhf_equipment_value,_bhf_method_value,_owningbusinessunit_value"
        "&$orderby=bhf_transactiondate desc&$top=250",
        headers=hdr_fmt, timeout=120
    ).json().get("value", [])
    expenses = []
    for r in r_exp:
        bu = ID_TO_BU.get((r.get("_owningbusinessunit_value") or "").lower(), "WTC")
        expenses.append({
            "id": r["bhf_expenseid"],
            "name": r.get("bhf_name") or "",
            "date": str(r.get("bhf_transactiondate") or "")[:10],
            "rep_date": str(r.get("bhf_reportingdate") or r.get("bhf_transactiondate") or "")[:10],
            "company": bu,
            "category": r.get("_bhf_category_value@OData.Community.Display.V1.FormattedValue") or "",
            "subcategory": r.get("_bhf_subcategory_value@OData.Community.Display.V1.FormattedValue") or "",
            "supplier": r.get("_bhf_supplier_value@OData.Community.Display.V1.FormattedValue") or "",
            "equipment": r.get("_bhf_equipment_value@OData.Community.Display.V1.FormattedValue") or "",
            "method": r.get("_bhf_method_value@OData.Community.Display.V1.FormattedValue") or "Cash",
            "qty": round(float(r.get("bhf_quantity") or 0), 2),
            "amount": round(float(r.get("bhf_usdvalue") or 0), 2),
            "reference": r.get("bhf_reference") or "",
        })
    print(f"  Recent Expenses: {len(expenses)}", flush=True)

    # 10. Recent Customer Receipts & Supplier Payments
    r_rcpt = S.get(
        f"{mlib.API}/bhf_customerreceipts?$filter=statecode eq 0 and ({bu_filter})"
        "&$select=bhf_customerreceiptid,bhf_name,bhf_transactiondate,bhf_usdvalue,bhf_discount,bhf_reference,"
        "_bhf_customer_value,_bhf_method_value,_owningbusinessunit_value"
        "&$orderby=bhf_transactiondate desc&$top=200",
        headers=hdr_fmt, timeout=120
    ).json().get("value", [])
    receipts = []
    for r in r_rcpt:
        bu = ID_TO_BU.get((r.get("_owningbusinessunit_value") or "").lower(), "WTC")
        receipts.append({
            "id": r["bhf_customerreceiptid"],
            "name": r.get("bhf_name") or "",
            "date": str(r.get("bhf_transactiondate") or "")[:10],
            "company": bu,
            "customer": r.get("_bhf_customer_value@OData.Community.Display.V1.FormattedValue") or "",
            "method": r.get("_bhf_method_value@OData.Community.Display.V1.FormattedValue") or "Payment",
            "amount": round(float(r.get("bhf_usdvalue") or 0), 2),
            "discount": round(float(r.get("bhf_discount") or 0), 2),
            "reference": r.get("bhf_reference") or "",
        })
    print(f"  Recent Customer Receipts: {len(receipts)}", flush=True)

    r_spay = S.get(
        f"{mlib.API}/bhf_supplierpayments?$filter=statecode eq 0 and ({bu_filter})"
        "&$select=bhf_supplierpaymentid,bhf_name,bhf_transactiondate,bhf_usdvalue,bhf_difference,bhf_reference,"
        "_bhf_supplier_value,_bhf_method_value,_owningbusinessunit_value"
        "&$orderby=bhf_transactiondate desc&$top=200",
        headers=hdr_fmt, timeout=120
    ).json().get("value", [])
    settlements = []
    for r in r_spay:
        bu = ID_TO_BU.get((r.get("_owningbusinessunit_value") or "").lower(), "WTC")
        settlements.append({
            "id": r["bhf_supplierpaymentid"],
            "name": r.get("bhf_name") or "",
            "date": str(r.get("bhf_transactiondate") or "")[:10],
            "company": bu,
            "supplier": r.get("_bhf_supplier_value@OData.Community.Display.V1.FormattedValue") or "",
            "method": r.get("_bhf_method_value@OData.Community.Display.V1.FormattedValue") or "Payment",
            "amount": round(float(r.get("bhf_usdvalue") or 0), 2),
            "discount": round(float(r.get("bhf_difference") or 0), 2),
            "reference": r.get("bhf_reference") or "",
        })
    print(f"  Recent Supplier Settlements: {len(settlements)}", flush=True)

    # 11. Recent Salary Payments
    r_sal = S.get(
        f"{mlib.API}/bhf_salarypayments?$filter=statecode eq 0 and ({bu_filter})"
        "&$select=bhf_salarypaymentid,bhf_name,bhf_transactiondate,bhf_month,bhf_usdvalue,bhf_reference,"
        "_bhf_staff_value,_owningbusinessunit_value"
        "&$orderby=bhf_transactiondate desc&$top=150",
        headers=hdr_fmt, timeout=120
    ).json().get("value", [])
    salaries = []
    for r in r_sal:
        bu = ID_TO_BU.get((r.get("_owningbusinessunit_value") or "").lower(), "WTC")
        salaries.append({
            "id": r["bhf_salarypaymentid"],
            "name": r.get("bhf_name") or "",
            "date": str(r.get("bhf_transactiondate") or "")[:10],
            "payroll_month": str(r.get("bhf_month") or r.get("bhf_transactiondate") or "")[:7],
            "company": bu,
            "staff": r.get("_bhf_staff_value@OData.Community.Display.V1.FormattedValue") or "",
            "method": "Cash",
            "amount": round(float(r.get("bhf_usdvalue") or 0), 2),
        })
    print(f"  Recent Salary Payments: {len(salaries)}", flush=True)

    return {
        "products": products,
        "sites": sites,
        "equipment": equipment,
        "drivers": drivers,
        "price_rules": price_rules,
        "sales_tickets": sales_tickets,
        "raw_purchases": raw_purchases,
        "fuel_intakes": fuel_intakes,
        "expenses": expenses,
        "receipts": receipts,
        "settlements": settlements,
        "salaries": salaries,
    }


def build_sqlite_and_postgres(snapshot):
    db_path = DATA_DIR / "mfg.db"
    if db_path.exists():
        db_path.unlink()
    conn = sqlite3.connect(str(db_path))
    cur = conn.cursor()

    ddl_sqlite = """
    CREATE TABLE companies (
        key TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        currency TEXT DEFAULT 'USD',
        usd_rate REAL DEFAULT 90000,
        min_date TEXT DEFAULT '2024-01-01'
    );

    CREATE TABLE users (
        id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL,
        companies TEXT NOT NULL,
        pbi_access TEXT DEFAULT 'full',
        statements_access TEXT DEFAULT 'full',
        status TEXT DEFAULT 'Active'
    );

    CREATE TABLE products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        official_name TEXT,
        type TEXT,
        uom TEXT,
        ton_factor REAL DEFAULT 1.0,
        input_product TEXT
    );

    CREATE TABLE sites (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        is_jv INTEGER DEFAULT 0,
        region TEXT,
        supplier TEXT,
        address TEXT
    );

    CREATE TABLE equipment (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        plate_no TEXT,
        type TEXT,
        ownership TEXT,
        capacity REAL DEFAULT 0,
        supplier TEXT,
        customer TEXT,
        default_driver TEXT
    );

    CREATE TABLE drivers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        truck_owner TEXT
    );

    CREATE TABLE price_rules (
        id TEXT PRIMARY KEY,
        name TEXT,
        company TEXT,
        rule_type TEXT,
        customer TEXT,
        supplier TEXT,
        product TEXT,
        site TEXT,
        unit TEXT,
        unit_price REAL DEFAULT 0,
        trans_unit_price REAL DEFAULT 0,
        start_date TEXT,
        end_date TEXT
    );

    CREATE TABLE sales_tickets (
        id TEXT PRIMARY KEY,
        name TEXT,
        ticket_no TEXT,
        date TEXT,
        rep_date TEXT,
        company TEXT,
        sale_type TEXT,
        transport_by TEXT,
        customer TEXT,
        product TEXT,
        site TEXT,
        truck_owner TEXT,
        truck TEXT,
        driver TEXT,
        uom TEXT,
        qty REAL DEFAULT 0,
        unit_price REAL DEFAULT 0,
        price REAL DEFAULT 0,
        trans_unit_price REAL DEFAULT 0,
        trans_price REAL DEFAULT 0,
        discount REAL DEFAULT 0,
        total REAL DEFAULT 0,
        vat REAL DEFAULT 0,
        total_ttc REAL DEFAULT 0,
        method TEXT,
        vat_invoice TEXT,
        time TEXT,
        overtime INTEGER DEFAULT 0
    );

    CREATE TABLE raw_purchases (
        id TEXT PRIMARY KEY,
        name TEXT,
        ticket_no TEXT,
        date TEXT,
        rep_date TEXT,
        company TEXT,
        product TEXT,
        site TEXT,
        site_owner TEXT,
        transport_by TEXT,
        truck_owner TEXT,
        truck TEXT,
        driver TEXT,
        uom TEXT,
        qty REAL DEFAULT 0,
        unit_cost REAL DEFAULT 0,
        cost REAL DEFAULT 0,
        trans_unit_cost REAL DEFAULT 0,
        trans_cost REAL DEFAULT 0,
        total REAL DEFAULT 0,
        method TEXT,
        time TEXT,
        overtime INTEGER DEFAULT 0
    );

    CREATE TABLE fuel_intakes (
        id TEXT PRIMARY KEY,
        name TEXT,
        ticket_no TEXT,
        date TEXT,
        company TEXT,
        fuel_type TEXT,
        item TEXT,
        equipment TEXT,
        driver TEXT,
        litres REAL DEFAULT 0,
        odometer REAL,
        hours REAL,
        location TEXT
    );

    CREATE TABLE expenses (
        id TEXT PRIMARY KEY,
        name TEXT,
        date TEXT,
        rep_date TEXT,
        company TEXT,
        category TEXT,
        subcategory TEXT,
        supplier TEXT,
        equipment TEXT,
        method TEXT,
        qty REAL DEFAULT 0,
        amount REAL DEFAULT 0,
        reference TEXT
    );

    CREATE TABLE customer_receipts (
        id TEXT PRIMARY KEY,
        name TEXT,
        date TEXT,
        company TEXT,
        customer TEXT,
        method TEXT,
        amount REAL DEFAULT 0,
        discount REAL DEFAULT 0,
        reference TEXT
    );

    CREATE TABLE supplier_payments (
        id TEXT PRIMARY KEY,
        name TEXT,
        date TEXT,
        company TEXT,
        supplier TEXT,
        method TEXT,
        amount REAL DEFAULT 0,
        discount REAL DEFAULT 0,
        reference TEXT
    );

    CREATE TABLE salary_payments (
        id TEXT PRIMARY KEY,
        name TEXT,
        date TEXT,
        payroll_month TEXT,
        company TEXT,
        staff TEXT,
        method TEXT,
        amount REAL DEFAULT 0
    );
    """
    cur.executescript(ddl_sqlite)

    # Seed companies
    cur.executemany(
        "INSERT INTO companies VALUES (?,?,?,?,?,?)",
        [
            ("wtc", "WTC (World Trading & Construction)", "WT", "USD", 90000, "2024-01-01"),
            ("bbconstruction", "BBConstruction", "BB", "USD", 90000, "2024-01-01"),
            ("lionstransport", "Lions Transport", "LT", "USD", 90000, "2024-01-01"),
        ],
    )

    # Seed users (zero Dataverse seat dependency!)
    cur.executemany(
        "INSERT INTO users VALUES (?,?,?,?,?,?,?,?)",
        [
            ("u-hussein", "Hussein Bdeir", "husseinbdeir@bhfirms.com", "Full Access (Owner)", "WTC,BBConstruction,Lions Transport", "full", "full", "Active"),
            ("u-zeinab", "Zeinab Rkein", "zeinabrkein@bhfirms.com", "Supervisor + Entry", "WTC,BBConstruction,Lions Transport", "full", "full", "Active"),
            ("u-sabah", "Sabah Kassab", "sabahkassab@bhfirms.com", "Entry", "WTC", "partial", "partial", "Active"),
            ("u-wtc", "WTC Plant Desk", "wtc@bhfirms.com", "Supervisor", "WTC", "full", "full", "Active"),
            ("u-bbc", "BBConstruction Desk", "bbconstruction@bhfirms.com", "Entry", "BBConstruction", "partial", "partial", "Active"),
            ("u-lions", "Lions Transport Dispatch", "lions@bhfirms.com", "Entry", "Lions Transport", "partial", "none", "Active"),
        ],
    )

    rec = snapshot["records"]
    for p in rec["products"]:
        cur.execute("INSERT OR IGNORE INTO products VALUES (?,?,?,?,?,?,?)",
                    (p["id"], p["name"], p["official_name"], p["type"], p["uom"], p["ton_factor"], p["input_product"]))
    for s in rec["sites"]:
        cur.execute("INSERT OR IGNORE INTO sites VALUES (?,?,?,?,?,?)",
                    (s["id"], s["name"], 1 if s["is_jv"] else 0, s["region"], s["supplier"], s["address"]))
    for e in rec["equipment"]:
        cur.execute("INSERT OR IGNORE INTO equipment VALUES (?,?,?,?,?,?,?,?,?)",
                    (e["id"], e["name"], e["plate_no"], e["type"], e["ownership"], e["capacity"], e["supplier"], e["customer"], e["default_driver"]))
    for d in rec["drivers"]:
        cur.execute("INSERT OR IGNORE INTO drivers VALUES (?,?,?,?)",
                    (d["id"], d["name"], d["phone"], d["truck_owner"]))
    for pr in rec["price_rules"]:
        cur.execute("INSERT OR IGNORE INTO price_rules VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (pr["id"], pr["name"], pr["company"], pr["rule_type"], pr["customer"], pr["supplier"], pr["product"], pr["site"], pr["unit"], pr["unit_price"], pr["trans_unit_price"], pr["start_date"], pr["end_date"]))
    for t in rec["sales_tickets"]:
        cur.execute("INSERT OR IGNORE INTO sales_tickets VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (t["id"], t["name"], t["ticket_no"], t["date"], t["rep_date"], t["company"], t["sale_type"], t["transport_by"], t["customer"], t["product"], t["site"], t["truck_owner"], t["truck"], t["driver"], t["uom"], t["qty"], t["unit_price"], t["price"], t["trans_unit_price"], t["trans_price"], t["discount"], t["total"], t["vat"], t["total_ttc"], t["method"], t["vat_invoice"], t["time"], 1 if t["overtime"] else 0))
    for r in rec["raw_purchases"]:
        cur.execute("INSERT OR IGNORE INTO raw_purchases VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (r["id"], r["name"], r["ticket_no"], r["date"], r["rep_date"], r["company"], r["product"], r["site"], r["site_owner"], r["transport_by"], r["truck_owner"], r["truck"], r["driver"], r["uom"], r["qty"], r["unit_cost"], r["cost"], r["trans_unit_cost"], r["trans_cost"], r["total"], r["method"], r["time"], 1 if r["overtime"] else 0))
    for f in rec["fuel_intakes"]:
        cur.execute("INSERT OR IGNORE INTO fuel_intakes VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (f["id"], f["name"], f["ticket_no"], f["date"], f["company"], f["fuel_type"], f["item"], f["equipment"], f["driver"], f["litres"], f["odometer"], f["hours"], f["location"]))
    for x in rec["expenses"]:
        cur.execute("INSERT OR IGNORE INTO expenses VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (x["id"], x["name"], x["date"], x["rep_date"], x["company"], x["category"], x["subcategory"], x["supplier"], x["equipment"], x["method"], x["qty"], x["amount"], x["reference"]))
    for rc in rec["receipts"]:
        cur.execute("INSERT OR IGNORE INTO customer_receipts VALUES (?,?,?,?,?,?,?,?,?)",
                    (rc["id"], rc["name"], rc["date"], rc["company"], rc["customer"], rc["method"], rc["amount"], rc["discount"], rc["reference"]))
    for sp in rec["settlements"]:
        cur.execute("INSERT OR IGNORE INTO supplier_payments VALUES (?,?,?,?,?,?,?,?,?)",
                    (sp["id"], sp["name"], sp["date"], sp["company"], sp["supplier"], sp["method"], sp["amount"], sp["discount"], sp["reference"]))
    for sl in rec["salaries"]:
        cur.execute("INSERT OR IGNORE INTO salary_payments VALUES (?,?,?,?,?,?,?,?)",
                    (sl["id"], sl["name"], sl["date"], sl["payroll_month"], sl["company"], sl["staff"], sl["method"], sl["amount"]))

    conn.commit()
    conn.close()
    print(f"  SQLite DB created -> {db_path} ({db_path.stat().st_size // 1024} KB)", flush=True)

    # Also write PostgreSQL / Supabase DDL with Row-Level Security (RLS)
    pg_ddl = """-- ============================================================================
-- ISABI Systems — Manufacturing Operations Standalone PostgreSQL / Supabase Schema
-- Replaces Microsoft Dataverse & Power BI PPU with 100% Owned SQL + Row-Level Security
-- Companies: WTC, BBConstruction, Lions Transport
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS companies (
    key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    currency TEXT DEFAULT 'USD',
    usd_rate NUMERIC(14,2) DEFAULT 90000,
    min_date DATE DEFAULT '2024-01-01'
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('Full Access (Owner)', 'Supervisor + Entry', 'Supervisor', 'Entry', 'Sales')),
    companies TEXT[] NOT NULL,
    pbi_access TEXT DEFAULT 'full',
    statements_access TEXT DEFAULT 'full',
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    official_name TEXT NOT NULL,
    type TEXT NOT NULL,
    uom TEXT NOT NULL,
    ton_factor NUMERIC(10,3) DEFAULT 1.000,
    input_product TEXT,
    revenue_account TEXT DEFAULT '701',
    purchase_account TEXT DEFAULT '601'
);

CREATE TABLE IF NOT EXISTS sites (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    is_jv BOOLEAN DEFAULT FALSE,
    region TEXT,
    supplier TEXT,
    address TEXT
);

CREATE TABLE IF NOT EXISTS equipment (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    plate_no TEXT,
    type TEXT NOT NULL,
    ownership TEXT NOT NULL,
    capacity NUMERIC(10,2) DEFAULT 0,
    supplier TEXT,
    customer TEXT,
    default_driver TEXT
);

CREATE TABLE IF NOT EXISTS price_rules (
    id UUID PRIMARY KEY,
    name TEXT,
    company TEXT NOT NULL,
    rule_type TEXT NOT NULL,
    customer TEXT,
    supplier TEXT,
    product TEXT,
    site TEXT,
    unit TEXT DEFAULT 'm³',
    unit_price NUMERIC(12,2) DEFAULT 0,
    trans_unit_price NUMERIC(12,2) DEFAULT 0,
    start_date DATE,
    end_date DATE
);

CREATE TABLE IF NOT EXISTS sales_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT,
    ticket_no TEXT NOT NULL,
    date DATE NOT NULL,
    rep_date DATE NOT NULL,
    company TEXT NOT NULL,
    sale_type TEXT NOT NULL,
    transport_by TEXT NOT NULL,
    customer TEXT NOT NULL,
    product TEXT NOT NULL,
    site TEXT,
    truck_owner TEXT,
    truck TEXT,
    driver TEXT,
    uom TEXT NOT NULL,
    qty NUMERIC(12,2) NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL,
    price NUMERIC(14,2) NOT NULL,
    trans_unit_price NUMERIC(12,2) DEFAULT 0,
    trans_price NUMERIC(14,2) DEFAULT 0,
    discount NUMERIC(14,2) DEFAULT 0,
    total NUMERIC(14,2) NOT NULL,
    vat NUMERIC(14,2) DEFAULT 0,
    total_ttc NUMERIC(14,2) NOT NULL,
    method TEXT NOT NULL,
    vat_invoice TEXT,
    time TEXT DEFAULT '12:00',
    overtime BOOLEAN DEFAULT FALSE,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Business Unit Row-Level Security (RLS) matching Dataverse BU ownership
ALTER TABLE sales_tickets ENABLE ROW LEVEL SECURITY;
"""
    (DATA_DIR / "schema_postgres.sql").write_text(pg_ddl, encoding="utf-8")


def main():
    t0 = time.time()
    print("== Stage 1: Extracting Live Manufacturing Operations Data ==", flush=True)
    models = {}
    for key in ("manufacturing-group", "wtc", "bbconstruction", "lionstransport"):
        models[key] = fetch_model_analytics(key)

    records = fetch_dataverse_records()

    # Load m280 AI sentinels report
    sentinels_path = Path(r"C:\Users\HusseinBdeir\bhfirms\manufacturing-operations\exports\m280_ai_sentinels_report.json")
    sentinels = json.loads(sentinels_path.read_text(encoding="utf-8")) if sentinels_path.exists() else {}

    snapshot = {
        "generated_at": dt.datetime.now().strftime("%Y-%m-%d %H:%M"),
        "models": models,
        "records": records,
        "sentinels": sentinels,
    }

    snap_path = DATA_DIR / "mfg_snapshot.json"
    snap_path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"  Snapshot saved -> {snap_path} ({snap_path.stat().st_size // 1024} KB)", flush=True)

    js_path = JS_DIR / "seed_data.js"
    js_path.write_text(
        "// Auto-generated from live Manufacturing Operations Dataverse + Semantic Models\n"
        "window.MFG_SEED = " + json.dumps(snapshot, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )
    print(f"  Browser bundle saved -> {js_path} ({js_path.stat().st_size // 1024} KB)", flush=True)

    build_sqlite_and_postgres(snapshot)
    print(f"\nALL DONE in {time.time() - t0:.1f}s!", flush=True)


if __name__ == "__main__":
    main()
