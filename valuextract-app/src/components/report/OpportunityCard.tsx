import { formatMoney, formatRoi } from "@/lib/valuextract/calculations";
import type { OpportunityView } from "./types";

export function PriorityBadge({ priority }: { priority: string }) {
  const cls =
    priority === "HIGH" ? "badge-high" : priority === "MEDIUM" ? "badge-medium" : "badge-low";
  return (
    <span
      className={`${cls} rounded px-2 py-0.5 text-[10px] font-semibold tracking-widest uppercase`}
    >
      {priority}
    </span>
  );
}

export function OpportunityCard({
  opportunity,
  currency,
  defaultOpenEvidence = false,
}: {
  opportunity: OpportunityView;
  currency: string;
  defaultOpenEvidence?: boolean;
}) {
  const op = opportunity;
  return (
    <article
      id={`opportunity-${op.seq}`}
      className="vx-card p-5 avoid-break scroll-mt-24"
      aria-labelledby={`opportunity-title-${op.seq}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-vx-gold print-gold font-bold tabular text-sm">
          #{String(op.seq).padStart(2, "0")}
        </span>
        <PriorityBadge priority={op.priority} />
      </div>

      <h3 id={`opportunity-title-${op.seq}`} className="mt-3 text-lg font-semibold leading-snug">
        {op.opportunityName}
      </h3>
      <p className="mt-1 text-xs text-vx-muted print-muted">
        {op.serviceLine} · {op.agriCategory} · Trigger {op.triggerId}
      </p>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Metric
          label="Client value"
          value={`${formatMoney(op.clientValueLow, currency, { compact: true })} – ${formatMoney(
            op.clientValueHigh,
            currency,
            { compact: true },
          )}`}
        />
        <Metric
          label="Firm fees"
          value={`${formatMoney(op.feeLow, currency, { compact: true })} – ${formatMoney(
            op.feeHigh,
            currency,
            { compact: true },
          )}`}
        />
        <Metric label="Indicative ROI" value={formatRoi(op.roi)} accent />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-vx-muted print-muted">
        <Chip>{op.timeline}</Chip>
        <Chip>Confidence: {op.confidence}</Chip>
        <Chip>{op.valueType}</Chip>
        {op.capmatchEligible && <Chip>CapMatch eligible</Chip>}
        {op.excludedFromTotals && <Chip>Overlaps — excluded from totals</Chip>}
      </div>

      <div className="mt-5 space-y-4 text-sm leading-relaxed">
        <Block title="Finding">{op.finding}</Block>
        <Block title="Why this matters">{op.whyThisMatters}</Block>
        <Block title="How we can assist">{op.howWeCanAssist}</Block>
        <Block title="Recommended solution">{op.recommendedSolution}</Block>
        <Block title="Value proposition">{op.valueProposition}</Block>
      </div>

      {op.engagement && (
        <div className="mt-5 vx-card-2 p-4">
          <p className="vx-eyebrow print-muted">Engagement details</p>
          <dl className="mt-2 grid gap-2 sm:grid-cols-2 text-sm">
            <Pair label="Duration" value={op.engagement.duration} />
            <Pair label="Timeline" value={op.engagement.timeline} />
            <Pair label="Pricing" value={op.engagement.pricing} />
            <Pair label="Resources" value={op.engagement.resources.join(", ")} />
          </dl>
        </div>
      )}

      <details className="mt-4" open={defaultOpenEvidence}>
        <summary className="vx-eyebrow hover:text-vx-gold">
          View financial evidence ({op.evidence.length})
        </summary>
        {/* Printed output has no disclosure control, so it gets a plain heading. */}
        <p className="vx-eyebrow print-muted hidden print:block">Financial evidence</p>
        <ul className="mt-3 space-y-3">
          {op.evidence.map((item) => (
            <li key={item.id} className="vx-card-2 p-3 text-sm">
              <p className="text-xs text-vx-muted print-muted">
                {item.evidenceType} · {item.financialPeriod}
              </p>
              <p className="mt-1">{item.description}</p>
              <p className="mt-2 text-xs text-vx-muted print-muted">
                Source: {item.sourceDocument} · {item.sourceSection}
                {/* A page number is shown only when the analysis actually observed one. */}
                {item.sourcePage ? ` · Page ${item.sourcePage}` : ""}
              </p>
            </li>
          ))}
        </ul>
      </details>

      {op.calculation && (
        <details className="mt-3">
          <summary className="vx-eyebrow hover:text-vx-gold">
            Calculation and assumptions
          </summary>
          <p className="vx-eyebrow print-muted hidden print:block">
            Calculation and assumptions
          </p>
          <div className="mt-3 vx-card-2 p-3 text-sm space-y-2">
            <Pair label="Basis" value={op.calculation.basis} stacked />
            <Pair label="Formula" value={op.calculation.formula} stacked mono />
            {op.calculation.assumptions.length > 0 && (
              <div>
                <p className="vx-eyebrow print-muted">Assumptions</p>
                <ul className="mt-1 list-disc pl-5 space-y-1">
                  {op.calculation.assumptions.map((assumption, index) => (
                    <li key={index}>{assumption}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      )}

      {op.capmatchEligible && (
        <div className="mt-4 vx-card-2 p-3 text-sm">
          <p className="vx-eyebrow print-muted">CapMatch</p>
          <p className="mt-1">
            Capital requirement:{" "}
            {op.capitalRequirementLow !== null && op.capitalRequirementHigh !== null
              ? `${formatMoney(op.capitalRequirementLow, currency)} – ${formatMoney(
                  op.capitalRequirementHigh,
                  currency,
                )}`
              : "To be confirmed"}
          </p>
          {op.fundingCategories.length > 0 && (
            <p className="mt-1 text-vx-muted print-muted">
              Possible funding categories: {op.fundingCategories.join(", ")}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="vx-eyebrow print-muted">{label}</p>
      <p
        className={`mt-1 text-sm font-semibold tabular ${
          accent ? "text-vx-positive" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-vx-border px-2 py-0.5">{children}</span>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="vx-eyebrow print-muted">{title}</p>
      <p className="mt-1">{children}</p>
    </div>
  );
}

function Pair({
  label,
  value,
  stacked,
  mono,
}: {
  label: string;
  value: string;
  stacked?: boolean;
  mono?: boolean;
}) {
  return (
    <div className={stacked ? "" : "flex gap-2"}>
      <dt className="vx-eyebrow print-muted shrink-0">{label}</dt>
      <dd className={`${stacked ? "mt-1" : ""} ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
