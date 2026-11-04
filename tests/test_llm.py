"""The OpenAI path sends no tools and reads OPENAI_API_KEY (checked with a stub, offline)."""
import sys, types
from trustlayer import llm


def test_openai_provider_sends_no_tools(monkeypatch):
    seen = {}

    class Completions:
        def create(self, **kw):
            seen.update(kw)
            msg = types.SimpleNamespace(content="OK")
            return types.SimpleNamespace(choices=[types.SimpleNamespace(message=msg)],
                                         usage=types.SimpleNamespace(prompt_tokens=3, completion_tokens=1))

    stub = types.SimpleNamespace(OpenAI=lambda: types.SimpleNamespace(chat=types.SimpleNamespace(completions=Completions())))
    monkeypatch.setitem(sys.modules, "openai", stub)
    monkeypatch.setenv("PT_LLM_PROVIDER", "openai")
    monkeypatch.setenv("PT_REASONING_MODEL", "some-model")
    r = llm.complete("sys", "ping", max_tokens=5)
    assert r.text == "OK" and "tools" not in seen and seen["messages"][0]["role"] == "system"
