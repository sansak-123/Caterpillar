"""Thin OpenRouter client — CLAUDE.md section 4: "OpenRouter (OpenAI-compatible
/chat/completions API, called via the `openai` Python SDK pointed at OpenRouter's base
URL)". Cached the same way `app.core.config.get_settings` already is; both are
process-lifetime singletons in this single-worker dev/demo deployment.
"""

from __future__ import annotations

from functools import lru_cache

from openai import AsyncOpenAI

from app.core.config import get_settings


@lru_cache
def get_openrouter_client() -> AsyncOpenAI:
    settings = get_settings()
    return AsyncOpenAI(
        base_url=settings.openrouter_base_url,
        api_key=settings.openrouter_api_key or "unset",
    )
