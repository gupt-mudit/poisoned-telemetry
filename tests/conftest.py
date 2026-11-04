"""Tests always run offline: they never call a paid API, even if .env holds a real key."""
import os

os.environ["PT_LLM_PROVIDER"] = "fake"
