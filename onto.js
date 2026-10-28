// Rhythm · онтология слов и словосочетаний: еда ↔ блюда, глагол ↔ продукт, устойчивые сочетания, плюс связи, выученные у пользователя.
// Данные: data/onto.json (собирается tools/compact_onto.js из конвейеров знаний). Всё локально.
(function(root){
"use strict";
const R = root.RITM = root.RITM || {};
const LKEY = "ritm:onto";               // связи, выученные у пользователя: {слово: {понятие: {n, ctx:{контекст:n}}}}
let D = {food: {}, dish: {}, verbFood: {}, coll: {}, domain: {}, isa: {}}, ready = false;
const st = w => R.engine.stem(String(w).toLowerCase().replace(/ё/g, "е"));
const learned = () => { try{ return JSON.parse(localStorage.getItem(LKEY) || "{}"); }catch(e){ return {}; } };
const save = o => { try{ localStorage.setItem(LKEY, JSON.stringify(o)); }catch(e){} };

function load(url){
  return fetch(url).then(r => r.json()).then(j => { D = Object.assign(D, j); ready = true; return true; }).catch(() => false);
}
function use(data){ D = Object.assign(D, data); ready = true; }

// что это за слово: еда (продукт/блюдо), с основой и подсказками
// тип занятия по области слова (для кнопок «к чему отнести»)
const TYPE_OF = {food: "meal", drink: "meal", produce: "meal", sport: "sport", exercise: "strength", hobby: "hobby"};
function typeHint(word){ const L = lookup(word); return L.domain ? TYPE_OF[L.domain] : (L.isFood ? "meal" : null); }
function lookup(word){
  const k = st(word), f = D.food[k], d = D.dish[k], L = learned()[k];
  const kinds = []; if(f) kinds.push("ingredient"); if(d) kinds.push("dish");
  let concept = null;
  if(L){ const top = Object.entries(L).sort((a, b) => b[1].n - a[1].n)[0]; if(top && top[1].n >= 2) concept = top[0]; }
  const domain = D.domain[k] || null, FOODISH = ["food", "drink", "produce"];
  if(domain && FOODISH.includes(domain) && !kinds.length) kinds.push("food-class");
  return {key: k, kinds, domain, isa: D.isa[k] || [], isFood: kinds.length > 0 || concept === "food", dishes: f ? f.d : [], ingredients: d ? d.i : [],
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
  if(L.domain === "sport" || L.domain === "exercise") return {text: `«${word}» — это спорт или упражнение? Записать как занятие?`, options: ["Да, спорт", "Нет, другое"], concept: L.domain};
  if(L.domain === "hobby") return {text: `«${word}» — это хобби? Записать как занятие?`, options: ["Да, хобби", "Нет, другое"], concept: "hobby"};
  if(L.kinds.includes("food-class")) return {text: `«${word}» — еда или напиток? Записать как приём пищи?`, options: ["Да", "Нет, другое"], concept: "food"};
  return null;
}
// обучение: пользователь подтвердил связь «слово → понятие» (в контексте ctx); в основу попадает после 2 подтверждений
function learn(word, concept, ctx, delta){
  const k = st(word), o = learned(); o[k] = o[k] || {}; const c = o[k][concept] = o[k][concept] || {n: 0, ctx: {}};
  c.n = Math.max(0, c.n + (delta == null ? 1 : delta)); if(ctx) c.ctx[ctx] = (c.ctx[ctx] || 0) + 1;
  save(o); return c.n;
}
const stats = () => ({ready, food: Object.keys(D.food).length, dish: Object.keys(D.dish).length, verbs: Object.keys(D.verbFood).length, coll: Object.keys(D.coll).length});

R.onto = {load, use, lookup, typeHint, dishesFrom, askAbout, learn, stats};
if(typeof module !== "undefined" && module.exports) module.exports = R.onto;
})(typeof window !== "undefined" ? window : globalThis);
