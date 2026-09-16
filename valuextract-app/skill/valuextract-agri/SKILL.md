---
name: valuextract-agri
description: Analyses agricultural financial statements, management accounts, trial balances, budgets, cash-flow forecasts, asset and loan schedules, production data, and related business information to identify evidence-backed client value opportunities and professional-service engagements. Use for farms, agricultural groups, crop or livestock producers, packhouses, processors, exporters, cooperatives, agri holding companies, farming SPVs, and family-owned farming groups whenever the user wants a ValueXtract opportunity report, agri financial diagnostic, advisory opportunity scan, or quantified value-extraction analysis. Produces structured opportunity data and a polished responsive ValueXtract HTML report; do not use for generic non-agricultural financial analysis.
metadata:
  display_name: "ValueXtract - Agri"
  version: "1.0.0"
---

# ValueXtract - Agri

Turn agricultural financial data into evidence-backed actions, professional-service opportunities, and quantified client value. Approach the work as a chartered accountant, agricultural CFO, corporate-finance adviser, tax adviser, and management consultant working together.

The governing chain is:

`FINANCIAL DATA -> INSIGHT -> TRIGGER -> SERVICE OPPORTUNITY -> ACTION -> CLIENT VALUE`

Quality and evidence outrank opportunity count. Do not force an engagement where the supplied information does not support one.

## Required references

Read the files needed for the current analysis before drawing conclusions:

- Read [references/analysis-framework.md](references/analysis-framework.md) for document extraction, agricultural-business identification, ratios, trends, and seasonality.
- Read [references/opportunity-catalog.md](references/opportunity-catalog.md) when scanning and consolidating opportunity families.
- Read [references/evidence-scoring-value.md](references/evidence-scoring-value.md) before scoring, valuing, pricing, or producing the structured record.
- Read [references/report-spec.md](references/report-spec.md) before generating the final report.
- Use [references/report-data.schema.json](references/report-data.schema.json) as the canonical machine-readable output contract.

## Inputs and minimum scope

Accept one or more annual financial statements, management accounts, trial balances, detailed ledgers, budgets, forecasts, cash-flow forecasts, asset registers, loan schedules, production or yield statistics, debtor and creditor ageings, inventory reports, operational information, website content, and company profiles.

Proceed when annual financial statements and/or management accounts are available. If neither is available, explain that a reliable financial opportunity report cannot yet be completed, identify the smallest useful document set, and analyse any supporting data only as preliminary context.

## Workflow

### 1. Establish the evidence base

- Inventory every supplied document, entity, period, currency, unit scale, and consolidation level.
- Distinguish audited, compiled, management, forecast, and operational data.
- Read all relevant statements, detailed schedules, notes, accounting policies, comparatives, and supporting operational information rather than stopping at headline totals.
- Build a source map while reading. Retain genuine document names, note or section names, line items, periods, and page numbers when page numbers are visible. Never infer a page number.
- Record scope limitations, inconsistencies, missing pages, unclear units, and reconciliation differences before using the affected data.

### 2. Understand the agricultural operation

Identify the subsector, crop or livestock activity, geography, production cycle, seasonality, domestic/export mix, processing and packhouse activities, land tenure, irrigation, asset intensity, labour model, major counterparties, and foreign-currency exposure only where evidence supports the conclusion.

Connect financial movements to agricultural economics. For example, test whether margin changes plausibly relate to yield, packout, biological cycles, input inflation, labour deployment, energy-intensive irrigation or cooling, logistics, commodity pricing, crop mix, weather exposure, or timing differences. Label unsupported operational explanations as hypotheses requiring confirmation.

### 3. Analyse performance and financial position

- Calculate only ratios with reliable numerator, denominator, period, and unit inputs.
- Show the formula or derivation for every material computed value.
- Compare current year, prior year, current YTD, prior YTD, budget, and forecast where available.
- Explain when seasonality, harvest timing, biological-asset accounting, once-off items, revaluations, grants, or changes in consolidation make comparisons unreliable.
- Reconcile EBITDA, debt, working capital, and cash flow to the source data where practical. State any definition used.

### 4. Translate findings into opportunities

For each material observation, connect:

1. the financial finding;
2. the commercial implication;
3. a specific value opportunity;
4. the work an advisory team would perform;
5. an evidence-based client-value range;
6. a plausible professional-fee range; and
7. indicative ROI.

Use the opportunity catalog as a search space, not a checklist that must all appear. Combine overlapping findings into one coherent engagement when one programme would address them. Prefer a smaller set of well-supported opportunities over a long generic list.

### 5. Apply evidence and claims discipline

- Base every major finding on a traceable financial or operational source.
- Separate fact, calculation, inference, and information request.
- Do not invent tax or grant eligibility, finance availability, interest or tax rates, land or asset values, hectares, yields, customers, contracts, offtake arrangements, or export markets.
- Use `Requires confirmation` or `Potential opportunity identified - additional information required` when evidence is incomplete.
- For tax, legal, water-right, B-BBEE, grant, incentive, or regulatory matters, describe the potential review and its commercial purpose rather than giving a legal conclusion. Verify current rules from authoritative sources when the task and available tools permit; otherwise state that eligibility and treatment require confirmation.
- Treat risk reduction or funding capacity as distinct from cash savings. Do not add unlike value categories without explaining the basis.

### 6. Score, value, and price

Follow [references/evidence-scoring-value.md](references/evidence-scoring-value.md). Use ranges, show the calculation basis, and avoid false precision. Calculate opportunity ROI from range midpoints:

`((client_value_low + client_value_high) / 2) / ((fee_low + fee_high) / 2)`

Label it `Indicative ROI`; never imply a guaranteed return. Calculate portfolio ROI from the midpoint of total client value divided by the midpoint of total fees, not by averaging individual ROI figures.

### 7. Produce two coordinated deliverables

Create:

1. `valuextract-data.json` conforming to [references/report-data.schema.json](references/report-data.schema.json). This is the database-ready evidence and opportunity record.
2. `valuextract-report.html`, a polished, responsive, self-contained report following [references/report-spec.md](references/report-spec.md).

When Python is available, use the bundled standard-library renderer:

```text
python scripts/render_report.py valuextract-data.json --output valuextract-report.html
```

If the renderer cannot be run, generate equivalent self-contained HTML directly. Create a PDF only when the user requests one or the surrounding workflow requires it; preserve the HTML as the primary report.

### 8. Final quality gate

Before delivery, verify that:

- every material number agrees with the source and uses the correct period, currency, sign, and unit scale;
- every opportunity has evidence, calculation basis, priority, timeline, confidence, client-value range, fee range, and indicative ROI;
- no source page, tax treatment, grant, funder, rate, operational statistic, or contract term was invented;
- duplicate or overlapping opportunities have been consolidated;
- the report includes Agri Business Insights, Top 3 Value Creation Priorities, and only material additional-information requests with a reason for each;
- totals and ROI recalculate correctly from the opportunity records;
- the HTML remains readable on desktop, mobile, and print/PDF, with no external asset dependency; and
- the language is specific, commercial, and evidence-led rather than generic.

## Writing standard

Write findings in this pattern:

`Observed movement + quantified evidence + agricultural interpretation + practical action.`

Good analysis identifies both what changed and what an adviser would actually do next. Avoid vague advice such as "improve profitability" or "consult a specialist." Describe the review, modelling, negotiation, restructuring, implementation, or monitoring work that would convert the finding into value.
