#!/usr/bin/env node
// Оценка подбора реакции на отложенных диалогах (tools/gold/test_*.txt): индекс строится без них.
// Метрика: смысловая близость (средний вектор слов) ответа и эталона, отдельно для подбора, правил и их смеси при разных порогах.
global.window = global; global.localStorage = {getItem: () => null, setItem(){}};
const fs = require("fs"), path = require("path"), root = path.join(__dirname, "..");
["engine.js", "mood.js", "dialog.js", "followup.js", "onto.js", "embed.js", "talk.js", "retrieve.js"].forEach(f => require(path.join(root, f)));
RITM.mood.extend(require(path.join(root, "data/mood_lex.json"))); RITM.mood.useModel(require(path.join(root, "data/mood_nb.json"))); RITM.onto.use(require(path.join(root, "data/onto.json")));
const b = fs.readFileSync(path.join(root, "data/emb.bin")); RITM.embed.use(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), fs.readFileSync(path.join(root, "data/emb_vocab.txt"), "utf8").split("\n"));
const idxFile = process.argv[2] || "/tmp/idx_train.json";
RITM.retrieve.load(JSON.parse(fs.readFileSync(idxFile, "utf8")));
const tmp = path.join(require("os").tmpdir(), "gold_ev.jsonl"); require("child_process").execFileSync(process.execPath, [path.join(__dirname, "gold_check.js"), "--json", tmp], {stdio: "ignore"});
const tests = fs.readFileSync(tmp, "utf8").trim().split("\n").map(JSON.parse).filter(d => d.file.startsWith("test_"));
const M = RITM.mood, D = RITM.dialog, T = RITM.talk, F = RITM.followup, Rt = RITM.retrieve; let k = 0; const rnd = () => (k = (k * 7 + 3) % 10) / 10;
const ACTION = /(записал|добавил|поставил|исправил|убрал|поменял|пошёл таймер|запомню|запомнил|сдвину)/i;
const vec = t => { const ws = Rt.toks(t), v = new Float32Array(64); let n = 0; for(const w of ws){ const i = RITM.embed.id(w); if(i == null) continue; const x = RITM.embed.vec(i); let nr = 0; for(let d = 0; d < 64; d++) nr += x[d] * x[d]; nr = Math.sqrt(nr) || 1; for(let d = 0; d < 64; d++) v[d] += x[d] / nr; n++; } return n ? v : null; };
const cos = (a, b) => { if(!a || !b) return 0; let s = 0, na = 0, nb = 0; for(let d = 0; d < 64; d++){ s += a[d] * b[d]; na += a[d] * a[d]; nb += b[d] * b[d]; } return s / (Math.sqrt(na * nb) || 1); };
const rows = [];
for(const d of tests){
  const ctx = new D.Context(), users = [];
  for(let i = 0; i < d.turns.length; i++){
    const t = d.turns[i]; if(t.who !== "U") continue;
    users.push(t.text); const mood = M.analyze(t.text), tp = T.topicOf(t.text);
    ctx.push("user", t.text, {mood, topic: (T.topicOf(t.text) || {}).k});
    const gb = d.turns[i + 1], prevB = d.turns[i - 1] && d.turns[i - 1].who === "B" ? d.turns[i - 1] : null;
    const rule = T.reply({text: t.text, mood, ctx, rnd});
    const r = Rt.pick({text: t.text, history: users.slice(0, -1), botq: prevB && /\?\s*$/.test(prevB.text) ? (F.lastQuestion(prevB.text) || prevB.text) : null, kind: prevB ? F.qKind(prevB.text) : null, ak: F.answerKind(t.text), shape: F.shape(t.text), topic: (T.topicOf(users.join(" ")) || {}).k, mood, said: []}, 0);
    if(gb && gb.who === "B" && !ACTION.test(gb.text)) rows.push({u: t.text, prev: prevB && prevB.text, gold: gb.text, rule: rule.text, ret: r && (r.text || r.best), score: r ? r.score : 0, p: r ? r.p : 0, gact: gb && gb.act, ract: rule.act, ract2: r && r.act, rasked: rule.asked, c: r && r.c, margin: r ? r.margin : 0, from: r && r.from});
    ctx.push("bot", gb && gb.who === "B" ? gb.text : rule.text, {asked: gb && gb.who === "B" ? /\?\s*$/.test(gb.text) : rule.asked, act: gb ? gb.act : rule.act});
  }
}
const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const sRule = rows.map(r => cos(vec(r.rule), vec(r.gold))), sRet = rows.map(r => cos(vec(r.ret), vec(r.gold)));
console.log(`пар: ${rows.length}; близость к эталону: правила ${avg(sRule).toFixed(3)}, подбор ${avg(sRet).toFixed(3)}`);
for(const th of [.35, .45, .5, .55, .6, .65, .7]){
  const use = rows.map((r, i) => r.score >= th), mix = rows.map((r, i) => use[i] ? sRet[i] : sRule[i]);
  console.log(`порог ${th}: берём подбор в ${use.filter(Boolean).length}/${rows.length}; смесь ${avg(mix).toFixed(3)}; подбор на этих ${avg(rows.map((r, i) => use[i] ? sRet[i] : null).filter(x => x != null)).toFixed(3)} против правил на этих ${avg(rows.map((r, i) => use[i] ? sRule[i] : null).filter(x => x != null)).toFixed(3)}`);
}
if(process.argv.includes("-p")){ const n = +process.argv[process.argv.indexOf("-p") + 1] || 30; rows.slice(0, n).forEach(r => console.log(`\nБ: ${r.prev || "-"}\n У: ${r.u}\n ЭТАЛОН: ${r.gold}\n ПРАВИЛА: ${r.rule}\n ПОДБОР (${r.score}): ${r.ret}`)); }

