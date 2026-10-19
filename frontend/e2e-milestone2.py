#!/usr/bin/env python3
"""Milestone 2 UI E2E: soil test (12 values) -> farm links -> fertilizer plan -> irrigation -> market.

Runs against the live dev stack (frontend :5173 -> backend :5000 -> ML :8000, internet for
Open-Meteo). Creates a throwaway account (m2-ui-*@kisanai.test) and its farms/plans through the
API, drives the M2 screens in a real browser, and deletes the farms/plans unless KEEP=1.
Env: E2E_BASE (default http://localhost:5173), E2E_SHOTS (screenshot dir, default /tmp/kisanai-e2e-m2).
"""
import datetime, json, os, re, time, urllib.request
from playwright.sync_api import sync_playwright

BASE = os.environ.get("E2E_BASE", "http://localhost:5173")
SHOTS = os.environ.get("E2E_SHOTS", "/tmp/kisanai-e2e-m2")
KEEP = os.environ.get("KEEP") == "1"
os.makedirs(SHOTS, exist_ok=True)
STAMP = int(time.time() * 1000)
results = []
created = {"farms": [], "plans": []}


def check(name, cond, detail=""):
    results.append((name, bool(cond)))
    print(f"{'PASS' if cond else 'FAIL'}  {name}" + (f"  — {detail}" if detail else ""))


def api(method, path, token=None, body=None):
    req = urllib.request.Request(f"{BASE}/api{path}", method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})})
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


# ---------- data setup through the API (the M1 UI flow is covered by e2e-milestone1.py) ----------
status, reg = api("POST", "/auth/register", body={"name": "M2 UI Farmer", "email": f"m2-ui-{STAMP}@kisanai.test", "password": "m2-test-pass-123"})
TOKEN, USER = reg["token"], reg["user"]
WARANGAL = {"lat": 17.9689, "lon": 79.5941, "source": "geocoded", "label": "Warangal, Telangana, India", "confirmed": True}
today = datetime.date.today()

_, rabi = api("POST", "/farms", TOKEN, {"name": f"M2 Rabi {STAMP % 100000}", "location": "Warangal, Telangana", "area": 2, "areaUnit": "hectares",
                                        "soilType": "Red Laterite", "waterSource": "Borewell", "coordinates": WARANGAL,
                                        "soilTest": {"N": 210, "P": 18, "K": 260, "ph": 7.8, "testedOn": "2026-03-02"}})
created["farms"].append(rabi["id"])
_, rec = api("POST", f"/farms/{rabi['id']}/recommendations", TOKEN, {"plannedSowingDate": "2026-11-20"})
_, sel = api("POST", f"/farms/{rabi['id']}/recommendations/{rec['id']}/select", TOKEN, {"crop": rec["shortlist"][0]["crop"]})
_, gen = api("POST", "/calendar/generate", TOKEN, {**sel["calendarPrefill"], "farmId": rabi["id"], "recommendationId": rec["id"]})
created["plans"].append(gen["plan"]["id"])
SELECTED = sel["calendarPrefill"]["crop"]

_, paddy = api("POST", "/farms", TOKEN, {"name": f"M2 Paddy {STAMP % 100000}", "location": "Warangal, Telangana", "area": 3, "areaUnit": "acres",
                                         "soilType": "Black Cotton", "waterSource": "Canal", "coordinates": WARANGAL})
created["farms"].append(paddy["id"])
_, gp = api("POST", "/calendar/generate", TOKEN, {"crop": "Paddy (Rice)", "sowingDate": (today - datetime.timedelta(days=94)).isoformat(), "farmId": paddy["id"]})
created["plans"].append(gp["plan"]["id"])
_, noloc = api("POST", "/farms", TOKEN, {"name": f"M2 NoLoc {STAMP % 100000}", "location": "Nalgonda, Telangana", "area": 1, "soilType": "Red Laterite", "waterSource": "Borewell"})
created["farms"].append(noloc["id"])
print(f"setup: account {USER['email']}, selected crop {SELECTED}, paddy sown {gp['plan']['sowingDate']}")

