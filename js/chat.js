// Rhythm · ES-модуль (chat.js). Зависимости объявлены явно; запуск — через init() из main.js.
import {$, CATS, DACC, LS, MON, NATIVE, TYPES, __set_needCache, addDays, curKey, dateOf, esc, fmtDur, fmtNum, getWeek, goalCats, iso, mondayOf, nowHM, persistSettings, plural, settings, stepsFor, todayI, uid} from "./base.js";
import {dropMiss, scrollChat, showPlan} from "./checkins.js";
import {__set_rvState, chooseType, describe, fillDefaults, getReview, intakeOf, mutateQuiet, openReview, phoneDay, quickWater, rvState} from "./daily.js";
import {rememberLastLog, smartDay} from "./insights.js";
import {noteSkip, whyAnswer} from "./morning.js";
import {nativeNudgeReply, nudgeHistory, syncWatch} from "./nudges.js";
import {SKIP_OK} from "./parse.js";
import {__set_tab, autoFill, gLeft, gTxt, goalState, roundMin} from "./plan.js";
import {render} from "./render.js";
import {applyRecurring, getRoutine, saveRoutine} from "./routine.js";
// Rhythm · Чат: свайп-ответ, микро-перерывы, действия, запись в журнал, нормы
// Часть интерфейса: общая область видимости со всеми js/*.js (порядок подключения в index.html важен).

/* ---------- chat: talk to Ritm ---------- */
const CHAT_MAX = 400;
export const MAJOR = new Set(["strength","run","bike","swim","cardio","sport"]);
export const getChat = () => LS.get("chat") || [];
export function saveChat(arr){ LS.set("chat", arr.slice(-CHAT_MAX)); }
export function pushMsg(m){ const arr = getChat(); const msg = {id:uid(), at:Date.now(), ...m}; arr.push(msg); saveChat(arr); return msg; }
let lastLogAttached = 0;
// первое сообщение бота после записи хранит ссылку на неё: на него можно ответить поправкой
export const bot = (text, acts, extra) => { const x = {...(extra||{})}; const LL = LS.get("lastLog");
  if(LL && LL.at !== lastLogAttached && Date.now() - LL.at < 2500 && !x.log){ x.log = {key:LL.key, day:LL.day, ids:LL.ids}; lastLogAttached = LL.at; }
  return pushMsg({who:"bot", text, acts:acts||null, ...x}); };
