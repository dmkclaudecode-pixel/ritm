// Тесты чистой логики (core.js): цели в процентах по минутам, аэробика, микро-перерывы
const core = require("../core.js");
let ok = 0; const fails = [];
const eq = (name, got, exp) => { if(JSON.stringify(got) === JSON.stringify(exp)) ok++; else fails.push(`CORE ${name}: ждали ${JSON.stringify(exp)}, вышло ${JSON.stringify(got)}`); };
const DEF = {social:60, swim:45, strength:60, walk:30};
const env = (goals) => ({goals, cats:Object.keys(goals), def:c => DEF[c], defaultMin: it => it.m || DEF[it.cat]});
const week = (items, logs) => ({items, days:{0:{log:logs||[]}}});

// быстрый разговор и долгая встреча — не одно и то же
let g = core.goalState(week([], [{type:"social", min:5}]), 3, env({social:2})).social;
eq("5 минут общения", [g.doneMin, g.goalMin, g.pct], [5, 120, 4]);
g = core.goalState(week([], [{type:"social", min:80}]), 3, env({social:2})).social;
eq("80 минут общения", [g.doneMin, g.pct], [80, 67]);
// потолок на одно занятие: 1,5 нормы
g = core.goalState(week([], [{type:"social", min:300}]), 3, env({social:2})).social;
eq("кап 1.5 нормы", g.doneMin, 90);
// одна дорожка в бассейне — 1 минута, а не «тренировка»
g = core.goalState(week([], [{type:"swim", min:1, km:0.05}]), 3, env({swim:1})).swim;
eq("одна дорожка", [g.doneMin, g.pct, g.deficit > 0], [1, 2, true]);
// запланированное считается по плановым минутам, пока нет реальных
g = core.goalState(week([{id:"a", cat:"strength", day:5, done:false}]), 3, env({strength:2})).strength;
eq("план", [g.doneMin, g.futureMin, g.leftMin, g.pctPlan], [0, 60, 60, 50]);
// выполненный пункт плана берёт реальные минуты из связанной записи
g = core.goalState(week([{id:"a", cat:"walk", day:1, done:true}], [{type:"walk", min:15, plan:"a"}]), 3, env({walk:1})).walk;
eq("связанная запись", [g.doneMin, g.pct], [15, 50]);
// пропущенное не засчитывается
g = core.goalState(week([{id:"a", cat:"walk", day:1, done:false}]), 3, env({walk:1})).walk;
eq("пропуск", [g.doneMin, g.missed], [0, 1]);
// отрицание («не ходил») не даёт процентов
g = core.goalState(week([], [{type:"walk", min:30, neg:true}]), 3, env({walk:1})).walk;
eq("отрицание", g.doneMin, 0);

// микро-перерывы
const wk = {items:[], days:{0:{log:[{type:"pause", tags:["глаза"]},{type:"pause", tags:["глаза","шаги"]}]}, 1:{log:[{type:"pause", tags:["глаза"]}]}}};
const b = core.breakStats(wk, 1);
eq("перерывов", [b.total, b.wd, b.perWorkday, b.top[0]], [3, 2, 1.5, ["глаза", 3]]);
eq("перерывы не в целях", Object.keys(core.goalState(wk, 1, env({walk:1}))), ["walk"]);
eq("round", [core.roundMin(7), core.roundMin(43)], [7, 45]);

module.exports = {ok, fails};
