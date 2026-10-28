// Свежий набор: еда и напитки в разговорной речи, часть слов — редкие. Ожидание: тип meal/protein/sweets/water/caffeine/alcohol либо онтология знает слово как еду.
global.window=global;const mem={};global.localStorage={getItem:k=>mem[k]||null,setItem(k,v){mem[k]=v}};
for(const f of ["catalog","catalog2","catalog3","lexicon","food","food2","engine","parser","nlu","onto"]) require("../../"+f+".js");
RITM.onto.use(require("../../data/onto.json"));
const FOOD=new Set(["meal","protein","sweets","water","caffeine","alcohol","supplements"]);
const S=["слопал шарлотку","навернул сырников","перекусил ватрушкой","на ужин были голубцы","сварганил плов","съел пару вареников","умял тарелку борща","заказал харчо","пожарил котлеты","запёк курицу с картошкой","наелся пельменей","съел кусок наполеона","на завтрак запеканка","похрустел сухариками","полакомился эклером","сделал оладьи","похлебал окрошку","заточил чебурек","выпил компот","навернул шашлык","приготовил сырники","перехватил шаурму","съел творожок","накидал в тарелку оливье","умяла пирожок","хлебнул морса","сгрыз яблоко","поел макарон по-флотски","на обед солянка","смолотил бутерброд"];
let ok=0,bad=[];for(const t of S){const pre=RITM.parse(t);const hit=pre.some(e=>e.type&&FOOD.has(e.type))||t.toLowerCase().split(/\s+/).some(w=>w.length>3&&RITM.onto.lookup(w).isFood);if(hit)ok++;else bad.push(t+" → "+JSON.stringify(pre.map(e=>e.type||"?")))}
console.log("food_unknown: "+ok+"/"+S.length+" ("+Math.round(100*ok/S.length)+"%)");if(process.argv[2]==="-v")bad.forEach(b=>console.log("  ✗ "+b));
