// Ритм: чистая логика без интерфейса и хранилища (цели, перерывы, аэробика).
// Правило: здесь нет DOM, localStorage и глобальных переменных, всё приходит параметрами. Поэтому модуль целиком покрыт тестами (tests/core.test.js).
(function(root){
const CREDIT_CAP = 1.5;      // одно занятие засчитывается не больше, чем на 1,5 нормы
const AERO = new Set(["walk","run","bike","swim","cardio","sport"]), AERO_GOAL = 150;
const roundMin = m => m >= 20 ? Math.round(m/5)*5 : Math.round(m);

// Цели в процентах по минутам. env: {goals:{тип:занятий/нед}, cats:[типы целей], def:тип→минут, defaultMin:item→минут}
function goalState(w, ti, env){
  const out = {}, linked = {};
  for(const day of Object.values(w.days||{})) for(const e of (day.log||[])) if(e.plan) linked[e.plan] = (linked[e.plan]||0) + (e.min||0);
  for(const c of env.cats){
    const goal = env.goals[c]||0, def = env.def(c), cap = def*CREDIT_CAP;
    let doneMin=0, futureMin=0, missed=0, plan=0;
    for(const it of w.items){ if(it.cat!==c) continue; plan++;
      const dm = env.defaultMin(it);
      if(it.done) doneMin += Math.min(cap, linked[it.id] > 0 ? linked[it.id] : dm);
      else if(it.day >= ti) futureMin += Math.min(cap, dm);
      else missed++;
    }
    for(const day of Object.values(w.days||{})) for(const e of (day.log||[])) if(e.type===c && !e.plan && !e.neg && (e.min||0) > 0) doneMin += Math.min(cap, e.min);
    const goalMin = goal*def, leftMin = Math.max(0, goalMin - doneMin - futureMin);
    out[c] = {goal, done: Math.round(doneMin/def*10)/10, future: futureMin/def, missed, plan: (doneMin+futureMin)/def,
      deficit: goal && leftMin >= Math.max(5, def*0.2) ? leftMin/def : 0,
      doneMin: Math.round(doneMin), goalMin, futureMin: Math.round(futureMin), leftMin: Math.round(leftMin),
      pct: goalMin ? Math.round(doneMin/goalMin*100) : 0, pctPlan: goalMin ? Math.round((doneMin+futureMin)/goalMin*100) : 0};
  }
  return out;
}

function aeroMinutes(w, defaultMin){
  const linked = {}; let done = 0, plan = 0;
  for(const day of Object.values(w.days||{})) for(const e of (day.log||[])) if(e.plan) linked[e.plan] = e.min || 0;
  for(const it of w.items){ if(!AERO.has(it.cat)) continue; const m = it.done && linked[it.id] ? linked[it.id] : defaultMin(it); plan += m; if(it.done) done += m; }
  for(const day of Object.values(w.days||{})) for(const e of (day.log||[])) if(AERO.has(e.type) && !e.plan && (e.min||0) >= 5){ done += e.min; plan += e.min; }
  return {done, plan};
}

// микро-перерывы: сколько раз за рабочий день вставал, какие теги чаще всего
function breakStats(w, ti){
  let total = 0, wd = 0, wdBreaks = 0; const tags = {};
  for(let d = 0; d <= Math.min(ti, 6); d++){
    const lg = ((w.days||{})[d]||{}).log || [], br = lg.filter(x => x.type === "pause");
    total += br.length; if(d < 5 && (lg.length || d < ti)){ wd++; wdBreaks += br.length; }
    for(const x of lg) for(const t of (x.tags || [])) tags[t] = (tags[t]||0) + 1;
  }
  return {total, perWorkday: wd ? wdBreaks/wd : 0, wd, top: Object.entries(tags).sort((a,b) => b[1]-a[1]).filter(x => x[1] >= 2).slice(0, 3)};
}

const api = {CREDIT_CAP, AERO, AERO_GOAL, roundMin, goalState, aeroMinutes, breakStats};
if(typeof module !== "undefined" && module.exports) module.exports = api;
root.RITM = root.RITM || {}; root.RITM.core = api;
})(typeof window !== "undefined" ? window : globalThis);
