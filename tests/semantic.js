// Смысловые наборы: фразы с ожидаемым типом занятия. «held» — фразы, которых словарь не видел (честная проверка обобщения).
// Пороги — нижняя граница точности: если новая правка роняет понимание, тесты покраснеют.
const sets = [["train", "./semantic/train.js", 0.95], ["held1", "./semantic/held1.js", 0.80], ["held2", "./semantic/held2.js", 0.85]];
let fails = [], total = 0, okAll = 0;
for(const [name, file, floor] of sets){
  const C = require(file); let ok = 0; const bad = [];
  for(const [t, exp] of C){ const r = RITM.parse(t); if(r.some(x => x.type === exp)) ok++; else bad.push(`${t} → ${JSON.stringify(r.map(x => x.type))} ждали ${exp}`); }
  const acc = ok / C.length; total += C.length; okAll += ok;
  console.log(`Смысл «${name}»: ${ok}/${C.length} (${Math.round(acc*100)}%), порог ${Math.round(floor*100)}%`);
  if(acc < floor) fails.push(`Смысл «${name}» ниже порога:\n   ` + bad.join("\n   "));
}
module.exports = {total, okAll, fails};
