"""Find which article/section each chunk belongs to, so agents can cite exact provisions.
Chunks are processed in order; text before the first heading in a chunk belongs to the
previous chunk's last article."""
from __future__ import annotations

import re

PATTERNS = [
    (re.compile(r"\b(?:Article|Art\.)\s+(\d+[A-Za-z]?)", re.I), "Article"),
    (re.compile(r"\bSection\s+(\d+(?:\.\d+)*)", re.I), "Section"),
    (re.compile(r"\bClause\s+(\d+(?:\.\d+)*)", re.I), "Clause"),
    (re.compile(r"(?:المادة|مادة)\s*\(?\s*([0-9\u0660-\u0669]+)"), "Article"),   # Arabic
]


# Converted official texts (e.g. EU Official Journal) mark real headings with "§§ ". When a
# document has markers, ONLY marked headings count, so cross-references ("referred to in
# Article 5") are not mistaken for the article a passage belongs to.
# Also: IA Regulation controls ("§§ Control T8.3.2") and numbered principles ("§§ Principle 6").
MARKED = re.compile(r"§§\s*(Article \d+[A-Za-z]?|Annex [IVXLC]+|Recitals|Control [MT]\d+(?:\.\d+)*|Principle \d+)")


def headings(text: str, marked_only: bool = False) -> list[tuple[int, str]]:
    if marked_only:
        return [(m.start(), m.group(1)) for m in MARKED.finditer(text)]
    found = [(m.start(), f"{label} {m.group(1)}") for rx, label in PATTERNS for m in rx.finditer(text)]
    return sorted(found)


def assign(chunks: list[str]) -> list[dict[str, str]]:
    out, current = [], ""
    marked = any("§§" in c for c in chunks)
    for c in chunks:
        hs = headings(c, marked)
        if hs and hs[0][0] <= 15:            # chunk opens with a heading
            article = hs[0][1]
        else:                                 # chunk continues the previous article
            article = current or (hs[0][1] if hs else "unknown")
        out.append({"article": article,
                    "articles_in_chunk": "; ".join(dict.fromkeys(h for _, h in hs))})
        if hs:
            current = hs[-1][1]
    return out
