// Rhythm · Точка входа сообщения и распорядок дня
// Часть интерфейса: общая область видимости со всеми js/*.js (порядок подключения в index.html важен).
"use strict";
/* ---------- message entry point ---------- */
let ruleMiss = false;
function handleUser(text, pushMe){
  text = (text||"").trim(); if(!text) return;
  ciNoteAnswer();
  const tg = replyTarget();
  if(pushMe !== false) pushMsg({who:"me", text, ...(tg ? {reply:{id:tg.id, who:tg.who, text:String(tg.text || "").slice(0, 140)}} : {})});
  try{ respond(text); }catch(err){ console.error(err); bot("Что-то пошло не так, попробуй написать иначе."); }
  if(replyId){ replyId = null; renderReplyBar(); }
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
ROUTINE_QS.push({k:"weight", q:"Сколько ты примерно весишь? Нужно, чтобы посчитать норму белка (1,2–1,6 г на кг). Можно пропустить.",
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
  const r = getRoutine(), cb3 = ctxBot();
  // ответ свайпом на вопрос про распорядок — это ответ именно на него, даже если он не последний
  if(cb3.explicit && /^routine:/.test(cb3.m.kind || "") && ROUTINE_QS.some(x => x.k === cb3.m.kind.slice(8))) r.pending = cb3.m.kind.slice(8);
  if(!r.pending) return false;
  const last = cb3.m;
  if(!last || last.kind !== "routine:" + r.pending || (!cb3.explicit && Date.now() - last.at > 12*3600*1000)) return false;
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

