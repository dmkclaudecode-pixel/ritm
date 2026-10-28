#!/usr/bin/env python3
"""Сборка статистики из корпусов для онтологии слов и словосочетаний (запускается в GitHub Actions).
В результат попадает ТОЛЬКО статистика (счётчики, PMI, связи слово→слово), не сами тексты.
Источники (лицензии ниже; некоммерческие — только для статистики и тестов, решение о включении в приложение за владельцем):
  • RuRecipes-93k (CC BY-NC 4.0)  → recipes.json: ингредиент → блюда, блюдо → ингредиенты, сочетания «глагол + продукт»
  • inkoziev/Conversations (лицензия неоднозначна: CC BY / CC BY-NC) → collocations.json: пары «глагол + существительное», «прил. + сущ.»
  • Русские наборы эмоций/тональности (searayeah/russian-sentiment-emotion-datasets) → emo_words.json: слово → распределение эмоций
Каждый шаг независим, итог — REPORT.md."""
import json, os, re, sys, math, collections, itertools, subprocess, glob
OUT = sys.argv[1] if len(sys.argv) > 1 else "corpora"; os.makedirs(OUT, exist_ok=True)
report = []; log = lambda s: (print(s, flush=True), report.append(s))
import pymorphy3
M = pymorphy3.MorphAnalyzer(); _c = {}
def lem(w):
    r = _c.get(w)
    if r is None:
        p = M.parse(w)[0]; r = _c[w] = (p.normal_form.replace("ё", "е"), p.tag.POS or "")
    return r
