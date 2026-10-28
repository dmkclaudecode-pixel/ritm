// Rhythm · ES-модуль (daily.js). Зависимости объявлены явно; запуск — через init() из main.js.
import {$, CATS, DACC, DFULL, LS, MONG, NATIVE, TYPES, addDays, bedMin, curKey, customActs, dateOf, esc, fmtDur, fmtNum, getWeek, goalCats, health, isScreen, iso, needText, nowHM, pad, plural, saveWeek, settings, sleepEnough, sleepFor, sleepLow, sleepTotal, stepsFor, todayI, uid} from "./base.js";
import {dateKeyOf, dayIdxOf, logFromChat} from "./chat.js";
import {fmtTime} from "./checkins.js";
import {fmtHM, walkSegments} from "./native.js";
import {APP_GROUPS, appGroup, appInfo, nudgeStats} from "./nudges.js";
import {__set_tab, autoFill, goalState, ideasFor, recentTitles} from "./plan.js";
import {closeSheet, confirmIn, download, openSheet, render, toast} from "./render.js";
import {getRoutine, smartTime} from "./routine.js";
// Rhythm · «Заметил за день», журнал, разбор дня
// Часть интерфейса: общая область видимости со всеми js/*.js (порядок подключения в index.html важен).

/* ---------- «Заметил за день»: приложение само собирает день по шагам и экрану, человек подтверждает одной кнопкой ---------- */
const noticedMem = () => LS.get("noticed") || {};
function noticedList(){
  const out = [], ck = curKey(), ti = todayI(), day = dateOf(ck, ti), mem = noticedMem(), now = Date.now();
  if(health && health.stepBuckets && health.stepBuckets.length){
    const logged = ((getWeek(ck).days[ti] || {}).log || []), bad = LS.get("walkNo") || {};
    for(const g of walkSegments(health.stepBuckets, now)){
      const st = new Date(g.start); if(dateKeyOf(st) !== ck || dayIdxOf(st) !== ti) continue;
      const id = "w" + g.start; if(mem[id] != null) continue;
      if((bad[st.getHours()] || 0) >= 2) continue;
      const m0 = st.getHours()*60 + st.getMinutes();
      if(logged.some(e => e.time && e.min && (CATS[e.type] && CATS[e.type].move) && Math.abs(+e.time.slice(0,2)*60 + +e.time.slice(3,5) - m0) < 30)) continue;
      out.push({id, kind:"walk", title:`Прогулка, ${g.min} мин`, sub:`${fmtHM(st)}–${fmtHM(new Date(g.end))}, ${fmtNum(g.steps)} шагов`, g});
    }
  }
  const pd = health && health.usage ? phoneDay(day) : null;
  if(pd){
    const got = (LS.get("usageLogged") || {})[day] || {};
    for(const a of pd.apps){
      if(!["video","series","gaming","feeds"].includes(a.grp)) continue;
      const m = Math.round(a.m - (got[a.p] || 0)); if(m < 10) continue;
      const id = "u" + a.p + ":" + Math.round(a.m / 10); if(mem[id] != null) continue;
      out.push({id, kind:"app", title:`${a.l}, ${fmtDur(m)}`, sub:"по истории использования телефона", a, m});
    }
  }
  return out.slice(0, 5);
}
export function renderNoticed(){
  const card = $("noticedCard"); if(!card) return;
  const list = noticedList(); card.hidden = !list.length; if(!list.length) return;
  card.innerHTML = `<h2>Заметил за день</h2><p class="note">Приложение само это увидело. Верно ли?</p>` + list.map(n =>
    `<div class="status"><span class="rl"><b>${esc(n.title)}</b><span class="note">${esc(n.sub)}</span></span><span class="tools" style="margin:0"><button class="btn primary" data-nt="yes" data-nid="${esc(n.id)}" style="padding:5px 12px">Верно</button><button class="btn" data-nt="no" data-nid="${esc(n.id)}" style="padding:5px 12px">Нет</button></span></div>`).join("");
}
export function noticedAnswer(id, yes){
  const n = noticedList().find(x => x.id === id); if(!n) return render();
  const mem = noticedMem(); mem[id] = yes ? 1 : 0; LS.set("noticed", mem);
  if(!yes){ if(n.kind === "walk"){ const b = LS.get("walkNo") || {}, h = new Date(n.g.start).getHours(); b[h] = (b[h]||0) + 1; LS.set("walkNo", b); } toast("Понял, не записываю"); return render(); }
  const ck = curKey(), ti = todayI(), day = dateOf(ck, ti);
  if(n.kind === "walk"){
    const st = new Date(n.g.start);
    mutateQuiet(ck, w => { const d = w.days[ti] = {...(w.days[ti]||{})}; d.log = (d.log||[]).slice(); const it = w.items.find(i => i.day===ti && i.cat==="walk" && !i.done); const rec = {id:uid(), type:"walk", name:"Прогулка", time:fmtHM(st), min:n.g.min, text:"прогулка по шагам", src:"steps"}; if(it){ it.done = true; rec.plan = it.id; } d.log.push(rec); });
  } else {
    const e = {type:n.a.grp, name:n.a.l, text:n.a.l, dayOffset:0, min:n.m}; fillDefaults(e); logFromChat([e]);
    const all = LS.get("usageLogged") || {}, got = all[day] || {}; got[n.a.p] = n.a.m; LS.set("usageLogged", {[day]:got});
  }
  toast("Записал"); render();
}
/* что человек делает в телефоне сегодня: берём самое долгое приложение с экраном, минус уже записанное */
export function usageGuess(){
  const pd = phoneDay(dateOf(curKey(), todayI())); if(!pd) return null;
  const done = LS.get("usageLogged") || {}, day = dateOf(curKey(), todayI()), got = done[day] || {};
  let best = null;
  for(const a of pd.apps){
    if(!["video","series","gaming","feeds"].includes(a.grp)) continue;
    const m = a.m - (got[a.p] || 0);
    if(m >= 5 && (!best || m > best.min)) best = {type:a.grp, name:a.l, min:Math.round(m), p:a.p, total:a.m};
  }
  if(!best) return null;
  got[best.p] = best.total; const keep = {}; keep[day] = got; LS.set("usageLogged", keep);
  return best;
}
export const appsFor = ds => (health.apps && health.apps[ds]) || null;
const offHour = () => { const [h,m] = settings.screensOff.split(":").map(Number); return h + m/60; };
export function phoneDay(ds){
  const d = appsFor(ds); if(!d) return null;
  const by = {}; let ent = 0;
  const wm = (LS.get("workMarks") || {})[ds] || {};   // приложения, про которые вы сказали «это по работе»
  const apps = (d.apps||[]).map(a => ({...a, grp: wm[a.p] ? "work" : appGroup(a)}));
  for(const a of apps){ by[a.grp] = (by[a.grp]||0) + a.m; if(APP_GROUPS[a.grp] && APP_GROUPS[a.grp].ent) ent += a.m; }
  const off = offHour(), hrs = d.hours || [];
  let late = 0; for(let h=0; h<24; h++){ const v = hrs[h]||0; if(h+1 <= off) continue; late += h >= off ? v : v * (h+1-off); }
  return {total:d.total||0, pickups:d.pickups||0, ent, by, apps, late:Math.round(late)};
}
function chooseAppGroup(a){
  const inf = appInfo(a);
  openSheet(`<h2>${esc(a.l)}: что это за приложение?</h2><p class="note">${esc(inf.why)} ${inf.limit ? `Напомню о перерыве, если сидишь в нём дольше ${inf.limit} мин подряд.` : "Из-за него напоминать не буду."}</p><p class="note">Если я ошибся с типом, выбери правильный:</p>
    <div class="chips" id="agPick">${Object.entries(APP_GROUPS).map(([k,g]) => `<button type="button" class="chip ${appGroup(a)===k?"on":""}" data-ag="${k}"><i style="background:var(${g.c})"></i>${g.n}</button>`).join("")}</div>
    <div class="tools"><button class="btn" id="agCancel">Отмена</button></div>`);
  $("agPick").onclick = e => { const b = e.target.closest("[data-ag]"); if(!b) return; const m = LS.get("appTypes")||{}; m[a.p] = b.dataset.ag; LS.set("appTypes", m); closeSheet(); render(); toast("Запомнил"); };
  $("agCancel").onclick = closeSheet;
}
export function usageHelpHtml(){
  return `<div class="help"><b>Если переключатель серый или написано «Ограниченная настройка»</b>
    <ol><li>Нажмите «Настройки приложения» ниже.</li><li>В правом верхнем углу нажмите <b>⋮</b> → <b>«Разрешить ограниченные настройки»</b> и подтвердите.</li><li>Вернитесь сюда и снова нажмите «Разрешить».</li></ol>
    <span class="note">Если пункта в меню ⋮ нет, сначала один раз попробуйте включить переключатель, закройте предупреждение, и пункт появится. Так Android защищает приложения, установленные не из Google Play.</span>
    <div class="tools"><button class="btn primary" data-native="usage">Разрешить</button><button class="btn" data-native="appsettings">Настройки приложения</button></div></div>`;
}
let appsShowAll = false;
export function renderScreenCard(ck, ti){
  const card = $("screenCard"); if(!card) return;
  if(!NATIVE){ card.hidden = true; return; }
  card.hidden = false;
  if(!health.usage){ card.innerHTML = `<h2>Экранное время</h2><p class="note">Разрешите доступ к истории использования, и я буду видеть, сколько времени уходит на каждое приложение, и учитывать это в советах.</p>${usageHelpHtml()}`; return; }
  const pd = phoneDay(dateOf(ck, ti));
  if(!pd){ card.innerHTML = `<h2>Экранное время</h2><p class="note">Данных за сегодня пока нет. Нажмите «Обновить» в блоке шагов и сна.</p>`; return; }
  const lim = settings.screenLimit, list = appsShowAll ? pd.apps : pd.apps.slice(0, 5);
  card.innerHTML = `<div class="bhead"><h2>Экранное время</h2><span class="note">${pd.pickups} ${plural(pd.pickups,"разблокировка","разблокировки","разблокировок")}</span></div>
    <div class="metrics"><div class="metric"><span class="mv">${fmtDur(pd.total)}</span><span class="mk">телефон сегодня</span></div>
      <div class="metric"><span class="mv">${fmtDur(pd.ent)}</span><span class="mk">развлечения из ${fmtDur(lim)}</span><div class="bar"><div class="dn" style="width:${Math.min(100, pd.ent/lim*100)}%;background:var(${pd.ent > lim ? "--warn" : "--c-games"})"></div></div></div></div>
    ${pd.late ? `<p class="note">После ${settings.screensOff}: ${pd.late} мин</p>` : ""}
    <div class="loglist">${list.map(a => `<div class="lrow"><span class="ldot" style="background:var(${(APP_GROUPS[a.grp]||APP_GROUPS.other).c})"></span><span class="lt">${esc(a.l)}<small>${fmtDur(a.m)}</small></span><button class="chip" data-app="${esc(a.p)}">${(APP_GROUPS[a.grp]||APP_GROUPS.other).n}</button></div>`).join("")}
    ${pd.apps.length > 5 && !appsShowAll ? `<button class="btn" data-appsall="1">Все приложения (${pd.apps.length})</button>` : ""}</div>
    <p class="note">Нажмите на тип приложения, если я определил его неверно.</p>`;
}
export function appsClick(ds){
  if(ds.app){ const ck = curKey(), pd = phoneDay(dateOf(ck, todayI())); const a = pd && pd.apps.find(x=>x.p===ds.app); if(a) chooseAppGroup(a); return true; }
  if(ds.appsall){ appsShowAll = true; render(); return true; }
  return false;
}
export function weekScreenInsights(ck, ti){
  const out = [], days = [], prev = [];
  for(let d=0; d<=ti; d++){ const p = phoneDay(dateOf(ck,d)); if(p && (d < ti || p.total > 0)) days.push(p); }
  for(let d=0; d<7; d++){ const p = phoneDay(dateOf(iso(addDays(new Date(ck+"T00:00:00"),-7)), d)); if(p) prev.push(p); }
  if(!days.length) return out;
  const avg = a => a.reduce((x,y)=>x+y,0)/a.length;
  const tot = avg(days.map(p=>p.total)), ent = avg(days.map(p=>p.ent)), pick = avg(days.map(p=>p.pickups)), late = avg(days.map(p=>p.late));
  out.push([ent > settings.screenLimit ? "warn" : "ok", `Телефон в среднем ${fmtDur(Math.round(tot))} в день, из них развлечения ${fmtDur(Math.round(ent))} при лимите ${fmtDur(settings.screenLimit)}.`]);
  const agg = {}; for(const p of days) for(const a of p.apps) if(APP_GROUPS[a.grp] && APP_GROUPS[a.grp].ent) agg[a.l] = (agg[a.l]||0) + a.m;
  const top = Object.entries(agg).sort((a,b)=>b[1]-a[1]).slice(0,3);
  if(top.length) out.push(["sun", `Больше всего времени в развлечениях: ${top.map(([l,m]) => `${l} (${fmtDur(Math.round(m/days.length))} в день)`).join(", ")}.`]);
  if(pick >= 60) out.push(["warn", `В среднем ${Math.round(pick)} разблокировок в день. Отключите уведомления у неважных приложений: каждое тянет взять телефон.`]);
  if(late >= 20) out.push(["warn", `После ${settings.screensOff} в среднем ${Math.round(late)} минут в телефоне. Это сдвигает засыпание.`]);
  if(prev.length >= 3){ const pe = avg(prev.map(p=>p.ent)); const df = ent - pe; if(Math.abs(df) >= 15) out.push([df < 0 ? "ok" : "warn", `Развлечений ${df < 0 ? "меньше" : "больше"}, чем на прошлой неделе, на ${fmtDur(Math.round(Math.abs(df)))} в день.`]); }
  return out;
}

