from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, SecretStr, field_validator


class GenerationModelConfig(BaseModel):
    """Resolved model settings loaded by the backend from platform configuration."""

    model_name: str = Field(min_length=1, max_length=200)
    provider_id: str = Field(default="custom", max_length=80)
    api_key: SecretStr = SecretStr("")
    url: str = Field(min_length=1, max_length=2000)
    temperature: float = Field(default=0.2, ge=0, le=2)
    max_tokens: int = Field(default=1024, ge=1, le=100000)
    reasoning_enabled: bool = False


class GeneratePlanRequest(BaseModel):
    app_id: str = Field(min_length=1, max_length=160)
    language: str = Field(default="en-CA", min_length=2, max_length=16)
    model: GenerationModelConfig | None = None

    @field_validator("language", mode="before")
    @classmethod
    def normalize_language(cls, value: object) -> str:
        aliases = {
            "en": "en-CA",
            "english": "en-CA",
            "en-ca": "en-CA",
            "fr": "fr-CA",
            "french": "fr-CA",
            "fr-ca": "fr-CA",
            "zh": "zh-CN",
            "chinese": "zh-CN",
            "zh-cn": "zh-CN",
        }
        normalized = str(value or "en-CA").strip().lower()
        if normalized in aliases:
            return aliases[normalized]
        return value if value in {"en-CA", "fr-CA", "zh-CN"} else "en-CA"


class StrategicReportSectionRequest(GeneratePlanRequest):
    strategic_report_id: UUID
    section_key: str = Field(min_length=1, max_length=160)
    content: str = Field(default="", max_length=200000)
    layout: Literal["cover-page", "main-content"] = "main-content"


class CompanyRecord(BaseModel):
    id: int | None = None
    workspace_id: UUID
    created_by: int
    owner_user_id: int
    name: str
    legal_name: str | None = None
    founder_name: str
    business_summary: str
    industry: str | None = None
    location: str | None = None
    stage: str | None = None
    revenue_model: str | None = None
    team_background: str | None = None
    traction: str | None = None
    use_of_funds: str | None = None
    annual_revenue: Decimal | None = None
    monthly_revenue: Decimal | None = None
    employee_count: int | None = None
    website: str | None = None
    metadata: dict = Field(default_factory=dict)


class FundingProgramRecord(BaseModel):
    id: UUID
    workspace_id: UUID | None = None
    name: str
    provider: str | None = None
    category: str | None = None
    program_url: str | None = None
    funding_amount: Decimal | None = None
    currency: str = "CAD"
    location: str | None = None
    raw_guidelines_text: str | None = None
    target_outcome: str | None = None
    metadata: dict = Field(default_factory=dict)


class AdvisoryHubSectionConfig(BaseModel):
    id: str
    title: str
    document_type_id: str
    document_type_name: str = ""
    prompt: str
    agent_id: str
    layout: Literal["cover-page", "main-content"] = "main-content"
    priority: Literal["high", "default", "low"] = "default"
    enabled: bool


class AdvisoryHubAgentConfig(BaseModel):
    id: str
    name: str
    role: str
    prompt: str


class AdvisoryHubConfiguration(BaseModel):
    sections: list[AdvisoryHubSectionConfig]
    agents: list[AdvisoryHubAgentConfig]


class GenerationContext(BaseModel):
    application_id: int
    workspace_id: UUID
    company: CompanyRecord
    program: FundingProgramRecord
    package_name: str
    requested_by_user_id: int
    target_language: str
    section_limit: int
    advisory_sections: list[AdvisoryHubSectionConfig] = Field(default_factory=list)
    advisory_agents: list[AdvisoryHubAgentConfig] = Field(default_factory=list)
    selected_document_type_ids: list[str] = Field(default_factory=list)


class ProgramAnalysis(BaseModel):
    program_name: str
    funding_amount: str | None = None
    mandatory_sections: list[str]
    evaluation_criteria: list[str]
    preferred_tone: str
    reviewer_priorities: list[str]


class CompanyAnalysis(BaseModel):
    business_name: str
    core_problem: str
    solution_summary: str
    business_model: str
    traction_signals: list[str]
    team_strengths: list[str]
    key_risks: list[str]
    fundability_summary: str


class OutlineItem(BaseModel):
    section_key: str
    title: str
    objective: str
    guidance: str
    agent_id: str | None = None
    priority: Literal["high", "default", "low"] = "default"


class DocumentOutline(BaseModel):
    sections: list[OutlineItem]


class GeneratedSection(BaseModel):
    section_key: str
    title: str
    content: str
    citations: list[str] = Field(default_factory=list)


class StrategicReportSectionResult(BaseModel):
    strategic_report_id: UUID
    status: Literal["saved", "regenerated"]
    section: GeneratedSection
    layout: Literal["cover-page", "main-content"]
    updated_at: datetime


class ForecastMonth(BaseModel):
    key: str
    label: str
    year: int
    month: int


class FinancialForecastRow(BaseModel):
    category: Literal["revenue", "expense"]
    name: str
    values: list[float]
    total: float


class FinancialForecastYearSummary(BaseModel):
    year: int
    label: str
    total_revenue: float
    total_expenses: float
    net_cash_flow: float


class FinancialForecast(BaseModel):
    years: int = Field(default=3, ge=1)
    currency: str
    start_month: str
    months: list[ForecastMonth]
    rows: list[FinancialForecastRow]
    monthly_revenue_totals: list[float]
    monthly_expense_totals: list[float]
    monthly_net_cash_flow: list[float]
    ending_cash_balance: list[float]
    annual_summaries: list[FinancialForecastYearSummary]
    assumptions: list[str]


class FinalDocument(BaseModel):
    title: str
    program_name: str
    business_name: str
    executive_summary: str
    sections: list[GeneratedSection]
    key_strengths: list[str]
    risks: list[str]
    use_of_funds_summary: str
    next_steps: list[str]
    financial_forecast: FinancialForecast | None = None


class GenerationRunResult(BaseModel):
    strategic_report_id: UUID
    status: Literal["completed", "failed"]
    document: FinalDocument | None = None
    message: str | None = None
    completed_at: datetime | None = None


class ErrorResponse(BaseModel):
    detail: str


class AIConnectionTestRequest(BaseModel):
    model_name: str = Field(min_length=1, max_length=200)
    provider_id: str = Field(default="custom", max_length=80)
    api_key: SecretStr = SecretStr("")
    url: str = Field(min_length=1, max_length=2000)
    temperature: float | None = Field(default=None, ge=0, le=2)
    max_tokens: int = Field(default=1024, ge=1, le=100000)
    reasoning_enabled: bool = False
    message: str = Field(min_length=1, max_length=12000)


class AIConnectionTestResponse(BaseModel):
    response: str
    upstream_status: int
