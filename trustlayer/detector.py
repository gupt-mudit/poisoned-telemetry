"""Cheap first-pass screen for instruction-like text. NOT the defence on its own:
claim verification runs on every claim whether or not this flags anything."""
from __future__ import annotations

import re

from trustlayer.models import DetectorFlag, TelemetryItem

# (rule id, pattern, severity)
RULES: list[tuple[str, str, str]] = [
    ("override",      r"\b(ignore|disregard|forget)\b.{0,40}\b(instruction|rule|polic\w*|prior|previous|alarm)", "high"),
    ("role_marker",   r"(^|[\s.;])(SYSTEM|ASSISTANT|AI)\s*:|\byou are now\b|\bIMPORTANT FOR AI\b", "high"),
    ("override_word", r"\b(override|system override)\b", "high"),
    ("output_directive", r"\b(say so|report that|conclude (that|the)|in your answer|in the (rca|summary))\b", "medium"),
    ("secret_request", r"\b(password|community string|credential|running configuration|private key)\b", "high"),
    ("skip_control",  r"\bskip (the )?change control\b|\bwithout (further )?review\b", "high"),
    ("suppression",   r"\b(suppress|close (related )?alerts?|no action (is )?(needed|required)|false positive)\b", "medium"),
    ("authority_claim", r"\b(approved by|authori[sz]es|pre-?approved|TDRA approved|regulator (notice|approved)|emergency approved)\b", "medium"),
    ("external_destination", r"[\w.+-]+@[\w-]+\.[\w.]+", "medium"),
]
_COMPILED = [(r, re.compile(p, re.I), s) for r, p, s in RULES]


def scan_text(item_id: str, text: str) -> list[DetectorFlag]:
    flags = []
    for rule, rx, sev in _COMPILED:
        m = rx.search(text or "")
        if m:
            flags.append(DetectorFlag(item_id=item_id, rule=rule, span=m.group(0)[:60], severity=sev))
    return flags


def scan(items: list[TelemetryItem]) -> list[DetectorFlag]:
    out: list[DetectorFlag] = []
    for i in items:
        out += scan_text(i.id, i.text)
    return out
