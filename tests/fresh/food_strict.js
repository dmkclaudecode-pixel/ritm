// Строгий набор по еде: редкие блюда и разговорные глаголы, плюс фразы НЕ про еду (ложные срабатывания считаются ошибкой).
global.window=global;const mem={};global.localStorage={getItem:k=>mem[k]||null,setItem(k,v){mem[k]=v}};
for(const f of ["catalog","catalog2","catalog3","lexicon","food","food2","engine","parser","nlu","onto"]) require("../../"+f+".js");
RITM.onto.use(require("../../data/onto.json"));
const FOOD=new Set(["meal","protein","sweets","water","caffeine","alcohol","supplements"]);
const isFood=t=>{const pre=RITM.parse(t);return pre.some(e=>e.type&&FOOD.has(e.type))||t.toLowerCase().split(/\s+/).some(w=>w.length>4&&RITM.onto.lookup(w).isFood)};
const POS=["схомячил кусок рулета","нажарил блинчиков с творогом","замутил лазанью на ужин","умял пару хачапури","соорудил себе яичницу","сварил борщ на три дня","хрущу огурцами","в обед был рассольник","съела тарелку окрошки","захомячил профитроли","налепили пельменей","настряпала пирожков с капустой","заказали пиццу и роллы","сделал себе омлет с сыром","на ужин была гречка с котлетой","макаю печенье в молоко","поджарила сырники","навернул тарелку солянки","ужинали запечённой рыбой","слопали торт на днюху"];
const NEG=["поехал в магазин за обувью","купил билеты в кино","записался к врачу","весь день писал отчёт","погулял с собакой","встретился с другом в парке","починил кран в ванной","позвонил маме","убрал квартиру","посмотрел серию сериала","поиграл в приставку","оплатил интернет","сходил на тренировку","почитал книгу перед сном","разобрал почту"];
let ok=0,bad=[];for(const t of POS)isFood(t)?ok++:bad.push("пропуск: "+t);for(const t of NEG)!isFood(t)?ok++:bad.push("ложно еда: "+t);
const n=POS.length+NEG.length;console.log("food_strict: "+ok+"/"+n+" ("+Math.round(100*ok/n)+"%)");if(process.argv[2]==="-v")bad.forEach(b=>console.log("  ✗ "+b));
