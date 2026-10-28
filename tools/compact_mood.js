#!/usr/bin/env node
// emo_words.json (из конвейера корпусов) → data/mood_lex.json: {основа слова: [эмоция, вес]} для mood.js.
const fs = require("fs"), path = require("path");
global.window = global; require("../engine.js");
const stem = RITM.engine.stem, dir = process.argv[2] || "/tmp/cd", out = path.join(__dirname, "../data/mood_lex.json");
const d = JSON.parse(fs.readFileSync(path.join(dir, "emo_words.json"), "utf8"));
const MAP = {joy: "joy", sadness: "sad", fear: "fear", anger: "anger", surprise: "surprised", positive: "pos", negative: "neg"};
// слова, которые встречаются в эмоциональных текстах из-за темы, а не из-за чувства
const NOISE = new Set("какой ты почему рука пользователь поп кавказ баба мужской электричка сын общаться перестать поздравить дождаться ееий блин что это как все свой мой весь который такой один человек очень день жизнь время дело раз сказать говорить говорить знать хотеть быть мочь стать видеть думать пойти идти знать ещё еще уже даже только тоже всё вот ну да нет там тут".split(" "));
const lex = {}; let n = 0;
const put = (w, [lab, lift, cnt], minLift, minCnt, scale) => {
  if(NOISE.has(w) || w.length < 4 || !MAP[lab] || lift < minLift || cnt < minCnt) return;
  const k = stem(w); if(k.length < 3) return;
  const weight = Math.min(1.2, +(0.3 + Math.log(lift) * 0.25).toFixed(2)) * scale;
  if(!lex[k] || lex[k][1] < weight){ lex[k] = [MAP[lab], +weight.toFixed(2)]; n++; }
};
for(const [w, v] of Object.entries(d.emo || {})) put(w, v, 3.0, 10, 1);
for(const [w, v] of Object.entries(d.sent || {})) put(w, v, 2.3, 25, .6);
fs.writeFileSync(out, JSON.stringify(lex));
console.log(`слов в лексиконе настроения: ${Object.keys(lex).length}; ${Math.round(fs.statSync(out).size/1024)} КБ`);
console.log(Object.entries(lex).slice(0, 60).map(([k, v]) => k + ":" + v[0]).join(" "));
