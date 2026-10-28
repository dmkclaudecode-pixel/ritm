from playwright.sync_api import sync_playwright
import json
MOCK = """
window.__calls=[]; window.__hist=JSON.parse(localStorage.getItem('__h')||'[]'); window.__save=()=>localStorage.setItem('__h',JSON.stringify(window.__hist));
window.RitmNative = new Proxy({}, {get:(t,k)=>(...a)=>{
  if(k==='nudges') return JSON.stringify(window.__hist);
  if(k==='nudgeReply'){ window.__calls.push(a); const r=window.__hist.find(x=>x.id===a[0]); if(r){r.response=a[1]; if(a[1]==='work') r.outcome='exempt'; window.__save();} return JSON.stringify(r||{}); }
  if(k==='consumeFired'||k==='consumeInbox') return '[]';
  if(k==='status'||k==='diag') return '{}';
  if(k==='version') return '1';
  return '';
}});
"""
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(); ctx.add_init_script(MOCK); pg=ctx.new_page(); errs=[]
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("http://localhost:8765/"); pg.wait_for_timeout(1200)
    def setup(i, reason='work', pkg='ru.pikabu', label='Пикабу', minutes=26):
        pg.evaluate("""([i,reason,pkg,label,minutes])=>{const now=Date.now();
          window.__hist.push({id:'n'+i,at:now-i*864e5,pkg,label,reason,min:minutes,response:'',outcome:''}); window.__save();
          const c=JSON.parse(localStorage.getItem('ritm:chat')||'[]');
          c.push({id:'m'+i,at:now,who:'bot',kind:'nudge',nid:'n'+i,text:'Ты же сейчас на работе, а в '+label+' уже '+minutes+' минут. Это точно по делу?'});
          localStorage.setItem('ritm:chat',JSON.stringify(c));}""",[i,reason,pkg,label,minutes]); pg.reload(); pg.wait_for_timeout(800); pg.click("[data-tab=chat]")
    pg.click("[data-tab=chat]")
    def say(t):
        pg.fill("#chatInput", t); pg.keyboard.press("Enter"); pg.wait_for_timeout(500)
        return pg.evaluate("()=>{const c=JSON.parse(localStorage.getItem('ritm:chat'));return c.filter(m=>m.who==='bot').slice(-2).map(m=>m.text.slice(0,200))}")
    setup(0); print("1 работа:", say("по работе")); print(" calls:", pg.evaluate("()=>window.__calls"))
    setup(1); print("2 ещё 10 мин:", say("ещё 10 минут")); 
    setup(2); print("3 скучно:", say("мне скучно")); 
    setup(3); print("4 почему:", say("почему ты ко мне пристаёшь?"))
    setup(4); print("5 обычная запись:", say("выпил кофе")); 
    # workOk learning: history with work on 2 days
    pg.evaluate("()=>{window.__hist.forEach(h=>{if(h.id==='n0'||h.id==='n1'){h.response='work'}}); window.__save()}")
    print("6 review:", pg.evaluate("()=>{window.__ritmT.nudgeReview();const c=JSON.parse(localStorage.getItem('ritm:chat'));return [c[c.length-1].text,JSON.parse(localStorage.getItem('ritm:settings')).workOk]}"))
    print(errs); b.close()
