"""server.py — Standalone HTTP + REST API Server for ISABI Manufacturing Operations Web App.
Serves the static PWA and provides live SQLite read/write + Multi-Device Auth endpoints:
  - GET  /api/status        -> Engine health, DB size, table row counts
  - POST /api/auth/login    -> Validates user email + PIN/password against SQLite `users`, logs session
  - GET  /api/users         -> Returns team user directory (with BU RLS scopes & roles)
  - POST /api/users         -> Creates or updates a team user seat in SQLite `users`
  - GET  /api/records       -> Query any table (?table=sales_tickets&company=WTC&limit=100)
  - POST /api/records       -> Insert a new record into SQLite `data/mfg.db`
  - GET  /api/sync          -> Pulls users + custom records + sessions log from SQLite
  - POST /api/sync          -> Merges multi-device cloud state into SQLite
"""
import datetime as dt
import hmac
import json
import os
import sqlite3
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("MFG_DB_PATH") or (ROOT / "data" / "mfg.db"))

ALLOWED_TABLES = {
    "sales_tickets",
    "raw_purchases",
    "fuel_intakes",
    "expenses",
    "customer_receipts",
    "supplier_payments",
    "salary_payments",
    "salaries",
    "price_rules",
    "vat_invoices",
    "credit_terms",
    "customers",
    "suppliers",
    "users",
    "products",
    "sites",
    "regions",
    "uoms",
    "product_types",
    "equipment",
    "company_equipment",
    "drivers",
    "company_drivers",
    "expense_categories",
    "expense_subcategories",
    "employments",
    "attendance",
    "freelance_entries",
    "logistics_allowances",
    "overtime_rates",
    "external_movements",
    "loans",
    "loan_settlements",
    "conversions",
    "jv_partnerships",
    "jv_distributions",
    "daily_totals",
}

# Tables the web entry desk may write through POST /api/records
USER_WRITABLE_TABLES = ALLOWED_TABLES - {"users"}

# Universal registries where main column (name, or (category, name) for expense_subcategories) must be unique
UNIVERSAL_UNIQUE_TABLES = {
    "customers",
    "suppliers",
    "products",
    "product_types",
    "uoms",
    "sites",
    "regions",
    "equipment",
    "drivers",
    "expense_categories",
    "expense_subcategories",
}

# App-entry audit columns added on first run so INSERT OR REPLACE keeps them
APP_AUDIT_COLUMNS = (
    ("source", "TEXT DEFAULT ''"),
    ("entered_by", "TEXT DEFAULT ''"),
    ("entered_at", "TEXT DEFAULT ''"),
    ("voided", "INTEGER DEFAULT 0"),
    ("voided_by", "TEXT DEFAULT ''"),
    ("voided_at", "TEXT DEFAULT ''"),
    ("notes", "TEXT DEFAULT ''"),
)

DEFAULT_USERS = [
    ("u1", "Hussein Bdeir", "husseinbdeir@bhfirms.com", "1111", "Full Access (Owner)", "WTC,BBConstruction,Lions Transport", "full", "full", "Active", ""),
    ("u2", "Zeinab Rkein", "zeinabrkein@bhfirms.com", "2222", "Supervisor + Entry", "WTC,BBConstruction,Lions Transport", "full", "full", "Active", ""),
    ("u3", "Sabah Kassab", "sabahkassab@bhfirms.com", "3333", "Entry", "WTC", "partial", "partial", "Active", ""),
    ("u4", "WTC Plant Weighbridge 1", "scale1.wtc@bhfirms.com", "4444", "Entry", "WTC", "none", "partial", "Active", ""),
    ("u5", "WTC Site Dispatch", "quarry.wtc@bhfirms.com", "4545", "Entry", "WTC", "none", "none", "Active", ""),
    ("u6", "BBConstruction Batching Desk", "batch.bbc@bhfirms.com", "5555", "Entry", "BBConstruction", "partial", "partial", "Active", ""),
    ("u7", "BBConstruction Site Supervisor", "site.bbc@bhfirms.com", "6666", "Supervisor", "BBConstruction", "full", "full", "Active", ""),
    ("u8", "Lions Transport Fleet Controller", "fleet.lions@bhfirms.com", "7777", "Supervisor + Entry", "Lions Transport,WTC", "full", "partial", "Active", ""),
    ("u9", "Diesel & Garage Officer", "fuel.mfg@bhfirms.com", "7878", "Entry", "WTC,BBConstruction,Lions Transport", "none", "none", "Active", ""),
    ("u10", "Accounts Receivable Collector", "ar.mfg@bhfirms.com", "8888", "Sales", "WTC,BBConstruction", "partial", "full", "Active", ""),
]


