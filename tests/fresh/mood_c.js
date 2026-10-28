// Свежий набор C (написан ДО расширения словаря идиом) (ни разу не подгонялся): разговорные фразы с эмоцией. Замораживается: после замеров переходит в «обучающие».
global.window=global;global.localStorage={getItem:()=>null,setItem(){}};require('../../engine.js');require('../../embed.js');{const fs=require('fs'),b=fs.readFileSync(__dirname+'/../../data/emb.bin');RITM.embed.use(b.buffer.slice(b.byteOffset,b.byteOffset+b.length),fs.readFileSync(__dirname+'/../../data/emb_vocab.txt','utf8').split('\n'));}require('../../mood.js');RITM.mood.extend(require('../../data/mood_lex.json'));
const S=[
["у меня просто руки не поднимаются что-то делать","lazy,tired,sad","-"],["сегодня порхаю как бабочка","joy","+"],["тоска зелёная","sad,bored","-"],["разрываюсь на части между делами","stressed,anxious","-"],
["приятно удивлён результатом","joy,surprised","+"],["в голове каша, ничего не соображаю","tired,stressed","-"],["какой же ты молодец, спасибо","joy,love,proud","+"],["горло дерёт, нос заложило","pain","-"],
["вся на нервах с утра","anxious,stressed","-"],["день удался на славу","joy","+"],["мне так одиноко вечерами","sad","-"],["невероятно устала за неделю","tired","-"],
["обидели меня сегодня","sad,anger","-"],["душа поёт","joy,love","+"],["так хочется ничего не делать","lazy,tired","-"],["всё раздражает, прямо бесит","anger","-"],
["страшно за будущее","anxious,fear","-"],["чудесный закат, любуюсь","calm,joy","+"],["плохо спал, голова тяжёлая","tired,pain","-"],["завал на работе, не вылезаю","stressed","-"],
["горжусь сыном","proud,love,joy","+"],["тревожно перед поездкой","anxious","-"],["я счастлив как ребёнок","joy","+"],["сегодня очень лениво","lazy","-"],
["от этого всего тошнит","disgust,sad","-"],["с нетерпением жду встречи","excited,joy","+"],["дико хочу спать","tired","-"],["ужасно боюсь завтрашнего дня","fear,anxious","-"],
["на душе спокойно и тепло","calm,love,joy","+"],["достали уже эти пробки","anger","-"],["чувствую подъём сил","motivated,joy","+"],["вот это да, не ожидал","surprised","+"],
["меня переполняет злость","anger","-"],["как же я соскучился","love,sad","-"],["классно провели вечер","joy","+"],["ноет поясница после сидения","pain","-"],
["совсем нет настроения","sad,lazy","-"],["всё хорошо, спокойно","calm,joy","+"],["сорвался и объелся, теперь стыдно","guilty","-"],["тянет в сон весь день","tired","-"]];
let ok=0,bad=[];for(const [t,e,sg] of S){const r=RITM.mood.analyze(t);const sign=r.valence>.15?"+":r.valence<-.15?"-":"0";if(e.split(",").includes(r.dominant)&&sign===sg)ok++;else bad.push(t+" → "+r.dominant+" "+r.valence)}
console.log("mood_c: "+ok+"/"+S.length+" ("+Math.round(100*ok/S.length)+"%)");if(process.argv[2]==="-v")bad.forEach(b=>console.log("  ✗ "+b));
