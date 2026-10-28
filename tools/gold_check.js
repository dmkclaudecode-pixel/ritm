#!/usr/bin/env node
// Проверка и статистика золотого слоя: node tools/gold_check.js [--json out.jsonl]
const fs = require("fs"), path = require("path");
const dir = path.join(__dirname, "gold");
const ACTS = new Set("ack mood advice question event topic clarify define andyou whatsup invite short meta vague offer".split(" "));
const out = []; const errs = [];
for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".txt")).sort()) {
  const blocks = fs.readFileSync(path.join(dir, f), "utf8").split(/\n\s*\n/);
  blocks.forEach((b, bi) => {
    const lines = b.split("\n").map(s => s.trim()).filter(Boolean);
    if (!lines.length) return;
    const h = lines[0].match(/^## (.+?) \| (\w+)$/);
    if (!h) return errs.push(`${f} блок ${bi + 1}: нет заголовка`);
    const turns = []; let variants = null, ctxTurn = null;
    for (const l of lines.slice(1)) {
      let mv = l.match(/^U\*: (.+)$/);                                    // варианты реплики человека через « / »: разворачиваем в отдельные диалоги
      if (mv) { variants = mv[1].split(" / ").map(x => x.trim()).filter(Boolean); turns.push({ who: "U", text: variants[0], act: null }); continue; }
      mv = l.match(/^Q: (.+)$/);                                          // реплика бота перед ответом (контекст)
      if (mv && !turns.length) { ctxTurn = { who: "B", text: mv[1], act: null }; continue; }
      const m = l.match(/^([UB]): (.+?)(?: \[act=(\w+)\])?$/);
      if (!m) { errs.push(`${f} блок ${bi + 1}: плохая строка «${l}»`); continue; }
      if (m[3] && !ACTS.has(m[3])) errs.push(`${f}: неизвестный акт ${m[3]}`);
      if (m[1] === "B" && (m[2].match(/\?/g) || []).length > 1) errs.push(`${f} блок ${bi + 1}: больше одного вопроса «${m[2]}»`);
      turns.push({ who: m[1], text: m[2], act: m[3] || null });
    }
    if (!turns.length || turns[0].who !== "U") errs.push(`${f} блок ${bi + 1}: должен начинаться с U`);
    for (let i = 1; i < turns.length; i++) if (turns[i].who === turns[i - 1].who) errs.push(`${f} блок ${bi + 1}: подряд две реплики одного автора`);
    const base = ctxTurn ? [ctxTurn].concat(turns) : turns;
    if (variants) for (const v of variants) { const t = base.map(x => ({ ...x })); t[ctxTurn ? 1 : 0].text = v; out.push({ file: f, topic: h[1], mood: h[2], turns: t }); }
    else out.push({ file: f, topic: h[1], mood: h[2], turns: base });
  });
}
const n = out.length, pairs = out.reduce((s, d) => s + d.turns.filter(t => t.who === "B").length, 0);
const by = k => out.reduce((o, d) => (o[d[k]] = (o[d[k]] || 0) + 1, o), {});
console.log(`диалогов: ${n}, пар: ${pairs}\nтемы: ${JSON.stringify(by("topic"))}\nнастроения: ${JSON.stringify(by("mood"))}`);
if (errs.length) { console.log("ОШИБКИ:\n" + errs.join("\n")); process.exit(1); }
const j = process.argv.indexOf("--json"); if (j > 0) fs.writeFileSync(process.argv[j + 1], out.map(d => JSON.stringify(d)).join("\n") + "\n");
