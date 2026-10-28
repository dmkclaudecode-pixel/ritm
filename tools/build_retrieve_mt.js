#!/usr/bin/env node
// Индекс подбора из переведённых диалогов (dialogs_ru.jsonl): пары (реплика человека → отклик слушателя), с жёсткими фильтрами.
// node tools/build_retrieve_mt.js dialogs_ru.jsonl [--max 12000] > /tmp/idx_mt.json
global.window = global; global.localStorage = {getItem: () => null, setItem(){}};
const fs = require("fs"), path = require("path"), root = path.join(__dirname, "..");
["engine.js", "mood.js", "dialog.js", "followup.js", "onto.js", "embed.js", "talk.js", "retrieve.js"].forEach(f => require(path.join(root, f)));
RITM.mood.extend(require(path.join(root, "data/mood_lex.json"))); RITM.mood.useModel(require(path.join(root, "data/mood_nb.json")));
const {moves} = require("./moves.js");
const T = RITM.talk, F = RITM.followup, Rt = RITM.retrieve;
const maxN = process.argv.includes("--max") ? +process.argv[process.argv.indexOf("--max") + 1] : 12000;
const src = process.argv[2];
// фильтры реплики бота: короткая, без «вы», без цифр, имён, латиницы, без прошедшего времени (род неизвестен)
const FORMAL = /(^|[^а-я])(вы|вас|вам|вами|ваш\S*)([^а-я]|$)/i;
const PAST = /[а-я]{3,}(л|ла|ло|ли|лся|лась|лось|лись)(?=[^а-я]|$)/i, PASTOK = /^(было|могло|хотело|должно|была|были|стало|нужно)$/i;
function okReply(t){
  const w = t.match(/[а-яё]+/gi) || [];
  if(w.length < 2 || w.length > 22 || /\d|[A-Za-z]/.test(t) || FORMAL.test(t)) return false;
  if(/(^|[.!?]\s+)[а-яё]/.test(t.replace(/^[«"]/, ""))) return false;          // предложение не с заглавной
  if(/[а-яё]\s+[А-ЯЁ][а-яё]+/.test(t.replace(/([.!?]\s+)[А-ЯЁ]/g, "$1"))) return false;   // имя внутри предложения
  for(const x of w) if(PAST.test(x) && !PASTOK.test(x)) return false;
  if(/(лол|хаха|хе-хе)/i.test(t) || /^[-–—]/.test(t) || w.length > 16) return false;
  if(/(^|[^а-я])(он|она|они|оно|его|её|ее|ему|ей|им|ими|ним|ней|них|нее|него|ними|их)([^а-я]|$)/i.test(t)) return false;   // ссылка на третье лицо из чужой истории
  if(/(простите|извините|ты должен|вы должны|нужно было|надо было)/i.test(t)) return false;
  return true;
}
const items = [], seen = new Set(); let total = 0;
const lines = fs.readFileSync(src, "utf8").trim().split("\n");
lines.forEach((ln, di) => {
  const d = JSON.parse(ln); if(d.src !== "empathetic") return;
  const users = [];
  for(let i = 0; i + 1 < d.turns.length; i += 2){
    const u = d.turns[i], b = d.turns[i + 1], pb = i >= 2 ? d.turns[i - 1] : null; users.push(u); total++;
    if(!okReply(b) || seen.has(b)) continue;
    seen.add(b);
    const mood = RITM.mood.analyze(u), tp = T.topicOf(users.join(" ")), mv = moves(b);
    const act = mv.close !== "none" ? (mv.open === "empathy" ? "mood" : mv.open === "praise" ? "event" : "question") : mv.open === "empathy" ? "mood" : mv.body === "none" ? "ack" : "advice";
    const uw = new Set(users.flatMap(Rt.toks).map(Rt.stemOf)), echo = [...new Set(Rt.toks(b).map(Rt.stemOf).filter(s => uw.has(s)))];
    items.push({u: Rt.toks(u), b: pb ? Rt.toks(pb) : [], kind: pb ? F.qKind(pb) : null, ak: F.answerKind(u), topic: tp ? tp.k : null, val: +(mood.valence || 0).toFixed(2), dom: mood.dominant || null, reply: b, act, echo, f: "mt:" + (d.emotion || ""), d: 100000 + di});
  }
});
// плотность: «общие» отклики встречаются в разных вариантах много раз; редкие и конкретные отбрасываем
require("fs"); const b = fs.readFileSync(path.join(root, "data/emb.bin")); RITM.embed.use(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), fs.readFileSync(path.join(root, "data/emb_vocab.txt"), "utf8").split("\n"));
const vecs = items.map(e => { const ws = Rt.toks(e.reply), v = new Float32Array(64); let n = 0; for(const w of ws){ const i = RITM.embed.id(w); if(i == null) continue; const x = RITM.embed.vec(i); let nr = 0; for(let d = 0; d < 64; d++) nr += x[d] * x[d]; nr = Math.sqrt(nr) || 1; for(let d = 0; d < 64; d++) v[d] += x[d] / nr; n++; } if(!n) return null; let nr = 0; for(let d = 0; d < 64; d++) nr += v[d] * v[d]; nr = Math.sqrt(nr) || 1; for(let d = 0; d < 64; d++) v[d] /= nr; return v; });
const DENS = process.argv.includes("--dens") ? +process.argv[process.argv.indexOf("--dens") + 1] : 8, SIM = .93;
let kept = 0; items.forEach((e, i) => { const vi = vecs[i]; let c = 0; if(vi) for(let j = 0; j < items.length; j++){ if(j === i || !vecs[j]) continue; let sdot = 0; const vj = vecs[j]; for(let d = 0; d < 64; d++) sdot += vi[d] * vj[d]; if(sdot >= SIM && ++c >= DENS) break; } e.dens = c; });
const dense = items.filter(e => e.dens >= DENS); items.length = 0; items.push(...dense);
// стратификация: по (эмоция исходного диалога) поровну
const by = new Map(); for(const e of items){ (by.get(e.f) || by.set(e.f, []).get(e.f)).push(e); }
let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const per = Math.ceil(maxN / by.size), out = [];
for(const [, arr] of by){ arr.sort(() => rnd() - .5); out.push(...arr.slice(0, per)); }
console.error(`пар всего ${total}, прошло фильтры ${items.length}, групп ${by.size}, оставлено ${out.length}`);
process.stdout.write(JSON.stringify({v: 1, items: out}));
