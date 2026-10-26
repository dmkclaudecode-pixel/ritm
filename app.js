(() => {
"use strict";
const CATS = {
  strength:{n:"Силовая", g:"силовой", c:"--c-strength", move:true},
  walk:{n:"Прогулка", g:"прогулки", c:"--c-walk", move:true},
  pool:{n:"Бассейн", g:"бассейна", c:"--c-pool", move:true},
  social:{n:"Общение", g:"живого общения", c:"--c-social"},
  offline:{n:"Без экранов", g:"вечера без экранов", c:"--c-offline"},
  fun:{n:"Удовольствие", g:"чего-то просто для удовольствия", c:"--c-fun"},
  games:{n:"Ютуб и игры", c:"--c-games"},
  other:{n:"Другое", c:"--c-other"}
};
const GOAL_CATS = ["strength","walk","pool","social","offline","fun"];
const DEFAULT_SETTINGS = {goals:{strength:2,walk:4,pool:1,social:2,offline:1,fun:2}, screensOff:"22:30", morning:"08:45", evening:"19:45", stepsGoal:7000, notify:false, bedtime:"23:30", reviewOn:true};
const DW = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
const DFULL = ["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота","Воскресенье"];
const DACC = ["в понедельник","во вторник","в среду","в четверг","в пятницу","в субботу","в воскресенье"];
const MON = ["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"];
const MONG = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
const TEMPLATE = [
  [0,"strength","Домашняя силовая, 20 мин","19:00"],[0,"games","Ютуб или игры","21:00"],
  [1,"walk","Быстрая прогулка 30–40 мин","18:30"],[1,"social","Звонок или встреча с близким",""],
  [2,"walk","Прогулка или растяжка 15 мин",""],[2,"offline","Вечер без экранов","21:00"],
  [3,"strength","Домашняя силовая, 20 мин","19:00"],[3,"games","Ютуб или игры","21:00"],
  [4,"walk","Прогулка 30–40 мин",""],[4,"fun","Что-то приятное: кино, кафе, друзья",""],[4,"games","Игровой вечер","21:00"],
  [5,"pool","Бассейн с ускорениями","11:00"],[5,"fun","Новое место или занятие",""],
  [6,"walk","Длинная прогулка на природе","12:00"],[6,"fun","Отдых и план на неделю","19:00"]
];
const IDEAS = window.RITM_IDEAS || [];

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid = () => Math.random().toString(36).slice(2,10);
const pad = n => String(n).padStart(2,"0");
const iso = d => d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
function mondayOf(d){ const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate()-((x.getDay()+6)%7)); return x; }
function addDays(d,n){ const x = new Date(d); x.setDate(x.getDate()+n); return x; }
const plural = (n, a, b, c) => { const m10 = n%10, m100 = n%100; return m10===1 && m100!==11 ? a : (m10>=2 && m10<=4 && (m100<12 || m100>14) ? b : c); };
const nowHM = () => { const d = new Date(); return pad(d.getHours())+":"+pad(d.getMinutes()); };

/* ---------- storage (this device only) ---------- */
const LS = {
  get(k){ try{ const v = localStorage.getItem("ritm:"+k); return v ? JSON.parse(v) : null; }catch(e){ return null; } },
  set(k,v){ try{ localStorage.setItem("ritm:"+k, JSON.stringify(v)); return true; }catch(e){ toast("Не удалось сохранить: память браузера недоступна"); return false; } },
  keys(){ const out = []; try{ for(let i=0;i<localStorage.length;i++){ const k = localStorage.key(i); if(k && k.startsWith("ritm:")) out.push(k.slice(5)); } }catch(e){} return out; }
};
try{ if(navigator.storage && navigator.storage.persist) navigator.storage.persist(); }catch(e){}
function getWeek(key){ const w = LS.get("w:"+key); return w ? {items:w.items||[], days:w.days||{}} : {items:[], days:{}}; }
function saveWeek(key, w){ LS.set("w:"+key, {items:w.items, days:w.days, week:key, updated:new Date().toISOString()}); }
function loadSettings(){ const s = LS.get("settings") || {}; return {...DEFAULT_SETTINGS, ...s, goals:{...DEFAULT_SETTINGS.goals, ...(s.goals||{})}}; }
let settings = loadSettings();
const persistSettings = () => LS.set("settings", settings);

/* ---------- phone data: steps & sleep (Android app only) ---------- */
const NATIVE = window.RitmNative || null;
let health = LS.get("health") || {steps:{}, sleep:{}};
const fmtDur = m => `${Math.floor(m/60)} ч ${pad(m%60)} мин`;
const fmtNum = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
const dateOf = (key, d) => iso(addDays(new Date(key+"T00:00:00"), d));
const sleepFor = ds => (health.sleep && health.sleep[ds]) || null;
const stepsFor = ds => (health.steps && health.steps[ds] != null) ? health.steps[ds] : null;
function bedMin(hm){ const [h,m] = hm.split(":").map(Number); let t = h*60+m; if(t < 12*60) t += 24*60; return t; }
function sleepRegular(ds){
  const s = sleepFor(ds); if(!s) return null;
  const prev = []; for(let i=1;i<=7;i++){ const o = sleepFor(iso(addDays(new Date(ds+"T00:00:00"),-i))); if(o) prev.push(bedMin(o.start)); }
  if(s.min < 390) return false;
  if(prev.length < 3) return true;
  prev.sort((a,b)=>a-b); return Math.abs(bedMin(s.start) - prev[Math.floor(prev.length/2)]) <= 60;
}
function sleepOk(w, key, d){ const h = w.days[d]||{}; if(typeof h.sleep === "boolean") return h.sleep; return sleepRegular(dateOf(key,d)) === true; }

const curKey = () => iso(mondayOf(new Date()));
const todayI = () => (new Date().getDay()+6)%7;
if(!LS.get("started")){
  const k = curKey();
  if(!LS.get("w:"+k)) saveWeek(k, {items:TEMPLATE.map(([d,c,t,tm]) => ({id:uid(), day:d, cat:c, t, time:tm, done:false})), days:{}});
  LS.set("started", true); persistSettings();
}

/* ---------- view state ---------- */
let tab = "today";
let weekStart = mondayOf(new Date());
const viewKey = () => iso(weekStart);
function relIdx(key){ const ck = curKey(); return key === ck ? todayI() : (key < ck ? 7 : -1); } // index of "today" inside a week

/* ---------- analysis ---------- */
function goalState(w, ti){
  const out = {};
  for(const c of GOAL_CATS){
    const goal = settings.goals[c]||0; let done=0, future=0, missed=0, plan=0;
    for(const it of w.items){ if(it.cat!==c) continue; plan++; if(it.done) done++; else if(it.day >= ti) future++; else missed++; }
    out[c] = {goal, done, future, missed, plan, deficit: Math.max(0, goal - done - future)};
  }
  return out;
}
function daysSinceDone(cat){
  const ck = curKey(), ti = todayI(), cw = getWeek(ck), pw = getWeek(iso(addDays(mondayOf(new Date()),-7)));
  let best = 99;
  for(const it of cw.items) if(it.cat===cat && it.done && it.day<=ti) best = Math.min(best, ti - it.day);
  for(const it of pw.items) if(it.cat===cat && it.done) best = Math.min(best, ti + 7 - it.day);
  return best;
}
function recentTitles(){
  const s = new Set(), m = mondayOf(new Date());
  for(const k of [iso(m), iso(addDays(m,-7))]) for(const it of getWeek(k).items) s.add(it.t);
  return s;
}
function hash(str){ let h = 2166136261; for(let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h>>>0; }
function shuffled(arr, seed){ const a = arr.slice(); let s = seed||1; for(let i=a.length-1;i>0;i--){ s = (Math.imul(s,1103515245)+12345)>>>0; const j = s % (i+1); [a[i],a[j]] = [a[j],a[i]]; } return a; }
function ideaFits(idea, day, hour){
  const weekend = day >= 5;
  if(idea.when === "weekend" && !weekend) return false;
  if(hour != null){
    if(idea.when === "day" && hour >= 17) return false;
    if(idea.cat === "pool" && hour >= 20) return false;
    if(idea.when === "evening" && idea.time && hour > +idea.time.slice(0,2)+2) return false;
  }
  return true;
}
function ideasFor(cat, day, hour, offset, recent){
  const pool = IDEAS.filter(i => i.cat===cat && ideaFits(i, day, hour));
  const fresh = pool.filter(i => !recent.has(i.t));
  const list = shuffled(fresh.length ? fresh : pool, hash(curKey()+cat+day));
  return list.length ? list[offset % list.length] : null;
}

/* suggestions for today */
const offsets = {};
let dismissed = new Set();
function suggestionsToday(){
  const ck = curKey(), ti = todayI(), w = getWeek(ck), gs = goalState(w, ti), hour = new Date().getHours();
  const recent = recentTitles(), out = [];
  const h = w.days[ti] || {};
  if(hour < 15 && !h.light && !dismissed.has("light")) out.push({kind:"light"});
  const tds = dateOf(ck, ti), stepsNow = stepsFor(tds), lastSleep = sleepFor(tds), goalSteps = settings.stepsGoal;
  const shortSleep = !!(lastSleep && lastSleep.min < 360), lowSteps = stepsNow != null && hour >= 14 && stepsNow < goalSteps*0.5;
  if(shortSleep && hour >= 17 && !dismissed.has("early") && !w.items.some(i=>i.day===ti && i.t.startsWith("Лечь пораньше"))) out.push({kind:"early"});
  const cands = GOAL_CATS.filter(c => settings.goals[c] > 0).map(c => {
    const g = gs[c], since = daysSinceDone(c), today = w.items.some(i => i.day===ti && i.cat===c);
    let score = g.deficit*10 + Math.min(since,10) - (today?40:0), whyOver = null;
    if(c === "pool" && g.deficit === 0) score -= 6;
    if(shortSleep && (c === "strength" || c === "pool")) score -= 15;
    if(c === "walk" && lowSteps){ score += 14; whyOver = `Сегодня пока ${fmtNum(stepsNow)} шагов из ${fmtNum(goalSteps)}`; }
    else if(c === "walk" && shortSleep){ score += 4; whyOver = `Сон был ${fmtDur(lastSleep.min)}: сегодня лучше лёгкая прогулка, чем силовая`; }
    return {c, g, since, today, score, whyOver};
  }).filter(x => !dismissed.has(x.c)).sort((a,b) => b.score - a.score);
  for(const x of cands){
    if(out.length >= 3) break;
    if(x.score <= 0 && out.length >= 1) continue;
    const idea = ideasFor(x.c, ti, hour, offsets[x.c]||0, recent);
    if(!idea) continue;
    let why;
    if(x.whyOver) why = x.whyOver;
    else if(x.g.deficit > 0) why = `До цели недели не хватает ${x.g.deficit} ${plural(x.g.deficit,"раза","раз","раз")}: ${CATS[x.c].n.toLowerCase()} ${x.g.done}/${x.g.goal}`;
    else if(x.since >= 3 && x.since < 99) why = `Уже ${x.since} ${plural(x.since,"день","дня","дней")} без ${CATS[x.c].g}`;
    else if(x.since === 99) why = `Давно не было ${CATS[x.c].g}`;
    else why = "Для разнообразия: что-то новое";
    out.push({kind:"idea", cat:x.c, idea, why});
  }
  return out;
}

/* auto-fill missing items into a week */
function autoFill(key){
  const w = getWeek(key), ti = Math.max(0, relIdx(key));
  if(relIdx(key) === 7){ toast("Эта неделя уже прошла"); return 0; }
  const gs = goalState(w, ti), recent = recentTitles(), added = [];
  const load = Array(7).fill(0); w.items.forEach(i => load[i.day]++);
  for(const c of GOAL_CATS){
    let need = gs[c].deficit;
    let off = 0;
    while(need > 0){
      let best = -1, bl = 99;
      for(let d = ti; d < 7; d++){
        if(w.items.some(i => i.day===d && i.cat===c)) continue;
        let l = load[d] + (c==="pool" && d<5 ? 2 : 0) + (d===ti && new Date().getHours()>=20 ? 5 : 0) + (w.items.some(i => i.cat===c && Math.abs(i.day-d)===1) ? 2 : 0);
        if(l < bl){ bl = l; best = d; }
      }
      if(best < 0) break;
      const idea = ideasFor(c, best, null, off++, recent) || {t:CATS[c].n, time:""};
      recent.add(idea.t);
      w.items.push({id:uid(), day:best, cat:c, t:idea.t, time:idea.time||"", done:false});
      load[best]++; added.push(idea.t); need--;
    }
  }
  if(added.length) saveWeek(key, w);
  return added.length;
}

/* ---------- rendering ---------- */
function itemRow(it){
  const cat = CATS[it.cat]||CATS.other, late = it.cat==="games" && it.time && it.time >= settings.screensOff;
  return `<div class="item ${it.done?"done":""}"><span class="stripe" style="background:var(${cat.c})"></span>
    <button class="tick" data-tick="${it.id}" aria-label="${it.done?"Снять отметку":"Отметить сделанным"}"><span></span></button>
    <button class="body" data-edit="${it.id}"><span class="t">${esc(it.t)}</span><span class="meta"><span>${cat.n}</span>${it.time?`<span class="num ${late?"late":""}">${it.time}</span>`:""}${late?`<span class="late">поздно для экрана</span>`:""}</span></button></div>`;
}

function renderToday(){
  const ck = curKey(), ti = todayI(), w = getWeek(ck), d = new Date();
  $("subtitle").textContent = `${DFULL[ti]}, ${d.getDate()} ${MONG[d.getMonth()]}`;
  const its = w.items.filter(i => i.day===ti).sort((a,b) => (a.time||"99").localeCompare(b.time||"99"));
  const done = its.filter(i=>i.done).length, total = its.length, frac = total ? done/total : 0;
  const next = its.find(i => !i.done && i.time && i.time >= nowHM()) || its.find(i => !i.done);
  let msg;
  if(!total) msg = "На сегодня ничего не запланировано. Возьмите что-нибудь из советов ниже.";
  else if(done === total) msg = "Всё на сегодня сделано. Отличный день!";
  else msg = `Осталось ${total-done} ${plural(total-done,"дело","дела","дел")}. Дальше: ${esc(next.t)}${next.time?" в "+next.time:""}.`;
  const C = 2*Math.PI*30;
  $("todayHero").innerHTML = `<div class="ring"><svg viewBox="0 0 72 72"><circle cx="36" cy="36" r="30" fill="none" stroke="var(--line)" stroke-width="7"/><circle cx="36" cy="36" r="30" fill="none" stroke="var(--accent)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C*(1-frac)}"/></svg><span class="rv">${done}/${total}</span></div><div class="ht"><span class="big">${msg}</span><span class="note">Нажмите на кружок, когда сделаете дело</span></div>`;
  renderBody(ck, ti);
  const rvDone = !!((w.days[ti]||{}).review||{}).done, hr = new Date().getHours();
  $("reviewCta").hidden = !(hr >= 17 || rvDone);
  $("reviewCta").innerHTML = rvDone
    ? `<h2>Разбор дня готов</h2><p class="note">Можно посмотреть советы и правки плана ещё раз.</p><button class="btn" data-openreview="1">Открыть разбор</button>`
    : `<h2>Подведите итоги дня</h2><p class="note">Две минуты: что и сколько делали. Взамен — разбор, советы и поправки плана на следующие дни.</p><button class="btn primary" data-openreview="1">Разобрать день</button>`;
  $("todayItems").innerHTML = its.map(itemRow).join("") + `<button class="add" data-add="${ti}" data-week="${ck}">+ Своё дело на сегодня</button>`;

  const sg = suggestionsToday();
  $("suggWhy").textContent = sg.length ? "по вашим целям" : "";
  $("suggs").innerHTML = sg.length ? sg.map((s,i) => {
    if(s.kind === "early") return `<div class="sugg" style="--cc:var(--c-offline)"><div class="sh"><span class="st">Лечь сегодня пораньше</span><span class="pill">сон</span></div>
      <span class="why">Прошлой ночью сон был ${fmtDur(sleepFor(dateOf(ck,ti)).min)}. Отбой к ${settings.screensOff} без экрана поможет восстановиться</span>
      <div class="sa"><button class="btn primary" data-early="1">Добавить на вечер</button><button class="btn" data-dismiss="early">Не сегодня</button></div></div>`;
    if(s.kind === "light") return `<div class="sugg" style="--cc:var(--sun)"><div class="sh"><span class="st">15 минут дневного света</span><span class="pill">привычка</span></div>
      <span class="why">Свет до обеда помогает бодрости днём и сну ночью</span>
      <div class="sa"><button class="btn primary" data-light="1">Сделал</button><button class="btn" data-dismiss="light">Не сегодня</button></div></div>`;
    const c = CATS[s.cat];
    return `<div class="sugg" style="--cc:var(${c.c})"><div class="sh"><span class="st">${esc(s.idea.t)}</span><span class="pill">${c.n} · ${s.idea.min} мин</span></div>
      <span class="sm">${esc(s.idea.note||"")}</span>
      <span class="why">${s.why}</span>
      <div class="sa"><button class="btn primary" data-sadd="${i}">Добавить на сегодня</button><button class="btn" data-splan="${i}">На другой день</button><button class="btn" data-snext="${s.cat}">Другая идея</button></div></div>`;
  }).join("") : `<div class="sugg"><span class="st">Цели недели в плане</span><span class="sm">Всё, что нужно, уже запланировано. Можно просто следовать плану.</span></div>`;
  lastSugg = sg;

  const h = w.days[ti]||{};
  $("checkin").innerHTML = `<div class="bhead"><h2>Как прошёл день?</h2><span class="note">лучше вечером</span></div>
    <div class="check">
      <button class="tog ${sleepOk(w,ck,ti)?"on":""}" data-hab="sleep"><span class="box"></span>Спал по режиму</button>
      <button class="tog ${h.light?"on":""}" data-hab="light"><span class="box"></span>Был на дневном свету</button>
    </div>
    <div class="scale"><span class="label">Энергия</span><div class="row">${[1,2,3,4,5].map(n=>`<button class="${h.energy===n?"on":""}" data-sc="energy" data-v="${n}">${n}</button>`).join("")}</div></div>
    <div class="scale"><span class="label">Настроение</span><div class="row">${[1,2,3,4,5].map(n=>`<button class="${h.mood===n?"on":""}" data-sc="mood" data-v="${n}">${n}</button>`).join("")}</div></div>
    <p class="note">Из этих отметок приложение поймёт, что вам реально помогает. Результат во вкладке «Итоги».</p>`;
}
let lastSugg = [];

function renderBody(ck, ti){
  const card = $("bodyCard");
  if(!NATIVE){ card.hidden = true; return; }
  card.hidden = false;
  const ds = dateOf(ck, ti), st = stepsFor(ds), sl = sleepFor(ds), goal = settings.stepsGoal;
  const connected = health.stepsGranted || health.sleepGranted || health.usage;
  if(!connected){
    card.innerHTML = `<h2>Шаги и сон</h2><p class="note">Подключите данные телефона, и приложение само будет видеть шаги и когда вы спите, а советы станут точнее.</p>
      <div class="tools"><button class="btn primary" data-native="health">Подключить Health Connect</button><button class="btn" data-native="usage">Сон по экрану телефона</button></div>`;
    return;
  }
  const stepsHtml = st != null
    ? `<span class="mv">${fmtNum(st)}</span><span class="mk">шагов из ${fmtNum(goal)}</span><div class="bar"><div class="dn" style="width:${Math.min(100, st/goal*100)}%;background:var(--c-walk)"></div></div>`
    : `<span class="mv">—</span><span class="mk">${health.stepsGranted ? "шагов пока нет" : "шаги не подключены"}</span>`;
  const sleepHtml = sl
    ? `<span class="mv">${fmtDur(sl.min)}</span><span class="mk">сон ${sl.start}–${sl.end}</span><span class="src">${sl.src==="hc" ? "из Health Connect" : "примерно, по экрану телефона"}</span>`
    : `<span class="mv">—</span><span class="mk">${health.sleepGranted || health.usage ? "сон за ночь не найден" : "сон не подключён"}</span>`;
  card.innerHTML = `<div class="bhead"><h2>Шаги и сон</h2><button class="btn" data-native="refresh" style="padding:5px 10px;font-size:.8rem">Обновить</button></div><div class="metrics"><div class="metric">${stepsHtml}</div><div class="metric">${sleepHtml}</div></div>`;
}

function renderHealthCard(){
  const card = $("healthCard");
  if(!NATIVE){ card.hidden = true; return; }
  card.hidden = false;
  let st = {}; try{ st = JSON.parse(NATIVE.status()); }catch(e){}
  const hcLine = st.health === "unavailable" ? `<span class="note">Health Connect недоступен на этом телефоне</span>`
    : (health.stepsGranted && health.sleepGranted) ? `<span class="ok">подключено</span>`
    : `<button class="btn" data-native="health">${st.health === "update" ? "Установить Health Connect" : "Подключить"}</button>`;
  card.innerHTML = `<h2>Шаги и сон</h2>
    <p class="note">Шаги и сон приходят из Health Connect: туда их пишут Google Fit, Samsung Health, часы и трекеры сна. Если трекера сна нет, приложение примерно определит сон по тому, когда вы перестаёте и начинаете пользоваться телефоном.</p>
    <div class="status"><span class="rl"><b>Health Connect</b><span class="note">шаги и сон</span></span>${hcLine}</div>
    <div class="status"><span class="rl"><b>Сон по экрану телефона</b><span class="note">если нет трекера сна</span></span>${health.usage ? `<span class="ok">включено</span>` : `<button class="btn" data-native="usage">Разрешить</button>`}</div>
    <div class="field"><span class="label">Цель по шагам в день</span><div class="stepper"><button data-steps="-1000" aria-label="Меньше">−</button><span class="num" style="min-width:4em;text-align:center">${fmtNum(settings.stepsGoal)}</span><button data-steps="1000" aria-label="Больше">+</button></div></div>`;
}

function buildSnapshot(){
  const ck = curKey(), w = getWeek(ck), days = {};
  for(let d=0; d<7; d++){
    const its = w.items.filter(i=>i.day===d).sort((a,b)=>(a.time||"99").localeCompare(b.time||"99"));
    const undone = its.filter(i=>!i.done);
    const gs = goalState(w, d), miss = GOAL_CATS.filter(c=>gs[c].deficit>0).map(c=>CATS[c].n.toLowerCase()+" ×"+gs[c].deficit);
    const list = its.slice(0,4).map(i=>(i.time? i.time+" ":"")+i.t).join("; ");
    days[dateOf(ck,d)] = {
      morning: its.length ? {title:`Сегодня ${its.length} ${plural(its.length,"дело","дела","дел")}`, text: list + (its.length>4 ? " и ещё "+(its.length-4) : "") + ". И 15 минут дневного света до обеда."}
                          : {title:"Сегодня свободный день", text:"Откройте Ритм недели: приложение подберёт, чем заняться."},
      review: {title:"Пора подвести итоги дня", text:`Сделано ${its.filter(i=>i.done).length} из ${its.length}. Две минуты на разбор — и план на завтра под ваш день.`},
      evening: {title: undone.length ? `Осталось ${undone.length} ${plural(undone.length,"дело","дела","дел")}` : "Как прошёл день?",
                text: (undone.length ? "Не отмечено: "+undone.slice(0,3).map(i=>i.t).join("; ")+". " : "") + "Отметьте сон, энергию и настроение." + (miss.length ? " До целей недели: "+miss.join(", ")+"." : "") + " Экраны выключить к "+settings.screensOff+"."}
    };
  }
  return {days};
}
let lastSnap = "", lastReviewSync = "";
function syncNative(){
  if(!NATIVE) return;
  const s = JSON.stringify(buildSnapshot());
  if(s !== lastSnap){ lastSnap = s; try{ NATIVE.saveSnapshot(s); }catch(e){} }
  const rt = (settings.notify && settings.reviewOn ? "on " : "off ") + reviewTime();
  if(rt !== lastReviewSync){ lastReviewSync = rt; try{ NATIVE.setReview(reviewTime(), !!(settings.notify && settings.reviewOn)); }catch(e){} }
}

function renderWeek(){
  const key = viewKey(), w = getWeek(key), ws = weekStart, we = addDays(ws,6), ti = relIdx(key);
  $("subtitle").textContent = "Планируйте и переносите дела";
  $("range").textContent = `${ws.getDate()} ${MON[ws.getMonth()]} – ${we.getDate()} ${MON[we.getMonth()]}` + (ti>=0 && ti<=6 ? " · эта неделя" : "");
  $("strip").innerHTML = DW.map((dw,d) => {
    const dots = w.items.filter(i=>i.day===d).slice(0,5).map(i=>`<i class="${i.done?"on":""}"></i>`).join("");
    return `<button class="dchip ${d===ti?"today":""}" data-jump="${d}" aria-label="${DFULL[d]}"><span class="dw">${dw}</span><span class="dn">${addDays(ws,d).getDate()}</span><span class="dots">${dots}</span></button>`;
  }).join("");
  const gs = goalState(w, Math.max(0, ti)), missing = GOAL_CATS.filter(c => gs[c].deficit > 0);
  let gh;
  if(ti === 7) gh = `<h2>Неделя прошла</h2><p class="note">Итоги этой недели — во вкладке «Итоги», когда она текущая. Можно скопировать её план на новую неделю во вкладке «Ещё».</p>`;
  else if(!w.items.length) gh = `<h2>Неделя пустая</h2><p class="note">Приложение может само составить план по вашим целям, с разными занятиями.</p><div class="tools"><button class="btn primary" data-autofill="1">Составить план за меня</button><button class="btn" data-act="tpl">По шаблону</button></div>`;
  else if(missing.length) gh = `<h2>Не хватает до целей</h2><p class="note">${missing.map(c => `${CATS[c].n.toLowerCase()} ×${gs[c].deficit}`).join(", ")}</p><div class="tools"><button class="btn primary" data-autofill="1">Добавить недостающее</button></div><p class="note">Приложение раскидает занятия по самым свободным дням и подберёт разные идеи.</p>`;
  else gh = `<h2>Все цели в плане</h2><p class="note">Если что-то не получится, перенесите дело: нажмите на него и выберите другой день.</p>`;
  $("weekGaps").innerHTML = gh;
  $("days").innerHTML = DFULL.map((name,d) => {
    const date = addDays(ws,d), its = w.items.filter(i=>i.day===d).sort((x,y)=>(x.time||"99").localeCompare(y.time||"99"));
    return `<div class="day" id="day${d}"><div class="dayhead ${d===ti?"istoday":""}"><h2>${name}</h2><span class="when num">${date.getDate()} ${MON[date.getMonth()]}</span></div>
      <div class="items">${its.map(itemRow).join("") || `<div class="empty">Свободный день</div>`}<button class="add" data-add="${d}" data-week="${key}">+ Добавить</button></div></div>`;
  }).join("");
}

function renderStats(){
  const ck = curKey(), ti = todayI(), w = getWeek(ck), gs = goalState(w, ti), pw = getWeek(iso(addDays(mondayOf(new Date()),-7)));
  $("subtitle").textContent = "Эта неделя";
  $("goalsCard").innerHTML = `<div class="bhead"><h2>Цели недели</h2><span class="note num">${w.items.filter(i=>i.done).length} сделано</span></div><div class="goals">` + GOAL_CATS.filter(c=>settings.goals[c]).map(c => {
    const g = gs[c], col = `var(${CATS[c].c})`;
    return `<div class="goal"><div class="gh"><span>${CATS[c].n}</span><span class="num">${g.done}/${g.goal}</span></div><div class="bar"><div class="pl" style="width:${Math.min(100,g.plan/g.goal*100)}%;background:${col}"></div><div class="dn" style="width:${Math.min(100,g.done/g.goal*100)}%;background:${col}"></div></div></div>`;
  }).join("") + `</div><p class="note">Яркая часть полосы — сделано, бледная — запланировано.</p>`;

  const ins = [];
  const missing = GOAL_CATS.filter(c => gs[c].deficit > 0);
  if(missing.length) ins.push(["warn", `Не хватает до целей: ${missing.map(c => `${CATS[c].n.toLowerCase()} ×${gs[c].deficit}`).join(", ")}. Во вкладке «Неделя» можно добавить это одной кнопкой.`]);
  const missed = GOAL_CATS.reduce((s,c)=>s+gs[c].missed,0);
  if(missed) ins.push(["sun", `Пропущено ${missed} ${plural(missed,"дело","дела","дел")}. Не страшно: переносите их на свободные дни, а не отменяйте.`]);
  const elapsed = ti+1; let sleep=0, light=0; const eM=[], eR=[], mood=[];
  for(let d=0; d<=ti; d++){
    const h = w.days[d]||{}; if(sleepOk(w, ck, d)) sleep++; if(h.light) light++; if(h.mood) mood.push(h.mood);
    if(h.energy){ (w.items.some(i=>i.day===d && i.done && CATS[i.cat] && CATS[i.cat].move) ? eM : eR).push(h.energy); }
  }
  const okN = Math.max(1, elapsed-1);
  if(!sleep && !light && elapsed <= 1) ins.push(["sun", "Сегодня вечером отметьте сон и дневной свет во вкладке «Сегодня». Здесь появится, сколько дней вы держали режим."]);
  else {
    ins.push([sleep >= okN ? "ok" : "warn", `Режим сна: ${sleep} из ${elapsed} ${plural(elapsed,"дня","дней","дней")}. ${sleep >= okN ? "Так держать, это основа бодрости." : "Попробуйте ложиться в одно время хотя бы 3 дня подряд."}`]);
    ins.push([light >= okN ? "ok" : "sun", `Дневной свет: ${light} из ${elapsed}. ${light >= okN ? "Отлично." : "Хватит 15 минут на улице до обеда."}`]);
  }
  const avg = a => a.reduce((x,y)=>x+y,0)/a.length;
  if(NATIVE || Object.keys(health.steps||{}).length){
    const sd = [], sl = [], eGood = [], eBad = [];
    for(let d=0; d<=ti; d++){
      const ds = dateOf(ck,d), st = stepsFor(ds), sp = sleepFor(ds), h = w.days[d]||{};
      if(st != null && d < ti) sd.push(st);
      if(sp){ sl.push(sp); if(h.energy) (sp.min >= 420 ? eGood : eBad).push(h.energy); }
    }
    if(sd.length) { const a = avg(sd); ins.push([a >= settings.stepsGoal ? "ok" : "sun", `Шагов в среднем ${fmtNum(a)} в день при цели ${fmtNum(settings.stepsGoal)}.` + (a < settings.stepsGoal ? " Добавьте прогулку после ужина: это плюс 1 500–2 000 шагов." : "")]); }
    if(sl.length >= 2){
      const am = avg(sl.map(x=>x.min)), starts = sl.map(x=>bedMin(x.start)), spread = Math.max(...starts) - Math.min(...starts);
      ins.push([am >= 420 ? "ok" : "warn", `Сон в среднем ${fmtDur(Math.round(am))}.` + (am < 420 ? " Взрослым обычно нужно 7–9 часов." : "") + (spread > 90 ? ` Время засыпания гуляет на ${Math.round(spread/6)/10} ч; ровный отбой помогает легче вставать.` : " Время отбоя стабильное.")]);
    }
    if(eGood.length >= 2 && eBad.length >= 2){ const df = avg(eGood) - avg(eBad); if(df > 0.2) ins.push(["ok", `После ночей от 7 часов энергия выше в среднем на ${df.toFixed(1)} балла.`]); }
  }
  if(eM.length >= 2 && eR.length >= 2){
    const diff = avg(eM) - avg(eR);
    ins.push([diff > 0 ? "ok" : "sun", diff > 0.2 ? `В дни с движением энергия выше в среднем на ${diff.toFixed(1)} балла. Движение вам реально помогает.` : `Пока разницы в энергии между днями с движением и без почти нет. Продолжайте отмечать, картина станет точнее.`]);
  } else ins.push(["sun", "Отмечайте энергию каждый вечер во вкладке «Сегодня». Через неделю здесь появится, как движение влияет на ваше самочувствие."]);
  if(mood.length >= 3) ins.push(["ok", `Среднее настроение за неделю: ${avg(mood).toFixed(1)} из 5.`]);
  const doneNow = w.items.filter(i=>i.done && i.day<=ti).length, donePrev = pw.items.filter(i=>i.done && i.day<=ti).length;
  if(pw.items.length) ins.push(["ok", `К этому дню на прошлой неделе было сделано ${donePrev}, сейчас ${doneNow}.`]);
  const games = w.items.filter(i=>i.cat==="games"), late = games.filter(i=>i.time && i.time >= settings.screensOff);
  if(late.length) ins.push(["warn", `Игры после ${settings.screensOff} стоят ${late.length} ${plural(late.length,"раз","раза","раз")}. Это мешает заснуть; лучше сдвинуть раньше.`]);
  $("insights").innerHTML = `<h2>Что видно по неделе</h2>` + ins.map(([k,t]) => `<div class="insight"><span class="dot ${k==="warn"?"warn":k==="sun"?"sun":""}"></span><span>${t}</span></div>`).join("");
}

function renderMore(){
  $("subtitle").textContent = "Цели, уведомления, копия";
  renderReminders(); renderHealthCard();
  $("nativeRem").hidden = !NATIVE; $("remCard").hidden = !!NATIVE;
  if(NATIVE){ $("nMorning").value = settings.morning; $("nEvening").value = settings.evening; $("nToggle").textContent = settings.notify ? "Выключить уведомления" : "Включить уведомления"; $("nToggle").classList.toggle("primary", !settings.notify); $("nTest").hidden = !settings.notify; $("nTestReview").hidden = !settings.notify;
    const ub = usualBedtime(); $("nBed").value = settings.bedtime;
    $("nReviewToggle").textContent = settings.reviewOn ? "Включён" : "Выключен"; $("nReviewToggle").classList.toggle("primary", !!settings.reviewOn);
    $("nReviewNote").textContent = `В ${reviewTime()}, за 30 минут до ${ub.auto ? "вашего обычного отбоя по данным сна ("+ub.hm+")" : "отбоя в "+ub.hm}`; }
}

const TITLES = {today:"Сегодня", review:"Разбор дня", week:"Неделя", stats:"Итоги", more:"Ещё"};
function render(){
  for(const t of Object.keys(TITLES)) $("tab-"+t).hidden = t !== tab;
  document.querySelectorAll("#tabbar button").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
  $("title").textContent = TITLES[tab];
  if(tab==="today") renderToday(); else if(tab==="review") renderReview(); else if(tab==="week") renderWeek(); else if(tab==="stats") renderStats(); else renderMore();
  syncNative();
}

/* ---------- calendar ---------- */
const tz = (() => { try{ return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; }catch(e){ return ""; } })();
const APP_URL = location.origin + location.pathname;
const stamp = (date, time) => iso(date).replace(/-/g,"") + "T" + time.replace(":","") + "00";
function plusMin(time, m){ const [h,mm] = time.split(":").map(Number); const t = h*60+mm+m; return pad(Math.floor(t/60)%24)+":"+pad(t%60); }
function gcalUrl({title, date, time, minutes=15, details="", daily=false}){
  const p = new URLSearchParams({action:"TEMPLATE", text:title, details});
  if(time) p.set("dates", stamp(date,time)+"/"+stamp(date,plusMin(time,minutes)));
  else p.set("dates", iso(date).replace(/-/g,"")+"/"+iso(addDays(date,1)).replace(/-/g,""));
  if(tz) p.set("ctz", tz);
  if(daily) p.set("recur", "RRULE:FREQ=DAILY");
  return "https://calendar.google.com/calendar/render?" + p.toString();
}
function renderReminders(){
  $("remMorning").value = settings.morning; $("remEvening").value = settings.evening;
  const today = new Date();
  $("gMorning").href = gcalUrl({title:"Ритм недели: план на день", date:today, time:settings.morning, minutes:10, daily:true, details:"Откройте Ритм недели: дела на сегодня и советы. 15 минут дневного света до обеда.\n"+APP_URL});
  $("gReview").href = gcalUrl({title:"Ритм недели: разбор дня", date:today, time:reviewTime(), minutes:10, daily:true, details:"Две минуты: отметьте, что и сколько делали, и получите советы и план на завтра.\n"+APP_URL});
  $("gReviewNote").textContent = "В " + reviewTime() + ", за 30 минут до сна";
  $("gEvening").href = gcalUrl({title:"Ритм недели: отметить день", date:today, time:settings.evening, minutes:10, daily:true, details:"Отметьте сделанное, сон, свет, энергию и настроение. Экраны выключить к "+settings.screensOff+".\n"+APP_URL});
}
$("remMorning").onchange = e => { if(e.target.value){ settings.morning = e.target.value; persistSettings(); renderReminders(); toast("Время сохранено. Добавьте напоминание в календарь заново"); } };
$("remEvening").onchange = e => { if(e.target.value){ settings.evening = e.target.value; persistSettings(); renderReminders(); toast("Время сохранено. Добавьте напоминание в календарь заново"); } };
function icsText(s){ return String(s).replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\n/g,"\\n"); }
function buildIcs(key){
  const w = getWeek(key), ws = new Date(key+"T00:00:00"), dtstamp = new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d+/,"");
  const L = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Ritm nedeli//RU","CALSCALE:GREGORIAN","METHOD:PUBLISH"];
  for(const it of w.items.filter(i=>!i.done)){
    const date = addDays(ws, it.day), cat = (CATS[it.cat]||CATS.other).n;
    L.push("BEGIN:VEVENT","UID:"+it.id+"-"+key+"@ritm","DTSTAMP:"+dtstamp);
    if(it.time) L.push("DTSTART:"+stamp(date,it.time), "DTEND:"+stamp(date,plusMin(it.time,30)));
    else L.push("DTSTART;VALUE=DATE:"+iso(date).replace(/-/g,""), "DTEND;VALUE=DATE:"+iso(addDays(date,1)).replace(/-/g,""));
    L.push("SUMMARY:"+icsText(it.t), "DESCRIPTION:"+icsText(cat));
    if(it.time) L.push("BEGIN:VALARM","ACTION:DISPLAY","DESCRIPTION:"+icsText(it.t),"TRIGGER:PT0M","END:VALARM");
    L.push("END:VEVENT");
  }
  L.push("END:VCALENDAR"); return L.join("\r\n");
}
function download(name, text, type){
  if(NATIVE){ let ok = false; try{ ok = NATIVE.saveFile(name, text, type); }catch(e){} toast(ok ? "Файл сохранён в «Загрузки»" : "Не удалось сохранить файл"); return; }
  const url = URL.createObjectURL(new Blob([text], {type})), a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
}
$("icsWeek").onclick = async () => {
  const key = curKey();
  if(!getWeek(key).items.some(i=>!i.done)){ toast("На этой неделе нет несделанных дел"); return; }
  const text = buildIcs(key), name = "ritm-"+key+".ics";
  try{ const file = new File([text], name, {type:"text/calendar"}); if(navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({files:[file], title:"Ритм недели"}); return; } }catch(e){ if(e && e.name==="AbortError") return; }
  download(name, text, "text/calendar"); if(!NATIVE) toast("Файл сохранён. Откройте его, чтобы добавить в календарь");
};

