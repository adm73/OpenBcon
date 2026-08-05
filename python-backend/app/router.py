import json
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler
from urllib.request import Request as URLRequest
from urllib.request import build_opener
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status

from .config import get_environment_mode, get_settings
from .db import get_connection
from .advisory_config import load_advisory_hub_configuration
from .auth import require_application_access, require_authenticated
from .forecast import build_financial_forecast
from .graph import build_plan_graph
from .llm import build_model_gateway
from .models import (
    AIConnectionTestRequest,
    AIConnectionTestResponse,
    CompanyAnalysis,
    ErrorResponse,
    FinancialForecast,
    GeneratePlanRequest,
    OutlineItem,
    ProgramAnalysis,
    GenerationRunResult,
    StrategicReportSectionRequest,
    StrategicReportSectionResult,
)
from .nodes import PlanNodes
from .repository import FundingPlanRepository

router = APIRouter()


class _NoRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        return None


@router.post(
    "/api/business-plan/forecast",
    response_model=FinancialForecast,
    responses={400: {"model": ErrorResponse}},
)
def generate_financial_forecast(
    request: Request,
    payload: GeneratePlanRequest,
) -> FinancialForecast:
    with get_connection(get_environment_mode(request)) as connection:
        try:
            workspace = require_application_access(request, connection, payload.app_id)
            context = FundingPlanRepository(connection).load_generation_context(
                payload,
                workspace.workspace_id,
            )
            return build_financial_forecast(context)
        except ValueError as error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(error),
            ) from error


def _configured_section(context, section_key: str):
    return next(
        (
            section
            for section in context.advisory_sections
            if section.id == section_key and section.enabled
        ),
        None,
    )


def _section_outline(context, section, draft_content: str = "") -> OutlineItem:
    agents_by_id = {agent.id: agent for agent in context.advisory_agents}
    agent = agents_by_id.get(section.agent_id)
    if agent is None:
        raise ValueError(f"Missing Advisory Hub agent configuration for section {section.id}.")

    draft_guidance = (
        " An existing draft is supplied; improve it while preserving accurate facts."
        if draft_content.strip()
        else ""
    )
    return OutlineItem(
        section_key=section.id,
        title=section.title,
        objective=section.prompt,
        agent_id=section.agent_id,
        guidance=(
            "Follow the current section configuration from the Admin Console. "
            f"Document type: {section.document_type_id}. "
            f"Assigned agent: {agent.name}. Agent role: {agent.role}. "
            f"Agent instructions: {agent.prompt}.{draft_guidance}"
        ),
    )


def _stored_section_content(report: dict, section_key: str) -> str:
    result = report.get("result") or {}
    sections = result.get("sections") if isinstance(result, dict) else None
    if isinstance(sections, list):
        for section in sections:
            if isinstance(section, dict) and section.get("section_key") == section_key:
                return str(section.get("content") or "")
    raise ValueError(f"Section {section_key} was not found in the Strategic Report.")


def _report_analysis(report: dict, context, gateway):
    trace = report.get("graph_trace") or {}
    program_trace = trace.get("analyze_program", {}).get("program_analysis", {})
    company_trace = trace.get("analyze_company", {}).get("company_analysis", {})
    try:
        program_analysis = ProgramAnalysis.model_validate(program_trace)
        company_analysis = CompanyAnalysis.model_validate(company_trace)
    except Exception:
        # Reports created before trace persistence can still regenerate safely.
        program_analysis = gateway.analyze_program(context.program, context.target_language)
        company_analysis = gateway.analyze_company(context, program_analysis)
    return program_analysis, company_analysis


@router.post(
    "/api/business-plan/section/update",
    response_model=StrategicReportSectionResult,
    responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
def update_business_plan_section(
    request: Request,
    payload: StrategicReportSectionRequest,
) -> StrategicReportSectionResult:
    environment_mode = get_environment_mode(request)
    with get_connection(environment_mode) as connection:
        workspace = require_application_access(request, connection, payload.app_id)
        repository = FundingPlanRepository(connection)
        context = repository.load_generation_context(payload, workspace.workspace_id)
        section = _configured_section(context, payload.section_key)
        if section is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This section is no longer enabled in Strategic Report configuration.",
            )
        updated_section, layout, updated_at = repository.update_strategic_report_section(
            payload.strategic_report_id,
            context.application_id,
            workspace.workspace_id,
            payload.section_key,
            payload.content,
            payload.layout,
            "saved",
        )
        return StrategicReportSectionResult(
            strategic_report_id=payload.strategic_report_id,
            status="saved",
            section=updated_section,
            layout=layout,
            updated_at=updated_at,
        )


