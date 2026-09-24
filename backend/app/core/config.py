from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "development"
    database_url: str = "postgresql+asyncpg://operator_os:operator_os@localhost:5432/operator_os"
    jwt_secret: str = "change-me-in-dev"
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 1440
    mqtt_host: str = "localhost"
    mqtt_port: int = 1883

    # OpenRouter (OpenAI-compatible API) — chosen over calling Anthropic/OpenAI directly to
    # use free-tier models. Check https://openrouter.ai/models?max_price=0 for the current
    # free catalog before deploying; free-tier model availability changes over time.
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    # Direct Gemini fallback/preferred provider. Keep this server-only: never prefix it
    # with EXPO_PUBLIC_ or place it in the mobile app's environment.
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    # OpenRouter's free-tier catalog turns over — both defaults below were verified
    # live against https://openrouter.ai/api/v1/models on 2026-09-24; the previous
    # defaults (llama-3.1-8b-instruct:free, gemini-2.0-flash-exp:free) had been pulled
    # from the free tier and returned 404s. If these ever go stale too, query that
    # endpoint for pricing.prompt == "0" && pricing.completion == "0" rather than
    # guessing a slug from memory.
    assistant_fast_model: str = "nex-agi/nex-n2.5-mini:free"
    assistant_strong_model: str = "nvidia/nemotron-3-super-120b-a12b:free"


@lru_cache
def get_settings() -> Settings:
    return Settings()