/* ---------- journal: free-text log, intake, own activities ---------- */
export function typeChipsHtml(cur, filter){
  const groups = {};
  for(const [k,t] of Object.entries(TYPES)){ if(filter && !filter(k)) continue; (groups[t.g] = groups[t.g]||[]).push(k); }
  return Object.entries(groups).map(([g, ks]) => `<div class="tgroup"><span class="label">${RITM.GROUPS[g].n}</span><div class="chips">${ks.map(k => `<button type="button" class="chip ${cur===k?"on":""}" data-cat="${k}"><i style="background:var(${CATS[k].c})"></i>${CATS[k].n}</button>`).join("")}</div></div>`).join("");
}
export function chooseType(title, cur, cb, multi){
  if(!multi){
    openSheet(`<h2>${esc(title)}</h2><div id="tcPick">${typeChipsHtml(cur)}</div><div class="tools"><button class="btn" id="tcCancel">Отмена</button></div>`);
    $("tcPick").onclick = e => { const b = e.target.closest("[data-cat]"); if(!b) return; closeSheet(); cb(b.dataset.cat); };
    $("tcCancel").onclick = closeSheet; return; }
  // несколько категорий: первая выбранная — основная, остальные становятся тегами
  const sel = cur ? [cur] : [];
  openSheet(`<h2>${esc(title)}</h2><p class="note">Можно выбрать несколько: первая — основная, остальные будут тегами.</p><div id="tcPick">${typeChipsHtml(cur)}</div><div class="tools"><button class="btn primary" id="tcDone" disabled>Готово</button><button class="btn" id="tcCancel">Отмена</button></div>`);
  const paint = () => { document.querySelectorAll("#tcPick [data-cat]").forEach(b => { const i = sel.indexOf(b.dataset.cat); b.classList.toggle("on", i >= 0); b.dataset.ord = i === 0 ? "★" : i > 0 ? String(i+1) : ""; });
    $("tcDone").disabled = !sel.length; $("tcDone").textContent = sel.length > 1 ? `Готово: ${CATS[sel[0]].n} + ещё ${sel.length-1}` : "Готово"; };
  $("tcPick").onclick = e => { const b = e.target.closest("[data-cat]"); if(!b) return; const k = b.dataset.cat, i = sel.indexOf(k); if(i >= 0) sel.splice(i, 1); else sel.push(k); paint(); };
  $("tcDone").onclick = () => { if(!sel.length) return; closeSheet(); cb(sel.slice()); };
  $("tcCancel").onclick = closeSheet; paint();
}
export function describe(e){
  const p = [];
  if(e.time) p.push("в " + e.time);
  if(e.type === "sleep") return p.join(" · ");
  if(e.stepsOnly) p.push(fmtNum(e.steps) + " шагов");
  else if(e.min) p.push(e.min >= 60 && e.min % 30 === 0 ? String(e.min/60).replace(".",",") + " ч" : e.min + " мин");
  if(e.km) p.push(String(e.km).replace(".",",") + " км");
  if(e.ml) p.push(e.ml >= 1000 ? String(e.ml/1000).replace(".",",") + " л" : e.ml + " мл");
  if(e.mg) p.push("≈" + e.mg + " мг кофеина");
  if(e.g) p.push(e.g + " г белка");
  if(e.srv && !e.mg && !e.g && !e.ml){ const n = Math.round(e.srv*10)/10; p.push(String(n).replace(".",",") + " " + plural(Math.ceil(n),"порция","порции","порций")); }
  if(e.dose) p.push(e.dose);
  return p.join(" · ");
}
export function intakeOf(log){
  const s = {kcal:0, fat:0, carb:0, water:0, waterCaf:0, mg:0, protein:0, alcohol:0, sweets:0, lastCaf:"", screen:0, lateScreen:0, move:0, groups:new Set()};
  for(const e of log||[]){
    if(e.type === "water") s.water += e.ml||0;
    if(e.type === "caffeine"){ s.mg += e.mg||0; if(e.time && e.time > s.lastCaf) s.lastCaf = e.time;
      // кофе и чай тоже жидкость: считаем объём напитка (таблетки и капсулы не в счёт)
      if(!/таблет|капсул|пилюл|предтрен|гель|жеват/i.test(e.name||"")){ const ml = e.ml != null ? e.ml : 200 * (e.srv||1); s.water += ml; s.waterCaf = (s.waterCaf||0) + ml; } }
    if(e.type === "protein") s.protein += e.g||0;
    if(e.kcal != null){ s.kcal += e.kcal; s.fat += e.f||0; s.carb += e.c||0; if(e.type !== "protein") s.protein += Math.round(e.p||0); }
    if(e.type === "alcohol") s.alcohol += e.srv||1;
    if(e.type === "sweets") s.sweets += e.srv||1;
    if(isScreen(e.type)){
      if(!e.plan) s.screen += e.min||0;
      if(e.time){ const st = +e.time.slice(0,2)*60 + +e.time.slice(3,5), off = +settings.screensOff.slice(0,2)*60 + +settings.screensOff.slice(3,5);
        const a = st < 6*60 ? st + 1440 : st, end = a + (e.min||0); s.lateScreen += Math.max(0, Math.min(end, 30*60) - Math.max(a, off)); }
    }
    if(CATS[e.type] && CATS[e.type].move && !e.plan) s.move += e.min||0;
    if(TYPES[e.type]) s.groups.add(TYPES[e.type].g);
  }
  return s;
}

