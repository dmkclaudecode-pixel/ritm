#!/usr/bin/env python3
"""Английские бытовые/эмпатичные диалоги → русский (машинный перевод opus-mt-en-ru), для обучения подбора реакции.
Режимы:  fetch OUT       — скачать диалоги, разложить в OUT/dialogs_en.json и OUT/sentences.json
         translate IN SHARD SHARDS OUT — перевести долю уникальных предложений
         merge  FETCHED SHARDS_DIR OUT — собрать русские диалоги, отфильтровать
Источники (пробуем по очереди, всё логируем): empathetic_dialogues (эмоции + отклик), dailydialog (быт).  Лицензии NC — личное использование."""
import json, os, re, sys, glob, hashlib, collections, itertools

def log(*a): print(*a, flush=True)

def norm_turns(x):
    """любая запись → список строк"""
    if isinstance(x, list):
        out = []
        for t in x:
            if isinstance(t, str): out.append(t)
            elif isinstance(t, dict): out.append(str(t.get("content") or t.get("text") or t.get("utterance") or ""))
        return [t.strip() for t in out if t and t.strip()]
    return []

def fetch(out):
    os.makedirs(out, exist_ok=True)
    from huggingface_hub import list_repo_files, hf_hub_download
    import pandas as pd
    dialogs = []
    cands = [("empathetic", ["Estwld/empathetic_dialogues_llm", "bdotloh/empathetical-dialogues", "facebook/empathetic_dialogues"]),
             ("daily", ["roskoN/dailydialog", "ConvLab/dailydialog", "li2017dailydialog/daily_dialog", "frgfm/dailydialog"])]
    for kind, repos in cands:
        got = False
        for repo in repos:
            try:
                files = list_repo_files(repo, repo_type="dataset"); log(kind, repo, "files:", files[:30])
            except Exception as e:
                log(kind, repo, "недоступен:", repr(e)[:120]); continue
            data = [f for f in files if re.search(r"\.(parquet|jsonl?|csv)$", f) and not re.search(r"README|dataset_infos", f)]
            n0 = len(dialogs)
            for f in data:
                try:
                    p = hf_hub_download(repo, f, repo_type="dataset")
                    if f.endswith(".parquet"): df = pd.read_parquet(p)
                    elif f.endswith(".csv"): df = pd.read_csv(p)
                    else: df = pd.read_json(p, lines=f.endswith(".jsonl"))
                except Exception as e:
                    log("  не прочитан", f, repr(e)[:100]); continue
                log("  ", f, df.shape, list(df.columns)[:12])
                cols = {c.lower(): c for c in df.columns}
                for _, r in df.iterrows():
                    turns = None
                    for key in ("conversations", "conversation", "dialog", "dialogue", "utterances", "messages", "turns"):
                        if key in cols:
                            v = r[cols[key]]
                            try: v = list(v)
                            except Exception: continue
                            turns = norm_turns(v)
                            if turns: break
                    if not turns and {"utterance", "conv_id"} <= set(cols):   # построчный формат empathetic_dialogues
                        continue
                    if turns and len(turns) >= 2:
                        emo = str(r[cols["emotion"]]) if "emotion" in cols else (str(r[cols["context"]]) if "context" in cols else "")
                        dialogs.append({"src": kind, "repo": repo, "emotion": emo, "turns": turns})
            log(kind, repo, "диалогов:", len(dialogs) - n0)
            if len(dialogs) > n0: got = True; break
        if not got: log("ВНИМАНИЕ: нет данных для", kind)
    sents = sorted({t for d in dialogs for t in d["turns"]})
    json.dump(dialogs, open(os.path.join(out, "dialogs_en.json"), "w", encoding="utf-8"), ensure_ascii=False)
    json.dump(sents, open(os.path.join(out, "sentences.json"), "w", encoding="utf-8"), ensure_ascii=False)
    log("диалогов", len(dialogs), "уникальных предложений", len(sents))

