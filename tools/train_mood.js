#!/usr/bin/env node
// Обучает наивный байесовский классификатор настроения на размеченных текстах (mood_train.jsonl из конвейера корпусов).
// Признаки — основы слов и пары основ (те же, что в приложении: RITM.engine.stem). Выход: data/mood_nb.json (сжатые лог-вероятности).
const fs = require("fs"), path = require("path");
global.window = global; require("../engine.js");
const stem = RITM.engine.stem, inp = process.argv[2] || "/tmp/cd/mood_train.jsonl", out = process.argv[3] || path.join(__dirname, "../data/mood_nb.json");
const rows = fs.readFileSync(inp, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l));
const STOP = new Set("и в на не что я он она это как а но с к у о от по за из для то бы же ли уж вот так все всё".split(" "));
const feats = t => {
  const ws = (String(t).toLowerCase().replace(/ё/g, "е").match(/[а-я]{2,}/g) || []).filter(w => !STOP.has(w)).map(stem);
  const f = ws.slice(); for(let i = 0; i + 1 < ws.length; i++) f.push(ws[i] + "_" + ws[i + 1]);
  return f;
};
// детерминированное разбиение: каждый 10-й текст — на проверку
const tr = rows.filter((_, i) => i % 10), te = rows.filter((_, i) => i % 10 === 0);
function fit(data, minc){
  const cls = {}, cnt = {}, total = {};
  for(const r of data){ cls[r.l] = (cls[r.l] || 0) + 1; for(const f of new Set(feats(r.t))){ (cnt[f] = cnt[f] || {})[r.l] = (cnt[f][r.l] || 0) + 1; } }
  for(const l in cls) total[l] = Object.values(cnt).reduce((a, c) => a + (c[l] || 0), 0);
  const labels = Object.keys(cls), V = Object.keys(cnt).length, N = data.length, W = {};
  for(const [f, c] of Object.entries(cnt)){
    const s = Object.values(c).reduce((a, b) => a + b, 0); if(s < minc) continue;
    const lp = {}; let spread = 0, mean = 0;
    for(const l of labels){ lp[l] = Math.log(((c[l] || 0) + .5) / (total[l] + .5 * V)); mean += lp[l] / labels.length; }
    for(const l of labels) spread = Math.max(spread, Math.abs(lp[l] - mean));
    if(spread >= .5) W[f] = labels.map(l => +(lp[l] - mean).toFixed(2));     // храним отклонения от среднего: слабые признаки отбрасываем
  }
  return {labels, prior: labels.map(l => +Math.log(cls[l] / N).toFixed(3)), W};
}
function predict(m, text){
  const sc = m.prior.slice(); for(const f of new Set(feats(text))){ const w = m.W[f]; if(w) for(let i = 0; i < sc.length; i++) sc[i] += w[i]; }
  const mx = Math.max(...sc), e = sc.map(x => Math.exp(x - mx)), z = e.reduce((a, b) => a + b, 0), p = e.map(x => x / z), j = p.indexOf(Math.max(...p));
  return {label: m.labels[j], p: p[j]};
}
let model = fit(tr, 3), ok = 0, byL = {};
for(const r of te){ const p = predict(model, r.t); const hit = p.label === r.l; ok += hit; (byL[r.l] = byL[r.l] || [0, 0])[0] += hit; byL[r.l][1]++; }
console.log(`проверка на ${te.length} отложенных текстах: ${(100 * ok / te.length).toFixed(1)}%`);
console.log(Object.entries(byL).map(([l, [a, b]]) => `${l} ${(100 * a / b).toFixed(0)}% (${b})`).join(", "));
model = fit(rows, 3); model.labels = model.labels;
fs.mkdirSync(path.dirname(out), {recursive: true}); fs.writeFileSync(out, JSON.stringify(model));
console.log(`признаков: ${Object.keys(model.W).length}, классы: ${model.labels.join(",")}, ${Math.round(fs.statSync(out).size / 1024)} КБ`);
