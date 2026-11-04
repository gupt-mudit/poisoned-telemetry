"""Converted official texts mark real headings with '§§'; cross-references must not move the article."""
from kb.articles import assign


def test_marked_headings_ignore_cross_references():
    chunks = ["§§ Article 23 — Reporting obligations. Entities shall notify, as referred to in Article 21.",
              "continued text of the same article, see also Article 32 and Article 33.",
              "§§ Article 24 — Use of certification schemes"]
    arts = [a["article"] for a in assign(chunks)]
    assert arts == ["Article 23", "Article 23", "Article 24"]


def test_unmarked_documents_keep_old_behaviour():
    arts = [a["article"] for a in assign(["Article 3 Scope of the law", "text with no heading"])]
    assert arts == ["Article 3", "Article 3"]
