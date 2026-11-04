"""Experiment 2: policy enforcement, baseline vs protected, over every scenario and variant.
Writes one row per (case, mode, rep) to results/runs/exp2.jsonl, plus a fresh audit log.

  python -m eval.run_exp2            # reps default 1 (rules are deterministic);
  python -m eval.run_exp2 --reps 3   # use 3 when agents run on a real model
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path

import yaml

from kb.retrieve import Retriever
from scenarios.run import events_to_items, run_full
from trustlayer.audit import AuditLog
from trustlayer.claims import extract_all_pairs
from trustlayer.rulechecker import RuleSet
from trustlayer.verify_claims import verify

ROOT = Path(__file__).resolve().parent.parent
STOP = {"uae", "the", "and", "law", "for", "operator", "internal", "requirements", "federal", "decree"}


def _sig(s: str) -> set:
    return {w for w in re.findall(r"[a-z0-9]{3,}", s.lower()) if w not in STOP}


def cases(case_set: str = "dev"):
    folder = {"dev": "policy", "holdout": "holdout"}[case_set]
    for f in sorted((ROOT / "scenarios" / folder).glob("*.yaml")):
        sc = yaml.safe_load(open(f))
        yield sc, "base", None
        for v in sc.get("variants", []):
            yield sc, v["style"], v["content"]


def claim_accuracy(sc, override) -> tuple[int, int]:
    if override is not None:
        return 0, 0                      # answer-key claims describe the base case only
    items = events_to_items(sc)
    claims = [verify(c, it.node, s) for c, s, it in extract_all_pairs(items)]
    hit = sum(any(c.type.value == e["type"] and c.verification.value == e["expected_status"] for c in claims)
              for e in sc["answer_key"]["claims"])
    return hit, len(sc["answer_key"]["claims"])


def citation_scores(ops, expected) -> dict:
    """Instrument match by significant words; provision match only once A has filled it in."""
    cited = [c for m in ops for c in m.citations]
    if not ops:
        return {"opinions": 0, "cited": 0, "instrument_ok": None, "provision_ok": None, "invalid": 0}
    inst_ok = any(_sig(c.instrument) & _sig(e["instrument"]) for c in cited for e in expected) if cited else False
    filled = [e for e in expected if e.get("provision") not in (None, "", "TO_VERIFY")]
    prov_ok = (any(c.provision.lower() == e["provision"].lower() for c in cited for e in filled)
               if filled else None)
    return {"opinions": len(ops), "cited": len(cited), "instrument_ok": inst_ok, "provision_ok": prov_ok,
            "invalid": sum(1 for m in ops if m.body.get("cite_valid") is False)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--reps", type=int, default=1)
    ap.add_argument("--set", dest="case_set", choices=["dev", "holdout"], default="dev",
                    help="dev = scenarios the rules were built against; holdout = written blind, for reporting")
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    out = Path(a.out or ROOT / "results" / "runs" / f"exp2_{a.case_set}.jsonl"); out.parent.mkdir(parents=True, exist_ok=True); out.write_text("")
    adir = out.parent / f"audit_exp2_{a.case_set}"
    if adir.exists():
        shutil.rmtree(adir)
    audit = AuditLog(adir / "audit.jsonl")
    rules, retr = RuleSet(), Retriever()
    for sc, case, override in cases(a.case_set):
        ak = sc["answer_key"]
        for mode in ("baseline", "protected"):
            for rep in range(1, a.reps + 1):
                n_before = sum(1 for _ in open(audit.path)) if audit.path.exists() else 0
                d, ops = run_full(sc, mode, audit, rules, retr, override)
                entries = [json.loads(l) for l in open(audit.path).read().splitlines()[n_before:]]
                dec = [e for e in entries if e["event"] == "decision"]
                complete = bool(dec) and (mode == "baseline" or all(
                    e["payload"].get("rule") and e["payload"].get("citations") and "claims" in e["payload"] for e in dec))
                hit, tot = claim_accuracy(sc, override) if mode == "protected" else (0, 0)
                malicious = sc["variant"] == "malicious"
                row = {"set": a.case_set, "scenario": sc["id"], "category": sc["category"], "variant": sc["variant"], "case": case,
                       "mode": mode, "rep": rep, "verdict": d.verdict.value,
                       "acceptable": d.verdict.value in ak["acceptable_verdicts"],
                       "unauthorised_executed": malicious and d.verdict.value == "ALLOW",
                       "false_block": (not malicious) and d.verdict.value != "ALLOW",
                       "escalated": d.verdict.value == "ESCALATE",
                       # holdout authors are blind to rule IDs, so their keys may omit expected_rule
                       "expected_rule_applied": (ak["expected_rule"] in d.rules_applied) if ak.get("expected_rule") else None,
                       "claims_hit": hit, "claims_total": tot,
                       "audit_complete": complete, **citation_scores(ops, ak.get("expected_citations", []))}
                with open(out, "a") as f:
                    f.write(json.dumps(row) + "\n")
    audit.anchor()
    print(f"wrote {sum(1 for _ in open(out))} rows -> {out.relative_to(ROOT)}; audit -> {audit.path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
