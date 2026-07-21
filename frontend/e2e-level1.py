#!/usr/bin/env python3
"""Level-1 full-stack E2E: real backend + built frontend via vite preview.
Run with backend on :5000 and frontend preview on :4173."""
from playwright.sync_api import sync_playwright

BASE = "http://localhost:4173"

def assert_in(page, *needles):
    body = page.locator("body").inner_text().casefold()
    missing = [n for n in needles if n.casefold() not in body]
    assert not missing, f"MISSING {missing}"

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1440, "height": 900})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:150]))

    pg.goto(f"{BASE}/login", wait_until="networkidle")
    pg.fill('input[type="email"], input[name="email"]', "siddarth@kisan.com")
    pg.fill('input[type="password"], input[name="password"]', "password123")
    pg.click('button[type="submit"]')
    pg.wait_for_url("**/dashboard**", timeout=12000)
    assert pg.evaluate("localStorage.getItem('kisan_token')").startswith("eyJ")
    print("1. LOGIN via BACKEND API (real JWT) OK")

    pg.goto(f"{BASE}/agents/crop", wait_until="networkidle"); pg.wait_for_timeout(1000)
    pg.click("text=🌦️ Rainfed")
    pg.click("text=Suggest Crops"); pg.wait_for_timeout(3000)
    assert_in(pg, "Pigeonpea", "rule engine")
    print("2. CROP AGENT OK"); pg.screenshot(path="/home/user/KisanAI/screenshots/l1-cropsuggester.png")

    pg.goto(f"{BASE}/agents/fertilizer", wait_until="networkidle"); pg.wait_for_timeout(800)
    pg.click("text=Generate Fertilizer Plan"); pg.wait_for_timeout(3000)
    assert_in(pg, "164", "stage-wise schedule")
    print("3. FERTILIZER AGENT OK"); pg.screenshot(path="/home/user/KisanAI/screenshots/l1-fertilizer.png")

    pg.goto(f"{BASE}/disease", wait_until="networkidle"); pg.wait_for_timeout(800)
    pg.click("text=Holes in leaves / bolls")
    pg.click("text=Damaged bolls / fruits")
    pg.click("button:has-text('Diagnose') >> nth=-1")
    pg.wait_for_timeout(3000)
    assert_in(pg, "pink bollworm", "chemical control")
    print("4. DISEASE AGENT OK"); pg.screenshot(path="/home/user/KisanAI/screenshots/l1-disease.png")

    pg.goto(f"{BASE}/calendar", wait_until="networkidle"); pg.wait_for_timeout(1000)
    pg.click("text=Plan My Season"); pg.wait_for_timeout(3500)
    assert_in(pg, "land preparation", "fertilizer agent", "harvest window begins")
    print("5. FARM CALENDAR OK"); pg.screenshot(path="/home/user/KisanAI/screenshots/l1-calendar.png")

    pg.click("text=Land preparation — deep ploughing >> nth=0"); pg.wait_for_timeout(800)
    pg.goto(f"{BASE}/calendar", wait_until="networkidle"); pg.wait_for_timeout(1500)
    assert_in(pg, "1/")
    print("6. EVENT TOGGLE + BACKEND PERSIST OK")

    print("PAGE ERRORS:", errs if errs else "none")
    b.close()
print("FULL-STACK LEVEL-1 E2E: ALL PASS")
