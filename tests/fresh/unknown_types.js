// Незнакомые занятия и еда: тип определяется парсером, а если не знает — подсказкой онтологии (область слова). Считаем, сколько угадано.
global.window=global;const mem={};global.localStorage={getItem:k=>mem[k]||null,setItem(k,v){mem[k]=v}};
for(const f of ["catalog","catalog2","catalog3","lexicon","food","food2","engine","parser","nlu","onto"]) require("../../"+f+".js");
RITM.onto.use(require("../../data/onto.json"));
const G={sport:["sport","strength","run","bike","swim","cardio","walk"],hobby:["hobby","learning","relax","reading"],meal:["meal","protein","sweets","caffeine","alcohol","water"]};
const S=[["занимался скалолазанием","sport"],["сходил на фехтование","sport"],["играли в керлинг","sport"],["поиграл в сквош","sport"],["потренировал лазание на стенде","sport"],["был на айкидо","sport"],["занималась фигурным катанием","sport"],["покатался на сапе","sport"],["сыграли в петанк","sport"],["поплавал в бассейне","sport"],
["занимался вязанием","hobby"],["делал оригами","hobby"],["увлёкся макраме","hobby"],["лепил из глины","hobby"],["занимался гончарным делом","hobby"],["собирал пазлы","hobby"],["вышивал крестиком","hobby"],["коллекционирую марки","hobby"],["фотографировал птиц","hobby"],["рисовал акварелью","hobby"],
["съел шарлотку","meal"],["навернул плов","meal"],["на ужин борщ","meal"],["выпил чай с лимоном","meal"],["съел хачапури","meal"],["заказал суши","meal"],["слопал эклер","meal"],["попил латте","meal"],["съел овсянку","meal"],["перекусил йогуртом","meal"]];
let ok=0,bad=[];
for(const [t,g] of S){const pre=RITM.parse(t);let types=pre.map(e=>e.type).filter(Boolean);
 let hit=types.some(x=>G[g].includes(x));
 if(!hit){const hs=t.toLowerCase().split(/\s+/).map(w=>RITM.onto.typeHint(w)).filter(Boolean);hit=hs.some(x=>G[g].includes(x)||(g==="sport"&&x==="strength"))}
 hit?ok++:bad.push(t+" → "+JSON.stringify(types));}
console.log("unknown_types: "+ok+"/"+S.length+" ("+Math.round(100*ok/S.length)+"%)");if(process.argv[2]==="-v")bad.forEach(b=>console.log("  ✗ "+b));
