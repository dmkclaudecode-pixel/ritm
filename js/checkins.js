// Rhythm · Журнал непонятого, напоминания в течение дня, экран чата
// Часть интерфейса: общая область видимости со всеми js/*.js (порядок подключения в index.html важен).
"use strict";
/* ---------- журнал непонятого ---------- */
function noteMiss(text, why){
  const t = String(text||"").trim(); if(!t) return;
  const arr = (LS.get("misses") || []).filter(x => x.text !== t);
  arr.push({at:Date.now(), text:t, why:why||"unknown"}); LS.set("misses", arr.slice(-60));
}
function dropMiss(text){ const t = String(text||"").trim(); LS.set("misses", (LS.get("misses") || []).filter(x => x.text !== t && !t.includes(x.text) && !x.text.includes(t))); }

// DGA 2025–2030: 1,2–1,6 г/кг для взрослых; ISSN: 1,4–2,0 при тренировках. С силовыми целями берём 1,6, без них 1,2
const proteinFor = kg => Math.max(60, Math.min(250, Math.round(kg * ((settings.goals && settings.goals.strength) >= 2 ? 1.6 : 1.2) / 10) * 10));
(function migrateNorms(){
  if(settings.normsV >= 2) return;
  const old = settings.weight ? Math.max(60, Math.min(250, Math.round(settings.weight * 1.4 / 10) * 10)) : null;
  if(old != null && settings.proteinGoal === old) settings.proteinGoal = proteinFor(settings.weight);   // норму, посчитанную автоматически, пересчитываем; ручную не трогаем
  settings.normsV = 2; persistSettings();
})();
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
      pushMsg({who:"bot", text:x.f.text, kind:x.f.kind, at:x.t, ...(ref ? {ref} : {}), ...(x.f.nid ? {nid:x.f.nid} : {})}); ciNoteFired(x.f); }
    else { pushMsg({who:"me", text:x.m.text, at:x.m.at}); if(x.m.ctx !== "nudge") handleUser(x.m.text, false); }
  }
  if(all.length){ try{ nudgeReview(); }catch(e){ console.error(e); } render(); }
}

// ---------- chat screen ----------
function fmtTime(ms){ const d = new Date(ms); const t = new Date(); const same = d.toDateString() === t.toDateString(); return (same ? "" : d.getDate() + " " + MON[d.getMonth()] + ", ") + pad(d.getHours()) + ":" + pad(d.getMinutes()); }
function renderChat(){
  $("subtitle").textContent = "Пиши как другу: что делал и что планируешь";
  let arr = getChat();
  if(!arr.length){ bot("Привет! Я Rhythm. Пиши мне обычными словами, что делал или что планируешь. Например: «выпил кофе в 9:30», «сегодня бассейн в 18», «что сегодня?». Я всё запишу, подскажу и днём иногда буду спрашивать, как дела.", [act("Что я умею", {op:"help"})]); arr = getChat(); }
  const view = arr.slice(-120);
  let html = "", lastDay = "";
  for(const m of view){
    const dd = new Date(m.at).toDateString();
    if(dd !== lastDay){ lastDay = dd; const d = new Date(m.at); html += `<div class="cday">${dd === new Date().toDateString() ? "Сегодня" : d.getDate()+" "+MONG[d.getMonth()]}</div>`; }
    const rq = m.reply ? `<div class="rq" data-rq="${esc(m.reply.id)}"><b>${m.reply.who === "me" ? "Вы" : "Rhythm"}</b>${esc(String(m.reply.text || "").length > 70 ? String(m.reply.text).slice(0, 70) + "…" : (m.reply.text || ""))}</div>` : "";
    html += `<div class="msg ${m.who}" data-mid="${esc(m.id)}"><div class="bub">${rq}${esc(m.text).replace(/\n/g,"<br>")}</div>`;
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

