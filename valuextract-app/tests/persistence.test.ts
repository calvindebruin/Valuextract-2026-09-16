import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

// A throwaway database per run, configured before any module reads env.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vx-test-"));
process.env.DATABASE_URL = `file:${path.join(tmp, "test.db")}`;
process.env.STORAGE_DIR = path.join(tmp, "uploads");
process.env.APP_ENCRYPTION_KEY = "test-encryption-key-for-vitest-only";
process.env.SESSION_SECRET = "test-session-secret-for-vitest-only";

import { sampleOpportunity, sampleReport } from "./fixtures/report";

describe("analysis persistence", () => {
  let persistAnalysis: typeof import("@/lib/valuextract/persist").persistAnalysis;
  let loadAnalysis: typeof import("@/lib/valuextract/persist").loadAnalysis;
  let db: typeof import("@/lib/db").db;
  let schema: typeof import("@/lib/db/schema");

  beforeAll(async () => {
    const { runMigrations } = await import("@/lib/db/migrate");
    runMigrations();
    ({ db } = await import("@/lib/db"));
    schema = await import("@/lib/db/schema");
    ({ persistAnalysis, loadAnalysis } = await import("@/lib/valuextract/persist"));

    await db.insert(schema.clients).values({ id: "cli_test", name: "Test Boerdery" });
    await db.insert(schema.analysisJobs).values({
      id: "job_test",
      clientId: "cli_test",
      status: "VALIDATING",
    });
  });

  it("stores opportunities, evidence and information requests", async () => {
    const report = sampleReport({
      opportunities: [
        sampleOpportunity({
          // A deliberately wrong ROI from the model.
          roi: 999,
          client_value_low: 2_000_000,
          client_value_high: 4_000_000,
          fee_low: 200_000,
          fee_high: 400_000,
        }),
      ],
    });

    const analysisId = await persistAnalysis(report, {
      jobId: "job_test",
      clientId: "cli_test",
      versionNo: 1,
      skillId: "skill_01TEST",
      skillVersion: "skver_01TEST",
      model: "claude-opus-5",
    });

    const loaded = await loadAnalysis(analysisId);
    expect(loaded).not.toBeNull();
    expect(loaded!.opportunities).toHaveLength(1);
    expect(loaded!.informationRequests).toHaveLength(1);
    expect(loaded!.opportunities[0].evidence).toHaveLength(1);

    // The stored ROI is recomputed, and the model's claim is kept separately.
    expect(loaded!.opportunities[0].roi).toBe(10);
    expect(loaded!.opportunities[0].modelReportedRoi).toBe(999);

    // Totals are derived, not copied.
    expect(loaded!.clientValueLow).toBe(2_000_000);
    expect(loaded!.clientValueHigh).toBe(4_000_000);
    expect(loaded!.overallRoi).toBe(10);

    // Provenance is recorded so the report stays reproducible.
    expect(loaded!.skillId).toBe("skill_01TEST");
    expect(loaded!.skillVersion).toBe("skver_01TEST");
    expect(loaded!.model).toBe("claude-opus-5");

    // The taxonomy seam recorded an honest "unmatched" rather than a guess.
    const match = JSON.parse(loaded!.opportunities[0].taxonomyMatchJson ?? "null");
    expect(match.matched).toBe(false);
    expect(match.triggerId).toBe("AGRI_WC_01");
  });

  it("preserves a null source page instead of inventing one", async () => {
    const report = sampleReport({
      opportunities: [
        sampleOpportunity({
          trigger_id: "AGRI_NOPAGE",
          financial_evidence: [
            {
              evidence_type: "Inference",
              description: "Irrigation electricity cost inferred from the cost schedule.",
              financial_period: "FY2026",
              source_document: "Management Accounts",
              source_section: "Operating costs",
              source_page: null,
            },
          ],
        }),
      ],
    });

    await db.insert(schema.analysisJobs).values({
      id: "job_test_2",
      clientId: "cli_test",
      status: "VALIDATING",
    });

    const analysisId = await persistAnalysis(report, {
      jobId: "job_test_2",
      clientId: "cli_test",
      versionNo: 2,
      skillId: "skill_01TEST",
      skillVersion: "latest",
      model: "claude-opus-5",
    });

    const loaded = await loadAnalysis(analysisId);
    expect(loaded!.opportunities[0].evidence[0].sourcePage).toBeNull();
  });
});

describe("analysis job lifecycle", () => {
  it("blocks a second run while one is active, and allows one afterwards", async () => {
    const { db } = await import("@/lib/db");
    const schema = await import("@/lib/db/schema");
    const { createAnalysisJob, findActiveJob } = await import("@/lib/jobs/runner");
    const { eq } = await import("drizzle-orm");

    await db.insert(schema.clients).values({ id: "cli_lifecycle", name: "Lifecycle Farm" });
    await db.insert(schema.users).values({
      id: "usr_lifecycle",
      email: "lifecycle@example.com",
      name: "Lifecycle",
      passwordHash: "x",
    });
    await db.insert(schema.financialDocuments).values({
      id: "doc_lifecycle",
      clientId: "cli_lifecycle",
      category: "ANNUAL_FINANCIAL_STATEMENTS",
      filename: "afs.pdf",
      mimeType: "application/pdf",
      sizeBytes: 10,
      storagePath: "clients/cli_lifecycle/doc_lifecycle.pdf",
      checksum: "abc",
    });

    const first = await createAnalysisJob({
      clientId: "cli_lifecycle",
      documentIds: ["doc_lifecycle"],
      userId: "usr_lifecycle",
    });
    expect(first.created).toBe(true);

    // A duplicate submission returns the running job rather than starting another.
    const second = await createAnalysisJob({
      clientId: "cli_lifecycle",
      documentIds: ["doc_lifecycle"],
      userId: "usr_lifecycle",
    });
    expect(second.created).toBe(false);
    expect(second.job.id).toBe(first.job.id);

    await db
      .update(schema.analysisJobs)
      .set({ status: "COMPLETED" })
      .where(eq(schema.analysisJobs.id, first.job.id));

    expect(await findActiveJob("cli_lifecycle")).toBeNull();

    const third = await createAnalysisJob({
      clientId: "cli_lifecycle",
      documentIds: ["doc_lifecycle"],
      userId: "usr_lifecycle",
    });
    expect(third.created).toBe(true);
    expect(third.job.versionNo).toBe(2);
  });
});
