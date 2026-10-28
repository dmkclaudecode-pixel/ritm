// Тесты модуля настроения и диалога: фразы → ожидаемая эмоция/полярность; контекст; конструктор; уточнения.
global.window = global; global.localStorage = {getItem: () => null, setItem(){}};
require("../mood.js"); require("../dialog.js");
const M = RITM.mood, D = RITM.dialog;
let ok = 0, bad = [];
const t = (name, cond, info) => { if(cond) ok++; else bad.push(name + (info ? " → " + info : "")); };
// [текст, доминирующая эмоция (или массив допустимых), знак валентности: + - 0]
const CASES = [
  ["Я так устал сегодня", "tired", "-"], ["ура! наконец-то получилось!!!", ["joy", "proud"], "+"], ["мне грустно и одиноко", "sad", "-"],
  ["не рад вообще", "sad", "-"], ["Всё бесит(((", "anger", "-"], ["не грустно, просто устал", "tired", "0|-"], ["Супер настроение, готов на всё!", ["joy", "motivated"], "+"],
  ["я в ярости!!!", "anger", "-"], ["немного волнуюсь перед завтрашним", "anxious", "-"], ["😴", "tired", "-"], ["кайф 😊", "joy", "+"],
  ["ЭТО ПРОСТО УЖАС!!!", ["fear", "anger", "anxious", "stressed"], "-"], ["как же я рад", "joy", "+"], ["люблю тебя", "love", "+"],
  ["скучно, нечем заняться", "bored", "-"], ["лень вообще ничего делать", "lazy", "-"], ["болит голова, температура", "pain", "-"],
  ["дедлайн горит, не успеваю", "stressed", "-"], ["мне стыдно, сорвался", "guilty", "-"], ["горжусь собой, выполнил план", ["proud", "joy"], "+"],
  ["вау, ничего себе!", "surprised", "+"], ["уютно и спокойно", "calm", "+"], ["не хочу ничего", ["sad", "lazy"], "-"], ["очень сильно устал и расстроен", ["tired", "sad"], "-"],
  ["паника, страшно", ["anxious", "fear"], "-"], ["лол ахаха", "joy", "+"], ["кофе выпил", "neutral", "0"], ["записал тренировку 30 минут", "neutral", "0"],
  ["Ужасное настроение, всё плохо", "sad", "-"], ["отличное настроение!", "joy", "+"], ["нервничаю", "anxious", "-"], ["не волнуюсь", ["calm", "neutral"], "0|+"]
];
for(const [txt, emo, sg] of CASES){
  const r = M.analyze(txt), want = Array.isArray(emo) ? emo : [emo];
  t("эмоция: " + txt, want.includes(r.dominant), r.dominant);
  const sign = r.valence > .15 ? "+" : r.valence < -.15 ? "-" : "0";
  t("знак: " + txt, sg.split("|").includes(sign), r.valence);
}
// отрицание не должно «заразить» соседнюю часть фразы
t("негатив через запятую", M.analyze("не грустно, просто устал").dominant === "tired");
// усилитель и ослабитель
t("усилитель сильнее", M.analyze("очень грустно").intensity > M.analyze("немного грустно").intensity);
// контекст
const c = new D.Context();
c.push("user", "устал", {mood: M.analyze("устал"), intent: "state"}); c.push("user", "а вчера?", {});
t("эллипсис", c.resolve("а вчера?").resolved && c.resolve("а вчера?").when === "вчера");
t("не эллипсис", !c.resolve("купил хлеб").resolved);
// тренд настроения
const c2 = new D.Context();
for(const s of ["мне грустно", "всё плохо", "ну ладно", "уже лучше", "кайф!", "супер, ура!"]) c2.push("user", s, {mood: M.analyze(s)});
t("тренд вверх", c2.mood().trend > .5, c2.mood().trend);
// конструктор: нет повторов подряд, разное по настроению
const ctx = new D.Context(); const outs = new Set(); let rn = 0; const rnd = () => (rn = (rn * 7 + 3) % 10) / 10;
for(let i = 0; i < 3; i++) outs.add(D.compose({mood: M.analyze("мне грустно")}, ctx, rnd));
t("без повторов", outs.size === 3, outs.size);
t("радость ≠ грусть", D.compose({mood: M.analyze("ура!!!")}, null, () => 0) !== D.compose({mood: M.analyze("мне грустно")}, null, () => 0));
// склонение и уточнение
t("plural", D.plural(1, ["минута", "минуты", "минут"]) === "минута" && D.plural(3, ["минута", "минуты", "минут"]) === "минуты" && D.plural(11, ["минута", "минуты", "минут"]) === "минут" && D.plural(22, ["минута", "минуты", "минут"]) === "минуты");
t("dur", D.dur(90) === "1 ч 30 минут" && D.dur(120) === "2 часа" && D.dur(5) === "5 минут", D.dur(90));
const q = D.clarify([{name: "Бег"}, {name: "Прогулка"}], "пробежался по набережной");
t("уточнение", /Бег|бег/.test(q.text) && /или/.test(q.text) && q.options.length === 2, q.text);
console.log(`mood+dialog: ${ok} ок, ${bad.length} ошибок`); bad.forEach(b => console.log("  ✗ " + b));
if(bad.length) process.exitCode = 1;
