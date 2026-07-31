import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler
from urllib.request import Request as URLRequest
from urllib.request import build_opener

from fastapi import APIRouter, HTTPException, status

from .config import get_settings
from .db import get_connection
from .graph import build_plan_graph
from .llm import build_model_gateway
from .models import (
    AIConnectionTestRequest,
    AIConnectionTestResponse,
    ErrorResponse,
    GeneratePlanRequest,
    GenerationRunResult,
)
from .nodes import PlanNodes
from .repository import FundingPlanRepository

router = APIRouter()


class _NoRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        return None


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
def test_ai_connection(request: AIConnectionTestRequest) -> AIConnectionTestResponse:
    settings = get_settings()
    allowed_hosts = {
        host.strip().lower().rstrip(".")
        for host in settings.allowed_ai_endpoint_hosts.split(",")
        if host.strip()
    }
    upstream_request = _build_ai_request(
        request,
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
            detail=f"Upstream model request failed: {detail[:500] or error.reason}",
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
def generate_business_plan(request: GeneratePlanRequest) -> GenerationRunResult:
    settings = get_settings()
    gateway = build_model_gateway(settings, force_mock=request.force_mock)
    graph = build_plan_graph(PlanNodes(gateway))

    with get_connection() as connection:
        repository = FundingPlanRepository(connection)

        try:
            context = repository.load_generation_context(request)
            repository.ensure_context_records(context)
            package_id = repository.create_package(context, request)
            run = repository.create_run(
                package_id,
                request.requested_by_user_id,
                gateway.model_name,
            )

            graph_result = graph.invoke({"context": context})
            document = graph_result["final_document"]
            repository.save_generation_result(package_id, run.id, context, document)
            return GenerationRunResult(
                package_id=package_id,
                run_id=run.id,
                status="completed",
                document=document,
                completed_at=repository.completed_timestamp(),
            )
        except ValueError as error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(error),
            ) from error
        except Exception as error:
            if "package_id" in locals() and "run" in locals():
                repository.mark_run_failed(package_id, run.id, str(error))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Business plan generation failed: {error}",
            ) from error
