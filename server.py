"""server.py — Standalone Option 3 HTTP + SQLite REST server for Manufacturing Operations Web App.
Serves the static PWA at http://127.0.0.1:8090/ and exposes `/api/*` endpoints backed by `data/mfg.db`.
Zero dependency on Microsoft Dataverse or Power BI PPU at runtime.
"""
import json
import os
import sqlite3
import sys
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "data" / "mfg.db"
PORT = int(os.environ.get("MFG_WEB_PORT", "8090"))

ALLOWED_TABLES = {
    "companies",
    "users",
    "products",
    "sites",
    "equipment",
    "drivers",
    "price_rules",
    "sales_tickets",
    "raw_purchases",
    "fuel_intakes",
    "expenses",
    "customer_receipts",
    "supplier_payments",
    "salary_payments",
}


def db_conn():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


class MfgRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        pass

    def _send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/status":
            if not DB_PATH.exists():
                return self._send_json({"ok": False, "error": "Database not initialized"}, 500)
            conn = db_conn()
            cur = conn.cursor()
            counts = {}
            for tbl in sorted(ALLOWED_TABLES):
                try:
                    counts[tbl] = cur.execute(f"SELECT COUNT(*) FROM {tbl}").fetchone()[0]
                except Exception:
                    counts[tbl] = 0
            conn.close()
            return self._send_json({
                "ok": True,
                "engine": "SQLite 3.x / PostgreSQL 16 (Option 3 Standalone)",
                "db_path": str(DB_PATH),
                "db_size_kb": DB_PATH.stat().st_size // 1024,
                "dataverse_licenses_required": 0,
                "pbi_ppu_licenses_required": 0,
                "counts": counts,
            })

        if parsed.path == "/api/records":
            qs = parse_qs(parsed.query)
            table = (qs.get("table") or [""])[0]
            company = (qs.get("company") or [""])[0]
            limit = min(int((qs.get("limit") or ["250"])[0]), 2000)
            if table not in ALLOWED_TABLES:
                return self._send_json({"ok": False, "error": f"Unknown table: {table}"}, 400)
            conn = db_conn()
            cur = conn.cursor()
            cols = [r[1] for r in cur.execute(f"PRAGMA table_info({table})").fetchall()]
            sql = f"SELECT * FROM {table}"
            params = []
            if company and company not in ("group", "all", "manufacturing-group") and "company" in cols:
                co_map = {"wtc": "WTC", "bbconstruction": "BBConstruction", "lionstransport": "Lions Transport"}
                sql += " WHERE company = ?"
                params.append(co_map.get(company.lower(), company))
            if "date" in cols:
                sql += " ORDER BY date DESC"
            sql += f" LIMIT {limit}"
            rows = [dict(r) for r in cur.execute(sql, params).fetchall()]
            conn.close()
            return self._send_json({"ok": True, "table": table, "rows": rows})

        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/records":
            length = int(self.headers.get("Content-Length") or "0")
            raw = self.rfile.read(length).decode("utf-8") if length else "{}"
            payload = json.loads(raw)
            table = payload.get("table") or ""
            record = dict(payload.get("record") or {})
            if table not in ALLOWED_TABLES:
                return self._send_json({"ok": False, "error": f"Invalid table: {table}"}, 400)
            conn = db_conn()
            cur = conn.cursor()
            cols = [r[1] for r in cur.execute(f"PRAGMA table_info({table})").fetchall()]
            if "id" in cols and not record.get("id"):
                record["id"] = str(uuid.uuid4())
            valid_keys = [k for k in cols if k in record]
            placeholders = ",".join("?" for _ in valid_keys)
            col_list = ",".join(valid_keys)
            vals = [record[k] for k in valid_keys]
            cur.execute(f"INSERT OR REPLACE INTO {table} ({col_list}) VALUES ({placeholders})", vals)
            conn.commit()
            conn.close()
            return self._send_json({"ok": True, "table": table, "record": record})

        return self._send_json({"ok": False, "error": "Not found"}, 404)


def main():
    os.chdir(str(ROOT))
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), MfgRequestHandler)
    print(f"ISABI Manufacturing Operations Web App running at http://127.0.0.1:{PORT}/", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
