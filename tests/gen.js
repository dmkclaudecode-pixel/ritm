// Генератор размеченных фраз: node tests/gen.js [--show N]. Золотой ответ известен по построению.
global.localStorage={getItem:()=>null,setItem(){}}; global.window=global;
['catalog','food','parser','nlu'].forEach(f=>require('../'+f+'.js'));
RITM.ctx={now:"14:30",workEnd:"19:00",commute:0,lunch:"13:30",bed:"23:00",wake:"08:00"};
const ACTS=[ // [фраза в прошедшем, тип]
["поплавал","swim"],["сходил в бассейн","swim"],["плавал в бассейне","swim"],["позанимался в зале","strength"],["потренировался в зале","strength"],["сделал силовую","strength"],["покачался","strength"],
["погулял","walk"],["прогулялся по парку","walk"],["сходил на прогулку","walk"],["прошёлся пешком","walk"],["побегал","run"],["пробежался","run"],["сделал пробежку","run"],
["покатался на велосипеде","bike"],["покатался на велике","bike"],["позанимался йогой","mobility"],["сделал растяжку","mobility"],["сделал зарядку","mobility"],
["почитал книгу","reading"],["почитал","reading"],["позанимался английским","learning"],["посмотрел лекцию","learning"],["посмотрел сериал","series"],["посмотрел фильм","series"],["посидел в ютубе","video"],["полистал ленту","feeds"],["поиграл в доту","gaming"],["поиграл в приставку","gaming"],
["поработал","work"],["поработал над проектом","work"],["убрался дома","chores"],["прибрался в квартире","chores"],["постирал","chores"],["помыл посуду","chores"],
["позвонил маме","social"],["пообщался с друзьями","social"],["встретился с другом","social"],["посидел в парке","nature"],["съездил на дачу","nature"],["поиграл на гитаре","hobby"],["порисовал","hobby"],["помедитировал","relax"],["сходил в баню","relax"],["сходил на массаж","relax"],["сходил в кино","outing"],["сходил в музей","outing"],
];
const QTY=[["",null],["30 минут",30],["40 минут",40],["45 минут",45],["полчаса",30],["час",60],["1 час",60],["1,5 часа",90],["2 часа",120],["три часа",180],["20 мин",20],["15 минут",15],["полтора часа",90],["10 минут",10]];
const DAY=[["",0],["вчера",-1],["сегодня",0]];
const TIME=[["",null],["в 9:30","09:30"],["в 18:00","18:00"],["в 7:15","07:15"],["в 21:45","21:45"]];
const rnd=a=>a[Math.floor(Math.random()*a.length)];
let seed=7; Math.random=()=>{seed=(seed*1664525+1013904223)%4294967296; return seed/4294967296;};
const N=+(process.argv[2]||30000), fails={}; let ok=0, tot=0, wrongType=0, wrongMin=0, wrongDay=0, wrongTime=0, none=0;
const sample=[];
for(let i=0;i<N;i++){
  const [a,type]=rnd(ACTS), [q,qm]=rnd(QTY), [d,dd]=rnd(DAY), [tm,tv]=rnd(TIME);
  const parts=[d,a,q&& (rnd([0,1])? "на "+q : q),tm].filter(Boolean);
  // «на 40 минут» плохо звучит для «час»; допускаем оба варианта
  let text=parts.join(" ");
  const NOISE=process.argv.includes("--noise");
  if(NOISE){
    const m=rnd(["typo","typo","pre","post","order","caps","none"]);
    if(m==="typo"){ const w=text.split(" "); const j=Math.floor(Math.random()*w.length); const x=w[j]; if(x.length>4&&!/\d/.test(x)){ const p=1+Math.floor(Math.random()*(x.length-2)); const t=rnd([0,1,2]); w[j]= t===0? x.slice(0,p)+x.slice(p+1) : t===1? x.slice(0,p)+x[p+1]+x[p]+x.slice(p+2) : x.slice(0,p)+x[p]+x.slice(p); } text=w.join(" "); }
    else if(m==="pre") text=rnd(["ну","короче","в общем","так","кстати","вот","слушай","значит"])+" "+text;
    else if(m==="post") text=text+" "+rnd(["кстати","вроде","в общем","короче","наверное","))","!"]);
    else if(m==="order" && qm!=null) text=[d,q,a,tm].filter(Boolean).join(" ");
    else if(m==="caps") text=text[0].toUpperCase()+text.slice(1)+rnd([".","!",""]);
  }
  const r=RITM.parse(text).filter(e=>e.type);
  tot++;
  const e=r[0];
  let bad=null;
  if(!e) { none++; bad="none"; }
  else if(e.type!==type) { wrongType++; bad="type:"+e.type; }
  else if(qm!=null && e.min!==qm) { wrongMin++; bad="min:"+e.min; }
  else if((e.dayOffset||0)!==dd) { wrongDay++; bad="day"; }
  else if(tv && e.time!==tv) { wrongTime++; bad="time:"+e.time; }
  if(bad){ const k=a+" | "+bad; fails[k]=(fails[k]||0)+1; if(sample.length<400) sample.push([text,bad]); } else ok++;
}
console.log(`всего ${tot}, верно ${ok} (${(ok/tot*100).toFixed(1)}%). не найдено ${none}, тип ${wrongType}, минуты ${wrongMin}, день ${wrongDay}, время ${wrongTime}`);
const top=Object.entries(fails).sort((a,b)=>b[1]-a[1]).slice(0,25); for(const [k,v] of top) console.log(v,k);
if(process.argv.includes("--show")) for(const s of sample.slice(0,40)) console.log(s.join("  =>  "));
if(ok/tot < 0.97){ console.log("Точность ниже 97%"); process.exitCode = 1; }
