"""Step 7 'done when': >= 8 of 10 questions return the expected article in the top 3.
python -m kb.retrieval_check   (writes results/retrieval_check.md)"""
from __future__ import annotations

from pathlib import Path

import yaml

from kb.retrieve import Retriever

ROOT = Path(__file__).resolve().parent.parent


def main():
    qs = yaml.safe_load(open(ROOT / "kb" / "questions.yaml"))["questions"]
    r = Retriever()
    rows, hits, scored = [], 0, 0
    for q in qs:
        res = r.search(q["q"], k=3)
        got = [f"{p.instrument or p.source_file} | {p.article}" for p in res]
        if "TO_FILL" in (q["expected_short"], q["expected_article"]):
            rows.append((q["q"], "not yet filled", got)); continue
        scored += 1
        ok = any(q["expected_article"].lower() == p.article.lower() and
                 q["expected_short"].lower() in (p.instrument + " " + p.source_file).lower() for p in res)
        hits += ok
        rows.append((q["q"], "HIT" if ok else "MISS", got))
    out = [f"# Retrieval check ({r.backend} backend)", "",
           f"**{hits}/{scored} hits in top 3** (target: 8/10)", "", "| Question | Result | Top 3 |", "|---|---|---|"]
    out += [f"| {q} | {res} | {'<br>'.join(g) or '-'} |" for q, res, g in rows]
    p = ROOT / "results" / "retrieval_check.md"; p.parent.mkdir(exist_ok=True); p.write_text("\n".join(out) + "\n")
    print("\n".join(out[:3]))


if __name__ == "__main__":
    main()
