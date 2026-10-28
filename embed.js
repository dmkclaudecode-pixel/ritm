// Rhythm · векторы слов (Navec, урезанные: 50 тыс. слов × 64, int8). Нужны для «похожести» слов: незнакомое слово получает смысл от близких.
(function(root){
"use strict";
const R = root.RITM = root.RITM || {};
const D = 64;
let vocab = [], idx = new Map(), M = null, norms = null;
function use(buf, words){
  M = new Int8Array(buf); vocab = words; idx = new Map(words.map((w, i) => [w, i]));
  norms = new Float32Array(words.length);
  for(let i = 0; i < words.length; i++){ let s = 0; for(let d = 0; d < D; d++){ const v = M[i * D + d]; s += v * v; } norms[i] = Math.sqrt(s) || 1; }
}
function load(binUrl, vocabUrl){
  return Promise.all([fetch(binUrl).then(r => r.arrayBuffer()), fetch(vocabUrl).then(r => r.text())])
    .then(([b, t]) => { use(b, t.split("\n")); return true; }).catch(() => false);
}
const norm = w => String(w).toLowerCase().replace(/ё/g, "е");
const has = w => idx.has(norm(w));
function sim(i, j){ let s = 0; for(let d = 0; d < D; d++) s += M[i * D + d] * M[j * D + d]; return s / (norms[i] * norms[j]); }
const id = w => idx.get(norm(w));
function similarity(a, b){ const i = id(a), j = id(b); return i == null || j == null ? null : sim(i, j); }
// ближайшие слова к данному (по словарю); filter — необязательное ограничение по индексам
function nearest(word, k, cand){
  const i = id(word); if(i == null) return [];
  const out = [], n = cand ? cand.length : vocab.length;
  for(let c = 0; c < n; c++){ const j = cand ? cand[c] : c; if(j === i) continue; out.push([j, sim(i, j)]); }
  return out.sort((a, b) => b[1] - a[1]).slice(0, k || 8).map(([j, s]) => ({w: vocab[j], s: +s.toFixed(3)}));
}
// индексы слов по префиксам основ: «груст» → грустно, грустный, грустить…
function formsOf(stems, maxPer){
  const byPre = {}; for(const st of stems){ if(st.length >= 4) (byPre[st.slice(0, 4)] = byPre[st.slice(0, 4)] || []).push(st); }
  const got = new Map();
  for(let i = 0; i < vocab.length; i++){ const w = vocab[i], c = byPre[w.slice(0, 4)]; if(!c) continue;
    for(const st of c) if(w.startsWith(st)){ const a = got.get(st) || []; if(a.length < (maxPer || 12)){ a.push(i); got.set(st, a); } break; } }
  return got;
}
R.embed = {use, load, has, similarity, nearest, formsOf, size: () => vocab.length, id, vec: i => M.subarray(i * D, i * D + D), sim, vocab: () => vocab};
if(typeof module !== "undefined" && module.exports) module.exports = R.embed;
})(typeof window !== "undefined" ? window : globalThis);
