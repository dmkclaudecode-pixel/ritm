// Rhythm · Ответы на напоминания, виджет, наблюдатель приложений, привычные часы, «Главное»
// Часть интерфейса: общая область видимости со всеми js/*.js (порядок подключения в index.html важен).
"use strict";
/* ---------- ответы на напоминания о телефоне: реакция, выводы, поправки ---------- */
const NUDGE_KINDS = new Set(["nudge", "nudge-result"]);
function nudgeContext(){
  const cb = ctxBot(); let m = cb.m;
  if(!NATIVE) return null;
  // без выбора сообщения: ближайшее напоминание выше по чату, если после него вы ещё ничего не писали
  if(!cb.explicit){ const arr = getChat(); m = null;
    let i0 = arr.length - 1; if(arr[i0] && arr[i0].who === "me") i0--;   // последнее «я» — это сам ответ
    for(let i = i0; i >= 0 && i >= i0 - 5; i--){ const x = arr[i]; if(x.who === "me") break; if(NUDGE_KINDS.has(x.kind)){ m = x; break; } } }
  if(!m || !NUDGE_KINDS.has(m.kind)) return null;
  if(!cb.explicit && Date.now() - m.at > 60*60*1000) return null;
  const hist = nudgeHistory();
  const rec = (m.nid && hist.find(n => n.id === m.nid)) || hist.slice().reverse().find(n => Math.abs(n.at - m.at) < 3*60000) || null;
  return rec ? {m, rec, explicit:cb.explicit} : null;
}
function classifyNudgeReply(s, rec){
  const mm = / (\d{1,3}) ?мин/.exec(s);
  const min = mm ? Math.min(120, +mm[1]) : / (пять) минут /.test(s) ? 5 : / (десять) минут /.test(s) ? 10 : / (пятнадцать) минут /.test(s) ? 15 : / (полчаса|пол часа) /.test(s) ? 30 : / (час|часик) /.test(s) ? 60 : 0;
  if(/ (зачем|почему|с чего|что значит|откуда ты знаешь|как ты узнал|как ты видишь|на каком основании) /.test(s)) return {kind:"why"};
  if(/ (не по работе|не по делу|не для работы|не работа|не рабочее|не рабочий) /.test(s)) return {kind:"comply"};
  if(/ (по работе|по делу|для работы|рабоч\S+|работаю|по учебе|учусь|учеба|созвон\S*|митинг\S*|для дела|нужно для|надо для|по заданию|клиент\S*|заказчик\S*|документац\S*|читаю статью) /.test(s)) return {kind:"work"};
  if(rec && rec.reason === "work" && /^ (да|ага|угу|конечно|точно|естественно|ну да) /.test(s)) return {kind:"work"};
  if(/ (жду|в очереди|в метро|еду|в дороге|в транспорте|в пробке|в поезде|в самолете|у врача|в приемной|в такси) /.test(s)) return {kind:"wait", min:min || 45};
  if(/ (устал\S*|скучно|скука|тревож\S*|стресс\S*|нервнич\S*|не могу уснуть|не спится|нет сил|грустно|тоскливо|одиноко|тяжело|выгорел\S*|заняться нечем|не знаю чем заняться|лень) /.test(s)){
    const f = / (скучно|скука|заняться нечем|не знаю чем заняться) /.test(s) ? "bored" : / (тревож\S*|стресс\S*|нервнич\S*) /.test(s) ? "stress" : / (не могу уснуть|не спится) /.test(s) ? "sleepless" : / (грустно|тоскливо|одиноко) /.test(s) ? "sad" : "tired";
    return {kind:"feeling", feel:f};
  }
  if(min || / (отстань|не мешай|не хочу|потом|еще чуть|еще немного|еще минут\S*|дай еще|погоди|подожди|позже|не сейчас) /.test(s)) return {kind:"refuse", min:min || 15};
  if(/ (ладно|ок|окей|хорошо|понял|поняла|выключаю|закрываю|закрою|убираю|ухожу|сейчас закрою|договорились|да|верно|правда|согласен|согласна|точно|ты прав\S*|завязываю|хватит|нет) /.test(s)) return {kind:"comply"};
  return {kind:null};
}
const FEEL_WORD = {tired:"усталость", bored:"скука", stress:"тревога и стресс", sleepless:"бессонница", sad:"грусть"};
function nativeNudgeReply(id, kind, text, snooze){ try{ return NATIVE.nudgeReply ? NATIVE.nudgeReply(id, kind, text, snooze || 0) : ""; }catch(e){ return ""; } }
function nudgeChatReply(text, s, pre){
  const cx = nudgeContext(); if(!cx) return false;
  const c = classifyNudgeReply(s, cx.rec); if(!c.kind) return false;
  const nw = s.trim().split(/\s+/).length;
  // без явного «ответа» берём только короткие и понятные реплики, иначе это обычная запись
  if(!cx.explicit && (nw > 10 || pre.some(e => e.type && e.min && c.kind !== "refuse" && c.kind !== "wait" && !e.fuzzy && !/(работ|учеб|учус)/.test(s)))) return false;
  const rec = cx.rec, id = rec.id, label = rec.label || "приложение", pkg = rec.pkg;
  const hm = d => pad(d.getHours()) + ":" + pad(d.getMinutes());
  if(c.kind === "why"){
    const lim = appInfo({p:pkg}).limit, why = ({
      session:`Ты был в ${label} около ${rec.min} минут за последний час, а мой порог для него — ${lim || settings.watchMin || 40} минут подряд.`,
      late:`Было уже за ${settings.screensOff}, а ты ${rec.min} минут сидел в ${label}. Экран перед сном сдвигает засыпание.`,
      work:`Сейчас рабочее время, а ${label} был открыт ${rec.min} минут из последнего часа.`,
      day:`Развлекательных экранов за сегодня набралось больше твоего лимита (${fmtDur(settings.screenLimit)}).`
    })[rec.reason] || `В ${label} набралось ${rec.min} минут.`;
    bot(why + " Если это неверно или слишком строго, скажи, и я поправлю.", [act("Это по работе", {op:"nudgeWork", id, label}), act(`Напоминать реже`, {op:"watchLess"}), act("Понятно", {op:"keep"})]);
    return true;
  }
  if(c.kind === "work"){
    nativeNudgeReply(id, "work", text, 0);
    const wm = LS.get("workMarks") || {}, dk = iso(new Date()); wm[dk] = {...(wm[dk] || {}), [pkg]:1}; LS.set("workMarks", wm);
    bot(`Понял, ${label} по работе. Сегодня про него не напоминаю и в развлечения не считаю.`);
    try{ nudgeReview(); }catch(e){}
    return true;
  }
  if(c.kind === "wait"){
    nativeNudgeReply(id, "wait", text, c.min);
    bot(`Понял, в дороге или в ожидании можно. Проверю через ${c.min} минут (около ${hm(new Date(Date.now() + c.min*60000))}), а не через 15.`);
    return true;
  }
  if(c.kind === "refuse"){
    nativeNudgeReply(id, "refuse", text, c.min);
    bot(`Хорошо, ещё ${c.min} минут. Загляну около ${hm(new Date(Date.now() + c.min*60000))} и посмотрю, закрыл ли ты ${label}.`);
    return true;
  }
  if(c.kind === "comply"){
    nativeNudgeReply(id, "comply", text, 0);
    bot(`Договорились. Загляну через 15 минут. Если получится без ${label}, я это отмечу.`);
    return true;
  }
  if(c.kind === "feeling"){
    nativeNudgeReply(id, "feeling", text, 20);
    const nf = LS.get("nudgeFeel") || {}; nf[c.feel] = (nf[c.feel] || 0) + 1; LS.set("nudgeFeel", nf);
    const tip = ({tired:"Когда сил нет, телефон кажется отдыхом, но не восстанавливает. Лучше 5 минут без экрана: вода, окно, пара вдохов.", bored:"От скуки лента затягивает сильнее всего. Выбери что-то из короткого: прогулка на 10 минут, звонок близким, музыка и уборка.", stress:"В тревоге лента только подкидывает новые поводы. Попробуй 2 минуты медленного дыхания, выдох подлиннее вдоха, а потом решим, что с этим делать.", sleepless:"Экран ночью ещё сильнее отодвигает сон. Отложи телефон, притуши свет, лучше бумажная книга или тихая музыка.", sad:"Если грустно, поговорить с живым человеком лучше, чем листать ленту. Хочешь, я напомню написать кому-то из близких?"})[c.feel];
    bot(`Спасибо, что сказал. ${tip} Проверю через 20 минут, как ты.`);
    if(nf[c.feel] === 3) bot(`Заметил: уже ${nf[c.feel]} раза, когда ты залипаешь в телефоне, причина — ${FEEL_WORD[c.feel]}. Это важнее, чем сами минуты: займёмся причиной, а не лимитами.`);
    return true;
  }
  return false;
}
// выводы и поправки по истории реакций на напоминания
function nudgeReview(){
  if(!NATIVE || !NATIVE.nudges) return false;
  const hist = nudgeHistory().filter(n => n.at > Date.now() - 30*864e5), P = LS.get("nudgeProposed") || {}, now = Date.now();
  const by = {};
  for(const n of hist){ const o = by[n.pkg] = by[n.pkg] || {label:n.label, workDays:new Set(), work:0, ignored7:0};
    if(n.response === "work"){ o.work++; o.workDays.add(iso(new Date(n.at))); }
    if(n.outcome === "ignored" && n.at > now - 7*864e5) o.ignored7++; }
  const seen = (k, days) => P[k] && now - P[k] < days*864e5, mark = k => { P[k] = now; LS.set("nudgeProposed", P); };
  for(const [pkg, o] of Object.entries(by)){
    // «по работе» минимум в два разных дня: в рабочее время это приложение больше не считаем отвлечением
    if(o.workDays.size >= 2 && !(settings.workOk && settings.workOk[pkg]) && !seen("ok:" + pkg, 30)){
      settings.workOk = {...(settings.workOk || {}), [pkg]:1}; persistSettings(); mark("ok:" + pkg); syncWatch();
      bot(`Ты уже ${o.workDays.size} ${plural(o.workDays.size, "раз", "раза", "раз")} в разные дни говорил, что ${o.label} по работе. Запомнил: в рабочее время про него больше не спрашиваю «по делу ли».`, [act("Вернуть вопросы", {op:"workOkUndo", pkg, label:o.label}), act("Хорошо", {op:"keep"})]);
      return true;
    }
    // часто «по работе» и приложение числится развлечением: предлагаем сменить тип
    if(o.work >= 4 && appGroup({p:pkg}) !== "work" && !seen("type:" + pkg, 30)){
      mark("type:" + pkg);
      bot(`${o.label} ты уже ${o.work} ${plural(o.work, "раз", "раза", "раз")} называл рабочим. Считать его работой и учёбой, а не развлечением? Тогда его минуты уйдут из экранного времени.`, [act("Да, это работа", {op:"appWork", pkg, label:o.label}), act("Нет, оставить", {op:"keep"})]);
      return true;
    }
    // напоминания не действуют: предлагаем поменять лимит
    if(o.ignored7 >= 3 && !seen("ign:" + pkg, 5)){
      mark("ign:" + pkg);
      const cur = appInfo({p:pkg}).limit || settings.watchMin || 40, up = Math.min(180, cur + 20);
      bot(`Про ${o.label} я напомнил уже ${o.ignored7} ${plural(o.ignored7, "раз", "раза", "раз")} за неделю, и ты оставался в нём. Значит, либо порог слишком строгий, либо напоминания не работают. Что поменять?`,
        [act(`Порог ${up} минут`, {op:"appLimit", pkg, label:o.label, min:up}), act("Напоминать реже", {op:"watchLess"}), act("Оставить как есть", {op:"keep"})]);
      return true;
    }
  }
  return false;
}
/* ---------- виджет на главном экране ---------- */
let lastWidget = "";
function syncWidget(){
  if(!NATIVE || !NATIVE.setWidget) return;
  const ck = curKey(), ti = todayI(), L = intakeOf((getWeek(ck).days[ti] || {}).log), st = stepsFor(dateOf(ck, ti));
  const j = JSON.stringify({date:iso(new Date()), water:L.water, waterGoal:settings.waterGoal, mg:L.mg, mgMax:settings.caffeineMax, steps: st != null ? Math.round(st) : -1, stepsGoal:settings.stepsGoal});
  if(j !== lastWidget){ lastWidget = j; try{ NATIVE.setWidget(j); }catch(e){} }
}
/* ---------- app watcher settings & history ---------- */
let lastWatchSync = "";
function syncWatch(){
  if(!NATIVE || !NATIVE.setWatch) return;
  const r = getRoutine(), types = LS.get("appTypes") || {};
  const ent = new Set(Object.entries(KNOWN_APPS).filter(([,g]) => APP_GROUPS[g] && APP_GROUPS[g].ent).map(([p]) => p));
  for(const day of Object.values(health.apps||{})) for(const a of day.apps||[]) if(APP_GROUPS[appGroup(a)] && APP_GROUPS[appGroup(a)].ent) ent.add(a.p);
  const nonEnt = Object.entries(types).filter(([,g]) => !(APP_GROUPS[g] && APP_GROUPS[g].ent)).map(([p]) => p);
  for(const p of nonEnt) ent.delete(p);
  const limits = {}, notes = {};
  const seen = new Map(); for(const p of Object.keys(KNOWN_APPS)) seen.set(p, {p, c:-1});
  for(const day of Object.values(health.apps||{})) for(const a of day.apps||[]) seen.set(a.p, a);
  for(const a of seen.values()){ const inf = appInfo(a); limits[a.p] = inf.limit; notes[a.p] = inf.why; if(inf.limit > 0) ent.add(a.p); else ent.delete(a.p); }
  const cfg = {limits, notes, enabled: !!(settings.notify && (settings.watchMin ?? 40) > 0 && health.usage), sessionMin: settings.watchMin ?? 40, dayLimit: settings.screenLimit, ent:[...ent], nonEnt, workOk:Object.keys(settings.workOk || {}),
    wake: wakeFor(todayI()), off: settings.screensOff, workDays: Array.isArray(r.workDays) ? r.workDays : [], workFrom: r.work ? r.work.from : "", workTo: r.work ? r.work.to : ""};
  const s = JSON.stringify(cfg); if(s !== lastWatchSync){ lastWatchSync = s; try{ NATIVE.setWatch(s); }catch(e){} }
}
function nudgeHistory(){ if(!NATIVE || !NATIVE.nudges) return []; try{ return JSON.parse(NATIVE.nudges()); }catch(e){ return []; } }
function nudgeStats(fromMs, toMs){
  const list = nudgeHistory().filter(n => n.at >= fromMs && n.at < toMs);
  const c = k => list.filter(n => n.outcome === k).length;
  return {n:list.length, obeyed:c("obeyed"), ignored:c("ignored"), exempt:c("exempt"), promisedIgnored:list.filter(n=>n.outcome==="ignored" && n.response==="comply").length, list};
}

