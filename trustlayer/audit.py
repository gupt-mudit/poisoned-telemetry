"""Hash-chained, append-only audit log.

- Each entry stores the previous entry's hash; any edit breaks the chain.
- Source text is NOT stored in the chain: it is encrypted (Fernet) into audit/sources/<sha256>.bin
  and the entry keeps only its fingerprint, so the chain can be shared without the content.
- anchor() copies the latest hash to a separate anchors file the agents never write to.
- Integrity is checked by tools/verify_audit.py, which imports nothing from this project.
A hash chain proves the record was not CHANGED after writing; it does not prove it was TRUE.
"""
from __future__ import annotations

import hashlib
import json
import os
import warnings
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from cryptography.fernet import Fernet

GENESIS = "0" * 64


def canonical(obj) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)


def sha256(s: str | bytes) -> str:
    return hashlib.sha256(s.encode() if isinstance(s, str) else s).hexdigest()


class AuditLog:
    def __init__(self, path: Path, key: Optional[bytes] = None, anchors: Optional[Path] = None):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.sources = self.path.parent / "sources"
        self.sources.mkdir(exist_ok=True)
        self.anchors = Path(anchors) if anchors else self.path.parent / "anchors" / "anchors.txt"
        self.anchors.parent.mkdir(parents=True, exist_ok=True)
        if key is None and not os.environ.get("PT_AUDIT_KEY"):
            from trustlayer.llm import _load_dotenv   # .env may not be loaded yet (runners import audit first)
            _load_dotenv()
        k = key or (os.environ.get("PT_AUDIT_KEY") or "").encode()
        if not k:
            warnings.warn("PT_AUDIT_KEY not set: using an ephemeral key; stored source text will be unreadable later")
            k = Fernet.generate_key()
        self._fernet = Fernet(k)

    def _last_hash(self) -> str:
        if not self.path.exists() or self.path.stat().st_size == 0:
            return GENESIS
        last = self.path.read_text().rstrip("\n").split("\n")[-1]
        return json.loads(last)["hash"]

    def append(self, event: str, actor: str, payload: dict, source_text: Optional[str] = None) -> dict:
        ref = None
        if source_text is not None:
            ref = sha256(source_text)
            blob = self.sources / f"{ref}.bin"
            if not blob.exists():
                blob.write_bytes(self._fernet.encrypt(source_text.encode()))
        entry = {"ts": datetime.now(timezone.utc).isoformat(), "event": event, "actor": actor,
                 "payload": payload, "source_ref": ref, "prev": self._last_hash()}
        entry["hash"] = sha256(canonical(entry))
        with open(self.path, "a") as f:
            f.write(canonical(entry) + "\n")
        return entry

    def anchor(self) -> str:
        h = self._last_hash()
        with open(self.anchors, "a") as f:
            f.write(f"{datetime.now(timezone.utc).isoformat()} {h}\n")
        return h

    def read_source(self, ref: str) -> str:
        """Restricted: for named human roles (auditor, security officer) only."""
        return self._fernet.decrypt((self.sources / f"{ref}.bin").read_bytes()).decode()
