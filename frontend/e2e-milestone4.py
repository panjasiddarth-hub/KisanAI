#!/usr/bin/env python3
"""Milestone 4 UI E2E: My Farm → plot → Cultivation Plan: recommendation → confirmed crop cycle → calendar
(tick persists) → fertilizer / irrigation / market advice with source labels → stale flags → regenerate /
reassess. Irrigation is no longer in the main menu. Throwaway account m4-ui-*@kisanai.test; farm deleted at the end.
Env: E2E_BASE (default http://localhost:5173), E2E_SHOTS (default /tmp/kisanai-e2e-m4).
"""
import datetime, json, os, time, urllib.request
from playwright.sync_api import sync_playwright

BASE = os.environ.get("E2E_BASE", "http://localhost:5173")
SHOTS = os.environ.get("E2E_SHOTS", "/tmp/kisanai-e2e-m4")
os.makedirs(SHOTS, exist_ok=True)
STAMP = int(time.time() * 1000)
results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond)))
    print(f"{'PASS' if cond else 'FAIL'}  {name}" + (f"  — {detail}" if detail else ""))


def api(method, path, token=None, body=None):
    req = urllib.request.Request(f"{BASE}/api{path}", method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


_, reg = api("POST", "/auth/register", body={"name": "M4 UI Farmer", "email": f"m4-ui-{STAMP}@kisanai.test", "password": "m4-test-pass-123"})
TOKEN, USER = reg["token"], reg["user"]
WARANGAL = {"lat": 17.9689, "lon": 79.5941, "source": "geocoded", "label": "Warangal, Telangana, India", "confirmed": True}
CARD = {"N": 210, "P": 18, "K": 260, "ph": 7.8, "ec": 0.4, "oc": 0.42, "s": 9, "zn": 0.5, "b": 0.6, "fe": 6.2, "cu": 0.9, "mn": 4.1, "testedOn": "2026-03-02"}
_, farm = api("POST", "/farms", TOKEN, {"name": f"M4 UI Farm {STAMP % 100000}", "location": "Warangal, Telangana", "area": 2, "areaUnit": "acres", "coordinates": WARANGAL})
FID = farm["id"]
_, plot = api("POST", f"/farms/{FID}/plots", TOKEN, {"name": "North field", "area": 1, "areaUnit": "acres", "soilType": "Black Cotton", "soilTest": CARD, "waterAccess": {"source": "Borewell"}})
PID = plot["id"]

with sync_playwright() as p:
    browser = p.chromium.launch()
    try:
        ctx = browser.new_context(viewport={"width": 1440, "height": 1000})
        ctx.add_init_script(f"localStorage.setItem('kisan_token', {json.dumps(TOKEN)}); localStorage.setItem('kisan_user', {json.dumps(json.dumps(USER))});")
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(f"pageerror: {str(e)[:160]}"))
        page.on("console", lambda m: m.type == "error" and errors.append(f"console: {m.text[:160]}"))

        page.goto(f"{BASE}/farms")
        card = page.locator(".card", has_text=farm["name"]).first
        card.wait_for(timeout=20000)
        nav = page.locator("aside, nav").first.inner_text()
        check("1. Irrigation is no longer a main-menu item (My Farm and others still are)", "Irrigation" not in nav and "My Farm" in nav)
        card.locator("[data-testid=farm-plots-button]").click()
        page.locator("[data-testid=open-plan]").first.click()
        page.locator("[data-testid=plot-plan]").wait_for(timeout=20000)
        check("2. The plot card opens its Cultivation Plan page", page.url.endswith(f"/farms/{FID}/plots/{PID}") and "Cultivation plan — North field" in page.locator("body").inner_text())

        page.locator("[data-testid=get-recommendations]").click()
        page.locator("[data-testid=rec-item]").first.wait_for(timeout=30000)
        items = page.locator("[data-testid=rec-item]")
        badge = page.locator("[data-testid=rec-result] [data-testid=source-badge]").first.get_attribute("data-kind")
        check("3. Recommendation for this plot: shortlist shown with its source labelled (rules or model)", items.count() >= 1 and badge in ("rule_engine", "trained_model"), f"{items.count()} crops, source {badge}")
        crop = items.first.get_attribute("data-crop")
        items.first.locator("[data-testid=select-crop]").click()
        page.locator("[data-testid=confirm-panel]").wait_for(timeout=5000)
        check("4. Selecting asks for confirmation first (nothing created yet)", api("GET", f"/farms/{FID}/plots/{PID}/cycles", TOKEN)[1]["items"] == [])
        page.locator("[data-testid=confirm-select]").click()
        page.locator("[data-testid=cycle-card]").wait_for(timeout=15000)
        check("5. After confirming, the plot has a planned crop cycle", "planned" == page.locator("[data-testid=cycle-status]").inner_text(), crop)

        page.locator("[data-testid=create-calendar]").click()
        page.locator("[data-testid=event-row]").first.wait_for(timeout=15000)
        first = page.locator("[data-testid=event-row]").first
        ev_id = first.get_attribute("data-event-id")
        first.locator("[data-testid=event-done]").click()   # controlled input: checked once the server confirms
        page.wait_for_function(f"() => document.querySelector(\"[data-event-id='{ev_id}'] [data-testid=event-done]\")?.checked === true", timeout=15000)
        page.reload()
        page.locator(f"[data-event-id='{ev_id}'] [data-testid=event-done]").wait_for(timeout=15000)
        check("6. Calendar created; ticking a task persists across reload (stable event id)",
              page.locator(f"[data-event-id='{ev_id}'] [data-testid=event-done]").is_checked() and page.locator("[data-testid=event-row]").count() >= 5)

        page.locator("[data-testid=assess-all]").click()
        page.locator("[data-testid=advice-fertilizer] [data-testid=advice-status]").wait_for(timeout=45000)
        kinds = lambda: {b.get_attribute("data-kind") for b in page.locator("[data-testid^=advice-] [data-testid=source-badge]").all()}
        fert_ok = page.locator("[data-testid=fert-schedule]").is_visible() and "calculation" in kinds()
        page.locator("[data-testid=tab-irrigation]").click()
        irr_ok = "external_api" in kinds() and "calculation" in kinds()
        page.locator("[data-testid=tab-market]").click()
        mkt_ok = "trained_model" in kinds() and "external_api" not in kinds()   # live prices not configured here → no "Live data" badge
        check("7. Advice inside the plan: fertilizer (calculated, schedule), irrigation (live weather + calculation), market (model coverage; no 'Live data' badge while live prices are not configured)", fert_ok and irr_ok and mkt_ok)
        page.screenshot(path=f"{SHOTS}/m4-1-plan.png", full_page=True)

        new_date = (datetime.date.today() + datetime.timedelta(days=24)).isoformat()
        page.fill("[data-testid=planned-date-input]", new_date)
        page.locator("[data-testid=save-planned-date]").click()
        page.locator("[data-testid=calendar-stale]").wait_for(timeout=15000)
        check("8. Changing the planned date flags the calendar (and advice) as out of date", "Out of date" in page.locator("[data-testid=calendar-stale]").inner_text())
        page.locator("[data-testid=calendar-stale] button").click()
        page.wait_for_function("() => !document.querySelector('[data-testid=calendar-stale]')", timeout=15000)
        check("9. Regenerating the calendar clears the flag and keeps the completed task ticked",
              page.locator(f"[data-event-id='{ev_id}'] [data-testid=event-done]").is_checked())

        api("PATCH", f"/farms/{FID}/plots/{PID}", TOKEN, {"soilTest": {**CARD, "N": 400}})
        page.reload()
        page.locator("[data-testid=tab-fertilizer]").click()
        page.locator("[data-testid=advice-stale-fertilizer]").wait_for(timeout=15000)
        stale_text = page.locator("[data-testid=advice-stale-fertilizer]").inner_text()
        page.locator("[data-testid=advice-stale-fertilizer] button").click()
        page.wait_for_function("() => !document.querySelector('[data-testid=advice-stale-fertilizer]')", timeout=30000)
        check("10. After a soil change the fertilizer advice says why it is out of date; Reassess makes it current", "plot details" in stale_text)
        page.screenshot(path=f"{SHOTS}/m4-2-reassessed.png", full_page=False)

        page.goto(f"{BASE}/irrigation")
        page.wait_for_load_state("networkidle")
        check("11. The old /irrigation page still works (service preserved, just not in the menu)", "404" not in page.title() and page.locator("body").inner_text().strip() != "")
        page.goto(f"{BASE}/dashboard")
        page.locator("[data-testid=sample-data-banner]").wait_for(timeout=15000)
        check("12. Dashboard figures are labelled as sample data", "Sample data" in page.locator("[data-testid=sample-data-banner]").inner_text())
        check("13. No page errors or console errors", not errors, "; ".join(errors[:3]))
    finally:
        browser.close()

api("DELETE", f"/farms/{FID}", TOKEN)
passed = sum(1 for _, ok in results if ok)
print(f"\n{passed}/{len(results)} UI checks passed")
raise SystemExit(0 if passed == len(results) else 1)
