import { ClientsLearningHub } from "@/components/clients-learning-hub";
import { JobLearningHub } from "@/components/job-learning-hub";
import { LearningModeSwitch } from "@/components/learning-mode-switch";
import { PageHeader, PageShell } from "@/components/page-shell";
import { ensureDb } from "@/db/ensure";
import { getTodayMode } from "@/modules/settings/user-settings";
import {
  getJobLearningDashboard,
  getLearningDashboard,
} from "@/modules/learning/queries";
import { clientsModeEnabled } from "@/modules/onboarding/clients-mode";

export const dynamic = "force-dynamic";

export default async function LearningPage({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string }>;
}) {
  await ensureDb();
  const sp = searchParams ? await searchParams : {};
  const clientsEnabled = await clientsModeEnabled();
  const todayMode = await getTodayMode();
  const requested =
    sp.mode === "clients" || sp.mode === "jobs"
      ? sp.mode
      : todayMode === "clients"
        ? "clients"
        : "jobs";
  const mode = clientsEnabled ? requested : "jobs";

  const clientsDash = await getLearningDashboard();
  const jobsDash = await getJobLearningDashboard();
  const pending = clientsDash.proposals.filter(
    (p) => p.status === "pending" && p.kind !== "search_strategy",
  );
  const reports = clientsDash.reports.filter(
    (r) => r.kind !== "job_weekly_insights",
  );

  return (
    <PageShell width="setup">
      <PageHeader
        title="Improve"
        description={
          mode === "jobs"
            ? "Log what happened after you applied. Optra suggests search updates — you approve before anything changes."
            : "See which sources work. Optra suggests style and scoring updates — you approve before anything changes."
        }
        actions={clientsEnabled ? <LearningModeSwitch mode={mode} /> : undefined}
      />

      {mode === "jobs" ? (
        <JobLearningHub dash={jobsDash} />
      ) : (
        <ClientsLearningHub
          gates={clientsDash.gates}
          sourceRows={clientsDash.source.rows}
          proposals={pending}
          reports={reports}
        />
      )}
    </PageShell>
  );
}
