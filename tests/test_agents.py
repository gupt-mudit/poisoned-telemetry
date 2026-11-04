"""Step 6b: institutional agents route by mandate and can only cite retrieved passages."""
from scenarios.run import load, run, run_full
from agents import institutional
from trustlayer import llm


class FakeRetriever:
    def search(self, q, k=3):
        from kb.retrieve import Passage
        return [Passage("doc.txt#0", "text", "Sample Instrument", "Article 2", "doc.txt", 1.0)]


def test_routing_follows_mandates():
    assert "data-office-agent" in institutional.route(run(load("S2_disclosure_malicious")))
    assert "tdra-agent" in institutional.route(run(load("S3_forged_authority_malicious")))
    assert "cyber-agent" in institutional.route(run(load("S1_maintenance_malicious")))


def test_valid_citation_is_recorded():
    d, ops = run_full(load("S2_disclosure_malicious"), "protected", retriever=FakeRetriever())
    assert ops and all(m.citations and m.citations[0].provision == "Article 2" for m in ops)


def test_invented_citation_is_marked_invalid(monkeypatch):
    monkeypatch.setattr(llm, "complete", lambda *a, **k: llm.LLMResult(
        text='{"position": "object", "reason": "x", "cite": "made-up-law#9"}', model="fake"))
    d, ops = run_full(load("S2_disclosure_malicious"), "protected", retriever=FakeRetriever())
    assert ops and all(m.body["cite_valid"] is False and not m.citations for m in ops)


def test_baseline_has_no_agent_review():
    _, ops = run_full(load("S2_disclosure_malicious"), "baseline", retriever=FakeRetriever())
    assert ops == []
