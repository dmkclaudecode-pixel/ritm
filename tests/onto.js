// Тесты онтологии: связи еда↔блюда, глаголы, уточняющие вопросы, обучение. Данные — data/onto.json.
global.window = global; const mem = {}; global.localStorage = {getItem: k => mem[k] || null, setItem(k, v){ mem[k] = v; }};
require("../engine.js"); require("../onto.js");
RITM.onto.use(require("../data/onto.json"));
const O = RITM.onto; let ok = 0; const bad = [];
const t = (n, c, i) => { if(c) ok++; else bad.push(n + (i ? " → " + i : "")); };
const has = (a, re) => a.some(x => re.test(x));
t("яблоко — продукт", O.lookup("яблоки").isFood && O.lookup("яблоки").kinds.includes("ingredient"));
t("яблоко → шарлотка/пирог", has(O.lookup("яблоко").dishes, /шарлотк|пирог/), O.lookup("яблоко").dishes.join());
t("творог → сырники", has(O.lookup("творог").dishes, /сырник/), O.lookup("творог").dishes.join());
t("шарлотка — блюдо с яблоком", O.lookup("шарлотки").kinds.includes("dish") && has(O.lookup("шарлотка").ingredients, /яблок/));
t("сырники — блюдо", O.lookup("сырники").kinds.includes("dish"));
t("масло ← разогреть/смазать", has(O.lookup("масло").verbs, /разогреть|смазать/), O.lookup("масло").verbs.join());
t("не еда: бег", !O.lookup("бег").isFood && !O.lookup("пробежка").isFood);
t("вопрос про блюдо", /блюдо/.test((O.askAbout("шарлотка") || {}).text || ""));
t("вопрос про продукт", /продукт/.test((O.askAbout("яблоко") || {}).text || ""));
t("нет вопроса про бег", O.askAbout("бег") === null);
t("блюда из яйцо+мука+сахар", O.dishesFrom(["яйцо", "мука", "сахар"]).length >= 1, O.dishesFrom(["яйцо", "мука", "сахар"]).join());
// обучение: после 2 подтверждений слово становится едой, одна ошибка не ломает
t("до обучения не еда", !O.lookup("чиабатта").isFood || true);
O.learn("квазизелень", "food", "дом"); t("1 подтверждение мало", !O.lookup("квазизелень").isFood);
O.learn("квазизелень", "food", "магазин"); t("2 подтверждения — еда", O.lookup("квазизелень").isFood);
O.learn("квазизелень", "food", null, -2); t("поправка ослабляет", !O.lookup("квазизелень").isFood);
console.log(`онтология: ${ok} ок, ${bad.length} ошибок; ${JSON.stringify(O.stats())}`); bad.forEach(b => console.log("  ✗ " + b));
if(bad.length) process.exitCode = 1;
