global.window=global;global.localStorage={getItem:()=>null,setItem(){}};require('../../engine.js');require('../../embed.js');{const fs=require('fs'),b=fs.readFileSync(__dirname+'/../../data/emb.bin');RITM.embed.use(b.buffer.slice(b.byteOffset,b.byteOffset+b.length),fs.readFileSync(__dirname+'/../../data/emb_vocab.txt','utf8').split('\n'));}require('../../mood.js');RITM.mood.extend(require('../../data/mood_lex.json'));RITM.mood.useModel(require('../../data/mood_nb.json'));
const S=[ // [текст, допустимые эмоции, знак]
["день был просто отвратительный","sad,anger,disgust,stressed","-"],["меня переполняет счастье","joy,love","+"],["ничего не радует","sad","-"],["сил моих нет уже","tired","-"],
["как же меня достали эти совещания","anger,stressed","-"],["боюсь завтрашнего экзамена","anxious,fear","-"],["классный выдался вечер","joy,calm","+"],["я выжат как лимон","tired","-"],
["ощущаю полное спокойствие","calm","+"],["так обидно, что не вышло","sad,guilty","-"],["жду не дождусь отпуска","excited,joy","+"],["совсем раскис сегодня","sad,tired,lazy","-"],
["голова раскалывается","pain","-"],["ненавижу понедельники","anger,disgust","-"],["вот это поворот!","surprised","+"],["сегодня зверски хочется спать","tired","-"],
["ей богу, надоело всё","bored,anger,sad","-"],["я молодец, пробежал десятку","proud,joy","+"],["ужасно нервничаю перед собеседованием","anxious,stressed","-"],["мне хорошо и спокойно","calm,joy","+"],
["ну и денёк, всё наперекосяк","stressed,sad,anger","-"],["обожаю такие утра","love,joy","+"],["чувствую себя разбитым","tired","-"],["на душе кошки скребут","sad,anxious,guilty","-"],
["вау, это восхитительно","joy,surprised","+"],["бесконечно благодарен тебе","joy,love","+"],["опять я всё запорол","guilty,sad","-"],["не могу заставить себя встать","lazy,tired","-"],
["пофиг, ничего не хочу","lazy,sad,bored","-"],["полон энергии и идей","motivated,joy,excited","+"],["всё валится из рук","stressed,sad,tired","-"],["ура, выходные!","joy,excited","+"]];
let ok=0,bad=[];for(const [t,e,sg] of S){const r=RITM.mood.analyze(t);const sign=r.valence>.15?"+":r.valence<-.15?"-":"0";const g=e.split(",").includes(r.dominant)&&sign===sg;if(g)ok++;else bad.push(t+" → "+r.dominant+" "+r.valence)}
console.log(ok+"/"+S.length);bad.forEach(b=>console.log("  ✗ "+b));
