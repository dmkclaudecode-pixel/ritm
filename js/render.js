// Rhythm · ES-модуль (render.js). Зависимости объявлены явно; запуск — через init() из main.js.
import {$, CATS, DACC, DFULL, DW, GOALABLE, LS, MON, MONG, NATIVE, TEMPLATE, TYPES, __set_needCache, __set_settings, addDays, bedMin, curKey, dateOf, esc, fitScreenTime, fmtDur, fmtNum, getWeek, goalCats, health, isScreen, iso, loadSettings, mondayOf, needText, nowHM, pad, persistSettings, plural, saveWeek, settings, sleepEnough, sleepFor, sleepLow, sleepNeed, sleepOk, sleepTotal, sleepVerdict, stepsFor, todayI, uid} from "./base.js";
import {breakLines, dateKeyOf, dayIdxOf} from "./chat.js";
import {bestHours, chatClick, proteinFor, renderChat, scrollChat, syncCheckins} from "./checkins.js";
import {__set_rvResult, __set_rvState, actsClick, appsClick, journalClick, missClick, noticedAnswer, openReview, renderActs, renderJournal, renderMisses, renderNoticed, renderReview, renderScreenCard, reviewClick, reviewTime, typeChipsHtml, usageHelpHtml, usualBedtime, weekScreenInsights} from "./daily.js";
import {postWeeklyReport, renderPatterns} from "./insights.js";
import {refreshWeather, renderRitual, ritualClick} from "./morning.js";
import {nudgeStats, renderFocus, renderRhythm, syncWatch, syncWidget} from "./nudges.js";
import {respondRules} from "./parse.js";
import {AERO_GOAL, __set_tab, __set_weekStart, aeroMinutes, autoFill, dismissed, gLeft, goalState, offsets, relIdx, suggestionsToday, tab, viewKey, weekStart} from "./plan.js";
import {applyRecurring, askRoutine} from "./routine.js";
// Rhythm · Отрисовка экранов, календарь, резервная копия, действия, листы
// Часть интерфейса: общая область видимости со всеми js/*.js (порядок подключения в index.html важен).

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
  placeCheckin(); renderRitual();
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
  renderFocus(ck, ti);
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
    const gs = goalState(w, d), miss = goalCats().filter(c=>gs[c].deficit>0).map(c=>CATS[c].n.toLowerCase()+" "+gLeft(gs[c]));
    const list = its.slice(0,4).map(i=>(i.time? i.time+" ":"")+i.t).join("; ");
    days[dateOf(ck,d)] = {
      morning: its.length ? {title:`Сегодня ${its.length} ${plural(its.length,"дело","дела","дел")}`, text: list + (its.length>4 ? " и ещё "+(its.length-4) : "") + ". И 15 минут дневного света до обеда."}
                          : {title:"Сегодня свободный день", text:"Откройте Rhythm: приложение подберёт, чем заняться."},
      review: {title:"Пора подвести итоги дня", text:`Сделано ${its.filter(i=>i.done).length} из ${its.length}. Две минуты на разбор — и план на завтра под ваш день.`},
      evening: {title: undone.length ? `Осталось ${undone.length} ${plural(undone.length,"дело","дела","дел")}` : "Как прошёл день?",
                text: (undone.length ? "Не отмечено: "+undone.slice(0,3).map(i=>i.t).join("; ")+". " : "") + "Отметьте сон, энергию и настроение." + (miss.length ? " До целей недели: "+miss.join(", ")+"." : "") + " Экраны выключить к "+settings.screensOff+"."}
    };
  }
  return {days};
}
export let lastSnap = "", lastReviewSync = "";
let lastWalkCfg = "";
export function syncWalkWatch(){
  if(!NATIVE || !NATIVE.setWalkWatch) return;
  const bad = LS.get("walkNo") || {}, cfg = JSON.stringify({enabled: !!(health && health.bgGranted && settings.notify), bad: Object.keys(bad).filter(h => bad[h] >= 2).map(Number)});
  if(cfg !== lastWalkCfg){ lastWalkCfg = cfg; try{ NATIVE.setWalkWatch(cfg); }catch(e){} }
}
export function syncNative(){
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
  else if(missing.length || aeroNeed > 0) gh = `<h2>Не хватает до целей</h2><p class="note">${missing.map(c => `${CATS[c].n.toLowerCase()} ещё ${gLeft(gs[c])}`).concat(aeroNeed > 0 ? [`аэробной нагрузки ещё ~${aeroNeed} мин (норма ВОЗ ${AERO_GOAL})`] : []).join(", ")}</p><div class="tools"><button class="btn primary" data-autofill="1">Добавить недостающее</button></div><p class="note">Приложение раскидает занятия по самым свободным дням и подберёт разные идеи.</p>`;
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
    return `<div class="goal"><div class="gh"><span>${CATS[c].n}</span><span class="num">${g.pct}% · ${g.doneMin} из ${g.goalMin} мин</span></div><div class="bar"><div class="pl" style="width:${Math.min(100,g.pctPlan)}%;background:${col}"></div><div class="dn" style="width:${Math.min(100,g.pct)}%;background:${col}"></div></div></div>`;
  }).join("") + (() => { const a = aeroMinutes(w), col = "var(" + CATS.walk.c + ")";
    return `<div class="goal"><div class="gh"><span>Аэробика</span><span class="num">${a.done}/${AERO_GOAL} мин</span></div><div class="bar"><div class="pl" style="width:${Math.min(100,a.plan/AERO_GOAL*100)}%;background:${col}"></div><div class="dn" style="width:${Math.min(100,a.done/AERO_GOAL*100)}%;background:${col}"></div></div></div>`; })()
    + `</div><p class="note">Яркая часть полосы — сделано, бледная — запланировано. Аэробная нагрузка — ходьба, плавание, бег, велосипед и спорт; норма ВОЗ — от 150 минут в неделю.</p>`;

  const ins = [];
  const missing = goalCats().filter(c => gs[c].deficit > 0);
  if(missing.length) ins.push(["warn", `Не хватает до целей: ${missing.map(c => `${CATS[c].n.toLowerCase()} ещё ${gLeft(gs[c])}`).join(", ")}. Во вкладке «Неделя» можно добавить это одной кнопкой.`]);
  { const a = aeroMinutes(w); if(ti < 6 && a.plan < AERO_GOAL) ins.push(["warn", `В плане ${a.plan} мин аэробной нагрузки (ходьба, плавание, бег и т. п.). Норма ВОЗ — от ${AERO_GOAL} минут в неделю, лучше до 300. Добавьте прогулку: 30 минут быстрым шагом — это уже ${Math.round(30/AERO_GOAL*100)}% нормы.`]); }
  for(const t of breakLines(w, ti)) ins.push(["sun", t]);
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
  // главное сверху: сначала то, что требует внимания; остальное по кнопке
  const rank = {warn:0, sun:1, ok:2, info:3}, sorted = ins.map((x, i) => [x, i]).sort((p, q) => (rank[p[0][0]] ?? 3) - (rank[q[0][0]] ?? 3) || p[1] - q[1]).map(x => x[0]);
  const more = !!LS.get("statsMore"), shown = more ? sorted : sorted.slice(0, 3);
  $("insights").innerHTML = `<h2>Что видно по неделе</h2>` + shown.map(([k,t]) => `<div class="insight"><span class="dot ${k==="warn"?"warn":k==="sun"?"sun":""}"></span><span>${t}</span></div>`).join("")
    + (sorted.length > 3 ? `<div class="tools"><button class="btn" id="statsMore">${more ? "Только главное" : "Показать все (" + sorted.length + ")"}</button></div>` : "");
  if($("statsMore")) $("statsMore").onclick = () => { LS.set("statsMore", !more); renderStats(); };
  $("patternsCard").hidden = !more;
}

