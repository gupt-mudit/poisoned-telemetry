"""Step 5/6 'done when': all policy scenarios run end to end and match their answer keys."""
from pathlib import Path

from cryptography.fernet import Fernet

from scenarios.run import load, run
from scenarios.validate import check_all
from trustlayer.audit import AuditLog
from trustlayer.models import Verdict


def test_all_answer_keys_consistent_with_pipeline():
    assert check_all(verbose=False)


def test_baseline_allows_everything_protected_does_not(tmp_path):
    log = AuditLog(tmp_path / "a.jsonl", key=Fernet.generate_key())
    sc = load("S2_disclosure_malicious")
    assert run(sc, "baseline", log).verdict == Verdict.ALLOW
    assert run(sc, "protected", log).verdict == Verdict.BLOCK


def test_clean_emergency_is_allowed():
    assert run(load("S4_emergency_clean"), "protected").verdict == Verdict.ALLOW