export function kbjuTarget(){ return RITM.calorieTarget(settings, stepsFor(dateOf(curKey(), todayI())) || 0); }
function kbjuHtml(s, bar){
  const tg = kbjuTarget();
  if(!s.kcal && !tg) return "";
  const head = s.kcal ? `${fmtNum(s.kcal)} ккал` : "—";
  const of = tg ? ` из ~${fmtNum(tg.kcal)}` : "";
  const mac = s.kcal ? `Б ${s.protein}${tg ? "/"+tg.protein : ""} · Ж ${Math.round(s.fat)}${tg ? "/"+tg.fat : ""} · У ${Math.round(s.carb)}${tg ? "/"+tg.carbs : ""} г` : (tg ? `Ориентир: Б ${tg.protein} · Ж ${tg.fat} · У ${tg.carbs} г` : "");
  return `<div class="metric kbju"><span class="mv">${head}</span><span class="mk">калорий${of}</span>${tg ? bar(s.kcal, tg.kcal, "--c-walk") : ""}<span class="note">${mac}${s.kcal ? " · оценка по таблицам" : ""}</span>${tg ? "" : `<span class="note">Укажите рост, возраст и пол в «Цели», чтобы посчитать норму.</span>`}</div>`;
}
let logDraft = null, logShowAll = false;
function journalHtml(ctx){
  const ck = curKey(), ti = todayI(), w = getWeek(ck), log = ((w.days[ti]||{}).log||[]).slice().sort((a,b)=>(a.time||"99").localeCompare(b.time||"99"));
  const s = intakeOf(log);
  const bar = (v, max, col) => `<div class="bar"><div class="dn" style="width:${Math.min(100, max ? v/max*100 : 0)}%;background:var(${col})"></div></div>`;
  let h = ctx === "t" ? "" : `<form data-log="${ctx}" class="logform logrow"><label class="sr" for="logInput-${ctx}">Что было? Пишите как удобно</label>
    <input id="logInput-${ctx}" type="text" enterkeyhint="send" autocomplete="off" placeholder="Что делал? Кофе в 9:30…">
    <button class="btn primary" type="submit">Записать</button></form>`;
  if(logDraft && logDraft.ctx === ctx){
    h += `<div class="preview"><span class="label">Понял так</span>` + logDraft.items.map((e,i) => `<div class="lrow ${e.type ? "" : "unknown"}">
      <span class="ldot" style="background:var(${e.type ? CATS[e.type].c : "--line"})"></span>
      <span class="lt">${esc(e.name)}<small>${e.type ? esc(describe(e)) : "Не знаю, что это. Выберите тип, и я запомню"}</small></span>
      <button class="chip ${e.type ? "" : "on"}" data-lpt="${i}">${e.type ? CATS[e.type].n : "Выбрать тип"}</button>
      <button class="x" data-lpx="${i}" aria-label="Убрать">×</button></div>`).join("") +
      (logDraft.items.length ? `<div class="tools"><button class="btn primary" data-lpsave="1">Сохранить</button><button class="btn" data-lpcancel="1">Отмена</button></div>`
                             : `<p class="note">Ничего не нашёл. Попробуйте написать иначе.</p><div class="tools"><button class="btn" data-lpcancel="1">Закрыть</button></div>`) + `</div>`;
  }
  const wg = settings.waterGoal, pg = settings.proteinGoal, cm = settings.caffeineMax;
  h += `<div class="intake">
    <div class="metric"><span class="mv">${s.water >= 1000 ? (s.water/1000).toFixed(1).replace(".",",")+" л" : s.water+" мл"}</span><span class="mk">воды из ${String(wg/1000).replace(".",",")} л</span>${bar(s.water, wg, "--c-pool")}
      <div class="qbtn"><button data-qw="250">+ стакан</button><button data-qw="500">+ бутылка</button></div></div>
    <div class="metric"><span class="mv">${s.mg} мг</span><span class="mk">кофеина${s.lastCaf ? ", последний в "+s.lastCaf : ""}</span>${bar(s.mg, cm, s.mg > cm ? "--warn" : "--c-fun")}</div>
    <div class="metric"><span class="mv">${s.protein} г</span><span class="mk">белка из ${pg} г</span>${bar(s.protein, pg, "--c-strength")}</div>
  </div>` + kbjuHtml(s, bar);
  if(log.length){
    const shown = logShowAll || log.length <= 6 ? log : log.slice(-6);
    h += `<div class="loglist"><span class="label">Записано сегодня</span>` + shown.map(e => `<div class="lrow">
      <span class="ldot" style="background:var(${(CATS[e.type]||CATS.other).c})"></span>
      <span class="lt" ${e.min ? `data-ledit="${e.id}" style="cursor:pointer"` : ""}>${esc(e.name)}<small>${esc(describe(e))}${e.plan ? " · из плана" : ""}${e.min ? " · изменить" : ""}</small></span>
      <button class="x" data-ldel="${e.id}" aria-label="Удалить">×</button></div>`).join("") +
      (log.length > 6 && !logShowAll ? `<button class="btn" data-lall="1">Показать все ${log.length}</button>` : "") + `</div>`;
  }
  return h;
}
export function renderJournal(){ const el = $("logCard"); if(el) el.innerHTML = `<div class="bhead"><h2>Вода, кофе, белок</h2><span class="note">записывать — во вкладке «Чат»</span></div>` + journalHtml("t"); }