/* ---------- what each app is and how it affects you ---------- */
const GROUP_INFO = {
  feeds:  {risk:"high", why:"Лента без конца: легко залипнуть, а сравнение себя с другими может портить настроение."},
  video:  {risk:"medium", why:"Видео бывает и полезным, и бесконечной лентой рекомендаций. Короткие ролики затягивают сильнее всего."},
  gaming: {risk:"medium", why:"Игры — нормальный отдых, но долгие сессии и игры перед сном мешают заснуть."},
  series: {risk:"low", why:"Фильм или сериал — нормальный отдых, если не включать «ещё одну серию» до ночи."},
  chat:   {risk:"none", why:"Мессенджер — в основном общение, сам по себе не вреден."},
  browser:{risk:"none", why:"Браузер может быть чем угодно, поэтому к нему не придираюсь."},
  music:  {risk:"none", why:"Музыка и подкасты обычно идут фоном, это не экранное время."},
  work:   {risk:"none", why:"Работа, учёба, почта и календарь — это дело, а не развлечение."},
  health: {risk:"none", why:"Здоровье и спорт — только плюс."},
  maps:   {risk:"none", why:"Карты и такси — по делу."},
  shop:   {risk:"low", why:"Покупки: иногда залипаешь в каталоге, но обычно по делу."},
  other:  {risk:"none", why:"Обычное приложение, без претензий."}
};
const APP_NOTES = {
  "com.zhiliaoapp.musically":["high","TikTok — бесконечная лента коротких видео: быстро съедает время и приучает к постоянной смене картинки."],
  "com.ss.android.ugc.trill":["high","TikTok — бесконечная лента коротких видео: быстро съедает время и приучает к постоянной смене картинки."],
  "com.instagram.android":["high","Instagram — лента и рилсы: легко залипнуть, а чужие «идеальные» жизни могут портить настроение."],
  "com.google.android.youtube":["medium","YouTube бывает и полезным (обучение, разборы), и бесконечной лентой рекомендаций. Shorts затягивают сильнее всего."],
  "com.vkontakte.android":["high","ВКонтакте — лента и клипы: легко пролистать час, не заметив."],
  "com.reddit.frontpage":["high","Reddit — бесконечные ветки и обсуждения, затягивает надолго."],
  "com.twitter.android":["high","X (Twitter) — быстрая лента новостей и споров, часто добавляет тревоги."],
  "org.telegram.messenger":["none","Telegram — в первую очередь мессенджер. Если сидишь в каналах, отметь его как «Соцсети», и я буду присматривать."],
  "com.whatsapp":["none","WhatsApp — общение, к нему не придираюсь."],
  "com.duolingo":["none","Duolingo — учёба, это в плюс."],
  "tv.twitch.android.app":["medium","Twitch — длинные стримы, легко просидеть весь вечер."],
  "com.netflix.mediaclient":["low","Netflix — фильмы и сериалы: отдых, если без марафонов до ночи."],
  "ru.kinopoisk":["low","Кинопоиск — фильмы и сериалы: отдых, если без марафонов до ночи."]
};
function appInfo(a){
  const g = appGroup(a), base = GROUP_INFO[g] || GROUP_INFO.other, own = APP_NOTES[a.p];
  const overridden = (LS.get("appTypes")||{})[a.p];
  const risk = own && !overridden ? own[0] : base.risk, why = own && !overridden ? own[1] : base.why;
  const b = settings.watchMin ?? 40;
  let limit = risk === "high" ? Math.max(20, b - 10) : risk === "medium" ? b : risk === "low" ? b * 2 : 0;
  const ov = settings.appLimit && settings.appLimit[a.p]; if(ov && limit > 0) limit = ov;
  return {group:g, risk, why, limit};
}
/* ---------- screen time by app (Android app, usage access) ---------- */
const APP_GROUPS = {
  video:{n:"Видео", ent:true, c:"--c-games"}, series:{n:"Фильмы и сериалы", ent:true, c:"--c-games"}, gaming:{n:"Игры", ent:true, c:"--c-games"},
  feeds:{n:"Соцсети", ent:true, c:"--c-social"}, chat:{n:"Мессенджеры", c:"--c-pool"}, browser:{n:"Браузер", c:"--c-other"},
  music:{n:"Музыка и подкасты", c:"--c-fun"}, work:{n:"Работа и учёба", c:"--c-offline"}, health:{n:"Здоровье и спорт", c:"--c-walk"},
  maps:{n:"Карты и такси", c:"--c-mobility"}, shop:{n:"Покупки", c:"--c-fun"}, other:{n:"Другое", c:"--c-other"}
};
const KNOWN_APPS = {
  "com.google.android.youtube":"video","app.revanced.android.youtube":"video","com.zhiliaoapp.musically":"video","com.ss.android.ugc.trill":"video","tv.twitch.android.app":"video","com.vk.vkvideo":"video","ru.rutube.app":"video","com.google.android.apps.youtube.kids":"video",
  "com.netflix.mediaclient":"series","ru.kinopoisk":"series","ru.ivi.client":"series","ru.more.play":"series","ru.okko.android":"series","com.disney.disneyplus":"series","com.amazon.avod.thirdpartyclient":"series","com.hbo.hbonow":"series","com.wbd.stream":"series",
  "com.instagram.android":"feeds","com.instagram.barcelona":"feeds","com.vkontakte.android":"feeds","com.facebook.katana":"feeds","com.twitter.android":"feeds","com.reddit.frontpage":"feeds","com.pinterest":"feeds","ru.ok.android":"feeds","com.snapchat.android":"feeds","ru.zen.android":"feeds","com.linkedin.android":"feeds","com.threads.android":"feeds",
  "org.telegram.messenger":"chat","org.telegram.messenger.web":"chat","org.thunderdog.challegram":"chat","com.whatsapp":"chat","com.viber.voip":"chat","com.discord":"chat","com.google.android.apps.messaging":"chat","ru.oneme.app":"chat","com.vk.im":"chat","com.facebook.orca":"chat","org.thoughtcrime.securesms":"chat",
  "com.android.chrome":"browser","org.mozilla.firefox":"browser","com.yandex.browser":"browser","com.opera.browser":"browser","com.microsoft.emmx":"browser","com.brave.browser":"browser","com.sec.android.app.sbrowser":"browser","com.heytap.browser":"browser",
  "com.spotify.music":"music","ru.yandex.music":"music","com.google.android.apps.youtube.music":"music","com.apple.android.music":"music","com.soundcloud.android":"music","com.google.android.apps.podcasts":"music",
  "com.google.android.apps.maps":"maps","ru.yandex.yandexmaps":"maps","ru.yandex.taxi":"maps","com.ubercab":"maps","ru.yandex.yandexnavi":"maps","com.waze":"maps",
  "com.google.android.gm":"work","com.microsoft.office.outlook":"work","com.Slack":"work","com.slack":"work","com.microsoft.teams":"work","notion.id":"work","com.google.android.apps.docs":"work","com.google.android.calendar":"work","us.zoom.videomeetings":"work","com.duolingo":"work","com.google.android.keep":"work",
  "com.google.android.apps.fitness":"health","com.sec.android.app.shealth":"health","com.strava":"health","com.heytap.health":"health","com.oplus.health":"health",
  "com.wildberries.ru":"shop","ru.ozon.app.android":"shop","com.avito.android":"shop","com.alibaba.aliexpresshd":"shop","com.amazon.mShop.android.shopping":"shop"
};
const CAT_MAP = {0:"gaming", 1:"music", 2:"video", 3:"other", 4:"feeds", 5:"feeds", 6:"maps", 7:"work"};
const appGroup = a => (LS.get("appTypes")||{})[a.p] || KNOWN_APPS[a.p] || CAT_MAP[a.c] || "other";