/* ---------- backup ---------- */
$("exportBtn").onclick = () => {
  const data = {app:"ritm", version:2, exported:new Date().toISOString(), entries:{}};
  for(const k of LS.keys()) data.entries[k] = LS.get(k);
  download("ritm-backup-"+iso(new Date())+".json", JSON.stringify(data), "application/json"); if(!NATIVE) toast("Копия сохранена в загрузках");
};
$("importFile").onchange = async e => {
  const f = e.target.files && e.target.files[0]; e.target.value = ""; if(!f) return;
  try{ const data = JSON.parse(await f.text()); if(!data || data.app!=="ritm" || !data.entries) throw 0;
    for(const [k,v] of Object.entries(data.entries)) LS.set(k,v); settings = loadSettings(); render(); toast("Данные восстановлены");
  }catch(err){ toast("Это не копия Ритма недели. Выберите файл ritm-backup-….json"); }
};

/* ---------- actions ---------- */
function mutate(key, fn){ const w = getWeek(key); fn(w); saveWeek(key, w); render(); }
function findIn(w, id){ return w.items.find(i=>i.id===id); }
function keyOfItem(id){ for(const k of [curKey(), viewKey()]) if(getWeek(k).items.some(i=>i.id===id)) return k; return tab==="week" ? viewKey() : curKey(); }
function bestDayFor(cat, key){
  const w = getWeek(key), from = Math.max(0, relIdx(key)), load = Array(7).fill(0); w.items.forEach(i=>load[i.day]++);
  let best = from, bl = 99; for(let d=from; d<7; d++){ if(w.items.some(i=>i.day===d && i.cat===cat)) continue; const l = load[d] + (cat==="pool" && d<5 ? 2 : 0); if(l<bl){ bl=l; best=d; } } return best;
}