export function fillDefaults(e){
  const t = TYPES[e.type]; if(!t) return e;
  if(t.unit === "min" && !e.stepsOnly && e.min == null) e.min = t.def;
  if(e.type === "water" && !e.ml) e.ml = 250;
  if(e.type === "caffeine" && !e.mg) e.mg = 90 * (e.srv||1);
  if(e.type === "protein" && !e.g) e.g = 25 * (e.srv||1);
  if(t.unit === "srv" && !e.srv) e.srv = 1;
  if(e.type === "sleep" && !e.event) e.event = "bed";
  return e;
}
function submitLog(ctx){
  const ta = $("logInput-"+ctx); const text = ta ? ta.value.trim() : ""; if(!text) return;
  const items = RITM.parse(text).map(e => { if(e.unknown) e.wasUnknown = true; return e.type ? fillDefaults(e) : e; });
  logDraft = {ctx, items, text};
  render();
}
function saveLogDraft(){
  if(!logDraft) return;
  if(logDraft.items.some(e => !e.type)){ toast("Выберите тип для записей без типа или уберите их"); return; }
  const k = curKey(), d = todayI(), items = logDraft.items;
  mutateQuiet(k, w => {
    const day = w.days[d] = {...(w.days[d]||{})}; day.log = (day.log||[]).slice();
    for(const e of items){
      if(e.changed || e.wasUnknown) RITM.remember(e.text, e.type, e.wasUnknown ? e.name : null);
      const rec = {id:uid(), type:e.type, name:e.name, time:e.time||"", text:e.text};
      for(const f of ["min","km","ml","mg","g","srv","tags","steps","stepsOnly","event","dose","derived"]) if(e[f] != null) rec[f] = e[f];
      if(rec.stepsOnly) day.stepsManual = rec.steps;
      if(TYPES[rec.type].unit === "min" && !rec.stepsOnly){
        const it = w.items.find(i => i.day===d && i.cat===rec.type && !i.done);
        if(it){ it.done = true; rec.plan = it.id; if(day.review && day.review.entries && day.review.entries[it.id]) day.review.entries[it.id] = {done:true, min:rec.min}; }
      }
      day.log.push(rec);
    }
  });
  const n = items.length; logDraft = null;
  if(rvState) rvState = getReview(getWeek(k), d);
  render(); toast(`Записано: ${n} ${plural(n,"запись","записи","записей")}`);
}
export function quickWater(ml){
  const k = curKey(), d = todayI();
  mutateQuiet(k, w => { const day = w.days[d] = {...(w.days[d]||{})}; day.log = (day.log||[]).concat([{id:uid(), type:"water", name:"Вода", time:nowHM(), ml}]); });
  render(); toast(`+${ml} мл воды`);
}
function deleteLog(id){
  const k = curKey(), d = todayI();
  mutateQuiet(k, w => { const day = w.days[d] = {...(w.days[d]||{})}; const e = (day.log||[]).find(x=>x.id===id);
    if(e && e.plan){ const it = w.items.find(i=>i.id===e.plan); if(it) it.done = false; }
    day.log = (day.log||[]).filter(x=>x.id!==id); });
  if(rvState) rvState = getReview(getWeek(k), d);
  render(); toast("Запись удалена");
}
export function journalClick(ds, t){
  if(ds.lpt != null && logDraft){ const e = logDraft.items[+ds.lpt]; chooseType(`Что такое «${e.name}»?`, e.type, c => { e.type = c; e.changed = true; e.unknown = false; if(e.wasUnknown && !e.name) e.name = CATS[c].n; fillDefaults(e); render(); }); return true; }
  if(ds.lpx != null && logDraft){ logDraft.items.splice(+ds.lpx, 1); render(); return true; }
  if(ds.lpsave){ saveLogDraft(); return true; }
  if(ds.lpcancel){ logDraft = null; render(); return true; }
  if(ds.qw){ quickWater(+ds.qw); return true; }
  if(ds.ldel){ confirmIn(t, "Удалить?", () => deleteLog(ds.ldel)); return true; }
  if(ds.lall){ logShowAll = true; render(); return true; }
  return false;
}
document.addEventListener("submit", e => { const f = e.target.closest("form[data-log]"); if(!f) return; e.preventDefault(); submitLog(f.dataset.log); });

