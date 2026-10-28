// Свежий набор D (написан ПОСЛЕ расширения словаря, фразы не из словаря) (ни разу не подгонялся): разговорные фразы с эмоцией. Замораживается: после замеров переходит в «обучающие».
global.window=global;global.localStorage={getItem:()=>null,setItem(){}};require('../../engine.js');require('../../embed.js');{const fs=require('fs'),b=fs.readFileSync(__dirname+'/../../data/emb.bin');RITM.embed.use(b.buffer.slice(b.byteOffset,b.byteOffset+b.length),fs.readFileSync(__dirname+'/../../data/emb_vocab.txt','utf8').split('\n'));}require('../../mood.js');RITM.mood.extend(require('../../data/mood_lex.json'));
const S=[
["после смены еле стою на ногах","tired","-"],["выбросил всё из головы и просто кайфую","joy,calm","+"],["подруга обманула, так горько","sad,anger","-"],["завтра презентация, внутри всё дрожит","anxious,fear,stressed","-"],
["обожаю наши субботние завтраки","love,joy","+"],["сын получил пятёрку, аж слёзы радости","joy,proud,love","+"],["сижу и тупо смотрю в стену","lazy,sad,bored","-"],["пробки до дома два часа, убил бы всех","anger,stressed","-"],
["как же приятно после душа","calm,joy","+"],["голова не варит совсем","tired,stressed","-"],["ура, меня взяли на работу!","joy,excited","+"],["всё валится, ничего не выходит","sad,stressed","-"],
["сегодня я королева мира","joy,proud","+"],["совсем без сил после болезни","tired,pain","-"],["потряс меня этот фильм","surprised,sad,joy","+"],["чувствую пустоту внутри","sad","-"],
["день рождения прошёл идеально","joy","+"],["поссорились с мужем, всё внутри кипит","anger,sad","-"],["одолела хандра","sad,bored","-"],["не хочется вылезать из-под одеяла","lazy,tired","-"],
["колено ноет на погоду","pain","-"],["какая же красота вокруг","joy,calm,love","+"],["трясёт от волнения перед выходом","anxious,excited","-"],["спокойно, без суеты","calm","+"],
["горжусь, что не бросил","proud","+"],["невыносимо скучная лекция","bored","-"],["обожаю тебя, мой хороший","love","+"],["навалилось всё разом","stressed,sad","-"],
["опять эта мигрень, сил нет","pain","-"],["классная новость, спасибо!","joy","+"],["в голове пусто, настроения никакого","sad,lazy","-"],["испугался до дрожи","fear,anxious","-"],
["я просто счастлив, что ты рядом","joy,love","+"],["тяжёлая неделя, вымотался","tired,stressed","-"],["лежу и ничего не хочу","lazy,tired","-"],["взбесило это хамство","anger","-"],
["очень приятно, как будто праздник","joy","+"],["тревога не отпускает","anxious","-"],["захотелось плакать","sad","-"],["ничего себе, вот это успех","surprised,joy","+"]];
let ok=0,bad=[];for(const [t,e,sg] of S){const r=RITM.mood.analyze(t);const sign=r.valence>.15?"+":r.valence<-.15?"-":"0";if(e.split(",").includes(r.dominant)&&sign===sg)ok++;else bad.push(t+" → "+r.dominant+" "+r.valence)}
console.log("mood_d: "+ok+"/"+S.length+" ("+Math.round(100*ok/S.length)+"%)");if(process.argv[2]==="-v")bad.forEach(b=>console.log("  ✗ "+b));
