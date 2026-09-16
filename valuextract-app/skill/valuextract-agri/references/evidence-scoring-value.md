# Evidence, scoring, valuation, and pricing

Use this reference for every opportunity promoted into the final report. The objective is a commercially useful estimate with transparent uncertainty, not an impressive but unsupported number.

## 1. Evidence ledger

Maintain a structured ledger throughout the analysis. Each opportunity record must contain:

- `trigger_id`: stable unique identifier such as `VX-AGRI-001`;
- `opportunity_name`;
- `service_line`;
- `agri_category`;
- `financial_evidence`: one or more evidence records;
- `financial_period` for each evidence record;
- `source_document`, `source_section`, and genuine `source_page` if visible;
- `calculation`: concise derivation and assumptions;
- `client_value_low` and `client_value_high`;
- `fee_low` and `fee_high`;
- `roi` calculated from range midpoints;
- `priority`, `timeline`, and `confidence`.

Evidence records should distinguish:

- **Fact:** directly stated in a source.
- **Calculation:** derived from cited facts with a reproducible formula.
- **Inference:** a supported interpretation from multiple facts.
- **Hypothesis:** a possible explanation requiring more information.

Each major finding needs at least one fact or calculation. A hypothesis alone belongs in the additional-information section, not as a fully scored opportunity.

## 2. Source references

Record the source at the most precise level genuinely available:

```text
Annual Financial Statements FY2025
Note 12 - Borrowings
Page 34
```

or:

```text
Management Accounts - July 2025 YTD
Detailed Income Statement
Electricity expense
```

Use `null` for an unavailable page. Never infer pagination after extracting text or converting a document. If documents conflict, cite both and explain which was used.

## 3. Confidence

Confidence measures evidence strength, not opportunity attractiveness.

- **High:** the source directly shows the condition and the calculation is reproducible with little interpretive uncertainty.
- **Medium:** multiple observations support the inference, but an operational driver, term, or assumption still needs confirmation.
- **Low:** a plausible opportunity is indicated, but important evidence is missing. Use cautious language and identify the exact confirmation needed.

Do not use high confidence for tax eligibility, grant availability, finance approval, legal status, market value, or technical savings unless the relevant current criteria and underlying records have actually been tested.

## 4. Priority

Assign one label after considering magnitude, immediacy, financial or operational risk, implementation feasibility, evidence strength, and strategic importance:

- **High:** material and time-sensitive, with a credible near-term action or risk response.
- **Medium:** meaningful value or risk but less urgent, less certain, or dependent on preparatory work.
- **Low:** smaller, longer-dated, or conditional; retain only when it remains commercially useful.

Priority is not a simple ranking by value. A moderate-value liquidity action can outrank a large but speculative strategic option.

## 5. Timeline

Use the time to reach an actionable outcome, not merely to hold a first meeting:

- **Quick:** 0-3 months.
- **Medium:** 3-9 months.
- **Strategic:** 9+ months.

Where implementation spans phases, select the timeframe for the principal value event and describe quick preparatory actions separately.

## 6. Client-value ranges

Every reported opportunity requires a defensible low and high range. If no supportable range can be developed, keep the item as a potential opportunity or information request rather than manufacturing a value.

Possible value mechanisms:

- recurring or once-off tax savings subject to confirmed treatment;
- interest and bank-fee savings;
- procurement, labour, energy, logistics, wastage, and operating savings;
- margin or revenue improvement supported by a driver model;
- working capital released;
- asset-value optimisation;
- risk reduction expressed as scenario-weighted avoided loss, clearly labelled;
- funding enabled, separately labelled as capital access rather than profit.

### Range construction

1. Define the value base from cited evidence: expense, debt balance, working-capital balance, volume, margin gap, capex, or exposure.
2. Define the improvement driver and period.
3. Create a conservative low case and a reasonable high case using explicit assumptions.
4. Distinguish recurring annual value, once-off value, cash release, capital raised, and avoided-risk value.
5. Apply implementation timing, ramp-up, probability, cost, tax, or overlap adjustments where relevant.
6. Round to a level consistent with source precision.

