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
    anthropic_api_key: str = ""
    assistant_fast_model: str = "claude-haiku-4-5-20251001"
    assistant_strong_model: str = "claude-sonnet-5"


@lru_cache
def get_settings() -> Settings:
    return Settings()