/* own activities */
let actDraft = {n:"", t:null, manual:false}, actOpen = false;
export function renderActs(){
  const el = $("actsCard"); if(!el) return;
  const list = customActs();
  el.innerHTML = `<h2>Мои занятия</h2>
    <p class="note">В базе ${RITM.CATALOG.length} занятий${list.length ? ", ваших " + list.length : ""}. Своё занятие приложение будет узнавать в журнале и предлагать в советах.</p>
    <details class="base" ${actOpen ? "open" : ""}><summary>Добавить своё занятие</summary>
    <div class="field"><label class="label" for="actName">Название</label><input id="actName" type="text" value="${esc(actDraft.n)}" placeholder="Например, флорбол или прогулка с собакой" autocomplete="off"></div>
    <div class="field"><span class="label">Тип ${actDraft.t && !actDraft.manual ? '<span class="note">— определил по названию</span>' : ""}</span><div id="actType">${typeChipsHtml(actDraft.t, k => k !== "sleep")}</div></div>
    <div class="tools"><button class="btn primary" id="actAdd">Добавить занятие</button></div></details>
    ${list.length ? `<span class="label">Ваши занятия</span>` + list.map((a,i) => `<div class="lrow"><span class="ldot" style="background:var(${(CATS[a.t]||CATS.other).c})"></span><span class="lt">${esc(a.n)}<small>${(CATS[a.t]||CATS.other).full}</small></span><button class="x" data-actdel="${i}" aria-label="Удалить">×</button></div>`).join("") : ""}
    <details class="base"><summary>Посмотреть всю базу</summary><input id="actSearch" type="search" placeholder="Поиск по базе" autocomplete="off"><div id="actBase"></div></details>`;
  const det = el.querySelector("details.base"); if(det) det.ontoggle = () => { actOpen = det.open; };
  const inp = $("actName");
  inp.oninput = () => { actDraft.n = inp.value; if(!actDraft.manual){ const g = RITM.guessType(actDraft.n); actDraft.t = g; $("actType").innerHTML = typeChipsHtml(actDraft.t, k => k !== "sleep"); } };
  $("actType").onclick = e => { const b = e.target.closest("[data-cat]"); if(!b) return; actDraft.t = b.dataset.cat; actDraft.manual = true; $("actType").innerHTML = typeChipsHtml(actDraft.t, k => k !== "sleep"); };
  $("actAdd").onclick = () => {
    const n = actDraft.n.trim(); if(!n){ toast("Напишите название"); return; } if(!actDraft.t){ toast("Выберите тип"); return; }
    const arr = customActs(); arr.push({n, t:actDraft.t, a:n.toLowerCase().replace(/ё/g,"е"), m:TYPES[actDraft.t].def}); LS.set("custom", arr);
    actDraft = {n:"", t:null, manual:false}; renderActs(); toast("Занятие добавлено");
  };
  const srch = $("actSearch"), base = $("actBase");
  const draw = () => { const q = (srch.value||"").toLowerCase().replace(/ё/g,"е"); const res = RITM.CATALOG.filter(e => !q || e.n.toLowerCase().replace(/ё/g,"е").includes(q) || CATS[e.t].full.toLowerCase().includes(q)).slice(0, 60);
    base.innerHTML = res.map(e => `<div class="lrow"><span class="ldot" style="background:var(${CATS[e.t].c})"></span><span class="lt">${esc(e.n)}<small>${CATS[e.t].full}${e.s ? " · "+esc(e.s) : ""}</small></span></div>`).join("") || `<p class="note">Ничего не нашлось. Добавьте это занятие выше.</p>`; };
  srch.oninput = draw; draw();
}
/* что Ритм не понял: можно объяснить в одно нажатие или сохранить список */
const MISS_WHY = {unknown:"не знал такого занятия", chat:"принял за разговор", nothing:"ничего не понял", question:"не нашёл ответа"};
export function renderMisses(){
  const el = $("missCard"); if(!el) return;
  const list = (LS.get("misses") || []).slice().reverse();
  el.hidden = !list.length; if(!list.length){ el.innerHTML = ""; return; }
  el.innerHTML = `<h2>Что я не понял</h2>
    <p class="note">Фразы, на которых я споткнулся. Подскажи, что это было, и я запомню. Список можно сохранить и прислать разработчику, чтобы научить меня новым словам.</p>
    ${list.slice(0, 20).map((x, i) => `<div class="lrow miss"><span class="lt">«${esc(x.text.length > 90 ? x.text.slice(0, 90) + "…" : x.text)}»<small>${fmtTime(x.at)} · ${MISS_WHY[x.why] || ""}</small></span>
      <span class="mbtns"><button class="btn sm" data-missact="${esc(x.text)}">Занятие…</button><button class="btn sm" data-missnot="${esc(x.text)}">Не занятие</button><button class="x" data-missdel="${esc(x.text)}" aria-label="Убрать">×</button></span></div>`).join("")}
    <div class="tools"><button class="btn" id="missSave">Сохранить список</button><button class="btn" id="missClear">Очистить</button></div>`;
  $("missSave").onclick = () => download("ritm-ne-ponyal.txt", (LS.get("misses") || []).map(x => `${new Date(x.at).toISOString().slice(0,16).replace("T"," ")}\t${x.why}\t${x.text}`).join("\n"), "text/plain");
  $("missClear").onclick = () => { LS.set("misses", []); renderMisses(); toast("Список очищен"); };
}
export function missClick(ds){
  if(ds.missdel != null){ LS.set("misses", (LS.get("misses") || []).filter(x => x.text !== ds.missdel)); renderMisses(); return true; }
  if(ds.missnot != null){ RITM.forget(ds.missnot); LS.set("misses", (LS.get("misses") || []).filter(x => x.text !== ds.missnot)); renderMisses(); toast("Запомнил: это не занятие"); return true; }
  if(ds.missact != null){ const text = ds.missact;
    chooseType(`Что такое «${text.slice(0, 40)}»?`, RITM.guessType(text), t => { const nm = (RITM.core(text) || text).trim(); RITM.remember(text, t, nm.charAt(0).toUpperCase() + nm.slice(1, 50));
      LS.set("misses", (LS.get("misses") || []).filter(x => x.text !== text)); renderMisses(); toast(`Запомнил: ${CATS[t].full.toLowerCase()}`); });
    return true; }
  return false;
}
export function actsClick(ds){ if(ds.actdel == null) return false; const arr = customActs(); arr.splice(+ds.actdel, 1); LS.set("custom", arr); renderActs(); toast("Удалено"); return true; }

/* ---------- day review: input, analysis, plan corrections ---------- */
const MOVE = c => !!(CATS[c] && CATS[c].move);
export const defaultMin = it => { const m = /(\d+)\s*(?:–\d+\s*)?мин/.exec(it.t || ""); if(m) return +m[1]; const c = RITM.CATALOG.find(e=>e.n===it.t) || customActs().find(e=>e.n===it.t); if(c && c.m) return c.m; return (TYPES[it.cat]||TYPES.other).def || 30; };
export const hmMinus = (hm, m) => { const [h,mm] = hm.split(":").map(Number); let t = (h*60+mm-m+1440)%1440; return pad(Math.floor(t/60))+":"+pad(t%60); };
export function usualBedtime(){
  if(getRoutine().bedSet && settings.bedtime) return {hm: settings.bedtime, auto:false};
  const starts = []; const t = new Date();
  for(let i=0;i<7;i++){ const s = sleepFor(iso(addDays(t,-i))); if(s) starts.push(bedMin(s.start)); }
  if(starts.length >= 3){ starts.sort((a,b)=>a-b); const m = starts[Math.floor(starts.length/2)] % 1440; return {hm: pad(Math.floor(m/60))+":"+pad(m%60), auto:true}; }
  return {hm: settings.bedtime || "23:30", auto:false};
}
export const reviewTime = () => hmMinus(usualBedtime().hm, 30);

export function getReview(w, d){
  const its = w.items.filter(i=>i.day===d);
  const old = (w.days[d]||{}).review || {};
  const entries = {};
  const linked = {}; for(const x of ((w.days[d]||{}).log||[])) if(x.plan) linked[x.plan] = x;
  for(const it of its){ const e = (old.entries||{})[it.id]; entries[it.id] = e ? {...e} : (linked[it.id] ? {done:true, min:linked[it.id].min||defaultMin(it)} : {done:!!it.done, min:defaultMin(it)}); }
  return {entries, extras:(old.extras||[]).map(x=>({...x})), steps:old.steps ?? null, sleepH:old.sleepH ?? null, screen:old.screen ?? null, caffeine:!!old.caffeine, alcohol:!!old.alcohol, stress:old.stress ?? null, done:!!old.done};
}
function saveReview(rv){
  const k = curKey(), d = todayI();
  mutateQuiet(k, w => {
    w.days[d] = {...(w.days[d]||{}), review:{...rv, at:new Date().toISOString()}};
    for(const it of w.items) if(it.day===d && rv.entries[it.id]) it.done = rv.entries[it.id].done;
  });
}
export function mutateQuiet(key, fn){ const w = getWeek(key); fn(w); saveWeek(key, w); }

function activeMinutesWeek(w, ck, uptoDay, todayRv){
  let total = 0;
  for(let d=0; d<=uptoDay; d++){
    const rv = d === uptoDay && todayRv ? todayRv : (w.days[d]||{}).review;
    if(rv && rv.entries){
      for(const it of w.items) if(it.day===d && MOVE(it.cat) && rv.entries[it.id] && rv.entries[it.id].done) total += rv.entries[it.id].min || 0;
      for(const x of rv.extras||[]) if(MOVE(x.cat)) total += x.min || 0;
    } else for(const it of w.items) if(it.day===d && it.done && MOVE(it.cat)) total += defaultMin(it);
  }
  return total;
}

