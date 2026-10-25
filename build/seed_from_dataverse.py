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
import threading
import time
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import requests

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
from m3lib import BU as BU_IDS, entityset  # noqa: E402
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


FMT_PREFER = 'odata.maxpagesize=5000,odata.include-annotations="OData.Community.Display.V1.FormattedValue"'
_TLS = threading.local()


def _thread_session():
    s = getattr(_TLS, "session", None)
    if s is None:
        base = mlib.session()
        s = requests.Session()
        s.headers.update(base.headers)
        s.headers["Prefer"] = FMT_PREFER
        _TLS.session = s
    return s


def get_all_fmt(path):
    rows, url = [], f"{mlib.API}/{path}"
    S = _thread_session()
    while url:
        for attempt in range(5):
            try:
                r = S.get(url, timeout=120, headers={"Prefer": FMT_PREFER})
                r.raise_for_status()
                break
            except Exception as e:
                if attempt == 4:
                    raise
                print(f"  [RETRY {attempt + 1}/5] GET {path[:60]}...: {e}", flush=True)
                time.sleep(2 * (attempt + 1))
                _TLS.session = None
                S = _thread_session()
        j = r.json()
        rows.extend(j.get("value", []))
        url = j.get("@odata.nextLink")
    return rows


def safe_get_fmt(table_or_path, query="", by_logical=False, top_only=False):
    es = entityset(table_or_path) if by_logical else table_or_path
    path = f"{es}?{query}" if query else es
    for attempt in range(5):
        try:
            if top_only:
                S = _thread_session()
                r = S.get(f"{mlib.API}/{path}", timeout=120, headers={"Prefer": FMT_PREFER})
                r.raise_for_status()
                return r.json().get("value", [])
            return get_all_fmt(path)
        except Exception as e:
            if attempt == 4:
                print(f"  [WARN] OData fetch {table_or_path}: {e}", flush=True)
                return []
            print(f"  [RETRY {attempt + 1}/5] safe_get_fmt {table_or_path}: {e}", flush=True)
            time.sleep(2 * (attempt + 1))
            _TLS.session = None


def fmt_val(row, attr, default=""):
    return (
        row.get(f"{attr}@OData.Community.Display.V1.FormattedValue")
        or row.get(f"_{attr}_value@OData.Community.Display.V1.FormattedValue")
        or row.get(attr)
        or default
    )


def _build_conversion_row(cv):
    bu = ID_TO_BU.get((cv.get("_owningbusinessunit_value") or "").lower(), "WTC")
    nm = cv.get("bhf_name") or ""
    tp = fmt_val(cv, "_bhf_type_value", "")
    if not tp or len(tp) == 36:
        tp = "LBP to USD" if ("LBP to USD" in nm or "LBP2USD" in nm.upper()) else "USD to LBP"
    is_u2l = not tp.strip().upper().startswith("LBP")
    raw_from = float(cv.get("bhf_from") or 0)
    raw_to = float(cv.get("bhf_to") or 0)
    if is_u2l:
        from_cur, to_cur = "USD", "LBP"
        usd_amt = round(raw_from, 2)
        lbp_amt = int(round(raw_to))
        usd_delta = round(-raw_from, 2)
        lbp_delta = int(round(raw_to))
    else:
        from_cur, to_cur = "LBP", "USD"
        lbp_amt = int(round(raw_from))
        usd_amt = round(raw_to, 2)
        usd_delta = round(raw_to, 2)
        lbp_delta = -int(round(raw_from))
    raw_rate = float(cv.get("bhf_rate") or cv.get("bhf_exchangerate") or 0)
    if raw_rate > 0:
        fx_rate = round(raw_rate, 2)
    elif usd_amt > 0 and lbp_amt > 0:
        fx_rate = round(lbp_amt / usd_amt, 2)
    else:
        fx_rate = 89500.0
    return {
        "id": cv["bhf_conversionid"],
        "name": nm,
        "company": bu,
        "date": str(cv.get("bhf_transactiondate") or "")[:10],
        "type": "USD to LBP" if is_u2l else "LBP to USD",
        "from_currency": from_cur,
        "to_currency": to_cur,
        "usd_amount": usd_amt,
        "lbp_amount": lbp_amt,
        "usd_delta": usd_delta,
        "lbp_delta": lbp_delta,
        "exchange_rate": fx_rate,
        "reference": cv.get("bhf_reference") or "",
        "notes": cv.get("bhf_notes") or "",
    }


def _build_salary_row(r):
    bu = ID_TO_BU.get((r.get("_owningbusinessunit_value") or "").lower(), "WTC")
    cur = fmt_val(r, "_bhf_currency_value", "USD") or "USD"
    is_lbp = cur.strip().upper() == "LBP"
    pay_raw = r.get("bhf_payment")
    if pay_raw is None:
        pay_raw = r.get("bhf_lbpamount") if is_lbp else r.get("bhf_usdamount")
    pay = float(pay_raw or 0)
    usd_amt = 0.0 if is_lbp else round(pay, 2)
    lbp_amt = int(round(pay)) if is_lbp else 0
    usd_val = round(float(r.get("bhf_usdvalue") if r.get("bhf_usdvalue") is not None else (pay / 89500.0 if is_lbp else pay)), 2)
    return {
        "id": r["bhf_salarypaymentid"],
        "name": r.get("bhf_name") or "",
        "date": str(r.get("bhf_transactiondate") or "")[:10],
        "rep_date": str(r.get("bhf_reportingdate") or r.get("bhf_transactiondate") or "")[:10],
        "payroll_month": str(r.get("bhf_month") or r.get("bhf_transactiondate") or "")[:7],
        "company": bu,
        "staff": fmt_val(r, "_bhf_staff_value", ""),
        "currency": "LBP" if is_lbp else "USD",
        "method": fmt_val(r, "_bhf_method_value", "Cash"),
        "usd_amount": usd_amt,
        "lbp_amount": lbp_amt,
        "amount": usd_val,
        "reference": r.get("bhf_reference") or "",
        "notes": r.get("bhf_notes") or "",
    }


def _build_attendance_row(a):
    bu = ID_TO_BU.get((a.get("_owningbusinessunit_value") or "").lower(), "WTC")
    st_name = fmt_val(a, "_bhf_staff_value", "")
    att_type = fmt_val(a, "bhf_type", "")
    tally = round(float(a.get("bhf_tally") or 0), 2)
    return {
        "id": a["bhf_attendanceid"],
        "name": a.get("bhf_name") or "",
        "company": bu,
        "date": str(a.get("bhf_date") or a.get("bhf_transactiondate") or a.get("createdon") or "")[:10],
        "staff": st_name,
        "type": att_type,
        "tally": tally,
        "status": fmt_val(a, "bhf_status", "") or att_type or "Present",
        "regular_hours": float(a.get("bhf_regularhours") or a.get("bhf_hours") or 0),
        "overtime_hours": float(a.get("bhf_overtimehours") or a.get("bhf_overtime") or 0),
        "late_hours": float(a.get("bhf_latehours") or 0),
        "notes": a.get("bhf_notes") or "",
    }


