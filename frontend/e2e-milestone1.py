#!/usr/bin/env python3
"""Milestone 1 UI E2E: farm -> AI crop recommendations -> select -> calendar -> weather.

Runs against the live dev stack (frontend :5173 -> backend :5000 -> ML :8000). Uses fresh
throwaway accounts (m1-ui-*@kisanai.test) and deletes the farm/plans it created unless KEEP=1.
Env: E2E_BASE (default http://localhost:5173), E2E_SHOTS (screenshot dir, default /tmp/kisanai-e2e).
"""
import json, os, time, urllib.request
from playwright.sync_api import sync_playwright

BASE = os.environ.get("E2E_BASE", "http://localhost:5173")
SHOTS = os.environ.get("E2E_SHOTS", "/tmp/kisanai-e2e")
KEEP = os.environ.get("KEEP") == "1"
os.makedirs(SHOTS, exist_ok=True)
STAMP = int(time.time() * 1000)
EMAIL, PASSWORD = f"m1-ui-{STAMP}@kisanai.test", "m1-test-pass-123"
FARM = f"M1 UI Farm {STAMP % 100000}"
SOWING = "2027-06-20"
results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond)))
    print(f"{'PASS' if cond else 'FAIL'}  {name}" + (f"  — {detail}" if detail else ""))


