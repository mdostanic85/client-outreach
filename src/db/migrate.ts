import { createHash } from "node:crypto";
import { getSql } from "./client";

/**
 * Additive PostgreSQL schema bootstrap.
 * Safe to re-run: CREATE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS only.
 * Never drops tables or columns (only the superseded jobs_source_external index).
 */
const MIGRATION_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  profile_md TEXT NOT NULL DEFAULT '',
  target_filters_json TEXT NOT NULL DEFAULT '{}',
  daily_lead_count INTEGER NOT NULL DEFAULT 10,
  daily_job_count INTEGER NOT NULL DEFAULT 20,
  today_mode TEXT NOT NULL DEFAULT 'jobs',
  ai_budget_usd REAL NOT NULL DEFAULT 8,
  style_profile_json TEXT NOT NULL DEFAULT '{}',
  country_policy_json TEXT NOT NULL DEFAULT '{}',
  send_policy_json TEXT NOT NULL DEFAULT '{}',
  mailbox_health_json TEXT NOT NULL DEFAULT '{}',
  ops_checklist_json TEXT NOT NULL DEFAULT '{}',
  setup_checklist_dismissed_at TEXT,
  adaptive_job_ranking INTEGER NOT NULL DEFAULT 1,
  use_portfolio_in_matching INTEGER NOT NULL DEFAULT 1,
  matching_sources_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,

  `CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  domain TEXT,
  country TEXT,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS companies_normalized_name_idx ON companies(normalized_name)`,

  `CREATE TABLE IF NOT EXISTS signals (
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
)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS signals_source_external_id_idx ON signals(source, external_id)`,

  `CREATE TABLE IF NOT EXISTS source_pages (
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
)`,

  `CREATE TABLE IF NOT EXISTS research_briefs (
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
)`,

  `CREATE TABLE IF NOT EXISTS leads (
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
)`,

  `CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  name TEXT,
  role TEXT,
  email TEXT,
  confidence TEXT NOT NULL DEFAULT 'manual_confirmed',
  source_url TEXT,
  business_relevance TEXT,
  lawful_basis_note TEXT,
  country_policy_applied TEXT,
  manually_confirmed BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TEXT NOT NULL
)`,

  `CREATE TABLE IF NOT EXISTS drafts (
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
)`,

  `CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id),
  type TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  occurred_at TEXT NOT NULL
)`,

  `CREATE TABLE IF NOT EXISTS suppressions (
  id TEXT PRIMARY KEY,
  email TEXT,
  domain TEXT,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
)`,

  `CREATE TABLE IF NOT EXISTS sync_runs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  checkpoint_json TEXT NOT NULL DEFAULT '{}',
  stats_json TEXT NOT NULL DEFAULT '{}',
  error TEXT
)`,

  `CREATE TABLE IF NOT EXISTS api_usage (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  task TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost REAL NOT NULL DEFAULT 0,
  occurred_at TEXT NOT NULL
)`,

  `CREATE TABLE IF NOT EXISTS approvals (
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
)`,

  `CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id),
  contact_id TEXT REFERENCES contacts(id),
  draft_id TEXT REFERENCES drafts(id),
  subject TEXT NOT NULL,
  rfc_message_id TEXT,
  state TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,

  `CREATE TABLE IF NOT EXISTS messages (
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
)`,

  `CREATE TABLE IF NOT EXISTS follow_ups (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id),
  thread_id TEXT REFERENCES threads(id),
  draft_id TEXT REFERENCES drafts(id),
  sequence INTEGER NOT NULL,
  due_at TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,

  `CREATE TABLE IF NOT EXISTS mail_sync_cursors (
  id TEXT PRIMARY KEY,
  mailbox TEXT NOT NULL,
  folder TEXT NOT NULL,
  uid_validity TEXT,
  last_uid INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS mail_sync_mailbox_folder_idx ON mail_sync_cursors(mailbox, folder)`,

  `CREATE TABLE IF NOT EXISTS delivery_events (
  id TEXT PRIMARY KEY,
  message_id TEXT REFERENCES messages(id),
  lead_id TEXT REFERENCES leads(id),
  event_type TEXT NOT NULL,
  detail TEXT,
  occurred_at TEXT NOT NULL
)`,

  `CREATE TABLE IF NOT EXISTS draft_edits (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES drafts(id),
  lead_id TEXT NOT NULL REFERENCES leads(id),
  subject_before TEXT NOT NULL,
  subject_after TEXT NOT NULL,
  body_before TEXT NOT NULL,
  body_after TEXT NOT NULL,
  edit_ratio REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
)`,

  `CREATE TABLE IF NOT EXISTS learning_proposals (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  proposal_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  model TEXT,
  created_at TEXT NOT NULL,
  decided_at TEXT
)`,

  `CREATE TABLE IF NOT EXISTS learning_reports (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body_md TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}',
  model TEXT,
  created_at TEXT NOT NULL
)`,

  `CREATE TABLE IF NOT EXISTS settings_scoring (
  id TEXT PRIMARY KEY,
  weights_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
)`,

  `CREATE TABLE IF NOT EXISTS settings_job_scoring (
  id TEXT PRIMARY KEY,
  weights_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
)`,

  `CREATE TABLE IF NOT EXISTS profile_sources (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  label TEXT,
  raw_text TEXT,
  file_path TEXT,
  source_url TEXT,
  content_hash TEXT NOT NULL,
  ingested_at TEXT NOT NULL,
  last_synced_at TEXT,
  enabled_for_matching INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
)`,

  `CREATE TABLE IF NOT EXISTS structured_profiles (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  profile_json TEXT NOT NULL,
  source_ids_json TEXT NOT NULL DEFAULT '[]',
  model_id TEXT,
  prompt_version TEXT,
  created_at TEXT NOT NULL,
  approved_at TEXT
)`,

  `CREATE TABLE IF NOT EXISTS job_search_profiles (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  structured_profile_id TEXT,
  structured_profile_version INTEGER,
  params_json TEXT NOT NULL,
  rationale_json TEXT NOT NULL DEFAULT '[]',
  generation_trigger TEXT NOT NULL DEFAULT 'manual',
  parent_version INTEGER,
  hypothesis_md TEXT,
  model_id TEXT,
  prompt_version TEXT,
  cost_usd REAL,
  created_at TEXT NOT NULL,
  approved_at TEXT,
  superseded_at TEXT
)`,

  `CREATE TABLE IF NOT EXISTS jobs (
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
  applied_at TEXT,
  outcome TEXT NOT NULL DEFAULT 'none',
  outcome_at TEXT,
  outcome_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,

  `CREATE TABLE IF NOT EXISTS collector_runs (
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
)`,

  `CREATE TABLE IF NOT EXISTS job_matches (
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
)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS job_matches_job_profile ON job_matches(job_id, profile_version, prompt_version)`,

  // Legacy auth tables — kept only as the source for the Better Auth backfill below.
  `CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  password_hash TEXT NOT NULL,
  onboarding_completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email)`,

  `CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
)`,

  `CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
)`,

  `CREATE TABLE IF NOT EXISTS job_outcome_events (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  type TEXT NOT NULL,
  strategy_version INTEGER,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
)`,

  `CREATE TABLE IF NOT EXISTS strategy_cohort_metrics (
  id TEXT PRIMARY KEY,
  strategy_version INTEGER NOT NULL,
  applications_n INTEGER NOT NULL DEFAULT 0,
  responses_n INTEGER NOT NULL DEFAULT 0,
  interviews_n INTEGER NOT NULL DEFAULT 0,
  offers_n INTEGER NOT NULL DEFAULT 0,
  rejections_n INTEGER NOT NULL DEFAULT 0,
  triage_liked_n INTEGER NOT NULL DEFAULT 0,
  triage_rejected_n INTEGER NOT NULL DEFAULT 0,
  response_rate REAL NOT NULL DEFAULT 0,
  interview_rate REAL NOT NULL DEFAULT 0,
  offer_rate REAL NOT NULL DEFAULT 0,
  median_days_to_response REAL,
  segment_json TEXT NOT NULL DEFAULT '{}',
  computed_at TEXT NOT NULL
)`,

  // Additive upgrades for DBs created from older schema snapshots
  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS country_policy_json TEXT NOT NULL DEFAULT '{}'`,
  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS send_policy_json TEXT NOT NULL DEFAULT '{}'`,
  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS mailbox_health_json TEXT NOT NULL DEFAULT '{}'`,
  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS ops_checklist_json TEXT NOT NULL DEFAULT '{}'`,
  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS daily_job_count INTEGER NOT NULL DEFAULT 20`,
  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS today_mode TEXT NOT NULL DEFAULT 'jobs'`,
  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS setup_checklist_dismissed_at TEXT`,
  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS adaptive_job_ranking INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS use_portfolio_in_matching INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS matching_sources_json TEXT NOT NULL DEFAULT '{}'`,
  `ALTER TABLE leads ADD COLUMN IF NOT EXISTS follow_up_at TEXT`,
  `ALTER TABLE leads ADD COLUMN IF NOT EXISTS published_at TEXT`,
  `ALTER TABLE source_pages ADD COLUMN IF NOT EXISTS prompt_version TEXT`,
  `ALTER TABLE source_pages ADD COLUMN IF NOT EXISTS model_id TEXT`,
  `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS business_relevance TEXT`,
  `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lawful_basis_note TEXT`,
  `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS country_policy_applied TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed_at TEXT`,
  `ALTER TABLE profile_sources ADD COLUMN IF NOT EXISTS last_synced_at TEXT`,
  `ALTER TABLE profile_sources ADD COLUMN IF NOT EXISTS enabled_for_matching INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE profile_sources ADD COLUMN IF NOT EXISTS deleted_at TEXT`,
  `ALTER TABLE job_search_profiles ADD COLUMN IF NOT EXISTS parent_version INTEGER`,
  `ALTER TABLE job_search_profiles ADD COLUMN IF NOT EXISTS hypothesis_md TEXT`,
  `ALTER TABLE job_search_profiles ADD COLUMN IF NOT EXISTS superseded_at TEXT`,
  `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS applied_at TEXT`,
  `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS outcome TEXT NOT NULL DEFAULT 'none'`,
  `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS outcome_at TEXT`,
  `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS outcome_note TEXT`,

  `CREATE TABLE IF NOT EXISTS application_packages (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  company_id TEXT REFERENCES companies(id),
  profile_version INTEGER NOT NULL,
  market TEXT NOT NULL DEFAULT 'europe',
  state TEXT NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  content_hash TEXT,
  analysis_json TEXT NOT NULL DEFAULT '{}',
  cv_json TEXT NOT NULL DEFAULT '{}',
  letter_generated TEXT NOT NULL DEFAULT '',
  letter_final TEXT NOT NULL DEFAULT '',
  grounding_json TEXT NOT NULL DEFAULT '{}',
  warnings_json TEXT NOT NULL DEFAULT '[]',
  model TEXT,
  prompt_version TEXT,
  approved_at TEXT,
  email_to TEXT,
  email_subject TEXT,
  email_body TEXT,
  mail_status TEXT NOT NULL DEFAULT 'none',
  sent_at TEXT,
  replied_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS application_packages_job_id_idx ON application_packages(job_id)`,
  `ALTER TABLE application_packages ADD COLUMN IF NOT EXISTS email_to TEXT`,
  `ALTER TABLE application_packages ADD COLUMN IF NOT EXISTS email_subject TEXT`,
  `ALTER TABLE application_packages ADD COLUMN IF NOT EXISTS email_body TEXT`,
  `ALTER TABLE application_packages ADD COLUMN IF NOT EXISTS mail_status TEXT NOT NULL DEFAULT 'none'`,
  `ALTER TABLE application_packages ADD COLUMN IF NOT EXISTS sent_at TEXT`,
  `ALTER TABLE application_packages ADD COLUMN IF NOT EXISTS replied_at TEXT`,
  `CREATE INDEX IF NOT EXISTS application_packages_mail_status_idx ON application_packages(mail_status)`,

  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS survey_json TEXT NOT NULL DEFAULT '{}'`,
  `CREATE TABLE IF NOT EXISTS cv_reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_id TEXT REFERENCES profile_sources(id),
  score INTEGER NOT NULL,
  review_json TEXT NOT NULL,
  model TEXT,
  prompt_version TEXT,
  created_at TEXT NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS cv_reviews_user_id_idx ON cv_reviews(user_id)`,

  // Better Auth
  `CREATE TABLE IF NOT EXISTS auth_user (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  image TEXT,
  onboarding_completed_at TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`,
  `CREATE TABLE IF NOT EXISTS auth_session (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`,
  `CREATE INDEX IF NOT EXISTS auth_session_user_id_idx ON auth_session(user_id)`,
  `CREATE TABLE IF NOT EXISTS auth_account (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  refresh_token_expires_at TIMESTAMPTZ,
  scope TEXT,
  password TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`,
  `CREATE INDEX IF NOT EXISTS auth_account_user_id_idx ON auth_account(user_id)`,
  `CREATE TABLE IF NOT EXISTS auth_verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`,
  `CREATE INDEX IF NOT EXISTS auth_verification_identifier_idx ON auth_verification(identifier)`,

  // One-time copy of pre-Better-Auth accounts. Same ids and scrypt hashes, so
  // existing passwords keep working. These accounts predate Google sign-in, so
  // they are treated as verified to let Google link to them by email.
  `INSERT INTO auth_user (id, name, email, email_verified, onboarding_completed_at, created_at, updated_at)
  SELECT id, COALESCE(NULLIF(name, ''), split_part(email, '@', 1)), email, TRUE,
    onboarding_completed_at, created_at::timestamptz, updated_at::timestamptz
  FROM users
  ON CONFLICT DO NOTHING`,
  `INSERT INTO auth_account (id, user_id, account_id, provider_id, password, created_at, updated_at)
  SELECT 'acc_' || u.id, u.id, u.id, 'credential', u.password_hash, u.created_at::timestamptz, u.updated_at::timestamptz
  FROM users u
  JOIN auth_user au ON au.id = u.id
  ON CONFLICT DO NOTHING`,
];

