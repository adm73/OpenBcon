from __future__ import annotations

import base64
import hashlib
import os
from collections.abc import Mapping
from urllib.parse import urlsplit, urlunsplit

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from pymongo import MongoClient

from .config import EnvironmentMode, Settings, mongodb_database_for_mode
from .models import (
    AdvisoryHubAgentConfig,
    AdvisoryHubConfiguration,
    AdvisoryHubSectionConfig,
    GenerationModelConfig,
)


def _default_section_priority(section_id: str, title: str = "") -> str:
    normalized_id = section_id.casefold()
    normalized_title = title.strip().casefold()
    if normalized_id in {"cover-page", "technology-cover-page"} or normalized_title == "cover page":
        return "high"
    if normalized_id in {"executive-summary", "technology-executive-summary"} or normalized_title == "executive summary":
        return "low"
    return "default"


def _normalize_section_priority(value: object, section_id: str, title: str = "") -> str:
    priority = str(value or "").strip().casefold()
    if priority in {"high", "default", "low"}:
        return priority
    return _default_section_priority(section_id, title)


def _parse_section(
    value: object,
    document_type_names: Mapping[str, str] | None = None,
) -> AdvisoryHubSectionConfig | None:
    if not isinstance(value, Mapping):
        return None

    section_id = str(value.get("id") or "").strip()
    title = str(value.get("title") or "").strip()
    document_type_id = str(value.get("documentTypeId") or "").strip()
    document_type_name = (
        (document_type_names or {}).get(document_type_id, "")
        or str(value.get("documentTypeName") or "").strip()
    )
    prompt = str(value.get("prompt") or "").strip()
    agent_id = str(value.get("agentId") or "").strip()
    layout = str(value.get("layout") or "").strip()
    priority = value.get("priority")
    enabled = value.get("enabled")
    if (
        not section_id
        or not title
        or not document_type_id
        or not prompt
        or not agent_id
        or not isinstance(enabled, bool)
    ):
        return None

    # Admin-created cover pages use custom IDs. Keep their configured content,
    # but expose the canonical IDs to LangGraph and the saved Strategic Report.
    if section_id.startswith("custom-section-") and title.casefold() == "cover page":
        if document_type_id == "business-analysis":
            section_id = "cover-page"
        elif document_type_id == "technical-analysis":
            section_id = "technology-cover-page"

    if layout not in {"cover-page", "main-content"}:
        layout = "cover-page" if section_id in {"cover-page", "technology-cover-page"} else "main-content"

    return AdvisoryHubSectionConfig(
        id=section_id,
        title=title,
        document_type_id=document_type_id,
        document_type_name=document_type_name,
        prompt=prompt,
        agent_id=agent_id,
        layout=layout,
        priority=_normalize_section_priority(priority, section_id, title),
        enabled=enabled,
    )


def parse_advisory_hub_sections(
    value: object,
    document_type_names: Mapping[str, str] | None = None,
) -> list[AdvisoryHubSectionConfig]:
    """Return the enabled Admin Console sections in their configured order."""
    if not isinstance(value, Mapping):
        return []

    sections: list[AdvisoryHubSectionConfig] = []
    seen_ids: set[str] = set()
    for raw_section in value.get("sections", []):
        section = _parse_section(raw_section, document_type_names)
        if section is None or not section.enabled or section.id in seen_ids:
            continue
        sections.append(section)
        seen_ids.add(section.id)
    return sections


def _parse_agent(value: object) -> AdvisoryHubAgentConfig | None:
    if not isinstance(value, Mapping):
        return None

    agent_id = str(value.get("id") or "").strip()
    name = str(value.get("name") or "").strip()
    role = str(value.get("role") or "").strip()
    prompt = str(value.get("prompt") or "").strip()
    if not agent_id or not name or not role or not prompt:
        return None

    return AdvisoryHubAgentConfig(
        id=agent_id,
        name=name,
        role=role,
        prompt=prompt,
    )


def parse_advisory_hub_agents(value: object) -> list[AdvisoryHubAgentConfig]:
    if not isinstance(value, Mapping):
        return []

    return [
        agent
        for raw_agent in value.get("agents", [])
        if (agent := _parse_agent(raw_agent)) is not None
    ]


