import {
  boolean,
  integer,
  real,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const settings = pgTable("settings", {
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
  /**
   * When 1, job ranking may soft-boost segments from approved strategy learning.
   * Major title/location changes still require human-approved search profile versions.
   */
  adaptiveJobRanking: integer("adaptive_job_ranking").notNull().default(1),
  /**
   * Legacy flag kept in sync with matchingSourcesJson.portfolioProjects.
   * Prefer matchingSourcesJson for new code.
   */
  usePortfolioInMatching: integer("use_portfolio_in_matching")
    .notNull()
    .default(1),
  /**
   * Which categories of professional knowledge feed job match scores.
   * Never implies deletion — see MatchingSourcesConfig.
   */
  matchingSourcesJson: text("matching_sources_json").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const companies = pgTable(
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

export const signals = pgTable(
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

export const sourcePages = pgTable("source_pages", {
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

export const researchBriefs = pgTable("research_briefs", {
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

export const leads = pgTable("leads", {
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

export const contacts = pgTable("contacts", {
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
  manuallyConfirmed: boolean("manually_confirmed").notNull().default(true),
  createdAt: text("created_at").notNull(),
});

export const drafts = pgTable("drafts", {
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

export const activities = pgTable("activities", {
  id: text("id").primaryKey(),
  leadId: text("lead_id")
    .notNull()
    .references(() => leads.id),
  type: text("type").notNull(),
  metadataJson: text("metadata_json").notNull().default("{}"),
  occurredAt: text("occurred_at").notNull(),
});

export const suppressions = pgTable("suppressions", {
  id: text("id").primaryKey(),
  email: text("email"),
  domain: text("domain"),
  reason: text("reason").notNull(),
  createdAt: text("created_at").notNull(),
});

export const syncRuns = pgTable("sync_runs", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  checkpointJson: text("checkpoint_json").notNull().default("{}"),
  statsJson: text("stats_json").notNull().default("{}"),
  error: text("error"),
});

export const apiUsage = pgTable("api_usage", {
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

export const approvals = pgTable("approvals", {
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

export const threads = pgTable("threads", {
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

export const messages = pgTable("messages", {
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

export const followUps = pgTable("follow_ups", {
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

export const mailSyncCursors = pgTable(
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

export const deliveryEvents = pgTable("delivery_events", {
  id: text("id").primaryKey(),
  messageId: text("message_id").references(() => messages.id),
  leadId: text("lead_id").references(() => leads.id),
  eventType: text("event_type").notNull(),
  detail: text("detail"),
  occurredAt: text("occurred_at").notNull(),
});

/** Phase 4 — learning (proposals never auto-apply). */

export const draftEdits = pgTable("draft_edits", {
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

export const learningProposals = pgTable("learning_proposals", {
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

export const learningReports = pgTable("learning_reports", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  bodyMd: text("body_md").notNull(),
  dataJson: text("data_json").notNull().default("{}"),
  model: text("model"),
  createdAt: text("created_at").notNull(),
});

/** Soft scoring weight overrides — only applied via approved proposal. */
export const settingsScoring = pgTable("settings_scoring", {
  id: text("id").primaryKey(),
  weightsJson: text("weights_json").notNull().default("{}"),
  updatedAt: text("updated_at").notNull(),
});

/** Raw materials for structured professional profile (CV, portfolio, etc.). */
export const profileSources = pgTable("profile_sources", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  label: text("label"),
  rawText: text("raw_text"),
  filePath: text("file_path"),
  sourceUrl: text("source_url"),
  contentHash: text("content_hash").notNull(),
  ingestedAt: text("ingested_at").notNull(),
  /** Last successful sync/import of this source. */
  lastSyncedAt: text("last_synced_at"),
  /**
   * When 1, this source may contribute to match scores (also gated by
   * matchingSourcesJson category toggles). Never deletes stored data.
   */
  enabledForMatching: integer("enabled_for_matching").notNull().default(1),
  /** Soft-delete timestamp. Null = active. Hard file cleanup optional later. */
  deletedAt: text("deleted_at"),
});

/** Versioned structured profile. Matching uses approved only. */
export const structuredProfiles = pgTable("structured_profiles", {
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

/** AI-generated Apify/search criteria. Collectors use approved only. Strategy versions = rows. */
export const jobSearchProfiles = pgTable("job_search_profiles", {
  id: text("id").primaryKey(),
  version: integer("version").notNull(),
  status: text("status").notNull().default("draft"),
  structuredProfileId: text("structured_profile_id"),
  structuredProfileVersion: integer("structured_profile_version"),
  paramsJson: text("params_json").notNull(),
  rationaleJson: text("rationale_json").notNull().default("[]"),
  generationTrigger: text("generation_trigger").notNull().default("manual"),
  /** Prior strategy version this draft/version evolved from. */
  parentVersion: integer("parent_version"),
  /** Why this version changed (hypothesis for cohort compare). */
  hypothesisMd: text("hypothesis_md"),
  modelId: text("model_id"),
  promptVersion: text("prompt_version"),
  costUsd: real("cost_usd"),
  createdAt: text("created_at").notNull(),
  approvedAt: text("approved_at"),
  supersededAt: text("superseded_at"),
});

/** First-class open roles for job-application mode. */
export const jobs = pgTable(
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
    /** ISO when user marked applied — for time-to-response. */
    appliedAt: text("applied_at"),
    /**
     * Post-apply outcome: none | no_response | recruiter_response | interview |
     * rejected | offer | accepted
     */
    outcome: text("outcome").notNull().default("none"),
    outcomeAt: text("outcome_at"),
    outcomeNote: text("outcome_note"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("jobs_source_external").on(t.source, t.externalId),
  ],
);

/** Append-only job learning signals (triage + post-apply outcomes). */
export const jobOutcomeEvents = pgTable("job_outcome_events", {
  id: text("id").primaryKey(),
  jobId: text("job_id")
    .notNull()
    .references(() => jobs.id),
  /** Event type: viewed | saved | interested | rejected | applied | recruiter_response | interview | offer | accepted | no_response | rejected_after_apply */
  type: text("type").notNull(),
  strategyVersion: integer("strategy_version"),
  payloadJson: text("payload_json").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
});

/** Snapshot of funnel KPIs per search strategy version (recomputed on demand). */
export const strategyCohortMetrics = pgTable("strategy_cohort_metrics", {
  id: text("id").primaryKey(),
  strategyVersion: integer("strategy_version").notNull(),
  applicationsN: integer("applications_n").notNull().default(0),
  responsesN: integer("responses_n").notNull().default(0),
  interviewsN: integer("interviews_n").notNull().default(0),
  offersN: integer("offers_n").notNull().default(0),
  rejectionsN: integer("rejections_n").notNull().default(0),
  triageLikedN: integer("triage_liked_n").notNull().default(0),
  triageRejectedN: integer("triage_rejected_n").notNull().default(0),
  responseRate: real("response_rate").notNull().default(0),
  interviewRate: real("interview_rate").notNull().default(0),
  offerRate: real("offer_rate").notNull().default(0),
  medianDaysToResponse: real("median_days_to_response"),
  segmentJson: text("segment_json").notNull().default("{}"),
  computedAt: text("computed_at").notNull(),
});

/** One collector/Apify query run. */
export const collectorRuns = pgTable("collector_runs", {
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
export const users = pgTable(
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

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
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
export const jobMatches = pgTable(
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
  (t) => [
    uniqueIndex("job_matches_job_profile").on(
      t.jobId,
      t.profileVersion,
      t.promptVersion,
    ),
  ],
);

/**
 * Company-specific application package (tailored CV + cover letter).
 * One active package per job; regenerates supersede prior rows.
 */
export const applicationPackages = pgTable("application_packages", {
  id: text("id").primaryKey(),
  jobId: text("job_id")
    .notNull()
    .references(() => jobs.id),
  companyId: text("company_id").references(() => companies.id),
  profileVersion: integer("profile_version").notNull(),
  /** us | europe */
  market: text("market").notNull().default("europe"),
  /** draft | approved | prepared | superseded */
  state: text("state").notNull().default("draft"),
  version: integer("version").notNull().default(1),
  contentHash: text("content_hash"),
  analysisJson: text("analysis_json").notNull().default("{}"),
  cvJson: text("cv_json").notNull().default("{}"),
  letterGenerated: text("letter_generated").notNull().default(""),
  letterFinal: text("letter_final").notNull().default(""),
  groundingJson: text("grounding_json").notNull().default("{}"),
  warningsJson: text("warnings_json").notNull().default("[]"),
  model: text("model"),
  promptVersion: text("prompt_version"),
  approvedAt: text("approved_at"),
  /** Application outbound email (persisted from Email tab / Send modal). */
  emailTo: text("email_to"),
  emailSubject: text("email_subject"),
  emailBody: text("email_body"),
  /** none | sent | waiting | follow_up | closed */
  mailStatus: text("mail_status").notNull().default("none"),
  sentAt: text("sent_at"),
  repliedAt: text("replied_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
