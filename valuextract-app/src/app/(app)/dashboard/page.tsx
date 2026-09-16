import Link from "next/link";
import { desc, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  analysisJobs,
  clients,
  financialDocuments,
  valuextractAnalyses,
} from "@/lib/db/schema";
import { requirePageUser } from "@/lib/auth/guards";
import { getPublicAiConfig } from "@/lib/config/ai-config";
import { formatMoney, formatRoi } from "@/lib/valuextract/calculations";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requirePageUser("/dashboard");
  const config = await getPublicAiConfig();

  const clientRows = await db.select().from(clients).orderBy(desc(clients.createdAt));
  const analyses = await db
    .select()
    .from(valuextractAnalyses)
    .orderBy(desc(valuextractAnalyses.createdAt))
    .limit(8);
  const activeJobs = await db
    .select()
    .from(analysisJobs)
    .where(inArray(analysisJobs.status, ["QUEUED", "PROCESSING", "VALIDATING"]))
    .orderBy(desc(analysisJobs.createdAt));

  const documentCounts = new Map<string, number>();
  if (clientRows.length > 0) {
    const docs = await db
      .select({ clientId: financialDocuments.clientId })
      .from(financialDocuments);
    for (const doc of docs) {
      documentCounts.set(doc.clientId, (documentCounts.get(doc.clientId) ?? 0) + 1);
    }
  }

  const clientNames = new Map(clientRows.map((c) => [c.id, c.name]));

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 space-y-10">
      <header>
        <p className="vx-eyebrow">ValueXtract Agri</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Convert agricultural financial information into actionable client value.
        </h1>
        <div className="vx-gold-rule mt-4" />
      </header>

      {config.status === "CONFIGURATION_REQUIRED" && (
        <div className="vx-card p-5 border-vx-gold/40">
          <div className="flex items-start gap-3">
            <span className="mt-1.5 h-2 w-2 rounded-full bg-vx-gold shrink-0" />
            <div>
              <p className="font-semibold">Configuration required</p>
              <p className="mt-1 text-sm text-vx-muted">
                {config.apiKeyConfigured
                  ? "The ValueXtract Agri Skill has not been configured yet."
                  : "ValueXtract is not connected to Anthropic yet."}{" "}
                {user.role === "ADMIN" ? (
                  <Link href="/admin/ai" className="text-vx-gold underline">
                    Open AI configuration
                  </Link>
                ) : (
                  "Ask an administrator to complete the AI configuration."
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Clients" value={String(clientRows.length)} />
        <Stat label="Analyses" value={String(analyses.length)} />
        <Stat label="Running now" value={String(activeJobs.length)} />
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Clients</h2>
          <Link
            href="/clients/new"
            className="rounded-lg bg-vx-gold px-3 py-1.5 text-xs font-semibold text-vx-navy hover:bg-vx-gold-light"
          >
            New client
          </Link>
        </div>
        {clientRows.length === 0 ? (
          <div className="vx-card p-8 text-center text-sm text-vx-muted">
            No clients yet. Create one to upload financial information.
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {clientRows.slice(0, 9).map((client) => (
              <li key={client.id}>
                <Link
                  href={`/clients/${client.id}/valuextract-agri`}
                  className="vx-card block p-4 hover:border-vx-gold/50 transition-colors"
                >
                  <p className="font-semibold">{client.name}</p>
                  <p className="mt-1 text-xs text-vx-muted">
                    {client.subsector || "Agriculture"} ·{" "}
                    {documentCounts.get(client.id) ?? 0} document
                    {(documentCounts.get(client.id) ?? 0) === 1 ? "" : "s"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">Recent analyses</h2>
        {analyses.length === 0 ? (
          <div className="vx-card p-8 text-center text-sm text-vx-muted">
            No analyses have been run yet.
          </div>
        ) : (
          <div className="vx-card scroll-x">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-vx-muted border-b border-vx-border">
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Version</th>
                  <th className="px-4 py-3 font-medium text-right">Client value</th>
                  <th className="px-4 py-3 font-medium text-right">ROI</th>
                  <th className="px-4 py-3 font-medium text-right">Opportunities</th>
                  <th className="px-4 py-3 font-medium">Run</th>
                </tr>
              </thead>
              <tbody>
                {analyses.map((analysis) => (
                  <tr
                    key={analysis.id}
                    className="border-b border-vx-border-soft last:border-0"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/analyses/${analysis.id}`}
                        className="hover:text-vx-gold"
                      >
                        {clientNames.get(analysis.clientId) ?? analysis.clientName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-vx-muted">v{analysis.versionNo}</td>
                    <td className="px-4 py-3 text-right tabular">
                      {formatMoney(analysis.clientValueLow, analysis.currency, {
                        compact: true,
                      })}{" "}
                      –{" "}
                      {formatMoney(analysis.clientValueHigh, analysis.currency, {
                        compact: true,
                      })}
                    </td>
                    <td className="px-4 py-3 text-right tabular text-vx-positive">
                      {formatRoi(analysis.overallRoi)}
                    </td>
                    <td className="px-4 py-3 text-right tabular">
                      {analysis.opportunityCount}
                    </td>
                    <td className="px-4 py-3 text-vx-muted">
                      {formatDate(analysis.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="vx-card p-5">
      <p className="vx-eyebrow">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular">{value}</p>
    </div>
  );
}
