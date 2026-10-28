#!/usr/bin/env node
// Базовая оценка: текущий talk.reply на золотых диалогах — совпадение акта с эталоном (по первой реплике и по всем).
global.window = global; global.localStorage = {getItem: () => null, setItem(){}};
const fs = require("fs"), path = require("path"), root = path.join(__dirname, "..");
["engine.js", "mood.js", "dialog.js", "followup.js", "onto.js", "talk.js"].forEach(f => require(path.join(root, f)));
RITM.mood.extend(require(path.join(root, "data/mood_lex.json"))); RITM.mood.useModel(require(path.join(root, "data/mood_nb.json"))); RITM.onto.use(require(path.join(root, "data/onto.json")));
const tmp = path.join(require("os").tmpdir(), "gold.jsonl"); require("child_process").execFileSync(process.execPath, [path.join(__dirname, "gold_check.js"), "--json", tmp]);
const dialogs = fs.readFileSync(tmp, "utf8").trim().split("\n").map(JSON.parse);
const M = RITM.mood, D = RITM.dialog, T = RITM.talk; let k = 0; const rnd = () => (k = (k * 7 + 3) % 10) / 10;
const stat = {}, miss = [], gen = [], pairsOut = []; let tot = 0, hit = 0, calls = 0, fallback = 0, afterQ = 0, afterQFallback = 0;
const FALLBACK = /^(Продолжай, я слушаю|Я здесь|Слушаю|Продолжай|Я не уверен, что понял|Расскажи чуть подробнее|Это про что-то, что мне записать)/;
for (const d of dialogs) {
  const ctx = new D.Context();
  for (let i = 0; i < d.turns.length; i++) {
    const t = d.turns[i]; if (t.who !== "U") continue;
    const mood = M.analyze(t.text); ctx.push("user", t.text, {mood, topic: (T.topicOf(t.text) || {}).k});
    const x = T.reply({text: t.text, mood, ctx, rnd}); calls++;
    const prevB = d.turns[i - 1], wasQ = prevB && prevB.who === "B" && /\?\s*$/.test(prevB.text), isFb = FALLBACK.test(x.text) || x.act === "clarify" && i > 0;
    if (wasQ) pairsOut.push(`Б: ${prevB.text}\n  У: ${t.text}\n  ЭТАЛОН: ${d.turns[i + 1] ? d.turns[i + 1].text : "-"}\n  НАШ:   ${x.text}`);
    if(isFb) fallback++; if(wasQ){ afterQ++; if(isFb){ afterQFallback++; gen.push(`${prevB.text}\n   U: ${t.text}\n   B: ${x.text}`); } }
    const gb = d.turns[i + 1]; ctx.push("bot", gb && gb.who === "B" ? gb.text : x.text, {asked: gb && gb.who === "B" ? /\?\s*$/.test(gb.text) : x.asked, act: gb && gb.who === "B" ? gb.act : x.act});   // подставляем эталонный ход бота: оцениваем реакцию на ответ, а не накопленную ошибку
    const g = d.turns[i + 1] && d.turns[i + 1].who === "B" ? d.turns[i + 1].act : null; if (!g) continue;
    // эталонный бот-реплику кладём в историю? нет: сравниваем самостоятельный ход бота
    tot++; const s = stat[g] || (stat[g] = {n: 0, h: 0}); s.n++;
    if (x.act === g) { hit++; s.h++; } else miss.push(`[${g}→${x.act}] ${t.text}  | бот: ${x.text}`);
  }
}
console.log(`пустых ответов («продолжай»/«не понял») в целом: ${fallback}/${calls}; на ответ после вопроса бота: ${afterQFallback}/${afterQ}`);
console.log(`акт совпал: ${hit}/${tot} (${Math.round(100 * hit / tot)}%)`);
for (const [a, s] of Object.entries(stat).sort((a, b) => b[1].n - a[1].n)) console.log(`  ${a}: ${s.h}/${s.n}`);
if (process.argv.includes("-p")) console.log(pairsOut.slice(0, +process.argv[process.argv.indexOf("-p") + 1] || 30).join("\n\n"));
if (process.argv.includes("-f")) console.log("\nПустые ответы после вопроса:\n" + gen.slice(0, 40).join("\n"));
if (process.argv.includes("-v")) console.log(miss.slice(0, +process.argv[process.argv.indexOf("-v") + 1] || 40).join("\n"));
