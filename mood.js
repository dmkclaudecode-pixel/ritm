// Rhythm · модуль настроения: по тексту понимает эмоцию, силу и «заряд» (спокойно ↔ взвинчено), учитывает отрицания, усилители,
// смайлы, знаки, КАПС и тянутые буквы, а также копит историю, чтобы видеть тренд по дням. Без интернета и без ИИ-сервисов.
(function(root){
"use strict";
const R = root.RITM = root.RITM || {};

// эмоция → {v: приятность -1..1, a: заряд -1..1, w: слова (начала слов; «$» на конце — слово целиком)}
const EMO = {
  joy:      {v:.8,  a:.5,  w:"ура$ рад$ рада$ рады$ радуюсь радост счастлив счастье кайф кайфую кайфово класс$ классно классный супер отлично отличн шикарн прекрасн замечательн круто крутой крутая офигенн огонь$ огненн в восторге восторг доволен довольна довольны ликую обожаю нравится приятн весел смешн ха-ха$ ахах хахах ржу ржач лол$ позитив радует порадовал порадовала удалось получилось смог смогла справился справилась победа победил молодец$ горжусь прилив бодр$ бодрый бодрая полон$ полна$ заряжен вдохновл летаю окрыл удача повезло везёт везет чудесн потрясающ бомба$ топ$ кайфанул кайфанула"},
  love:     {v:.9,  a:.3,  w:"люблю любимый любимая любимые влюбил влюблён влюблен обожаю скучаю нежн тепло сердечк мило милый милая обнимаю обнял обняла тепл"},
  calm:     {v:.5,  a:-.6, w:"спокойно спокоен спокойна умиротвор расслаб тихо уютно уют$ мирно гармон безмятежн комфортно отдыхаю отдохнул отдохнула выдохнул выдохнула полегчало легко$ неспешн размерен медитир"},
  excited:  {v:.6,  a:.9,  w:"не терпится предвкуш волную взволнован взволнована ждать не могу горю азарт драйв адреналин заряжаюсь прёт прет$ погнали го$ вперёд вперед нетерпени ажиотаж"},
  tired:    {v:-.3, a:-.8, w:"устал устала усталост вымотал вымоталась вымотан выжат разбит разбитый разбитая нет сил без сил сонный сонная сонно засыпаю засыпает не выспал не выспалась недосып валюсь выдохся выдохлась обессил истощ сил нет еле ползу"},
  bored:    {v:-.3, a:-.5, w:"скучно скука скучаю без нечем заняться тоскливо уныло унылый однообразн рутина надоело надоел надоела опостылел монотонн тягомотина"},
  sad:      {v:-.7, a:-.4, w:"грустно грущу грустн печаль печально тоск тоскую плохо$ плохое плохой хандр уныни унылое подавлен подавлена расстроен расстроена расстроился расстроилась плачу плакал плакала слёз слез разочаров обидно обида обидели одиноко одиночеств пусто опустош безнадёж безнадеж тяжело$ тяжко нет настроения настроение на нуле депресс апати не хочется ничего ничего не хочется горько тошно паршиво хреново ужасно себя скверно"},
  anxious:  {v:-.6, a:.6,  w:"тревож тревога волнуюсь волнение переживаю переживани беспоко нервнич нервный нервная нервы мандраж боюсь страшно страх опасаюсь паник напряж не по себе места не нахожу накрыло трясёт трясет мандраж дергаюсь дёргаюсь"},
  stressed: {v:-.6, a:.7,  w:"стресс завал запара запарился запарилась дедлайн горят сроки не успеваю загнан зашиваюсь выгор перегруз перегружен задолбал задолбался задолбалась замучил замучилась пашу как нет времени аврал"},
  anger:    {v:-.8, a:.9,  w:"злой злая злюсь злит бесит бесят бешен раздраж взбесил достал достали ненавижу ярост гнев в ярости возмущ кипит кипяч выбешивает психую психанул психанула сволоч идиот придурок тупиц козел козёл"},
  disgust:  {v:-.6, a:.2,  w:"противно отврат мерзко тошнит гадость фу$ брезг омерзит"},
  fear:     {v:-.7, a:.8,  w:"страшно ужас$ жутко испуган испугал испугалась боюсь пугает кошмар$ в панике"},
  surprised:{v:.2,  a:.7,  w:"ого$ ничего себе вау$ офигеть обалдеть обалдел обалдела не ожидал не ожидала шок$ в шоке удивил удивлён удивлена неожиданно"},
  proud:    {v:.8,  a:.4,  w:"горжусь собой гордость молодец я справился наконец закрыл цель выполнил план перевыполнил выполнила план рекорд личный рекорд"},
  guilty:   {v:-.5, a:.1,  w:"виноват виновата стыдно стыд сожалею жалею что подвёл подвела подвел подвела сорвался сорвалась облажался облажалась проср косяк$ накосячил накосячила"},
  motivated:{v:.6,  a:.6,  w:"мотивирован мотивация есть настрой настроен на готов к решил начать хочу начать буду заниматься возьмусь возьмусь за сегодня точно с понедельника начну"},
  lazy:     {v:-.2, a:-.6, w:"лень$ ленюсь лениво не могу собраться не хочу ничего прокрастин откладываю не в настроении мотивации нет"},
  pain:     {v:-.6, a:.3,  w:"болит болят болезн ноет ноют мигрень тошнит ломит ломота температур заболел заболела простыл простыла кашляю насморк"}
};
const INTENS = /^(очень|сильно|пипец|капец|жутко|безумно|дико|ужасно|максимально|крайне|невероятно|чертовски|адски|охренеть|реально|супер|ультра|так|такой|такая|такое|совсем|вообще|абсолютно|полностью|просто|прям|прямо|аж|до чёртиков|до жути)$/;
const DIMIN = /^(немного|чуть|чуть-чуть|слегка|слабо|как-то|вроде|типа|несильно|малость|немножко|капельку|в целом|более-менее|терпимо|средне)$/;
const NEG = /^(не|нет|ни|без|никак|никогда|нифига|ничуть|вовсе)$/;
const POSNEG = {joy:"sad", love:"sad", calm:"anxious", excited:"bored", motivated:"lazy", proud:"guilty"};          // «не рад» → грусть
const NEGNEG = {sad:"calm", anxious:"calm", tired:"motivated", bored:"joy", lazy:"motivated", pain:"calm", stressed:"calm", anger:"calm"}; // «не грустно» → спокойнее
const EMOJI = [
  [/[😀😃😄😁😆😂🤣😊😇🙂😉😍🥰😘😎🤩🥳👍🙌💪🔥✨🎉]/gu, "joy", 1], [/[❤💕💖💗💓😻]/gu, "love", 1], [/[😢😭😞😔😟🥺💔☹🙁]/gu, "sad", 1.2], [/[😡😠🤬👿💢]/gu, "anger", 1.2],
  [/[😴🥱😪]/gu, "tired", 1], [/[😰😨😱😬]/gu, "anxious", 1], [/[🤢🤮]/gu, "disgust", 1], [/[🙄😒]/gu, "bored", 1], [/[😅]/gu, "stressed", .5], [/[🤒🤕🤧]/gu, "pain", 1], [/[😮😲🤯]/gu, "surprised", 1]
];
const ALL = Object.entries(EMO).map(([k, e]) => ({k, v:e.v, a:e.a, ws: e.w.split(" ").map(x => x.replace(/ /g, " ")).filter(Boolean)}));
const norm = s => " " + String(s).toLowerCase().replace(/ё/g, "е").replace(/ /g, " ").replace(/([а-яa-z])\1{2,}/g, "$1$1") + " ";
function hits(text){
  const out = [], s = norm(text);
  for(const e of ALL) for(const w of e.ws){
    const ww = w.replace(/ё/g, "е"), exact = ww.endsWith("$"), core = exact ? ww.slice(0, -1) : ww;
    const re = new RegExp("(?<![а-яa-z])" + core.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + (exact ? "(?![а-яa-z])" : ""), "g");
    let m; while((m = re.exec(s))) out.push({k:e.k, at:m.index, len:core.length, w:ww});
  }
  // самые длинные совпадения важнее: убираем те, что целиком внутри другого
  return out.filter(h => !out.some(o => o !== h && o.at <= h.at && o.at + o.len >= h.at + h.len && (o.len > h.len || (o.len === h.len && o.k < h.k)))).sort((a, b) => a.at - b.at);
}
// тянутые буквы, КАПС, знаки: усиливают эмоцию
function style(raw){
  const t = String(raw), letters = t.replace(/[^А-Яа-яA-Za-z]/g, ""), upper = t.replace(/[^А-ЯA-Z]/g, "");
  const caps = letters.length >= 4 && upper.length / letters.length > 0.7 ? 1 : 0;
  const excl = Math.min(3, (t.match(/!/g) || []).length), stretch = /([а-яa-z])\1{2,}/i.test(t) ? 1 : 0, dots = /\.{3,}|…/.test(t) ? 1 : 0;
  const smileP = (t.match(/\){2,}|:\)|:-\)|\^\^|=\)/g) || []).length, smileN = (t.match(/\({2,}|:\(|:-\(|;\(|=\(/g) || []).length;
  return {caps, excl, stretch, dots, smileP, smileN, boost: 1 + 0.25 * caps + 0.15 * Math.min(excl, 2) + 0.2 * stretch};
}
function analyze(text){
  const raw = String(text || ""), s = norm(raw), st = style(raw), toks = s.trim().split(/\s+/);
  const score = {}; const add = (k, w) => { score[k] = (score[k] || 0) + w; };
  const signals = [];
  for(const h of hits(raw)){
    // слова до совпадения: усилители, ослабители, отрицания (в пределах трёх слов)
    const before = s.slice(0, h.at).split(/[,.;:!?\u2014]/).pop().trim().split(/\s+/).slice(-3); let mult = 1, neg = false;
    for(const b of before){ if(INTENS.test(b)) mult *= 1.5; else if(DIMIN.test(b)) mult *= 0.6; else if(NEG.test(b)) neg = !neg; }
    let k = h.k, w = mult;
    if(neg){ const flip = POSNEG[k] || NEGNEG[k]; if(flip){ k = flip; w *= .7; } else { w *= .3; } }
    // «но …» после противопоставления важнее, чем то, что было до него
    const afterBut = /(?:^| )(но|а вот|зато|однако)(?: |$)/.test(s.slice(0, h.at)); if(afterBut) w *= 1.4;
    add(k, w); signals.push({k, w:+w.toFixed(2), at:h.w + (neg ? " (с отрицанием)" : "")});
  }
  for(const [re, k, w] of EMOJI){ const n = (raw.match(re) || []).length; if(n){ add(k, w * Math.min(n, 3) * .8); signals.push({k, w:w, at:"смайл"}); } }
  if(st.smileP) add("joy", .5 * Math.min(st.smileP, 2)); if(st.smileN) add("sad", .6 * Math.min(st.smileN, 2));
  // КАПС и «!!!» усиливают то, что нашли; сами по себе — лёгкое возбуждение
  const total0 = Object.values(score).reduce((a, b) => a + b, 0);
  if(total0 > 0) for(const k of Object.keys(score)) score[k] *= st.boost;
  const entries = Object.entries(score).sort((a, b) => b[1] - a[1]), total = entries.reduce((a, [, w]) => a + w, 0);
  if(!entries.length) return {dominant:"neutral", emotions:{}, valence:0, arousal: st.excl ? .2 : 0, intensity:0, label:"neutral", signals, style:st, needs:[]};
  let v = 0, a = 0; const emotions = {};
  for(const [k, w] of entries){ const e = EMO[k]; v += e.v * w; a += e.a * w; emotions[k] = +(w / total).toFixed(2); }
  v /= total; a /= total;
  const intensity = Math.min(1, total / 2.5);
  const dominant = entries[0][0], second = entries[1] && entries[1][1] / total > .3 ? entries[1][0] : null;
  const label = v > .25 ? "positive" : v < -.25 ? "negative" : "mixed";
  const needs = [];
  if(["sad", "anxious", "stressed", "anger", "fear", "guilty"].includes(dominant)) needs.push("support");
  if(["tired", "pain"].includes(dominant)) needs.push("rest");
  if(["joy", "proud", "excited", "love"].includes(dominant)) needs.push("celebrate");
  if(["bored", "lazy"].includes(dominant)) needs.push("activate");
  if(["motivated"].includes(dominant)) needs.push("channel");
  return {dominant, second, emotions, valence:+v.toFixed(2), arousal:+a.toFixed(2), intensity:+intensity.toFixed(2), label, signals, style:st, needs};
}

/* ---- история настроения: тренд по дням и ровная линия «как обычно» ---- */
const KEY = "ritm:mood";
const load = () => { try{ return JSON.parse(localStorage.getItem(KEY) || "[]"); }catch(e){ return []; } };
function track(res, at){
  if(!res || res.dominant === "neutral" || res.intensity < .15) return null;
  const h = load(); h.push({t:at || Date.now(), v:res.valence, a:res.arousal, e:res.dominant, i:res.intensity});
  while(h.length > 400) h.shift();
  try{ localStorage.setItem(KEY, JSON.stringify(h)); }catch(e){}
  return h.length;
}
// сводка: настроение сегодня, обычный уровень за 2 недели, тренд и затяжной спад
function summary(now){
  const h = load(), t0 = now || Date.now(), day = 86400000, avg = a => a.length ? a.reduce((x, y) => x + y.v * (.5 + y.i), 0) / a.reduce((x, y) => x + (.5 + y.i), 0) : null;
  const today = h.filter(x => t0 - x.t < day), week = h.filter(x => t0 - x.t < 7 * day), base = h.filter(x => t0 - x.t < 14 * day && t0 - x.t >= 7 * day);
  const perDay = []; for(let d = 0; d < 7; d++){ const xs = h.filter(x => t0 - x.t >= d * day && t0 - x.t < (d + 1) * day); perDay.push(xs.length ? avg(xs) : null); }
  const lowDays = perDay.slice(0, 3).filter(v => v != null && v < -.15).length, known = perDay.slice(0, 3).filter(v => v != null).length;
  const w = avg(week), b = avg(base);
  return {today: avg(today), week: w, base: b, trend: w != null && b != null ? +(w - b).toFixed(2) : null, slump: known >= 2 && lowDays >= 2, n: h.length};
}
R.mood = {analyze, track, summary, hits, style, EMO};
if(typeof module !== "undefined" && module.exports) module.exports = R.mood;
})(typeof window !== "undefined" ? window : globalThis);
