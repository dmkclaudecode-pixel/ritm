// Облачная модель для живого разговора (Groq, бесплатный тариф). Ключ хранится только на телефоне (localStorage), в репозиторий не попадает.
// Всё, что можно проверить без сети (сборка запроса, чистка ответа), — чистые функции; сам запрос — chat().
(function(root){
"use strict";
const R = root.RITM = root.RITM || {};
const URL_ = "https://api.groq.com/openai/v1/chat/completions", MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"], KEY = "ritm:groqKey", OFF = "ritm:llmOff";
const SYSTEM = "Ты — Ритм, добрый собеседник в приложении для распорядка дня. Говори по-русски, на «ты», коротко: одна-три фразы, как друг в мессенджере. " +
  "Если реплика непонятна или оборвана, переспроси одним-двумя словами («Куда?», «Что случилось?»). Поддерживай, не читай нотаций, без списков. " +
  "Не выдумывай факты о человеке. Не ругайся матом. Если человеку плохо или он в опасности, мягко посоветуй близких или службу помощи (в России 112, телефон доверия 8-800-2000-122).\n" +
  "Приложение умеет: записывать сделанное («прогулка 30 минут», «выпил кофе в 9:30», «выпил 2 стакана воды», «спал 7 часов», «вес 72»), планировать («завтра в 18:00 тренировка», «в пятницу бассейн»), показывать («что сегодня?», «что завтра?», «как неделя?»), поправлять («не бегал, а гулял»). Типы занятий: __TYPES__.\n" +
  "Отвечай ТОЛЬКО JSON: {\"say\": \"что сказать человеку\", \"do\": \"команда приложению или пустая строка\"}. " +
  "В do пиши ОДНУ команду простыми словами в формате примеров выше, только если человек ясно сообщает, что что-то сделал или собирается сделать, или просит показать данные. Болтовня, чувства и истории — do пустая. " +
  "Если человек поправляет прошлую запись («не бегал, а гулял») или отвечает на вопрос приложения, повтори его слова как есть в do. Рассказ о расписании и фактах о себе («у меня работа до 16:00», «ты же знаешь, что я учусь») — это разговор, а не запись занятия: do пустая. Когда do не пуста, приложение выполнит её и само подтвердит записью, поэтому в say не пиши, что записал или добавил. Сейчас __NOW__.";
const types = () => { try{ return Object.values(root.RITM.TYPES || {}).map(t => t.short || t.n).join(", "); }catch(e){ return ""; } };
const nowStr = () => { const d = new Date(), p = n => String(n).padStart(2, "0"); return ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"][d.getDay()] + " " + p(d.getDate()) + "." + p(d.getMonth() + 1) + " " + p(d.getHours()) + ":" + p(d.getMinutes()); };
// последние реплики диалога -> сообщения для модели (роли чередуются, пустое выбрасываем)
function buildMessages(turns, text, n){
  const out = []; n = n || 10;
  for(const t of (turns || []).slice(-n)){
    const role = t.role === "bot" ? "assistant" : "user", c = String(t.text || "").trim().slice(0, 500); if(!c) continue;
    if(out.length && out[out.length - 1].role === role) out[out.length - 1].content += " " + c; else out.push({role, content: c});
  }
  while(out.length && out[0].role !== "user") out.shift();
  const last = out[out.length - 1]; if(!last || last.role !== "user" || last.content.indexOf(String(text || "").trim()) < 0) out.push({role: "user", content: String(text || "").trim()});
  return [{role: "system", content: SYSTEM.replace("__TYPES__", types()).replace("__NOW__", nowStr())}, ...out];
}
// ответ модели: обрезаем лишнее, отбрасываем то, что нельзя показывать (ложные «записал», мат, длинные простыни)
const FAKE = /(^|[\s.!])(записал|добавил|занёс|занес|поставил напоминание|напомню|отметил|сохранил)/i, MAT = /(бля|хуй|хуе|пизд|ебал|ебан|сука)/i;
function clean(t){
  t = String(t || "").replace(/<think>[\s\S]*?<\/think>/g, "").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
  if(!t || t.length > 600 || FAKE.test(t) || MAT.test(t) || /[一-鿿]/.test(t)) return null;
  const parts = t.match(/[^.!?…]+[.!?…]*/g) || [t]; t = parts.slice(0, 3).join("").trim();
  return t || null;
}
// ответ модели -> {say, doText}; не-JSON считаем обычной репликой
function parseAnswer(raw){
  let say = String(raw || ""), doText = "";
  try{ const j = JSON.parse(say.slice(say.indexOf("{"), say.lastIndexOf("}") + 1)); say = String(j.say || ""); doText = String(j.do || "").trim(); }catch(e){ /* обычный текст */ }
  if(doText.length > 140 || /[\n{}]/.test(doText)) doText = "";
  return {say: clean(say), doText};
}
const store = { get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set(k, v){ try{ if(v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); }catch(e){ /* хранилище недоступно */ } } };
const getKey = () => store.get(KEY) || "";
const setKey = k => store.set(KEY, k ? String(k).trim() : null);
const enabled = () => !!getKey() && store.get(OFF) !== "1" && (typeof navigator === "undefined" || navigator.onLine !== false);
const setOff = off => store.set(OFF, off ? "1" : null);
let cool = 0;   // после ошибки лимита не стучимся несколько минут
async function chat(turns, text){
  if(!enabled() || Date.now() < cool) return null;
  const messages = buildMessages(turns, text);
  for(const model of MODELS){
    const ac = typeof AbortController !== "undefined" ? new AbortController() : null, to = ac ? setTimeout(() => ac.abort(), 9000) : 0;
    try{
      const r = await fetch(URL_, {method: "POST", signal: ac && ac.signal, headers: {"Content-Type": "application/json", Authorization: "Bearer " + getKey()}, body: JSON.stringify({model, messages, temperature: .6, max_tokens: 220, response_format: {type: "json_object"}})});
      if(to) clearTimeout(to);
      if(r.status === 429){ cool = Date.now() + 120000; continue; }
      if(r.status === 401 || r.status === 403){ cool = Date.now() + 3600000; return null; }
      if(!r.ok) continue;
      const j = await r.json(), a = parseAnswer(j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content);
      if(a.say || a.doText) return a;
    }catch(e){ if(to) clearTimeout(to); }
  }
  return null;
}
R.llm = {buildMessages, clean, parseAnswer, getKey, setKey, enabled, setOff, chat, SYSTEM};
if(typeof module !== "undefined" && module.exports) module.exports = R.llm;
})(typeof window !== "undefined" ? window : globalThis);
