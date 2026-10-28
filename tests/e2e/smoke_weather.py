from playwright.sync_api import sync_playwright
import json
HOURLY=lambda: None
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':400,'height':900}); errs=[]
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.clock.set_fixed_time("2026-10-28T09:00:00")
    # мок сети Open-Meteo (интернета в песочнице нет)
    def geo(route):
        route.fulfill(status=200,headers={"access-control-allow-origin":"*","content-type":"application/json"},body=json.dumps({"results":[{"name":"Москва","latitude":55.75,"longitude":37.62,"admin1":"Москва","country":"Россия","population":12000000}]}))
    def fc(route):
        times=[f"2026-10-{d}T{h:02d}:00" for d in (28,29,30) for h in range(24)]
        temp=[8]*len(times); prob=[10 if not(d==28 and h>=17) else 80 for d in (28,29,30) for h in range(24)]
        code=[3 if not(d==28 and h>=17) else 63 for d in (28,29,30) for h in range(24)]
        route.fulfill(status=200,headers={"access-control-allow-origin":"*","content-type":"application/json"},body=json.dumps({"hourly":{"time":times,"temperature_2m":temp,"precipitation_probability":prob,"weather_code":code,"wind_speed_10m":[3]*len(times)},"daily":{"time":["2026-10-28","2026-10-29","2026-10-30"],"temperature_2m_max":[11,9,10],"temperature_2m_min":[5,4,6]}}))
    pg.route("**/geocoding-api.open-meteo.com/**",geo); pg.route("**/api.open-meteo.com/**",fc)
    pg.goto("http://localhost:8765/"); pg.wait_for_timeout(800)
    def say(t):
        pg.fill("#chatInput",t); pg.keyboard.press("Enter"); pg.wait_for_timeout(900)
        return pg.evaluate("()=>{const c=JSON.parse(localStorage.getItem('ritm:chat'));return c.filter(m=>m.who==='bot').slice(-1)[0].text.slice(0,300)}")
    print("1:", say("какая погода?"))
    print("2:", say("Москва"))
    print("3:", say("что по погоде?"))
    say("сегодня прогулка в 18")
    pg.click("[data-tab=today]"); pg.wait_for_timeout(500)
    print(pg.locator("#ritualCard").inner_text().replace("\n"," | ")[:700])
    pg.screenshot(path="/tmp/wx.png")
    pg.click("[data-rit=wxmove]"); pg.wait_for_timeout(400); print(pg.locator("#todayItems").inner_text().replace("\n"," | ")[:150], errs); b.close()
