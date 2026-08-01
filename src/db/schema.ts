import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const settings = sqliteTable("settings", {
  id: text("id").primaryKey(),
  profileMd: text("profile_md").notNull().default(""),
  targetFiltersJson: text("target_filters_json").notNull().default("{}"),
  dailyLeadCount: integer("daily_lead_count").notNull().default(10),
  /** Max jobs published to Today Jobs tab per day (quality floor may yield fewer). */
  dailyJobCount: integer("daily_job_count").notNull().default(20),
  /** Last-used Today tab: jobs | clients */
  todayMode: text("today_mode").notNull().default("jobs"),
  aiBudgetUsd: real("ai_budget_usd").notNull().default(8),
  styleProfileJson: text("style_profile_json").notNull().default("{}"),
  countryPolicyJson: text("country_policy_json").notNull().default("{}"),
  /** Send policy overrides: maxNewPerDay, followUpDays, etc. */
  sendPolicyJson: text("send_policy_json").notNull().default("{}"),
  /** Mailbox health: pausedAt, pauseReason */
  mailboxHealthJson: text("mailbox_health_json").notNull().default("{}"),
  /** Phase 3 ops prerequisites checklist (manual DNS/mailbox). */
  opsChecklistJson: text("ops_checklist_json").notNull().default("{}"),
  /** Soft post-onboarding checklist on Today — dismissed timestamp. */
  setupChecklistDismissedAt: text("setup_checklist_dismissed_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const companies = sqliteTable(
  "companies",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    domain: text("domain"),
    country: text("country"),
    category: text("category"),
    status: text("status").notNull().default("new"),
    firstSeenAt: text("first_seen_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
  },
  (t) => [uniqueIndex("companies_normalized_name_idx").on(t.normalizedName)],
);

export const signals = sqliteTable(
  "signals",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id),
    source: text("source").notNull(),
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    sourceUrl: text("source_url").notNull(),
    publishedAt: text("published_at"),
    rawHash: text("raw_hash").notNull(),
    rawJson: text("raw_json").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("signals_source_external_id_idx").on(t.source, t.externalId)],
);

export const sourcePages = sqliteTable("source_pages", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id),
  url: text("url").notNull(),
  title: text("title"),
  retrievedAt: text("retrieved_at").notNull(),
  contentHash: text("content_hash"),
  extractionMethod: text("extraction_method"),
  extractedText: text("extracted_text"),
  textLength: integer("text_length"),
  httpStatus: integer("http_status"),
  status: text("status").notNull(),
  error: text("error"),
  promptVersion: text("prompt_version"),
  modelId: text("model_id"),
});

export const researchBriefs = sqliteTable("research_briefs", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id),
  evidenceJson: text("evidence_json").notNull(),
  resultJson: text("result_json").notNull(),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  costEstimate: real("cost_estimate").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const leads = sqliteTable("leads", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id),
  score: real("score"),
  scoreBreakdownJson: text("score_breakdown_json"),
  recommendedAngle: text("recommended_angle"),
  recommendedContactRole: text("recommended_contact_role"),
  state: text("state").notNull().default("new"),
  rejectReason: text("reject_reason"),
  researchStatus: text("research_status").notNull().default("pending"),
  followUpAt: text("follow_up_at"),
  publishedAt: text("published_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const contacts = sqliteTable("contacts", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id),
  name: text("name"),
  role: text("role"),
  email: text("email"),
  confidence: text("confidence").notNull().default("manual_confirmed"),
  sourceUrl: text("source_url"),
  /** Why this person is business-relevant for outreach. */
  businessRelevance: text("business_relevance"),
  /** Documented lawful-basis note where applicable (policy, not legal advice). */
  lawfulBasisNote: text("lawful_basis_note"),
  /** Country policy applied when contact was added. */
  countryPolicyApplied: text("country_policy_applied"),
  manuallyConfirmed: integer("manually_confirmed", { mode: "boolean" })
    .notNull()
    .default(true),
  createdAt: text("created_at").notNull(),
});