if(process.argv.includes("-c")){ const good = new Set([0,4,6,8,16,17,23,24,25,27]); rows.slice(0, 28).forEach((r, i) => console.log((good.has(i) ? "OK  " : "BAD ") + i + " lex=" + r.c.lex.toFixed(2) + " sem=" + r.c.sem.toFixed(2) + " qq=" + r.c.qq.toFixed(2) + " score=" + r.score + " m=" + r.margin + (r.prev ? " Q" : "  "))); }

{ const sig = (a, t) => (a || "?") + "|" + (/\?\s*$/.test(t || "") ? "q" : "s");
  const okR = rows.map(r => sig(r.ract, r.rule) === sig(r.gact, r.gold)), okT = rows.map(r => r.ret && sig(r.ract2, r.ret) === sig(r.gact, r.gold));
  console.log(`\nпопадание в (акт, вопрос/не вопрос): правила ${okR.filter(Boolean).length}/${rows.length}, подбор без порога ${okT.filter(Boolean).length}/${rows.length}`);
  for(const th of [.2, .3, .4, .5, .6, .7]){ const use = rows.map(r => r.p >= th), n = use.filter(Boolean).length, good = rows.filter((r, i) => use[i] && okT[i]).length, mix = rows.filter((r, i) => use[i] ? okT[i] : okR[i]).length;
    console.log(`p>=${th}: подбор в ${n} случаях, верно ${good}${n ? " (" + Math.round(100 * good / n) + "%)" : ""}; правила на остальных верно ${rows.filter((r, i) => !use[i] && okR[i]).length}/${rows.length - n}; смесь ${mix}/${rows.length}`); } }
{ const sig = (a, t) => (a || "?") + "|" + (/\?\s*$/.test(t || "") ? "q" : "s");
  for(const [name, f] of [["первая реплика (без вопроса бота)", r => !r.prev], ["ответ на вопрос бота", r => !!r.prev]]){
    const sub = rows.filter(f); const okT = sub.map(r => r.ret && sig(r.ract2, r.ret) === sig(r.gact, r.gold)), okR = sub.map(r => sig(r.ract, r.rule) === sig(r.gact, r.gold));
    console.log(`${name}: пар ${sub.length}; подбор верно ${okT.filter(Boolean).length}, правила верно ${okR.filter(Boolean).length}; при p>=.4: ${sub.filter((r, i) => r.p >= .4 && okT[i]).length}/${sub.filter(r => r.p >= .4).length}`); } }
if(process.argv.includes("-g")){ const th = +process.argv[process.argv.indexOf("-g") + 1] || .5; rows.filter(r => r.p >= th).forEach(r => console.log(`\nБ: ${r.prev || "-"}\n У: ${r.u}\n ЭТАЛОН: ${r.gold}\n ПОДБОР (p=${r.p}): ${r.ret}`)); }
