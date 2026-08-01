import { noWidow } from "@/lib/utils";

const SAMPLE_MATCH = {
  title: "Senior Product Designer",
  company: "Linear-ish SaaS",
  score: 86,
  reasons: [
    "You've owned design systems for the last 4 years",
    "Remote in the EU, and they work on their own schedule like you prefer",
    "They posted a Head of Design role 9 days ago",
  ].map(noWidow),
  concern: noWidow(
    "The title is for an individual contributor. Check if they mean staff or lead before you apply.",
  ),
};

/** Live shortlist preview — explains Optra before signup (Contra + Clay pattern). */
export function ProductPanel({
  eyebrow = "How Optra works",
  headline = noWidow(
    "Each day you get a short list of jobs that fit, and why they fit.",
  ),
}: {
  eyebrow?: string;
  headline?: string;
}) {
  const steps = [
    "Add your CV, LinkedIn, portfolio, or a short note about you.",
    "We find open jobs and explain why each one matches you.",
    "You get up to 20 jobs a day, with reasons and things to watch for.",
  ].map(noWidow);

  return (
    <>
      <div className="max-w-xl">
        <p className="text-primary text-[14px] font-medium tracking-[0.08em] uppercase">
          {eyebrow}
        </p>
        <h2 className="font-display mt-4 text-[2rem] leading-[1.2] font-semibold tracking-tight text-[var(--card-foreground)] xl:text-[2.375rem]">
          {noWidow(headline)}
        </h2>
        <ol className="text-muted-foreground mt-10 space-y-5 text-[16px] leading-relaxed xl:text-[17px]">
          {steps.map((step, index) => (
            <li key={step} className="flex items-start gap-x-4">
              <span
                className="bg-primary/15 text-primary grid size-8 shrink-0 place-items-center rounded-lg text-[13px] font-semibold tabular-nums"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <span className="min-w-0 pt-[calc((2rem-1lh)/2)]">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="border-border bg-card/80 shadow-card mt-10 max-w-md rounded-2xl border p-5 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-[12px] font-medium tracking-wide uppercase">
              Today&apos;s pick
            </p>
            <p className="font-display mt-1.5 text-[18px] font-semibold text-[var(--card-foreground)]">
              {SAMPLE_MATCH.title}
            </p>
            <p className="text-muted-foreground mt-0.5 text-[14px]">
              {SAMPLE_MATCH.company}
            </p>
          </div>
          <div className="bg-primary/15 text-primary rounded-xl px-3 py-2 text-center">
            <p className="font-display text-[22px] leading-none font-bold tabular-nums">
              {SAMPLE_MATCH.score}
            </p>
            <p className="mt-1 text-[10px] font-medium tracking-wide uppercase opacity-80">
              match
            </p>
          </div>
        </div>
        <ul className="mt-4 space-y-2.5">
          {SAMPLE_MATCH.reasons.map((reason) => (
            <li
              key={reason}
              className="text-foreground/90 flex gap-2.5 text-[13px] leading-[1.4]"
            >
              <span
                className="bg-success/20 text-success mt-[0.45em] size-1.5 shrink-0 rounded-full"
                aria-hidden="true"
              />
              <span className="min-w-0">{reason}</span>
            </li>
          ))}
        </ul>
        <p className="border-border text-muted-foreground mt-4 border-t pt-3 text-[12px] leading-snug">
          Watch for: {SAMPLE_MATCH.concern}
        </p>
      </div>
    </>
  );
}
