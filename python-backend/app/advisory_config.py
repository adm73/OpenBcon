from __future__ import annotations

from collections.abc import Mapping

from pymongo import MongoClient

from .config import EnvironmentMode, Settings, mongodb_database_for_mode
from .models import (
    AdvisoryHubAgentConfig,
    AdvisoryHubConfiguration,
    AdvisoryHubSectionConfig,
)


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
