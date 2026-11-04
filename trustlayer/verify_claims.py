"""Claim verification against independent records. Runs on EVERY decision-relevant claim,
whether or not the detector flagged anything. Deterministic: it extracts identifiers
and checks records; it never judges a claim by how plausible it sounds.

Outcomes: VERIFIED (a record agrees), CONTRADICTED (a record disagrees),
UNVERIFIED (nothing to check against). Only VERIFIED claims may support an action.
"""
from __future__ import annotations

import csv
import re
from datetime import datetime, time
from functools import lru_cache
from pathlib import Path
from typing import Optional

from trustlayer.models import Claim, ClaimType, Verification

REC = Path(__file__).resolve().parent.parent / "data" / "records"
INTERNAL_DOMAINS = ("operator.example",)   # destinations treated as internal


@lru_cache(maxsize=None)
def _rows(name: str) -> tuple[dict, ...]:
    with open(REC / name, newline="") as f:
        return tuple(csv.DictReader(f))


def _dt(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def _hhmm(s: str) -> time:
    h, m = s.split(":")
    return time(int(h), int(m))


# ------------------------------------------------------------------ approvals
def verify_approval(text: str, node: Optional[str] = None, at: Optional[datetime] = None
                    ) -> tuple[Verification, str]:
    ids = re.findall(r"CHG-\d+", text)
    if not ids:
        return Verification.UNVERIFIED, "no change identifier given; nothing to check"
    changes = {r["change_id"]: r for r in _rows("changes.csv")}
    for cid in ids:
        r = changes.get(cid)
        if r is None:
            return Verification.CONTRADICTED, f"{cid} not in change log"
        if r["status"] != "approved":
            return Verification.CONTRADICTED, f"{cid} exists but status is '{r['status']}'"
        if node and r["node"] != node:
            return Verification.CONTRADICTED, f"{cid} is for {r['node']}, not {node}"
        start, end = _dt(r["window_start_utc"]), _dt(r["window_end_utc"])
        if at and not (start <= at <= end):
            return Verification.CONTRADICTED, (f"{cid} window {start:%H:%M}-{end:%H:%M} UTC "
                                               f"does not cover {at:%H:%M}")
        # a stated window that differs from the record (e.g. "extended to 12:00", "10:00-11:00")
        ext = re.search(r"extended to (\d{1,2}:\d{2})", text)
        if ext and _hhmm(ext.group(1)) != end.time():
            return Verification.CONTRADICTED, (f"claims {cid} window extended to {ext.group(1)}; "
                                               f"record ends {end:%H:%M}, no extension recorded")
        rng = re.search(r"(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})", text)
        if rng and (_hhmm(rng.group(1)), _hhmm(rng.group(2))) != (start.time(), end.time()):
            return Verification.CONTRADICTED, (f"claims window {rng.group(0)} for {cid}; "
                                               f"record says {start:%H:%M}-{end:%H:%M}")
    recs = "; ".join(f"{cid}: '{changes[cid]['description']}' on {changes[cid]['node']}, "
                     f"{_dt(changes[cid]['window_start_utc']):%H:%M}-{_dt(changes[cid]['window_end_utc']):%H:%M} UTC"
                     for cid in ids)
    # Existence is all a change log can prove: it does not show the change caused or explains this event
    # (adaptive attack AD1 cites a real change to borrow its credibility).
    return Verification.VERIFIED, (f"approved change exists for this node and time ({recs}); this does NOT "
                                   f"show the change caused or explains this event")


# ------------------------------------------------------------------ authority
def mandate(agent_id: str) -> Optional[dict]:
    return {r["agent_id"]: r for r in _rows("mandates.csv")}.get(agent_id)


def verify_authority(source: str, action: Optional[str] = None, field: str = "may_request"
                     ) -> tuple[Verification, str]:
    """Authority counts only when it arrives from a registered agent channel ("agent:<id>")."""
    if not source.startswith("agent:"):
        return Verification.UNVERIFIED, (f"authority asserted via '{source.split(':')[0]}' channel, "
                                         f"not a registered agent channel")
    agent = source.split(":", 1)[1]
    m = mandate(agent)
    if m is None:
        return Verification.UNVERIFIED, f"{agent} not in mandate register"
    if action and action not in m[field].split(";"):
        return Verification.CONTRADICTED, f"{agent} mandate ({field}) does not include {action}"
    if action is None:
        return Verification.VERIFIED, f"{agent} is registered (role: {m['role']}, {m['institution']})"
    return Verification.VERIFIED, f"{agent} registered; {field} includes {action}"


# ------------------------------------------------------------------ incidents
def verify_incident(text: str, node: Optional[str] = None) -> tuple[Verification, str]:
    ids = re.findall(r"INC(?:-[A-Z]+)?-\d+", text)
    incs = _rows("incidents.csv")
    if ids:
        for i in ids:
            r = next((x for x in incs if x["incident_id"] == i), None)
            if r is None:
                return Verification.CONTRADICTED, f"{i} not in incident register"
            if r["status"] != "open":
                return Verification.CONTRADICTED, f"{i} is {r['status']}"
        return Verification.VERIFIED, f"{', '.join(ids)} open in incident register"
    if node:
        r = next((x for x in incs if x["node"] == node and x["status"] == "open"), None)
        if r:
            return Verification.VERIFIED, f"{r['incident_id']} ({r['severity']}) open on {node}"
    return Verification.UNVERIFIED, "no incident identifier and no open incident on this node"


# ------------------------------------------------------------------ dispatcher
def verify(claim: Claim, node: Optional[str] = None, original_text: str = "") -> Claim:
    """Fill in verification for one claim. `original_text` is the quarantined sentence,
    used only to extract identifiers; it is never forwarded."""
    text = original_text or claim.text
    if claim.type == ClaimType.APPROVAL:
        v, ev = verify_approval(text, node, claim.ts)
    elif claim.type == ClaimType.AUTHORITY:
        v, ev = verify_authority(claim.source)
    elif claim.type == ClaimType.INCIDENT:
        v, ev = verify_incident(text, node)
    elif claim.type in (ClaimType.DATA_REQUEST, ClaimType.ACTION_REQUEST):
        v, ev = verify_authority(claim.source)
        if v != Verification.VERIFIED:
            ev = "request did not come from a registered agent with a mandate; " + ev
    else:  # CAUSE
        if re.search(r"CHG-\d+", text):
            v, ev = verify_approval(text, node, claim.ts)
            if v == Verification.VERIFIED:   # a real change existing does not prove it caused anything
                v, ev = Verification.UNVERIFIED, "change exists, but no record links it to this fault"
        else:
            v, ev = Verification.UNVERIFIED, "no independent record supports this assertion"
    return claim.model_copy(update={"verification": v, "evidence": ev, "checked": True})
