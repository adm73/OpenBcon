from __future__ import annotations

from datetime import datetime, timezone
import json
from uuid import UUID

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