def translate(inp, shard, shards, out):
    import torch
    from transformers import MarianMTModel, MarianTokenizer
    torch.set_num_threads(int(os.environ.get("THREADS", "4")))
    sents = json.load(open(os.path.join(inp, "sentences.json"), encoding="utf-8"))
    mine = [s for i, s in enumerate(sents) if i % shards == shard]
    limit = int(os.environ.get("LIMIT", "0"))
    if limit: mine = mine[:limit]
    name = "Helsinki-NLP/opus-mt-en-ru"; tok = MarianTokenizer.from_pretrained(name); model = MarianMTModel.from_pretrained(name).eval()
    mine.sort(key=len); res = {}; B = 48
    for i in range(0, len(mine), B):
        b = mine[i:i + B]
        with torch.no_grad():
            enc = tok(b, return_tensors="pt", padding=True, truncation=True, max_length=96)
            gen = model.generate(**enc, num_beams=1, max_new_tokens=80, no_repeat_ngram_size=3)
        for s, t in zip(b, tok.batch_decode(gen, skip_special_tokens=True)): res[s] = t
        if (i // B) % 50 == 0: log(f"shard {shard}: {i}/{len(mine)}")
    os.makedirs(out, exist_ok=True)
    json.dump(res, open(os.path.join(out, f"tr_{shard}.json"), "w", encoding="utf-8"), ensure_ascii=False)
    log("готово", len(res))

BAD = re.compile(r"(хуй|хуе|хуя|пизд|блят|бляд|ебал|ебат|ебан|сука|суки|мудак|пидор|залуп|шлюх|дроч|говн|срать|жопа|трахн|сиськ|нахуй)", re.I)
def good(ru, en):
    if re.search(r"[A-Za-z]{2,}", ru): return False
    w = re.findall(r"[а-яё]+", ru, re.I); e = re.findall(r"[a-z']+", en, re.I)
    if not w or len(w) > 40 or BAD.search(ru): return False
    if e and not (0.45 <= len(w) / len(e) <= 2.6): return False
    c = collections.Counter(x.lower() for x in w)
    if c and c.most_common(1)[0][1] > 4 and len(w) > 8: return False       # зацикленный перевод
    if re.search(r"(.{3,})\1\1", ru): return False
    return True

def merge(fetched, shards_dir, out):
    os.makedirs(out, exist_ok=True)
    tr = {}
    for f in glob.glob(os.path.join(shards_dir, "**", "tr_*.json"), recursive=True): tr.update(json.load(open(f, encoding="utf-8")))
    dialogs = json.load(open(os.path.join(fetched, "dialogs_en.json"), encoding="utf-8"))
    kept = []; dropped = 0
    for d in dialogs:
        ru = []
        for t in d["turns"]:
            r = tr.get(t)
            if r is None or not good(r, t): ru = None; break
            ru.append(r.strip())
        if not ru: dropped += 1; continue
        kept.append({"src": d["src"], "emotion": d["emotion"], "turns": ru})
    log("переведено предложений", len(tr), "диалогов оставлено", len(kept), "отброшено", dropped)
    with open(os.path.join(out, "dialogs_ru.jsonl"), "w", encoding="utf-8") as fo:
        for d in kept: fo.write(json.dumps(d, ensure_ascii=False) + "\n")
    import random; random.seed(3); smp = random.sample(kept, min(60, len(kept)))
    with open(os.path.join(out, "sample.txt"), "w", encoding="utf-8") as fo:
        for d in smp:
            fo.write(f"## {d['src']} | {d['emotion']}\n" + "\n".join(("U: " if i % 2 == 0 else "B: ") + t for i, t in enumerate(d["turns"])) + "\n\n")
    open(os.path.join(out, "REPORT.md"), "w", encoding="utf-8").write(f"# Диалоги RU (машинный перевод)\n\nдиалогов: {len(kept)}, отброшено: {dropped}, предложений переведено: {len(tr)}\n")

if __name__ == "__main__":
    m = sys.argv[1]
    if m == "fetch": fetch(sys.argv[2])
    elif m == "translate": translate(sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5])
    elif m == "merge": merge(sys.argv[2], sys.argv[3], sys.argv[4])
