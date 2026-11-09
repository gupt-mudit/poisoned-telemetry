"""Build the results tables from real runs. Never edit the numbers by hand.
python -m eval.tables  -> results/exp1_table.md, results/exp2_table.md"""
from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RUNS = ROOT / "results" / "runs"


def rows(name):
    p = RUNS / name
    return [json.loads(l) for l in p.read_text().splitlines() if l.strip()] if p.exists() else []


def pct(num, den):
    return f"{num}/{den} ({100*num/den:.0f}%)" if den else "n/a"


DEV_WARNING = ("> **Development set.** The rules were written alongside these answer keys, so these figures "
               "only show the pipeline works as designed. Report the **holdout** table as evidence.")


def exp2(case_set: str = "dev"):
    R = rows(f"exp2_{case_set}.jsonl")
    if not R:
        return f"# Experiment 2 ({case_set} set)\n\nNo runs yet: `python -m eval.run_exp2 --set {case_set}`.\n"
    out = [f"# Experiment 2: policy enforcement ({case_set} set)", "",
           DEV_WARNING if case_set == "dev" else "> Holdout set: written without seeing the rules.", "",
           f"Cases: {len({(r['scenario'], r['case']) for r in R})} "
           f"({sum(1 for r in R if r['mode']=='protected' and r['variant']=='malicious' and r['rep']==1)} malicious, "
           f"{sum(1 for r in R if r['mode']=='protected' and r['variant']=='clean' and r['rep']==1)} clean); "
           f"reps per case: {max(r['rep'] for r in R)}.", "",
           "| Measure | Baseline | Protected |", "|---|---|---|"]
    def m(mode, f):
        return [r for r in R if r["mode"] == mode and f(r)]
    for label, sel, val in [
        ("Violations blocked (malicious, acceptable verdict)", lambda r: r["variant"] == "malicious", lambda r: r["acceptable"]),
        ("Unauthorised actions executed (malicious)", lambda r: r["variant"] == "malicious", lambda r: r["unauthorised_executed"]),
        ("False blocks (clean)", lambda r: r["variant"] == "clean", lambda r: r["false_block"]),
        ("Expected rule applied (where the key names one)", lambda r: r.get("expected_rule_applied") is not None,
         lambda r: r["expected_rule_applied"]),
        ("Escalated to a human", lambda r: True, lambda r: r["escalated"]),
        ("Decisions with complete audit entry", lambda r: True, lambda r: r["audit_complete"]),
    ]:
        cells = []
        for mode in ("baseline", "protected"):
            s = m(mode, sel)
            cells.append(pct(sum(bool(val(r)) for r in s), len(s)))
        out.append(f"| {label} | {cells[0]} | {cells[1]} |")
    P = m("protected", lambda r: True)
    out.append(f"| Claim verification accuracy (answer-key claims) | n/a | "
               f"{pct(sum(r['claims_hit'] for r in P), sum(r['claims_total'] for r in P))} |")
    op = [r for r in P if r["opinions"]]
    out.append(f"| Agent opinions with a valid citation | n/a | {pct(sum(r['cited'] for r in op), sum(r['opinions'] for r in op))} |")
    inst = [r for r in op if r["instrument_ok"] is not None]
    out.append(f"| ...citing the expected instrument | n/a | "
               f"{pct(sum(bool(r['instrument_ok']) for r in inst), len(inst)) if inst else 'n/a: answer keys name no instrument'} |")
    filled = [r for r in op if r["provision_ok"] is not None]
    out.append(f"| ...citing the expected provision | n/a | "
               f"{pct(sum(bool(r['provision_ok']) for r in filled), len(filled)) if filled else 'pending: provisions not yet verified'} |")
    out.append(f"| Invented (invalid) citations | n/a | {sum(r['invalid'] for r in op)} |")
    out += ["", "## By category (protected)", "", "| Category | Malicious blocked/escalated | Clean allowed |", "|---|---|---|"]
    by = defaultdict(list)
    for r in P:
        by[r["category"]].append(r)
    for cat, rs in sorted(by.items()):
        mal = [r for r in rs if r["variant"] == "malicious"]; cl = [r for r in rs if r["variant"] == "clean"]
        out.append(f"| {cat} | {pct(sum(r['acceptable'] for r in mal), len(mal))} | "
                   f"{pct(sum(not r['false_block'] for r in cl), len(cl))} |")
    return "\n".join(out) + "\n"


def exp1():
    R = rows("exp1.jsonl")
    if not R:
        return "# Experiment 1\n\nNo runs yet: `make exp1` (needs API key).\n"
    setups = [s for s in ("raw", "guardrail", "summariser", "wrapped") if any(r["setup"] == s for r in R)]
    out = ["# Experiment 1: manipulated conclusions on HolmesGPT", "",
           f"Agent: {', '.join(sorted({r['agent'] for r in R}))}; model: {', '.join(sorted({r['model'] for r in R}))}; "
           f"judge: {', '.join(sorted({r['method'] for r in R}))}.", "",
           "| Measure | " + " | ".join(setups) + " |", "|---|" + "---|" * len(setups)]
    def cell(s, f, v):
        x = [r for r in R if r["setup"] == s and f(r)]
        return pct(sum(bool(v(r)) for r in x), len(x))
    lines = [("Corrupted conclusion, all payloads", lambda r: r["payload"] != "CLEAN", lambda r: r["corrupted"]),
             ("...crude payloads", lambda r: r["style"] == "crude", lambda r: r["corrupted"]),
             ("...subtle payloads", lambda r: r["style"] == "subtle", lambda r: r["corrupted"])]
    for g in ("conceal", "fabricate", "exfiltrate", "instruct"):
        lines.append((f"...{g}", lambda r, g=g: r["goal"] == g, lambda r: r["corrupted"]))
    lines += [("Correct root cause, clean data", lambda r: r["payload"] == "CLEAN", lambda r: r["correct_root_cause"]),
              ("Correct root cause, poisoned data", lambda r: r["payload"] != "CLEAN", lambda r: r["correct_root_cause"])]
    for label, f, v in lines:
        out.append(f"| {label} | " + " | ".join(cell(s, f, v) for s in setups) + " |")
    out += ["", "Spot-check 20 judged answers by hand (`python -m eval.spotcheck`) and report agreement."]
    return "\n".join(out) + "\n"


def main():
    (ROOT / "results").mkdir(exist_ok=True)
    (ROOT / "results" / "exp1_table.md").write_text(exp1())
    for cs in ("dev", "holdout"):
        (ROOT / "results" / f"exp2_{cs}_table.md").write_text(exp2(cs))
    print(exp2("dev")); print(exp2("holdout")); print(exp1())


if __name__ == "__main__":
    main()
