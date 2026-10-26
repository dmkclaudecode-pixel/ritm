(() => {
"use strict";
const CATS = {
  strength:{n:"Силовая", c:"--c-strength", move:true},
  walk:{n:"Прогулка", c:"--c-walk", move:true},
  pool:{n:"Бассейн", c:"--c-pool", move:true},
  social:{n:"Общение", c:"--c-social"},
  offline:{n:"Без экранов", c:"--c-offline"},
  fun:{n:"Удовольствие", c:"--c-fun"},
  games:{n:"Ютуб и игры", c:"--c-games"},
  other:{n:"Другое", c:"--c-other"}
};
const GOAL_CATS = ["strength","walk","pool","social","offline","fun"];
const DEFAULT_SETTINGS = {goals:{strength:2,walk:4,pool:1,social:2,offline:1,fun:2}, screensOff:"22:30", morning:"08:45", evening:"19:45"};
const DW = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
const DFULL = ["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота","Воскресенье"];
const MON = ["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"];
const TEMPLATE = [
  [0,"strength","Домашняя силовая, 20 мин","19:00"],[0,"games","Ютуб или игры","21:00"],
  [1,"walk","Быстрая прогулка 30–40 мин","18:30"],[1,"social","Звонок или встреча с близким",""],
  [2,"walk","Прогулка или растяжка 15 мин",""],[2,"offline","Вечер без экранов","21:00"],
  [3,"strength","Домашняя силовая, 20 мин","19:00"],[3,"games","Ютуб или игры","21:00"],
  [4,"walk","Прогулка 30–40 мин",""],[4,"fun","Что-то приятное: кино, кафе, друзья",""],[4,"games","Игровой вечер","21:00"],
  [5,"pool","Бассейн с ускорениями","11:00"],[5,"fun","Новое место или занятие",""],
  [6,"walk","Длинная прогулка на природе","12:00"],[6,"fun","Отдых и план на неделю","19:00"]
];

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid = () => Math.random().toString(36).slice(2,10);
const pad = n => String(n).padStart(2,"0");
const iso = d => d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
function mondayOf(d){ const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate()-((x.getDay()+6)%7)); return x; }
function addDays(d,n){ const x = new Date(d); x.setDate(x.getDate()+n); return x; }

/* ---------- storage: this device only ---------- */
const LS = {
  get(k){ try{ const v = localStorage.getItem("ritm:"+k); return v ? JSON.parse(v) : null; }catch(e){ return null; } },
  set(k,v){ try{ localStorage.setItem("ritm:"+k, JSON.stringify(v)); return true; }catch(e){ toast("Не удалось сохранить: память браузера недоступна"); return false; } },
  keys(){ const out = []; try{ for(let i=0;i<localStorage.length;i++){ const k = localStorage.key(i); if(k && k.startsWith("ritm:")) out.push(k.slice(5)); } }catch(e){} return out; }
};
try{ if(navigator.storage && navigator.storage.persist) navigator.storage.persist(); }catch(e){}

let weekStart = mondayOf(new Date());
let settings = loadSettings();
let week = null;
const wkey = () => iso(weekStart);
function loadSettings(){ const s = LS.get("settings") || {}; return {...DEFAULT_SETTINGS, ...s, goals:{...DEFAULT_SETTINGS.goals, ...(s.goals||{})}}; }
function persist(){ LS.set("w:"+wkey(), {...week, week:wkey(), updated:new Date().toISOString()}); }
function persistSettings(){ LS.set("settings", settings); }
function loadWeek(){ const w = LS.get("w:"+wkey()); week = w ? {items:w.items||[], days:w.days||{}} : {items:[], days:{}}; render(); }

/* first launch: start with the agreed plan */
if(!LS.get("started")){
  const k = iso(mondayOf(new Date()));
  if(!LS.get("w:"+k)) LS.set("w:"+k, {items:TEMPLATE.map(([d,c,t,tm]) => ({id:uid(), day:d, cat:c, t, time:tm, done:false})), days:{}, week:k});
  LS.set("started", true); persistSettings();
}

/* ---------- analysis ---------- */
function todayIdx(){ const t = new Date(); return iso(mondayOf(t)) === wkey() ? (t.getDay()+6)%7 : (t < weekStart ? -1 : 7); }
function analyze(){
  const items = week.items, ti = todayIdx(), g = settings.goals;
  const by = {}; for(const c of Object.keys(CATS)) by[c] = {plan:0, done:0, dueUndone:0};
  for(const it of items){ const b = by[it.cat]||by.other; b.plan++; if(it.done) b.done++; else if(it.day < ti) b.dueUndone++; }
  const gaps = [], load = Array(7).fill(0); items.forEach(it => load[it.day]++);
  const freeDay = cat => { let best=-1, bl=99; for(let d=Math.max(0,ti); d<7; d++){ if(items.some(i=>i.day===d && i.cat===cat)) continue; if(load[d]<bl){ bl=load[d]; best=d; } } return best; };
  for(const c of GOAL_CATS){
    const goal = g[c]||0; if(!goal) continue; const b = by[c];
    if(b.done >= goal) continue;
    const left = goal - b.done, possible = b.plan - b.done - b.dueUndone;
    if(b.plan < goal || possible < left){
      const need = Math.max(goal - b.plan, left - possible), fd = freeDay(c);
      gaps.push({k:"warn", cat:c, day:fd, fix:fd>=0, text:`<b>${CATS[c].n}</b>: не хватает ${need} из ${goal}` + (fd>=0 ? `. Свободнее всего ${DW[fd].toLowerCase()}` : "")});
    } else if(b.dueUndone > 0) gaps.push({k:"tip", text:`<b>${CATS[c].n}</b>: ${b.dueUndone} пропущено, но ещё успеваете по плану`});
  }
  const late = items.filter(i => i.cat==="games" && i.time && i.time >= settings.screensOff);
  if(late.length) gaps.push({k:"tip", text:`Игры после ${settings.screensOff} стоят в ${late.length} ${late.length===1?"день":"дня"}. Сон пострадает, лучше сдвинуть раньше`});
  const elapsed = ti>=0 && ti<=6 ? ti+1 : (ti>6 ? 7 : 0);
  let sleep=0, light=0; const eMove=[], eRest=[];
  for(let d=0; d<7; d++){
    const h = week.days[d]||{}; if(h.sleep) sleep++; if(h.light) light++;
    if(h.energy){ const moved = items.some(i => i.day===d && i.done && CATS[i.cat] && CATS[i.cat].move); (moved?eMove:eRest).push(h.energy); }
  }
  if(ti>=0 && ti<=6 && elapsed>=3){
    if(sleep < elapsed-1) gaps.push({k:"tip", text:`Режим сна соблюдён ${sleep} из ${elapsed} дней. Это база для бодрости`});
    if(light < elapsed-1) gaps.push({k:"tip", text:`Утренний свет: ${light} из ${elapsed} дней. Хватит 15 минут на улице`});
  }
  const avg = a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : null;
  return {by, gaps, sleep, light, eMove:avg(eMove), eRest:avg(eRest), nMove:eMove.length, nRest:eRest.length, doneAll:items.filter(i=>i.done).length, total:items.length};
}

/* ---------- render ---------- */
let lastGaps = [];
function render(){
  const ws = weekStart, we = addDays(ws,6), ti = todayIdx();
  $("range").textContent = `${ws.getDate()} ${MON[ws.getMonth()]} – ${we.getDate()} ${MON[we.getMonth()]}` + (ti>=0 && ti<=6 ? " · эта неделя" : "");
  $("strip").innerHTML = DW.map((w,d) => {
    const dots = week.items.filter(i=>i.day===d).slice(0,5).map(i=>`<i class="${i.done?"on":""}"></i>`).join("");
    return `<button class="dchip ${d===ti?"today":""}" data-jump="${d}" aria-label="${DFULL[d]}"><span class="dw">${w}</span><span class="dn">${addDays(ws,d).getDate()}</span><span class="dots">${dots}</span></button>`;
  }).join("");

  const a = analyze(), g = settings.goals;
  let html = `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><h2>Чего не хватает</h2><span class="note num">${a.doneAll}/${a.total} сделано</span></div>`;
  if(!week.items.length){
    html += `<p class="note">Неделя пустая. Заполните её по шаблону или добавляйте дела по дням.</p><div class="tools"><button class="btn primary" data-act="tpl">Заполнить по шаблону</button><button class="btn" data-act="copyPrev">Скопировать прошлую</button></div>`;
  } else {
    html += `<div class="goals">` + GOAL_CATS.filter(c=>g[c]).map(c => {
      const b = a.by[c], goal = g[c], col = `var(${CATS[c].c})`;
      return `<div class="goal"><div class="gh"><span>${CATS[c].n}</span><span class="num">${b.done}/${goal}</span></div><div class="bar"><div class="pl" style="width:${Math.min(100,b.plan/goal*100)}%;background:${col}"></div><div class="dn" style="width:${Math.min(100,b.done/goal*100)}%;background:${col}"></div></div></div>`;
    }).join("") + `</div>`;
    html += `<ul class="gaps">` + (a.gaps.length ? a.gaps.map((x,i) => `<li class="gap ${x.k==="tip"?"tip":""}"><span class="txt">${x.text}</span>${x.fix?`<button class="fix" data-fix="${i}">Добавить</button>`:""}</li>`).join("")
      : `<li class="gap ok"><span class="txt">Всё по плану. Цели недели закрыты или стоят в расписании.</span></li>`) + `</ul>`;
    let corr = "—";
    if(a.nMove>=2 && a.nRest>=2) corr = (a.eMove - a.eRest >= 0 ? "+" : "") + (a.eMove - a.eRest).toFixed(1);
    html += `<div class="stats"><div class="stat"><span class="v num">${a.sleep}/7</span><span class="k">дней в режиме сна</span></div><div class="stat"><span class="v num">${a.light}/7</span><span class="k">утренний свет</span></div><div class="stat"><span class="v num">${corr}</span><span class="k">энергия в дни с движением</span></div></div>`;
    html += corr === "—" ? `<p class="note">Отмечайте энергию каждый день. Через пару недель станет видно, как движение влияет на самочувствие.</p>`
      : `<p class="note">Разница в средней энергии (1–5) между днями с движением и без. Игр и Ютуба на неделе: ${week.items.filter(i=>i.cat==="games").length}.</p>`;
  }
  $("summary").innerHTML = html; lastGaps = a.gaps;

  if(ti>=0 && ti<=6){
    const h = week.days[ti]||{};
    $("today").hidden = false;
    $("today").innerHTML = `<h2>Сегодня, ${DFULL[ti].toLowerCase()}</h2>
      <div class="check">
        <button class="tog ${h.sleep?"on":""}" data-hab="sleep"><span class="box"></span>Лёг и встал по режиму</button>
        <button class="tog ${h.light?"on":""}" data-hab="light"><span class="box"></span>Был на дневном свету</button>
      </div>
      <div class="scale"><span class="label">Энергия</span><div class="row">${[1,2,3,4,5].map(n=>`<button class="${h.energy===n?"on":""}" data-sc="energy" data-v="${n}">${n}</button>`).join("")}</div></div>
      <div class="scale"><span class="label">Настроение</span><div class="row">${[1,2,3,4,5].map(n=>`<button class="${h.mood===n?"on":""}" data-sc="mood" data-v="${n}">${n}</button>`).join("")}</div></div>`;
  } else $("today").hidden = true;

  $("days").innerHTML = DFULL.map((name,d) => {
    const date = addDays(ws,d);
    const its = week.items.filter(i=>i.day===d).sort((x,y)=>(x.time||"99").localeCompare(y.time||"99"));
    const rows = its.map(it => {
      const cat = CATS[it.cat]||CATS.other, late = it.cat==="games" && it.time && it.time >= settings.screensOff;
      return `<div class="item ${it.done?"done":""}"><span class="stripe" style="background:var(${cat.c})"></span>
        <button class="tick" data-tick="${it.id}" aria-label="${it.done?"Снять отметку":"Отметить сделанным"}"><span></span></button>
        <button class="body" data-edit="${it.id}"><span class="t">${esc(it.t)}</span><span class="meta"><span>${cat.n}</span>${it.time?`<span class="num ${late?"late":""}">${it.time}</span>`:""}</span></button></div>`;
    }).join("");
    return `<div class="day" id="day${d}"><div class="dayhead ${d===ti?"istoday":""}"><h2>${name}</h2><span class="when num">${date.getDate()} ${MON[date.getMonth()]}</span></div>
      <div class="items">${rows || `<div class="empty">Свободный день</div>`}<button class="add" data-add="${d}">+ Добавить</button></div></div>`;
  }).join("");
  renderReminders();
}

/* ---------- calendar ---------- */
const tz = (() => { try{ return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; }catch(e){ return ""; } })();
const APP_URL = location.origin + location.pathname;
const stamp = (date, time) => iso(date).replace(/-/g,"") + "T" + time.replace(":","") + "00";
function plusMin(time, m){ const [h,mm] = time.split(":").map(Number); const t = h*60+mm+m; return pad(Math.floor(t/60)%24)+":"+pad(t%60); }
function gcalUrl({title, date, time, minutes=15, details="", daily=false}){
  const p = new URLSearchParams({action:"TEMPLATE", text:title, details});
  if(time) p.set("dates", stamp(date,time)+"/"+stamp(date,plusMin(time,minutes)));
  else { const n = addDays(date,1); p.set("dates", iso(date).replace(/-/g,"")+"/"+iso(n).replace(/-/g,"")); }
  if(tz) p.set("ctz", tz);
  if(daily) p.set("recur", "RRULE:FREQ=DAILY");
  return "https://calendar.google.com/calendar/render?" + p.toString();
}
function renderReminders(){
  $("remMorning").value = settings.morning; $("remEvening").value = settings.evening;
  const today = new Date();
  $("gMorning").href = gcalUrl({title:"Ритм недели: план на день", date:today, time:settings.morning, minutes:10, daily:true, details:"Откройте Ритм недели и посмотрите дела на сегодня. 15 минут дневного света до обеда.\n"+APP_URL});
  $("gEvening").href = gcalUrl({title:"Ритм недели: вечерняя проверка", date:today, time:settings.evening, minutes:10, daily:true, details:"Отметьте сделанное, сон, энергию и настроение. Экраны выключить к "+settings.screensOff+".\n"+APP_URL});
}
$("remMorning").onchange = e => { if(e.target.value){ settings.morning = e.target.value; persistSettings(); renderReminders(); toast("Время сохранено. Добавьте напоминание в календарь заново"); } };
$("remEvening").onchange = e => { if(e.target.value){ settings.evening = e.target.value; persistSettings(); renderReminders(); toast("Время сохранено. Добавьте напоминание в календарь заново"); } };

function icsText(s){ return String(s).replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\n/g,"\\n"); }
function buildIcs(){
  const now = new Date(), dtstamp = now.toISOString().replace(/[-:]/g,"").replace(/\.\d+/,"");
  const lines = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Ritm nedeli//RU","CALSCALE:GREGORIAN","METHOD:PUBLISH"];
  const ev = (uidv, start, end, title, desc, allDay) => {
    lines.push("BEGIN:VEVENT","UID:"+uidv+"@ritm","DTSTAMP:"+dtstamp);
    if(allDay){ lines.push("DTSTART;VALUE=DATE:"+start, "DTEND;VALUE=DATE:"+end); }
    else lines.push("DTSTART:"+start, "DTEND:"+end);
    lines.push("SUMMARY:"+icsText(title));
    if(desc) lines.push("DESCRIPTION:"+icsText(desc));
    if(!allDay) lines.push("BEGIN:VALARM","ACTION:DISPLAY","DESCRIPTION:"+icsText(title),"TRIGGER:PT0M","END:VALARM");
    lines.push("END:VEVENT");
  };
  week.items.filter(i=>!i.done).forEach(it => {
    const date = addDays(weekStart, it.day), cat = (CATS[it.cat]||CATS.other).n;
    if(it.time) ev(it.id+"-"+wkey(), stamp(date,it.time), stamp(date,plusMin(it.time,30)), it.t, cat, false);
    else ev(it.id+"-"+wkey(), iso(date).replace(/-/g,""), iso(addDays(date,1)).replace(/-/g,""), it.t, cat, true);
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
function download(name, text, type){
  const blob = new Blob([text], {type}), url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
$("icsWeek").onclick = async () => {
  if(!week.items.some(i=>!i.done)){ toast("На этой неделе нет несделанных дел"); return; }
  const text = buildIcs(), name = "ritm-" + wkey() + ".ics";
  try{
    const file = new File([text], name, {type:"text/calendar"});
    if(navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({files:[file], title:"Ритм недели"}); return; }
  }catch(e){ if(e && e.name === "AbortError") return; }
  download(name, text, "text/calendar"); toast("Файл сохранён. Откройте его, чтобы добавить в календарь");
};

/* ---------- backup ---------- */
$("exportBtn").onclick = () => {
  const data = {app:"ritm", version:1, exported:new Date().toISOString(), entries:{}};
  for(const k of LS.keys()) data.entries[k] = LS.get(k);
  download("ritm-backup-" + iso(new Date()) + ".json", JSON.stringify(data), "application/json");
  toast("Копия сохранена в загрузках");
};
$("importFile").onchange = async e => {
  const f = e.target.files && e.target.files[0]; e.target.value = ""; if(!f) return;
  try{
    const data = JSON.parse(await f.text());
    if(!data || data.app !== "ritm" || !data.entries) throw new Error("bad");
    for(const [k,v] of Object.entries(data.entries)) LS.set(k, v);
    settings = loadSettings(); loadWeek(); toast("Данные восстановлены");
  }catch(err){ toast("Это не копия Ритма недели. Выберите файл ritm-backup-….json"); }
};

/* ---------- actions ---------- */
const find = id => week.items.find(i=>i.id===id);
function change(fn){ fn(); persist(); render(); }
const defaultTitle = c => ({strength:"Домашняя силовая, 20 мин", walk:"Прогулка 30–40 мин", pool:"Бассейн с ускорениями", social:"Встреча или звонок", offline:"Вечер без экранов", fun:"Что-то приятное"}[c]||"");

document.addEventListener("click", e => {
  const t = e.target.closest("button"); if(!t) return;
  if(t.dataset.tick) change(() => { const it = find(t.dataset.tick); it.done = !it.done; });
  else if(t.dataset.edit) openItem(find(t.dataset.edit));
  else if(t.dataset.add) openItem({id:null, day:+t.dataset.add, cat:"walk", t:"", time:""});
  else if(t.dataset.jump){ const el = $("day"+t.dataset.jump); if(el) el.scrollIntoView({behavior:"smooth", block:"start"}); }
  else if(t.dataset.hab) change(() => { const d = todayIdx(); week.days[d] = {...(week.days[d]||{})}; week.days[d][t.dataset.hab] = !week.days[d][t.dataset.hab]; });
  else if(t.dataset.sc) change(() => { const d = todayIdx(); week.days[d] = {...(week.days[d]||{})}; const v = +t.dataset.v; week.days[d][t.dataset.sc] = week.days[d][t.dataset.sc]===v ? null : v; });
  else if(t.dataset.fix){ const gp = lastGaps[+t.dataset.fix]; if(gp) openItem({id:null, day:gp.day, cat:gp.cat, t:defaultTitle(gp.cat), time:""}); }
  else if(t.dataset.act==="tpl") fillTemplate();
  else if(t.dataset.act==="copyPrev") copyPrev();
});
$("prev").onclick = () => { weekStart = addDays(weekStart,-7); loadWeek(); };
$("next").onclick = () => { weekStart = addDays(weekStart,7); loadWeek(); };
$("now").onclick = () => { weekStart = mondayOf(new Date()); loadWeek(); };
$("tpl").onclick = fillTemplate;
$("copyPrev").onclick = copyPrev;
$("goalsBtn").onclick = openGoals;
$("clear").onclick = () => confirmIn($("clear"), "Точно очистить?", () => change(() => { week.items = []; }));

function fillTemplate(){ change(() => { for(const [d,c,t,tm] of TEMPLATE) week.items.push({id:uid(), day:d, cat:c, t, time:tm, done:false}); }); toast("Неделя заполнена по шаблону"); }
function copyPrev(){
  const prev = LS.get("w:"+iso(addDays(weekStart,-7)));
  if(!prev || !(prev.items||[]).length){ toast("Прошлая неделя пустая"); return; }
  change(() => { for(const it of prev.items) week.items.push({id:uid(), day:it.day, cat:it.cat, t:it.t, time:it.time||"", done:false}); });
  toast("Скопировано с прошлой недели");
}
function confirmIn(btn, text, fn){
  if(btn.dataset.armed){ delete btn.dataset.armed; btn.textContent = btn.dataset.orig; fn(); return; }
  btn.dataset.orig = btn.textContent; btn.dataset.armed = "1"; btn.textContent = text;
  setTimeout(() => { if(btn.dataset.armed){ delete btn.dataset.armed; btn.textContent = btn.dataset.orig; } }, 3500);
}

/* ---------- sheets ---------- */
function openSheet(html){ $("sheetIn").innerHTML = html; $("sheet").hidden = false; $("scrim").hidden = false; }
function closeSheet(){ $("sheet").hidden = true; $("scrim").hidden = true; }
$("scrim").onclick = closeSheet;
document.addEventListener("keydown", e => { if(e.key==="Escape") closeSheet(); });

function openItem(it){
  const draft = {...it};
  const catChips = () => Object.entries(CATS).map(([k,v]) => `<button type="button" class="chip ${draft.cat===k?"on":""}" data-cat="${k}"><i style="background:var(${v.c})"></i>${v.n}</button>`).join("");
  const dayChips = () => DW.map((w,d) => `<button type="button" class="chip ${draft.day===d?"on":""}" data-day="${d}">${w}</button>`).join("");
  const calHref = () => gcalUrl({title:draft.t || CATS[draft.cat].n, date:addDays(weekStart,draft.day), time:draft.time, minutes:30, details:"Ритм недели\n"+APP_URL});
  openSheet(`<h2>${it.id ? "Изменить дело" : "Новое дело"}</h2>
    <div class="field"><label class="label" for="fT">Что делаем</label><input id="fT" type="text" value="${esc(draft.t)}" placeholder="Например, прогулка в парке" autocomplete="off"></div>
    <div class="field"><span class="label">Тип</span><div class="chips" id="fCat">${catChips()}</div></div>
    <div class="field"><span class="label">День</span><div class="chips" id="fDay">${dayChips()}</div></div>
    <div class="field"><label class="label" for="fTime">Время, если важно</label><input id="fTime" type="time" value="${esc(draft.time||"")}"></div>
    <div class="tools"><button class="btn primary" id="fSave">Сохранить</button>
      ${it.id && draft.day<6 ? `<button class="btn" id="fTomorrow">Перенести на завтра</button>`:""}
      <a class="btn" id="fCal" target="_blank" rel="noopener" href="${esc(calHref())}">В Google Календарь</a>
      ${it.id ? `<button class="btn danger" id="fDel">Удалить</button>`:""}
      <button class="btn" id="fCancel">Отмена</button></div>`);
  const sync = () => { $("fCat").innerHTML = catChips(); $("fDay").innerHTML = dayChips(); $("fCal").href = calHref(); };
  $("fT").oninput = () => { draft.t = $("fT").value; $("fCal").href = calHref(); };
  $("fTime").oninput = () => { draft.time = $("fTime").value; $("fCal").href = calHref(); };
  $("fCat").onclick = e => { const b = e.target.closest("[data-cat]"); if(!b) return; const wasDefault = !draft.t || draft.t===defaultTitle(draft.cat); draft.cat = b.dataset.cat; if(wasDefault && !it.id){ draft.t = defaultTitle(draft.cat); $("fT").value = draft.t; } sync(); };
  $("fDay").onclick = e => { const b = e.target.closest("[data-day]"); if(!b) return; draft.day = +b.dataset.day; sync(); };
  $("fCancel").onclick = closeSheet;
  $("fSave").onclick = () => {
    draft.t = $("fT").value.trim() || CATS[draft.cat].n; draft.time = $("fTime").value || "";
    change(() => { if(it.id) Object.assign(find(it.id), {t:draft.t, cat:draft.cat, day:draft.day, time:draft.time}); else week.items.push({id:uid(), t:draft.t, cat:draft.cat, day:draft.day, time:draft.time, done:false}); });
    closeSheet(); toast(it.id ? "Сохранено" : "Добавлено на " + DW[draft.day].toLowerCase());
  };
  if($("fTomorrow")) $("fTomorrow").onclick = () => { change(() => { find(it.id).day = it.day+1; }); closeSheet(); toast("Перенесено на " + DW[it.day+1].toLowerCase()); };
  if($("fDel")) $("fDel").onclick = () => confirmIn($("fDel"), "Точно удалить?", () => { change(() => { week.items = week.items.filter(i=>i.id!==it.id); }); closeSheet(); toast("Удалено"); });
  if(!it.id) setTimeout(() => $("fT").focus(), 50);
}

function openGoals(){
  const draft = {...settings.goals};
  const rows = () => GOAL_CATS.map(c => `<div class="goalrow"><span style="display:flex;align-items:center;gap:8px"><i style="width:10px;height:10px;border-radius:50%;background:var(${CATS[c].c})"></i>${CATS[c].n}</span>
    <span class="stepper"><button data-g="${c}" data-d="-1" aria-label="Меньше">−</button><span class="num" style="min-width:1.5em;text-align:center">${draft[c]}</span><button data-g="${c}" data-d="1" aria-label="Больше">+</button></span></div>`).join("");
  openSheet(`<h2>Цели на неделю</h2><p class="note">Сколько раз в неделю хотите это делать. По этим числам считается, чего не хватает.</p>
    <div id="gRows">${rows()}</div>
    <div class="field"><label class="label" for="gOff">Экраны выключаю в</label><input id="gOff" type="time" value="${settings.screensOff}"></div>
    <div class="tools"><button class="btn primary" id="gSave">Сохранить</button><button class="btn" id="gCancel">Отмена</button></div>`);
  $("gRows").onclick = e => { const b = e.target.closest("[data-g]"); if(!b) return; const c = b.dataset.g; draft[c] = Math.max(0, Math.min(7, draft[c] + +b.dataset.d)); $("gRows").innerHTML = rows(); };
  $("gCancel").onclick = closeSheet;
  $("gSave").onclick = () => { settings = {...settings, goals:draft, screensOff:$("gOff").value || "22:30"}; persistSettings(); closeSheet(); render(); toast("Цели сохранены"); };
}

let toastT = null;
function toast(msg){ const el = $("toast"); el.textContent = msg; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, 2800); }

/* ---------- install & offline ---------- */
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredPrompt = e; $("installBtn").hidden = false; });
$("installBtn").onclick = async () => { if(!deferredPrompt) return; deferredPrompt.prompt(); try{ await deferredPrompt.userChoice; }catch(e){} deferredPrompt = null; $("installBtn").hidden = true; };
window.addEventListener("appinstalled", () => { $("installBtn").hidden = true; toast("Ритм недели на главном экране"); });
if("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));

document.addEventListener("visibilitychange", () => { if(!document.hidden) loadWeek(); });
loadWeek();
})();
