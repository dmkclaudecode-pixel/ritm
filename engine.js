// Rhythm · движок смысла: стемминг + статистическая модель по словарю занятий (без интернета и без ИИ-сервисов).
// Правила в parser.js дают точный ответ, когда фраза знакома. Этот движок — запасной слой для незнакомых слов и оборотов:
// он учится на всех алиасах каталога (тысячи фраз) и угадывает тип по основам слов и кускам слов. Возвращает тип, уверенность и запасной вариант.
(function(root){
"use strict";
const R = root.RITM = root.RITM || {};

/* ---- стеммер русского языка (Snowball, укороченный) ---- */
const VOW = "аеиоуыэюя", PERF = /(ив|ивши|ившись|ыв|ывши|ывшись)$/, ADJ = /(ее|ие|ые|ое|ими|ыми|ей|ий|ый|ой|ем|им|ым|ом|его|ого|ему|ому|их|ых|ую|юю|ая|яя|ою|ею)$/,
  PART = /((ивш|ывш|ующ)|(?<=[ая])(ем|нн|вш|ющ|щ))$/, REFL = /(ся|сь)$/, VERB = /((ила|ыла|ена|ейте|уйте|ите|или|ыли|ей|уй|ил|ыл|им|ым|ен|ило|ыло|ено|ят|ует|уют|ит|ыт|ены|ить|ыть|ишь|ую|ю)|(?<=[ая])(ла|на|ете|йте|ли|й|л|ем|н|ло|но|ет|ют|ны|ть|ешь|нно))$/,
  NOUN = /(а|ев|ов|ие|ье|е|иями|ями|ами|еи|ии|и|ией|ей|ой|ий|й|иям|ям|ием|ем|ам|ом|о|у|ах|иях|ях|ы|ь|ию|ью|ю|ия|ья|я)$/, SUPER = /(ейш|ейше)$/, DER = /ость?$/;
function rv(w){ for(let i = 0; i < w.length; i++) if(VOW.includes(w[i])) return i + 1; return w.length; }
function stem(word){
  let w = String(word).toLowerCase().replace(/ё/g, "е"); if(w.length <= 3) return w;
  const p = rv(w), head = w.slice(0, p); let t = w.slice(p);
  const cut = re => { const m = re.exec(t); if(m){ t = t.slice(0, m.index); return true; } return false; };
  if(!cut(PERF)){ cut(REFL); if(!(cut(ADJ) && (cut(PART), true))){ if(!cut(VERB)) cut(NOUN); } }
  t = t.replace(/и$/, ""); if(DER.test(t.slice(-4)) && t.length >= 4) t = t.replace(DER, "");
  t = t.replace(/нн$/, "н").replace(/ь$/, ""); t = t.replace(SUPER, "");
  return head + t;
}

/* ---- признаки: основы слов и куски слов (ловят опечатки, сленг и незнакомые формы) ---- */
const STOP = new Set("получилось получится получается удалось ура наконец наконец-то молодец и в во на не что я мы он она они это то а но с со к у о об от до по за из для как так вот уже еще ещё был была были было мой моя мои мне меня тоже очень просто вообще сегодня вчера утром вечером днем днём ночью потом сейчас там тут дела делать делаю привет хорошо плохо нормально дом дома домой надо идти болит болят голова нету нет все всё спина спину спине утра болела один одна одну одно два две три ещё еще раз разок".split(" "));
const toks = s => String(s).toLowerCase().replace(/ё/g, "е").replace(/[^а-яa-z0-9\- ]/g, " ").split(/\s+/).filter(t => t && !/^\d+$/.test(t));
function feats(s){
  const out = [];
  for(const w of toks(s)){
    if(STOP.has(w) || w.length < 2) continue;
    const st = stem(w); out.push("s:" + st);
    const g = "^" + st + "$";
    for(const n of [3, 4]) for(let i = 0; i + n <= g.length; i++) out.push("g:" + g.slice(i, i + n));
  }
  return out;
}

/* ---- модель: наивный Байес по словарю ---- */
let MODEL = null, SIG = "";
function train(extra){
  const cls = {}, vocab = new Set(), add = (type, phrase, wgt) => { if(!type || !R.TYPES[type]) return; const c = cls[type] = cls[type] || {n:0, f:new Map()}; for(const f of feats(phrase)){ c.f.set(f, (c.f.get(f) || 0) + wgt); c.n += wgt; vocab.add(f); } };
  for(const e of (R.CATALOG || [])){ add(e.t, e.n, 2); for(const a of (e.a || "").split("|")) if(a) add(e.t, a, 1); }
  for(const [id, t] of Object.entries(R.TYPES)) for(const st of (t.stems || "").split("|")) if(st) add(id, st, 1.5);
  for(const [phrase, type] of (R.lexiconPairs || [])) add(type, phrase, 2);
  for(const [phrase, type] of (extra || [])) add(type, phrase, 3);
  MODEL = {cls, V: vocab.size, types: Object.keys(cls)};
}
function model(){ const sig = (R.CATALOG || []).length + ":" + Object.keys(R.TYPES || {}).length + ":" + (R.engineExtra || []).length + ":" + (R.lexiconPairs || []).length; if(!MODEL || sig !== SIG){ train(R.engineExtra); SIG = sig; } return MODEL; }

// угадываем тип по смыслу: [{type, p}] по убыванию вероятности
function classify(text, allowed){
  const m = model(), f = feats(text); if(!f.length) return [];
  const scores = [];
  for(const type of m.types){
    if(allowed && !allowed(type)) continue;
    const c = m.cls[type]; let ll = 0, hit = 0, sh = 0;
    for(const x of f){ const k = c.f.get(x) || 0; if(k){ hit++; if(x[0] === "s" && x.length >= 6) sh++; } ll += Math.log((k + 0.05) / (c.n + 0.05 * m.V)); }
    scores.push({type, ll, hit, sh});
  }
  if(!scores.length) return [];
  const mx = Math.max(...scores.map(s => s.ll)); let z = 0; for(const s of scores){ s.e = Math.exp(s.ll - mx); z += s.e; }
  return scores.map(s => ({type:s.type, p:s.e / z, cover:s.hit / f.length, stems:s.sh})).sort((a, b) => b.p - a.p);
}
R.engine = {stem, feats, classify, train};
if(typeof module !== "undefined" && module.exports) module.exports = R.engine;
})(typeof window !== "undefined" ? window : globalThis);
