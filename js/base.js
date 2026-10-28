// Rhythm · ES-модуль (base.js). Зависимости объявлены явно; запуск — через init() из main.js.
import {history, mean} from "./insights.js";
import {toast} from "./render.js";
// Rhythm · Основа: справочники, хранилище, данные телефона, сон
// Часть интерфейса: общая область видимости со всеми js/*.js (порядок подключения в index.html важен).

export const TYPES = RITM.TYPES;
export const CATS = Object.fromEntries(Object.entries(TYPES).map(([k,t]) => [k, {n:t.short||t.n, full:t.n, g:t.gen, c:t.c, move:t.g==="move", grp:t.g, unit:t.unit}]));
export const GOALABLE = Object.keys(TYPES).filter(k => ["move","rest","social"].includes(TYPES[k].g) && TYPES[k].unit === "min");
export const isScreen = c => !!(CATS[c] && CATS[c].grp === "screen");
export const goalCats = () => GOALABLE.filter(c => (settings.goals[c]||0) > 0);
const DEFAULT_SETTINGS = {goals:{strength:2,walk:3,swim:1,mobility:2,social:2,unplug:1,outing:1,nature:1}, waterGoal:2000, caffeineMax:400, caffeineCutoff:"14:00", proteinGoal:100, screenLimit:120, screensOff:"22:30", morning:"08:45", evening:"19:45", stepsGoal:7000, notify:false, bedtime:"23:30", reviewOn:true};
export const DW = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
export const DFULL = ["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота","Воскресенье"];
export const DACC = ["в понедельник","во вторник","в среду","в четверг","в пятницу","в субботу","в воскресенье"];
export const MON = ["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"];
export const MONG = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
export const TEMPLATE = [
  [0,"strength","Силовая дома: всё тело","19:00"],[0,"gaming","Видеоигры, до часа","21:00"],
  [1,"walk","Быстрая прогулка","18:30"],[1,"social","Позвонить родителям или близким",""],
  [2,"mobility","Растяжка","21:00"],[2,"unplug","Вечер без экранов","21:00"],
  [3,"strength","Силовая дома: ноги и кор","19:00"],[3,"video","Ютуб, до часа","21:00"],[3,"social","Написать старому знакомому",""],
  [4,"walk","Прогулка после ужина","20:00"],[4,"outing","Кино, кафе или встреча с друзьями",""],[4,"gaming","Видеоигры с друзьями голосом","21:30"],
  [5,"swim","Бассейн с ускорениями","11:00"],[5,"nature","Парк или набережная","13:00"],
  [6,"walk","Прогулка в новом районе","12:00"],[6,"mobility","Йога","18:00"],[6,"relax","Отдых и план на неделю","19:00"]
];
// экраны в шаблоне не должны заходить на последний час перед сном
export const fitScreenTime = (cat, tm) => { if(!tm || !isScreen(cat)) return tm; const hm = x => +x.slice(0,2)*60 + +x.slice(3,5); let off = hm(settings.screensOff || "22:30"); if(off < 6*60) off += 1440;
  let t = hm(tm); if(t < 6*60) t += 1440; if(t + 60 <= off) return tm; const n = Math.max(17*60, off - 60); return String(Math.floor(n/60)%24).padStart(2,"0") + ":" + String(n%60).padStart(2,"0"); };
export const customActs = () => LS.get("custom") || [];
// отсечка кофеина: не позже чем за 9 часов до сна (период полувыведения ~5–6 ч; AASM/Drake 2013: кофеин за 6 ч до сна укорачивает сон)
export function cafCutoffFor(bed){ let m = +bed.slice(0,2)*60 + +bed.slice(3,5); if(m < 6*60) m += 1440; m = Math.max(12*60, Math.min(16*60, m - 9*60)); return pad(Math.floor(m/60)) + ":" + pad(m%60); }
const IDEAS_BASE = RITM.CATALOG.filter(e => e.s).map(e => ({cat:e.t, t:e.n, min:e.m || TYPES[e.t].def, when:e.w||"any", time:e.tm||"", note:e.s}));
export const ideasAll = () => IDEAS_BASE.concat(customActs().filter(e => TYPES[e.t] && TYPES[e.t].unit === "min").map(e => ({cat:e.t, t:e.n, min:e.m || TYPES[e.t].def, when:"any", time:"", note:"Ваше занятие"})));

export const $ = id => document.getElementById(id);
export const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const uid = () => Math.random().toString(36).slice(2,10);
export const pad = n => String(n).padStart(2,"0");
export const iso = d => d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
export function mondayOf(d){ const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate()-((x.getDay()+6)%7)); return x; }
export function addDays(d,n){ const x = new Date(d); x.setDate(x.getDate()+n); return x; }
export const plural = (n, a, b, c) => { const m10 = n%10, m100 = n%100; return m10===1 && m100!==11 ? a : (m10>=2 && m10<=4 && (m100<12 || m100>14) ? b : c); };
export const nowHM = () => { const d = new Date(); return pad(d.getHours())+":"+pad(d.getMinutes()); };