def load_advisory_hub_configuration(
    settings: Settings,
    mode: EnvironmentMode = "test",
) -> AdvisoryHubConfiguration:
    """Read the current Advisory Hub sections and agents from MongoDB."""
    try:
        with MongoClient(
            settings.mongodb_url,
            serverSelectionTimeoutMS=2000,
            connectTimeoutMS=2000,
        ) as client:
            document = client[mongodb_database_for_mode(settings, mode)]["dynamic_state"].find_one(
                {
                    "scope": "platform",
                    "ownerId": "platform",
                    "key": settings.platform_config_key,
                },
                {
                    "_id": 0,
                    "value.advisoryHub.sections": 1,
                    "value.advisoryHub.agents": 1,
                    "value.advisoryHub.documentTypes": 1,
                },
            )
    except Exception as error:
        raise RuntimeError(
            "Could not read Advisory Hub configuration from MongoDB."
        ) from error

    if not document:
        raise RuntimeError("Advisory Hub configuration was not found.")

    value = document.get("value", {}).get("advisoryHub", {})
    document_type_names = {
        str(item.get("id") or "").strip(): str(item.get("name") or "").strip()
        for item in value.get("documentTypes", [])
        if isinstance(item, Mapping) and str(item.get("id") or "").strip()
    }
    sections = parse_advisory_hub_sections(value, document_type_names)
    if not sections:
        raise RuntimeError("No enabled Advisory Hub sections are configured.")
    agents = parse_advisory_hub_agents(value)
    if not agents:
        raise RuntimeError("No Advisory Hub agents are configured.")

    agent_ids = {agent.id for agent in agents}
    missing_agent_ids = sorted(
        {section.agent_id for section in sections if section.agent_id not in agent_ids}
    )
    if missing_agent_ids:
        missing = ", ".join(missing_agent_ids)
        raise RuntimeError(
            f"Advisory Hub sections reference missing agent configuration: {missing}."
        )

    return AdvisoryHubConfiguration(sections=sections, agents=agents)


def _normalize_language(value: object) -> str:
    aliases = {
        "en": "en-CA",
        "english": "en-CA",
        "en-ca": "en-CA",
        "fr": "fr-CA",
        "french": "fr-CA",
        "fr-ca": "fr-CA",
        "zh": "zh-CN",
        "chinese": "zh-CN",
        "zh-cn": "zh-CN",
    }
    normalized = str(value or "en-CA").strip().lower()
    return aliases.get(normalized, "en-CA")


def _join_model_url(
    model: Mapping[str, object],
    provider_id: str,
    ollama_base_url: str = "http://ollama:11434",
) -> str:
    direct_url = str(model.get("url") or "").strip()
    if direct_url:
        if provider_id == "ollama":
            parsed = urlsplit(direct_url)
            configured = urlsplit(ollama_base_url)
            if (
                parsed.hostname in {"ollama", "localhost", "127.0.0.1"}
                and configured.scheme
                and configured.netloc
            ):
                return urlunsplit(
                    (
                        configured.scheme,
                        configured.netloc,
                        parsed.path,
                        parsed.query,
                        parsed.fragment,
                    )
                )
        return direct_url
    base_url = str(model.get("baseUrl") or "").strip().rstrip("/")
    endpoint = str(model.get("endpoint") or "").strip()
    if endpoint.startswith(("http://", "https://")):
        return endpoint
    if base_url and endpoint:
        return f"{base_url}/{endpoint.lstrip('/')}"
    if base_url:
        return base_url
    if provider_id == "openrouter":
        return "https://openrouter.ai/api/v1/chat/completions"
    if provider_id == "openai":
        return "https://api.openai.com/v1/chat/completions"
    if provider_id == "ollama":
        return f"{ollama_base_url.rstrip('/')}/api/chat"
    return ""


