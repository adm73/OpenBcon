from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
import json
from uuid import UUID

from pydantic import BaseModel
from psycopg import Connection

from .models import (
    CompanyRecord,
    FinalDocument,
    FundingProgramRecord,
    GeneratePlanRequest,
    GeneratedSection,
    GenerationContext,
)

class FundingPlanRepository:
    def __init__(self, connection: Connection):
        self.connection = connection

    def load_generation_context(
        self,
        request: GeneratePlanRequest,
        workspace_id: str | None = None,
    ) -> GenerationContext:
        workspace_clause = ""
        query_values: tuple[object, ...] = (request.app_id, request.app_id, request.app_id)
        if workspace_id:
            workspace_clause = " AND applications.workspace_id = %s"
            query_values += (workspace_id,)
        application_row = self.connection.execute(
            """
            SELECT
              applications.id AS application_id,
              applications.workspace_id,
              applications.owner_user_id,
              applications.title,
              applications.amount,
              applications.currency AS application_currency,
              applications.source_id,
              companies.id AS company_id,
              companies.owner_user_id AS company_owner_user_id,
              companies.created_by AS company_created_by,
              companies.name AS company_name,
              companies.legal_name,
              companies.founder_name,
              companies.business_summary,
              companies.industry,
              companies.location,
              companies.stage,
              companies.revenue_model,
              companies.team_background,
              companies.traction,
              companies.use_of_funds,
              companies.annual_revenue,
              companies.monthly_revenue,
              companies.employee_count,
              companies.website,
              companies.metadata AS company_metadata,
              funding_programs.id AS program_id,
              funding_programs.workspace_id AS program_workspace_id,
              funding_programs.name AS program_name,
              funding_programs.provider,
              funding_programs.category,
              funding_programs.program_url,
              funding_programs.funding_amount,
              funding_programs.currency AS program_currency,
              funding_programs.location AS program_location,
              funding_programs.raw_guidelines_text,
              funding_programs.target_outcome,
              funding_programs.metadata AS program_metadata
            FROM applications
            JOIN companies ON companies.id = applications.company_id
            JOIN funding_programs ON funding_programs.id = applications.funding_program_id
            WHERE (
                applications.app_id = %s
                OR applications.id::text = %s
                OR applications.source_id = %s
            )
            """ + workspace_clause + """
            LIMIT 1
            """,
            query_values,
        ).fetchone()
        if not application_row:
            raise ValueError(f"Application {request.app_id} was not found.")

        workspace_id = UUID(str(application_row["workspace_id"]))
        company = CompanyRecord(
            id=int(application_row["company_id"]),
            workspace_id=workspace_id,
            created_by=int(application_row["company_created_by"]),
            owner_user_id=int(application_row["company_owner_user_id"]),
            name=application_row["company_name"],
            legal_name=application_row["legal_name"],
            founder_name=application_row["founder_name"],
            business_summary=application_row["business_summary"],
            industry=application_row["industry"],
            location=application_row["location"],
            stage=application_row["stage"],
            revenue_model=application_row["revenue_model"],
            team_background=application_row["team_background"],
            traction=application_row["traction"],
            use_of_funds=application_row["use_of_funds"],
            annual_revenue=application_row["annual_revenue"],
            monthly_revenue=application_row["monthly_revenue"],
            employee_count=application_row["employee_count"],
            website=application_row["website"],
            metadata=application_row["company_metadata"] or {},
        )
        program = FundingProgramRecord(
            id=application_row["program_id"],
            workspace_id=(
                UUID(str(application_row["program_workspace_id"]))
                if application_row["program_workspace_id"]
                else None
            ),
            name=application_row["program_name"],
            provider=application_row["provider"],
            category=application_row["category"],
            program_url=application_row["program_url"],
            funding_amount=application_row["funding_amount"],
            currency=application_row["program_currency"],
            location=application_row["program_location"],
            raw_guidelines_text=application_row["raw_guidelines_text"],
            target_outcome=application_row["target_outcome"],
            metadata=application_row["program_metadata"] or {},
        )
        return GenerationContext(
            application_id=int(application_row["application_id"]),
            workspace_id=workspace_id,
            company=company,
            program=program,
            package_name=application_row["title"] or f"{company.name} - {program.name} package",
            requested_by_user_id=int(application_row["owner_user_id"]),
            target_language=request.language,
            section_limit=0,
        )

    @staticmethod
    def _integer_value(value: object) -> int | None:
        if value is None:
            return None
        digits = "".join(character for character in str(value) if character.isdigit())
        return int(digits) if digits else None

    @staticmethod
    def _decimal_value(value: object) -> Decimal | None:
        if value is None:
            return None
        cleaned = "".join(character for character in str(value) if character.isdigit() or character == ".")
        try:
            return Decimal(cleaned) if cleaned else None
        except Exception:
            return None

    @classmethod
    def _annual_revenue(cls, value: object) -> Decimal | None:
        monthly = cls._decimal_value(value)
        return monthly * 12 if monthly is not None else None

    @staticmethod
    def _build_team_background(
        founder_name: str,
        employee_count: int | None,
        industry: str | None,
        location: str | None,
    ) -> str | None:
        if not employee_count and not industry and not location:
            return None
        team_size = f"a {employee_count}-person " if employee_count else "a growing "
        sector = f" {industry.lower()}" if industry else " business"
        place = f" in {location}" if location else ""
        return f"{founder_name} leads {team_size}{sector} team{place}."

    def ensure_context_records(self, context: GenerationContext) -> GenerationContext:
        company_row = self.connection.execute(
            """
            INSERT INTO companies (
              workspace_id,
              owner_user_id,
              created_by,
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
              %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb
            )
            ON CONFLICT (workspace_id, name) DO UPDATE SET
              owner_user_id = EXCLUDED.owner_user_id,
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
            RETURNING id
            """,
            (
                context.workspace_id,
                context.company.owner_user_id,
                context.company.created_by,
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
        ).fetchone()
        if not company_row:
            raise ValueError(f"Could not persist company {context.company.name}.")

        context = context.model_copy(
            update={
                "company": context.company.model_copy(
                    update={"id": int(company_row["id"])}
                )
            }
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
              currency,
              location,
              raw_guidelines_text,
              target_outcome,
              metadata
            )
            VALUES (
              %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb
            )
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              provider = EXCLUDED.provider,
              category = EXCLUDED.category,
              program_url = EXCLUDED.program_url,
              funding_amount = EXCLUDED.funding_amount,
              currency = EXCLUDED.currency,
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
                context.program.currency,
                context.program.location,
                context.program.raw_guidelines_text,
                context.program.target_outcome,
                json.dumps(context.program.metadata),
            ),
        )
        return context

    def create_strategic_report(
        self,
        context: GenerationContext,
        request: GeneratePlanRequest,
        model_name: str,
    ) -> UUID:
        row = self.connection.execute(
            """
            INSERT INTO strategic_reports (
              application_id,
              workspace_id,
              owner_user_id,
              model_name,
              language,
              status,
              request_payload,
              context_snapshot
            )
            VALUES (%s, %s, %s, %s, %s, 'running', %s::jsonb, %s::jsonb)
            ON CONFLICT (application_id) DO UPDATE SET
              workspace_id = EXCLUDED.workspace_id,
              owner_user_id = EXCLUDED.owner_user_id,
              model_name = EXCLUDED.model_name,
              language = EXCLUDED.language,
              status = 'running',
              request_payload = EXCLUDED.request_payload,
              context_snapshot = EXCLUDED.context_snapshot,
              graph_trace = '{}'::jsonb,
              result = NULL,
              error_message = NULL,
              started_at = now(),
              completed_at = NULL,
              updated_at = now()
            RETURNING id
            """,
            (
                context.application_id,
                context.workspace_id,
                context.requested_by_user_id,
                model_name,
                request.language,
                # The browser-supplied model config may contain an API key.
                # Keep it in memory for the provider call, never in the report.
                request.model_dump_json(exclude={"model"}),
                context.model_dump_json(),
            ),
        ).fetchone()
        return row["id"]

    @staticmethod
    def _json_value(value: object) -> object:
        if isinstance(value, BaseModel):
            return value.model_dump(mode="json")
        if isinstance(value, dict):
            return {key: FundingPlanRepository._json_value(item) for key, item in value.items()}
        if isinstance(value, list):
            return [FundingPlanRepository._json_value(item) for item in value]
        return value

    def save_strategic_report_result(
        self,
        review_id: UUID,
        graph_trace: dict,
        document: FinalDocument,
    ) -> None:
        self.connection.execute(
            """
            UPDATE strategic_reports
            SET status = 'completed',
                graph_trace = %s::jsonb,
                result = %s::jsonb,
                completed_at = now(),
                updated_at = now()
            WHERE id = %s
            """,
            (
                json.dumps(self._json_value(graph_trace)),
                document.model_dump_json(),
                review_id,
            ),
        )

    def save_llm_usage(
        self,
        strategic_report_id: UUID,
        usage_records: list[dict],
    ) -> None:
        if not usage_records:
            return
        with self.connection.cursor() as cursor:
            cursor.executemany(
                """
                INSERT INTO strategic_report_llm_usage (
                  strategic_report_id,
                  node_name,
                  section_key,
                  model_name,
                  input_tokens,
                  output_tokens,
                  total_tokens
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                [
                    (
                        strategic_report_id,
                        record["node_name"],
                        record.get("section_key"),
                        record["model_name"],
                        record["input_tokens"],
                        record["output_tokens"],
                        record["total_tokens"],
                    )
                    for record in usage_records
                ],
            )

    def load_strategic_report(
        self,
        report_id: UUID,
        application_id: int,
        workspace_id: str,
        lock: bool = False,
    ) -> dict:
        query = """
            SELECT id, status, result, graph_trace, context_snapshot, updated_at
            FROM strategic_reports
            WHERE id = %s
              AND application_id = %s
              AND workspace_id = %s
            LIMIT 1
        """
        if lock:
            query += " FOR UPDATE"
        row = self.connection.execute(
            query,
            (report_id, application_id, workspace_id),
        ).fetchone()
        if not row:
            raise ValueError("The Strategic Report was not found for this application.")
        if row["status"] != "completed" or not isinstance(row["result"], dict):
            raise ValueError("The Strategic Report is not ready to edit.")
        return row

    def update_strategic_report_section(
        self,
        report_id: UUID,
        application_id: int,
        workspace_id: str,
        section_key: str,
        content: str,
        layout: str,
        status: str,
    ) -> tuple[GeneratedSection, str, datetime]:
        row = self.load_strategic_report(
            report_id,
            application_id,
            workspace_id,
            lock=True,
        )
        result = dict(row["result"])
        raw_sections = result.get("sections")
        if not isinstance(raw_sections, list):
            raise ValueError("The Strategic Report has no editable sections.")

        updated_section: dict | None = None
        for section_index, raw_section in enumerate(raw_sections):
            if isinstance(raw_section, dict) and raw_section.get("section_key") == section_key:
                updated_section = {
                    "section_key": section_key,
                    "title": str(raw_section.get("title") or section_key),
                    "content": content,
                    "citations": raw_section.get("citations")
                    if isinstance(raw_section.get("citations"), list)
                    else [],
                }
                raw_sections[section_index] = updated_section
                break
        if updated_section is None:
            raise ValueError(f"Section {section_key} was not found in the Strategic Report.")

        result["sections"] = raw_sections
        if section_key in {"executive_summary", "executive-summary"}:
            result["executive_summary"] = content

        context_snapshot = dict(row["context_snapshot"] or {})
        raw_configs = context_snapshot.get("advisory_sections")
        if isinstance(raw_configs, list):
            for config in raw_configs:
                if isinstance(config, dict) and config.get("id") == section_key:
                    config["layout"] = layout
                    break

        graph_trace = dict(row["graph_trace"] or {})
        edits = graph_trace.get("section_edits")
        if not isinstance(edits, list):
            edits = []
        edits.append(
            {
                "action": status,
                "section_key": section_key,
                "layout": layout,
                "updated_at": datetime.now(tz=timezone.utc).isoformat(),
            }
        )
        graph_trace["section_edits"] = edits[-50:]

        updated_at = self.connection.execute(
            """
            UPDATE strategic_reports
            SET result = %s::jsonb,
                context_snapshot = %s::jsonb,
                graph_trace = %s::jsonb,
                updated_at = now()
            WHERE id = %s
            RETURNING updated_at
            """,
            (
                json.dumps(self._json_value(result)),
                json.dumps(self._json_value(context_snapshot)),
                json.dumps(self._json_value(graph_trace)),
                report_id,
            ),
        ).fetchone()["updated_at"]
        return (
            GeneratedSection.model_validate(updated_section),
            layout,
            updated_at,
        )

    def mark_strategic_report_failed(
        self,
        review_id: UUID,
        error_message: str,
        graph_trace: dict | None = None,
    ) -> None:
        trace = self._json_value(graph_trace or {})
        self.connection.execute(
            """
            UPDATE strategic_reports
            SET status = 'failed',
                graph_trace = %s::jsonb,
                error_message = %s,
                completed_at = now(),
                updated_at = now()
            WHERE id = %s
            """,
            (json.dumps(trace), error_message[:2000], review_id),
        )

    def completed_timestamp(self) -> datetime:
        return datetime.now(tz=timezone.utc)