function analyzeDay(rv){
  const ck = curKey(), ti = todayI(), w = getWeek(ck), h = w.days[ti]||{}, ds = dateOf(ck, ti);
  const its = w.items.filter(i=>i.day===ti);
  const doneIts = its.filter(i=>rv.entries[i.id] && rv.entries[i.id].done);
  const L = intakeOf(h.log);
  const undone = its.filter(i=>!isScreen(i.cat) && !(rv.entries[i.id] && rv.entries[i.id].done));
  const moveMin = doneIts.filter(i=>MOVE(i.cat)).reduce((s,i)=>s+(rv.entries[i.id].min||0),0) + rv.extras.filter(x=>MOVE(x.cat)).reduce((s,x)=>s+(x.min||0),0) + L.move;
  const PD = phoneDay(ds);
  const otherDevice = c => c === "gaming" || c === "series";
  const screenMin = PD ? PD.ent + doneIts.filter(i=>otherDevice(i.cat)).reduce((s,i)=>s+(rv.entries[i.id].min||0),0) + (h.log||[]).filter(e=>otherDevice(e.type) && !e.plan).reduce((s,e)=>s+(e.min||0),0)
    : doneIts.filter(i=>isScreen(i.cat)).reduce((s,i)=>s+(rv.entries[i.id].min||0),0) + rv.extras.filter(x=>isScreen(x.cat)).reduce((s,x)=>s+(x.min||0),0) + L.screen;
  const steps = stepsFor(ds) ?? rv.steps;
  const sl = sleepFor(ds);
  const stt = sleepTotal(ds), sleepMin = stt ? stt.min : (sl ? sl.min : (rv.sleepH != null ? rv.sleepH*60 : null));
  const goalSteps = settings.stepsGoal;
  const screenH = screenMin ? screenMin/60 : (rv.screen != null ? rv.screen : null);
  const weekMin = activeMinutesWeek(w, ck, ti, rv), pace = Math.round(150/7*(ti+1));
  const did = c => doneIts.some(i=>i.cat===c) || rv.extras.some(x=>x.cat===c) || (h.log||[]).some(e=>e.type===c);
  const cafLate = rv.caffeine || (L.lastCaf && L.lastCaf > settings.caffeineCutoff), hadAlcohol = rv.alcohol || L.alcohol > 0;
  const good = [], bad = [], tips = [];

  if(steps != null){ if(steps >= goalSteps) good.push(`${fmtNum(steps)} шагов: дневная цель выполнена.`); else if(steps >= goalSteps*0.7) good.push(`${fmtNum(steps)} шагов: почти цель.`); else if(steps < goalSteps*0.5) bad.push(`Всего ${fmtNum(steps)} шагов при цели ${fmtNum(goalSteps)}.`); }
  if(moveMin >= 30) good.push(`${moveMin} минут движения. Это больше дневной нормы (около 20–30 минут, чтобы набрать 150 в неделю).`);
  else if(moveMin > 0) good.push(`${moveMin} минут движения. Хорошо, но до дневной нормы чуть-чуть не хватило.`);
  else bad.push("Сегодня не было движения сверх обычного.");
  if(did("strength")) good.push("Силовая сделана. Мышцам нужно 2 таких дня в неделю.");
  if(did("social")) good.push("Было живое общение. Это один из самых сильных факторов настроения.");
  if(did("unplug")) good.push("Было время без экранов.");
  if(did("outing") || did("hobby")) good.push("Нашлось время просто для удовольствия.");
  if(did("nature")) good.push("Время на природе: один из самых простых способов снизить стресс.");
  if(did("reading") || did("learning")) good.push("Было время на чтение или развитие.");
  if(did("mobility") || did("relax")) good.push("Позаботились о восстановлении: растяжка или отдых.");
  if(["move","social","rest"].filter(g => L.groups.has(g) || doneIts.some(i=>TYPES[i.cat] && TYPES[i.cat].g===g)).length >= 3) good.push("Разнообразный день: движение, люди и отдых.");
  const wg = settings.waterGoal, pg = settings.proteinGoal;
  if(L.water >= wg) good.push(`Воды ${String(L.water/1000).replace(".",",")} л: норма выполнена.`);
  else if(L.water > 0 && L.water < wg*0.6) bad.push(`Воды всего ${L.water} мл при цели ${String(wg/1000).replace(".",",")} л.`);
  if(L.protein >= pg) good.push(`Белка ${L.protein} г: цель закрыта.`);
  if(L.mg > settings.caffeineMax) bad.push(`Кофеина около ${L.mg} мг: больше безопасных ${settings.caffeineMax} мг в день.`);
  if(L.sweets >= 3) bad.push("Много сладкого за день.");
  const lateMin = Math.max(L.lateScreen, PD ? PD.late : 0);
  if(lateMin >= 10) bad.push(`Экраны после ${settings.screensOff}: ${lateMin} мин.`);
  if(PD){
    if(PD.total >= 300) bad.push(`Телефон ${fmtDur(PD.total)} за день.`); else if(PD.total <= 120 && new Date().getHours() >= 18) good.push(`Телефон всего ${fmtDur(PD.total)} за день.`);
    if(PD.pickups >= 80) bad.push(`${PD.pickups} разблокировок телефона.`);
  }
  if(NATIVE){ const t0 = new Date(); t0.setHours(0,0,0,0); const ns = nudgeStats(t0.getTime(), Date.now()+1);
    if(ns.obeyed) good.push(`Послушался и сделал перерыв от телефона: ${ns.obeyed} ${plural(ns.obeyed,"раз","раза","раз")}.`);
    if(ns.ignored) bad.push(`Проигнорировал мои просьбы сделать перерыв: ${ns.ignored} ${plural(ns.ignored,"раз","раза","раз")}` + (ns.promisedIgnored ? `, хотя ${ns.promisedIgnored === 1 ? "один раз обещал" : "обещал"} выключить` : "") + "."); }
  const topEnt = PD ? PD.apps.filter(a => APP_GROUPS[a.grp] && APP_GROUPS[a.grp].ent)[0] : null;
  if(h.light) good.push("Был дневной свет. Это помогает и бодрости днём, и сну ночью.");
  if(sleepMin != null){ if(sleepEnough(sleepMin) || (h.energy >= 4 && sleepMin >= 300)) good.push(`Сон ${fmtDur(sleepMin)}: ${h.energy >= 4 && !sleepEnough(sleepMin) ? "меньше ориентира, но самочувствие хорошее — тебе, видимо, хватает" : "в норме"}.`); else if(sleepLow(sleepMin)) bad.push(`Сон ${fmtDur(sleepMin)}: меньше твоей нормы (${needText()}).`); }
  if(its.length && !undone.length) good.push("Все дела из плана выполнены.");
  else if(undone.length) bad.push(`Не получилось: ${undone.map(i=>i.t).join("; ")}.`);
  if(screenMin > settings.screenLimit) bad.push(`Экраны ${fmtDur(screenMin)} при вашем лимите ${fmtDur(settings.screenLimit)}.`);
  else if(screenMin === 0 && rv.screen != null && rv.screen >= 2) bad.push("Больше 2 часов на экраны.");
  else if(screenMin === 0 && rv.screen === 0) good.push("День почти без развлекательных экранов.");
  if(cafLate) bad.push(L.lastCaf ? `Последний кофеин в ${L.lastCaf}: после ${settings.caffeineCutoff} он может сдвинуть засыпание на час и больше.` : "Кофе во второй половине дня: может сдвинуть засыпание.");
  if(hadAlcohol) bad.push("Алкоголь: засыпается легче, но глубокий сон хуже.");
  if(h.energy && h.energy <= 2) bad.push(`Энергия низкая (${h.energy} из 5).`);
  if(h.energy && h.energy >= 4) good.push(`Энергия ${h.energy} из 5.`);
  if(rv.stress != null && rv.stress >= 4) bad.push(`Высокий стресс (${rv.stress} из 5).`);

  const bed = usualBedtime().hm;
  if(sleepLow(sleepMin) && !(h.energy >= 4)) tips.push(`Сегодня ложитесь не позже ${bed}, а лучше на 30 минут раньше: после короткой ночи организму нужно наверстать.`);
  if(cafLate) tips.push(`Завтра последний кофе до ${settings.caffeineCutoff}.`);
  if(L.water > 0 && L.water < wg*0.6) tips.push("Выпивайте стакан воды с каждым приёмом пищи и держите бутылку на столе: так проще добрать норму.");
  if(L.water === 0) tips.push("Записывайте воду кнопкой «+ стакан» в журнале: так я смогу подсказать, хватает ли её.");
  if((did("strength") || did("sport")) && L.protein < pg*0.6) tips.push("В день силовой белок помогает восстановлению: творог, яйца, мясо, рыба или протеин.");
  if(hadAlcohol) tips.push("Если завтра хочется отдохнуть, попробуйте без алкоголя и сравните, как будете спать.");
  if(topEnt && screenMin > settings.screenLimit) tips.push(`Больше всего времени ушло на ${topEnt.l} (${fmtDur(topEnt.m)}). Поставьте на него таймер: Настройки → Цифровое благополучие → Таймеры приложений.`);
  if(PD && PD.pickups >= 80) tips.push("Отключите уведомления у соцсетей и игр: меньше поводов брать телефон.");
  if(lateMin >= 20) tips.push(`Включите режим «Отход ко сну» в Цифровом благополучии на ${settings.screensOff}: экран станет серым, и залипать сложнее.`);
  else if((screenMin > settings.screenLimit) || (rv.screen != null && rv.screen >= 2)) tips.push(`Ограничьте игры и Ютуб часом и заканчивайте к ${settings.screensOff}.`);
  if(steps != null && steps < goalSteps*0.7) tips.push(`Добавьте 20–30 минут ходьбы: прогулка после ужина даёт около 2 000–3 000 шагов.`);
  if(weekMin < pace) tips.push(`За неделю пока ${weekMin} минут движения при ориентире ${pace} на сегодня (150 в неделю — рекомендация ВОЗ). Небольшие прогулки быстро закрывают разницу.`);
  if(rv.stress != null && rv.stress >= 4) tips.push("Перед сном 10 минут спокойной прогулки или медленного дыхания (вдох на 4, выдох на 6) снижают напряжение.");
  if(h.energy && h.energy <= 2 && moveMin === 0) tips.push("В дни без движения энергия часто ниже. Завтра начните с короткой прогулки на свету.");
  if(!tips.length) tips.push("Хороший баланс. Завтра повторите то, что сработало сегодня.");

  const score = good.length - bad.length;
  const verdict = score >= 3 ? "Сильный день" : score >= 1 ? "Хороший день" : score >= -1 ? "Неплохой день, есть что подтянуть" : "Тяжёлый день. Бывает, завтра будет легче";
  return {verdict, good, bad, tips: tips.slice(0,5), props: proposeChanges(rv, {sleepMin, steps, screenH, energy:h.energy, stress:rv.stress})};
}