def ensure_auth_schema():
    if not DB_PATH.exists():
        return
    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(users)")
    cols = {r[1] for r in cur.fetchall()}
    if "pin_code" not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN pin_code TEXT DEFAULT '1111'")
    if "last_login_at" not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN last_login_at TEXT DEFAULT ''")
    if "face_samples" not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN face_samples TEXT DEFAULT '[]'")
    if "face_thumbs" not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN face_thumbs TEXT DEFAULT '[]'")
    if "face_required" not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN face_required INTEGER DEFAULT 0")
    if "face_updated_at" not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN face_updated_at TEXT DEFAULT ''")
    if "seat_updated_at" not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN seat_updated_at TEXT DEFAULT ''")
    if "custom_perms" not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN custom_perms TEXT DEFAULT '{}'")
    if "auth_mode" not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN auth_mode TEXT DEFAULT ''")
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS auth_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            email TEXT,
            full_name TEXT,
            role TEXT,
            companies TEXT,
            device TEXT,
            logged_in_at TEXT,
            method TEXT DEFAULT 'PIN',
            confidence REAL
        )
        """
    )
    scols = {r[1] for r in cur.execute("PRAGMA table_info(auth_sessions)").fetchall()}
    if "method" not in scols:
        cur.execute("ALTER TABLE auth_sessions ADD COLUMN method TEXT DEFAULT 'PIN'")
    if "confidence" not in scols:
        cur.execute("ALTER TABLE auth_sessions ADD COLUMN confidence REAL")
    cur.execute("DELETE FROM users WHERE id IN ('u-wtc', 'u-bbc', 'u-lions')")
    for table in USER_WRITABLE_TABLES:
        try:
            tcols = {r[1] for r in cur.execute(f"PRAGMA table_info({table})").fetchall()}
        except Exception:
            continue
        if not tcols:
            cur.execute(
                f"CREATE TABLE IF NOT EXISTS {table} (id TEXT PRIMARY KEY, name TEXT DEFAULT '', official_name TEXT DEFAULT '', company TEXT DEFAULT '', date TEXT DEFAULT '', rep_date TEXT DEFAULT '', method TEXT DEFAULT '', phone TEXT DEFAULT '', contact TEXT DEFAULT '', email TEXT DEFAULT '', address TEXT DEFAULT '', region TEXT DEFAULT '', location TEXT DEFAULT '', mof_no TEXT DEFAULT '', financial_no TEXT DEFAULT '', vat_registered INTEGER DEFAULT 0, iva INTEGER DEFAULT 0, credit_days INTEGER DEFAULT 30, credit_limit REAL DEFAULT 0, amount REAL DEFAULT 0, usd_amount REAL DEFAULT 0, lbp_amount REAL DEFAULT 0, total REAL DEFAULT 0, total_ttc REAL DEFAULT 0, status TEXT DEFAULT '', type TEXT DEFAULT '', category TEXT DEFAULT '', subcategory TEXT DEFAULT '', source TEXT DEFAULT '', entered_by TEXT DEFAULT '', entered_at TEXT DEFAULT '', voided INTEGER DEFAULT 0, voided_by TEXT DEFAULT '', voided_at TEXT DEFAULT '', modified_by TEXT DEFAULT '', modified_at TEXT DEFAULT '', notes TEXT DEFAULT '')"
            )
            tcols = {r[1] for r in cur.execute(f"PRAGMA table_info({table})").fetchall()}
        for col, ddl in APP_AUDIT_COLUMNS:
            if col not in tcols:
                cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} {ddl}")
    for u in DEFAULT_USERS:
        uid, fname, email, pin, role, comps, pbi, stmts, status, llogin = u
        cur.execute("SELECT id, pin_code, last_login_at FROM users WHERE id = ? OR LOWER(email) = LOWER(?)", (uid, email))
        existing = cur.fetchone()
        if existing:
            cur_id = existing[0]
            if cur_id != uid and cur_id in ("u-hussein", "u-zeinab", "u-sabah"):
                cur.execute("UPDATE users SET id=? WHERE id=?", (uid, cur_id))
                cur_id = uid
            # Never overwrite a seat the owner has edited in the web app (PIN / role / scope / suspension) on a
            # server restart — only back-fill a seat that still carries the schema placeholder PIN and has never
            # signed in (a fresh build inserts users without a PIN, so the column default '1111' lands on everyone).
            cur_pin = (existing[1] or "").strip()
            never_logged = not (existing[2] or "").strip()
            if not cur_pin or (cur_pin == "1111" and pin != "1111" and never_logged):
                cur.execute("UPDATE users SET pin_code=? WHERE id=?", (pin, cur_id))
        else:
            cur.execute(
                "INSERT INTO users (id, full_name, email, pin_code, role, companies, pbi_access, statements_access, status, last_login_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
                u,
            )
    conn.commit()
    conn.close()


class MfgHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    @staticmethod
    def _norm_api_path(raw_path: str) -> str:
        for prefix in ("/isabi/app/api/", "/app/api/", "/isabi/api/"):
            if raw_path.startswith(prefix):
                return "/api/" + raw_path[len(prefix):]
        return raw_path

    def translate_path(self, path: str) -> str:
        parsed_p = urlparse(path).path
        showcase_dir = ROOT.parent / "isabi"
        if parsed_p.startswith("/showcase") and showcase_dir.exists():
            rel = parsed_p[len("/showcase"):].lstrip("/") or "index.html"
            return str(showcase_dir / rel)
        if parsed_p.startswith("/app/") and not (ROOT / "app").exists():
            path = "/" + parsed_p[len("/app/"):]
        elif parsed_p == "/app" and not (ROOT / "app").exists():
            path = "/index.html"
        return super().translate_path(path)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def _send_json(self, payload, status=200):
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _read_body(self):
        length = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(length).decode("utf-8")) if length else {}

    def do_GET(self):
        parsed = urlparse(self.path)
        api_path = self._norm_api_path(parsed.path)
        if api_path == "/api/status":
            if not DB_PATH.exists():
                return self._send_json({"ok": False, "error": "mfg.db not built yet"}, 503)
            conn = sqlite3.connect(str(DB_PATH))
            cur = conn.cursor()
            counts = {}
            for t in sorted(ALLOWED_TABLES):
                try:
                    counts[t] = cur.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
                except Exception:
                    counts[t] = 0
            conn.close()
            return self._send_json({
                "ok": True,
                "engine": "SQLite 3.x + BHFIRMS Multi-Device Cloud Relay",
                "db_path": str(DB_PATH),
                "db_size_kb": DB_PATH.stat().st_size // 1024,
                "dataverse_licenses_required": 0,
                "pbi_ppu_licenses_required": 0,
                "counts": counts,
            })

        if api_path == "/api/users":
            conn = sqlite3.connect(str(DB_PATH))
            conn.row_factory = sqlite3.Row
            rows = []
            for r in conn.execute("SELECT * FROM users ORDER BY id").fetchall():
                d = dict(r)
                raw_fs = d.get("face_samples")
                if isinstance(raw_fs, str):
                    try:
                        d["face_samples"] = json.loads(raw_fs) if raw_fs.strip() else []
                    except Exception:
                        d["face_samples"] = []
                elif not isinstance(raw_fs, list):
                    d["face_samples"] = []
                raw_ft = d.get("face_thumbs")
                if isinstance(raw_ft, str):
                    try:
                        d["face_thumbs"] = json.loads(raw_ft) if raw_ft.strip() else []
                    except Exception:
                        d["face_thumbs"] = []
                elif not isinstance(raw_ft, list):
                    d["face_thumbs"] = []
                d["face_required"] = bool(d.get("face_required"))
                if not d["face_samples"] and d.get("face_updated_at"):
                    d["face_cleared"] = True
                raw_cp = d.get("custom_perms")
                if isinstance(raw_cp, str):
                    try:
                        d["custom_perms"] = json.loads(raw_cp) if raw_cp.strip() else None
                    except Exception:
                        d["custom_perms"] = None
                elif not isinstance(raw_cp, dict):
                    d["custom_perms"] = None
                rows.append(d)
            sessions = [dict(r) for r in conn.execute("SELECT * FROM auth_sessions ORDER BY logged_in_at DESC LIMIT 25").fetchall()]
            conn.close()
            return self._send_json({"ok": True, "users": rows, "sessions": sessions})

        if api_path == "/api/records":
            qs = parse_qs(parsed.query)
            table = (qs.get("table") or ["sales_tickets"])[0]
            company = (qs.get("company") or [""])[0]
            limit = min(int((qs.get("limit") or ["150"])[0]), 1000)
            if table not in ALLOWED_TABLES:
                return self._send_json({"ok": False, "error": "Invalid table"}, 400)
            conn = sqlite3.connect(str(DB_PATH))
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            tcols = {r[1] for r in cur.execute(f"PRAGMA table_info({table})").fetchall()}
            order = "ORDER BY date DESC" if "date" in tcols else ("ORDER BY start_date DESC" if "start_date" in tcols else "ORDER BY rowid DESC")
            if company and company not in ("all", "manufacturing-group") and "company" in tcols:
                rows = cur.execute(
                    f"SELECT * FROM {table} WHERE lower(company) = lower(?) {order} LIMIT ?",
                    (company, limit),
                ).fetchall()
            else:
                rows = cur.execute(f"SELECT * FROM {table} {order} LIMIT ?", (limit,)).fetchall()
            conn.close()
            return self._send_json({"ok": True, "table": table, "rows": [dict(r) for r in rows]})

        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        api_path = self._norm_api_path(parsed.path)
        body = self._read_body()

        if api_path == "/api/auth/login":
            email = str(body.get("email") or "").strip().lower()
            pin = str(body.get("pin") or "").strip()
            method = str(body.get("method") or "PIN").strip()[:40]
            confidence = body.get("confidence")
            device = str(body.get("device") or "Web Browser")[:80]
            conn = sqlite3.connect(str(DB_PATH))
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            row = cur.execute("SELECT * FROM users WHERE lower(email) = ?", (email,)).fetchone()
            if not row:
                conn.close()
                return self._send_json({"ok": False, "error": "User email not found in Manufacturing roster."}, 401)
            user = dict(row)
            if user.get("status") == "Suspended":
                conn.close()
                return self._send_json({"ok": False, "error": "This user seat is currently suspended."}, 403)
            expected_pin = str(user.get("pin_code") or "1111").strip()
            # An empty PIN used to bypass the check — it is now required unless authenticated via on-device Face ID
            if method != "Face ID" and (not pin or not hmac.compare_digest(pin.encode("utf-8"), expected_pin.encode("utf-8"))):
                conn.close()
                return self._send_json({"ok": False, "error": "Invalid Access PIN."}, 401)
            now_iso = dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            cur.execute("UPDATE users SET last_login_at = ? WHERE id = ?", (now_iso, user["id"]))
            sess_id = f"sess-{int(dt.datetime.now().timestamp() * 1000)}"
            cur.execute(
                "INSERT OR REPLACE INTO auth_sessions (id, user_id, email, full_name, role, companies, device, logged_in_at, method, confidence) VALUES (?,?,?,?,?,?,?,?,?,?)",
                (sess_id, user["id"], user["email"], user["full_name"], user["role"], user["companies"], device, now_iso, method, confidence),
            )
            conn.commit()
            conn.close()
            user["last_login_at"] = now_iso
            return self._send_json({"ok": True, "user": user, "session_id": sess_id})

        if api_path == "/api/users":
            u = body.get("user") or {}
            if not u.get("email") or not u.get("full_name"):
                return self._send_json({"ok": False, "error": "Name and email are required."}, 400)
            uid = u.get("id") or f"u-{int(dt.datetime.now().timestamp())}"
            email_clean = u.get("email").strip().lower()
            conn = sqlite3.connect(str(DB_PATH))
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            ucols = {r[1] for r in cur.execute("PRAGMA table_info(users)").fetchall()}
            if "seat_updated_at" not in ucols:
                cur.execute("ALTER TABLE users ADD COLUMN seat_updated_at TEXT DEFAULT ''")
            if "custom_perms" not in ucols:
                cur.execute("ALTER TABLE users ADD COLUMN custom_perms TEXT DEFAULT '{}'")
            if "auth_mode" not in ucols:
                cur.execute("ALTER TABLE users ADD COLUMN auth_mode TEXT DEFAULT ''")
            existing = cur.execute(
                "SELECT id, face_samples, face_thumbs, face_required, face_updated_at, seat_updated_at, custom_perms, auth_mode FROM users WHERE id = ? OR lower(email) = lower(?)",
                (uid, email_clean),
            ).fetchone()
            if existing:
                uid = existing["id"]
            if "face_samples" in u and isinstance(u.get("face_samples"), list):
                fs_json = json.dumps(u["face_samples"], ensure_ascii=False)
                ft_json = json.dumps(u.get("face_thumbs") if isinstance(u.get("face_thumbs"), list) else [], ensure_ascii=False)
                f_req = 1 if u.get("face_required") else 0
                f_upd = str(u.get("face_updated_at") or dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))
            elif existing:
                fs_json = existing["face_samples"] or "[]"
                ft_json = json.dumps(u["face_thumbs"], ensure_ascii=False) if ("face_thumbs" in u and isinstance(u.get("face_thumbs"), list)) else (existing["face_thumbs"] or "[]")
                f_req = int(u["face_required"]) if "face_required" in u else (existing["face_required"] or 0)
                f_upd = existing["face_updated_at"] or ""
            else:
                fs_json = "[]"
                ft_json = "[]"
                f_req = 1 if u.get("face_required") else 0
                f_upd = ""
            if "custom_perms" in u and isinstance(u.get("custom_perms"), dict):
                cp_json = json.dumps(u["custom_perms"], ensure_ascii=False)
            elif "custom_perms" in u and isinstance(u.get("custom_perms"), str) and u["custom_perms"].strip():
                cp_json = u["custom_perms"].strip()
            elif existing and existing["custom_perms"]:
                cp_json = existing["custom_perms"]
            else:
                cp_json = "{}"
            auth_mode_val = str(u.get("auth_mode") if "auth_mode" in u else (existing["auth_mode"] if existing else "") or "")
            seat_upd = str(u.get("seat_updated_at") or dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))
            if existing:
                cur.execute(
                    """
                    UPDATE users SET
                        full_name = ?,
                        email = ?,
                        pin_code = ?,
                        role = ?,
                        companies = ?,
                        pbi_access = ?,
                        statements_access = ?,
                        status = ?,
                        face_samples = ?,
                        face_thumbs = ?,
                        face_required = ?,
                        face_updated_at = ?,
                        seat_updated_at = ?,
                        custom_perms = ?,
                        auth_mode = ?
                    WHERE id = ?
                    """,
                    (
                        u.get("full_name"),
                        email_clean,
                        str(u.get("pin_code") or "1111"),
                        u.get("role") or "Entry",
                        u.get("companies") or "WTC",
                        u.get("pbi_access") or "partial",
                        u.get("statements_access") or "partial",
                        u.get("status") or "Active",
                        fs_json,
                        ft_json,
                        f_req,
                        f_upd,
                        seat_upd,
                        cp_json,
                        auth_mode_val,
                        uid,
                    ),
                )
            else:
                cur.execute(
                    """
                    INSERT INTO users (id, full_name, email, pin_code, role, companies, pbi_access, statements_access, status, last_login_at, face_samples, face_thumbs, face_required, face_updated_at, seat_updated_at, custom_perms, auth_mode)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                    """,
                    (
                        uid,
                        u.get("full_name"),
                        email_clean,
                        str(u.get("pin_code") or "1111"),
                        u.get("role") or "Entry",
                        u.get("companies") or "WTC",
                        u.get("pbi_access") or "partial",
                        u.get("statements_access") or "partial",
                        u.get("status") or "Active",
                        u.get("last_login_at") or "",
                        fs_json,
                        ft_json,
                        f_req,
                        f_upd,
                        seat_upd,
                        cp_json,
                        auth_mode_val,
                    ),
                )
            conn.commit()
            conn.close()
            return self._send_json({"ok": True, "id": uid})

        if api_path == "/api/records":
            table = body.get("table")
            record = body.get("record") or {}
            if table not in USER_WRITABLE_TABLES or not isinstance(record, dict) or not record.get("id"):
                return self._send_json({"ok": False, "error": "Invalid table or record (id required)"}, 400)
            conn = sqlite3.connect(str(DB_PATH))
            cur = conn.cursor()
            cols = [r[1] for r in cur.execute(f"PRAGMA table_info({table})").fetchall()]
            if not cols:
                cur.execute(
                    f"CREATE TABLE IF NOT EXISTS {table} (id TEXT PRIMARY KEY, name TEXT DEFAULT '', official_name TEXT DEFAULT '', company TEXT DEFAULT '', date TEXT DEFAULT '', rep_date TEXT DEFAULT '', source TEXT DEFAULT '', entered_by TEXT DEFAULT '', entered_at TEXT DEFAULT '', voided INTEGER DEFAULT 0, voided_by TEXT DEFAULT '', voided_at TEXT DEFAULT '', modified_by TEXT DEFAULT '', modified_at TEXT DEFAULT '', notes TEXT DEFAULT '')"
                )
                cols = [r[1] for r in cur.execute(f"PRAGMA table_info({table})").fetchall()]
            if table in UNIVERSAL_UNIQUE_TABLES and not record.get("voided"):
                rec_id = str(record.get("id") or "").strip()
                main_val = str(record.get("name") or record.get("driver") or record.get("equipment") or "").strip()
                if main_val and "name" in cols:
                    void_clause = "AND COALESCE(voided, 0) = 0" if "voided" in cols else ""
                    if table == "expense_subcategories" and "category" in cols:
                        cat_val = str(record.get("category") or "").strip()
                        dup_row = cur.execute(
                            f"SELECT id, name FROM {table} WHERE id != ? AND lower(trim(name)) = lower(trim(?)) AND lower(trim(COALESCE(category,''))) = lower(trim(?)) {void_clause} LIMIT 1",
                            (rec_id, main_val, cat_val),
                        ).fetchone()
                    else:
                        dup_row = cur.execute(
                            f"SELECT id, name FROM {table} WHERE id != ? AND lower(trim(name)) = lower(trim(?)) {void_clause} LIMIT 1",
                            (rec_id, main_val),
                        ).fetchone()
                    if dup_row:
                        if record.get("modified_by"):
                            record["id"] = dup_row[0]
                            rec_id = dup_row[0]
                        else:
                            conn.close()
                            return self._send_json(
                                {"ok": False, "error": f"Duplicate {table} main column '{main_val}' already exists (id={dup_row[0]})."},
                                409,
                            )
            for k in list(record.keys()):
                if k not in cols and isinstance(k, str) and k.isidentifier():
                    try:
                        cur.execute(f"ALTER TABLE {table} ADD COLUMN {k} TEXT DEFAULT ''")
                        cols.append(k)
                    except Exception:
                        pass
            valid = {}
            for k, v in record.items():
                if k not in cols:
                    continue
                if isinstance(v, bool):
                    v = 1 if v else 0
                elif isinstance(v, (dict, list)):
                    v = json.dumps(v, ensure_ascii=False)
                valid[k] = v
            if not valid:
                conn.close()
                return self._send_json({"ok": True, "table": table, "skipped": True})
            placeholders = ",".join("?" for _ in valid)
            col_names = ",".join(valid.keys())
            cur.execute(
                f"INSERT OR REPLACE INTO {table} ({col_names}) VALUES ({placeholders})",
                tuple(valid.values()),
            )
            conn.commit()
            conn.close()
            return self._send_json({"ok": True, "table": table, "inserted": valid})

        return self._send_json({"ok": False, "error": "Not found"}, 404)

    def log_message(self, fmt, *args):
        pass


def main():
    ensure_auth_schema()
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", 8090))
    srv = ThreadingHTTPServer(("0.0.0.0", port), MfgHandler)
    print(f"ISABI Manufacturing Operations Web App running at http://127.0.0.1:{port}/", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
