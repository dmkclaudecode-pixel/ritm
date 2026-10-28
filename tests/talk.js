// Тесты разговора: сценарии из нескольких реплик. Проверяем акты, тон, отсутствие повторов и «вопрос в каждой реплике».
global.window = global; global.localStorage = {getItem: () => null, setItem(){}};
require("../engine.js"); require("../mood.js"); require("../dialog.js"); require("../talk.js");
RITM.mood.extend(require("../data/mood_lex.json")); RITM.mood.useModel(require("../data/mood_nb.json"));
const M = RITM.mood, D = RITM.dialog, T = RITM.talk; let ok = 0; const bad = [];
const t = (n, c, i) => { if(c) ok++; else bad.push(n + (i ? " → " + i : "")); };
function run(lines, rnd){
  const ctx = new D.Context(); let k = 0; const r = rnd || (() => (k = (k * 7 + 3) % 10) / 10), out = [];
  for(const line of lines){ const mood = M.analyze(line); ctx.push("user", line, {mood, topic: (T.topicOf(line) || {}).k}); const x = T.reply({text: line, mood, ctx, rnd: r}); ctx.push("bot", x.text, {asked: x.asked}); out.push(x); }
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
console.log(`разговор: ${ok} ок, ${bad.length} ошибок`); bad.forEach(b => console.log("  ✗ " + b)); if(bad.length) process.exitCode = 1;