function proposeChanges(rv, m){
  const ck = curKey(), ti = todayI(), props = [];
  const last = ti === 6;
  const key = last ? iso(addDays(new Date(ck+"T00:00:00"),7)) : ck;
  const w = getWeek(key), cw = getWeek(ck);
  const from = last ? 0 : ti+1, to = last ? 2 : 6;
  const tomorrow = last ? 0 : ti+1;
  const load = Array(7).fill(0); w.items.forEach(i=>load[i.day]++);
  const taken = (d,c) => w.items.some(i=>i.day===d && i.cat===c) || props.some(p=>p.day===d && p.cat===c);
  const bestDay = (c, avoid=-1) => { let b=-1, bl=99; for(let d=from; d<=to; d++){ if(d===avoid || taken(d,c)) continue; const l = load[d] + (c==="swim" && d<5 ? 2 : 0) + (d===tomorrow && sleepLow(m.sleepMin) && (c==="strength"||c==="swim") ? 5 : 0); if(l<bl){ bl=l; b=d; } } return b; };
  const tired = (sleepLow(m.sleepMin) && !(m.energy >= 4)) || (m.energy && m.energy <= 2) || (m.stress != null && m.stress >= 4);

  // 1. undone goal items from today → move forward
  if(!last) for(const it of cw.items.filter(i=>i.day===ti && goalCats().includes(i.cat) && !(rv.entries[i.id] && rv.entries[i.id].done))){
    const d = bestDay(it.cat); if(d < 0) continue;
    props.push({type:"move", key:ck, id:it.id, day:d, cat:it.cat, text:`Перенести «${it.t}» ${DACC[d]}`, why:"Не получилось сегодня, но до конца недели есть место"}); load[d]++;
  }
  // 2. tired → lighten tomorrow
  if(tired){
    for(const it of w.items.filter(i=>i.day===tomorrow && (i.cat==="strength"||i.cat==="swim") && !i.done)){
      const d = bestDay(it.cat, tomorrow);
      if(d >= 0 && d !== tomorrow){ props.push({type:"move", key, id:it.id, day:d, cat:it.cat, text:`Сдвинуть «${it.t}» с завтра ${DACC[d]}`, why:"После короткого сна или тяжёлого дня интенсивная нагрузка даётся хуже"}); load[d]++; }
    }
    if(!taken(tomorrow,"walk")){ props.push({type:"add", key, day:tomorrow, cat:"walk", t:"Лёгкая прогулка на свету, 20 мин", time:"", text:`Добавить завтра лёгкую прогулку`, why:"Мягко поднимает энергию без перегрузки"}); load[tomorrow]++; }
    props.push({type:"add", key, day:tomorrow, cat:"unplug", t:"Лечь пораньше, без экрана", time:hmMinus(usualBedtime().hm, 30), text:`Завтра лечь на 30 минут раньше`, why:"Чтобы вернуть недосып"});
  }
  // 3. low steps → walk tomorrow
  if(m.steps != null && m.steps < settings.stepsGoal*0.5 && !taken(tomorrow,"walk")){
    props.push({type:"add", key, day:tomorrow, cat:"walk", t:"Прогулка после ужина, 30 мин", time:"20:00", text:`Добавить завтра прогулку после ужина`, why:`Сегодня было ${fmtNum(m.steps)} шагов`}); load[tomorrow]++;
  }
  // 4. late screens → move tomorrow's games earlier
  if(m.screenH != null && m.screenH >= 2){
    for(const it of w.items.filter(i=>i.day===tomorrow && isScreen(i.cat) && (!i.time || i.time > "20:00"))){
      props.push({type:"time", key, id:it.id, time:"19:30", cat:it.cat, day:tomorrow, text:`Перенести «${it.t}» завтра на 19:30 и ограничить часом`, why:"Чтобы к отбою мозг успел успокоиться"});
    }
  }
  // 5. remaining weekly deficits → add varied ideas
  if(!last){
    const gs = goalState(cw, ti+1), recent = recentTitles();
    for(const c of goalCats()){
      let need = gs[c].deficit - props.filter(p=>p.cat===c && (p.type==="add" || p.type==="move")).length;
      // items moved forward from today were counted as missed; moving them makes them future again
      let off = 0;
      while(need > 0){
        const d = bestDay(c); if(d < 0) break;
        const idea = ideasFor(c, d, null, off++, recent) || {t:CATS[c].n, time:""};
        recent.add(idea.t);
        props.push({type:"add", key, day:d, cat:c, t:idea.t, time:smartTime(c, d, idea.time||""), text:`Добавить ${DACC[d]}: ${idea.t}`, why:`До цели недели не хватает: ${CATS[c].n.toLowerCase()}`});
        load[d]++; need--;
      }
    }
  } else if(!getWeek(key).items.length){
    props.push({type:"plan", key, text:"Составить план на следующую неделю", why:"Приложение подберёт занятия по вашим целям и разложит по дням"});
  }
  return props.map((p,i)=>({...p, i, on:true}));
}

export let rvState = null, rvResult = null;
export function openReview(){ __set_tab("review"); rvState = getReview(getWeek(curKey()), todayI()); rvResult = rvState.done ? analyzeDay(rvState) : null; if(rvResult) rvResult.props.forEach(p=>p.on=false); render(); window.scrollTo({top:0}); }

