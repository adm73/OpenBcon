from .models import CompanyAnalysis, FundingProgramRecord, GenerationContext, OutlineItem, ProgramAnalysis


def build_program_analysis_prompt(program: FundingProgramRecord, language: str) -> list[dict[str, str]]:
    return [
        {
            "role": "system",
            "content": (
                "You are a funding-program analyst. Extract the real evaluation logic "
                "of the program and return concise, structured output. Do not invent "
                "requirements that are not grounded in the provided program context."
            ),
        },
        {
            "role": "user",
            "content": f"""
Target language: {language}
Program name: {program.name}
Provider: {program.provider or "Unknown"}
Category: {program.category or "Unknown"}
Funding amount: {program.funding_amount or "Not specified"}
Location: {program.location or "Unknown"}
Target outcome: {program.target_outcome or "Not specified"}
Program URL: {program.program_url or "Not provided"}
Guidelines:
{program.raw_guidelines_text or "No raw guidelines text supplied."}
""".strip(),
        },
    ]


def build_company_analysis_prompt(
    context: GenerationContext,
    program_analysis: ProgramAnalysis,
) -> list[dict[str, str]]:
    company = context.company
    return [
        {
            "role": "system",
            "content": (
                "You are a venture and grant writer. Analyze why the company is "
                "fundable for this program. Be concrete, commercially literate, and "
                "aligned to the program priorities."
            ),
        },
        {
            "role": "user",
            "content": f"""
Target language: {context.target_language}
Business name: {company.name}
Founder: {company.founder_name}
Industry: {company.industry or "Unknown"}
Location: {company.location or "Unknown"}
Stage: {company.stage or "Unknown"}
Business summary:
{company.business_summary}

Revenue model:
{company.revenue_model or "Not provided"}

Team background:
{company.team_background or "Not provided"}

Traction:
{company.traction or "Not provided"}

Use of funds:
{company.use_of_funds or "Not provided"}

Program priorities:
{", ".join(program_analysis.reviewer_priorities)}
""".strip(),
        },
    ]


def build_outline_prompt(
    context: GenerationContext,
    program_analysis: ProgramAnalysis,
    company_analysis: CompanyAnalysis,
) -> list[dict[str, str]]:
    return [
        {
            "role": "system",
            "content": (
                "You design business plan outlines for funding applications. Build an "
                "outline that matches the program requirements while staying practical "
                "for a founder-facing business plan."
            ),
        },
        {
            "role": "user",
            "content": f"""
Target language: {context.target_language}
Section limit: {context.section_limit}
Program: {program_analysis.program_name}
Mandatory sections: {", ".join(program_analysis.mandatory_sections)}
Evaluation criteria: {", ".join(program_analysis.evaluation_criteria)}
Preferred tone: {program_analysis.preferred_tone}
Fundability summary:
{company_analysis.fundability_summary}

Core problem:
{company_analysis.core_problem}

Solution summary:
{company_analysis.solution_summary}
""".strip(),
        },
    ]


def build_section_prompt(
    context: GenerationContext,
    program_analysis: ProgramAnalysis,
    company_analysis: CompanyAnalysis,
    outline_item: OutlineItem,
) -> list[dict[str, str]]:
    company = context.company
    program = context.program
    return [
        {
            "role": "system",
            "content": (
                "You write one section of a funding-ready business plan. Write clearly, "
                "credibly, and in a way that can be shown to lenders, grant reviewers, "
                "or internal decision-makers."
            ),
        },
        {
            "role": "user",
            "content": f"""
Target language: {context.target_language}
Business name: {company.name}
Program name: {program.name}
Section key: {outline_item.section_key}
Section title: {outline_item.title}
Section objective: {outline_item.objective}
Section guidance: {outline_item.guidance}

Business summary:
{company.business_summary}

Revenue model:
{company.revenue_model or "Not provided"}

Team background:
{company.team_background or "Not provided"}

Traction:
{company.traction or "Not provided"}

Use of funds:
{company.use_of_funds or "Not provided"}

Program evaluation criteria:
{", ".join(program_analysis.evaluation_criteria)}

Fundability summary:
{company_analysis.fundability_summary}
""".strip(),
        },
    ]
