import { cn } from "@/lib/utils";

/**
 * Sticky save bar for long forms: a floating white pill (a true overlay, so
 * it carries the overlay shadow). Buttons stretch full width on phones.
 */
export function StickyFormActions({
  children,
  visible = true,
  className,
  message,
}: {
  children: React.ReactNode;
  visible?: boolean;
  className?: string;
  message?: React.ReactNode;
}) {
  if (!visible) return null;

  return (
    <div
      className={cn(
        "bg-card/90 sticky bottom-4 z-20 mt-8 rounded-full px-4 py-2.5 shadow-overlay backdrop-blur-xl max-sm:rounded-card max-sm:py-3 sm:pl-6",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {message ? (
          <p className="text-muted-foreground text-body-sm">{message}</p>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap items-center gap-2 max-sm:w-full max-sm:[&>*]:flex-1">{children}</div>
      </div>
    </div>
  );
}