/* ---------- ответ на конкретное сообщение (свайп влево, как в мессенджерах) ---------- */
export let replyId = null;
export const replyTarget = () => replyId ? (getChat().find(x => x.id === replyId) || null) : null;
// сообщение бота, на которое отвечаем: выбранное свайпом или, как раньше, последнее
export function ctxBot(){
  const t = replyTarget();
  if(t && t.who === "bot") return {m:t, explicit:true};
  const lb = getChat().filter(m => m.who === "bot").slice(-1)[0];
  return {m:lb, explicit:false};
}
// запись, к которой относится сообщение: у бота — прикреплённая, у пользователя — из ответа бота сразу за ним
function logRefOf(msg){
  if(!msg) return null;
  if(msg.who === "bot") return msg.log || null;
  const arr = getChat(), i = arr.findIndex(x => x.id === msg.id);
  for(let j = i + 1; j < arr.length && j <= i + 3; j++) if(arr[j].who === "bot" && arr[j].log) return arr[j].log;
  return null;
}
export const explicitLog = () => logRefOf(replyTarget());
export function renderReplyBar(){
  const el = $("replyBar"), m = replyTarget();
  if(!m){ el.hidden = true; el.innerHTML = ""; return; }
  const tx = String(m.text || "").replace(/\s+/g, " ").trim();
  el.hidden = false;
  el.innerHTML = `<div class="rq"><b>${m.who === "me" ? "Вы" : "Rhythm"}</b><span>${esc(tx.length > 90 ? tx.slice(0, 90) + "…" : tx)}</span></div><button type="button" id="replyX" aria-label="Отменить ответ">✕</button>`;
}
export function setReply(id){
  replyId = id || null; renderReplyBar();
  if(id){ try{ navigator.vibrate && navigator.vibrate(12); }catch(e){} try{ $("chatInput").focus(); }catch(e){} }
}
// выбор фразы без повторов: помним последние варианты из каждого набора
const PICKED = (() => { try{ return JSON.parse(localStorage.getItem("ritm:picked")||"{}"); }catch(e){ return {}; } })();
export const pick = arr => {
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
export const nrm = s => " " + String(s).toLowerCase().replace(/ё/g,"е").replace(/[!?.,;:()«»"]/g," ").replace(/\s+/g," ").trim() + " ";

const WD = [["понедельник"],["вторник"],["сред"],["четверг"],["пятниц"],["суббот"],["воскресень"]];
export function dayFromText(s){
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
export const isFutureClause = (clause, whole, e) => {
  const c = nrm(clause).replace(META, " "), w = nrm(whole).replace(META, " ");
  if(e.time && e.time > nowHM() && !/ (утром|днем) /.test(c) && !/ (вчера|позавчера) /.test(c)) return true;
  if(FUTURE.test(c)) return true;
  if(PAST_VERB.test(c)) return false;
  if(FUTURE.test(w) && !PAST_VERB.test(c)) return true;
  if(e.time && e.time > nowHM() && !/ (утром|днем) /.test(c)) return true;
  return false;
};
export const dateKeyOf = d => iso(mondayOf(d));
export const dayIdxOf = d => (d.getDay()+6)%7;
export const whenWord = d => { d = new Date(d); d.setHours(0,0,0,0); const t = new Date(); t.setHours(0,0,0,0); const diff = Math.round((d - t)/86400000);
  if(diff === 0) return "сегодня"; if(diff === 1) return "завтра"; if(diff === 2) return "послезавтра";
  if(diff < 0 || diff >= 14) return `${d.getDate()} ${MON[d.getMonth()]}`;
  return DACC[dayIdxOf(d)] + (iso(mondayOf(d)) !== iso(mondayOf(t)) ? " на следующей неделе" : ""); };
export const lc = s => s ? s.charAt(0).toLowerCase() + s.slice(1) : s;

export function bestDayInWeek(key, cat, fromDay, avoid){ return smartDay(key, cat, Math.max(0, fromDay), avoid); }

// ---------- replies ----------
export function planText(date){
  const w = getWeek(dateKeyOf(date)), d = dayIdxOf(date);
  const its = w.items.filter(i=>i.day===d).sort((a,b)=>(a.time||"99").localeCompare(b.time||"99"));
  if(!its.length) return `На ${whenWord(date)} в плане ничего нет. Хочешь, подберу что-нибудь? Напиши, например, «завтра бассейн в 18».`;
  return `${cap1(whenWord(date))} в плане:\n` + its.map(i => `${i.done ? "✓" : "•"} ${i.time ? i.time+" " : ""}${i.t}`).join("\n");
}
const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
export function todayStatsText(){
  const ck = curKey(), ti = todayI(), w = getWeek(ck), L = intakeOf((w.days[ti]||{}).log), st = stepsFor(dateOf(ck,ti)), pd = typeof phoneDay === "function" ? phoneDay(dateOf(ck,ti)) : null;
  const parts = [`Вода: ${L.water} из ${settings.waterGoal} мл`, `кофеин: ${L.mg} мг`, `белок: ${L.protein} из ${settings.proteinGoal} г`];
  if(st != null) parts.push(`шаги: ${fmtNum(st)}`);
  if(pd) parts.push(`телефон: ${fmtDur(pd.total)}, из них развлечения ${fmtDur(pd.ent)}`);
  const done = w.items.filter(i=>i.day===ti && i.done).length, all = w.items.filter(i=>i.day===ti).length;
  return `Сегодня сделано ${done} из ${all} по плану. ` + parts.join(", ") + ".";
}

/* ---------- микро-перерывы ---------- */
// ответ на рабочий чек-ин («Если сидишь давно — 2 минуты разминки помогут»): «пойду развеюсь» = микро-перерыв
const BREAK_WORDS = / (разомн\S*|размя\S*|потян\S*|пройд\S*|прогуляюсь|отдохн\S*|подвигаюсь|разве\S*|встану|встал\S*|встаю|схожу|сделаю разминку|разминк\S*|передохн\S*|перерыв\S*|пауз\S*) /;
export function workBreakReply(text, s, pre){
  const cb = ctxBot(), m = cb.m;
  if(!m || m.who !== "bot") return false;
  const isCheck = m.kind === "work" || /разминк|потянись|размяться|встань на минуту|пауз/.test(m.text || "");
  if(!isCheck || !(cb.explicit || Date.now() - (m.at||0) < 2*3600*1000)) return false;
  if(pre.some(e => e.type && e.type !== "pause" && TYPES[e.type].unit !== "event" && !e.fuzzy)) return false;
  if(/\?/.test(text) || !BREAK_WORDS.test(s)) return false;
  const e0 = pre.find(e => e.type === "pause") || RITM.parse("микро-перерыв")[0];
  const e = {...e0, text, dayOffset:0, tags: RITM.tagsOf(text, "pause")}; delete e.future; fillDefaults(e); logFromChat([e]);
  bot(`Записал микро-перерыв (${describe(e) || "3 мин"}). ` + (commentFor(e) || ""));
  return true;
}
// статистика перерывов: сколько раз за рабочий день вставал и какие теги встречаются
const breakStats = (w, ti) => RITM.core.breakStats(w, ti);
export function breakLines(w, ti){
  const b = breakStats(w, ti), out = [];
  if(b.wd >= 2 && b.total){ const p = Math.round(b.perWorkday*10)/10;
    out.push(p >= 4 ? `Микро-перерывов в рабочий день в среднем ${String(p).replace(".",",")}: отличная привычка не сидеть часами.` : `Микро-перерывов в рабочий день в среднем ${String(p).replace(".",",")}. Врачи советуют вставать каждые 30–60 минут, хватит и пары минут.`); }
  else if(b.wd >= 3 && !b.total) out.push("Микро-перерывов на этой неделе не было. Раз в час встать и потянуться на 2–3 минуты — это уже польза для спины и глаз.");
  if(b.top.length) out.push(b.top.map(([t,n]) => `${t} ${n} ${plural(n,"раз","раза","раз")}`).join(", ") + " за неделю (теги записей).");
  return out;
}

export function weekText(){
  const w = getWeek(curKey()), gs = goalState(w, todayI());
  const rows = goalCats().map(c => `${CATS[c].full}: ${gTxt(gs[c])}` + (gs[c].deficit ? ` (осталось ${gLeft(gs[c])})` : ""));
  return "Неделя по целям:\n" + rows.join("\n");
}
export function commentFor(e){
  const ck = curKey(), ti = todayI(), w = getWeek(ck), L = intakeOf((w.days[ti]||{}).log);
  if(e.type === "caffeine"){
    if(e.time && e.time > settings.caffeineCutoff) return `Это уже после ${settings.caffeineCutoff}, может помешать заснуть. Кофеина сегодня ≈${L.mg} мг.`;
    if(e.mg > 200) return `Это ≈${e.mg} мг за раз, а EFSA считает безопасной разовой порцией до 200 мг. Кофеина сегодня ≈${L.mg} мг.`;
    if(L.mg > settings.caffeineMax) return `Кофеина сегодня уже ≈${L.mg} мг, это больше ${settings.caffeineMax}. Дальше лучше вода или травяной чай.`;
    return `Кофеина сегодня ≈${L.mg} мг.`;
  }
  if(e.type === "water") return L.water >= settings.waterGoal ? `Норма воды выполнена: ${L.water} мл!` : `Воды сегодня ${L.water} из ${settings.waterGoal} мл.`;
  if(e.type === "protein") return `Белка сегодня ${L.protein} из ${settings.proteinGoal} г.`;
  if(e.type === "alcohol") return "Не забудь стакан воды на каждую порцию, так сон пострадает меньше. Безопасной дозы алкоголя нет (ВОЗ, 2023): чем реже, тем лучше.";
  if(e.type === "sweets") return L.sweets >= 3 ? "Сладкого сегодня уже немало, дальше лучше фрукты или орехи." : "";
  if(e.type === "meal") return "Приятного аппетита!";
  if(e.type === "sleep") return e.event === "wake" ? "Доброе утро! Хорошего дня." : "Спокойной ночи!";
  if(TYPES[e.type] && TYPES[e.type].g === "screen") return (L.screen > settings.screenLimit) ? `Развлекательных экранов уже ${fmtDur(L.screen)} при лимите ${fmtDur(settings.screenLimit)}. Может, прогуляемся 15 минут?` : "";
  if(e.type === "pause"){ const n = ((w.days[ti]||{}).log||[]).filter(x => x.type === "pause").length;
    return n >= 4 ? `Уже ${n} микро-перерывов сегодня, голове и спине спасибо.` : n >= 2 ? `Микро-перерыв №${n} за сегодня. Так держать!` : pick(["Хорошо, что встал: пара минут движения уже помогает.","Отлично, короткая пауза помогает голове и спине."]); }
  if(goalCats().includes(e.type)){ const g = goalState(w, ti)[e.type];
    const tail = g.pct >= 130 ? pick([" Уже сверх цели!"," Перевыполнение!"]) : g.pct >= 100 ? pick([" Цель недели закрыта!"," Норма на неделю выполнена!"]) : ` ${CATS[e.type].full}: ${g.pct}% недели (${g.doneMin} из ${g.goalMin} мин), осталось ~${roundMin(Math.max(0, g.goalMin - g.doneMin))} мин.`;
    return praise() + tail; }
  if(CATS[e.type] && CATS[e.type].move) return praise();
  return "";
}

// ---------- actions in chat ----------
export function act(label, a){ return {l:label, a}; }
export function runAction(msgId, i){
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
  else if(a.op === "sleepneed"){ settings.sleepNeed = a.min; persistSettings(); __set_needCache({t:0, v:null}); reply = `Поставил норму сна ${fmtDur(a.min)}.`; }
  else if(a.op === "why"){ const r = whyAnswer(a); m.chosen = i; saveChat(arr); bot(r.text, r.acts || null); render(); scrollChat(); return; }
  else if(a.op === "addOn"){ mutateQuiet(a.key, w => w.items.push({id:uid(), day:a.day, cat:a.cat, t:a.name, time:"", done:false})); reply = `Поставил «${a.name}» ${DACC[a.day]}.`; }
  else if(a.op === "unlog"){ let n = 0; mutateQuiet(a.key, w => { const day = w.days[a.d]; if(!day) return; const rm = (day.log||[]).filter(r => r.type === a.type && r.src === "chat"); n = rm.length;
      day.log = (day.log||[]).filter(r => !rm.includes(r)); for(const r of rm) if(r.fuzzyWord) RITM.forget(r.text, r.fuzzyWord); for(const r of rm) if(r.plan){ const it = w.items.find(i => i.id === r.plan); if(it) it.done = false; } });
    reply = n ? "Убрал ошибочную запись, отметку в плане тоже снял. Прости, неправильно понял." : "Записей уже нет."; }
  else if(a.op === "unlogIds"){ let n = 0; mutateQuiet(a.key, w => { const day = w.days[a.d]; if(!day) return; const before = (day.log||[]).length; day.log = (day.log||[]).filter(r => !a.ids.includes(r.id)); n = before - day.log.length; }); reply = n ? "Убрал запись о еде." : "Записей уже нет."; }
  else if(a.op === "walkAdd"){ mutateQuiet(a.key, w => { const day = w.days[a.d] = {...(w.days[a.d]||{})}; day.log = (day.log||[]).slice(); const it = w.items.find(i => i.day===a.d && i.cat==="walk" && !i.done); const rec = {id:uid(), type:"walk", name:"Прогулка", time:a.time, min:a.min, text:"прогулка по шагам", src:"steps"}; if(it){ it.done = true; rec.plan = it.id; } day.log.push(rec); }); reply = `Записал прогулку: ${a.min} мин с ${a.time}.`; }
  else if(a.op === "walkNo"){ const b = LS.get("walkNo") || {}; b[a.hour] = (b[a.hour]||0) + 1; LS.set("walkNo", b); reply = (b[a.hour] >= 2 ? "Понял, в это время больше не буду спрашивать." : "Понял, не записываю. Если такое повторится в это время ещё раз, перестану спрашивать."); }
  else if(a.op === "rhythmOff"){ settings.rhythm = false; settings.morning = a.m; settings.evening = a.e; persistSettings(); if(NATIVE && settings.notify) try{ NATIVE.setReminders(settings.morning, settings.evening, true); }catch(e){} reply = `Вернул ${a.m} и ${a.e}. Сам их больше менять не буду.`; }
  else if(a.op === "openMiss"){ __set_tab("more"); render(); setTimeout(() => { const el = $("missCard"); if(el) el.scrollIntoView({behavior:"smooth", block:"start"}); }, 50); reply = "Открыл список. Подскажите, что это было: «Занятие…» или «Не занятие»."; }
  else if(a.op === "nudgeWork"){ const hist = nudgeHistory(); const n = hist.find(x => x.id === a.id); if(n){ nativeNudgeReply(n.id, "work", "", 0); const wm = LS.get("workMarks") || {}, dk = iso(new Date()); wm[dk] = {...(wm[dk] || {}), [n.pkg]:1}; LS.set("workMarks", wm); } reply = `Понял, ${a.label} по работе. Сегодня про него не напоминаю.`; }
  else if(a.op === "cityNo"){ settings.cityNo = true; persistSettings(); reply = "Хорошо, без погоды. Если передумаешь, напиши «мой город Х»."; }
  else if(a.op === "workOkUndo"){ if(settings.workOk) delete settings.workOk[a.pkg]; persistSettings(); syncWatch(); reply = `Хорошо, ${a.label} в рабочее время снова проверяю.`; }
  else if(a.op === "appWork"){ const ty = LS.get("appTypes") || {}; ty[a.pkg] = "work"; LS.set("appTypes", ty); syncWatch(); reply = `Теперь ${a.label} — это «Работа и учёба», в развлечения не считаю. Поменять можно в разделе приложений.`; }
  else if(a.op === "appLimit"){ settings.appLimit = {...(settings.appLimit || {}), [a.pkg]: a.min}; persistSettings(); syncWatch(); reply = `Для ${a.label} теперь напоминаю после ${a.min} минут подряд.`; }
  else if(a.op === "watchLess"){ settings.watchMin = Math.min(120, (settings.watchMin ?? 40) + 20); persistSettings(); syncWatch(); reply = `Теперь напоминаю про приложения реже: после ${settings.watchMin} минут подряд.`; }
  else if(a.op === "habitNo"){ const hn = LS.get("habitNo") || {}; hn[a.type] = (hn[a.type] || 0) + 1; LS.set("habitNo", hn); reply = hn[a.type] >= 3 ? "Понял, про это больше не спрашиваю." : "Хорошо, не записываю."; }
  else if(a.op === "habitYes"){ const hn = LS.get("habitNo") || {}; hn[a.type] = 0; LS.set("habitNo", hn); const e = {type:a.type, name:a.name, text:a.name, dayOffset:0, time:a.time}; fillDefaults(e); logFromChat([e]); reply = `Записал: ${lc(a.name)} в ${a.time}.`; }
  else if(a.op === "logQuick"){ const e = {type:a.type, name:a.name, text:a.text || a.name, dayOffset:0}; fillDefaults(e); logFromChat([e]); reply = `Записал: ${lc(a.name)} (${describe(e) || fmtDur(e.min || 0)}).`; }
  else if(a.op === "okMin"){ mutateQuiet(a.key, w => { const day = w.days[a.d]; const r = day && (day.log||[]).find(x => x.id === a.id); if(r) delete r.mg; }); normsMemo = null; reply = "Запомнил, это ваша обычная длительность."; }
  else if(a.op === "setMin"){ mutateQuiet(a.key, w => { const day = w.days[a.d]; if(!day) return; const r = (day.log||[]).find(x => x.id === a.id); if(r){ r.min = a.min; delete r.mg; } }); normsMemo = null; reply = `Исправил: ${fmtDur(a.min)}.`; }
  else if(a.op === "keep"){ reply = pick(["Хорошо, оставляю как есть.","Понял, ничего не меняю."]); }
  else if(a.op === "type"){
    const pend = (m.pending||[])[a.idx]; if(pend){ const wasFz = pend.fuzzy; pend.type = a.type; if(RITM.trainlog) RITM.trainlog.label(pend.text || pend.name, "type", a.type); pend.changed = true; pend.wasUnknown = true; pend.fuzzy = false; if(a.noLearn){ pend.noLearn = true; pend.name = CATS[a.type].n; } fillDefaults(pend); dropMiss(pend.text);
      if(wasFz && pend.fuzzyWord) RITM.remember(pend.fuzzyWord, a.type, a.keepName ? pend.name : null);
      if(wasFz && a.keepName){ if(pend.future) addPlanFromChat(pend, new Date(pend.date)); else { const ln = logFromChat([pend]); if(ln.length) reply = `Отметил в плане: ${ln.map(i=>"«"+i.t+"»").join(", ")}. `; }
        reply = `Записал${pend.future ? " в план" : ""}: ${lc(pend.name)}. ` + (reply||"") + "Запомнил, как ты это пишешь." + (pend.future ? "" : " " + (commentFor(pend)||"")); }
      else { if(wasFz){ const nm = (RITM.coreText(pend.text||"") || String(pend.text||"")).trim(); pend.name = nm.charAt(0).toUpperCase() + nm.slice(1, 50); }
        if(pend.future) addPlanFromChat(pend, new Date(pend.date)); else logFromChat([pend]); reply = `Запомнил: «${pend.name}» — это ${CATS[a.type].full.toLowerCase()}.` + (pend.future ? "" : " " + (commentFor(pend)||"")); } }
  }
  else if(a.op === "typechoose"){
    const pend = (m.pending||[])[a.idx];
    chooseType(`Что такое «${pend ? pend.name : ""}»?`, null, list => { const t = list[0], extra = list.slice(1);
      if(pend && extra.length) pend.tags = Array.from(new Set((pend.tags||[]).concat(extra.map(x => CATS[x].n.toLowerCase())))).slice(0, 5);
      m.acts.push(act(CATS[t].n, {op:"type", idx:a.idx, type:t})); m.chosen = null; saveChat(getChat().map(x=>x.id===m.id?m:x)); runAction(m.id, m.acts.length-1); }, true);
    m.chosen = null; saveChat(arr); return;
  }
  else if(a.op === "review"){ openReview(); return; }
  else if(a.op === "showPlan"){ m.chosen = i; saveChat(arr); showPlan(new Date()); render(); scrollChat(); return; }
  else if(a.op === "tab"){ __set_tab(a.tab); render(); return; }
  else if(a.op === "water"){ quickWater(a.ml); reply = commentFor({type:"water"}); }
  if(reply) bot(reply.trim());
  render(); scrollChat();
}

// ---------- writing to journal and plan ----------
/* ---------- свои нормы: сколько человек обычно тратит на занятие (медиана названных им минут) ---------- */
export let normsMemo = null, normsAt = 0;
function personalNorms(){
  if(normsMemo && Date.now() - normsAt < 30000) return normsMemo;
  const by = {};
  for(const k of LS.keys()) if(k.startsWith("w:")){
    const w = LS.get(k); if(!w) continue;
    for(const day of Object.values(w.days || {})) for(const r of (day && day.log) || []){
      if(!r.min || r.mg || r.stepsOnly || r.src === "steps" || !r.type || !r.name) continue;
      (by[r.type + "|" + r.name] = by[r.type + "|" + r.name] || []).push(+r.min);
    }
  }
  const out = {};
  for(const [key, arr] of Object.entries(by)){
    if(arr.length < 3) continue;
    arr.sort((x, y) => x - y);
    const med = arr[Math.floor(arr.length / 2)], near = arr.filter(m => Math.abs(m - med) <= Math.max(10, med * 0.35)).length;
    if(near >= Math.ceil(arr.length * 0.6)) out[key] = Math.round(med / 5) * 5 || med;     // норма только если названные минуты кучкуются
  }
  normsMemo = out; normsAt = Date.now(); return out;
}
// подставить свою норму вместо каталожной, если минуты не названы
(function(){
  const base = RITM.parse;
  RITM.parse = function(t){
    const r = base(t);
    try{ const N = personalNorms(); for(const e of r) if(e.minGuess && e.type && e.name && N[e.type + "|" + e.name]){ e.min = N[e.type + "|" + e.name]; e.minNorm = true; } }catch(err){}
    return r;
  };
})();
export function logFromChat(entries){
  const linked = [], groups = {}, ids = []; let lk = null, ld = 0;
  for(const e of entries){ const off = e.dayOffset || 0; (groups[off] = groups[off] || []).push(e); }
  for(const [off, list] of Object.entries(groups)){
    const date = addDays(new Date(), +off), k = dateKeyOf(date), d = dayIdxOf(date);
    mutateQuiet(k, w => {
      const day = w.days[d] = {...(w.days[d]||{})}; day.log = (day.log||[]).slice();
      for(const e of list){
        if((e.changed || e.wasUnknown) && !e.noLearn) RITM.remember(e.text, e.type, e.wasUnknown ? e.name : null);
        const rec = {id:uid(), type:e.type, name:e.name, time:e.time || (TYPES[e.type].unit === "min" || +off ? "" : nowHM()), text:e.text, src:"chat"};
        for(const f of ["min","km","ml","mg","g","srv","tags","steps","stepsOnly","event","dose","derived","sets","reps","fuzzyWord","kcal","p","f","c"]) if(e[f] != null) rec[f] = e[f];
        if(e.minGuess) rec.mg = 1;
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
  normsMemo = null;
  if(ids.length) rememberLastLog(lk, ld, ids);
  if(rvState) __set_rvState(getReview(getWeek(curKey()), todayI()));
  return linked;
}
export function handleNegations(negs, text, msgDay, positive){
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
export function addPlanFromChat(e, date){
  const key = dateKeyOf(date), d = dayIdxOf(date); let res = {added:null, updated:null};
  mutateQuiet(key, w => {
    const same = w.items.find(i => i.day===d && i.cat===e.type && !i.done);
    if(same){ if(e.time) same.time = e.time; res.updated = same; }
    else { const it = {id:uid(), day:d, cat:e.type, t:e.name, time:e.time||"", done:false}; w.items.push(it); res.added = it; }
  });
  if((e.changed || e.wasUnknown) && !e.noLearn) RITM.remember(e.text, e.type, e.wasUnknown ? e.name : null);
  return res;
}

export const pendingIssueDates = [];

export const __set_normsMemo = v => (normsMemo = v);
export const __set_replyId = v => (replyId = v);
