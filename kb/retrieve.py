"""Search the knowledge base. Agents call search(query) and get passages with their
instrument and article, ready to cite.

Backend "chroma": the ITU-built ChromaDB (kb/chroma), query embedded with the same
                  ITU embed_texts (Ollama nomic-embed-text).
Backend "lexical": offline fallback over kb/InputDocs text files (no Ollama needed);
                  used by tests and when the vector store is not built yet.
"""
from __future__ import annotations

import math
import os
import re
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

from kb.articles import assign

ROOT = Path(__file__).resolve().parent


@dataclass
class Passage:
    id: str
    text: str
    instrument: str
    article: str
    source_file: str
    score: float

    def cite(self) -> str:
        return f"{self.instrument or self.source_file}, {self.article}"


def _tokens(s: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", s.lower())


class Retriever:
    def __init__(self, backend: str | None = None, chroma_dir: Path | None = None,
                 docs: Path | None = None, manifest: dict | None = None, embed=None):
        self.chroma_dir = Path(chroma_dir or os.environ.get("PT_CHROMA_DIR", ROOT / "chroma"))
        self.backend = backend or ("chroma" if self.chroma_dir.exists() else "lexical")
        self.docs = Path(docs or ROOT / "InputDocs")
        self._embed = embed
        if self.backend == "chroma":
            from kb import itu
            ing, KnowledgeBase, _ = itu.load()
            self._kb = KnowledgeBase(persist_dir=str(self.chroma_dir))
            self._embed = embed or (lambda qs: ing.embed_texts(qs))
        else:
            from kb.ingest_uae import manifest as load_manifest
            self._man = manifest if manifest is not None else load_manifest()
            self._index = self._build_lexical()

    def _build_lexical(self):
        idx = []
        for p in sorted(self.docs.rglob("*")):
            if not p.is_file() or p.suffix.lower() not in (".txt", ".md"):
                continue
            rel = p.relative_to(self.docs).as_posix()
            words = p.read_text(errors="ignore").split()
            chunks = [" ".join(words[i:i + 256]) for i in range(0, len(words), 226)] or [""]
            for i, (c, a) in enumerate(zip(chunks, assign(chunks))):
                idx.append((f"{rel}#{i}", c, Counter(_tokens(c)), self._man.get(rel, {}).get("instrument", ""),
                            a["article"], rel))
        n = len(idx) or 1
        df = Counter(t for _, _, tf, *_ in idx for t in tf)
        self._idf = {t: math.log(1 + n / d) for t, d in df.items()}
        return idx

    def search(self, query: str, k: int = 3) -> list[Passage]:
        if self.backend == "chroma":
            r = self._kb.search(self._embed([query])[0], n_results=k, collection_name=os.environ.get("PT_KB_COLLECTION", "kb_main"))
            out = []
            for i, (doc, meta, dist) in enumerate(zip(r["documents"][0], r["metadatas"][0], r["distances"][0])):
                out.append(Passage(id=r["ids"][0][i], text=doc, instrument=meta.get("instrument", ""),
                                   article=meta.get("article", "unknown"), source_file=meta.get("source_file", ""),
                                   score=1 - float(dist)))
            return out
        q = Counter(_tokens(query))
        scored = []
        for pid, text, tf, inst, art, rel in self._index:
            s = sum(q[t] * tf.get(t, 0) * self._idf.get(t, 0) ** 2 for t in q)
            s /= math.sqrt(sum(v * v for v in tf.values()) or 1)
            scored.append((s, Passage(pid, text, inst, art, rel, s)))
        return [p for s, p in sorted(scored, key=lambda x: -x[0])[:k] if s > 0]