/* ---------- storage (this device only) ---------- */
export const LS = {
  get(k){ try{ const v = localStorage.getItem("ritm:"+k); return v ? JSON.parse(v) : null; }catch(e){ return null; } },
  set(k,v){ try{ localStorage.setItem("ritm:"+k, JSON.stringify(v)); return true; }catch(e){ toast("Не удалось сохранить: память браузера недоступна"); return false; } },
  keys(){ const out = []; try{ for(let i=0;i<localStorage.length;i++){ const k = localStorage.key(i); if(k && k.startsWith("ritm:")) out.push(k.slice(5)); } }catch(e){} return out; }
};
try{ if(navigator.storage && navigator.storage.persist) navigator.storage.persist(); }catch(e){}
export function getWeek(key){ const w = LS.get("w:"+key); return w ? {items:w.items||[], days:w.days||{}} : {items:[], days:{}}; }
export function saveWeek(key, w){ LS.set("w:"+key, {items:w.items, days:w.days, week:key, updated:new Date().toISOString()}); }
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
export function loadSettings(){ const s = LS.get("settings") || {}; return {...DEFAULT_SETTINGS, ...s, goals:{...DEFAULT_SETTINGS.goals, ...(s.goals||{})}}; }
export let settings = loadSettings();
export const persistSettings = () => LS.set("settings", settings);

/* ---------- phone data: steps & sleep (Android app only) ---------- */
export const NATIVE = window.RitmNative || null;
export let health = LS.get("health") || {steps:{}, sleep:{}};
export const fmtDur = m => { m = Math.round(m); return m < 60 ? `${m} мин` : (m % 60 ? `${Math.floor(m/60)} ч ${pad(m%60)} мин` : `${m/60} ч`); };
export const fmtNum = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
export const dateOf = (key, d) => iso(addDays(new Date(key+"T00:00:00"), d));
export function dayLog(ds){ const d = new Date(ds+"T00:00:00"); const w = LS.get("w:"+iso(mondayOf(d))); return (w && w.days && w.days[(d.getDay()+6)%7]) || {}; }
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
export const sleepFor = ds => (health.sleep && health.sleep[ds]) || sleepFromLog(ds);
/* ----- сон за сутки: ночь + вечерний/дневной сон; норма — личная ----- */
export function sleepTotal(ds){
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
export let needCache = {t:0, v:null};
// по самочувствию: при каком количестве сна энергия заметно выше (нужно ≥10 дней с оценкой энергии)
export function learnSleepNeed(){
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
export function sleepNeed(){
  if(settings.sleepNeed) return {min:settings.sleepNeed, src:"user"};
  if(Date.now() - needCache.t > 60000){ let L = null; try{ L = learnSleepNeed(); }catch(e){} needCache = {t:Date.now(), v:L}; }
  const L = needCache.v; if(L && L.T) return {min:L.T, src:"data", n:L.n, diff:L.diff};
  return {min:420, src:"default", flat:!!(L && L.flat), n:L ? L.n : 0};
}
export const sleepLow = m => m != null && m < sleepNeed().min - 30;
export const sleepEnough = m => m != null && m >= sleepNeed().min - 15;
export function needText(){ const n = sleepNeed(), h = fmtDur(n.min);
  return n.src === "user" ? `твоя норма — ${h}` : n.src === "data" ? `по твоему самочувствию тебе нужно около ${h}` : "ориентир для взрослых — 7–9 часов, твою норму определю по самочувствию"; }
export const stepsFor = ds => { if(health.steps && health.steps[ds] != null) return health.steps[ds]; const d = dayLog(ds); return d.stepsManual != null ? d.stepsManual : ((d.review||{}).steps ?? null); };
export function bedMin(hm){ const [h,m] = hm.split(":").map(Number); let t = h*60+m; if(t < 12*60) t += 24*60; return t; }
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
export function sleepVerdict(w, key, d){ const h = w.days[d]||{}; if(typeof h.sleep === "boolean") return h.sleep; const ds = dateOf(key,d); if(!sleepTotal(ds)) return null; return sleepRegular(ds) === true; }
export function sleepOk(w, key, d){ const h = w.days[d]||{}; if(typeof h.sleep === "boolean") return h.sleep; return sleepRegular(dateOf(key,d)) === true; }

export const curKey = () => iso(mondayOf(new Date()));
export const todayI = () => (new Date().getDay()+6)%7;
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


export const __set_settings = v => (settings = v);
export const __set_needCache = v => (needCache = v);
export const __set_health = v => (health = v);
