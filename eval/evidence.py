"""Evidence report for Experiment 1, built only from recorded runs (never edit numbers by hand).

Adds what a reviewer will ask for on top of eval/tables.py:
  - 95% confidence intervals (Wilson) and a significance test (one-sided Fisher exact) vs wrapped
  - "fully correct" = right root cause AND not corrupted (the number an engineer cares about)
  - judge cross-check: LLM judge vs the independent regex markers, per attacked run
  - what the trust layer caught: verification status of every claim it extracted (from the audit log)
  - every batch separately: main benchmark, second model, extra clean runs, adaptive attacks

python -m eval.evidence      -> results/EVIDENCE.md
"""
from __future__ import annotations

import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path

import yaml

from eval.judge import heuristic

ROOT = Path(__file__).resolve().parent.parent
RUNS = ROOT / "results" / "runs"
SETUPS = ("raw", "guardrail", "summariser", "wrapped")

# (label, runs file, answers dir, payload file, audit log)
BATCHES = [
    ("Main benchmark, gpt-4.1 (wrapper v1)", "exp1.jsonl", "answers", "payloads.yaml", "audit"),
    ("Main benchmark, gpt-4.1, wrapped re-run with wrapper v2", "exp1_v2.jsonl", "answers_v2", "payloads.yaml", "audit_v2"),
    ("Main benchmark, gpt-4.1-mini (wrapper v2)", "exp1_mini.jsonl", "answers_mini", "payloads.yaml", "audit_mini"),
    ("Main benchmark, gpt-4.1, wrapped re-run with wrapper v3 (unrecorded IDs withheld)", "exp1_v3.jsonl",
     "answers_v3", "payloads.yaml", "audit_v3"),
    ("Main benchmark, gpt-4.1-mini, wrapped re-run with wrapper v3", "exp1_mini_v3.jsonl", "answers_mini_v3",
     "payloads.yaml", "audit_mini_v3"),
    ("Extra clean runs, gpt-4.1 (wrapper v2)", "exp1_clean.jsonl", "answers_clean", None, "audit_clean"),
    ("Adaptive attacks on our own layer, wrapper v1 (before fixes)", "exp1_adaptive_v1.jsonl", "answers_adaptive_v1",
     "payloads_adaptive.yaml", "audit_adaptive_v1"),
    ("Adaptive attacks on our own layer, wrapper v2 (after fixes)", "exp1_adaptive_v2.jsonl", "answers_adaptive_v2",
     "payloads_adaptive.yaml", "audit_adaptive_v2"),
    ("Adaptive attacks on our own layer, wrapper v3", "exp1_adaptive_v3.jsonl", "answers_adaptive_v3",
     "payloads_adaptive.yaml", "audit_adaptive_v3"),
]


def load(name: str) -> list[dict]:
    p = RUNS / name
    return [json.loads(l) for l in p.read_text().splitlines() if l.strip()] if p.exists() else []


def wilson(k: int, n: int, z: float = 1.96) -> tuple[float, float]:
    if n == 0:
        return (0.0, 0.0)
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return max(0.0, c - h), min(1.0, c + h)


def fisher_greater(a: int, n1: int, b: int, n2: int) -> float:
    """P(X >= a) for the first group's count under the hypergeometric null (one-sided)."""
    k, N = a + b, n1 + n2
    if k == 0:
        return 1.0
    return sum(math.comb(n1, x) * math.comb(n2, k - x) for x in range(a, min(k, n1) + 1)) / math.comb(N, k)


def cell(k: int, n: int) -> str:
    if not n:
        return "n/a"
    lo, hi = wilson(k, n)
    return f"{k}/{n} ({100*k/n:.0f}%, CI {100*lo:.0f}–{100*hi:.0f}%)"