export function renderReview(){
  const ck = curKey(), ti = todayI(), w = getWeek(ck), ds = dateOf(ck,ti), h = w.days[ti]||{};
  if(!rvState) rvState = getReview(w, ti);
  const rv = rvState, its = w.items.filter(i=>i.day===ti).sort((a,b)=>(a.time||"99").localeCompare(b.time||"99"));
  $("subtitle").textContent = `${DFULL[ti]}, ${new Date().getDate()} ${MONG[new Date().getMonth()]}`;
  const minsCtl = (attr, id, v) => `<span class="mins"><button data-${attr}="${id}" data-dm="-5" aria-label="Меньше">−</button><span class="num">${v} мин</span><button data-${attr}="${id}" data-dm="5" aria-label="Больше">+</button></span>`;
  const rows = its.map(it => { const e = rv.entries[it.id]; return `<div class="rvrow ${e.done?"on":""}"><button class="tick" data-rvtick="${it.id}" aria-label="Сделано"><span></span></button><span class="rt">${esc(it.t)}<small>${(CATS[it.cat]||CATS.other).n}</small></span>${e.done ? minsCtl("rvmin", it.id, e.min) : ""}</div>`; }).join("");
  const extras = rv.extras.map((x,i) => `<div class="rvrow on"><span class="tick"><span></span></span><span class="rt">${esc(x.t)}<small>${CATS[x.cat].n}, вне плана</small></span>${minsCtl("rvxmin", i, x.min)}<button class="x" data-rvxdel="${i}" aria-label="Убрать">×</button></div>`).join("");
  const st = stepsFor(ds), sl = sleepFor(ds);
  const seg = (name, opts, cur) => `<div class="seg">${opts.map(([v,l]) => `<button class="${cur===v?"on":""}" data-rvset="${name}" data-v="${v}">${l}</button>`).join("")}</div>`;
  const scale = (key, cur) => `<div class="row">${[1,2,3,4,5].map(n=>`<button class="${cur===n?"on":""}" data-rv${key}="${n}">${n}</button>`).join("")}</div>`;

  let html = `<section class="rvsec"><div class="bhead"><h2>Что было сегодня</h2><span class="note">отметьте и поправьте минуты</span></div>
    ${rows || `<p class="note">В плане на сегодня ничего не было. Добавьте, чем занимались, ниже.</p>`}${extras}
</section>
    <section class="card"><h2>Журнал дня</h2><p class="note">Допишите всё, что было вне плана: еду, напитки, экраны, любые занятия.</p>${journalHtml("r")}</section>
    <section class="card"><h2>Шаги и сон</h2>
      ${st != null ? `<div class="status"><span class="rl"><b>${fmtNum(st)} шагов</b><span class="note">с телефона</span></span></div>`
        : `<div class="field"><label class="label" for="rvSteps">Шаги за день, если знаете</label><input id="rvSteps" type="number" inputmode="numeric" min="0" step="100" value="${rv.steps ?? ""}" placeholder="например, 6500"></div>`}
      ${sl ? `<div class="status"><span class="rl"><b>Сон ${fmtDur(sl.min)}</b><span class="note">${sl.start}–${sl.end}, ${sl.src==="hc"?"Health Connect":"по телефону, примерно"}</span></span></div>`
        : `<span class="label">Сколько спали прошлой ночью</span>${seg("sleepH", [[5,"меньше 6 ч"],[6.5,"6–7 ч"],[7.5,"7–8 ч"],[8.5,"больше 8 ч"]], rv.sleepH)}`}
    </section>
    <section class="card"><h2>Самочувствие</h2>
      <div class="scale"><span class="label">Энергия</span>${scale("energy", h.energy)}</div>
      <div class="scale"><span class="label">Настроение</span>${scale("mood", h.mood)}</div>
      <div class="scale"><span class="label">Стресс</span>${scale("stress", rv.stress)}</div>
    </section>
    ${intakeOf(h.log).screen ? "" : `<section class="card"><h2>Экраны</h2><p class="note">Если не записывали игры, видео и соцсети в журнал, оцените примерно.</p>
      ${seg("screen", [[0,"почти не было"],[1,"до часа"],[1.5,"1–2 часа"],[2,"больше 2 часов"]], rv.screen)}</section>`}
    <button class="btn primary" id="rvGo" style="padding:14px;font-size:1rem">${rvResult ? "Разобрать заново" : "Разобрать день"}</button>`;

  if(rvResult){
    const r = rvResult;
    html += `<section class="card" id="rvResult"><span class="verdict">${r.verdict}</span>
      ${r.good.length ? `<span class="label">Что получилось</span><ul class="list">${r.good.map(t=>`<li>${esc(t)}</li>`).join("")}</ul>` : ""}
      ${r.bad.length ? `<span class="label">Что мешало</span><ul class="list bad">${r.bad.map(t=>`<li>${esc(t)}</li>`).join("")}</ul>` : ""}
      <span class="label">Советы</span><ul class="list tips">${r.tips.map(t=>`<li>${esc(t)}</li>`).join("")}</ul></section>`;
    if(r.props.length){
      html += `<section class="card"><h2>${todayI()===6 ? "Предлагаю на следующие дни" : "Предлагаю поправить план"}</h2><p class="note">Снимите галочки с того, что не подходит.</p>
        ${r.props.map(p => `<button class="prop ${p.on?"on":""}" data-prop="${p.i}"><span class="box"></span><span class="pt">${esc(p.text)}<small>${esc(p.why)}</small></span></button>`).join("")}
        <div class="tools"><button class="btn primary" id="rvApply">Применить выбранное</button><button class="btn" data-tab="week">Открыть неделю</button></div></section>`;
    } else html += `<section class="card"><h2>План менять не нужно</h2><p class="note">Всё нужное до конца недели уже стоит в расписании.</p></section>`;
  }
  $("tab-review").innerHTML = html;
  const stepsInput = $("rvSteps"); if(stepsInput) stepsInput.onchange = () => { const v = parseInt(stepsInput.value,10); rv.steps = isNaN(v) ? null : v; saveReview(rv); };
  $("rvGo").onclick = () => { rv.done = true; saveReview(rv); rvResult = analyzeDay(rv); render(); setTimeout(() => { const el = $("rvResult"); if(el) el.scrollIntoView({behavior:"smooth", block:"start"}); }, 50); };
  const ap = $("rvApply"); if(ap) ap.onclick = applyProps;
}

function applyProps(){
  const sel = rvResult.props.filter(p=>p.on); if(!sel.length){ toast("Ничего не выбрано"); return; }
  let n = 0;
  for(const p of sel){
    if(p.type === "plan"){ n += autoFill(p.key); continue; }
    mutateQuiet(p.key, w => {
      if(p.type === "move"){ const it = w.items.find(i=>i.id===p.id); if(it){ it.day = p.day; n++; } }
      else if(p.type === "time"){ const it = w.items.find(i=>i.id===p.id); if(it){ it.time = p.time; n++; } }
      else if(p.type === "add"){ w.items.push({id:uid(), day:p.day, cat:p.cat, t:p.t, time:p.time||"", done:false}); n++; }
    });
  }
  rvResult.props = [];
  render();
  toast(`План обновлён: ${n} ${plural(n,"изменение","изменения","изменений")}`);
}

export function reviewClick(ds){
  if(!rvState) return false;
  const rv = rvState, k = curKey(), d = todayI();
  if(ds.rvtick){ const e = rv.entries[ds.rvtick]; e.done = !e.done; }
  else if(ds.rvmin){ const e = rv.entries[ds.rvmin]; e.min = Math.max(5, Math.min(300, e.min + +ds.dm)); }
  else if(ds.rvxmin != null){ const x = rv.extras[+ds.rvxmin]; x.min = Math.max(5, Math.min(300, x.min + +ds.dm)); }
  else if(ds.rvxdel != null){ rv.extras.splice(+ds.rvxdel, 1); }
  else if(ds.rvadd){ const c = ds.rvadd; rv.extras.push({cat:c, t:{walk:"Прогулка", strength:"Силовая", pool:"Бассейн", social:"Общение", offline:"Время без экранов", fun:"Что-то приятное", games:"Игры и Ютуб"}[c], min:c==="games"?60:30}); }
  else if(ds.rvset){ const v = +ds.v; rv[ds.rvset] = rv[ds.rvset] === v ? null : v; }
  else if(ds.rvflag){ rv[ds.rvflag] = !rv[ds.rvflag]; }
  else if(ds.rvenergy || ds.rvmood){ const key = ds.rvenergy ? "energy" : "mood", v = +(ds.rvenergy || ds.rvmood); mutateQuiet(k, w => { w.days[d] = {...(w.days[d]||{})}; w.days[d][key] = w.days[d][key] === v ? null : v; }); }
  else if(ds.rvstress){ const v = +ds.rvstress; rv.stress = rv.stress === v ? null : v; }
  else if(ds.prop != null){ const p = rvResult && rvResult.props[+ds.prop]; if(p) p.on = !p.on; render(); return true; }
  else return false;
  saveReview(rv); render(); return true;
}


export const __set_rvState = v => (rvState = v);
export const __set_rvResult = v => (rvResult = v);
