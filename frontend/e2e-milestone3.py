#!/usr/bin/env python3
"""Milestone 3 UI E2E: My Farm → plots (create with copy-from-farm, add, validate, edit, archive,
restore, delete, history protection). Runs against the live dev stack (frontend :5173 → backend :5000).
Creates a throwaway account (m3-ui-*@kisanai.test) and its farm through the API, drives the Plots
manager in a real browser and deletes the farm (with its plots and crop cycles) unless KEEP=1.
Env: E2E_BASE (default http://localhost:5173), E2E_SHOTS (default /tmp/kisanai-e2e-m3).
"""
import datetime, json, os, time, urllib.request
from playwright.sync_api import sync_playwright

BASE = os.environ.get("E2E_BASE", "http://localhost:5173")
SHOTS = os.environ.get("E2E_SHOTS", "/tmp/kisanai-e2e-m3")
KEEP = os.environ.get("KEEP") == "1"
os.makedirs(SHOTS, exist_ok=True)
STAMP = int(time.time() * 1000)
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


status, reg = api("POST", "/auth/register", body={"name": "M3 UI Farmer", "email": f"m3-ui-{STAMP}@kisanai.test", "password": "m3-test-pass-123"})
TOKEN, USER = reg["token"], reg["user"]
FARM_NAME = f"M3 UI Farm {STAMP % 100000}"
_, farm = api("POST", "/farms", TOKEN, {"name": FARM_NAME, "location": "Warangal, Telangana", "area": 2, "areaUnit": "acres",
                                        "soilType": "Black Cotton", "waterSource": "Borewell", "crops": ["Cotton"],
                                        "soilTest": {"N": 250, "P": 12, "K": 300, "ph": 7.9, "testedOn": "2026-02-01"}})
FID = farm["id"]
print(f"setup: account {USER['email']}, farm {FARM_NAME} (2 acres, whole-farm soil test with 4 values)")


def plots_api():
    return api("GET", f"/farms/{FID}/plots?status=all", TOKEN)[1]


