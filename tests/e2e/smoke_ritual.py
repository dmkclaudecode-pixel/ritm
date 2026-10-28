from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':400,'height':900}); errs=[]
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.clock.set_fixed_time("2026-10-28T09:00:00")
    pg.goto("http://localhost:8765/"); pg.wait_for_timeout(1000)
    pg.fill("#chatInput","лёг в 23:30 встал в 5:30"); pg.keyboard.press("Enter"); pg.wait_for_timeout(400)
    pg.fill("#chatInput","сегодня силовая в 18"); pg.keyboard.press("Enter"); pg.wait_for_timeout(400)
    pg.click("[data-tab=today]"); pg.wait_for_timeout(500)
    print("visible:", pg.locator("#ritualCard").is_visible()); print(pg.locator("#ritualCard").inner_text().replace("\n"," | ")[:600])
    pg.click("#ritualCard [data-sc=energy][data-v='2']"); pg.wait_for_timeout(300)
    print(pg.locator("#ritualCard .rmode").inner_text()[:300])
    pg.screenshot(path="/tmp/ritual.png")
    pg.click("[data-rit=lighten]"); pg.wait_for_timeout(500)
    print(pg.locator("#todayItems").inner_text().replace("\n"," | ")[:200])
    pg.click("[data-rit=done]"); pg.wait_for_timeout(300); print("after done hidden:", pg.locator("#ritualCard").is_hidden(), errs); b.close()
