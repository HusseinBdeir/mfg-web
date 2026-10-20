"""sync_cloud.py — Synchronizes SQLite `data/mfg.db` team users, PINs, and sessions with the live BHFIRMS Multi-Device Cloud Relay (`mfg_web_store`)."""
import base64
import datetime as dt
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENDPOINTS_JS = ROOT / "js" / "endpoints.js"


def main():
    raw = ENDPOINTS_JS.read_text(encoding="utf-8")
    u_b64 = re.search(r'u:\s*"([^"]+)"', raw).group(1)
    k_b64 = re.search(r'k:\s*"([^"]+)"', raw).group(1)
    cloud_url = base64.b64decode(u_b64).decode("utf-8")
    cloud_key = base64.b64decode(k_b64).decode("utf-8")

    users_res = json.loads(
        urllib.request.urlopen("http://127.0.0.1:8090/api/users", timeout=5).read().decode("utf-8")
    )
    now_iso = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    payload = {
        "key": cloud_key,
        "op": "patch",
        "patch": {
            "mfg_web_store": {
                "users": users_res["users"],
                "sessions": users_res["sessions"],
                "customRecords": {
                    "sales_tickets": [],
                    "raw_purchases": [],
                    "receipts": [],
                    "fuel_intakes": [],
                },
                "updatedAt": now_iso,
            }
        },
    }
    req = urllib.request.Request(
        cloud_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    res = json.loads(urllib.request.urlopen(req, timeout=15).read().decode("utf-8"))
    print("Cloud PATCH ok, keys:", list(res.keys()))

    get_req = urllib.request.Request(
        cloud_url,
        data=json.dumps({"key": cloud_key, "op": "get"}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    get_res = json.loads(urllib.request.urlopen(get_req, timeout=15).read().decode("utf-8"))
    store = get_res.get("docs", {}).get("mfg_web_store", {})
    print(
        f"Cloud GET verified -> mfg_web_store users={len(store.get('users', []))}, "
        f"sessions={len(store.get('sessions', []))}, updatedAt={store.get('updatedAt')}"
    )


if __name__ == "__main__":
    main()