Example derivations:

- procurement: `addressable spend x supported savings percentage`, net of implementation cost;
- interest: `refinanceable principal x supported rate differential x applicable period`, plus verified fee differences;
- working capital: `reduction in days / days in period x relevant revenue or cost base`;
- margin: `supported incremental gross-margin percentage x relevant revenue`, adjusted for volume and delivery cost;
- energy: `verified baseline consumption x tariff x modelled reduction`, net of operating cost and with capex treated separately;
- risk: `exposure x probability change x loss severity`, shown as scenario value rather than guaranteed savings.

Never select a savings percentage, rate differential, probability, yield, tariff, or asset value merely because it is common in the market. Cite a supplied benchmark, obtain an authoritative current source, or label the input as an assumption requiring validation.

## 7. Professional-fee ranges

Estimate a commercially plausible low and high fee proportional to scope, duration, seniority, specialist involvement, data quality, number of entities or sites, implementation responsibility, and transaction complexity.

Support one of these structures:

- fixed project fee;
- monthly or recurring retainer;
- success fee;
- transaction percentage;
- hybrid structure.

Build fees from the firm's rate card when available. Otherwise state the assumed delivery team, effort, and pricing basis. Do not portray an illustrative fee as the firm's approved quote. Avoid a success fee where independence, regulation, or the nature of the work makes it inappropriate.

## 8. Indicative ROI

For each opportunity:

```text
client midpoint = (client_value_low + client_value_high) / 2
fee midpoint    = (fee_low + fee_high) / 2
Indicative ROI  = client midpoint / fee midpoint
```

For the report summary:

```text
portfolio client midpoint = (sum of lows + sum of highs) / 2
portfolio fee midpoint    = (sum of fee lows + sum of fee highs) / 2
overall indicative ROI    = portfolio client midpoint / portfolio fee midpoint
```

Do not average opportunity ROI figures. Avoid double-counting by valuing only incremental benefits after consolidating overlapping engagements. Label all ROI as indicative and explain whether value is annual, once-off, cash release, funding enabled, or risk-adjusted.

## 9. Duplicate control

Before final scoring, cluster opportunities by:

- root cause;
- decision maker;
- implementation work;
- value mechanism;
- required evidence; and
- service team.

Merge records that are effectively the same engagement. For example, cost reduction, profitability improvement, margin recovery, and expense optimisation generally belong in one Farm Profitability & Cost Optimisation Programme when they share the same evidence and work plan.

Do not merge genuinely distinct work solely because it uses the same service line. A debt restructure and an FX treasury programme may remain separate even if both involve corporate finance.

## 10. Additional information requested

Request only information that could materially change an opportunity, range, confidence, priority, or recommendation. For each item, state why it matters.

Common requests include hectares under production, crop and variety mix, yield per hectare, packout, export percentage, major customers, offtake agreements, facility terms and rates, asset register and valuations, electricity consumption and tariffs, irrigation infrastructure, water-right documentation, insurance schedule, budget, rolling cash flow, and FX exposure.

Avoid a generic data-room checklist. Rank requests by decision value and connect each to a specific unresolved question.

## 11. Top three priorities

Select the three opportunities with the strongest combined client value, speed, probability of success, evidence strength, and strategic importance. Explain the choice in one or two sentences each. Do not automatically choose the three largest value ranges.

## 12. Claims and professional boundaries

- Use the report as an opportunity diagnostic, not an audit opinion, valuation certificate, financing offer, legal opinion, tax ruling, or guaranteed savings case.
- Do not assert eligibility, compliance, availability, value, or approval without the evidence that would support that conclusion.
- Identify assumptions and limitations close to the relevant result.
- Keep client documents and extracted data within the user's authorised environment; do not send them to third parties unless the user explicitly directs it.
