// Rhythm · журнал для обучения: на телефоне копится «фраза → как поняли → что исправил пользователь». Ничего не отправляется.
// Хранится в localStorage под ключом ritm:trainlog (попадает в резервную копию); последние MAX записей.
(function(root){
"use strict";
const R = root.RITM = root.RITM || {};
const KEY = "ritm:trainlog", MAX = 3000;
const rd = () => { try{ return JSON.parse(localStorage.getItem(KEY) || "[]"); }catch(e){ return []; } };
const wr = a => { try{ localStorage.setItem(KEY, JSON.stringify(a.slice(-MAX))); return true; }catch(e){ return false; } };
const day = () => new Date().toISOString().slice(0, 10);
// phrase: исходный текст; info: {types:[...], mood:"sad", intent:"log|query|chat|unknown"}
function record(text, info){
  const t = String(text || "").trim().slice(0, 300); if(!t) return;
  const a = rd(); a.push({d: day(), t, i: info || {}}); wr(a);
}
// пользователь поправил/выбрал: последнему похожему тексту ставим метку (источник «правды» для обучения)
function label(text, kind, value){
  const t = String(text || "").trim().slice(0, 300); if(!t) return;
  const a = rd(); let k = a.length - 1;
  while(k >= 0 && a[k].t !== t) k--;
  if(k < 0){ a.push({d: day(), t, i: {}}); k = a.length - 1; }
  (a[k].y = a[k].y || {})[kind] = value; wr(a);
}
const all = rd;
const stats = () => { const a = rd(); return {n: a.length, labeled: a.filter(x => x.y).length}; };
// выгрузка для обучения: строки JSONL
const exportJsonl = () => rd().map(x => JSON.stringify(x)).join("\n");
const clear = () => { try{ localStorage.removeItem(KEY); }catch(e){} };
R.trainlog = {record, label, all, stats, exportJsonl, clear};
if(typeof module !== "undefined" && module.exports) module.exports = R.trainlog;
})(typeof window !== "undefined" ? window : globalThis);
