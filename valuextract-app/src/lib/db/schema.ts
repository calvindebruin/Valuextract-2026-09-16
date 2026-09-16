import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

/* ------------------------------------------------------------------ users */

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: text("role", { enum: ["ADMIN", "USER"] })
      .notNull()
      .default("USER"),
    passwordHash: text("password_hash").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

/* --------------------------------------------------------------- settings */

/**
 * Generic key/value application settings. Secret values are stored in
 * `value_encrypted` (AES-256-GCM) and are never serialised to the browser.
 */
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value"),
  valueEncrypted: text("value_encrypted"),
  updatedAt: text("updated_at").notNull().default(now),
  updatedBy: text("updated_by"),
});

/* ---------------------------------------------------------------- clients */

export const clients = sqliteTable(
  "clients",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    industry: text("industry").notNull().default("Agriculture"),
    subsector: text("subsector"),
    financialYearEnd: text("financial_year_end"),
    currency: text("currency").notNull().default("ZAR"),
    registrationNumber: text("registration_number"),
    notes: text("notes"),
    isAgri: integer("is_agri", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(now),
    createdBy: text("created_by").references(() => users.id),
  },
  (t) => [index("clients_name_idx").on(t.name)],
);

/* -------------------------------------------------------------- documents */

export const documentCategories = [
  "ANNUAL_FINANCIAL_STATEMENTS",
  "MANAGEMENT_ACCOUNTS",
  "SUPPORTING_INFORMATION",
] as const;

export const financialDocuments = sqliteTable(
  "financial_documents",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    category: text("category", { enum: documentCategories }).notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storagePath: text("storage_path").notNull(),
    checksum: text("checksum").notNull(),
    /** Cached Anthropic Files API id so a document is uploaded once, not per run. */
    anthropicFileId: text("anthropic_file_id"),
    anthropicFileUploadedAt: text("anthropic_file_uploaded_at"),
    periodLabel: text("period_label"),
    uploadedAt: text("uploaded_at").notNull().default(now),
    uploadedBy: text("uploaded_by").references(() => users.id),
  },
  (t) => [index("documents_client_idx").on(t.clientId)],
);

/* ---------------------------------------------------------- analysis jobs */

export const analysisJobStatuses = [
  "UPLOADED",
  "QUEUED",
  "PROCESSING",
  "VALIDATING",
  "COMPLETED",
  "FAILED",
] as const;

export const analysisJobs = sqliteTable(
  "analysis_jobs",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    sector: text("sector").notNull().default("Agriculture"),
    status: text("status", { enum: analysisJobStatuses }).notNull().default("QUEUED"),
    /** Coarse, honest stage marker. Never a fabricated progress percentage. */
    stage: text("stage"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    skillId: text("skill_id"),
    skillVersion: text("skill_version"),
    resolvedSkillVersion: text("resolved_skill_version"),
    model: text("model"),
    codeExecutionTool: text("code_execution_tool"),
    containerId: text("container_id"),
    versionNo: integer("version_no").notNull().default(1),
    supersedesAnalysisId: text("supersedes_analysis_id"),
    createdAt: text("created_at").notNull().default(now),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    createdBy: text("created_by").references(() => users.id),
  },
  (t) => [index("jobs_client_idx").on(t.clientId), index("jobs_status_idx").on(t.status)],
);

export const analysisJobDocuments = sqliteTable(
  "analysis_job_documents",
  {
    jobId: text("job_id")
      .notNull()
      .references(() => analysisJobs.id, { onDelete: "cascade" }),
    documentId: text("document_id")
      .notNull()
      .references(() => financialDocuments.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.jobId, t.documentId] })],
);

/* ------------------------------------------------------------- analyses */

