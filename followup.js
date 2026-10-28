// Rhythm · ответ на ответ: бот спросил — человек коротко ответил. Распознаём тип вопроса бота и тип ответа,
// собираем реакцию по теме, числу и настроению. Чистые функции, без DOM и хранилища.
(function(root){
"use strict";
const R = root.RITM = root.RITM || {};
const N = s => " " + String(s).toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9?!. -]/g, " ").replace(/\s+/g, " ").trim() + " ";

/* ---------- тип вопроса бота ---------- */
// берём последнее предложение с «?»
function lastQuestion(text){ const m = String(text || "").match(/[^.!?]*\?\s*$/); return m ? m[0].trim() : ""; }
function qKind(botText){
  const q = N(lastQuestion(botText)); if(q.trim().length < 2) return null;
  if(/ (поставить|поставл|добав|записа|составим|убрат|поменя|включит|напомин|подсказат|помочь|показат|предложит|договорились|подойд[еи]т|согласен|получится|попробуем|хочешь,? (чтобы|я)|может,? )/.test(q)) return "offer";
  if(/ или /.test(q)) return "choice";
  if(/ (сколько|давно|как долго|во сколько|на сколько|когда|как часто|уже давно|насколько) /.test(q)) return "amount";
  if(/ (как ты|как у тебя|как себя|как самочувств|как ощущен|как день|как прошел|как спал|как настроен|как всем|как сейчас|как дела|как оно|как тебе|как ты сам) /.test(q)) return "feeling";
  if(/ (что|почему|из за чего|зачем|где|кто|куда|чем|какой|какая|какие|какое|с кем|о чем|про что|что именно) /.test(q)) return "what";
  if(/ (бегал|был|были|есть|ты |это |уже |раньше|пробовал|делал|ел|пил|спал|выпил|ходил)/.test(q)) return "yesno";
  return "yesno";
}

/* ---------- тип ответа ---------- */
const YES = /^ *(да|ага|угу|конечно|давай|ладно|хорошо|ок|окей|можно|пожалуй|наверное|согласен|согласна|поставь|добавь|да давай|давай|идет|пойдет|подойдет|супер|отлично|вполне|естественно|разумеется|точно) /;
const NO = /^ *(нет|неа|не надо|не хочу|не стоит|пока нет|ни разу|не очень|не особо|не сейчас|не буду|потом|позже) /;
function answerKind(text){ const s = N(text); if(NO.test(s)) return "no"; if(YES.test(s)) return "yes"; return "content"; }

const NUMW = {пару: 2, пара: 2, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9, десять: 10, одиннадцать: 11, двенадцать: 12, несколько: 3, полтора: 1.5, полчаса: .5, сутки: 24, неделю: 168, месяц: 720};
// число часов из «пять часов», «2 дня», «с утра», «неделю»; null, если не нашли
function hours(text){
  const s = N(text); let n = null;
  const d = s.match(/(\d+(?:[.,]\d+)?)/); if(d) n = parseFloat(d[1].replace(",", "."));
  if(n == null) for(const w of s.trim().split(" ")) if(NUMW[w] != null){ n = NUMW[w]; if(/^(полчаса|сутки|неделю|месяц)$/.test(w)) return n; break; }
  if(/ недел/.test(s)) return (n == null ? 1 : n) * 168;
  if(/ месяц/.test(s)) return (n == null ? 1 : n) * 720;
  if(/ (год|года|лет) /.test(s)) return (n == null ? 1 : n) * 8760;
  if(/ (дн|сут)/.test(s)) return (n == null ? 1 : n) * 24;
  if(/ мин/.test(s)) return (n == null ? 0 : n) / 60;
  if(/ час/.test(s)) return n == null ? 1 : n;
  if(n != null) return n;
  return null;
}
const sleepHours = h => h > 24 ? null : h;

/* ---------- реакции ---------- */
const OK = ["Хорошо, договорились.", "Отлично, так и сделаем.", "Принято.", "Договорились."];
const DECLINE = ["Ладно, без этого.", "Хорошо, как скажешь.", "Понял, не будем."];
const EMP = ["Понимаю, это непросто.", "Да, такое выматывает.", "Звучит тяжело.", "Жаль, что так вышло."];
const POS = ["Здорово!", "Отлично!", "Рад за тебя.", "Приятно слышать."];
const NEUT = ["Понятно, спасибо, что рассказал.", "Ясно.", "Понял тебя.", "Принял."];
const ADV = {rest: "Сегодня без подвигов: вода, еда и ранний отбой.", support: "Попробуй выдох подлиннее: вдох на четыре счёта, выдох на шесть.", activate: "Выбери самое лёгкое дело и дай себе десять минут.", channel: "Возьми одну главную задачу и сделай её первой."};

