// Точка входа: подключает модули и запускает их init() в том порядке, в котором раньше грузились файлы
import * as m0 from "./base.js";
import * as m1 from "./plan.js";
import * as m2 from "./render.js";
import * as m3 from "./chat.js";
import * as m4 from "./parse.js";
import * as m5 from "./morning.js";
import * as m6 from "./checkins.js";
import * as m7 from "./insights.js";
import * as m8 from "./routine.js";
import * as m9 from "./nudges.js";
import * as m10 from "./daily.js";
import * as m11 from "./native.js";

for(const m of [m0, m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11]) if(m.init) m.init();
try{ if(window.RITM && RITM.onto) RITM.onto.load("data/onto.json"); }catch(e){ /* онтология необязательна */ }
try{ if(window.RITM && RITM.mood) RITM.mood.loadLex("data/mood_lex.json"); }catch(e){ /* лексикон необязателен */ }
try{ if(window.RITM && RITM.embed) RITM.embed.load("data/emb.bin", "data/emb_vocab.txt"); }catch(e){ /* векторы необязательны */ }
try{ if(window.RITM && RITM.mood) RITM.mood.loadModel("data/mood_nb.json"); }catch(e){ /* модель необязательна */ }
