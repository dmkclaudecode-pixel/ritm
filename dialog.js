// Rhythm · диалог: память беседы (контекст), конструктор фраз и уточняющие вопросы. Чистая логика, без интернета.
//  Context  — последние реплики, темы, настроение; раскрывает «а вчера?», «ещё», «это» через прошлую тему.
//  Compose  — собирает фразу из смысловой рамки (frame): акт + настроение + тема; склоняет, не повторяется, подстраивает тон.
//  Clarify  — строит вопрос из неоднозначности («это про X или про Y?»).
(function(root){
"use strict";
const R = root.RITM = root.RITM || {};

/* ---------- склонение и числа ---------- */
const plural = (n, f) => { n = Math.abs(n) % 100; const d = n % 10; return n > 10 && n < 20 ? f[2] : d > 1 && d < 5 ? f[1] : d === 1 ? f[0] : f[2]; };
const MIN = ["минута", "минуты", "минут"];
const dur = m => { m = Math.round(m); const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h} ч ${r} ${plural(r, MIN)}` : `${h} ${plural(h, ["час", "часа", "часов"])}`) : `${m} ${plural(m, MIN)}`; };
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const list = a => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " и " + a[a.length - 1];

/* ---------- контекст ---------- */
function Context(max){
  this.max = max || 12; this.turns = []; this.said = [];      // said — что бот уже говорил (чтобы не повторяться)
}
Context.prototype.push = function(role, text, meta){
  this.turns.push({role, text: String(text || ""), meta: meta || {}, t: Date.now()});
  while(this.turns.length > this.max) this.turns.shift();
};
Context.prototype.last = function(role, pred){
  for(let i = this.turns.length - 1; i >= 0; i--){ const x = this.turns[i]; if((!role || x.role === role) && (!pred || pred(x))) return x; }
  return null;
};
Context.prototype.topic = function(){ const x = this.last("user", t => t.meta.topic); return x ? x.meta.topic : null; };
// настроение беседы: взвешенное по свежести среднее последних реплик пользователя
Context.prototype.mood = function(){
  const us = this.turns.filter(t => t.role === "user" && t.meta.mood && t.meta.mood.intensity > 0);
  if(!us.length) return {valence: 0, arousal: 0, trend: 0, n: 0};
  let v = 0, a = 0, w = 0; us.forEach((t, i) => { const k = (i + 1) * (.5 + t.meta.mood.intensity); v += t.meta.mood.valence * k; a += t.meta.mood.arousal * k; w += k; });
  const first = us.slice(0, Math.ceil(us.length / 2)), second = us.slice(Math.ceil(us.length / 2));
  const m = x => x.length ? x.reduce((s, t) => s + t.meta.mood.valence, 0) / x.length : 0;
  return {valence: +(v / w).toFixed(2), arousal: +(a / w).toFixed(2), trend: second.length ? +(m(second) - m(first)).toFixed(2) : 0, n: us.length};
};
// короткие реплики-продолжения: «а вчера?», «ещё», «и потом?», «почему?»
const ELLIPSIS = /^ *(а |и |ну |так )?(вчера|сегодня|завтра|позавчера|на неделе|за неделю|за месяц|ещё|еще|потом|почему|зачем|а что|а как|а если)( .{0,20})?\?? *$/i;
Context.prototype.resolve = function(text){
  const t = String(text || "").trim(), prev = this.last("user", x => x.meta.intent);
  if(!prev || !ELLIPSIS.test(t)) return {text: t, resolved: false};
  const m = t.toLowerCase().match(/вчера|позавчера|сегодня|завтра|за неделю|на неделе|за месяц/);
  return {text: t, resolved: true, intent: prev.meta.intent, topic: prev.meta.topic || null, when: m ? m[0] : null, why: /почему|зачем/.test(t.toLowerCase())};
};
Context.prototype.fresh = function(phrase){ if(this.said.includes(phrase)) return false; this.said.push(phrase); if(this.said.length > 40) this.said.shift(); return true; };

/* ---------- конструктор фраз ---------- */
// шаблоны по акту и «погоде» беседы: [v<0 | v≥0] × [тихо | бодро]; {name} {topic} {n} подставляются
const T = {
  empathize: {
    low:  ["Звучит тяжело. Я рядом, можно просто выговориться.", "Понимаю, бывает такое. Хочешь расскажу, что в плане можно сегодня отпустить?", "Это правда непросто. Давай сделаем сегодня минимум, остальное подождёт."],
    high: ["Слышу, что накипело. Давай по порядку: что именно сильнее всего?", "Понимаю, это выбивает. Сначала выдох: четыре счёта вдох, шесть выдох. Потом разберёмся.", "Злость или тревога — тело тоже просит выхода. Может, пройдёмся десять минут?"]
  },
  rest: {
    low:  ["Похоже, сил почти нет. Сегодня лучше мягко: вода, еда, отдых.", "Усталость сигнал, а не слабость. Облегчим сегодняшний план?", "Тогда без подвигов: лёгкий день и ранний сон."],
    high: ["Устал, но голова гудит. Это когда помогает пятиминутная прогулка без телефона.", "Мотор молотит, а сил нет — знакомо. Попробуем перезагрузку: вода и пара минут тишины."]
  },
  celebrate: {
    low:  ["Приятно слышать. Спокойная радость — самая устойчивая.", "Хорошо, что так. Запомним, что сегодня сработало."],
    high: ["Класс! Вот это заряд. Куда направим энергию?", "Отлично! Держи темп, а я помогу не перегореть.", "Ура! Такое надо отмечать. Что дальше по плану?"]
  },
  activate: {
    low:  ["Скука подсказывает: пора сменить обстановку. Что-нибудь маленькое?", "Давай придумаем десятиминутное дело: размяться, написать другу, выйти на воздух."],
    high: ["Энергия есть, цели нет? Выбери одно дело из плана — и вперёд.", "Лень пока побеждает, но десять минут она терпит. Начнём с самого лёгкого?"]
  },
  channel: {
    low:  ["Отличный настрой. Выберем одно главное дело и сделаем его первым.", "Хорошо, что хочется. С чего начнём?"],
    high: ["Огонь! Пока горит, закроем самое важное.", "Вот это настрой. Что берём первым делом?"]
  },
  neutral: {
    low:  ["Понял. Расскажешь подробнее?", "Слушаю. Что ещё на душе?", "Ага. А как день в целом?"],
    high: ["Принял. Что дальше?", "Понял, давай дальше.", "Ясно. Продолжай, я здесь."]
  },
  followup_sad: ["Хочешь, расскажи, что случилось?", "Что сегодня было самым тяжёлым?", "Что могло бы стать хоть чуть легче прямо сейчас?"],
  followup_tired: ["Как спал последние дни?", "Это после нагрузки или просто день такой?"],
  followup_joy: ["Из-за чего такое настроение?", "Что сегодня удалось лучше всего?"]
};
const ACT_OF = {support: "empathize", rest: "rest", celebrate: "celebrate", activate: "activate", channel: "channel"};

function pickFresh(ctx, arr, rnd){
  const pool = arr.filter(p => !ctx || !ctx.said.includes(p)), src = pool.length ? pool : arr;
  const p = src[Math.floor((rnd ? rnd() : Math.random()) * src.length)];
  if(ctx) ctx.fresh(p);
  return p;
}
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] != null ? v[k] : "");

// frame: {act?, mood (результат R.mood.analyze), topic?, name?, n?} → строка
function compose(frame, ctx, rnd){
  const m = frame.mood || {}, act = frame.act || ACT_OF[(m.needs || [])[0]] || "neutral";
  const tone = (m.arousal || 0) > .25 ? "high" : "low", set = T[act] || T.neutral;
  let out = pickFresh(ctx, set[tone] || set.low, rnd);
  // если беседа уже была грустной, а сейчас лучше — отмечаем перемену
  if(ctx){ const cm = ctx.mood(); if(cm.n >= 3 && cm.trend > .5 && (m.valence || 0) > 0) out = "Заметно, что настроение поднимается. " + out; }
  // вторым предложением — мягкий вопрос, если эмоция сильная и ещё не спрашивали
  const f = m.dominant === "sad" || m.dominant === "anxious" ? T.followup_sad : m.dominant === "tired" ? T.followup_tired : m.dominant === "joy" ? T.followup_joy : null;
  if(f && (m.intensity || 0) >= .5 && (!ctx || !(ctx.last("bot") || {meta: {}}).meta.asked)) out += " " + pickFresh(ctx, f, rnd);
  return fill(out, frame);
}

/* ---------- уточняющий вопрос ---------- */
// guesses: [{name, p}], from engine.classify или онтологии → «Это про X или про Y?» + кнопки
function clarify(guesses, topic){
  const g = (guesses || []).filter(x => x && x.name).slice(0, 3);
  if(!g.length) return {text: topic ? `Что именно ты имеешь в виду про «${topic}»?` : "Не уверен, что понял. Что это было?", options: []};
  if(g.length === 1) return {text: `Это ${g[0].name.toLowerCase()}?`, options: [g[0].name]};
  const names = g.map(x => x.name.toLowerCase());
  return {text: (topic ? `«${topic}» — это ` : "Это ") + names.slice(0, -1).join(", ") + " или " + names[names.length - 1] + "?", options: g.map(x => x.name)};
}

R.dialog = {Context, compose, clarify, plural, dur, cap, list, T};
if(typeof module !== "undefined" && module.exports) module.exports = R.dialog;
})(typeof window !== "undefined" ? window : globalThis);
