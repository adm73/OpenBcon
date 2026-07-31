from functools import lru_cache

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
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    db_dsn: str = Field(
        default="postgresql://bconomics:bconomics@localhost:5432/bconomics",
    )
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
