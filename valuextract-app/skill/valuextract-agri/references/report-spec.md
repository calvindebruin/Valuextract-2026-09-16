# ValueXtract Agri report specification

Generate a polished, responsive, self-contained HTML report suitable for browser viewing and conversion to PDF. The experience should feel premium, modern, minimal, and financial-services oriented—not like a generic AI dashboard.

## 1. Required page sequence

### Header

Show:

- client name as the dominant heading;
- agricultural industry/subsector;
- year-end or management-account period;
- document type(s);
- currency;
- a concise scope or limitations note when material.

### Four summary cards

Show:

1. **Client Value Range** — total low and high values after duplicate control;
2. **Firm Fee Range** — total low and high fees;
3. **Overall Indicative ROI** — portfolio midpoint client value divided by portfolio midpoint fees;
4. **Opportunities** — final opportunity count.

Do not mix currencies in a total. If reliable conversion is unavailable, create currency-specific totals.

### Agri Business Insights

Provide approximately five to ten high-value observations about profitability, seasonality, liquidity, production economics, debt, asset utilisation, working capital, export exposure, operating costs, and growth capacity. Use only the aspects supported by evidence.

### Opportunity summary table

Heading: `ADVISORY OPPORTUNITIES (X)`

Columns:

- Opportunity
- Service Line
- Client Value
- Firm Fees
- Priority
- Timeline

On small screens, keep the table accessible with horizontal scrolling or transform rows into readable blocks.

### Individual opportunity cards

Number cards `#01`, `#02`, and so on. Each card must include:

- priority badge;
- opportunity title and service line;
- client-value range;
- professional-fee range;
- `Indicative ROI`;
- confidence and timeline;
- **Finding** — exact evidence and figures;
- **Why This Matters** — financial or commercial implication;
- **How We Can Assist** — service scope;
- **Recommended Solution** — practical workplan rather than vague referral language;
- **Engagement Details** — duration, resources, timeline, and pricing structure;
- **Value Proposition** — quantified reason to act;
- **Evidence** — expandable source references where possible;
- key calculation and assumptions where useful.

### Top 3 Value Creation Priorities

Rank three opportunities using client value, speed, probability, evidence, and strategic importance. Explain each in one or two sentences.

### Additional Information Requested

List only material requests. Explain why each item matters and, where useful, the opportunity or confidence level it could change.

### Basis, assumptions, and limitations

Include a compact statement covering source scope, management-data reliance, unverified assumptions, seasonality, non-audit status, indicative valuations and fees, and the absence of guaranteed results.

## 2. Visual identity

Use these core tokens:

```css
--background: #080D14;
--card: #0D141D;
--card-secondary: #111923;
--border: #263140;
--gold: #D5A64E;
--gold-light: #E0B763;
--text: #F5F5F5;
--text-secondary: #A6AFBC;
--positive: #18D6A5;
```

Priority badges:

- high: dark red background with light red text;
- medium: dark amber background with gold text;
- low: dark green background with green text.

Use a clean modern sans-serif stack and tabular figures for numbers. Apply a near-black navy full-page background, gold header accent, subtle borders, rounded cards, and generous but efficient spacing. Keep contrast strong and body text compact and readable.

## 3. Layout behaviour

- Use four responsive summary cards.
- Use a two-column opportunity-card grid on desktop and one column on mobile.
- Keep the report useful without JavaScript; JavaScript may enhance print or disclosure behaviour but must not carry report data.
- Use semantic HTML headings, tables, lists, `details` elements for evidence, and visible focus styles.
- Avoid stock imagery, decorative charts without analytical value, excessive gradients, glow effects, glassmorphism, and generic AI-dashboard motifs.
- Keep the HTML self-contained: no CDN font, external stylesheet, external script, tracking pixel, or remote image dependency.

## 4. Print and PDF behaviour

- Include `@media print` styles that switch to a light, ink-efficient palette while preserving hierarchy.
- Avoid splitting an opportunity card across pages where practical.
- Repeat table headers, expose collapsed evidence, and remove interactive controls that do not print meaningfully.
- Preserve URLs as text only when they are relevant evidence.

## 5. Numeric presentation

- Show the supplied reporting currency prominently.
- Use grouping separators and no more precision than the source supports.
- Show range endpoints consistently.
- Display ROI to one decimal place unless that implies false precision; use `N/A` when fee midpoint is zero or missing.
- State whether values are recurring, once-off, cash release, capital enabled, or risk-adjusted when material.

## 6. Language standard

Use concrete, evidence-led language. A strong finding combines the quantified movement, its likely agricultural driver, and the action needed to test or capture value.

Avoid:

- generic statements such as `The company should improve profitability`;
- unsupported superlatives;
- legal, tax, valuation, financing, insurance, or grant conclusions beyond the evidence;
- implying that projected value or ROI is guaranteed.

Prefer language such as:

> Gross margin declined from 31.8% to 24.6% while fertiliser, labour, and electricity costs increased by R6.8 million. A farm-level profitability programme should isolate crop and block contribution margins, yield, packout, labour utilisation, and input consumption to determine where the erosion originates and which interventions are economically viable.

## 7. Renderer

The bundled renderer accepts data conforming to `references/report-data.schema.json`:

```text
python scripts/render_report.py valuextract-data.json --output valuextract-report.html
```

The renderer recalculates totals and ROI from the opportunity records. Inspect the generated report after rendering and correct the data—not the displayed total—when a number is wrong.
