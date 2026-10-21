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
    ("u5", "WTC Quarry Dispatch", "quarry.wtc@bhfirms.com", "4545", "Entry", "WTC", "none", "none", "Active", ""),
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
            continue
        for col, ddl in APP_AUDIT_COLUMNS:
            if col not in tcols:
                cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} {ddl}")
    for u in DEFAULT_USERS:
        uid, fname, email, pin, role, comps, pbi, stmts, status, llogin = u
        cur.execute("SELECT id, pin_code, last_login_at FROM users WHERE LOWER(email) = LOWER(?)", (email,))
        existing = cur.fetchone()
        if existing:
            # Never overwrite a seat the owner has edited in the web app (PIN / role / scope / suspension) on a
            # server restart — only back-fill a seat that still carries the schema placeholder PIN and has never
            # signed in (a fresh build inserts users without a PIN, so the column default '1111' lands on everyone).
            cur_pin = (existing[1] or "").strip()
            never_logged = not (existing[2] or "").strip()
            if not cur_pin or (cur_pin == "1111" and pin != "1111" and never_logged):
                cur.execute("UPDATE users SET pin_code=? WHERE LOWER(email)=LOWER(?)", (pin, email))
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
        if parsed.path == "/api/status":
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

        if parsed.path == "/api/users":
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
                rows.append(d)
            sessions = [dict(r) for r in conn.execute("SELECT * FROM auth_sessions ORDER BY logged_in_at DESC LIMIT 25").fetchall()]
            conn.close()
            return self._send_json({"ok": True, "users": rows, "sessions": sessions})

        if parsed.path == "/api/records":
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
        body = self._read_body()

        if parsed.path == "/api/auth/login":
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

        if parsed.path == "/api/users":
            u = body.get("user") or {}
            if not u.get("email") or not u.get("full_name"):
                return self._send_json({"ok": False, "error": "Name and email are required."}, 400)
            uid = u.get("id") or f"u-{int(dt.datetime.now().timestamp())}"
            conn = sqlite3.connect(str(DB_PATH))
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            existing = cur.execute("SELECT face_samples, face_thumbs, face_required, face_updated_at FROM users WHERE lower(email) = lower(?)", (u.get("email").strip(),)).fetchone()
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
            cur.execute(
                """
                INSERT INTO users (id, full_name, email, pin_code, role, companies, pbi_access, statements_access, status, last_login_at, face_samples, face_thumbs, face_required, face_updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT(email) DO UPDATE SET
                    full_name = excluded.full_name,
                    pin_code = excluded.pin_code,
                    role = excluded.role,
                    companies = excluded.companies,
                    pbi_access = excluded.pbi_access,
                    statements_access = excluded.statements_access,
                    status = excluded.status,
                    face_samples = excluded.face_samples,
                    face_thumbs = excluded.face_thumbs,
                    face_required = excluded.face_required,
                    face_updated_at = excluded.face_updated_at
                """,
                (
                    uid,
                    u.get("full_name"),
                    u.get("email").strip().lower(),
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
                ),
            )
            conn.commit()
            conn.close()
            return self._send_json({"ok": True, "id": uid})

        if parsed.path == "/api/records":
            table = body.get("table")
            record = body.get("record") or {}
            if table not in USER_WRITABLE_TABLES or not isinstance(record, dict) or not record.get("id"):
                return self._send_json({"ok": False, "error": "Invalid table or record (id required)"}, 400)
            conn = sqlite3.connect(str(DB_PATH))
            cur = conn.cursor()
            cols = [r[1] for r in cur.execute(f"PRAGMA table_info({table})").fetchall()]
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
                return self._send_json({"ok": False, "error": "No matching columns"}, 400)
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
