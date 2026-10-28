#!/usr/bin/env node
// Локальная подготовка своих реплик из экспорта мессенджера. Ничего не отправляет в сеть.
//   node tools/chat_anon.js <экспорт> --me "Твоё Имя в чате" [--out my_phrases.txt] [--max 800]
// Поддерживает: Telegram (result.json или messages*.html из «Экспорт истории чатов»), WhatsApp (txt «Экспорт чата»).
// Оставляет ТОЛЬКО твои реплики. Заменяет телефоны, e-mail, ссылки, номера карт и длинные числа, @ники, даты, адреса-подсказки, имена из списка --names и слова с заглавной в середине фразы.
// Выход: по одной фразе в строке. Просмотри файл глазами и убери всё лишнее, прежде чем кому-то показывать.
const fs = require("fs");
const args = process.argv.slice(2), file = args[0];
const opt = k => { const i = args.indexOf(k); return i > 0 ? args[i + 1] : null; };
if(!file || !opt("--me")){ console.error('Использование: node tools/chat_anon.js экспорт.json --me "Имя в чате" [--names "Аня,Петя,Саша"] [--out my_phrases.txt] [--max 800]'); process.exit(1); }
const me = opt("--me").toLowerCase(), out = opt("--out") || "my_phrases.txt", max = +(opt("--max") || 800);
const names = (opt("--names") || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
const raw = fs.readFileSync(file, "utf8");
let msgs = [];
if(/<div class="message /.test(raw)){                               // Telegram HTML (messages.html, messages2.html …)
  const dec = t => t.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&#x27;|&apos;/g, "'")
                    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
  let from = "";
  for(const blk of raw.split(/<div class="message /).slice(1)){
    if(/^service/.test(blk)) continue;
    const f = blk.match(/<div class="from_name">([\s\S]*?)<\/div>/); if(f) from = dec(f[1]).trim().toLowerCase();
    if(!from.includes(me)) continue;
    const t = blk.match(/<div class="text">([\s\S]*?)<\/div>/);
    if(t && dec(t[1]).trim()) msgs.push(dec(t[1]));
  }
} else if(/^\s*[{[]/.test(raw)){                                           // Telegram JSON
  const j = JSON.parse(raw), chats = j.chats ? j.chats.list : [j];
  for(const c of chats) for(const m of c.messages || []){
    if(m.type !== "message") continue;
    const from = String(m.from || "").toLowerCase(); if(!from.includes(me)) continue;
    const t = Array.isArray(m.text) ? m.text.map(x => typeof x === "string" ? x : x.text || "").join("") : String(m.text || "");
    if(t.trim()) msgs.push(t);
  }
} else {                                                              // WhatsApp txt: «12.03.2025, 14:05 - Имя: текст» (или с квадратными скобками)
  const re = /^\[?\d{1,2}[./]\d{1,2}[./]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\]?\s*[-–]?\s*([^:]+?):\s(.*)$/;
  let cur = null;
  for(const ln of raw.split(/\r?\n/)){
    const m = ln.match(re);
    if(m){ if(cur) msgs.push(cur.t); cur = m[1].toLowerCase().includes(me) ? {t: m[2]} : null; }
    else if(cur) cur.t += " " + ln;
  }
  if(cur) msgs.push(cur.t);
}
const scrub = t => {
  t = t.replace(/https?:\/\/\S+|www\.\S+/gi, " ")
       .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, " ")
       .replace(/@\w{3,}/g, " ")
       .replace(/\+?\d[\d\s().-]{8,}\d/g, " ")                   // телефоны, карты, длинные числа
       .replace(/\b\d{1,2}[./]\d{1,2}([./]\d{2,4})?\b/g, " ")      // даты
       .replace(/(^|[^а-яё])(ул\.?|улица|проспект|пр-т|переулок|пер\.|бульвар|набережная|дом|д\.|кв\.?|квартира|подъезд|этаж|корпус)\s*\S+(\s+\d+\S*)?/gi, "$1 ")
       .replace(/\s+/g, " ").trim();
  for(const n of names) if(n) t = t.replace(new RegExp("(^|[^а-яёa-z])" + n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[а-яёa-z]*", "gi"), "$1");
  t = t.replace(/([а-яёa-z,]\s+)[А-ЯЁA-Z][а-яёa-z]{2,}/g, "$1");  // слова с заглавной внутри фразы — вероятные имена и названия
  return t.replace(/\s+/g, " ").trim();
};
const keep = msgs.map(scrub).filter(t => t.split(" ").length >= 2 && t.length <= 300 && /[а-яё]/i.test(t));
const uniq = [...new Set(keep)];
const pick = uniq.length > max ? uniq.sort(() => Math.random() - .5).slice(0, max) : uniq;
fs.writeFileSync(out, pick.join("\n") + "\n");
console.log(`твоих сообщений: ${msgs.length}; после очистки: ${uniq.length}; записано: ${pick.length} → ${out}`);
console.log("Открой файл и просмотри. Удали всё, что не хочешь показывать. Файл не отправляется никуда автоматически.");
