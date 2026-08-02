import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const VARIANTS = {
  error: {
    icon: AlertCircle,
    className:
      "border-destructive/30 bg-destructive/10 text-destructive",
  },
  success: {
    icon: CheckCircle2,
    className:
      "border-[color-mix(in_oklab,var(--success)_35%,transparent)] bg-[color-mix(in_oklab,var(--success)_12%,transparent)] text-[var(--success)]",
  },
  info: {
    icon: Info,
    className: "border-border bg-muted/40 text-muted-foreground",
  },
} as const;

export function InlineAlert({
  variant = "info",
  children,
  className,
}: {
  variant?: keyof typeof VARIANTS;
  children: React.ReactNode;
  className?: string;
}) {
  const config = VARIANTS[variant];
  const Icon = config.icon;

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "animate-enter flex items-start gap-3 rounded-xl border px-4 py-3 text-[14px] leading-relaxed",
        config.className,
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0 opacity-90" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
