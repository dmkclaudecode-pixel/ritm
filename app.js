(() => {
"use strict";
const TYPES = RITM.TYPES;
const CATS = Object.fromEntries(Object.entries(TYPES).map(([k,t]) => [k, {n:t.short||t.n, full:t.n, g:t.gen, c:t.c, move:t.g==="move", grp:t.g, unit:t.unit}]));
const GOALABLE = Object.keys(TYPES).filter(k => ["move","rest","social"].includes(TYPES[k].g) && TYPES[k].unit === "min");
const isScreen = c => !!(CATS[c] && CATS[c].grp === "screen");
const goalCats = () => GOALABLE.filter(c => (settings.goals[c]||0) > 0);
const DEFAULT_SETTINGS = {goals:{strength:2,walk:3,swim:1,mobility:2,social:2,unplug:1,outing:1,nature:1}, waterGoal:2000, caffeineMax:400, caffeineCutoff:"14:00", proteinGoal:100, screenLimit:120, screensOff:"22:30", morning:"08:45", evening:"19:45", stepsGoal:7000, notify:false, bedtime:"23:30", reviewOn:true};
const DW = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
const DFULL = ["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота","Воскресенье"];
const DACC = ["в понедельник","во вторник","в среду","в четверг","в пятницу","в субботу","в воскресенье"];
const MON = ["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"];
const MONG = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
const TEMPLATE = [
  [0,"strength","Силовая дома: всё тело","19:00"],[0,"gaming","Видеоигры, до часа","21:00"],
  [1,"walk","Быстрая прогулка","18:30"],[1,"social","Позвонить родителям или близким",""],
  [2,"mobility","Растяжка","21:00"],[2,"unplug","Вечер без экранов","21:00"],
  [3,"strength","Силовая дома: ноги и кор","19:00"],[3,"video","Ютуб, до часа","21:00"],[3,"social","Написать старому знакомому",""],
  [4,"walk","Прогулка после ужина","20:00"],[4,"outing","Кино, кафе или встреча с друзьями",""],[4,"gaming","Видеоигры с друзьями голосом","21:30"],
  [5,"swim","Бассейн с ускорениями","11:00"],[5,"nature","Парк или набережная","13:00"],
  [6,"walk","Прогулка в новом районе","12:00"],[6,"mobility","Йога","18:00"],[6,"relax","Отдых и план на неделю","19:00"]
];
// экраны в шаблоне не должны заходить на последний час перед сном
const fitScreenTime = (cat, tm) => { if(!tm || !isScreen(cat)) return tm; const hm = x => +x.slice(0,2)*60 + +x.slice(3,5); let off = hm(settings.screensOff || "22:30"); if(off < 6*60) off += 1440;
  let t = hm(tm); if(t < 6*60) t += 1440; if(t + 60 <= off) return tm; const n = Math.max(17*60, off - 60); return String(Math.floor(n/60)%24).padStart(2,"0") + ":" + String(n%60).padStart(2,"0"); };
const customActs = () => LS.get("custom") || [];
// отсечка кофеина: не позже чем за 9 часов до сна (период полувыведения ~5–6 ч; AASM/Drake 2013: кофеин за 6 ч до сна укорачивает сон)
function cafCutoffFor(bed){ let m = +bed.slice(0,2)*60 + +bed.slice(3,5); if(m < 6*60) m += 1440; m = Math.max(12*60, Math.min(16*60, m - 9*60)); return pad(Math.floor(m/60)) + ":" + pad(m%60); }
const IDEAS_BASE = RITM.CATALOG.filter(e => e.s).map(e => ({cat:e.t, t:e.n, min:e.m || TYPES[e.t].def, when:e.w||"any", time:e.tm||"", note:e.s}));
const ideasAll = () => IDEAS_BASE.concat(customActs().filter(e => TYPES[e.t] && TYPES[e.t].unit === "min").map(e => ({cat:e.t, t:e.n, min:e.m || TYPES[e.t].def, when:"any", time:"", note:"Ваше занятие"})));

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
(function migrate(){
  if((LS.get("schema")||1) >= 2) return;
  const MAP = {pool:"swim", offline:"unplug", fun:"outing", games:"gaming"};
  const RENAME = {"Ютуб или игры":"Видеоигры, до часа", "Игровой вечер":"Видеоигры с друзьями голосом", "Домашняя силовая, 20 мин":"Силовая дома: всё тело"};
  for(const k of LS.keys()) if(k.startsWith("w:")){
    const w = LS.get(k); if(!w) continue;
    for(const it of w.items||[]){
      if(RENAME[it.t]) it.t = RENAME[it.t];
      if(!RITM.TYPES[it.cat] || MAP[it.cat]){ const g = RITM.guessType(it.t); it.cat = (g && RITM.TYPES[g].g !== "intake" && g !== "sleep") ? g : (MAP[it.cat] || "other"); }
    }
    for(const day of Object.values(w.days||{})) for(const x of ((day.review||{}).extras||[])) if(MAP[x.cat]) x.cat = MAP[x.cat];
    LS.set(k, w);
  }
  const st = LS.get("settings");
  if(st && st.goals){ const g = {}; for(const [c,v] of Object.entries(st.goals)) g[MAP[c]||c] = v; st.goals = {...DEFAULT_SETTINGS.goals, ...g}; LS.set("settings", st); }
  LS.set("schema", 2);
})();
function loadSettings(){ const s = LS.get("settings") || {}; return {...DEFAULT_SETTINGS, ...s, goals:{...DEFAULT_SETTINGS.goals, ...(s.goals||{})}}; }
let settings = loadSettings();
const persistSettings = () => LS.set("settings", settings);

/* ---------- phone data: steps & sleep (Android app only) ---------- */
const NATIVE = window.RitmNative || null;
let health = LS.get("health") || {steps:{}, sleep:{}};
const fmtDur = m => { m = Math.round(m); return m < 60 ? `${m} мин` : (m % 60 ? `${Math.floor(m/60)} ч ${pad(m%60)} мин` : `${m/60} ч`); };
const fmtNum = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
const dateOf = (key, d) => iso(addDays(new Date(key+"T00:00:00"), d));
function dayLog(ds){ const d = new Date(ds+"T00:00:00"); const w = LS.get("w:"+iso(mondayOf(d))); return (w && w.days && w.days[(d.getDay()+6)%7]) || {}; }
function sleepFromLog(ds){
  const today = dayLog(ds), prev = dayLog(iso(addDays(new Date(ds+"T00:00:00"),-1)));
  const wake = (today.log||[]).filter(e=>e.type==="sleep" && e.event==="wake" && e.time).map(e=>e.time).sort()[0];
  const beds = (prev.log||[]).filter(e=>e.type==="sleep" && e.event==="bed" && e.time >= "18:00").map(e=>e.time).sort();
  const early = (today.log||[]).filter(e=>e.type==="sleep" && e.event==="bed" && e.time < "06:00").map(e=>e.time).sort();
  const bed = early.length ? early[early.length-1] : beds[beds.length-1];
  if(!wake || !bed) return null;
  const toM = t => +t.slice(0,2)*60 + +t.slice(3,5);
  let min = toM(wake) - toM(bed); if(min <= 0) min += 1440;
  return min >= 120 && min <= 16*60 ? {start:bed, end:wake, min, src:"log"} : null;
}
const sleepFor = ds => (health.sleep && health.sleep[ds]) || sleepFromLog(ds);
/* ----- сон за сутки: ночь + вечерний/дневной сон; норма — личная ----- */
function sleepTotal(ds){
  const main = sleepFor(ds), day = dayLog(ds), log = day.log || [];
  let extra = 0, nap = 0; const prev = iso(addDays(new Date(ds+"T00:00:00"), -1));
  const ses = health.sessions || [];
  const hasHC = ses.some(x => x.e.slice(0,10) === ds);
  // вечерний сон (начался и закончился в один день после 16:00) относится к ночи следующего дня
  for(const x of ses){
    const E = x.e.slice(0,10), evening = x.s.slice(0,10) === E && x.s.slice(11) >= "16:00", isMain = main && main.src !== "log" && E === ds && x.s.slice(11) === main.start && x.e.slice(11) === main.end;
    if(isMain) continue;
    if((E === ds && !evening) || (E === prev && evening)) extra += x.m;
  }
  if(!hasHC){   // записано вручную
    for(const e of log) if(e.type === "sleep" && e.event === "nap" && e.min && !(e.time && e.time >= "16:00")) nap += e.min;
    for(const e of dayLog(prev).log || []) if(e.type === "sleep" && e.event === "nap" && e.min && e.time && e.time >= "16:00") nap += e.min;
  }
  let base = main ? main.min : 0, src = main ? main.src : null;
  if(!main){ const nt = log.filter(e => e.type === "sleep" && e.event === "night" && e.min).map(e => e.min); if(nt.length){ base = Math.max(...nt); src = "chat"; } }
  const total = base + extra + nap;
  if(!total || (!main && !base)) return null;
  return {min: total, main: base, extra: extra + nap, start: main ? main.start : null, end: main ? main.end : null, src};
}
let needCache = {t:0, v:null};
// по самочувствию: при каком количестве сна энергия заметно выше (нужно ≥10 дней с оценкой энергии)
function learnSleepNeed(){
  const pairs = history(60).filter(x => x.sleepMin != null && x.energy != null);
  if(pairs.length < 10) return {n:pairs.length, T:null};
  let best = null;
  for(let T = 330; T <= 510; T += 30){
    const A = pairs.filter(x => x.sleepMin >= T).map(x => x.energy), B = pairs.filter(x => x.sleepMin < T).map(x => x.energy);
    if(A.length < 3 || B.length < 3) continue;
    const diff = mean(A) - mean(B); if(!best || diff > best.diff) best = {T, diff, nA:A.length, nB:B.length};
  }
  if(best && best.diff >= 0.6) return {n:pairs.length, T:best.T, diff:best.diff, nA:best.nA, nB:best.nB};
  return {n:pairs.length, T:null, flat:true};
}
function sleepNeed(){
  if(settings.sleepNeed) return {min:settings.sleepNeed, src:"user"};
  if(Date.now() - needCache.t > 60000){ let L = null; try{ L = learnSleepNeed(); }catch(e){} needCache = {t:Date.now(), v:L}; }
  const L = needCache.v; if(L && L.T) return {min:L.T, src:"data", n:L.n, diff:L.diff};
  return {min:420, src:"default", flat:!!(L && L.flat), n:L ? L.n : 0};
}
const sleepLow = m => m != null && m < sleepNeed().min - 30;
const sleepEnough = m => m != null && m >= sleepNeed().min - 15;
function needText(){ const n = sleepNeed(), h = fmtDur(n.min);
  return n.src === "user" ? `твоя норма — ${h}` : n.src === "data" ? `по твоему самочувствию тебе нужно около ${h}` : "ориентир для взрослых — 7–9 часов, твою норму определю по самочувствию"; }
const stepsFor = ds => { if(health.steps && health.steps[ds] != null) return health.steps[ds]; const d = dayLog(ds); return d.stepsManual != null ? d.stepsManual : ((d.review||{}).steps ?? null); };
function bedMin(hm){ const [h,m] = hm.split(":").map(Number); let t = h*60+m; if(t < 12*60) t += 24*60; return t; }
function sleepRegular(ds){
  const t = sleepTotal(ds); if(!t) return null;
  const en = dayLog(ds).energy;
  if(!sleepEnough(t.min) && !(en >= 4 && t.min >= 300)) return false;   // хорошее самочувствие важнее нормы
  const s = sleepFor(ds); if(!s || !s.start) return true;
  const prev = []; for(let i=1;i<=7;i++){ const o = sleepFor(iso(addDays(new Date(ds+"T00:00:00"),-i))); if(o) prev.push(bedMin(o.start)); }
  if(prev.length < 3) return true;
  prev.sort((a,b)=>a-b); return Math.abs(bedMin(s.start) - prev[Math.floor(prev.length/2)]) <= 60;
}
// null — данных о ночи нет; иначе ночь засчитана или нет (≥7 ч по AASM/SRS и ровный отбой)
function sleepVerdict(w, key, d){ const h = w.days[d]||{}; if(typeof h.sleep === "boolean") return h.sleep; const ds = dateOf(key,d); if(!sleepTotal(ds)) return null; return sleepRegular(ds) === true; }
function sleepOk(w, key, d){ const h = w.days[d]||{}; if(typeof h.sleep === "boolean") return h.sleep; return sleepRegular(dateOf(key,d)) === true; }

const curKey = () => iso(mondayOf(new Date()));
const todayI = () => (new Date().getDay()+6)%7;
(function migrateV3(){
  if((LS.get("schema") || 0) >= 3) return;
  const st = LS.get("settings");
  if(st){
    if(!st.goalsEdited && st.goals){ st.goals.mobility = Math.max(2, st.goals.mobility || 0); }
    if(!st.cafManual && st.bedtime) st.caffeineCutoff = cafCutoffFor(st.bedtime);
    LS.set("settings", st); settings = loadSettings();
  }
  // неделя из прежнего шаблона: добавляем второе занятие на гибкость, если его нет
  const ck = iso(mondayOf(new Date())), keys = [ck, iso(addDays(new Date(ck+"T00:00:00"), 7))];
  for(const k of keys){ const w = LS.get("w:"+k); if(!w || !w.items) continue;
    const fromTpl = w.items.some(i => i.t === "Растяжка" && i.day === 2) && w.items.some(i => i.t === "Отдых и план на неделю");
    if(fromTpl && w.items.filter(i => i.cat === "mobility").length < 2 && !w.items.some(i => i.day === 6 && i.cat === "mobility")){ w.items.push({id:uid(), day:6, cat:"mobility", t:"Йога", time:"18:00", done:false}); LS.set("w:"+k, w); } }
  LS.set("schema", 3);
})();
if(!LS.get("started")){
  const k = curKey();
  if(!LS.get("w:"+k)) saveWeek(k, {items:TEMPLATE.map(([d,c,t,tm]) => ({id:uid(), day:d, cat:c, t, time:fitScreenTime(c, tm), done:false})), days:{}});
  LS.set("started", true); persistSettings();
}

/* ---------- view state ---------- */
let tab = "chat";
let weekStart = mondayOf(new Date());
const viewKey = () => iso(weekStart);
function relIdx(key){ const ck = curKey(); return key === ck ? todayI() : (key < ck ? 7 : -1); } // index of "today" inside a week

/* ---------- analysis ---------- */
// минимальная длительность, с которой занятие засчитывается в цель недели (короче — пишется в журнал, но цель не закрывает)
const MIN_COUNT = {strength:15, walk:10, run:10, bike:10, swim:15, cardio:10, mobility:10, sport:20, social:10, outing:30, nature:30, unplug:30};
const minCount = c => MIN_COUNT[c] || 5;
function goalState(w, ti){
  const out = {};
  for(const c of goalCats()){
    const goal = settings.goals[c]||0; let done=0, future=0, missed=0, plan=0;
    for(const it of w.items){ if(it.cat!==c) continue; plan++; if(it.done) done++; else if(it.day >= ti) future++; else missed++; }
    for(const [d, day] of Object.entries(w.days||{})) for(const e of (day.log||[])) if(e.type===c && !e.plan && (e.min||0) >= minCount(c)){ done++; plan++; }
    out[c] = {goal, done, future, missed, plan, deficit: Math.max(0, goal - done - future)};
  }
  return out;
}
// аэробная нагрузка за неделю: ВОЗ рекомендует 150–300 минут умеренной (или 75–150 интенсивной)
const AERO = new Set(["walk","run","bike","swim","cardio","sport"]), AERO_GOAL = 150;
function aeroMinutes(w){
  const linked = {}; let done = 0, plan = 0;
  for(const day of Object.values(w.days||{})) for(const e of (day.log||[])) if(e.plan) linked[e.plan] = e.min || 0;
  for(const it of w.items){ if(!AERO.has(it.cat)) continue; const m = it.done && linked[it.id] ? linked[it.id] : defaultMin(it); plan += m; if(it.done) done += m; }
  for(const day of Object.values(w.days||{})) for(const e of (day.log||[])) if(AERO.has(e.type) && !e.plan && (e.min||0) >= 5){ done += e.min; plan += e.min; }
  return {done, plan};
}
function daysSinceDone(cat){
  const ck = curKey(), ti = todayI(), cw = getWeek(ck), pw = getWeek(iso(addDays(mondayOf(new Date()),-7)));
  let best = 99;
  for(const it of cw.items) if(it.cat===cat && it.done && it.day<=ti) best = Math.min(best, ti - it.day);
  for(const it of pw.items) if(it.cat===cat && it.done) best = Math.min(best, ti + 7 - it.day);
  for(const [d, day] of Object.entries(cw.days||{})) if(+d <= ti && (day.log||[]).some(e=>e.type===cat)) best = Math.min(best, ti - +d);
  for(const [d, day] of Object.entries(pw.days||{})) if((day.log||[]).some(e=>e.type===cat)) best = Math.min(best, ti + 7 - +d);
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
    if(idea.cat === "swim" && hour >= 20) return false;
    if(idea.when === "evening" && idea.time && hour > +idea.time.slice(0,2)+2) return false;
  }
  return true;
}
function ideasFor(cat, day, hour, offset, recent){
  const pool = ideasAll().filter(i => i.cat===cat && ideaFits(i, day, hour));
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
  const cands = goalCats().filter(c => settings.goals[c] > 0).map(c => {
    const g = gs[c], since = daysSinceDone(c), today = w.items.some(i => i.day===ti && i.cat===c);
    let score = g.deficit*10 + Math.min(since,10) - (today?40:0), whyOver = null;
    if(c === "swim" && g.deficit === 0) score -= 6;
    if(shortSleep && (c === "strength" || c === "swim")) score -= 15;
    if(c === "walk" && lowSteps){ score += 14; whyOver = `Сегодня пока ${fmtNum(stepsNow)} шагов из ${fmtNum(goalSteps)}`; }
    else if(c === "walk" && shortSleep){ score += 4; whyOver = `Сон был ${fmtDur(lastSleep.min)}: сегодня лучше лёгкая прогулка, чем силовая`; }
    return {c, g, since, today, score, whyOver};
  }).filter(x => !dismissed.has(x.c)).sort((a,b) => b.score - a.score);
  for(const x of cands){
    if(out.length >= 2) break;
    if(x.score <= 0 && out.length >= 1) continue;
    const idea = ideasFor(x.c, ti, hour, offsets[x.c]||0, recent);
    if(!idea) continue;
    let why;
    if(x.whyOver) why = x.whyOver;
    else if(x.g.deficit > 0) why = `До цели недели не хватает ${x.g.deficit} ${plural(x.g.deficit,"раза","раз","раз")}: ${CATS[x.c].n.toLowerCase()} ${x.g.done}/${x.g.goal}`;
    else if(x.since >= 3 && x.since < 99) why = `Уже ${x.since} ${plural(x.since,"день","дня","дней")} без ${CATS[x.c].g}`;
    else if(x.since === 99) why = `Ещё не было на этой неделе: ${CATS[x.c].n.toLowerCase()}`;
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
  const load = Array(7).fill(0); w.items.forEach(i => load[i.day]++); let off0 = 3;
  for(const c of goalCats()){
    let need = gs[c].deficit;
    let off = 0;
    while(need > 0){
      const best = smartDay(key, c, ti, -1, load, w);
      if(best < 0) break;
      let idea = ideasFor(c, best, null, off++, recent) || {t:CATS[c].n, time:""};
      // «не хватает времени» — предлагаем короткие версии
      if((settings.shortCats||[]).includes(c)){ const sh = RITM.CATALOG.filter(e => e.t === c && e.m && e.m >= 12 && e.m <= 25 && !recent.has(e.n)); if(sh.length) idea = {t:sh[off % sh.length].n, time:sh[off % sh.length].tm || ""}; }
      recent.add(idea.t);
      let tm = (!idea.time || idea.when === "any") ? learnedTime(c, best, smartTime(c, best, idea.time||"")) : smartTime(c, best, idea.time);
      if(key === curKey() && best === todayI() && tm && tm < fromMin(toMinHM(nowHM()) + 30)) tm = "";
      w.items.push({id:uid(), day:best, cat:c, t:idea.t, time:tm, done:false});
      load[best]++; added.push(idea.t); need--;
    }
  }
  // норма ВОЗ: хотя бы 150 минут аэробной нагрузки — добираем прогулками
  for(let guard = 0; guard < 4 && aeroMinutes(w).plan < AERO_GOAL; guard++){
    const best = smartDay(key, "walk", ti, -1, load, w); if(best < 0) break;
    const idea = ideasFor("walk", best, null, off0++, recent) || {t:CATS.walk.n, time:""};
    recent.add(idea.t); let tm = (!idea.time || idea.when === "any") ? learnedTime("walk", best, smartTime("walk", best, idea.time||"")) : smartTime("walk", best, idea.time);
    if(key === curKey() && best === todayI() && tm && tm < fromMin(toMinHM(nowHM()) + 30)) tm = "";
    w.items.push({id:uid(), day:best, cat:"walk", t:idea.t, time:tm, done:false}); load[best]++; added.push(idea.t);
  }
  if(added.length) saveWeek(key, w);
  return added.length;
}

/* ---------- rendering ---------- */
function itemRow(it){
  const cat = CATS[it.cat]||CATS.other, late = isScreen(it.cat) && it.time && it.time >= settings.screensOff;
  return `<div class="item ${it.done?"done":""}"><span class="stripe" style="background:var(${cat.c})"></span>
    <button class="tick" data-tick="${it.id}" aria-label="${it.done?"Снять отметку":"Отметить сделанным"}"><span></span></button>
    <button class="body" data-edit="${it.id}"><span class="t">${esc(it.t)}</span><span class="meta"><span>${cat.n}</span>${it.time?`<span class="num ${late?"late":""}">${it.time}</span>`:""}${late?`<span class="late">поздно для экрана</span>`:""}</span></button></div>`;
}

function placeCheckin(){   // вечером оценка дня идёт сразу после плана, днём — в конце
  const c = $("checkin"), plan = $("planBlock"), sugg = $("suggBlock"); if(!c || !plan || !sugg) return;
  if(new Date().getHours() >= 17) plan.after(c); else sugg.after(c);
}
function renderToday(){
  placeCheckin();
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
  renderNoticed();
  renderBody(ck, ti);
  renderScreenCard(ck, ti);
  renderJournal();
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
    <div class="status"><span class="rl"><b>История использования</b><span class="note">экранное время по приложениям и сон, если нет трекера</span></span>${health.usage ? `<span class="ok">включено</span>` : ""}</div>
    ${health.usage ? "" : usageHelpHtml()}
    ${(health.stepsGranted && NATIVE.requestHealthBg) ? `<div class="status"><span class="rl"><b>Прогулки в фоне</b><span class="note">уведомление «заметил прогулку», даже когда приложение закрыто</span></span>${health.bgGranted ? `<span class="ok">включено</span>` : `<button class="btn" data-native="healthbg">Разрешить</button>`}</div>` : ""}
    <div class="field"><span class="label">Цель по шагам в день</span><div class="stepper"><button data-steps="-1000" aria-label="Меньше">−</button><span class="num" style="min-width:4em;text-align:center">${fmtNum(settings.stepsGoal)}</span><button data-steps="1000" aria-label="Больше">+</button></div></div>`;
}

function buildSnapshot(){
  const ck = curKey(), w = getWeek(ck), days = {};
  for(let d=0; d<7; d++){
    const its = w.items.filter(i=>i.day===d).sort((a,b)=>(a.time||"99").localeCompare(b.time||"99"));
    const undone = its.filter(i=>!i.done);
    const gs = goalState(w, d), miss = goalCats().filter(c=>gs[c].deficit>0).map(c=>CATS[c].n.toLowerCase()+" ×"+gs[c].deficit);
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
let lastWalkCfg = "";
function syncWalkWatch(){
  if(!NATIVE || !NATIVE.setWalkWatch) return;
  const bad = LS.get("walkNo") || {}, cfg = JSON.stringify({enabled: !!(health && health.bgGranted && settings.notify), bad: Object.keys(bad).filter(h => bad[h] >= 2).map(Number)});
  if(cfg !== lastWalkCfg){ lastWalkCfg = cfg; try{ NATIVE.setWalkWatch(cfg); }catch(e){} }
}
function syncNative(){
  if(!NATIVE) return;
  syncWalkWatch();
  const s = JSON.stringify(buildSnapshot());
  if(s !== lastSnap){ lastSnap = s; try{ NATIVE.saveSnapshot(s); }catch(e){} }
  const rt = (settings.notify && settings.reviewOn ? "on " : "off ") + reviewTime();
  if(rt !== lastReviewSync){ lastReviewSync = rt; try{ NATIVE.setReview(reviewTime(), !!(settings.notify && settings.reviewOn)); }catch(e){} }
}
// при возврате в приложение переотправляем время разбора (на случай, если будильник сбился)
document.addEventListener("visibilitychange", () => { if(!document.hidden){ lastReviewSync = ""; try{ syncNative(); }catch(e){} } });

function renderWeek(){
  const key = viewKey(), w = getWeek(key), ws = weekStart, we = addDays(ws,6), ti = relIdx(key);
  $("subtitle").textContent = "Планируйте и переносите дела";
  $("range").textContent = `${ws.getDate()} ${MON[ws.getMonth()]} – ${we.getDate()} ${MON[we.getMonth()]}` + (ti>=0 && ti<=6 ? " · эта неделя" : "");
  $("strip").innerHTML = DW.map((dw,d) => {
    const dots = w.items.filter(i=>i.day===d).slice(0,5).map(i=>`<i class="${i.done?"on":""}"></i>`).join("");
    return `<button class="dchip ${d===ti?"today":""}" data-jump="${d}" aria-label="${DFULL[d]}"><span class="dw">${dw}</span><span class="dn">${addDays(ws,d).getDate()}</span><span class="dots">${dots}</span></button>`;
  }).join("");
  const gs = goalState(w, Math.max(0, ti)), missing = goalCats().filter(c => gs[c].deficit > 0), aeroNeed = ti >= 0 && ti < 6 || ti === -1 ? Math.max(0, AERO_GOAL - aeroMinutes(w).plan) : 0;
  let gh;
  if(ti === 7) gh = `<h2>Неделя прошла</h2><p class="note">Итоги этой недели — во вкладке «Итоги», когда она текущая. Можно скопировать её план на новую неделю во вкладке «Ещё».</p>`;
  else if(!w.items.length) gh = `<h2>Неделя пустая</h2><p class="note">Приложение может само составить план по вашим целям, с разными занятиями.</p><div class="tools"><button class="btn primary" data-autofill="1">Составить план за меня</button><button class="btn" data-act="tpl">По шаблону</button></div>`;
  else if(missing.length || aeroNeed > 0) gh = `<h2>Не хватает до целей</h2><p class="note">${missing.map(c => `${CATS[c].n.toLowerCase()} ×${gs[c].deficit}`).concat(aeroNeed > 0 ? [`аэробной нагрузки ещё ~${aeroNeed} мин (норма ВОЗ ${AERO_GOAL})`] : []).join(", ")}</p><div class="tools"><button class="btn primary" data-autofill="1">Добавить недостающее</button></div><p class="note">Приложение раскидает занятия по самым свободным дням и подберёт разные идеи.</p>`;
  else gh = `<p class="okline"><b>✓ Все цели недели в плане.</b> Чтобы перенести дело, нажмите на него.</p>`;
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
  $("goalsCard").innerHTML = `<div class="bhead"><h2>Цели недели</h2><span class="note num">${w.items.filter(i=>i.done).length} сделано</span></div><div class="goals">` + goalCats().filter(c=>settings.goals[c]).map(c => {
    const g = gs[c], col = `var(${CATS[c].c})`;
    return `<div class="goal"><div class="gh"><span>${CATS[c].n}</span><span class="num">${g.done}/${g.goal}</span></div><div class="bar"><div class="pl" style="width:${Math.min(100,g.plan/g.goal*100)}%;background:${col}"></div><div class="dn" style="width:${Math.min(100,g.done/g.goal*100)}%;background:${col}"></div></div></div>`;
  }).join("") + (() => { const a = aeroMinutes(w), col = "var(" + CATS.walk.c + ")";
    return `<div class="goal"><div class="gh"><span>Аэробика</span><span class="num">${a.done}/${AERO_GOAL} мин</span></div><div class="bar"><div class="pl" style="width:${Math.min(100,a.plan/AERO_GOAL*100)}%;background:${col}"></div><div class="dn" style="width:${Math.min(100,a.done/AERO_GOAL*100)}%;background:${col}"></div></div></div>`; })()
    + `</div><p class="note">Яркая часть полосы — сделано, бледная — запланировано. Аэробная нагрузка — ходьба, плавание, бег, велосипед и спорт; норма ВОЗ — от 150 минут в неделю.</p>`;

  const ins = [];
  const missing = goalCats().filter(c => gs[c].deficit > 0);
  if(missing.length) ins.push(["warn", `Не хватает до целей: ${missing.map(c => `${CATS[c].n.toLowerCase()} ×${gs[c].deficit}`).join(", ")}. Во вкладке «Неделя» можно добавить это одной кнопкой.`]);
  { const a = aeroMinutes(w); if(ti < 6 && a.plan < AERO_GOAL) ins.push(["warn", `В плане ${a.plan} мин аэробной нагрузки (ходьба, плавание, бег и т. п.). Норма ВОЗ — от ${AERO_GOAL} минут в неделю, лучше до 300. Добавьте прогулку: 30 минут быстрым шагом — это уже ${Math.round(30/AERO_GOAL*100)}% нормы.`]); }
  const missed = goalCats().reduce((s,c)=>s+gs[c].missed,0);
  if(missed) ins.push(["sun", `Пропущено ${missed} ${plural(missed,"дело","дела","дел")}. Не страшно: переносите их на свободные дни, а не отменяйте.`]);
  const elapsed = ti+1; let sleep=0, sleepN=0, light=0; const eM=[], eR=[], mood=[];
  for(let d=0; d<=ti; d++){
    const h = w.days[d]||{}; if(h.light) light++; if(h.mood) mood.push(h.mood);
    if(h.energy){ (w.items.some(i=>i.day===d && i.done && CATS[i.cat] && CATS[i.cat].move) ? eM : eR).push(h.energy); }
  }
  // сон считаем по последним 7 дням, а не по календарной неделе (в понедельник иначе всегда «данных мало»)
  for(let i = 0; i < 7; i++){ const dt = addDays(new Date(), -i), sv = sleepVerdict(getWeek(dateKeyOf(dt)), dateKeyOf(dt), dayIdxOf(dt)); if(sv !== null){ sleepN++; if(sv) sleep++; } }
  // выводы про сон и свет — только когда есть из чего: хотя бы 3 ночи / 3 дня
  if(sleepN < 3) ins.push(["info", `Сон: данных пока мало (${sleepN} из 3 нужных ночей). Норма у каждого своя: ${needText()}. Сон за сутки считаю вместе с дневным и вечерним; вывод по режиму появится, когда наберётся 3 ночи.`]);
  else { const need = Math.ceil(sleepN * 0.7);
    ins.push([sleep >= need ? "ok" : "warn", `Сон за 7 дней: ${sleep} из ${sleepN} ${plural(sleepN,"ночи","ночей","ночей")} в норме (${needText()}; хорошее самочувствие тоже засчитывается). ${sleep >= need ? "Так держать, это основа бодрости." : "Цель — большинство ночей по твоей норме. Ровное время отбоя помогает не меньше, чем длина сна."}`]); }
  if(elapsed >= 3) ins.push([light >= elapsed - 1 ? "ok" : "sun", `Дневной свет: ${light} из ${elapsed}. ${light >= elapsed - 1 ? "Отлично." : "Хватит 15–30 минут на улице до обеда: утренний свет настраивает суточный ритм."}`]);
  const avg = a => a.reduce((x,y)=>x+y,0)/a.length;
  if(NATIVE || Object.keys(health.steps||{}).length){
    const sd = [], sl = [], eGood = [], eBad = [];
    for(let d=0; d<=ti; d++){
      const ds = dateOf(ck,d), st = stepsFor(ds), sp = sleepFor(ds), h = w.days[d]||{};
      if(st != null && d < ti) sd.push(st);
      if(sp){ const tt = sleepTotal(ds) || sp; sl.push({...sp, min:tt.min}); if(h.energy) (sleepEnough(tt.min) ? eGood : eBad).push(h.energy); }
    }
    if(sd.length) { const a = avg(sd); ins.push([a >= settings.stepsGoal ? "ok" : "sun", `Шагов в среднем ${fmtNum(a)} в день при цели ${fmtNum(settings.stepsGoal)}.` + (a < settings.stepsGoal ? " Добавьте прогулку после ужина: это плюс 1 500–2 000 шагов." : "")]); }
    if(sl.length >= 3){
      const am = avg(sl.map(x=>x.min)), starts = sl.map(x=>bedMin(x.start)), spread = Math.max(...starts) - Math.min(...starts);
      ins.push([sleepEnough(am) ? "ok" : "warn", `Сон в среднем ${fmtDur(Math.round(am))} за сутки.` + (sleepLow(am) ? ` Это меньше твоей нормы (${needText()}).` : "") + (spread > 90 ? ` Время засыпания гуляет на ${Math.round(spread/6)/10} ч; ровный отбой помогает легче вставать.` : " Время отбоя стабильное.")]);
    }
    if(eGood.length >= 2 && eBad.length >= 2){ const df = avg(eGood) - avg(eBad); if(df > 0.2) ins.push(["ok", `После ночей от ${fmtDur(sleepNeed().min - 15)} энергия выше в среднем на ${df.toFixed(1).replace(".", ",")} балла.`]); }
  }
  if(eM.length >= 2 && eR.length >= 2){
    const diff = avg(eM) - avg(eR);
    ins.push([diff > 0 ? "ok" : "sun", diff > 0.2 ? `В дни с движением энергия выше в среднем на ${diff.toFixed(1).replace(".", ",")} балла. Движение вам реально помогает.` : `Пока разницы в энергии между днями с движением и без почти нет. Продолжайте отмечать, картина станет точнее.`]);
  } else ins.push(["info", "Отмечайте энергию, настроение и дневной свет вечером во вкладке «Сегодня». Через несколько дней здесь появится, как сон и движение влияют на ваше самочувствие."]);
  if(mood.length >= 3) ins.push(["ok", `Среднее настроение за неделю: ${avg(mood).toFixed(1).replace(".", ",")} из 5.`]);
  const doneNow = w.items.filter(i=>i.done && i.day<=ti).length, donePrev = pw.items.filter(i=>i.done && i.day<=ti).length;
  if(pw.items.length) ins.push(["ok", `К этому дню на прошлой неделе было сделано ${donePrev}, сейчас ${doneNow}.`]);
  const games = w.items.filter(i=>isScreen(i.cat)), late = games.filter(i=>i.time && i.time >= settings.screensOff);
  if(late.length) ins.push(["warn", `Игры после ${settings.screensOff} стоят ${late.length} ${plural(late.length,"раз","раза","раз")}. Это мешает заснуть; лучше сдвинуть раньше.`]);
  if(NATIVE) for(const x of weekScreenInsights(ck, ti)) ins.push(x);
  if(NATIVE){ const ns = nudgeStats(new Date(ck+"T00:00:00").getTime(), Date.now()+1); if(ns.n) ins.push([ns.ignored > ns.obeyed ? "warn" : "ok", `За неделю я ${ns.n} ${plural(ns.n,"раз","раза","раз")} просил сделать перерыв: послушался ${ns.obeyed}, по работе ${ns.exempt}, проигнорировал ${ns.ignored}` + (ns.promisedIgnored ? ` (из них ${ns.promisedIgnored} — после обещания выключить)` : "") + "."]); }
  renderPatterns();
  $("insights").innerHTML = `<h2>Что видно по неделе</h2>` + ins.map(([k,t]) => `<div class="insight"><span class="dot ${k==="warn"?"warn":k==="sun"?"sun":""}"></span><span>${t}</span></div>`).join("");
}

function renderMore(){
  $("subtitle").textContent = "Цели, уведомления, копия";
  renderReminders(); renderHealthCard(); renderActs(); renderMisses();
  $("nativeRem").hidden = !NATIVE; $("remCard").hidden = !!NATIVE;
  if(NATIVE){ $("nMorning").value = settings.morning; $("nEvening").value = settings.evening; $("nToggle").textContent = settings.notify ? "Выключить уведомления" : "Включить уведомления"; $("nToggle").classList.toggle("primary", !settings.notify); $("nTest").hidden = !settings.notify; $("nTestReview").hidden = !settings.notify;
    const ub = usualBedtime(); $("nBed").value = settings.bedtime;
    $("nWatch").innerHTML = [[0,"Выкл"],[30,"Строго"],[40,"Обычно"],[60,"Мягко"]].map(([v,l]) => `<button class="${(settings.watchMin ?? 40)===v?"on":""}" data-watch="${v}">${l}</button>`).join("");
    $("nWake").value = settings.wake || "08:00"; $("nLunch").value = settings.lunch || "13:00";
    $("nFreq").innerHTML = [[0,"Не писать"],[1,"Только утром"],[2,"Редко"],[3,"Иногда"],[5,"Раз в час, с подстройкой"]].map(([v,l]) => `<button class="${(settings.checkins ?? 5)===v?"on":""}" data-freq="${v}">${l}</button>`).join("");
    const bh = bestHours(); $("nFreqNote").textContent = bh.length ? `Лучше всего ты отвечаешь около ${bh.map(h => h + ":00").join(", ")}. Часы, когда ты почти не отвечаешь, я постепенно пропускаю.` : "Со временем я пойму, в какие часы тебе удобно отвечать, и буду писать в основном тогда.";
    $("nReviewToggle").textContent = settings.reviewOn ? "Включён" : "Выключен"; $("nReviewToggle").classList.toggle("primary", !!settings.reviewOn);
    $("nReviewNote").textContent = `В ${reviewTime()}, за 30 минут до ${ub.auto ? "вашего обычного отбоя по данным сна ("+ub.hm+")" : "отбоя в "+ub.hm}`; }
}

const TITLES = {chat:"Ритм", today:"Сегодня", review:"Разбор дня", week:"Неделя", stats:"Итоги", more:"Ещё"};
function render(){
  applyRecurring(curKey()); applyRecurring(iso(addDays(new Date(curKey()+"T00:00:00"),7)));
  for(const t of Object.keys(TITLES)) $("tab-"+t).hidden = t !== tab;
  document.querySelectorAll("#tabbar button").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
  $("title").textContent = TITLES[tab];
  if(tab==="chat") renderChat(); else if(tab==="today") renderToday(); else if(tab==="review") renderReview(); else if(tab==="week") renderWeek(); else if(tab==="stats") renderStats(); else renderMore();
  syncNative(); syncCheckins(); syncWatch();
  document.body.classList.toggle("inchat", tab === "chat");
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

function respond(text){ respondRules(text); }
/* ---------- backup ---------- */
function backupData(){ const data = {app:"ritm", version:2, exported:new Date().toISOString(), entries:{}}; for(const k of LS.keys()) data.entries[k] = LS.get(k); return data; }
// автокопия: раз в 7 дней, если в приложении есть что сохранять (только в Android-версии, файл попадает в «Загрузки»)
function maybeAutoBackup(){
  if(!NATIVE || settings.autoBackup === false) return;
  const last = LS.get("lastBackup") || 0, weeks = LS.keys().filter(k => /^w:/.test(k)).length;
  if(!weeks || Date.now() - last < 7*86400000) return;
  try{ const ok = NATIVE.saveFile("ritm-auto-backup-" + iso(new Date()) + ".json", JSON.stringify(backupData()), "application/json"); if(ok){ LS.set("lastBackup", Date.now()); renderBackupNote(); } }catch(e){}
}
function renderBackupNote(){
  const n = $("backupNote"), t = $("autoBackupToggle"); if(!n) return;
  const last = LS.get("lastBackup");
  n.textContent = NATIVE ? (last ? "Последняя автокопия: " + new Date(last).toLocaleDateString("ru-RU") + "." : "Автокопий пока не было.") : "Автокопия работает только в приложении для Android.";
  t.hidden = !NATIVE; t.textContent = settings.autoBackup === false ? "Автокопия выключена" : "Автокопия включена"; t.classList.toggle("primary", settings.autoBackup !== false);
}
$("autoBackupToggle").onclick = () => { settings.autoBackup = settings.autoBackup === false; persistSettings(); renderBackupNote(); toast(settings.autoBackup === false ? "Автокопия выключена" : "Автокопия включена"); maybeAutoBackup(); };
$("exportBtn").onclick = () => {
  const data = backupData();
  download("ritm-backup-"+iso(new Date())+".json", JSON.stringify(data), "application/json"); LS.set("lastBackup", Date.now()); renderBackupNote(); if(!NATIVE) toast("Копия сохранена в загрузках");
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
  let best = from, bl = 99; for(let d=from; d<7; d++){ if(w.items.some(i=>i.day===d && i.cat===cat)) continue; const l = load[d] + (cat==="swim" && d<5 ? 2 : 0); if(l<bl){ bl=l; best=d; } } return best;
}

document.addEventListener("click", e => {
  const t = e.target.closest("button"); if(!t) return;
  const ds = t.dataset;
  if(chatClick(ds)) return;
  if(ds.report){ tab = "chat"; postWeeklyReport(); render(); scrollChat(); return; }
  if(journalClick(ds, t)) return;
  if(appsClick(ds)) return;
  if(actsClick(ds)) return;
  if(missClick(ds)) return;
  if(tab==="review" && reviewClick(ds)) return;
  if(ds.openreview){ openReview(); return; }
  if(ds.tab){ rvState = null; rvResult = null; tab = ds.tab; if(tab === "chat") askRoutine(); if(tab==="week") weekStart = mondayOf(new Date()); render(); window.scrollTo({top:0}); return; }
  if(ds.tick){ const k = keyOfItem(ds.tick); mutate(k, w => { const it = findIn(w, ds.tick); it.done = !it.done; if(it.done) toast("Отмечено. Так держать!"); }); }
  else if(ds.edit){ const k = keyOfItem(ds.edit); openItem(k, findIn(getWeek(k), ds.edit)); }
  else if(ds.add){ openItem(ds.week || curKey(), {id:null, day:+ds.add, cat:"walk", t:"", time:""}); }
  else if(ds.jump){ const el = $("day"+ds.jump); if(el) el.scrollIntoView({behavior:"smooth", block:"start"}); }
  else if(ds.hab){ const k = curKey(); mutate(k, w => { const d = todayI(); const cur = ds.hab==="sleep" ? sleepOk(w,k,d) : !!(w.days[d]||{})[ds.hab]; w.days[d] = {...(w.days[d]||{})}; w.days[d][ds.hab] = !cur; }); }
  else if(ds.sc){ mutate(curKey(), w => { const d = todayI(), v = +ds.v; w.days[d] = {...(w.days[d]||{})}; w.days[d][ds.sc] = w.days[d][ds.sc]===v ? null : v; }); }
  else if(ds.light){ mutate(curKey(), w => { const d = todayI(); w.days[d] = {...(w.days[d]||{}), light:true}; }); toast("Отмечено: дневной свет"); }
  else if(ds.native){ try{ if(ds.native==="health") NATIVE.requestHealth(); else if(ds.native==="healthbg") NATIVE.requestHealthBg(); else if(ds.native==="appsettings") NATIVE.openAppSettings(); else if(ds.native==="usage"){ NATIVE.requestUsage(); toast("Найдите «Ритм недели» в списке и включите доступ"); } else { NATIVE.refreshHealth(); toast("Обновляю…"); } }catch(e){} }
  else if(ds.steps){ settings.stepsGoal = Math.max(2000, Math.min(20000, settings.stepsGoal + +ds.steps)); persistSettings(); render(); }
  else if(ds.early){ mutate(curKey(), w => w.items.push({id:uid(), day:todayI(), cat:"unplug", t:"Лечь пораньше, без экрана", time:settings.screensOff, done:false})); toast("Добавлено на вечер"); }
  else if(ds.nt){ noticedAnswer(ds.nid, ds.nt === "yes"); }
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
function fillTemplate(){ const k = tab==="week" ? viewKey() : curKey(); mutate(k, w => TEMPLATE.forEach(([d,c,t,tm]) => w.items.push({id:uid(), day:d, cat:c, t, time:fitScreenTime(c, tm), done:false}))); toast("Неделя заполнена по шаблону"); }
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
const defaultTitle = c => (CATS[c]||CATS.other).n;

function openItem(key, it){
  const draft = {...it}, ws = new Date(key+"T00:00:00");
  let catManual = !!it.id;
  const catChips = () => typeChipsHtml(draft.cat, k => !["intake"].includes(TYPES[k].g) && k !== "sleep");
  const dayChips = () => DW.map((w,d) => `<button type="button" class="chip ${draft.day===d?"on":""}" data-day="${d}">${w} ${addDays(ws,d).getDate()}</button>`).join("");
  const calHref = () => gcalUrl({title:draft.t || CATS[draft.cat].n, date:addDays(ws,draft.day), time:draft.time, minutes:30, details:"Ритм недели\n"+APP_URL});
  openSheet(`<h2>${it.id ? "Изменить дело" : "Новое дело"}</h2>
    <div class="field"><label class="label" for="fT">Что делаем</label><input id="fT" type="text" value="${esc(draft.t)}" placeholder="Например, прогулка в парке" autocomplete="off"></div>
    <div class="field"><span class="label">Тип <span class="note" id="fGuess"></span></span><div id="fCat">${catChips()}</div></div>
    <div class="field"><span class="label">День</span><div class="chips" id="fDay">${dayChips()}</div></div>
    <div class="field"><label class="label" for="fTime">Время (необязательно)</label><input id="fTime" type="time" value="${esc(draft.time||"")}"></div>
    <div class="tools"><button class="btn primary" id="fSave">Сохранить</button>
      ${it.id && it.day<6 ? `<button class="btn" id="fTomorrow">На завтра</button>`:""}
      <a class="btn" id="fCal" target="_blank" rel="noopener" href="${esc(calHref())}">В календарь</a>
      ${it.id ? `<button class="btn danger" id="fDel">Удалить</button>`:""}
      <button class="btn" id="fCancel">Отмена</button></div>`);
  const sync = () => { $("fCat").innerHTML = catChips(); $("fDay").innerHTML = dayChips(); $("fCal").href = calHref(); };
  $("fT").oninput = () => { draft.t = $("fT").value; $("fCal").href = calHref();
    if(!catManual){ const g = RITM.guessType(draft.t); if(g && g !== draft.cat && TYPES[g].g !== "intake" && g !== "sleep"){ draft.cat = g; $("fGuess").textContent = "— определил по названию"; sync(); } } };
  $("fTime").oninput = () => { draft.time = $("fTime").value; $("fCal").href = calHref(); };
  $("fCat").onclick = e => { const b = e.target.closest("[data-cat]"); if(!b) return; catManual = true; $("fGuess").textContent = ""; const wasDefault = !draft.t || draft.t===defaultTitle(draft.cat); draft.cat = b.dataset.cat; if(wasDefault && !it.id){ draft.t = defaultTitle(draft.cat); $("fT").value = draft.t; } sync(); };
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
  const lim = {waterGoal:settings.waterGoal, proteinGoal:settings.proteinGoal, caffeineMax:settings.caffeineMax, screenLimit:settings.screenLimit};
  const LIMITS = [["waterGoal","Вода в день", 250, 500, 5000, v => String(v/1000).replace(".",",")+" л"], ["proteinGoal","Белок в день", 10, 30, 250, v => v+" г"],
                  ["caffeineMax","Кофеин не больше", 50, 0, 600, v => v+" мг"], ["screenLimit","Экраны для развлечений не больше", 30, 0, 480, v => fmtDur(v)]];
  const row = (id, color, name, val, step, attr) => `<div class="goalrow"><span style="display:flex;align-items:center;gap:8px">${color ? `<i style="width:10px;height:10px;border-radius:50%;background:var(${color})"></i>` : ""}${name}</span>
    <span class="stepper"><button data-${attr}="${id}" data-d="-${step}" aria-label="Меньше">−</button><span class="num" style="min-width:3.6em;text-align:center">${val}</span><button data-${attr}="${id}" data-d="${step}" aria-label="Больше">+</button></span></div>`;
  const rows = () => {
    const groups = {}; for(const c of GOALABLE) (groups[TYPES[c].g] = groups[TYPES[c].g] || []).push(c);
    return Object.entries(groups).map(([g, cs]) => `<span class="label">${RITM.GROUPS[g].n}, раз в неделю</span>` + cs.map(c => row(c, CATS[c].c, CATS[c].full, draft[c]||0, 1, "g")).join("")).join("")
      + `<span class="label">Каждый день</span>` + LIMITS.map(([k,n,st,,,f]) => row(k, null, n, f(lim[k]), st, "lim")).join("");
  };
  openSheet(`<h2>Цели</h2><p class="note">Сколько раз в неделю вы хотите каждое занятие и дневные нормы. По ним приложение считает, чего не хватает, и подбирает советы. Ноль — без цели.</p>
    <div id="gRows">${rows()}</div>
    <div class="field"><label class="label" for="gWeight">Вес, кг <span class="note">— для нормы белка (1,4 г на кг при силовых)</span></label><input id="gWeight" type="number" min="30" max="250" inputmode="numeric" value="${settings.weight || ""}" placeholder="не указан"></div>
    <div class="field"><label class="label" for="gHeight">Рост, см · возраст · пол <span class="note">— для нормы калорий</span></label><div class="tools"><input id="gHeight" type="number" min="120" max="230" inputmode="numeric" value="${settings.height || ""}" placeholder="рост" style="width:5.5em"><input id="gAge" type="number" min="12" max="100" inputmode="numeric" value="${settings.age || ""}" placeholder="лет" style="width:5em"><select id="gSex"><option value="">пол</option><option value="m"${settings.sex==="m"?" selected":""}>мужской</option><option value="f"${settings.sex==="f"?" selected":""}>женский</option></select></div></div>
    <div class="field"><label class="label" for="gSleep">Сколько сна тебе нужно, ч <span class="note">— пусто: определю по самочувствию</span></label><input id="gSleep" type="number" min="3" max="12" step="0.5" inputmode="decimal" value="${settings.sleepNeed ? settings.sleepNeed/60 : ""}" placeholder="определю сам"></div>
    <div class="field"><label class="label" for="gCaf">Последний кофе до <span class="note">— сам считаю по отбою: за 9 часов до сна</span></label><input id="gCaf" type="time" value="${settings.caffeineCutoff}"></div>
    <div class="field"><label class="label" for="gOff">Экраны выключаю в</label><input id="gOff" type="time" value="${settings.screensOff}"></div>
    <div class="tools"><button class="btn primary" id="gSave">Сохранить</button><button class="btn" id="gCancel">Отмена</button></div>`);
  $("gRows").onclick = e => {
    const b = e.target.closest("[data-g],[data-lim]"); if(!b) return;
    if(b.dataset.g){ const c = b.dataset.g; draft[c] = Math.max(0, Math.min(7, (draft[c]||0) + +b.dataset.d)); }
    else { const k = b.dataset.lim, L = LIMITS.find(x=>x[0]===k); lim[k] = Math.max(L[3], Math.min(L[4], lim[k] + +b.dataset.d)); }
    $("gRows").innerHTML = rows();
  };
  $("gCancel").onclick = closeSheet;
  $("gSave").onclick = () => {
    const cafNew = $("gCaf").value || settings.caffeineCutoff, wt = Math.round(+$("gWeight").value || 0), protChanged = lim.proteinGoal !== settings.proteinGoal;
    settings = {...settings, ...lim, goals:draft, goalsEdited:true, screensOff:$("gOff").value || "22:30", caffeineCutoff:cafNew, cafManual: settings.cafManual || cafNew !== settings.caffeineCutoff};
    if(wt >= 30 && wt <= 250){ if(wt !== settings.weight && !protChanged) settings.proteinGoal = proteinFor(wt); settings.weight = wt; }
    { const hh = Math.round(+$("gHeight").value || 0), aa = Math.round(+$("gAge").value || 0); if(hh >= 120 && hh <= 230) settings.height = hh; if(aa >= 12 && aa <= 100) settings.age = aa; settings.sex = $("gSex").value || settings.sex || null; }
    const sv = parseFloat(($("gSleep").value || "").replace(",", ".")); settings.sleepNeed = sv >= 3 && sv <= 12 ? Math.round(sv*60/15)*15 : null; needCache = {t:0, v:null};
    persistSettings(); closeSheet(); render(); toast("Цели сохранены"); };
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

/* ---------- chat: talk to Ritm ---------- */
const CHAT_MAX = 400;
const MAJOR = new Set(["strength","run","bike","swim","cardio","sport"]);
const getChat = () => LS.get("chat") || [];
function saveChat(arr){ LS.set("chat", arr.slice(-CHAT_MAX)); }
function pushMsg(m){ const arr = getChat(); const msg = {id:uid(), at:Date.now(), ...m}; arr.push(msg); saveChat(arr); return msg; }
const bot = (text, acts, extra) => pushMsg({who:"bot", text, acts:acts||null, ...(extra||{})});
// выбор фразы без повторов: помним последние варианты из каждого набора
const PICKED = (() => { try{ return JSON.parse(localStorage.getItem("ritm:picked")||"{}"); }catch(e){ return {}; } })();
const pick = arr => {
  if(arr.length < 2) return arr[0];
  const k = arr.slice(0, 2).join("|").slice(0, 60), recent = PICKED[k] || [];
  const pool = arr.filter(x => !recent.includes(x)), v = (pool.length ? pool : arr)[Math.floor(Math.random() * (pool.length || arr.length))];
  PICKED[k] = recent.concat([v]).slice(-Math.min(3, arr.length - 1));
  try{ localStorage.setItem("ritm:picked", JSON.stringify(PICKED)); }catch(e){}
  return v;
};
// настроение и энергия сегодня: при плохом самочувствии хвалим мягче
const lowDay = () => { const d = getWeek(curKey()).days[todayI()] || {}; return (d.energy && d.energy <= 2) || (d.mood && d.mood <= 2) || d.sick; };
const PRAISE = ["Отлично!","Так держать!","Супер!","Молодец!","Здорово!","Красота!","Вот это да!","Класс!","Хорошая работа!","Огонь!","Записал, горжусь!","Уважаю!"];
const PRAISE_SOFT = ["Даже в непростой день, это здорово.","Хорошо, что получилось, береги себя.","Ты молодец, что не сдался.","Отлично, а теперь отдых."];
const praise = () => pick(lowDay() ? PRAISE_SOFT : PRAISE);
const nrm = s => " " + String(s).toLowerCase().replace(/ё/g,"е").replace(/[!?.,;:()«»"]/g," ").replace(/\s+/g," ").trim() + " ";

const WD = [["понедельник"],["вторник"],["сред"],["четверг"],["пятниц"],["суббот"],["воскресень"]];
function dayFromText(s){
  s = nrm(s);
  const base = new Date(); base.setHours(0,0,0,0);
  const cur = (base.getDay()+6)%7;
  const NW = {"один":1,"одну":1,"два":2,"две":2,"три":3,"четыре":4,"пять":5,"шесть":6,"неделю":7};
  let m = / через (\d+|один|одну|два|две|три|четыре|пять|шесть)? ?(день|дня|дней|неделю|недели) /.exec(s);
  if(m){ const n = m[1] ? (+m[1] || NW[m[1]]) : (m[2] === "день" ? 2 : 1); return addDays(base, /недел/.test(m[2]) ? 7 * (m[1] ? n : 1) : (m[1] ? n : 2)); }
  if(/ (на|в|эти|на эти|в эти) выходны[ехм] | на выходных | в выходной /.test(s) && !/ (по|каждые) выходным /.test(s)){
    const next = / следующ/.test(s); if(!next && cur >= 5) return base; return addDays(base, 5 - cur + (next ? 7 : 0)); }
  if(/ (в конце недели|под конец недели) /.test(s)) return addDays(base, Math.max(0, 4 - cur));
  if(/ (на следующей неделе|на следующую неделю|со следующей недели) /.test(s) && !WD.some(w => s.includes(" " + w[0]))) return addDays(base, 7 - cur);
  if(/ послезавтра /.test(s)) return addDays(base, 2);
  if(/ завтра /.test(s)) return addDays(base, 1);
  if(/ сегодня /.test(s)) return base;
  for(let i=0;i<7;i++) if(WD[i].some(w => new RegExp(" (в|во|на|к|до) " + w).test(s) || s.includes(" " + w))){
    const cur = (base.getDay()+6)%7; let diff = i - cur; if(diff < 0) diff += 7; if(/ следующ/.test(s) && diff < 7) diff = diff || 7;
    return addDays(base, diff);
  }
  return null;
}
const FUTURE = / (будет|буду|будем|собираюсь|собираемся|планирую|планируем|пойду|пойдем|поеду|поедем|схожу|сходим|хочу|хотим|запланир|займусь|позанимаюсь|сделаю|поплаваю|побегу|потренируюсь|завтра|послезавтра|вечером пойду|потом пойду)/;
const PAST_VERB = /(^|\s)[а-я]{2,}(ал|ял|ил|ыл|ел|ол|ул|ла|ли|лся|лась|лись)(?=\s)/;
const META = / (я )?(писал|написал|говорил|сказал|упоминал|предупреждал|же|ведь)[а-я]* (что|же)? /g;
const isFutureClause = (clause, whole, e) => {
  const c = nrm(clause).replace(META, " "), w = nrm(whole).replace(META, " ");
  if(e.time && e.time > nowHM() && !/ (утром|днем) /.test(c) && !/ (вчера|позавчера) /.test(c)) return true;
  if(FUTURE.test(c)) return true;
  if(PAST_VERB.test(c)) return false;
  if(FUTURE.test(w) && !PAST_VERB.test(c)) return true;
  if(e.time && e.time > nowHM() && !/ (утром|днем) /.test(c)) return true;
  return false;
};
const dateKeyOf = d => iso(mondayOf(d));
const dayIdxOf = d => (d.getDay()+6)%7;
const whenWord = d => { d = new Date(d); d.setHours(0,0,0,0); const t = new Date(); t.setHours(0,0,0,0); const diff = Math.round((d - t)/86400000);
  if(diff === 0) return "сегодня"; if(diff === 1) return "завтра"; if(diff === 2) return "послезавтра";
  if(diff < 0 || diff >= 14) return `${d.getDate()} ${MON[d.getMonth()]}`;
  return DACC[dayIdxOf(d)] + (iso(mondayOf(d)) !== iso(mondayOf(t)) ? " на следующей неделе" : ""); };
const lc = s => s ? s.charAt(0).toLowerCase() + s.slice(1) : s;

function bestDayInWeek(key, cat, fromDay, avoid){ return smartDay(key, cat, Math.max(0, fromDay), avoid); }

// ---------- replies ----------
function planText(date){
  const w = getWeek(dateKeyOf(date)), d = dayIdxOf(date);
  const its = w.items.filter(i=>i.day===d).sort((a,b)=>(a.time||"99").localeCompare(b.time||"99"));
  if(!its.length) return `На ${whenWord(date)} в плане ничего нет. Хочешь, подберу что-нибудь? Напиши, например, «завтра бассейн в 18».`;
  return `${cap1(whenWord(date))} в плане:\n` + its.map(i => `${i.done ? "✓" : "•"} ${i.time ? i.time+" " : ""}${i.t}`).join("\n");
}
const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
function todayStatsText(){
  const ck = curKey(), ti = todayI(), w = getWeek(ck), L = intakeOf((w.days[ti]||{}).log), st = stepsFor(dateOf(ck,ti)), pd = typeof phoneDay === "function" ? phoneDay(dateOf(ck,ti)) : null;
  const parts = [`Вода: ${L.water} из ${settings.waterGoal} мл`, `кофеин: ${L.mg} мг`, `белок: ${L.protein} из ${settings.proteinGoal} г`];
  if(st != null) parts.push(`шаги: ${fmtNum(st)}`);
  if(pd) parts.push(`телефон: ${fmtDur(pd.total)}, из них развлечения ${fmtDur(pd.ent)}`);
  const done = w.items.filter(i=>i.day===ti && i.done).length, all = w.items.filter(i=>i.day===ti).length;
  return `Сегодня сделано ${done} из ${all} по плану. ` + parts.join(", ") + ".";
}
function weekText(){
  const w = getWeek(curKey()), gs = goalState(w, todayI());
  const rows = goalCats().map(c => `${CATS[c].full}: ${gs[c].done} из ${gs[c].goal}` + (gs[c].deficit ? ` (не хватает ${gs[c].deficit})` : ""));
  return "Неделя по целям:\n" + rows.join("\n");
}
function commentFor(e){
  const ck = curKey(), ti = todayI(), w = getWeek(ck), L = intakeOf((w.days[ti]||{}).log);
  if(e.type === "caffeine"){
    if(e.time && e.time > settings.caffeineCutoff) return `Это уже после ${settings.caffeineCutoff}, может помешать заснуть. Кофеина сегодня ≈${L.mg} мг.`;
    if(L.mg > settings.caffeineMax) return `Кофеина сегодня уже ≈${L.mg} мг, это больше ${settings.caffeineMax}. Дальше лучше вода или травяной чай.`;
    return `Кофеина сегодня ≈${L.mg} мг.`;
  }
  if(e.type === "water") return L.water >= settings.waterGoal ? `Норма воды выполнена: ${L.water} мл!` : `Воды сегодня ${L.water} из ${settings.waterGoal} мл.`;
  if(e.type === "protein") return `Белка сегодня ${L.protein} из ${settings.proteinGoal} г.`;
  if(e.type === "alcohol") return "Не забудь стакан воды на каждую порцию, так сон пострадает меньше.";
  if(e.type === "sweets") return L.sweets >= 3 ? "Сладкого сегодня уже немало, дальше лучше фрукты или орехи." : "";
  if(e.type === "meal") return "Приятного аппетита!";
  if(e.type === "sleep") return e.event === "wake" ? "Доброе утро! Хорошего дня." : "Спокойной ночи!";
  if(TYPES[e.type] && TYPES[e.type].g === "screen") return (L.screen > settings.screenLimit) ? `Развлекательных экранов уже ${fmtDur(L.screen)} при лимите ${fmtDur(settings.screenLimit)}. Может, прогуляемся 15 минут?` : "";
  if(goalCats().includes(e.type)){ const g = goalState(w, ti)[e.type];
    const tail = g.done === g.goal ? pick([" Цель недели закрыта!"," Норма на неделю выполнена!"," План на неделю по этому пункту готов."]) : g.done > g.goal ? pick([" Уже сверх цели!"," Перевыполнение!"]) : ` ${CATS[e.type].full}: ${g.done} из ${g.goal} на этой неделе.`;
    return praise() + tail; }
  if(CATS[e.type] && CATS[e.type].move) return praise();
  return "";
}

// ---------- actions in chat ----------
function act(label, a){ return {l:label, a}; }
function runAction(msgId, i){
  const arr = getChat(), m = arr.find(x=>x.id===msgId); if(!m || !m.acts || m.chosen != null) return;
  const a = m.acts[i].a; m.chosen = i; saveChat(arr);
  let reply = "";
  if(a.op === "move"){ mutateQuiet(a.key, w => { const it = w.items.find(x=>x.id===a.id); if(it) it.day = a.day; }); reply = `Перенёс «${a.t}» ${DACC[a.day]}.`; }
  else if(a.op === "planNext"){ const nk = iso(addDays(new Date(curKey()+"T00:00:00"), todayI() >= 5 ? 7 : 0)); applyRecurring(nk); const n = autoFill(nk); reply = n ? `Составил план: добавил ${n} ${plural(n,"занятие","занятия","занятий")} в дни и часы, когда у тебя обычно получается. Посмотреть — вкладка «Неделя».` : "Все цели уже стоят в плане."; }
  else if(a.op === "goal"){ settings.goals[a.c] = a.to; persistSettings(); reply = `Цель «${CATS[a.c].full}» теперь ${a.to} в неделю.`; }
  else if(a.op === "swap"){ mutateQuiet(a.key, w => { const it = w.items.find(x=>x.id===a.id); if(it){ it.cat = a.type; it.t = a.name; } }); reply = `Заменил «${a.t}» на «${a.name}».`; }
  else if(a.op === "addToday"){ mutateQuiet(curKey(), w => w.items.push({id:uid(), day:todayI(), cat:a.cat, t:a.name, time:a.time||"", done:false})); reply = `Добавил на сегодня: «${a.name}»${a.time ? " в " + a.time : ""}.`; }
  else if(a.op === "clearMajor"){ let n = 0; const base = new Date(); base.setHours(0,0,0,0);
    for(let i=0;i<a.days;i++){ const dt = addDays(base,i), k = dateKeyOf(dt), d = dayIdxOf(dt); mutateQuiet(k, w => { const before = w.items.length; w.items = w.items.filter(x => !(x.day===d && !x.done && MAJOR.has(x.cat))); n += before - w.items.length; }); }
    reply = n ? `Убрал ${n} ${plural(n,"тренировку","тренировки","тренировок")}. Выздоравливай, потом спокойно вернёмся к плану.` : "Тренировок на эти дни и так нет."; }
  else if(a.op === "time"){ mutateQuiet(a.key, w => { const it = w.items.find(x=>x.id===a.id); if(it) it.time = a.time; }); reply = `Поставил «${a.t}» на ${a.time}.`; }
  else if(a.op === "remove"){ mutateQuiet(a.key, w => { w.items = w.items.filter(x=>x.id!==a.id); }); reply = `Убрал «${a.t}» из плана.`; }
  else if(a.op === "rskip"){ const r = getRoutine(); r.asked[a.k] = true; r.pending = null; saveRoutine(r); reply = "Хорошо, пропустим. Расскажешь потом, если захочешь."; }
  else if(a.op === "notact"){ const pend = (m.pending||[])[a.idx];
    if(pend){ RITM.forget(pend.text, pend.fuzzyWord); dropMiss(pend.text); }
    reply = "Понял, не записываю. Запомнил: " + (pend && pend.fuzzyWord ? `«${pend.fuzzyWord}» — не занятие.` : `«${pend ? pend.text.trim() : ""}» — не занятие.`); }
  else if(a.op === "sleepneed"){ settings.sleepNeed = a.min; persistSettings(); needCache = {t:0, v:null}; reply = `Поставил норму сна ${fmtDur(a.min)}.`; }
  else if(a.op === "why"){ const r = whyAnswer(a); m.chosen = i; saveChat(arr); bot(r.text, r.acts || null); render(); scrollChat(); return; }
  else if(a.op === "addOn"){ mutateQuiet(a.key, w => w.items.push({id:uid(), day:a.day, cat:a.cat, t:a.name, time:"", done:false})); reply = `Поставил «${a.name}» ${DACC[a.day]}.`; }
  else if(a.op === "unlog"){ let n = 0; mutateQuiet(a.key, w => { const day = w.days[a.d]; if(!day) return; const rm = (day.log||[]).filter(r => r.type === a.type && r.src === "chat"); n = rm.length;
      day.log = (day.log||[]).filter(r => !rm.includes(r)); for(const r of rm) if(r.fuzzyWord) RITM.forget(r.text, r.fuzzyWord); for(const r of rm) if(r.plan){ const it = w.items.find(i => i.id === r.plan); if(it) it.done = false; } });
    reply = n ? "Убрал ошибочную запись, отметку в плане тоже снял. Прости, неправильно понял." : "Записей уже нет."; }
  else if(a.op === "unlogIds"){ let n = 0; mutateQuiet(a.key, w => { const day = w.days[a.d]; if(!day) return; const before = (day.log||[]).length; day.log = (day.log||[]).filter(r => !a.ids.includes(r.id)); n = before - day.log.length; }); reply = n ? "Убрал запись о еде." : "Записей уже нет."; }
  else if(a.op === "walkAdd"){ mutateQuiet(a.key, w => { const day = w.days[a.d] = {...(w.days[a.d]||{})}; day.log = (day.log||[]).slice(); const it = w.items.find(i => i.day===a.d && i.cat==="walk" && !i.done); const rec = {id:uid(), type:"walk", name:"Прогулка", time:a.time, min:a.min, text:"прогулка по шагам", src:"steps"}; if(it){ it.done = true; rec.plan = it.id; } day.log.push(rec); }); reply = `Записал прогулку: ${a.min} мин с ${a.time}.`; }
  else if(a.op === "walkNo"){ const b = LS.get("walkNo") || {}; b[a.hour] = (b[a.hour]||0) + 1; LS.set("walkNo", b); reply = (b[a.hour] >= 2 ? "Понял, в это время больше не буду спрашивать." : "Понял, не записываю. Если такое повторится в это время ещё раз, перестану спрашивать."); }
  else if(a.op === "keep"){ reply = pick(["Хорошо, оставляю как есть.","Понял, ничего не меняю."]); }
  else if(a.op === "type"){
    const pend = (m.pending||[])[a.idx]; if(pend){ const wasFz = pend.fuzzy; pend.type = a.type; pend.changed = true; pend.wasUnknown = true; pend.fuzzy = false; if(a.noLearn){ pend.noLearn = true; pend.name = CATS[a.type].n; } fillDefaults(pend); dropMiss(pend.text);
      if(wasFz && pend.fuzzyWord) RITM.remember(pend.fuzzyWord, a.type, a.keepName ? pend.name : null);
      if(wasFz && a.keepName){ if(pend.future) addPlanFromChat(pend, new Date(pend.date)); else { const ln = logFromChat([pend]); if(ln.length) reply = `Отметил в плане: ${ln.map(i=>"«"+i.t+"»").join(", ")}. `; }
        reply = `Записал${pend.future ? " в план" : ""}: ${lc(pend.name)}. ` + (reply||"") + "Запомнил, как ты это пишешь." + (pend.future ? "" : " " + (commentFor(pend)||"")); }
      else { if(wasFz){ const nm = (RITM.core(pend.text||"") || String(pend.text||"")).trim(); pend.name = nm.charAt(0).toUpperCase() + nm.slice(1, 50); }
        if(pend.future) addPlanFromChat(pend, new Date(pend.date)); else logFromChat([pend]); reply = `Запомнил: «${pend.name}» — это ${CATS[a.type].full.toLowerCase()}.` + (pend.future ? "" : " " + (commentFor(pend)||"")); } }
  }
  else if(a.op === "typechoose"){
    const pend = (m.pending||[])[a.idx];
    chooseType(`Что такое «${pend ? pend.name : ""}»?`, null, t => { m.acts.push(act(CATS[t].n, {op:"type", idx:a.idx, type:t})); m.chosen = null; saveChat(getChat().map(x=>x.id===m.id?m:x)); runAction(m.id, m.acts.length-1); });
    m.chosen = null; saveChat(arr); return;
  }
  else if(a.op === "review"){ openReview(); return; }
  else if(a.op === "showPlan"){ m.chosen = i; saveChat(arr); showPlan(new Date()); render(); scrollChat(); return; }
  else if(a.op === "tab"){ tab = a.tab; render(); return; }
  else if(a.op === "water"){ quickWater(a.ml); reply = commentFor({type:"water"}); }
  if(reply) bot(reply.trim());
  render(); scrollChat();
}

// ---------- writing to journal and plan ----------
function logFromChat(entries){
  const linked = [], groups = {}, ids = []; let lk = null, ld = 0;
  for(const e of entries){ const off = e.dayOffset || 0; (groups[off] = groups[off] || []).push(e); }
  for(const [off, list] of Object.entries(groups)){
    const date = addDays(new Date(), +off), k = dateKeyOf(date), d = dayIdxOf(date);
    mutateQuiet(k, w => {
      const day = w.days[d] = {...(w.days[d]||{})}; day.log = (day.log||[]).slice();
      for(const e of list){
        if((e.changed || e.wasUnknown) && !e.noLearn) RITM.remember(e.text, e.type, e.wasUnknown ? e.name : null);
        const rec = {id:uid(), type:e.type, name:e.name, time:e.time || (TYPES[e.type].unit === "min" || +off ? "" : nowHM()), text:e.text, src:"chat"};
        for(const f of ["min","km","ml","mg","g","srv","steps","stepsOnly","event","dose","derived","sets","reps","fuzzyWord","kcal","p","f","c"]) if(e[f] != null) rec[f] = e[f];
        if(rec.stepsOnly) day.stepsManual = rec.steps;
        if(TYPES[rec.type].unit === "min" && !rec.stepsOnly){
          const it = w.items.find(i => i.day===d && i.cat===rec.type && !i.done);
          if(it){ it.done = true; rec.plan = it.id; linked.push(it); }
        }
        day.log.push(rec); ids.push(rec.id);
      }
    });
    lk = k; ld = d;
  }
  if(ids.length) rememberLastLog(lk, ld, ids);
  if(rvState) rvState = getReview(getWeek(curKey()), todayI());
  return linked;
}
function handleNegations(negs, text, msgDay, positive){
  const pos = new Set((positive||[]).map(x => x.type));
  for(const e of negs){
    const t = TYPES[e.type];
    if(t.g === "intake"){ bot({caffeine:"Отлично, день без кофеина — сон скажет спасибо.", alcohol:"Без алкоголя — отличный выбор.", sweets:"Без сладкого — молодец!"}[e.type] || "Понял, не записываю."); continue; }
    const date = e.negFuture ? (dayFromText(e.text) || msgDay || new Date()) : (e.dayOffset ? addDays(new Date(), e.dayOffset) : new Date());
    const key = dateKeyOf(date), d = dayIdxOf(date), w = getWeek(key);
    const sameAny = w.items.some(i => i.day===d && i.cat===e.type);
    const own = w.items.find(i => i.day===d && i.cat===e.type && !i.done);
    const wrong = !own && e.negFuture && key === curKey() && d === todayI() ? (w.days[d] && (w.days[d].log||[]).filter(r => r.type === e.type && r.src === "chat")) : null;
    const it = own || (MAJOR.has(e.type) && !pos.size && !sameAny && !(wrong && wrong.length) ? w.items.find(i => i.day===d && MAJOR.has(i.cat) && !i.done && !pos.has(i.cat)) : null);
    if(wrong && wrong.length){
      bot(`Понял. Но у меня на сегодня записано «${wrong[wrong.length-1].name}» — это я ошибся? Убрать запись?`,
        [act("Да, убрать запись", {op:"unlog", key, d, type:e.type}), act("Нет, оставить", {op:"keep"})]);
      continue;
    }
    if(it){
      mutateQuiet(key, ww => { const x = ww.items.find(i=>i.id===it.id); if(x) x.skipped = (x.skipped||0) + 1; });
      const from = key === curKey() ? Math.min(6, Math.max(todayI(), d) + (e.negFuture ? 0 : 1)) : 0;
      const bd = bestDayInWeek(key, it.cat, from, d), acts = [];
      if(bd >= 0) acts.push(act(`Перенести ${DACC[bd]}`, {op:"move", key, id:it.id, day:bd, t:it.t}));
      acts.push(act("Убрать из плана", {op:"remove", key, id:it.id, t:it.t}), act("Оставить как есть", {op:"keep"}));
      bot(pick(SKIP_OK) + ` Значит, «${it.t}» ${whenWord(date)} не будет. Что с этим сделать?`, acts);
      noteSkip(it.cat, it.day);
    } else bot(e.negFuture ? "Понял. В плане этого и так не было." : "Понял, не записываю.");
  }
}
function addPlanFromChat(e, date){
  const key = dateKeyOf(date), d = dayIdxOf(date); let res = {added:null, updated:null};
  mutateQuiet(key, w => {
    const same = w.items.find(i => i.day===d && i.cat===e.type && !i.done);
    if(same){ if(e.time) same.time = e.time; res.updated = same; }
    else { const it = {id:uid(), day:d, cat:e.type, t:e.name, time:e.time||"", done:false}; w.items.push(it); res.added = it; }
  });
  if((e.changed || e.wasUnknown) && !e.noLearn) RITM.remember(e.text, e.type, e.wasUnknown ? e.name : null);
  return res;
}

const pendingIssueDates = [];
// ---------- understanding a message ----------
function respondRules(text){
  const s = nrm(text);
  lastUserText = text; parserCtx();
  const A = RITM.analyze(text);
  if(A.crisis) return bot(CRISIS_TEXT, null, {kind:"crisis"});
  if(routineAnswer(text)) return;
  if(A.correction && LS.get("lastLog") || (A.correction && A.correction.op === "what")) return handleCorrection(A.correction);
  if(/ (что ты (обо|про) мне знаешь|мой распорядок|мой график|что знаешь обо мне) /.test(s)) return bot(routineSummary());
  if(/ (расскажу о себе|давай познакомимся|спроси меня|задай вопросы|узнай меня) /.test(s)){ if(!askRoutine(true)) bot(routineSummary()); return; }
  const pre = RITM.parse(text);
  const hasAct = pre.some(e => e.type && TYPES[e.type].unit !== "event");
  // «вернулся с работы», «пришёл домой», «я дома» — это не занятие, а смена обстановки: не записываем «работа 1ч»
  if(!/\d/.test(s) && / (вернул(ся|ась)|пришел|пришла|приехал|приехала|добрал(ся|ась)|доехал|доехала|я дома|уже дома|дома|еду домой|иду домой|закончил(а)? (работу|работать|рабочий день)|освободил(ся|ась)|ушел с работы|ушла с работы) /.test(s)
     && / (с работы|из офиса|с офиса|домой|дома|работу|работать|рабочий день|освободил(ся|ась)) /.test(s)
     && pre.every(e => !e.type || e.type === "work" || e.fuzzy)){
    const h = new Date().getHours();
    bot(pick(["С возвращением! Рабочий день позади.","Отлично, ты дома. Работу не записываю, это не занятие.","Принято, рабочий день закончился."]) + (h >= 17 ? " Хочешь, посмотрим, что осталось на вечер?" : ""),
      [act("Что сегодня в плане?", {op:"showPlan"}), act("Ничего, спасибо", {op:"keep"})]);
    return;
  }
  if(contextReply(text, s, A, pre)) return;
  // «смотрю», «листаю» без названия: приложение само видит, что открыто на телефоне, и записывает по истории использования
  if(!/\d/.test(s) && / (смотрю|смотрел[аи]?|листаю|листал[аи]?|кручу|залип\w*|сижу в телефоне|сидел[аи]? в телефоне) $/.test(s)){
    const g = usageGuess();
    if(g){ lastUserText = text; const e = {type:g.type, name:g.name, text, dayOffset:0, min:g.min}; fillDefaults(e); logFromChat([e]); const L = LS.get("lastLog");
      bot(`Вижу по телефону: сегодня ${g.name} ${fmtDur(g.min)}. Записал.`, L ? [act("Это не то, убрать", {op:"unlogIds", key:L.key, d:L.day, ids:L.ids}), act("Всё верно", {op:"keep"})] : null); return; }
    if(phoneDay(dateOf(curKey(), todayI()))){ ruleMiss = false; return bot("Новых минут в видео и соцсетях по телефону пока не вижу. Если расскажете, что именно смотрите, запишу."); }
  }
  // «еду на работу», «жена приготовила ужин», «заказал пиццу»: не запись о деле (если нет цифр и явного времени)
  if(A.notMine && !pre.some(e => e.time && !e.approx) && !(A.small && A.small.length)){ ruleMiss = false; return bot(chattyReply(null)); }
  const hasSureAct = pre.some(e => e.type && !e.fuzzy && TYPES[e.type].unit !== "event");
  if(A.meta === "tooEarly" && !hasSureAct){
    settings.statsHold = Math.max(settings.statsHold || 0, startedAt() + 14*86400000); persistSettings();
    const left = Math.max(1, 14 - dataDays());
    return bot(`Согласен, ты прав: данных пока слишком мало, и выводы по ним были бы гаданием. Ничего не меняю. Статистику буду только копить, а правки целей и расписания предложу не раньше чем через ${left} ${plural(left,"день","дня","дней")}, когда наберётся хотя бы две полные недели. Пока план строю по твоим целям и распорядку.`); }
  if(A.meta === "dontChange" && !hasSureAct){ settings.statsHold = Math.max(settings.statsHold || 0, Date.now() + 14*86400000); persistSettings();
    return bot("Хорошо, ничего не меняю. Сам с правками плана по статистике не полезу ещё минимум две недели. Если захочешь что-то поменять — просто напиши."); }
  if(A.small.length && !hasAct && A.words <= 7 && !A.states.length && handleSmall(A.small)) return;
  if(/ (разбор|подведи итог|подвести итог|итоги дня) /.test(s)) return bot("Давай подведём итоги дня.", [act("Открыть разбор", {op:"review"})]);
  const mentionsActivity = RITM.parse(text).some(e => e.type && TYPES[e.type].unit !== "event");
  const isQuestion = /\?|^ (что|какой|какие|покажи|план|расскажи)/.test(text.trim().toLowerCase() + " ") || /^ (что|какой|какие|покажи|план) /.test(s);
  if(!mentionsActivity && isQuestion && / (что|какой|какие|покажи|план|планы) /.test(s)){
    const dd = dayFromText(text) || new Date(); return showPlan(dd); }
  if(/ (как|что) .*(недел)| недел[яюи] /.test(s) && / (как|что|итог|цел) /.test(s)) return bot(weekText());
  const qStart = /^ (сколько|как|что|когда|какой|какая|какие|покажи|расскажи|много ли|хватает ли|достаточно ли)/.test(s);
  const tps = A.topics.filter(t => t !== "plan");
  if(!A.states.length && tps.length && ((A.question && (!hasAct || qStart)) || tps.includes("advice") || tps.includes("profile")) && answerTopic(tps)) return;
  if(/ (сколько|как|итоги|статистик|как прошел|как дела у меня) /.test(s) && / (вод|кофе|белк|шаг|сегодня|телефон|итог|статистик) /.test(s)) return bot(todayStatsText());
  const mv = /^ (перенеси|сдвинь|передвинь|перенести) (.+?) на (.+) $/.exec(s);
  if(mv) return moveCommand(mv[2], mv[3]);
  const rm = /^ (отмени|убери|удали|отменяю|отмените|уберите|удалите) (.+) $/.exec(s) || (() => { const m = /^ (.+?) (отмени|убери|удали|отмените|уберите|удалите|отменяется|отменяем|отмена) $/.exec(s); return m ? [0, 0, m[1]] : null; })();
  if(rm && !/^ (последн|это|эту|запись)/.test(" " + rm[2])) return removeCommand(rm[2]);
  if(/^ (ничего|ничем|отдыхаю|просто отдыхаю|ничего особенного) /.test(s)) return bot(pick(["Отдых тоже важен. Если захочется движения, короткая прогулка на 15 минут отлично перезагружает.","Понял. Если что-то будешь делать, напиши, я запишу."]));

  if(/ (не пиши|не беспокой|не трогай|хватит писать|помолчи|не надо писать)/.test(s) && !hasAct){ const t = new Date(); t.setDate(t.getDate()+1); t.setHours(6,0,0,0); settings.ciPauseUntil = t.getTime(); persistSettings(); lastCheckinSync = ""; return bot("Понял, сегодня больше не пишу. Завтра продолжим. Если хочешь реже насовсем — напиши «пиши реже»."); }
  if(/ (пиши реже|реже пиши|слишком часто пишешь|часто пишешь)/.test(s)){ settings.checkins = Math.max(1, Math.min(4, (settings.checkins ?? 5) === 5 ? 3 : (settings.checkins ?? 5) - 1)); persistSettings(); lastCheckinSync = ""; return bot("Хорошо, буду писать реже. Вернуть как было — «пиши чаще»."); }
  if(/ (пиши чаще|чаще пиши|пиши почаще|пиши каждый час)/.test(s)){ settings.checkins = 5; settings.ciPauseUntil = 0; persistSettings(); lastCheckinSync = ""; return bot("Договорились: буду писать примерно раз в час, пока ты не спишь, и постепенно подстроюсь под время, когда тебе удобно отвечать."); }
  if(/ (отчет|итоги недели|недельн|как прошла неделя)/.test(s) && !hasAct){ postWeeklyReport(); return; }
  if(/ (что ты (понял|заметил)|закономерност|выводы обо мне|что влияет|что мне помогает|что мне мешает)/.test(s)){ const ins = personalInsights(); return bot(ins.length ? "Вот что я заметил по твоим данным:\n" + ins.slice(0,5).map(x => "• " + x.text).join("\n") : "Пока мало данных для выводов. Нужно хотя бы 1–2 недели: отмечай энергию и настроение, пиши, что делал, — и я начну находить закономерности."); }
  if(/ (серии|стрик|сколько дней подряд)/.test(s)){ const st = streaks(); return bot(st.length ? "Твои серии: " + st.join("; ") + ". Не прерывай!" : "Пока серий нет — начни сегодня, и я буду считать."); }
  if(/ (что я пропускаю|что срывается|что не получается)/.test(s)){ const sk = skipPatterns(); return bot(sk.length ? "Чаще всего срывается:\n" + sk.slice(0,4).map(x => "• " + x.text).join("\n") + "\nМогу ставить эти занятия на дни, когда у тебя получается лучше: напиши «составь план»." : "Явных провалов пока не вижу. Так держать!"); }
  if(/ (составь план|спланируй неделю|план на неделю|распланируй)/.test(s)){ const nk = iso(addDays(new Date(curKey()+"T00:00:00"), todayI() >= 5 ? 7 : 0)); applyRecurring(nk); const n = autoFill(nk); return bot(n ? `Добавил ${n} ${plural(n,"занятие","занятия","занятий")} — в дни и часы, когда у тебя обычно получается. Посмотри вкладку «Неделя».` : "Все цели уже в плане."); }
  if(profileStatement(s, text)) return;
  if(foodStatement(text, s, pre)) return;
  if(routineStatement(text)) return;
  // feelings: «устал», «болит голова», «не выспался»
  if(A.states.length){ const done = handleStates(A.states); if(done && !hasAct && !pre.some(e => e.ask)) return; }
  if(A.question && !hasAct && !pre.some(e=>e.type)){ ruleMiss = true; noteMiss(text, "question"); return bot("Пока я умею отвечать про план, неделю, воду, кофеин, белок, шаги, сон и экранное время. Спроси, например: «сколько я выпил воды?» или «как я сплю?»."); }
  // activities: past → journal, future → plan
  const msgDay = dayFromText(text);
  const entries = RITM.parse(text);
  { const bedE = entries.find(e => e.type === "sleep" && e.event === "bed"), wakeE = entries.find(e => e.type === "sleep" && e.event === "wake");
    if(bedE && wakeE && !bedE.dayOffset && bedE.time && wakeE.time && bedE.time > wakeE.time) bedE.dayOffset = -1; }
  { const sl = entries.filter(e => e.min && !/(вздремну(?!л)|подремлю|посплю|прилягу|буду спать)/i.test(e.text || "") && ((!e.type && /^(поспал|спал|вздремнул|подремал|дремал|заснул на|уснул на)/i.test(e.name || "")) || (e.type === "relax" && /(вздремнул|подремал|задремал|дремал)/i.test(e.text || ""))));
    for(const e of sl){ entries.splice(entries.indexOf(e), 1); logSleepWords(e, text); }
    if(sl.length && !entries.length) return; }
  if(!entries.length && RITM.findActivity(text) && RITM.findActivity(text).none) return bot(chattyReply(null));
  if(!entries.length){ ruleMiss = true; noteMiss(text, "nothing"); return bot("Я пока не понял. Напиши, что делал («прогулка 30 минут», «выпил кофе в 9:30»), что планируешь («завтра бассейн в 18») или спроси «что сегодня?»."); }
  const lastBot = getChat().filter(m=>m.who==="bot").slice(-1)[0];
  const ctxKind = lastBot && Date.now() - lastBot.at < 3*3600*1000 ? lastBot.kind : null;

  const past = [], future = [], unknown = [], negs = [], clar = [], fuzzies = [];
  for(const e of entries){
    if(e.neg && e.type){ negs.push(e); continue; }
    if(!e.type && e.ask){ clar.push(e); continue; }
    if(!e.type){ unknown.push(e); continue; }
    fillDefaults(e);
    const cd = dayFromText(e.text) || msgDay;
    const fut = TYPES[e.type].unit === "min" && !e.stepsOnly && (isFutureClause(e.text, text, e) || (cd && dateKeyOf(cd)+dayIdxOf(cd) !== curKey()+todayI()));
    if(fut){ e.future = true; e.date = (cd || new Date()).getTime(); }
    if(e.fuzzy && !e.learned){ fuzzies.push(e); continue; }
    (fut ? future : past).push(e);
  }
  if(!past.length && !future.length && !negs.length && !clar.length && unknown.length && ctxKind !== "lunch") ruleMiss = true;
  // «сегодня будет бассейн, силовой не будет» — это замена одного на другое
  for(const n of negs.slice()){
    if(!n.negFuture || !MAJOR.has(n.type)) continue;
    const nd = dayFromText(n.text) || msgDay || new Date();
    const f = future.find(x => MAJOR.has(x.type) && x.type !== n.type && dateKeyOf(new Date(x.date)) + dayIdxOf(new Date(x.date)) === dateKeyOf(nd) + dayIdxOf(nd));
    if(!f) continue;
    const key = dateKeyOf(nd), d = dayIdxOf(nd), w = getWeek(key);
    const it = w.items.find(i => i.day===d && i.cat===n.type && !i.done); if(!it) continue;
    const old = it.t;
    mutateQuiet(key, ww => { const x = ww.items.find(i=>i.id===it.id); if(x){ x.skipped = (x.skipped||0) + 1; x.cat = f.type; x.t = f.name; if(f.time) x.time = f.time; } });
    negs.splice(negs.indexOf(n), 1); future.splice(future.indexOf(f), 1);
    const from = key === curKey() ? Math.min(6, Math.max(todayI(), d) + 1) : 0;
    const bd = bestDayInWeek(key, n.type, from, d), acts = [];
    if(bd >= 0) acts.push(act(`Да, ${DACC[bd]}`, {op:"addOn", key, day:bd, cat:n.type, name:old}));
    acts.push(act("Нет, на этой неделе без неё", {op:"keep"}));
    bot(`Понял: ${whenWord(nd)} ${lc(f.name)}${f.time ? " в " + f.time : ""} вместо «${old}». Заменил в плане.` + (bd >= 0 ? ` «${old}» поставить на другой день?` : ""), bd >= 0 ? acts : null);
    pendingIssueDates.push(nd);
  }
  if(negs.length) handleNegations(negs, text, msgDay, past.concat(future));
  for(const c of clar){
    const opts = c.ask === "train" ? ["strength","run","swim","cardio","mobility","sport"] : ["gaming","hobby","sport","social"];
    const label = {gaming:"Видеоигры", hobby:"Настольные игры", sport:"Спорт", social:"С детьми / с друзьями"};
    bot(c.ask === "train" ? `Записываю тренировку${c.min ? " на " + fmtDur(c.min) : ""}. А что это было?` : "Во что играл?",
      opts.map(t => act(c.ask === "play" ? label[t] : CATS[t].n, {op:"type", idx:0, type:t, noLearn:true})),
      {pending:[{...c, future: isFutureClause(c.text, text, c), date:(dayFromText(c.text) || msgDay || new Date()).getTime()}]});
  }
  // answer to the lunch question: make sure the meal itself is recorded
  if(ctxKind === "lunch" && !past.some(e=>e.type==="meal") && (past.length || unknown.length)){
    past.push({type:"meal", name:"Обед: " + text.trim().slice(0,60), time:nowHM(), srv:1, text});
    for(const u of unknown.splice(0)) void u;
  }
  const out = [];
  if(past.length){
    const linked = logFromChat(past);
    const groups = []; for(const e of past){ const g = groups.find(x => x.name === e.name && x.type === e.type); if(g) g.items.push(e); else groups.push({name:e.name, type:e.type, items:[e]}); }
    const desc = groups.map(g => { if(g.items.length === 1){ const e = g.items[0]; return `${lc(e.name)}${describe(e) ? " ("+describe(e)+")" : ""}${e.dayOffset === -1 ? " — вчера" : e.dayOffset === -2 ? " — позавчера" : ""}`; }
      const times = g.items.map(e=>e.time).filter(Boolean); return `${lc(g.name)} ×${g.items.length}${times.length ? " (в "+times.join(", ")+")" : ""}`; }).join(", ");
    const comments = [...new Set(past.map(commentFor).filter(Boolean))].slice(0,2).join(" ");
    out.push(`Записал: ${desc}.` + (linked.length ? ` Отметил в плане: ${linked.map(i=>"«"+i.t+"»").join(", ")}.` : "") + (comments ? " " + comments : ""));
    // did something else instead of the plan?
    const ti = todayI(), w = getWeek(curKey());
    const movedPast = past.filter(e => MAJOR.has(e.type) && !linked.some(i=>i.cat===e.type));
    if(movedPast.length){
      const other = w.items.find(i => i.day===ti && !i.done && MAJOR.has(i.cat) && i.cat !== movedPast[0].type);
      if(other){
        const bd = bestDayInWeek(curKey(), other.cat, ti+1);
        const acts = [];
        if(bd >= 0) acts.push(act(`Да, перенести ${DACC[bd]}`, {op:"move", key:curKey(), id:other.id, day:bd, t:other.t}));
        acts.push(act("Да, убрать из плана", {op:"remove", key:curKey(), id:other.id, t:other.t}));
        acts.push(act("Нет, она ещё будет", {op:"keep"}));
        bot(out.join(" ")); out.length = 0;
        bot(`Это было вместо «${other.t}»?`, acts);
      }
    }
  }
  for(const e of future){
    const date = new Date(e.date), key = dateKeyOf(date), d = dayIdxOf(date);
    const res = addPlanFromChat(e, date);
    const when = whenWord(date) + (e.time ? " в " + e.time : "");
    let line = res.updated ? `«${res.updated.t}» уже в плане, поставил ${when}.` : `Добавил в план: ${lc(e.name)} ${when}.`;
    const w = getWeek(key);
    const conflicts = w.items.filter(i => i.day===d && !i.done && i.cat !== e.type && MAJOR.has(i.cat) && MAJOR.has(e.type));
    if(conflicts.length){
      const c = conflicts[0], from = key === curKey() ? Math.max(todayI(), d) : 0;
      const bd = bestDayInWeek(key, c.cat, from, d);
      const acts = [];
      if(bd >= 0) acts.push(act(`Перенести «${c.t}» ${DACC[bd]}`, {op:"move", key, id:c.id, day:bd, t:c.t}));
      acts.push(act(`Убрать «${c.t}»`, {op:"remove", key, id:c.id, t:c.t}));
      acts.push(act("Оставить обе", {op:"keep"}));
      if(out.length){ bot(out.join(" ")); out.length = 0; }
      bot(line + ` Но на ${whenWord(date)} уже стоит «${c.t}». Две тренировки в день многовато. Заменить?`, acts);
      continue;
    }
    const near = e.time ? w.items.find(i => i.day===d && i.time && i.cat !== e.type && Math.abs((+i.time.slice(0,2)*60 + +i.time.slice(3)) - (+e.time.slice(0,2)*60 + +e.time.slice(3))) < 60) : null;
    if(near) line += ` Рядом по времени стоит «${near.t}» в ${near.time}, проверь, что всё успеваешь.`;
    out.push(line);
    pendingIssueDates.push(date);
  }
  if(out.length) bot(out.join("\n"));
  if(pendingIssueDates.length){ postIssues(pendingIssueDates.splice(0), 2); }
  // разговорная фраза («ну я пока не знаю», «мы только начали») — не занятие, не спрашиваем тип
  const chatty = unknown.filter(u => isChatty(u, A));
  const fzChatty = fuzzies.filter(u => isChatty({...u, name:u.text, min:u.minGuess ? null : u.min}, A));
  for(const u of fzChatty) fuzzies.splice(fuzzies.indexOf(u), 1);
  if(chatty.length || fzChatty.length){ for(const u of chatty) unknown.splice(unknown.indexOf(u), 1);
    noteMiss(text, "chat");
    if(!past.length && !future.length && !negs.length && !clar.length && !unknown.length && !fuzzies.length) bot(chattyReply(ctxKind)); }
  // неуверенная догадка (похоже на опечатку) — сначала спрашиваем
  for(const e of fuzzies){
    const what = lc(e.name) + (describe(e) && !e.minGuess ? " (" + describe(e) + ")" : "");
    bot(`Не уверен, что правильно понял «${e.text.trim()}». Это ${what}${e.future ? " — в план" : ""}?`,
      [act("Да", {op:"type", idx:0, type:e.type, keepName:true}), act("Нет, это не занятие", {op:"notact", idx:0}), act("Другое…", {op:"typechoose", idx:0})],
      {pending:[{...e, date: e.date || (dayFromText(e.text) || msgDay || new Date()).getTime()}]});
  }
  unknown.forEach((u, idx) => {
    noteMiss(u.text || u.name, "unknown");
    const guesses = ["walk","strength","sport","hobby","relax","meal","work","other"].filter(t => TYPES[t]);
    const m = bot(`Не знаю, что такое «${u.name}». Подскажи, к чему это отнести, и я запомню:`,
      guesses.slice(0,6).map(t => act(CATS[t].n, {op:"type", idx:0, type:t})).concat([act("Другое…", {op:"typechoose", idx:0}), act("Это не занятие", {op:"notact", idx:0})]),
      {pending:[{...u, future: isFutureClause(u.text, text, u), date: (dayFromText(u.text) || msgDay || new Date()).getTime()}]});
    void m;
  });
}
function isChatty(u, A){
  if(u.time || (u.qty && u.qty.length) || u.min) return false;
  const w = nrm(u.name).trim().split(" ").filter(Boolean);
  if(u.fuzzy && w.length >= 3) return true;
  if(w.some(x => /(ится|ется|ются|ятся|утся)$/.test(x)) || / (какая-то|какой-то|какие-то|что-то|кто-то|дичь|жесть|капец|ужас|кошмар|фигня|ерунда) /.test(nrm(u.name))) return true;   // «дичь какая-то творится»: опечатка в длинной фразе без цифр — скорее разговор
  if(w.length >= 4) return true;
  if(/ (я|мы|ты|он|она|они|это|не|нет|пока|еще|ещё|уже|никаких|ничего|знаю|понял|думаю|кажется|наверное|может|надо|нужно|хочу|рано|поздно|просто|вообще|короче|типа|вроде) /.test(nrm(u.name))) return true;
  return !!A.conversational && w.length >= 2;
}
const SKIP_OK = ["Ничего страшного, бывает.","Понял, без проблем.","Окей, случается.","Бывает, не страшно.","Жизнь вносит правки, это нормально.","Понял. Один пропуск ничего не ломает.","Окей, не беда."];
function chattyReply(kind){
  if(kind === "report" || kind === "insight") return "Понял тебя. Ничего не меняю, просто продолжаю наблюдать.";
  return pick(["Понял тебя.","Принято.","Окей, понял.","Ясно.","Услышал.","Понимаю."]) + " " + pick(["Если что-то делал или собираешься — напиши, я запишу.","Будут новости по делам — пиши.","Если захочешь что-то запланировать — я тут."]);
}
/* ---------- контекст: на что отвечает пользователь ---------- */
function refOf(m){
  if(!m) return null;
  let ref = m.ref;
  if(!ref && m.acts) for(const x of m.acts) if(x.a && x.a.id && x.a.key){ ref = {key:x.a.key, id:x.a.id}; break; }
  if(!ref) return null;
  const w = getWeek(ref.key), it = w.items.find(i => i.id === ref.id);
  return it ? {key:ref.key, it} : null;
}
function moveItemTo(f, date, time){
  const key = dateKeyOf(date), d = dayIdxOf(date);
  mutateQuiet(f.key, w => { w.items = w.items.filter(x => x.id !== f.it.id); });
  mutateQuiet(key, w => { w.items.push({...f.it, day:d, time: time || f.it.time, done:false}); });
}
function skipPrompt(f, date){
  mutateQuiet(f.key, w => { const x = w.items.find(i => i.id === f.it.id); if(x) x.skipped = (x.skipped||0) + 1; });
  const from = f.key === curKey() ? Math.min(6, Math.max(todayI(), f.it.day) + 1) : 0;
  const bd = bestDayInWeek(f.key, f.it.cat, from, f.it.day), acts = [];
  if(bd >= 0) acts.push(act(`Перенести ${DACC[bd]}`, {op:"move", key:f.key, id:f.it.id, day:bd, t:f.it.t}));
  acts.push(act("Убрать из плана", {op:"remove", key:f.key, id:f.it.id, t:f.it.t}), act("Оставить как есть", {op:"keep"}));
  bot(pick(SKIP_OK) + ` Что сделать с «${f.it.t}»?`, acts);
  noteSkip(f.it.cat, f.it.day);
}
const CANCEL_RE = / (не будет|не пойду|не поеду|не получится|не получилось|не успею|не успел|не успела|отмена|отменяется|отменяю|отменил|не смогу|не смог|не сегодня|не хочу|пропущу|пропускаю|пропустил|не вышло|не сделал|не сделала|не было|не ходил|не ходила|сорвалось|слил) /;
const DONE_RE = / (сделал|сделала|сделано|готово|сходил|сходила|отзанимался|отзанималась|сделал уже|уже сделал|выполнил|выполнила|получилось|отлично прошло|норм прошло|хорошо прошло|прошло|был|была|позанимался|потренировался|потренил|отходил|отплавал|отбегал|закрыл) /;
const STILL_RE = / (в силе|иду|пойду|буду|еду|поеду|собираюсь|все в силе|всё в силе|по плану|да|ага|конечно|ок|окей|угу|да конечно|естественно) /;
function contextReply(text, s, A, pre){
  const lastBot = getChat().filter(m => m.who === "bot").slice(-1)[0];
  if(!lastBot || lastBot.chosen != null || Date.now() - lastBot.at > 3*3600*1000) return false;
  const f = refOf(lastBot); if(!f) return false;
  // упомянуто другое занятие — это уже не ответ про этот пункт (замену разберёт общий разбор)
  if(pre.some(e => e.type && !e.fuzzy && e.type !== f.it.cat && TYPES[e.type].unit === "min")) return false;
  const kind = lastBot.kind || "";
  const date = dayFromText(text), tm = /(?:^|\s)(?:в|на|к|около)\s*(\d{1,2})(?:[:.\s](\d{2}))?(?!\s*(?:мин|час|км|раз|дн))/.exec(" " + text.toLowerCase() + " ");
  const time = tm && +tm[1] <= 23 ? pad(+tm[1]) + ":" + pad(+(tm[2]||0)) : null;
  const itDate = addDays(new Date(f.key + "T00:00:00"), f.it.day);
  const markAnswered = () => { const arr = getChat(); const m = arr.find(x => x.id === lastBot.id); if(m){ m.chosen = -1; saveChat(arr); } };
  // «нет, завтра», «давай в четверг в 19», «перенеси на завтра»
  if(date && dateKeyOf(date) + dayIdxOf(date) !== f.key + f.it.day){
    moveItemTo(f, date, time); markAnswered();
    bot(`Перенёс «${f.it.t}» на ${whenWord(date)}${time ? " в " + time : ""}.`); pendingIssueDates.push(date); postIssues(pendingIssueDates.splice(0), 2); return true;
  }
  // «давай в 19:30», «лучше на 20»
  if(time && !date && !DONE_RE.test(s) && / (в|на|к|давай|лучше|перенеси|сдвинь|позже|раньше) /.test(s) && A.words <= 6){
    mutateQuiet(f.key, w => { const x = w.items.find(i => i.id === f.it.id); if(x) x.time = time; }); markAnswered();
    bot(`Поставил «${f.it.t}» на ${time}.`); pendingIssueDates.push(itDate); postIssues(pendingIssueDates.splice(0), 2); return true;
  }
  if(CANCEL_RE.test(s) || (/^ (нет|неа|не|не-а) $/.test(s) && /before|after|asked/.test(kind))){
    markAnswered(); skipPrompt(f, itDate); return true;
  }
  if(DONE_RE.test(s) && !/ (не|ни) /.test(s) && /after|asked|before|doing/.test(kind)){
    const e = {type:f.it.cat, name:f.it.t, text, time:""}; fillDefaults(e);
    const qm = /(\d+)\s*(мин|час)/.exec(s); if(qm) e.min = /час/.test(qm[2]) ? +qm[1]*60 : +qm[1];
    markAnswered(); logFromChat([e]);
    mutateQuiet(f.key, w => { const x = w.items.find(i => i.id === f.it.id); if(x) x.done = true; });
    bot(`Отметил: «${f.it.t}» сделано.` + " " + (commentFor(e) || pick(["Отлично!","Так держать!"]))); return true;
  }
  if(kind === "before" && STILL_RE.test(s) && A.words <= 4){ markAnswered(); bot(pick([`Отлично! После «${f.it.t}» напиши, как прошло.`, "Супер, удачи! Потом расскажешь, как прошло."])); return true; }
  return false;
}

/* ---------- утро: как прошла ночь и что на неё повлияло ---------- */
function nightFacts(){
  const t = new Date(); t.setHours(0,0,0,0); const y = addDays(t, -1), ds = iso(t), ys = iso(y);
  const sl = sleepTotal(ds), facts = [], causes = [];
  const pdY = phoneDay(ys), pdT = phoneDay(ds);
  const yLog = (getWeek(dateKeyOf(y)).days[dayIdxOf(y)] || {}).log || [], L = intakeOf(yLog);
  if(pdY && pdY.late >= 20){ const after = pdT ? ((appsFor(ds)||{}).hours||[]).slice(0, 4).reduce((a,b) => a + (b||0), 0) : 0;
    causes.push({k:"screen", w:pdY.late, text:`вчера после ${settings.screensOff} ты был в телефоне ещё ${fmtDur(pdY.late)}` + (after >= 10 ? `, из них после полуночи около ${fmtDur(Math.round(after))}` : "")}); }
  if(L.lastCaf && L.lastCaf > settings.caffeineCutoff) causes.push({k:"caffeine", w:40, text:`последний кофеин был в ${L.lastCaf}`});
  if(L.alcohol > 0) causes.push({k:"alcohol", w:50, text:"вчера был алкоголь"});
  const yr = dayRecord(y); if(yr.hasData && yr.moveMin === 0 && (yr.steps == null || yr.steps < 3000)) causes.push({k:"move", w:15, text:"вчера почти не было движения"});
  if(sl){ facts.push(`Сон: ${fmtDur(sl.min)}${sl.extra ? ` (ночь ${fmtDur(sl.main)} и ещё ${fmtDur(sl.extra)} днём или вечером)` : sl.start ? ` (лёг в ${sl.start}, встал в ${sl.end})` : ""}.`);
    const bed = usualBedtime().hm; if(sl.start && bedMin(sl.start) - bedMin(bed) >= 45) causes.push({k:"late", w:bedMin(sl.start) - bedMin(bed), text:`лёг на ${fmtDur(bedMin(sl.start) - bedMin(bed))} позже обычного отбоя (${bed})`}); }
  causes.sort((a, b) => b.w - a.w);
  return {sl, facts, causes};
}
const TIP = {screen:`Сегодня попробуй убрать телефон в ${settings.screensOff} — хотя бы за 30 минут до сна.`, caffeine:`Сегодня кофеин только до ${settings.caffeineCutoff}.`, alcohol:"Сегодня больше воды и лечь пораньше.", move:"Сегодня хотя бы 20 минут пешком — сон будет глубже.", late:"Сегодня постарайся лечь вовремя, даже если не очень хочется."};
function personalLink(kind){ if(!statsReady(14)) return ""; const x = personalInsights().find(i => i.kind === kind); return x ? " По твоим данным: " + lc(x.text) : ""; }
function morningBrief(){
  const h = new Date().getHours(), today = iso(new Date());
  if(LS.get("briefDay") === today || h < 5 || h >= 13) return false;
  const n = nightFacts(); if(!n.sl && !n.causes.length) return false;
  LS.set("briefDay", today);
  const short = n.sl && sleepLow(n.sl.min), L = [];
  L.push(pick(["Доброе утро!","Утро доброе!","С добрым утром!"]) + (n.facts.length ? " " + n.facts.join(" ") : ""));
  if(short && n.causes.length){ L.push("Что могло помешать: " + n.causes.slice(0, 2).map(c => c.text).join("; ") + "." + personalLink(n.causes[0].k)); L.push(TIP[n.causes[0].k] || ""); }
  else if(short) L.push("Сна меньше твоей нормы. Сегодня без кофе после " + settings.caffeineCutoff + " и лучше лечь пораньше. А как самочувствие на самом деле? Отметь энергию, так я лучше пойму, сколько сна тебе нужно.");
  else if(n.sl) L.push(pick(["Хорошо выспался — отличный день, чтобы сделать что-то важное.","Выспался, это база. Удачного дня!","Нормальная ночь, так держать."]));
  else if(n.causes.length) L.push("Кстати, " + n.causes[0].text + "." + personalLink(n.causes[0].k));
  bot(L.filter(Boolean).join("\n"), [act("Как настроение? Отметить", {op:"tab", tab:"today"})], {kind:"brief"});
  return true;
}

/* ---------- сон словами: «поспал 3 часа вечером», «ночью спал 5 часов» ---------- */
function logSleepWords(e, text){
  const s = nrm(text), verbNap = /(вздремнул|подремал|задремал|дремал|заснул на|уснул на)/i.test((e.name || "") + " " + (e.text || ""));
  const nightWord = / (ночью|ночь|всю ночь|за ночь|ночи) /.test(s), dayWord = / (днем|днём|после обеда|в обед|после работы|вечером|утром) /.test(s);
  const night = nightWord || (e.time && (e.time >= "22:00" || e.time < "05:00")) || (!e.time && !dayWord && !verbNap && e.min >= 240);
  const off = e.dayOffset || 0, ds = iso(addDays(new Date(), off));
  logFromChat([{type:"sleep", event: night ? "night" : "nap", name: night ? "Ночной сон" : "Дневной сон", min:e.min, time:e.time || "", text, dayOffset:off}]);
  const t = sleepTotal(ds), L = [night ? `Записал ночной сон: ${fmtDur(e.min)}.` : `Записал ${e.time && e.time >= "16:00" ? "вечерний" : "дневной"} сон: ${fmtDur(e.min)}.`];
  if(t && (t.extra || night)) L.push(`За сутки ${fmtDur(t.min)}${t.extra && t.main ? ` (ночь ${fmtDur(t.main)} и ещё ${fmtDur(t.extra)})` : ""}: ${sleepEnough(t.min) ? "для твоей нормы хватает" : "это меньше твоей нормы"} (${needText()}).`);
  else if(!night) L.push("Ночь отметь, когда проснёшься, например: «лёг в 23, встал в 7» или «ночью спал 6 часов». Суммарно за сутки я считаю вместе.");
  if(!night && (e.min > 40 || (e.time && e.time >= "16:00"))) L.push("Дневной сон дольше 30 минут или после 16:00 может сдвинуть ночной. Лучше 20–30 минут до 15:00.");
  if(night && !dayLog(ds).energy) L.push("Отметь самочувствие (энергия 1–5) во вкладке «Сегодня»: по ней я пойму, сколько сна нужно именно тебе.");
  bot(L.join(" "));
}

/* ---------- срывы: спрашиваем, что мешает, и подстраиваемся ---------- */
function noteSkip(cat, dow){
  if(!CATS[cat] || !(CATS[cat].move || goalCats().includes(cat))) return;
  const arr = (LS.get("skips") || []).filter(x => Date.now() - x.at < 42*86400000);
  arr.push({cat, dow, at:Date.now()}); LS.set("skips", arr);
  const recent = arr.filter(x => x.cat === cat && Date.now() - x.at < 21*86400000);
  const asked = (LS.get("whyAsked") || {})[cat] || 0;
  if(recent.length >= 3 && Date.now() - asked > 10*86400000){
    const wa = LS.get("whyAsked") || {}; wa[cat] = Date.now(); LS.set("whyAsked", wa);
    const days = [...new Set(recent.map(x => x.dow))];
    bot(`«${CATS[cat].full}» за последние три недели срывается уже ${recent.length} ${plural(recent.length,"раз","раза","раз")}. Давай разберёмся, что мешает, и я подстрою план:`,
      [act("Не хватает времени", {op:"why", cat, r:"time"}), act("Не хочется именно это", {op:"why", cat, r:"mood"}),
       act(days.length <= 2 ? `Неудобно ${days.map(d => DACC[d].replace(/^во? /, "")).join(" и ")}` : "Неудобные дни или время", {op:"why", cat, r:"slot", days}),
       act("Сил не хватает", {op:"why", cat, r:"tired"}), act("Всё ок, так совпало", {op:"keep"})], {kind:"why"});
  }
}
function nextPlanned(cat){ const ck = curKey(), ti = todayI();
  for(const key of [ck, iso(addDays(new Date(ck+"T00:00:00"), 7))]){ const w = getWeek(key); const it = w.items.filter(i => i.cat === cat && !i.done && (key !== ck || i.day >= ti)).sort((a,b) => a.day - b.day)[0]; if(it) return {key, it}; }
  return null; }
function whyAnswer(a){
  const cat = a.cat, nx = nextPlanned(cat), sameType = RITM.CATALOG.filter(e => e.t === cat);
  if(a.r === "time"){
    const short = sameType.filter(e => e.m && e.m >= 12 && e.m <= 25).sort((x,y) => Math.abs(x.m - 20) - Math.abs(y.m - 20))[0] || {n:`${CATS[cat].n}, 15 минут`, m:15};
    settings.shortCats = [...new Set([...(settings.shortCats||[]), cat])]; persistSettings();
    return {text:`Понял. Лучше коротко, но регулярно: вместо полноценной тренировки буду предлагать короткую версию, например «${short.n}». Это больше, чем ноль.`,
      acts: nx ? [act(`Заменить ближайшую на «${short.n}»`, {op:"swap", key:nx.key, id:nx.it.id, type:cat, name:short.n, t:nx.it.t}), act("Пока оставить", {op:"keep"})] : null};
  }
  if(a.r === "mood"){
    const grp = CATS[cat].move ? Object.keys(CATS).filter(c => CATS[c].move && c !== cat && c !== "walk") : Object.keys(CATS).filter(c => CATS[c].grp === CATS[cat].grp && c !== cat);
    const skipsBy = c => (LS.get("skips")||[]).filter(x => x.cat === c).length;
    const alts = shuffled(RITM.CATALOG.filter(e => grp.includes(e.t) && skipsBy(e.t) < 2 && e.m && e.m <= 60), Date.now() % 991).slice(0, 3);
    return {text:"Тогда не будем заставлять. Можно заменить на что-то другое с похожей пользой. Что ближе?",
      acts: nx ? alts.map(e => act(e.n, {op:"swap", key:nx.key, id:nx.it.id, type:e.t, name:e.n, t:nx.it.t})).concat([act("Оставить как есть", {op:"keep"})]) : null};
  }
  if(a.r === "slot"){
    const days = a.days || []; const av = settings.avoidDays || {}; av[cat] = [...new Set([...(av[cat]||[]), ...days])].filter(d => d >= 0 && d <= 6); settings.avoidDays = av; persistSettings();
    const acts = [];
    if(nx && av[cat].includes(nx.it.day)){ const from = nx.key === curKey() ? todayI() : 0; const bd = bestDayInWeek(nx.key, cat, from, nx.it.day); if(bd >= 0) acts.push(act(`Перенести ближайшую ${DACC[bd]}`, {op:"move", key:nx.key, id:nx.it.id, day:bd, t:nx.it.t})); }
    return {text: days.length ? `Учту: «${CATS[cat].full.toLowerCase()}» больше не ставлю ${days.map(d => DACC[d]).join(" и ")}. Если удобнее определённое время, напиши, например: «силовую лучше по утрам».` : "Понял. Напиши, какие дни или время удобнее, например «силовую лучше в выходные утром».", acts: acts.length ? acts.concat([act("Не надо", {op:"keep"})]) : null};
  }
  if(a.r === "tired"){
    const g = settings.goals[cat] || 0;
    return {text:"Тогда сначала силы, потом нагрузка. Помогают сон по твоей норме и лёгкие дни между тяжёлыми. Могу уменьшить цель или заменить ближайшую тренировку на лёгкую.",
      acts: [g > 1 ? act(`Цель ${g - 1} в неделю вместо ${g}`, {op:"goal", c:cat, to:g - 1}) : null, nx ? act("Ближайшую сделать лёгкой (растяжка)", {op:"swap", key:nx.key, id:nx.it.id, type:"mobility", name:"Лёгкая растяжка, 20 минут", t:nx.it.t}) : null, act("Пока ничего", {op:"keep"})].filter(Boolean)};
  }
  return {text:"Понял."};
}

/* ---------- журнал непонятого ---------- */
function noteMiss(text, why){
  const t = String(text||"").trim(); if(!t) return;
  const arr = (LS.get("misses") || []).filter(x => x.text !== t);
  arr.push({at:Date.now(), text:t, why:why||"unknown"}); LS.set("misses", arr.slice(-60));
}
function dropMiss(text){ const t = String(text||"").trim(); LS.set("misses", (LS.get("misses") || []).filter(x => x.text !== t && !t.includes(x.text) && !x.text.includes(t))); }

const proteinFor = kg => Math.max(60, Math.min(250, Math.round(kg * 1.4 / 10) * 10));
function profileStatement(s, text){
  let said = [];
  const h = /(?:^| )рост (?:у меня )?(\d{3})(?: см)?(?: |$)|(?:^| )мой рост (\d{3})/.exec(s); if(h){ const v = +(h[1]||h[2]); if(v >= 120 && v <= 230){ settings.height = v; said.push(`рост ${v} см`); } }
  const a = /(?:^| )мне (\d{2}) (?:лет|год|года) /.exec(s); if(a){ const v = +a[1]; if(v >= 12 && v <= 100){ settings.age = v; said.push(`возраст ${v}`); } }
  if(/ я (мужчина|парень|мужик) /.test(s)){ settings.sex = "m"; said.push("пол мужской"); }
  else if(/ я (женщина|девушка) /.test(s)){ settings.sex = "f"; said.push("пол женский"); }
  const w = /(?:^| )(?:я )?вешу (\d{2,3})/.exec(s); if(w){ const m = setWeight(+w[1]); said.push(`вес ${w[1]} кг`); }
  if(!said.length) return false;
  persistSettings(); render();
  const tg = kbjuTarget();
  bot("Запомнил: " + said.join(", ") + "." + (tg ? ` Ориентир по калориям на поддержание веса: около ${fmtNum(tg.kcal)} ккал в день (Б ${tg.protein} · Ж ${tg.fat} · У ${tg.carbs} г). Это оценка по формуле Миффлина — Сан Жеора, не диета.` : " Для нормы калорий нужны ещё вес, рост, возраст и пол."));
  return true;
}
function foodStatement(text, s, pre){
  if(!RITM.looksLikeFood(text)) return false;
  const items = RITM.parseFood(text); if(!items.length) return false;
  const off = /вчера/.test(s) ? -1 : 0, date = addDays(new Date(), off), k = dateKeyOf(date), d = dayIdxOf(date);
  const tm = (/(?:в|около) (\d{1,2})[:.](\d{2})/.exec(s) || []); const time = tm[1] ? pad(+tm[1]) + ":" + tm[2] : (off ? "" : nowHM());
  const ids = [];
  mutateQuiet(k, w => { const day = w.days[d] = {...(w.days[d]||{})}; day.log = (day.log||[]).slice();
    for(const it of items){ const rec = {id:uid(), type: it.cat || "meal", name: it.food, time, text: it.label, src:"chat", srv:1, kcal: it.kcal, p: it.p, f: it.f, c: it.c, grams: it.grams}; day.log.push(rec); ids.push(rec.id); } });
  rememberLastLog(k, d, ids);
  const tot = items.reduce((a, x) => ({k:a.k+x.kcal, p:a.p+x.p, f:a.f+x.f, c:a.c+x.c}), {k:0,p:0,f:0,c:0});
  const day = intakeOf(((getWeek(k).days[d]||{}).log)||[]), tg = kbjuTarget();
  render();
  bot(`Записал: ${items.map(x => x.label).join(", ")}. Это примерно ${tot.k} ккал (Б ${Math.round(tot.p)} · Ж ${Math.round(tot.f)} · У ${Math.round(tot.c)} г).` + (off ? "" : ` За день уже ${fmtNum(day.kcal)} ккал${tg ? " из ~"+fmtNum(tg.kcal) : ""}.`) + " Порции и значения приблизительные: если съели другое количество, напишите граммы (например «150 г гречки»).",
    [act("Убрать запись", {op:"unlogIds", key:k, d, ids})]);
  return true;
}
function setWeight(kg){ settings.weight = kg; settings.proteinGoal = proteinFor(kg); persistSettings(); const r = getRoutine(); r.asked.weight = true; saveRoutine(r); return `Вес ${kg} кг. Норму белка поставил ${settings.proteinGoal} г в день: 1,4 г на килограмм, как рекомендуют при силовых тренировках (диапазон 1,4–2,0).`; }
function setBedtime(hm){
  settings.bedtime = hm;
  if(!settings.cafManual) settings.caffeineCutoff = cafCutoffFor(hm);
  const b = toMinHM(hm), bb = b < 6*60 ? b + 1440 : b, o = toMinHM(settings.screensOff || "22:30"), oo = o < 6*60 ? o + 1440 : o;
  if(oo > bb - 60) settings.screensOff = fromMin(bb - 60);
  persistSettings();
  const r = getRoutine(); r.bedSet = true; r.asked.bed = true; saveRoutine(r);
  lastReviewSync = ""; try{ syncNative(); }catch(e){}
}
function planIssues(date){
  const key = dateKeyOf(date), d = dayIdxOf(date), w = getWeek(key), out = [];
  const its = w.items.filter(i => i.day===d && !i.done);
  const bed = toMinHM(usualBedtime().hm), bedM = bed < 6*60 ? bed + 1440 : bed;
  const off = Math.min(bedM - 60, (o => o < 6*60 ? o + 1440 : o)(toMinHM(settings.screensOff || "22:30")));
  const wake = toMinHM(wakeFor(d));
  const isToday = key === curKey() && d === todayI(), nowM = toMinHM(nowHM());
  for(const it of its){
    if(!it.time) continue; let t = toMinHM(it.time); if(t < 5*60) t += 1440;
    if(isToday && t < nowM) continue;
    const dur = Math.min(defaultMin(it), 120);
    if(t >= bedM - 15) out.push({it, why:`стоит на ${it.time}, а ложишься ты в ${usualBedtime().hm}`});
    else if(isScreen(it.cat) && t + Math.min(dur, 60) > off) out.push({it, why:`экраны в ${it.time} — это меньше чем за час до сна (отбой в ${usualBedtime().hm}), заснуть будет труднее`});
    else if(MAJOR.has(it.cat) && t + dur > bedM - 90) out.push({it, why:`тренировка в ${it.time} слишком близко ко сну (отбой в ${usualBedtime().hm}), пульс не успеет успокоиться`});
    else if(t < wake) out.push({it, why:`стоит раньше, чем ты встаёшь (${wakeFor(d)})`});
    else if(busyAt(d, it.time) && !["social","chores","work","walk"].includes(it.cat)) out.push({it, why:`в ${it.time} ты обычно на работе`});
  }
  const maj = its.filter(i => MAJOR.has(i.cat));
  if(maj.length >= 2 && !out.some(x => x.it.id === maj[1].id)) out.push({it:maj[1], why:`в этот день уже есть «${maj[0].t}», две тренировки — многовато`, dbl:true});
  return out.map(x => ({...x, key, d}));
}
function freeSlot(key, d, dur, before, notBefore, selfId){
  const w = getWeek(key), times = w.items.filter(i => i.day===d && i.time && i.id !== selfId).map(i => { const t = toMinHM(i.time); return t < 5*60 ? t + 1440 : t; });
  const nowM = key === curKey() && d === todayI() ? toMinHM(nowHM()) + 30 : 0;
  for(let st = Math.floor((before - dur)/15)*15; st >= Math.max(notBefore, nowM); st -= 15) if(times.every(t => Math.abs(t - st) >= 60)) return fromMin(st);
  return null;
}
function issueActions(x){
  const it = x.it, acts = [], r = getRoutine();
  const bed = toMinHM(usualBedtime().hm), bedM = bed < 6*60 ? bed + 1440 : bed;
  const off = Math.min(bedM - 60, (o => o < 6*60 ? o + 1440 : o)(toMinHM(settings.screensOff || "22:30")));
  let notBefore = toMinHM(wakeFor(x.d)) + 30;
  if(r.work && isWorkDay(x.d) && !r.noWork) notBefore = Math.max(notBefore, toMinHM(r.work.to) + (r.commute||0));
  const dur = Math.min(defaultMin(it), 90);
  const limit = isScreen(it.cat) ? off : MAJOR.has(it.cat) ? bedM - 90 : bedM - 30;
  if(!x.dbl){ const slot = freeSlot(x.key, x.d, dur, limit, notBefore, it.id); if(slot) acts.push(act(`Перенести на ${slot}`, {op:"time", key:x.key, id:it.id, time:slot, t:it.t})); }
  const from = x.key === curKey() ? Math.max(todayI(), x.d === todayI() ? todayI() + 1 : todayI()) : 0;
  const bd = bestDayInWeek(x.key, it.cat, from, x.d);
  if(bd >= 0) acts.push(act(`Перенести ${DACC[bd]}`, {op:"move", key:x.key, id:it.id, day:bd, t:it.t}));
  acts.push(act("Убрать из плана", {op:"remove", key:x.key, id:it.id, t:it.t}), act("Оставить", {op:"keep"}));
  return acts;
}
function postIssues(dates, max){
  let n = 0;
  for(const dt of dates) for(const x of planIssues(dt)){
    if(n >= (max||3)) return n;
    const msg = `«${x.it.t}» ${whenWord(dt)}: ${x.why}. Что сделать?`;
    if(getChat().slice(-15).some(m => m.who === "bot" && m.text === msg && m.chosen == null)){ n++; continue; }   // такой вопрос уже висит
    bot(msg, issueActions(x)); n++;
  }
  return n;
}
function showPlan(date){
  bot(planText(date));
  const n = postIssues([date], 3);
  if(!n){ const w = getWeek(dateKeyOf(date)), d = dayIdxOf(date); if(w.items.some(i=>i.day===d && !i.done)) bot("Если что-то поменялось, просто напиши, например: «сегодня вместо силовой бассейн в 18» или «перенеси игры на 19:30»."); }
}
const restOfWeek = () => { const out = []; const t = new Date(); t.setHours(0,0,0,0); for(let i=0;i<7;i++){ const d = addDays(t,i); out.push(d); if(dayIdxOf(d) === 6) break; } return out; };
function findPlanned(q){
  const qs = nrm(q), type = RITM.guessType(q), ck = curKey(), ti = todayI();
  const keys = [ck, iso(addDays(new Date(ck+"T00:00:00"),7))];
  for(const key of keys){ const w = getWeek(key); const from = key === ck ? ti : 0;
    const it = w.items.filter(i => i.day >= from && !i.done).sort((a,b)=>a.day-b.day).find(i => (type && i.cat === type) || nrm(i.t).includes(qs.trim()));
    if(it) return {key, it}; }
  return null;
}
function moveCommand(what, where){
  const f = findPlanned(what); if(!f) return bot(`Не нашёл в плане «${what.trim()}». Напиши точнее или посмотри вкладку «Неделя».`);
  const date = dayFromText(" " + where + " ") || dayFromText(" в " + where + " ");
  if(!date) return bot("Не понял, на какой день. Например: «перенеси силовую на четверг».");
  const tm = /(\d{1,2})(?:[:.](\d{2}))?/.exec(where);
  const key = dateKeyOf(date), d = dayIdxOf(date);
  mutateQuiet(f.key, w => { w.items = w.items.filter(x=>x.id!==f.it.id); });
  mutateQuiet(key, w => { w.items.push({...f.it, day:d, time: tm && /в\s*\d/.test(where) ? pad(+tm[1])+":"+pad(+(tm[2]||0)) : f.it.time}); });
  bot(`Перенёс «${f.it.t}» на ${whenWord(date)}.`);
}
function removeCommand(what){
  const f = findPlanned(what); if(!f) return bot(`Не нашёл в плане «${what.trim()}».`);
  bot(`Убрать «${f.it.t}» (${DACC[f.it.day]}) из плана?`, [act("Да, убрать", {op:"remove", key:f.key, id:f.it.id, t:f.it.t}), act("Нет", {op:"keep"})]);
}
const HELP_TEXT = "Пиши мне обычными словами:\n• что сделал: «прогулка 40 минут», «выпил кофе в 9:30 и в 11:30», «два скупа протеина с водой»\n• что планируешь: «сегодня бассейн в 18», «завтра силовая вечером»\n• вопросы: «что сегодня?», «что завтра?», «как неделя?», «сколько воды?»\n• правки: «перенеси силовую на четверг», «убери кино»\n• «разбор» — итоги дня с советами\n• о себе: «я работаю пн–пт с 9 до 18», «по субботам футбол в 12», «что ты обо мне знаешь?»\n• самочувствие: «устал», «не выспался», «болит спина», «заболел» — подстрою план\n• поправки: «не 30, а 45 минут», «это было вчера», «удали последнее»\n• когда: «через 2 дня», «в выходные», «на следующей неделе», «до обеда», «после ужина», «по вторникам и четвергам», «каждый день», «через день»\n• ответы на мои вопросы о плане: «нет, давай завтра», «лучше в 20:30», «сделал», «не получится»\n• если я что-то не так понял, нажми «Это не занятие», и я запомню. Всё непонятое собирается в «Ещё» → «Что я не понял»\n• выводы: «что ты заметил?», «отчёт», «что я пропускаю?», «составь план»\n• «пиши реже», «пиши чаще», «не пиши сегодня»\nЕсли слишком долго сижу в ленте или играх, я напомню о перерыве. Ответь «по работе», и я отстану, или «ладно, выключаю», и я проверю через 15 минут.\nДнём я иногда буду спрашивать, как дела, но только когда ты не спишь.";

// ---------- check-ins: messages from Ritm during the day ----------
function wakeTime(){
  const t = new Date(), w = [];
  for(let i=0;i<7;i++){ const s = sleepFor(iso(addDays(t,-i))); if(s) w.push(+s.end.slice(0,2)*60 + +s.end.slice(3,5)); }
  if(w.length >= 3){ w.sort((a,b)=>a-b); const m = w[Math.floor(w.length/2)]; return pad(Math.floor(m/60))+":"+pad(m%60); }
  return settings.wake || "08:00";
}
const toMinHM = t => +t.slice(0,2)*60 + +t.slice(3,5);
const fromMin = m => pad(Math.floor(((m%1440)+1440)%1440/60))+":"+pad(((m%60)+60)%60);
const CI_KINDS = new Set(["morning","lunch","before","after","doing","work","water","evening","afterwork"]);
const ciStats = () => LS.get("ciStats") || {};
function ciRate(h){ const x = ciStats()[h] || {sent:0, ans:0}; return {sent:x.sent, ans:x.ans, rate:(x.ans + 0.6) / (x.sent + 1)}; }
function ciNoteFired(f){ if(!CI_KINDS.has(f.kind)) return; const h = new Date(f.firedAt || f.at).getHours(), st = ciStats(); st[h] = st[h] || {sent:0, ans:0}; st[h].sent++; LS.set("ciStats", st); LS.set("lastCi", {at:f.firedAt || f.at, h, answered:false}); }
function ciNoteAnswer(){ const lc = LS.get("lastCi"); if(!lc || lc.answered || Date.now() - lc.at > 45*60000) return; const st = ciStats(); st[lc.h] = st[lc.h] || {sent:1, ans:0}; st[lc.h].ans++; lc.answered = true; LS.set("ciStats", st); LS.set("lastCi", lc); }
function bestHours(){ return Object.entries(ciStats()).filter(([,x]) => x.sent >= 3).map(([h,x]) => [+h, (x.ans + 0.6)/(x.sent + 1)]).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([h])=>h).sort((a,b)=>a-b); }
function buildCheckins(){
  const freq = settings.checkins ?? 5; if(!freq) return [];
  if(settings.ciPauseUntil && Date.now() < settings.ciPauseUntil) return [];
  const out = [], now = Date.now(), r = getRoutine();
  for(let off = 0; off < 3; off++){
    const date = addDays(new Date(), off); date.setHours(0,0,0,0);
    const key = dateKeyOf(date), d = dayIdxOf(date), w = getWeek(key);
    const its = w.items.filter(i=>i.day===d && !i.done).sort((a,b)=>(a.time||"99").localeCompare(b.time||"99"));
    const wake = toMinHM(wakeFor(d)), bed = bedMin(usualBedtime().hm) % 1440 || 1410, end = (bed < 6*60 ? bed + 1440 : bed) - 60;
    const jit = n => (hash(iso(date)+n) % 21) - 10;
    const slots = [];
    const planLine = its.length ? "Сегодня в плане: " + its.slice(0,3).map(i => (i.time ? i.time+" " : "") + lc(i.t)).join(", ") + "." : "В плане сегодня пусто. Чем займёмся?";
    slots.push({m: wake + 45 + jit("m"), kind:"morning", title:"Доброе утро!", text: planLine + " Как спалось?", fixed:true});
    const lunch = toMinHM(r.lunch || settings.lunch || "13:00");
    if(freq >= 2) slots.push({m: lunch + jit("l"), kind:"lunch", title:"Время обеда", text: pick(["Пора пообедать. Что будет на обед?","Обеденное время! Что сегодня на обед?","Не забудь пообедать. Что ешь сегодня?"]), fixed:true});
    if(freq >= 2) for(const i of its.filter(i=>i.time && CATS[i.cat] && (CATS[i.cat].move || CATS[i.cat].grp==="social")).slice(0,3))
      slots.push({m: toMinHM(i.time) - 60, kind:"before", title:`Через час: ${lc(i.t)}`, text:`В ${i.time} по плану «${i.t}». Всё в силе? Если планы поменялись, напиши.`, fixed:true});
    if(freq >= 2) for(const i of its.filter(i=>i.time && CATS[i.cat] && CATS[i.cat].move).slice(0,2))
      slots.push({m: toMinHM(i.time) + Math.min(defaultMin(i), 120) + 20, kind:"after", title:`Как прошло: ${lc(i.t)}?`, text:`Получилось «${i.t}»? Напиши «сделал», «не вышло» или «перенёс на завтра».`, fixed:true});
    if(d === 6) slots.push({m: 19*60 + 30, kind:"report", title:"Неделя позади!", text:"Загляни в чат: там отчёт за неделю, что я заметил и готовый план на следующую.", fixed:true});
    // живые подсказки на сегодня: мало движения, мало воды, короткая ночь
    const dyn = [];
    if(off === 0){ const tds = iso(date), stp = stepsFor(tds), Lt = intakeOf((w.days[d]||{}).log), sln = sleepFor(tds);
      if(sln && sln.min < 360) dyn.push({from:0, to:14*60, text:`Ночь была короткой (${fmtDur(sln.min)}). Сегодня без кофе после 14:00 и постарайся лечь пораньше.`});
      if(stp != null && stp < settings.stepsGoal * 0.3) dyn.push({from:15*60, to:20*60, text:`Сегодня пока мало движения: ${fmtNum(stp)} шагов. Может, прогулка 15 минут?`});
      if(Lt.water < settings.waterGoal * 0.3) dyn.push({from:12*60, to:19*60, text:`Воды сегодня пока ${Lt.water} мл. Выпей стакан прямо сейчас?`}); }
    if(freq >= 5){
      // примерно раз в час в остальное время бодрствования, с подстройкой под часы, когда ты отвечаешь
      const workEnd = r.work && isWorkDay(d) && !r.noWork ? toMinHM(r.work.to) + (r.commute||0) : null;
      for(let m = wake + 120; m <= end; m += 60){
        const at = m + jit("h" + m), h = Math.floor(((at % 1440) + 1440) % 1440 / 60);
        const st = ciRate(h);
        if(st.sent >= 4 && st.rate < 0.2){ const lastKept = slots.filter(x=>x.m < at).map(x=>x.m).sort((a,b)=>b-a)[0] || wake; if(at - lastKept < 180) continue; }
        let kind = "doing", title = "Что делаешь?", text;
        const busy = busyAt(d, fromMin(at)), waterTarget = Math.round(settings.waterGoal * Math.min(1, (at - wake) / Math.max(60, end - wake)) / 50) * 50;
        const pool = [];
        if(busy){ kind = "work"; title = "Как работа?"; pool.push("Как работа? Встань на минуту, потянись и попей воды.", "Как идёт рабочий день? Сделай паузу на пару минут: пройдись и разомни шею.", "Как дела на работе? Если сидишь давно — 2 минуты разминки помогут голове."); }
        else if(workEnd && at >= workEnd && at < workEnd + 60){ kind = "afterwork"; title = "Как прошёл день?"; pool.push("Рабочий день позади? Как прошёл? Что планируешь на вечер?", "Как день? Чем займёшься вечером?"); }
        else if(at >= end - 90){ kind = "evening"; title = "Как вечер?"; pool.push(`Как вечер? Что делаешь? Помни: экраны до ${settings.screensOff}.`, "Чем занимаешься? Скоро пора готовиться ко сну.", "Как прошёл день? Перед сном можно подвести итоги — напиши «разбор»."); }
        else { pool.push("Что делаешь?", "Чем занят?", "Как настроение? Что сейчас делаешь?", "Как идёт день?");
          if(h >= 11) { kind = "water"; pool.push(`Как с водой? К этому времени хорошо бы около ${waterTarget} мл. Сколько уже выпил?`); }
          if(h >= 15) pool.push("Как самочувствие? Может, пора размяться минут 5?"); }
        text = pool[hash(iso(date) + at) % pool.length];
        const dy = dyn.find(x => at >= x.from && at < x.to && !x.used); if(dy && !busy){ text = dy.text; dy.used = true; kind = "doing"; }
        if(kind === "water" && !/с водой/.test(text)) kind = "doing";
        slots.push({m: at, kind, title, text});
      }
    } else {
      if(freq >= 3) slots.push({m: 11*60 + jit("a"), kind:"doing", title:"Как дела?", text: pick(["Что делаешь?","Чем занят?","Как идёт день?"]) + " Не забывай про воду."});
      if(freq >= 3) slots.push({m: 16*60 + 30 + jit("b"), kind:"doing", title:"Что делаешь?", text: pick(["Как проходит день? Что делаешь?","Чем занимаешься? Может, пора размяться минут 5?"])});
      if(freq >= 4) slots.push({m: 19*60 + 30 + jit("c"), kind:"doing", title:"Как вечер?", text: "Как вечер? Что делаешь?"});
    }
    slots.sort((a,b) => (b.fixed?1:0) - (a.fixed?1:0) || a.m - b.m);
    for(const sl of slots){
      if(sl.m < wake + 30 || sl.m > end) continue;
      if(sl.kind === "doing" && busyAt(d, fromMin(sl.m))){ sl.kind = "work"; sl.title = "Как работа?"; sl.text = "Как работа? Не забывай раз в час вставать и пить воду."; }
      const at = date.getTime() + sl.m*60000; if(at < now + 60000) continue;
      if(out.some(x => Math.abs(x.at - at) < 40*60000)) continue;
      out.push({id: iso(date)+"-"+sl.kind+"-"+sl.m, at, title:sl.title, text:sl.text, kind:sl.kind});
    }
  }
  return out.sort((a,b)=>a.at-b.at);
}
let lastCheckinSync = "";
function syncCheckins(){
  if(!NATIVE || !NATIVE.setCheckins) return;
  const list = settings.notify ? buildCheckins() : [];
  const s = JSON.stringify(list.map(x=>({...x, text:x.text.replace(/Как спалось\?|Что будет на обед\?|Что делаешь\?/g, m=>m)})));
  if(s !== lastCheckinSync){ lastCheckinSync = s; try{ NATIVE.setCheckins(s); }catch(e){} }
}
function pullNative(){
  if(!NATIVE) return;
  let fired = [], inbox = [];
  try{ fired = JSON.parse(NATIVE.consumeFired() || "[]"); }catch(e){}
  try{ inbox = JSON.parse(NATIVE.consumeInbox() || "[]"); }catch(e){}
  const all = fired.map(f => ({t:f.firedAt || f.at, f})).concat(inbox.map(m => ({t:m.at, m}))).sort((a,b)=>a.t-b.t);
  for(const x of all){
    if(x.f){ let ref = null; const tm = /«(.+?)»/.exec(x.f.text || "");
      if(tm && /^(before|after)$/.test(x.f.kind)){ const fd = new Date(x.t), fk = dateKeyOf(fd), fdi = dayIdxOf(fd), it = getWeek(fk).items.find(i => i.day === fdi && i.t === tm[1]); if(it) ref = {key:fk, id:it.id}; }
      pushMsg({who:"bot", text:x.f.text, kind:x.f.kind, at:x.t, ...(ref ? {ref} : {})}); ciNoteFired(x.f); }
    else { pushMsg({who:"me", text:x.m.text, at:x.m.at}); if(x.m.ctx !== "nudge") handleUser(x.m.text, false); }
  }
  if(all.length) render();
}

// ---------- chat screen ----------
function fmtTime(ms){ const d = new Date(ms); const t = new Date(); const same = d.toDateString() === t.toDateString(); return (same ? "" : d.getDate() + " " + MON[d.getMonth()] + ", ") + pad(d.getHours()) + ":" + pad(d.getMinutes()); }
function renderChat(){
  $("subtitle").textContent = "Пиши как другу: что делал и что планируешь";
  let arr = getChat();
  if(!arr.length){ bot("Привет! Я Ритм. Пиши мне обычными словами, что делал или что планируешь. Например: «выпил кофе в 9:30», «сегодня бассейн в 18», «что сегодня?». Я всё запишу, подскажу и днём иногда буду спрашивать, как дела.", [act("Что я умею", {op:"help"})]); arr = getChat(); }
  const view = arr.slice(-120);
  let html = "", lastDay = "";
  for(const m of view){
    const dd = new Date(m.at).toDateString();
    if(dd !== lastDay){ lastDay = dd; const d = new Date(m.at); html += `<div class="cday">${dd === new Date().toDateString() ? "Сегодня" : d.getDate()+" "+MONG[d.getMonth()]}</div>`; }
    html += `<div class="msg ${m.who}"><div class="bub">${esc(m.text).replace(/\n/g,"<br>")}</div>`;
    if(m.acts && m.acts.length) html += `<div class="macts">${m.acts.map((a,i) => m.chosen != null ? (i === m.chosen ? `<span class="chosen">${esc(a.l)}</span>` : "") : `<button class="btn" data-ma="${m.id}" data-mi="${i}">${esc(a.l)}</button>`).join("")}</div>`;
    html += `<span class="mt">${fmtTime(m.at)}</span></div>`;
  }
  $("chatLog").innerHTML = html;
  $("chatQuick").innerHTML = ["Что сегодня?","+ стакан воды","Что завтра?","Как неделя?","Разбор"].map(q => `<button class="chip" data-cq="${q}">${q}</button>`).join("");
}
function scrollChat(){ if(tab === "chat") requestAnimationFrame(() => window.scrollTo({top: document.body.scrollHeight})); }
function sendChat(text){ handleUser(text); }
function chatClick(ds){
  if(ds.ma){ const arr = getChat(), m = arr.find(x=>x.id===ds.ma); const a = m && m.acts[+ds.mi] && m.acts[+ds.mi].a;
    if(a && a.op === "help"){ m.chosen = +ds.mi; saveChat(arr); bot(HELP_TEXT); render(); scrollChat(); return true; }
    runAction(ds.ma, +ds.mi); return true; }
  if(ds.cq){
    if(ds.cq === "+ стакан воды"){ pushMsg({who:"me", text:"+ стакан воды"}); quickWater(250); bot(commentFor({type:"water"})); render(); scrollChat(); return true; }
    if(ds.cq === "Разбор"){ openReview(); return true; }
    sendChat(ds.cq); return true;
  }
  return false;
}

/* ---------- understanding layer: feelings, corrections, questions, small talk ---------- */
function parserCtx(){
  const r = getRoutine();
  RITM.ctx = {now:nowHM(), workEnd: r.work && !r.noWork && isWorkDay(todayI()) ? r.work.to : null, workStart: r.work && !r.noWork ? r.work.from : null, commute: r.commute||0, lunch: r.lunch || settings.lunch || "13:30", bed: usualBedtime().hm, wake: wakeFor(todayI())};
}
const CRISIS_TEXT = "Мне очень жаль, что тебе сейчас так тяжело. Ты не один, и с этим не нужно справляться в одиночку. Пожалуйста, поговори с кем-то прямо сейчас: с близким человеком или на телефоне доверия в своей стране. Если есть риск, что ты можешь причинить себе вред, звони 112 — это бесплатно. Я здесь и готов слушать: расскажешь, что случилось?";
function setDayState(patch){
  const k = curKey(), d = todayI();
  mutateQuiet(k, w => { const day = w.days[d] = {...(w.days[d]||{})};
    for(const [f, v] of Object.entries(patch)){ if(f === "states") day.states = (day.states||[]).concat(v.map(x => ({k:x, at:nowHM()}))); else if(f === "energy" || f === "mood"){ if(day[f] == null || (v <= 2 ? day[f] > v : day[f] < v)) day[f] = v; } else day[f] = v; } });
}
function upcomingMajor(days){
  const out = [], base = new Date(); base.setHours(0,0,0,0);
  for(let i=0;i<days;i++){ const dt = addDays(base, i), key = dateKeyOf(dt), d = dayIdxOf(dt);
    for(const it of getWeek(key).items.filter(x => x.day===d && !x.done && MAJOR.has(x.cat))) if(i > 0 || !it.time || it.time > nowHM()) out.push({key, it, dt}); }
  return out;
}
function lightenActs(maxN){
  const acts = [];
  for(const u of upcomingMajor(1).slice(0, maxN||1)){
    const bd = bestDayInWeek(u.key, u.it.cat, Math.min(6, dayIdxOf(u.dt)+2), dayIdxOf(u.dt));
    if(bd >= 0) acts.push(act(`Перенести «${u.it.t}» ${DACC[bd]}`, {op:"move", key:u.key, id:u.it.id, day:bd, t:u.it.t}));
    acts.push(act(`Заменить на лёгкую прогулку`, {op:"swap", key:u.key, id:u.it.id, type:"walk", name:"Лёгкая прогулка, 20 мин", t:u.it.t}));
  }
  return acts;
}
function earlyBedAct(){ const t = hmMinus(usualBedtime().hm, 30); return act(`Лечь сегодня в ${t}`, {op:"addToday", cat:"unplug", name:"Лечь пораньше, без экрана", time:t}); }

function handleStates(states){
  const msgs = [], acts = [];
  const has = k => states.find(x => x.k === k);
  const h = new Date().getHours();
  setDayState({states: states.map(x => x.k)});
  if(has("sick")){
    setDayState({energy:2, sick:true});
    msgs.push("Выздоравливай! Пока болеешь, тренировки лучше отложить: силы нужны на восстановление. Больше воды, тёплое питьё и сон. Если температура выше 38,5 держится больше трёх дней, тяжело дышать или становится хуже — обратись к врачу.");
    if(upcomingMajor(3).length) acts.push(act("Убрать тренировки на 3 дня", {op:"clearMajor", days:3}));
  }
  const pain = has("pain");
  if(pain){
    const P = {
      head:"Головная боль часто от обезвоживания, недосыпа или долгого экрана: выпей стакан воды, сделай перерыв от телефона и выйди на воздух минут на 10. Если болит часто или очень сильно — стоит показаться врачу.",
      back:"Спину лучше не нагружать тяжёлым сегодня: мягкая растяжка и ходьба обычно помогают больше, чем покой. Если боль отдаёт в ногу, есть онемение или она не проходит неделю — к врачу.",
      neck:"Шея часто болит от телефона и сидячей работы: поднимай экран к глазам и делай лёгкие повороты головы. Тяжёлое для плеч пока отложи.",
      knee:"Колено пока лучше поберечь: без бега и прыжков. Плавание и велосипед обычно щадят суставы. Если есть отёк или боль не проходит — к врачу.",
      legs:"Ногам нужен отдых: сегодня без бега, можно спокойную прогулку и растяжку.",
      shoulder:"Плечо пока не нагружай жимами и подтягиваниями, можно ноги и кор.",
      stomach:"Сегодня лучше лёгкая еда и вода. Если боль сильная, с температурой или не проходит — обратись к врачу.",
      throat:"Тёплое питьё и отдых. Если горло болит сильно, с высокой температурой или больше пары дней — к врачу.",
      tooth:"С зубной болью лучше не тянуть: запишись к стоматологу.",
      muscles:"Если мышцы болят через день-два после тренировки, это нормальная крепатура: помогут ходьба, растяжка и сон.",
      eyes:"Глазам нужен перерыв от экрана: правило 20-20-20 — каждые 20 минут смотри 20 секунд вдаль."
    };
    msgs.push(P[pain.place] || "Сочувствую. Если боль сильная или не проходит — лучше показаться врачу. Нагрузку сегодня стоит снизить.");
    if(["back","knee","legs","shoulder","neck"].includes(pain.place)) for(const u of upcomingMajor(2).slice(0,1)){
      const to = pain.place === "knee" || pain.place === "legs" ? "swim" : "mobility";
      acts.push(act(`Заменить «${u.it.t}» на ${to === "swim" ? "плавание" : "растяжку"}`, {op:"swap", key:u.key, id:u.it.id, type:to, name: to === "swim" ? "Спокойное плавание" : "Растяжка", t:u.it.t}));
    }
  }
  if(has("hangover")){ setDayState({energy:2}); msgs.push("Сегодня главное — вода, лёгкая еда и сон. Интенсивную тренировку лучше перенести, а вот спокойная прогулка поможет."); acts.push(...lightenActs(1)); }
  if(has("badsleep")){ setDayState({energy:2, sleep:false});
    msgs.push("Сочувствую. После плохой ночи не налегай на кофеин после 14:00, а вечером постарайся лечь на 30–60 минут раньше. Короткий дневной сон до 20 минут тоже ок."); acts.push(earlyBedAct()); if(h < 17) acts.push(...lightenActs(1)); }
  else if(has("tired")){ setDayState({energy:2});
    msgs.push(h >= 19 ? "Понимаю, день был длинный. Сегодня лучше без экрана перед сном и лечь пораньше." : "Понимаю. 10–15 минут на свежем воздухе и стакан воды часто бодрят лучше, чем ещё один кофе.");
    acts.push(...lightenActs(1)); if(h >= 17) acts.push(earlyBedAct()); }
  if(has("stress")){ setDayState({stress:4});
    msgs.push("Похоже, сейчас напряжённо. Попробуй дыхание: вдох на 4 счёта, выдох на 6, пять минут. И короткая прогулка без телефона хорошо сбивает стресс.");
    if(!getWeek(curKey()).items.some(i => i.day===todayI() && i.cat==="walk" && !i.done)) acts.push(act("Добавить прогулку 15 минут", {op:"addToday", cat:"walk", name:"Прогулка без телефона, 15 мин", time:""}));
    acts.push(act("Добавить дыхание перед сном", {op:"addToday", cat:"relax", name:"Дыхание перед сном", time:hmMinus(usualBedtime().hm, 20)})); }
  if(has("sad")){ setDayState({mood:2});
    msgs.push("Мне жаль, что тебе сейчас так. Что обычно помогает: поговорить с кем-то близким, выйти на свет и немного подвигаться, сделать маленькую приятную вещь. Если такое состояние тянется неделями, стоит поговорить со специалистом — это нормально.");
    acts.push(act("Позвонить близкому сегодня", {op:"addToday", cat:"social", name:"Позвонить близкому", time:""})); }
  if(has("good")){ setDayState({mood:4, energy:4});
    const next = getWeek(curKey()).items.find(i => i.day===todayI() && !i.done && (!i.time || i.time > nowHM()));
    msgs.push(pick(["Отлично! Так держать.","Классно это слышать!","Супер!"]) + (next ? ` Хороший день, чтобы сделать «${next.t}».` : "")); }
  if(has("hungry")){ const L = intakeOf((getWeek(curKey()).days[todayI()]||{}).log), left = settings.proteinGoal - L.protein;
    msgs.push(h >= 21 ? "Если поздно, лучше что-то лёгкое: кефир, творог, яйцо или овощи." : left > 30 ? `Белка сегодня пока ${L.protein} из ${settings.proteinGoal} г — хорошо бы что-то с белком: мясо, рыба, яйца, творог или бобовые.` : "Самое время поесть. Напиши потом, что было, я запишу."); }
  if(has("thirsty")) { msgs.push("Попей воды!"); acts.push(act("+ стакан воды", {op:"water", ml:250})); }
  if(has("bored")){ const ideas = shuffled(ideasAll().filter(i => ideaFits(i, todayI(), h)), Date.now() % 997).slice(0, 2);
    msgs.push("Есть пара идей:" + ideas.map(i => ` «${i.t}»`).join(",") + ".");
    for(const i of ideas) acts.push(act(`Добавить «${i.t}»`, {op:"addToday", cat:i.cat, name:i.t, time:""})); }
  if(has("lazy")){ msgs.push("Знакомо. Договоримся на 5 минут: начни с самого маленького шага, а дальше как пойдёт. Обычно самое сложное — начать.");
    acts.push(act("5 минут растяжки прямо сейчас", {op:"addToday", cat:"mobility", name:"5 минут растяжки", time:nowHM()})); }
  if(has("overate")){ msgs.push("Бывает, без самобичевания. Помогает спокойная прогулка 10–15 минут и стакан воды, а следующий приём пищи сделай полегче."); }
  if(has("badsleep") || has("tired")){ const n = nightFacts(); if(n.causes.length) msgs.push("Похоже, сказалось вот что: " + n.causes.slice(0, 2).map(c => c.text).join("; ") + "." + personalLink(n.causes[0].k)); }
  if(msgs.length) bot(msgs.join("\n\n"), acts.length ? acts.concat([act("Не сейчас", {op:"keep"})]) : null, {kind:"state"});
  return msgs.length > 0;
}

// last logged batch, for corrections
function rememberLastLog(key, day, ids){ LS.set("lastLog", {key, day, ids, at:Date.now()}); }
function lastLogEntries(){
  const L = LS.get("lastLog"); if(!L || Date.now() - L.at > 24*3600*1000) return null;
  const w = getWeek(L.key), day = (w.days[L.day]||{}); const es = (day.log||[]).filter(e => L.ids.includes(e.id));
  return es.length ? {L, w, es} : null;
}
function handleCorrection(c){
  const last = lastLogEntries();
  if(c.op === "what") return bot("Что поправить? Например: «не 30, а 45 минут», «это было вчера», «это было в 18:30», «не бег, а ходьба» или «удали последнее».");
  if(!last) return bot("Не вижу свежих записей, которые можно поправить. Посмотри журнал во вкладке «Сегодня».");
  const {L} = last, names = last.es.map(e => lc(e.name)).join(", ");
  if(c.op === "undo"){
    mutateQuiet(L.key, w => { const day = w.days[L.day] = {...(w.days[L.day]||{})};
      for(const e of (day.log||[]).filter(e => L.ids.includes(e.id))) if(e.fuzzyWord) RITM.forget(e.text, e.fuzzyWord);
      for(const e of (day.log||[]).filter(e => L.ids.includes(e.id))) if(e.plan){ const it = w.items.find(i=>i.id===e.plan); if(it) it.done = false; }
      day.log = (day.log||[]).filter(e => !L.ids.includes(e.id)); });
    LS.set("lastLog", null); return bot(`Удалил: ${names}.`);
  }
  if(c.op === "day"){
    const target = addDays(new Date(), c.offset); target.setHours(0,0,0,0);
    const tk = dateKeyOf(target), td = dayIdxOf(target);
    let moved = [];
    mutateQuiet(L.key, w => { const day = w.days[L.day] = {...(w.days[L.day]||{})};
      moved = (day.log||[]).filter(e => L.ids.includes(e.id)).map(e => { if(e.plan){ const it = w.items.find(i=>i.id===e.plan); if(it) it.done = false; } const x = {...e}; delete x.plan; return x; });
      day.log = (day.log||[]).filter(e => !L.ids.includes(e.id)); });
    mutateQuiet(tk, w => { const day = w.days[td] = {...(w.days[td]||{})}; day.log = (day.log||[]).concat(moved); });
    rememberLastLog(tk, td, L.ids);
    return bot(`Перенёс на ${c.offset === -1 ? "вчера" : "позавчера"}: ${names}.`);
  }
  mutateQuiet(L.key, w => { const day = w.days[L.day]; if(!day) return;
    const es = (day.log||[]).filter(e => L.ids.includes(e.id)); const e = es[es.length-1]; if(!e) return;
    if(c.op === "time") for(const x of es) x.time = c.time;
    if(c.op === "type"){ e.type = c.type; e.name = CATS[c.type].n; RITM.remember(e.text || c.what, c.type, null); }
    if(c.op === "amount"){
      const u = c.unit || "", n = c.n;
      if(e.type === "water" || /стакан|литр|мл|^л$/.test(u)) e.ml = /литр|^л$/.test(u) ? n*1000 : /стакан/.test(u) ? n*250 : (n <= 10 && !/мл/.test(u) ? n*250 : n);
      else if(e.type === "caffeine"){ const per = (e.mg||90) / (e.srv||1); e.srv = n; e.mg = Math.round(per*n); }
      else if(e.type === "protein"){ if(/скуп|ложк/.test(u)){ e.srv = n; e.g = n*25; } else e.g = n; }
      else if(/км|километр/.test(u)) e.km = n;
      else if(TYPES[e.type] && TYPES[e.type].unit === "min") e.min = /час/.test(u) ? Math.round(n*60) : Math.round(n);
      else e.srv = n;
    }
  });
  const fresh = lastLogEntries(); const e = fresh && fresh.es[fresh.es.length-1];
  return bot(e ? `Исправил: ${lc(e.name)}${describe(e) ? " ("+describe(e)+")" : ""}.` : "Исправил.");
}

const JOKES = ["Почему штанга не ходит на вечеринки? Её всё время кто-то поднимает.","Мой план на день: проснуться. Дальше импровизация.","Пробежка утром — как будильник, только вместо кнопки «ещё 5 минут» есть только «ещё 5 километров».","Вода: 0 калорий, 100% пользы и ни одного побочного эффекта, кроме походов в туалет."];
function handleSmall(small){
  const h = new Date().getHours();
  const lastBot = getChat().filter(m=>m.who==="bot").slice(-1)[0];
  if(small.includes("yes") || small.includes("no")){
    if(lastBot && lastBot.acts && lastBot.chosen == null && Date.now() - lastBot.at < 60*60*1000){
      if(small.includes("yes")){ const i = lastBot.acts.findIndex(a => !["keep","rskip","typechoose"].includes(a.a.op)); if(i >= 0){ runAction(lastBot.id, i); return true; } }
      else { const i = lastBot.acts.findIndex(a => a.a.op === "keep" || a.a.op === "rskip" || a.a.op === "notact"); if(i >= 0){ runAction(lastBot.id, i); return true; } const arr = getChat(); const m = arr.find(x=>x.id===lastBot.id); m.chosen = -1; saveChat(arr); bot("Хорошо, не буду."); return true; }
    }
    bot(small.includes("yes") ? "Ок!" : "Понял."); return true;
  }
  if(small.includes("hello")){ const g = h < 5 ? "Не спится?" : h < 12 ? "Доброе утро!" : h < 18 ? "Привет!" : "Добрый вечер!"; bot(g + " " + planText(new Date())); return true; }
  if(small.includes("howareyou")){ bot(pick(["У меня всё отлично, слежу за твоим ритмом. А ты как? Как самочувствие?","Нормально, спасибо! А у тебя как день?"])); return true; }
  if(small.includes("who")){ bot("Я Ритм — твой помощник по режиму дня. Записываю, что ты делаешь, подсказываю, планирую неделю и напоминаю про сон, воду и перерывы. Работаю на телефоне, без интернета и без ИИ в облаке."); return true; }
  if(small.includes("thanks")){ bot(pick(["Пожалуйста!","Обращайся!","Всегда рад помочь."])); return true; }
  if(small.includes("bye")){ const rv = ((getWeek(curKey()).days[todayI()]||{}).review||{}).done;
    if(h >= 18 && !rv){ bot("Спокойной ночи! Пока не лёг, давай за две минуты подведём итоги дня?", [act("Разобрать день", {op:"review"}), act("Завтра", {op:"keep"})]); }
    else bot(pick(["Спокойной ночи! Телефон в сторону, и отдыхай.","До завтра! Хорошо выспаться."])); return true; }
  if(small.includes("praise")){ bot(pick(["Спасибо, приятно!","Стараюсь!","Это ты молодец, я только записываю."])); return true; }
  if(small.includes("insult")){ bot("Прости, если я что-то не так понял. Напиши иначе, а я запомню. Подсказки — по слову «помощь»."); return true; }
  if(small.includes("help")){ bot(HELP_TEXT); return true; }
  if(small.includes("joke")){ bot(pick(JOKES)); return true; }
  if(small.includes("weather")){ bot("Погоду я не знаю, но если на улице сухо — отличный повод прогуляться."); return true; }
  if(small.includes("love")){ bot("Взаимно! Давай заботиться о тебе вместе."); return true; }
  return false;
}

function answerTopic(topics){
  const ck = curKey(), ti = todayI(), w = getWeek(ck), L = intakeOf((w.days[ti]||{}).log), ds = dateOf(ck, ti);
  const out = [];
  for(const t of topics){
    if(t === "water"){ const left = Math.max(0, settings.waterGoal - L.water); out.push(left ? `Воды сегодня ${L.water} из ${settings.waterGoal} мл. Осталось около ${left} мл — это примерно ${Math.ceil(left/250)} ${plural(Math.ceil(left/250),"стакан","стакана","стаканов")}.` : `Воды сегодня ${L.water} мл — норма выполнена!`); }
    if(t === "caffeine") out.push(L.mg ? `Кофеина сегодня около ${L.mg} мг${L.lastCaf ? ", последний в " + L.lastCaf : ""}. ${L.mg > settings.caffeineMax ? "Это больше нормы, дальше лучше без кофе." : "В пределах нормы до " + settings.caffeineMax + " мг."}` : "Сегодня кофеина не записано.");
    if(t === "protein") out.push(`Белка сегодня ${L.protein} из ${settings.proteinGoal} г.` + (L.protein < settings.proteinGoal*0.5 && new Date().getHours() >= 15 ? " Добавь что-то белковое на ужин: мясо, рыбу, творог или яйца." : ""));
    if(t === "steps"){ const st = stepsFor(ds); out.push(st != null ? `Шагов сегодня ${fmtNum(st)} из ${fmtNum(settings.stepsGoal)}.` : "Шаги пока не видны. Подключи Health Connect в «Ещё» или напиши, например, «8000 шагов»."); }
    if(t === "sleep"){ const arr = []; for(let i=0;i<7;i++){ const s = sleepFor(iso(addDays(new Date(),-i))); if(s) arr.push(s); }
      if(!arr.length) out.push("Данных о сне пока нет. Подключи Health Connect или пиши «лёг в 23:30», «проснулся в 7:30».");
      else { const avgMin = Math.round(arr.reduce((a,s)=>a+s.min,0)/arr.length), last = arr[0]; out.push(`Прошлой ночью: ${fmtDur(last.min)} (${last.start}–${last.end}). В среднем за неделю ${fmtDur(avgMin)}.` + (sleepLow(avgMin) ? " Это меньше твоей нормы — попробуй ложиться на 30 минут раньше." : " Это в норме.")); } }
    if(t === "screen"){ const pd = typeof phoneDay === "function" ? phoneDay(ds) : null;
      out.push(pd ? `Сегодня в телефоне ${fmtDur(pd.total)}, из них развлечения ${fmtDur(pd.ent)} при лимите ${fmtDur(settings.screenLimit)}.` + (pd.apps[0] ? ` Больше всего — ${pd.apps[0].l} (${fmtDur(pd.apps[0].m)}).` : "") : (L.screen ? `По журналу экранов сегодня ${fmtDur(L.screen)}.` : "Экранное время пока не видно: разреши доступ к истории использования в «Ещё».")); }
    if(t === "week") out.push(weekText());
    if(t === "profile") out.push(routineSummary());
    if(t === "advice") out.push(adviceText());
    if(t === "plan"){ showPlan(dayFromText(lastUserText) || new Date()); }
  }
  if(out.length) bot(out.join("\n\n"));
  return out.length > 0 || topics.includes("plan");
}
let lastUserText = "";
function adviceText(){
  const ck = curKey(), ti = todayI(), w = getWeek(ck), gs = goalState(w, ti), tips = [];
  const sl = []; for(let i=0;i<7;i++){ const s = sleepTotal(iso(addDays(new Date(),-i))); if(s) sl.push(s.min); }
  if(sl.length >= 3 && sleepLow(sl.reduce((a,b)=>a+b,0)/sl.length)) tips.push("Главный рычаг сейчас — сон: в среднем меньше твоей нормы. Ложись на 30 минут раньше и убирай телефон за час до отбоя.");
  const miss = goalCats().filter(c => gs[c].deficit > 0);
  if(miss.length) tips.push(`До целей недели не хватает: ${miss.map(c => CATS[c].n.toLowerCase()).join(", ")}. Во вкладке «Неделя» это можно добавить одной кнопкой.`);
  const st = stepsFor(dateOf(ck, ti)); if(st != null && st < settings.stepsGoal*0.6) tips.push("Шагов маловато: прогулка после ужина 20–30 минут закрывает пару тысяч.");
  const pd = typeof phoneDay === "function" ? phoneDay(dateOf(ck, ti)) : null; if(pd && pd.ent > settings.screenLimit) tips.push("Развлечений в телефоне больше лимита: поставь таймер на самое затратное приложение в «Цифровом благополучии».");
  const L = intakeOf((w.days[ti]||{}).log); if(L.water && L.water < settings.waterGoal*0.5 && new Date().getHours() >= 15) tips.push("Воды пока мало: держи бутылку на виду и пей стакан с каждым приёмом пищи.");
  if(!tips.length) tips.push("Ты в хорошем ритме. Держи режим сна, двигайся каждый день хотя бы по 20–30 минут и не забывай про людей и отдых.");
  return tips.slice(0, 3).join("\n");
}

/* ---------- stage 2: personal patterns, trends, streaks, weekly report ---------- */
function dayRecord(date){
  const key = dateKeyOf(date), d = dayIdxOf(date), w = getWeek(key), day = w.days[d] || {}, ds = iso(date);
  const log = day.log || [], L = intakeOf(log), sl = sleepFor(ds), stot = sleepTotal(ds);
  const its = w.items.filter(i => i.day === d);
  const doneIts = its.filter(i => i.done);
  const rv = day.review || {};
  let moveMin = 0;
  for(const i of doneIts) if(CATS[i.cat] && CATS[i.cat].move) moveMin += (rv.entries && rv.entries[i.id] ? rv.entries[i.id].min : defaultMin(i)) || 0;
  moveMin += L.move;
  const pd = typeof phoneDay === "function" ? phoneDay(ds) : null;
  const screenEnt = pd ? pd.ent : (L.screen || null), lateScreen = pd ? pd.late : L.lateScreen;
  const lastCafM = L.lastCaf ? toMinHM(L.lastCaf) : null;
  return {
    date:ds, dow:d, past: date < new Date(new Date().setHours(0,0,0,0)),
    sleepMin: stot ? stot.min : null, bedM: sl && sl.start ? bedMin(sl.start) : null, wakeM: sl && sl.end ? toMinHM(sl.end) : null,
    energy: day.energy ?? null, mood: day.mood ?? null, stress: day.stress ?? (rv.stress ?? null), sick: !!day.sick,
    steps: stepsFor(ds), moveMin, major: doneIts.some(i => MAJOR.has(i.cat)) || log.some(e => MAJOR.has(e.type) && !e.plan),
    caf: L.mg, lateCaf: lastCafM != null ? lastCafM >= 14*60 + 30 : null, alcohol: L.alcohol > 0 ? 1 : (log.length ? 0 : null),
    water: log.length ? L.water : null, screenEnt, lateScreen: lateScreen != null ? lateScreen : null,
    planned: its.length, done: doneIts.length, reviewed: !!rv.done, hasData: !!(sl || log.length || day.energy || doneIts.length)
  };
}
// сколько у нас реальных данных: выводы и правки плана по статистике — только когда их достаточно
function startedAt(){
  if(settings.startedAt) return settings.startedAt;
  let first = null;
  for(let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if(!k || !k.startsWith("ritm:w:")) continue;
    try { const w = JSON.parse(localStorage.getItem(k)); const base = new Date(k.slice(7)+"T00:00:00");
      const ds = Object.entries(w.days||{}).filter(([d, x]) => x && ((x.log||[]).length || x.energy || x.mood || x.review)).map(([d]) => +d);
      if(w.items && w.items.some(i => i.done)) ds.push(...w.items.filter(i=>i.done).map(i=>i.day));
      if(ds.length){ const dt = addDays(base, Math.min(...ds)); if(!first || dt < first) first = dt; } } catch(e){}
  }
  const t = first || new Date(); t.setHours(0,0,0,0);
  settings.startedAt = t.getTime(); persistSettings(); return settings.startedAt;
}
const dataDays = () => Math.floor((Date.now() - startedAt()) / 86400000);
const statsReady = (min) => dataDays() >= (min || 14) && Date.now() >= (settings.statsHold || 0);
const afterStart = (key, dow) => addDays(new Date(key+"T00:00:00"), dow).getTime() >= startedAt();
function history(n){ const out = [], t = new Date(); t.setHours(0,0,0,0); for(let i = n; i >= 0; i--) out.push(dayRecord(addDays(t, -i))); return out; }
const mean = a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : null;
// сравнение «в дни, когда X» против «остальные дни» с поправкой на малую выборку
function compare(days, cond, val, minN){
  const A = [], B = [];
  for(const x of days){ const c = cond(x), v = val(x); if(c == null || v == null) continue; (c ? A : B).push(v); }
  if(A.length < (minN||3) || B.length < (minN||3)) return null;
  return {a:mean(A), b:mean(B), nA:A.length, nB:B.length, diff:mean(A) - mean(B)};
}
function personalInsights(){
  const days = history(42), next = i => days[i+1];
  const pairs = days.map((x, i) => ({x, y: next(i)})).filter(p => p.y);
  const out = [];
  const add = (score, text, kind) => out.push({score, text, kind});
  // кофеин после 14:30 → сон этой ночью
  let r = compare(pairs, p => p.x.lateCaf, p => p.y.sleepMin);
  if(r && r.diff <= -20) add(-r.diff, `В дни, когда ты пьёшь кофеин после 14:30, спишь в среднем на ${fmtDur(Math.round(-r.diff))} меньше (${r.nA} таких дней).`, "caffeine");
  r = compare(pairs, p => p.x.lateCaf, p => p.y.bedM);
  if(r && r.diff >= 20) add(r.diff, `После позднего кофе ты засыпаешь в среднем на ${fmtDur(Math.round(r.diff))} позже.`, "caffeine");
  // экраны после отбоя-часа → сон
  r = compare(pairs, p => p.x.lateScreen == null ? null : p.x.lateScreen >= 20, p => p.y.sleepMin);
  if(r && r.diff <= -20) add(-r.diff, `Когда ты сидишь в телефоне после ${settings.screensOff}, сон короче в среднем на ${fmtDur(Math.round(-r.diff))}.`, "screen");
  r = compare(pairs, p => p.x.lateScreen == null ? null : p.x.lateScreen >= 20, p => p.y.bedM);
  if(r && r.diff >= 20) add(r.diff, `Поздний телефон сдвигает твоё засыпание примерно на ${fmtDur(Math.round(r.diff))}.`, "screen");
  // алкоголь → сон и энергия на следующий день
  r = compare(pairs, p => p.x.alcohol == null ? null : p.x.alcohol > 0, p => p.y.energy);
  if(r && r.diff <= -0.5) add(-r.diff*40, `На следующий день после алкоголя твоя энергия ниже в среднем на ${(-r.diff).toFixed(1).replace(".", ",")} балла.`, "alcohol");
  r = compare(pairs, p => p.x.alcohol == null ? null : p.x.alcohol > 0, p => p.y.sleepMin);
  if(r && r.diff <= -20) add(-r.diff, `После алкоголя ты спишь в среднем на ${fmtDur(Math.round(-r.diff))} меньше.`, "alcohol");
  // сон → энергия и настроение в тот же день
  { const nd = sleepNeed(), hh = fmtDur(nd.min);
    r = compare(days, x => x.sleepMin == null ? null : x.sleepMin >= nd.min - 15, x => x.energy);
    if(r && r.diff >= 0.5) add(r.diff*40, nd.src === "data" ? `Твоя норма сна по самочувствию — около ${hh}: после таких ночей энергия выше в среднем на ${r.diff.toFixed(1).replace(".", ",")} балла (${r.nA} и ${r.nB} дней).` : `После ночей от ${hh} твоя энергия выше в среднем на ${r.diff.toFixed(1).replace(".", ",")} балла.`, "sleep");
    r = compare(days, x => x.sleepMin == null ? null : x.sleepMin >= nd.min - 15, x => x.mood);
    if(r && r.diff >= 0.5) add(r.diff*40, `Когда спишь от ${hh}, настроение лучше в среднем на ${r.diff.toFixed(1).replace(".", ",")} балла.`, "sleep");
    if(nd.src === "default" && nd.flat) add(10, "По твоим данным сон сам по себе пока мало меняет самочувствие, поэтому норму в 7 часов не навязываю. Продолжай отмечать энергию.", "sleep"); }
  // движение → энергия, настроение, сон
  r = compare(days, x => x.hasData ? x.moveMin >= 20 : null, x => x.energy);
  if(r && r.diff >= 0.5) add(r.diff*40, `В дни, когда ты двигаешься хотя бы 20 минут, энергия выше на ${r.diff.toFixed(1).replace(".", ",")} балла.`, "move");
  r = compare(days, x => x.hasData ? x.moveMin >= 20 : null, x => x.mood);
  if(r && r.diff >= 0.5) add(r.diff*40, `Движение поднимает тебе настроение: в среднем на ${r.diff.toFixed(1).replace(".", ",")} балла.`, "move");
  r = compare(pairs, p => p.x.hasData ? p.x.major : null, p => p.y.sleepMin);
  if(r && r.diff >= 20) add(r.diff, `После тренировок ты спишь на ${fmtDur(Math.round(r.diff))} дольше.`, "move");
  // шаги → настроение
  r = compare(days, x => x.steps == null ? null : x.steps >= settings.stepsGoal, x => x.mood);
  if(r && r.diff >= 0.5) add(r.diff*40, `В дни, когда ты проходишь свою норму шагов, настроение лучше на ${r.diff.toFixed(1).replace(".", ",")} балла.`, "steps");
  // много развлечений в телефоне → настроение
  r = compare(days, x => x.screenEnt == null ? null : x.screenEnt > settings.screenLimit, x => x.mood);
  if(r && r.diff <= -0.5) add(-r.diff*40, `В дни, когда развлечений в телефоне больше лимита, настроение ниже на ${(-r.diff).toFixed(1).replace(".", ",")} балла.`, "screen");
  // вода → энергия
  r = compare(days, x => x.water == null ? null : x.water >= settings.waterGoal * 0.8, x => x.energy);
  if(r && r.diff >= 0.5) add(r.diff*40, `Когда ты пьёшь достаточно воды, энергия выше на ${r.diff.toFixed(1).replace(".", ",")} балла.`, "water");
  // режим: разброс времени отбоя → энергия
  const beds = days.filter(x => x.bedM != null).map(x => x.bedM);
  if(beds.length >= 5){ const avg = mean(beds), sd = Math.sqrt(mean(beds.map(b => (b-avg)**2))); if(sd >= 50) add(sd/2, `Время отбоя у тебя гуляет примерно на ±${fmtDur(Math.round(sd))}. Ровный режим — один из самых простых способов высыпаться.`, "rhythm"); }
  return out.sort((a,b) => b.score - a.score);
}
function streaks(){
  const days = history(60).reverse(); // сегодня первым
  const run = (test, skipToday) => { let n = 0; for(let i = skipToday ? 1 : 0; i < days.length; i++){ const v = test(days[i]); if(v === null) { if(n) break; else continue; } if(!v) break; n++; } return n; };
  const out = [];
  const s1 = run(x => x.hasData ? x.moveMin >= 20 : null, true); if(s1 >= 2) out.push(`${s1} ${plural(s1,"день","дня","дней")} подряд с движением от 20 минут`);
  const s2 = run(x => x.sleepMin == null ? null : sleepEnough(x.sleepMin), false); if(s2 >= 2) out.push(`${s2} ${plural(s2,"ночь","ночи","ночей")} подряд со сном по твоей норме (от ${fmtDur(sleepNeed().min - 15)})`);
  const s3 = run(x => x.water == null ? null : x.water >= settings.waterGoal, true); if(s3 >= 2) out.push(`${s3} ${plural(s3,"день","дня","дней")} подряд норма воды`);
  const s4 = run(x => x.screenEnt == null ? null : x.screenEnt <= settings.screenLimit, true); if(s4 >= 2) out.push(`${s4} ${plural(s4,"день","дня","дней")} подряд экраны в пределах лимита`);
  const s5 = run(x => x.past || x.reviewed ? x.reviewed : null, true); if(s5 >= 2) out.push(`${s5} ${plural(s5,"разбор","разбора","разборов")} дня подряд`);
  return out;
}
// что ты пропускаешь: по типу, дню недели и времени суток
const partOf = t => !t ? "без времени" : t < "12:00" ? "утром" : t < "17:00" ? "днём" : "вечером";
function itemHistory(weeks){
  const out = [], base = mondayOf(new Date()), today = new Date(); today.setHours(0,0,0,0);
  for(let k = 0; k <= weeks; k++){ const key = iso(addDays(base, -7*k)), w = getWeek(key);
    for(const i of w.items){ const dt = addDays(new Date(key+"T00:00:00"), i.day); if(dt >= today) continue;
      const lg = Object.values(w.days||{}).flatMap(x => x.log||[]).find(e => e.plan === i.id);
      out.push({cat:i.cat, dow:i.day, time:(lg && lg.time) || i.time || "", done:!!i.done, title:i.t}); } }
  return out;
}
function skipPatterns(){
  if(!statsReady()) return [];
  const h = itemHistory(6).filter(x => goalCats().includes(x.cat) || MAJOR.has(x.cat));
  const groups = {};
  for(const x of h){ const k = x.cat + "|" + x.dow + "|" + partOf(x.time); (groups[k] = groups[k] || {cat:x.cat, dow:x.dow, part:partOf(x.time), n:0, miss:0}); groups[k].n++; if(!x.done) groups[k].miss++; }
  return Object.values(groups).filter(g => g.n >= 3 && g.miss / g.n >= 0.6).sort((a,b) => b.miss - a.miss)
    .map(g => ({...g, text:`${CATS[g.cat].full} ${DACC[g.dow]}${g.part !== "без времени" ? " " + g.part : ""}: пропущено ${g.miss} из ${g.n}.`}));
}
// когда ты реально это делаешь: лучший день недели и типичный час
function bestSlotFor(cat){
  if(!statsReady()) return null;
  const h = itemHistory(8).filter(x => x.cat === cat);
  const logs = []; const base = mondayOf(new Date());
  for(let k = 0; k <= 8; k++){ const key = iso(addDays(base, -7*k)), w = getWeek(key);
    for(const [d, day] of Object.entries(w.days||{})) for(const e of day.log||[]) if(e.type === cat && !e.plan && e.time) logs.push({dow:+d, time:e.time, done:true}); }
  const all = h.concat(logs); const done = all.filter(x => x.done);
  if(done.length < 3) return null;
  const byDow = Array.from({length:7}, (_, d) => { const xs = all.filter(x => x.dow === d); const ok = xs.filter(x => x.done).length; return {d, rate: xs.length ? (ok + 0.5)/(xs.length + 1) : 0.4, n:xs.length}; });
  const times = done.filter(x => x.time).map(x => toMinHM(x.time)).sort((a,b)=>a-b);
  return {byDow, time: times.length >= 2 ? fromMin(Math.round(times[Math.floor(times.length/2)]/15)*15) : null, n:done.length};
}
function weekNumbers(key){
  const w = getWeek(key), base = new Date(key+"T00:00:00"), recs = [];
  for(let d=0; d<7; d++){ const dt = addDays(base, d); if(dt > new Date()) break; recs.push(dayRecord(dt)); }
  const val = f => { const xs = recs.map(f).filter(v => v != null); return xs.length ? mean(xs) : null; };
  return {done: w.items.filter(i=>i.done).length, planned: w.items.length, move: recs.reduce((s,x)=>s+(x.moveMin||0),0), sleep: val(x=>x.sleepMin), screen: val(x=>x.screenEnt), steps: val(x=>x.steps), energy: val(x=>x.energy), mood: val(x=>x.mood), days: recs.length};
}
function weeklyReport(){
  const ck = curKey(), pk = iso(addDays(new Date(ck+"T00:00:00"), -7));
  const a = weekNumbers(ck), b = weekNumbers(pk), gs = goalState(getWeek(ck), 7);
  const L = [];
  L.push(`Неделя: сделано ${a.done} из ${a.planned} запланированного, движения ${fmtDur(a.move)}${b.planned ? ` (прошлая: ${b.done} из ${b.planned}, ${fmtDur(b.move)})` : ""}.`);
  const cmp = (x, y, f, better) => x == null || y == null ? "" : Math.abs(x - y) < (better === "sleep" ? 10 : 0.3) ? "" : (x > y ? "больше" : "меньше");
  if(a.sleep != null && a.days >= 3) L.push(`Сон в среднем ${fmtDur(Math.round(a.sleep))}${b.sleep != null && Math.abs(a.sleep - b.sleep) >= 10 ? ` — на ${fmtDur(Math.round(Math.abs(a.sleep-b.sleep)))} ${a.sleep > b.sleep ? "больше" : "меньше"}, чем неделей раньше` : ""}.`);
  if(a.screen != null) L.push(`Развлечения в телефоне: ${fmtDur(Math.round(a.screen))} в день${b.screen != null && Math.abs(a.screen-b.screen) >= 10 ? ` (${a.screen < b.screen ? "меньше" : "больше"} на ${fmtDur(Math.round(Math.abs(a.screen-b.screen)))})` : ""}.`);
  if(a.steps != null) L.push(`Шагов в среднем ${fmtNum(Math.round(a.steps))} в день (ориентир ${fmtNum(settings.stepsGoal)}).`);
  { const ae = aeroMinutes(getWeek(ck)); L.push(`Аэробная нагрузка: ${ae.done} из ${AERO_GOAL} минут нормы ВОЗ.`); }
  const good = goalCats().filter(c => gs[c].done >= gs[c].goal).map(c => CATS[c].full.toLowerCase());
  const miss = goalCats().filter(c => gs[c].done < gs[c].goal).map(c => `${CATS[c].full.toLowerCase()} ${gs[c].done}/${gs[c].goal}`);
  if(good.length) L.push(`Получилось: ${good.join(", ")}.`);
  if(miss.length) L.push(`Не дотянул: ${miss.join(", ")}.`);
  const st = streaks(); if(st.length) L.push(`Серии: ${st.join("; ")}.`);
  const ins = personalInsights().slice(0, 2); if(ins.length) L.push("Что я заметил:\n" + ins.map(x => "• " + x.text).join("\n"));
  const sk = skipPatterns().slice(0, 2); if(sk.length) L.push("Чаще всего срывается:\n" + sk.map(x => "• " + x.text).join("\n"));
  return L.join("\n");
}

/* ---------- stage 3: plan that fits the real you ---------- */
// лучший день для занятия с учётом того, когда ты его реально делаешь
function smartDay(key, cat, from, avoid, load, wObj){
  const bs = bestSlotFor(cat), w = wObj || getWeek(key);
  let best = -1, bestScore = -1e9;
  for(let d = from; d < 7; d++){
    if(d === avoid || w.items.some(i => i.day===d && i.cat===cat)) continue;
    if(((settings.avoidDays||{})[cat]||[]).includes(d)) continue;
    let sc = -(load ? load[d] : w.items.filter(i=>i.day===d).length) * 1.2;
    if(w.items.some(i => i.cat === cat && Math.abs(i.day - d) === 1)) sc -= 2;
    if(MAJOR.has(cat) && w.items.some(i => i.day === d && MAJOR.has(i.cat))) sc -= 3;
    if(cat === "swim" && d < 5) sc -= 1;
    if(key === curKey() && d === todayI()) sc -= new Date().getHours() >= 19 ? 5 : new Date().getHours() >= 12 ? 2 : 0;
    if(bs) sc += (bs.byDow[d].rate - 0.5) * 6;
    if(sc > bestScore){ bestScore = sc; best = d; }
  }
  return best;
}
function learnedTime(cat, d, fallback){ const bs = bestSlotFor(cat); if(bs && bs.time && !busyAt(d, bs.time)) return bs.time; return fallback; }
// подстройка целей по последним двум неделям
function goalSuggestions(){
  const out = [], base = mondayOf(new Date());
  // обе прошлые недели должны быть целиком «после старта», иначе нули — это не данные, а их отсутствие
  if(!statsReady(14) || addDays(base, -14).getTime() < startedAt()) return out;
  const wk = k => goalState(getWeek(iso(addDays(base, -7*k))), 7);
  const w1 = wk(1), w2 = wk(2);
  for(const c of goalCats()){
    const g = settings.goals[c], a = w1[c] ? w1[c].done : 0, b = w2[c] ? w2[c].done : 0;
    if(a >= g + 1 && b >= g + 1 && g < 7) out.push({c, to:g+1, text:`${CATS[c].full}: две недели подряд ты делаешь больше цели (${b} и ${a} при цели ${g}). Поднять цель до ${g+1}?`});
    else if(a <= g - 2 && b <= g - 2 && g > 1) out.push({c, to:g-1, text:`${CATS[c].full}: две недели подряд получается ${b} и ${a} при цели ${g}. Может, сделать цель реалистичнее — ${g-1}? Лучше стабильно, чем идеально.`});
  }
  return out;
}
// когда накопилось достаточно данных: сообщаем личную норму сна или предлагаем поправить названную
function sleepNeedNews(){
  let L; try{ L = learnSleepNeed(); }catch(e){ return; }
  if(!L || !L.T) return;
  const fm = m => fmtDur(m);
  if(settings.sleepNeed){
    if(Math.abs(L.T - settings.sleepNeed) >= 45 && Date.now() - (settings.needAsked || 0) > 21*86400000){ settings.needAsked = Date.now(); persistSettings();
      bot(`Ты говорил, что тебе хватает ${fm(settings.sleepNeed)}, но по данным энергия заметно выше после сна от ${fm(L.T)} (на ${L.diff.toFixed(1).replace(".", ",")} балла, ${L.n} дней). Поправить норму?`, [act(`Поставить ${fm(L.T)}`, {op:"sleepneed", min:L.T}), act("Оставить мою", {op:"keep"})]); }
  } else if(settings.needAnnounced !== L.T){ settings.needAnnounced = L.T; persistSettings();
    bot(`Заметил про тебя: когда сплю от ${fm(L.T)}, энергия выше в среднем на ${L.diff.toFixed(1).replace(".", ",")} балла (${L.nA} против ${L.nB} дней). Беру ${fm(L.T)} как твою норму вместо общих 7 часов. Скажешь «мне хватает 6 часов» — поставлю твою.`); }
}
function postWeeklyReport(){
  bot(weeklyReport(), [act("Составить план на следующую неделю", {op:"planNext"}), act("Открыть итоги", {op:"tab", tab:"stats"})], {kind:"report"});
  sleepNeedNews();
  for(const g of goalSuggestions().slice(0, 2)) bot(g.text, [act(g.to > settings.goals[g.c] ? "Поднять" : "Снизить", {op:"goal", c:g.c, to:g.to}), act("Оставить", {op:"keep"})]);
}

function renderPatterns(){
  const el = $("patternsCard"); if(!el) return;
  const ins = personalInsights(), st = streaks(), sk = skipPatterns();
  const dataDays = history(28).filter(x => x.hasData).length;
  el.innerHTML = `<h2>Что я про тебя понял</h2>` +
    (ins.length ? `<ul class="list">${ins.slice(0,5).map(x => `<li>${esc(x.text)}</li>`).join("")}</ul>`
      : `<p class="note">Для личных выводов нужно 1–2 недели данных: отмечай энергию и настроение, пиши в чат, что делал. Сейчас дней с данными: ${dataDays} из 14.</p><div class="bar"><div class="dn" style="width:${Math.min(100, dataDays/14*100)}%;background:var(--accent)"></div></div>`) +
    (st.length ? `<span class="label">Серии</span><ul class="list tips">${st.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "") +
    (sk.length ? `<span class="label">Что чаще срывается</span><ul class="list bad">${sk.slice(0,4).map(x => `<li>${esc(x.text)}</li>`).join("")}</ul><p class="note">При планировании я ставлю такие занятия на дни и часы, когда у тебя получается лучше.</p>` : "") +
    `<div class="tools"><button class="btn primary" data-report="1">Отчёт недели в чат</button></div>`;
}
function maybeWeeklyReport(){
  const h = new Date().getHours(), ck = curKey();
  if(todayI() === 6 && h >= 18 && LS.get("reportPosted") !== ck){ LS.set("reportPosted", ck); postWeeklyReport(); return true; }
  return false;
}
/* ---------- message entry point ---------- */
let ruleMiss = false;
function handleUser(text, pushMe){
  text = (text||"").trim(); if(!text) return;
  ciNoteAnswer();
  if(pushMe !== false) pushMsg({who:"me", text});
  try{ respond(text); }catch(err){ console.error(err); bot("Что-то пошло не так, попробуй написать иначе."); }
  render(); scrollChat();
}
try{ localStorage.removeItem("ritm:claudeKey"); localStorage.removeItem("ritm:claudeUsage"); }catch(e){}

/* ---------- routine: learn the daily schedule by asking ---------- */
const nrt = s => " " + String(s).toLowerCase().replace(/ё/g,"е").replace(/[!?;()«»"]/g," ").replace(/,/g," , ").replace(/\s+/g," ").trim() + " ";
const getRoutine = () => LS.get("routine") || {asked:{}, recurring:[]};
const saveRoutine = r => LS.set("routine", r);
const WD_ABBR = [["пн","понедельник"],["вт","вторник"],["ср","сред"],["чт","четверг"],["пт","пятниц"],["сб","суббот"],["вс","воскресень"]];
const hmFrom = (h, m) => pad(Math.min(23, +h)) + ":" + pad(+(m||0));
function parseRange(s){
  const r = /(?:^|\s)(?:с|c|от)?\s*(\d{1,2})(?:[:.](\d{2}))?\s*(?:до|-|–|—|по)\s*(\d{1,2})(?:[:.](\d{2}))?/.exec(s);
  if(!r || +r[1] > 23 || +r[3] > 24) return null;
  return {from:hmFrom(r[1], r[2]), to:hmFrom(+r[3] === 24 ? 0 : r[3], r[4])};
}
function parseOneTime(s){ const r = /(?:^|\s)(?:в|к|около)?\s*(\d{1,2})(?:[:.](\d{2}))?(?!\s*(?:мин|час|км|раз))/.exec(s); return r && +r[1] <= 23 ? hmFrom(r[1], r[2]) : null; }
function parseDays(s){
  s = nrm(s);
  if(/ (не работаю|не учусь|нигде|безработ|на пенсии|в декрете|фриланс без графика) /.test(s)) return {days:[], none:true};
  if(/ (2\/2|2 через 2|два через два|сменами|сутки через|посменно|вахт) /.test(s)) return {days:null, shift:s.trim()};
  if(/ (каждый день|ежедневно|без выходных|7 дней|все дни) /.test(s)) return {days:[0,1,2,3,4,5,6]};
  if(/ (пн ?[-–—] ?сб|понедельник[а-я]* по суббот|6 дней|шестидневк) /.test(s)) return {days:[0,1,2,3,4,5]};
  if(/ (пн ?[-–—] ?пт|понедельник[а-я]* по пятниц|будн|5\/2|5 через 2|пятидневк|кроме выходных|обычная неделя|стандартн) /.test(s)) return {days:[0,1,2,3,4]};
  const days = []; WD_ABBR.forEach(([a, f], i) => { if(new RegExp(" " + a + "(?=[ ,])").test(s) || s.includes(" " + f)) days.push(i); });
  return days.length ? {days} : null;
}
const ROUTINE_QS = [
  {k:"days", q:"Хочу лучше понимать твой распорядок, чтобы не дёргать в неподходящее время. В какие дни ты обычно работаешь или учишься? Например: «пн–пт», «2/2», «не работаю».",
   parse(t, r){ const d = parseDays(t); if(!d) return null; r.workDays = d.days; r.shift = d.shift || null; r.noWork = !!d.none;
     if(d.none){ r.asked.hours = true; r.asked.place = true; }
     const rg = parseRange(nrt(t)); if(rg){ r.work = rg; r.asked.hours = true; }
     return d.none ? "Понял, без рабочего графика." : d.shift ? "Понял, сменный график. Буду ориентироваться по тому, что ты пишешь." : `Понял: ${d.days.map(i=>DW[i].toLowerCase()).join(", ")}.`; }},
  {k:"hours", q:"Во сколько обычно начинается и заканчивается рабочий день? Например: «с 9 до 18».",
   parse(t, r){ const rg = parseRange(nrt(t)); if(!rg) return null; r.work = rg; return `Записал: работа с ${rg.from} до ${rg.to}.`; }},
  {k:"place", q:"Работаешь из дома или ездишь в офис? И сколько примерно дорога в одну сторону?",
   parse(t, r){ const s = nrm(t); let p = null;
     if(/ (дом|удален|удаленн|из дома|удаленке|удаленно) /.test(s) || / удал/.test(s)) p = "home";
     if(/ (офис|езжу|еду|на работу|на завод|в универ|на учеб) /.test(s)) p = p === "home" ? "mixed" : "office";
     if(/ (гибрид|по-разному|по разному|иногда|когда как) /.test(s)) p = "mixed";
     const cm = /(\d+)\s*(?:мин|минут)/.exec(s), ch = /(\d+(?:[.,]\d)?)\s*час/.exec(s);
     const commute = / полчаса /.test(s) ? 30 : cm ? +cm[1] : ch ? Math.round(parseFloat(ch[1].replace(",","."))*60) : / час /.test(s) ? 60 : null;
     if(!p && commute == null) return null; r.place = p || r.place || "office"; if(commute != null) r.commute = commute;
     return (r.place === "home" ? "Удалёнка, понял." : r.place === "mixed" ? "Гибрид, понял." : "Понял, офис.") + (commute != null ? ` Дорога около ${commute} мин.` : ""); }},
  {k:"wake", q:"Во сколько обычно встаёшь в будни, а во сколько в выходные? Например: «в 7:30, в выходные в 10».",
   parse(t, r){ const s = nrt(t); const parts = s.split(/ (?:а )?(?:в )?выходн[а-я]* /);
     const wd = parseOneTime(" " + parts[0] + " "), we = parts[1] ? parseOneTime(" " + parts[1] + " ") : null;
     if(!wd && !we) return null; if(wd) r.wakeWd = wd; if(we) r.wakeWe = we; else if(wd && !r.wakeWe) r.wakeWe = wd;
     return `Записал: подъём ${r.wakeWd || "?"} в будни` + (r.wakeWe ? `, ${r.wakeWe} в выходные.` : "."); }},
  {k:"lunch", q:"Во сколько обычно обедаешь?",
   parse(t, r){ const tm = parseOneTime(nrt(t)); if(!tm) return null; r.lunch = tm; return `Хорошо, обед около ${tm}. Тогда и буду напоминать.`; }},
  {k:"train", q:"Когда тебе удобнее тренироваться: утром, в обед или вечером?",
   parse(t, r){ const s = nrm(t); const p = / утр/.test(s) ? "morning" : / (в обед|обед|днем|днём|день)/.test(s) ? "lunch" : / (вечер|после работ)/.test(s) ? "evening" : / (по-разному|по разному|неважно|когда как|любое|без разницы)/.test(s) ? "any" : null;
     if(!p) return null; r.train = p; const tm = parseOneTime(s); if(tm) r.trainTime = tm;
     return {morning:"Утро, отлично: буду ставить тренировки до работы.", lunch:"Понял, в обед.", evening:"Вечер, понял: буду ставить тренировки после работы.", any:"Понял, буду подбирать по свободному времени."}[p]; }}
];
ROUTINE_QS.push({k:"sleepneed", q:"Сколько часов сна тебе обычно хватает, чтобы чувствовать себя нормально? У каждого своя норма: кому-то хватает 6, кому-то нужно 8. Ответь числом, например «6,5», или пропусти.",
  parse(t, r){ const m = /(\d{1,2}(?:[.,]\d)?)/.exec(t); const hv = m ? parseFloat(m[1].replace(",", ".")) : NaN; if(!(hv >= 3 && hv <= 12)) return null; settings.sleepNeed = Math.round(hv*60/15)*15; persistSettings(); needCache = {t:0, v:null};
    return `Записал: тебе хватает около ${fmtDur(settings.sleepNeed)}. Буду сверять это с твоим самочувствием.`; }});
ROUTINE_QS.push({k:"weight", q:"Сколько ты примерно весишь? Нужно, чтобы посчитать норму белка (1,4 г на кг). Можно пропустить.",
  parse(t, r){ const m = /(\d{2,3})/.exec(t); if(!m || +m[1] < 30 || +m[1] > 250) return null; return setWeight(+m[1]); }});
function routineKnown(r){ return ROUTINE_QS.filter(q => r.asked[q.k]).length; }
function nextRoutineQ(r){ return ROUTINE_QS.find(q => !r.asked[q.k]); }
function askRoutine(force){
  const r = getRoutine(), q = nextRoutineQ(r); if(!q) return false;
  const lastMe = getChat().filter(m=>m.who==="me").slice(-1)[0];
  if(!force && lastMe && Date.now() - lastMe.at < 10*60*1000) return false;
  const h = new Date().getHours(); if(!force && (h < 9 || h >= 23)) return false;
  if(!force && Date.now() - (r.lastAsk||0) < 2*3600*1000) return false;
  r.lastAsk = Date.now(); r.pending = q.k; saveRoutine(r);
  bot(q.q, [act("Пропустить", {op:"rskip", k:q.k})], {kind:"routine:" + q.k});
  return true;
}
function routineAnswer(text){
  const r = getRoutine(); if(!r.pending) return false;
  const last = getChat().filter(m=>m.who==="bot").slice(-1)[0];
  if(!last || last.kind !== "routine:" + r.pending || Date.now() - last.at > 12*3600*1000) return false;
  const s = nrm(text);
  if(/\?/.test(text) || /^ (что|какой|какие|как|сколько|покажи|перенеси|убери|отмени|привет|спасибо) /.test(s)) return false;
  if(/ (пропуст|не знаю|потом|не хочу|не скажу|позже) /.test(s)){ r.asked[r.pending] = true; r.pending = null; saveRoutine(r); bot("Хорошо, пропустим. Если захочешь, расскажи потом: «я работаю с 10 до 19», «встаю в 8»."); return true; }
  const q = ROUTINE_QS.find(x => x.k === r.pending);
  const res = q.parse(text, r);
  if(!res){ r.pending = null; saveRoutine(r); return false; }
  r.asked[q.k] = true; r.pending = null; saveRoutine(r); applyRoutineToSettings(r);
  const nx = nextRoutineQ(r);
  if(nx){ r.pending = nx.k; r.lastAsk = Date.now(); saveRoutine(r); bot(res + " " + nx.q, [act("Пропустить", {op:"rskip", k:nx.k})], {kind:"routine:" + nx.k}); }
  else bot(res + " Спасибо! Теперь я знаю твой распорядок и буду учитывать его в планах и вопросах. Посмотреть можно командой «что ты обо мне знаешь».");
  return true;
}
// free statements anywhere in chat: «я работаю с 10 до 19», «по субботам футбол в 12», «в выходные встаю в 11»
function routineStatement(text){
  const s = nrt(text), r = getRoutine(); const said = []; let bedChanged = false;
  if(/ (работаю|работа|учусь|учеба|на работе|в офисе) /.test(s) && !/ (сегодня|сейчас|вчера) /.test(s)){
    const rg = parseRange(s); if(rg){ r.work = rg; r.asked.hours = true; said.push(`работа с ${rg.from} до ${rg.to}`); }
    const d = parseDays(s); if(d && (d.days || d.shift)){ r.workDays = d.days; r.shift = d.shift||null; r.asked.days = true; said.push(d.shift ? "сменный график" : "рабочие дни: " + d.days.map(i=>DW[i].toLowerCase()).join(", ")); }
    if(/ (удален|из дома) /.test(s) || / удал/.test(s)){ r.place = "home"; r.asked.place = true; said.push("удалёнка"); }
  }
  if(/ (сна|сон|спать|спится|высыпа)/.test(s)){
    if(/ (определи|вычисли|посчитай|сам определи)/.test(s)){ settings.sleepNeed = null; persistSettings(); needCache = {t:0, v:null}; bot("Хорошо, норму сна буду определять сам по твоему самочувствию. Пока данных мало, ориентир — 7 часов."); return true; }
    const sm = /(?:хватает|нужно|надо|достаточно|норма сна|норма|высыпаюсь за|выспаться)\D{0,14}?(\d{1,2}(?:[.,]\d)?)|(\d{1,2}(?:[.,]\d)?)\s*(?:час\S*|ч)\s*(?:сна\s*)?(?:мне\s*)?(?:хватает|достаточно|нормально)/.exec(s);
    const hv = sm ? parseFloat((sm[1] || sm[2]).replace(",", ".")) : NaN;
    if(hv >= 3 && hv <= 12){ settings.sleepNeed = Math.round(hv*60/15)*15; persistSettings(); needCache = {t:0, v:null}; const r0 = getRoutine(); r0.asked.sleepneed = true; saveRoutine(r0);
      bot(`Запомнил: тебе нужно около ${fmtDur(settings.sleepNeed)} сна. Буду считать ночь нормальной от этого. По самочувствию проверю, так ли это: если энергия будет говорить о другом, скажу.`); return true; } }
  const wm = /(?:^| )(?:я )?(?:вешу|мой вес|вес)\s*(?:сейчас |около |примерно )?(\d{2,3})(?:[.,]\d)?\s*(?:кг|килограмм|кило)?(?= |$)/.exec(s);
  if(wm && +wm[1] >= 30 && +wm[1] <= 250){ bot(setWeight(+wm[1])); return true; }
  const wk = / (встаю|просыпаюсь|подъем) /.test(s);
  if(wk){ const parts = s.split(/ (?:а )?(?:в )?выходн[а-я]* /); const a = parseOneTime(" "+parts[0]+" "), b = parts[1] ? parseOneTime(" "+parts[1]+" ") : null;
    if(/ выходн/.test(s) && !b && a){ r.wakeWe = a; said.push("подъём в выходные " + a); } else { if(a){ r.wakeWd = a; said.push("подъём " + a); } if(b){ r.wakeWe = b; said.push("в выходные " + b); } }
    if(a || b) r.asked.wake = true; }
  if(/ (обедаю|обед обычно|обычно обед) /.test(s)){ const tm = parseOneTime(s); if(tm){ r.lunch = tm; r.asked.lunch = true; said.push("обед в " + tm); } }
  if(/ (ложусь|лягу|отбой|засыпаю|иду спать|пойду спать|ложусь спать|лягу спать|сплю с) /.test(s) && !/ (вчера|сегодня лег|лег в) /.test(s)){ const tm = parseOneTime(s); if(tm){ setBedtime(tm); said.push(`отбой в ${tm}, экраны выключаем к ${settings.screensOff}`); bedChanged = true; } }
  // regular activities: «по субботам футбол в 12», «каждый вторник йога»
  let rec = / (по|каждый|каждую|каждое|каждые) (понедельник|вторник|сред|четверг|пятниц|суббот|воскресень|будням|будн|выходн|день|утро|вечер)[а-я]* /.exec(s) || (/ (ежедневно|через день) /.exec(s) && [null, "", / ежедневно /.test(s) ? "день" : "черезд"]);
  if(rec && / (сегодня|завтра|вчера) /.test(s)) rec = null;
  if(rec){
    const e = RITM.parse(text.replace(/по\s+\S+(\s+и\s+\S+)*|кажд\S+\s+\S+(\s+день)?|ежедневно|через день/gi, " ")).find(x => x.type && TYPES[x.type].unit === "min");
    if(e){
      const k = rec[2];
      let dayList = /^будн/.test(k) ? [0,1,2,3,4] : /^выходн/.test(k) ? [5,6] : /^(день|утро|вечер)$/.test(k) ? [0,1,2,3,4,5,6] : k === "черезд" ? [0,2,4,6] : [WD_ABBR.findIndex(([,f]) => k.startsWith(f.slice(0,4)))];
      // «по вторникам и четвергам»
      if(dayList.length === 1){ const more = WD_ABBR.map(([,f], i) => s.includes(" " + f.slice(0,4)) ? i : -1).filter(i => i >= 0); if(more.length > 1) dayList = more; }
      rec[2] = dayList.length === 7 ? "каждый день" : dayList.length === 5 && dayList[4] === 4 && !dayList.includes(5) ? "будням" : dayList.length === 2 && dayList[0] === 5 ? "выходным" : dayList.length > 1 ? "list" : k;
      r.recurring = (r.recurring||[]).filter(x => !(dayList.includes(x.day) && x.type === e.type));
      for(const d of dayList) if(d >= 0) r.recurring.push({day:d, type:e.type, name:e.name, time:e.time||""});
      said.push(`регулярно: ${lc(e.name)} ${rec[2] === "будням" ? "по будням" : rec[2] === "выходным" ? "по выходным" : rec[2] === "каждый день" ? "каждый день" : rec[2] === "list" ? dayList.map(i => DACC[i]).join(", ") : DACC[dayList[0]]}${e.time ? " в "+e.time : ""}`);
      saveRoutine(r); applyRecurring(curKey(), true); applyRecurring(iso(addDays(new Date(curKey()+"T00:00:00"),7)), true);
    }
  }
  if(!said.length) return false;
  if(bedChanged){ const rr = getRoutine(); r.bedSet = rr.bedSet; r.asked.bed = true; }
  saveRoutine(r); applyRoutineToSettings(r);
  bot("Запомнил: " + said.join(", ") + ".");
  postIssues(restOfWeek(), 3);
  // a new regular activity may clash with this week's plan
  if(rec){ const ck = curKey(), w = getWeek(ck);
    for(const x of (r.recurring||[]).filter(x => x.day >= todayI())){
      const c = w.items.find(i => i.day===x.day && !i.done && i.cat!==x.type && MAJOR.has(i.cat) && MAJOR.has(x.type));
      if(c){ const bd = bestDayInWeek(ck, c.cat, todayI(), x.day); const acts = [];
        if(bd >= 0) acts.push(act(`Перенести ${DACC[bd]}`, {op:"move", key:ck, id:c.id, day:bd, t:c.t}));
        acts.push(act("Убрать", {op:"remove", key:ck, id:c.id, t:c.t}), act("Оставить обе", {op:"keep"}));
        bot(`На этой неделе ${DACC[x.day]} уже стоит «${c.t}». Что с ним сделать?`, acts); break; } } }
  return true;
}
function routineSummary(){
  const r = getRoutine(), L = [];
  if(r.noWork) L.push("Работы по графику нет.");
  else if(r.shift) L.push("График сменный.");
  else if(r.workDays) L.push("Работаешь: " + r.workDays.map(i=>DW[i].toLowerCase()).join(", ") + (r.work ? `, с ${r.work.from} до ${r.work.to}` : "") + ".");
  if(r.place) L.push({home:"Удалёнка.", office:"Ездишь в офис.", mixed:"Гибрид: то дома, то в офисе."}[r.place] + (r.commute ? ` Дорога около ${r.commute} мин.` : ""));
  if(r.wakeWd) L.push(`Встаёшь в ${r.wakeWd}` + (r.wakeWe && r.wakeWe !== r.wakeWd ? `, в выходные в ${r.wakeWe}` : "") + ".");
  L.push(`Обычно ложишься около ${usualBedtime().hm}.`);
  if(r.lunch) L.push(`Обед около ${r.lunch}.`);
  if(r.train) L.push("Тренироваться удобнее " + {morning:"утром", lunch:"в обед", evening:"вечером", any:"когда есть время"}[r.train] + ".");
  for(const x of r.recurring||[]) L.push(`Регулярно ${DACC[x.day]}: ${lc(x.name)}${x.time ? " в "+x.time : ""}.`);
  const left = ROUTINE_QS.filter(q => !r.asked[q.k]).length;
  return (L.length ? "Вот что я о тебе знаю:\n" + L.join("\n") : "Я пока мало о тебе знаю.") + (left ? `\nОсталось уточнить ${left} ${plural(left,"вопрос","вопроса","вопросов")}, могу спросить сейчас.` : "\nЕсли что-то поменялось, просто напиши, например: «теперь работаю с 10 до 19».");
}
function applyRoutineToSettings(r){
  if(r.wakeWd) settings.wake = r.wakeWd;
  if(r.lunch) settings.lunch = r.lunch;
  persistSettings();
}
function isWorkDay(d){ const r = getRoutine(); return Array.isArray(r.workDays) ? r.workDays.includes(d) : d < 5; }
function wakeFor(d){ const r = getRoutine(); return (!isWorkDay(d) && r.wakeWe) ? r.wakeWe : (r.wakeWd || wakeTime()); }
function busyAt(d, hm){ const r = getRoutine(); if(!r.work || !isWorkDay(d) || r.noWork) return false; const m = toMinHM(hm), a = toMinHM(r.work.from) - (r.commute||0), b = toMinHM(r.work.to) + (r.commute||0); return m >= a && m < b; }
// time for a planned activity that respects work hours and training preference
function smartTime(cat, d, fallback){
  const r = getRoutine();
  if(CATS[cat] && CATS[cat].move){ const lt = learnedTime(cat, d, null); if(lt) return lt; }
  const major = MAJOR.has(cat);
  if(major && r.train && r.train !== "any" && isWorkDay(d)){
    if(r.train === "morning") return r.trainTime || fromMin(toMinHM(wakeFor(d)) + 30);
    if(r.train === "lunch") return r.trainTime || r.lunch || "13:00";
    if(r.train === "evening") return r.trainTime || (r.work ? fromMin(toMinHM(r.work.to) + (r.commute||0) + 60) : "19:00");
  }
  if(fallback && busyAt(d, fallback) && r.work) return fromMin(toMinHM(r.work.to) + (r.commute||0) + 45);
  return fallback || "";
}
function applyRecurring(key, force){
  const r = getRoutine(); if(!(r.recurring||[]).length) return;
  const flag = "rec:" + key; if(!force && LS.get(flag)) return;
  const w = getWeek(key); let changed = false;
  const startDay = key === curKey() ? todayI() : 0;
  for(const x of r.recurring){ if(x.day < startDay) continue; if(w.items.some(i => i.day===x.day && i.cat===x.type)) continue; w.items.push({id:uid(), day:x.day, cat:x.type, t:x.name, time:x.time||"", done:false, rec:true}); changed = true; }
  if(changed) saveWeek(key, w); LS.set(flag, true);
}

/* ---------- app watcher settings & history ---------- */
let lastWatchSync = "";
function syncWatch(){
  if(!NATIVE || !NATIVE.setWatch) return;
  const r = getRoutine(), types = LS.get("appTypes") || {};
  const ent = new Set(Object.entries(KNOWN_APPS).filter(([,g]) => APP_GROUPS[g] && APP_GROUPS[g].ent).map(([p]) => p));
  for(const day of Object.values(health.apps||{})) for(const a of day.apps||[]) if(APP_GROUPS[appGroup(a)] && APP_GROUPS[appGroup(a)].ent) ent.add(a.p);
  const nonEnt = Object.entries(types).filter(([,g]) => !(APP_GROUPS[g] && APP_GROUPS[g].ent)).map(([p]) => p);
  for(const p of nonEnt) ent.delete(p);
  const limits = {}, notes = {};
  const seen = new Map(); for(const p of Object.keys(KNOWN_APPS)) seen.set(p, {p, c:-1});
  for(const day of Object.values(health.apps||{})) for(const a of day.apps||[]) seen.set(a.p, a);
  for(const a of seen.values()){ const inf = appInfo(a); limits[a.p] = inf.limit; notes[a.p] = inf.why; if(inf.limit > 0) ent.add(a.p); else ent.delete(a.p); }
  const cfg = {limits, notes, enabled: !!(settings.notify && (settings.watchMin ?? 40) > 0 && health.usage), sessionMin: settings.watchMin ?? 40, dayLimit: settings.screenLimit, ent:[...ent], nonEnt,
    wake: wakeFor(todayI()), off: settings.screensOff, workDays: Array.isArray(r.workDays) ? r.workDays : [], workFrom: r.work ? r.work.from : "", workTo: r.work ? r.work.to : ""};
  const s = JSON.stringify(cfg); if(s !== lastWatchSync){ lastWatchSync = s; try{ NATIVE.setWatch(s); }catch(e){} }
}
function nudgeHistory(){ if(!NATIVE || !NATIVE.nudges) return []; try{ return JSON.parse(NATIVE.nudges()); }catch(e){ return []; } }
function nudgeStats(fromMs, toMs){
  const list = nudgeHistory().filter(n => n.at >= fromMs && n.at < toMs);
  const c = k => list.filter(n => n.outcome === k).length;
  return {n:list.length, obeyed:c("obeyed"), ignored:c("ignored"), exempt:c("exempt"), promisedIgnored:list.filter(n=>n.outcome==="ignored" && n.response==="comply").length, list};
}

/* ---------- what each app is and how it affects you ---------- */
const GROUP_INFO = {
  feeds:  {risk:"high", why:"Лента без конца: легко залипнуть, а сравнение себя с другими может портить настроение."},
  video:  {risk:"medium", why:"Видео бывает и полезным, и бесконечной лентой рекомендаций. Короткие ролики затягивают сильнее всего."},
  gaming: {risk:"medium", why:"Игры — нормальный отдых, но долгие сессии и игры перед сном мешают заснуть."},
  series: {risk:"low", why:"Фильм или сериал — нормальный отдых, если не включать «ещё одну серию» до ночи."},
  chat:   {risk:"none", why:"Мессенджер — в основном общение, сам по себе не вреден."},
  browser:{risk:"none", why:"Браузер может быть чем угодно, поэтому к нему не придираюсь."},
  music:  {risk:"none", why:"Музыка и подкасты обычно идут фоном, это не экранное время."},
  work:   {risk:"none", why:"Работа, учёба, почта и календарь — это дело, а не развлечение."},
  health: {risk:"none", why:"Здоровье и спорт — только плюс."},
  maps:   {risk:"none", why:"Карты и такси — по делу."},
  shop:   {risk:"low", why:"Покупки: иногда залипаешь в каталоге, но обычно по делу."},
  other:  {risk:"none", why:"Обычное приложение, без претензий."}
};
const APP_NOTES = {
  "com.zhiliaoapp.musically":["high","TikTok — бесконечная лента коротких видео: быстро съедает время и приучает к постоянной смене картинки."],
  "com.ss.android.ugc.trill":["high","TikTok — бесконечная лента коротких видео: быстро съедает время и приучает к постоянной смене картинки."],
  "com.instagram.android":["high","Instagram — лента и рилсы: легко залипнуть, а чужие «идеальные» жизни могут портить настроение."],
  "com.google.android.youtube":["medium","YouTube бывает и полезным (обучение, разборы), и бесконечной лентой рекомендаций. Shorts затягивают сильнее всего."],
  "com.vkontakte.android":["high","ВКонтакте — лента и клипы: легко пролистать час, не заметив."],
  "com.reddit.frontpage":["high","Reddit — бесконечные ветки и обсуждения, затягивает надолго."],
  "com.twitter.android":["high","X (Twitter) — быстрая лента новостей и споров, часто добавляет тревоги."],
  "org.telegram.messenger":["none","Telegram — в первую очередь мессенджер. Если сидишь в каналах, отметь его как «Соцсети», и я буду присматривать."],
  "com.whatsapp":["none","WhatsApp — общение, к нему не придираюсь."],
  "com.duolingo":["none","Duolingo — учёба, это в плюс."],
  "tv.twitch.android.app":["medium","Twitch — длинные стримы, легко просидеть весь вечер."],
  "com.netflix.mediaclient":["low","Netflix — фильмы и сериалы: отдых, если без марафонов до ночи."],
  "ru.kinopoisk":["low","Кинопоиск — фильмы и сериалы: отдых, если без марафонов до ночи."]
};
function appInfo(a){
  const g = appGroup(a), base = GROUP_INFO[g] || GROUP_INFO.other, own = APP_NOTES[a.p];
  const overridden = (LS.get("appTypes")||{})[a.p];
  const risk = own && !overridden ? own[0] : base.risk, why = own && !overridden ? own[1] : base.why;
  const b = settings.watchMin ?? 40;
  const limit = risk === "high" ? Math.max(20, b - 10) : risk === "medium" ? b : risk === "low" ? b * 2 : 0;
  return {group:g, risk, why, limit};
}
/* ---------- screen time by app (Android app, usage access) ---------- */
const APP_GROUPS = {
  video:{n:"Видео", ent:true, c:"--c-games"}, series:{n:"Фильмы и сериалы", ent:true, c:"--c-games"}, gaming:{n:"Игры", ent:true, c:"--c-games"},
  feeds:{n:"Соцсети", ent:true, c:"--c-social"}, chat:{n:"Мессенджеры", c:"--c-pool"}, browser:{n:"Браузер", c:"--c-other"},
  music:{n:"Музыка и подкасты", c:"--c-fun"}, work:{n:"Работа и учёба", c:"--c-offline"}, health:{n:"Здоровье и спорт", c:"--c-walk"},
  maps:{n:"Карты и такси", c:"--c-mobility"}, shop:{n:"Покупки", c:"--c-fun"}, other:{n:"Другое", c:"--c-other"}
};
const KNOWN_APPS = {
  "com.google.android.youtube":"video","app.revanced.android.youtube":"video","com.zhiliaoapp.musically":"video","com.ss.android.ugc.trill":"video","tv.twitch.android.app":"video","com.vk.vkvideo":"video","ru.rutube.app":"video","com.google.android.apps.youtube.kids":"video",
  "com.netflix.mediaclient":"series","ru.kinopoisk":"series","ru.ivi.client":"series","ru.more.play":"series","ru.okko.android":"series","com.disney.disneyplus":"series","com.amazon.avod.thirdpartyclient":"series","com.hbo.hbonow":"series","com.wbd.stream":"series",
  "com.instagram.android":"feeds","com.instagram.barcelona":"feeds","com.vkontakte.android":"feeds","com.facebook.katana":"feeds","com.twitter.android":"feeds","com.reddit.frontpage":"feeds","com.pinterest":"feeds","ru.ok.android":"feeds","com.snapchat.android":"feeds","ru.zen.android":"feeds","com.linkedin.android":"feeds","com.threads.android":"feeds",
  "org.telegram.messenger":"chat","org.telegram.messenger.web":"chat","org.thunderdog.challegram":"chat","com.whatsapp":"chat","com.viber.voip":"chat","com.discord":"chat","com.google.android.apps.messaging":"chat","ru.oneme.app":"chat","com.vk.im":"chat","com.facebook.orca":"chat","org.thoughtcrime.securesms":"chat",
  "com.android.chrome":"browser","org.mozilla.firefox":"browser","com.yandex.browser":"browser","com.opera.browser":"browser","com.microsoft.emmx":"browser","com.brave.browser":"browser","com.sec.android.app.sbrowser":"browser","com.heytap.browser":"browser",
  "com.spotify.music":"music","ru.yandex.music":"music","com.google.android.apps.youtube.music":"music","com.apple.android.music":"music","com.soundcloud.android":"music","com.google.android.apps.podcasts":"music",
  "com.google.android.apps.maps":"maps","ru.yandex.yandexmaps":"maps","ru.yandex.taxi":"maps","com.ubercab":"maps","ru.yandex.yandexnavi":"maps","com.waze":"maps",
  "com.google.android.gm":"work","com.microsoft.office.outlook":"work","com.Slack":"work","com.slack":"work","com.microsoft.teams":"work","notion.id":"work","com.google.android.apps.docs":"work","com.google.android.calendar":"work","us.zoom.videomeetings":"work","com.duolingo":"work","com.google.android.keep":"work",
  "com.google.android.apps.fitness":"health","com.sec.android.app.shealth":"health","com.strava":"health","com.heytap.health":"health","com.oplus.health":"health",
  "com.wildberries.ru":"shop","ru.ozon.app.android":"shop","com.avito.android":"shop","com.alibaba.aliexpresshd":"shop","com.amazon.mShop.android.shopping":"shop"
};
const CAT_MAP = {0:"gaming", 1:"music", 2:"video", 3:"other", 4:"feeds", 5:"feeds", 6:"maps", 7:"work"};
const appGroup = a => (LS.get("appTypes")||{})[a.p] || KNOWN_APPS[a.p] || CAT_MAP[a.c] || "other";

/* ---------- «Заметил за день»: приложение само собирает день по шагам и экрану, человек подтверждает одной кнопкой ---------- */
const noticedMem = () => LS.get("noticed") || {};
function noticedList(){
  const out = [], ck = curKey(), ti = todayI(), day = dateOf(ck, ti), mem = noticedMem(), now = Date.now();
  if(health && health.stepBuckets && health.stepBuckets.length){
    const logged = ((getWeek(ck).days[ti] || {}).log || []), bad = LS.get("walkNo") || {};
    for(const g of walkSegments(health.stepBuckets, now)){
      const st = new Date(g.start); if(dateKeyOf(st) !== ck || dayIdxOf(st) !== ti) continue;
      const id = "w" + g.start; if(mem[id] != null) continue;
      if((bad[st.getHours()] || 0) >= 2) continue;
      const m0 = st.getHours()*60 + st.getMinutes();
      if(logged.some(e => e.time && e.min && (CATS[e.type] && CATS[e.type].move) && Math.abs(+e.time.slice(0,2)*60 + +e.time.slice(3,5) - m0) < 30)) continue;
      out.push({id, kind:"walk", title:`Прогулка, ${g.min} мин`, sub:`${fmtHM(st)}–${fmtHM(new Date(g.end))}, ${fmtNum(g.steps)} шагов`, g});
    }
  }
  const pd = health && health.usage ? phoneDay(day) : null;
  if(pd){
    const got = (LS.get("usageLogged") || {})[day] || {};
    for(const a of pd.apps){
      if(!["video","series","gaming","feeds"].includes(a.grp)) continue;
      const m = Math.round(a.m - (got[a.p] || 0)); if(m < 10) continue;
      const id = "u" + a.p + ":" + Math.round(a.m / 10); if(mem[id] != null) continue;
      out.push({id, kind:"app", title:`${a.l}, ${fmtDur(m)}`, sub:"по истории использования телефона", a, m});
    }
  }
  return out.slice(0, 5);
}
function renderNoticed(){
  const card = $("noticedCard"); if(!card) return;
  const list = noticedList(); card.hidden = !list.length; if(!list.length) return;
  card.innerHTML = `<h2>Заметил за день</h2><p class="note">Приложение само это увидело. Верно ли?</p>` + list.map(n =>
    `<div class="status"><span class="rl"><b>${esc(n.title)}</b><span class="note">${esc(n.sub)}</span></span><span class="tools" style="margin:0"><button class="btn primary" data-nt="yes" data-nid="${esc(n.id)}" style="padding:5px 12px">Верно</button><button class="btn" data-nt="no" data-nid="${esc(n.id)}" style="padding:5px 12px">Нет</button></span></div>`).join("");
}
function noticedAnswer(id, yes){
  const n = noticedList().find(x => x.id === id); if(!n) return render();
  const mem = noticedMem(); mem[id] = yes ? 1 : 0; LS.set("noticed", mem);
  if(!yes){ if(n.kind === "walk"){ const b = LS.get("walkNo") || {}, h = new Date(n.g.start).getHours(); b[h] = (b[h]||0) + 1; LS.set("walkNo", b); } toast("Понял, не записываю"); return render(); }
  const ck = curKey(), ti = todayI(), day = dateOf(ck, ti);
  if(n.kind === "walk"){
    const st = new Date(n.g.start);
    mutateQuiet(ck, w => { const d = w.days[ti] = {...(w.days[ti]||{})}; d.log = (d.log||[]).slice(); const it = w.items.find(i => i.day===ti && i.cat==="walk" && !i.done); const rec = {id:uid(), type:"walk", name:"Прогулка", time:fmtHM(st), min:n.g.min, text:"прогулка по шагам", src:"steps"}; if(it){ it.done = true; rec.plan = it.id; } d.log.push(rec); });
  } else {
    const e = {type:n.a.grp, name:n.a.l, text:n.a.l, dayOffset:0, min:n.m}; fillDefaults(e); logFromChat([e]);
    const all = LS.get("usageLogged") || {}, got = all[day] || {}; got[n.a.p] = n.a.m; LS.set("usageLogged", {[day]:got});
  }
  toast("Записал"); render();
}
/* что человек делает в телефоне сегодня: берём самое долгое приложение с экраном, минус уже записанное */
function usageGuess(){
  const pd = phoneDay(dateOf(curKey(), todayI())); if(!pd) return null;
  const done = LS.get("usageLogged") || {}, day = dateOf(curKey(), todayI()), got = done[day] || {};
  let best = null;
  for(const a of pd.apps){
    if(!["video","series","gaming","feeds"].includes(a.grp)) continue;
    const m = a.m - (got[a.p] || 0);
    if(m >= 5 && (!best || m > best.min)) best = {type:a.grp, name:a.l, min:Math.round(m), p:a.p, total:a.m};
  }
  if(!best) return null;
  got[best.p] = best.total; const keep = {}; keep[day] = got; LS.set("usageLogged", keep);
  return best;
}
const appsFor = ds => (health.apps && health.apps[ds]) || null;
const offHour = () => { const [h,m] = settings.screensOff.split(":").map(Number); return h + m/60; };
function phoneDay(ds){
  const d = appsFor(ds); if(!d) return null;
  const by = {}; let ent = 0;
  const apps = (d.apps||[]).map(a => ({...a, grp:appGroup(a)}));
  for(const a of apps){ by[a.grp] = (by[a.grp]||0) + a.m; if(APP_GROUPS[a.grp] && APP_GROUPS[a.grp].ent) ent += a.m; }
  const off = offHour(), hrs = d.hours || [];
  let late = 0; for(let h=0; h<24; h++){ const v = hrs[h]||0; if(h+1 <= off) continue; late += h >= off ? v : v * (h+1-off); }
  return {total:d.total||0, pickups:d.pickups||0, ent, by, apps, late:Math.round(late)};
}
function chooseAppGroup(a){
  const inf = appInfo(a);
  openSheet(`<h2>${esc(a.l)}: что это за приложение?</h2><p class="note">${esc(inf.why)} ${inf.limit ? `Напомню о перерыве, если сидишь в нём дольше ${inf.limit} мин подряд.` : "Из-за него напоминать не буду."}</p><p class="note">Если я ошибся с типом, выбери правильный:</p>
    <div class="chips" id="agPick">${Object.entries(APP_GROUPS).map(([k,g]) => `<button type="button" class="chip ${appGroup(a)===k?"on":""}" data-ag="${k}"><i style="background:var(${g.c})"></i>${g.n}</button>`).join("")}</div>
    <div class="tools"><button class="btn" id="agCancel">Отмена</button></div>`);
  $("agPick").onclick = e => { const b = e.target.closest("[data-ag]"); if(!b) return; const m = LS.get("appTypes")||{}; m[a.p] = b.dataset.ag; LS.set("appTypes", m); closeSheet(); render(); toast("Запомнил"); };
  $("agCancel").onclick = closeSheet;
}
function usageHelpHtml(){
  return `<div class="help"><b>Если переключатель серый или написано «Ограниченная настройка»</b>
    <ol><li>Нажмите «Настройки приложения» ниже.</li><li>В правом верхнем углу нажмите <b>⋮</b> → <b>«Разрешить ограниченные настройки»</b> и подтвердите.</li><li>Вернитесь сюда и снова нажмите «Разрешить».</li></ol>
    <span class="note">Если пункта в меню ⋮ нет, сначала один раз попробуйте включить переключатель, закройте предупреждение, и пункт появится. Так Android защищает приложения, установленные не из Google Play.</span>
    <div class="tools"><button class="btn primary" data-native="usage">Разрешить</button><button class="btn" data-native="appsettings">Настройки приложения</button></div></div>`;
}
let appsShowAll = false;
function renderScreenCard(ck, ti){
  const card = $("screenCard"); if(!card) return;
  if(!NATIVE){ card.hidden = true; return; }
  card.hidden = false;
  if(!health.usage){ card.innerHTML = `<h2>Экранное время</h2><p class="note">Разрешите доступ к истории использования, и я буду видеть, сколько времени уходит на каждое приложение, и учитывать это в советах.</p>${usageHelpHtml()}`; return; }
  const pd = phoneDay(dateOf(ck, ti));
  if(!pd){ card.innerHTML = `<h2>Экранное время</h2><p class="note">Данных за сегодня пока нет. Нажмите «Обновить» в блоке шагов и сна.</p>`; return; }
  const lim = settings.screenLimit, list = appsShowAll ? pd.apps : pd.apps.slice(0, 5);
  card.innerHTML = `<div class="bhead"><h2>Экранное время</h2><span class="note">${pd.pickups} ${plural(pd.pickups,"разблокировка","разблокировки","разблокировок")}</span></div>
    <div class="metrics"><div class="metric"><span class="mv">${fmtDur(pd.total)}</span><span class="mk">телефон сегодня</span></div>
      <div class="metric"><span class="mv">${fmtDur(pd.ent)}</span><span class="mk">развлечения из ${fmtDur(lim)}</span><div class="bar"><div class="dn" style="width:${Math.min(100, pd.ent/lim*100)}%;background:var(${pd.ent > lim ? "--warn" : "--c-games"})"></div></div></div></div>
    ${pd.late ? `<p class="note">После ${settings.screensOff}: ${pd.late} мин</p>` : ""}
    <div class="loglist">${list.map(a => `<div class="lrow"><span class="ldot" style="background:var(${(APP_GROUPS[a.grp]||APP_GROUPS.other).c})"></span><span class="lt">${esc(a.l)}<small>${fmtDur(a.m)}</small></span><button class="chip" data-app="${esc(a.p)}">${(APP_GROUPS[a.grp]||APP_GROUPS.other).n}</button></div>`).join("")}
    ${pd.apps.length > 5 && !appsShowAll ? `<button class="btn" data-appsall="1">Все приложения (${pd.apps.length})</button>` : ""}</div>
    <p class="note">Нажмите на тип приложения, если я определил его неверно.</p>`;
}
function appsClick(ds){
  if(ds.app){ const ck = curKey(), pd = phoneDay(dateOf(ck, todayI())); const a = pd && pd.apps.find(x=>x.p===ds.app); if(a) chooseAppGroup(a); return true; }
  if(ds.appsall){ appsShowAll = true; render(); return true; }
  return false;
}
function weekScreenInsights(ck, ti){
  const out = [], days = [], prev = [];
  for(let d=0; d<=ti; d++){ const p = phoneDay(dateOf(ck,d)); if(p && (d < ti || p.total > 0)) days.push(p); }
  for(let d=0; d<7; d++){ const p = phoneDay(dateOf(iso(addDays(new Date(ck+"T00:00:00"),-7)), d)); if(p) prev.push(p); }
  if(!days.length) return out;
  const avg = a => a.reduce((x,y)=>x+y,0)/a.length;
  const tot = avg(days.map(p=>p.total)), ent = avg(days.map(p=>p.ent)), pick = avg(days.map(p=>p.pickups)), late = avg(days.map(p=>p.late));
  out.push([ent > settings.screenLimit ? "warn" : "ok", `Телефон в среднем ${fmtDur(Math.round(tot))} в день, из них развлечения ${fmtDur(Math.round(ent))} при лимите ${fmtDur(settings.screenLimit)}.`]);
  const agg = {}; for(const p of days) for(const a of p.apps) if(APP_GROUPS[a.grp] && APP_GROUPS[a.grp].ent) agg[a.l] = (agg[a.l]||0) + a.m;
  const top = Object.entries(agg).sort((a,b)=>b[1]-a[1]).slice(0,3);
  if(top.length) out.push(["sun", `Больше всего времени в развлечениях: ${top.map(([l,m]) => `${l} (${fmtDur(Math.round(m/days.length))} в день)`).join(", ")}.`]);
  if(pick >= 60) out.push(["warn", `В среднем ${Math.round(pick)} разблокировок в день. Отключите уведомления у неважных приложений: каждое тянет взять телефон.`]);
  if(late >= 20) out.push(["warn", `После ${settings.screensOff} в среднем ${Math.round(late)} минут в телефоне. Это сдвигает засыпание.`]);
  if(prev.length >= 3){ const pe = avg(prev.map(p=>p.ent)); const df = ent - pe; if(Math.abs(df) >= 15) out.push([df < 0 ? "ok" : "warn", `Развлечений ${df < 0 ? "меньше" : "больше"}, чем на прошлой неделе, на ${fmtDur(Math.round(Math.abs(df)))} в день.`]); }
  return out;
}

/* ---------- journal: free-text log, intake, own activities ---------- */
function typeChipsHtml(cur, filter){
  const groups = {};
  for(const [k,t] of Object.entries(TYPES)){ if(filter && !filter(k)) continue; (groups[t.g] = groups[t.g]||[]).push(k); }
  return Object.entries(groups).map(([g, ks]) => `<div class="tgroup"><span class="label">${RITM.GROUPS[g].n}</span><div class="chips">${ks.map(k => `<button type="button" class="chip ${cur===k?"on":""}" data-cat="${k}"><i style="background:var(${CATS[k].c})"></i>${CATS[k].n}</button>`).join("")}</div></div>`).join("");
}
function chooseType(title, cur, cb){
  openSheet(`<h2>${esc(title)}</h2><div id="tcPick">${typeChipsHtml(cur)}</div><div class="tools"><button class="btn" id="tcCancel">Отмена</button></div>`);
  $("tcPick").onclick = e => { const b = e.target.closest("[data-cat]"); if(!b) return; closeSheet(); cb(b.dataset.cat); };
  $("tcCancel").onclick = closeSheet;
}
function describe(e){
  const p = [];
  if(e.time) p.push("в " + e.time);
  if(e.type === "sleep") return p.join(" · ");
  if(e.stepsOnly) p.push(fmtNum(e.steps) + " шагов");
  else if(e.min) p.push(e.min >= 60 && e.min % 30 === 0 ? String(e.min/60).replace(".",",") + " ч" : e.min + " мин");
  if(e.km) p.push(String(e.km).replace(".",",") + " км");
  if(e.ml) p.push(e.ml >= 1000 ? String(e.ml/1000).replace(".",",") + " л" : e.ml + " мл");
  if(e.mg) p.push("≈" + e.mg + " мг кофеина");
  if(e.g) p.push(e.g + " г белка");
  if(e.srv && !e.mg && !e.g && !e.ml){ const n = Math.round(e.srv*10)/10; p.push(String(n).replace(".",",") + " " + plural(Math.ceil(n),"порция","порции","порций")); }
  if(e.dose) p.push(e.dose);
  return p.join(" · ");
}
function intakeOf(log){
  const s = {kcal:0, fat:0, carb:0, water:0, mg:0, protein:0, alcohol:0, sweets:0, lastCaf:"", screen:0, lateScreen:0, move:0, groups:new Set()};
  for(const e of log||[]){
    if(e.type === "water") s.water += e.ml||0;
    if(e.type === "caffeine"){ s.mg += e.mg||0; if(e.time && e.time > s.lastCaf) s.lastCaf = e.time; }
    if(e.type === "protein") s.protein += e.g||0;
    if(e.kcal != null){ s.kcal += e.kcal; s.fat += e.f||0; s.carb += e.c||0; if(e.type !== "protein") s.protein += Math.round(e.p||0); }
    if(e.type === "alcohol") s.alcohol += e.srv||1;
    if(e.type === "sweets") s.sweets += e.srv||1;
    if(isScreen(e.type)){
      if(!e.plan) s.screen += e.min||0;
      if(e.time){ const st = +e.time.slice(0,2)*60 + +e.time.slice(3,5), off = +settings.screensOff.slice(0,2)*60 + +settings.screensOff.slice(3,5);
        const a = st < 6*60 ? st + 1440 : st, end = a + (e.min||0); s.lateScreen += Math.max(0, Math.min(end, 30*60) - Math.max(a, off)); }
    }
    if(CATS[e.type] && CATS[e.type].move && !e.plan) s.move += e.min||0;
    if(TYPES[e.type]) s.groups.add(TYPES[e.type].g);
  }
  return s;
}

function kbjuTarget(){ return RITM.calorieTarget(settings, stepsFor(dateOf(curKey(), todayI())) || 0); }
function kbjuHtml(s, bar){
  const tg = kbjuTarget();
  if(!s.kcal && !tg) return "";
  const head = s.kcal ? `${fmtNum(s.kcal)} ккал` : "—";
  const of = tg ? ` из ~${fmtNum(tg.kcal)}` : "";
  const mac = s.kcal ? `Б ${s.protein}${tg ? "/"+tg.protein : ""} · Ж ${Math.round(s.fat)}${tg ? "/"+tg.fat : ""} · У ${Math.round(s.carb)}${tg ? "/"+tg.carbs : ""} г` : (tg ? `Ориентир: Б ${tg.protein} · Ж ${tg.fat} · У ${tg.carbs} г` : "");
  return `<div class="metric kbju"><span class="mv">${head}</span><span class="mk">калорий${of}</span>${tg ? bar(s.kcal, tg.kcal, "--c-walk") : ""}<span class="note">${mac}${s.kcal ? " · оценка по таблицам" : ""}</span>${tg ? "" : `<span class="note">Укажите рост, возраст и пол в «Цели», чтобы посчитать норму.</span>`}</div>`;
}
let logDraft = null, logShowAll = false;
function journalHtml(ctx){
  const ck = curKey(), ti = todayI(), w = getWeek(ck), log = ((w.days[ti]||{}).log||[]).slice().sort((a,b)=>(a.time||"99").localeCompare(b.time||"99"));
  const s = intakeOf(log);
  const bar = (v, max, col) => `<div class="bar"><div class="dn" style="width:${Math.min(100, max ? v/max*100 : 0)}%;background:var(${col})"></div></div>`;
  let h = `<form data-log="${ctx}" class="logform logrow"><label class="sr" for="logInput-${ctx}">Что было? Пишите как удобно</label>
    <input id="logInput-${ctx}" type="text" enterkeyhint="send" autocomplete="off" placeholder="Что делал? Кофе в 9:30…">
    <button class="btn primary" type="submit">Записать</button></form>`;
  if(logDraft && logDraft.ctx === ctx){
    h += `<div class="preview"><span class="label">Понял так</span>` + logDraft.items.map((e,i) => `<div class="lrow ${e.type ? "" : "unknown"}">
      <span class="ldot" style="background:var(${e.type ? CATS[e.type].c : "--line"})"></span>
      <span class="lt">${esc(e.name)}<small>${e.type ? esc(describe(e)) : "Не знаю, что это. Выберите тип, и я запомню"}</small></span>
      <button class="chip ${e.type ? "" : "on"}" data-lpt="${i}">${e.type ? CATS[e.type].n : "Выбрать тип"}</button>
      <button class="x" data-lpx="${i}" aria-label="Убрать">×</button></div>`).join("") +
      (logDraft.items.length ? `<div class="tools"><button class="btn primary" data-lpsave="1">Сохранить</button><button class="btn" data-lpcancel="1">Отмена</button></div>`
                             : `<p class="note">Ничего не нашёл. Попробуйте написать иначе.</p><div class="tools"><button class="btn" data-lpcancel="1">Закрыть</button></div>`) + `</div>`;
  }
  const wg = settings.waterGoal, pg = settings.proteinGoal, cm = settings.caffeineMax;
  h += `<div class="intake">
    <div class="metric"><span class="mv">${s.water >= 1000 ? (s.water/1000).toFixed(1).replace(".",",")+" л" : s.water+" мл"}</span><span class="mk">воды из ${String(wg/1000).replace(".",",")} л</span>${bar(s.water, wg, "--c-pool")}
      <div class="qbtn"><button data-qw="250">+ стакан</button><button data-qw="500">+ бутылка</button></div></div>
    <div class="metric"><span class="mv">${s.mg} мг</span><span class="mk">кофеина${s.lastCaf ? ", последний в "+s.lastCaf : ""}</span>${bar(s.mg, cm, s.mg > cm ? "--warn" : "--c-fun")}</div>
    <div class="metric"><span class="mv">${s.protein} г</span><span class="mk">белка из ${pg} г</span>${bar(s.protein, pg, "--c-strength")}</div>
  </div>` + kbjuHtml(s, bar);
  if(log.length){
    const shown = logShowAll || log.length <= 6 ? log : log.slice(-6);
    h += `<div class="loglist"><span class="label">Записано сегодня</span>` + shown.map(e => `<div class="lrow">
      <span class="ldot" style="background:var(${(CATS[e.type]||CATS.other).c})"></span>
      <span class="lt">${esc(e.name)}<small>${esc(describe(e))}${e.plan ? " · из плана" : ""}</small></span>
      <button class="x" data-ldel="${e.id}" aria-label="Удалить">×</button></div>`).join("") +
      (log.length > 6 && !logShowAll ? `<button class="btn" data-lall="1">Показать все ${log.length}</button>` : "") + `</div>`;
  }
  return h;
}
function renderJournal(){ const el = $("logCard"); if(el) el.innerHTML = `<div class="bhead"><h2>Записать и отметить</h2><span class="note">вода, кофе, белок, дела</span></div>` + journalHtml("t"); }

function fillDefaults(e){
  const t = TYPES[e.type]; if(!t) return e;
  if(t.unit === "min" && !e.stepsOnly && e.min == null) e.min = t.def;
  if(e.type === "water" && !e.ml) e.ml = 250;
  if(e.type === "caffeine" && !e.mg) e.mg = 90 * (e.srv||1);
  if(e.type === "protein" && !e.g) e.g = 25 * (e.srv||1);
  if(t.unit === "srv" && !e.srv) e.srv = 1;
  if(e.type === "sleep" && !e.event) e.event = "bed";
  return e;
}
function submitLog(ctx){
  const ta = $("logInput-"+ctx); const text = ta ? ta.value.trim() : ""; if(!text) return;
  const items = RITM.parse(text).map(e => { if(e.unknown) e.wasUnknown = true; return e.type ? fillDefaults(e) : e; });
  logDraft = {ctx, items, text};
  render();
}
function saveLogDraft(){
  if(!logDraft) return;
  if(logDraft.items.some(e => !e.type)){ toast("Выберите тип для записей без типа или уберите их"); return; }
  const k = curKey(), d = todayI(), items = logDraft.items;
  mutateQuiet(k, w => {
    const day = w.days[d] = {...(w.days[d]||{})}; day.log = (day.log||[]).slice();
    for(const e of items){
      if(e.changed || e.wasUnknown) RITM.remember(e.text, e.type, e.wasUnknown ? e.name : null);
      const rec = {id:uid(), type:e.type, name:e.name, time:e.time||"", text:e.text};
      for(const f of ["min","km","ml","mg","g","srv","steps","stepsOnly","event","dose","derived"]) if(e[f] != null) rec[f] = e[f];
      if(rec.stepsOnly) day.stepsManual = rec.steps;
      if(TYPES[rec.type].unit === "min" && !rec.stepsOnly){
        const it = w.items.find(i => i.day===d && i.cat===rec.type && !i.done);
        if(it){ it.done = true; rec.plan = it.id; if(day.review && day.review.entries && day.review.entries[it.id]) day.review.entries[it.id] = {done:true, min:rec.min}; }
      }
      day.log.push(rec);
    }
  });
  const n = items.length; logDraft = null;
  if(rvState) rvState = getReview(getWeek(k), d);
  render(); toast(`Записано: ${n} ${plural(n,"запись","записи","записей")}`);
}
function quickWater(ml){
  const k = curKey(), d = todayI();
  mutateQuiet(k, w => { const day = w.days[d] = {...(w.days[d]||{})}; day.log = (day.log||[]).concat([{id:uid(), type:"water", name:"Вода", time:nowHM(), ml}]); });
  render(); toast(`+${ml} мл воды`);
}
function deleteLog(id){
  const k = curKey(), d = todayI();
  mutateQuiet(k, w => { const day = w.days[d] = {...(w.days[d]||{})}; const e = (day.log||[]).find(x=>x.id===id);
    if(e && e.plan){ const it = w.items.find(i=>i.id===e.plan); if(it) it.done = false; }
    day.log = (day.log||[]).filter(x=>x.id!==id); });
  if(rvState) rvState = getReview(getWeek(k), d);
  render(); toast("Запись удалена");
}
function journalClick(ds, t){
  if(ds.lpt != null && logDraft){ const e = logDraft.items[+ds.lpt]; chooseType(`Что такое «${e.name}»?`, e.type, c => { e.type = c; e.changed = true; e.unknown = false; if(e.wasUnknown && !e.name) e.name = CATS[c].n; fillDefaults(e); render(); }); return true; }
  if(ds.lpx != null && logDraft){ logDraft.items.splice(+ds.lpx, 1); render(); return true; }
  if(ds.lpsave){ saveLogDraft(); return true; }
  if(ds.lpcancel){ logDraft = null; render(); return true; }
  if(ds.qw){ quickWater(+ds.qw); return true; }
  if(ds.ldel){ confirmIn(t, "Удалить?", () => deleteLog(ds.ldel)); return true; }
  if(ds.lall){ logShowAll = true; render(); return true; }
  return false;
}
document.addEventListener("submit", e => { const f = e.target.closest("form[data-log]"); if(!f) return; e.preventDefault(); submitLog(f.dataset.log); });

/* own activities */
let actDraft = {n:"", t:null, manual:false}, actOpen = false;
function renderActs(){
  const el = $("actsCard"); if(!el) return;
  const list = customActs();
  el.innerHTML = `<h2>Мои занятия</h2>
    <p class="note">В базе ${RITM.CATALOG.length} занятий${list.length ? ", ваших " + list.length : ""}. Своё занятие приложение будет узнавать в журнале и предлагать в советах.</p>
    <details class="base" ${actOpen ? "open" : ""}><summary>Добавить своё занятие</summary>
    <div class="field"><label class="label" for="actName">Название</label><input id="actName" type="text" value="${esc(actDraft.n)}" placeholder="Например, флорбол или прогулка с собакой" autocomplete="off"></div>
    <div class="field"><span class="label">Тип ${actDraft.t && !actDraft.manual ? '<span class="note">— определил по названию</span>' : ""}</span><div id="actType">${typeChipsHtml(actDraft.t, k => k !== "sleep")}</div></div>
    <div class="tools"><button class="btn primary" id="actAdd">Добавить занятие</button></div></details>
    ${list.length ? `<span class="label">Ваши занятия</span>` + list.map((a,i) => `<div class="lrow"><span class="ldot" style="background:var(${(CATS[a.t]||CATS.other).c})"></span><span class="lt">${esc(a.n)}<small>${(CATS[a.t]||CATS.other).full}</small></span><button class="x" data-actdel="${i}" aria-label="Удалить">×</button></div>`).join("") : ""}
    <details class="base"><summary>Посмотреть всю базу</summary><input id="actSearch" type="search" placeholder="Поиск по базе" autocomplete="off"><div id="actBase"></div></details>`;
  const det = el.querySelector("details.base"); if(det) det.ontoggle = () => { actOpen = det.open; };
  const inp = $("actName");
  inp.oninput = () => { actDraft.n = inp.value; if(!actDraft.manual){ const g = RITM.guessType(actDraft.n); actDraft.t = g; $("actType").innerHTML = typeChipsHtml(actDraft.t, k => k !== "sleep"); } };
  $("actType").onclick = e => { const b = e.target.closest("[data-cat]"); if(!b) return; actDraft.t = b.dataset.cat; actDraft.manual = true; $("actType").innerHTML = typeChipsHtml(actDraft.t, k => k !== "sleep"); };
  $("actAdd").onclick = () => {
    const n = actDraft.n.trim(); if(!n){ toast("Напишите название"); return; } if(!actDraft.t){ toast("Выберите тип"); return; }
    const arr = customActs(); arr.push({n, t:actDraft.t, a:n.toLowerCase().replace(/ё/g,"е"), m:TYPES[actDraft.t].def}); LS.set("custom", arr);
    actDraft = {n:"", t:null, manual:false}; renderActs(); toast("Занятие добавлено");
  };
  const srch = $("actSearch"), base = $("actBase");
  const draw = () => { const q = (srch.value||"").toLowerCase().replace(/ё/g,"е"); const res = RITM.CATALOG.filter(e => !q || e.n.toLowerCase().replace(/ё/g,"е").includes(q) || CATS[e.t].full.toLowerCase().includes(q)).slice(0, 60);
    base.innerHTML = res.map(e => `<div class="lrow"><span class="ldot" style="background:var(${CATS[e.t].c})"></span><span class="lt">${esc(e.n)}<small>${CATS[e.t].full}${e.s ? " · "+esc(e.s) : ""}</small></span></div>`).join("") || `<p class="note">Ничего не нашлось. Добавьте это занятие выше.</p>`; };
  srch.oninput = draw; draw();
}
/* что Ритм не понял: можно объяснить в одно нажатие или сохранить список */
const MISS_WHY = {unknown:"не знал такого занятия", chat:"принял за разговор", nothing:"ничего не понял", question:"не нашёл ответа"};
function renderMisses(){
  const el = $("missCard"); if(!el) return;
  const list = (LS.get("misses") || []).slice().reverse();
  el.hidden = !list.length; if(!list.length){ el.innerHTML = ""; return; }
  el.innerHTML = `<h2>Что я не понял</h2>
    <p class="note">Фразы, на которых я споткнулся. Подскажи, что это было, и я запомню. Список можно сохранить и прислать разработчику, чтобы научить меня новым словам.</p>
    ${list.slice(0, 20).map((x, i) => `<div class="lrow miss"><span class="lt">«${esc(x.text.length > 90 ? x.text.slice(0, 90) + "…" : x.text)}»<small>${fmtTime(x.at)} · ${MISS_WHY[x.why] || ""}</small></span>
      <span class="mbtns"><button class="btn sm" data-missact="${esc(x.text)}">Занятие…</button><button class="btn sm" data-missnot="${esc(x.text)}">Не занятие</button><button class="x" data-missdel="${esc(x.text)}" aria-label="Убрать">×</button></span></div>`).join("")}
    <div class="tools"><button class="btn" id="missSave">Сохранить список</button><button class="btn" id="missClear">Очистить</button></div>`;
  $("missSave").onclick = () => download("ritm-ne-ponyal.txt", (LS.get("misses") || []).map(x => `${new Date(x.at).toISOString().slice(0,16).replace("T"," ")}\t${x.why}\t${x.text}`).join("\n"), "text/plain");
  $("missClear").onclick = () => { LS.set("misses", []); renderMisses(); toast("Список очищен"); };
}
function missClick(ds){
  if(ds.missdel != null){ LS.set("misses", (LS.get("misses") || []).filter(x => x.text !== ds.missdel)); renderMisses(); return true; }
  if(ds.missnot != null){ RITM.forget(ds.missnot); LS.set("misses", (LS.get("misses") || []).filter(x => x.text !== ds.missnot)); renderMisses(); toast("Запомнил: это не занятие"); return true; }
  if(ds.missact != null){ const text = ds.missact;
    chooseType(`Что такое «${text.slice(0, 40)}»?`, RITM.guessType(text), t => { const nm = (RITM.core(text) || text).trim(); RITM.remember(text, t, nm.charAt(0).toUpperCase() + nm.slice(1, 50));
      LS.set("misses", (LS.get("misses") || []).filter(x => x.text !== text)); renderMisses(); toast(`Запомнил: ${CATS[t].full.toLowerCase()}`); });
    return true; }
  return false;
}
function actsClick(ds){ if(ds.actdel == null) return false; const arr = customActs(); arr.splice(+ds.actdel, 1); LS.set("custom", arr); renderActs(); toast("Удалено"); return true; }

/* ---------- day review: input, analysis, plan corrections ---------- */
const MOVE = c => !!(CATS[c] && CATS[c].move);
const defaultMin = it => { const m = /(\d+)\s*(?:–\d+\s*)?мин/.exec(it.t || ""); if(m) return +m[1]; const c = RITM.CATALOG.find(e=>e.n===it.t) || customActs().find(e=>e.n===it.t); if(c && c.m) return c.m; return (TYPES[it.cat]||TYPES.other).def || 30; };
const hmMinus = (hm, m) => { const [h,mm] = hm.split(":").map(Number); let t = (h*60+mm-m+1440)%1440; return pad(Math.floor(t/60))+":"+pad(t%60); };
function usualBedtime(){
  if(getRoutine().bedSet && settings.bedtime) return {hm: settings.bedtime, auto:false};
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
  const linked = {}; for(const x of ((w.days[d]||{}).log||[])) if(x.plan) linked[x.plan] = x;
  for(const it of its){ const e = (old.entries||{})[it.id]; entries[it.id] = e ? {...e} : (linked[it.id] ? {done:true, min:linked[it.id].min||defaultMin(it)} : {done:!!it.done, min:defaultMin(it)}); }
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
  const L = intakeOf(h.log);
  const undone = its.filter(i=>!isScreen(i.cat) && !(rv.entries[i.id] && rv.entries[i.id].done));
  const moveMin = doneIts.filter(i=>MOVE(i.cat)).reduce((s,i)=>s+(rv.entries[i.id].min||0),0) + rv.extras.filter(x=>MOVE(x.cat)).reduce((s,x)=>s+(x.min||0),0) + L.move;
  const PD = phoneDay(ds);
  const otherDevice = c => c === "gaming" || c === "series";
  const screenMin = PD ? PD.ent + doneIts.filter(i=>otherDevice(i.cat)).reduce((s,i)=>s+(rv.entries[i.id].min||0),0) + (h.log||[]).filter(e=>otherDevice(e.type) && !e.plan).reduce((s,e)=>s+(e.min||0),0)
    : doneIts.filter(i=>isScreen(i.cat)).reduce((s,i)=>s+(rv.entries[i.id].min||0),0) + rv.extras.filter(x=>isScreen(x.cat)).reduce((s,x)=>s+(x.min||0),0) + L.screen;
  const steps = stepsFor(ds) ?? rv.steps;
  const sl = sleepFor(ds);
  const stt = sleepTotal(ds), sleepMin = stt ? stt.min : (sl ? sl.min : (rv.sleepH != null ? rv.sleepH*60 : null));
  const goalSteps = settings.stepsGoal;
  const screenH = screenMin ? screenMin/60 : (rv.screen != null ? rv.screen : null);
  const weekMin = activeMinutesWeek(w, ck, ti, rv), pace = Math.round(150/7*(ti+1));
  const did = c => doneIts.some(i=>i.cat===c) || rv.extras.some(x=>x.cat===c) || (h.log||[]).some(e=>e.type===c);
  const cafLate = rv.caffeine || (L.lastCaf && L.lastCaf > settings.caffeineCutoff), hadAlcohol = rv.alcohol || L.alcohol > 0;
  const good = [], bad = [], tips = [];

  if(steps != null){ if(steps >= goalSteps) good.push(`${fmtNum(steps)} шагов: дневная цель выполнена.`); else if(steps >= goalSteps*0.7) good.push(`${fmtNum(steps)} шагов: почти цель.`); else if(steps < goalSteps*0.5) bad.push(`Всего ${fmtNum(steps)} шагов при цели ${fmtNum(goalSteps)}.`); }
  if(moveMin >= 30) good.push(`${moveMin} минут движения. Это больше дневной нормы (около 20–30 минут, чтобы набрать 150 в неделю).`);
  else if(moveMin > 0) good.push(`${moveMin} минут движения. Хорошо, но до дневной нормы чуть-чуть не хватило.`);
  else bad.push("Сегодня не было движения сверх обычного.");
  if(did("strength")) good.push("Силовая сделана. Мышцам нужно 2 таких дня в неделю.");
  if(did("social")) good.push("Было живое общение. Это один из самых сильных факторов настроения.");
  if(did("unplug")) good.push("Было время без экранов.");
  if(did("outing") || did("hobby")) good.push("Нашлось время просто для удовольствия.");
  if(did("nature")) good.push("Время на природе: один из самых простых способов снизить стресс.");
  if(did("reading") || did("learning")) good.push("Было время на чтение или развитие.");
  if(did("mobility") || did("relax")) good.push("Позаботились о восстановлении: растяжка или отдых.");
  if(["move","social","rest"].filter(g => L.groups.has(g) || doneIts.some(i=>TYPES[i.cat] && TYPES[i.cat].g===g)).length >= 3) good.push("Разнообразный день: движение, люди и отдых.");
  const wg = settings.waterGoal, pg = settings.proteinGoal;
  if(L.water >= wg) good.push(`Воды ${String(L.water/1000).replace(".",",")} л: норма выполнена.`);
  else if(L.water > 0 && L.water < wg*0.6) bad.push(`Воды всего ${L.water} мл при цели ${String(wg/1000).replace(".",",")} л.`);
  if(L.protein >= pg) good.push(`Белка ${L.protein} г: цель закрыта.`);
  if(L.mg > settings.caffeineMax) bad.push(`Кофеина около ${L.mg} мг: больше безопасных ${settings.caffeineMax} мг в день.`);
  if(L.sweets >= 3) bad.push("Много сладкого за день.");
  const lateMin = Math.max(L.lateScreen, PD ? PD.late : 0);
  if(lateMin >= 10) bad.push(`Экраны после ${settings.screensOff}: ${lateMin} мин.`);
  if(PD){
    if(PD.total >= 300) bad.push(`Телефон ${fmtDur(PD.total)} за день.`); else if(PD.total <= 120 && new Date().getHours() >= 18) good.push(`Телефон всего ${fmtDur(PD.total)} за день.`);
    if(PD.pickups >= 80) bad.push(`${PD.pickups} разблокировок телефона.`);
  }
  if(NATIVE){ const t0 = new Date(); t0.setHours(0,0,0,0); const ns = nudgeStats(t0.getTime(), Date.now()+1);
    if(ns.obeyed) good.push(`Послушался и сделал перерыв от телефона: ${ns.obeyed} ${plural(ns.obeyed,"раз","раза","раз")}.`);
    if(ns.ignored) bad.push(`Проигнорировал мои просьбы сделать перерыв: ${ns.ignored} ${plural(ns.ignored,"раз","раза","раз")}` + (ns.promisedIgnored ? `, хотя ${ns.promisedIgnored === 1 ? "один раз обещал" : "обещал"} выключить` : "") + "."); }
  const topEnt = PD ? PD.apps.filter(a => APP_GROUPS[a.grp] && APP_GROUPS[a.grp].ent)[0] : null;
  if(h.light) good.push("Был дневной свет. Это помогает и бодрости днём, и сну ночью.");
  if(sleepMin != null){ if(sleepEnough(sleepMin) || (h.energy >= 4 && sleepMin >= 300)) good.push(`Сон ${fmtDur(sleepMin)}: ${h.energy >= 4 && !sleepEnough(sleepMin) ? "меньше ориентира, но самочувствие хорошее — тебе, видимо, хватает" : "в норме"}.`); else if(sleepLow(sleepMin)) bad.push(`Сон ${fmtDur(sleepMin)}: меньше твоей нормы (${needText()}).`); }
  if(its.length && !undone.length) good.push("Все дела из плана выполнены.");
  else if(undone.length) bad.push(`Не получилось: ${undone.map(i=>i.t).join("; ")}.`);
  if(screenMin > settings.screenLimit) bad.push(`Экраны ${fmtDur(screenMin)} при вашем лимите ${fmtDur(settings.screenLimit)}.`);
  else if(screenMin === 0 && rv.screen != null && rv.screen >= 2) bad.push("Больше 2 часов на экраны.");
  else if(screenMin === 0 && rv.screen === 0) good.push("День почти без развлекательных экранов.");
  if(cafLate) bad.push(L.lastCaf ? `Последний кофеин в ${L.lastCaf}: после ${settings.caffeineCutoff} он может сдвинуть засыпание на час и больше.` : "Кофе во второй половине дня: может сдвинуть засыпание.");
  if(hadAlcohol) bad.push("Алкоголь: засыпается легче, но глубокий сон хуже.");
  if(h.energy && h.energy <= 2) bad.push(`Энергия низкая (${h.energy} из 5).`);
  if(h.energy && h.energy >= 4) good.push(`Энергия ${h.energy} из 5.`);
  if(rv.stress != null && rv.stress >= 4) bad.push(`Высокий стресс (${rv.stress} из 5).`);

  const bed = usualBedtime().hm;
  if(sleepLow(sleepMin) && !(h.energy >= 4)) tips.push(`Сегодня ложитесь не позже ${bed}, а лучше на 30 минут раньше: после короткой ночи организму нужно наверстать.`);
  if(cafLate) tips.push(`Завтра последний кофе до ${settings.caffeineCutoff}.`);
  if(L.water > 0 && L.water < wg*0.6) tips.push("Выпивайте стакан воды с каждым приёмом пищи и держите бутылку на столе: так проще добрать норму.");
  if(L.water === 0) tips.push("Записывайте воду кнопкой «+ стакан» в журнале: так я смогу подсказать, хватает ли её.");
  if((did("strength") || did("sport")) && L.protein < pg*0.6) tips.push("В день силовой белок помогает восстановлению: творог, яйца, мясо, рыба или протеин.");
  if(hadAlcohol) tips.push("Если завтра хочется отдохнуть, попробуйте без алкоголя и сравните, как будете спать.");
  if(topEnt && screenMin > settings.screenLimit) tips.push(`Больше всего времени ушло на ${topEnt.l} (${fmtDur(topEnt.m)}). Поставьте на него таймер: Настройки → Цифровое благополучие → Таймеры приложений.`);
  if(PD && PD.pickups >= 80) tips.push("Отключите уведомления у соцсетей и игр: меньше поводов брать телефон.");
  if(lateMin >= 20) tips.push(`Включите режим «Отход ко сну» в Цифровом благополучии на ${settings.screensOff}: экран станет серым, и залипать сложнее.`);
  else if((screenMin > settings.screenLimit) || (rv.screen != null && rv.screen >= 2)) tips.push(`Ограничьте игры и Ютуб часом и заканчивайте к ${settings.screensOff}.`);
  if(steps != null && steps < goalSteps*0.7) tips.push(`Добавьте 20–30 минут ходьбы: прогулка после ужина даёт около 2 000–3 000 шагов.`);
  if(weekMin < pace) tips.push(`За неделю пока ${weekMin} минут движения при ориентире ${pace} на сегодня (150 в неделю — рекомендация ВОЗ). Небольшие прогулки быстро закрывают разницу.`);
  if(rv.stress != null && rv.stress >= 4) tips.push("Перед сном 10 минут спокойной прогулки или медленного дыхания (вдох на 4, выдох на 6) снижают напряжение.");
  if(h.energy && h.energy <= 2 && moveMin === 0) tips.push("В дни без движения энергия часто ниже. Завтра начните с короткой прогулки на свету.");
  if(!tips.length) tips.push("Хороший баланс. Завтра повторите то, что сработало сегодня.");

  const score = good.length - bad.length;
  const verdict = score >= 3 ? "Сильный день" : score >= 1 ? "Хороший день" : score >= -1 ? "Неплохой день, есть что подтянуть" : "Тяжёлый день. Бывает, завтра будет легче";
  return {verdict, good, bad, tips: tips.slice(0,5), props: proposeChanges(rv, {sleepMin, steps, screenH, energy:h.energy, stress:rv.stress})};
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
  const bestDay = (c, avoid=-1) => { let b=-1, bl=99; for(let d=from; d<=to; d++){ if(d===avoid || taken(d,c)) continue; const l = load[d] + (c==="swim" && d<5 ? 2 : 0) + (d===tomorrow && sleepLow(m.sleepMin) && (c==="strength"||c==="swim") ? 5 : 0); if(l<bl){ bl=l; b=d; } } return b; };
  const tired = (sleepLow(m.sleepMin) && !(m.energy >= 4)) || (m.energy && m.energy <= 2) || (m.stress != null && m.stress >= 4);

  // 1. undone goal items from today → move forward
  if(!last) for(const it of cw.items.filter(i=>i.day===ti && goalCats().includes(i.cat) && !(rv.entries[i.id] && rv.entries[i.id].done))){
    const d = bestDay(it.cat); if(d < 0) continue;
    props.push({type:"move", key:ck, id:it.id, day:d, cat:it.cat, text:`Перенести «${it.t}» ${DACC[d]}`, why:"Не получилось сегодня, но до конца недели есть место"}); load[d]++;
  }
  // 2. tired → lighten tomorrow
  if(tired){
    for(const it of w.items.filter(i=>i.day===tomorrow && (i.cat==="strength"||i.cat==="swim") && !i.done)){
      const d = bestDay(it.cat, tomorrow);
      if(d >= 0 && d !== tomorrow){ props.push({type:"move", key, id:it.id, day:d, cat:it.cat, text:`Сдвинуть «${it.t}» с завтра ${DACC[d]}`, why:"После короткого сна или тяжёлого дня интенсивная нагрузка даётся хуже"}); load[d]++; }
    }
    if(!taken(tomorrow,"walk")){ props.push({type:"add", key, day:tomorrow, cat:"walk", t:"Лёгкая прогулка на свету, 20 мин", time:"", text:`Добавить завтра лёгкую прогулку`, why:"Мягко поднимает энергию без перегрузки"}); load[tomorrow]++; }
    props.push({type:"add", key, day:tomorrow, cat:"unplug", t:"Лечь пораньше, без экрана", time:hmMinus(usualBedtime().hm, 30), text:`Завтра лечь на 30 минут раньше`, why:"Чтобы вернуть недосып"});
  }
  // 3. low steps → walk tomorrow
  if(m.steps != null && m.steps < settings.stepsGoal*0.5 && !taken(tomorrow,"walk")){
    props.push({type:"add", key, day:tomorrow, cat:"walk", t:"Прогулка после ужина, 30 мин", time:"20:00", text:`Добавить завтра прогулку после ужина`, why:`Сегодня было ${fmtNum(m.steps)} шагов`}); load[tomorrow]++;
  }
  // 4. late screens → move tomorrow's games earlier
  if(m.screenH != null && m.screenH >= 2){
    for(const it of w.items.filter(i=>i.day===tomorrow && isScreen(i.cat) && (!i.time || i.time > "20:00"))){
      props.push({type:"time", key, id:it.id, time:"19:30", cat:it.cat, day:tomorrow, text:`Перенести «${it.t}» завтра на 19:30 и ограничить часом`, why:"Чтобы к отбою мозг успел успокоиться"});
    }
  }
  // 5. remaining weekly deficits → add varied ideas
  if(!last){
    const gs = goalState(cw, ti+1), recent = recentTitles();
    for(const c of goalCats()){
      let need = gs[c].deficit - props.filter(p=>p.cat===c && (p.type==="add" || p.type==="move")).length;
      // items moved forward from today were counted as missed; moving them makes them future again
      let off = 0;
      while(need > 0){
        const d = bestDay(c); if(d < 0) break;
        const idea = ideasFor(c, d, null, off++, recent) || {t:CATS[c].n, time:""};
        recent.add(idea.t);
        props.push({type:"add", key, day:d, cat:c, t:idea.t, time:smartTime(c, d, idea.time||""), text:`Добавить ${DACC[d]}: ${idea.t}`, why:`До цели недели не хватает: ${CATS[c].n.toLowerCase()}`});
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
  const st = stepsFor(ds), sl = sleepFor(ds);
  const seg = (name, opts, cur) => `<div class="seg">${opts.map(([v,l]) => `<button class="${cur===v?"on":""}" data-rvset="${name}" data-v="${v}">${l}</button>`).join("")}</div>`;
  const scale = (key, cur) => `<div class="row">${[1,2,3,4,5].map(n=>`<button class="${cur===n?"on":""}" data-rv${key}="${n}">${n}</button>`).join("")}</div>`;

  let html = `<section class="rvsec"><div class="bhead"><h2>Что было сегодня</h2><span class="note">отметьте и поправьте минуты</span></div>
    ${rows || `<p class="note">В плане на сегодня ничего не было. Добавьте, чем занимались, ниже.</p>`}${extras}
</section>
    <section class="card"><h2>Журнал дня</h2><p class="note">Допишите всё, что было вне плана: еду, напитки, экраны, любые занятия.</p>${journalHtml("r")}</section>
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
    ${intakeOf(h.log).screen ? "" : `<section class="card"><h2>Экраны</h2><p class="note">Если не записывали игры, видео и соцсети в журнал, оцените примерно.</p>
      ${seg("screen", [[0,"почти не было"],[1,"до часа"],[1.5,"1–2 часа"],[2,"больше 2 часов"]], rv.screen)}</section>`}
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
function checkOpen(){ if(!NATIVE) return false; let o = ""; try{ o = NATIVE.consumeOpen(); }catch(e){} if(o === "review"){ closeSheet(); openReview(); return true; } if(o === "chat"){ closeSheet(); tab = "chat"; render(); scrollChat(); return true; } if(o === "today"){ closeSheet(); tab = "today"; render(); return true; } return false; }
/* ---------- прогулки по шагам: замечаем ходьбу и предлагаем записать ---------- */
// сегмент: подряд идущие 10-минутные отрезки, где ≥60 шагов в минуту; ≥15 минут и ≥1200 шагов
function walkSegments(buckets, nowMs){
  const B = (buckets||[]).map(b => ({t: new Date(b.t).getTime(), n: b.n})).filter(b => !isNaN(b.t)).sort((a,b) => a.t - b.t);
  const segs = []; let cur = null;
  for(const b of B){
    const hot = b.n >= 600, warm = b.n >= 200;
    if(cur && b.t - cur.end <= 10*60000 && (hot || warm && cur.lastHot)){ cur.end = b.t + 10*60000; cur.steps += b.n; cur.lastHot = hot; if(hot) cur.hotEnd = b.t + 10*60000; continue; }
    if(cur) segs.push(cur); cur = null;
    if(hot) cur = {start: b.t, end: b.t + 10*60000, hotEnd: b.t + 10*60000, steps: b.n, lastHot: true};
  }
  if(cur) segs.push(cur);
  return segs.map(g => ({start:g.start, end:g.hotEnd, steps:g.steps, min:Math.round((g.hotEnd - g.start)/60000)}))
             .filter(g => g.min >= 20 && g.steps >= 1200 && g.end <= nowMs - 10*60000);
}
function suggestWalks(){
  return;   // теперь прогулки показывает карточка «Заметил за день» на экране «Сегодня»
  if(!health || !health.stepBuckets || !health.stepBuckets.length) return;
  const seen = LS.get("walkSeen") || {}, bad = LS.get("walkNo") || {}, nowMs = Date.now();
  let posted = 0;
  for(const g of walkSegments(health.stepBuckets, nowMs)){
    if(posted >= 2) break;
    const id = String(g.start); if(seen[id]) continue;
    const st = new Date(g.start), en = new Date(g.end), hh = st.getHours();
    if((bad[hh] || 0) >= 2){ seen[id] = 1; continue; }                                 // в это время вы уже дважды говорили «это не прогулка»
    const k = dateKeyOf(st), d = dayIdxOf(st), w = getWeek(k), day = (w.days && w.days[d]) || {};
    const a0 = g.start, a1 = g.end, hmOf = x => x.time ? +x.time.slice(0,2)*60 + +x.time.slice(3,5) : null, m0 = st.getHours()*60 + st.getMinutes(), m1 = m0 + g.min;
    const busy = (day.log||[]).some(e => e.type !== "water" && e.type !== "caffeine" && hmOf(e) != null && (CATS[e.type] && CATS[e.type].move) && e.min && hmOf(e) < m1 && hmOf(e) + e.min > m0)
      || (day.log||[]).some(e => e.src === "steps" && hmOf(e) != null && Math.abs(hmOf(e) - m0) < 20);
    if(busy){ seen[id] = 1; continue; }
    // дорога на работу и с работы обычно не прогулка: если сегмент вплотную к рабочим границам — всё равно спрашиваем, но нейтрально
    const t0 = fmtHM(st), t1 = fmtHM(en);
    seen[id] = 1; posted++;
    bot(`Заметил по шагам: с ${t0} до ${t1} вы шли около ${g.min} минут, ${fmtNum(g.steps)} шагов. Записать как прогулку?`,
      [act("Да, записать прогулку", {op:"walkAdd", key:k, d, time:t0, min:g.min, steps:g.steps}), act("Это не прогулка (дорога, дела)", {op:"walkNo", hour:hh})]);
  }
  LS.set("walkSeen", seen);
}
const fmtHM = d => pad(d.getHours()) + ":" + pad(d.getMinutes());

window.__ritmNative = {
  onHealth(json){
    try{ const d = JSON.parse(json); if(d.error) return;
      health = {apps:d.apps||{}, steps:d.steps||{}, sleep:d.sleep||{}, sessions:d.sessions||[], stepBuckets:d.stepBuckets||[], stepsGranted:!!d.stepsGranted, sleepGranted:!!d.sleepGranted, bgGranted:!!d.bgGranted, usage:!!d.usage, at:d.at};
      LS.set("health", health); try{ suggestWalks(); }catch(e){} try{ syncWalkWatch(); }catch(e){} render();
    }catch(e){}
  },
  onResume(){ try{ NATIVE.refreshHealth(); }catch(e){} pullNative(); maybeAutoBackup(); if(tab === "chat" && !maybeWeeklyReport() && !morningBrief()) askRoutine(); if(!checkOpen()) render(); scrollChat(); },
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
  $("nWake").onchange = () => { if($("nWake").value){ settings.wake = $("nWake").value; persistSettings(); render(); toast("Сохранено"); } };
  $("nLunch").onchange = () => { if($("nLunch").value){ settings.lunch = $("nLunch").value; persistSettings(); render(); toast("Сохранено"); } };
  $("nFreq").onclick = e => { const b = e.target.closest("[data-freq]"); if(!b) return; settings.checkins = +b.dataset.freq; persistSettings(); render(); toast("Сохранено"); };
  $("nDiag").onclick = () => { let d = {}; try{ d = JSON.parse(NATIVE.diag()); }catch(e){ $("nDiagOut").textContent = "Эта версия приложения не умеет показывать состояние будильников. Обновите приложение."; return; }
    const on = x => x ? "включено" : "выключено";
    $("nDiagOut").textContent = ["Утренний план: " + (d.morning||"—") + " (" + on(d.enabled) + "), ближайший " + d.nextMorning,
      "Вечерний вопрос: " + (d.evening||"—") + " (" + on(d.enabled) + "), ближайший " + d.nextEvening,
      "Разбор дня: " + (d.review||"—") + " (" + on(d.reviewEnabled) + "), ближайший " + d.nextReview + ". В приложении сейчас: " + reviewTime() + ".",
      "Уведомления Android: " + (d.notif ? "разрешены" : "ЗАПРЕЩЕНЫ"),
      "Экономия батареи: " + (d.batteryUnrestricted ? "без ограничений" : "включена, Android может задерживать напоминания (Настройки → Приложения → Ритм недели → Батарея → Без ограничений)")].join("\n");
    if(d.review && d.review !== reviewTime()){ lastReviewSync = ""; syncNative(); $("nDiagOut").textContent += "\nВремя разбора не совпало, отправил заново. Нажмите ещё раз."; } };
  $("nTestCheckin").onclick = () => { try{ NATIVE.testCheckin(); }catch(e){} };
  $("nWatch").onclick = e => { const b = e.target.closest("[data-watch]"); if(!b) return; settings.watchMin = +b.dataset.watch; persistSettings(); render(); toast("Сохранено"); };
  $("nTestWatch").onclick = () => { syncWatch(); try{ NATIVE.testWatch(); toast("Проверил. Если есть повод, придёт уведомление"); }catch(e){} };
  $("nBed").onchange = () => { if($("nBed").value){ setBedtime($("nBed").value); if(postIssues(restOfWeek(), 3)) toast("Время отбоя сохранено. В чате предложил поправить план"); else toast("Время отбоя сохранено"); render(); } };
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

render(); renderBackupNote(); setTimeout(maybeAutoBackup, 3000);
pullNative();
if(tab === "chat" && getChat().length) { if(!maybeWeeklyReport() && !morningBrief()) askRoutine(); render(); }
if(!checkOpen()) scrollChat();
$("chatForm").addEventListener("submit", e => { e.preventDefault(); const v = $("chatInput").value; $("chatInput").value = ""; sendChat(v); });
$("chatInput").addEventListener("keydown", e => { if(e.key === "Enter" && !e.shiftKey){ e.preventDefault(); $("chatForm").requestSubmit(); } });
// крючок для автотестов (без влияния на работу)
window.__ritmT = {sleepTotal, sleepNeed, learnSleepNeed, logSleepWords, curKey, todayI, getWeek, pushMsg, render, morningBrief, nightFacts};
})();
