from __future__ import annotations

from .llm import ModelGateway
from .models import FinalDocument
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
        outline = self.gateway.build_outline(
            context,
            state["program_analysis"],
            state["company_analysis"],
        )
        return {"outline": outline}

    def generate_sections(self, state: PlanGraphState) -> PlanGraphState:
        context = state["context"]
        program_analysis = state["program_analysis"]
        company_analysis = state["company_analysis"]
        outline = state["outline"]

        sections = [
            self.gateway.generate_section(
                context,
                program_analysis,
                company_analysis,
                outline_item,
            )
            for outline_item in outline.sections
        ]
        return {"sections": sections}

    def compile_output(self, state: PlanGraphState) -> PlanGraphState:
        context = state["context"]
        sections = state["sections"]
        company_analysis = state["company_analysis"]

        executive_summary = next(
            (section.content for section in sections if section.section_key == "executive_summary"),
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
        )
        return {"final_document": final_document}
