import { getSqlite } from "./client";

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  profile_md TEXT NOT NULL DEFAULT '',
  target_filters_json TEXT NOT NULL DEFAULT '{}',
  daily_lead_count INTEGER NOT NULL DEFAULT 10,
  ai_budget_usd REAL NOT NULL DEFAULT 8,
  style_profile_json TEXT NOT NULL DEFAULT '{}',
  country_policy_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  domain TEXT,
  country TEXT,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS companies_normalized_name_idx ON companies(normalized_name);

CREATE TABLE IF NOT EXISTS signals (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  source_url TEXT NOT NULL,
  published_at TEXT,
  raw_hash TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS signals_source_external_id_idx ON signals(source, external_id);

CREATE TABLE IF NOT EXISTS source_pages (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  url TEXT NOT NULL,
  title TEXT,
  retrieved_at TEXT NOT NULL,
  content_hash TEXT,
  extraction_method TEXT,
  extracted_text TEXT,
  text_length INTEGER,
  http_status INTEGER,
  status TEXT NOT NULL,
  error TEXT,
  prompt_version TEXT,
  model_id TEXT
);

CREATE TABLE IF NOT EXISTS research_briefs (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  evidence_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_estimate REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  score REAL,
  score_breakdown_json TEXT,
  recommended_angle TEXT,
  recommended_contact_role TEXT,
  state TEXT NOT NULL DEFAULT 'new',
  reject_reason TEXT,
  research_status TEXT NOT NULL DEFAULT 'pending',
  follow_up_at TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  name TEXT,
  role TEXT,
  email TEXT,
  confidence TEXT NOT NULL DEFAULT 'manual_confirmed',
  source_url TEXT,
  manually_confirmed INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id),
  contact_id TEXT REFERENCES contacts(id),
  kind TEXT NOT NULL DEFAULT 'initial',
  subject TEXT NOT NULL,
  body_generated TEXT NOT NULL,
  body_final TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id),
  type TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  occurred_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS suppressions (
  id TEXT PRIMARY KEY,
  email TEXT,
  domain TEXT,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  checkpoint_json TEXT NOT NULL DEFAULT '{}',
  stats_json TEXT NOT NULL DEFAULT '{}',
  error TEXT
);

CREATE TABLE IF NOT EXISTS api_usage (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  task TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost REAL NOT NULL DEFAULT 0,
  occurred_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES drafts(id),
  lead_id TEXT NOT NULL REFERENCES leads(id),
  recipient_email TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  subject_snapshot TEXT NOT NULL,
  body_snapshot TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved',
  approved_at TEXT NOT NULL,
  invalidated_at TEXT,
  consumed_at TEXT
);

CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id),
  contact_id TEXT REFERENCES contacts(id),
  draft_id TEXT REFERENCES drafts(id),
  subject TEXT NOT NULL,
  rfc_message_id TEXT,
  state TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES threads(id),
  lead_id TEXT NOT NULL REFERENCES leads(id),
  direction TEXT NOT NULL,
  rfc_message_id TEXT,
  in_reply_to TEXT,
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  classification TEXT,
  classification_source TEXT,
  imap_uid INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS follow_ups (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id),
  thread_id TEXT REFERENCES threads(id),
  draft_id TEXT REFERENCES drafts(id),
  sequence INTEGER NOT NULL,
  due_at TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mail_sync_cursors (
  id TEXT PRIMARY KEY,
  mailbox TEXT NOT NULL,
  folder TEXT NOT NULL,
  uid_validity TEXT,
  last_uid INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS mail_sync_mailbox_folder_idx ON mail_sync_cursors(mailbox, folder);

CREATE TABLE IF NOT EXISTS delivery_events (
  id TEXT PRIMARY KEY,
  message_id TEXT REFERENCES messages(id),
  lead_id TEXT REFERENCES leads(id),
  event_type TEXT NOT NULL,
  detail TEXT,
  occurred_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS draft_edits (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES drafts(id),
  lead_id TEXT NOT NULL REFERENCES leads(id),
  subject_before TEXT NOT NULL,
  subject_after TEXT NOT NULL,
  body_before TEXT NOT NULL,
  body_after TEXT NOT NULL,
  edit_ratio REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS learning_proposals (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  proposal_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  model TEXT,
  created_at TEXT NOT NULL,
  decided_at TEXT
);

CREATE TABLE IF NOT EXISTS learning_reports (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body_md TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}',
  model TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings_scoring (
  id TEXT PRIMARY KEY,
  weights_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profile_sources (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  label TEXT,
  raw_text TEXT,
  file_path TEXT,
  source_url TEXT,
  content_hash TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS structured_profiles (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  profile_json TEXT NOT NULL,
  source_ids_json TEXT NOT NULL DEFAULT '[]',
  model_id TEXT,
  prompt_version TEXT,
  created_at TEXT NOT NULL,
  approved_at TEXT
);

CREATE TABLE IF NOT EXISTS job_search_profiles (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  structured_profile_id TEXT,
  structured_profile_version INTEGER,
  params_json TEXT NOT NULL,
  rationale_json TEXT NOT NULL DEFAULT '[]',
  generation_trigger TEXT NOT NULL DEFAULT 'manual',
  model_id TEXT,
  prompt_version TEXT,
  cost_usd REAL,
  created_at TEXT NOT NULL,
  approved_at TEXT
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES companies(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  location TEXT,
  remote_policy TEXT,
  employment_type TEXT,
  salary_min REAL,
  salary_max REAL,
  salary_currency TEXT,
  salary_text TEXT,
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  posted_at TEXT,
  expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  triage_state TEXT NOT NULL DEFAULT 'discovered',
  reject_reason TEXT,
  search_profile_version INTEGER,
  fingerprint TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS jobs_source_external ON jobs(source, external_id);

CREATE TABLE IF NOT EXISTS collector_runs (
  id TEXT PRIMARY KEY,
  search_profile_version INTEGER,
  source TEXT NOT NULL,
  query_json TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  result_count INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL,
  status TEXT NOT NULL DEFAULT 'running',
  error TEXT
);

CREATE TABLE IF NOT EXISTS job_matches (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  profile_version INTEGER NOT NULL,
  search_profile_version INTEGER,
  match_score INTEGER NOT NULL,
  eligibility TEXT NOT NULL,
  recommend INTEGER NOT NULL DEFAULT 0,
  recommendation TEXT NOT NULL DEFAULT 'skip',
  matching_reasons_json TEXT NOT NULL DEFAULT '[]',
  concerns_json TEXT NOT NULL DEFAULT '[]',
  score_json TEXT NOT NULL DEFAULT '{}',
  model_id TEXT,
  prompt_version TEXT,
  cost_usd REAL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS job_matches_job_profile ON job_matches(job_id, profile_version, prompt_version);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  password_hash TEXT NOT NULL,
  onboarding_completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);
`;

function columnExists(table: string, column: string): boolean {
  const rows = getSqlite()
    .prepare(`PRAGMA table_info(${table})`)
    .all() as Array<{ name: string }>;
  return rows.some((r) => r.name === column);
}

function addColumnIfMissing(table: string, column: string, ddl: string) {
  if (!columnExists(table, column)) {
    getSqlite().exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

export function runMigrations() {
  const sqlite = getSqlite();
  sqlite.exec(MIGRATION_SQL);

  // Additive upgrades for DBs created in Phase 0 / Phase 1
  addColumnIfMissing("settings", "country_policy_json", "country_policy_json TEXT NOT NULL DEFAULT '{}'");
  addColumnIfMissing("settings", "send_policy_json", "send_policy_json TEXT NOT NULL DEFAULT '{}'");
  addColumnIfMissing("settings", "mailbox_health_json", "mailbox_health_json TEXT NOT NULL DEFAULT '{}'");
  addColumnIfMissing("leads", "follow_up_at", "follow_up_at TEXT");
  addColumnIfMissing("leads", "published_at", "published_at TEXT");
  addColumnIfMissing("source_pages", "prompt_version", "prompt_version TEXT");
  addColumnIfMissing("source_pages", "model_id", "model_id TEXT");
  addColumnIfMissing("contacts", "business_relevance", "business_relevance TEXT");
  addColumnIfMissing("contacts", "lawful_basis_note", "lawful_basis_note TEXT");
  addColumnIfMissing(
    "contacts",
    "country_policy_applied",
    "country_policy_applied TEXT",
  );
  addColumnIfMissing(
    "settings",
    "ops_checklist_json",
    "ops_checklist_json TEXT NOT NULL DEFAULT '{}'",
  );
  addColumnIfMissing(
    "settings",
    "daily_job_count",
    "daily_job_count INTEGER NOT NULL DEFAULT 20",
  );
  addColumnIfMissing(
    "settings",
    "today_mode",
    "today_mode TEXT NOT NULL DEFAULT 'jobs'",
  );
  addColumnIfMissing(
    "users",
    "onboarding_completed_at",
    "onboarding_completed_at TEXT",
  );
  addColumnIfMissing(
    "settings",
    "setup_checklist_dismissed_at",
    "setup_checklist_dismissed_at TEXT",
  );
}