/** Tables whose rows belong to one account. Client-outreach tables stay owner-only. */
export const USER_SCOPED_TABLES = [
  "settings",
  "settings_scoring",
  "settings_job_scoring",
  "profile_sources",
  "structured_profiles",
  "job_search_profiles",
  "jobs",
  "job_matches",
  "application_packages",
  "job_outcome_events",
  "strategy_cohort_metrics",
  "collector_runs",
  "learning_proposals",
  "learning_reports",
  "api_usage",
] as const;

/**
 * Adds user_id to per-account tables and hands pre-multi-user rows to the
 * owner (OPTRA_OWNER_EMAIL, else the oldest account). NOT NULL is only
 * enforced once every row has an owner.
 */
async function scopeRowsToUsers(sql: ReturnType<typeof getSql>) {
  const ownerEmail = process.env.OPTRA_OWNER_EMAIL?.trim().toLowerCase() ?? "";
  const owner = (await sql.query(
    `SELECT id FROM auth_user ORDER BY (lower(email) = $1) DESC, created_at ASC LIMIT 1`,
    [ownerEmail],
  )) as Array<{ id: string }>;
  const ownerId = owner[0]?.id ?? null;

  for (const table of USER_SCOPED_TABLES) {
    await sql.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS user_id TEXT`);
    await sql.query(
      `CREATE INDEX IF NOT EXISTS ${table}_user_id_idx ON ${table}(user_id)`,
    );
    if (ownerId) {
      await sql.query(`UPDATE ${table} SET user_id = $1 WHERE user_id IS NULL`, [
        ownerId,
      ]);
    }
    const orphans = (await sql.query(
      `SELECT 1 FROM ${table} WHERE user_id IS NULL LIMIT 1`,
    )) as unknown[];
    if (orphans.length === 0) {
      await sql.query(`ALTER TABLE ${table} ALTER COLUMN user_id SET NOT NULL`);
    }
  }

  // One settings row per account (keep the oldest if a race created extras).
  await sql.query(
    `DELETE FROM settings a USING settings b
     WHERE a.user_id = b.user_id AND (a.created_at, a.id) > (b.created_at, b.id)`,
  );
  await sql.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS settings_user_id_unique ON settings(user_id)`,
  );

  // The same posting can now exist once per account.
  await sql.query(`DROP INDEX IF EXISTS jobs_source_external`);
  await sql.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS jobs_user_source_external ON jobs(user_id, source, external_id)`,
  );
}

/**
 * Bump when runMigrations changes in a way the fingerprint can't see
 * (backfills, scopeRowsToUsers logic), so existing databases re-run it.
 */
const MIGRATIONS_REVISION = 1;

const SCHEMA_FINGERPRINT = createHash("sha256")
  .update(
    JSON.stringify([MIGRATIONS_REVISION, MIGRATION_STATEMENTS, USER_SCOPED_TABLES]),
  )
  .digest("hex");

/** One round trip instead of ~170 when the database is already up to date. */
async function schemaIsCurrent(sql: ReturnType<typeof getSql>) {
  try {
    const rows = (await sql.query(
      `SELECT value FROM schema_meta WHERE key = 'fingerprint'`,
    )) as Array<{ value: string }>;
    return rows[0]?.value === SCHEMA_FINGERPRINT;
  } catch {
    return false; // schema_meta doesn't exist yet
  }
}

export async function runMigrations({ force = false } = {}) {
  const sql = getSql();
  if (!force && (await schemaIsCurrent(sql))) return;

  for (const statement of MIGRATION_STATEMENTS) {
    await sql.query(statement);
  }

  await scopeRowsToUsers(sql);

  // Backfill last_synced_at from ingested_at when null.
  await sql.query(
    `UPDATE profile_sources SET last_synced_at = ingested_at WHERE last_synced_at IS NULL AND deleted_at IS NULL`,
  );

  // Seed matching_sources_json from legacy use_portfolio_in_matching when empty.
  const rows = (await sql.query(
    `SELECT id, use_portfolio_in_matching, matching_sources_json FROM settings`,
  )) as Array<{
    id: string;
    use_portfolio_in_matching: number;
    matching_sources_json: string;
  }>;

  for (const row of rows) {
    const raw = row.matching_sources_json?.trim();
    if (raw && raw !== "{}") continue;
    const portfolioProjects = row.use_portfolio_in_matching !== 0;
    await sql.query(
      `UPDATE settings SET matching_sources_json = $1 WHERE id = $2`,
      [
        JSON.stringify({
          portfolioProjects,
          linkedin: true,
          cv: true,
          manual: true,
          github: true,
          jobPreferences: true,
          activitySignals: true,
        }),
        row.id,
      ],
    );
  }

  await sql.query(
    `CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  );
  await sql.query(
    `INSERT INTO schema_meta (key, value) VALUES ('fingerprint', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [SCHEMA_FINGERPRINT],
  );
}
