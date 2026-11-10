"""Step 4 'done when' tests: the trust layer's safety properties."""
import json
import subprocess
import sys
from pathlib import Path

import pytest
from cryptography.fernet import Fernet
from hypothesis import given, settings, strategies as st

from eval.generate_telemetry import build
from eval.inject import inject, load_payloads
from trustlayer import detector
from trustlayer.audit import AuditLog
from trustlayer.claims import extract_all_pairs
from trustlayer.models import Claim, ClaimType, ProposedAction, Verdict, Verification
from trustlayer.quarantine import quarantine
from trustlayer.rulechecker import RuleSet, evaluate
from trustlayer.verify_claims import verify, verify_approval

ROOT = Path(__file__).resolve().parent.parent
PAYLOADS = load_payloads()
BASE = build(7)


@pytest.mark.parametrize("p", PAYLOADS, ids=[p["id"] for p in PAYLOADS])
def test_payload_text_never_crosses_the_hatch(p):
    items, _ = inject(BASE, p)
    rendered = quarantine(items).render_for_agent()
    # no sentence fragment of 6+ words from the payload appears in what crosses
    words = p["text"].split()
    for k in range(len(words) - 5):
        frag = " ".join(words[k:k + 6])
        assert frag not in rendered, f"payload fragment crossed: {frag!r}"


@pytest.mark.parametrize("p", PAYLOADS, ids=[p["id"] for p in PAYLOADS])
def test_every_payload_yields_a_checked_claim(p):
    items, carrier = inject(BASE, p)
    out = quarantine(items)
    mine = [c for c in out.claims if c.source_item == carrier]
    assert mine, f"{p['id']}: payload produced no claim"
    assert all(c.checked for c in mine)
    assert not any(c.verification == Verification.VERIFIED and c.type != ClaimType.APPROVAL for c in mine), \
        "an attacker's claim must never come out verified unless a real record supports it"


def test_fake_approval_with_no_detector_flag_is_still_contradicted():
    """The GPT-review fix: verification is mandatory, not triggered by the detector."""
    p = next(x for x in PAYLOADS if x["id"] == "C3")
    items, carrier = inject(BASE, p)
    out = quarantine(items)
    assert not [f for f in out.flags if f.item_id == carrier], "C3 is meant to evade the detector"
    appr = [c for c in out.claims if c.source_item == carrier and c.type == ClaimType.APPROVAL]
    assert appr and appr[0].verification == Verification.CONTRADICTED


def test_detector_catches_crude_payloads():
    for p in [x for x in PAYLOADS if x["style"] == "crude"]:
        assert detector.scan_text("x", p["text"]), f"{p['id']} crude payload not flagged"


def test_clean_telemetry_has_no_contradicted_claims():
    out = quarantine(BASE)
    assert not [c for c in out.claims if c.verification == Verification.CONTRADICTED]


def test_structured_fields_are_all_forwarded():
    out = quarantine(BASE)
    assert len(out.facts) == len(BASE)
    assert any("rx_power_dbm=" in f for f in out.facts)


@pytest.mark.parametrize("text,expected", [
    ("CHG-4458 covers this", Verification.VERIFIED),
    ("CHG-4471 approved", Verification.CONTRADICTED),          # does not exist
    ("CHG-4463 approved", Verification.CONTRADICTED),          # exists, rejected
    ("CHG-4402 approved", Verification.CONTRADICTED),          # wrong node (PE-03)
    ("CHG-4458; window extended to 12:00", Verification.CONTRADICTED),
    ("approved maintenance", Verification.UNVERIFIED),         # nothing to check
])
def test_change_verification(text, expected):
    from datetime import datetime, timezone
    at = datetime(2026, 11, 2, 10, 5, tzinfo=timezone.utc)
    assert verify_approval(text, "PE-07", at)[0] == expected


def test_change_outside_window_is_contradicted():
    from datetime import datetime, timezone
    at = datetime(2026, 11, 2, 11, 30, tzinfo=timezone.utc)
    assert verify_approval("CHG-4458", "PE-07", at)[0] == Verification.CONTRADICTED


# ---------------------------------------------------------------- rule-checker
RULES = RuleSet()