def _build_external_row(ex):
    import re as _re
    bu = ID_TO_BU.get((ex.get("_owningbusinessunit_value") or "").lower(), "WTC")
    flow = fmt_val(ex, "_bhf_flow_value", "")
    raw_dir = fmt_val(ex, "bhf_direction", "") or fmt_val(ex, "bhf_type", "")
    if flow:
        direction = "Outflow" if ("Expense" in flow or "Outflow" in flow) else "Inflow"
    else:
        direction = "Outflow" if "out" in raw_dir.lower() else "Inflow"
    raw_notes = ex.get("bhf_notes") or ""
    is_extended = (
        "Extended" in flow
        or "[wb:extended#" in raw_notes.lower()
        or bool(_re.match(r"^Extended(?:\.|\s|$)", raw_notes.strip(), _re.I))
    )
    return {
        "id": ex["bhf_externalid"],
        "name": ex.get("bhf_name") or "",
        "company": bu,
        "date": str(ex.get("bhf_transactiondate") or "")[:10],
        "flow": flow,
        "kind": "Extended" if is_extended else "External",
        "direction": direction,
        "counterparty": fmt_val(ex, "_bhf_company_value", "") or fmt_val(ex, "_bhf_partner_value", "") or fmt_val(ex, "_bhf_supplier_value", "") or ex.get("bhf_counterparty") or "",
        "method": fmt_val(ex, "_bhf_method_value", "") or flow or "Cash",
        "usd_amount": ex.get("bhf_usdamount"),
        "lbp_amount": ex.get("bhf_lbpamount"),
        "amount": float(ex.get("bhf_usdvalue") or 0),
        "reference": ex.get("bhf_reference") or "",
        "notes": raw_notes,
    }


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
        "ytd": ('DATE(2026, 1, 1)', 'DATE(2026, 12, 31)', 'FY 2026 (YTD)'),
        "fy2025": ('DATE(2025, 1, 1)', 'DATE(2025, 12, 31)', 'FY 2025'),
        "fy2024": ('DATE(2024, 1, 1)', 'DATE(2024, 12, 31)', 'FY 2024'),
        "all": ('DATE(2024, 1, 1)', 'DATE(2030, 12, 31)', 'All-Time (2024–2030)'),
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

    q_months = """
    EVALUATE
    FILTER(
        SUMMARIZECOLUMNS(
            Dates[YearMonthNo],
            'Dates'[Year Month],
            "sales_ttc", [Sales incl VAT],
            "gross_sales", [Gross Sales],
            "net_sales", [Net Sales],
            "trans_rev", [Transport Revenue],
            "sales_vat", [Sales VAT],
            "cash_sales", [Cash Sales],
            "credit_sales", [Credit Sales],
            "raw_cost", [Raw Cost],
            "raw_mat_cost", [Raw Material Cost],
            "raw_haulage", [Raw Haulage],
            "expenses", [Expenses],
            "cash_expenses", [Cash Expenses],
            "credit_expenses", [Credit Expenses],
            "salaries", [Salaries Paid],
            "freelance_paid", [Freelance Paid],
            "overtime_due", [Overtime Allowances Due],
            "commission_due", [Commission Due],
            "gross_margin", [Gross Margin],
            "operating_profit", [Operating Profit (cash view)],
            "loads", [Loads],
            "delivery_loads", [Delivery Loads],
            "pickup_loads", [Pickup Loads],
            "raw_loads", [Raw Loads],
            "tons", [Tons Sold],
            "qty_sold", [Qty Sold],
            "raw_qty", [Raw Qty],
            "avg_price_net", [Avg Price per Unit],
            "avg_raw_cost", [Avg Raw Unit Cost],
            "receipts", [Receipts],
            "settlements_paid", [Settlements Paid],
            "cash_in", [Cash Inflow],
            "cash_out", [Cash Outflow],
            "net_cash", [Net Cash Flow],
            "cash_till", [Cash (till)],
            "diesel_bought", [Diesel Purchased (L)],
            "diesel_issued", [Diesel Litres],
            "diesel_sold", [Diesel Sold (L)],
            "diesel_tank", [Diesel In Tank (L)],
            "equip_cost", [Total Equipment Cost],
            "sales_rep", [Sales incl VAT (reporting date)],
            "raw_rep", [Raw Cost (reporting date)],
            "exp_rep", [Expenses (reporting date)]
        ),
        Dates[YearMonthNo] >= 202401 && Dates[YearMonthNo] <= 202610
    )
    ORDER BY Dates[YearMonthNo] ASC
    """
    monthly = [clean_row(r) for r in run_dax(model_key, q_months)]

    q_prod = """
    EVALUATE
    TOPN(
        200,
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
                "raw_qty", [Raw Qty],
                "avg_raw_cost", [Avg Raw Unit Cost],
                "commission_due", [Commission Due]
            ),
            NOT ISBLANK([Sales incl VAT]) || NOT ISBLANK([Raw Cost])
        ),
        [Sales incl VAT] + [Raw Cost], DESC
    )
    ORDER BY [sales_ttc] DESC
    """
    products = [clean_row(r) for r in run_dax(model_key, q_prod)]

    q_cust = """
    EVALUATE
    TOPN(
        500,
        FILTER(
            SUMMARIZECOLUMNS(
                Customers[Customer],
                Customers[VAT Registered],
                "sales_ttc", [Sales incl VAT],
                "net_sales", [Net Sales],
                "credit_sales", [Credit Sales],
                "cash_sales", [Cash Sales],
                "loads", [Loads],
                "tons_sold", [Tons Sold],
                "ar_balance", [AR Balance],
                "ar_gross", [Trade Receivables Gross],
                "ar_advances", [Customer Advances],
                "ar_overdue", [AR Overdue],
                "ar_current", [AR Current],
                "ar_1_10", [AR 1-10],
                "ar_11_30", [AR 11-30],
                "ar_31_60", [AR 31-60],
                "ar_60_plus", [AR 60+],
                "vat_receivable", [VAT Receivable],
                "sales_vat", [Sales VAT],
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

    q_sup = """
    EVALUATE
    TOPN(
        500,
        FILTER(
            SUMMARIZECOLUMNS(
                Suppliers[Supplier],
                Suppliers[IVA],
                "raw_cost", [Raw Cost],
                "raw_mat_cost", [Raw Material Cost],
                "raw_haulage", [Raw Haulage],
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

    q_sites = """
    EVALUATE
    TOPN(
        250,
        FILTER(
            SUMMARIZECOLUMNS(
                Sites[Site],
                Sites[JV],
                "sales_ttc", [Sales incl VAT],
                "net_sales", [Net Sales],
                "loads", [Loads],
                "tons_sold", [Tons Sold],
                "trans_rev", [Transport Revenue],
                "raw_cost", [Raw Cost],
                "raw_mat_cost", [Raw Material Cost],
                "raw_haulage", [Raw Haulage],
                "raw_loads", [Raw Loads],
                "raw_tons", [Raw Tons],
                "raw_qty", [Raw Qty]
            ),
            NOT ISBLANK([Sales incl VAT]) || NOT ISBLANK([Raw Cost])
        ),
        [Sales incl VAT] + [Raw Cost], DESC
    )
    ORDER BY [sales_ttc] DESC
    """
    sites = [clean_row(r) for r in run_dax(model_key, q_sites)]

    q_equip = """
    EVALUATE
    TOPN(
        300,
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
            NOT ISBLANK([Total Equipment Cost]) || [Trips] > 0 || [Diesel Litres] > 0
        ),
        [Total Equipment Cost] + [Trips] * 10 + [Diesel Litres], DESC
    )
    ORDER BY [total_cost] DESC
    """
    equipment = [clean_row(r) for r in run_dax(model_key, q_equip)]

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

    q_soa = """
    EVALUATE
    TOPN(
        400,
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
            "credit", [Credit],
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


def _attach_truck_adj_windows(equipment):
    """Attach dated Truck Size, Owner & Driver adjustment windows (from WTC & BBConstruction
    SharePoint TrucksAdj_Data tables) onto matching equipment dicts."""
    import re as _re

    def _norm(s):
        return _re.sub(r"\s+", " ", str(s or "").strip()).lower()

    def _xl2d(n):
        if not n:
            return ""
        try:
            v = float(n)
            if v >= 47000:
                return ""
            return (dt.date(1899, 12, 30) + dt.timedelta(days=int(v))).isoformat()
        except Exception:
            return str(n)[:10]

    owner_canon = {
        "wtc": "WTC",
        "bbconstruction": "BBConstruction",
        "kareem bdeir": "Karim Bdeir",
        "karim bdeir": "Karim Bdeir",
        "hussein bdeir": "Hussein Bdeir",
        "jad bdeir": "Jad Bdeir",
    }
    drv_canon = {
        "ahmad": "Ahmad Ismael",
        "ahmad ismail": "Ahmad Ismael",
        "ahmad ismael": "Ahmad Ismael",
        "mohamad habib": "Mohamad Habib",
        "majed karam": "Majed Karam",
        "ali saleh": "Ali Saleh",
        "hussein saleh": "Hussein Saleh",
        "ismael": "Ismael",
        "ismail": "Ismael",
        "ali el hajj": "Ali el Hajj",
        "ali haj": "Ali el Hajj",
    }

    def _canon(s, cmap):
        raw = _re.sub(r"\s+", " ", str(s or "").strip())
        if not raw or raw.lower() in ("none", "excluded", "n/a"):
            return ""
        return cmap.get(raw.lower(), raw)

    eq_map = {}
    for e in equipment:
        eq_map[_norm(e.get("name"))] = e
        if e.get("plate_no"):
            eq_map.setdefault(_norm(e.get("plate_no")), e)
    for k, target in (
        ("360676", "tb1"),
        ("365062", "tb2"),
        ("358599", "tb3"),
        ("358943", "tb4"),
        ("364656", "tb7"),
        ("354578", "tb8"),
        ("364168", "tb9"),
    ):
        if target in eq_map:
            eq_map[k] = eq_map[target]

    exp_dir = MFG_SCRIPTS.parent / "exports"
    windows_by_eq = defaultdict(list)
    for co, fn in (("WTC", "wtc_raw.json"), ("BBConstruction", "bbconstruction_raw.json")):
        p = exp_dir / fn
        if not p.exists():
            continue
        raw = json.loads(p.read_text(encoding="utf-8"))
        for side, tbl_key in (("raw", "Stock/TrucksAdj_Data"), ("sales", "Revenue/TrucksAdj_Data")):
            t = raw.get(tbl_key) or {}
            headers = t.get("headers") or []
            for r in t.get("rows") or []:
                d = dict(zip(headers, r))
                eq = eq_map.get(_norm(d.get("Truck")))
                if not eq:
                    continue
                sz = d.get("Size")
                try:
                    cap = round(float(sz), 2) if sz not in (None, "") else 0.0
                except Exception:
                    cap = 0.0
                if cap <= 0:
                    continue
                sd = _xl2d(d.get("StartDate"))
                ed = _xl2d(d.get("EndDate"))
                own = _canon(d.get("Owner"), owner_canon)
                drv = _canon(d.get("Driver"), drv_canon)
                cust = _canon(d.get("Customer"), {})
                site = _canon(d.get("Site"), {})
                w = {"co": co, "side": side, "s": sd, "e": ed, "cap": cap}
                if own:
                    w["own"] = own
                if drv:
                    w["drv"] = drv
                if cust:
                    w["cust"] = cust
                if site:
                    w["site"] = site
                windows_by_eq[eq["name"]].append(w)

    # m292 2026-10-23: TB1 (Karim Bdeir), Tb7 (Hussein Bdeir), and Tb9 (Jad Bdeir) belonged to WTC before 2026-08-24
    # and to Karim Bdeir, Hussein Bdeir, and Jad Bdeir from 2026-08-24 onwards across BOTH WTC and BBConstruction.
    bdeir_owners = {"tb1": "Karim Bdeir", "tb7": "Hussein Bdeir", "tb9": "Jad Bdeir"}
    bdeir_caps = {"tb1": 29.0, "tb7": 29.0, "tb9": 27.0}
    bdeir_drvs = {"tb1": "Ahmad Ismael", "tb7": "Mohamad Habib", "tb9": "Ali Saleh"}

    for e in equipment:
        ename = _norm(e["name"])
        wlist = windows_by_eq.get(e["name"])
        if not wlist:
            continue
        if ename in bdeir_owners:
            target_own = bdeir_owners[ename]
            norm_list = []
            for w in wlist:
                w = dict(w)
                if w.get("e") == "2026-08-22":
                    w["e"] = "2026-08-23"
                if w.get("s") == "2026-08-23":
                    w["s"] = "2026-08-24"
                s = w.get("s") or ""
                ed = w.get("e") or ""
                if s < "2026-08-24" and (not ed or ed >= "2026-08-24"):
                    w_pre = dict(w, e="2026-08-23", own="WTC")
                    w_post = dict(w, s="2026-08-24", own=target_own)
                    norm_list.append(w_pre)
                    norm_list.append(w_post)
                else:
                    if s >= "2026-08-24":
                        w["own"] = target_own
                    elif (not w.get("cust") and not w.get("site")) or w.get("own", "").lower() in (
                        "", "wtc", "bbconstruction", "karim bdeir", "kareem bdeir", "hussein bdeir", "jad bdeir"
                    ):
                        w["own"] = "WTC"
                    norm_list.append(w)
            has_bbc_post = any(
                w["co"] == "BBConstruction" and w.get("s") == "2026-08-24" and not w.get("cust") and not w.get("site")
                for w in norm_list
            )
            if not has_bbc_post:
                norm_list.append({
                    "co": "BBConstruction", "side": "both", "s": "2026-08-24", "e": "",
                    "cap": bdeir_caps[ename], "own": target_own, "drv": bdeir_drvs[ename],
                })
            has_bbc_pre = any(
                w["co"] == "BBConstruction" and (w.get("e") or "") <= "2026-08-23" and not w.get("cust") and not w.get("site")
                for w in norm_list
            )
            if not has_bbc_pre:
                norm_list.append({
                    "co": "BBConstruction", "side": "both", "s": "2024-01-01", "e": "2026-08-23",
                    "cap": bdeir_caps[ename], "own": "WTC", "drv": bdeir_drvs[ename],
                })
            wlist = norm_list
        by_sig = {}
        for w in wlist:
            sig = (
                w["co"],
                w["s"],
                w["e"],
                w["cap"],
                w.get("own", "").lower(),
                w.get("drv", "").lower(),
                w.get("cust", "").lower(),
                w.get("site", "").lower(),
            )
            if sig in by_sig:
                if by_sig[sig]["side"] != w["side"]:
                    by_sig[sig]["side"] = "both"
            else:
                by_sig[sig] = dict(w)
        e["adj_windows"] = sorted(
            by_sig.values(),
            key=lambda x: (x.get("s") or "", x.get("e") or "9999-12-31"),
        )


def fetch_dataverse_records():
    print("\n== Fetching live Dataverse records for SQLite / Snapshot (Full 28-Table Coverage)...", flush=True)
    mlib.session().headers["Prefer"] = FMT_PREFER
    bu_filter = " or ".join(f"_owningbusinessunit_value eq {bid}" for bid in BU_IDS.values())

    # 0a. Units of Measure (bhf_uom) & Product Types (bhf_producttype)
    uoms_raw = safe_get_fmt("bhf_uom", "$filter=statecode eq 0&$select=bhf_uomid,bhf_name", by_logical=True)
    uoms = [{"id": u["bhf_uomid"], "name": u.get("bhf_name") or ""} for u in uoms_raw]

    pt_raw = safe_get_fmt(
        "bhf_producttype",
        "$filter=statecode eq 0",
        by_logical=True,
    )
    product_types = []
    pt_map = {}
    for pt in pt_raw:
        ptid = pt["bhf_producttypeid"].lower()
        item = {
            "id": pt["bhf_producttypeid"],
            "name": pt.get("bhf_name") or "",
            "ticket_product": bool(pt.get("bhf_ticketproduct")),
            "fuel_item": bool(pt.get("bhf_fuelitem")),
            "revenue_account": fmt_val(pt, "bhf_revenueaccount", "701"),
            "purchase_account": fmt_val(pt, "bhf_purchaseaccount", "601"),
            "notes": pt.get("bhf_notes") or "",
        }
        pt_map[ptid] = item
        product_types.append(item)
    print(f"  Product Types: {len(product_types)} · UoMs: {len(uoms)}", flush=True)

    # 1. Products (bhf_product)
    prods_raw = safe_get_fmt(
        "bhf_product",
        "$filter=statecode eq 0",
        by_logical=True,
    )
    products = []
    prod_map = {}
    for p in prods_raw:
        pid = p["bhf_productid"]
        name = p.get("bhf_name") or ""
        prod_map[pid] = name
        tid = (p.get("_bhf_type_value") or "").lower()
        pt_info = pt_map.get(tid, {})
        t_name = fmt_val(p, "_bhf_type_value", "Material")
        products.append({
            "id": pid,
            "name": name,
            "official_name": p.get("bhf_officialname") or name,
            "ton_factor": (float(p["bhf_tonfactor"]) if p.get("bhf_tonfactor") not in (None, "", 0) else None),  # None = no factor (DAX: no tonnage); was 1.0
            "type_id": p.get("_bhf_type_value") or "",
            "type": t_name,
            "ticket_product": pt_info.get("ticket_product", t_name in ("Material", "Aggregates", "Sand", "Gravel", "Subbase")),
            "fuel_item": pt_info.get("fuel_item", t_name in ("Oil", "Grease", "Lubricant", "Fuel")),
            "uom_id": p.get("_bhf_uom_value") or "",
            "uom": fmt_val(p, "_bhf_uom_value", "m³"),
            "input_product_id": p.get("_bhf_inputproduct_value") or "",
            "input_product": fmt_val(p, "_bhf_inputproduct_value", ""),
            "revenue_account": fmt_val(p, "bhf_revenueaccount", "701"),
            "purchase_account": fmt_val(p, "bhf_purchaseaccount", "601"),
            "notes": p.get("bhf_notes") or "",
        })
    print(f"  Products: {len(products)}", flush=True)

    # 2. Regions (bhf_region) & Sites (bhf_site)
    reg_raw = safe_get_fmt(
        "bhf_region",
        "$filter=statecode eq 0&$select=bhf_regionid,bhf_name,bhf_zonegeojson,bhf_notes",
        by_logical=True,
    )
    regions = []
    for rg in reg_raw:
        z = rg.get("bhf_zonegeojson") or ""
        places_cnt = 0
        if z:
            try:
                places_cnt = len(json.loads(z).get("features", []))
            except Exception:
                places_cnt = 1
        regions.append({
            "id": rg["bhf_regionid"],
            "name": rg.get("bhf_name") or "",
            "places_count": places_cnt,
            "notes": rg.get("bhf_notes") or "",
        })

    sites_raw = safe_get_fmt(
        "bhf_site",
        "$filter=statecode eq 0&$select=bhf_siteid,bhf_name,bhf_jv,bhf_address,bhf_latitude,bhf_longitude,bhf_notes,_bhf_region_value,_bhf_supplier_value",
        by_logical=True,
    )
    sites = []
    site_owner_map = {}
    for s in sites_raw:
        sname = s.get("bhf_name") or ""
        sowner = fmt_val(s, "_bhf_supplier_value", "")
        site_owner_map[sname] = sowner
        sites.append({
            "id": s["bhf_siteid"],
            "name": sname,
            "is_jv": bool(s.get("bhf_jv")),
            "region_id": s.get("_bhf_region_value") or "",
            "region": fmt_val(s, "_bhf_region_value", ""),
            "supplier_id": s.get("_bhf_supplier_value") or "",
            "supplier": sowner,
            "address": s.get("bhf_address") or "",
            "latitude": s.get("bhf_latitude"),
            "longitude": s.get("bhf_longitude"),
            "notes": s.get("bhf_notes") or "",
        })
    print(f"  Regions: {len(regions)} · Sites: {len(sites)}", flush=True)

    # 3. Equipment (universal registry + company equipment rows)
    ce_raw = safe_get_fmt(
        "bhf_companyequipment",
        f"$filter=statecode eq 0 and ({bu_filter})"
        "&$select=bhf_companyequipmentid,bhf_name,_bhf_equipment_value,bhf_ownership,bhf_status,_bhf_site_value,"
        "_bhf_customer_value,_bhf_supplier_value,_bhf_driver_value,_bhf_dayoperator_value,_bhf_nightoperator_value,"
        "bhf_startdate,bhf_enddate,bhf_acquisitiondate,bhf_notes,_owningbusinessunit_value",
        by_logical=True,
    )
    ce_map = {}
    company_equipment = []
    for ce in ce_raw:
        bu = ID_TO_BU.get((ce.get("_owningbusinessunit_value") or "").lower(), "WTC")
        eid = (ce.get("_bhf_equipment_value") or "").lower()
        own_code = ce.get("bhf_ownership")
        own_lbl = fmt_val(ce, "bhf_ownership", "Owned")
        drv_lbl = (
            fmt_val(ce, "_bhf_driver_value", "")
            or fmt_val(ce, "_bhf_dayoperator_value", "")
            or fmt_val(ce, "_bhf_nightoperator_value", "")
        )
        ce_item = {
            "id": ce["bhf_companyequipmentid"],
            "company": bu,
            "equipment_id": ce.get("_bhf_equipment_value") or "",
            "equipment": fmt_val(ce, "_bhf_equipment_value", ce.get("bhf_name") or ""),
            "ownership_code": own_code,
            "ownership": own_lbl,
            "is_company_fleet": own_code != 4 and own_lbl.lower() not in ("third party", "transporter"),
            "status": fmt_val(ce, "bhf_status", "Active"),
            "site": fmt_val(ce, "_bhf_site_value", ""),
            "customer": fmt_val(ce, "_bhf_customer_value", ""),
            "supplier": fmt_val(ce, "_bhf_supplier_value", ""),
            "default_driver": drv_lbl,
            "day_operator": fmt_val(ce, "_bhf_dayoperator_value", ""),
            "night_operator": fmt_val(ce, "_bhf_nightoperator_value", ""),
            "start_date": str(ce.get("bhf_startdate") or "")[:10],
            "end_date": str(ce.get("bhf_enddate") or "")[:10],
            "notes": ce.get("bhf_notes") or "",
        }
        company_equipment.append(ce_item)
        if eid:
            prev = ce_map.get(eid)
            if not prev or (bu == "WTC" and prev.get("company") != "WTC") or (not prev.get("default_driver") and drv_lbl):
                ce_map[eid] = ce_item

    equip_raw = safe_get_fmt(
        "bhf_equipment",
        "$filter=statecode eq 0&$select=bhf_equipmentid,bhf_name,bhf_plateno,bhf_category,bhf_model,bhf_color,bhf_capacity,bhf_notes,_bhf_supplier_value,_bhf_driver_value",
        by_logical=True,
    )
    equipment = []
    owner_trucks_map = defaultdict(list)
    for e in equip_raw:
        eid = e["bhf_equipmentid"].lower()
        ce = ce_map.get(eid, {})
        cat_code = e.get("bhf_category")
        cat_lbl = fmt_val(e, "bhf_category", "Truck")
        sup_name = fmt_val(e, "_bhf_supplier_value", "")
        cap = float(e.get("bhf_capacity") or 0)
        eq_name = e.get("bhf_name") or ""
        if (cat_code == 1 or cat_lbl == "Truck") and sup_name:
            owner_trucks_map[sup_name].append({"name": eq_name, "capacity": cap})
        equipment.append({
            "id": e["bhf_equipmentid"],
            "name": eq_name,
            "plate_no": e.get("bhf_plateno") or eq_name,
            "category_code": cat_code,
            "type": cat_lbl,
            "model": e.get("bhf_model") or "",
            "color": e.get("bhf_color") or "",
            "ownership": ce.get("ownership") or ("Transporter" if sup_name else "Company Fleet"),
            "capacity": cap,
            "supplier_id": e.get("_bhf_supplier_value") or "",
            "supplier": sup_name,
            "customer": ce.get("customer") or "",
            "default_driver": fmt_val(e, "_bhf_driver_value", "") or ce.get("default_driver") or "",
            "notes": e.get("bhf_notes") or "",
        })
    _attach_truck_adj_windows(equipment)
    print(f"  Equipment: {len(equipment)} · Company Equipment rows: {len(company_equipment)}", flush=True)

    # 4. Drivers & Company Drivers
    drv_raw = safe_get_fmt(
        "bhf_driver",
        "$filter=statecode eq 0&$select=bhf_driverid,bhf_name,bhf_phone,bhf_notes,_bhf_supplier_value",
        by_logical=True,
    )
    drivers = []
    owner_drivers_map = defaultdict(list)
    for d in drv_raw:
        dname = d.get("bhf_name") or ""
        towner = fmt_val(d, "_bhf_supplier_value", "")
        if towner:
            owner_drivers_map[towner].append(dname)
        drivers.append({
            "id": d["bhf_driverid"],
            "name": dname,
            "phone": d.get("bhf_phone") or "",
            "supplier_id": d.get("_bhf_supplier_value") or "",
            "truck_owner": towner,
            "notes": d.get("bhf_notes") or "",
        })

    cd_raw = safe_get_fmt(
        "bhf_companydriver",
        f"$filter=statecode eq 0 and ({bu_filter})"
        "&$select=bhf_companydriverid,bhf_name,_bhf_driver_value,_bhf_staff_value,bhf_startdate,bhf_enddate,bhf_notes,_owningbusinessunit_value",
        by_logical=True,
    )
    company_drivers = []
    for cd in cd_raw:
        bu = ID_TO_BU.get((cd.get("_owningbusinessunit_value") or "").lower(), "WTC")
        company_drivers.append({
            "id": cd["bhf_companydriverid"],
            "company": bu,
            "driver_id": cd.get("_bhf_driver_value") or "",
            "driver": fmt_val(cd, "_bhf_driver_value", cd.get("bhf_name") or ""),
            "staff": fmt_val(cd, "_bhf_staff_value", ""),
            "start_date": str(cd.get("bhf_startdate") or "")[:10],
            "end_date": str(cd.get("bhf_enddate") or "")[:10],
            "notes": cd.get("bhf_notes") or "",
        })
    print(f"  Drivers: {len(drivers)} · Company Drivers: {len(company_drivers)}", flush=True)

    # 5. Price Agreements (bhf_pricerule — with full Tier 1/2 & Transport columns)
    pr_raw = safe_get_fmt(
        "bhf_pricerule",
        f"$filter=statecode eq 0 and ({bu_filter})"
        "&$select=bhf_priceruleid,bhf_name,bhf_ruletype,bhf_byproduct,bhf_unit,bhf_price,bhf_transprice,bhf_unitpricetotal,"
        "bhf_quantity1,bhf_adjustment1,bhf_transadjustment1,bhf_total1,bhf_transtotal1,"
        "bhf_quantity2,bhf_adjustment2,bhf_transadjustment2,bhf_total2,bhf_transtotal2,"
        "bhf_indifferentprice,bhf_transindifferentprice,bhf_deliveredindifferentprice,"
        "bhf_startdate,bhf_enddate,bhf_notes,"
        "_bhf_customer_value,_bhf_supplier_value,_bhf_product_value,_bhf_site_value,_bhf_uom_value,_owningbusinessunit_value",
        by_logical=True,
    )
    price_rules = []
    mfg_cust_names = set()
    mfg_sup_names = set()
    for pr in pr_raw:
        bu = ID_TO_BU.get((pr.get("_owningbusinessunit_value") or "").lower(), "WTC")
        rt_lbl = fmt_val(pr, "bhf_ruletype", "")
        rate_per_lbl = fmt_val(pr, "bhf_unit", "")
        u_fmt = fmt_val(pr, "_bhf_uom_value", "") or rate_per_lbl or "m³"
        cname = fmt_val(pr, "_bhf_customer_value", "")
        sname = fmt_val(pr, "_bhf_supplier_value", "")
        if cname:
            mfg_cust_names.add(cname)
        if sname:
            mfg_sup_names.add(sname)
        raw_price = pr.get("bhf_price")
        raw_indiff = pr.get("bhf_indifferentprice")
        raw_tprice = pr.get("bhf_transprice")
        raw_tindiff = pr.get("bhf_transindifferentprice")
        notes_str = pr.get("bhf_notes") or ""
        is_mat_indiff = (raw_indiff not in (None, "", 0)) and (
            raw_price in (None, "", 0)
            or rt_lbl in ("Transport Price (Site)", "Purchase Price (Site)")
            or rate_per_lbl == "Truck"
            or "only an Indifferent Price" in notes_str
        )
        is_trans_indiff = raw_tindiff not in (None, "", 0)
        eff_price = None if is_mat_indiff else raw_price
        eff_unit_price = 0.0 if is_mat_indiff else float(raw_price or 0)
        eff_tprice = None if (is_trans_indiff and ("only an Indifferent Price" in notes_str or raw_tprice == raw_tindiff)) else raw_tprice
        eff_tunit_price = 0.0 if (is_trans_indiff and ("only an Indifferent Price" in notes_str or raw_tprice == raw_tindiff)) else float(raw_tprice or 0)
        price_rules.append({
            "id": pr["bhf_priceruleid"],
            "name": pr.get("bhf_name") or "",
            "company": bu,
            "rule_type_code": pr.get("bhf_ruletype"),
            "rule_type": rt_lbl,
            "by_product": bool(pr.get("bhf_byproduct")),
            "rate_per_code": pr.get("bhf_unit"),
            "rate_per": rate_per_lbl or ("Truck" if (rt_lbl == "Transport Price (Site)" and is_mat_indiff) else ""),
            "customer_id": pr.get("_bhf_customer_value") or "",
            "customer": cname,
            "supplier_id": pr.get("_bhf_supplier_value") or "",
            "supplier": sname,
            "product_id": pr.get("_bhf_product_value") or "",
            "product": fmt_val(pr, "_bhf_product_value", ""),
            "site_id": pr.get("_bhf_site_value") or "",
            "site": fmt_val(pr, "_bhf_site_value", ""),
            "uom_id": pr.get("_bhf_uom_value") or "",
            "unit": u_fmt,
            "unit_price": eff_unit_price,
            "price": eff_price,
            "trans_unit_price": eff_tunit_price,
            "trans_price": eff_tprice,
            "unit_price_total": pr.get("bhf_unitpricetotal"),
            "qty1": pr.get("bhf_quantity1"),
            "adj1": pr.get("bhf_adjustment1"),
            "trans_adj1": pr.get("bhf_transadjustment1"),
            "total1": pr.get("bhf_total1"),
            "trans_total1": pr.get("bhf_transtotal1"),
            "qty2": pr.get("bhf_quantity2"),
            "adj2": pr.get("bhf_adjustment2"),
            "trans_adj2": pr.get("bhf_transadjustment2"),
            "total2": pr.get("bhf_total2"),
            "trans_total2": pr.get("bhf_transtotal2"),
            "indiff_price": pr.get("bhf_indifferentprice"),
            "trans_indiff_price": pr.get("bhf_transindifferentprice"),
            "delivered_indiff_price": pr.get("bhf_deliveredindifferentprice"),
            "start_date": str(pr.get("bhf_startdate") or "")[:10],
            "end_date": str(pr.get("bhf_enddate") or "")[:10],
            "notes": notes_str,
        })
    print(f"  Price Rules: {len(price_rules)}", flush=True)

    # 5b. Credit Terms (bhf_creditterm) & VAT Invoices (bhf_vatinvoice)
    ct_raw = safe_get_fmt(
        "bhf_creditterm",
        f"$filter=statecode eq 0 and ({bu_filter})"
        "&$select=bhf_credittermid,bhf_name,_bhf_customer_value,bhf_creditdays,bhf_creditlimit,bhf_startdate,bhf_enddate,bhf_notes,_owningbusinessunit_value",
        by_logical=True,
    )
    credit_terms = []
    for ct in ct_raw:
        bu = ID_TO_BU.get((ct.get("_owningbusinessunit_value") or "").lower(), "WTC")
        cname = fmt_val(ct, "_bhf_customer_value", "")
        if cname:
            mfg_cust_names.add(cname)
        credit_terms.append({
            "id": ct["bhf_credittermid"],
            "name": ct.get("bhf_name") or "",
            "company": bu,
            "customer_id": ct.get("_bhf_customer_value") or "",
            "customer": cname,
            "credit_days": ct.get("bhf_creditdays"),
            "credit_limit": float(ct.get("bhf_creditlimit") or 0),
            "start_date": str(ct.get("bhf_startdate") or "")[:10],
            "end_date": str(ct.get("bhf_enddate") or "")[:10],
            "notes": ct.get("bhf_notes") or "",
        })

    vi_raw = safe_get_fmt(
        "bhf_vatinvoice",
        f"$filter=statecode eq 0 and ({bu_filter})"
        "&$select=bhf_vatinvoiceid,bhf_name,bhf_invoiceno,_bhf_customer_value,bhf_invoicedate,bhf_startdate,bhf_enddate,bhf_netamount,bhf_vatamount,bhf_notes,_owningbusinessunit_value",
        by_logical=True,
    )
    vat_invoices = []
    for vi in vi_raw:
        bu = ID_TO_BU.get((vi.get("_owningbusinessunit_value") or "").lower(), "WTC")
        cname = fmt_val(vi, "_bhf_customer_value", "")
        if cname:
            mfg_cust_names.add(cname)
        net = float(vi.get("bhf_netamount") or 0)
        vat = float(vi.get("bhf_vatamount") or 0)
        inv_date = str(vi.get("bhf_invoicedate") or vi.get("bhf_enddate") or vi.get("bhf_startdate") or "")[:10]   # Power BI VATInvoices[Date] (m18a t_vatinvoices)
        vat_invoices.append({
            "id": vi["bhf_vatinvoiceid"],
            "name": vi.get("bhf_name") or "",
            "company": bu,
            "invoice_no": vi.get("bhf_invoiceno") or vi.get("bhf_name") or "",
            "customer_id": vi.get("_bhf_customer_value") or "",
            "customer": cname,
            "date": inv_date,
            "start_date": str(vi.get("bhf_startdate") or "")[:10],
            "end_date": str(vi.get("bhf_enddate") or "")[:10],
            "net_amount": round(net, 2),
            "vat_amount": round(vat, 2),
            "total_ttc": round(net + vat, 2),
            "notes": vi.get("bhf_notes") or "",
        })
    print(f"  Credit Terms: {len(credit_terms)} · VAT Invoices: {len(vat_invoices)}", flush=True)

    # 6–12. Fetch all operational & treasury tables in parallel (full 2024–2026 history)
    queries = {
        "r_sales": (
            "bhf_salesticket",
            f"$filter=statecode eq 0 and ({bu_filter})"
            "&$select=bhf_salesticketid,bhf_name,bhf_ticketno,bhf_transactiondate,bhf_expecteddate,bhf_saletype,bhf_transportby,"
            "bhf_quantity,bhf_externalquantity,bhf_unitprice,bhf_price,bhf_transunitprice,bhf_transprice,bhf_tip,bhf_discount,bhf_total,"
            "bhf_time,bhf_overtime,bhf_externalinvoice,bhf_reference,bhf_notes,"
            "_bhf_customer_value,_bhf_product_value,_bhf_site_value,_bhf_supplier_value,_bhf_equipment_value,_bhf_driver_value,"
            "_bhf_unit_value,_bhf_method_value,_bhf_vatinvoice_value,_owningbusinessunit_value"
            "&$orderby=bhf_transactiondate desc",
            False,
        ),
        "r_raw": (
            "bhf_rawpurchase",
            f"$filter=statecode eq 0 and ({bu_filter})"
            "&$select=bhf_rawpurchaseid,bhf_name,bhf_ticketno,bhf_transactiondate,bhf_expecteddate,bhf_transportby,"
            "bhf_quantity,bhf_unitcost,bhf_cost,bhf_transunitcost,bhf_transcost,bhf_discount,bhf_time,bhf_overtime,"
            "bhf_externalinvoice,bhf_reference,bhf_notes,"
            "_bhf_product_value,_bhf_site_value,_bhf_supplier_value,_bhf_equipment_value,_bhf_driver_value,"
            "_bhf_unit_value,_owningbusinessunit_value"
            "&$orderby=bhf_transactiondate desc",
            False,
        ),
        "r_fuel": (
            "bhf_fuelintake",
            f"$filter=statecode eq 0 and ({bu_filter})"
            "&$select=bhf_fuelintakeid,bhf_name,bhf_ticketno,bhf_transactiondate,bhf_reportingdate,bhf_fueltype,bhf_intake,bhf_odometer,bhf_hours,bhf_notes,"
            "_bhf_product_value,_bhf_equipment_value,_bhf_driver_value,_bhf_site_value,_owningbusinessunit_value"
            "&$orderby=bhf_transactiondate desc",
            False,
        ),
        "ec_raw": ("bhf_expensecategory", "$filter=statecode eq 0&$select=bhf_expensecategoryid,bhf_name,_bhf_glaccount_value", False),
        "gl_raw": ("bhf_glaccount", "$filter=statecode eq 0&$select=bhf_glaccountid,bhf_code,bhf_name", False),
        "esc_raw": ("bhf_expensesubcategory", "$filter=statecode eq 0&$select=bhf_expensesubcategoryid,bhf_name,_bhf_category_value", False),
        "r_exp": (
            "bhf_expense",
            f"$filter=statecode eq 0 and ({bu_filter})"
            "&$select=bhf_expenseid,bhf_name,bhf_transactiondate,bhf_reportingdate,bhf_invoice,bhf_usdamount,bhf_lbpamount,bhf_usdvalue,bhf_quantity,bhf_reference,bhf_notes,"
            "_bhf_category_value,_bhf_subcategory_value,_bhf_supplier_value,_bhf_equipment_value,_bhf_method_value,_owningbusinessunit_value"
            "&$orderby=bhf_transactiondate desc",
            False,
        ),
        "r_rcpt": (
            "bhf_customerreceipt",
            f"$filter=statecode eq 0 and ({bu_filter})"
            "&$select=bhf_customerreceiptid,bhf_name,bhf_transactiondate,bhf_reportingdate,bhf_usdamount,bhf_lbpamount,bhf_usdvalue,bhf_discount,bhf_reference,bhf_notes,"
            "_bhf_customer_value,_bhf_method_value,_bhf_salesticket_value,_bhf_vatinvoice_value,_owningbusinessunit_value"
            "&$orderby=bhf_transactiondate desc",
            False,
        ),
        "r_spay": (
            "bhf_supplierpayment",
            f"$filter=statecode eq 0 and ({bu_filter})"
            "&$select=bhf_supplierpaymentid,bhf_name,bhf_transactiondate,bhf_reportingdate,bhf_invoice,bhf_usdamount,bhf_lbpamount,bhf_usdvalue,bhf_difference,bhf_reference,bhf_notes,"
            "_bhf_supplier_value,_bhf_method_value,_bhf_expense_value,_bhf_rawpurchase_value,_owningbusinessunit_value"
            "&$orderby=bhf_transactiondate desc",
            False,
        ),
        "cust_raw": (
            "bhf_customer",
            "$filter=statecode eq 0&$select=bhf_customerid,bhf_name,bhf_officialname,bhf_phone,bhf_address,bhf_method,"
            "bhf_vatregistered,bhf_mofno,bhf_externalinvoice,bhf_customerdeclaredquantity,bhf_notes",
            False,
        ),
        "sup_raw": ("bhf_supplier", "$filter=statecode eq 0", False),
        "r_sal": ("bhf_salarypayment", f"$filter=statecode eq 0 and ({bu_filter})&$orderby=bhf_transactiondate desc", False),
        "emp_raw": ("bhf_employment", f"$filter=statecode eq 0 and ({bu_filter})&$orderby=bhf_startdate desc", False),
        "att_raw": ("bhf_attendance", f"$filter=statecode eq 0 and ({bu_filter})&$orderby=createdon desc", False),
        "flw_raw": ("bhf_freelancework", f"$filter=statecode eq 0 and ({bu_filter})&$orderby=bhf_transactiondate desc", False),
        "flp_raw": ("bhf_freelancepayment", f"$filter=statecode eq 0 and ({bu_filter})&$orderby=bhf_transactiondate desc", False),
        "log_raw": ("bhf_logistics", f"$filter=statecode eq 0 and ({bu_filter})&$orderby=bhf_startdate desc", False),
        "tr_raw": ("bhf_triprate", f"$filter=statecode eq 0 and ({bu_filter})&$orderby=bhf_startdate desc", False),
        "ext_raw": ("bhf_external", f"$filter=statecode eq 0 and ({bu_filter})&$orderby=bhf_transactiondate desc", False),
        "ln_raw": ("bhf_borrowingagreement", f"$filter=statecode eq 0 and ({bu_filter})", False),
        "lns_raw": ("bhf_borrowing", f"$filter=statecode eq 0 and ({bu_filter})&$orderby=bhf_transactiondate desc", False),
        "cv_raw": ("bhf_conversion", f"$filter=statecode eq 0 and ({bu_filter})&$orderby=bhf_transactiondate desc", False),
        "jvp_raw": ("bhf_jvpartnership", f"$filter=statecode eq 0 and ({bu_filter})", False),
        "jvd_raw": ("bhf_jvdistribution", f"$filter=statecode eq 0 and ({bu_filter})&$orderby=bhf_transactiondate desc", False),
        "stm_raw": ("bhf_statement", f"$filter=statecode eq 0 and ({bu_filter})", False),
        "stml_raw": ("bhf_statementline", f"$filter=statecode eq 0 and ({bu_filter})", False),
        "dt_raw": ("bhf_dailytotal", f"$filter=statecode eq 0 and ({bu_filter})&$orderby=bhf_date desc&$top=400", True),
    }

    print(f"  Fetching {len(queries)} Dataverse tables concurrently (6 workers)...", flush=True)
    fetched = {}
    with ThreadPoolExecutor(max_workers=6) as ex:
        futs = {
            ex.submit(safe_get_fmt, tbl, q, True, top): k
            for k, (tbl, q, top) in queries.items()
        }
        for fut in futs:
            k = futs[fut]
            fetched[k] = fut.result()
            print(f"    -> {k}: {len(fetched[k])} rows", flush=True)

    cust_raw = fetched["cust_raw"]
    cust_vat_by_id = {
        (c.get("bhf_customerid") or "").lower(): bool(c.get("bhf_vatregistered"))
        for c in cust_raw
    }
    cust_vat_by_name = {
        (c.get("bhf_name") or "").strip().lower(): bool(c.get("bhf_vatregistered"))
        for c in cust_raw
        if c.get("bhf_name")
    }

    r_sales = fetched["r_sales"]
    sales_tickets = []
    for r in r_sales:
        bu = ID_TO_BU.get((r.get("_owningbusinessunit_value") or "").lower(), "WTC")
        net_tot = round(float(r.get("bhf_total") or 0), 2)
        vatinv = fmt_val(r, "_bhf_vatinvoice_value", "")
        cname = fmt_val(r, "_bhf_customer_value", "")
        cid_low = (r.get("_bhf_customer_value") or "").lower()
        method_lbl = fmt_val(r, "_bhf_method_value", "Credit")
        is_vat_reg = cust_vat_by_id.get(cid_low, False) or cust_vat_by_name.get(cname.strip().lower(), False)
        # m268 rule (m18a_tables.py): 11% VAT applies to every sale ticket of a VAT-registered (IVA) customer
        vat_amt = round(net_tot * 0.11, 4) if (is_vat_reg and method_lbl != "Free") else 0.0
        towner = fmt_val(r, "_bhf_supplier_value", "")
        if cname:
            mfg_cust_names.add(cname)
        if towner:
            mfg_sup_names.add(towner)
        sales_tickets.append({
            "id": r["bhf_salesticketid"],
            "name": r.get("bhf_name") or "",
            "ticket_no": r.get("bhf_ticketno") or "(no number)",
            "date": str(r.get("bhf_transactiondate") or "")[:10],
            "rep_date": str(r.get("bhf_expecteddate") or r.get("bhf_transactiondate") or "")[:10],
            "company": bu,
            "sale_type_code": r.get("bhf_saletype"),
            "sale_type": fmt_val(r, "bhf_saletype", "Delivery"),
            "transport_by_code": r.get("bhf_transportby"),
            "transport_by": fmt_val(r, "bhf_transportby", "Third-party truck"),
            "customer": cname,
            "product": fmt_val(r, "_bhf_product_value", ""),
            "site": fmt_val(r, "_bhf_site_value", ""),
            "truck_owner": towner,
            "truck": fmt_val(r, "_bhf_equipment_value", ""),
            "driver": fmt_val(r, "_bhf_driver_value", ""),
            "uom": fmt_val(r, "_bhf_unit_value", "m³"),
            "qty": round(float(r.get("bhf_quantity") or 0), 2),
            "external_qty": r.get("bhf_externalquantity"),
            "unit_price": round(float(r.get("bhf_unitprice") or 0), 2),
            "price": round(float(r.get("bhf_price") or 0), 2),
            "trans_unit_price": round(float(r.get("bhf_transunitprice") or 0), 2),
            "trans_price": round(float(r.get("bhf_transprice") or 0), 2),
            "tip": round(float(r.get("bhf_tip") or 0), 2),
            "discount": round(float(r.get("bhf_discount") or 0), 2),
            "total": net_tot,
            "vat": vat_amt,
            "total_ttc": round(net_tot + vat_amt, 4),
            "method": method_lbl,
            "vat_invoice": vatinv,
            "external_invoice": r.get("bhf_externalinvoice") or "",
            "reference": r.get("bhf_reference") or "",
            "notes": r.get("bhf_notes") or "",
            "time": r.get("bhf_time") or "12:00",
            "overtime": bool(r.get("bhf_overtime")),
        })
    print(f"  All Sales Tickets: {len(sales_tickets)}", flush=True)

    r_raw = fetched["r_raw"]
    raw_purchases = []
    for r in r_raw:
        bu = ID_TO_BU.get((r.get("_owningbusinessunit_value") or "").lower(), "WTC")
        sname = fmt_val(r, "_bhf_site_value", "")
        towner = fmt_val(r, "_bhf_supplier_value", "")
        sowner = site_owner_map.get(sname) or towner
        if towner:
            mfg_sup_names.add(towner)
        if sowner:
            mfg_sup_names.add(sowner)
        mat_cost = round(float(r.get("bhf_cost") or 0), 2)
        tr_cost = round(float(r.get("bhf_transcost") or 0), 2)
        raw_purchases.append({
            "id": r["bhf_rawpurchaseid"],
            "name": r.get("bhf_name") or "",
            "ticket_no": r.get("bhf_ticketno") or "(no number)",
            "date": str(r.get("bhf_transactiondate") or "")[:10],
            "rep_date": str(r.get("bhf_expecteddate") or r.get("bhf_transactiondate") or "")[:10],
            "company": bu,
            "product": fmt_val(r, "_bhf_product_value", ""),
            "site": sname,
            "site_owner": sowner,
            "transport_by_code": r.get("bhf_transportby"),
            "transport_by": fmt_val(r, "bhf_transportby", "Third-party truck"),
            "truck_owner": towner,
            "truck": fmt_val(r, "_bhf_equipment_value", ""),
            "driver": fmt_val(r, "_bhf_driver_value", ""),
            "uom": fmt_val(r, "_bhf_unit_value", "m³"),
            "qty": round(float(r.get("bhf_quantity") or 0), 2),
            "discount": round(float(r.get("bhf_discount") or 0), 2),
            "unit_cost": round(float(r.get("bhf_unitcost") or 0), 2),
            "cost": mat_cost,
            "trans_unit_cost": round(float(r.get("bhf_transunitcost") or 0), 2),
            "trans_cost": tr_cost,
            "total": round(mat_cost + tr_cost, 2),
            "external_invoice": r.get("bhf_externalinvoice") or "",
            "reference": r.get("bhf_reference") or "",
            "notes": r.get("bhf_notes") or "",
            "method": "Credit",
            "time": r.get("bhf_time") or "12:00",
            "overtime": bool(r.get("bhf_overtime")),
        })
    print(f"  All Raw Purchases: {len(raw_purchases)}", flush=True)

    r_fuel = fetched["r_fuel"]
    fuel_intakes = []
    for r in r_fuel:
        bu = ID_TO_BU.get((r.get("_owningbusinessunit_value") or "").lower(), "WTC")
        fuel_intakes.append({
            "id": r["bhf_fuelintakeid"],
            "name": r.get("bhf_name") or "",
            "ticket_no": r.get("bhf_ticketno") or "—",
            "date": str(r.get("bhf_transactiondate") or "")[:10],
            "rep_date": str(r.get("bhf_reportingdate") or r.get("bhf_transactiondate") or "")[:10],
            "company": bu,
            "fuel_type_code": r.get("bhf_fueltype"),
            "fuel_type": fmt_val(r, "bhf_fueltype", "Diesel"),
            "item": fmt_val(r, "_bhf_product_value", "Diesel"),
            "equipment": fmt_val(r, "_bhf_equipment_value", ""),
            "driver": fmt_val(r, "_bhf_driver_value", ""),
            "litres": round(float(r.get("bhf_intake") or 0), 2),
            "odometer": r.get("bhf_odometer"),
            "hours": r.get("bhf_hours"),
            "location": fmt_val(r, "_bhf_site_value", ""),
            "notes": r.get("bhf_notes") or "",
        })
    print(f"  All Fuel Intakes: {len(fuel_intakes)}", flush=True)

    gl_by_id = {
        (g.get("bhf_glaccountid") or "").lower(): str(g.get("bhf_code") or "").strip()
        for g in (fetched.get("gl_raw") or [])
    }
    ec_raw = fetched["ec_raw"]
    expense_categories = []
    for c in ec_raw:
        gl_code = gl_by_id.get((c.get("_bhf_glaccount_value") or "").lower(), "")
        cost_cls = (
            "Production Cost"
            if gl_code[:2] in ("60", "61")
            else ("Capital Expenditure" if gl_code[:1] == "2" else "Operating Expense")
        )
        expense_categories.append({
            "id": c["bhf_expensecategoryid"],
            "name": c.get("bhf_name") or "",
            "gl_code": gl_code,
            "cost_class": cost_cls,
        })

    esc_raw = fetched["esc_raw"]
    expense_subcategories = [
        {
            "id": sc["bhf_expensesubcategoryid"],
            "name": sc.get("bhf_name") or "",
            "category_id": sc.get("_bhf_category_value") or "",
            "category": fmt_val(sc, "_bhf_category_value", ""),
        }
        for sc in esc_raw
    ]

    r_exp = fetched["r_exp"]
    expenses = []
    for r in r_exp:
        bu = ID_TO_BU.get((r.get("_owningbusinessunit_value") or "").lower(), "WTC")
        sname = fmt_val(r, "_bhf_supplier_value", "")
        if sname:
            mfg_sup_names.add(sname)
        expenses.append({
            "id": r["bhf_expenseid"],
            "name": r.get("bhf_name") or "",
            "date": str(r.get("bhf_transactiondate") or "")[:10],
            "rep_date": str(r.get("bhf_reportingdate") or r.get("bhf_transactiondate") or "")[:10],
            "company": bu,
            "invoice": r.get("bhf_invoice") or "",
            "category": fmt_val(r, "_bhf_category_value", ""),
            "subcategory": fmt_val(r, "_bhf_subcategory_value", ""),
            "supplier": sname,
            "equipment": fmt_val(r, "_bhf_equipment_value", ""),
            "method": fmt_val(r, "_bhf_method_value", "Cash"),
            "qty": round(float(r.get("bhf_quantity") or 0), 2),
            "usd_amount": r.get("bhf_usdamount"),
            "lbp_amount": r.get("bhf_lbpamount"),
            "amount": round(float(r.get("bhf_usdvalue") or 0), 2),
            "reference": r.get("bhf_reference") or "",
            "notes": r.get("bhf_notes") or "",
        })
    print(f"  All Expenses: {len(expenses)} · Categories: {len(expense_categories)} · Subcategories: {len(expense_subcategories)}", flush=True)

    r_rcpt = fetched["r_rcpt"]
    receipts = []
    for r in r_rcpt:
        bu = ID_TO_BU.get((r.get("_owningbusinessunit_value") or "").lower(), "WTC")
        cname = fmt_val(r, "_bhf_customer_value", "")
        if cname:
            mfg_cust_names.add(cname)
        receipts.append({
            "id": r["bhf_customerreceiptid"],
            "name": r.get("bhf_name") or "",
            "date": str(r.get("bhf_transactiondate") or "")[:10],
            "rep_date": str(r.get("bhf_reportingdate") or r.get("bhf_transactiondate") or "")[:10],
            "company": bu,
            "customer": cname,
            "method": fmt_val(r, "_bhf_method_value", "Payment"),
            "record_ticket": fmt_val(r, "_bhf_salesticket_value", ""),
            "vat_invoice": fmt_val(r, "_bhf_vatinvoice_value", ""),
            "usd_amount": r.get("bhf_usdamount"),
            "lbp_amount": r.get("bhf_lbpamount"),
            "amount": round(float(r.get("bhf_usdvalue") or 0), 2),
            "discount": round(float(r.get("bhf_discount") or 0), 2),
            "reference": r.get("bhf_reference") or "",
            "notes": r.get("bhf_notes") or "",
        })
    print(f"  All Customer Receipts: {len(receipts)}", flush=True)

    r_spay = fetched["r_spay"]
    settlements = []
    for r in r_spay:
        bu = ID_TO_BU.get((r.get("_owningbusinessunit_value") or "").lower(), "WTC")
        sname = fmt_val(r, "_bhf_supplier_value", "")
        if sname:
            mfg_sup_names.add(sname)
        settlements.append({
            "id": r["bhf_supplierpaymentid"],
            "name": r.get("bhf_name") or "",
            "date": str(r.get("bhf_transactiondate") or "")[:10],
            "rep_date": str(r.get("bhf_reportingdate") or r.get("bhf_transactiondate") or "")[:10],
            "company": bu,
            "supplier": sname,
            "method": fmt_val(r, "_bhf_method_value", "Payment"),
            "expense_record": fmt_val(r, "_bhf_expense_value", ""),
            "raw_ticket": fmt_val(r, "_bhf_rawpurchase_value", ""),
            "invoice": r.get("bhf_invoice") or "",
            "usd_amount": r.get("bhf_usdamount"),
            "lbp_amount": r.get("bhf_lbpamount"),
            "amount": round(float(r.get("bhf_usdvalue") or 0), 2),
            "discount": round(float(r.get("bhf_difference") or 0), 2),
            "reference": r.get("bhf_reference") or "",
            "notes": r.get("bhf_notes") or "",
        })
    print(f"  All Supplier Settlements: {len(settlements)}", flush=True)

    cust_raw = fetched["cust_raw"]
    customers_master = []
    for c in cust_raw:
        cname = c.get("bhf_name") or ""
        m_lbl = fmt_val(c, "bhf_method", "")
        if not m_lbl and c.get("bhf_method") in (684000000, 684000001):
            m_lbl = "Cash" if c.get("bhf_method") == 684000000 else "Credit"
        is_mfg = (
            cname in mfg_cust_names
            or bool(c.get("bhf_method"))
            or bool(c.get("bhf_externalinvoice"))
            or bool(c.get("bhf_customerdeclaredquantity"))
        )
        if is_mfg:
            customers_master.append({
                "id": c["bhf_customerid"],
                "name": cname,
                "official_name": c.get("bhf_officialname") or cname,
                "phone": c.get("bhf_phone") or "",
                "address": c.get("bhf_address") or "",
                "method": m_lbl or "Credit",
                "vat_registered": bool(c.get("bhf_vatregistered")),
                "mof_no": c.get("bhf_mofno") or "",
                "external_invoice": bool(c.get("bhf_externalinvoice")),
                "customer_declared_qty": bool(c.get("bhf_customerdeclaredquantity")),
                "notes": c.get("bhf_notes") or "",
            })

    sup_raw = fetched["sup_raw"]
    for s in sites:
        if s.get("supplier"):
            mfg_sup_names.add(s["supplier"])
    for e in equipment:
        if e.get("supplier"):
            mfg_sup_names.add(e["supplier"])
    for d in drivers:
        if d.get("truck_owner"):
            mfg_sup_names.add(d["truck_owner"])

    suppliers_master = []
    for s in sup_raw:
        sname = s.get("bhf_name") or ""
        t_list = owner_trucks_map.get(sname, [])
        d_list = owner_drivers_map.get(sname, [])
        if sname in mfg_sup_names or t_list or d_list:
            suppliers_master.append({
                "id": s["bhf_supplierid"],
                "name": sname,
                "official_name": s.get("bhf_officialname") or sname,
                "contact": s.get("bhf_contact") or "",
                "location": s.get("bhf_location") or "",
                "financial_no": s.get("bhf_financialno") or "",
                "method": fmt_val(s, "bhf_method", "Credit"),
                "category1": fmt_val(s, "bhf_category1", ""),
                "category2": fmt_val(s, "bhf_category2", ""),
                "category3": fmt_val(s, "bhf_category3", ""),
                "iva": bool(s.get("bhf_iva")),
                "is_truck_owner": len(t_list) > 0,
                "trucks_count": len(t_list),
                "trucks": [t["name"] for t in t_list],
                "drivers": d_list,
                "notes": s.get("bhf_notes") or "",
            })
    print(f"  Master Customers (Mfg): {len(customers_master)} · Master Suppliers (Mfg): {len(suppliers_master)}", flush=True)

    r_sal = fetched["r_sal"]
    salaries = [_build_salary_row(r) for r in r_sal]

    emp_raw = fetched["emp_raw"]
    employments = []
    mfg_staff_names = set()
    for e in emp_raw:
        bu = ID_TO_BU.get((e.get("_owningbusinessunit_value") or "").lower(), "WTC")
        st_name = fmt_val(e, "_bhf_staff_value", "")
        if st_name:
            mfg_staff_names.add(st_name)
        employments.append({
            "id": e["bhf_employmentid"],
            "name": e.get("bhf_name") or "",
            "company": bu,
            "staff": st_name,
            "role": fmt_val(e, "_bhf_role_value", "") or e.get("bhf_jobtitle") or "",
            "type": fmt_val(e, "bhf_employmenttype", "Regular"),
            "salary_usd": float(e.get("bhf_basesalary") or e.get("bhf_usdamount") or 0),
            "daily_rate": float(e.get("bhf_dailyrate") or e.get("bhf_rate") or 0),
            "start_date": str(e.get("bhf_startdate") or "")[:10],
            "end_date": str(e.get("bhf_enddate") or "")[:10],
            "status": fmt_val(e, "bhf_status", "Active"),
            "notes": e.get("bhf_notes") or "",
        })

    att_raw = fetched["att_raw"]
    attendance_records = []
    for a in att_raw:
        row_a = _build_attendance_row(a)
        if row_a["staff"]:
            mfg_staff_names.add(row_a["staff"])
        attendance_records.append(row_a)

    flw_raw = fetched["flw_raw"]
    freelance_entries = []
    for f in flw_raw:
        bu = ID_TO_BU.get((f.get("_owningbusinessunit_value") or "").lower(), "WTC")
        st_name = fmt_val(f, "_bhf_staff_value", "")
        if st_name:
            mfg_staff_names.add(st_name)
        freelance_entries.append({
            "id": f["bhf_freelanceworkid"],
            "name": f.get("bhf_name") or "",
            "company": bu,
            "date": str(f.get("bhf_transactiondate") or "")[:10],
            "staff": st_name,
            "days": float(f.get("bhf_days") or f.get("bhf_quantity") or 1),
            "rate": float(f.get("bhf_rate") or f.get("bhf_unitprice") or 0),
            "amount": float(f.get("bhf_usdvalue") or f.get("bhf_total") or 0),
            "notes": f.get("bhf_notes") or "",
        })

    flp_raw = fetched["flp_raw"]
    freelance_payments = []
    for f in flp_raw:
        bu = ID_TO_BU.get((f.get("_owningbusinessunit_value") or "").lower(), "WTC")
        st_name = fmt_val(f, "_bhf_staff_value", "")
        if st_name:
            mfg_staff_names.add(st_name)
        freelance_payments.append({
            "id": f["bhf_freelancepaymentid"],
            "name": f.get("bhf_name") or "",
            "company": bu,
            "date": str(f.get("bhf_transactiondate") or "")[:10],
            "staff": st_name,
            "method": fmt_val(f, "_bhf_method_value", "Cash"),
            "usd_amount": f.get("bhf_usdamount"),
            "lbp_amount": f.get("bhf_lbpamount"),
            "amount": float(f.get("bhf_usdvalue") or 0),
            "reference": f.get("bhf_reference") or "",
            "notes": f.get("bhf_notes") or "",
        })

    log_raw = fetched["log_raw"]
    logistics_allowances = []
    for lg in log_raw:
        bu = ID_TO_BU.get((lg.get("_owningbusinessunit_value") or "").lower(), "WTC")
        st_name = fmt_val(lg, "_bhf_staff_value", "")
        if st_name:
            mfg_staff_names.add(st_name)
        days = [d[:3] for d, col in [("Mon", "bhf_monday"), ("Tue", "bhf_tuesday"), ("Wed", "bhf_wednesday"),
                                     ("Thu", "bhf_thursday"), ("Fri", "bhf_friday"), ("Sat", "bhf_saturday"), ("Sun", "bhf_sunday")] if lg.get(col)]
        logistics_allowances.append({
            "id": lg["bhf_logisticsid"],
            "name": lg.get("bhf_name") or "",
            "company": bu,
            "staff": st_name,
            "site": fmt_val(lg, "_bhf_site_value", ""),
            "equipment": fmt_val(lg, "_bhf_equipment_value", ""),
            "usd_amount": lg.get("bhf_usdamount"),
            "lbp_amount": lg.get("bhf_lbpamount"),
            "daily_usd": float(lg.get("bhf_usdvalue") or lg.get("bhf_usdamount") or 0),
            "working_days": ", ".join(days) if days else "Mon-Sat",
            "mon": bool(lg.get("bhf_monday", True)),
            "tue": bool(lg.get("bhf_tuesday", True)),
            "wed": bool(lg.get("bhf_wednesday", True)),
            "thu": bool(lg.get("bhf_thursday", True)),
            "fri": bool(lg.get("bhf_friday", True)),
            "sat": bool(lg.get("bhf_saturday", True)),
            "sun": bool(lg.get("bhf_sunday", False)),
            "start_date": str(lg.get("bhf_startdate") or "")[:10],
            "end_date": str(lg.get("bhf_enddate") or "")[:10],
            "notes": lg.get("bhf_notes") or "",
        })

    tr_raw = fetched["tr_raw"]
    overtime_rates = []
    for tr in tr_raw:
        bu = ID_TO_BU.get((tr.get("_owningbusinessunit_value") or "").lower(), "WTC")
        overtime_rates.append({
            "id": tr["bhf_triprateid"],
            "name": tr.get("bhf_name") or "",
            "company": bu,
            "region": fmt_val(tr, "_bhf_region_value", ""),
            "amount": float(tr.get("bhf_amount") or 0),
            "start_date": str(tr.get("bhf_startdate") or "")[:10],
            "end_date": str(tr.get("bhf_enddate") or "")[:10],
            "notes": tr.get("bhf_notes") or "",
        })
    print(f"  Payroll: {len(salaries)} salaries · {len(employments)} employments · {len(attendance_records)} attendance · {len(logistics_allowances)} allowances · {len(overtime_rates)} OT rates", flush=True)

    ext_raw = fetched["ext_raw"]
    external_movements = [_build_external_row(ex) for ex in ext_raw]

    ln_raw = fetched["ln_raw"]
    loans = []
    for ln in ln_raw:
        bu = ID_TO_BU.get((ln.get("_owningbusinessunit_value") or "").lower(), "WTC")
        loans.append({
            "id": ln["bhf_borrowingagreementid"],
            "name": ln.get("bhf_name") or "",
            "company": bu,
            "lender": fmt_val(ln, "_bhf_staff_value", "") or fmt_val(ln, "_bhf_company_value", "") or fmt_val(ln, "_bhf_partner_value", "") or fmt_val(ln, "_bhf_supplier_value", "") or ln.get("bhf_lender") or "",
            "direction": fmt_val(ln, "bhf_direction", ""),
            "opening_balance": bool(ln.get("bhf_openingbalance")),
            "usd_amount": ln.get("bhf_usdamount"),
            "lbp_amount": ln.get("bhf_lbpamount"),
            "principal": float(ln.get("bhf_principal") or ln.get("bhf_usdvalue") or ln.get("bhf_amount") or 0),
            "interest_rate": float(ln.get("bhf_interestrate") or 0),
            "start_date": str(ln.get("bhf_startdate") or "")[:10],
            "end_date": str(ln.get("bhf_enddate") or "")[:10],
            "notes": ln.get("bhf_notes") or "",
        })

    lns_raw = fetched["lns_raw"]
    loan_settlements = []
    for ls in lns_raw:
        bu = ID_TO_BU.get((ls.get("_owningbusinessunit_value") or "").lower(), "WTC")
        ls_method = fmt_val(ls, "_bhf_method_value", "") or fmt_val(ls, "bhf_type", "Outflow")
        ls_type = "Drawdown" if ls_method == "Inflow" else ("Config" if ls_method == "Config" else "Repayment")
        loan_settlements.append({
            "id": ls["bhf_borrowingid"],
            "name": ls.get("bhf_name") or "",
            "company": bu,
            "date": str(ls.get("bhf_transactiondate") or "")[:10],
            "loan": fmt_val(ls, "_bhf_agreement_value", "") or fmt_val(ls, "_bhf_borrowingagreement_value", ""),
            "borrower": fmt_val(ls, "_bhf_staff_value", "") or fmt_val(ls, "_bhf_purpose_value", ""),
            "type": ls_type,
            "method": ls_method or "Cash",
            "usd_amount": ls.get("bhf_usdamount"),
            "lbp_amount": ls.get("bhf_lbpamount"),
            "amount": float(ls.get("bhf_usdvalue") or 0),
            "reference": ls.get("bhf_reference") or "",
            "notes": ls.get("bhf_notes") or "",
        })

    cv_raw = fetched["cv_raw"]
    conversions = [_build_conversion_row(cv) for cv in cv_raw]

    jvp_raw = fetched["jvp_raw"]
    jv_partnerships = []
    for jp in jvp_raw:
        bu = ID_TO_BU.get((jp.get("_owningbusinessunit_value") or "").lower(), "WTC")
        jv_partnerships.append({
            "id": jp["bhf_jvpartnershipid"],
            "name": jp.get("bhf_name") or "",
            "company": bu,
            "site": fmt_val(jp, "_bhf_site_value", ""),
            "partner": fmt_val(jp, "_bhf_partner_value", ""),
            "percentage": float(jp.get("bhf_percentage") or 0),
            "start_date": str(jp.get("bhf_startdate") or "")[:10],
            "end_date": str(jp.get("bhf_enddate") or "")[:10],
            "notes": jp.get("bhf_notes") or "",
        })

    jvd_raw = fetched["jvd_raw"]
    jv_distributions = []
    for jd in jvd_raw:
        bu = ID_TO_BU.get((jd.get("_owningbusinessunit_value") or "").lower(), "WTC")
        jv_distributions.append({
            "id": jd["bhf_jvdistributionid"],
            "name": jd.get("bhf_name") or "",
            "company": bu,
            "date": str(jd.get("bhf_transactiondate") or "")[:10],
            "rep_date": str(jd.get("bhf_reportingdate") or jd.get("bhf_transactiondate") or "")[:10],
            "site": fmt_val(jd, "_bhf_site_value", ""),
            "partner": fmt_val(jd, "_bhf_partner_value", ""),
            "basis": fmt_val(jd, "bhf_basis", "Cash"),
            "amount": float(jd.get("bhf_amount") or 0),
            "difference": float(jd.get("bhf_difference") or 0),
            "total": float(jd.get("bhf_total") or jd.get("bhf_amount") or 0),
            "reference": jd.get("bhf_reference") or "",
            "notes": jd.get("bhf_notes") or "",
        })

    stm_raw = fetched["stm_raw"]
    statements = []
    for st in stm_raw:
        bu = ID_TO_BU.get((st.get("_owningbusinessunit_value") or "").lower(), "WTC")
        statements.append({
            "id": st["bhf_statementid"],
            "name": st.get("bhf_name") or "",
            "company": bu,
            "side": fmt_val(st, "bhf_side", "Customer"),
            "customer": fmt_val(st, "_bhf_customer_value", ""),
            "supplier": fmt_val(st, "_bhf_supplier_value", ""),
            "start_date": str(st.get("bhf_startdate") or "")[:10],
            "end_date": str(st.get("bhf_enddate") or "")[:10],
            "basis": fmt_val(st, "bhf_basis", "Accrual Date"),
            "status": fmt_val(st, "bhf_status", "Open"),
            "their_total": float(st.get("bhf_linestotal") or st.get("bhf_statementtotal") or 0),
            "our_total": float(st.get("bhf_ourtotal") or 0),
            "difference": float(st.get("bhf_difference") or 0),
            "lines_count": int(st.get("bhf_linescount") or 0),
            "matched_count": int(st.get("bhf_matchedcount") or 0),
            "exception_count": int(st.get("bhf_exceptioncount") or 0),
            "summary": st.get("bhf_summary") or "",
            "notes": st.get("bhf_notes") or "",
        })

    stml_raw = fetched["stml_raw"]
    statement_lines = []
    for sl in stml_raw:
        bu = ID_TO_BU.get((sl.get("_owningbusinessunit_value") or "").lower(), "WTC")
        statement_lines.append({
            "id": sl["bhf_statementlineid"],
            "name": sl.get("bhf_name") or "",
            "company": bu,
            "statement": fmt_val(sl, "_bhf_statement_value", ""),
            "line_no": sl.get("bhf_lineno"),
            "ticket_no": sl.get("bhf_ticketno") or "",
            "date": str(sl.get("bhf_date") or "")[:10],
            "product": fmt_val(sl, "_bhf_product_value", "") or sl.get("bhf_producttext") or "",
            "qty": float(sl.get("bhf_quantity") or 0),
            "unit_price": float(sl.get("bhf_unitprice") or 0),
            "amount": float(sl.get("bhf_amount") or 0),
            "result": fmt_val(sl, "bhf_result", "Matched"),
            "our_ticket_no": sl.get("bhf_ourticketno") or "",
            "our_date": str(sl.get("bhf_ourdate") or "")[:10],
            "our_qty": float(sl.get("bhf_ourquantity") or 0),
            "our_unit_price": float(sl.get("bhf_ourunitprice") or 0),
            "our_amount": float(sl.get("bhf_ouramount") or 0),
            "amount_diff": float(sl.get("bhf_amountdiff") or 0),
            "resolution": fmt_val(sl, "bhf_resolution", ""),
            "notes": sl.get("bhf_notes") or "",
        })

    dt_raw = fetched["dt_raw"]
    daily_totals = []
    for d in dt_raw:
        bu = ID_TO_BU.get((d.get("_owningbusinessunit_value") or "").lower(), "WTC")
        daily_totals.append({
            "id": d["bhf_dailytotalid"],
            "name": d.get("bhf_name") or "",
            "company": bu,
            "date": str(d.get("bhf_date") or "")[:10],
            "domain": fmt_val(d, "bhf_domain", "Sales"),
            "origin": fmt_val(d, "bhf_origin", "Dataverse"),
            "kind": fmt_val(d, "bhf_kind", "Snapshot"),
            "value": float(d.get("bhf_value") or 0),
            "previous_value": float(d.get("bhf_previousvalue") or 0),
            "change": float(d.get("bhf_change") or 0),
            "row_count": int(d.get("bhf_rowcount") or 0),
            "version": d.get("bhf_version") or "v1",
            "notes": d.get("bhf_notes") or "",
        })
    print(f"  Treasury/JVs/Recon: {len(external_movements)} external · {len(loans)} loans · {len(jv_partnerships)} JVs · {len(statements)} statements · {len(daily_totals)} daily totals", flush=True)

    return {
        "uoms": uoms,
        "product_types": product_types,
        "products": products,
        "regions": regions,
        "sites": sites,
        "equipment": equipment,
        "company_equipment": company_equipment,
        "drivers": drivers,
        "company_drivers": company_drivers,
        "customers": customers_master,
        "suppliers": suppliers_master,
        "price_rules": price_rules,
        "credit_terms": credit_terms,
        "vat_invoices": vat_invoices,
        "expense_categories": expense_categories,
        "expense_subcategories": expense_subcategories,
        "sales_tickets": sales_tickets,
        "raw_purchases": raw_purchases,
        "fuel_intakes": fuel_intakes,
        "expenses": expenses,
        "receipts": receipts,
        "settlements": settlements,
        "salaries": salaries,
        "employments": employments,
        "attendance": attendance_records,
        "freelance_entries": freelance_entries,
        "freelance_payments": freelance_payments,
        "logistics_allowances": logistics_allowances,
        "overtime_rates": overtime_rates,
        "external_movements": external_movements,
        "loans": loans,
        "loan_settlements": loan_settlements,
        "conversions": conversions,
        "jv_partnerships": jv_partnerships,
        "jv_distributions": jv_distributions,
        "statements": statements,
        "statement_lines": statement_lines,
        "daily_totals": daily_totals,
    }


def _preserve_app_state(db_path):
    """Rows the web entry desk wrote into mfg.db (source = 'app'), the edited team seats and the sign-in log must
    survive a rebuild — the snapshot only carries Dataverse / Power BI data."""
    keep = {"tables": {}, "users": [], "auth_sessions": []}
    if not db_path.exists():
        return keep
    try:
        old = sqlite3.connect(str(db_path))
        old.row_factory = sqlite3.Row
        names = [r[0] for r in old.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()]
        for t in names:
            cols = {r[1] for r in old.execute(f"PRAGMA table_info({t})").fetchall()}
            if t == "users":
                keep["users"] = [dict(r) for r in old.execute("SELECT * FROM users").fetchall()]
            elif t == "auth_sessions":
                keep["auth_sessions"] = [dict(r) for r in old.execute("SELECT * FROM auth_sessions").fetchall()]
            elif "source" in cols:
                rows = [dict(r) for r in old.execute(f"SELECT * FROM {t} WHERE source = 'app'").fetchall()]
                if rows:
                    keep["tables"][t] = rows
        old.close()
    except Exception as e:  # a corrupt / locked db must never block the rebuild
        print(f"  [WARN] could not read app state from the old mfg.db: {e}", flush=True)
    n = sum(len(v) for v in keep["tables"].values())
    print(f"  Preserving {n} app-entered rows across {len(keep['tables'])} tables, {len(keep['users'])} seats, {len(keep['auth_sessions'])} sessions", flush=True)
    return keep


def _restore_app_state(cur, keep):
    app_cols = (("source", "TEXT DEFAULT ''"), ("entered_by", "TEXT DEFAULT ''"), ("entered_at", "TEXT DEFAULT ''"),
                ("voided", "INTEGER DEFAULT 0"), ("voided_by", "TEXT DEFAULT ''"), ("voided_at", "TEXT DEFAULT ''"), ("notes", "TEXT DEFAULT ''"))
    for t, rows in keep["tables"].items():
        cols = {r[1] for r in cur.execute(f"PRAGMA table_info({t})").fetchall()}
        if not cols:
            continue
        for col, ddl in app_cols:
            if col not in cols:
                cur.execute(f"ALTER TABLE {t} ADD COLUMN {col} {ddl}")
                cols.add(col)
        for row in rows:
            valid = {k: v for k, v in row.items() if k in cols}
            if not valid:
                continue
            cur.execute(f"INSERT OR REPLACE INTO {t} ({','.join(valid)}) VALUES ({','.join('?' for _ in valid)})", tuple(valid.values()))
    ucols = {r[1] for r in cur.execute("PRAGMA table_info(users)").fetchall()}
    for col, ddl in (
        ("pin_code", "TEXT DEFAULT '1111'"),
        ("last_login_at", "TEXT DEFAULT ''"),
        ("face_samples", "TEXT DEFAULT '[]'"),
        ("face_thumbs", "TEXT DEFAULT '[]'"),
        ("face_required", "INTEGER DEFAULT 0"),
        ("face_updated_at", "TEXT DEFAULT ''"),
    ):
        if col not in ucols:
            cur.execute(f"ALTER TABLE users ADD COLUMN {col} {ddl}")
            ucols.add(col)
    for u in keep["users"]:
        valid = {k: v for k, v in u.items() if k in ucols}
        cur.execute(f"INSERT OR REPLACE INTO users ({','.join(valid)}) VALUES ({','.join('?' for _ in valid)})", tuple(valid.values()))
    if keep["auth_sessions"]:
        cur.execute("CREATE TABLE IF NOT EXISTS auth_sessions (id TEXT PRIMARY KEY, user_id TEXT, email TEXT, full_name TEXT, role TEXT, companies TEXT, device TEXT, logged_in_at TEXT, method TEXT DEFAULT 'PIN', confidence REAL)")
        for s in keep["auth_sessions"]:
            cur.execute("INSERT OR REPLACE INTO auth_sessions (id, user_id, email, full_name, role, companies, device, logged_in_at, method, confidence) VALUES (?,?,?,?,?,?,?,?,?,?)",
                        (s.get("id"), s.get("user_id"), s.get("email"), s.get("full_name"), s.get("role"), s.get("companies"), s.get("device"), s.get("logged_in_at"), s.get("method") or "PIN", s.get("confidence")))


def build_sqlite_and_postgres(snapshot):
    db_path = DATA_DIR / "mfg.db"
    keep = _preserve_app_state(db_path)
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
        pin_code TEXT DEFAULT '1111',
        role TEXT NOT NULL,
        companies TEXT NOT NULL,
        pbi_access TEXT DEFAULT 'full',
        statements_access TEXT DEFAULT 'full',
        status TEXT DEFAULT 'Active',
        last_login_at TEXT DEFAULT '',
        face_samples TEXT DEFAULT '[]',
        face_thumbs TEXT DEFAULT '[]',
        face_required INTEGER DEFAULT 0,
        face_updated_at TEXT DEFAULT ''
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
        indiff_price REAL,
        trans_indiff_price REAL,
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

    cur.executemany(
        "INSERT INTO companies (key, name, code, currency, usd_rate, min_date) VALUES (?,?,?,?,?,?)",
        [
            ("wtc", "WTC (World Trading & Construction)", "WT", "USD", 90000, "2024-01-01"),
            ("bbconstruction", "BBConstruction", "BB", "USD", 90000, "2024-01-01"),
            ("lionstransport", "Lions Transport", "LT", "USD", 90000, "2024-01-01"),
        ],
    )

    if not keep["users"]:
        cur.executemany(
            "INSERT INTO users (id, full_name, email, pin_code, role, companies, pbi_access, statements_access, status) VALUES (?,?,?,?,?,?,?,?,?)",
            [
                ("u1", "Hussein Bdeir", "husseinbdeir@bhfirms.com", "1111", "Full Access (Owner)", "WTC,BBConstruction,Lions Transport", "full", "full", "Active"),
                ("u2", "Zeinab Rkein", "zeinabrkein@bhfirms.com", "2222", "Supervisor + Entry", "WTC,BBConstruction,Lions Transport", "full", "full", "Active"),
                ("u3", "Sabah Kassab", "sabahkassab@bhfirms.com", "3333", "Entry", "WTC", "partial", "partial", "Active"),
                ("u4", "WTC Plant Weighbridge 1", "scale1.wtc@bhfirms.com", "4444", "Entry", "WTC", "none", "partial", "Active"),
                ("u5", "WTC Site Dispatch", "quarry.wtc@bhfirms.com", "4545", "Entry", "WTC", "none", "none", "Active"),
                ("u6", "BBConstruction Batching Desk", "batch.bbc@bhfirms.com", "5555", "Entry", "BBConstruction", "partial", "partial", "Active"),
                ("u7", "BBConstruction Site Supervisor", "site.bbc@bhfirms.com", "6666", "Supervisor", "BBConstruction", "full", "full", "Active"),
                ("u8", "Lions Transport Fleet Controller", "fleet.lions@bhfirms.com", "7777", "Supervisor + Entry", "Lions Transport,WTC", "full", "partial", "Active"),
                ("u9", "Diesel & Garage Officer", "fuel.mfg@bhfirms.com", "7878", "Entry", "WTC,BBConstruction,Lions Transport", "none", "none", "Active"),
                ("u10", "Accounts Receivable Collector", "ar.mfg@bhfirms.com", "8888", "Sales", "WTC,BBConstruction", "partial", "full", "Active"),
            ],
        )

    rec = snapshot["records"]
    for p in rec["products"]:
        cur.execute("INSERT OR IGNORE INTO products (id, name, official_name, type, uom, ton_factor, input_product) VALUES (?,?,?,?,?,?,?)",
                    (p["id"], p["name"], p["official_name"], p["type"], p["uom"], p["ton_factor"], p["input_product"]))
    for s in rec["sites"]:
        cur.execute("INSERT OR IGNORE INTO sites (id, name, is_jv, region, supplier, address) VALUES (?,?,?,?,?,?)",
                    (s["id"], s["name"], 1 if s["is_jv"] else 0, s["region"], s["supplier"], s["address"]))
    for e in rec["equipment"]:
        cur.execute("INSERT OR IGNORE INTO equipment (id, name, plate_no, type, ownership, capacity, supplier, customer, default_driver) VALUES (?,?,?,?,?,?,?,?,?)",
                    (e["id"], e["name"], e["plate_no"], e["type"], e["ownership"], e["capacity"], e["supplier"], e["customer"], e["default_driver"]))
    for d in rec["drivers"]:
        cur.execute("INSERT OR IGNORE INTO drivers (id, name, phone, truck_owner) VALUES (?,?,?,?)",
                    (d["id"], d["name"], d["phone"], d["truck_owner"]))
    for pr in rec["price_rules"]:
        cur.execute("INSERT OR IGNORE INTO price_rules (id, name, company, rule_type, customer, supplier, product, site, unit, unit_price, trans_unit_price, indiff_price, trans_indiff_price, start_date, end_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (pr["id"], pr["name"], pr["company"], pr["rule_type"], pr["customer"], pr["supplier"], pr["product"], pr["site"], pr["unit"], pr["unit_price"], pr["trans_unit_price"], pr.get("indiff_price"), pr.get("trans_indiff_price"), pr["start_date"], pr["end_date"]))
    for t in rec["sales_tickets"]:
        cur.execute("INSERT OR IGNORE INTO sales_tickets (id, name, ticket_no, date, rep_date, company, sale_type, transport_by, customer, product, site, truck_owner, truck, driver, uom, qty, unit_price, price, trans_unit_price, trans_price, discount, total, vat, total_ttc, method, vat_invoice, time, overtime) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (t["id"], t["name"], t["ticket_no"], t["date"], t["rep_date"], t["company"], t["sale_type"], t["transport_by"], t["customer"], t["product"], t["site"], t["truck_owner"], t["truck"], t["driver"], t["uom"], t["qty"], t["unit_price"], t["price"], t["trans_unit_price"], t["trans_price"], t["discount"], t["total"], t["vat"], t["total_ttc"], t["method"], t["vat_invoice"], t["time"], 1 if t["overtime"] else 0))
    for r in rec["raw_purchases"]:
        cur.execute("INSERT OR IGNORE INTO raw_purchases (id, name, ticket_no, date, rep_date, company, product, site, site_owner, transport_by, truck_owner, truck, driver, uom, qty, unit_cost, cost, trans_unit_cost, trans_cost, total, method, time, overtime) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (r["id"], r["name"], r["ticket_no"], r["date"], r["rep_date"], r["company"], r["product"], r["site"], r["site_owner"], r["transport_by"], r["truck_owner"], r["truck"], r["driver"], r["uom"], r["qty"], r["unit_cost"], r["cost"], r["trans_unit_cost"], r["trans_cost"], r["total"], r["method"], r["time"], 1 if r["overtime"] else 0))
    for f in rec["fuel_intakes"]:
        cur.execute("INSERT OR IGNORE INTO fuel_intakes (id, name, ticket_no, date, company, fuel_type, item, equipment, driver, litres, odometer, hours, location) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (f["id"], f["name"], f["ticket_no"], f["date"], f["company"], f["fuel_type"], f["item"], f["equipment"], f["driver"], f["litres"], f["odometer"], f["hours"], f["location"]))
    for x in rec["expenses"]:
        cur.execute("INSERT OR IGNORE INTO expenses (id, name, date, rep_date, company, category, subcategory, supplier, equipment, method, qty, amount, reference) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (x["id"], x["name"], x["date"], x["rep_date"], x["company"], x["category"], x["subcategory"], x["supplier"], x["equipment"], x["method"], x["qty"], x["amount"], x["reference"]))
    for rc in rec["receipts"]:
        cur.execute("INSERT OR IGNORE INTO customer_receipts (id, name, date, company, customer, method, amount, discount, reference) VALUES (?,?,?,?,?,?,?,?,?)",
                    (rc["id"], rc["name"], rc["date"], rc["company"], rc["customer"], rc["method"], rc["amount"], rc["discount"], rc["reference"]))
    for sp in rec["settlements"]:
        cur.execute("INSERT OR IGNORE INTO supplier_payments (id, name, date, company, supplier, method, amount, discount, reference) VALUES (?,?,?,?,?,?,?,?,?)",
                    (sp["id"], sp["name"], sp["date"], sp["company"], sp["supplier"], sp["method"], sp["amount"], sp["discount"], sp["reference"]))
    for sl in rec["salaries"]:
        cur.execute("INSERT OR IGNORE INTO salary_payments (id, name, date, payroll_month, company, staff, method, amount) VALUES (?,?,?,?,?,?,?,?)",
                    (sl["id"], sl["name"], sl["date"], sl["payroll_month"], sl["company"], sl["staff"], sl["method"], sl["amount"]))

    _restore_app_state(cur, keep)
    conn.commit()
    conn.close()
    print(f"  SQLite DB created -> {db_path} ({db_path.stat().st_size // 1024} KB)", flush=True)


LEGACY_CF_MODELS = {
    "wtc": ("WTC", "04a3eb0b-2c3f-431f-8104-a2510e0ab9fb", "41071fac-d1fb-48e4-95f9-fac5fcf06578"),
    "bbconstruction": ("BBConstruction", "42f6db4a-8083-417b-ab51-a322e259cd75", "c3570df5-82d1-4dbb-bf5c-ea0835dc047c"),
}


def _leg_dax(ws, ds, query):
    for attempt in range(5):
        try:
            return sa.dax(ws, ds, query)
        except Exception as e:
            if "429" in str(e) and attempt < 4:
                time.sleep(20 * (attempt + 1))
                continue
            raise


def _num(v):
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


def _leg_first_ok(ws, ds, queries):
    last_err = None
    for q in queries:
        try:
            return _leg_dax(ws, ds, q)
        except Exception as e:
            last_err = e
    raise last_err


def _fetch_single_legacy_cf(model_key):
    co, ws, ds = LEGACY_CF_MODELS[model_key]
    bb = co == "BBConstruction"
    print(f"  Querying SharePoint Cash Flow & Till parity for {co}...", flush=True)

    head = _leg_dax(ws, ds, 'EVALUATE ROW("iu",[Cash Inflow $],"ou",[Cash Outflow $],"nu",[Net CF $],"il",[Cash Inflow LL],"ol",[Cash Outflow LL],"nl",[Net CF LL],"net",[Net Cash Flow],"r",[Latest Rate LBP])')[0]
    rate_lbp = int(round(_num(head.get("[r]")) or 89500))
    live_usd = round(_num(head.get("[nu]")), 2)
    live_lbp = int(round(_num(head.get("[nl]"))))
    if abs(live_usd) < 0.005:
        live_usd = 0.0
    if abs(live_lbp) <= 1:
        live_lbp = 0
    live_tot = round(live_usd + (live_lbp / rate_lbp), 2)

    daily_raw = _leg_dax(ws, ds, """
        EVALUATE FILTER(
            SUMMARIZECOLUMNS(Dates[Date], "iu", [Cash Inflow $], "ou", [Cash Outflow $], "il", [Cash Inflow LL], "ol", [Cash Outflow LL]),
            ABS([iu]) > 0.001 || ABS([ou]) > 0.001 || ABS([il]) > 0.5 || ABS([ol]) > 0.5
        ) ORDER BY Dates[Date] ASC
    """)
    daily = []
    for r in daily_raw:
        d_iso = str(r.get("Dates[Date]") or "")[:10]
        if not d_iso:
            continue
        daily.append([
            d_iso,
            round(_num(r.get("[iu]")), 2),
            round(_num(r.get("[ou]")), 2),
            int(round(_num(r.get("[il]")))),
            int(round(_num(r.get("[ol]")))),
        ])

    # 1. Sales CF
    sales_raw = _leg_dax(ws, ds, 'EVALUATE FILTER(SUMMARIZECOLUMNS(Sales[Customer], "u", [Sales CF], "l", [Sales CF LL]), ABS([u]) > 0.005 || ABS([l]) > 0.5)')
    sales_tot = _leg_dax(ws, ds, 'EVALUATE ROW("u", [Sales CF], "l", [Sales CF LL])')[0]
    sales_rows = sorted([
        {"name": str(r.get("Sales[Customer]") or "(Unspecified)"), "usd": round(_num(r.get("[u]")), 2), "lbp": int(round(_num(r.get("[l]"))))}
        for r in sales_raw
    ], key=lambda x: abs(x["usd"]) + abs(x["lbp"]) / rate_lbp, reverse=True)

    # 2. Expenses CF
    sup_col = "Suppliers[Supplier]"
    exp_raw = _leg_dax(ws, ds, f'EVALUATE FILTER(SUMMARIZECOLUMNS({sup_col}, "u", [TE CF $], "l", [Expenses CF LL]), ABS([u]) > 0.005 || ABS([l]) > 0.5)')
    exp_tot = _leg_dax(ws, ds, 'EVALUATE ROW("u", [TE CF $], "l", [Expenses CF LL])')[0]
    exp_rows = sorted([
        {"name": str(r.get(sup_col) or "(Unspecified)"), "usd": round(_num(r.get("[u]")), 2), "lbp": int(round(_num(r.get("[l]"))))}
        for r in exp_raw
    ], key=lambda x: abs(x["usd"]) + abs(x["lbp"]) / rate_lbp, reverse=True)

    # 3. Borrowing CF
    bor_paid_u = "[Borrow Gave $]" if bb else "[Borrow Gave A $]"
    bor_paid_l = "[Borrow Gave LL Link]" if bb else "[Borrow Gave LL]"
    bor_raw = _leg_dax(ws, ds, f'EVALUATE FILTER(SUMMARIZECOLUMNS(Borrowing[Borrower], "ru", [Borrow Received $], "rl", [Borrow Received LL], "pu", {bor_paid_u}, "pl", {bor_paid_l}), ABS([ru])>0.005 || ABS([rl])>0.5 || ABS([pu])>0.005 || ABS([pl])>0.5)')
    bor_tot = _leg_dax(ws, ds, f'EVALUATE ROW("ru", [Borrow Received $], "rl", [Borrow Received LL], "pu", {bor_paid_u}, "pl", {bor_paid_l})')[0]
    bor_rows = sorted([
        {
            "name": str(r.get("Borrowing[Borrower]") or "(Unspecified)"),
            "rec_usd": round(_num(r.get("[ru]")), 2),
            "rec_lbp": int(round(_num(r.get("[rl]")))),
            "paid_usd": round(_num(r.get("[pu]")), 2),
            "paid_lbp": int(round(_num(r.get("[pl]")))),
        }
        for r in bor_raw
    ], key=lambda x: abs(x["rec_usd"]) + abs(x["paid_usd"]) + (abs(x["rec_lbp"]) + abs(x["paid_lbp"])) / rate_lbp, reverse=True)

    # 4. Salary CF
    sal_raw = _leg_first_ok(ws, ds, [
        'EVALUATE FILTER(SUMMARIZECOLUMNS(Staff[Staff], "u", [Staff Payment A $], "l", [Staff Payment A LL]), ABS([u]) > 0.005 || ABS([l]) > 0.5)',
        'EVALUATE FILTER(SUMMARIZECOLUMNS(Staff[Staff], "u", [Staff Payment A $ Link], "l", [Staff Payment A LL Link]), ABS([u]) > 0.005 || ABS([l]) > 0.5)',
    ])
    sal_tot = _leg_first_ok(ws, ds, [
        'EVALUATE ROW("u", [Staff Payment A $], "l", [Staff Payment A LL])',
        'EVALUATE ROW("u", [Staff Payment A $ Link], "l", [Staff Payment A LL Link])',
    ])[0]
    sal_rows = sorted([
        {"name": str(r.get("Staff[Staff]") or "(Unspecified)"), "usd": round(_num(r.get("[u]")), 2), "lbp": int(round(_num(r.get("[l]"))))}
        for r in sal_raw
    ], key=lambda x: abs(x["usd"]) + abs(x["lbp"]) / rate_lbp, reverse=True)

    # 5. External CF
    ext_col = "External[Company]" if bb else "Stakeholders[Stakeholder]"
    ext_exp_u = "[External Expense $]" if bb else "[External Expenses $]"
    ext_raw = _leg_dax(ws, ds, f'EVALUATE FILTER(SUMMARIZECOLUMNS({ext_col}, "eu", {ext_exp_u}, "el", [External Expenses LL], "ru", [External Revenue $], "rl", [External Revenue LL]), ABS([eu])>0.005 || ABS([el])>0.5 || ABS([ru])>0.005 || ABS([rl])>0.5)')
    ext_tot = _leg_dax(ws, ds, f'EVALUATE ROW("eu", {ext_exp_u}, "el", [External Expenses LL], "ru", [External Revenue $], "rl", [External Revenue LL])')[0]
    ext_rows = sorted([
        {
            "name": str(r.get(ext_col) or "(Unspecified)"),
            "exp_usd": round(_num(r.get("[eu]")), 2),
            "exp_lbp": int(round(_num(r.get("[el]")))),
            "rev_usd": round(_num(r.get("[ru]")), 2),
            "rev_lbp": int(round(_num(r.get("[rl]")))),
        }
        for r in ext_raw
    ], key=lambda x: abs(x["exp_usd"]) + abs(x["rev_usd"]) + (abs(x["exp_lbp"]) + abs(x["rev_lbp"])) / rate_lbp, reverse=True)

    # 6. Extended CF
    if bb:
        extd_rows, extd_tot_u, extd_tot_l = [], 0.0, 0
    else:
        extd_raw = _leg_dax(ws, ds, 'EVALUATE FILTER(SUMMARIZECOLUMNS(Extended[Stakeholder], "u", [Extended Owes $], "l", [Extended Owes LL]), ABS([u])>0.005 || ABS([l])>0.5)')
        extd_tot = _leg_dax(ws, ds, 'EVALUATE ROW("u", [Extended Owes $], "l", [Extended Owes LL])')[0]
        extd_rows = sorted([
            {"name": str(r.get("Extended[Stakeholder]") or "(Unspecified)"), "usd": round(_num(r.get("[u]")), 2), "lbp": int(round(_num(r.get("[l]"))))}
            for r in extd_raw
        ], key=lambda x: abs(x["usd"]) + abs(x["lbp"]) / rate_lbp, reverse=True)
        extd_tot_u = round(_num(extd_tot.get("[u]")), 2)
        extd_tot_l = int(round(_num(extd_tot.get("[l]"))))

    # 7. Conversion CF
    conv_raw = _leg_dax(ws, ds, 'EVALUATE SUMMARIZECOLUMNS(Conversion[Type], "from", SUM(Conversion[From]), "to", SUM(Conversion[To]))')
    conv_rows = []
    for r in conv_raw:
        tp = str(r.get("Conversion[Type]") or "")
        if not tp:
            continue
        conv_rows.append({
            "type": tp,
            "from_amt": round(_num(r.get("[from]")), 2),
            "to_amt": round(_num(r.get("[to]")), 2),
        })
    conv_rows.sort(key=lambda x: 0 if "USD to LBP" in x["type"] else 1)

    return {
        "rate_lbp": rate_lbp,
        "live_till": {
            "usd": live_usd,
            "lbp": live_lbp,
            "total": live_tot,
            "rate_lbp": rate_lbp,
            "in_usd": round(_num(head.get("[iu]")), 2),
            "out_usd": round(_num(head.get("[ou]")), 2),
            "in_lbp": int(round(_num(head.get("[il]")))),
            "out_lbp": int(round(_num(head.get("[ol]")))),
        },
        "daily": daily,
        "tables": {
            "sales": {"rows": sales_rows, "totals": {"usd": round(_num(sales_tot.get("[u]")), 2), "lbp": int(round(_num(sales_tot.get("[l]"))))}},
            "expenses": {"rows": exp_rows, "totals": {"usd": round(_num(exp_tot.get("[u]")), 2), "lbp": int(round(_num(exp_tot.get("[l]"))))}},
            "borrowing": {
                "rows": bor_rows,
                "totals": {
                    "rec_usd": round(_num(bor_tot.get("[ru]")), 2),
                    "rec_lbp": int(round(_num(bor_tot.get("[rl]")))),
                    "paid_usd": round(_num(bor_tot.get("[pu]")), 2),
                    "paid_lbp": int(round(_num(bor_tot.get("[pl]")))),
                },
            },
            "salary": {"rows": sal_rows, "totals": {"usd": round(_num(sal_tot.get("[u]")), 2), "lbp": int(round(_num(sal_tot.get("[l]"))))}},
            "external": {
                "rows": ext_rows,
                "totals": {
                    "exp_usd": round(_num(ext_tot.get("[eu]")), 2),
                    "exp_lbp": int(round(_num(ext_tot.get("[el]")))),
                    "rev_usd": round(_num(ext_tot.get("[ru]")), 2),
                    "rev_lbp": int(round(_num(ext_tot.get("[rl]")))),
                },
            },
            "extended": {"rows": extd_rows, "totals": {"usd": extd_tot_u, "lbp": extd_tot_l}},
            "conversion": {
                "rows": conv_rows,
                "totals": {
                    "from_amt": round(sum(x["from_amt"] for x in conv_rows), 2),
                    "to_amt": round(sum(x["to_amt"] for x in conv_rows), 2),
                },
            },
        },
    }


def _merge_cf_sheets(sheets, rate_lbp=89500):
    by_day = defaultdict(lambda: [0.0, 0.0, 0, 0])
    live_in_u = live_out_u = 0.0
    live_in_l = live_out_l = 0
    live_usd = 0.0
    live_lbp = 0
    for sh in sheets:
        lt = sh["live_till"]
        live_in_u += lt["in_usd"]
        live_out_u += lt["out_usd"]
        live_in_l += lt["in_lbp"]
        live_out_l += lt["out_lbp"]
        live_usd += lt["usd"]
        live_lbp += lt["lbp"]
        for d, iu, ou, il, ol in sh["daily"]:
            acc = by_day[d]
            acc[0] += iu
            acc[1] += ou
            acc[2] += il
            acc[3] += ol
    daily = [[d, round(v[0], 2), round(v[1], 2), int(round(v[2])), int(round(v[3]))] for d, v in sorted(by_day.items())]

    def _merge_2col(tkey):
        acc = defaultdict(lambda: [0.0, 0])
        tu = 0.0
        tl = 0
        for sh in sheets:
            t = sh["tables"][tkey]
            tu += t["totals"]["usd"]
            tl += t["totals"]["lbp"]
            for r in t["rows"]:
                acc[r["name"]][0] += r["usd"]
                acc[r["name"]][1] += r["lbp"]
        rows = sorted([{"name": k, "usd": round(v[0], 2), "lbp": int(round(v[1]))} for k, v in acc.items()], key=lambda x: abs(x["usd"]) + abs(x["lbp"]) / rate_lbp, reverse=True)
        return {"rows": rows, "totals": {"usd": round(tu, 2), "lbp": int(round(tl))}}

    bor_acc = defaultdict(lambda: [0.0, 0, 0.0, 0])
    btot = {"rec_usd": 0.0, "rec_lbp": 0, "paid_usd": 0.0, "paid_lbp": 0}
    for sh in sheets:
        t = sh["tables"]["borrowing"]
        for k in btot:
            btot[k] += t["totals"][k]
        for r in t["rows"]:
            b = bor_acc[r["name"]]
            b[0] += r["rec_usd"]; b[1] += r["rec_lbp"]; b[2] += r["paid_usd"]; b[3] += r["paid_lbp"]
    bor_rows = sorted([{"name": k, "rec_usd": round(v[0], 2), "rec_lbp": int(round(v[1])), "paid_usd": round(v[2], 2), "paid_lbp": int(round(v[3]))} for k, v in bor_acc.items()], key=lambda x: abs(x["rec_usd"]) + abs(x["paid_usd"]) + (abs(x["rec_lbp"]) + abs(x["paid_lbp"])) / rate_lbp, reverse=True)

    ext_acc = defaultdict(lambda: [0.0, 0, 0.0, 0])
    etot = {"exp_usd": 0.0, "exp_lbp": 0, "rev_usd": 0.0, "rev_lbp": 0}
    for sh in sheets:
        t = sh["tables"]["external"]
        for k in etot:
            etot[k] += t["totals"][k]
        for r in t["rows"]:
            e = ext_acc[r["name"]]
            e[0] += r["exp_usd"]; e[1] += r["exp_lbp"]; e[2] += r["rev_usd"]; e[3] += r["rev_lbp"]
    ext_rows = sorted([{"name": k, "exp_usd": round(v[0], 2), "exp_lbp": int(round(v[1])), "rev_usd": round(v[2], 2), "rev_lbp": int(round(v[3]))} for k, v in ext_acc.items()], key=lambda x: abs(x["exp_usd"]) + abs(x["rev_usd"]) + (abs(x["exp_lbp"]) + abs(x["rev_lbp"])) / rate_lbp, reverse=True)

    conv_acc = defaultdict(lambda: [0.0, 0.0])
    for sh in sheets:
        for r in sh["tables"]["conversion"]["rows"]:
            conv_acc[r["type"]][0] += r["from_amt"]
            conv_acc[r["type"]][1] += r["to_amt"]
    conv_rows = [{"type": k, "from_amt": round(v[0], 2), "to_amt": round(v[1], 2)} for k, v in conv_acc.items()]
    conv_rows.sort(key=lambda x: 0 if "USD to LBP" in x["type"] else 1)

    live_usd = round(live_usd, 2)
    live_lbp = int(round(live_lbp))
    return {
        "rate_lbp": rate_lbp,
        "live_till": {
            "usd": live_usd,
            "lbp": live_lbp,
            "total": round(live_usd + live_lbp / rate_lbp, 2),
            "rate_lbp": rate_lbp,
            "in_usd": round(live_in_u, 2),
            "out_usd": round(live_out_u, 2),
            "in_lbp": int(round(live_in_l)),
            "out_lbp": int(round(live_out_l)),
        },
        "daily": daily,
        "tables": {
            "sales": _merge_2col("sales"),
            "expenses": _merge_2col("expenses"),
            "borrowing": {"rows": bor_rows, "totals": {k: (round(v, 2) if "usd" in k else int(round(v))) for k, v in btot.items()}},
            "salary": _merge_2col("salary"),
            "external": {"rows": ext_rows, "totals": {k: (round(v, 2) if "usd" in k else int(round(v))) for k, v in etot.items()}},
            "extended": _merge_2col("extended"),
            "conversion": {"rows": conv_rows, "totals": {"from_amt": round(sum(x["from_amt"] for x in conv_rows), 2), "to_amt": round(sum(x["to_amt"] for x in conv_rows), 2)}},
        },
    }


def apply_cashflow_till_parity(models):
    try:
        wtc_cf = _fetch_single_legacy_cf("wtc")
        bbc_cf = _fetch_single_legacy_cf("bbconstruction")
    except Exception as e:
        print(f"  [WARN] Legacy Cash Flow parity query skipped ({e}); retaining existing cash_flow_sheet if present.", flush=True)
        return

    empty_cf = _merge_cf_sheets([], 89500)
    grp_cf = _merge_cf_sheets([wtc_cf, bbc_cf], wtc_cf["rate_lbp"])
    cf_by_key = {
        "wtc": wtc_cf,
        "bbconstruction": bbc_cf,
        "lionstransport": empty_cf,
        "manufacturing-group": grp_cf,
    }

    period_bounds = {
        "mtd": ("2026-10-01", "2026-10-31"),
        "sep2026": ("2026-09-01", "2026-09-30"),
        "aug2026": ("2026-08-01", "2026-08-31"),
        "q3_2026": ("2026-07-01", "2026-09-30"),
        "ytd": ("2026-01-01", "2026-12-31"),
        "fy2025": ("2025-01-01", "2025-12-31"),
        "fy2024": ("2024-01-01", "2024-12-31"),
        "all": ("2024-01-01", "2030-12-31"),
    }

    for mkey, cf in cf_by_key.items():
        m_obj = models.get(mkey)
        if not m_obj:
            continue
        m_obj["cash_flow_sheet"] = cf
        if mkey == "lionstransport":
            continue
        rate = cf["rate_lbp"]
        lt = cf["live_till"]
        daily = cf["daily"]

        # Patch pre-computed period buckets
        periods = m_obj.get("periods") or {}
        for pk, (d0, d1) in period_bounds.items():
            p = periods.get(pk)
            if not p:
                continue
            if pk == "all":
                iu, ou, il, ol = lt["in_usd"], lt["out_usd"], lt["in_lbp"], lt["out_lbp"]
                cu, cl = lt["usd"], lt["lbp"]
            else:
                iu = round(sum(r[1] for r in daily if d0 <= r[0] <= d1), 2)
                ou = round(sum(r[2] for r in daily if d0 <= r[0] <= d1), 2)
                il = int(round(sum(r[3] for r in daily if d0 <= r[0] <= d1)))
                ol = int(round(sum(r[4] for r in daily if d0 <= r[0] <= d1)))
                cu = round(sum(r[1] - r[2] for r in daily if r[0] <= d1), 2)
                cl = int(round(sum(r[3] - r[4] for r in daily if r[0] <= d1)))
                if abs(cu) < 0.005:
                    cu = 0.0
                if abs(cl) <= 1:
                    cl = 0
            nu = round(iu - ou, 2)
            nl = int(round(il - ol))
            if abs(nu) < 0.005:
                nu = 0.0
            if abs(nl) <= 1:
                nl = 0
            p["rate_lbp"] = rate
            p["cash_till"] = lt["total"]
            p["cash_till_usd"] = lt["usd"]
            p["cash_till_lbp"] = lt["lbp"]
            p["period_till"] = round(cu + cl / rate, 2)
            p["period_till_usd"] = cu
            p["period_till_lbp"] = cl
            p["cash_in_usd"] = iu
            p["cash_out_usd"] = ou
            p["net_cash_usd"] = nu
            p["cash_in_lbp"] = il
            p["cash_out_lbp"] = ol
            p["net_cash_lbp"] = nl
            p["cash_inflow"] = round(iu + il / rate, 2)
            p["cash_outflow"] = round(ou + ol / rate, 2)
            p["net_cash_flow"] = round(nu + nl / rate, 2)

        # Patch monthly progression rows
        cum_u = 0.0
        cum_l = 0
        by_ym = defaultdict(lambda: [0.0, 0.0, 0, 0])
        for d, iu, ou, il, ol in daily:
            ym = int(d[:4]) * 100 + int(d[5:7])
            acc = by_ym[ym]
            acc[0] += iu; acc[1] += ou; acc[2] += il; acc[3] += ol
        # Seed any pre-2024 daily rows into opening cumulative if present
        for d, iu, ou, il, ol in daily:
            if int(d[:4]) * 100 + int(d[5:7]) < 202401:
                cum_u += iu - ou
                cum_l += il - ol
        for mrow in sorted(m_obj.get("monthly") or [], key=lambda x: int(x.get("YearMonthNo") or 0)):
            ym = int(mrow.get("YearMonthNo") or 0)
            iu, ou, il, ol = by_ym[ym]
            iu = round(iu, 2); ou = round(ou, 2); il = int(round(il)); ol = int(round(ol))
            nu = round(iu - ou, 2)
            nl = int(round(il - ol))
            cum_u = round(cum_u + nu, 2)
            cum_l = int(round(cum_l + nl))
            if abs(cum_u) < 0.005:
                cum_u = 0.0
            if abs(cum_l) <= 1:
                cum_l = 0
            mrow["cash_in_usd"] = iu
            mrow["cash_out_usd"] = ou
            mrow["net_cash_usd"] = nu
            mrow["till_usd"] = cum_u
            mrow["cash_in_lbp"] = il
            mrow["cash_out_lbp"] = ol
            mrow["net_cash_lbp"] = nl
            mrow["till_lbp"] = cum_l
            mrow["cash_in"] = round(iu + il / rate, 2)
            mrow["cash_out"] = round(ou + ol / rate, 2)
            mrow["net_cash"] = round(nu + nl / rate, 2)
            mrow["cash_till"] = round(cum_u + cum_l / rate, 2)

    print(
        f"  Cash Till Parity -> WTC: ${wtc_cf['live_till']['usd']:,.2f} & {wtc_cf['live_till']['lbp']:,} LL "
        f"| BBC: ${bbc_cf['live_till']['usd']:,.2f} & {bbc_cf['live_till']['lbp']:,} LL "
        f"| Group: ${grp_cf['live_till']['usd']:,.2f} & {grp_cf['live_till']['lbp']:,} LL",
        flush=True,
    )


def main():
    t0 = time.time()
    cf_only = "--cf-only" in sys.argv
    conv_only = "--conversions-only" in sys.argv
    cf_streams_only = "--cf-streams-only" in sys.argv
    skip_dax = "--skip-dax" in sys.argv or cf_only
    snap_path = DATA_DIR / "mfg_snapshot.json"
    if (cf_only or conv_only or cf_streams_only) and snap_path.exists():
        packed_payload = json.loads(snap_path.read_text(encoding="utf-8"))
        if cf_only:
            print("== Fast Cash Flow & Till Parity Patch (--cf-only) ==", flush=True)
            apply_cashflow_till_parity(packed_payload.get("models") or {})

        def _pack_single_table(tkey, pf, raw_rows, omit_name=False):
            import re as _re
            _WB_TAG_RE = _re.compile(r"\s*\[wb:[^\]]+\]")
            _MIG_TAG_RE = _re.compile(r"\s*\[m\d+[^\]]*\]", _re.I)
            has_rep = any("rep_date" in r for r in raw_rows)
            compact_rows = []
            for r in raw_rows:
                out = {}
                for ck, v in r.items():
                    if ck == "id" or (omit_name and ck == "name"):
                        continue
                    if ck == "notes" and isinstance(v, str):
                        v = _MIG_TAG_RE.sub("", _WB_TAG_RE.sub("", v)).strip()
                    if ck == "usd_amount" and v == r.get("amount") and not r.get("lbp_amount"):
                        continue
                    if ck == "rep_date" and v == r.get("date"):
                        continue
                    if v is None or v == "" or v == [] or v == {} or v is False or v == 0 or v == 0.0:
                        if ck not in ("total", "total_ttc", "amount", "qty", "litres"):
                            continue
                    out[ck] = v
                compact_rows.append(out)
            col_set = []
            seen_cols = set()
            for r in compact_rows:
                for ck in r.keys():
                    if ck not in seen_cols:
                        seen_cols.add(ck)
                        col_set.append(ck)
            sc = [1 if all(isinstance(r.get(c), str) or r.get(c) is None for r in compact_rows) else 0 for c in col_set]
            pool = list(packed_payload.get("_s") or [])
            pool_idx = {s: i for i, s in enumerate(pool)}
            str_counts = Counter()
            for r in compact_rows:
                for ci, c in enumerate(col_set):
                    if sc[ci]:
                        v = r.get(c)
                        if isinstance(v, str) and len(v) >= 2:
                            str_counts[v] += 1
            for s_val, cnt in str_counts.most_common():
                if cnt >= 2 and s_val not in pool_idx:
                    pool_idx[s_val] = len(pool)
                    pool.append(s_val)
            out_rows = []
            for r in compact_rows:
                arr = []
                for ci, c in enumerate(col_set):
                    v = r.get(c)
                    if sc[ci] and isinstance(v, str) and v in pool_idx:
                        v = pool_idx[v]
                    arr.append(v)
                while arr and arr[-1] is None:
                    arr.pop()
                out_rows.append(arr)
            packed_payload["_s"] = pool
            entry = {"c": col_set, "sc": sc, "r": out_rows, "p": pf}
            if has_rep:
                entry["hr"] = 1
            packed_payload.setdefault("records", {})[tkey] = entry
            print(f"  Patched {tkey} -> {len(out_rows)} rows · cols={col_set}", flush=True)

        bu_filter = " or ".join(f"_owningbusinessunit_value eq {g}" for g in BU_IDS.values())
        if conv_only:
            print("== Fast FX Conversions Patch (--conversions-only) ==", flush=True)
            cv_raw = safe_get_fmt("bhf_conversion", f"$filter=statecode eq 0 and ({bu_filter})&$orderby=bhf_transactiondate desc", True, False)
            _pack_single_table("conversions", "cv", [_build_conversion_row(cv) for cv in cv_raw])
        if cf_streams_only:
            print("== Fast Cash Flow Streams Patch (--cf-streams-only: salaries + attendance + external_movements) ==", flush=True)
            r_sal = safe_get_fmt("bhf_salarypayment", f"$filter=statecode eq 0 and ({bu_filter})&$orderby=bhf_transactiondate desc", True, False)
            att_raw = safe_get_fmt("bhf_attendance", f"$filter=statecode eq 0 and ({bu_filter})&$orderby=createdon desc", True, False)
            ext_raw = safe_get_fmt("bhf_external", f"$filter=statecode eq 0 and ({bu_filter})&$orderby=bhf_transactiondate desc", True, False)
            _pack_single_table("salaries", "sa", [_build_salary_row(r) for r in r_sal])
            _pack_single_table("attendance", "at", [_build_attendance_row(a) for a in att_raw], omit_name=True)
            _pack_single_table("external_movements", "em", [_build_external_row(ex) for ex in ext_raw])
        packed_payload["generated_at"] = dt.datetime.now().strftime("%Y-%m-%d %H:%M")
        snap_path.write_text(json.dumps(packed_payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"  Snapshot saved -> {snap_path} ({snap_path.stat().st_size // 1024} KB)", flush=True)
        unpacker_js = (
            "// Auto-generated from live Manufacturing Operations Dataverse + Semantic Models (Full 2024-2026 History)\n"
            "(function(){\n"
            "const P=" + json.dumps(packed_payload, ensure_ascii=False, separators=(",", ":")) + ";\n"
            "const S=P._s||[],R={};\n"
            "for(const[k,t]of Object.entries(P.records||{})){\n"
            "  if(!t||!t.c){R[k]=t||[];continue;}\n"
            "  const cols=t.c,sc=t.sc,pf=t.p,hr=t.hr,isSales=k==='sales_tickets',isRaw=k==='raw_purchases';\n"
            "  R[k]=t.r.map((row,idx)=>{\n"
            "    const o=pf?{id:pf+idx}:{};\n"
            "    for(let i=0;i<row.length;i++){\n"
            "      let v=row[i];\n"
            "      if(v===null||v===undefined)continue;\n"
            "      if(sc[i]&&typeof v==='number')v=S[v];\n"
            "      o[cols[i]]=v;\n"
            "    }\n"
            "    if(hr&&!o.rep_date&&o.date)o.rep_date=o.date;\n"
            "    if(o.amount!==undefined&&o.usd_amount===undefined&&!o.lbp_amount)o.usd_amount=o.amount;\n"
            "    if(isSales){\n"
            "      if(o.vat==null)o.vat=0;\n"
            "      if(o.total_ttc==null&&o.total!=null)o.total_ttc=o.total;\n"
            "      if(!o.sale_type)o.sale_type='Delivery';\n"
            "      if(!o.method)o.method='Credit';\n"
            "    }\n"
            "    if(isRaw&&!o.method)o.method='Credit';\n"
            "    if(pf&&!o.name)o.name=o.ticket_no?('#'+o.ticket_no+' · '+(o.date||'')):(pf.toUpperCase()+'-'+idx);\n"
            "    return o;\n"
            "  });\n"
            "}\n"
            "window.MFG_SEED={generated_at:P.generated_at,models:P.models,records:R,sentinels:P.sentinels};\n"
            "})();\n"
        )
        js_path = JS_DIR / "seed_data.js"
        js_path.write_text(unpacker_js, encoding="utf-8")
        print(f"  Browser bundle saved -> {js_path} ({js_path.stat().st_size // 1024} KB)", flush=True)
        print(f"\nALL DONE in {time.time() - t0:.1f}s!", flush=True)
        return
    if skip_dax and snap_path.exists():
        print("== Stage 1: Reusing fresh DAX models from mfg_snapshot.json ==", flush=True)
        models = json.loads(snap_path.read_text(encoding="utf-8")).get("models", {})
    else:
        print("== Stage 1: Extracting Live Manufacturing Operations Data ==", flush=True)
        models = {}
        for key in ("manufacturing-group", "wtc", "bbconstruction", "lionstransport"):
            models[key] = fetch_model_analytics(key)

    for mObj in models.values():
        for eqRow in (mObj or {}).get("equipment") or []:
            if str(eqRow.get("Equipment") or "").strip().lower() in ("tb1", "tb7", "tb9"):
                eqRow["Ownership"] = "Third Party"

    apply_cashflow_till_parity(models)
    records = fetch_dataverse_records()

    sentinels_path = Path(r"C:\Users\HusseinBdeir\bhfirms\manufacturing-operations\exports\m280_ai_sentinels_report.json")
    sentinels = json.loads(sentinels_path.read_text(encoding="utf-8")) if sentinels_path.exists() else {}

    snapshot = {
        "generated_at": dt.datetime.now().strftime("%Y-%m-%d %H:%M"),
        "models": models,
        "records": records,
        "sentinels": sentinels,
    }

    # The browser bundle / JSON snapshot drop empty values and the lookup GUID / option-set code twins
    # (`customer_id`, `rule_type_code`, …) the web app never reads.
    # High-volume historical tables are columnar + string-pool encoded in `js/seed_data.js` and unpacked
    # synchronously on load in ~35ms so all 93,000+ historical transactions (2024–2026) are available offline.
    import re as _re
    _WB_TAG_RE = _re.compile(r"\s*\[wb:[^\]]+\]")
    _MIG_TAG_RE = _re.compile(r"\s*\[m\d+[^\]]*\]", _re.I)

    def _clean_notes(s):
        if not s or not isinstance(s, str):
            return s
        s = _WB_TAG_RE.sub("", s)
        lines = []
        for raw_line in s.splitlines():
            line = raw_line.strip()
            if not line:
                continue
            if _re.search(r"Merged trucks|\(m\d+|\[m\d+|Workbook status|\((?:column\s+|text,\s*)?retired\s+m\d+\)|Earlier window\s+\d{4}|owner type\s+\d|their notes:", line, _re.I):
                continue
            lines.append(line)
        return _MIG_TAG_RE.sub("", "\n".join(lines)).strip()

    def _compact_row(row):
        out = {}
        for k, v in row.items():
            if k != "id" and (k.endswith("_id") or k.endswith("_code")):
                continue
            if k == "notes" and isinstance(v, str):
                v = _clean_notes(v)
            if k == "usd_amount" and v == row.get("amount") and not row.get("lbp_amount"):
                continue
            if v is None or v == "" or v == [] or v == {} or v is False or v == 0 or v == 0.0:
                if k not in ("total", "total_ttc", "amount", "qty", "litres"):
                    continue
            out[k] = v
        return out

    compact_records = {k: ([_compact_row(r) for r in v] if isinstance(v, list) else v) for k, v in records.items()}

    # Build columnar + string-pool packed representation for both mfg_snapshot.json and js/seed_data.js
    TX_PREFIX = {
        "sales_tickets": "st",
        "raw_purchases": "rp",
        "fuel_intakes": "fi",
        "expenses": "ex",
        "receipts": "rc",
        "settlements": "sp",
        "salaries": "sa",
        "attendance": "at",
        "external_movements": "em",
        "loan_settlements": "ls",
        "conversions": "cv",
        "daily_totals": "dt",
    }
    OMIT_AUTO_NAME = {"sales_tickets", "raw_purchases", "fuel_intakes", "attendance"}

    str_counts = Counter()
    prepped_tables = {}
    for k, rows in compact_records.items():
        if not isinstance(rows, list) or not rows:
            prepped_tables[k] = rows
            continue
        pf = TX_PREFIX.get(k)
        omit_name = k in OMIT_AUTO_NAME
        has_rep = any("rep_date" in r for r in rows)
        is_sales = k == "sales_tickets"
        col_set = []
        seen_cols = set()
        for r in rows:
            for ck in r.keys():
                if pf and ck == "id":
                    continue
                if omit_name and ck == "name":
                    continue
                if ck not in seen_cols:
                    seen_cols.add(ck)
                    col_set.append(ck)
        sc = [
            1 if all(isinstance(r.get(c), str) or r.get(c) is None for r in rows) else 0
            for c in col_set
        ]
        for r in rows:
            for ci, c in enumerate(col_set):
                if not sc[ci]:
                    continue
                v = r.get(c)
                if c == "rep_date" and v == r.get("date"):
                    continue
                if isinstance(v, str) and len(v) >= 2:
                    str_counts[v] += 1
        prepped_tables[k] = (col_set, sc, pf, has_rep, is_sales, rows)

    pool = [s for s, cnt in str_counts.most_common() if cnt >= 2]
    pool_idx = {s: i for i, s in enumerate(pool)}

    packed_records = {}
    for k, item in prepped_tables.items():
        if not isinstance(item, tuple):
            packed_records[k] = item
            continue
        col_set, sc, pf, has_rep, is_sales, rows = item
        out_rows = []
        for r in rows:
            arr = []
            for ci, c in enumerate(col_set):
                v = r.get(c)
                if c == "rep_date" and v == r.get("date"):
                    v = None
                elif is_sales and c == "total_ttc" and v == r.get("total"):
                    v = None
                elif sc[ci] and isinstance(v, str) and v in pool_idx:
                    v = pool_idx[v]
                arr.append(v)
            while arr and arr[-1] is None:
                arr.pop()
            out_rows.append(arr)
        t_obj = {"c": col_set, "sc": sc, "r": out_rows}
        if pf:
            t_obj["p"] = pf
        if has_rep:
            t_obj["hr"] = 1
        packed_records[k] = t_obj

    packed_payload = {
        "generated_at": snapshot["generated_at"],
        "models": models,
        "sentinels": sentinels,
        "_s": pool,
        "records": packed_records,
    }

    snap_path.write_text(json.dumps(packed_payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"  Snapshot saved -> {snap_path} ({snap_path.stat().st_size // 1024} KB)", flush=True)

    unpacker_js = (
        "// Auto-generated from live Manufacturing Operations Dataverse + Semantic Models (Full 2024-2026 History)\n"
        "(function(){\n"
        "const P=" + json.dumps(packed_payload, ensure_ascii=False, separators=(",", ":")) + ";\n"
        "const S=P._s||[],R={};\n"
        "for(const[k,t]of Object.entries(P.records||{})){\n"
        "  if(!t||!t.c){R[k]=t||[];continue;}\n"
        "  const cols=t.c,sc=t.sc,pf=t.p,hr=t.hr,isSales=k==='sales_tickets',isRaw=k==='raw_purchases';\n"
        "  R[k]=t.r.map((row,idx)=>{\n"
        "    const o=pf?{id:pf+idx}:{};\n"
        "    for(let i=0;i<row.length;i++){\n"
        "      let v=row[i];\n"
        "      if(v===null||v===undefined)continue;\n"
        "      if(sc[i]&&typeof v==='number')v=S[v];\n"
        "      o[cols[i]]=v;\n"
        "    }\n"
        "    if(hr&&!o.rep_date&&o.date)o.rep_date=o.date;\n"
        "    if(o.amount!==undefined&&o.usd_amount===undefined&&!o.lbp_amount)o.usd_amount=o.amount;\n"
        "    if(isSales){\n"
        "      if(o.vat==null)o.vat=0;\n"
        "      if(o.total_ttc==null&&o.total!=null)o.total_ttc=o.total;\n"
        "      if(!o.sale_type)o.sale_type='Delivery';\n"
        "      if(!o.method)o.method='Credit';\n"
        "    }\n"
        "    if(isRaw&&!o.method)o.method='Credit';\n"
        "    if(pf&&!o.name)o.name=o.ticket_no?('#'+o.ticket_no+' · '+(o.date||'')):(pf.toUpperCase()+'-'+idx);\n"
        "    return o;\n"
        "  });\n"
        "}\n"
        "window.MFG_SEED={generated_at:P.generated_at,models:P.models,records:R,sentinels:P.sentinels};\n"
        "})();\n"
    )
    js_path = JS_DIR / "seed_data.js"
    js_path.write_text(unpacker_js, encoding="utf-8")
    print(f"  Browser bundle saved -> {js_path} ({js_path.stat().st_size // 1024} KB)", flush=True)

    build_sqlite_and_postgres(snapshot)
    print(f"\nALL DONE in {time.time() - t0:.1f}s!", flush=True)


if __name__ == "__main__":
    main()
