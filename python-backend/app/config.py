from functools import lru_cache
from typing import Literal

from fastapi import Request

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="OPENBCON_",
        extra="ignore",
    )

    api_host: str = "0.0.0.0"
    api_port: int = 8010
    runtime_env: Literal["development", "test", "production"] = "development"
    environment_mode: Literal["test", "live"] = "test"
    demo_user_id: int = 1
    demo_workspace_id: str = "00000000-0000-4000-8000-000000000002"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    db_dsn: str = Field(
        default="postgresql://admin:bconomics@localhost:5432/dbob1234567890",
    )
    db_dsn_test: str | None = None
    db_dsn_live: str | None = None
    db_dsn_shared: str | None = None
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_database: str = "dbob1234567890"
    mongodb_database_shared: str | None = None
    mongodb_database_test: str | None = None
    mongodb_database_live: str | None = None
    platform_config_key: str = "bconomics-platform-config-v1"
    app_state_encryption_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "APP_STATE_ENCRYPTION_KEY",
            "OPENBCON_APP_STATE_ENCRYPTION_KEY",
        ),
    )
    openai_api_key: str | None = None
    openrouter_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "OPENROUTER_API_KEY",
            "OPENBCON_OPENROUTER_API_KEY",
        ),
    )
    ollama_base_url: str = Field(
        default="http://127.0.0.1:11434",
        validation_alias=AliasChoices(
            "OLLAMA_BASE_URL",
            "OPENBCON_OLLAMA_BASE_URL",
        ),
    )
    ollama_model: str = Field(
        default="smollm2:135m",
        validation_alias=AliasChoices(
            "OLLAMA_MODEL",
            "OPENBCON_OLLAMA_MODEL",
        ),
    )
    openai_model: str = "gpt-5"
    use_mock_llm: bool = False
    allowed_ai_endpoint_hosts: str = (
        "api.openai.com,api.anthropic.com,generativelanguage.googleapis.com,openrouter.ai,api.tokenrouter.com"
    )
    allow_private_ai_endpoints: bool = False


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


EnvironmentMode = Literal["test", "live"]


def get_environment_mode(_request: Request) -> EnvironmentMode:
    # The server environment is authoritative. Client headers cannot switch
    # the Python service across database boundaries.
    return get_settings().environment_mode


def database_dsn_for_mode(settings: Settings, mode: EnvironmentMode) -> str:
    if mode == "test":
        return settings.db_dsn_test or settings.db_dsn
    if not settings.db_dsn_live:
        raise RuntimeError("Live mode is not configured with a live PostgreSQL database.")
    return settings.db_dsn_live


def mongodb_database_for_mode(settings: Settings, mode: EnvironmentMode) -> str:
    if mode == "test":
        return settings.mongodb_database_test or settings.mongodb_database
    if not settings.mongodb_database_live:
        raise RuntimeError("Live mode is not configured with a live MongoDB database.")
    return settings.mongodb_database_live


def mongodb_database_for_shared(settings: Settings) -> str:
    """Return the Mongo database containing platform-wide configuration."""
    return settings.mongodb_database_shared or settings.mongodb_database
