from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(has_touch=True, viewport={'width':400,'height':800}); pg=ctx.new_page(); errs=[]
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("http://localhost:8765/"); pg.wait_for_timeout(1000)
    def send(t):
        pg.fill("#chatInput", t); pg.keyboard.press("Enter"); pg.wait_for_timeout(400)
    send("выпил стакан воды"); send("выпил кофе")
    cdp=ctx.new_cdp_session(pg)
    def swipe(sel_text):
        box=pg.locator(".msg.bot .bub", has_text=sel_text).first.bounding_box()
        x=box['x']+box['width']*0.7; y=box['y']+box['height']/2
        cdp.send("Input.dispatchTouchEvent",{"type":"touchStart","touchPoints":[{"x":x,"y":y}]})
        for i in range(1,9): cdp.send("Input.dispatchTouchEvent",{"type":"touchMove","touchPoints":[{"x":x-i*10,"y":y}]})
        cdp.send("Input.dispatchTouchEvent",{"type":"touchEnd","touchPoints":[]}); pg.wait_for_timeout(300)
    swipe("Воды сегодня")
    print("bar:", pg.locator("#replyBar").is_visible(), pg.locator("#replyBar").inner_text().replace("\n"," | "))
    send("не 250, а 0.4л")
    print("last:", pg.evaluate("()=>{const c=JSON.parse(localStorage.getItem('ritm:chat'));return c.slice(-2).map(m=>m.who+': '+m.text+(m.reply?' [reply->'+m.reply.text.slice(0,25)+']':''))}"))
    print("log:", pg.evaluate("()=>{const l=[];for(const k in localStorage) if(k.startsWith('ritm:w:')){const w=JSON.parse(localStorage[k]);for(const d in w.days)for(const e of (w.days[d].log||[]))l.push(e.type+':'+(e.ml||e.mg))}return l}"))
    print("bar after:", pg.locator("#replyBar").is_visible(), "quote shown:", pg.locator(".msg.me .rq").count(), errs)
    b.close()
