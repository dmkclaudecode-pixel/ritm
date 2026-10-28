#!/usr/bin/env node
// Реплики людей из переведённых «эмпатичных» диалогов → размеченные тексты настроения (наши 19 классов).
// node tools/build_mood_mt.js dialogs_ru.jsonl [--per 500] > /tmp/mood_mt.jsonl
const fs = require("fs");
const MAP = {sentimental: "sad", afraid: "fear", proud: "proud", faithful: "calm", terrified: "fear", joyful: "joy", angry: "anger", sad: "sad", jealous: "anger", grateful: "joy", prepared: "motivated", embarrassed: "guilty", excited: "excited", annoyed: "anger", lonely: "sad", ashamed: "guilty", guilty: "guilty", surprised: "surprised", nostalgic: "sad", confident: "proud", furious: "anger", disappointed: "sad", caring: "love", trusting: "calm", disgusted: "disgust", anticipating: "excited", anxious: "anxious", hopeful: "motivated", content: "calm", impressed: "surprised", apprehensive: "anxious", devastated: "sad"};
const per = process.argv.includes("--per") ? +process.argv[process.argv.indexOf("--per") + 1] : 500;
const cnt = {}, out = [];
for(const ln of fs.readFileSync(process.argv[2], "utf8").trim().split("\n")){
  const d = JSON.parse(ln); const l = MAP[d.emotion]; if(!l) continue;
  const t = d.turns[0]; if(!t || t.split(/\s+/).length < 3 || t.split(/\s+/).length > 30 || /[A-Za-z]/.test(t)) continue;
  if((cnt[l] = (cnt[l] || 0) + 1) > per) continue;
  out.push(JSON.stringify({l, t}));
}
console.error(JSON.stringify(cnt));
process.stdout.write(out.join("\n") + "\n");
