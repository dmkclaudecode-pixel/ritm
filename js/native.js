// Rhythm · Мост с Android, прогулки по шагам, установка и офлайн
// Часть интерфейса: общая область видимости со всеми js/*.js (порядок подключения в index.html важен).
"use strict";
/* ---------- android app bridge ---------- */
function checkOpen(){ if(!NATIVE) return false; let o = ""; try{ o = NATIVE.consumeOpen(); }catch(e){} if(o === "review"){ closeSheet(); openReview(); return true; } if(o === "chat"){ closeSheet(); tab = "chat"; render(); scrollChat(); return true; } if(o === "today"){ closeSheet(); tab = "today"; render(); return true; } return false; }
/* ---------- прогулки по шагам: замечаем ходьбу и предлагаем записать ---------- */
// сегмент: подряд идущие 10-минутные отрезки, где ≥60 шагов в минуту; ≥15 минут и ≥1200 шагов
function walkSegments(buckets, nowMs){
  const B = (buckets||[]).map(b => ({t: new Date(b.t).getTime(), n: b.n})).filter(b => !isNaN(b.t)).sort((a,b) => a.t - b.t);
  const segs = []; let cur = null;
  for(const b of B){
    const hot = b.n >= 600, warm = b.n >= 200;
    if(cur && b.t - cur.end <= 10*60000 && (hot || warm && cur.lastHot)){ cur.end = b.t + 10*60000; cur.steps += b.n; cur.lastHot = hot; if(hot) cur.hotEnd = b.t + 10*60000; continue; }
    if(cur) segs.push(cur); cur = null;
    if(hot) cur = {start: b.t, end: b.t + 10*60000, hotEnd: b.t + 10*60000, steps: b.n, lastHot: true};
  }
  if(cur) segs.push(cur);
  return segs.map(g => ({start:g.start, end:g.hotEnd, steps:g.steps, min:Math.round((g.hotEnd - g.start)/60000)}))
             .filter(g => g.min >= 20 && g.steps >= 1200 && g.end <= nowMs - 10*60000);
}
function suggestWalks(){
  return;   // теперь прогулки показывает карточка «Заметил за день» на экране «Сегодня»
  if(!health || !health.stepBuckets || !health.stepBuckets.length) return;
  const seen = LS.get("walkSeen") || {}, bad = LS.get("walkNo") || {}, nowMs = Date.now();
  let posted = 0;
  for(const g of walkSegments(health.stepBuckets, nowMs)){
    if(posted >= 2) break;
    const id = String(g.start); if(seen[id]) continue;
    const st = new Date(g.start), en = new Date(g.end), hh = st.getHours();
    if((bad[hh] || 0) >= 2){ seen[id] = 1; continue; }                                 // в это время вы уже дважды говорили «это не прогулка»
    const k = dateKeyOf(st), d = dayIdxOf(st), w = getWeek(k), day = (w.days && w.days[d]) || {};
    const a0 = g.start, a1 = g.end, hmOf = x => x.time ? +x.time.slice(0,2)*60 + +x.time.slice(3,5) : null, m0 = st.getHours()*60 + st.getMinutes(), m1 = m0 + g.min;
    const busy = (day.log||[]).some(e => e.type !== "water" && e.type !== "caffeine" && hmOf(e) != null && (CATS[e.type] && CATS[e.type].move) && e.min && hmOf(e) < m1 && hmOf(e) + e.min > m0)
      || (day.log||[]).some(e => e.src === "steps" && hmOf(e) != null && Math.abs(hmOf(e) - m0) < 20);
    if(busy){ seen[id] = 1; continue; }
    // дорога на работу и с работы обычно не прогулка: если сегмент вплотную к рабочим границам — всё равно спрашиваем, но нейтрально
    const t0 = fmtHM(st), t1 = fmtHM(en);
    seen[id] = 1; posted++;
    bot(`Заметил по шагам: с ${t0} до ${t1} вы шли около ${g.min} минут, ${fmtNum(g.steps)} шагов. Записать как прогулку?`,
      [act("Да, записать прогулку", {op:"walkAdd", key:k, d, time:t0, min:g.min, steps:g.steps}), act("Это не прогулка (дорога, дела)", {op:"walkNo", hour:hh})]);
  }
  LS.set("walkSeen", seen);
}
const fmtHM = d => pad(d.getHours()) + ":" + pad(d.getMinutes());

