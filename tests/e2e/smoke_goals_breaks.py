from playwright.sync_api import sync_playwright
import json,time
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':400,'height':900}); errs=[]
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.clock.set_fixed_time("2026-10-28T11:00:00")
    pg.goto("http://localhost:8765/"); pg.wait_for_timeout(1000)
    now=int(time.time()*1000)
    pg.evaluate("""n=>{const c=JSON.parse(localStorage.getItem('ritm:chat')||'[]');c.push({id:'wk1',who:'bot',text:'Как дела на работе? Если сидишь давно — 2 минуты разминки помогут голове.',kind:'work',at:Date.now()});localStorage.setItem('ritm:chat',JSON.stringify(c));}""",now)
    pg.reload(); pg.wait_for_timeout(1000)
    for t in ["Сходили попили кофе с коллегой","пообедали с коллегами 40 минут"]:
        pg.fill("#chatInput",t); pg.keyboard.press("Enter"); pg.wait_for_timeout(500)
    msgs=pg.locator("#chat .msg, .msg").all_inner_texts()
    for m in msgs[-10:]: print("•",m.replace("\n"," ")[:200])
    pg.click("[data-tab=stats]"); pg.wait_for_timeout(500)
    print(pg.locator("#goalsCard").inner_text().replace("\n"," | ")[:700])
    print(errs); b.close()
