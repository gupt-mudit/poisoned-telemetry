"""Insert exactly one payload into a copy of the clean telemetry.

python -m eval.inject C3            -> data/generated/poisoned_C3.{jsonl,log}
python -m eval.inject --all         -> every payload
"""
from __future__ import annotations

import argparse
from datetime import timedelta
from pathlib import Path

import yaml

from eval.generate_telemetry import build, write
from trustlayer.models import Channel, TelemetryItem

ROOT = Path(__file__).resolve().parent.parent
GEN = ROOT / "data" / "generated"


def load_payloads(path: Path | None = None) -> list[dict]:
    return yaml.safe_load(open(path or ROOT / "data" / "payloads.yaml"))["payloads"]


def inject(items: list[TelemetryItem], p: dict) -> tuple[list[TelemetryItem], str]:
    """Return a NEW list with the payload inserted, and the id of the carrying item."""
    items = [i.model_copy(deep=True) for i in items]
    c = p["carrier"]
    if c["mode"] == "append":
        matches = [i for i in items if i.source == c["source"]
                   and (not c.get("event") or i.fields.get("event") == c["event"])]
        if not matches:
            raise ValueError(f"{p['id']}: no carrier item for {c}")
        target = matches[min(c.get("nth", 1), len(matches)) - 1]
        target.text = (target.text + " " if target.text else "") + p["text"]
        return items, target.id
    if c["mode"] == "field":   # attacker writes into a structured field (e.g. an interface description)
        matches = [i for i in items if i.source == c["source"]
                   and (not c.get("event") or i.fields.get("event") == c["event"])]
        if not matches:
            raise ValueError(f"{p['id']}: no carrier item for {c}")
        target = matches[min(c.get("nth", 1), len(matches)) - 1]
        target.fields[c["field"]] = p["text"]
        return items, target.id
    if c["mode"] == "new_ticket":
        t0 = items[0].ts.replace(hour=9, minute=50, second=0, microsecond=0)
        new = TelemetryItem(id=f"P{p['id']}", ts=t0 + timedelta(minutes=c["minute"]), channel=Channel.TICKET,
                            source=c["source"], kind="ticket", node="PE-07", fields={"priority": "P2"},
                            text=p["text"])
        items.append(new)
        items.sort(key=lambda i: i.ts)
        return items, new.id
    raise ValueError(f"unknown carrier mode {c['mode']}")


def make(pid: str, seed: int = 7, path: Path | None = None) -> tuple[Path, Path, str]:
    p = next(x for x in load_payloads(path) if x["id"] == pid)
    items, carrier = inject(build(seed), p)
    jl, lg = write(items, f"poisoned_{pid}_s{seed}", GEN)
    return jl, lg, carrier


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pid", nargs="?")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--seed", type=int, default=7)
    a = ap.parse_args()
    ids = [p["id"] for p in load_payloads()] if a.all else [a.pid]
    for pid in ids:
        jl, lg, carrier = make(pid, a.seed)
        print(f"{pid}: carrier {carrier} -> {lg.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