window.__ritmNative = {
  onHealth(json){
    try{ const d = JSON.parse(json); if(d.error) return;
      health = {apps:d.apps||{}, steps:d.steps||{}, sleep:d.sleep||{}, sessions:d.sessions||[], stepBuckets:d.stepBuckets||[], stepsGranted:!!d.stepsGranted, sleepGranted:!!d.sleepGranted, bgGranted:!!d.bgGranted, usage:!!d.usage, at:d.at};
      LS.set("health", health); try{ suggestWalks(); }catch(e){} try{ syncWalkWatch(); }catch(e){} try{ applyRhythm(); }catch(e){} render();
    }catch(e){}
  },
  onResume(){ try{ NATIVE.refreshHealth(); }catch(e){} pullNative(); maybeAutoBackup(); if(!maybeWeeklyReport() && !maybeMissReview() && !maybeForecast() && !maybePreempt() && !maybeHabit() && !morningBrief() && tab === "chat") askRoutine(); if(!checkOpen()) render(); scrollChat(); },
  onNotifPermission(ok){
    if(ok){ settings.notify = true; persistSettings(); try{ NATIVE.setReminders(settings.morning, settings.evening, true); }catch(e){} toast("Уведомления включены"); }
    else toast("Без разрешения уведомления не придут. Его можно дать в настройках Android");
    render();
  }
};
if(NATIVE){
  $("nToggle").onclick = () => {
    if(settings.notify){ settings.notify = false; persistSettings(); try{ NATIVE.setReminders(settings.morning, settings.evening, false); }catch(e){} toast("Уведомления выключены"); render(); }
    else { try{ NATIVE.requestNotifications(); }catch(e){} }
  };
  $("nTest").onclick = () => { syncNative(); try{ NATIVE.testNotification(); }catch(e){} };
  $("nTestReview").onclick = () => { syncNative(); try{ NATIVE.testReview(); }catch(e){} };
  $("nReviewToggle").onclick = () => { settings.reviewOn = !settings.reviewOn; persistSettings(); render(); toast(settings.reviewOn ? "Разбор дня включён" : "Разбор дня выключен"); };
  $("nWake").onchange = () => { if($("nWake").value){ settings.wake = $("nWake").value; persistSettings(); render(); toast("Сохранено"); } };
  $("nLunch").onchange = () => { if($("nLunch").value){ settings.lunch = $("nLunch").value; persistSettings(); render(); toast("Сохранено"); } };
  $("nFreq").onclick = e => { const b = e.target.closest("[data-freq]"); if(!b) return; settings.checkins = +b.dataset.freq; persistSettings(); render(); toast("Сохранено"); };
  $("nDiag").onclick = () => { let d = {}; try{ d = JSON.parse(NATIVE.diag()); }catch(e){ $("nDiagOut").textContent = "Эта версия приложения не умеет показывать состояние будильников. Обновите приложение."; return; }
    const on = x => x ? "включено" : "выключено";
    $("nDiagOut").textContent = ["Утренний план: " + (d.morning||"—") + " (" + on(d.enabled) + "), ближайший " + d.nextMorning,
      "Вечерний вопрос: " + (d.evening||"—") + " (" + on(d.enabled) + "), ближайший " + d.nextEvening,
      "Разбор дня: " + (d.review||"—") + " (" + on(d.reviewEnabled) + "), ближайший " + d.nextReview + ". В приложении сейчас: " + reviewTime() + ".",
      "Уведомления Android: " + (d.notif ? "разрешены" : "ЗАПРЕЩЕНЫ"),
      "Экономия батареи: " + (d.batteryUnrestricted ? "без ограничений" : "включена, Android может задерживать напоминания (Настройки → Приложения → Rhythm → Батарея → Без ограничений)")].join("\n");
    if(d.review && d.review !== reviewTime()){ lastReviewSync = ""; syncNative(); $("nDiagOut").textContent += "\nВремя разбора не совпало, отправил заново. Нажмите ещё раз."; } };
  $("nTestCheckin").onclick = () => { try{ NATIVE.testCheckin(); }catch(e){} };
  $("nWatch").onclick = e => { const b = e.target.closest("[data-watch]"); if(!b) return; settings.watchMin = +b.dataset.watch; persistSettings(); render(); toast("Сохранено"); };
  $("nTestWatch").onclick = () => { syncWatch(); try{ NATIVE.testWatch(); toast("Проверил. Если есть повод, придёт уведомление"); }catch(e){} };
  $("nBed").onchange = () => { if($("nBed").value){ setBedtime($("nBed").value); if(postIssues(restOfWeek(), 3)) toast("Время отбоя сохранено. В чате предложил поправить план"); else toast("Время отбоя сохранено"); render(); } };
  const saveTimes = () => { settings.rhythm = false; settings.morning = $("nMorning").value || settings.morning; settings.evening = $("nEvening").value || settings.evening; persistSettings(); if(settings.notify) try{ NATIVE.setReminders(settings.morning, settings.evening, true); }catch(e){} toast("Время сохранено"); };
  $("nMorning").onchange = saveTimes; $("nEvening").onchange = saveTimes;
  try{ NATIVE.refreshHealth(); }catch(e){}
  if(settings.notify) try{ NATIVE.setReminders(settings.morning, settings.evening, true); }catch(e){}
}

