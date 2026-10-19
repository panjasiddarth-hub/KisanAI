#!/usr/bin/env python3
"""Stage B UI checks: unsupported claims removed (landing, login, AI Assistant), notifications marked
unavailable, disease photo diagnosis marked unavailable with symptom-match output, fertilizer split.
Runs against the live dev stack (frontend :5173 → backend :5000). Throwaway account m4-ui-int-*@kisanai.test.
Env: E2E_BASE (default http://localhost:5173), E2E_SHOTS (default /tmp/kisanai-e2e-int).
"""
import base64, json, os, re, time, urllib.request
from playwright.sync_api import sync_playwright

BASE = os.environ.get("E2E_BASE", "http://localhost:5173")
SHOTS = os.environ.get("E2E_SHOTS", "/tmp/kisanai-e2e-int")
os.makedirs(SHOTS, exist_ok=True)
STAMP = int(time.time() * 1000)
FALSE_CLAIMS = re.compile(r"95\s*%|MobileNet|38 plant disease|Validation Agent|Graph-RAG|Voice-first|own language|cross-check|40\+ dated|10K\+|78% match|Snap a leaf|visual triage")
FAKE_ALERTS = re.compile(r"Leaf blight detected|Soil moisture below 30%|PM Kisan installment|Heavy rainfall predicted")
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==")
results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond)))
    print(f"{'PASS' if cond else 'FAIL'}  {name}" + (f"  — {detail}" if detail else ""))


def api(method, path, token=None, body=None):
    req = urllib.request.Request(f"{BASE}/api{path}", method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read() or b"null")


reg = api("POST", "/auth/register", body={"name": "M4 UI Integrity", "email": f"m4-ui-int-{STAMP}@kisanai.test", "password": "m4-test-pass-123"})
TOKEN, USER = reg["token"], reg["user"]
png_path = f"{SHOTS}/leaf.png"
open(png_path, "wb").write(PNG)

with sync_playwright() as p:
    browser = p.chromium.launch()
    try:
        # Public pages (no login)
        anon = browser.new_page(viewport={"width": 1440, "height": 1000})
        anon.goto(f"{BASE}/")
        anon.wait_for_load_state("networkidle")
        landing = anon.locator("body").inner_text()
        check("1. Landing page: no unsupported accuracy / model / validation claims", not FALSE_CLAIMS.search(landing), (FALSE_CLAIMS.search(landing) or [""])[0])
        check("2. Landing page: disease feature says photo diagnosis is not available; personas marked illustrative",
              "Photo diagnosis is not available yet" in landing and landing.count("Illustrative persona") == 3)
        anon.goto(f"{BASE}/login")
        anon.wait_for_load_state("networkidle")
        login = anon.locator("body").inner_text()
        check("3. Login page: no '95% Accuracy' / '10K+ Farmers'; shows verifiable figures", not FALSE_CLAIMS.search(login) and "Crops in the crop model" in login)
        anon.close()

        ctx = browser.new_context(viewport={"width": 1440, "height": 1000})
        ctx.add_init_script(f"localStorage.setItem('kisan_token', {json.dumps(TOKEN)}); localStorage.setItem('kisan_user', {json.dumps(json.dumps(USER))});")
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(f"pageerror: {str(e)[:160]}"))
        page.on("console", lambda m: m.type == "error" and errors.append(f"console: {m.text[:160]}"))

        page.goto(f"{BASE}/ai-assistant")
        page.locator("[data-testid=assistant-unavailable]").wait_for(timeout=15000)
        body = page.locator("body").inner_text()
        check("4. AI Assistant: says it is not connected; no chat box, no canned 'agent' replies or claims",
              "not connected yet" in body and page.locator(".page-content textarea, .page-content input").count() == 0 and not FALSE_CLAIMS.search(body) and "consulting my specialized agents" not in body)

        badge = page.locator("[aria-label=Notifications] span")
        page.locator("[aria-label=Notifications]").click()
        drop = page.locator("[data-testid=notifications-unavailable]").first
        drop.wait_for(timeout=5000)
        check("5. Notification bell: no unread badge; dropdown says notifications are not available yet (no fabricated alerts)",
              badge.count() == 0 and "not available yet" in drop.inner_text() and not FAKE_ALERTS.search(page.locator("body").inner_text()))
        page.goto(f"{BASE}/notifications")
        page.locator("[data-testid=notifications-unavailable]").wait_for(timeout=10000)
        check("6. Notifications page: marked unavailable, no fabricated alerts", not FAKE_ALERTS.search(page.locator("body").inner_text()))

        page.goto(f"{BASE}/disease")
        page.locator("[data-testid=photo-unavailable]").wait_for(timeout=15000)
        check("7. Disease page states photo diagnosis is unavailable before anything is submitted", "no trained plant-disease image model" in page.locator("[data-testid=photo-unavailable]").inner_text())
        page.locator("button:has-text('Tomato')").first.click()
        page.locator("button:has-text('Yellowing of leaves')").click()
        page.locator("button:has-text('Brown / black spots')").click()
        page.set_input_files("input[type=file]", png_path)
        with page.expect_response(lambda r: "/api/agents/disease" in r.url and r.request.method == "POST") as resp_info:
            page.locator("button:has-text('Diagnose')").click()
        resp = resp_info.value
        data = resp.json()
        page.locator("[data-testid=photo-status]").wait_for(timeout=10000)
        text = page.locator("body").inner_text()
        match = page.locator("[data-testid=symptom-match]").first.inner_text()
        check("8. Diagnosis with a photo: 'saved privately — not analysed' shown, symptom match as 'x/y', no 'confidence' figure",
              resp.status == 200 and data["photo"]["analysed"] is False and "not analysed" in page.locator("[data-testid=photo-status]").inner_text()
              and re.fullmatch(r"\d+/\d+", match) and "confidence" not in text.lower() and not re.search(r"\d{2}%", page.locator("[data-testid=symptom-match]").first.inner_text()),
              f"top match {match}")
        page.screenshot(path=f"{SHOTS}/int-1-disease.png", full_page=False)

        # Fertilizer agent page: shares reflect the N actually applied (DAP's N counted at sowing)
        plan = api("POST", "/agents/fertilizer", TOKEN, {"crop": "Cotton", "areaAcres": 2, "soilType": "loamy"})
        check("9. Fertilizer split via API: 25 + 12.5 + 12.5 kg N/acre = 50 (shares 50/25/25)",
              [s["nutrientsPerAcre"]["N"] for s in plan["schedule"]] == [25, 12.5, 12.5] and plan["balance"]["nApplied"] == 50)
        check("10. No page errors or console errors", not errors, "; ".join(errors[:3]))
    finally:
        browser.close()

passed = sum(1 for _, ok in results if ok)
print(f"\n{passed}/{len(results)} UI checks passed")
raise SystemExit(0 if passed == len(results) else 1)
