from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class GeneratePlanRequest(BaseModel):
    workspace_id: UUID
    company_id: UUID
    funding_program_id: UUID
    requested_by_user_id: UUID
    package_name: str | None = None
    target_language: str = "en"
    section_limit: int = Field(default=7, ge=4, le=12)


class CompanyRecord(BaseModel):
    id: UUID
    workspace_id: UUID
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
    location: str | None = None
    raw_guidelines_text: str | None = None
    target_outcome: str | None = None
    metadata: dict = Field(default_factory=dict)


class GenerationContext(BaseModel):
    workspace_id: UUID
    company: CompanyRecord
    program: FundingProgramRecord
    package_name: str
    requested_by_user_id: UUID
    target_language: str
    section_limit: int


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


class DocumentOutline(BaseModel):
    sections: list[OutlineItem]


class GeneratedSection(BaseModel):
    section_key: str
    title: str
    content: str
    citations: list[str] = Field(default_factory=list)


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


class GenerationRunResult(BaseModel):
    package_id: UUID
    run_id: UUID
    status: Literal["completed", "failed"]
    document: FinalDocument | None = None
    message: str | None = None
    completed_at: datetime | None = None


class FundingPackageRunRecord(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    package_id: UUID
    status: str
    model_name: str
    started_at: datetime | None = None


class ErrorResponse(BaseModel):
    detail: str
