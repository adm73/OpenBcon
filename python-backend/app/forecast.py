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


def _money(value: Decimal) -> Decimal:
    return value.quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)


def _number(value: Decimal) -> float:
    return float(_money(value))


def _month_at(start: date, offset: int) -> date:
    month_index = start.year * 12 + start.month - 1 + offset
    return date(month_index // 12, month_index % 12 + 1, 1)


def _starting_monthly_revenue(context: GenerationContext) -> Decimal:
    company = context.company
    if company.monthly_revenue and company.monthly_revenue > 0:
        return _money(company.monthly_revenue)
    if company.annual_revenue and company.annual_revenue > 0:
        return _money(company.annual_revenue / Decimal("12"))

    funding_amount = context.program.funding_amount or Decimal("0")
    return _money(max(funding_amount * Decimal("0.05"), Decimal("5000")))


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
    revenue_growth = Decimal("0.04")
    payroll_base = max(starting_revenue * Decimal("0.70"), Decimal("9000"))

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

        payroll.append(_money(payroll_base * (Decimal("1.015") ** (index // 3))))
        sales_marketing.append(_money(Decimal("1500") + total_revenue * Decimal("0.10")))
        software_infrastructure.append(_money(Decimal("1200") + total_revenue * Decimal("0.08")))
        operations.append(_money(Decimal("2000") + total_revenue * Decimal("0.03")))
        occupancy.append(_money(Decimal("700") + total_revenue * Decimal("0.02")))
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
        f"Starting monthly revenue is {currency} {_number(starting_revenue):,.2f}; stored company revenue is used when available.",
        "Revenue grows by 4% per month and is split into recurring, project, and other revenue.",
        "Payroll, sales, technology, operations, occupancy, and financing costs are modeled separately.",
        "This is a planning forecast and should be replaced or refined with verified financial inputs.",
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