document.addEventListener("click", e => {
  const t = e.target.closest("button"); if(!t) return;
  const ds = t.dataset;
  if(tab==="review" && reviewClick(ds)) return;
  if(ds.openreview){ openReview(); return; }
  if(ds.tab){ rvState = null; rvResult = null; tab = ds.tab; if(tab==="week") weekStart = mondayOf(new Date()); render(); window.scrollTo({top:0}); return; }
  if(ds.tick){ const k = keyOfItem(ds.tick); mutate(k, w => { const it = findIn(w, ds.tick); it.done = !it.done; if(it.done) toast("Отмечено. Так держать!"); }); }
  else if(ds.edit){ const k = keyOfItem(ds.edit); openItem(k, findIn(getWeek(k), ds.edit)); }
  else if(ds.add){ openItem(ds.week || curKey(), {id:null, day:+ds.add, cat:"walk", t:"", time:""}); }
  else if(ds.jump){ const el = $("day"+ds.jump); if(el) el.scrollIntoView({behavior:"smooth", block:"start"}); }
  else if(ds.hab){ const k = curKey(); mutate(k, w => { const d = todayI(); const cur = ds.hab==="sleep" ? sleepOk(w,k,d) : !!(w.days[d]||{})[ds.hab]; w.days[d] = {...(w.days[d]||{})}; w.days[d][ds.hab] = !cur; }); }
  else if(ds.sc){ mutate(curKey(), w => { const d = todayI(), v = +ds.v; w.days[d] = {...(w.days[d]||{})}; w.days[d][ds.sc] = w.days[d][ds.sc]===v ? null : v; }); }
  else if(ds.light){ mutate(curKey(), w => { const d = todayI(); w.days[d] = {...(w.days[d]||{}), light:true}; }); toast("Отмечено: дневной свет"); }
  else if(ds.native){ try{ if(ds.native==="health") NATIVE.requestHealth(); else if(ds.native==="usage"){ NATIVE.requestUsage(); toast("Найдите «Ритм недели» в списке и включите доступ"); } else { NATIVE.refreshHealth(); toast("Обновляю…"); } }catch(e){} }
  else if(ds.steps){ settings.stepsGoal = Math.max(2000, Math.min(20000, settings.stepsGoal + +ds.steps)); persistSettings(); render(); }
  else if(ds.early){ mutate(curKey(), w => w.items.push({id:uid(), day:todayI(), cat:"offline", t:"Лечь пораньше, без экрана", time:settings.screensOff, done:false})); toast("Добавлено на вечер"); }
  else if(ds.dismiss){ dismissed.add(ds.dismiss); render(); }
  else if(ds.snext){ offsets[ds.snext] = (offsets[ds.snext]||0) + 1; render(); }
  else if(ds.sadd){ const s = lastSugg[+ds.sadd]; if(!s) return; const tm = s.idea.time && s.idea.time > nowHM() ? s.idea.time : "";
    mutate(curKey(), w => w.items.push({id:uid(), day:todayI(), cat:s.cat, t:s.idea.t, time:tm, done:false})); toast("Добавлено на сегодня"); }
  else if(ds.splan){ const s = lastSugg[+ds.splan]; if(!s) return; const k = curKey(); openItem(k, {id:null, day:bestDayFor(s.cat,k), cat:s.cat, t:s.idea.t, time:s.idea.time||""}); }
  else if(ds.autofill){ const n = autoFill(viewKey()); render(); toast(n ? `Добавлено ${n} ${plural(n,"занятие","занятия","занятий")} в свободные дни` : "Свободных дней не осталось"); }
  else if(ds.act==="tpl") fillTemplate();
});
$("prev").onclick = () => { weekStart = addDays(weekStart,-7); render(); };
$("next").onclick = () => { weekStart = addDays(weekStart,7); render(); };
$("now").onclick = () => { weekStart = mondayOf(new Date()); render(); };
$("tpl").onclick = fillTemplate;
$("copyPrev").onclick = () => {
  const k = curKey(), prev = getWeek(iso(addDays(mondayOf(new Date()),-7)));
  if(!prev.items.length){ toast("Прошлая неделя пустая"); return; }
  mutate(k, w => prev.items.forEach(it => w.items.push({id:uid(), day:it.day, cat:it.cat, t:it.t, time:it.time||"", done:false}))); toast("Скопировано на эту неделю");
};
$("goalsBtn").onclick = openGoals;
$("helpBtn").onclick = openIntro;
$("clear").onclick = () => confirmIn($("clear"), "Точно очистить эту неделю?", () => { mutate(curKey(), w => { w.items = []; }); toast("Неделя очищена"); });
function fillTemplate(){ const k = tab==="week" ? viewKey() : curKey(); mutate(k, w => TEMPLATE.forEach(([d,c,t,tm]) => w.items.push({id:uid(), day:d, cat:c, t, time:tm, done:false}))); toast("Неделя заполнена по шаблону"); }
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
const defaultTitle = c => ({strength:"Домашняя силовая, 20 мин", walk:"Прогулка 30 мин", pool:"Бассейн с ускорениями", social:"Встреча или звонок", offline:"Вечер без экранов", fun:"Что-то приятное", games:"Ютуб или игры"}[c]||"");

