"""Scenario runner for Experiment 2 (policy enforcement).

A scenario controller releases each event, at its time, only to its addressee. Untrusted
events pass through the trust layer (claims + verification); the operations agent's proposal
(proposal_under_test) is judged by the rule-checker; institutional agents add cited opinions;
every step is written to the hash-chained audit log.

modes:  baseline   the proposal goes through unchecked (what happens today)
        protected  claim verification + cited rules + rule-checker

python -m scenarios.run S1_maintenance_malicious --mode protected
"""
from __future__ import annotations

import argparse
import re
from datetime import datetime, timedelta
from pathlib import Path

import yaml

from trustlayer.audit import AuditLog
from trustlayer.claims import extract_all_pairs
from trustlayer.models import Channel, Decision, ProposedAction, TelemetryItem, Verdict
from trustlayer.rulechecker import RuleSet, evaluate
from trustlayer.verify_claims import verify

ROOT = Path(__file__).resolve().parent
DEFAULT_BASE = "2026-11-02T14:05:00Z"


def load(name: str) -> dict:
    p = ROOT / "policy" / (name if name.endswith(".yaml") else name + ".yaml")
    return yaml.safe_load(open(p))


def events_to_items(sc: dict) -> list[TelemetryItem]:
    base = datetime.fromisoformat(sc.get("base_time", DEFAULT_BASE).replace("Z", "+00:00"))
    items = []
    for n, e in enumerate(sorted(sc["events"], key=lambda e: e["t"]), 1):
        text = e["content"]
        node = (re.findall(r"\b(?:PE|CE|RR)-\d+\b", e["source"] + " " + text) or [None])[0]
        kind = {"telemetry": "alarm", "ticket": "ticket", "agent": "request"}[e["channel"]]
        items.append(TelemetryItem(id=f"{sc['id']}-E{n}", ts=base + timedelta(seconds=e["t"]),
                                   channel=Channel(e["channel"]), source=e["source"], kind=kind,
                                   node=node, text=text))
    return items


def run(sc: dict, mode: str = "protected", audit: AuditLog | None = None, rules: RuleSet | None = None,
        content_override: str | None = None) -> Decision:
    rules = rules or RuleSet()
    items = events_to_items(sc)
    if content_override is not None:            # variant: swap the payload carrier's text
        items[-1] = items[-1].model_copy(update={"text": content_override})
    if audit:
        for it in items:   # controller releases each event to its addressee only
            audit.append("event_released", "scenario-controller",
                         {"scenario": sc["id"], "item": it.id, "channel": it.channel.value, "source": it.source},
                         source_text=it.text)
    proposal = ProposedAction(**sc["proposal_under_test"])
    if mode == "baseline":
        d = Decision(proposed=proposal, rule_id="NONE", verdict=Verdict.ALLOW,
                     reasons=["baseline: no verification or policy check"])
    else:
        claims = [verify(c, it.node, s) for c, s, it in extract_all_pairs(items)]
        d = evaluate(proposal, claims, rules)
    if audit:
        audit.append("decision", "rule-checker" if mode == "protected" else "none",
                     {"scenario": sc["id"], "mode": mode, "verdict": d.verdict.value, "rule": d.rule_id,
                      "rules_applied": d.rules_applied,
                      "citations": [c.model_dump() for c in d.citations],
                      "claims": [{"id": c.id, "type": c.type.value, "status": c.verification.value,
                                  "evidence": c.evidence} for c in d.claims],
                      "reasons": d.reasons})
    return d


def run_full(sc: dict, mode: str = "protected", audit: AuditLog | None = None, rules: RuleSet | None = None,
             retriever=None, content_override: str | None = None):
    """Decision plus institutional opinions (protected mode only; baseline has no checks)."""
    from agents.institutional import opinion, route
    d = run(sc, mode, audit, rules, content_override)
    ops = []
    if mode == "protected":
        for agent in route(d):
            m = opinion(agent, d, retriever)
            ops.append(m)
            if audit:
                audit.append("opinion", agent, {"scenario": sc["id"], **m.body,
                                                "citations": [c.model_dump() for c in m.citations]})
    return d, ops


def show(d: Decision) -> str:
    """The five things every decision shows."""
    p = d.proposed
    lines = [f"1 PROPOSED   {p.action} {p.target}".rstrip()
             + (f" -> {p.destination}" if p.destination else "")
             + (f" (claims authority: {p.claimed_authority})" if p.claimed_authority else "")]
    lines.append("2 CLAIMS")
    lines += [f"    [{c.verification.value.upper():12}] {c.source}: {c.text}\n                   evidence: {c.evidence}"
              for c in d.claims] or ["    (none checked)"]
    lines.append(f"3 RULE       {d.rule_id}  (applied: {', '.join(d.rules_applied) or '-'})")
    lines += [f"    cites: {c.instrument} | provision: {c.provision}" for c in d.citations]
    lines.append(f"4 AUTHORITY  {d.authority or '-'}")
    lines.append(f"5 VERDICT    {d.verdict.value}" + ("  (human required)" if d.requires_human else ""))
    lines += [f"    {r}" for r in d.reasons]
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("scenario")
    ap.add_argument("--mode", choices=["baseline", "protected"], default="protected")
    ap.add_argument("--audit", default="audit/audit.jsonl")
    a = ap.parse_args()
    sc = load(a.scenario)
    from kb.retrieve import Retriever
    d, ops = run_full(sc, a.mode, AuditLog(Path(a.audit)), retriever=Retriever())
    print(f"== {sc['id']}  {sc['title']}  [{a.mode}]\n" + show(d))
    for m in ops:
        cite = m.citations[0].instrument + ", " + m.citations[0].provision if m.citations else \
            ("INVALID citation" if m.body.get("cite_valid") is False else "no citation")
        print(f"  opinion {m.sender:18} {m.body['position']:9} cites: {cite}")


if __name__ == "__main__":
    main()
