// Свежий набор B (ни разу не подгонялся): разговорные фразы с эмоцией. Замораживается: после замеров переходит в «обучающие».
global.window=global;global.localStorage={getItem:()=>null,setItem(){}};require('../../engine.js');require('../../embed.js');{const fs=require('fs'),b=fs.readFileSync(__dirname+'/../../data/emb.bin');RITM.embed.use(b.buffer.slice(b.byteOffset,b.byteOffset+b.length),fs.readFileSync(__dirname+'/../../data/emb_vocab.txt','utf8').split('\n'));}require('../../mood.js');RITM.mood.extend(require('../../data/mood_lex.json'));RITM.mood.useModel(require('../../data/mood_nb.json'));
const S=[
["ну и бардак у меня в голове","stressed,anxious,sad","-"],["сегодня просто мечта а не день","joy","+"],["выдохся к вечеру","tired","-"],["хочу выть от этой работы","sad,anger,stressed","-"],
["как же хорошо дома","calm,joy,love","+"],["сердце колотится, боюсь","anxious,fear","-"],["обнял бы весь мир","love,joy","+"],["всё идёт наперекосяк, руки опускаются","sad,stressed,tired","-"],
["улыбаюсь как дурак","joy","+"],["тошно от всего","sad,disgust","-"],["я в восторге от этого места","joy,surprised","+"],["вымотали меня эти дети","tired,stressed","-"],
["да сколько можно уже!","anger,stressed","-"],["тихий вечер, чай, книжка","calm","+"],["никак не соберусь с мыслями","lazy,anxious,tired","-"],["реально горжусь командой","proud,joy","+"],
["что-то на сердце тревожно","anxious","-"],["вот это новость!","surprised","+"],["меня трясёт от злости","anger","-"],["ничего не клеится","sad,stressed,lazy","-"],
["бодрое утро, полон сил","joy,motivated","+"],["сонная муха сегодня","tired","-"],["обожаю свою работу","love,joy","+"],["апатия какая-то","sad,lazy","-"],
["стыдно перед друзьями","guilty","-"],["как же круто покатались","joy","+"],["спина ноет весь день","pain","-"],["жуть как переживаю за отчёт","anxious,stressed","-"],
["меня все раздражают","anger","-"],["всё супер, спасибо!","joy","+"],["тоскливо и серо","sad,bored","-"],["аж мурашки от счастья","joy,love","+"],
["не могу больше, нет сил терпеть","tired,sad,stressed","-"],["мне скучно одному","bored,sad","-"],["сижу довольный как слон","joy,calm","+"],["рука болит после тренировки","pain","-"],
["всё получилось, ура ура","joy,proud","+"],["чувствую себя никому не нужным","sad","-"],["паршиво на душе","sad","-"],["как же я зол на себя","anger,guilty","-"]];
let ok=0,bad=[];for(const [t,e,sg] of S){const r=RITM.mood.analyze(t);const sign=r.valence>.15?"+":r.valence<-.15?"-":"0";if(e.split(",").includes(r.dominant)&&sign===sg)ok++;else bad.push(t+" → "+r.dominant+" "+r.valence)}
console.log("mood_b: "+ok+"/"+S.length+" ("+Math.round(100*ok/S.length)+"%)");if(process.argv[2]==="-v")bad.forEach(b=>console.log("  ✗ "+b));