with sync_playwright() as p:
    browser = p.chromium.launch()
    try:
        ctx = browser.new_context(viewport={"width": 1440, "height": 1000})
        ctx.add_init_script(f"localStorage.setItem('kisan_token', {json.dumps(TOKEN)}); localStorage.setItem('kisan_user', {json.dumps(json.dumps(USER))});")
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(f"pageerror: {str(e)[:200]}"))
        page.on("console", lambda m: m.type == "error" and errors.append(f"console: {m.text[:200]}"))

        # 1. Farms page: complete the Soil Health Card through the edit form
        page.goto(f"{BASE}/farms", wait_until="networkidle")
        card = page.locator(".card", has_text=rabi["name"]).first
        card.wait_for(timeout=15000)
        card.locator("button").first.click()  # edit (pencil)
        page.locator("summary", has_text="More from your Soil Health Card").click()
        for label, val in [("EC (dS/m)", "0.4"), ("Organic carbon (%)", "0.42"), ("S (ppm)", "9"), ("Zn (ppm)", "0.5"),
                           ("B (ppm)", "0.6"), ("Fe (ppm)", "6.2"), ("Cu (ppm)", "0.9"), ("Mn (ppm)", "4.1")]:
            page.fill(f'input[aria-label="Soil {label}"]', val)
        with page.expect_response(lambda r: r.request.method == "PATCH" and f"/api/farms/{rabi['id']}" in r.url) as resp:
            page.click("form button[type=submit]")
        saved = resp.value.json().get("soilTest", {})
        check("1. Edit form saves the 8 extra Soil Health Card values", resp.value.status == 200 and saved.get("zn") == 0.5 and saved.get("mn") == 4.1 and saved.get("ec") == 0.4, json.dumps(saved))
        page.wait_for_timeout(600)
        card = page.locator(".card", has_text=rabi["name"]).first
        check("2. Farm card shows 12/12 card values and links to the three agents",
              "12/12 card values" in card.inner_text() and card.locator("[data-testid=farm-agent-links] a").count() == 3)
        page.screenshot(path=f"{SHOTS}/m2-1-farms.png", full_page=False)

        # 2. Fertilizer: open from the farm card link
        card.locator("[data-testid=farm-agent-links] a", has_text="Fertilizer").click()
        page.wait_for_url(f"**/agents/fertilizer?farm={rabi['id']}", timeout=10000)
        page.wait_for_selector("[data-testid=fert-status]", timeout=30000)
        status_attr = page.get_attribute("[data-testid=fert-status]", "data-status")
        check("3. Farm card link opens the fertilizer plan for that farm (farm tab, picker set)",
              page.get_attribute("[data-testid=fert-tab-farm]", "aria-selected") == "true" and page.input_value("[data-testid=fert-farm-picker]") == rabi["id"], f"status {status_attr}")
        ratings_text = page.inner_text("[data-testid=fert-ratings]")
        check("4. Ratings table shows all Soil Health Card values with official ratings and model ratings",
              page.locator("[data-testid=fert-ratings] tbody tr").count() == 12 and "Deficient" in ratings_text and re.search(r"(Low|Medium|High) \(\d+%\)", ratings_text))
        check("5. Model note says the ML model ran on all 12 values (Red + Laterite tried)", "ran on all 12 values" in page.inner_text("[data-testid=fert-model-note]"))
        dose = page.inner_text("[data-testid=fert-dose]")
        check("6. Dose cards show crop dose × soil factor, products and farm totals", "crop dose" in dose and "× 1.25" in dose and "Total for 4.94 acres" in dose)
        sched = page.locator("[data-testid=fert-schedule]")
        check("7. Schedule dates are linked to the farm calendar", sched.locator("text=In your calendar").count() >= 1 and "2026-11-20" in sched.inner_text())
        check("8. Limitations and sources visible", "iiss.res.in" in (page.locator("[data-testid=fert-limitations] a").first.get_attribute("href") or ""))
        page.screenshot(path=f"{SHOTS}/m2-2-fertilizer.png", full_page=True)
        with page.expect_response(lambda r: "/fertilizer?crop=Wheat" in r.url) as wresp:
            page.select_option("[data-testid=fert-crop-select]", "Wheat")
        page.wait_for_selector("[data-testid=fert-status]:has-text('Wheat')", timeout=15000)
        check("9. Choosing another crop recomputes the plan (Wheat, crop-specific dose)", wresp.value.json().get("doseBasis") == "crop-specific" and "Generic dose" not in page.inner_text("[data-testid=fert-status]"))
        page.click("[data-testid=fert-tab-calculator]")
        page.click("button[type=submit]:has-text('Generate Fertilizer Plan')")
        page.wait_for_timeout(1500)
        check("10. Quick calculator tab still works", page.locator("text=Total for").count() >= 1 and "12 May 2024" not in page.content())

        # 3. Irrigation
        page.goto(f"{BASE}/irrigation?farm={paddy['id']}", wait_until="networkidle")
        page.wait_for_selector("[data-testid=irr-result]", timeout=30000)
        body = page.inner_text("body")
        check("11. Irrigation page shows the farm's crop, day and FAO-56 source", "Paddy (Rice)" in page.inner_text("[data-testid=irr-crop]") and "FAO-56" in page.inner_text("[data-testid=irr-crop]"))
        ev = page.locator("[data-testid=irr-event]")
        check("12. Upcoming calendar irrigation judged by the rain rule", ev.count() >= 1 and ev.first.get_attribute("data-decision") in ("irrigate", "skip") and "48 hours" in ev.first.inner_text(), ev.first.inner_text()[:120] if ev.count() else "")
        check("13. 9 days shown (2 estimated + 7 forecast); stats in mm and litres", page.locator("[data-testid=irr-days] tbody tr").count() == 9 and " mm" in page.inner_text("[data-testid=irr-stats]") and ("kL" in body or " L " in body))
        check("14. No invented soil-moisture readings or fake farms left on the page",
              not re.search(r"Soil Moisture|Green Valley|Tomato Block|Water Saved|AI-optimized", body))
        check("15. Farm without a confirmed location is not offered (hidden note shown)",
              noloc["id"] not in page.inner_html("[data-testid=irr-farm-picker]") and "location not confirmed" in body)
        page.screenshot(path=f"{SHOTS}/m2-3-irrigation.png", full_page=True)

        # 4. Market
        page.goto(f"{BASE}/market?farm={rabi['id']}", wait_until="networkidle")
        page.wait_for_selector("[data-testid=mkt-farm]", timeout=30000)
        mkt = page.inner_text("[data-testid=mkt-farm]")
        check("16. Farm crops listed (selected + recommended) with price-model coverage", page.locator("[data-testid=mkt-crop]").count() >= 1 and SELECTED in mkt and page.locator("[data-testid=mkt-model-badge]").count() == page.locator("[data-testid=mkt-crop]").count())
        check("17. Live mandi status explained (not configured → no prices shown)", page.get_attribute("[data-testid=mkt-live-status]", "data-live") == "not_configured" and "DATA_GOV_IN_API_KEY" in mkt)
        page.wait_for_selector("[data-testid=mkt-change]", timeout=20000)
        full = page.inner_text("body")
        check("18. Generic price table: no NaN/undefined, sample data labelled", "NaN" not in full and "undefined" not in full and page.locator("[data-testid=mkt-sample-banner]").count() == 1
              and all(re.match(r"^[+-]?\d+(\.\d)?%$", t.strip()) for t in page.locator("[data-testid=mkt-change]").all_inner_texts()))
        check("19. 'Not configured' explained once (banner), not repeated on every crop", page.locator("[data-testid=mkt-crop-live]").count() == 0)
        page.screenshot(path=f"{SHOTS}/m2-4-market.png", full_page=True)

        # Live-prices rendering: browser-side interception of the farm market response with live
        # records in the backend's normalised shape (the real upstream is unreachable from here).
        _, real = api("GET", f"/farms/{rabi['id']}/market", TOKEN)
        first = real["crops"][0]["crop"]
        live_records = [
            {"state": "Telangana", "district": "Warangal", "market": "Warangal", "commodity": first, "variety": "Other", "grade": "FAQ", "arrivalDate": "2026-10-14", "minPrice": 5200, "maxPrice": 5600, "modalPrice": 5450, "unit": "₹/quintal", "nearFarm": True},
            {"state": "Telangana", "district": "Nalgonda", "market": "Miryalaguda", "commodity": first, "variety": "Other", "grade": "FAQ", "arrivalDate": "2026-10-15", "minPrice": 5100, "maxPrice": 5700, "modalPrice": 5500, "unit": "₹/quintal", "nearFarm": False},
        ]
        mocked = {**real, "status": "ok", "live": {"status": "ok", "message": None, "updated": "2026-10-15", "fetchedAt": "2026-10-15T06:00:00Z"},
                  "crops": [{**c, "live": ({"status": "ok", "markets": 2, "latestArrivalDate": "2026-10-15", "modalMin": 5450, "modalMax": 5500, "unit": "₹/quintal", "records": live_records}
                                           if i == 0 else {"status": "no_records", "message": f"No {c['crop']} prices reported from Telangana mandis in the latest data."})}
                            for i, c in enumerate(real["crops"])]}
        page.route(f"**/api/farms/{rabi['id']}/market", lambda route: route.fulfill(status=200, content_type="application/json", body=json.dumps(mocked)))
        page.reload(wait_until="networkidle")
        page.wait_for_selector("[data-testid=mkt-farm][data-status=ok]", timeout=20000)
        first_card = page.locator("[data-testid=mkt-crop]").first.inner_text()
        check("20. Live rows render: modal range, near-farm market first, per-crop reason when a crop has no records",
              "₹5,450 – ₹5,500" in first_card and "Warangal (near you)" in first_card and page.get_attribute("[data-testid=mkt-live-status]", "data-live") == "ok"
              and (len(real["crops"]) == 1 or page.locator("[data-testid=mkt-crop-live]").count() == len(real["crops"]) - 1), first_card[:160].replace("\n", " | "))
        page.screenshot(path=f"{SHOTS}/m2-5-market-live-render.png", full_page=False)
        page.unroute(f"**/api/farms/{rabi['id']}/market")

        check("21. No page errors or console errors", not errors, "; ".join(errors[:3]))
    finally:
        browser.close()

if KEEP:
    print(f"KEEP=1 → kept account {USER['email']}")
else:
    for pid in created["plans"]:
        api("DELETE", f"/calendar/{pid}", TOKEN)
    for fid in created["farms"]:
        api("DELETE", f"/farms/{fid}", TOKEN)
    print(f"cleaned up {len(created['farms'])} farms, {len(created['plans'])} plans (account remains)")

ok = sum(1 for _, r in results if r)
print(f"\n{ok}/{len(results)} UI checks passed")
raise SystemExit(0 if ok == len(results) else 1)
