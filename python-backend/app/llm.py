from __future__ import annotations

from typing import Protocol

from langchain_openai import ChatOpenAI

from .config import Settings
from .models import (
    CompanyAnalysis,
    DocumentOutline,
    GeneratedSection,
    ProgramAnalysis,
)
from .config import EnvironmentMode
from .prompts import (
    build_company_analysis_prompt,
    build_outline_prompt,
    build_program_analysis_prompt,
    build_section_prompt,
)


class ModelGateway(Protocol):
    model_name: str

    def analyze_program(self, program, language: str) -> ProgramAnalysis: ...

    def analyze_company(self, context, program_analysis: ProgramAnalysis) -> CompanyAnalysis: ...

    def build_outline(
        self,
        context,
        program_analysis: ProgramAnalysis,
        company_analysis: CompanyAnalysis,
    ) -> DocumentOutline: ...

    def generate_section(
        self,
        context,
        program_analysis: ProgramAnalysis,
        company_analysis: CompanyAnalysis,
        outline_item,
        draft_content: str | None = None,
    ) -> GeneratedSection: ...


class OpenAIModelGateway:
    def __init__(self, settings: Settings):
        if not settings.openai_api_key:
            raise ValueError(
                "OPENBCON_OPENAI_API_KEY is required unless OPENBCON_USE_MOCK_LLM=true.",
            )
        self.model_name = settings.openai_model
        self._llm = ChatOpenAI(
            model=settings.openai_model,
            api_key=settings.openai_api_key,
            temperature=0.2,
        )

    def _invoke_structured(self, output_model, messages):
        structured = self._llm.with_structured_output(output_model)
        return structured.invoke(messages)

    def analyze_program(self, program, language: str) -> ProgramAnalysis:
        return self._invoke_structured(
            ProgramAnalysis,
            build_program_analysis_prompt(program, language),
        )

    def analyze_company(self, context, program_analysis: ProgramAnalysis) -> CompanyAnalysis:
        return self._invoke_structured(
            CompanyAnalysis,
            build_company_analysis_prompt(context, program_analysis),
        )

    def build_outline(
        self,
        context,
        program_analysis: ProgramAnalysis,
        company_analysis: CompanyAnalysis,
    ) -> DocumentOutline:
        return self._invoke_structured(
            DocumentOutline,
            build_outline_prompt(context, program_analysis, company_analysis),
        )

    def generate_section(
        self,
        context,
        program_analysis: ProgramAnalysis,
        company_analysis: CompanyAnalysis,
        outline_item,
        draft_content: str | None = None,
    ) -> GeneratedSection:
        return self._invoke_structured(
            GeneratedSection,
            build_section_prompt(
                context,
                program_analysis,
                company_analysis,
                outline_item,
                draft_content,
            ),
        )


class MockModelGateway:
    model_name = "mock-business-plan-generator"

    def analyze_program(self, program, language: str) -> ProgramAnalysis:
        amount = f"CAD {program.funding_amount}" if program.funding_amount else None
        return ProgramAnalysis(
            program_name=program.name,
            funding_amount=amount,
            mandatory_sections=[
                "Executive Summary",
                "Company Overview",
                "Market Opportunity",
                "Use of Funds",
                "Implementation Plan",
                "Risk Analysis",
            ],
            evaluation_criteria=[
                "commercial viability",
                "growth readiness",
                "team capability",
            ],
            preferred_tone="professional, evidence-based, lender-friendly",
            reviewer_priorities=[
                "clear market demand",
                "credible execution capacity",
                "disciplined use of funds",
            ],
        )

    def analyze_company(self, context, program_analysis: ProgramAnalysis) -> CompanyAnalysis:
        company = context.company
        return CompanyAnalysis(
            business_name=company.name,
            core_problem=f"{company.name} addresses a practical customer need in {company.industry or 'its market'}.",
            solution_summary=company.business_summary,
            business_model=company.revenue_model or "Recurring and project-based revenue",
            traction_signals=[
                company.traction or "Early commercial traction is visible from customer interest and operating momentum.",
            ],
            team_strengths=[
                company.team_background or "The founding team combines domain knowledge with execution capability.",
            ],
            key_risks=[
                "Scaling execution without overextending operating capacity.",
                "Maintaining cash discipline while investing in growth.",
            ],
            fundability_summary=(
                f"{company.name} is fundable because it shows a clear market need, "
                "a practical growth plan, and a use-of-funds story aligned to the program."
            ),
        )

    def build_outline(
        self,
        context,
        program_analysis: ProgramAnalysis,
        company_analysis: CompanyAnalysis,
    ) -> DocumentOutline:
        items = [
            ("executive_summary", "Executive Summary", "Frame the ask and why the business is fundable now."),
            ("company_overview", "Company Overview", "Explain the business, founder, stage, and operating context."),
            ("market_opportunity", "Market Opportunity", "Show the demand environment and why this problem matters."),
            ("business_model", "Business Model", "Explain how the company makes money and scales responsibly."),
            ("use_of_funds", "Use of Funds", "Tie the requested funding to specific outcomes and milestones."),
            ("implementation_plan", "Implementation Plan", "Show how the team will deploy capital and execute."),
            ("risk_analysis", "Risk Analysis", "Address real execution risks with mitigation logic."),
        ][: context.section_limit]
        return DocumentOutline(
            sections=[
                {
                    "section_key": key,
                    "title": title,
                    "objective": objective,
                    "guidance": f"Match the tone of {program_analysis.program_name} and stay commercially credible.",
                }
                for key, title, objective in items
            ],
        )

    def generate_section(
        self,
        context,
        program_analysis: ProgramAnalysis,
        company_analysis: CompanyAnalysis,
        outline_item,
        draft_content: str | None = None,
    ) -> GeneratedSection:
        company = context.company
        content = (
            f"{company.name} - {outline_item.title}. "
            f"{outline_item.objective} "
            f"The company operates in {company.location or 'its target market'} and is led by "
            f"{company.founder_name}. "
            f"The business summary centers on {company.business_summary} "
            f"The commercial model is {company.revenue_model or company_analysis.business_model}. "
            f"This section should reinforce {', '.join(program_analysis.reviewer_priorities[:2])}."
        )
        if draft_content and draft_content.strip():
            content += f" Revised from the founder's draft: {draft_content.strip()}"
        return GeneratedSection(
            section_key=outline_item.section_key,
            title=outline_item.title,
            content=content,
            citations=[program_analysis.program_name],
        )


def build_model_gateway(
    settings: Settings,
    environment_mode: EnvironmentMode = "test",
) -> ModelGateway:
    if environment_mode == "test" or settings.use_mock_llm:
        return MockModelGateway()
    return OpenAIModelGateway(settings)
