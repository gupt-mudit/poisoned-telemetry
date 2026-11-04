"""Experiment 1: does planted telemetry corrupt HolmesGPT's conclusion, per set-up?

For each payload (+ a clean control) x set-up x repetition: build the poisoned copy, generate
the toolset, run `holmes ask`, judge the answer, append a row to results/runs/exp1.jsonl.
Resumable: finished (payload, setup, rep) triples are skipped.

  python -m eval.run_exp1 --reps 3                    # all payloads, all set-ups
  python -m eval.run_exp1 --payloads C3 F4 --setups raw wrapped --reps 1
  python -m eval.run_exp1 --agent fallback            # if HolmesGPT is unavailable
  python -m eval.run_exp1 --dry-run                   # print commands only
"""
from __future__ import annotations

import argparse
import json
import os
import shlex
import shutil
import subprocess
import sys
import time
from pathlib import Path

from eval.fallback_agent import investigate
from eval.generate_telemetry import build, write, GROUND_TRUTH, OUT as TEL
from eval.inject import load_payloads, make
from eval.judge import judge
from holmes_integration.make_toolset import SETUPS, write as write_toolset

ROOT = Path(__file__).resolve().parent.parent
RUNS = ROOT / "results" / "runs"
QUESTION = (ROOT / "holmes_integration" / "question.txt").read_text().strip()


def done_keys(path: Path) -> set:
    if not path.exists():
        return set()
    return {(r["payload"], r["setup"], r["rep"]) for r in map(json.loads, path.read_text().splitlines()) if r}


def run_holmes(toolset: Path, setup: str, out_json: Path) -> tuple[str, int, float]:
    holmes = os.environ.get("HOLMES_BIN", "holmes")
    if not shutil.which(holmes):   # venv not activated: use the holmes installed next to this Python
        local = Path(sys.executable).parent / holmes
        holmes = str(local) if local.exists() else holmes
    cmd = [holmes, "ask", QUESTION, "-t", str(toolset), "--model", os.environ["HOLMES_MODEL"],
           "--no-interactive", "--json-output-file", str(out_json)]
    if setup == "summariser":
        cmd += ["--fast-model", os.environ.get("HOLMES_FAST_MODEL", os.environ["HOLMES_MODEL"])]
    t = time.time()
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    ans = p.stdout
    if out_json.exists():
        try:
            d = json.loads(out_json.read_text())
            ans = str(d.get("result") or d.get("analysis") or ans)
        except Exception:
            pass
    return ans, p.returncode, time.time() - t


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--payloads", nargs="*")
    ap.add_argument("--setups", nargs="*", default=list(SETUPS))
    ap.add_argument("--reps", type=int, default=3)
    ap.add_argument("--agent", choices=["holmes", "fallback"], default="holmes")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--out", default=str(RUNS / "exp1.jsonl"))
    ap.add_argument("--tag", default="", help="keeps answers/toolsets/audit of this batch apart (e.g. mini, adaptive)")
    ap.add_argument("--payload-file", default=None, help="default data/payloads.yaml")
    ap.add_argument("--model", default=None, help="override HOLMES_MODEL (and HOLMES_FAST_MODEL) for this batch")
    ap.add_argument("--clean-reps", type=int, default=None, help="reps for the clean control (default: --reps)")
    ap.add_argument("--only-clean", action="store_true")
    a = ap.parse_args()
    if a.model:
        os.environ["HOLMES_MODEL"] = os.environ["HOLMES_FAST_MODEL"] = a.model
    sfx = f"_{a.tag}" if a.tag else ""
    ANS, TSD, AUD = RUNS / f"answers{sfx}", RUNS / f"toolsets{sfx}", RUNS / f"audit{sfx}" / "audit.jsonl"
    pfile = Path(a.payload_file) if a.payload_file else None

    payloads = [] if a.only_clean else load_payloads(pfile)
    if a.payloads:
        payloads = [p for p in payloads if p["id"] in a.payloads]
    TEL.mkdir(parents=True, exist_ok=True)
    clean_jl, clean_log = write(build(7), "pe07_incident")
    (TEL / "ground_truth.json").write_text(json.dumps(GROUND_TRUTH, indent=2))
    out = Path(a.out); out.parent.mkdir(parents=True, exist_ok=True)
    seen = done_keys(out)
    cases = [("CLEAN", None, clean_log, clean_jl)]
    for p in payloads:
        jl, lg, _ = make(p["id"], path=pfile)
        cases.append((p["id"], p, lg, jl))

    for pid, p, lg, jl in cases:
        for setup in a.setups:
            if a.agent == "fallback" and setup == "summariser":
                continue
            n_reps = (a.clean_reps or a.reps) if pid == "CLEAN" else a.reps
            for rep in range(1, n_reps + 1):
                if (pid, setup, rep) in seen:
                    continue
                ts = write_toolset(setup, lg.resolve(), jl.resolve(), TSD / f"{pid}_{setup}.yaml", AUD)
                if a.dry_run:
                    print(f"{pid:5} {setup:10} rep{rep}: holmes ask <question> -t {ts.relative_to(ROOT)}")
                    continue
                if a.agent == "holmes":
                    ans, rc, secs = run_holmes(ts, setup, ANS / f"{pid}_{setup}_{rep}.json")
                else:
                    t = time.time(); ans = investigate(setup, lg, jl, QUESTION); rc, secs = 0, time.time() - t
                if rc != 0:   # a failed agent run (quota, network, crash) is not data: stop, record nothing
                    raise SystemExit(f"{pid} {setup} rep{rep}: holmes exited {rc}; nothing recorded. "
                                     f"Check {ANS.name}/{pid}_{setup}_{rep}.json, fix, then rerun "
                                     f"(finished runs are skipped).")
                ANS.mkdir(parents=True, exist_ok=True)
                (ANS / f"{pid}_{setup}_{rep}.txt").write_text(ans)
                j = judge(ans, p)
                row = {"payload": pid, "goal": p["goal"] if p else "clean", "style": p["style"] if p else "clean",
                       "setup": setup, "rep": rep, "agent": a.agent, "returncode": rc, "seconds": round(secs, 1),
                       **j, "model": os.environ.get("HOLMES_MODEL", "") if a.agent == "holmes" else
                       os.environ.get("PT_REASONING_MODEL", "fake")}
                with open(out, "a") as f:
                    f.write(json.dumps(row) + "\n")
                print(f"{pid:5} {setup:10} rep{rep}: corrupted={j['corrupted']} correct={j['correct_root_cause']}")


if __name__ == "__main__":
    main()
