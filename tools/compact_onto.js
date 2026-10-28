#!/usr/bin/env node
// Сжимает результаты конвейеров (corpora-data, knowledge-data) в data/onto.json для приложения.
// Использование: node tools/compact_onto.js <папка с recipes.json, collocations.json …> [выход]
const fs = require("fs"), path = require("path");
global.window = global; require("../engine.js");
const stem = RITM.engine.stem, dir = process.argv[2] || "/tmp/cd", out = process.argv[3] || path.join(__dirname, "../data/onto.json");
const rd = f => { try{ return JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); }catch(e){ return null; } };
const onto = {v: 1, food: {}, dish: {}, verbFood: {}, coll: {}};
const rec = rd("recipes.json");
if(rec){
  const real = new Set(Object.keys(rec.dish_ingredients));                     // настоящие блюда: ≥8 рецептов с таким названием
  const bad = /тест|банк|фото|рецепт|вкусн|быстр|простой|домашн/;
  for(const [ing, dishes] of Object.entries(rec.ingredient_dishes)){
    const ds = dishes.filter(d => d !== ing && real.has(d) && d.split(" ").length <= 3 && !bad.test(d)).slice(0, 5);
    if(ds.length) onto.food[stem(ing)] = {w: ing, d: ds};
  }
  // обратная связь: ингредиент → блюда, где он среди главных (по порядку в списке), короткие названия важнее
  const inv = {};
  for(const [dish, ings] of Object.entries(rec.dish_ingredients)){
    if(dish.split(" ").length > 2 || bad.test(dish)) continue;
    ings.slice(0, 4).forEach((ing, pos) => { (inv[ing] = inv[ing] || []).push([dish, 1 / (pos + 1) / dish.split(" ").length]); });
  }
  for(const [ing, arr] of Object.entries(inv)){
    const k = stem(ing); if(ing.length < 3) continue;
    const cur = onto.food[k] || {w: ing, d: []};
    const add = arr.sort((a, b) => b[1] - a[1]).map(x => x[0]).filter(d => d !== ing && !cur.d.includes(d));
    cur.d = cur.d.concat(add).slice(0, 6); if(cur.d.length) onto.food[k] = cur;
  }
  for(const [dish, ings] of Object.entries(rec.dish_ingredients)){
    if(dish.split(" ").length > 2 || bad.test(dish)) continue;
    const head = dish.split(" ")[0]; if(head.length < 4) continue; const old = onto.dish[stem(head)]; if(old && old.w.length <= dish.length) continue;
    onto.dish[stem(head)] = {w: dish, i: ings.slice(0, 6)};
  }
  const vf = {};
  for(const [v, f, c] of rec.verb_food){ if(c < 15) continue; (vf[stem(f)] = vf[stem(f)] || []).push(v); }
  for(const [k, vs] of Object.entries(vf)) onto.verbFood[k] = [...new Set(vs)].slice(0, 5);
}
const col = rd("collocations.json");
if(col) for(const [a, b, c, p] of col){ if(c < 10 || p < 1.5) continue; (onto.coll[stem(a)] = onto.coll[stem(a)] || []).push([b, c]); }
for(const k of Object.keys(onto.coll)) onto.coll[k] = onto.coll[k].sort((x, y) => y[1] - x[1]).slice(0, 6).map(x => x[0]);

// ---- Wikidata / ConceptNet / RuWordNet: «что это за вещь» (isa) и область (domain), синонимы ----
const wd = rd("wikidata.json"), cn = rd("conceptnet.json"), rw = rd("ruwordnet.json");
const vocabSet = (() => { try{ return new Set(fs.readFileSync(path.join(__dirname, "../data/emb_vocab.txt"), "utf8").split("\n")); }catch(e){ return new Set(); } })();
const DOMAINS = {
  food:     ["еда", "блюдо", "продукт питания", "пищевой продукт", "кулинарное изделие", "десерт", "суп", "выпечка", "закуска", "салат", "каша", "мучное изделие", "кондитерское изделие"],
  drink:    ["напиток", "питье", "алкогольный напиток", "безалкогольный напиток", "горячий напиток"],
  produce:  ["фрукт", "овощ", "ягода", "плод", "зелень", "гриб", "орех", "злак", "специя", "приправа"],
  sport:    ["спорт", "вид спорта", "игровой вид спорта", "командный вид спорта", "единоборство", "водный спорт", "зимний спорт"],
  exercise: ["физическое упражнение", "упражнение", "тренировка", "гимнастика", "йога"],
  hobby:    ["хобби", "увлечение", "рукоделие", "коллекционирование"]
};
const D2 = {}; for(const [d, ws] of Object.entries(DOMAINS)) for(const w of ws) D2[w] = d;
const parents = {};                                            // слово → родительские понятия из всех источников
const addP = (w, p) => { w = String(w).toLowerCase(); p = String(p).toLowerCase(); if(w && p && w !== p) (parents[w] = parents[w] || new Set()).add(p); };
if(wd) for(const [w, ps] of Object.entries(wd.classes || {})) for(const p of ps) addP(w, p);
if(cn) for(const [w, r] of Object.entries(cn)) for(const [x] of (r.IsA || [])) addP(w, x);
if(rw) for(const [w, r] of Object.entries(rw)) for(const x of (r.hyper || [])) addP(w, x);
const memo = {};
function domainOf(w, depth = 0, seen = new Set()){
  if(memo[w] !== undefined) return memo[w];
  if(D2[w]) return D2[w];
  if(depth > 5 || seen.has(w)) return null; seen.add(w);
  let res = null;
  for(const p of (parents[w] || [])){ const d = domainOf(p, depth + 1, seen); if(d){ res = d; break; } }
  if(depth === 0) memo[w] = res; return res;
}
onto.domain = {}; onto.isa = {};  // синонимы из ConceptNet шумные (другие значения слова), в данные не включаем
for(const w of Object.keys(parents)){
  if(w.includes(" ") || w.length < 3) continue;
  const d = domainOf(w); if(d) onto.domain[stem(w)] = d;
  if(vocabSet.has(w)){ const ps = [...parents[w]].filter(x => x.split(" ").length <= 2).slice(0, 3); if(ps.length) onto.isa[stem(w)] = ps; }
}
fs.mkdirSync(path.dirname(out), {recursive: true}); fs.writeFileSync(out, JSON.stringify(onto));
console.log(`domain ${Object.keys(onto.domain).length}, isa ${Object.keys(onto.isa).length}; food ${Object.keys(onto.food).length}, dish ${Object.keys(onto.dish).length}, verbFood ${Object.keys(onto.verbFood).length}, coll ${Object.keys(onto.coll).length}; ${Math.round(fs.statSync(out).size/1024)} КБ`);
