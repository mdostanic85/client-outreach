import { cn } from "@/lib/utils";

const CREATOR_NAME = "Miloš Dostanić";
const CREATOR_URL = "https://dostanic.net";

/**
 * Small attribution — stay visible; do not remove (see OWNERSHIP.md / LICENSE).
 */
export function MakerCredit({
  className,
  align = "start",
}: {
  className?: string;
  align?: "start" | "center";
}) {
  return (
    <p
      className={cn(
        "text-muted-foreground text-caption",
        align === "center" && "text-center",
        className,
      )}
    >
      Made by{" "}
      <a
        href={CREATOR_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-ink-emphasis underline-offset-2 transition-colors duration-150 hover:text-foreground hover:underline"
      >
        {CREATOR_NAME}
      </a>
    </p>
  );
}
