from __future__ import annotations

from .llm import ModelGateway
from .forecast import build_financial_forecast
from .models import DocumentOutline, FinalDocument, OutlineItem
from .state import PlanGraphState


class PlanNodes:
    def __init__(self, gateway: ModelGateway):
        self.gateway = gateway

    def normalize_inputs(self, state: PlanGraphState) -> PlanGraphState:
        context = state["context"]
        company = context.company
        program = context.program

        return {
            "normalized_company": {
                "business_name": company.name.strip(),
                "founder_name": company.founder_name.strip(),
                "business_summary": company.business_summary.strip(),
                "revenue_model": (company.revenue_model or "").strip(),
                "team_background": (company.team_background or "").strip(),
                "traction": (company.traction or "").strip(),
                "use_of_funds": (company.use_of_funds or "").strip(),
            },
            "normalized_program": {
                "program_name": program.name.strip(),
                "target_outcome": (program.target_outcome or "").strip(),
                "guidelines_text": (program.raw_guidelines_text or "").strip(),
            },
        }

    def analyze_program(self, state: PlanGraphState) -> PlanGraphState:
        context = state["context"]
        analysis = self.gateway.analyze_program(
            context.program,
            context.target_language,
        )
        return {"program_analysis": analysis}

    def analyze_company(self, state: PlanGraphState) -> PlanGraphState:
        context = state["context"]
        program_analysis = state["program_analysis"]
        analysis = self.gateway.analyze_company(context, program_analysis)
        return {"company_analysis": analysis}

    def build_outline(self, state: PlanGraphState) -> PlanGraphState:
        context = state["context"]
        if not context.advisory_sections:
            raise ValueError("No enabled Advisory Hub sections are configured.")

        agents_by_id = {agent.id: agent for agent in context.advisory_agents}
        missing_agent_ids = sorted(
            {
                section.agent_id
                for section in context.advisory_sections
                if section.agent_id not in agents_by_id
            }
        )
        if missing_agent_ids:
            raise ValueError(
                "Missing Advisory Hub agent configuration: "
                + ", ".join(missing_agent_ids)
                + "."
            )

        priority_order = {"high": 0, "default": 1, "low": 2}
        ordered_sections = sorted(
            enumerate(context.advisory_sections),
            key=lambda item: (priority_order[item[1].priority], item[0]),
        )

        return {
            "outline": DocumentOutline(
                sections=[
                    OutlineItem(
                        section_key=section.id,
                        title=section.title,
                        objective=section.prompt,
                        agent_id=section.agent_id,
                        priority=section.priority,
                        guidance=(
                            "Follow the section configuration from the Admin Console. "
                            f"Document type: {section.document_type_id}. "
                            f"Assigned agent: {agents_by_id[section.agent_id].name}. "
                            f"Agent role: {agents_by_id[section.agent_id].role}. "
                            f"Agent instructions: {agents_by_id[section.agent_id].prompt}"
                        ),
                    )
                    for _, section in ordered_sections
                ],
            )
        }

    def generate_sections(self, state: PlanGraphState) -> PlanGraphState:
        context = state["context"]
        program_analysis = state["program_analysis"]
        company_analysis = state["company_analysis"]
        outline = state["outline"]

        sections = []
        for outline_item in outline.sections:
            generated = self.gateway.generate_section(
                context,
                program_analysis,
                company_analysis,
                outline_item,
            )
            # The model writes content, but the Admin Console owns identity and order.
            sections.append(
                generated.model_copy(
                    update={
                        "section_key": outline_item.section_key,
                        "title": outline_item.title,
                    }
                )
            )
        return {"sections": sections}

    def build_financial_forecast(self, state: PlanGraphState) -> PlanGraphState:
        return {
            "financial_forecast": build_financial_forecast(state["context"]),
        }

    def compile_output(self, state: PlanGraphState) -> PlanGraphState:
        context = state["context"]
        sections = state["sections"]
        company_analysis = state["company_analysis"]
        financial_forecast = state["financial_forecast"]

        executive_summary = next(
            (
                section.content
                for section in sections
                if section.section_key in {"executive_summary", "executive-summary"}
            ),
            sections[0].content if sections else company_analysis.fundability_summary,
        )

        final_document = FinalDocument(
            title=f"{context.company.name} Business Plan",
            program_name=context.program.name,
            business_name=context.company.name,
            executive_summary=executive_summary,
            sections=sections,
            key_strengths=company_analysis.team_strengths + company_analysis.traction_signals,
            risks=company_analysis.key_risks,
            use_of_funds_summary=context.company.use_of_funds or "Use of funds should be tied to hiring, growth, and working capital milestones.",
            next_steps=[
                "Review the generated plan with the founder.",
                "Validate claims against source documents and financial inputs.",
                "Export the final plan into submission-ready formats.",
            ],
            financial_forecast=financial_forecast,
        )
        return {"final_document": final_document}