function renderMore(){
  $("subtitle").textContent = "Цели, уведомления, копия";
  renderReminders(); renderHealthCard(); renderActs(); renderMisses();
  $("nativeRem").hidden = !NATIVE; $("remCard").hidden = !!NATIVE;
  renderRhythm();
  if(NATIVE){ $("nMorning").value = settings.morning; $("nEvening").value = settings.evening; $("nToggle").textContent = settings.notify ? "Выключить уведомления" : "Включить уведомления"; $("nToggle").classList.toggle("primary", !settings.notify); $("nTest").hidden = !settings.notify; $("nTestReview").hidden = !settings.notify;
    const ub = usualBedtime(); $("nBed").value = settings.bedtime;
    $("nWatch").innerHTML = [[0,"Выкл"],[30,"Строго"],[40,"Обычно"],[60,"Мягко"]].map(([v,l]) => `<button class="${(settings.watchMin ?? 40)===v?"on":""}" data-watch="${v}">${l}</button>`).join("");
    $("nWake").value = settings.wake || "08:00"; $("nLunch").value = settings.lunch || "13:00";
    $("nFreq").innerHTML = [[0,"Не писать"],[1,"Только утром"],[2,"Редко"],[3,"Иногда"],[5,"Раз в час, с подстройкой"]].map(([v,l]) => `<button class="${(settings.checkins ?? 5)===v?"on":""}" data-freq="${v}">${l}</button>`).join("");
    const bh = bestHours(); $("nFreqNote").textContent = bh.length ? `Лучше всего ты отвечаешь около ${bh.map(h => h + ":00").join(", ")}. Часы, когда ты почти не отвечаешь, я постепенно пропускаю.` : "Со временем я пойму, в какие часы тебе удобно отвечать, и буду писать в основном тогда.";
    $("nReviewToggle").textContent = settings.reviewOn ? "Включён" : "Выключен"; $("nReviewToggle").classList.toggle("primary", !!settings.reviewOn);
    $("nReviewNote").textContent = `В ${reviewTime()}, за 30 минут до ${ub.auto ? "вашего обычного отбоя по данным сна ("+ub.hm+")" : "отбоя в "+ub.hm}`; }
}

