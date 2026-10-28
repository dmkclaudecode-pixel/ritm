// Rhythm · ES-модуль (parse.js). Зависимости объявлены явно; запуск — через init() из main.js.
import {CATS, DACC, LS, TYPES, addDays, curKey, fmtDur, getWeek, iso, nowHM, persistSettings, plural, settings, todayI} from "./base.js";
import {MAJOR, __set_normsMemo, act, addPlanFromChat, bestDayInWeek, bot, commentFor, ctxBot, dateKeyOf, dayFromText, dayIdxOf, explicitLog, getChat, handleNegations, isFutureClause, lc, logFromChat, nrm, pendingIssueDates, pick, saveChat, todayStatsText, weekText, whenWord, workBreakReply} from "./chat.js";
import {__set_lastCheckinSync, foodStatement, moveCommand, noteMiss, postIssues, profileStatement, removeCommand, showPlan} from "./checkins.js";
import {describe, fillDefaults, intakeOf, mutateQuiet, usageGuess} from "./daily.js";
import {CRISIS_TEXT, __set_lastUserText, answerTopic, dataDays, handleCorrection, handleSmall, handleStates, parserCtx, personalInsights, postWeeklyReport, skipPatterns, startedAt, streaks} from "./insights.js";
import {cityFromText, contextReply, logSleepWords, setCityByName} from "./morning.js";
import {nudgeChatReply} from "./nudges.js";
import {autoFill} from "./plan.js";
import {__set_ruleMiss, applyRecurring, askRoutine, routineAnswer, routineStatement, routineSummary} from "./routine.js";
// Rhythm · Разбор сообщения: продолжение фразы, контекст ответа
// Часть интерфейса: общая область видимости со всеми js/*.js (порядок подключения в index.html важен).