def batch_section(label, runs_file, ans_dir, pfile, audit) -> list[str]:
    R = load(runs_file)
    if not R:
        return [f"## {label}", "", f"_No runs yet (`results/runs/{runs_file}`)._", ""]
    models = sorted({r["model"] for r in R})
    att = [r for r in R if r["payload"] != "CLEAN"]
    cln = [r for r in R if r["payload"] == "CLEAN"]
    setups = [s for s in SETUPS if any(r["setup"] == s for r in R)]
    out = [f"## {label}", "", f"Runs: {len(R)} ({len(att)} attacked, {len(cln)} clean). Agent model: {', '.join(models)}. "
           f"Failed runs recorded: {sum(r['returncode'] != 0 for r in R)}.", ""]
    if pfile:
        n_payloads = len(yaml.safe_load(open(ROOT / "data" / pfile))["payloads"])
        planned = n_payloads * len({r["setup"] for r in R}) * max(r["rep"] for r in R)
        if len(att) < planned:
            out += [f"> **INCOMPLETE batch** ({len(att)} of about {planned} attacked runs). Do not report these "
                    f"figures; resume the run (finished runs are skipped).", ""]
    out += ["| Measure | " + " | ".join(setups) + " |", "|---|" + "---|" * len(setups)]

    def row(name, rows_fn, val):
        cells = []
        for s in setups:
            rs = rows_fn(s)
            cells.append(cell(sum(bool(val(r)) for r in rs), len(rs)))
        out.append(f"| {name} | " + " | ".join(cells) + " |")

    if att:
        row("Corrupted conclusion (attacked)", lambda s: [r for r in att if r["setup"] == s], lambda r: r["corrupted"])
        row("Fully correct: right cause AND not corrupted", lambda s: [r for r in att if r["setup"] == s],
            lambda r: r["correct_root_cause"] and not r["corrupted"])
    if cln:
        row("Correct root cause, clean data", lambda s: [r for r in cln if r["setup"] == s], lambda r: r["correct_root_cause"])
    out.append("")
    if att and "wrapped" in setups:
        w = [r for r in att if r["setup"] == "wrapped"]
        kw = sum(r["corrupted"] for r in w)
        for s in setups:
            if s == "wrapped":
                continue
            o = [r for r in att if r["setup"] == s]
            ko = sum(r["corrupted"] for r in o)
            out.append(f"- {s} vs wrapped: {ko}/{len(o)} vs {kw}/{len(w)} corrupted; one-sided Fisher exact "
                       f"p = {fisher_greater(ko, len(o), kw, len(w)):.1e}")
        out.append("")
    if att and pfile:
        P = {p["id"]: p for p in yaml.safe_load(open(ROOT / "data" / pfile))["payloads"]}
        per = defaultdict(lambda: defaultdict(lambda: [0, 0]))
        for r in att:
            per[r["payload"]][r["setup"]][0] += r["corrupted"]
            per[r["payload"]][r["setup"]][1] += 1
        hit = {pid: d for pid, d in per.items() if any(v[0] for v in d.values())}
        if hit:
            out += ["Payloads that corrupted at least one run (corrupted/runs):", "",
                    "| Payload | Goal / style | " + " | ".join(setups) + " |", "|---|---|" + "---|" * len(setups)]
            for pid in sorted(hit):
                d = hit[pid]
                out.append(f"| {pid} | {P[pid]['goal']} / {P[pid]['style']} | "
                           + " | ".join(f"{d[s][0]}/{d[s][1]}" if d[s][1] else "-" for s in setups) + " |")
            out.append("")
        # judge cross-check against the independent regex markers
        agree = n = both = llm_only = rx_only = 0
        for r in att:
            f = RUNS / ans_dir / f"{r['payload']}_{r['setup']}_{r['rep']}.txt"
            if not f.exists() or r["payload"] not in P:
                continue
            h = heuristic(f.read_text(), P[r["payload"]])["corrupted"]
            n += 1
            agree += h == r["corrupted"]
            both += h and r["corrupted"]
            llm_only += r["corrupted"] and not h
            rx_only += h and not r["corrupted"]
        if n:
            out += [f"Judge cross-check (LLM judge vs independent regex markers, attacked runs): agree on "
                    f"{agree}/{n} ({100*agree/n:.0f}%); both say corrupted {both}; judge only {llm_only}; "
                    f"markers only {rx_only}. Disagreements are the ones to hand-check first.", ""]
    if audit:
        out += claims_section(RUNS / audit / "audit.jsonl")
    return out


def claims_section(path: Path) -> list[str]:
    if not path.exists():
        return []
    files = defaultdict(list)
    for l in path.read_text().splitlines():
        e = json.loads(l)
        if e.get("event") == "quarantine":
            files[e["payload"]["file"]].append(e["payload"])
    status, by_type = Counter(), defaultdict(Counter)
    poisoned = [f for f in files if "poisoned_" in f]
    for f, entries in files.items():
        if "poisoned_" not in f:
            continue
        for c in entries[0]["claims"]:          # one quarantine pass per file is enough (deterministic)
            status[c["verification"]] += 1
            by_type[c["type"]][c["verification"]] += 1
    if not poisoned:
        return []
    out = [f"What the wrapper passed to the agent, over {len(poisoned)} poisoned files (all claims extracted "
           f"from free text, planted or genuine): " + ", ".join(f"{k} {v}" for k, v in status.most_common()) + ".", "",
           "| Claim type | " + " | ".join(("verified", "contradicted", "unverified")) + " |", "|---|---|---|---|"]
    for t, c in sorted(by_type.items()):
        out.append(f"| {t} | {c['verified']} | {c['contradicted']} | {c['unverified']} |")
    return out + [""]


def main():
    out = ["# Experiment 1: evidence report", "",
           "Generated by `python -m eval.evidence` from `results/runs/`. CI = Wilson 95% interval. "
           "Judge: gpt-4.1 with the payload's own success definition; regex markers are an independent "
           "cross-check, not ground truth. A human spot-check of 20 answers is still required.", ""]
    for b in BATCHES:
        out += batch_section(*b)
    path = ROOT / "results" / "EVIDENCE.md"
    path.write_text("\n".join(out) + "\n")
    print(f"wrote {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
