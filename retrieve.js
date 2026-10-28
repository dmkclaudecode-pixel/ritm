// Rhythm · подбор реакции по смыслу контекста. Индекс — эталонные пары «контекст → реплика бота» (tools/gold, tools/build_retrieve.js).
// Схожесть: слова (tf-idf по основам) + смысл (векторы слов) + тип вопроса бота + настроение + тема.
// Защита от «чужих деталей»: реплика, повторяющая слова из исходного диалога, подходит, только если эти слова есть и в нашем.
(function(root){
"use strict";
const R = root.RITM = root.RITM || {};
const STOP = new Set("это как что так вот или для при про над под без все всё уже еще ещё его её они она оно мне тебе тебя меня нас вас был была было были буду будет есть нет да ну же ли бы то та те там тут сам сама сейчас очень просто тоже только если когда потом тогда".split(" "));
const norm = w => String(w).toLowerCase().replace(/ё/g, "е");
const toks = t => (String(t).toLowerCase().replace(/ё/g, "е").match(/[а-я]{3,}|\d+/g) || []).filter(w => !STOP.has(w));
const stemOf = w => /^\d/.test(w) ? w : (R.engine ? R.engine.stem(w) : w.slice(0, 5));
let IDX = [], IDF = new Map(), ready = false, GATE = null;

function bag(words){ const m = new Map(); for(const w of words){ const s = stemOf(w); m.set(s, (m.get(s) || 0) + 1); } return m; }
function meanVec(words){
  const E = R.embed; if(!E || !E.size || !E.size()) return null; const v = new Float32Array(64); let n = 0;
  for(const w of words){ const i = E.id(w); if(i == null) continue; const x = E.vec(i); let nr = 0; for(let d = 0; d < 64; d++) nr += x[d] * x[d]; nr = Math.sqrt(nr) || 1; for(let d = 0; d < 64; d++) v[d] += x[d] / nr; n++; }
  if(!n) return null; let nr = 0; for(let d = 0; d < 64; d++) nr += v[d] * v[d]; nr = Math.sqrt(nr) || 1; for(let d = 0; d < 64; d++) v[d] /= nr; return v;
}
const dot = (a, b) => { if(!a || !b) return 0; let s = 0; for(let d = 0; d < 64; d++) s += a[d] * b[d]; return s; };
function cosBag(a, b){
  if(!a.size || !b.size) return 0; let s = 0, na = 0, nb = 0;
  for(const [k, v] of a){ const w = v * (IDF.get(k) || 1); na += w * w; if(b.has(k)) s += w * b.get(k) * (IDF.get(k) || 1); }
  for(const [k, v] of b){ const w = v * (IDF.get(k) || 1); nb += w * w; }
  return s / (Math.sqrt(na * nb) || 1);
}
function prep(e){ e.ub = bag(e.u); e.bb = bag(e.b || []); e.uv = meanVec(e.u); e.bv = meanVec(e.b || []); e.echoSet = new Set(e.echo || []); return e; }
function load(index){
  IDX = (index.items || []).map(e => prep(Object.assign({}, e))); const df = new Map();
  for(const e of IDX) for(const k of new Set([...e.ub.keys(), ...e.bb.keys()])) df.set(k, (df.get(k) || 0) + 1);
  IDF = new Map(); for(const [k, c] of df) IDF.set(k, Math.log(1 + IDX.length / c)); GATE = index.gate || null; ready = true;
}
// q: {text, history[], botq, kind, ak, topic, mood, said[]}
function pick(q, th, opt){
  if(!ready) return null; th = th == null ? .5 : th; opt = opt || {};
  const uw = toks(q.text), allw = new Set((q.history || []).concat([q.text]).flatMap(toks).map(stemOf));
  const qb = bag(uw), qbq = bag(toks(q.botq || "")), qv = meanVec(uw), qbv = meanVec(toks(q.botq || ""));
  const val = (q.mood && q.mood.valence) || 0, dom = q.mood && q.mood.dominant;
  let best = null, bs = -1, second = -1, bc = null;
  for(const e of IDX){
    if(q.said && q.said.includes(e.reply)) continue;
    if(opt.exclude != null && e.d === opt.exclude) continue;
    let bad = false; for(const k of e.echoSet) if(!allw.has(k)){ bad = true; break; } if(bad) continue;
    const lex = cosBag(qb, e.ub), sem = dot(qv, e.uv), qq = q.botq ? Math.max(cosBag(qbq, e.bb), dot(qbv, e.bv) * .8) : (e.b && e.b.length ? 0 : .6);
    const s = .22 * lex + .22 * Math.max(0, sem) + .26 * qq + .08 * (q.kind && q.kind === e.kind ? 1 : 0) + .04 * (q.ak && q.ak === e.ak ? 1 : 0) + .1 * (1 - Math.min(1, Math.abs(val - (e.val || 0)))) + .04 * (dom && dom === e.dom ? 1 : 0) + .04 * (q.topic && q.topic === e.topic ? 1 : 0);
    if(s > bs){ second = bs; bs = s; best = e; bc = {lex, sem, qq}; } else if(s > second) second = s;
  }
  if(!best) return null;
  const x = [bc.lex, Math.max(0, bc.sem), bc.qq, q.kind && q.kind === best.kind ? 1 : 0, q.ak && q.ak === best.ak ? 1 : 0, 1 - Math.min(1, Math.abs(val - (best.val || 0))), dom && dom === best.dom ? 1 : 0, q.topic && q.topic === best.topic ? 1 : 0, bs - Math.max(second, 0), q.botq ? 1 : 0, Math.min(1, best.reply.split(" ").length / 25), Math.min(1, uw.length / 10), bs, 1];
  const p = GATE ? 1 / (1 + Math.exp(-GATE.w.reduce((a, w, i) => a + w * (x[i] || 0), 0))) : bs;
  return {text: p >= th ? best.reply : null, best: best.reply, score: +bs.toFixed(3), p: +p.toFixed(3), margin: +(bs - second).toFixed(3), act: best.act || null, x, c: bc, from: best.u.join(" ")};
}
R.retrieve = {load, pick, toks, stemOf, size: () => IDX.length};
if(typeof module !== "undefined" && module.exports) module.exports = R.retrieve;
})(typeof window !== "undefined" ? window : globalThis);
