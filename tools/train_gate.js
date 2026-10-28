#!/usr/bin/env node
// Обучает «калитку» подбора: по признакам лучшего кандидата предсказывает, подойдёт ли его реплика.
// Метки — по эталону: leave-one-dialog-out на обучающих диалогах, «верно» = тот же акт и тот же признак «заканчивается вопросом».
// Выход: data/resp_gate.json {w:[...]}.  Проверка на отложенных test_*: точность/полнота при разных порогах.
global.window = global; global.localStorage = {getItem: () => null, setItem(){}};
const fs = require("fs"), path = require("path"), root = path.join(__dirname, "..");
process.argv.push("--withq", "--exclude", "test_");
["engine.js", "mood.js", "dialog.js", "followup.js", "onto.js", "embed.js", "talk.js", "retrieve.js"].forEach(f => require(path.join(root, f)));
const b = fs.readFileSync(path.join(root, "data/emb.bin")); RITM.embed.use(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), fs.readFileSync(path.join(root, "data/emb_vocab.txt"), "utf8").split("\n"));
const train = require("./build_retrieve.js");
const R = RITM.retrieve; R.load({items: train.items.map(e => { const c = Object.assign({}, e); delete c.q; return c; })});
const sig = (act, text) => (act || "?") + "|" + (/\?\s*$/.test(text) ? "q" : "s");
function dataset(items, ex){
  const X = [], Y = [], M = [];
  for(const e of items){
    const r = R.pick(e.q, 0, ex ? {exclude: e.d} : {}); if(!r || !r.x) continue;
    X.push(r.x); Y.push(sig(r.act, r.best) === sig(e.act, e.reply) ? 1 : 0); M.push({u: e.q.text, gold: e.reply, got: r.best});
  }
  return {X, Y, M};
}
const tr = dataset(train.items, true);
// логистическая регрессия, градиентный спуск
const D = tr.X[0].length, w = new Array(D).fill(0), lr = .5, l2 = .001;
for(let it = 0; it < 4000; it++){
  const g = new Array(D).fill(0);
  tr.X.forEach((x, i) => { const p = 1 / (1 + Math.exp(-x.reduce((a, v, j) => a + v * w[j], 0))), e = p - tr.Y[i]; x.forEach((v, j) => g[j] += e * v); });
  for(let j = 0; j < D; j++) w[j] -= lr * (g[j] / tr.X.length + l2 * w[j]);
}
fs.writeFileSync(path.join(root, "data/resp_gate.json"), JSON.stringify({tau: +(process.env.TAU || 2), w: w.map(v => +v.toFixed(4)), n: tr.X.length, base: +(tr.Y.reduce((a, b) => a + b, 0) / tr.Y.length).toFixed(3)}));
console.log(`обучение: ${tr.X.length} примеров, доля верных у лучшего кандидата ${(tr.Y.reduce((a, b) => a + b, 0) / tr.Y.length).toFixed(3)}`);
console.log("веса:", w.map(v => v.toFixed(2)).join(" "));
