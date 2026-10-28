// Rhythm · ES-модуль (plan.js). Зависимости объявлены явно; запуск — через init() из main.js.
import {CATS, LS, TYPES, addDays, curKey, dateOf, fmtDur, fmtNum, getWeek, goalCats, ideasAll, iso, mondayOf, nowHM, plural, saveWeek, settings, sleepFor, stepsFor, todayI, uid} from "./base.js";
import {fromMin, toMinHM} from "./checkins.js";
import {defaultMin} from "./daily.js";
import {learnedTime, smartDay} from "./insights.js";
import {toast} from "./render.js";
import {smartTime} from "./routine.js";
// Rhythm · Состояние экрана, анализ недели и подсказки на сегодня
// Часть интерфейса: общая область видимости со всеми js/*.js (порядок подключения в index.html важен).

/* ---------- view state ---------- */
export let tab;   // главный экран «Сегодня»; чат — для поправок (новичку сначала чат)
export let weekStart;
export const viewKey = () => iso(weekStart);
export function relIdx(key){ const ck = curKey(); return key === ck ? todayI() : (key < ck ? 7 : -1); } // index of "today" inside a week

/* ---------- analysis ---------- */
// Цели считаются в процентах по минутам: цель = число занятий × обычная длительность.
// Одно занятие засчитывается не больше, чем на 1,5 нормы (чтобы марафон не перекрыл всю неделю).
export const {CREDIT_CAP, roundMin} = RITM.core;
const sessDef = c => (TYPES[c] || TYPES.other).def || 30;
export const goalState = (w, ti) => RITM.core.goalState(w, ti, {goals:settings.goals, cats:goalCats(), def:sessDef, defaultMin});
export const gLeft = g => "~" + roundMin(g.leftMin) + " мин";
export const gTxt = g => `${g.pct}% (${g.doneMin} из ${g.goalMin} мин)`;
// аэробная нагрузка за неделю: ВОЗ рекомендует 150–300 минут умеренной (или 75–150 интенсивной)
export const {AERO, AERO_GOAL} = RITM.core;
export const aeroMinutes = w => RITM.core.aeroMinutes(w, defaultMin);
function daysSinceDone(cat){
  const ck = curKey(), ti = todayI(), cw = getWeek(ck), pw = getWeek(iso(addDays(mondayOf(new Date()),-7)));
  let best = 99;
  for(const it of cw.items) if(it.cat===cat && it.done && it.day<=ti) best = Math.min(best, ti - it.day);
  for(const it of pw.items) if(it.cat===cat && it.done) best = Math.min(best, ti + 7 - it.day);
  for(const [d, day] of Object.entries(cw.days||{})) if(+d <= ti && (day.log||[]).some(e=>e.type===cat)) best = Math.min(best, ti - +d);
  for(const [d, day] of Object.entries(pw.days||{})) if((day.log||[]).some(e=>e.type===cat)) best = Math.min(best, ti + 7 - +d);
  return best;
}
export function recentTitles(){
  const s = new Set(), m = mondayOf(new Date());
  for(const k of [iso(m), iso(addDays(m,-7))]) for(const it of getWeek(k).items) s.add(it.t);
  return s;
}
export function hash(str){ let h = 2166136261; for(let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h>>>0; }
export function shuffled(arr, seed){ const a = arr.slice(); let s = seed||1; for(let i=a.length-1;i>0;i--){ s = (Math.imul(s,1103515245)+12345)>>>0; const j = s % (i+1); [a[i],a[j]] = [a[j],a[i]]; } return a; }
export function ideaFits(idea, day, hour){
  const weekend = day >= 5;
  if(idea.when === "weekend" && !weekend) return false;
  if(hour != null){
    if(idea.when === "day" && hour >= 17) return false;
    if(idea.cat === "swim" && hour >= 20) return false;
    if(idea.when === "evening" && idea.time && hour > +idea.time.slice(0,2)+2) return false;
  }
  return true;
}
export function ideasFor(cat, day, hour, offset, recent){
  const pool = ideasAll().filter(i => i.cat===cat && ideaFits(i, day, hour));
  const fresh = pool.filter(i => !recent.has(i.t));
  const list = shuffled(fresh.length ? fresh : pool, hash(curKey()+cat+day));
  return list.length ? list[offset % list.length] : null;
}

/* suggestions for today */
export const offsets = {};
export let dismissed = new Set();
export function suggestionsToday(){
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
    else if(x.g.deficit > 0) why = `До цели недели не хватает ${gLeft(x.g)}: ${CATS[x.c].n.toLowerCase()} ${x.g.pct}% (${x.g.doneMin} из ${x.g.goalMin} мин)`;
    else if(x.since >= 3 && x.since < 99) why = `Уже ${x.since} ${plural(x.since,"день","дня","дней")} без ${CATS[x.c].g}`;
    else if(x.since === 99) why = `Ещё не было на этой неделе: ${CATS[x.c].n.toLowerCase()}`;
    else why = "Для разнообразия: что-то новое";
    out.push({kind:"idea", cat:x.c, idea, why});
  }
  return out;
}

/* auto-fill missing items into a week */
export function autoFill(key){
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


export const __set_tab = v => (tab = v);
export const __set_weekStart = v => (weekStart = v);
export const __set_dismissed = v => (dismissed = v);

// Действия при запуске (раньше выполнялись при загрузке файла); вызывает main.js в прежнем порядке
export function init(){
  tab = ((LS.get("chat") || []).length >= 6) ? "today" : "chat";
  weekStart = mondayOf(new Date());
}