/* ---------- привычные часы: утренний и вечерний сигнал идут за реальным подъёмом и отбоем ---------- */
const r5 = m => Math.round(m / 5) * 5;
function rhythmTimes(){
  let n = 0; const t = new Date(); for(let i=0;i<14;i++) if(sleepFor(iso(addDays(t,-i)))) n++;
  if(n < 5) return null;
  const wake = toMinHM(wakeTime()), bed = toMinHM(usualBedtime().hm);
  const bedN = bed < 12*60 ? bed + 1440 : bed;                         // отбой после полуночи
  const morning = Math.max(6*60 + 30, Math.min(10*60, r5(wake + 45)));
  const evening = Math.max(19*60, Math.min(22*60 + 30, r5(bedN - 150)));
  return {morning: fromMin(morning), evening: fromMin(evening), wake: wakeTime(), bed: usualBedtime().hm};
}
function renderRhythm(){
  const b = $("rhythmToggle"); if(!b) return; const on = settings.rhythm !== false, r = rhythmTimes();
  b.textContent = "Подстраивать под мой ритм: " + (on ? "включено" : "выключено"); b.classList.toggle("primary", on);
  $("rhythmNote").textContent = r ? `По данным сна: подъём около ${r.wake}, отбой около ${r.bed}. Утро ${r.morning}, вечер ${r.evening}.` : "Пока мало данных о сне. Нужно хотя бы пять ночей.";
}
$("rhythmToggle").onclick = () => { settings.rhythm = settings.rhythm === false; persistSettings(); LS.set("rhythmDay", ""); if(settings.rhythm !== false) applyRhythm(); renderRhythm(); };
function applyRhythm(){
  if(settings.rhythm === false) return;
  const day = new Date().toDateString(); if(LS.get("rhythmDay") === day) return;
  const r = rhythmTimes(); if(!r) return;
  LS.set("rhythmDay", day);
  const was = {m:settings.morning, e:settings.evening};
  const far = (x, y) => Math.abs(toMinHM(x) - toMinHM(y)) >= 20;
  if(!far(r.morning, was.m) && !far(r.evening, was.e)) return;
  if(far(r.morning, was.m)) settings.morning = r.morning;
  if(far(r.evening, was.e)) settings.evening = r.evening;
  persistSettings();
  if(NATIVE && settings.notify) try{ NATIVE.setReminders(settings.morning, settings.evening, true); }catch(e){}
  bot(`Подстроил сигналы под ваш ритм: вы встаёте около ${r.wake}, ложитесь около ${r.bed}. Утренний план теперь в ${settings.morning}, вечерний в ${settings.evening}.`,
    [act("Оставить как было", {op:"rhythmOff", m:was.m, e:was.e}), act("Хорошо", {op:"keep"})]);
  render();
}

