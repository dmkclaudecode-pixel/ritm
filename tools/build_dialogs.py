#!/usr/bin/env python3
"""Диалоги для «языковой» части: фильтрует корпус реплик (inkoziev/Conversations) до коротких бытовых пар «реплика → ответ».
Выход (папка dialogs/): pairs.jsonl (отфильтрованные пары), sample.txt (случайные 400 пар для ручного просмотра), REPORT.md.
Фильтры: 3–18 слов в каждой реплике, кириллица, без мата, без «литературных» признаков (имена в середине фразы, кавычки, длинные тире внутри, многоточия подряд),
ответ не повторяет вопрос. Запускается в GitHub Actions."""
import gzip, json, os, re, sys, random, collections
OUT = sys.argv[1] if len(sys.argv) > 1 else "dialogs"; os.makedirs(OUT, exist_ok=True)
LIMIT = int(os.environ.get("LIMIT", "4000000"))
random.seed(7)
report = []; log = lambda s: (print(s, flush=True), report.append(s))
from huggingface_hub import hf_hub_download
p = hf_hub_download("inkoziev/Conversations", "conversations.jsonl.gz", repo_type="dataset")
BAD = re.compile(r"(хуй|хуе|хуя|пизд|блят|бляд|ебал|ебат|ебан|ёбан|сука|суки|сучк|мудак|мудил|пидор|пидар|залуп|шлюх|дроч|еблан|сволоч|говн|срать|сран|жопа|жопу|член\b|трахн|сиськ)", re.I)
LIT = re.compile(r"[«»„“”]|\.{4,}|[—–]{2}|\bг-н|господин|милорд|государь|ваше (высочество|величество)|сударь|\bсэр\b|мистер|мисс\b|монсеньор", re.I)
PROPER = re.compile(r"(?<![.!?—-] )(?<!^)\s[А-ЯЁ][а-яё]{2,}")          # слово с заглавной внутри фразы — чаще всего имя персонажа
WORD = re.compile(r"[а-яё]+", re.I)
def ok(t):
    t = t.strip(" —-–\t\n")
    n = len(WORD.findall(t))
    if n < 2 or n > 18 or len(t) > 140: return False
    if BAD.search(t) or LIT.search(t) or PROPER.search(t): return False
    if re.search(r"[A-Za-z]{3,}|\d{3,}|http", t): return False
    if sum(c.isalpha() for c in t) < 0.7 * len(t): return False
    return True
pairs = []; seen = set(); total = 0
with gzip.open(p, "rt", encoding="utf-8", errors="ignore") as fh:
    for line in fh:
        total += 1
        if total > LIMIT: break
        try: d = json.loads(line)
        except Exception: continue
        conv = d.get("conversation") if isinstance(d, dict) else None
        if isinstance(conv, list): turns = [str(x) for x in conv]
        else: turns = [x.strip() for x in str(conv or line).split("—") if x.strip()]
        for a, b in zip(turns, turns[1:]):
            a, b = a.strip(" —-–"), b.strip(" —-–")
            if a == b or not ok(a) or not ok(b): continue
            k = (a.lower(), b.lower())
            if k in seen: continue
            seen.add(k); pairs.append((a, b))
log(f"прочитано диалогов: {total}, пар после фильтров: {len(pairs)}")
random.shuffle(pairs)
with open(os.path.join(OUT, "pairs.jsonl"), "w", encoding="utf-8") as fo:
    for a, b in pairs[:600000]: fo.write(json.dumps({"q": a, "a": b}, ensure_ascii=False) + "\n")
with open(os.path.join(OUT, "sample.txt"), "w", encoding="utf-8") as fo:
    for a, b in pairs[:400]: fo.write(f"— {a}\n— {b}\n\n")
c = collections.Counter(b.lower() for _, b in pairs); log("самые частые ответы: " + "; ".join(f"{k} ({v})" for k, v in c.most_common(15)))
open(os.path.join(OUT, "REPORT.md"), "w", encoding="utf-8").write("# Диалоги\n\n" + "\n".join(report) + "\n")
