"""Institutional agents: telecom regulator, cyber authority, data office.

Each sees only what its mandate covers, searches the knowledge base, and returns a cited
opinion on the proposed action. Opinions are recorded; they never override the rule-checker,
which holds the final say.

Citation safeguard: an agent may cite ONLY a passage that was actually retrieved for it.
A citation to anything else is recorded as invalid (counts against citation accuracy).
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from trustlayer import llm
from trustlayer.models import AgentMessage, Citation, Decision, Verdict, Verification

AGENTS = {
    "tdra-agent": {
        "name": "Telecom regulator",
        "mandate": "licence conditions, the regulator's powers and delegations, service-incident reporting by operators",
        "query": "telecommunications regulator powers licence conditions operator reporting {action} {target}",
    },
    "cyber-agent": {
        "name": "National cyber authority",
        "mandate": "classification of security incidents, reporting obligations and clocks, unauthorised access or interference",
        "query": "security incident notification reporting obligation unauthorised interference {action} {target}",
    },
    "data-office-agent": {
        "name": "Data office",
        "mandate": "disclosure of personal data, lawful basis, transfers outside the controller, breach notification",
        "query": "personal data disclosure lawful basis transfer breach notification {data_class} {destination}",
    },
}

SYSTEM = (
    "You are the {name} agent in a multi-institution review. Your mandate: {mandate}. "
    "You see a proposed network action, the claims the trust layer checked (with verification status), "
    "and passages retrieved from the legal knowledge base. Claims marked unverified or contradicted must "
    "not be treated as facts. Give your institution's position. You may cite ONLY one of the passage IDs "
    "provided; if none applies, set cite to null. Return JSON only: "
    '{{"position": "support|object|escalate", "reason": "<=40 words", "cite": "<passage id or null>"}}'
)


def route(d: Decision) -> list[str]:
    """Which institutions have a say on this decision (each sees only its slice)."""
    p = d.proposed
    who = []
    if p.data_class == "personal_data" or p.action == "send_external":
        who.append("data-office-agent")
    if p.action in ("config_change", "send_report", "suppress_alert", "mark_planned_maintenance", "emergency_reroute"):
        who.append("tdra-agent")
    if p.action in ("suppress_alert", "config_change", "emergency_reroute") or any(
            c.verification != Verification.VERIFIED for c in d.claims):
        who.append("cyber-agent")
    return list(dict.fromkeys(who))


def _view(d: Decision) -> str:
    p = d.proposed
    lines = [f"PROPOSED: {p.action} target={p.target!r} data_class={p.data_class} destination={p.destination} "
             f"claimed_authority={p.claimed_authority}", "CLAIMS CHECKED:"]
    lines += [f"  [{c.verification.value}] {c.source}: {c.text} (evidence: {c.evidence})" for c in d.claims] or ["  none"]
    lines.append(f"RULE-CHECKER: {d.verdict.value} under {d.rule_id}")
    return "\n".join(lines)


def opinion(agent_id: str, d: Decision, retriever) -> AgentMessage:
    a = AGENTS[agent_id]
    p = d.proposed
    query = a["query"].format(action=p.action.replace("_", " "), target=p.target, data_class=p.data_class or "",
                              destination=p.destination or "")
    passages = retriever.search(query, k=3) if retriever else []
    ids = {x.id: x for x in passages}
    default_pos = {Verdict.ALLOW: "support", Verdict.BLOCK: "object", Verdict.ESCALATE: "escalate"}[d.verdict]
    fake = json.dumps({"position": default_pos, "reason": (d.reasons or [""])[0][:200],
                       "cite": passages[0].id if passages else None})
    user = _view(d) + "\n\nPASSAGES:\n" + "\n".join(
        f"[{x.id}] {x.instrument} | {x.article}\n{x.text[:1200]}" for x in passages)
    r = llm.complete(SYSTEM.format(name=a["name"], mandate=a["mandate"]), user, max_tokens=300, fake_response=fake)
    out = llm.parse_json(r.text) or {}
    cite = out.get("cite")
    citations, valid = [], None
    if cite:
        valid = cite in ids
        if valid:
            citations = [Citation(instrument=ids[cite].instrument or ids[cite].source_file,
                                  provision=ids[cite].article, kb_ref=cite)]
    return AgentMessage(
        id=str(uuid.uuid4())[:8], ts=datetime.now(timezone.utc), sender=agent_id, mandate=a["mandate"],
        kind="opinion",
        body={"position": out.get("position", "escalate"), "reason": out.get("reason", ""),
              "cite_requested": cite, "cite_valid": valid, "model": r.model,
              "retrieved": [x.id for x in passages]},
        citations=citations,
    )
