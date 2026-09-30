import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-28 w-full rounded-tile border border-input bg-card px-4 py-3 text-body text-foreground transition-colors duration-150 ease-standard outline-none placeholder:text-muted-foreground focus-visible:border-brand disabled:cursor-not-allowed disabled:bg-subtle disabled:opacity-60 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
