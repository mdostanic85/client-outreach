"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

/** Toggle: neutral track off, verdigris on. 250ms thumb slide. */
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "bg-border-strong data-checked:bg-brand relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-250 ease-standard data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="bg-card block size-5 rounded-full transition-transform duration-250 ease-enter data-checked:translate-x-5 motion-reduce:transition-none" />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
