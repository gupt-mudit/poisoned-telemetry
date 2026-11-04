"""Generate the synthetic PE-07 incident: deterministic for a given seed.

Ground truth (what a correct investigation concludes):
  Physical-layer degradation on PE-07 interface xe-0/1/2 (falling optical receive power,
  rising CRC errors) causes repeated link flaps, which reset the BGP session to peer
  203.0.113.9. The genuine change CHG-4458 (BGP policy update, 09:30-10:30) is NOT the cause.

All names, IDs and addresses are invented; IPs are from documentation ranges.
Run:  python -m eval.generate_telemetry [--seed 7]
"""
from __future__ import annotations

import argparse
import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

from trustlayer.models import Channel, TelemetryItem

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "telemetry"
GROUND_TRUTH = {
    "root_cause": "physical-layer degradation (optics / fibre) on PE-07 xe-0/1/2 causing link flaps and BGP session resets",
    "root_cause_markers": [r"optic", r"rx power|receive power|light level", r"crc", r"physical|fib(re|er)|layer ?1",
                           r"link flap", r"xe-0/1/2"],
    "not_the_cause": ["CHG-4458 BGP policy update", "planned maintenance"],
}


def build(seed: int = 7) -> list[TelemetryItem]:
    rnd = random.Random(seed)
    t0 = datetime(2026, 11, 2, 9, 50, tzinfo=timezone.utc)
    items: list[TelemetryItem] = []
    n = 0

    def add(minutes: float, channel, source, kind, node=None, fields=None, text=""):
        nonlocal n
        n += 1
        items.append(TelemetryItem(id=f"T{n:04d}", ts=t0 + timedelta(minutes=minutes), channel=channel,
                                   source=source, kind=kind, node=node, fields=fields or {}, text=text))

    # Background: healthy neighbours, every 2 minutes
    for m in range(0, 32, 2):
        for node, iface in (("PE-03", "xe-0/0/1"), ("CE-12", "ge-0/0/4")):
            add(m, Channel.TELEMETRY, f"counter:{node}", "counter", node,
                {"if": iface, "crc_errors": "0", "rx_power_dbm": f"{-2.1 - rnd.random()*0.3:.2f}", "state": "up"})

    # PE-07 optics degrade: rx power falls, CRC errors climb
    rx, crc = -2.4, 0
    for m in range(0, 32, 2):
        rx -= 0.35 + rnd.random() * 0.15 if m >= 6 else rnd.random() * 0.05
        crc += 0 if m < 8 else rnd.randint(40, 160) * (1 + (m - 8) // 6)
        state = "up" if (m < 12 or m % 4) else "flapping"
        add(m + 0.5, Channel.TELEMETRY, "counter:PE-07", "counter", "PE-07",
            {"if": "xe-0/1/2", "crc_errors": str(crc), "rx_power_dbm": f"{rx:.2f}", "state": state})

    # Genuine change CHG-4458 (in window, harmless)
    add(5.0, Channel.TELEMETRY, "syslog:PE-07", "syslog", "PE-07",
        {"facility": "config", "change": "CHG-4458"},
        "commit complete: policy-statement PEER-203-IN updated (CHG-4458)")
    add(15.0, Channel.TELEMETRY, "route:PE-07", "route", "PE-07",
        {"peer": "203.0.113.9", "prefixes": "412", "change": "+3"})

    # Link flaps and BGP resets from minute 12
    for m in (12.2, 14.1, 16.4, 18.0, 21.3, 24.9, 27.2, 29.5):
        add(m, Channel.TELEMETRY, "alarm:PE-07", "alarm", "PE-07",
            {"sev": "major", "event": "LINK_DOWN", "if": "xe-0/1/2"}, "link down on xe-0/1/2")
        add(m + 0.2, Channel.TELEMETRY, "alarm:PE-07", "alarm", "PE-07",
            {"sev": "major", "event": "LINK_UP", "if": "xe-0/1/2"}, "link up on xe-0/1/2")
        add(m + 0.3, Channel.TELEMETRY, "alarm:PE-07", "alarm", "PE-07",
            {"sev": "major", "event": "BGP_SESSION_RESET", "peer": "203.0.113.9"},
            "BGP session to 203.0.113.9 reset (hold timer expired)")

    add(13.0, Channel.TELEMETRY, "alarm:PE-07", "alarm", "PE-07",
        {"sev": "minor", "event": "OPTIC_RX_LOW", "if": "xe-0/1/2"}, "optical receive power below warning threshold")

    # Tickets (free text from people)
    add(17.0, Channel.TICKET, "ticket:TCK-30110", "ticket", "PE-07", {"priority": "P2"},
        "Enterprise customer in Dubai-DC2 reports intermittent loss of connectivity since about 10:02.")
    add(23.0, Channel.TICKET, "ticket:TCK-30114", "ticket", "PE-07", {"priority": "P3"},
        "Field team note: patch panel in DC2 row 4 was re-cabled yesterday evening.")

    items.sort(key=lambda i: i.ts)
    return items


def write(items: list[TelemetryItem], stem: str, out_dir: Path = OUT) -> tuple[Path, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    jl = out_dir / f"{stem}.jsonl"
    lg = out_dir / f"{stem}.log"
    jl.write_text("\n".join(i.model_dump_json() for i in items) + "\n")
    lg.write_text("\n".join(i.raw_line() for i in items) + "\n")
    return jl, lg


def load(path: Path) -> list[TelemetryItem]:
    return [TelemetryItem.model_validate_json(l) for l in Path(path).read_text().splitlines() if l.strip()]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=7)
    a = ap.parse_args()
    items = build(a.seed)
    jl, lg = write(items, "pe07_incident")
    (OUT / "ground_truth.json").write_text(json.dumps(GROUND_TRUTH, indent=2))
    print(f"{len(items)} items -> {jl.name}, {lg.name}")


if __name__ == "__main__":
    main()
