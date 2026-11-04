"""Import ITU's reference knowledge-base code (CrashingGuru/ITUAIReadiness) as a pinned
submodule at kb/ITUAIReadiness. Set PT_ITU_DIR to override the location."""
from __future__ import annotations

import os
import sys
from pathlib import Path

ITU_DIR = Path(os.environ.get("PT_ITU_DIR", Path(__file__).resolve().parent / "ITUAIReadiness")) / "simulation"


def load():
    if not ITU_DIR.exists():
        raise RuntimeError(f"ITU reference code not found at {ITU_DIR}. Run: bash tools/setup_itu.sh")
    if str(ITU_DIR) not in sys.path:
        sys.path.insert(0, str(ITU_DIR))
    from server.knowledge import ingest as ing          # noqa: E402
    from server.knowledge.kb import KnowledgeBase       # noqa: E402
    from server.config import settings                  # noqa: E402
    return ing, KnowledgeBase, settings