export const drafts = sqliteTable("drafts", {
  id: text("id").primaryKey(),
  leadId: text("lead_id")
    .notNull()
    .references(() => leads.id),
  contactId: text("contact_id").references(() => contacts.id),
  kind: text("kind").notNull().default("initial"),
  subject: text("subject").notNull(),
  bodyGenerated: text("body_generated").notNull(),
  bodyFinal: text("body_final").notNull(),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  state: text("state").notNull().default("draft"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const activities = sqliteTable("activities", {
  id: text("id").primaryKey(),
  leadId: text("lead_id")
    .notNull()
    .references(() => leads.id),
  type: text("type").notNull(),
  metadataJson: text("metadata_json").notNull().default("{}"),
  occurredAt: text("occurred_at").notNull(),
});

export const suppressions = sqliteTable("suppressions", {
  id: text("id").primaryKey(),
  email: text("email"),
  domain: text("domain"),
  reason: text("reason").notNull(),
  createdAt: text("created_at").notNull(),
});

export const syncRuns = sqliteTable("sync_runs", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  checkpointJson: text("checkpoint_json").notNull().default("{}"),
  statsJson: text("stats_json").notNull().default("{}"),
  error: text("error"),
});

export const apiUsage = sqliteTable("api_usage", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  task: text("task").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  estimatedCost: real("estimated_cost").notNull().default(0),
  occurredAt: text("occurred_at").notNull(),
});

/** Phase 3 — mailbox automation (credentials stay in Keychain, never here). */

export const approvals = sqliteTable("approvals", {
  id: text("id").primaryKey(),
  draftId: text("draft_id")
    .notNull()
    .references(() => drafts.id),
  leadId: text("lead_id")
    .notNull()
    .references(() => leads.id),
  recipientEmail: text("recipient_email").notNull(),
  contentHash: text("content_hash").notNull(),
  subjectSnapshot: text("subject_snapshot").notNull(),
  bodySnapshot: text("body_snapshot").notNull(),
  status: text("status").notNull().default("approved"),
  approvedAt: text("approved_at").notNull(),
  invalidatedAt: text("invalidated_at"),
  consumedAt: text("consumed_at"),
});

export const threads = sqliteTable("threads", {
  id: text("id").primaryKey(),
  leadId: text("lead_id")
    .notNull()
    .references(() => leads.id),
  contactId: text("contact_id").references(() => contacts.id),
  draftId: text("draft_id").references(() => drafts.id),
  subject: text("subject").notNull(),
  rfcMessageId: text("rfc_message_id"),
  state: text("state").notNull().default("open"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  threadId: text("thread_id")
    .notNull()
    .references(() => threads.id),
  leadId: text("lead_id")
    .notNull()
    .references(() => leads.id),
  direction: text("direction").notNull(),
  rfcMessageId: text("rfc_message_id"),
  inReplyTo: text("in_reply_to"),
  fromEmail: text("from_email").notNull(),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  bodyText: text("body_text").notNull(),
  classification: text("classification"),
  classificationSource: text("classification_source"),
  imapUid: integer("imap_uid"),
  createdAt: text("created_at").notNull(),
});

export const followUps = sqliteTable("follow_ups", {
  id: text("id").primaryKey(),
  leadId: text("lead_id")
    .notNull()
    .references(() => leads.id),
  threadId: text("thread_id").references(() => threads.id),
  draftId: text("draft_id").references(() => drafts.id),
  sequence: integer("sequence").notNull(),
  dueAt: text("due_at").notNull(),
  state: text("state").notNull().default("pending"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const mailSyncCursors = sqliteTable(
  "mail_sync_cursors",
  {
    id: text("id").primaryKey(),
    mailbox: text("mailbox").notNull(),
    folder: text("folder").notNull(),
    uidValidity: text("uid_validity"),
    lastUid: integer("last_uid").notNull().default(0),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [uniqueIndex("mail_sync_mailbox_folder_idx").on(t.mailbox, t.folder)],
);

export const deliveryEvents = sqliteTable("delivery_events", {
  id: text("id").primaryKey(),
  messageId: text("message_id").references(() => messages.id),
  leadId: text("lead_id").references(() => leads.id),
  eventType: text("event_type").notNull(),
  detail: text("detail"),
  occurredAt: text("occurred_at").notNull(),
});

/** Phase 4 — learning (proposals never auto-apply). */

export const draftEdits = sqliteTable("draft_edits", {
  id: text("id").primaryKey(),
  draftId: text("draft_id")
    .notNull()
    .references(() => drafts.id),
  leadId: text("lead_id")
    .notNull()
    .references(() => leads.id),
  subjectBefore: text("subject_before").notNull(),
  subjectAfter: text("subject_after").notNull(),
  bodyBefore: text("body_before").notNull(),
  bodyAfter: text("body_after").notNull(),
  editRatio: real("edit_ratio").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const learningProposals = sqliteTable("learning_proposals", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  proposalJson: text("proposal_json").notNull(),
  status: text("status").notNull().default("pending"),
  model: text("model"),
  createdAt: text("created_at").notNull(),
  decidedAt: text("decided_at"),
});

export const learningReports = sqliteTable("learning_reports", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  bodyMd: text("body_md").notNull(),
  dataJson: text("data_json").notNull().default("{}"),
  model: text("model"),
  createdAt: text("created_at").notNull(),
});

/** Soft scoring weight overrides — only applied via approved proposal. */
export const settingsScoring = sqliteTable("settings_scoring", {
  id: text("id").primaryKey(),
  weightsJson: text("weights_json").notNull().default("{}"),
  updatedAt: text("updated_at").notNull(),
});

/** Raw materials for structured professional profile (CV, portfolio, etc.). */
export const profileSources = sqliteTable("profile_sources", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  label: text("label"),
  rawText: text("raw_text"),
  filePath: text("file_path"),
  sourceUrl: text("source_url"),
  contentHash: text("content_hash").notNull(),
  ingestedAt: text("ingested_at").notNull(),
});

/** Versioned structured profile. Matching uses approved only. */
export const structuredProfiles = sqliteTable("structured_profiles", {
  id: text("id").primaryKey(),
  version: integer("version").notNull(),
  status: text("status").notNull().default("draft"),
  profileJson: text("profile_json").notNull(),
  sourceIdsJson: text("source_ids_json").notNull().default("[]"),
  modelId: text("model_id"),
  promptVersion: text("prompt_version"),
  createdAt: text("created_at").notNull(),
  approvedAt: text("approved_at"),
});

/** AI-generated Apify/search criteria. Collectors use approved only. */
export const jobSearchProfiles = sqliteTable("job_search_profiles", {
  id: text("id").primaryKey(),
  version: integer("version").notNull(),
  status: text("status").notNull().default("draft"),
  structuredProfileId: text("structured_profile_id"),
  structuredProfileVersion: integer("structured_profile_version"),
  paramsJson: text("params_json").notNull(),
  rationaleJson: text("rationale_json").notNull().default("[]"),
  generationTrigger: text("generation_trigger").notNull().default("manual"),
  modelId: text("model_id"),
  promptVersion: text("prompt_version"),
  costUsd: real("cost_usd"),
  createdAt: text("created_at").notNull(),
  approvedAt: text("approved_at"),
});

/** First-class open roles for job-application mode. */
export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").references(() => companies.id),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    location: text("location"),
    remotePolicy: text("remote_policy"),
    employmentType: text("employment_type"),
    salaryMin: real("salary_min"),
    salaryMax: real("salary_max"),
    salaryCurrency: text("salary_currency"),
    salaryText: text("salary_text"),
    source: text("source").notNull(),
    externalId: text("external_id").notNull(),
    sourceUrl: text("source_url").notNull(),
    postedAt: text("posted_at"),
    expiresAt: text("expires_at"),
    status: text("status").notNull().default("active"),
    triageState: text("triage_state").notNull().default("discovered"),
    rejectReason: text("reject_reason"),
    searchProfileVersion: integer("search_profile_version"),
    fingerprint: text("fingerprint"),
    publishedAt: text("published_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    sourceExternal: uniqueIndex("jobs_source_external").on(t.source, t.externalId),
  }),
);

/** One collector/Apify query run. */
export const collectorRuns = sqliteTable("collector_runs", {
  id: text("id").primaryKey(),
  searchProfileVersion: integer("search_profile_version"),
  source: text("source").notNull(),
  queryJson: text("query_json").notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  resultCount: integer("result_count").notNull().default(0),
  costUsd: real("cost_usd"),
  status: text("status").notNull().default("running"),
  error: text("error"),
});

/** Local account for private app access. */
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name"),
    passwordHash: text("password_hash").notNull(),
    /** Set when first-login wizard finishes (profile + search approved). */
    onboardingCompletedAt: text("onboarding_completed_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const passwordResetTokens = sqliteTable("password_reset_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull(),
});

/** AI job-vs-profile evaluation. */
export const jobMatches = sqliteTable(
  "job_matches",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id),
    profileVersion: integer("profile_version").notNull(),
    searchProfileVersion: integer("search_profile_version"),
    matchScore: integer("match_score").notNull(),
    eligibility: text("eligibility").notNull(),
    recommend: integer("recommend").notNull().default(0),
    recommendation: text("recommendation").notNull().default("skip"),
    matchingReasonsJson: text("matching_reasons_json").notNull().default("[]"),
    concernsJson: text("concerns_json").notNull().default("[]"),
    scoreJson: text("score_json").notNull().default("{}"),
    modelId: text("model_id"),
    promptVersion: text("prompt_version"),
    costUsd: real("cost_usd"),
    createdAt: text("created_at").notNull(),
  },
  (t) => ({
    jobProfile: uniqueIndex("job_matches_job_profile").on(
      t.jobId,
      t.profileVersion,
      t.promptVersion,
    ),
  }),
);