const TITLES = {chat:"Rhythm", today:"Сегодня", review:"Разбор дня", week:"Неделя", stats:"Итоги", more:"Ещё"};
export function render(){
  applyRecurring(curKey()); applyRecurring(iso(addDays(new Date(curKey()+"T00:00:00"),7)));
  for(const t of Object.keys(TITLES)) $("tab-"+t).hidden = t !== tab;
  document.querySelectorAll("#tabbar button").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
  $("title").textContent = TITLES[tab];
  if(tab==="chat") renderChat(); else if(tab==="today") renderToday(); else if(tab==="review") renderReview(); else if(tab==="week") renderWeek(); else if(tab==="stats") renderStats(); else renderMore();
  syncNative(); syncCheckins(); syncWatch(); try{ syncWidget(); }catch(e){} try{ refreshWeather(); }catch(e){}
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
  $("gMorning").href = gcalUrl({title:"Rhythm: план на день", date:today, time:settings.morning, minutes:10, daily:true, details:"Откройте Rhythm: дела на сегодня и советы. 15 минут дневного света до обеда.\n"+APP_URL});
  $("gReview").href = gcalUrl({title:"Rhythm: разбор дня", date:today, time:reviewTime(), minutes:10, daily:true, details:"Две минуты: отметьте, что и сколько делали, и получите советы и план на завтра.\n"+APP_URL});
  $("gReviewNote").textContent = "В " + reviewTime() + ", за 30 минут до сна";
  $("gEvening").href = gcalUrl({title:"Rhythm: отметить день", date:today, time:settings.evening, minutes:10, daily:true, details:"Отметьте сделанное, сон, свет, энергию и настроение. Экраны выключить к "+settings.screensOff+".\n"+APP_URL});
}


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
export function download(name, text, type){
  if(NATIVE){ let ok = false; try{ ok = NATIVE.saveFile(name, text, type); }catch(e){} toast(ok ? "Файл сохранён в «Загрузки»" : "Не удалось сохранить файл"); return; }
  const url = URL.createObjectURL(new Blob([text], {type})), a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
}


export function respond(text){ respondRules(text); }
/* ---------- backup ---------- */
function backupData(){ const data = {app:"ritm", version:2, exported:new Date().toISOString(), entries:{}}; for(const k of LS.keys()) data.entries[k] = LS.get(k); return data; }
// автокопия: раз в 7 дней, если в приложении есть что сохранять (только в Android-версии, файл попадает в «Загрузки»)
export function maybeAutoBackup(){
  if(!NATIVE || settings.autoBackup === false) return;
  const last = LS.get("lastBackup") || 0, weeks = LS.keys().filter(k => /^w:/.test(k)).length;
  if(!weeks || Date.now() - last < 7*86400000) return;
  try{ const ok = NATIVE.saveFile("ritm-auto-backup-" + iso(new Date()) + ".json", JSON.stringify(backupData()), "application/json"); if(ok){ LS.set("lastBackup", Date.now()); renderBackupNote(); } }catch(e){}
}
export function renderBackupNote(){
  const n = $("backupNote"), t = $("autoBackupToggle"); if(!n) return;
  const last = LS.get("lastBackup");
  n.textContent = NATIVE ? (last ? "Последняя автокопия: " + new Date(last).toLocaleDateString("ru-RU") + "." : "Автокопий пока не было.") : "Автокопия работает только в приложении для Android.";
  t.hidden = !NATIVE; t.textContent = settings.autoBackup === false ? "Автокопия выключена" : "Автокопия включена"; t.classList.toggle("primary", settings.autoBackup !== false);
}




