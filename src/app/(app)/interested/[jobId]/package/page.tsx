import { notFound } from "next/navigation";
import { ApplicationPackageWorkspace } from "@/components/application-package-workspace";
import { ensureDb } from "@/db/ensure";
import { getActivePackageForJob } from "@/modules/applications/packages";
import { suggestMarket } from "@/modules/applications/market";
import { getJobDetail } from "@/modules/jobs/queries";
import { getMailboxConnectionStatus } from "@/modules/mail/oauth-google";
import { getApprovedProfile } from "@/modules/profile/queries";
import { currentUserId, isOwner } from "@/modules/auth/current-user";

export const dynamic = "force-dynamic";

export default async function ApplicationPackagePage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await ensureDb();
  const { jobId } = await params;
  const sp = (await searchParams) ?? {};
  const openSend =
    sp.send === "1" || sp.send === "true";

  const detail = await getJobDetail(jobId);
  if (!detail) notFound();

  const [pkg, approved, mailbox, owner] = await Promise.all([
    getActivePackageForJob(jobId),
    getApprovedProfile(),
    Promise.resolve(getMailboxConnectionStatus()),
    currentUserId().then(isOwner),
  ]);

  const suggestedMarket = suggestMarket({
    jobCountry: detail.company?.country,
    jobLocation: detail.job.location,
    companyCountry: detail.company?.country,
    salaryCurrency: detail.job.salaryCurrency,
  });

  return (
    <ApplicationPackageWorkspace
      jobId={jobId}
      jobTitle={detail.job.title}
      companyName={detail.company?.name ?? "Unknown"}
      sourceUrl={detail.job.sourceUrl}
      suggestedMarket={suggestedMarket}
      initialPackage={pkg}
      hasApprovedProfile={Boolean(approved)}
      mailboxConnected={owner && mailbox.connected}
      mailboxEmail={owner ? mailbox.email : null}
      canEmail={owner}
      openSendOnMount={openSend && Boolean(pkg)}
    />
  );
}
