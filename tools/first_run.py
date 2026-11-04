"""ONE command to go from a filled .env to spike results. Works on Windows, Mac and Linux.

  python tools/first_run.py              # everything: install, checks, spike (RUNS=5)
  python tools/first_run.py --runs 2     # cheaper spike
  python tools/first_run.py --no-spike   # setup and checks only

It never prints your key. At the end it writes results/FIRST_RUN_REPORT.md, which contains no
secrets and which you can paste into the chat.
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENV = ROOT / ".env"
HOLMES_PIN = "git+https://github.com/HolmesGPT/holmesgpt@65332c5637e3624c78eb0fa950e68946d446f75f"
REPORT: list[str] = ["# First run report (no secrets)", ""]


def say(status: str, msg: str):
    line = f"{status:6} {msg}"
    print(line, flush=True)
    REPORT.append(f"- {status} {msg}")


def read_env() -> dict:
    d = {}
    for line in ENV.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            d[k.strip()] = v.strip().strip('"').strip("'")
    return d


def set_env_value(key: str, value: str):
    lines = ENV.read_text(encoding="utf-8").splitlines()
    for i, l in enumerate(lines):
        if l.strip().startswith(key + "="):
            lines[i] = f"{key}={value}"
            break
    else:
        lines.append(f"{key}={value}")
    ENV.write_text("\n".join(lines) + "\n", encoding="utf-8")


def pip(*args) -> bool:
    r = subprocess.run([sys.executable, "-m", "pip", "install", "-q", *args], cwd=ROOT)
    return r.returncode == 0


def step_env() -> dict:
    alt = ROOT / "env-file.txt"
    if ENV.exists() and alt.exists() and "paste" in ENV.read_text() and "paste-your" not in alt.read_text():
        ENV.unlink()
        say("fixed", "replaced a blank .env with your filled env-file.txt")
    if not ENV.exists():
        if alt.exists():
            alt.rename(ENV)
            say("fixed", "renamed env-file.txt to .env")
        else:
            say("FAIL", ".env not found in the project folder (next to README.md)")
            sys.exit(1)
    e = read_env()
    prov = e.get("PT_LLM_PROVIDER", "")
    key_name = {"openai": "OPENAI_API_KEY", "anthropic": "ANTHROPIC_API_KEY"}.get(prov)
    if not key_name:
        say("FAIL", f"PT_LLM_PROVIDER must be openai or anthropic (found {prov!r})"); sys.exit(1)
    problems = []
    for k in (key_name, "PT_REASONING_MODEL", "PT_QUARANTINE_MODEL", "PT_JUDGE_MODEL", "HOLMES_MODEL"):
        v = e.get(k, "")
        if not v or "paste" in v:
            problems.append(k)
    if problems:
        say("FAIL", "fill these in .env: " + ", ".join(problems)); sys.exit(1)
    say("ok", f"provider={prov}; {key_name} set ({len(e[key_name])} chars, starts {e[key_name][:3]}...)")
    say("ok", f"models: reasoning={e['PT_REASONING_MODEL']} quarantine={e['PT_QUARANTINE_MODEL']} "
              f"judge={e['PT_JUDGE_MODEL']} holmes={e['HOLMES_MODEL']}")
    if prov == "openai" and not e["HOLMES_MODEL"].startswith("openai/"):
        say("warn", "HOLMES_MODEL usually needs the prefix 'openai/' for OpenAI models")
    if not e.get("PT_AUDIT_KEY"):
        from cryptography.fernet import Fernet
        set_env_value("PT_AUDIT_KEY", Fernet.generate_key().decode())
        say("fixed", "generated PT_AUDIT_KEY and saved it in .env")
    return read_env()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", type=int, default=5)
    ap.add_argument("--no-spike", action="store_true")
    a = ap.parse_args()
    print(f"Python {sys.version.split()[0]} at {sys.executable}\n")
    REPORT.append(f"- Python {sys.version.split()[0]}")
    if sys.version_info < (3, 12):
        say("warn", "Python 3.12+ recommended")

    # 1. dependencies (cryptography first: needed to generate the audit key)
    if not pip("-e", ".[dev,llm]"):
        say("FAIL", "pip install of the project failed (see messages above)"); sys.exit(1)
    say("ok", "project installed")
    e = step_env()
    for k, v in e.items():
        os.environ[k] = v

    # 2. offline tests
    r = subprocess.run([sys.executable, "-m", "pytest", "-q", "-p", "no:warnings"], cwd=ROOT,
                       capture_output=True, text=True)
    summary = next((l for l in reversed(r.stdout.splitlines()) if "passed" in l or "failed" in l), "")
    if not summary:
        summary = "all passed" if r.returncode == 0 else "failures (run: python -m pytest)"
    say("ok" if r.returncode == 0 else "FAIL", f"offline tests: {summary.strip()}")
    r = subprocess.run([sys.executable, "-m", "scenarios.validate"], cwd=ROOT, capture_output=True, text=True)
    say("ok" if r.returncode == 0 else "FAIL", "policy scenarios: " + (r.stdout.strip().splitlines() or ["?"])[-1].strip())

    # 3. live connection test (fractions of a cent)
    sys.path.insert(0, str(ROOT))
    from trustlayer import llm
    for env_name in ("PT_REASONING_MODEL", "PT_QUARANTINE_MODEL"):
        try:
            t = llm.complete("Reply with the single word OK.", "ping", model_env=env_name, max_tokens=20).text
            say("ok" if "ok" in t.lower() else "warn", f"live call with {env_name}: replied {t.strip()[:30]!r}")
        except Exception as ex:
            say("FAIL", f"live call with {env_name}: {type(ex).__name__}: {str(ex)[:200]}")
            (ROOT / "results").mkdir(exist_ok=True)
            (ROOT / "results" / "FIRST_RUN_REPORT.md").write_text("\n".join(REPORT) + "\n")
            sys.exit(1)

    # 4. HolmesGPT
    hb = shutil.which(os.environ.get("HOLMES_BIN", "holmes")) or next(
        (str(p) for p in (Path(sys.executable).parent / "holmes", Path(sys.executable).parent / "holmes.exe") if p.exists()), None)
    if not hb:
        print("Installing HolmesGPT (pinned; this can take several minutes)...", flush=True)
        if pip(HOLMES_PIN):
            say("ok", "HolmesGPT installed (pinned 65332c5)")
        else:
            say("FAIL", "HolmesGPT install failed; fallback: python -m eval.run_exp1 --agent fallback")
    else:
        say("ok", f"HolmesGPT found: {hb}")

    # 5. spike
    if not a.no_spike:
        os.environ["RUNS"] = str(a.runs)
        r = subprocess.run([sys.executable, str(ROOT / "spike" / "run_spike.py")], cwd=ROOT)
        res = ROOT / "results" / "spike" / "SPIKE_RESULTS.md"
        if res.exists():
            REPORT.extend(["", res.read_text()])
            say("ok", "spike finished: results/spike/SPIKE_RESULTS.md")
        else:
            say("FAIL", "spike did not produce results; see results/spike/*.txt")

    (ROOT / "results").mkdir(exist_ok=True)
    (ROOT / "results" / "FIRST_RUN_REPORT.md").write_text("\n".join(REPORT) + "\n")
    print("\nDone. Paste results/FIRST_RUN_REPORT.md into the chat (it contains no secrets).")


if __name__ == "__main__":
    main()
