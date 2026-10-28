// Тесты разговора: сценарии из нескольких реплик. Проверяем акты, тон, отсутствие повторов и «вопрос в каждой реплике».
global.window = global; global.localStorage = {getItem: () => null, setItem(){}};
require("../engine.js"); require("../mood.js"); require("../dialog.js"); require("../followup.js"); require("../onto.js"); require("../talk.js");
RITM.mood.extend(require("../data/mood_lex.json")); RITM.mood.useModel(require("../data/mood_nb.json"));
const M = RITM.mood, D = RITM.dialog, T = RITM.talk; let ok = 0; const bad = [];
const t = (n, c, i) => { if(c) ok++; else bad.push(n + (i ? " → " + i : "")); };
function run(lines, rnd){
  const ctx = new D.Context(); let k = 0; const r = rnd || (() => (k = (k * 7 + 3) % 10) / 10), out = [];
  for(const line of lines){ const mood = M.analyze(line); ctx.push("user", line, {mood, topic: (T.topicOf(line) || {}).k}); const x = T.reply({text: line, mood, ctx, rnd: r}); ctx.push("bot", x.text, {asked: x.asked, act: x.act}); out.push(x); }
  return out;
}
let o = run(["привет, у меня был тяжёлый день на работе", "ага", "да уж", "начальник опять завалил задачами"]);
t("тема работа удерживается", o[1].topic === "work" && o[2].topic === "work", JSON.stringify(o.map(x => x.topic)));
t("нет двух вопросов подряд", o.every((x, i) => !(i && x.asked && o[i - 1].asked)), JSON.stringify(o.map(x => x.asked)));
o = run(["мне грустно и одиноко", "не хочу никого видеть"]);
t("грусть — без веселья", !/Класс|Ура|Отлично|Супер/.test(o[0].text), o[0].text);
o = run(["ура, всё получилось!!!"]);
t("радость — без сочувствия", !/жаль|тяжело|Понимаю, бывает/.test(o[0].text), o[0].text);
o = run(["я ничтожество, всё порчу"]);
t("самоуничижение: поддержка, не согласие", o[0].act === "selfneg" && !/(ты|Ты) (и правда|действительно) /.test(o[0].text), o[0].text);
o = run(["а ты?"]); t("встречный вопрос", o[0].act === "andyou");
o = run(["ты умеешь думать?"]); t("вопрос о боте: честно про ограничения", o[0].act === "botq" && /не человек|приложение/.test(o[0].text));
o = run(["что делать, я совсем вымотался"]); t("совет по состоянию", o[0].act === "advice", o[0].act);
o = run(["вчера ходили с друзьями в кино и потом гуляли до ночи"]); t("рассказ о событии: признание + вопрос про тему", o[0].act === "event" && o[0].asked, o[0].text);
o = run(["понятно"]); t("короткая реплика без темы", !o[0].asked);
// много реплик: повторов быстро не бывает
const many = run(["сегодня на работе всё нормально", "ага", "ладно", "ну да", "в целом день как день", "ясно", "ничего особенного", "угу", "да вот так", "ок"]);
const texts = many.map(x => x.text), uniq = new Set(texts).size;
t("мало повторов в длинной беседе", uniq >= texts.length - 3, uniq + "/" + texts.length);
t("не больше 2 вопросов из 4 подряд", many.every((_, i) => i < 3 || many.slice(i - 3, i + 1).filter(x => x.asked).length <= 2));
// --- второй блок: вопросы к боту, определения, мета-вопросы, режим беседы
{
  const lines = ["расскажи что-нибудь", "что конкретно ты не понял?"];
  const o2 = run(["непонятная фраза про штуку", "что конкретно ты не понял?"]);
  t("мета-вопрос ссылается на прошлую реплику", o2[1].act === "meta" && /непонятная фраза/.test(o2[1].text), o2[1].text);
  RITM.onto.use(require("../data/onto.json"));
  const o3 = run(["что такое шарлотка?", "что конкретно ты не понял?"]); t("мета после ответа: «я ответил»", /Я ответил на/.test(o3[1].text), o3[1].text);
  const o4 = run(["как ты думаешь, будет ли завтра дождь?"]); t("прогноз — не выдумываем", /прогноз/.test(o4[0].text), o4[0].text);
  let q = run(["что такое шарлотка?"]); t("определение блюда", q[0].act === "define" && /(блюдо|десерт|еда)/.test(q[0].text), q[0].text);
  q = run(["из чего делают борщ?"]); t("состав блюда", q[0].act === "define" && /(капуст|картофел|свёкл|свекл)/.test(q[0].text), q[0].text);
  q = run(["что можно приготовить из творога?"]); t("блюда из продукта", q[0].act === "define" && /сырник/.test(q[0].text), q[0].text);
  q = run(["что такое флимбостер?"]); t("честно про незнакомое", q[0].act === "define" && /нет данных/.test(q[0].text), q[0].text);
  q = run(["а что можно приготовить из яблок?"]); t("с «а» в начале", q[0].act === "define", q[0].act);
  q = run(["у меня сегодня странное настроение"]); t("неясное настроение — уточняем, не празднуем", q[0].act === "vague" && !/Отлично|Супер/.test(q[0].text), q[0].text);
  t("погодный вопрос — не про бота", !T.direct("как ты думаешь, будет ли завтра дождь?"));
  q = run(["кто победит в чемпионате мира, как считаешь?"]); t("вопрос вне компетенции — честно", /не|нет/.test(q[0].text) && q[0].asked, q[0].text);
}
// --- третий блок: темы и память о близких
{
  const mem2 = {}; const keep = global.localStorage; global.localStorage = {getItem: k => mem2[k] || null, setItem(k, v){ mem2[k] = v; }};
  T.learnFacts("У нас кот Барсик, а сын Ваня ходит в садик"); T.learnFacts("я работаю программистом, уже пять лет");
  t("факты: питомец и родные", T.facts().pets[0].name === "Барсик" && T.facts().rel.some(r => r.name === "Ваня") && /программист/.test(T.facts().job), JSON.stringify(T.facts()));
  let q = run(["вчера гуляли с котом на улице"]); t("питомец по имени", /Барсик/.test(q[0].text), q[0].text);
  q = run(["вечером ходили в кино на новый фильм"]); t("кино: тема и реакция", q[0].topic === "cinema" && q[0].asked, q[0].text);
  q = run(["все выходные собираюсь в горы поехать"]); t("поездка важнее выходных", q[0].topic === "travel", q[0].topic);
  q = run(["был у стоматолога, сделали пломбу"]); t("врач", q[0].topic === "medical", q[0].topic);
  q = run(["слушал плейлист любимой группы весь день"]); t("музыка", q[0].topic === "music", q[0].topic);
  T.TOPICS.forEach(x => { if(!x.q.length) bad.push("пустые вопросы: " + x.k); });
  global.localStorage = keep;
}
// --- третий блок: ответ на ответ (followup.js)
{
  const F = RITM.followup;
  const seq = (pairs) => { const ctx = new D.Context(); let k = 0; const rnd = () => (k = (k * 7 + 3) % 10) / 10, out = [];
    for(const [who, line] of pairs){ if(who === "B"){ ctx.push("bot", line, {asked: /\?\s*$/.test(line), act: "question"}); continue; }
      const mood = M.analyze(line); ctx.push("user", line, {mood, topic: (T.topicOf(line) || {}).k}); const x = T.reply({text: line, mood, ctx, rnd}); ctx.push("bot", x.text, {asked: x.asked, act: x.act}); out.push(x); }
    return out; };
  t("тип вопроса: срок", F.qKind("Сколько удалось поспать?") === "amount");
  t("тип вопроса: предложение", F.qKind("Поставить в план на завтра?") === "offer");
  t("тип вопроса: выбор", F.qKind("Хочется чего-то активного или спокойного?") === "choice");
  t("тип вопроса: причина", F.qKind("Что вымотало?") === "what");
  t("тип вопроса: самочувствие", F.qKind("Как себя чувствуешь?") === "feeling");
  t("часы: пять часов", F.hours("часов пять") === 5 && F.hours("2 дня") === 48 && F.hours("недели две") === 336 && F.hours("полчаса") === .5);
  t("ответ: да/нет", F.answerKind("да, давай") === "yes" && F.answerKind("не хочу") === "no" && F.answerKind("пять часов") === "content");
  let o = seq([["B", "Тяжёлое утро. Сколько удалось поспать?"], ["U", "часов пять"]]);
  t("сон 5 часов: оценка, не «продолжай»", /мало/i.test(o[0].text) && !/Продолжай|Слушаю/.test(o[0].text), o[0].text);
  o = seq([["B", "Поставить в план на завтра?"], ["U", "да, давай"]]); t("согласие на предложение", o[0].intent === "accept", JSON.stringify(o[0]));
  o = seq([["B", "Поставить в план на завтра?"], ["U", "нет, не надо"]]); t("отказ от предложения", o[0].intent === "decline", JSON.stringify(o[0]));
  o = seq([["B", "Неприятно. Давно болит?"], ["U", "три дня"]]); t("боль три дня: совет к врачу", /врач/.test(o[0].text), o[0].text);
  o = seq([["B", "Ты сейчас в безопасности?"], ["U", "не знаю"]]); t("«не знаю» в вопросе о безопасности: линия помощи", /112|8-800/.test(o[0].text), o[0].text);
  o = seq([["B", "Что тревожит больше — вопросы или результат?"], ["U", "результат"]]); t("выбор из двух", /результат/i.test(o[0].text), o[0].text);
  o = seq([["B", "Что на работе сейчас самое важное?"], ["U", "дедлайн по отчёту"]]); t("ответ на открытый вопрос признаём", (o[0].act === "ack" || o[0].act === "mood") && !/Продолжай/.test(o[0].text), o[0].text);
  o = seq([["B", "Как ты сегодня?"], ["U", "паршиво"]]); t("плохо — поддержка, не «отлично»", !/Отлично|Здорово/.test(o[0].text), o[0].text);
  o = seq([["B", "Как день?"], ["U", "а ты как?"]]); t("встречный вопрос не глотаем", o[0].act === "andyou" || o[0].act === "whatsup", o[0].act);
  { const ctx = new D.Context(); ctx.push("user", "на работе опять завал", {mood: M.analyze("на работе опять завал"), topic: "work"});
    const x = T.reply({text: "уже вторую неделю", mood: M.analyze("уже вторую неделю"), ctx, span: true, rnd: () => .1});
    t("срок без вопроса бота: реакция по теме", /многовато|не первый/.test(x.text), x.text); }
  // длинная беседа из ответов: не больше одного вопроса подряд
  o = seq([["B", "Что смотрел?"], ["U", "сериал"], ["U", "про врачей"], ["U", "ну так"], ["U", "ага"]]);
  t("подряд вопросов не больше одного", o.every((x, i) => !(i && x.asked && o[i - 1].asked)), JSON.stringify(o.map(x => x.asked)));
}
console.log(`разговор (2): ${ok} ок всего, ${bad.length} ошибок`); bad.forEach(b => console.log("  ✗ " + b)); if(bad.length) process.exitCode = 1;
