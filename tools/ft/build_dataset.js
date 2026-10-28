// Сборка датасета для дообучения: node tools/ft/build_dataset.js <папка_или_файлы.html> --out data_ft [--names "Аня,Петя"] [--mat keep]
// Читает HTML-экспорт Telegram + золотые диалоги tools/gold/*.txt. Всё считается локально, наружу ничего не уходит.
// Выход: train.jsonl, val.jsonl (формат {"messages":[{role,content},...]}). Файлы test_*.txt в обучение не попадают.
const fs = require("fs"), path = require("path");
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const inputs = args.filter((a, i) => !a.startsWith("--") && !(i && args[i - 1].startsWith("--")));
const out = opt("--out", "data_ft"), keepMat = opt("--mat", "drop") === "keep";
const names = (opt("--names", "") || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
const SYSTEM = "Ты — Ритм, добрый собеседник и помощник по распорядку дня. Отвечай коротко, по-человечески, на «ты». Если не понял, переспроси одним словом. Не выдумывай факты и не говори, что что-то записал, если это не так.";
const MAT = /(бля|хуй|хуя|хуе|хуё|пизд|ебал|ебат|ебан|ебуч|еба[нл]|ёб|сука|суки|пидор|мудак|залуп)/i;

const files = [];
for(const a of inputs){ const st = fs.existsSync(a) && fs.statSync(a); if(!st) continue; if(st.isDirectory()) for(const f of fs.readdirSync(a)) if(/\.html?$/i.test(f)) files.push(path.join(a, f)); else if(/\.html?$/i.test(a)) files.push(a); }

const dec = t => t.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&#x27;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
const scrub = t => {
  t = t.replace(/https?:\/\/\S+|www\.\S+/gi, " ").replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, " ").replace(/@\w{3,}/g, " ")
       .replace(/\+?\d[\d\s().-]{8,}\d/g, " ").replace(/\b\d{1,2}[./]\d{1,2}([./]\d{2,4})?\b/g, " ")
       .replace(/(^|[^а-яё])(ул\.?|улица|проспект|пр-т|переулок|пер\.|бульвар|набережная|дом|д\.|кв\.?|квартира|подъезд|этаж|корпус)\s*\S+(\s+\d+\S*)?/gi, "$1 ").replace(/\s+/g, " ").trim();
  for(const n of names) t = t.replace(new RegExp("(^|[^а-яёa-z])" + n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[а-яёa-z]*", "gi"), "$1");
  t = t.replace(/([а-яёa-z,]\s+)[А-ЯЁA-Z][а-яёa-z]{2,}/g, "$1");
  return t.replace(/\s+/g, " ").trim();
};

// 1) реальные переписки: подряд идущие сообщения одного автора склеиваем в реплику, режем на окна по 6 реплик
const raw = files.sort((a, b) => (+a.match(/(\d+)\.html?$/i)?.[1] || 0) - (+b.match(/(\d+)\.html?$/i)?.[1] || 0)).map(f => fs.readFileSync(f, "utf8")).join("\n");
const turns = []; let from = "";
for(const blk of raw.split(/<div class="message /).slice(1)){
  if(/^service/.test(blk)) continue;
  const f = blk.match(/<div class="from_name">([\s\S]*?)<\/div>/); if(f) from = dec(f[1]).replace(/<span[\s\S]*$/, "").trim().toLowerCase();
  const m = blk.match(/<div class="text">([\s\S]*?)<\/div>/); if(!m) continue;
  const t = scrub(dec(m[1])); if(!t || !/[а-яё]/i.test(t) || t.length > 400) continue;
  const last = turns[turns.length - 1];
  if(last && last.from === from) last.text += ". " + t; else turns.push({from, text: t});
}
const samples = [];
for(let i = 1; i < turns.length; i++){
  const tgt = turns[i]; if(!keepMat && MAT.test(tgt.text)) continue; if(tgt.text.split(" ").length > 40) continue;
  const ctx = turns.slice(Math.max(0, i - 6), i).filter(x => keepMat || !MAT.test(x.text));
  if(!ctx.length || ctx[ctx.length - 1] !== turns[i - 1]) continue;
  const msgs = ctx.map(x => ({role: x.from === tgt.from ? "assistant" : "user", content: x.text}));
  while(msgs.length && msgs[0].role === "assistant") msgs.shift();
  if(!msgs.length) continue;
  samples.push({src: "chat", messages: [{role: "system", content: SYSTEM}, ...msgs, {role: "assistant", content: tgt.text}]});
}

// 2) золотые диалоги (вручную написанные, без test_*): U*-варианты раскрываем
let gold = 0;
const GD = path.join(__dirname, "..", "gold");
for(const f of fs.readdirSync(GD).filter(f => /\.txt$/.test(f) && !/^test_/.test(f))){
  let cur = [];
  const flush = () => { if(cur.length >= 2 && cur[cur.length - 1].role === "assistant"){ samples.push({src: "gold", messages: [{role: "system", content: SYSTEM}, ...cur]}); gold++; } cur = []; };
  for(const ln of fs.readFileSync(path.join(GD, f), "utf8").split(/\r?\n/)){
    if(/^##/.test(ln) || !ln.trim()){ flush(); continue; }
    const m = ln.match(/^(U\*?|B|Q):\s*(.*)$/); if(!m) continue;
    const text = m[2].replace(/\s*\[act=[^\]]*\]\s*$/, "").split(" / ")[0].trim();
    if(m[1] === "Q") cur.push({role: "assistant", content: text}); else cur.push({role: m[1] === "B" ? "assistant" : "user", content: text});
  }
  flush();
}

// 3) перемешиваем (фиксированно), 3% на проверку
let s = 12345; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
samples.sort(() => rnd() - .5);
const nv = Math.max(50, Math.floor(samples.length * .03)), val = samples.slice(0, nv), train = samples.slice(nv);
fs.mkdirSync(out, {recursive: true});
const w = (n, a) => fs.writeFileSync(path.join(out, n), a.map(x => JSON.stringify({messages: x.messages})).join("\n") + "\n");
w("train.jsonl", train); w("val.jsonl", val);
console.log(`реплик в переписках: ${turns.length}; примеров из чата: ${samples.length - gold}; золотых диалогов: ${gold}; train: ${train.length}, val: ${val.length} → ${out}/`);
