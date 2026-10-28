#!/usr/bin/env node
// Строит индекс подбора реакции из золотых диалогов: node tools/build_retrieve.js [--exclude test_] > data/resp_index.json
global.window = global; global.localStorage = {getItem: () => null, setItem(){}};
const fs = require("fs"), path = require("path"), root = path.join(__dirname, "..");
["engine.js", "mood.js", "dialog.js", "followup.js", "onto.js", "talk.js", "retrieve.js"].forEach(f => require(path.join(root, f)));
RITM.mood.extend(require(path.join(root, "data/mood_lex.json"))); RITM.mood.useModel(require(path.join(root, "data/mood_nb.json")));
const tmp = path.join(require("os").tmpdir(), "gold_idx.jsonl"); require("child_process").execFileSync(process.execPath, [path.join(__dirname, "gold_check.js"), "--json", tmp], {stdio: "ignore"});
const excl = process.argv.includes("--exclude") ? process.argv[process.argv.indexOf("--exclude") + 1] : null;
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
const dialogs = fs.readFileSync(tmp, "utf8").trim().split("\n").map(JSON.parse).filter(d => (!excl || !d.file.startsWith(excl)) && (!only || d.file.startsWith(only)));
const ACTION = /(записал|добавил|поставил|исправил|убрал|поменял|пошёл таймер|запомню|запомнил|сдвину)/i;
const items = [], T = RITM.talk, F = RITM.followup, Rt = RITM.retrieve;
for(const d of dialogs){
  const users = [];
  for(let i = 0; i < d.turns.length; i++){
    const t = d.turns[i]; if(t.who === "U"){ users.push(t.text); continue; }
    const u = users[users.length - 1]; if(!u || ACTION.test(t.text)) continue;
    const prevB = d.turns[i - 2] && d.turns[i - 2].who === "B" ? d.turns[i - 2].text : null;
    const mood = RITM.mood.analyze(u), tp = T.topicOf(users.join(" "));
    const uw = new Set(users.flatMap(Rt.toks).map(Rt.stemOf)), echo = [...new Set(Rt.toks(t.text).map(Rt.stemOf).filter(s => uw.has(s)))];
    items.push({u: Rt.toks(u), b: prevB ? Rt.toks(prevB) : [], kind: prevB ? F.qKind(prevB) : null, ak: F.answerKind(u), topic: tp ? tp.k : null, val: +(mood.valence || 0).toFixed(2), dom: mood.dominant || null, reply: t.text.replace(/\s*\[act=\w+\]$/, ""), act: t.act, echo, f: d.file});
  }
}
process.stdout.write(JSON.stringify({v: 1, items}));
