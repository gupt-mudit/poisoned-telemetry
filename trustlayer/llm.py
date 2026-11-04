"""Minimal model client. provider "fake" is deterministic and offline (used by tests);
"anthropic" or "openai" call that provider's API with the key from the environment
(ANTHROPIC_API_KEY or OPENAI_API_KEY).

The quarantine reader calls `complete(..., tools=None)` ALWAYS: no tool definitions are
ever passed to the quarantine model. That isolation is configuration, not a prompt request.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass


@dataclass
class LLMResult:
    text: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0


def _load_dotenv():
    p = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    if os.path.exists(p):
        for line in open(p):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


_load_dotenv()


def provider() -> str:
    return os.environ.get("PT_LLM_PROVIDER", "fake")


def complete(system: str, user: str, model_env: str = "PT_REASONING_MODEL", max_tokens: int = 1200,
             fake_response: str | None = None) -> LLMResult:
    if provider() == "fake":
        return LLMResult(text=fake_response if fake_response is not None else json.dumps({"fake": True}),
                         model="fake")
    if provider() == "anthropic":
        import anthropic  # optional dependency: pip install ".[llm]"
        model = os.environ.get(model_env)
        if not model:
            raise RuntimeError(f"{model_env} is not set; pin a model ID in .env")
        client = anthropic.Anthropic()
        r = client.messages.create(model=model, max_tokens=max_tokens, system=system,
                                   messages=[{"role": "user", "content": user}])  # no `tools=`
        text = "".join(b.text for b in r.content if getattr(b, "type", "") == "text")
        return LLMResult(text=text, model=model, input_tokens=r.usage.input_tokens,
                         output_tokens=r.usage.output_tokens)
    if provider() == "openai":
        import openai  # optional dependency: pip install ".[llm]"
        model = os.environ.get(model_env)
        if not model:
            raise RuntimeError(f"{model_env} is not set; pin a model ID in .env")
        client = openai.OpenAI()   # reads OPENAI_API_KEY
        r = client.chat.completions.create(
            model=model, max_completion_tokens=max_tokens,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}])  # no `tools=`
        u = getattr(r, "usage", None)
        return LLMResult(text=r.choices[0].message.content or "", model=model,
                         input_tokens=getattr(u, "prompt_tokens", 0) or 0,
                         output_tokens=getattr(u, "completion_tokens", 0) or 0)
    raise RuntimeError(f"unknown PT_LLM_PROVIDER {provider()!r} (use fake, anthropic or openai)")


def parse_json(text: str):
    t = text.strip()
    if t.startswith("```"):
        t = t.strip("`")
        t = t[t.find("\n") + 1:] if "\n" in t else t
    start, end = t.find("{"), t.rfind("}")
    return json.loads(t[start:end + 1]) if start >= 0 else {}
