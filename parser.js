// Ритм недели: разбор свободного текста журнала («выпил кофе в 9:30 и в 11:30», «два скупа протеина с водой»).
// Работает без интернета и без ИИ: словарь занятий + правила для чисел, единиц и времени.
(function(){
const R = window.RITM;
const norm = s => " " + String(s).toLowerCase().replace(/ё/g,"е").replace(/[«»"“”()!?]/g," ").replace(/\s+/g," ").trim() + " ";

const NUMW = {"один":1,"одна":1,"одну":1,"одно":1,"два":2,"две":2,"три":3,"четыре":4,"пять":5,"шесть":6,"семь":7,"восемь":8,"девять":9,"десять":10,
  "пару":2,"пара":2,"пары":2,"полтора":1.5,"полторы":1.5,"пол":0.5,"половину":0.5,"двойной":2,"двойная":2,"двойного":2,"тройной":3,"пятнадцать":15,"двадцать":20,"тридцать":30,"сорок":40,"пятьдесят":50,"сто":100};
const NUM = "(\\d+(?:[.,]\\d+)?|" + Object.keys(NUMW).sort((a,b)=>b.length-a.length).join("|") + ")";
const toNum = s => s == null ? null : (NUMW[s] != null ? NUMW[s] : parseFloat(String(s).replace(",", ".")));

// единицы: ключ → [тип единицы, множитель]
const UNITS = [
  ["минут|минуты|минуту|мин|м(?=\\s|$)", "min", 1],
  ["часа|часов|час|ч(?=\\s|$)", "min", 60],
  ["километра|километров|километр|км", "km", 1],
  ["шагов|шага|шаг", "steps", 1],
  ["миллилитров|мл", "ml", 1],
  ["литра|литров|литр|л(?=\\s|$)", "ml", 1000],
  ["стакана|стаканов|стакан", "glass", 250],
  ["кружки|кружек|кружку|кружка|чашки|чашек|чашку|чашка", "cup", 300],
  ["бутылки|бутылок|бутылку|бутылка", "bottle", 500],
  ["банки|банок|банку|банка", "can", 1],
  ["скупа|скупов|скупы|скуп|мерные ложки|мерных ложек|мерную ложку|мерная ложка|мерных|мерные|ложки", "scoop", 1],
  ["граммов|грамм|гр|г(?=\\s|$)", "g", 1],
  ["порции|порций|порцию|порция", "srv", 1],
  ["бокала|бокалов|бокал", "srv", 1],
  ["подхода|подходов|подход", "sets", 1],
  ["кругов|круга|круг", "sets", 1],
  ["раза|раз", "times", 1],
  ["страниц|страницы", "pages", 1],
  ["серии|серий|серию", "episodes", 1],
  ["таблетки|таблеток|таблетку|капсулы|капсул|капсулу", "srv", 1],
  ["штуки|штук|шт", "srv", 1]
];
const UNIT_RE = new RegExp("(?<![a-zа-я0-9])" + NUM + "\\s*(?:-?х\\s*)?(" + UNITS.map(u=>u[0]).join("|") + ")", "g");

// «полчаса», «час» без числа → минуты
function pre(s){
  s = s.replace(/полчас[а-я]*/g, " 30 минут ").replace(/часик[а-я]*/g, "час");
  const toks = s.split(" ");
  const ONE = /^(литр|стакан|бутылку|бутылка|чашку|чашка|кружку|кружка|банку|банка|скуп|бокал|подход|круг)$/;
  for(let i=0;i<toks.length;i++) if(ONE.test(toks[i]) && !(i>0 && (/^\d/.test(toks[i-1]) || NUMW[toks[i-1]] != null))) toks[i] = "1 " + toks[i];
  for(let i=0;i<toks.length;i++) if(toks[i] === "час" && !(i>0 && (/^\d/.test(toks[i-1]) || NUMW[toks[i-1]] != null))) toks[i] = "60 минут";
  return toks.join(" ");
}

const DAYPART = [["рано утром","07:00"],["с утра","08:30"],["утром","08:30"],["днем","13:00"],["в обед","13:00"],["после обеда","14:30"],["вечером","19:30"],["перед сном","22:30"],["ночью","00:30"]];
const pad = n => String(n).padStart(2,"0");
const hm = (h,m) => pad(h)+":"+pad(m||0);

function learned(){ try{ return JSON.parse(localStorage.getItem("ritm:learned")||"{}"); }catch(e){ return {}; } }
function custom(){ try{ return JSON.parse(localStorage.getItem("ritm:custom")||"[]"); }catch(e){ return []; } }

// ядро фразы для запоминания: без чисел, времени, единиц и служебных глаголов
const FILLER = /(?<![a-zа-я0-9])(выпил[аи]?|попил[аи]?|сделал[аи]?|съел[аи]?|поел[аи]?|был[аи]?|ходил[аи]?|сходил[аи]?|принял[аи]?|потратил[аи]?|провел[аи]?|занимал(?:ся|ась)|утром|днем|вечером|ночью|около|примерно|еще|ещё|потом|затем|сегодня|завтра|послезавтра|будет|буду|будем|собираюсь|собираемся|планирую|пойду|пойдем|поеду|схожу|сходим|хочу|хотим|займусь|понедельник|вторник|среду|среда|четверг|пятницу|пятница|субботу|суббота|воскресенье|немного|чуть)(?![a-zа-я0-9])/g;
function core(text){
  let s = norm(text).replace(/(?<![a-zа-я])в\s*\d{1,2}(?:[:.]\d{2})?(?!\d)/g," ").replace(/(?<![a-zа-я])с\s*\d{1,2}(?:[:.]\d{2})?\s*до\s*\d{1,2}(?:[:.]\d{2})?/g," ");
  s = s.replace(UNIT_RE, " ").replace(new RegExp("(?<![a-zа-я0-9])"+NUM+"(?![a-zа-я0-9])","g")," ").replace(FILLER," ").replace(/(?<![a-zа-я0-9])(в|на|с|и|по|до|за|к|со|о|об)(?![a-zа-я0-9])/g," ");
  return s.replace(/[^a-zа-я0-9 \-]/g," ").replace(/\s+/g," ").trim();
}

// ищем занятие: сначала то, что вы уже объясняли, потом ваши занятия, потом база, потом общие основы типов
function findActivity(text){
  const s = norm(text), c = core(text), L = learned();
  if(c && L[c]) return {entry:L[c].entry || null, type:L[c].type, name:L[c].name, score:99, learned:true};
  let best = null;
  const consider = (entry, alias, own) => {
    const a = alias.trim(); if(!a) return;
    const re = new RegExp("(^|[\\s\\-])" + a.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"));
    if(re.test(s)){ const sc = a.length + (own ? 50 : 0); if(!best || sc > best.score) best = {entry, type:entry.t, name:entry.n, score:sc}; }
  };
  for(const e of custom()) for(const a of [e.n.toLowerCase(), ...(e.a||"").split("|")]) consider(e, a.replace(/ё/g,"е"), true);
  for(const e of R.CATALOG){ consider(e, e.n.toLowerCase().replace(/ё/g,"е"), false); for(const a of (e.a||"").split("|")) consider(e, a, false); }
  let tbest = null;
  for(const [id, t] of Object.entries(R.TYPES)) for(const st of (t.stems||"").split("|")){
    const a = st.trim(); if(!a) continue;
    if(new RegExp("(^|[\\s\\-])" + a.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).test(s) && (!tbest || a.length > tbest.score)) tbest = {entry:null, type:id, name:null, score:a.length};
  }
  if(best && tbest && tbest.score > best.score + 3 && best.entry && best.entry.t !== tbest.type) return tbest;
  return best || tbest;
}

function parseTimes(s){
  // «с 21 до 23», «с 21:00 до 23:30»
  const range = /(?:^|\s)с\s*(\d{1,2})(?:[:.](\d{2}))?\s*до\s*(\d{1,2})(?:[:.](\d{2}))?/.exec(s);
  if(range){
    const a = +range[1]*60 + +(range[2]||0); let b = +range[3]*60 + +(range[4]||0); if(b <= a) b += 1440;
    return {time:hm(+range[1], +(range[2]||0)), dur:b-a, rest:s.replace(range[0]," ")};
  }
  const t = /(?:^|\s)(?:в|к|около|примерно в)\s*(\d{1,2})(?:[:.](\d{2})|\s*(?:часов|часа|час)(?:\s*(утра|дня|вечера|ночи))?)?(?=[\s,.;]|$)/.exec(s);
  if(t && +t[1] <= 23 && (t[2] || /час/.test(t[0]) || /в\s*\d{1,2}$/.test(t[0].trim()) || /^\s*(в|к|около)/.test(t[0]))){
    let h = +t[1]; const m = +(t[2]||0);
    if(t[3] === "дня" || t[3] === "вечера"){ if(h < 12) h += 12; }
    const unitAfter = new RegExp("^\\s*(" + UNITS.slice(0,1).concat(UNITS.slice(2)).map(u=>u[0]).join("|") + ")").test(s.slice(t.index + t[0].length));
    if(!unitAfter) return {time:hm(h,m), dur:null, rest:s.replace(t[0]," ")};
  }
  for(const [w, v] of DAYPART) if(s.includes(" "+w+" ")) return {time:v, dur:null, rest:s, approx:true};
  return {time:"", dur:null, rest:s};
}

function parseQty(s){
  const out = [];
  UNIT_RE.lastIndex = 0; let m;
  while((m = UNIT_RE.exec(s))){
    const n = toNum(m[1]); const u = UNITS.find(x => new RegExp("^(?:"+x[0]+")$").test(m[2]));
    if(u && n != null) out.push({n, unit:u[1], mul:u[2]});
  }
  // голое число без единицы: «2 кофе», «три яйца»
  if(!out.length){ const b = new RegExp("(?:^|\\s)" + NUM + "(?=\\s|$)").exec(s); if(b) out.push({n:toNum(b[1]), unit:"bare", mul:1}); }
  return out;
}

function buildEntry(act, clause, times, qty){
  const t = R.TYPES[act.type] || R.TYPES.other, e = act.entry || {};
  let name = act.name || e.n;
  if(!name){ const c = core(clause), w0 = (c.split(" ")[0]||""); name = c && c.length > 2 && c.includes(" ") && !/(л|ла|ли|лся|лась|ть|ться)$/.test(w0) ? cap(c).slice(0,40) : (t.short || t.n); }
  if(act.type === "water" && (e.n === "Стакан воды" || e.n === "Бутылка воды" || !e.n)) name = "Вода";
  const out = {type:act.type, name, time:times.time || "", text:clause.trim()};
  const q = k => qty.find(x=>x.unit===k);
  if(t.unit === "event"){
    out.event = /просну|встал|подъем/.test(clause.toLowerCase().replace(/ё/g,"е")) ? "wake" : "bed";
    out.name = out.event === "wake" ? "Подъём" : "Отбой";
    return out;
  }
  if(t.unit === "min"){
    let min = times.dur;
    const qm = q("min"), qk = q("km"), qs = q("steps"), qset = q("sets"), qp = q("pages"), qe = q("episodes");
    if(qm) min = qm.n * qm.mul;
    if(qk){ out.km = qk.n; if(min == null) min = Math.round(qk.n * (t.kmMin || 12)); }
    if(qs){ out.steps = Math.round(qs.n); if(min == null && !qk){ out.stepsOnly = true; out.name = "Шаги"; out.min = 0; return out; } }
    if(qset && min == null) min = qset.n * 3;
    if(qp && min == null) min = Math.round(qp.n * 1.5);
    if(qe && min == null) min = Math.round(qe.n * 45);
    out.min = min != null ? Math.round(min) : (e.m || t.def);
    out.minGuess = min == null;
  } else if(t.unit === "ml"){
    let ml = null; const qml = q("ml"), qg = q("glass"), qc = q("cup"), qb = q("bottle"), bare = q("bare");
    if(qml) ml = qml.n * qml.mul; else if(qg) ml = qg.n * 250; else if(qc) ml = qc.n * 300; else if(qb) ml = qb.n * 500;
    else if(bare) ml = bare.n >= 50 ? bare.n : bare.n * (e.ml || 250);
    out.ml = Math.round(ml != null ? ml : (e.ml || 250));
  } else if(t.unit === "g"){
    let g = null; const qs = q("scoop"), qg = q("g"), bare = q("bare"), qsrv = q("srv");
    if(qs) g = qs.n * 25; else if(qg && act.type === "protein" && qg.n >= 5) g = qg.n * (e.g && e.g < 25 && e.n !== "Протеиновый коктейль" ? 0.15 : 1);
    else if(bare || qsrv) g = (bare||qsrv).n * (e.g || 25);
    out.g = Math.round(g != null ? g : (e.g || 25));
    out.srv = qs ? qs.n : ((bare||qsrv) ? (bare||qsrv).n : 1);
  } else {
    const qq = q("srv") || q("cup") || q("glass") || q("can") || q("bottle") || (act.type !== "supplements" || !q("g") ? q("bare") : null) || q("times");
    out.srv = qq ? qq.n : 1;
    if(act.type === "caffeine") out.mg = Math.round((e.mg || 90) * out.srv);
    const qgr = q("g"); if(qgr && act.type === "supplements") out.dose = qgr.n + " г";
    const qml = q("ml"); if(qml) out.ml = qml.n * qml.mul;
  }
  return out;
}
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

// главный разбор: текст → список записей
function parse(text){
  const out = [];
  const parts = String(text).split(/\n|;|\.(?=\s|$)|,(?!\d)|\s+(?:а\s+)?(?:потом|затем|еще|ещё)\s+|\s+и\s+/i).map(x=>x.trim()).filter(Boolean);
  let prev = null;
  for(const raw of parts){
    const s = pre(norm(raw));
    const times = parseTimes(s);
    const qty = parseQty(times.rest);
    let act = findActivity(times.rest);
    // «в 11:30» без занятия — повтор предыдущего («кофе в 9:30 и в 11:30»)
    if(!act && prev && (times.time || qty.length) && !core(raw)){
      const rep = {...prev.act};
      const e = buildEntry(rep, prev.clause, times, qty.length ? qty : prev.qty);
      e.text = raw; out.push(e); continue;
    }
    if(!act){
      if(core(raw)){ const nm = times.rest.replace(UNIT_RE, " ").replace(/(?<![a-zа-я])(выпил[аи]?|сделал[аи]?|съел[аи]?|утром|днем|вечером|ночью)(?![a-zа-я])/g, " ").replace(/\s+/g, " ").trim();
        out.push({type:null, name:cap(nm || core(raw)).slice(0,50), time:times.time, text:raw, unknown:true, qty}); }
      continue;
    }
    const e = buildEntry(act, raw, times, qty);
    if(act.learned) e.learned = true;
    if(e.type === "sleep" && !e.time){ prev = null; continue; }
    out.push(e);
    // «протеин с водой», «таблетку запил водой» — плюс вода
    if(act.type !== "water" && /(?:^|\s)(с|со|на|запил[а-я]*)\s+вод/.test(s)){
      const shakes = act.type === "protein" ? 1 : 0;
      const extra = act.type === "protein" ? 300 + Math.max(0, (e.srv||1) - 1) * 100 : 200;
      out.push({type:"water", name:"Вода", time:e.time, ml:shakes ? extra : 200, text:raw, derived:true});
    }
    prev = {act, clause:raw, qty};
  }
  return out;
}

// угадать тип по названию (для своих занятий и новых дел в плане)
function guessType(name){ const a = findActivity(name); return a ? a.type : null; }

function remember(text, type, name){
  const c = core(text); if(!c) return;
  const L = learned(); L[c] = {type, name}; try{ localStorage.setItem("ritm:learned", JSON.stringify(L)); }catch(e){}
}

R.parse = parse; R.guessType = guessType; R.remember = remember; R.core = core; R.findActivity = findActivity;
})();
