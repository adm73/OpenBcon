from fastapi import APIRouter, HTTPException, status

from .config import get_settings
from .db import get_connection
from .graph import build_plan_graph
from .llm import build_model_gateway
from .models import ErrorResponse, GeneratePlanRequest, GenerationRunResult
from .nodes import PlanNodes
from .repository import FundingPlanRepository

router = APIRouter()


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
    gateway = build_model_gateway(settings)
    graph = build_plan_graph(PlanNodes(gateway))

    with get_connection() as connection:
        repository = FundingPlanRepository(connection)

        try:
            context = repository.load_generation_context(request)
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