/* ---------- install & offline ---------- */
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredPrompt = e; $("installBtn").hidden = false; });
$("installBtn").onclick = async () => { if(!deferredPrompt) return; deferredPrompt.prompt(); try{ await deferredPrompt.userChoice; }catch(e){} deferredPrompt = null; $("installBtn").hidden = true; };
window.addEventListener("appinstalled", () => { $("installBtn").hidden = true; toast("Rhythm установлен"); });
if(!NATIVE && "serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
document.addEventListener("visibilitychange", () => { if(!document.hidden){ dismissed = new Set(); render(); } });

render(); renderBackupNote(); setTimeout(maybeAutoBackup, 3000);
pullNative();
if(getChat().length) { if(!maybeWeeklyReport() && !maybeMissReview() && !maybeForecast() && !maybePreempt() && !maybeHabit() && !morningBrief() && tab === "chat") askRoutine(); render(); }
if(!checkOpen()) scrollChat();
$("chatForm").addEventListener("submit", e => { e.preventDefault(); const v = $("chatInput").value; $("chatInput").value = ""; sendChat(v); });
$("replyBar").addEventListener("click", e => { if(e.target.closest("#replyX")) setReply(null); });
(function swipeReply(){
  const log = $("chatLog"); let el = null, sx = 0, sy = 0, dx = 0, mode = 0;   // mode: 0 ждём, 1 свайп, -1 это прокрутка
  const TH = 56;
  const reset = animate => { if(!el) return; const x = el; x.style.transition = animate ? "transform .18s" : ""; x.style.transform = ""; x.style.setProperty("--p", 0); if(animate) setTimeout(() => { x.style.transition = ""; }, 220); el = null; };
  log.addEventListener("touchstart", e => {
    const m = e.target.closest(".msg"); if(!m || e.touches.length !== 1) return;
    el = m; sx = e.touches[0].clientX; sy = e.touches[0].clientY; dx = 0; mode = 0;
  }, {passive:true});
  log.addEventListener("touchmove", e => {
    if(!el || mode < 0) return;
    const t = e.touches[0], ddx = t.clientX - sx, ddy = t.clientY - sy;
    if(mode === 0){
      if(Math.abs(ddy) > 10 && Math.abs(ddy) >= Math.abs(ddx)){ mode = -1; reset(false); return; }
      if(ddx < -10 && Math.abs(ddx) > Math.abs(ddy) * 1.3) mode = 1; else return;
    }
    dx = Math.max(-96, Math.min(0, ddx)); const k = Math.min(1, -dx / TH);
    el.style.transform = `translateX(${dx}px)`; el.style.setProperty("--p", k);
    if(e.cancelable) e.preventDefault();
  }, {passive:false});
  const end = () => { if(!el) return; const id = el.dataset.mid, hit = mode === 1 && dx <= -TH; reset(true); mode = 0; if(hit && id) setReply(id); };
  log.addEventListener("touchend", end, {passive:true});
  log.addEventListener("touchcancel", () => { reset(true); mode = 0; }, {passive:true});
  // на компьютере — двойной щелчок по сообщению
  log.addEventListener("dblclick", e => { const m = e.target.closest(".msg"); if(m && m.dataset.mid) setReply(m.dataset.mid); });
  // тап по цитате — прыжок к исходному сообщению
  log.addEventListener("click", e => { const q = e.target.closest("[data-rq]"); if(!q) return; const o = log.querySelector(`[data-mid="${CSS.escape(q.dataset.rq)}"]`); if(o){ o.scrollIntoView({block:"center", behavior:"smooth"}); o.classList.add("flash"); setTimeout(() => o.classList.remove("flash"), 1200); } });
})();
$("chatInput").addEventListener("keydown", e => { if(e.key === "Enter" && !e.shiftKey){ e.preventDefault(); $("chatForm").requestSubmit(); } });
// крючок для автотестов (без влияния на работу)
window.__ritmT = {sleepTotal, sleepNeed, learnSleepNeed, logSleepWords, curKey, todayI, getWeek, pushMsg, render, morningBrief, nightFacts, weakDays, maybePreempt, syncWidget, nudgeReview, weekForecast, habitTimes, maybeHabit, compare, personalInsights, reverseNote};
// поправка записи одним касанием: сколько на самом деле
document.addEventListener("click", e => {
  const t = e.target.closest && e.target.closest("[data-ledit]"); if(t){
    const ck = curKey(), ti = todayI(), rec = ((getWeek(ck).days[ti] || {}).log || []).find(x => x.id === t.dataset.ledit); if(!rec) return;
    openSheet(`<h2>${esc(rec.name)}: сколько на самом деле?</h2><div class="chips">${[10,15,20,30,45,60,90,120].map(m => `<button type="button" class="chip ${rec.min === m ? "on" : ""}" data-lmin="${m}" data-lid="${rec.id}">${fmtDur(m)}</button>`).join("")}</div>
      <div class="tools"><button class="btn" data-ldel="${rec.id}">Удалить запись</button></div>`); return;
  }
  const c = e.target.closest && e.target.closest("[data-lmin]"); if(c){
    const ck = curKey(), ti = todayI(), id = c.dataset.lid, m = +c.dataset.lmin;
    mutateQuiet(ck, w => { const day = w.days[ti]; const r = day && (day.log || []).find(x => x.id === id); if(r){ r.min = m; delete r.mg; } });
    closeSheet(); toast("Исправил: " + fmtDur(m)); render();
  }
});
