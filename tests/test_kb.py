"""Step 7: the KB wrapper runs ITU's real ingestion code (with a stand-in embedder here,
because Ollama is not available offline) and returns citable passages."""
import hashlib
from pathlib import Path

import pytest
import yaml

pytest.importorskip("chromadb")
from kb import itu  # noqa: E402

if not itu.ITU_DIR.exists():
    pytest.skip("ITU reference code not set up yet (run: make kb-setup)", allow_module_level=True)

SAMPLE = """SAMPLE TEST INSTRUMENT (synthetic text for tests only, not a real law)
Article 1 Scope. This instrument applies to operators of public telecommunications networks.
Article 2 Incident notification. An operator shall notify the authority of a security incident
affecting its network without undue delay after becoming aware of it.
Article 3 Disclosure of personal data. Personal data of subscribers shall not be disclosed to a
third party outside the operator except where a lawful basis applies.
"""


def fake_embed(texts, *a, **k):
    out = []
    for t in texts:
        v = [0.0] * 64
        for w in t.lower().split():
            v[int(hashlib.md5(w.strip(".,").encode()).hexdigest(), 16) % 64] += 1.0
        n = sum(x * x for x in v) ** 0.5 or 1
        out.append([x / n for x in v])
    return out


@pytest.fixture
def corpus(tmp_path):
    d = tmp_path / "InputDocs" / "UAE_Telecom_Cyber"
    d.mkdir(parents=True)
    (d / "UAE_Sample_Instrument.txt").write_text(SAMPLE)
    (d / "unlisted.txt").write_text("Article 9 should never be ingested")
    man = tmp_path / "manifest.yaml"
    man.write_text(yaml.safe_dump({"documents": [{
        "file": "UAE_Telecom_Cyber/UAE_Sample_Instrument.txt", "instrument": "Sample Test Instrument",
        "short": "STI", "jurisdiction": "test", "official_url": "https://example.com", "licence": "test"}]}))
    return tmp_path, man


def test_itu_pipeline_ingest_with_articles_and_uae(corpus, monkeypatch):
    from kb import ingest_uae
    ing, _, _ = itu.load()
    monkeypatch.setattr(ing, "embed_texts", fake_embed)
    tmp, man = corpus
    res = ingest_uae.run(docs=tmp / "InputDocs", manifest_path=man, chroma=tmp / "chroma", reset=True)
    assert list(res) == ["UAE_Telecom_Cyber/UAE_Sample_Instrument.txt"], "unlisted file must be skipped"
    assert ing.infer_country("UAE_PDPL_2021.pdf") == "United Arab Emirates"

    from kb.retrieve import Retriever
    r = Retriever(backend="chroma", chroma_dir=tmp / "chroma", embed=fake_embed)
    hits = r.search("notify the authority of a security incident", k=1)
    assert hits and hits[0].instrument == "Sample Test Instrument"
    assert hits[0].article.startswith("Article")


def test_lexical_fallback_finds_the_right_article(corpus):
    from kb.retrieve import Retriever
    tmp, man = corpus
    m = {d["file"]: d for d in yaml.safe_load(open(man))["documents"]}
    words = SAMPLE.split()
    r = Retriever(backend="lexical", docs=tmp / "InputDocs", manifest=m)
    hits = r.search("disclosure of subscriber personal data to a third party", k=1)
    assert hits and "Sample Test Instrument" in hits[0].cite()
