#!/usr/bin/env python3
"""Сборка знаний для движка Rhythm. Запускается в GitHub Actions (там есть интернет); результат — папка knowledge/.
Источники (все с открытыми лицензиями; RuWordNet — по возможности, это некоммерческая лицензия, поэтому он отдельно и необязателен):
  • Navec (Natasha, MIT) — компактные русские векторы слов → урезанные до нужного словаря, PCA 64, int8: emb.bin + emb_vocab.txt
  • Wikidata (CC0) — еда, блюда, ингредиенты, виды спорта, хобби: классы и связи «блюдо → ингредиенты»
  • ConceptNet (CC BY-SA 4.0) — связи слов (IsA, UsedFor, AtLocation, RelatedTo…) для словаря приложения
  • RuWordNet (опционально) — синонимы и гиперонимы
Каждый источник независим: если один недоступен, остальные всё равно сохраняются. Итог и счётчики — knowledge/REPORT.md."""
import json, os, re, sys, time, urllib.parse, urllib.request, collections
OUT = sys.argv[1] if len(sys.argv) > 1 else "knowledge"; os.makedirs(OUT, exist_ok=True)
UA = "RhythmKnowledgeBuilder/1.0 (https://github.com/dmkclaudecode-pixel/ritm)"
report = []; log = lambda s: (print(s, flush=True), report.append(s))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def seeds():
    """слова приложения: из смыслового словаря и каталогов"""
    words = collections.Counter()
    def add(txt):
        for w in re.findall(r"[а-яё]{3,}", txt.lower()): words[w.replace("ё", "е")] += 1
    for f in ["lexicon.js", "catalog.js", "catalog3.js"]:
        p = os.path.join(ROOT, f)
        if os.path.exists(p): add(open(p, encoding="utf-8").read())
    return [w for w, _ in words.most_common()]

def http(url, data=None, headers=None, timeout=120):
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r: return r.read()

# ---------- Wikidata ----------
def sparql(q, tries=3):
    for i in range(tries):
        try:
            raw = http("https://query.wikidata.org/sparql?" + urllib.parse.urlencode({"query": q, "format": "json"}), headers={"Accept": "application/sparql-results+json"}, timeout=180)
            return json.loads(raw)["results"]["bindings"]
        except Exception as e:
            log(f"  wikidata повтор {i+1}: {e}"); time.sleep(10 * (i + 1))
    return []
