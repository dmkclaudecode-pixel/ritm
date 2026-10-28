// Rhythm · онтология слов и словосочетаний: еда ↔ блюда, глагол ↔ продукт, устойчивые сочетания, плюс связи, выученные у пользователя.
// Данные: data/onto.json (собирается tools/compact_onto.js из конвейеров знаний). Всё локально.
(function(root){
"use strict";
const R = root.RITM = root.RITM || {};
const LKEY = "ritm:onto";               // связи, выученные у пользователя: {слово: {понятие: {n, ctx:{контекст:n}}}}
let D = {food: {}, dish: {}, verbFood: {}, coll: {}}, ready = false;
const st = w => R.engine.stem(String(w).toLowerCase().replace(/ё/g, "е"));
const learned = () => { try{ return JSON.parse(localStorage.getItem(LKEY) || "{}"); }catch(e){ return {}; } };
const save = o => { try{ localStorage.setItem(LKEY, JSON.stringify(o)); }catch(e){} };

function load(url){
  return fetch(url).then(r => r.json()).then(j => { D = Object.assign(D, j); ready = true; return true; }).catch(() => false);
}
function use(data){ D = Object.assign(D, data); ready = true; }

// что это за слово: еда (продукт/блюдо), с основой и подсказками
function lookup(word){
  const k = st(word), f = D.food[k], d = D.dish[k], L = learned()[k];
  const kinds = []; if(f) kinds.push("ingredient"); if(d) kinds.push("dish");
  let concept = null;
  if(L){ const top = Object.entries(L).sort((a, b) => b[1].n - a[1].n)[0]; if(top && top[1].n >= 2) concept = top[0]; }
  return {key: k, kinds, isFood: kinds.length > 0 || concept === "food", dishes: f ? f.d : [], ingredients: d ? d.i : [],
          verbs: D.verbFood[k] || [], partners: D.coll[k] || [], learned: concept};
}
// блюда, которые можно приготовить из набора продуктов (пересечение по составу)
function dishesFrom(words){
  const keys = words.map(st), scores = {};
  for(const [hk, d] of Object.entries(D.dish)){
    const have = d.i.filter(i => keys.includes(st(i))).length;
    if(have >= Math.min(2, keys.length)) scores[d.w] = have / d.i.length;
  }
  return Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => x[0]);
}
// уточняющий вопрос по незнакомому слову: что о нём известно
function askAbout(word){
  const L = lookup(word);
  if(L.kinds.includes("ingredient")) return {text: `«${word}» — продукт. Ты его ел или готовил из него?`, options: ["Ел", "Готовил", "Купил"], concept: "food"};
  if(L.kinds.includes("dish")) return {text: `«${word}» — это блюдо (${L.ingredients.slice(0, 3).join(", ")}…)? Записать как еду?`, options: ["Да, еда", "Нет, другое"], concept: "food"};
  return null;
}
// обучение: пользователь подтвердил связь «слово → понятие» (в контексте ctx); в основу попадает после 2 подтверждений
function learn(word, concept, ctx, delta){
  const k = st(word), o = learned(); o[k] = o[k] || {}; const c = o[k][concept] = o[k][concept] || {n: 0, ctx: {}};
  c.n = Math.max(0, c.n + (delta == null ? 1 : delta)); if(ctx) c.ctx[ctx] = (c.ctx[ctx] || 0) + 1;
  save(o); return c.n;
}
const stats = () => ({ready, food: Object.keys(D.food).length, dish: Object.keys(D.dish).length, verbs: Object.keys(D.verbFood).length, coll: Object.keys(D.coll).length});

R.onto = {load, use, lookup, dishesFrom, askAbout, learn, stats};
if(typeof module !== "undefined" && module.exports) module.exports = R.onto;
})(typeof window !== "undefined" ? window : globalThis);
