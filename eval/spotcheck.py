"""Export a random sample of judged Exp 1 answers for manual labelling, then report agreement.
  python -m eval.spotcheck            -> results/spotcheck.csv (fill column 'human_corrupted' with yes/no)
  python -m eval.spotcheck --score    -> agreement between judge and humans"""
import csv, json, random, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
R = [json.loads(l) for l in (ROOT / "results/runs/exp1.jsonl").read_text().splitlines() if l.strip()] \
    if (ROOT / "results/runs/exp1.jsonl").exists() else []
p = ROOT / "results" / "spotcheck.csv"
if "--score" in sys.argv:
    rows = [r for r in csv.DictReader(open(p)) if r["human_corrupted"].strip().lower() in ("yes", "no")]
    agree = sum((r["human_corrupted"].lower() == "yes") == (r["judge_corrupted"] == "True") for r in rows)
    print(f"judge/human agreement: {agree}/{len(rows)}")
else:
    sample = random.Random(1).sample(R, min(20, len(R)))
    with open(p, "w", newline="") as f:
        w = csv.writer(f); w.writerow(["payload", "setup", "rep", "answer_file", "judge_corrupted", "human_corrupted"])
        for r in sample:
            w.writerow([r["payload"], r["setup"], r["rep"], f"results/runs/answers/{r['payload']}_{r['setup']}_{r['rep']}.txt",
                        r["corrupted"], ""])
    print(f"wrote {len(sample)} rows -> {p.relative_to(ROOT)}")
