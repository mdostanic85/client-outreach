import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Pill buttons. Every variant has a hover that stays visible on the page
 * tint, on a white card and inside the dark sidebar: the hover surface
 * (`bg-hover`) is darker than both white and the page, never the same tint
 * as the background. Press scales to 98%; focus uses the global 2px ring.
 *
 *  primary     near-black fill, a slightly lighter solid on hover
 *  secondary   white pill with a hairline shadow, hover surface + border
 *  outline     white pill with a 1px border, hover surface + stronger border
 *  ghost       text only, hover surface
 *  icon        round and outlined, fills dark on hover
 *  destructive tinted red, solid red on hover
 *  capsule     hero CTA shell, use with <CapsuleLabel>
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-transparent bg-clip-padding font-medium whitespace-nowrap outline-none select-none transition-[background-color,color,border-color,box-shadow,opacity,transform] duration-150 ease-standard active:scale-[0.98] motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground hover:bg-primary-hover aria-expanded:bg-primary-hover",
        default:
          "bg-primary text-primary-foreground hover:bg-primary-hover aria-expanded:bg-primary-hover",
        secondary:
          "bg-card text-foreground shadow-xs hover:border-border-strong hover:bg-hover hover:shadow-none aria-expanded:bg-hover in-[.bg-card]:bg-subtle in-[.bg-card]:shadow-none in-[.bg-card]:hover:bg-hover in-[.bg-popover]:bg-subtle in-[.bg-popover]:shadow-none in-[.bg-popover]:hover:bg-hover",
        outline:
          "border-border-strong bg-card text-foreground hover:border-ink-tertiary hover:bg-hover aria-expanded:bg-hover",
        ghost:
          "text-muted-foreground hover:bg-hover hover:text-foreground aria-expanded:bg-hover aria-expanded:text-foreground",
        icon: "border-input bg-card text-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground aria-expanded:border-primary aria-expanded:bg-primary aria-expanded:text-primary-foreground",
        destructive:
          "bg-destructive-wash text-destructive hover:bg-destructive hover:text-white",
        link: "h-auto rounded-md px-0 text-brand-ink underline-offset-4 hover:underline active:scale-100",
        /** Hero CTA shell for `CapsuleLabel`: dark pill, 4px inset. */
        capsule:
          "overflow-hidden bg-primary p-1 text-primary-foreground hover:bg-primary-hover",
      },
      size: {
        xs: "h-8 px-3 text-body-sm has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-9 px-4 text-body-sm has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        md: "h-11 px-5 text-body has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        default:
          "h-11 px-5 text-body has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        lg: "h-12 px-6 text-body has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        icon: "size-11 px-0",
        "icon-xs": "size-8 px-0 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-9 px-0",
        "icon-lg": "size-12 px-0",
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