export const valuextractAnalyses = sqliteTable(
  "valuextract_analyses",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => analysisJobs.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    versionNo: integer("version_no").notNull().default(1),

    // client block (as reported by the analysis, not the CRM record)
    clientName: text("client_name").notNull(),
    industry: text("industry").notNull(),
    period: text("period").notNull(),
    documentType: text("document_type").notNull(),
    currency: text("currency").notNull(),
    reportDate: text("report_date"),

    // analysis_scope
    scopeNote: text("scope_note").notNull().default(""),
    documentsJson: text("documents_json").notNull().default("[]"),
    entitiesJson: text("entities_json").notNull().default("[]"),
    periodsJson: text("periods_json").notNull().default("[]"),

    // narrative arrays
    agriInsightsJson: text("agri_insights_json").notNull().default("[]"),
    basisAndLimitationsJson: text("basis_and_limitations_json").notNull().default("[]"),
    topPrioritiesJson: text("top_priorities_json").notNull().default("[]"),

    // deterministic totals recomputed in application code
    clientValueLow: real("client_value_low").notNull().default(0),
    clientValueHigh: real("client_value_high").notNull().default(0),
    feeLow: real("fee_low").notNull().default(0),
    feeHigh: real("fee_high").notNull().default(0),
    overallRoi: real("overall_roi"),
    opportunityCount: integer("opportunity_count").notNull().default(0),

    // provenance — makes a historical report reproducible
    skillId: text("skill_id"),
    skillVersion: text("skill_version"),
    model: text("model"),

    isArchived: integer("is_archived", { mode: "boolean" }).notNull().default(false),
    rawResponsePath: text("raw_response_path"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [
    index("analyses_client_idx").on(t.clientId),
    uniqueIndex("analyses_job_idx").on(t.jobId),
  ],
);

export const valuextractOpportunities = sqliteTable(
  "valuextract_opportunities",
  {
    id: text("id").primaryKey(),
    analysisId: text("analysis_id")
      .notNull()
      .references(() => valuextractAnalyses.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),

    triggerId: text("trigger_id").notNull(),
    opportunityName: text("opportunity_name").notNull(),
    serviceLine: text("service_line").notNull(),
    agriCategory: text("agri_category").notNull(),

    finding: text("finding").notNull(),
    whyThisMatters: text("why_this_matters").notNull(),
    howWeCanAssist: text("how_we_can_assist").notNull(),
    recommendedSolution: text("recommended_solution").notNull(),
    valueProposition: text("value_proposition").notNull(),

    engagementJson: text("engagement_json").notNull(),
    calculationJson: text("calculation_json").notNull(),

    clientValueLow: real("client_value_low").notNull(),
    clientValueHigh: real("client_value_high").notNull(),
    valueType: text("value_type").notNull(),
    feeLow: real("fee_low").notNull(),
    feeHigh: real("fee_high").notNull(),
    /** Recomputed from range midpoints in application code, never trusted from the model. */
    roi: real("roi"),
    modelReportedRoi: real("model_reported_roi"),

    priority: text("priority").notNull(),
    timeline: text("timeline").notNull(),
    confidence: text("confidence").notNull(),

    /** Overlap control: opportunities sharing a group are counted once in totals. */
    overlapGroup: text("overlap_group"),
    excludedFromTotals: integer("excluded_from_totals", { mode: "boolean" })
      .notNull()
      .default(false),

    // taxonomy hook — populated later by matchTriggersToTaxonomy()
    taxonomyMatchJson: text("taxonomy_match_json"),

    // CapMatch readiness
    capmatchEligible: integer("capmatch_eligible", { mode: "boolean" })
      .notNull()
      .default(false),
    capitalRequirementLow: real("capital_requirement_low"),
    capitalRequirementHigh: real("capital_requirement_high"),
    possibleFundingCategoriesJson: text("possible_funding_categories_json"),
  },
  (t) => [index("opportunities_analysis_idx").on(t.analysisId)],
);

export const opportunityEvidence = sqliteTable(
  "opportunity_evidence",
  {
    id: text("id").primaryKey(),
    opportunityId: text("opportunity_id")
      .notNull()
      .references(() => valuextractOpportunities.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    evidenceType: text("evidence_type").notNull(),
    description: text("description").notNull(),
    financialPeriod: text("financial_period").notNull(),
    sourceDocument: text("source_document").notNull(),
    sourceSection: text("source_section").notNull(),
    /** Null when the model could not observe a real page number. Never invented. */
    sourcePage: text("source_page"),
  },
  (t) => [index("evidence_opportunity_idx").on(t.opportunityId)],
);

export const analysisInformationRequests = sqliteTable(
  "analysis_information_requests",
  {
    id: text("id").primaryKey(),
    analysisId: text("analysis_id")
      .notNull()
      .references(() => valuextractAnalyses.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    item: text("item").notNull(),
    why: text("why").notNull(),
    relatedTriggerId: text("related_trigger_id"),
    resolvedByDocumentId: text("resolved_by_document_id").references(
      () => financialDocuments.id,
    ),
  },
  (t) => [index("info_requests_analysis_idx").on(t.analysisId)],
);

/* ------------------------------------------------------------ usage / logs */

export const analysisUsage = sqliteTable("analysis_usage", {
  id: text("id").primaryKey(),
  jobId: text("job_id")
    .notNull()
    .references(() => analysisJobs.id, { onDelete: "cascade" }),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
  cacheCreationTokens: integer("cache_creation_tokens").notNull().default(0),
  serverToolRequests: integer("server_tool_requests").notNull().default(0),
  apiCalls: integer("api_calls").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  /** Null unless a pricing table has been configured. Never hard-coded. */
  estimatedCost: real("estimated_cost"),
  costCurrency: text("cost_currency"),
  createdAt: text("created_at").notNull().default(now),
});

export const apiRequestLog = sqliteTable(
  "api_request_log",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    detail: text("detail"),
    durationMs: integer("duration_ms"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("api_log_created_idx").on(t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type FinancialDocument = typeof financialDocuments.$inferSelect;
export type AnalysisJob = typeof analysisJobs.$inferSelect;
export type ValuextractAnalysis = typeof valuextractAnalyses.$inferSelect;
export type ValuextractOpportunity = typeof valuextractOpportunities.$inferSelect;
export type OpportunityEvidence = typeof opportunityEvidence.$inferSelect;
export type AnalysisInformationRequest = typeof analysisInformationRequests.$inferSelect;
export type DocumentCategory = (typeof documentCategories)[number];
export type AnalysisJobStatus = (typeof analysisJobStatuses)[number];
