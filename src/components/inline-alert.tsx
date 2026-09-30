import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const VARIANTS = {
  error: {
    icon: AlertCircle,
    className:
      "border-destructive/20 bg-destructive-wash text-destructive",
  },
  success: {
    icon: CheckCircle2,
    className:
      "border-success/20 bg-success-wash text-success",
  },
  info: {
    icon: Info,
    className: "border-transparent bg-subtle text-ink-emphasis in-[.bg-subtle]:bg-card",
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
        "flex items-start gap-3 rounded-tile border px-4 py-3 text-body-sm",
        config.className,
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