@router.post(
    "/api/business-plan/section/regenerate",
    response_model=StrategicReportSectionResult,
    responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
def regenerate_business_plan_section(
    request: Request,
    payload: StrategicReportSectionRequest,
) -> StrategicReportSectionResult:
    settings = get_settings()
    environment_mode = get_environment_mode(request)
    with get_connection(environment_mode) as connection:
        workspace = require_application_access(request, connection, payload.app_id)
        repository = FundingPlanRepository(connection)
        context = repository.load_generation_context(payload, workspace.workspace_id)
        advisory_hub = load_advisory_hub_configuration(settings, environment_mode)
        context = context.model_copy(
            update={
                "advisory_sections": advisory_hub.sections,
                "advisory_agents": advisory_hub.agents,
                "section_limit": len(advisory_hub.sections),
            }
        )
        section = _configured_section(context, payload.section_key)
        if section is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This section is no longer enabled in Strategic Report configuration.",
            )

        report = repository.load_strategic_report(
            payload.strategic_report_id,
            context.application_id,
            workspace.workspace_id,
        )
        draft_content = payload.content.strip() or _stored_section_content(
            report,
            payload.section_key,
        )
        gateway = build_model_gateway(settings, environment_mode)
        program_analysis, company_analysis = _report_analysis(report, context, gateway)
        generated = gateway.generate_section(
            context,
            program_analysis,
            company_analysis,
            _section_outline(context, section, draft_content),
            draft_content,
        ).model_copy(
            update={
                "section_key": section.id,
                "title": section.title,
            }
        )
        updated_section, layout, updated_at = repository.update_strategic_report_section(
            payload.strategic_report_id,
            context.application_id,
            workspace.workspace_id,
            payload.section_key,
            generated.content,
            payload.layout,
            "regenerated",
        )
        return StrategicReportSectionResult(
            strategic_report_id=payload.strategic_report_id,
            status="regenerated",
            section=updated_section,
            layout=layout,
            updated_at=updated_at,
        )


def _safe_upstream_error(status_code: int, detail: str, reason: str) -> str:
    if status_code in {401, 403}:
        return (
            f"The provider rejected the configured API key (HTTP {status_code}). "
            "Check that the key is valid, active, and belongs to the configured provider."
        )

    redacted = _redact_sensitive_text(detail)
    return f"Upstream model request failed: {redacted[:300] or reason}"


def _redact_sensitive_text(detail: str) -> str:
    redacted = re.sub(
        r"(?i)([?&](?:api[_-]?key|key)=)[^&\s]+",
        r"\1[redacted]",
        detail,
    )
    redacted = re.sub(r"\bsk-[A-Za-z0-9_-]+\b", "[redacted]", redacted)
    redacted = re.sub(
        r"(?i)(incorrect api key provided:\s*)[^\n.]+",
        r"\1[redacted]",
        redacted,
    )
    compact = re.sub(r"\s+", " ", redacted).strip()
    return compact


def _build_ai_request(
    request: AIConnectionTestRequest,
    allowed_hosts: set[str],
    allow_private_endpoints: bool,
) -> URLRequest:
    parsed_url = urlsplit(request.url)
    hostname = (parsed_url.hostname or "").lower().rstrip(".")
    if parsed_url.scheme not in {"http", "https"} or not hostname:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The model endpoint must be an absolute HTTP or HTTPS URL.",
        )
    if not allow_private_endpoints and (
        parsed_url.scheme != "https" or hostname not in allowed_hosts
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The model endpoint is not in the server AI host allowlist.",
        )

    provider_id = request.provider_id.lower()
    url = request.url.lower()
    api_key = request.api_key.get_secret_value()
    headers = {"Content-Type": "application/json"}

    if provider_id == "anthropic" or "anthropic" in url:
        if api_key:
            headers["x-api-key"] = api_key
        headers["anthropic-version"] = "2023-06-01"
        payload = {
            "model": request.model_name,
            "max_tokens": 64,
            "messages": [{"role": "user", "content": request.message}],
        }
    elif provider_id == "google" or "generativelanguage.googleapis.com" in url:
        if api_key:
            headers["x-goog-api-key"] = api_key
        payload = {"contents": [{"parts": [{"text": request.message}]}]}
    elif "/responses" in url:
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        payload = {"model": request.model_name, "input": request.message}
    else:
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        payload = {
            "model": request.model_name,
            "messages": [{"role": "user", "content": request.message}],
        }

    return URLRequest(
        request.url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )


@router.post(
    "/api/ai/test-connection",
    response_model=AIConnectionTestResponse,
    responses={
        400: {"model": ErrorResponse},
        502: {"model": ErrorResponse},
        504: {"model": ErrorResponse},
    },
)
def test_ai_connection(
    request: Request,
    payload: AIConnectionTestRequest,
) -> AIConnectionTestResponse:
    environment_mode = get_environment_mode(request)
    with get_connection(environment_mode) as connection:
        require_authenticated(request, connection)

    settings = get_settings()
    allowed_hosts = {
        host.strip().lower().rstrip(".")
        for host in settings.allowed_ai_endpoint_hosts.split(",")
        if host.strip()
    }
    upstream_request = _build_ai_request(
        payload,
        allowed_hosts,
        settings.allow_private_ai_endpoints,
    )

    try:
        opener = build_opener(_NoRedirectHandler)
        with opener.open(upstream_request, timeout=15) as upstream_response:
            response_body = upstream_response.read().decode("utf-8", errors="replace")
            return AIConnectionTestResponse(
                response=response_body,
                upstream_status=upstream_response.status,
            )
    except HTTPError as error:
        detail = error.read(4096).decode("utf-8", errors="replace").strip()
        raise HTTPException(
            status_code=error.code,
            detail=_safe_upstream_error(error.code, detail, str(error.reason)),
        ) from error
    except TimeoutError as error:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="The model request timed out after 15 seconds.",
        ) from error
    except URLError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not reach the model endpoint: {error.reason}",
        ) from error


@router.post(
    "/api/business-plan/generate",
    response_model=GenerationRunResult,
    responses={
        400: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
)
def generate_business_plan(
    request: Request,
    payload: GeneratePlanRequest,
) -> GenerationRunResult:
    settings = get_settings()
    environment_mode = get_environment_mode(request)
    strategic_report_id: UUID | None = None
    graph_trace: dict = {}

    with get_connection(environment_mode) as connection:
        repository = FundingPlanRepository(connection)

        try:
            workspace = require_application_access(request, connection, payload.app_id)
            context = repository.load_generation_context(payload, workspace.workspace_id)
            gateway = build_model_gateway(settings, environment_mode)
            graph = build_plan_graph(PlanNodes(gateway))
            context = repository.ensure_context_records(context)
            advisory_hub = load_advisory_hub_configuration(settings, environment_mode)
            context = context.model_copy(
                update={
                    "advisory_sections": advisory_hub.sections,
                    "advisory_agents": advisory_hub.agents,
                    "section_limit": len(advisory_hub.sections),
                }
            )
            strategic_report_id = repository.create_strategic_report(
                context,
                payload,
                gateway.model_name,
            )
            graph_result = {"context": context}
            for update in graph.stream({"context": context}, stream_mode="updates"):
                for node_name, node_result in update.items():
                    graph_trace[node_name] = node_result
                    graph_result.update(node_result)
            document = graph_result["final_document"]
            repository.save_strategic_report_result(
                strategic_report_id,
                graph_trace,
                document,
            )
            return GenerationRunResult(
                strategic_report_id=strategic_report_id,
                status="completed",
                document=document,
                completed_at=repository.completed_timestamp(),
            )
        except ValueError as error:
            safe_error = _redact_sensitive_text(str(error))
            if strategic_report_id:
                repository.mark_strategic_report_failed(
                    strategic_report_id,
                    safe_error,
                    graph_trace,
                )
            if strategic_report_id:
                connection.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=safe_error,
            ) from error
        except Exception as error:
            safe_error = _redact_sensitive_text(str(error))
            if strategic_report_id:
                repository.mark_strategic_report_failed(
                    strategic_report_id,
                    safe_error,
                    graph_trace,
                )
            if strategic_report_id:
                connection.commit()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Business plan generation failed: {safe_error}",
            ) from error
