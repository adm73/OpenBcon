from functools import lru_cache
from typing import Literal

from pydantic import Field
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
    demo_user_id: int = 1
    demo_workspace_id: str = "00000000-0000-4000-8000-000000000002"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    db_dsn: str = Field(
        default="postgresql://bconomics:bconomics@localhost:5432/bconomics",
    )
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_database: str = "bconomics"
    platform_config_key: str = "bconomics-platform-config-v1"
    openai_api_key: str | None = None
    openai_model: str = "gpt-5"
    use_mock_llm: bool = False
    allowed_ai_endpoint_hosts: str = (
        "api.openai.com,api.anthropic.com,generativelanguage.googleapis.com"
    )
    allow_private_ai_endpoints: bool = False


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