def _decode_base64url(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _resolve_model_api_key(value: object, settings: Settings) -> str:
    raw_value = str(value or "").strip()
    if not raw_value or raw_value in {"__stored_securely__", "{{apiKey}}"}:
        return ""

    if raw_value.startswith(("enc:v1:", "enc::v1:")):
        encryption_key = (settings.app_state_encryption_key or "").strip()
        if not encryption_key:
            raise RuntimeError(
                "APP_STATE_ENCRYPTION_KEY is required to read the Admin Console model key."
            )
        parts = raw_value.split(":")
        if len(parts) < 3:
            raise RuntimeError("The stored model API key is malformed.")
        iv_part, auth_tag_part, encrypted_part = parts[-3:]
        key = hashlib.sha256(encryption_key.encode("utf-8")).digest()
        try:
            plaintext = AESGCM(key).decrypt(
                _decode_base64url(iv_part),
                _decode_base64url(encrypted_part) + _decode_base64url(auth_tag_part),
                None,
            )
            return plaintext.decode("utf-8")
        except Exception as error:
            raise RuntimeError("The stored model API key could not be decrypted.") from error

    if raw_value.isupper() and all(character.isalnum() or character == "_" for character in raw_value):
        return os.getenv(raw_value, "")
    return raw_value


def load_model_api_key(
    settings: Settings,
    mode: EnvironmentMode,
    model_name: str,
    provider_id: str = "",
) -> str:
    """Read one saved model key from the active platform configuration."""
    try:
        with MongoClient(
            settings.mongodb_url,
            serverSelectionTimeoutMS=2000,
            connectTimeoutMS=2000,
        ) as client:
            document = client[mongodb_database_for_mode(settings, mode)]["dynamic_state"].find_one(
                {
                    "scope": "platform",
                    "ownerId": "platform",
                    "key": settings.platform_config_key,
                },
                {"_id": 0, "value.ai.models": 1},
            )
    except Exception as error:
        raise RuntimeError("Could not read the saved AI model key from MongoDB.") from error

    value = document.get("value") if document else None
    ai = value.get("ai") if isinstance(value, Mapping) else None
    models = ai.get("models") if isinstance(ai, Mapping) else None
    requested_provider = provider_id.strip().lower()
    for model in models or []:
        if not isinstance(model, Mapping):
            continue
        if str(model.get("id") or "").strip() != model_name.strip():
            continue
        model_provider = str(model.get("providerId") or requested_provider).strip().lower()
        if requested_provider and model_provider != requested_provider:
            continue
        return _resolve_model_api_key(model.get("apiKey"), settings)

    if requested_provider == "openrouter":
        return settings.openrouter_api_key or ""
    if requested_provider == "openai":
        return settings.openai_api_key or ""
    return ""


def load_generation_configuration(
    settings: Settings,
    mode: EnvironmentMode = "test",
) -> tuple[str, GenerationModelConfig]:
    """Read system language and the enabled default model from active MongoDB state."""
    try:
        with MongoClient(
            settings.mongodb_url,
            serverSelectionTimeoutMS=2000,
            connectTimeoutMS=2000,
        ) as client:
            document = client[mongodb_database_for_mode(settings, mode)]["dynamic_state"].find_one(
                {
                    "scope": "platform",
                    "ownerId": "platform",
                    "key": settings.platform_config_key,
                },
                {"_id": 0, "value.language": 1, "value.ai": 1},
            )
    except Exception as error:
        raise RuntimeError(
            "Could not read the default AI model configuration from MongoDB."
        ) from error

    if not document:
        raise RuntimeError("Platform AI model configuration was not found.")

    value = document.get("value") or {}
    ai = value.get("ai") if isinstance(value, Mapping) else None
    models = ai.get("models") if isinstance(ai, Mapping) else None
    candidates = [model for model in (models or []) if isinstance(model, Mapping)]
    default_model_id = str(ai.get("defaultModel") or "").strip() if isinstance(ai, Mapping) else ""
    selected = next(
        (
            model for model in candidates
            if str(model.get("id") or "").strip() == default_model_id
            and model.get("enabled") is True
        ),
        next((model for model in candidates if model.get("enabled") is True), None),
    )
    if selected is None:
        raise RuntimeError("No enabled default AI model is configured in Admin Console.")

    model_name = str(selected.get("id") or selected.get("name") or "").strip()
    provider_id = str(selected.get("providerId") or "custom").strip().lower()
    url = _join_model_url(selected, provider_id, settings.ollama_base_url)
    if not model_name or not url:
        raise RuntimeError("The default AI model configuration is incomplete.")

    # Model keys are stored per model, including custom OpenAI-compatible
    # providers. Provider environment variables remain fallbacks for the
    # built-in OpenRouter and OpenAI providers.
    api_key = _resolve_model_api_key(selected.get("apiKey"), settings)
    if provider_id == "openrouter":
        api_key = api_key or settings.openrouter_api_key or ""
    elif provider_id == "openai":
        api_key = api_key or settings.openai_api_key or ""

    return (
        _normalize_language(value.get("language") if isinstance(value, Mapping) else None),
        GenerationModelConfig(
            model_name=model_name,
            provider_id=provider_id,
            api_key=api_key,
            url=url,
            temperature=float(selected.get("temperature") or 0.2),
            max_tokens=int(selected.get("maxTokens") or 1024),
            reasoning_enabled=bool(selected.get("reasoningEnabled", False)),
        ),
    )