function fresh(arr, ctx, rnd){
  const pool = ctx ? arr.filter(x => !ctx.said.includes(x)) : arr, src = pool.length ? pool : arr;
  const v = src[Math.floor((rnd ? rnd() : Math.random()) * src.length)]; if(ctx) ctx.fresh(v); return v;
}
function askStreak(ctx){ let n = 0; if(!ctx) return 0; for(let i = ctx.turns.length - 1; i >= 0; i--){ const t = ctx.turns[i]; if(t.role !== "bot") continue; if(t.meta.asked) n++; else break; } return n; }
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;

// choice: «чай или кофе?» → опции
function options(botText){
  const q = lastQuestion(botText).replace(/\?$/, ""), m = q.split(/ или /i); if(m.length < 2) return [];
  const tail = m.map((x, i) => i === m.length - 1 ? x : x.split(/[,:—]| - /).pop()).map(x => x.trim().replace(/^(это|лучше|тебе|хочешь|выбирай|что ближе|что)\s+/i, "").replace(/[()]/g, "").trim());
  const first = m[0].split(/[,:—]| - /).pop().trim().replace(/^(это|лучше|тебе|хочешь|выбирай|что ближе|что)\s+/i, "");
  tail[0] = first; return tail.filter(x => x && x.split(" ").length <= 4);
}
const stem = w => w.slice(0, Math.max(3, w.length - 2));
function pickOption(opts, ansText){
  const aw = N(ansText).trim().split(" ").filter(w => w.length > 2).map(stem);
  let best = null, score = 0;
  opts.forEach((o, i) => { const sc = N(o).trim().split(" ").filter(w => w.length > 2).filter(w => aw.includes(stem(w))).length; if(sc > score){ score = sc; best = o; } });
  if(best) return best;
  const s = N(ansText); if(/ (перв|первое|первый) /.test(s)) return opts[0]; if(/ (втор|второе|второй) /.test(s)) return opts[1];
  return null;
}

// o: {text, ctx, mood, topic, tp (тема из talk.TOPICS), rnd, mayAsk}
// → {text, act, asked, intent} или null (не наш случай)
function react0(o){
  const ctx = o.ctx, lb = ctx && ctx.last("bot"); if(!o.span && (!lb || !lb.meta.asked)) return null;
  const text = o.text || "", words = text.trim().split(/\s+/).filter(Boolean).length;
  if(words > 10 || /\?/.test(text)) return null;
  const kind = o.span ? "amount" : qKind(lb.text); if(!kind) return null;
  const ak = answerKind(text), m = o.mood || {}, topic = o.topic, rnd = o.rnd;
  const neg = (m.valence || 0) < -.15, pos = (m.valence || 0) > .15, strongNeg = neg && (m.intensity || 0) >= .55;
  const canAsk = askStreak(ctx) < 1 && o.tp && o.tp.q;
  const ask = () => canAsk ? " " + fresh(o.tp.q, ctx, rnd) : "";
  const done = (act, t, intent, asked) => ({text: t, act, asked: !!asked, intent: intent || null, kind});
  if(kind === "offer"){
    if(ak === "yes") return done("ack", fresh(OK, ctx, rnd), "accept");
    if(ak === "no") return done("ack", fresh(DECLINE, ctx, rnd), "decline");
    return null;
  }
  if(kind === "choice"){
    const opts = options(lb.text), p = opts.length ? pickOption(opts, text) : null;
    if(p){
      const pm = R.mood && R.mood.analyze ? R.mood.analyze(p) : {}, pneg = (pm.valence || 0) < -.15, ppos = (pm.valence || 0) > .15, need = (pm.needs || [])[0];
      const t = pneg ? fresh(EMP, ctx, rnd) + (need && ADV[need] ? " " + ADV[need] : "") : ppos ? fresh(POS, ctx, rnd) : `Понятно, ${p.toLowerCase()}.`;
      return done(pneg ? "mood" : "ack", t + (pneg ? "" : ask()), "choice:" + p, !pneg && !!ask());
    }
    if(ak === "no") return done("ack", fresh(DECLINE, ctx, rnd), "decline");
    return null;
  }
  if(kind === "amount"){
    const h = hours(text); if(h == null) return null;
    if(o.span && (neg || topic === "work" || topic === "study")) return done("mood", (h >= 168 ? "Столько времени в таком режиме — это многовато." : "Понимаю, это уже не первый день.") + ask(), "span", !!ask());
    if(topic === "sleep" || lb && /спал|спишь|сон|поспа|спать/.test(N(lb.text))){
      const s = sleepHours(h); if(s == null) return null;
      const t = s <= 5 ? "Это мало. Сегодня лучше лечь пораньше." : s < 7 ? "Маловато, организму нужно больше." : s <= 9 ? "Нормально, этого хватает." : "Много. Бывает после усталости или перегруза.";
      return done("event", t, "sleep:" + s);
    }
    if(topic === "health" || lb && /болит|болеешь|начал/.test(N(lb.text))){
      const t = h >= 72 ? "Уже не первый день — если не проходит, лучше показаться врачу." : h >= 24 ? "Дай себе покой и тепло, посмотрим, как будет завтра." : "Только началось. Отдохни, попей воды и понаблюдай.";
      return done("advice", t, "health:" + h);
    }
    if(neg || ["sad", "tired", "anxious", "stressed"].includes(m.dominant)){
      if(h >= 336) return done("mood", "Это уже долго. Про такое полезно поговорить с врачом или психологом, а я рядом, чтобы поддержать.", "long");
      return done("mood", fresh(EMP, ctx, rnd) + ask(), "short", !!ask());
    }
    const t = h >= 720 ? "Месяц — приличный срок." : h >= 24 ? "Понятно, это не один день." : "Понял.";
    return done("event", t + ask(), "amount", !!ask());
  }
  if(kind === "feeling" || kind === "what"){
    if(strongNeg && kind === "feeling") return null;
    const need = (m.needs || [])[0], short = words <= 5 && ak === "content" ? N(text).trim() : null;
    let out;
    if(ak === "no") out = fresh(["Ладно.", "Понял.", "Хорошо, как скажешь."], ctx, rnd);
    else if(ak === "yes") out = fresh(["Понятно.", "Хорошо.", "Ясно."], ctx, rnd);
    else if(neg) out = fresh(EMP, ctx, rnd) + (need && ADV[need] && (m.intensity || 0) >= .3 ? " " + ADV[need] : ask());
    else if(pos) out = fresh(POS, ctx, rnd) + ask();
    else out = fresh(NEUT, ctx, rnd) + ask();
    return done(neg ? "mood" : "ack", out, "answer", /\?\s*$/.test(out));
  }
  if(kind === "yesno"){
    if(ak === "yes") return done("ack", fresh(["Понятно.", "Хорошо.", "Ясно, понял."], ctx, rnd) + ask(), "yes", !!ask());
    if(ak === "no") return done("ack", fresh(["Понятно.", "Ясно.", "Хорошо, учту."], ctx, rnd) + ask(), "no", !!ask());
    return null;
  }
  return null;
}

