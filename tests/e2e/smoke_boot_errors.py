from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(); 
    pg.on("pageerror", lambda e: print("PAGEERR",e.stack))
    pg.on("console", lambda m: print("CON",m.type,m.text[:200]) if m.type in("error","warning") else None)
    pg.on("requestfailed", lambda r: print("REQFAIL",r.url))
    pg.goto("http://localhost:8765/"); pg.wait_for_timeout(1500); b.close()
