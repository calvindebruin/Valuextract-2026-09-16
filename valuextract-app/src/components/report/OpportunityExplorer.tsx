"use client";

import { useMemo, useState } from "react";
import { formatMoney, formatRoi } from "@/lib/valuextract/calculations";
import { OpportunityCard, PriorityBadge } from "./OpportunityCard";
import type { OpportunityView } from "./types";

const ALL = "__all__";

export function OpportunityExplorer({
  opportunities,
  currency,
}: {
  opportunities: OpportunityView[];
  currency: string;
}) {
  const [serviceLine, setServiceLine] = useState(ALL);
  const [priority, setPriority] = useState(ALL);
  const [timeline, setTimeline] = useState(ALL);
  const [confidence, setConfidence] = useState(ALL);

  const options = useMemo(
    () => ({
      serviceLines: unique(opportunities.map((o) => o.serviceLine)),
      priorities: unique(opportunities.map((o) => o.priority)),
      timelines: unique(opportunities.map((o) => o.timeline)),
      confidences: unique(opportunities.map((o) => o.confidence)),
    }),
    [opportunities],
  );

  const filtered = useMemo(
    () =>
      opportunities.filter(
        (o) =>
          (serviceLine === ALL || o.serviceLine === serviceLine) &&
          (priority === ALL || o.priority === priority) &&
          (timeline === ALL || o.timeline === timeline) &&
          (confidence === ALL || o.confidence === confidence),
      ),
    [opportunities, serviceLine, priority, timeline, confidence],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-semibold tracking-tight">
          Advisory Opportunities ({filtered.length}
          {filtered.length !== opportunities.length ? ` of ${opportunities.length}` : ""})
        </h2>
        <div className="no-print flex flex-wrap gap-2">
          <Select
            label="All Service Lines"
            value={serviceLine}
            onChange={setServiceLine}
            options={options.serviceLines}
          />
          <Select
            label="All Priorities"
            value={priority}
            onChange={setPriority}
            options={options.priorities}
          />
          <Select
            label="All Timelines"
            value={timeline}
            onChange={setTimeline}
            options={options.timelines}
          />
          <Select
            label="All Confidence Levels"
            value={confidence}
            onChange={setConfidence}
            options={options.confidences}
          />
        </div>
      </div>

      <div className="vx-card scroll-x">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-vx-muted print-muted border-b border-vx-border">
              <th className="px-4 py-3 font-medium">Opportunity</th>
              <th className="px-4 py-3 font-medium">Service line</th>
              <th className="px-4 py-3 font-medium text-right">Client value</th>
              <th className="px-4 py-3 font-medium text-right">Firm fees</th>
              <th className="px-4 py-3 font-medium text-right">ROI</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Timeline</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((op) => (
              <tr
                key={op.id}
                className="border-b border-vx-border-soft last:border-0 hover:bg-vx-card-2/60 cursor-pointer"
                onClick={() => {
                  document
                    .getElementById(`opportunity-${op.seq}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                <td className="px-4 py-3">
                  <span className="text-vx-gold print-gold tabular mr-2">
                    #{String(op.seq).padStart(2, "0")}
                  </span>
                  {op.opportunityName}
                </td>
                <td className="px-4 py-3 text-vx-muted print-muted">{op.serviceLine}</td>
                <td className="px-4 py-3 text-right tabular">
                  {formatMoney(op.clientValueLow, currency, { compact: true })} –{" "}
                  {formatMoney(op.clientValueHigh, currency, { compact: true })}
                </td>
                <td className="px-4 py-3 text-right tabular">
                  {formatMoney(op.feeLow, currency, { compact: true })} –{" "}
                  {formatMoney(op.feeHigh, currency, { compact: true })}
                </td>
                <td className="px-4 py-3 text-right tabular text-vx-positive">
                  {formatRoi(op.roi)}
                </td>
                <td className="px-4 py-3">
                  <PriorityBadge priority={op.priority} />
                </td>
                <td className="px-4 py-3 text-vx-muted print-muted">{op.timeline}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-vx-muted">
                  No opportunities match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {filtered.map((op) => (
          <OpportunityCard key={op.id} opportunity={op} currency={currency} />
        ))}
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-lg bg-vx-card-2 border border-vx-border px-3 py-1.5 text-xs outline-none focus:border-vx-gold"
    >
      <option value={ALL}>{label}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}
