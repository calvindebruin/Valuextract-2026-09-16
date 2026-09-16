import "server-only";
import { sqlite } from "./index";

/**
 * Plain-SQL migrations applied at boot. Kept explicit and additive so the
 * schema is auditable and so a Postgres port is a mechanical translation.
 */
const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: "0001_init",
    sql: `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'USER',
  password_hash TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  value_encrypted TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  industry TEXT NOT NULL DEFAULT 'Agriculture',
  subsector TEXT,
  financial_year_end TEXT,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  registration_number TEXT,
  notes TEXT,
  is_agri INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_by TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS clients_name_idx ON clients(name);

CREATE TABLE IF NOT EXISTS financial_documents (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  checksum TEXT NOT NULL,
  anthropic_file_id TEXT,
  anthropic_file_uploaded_at TEXT,
  period_label TEXT,
  uploaded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  uploaded_by TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS documents_client_idx ON financial_documents(client_id);

CREATE TABLE IF NOT EXISTS analysis_jobs (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  sector TEXT NOT NULL DEFAULT 'Agriculture',
  status TEXT NOT NULL DEFAULT 'QUEUED',
  stage TEXT,
  error_code TEXT,
  error_message TEXT,
  skill_id TEXT,
  skill_version TEXT,
  resolved_skill_version TEXT,
  model TEXT,
  code_execution_tool TEXT,
  container_id TEXT,
  version_no INTEGER NOT NULL DEFAULT 1,
  supersedes_analysis_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  started_at TEXT,
  completed_at TEXT,
  created_by TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS jobs_client_idx ON analysis_jobs(client_id);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON analysis_jobs(status);

CREATE TABLE IF NOT EXISTS analysis_job_documents (
  job_id TEXT NOT NULL REFERENCES analysis_jobs(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES financial_documents(id) ON DELETE CASCADE,
  PRIMARY KEY (job_id, document_id)
);

CREATE TABLE IF NOT EXISTS valuextract_analyses (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES analysis_jobs(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL DEFAULT 1,
  client_name TEXT NOT NULL,
  industry TEXT NOT NULL,
  period TEXT NOT NULL,
  document_type TEXT NOT NULL,
  currency TEXT NOT NULL,
  report_date TEXT,
  scope_note TEXT NOT NULL DEFAULT '',
  documents_json TEXT NOT NULL DEFAULT '[]',
  entities_json TEXT NOT NULL DEFAULT '[]',
  periods_json TEXT NOT NULL DEFAULT '[]',
  agri_insights_json TEXT NOT NULL DEFAULT '[]',
  basis_and_limitations_json TEXT NOT NULL DEFAULT '[]',
  top_priorities_json TEXT NOT NULL DEFAULT '[]',
  client_value_low REAL NOT NULL DEFAULT 0,
  client_value_high REAL NOT NULL DEFAULT 0,
  fee_low REAL NOT NULL DEFAULT 0,
  fee_high REAL NOT NULL DEFAULT 0,
  overall_roi REAL,
  opportunity_count INTEGER NOT NULL DEFAULT 0,
  skill_id TEXT,
  skill_version TEXT,
  model TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0,
  raw_response_path TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS analyses_client_idx ON valuextract_analyses(client_id);
CREATE UNIQUE INDEX IF NOT EXISTS analyses_job_idx ON valuextract_analyses(job_id);

CREATE TABLE IF NOT EXISTS valuextract_opportunities (
  id TEXT PRIMARY KEY,
  analysis_id TEXT NOT NULL REFERENCES valuextract_analyses(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  trigger_id TEXT NOT NULL,
  opportunity_name TEXT NOT NULL,
  service_line TEXT NOT NULL,
  agri_category TEXT NOT NULL,
  finding TEXT NOT NULL,
  why_this_matters TEXT NOT NULL,
  how_we_can_assist TEXT NOT NULL,
  recommended_solution TEXT NOT NULL,
  value_proposition TEXT NOT NULL,
  engagement_json TEXT NOT NULL,
  calculation_json TEXT NOT NULL,
  client_value_low REAL NOT NULL,
  client_value_high REAL NOT NULL,
  value_type TEXT NOT NULL,
  fee_low REAL NOT NULL,
  fee_high REAL NOT NULL,
  roi REAL,
  model_reported_roi REAL,
  priority TEXT NOT NULL,
  timeline TEXT NOT NULL,
  confidence TEXT NOT NULL,
  overlap_group TEXT,
  excluded_from_totals INTEGER NOT NULL DEFAULT 0,
  taxonomy_match_json TEXT,
  capmatch_eligible INTEGER NOT NULL DEFAULT 0,
  capital_requirement_low REAL,
  capital_requirement_high REAL,
  possible_funding_categories_json TEXT
);
CREATE INDEX IF NOT EXISTS opportunities_analysis_idx ON valuextract_opportunities(analysis_id);

CREATE TABLE IF NOT EXISTS opportunity_evidence (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT NOT NULL REFERENCES valuextract_opportunities(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  evidence_type TEXT NOT NULL,
  description TEXT NOT NULL,
  financial_period TEXT NOT NULL,
  source_document TEXT NOT NULL,
  source_section TEXT NOT NULL,
  source_page TEXT
);
CREATE INDEX IF NOT EXISTS evidence_opportunity_idx ON opportunity_evidence(opportunity_id);

CREATE TABLE IF NOT EXISTS analysis_information_requests (
  id TEXT PRIMARY KEY,
  analysis_id TEXT NOT NULL REFERENCES valuextract_analyses(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  item TEXT NOT NULL,
  why TEXT NOT NULL,
  related_trigger_id TEXT,
  resolved_by_document_id TEXT REFERENCES financial_documents(id)
);
CREATE INDEX IF NOT EXISTS info_requests_analysis_idx ON analysis_information_requests(analysis_id);

CREATE TABLE IF NOT EXISTS analysis_usage (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES analysis_jobs(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
  server_tool_requests INTEGER NOT NULL DEFAULT 0,
  api_calls INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  estimated_cost REAL,
  cost_currency TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS api_request_log (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  detail TEXT,
  duration_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`,
  },
];

let applied = false;

export function runMigrations(): void {
  if (applied) return;
  sqlite.exec(
    `CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`,
  );
  const seen = new Set(
    sqlite
      .prepare(`SELECT id FROM _migrations`)
      .all()
      .map((r) => (r as { id: string }).id),
  );
  for (const migration of MIGRATIONS) {
    if (seen.has(migration.id)) continue;
    sqlite.exec("BEGIN");
    try {
      sqlite.exec(migration.sql);
      sqlite
        .prepare(`INSERT INTO _migrations (id, applied_at) VALUES (?, ?)`)
        .run(migration.id, new Date().toISOString());
      sqlite.exec("COMMIT");
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    }
  }
  applied = true;
}
