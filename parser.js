// Ритм недели: разбор свободного текста журнала («выпил кофе в 9:30 и в 11:30», «два скупа протеина с водой»).
// Работает без интернета и без ИИ: словарь занятий + правила для чисел, единиц, времени, отрицаний и опечаток.
(function(){
const R = window.RITM;
// нижний регистр, ё→е, «кофеееее»→«кофе», без эмодзи и лишних знаков
// служебные слова (дни, единицы времени): их опечатки чиним по словарю, они однозначны
const SERVICE = ["вчера","позавчера","сегодня","завтра","послезавтра","утром","вечером","ночью","полчаса","получаса","минут","минуты","минуту","часа","часов","полтора","вечера","недели","неделе","понедельник","вторник","среду","четверг","пятницу","субботу","воскресенье"];
// слова-паразиты не несут смысла, но цепляются за короткие алиасы («короче» → «кор», «кстати» → «кс»)
const PARASITE = new Set(["короче","кстати","вроде","наверное","наверно","значит","слушай","вообще","типа","блин","короч","походу","мол","ладно","вобщем"]);
// короткие опечатки, которые нельзя чинить по общему правилу (слишком много ложных срабатываний)
const SHORT = {"вчеа":"вчера","вчра":"вчера","вчре":"вчера","вчер":"вчера","вчеар":"вчера","вчреа":"вчера","мнут":"минут","миут":"минут","минт":"минут","мину":"минут","мниут":"минут","миунт":"минут","сегдня":"сегодня","сгодня":"сегодня","завра":"завтра","зватра":"завтра"};
const fixShort = t => SHORT[t] || t;
const fixToken = t => {
  if(t.length < 5 || /[^а-я]/.test(t) || SERVICE.includes(t)) return t;
  let best = null, bd = 9;
  for(const w of SERVICE){ if(w[0] !== t[0] || Math.abs(w.length - t.length) > 2) continue; const d = dist(t, w); if(d < bd){ bd = d; best = w; } }
  return best && bd <= (t.length >= 7 && best.length >= 7 ? 2 : 1) ? best : t;
};
const norm = s => " " + String(s).toLowerCase().replace(/ё/g,"е").replace(/([а-яa-z])\1{2,}/g,"$1")
  .replace(/[^a-zа-я0-9:.,\-\/+ \n]/g," ").replace(/\s+/g," ").trim().split(" ").filter(t => !PARASITE.has(t)).map(fixToken).map(fixShort).join(" ") + " ";

const NUMW = {"один":1,"одна":1,"одну":1,"одно":1,"два":2,"две":2,"три":3,"четыре":4,"пять":5,"шесть":6,"семь":7,"восемь":8,"девять":9,"десять":10,
  "пару":2,"пара":2,"пары":2,"полтора":1.5,"полторы":1.5,"пол":0.5,"половину":0.5,"двойной":2,"двойная":2,"двойного":2,"тройной":3,
  "пятнадцать":15,"двадцать":20,"тридцать":30,"сорок":40,"пятьдесят":50,"шестьдесят":60,"девяносто":90,"сто":100,"несколько":3,"парочку":2,"парочка":2};
const NUM = "(\\d+(?:[.,]\\d+)?|" + Object.keys(NUMW).sort((a,b)=>b.length-a.length).join("|") + ")";
const toNum = s => s == null ? null : (NUMW[s] != null ? NUMW[s] : parseFloat(String(s).replace(",", ".")));
const isNumTok = t => /^\d/.test(t) || NUMW[t] != null;

const COMPANY_TYPES = {caffeine:["за кофе", 20], meal:["за едой", 45], sweets:["за десертом", 20], alcohol:["за бокалом", 90]};
// занятия, при которых компания не делает запись «общением»
const NO_COMPANY = new Set(["social","work","chores","sleep","other","intimacy"]);
const COMPANY_RE = /(?:^|\s)(?:с|со)\s+(?:коллег\S*|друг\S*|подруг\S*|подруж\S*|мам\S*|пап\S*|жен\S*|муж\S*|девушк\S*|парн\S*|родител\S*|сестр\S*|брат\S*|сын\S*|доч\S*|одногруппник\S*|одноклассник\S*|соседк\S*|сосед\S*|партнер\S*|бабушк\S*|дедушк\S*|начальник\S*|команд\S*|ребят\S*|знаком\S*|колле\S*)|(?:^|\s)(?:у друга|у подруги|к друзьям|в гости|вместе|вдвоем|компанией|всей семьей|всей семьей)(?:\s|$)/;
// теги занятия: у записи одна основная категория, а особенности (глаза, растяжка, шаги, улица) — теги
const TAG_DEFS = [["глаза", /глаз|поморга/], ["растяжка", /растяж|потян|размя|разомн|разминк|стретч/], ["шаги", /шаг|прошел|прошёл|пройд|прогул|ходьб|ног[иа]? размя/], ["улица", /улиц|на воздух|двор|на балкон|парк|скверик/], ["шея", /\bшею|шеи\b|шея\b/], ["вода", /попил воды|стакан воды/]];
function tagsOf(text, type){
  const s = String(text || "").toLowerCase().replace(/ё/g, "е"), out = [];
  for(const [tag, re] of TAG_DEFS) if(re.test(s) && !out.includes(tag)) out.push(tag);
  // тег, совпадающий с основной категорией, не нужен
  if(out.includes("глаза")) out.splice(out.indexOf("растяжка") >= 0 ? out.indexOf("растяжка") : out.length, out.includes("растяжка") ? 1 : 0);
  return out.filter(t => !((t === "растяжка" && type === "mobility") || (t === "шаги" && ["walk","run"].includes(type)) || t === "вода")).slice(0, 4);
}
if(typeof window !== "undefined") window.RITM = Object.assign(window.RITM || {}, {tagsOf});

// единицы: ключ → [тип единицы, множитель]
const UNITS = [
  ["минут|минуты|минуту|минутк[а-я]*|мин|м(?=\\s|$)", "min", 1],
  ["часа|часов|час|ч(?=\\s|$)", "min", 60],
  ["километра|километров|километр|км|кило(?=\\s|$)", "km", 1],
  ["дорожки|дорожек|дорожку|дорожка|бассейна|бассейнов|длины|длин", "lap", 1],
  ["метров|метра|метр", "meter", 1],
  ["шагов|шага|шаг", "steps", 1],
  ["миллилитров|мл", "ml", 1],
  ["литра|литров|литр|литрушк[а-я]*|л(?=\\s|$)", "ml", 1000],
  ["стакана|стаканов|стакан|стаканчик[а-я]*", "glass", 250],
  ["кружки|кружек|кружку|кружка|кружечк[а-я]*|чашки|чашек|чашку|чашка|чашечк[а-я]*", "cup", 300],
  ["бутылки|бутылок|бутылку|бутылка|бутылочк[а-я]*", "bottle", 500],
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

const pad = n => String(n).padStart(2,"0");
const hm = (h,m) => pad(((h%24)+24)%24)+":"+pad(m||0);
const toM = t => +t.slice(0,2)*60 + +t.slice(3,5);
const fromM = m => hm(Math.floor((((m%1440)+1440)%1440)/60), (((m%1440)+1440)%1440)%60);
const ctx = () => R.ctx || {};
const nowStr = () => { if(ctx().now) return ctx().now; const d = new Date(); return hm(d.getHours(), d.getMinutes()); };

// перевод разговорных оборотов в явные числа и время
function pre(s){
  s = s.replace(/полчас[а-я]*/g, " 30 минут ").replace(/часик[а-я]*/g, "час").replace(/(?<![а-я])минутк[а-я]*/g, "минут")
       .replace(/полтора часа/g, " 90 минут ").replace(/пол литра|поллитра|пол-литра/g, " 500 мл ").replace(/четверть часа/g, " 15 минут ");
  // относительное время: «через час», «20 минут назад», «только что», «после работы», «в обед», «перед сном»
  const now = toM(nowStr());
  const rel = (n, unit) => Math.round(toNum(n) * (/час/.test(unit) ? 60 : 1));
  s = s.replace(new RegExp("(?<![а-я])через\\s+" + NUM + "?\\s*(минут[а-я]*|мин|часа|часов|час)", "g"), (m, n, u) => ` в ${fromM(now + rel(n || "1", u))} `);
  s = s.replace(new RegExp("(?<![а-я0-9])" + NUM + "?\\s*(минут[а-я]*|мин|часа|часов|час)\\s+назад", "g"), (m, n, u) => ` в ${fromM(now - rel(n || "1", u))} `);
  s = s.replace(/(?<![а-я])(только что|прямо сейчас|сейчас вот|вот только)(?![а-я])/g, ` в ${nowStr()} `);
  const c = ctx();
  if(c.workEnd) s = s.replace(/(?<![а-я])после работы(?![а-я])/g, ` в ${fromM(toM(c.workEnd) + (c.commute||0) + 30)} `);
  if(c.lunch) s = s.replace(/(?<![а-я])(в обед|на обед|в обеденный перерыв|за обедом)(?![а-я])/g, m => ` в ${c.lunch} ` + (/за обедом/.test(m) ? " обед " : ""));
  if(c.bed) s = s.replace(/(?<![а-я])перед сном(?![а-я])/g, ` в ${fromM(toM(c.bed) - 60)} `);
  if(c.lunch) s = s.replace(/(?<![а-я])(до обеда|перед обедом)(?![а-я])/g, ` в ${fromM(toM(c.lunch) - 90)} `);
  if(c.workStart) s = s.replace(/(?<![а-я])(перед работой|до работы)(?![а-я])/g, ` в ${fromM(toM(c.workStart) - (c.commute||0) - 75)} `);
  s = s.replace(/(?<![а-я])после ужина(?![а-я])/g, " в 20:00 ").replace(/(?<![а-я])в первой половине дня(?![а-я])/g, " в 11:00 ").replace(/(?<![а-я])во второй половине дня(?![а-я])/g, " в 15:00 ");
  if(c.wake) s = s.replace(/(?<![а-я])(с утра пораньше|рано утром)(?![а-я])/g, ` в ${fromM(toM(c.wake) + 20)} `);
  if(c.wake) s = s.replace(/(?<![а-я])(сразу после подъема|как проснулся|как проснулась|после пробуждения)(?![а-я])/g, ` в ${fromM(toM(c.wake) + 15)} `);
  // даты разбирает приложение: из названия их убираем
  s = s.replace(/(?<![а-я])через\s+(\d+|один|одну|два|две|три|четыре|пять|шесть)?\s*(день|дня|дней|неделю|недели)(?![а-я])/g, " ")
       .replace(/(?<![а-я])(на|в|эти|на эти|в эти)\s+выходны[а-я]*(?![а-я])/g, " ").replace(/(?<![а-я])на следующей неделе|на следующую неделю|в конце недели(?![а-я])/g, " ");
  const toks = s.split(" ");
  const ONE = /^(литр|стакан|бутылку|бутылка|чашку|чашка|кружку|кружка|банку|банка|скуп|бокал|подход|круг)$/;
  for(let i=0;i<toks.length;i++) if(ONE.test(toks[i]) && !(i>0 && isNumTok(toks[i-1]))) toks[i] = "1 " + toks[i];
  for(let i=0;i<toks.length;i++) if(toks[i] === "час" && !(i>0 && isNumTok(toks[i-1])) && toks[i-1] !== "в") toks[i] = "60 минут";
  return toks.join(" ").replace(/\s+/g," ");
}

const DAYPART = [["рано утром","07:00"],["с утра","08:30"],["утром","08:30"],["днем","13:00"],["после обеда","14:30"],["вечером","19:30"],["поздно вечером","22:00"],["ночью","00:30"]];

function learned(){ try{ return JSON.parse(localStorage.getItem("ritm:learned")||"{}"); }catch(e){ return {}; } }
function custom(){ try{ return JSON.parse(localStorage.getItem("ritm:custom")||"[]"); }catch(e){ return []; } }

// ядро фразы для запоминания: без чисел, времени, единиц и служебных слов
const FILLER = /(?<![a-zа-я0-9])(выпил[аи]?|попил[аи]?|сделал[аи]?|съел[аи]?|поел[аи]?|был[аи]?|ходил[аи]?|сходил[аи]?|принял[аи]?|потратил[аи]?|провел[аи]?|занимал(?:ся|ась)|утром|днем|вечером|ночью|около|примерно|еще|ещё|потом|затем|сегодня|вчера|позавчера|завтра|послезавтра|будет|буду|будем|собираюсь|собираемся|планирую|пойду|пойдем|поеду|схожу|сходим|хочу|хотим|займусь|понедельник|вторник|среду|среда|четверг|пятницу|пятница|субботу|суббота|воскресенье|немного|чуть|я|мы|что|же|ведь|писал|написал|говорил|сказал|упоминал|кстати|вроде|ну|короче|блин|типа|просто|только|уже|опять|снова|тоже|также)(?![a-zа-я0-9])/g;
function core(text){
  let s = norm(text).replace(/(?<![а-я])через\s+(\d+|один|одну|два|две|три|четыре|пять|шесть)?\s*(день|дня|дней|неделю|недели)(?![а-я])|(?<![а-я])(на|в|эти)\s+(эти\s+)?выходны[а-я]*|на следующей неделе|на следующую неделю|в конце недели/g, " ").replace(/(?<![a-zа-я])в\s*\d{1,2}(?:[:.]\d{2})?(?!\d)/g," ").replace(/(?<![a-zа-я])с\s*\d{1,2}(?:[:.]\d{2})?\s*до\s*\d{1,2}(?:[:.]\d{2})?/g," ");
  s = s.replace(UNIT_RE, " ").replace(new RegExp("(?<![a-zа-я0-9])"+NUM+"(?![a-zа-я0-9])","g")," ").replace(FILLER," ").replace(/(?<![a-zа-я0-9])(в|на|с|и|по|до|за|к|со|о|об|а|но)(?![a-zа-я0-9])/g," ");
  return s.replace(/[^a-zа-я0-9 \-]/g," ").replace(/\s+/g," ").trim();
}

// расстояние Дамерау–Левенштейна (для опечаток)
function dist(a, b){
  const n = a.length, m = b.length; if(Math.abs(n-m) > 2) return 9;
  const d = Array.from({length:n+1}, (_, i) => [i, ...Array(m).fill(0)]); for(let j=1;j<=m;j++) d[0][j] = j;
  for(let i=1;i<=n;i++) for(let j=1;j<=m;j++){
    const c = a[i-1] === b[j-1] ? 0 : 1;
    d[i][j] = Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1]+c);
    if(i>1 && j>1 && a[i-1] === b[j-2] && a[i-2] === b[j-1]) d[i][j] = Math.min(d[i][j], d[i-2][j-2]+1);
  }
  return d[n][m];
}
const esc = a => a.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
// общие слова, по которым тип не ясен: спросим уточнение
const GENERIC_TRAIN = /(?:^|\s)(трениров[а-я]*|тренил[а-я]*|потренил[а-я]*|треня|треньк[а-я]*|трен[еи]|позанимал(?:ся|ась) спорт[а-я]*|занимал(?:ся|ась) спорт[а-я]*|спорт|спортом|физкультур[а-я]*|физр[а-я]*|нагрузк[а-я]*)(?=\s|$)/;
const GENERIC_PLAY = new Set(["поиграл","играл","игра","игру","поиграла","играла","поиграли","играли"]);
const MEALWORD = /^(завтрак|позавтракал|обед|пообедал|ужин|поужинал|перекус|перекусил|листал|листала|скроллил|скролил|залип|втыкал|сидел в телефоне|сидела в телефоне|в телефоне|посидели|играл|поиграл)$/;
const PREFIXES = ["пере","раз","рас","по","про","при","на","за","вы","от","до","у","с"];

const REC = new Map();
const wordRe = a => { let r = REC.get(a); if(!r){ r = new RegExp("(^|[\\s\\-])" + esc(a)); REC.set(a, r); } return r; };
function exactMatch(s){
  let best = null, bestAlias = "";
  const consider = (entry, alias, own) => {
    const a = alias.trim(); if(!a) return;
    if(wordRe(a).test(s)){ const sc = a.length + (own ? 50 : 0) - (MEALWORD.test(a) ? 6 : 0); if(!best || sc > best.score){ best = {entry, type:entry.t, name:entry.n, score:sc}; bestAlias = a; } }
  };
  for(const e of custom()) for(const a of [e.n.toLowerCase(), ...(e.a||"").split("|")]) consider(e, a.replace(/ё/g,"е"), true);
  for(const e of R.CATALOG){ if(!e.x) consider(e, e.n.toLowerCase().replace(/ё/g,"е"), false); for(const a of (e.a||"").split("|")) consider(e, a, false); }
  let tbest = null, tAlias = "";
  for(const [id, t] of Object.entries(R.TYPES)) for(const st of (t.stems||"").split("|")){
    const a = st.trim(); if(!a) continue;
    if(wordRe(a).test(s) && (!tbest || a.length > tbest.score)){ tbest = {entry:null, type:id, name:null, score:a.length}; tAlias = a; }
  }
  let res = best, alias = bestAlias;
  if(best && tbest && tbest.score > best.score + 3 && best.entry && best.entry.t !== tbest.type){ res = tbest; alias = tAlias; }
  if(!res){ res = tbest; alias = tAlias; }
  if(res) res.alias = alias;
  return res;
}
// слова для нечёткого поиска (однословные синонимы и основы)
let FUZZY = null;
function fuzzyIndex(){
  if(FUZZY) return FUZZY;
  FUZZY = [];
  for(const e of R.CATALOG) if(!e.x) for(const a of [e.n.toLowerCase().replace(/ё/g,"е"), ...(e.a||"").split("|")]) if(a && !a.includes(" ") && a.length >= 4) FUZZY.push({a, entry:e, type:e.t});
  for(const [id, t] of Object.entries(R.TYPES)) for(const a of (t.stems||"").split("|")) if(a && !a.includes(" ") && a.length >= 5) FUZZY.push({a, entry:null, type:id});
  return FUZZY;
}
// частые слова, в которых нельзя искать опечатки занятий
const COMMON = new Set("начали начал начала начать начнем начинаем рано рановато пока только никаких никакой никакие ничего нету историй история истории данных данные данными статистика статистики статистику расписание расписании расписания правки правку вносить вносил менять меняй делать сделать сделали время времени дело дела делаю делаем делали работе работы работу работаю сейчас сегодня завтра вчера потом теперь просто очень много мало немного хорошо плохо нормально может можно нужно надо хочу хочется буду будешь было была были есть быть сказал сказала говорю говорил думаю думал кажется понял поняла понятно ясно давай давайте ладно согласен согласна конечно вообще вроде также тоже такой такая такое какой какая какие когда почему зачем потому поэтому если чтобы спасибо привет пожалуйста неделя недели неделю неделе месяц месяца день дней дня часов минут вопрос вопросы ответ ответил ответила смысл смысла пробовал пробую попробую стараюсь получилось получается вышло слишком совсем вместе всегда никогда иногда часто редко сильно правда точно наверное видимо значит короче кстати блин вообщем вобщем вывод выводы выводов выводу судить данные план плана плане планы планом планов планах планирую планировал меняй поменяй измени".split(" "));
const UNIT_WORD = new RegExp("^(?:" + UNITS.map(u=>u[0]).join("|") + ")$");
// слова, в которых пользователь уже говорил «это не занятие» — опечатки в них больше не ищем
function notWords(){ try{ return new Set(JSON.parse(localStorage.getItem("ritm:notWords")||"[]")); }catch(e){ return new Set(); } }
function fuzzyMatch(s){
  const NW = notWords();
  const toks = s.trim().split(" ").filter(t => t.length >= 4 && /^[а-яa-z\-]+$/.test(t) && !COMMON.has(t) && !NW.has(t) && !UNIT_WORD.test(t) && !new RegExp("^(?:" + FILLER.source.replace(/^\(\?<!\[a-zа-я0-9\]\)\(|\)\(\?!\[a-zа-я0-9\]\)$/g,"") + ")$").test(t));
  let best = null;
  for(const tok of toks) for(const f of fuzzyIndex()){
    const a = f.a, lim = a.length >= 6 ? 2 : 1;
    if(a.length < 4) continue;
    const dFull = dist(tok, a), dPref = a.length >= 5 ? Math.min(dist(tok.slice(0, a.length), a), dist(tok.slice(0, a.length + 1), a)) : 9;
    const d = Math.min(dPref, dFull);
    const rel = d / a.length;
    if(d <= lim && d > 0 && (!best || rel < best.rel || (rel === best.rel && a.length > best.a.length))) best = {d, rel, a, entry:f.entry, type:f.type, tok};
  }
  if(!best) return null;
  return {entry:best.entry, type:best.type, name:best.entry ? best.entry.n : null, score:best.a.length - 2, fuzzy:true, alias:best.a, tok:best.tok};
}

// ищем занятие: сначала то, что вы уже объясняли, потом ваши занятия, потом база, потом общие основы, потом без приставок и с опечатками
function findActivity(text){
  const s = norm(text), c = core(text), L = learned();
  if(c && L[c]) return L[c].type === "none" ? {none:true, type:null, score:99, learned:true} : {entry:L[c].entry || null, type:L[c].type, name:L[c].name, score:99, learned:true};
  let res = exactMatch(s);
  if(!res){
    // «поотжимался», «покачался», «пробежался»: пробуем без глагольных приставок
    const stripped = " " + s.trim().split(" ").map(t => { if(COMMON.has(t)) return t; for(const p of PREFIXES) if(t.startsWith(p) && t.length - p.length >= 4) return t.slice(p.length); return t; }).join(" ") + " ";
    if(stripped !== s) res = exactMatch(stripped);
  }
  const fz = (!res || (!res.entry && res.score <= 6)) ? fuzzyMatch(s) : null;
  if(fz && (!res || (fz.entry && fz.alias.length >= 5 && fz.score >= res.score))) res = fz;
  // общие слова без конкретики: «тренировка», «поиграл»
  if(GENERIC_TRAIN.test(s) && (!res || (res.type === "strength" && !res.entry && /трениров|тренил|трен/.test(res.alias||"")))) return {ambiguous:"train", type:null, score:0};
  if(res && res.type === "gaming" && GENERIC_PLAY.has(res.alias) && !/(комп|консол|приставк|плойк|телефон|игру в|steam|стим|доту|онлайн|катк)/.test(s)) return {ambiguous:"play", type:null, score:0};
  return res;
}

function parseTimes(s){
  // «с 21 до 23», «с 21:00 до 23:30»
  const range = /(?:^|\s)(?:с|c|от)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(?:до|-|–)\s*(\d{1,2})(?:[:.](\d{2}))?/.exec(s);
  if(range && +range[1] <= 23 && +range[3] <= 24){
    const a = +range[1]*60 + +(range[2]||0); let b = +range[3]*60 + +(range[4]||0); if(b <= a) b += 1440;
    return {time:hm(+range[1], +(range[2]||0)), dur:b-a, rest:s.replace(range[0]," ")};
  }
  const t = /(?:^|\s)(?:в|к|около|примерно в|где-то в|часов в)\s*(\d{1,2})(?:[:.](\d{2})|\s*(?:часов|часа|час))?(?:\s*(утра|дня|вечера|ночи))?(?=[\s,.;]|$)/.exec(s);
  if(t && +t[1] <= 23){
    let h = +t[1]; const m = +(t[2]||0);
    if(t[3] === "дня" || t[3] === "вечера"){ if(h < 12) h += 12; } else if(t[3] === "ночи" && h === 12) h = 0;
    const unitAfter = new RegExp("^\\s*(" + UNITS.slice(0,1).concat(UNITS.slice(2)).map(u=>u[0]).join("|") + ")").test(s.slice(t.index + t[0].length));
    if(!unitAfter) return {time:hm(h,m), dur:null, rest:s.replace(t[0]," ")};
  }
  for(const [w, v] of DAYPART.slice().sort((a,b)=>b[0].length-a[0].length)) if(s.includes(" "+w+" ")) return {time:v, dur:null, rest:s, approx:true};
  return {time:"", dur:null, rest:s};
}

function parseQty(s){
  const out = [];
  UNIT_RE.lastIndex = 0; let m;
  while((m = UNIT_RE.exec(s))){
    const n = toNum(m[1]); const u = UNITS.find(x => new RegExp("^(?:"+x[0]+")$").test(m[2]));
    if(u && n != null) out.push({n, unit:u[1], mul:u[2]});
  }
  // «два кофе по 250 мл»: число штук при указанном объёме порции
  if(out.length){ const ea = new RegExp("(?:^|\\s)" + NUM + "\\s+(?:[а-яё]+\\s+){0,2}по\\s+\\d").exec(s); if(ea && toNum(ea[1]) != null) out.push({n:toNum(ea[1]), unit:"each", mul:1}); }
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
  { const tg = tagsOf(clause + " " + name, act.type); if(tg.length) out.tags = tg; }
  if(times.approx) out.approx = true;
  if(act.fuzzy) out.fuzzy = true;
  const q = k => qty.find(x=>x.unit===k);
  if(t.unit === "event"){
    out.event = /просну|встал|подъем/.test(clause.toLowerCase().replace(/ё/g,"е")) ? "wake" : "bed";
    out.name = out.event === "wake" ? "Подъём" : "Отбой";
    return out;
  }
  if(t.unit === "min"){
    let min = times.dur;
    const qm = q("min"), qk = q("km"), qs = q("steps"), qset = q("sets"), qp = q("pages"), qe = q("episodes"), qt = q("times");
    if(qm) min = qm.n * qm.mul;
    if(act.type === "swim"){   // плавание: дорожка бассейна = 50 м, «200 м» — метры, а не минуты
      const ql = q("lap"), qmt = q("meter"); let km = null, meters = false;
      if(ql) km = ql.n * 0.05; else if(qmt) km = qmt.n / 1000; else if(qk) km = qk.n;
      else if(qm && qm.mul === 1 && /\d\s*м(?![а-яa-z])/i.test(clause) && !/мин/i.test(clause) && qm.n >= 25){ km = qm.n / 1000; meters = true; }
      else if(min == null && /дорожк/i.test(clause)) km = 0.05;
      if(km != null){ out.km = Math.round(km*1000)/1000; if(meters || min == null || (ql || qmt || qk) && !qm) min = Math.max(1, Math.round(km * (t.kmMin || 27))); }
    } else
    if(qk){ out.km = qk.n; if(min == null) min = Math.round(qk.n * (t.kmMin || 12)); }
    if(qs && act.type === "pause") out.steps = Math.round(qs.n);
    else if(qs){ out.steps = Math.round(qs.n); if(min == null && !qk){ out.stepsOnly = true; out.name = "Шаги"; out.min = 0; return out; } }
    if(qset && min == null){ min = qset.n * 3; out.sets = qset.n; }
    if(qt && act.type === "strength" && min == null){ out.reps = qt.n; }
    if(qp && min == null) min = Math.round(qp.n * 1.5);
    if(qe && min == null) min = Math.round(qe.n * 45);
    out.min = min != null ? Math.round(min) : (e.m || t.def);
    out.minGuess = min == null;
    if(act.type === "pause") out.minGuess = false;
  } else if(t.unit === "ml"){
    let ml = null; const qml = q("ml"), qg = q("glass"), qc = q("cup"), qb = q("bottle"), bare = q("bare");
    if(qml) ml = qml.n * qml.mul * (q("each") ? q("each").n : 1); else if(qg) ml = qg.n * 250; else if(qc) ml = qc.n * 300; else if(qb) ml = qb.n * 500;
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
    if(q("each")) out.srv = q("each").n;
    if(act.type === "caffeine") out.mg = Math.round((e.mg || 90) * out.srv);
    const qgr = q("g"); if(qgr && act.type === "supplements") out.dose = qgr.n + " г";
    const qml = q("ml"); if(qml) out.ml = qml.n * qml.mul * (q("each") ? q("each").n : 1);
  }
  return out;
}
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

// отрицание внутри фразы: «не пошёл в зал», «пропустил пробежку», «без кофе»
const NEG = /(?:^|[\s\-])(?:не|ни разу не|вообще не|совсем не)\s+(?!только|очень|много|мало|долго|сильно|больше|меньше|раньше|позже|забыть|забудь|плохо|хорошо|так)[а-я]+/;
const SKIP = /(?:^|\s)(пропустил[а-я]*|пропущен[а-я]*|отменил[а-я]*|забил[а-я]* на|слил(?:ся|ась)|прогулял[а-я]*|скипнул[а-я]*|отказал(?:ся|ась) от)(?=\s)/;
const WITHOUT = /(?:^|\s)без\s+([а-я]+)/;
const FUT_NEG = /(?:^|\s)не\s+(пойду|буду|будет|успею|смогу|получится|поеду|пойдем|поедем|хочу|собираюсь|планирую)/;

// главный разбор: текст → список записей
function parse(text){
  const out = [];
  let src = String(text);
  // сорвавшиеся и несостоявшиеся планы: это не запись, а пропуск
  src = src.replace(/(?<![а-яё])не\s+(\d+(?:[.,]\d+)?)\s*([а-яё]*)\s*,?\s+а\s+(\d+(?:[.,]\d+)?)(\s*[а-яё]*)/gi, (m, n1, u1, n2, u2) => n2 + (u2.trim() ? u2 : (u1 ? " " + u1 : "")));
  // «хотел 40 минут, а бегал 20» — единицу плана наследует факт без единицы
  src = src.replace(/(?<![а-яё])(?:хотел[аи]?|планировал[аи]?|собирал(?:ся|ась|ись)|думал[аи]?)\s+\d+(?:[.,]\d+)?\s*(минут[а-яё]*|мин|час[а-яё]*|км|километр[а-яё]*)\s*,?\s+(?:а|но)\s+([а-яё]+\s+\d+(?:[.,]\d+)?)(?=\s*(?:[.,!?]|$))/gi, "$2 $1");
  src = src.replace(/(?<![а-яё])(?:хотел[аи]?|планировал[аи]?|собирал(?:ся|ась|ись)|думал[аи]?)\s+\d+(?:[.,]\d+)?\s*[а-яё]*\s*,?\s+а\s+/gi, "");
  src = src.replace(/(?<![а-яё])(?:хотел[аи]?|собирал(?:ся|ась|ись)|планировал[аи]?|думал[аи]?|надеял(?:ся|ась))\s+(.+?)\s*[,—-]?\s*(?:(?:но|а|да)\s+(?:не\s+[а-яё]+|лень|мне\s+лень|передумал[а-я]*|помешал[а-я]*)|(?:но\s+|а\s+|да\s+)?(?:не\s+вышло|не\s+получилось|не\s+срослось|сорвалось|времени\s+не\s+было|не\s+было\s+времени|не\s+хватило\s+времени))(?=[\s.,!?]|$)/gi, "$1 пропустил");
  src = src.replace(/(?<![а-яё])вместо\s+([а-яё]+(?:\s+[а-яё]+)?)\s*,?\s*(?:я\s+)?((?:пошел|пошёл|пошла|сходил[а]?|занялся|занялась|делал[а]?|в итоге|решил[а]?|поехал[а]?)(?![а-яё]).*)/gi, "$1 пропустил. $2");
  src = src.replace(/(?<![а-яё])забыл[аи]?\s+(?:про|о|об)\s+([а-яё]+(?:\s+[а-яё]+)?)/gi, "$1 пропустил").replace(/(?<![а-яё])забыл[аи]?\s+(?!про(?![а-яё])|о(?![а-яё])|об(?![а-яё]))([а-яё]+ть(?:ся)?)(?![а-яё])/gi, "$1 пропустил");
  src = src.replace(/(?<![а-яё])([а-яё]+(?:\s+[а-яё]+)?)\s+(?:сорвал(?:ась|ся|ось)|накрыл(?:ась|ся|ось)|отменил(?:ась|ся|ось|и))(?=[\s.,!?]|$)/gi, "$1 пропустил");
  src = src.replace(/(?<![а-яё])(?:никаких|ни\s+одной|ни\s+одного|ни\s+единой)\s+([а-яё]+)/gi, "не $1");
  src = src.replace(/(?<![а-яё])позавтракать(?![а-яё])/gi, "позавтракал").replace(/(?<![а-яё])пообедать(?![а-яё])/gi, "пообедал").replace(/(?<![а-яё])поужинать(?![а-яё])/gi, "поужинал").replace(/(?<![а-яё])перекусить(?![а-яё])/gi, "перекусил");
  // «кофе с молоком и сахаром» — это кофе, а не сахар отдельно
  src = src.replace(/(?<![а-яё])(с|со|без)\s+(молоком|сахаром|сливками|корицей|сиропом|медом|мёдом|сахарозаменителем|льдом)(\s+и\s+(молоком|сахаром|сливками|корицей|сиропом|медом|мёдом|льдом))?/gi, " ");
  src = src.replace(/так и не/gi, "так-и-не").replace(/(?<![а-яё])и (так|сам|не)(?![а-яё])/gi, m => m);
  const whole = norm(src);
  const msgOffset = /(?:^|\s)позавчера(?=\s)/.test(whole) ? -2 : /(?:^|\s)вчера(?=\s)/.test(whole) ? -1 : 0;
  const parts = src.split(/\n|;|\.(?=\s|$)|,(?!\d)|\s+(?:а\s+)?(?:потом|затем|после этого|еще|ещё|плюс|а также|также)\s+|\s+и\s+|\s+а\s+(?=(?:в|потом|еще|ещё)\s)|\s+(?=(?:встал|встала|проснулся|проснулась)\s+(?:в|около)\s)/i).map(x=>x.trim()).filter(Boolean);
  // «бассейн силовой не будет», «бассейн а силовой не будет» — два занятия в одной фразе
  for(let i = 0; i < parts.length; i++){
    const m = parts[i].match(/^(.*\S)\s+(?:а\s+|но\s+)?([а-яёa-z]+\s+(?:не|ни разу не|вообще не)\s+(?:будет|будут|буду|будем|пойду|пойдем|поеду|поедем|получится|успею|смогу|сделаю|было|был|была)(?:\s.*)?)$/i);
    if(m){ const L = findActivity(pre(norm(m[1]))), Rr = findActivity(pre(norm(m[2]))); if(L && Rr && L.type && Rr.type && !L.ambiguous && !Rr.ambiguous && L.type !== Rr.type) parts.splice(i, 1, m[1].replace(/\s+(а|но)$/i, ""), m[2]); }
  }
  let prev = null;
  for(const raw0 of parts){
    // «нет», «да», «ну», «ок» в начале — ответ на вопрос, а не занятие
    const raw = raw0.replace(/^(?:нет|неа|не-а|да|ага|угу|ну|ок|окей|ладно|хорошо|так|слушай|короче|вообще-то|кстати)(?:[\s,!.—-]+|$)/i, "").trim();
    if(!raw) continue;
    const s = pre(norm(raw));
    const times = parseTimes(s);
    const qty = parseQty(times.rest);
    const negated = NEG.test(s) || SKIP.test(s) || WITHOUT.test(s);
    let act = findActivity(times.rest);
    // «пропустил тренировку», «не смог позаниматься», «никаких тренировок» — несостоявшаяся тренировка вообще
    if(negated && (!act || act.ambiguous === "train" || act.unknownish || (act.type === "chores" && /трениров|тренил|трен(?:я|ь)/.test(s))) && /(?:^|\s)(трениров[а-я]*|тренил[а-я]*|треня|позанимать[а-я]*|позаниматься|заняться спорт[а-я]*|спорт[а-я]*|физкультур[а-я]*)(?=\s|$)/.test(s)){
      const e = {type:"strength", name:"Тренировка", time:times.time, text:raw, neg:true, qty, generic:true};
      if(FUT_NEG.test(s)) e.negFuture = true;
      if(SKIP.test(s)) e.skip = true;
      const off0 = /(?:^|\s)позавчера(?=\s)/.test(s) ? -2 : /(?:^|\s)вчера(?=\s)/.test(s) ? -1 : msgOffset;
      if(off0) e.dayOffset = off0;
      out.push(e); continue;
    }
    if(act && act.none) continue;   // вы уже говорили, что это не занятие
    // «в 11:30» без занятия — повтор предыдущего («кофе в 9:30 и в 11:30»)
    if(!act && prev && (times.time || qty.length) && !core(raw)){
      const rep = {...prev.act};
      const e = buildEntry(rep, prev.clause, times, qty.length ? qty : prev.qty);
      e.text = raw; if(prev.offset) e.dayOffset = prev.offset; out.push(e); continue;
    }
    const offset = /(?:^|\s)позавчера(?=\s)/.test(s) ? -2 : /(?:^|\s)вчера(?=\s)/.test(s) ? -1 : msgOffset;
    if(act && act.ambiguous){
      const e = {type:null, name:cap(core(raw)).slice(0,50) || (act.ambiguous === "train" ? "Тренировка" : "Игра"), time:times.time, text:raw, unknown:true, ask:act.ambiguous, qty};
      const qm = qty.find(x=>x.unit==="min"); if(qm) e.min = qm.n * qm.mul; else if(times.dur) e.min = times.dur;
      if(offset) e.dayOffset = offset; if(negated) e.neg = true;
      out.push(e); continue;
    }
    if(!act){
      if(core(raw)){ const nm = times.rest.replace(UNIT_RE, " ").replace(/(?<![a-zа-я])(выпил[аи]?|сделал[аи]?|съел[аи]?|утром|днем|вечером|ночью|вчера|сегодня)(?![a-zа-я])/g, " ").replace(/\s+/g, " ").trim();
        const e = {type:null, name:cap(nm || core(raw)).slice(0,50), time:times.time, text:raw, unknown:true, qty};
        const qm = qty.find(x=>x.unit==="min"); if(qm) e.min = qm.n * qm.mul;
        if(offset) e.dayOffset = offset; if(negated) e.neg = true;
        out.push(e); }
      continue;
    }
    const e = buildEntry(act, raw, times, qty);
    if(act.learned) e.learned = true;
    if(act.fuzzy){ e.fuzzy = true; e.fuzzyWord = act.tok; e.fuzzyAlias = act.alias; }
    if(offset) e.dayOffset = offset;
    if(negated){ e.neg = true; if(FUT_NEG.test(s)) e.negFuture = true; if(SKIP.test(s)) e.skip = true; }
    if(e.type === "sleep" && !e.time){ prev = null; continue; }
    out.push(e);
    // «протеин с водой», «таблетку запил водой» — плюс вода
    if(!negated && act.type !== "water" && /(?:^|\s)(?:с|со|на|в|запил[а-я]*|разбавил[а-я]*)\s+(\d+(?:[.,]\d+)?)\s*(л|литр[а-я]*|мл|миллилитр[а-я]*)\s+вод/.test(s)){
      const mm = /(?:^|\s)(?:с|со|на|в|запил[а-я]*|разбавил[а-я]*)\s+(\d+(?:[.,]\d+)?)\s*(л|литр[а-я]*|мл|миллилитр[а-я]*)\s+вод/.exec(s);
      const v = parseFloat(mm[1].replace(",", ".")), ml = /^л/.test(mm[2]) ? v * 1000 : v;
      out.push({type:"water", name:"Вода", time:e.time, ml:Math.round(ml), text:raw, derived:true, ...(offset ? {dayOffset:offset} : {})});
    } else if(!negated && act.type !== "water" && /(?:^|\s)(с|со|на|запил[а-я]*)\s+вод/.test(s)){
      const shakes = act.type === "protein" ? 1 : 0;
      const extra = act.type === "protein" ? 300 + Math.max(0, (e.srv||1) - 1) * 100 : 200;
      out.push({type:"water", name:"Вода", time:e.time, ml:shakes ? extra : 200, text:raw, derived:true, ...(offset ? {dayOffset:offset} : {})});
    }
    // «попили кофе с коллегой», «пообедали с друзьями»: это ещё и общение (в цели «общение»), плюс сам напиток или еда
    if(!negated && !act.fuzzy && COMPANY_RE.test(s)){
      const ct = COMPANY_TYPES[act.type], T = R.TYPES[act.type];
      if(ct || (T && T.unit === "min" && !NO_COMPANY.has(act.type))){
        const qmn = qty.find(x=>x.unit==="min"), m = qmn ? qmn.n * qmn.mul : (times.dur != null ? times.dur : (ct ? ct[1] : e.min || T.def));
        out.push({type:"social", name: ct ? "Общение " + ct[0] : "Общение (" + String(e.name || T.short || T.n).toLowerCase() + ")", time:e.time, min:Math.max(1, Math.round(m)), text:raw, derived:true, minGuess:false, ...(offset ? {dayOffset:offset} : {})});
      }
    }
    prev = {act, clause:raw, qty, offset};
  }
  return out;
}

// угадать тип по названию (для своих занятий и новых дел в плане)
function guessType(name){ const a = findActivity(name); return a && a.type ? a.type : null; }

// «это не занятие»: фраза целиком и слово, в котором ошибочно нашлась опечатка
function forget(text, word){
  const c = core(text); if(c){ const L = learned(); L[c] = {type:"none"}; try{ localStorage.setItem("ritm:learned", JSON.stringify(L)); }catch(e){} }
  if(word){ const NW = notWords(); NW.add(word); try{ localStorage.setItem("ritm:notWords", JSON.stringify([...NW])); }catch(e){} }
}
function remember(text, type, name){
  const c = core(text); if(!c) return;
  const L = learned(); L[c] = {type, name}; try{ localStorage.setItem("ritm:learned", JSON.stringify(L)); }catch(e){}
}

R.parse = parse; R.guessType = guessType; R.remember = remember; R.forget = forget; R.core = core; R.findActivity = findActivity; R.norm = norm; R.pre = pre; R.dist = dist;
})();
