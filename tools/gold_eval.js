#!/usr/bin/env node
// Базовая оценка: текущий talk.reply на золотых диалогах — совпадение акта с эталоном (по первой реплике и по всем).
global.window = global; global.localStorage = {getItem: () => null, setItem(){}};
const fs = require("fs"), path = require("path"), root = path.join(__dirname, "..");
["engine.js", "mood.js", "dialog.js", "onto.js", "talk.js"].forEach(f => require(path.join(root, f)));
RITM.mood.extend(require(path.join(root, "data/mood_lex.json"))); RITM.mood.useModel(require(path.join(root, "data/mood_nb.json"))); RITM.onto.use(require(path.join(root, "data/onto.json")));
const tmp = path.join(require("os").tmpdir(), "gold.jsonl"); require("child_process").execFileSync(process.execPath, [path.join(__dirname, "gold_check.js"), "--json", tmp]);
const dialogs = fs.readFileSync(tmp, "utf8").trim().split("\n").map(JSON.parse);
const M = RITM.mood, D = RITM.dialog, T = RITM.talk; let k = 0; const rnd = () => (k = (k * 7 + 3) % 10) / 10;
const stat = {}, miss = []; let tot = 0, hit = 0, askBad = 0, calls = 0;
for (const d of dialogs) {
  const ctx = new D.Context();
  for (let i = 0; i < d.turns.length; i++) {
    const t = d.turns[i]; if (t.who !== "U") continue;
    const mood = M.analyze(t.text); ctx.push("user", t.text, {mood, topic: (T.topicOf(t.text) || {}).k});
    const x = T.reply({text: t.text, mood, ctx, rnd}); ctx.push("bot", x.text, {asked: x.asked, act: x.act}); calls++;
    const g = d.turns[i + 1] && d.turns[i + 1].who === "B" ? d.turns[i + 1].act : null; if (!g) continue;
    // эталонный бот-реплику кладём в историю? нет: сравниваем самостоятельный ход бота
    tot++; const s = stat[g] || (stat[g] = {n: 0, h: 0}); s.n++;
    if (x.act === g) { hit++; s.h++; } else miss.push(`[${g}→${x.act}] ${t.text}  | бот: ${x.text}`);
  }
}
console.log(`акт совпал: ${hit}/${tot} (${Math.round(100 * hit / tot)}%)`);
for (const [a, s] of Object.entries(stat).sort((a, b) => b[1].n - a[1].n)) console.log(`  ${a}: ${s.h}/${s.n}`);
if (process.argv.includes("-v")) console.log(miss.slice(0, +process.argv[process.argv.indexOf("-v") + 1] || 40).join("\n"));
