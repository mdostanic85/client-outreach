import { Surface } from "@/components/page-shell";
import type { ApplicationPackageView } from "@/modules/applications/packages";


/** Email / phone / link from the posting: many local jobs are applied to directly. */
export function HowToApplyPanel({ pkg }: { pkg: ApplicationPackageView }) {
  const { emails, phones, links } = pkg.howToApply;
  if (!emails.length && !phones.length && !links.length) return null;
  return (
    <Surface>
      <div className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:gap-5">
        <p className="text-body font-medium text-foreground">
          How to apply
        </p>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-body-sm">
          {emails.map((email) => (
            <li key={email}>
              <a className="text-brand-ink hover:underline" href={`mailto:${email}`}>
                {email}
              </a>
            </li>
          ))}
          {phones.map((phone) => (
            <li key={phone}>
              <a className="text-brand-ink hover:underline" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>
                {phone}
              </a>
            </li>
          ))}
          {links.map((link) => (
            <li key={link} className="max-w-full truncate">
              <a className="text-brand-ink hover:underline" href={link} target="_blank" rel="noreferrer">
                Application form
              </a>
            </li>
          ))}
        </ul>
      </div>
    </Surface>
  );
}
