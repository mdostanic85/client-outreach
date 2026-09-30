import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Pill buttons. Hover is a 150ms color/surface change; focus uses the global
 * 2px verdigris ring. `secondary` turns to the subtle tint when it sits on a
 * white surface so it never disappears into a card.
 */
const buttonVariants = cva(
  "group/button pressable inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-transparent bg-clip-padding font-medium whitespace-nowrap outline-none select-none transition-[background-color,color,border-color,opacity] duration-150 ease-standard disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground hover:bg-primary/85 aria-expanded:bg-primary/85",
        default:
          "bg-primary text-primary-foreground hover:bg-primary/85 aria-expanded:bg-primary/85",
        secondary:
          "bg-card text-foreground hover:bg-subtle aria-expanded:bg-subtle in-[.bg-card]:bg-subtle in-[.bg-popover]:bg-subtle in-[.bg-card]:hover:bg-border-hover in-[.bg-popover]:hover:bg-border-hover",
        outline:
          "border-border bg-card text-foreground hover:border-border-strong hover:bg-subtle aria-expanded:bg-subtle",
        ghost:
          "text-muted-foreground hover:border-border-hover hover:text-foreground aria-expanded:border-border-hover aria-expanded:text-foreground",
        icon: "border-input bg-transparent text-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground aria-expanded:border-primary aria-expanded:bg-primary aria-expanded:text-primary-foreground",
        destructive:
          "bg-destructive-wash text-destructive hover:bg-destructive hover:text-white",
        link: "h-auto rounded-md px-0 text-brand-ink underline-offset-4 hover:underline",
        /** Hero CTA shell for `CapsuleLabel`: dark pill, 4px inset. */
        capsule:
          "overflow-hidden bg-primary p-1 text-primary-foreground hover:bg-primary",
      },
      size: {
        xs: "h-8 px-3 text-body-sm has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-9 px-4 text-body-sm has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        md: "h-11 px-5 text-body has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        default:
          "h-11 px-5 text-body has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        lg: "h-12 px-6 text-body has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        icon: "size-11",
        "icon-xs": "size-8 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-9",
        "icon-lg": "size-12",
      },
    },
    compoundVariants: [
      { variant: "capsule", className: "h-12 px-1" },
      { variant: "link", className: "h-auto px-0" },
    ],
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
