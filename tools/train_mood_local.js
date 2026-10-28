#!/usr/bin/env node
// Обучает классификатор настроения на авторских фразах tools/moodtrain/*.txt (формат «класс|фраза»).
// Признаки — основы слов и пары основ; модель — наивный Байес с равными априорными вероятностями. Выход: data/mood_nb.json.
const fs = require("fs"), path = require("path");
const dir = path.join(__dirname, "moodtrain"), out = path.join(__dirname, "../data/mood_nb.json");
const rows = []; for(const f of fs.readdirSync(dir).filter(f => f.endsWith(".txt"))) for(const l of fs.readFileSync(path.join(dir, f), "utf8").split("\n")){ const i = l.indexOf("|"); if(i > 0) rows.push({l: l.slice(0, i), t: l.slice(i + 1)}); }
fs.writeFileSync("/tmp/mood_own.jsonl", rows.map(r => JSON.stringify(r)).join("\n"));
const { execFileSync } = require("child_process");
console.log(execFileSync(process.execPath, [path.join(__dirname, "train_mood.js"), "/tmp/mood_own.jsonl", out], {encoding: "utf8", env: Object.assign({MINC: "1", SPREAD: "0.3"}, process.env)}));