def words(t): return re.findall(r"[а-яё]{2,}", t.lower())
def dump(name, obj):
    p = os.path.join(OUT, name); json.dump(obj, open(p, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    log(f"  {name}: {os.path.getsize(p)//1024} КБ")

def pmi_pairs(pairs, single, total, minc, top):
    res = []
    for (a, b), c in pairs.items():
        if c < minc: continue
        res.append((round(math.log(c * total / (single[a] * single[b])), 2), c, a, b))
    res.sort(key=lambda x: -x[0] * math.log(1 + x[1]))
    return [[a, b, c, p] for p, c, a, b in res[:top]]

# ---------- рецепты ----------
def recipes():
    log("Рецепты (RuRecipes-93k)")
    from huggingface_hub import snapshot_download
    import pyarrow.parquet as pq
    d = snapshot_download("epishchik/RuRecipes-93k", repo_type="dataset", allow_patterns=["data/*"])
    ing2dish = collections.defaultdict(collections.Counter); dish_ing = collections.defaultdict(collections.Counter)
    verb_food = collections.Counter(); ing_cnt = collections.Counter(); n = 0
    for f in glob.glob(d + "/data/*.parquet"):
        t = pq.read_table(f, columns=["title", "ingredients", "recipe"]).to_pylist()
        for r in t:
            title = " ".join(lem(w)[0] for w in words(r["title"] or "") if lem(w)[1] in ("NOUN", "ADJF"))
            if not title: continue
            ings = set()
            for s in r["ingredients"] or []:
                ws = [lem(w) for w in words(s.split("—")[0].split("-")[0].split(",")[0])]
                ns = [l for l, p in ws if p == "NOUN"]
                if ns: ings.add(ns[0])
            for i in ings: ing2dish[i][title] += 1; dish_ing[title][i] += 1; ing_cnt[i] += 1
            for step in (r["recipe"] or [])[:30]:
                ws = [lem(w) for w in words(step)]
                for k, (l, p) in enumerate(ws):
                    if p in ("VERB", "INFN") and k + 2 < len(ws) + 1:
                        for l2, p2 in ws[k + 1:k + 4]:
                            if p2 == "NOUN" and l2 in ings: verb_food[(l, l2)] += 1
            n += 1
    log(f"  рецептов: {n}, ингредиентов: {len(ing_cnt)}")
    dump("recipes.json", {
        "ingredient_dishes": {i: [d for d, _ in c.most_common(8)] for i, c in ing2dish.items() if ing_cnt[i] >= 5 and len(i) > 2},
        "dish_ingredients": {d: [i for i, _ in c.most_common(10)] for d, c in dish_ing.items() if sum(c.values()) >= 8},
        "verb_food": [[v, f, c] for (v, f), c in verb_food.most_common(20000) if c >= 8]})

# ---------- диалоги: сочетания ----------
def convs(limit=1_500_000):
    log("Диалоги (Conversations): сочетания слов")
    from huggingface_hub import hf_hub_download, list_repo_files
    files = [f for f in list_repo_files("inkoziev/Conversations", repo_type="dataset") if f.endswith((".txt", ".jsonl", ".parquet", ".zip", ".gz", ".json"))]
    log("  файлы: " + ", ".join(files[:8]))
    single = collections.Counter(); pairs = collections.Counter(); n = 0; total = 0
    def feed(text):
        nonlocal total
        ws = [lem(w) for w in words(text)][:40]
        seq = [(l, p) for l, p in ws if p in ("NOUN", "VERB", "INFN", "ADJF", "ADVB")]
        for l, p in seq: single[l] += 1; total += 1
        for (a, pa), (b, pb) in zip(seq, seq[1:3] + seq[1:2]):
            if a != b and ((pa in ("VERB", "INFN") and pb == "NOUN") or (pa == "ADJF" and pb == "NOUN")): pairs[(a, b)] += 1
    for name in files:
        try: p = hf_hub_download("inkoziev/Conversations", name, repo_type="dataset")
        except Exception as e: log(f"  {name}: {e}"); continue
        try:
            import gzip, zipfile
            op = gzip.open if p.endswith(".gz") else open
            if p.endswith(".parquet"):
                import pyarrow.parquet as pq
                for r in pq.read_table(p).to_pylist():
                    feed(" ".join(map(str, r.values()))); n += 1
                    if n >= limit: break
            elif not p.endswith(".zip"):
                with op(p, "rt", encoding="utf-8", errors="ignore") as fh:
                    for line in fh:
                        feed(line); n += 1
                        if n >= limit: break
        except Exception as e: log(f"  {name}: чтение не удалось: {e}")
        if n >= limit: break
    log(f"  реплик: {n}")
    if n: dump("collocations.json", pmi_pairs(pairs, single, max(total, 1), 12, 60000))

# ---------- эмоции по словам ----------
def emotions():
    log("Эмоции по словам")
    d = "/tmp/emo"; subprocess.run(["git", "clone", "--depth", "1", "https://github.com/searayeah/russian-sentiment-emotion-datasets", d], check=False)
    files = [f for f in glob.glob(d + "/**/*", recursive=True) if f.endswith((".csv", ".tsv", ".jsonl", ".json"))]
    log("  файлов: " + str(len(files)) + " (" + ", ".join(os.path.basename(f) for f in files[:10]) + ")")
    import csv; csv.field_size_limit(10**7)
    wl = collections.defaultdict(collections.Counter); lab = collections.Counter(); n = 0
    for f in files:
        try:
            if f.endswith((".csv", ".tsv")):
                rows = list(csv.DictReader(open(f, encoding="utf-8", errors="ignore"), delimiter="\t" if f.endswith(".tsv") else ","))
            elif f.endswith(".jsonl"): rows = [json.loads(l) for l in open(f, encoding="utf-8") if l.strip()]
            else:
                j = json.load(open(f, encoding="utf-8")); rows = j if isinstance(j, list) else []
        except Exception as e: log(f"  {os.path.basename(f)}: {e}"); continue
        if not rows or not isinstance(rows[0], dict): continue
        tk = next((k for k in rows[0] if k.lower() in ("text", "sentence", "comment", "content")), None)
        lk = next((k for k in rows[0] if k.lower() in ("label", "sentiment", "emotion", "labels", "class")), None)
        if not tk or not lk: continue
        for r in rows:
            L = str(r[lk]); 
            for w in set(lem(x)[0] for x in words(str(r[tk])) if len(x) > 2): wl[w][L] += 1
            lab[L] += 1; n += 1
    log(f"  текстов: {n}; метки: {dict(lab.most_common(12))}")
    if n:
        tot = sum(lab.values()); out = {}
        for w, c in wl.items():
            s = sum(c.values())
            if s < 8: continue
            lift = {L: round((c[L] / s) / (lab[L] / tot), 2) for L in c if c[L] >= 4}
            best = max(lift.items(), key=lambda x: x[1], default=None)
            if best and best[1] >= 1.8: out[w] = [best[0], best[1], s]
        dump("emo_words.json", out)

for step in (recipes, convs, emotions):
    try: step()
    except Exception as e: log(f"  ОШИБКА {step.__name__}: {type(e).__name__}: {e}")
open(os.path.join(OUT, "REPORT.md"), "w", encoding="utf-8").write("# Сборка корпусов\n\n" + "\n".join(report) + "\n")
