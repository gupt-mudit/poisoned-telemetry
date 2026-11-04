"""Extract decision-relevant claims from untrusted free text, deterministically.

Design rule: a claim is written as a NEUTRAL TEMPLATE with its key identifiers, never as
the attacker's own sentence. The persuasive wording stays in quarantine; the checkable
content (IDs, who, what) crosses the hatch, labelled with its source and verification.
An optional LLM pass (quarantine.py, mode=llm) can add claims; it never removes these.
"""
from __future__ import annotations

import re

from trustlayer.models import Claim, ClaimType, TelemetryItem

ID_PATTERNS = {
    "change": r"\bCHG-\d+\b",
    "incident": r"\bINC(?:-[A-Z]+)?-\d+\b",
    "document": r"\b(?:VA|RB|PA|RL|CPU-ALM|TAC)[- ]?\d+\b",
    "asn": r"\bAS\d{3,6}\b",
    "ip": r"\b\d{1,3}(?:\.\d{1,3}){3}\b",
    "email": r"[\w.+-]+@[\w-]+\.[\w.]+",
    "node": r"\b(?:PE|CE|RR)-\d+\b",
    "window": r"\b\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\b|\bextended to \d{1,2}:\d{2}\b",
}
SENSITIVE = r"(password|community string|credential|running config\w*|neighbou?r table|topology|interface list|" \
            r"subscriber|customer circuits?|peering config\w*)"
AUTHORITIES = r"(TDRA|regulator|NOC (?:shift )?lead|vendor advisory|runbook|peering agreement|security team|power team|vendor TAC)"
ACTION_VERBS = r"\b(disabl\w*|remov\w*|shut\w*|reboot\w*|clear\w*|set|skip\w*|suppress\w*|close|bypass\w*|move traffic)\b"

CAUSE_CATEGORIES = [
    ("maintenance or change", r"maintenance|\bCHG-\d+|policy change|rollback|post-commit"),
    ("benign / false positive / normal", r"false positive|normal after|expected|test noise|healthy|already resolved"),
    ("upstream or peer problem", r"route[- ]leak|upstream|peer .{0,20}(announc|instab)"),
    ("power problem", r"\bPDU\b|power"),
    ("CPU / control-plane load", r"\bCPU\b|routing engine|\bRE0\b"),
    ("security attack", r"ddos|hijack|attack"),
    ("hardware failure", r"line card|hardware fail"),
    ("physical / cabling", r"cabl|patch panel|fib(re|er)|optic"),
    ("customer impact report", r"customer .{0,40}(report|loss)|connectivity"),
]


def _ids(text: str) -> dict[str, list[str]]:
    return {k: sorted(set(m.group(0) for m in re.finditer(p, text, re.I))) for k, p in ID_PATTERNS.items()}


def _sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.;!?])\s+", text) if s.strip()]


def extract_pairs(item: TelemetryItem) -> list[tuple[Claim, str]]:
    """Claims paired with the quarantined sentence they came from. The sentence is used
    only inside the quarantine boundary (to extract identifiers for verification)."""
    if not item.text:
        return []
    pairs: list[tuple[Claim, str]] = []
    n = 0
    s = ""

    def add(ctype: ClaimType, desc: str):
        nonlocal n
        n += 1
        pairs.append((Claim(id=f"{item.id}-c{n}", type=ctype, text=desc, source_item=item.id,
                            source=item.source, ts=item.ts), s))

    if item.channel.value == "agent":
        s = ""
        add(ClaimType.AUTHORITY, f"message sent via the registered channel of {item.source.split(':', 1)[1]}")

    for s in _sentences(item.text):
        ids = _ids(s)
        low = s.lower()
        typed = False
        # APPROVAL: any change reference, or "approved" / "maintenance" assertions
        if ids["change"] or re.search(r"\bapproved\b|maintenance window|planned maintenance", low):
            win = f"; states window {ids['window'][0]}" if ids["window"] else ""
            ref = ", ".join(ids["change"]) or "no change ID given"
            add(ClaimType.APPROVAL, f"cites a change/maintenance ({ref}) as covering this event{win}")
            typed = True
        # AUTHORITY: someone with authority approved / requires / says
        m = re.search(AUTHORITIES, s, re.I)
        if m and re.search(r"approv|authori|requir|says|notice|per |emergency|request", low):
            docs = ", ".join(ids["document"])
            add(ClaimType.AUTHORITY, f"invokes the authority of '{m.group(0)}'" + (f" (cites {docs})" if docs else ""))
            typed = True
        # INCIDENT references
        if ids["incident"] or re.search(r"investigation .{0,20}opened|\bcritical\b", low):
            add(ClaimType.INCIDENT, f"refers to an incident ({', '.join(ids['incident']) or 'no incident ID'})")
            typed = True
        # DATA_REQUEST: asks for sensitive data to be sent/attached/included/shared/listed
        sm = re.search(SENSITIVE, s, re.I)
        if sm and re.search(r"\b(send|attach\w*|include|list|share|email|requests?|needs?|requires?)\b", low):
            # only the domain crosses the hatch: a local part can carry words (adaptive attack AD4)
            dest = ", ".join(f"an address at {e.split('@', 1)[1]}" for e in ids["email"]) or \
                ("the ticket" if "ticket" in low else "the answer/summary")
            add(ClaimType.DATA_REQUEST, f"asks for '{sm.group(0).lower()}' to be disclosed to {dest}")
            typed = True
        # ACTION_REQUEST: imperative network change
        am = re.search(ACTION_VERBS, s, re.I)
        if am and re.search(r"route filter|prefix limit|interface|router|bgp|hold timer|alert|change control|session",
                            low):
            obj = re.search(r"route filters?|prefix limits?|interface|routers?|bgp sessions?|hold timer|alerts?|change control",
                            low)
            add(ClaimType.ACTION_REQUEST, f"requests action: {am.group(0).lower()} {obj.group(0) if obj else ''}".strip())
            typed = True
        # CAUSE: any remaining assertion about what explains the incident
        cats = [name for name, rx in CAUSE_CATEGORIES if re.search(rx, s, re.I)]
        extra = [c for c in cats if c != "maintenance or change"]
        if cats and (not typed or extra):
            keys = sorted(set(ids["change"] + ids["incident"] + ids["document"] + ids["asn"] + ids["ip"]))
            add(ClaimType.CAUSE, f"asserts a cause or condition: {', '.join(cats)}"
                + (f" (terms: {', '.join(keys)})" if keys else ""))
    return pairs


def extract(item: TelemetryItem) -> list[Claim]:
    return [c for c, _ in extract_pairs(item)]


def extract_all_pairs(items: list[TelemetryItem]) -> list[tuple[Claim, str, TelemetryItem]]:
    out = []
    for i in items:
        # device-generated text with nothing beyond its standard message is already in the fields
        if i.channel.value == "telemetry" and i.kind in ("alarm", "syslog") and not _has_extra(i):
            continue
        out += [(c, s, i) for c, s in extract_pairs(i)]
    return out


def extract_all(items: list[TelemetryItem]) -> list[Claim]:
    return [c for c, _, _ in extract_all_pairs(items)]


_STANDARD_DEVICE_TEXT = re.compile(
    r"^(link (down|up) on \S+|BGP session to \S+ reset \(hold timer expired\)|"
    r"optical receive power below warning threshold|commit complete: policy-statement \S+ updated \(CHG-\d+\))$")


def _has_extra(item: TelemetryItem) -> bool:
    """True if a device text field carries anything beyond its standard message."""
    return not _STANDARD_DEVICE_TEXT.match(item.text.strip())
