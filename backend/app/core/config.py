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
    assistant_fast_model: str = "meta-llama/llama-3.1-8b-instruct:free"
    assistant_strong_model: str = "google/gemini-2.0-flash-exp:free"


@lru_cache
def get_settings() -> Settings:
    return Settings()