// ---------- understanding a message ----------
/* ---------- продолжение прошлой фразы: «ещё час», «ещё стакан», «то же самое вчера» ---------- */
function durOf(s){
  let m = /(\d+(?:[.,]\d+)?) ?(час\w*|ч) /.exec(s); if(m) return Math.round(parseFloat(m[1].replace(",", ".")) * 60);
  m = /(\d+) ?(мин\w*) /.exec(s); if(m) return +m[1];
  if(/ полтора часа /.test(s)) return 90; if(/ (полчаса|пол часа) /.test(s)) return 30; if(/ два часа /.test(s)) return 120; if(/ три часа /.test(s)) return 180; if(/ час /.test(s)) return 60;
  return null;
}
function lastRecord(maxAgeMs){
  const L = LS.get("lastLog"); if(!L || !L.ids || !L.ids.length || Date.now() - L.at > maxAgeMs) return null;
  const rec = ((getWeek(L.key).days[L.day] || {}).log || []).find(r => r.id === L.ids[L.ids.length - 1]);
  return rec ? {key:L.key, d:L.day, rec} : null;
}
function followUp(text, s, pre){
  if(/\d{1,2}:\d{2}/.test(s)) return false;
  const typed = pre.filter(e => e.type && !e.fuzzy && TYPES[e.type].unit !== "event");
  // «ещё час», «и ещё полчаса», «плюс 20 минут»: добавить к последней записи
  if(/^ (и )?(еще|плюс|добавь|добавить|потом еще|и потом еще) /.test(s)){
    const L = lastRecord(4*3600*1000), dur = durOf(s);
    if(L && dur && L.rec.min && (!typed.length || typed.every(e => e.type === L.rec.type))){
      mutateQuiet(L.key, w => { const r = ((w.days[L.d] || {}).log || []).find(x => x.id === L.rec.id); if(r){ r.min = (r.min || 0) + dur; delete r.mg; } });
      __set_normsMemo(null); bot(`Добавил ещё ${fmtDur(dur)}: ${lc(L.rec.name)} теперь ${fmtDur(L.rec.min + dur)}.`); return true;
    }
  }
  // «ещё стакан», «ещё одну», «ещё кофе»: повторить последнюю запись; «то же самое», «то же вчера»: тоже
  const again = /^ (и )?(еще|опять|снова) (один|одну|одно|раз|стакан\w*|чашк\w*|кружк\w*|бутылк\w*|порци\w*|штуку|кусок|кусочек) ?$/.test(s) || /^ (и )?(то же|тоже|то же самое|тоже самое|как раньше|повторил|повторила|повтори|опять то же|снова то же)( вчера| позавчера| сегодня)? $/.test(s) || (/^ (и )?(еще|опять|снова) /.test(s) && typed.length === 1 && !durOf(s) && /^ (и )?(еще|опять|снова) (стакан|чашк|кружк|бутылк|порци|кусок)/.test(s));
  if(again){
    const L = lastRecord(3*3600*1000); if(!L) return false;
    const off = / позавчера /.test(s) ? -2 : / вчера /.test(s) ? -1 : 0, r = L.rec;
    const e = {type:r.type, name:r.name, text, dayOffset:off, time:""};
    for(const f of ["min","km","ml","mg","g","srv","tags","kcal","p","f","c","dose","steps"]) if(r[f] != null) e[f] = r[f];
    if(!TYPES[e.type] || TYPES[e.type].unit === "event" || r.stepsOnly) return false;
    fillDefaults(e); logFromChat([e]); const L2 = LS.get("lastLog");
    bot(`Записал ещё раз: ${lc(r.name)}${describe(e) ? " (" + describe(e) + ")" : ""}${off === -1 ? " — вчера" : off === -2 ? " — позавчера" : ""}.`, L2 ? [act("Это лишнее, убрать", {op:"unlogIds", key:L2.key, d:L2.day, ids:L2.ids}), act("Всё верно", {op:"keep"})] : null);
    return true;
  }
  return false;
}
const DLG = new RITM.dialog.Context(14);
let lastMD = null, lastText = "", chatUntil = 0;
function talkFallback(text){ const x = RITM.talk.reply({text, mood: lastMD || {}, ctx: DLG}); DLG.push("bot", x.text, {asked: x.asked, act: x.act}); return bot(x.text); }
export function startChatMode(){ chatUntil = Date.now() + 20*60000; }
// сильная эмоция без дела: отвечаем по настроению с учётом контекста беседы
function moodReply(MD, A, s, pre){
  const only = pre.every(e => e.unknown || !e.type || e.fuzzy || (e.minGuess && MD.intensity >= .7 && A.words <= 6));
  if(!only || /\d/.test(s) || pre.some(e => e.time) || MD.intensity < .35 || A.words > 14 || A.question) return false;
  const x = RITM.talk.reply({text: lastText, mood: MD, ctx: DLG}); DLG.push("bot", x.text, {asked: x.asked, act: x.act}); bot(x.text); return true;
}
export function respondRules(text){
  const s = nrm(text);
  __set_lastUserText(text); parserCtx();
  const A = RITM.analyze(text);
  if(A.crisis) return bot(CRISIS_TEXT, null, {kind:"crisis"});
  const MD = RITM.mood.analyze(text); RITM.mood.track(MD); lastMD = MD; lastText = text;
  if(RITM.talk) RITM.talk.learnFacts(text);
  { const tp = RITM.talk ? RITM.talk.topicOf(text) : null; DLG.push("user", text, {mood: MD, topic: tp ? tp.k : undefined}); }
  if(RITM.trainlog) RITM.trainlog.record(text, {mood: MD.dominant, mi: MD.intensity});
  { const cf = cityFromText(text); if(cf){ setCityByName(cf); return; }
    const cb = ctxBot();
    if(cb.m && cb.m.kind === "city" && cb.m.chosen == null && (cb.explicit || Date.now() - cb.m.at < 3*3600*1000) && text.trim().split(/\s+/).length <= 4 && !/\?/.test(text)){
      const arr = getChat(), mm = arr.find(x => x.id === cb.m.id); if(mm){ mm.chosen = -1; saveChat(arr); }
      setCityByName(text); return; } }
  if(routineAnswer(text)) return;
  if(A.correction && (LS.get("lastLog") || explicitLog() || LS.get("lastPlanAdd") || A.correction.op === "undoCtx") || (A.correction && A.correction.op === "what")) return handleCorrection(A.correction);
  if(/ (что ты (обо|про) мне знаешь|мой распорядок|мой график|что знаешь обо мне) /.test(s)) return bot(routineSummary());
  if(/ (расскажу о себе|давай познакомимся|спроси меня|задай вопросы|узнай меня) /.test(s)){ if(!askRoutine(true)) bot(routineSummary()); return; }
  const pre = RITM.parse(text);
  { const inChat = Date.now() < chatUntil, soft = !/\d/.test(s) && pre.every(e => !e.type || e.fuzzy || e.unknown || e.sem);
    if(RITM.talk && (RITM.talk.direct(text) || (inChat && soft && !A.states.length))){
      const x = RITM.talk.reply({text, mood: MD, ctx: DLG}); DLG.push("bot", x.text, {asked: x.asked, act: x.act});
      if(x.act === "invite" || inChat) chatUntil = Date.now() + 20*60000;
      return bot(x.text);
    } }
  if(!A.states.length && moodReply(MD, A, s, pre)) return;
  if(workBreakReply(text, s, pre)) return;
  if(nudgeChatReply(text, s, pre)) return;
  if(followUp(text, s, pre)) return;
  // «а вода из кофе не считается?» — вопрос о правилах подсчёта
  if(/ (считается|считаются|засчитывается|учитывается|учитываешь|считаешь|идет в счет|входит в норму) /.test(s) && / (кофе|чай|чая|напит\S*|сок|суп\S*|кофеин\S*) /.test(s) && / (вод\S*|жидкост\S*|норм\S*|воды) /.test(s)){
    const L0 = intakeOf((getWeek(curKey()).days[todayI()]||{}).log);
    return bot(`Считается: кофе и чай — это тоже жидкость, EFSA включает все напитки в дневную норму воды. Я засчитываю объём напитка (если не указан, одна порция — 200 мл). Сегодня жидкости ${L0.water} из ${settings.waterGoal} мл${L0.waterCaf ? `, из них ${L0.waterCaf} мл — кофе и чай` : ""}. Но кофеин слегка мочегонный, поэтому чистая вода всё равно нужна, особенно если кофе больше трёх чашек.`);
  }
  // вопрос с отрицанием («не считается?», «разве не…?») — не запись
  if(A.question && /\?/.test(text) && pre.length && pre.every(e => e.neg)){
    const tps0 = A.topics.filter(t => t !== "plan");
    if(tps0.length && answerTopic(tps0)) return;
    __set_ruleMiss(true); noteMiss(text, "question");
    return talkFallback(text);
  }
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
  // «смотрю», «слушаю» без названия: сначала смотрим, что видно по телефону, иначе спрашиваем одной кнопкой
  if(!/\d/.test(s) && / (смотрю|смотрел[аи]?|листаю|листал[аи]?|кручу|залип\w*|сижу в телефоне|сидел[аи]? в телефоне) $/.test(s)){
    const g = usageGuess();
    if(g){ __set_lastUserText(text); const e = {type:g.type, name:g.name, text, dayOffset:0, min:g.min}; fillDefaults(e); logFromChat([e]); const L = LS.get("lastLog");
      bot(`Вижу по телефону: сегодня ${g.name} ${fmtDur(g.min)}. Записал.`, L ? [act("Это не то, убрать", {op:"unlogIds", key:L.key, d:L.day, ids:L.ids}), act("Всё верно", {op:"keep"})] : null); return; }
    __set_ruleMiss(false);
    return bot("Что смотрите?", [["video","Ютуб","Ютуб"],["series","Сериал","Сериал"],["series","Фильм","Фильм"],["series","Трансляция","Матч или трансляция"],["feeds","Лента","Соцсети"]].map(([t, n, l]) => act(l, {op:"logQuick", type:t, name:n, text})).concat([act("Не надо записывать", {op:"keep"})]));
  }
  if(!/\d/.test(s) && / (слушаю|слушал[аи]?) $/.test(s)){
    __set_ruleMiss(false);
    return bot("Что слушаете?", [["learning","Подкаст","Подкаст"],["relax","Музыка","Музыку"],["reading","Аудиокнига","Аудиокнигу"]].map(([t, n, l]) => act(l, {op:"logQuick", type:t, name:n, text})).concat([act("Не надо записывать", {op:"keep"})]));
  }
  // «еду на работу», «жена приготовила ужин», «заказал пиццу»: не запись о деле (если нет цифр и явного времени)
  if(A.notMine && !A.states.length && !pre.some(e => e.time && !e.approx) && !(A.small && A.small.length)){ __set_ruleMiss(false); return bot(chattyReply(null)); }
  const hasSureAct = pre.some(e => e.type && !e.fuzzy && TYPES[e.type].unit !== "event");
  if(A.meta === "tooEarly" && !hasSureAct){
    settings.statsHold = Math.max(settings.statsHold || 0, startedAt() + 14*86400000); persistSettings();
    const left = Math.max(1, 14 - dataDays());
    return bot(`Согласен, ты прав: данных пока слишком мало, и выводы по ним были бы гаданием. Ничего не меняю. Статистику буду только копить, а правки целей и расписания предложу не раньше чем через ${left} ${plural(left,"день","дня","дней")}, когда наберётся хотя бы две полные недели. Пока план строю по твоим целям и распорядку.`); }
  if(A.meta === "dontChange" && !hasSureAct){ settings.statsHold = Math.max(settings.statsHold || 0, Date.now() + 14*86400000); persistSettings();
    return bot("Хорошо, ничего не меняю. Сам с правками плана по статистике не полезу ещё минимум две недели. Если захочешь что-то поменять — просто напиши."); }
  if(A.small.length && !pre.some(e => e.type && !e.fuzzy && TYPES[e.type].unit !== "event") && A.words <= 7 && !A.states.length && handleSmall(A.small)) return;
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

  if(/ (не пиши|не беспокой|не трогай|хватит писать|помолчи|не надо писать)/.test(s) && !hasAct){ const t = new Date(); t.setDate(t.getDate()+1); t.setHours(6,0,0,0); settings.ciPauseUntil = t.getTime(); persistSettings(); __set_lastCheckinSync(""); return bot("Понял, сегодня больше не пишу. Завтра продолжим. Если хочешь реже насовсем — напиши «пиши реже»."); }
  if(/ (пиши реже|реже пиши|слишком часто пишешь|часто пишешь)/.test(s)){ settings.checkins = Math.max(1, Math.min(4, (settings.checkins ?? 5) === 5 ? 3 : (settings.checkins ?? 5) - 1)); persistSettings(); __set_lastCheckinSync(""); return bot("Хорошо, буду писать реже. Вернуть как было — «пиши чаще»."); }
  if(/ (пиши чаще|чаще пиши|пиши почаще|пиши каждый час)/.test(s)){ settings.checkins = 5; settings.ciPauseUntil = 0; persistSettings(); __set_lastCheckinSync(""); return bot("Договорились: буду писать примерно раз в час, пока ты не спишь, и постепенно подстроюсь под время, когда тебе удобно отвечать."); }
  if(/ (отчет|итоги недели|недельн|как прошла неделя)/.test(s) && !hasAct){ postWeeklyReport(); return; }
  if(/ (что ты (понял|заметил)|закономерност|выводы обо мне|что влияет|что мне помогает|что мне мешает)/.test(s)){ const ins = personalInsights(); return bot(ins.length ? "Вот что я заметил по твоим данным:\n" + ins.slice(0,5).map(x => "• " + x.text).join("\n") : "Пока мало данных для выводов. Нужно хотя бы 1–2 недели: отмечай энергию и настроение, пиши, что делал, — и я начну находить закономерности."); }
  if(/ (серии|стрик|сколько дней подряд)/.test(s)){ const st = streaks(); return bot(st.length ? "Твои серии: " + st.join("; ") + ". Не прерывай!" : "Пока серий нет — начни сегодня, и я буду считать."); }
  if(/ (что я пропускаю|что срывается|что не получается)/.test(s)){ const sk = skipPatterns(); return bot(sk.length ? "Чаще всего срывается:\n" + sk.slice(0,4).map(x => "• " + x.text).join("\n") + "\nМогу ставить эти занятия на дни, когда у тебя получается лучше: напиши «составь план»." : "Явных провалов пока не вижу. Так держать!"); }
  if(/ (составь план|спланируй неделю|план на неделю|распланируй)/.test(s)){ const nk = iso(addDays(new Date(curKey()+"T00:00:00"), todayI() >= 5 ? 7 : 0)); applyRecurring(nk); const n = autoFill(nk); return bot(n ? `Добавил ${n} ${plural(n,"занятие","занятия","занятий")} — в дни и часы, когда у тебя обычно получается. Посмотри вкладку «Неделя».` : "Все цели уже в плане."); }
  if(profileStatement(s, text)) return;
  if(foodStatement(text, s, pre)) return;
  if(routineStatement(text)) return;
  // feelings: «устал», «болит голова», «не выспался»
  if(A.states.length){ const done = handleStates(A.states); if(done && !hasAct && !pre.some(e => e.ask)) return; if(!pre.some(e => e.type && !e.fuzzy && TYPES[e.type].unit !== "event") && moodReply(MD, A, s, pre)) return; }
  if(A.question && !hasAct && !pre.some(e=>e.type)){ __set_ruleMiss(true); noteMiss(text, "question"); return talkFallback(text); }
  // activities: past → journal, future → plan
  const msgDay = dayFromText(text);
  const entries = RITM.parse(text);
  { const bedE = entries.find(e => e.type === "sleep" && e.event === "bed"), wakeE = entries.find(e => e.type === "sleep" && e.event === "wake");
    if(bedE && wakeE && !bedE.dayOffset && bedE.time && wakeE.time && bedE.time > wakeE.time) bedE.dayOffset = -1; }
  { const sl = entries.filter(e => e.min && !/(вздремну(?!л)|подремлю|посплю|прилягу|буду спать)/i.test(e.text || "") && ((!e.type && /^(поспал|спал|вздремнул|подремал|дремал|заснул на|уснул на)/i.test(e.name || "")) || (e.type === "relax" && /(вздремнул|подремал|задремал|дремал)/i.test(e.text || ""))));
    for(const e of sl){ entries.splice(entries.indexOf(e), 1); logSleepWords(e, text); }
    if(sl.length && !entries.length) return; }
  if(!entries.length && RITM.findActivity(text) && RITM.findActivity(text).none) return bot(chattyReply(null));
  if(!entries.length){ __set_ruleMiss(true); noteMiss(text, "nothing"); return bot("Я пока не понял. Напиши, что делал («прогулка 30 минут», «выпил кофе в 9:30»), что планируешь («завтра бассейн в 18») или спроси «что сегодня?»."); }
  const cb0 = ctxBot(), lastBot = cb0.m;
  const ctxKind = lastBot && (cb0.explicit || Date.now() - lastBot.at < 3*3600*1000) ? lastBot.kind : null;

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
  if(!past.length && !future.length && !negs.length && !clar.length && unknown.length && ctxKind !== "lunch") __set_ruleMiss(true);
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
  const out = []; let askMin = null;
  if(past.length){
    const linked = logFromChat(past);
    const groups = []; for(const e of past){ const g = groups.find(x => x.name === e.name && x.type === e.type); if(g) g.items.push(e); else groups.push({name:e.name, type:e.type, items:[e]}); }
    const desc = groups.map(g => { if(g.items.length === 1){ const e = g.items[0]; return `${lc(e.name)}${describe(e) ? " ("+describe(e)+")" : ""}${e.dayOffset === -1 ? " — вчера" : e.dayOffset === -2 ? " — позавчера" : ""}`; }
      const times = g.items.map(e=>e.time).filter(Boolean); return `${lc(g.name)} ×${g.items.length}${times.length ? " (в "+times.join(", ")+")" : ""}`; }).join(", ");
    const comments = [...new Set(past.map(commentFor).filter(Boolean))].slice(0,2).join(" ");
    // длительность не названа, подставлено обычное значение: спрашиваем, а не молчим
    { const L0 = LS.get("lastLog"), ix = past.findIndex(e => e.type && TYPES[e.type].unit === "min" && !e.stepsOnly && e.min && e.minGuess);
      if(L0 && ix >= 0 && L0.ids.length === past.length && !(past.length > 1)) askMin = {key:L0.key, d:L0.day, id:L0.ids[ix], min:past[ix].min, name:past[ix].name, norm:!!past[ix].minNorm}; }
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
    if(res.added) LS.set("lastPlanAdd", {key, id: res.added.id, t: res.added.t, at: Date.now()});
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
  if(out.length){
    if(askMin && !future.length){
      const alts = [15, 30, 45, 60, 90, 120].filter(m => m !== askMin.min).slice(0, 4);
      bot(out.join("\n") + (askMin.norm ? ` Длительность не названа, поставил вашу обычную: ${fmtDur(askMin.min)}.` : ` Длительность вы не назвали, поставил обычные ${fmtDur(askMin.min)}.`), [act("Верно", {op:"okMin", key:askMin.key, d:askMin.d, id:askMin.id}), ...alts.map(m => act(fmtDur(m), {op:"setMin", key:askMin.key, d:askMin.d, id:askMin.id, min:m}))]);
    } else bot(out.join("\n"));
  }
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
    // варианты кнопок: сначала то, что подсказывает смысловой движок, потом самые частые типы
    const eng = (RITM.engine ? RITM.engine.classify(RITM.coreText(u.text || u.name || "") || (u.text || u.name || ""), t => !["sleep","other","intimacy"].includes(t)) : []).filter(x => x.p >= 0.08).slice(0, 3).map(x => x.type);
    let guesses = Array.from(new Set((/(развею|развея|размя|разомн|потян|подвиг|передохн|перерыв|пауз|встану|глаз)/.test(nrm(u.text || u.name || "")) ? ["pause"] : []).concat(eng, ["walk","strength","sport","hobby","relax","meal","work","other"]))).filter(t => TYPES[t]);
    const hintW = RITM.onto ? words(u.text || u.name || "").find(w => w.length > 3 && RITM.onto.typeHint(w)) : null, hint = hintW ? RITM.onto.typeHint(hintW) : null;
    const foodW = hint === "meal" ? hintW : null;
    if(hint && CATS[hint]) guesses.unshift(hint);
    const m = bot(foodW ? `«${u.name}» — похоже на еду («${foodW}»). Записать как приём пищи или это другое?` : hint && CATS[hint] ? `«${u.name}» — похоже на «${CATS[hint].n.toLowerCase()}» (по слову «${hintW}»). Так и записать?` : `Не знаю, что такое «${u.name}». Подскажи, к чему это отнести, и я запомню:`,
      guesses.slice(0,6).map(t => act(CATS[t].n, {op:"type", idx:0, type:t})).concat([act("Другое…", {op:"typechoose", idx:0}), act("Это не занятие", {op:"notact", idx:0})]),
      {pending:[{...u, future: isFutureClause(u.text, text, u), date: (dayFromText(u.text) || msgDay || new Date()).getTime()}]});
    void m;
  });
}
const words = t => nrm(t).trim().split(" ").filter(Boolean);
function isChatty(u, A){
  if(u.time || (u.qty && u.qty.length) || u.min) return false;
  const w = nrm(u.name).trim().split(" ").filter(Boolean);
  if(u.fuzzy && w.length >= 3) return true;
  if(w.some(x => /(ится|ется|ются|ятся|утся)$/.test(x)) || / (какая-то|какой-то|какие-то|что-то|кто-то|дичь|жесть|капец|ужас|кошмар|фигня|ерунда) /.test(nrm(u.name))) return true;   // «дичь какая-то творится»: опечатка в длинной фразе без цифр — скорее разговор
  if(w.length >= 4) return true;
  if(/ (я|мы|ты|он|она|они|это|не|нет|пока|еще|ещё|уже|никаких|ничего|знаю|понял|думаю|кажется|наверное|может|надо|нужно|хочу|рано|поздно|просто|вообще|короче|типа|вроде) /.test(nrm(u.name))) return true;
  return !!A.conversational && w.length >= 2;
}
export const SKIP_OK = ["Ничего страшного, бывает.","Понял, без проблем.","Окей, случается.","Бывает, не страшно.","Жизнь вносит правки, это нормально.","Понял. Один пропуск ничего не ломает.","Окей, не беда."];
function chattyReply(kind){
  if(kind === "report" || kind === "insight") return "Понял тебя. Ничего не меняю, просто продолжаю наблюдать.";
  if(RITM.talk && lastMD){ const x = RITM.talk.reply({text: lastText, mood: lastMD, ctx: DLG}); DLG.push("bot", x.text, {asked: x.asked, act: x.act}); return x.text; }
  return pick(["Понял тебя.","Принято.","Окей, понял.","Ясно.","Услышал.","Понимаю."]) + " " + pick(["Если что-то делал или собираешься — напиши, я запишу.","Будут новости по делам — пиши.","Если захочешь что-то запланировать — я тут."]);
}

