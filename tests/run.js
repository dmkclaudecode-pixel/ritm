// Прогон тестовых фраз: node tests/run.js  (код выхода 1, если что-то сломалось)
const store = {}; global.localStorage = {getItem:k=>store[k]??null, setItem:(k,v)=>store[k]=v};
global.window = global;
require("../catalog.js"); require("../parser.js"); require("../nlu.js");
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
  if(pass) ok++; else { bad++; fails.push(`NLU «${t}»\n   ждали: ${JSON.stringify(exp)}\n   вышло: ${JSON.stringify({crisis:a.crisis, states:a.states, small:a.small, corr:a.correction, topics:a.topics})}`); }
}
console.log(fails.join("\n"));
console.log(`\nИтого: ${ok} прошло, ${bad} не прошло из ${ok + bad}`);
process.exit(bad ? 1 : 0);
