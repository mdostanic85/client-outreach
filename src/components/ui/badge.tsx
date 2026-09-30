import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * 12px pills with a 1px border. Neutral variants read as chips; the tinted
 * ones (brand / success / warn / destructive) carry status. `StatePill`,
 * `PolicyPill` and `ScoreBadge` are built on these variants.
 */
const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border px-2.5 text-caption font-medium whitespace-nowrap transition-colors duration-150 ease-standard has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 aria-invalid:border-destructive [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "border-brand/30 bg-brand-wash text-brand-ink",
        brand: "border-brand/30 bg-brand-wash text-brand-ink",
        secondary: "border-transparent bg-subtle text-ink-emphasis",
        outline:
          "border-border-strong bg-card text-foreground [a]:hover:bg-subtle",
        success: "border-success/25 bg-success-wash text-success",
        warn: "border-warn/25 bg-warn-wash text-warn",
        destructive:
          "border-destructive/25 bg-destructive-wash text-destructive",
        inverse: "border-transparent bg-primary text-primary-foreground",
        ghost:
          "border-transparent text-muted-foreground hover:bg-subtle hover:text-foreground",
        link: "border-transparent px-0 text-brand-ink underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-5 px-2",
        md: "",
        lg: "h-7 px-3 text-body-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

function Badge({
  className,
  variant = "default",
  size = "md",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant, size }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
