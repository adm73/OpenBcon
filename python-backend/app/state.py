from typing import TypedDict

from .models import (
    CompanyAnalysis,
    DocumentOutline,
    FinalDocument,
    FinancialForecast,
    GeneratedSection,
    GenerationContext,
    ProgramAnalysis,
)


class PlanGraphState(TypedDict, total=False):
    context: GenerationContext
    normalized_company: dict
    normalized_program: dict
    program_analysis: ProgramAnalysis
    company_analysis: CompanyAnalysis
    outline: DocumentOutline
    sections: list[GeneratedSection]
    financial_forecast: FinancialForecast
    final_document: FinalDocument
    errors: list[str]