// универсальная реакция на содержательный короткий ответ после вопроса бота
function generic(o){
  const ctx = o.ctx, lb = ctx && ctx.last("bot"); if(!lb || !lb.meta.asked) return null;   // срок без вопроса бота разбирает react0
  const text = o.text || "", words = text.trim().split(/\s+/).filter(Boolean).length; if(words > 10 || /\?/.test(text)) return null;
  const ak = answerKind(text), m = o.mood || {}, rnd = o.rnd, kind = qKind(lb.text) || "yesno";
  if(/безопасност/.test(N(lb.text)) && ak !== "yes") return {text: "Спасибо, что ответил. Если есть мысли причинить себе вред, позвони на 112 или на линию доверия 8-800-2000-122 (бесплатно). Я рядом, можешь написать, что происходит.", act: "mood", asked: false, intent: "safety", kind};
  if(/безопасност/.test(N(lb.text))) return {text: "Хорошо, что ты в безопасности. Я рядом: расскажи, что тебя сейчас так давит.", act: "mood", asked: false, intent: "safety", kind};
  const neg = (m.valence || 0) < -.15, pos = (m.valence || 0) > .15, need = (m.needs || [])[0];
  const canAsk = askStreak(ctx) < 1 && o.tp && o.tp.q, ask = canAsk ? " " + fresh(o.tp.q, ctx, rnd) : "";
  const h = hours(text); let out;
  if(ak === "no") out = fresh(["Понятно.", "Ясно.", "Хорошо, учту."], ctx, rnd) + ask;
  else if(ak === "yes") out = fresh(["Понятно.", "Хорошо.", "Ясно."], ctx, rnd) + ask;
  else if(neg) out = fresh(EMP, ctx, rnd) + (need && ADV[need] && (m.intensity || 0) >= .3 ? " " + ADV[need] : ask);
  else if(pos) out = fresh(POS, ctx, rnd) + ask;
  else if(h != null) out = (h >= 720 ? "Месяц — приличный срок." : h >= 168 ? "Это не один день." : "Понял.") + ask;
  else out = fresh(NEUT, ctx, rnd) + ask;
  return {text: out, act: neg ? "mood" : "ack", asked: /\?\s*$/.test(out), intent: "answer", kind};
}
const react = o => react0(o) || generic(o);
const reactSpecific = react0;

R.followup = {qKind, answerKind, hours, options, pickOption, lastQuestion, react, reactSpecific, generic};
if(typeof module !== "undefined" && module.exports) module.exports = R.followup;
})(typeof window !== "undefined" ? window : globalThis);
