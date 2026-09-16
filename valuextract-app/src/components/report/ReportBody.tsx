import { formatMoney, formatRoi } from "@/lib/valuextract/calculations";
import { OpportunityCard } from "./OpportunityCard";
import { OpportunityExplorer } from "./OpportunityExplorer";
import type { ReportView } from "./types";
import { formatDateTime } from "@/lib/format";

/**
 * The single rendering of a ValueXtract report. The interactive page and the
 * PDF print layout both render this component from the same structured data,
 * so a PDF can never disagree with what the user saw on screen.
 */
export function ReportBody({
  report,
  printMode = false,
}: {
  report: ReportView;
  printMode?: boolean;
}) {
  const currency = report.currency;
  const priorityByTrigger = new Map(
    report.opportunities.map((op) => [op.triggerId, op]),
  );

  return (
    <div className="space-y-10">
      {/* ------------------------------------------------------------ hero */}
      <header>
        <p className="vx-eyebrow print-muted">ValueXtract Agri</p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight print-text">
          {report.clientName}
        </h1>
        <div className="vx-gold-rule mt-4" />
        <p className="mt-4 text-sm text-vx-muted print-muted">
          {report.industry}
          {" · "}
          {report.period}
          {" · "}
          {report.documentType}
          {" · "}
          {currency}
          {report.reportDate ? ` · Reported ${report.reportDate}` : ""}
        </p>
        {report.scopeNote && (
          <p className="mt-3 max-w-3xl text-sm text-vx-muted print-muted">
            {report.scopeNote}
          </p>
        )}
      </header>

      {/* ----------------------------------------------------- summary cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Client value range"
          value={`${formatMoney(report.clientValueLow, currency)}`}
          secondary={`– ${formatMoney(report.clientValueHigh, currency)}`}
        />
        <SummaryCard
          label="Firm fee range"
          value={`${formatMoney(report.feeLow, currency)}`}
          secondary={`– ${formatMoney(report.feeHigh, currency)}`}
        />
        <SummaryCard
          label="Overall indicative ROI"
          value={formatRoi(report.overallRoi)}
          accent
        />
        <SummaryCard label="Opportunities" value={String(report.opportunityCount)} />
      </section>

      {/* ------------------------------------------------- agri insights */}
      {report.agriInsights.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold tracking-tight">Agri Business Insights</h2>
          <div className="vx-gold-rule mt-3 mb-4" />
          <ul className="grid gap-3 md:grid-cols-2">
            {report.agriInsights.map((insight, index) => (
              <li key={index} className="vx-card p-4 text-sm leading-relaxed avoid-break">
                {insight}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ------------------------------------------------- opportunities */}
      {/* No forced page break: opportunity cards carry `avoid-break`, which
          keeps each card whole without leaving half-empty pages behind. */}
      <section>
        {printMode ? (
          <StaticOpportunities report={report} />
        ) : (
          <OpportunityExplorer opportunities={report.opportunities} currency={currency} />
        )}
      </section>

      {/* ---------------------------------------------------- priorities */}
      {report.topPriorities.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold tracking-tight">
            Top 3 Value Creation Priorities
          </h2>
          <div className="vx-gold-rule mt-3 mb-4" />
          <ol className="space-y-3">
            {report.topPriorities.map((priority, index) => {
              const op = priorityByTrigger.get(priority.trigger_id);
              return (
                <li key={priority.trigger_id} className="vx-card p-4 avoid-break">
                  <div className="flex items-baseline gap-3">
                    <span className="text-vx-gold print-gold font-bold tabular">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-semibold">
                        {op?.opportunityName ?? priority.trigger_id}
                      </p>
                      <p className="mt-1 text-sm text-vx-muted print-muted">
                        {priority.reason}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* ------------------------------------------ information requests */}
      {report.informationRequests.length > 0 && (
        <section id="information-requests" className="scroll-mt-24">
          <h2 className="text-xl font-semibold tracking-tight">
            Additional Information Requested
          </h2>
          <div className="vx-gold-rule mt-3 mb-4" />
          <ul className="space-y-3">
            {report.informationRequests.map((request) => (
              <li key={request.id} className="vx-card p-4 avoid-break">
                <p className="font-medium text-sm">{request.item}</p>
                <p className="mt-1 text-sm text-vx-muted print-muted">{request.why}</p>
                {request.relatedTriggerId && (
                  <p className="mt-2 text-xs text-vx-muted print-muted">
                    Relates to trigger {request.relatedTriggerId}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* --------------------------------------------------------- basis */}
      {report.basisAndLimitations.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold tracking-tight">
            Basis, assumptions and limitations
          </h2>
          <div className="vx-gold-rule mt-3 mb-4" />
          <ul className="vx-card p-5 space-y-2 text-sm text-vx-muted print-muted list-disc pl-9">
            {report.basisAndLimitations.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------------------------------------------------- provenance */}
      <section className="text-xs text-vx-muted print-muted border-t border-vx-border pt-5">
        <p>
          Analysis version {report.versionNo} · Generated{" "}
          {formatDateTime(report.createdAt)}
          {report.model ? ` · Model ${report.model}` : ""}
          {report.skillVersion ? ` · Skill version ${report.skillVersion}` : ""}
        </p>
        {report.documents.length > 0 && (
          <p className="mt-1">Documents analysed: {report.documents.join("; ")}</p>
        )}
        <p className="mt-1">
          Values and fees are indicative ranges based on the supplied information. They are
          not a guarantee of results.
        </p>
      </section>
    </div>
  );
}

function StaticOpportunities({ report }: { report: ReportView }) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold tracking-tight">
        Advisory Opportunities ({report.opportunities.length})
      </h2>
      <div className="vx-card scroll-x">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-vx-muted print-muted border-b border-vx-border">
              <th className="px-3 py-2 font-medium">Opportunity</th>
              <th className="px-3 py-2 font-medium">Service line</th>
              <th className="px-3 py-2 font-medium text-right">Client value</th>
              <th className="px-3 py-2 font-medium text-right">Firm fees</th>
              <th className="px-3 py-2 font-medium">Priority</th>
              <th className="px-3 py-2 font-medium">Timeline</th>
            </tr>
          </thead>
          <tbody>
            {report.opportunities.map((op) => (
              <tr key={op.id} className="border-b border-vx-border-soft last:border-0">
                <td className="px-3 py-2">
                  #{String(op.seq).padStart(2, "0")} {op.opportunityName}
                </td>
                <td className="px-3 py-2">{op.serviceLine}</td>
                <td className="px-3 py-2 text-right tabular">
                  {formatMoney(op.clientValueLow, report.currency, { compact: true })} –{" "}
                  {formatMoney(op.clientValueHigh, report.currency, { compact: true })}
                </td>
                <td className="px-3 py-2 text-right tabular">
                  {formatMoney(op.feeLow, report.currency, { compact: true })} –{" "}
                  {formatMoney(op.feeHigh, report.currency, { compact: true })}
                </td>
                <td className="px-3 py-2">{op.priority}</td>
                <td className="px-3 py-2">{op.timeline}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-5">
        {report.opportunities.map((op) => (
          <OpportunityCard
            key={op.id}
            opportunity={op}
            currency={report.currency}
            defaultOpenEvidence
          />
        ))}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  secondary,
  accent,
}: {
  label: string;
  value: string;
  secondary?: string;
  accent?: boolean;
}) {
  return (
    <div className="vx-card p-5 avoid-break">
      <p className="vx-eyebrow print-muted">{label}</p>
      <p
        className={`mt-2 text-2xl font-bold tabular leading-tight ${
          accent ? "text-vx-positive" : "print-text"
        }`}
      >
        {value}
      </p>
      {secondary && (
        <p className="text-lg font-semibold tabular text-vx-muted print-muted leading-tight">
          {secondary}
        </p>
      )}
    </div>
  );
}
