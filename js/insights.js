// Rhythm · ES-модуль (insights.js). Зависимости объявлены явно; запуск — через init() из main.js.
import {$, CATS, DACC, DFULL, LS, TYPES, addDays, bedMin, curKey, dateOf, esc, fmtDur, fmtNum, getWeek, goalCats, ideasAll, iso, learnSleepNeed, mondayOf, nowHM, pad, persistSettings, plural, settings, sleepEnough, sleepFor, sleepLow, sleepNeed, sleepTotal, stepsFor, todayI} from "./base.js";
import {MAJOR, act, bestDayInWeek, bot, breakLines, ctxBot, dateKeyOf, dayFromText, dayIdxOf, explicitLog, getChat, lc, pick, planText, runAction, saveChat, weekText} from "./chat.js";
import {HELP_TEXT, fromMin, showPlan, toMinHM} from "./checkins.js";
import {defaultMin, describe, hmMinus, intakeOf, mutateQuiet, phoneDay, usualBedtime} from "./daily.js";
import {nightFacts, personalLink, weatherAnswer, wxLine} from "./morning.js";
import {FEEL_WORD} from "./nudges.js";
import {AERO_GOAL, aeroMinutes, goalState, ideaFits, shuffled} from "./plan.js";
import {busyAt, getRoutine, isWorkDay, routineSummary, wakeFor} from "./routine.js";
// Rhythm · Понимание чувств и поправок, паттерны, недельный отчёт, план по реальной жизни
// Часть интерфейса: общая область видимости со всеми js/*.js (порядок подключения в index.html важен).

/* ---------- understanding layer: feelings, corrections, questions, small talk ---------- */
export function parserCtx(){
  const r = getRoutine();
  RITM.ctx = {now:nowHM(), workEnd: r.work && !r.noWork && isWorkDay(todayI()) ? r.work.to : null, workStart: r.work && !r.noWork ? r.work.from : null, commute: r.commute||0, lunch: r.lunch || settings.lunch || "13:30", bed: usualBedtime().hm, wake: wakeFor(todayI())};
}
export const CRISIS_TEXT = "Мне очень жаль, что тебе сейчас так тяжело. Ты не один, и с этим не нужно справляться в одиночку. Пожалуйста, поговори с кем-то прямо сейчас: с близким человеком или на телефоне доверия в своей стране. Если есть риск, что ты можешь причинить себе вред, звони 112 — это бесплатно. Я здесь и готов слушать: расскажешь, что случилось?";
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

