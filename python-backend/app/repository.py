from __future__ import annotations

from datetime import datetime, timezone
import json
from uuid import UUID, uuid4

from psycopg import Connection

from .models import (
    CompanyRecord,
    FinalDocument,
    FundingPackageRunRecord,
    FundingProgramRecord,
    GeneratePlanRequest,
    GenerationContext,
)


class FundingPlanRepository:
    def __init__(self, connection: Connection):
        self.connection = connection

    def load_generation_context(self, request: GeneratePlanRequest) -> GenerationContext:
        if request.company_info and request.program_info:
            return self._build_direct_generation_context(request)

        if not request.company_id or not request.funding_program_id:
            raise ValueError(
                "Company and funding program identifiers are required when direct payloads are not supplied.",
            )

        company_row = self.connection.execute(
            """
            SELECT *
            FROM companies
            WHERE id = %s AND workspace_id = %s
            """,
            (request.company_id, request.workspace_id),
        ).fetchone()
        if not company_row:
            raise ValueError("Company not found for the requested workspace.")

        program_row = self.connection.execute(
            """
            SELECT *
            FROM funding_programs
            WHERE id = %s
              AND (workspace_id = %s OR workspace_id IS NULL)
            """,
            (request.funding_program_id, request.workspace_id),
        ).fetchone()
        if not program_row:
            raise ValueError("Funding program not found for the requested workspace.")

        company = CompanyRecord.model_validate(company_row)
        program = FundingProgramRecord.model_validate(program_row)
        package_name = request.package_name or f"{company.name} - {program.name}"
        return GenerationContext(
            workspace_id=request.workspace_id,
            company=company,
            program=program,
            package_name=package_name,
            requested_by_user_id=request.requested_by_user_id,
            target_language=request.target_language,
            section_limit=request.section_limit,
        )

    def _build_direct_generation_context(self, request: GeneratePlanRequest) -> GenerationContext:
        assert request.company_info is not None
        assert request.program_info is not None

        company = CompanyRecord(
            id=uuid4(),
            workspace_id=request.workspace_id,
            name=request.company_info.name,
            legal_name=request.company_info.legal_name,
            founder_name=request.company_info.founder_name,
            business_summary=request.company_info.business_summary,
            industry=request.company_info.industry,
            location=request.company_info.location,
            stage=request.company_info.stage,
            revenue_model=request.company_info.revenue_model,
            team_background=request.company_info.team_background,
            traction=request.company_info.traction,
            use_of_funds=request.company_info.use_of_funds,
            annual_revenue=request.company_info.annual_revenue,
            monthly_revenue=request.company_info.monthly_revenue,
            employee_count=request.company_info.employee_count,
            website=request.company_info.website,
            metadata={
                **request.company_info.metadata,
                "source": "quick-generate-direct",
                "external_id": request.company_info.external_id,
            },
        )
        program = FundingProgramRecord(
            id=uuid4(),
            workspace_id=request.workspace_id,
            name=request.program_info.name,
            provider=request.program_info.provider,
            category=request.program_info.category,
            program_url=request.program_info.program_url,
            funding_amount=request.program_info.funding_amount,
            location=request.program_info.location,
            raw_guidelines_text=request.program_info.raw_guidelines_text,
            target_outcome=request.program_info.target_outcome,
            metadata={
                **request.program_info.metadata,
                "source": "quick-generate-direct",
                "external_id": request.program_info.external_id,
            },
        )

        return GenerationContext(
            workspace_id=request.workspace_id,
            company=company,
            program=program,
            package_name=request.package_name or f"{company.name} - {program.name}",
            requested_by_user_id=request.requested_by_user_id,
            target_language=request.target_language,
            section_limit=request.section_limit,
        )

    def ensure_context_records(self, context: GenerationContext) -> None:
        self.connection.execute(
            """
            INSERT INTO companies (
              id,
              workspace_id,
              name,
              legal_name,
              founder_name,
              business_summary,
              industry,
              location,
              stage,
              revenue_model,
              team_background,
              traction,
              use_of_funds,
              annual_revenue,
              monthly_revenue,
              employee_count,
              website,
              metadata
            )
            VALUES (
              %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb
            )
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              legal_name = EXCLUDED.legal_name,
              founder_name = EXCLUDED.founder_name,
              business_summary = EXCLUDED.business_summary,
              industry = EXCLUDED.industry,
              location = EXCLUDED.location,
              stage = EXCLUDED.stage,
              revenue_model = EXCLUDED.revenue_model,
              team_background = EXCLUDED.team_background,
              traction = EXCLUDED.traction,
              use_of_funds = EXCLUDED.use_of_funds,
              annual_revenue = EXCLUDED.annual_revenue,
              monthly_revenue = EXCLUDED.monthly_revenue,
              employee_count = EXCLUDED.employee_count,
              website = EXCLUDED.website,
              metadata = EXCLUDED.metadata,
              updated_at = now()
            """,
            (
                context.company.id,
                context.workspace_id,
                context.company.name,
                context.company.legal_name,
                context.company.founder_name,
                context.company.business_summary,
                context.company.industry,
                context.company.location,
                context.company.stage,
                context.company.revenue_model,
                context.company.team_background,
                context.company.traction,
                context.company.use_of_funds,
                context.company.annual_revenue,
                context.company.monthly_revenue,
                context.company.employee_count,
                context.company.website,
                json.dumps(context.company.metadata),
            ),
        )

        self.connection.execute(
            """
            INSERT INTO funding_programs (
              id,
              workspace_id,
              name,
              provider,
              category,
              program_url,
              funding_amount,
              location,
              raw_guidelines_text,
              target_outcome,
              metadata
            )
            VALUES (
              %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb
            )
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              provider = EXCLUDED.provider,
              category = EXCLUDED.category,
              program_url = EXCLUDED.program_url,
              funding_amount = EXCLUDED.funding_amount,
              location = EXCLUDED.location,
              raw_guidelines_text = EXCLUDED.raw_guidelines_text,
              target_outcome = EXCLUDED.target_outcome,
              metadata = EXCLUDED.metadata,
              updated_at = now()
            """,
            (
                context.program.id,
                context.workspace_id,
                context.program.name,
                context.program.provider,
                context.program.category,
                context.program.program_url,
                context.program.funding_amount,
                context.program.location,
                context.program.raw_guidelines_text,
                context.program.target_outcome,
                json.dumps(context.program.metadata),
            ),
        )

    def create_package(self, context: GenerationContext, request: GeneratePlanRequest) -> UUID:
        row = self.connection.execute(
            """
            INSERT INTO funding_packages (
              workspace_id,
              company_id,
              funding_program_id,
              created_by,
              package_name,
              status,
              request_payload,
              context_snapshot
            )
            VALUES (%s, %s, %s, %s, %s, 'generating', %s::jsonb, %s::jsonb)
            RETURNING id
            """,
            (
                context.workspace_id,
                context.company.id,
                context.program.id,
                context.requested_by_user_id,
                context.package_name,
                request.model_dump_json(),
                context.model_dump_json(),
            ),
        ).fetchone()
        return row["id"]

    def create_run(self, package_id: UUID, requested_by_user_id: UUID, model_name: str) -> FundingPackageRunRecord:
        row = self.connection.execute(
            """
            INSERT INTO funding_package_runs (
              package_id,
              requested_by_user_id,
              model_name,
              status,
              started_at
            )
            VALUES (%s, %s, %s, 'running', now())
            RETURNING id, package_id, status, model_name, started_at
            """,
            (package_id, requested_by_user_id, model_name),
        ).fetchone()
        return FundingPackageRunRecord.model_validate(row)

    def save_generation_result(
        self,
        package_id: UUID,
        run_id: UUID,
        context: GenerationContext,
        document: FinalDocument,
    ) -> None:
        for sort_order, section in enumerate(document.sections, start=1):
            self.connection.execute(
                """
                INSERT INTO funding_package_sections (
                  package_run_id,
                  section_key,
                  title,
                  sort_order,
                  content,
                  metadata
                )
                VALUES (%s, %s, %s, %s, %s, %s::jsonb)
                """,
                (
                    run_id,
                    section.section_key,
                    section.title,
                    sort_order,
                    section.content,
                    json.dumps({"citations": section.citations}),
                ),
            )

        self.connection.execute(
            """
            UPDATE funding_packages
            SET status = 'completed',
                generated_document = %s::jsonb,
                updated_at = now()
            WHERE id = %s
            """,
            (document.model_dump_json(), package_id),
        )
        self.connection.execute(
            """
            UPDATE funding_package_runs
            SET status = 'completed',
                completed_at = now()
            WHERE id = %s
            """,
            (run_id,),
        )
        self.connection.execute(
            """
            INSERT INTO funding_package_artifacts (
              package_run_id,
              artifact_type,
              mime_type,
              metadata
            )
            VALUES (%s, 'json', 'application/json', %s::jsonb)
            """,
            (
                run_id,
                document.model_dump_json(),
            ),
        )

    def mark_run_failed(self, package_id: UUID, run_id: UUID, error_message: str) -> None:
        self.connection.execute(
            """
            UPDATE funding_packages
            SET status = 'failed',
                updated_at = now()
            WHERE id = %s
            """,
            (package_id,),
        )
        self.connection.execute(
            """
            UPDATE funding_package_runs
            SET status = 'failed',
                completed_at = now(),
                error_message = %s
            WHERE id = %s
            """,
            (error_message[:2000], run_id),
        )

    def completed_timestamp(self) -> datetime:
        return datetime.now(tz=timezone.utc)