function openItem(key, it){
  const draft = {...it}, ws = new Date(key+"T00:00:00");
  const catChips = () => Object.entries(CATS).map(([k,v]) => `<button type="button" class="chip ${draft.cat===k?"on":""}" data-cat="${k}"><i style="background:var(${v.c})"></i>${v.n}</button>`).join("");
  const dayChips = () => DW.map((w,d) => `<button type="button" class="chip ${draft.day===d?"on":""}" data-day="${d}">${w} ${addDays(ws,d).getDate()}</button>`).join("");
  const calHref = () => gcalUrl({title:draft.t || CATS[draft.cat].n, date:addDays(ws,draft.day), time:draft.time, minutes:30, details:"Ритм недели\n"+APP_URL});
  openSheet(`<h2>${it.id ? "Изменить дело" : "Новое дело"}</h2>
    <div class="field"><label class="label" for="fT">Что делаем</label><input id="fT" type="text" value="${esc(draft.t)}" placeholder="Например, прогулка в парке" autocomplete="off"></div>
    <div class="field"><span class="label">Тип</span><div class="chips" id="fCat">${catChips()}</div></div>
    <div class="field"><span class="label">День</span><div class="chips" id="fDay">${dayChips()}</div></div>
    <div class="field"><label class="label" for="fTime">Время (необязательно)</label><input id="fTime" type="time" value="${esc(draft.time||"")}"></div>
    <div class="tools"><button class="btn primary" id="fSave">Сохранить</button>
      ${it.id && it.day<6 ? `<button class="btn" id="fTomorrow">На завтра</button>`:""}
      <a class="btn" id="fCal" target="_blank" rel="noopener" href="${esc(calHref())}">В календарь</a>
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
    mutate(key, w => { if(it.id) Object.assign(findIn(w,it.id), {t:draft.t, cat:draft.cat, day:draft.day, time:draft.time}); else w.items.push({id:uid(), t:draft.t, cat:draft.cat, day:draft.day, time:draft.time, done:false}); });
    closeSheet(); toast(it.id ? "Сохранено" : "Добавлено " + DACC[draft.day]);
  };
  if($("fTomorrow")) $("fTomorrow").onclick = () => { mutate(key, w => { findIn(w,it.id).day = it.day+1; }); closeSheet(); toast("Перенесено " + DACC[it.day+1]); };
  if($("fDel")) $("fDel").onclick = () => confirmIn($("fDel"), "Точно удалить?", () => { mutate(key, w => { w.items = w.items.filter(i=>i.id!==it.id); }); closeSheet(); toast("Удалено"); });
  if(!it.id && !it.t) setTimeout(() => $("fT").focus(), 50);
}

function openGoals(){
  const draft = {...settings.goals};
  const rows = () => GOAL_CATS.map(c => `<div class="goalrow"><span style="display:flex;align-items:center;gap:8px"><i style="width:10px;height:10px;border-radius:50%;background:var(${CATS[c].c})"></i>${CATS[c].n}</span>
    <span class="stepper"><button data-g="${c}" data-d="-1" aria-label="Меньше">−</button><span class="num" style="min-width:1.5em;text-align:center">${draft[c]}</span><button data-g="${c}" data-d="1" aria-label="Больше">+</button></span></div>`).join("");
  openSheet(`<h2>Цели на неделю</h2><p class="note">Сколько раз в неделю. По этим числам приложение считает, чего не хватает, и подбирает советы.</p>
    <div id="gRows">${rows()}</div>
    <div class="field"><label class="label" for="gOff">Экраны выключаю в</label><input id="gOff" type="time" value="${settings.screensOff}"></div>
    <div class="tools"><button class="btn primary" id="gSave">Сохранить</button><button class="btn" id="gCancel">Отмена</button></div>`);
  $("gRows").onclick = e => { const b = e.target.closest("[data-g]"); if(!b) return; const c = b.dataset.g; draft[c] = Math.max(0, Math.min(7, draft[c] + +b.dataset.d)); $("gRows").innerHTML = rows(); };
  $("gCancel").onclick = closeSheet;
  $("gSave").onclick = () => { settings = {...settings, goals:draft, screensOff:$("gOff").value || "22:30"}; persistSettings(); closeSheet(); render(); toast("Цели сохранены"); };
}

function openIntro(){
  openSheet(`<h2>Как пользоваться</h2>
    <ol class="steps">
      <li><span><b>Сегодня</b> — ваши дела на день. Сделали — нажмите на кружок слева. Нажмите на само дело, чтобы изменить или перенести его.</span></li>
      <li><span><b>Советую добавить</b> — приложение само смотрит, чего не хватает за неделю, и предлагает занятия. «Добавить» ставит в план, «Другая идея» показывает замену.</span></li>
      <li><span><b>Вечером</b> отметьте сон, свет, энергию и настроение. Во вкладке <b>Итоги</b> появится, что вам реально помогает.</span></li>
      <li><span><b>Неделя</b> — план на 7 дней. Кнопка «Добавить недостающее» сама раскидает занятия по свободным дням.</span></li>
    </ol>
    <div class="tools"><button class="btn primary" id="introOk">Понятно</button></div>`);
  $("introOk").onclick = () => { LS.set("intro2", true); closeSheet(); };
}

let toastT = null;
function toast(msg){ const el = $("toast"); el.textContent = msg; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, 2600); }

/* ---------- day review: input, analysis, plan corrections ---------- */
const MOVE = c => !!(CATS[c] && CATS[c].move);
const defaultMin = it => { const m = /(\d+)\s*(?:–\d+\s*)?мин/.exec(it.t || ""); if(m) return +m[1]; if(it.cat==="games") return 60; if(it.cat==="pool") return 45; return 30; };
const hmMinus = (hm, m) => { const [h,mm] = hm.split(":").map(Number); let t = (h*60+mm-m+1440)%1440; return pad(Math.floor(t/60))+":"+pad(t%60); };
function usualBedtime(){
  const starts = []; const t = new Date();
  for(let i=0;i<7;i++){ const s = sleepFor(iso(addDays(t,-i))); if(s) starts.push(bedMin(s.start)); }
  if(starts.length >= 3){ starts.sort((a,b)=>a-b); const m = starts[Math.floor(starts.length/2)] % 1440; return {hm: pad(Math.floor(m/60))+":"+pad(m%60), auto:true}; }
  return {hm: settings.bedtime || "23:30", auto:false};
}
const reviewTime = () => hmMinus(usualBedtime().hm, 30);

function getReview(w, d){
  const its = w.items.filter(i=>i.day===d);
  const old = (w.days[d]||{}).review || {};
  const entries = {};
  for(const it of its){ const e = (old.entries||{})[it.id]; entries[it.id] = e ? {...e} : {done:!!it.done, min:defaultMin(it)}; }
  return {entries, extras:(old.extras||[]).map(x=>({...x})), steps:old.steps ?? null, sleepH:old.sleepH ?? null, screen:old.screen ?? null, caffeine:!!old.caffeine, alcohol:!!old.alcohol, stress:old.stress ?? null, done:!!old.done};
}
function saveReview(rv){
  const k = curKey(), d = todayI();
  mutateQuiet(k, w => {
    w.days[d] = {...(w.days[d]||{}), review:{...rv, at:new Date().toISOString()}};
    for(const it of w.items) if(it.day===d && rv.entries[it.id]) it.done = rv.entries[it.id].done;
  });
}
function mutateQuiet(key, fn){ const w = getWeek(key); fn(w); saveWeek(key, w); }

function activeMinutesWeek(w, ck, uptoDay, todayRv){
  let total = 0;
  for(let d=0; d<=uptoDay; d++){
    const rv = d === uptoDay && todayRv ? todayRv : (w.days[d]||{}).review;
    if(rv && rv.entries){
      for(const it of w.items) if(it.day===d && MOVE(it.cat) && rv.entries[it.id] && rv.entries[it.id].done) total += rv.entries[it.id].min || 0;
      for(const x of rv.extras||[]) if(MOVE(x.cat)) total += x.min || 0;
    } else for(const it of w.items) if(it.day===d && it.done && MOVE(it.cat)) total += defaultMin(it);
  }
  return total;
}

function analyzeDay(rv){
  const ck = curKey(), ti = todayI(), w = getWeek(ck), h = w.days[ti]||{}, ds = dateOf(ck, ti);
  const its = w.items.filter(i=>i.day===ti);
  const doneIts = its.filter(i=>rv.entries[i.id] && rv.entries[i.id].done);
  const undone = its.filter(i=>i.cat!=="games" && !(rv.entries[i.id] && rv.entries[i.id].done));
  const moveMin = doneIts.filter(i=>MOVE(i.cat)).reduce((s,i)=>s+(rv.entries[i.id].min||0),0) + rv.extras.filter(x=>MOVE(x.cat)).reduce((s,x)=>s+(x.min||0),0);
  const gamesMin = doneIts.filter(i=>i.cat==="games").reduce((s,i)=>s+(rv.entries[i.id].min||0),0) + rv.extras.filter(x=>x.cat==="games").reduce((s,x)=>s+(x.min||0),0);
  const steps = stepsFor(ds) ?? rv.steps;
  const sl = sleepFor(ds);
  const sleepMin = sl ? sl.min : (rv.sleepH != null ? rv.sleepH*60 : null);
  const goalSteps = settings.stepsGoal;
  const screenH = rv.screen != null ? rv.screen : (gamesMin ? Math.round(gamesMin/60) : null);
  const weekMin = activeMinutesWeek(w, ck, ti, rv), pace = Math.round(150/7*(ti+1));
  const did = c => doneIts.some(i=>i.cat===c) || rv.extras.some(x=>x.cat===c);
  const good = [], bad = [], tips = [];

  if(steps != null){ if(steps >= goalSteps) good.push(`${fmtNum(steps)} шагов: дневная цель выполнена.`); else if(steps >= goalSteps*0.7) good.push(`${fmtNum(steps)} шагов: почти цель.`); else if(steps < goalSteps*0.5) bad.push(`Всего ${fmtNum(steps)} шагов при цели ${fmtNum(goalSteps)}.`); }
  if(moveMin >= 30) good.push(`${moveMin} минут движения. Это больше дневной нормы (около 20–30 минут, чтобы набрать 150 в неделю).`);
  else if(moveMin > 0) good.push(`${moveMin} минут движения. Хорошо, но до дневной нормы чуть-чуть не хватило.`);
  else bad.push("Сегодня не было движения сверх обычного.");
  if(did("strength")) good.push("Силовая сделана. Мышцам нужно 2 таких дня в неделю.");
  if(did("social")) good.push("Было живое общение. Это один из самых сильных факторов настроения.");
  if(did("offline")) good.push("Было время без экранов.");
  if(did("fun")) good.push("Нашлось время просто для удовольствия.");
  if(h.light) good.push("Был дневной свет. Это помогает и бодрости днём, и сну ночью.");
  if(sleepMin != null){ if(sleepMin >= 420) good.push(`Сон прошлой ночью ${fmtDur(sleepMin)}: в норме.`); else if(sleepMin < 390) bad.push(`Сон прошлой ночью ${fmtDur(sleepMin)}: меньше нормы в 7–9 часов.`); }
  if(its.length && !undone.length) good.push("Все дела из плана выполнены.");
  else if(undone.length) bad.push(`Не получилось: ${undone.map(i=>i.t).join("; ")}.`);
  if(screenH != null){ if(screenH >= 2) bad.push("Больше 2 часов на экраны и игры."); else if(screenH === 0) good.push("Вечер без игр и Ютуба."); }
  if(rv.caffeine) bad.push("Кофе после 15:00: может сдвинуть засыпание на час и больше.");
  if(rv.alcohol) bad.push("Алкоголь: засыпается легче, но глубокий сон хуже.");
  if(h.energy && h.energy <= 2) bad.push(`Энергия низкая (${h.energy} из 5).`);
  if(h.energy && h.energy >= 4) good.push(`Энергия ${h.energy} из 5.`);
  if(rv.stress != null && rv.stress >= 4) bad.push(`Высокий стресс (${rv.stress} из 5).`);

  const bed = usualBedtime().hm;
  if(sleepMin != null && sleepMin < 390) tips.push(`Сегодня ложитесь не позже ${bed}, а лучше на 30 минут раньше: после короткой ночи организму нужно наверстать.`);
  if(rv.caffeine) tips.push("Завтра последний кофе до 14:00.");
  if(rv.alcohol) tips.push("Если завтра хочется отдохнуть, попробуйте без алкоголя и сравните, как будете спать.");
  if(screenH != null && screenH >= 2) tips.push(`Ограничьте игры и Ютуб часом и заканчивайте к ${settings.screensOff}.`);
  if(steps != null && steps < goalSteps*0.7) tips.push(`Добавьте 20–30 минут ходьбы: прогулка после ужина даёт около 2 000–3 000 шагов.`);
  if(weekMin < pace) tips.push(`За неделю пока ${weekMin} минут движения при ориентире ${pace} на сегодня (150 в неделю — рекомендация ВОЗ). Небольшие прогулки быстро закрывают разницу.`);
  if(rv.stress != null && rv.stress >= 4) tips.push("Перед сном 10 минут спокойной прогулки или медленного дыхания (вдох на 4, выдох на 6) снижают напряжение.");
  if(h.energy && h.energy <= 2 && moveMin === 0) tips.push("В дни без движения энергия часто ниже. Завтра начните с короткой прогулки на свету.");
  if(!tips.length) tips.push("Хороший баланс. Завтра повторите то, что сработало сегодня.");

  const score = good.length - bad.length;
  const verdict = score >= 3 ? "Сильный день" : score >= 1 ? "Хороший день" : score >= -1 ? "Неплохой день, есть что подтянуть" : "Тяжёлый день. Бывает, завтра будет легче";
  return {verdict, good, bad, tips: tips.slice(0,4), props: proposeChanges(rv, {sleepMin, steps, screenH, energy:h.energy, stress:rv.stress})};
}

function proposeChanges(rv, m){
  const ck = curKey(), ti = todayI(), props = [];
  const last = ti === 6;
  const key = last ? iso(addDays(new Date(ck+"T00:00:00"),7)) : ck;
  const w = getWeek(key), cw = getWeek(ck);
  const from = last ? 0 : ti+1, to = last ? 2 : 6;
  const tomorrow = last ? 0 : ti+1;
  const load = Array(7).fill(0); w.items.forEach(i=>load[i.day]++);
  const taken = (d,c) => w.items.some(i=>i.day===d && i.cat===c) || props.some(p=>p.day===d && p.cat===c);
  const bestDay = (c, avoid=-1) => { let b=-1, bl=99; for(let d=from; d<=to; d++){ if(d===avoid || taken(d,c)) continue; const l = load[d] + (c==="pool" && d<5 ? 2 : 0) + (d===tomorrow && (m.sleepMin!=null && m.sleepMin<390) && (c==="strength"||c==="pool") ? 5 : 0); if(l<bl){ bl=l; b=d; } } return b; };
  const tired = (m.sleepMin != null && m.sleepMin < 390) || (m.energy && m.energy <= 2) || (m.stress != null && m.stress >= 4);

  // 1. undone goal items from today → move forward
  if(!last) for(const it of cw.items.filter(i=>i.day===ti && GOAL_CATS.includes(i.cat) && !(rv.entries[i.id] && rv.entries[i.id].done))){
    const d = bestDay(it.cat); if(d < 0) continue;
    props.push({type:"move", key:ck, id:it.id, day:d, cat:it.cat, text:`Перенести «${it.t}» ${DACC[d]}`, why:"Не получилось сегодня, но до конца недели есть место"}); load[d]++;
  }
  // 2. tired → lighten tomorrow
  if(tired){
    for(const it of w.items.filter(i=>i.day===tomorrow && (i.cat==="strength"||i.cat==="pool") && !i.done)){
      const d = bestDay(it.cat, tomorrow);
      if(d >= 0 && d !== tomorrow){ props.push({type:"move", key, id:it.id, day:d, cat:it.cat, text:`Сдвинуть «${it.t}» с завтра ${DACC[d]}`, why:"После короткого сна или тяжёлого дня интенсивная нагрузка даётся хуже"}); load[d]++; }
    }
    if(!taken(tomorrow,"walk")){ props.push({type:"add", key, day:tomorrow, cat:"walk", t:"Лёгкая прогулка на свету, 20 мин", time:"", text:`Добавить завтра лёгкую прогулку`, why:"Мягко поднимает энергию без перегрузки"}); load[tomorrow]++; }
    props.push({type:"add", key, day:tomorrow, cat:"offline", t:"Лечь пораньше, без экрана", time:hmMinus(usualBedtime().hm, 30), text:`Завтра лечь на 30 минут раньше`, why:"Чтобы вернуть недосып"});
  }
  // 3. low steps → walk tomorrow
  if(m.steps != null && m.steps < settings.stepsGoal*0.5 && !taken(tomorrow,"walk")){
    props.push({type:"add", key, day:tomorrow, cat:"walk", t:"Прогулка после ужина, 30 мин", time:"20:00", text:`Добавить завтра прогулку после ужина`, why:`Сегодня было ${fmtNum(m.steps)} шагов`}); load[tomorrow]++;
  }
  // 4. late screens → move tomorrow's games earlier
  if(m.screenH != null && m.screenH >= 2){
    for(const it of w.items.filter(i=>i.day===tomorrow && i.cat==="games" && (!i.time || i.time > "20:00"))){
      props.push({type:"time", key, id:it.id, time:"19:30", cat:"games", day:tomorrow, text:`Перенести «${it.t}» завтра на 19:30 и ограничить часом`, why:"Чтобы к отбою мозг успел успокоиться"});
    }
  }
  // 5. remaining weekly deficits → add varied ideas
  if(!last){
    const gs = goalState(cw, ti+1), recent = recentTitles();
    for(const c of GOAL_CATS){
      let need = gs[c].deficit - props.filter(p=>p.cat===c && (p.type==="add" || p.type==="move")).length;
      // items moved forward from today were counted as missed; moving them makes them future again
      let off = 0;
      while(need > 0){
        const d = bestDay(c); if(d < 0) break;
        const idea = ideasFor(c, d, null, off++, recent) || {t:CATS[c].n, time:""};
        recent.add(idea.t);
        props.push({type:"add", key, day:d, cat:c, t:idea.t, time:idea.time||"", text:`Добавить ${DACC[d]}: ${idea.t}`, why:`До цели недели не хватает: ${CATS[c].n.toLowerCase()}`});
        load[d]++; need--;
      }
    }
  } else if(!getWeek(key).items.length){
    props.push({type:"plan", key, text:"Составить план на следующую неделю", why:"Приложение подберёт занятия по вашим целям и разложит по дням"});
  }
  return props.map((p,i)=>({...p, i, on:true}));
}

let rvState = null, rvResult = null;
function openReview(){ tab = "review"; rvState = getReview(getWeek(curKey()), todayI()); rvResult = rvState.done ? analyzeDay(rvState) : null; if(rvResult) rvResult.props.forEach(p=>p.on=false); render(); window.scrollTo({top:0}); }

function renderReview(){
  const ck = curKey(), ti = todayI(), w = getWeek(ck), ds = dateOf(ck,ti), h = w.days[ti]||{};
  if(!rvState) rvState = getReview(w, ti);
  const rv = rvState, its = w.items.filter(i=>i.day===ti).sort((a,b)=>(a.time||"99").localeCompare(b.time||"99"));
  $("subtitle").textContent = `${DFULL[ti]}, ${new Date().getDate()} ${MONG[new Date().getMonth()]}`;
  const minsCtl = (attr, id, v) => `<span class="mins"><button data-${attr}="${id}" data-dm="-5" aria-label="Меньше">−</button><span class="num">${v} мин</span><button data-${attr}="${id}" data-dm="5" aria-label="Больше">+</button></span>`;
  const rows = its.map(it => { const e = rv.entries[it.id]; return `<div class="rvrow ${e.done?"on":""}"><button class="tick" data-rvtick="${it.id}" aria-label="Сделано"><span></span></button><span class="rt">${esc(it.t)}<small>${(CATS[it.cat]||CATS.other).n}</small></span>${e.done ? minsCtl("rvmin", it.id, e.min) : ""}</div>`; }).join("");
  const extras = rv.extras.map((x,i) => `<div class="rvrow on"><span class="tick"><span></span></span><span class="rt">${esc(x.t)}<small>${CATS[x.cat].n}, вне плана</small></span>${minsCtl("rvxmin", i, x.min)}<button class="x" data-rvxdel="${i}" aria-label="Убрать">×</button></div>`).join("");
  const addChips = ["walk","strength","pool","social","offline","fun","games"].map(c => `<button type="button" class="chip" data-rvadd="${c}"><i style="background:var(${CATS[c].c})"></i>${CATS[c].n}</button>`).join("");
  const st = stepsFor(ds), sl = sleepFor(ds);
  const seg = (name, opts, cur) => `<div class="seg">${opts.map(([v,l]) => `<button class="${cur===v?"on":""}" data-rvset="${name}" data-v="${v}">${l}</button>`).join("")}</div>`;
  const scale = (key, cur) => `<div class="row">${[1,2,3,4,5].map(n=>`<button class="${cur===n?"on":""}" data-rv${key}="${n}">${n}</button>`).join("")}</div>`;

  let html = `<section class="rvsec"><div class="bhead"><h2>Что было сегодня</h2><span class="note">отметьте и поправьте минуты</span></div>
    ${rows || `<p class="note">В плане на сегодня ничего не было. Добавьте, чем занимались, ниже.</p>`}${extras}
    <span class="label">Было вне плана</span><div class="chips">${addChips}</div></section>
    <section class="card"><h2>Шаги и сон</h2>
      ${st != null ? `<div class="status"><span class="rl"><b>${fmtNum(st)} шагов</b><span class="note">с телефона</span></span></div>`
        : `<div class="field"><label class="label" for="rvSteps">Шаги за день, если знаете</label><input id="rvSteps" type="number" inputmode="numeric" min="0" step="100" value="${rv.steps ?? ""}" placeholder="например, 6500"></div>`}
      ${sl ? `<div class="status"><span class="rl"><b>Сон ${fmtDur(sl.min)}</b><span class="note">${sl.start}–${sl.end}, ${sl.src==="hc"?"Health Connect":"по телефону, примерно"}</span></span></div>`
        : `<span class="label">Сколько спали прошлой ночью</span>${seg("sleepH", [[5,"меньше 6 ч"],[6.5,"6–7 ч"],[7.5,"7–8 ч"],[8.5,"больше 8 ч"]], rv.sleepH)}`}
    </section>
    <section class="card"><h2>Самочувствие</h2>
      <div class="scale"><span class="label">Энергия</span>${scale("energy", h.energy)}</div>
      <div class="scale"><span class="label">Настроение</span>${scale("mood", h.mood)}</div>
      <div class="scale"><span class="label">Стресс</span>${scale("stress", rv.stress)}</div>
    </section>
    <section class="card"><h2>Вечер</h2>
      <span class="label">Экраны: игры, Ютуб, соцсети</span>${seg("screen", [[0,"почти не было"],[1,"до часа"],[1.5,"1–2 часа"],[2,"больше 2 часов"]], rv.screen)}
      <div class="check"><button class="tog ${rv.caffeine?"on":""}" data-rvflag="caffeine"><span class="box"></span>Кофе после 15:00</button><button class="tog ${rv.alcohol?"on":""}" data-rvflag="alcohol"><span class="box"></span>Алкоголь</button></div>
    </section>
    <button class="btn primary" id="rvGo" style="padding:14px;font-size:1rem">${rvResult ? "Разобрать заново" : "Разобрать день"}</button>`;

  if(rvResult){
    const r = rvResult;
    html += `<section class="card" id="rvResult"><span class="verdict">${r.verdict}</span>
      ${r.good.length ? `<span class="label">Что получилось</span><ul class="list">${r.good.map(t=>`<li>${esc(t)}</li>`).join("")}</ul>` : ""}
      ${r.bad.length ? `<span class="label">Что мешало</span><ul class="list bad">${r.bad.map(t=>`<li>${esc(t)}</li>`).join("")}</ul>` : ""}
      <span class="label">Советы</span><ul class="list tips">${r.tips.map(t=>`<li>${esc(t)}</li>`).join("")}</ul></section>`;
    if(r.props.length){
      html += `<section class="card"><h2>${todayI()===6 ? "Предлагаю на следующие дни" : "Предлагаю поправить план"}</h2><p class="note">Снимите галочки с того, что не подходит.</p>
        ${r.props.map(p => `<button class="prop ${p.on?"on":""}" data-prop="${p.i}"><span class="box"></span><span class="pt">${esc(p.text)}<small>${esc(p.why)}</small></span></button>`).join("")}
        <div class="tools"><button class="btn primary" id="rvApply">Применить выбранное</button><button class="btn" data-tab="week">Открыть неделю</button></div></section>`;
    } else html += `<section class="card"><h2>План менять не нужно</h2><p class="note">Всё нужное до конца недели уже стоит в расписании.</p></section>`;
  }
  $("tab-review").innerHTML = html;
  const stepsInput = $("rvSteps"); if(stepsInput) stepsInput.onchange = () => { const v = parseInt(stepsInput.value,10); rv.steps = isNaN(v) ? null : v; saveReview(rv); };
  $("rvGo").onclick = () => { rv.done = true; saveReview(rv); rvResult = analyzeDay(rv); render(); setTimeout(() => { const el = $("rvResult"); if(el) el.scrollIntoView({behavior:"smooth", block:"start"}); }, 50); };
  const ap = $("rvApply"); if(ap) ap.onclick = applyProps;
}

function applyProps(){
  const sel = rvResult.props.filter(p=>p.on); if(!sel.length){ toast("Ничего не выбрано"); return; }
  let n = 0;
  for(const p of sel){
    if(p.type === "plan"){ n += autoFill(p.key); continue; }
    mutateQuiet(p.key, w => {
      if(p.type === "move"){ const it = w.items.find(i=>i.id===p.id); if(it){ it.day = p.day; n++; } }
      else if(p.type === "time"){ const it = w.items.find(i=>i.id===p.id); if(it){ it.time = p.time; n++; } }
      else if(p.type === "add"){ w.items.push({id:uid(), day:p.day, cat:p.cat, t:p.t, time:p.time||"", done:false}); n++; }
    });
  }
  rvResult.props = [];
  render();
  toast(`План обновлён: ${n} ${plural(n,"изменение","изменения","изменений")}`);
}

function reviewClick(ds){
  if(!rvState) return false;
  const rv = rvState, k = curKey(), d = todayI();
  if(ds.rvtick){ const e = rv.entries[ds.rvtick]; e.done = !e.done; }
  else if(ds.rvmin){ const e = rv.entries[ds.rvmin]; e.min = Math.max(5, Math.min(300, e.min + +ds.dm)); }
  else if(ds.rvxmin != null){ const x = rv.extras[+ds.rvxmin]; x.min = Math.max(5, Math.min(300, x.min + +ds.dm)); }
  else if(ds.rvxdel != null){ rv.extras.splice(+ds.rvxdel, 1); }
  else if(ds.rvadd){ const c = ds.rvadd; rv.extras.push({cat:c, t:{walk:"Прогулка", strength:"Силовая", pool:"Бассейн", social:"Общение", offline:"Время без экранов", fun:"Что-то приятное", games:"Игры и Ютуб"}[c], min:c==="games"?60:30}); }
  else if(ds.rvset){ const v = +ds.v; rv[ds.rvset] = rv[ds.rvset] === v ? null : v; }
  else if(ds.rvflag){ rv[ds.rvflag] = !rv[ds.rvflag]; }
  else if(ds.rvenergy || ds.rvmood){ const key = ds.rvenergy ? "energy" : "mood", v = +(ds.rvenergy || ds.rvmood); mutateQuiet(k, w => { w.days[d] = {...(w.days[d]||{})}; w.days[d][key] = w.days[d][key] === v ? null : v; }); }
  else if(ds.rvstress){ const v = +ds.rvstress; rv.stress = rv.stress === v ? null : v; }
  else if(ds.prop != null){ const p = rvResult && rvResult.props[+ds.prop]; if(p) p.on = !p.on; render(); return true; }
  else return false;
  saveReview(rv); render(); return true;
}

/* ---------- android app bridge ---------- */
function checkOpen(){ if(!NATIVE) return false; let o = ""; try{ o = NATIVE.consumeOpen(); }catch(e){} if(o === "review"){ closeSheet(); openReview(); return true; } return false; }
window.__ritmNative = {
  onHealth(json){
    try{ const d = JSON.parse(json); if(d.error) return;
      health = {steps:d.steps||{}, sleep:d.sleep||{}, stepsGranted:!!d.stepsGranted, sleepGranted:!!d.sleepGranted, usage:!!d.usage, at:d.at};
      LS.set("health", health); render();
    }catch(e){}
  },
  onResume(){ try{ NATIVE.refreshHealth(); }catch(e){} if(!checkOpen()) render(); },
  onNotifPermission(ok){
    if(ok){ settings.notify = true; persistSettings(); try{ NATIVE.setReminders(settings.morning, settings.evening, true); }catch(e){} toast("Уведомления включены"); }
    else toast("Без разрешения уведомления не придут. Его можно дать в настройках Android");
    render();
  }
};
if(NATIVE){
  $("nToggle").onclick = () => {
    if(settings.notify){ settings.notify = false; persistSettings(); try{ NATIVE.setReminders(settings.morning, settings.evening, false); }catch(e){} toast("Уведомления выключены"); render(); }
    else { try{ NATIVE.requestNotifications(); }catch(e){} }
  };
  $("nTest").onclick = () => { syncNative(); try{ NATIVE.testNotification(); }catch(e){} };
  $("nTestReview").onclick = () => { syncNative(); try{ NATIVE.testReview(); }catch(e){} };
  $("nReviewToggle").onclick = () => { settings.reviewOn = !settings.reviewOn; persistSettings(); render(); toast(settings.reviewOn ? "Разбор дня включён" : "Разбор дня выключен"); };
  $("nBed").onchange = () => { if($("nBed").value){ settings.bedtime = $("nBed").value; persistSettings(); render(); toast("Время отбоя сохранено"); } };
  const saveTimes = () => { settings.morning = $("nMorning").value || settings.morning; settings.evening = $("nEvening").value || settings.evening; persistSettings(); if(settings.notify) try{ NATIVE.setReminders(settings.morning, settings.evening, true); }catch(e){} toast("Время сохранено"); };
  $("nMorning").onchange = saveTimes; $("nEvening").onchange = saveTimes;
  try{ NATIVE.refreshHealth(); }catch(e){}
  if(settings.notify) try{ NATIVE.setReminders(settings.morning, settings.evening, true); }catch(e){}
}

/* ---------- install & offline ---------- */
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredPrompt = e; $("installBtn").hidden = false; });
$("installBtn").onclick = async () => { if(!deferredPrompt) return; deferredPrompt.prompt(); try{ await deferredPrompt.userChoice; }catch(e){} deferredPrompt = null; $("installBtn").hidden = true; };
window.addEventListener("appinstalled", () => { $("installBtn").hidden = true; toast("Ритм недели установлен"); });
if(!NATIVE && "serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
document.addEventListener("visibilitychange", () => { if(!document.hidden){ dismissed = new Set(); render(); } });

render();
if(!checkOpen() && !LS.get("intro2")) openIntro();
})();
