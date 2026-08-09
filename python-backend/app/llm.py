from __future__ import annotations

import json
import re
from collections.abc import Callable, Mapping
from typing import Protocol
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit, urlunsplit
from urllib.request import Request as URLRequest
from urllib.request import urlopen

from langchain_openai import ChatOpenAI
from langchain_core.callbacks import UsageMetadataCallbackHandler

from .config import Settings
from .models import (
    CompanyAnalysis,
    DocumentOutline,
    GeneratedSection,
    GenerationModelConfig,
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
    def __init__(
        self,
        settings: Settings,
        model_config: GenerationModelConfig | None = None,
    ):
        model_name = model_config.model_name if model_config else settings.openai_model
        provider_id = model_config.provider_id.casefold() if model_config else "openai"
        api_key = (
            model_config.api_key.get_secret_value()
            if model_config
            else settings.openai_api_key
        )
        if api_key == "__stored_securely__":
            api_key = ""
        if not api_key and provider_id == "openrouter":
            api_key = settings.openrouter_api_key
        if provider_id == "ollama" and not api_key:
            # Ollama's local OpenAI-compatible endpoint does not require auth.
            # ChatOpenAI still expects a non-empty key, so use a local sentinel.
            api_key = "ollama"
        if not api_key:
            raise ValueError(
                "An API key is required for the configured model unless mock mode is enabled.",
            )
        self.model_name = model_name
        self.provider_id = provider_id
        self._usage_records: list[dict] = []

        kwargs = {
            "model": model_name,
            "api_key": api_key,
            "temperature": model_config.temperature if model_config else 0.2,
            "timeout": 120 if provider_id in {"openrouter", "custom"} else 90,
            "max_retries": 0,
        }
        if model_config:
            if provider_id not in {"openai", "openrouter", "ollama", "custom"}:
                raise ValueError(
                    "Strategic Report generation currently supports OpenAI-compatible providers only.",
                )
            parsed_url = urlsplit(model_config.url.strip())
            allowed_hosts = {
                host.strip().lower().rstrip(".")
                for host in settings.allowed_ai_endpoint_hosts.split(",")
                if host.strip()
            }
            hostname = (parsed_url.hostname or "").lower().rstrip(".")
            configured_ollama_host = (
                urlsplit(settings.ollama_base_url).hostname or "ollama"
            ).lower().rstrip(".")
            is_allowed_ollama_endpoint = (
                provider_id == "ollama"
                and hostname in {configured_ollama_host, "ollama", "localhost", "127.0.0.1"}
            )
            if (
                (parsed_url.scheme != "https" and not is_allowed_ollama_endpoint)
                or not hostname
                or (
                    not settings.allow_private_ai_endpoints
                    and hostname not in allowed_hosts
                    and not is_allowed_ollama_endpoint
                )
            ):
                raise ValueError("The configured model endpoint is not allowed.")
            if provider_id == "ollama":
                if parsed_url.path.rstrip("/") != "/api/chat":
                    raise ValueError("Ollama must use its native /api/chat endpoint.")
                configured = urlsplit(settings.ollama_base_url)
                self._ollama_url = urlunsplit(
                    (
                        configured.scheme or parsed_url.scheme,
                        configured.netloc or parsed_url.netloc,
                        parsed_url.path,
                        parsed_url.query,
                        parsed_url.fragment,
                    )
                )
                self._ollama_temperature = model_config.temperature
                self._ollama_max_tokens = model_config.max_tokens
                self._llm = None
                return
            base_url = _openai_base_url(model_config.url)
            if not base_url:
                raise ValueError("The configured model URL is invalid.")
            kwargs["base_url"] = base_url
            if provider_id == "openrouter" and model_config.reasoning_enabled:
                reasoning_tokens = max(1024, min(2048, model_config.max_tokens))
                kwargs["extra_body"] = {
                    # OpenRouter reasoning models need their reasoning budget
                    # plus room for the final JSON response.
                    "max_tokens": max(model_config.max_tokens, reasoning_tokens + 3072),
                    "reasoning": {
                        "enabled": True,
                        "max_tokens": reasoning_tokens,
                    },
                }
            elif provider_id == "openrouter":
                kwargs["extra_body"] = {"max_tokens": model_config.max_tokens}
            elif provider_id == "ollama":
                kwargs["max_tokens"] = model_config.max_tokens
            elif provider_id == "custom":
                # Generic OpenAI-compatible gateways commonly implement
                # max_tokens, not OpenAI's newer max_completion_tokens field.
                kwargs["max_tokens"] = model_config.max_tokens
            else:
                kwargs["max_completion_tokens"] = model_config.max_tokens
        self._llm = ChatOpenAI(**kwargs)

    @property
    def usage_records(self) -> list[dict]:
        """Return token usage collected from calls made by this gateway."""
        return [dict(record) for record in self._usage_records]

    @staticmethod
    def _usage_values(value: object) -> tuple[int, int, int] | None:
        if not isinstance(value, Mapping):
            return None
        input_tokens = int(value.get("input_tokens", value.get("prompt_tokens", 0)) or 0)
        output_tokens = int(
            value.get("output_tokens", value.get("completion_tokens", 0)) or 0
        )
        total_tokens = int(value.get("total_tokens", 0) or 0)
        if not total_tokens:
            total_tokens = input_tokens + output_tokens
        if not input_tokens and not output_tokens and not total_tokens:
            return None
        return input_tokens, output_tokens, total_tokens

    def _record_usage(
        self,
        node_name: str,
        section_key: str | None,
        callback: UsageMetadataCallbackHandler | None = None,
        response: object | None = None,
        fallback_usage: Mapping[str, object] | None = None,
    ) -> None:
        usage: tuple[int, int, int] | None = None
        if callback:
            for metadata in callback.usage_metadata.values():
                usage = self._usage_values(metadata)
                if usage:
                    break
        if not usage and response is not None:
            usage = self._usage_values(getattr(response, "usage_metadata", None))
            if not usage:
                metadata = getattr(response, "response_metadata", {})
                usage = self._usage_values(
                    metadata.get("token_usage") if isinstance(metadata, Mapping) else None
                )
        if not usage and fallback_usage:
            usage = self._usage_values(fallback_usage)
        input_tokens, output_tokens, total_tokens = usage or (0, 0, 0)
        self._usage_records.append(
            {
                "node_name": node_name,
                "section_key": section_key,
                "model_name": self.model_name,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_tokens,
            }
        )

    def _invoke_with_usage(
        self,
        invoke: Callable[[UsageMetadataCallbackHandler], object],
        node_name: str,
        section_key: str | None,
    ) -> object:
        callback = UsageMetadataCallbackHandler()
        response: object | None = None
        try:
            response = invoke(callback)
            return response
        finally:
            self._record_usage(node_name, section_key, callback, response)

    def _invoke_ollama(
        self,
        messages,
        output_model=None,
        node_name: str = "",
        section_key: str | None = None,
    ):
        payload = {
            "model": self.model_name,
            "stream": False,
            "messages": messages,
            "options": {
                "temperature": self._ollama_temperature,
                "num_predict": self._ollama_max_tokens,
            },
        }
        # Native Ollama supports JSON-schema constrained responses. This keeps
        # small local models from returning Markdown when a structured result is
        # required by the generation graph.
        if output_model is not None:
            payload["format"] = output_model.model_json_schema()
        request = URLRequest(
            self._ollama_url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urlopen(request, timeout=90) as response:
                body = json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            detail = error.read(4096).decode("utf-8", errors="replace").strip()
            raise RuntimeError(f"Ollama request failed ({error.code}): {detail}") from error
        except URLError as error:
            raise RuntimeError(f"Ollama request failed: {error.reason}") from error

        message = body.get("message") if isinstance(body, dict) else None
        content = message.get("content") if isinstance(message, dict) else None
        if not isinstance(content, str) or not content.strip():
            raise RuntimeError("Ollama returned no message content.")
        self._record_usage(
            node_name,
            section_key,
            fallback_usage={
                "prompt_tokens": body.get("prompt_eval_count", 0),
                "completion_tokens": body.get("eval_count", 0),
            },
        )
        return content

    def _invoke_structured(
        self,
        output_model,
        messages,
        node_name: str,
        section_key: str | None = None,
    ):
        """Request JSON from providers that do not reliably support tool calls."""
        json_messages = [*messages]
        json_messages[0] = {
            **json_messages[0],
            "content": (
                f"{json_messages[0]['content']}\n\n"
                "Return only valid JSON matching this schema. Do not use Markdown, "
                "code fences, headings, or commentary.\n"
                f"Schema: {json.dumps(output_model.model_json_schema(), ensure_ascii=True)}"
            ),
        }

        def parse_response(response):
            content = response.content
            if isinstance(content, list):
                content = "".join(
                    item.get("text", "") if isinstance(item, dict) else str(item)
                    for item in content
                )
            text = str(content).strip()
            return parse_text(text)

        def parse_text(text):
            fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
            candidate = fenced.group(1) if fenced else text
            if not candidate.startswith("{"):
                start = candidate.find("{")
                end = candidate.rfind("}")
                candidate = candidate[start : end + 1] if start >= 0 and end > start else ""
            return output_model.model_validate(json.loads(candidate))

        # OpenRouter free models can stall when asked for provider-specific
        # structured output. They already return JSON reliably with the schema
        # prompt, so parse that response first and keep json_mode as a fallback.
        if self.provider_id == "ollama":
            return parse_text(
                self._invoke_ollama(
                    json_messages,
                    output_model,
                    node_name,
                    section_key,
                )
            )
        if self.provider_id in {"openrouter", "custom"}:
            return parse_response(
                self._invoke_with_usage(
                    lambda callback: self._llm.invoke(
                        json_messages,
                        config={"callbacks": [callback]},
                    ),
                    node_name,
                    section_key,
                )
            )

        try:
            structured = self._llm.with_structured_output(
                output_model,
                method="json_mode",
            )
            return self._invoke_with_usage(
                lambda callback: structured.invoke(
                    json_messages,
                    config={"callbacks": [callback]},
                ),
                node_name,
                section_key,
            )
        except Exception as first_error:
            # Some OpenRouter models still wrap JSON in prose. Retry once with a
            # plain completion and extract the first complete JSON object.
            try:
                return parse_response(
                    self._invoke_with_usage(
                        lambda callback: self._llm.invoke(
                            json_messages,
                            config={"callbacks": [callback]},
                        ),
                        node_name,
                        section_key,
                    )
                )
            except Exception:
                raise first_error

    def analyze_program(self, program, language: str) -> ProgramAnalysis:
        return self._invoke_structured(
            ProgramAnalysis,
            build_program_analysis_prompt(program, language),
            "analyze_program",
        )

    def analyze_company(self, context, program_analysis: ProgramAnalysis) -> CompanyAnalysis:
        return self._invoke_structured(
            CompanyAnalysis,
            build_company_analysis_prompt(context, program_analysis),
            "analyze_company",
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
            "build_outline",
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
            "generate_sections",
            outline_item.section_key,
        )


class MockModelGateway:
    model_name = "mock-business-plan-generator"
    usage_records: list[dict] = []

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


def _openai_base_url(url: str) -> str:
    parsed = urlsplit(url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return ""

    path = parsed.path.rstrip("/")
    for suffix in ("/chat/completions", "/responses"):
        if path.endswith(suffix):
            path = path[: -len(suffix)]
            break
    return urlunsplit((parsed.scheme, parsed.netloc, path, "", "")).rstrip("/")


def build_model_gateway(
    settings: Settings,
    environment_mode: EnvironmentMode = "test",
    model_config: GenerationModelConfig | None = None,
) -> ModelGateway:
    # Test mode must never make an external model request. It exercises the
    # complete graph and persistence flow with deterministic mock output.
    if environment_mode == "test" or settings.use_mock_llm:
        return MockModelGateway()
    if model_config is not None:
        return OpenAIModelGateway(settings, model_config)
    return OpenAIModelGateway(settings)