def wikidata():
    lab = lambda b, k: b.get(k, {}).get("value", "")
    isru = lambda s: bool(re.search(r"[а-яё]", s, re.I))
    out = {"classes": {}, "dish_parts": {}}
    roots = {"еда": "Q2095", "блюдо": "Q746549", "ингредиент": "Q25403900", "фрукт": "Q3314483", "овощ": "Q11004", "напиток": "Q40050", "спорт": "Q349", "хобби": "Q47728", "физическое упражнение": "Q1318295", "активный отдых": "Q1056096"}
    for name, q in roots.items():
        rows = sparql(f'SELECT ?itemLabel ?parentLabel WHERE {{ ?item wdt:P279 ?parent . ?parent wdt:P279* wd:{q} . SERVICE wikibase:label {{ bd:serviceParam wikibase:language "ru". }} }} LIMIT 6000')
        n = 0
        for b in rows:
            a, p = lab(b, "itemLabel").lower(), lab(b, "parentLabel").lower()
            if isru(a) and isru(p): out["classes"].setdefault(a, set()).add(p); n += 1
        log(f"  wikidata {name}: {n} связей «класс → родитель»")
    rows = sparql('SELECT ?dishLabel ?partLabel WHERE { ?dish wdt:P279* wd:Q746549 . ?dish wdt:P527 ?part . SERVICE wikibase:label { bd:serviceParam wikibase:language "ru". } } LIMIT 20000')
    for b in rows:
        d, p = lab(b, "dishLabel").lower(), lab(b, "partLabel").lower()
        if isru(d) and isru(p): out["dish_parts"].setdefault(d, set()).add(p)
    log(f"  wikidata блюда → состав: {len(out['dish_parts'])} блюд")
    out["classes"] = {k: sorted(v) for k, v in out["classes"].items()}; out["dish_parts"] = {k: sorted(v) for k, v in out["dish_parts"].items()}
    json.dump(out, open(os.path.join(OUT, "wikidata.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

# ---------- ConceptNet ----------
CN_REL = {"IsA", "UsedFor", "AtLocation", "RelatedTo", "HasContext", "MadeOf", "PartOf", "CapableOf", "HasSubevent", "HasPrerequisite", "Causes", "Synonym", "FormOf", "DerivedFrom"}
def conceptnet(words, limit_words=1500):
    out = {}; ok = 0
    for w in words[:limit_words]:
        try:
            raw = http("https://api.conceptnet.io/query?" + urllib.parse.urlencode({"node": f"/c/ru/{w}", "other": "/c/ru", "limit": 60}), timeout=60)
            edges = json.loads(raw).get("edges", [])
        except Exception as e:
            time.sleep(2); continue
        rel = {}
        for e in edges:
            r = e["rel"]["label"]
            if r not in CN_REL: continue
            s, t = e["start"], e["end"]
            other = t if s.get("@id", "").startswith(f"/c/ru/{w}") else s
            lbl = other.get("label", "").lower()
            if not lbl or lbl == w or not re.search(r"[а-яё]", lbl): continue
            rel.setdefault(r, []).append([lbl, round(float(e.get("weight", 1)), 2)])
        if rel: out[w] = rel; ok += 1
        time.sleep(0.9)   # лимит API
    log(f"  conceptnet: связи найдены для {ok} из {min(len(words), limit_words)} слов")
    json.dump(out, open(os.path.join(OUT, "conceptnet.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

# ---------- Navec: урезанные векторы ----------
def navec_vectors(words):
    import numpy as np
    from navec import Navec
    path = "navec.tar"
    if not os.path.exists(path):
        open(path, "wb").write(http("https://storage.yandexcloud.net/natasha-navec/packs/navec_hudlit_v1_12B_500K_300d_100q.tar", timeout=600))
    nv = Navec.load(path)
    vocab = []; seen = set()
    def take(w):
        w = w.replace("ё", "е")
        if w in seen or not re.fullmatch(r"[а-яе\-]{2,}", w): return
        if w in nv: seen.add(w); vocab.append(w)
    for w in words: take(w)
    n_app = len(vocab)
    for w in nv.vocab.words[:60000]:            # самые частые слова языка (для обобщения на незнакомые)
        take(w.lower())
        if len(vocab) >= 45000: break
    M = np.stack([nv[w] for w in vocab]).astype("float32")
    M -= M.mean(0); U, S, Vt = np.linalg.svd(M, full_matrices=False)
    P = M @ Vt[:64].T; P /= (np.linalg.norm(P, axis=1, keepdims=True) + 1e-9)
    Q = np.clip(np.round(P * 127), -127, 127).astype("int8")
    Q.tofile(os.path.join(OUT, "emb.bin")); open(os.path.join(OUT, "emb_vocab.txt"), "w", encoding="utf-8").write("\n".join(vocab))
    log(f"  navec: {len(vocab)} слов × 64 (из них {n_app} слов приложения), {Q.nbytes // 1024} КБ")

# ---------- RuWordNet (необязательно) ----------
def ruwordnet(words):
    from ruwordnet import RuWordNet
    wn = RuWordNet(); out = {}
    for w in words[:3000]:
        senses = wn.get_senses(w)
        if not senses: continue
        item = {"syn": set(), "hyper": set(), "hypo": set()}
        for s in senses[:4]:
            syn = s.synset
            item["syn"].update(x.name.lower() for x in syn.senses if x.name.lower() != w)
            for h in syn.hypernyms[:3]: item["hyper"].update(x.name.lower() for x in h.senses[:3])
            for h in syn.hyponyms[:6]: item["hypo"].update(x.name.lower() for x in h.senses[:2])
        out[w] = {k: sorted(v)[:12] for k, v in item.items() if v}
    log(f"  ruwordnet: {len(out)} слов")
    json.dump(out, open(os.path.join(OUT, "ruwordnet.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

if __name__ == "__main__":
    W = seeds(); log(f"слов приложения: {len(W)}")
    for name, fn, args in [("Navec", navec_vectors, (W,)), ("Wikidata", wikidata, ()), ("ConceptNet", conceptnet, (W,)), ("RuWordNet", ruwordnet, (W,))]:
        t = time.time(); log(f"[{name}]")
        try: fn(*args); log(f"  готово за {int(time.time() - t)} с")
        except Exception as e: log(f"  ПРОПУЩЕНО: {type(e).__name__}: {e}")
    open(os.path.join(OUT, "REPORT.md"), "w", encoding="utf-8").write("# Сборка знаний\n\n```\n" + "\n".join(report) + "\n```\n")