with sync_playwright() as p:
    browser = p.chromium.launch()
    try:
        ctx = browser.new_context(viewport={"width": 1440, "height": 1000})
        ctx.add_init_script(f"localStorage.setItem('kisan_token', {json.dumps(TOKEN)}); localStorage.setItem('kisan_user', {json.dumps(json.dumps(USER))});")
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(f"pageerror: {str(e)[:200]}"))
        page.on("console", lambda m: m.type == "error" and errors.append(f"console: {m.text[:200]}"))
        page.on("dialog", lambda d: d.accept())
        failed_api = []   # every API response >= 400: (status, method, path)
        page.on("response", lambda r: "/api/" in r.url and r.status >= 400 and failed_api.append((r.status, r.request.method, r.url.split("/api", 1)[1].split("?")[0])))

        page.goto(f"{BASE}/farms")
        card = page.locator(".card", has_text=FARM_NAME).first
        card.wait_for(timeout=20000)
        check("1. Farm card shows the farm as a whole farm with no plots yet",
              "Whole farm" in card.locator("[data-testid=farm-plot-summary]").inner_text())

        card.locator("[data-testid=farm-plots-button]").click()
        page.locator("[data-testid=farm-plots]").wait_for(timeout=15000)
        alloc = page.locator("[data-testid=plots-allocation]").inner_text()
        check("2. Plots manager opens: whole-farm note and 0 of 2 acres allocated",
              page.locator("[data-testid=whole-farm-note]").is_visible() and "0 of 2 acres" in alloc, alloc.replace("\n", " "))

        # Plot A — copy whole-farm details
        page.locator("[data-testid=add-plot]").click()
        page.fill("#plot-name", "Plot A")
        page.fill("#plot-area", "1")
        page.locator("[data-testid=copy-from-farm]").check()
        page.locator("[data-testid=plot-save]").click()
        a_card = page.locator("[data-testid=plot-card][data-plot-name='Plot A']")
        a_card.wait_for(timeout=15000)
        a_text = a_card.inner_text()
        check("3. Plot A added with the farm’s soil, water and crop history copied (shown on the card)",
              "Black Cotton" in a_text and "4/12 card values" in a_text and "pH 7.9" in a_text and "Borewell" in a_text and "Previously: Cotton" in a_text and "soil type, soil test, water access, previous crops" in a_text,
              a_text.replace("\n", " | ")[:200])

        # Plot B — its own details, entered in guntha
        page.locator("[data-testid=add-plot]").click()
        page.fill("#plot-name", "Plot B")
        page.fill("#plot-area", "40")
        page.select_option("#plot-unit", "guntha")
        page.select_option("#plot-soil-type", "Red Laterite")
        page.fill("#plot-soil-N", "180")
        page.fill("#plot-soil-ph", "6.2")
        page.select_option("#plot-water-source", "Canal")
        page.select_option("#plot-water-method", "Furrow")
        page.locator("button:has-text('Add previous crop')").click()
        page.fill("[aria-label='Previous crop 1']", "Maize")
        page.select_option("[aria-label='Season 1']", "kharif")
        page.fill("[aria-label='Year 1']", "2025")
        page.locator("[data-testid=plot-save]").click()
        b_card = page.locator("[data-testid=plot-card][data-plot-name='Plot B']")
        b_card.wait_for(timeout=15000)
        b_text = b_card.inner_text()
        check("4. Plot B added in guntha (40 guntha · 1 ac) with its own soil, water and previous crop",
              "40 guntha · 1 ac" in b_text and "Red Laterite" in b_text and "pH 6.2" in b_text and "Canal · Furrow" in b_text and "Maize kharif 2025" in b_text,
              b_text.replace("\n", " | ")[:200])
        alloc = page.locator("[data-testid=plots-allocation]").inner_text()
        check("5. Allocation bar: 2 of 2 acres in plots, 0 acres free", "2 of 2 acres" in alloc and "0 acres not in any plot" in alloc, alloc.replace("\n", " "))
        page.screenshot(path=f"{SHOTS}/m3-1-plots.png", full_page=False)

        # Over-allocation and validation errors are shown in the form
        page.locator("[data-testid=add-plot]").click()
        page.fill("#plot-name", "Plot C")
        page.fill("#plot-area", "0.5")
        page.locator("[data-testid=plot-save]").click()
        err = page.locator("[data-testid=plot-error]")
        err.wait_for(timeout=10000)
        check("6. Adding 0.5 acre more is refused with the area explained (2.5 > 2 acres)",
              "2.5 acres" in err.inner_text() and "farm is 2 acres" in err.inner_text(), err.inner_text()[:160])
        page.fill("#plot-area", "0.1")
        page.fill("#plot-soil-ph", "15")
        page.locator("[data-testid=plot-save]").click()
        page.wait_for_function("() => document.querySelector('[data-testid=plot-error]')?.innerText.includes('pH must be a number between 0 and 14')", timeout=10000)
        check("7. Invalid soil value → the form names the field in farmer terms (pH must be a number between 0 and 14)", "pH must be a number between 0 and 14" in err.inner_text() and "soilTest." not in err.inner_text())
        page.screenshot(path=f"{SHOTS}/m3-2-validation.png", full_page=False)
        page.locator("button:has-text('Cancel')").click()
        check("8. Nothing was saved by the refused attempts", [x["name"] for x in plots_api()["plots"]] == ["Plot A", "Plot B"])

        # Edit Plot A only
        b_before = next(x for x in plots_api()["plots"] if x["name"] == "Plot B")
        page.locator("[aria-label='Edit Plot A']").click()
        page.fill("#plot-soil-ph", "7.2")
        page.locator("[data-testid=plot-save]").click()
        page.wait_for_function("() => document.querySelector(\"[data-plot-name='Plot A']\")?.innerText.includes('pH 7.2')", timeout=15000)
        data = plots_api()
        a_api = next(x for x in data["plots"] if x["name"] == "Plot A")
        b_api = next(x for x in data["plots"] if x["name"] == "Plot B")
        check("9. Editing Plot A’s pH updates only Plot A (revision 2); Plot B’s soil and revision unchanged",
              a_api["soilTest"]["ph"] == 7.2 and a_api["inputsRevision"] == 2 and b_api["soilTest"] == b_before["soilTest"] and b_api["inputsRevision"] == 1
              and "pH 6.2" in page.locator("[data-plot-name='Plot B']").inner_text())

        # Archive / restore / delete
        page.locator("[aria-label='Archive Plot B']").click()
        page.locator("[data-testid=show-archived]").wait_for(timeout=10000)
        alloc = page.locator("[data-testid=plots-allocation]").inner_text()
        check("10. Archiving Plot B removes it from the active list and the allocation (1 of 2 acres)",
              "1 of 2 acres" in alloc and page.locator("[data-testid=plot-card][data-plot-name='Plot B']").count() == 0, alloc.replace("\n", " "))
        page.locator("[data-testid=show-archived]").click()
        archived_card = page.locator("[data-testid=plot-card][data-plot-name='Plot B']")
        archived_card.wait_for(timeout=5000)
        check("11. ‘Show archived’ lists Plot B with an Archived badge", "Archived" in archived_card.inner_text())
        page.locator("[aria-label='Restore Plot B']").click()
        page.wait_for_function("() => document.querySelector('[data-testid=plots-allocation]')?.innerText.includes('2 of 2 acres')", timeout=10000)
        check("12. Restoring brings Plot B back into the allocation (2 of 2 acres)", True)
        page.locator("[aria-label='Delete Plot B']").click()
        page.wait_for_function("() => !document.querySelector(\"[data-plot-name='Plot B']\")", timeout=10000)
        check("13. A plot without crop history can be deleted (after confirmation)", [x["name"] for x in plots_api()["plots"]] == ["Plot A"])

        # History protection: a plot with a crop cycle can't be deleted
        planned = (datetime.date.today() + datetime.timedelta(days=20)).isoformat()
        st, cyc = api("POST", f"/farms/{FID}/plots/{a_api['id']}/cycles", TOKEN, {"crop": "Cotton", "plannedSowingDate": planned})
        page.mouse.click(5, 5)   # close the modal (backdrop)
        page.wait_for_function(f"() => [...document.querySelectorAll('.card')].some(c => c.innerText.includes({json.dumps(FARM_NAME)}) && c.innerText.includes('1 plot · 1 ac · 1 crop on'))", timeout=10000)
        summary = card.locator("[data-testid=farm-plot-summary]").inner_text()
        check("14. Farm card summary refreshes after closing: 1 plot · 1 ac · 1 crop on", "1 plot · 1 ac" in summary and "1 crop on" in summary, summary)
        card.locator("[data-testid=farm-plots-button]").click()
        a_card = page.locator("[data-testid=plot-card][data-plot-name='Plot A']")
        a_card.wait_for(timeout=15000)
        check("15. Plot A shows its open crop cycle (Cotton · planned)", st == 201 and "Cotton · planned" in a_card.inner_text())
        page.locator("[aria-label='Delete Plot A']").click()
        toast = page.locator("text=Archive it instead")
        toast.wait_for(timeout=10000)
        check("16. Deleting a plot with crop history is refused with the reason shown; the plot stays",
              toast.is_visible() and [x["name"] for x in plots_api()["plots"]] == ["Plot A"])
        page.screenshot(path=f"{SHOTS}/m3-3-history.png", full_page=False)
        # The three refused requests above are deliberate; anything else failing is a real error.
        plots_path, a_path = f"/farms/{FID}/plots", f"/farms/{FID}/plots/{a_api['id']}"
        expected = sorted([(409, "POST", plots_path), (400, "POST", plots_path), (409, "DELETE", a_path)])
        unexpected_console = [e for e in errors if "Failed to load resource: the server responded with a status of" not in e]
        check("17. Only the 3 deliberately refused API calls failed (409 area, 400 pH, 409 history); no page or other console errors",
              sorted(failed_api) == expected and not unexpected_console and len(errors) == len(failed_api),
              f"failed API calls: {failed_api}; other console errors: {unexpected_console[:3]}")
    finally:
        browser.close()

if not KEEP:
    api("DELETE", f"/farms/{FID}", TOKEN)
    print("cleaned up the farm (with its plots and crop cycles; account remains)")
passed = sum(1 for _, ok in results if ok)
print(f"\n{passed}/{len(results)} UI checks passed")
raise SystemExit(0 if passed == len(results) else 1)
