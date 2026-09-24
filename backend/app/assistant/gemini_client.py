"""Minimal server-side Gemini client.

The key stays on the FastAPI server; it is never sent to the Expo app or bundled into
client-side JavaScript. Uses the documented Gemini generateContent REST endpoint so no
additional SDK dependency is required.
"""

from __future__ import annotations

import httpx

from app.core.config import get_settings


async def generate_gemini_text(
    *, system: str, prompt: str, max_output_tokens: int, temperature: float, json_output: bool = False
) -> str:
    settings = get_settings()
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    payload: dict = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "maxOutputTokens": max_output_tokens,
            "temperature": temperature,
        },
    }
    if json_output:
        payload["generationConfig"]["responseMimeType"] = "application/json"

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent"
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(url, headers={"x-goog-api-key": settings.gemini_api_key}, json=payload)
        response.raise_for_status()

    data = response.json()
    parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    text = "".join(part.get("text", "") for part in parts).strip()
    if not text:
        raise ValueError("Gemini returned an empty completion")
    return text
