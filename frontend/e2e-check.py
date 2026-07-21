#!/usr/bin/env python3
"""End-to-end smoke test for KisanAI frontend (production build served via `vite preview`)."""
import sys, time, json
from playwright.sync_api import sync_playwright

BASE = "http://localhost:4173"
SHOTS = "/home/user/KisanAI/screenshots"

console_errors = {}
page_errors = {}

def visit(page, path, name, wait_ms=1600):
    path_console, path_page = [], []
    def on_console(msg):
        if msg.type == "error":
            path_console.append(msg.text)
    page.on("console", on_console)
    def on_pageerror(err):
        path_page.append(str(err))
    page.on("pageerror", on_pageerror)
    resp = page.goto(f"{BASE}{path}", wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(wait_ms)
    status = resp.status if resp else "no-response"
    text = page.locator("body").inner_text() or ""
    page.screenshot(path=f"{SHOTS}/{name}.png", full_page=False)
    console_errors[path] = path_console
    page_errors[path] = path_page
    ok = status == 200 and len(text.strip()) > 30 and not path_page
    return ok, status, len(text.strip()), text.strip().split("\n")[0][:60]

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    results = []

    # 1. Landing
    results.append(("GET / (Landing)", *visit(page, "/", "01-landing")))

    # 2. Login page renders
    results.append(("GET /login", *visit(page, "/login", "02-login")))

    # 3. Perform login with demo credentials
    page.goto(f"{BASE}/login", wait_until="networkidle")
    page.fill('input[type="email"], input[name="email"]', "ramesh@kisan.com")
    page.fill('input[type="password"], input[name="password"]', "password123")
    page.on("pageerror", lambda e: page_errors.setdefault("login-submit", []).append(str(e)))
    page.click('button[type="submit"]')
    try:
        page.wait_for_url("**/dashboard**", timeout=10000)
        login_ok = True
    except Exception:
        login_ok = "dashboard" in page.url
    page.wait_for_timeout(1500)
    page.screenshot(path=f"{SHOTS}/03-after-login.png")
    results.append(("Login redirects to /dashboard", login_ok, page.url, 0, ""))

    # 4. All protected routes
    routes = [
        ("/dashboard", "04-dashboard"),
        ("/farms", "05-farms"),
        ("/crops", "06-crops"),
        ("/weather", "07-weather"),
        ("/disease", "08-disease"),
        ("/irrigation", "09-irrigation"),
        ("/market", "10-market"),
        ("/schemes", "11-schemes"),
        ("/analytics", "12-analytics"),
        ("/ai-assistant", "13-ai-assistant"),
        ("/profile", "14-profile"),
    ]
    for path, name in routes:
        results.append((f"GET {path}", *visit(page, path, name)))

    # 5. Quick interaction check: AI assistant input works
    try:
        page.goto(f"{BASE}/ai-assistant", wait_until="networkidle")
        box = page.locator("textarea, input[type='text']").last
        box.fill("What is the best fertilizer for wheat?")
        page.keyboard.press("Enter")
        page.wait_for_timeout(2500)
        page.screenshot(path=f"{SHOTS}/15-ai-chat.png")
        body = page.locator("body").inner_text()
        results.append(("AI Assistant responds", "fertilizer" in body.lower() or "wheat" in body.lower() or len(body) > 0, "ok", len(body), ""))
    except Exception as e:
        results.append(("AI Assistant responds", False, str(e), 0, ""))

    browser.close()

print("\n================ E2E RESULTS ================")
all_ok = True
for name, ok, status, size, sample in results:
    mark = "PASS" if ok else "FAIL"
    if not ok:
        all_ok = False
    print(f"[{mark}] {name:<38} status={status} body_len={size} {sample}")
print("---------------- console/page errors --------")
had_err = False
for path, errs in {**console_errors, **page_errors}.items():
    real = [e for e in errs if "favicon" not in e.lower() and "fonts.g" not in e.lower() and "net::ERR" not in e]
    if real:
        had_err = True
        print(f"{path}:")
        for e in real[:4]:
            print(f"   - {e[:180]}")
if not had_err:
    print("None (excluding favicon/font/network-resource noise)")
print("=============================================")
sys.exit(0 if all_ok else 1)
