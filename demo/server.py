"""Local demo server for the Poisoned Telemetry command centre.

    make demo            (or: .venv/bin/python -m demo.server)  ->  http://127.0.0.1:8765

Binds to localhost only. Offline by default; the "Live AI" switch in the page sends live=true, which uses
the provider and key from .env (the key is never sent to the browser).
"""
from __future__ import annotations

import argparse
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from demo import engine

STATIC = Path(__file__).resolve().parent / "static"
app = FastAPI(title="Poisoned Telemetry demo", docs_url=None, redoc_url=None)


@app.middleware("http")
async def revalidate_ui(request, call_next):
    """Make the browser re-check the page and its static files, so an updated UI never shows from a stale cache."""
    resp = await call_next(request)
    if request.url.path == "/" or request.url.path.startswith("/static/"):
        resp.headers["Cache-Control"] = "no-cache"
    return resp


class Custom(BaseModel):
    text: str = Field(min_length=3, max_length=2000)
    channel: str = Field("ticket", pattern="^(ticket|telemetry|agent)$")
    source: str = Field("ticket:TCK-50001", max_length=80)
    goal: str = Field("suppress", pattern="^(suppress|leak|regulator|emergency)$")


class SimRequest(BaseModel):
    scenario: str | None = None
    case: str = "base"
    custom: Custom | None = None
    live: bool = False


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")


@app.get("/api/overview")
def overview():
    return engine.overview()


@app.get("/api/scenarios")
def scenarios():
    return engine.scenarios()


@app.post("/api/simulate")
def simulate(req: SimRequest):
    if req.live and not engine.live_available():
        raise HTTPException(400, "Live mode needs an API key in .env")
    try:
        return engine.simulate(req.scenario, req.case, req.custom.model_dump() if req.custom else None, req.live)
    except (KeyError, StopIteration):
        raise HTTPException(404, "unknown scenario or case")


@app.get("/api/command")
def command():
    return engine.command()


@app.post("/api/session/new")
def new_session():
    return engine.new_session()


@app.get("/api/decisions")
def decisions():
    return {"decisions": engine.decisions(), "rules": engine.rule_catalogue()}


@app.get("/api/agents")
def agents():
    return {"roster": engine.roster(), "runs": engine.runs(15)}


@app.get("/api/exp1")
def exp1():
    return {"summary": engine.exp1_summary(), "payloads": engine.exp1_payloads()}


@app.get("/api/replay/{pid}")
def replay(pid: str, model: str = "gpt-4.1", rep: int = 1):
    try:
        return engine.replay(pid, model, rep)
    except StopIteration:
        raise HTTPException(404, "unknown payload or model")


@app.get("/api/gaps")
def gaps():
    return engine.gaps()


@app.get("/api/audit/{log}")
def audit(log: str):
    if log not in engine.AUDIT_LOGS:
        raise HTTPException(404)
    return engine.audit_entries(log)


@app.post("/api/audit/{log}/verify")
def verify(log: str):
    if log not in engine.AUDIT_LOGS:
        raise HTTPException(404)
    return engine.verify_audit(log)


@app.post("/api/audit/{log}/tamper")
def tamper(log: str):
    if log not in engine.AUDIT_LOGS:
        raise HTTPException(404)
    return engine.tamper_test(log)


app.mount("/static", StaticFiles(directory=STATIC), name="static")


def main():
    import uvicorn
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8765)
    a = ap.parse_args()
    uvicorn.run(app, host="127.0.0.1", port=a.port, log_level="warning")


if __name__ == "__main__":
    main()