export function handleStates(states){
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
export function rememberLastLog(key, day, ids){ LS.set("lastLog", {key, day, ids, at:Date.now()}); }
function lastLogEntries(){
  const ex = explicitLog();
  const L = ex ? {...ex, at:Date.now()} : LS.get("lastLog"); if(!L || Date.now() - L.at > 24*3600*1000) return null;
  const w = getWeek(L.key), day = (w.days[L.day]||{}); const es = (day.log||[]).filter(e => L.ids.includes(e.id));
  return es.length ? {L, w, es} : null;
}
export function handleCorrection(c){
  if(c.op === "undoCtx"){
    const tgt = ctxBot().m, txt = tgt ? String(tgt.text || "") : "", P = LS.get("lastPlanAdd"), Lg = LS.get("lastLog");
    const planFresh = P && Date.now() - P.at < 3600*1000, logFresh = Lg && Date.now() - (Lg.at || 0) < 3600*1000;
    const wantPlan = /Добавил в план|уже в плане/.test(txt) || (!/Записал|Отметил/.test(txt) && planFresh && (!logFresh || (Lg.at || 0) < P.at));
    if(wantPlan && planFresh){ mutateQuiet(P.key, w => { w.items = w.items.filter(x => x.id !== P.id); }); LS.set("lastPlanAdd", null); return bot(`Убрал «${P.t}» из плана.`); }
    if(logFresh || lastLogEntries()) c = {op:"undo"};
    else return bot("Не нашёл, что отменить. Скажи, например: «убери последнюю запись» или «убери тренировку из плана».");
  }
  const last = lastLogEntries();
  if(c.op === "what") return bot("Что поправить? Например: «не 30, а 45 минут», «это было вчера», «это было в 18:30», «не бег, а ходьба» или «удали последнее».");
  if(!last && c.op !== "extra") return bot("Не вижу свежих записей, которые можно поправить. Посмотри журнал во вкладке «Сегодня».");
  const {L} = last || {L:{key:curKey(), day:todayI(), ids:[]}, es:[]}, names = (last ? last.es : []).map(e => lc(e.name)).join(", ");
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
  if(c.op === "extra"){
    // лишнее: убираем запись целиком, если она на эту сумму, или вычитаем из неё; ищем среди последних записей
    const amt = e => c.what === "protein" ? (e.g != null && (e.type === "protein" || e.g > 0) ? e.g : null) : c.what === "water" ? (e.type === "water" ? e.ml : null) : c.what === "caffeine" ? (e.type === "caffeine" ? e.mg : null) : null;
    let did = [];
    // сначала записи последнего сообщения, потом остальные за день (новые раньше старых)
    mutateQuiet(L.key, w => { const day = w.days[L.day]; if(!day) return;
      const all = (day.log||[]).filter(e => !c.what || (amt(e) != null && amt(e) > 0));
      const es = all.filter(e => L.ids.includes(e.id)).reverse().concat(all.filter(e => !L.ids.includes(e.id)).reverse());
      const k = c.what === "protein" ? "g" : c.what === "water" ? "ml" : "mg"; let left = c.n;
      for(const hit of es){
        if(left != null && left <= 0.01) break;
        const have = c.what ? amt(hit) : null, take = left == null ? have : Math.min(have, left);
        if(c.what && take != null && have > take + 0.5){ hit[k] = Math.round((hit[k] - take)*10)/10; did.push(`${lc(hit.name)}: −${take}, осталось ${hit[k]}`); }
        else { if(hit.plan){ const it = w.items.find(i=>i.id===hit.plan); if(it) it.done = false; } day.log = day.log.filter(x => x.id !== hit.id); did.push(`убрал «${lc(hit.name)}»`); }
        if(left == null) break; left -= take;
      }
    });
    return bot(did.length ? `Исправил: ${did.join("; ")}.` : "Не нашёл в последней записи, что убрать. Напиши, например: «убери 25 г белка» сразу после записи, или удали её в журнале на экране «Сегодня».");
  }
  mutateQuiet(L.key, w => { const day = w.days[L.day]; if(!day) return;
    const es = (day.log||[]).filter(e => L.ids.includes(e.id)); const e = es[es.length-1]; if(!e) return;
    if(c.op === "time") for(const x of es) x.time = c.time;
    if(c.op === "type"){ if(RITM.trainlog) RITM.trainlog.label(e.text || c.what, "type", c.type); e.type = c.type; e.name = CATS[c.type].n; RITM.remember(e.text || c.what, c.type, null); }
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
export function handleSmall(small){
  const h = new Date().getHours();
  const cb2 = ctxBot(), lastBot = cb2.m;
  if(small.includes("yes") || small.includes("no")){
    if(lastBot && lastBot.acts && lastBot.chosen == null && (cb2.explicit || Date.now() - lastBot.at < 60*60*1000)){
      if(small.includes("yes")){ const i = lastBot.acts.findIndex(a => !["keep","rskip","typechoose"].includes(a.a.op)); if(i >= 0){ runAction(lastBot.id, i); return true; } }
      else { const i = lastBot.acts.findIndex(a => a.a.op === "keep" || a.a.op === "rskip" || a.a.op === "notact"); if(i >= 0){ runAction(lastBot.id, i); return true; } const arr = getChat(); const m = arr.find(x=>x.id===lastBot.id); m.chosen = -1; saveChat(arr); bot("Хорошо, не буду."); return true; }
    }
    bot(small.includes("yes") ? "Ок!" : "Понял."); return true;
  }
  if(small.includes("hello")){ const g = h < 5 ? "Не спится?" : h < 12 ? "Доброе утро!" : h < 18 ? "Привет!" : "Добрый вечер!"; bot(g + " " + planText(new Date())); return true; }
  if(small.includes("howareyou")){ bot(pick(["У меня всё отлично, слежу за твоим ритмом. А ты как? Как самочувствие?","Нормально, спасибо! А у тебя как день?"])); return true; }
  if(small.includes("who")){ bot("Я Rhythm — твой помощник по режиму дня. Записываю, что ты делаешь, подсказываю, планирую неделю и напоминаю про сон, воду и перерывы. Работаю на телефоне, без интернета и без ИИ в облаке."); return true; }
  if(small.includes("thanks")){ bot(pick(["Пожалуйста!","Обращайся!","Всегда рад помочь."])); return true; }
  if(small.includes("bye")){ const rv = ((getWeek(curKey()).days[todayI()]||{}).review||{}).done;
    if(h >= 18 && !rv){ bot("Спокойной ночи! Пока не лёг, давай за две минуты подведём итоги дня?", [act("Разобрать день", {op:"review"}), act("Завтра", {op:"keep"})]); }
    else bot(pick(["Спокойной ночи! Телефон в сторону, и отдыхай.","До завтра! Хорошо выспаться."])); return true; }
  if(small.includes("praise")){ bot(pick(["Спасибо, приятно!","Стараюсь!","Это ты молодец, я только записываю."])); return true; }
  if(small.includes("insult")){ bot("Прости, если я что-то не так понял. Напиши иначе, а я запомню. Подсказки — по слову «помощь»."); return true; }
  if(small.includes("help")){ bot(HELP_TEXT); return true; }
  if(small.includes("joke")){ bot(pick(JOKES)); return true; }
  if(small.includes("weather")){ weatherAnswer(); return true; }
  if(small.includes("love")){ bot("Взаимно! Давай заботиться о тебе вместе."); return true; }
  return false;
}

export function answerTopic(topics){
  const ck = curKey(), ti = todayI(), w = getWeek(ck), L = intakeOf((w.days[ti]||{}).log), ds = dateOf(ck, ti);
  const out = [];
  for(const t of topics){
    if(t === "water"){ const left = Math.max(0, settings.waterGoal - L.water); out.push(left ? `Жидкости сегодня ${L.water} из ${settings.waterGoal} мл${L.waterCaf ? ` (из них ${L.waterCaf} мл — кофе и чай)` : ""}. Осталось около ${left} мл — это примерно ${Math.ceil(left/250)} ${plural(Math.ceil(left/250),"стакан","стакана","стаканов")}.` : `Воды сегодня ${L.water} мл — норма выполнена!`); }
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
export let lastUserText = "";
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
export function dayRecord(date){
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
export function startedAt(){
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
export const dataDays = () => Math.floor((Date.now() - startedAt()) / 86400000);
export const statsReady = (min) => dataDays() >= (min || 14) && Date.now() >= (settings.statsHold || 0);
export function history(n){ const out = [], t = new Date(); t.setHours(0,0,0,0); for(let i = n; i >= 0; i--) out.push(dayRecord(addDays(t, -i))); return out; }
export const mean = a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : null;
// сравнение «в дни, когда X» против «остальные дни» с поправкой на малую выборку
export function compare(days, cond, val, minN, by, raw){
  // причинность: из исхода вычитаем средние по день недели (и по доп. факторам), чтобы не путать «сон» с «понедельником»
  const dowOf = r => r.x ? r.y.dow : r.dow;
  const factors = (raw ? [] : [dowOf]).concat(by || []);
  let rows = [];
  for(const x of days){ const c = cond(x), v = val(x); if(c == null || v == null) continue; rows.push({c, v, x}); }
  if(rows.length >= 21){
    for(const f of factors){
      const g = {};
      for(const r of rows){ const k = f(r.x); if(k == null) continue; (g[k] = g[k] || []).push(r.v); }
      const mg = {}; for(const k in g) if(g[k].length >= 3) mg[k] = mean(g[k]);
      const all = mean(rows.map(r => r.v));
      rows = rows.map(r => { const k = f(r.x); return k != null && mg[k] != null ? {...r, v: r.v - mg[k] + all} : r; });
    }
  }
  const A = rows.filter(r => r.c).map(r => r.v), B = rows.filter(r => !r.c).map(r => r.v);
  if(A.length < (minN||3) || B.length < (minN||3)) return null;
  const sd = (arr, m) => Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, arr.length - 1));
  const ma = mean(A), mb = mean(B), se = Math.sqrt(sd(A, ma) ** 2 / A.length + sd(B, mb) ** 2 / B.length);
  return {a:ma, b:mb, nA:A.length, nB:B.length, diff:ma - mb, t: Math.abs(ma - mb) < 1e-9 ? 0 : se > 1e-9 ? Math.abs(ma - mb) / se : 9, adj: rows.length >= 21 && !!(by && by.length)};
}
// насколько можно верить выводу: размер выборки и разброс (статистика Уэлча)
const confNote = r => !r || r.t == null ? "" : (r.adj ? " Поправку на сон учёл." : "") + (r.back ? " Возможна и обратная связь: " + r.back + "." : "") + (r.t >= 2.5 && Math.min(r.nA, r.nB) >= 6 ? " Это устойчиво." : r.t >= 1.7 ? " Скорее всего так." : " Пока это лишь намёк, данных мало.");
// обратная связь: вчерашнее самочувствие предсказывает сегодняшнее поведение не хуже, чем наоборот
export function reverseNote(days, getY, isHigh, getX, text){
  const prs = days.map((x, i) => ({x, y: days[i+1]})).filter(p => p.y && getY(p.x) != null && getX(p.y) != null);
  const r = compare(prs, p => isHigh(getY(p.x)), p => getX(p.y) ? 1 : 0, 4);
  return r && r.t >= 1.7 && r.diff >= 0.2 ? text : "";
}
const SLP = x => x.sleepMin == null ? null : (sleepEnough(x.sleepMin) ? 1 : 0);
export function personalInsights(){
  const days = history(42).filter(x => !x.sick), next = i => days[i+1];
  const pairs = days.map((x, i) => ({x, y: next(i)})).filter(p => p.y);
  const out = [];
  let r = null;
  const add = (score, text, kind) => { if(r && r.t != null && r.t < 1.2) return; out.push({score: r && r.t != null ? score * Math.min(1.5, 0.6 + r.t / 4) : score, text: text + confNote(r), kind}); };
  // кофеин после 14:30 → сон этой ночью
  r = compare(pairs, p => p.x.lateCaf, p => p.y.sleepMin);
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
    r = null;
    if(nd.src === "default" && nd.flat) add(10, "По твоим данным сон сам по себе пока мало меняет самочувствие, поэтому норму в 7 часов не навязываю. Продолжай отмечать энергию.", "sleep"); }
  // движение → энергия, настроение, сон
  r = compare(days, x => x.hasData ? x.moveMin >= 20 : null, x => x.energy, 3, [SLP]);
  if(r) r.back = reverseNote(days, x => x.energy, e => e >= 4, x => x.hasData ? x.moveMin >= 20 : null, "после бодрых дней ты и двигаешься больше");
  if(r && r.diff >= 0.5) add(r.diff*40, `В дни, когда ты двигаешься хотя бы 20 минут, энергия выше на ${r.diff.toFixed(1).replace(".", ",")} балла.`, "move");
  r = compare(days, x => x.hasData ? x.moveMin >= 20 : null, x => x.mood, 3, [SLP]);
  if(r) r.back = reverseNote(days, x => x.mood, e => e >= 4, x => x.hasData ? x.moveMin >= 20 : null, "когда настроение хорошее, двигаться тоже проще");
  if(r && r.diff >= 0.5) add(r.diff*40, `Движение поднимает тебе настроение: в среднем на ${r.diff.toFixed(1).replace(".", ",")} балла.`, "move");
  r = compare(pairs, p => p.x.hasData ? p.x.major : null, p => p.y.sleepMin);
  if(r && r.diff >= 20) add(r.diff, `После тренировок ты спишь на ${fmtDur(Math.round(r.diff))} дольше.`, "move");
  // шаги → настроение
  r = compare(days, x => x.steps == null ? null : x.steps >= settings.stepsGoal, x => x.mood, 3, [SLP]);
  if(r && r.diff >= 0.5) add(r.diff*40, `В дни, когда ты проходишь свою норму шагов, настроение лучше на ${r.diff.toFixed(1).replace(".", ",")} балла.`, "steps");
  // много развлечений в телефоне → настроение
  r = compare(days, x => x.screenEnt == null ? null : x.screenEnt > settings.screenLimit, x => x.mood);
  if(r && r.diff <= -0.5) add(-r.diff*40, `В дни, когда развлечений в телефоне больше лимита, настроение ниже на ${(-r.diff).toFixed(1).replace(".", ",")} балла.`, "screen");
  // вода → энергия
  r = compare(days, x => x.water == null ? null : x.water >= settings.waterGoal * 0.8, x => x.energy, 3, [SLP]);
  if(r && r.diff >= 0.5) add(r.diff*40, `Когда ты пьёшь достаточно воды, энергия выше на ${r.diff.toFixed(1).replace(".", ",")} балла.`, "water");
  { const nf = LS.get("nudgeFeel") || {}, top = Object.entries(nf).sort((x, y) => y[1] - x[1])[0]; r = null;
    if(top && top[1] >= 3) add(12, `Когда ты залипаешь в телефоне, чаще всего причина — ${FEEL_WORD[top[0]]} (${top[1]} раз по твоим ответам). Лучше работать с ней, чем с лимитами.`, "screen"); }
  { const wds = weakDays(); r = null;
    for(const wd of wds.slice(0, 2)){ r = wd.r; add(wd.drop * 30, `${DFULL[wd.dow]} у тебя слабый день: энергия ниже в среднем на ${wd.drop.toFixed(1).replace(".", ",")} балла (${wd.r.nA} таких дней).${wd.why ? " Что их отличает: " + wd.why + "." : ""} Тяжёлое лучше ставить на другие дни.`, "weekday"); }
    r = null; }
  // режим: разброс времени отбоя → энергия
  r = null;
  const beds = days.filter(x => x.bedM != null).map(x => x.bedM);
  if(beds.length >= 5){ const avg = mean(beds), sd = Math.sqrt(mean(beds.map(b => (b-avg)**2))); if(sd >= 50) add(sd/2, `Время отбоя у тебя гуляет примерно на ±${fmtDur(Math.round(sd))}. Ровный режим — один из самых простых способов высыпаться.`, "rhythm"); }
  return out.sort((a,b) => b.score - a.score);
}
// слабые дни недели: когда энергия стабильно ниже и что их отличает (сон перед ним, шаги, экран, загрузка)
export function weakDays(){
  if(!statsReady(21)) return [];
  const days = history(84).filter(x => !x.sick), out = [];
  const withE = days.filter(x => x.energy != null);
  if(withE.length < 21) return out;
  const DOWN = [["sleepMin", x => x.sleepMin, -1, d => `сон перед этим днём короче в среднем на ${fmtDur(Math.round(-d))}`],
                ["steps", x => x.steps, -1, d => `шагов меньше примерно на ${fmtNum(Math.round(-d))}`],
                ["screen", x => x.screenEnt, 1, d => `развлечений в телефоне больше на ${fmtDur(Math.round(d))}`],
                ["planned", x => x.planned, 1, d => `в плане больше дел (на ${d.toFixed(1).replace(".", ",")} в среднем)`],
                ["caf", x => x.caf, 1, d => `кофеина больше примерно на ${Math.round(d)} мг`]];
  for(let dow = 0; dow < 7; dow++){
    const r = compare(withE, x => x.dow === dow, x => x.energy, 3, null, true);
    if(!r || r.diff > -0.6 || r.t < 1.7) continue;
    let why = null, best = 0;
    for(const [, f, sign, txt] of DOWN){
      const q = compare(days, x => x.dow === dow, f, 3, null, true);
      if(q && q.diff * sign > 0 && q.t >= 1.7 && q.t > best){ best = q.t; why = txt(q.diff); }
    }
    out.push({dow, r, why, drop:-r.diff});
  }
  return out.sort((a, b) => b.drop - a.drop);
}
// накануне слабого дня: предупреждаю и предлагаю облегчить его
export function maybePreempt(){
  const h = new Date().getHours(); if(h < 17 || h >= 22) return false;
  const ck = curKey(), ti = todayI(), tm = (ti + 1) % 7, nextKey = ti === 6 ? iso(addDays(new Date(ck + "T00:00:00"), 7)) : ck;
  const P = LS.get("preemptPosted") || {}, tag = nextKey + ":" + tm;
  if(P[tag]) return false;
  const wd = weakDays().find(x => x.dow === tm); if(!wd) return false;
  const w2 = getWeek(nextKey), maj = w2.items.filter(i => i.day === tm && !i.done && MAJOR.has(i.cat));
  P[tag] = Date.now(); LS.set("preemptPosted", P);
  const acts = [];
  for(const it of maj.slice(0, 1)){
    const bd = bestDayInWeek(nextKey, it.cat, Math.min(6, tm + 1), tm);
    if(bd >= 0 && bd !== tm) acts.push(act(`Перенести «${it.t}» ${DACC[bd]}`, {op:"move", key:nextKey, id:it.id, day:bd, t:it.t}));
    acts.push(act("Заменить на лёгкую прогулку", {op:"swap", key:nextKey, id:it.id, type:"walk", name:"Лёгкая прогулка, 20 мин", t:it.t}));
  }
  if(!getWeek(ck).items.some(i => i.day === ti && /Лечь пораньше/.test(i.t))) acts.push(earlyBedAct());
  acts.push(act("Не нужно", {op:"keep"}));
  const wxN = wxLine(iso(addDays(new Date(), 1)));
  bot(`Завтра ${DFULL[tm].toLowerCase()}. По твоим данным в такие дни энергия ниже в среднем на ${wd.drop.toFixed(1).replace(".", ",")} балла${wd.why ? ": " + wd.why : ""}.${maj.length ? ` А в плане «${maj[0].t}».` : ""}${wxN ? ` Погода: ${wxN}.` : ""} Подготовимся заранее?`, acts, {kind:"preempt"});
  return true;
}
export function streaks(){
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
export function skipPatterns(){
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
  if(a.sleep != null && a.days >= 3) L.push(`Сон в среднем ${fmtDur(Math.round(a.sleep))}${b.sleep != null && Math.abs(a.sleep - b.sleep) >= 10 ? ` — на ${fmtDur(Math.round(Math.abs(a.sleep-b.sleep)))} ${a.sleep > b.sleep ? "больше" : "меньше"}, чем неделей раньше` : ""}.`);
  if(a.screen != null) L.push(`Развлечения в телефоне: ${fmtDur(Math.round(a.screen))} в день${b.screen != null && Math.abs(a.screen-b.screen) >= 10 ? ` (${a.screen < b.screen ? "меньше" : "больше"} на ${fmtDur(Math.round(Math.abs(a.screen-b.screen)))})` : ""}.`);
  if(a.steps != null) L.push(`Шагов в среднем ${fmtNum(Math.round(a.steps))} в день (ориентир ${fmtNum(settings.stepsGoal)}).`);
  { const ae = aeroMinutes(getWeek(ck)); L.push(`Аэробная нагрузка: ${ae.done} из ${AERO_GOAL} минут нормы ВОЗ.`); }
  for(const t of breakLines(getWeek(ck), 6)) L.push(t);
  const good = goalCats().filter(c => gs[c].pct >= 100).map(c => CATS[c].full.toLowerCase());
  const miss = goalCats().filter(c => gs[c].pct < 100).map(c => `${CATS[c].full.toLowerCase()} ${gs[c].pct}% (${gs[c].doneMin} из ${gs[c].goalMin} мин)`);
  if(good.length) L.push(`Получилось: ${good.join(", ")}.`);
  if(miss.length) L.push(`Не дотянул: ${miss.join(", ")}.`);
  const st = streaks(); if(st.length) L.push(`Серии: ${st.join("; ")}.`);
  const ins = personalInsights().slice(0, 2); if(ins.length) L.push("Что я заметил:\n" + ins.map(x => "• " + x.text).join("\n"));
  const sk = skipPatterns().slice(0, 2); if(sk.length) L.push("Чаще всего срывается:\n" + sk.map(x => "• " + x.text).join("\n"));
  return L.join("\n");
}

/* ---------- stage 3: plan that fits the real you ---------- */
// лучший день для занятия с учётом того, когда ты его реально делаешь
export function smartDay(key, cat, from, avoid, load, wObj){
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
export function learnedTime(cat, d, fallback){ const bs = bestSlotFor(cat); if(bs && bs.time && !busyAt(d, bs.time)) return bs.time; return fallback; }
// подстройка целей по последним двум неделям
function goalSuggestions(){
  const out = [], base = mondayOf(new Date());
  // обе прошлые недели должны быть целиком «после старта», иначе нули — это не данные, а их отсутствие
  if(!statsReady(14) || addDays(base, -14).getTime() < startedAt()) return out;
  const wk = k => goalState(getWeek(iso(addDays(base, -7*k))), 7);
  const w1 = wk(1), w2 = wk(2);
  for(const c of goalCats()){
    const g = settings.goals[c], a = w1[c] ? w1[c].done : 0, b = w2[c] ? w2[c].done : 0;
    if(a >= g + 1 && b >= g + 1 && g < 7) out.push({c, to:g+1, text:`${CATS[c].full}: две недели подряд ты делаешь больше цели (${Math.round(b)} и ${Math.round(a)} занятий по норме при цели ${g}). Поднять цель до ${g+1}?`});
    else if(a <= g - 2 && b <= g - 2 && g > 1) out.push({c, to:g-1, text:`${CATS[c].full}: две недели подряд получается ${Math.round(b)} и ${Math.round(a)} занятий по норме при цели ${g}. Может, сделать цель реалистичнее — ${g-1}? Лучше стабильно, чем идеально.`});
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
export function postWeeklyReport(){
  bot(weeklyReport(), [act("Составить план на следующую неделю", {op:"planNext"}), act("Открыть итоги", {op:"tab", tab:"stats"})], {kind:"report"});
  sleepNeedNews();
  for(const g of goalSuggestions().slice(0, 2)) bot(g.text, [act(g.to > settings.goals[g.c] ? "Поднять" : "Снизить", {op:"goal", c:g.c, to:g.to}), act("Оставить", {op:"keep"})]);
}

export function renderPatterns(){
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
export function maybeWeeklyReport(){
  const h = new Date().getHours(), ck = curKey();
  if(todayI() === 6 && h >= 18 && LS.get("reportPosted") !== ck){ LS.set("reportPosted", ck); postWeeklyReport(); return true; }
  return false;
}
// привычные времена: что ты делаешь примерно в одно и то же время (по последним трём неделям)
const HABIT_TYPES = ["caffeine","protein","walk","run","bike","swim","strength","mobility","reading","learning","supplements"];
export function habitTimes(){
  const today = new Date(); today.setHours(0,0,0,0);
  const by = {}, names = {}, seenDays = new Set();
  for(let i = 1; i <= 21; i++){
    const d = addDays(today, -i), k = dateKeyOf(d), di = dayIdxOf(d), w = getWeek(k), day = (w.days || {})[di] || {};
    if((day.log || []).length) seenDays.add(i);
    for(const e of (day.log || [])){ if(!HABIT_TYPES.includes(e.type) || !e.time || e.derived || e.src === "usage" || e.src === "health") continue;
      (by[e.type] = by[e.type] || {})[i] = (by[e.type][i] || []).concat(toMinHM(e.time)); (names[e.type] = names[e.type] || {})[e.name] = (names[e.type][e.name] || 0) + 1; }
  }
  const out = [];
  if(seenDays.size < 5) return out;
  for(const [type, perDay] of Object.entries(by)){
    const pts = []; for(const [i, arr] of Object.entries(perDay)) for(const m of arr) pts.push({i, m});
    pts.sort((a, b) => a.m - b.m);
    let best = null;
    for(const p of pts){ const grp = pts.filter(q => Math.abs(q.m - p.m) <= 40); const days = new Set(grp.map(q => q.i));
      if(days.size >= 4 && days.size / seenDays.size >= 0.3 && (!best || days.size > best.n)) best = {n:days.size, m:Math.round(mean(grp.map(q => q.m)) / 5) * 5}; }
    if(best) out.push({type, name: Object.entries(names[type] || {}).sort((a, b) => b[1] - a[1]).map(x => x[0])[0] || (CATS[type] ? CATS[type].n : type), m:best.m, n:best.n, of:seenDays.size});
  }
  return out;
}
export function maybeHabit(){
  if(document.hidden) return false;
  const now = new Date(), nm = now.getHours() * 60 + now.getMinutes(), ck = curKey(), ti = todayI();
  const posted = LS.get("habitPosted") || {}, today = dateKeyOf(now) + ":" + ti, st = posted.day === today ? posted : {day:today, types:[]};
  const hn = LS.get("habitNo") || {}, log = ((getWeek(ck).days[ti] || {}).log) || [];
  for(const h of habitTimes()){
    if(st.types.includes(h.type) || (hn[h.type] || 0) >= 3) continue;
    if(nm < h.m + 15 || nm > h.m + 120) continue;
    if(log.some(e => e.type === h.type && (!e.time || Math.abs(toMinHM(e.time) - h.m) <= 120))) continue;
    st.types.push(h.type); LS.set("habitPosted", st);
    const label = ({caffeine:"пьёшь кофе или чай", protein:"принимаешь белок", walk:"гуляешь", run:"бегаешь", bike:"катаешься на велосипеде", swim:"плаваешь", strength:"тренируешься", mobility:"делаешь зарядку или растяжку", reading:"читаешь", learning:"учишься", supplements:"принимаешь добавки"})[h.type] || "занимаешься этим";
    const hm = pad(Math.floor(h.m / 60)) + ":" + pad(h.m % 60);
    bot(`Обычно в ${hm} ты ${label} (${h.n} из ${h.of} последних дней с записями). Сегодня было? Запишу в один тап.`,
      [act("Да, записать", {op:"habitYes", type:h.type, name:h.name, time:hm}), act("Сегодня нет", {op:"habitNo", type:h.type})]);
    return true;
  }
  return false;
}
setInterval(() => { try{ maybeHabit(); }catch(e){} }, 5 * 60 * 1000);
// прогноз недели: по темпу первых дней видно, хватит ли движения, шагов и сна, пока ещё можно успеть
export function weekForecast(){
  const ck = curKey(), ti = todayI(), w = getWeek(ck), left = 6 - ti, out = [];
  if(ti < 2 || ti > 5) return out;
  // 1. аэробная нагрузка против нормы ВОЗ
  const aero = aeroMinutes(w), pace = aero.done / (ti + 1) * 7;
  const reach = aero.plan;            // сделано + запланировано до конца недели
  if(aero.done < AERO_GOAL && reach < AERO_GOAL * 0.85 && pace < AERO_GOAL * 0.85){
    const need = Math.max(10, Math.ceil((AERO_GOAL - aero.done) / Math.max(1, left) / 5) * 5);
    out.push({kind:"aero", text:`Пока у тебя ${aero.done} минут активности из ${AERO_GOAL} (норма ВОЗ на неделю). В таком темпе выйдет около ${Math.round(pace)}. Чтобы успеть, нужно примерно по ${need} минут в день до воскресенья.`});
  }
  // 2. сон: долг за последние ночи
  const recent = history(ti).filter(x => x.past && x.sleepMin != null).slice(-4);
  if(recent.length >= 3){ const need = sleepNeed().min, avg = mean(recent.map(x => x.sleepMin));
    if(avg < need - 30) out.push({kind:"sleep", text:`За последние ${recent.length} ночи ты спишь в среднем ${fmtDur(Math.round(avg))} при норме около ${fmtDur(need)}. Долг сна копится: сегодня лучше лечь пораньше.`}); }
  // 3. шаги: темп за неделю
  const sd = history(ti).filter(x => x.past && x.steps != null && x.steps > 0);
  if(sd.length >= 3 && settings.stepsGoal){ const avg = mean(sd.map(x => x.steps));
    if(avg < settings.stepsGoal * 0.7) out.push({kind:"steps", text:`В среднем ты проходишь ${Math.round(avg).toLocaleString("ru-RU")} шагов в день при цели ${settings.stepsGoal.toLocaleString("ru-RU")}. Короткая прогулка после обеда закрыла бы разницу.`}); }
  // 4. завтрашний пункт, который ты обычно пропускаешь
  const tm = ti + 1;
  if(tm <= 6){ const sp = skipPatterns().find(g => g.dow === tm && w.items.some(i => i.day === tm && i.cat === g.cat && !i.done));
    if(sp) out.push({kind:"skip", text:`Завтра в плане ${CATS[sp.cat].full.toLowerCase()}. ${sp.text} Хочешь перенести на удобное время?`}); }
  return out;
}
export function maybeForecast(){
  const ck = curKey(), h = new Date().getHours();
  if(h < 9 || h >= 21 || dataDays() < 4) return false;
  const posted = LS.get("forecastPosted") || {}, st = posted.key === ck ? posted : {key:ck, kinds:[]};
  const fresh = weekForecast().filter(f => !st.kinds.includes(f.kind));
  if(!fresh.length) return false;
  const f = fresh[0];
  st.kinds.push(f.kind); LS.set("forecastPosted", st);
  bot(f.text, [act("Что в плане?", {op:"showPlan"}), act("Понял", {op:"keep"})]);
  return true;
}
// раз в неделю (суббота и воскресенье) напоминаю разобрать фразы, на которых споткнулся
export function maybeMissReview(){
  const ck = curKey(), list = LS.get("misses") || [];
  if(todayI() < 5 || list.length < 3 || LS.get("missPosted") === ck) return false;
  LS.set("missPosted", ck);
  const ex = list.slice(-3).reverse().map(x => "«" + (x.text.length > 40 ? x.text.slice(0, 40) + "…" : x.text) + "»").join(", ");
  bot(`На этой неделе я не понял ${list.length} ${plural(list.length, "фразу", "фразы", "фраз")}, например ${ex}. Разберём? Это займёт минуту, и дальше я пойму такие фразы сам.`, [act("Разобрать", {op:"openMiss"}), act("Позже", {op:"keep"})]);
  return true;
}

export const __set_lastUserText = v => (lastUserText = v);