def api(method, path, token=None, body=None):
    req = urllib.request.Request(f"{BASE}/api{path}", method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


farm = None
token = None
with sync_playwright() as p:
    browser = p.chromium.launch()
    try:
        run_flow = True
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        errors = []
        page.on("pageerror", lambda e: errors.append(f"pageerror: {str(e)[:160]}"))
        page.on("console", lambda m: m.type == "error" and errors.append(f"console: {m.text[:160]}"))

        # 1. Register through the UI
        page.goto(f"{BASE}/register", wait_until="networkidle")
        page.fill('input[placeholder="Ramesh Kumar"]', "M1 UI Farmer")
        page.fill('input[type="email"]', EMAIL)
        page.fill('input[placeholder="Min. 6 characters"]', PASSWORD)
        page.fill('input[placeholder="Repeat password"]', PASSWORD)
        page.click('button[type="submit"]')
        page.wait_for_url("**/dashboard**", timeout=15000)
        token = page.evaluate("localStorage.getItem('kisan_token')")
        check("Registration through the UI logs the farmer in", bool(token) and token.startswith("eyJ"))

        # 2. Add a farm with a confirmed location (manual entry) and a soil test
        page.goto(f"{BASE}/farms", wait_until="networkidle")
        page.click("button:has-text('Add Farm') >> nth=0")
        page.fill('input[placeholder="e.g., Shri Ram Farm"]', FARM)
        page.fill('input[placeholder="Village, District, State"]', "Warangal, Telangana")
        page.fill('input[placeholder="e.g., 5.2"]', "2.5")
        page.click("text=Enter coordinates")
        page.fill('input[placeholder="17.9689"]', "17.9689")
        page.fill('input[placeholder="79.5941"]', "79.5941")
        page.click("button:has-text('Check')")
        page.click("button:has-text('Confirm location')")
        check("Location must be explicitly confirmed in the form", page.locator("[data-testid=farm-location-field] >> text=Confirmed").count() == 1)
        for label, val in [("Soil N", "90"), ("Soil P", "42"), ("Soil K", "43"), ("Soil pH", "6.8")]:
            page.fill(f'input[aria-label="{label}"]', val)
        page.fill('input[name="soilTest.testedOn"]', "2026-09-01")
        page.click("form button[type=submit]")
        page.wait_for_selector(f"text={FARM}", timeout=15000)
        card = page.locator(".card", has_text=FARM).first
        card.wait_for()
        check("Farm saved and shown with confirmed location + soil test",
              "Location confirmed" in card.inner_text() and "N 90" in card.inner_text())
        page.screenshot(path=f"{SHOTS}/1-farm-card.png")
        farm = next(f for f in api("GET", "/farms", token)[1] if f["name"] == FARM)

        # 3. Get AI crop recommendations for this farm
        card.locator("button:has-text('Get AI Crop Recommendations')").click()
        modal = page.locator("[data-testid=farm-recommendations]")
        modal.wait_for()
        modal.locator('input[type="date"]').fill(SOWING)
        modal.locator("[data-testid=get-recommendations]").click()
        page.wait_for_selector("[data-testid=rec-card]", timeout=60000)
        cards = page.locator("[data-testid=rec-card]")
        engine = page.locator("[data-testid=rec-engine]").inner_text()
        check("Top-three shortlist rendered from the crop model", 1 <= cards.count() <= 3 and "crop model (ML)" in engine,
              f"{cards.count()} cards · {engine}")
        rec = api("GET", f"/farms/{farm['id']}/recommendations", token)[1]["recommendations"][0]
        first_ui = cards.first.inner_text()
        check("UI shows the backend's real crop + probability (not invented)",
              rec["shortlist"][0]["displayName"] in first_ui and rec["shortlist"][0]["score"]["label"] in first_ui,
              f"{rec['shortlist'][0]['displayName']} · {rec['shortlist'][0]['score']['label']}")
        check("Inputs, climate source and limitations are shown",
              "ERA5" in page.locator("[data-testid=rec-inputs]").inner_text()
              and page.locator("[data-testid=rec-limitations] li").count() >= 1)
        check("Cost is shown as unavailable rather than invented", "Not available" in first_ui)
        page.screenshot(path=f"{SHOTS}/2-recommendations.png", full_page=True)

        # 4. Select the top crop → calendar prefilled for this farm
        cards.first.locator("[data-testid=select-crop]").click()
        page.wait_for_url("**/calendar?farmId=**", timeout=15000)
        banner = page.locator("[data-testid=calendar-farm-context]")
        banner.wait_for(timeout=15000)
        page.wait_for_function(f"document.querySelector('form input[type=date]')?.value === '{SOWING}'", timeout=10000)
        crop_val = page.locator("form select").input_value()
        acres_val = page.locator("form input[type=number]").input_value()
        expected_crop = rec["shortlist"][0]["calendarCrop"]
        check("Calendar prefilled with the selected farm, crop, sowing date and area",
              FARM in banner.inner_text() and crop_val == expected_crop and acres_val == "2.5",
              f"crop={crop_val} date={SOWING} acres={acres_val}")
        page.screenshot(path=f"{SHOTS}/3-calendar-prefilled.png")

        # 5. Generate → plan linked to the farm; URL prefill cleared
        page.click("button:has-text('Plan My Season')")
        page.wait_for_selector("[data-testid=plan-farm-badge]", timeout=20000)
        plans = api("GET", f"/calendar?farmId={farm['id']}", token)[1]["plans"]
        check("Cultivation plan generated and saved against the farm",
              len(plans) == 1 and plans[0]["farmId"] == farm["id"] and plans[0]["crop"] == expected_crop
              and plans[0]["recommendationId"] == rec["id"], f"{len(plans)} plan(s)")
        check("Prefill removed from the URL after generating", "farmId" not in page.url, page.url.replace(BASE, ""))
        page.screenshot(path=f"{SHOTS}/4-calendar-plan.png")

        # 6. Refresh and browser-back + resubmit must not duplicate
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(1000)
        check("Refreshing the calendar does not create a duplicate plan",
              len(api("GET", f"/calendar?farmId={farm['id']}", token)[1]["plans"]) == 1)
        page.go_back(wait_until="networkidle")
        if "farmId" in page.url:
            page.locator("[data-testid=calendar-farm-context]").wait_for(timeout=10000)
            page.wait_for_function(f"document.querySelector('form input[type=date]')?.value === '{SOWING}'", timeout=10000)
            page.click("button:has-text('Plan My Season')")
            page.wait_for_selector("text=already exists", timeout=15000)
        check("Back-button + resubmit returns the existing plan (still one plan)",
              len(api("GET", f"/calendar?farmId={farm['id']}", token)[1]["plans"]) == 1)

        # 7. Event tick persists
        page.goto(f"{BASE}/calendar", wait_until="networkidle")
        page.locator("text=Land preparation — deep ploughing").first.click()
        page.wait_for_timeout(1500)
        page.reload(wait_until="networkidle")
        plan = api("GET", f"/calendar?farmId={farm['id']}", token)[1]["plans"][0]
        check("Ticking an activity on the farm plan persists", plan["events"][0]["done"] is True)

        # 8. Weather defaults to the farm's confirmed coordinates and labels data kinds
        page.goto(f"{BASE}/weather", wait_until="networkidle")
        page.wait_for_selector("text=weather-model estimate", timeout=30000)
        sel_val = page.locator("[data-testid=weather-location-select]").input_value()
        body = page.locator("body").inner_text()
        check("Weather page uses the farm's confirmed location",
              sel_val == f"farm:{farm['id']}" and "Farm weather for" in body, sel_val)
        check("Weather page distinguishes model estimate from forecast",
              "not a station observation" in body and "Forecast" in body)
        page.screenshot(path=f"{SHOTS}/5-weather-farm.png")

        page_errors = [e for e in errors if "favicon" not in e]
        check("No browser errors during the flow", not page_errors, "; ".join(page_errors[:3]))
        page.close()  # free the first renderer before opening the second user's session (low-memory sandbox)

        # 9. Another farmer cannot load this farm into their calendar
        st, b_reg = api("POST", "/auth/register", None, {"name": "M1 UI Other", "email": f"m1-ui-b-{STAMP}@kisanai.test", "password": PASSWORD})
        ctx_b = browser.new_context(viewport={"width": 1280, "height": 900})
        pb = ctx_b.new_page()
        pb.goto(f"{BASE}/login", wait_until="networkidle")
        pb.evaluate("([t,u]) => { localStorage.setItem('kisan_token', t); localStorage.setItem('kisan_user', u); }",
                    [b_reg["token"], json.dumps(b_reg["user"])])
        b_farm_status, b_log = [], []
        pb.on("response", lambda r: f"/api/farms/{farm['id']}" in r.url and b_farm_status.append(r.status))
        pb.on("response", lambda r: "/api/" in r.url and b_log.append(f"{r.status} {r.url.replace(BASE, '')}"))
        pb.on("console", lambda m: b_log.append(f"console.{m.type}: {m.text[:200]}"))
        pb.on("pageerror", lambda e: b_log.append(f"pageerror: {str(e)[:200]}"))
        pb.goto(f"{BASE}/calendar?farmId={farm['id']}", wait_until="domcontentloaded")
        for _ in range(60):  # up to 15 s
            if b_farm_status and "farmId" not in pb.url:
                break
            pb.wait_for_timeout(250)
        check("Other farmer gets 404 for the farm, no prefill, URL cleared",
              b_farm_status and all(st == 404 for st in b_farm_status) and "farmId" not in pb.url
              and pb.locator("[data-testid=calendar-farm-context]").count() == 0,
              f"responses={b_farm_status} url={pb.url.replace(BASE, '')}")
        if not b_farm_status:
            try:
                pb.screenshot(path=f"{SHOTS}/debug-other-farmer.png", timeout=5000)
            except Exception:
                pass
            print("   B diagnostics:", *b_log[-15:], sep="\n     ")
        ctx_b.close()


    finally:
        if not KEEP and token and farm:
            for pl in api("GET", f"/calendar?farmId={farm['id']}", token)[1]["plans"]:
                api("DELETE", f"/calendar/{pl['id']}", token)
            api("DELETE", f"/farms/{farm['id']}", token)
            print(f"\nCleaned up the test farm and its plans. Test accounts left: {EMAIL}, m1-ui-b-{STAMP}@kisanai.test")
        browser.close()

failed = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(failed)}/{len(results)} UI checks passed" + (f" — FAILED: {' | '.join(failed)}" if failed else ""))
raise SystemExit(1 if failed else 0)
