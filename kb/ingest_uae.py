"""Ingest the UAE corpus (and comparators) with ITU's reference pipeline.

Reuses ITU's own functions unchanged: parse_file (docling -> PyMuPDF), chunk_text (~256 words),
embed_texts (Ollama nomic-embed-text), build_metadata, KnowledgeBase.add_documents (ChromaDB).
Adds three things:
  1. the UAE in ITU's country detection (it is not there yet)
  2. an `article` field per chunk (kb/articles.py) so agents can cite exact provisions
  3. a provenance gate: every file must be listed in kb/manifest.yaml with its official source

  python -m kb.ingest_uae                    # ingest kb/InputDocs into kb/chroma
  python -m kb.ingest_uae --reset            # rebuild from scratch
"""
from __future__ import annotations

import argparse
import os
import re
import shutil
from pathlib import Path

import yaml

from kb import itu
from kb.articles import assign

ROOT = Path(__file__).resolve().parent
DOCS = ROOT / "InputDocs"
CHROMA = Path(os.environ.get("PT_CHROMA_DIR", ROOT / "chroma"))
COLLECTION = os.environ.get("PT_KB_COLLECTION", "kb_main")
UAE_PATTERN = (r"(?i)(^|[^a-z])(uae|united.arab.emirates|emirates|tdra|federal.decree|abu.dhabi|dubai)([^a-z]|$)",
               "United Arab Emirates")
SUPPORTED = {".pdf", ".txt", ".md", ".html", ".csv"}


def manifest(path: Path = ROOT / "manifest.yaml") -> dict[str, dict]:
    docs = (yaml.safe_load(open(path)) or {}).get("documents") or []
    return {d["file"]: d for d in docs}


def patch_itu(ing):
    pats = getattr(ing, "_COUNTRY_PATTERNS", None)
    if isinstance(pats, list) and UAE_PATTERN not in pats:
        pats.insert(0, UAE_PATTERN)


def ingest_file(path: Path, rel: str, meta_doc: dict, kb, ing) -> int:
    text = ing.parse_file(path)
    if not text.strip():
        print(f"  ! no text extracted from {rel}")
        return 0
    chunks = ing.chunk_text(text)
    arts = assign(chunks)
    embeddings = ing.embed_texts(chunks)
    category = rel.split("/")[0] if "/" in rel else "general"
    metas = []
    for i, a in enumerate(arts):
        m = ing.build_metadata(path, i, len(chunks), {"document_category": category})
        m.update({"instrument": meta_doc.get("instrument", ""), "short": meta_doc.get("short", ""),
                  "jurisdiction": meta_doc.get("jurisdiction", ""), "official_url": meta_doc.get("official_url", ""),
                  "language": meta_doc.get("language", ""), **a})
        metas.append({k: str(v) for k, v in m.items()})
    kb.add_documents(texts=chunks, embeddings=embeddings, metadatas=metas, collection_name=COLLECTION)
    return len(chunks)


def run(docs: Path = DOCS, reset: bool = False, manifest_path: Path = ROOT / "manifest.yaml",
        chroma: Path = CHROMA) -> dict[str, int]:
    ing, KnowledgeBase, _ = itu.load()
    patch_itu(ing)
    if reset and chroma.exists():
        shutil.rmtree(chroma)
    kb = KnowledgeBase(persist_dir=str(chroma))
    man = manifest(manifest_path)
    results = {}
    for path in sorted(p for p in docs.rglob("*") if p.is_file() and p.suffix.lower() in SUPPORTED):
        rel = path.relative_to(docs).as_posix()
        if path.name.lower() in ("inputs.md", "readme.md"):
            continue
        if rel not in man:
            print(f"  ! SKIPPED {rel}: not in kb/manifest.yaml (add its official source first)")
            continue
        results[rel] = ingest_file(path, rel, man[rel], kb, ing)
        print(f"  {results[rel]:4d} chunks  {rel}")
    return results


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--reset", action="store_true")
    a = ap.parse_args()
    r = run(reset=a.reset)
    print(f"done: {len(r)} documents, {sum(r.values())} chunks -> {CHROMA} [{COLLECTION}]")
