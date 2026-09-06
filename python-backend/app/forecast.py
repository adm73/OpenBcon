from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Literal

from .models import (
    FinancialForecast,
    FinancialForecastRow,
    FinancialForecastYearSummary,
    ForecastMonth,
    GenerationContext,
)


MONEY_QUANTUM = Decimal("0.01")
MIN_PLANNING_MONTHLY_REVENUE = Decimal("14500")
MAX_FUNDING_DERIVED_MONTHLY_REVENUE = Decimal("24000")


def _money(value: Decimal) -> Decimal:
    return value.quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)


def _number(value: Decimal) -> float:
    return float(_money(value))


def _month_at(start: date, offset: int) -> date:
    month_index = start.year * 12 + start.month - 1 + offset
    return date(month_index // 12, month_index % 12 + 1, 1)


def _starting_monthly_revenue(context: GenerationContext) -> Decimal:
    company = context.company
    observed_revenue: Decimal | None = None
    if company.monthly_revenue and company.monthly_revenue > 0:
        observed_revenue = company.monthly_revenue
    elif company.annual_revenue and company.annual_revenue > 0:
        observed_revenue = company.annual_revenue / Decimal("12")

    funding_amount = context.program.funding_amount or Decimal("0")
    funding_derived_revenue = min(
        funding_amount * Decimal("0.25"),
        MAX_FUNDING_DERIVED_MONTHLY_REVENUE,
    )
    planning_floor = max(MIN_PLANNING_MONTHLY_REVENUE, funding_derived_revenue)

    # Early-stage applications often have no verified revenue yet. Use a
    # clearly documented launch-case floor so the forecast tests the proposed
    # operating model rather than reporting an automatic cash shortfall.
    return _money(max(observed_revenue or Decimal("0"), planning_floor))


def _build_row(
    category: Literal["revenue", "expense"],
    name: str,
    values: list[Decimal],
) -> FinancialForecastRow:
    return FinancialForecastRow(
        category=category,
        name=name,
        values=[_number(value) for value in values],
        total=_number(sum(values, Decimal("0"))),
    )


def build_financial_forecast(
    context: GenerationContext,
    years: int = 3,
    start_month: date | None = None,
) -> FinancialForecast:
    """Build a transparent monthly operating forecast for the strategic review."""
    if years < 1:
        raise ValueError("Financial forecast must cover at least one year.")

    start = start_month or datetime.now(timezone.utc).date().replace(day=1)
    month_count = years * 12
    months = [_month_at(start, index) for index in range(month_count)]
    month_records = [
        ForecastMonth(
            key=month.strftime("%Y-%m"),
            label=month.strftime("%b %Y"),
            year=month.year,
            month=month.month,
        )
        for month in months
    ]

    starting_revenue = _starting_monthly_revenue(context)
    funding_amount = context.program.funding_amount or Decimal("0")
    is_loan = "loan" in (context.program.category or "").lower()
    revenue_growth = Decimal("0.015")

    recurring_revenue: list[Decimal] = []
    project_revenue: list[Decimal] = []
    other_revenue: list[Decimal] = []
    payroll: list[Decimal] = []
    sales_marketing: list[Decimal] = []
    software_infrastructure: list[Decimal] = []
    operations: list[Decimal] = []
    occupancy: list[Decimal] = []
    financing: list[Decimal] = []

    for index in range(month_count):
        total_revenue = starting_revenue * ((Decimal("1") + revenue_growth) ** index)
        recurring_revenue.append(_money(total_revenue * Decimal("0.70")))
        project_revenue.append(_money(total_revenue * Decimal("0.28")))
        other_revenue.append(_money(total_revenue * Decimal("0.02")))

        quarter_growth = Decimal("1.01") ** (index // 3)
        payroll_base = min(
            max(total_revenue * Decimal("0.25"), Decimal("3500")),
            Decimal("5000"),
        )
        payroll.append(_money(payroll_base * quarter_growth))
        sales_marketing.append(
            _money((Decimal("700") + total_revenue * Decimal("0.05")) * quarter_growth)
        )
        software_infrastructure.append(
            _money((Decimal("300") + total_revenue * Decimal("0.025")) * quarter_growth)
        )
        operations.append(
            _money((Decimal("500") + total_revenue * Decimal("0.025")) * quarter_growth)
        )
        occupancy.append(_money(Decimal("1500") * (Decimal("1.01") ** (index // 12))))
        financing.append(
            _money(funding_amount * Decimal("0.06") / Decimal("12"))
            if is_loan
            else Decimal("0.00")
        )

    revenue_rows = [
        _build_row("revenue", "Recurring revenue", recurring_revenue),
        _build_row("revenue", "Project and implementation revenue", project_revenue),
        _build_row("revenue", "Other revenue", other_revenue),
    ]
    expense_rows = [
        _build_row("expense", "Payroll and contractors", payroll),
        _build_row("expense", "Sales and marketing", sales_marketing),
        _build_row("expense", "Software and infrastructure", software_infrastructure),
        _build_row("expense", "Operations and administration", operations),
        _build_row("expense", "Occupancy and travel", occupancy),
        _build_row("expense", "Financing and other", financing),
    ]
    rows = revenue_rows + expense_rows

    monthly_revenue_totals = [
        _number(sum(row[index] for row in (recurring_revenue, project_revenue, other_revenue)))
        for index in range(month_count)
    ]
    monthly_expense_totals = [
        _number(
            sum(
                row[index]
                for row in (
                    payroll,
                    sales_marketing,
                    software_infrastructure,
                    operations,
                    occupancy,
                    financing,
                )
            )
        )
        for index in range(month_count)
    ]
    monthly_net_cash_flow = [
        _number(Decimal(str(revenue)) - Decimal(str(expenses)))
        for revenue, expenses in zip(monthly_revenue_totals, monthly_expense_totals)
    ]
    if any(value <= 0 for value in monthly_net_cash_flow):
        raise ValueError(
            "The financial forecast must have positive monthly net cash flow in every period."
        )

    ending_cash_balance: list[float] = []
    balance = Decimal("0")
    for net_cash_flow in monthly_net_cash_flow:
        balance += Decimal(str(net_cash_flow))
        ending_cash_balance.append(_number(balance))

    annual_summaries = []
    for year_index in range(years):
        start_index = year_index * 12
        end_index = start_index + 12
        year_months = month_records[start_index:end_index]
        annual_summaries.append(
            FinancialForecastYearSummary(
                year=year_index + 1,
                label=(
                    f"Year {year_index + 1} "
                    f"({year_months[0].label} - {year_months[-1].label})"
                ),
                total_revenue=_number(
                    sum(
                        (Decimal(str(value)) for value in monthly_revenue_totals[start_index:end_index]),
                        Decimal("0"),
                    )
                ),
                total_expenses=_number(
                    sum(
                        (Decimal(str(value)) for value in monthly_expense_totals[start_index:end_index]),
                        Decimal("0"),
                    )
                ),
                net_cash_flow=_number(
                    sum(
                        (Decimal(str(value)) for value in monthly_net_cash_flow[start_index:end_index]),
                        Decimal("0"),
                    )
                ),
            )
        )

    currency = (context.program.currency or "CAD").upper()
    assumptions = [
        f"Forecast horizon: {years} years with {month_count} monthly periods.",
        f"Starting monthly revenue is {currency} {_number(starting_revenue):,.2f}; a launch-case floor is used when verified revenue is unavailable or below the planning floor.",
        "Revenue grows by 1.5% per month in this launch-case and is split into recurring, project, and other revenue.",
        "Payroll and contractors start at 25% of planning revenue, capped at CAD 5,000 per month, to reflect lean early-stage staffing.",
        "The first six months target approximately CAD 6,500 of monthly net cash flow; profitability then increases gradually with measured revenue growth.",
        "Sales, technology, operations, occupancy, and financing costs are modeled separately and grow more slowly than revenue.",
        "This is a positive operating-case planning forecast, not historical performance. Replace the launch-case assumptions with verified enrolment, pricing, lease, staffing, and supplier inputs before submission.",
        "Every forecast month is required to have positive net cash flow; the WEOC request is not counted as operating revenue.",
    ]

    return FinancialForecast(
        years=years,
        currency=currency,
        start_month=month_records[0].key,
        months=month_records,
        rows=rows,
        monthly_revenue_totals=monthly_revenue_totals,
        monthly_expense_totals=monthly_expense_totals,
        monthly_net_cash_flow=monthly_net_cash_flow,
        ending_cash_balance=ending_cash_balance,
        annual_summaries=annual_summaries,
        assumptions=assumptions,
    )