/* ---------- actions ---------- */
export function mutate(key, fn){ const w = getWeek(key); fn(w); saveWeek(key, w); render(); }
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
  if(ds.report){ __set_tab("chat"); postWeeklyReport(); render(); scrollChat(); return; }
  if(journalClick(ds, t)) return;
  if(appsClick(ds)) return;
  if(actsClick(ds)) return;
  if(missClick(ds)) return;
  if(tab==="review" && reviewClick(ds)) return;
  if(ds.openreview){ openReview(); return; }
  if(ds.tab){ __set_rvState(null); __set_rvResult(null); __set_tab(ds.tab); if(tab === "chat") askRoutine(); if(tab==="week") __set_weekStart(mondayOf(new Date())); render(); window.scrollTo({top:0}); return; }
  if(ds.tick){ const k = keyOfItem(ds.tick); mutate(k, w => { const it = findIn(w, ds.tick); it.done = !it.done; if(it.done) toast("Отмечено. Так держать!"); }); }
  else if(ds.edit){ const k = keyOfItem(ds.edit); openItem(k, findIn(getWeek(k), ds.edit)); }
  else if(ds.add){ openItem(ds.week || curKey(), {id:null, day:+ds.add, cat:"walk", t:"", time:""}); }
  else if(ds.jump){ const el = $("day"+ds.jump); if(el) el.scrollIntoView({behavior:"smooth", block:"start"}); }
  else if(ds.hab){ const k = curKey(); mutate(k, w => { const d = todayI(); const cur = ds.hab==="sleep" ? sleepOk(w,k,d) : !!(w.days[d]||{})[ds.hab]; w.days[d] = {...(w.days[d]||{})}; w.days[d][ds.hab] = !cur; }); }
  else if(ritualClick(ds)){}
  else if(ds.sc){ mutate(curKey(), w => { const d = todayI(), v = +ds.v; w.days[d] = {...(w.days[d]||{})}; w.days[d][ds.sc] = w.days[d][ds.sc]===v ? null : v; }); }
  else if(ds.light){ mutate(curKey(), w => { const d = todayI(); w.days[d] = {...(w.days[d]||{}), light:true}; }); toast("Отмечено: дневной свет"); }
  else if(ds.native){ try{ if(ds.native==="health") NATIVE.requestHealth(); else if(ds.native==="healthbg") NATIVE.requestHealthBg(); else if(ds.native==="appsettings") NATIVE.openAppSettings(); else if(ds.native==="usage"){ NATIVE.requestUsage(); toast("Найдите «Rhythm» в списке и включите доступ"); } else { NATIVE.refreshHealth(); toast("Обновляю…"); } }catch(e){} }
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








function fillTemplate(){ const k = tab==="week" ? viewKey() : curKey(); mutate(k, w => TEMPLATE.forEach(([d,c,t,tm]) => w.items.push({id:uid(), day:d, cat:c, t, time:fitScreenTime(c, tm), done:false}))); toast("Неделя заполнена по шаблону"); }
export function confirmIn(btn, text, fn){
  if(btn.dataset.armed){ delete btn.dataset.armed; btn.textContent = btn.dataset.orig; fn(); return; }
  btn.dataset.orig = btn.textContent; btn.dataset.armed = "1"; btn.textContent = text;
  setTimeout(() => { if(btn.dataset.armed){ delete btn.dataset.armed; btn.textContent = btn.dataset.orig; } }, 3500);
}

/* ---------- sheets ---------- */
export function openSheet(html){ $("sheetIn").innerHTML = html; $("sheet").hidden = false; $("scrim").hidden = false; }
export function closeSheet(){ $("sheet").hidden = true; $("scrim").hidden = true; }

document.addEventListener("keydown", e => { if(e.key==="Escape") closeSheet(); });
const defaultTitle = c => (CATS[c]||CATS.other).n;