/* ---------- «Главное»: два-три показателя, которые человек выбрал сам; остальное по запросу ---------- */
const FOCUS_ALL = {sleep:"Сон", steps:"Шаги", screen:"Экран", water:"Вода", goals:"Цели недели"};
const focusList = () => { const f = (settings.focus || (NATIVE ? ["sleep","steps","screen"] : ["goals","water"])).filter(k => FOCUS_ALL[k]); return f.length ? f.slice(0, 3) : ["sleep","steps","screen"]; };
function focusTile(k, ck, ti){
  const ds = dateOf(ck, ti), w = getWeek(ck);
  const tile = (v, label, frac, cls) => `<div class="metric ${cls||""}"><span class="mv">${v}</span><span class="mk">${label}</span>${frac != null ? `<div class="bar"><div class="dn" style="width:${Math.max(0, Math.min(100, frac*100))}%;background:var(--c-walk)"></div></div>` : ""}</div>`;
  if(k === "sleep"){ const s = sleepFor(ds); return s ? tile(fmtDur(s.min), "сон прошлой ночью", s.min/480) : tile("—", "сон: данных нет"); }
  if(k === "steps"){ const st = stepsFor(ds); return st != null ? tile(fmtNum(st), "шагов из " + fmtNum(settings.stepsGoal), st/settings.stepsGoal) : tile("—", "шагов пока нет"); }
  if(k === "screen"){ const pd = health && health.usage ? phoneDay(ds) : null; return pd ? tile(fmtDur(pd.ent), "развлечений из " + fmtDur(settings.screenLimit), pd.ent/settings.screenLimit) : tile("—", "экран: нет доступа"); }
  if(k === "water"){ const L = intakeOf((w.days[ti]||{}).log); return tile(L.water + " мл", "воды из " + settings.waterGoal, L.water/settings.waterGoal); }
  if(k === "goals"){ const gs = goalState(w, ti); let g = 0, d = 0; for(const c of goalCats()){ if(!gs[c]) continue; g += gs[c].goalMin; d += Math.min(gs[c].goalMin, gs[c].doneMin); } return tile(g ? Math.round(d/g*100) + "%" : "—", "целей недели", g ? d/g : null); }
  return "";
}
function renderFocus(ck, ti){
  const card = $("focusCard"); if(!card) return;
  const more = !!LS.get("moreMetrics");
  card.innerHTML = `<div class="metrics">${focusList().map(k => focusTile(k, ck, ti)).join("")}</div>
    <div class="tools"><button class="btn" id="focusMore">${more ? "Скрыть остальное" : "Все показатели"}</button><button class="btn" id="focusEdit">Что показывать</button></div>`;
  for(const id of ["bodyCard","screenCard"]) { const el = $(id); if(el && !more) el.hidden = true; }
  $("focusMore").onclick = () => { LS.set("moreMetrics", !more); render(); };
  $("focusEdit").onclick = () => openSheet(`<h2>Что показывать главным</h2><p class="note">Выберите до трёх. Остальное откроется кнопкой «Все показатели».</p>
    <div class="chips" id="focusPick">${Object.entries(FOCUS_ALL).map(([k, n]) => `<button type="button" class="chip ${focusList().includes(k) ? "on" : ""}" data-fk="${k}">${n}</button>`).join("")}</div>
    <div class="tools"><button class="btn primary" id="focusOk">Готово</button></div>`);
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-fk]"); if(!b) return;
  let f = focusList().slice(); const k = b.dataset.fk;
  if(f.includes(k)) f = f.filter(x => x !== k); else if(f.length < 3) f.push(k); else return toast("Не больше трёх");
  if(!f.length) return; settings.focus = f; persistSettings(); b.classList.toggle("on", f.includes(k));
});
document.addEventListener("click", e => { if(e.target.id === "focusOk"){ closeSheet(); render(); } });
