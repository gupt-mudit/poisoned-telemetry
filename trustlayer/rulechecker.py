"""The rule-checker: plain code, no AI, final say on every proposed action.

Rules live in rules.yaml with their citations; the logic for each rule ID is here.
strict=True refuses to load any rule whose citation is still a draft (TO_VERIFY), so an
unchecked legal citation cannot reach a submission run.
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional

import yaml

from trustlayer.models import (Citation, Claim, ClaimType, Decision, ProposedAction, Verdict,
                               Verification)
from trustlayer.verify_claims import INTERNAL_DOMAINS, mandate

RULES_PATH = Path(__file__).resolve().parent / "rules.yaml"
REGULATOR_ROLES = {"regulator", "cyber_authority", "data_protection"}
SENSITIVE_CLASSES = {"personal_data", "network_topology"}
_SEVERITY = {Verdict.ALLOW: 0, Verdict.ESCALATE: 1, Verdict.BLOCK: 2}


class RuleSet:
    def __init__(self, path: Path = RULES_PATH, strict: bool = False):
        doc = yaml.safe_load(open(path))
        self.rules = {}
        for r in doc["rules"]:
            src = r.get("source") or {}
            if not src.get("instrument"):
                raise ValueError(f"rule {r['id']} has no source; every rule must be cited")
            if strict and (r.get("status") != "verified" or src.get("provision") in (None, "", "TO_VERIFY")):
                raise ValueError(f"strict mode: rule {r['id']} citation not verified")
            self.rules[r["id"]] = r

    def citation(self, rid: str) -> Citation:
        s = self.rules[rid]["source"]
        return Citation(instrument=s["instrument"], provision=s.get("provision") or "TO_VERIFY",
                        kb_ref=s.get("kb_ref"))


def _status(claims: list[Claim], ctype: ClaimType) -> list[Verification]:
    return [c.verification for c in claims if c.type == ctype]


def _external(dest: Optional[str]) -> bool:
    if not dest:
        return False
    if dest.startswith("agent:") or mandate(dest.removeprefix("agent:")):
        return False
    return not any(dest.endswith(d) for d in INTERNAL_DOMAINS)


def _authority_verified(p: ProposedAction, claims: list[Claim], field: str, action: str) -> tuple[bool, str]:
    """Authority holds only if a VERIFIED authority claim exists from that agent's own channel
    and its mandate covers the action."""
    if not p.claimed_authority:
        return False, "no authority given"
    m = mandate(p.claimed_authority)
    if m is None:
        return False, f"{p.claimed_authority} not in mandate register"
    if action not in m[field].split(";"):
        return False, f"{p.claimed_authority} mandate ({field}) does not cover {action}"
    ok = any(c.type == ClaimType.AUTHORITY and c.verification == Verification.VERIFIED
             and c.source == f"agent:{p.claimed_authority}" for c in claims)
    return (True, f"{p.claimed_authority} via registered channel; {field} covers {action}") if ok else \
           (False, f"authority of {p.claimed_authority} asserted but not received from its registered channel")


def evaluate(p: ProposedAction, claims: list[Claim], rules: RuleSet) -> Decision:
    results: list[tuple[str, Verdict, str]] = []

    # R1 suppression / maintenance classification needs a verified change
    if p.action in ("suppress_alert", "mark_planned_maintenance"):
        appr = _status(claims, ClaimType.APPROVAL)
        if appr and all(v == Verification.VERIFIED for v in appr):
            results.append(("R-SUPPRESS-NEEDS-VERIFIED-CHANGE", Verdict.ALLOW, "approval verified in change log"))
        else:
            why = "no approval claim" if not appr else f"approval claims: {', '.join(v.value for v in appr)}"
            results.append(("R-SUPPRESS-NEEDS-VERIFIED-CHANGE", Verdict.BLOCK, f"requires verified change; {why}"))

    # R2 disclosure
    if p.action in ("send_external", "send_report"):
        if p.data_class in SENSITIVE_CLASSES and _external(p.destination):
            results.append(("R-NO-EXTERNAL-PERSONAL-DATA", Verdict.BLOCK,
                            f"{p.data_class} to external destination {p.destination}"))
        elif p.data_class in SENSITIVE_CLASSES:
            results.append(("R-NO-EXTERNAL-PERSONAL-DATA", Verdict.ESCALATE, f"{p.data_class} needs human approval"))
        else:
            requester = (p.destination or "").removeprefix("agent:")
            ok = any(c.type == ClaimType.AUTHORITY and c.verification == Verification.VERIFIED
                     and c.source == f"agent:{requester}" for c in claims)
            results.append(("R-NO-EXTERNAL-PERSONAL-DATA", Verdict.ALLOW if ok else Verdict.ESCALATE,
                            "non-personal data to a verified requester" if ok else "requester not verified"))
        if p.action == "send_report":
            requester = (p.destination or "").removeprefix("agent:")
            m = mandate(requester)
            ok = m is not None and any(c.type == ClaimType.AUTHORITY and c.verification == Verification.VERIFIED
                                       and c.source == f"agent:{requester}" for c in claims)
            results.append(("R-AUTHORITY-FROM-REGISTERED-CHANNEL", Verdict.ALLOW if ok else Verdict.BLOCK,
                            f"request from registered channel of {requester}" if ok else
                            f"request not from a registered channel of {requester}"))

    # R3 / R4 configuration changes and emergencies
    if p.action in ("config_change", "emergency_reroute"):
        m = mandate(p.claimed_authority) if p.claimed_authority else None
        role = m["role"] if m else ""
        if p.action == "config_change" and role in REGULATOR_ROLES:
            # Even a genuine order from a regulator's registered channel never changes the network on its own:
            # a person must approve it (the rule's escalate_if). The channel is not yet signed, so a spoofed or
            # compromised channel would otherwise reach the network directly. Not verified at all: BLOCK.
            ok, why = _authority_verified(p, claims, "may_approve", "licence_variation")
            results.append(("R-AUTHORITY-FROM-REGISTERED-CHANNEL", Verdict.ESCALATE if ok else Verdict.BLOCK,
                            f"{why}; a regulator-ordered network change needs a person's approval" if ok else why))
        else:
            permitted = rules.rules["R-EMERGENCY-ONLY-PERMITTED-ACTIONS"].get("permitted_emergency_actions", [])
            inc_ok = Verification.VERIFIED in _status(claims, ClaimType.INCIDENT)
            auth_ok, why = _authority_verified(p, claims, "may_approve", p.action)
            in_list = p.action in permitted
            if inc_ok and auth_ok and in_list:
                results.append(("R-EMERGENCY-ONLY-PERMITTED-ACTIONS", Verdict.ALLOW,
                                f"verified incident, {why}, permitted emergency action"))
            else:
                missing = [x for x, ok in (("verified incident", inc_ok), ("verified authority", auth_ok),
                                           ("permitted emergency action", in_list)) if not ok]
                results.append(("R-EMERGENCY-ONLY-PERMITTED-ACTIONS", Verdict.ESCALATE,
                                f"missing: {', '.join(missing)}; {why}"))

    if not results:  # actions with no rule (e.g. diagnosis, open_incident) are allowed and logged
        return Decision(proposed=p, claims=claims, rule_id="NONE", rules_applied=[], verdict=Verdict.ALLOW,
                        reasons=["no rule restricts this action"])

    deciding = max(results, key=lambda r: _SEVERITY[r[1]])
    who = mandate(p.claimed_authority)["role"] if p.claimed_authority and mandate(p.claimed_authority) else "human approver"
    return Decision(
        proposed=p, claims=claims, rule_id=deciding[0], rules_applied=[r[0] for r in results],
        citations=[rules.citation(r[0]) for r in results], authority=who, verdict=deciding[1],
        reasons=[f"{r[0]}: {r[1].value} - {r[2]}" for r in results],
        requires_human=deciding[1] != Verdict.ALLOW,
    )
