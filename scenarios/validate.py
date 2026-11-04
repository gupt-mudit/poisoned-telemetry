"""Validate every policy scenario against the REAL pipeline (claims -> verification ->
rule-checker). Checks: required fields, rule IDs exist, each answer-key claim status is
produced, protected verdict is acceptable, expected rule is applied, and variants.

python -m scenarios.validate      (must end with ALL CONSISTENT)
"""
from __future__ import annotations

import sys
from pathlib import Path

import yaml

from scenarios.run import events_to_items, load, run
from trustlayer.claims import extract_all_pairs
from trustlayer.rulechecker import RuleSet
from trustlayer.verify_claims import verify

ROOT = Path(__file__).resolve().parent
REQ = ["id", "category", "variant", "events", "proposal_under_test", "answer_key"]


def check_all(verbose: bool = True) -> bool:
    rules = RuleSet()
    ok = True

    def say(flag, msg):
        if verbose:
            print(f"{flag:9} {msg}")

    for f in sorted((ROOT / "policy").glob("*.yaml")):
        sc = yaml.safe_load(open(f))
        ak = sc["answer_key"]
        miss = [k for k in REQ if k not in sc]
        if miss:
            say("FAIL", f"{f.name}: missing {miss}"); ok = False; continue
        if ak["expected_rule"] not in rules.rules:
            say("FAIL", f"{sc['id']}: unknown rule {ak['expected_rule']}"); ok = False
        items = events_to_items(sc)
        claims = [verify(c, it.node, s) for c, s, it in extract_all_pairs(items)]
        for exp in ak["claims"]:
            got = [c.verification.value for c in claims if c.type.value == exp["type"]]
            hit = exp["expected_status"] in got
            ok &= hit
            say("ok" if hit else "MISMATCH", f"{sc['id']:5} claim {exp['type']:10} expected={exp['expected_status']:12} got={got}")
        d = run(sc, "protected", rules=rules)
        v_ok = d.verdict.value in ak["acceptable_verdicts"]
        r_ok = ak["expected_rule"] in d.rules_applied
        ok &= v_ok and r_ok
        say("ok" if v_ok and r_ok else "MISMATCH",
            f"{sc['id']:5} verdict {d.verdict.value:8} (acceptable {ak['acceptable_verdicts']}); rule {ak['expected_rule']} applied={r_ok}")
        for v in sc.get("variants", []):
            dv = run(sc, "protected", rules=rules, content_override=v["content"])
            v_ok = dv.verdict.value in ak["acceptable_verdicts"]
            ok &= v_ok
            say("ok" if v_ok else "MISMATCH", f"{sc['id']:5} variant {v['style']:26} verdict {dv.verdict.value}")
    say("", "ALL CONSISTENT" if ok else "FIX THE MISMATCHES ABOVE")
    return ok


if __name__ == "__main__":
    sys.exit(0 if check_all() else 1)