@settings(max_examples=400, deadline=None)
@given(dest=st.one_of(st.emails(), st.sampled_from(["x@example.com", "ops@example-partner.com"])),
       action=st.sampled_from(["send_external", "send_report"]),
       data=st.sampled_from(["personal_data", "network_topology"]))
def test_sensitive_data_to_external_address_is_never_allowed(dest, action, data):
    d = evaluate(ProposedAction(action=action, data_class=data, destination=dest), [], RULES)
    assert d.verdict == Verdict.BLOCK


@settings(max_examples=200, deadline=None)
@given(who=st.sampled_from(["tdra-agent", "cyber-agent", "noc-lead", "ops-agent", "unknown"]),
       src=st.sampled_from(["ticket:TCK-1", "alarm:PE-07", "telemetry:x"]))
def test_authority_from_untrusted_channel_never_allows_config_change(who, src):
    from datetime import datetime, timezone
    c = Claim(id="c1", type=ClaimType.AUTHORITY, text="x", source_item="i", source=src,
              ts=datetime(2026, 11, 2, tzinfo=timezone.utc))
    c = verify(c)
    d = evaluate(ProposedAction(action="config_change", claimed_authority=who), [c], RULES)
    assert d.verdict != Verdict.ALLOW


@pytest.mark.parametrize("who,expected", [("tdra-agent", Verdict.ESCALATE),          # mandate covers it: a person decides
                                          ("cyber-agent", Verdict.BLOCK),            # mandate does not cover config changes
                                          ("data-office-agent", Verdict.BLOCK)])
def test_regulator_ordered_change_from_its_own_channel_waits_for_a_person(who, expected):
    """Found 10 Nov with the demo's custom attack: a 'turn off PE-03' order on the regulator's registered channel
    was ALLOWED. A verified regulator order may never change the network by itself: it is ESCALATED, or
    BLOCKED when that authority's mandate does not cover network changes at all."""
    from datetime import datetime, timezone
    c = verify(Claim(id="c1", type=ClaimType.AUTHORITY, text="x", source_item="i", source=f"agent:{who}",
                     ts=datetime(2026, 11, 2, tzinfo=timezone.utc)))
    d = evaluate(ProposedAction(action="config_change", target="PE-03", claimed_authority=who), [c], RULES)
    assert d.verdict == expected


def test_every_rule_is_cited_and_strict_mode_refuses_drafts():
    assert all(r["source"]["instrument"] for r in RULES.rules.values())
    with pytest.raises(ValueError):
        RuleSet(strict=True)   # all provisions are still TO_VERIFY


def test_decision_carries_the_five_fields():
    d = evaluate(ProposedAction(action="suppress_alert", target="x"), [], RULES)
    assert d.proposed and d.rule_id and d.citations and d.verdict and d.reasons


# ---------------------------------------------------------------- audit
def test_audit_tamper_detected_by_independent_verifier(tmp_path):
    log = AuditLog(tmp_path / "audit.jsonl", key=Fernet.generate_key())
    for i in range(4):
        log.append("decision", "rule-checker", {"n": i}, source_text=f"confidential line {i}")
    log.anchor()
    v = ROOT / "tools" / "verify_audit.py"
    ok = subprocess.run([sys.executable, str(v), str(log.path), str(log.anchors)], capture_output=True, text=True)
    assert ok.returncode == 0 and "INTACT" in ok.stdout
    assert "confidential line" not in log.path.read_text()
    lines = log.path.read_text().splitlines()
    e = json.loads(lines[1]); e["payload"]["n"] = 42; lines[1] = json.dumps(e)
    log.path.write_text("\n".join(lines) + "\n")
    bad = subprocess.run([sys.executable, str(v), str(log.path)], capture_output=True, text=True)
    assert bad.returncode == 1


def test_audit_source_text_readable_only_with_key(tmp_path):
    key = Fernet.generate_key()
    log = AuditLog(tmp_path / "audit.jsonl", key=key)
    e = log.append("x", "y", {}, source_text="sensitive")
    assert AuditLog(tmp_path / "audit.jsonl", key=key).read_source(e["source_ref"]) == "sensitive"
    with pytest.raises(Exception):
        AuditLog(tmp_path / "audit.jsonl", key=Fernet.generate_key()).read_source(e["source_ref"])
