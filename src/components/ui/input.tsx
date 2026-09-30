import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

/**
 * 44px field, 12px radius, 1px border, white fill. `variant="search"` is the
 * 48px pill with room for a leading icon (see `SearchField`).
 */
function Input({
  className,
  type,
  variant = "default",
  ...props
}: React.ComponentProps<"input"> & { variant?: "default" | "search" }) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
          "h-11 w-full min-w-0 rounded-tile border border-input bg-card px-4 py-2.5 text-body text-foreground transition-colors duration-150 ease-standard outline-none file:inline-flex file:h-8 file:border-0 file:bg-transparent file:text-body-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-brand disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-subtle disabled:opacity-60 aria-invalid:border-destructive",
          variant === "search" &&
            "h-12 rounded-full pl-12 pr-5",
        className
      )}
      {...props}
    />
  )
}

/**
 * Pill search field: a leading icon in a 40px tinted capsule inside a 48px
 * white pill. Extra controls (a submit button) go in `trailing`.
 */
function SearchField({
  icon,
  trailing,
  className,
  inputClassName,
  ...props
}: React.ComponentProps<"input"> & {
  icon: React.ReactNode
  trailing?: React.ReactNode
  inputClassName?: string
}) {
  return (
    <div data-slot="search-field" className={cn("relative flex w-full items-center", className)}>
      <span
        aria-hidden
        className="bg-subtle text-muted-foreground pointer-events-none absolute top-1 left-1 flex size-10 items-center justify-center rounded-full [&_svg]:size-4"
      >
        {icon}
      </span>
      <Input
        variant="search"
        className={cn(trailing ? "pr-28" : undefined, inputClassName)}
        {...props}
      />
      {trailing ? (
        <span className="absolute top-1 right-1 flex items-center">{trailing}</span>
      ) : null}
    </div>
  )
}

export { Input, SearchField }
