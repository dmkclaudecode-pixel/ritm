// Прогон тестовых фраз: node tests/run.js  (код выхода 1, если что-то сломалось)
const store = {}; global.localStorage = {getItem:k=>store[k]??null, setItem:(k,v)=>store[k]=v};
global.window = global;
require("../catalog.js"); require("../catalog2.js"); require("../catalog3.js"); require("../lexicon.js"); require("../food.js"); require("../food2.js"); require("../engine.js"); require("../parser.js"); require("../nlu.js");
const {PARSE, NLU} = require("./phrases.js");
RITM.ctx = {now:"14:30", workEnd:"19:00", commute:0, lunch:"13:30", bed:"23:00", wake:"08:00"};
let ok = 0, bad = 0; const fails = [];
const match = (got, exp) => Object.entries(exp).every(([k, v]) => k === "unknown" ? !!got.unknown === v : (v === null ? got[k] == null : JSON.stringify(got[k]) === JSON.stringify(v)));
for(const [t, exp] of PARSE){
  const got = RITM.parse(t);
  const pass = got.length >= exp.length && exp.every((e, i) => match(got[i], e));
  if(pass) ok++; else { bad++; fails.push(`PARSE «${t}»\n   ждали: ${JSON.stringify(exp)}\n   вышло: ${JSON.stringify(got.map(g => { const o = {}; for(const k of ["type","time","min","km","ml","mg","g","srv","neg","negFuture","dayOffset","ask","unknown"]) if(g[k] != null && g[k] !== false) o[k] = g[k]; return o; }))}`); }
}
for(const [t, exp] of NLU){
  const a = RITM.analyze(t); let pass = true;
  if(exp.crisis != null && a.crisis !== exp.crisis) pass = false;
  if(exp.states && JSON.stringify(a.states.map(x=>x.k).sort()) !== JSON.stringify(exp.states.slice().sort())) pass = false;
  if(exp.place && !(a.states[0] && a.states[0].place === exp.place)) pass = false;
  if(exp.small && !exp.small.every(k => a.small.includes(k))) pass = false;
  if(exp.corr !== undefined){ if(exp.corr === null ? a.correction !== null : !(a.correction && Object.entries(exp.corr).every(([k,v]) => a.correction[k] === v))) pass = false; }
  if(exp.topics && !exp.topics.every(k => a.topics.includes(k))) pass = false;
  if(exp.meta && a.meta !== exp.meta) pass = false;
  if(exp.question != null && a.question !== exp.question) pass = false;
  if(pass) ok++; else { bad++; fails.push(`NLU «${t}»\n   ждали: ${JSON.stringify(exp)}\n   вышло: ${JSON.stringify({crisis:a.crisis, states:a.states, small:a.small, corr:a.correction, topics:a.topics, meta:a.meta})}`); }
}
{ const sm = require("./semantic.js"); bad += sm.fails.length; fails.push(...sm.fails); }
{ const c = require("./core.test.js"); ok += c.ok; bad += c.fails.length; fails.push(...c.fails); }
{ const vm = require("vm"), fs = require("fs");   // синтаксис всех файлов интерфейса
  for(const f of ["core.js","parser.js","nlu.js","catalog.js","catalog2.js","catalog3.js","lexicon.js","engine.js","mood.js","dialog.js","embed.js","onto.js","trainlog.js","food.js","food2.js","sw.js"]){ try{ new vm.Script(fs.readFileSync(__dirname + "/../" + f, "utf8"), {filename:f}); ok++; }catch(e){ bad++; fails.push(`SYNTAX ${f}: ${e.message}`); } } }
console.log(fails.join("\n"));
console.log(`\nИтого: ${ok} прошло, ${bad} не прошло из ${ok + bad}`);
require("./stress.js"); require("./food.js"); require("./mood.js"); require("./onto.js"); require("./trainlog_test.js");
{ const cp = require("child_process"); for(const a of [[], ["--noise"]]){ const x = cp.spawnSync(process.execPath, [__dirname + "/gen.js", "8000", ...a], {encoding:"utf8"}); console.log("Генератор" + (a.length ? " с шумом" : "") + ": " + x.stdout.split("\n")[0]); if(x.status) process.exitCode = 1; } }
{ const cp = require("child_process"); console.log("\nСвежие наборы (информационно, не тренируемся на них):");
  for(const f of ["mood_a", "mood_b", "mood_c", "mood_d", "food_unknown", "food_strict", "context"]){ const x = cp.spawnSync(process.execPath, [__dirname + "/fresh/" + f + ".js"], {encoding:"utf8"}); console.log("  " + f + ": " + (x.stdout.match(/\d+\/\d+( \(\d+%\))?/) || ["?"])[0]); } }
process.exit(bad || process.exitCode ? 1 : 0);