function openItem(key, it){
  const draft = {...it}, ws = new Date(key+"T00:00:00");
  let catManual = !!it.id;
  const catChips = () => typeChipsHtml(draft.cat, k => !["intake"].includes(TYPES[k].g) && k !== "sleep");
  const dayChips = () => DW.map((w,d) => `<button type="button" class="chip ${draft.day===d?"on":""}" data-day="${d}">${w} ${addDays(ws,d).getDate()}</button>`).join("");
  const calHref = () => gcalUrl({title:draft.t || CATS[draft.cat].n, date:addDays(ws,draft.day), time:draft.time, minutes:30, details:"Rhythm\n"+APP_URL});
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
    <div class="field"><label class="label" for="gWeight">Вес, кг <span class="note">— для нормы белка (1,6 г на кг при силовых, 1,2 без них)</span></label><input id="gWeight" type="number" min="30" max="250" inputmode="numeric" value="${settings.weight || ""}" placeholder="не указан"></div>
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
    __set_settings({...settings, ...lim, goals:draft, goalsEdited:true, screensOff:$("gOff").value || "22:30", caffeineCutoff:cafNew, cafManual: settings.cafManual || cafNew !== settings.caffeineCutoff});
    if(wt >= 30 && wt <= 250){ if(wt !== settings.weight && !protChanged) settings.proteinGoal = proteinFor(wt); settings.weight = wt; }
    { const hh = Math.round(+$("gHeight").value || 0), aa = Math.round(+$("gAge").value || 0); if(hh >= 120 && hh <= 230) settings.height = hh; if(aa >= 12 && aa <= 100) settings.age = aa; settings.sex = $("gSex").value || settings.sex || null; }
    const sv = parseFloat(($("gSleep").value || "").replace(",", ".")); settings.sleepNeed = sv >= 3 && sv <= 12 ? Math.round(sv*60/15)*15 : null; __set_needCache({t:0, v:null});
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
export function toast(msg){ const el = $("toast"); el.textContent = msg; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, 2600); }


export const __set_lastReviewSync = v => (lastReviewSync = v);

// Действия при запуске (раньше выполнялись при загрузке файла); вызывает main.js в прежнем порядке
export function init(){
  $("remMorning").onchange = e => { if(e.target.value){ settings.morning = e.target.value; persistSettings(); renderReminders(); toast("Время сохранено. Добавьте напоминание в календарь заново"); } };
  $("remEvening").onchange = e => { if(e.target.value){ settings.evening = e.target.value; persistSettings(); renderReminders(); toast("Время сохранено. Добавьте напоминание в календарь заново"); } };
  $("icsWeek").onclick = async () => {
  const key = curKey();
  if(!getWeek(key).items.some(i=>!i.done)){ toast("На этой неделе нет несделанных дел"); return; }
  const text = buildIcs(key), name = "ritm-"+key+".ics";
  try{ const file = new File([text], name, {type:"text/calendar"}); if(navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({files:[file], title:"Rhythm"}); return; } }catch(e){ if(e && e.name==="AbortError") return; }
  download(name, text, "text/calendar"); if(!NATIVE) toast("Файл сохранён. Откройте его, чтобы добавить в календарь");
};
  $("autoBackupToggle").onclick = () => { settings.autoBackup = settings.autoBackup === false; persistSettings(); renderBackupNote(); toast(settings.autoBackup === false ? "Автокопия выключена" : "Автокопия включена"); maybeAutoBackup(); };
  $("exportBtn").onclick = () => {
  const data = backupData();
  download("ritm-backup-"+iso(new Date())+".json", JSON.stringify(data), "application/json"); LS.set("lastBackup", Date.now()); renderBackupNote(); if(!NATIVE) toast("Копия сохранена в загрузках");
};
  $("importFile").onchange = async e => {
  const f = e.target.files && e.target.files[0]; e.target.value = ""; if(!f) return;
  try{ const data = JSON.parse(await f.text()); if(!data || data.app!=="ritm" || !data.entries) throw 0;
    for(const [k,v] of Object.entries(data.entries)) LS.set(k,v); __set_settings(loadSettings()); render(); toast("Данные восстановлены");
  }catch(err){ toast("Это не копия Rhythm. Выберите файл ritm-backup-….json"); }
};
  $("prev").onclick = () => { __set_weekStart(addDays(weekStart,-7)); render(); };
  $("next").onclick = () => { __set_weekStart(addDays(weekStart,7)); render(); };
  $("now").onclick = () => { __set_weekStart(mondayOf(new Date())); render(); };
  $("tpl").onclick = fillTemplate;
  $("copyPrev").onclick = () => {
  const k = curKey(), prev = getWeek(iso(addDays(mondayOf(new Date()),-7)));
  if(!prev.items.length){ toast("Прошлая неделя пустая"); return; }
  mutate(k, w => prev.items.forEach(it => w.items.push({id:uid(), day:it.day, cat:it.cat, t:it.t, time:it.time||"", done:false}))); toast("Скопировано на эту неделю");
};
  $("goalsBtn").onclick = openGoals;
  $("helpBtn").onclick = openIntro;
  $("clear").onclick = () => confirmIn($("clear"), "Точно очистить эту неделю?", () => { mutate(curKey(), w => { w.items = []; }); toast("Неделя очищена"); });
  $("scrim").onclick = closeSheet;
}

