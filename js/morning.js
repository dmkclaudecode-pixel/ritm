// Rhythm · ES-модуль (morning.js). Зависимости объявлены явно; запуск — через init() из main.js.
import {$, CATS, DACC, LS, TYPES, addDays, bedMin, curKey, dayLog, esc, fmtDur, getWeek, goalCats, iso, needText, nowHM, pad, persistSettings, plural, settings, sleepEnough, sleepLow, sleepNeed, sleepTotal, todayI, uid} from "./base.js";
import {MAJOR, act, bestDayInWeek, bot, commentFor, ctxBot, dateKeyOf, dayFromText, dayIdxOf, getChat, lc, logFromChat, nrm, pendingIssueDates, pick, saveChat, whenWord} from "./chat.js";
import {postIssues, scrollChat} from "./checkins.js";
import {appsFor, fillDefaults, hmMinus, intakeOf, mutateQuiet, phoneDay, usualBedtime} from "./daily.js";
import {dayRecord, personalInsights, statsReady} from "./insights.js";
import {SKIP_OK} from "./parse.js";
import {__set_tab, shuffled, suggestionsToday, tab} from "./plan.js";
import {mutate, render, toast} from "./render.js";
// Rhythm · Контекст, утро, погода, ритуал, сон словами, срывы
// Часть интерфейса: общая область видимости со всеми js/*.js (порядок подключения в index.html важен).

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
export function contextReply(text, s, A, pre){
  const cb1 = ctxBot(), lastBot = cb1.m;
  if(!lastBot || lastBot.chosen != null || (!cb1.explicit && Date.now() - lastBot.at > 3*3600*1000)) return false;
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
export function nightFacts(){
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
export let TIP;
export function personalLink(kind){ if(!statsReady(14)) return ""; const x = personalInsights().find(i => i.kind === kind); return x ? " По твоим данным: " + lc(x.text) : ""; }
export function morningBrief(){
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
  bot(L.filter(Boolean).join("\n"), [act("Утренний ритуал", {op:"tab", tab:"today"})], {kind:"brief"});
  return true;
}

/* ---------- погода: город один раз, прогноз из Open-Meteo, без геолокации ---------- */
const WX_CODE = c => c === 0 ? "ясно" : c <= 2 ? "малооблачно" : c === 3 ? "пасмурно" : c <= 48 ? "туман" : c <= 57 ? "морось" : c <= 67 ? "дождь" : c <= 77 ? "снег" : c <= 82 ? "ливень" : c <= 86 ? "снегопад" : "гроза";
const WX_WET = c => (c >= 51 && c <= 67) || (c >= 80 && c <= 99) || (c >= 71 && c <= 77);
const getCity = () => settings.city && settings.city.lat != null ? settings.city : null;
let wxBusy = false;
function wxCache(){ const c = LS.get("weather"); return c && getCity() && c.city === getCity().name ? c : null; }
export async function refreshWeather(force){
  const city = getCity(); if(!city || wxBusy || !navigator.onLine) return;
  const c = wxCache(); if(!force && c && Date.now() - c.at < 2*3600*1000) return;
  wxBusy = true;
  try{
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&wind_speed_unit=ms&timezone=auto&forecast_days=3`;
    const r = await fetch(u); if(!r.ok) throw new Error("wx " + r.status);
    const j = await r.json();
    LS.set("weather", {at:Date.now(), city:city.name, hourly:j.hourly, daily:j.daily});
    if(tab === "today") render();
  }catch(e){ console.warn("weather", e); }
  wxBusy = false;
}
// сводка за день: диапазон температур, осадки и сухие часы для прогулки
function wxDay(dateIso){
  const c = wxCache(); if(!c || !c.hourly) return null;
  const H = c.hourly, hours = [];
  for(let i = 0; i < H.time.length; i++) if(H.time[i].slice(0, 10) === dateIso) hours.push({h:+H.time[i].slice(11, 13), t:H.temperature_2m[i], p:H.precipitation_probability[i] ?? 0, c:H.weather_code[i], w:H.wind_speed_10m[i] ?? 0});
  if(hours.length < 12) return null;
  const di = c.daily.time.indexOf(dateIso), tmax = di >= 0 ? c.daily.temperature_2m_max[di] : Math.max(...hours.map(x => x.t)), tmin = di >= 0 ? c.daily.temperature_2m_min[di] : Math.min(...hours.map(x => x.t));
  const day = hours.filter(x => x.h >= 8 && x.h <= 21);
  const bad = x => x.p >= 50 || WX_WET(x.c) || x.t < -15 || x.t > 33 || x.w >= 12;
  const ok = h => { const x = hours.find(y => y.h === h); return x && !bad(x); };
  const wetFrom = (day.find(x => x.p >= 50 || WX_WET(x.c)) || {}).h ?? null;
  const dryWin = []; for(let h = 8; h <= 20; h++) if(ok(h) && ok(h + 1)) dryWin.push(h);
  const noon = hours.find(x => x.h === 13) || day[0];
  return {hours, tmax, tmin, wetFrom, dryWin, bad, ok, desc: WX_CODE(noon.c), wind: Math.max(...day.map(x => x.w)), allWet: day.every(bad)};
}
const wxT = n => (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(Math.round(n));
export function wxLine(dateIso){
  const d = wxDay(dateIso); if(!d) return "";
  let s = `${wxT(d.tmin)}…${wxT(d.tmax)}°, ${d.desc}`;
  if(d.allWet) s += ", весь день неуютно для улицы";
  else if(d.wetFrom != null) s += `, осадки ${d.wetFrom <= 8 ? "с утра" : "с " + pad(d.wetFrom) + ":00"}`;
  if(d.wind >= 10) s += `, ветер до ${Math.round(d.wind)} м/с`;
  return s;
}
const OUTDOOR = new Set(["walk", "run", "bike", "nature", "outing"]);
// плановое занятие на улице попадает на плохую погоду: что можно сделать
function wxConflicts(S){
  const out = [], d = wxDay(iso(new Date())); if(!d) return out;
  for(const it of S.undone){
    if(!OUTDOOR.has(it.cat) || !it.time) continue;
    const h = +it.time.slice(0, 2); if(h < (new Date().getHours())) continue;
    if(d.ok(h) && d.ok(h + 1)) continue;
    const alt = d.dryWin.filter(x => x >= new Date().getHours() + 1).sort((a, b) => Math.abs(a - h) - Math.abs(b - h))[0];
    out.push({it, alt: alt != null ? pad(alt) + ":00" : null});
  }
  return out;
}
export async function setCityByName(name){
  const q = String(name || "").trim().replace(/^(в|г\.?|город)\s+/i, "").replace(/[.!]+$/, "").trim();
  if(q.length < 2) return bot("Не разобрал название. Напиши город, например: «Казань».");
  try{
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=ru&format=json`); const j = await r.json();
    const res = (j.results || []).sort((a, b) => (b.population || 0) - (a.population || 0))[0];
    if(!res){ bot(`Не нашёл город «${q}». Проверь написание или напиши ближайший крупный город.`); render(); return; }
    settings.city = {name:res.name, lat:res.latitude, lon:res.longitude, region:res.admin1 || "", country:res.country || ""}; persistSettings(); LS.set("weather", null);
    await refreshWeather(true);
    const L = wxLine(iso(new Date()));
    bot(`Запомнил: ${res.name}${res.admin1 && res.admin1 !== res.name ? ", " + res.admin1 : ""}. ${L ? "Сегодня: " + L + "." : "Прогноз подтянется чуть позже."} Если город не тот, напиши «мой город Х».`);
  }catch(e){ bot("Не получилось связаться с сервисом погоды. Проверь интернет и напиши город ещё раз."); }
  render(); scrollChat();
}
function askCity(){
  bot("В каком городе ты живёшь? Нужно для погоды: советы про прогулки и тренировки на улице. Прогноз беру по названию города из открытого сервиса, геолокация не нужна.", [act("Не нужно", {op:"cityNo"})], {kind:"city"});
}
export function weatherAnswer(){
  if(!getCity()){ askCity(); return; }
  const today = iso(new Date()), tm = iso(addDays(new Date(), 1)), a = wxLine(today), b = wxLine(tm);
  if(!a && !b){ refreshWeather(true).then(() => { const x = wxLine(today); bot(x ? `Сегодня в ${getCity().name}: ${x}.` : "Прогноз пока не загрузился, попробуй чуть позже."); render(); }); return; }
  const d = wxDay(today), tip = d ? (d.allWet ? "На улице сегодня неуютно: лучше домашняя разминка или зал." : d.dryWin.length ? `Для прогулки лучше всего около ${pad(d.dryWin[Math.floor(d.dryWin.length / 2)])}:00.` : "") : "";
  bot(`${getCity().name}. Сегодня: ${a || "нет данных"}.${b ? " Завтра: " + b + "." : ""} ${tip}`.trim());
}
export function cityFromText(text){
  const m = /(?:^|\s)(?:живу в|я живу в|мой город|я из|город)\s+([а-яёa-z\- ]{2,30})$/i.exec(String(text).trim().replace(/[.!]+$/, ""));
  return m ? m[1] : null;
}

/* ---------- утренний ритуал: итог сна, энергия и план дня по состоянию ---------- */
function ritualState(){
  const ck = curKey(), ti = todayI(), w = getWeek(ck), day = w.days[ti] || {};
  const n = nightFacts(), sl = n.sl, need = sleepNeed().min, energy = day.energy ?? null;
  const shortSleep = !!(sl && sl.min < need - 60);
  const low = (energy != null && energy <= 2) || !!day.sick || (energy == null && shortSleep);
  const great = energy != null && energy >= 4 && (!sl || sl.min >= need - 30) && !day.sick;
  const its = w.items.filter(i => i.day === ti).sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
  const undone = its.filter(i => !i.done), upMajor = undone.filter(i => MAJOR.has(i.cat) && (!i.time || i.time >= nowHM()));
  return {ck, ti, w, day, sl, need, energy, shortSleep, mode: low ? "light" : great ? "push" : "normal", its, undone, upMajor, n};
}
function lightenToday(){
  const S = ritualState(); let moved = 0, swapped = 0;
  for(const it of S.upMajor){
    const bd = bestDayInWeek(S.ck, it.cat, Math.min(6, S.ti + 2), S.ti);
    if(bd >= 0 && bd !== S.ti){ mutateQuiet(S.ck, w => { const x = w.items.find(i => i.id === it.id); if(x){ x.day = bd; } }); moved++; }
    else { mutateQuiet(S.ck, w => { const x = w.items.find(i => i.id === it.id); if(x){ x.cat = "walk"; x.t = "Лёгкая прогулка, 20 мин"; } }); swapped++; }
  }
  mutateQuiet(S.ck, w => { w.days[S.ti] = {...(w.days[S.ti] || {}), lightDay:true}; });
  return {moved, swapped};
}
export function renderRitual(){
  const c = $("ritualCard"); if(!c) return;
  const h = new Date().getHours(), today = iso(new Date());
  if(h < 5 || h >= 13 || LS.get("ritualDone") === today){ c.hidden = true; return; }
  const S = ritualState();
  if(!S.sl && S.energy == null && !S.its.length){ c.hidden = true; return; }
  c.hidden = false;
  const sleepLine = S.sl ? `<div class="rsleep"><b>${fmtDur(S.sl.min)}</b><span class="note">сон · твоя норма ${fmtDur(S.need)} · ${S.sl.min >= S.need - 15 ? "хватает" : S.sl.min >= S.need - 60 ? "чуть меньше нормы" : "заметно меньше нормы"}</span></div>` : `<p class="note">Сон за ночь пока не записан: напиши в чат «лёг в 23, встал в 7».</p>`;
  const scale = `<div class="scale"><span class="label">Как себя чувствуешь?</span><div class="row">${[1,2,3,4,5].map(n => `<button class="${S.energy === n ? "on" : ""}" data-sc="energy" data-v="${n}" aria-label="Энергия ${n} из 5">${n}</button>`).join("")}</div></div>`;
  let mode = "", btns = "";
  const cut = S.shortSleep ? "13:00" : settings.caffeineCutoff;
  if(S.mode === "light"){
    mode = `<div class="rmode light"><b>Сегодня лёгкий день.</b> ${S.shortSleep ? "Сна меньше нормы, и организм это чувствует. " : "Энергии немного. "}Тяжёлое лучше сдвинуть, сделать ставку на прогулку, воду и ранний отбой. Кофе только до ${cut}.${S.upMajor.length ? ` В плане ${S.upMajor.length === 1 ? "тяжёлая тренировка «" + esc(S.upMajor[0].t) + "»" : S.upMajor.length + " тяжёлых тренировки"}: могу перенести или заменить на лёгкую прогулку.` : ""}</div>`;
    if(S.upMajor.length) btns += `<button class="btn primary" data-rit="lighten">Облегчить день</button>`;
    if(!S.w.items.some(i => i.day === S.ti && /Лечь пораньше/.test(i.t))) btns += `<button class="btn" data-rit="bed">Лечь на 30 минут раньше</button>`;
  } else if(S.mode === "push"){
    const top = S.undone.find(i => MAJOR.has(i.cat)) || S.undone[0];
    mode = `<div class="rmode push"><b>Есть ресурс.</b> ${top ? `Хороший день для главного: «${esc(top.t)}»${top.time ? " в " + top.time : ""}.` : "Хороший день, чтобы добавить что-то важное из целей недели."}</div>`;
    if(!S.undone.length) btns += `<button class="btn primary" data-rit="push">Подобрать на сегодня</button>`;
  } else {
    const nx = S.undone[0];
    mode = `<div class="rmode"><b>Идём по плану.</b> ${nx ? `Первое: «${esc(nx.t)}»${nx.time ? " в " + nx.time : ""}.` : "На сегодня ничего не запланировано, можно взять совет ниже."}</div>`;
  }
  let wx = "";
  if(getCity()){ const l = wxLine(today);
    if(l){ wx = `<div class="note rwx">Погода: ${esc(l)}</div>`;
      for(const cf of wxConflicts(S).slice(0, 2)) wx += `<div class="rmode"><b>${esc(cf.it.t)} в ${cf.it.time}:</b> ожидается плохая погода для улицы. ${cf.alt ? "Сухо около " + cf.alt + "." : "Сухого окна нет."}<div class="tools">${cf.alt ? `<button class="btn" data-rit="wxmove" data-id="${esc(cf.it.id)}" data-t="${cf.alt}">Перенести на ${cf.alt}</button>` : ""}<button class="btn" data-rit="wxswap" data-id="${esc(cf.it.id)}">Заменить на домашнюю разминку</button></div></div>`; } }
  else wx = `<div class="note rwx"><button class="btn" data-rit="city">Добавить город для погоды</button></div>`;
  const main = S.undone.slice(0, 3).map((i, k) => `<li class="${k ? "" : "first"}"><b>${i.time || "—"}</b><span>${esc(i.t)}</span></li>`).join("");
  c.innerHTML = `<div class="bhead"><h2>Утро</h2><span class="note">30 секунд</span></div>${sleepLine}${scale}${wx}${mode}${main ? `<span class="label">Главное на сегодня</span><ul class="rmain">${main}</ul>` : ""}<div class="tools">${btns}<button class="btn" data-rit="done">Готово</button></div>`;
}
export function ritualClick(ds){
  if(!ds.rit) return false;
  if(ds.rit === "done"){ LS.set("ritualDone", iso(new Date())); render(); return true; }
  if(ds.rit === "lighten"){ const r = lightenToday(); toast(`Облегчил: перенёс ${r.moved}, заменил ${r.swapped}`); bot(`Облегчил день: перенёс ${r.moved}, заменил на лёгкую прогулку ${r.swapped}. Если станет лучше, можно вернуть.`); render(); return true; }
  if(ds.rit === "bed"){ const S = ritualState(), tm = hmMinus(usualBedtime().hm, 30); mutate(S.ck, w => w.items.push({id:uid(), day:S.ti, cat:"unplug", t:"Лечь пораньше, без экрана", time:tm, done:false})); toast("Добавил: лечь в " + tm); return true; }
  if(ds.rit === "city"){ askCity(); __set_tab("chat"); render(); scrollChat(); return true; }
  if(ds.rit === "wxmove"){ const S = ritualState(); mutate(S.ck, w => { const x = w.items.find(i => i.id === ds.id); if(x) x.time = ds.t; }); toast("Перенёс на " + ds.t); return true; }
  if(ds.rit === "wxswap"){ const S = ritualState(); mutate(S.ck, w => { const x = w.items.find(i => i.id === ds.id); if(x){ x.cat = "mobility"; x.t = "Домашняя разминка, 20 мин"; } }); toast("Заменил на домашнюю разминку"); return true; }
  if(ds.rit === "push"){ const sg = suggestionsToday().find(x => x.idea); if(sg){ const S = ritualState(); mutate(S.ck, w => w.items.push({id:uid(), day:S.ti, cat:sg.cat, t:sg.idea.t, time:"", done:false})); toast("Добавил: " + sg.idea.t); } else toast("Сегодня всё по целям"); return true; }
  return false;
}

/* ---------- сон словами: «поспал 3 часа вечером», «ночью спал 5 часов» ---------- */
export function logSleepWords(e, text){
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
export function noteSkip(cat, dow){
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
export function whyAnswer(a){
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



// Действия при запуске (раньше выполнялись при загрузке файла); вызывает main.js в прежнем порядке
export function init(){
  TIP = {screen:`Сегодня попробуй убрать телефон в ${settings.screensOff} — хотя бы за 30 минут до сна.`, caffeine:`Сегодня кофеин только до ${settings.caffeineCutoff}.`, alcohol:"Сегодня больше воды и лечь пораньше.", move:"Сегодня хотя бы 20 минут пешком — сон будет глубже.", late:"Сегодня постарайся лечь вовремя, даже если не очень хочется."};
}

