import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients, financialDocuments, valuextractAnalyses } from "@/lib/db/schema";
import { requirePageUser } from "@/lib/auth/guards";
import { getPublicAiConfig } from "@/lib/config/ai-config";
import { findActiveJob } from "@/lib/jobs/runner";
import { AnalysisWorkspace } from "@/components/analysis/AnalysisWorkspace";

export const dynamic = "force-dynamic";

export default async function ValuextractAgriPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  await requirePageUser();
  const { clientId } = await params;

  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!client) notFound();

  const documents = await db
    .select()
    .from(financialDocuments)
    .where(eq(financialDocuments.clientId, clientId))
    .orderBy(financialDocuments.uploadedAt);

  const analyses = await db
    .select()
    .from(valuextractAnalyses)
    .where(eq(valuextractAnalyses.clientId, clientId))
    .orderBy(desc(valuextractAnalyses.createdAt));

  const activeJob = await findActiveJob(clientId);
  const config = await getPublicAiConfig();

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 space-y-8">
      <header>
        <nav className="text-xs text-vx-muted mb-4">
          <Link href="/clients" className="hover:text-vx-text">
            Clients
          </Link>
          <span className="mx-2">/</span>
          <span>{client.name}</span>
        </nav>
        <p className="vx-eyebrow">ValueXtract Agri</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{client.name}</h1>
        <p className="mt-2 text-sm text-vx-muted max-w-2xl">
          Convert agricultural financial information into actionable client value.
        </p>
        <div className="vx-gold-rule mt-4" />
      </header>

      <section className="vx-card p-5">
        <h2 className="vx-eyebrow mb-4">Client details</h2>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <Detail label="Client name" value={client.name} />
          <Detail label="Industry" value={client.industry} />
          <Detail label="Agricultural subsector" value={client.subsector || "To be determined"} />
          <Detail label="Financial year" value={client.financialYearEnd || "To be determined"} />
          <Detail label="Currency" value={client.currency} />
          <Detail label="Registration number" value={client.registrationNumber || "—"} />
        </dl>
      </section>

      <AnalysisWorkspace
        clientId={client.id}
        initialDocuments={documents.map((d) => ({
          id: d.id,
          category: d.category,
          filename: d.filename,
          mimeType: d.mimeType,
          sizeBytes: d.sizeBytes,
          periodLabel: d.periodLabel,
          uploadedAt: d.uploadedAt,
        }))}
        initialJobId={activeJob?.id ?? null}
        configReady={config.status === "CONNECTED_PENDING_TEST"}
        configMessage={
          config.apiKeyConfigured
            ? "The ValueXtract Agri Skill has not been configured yet."
            : "ValueXtract is not connected to Anthropic yet."
        }
        analyses={analyses.map((a) => ({
          id: a.id,
          versionNo: a.versionNo,
          createdAt: a.createdAt,
          isArchived: a.isArchived,
          opportunityCount: a.opportunityCount,
        }))}
      />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="vx-eyebrow">{label}</dt>
      <dd className="mt-1">{value}</dd>
    </div>
  );
}
