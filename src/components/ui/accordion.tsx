"use client";

import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Accordion for detail pages. Items are white 20px cards 16px apart; the
 * panel animates its measured height with opacity over 300ms. Single-open by
 * default (`multiple` to allow more).
 */
function Accordion({ className, ...props }: AccordionPrimitive.Root.Props) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      className={cn("flex flex-col gap-4", className)}
      {...props}
    />
  );
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      data-reveal
      className={cn(
        "bg-card shadow-card rounded-card px-4 in-[.bg-card]:bg-subtle in-[.bg-card]:shadow-none sm:px-6",
        className,
      )}
      {...props}
    />
  );
}

function AccordionTrigger({
  className,
  children,
  ...props
}: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "group/accordion-trigger text-foreground flex min-h-16 flex-1 items-center justify-between gap-4 rounded-tile py-4 text-left text-body-lg outline-none",
          className,
        )}
        {...props}
      >
        <span className="min-w-0 flex-1">{children}</span>
        <span
          aria-hidden
          className="border-input text-foreground flex size-8 shrink-0 items-center justify-center rounded-full border transition-[transform,background-color,color,border-color] duration-300 ease-standard group-hover/accordion-trigger:border-primary group-hover/accordion-trigger:bg-primary group-hover/accordion-trigger:text-primary-foreground group-data-panel-open/accordion-trigger:rotate-45 motion-reduce:transition-colors"
        >
          <Plus className="size-4" />
        </span>
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionPanel({
  className,
  children,
  ...props
}: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-panel"
      className="h-(--accordion-panel-height) overflow-hidden opacity-100 transition-[height,opacity] duration-300 ease-standard data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0 motion-reduce:transition-none"
      {...props}
    >
      <div className={cn("text-muted-foreground pb-5 text-body", className)}>
        {children}
      </div>
    </AccordionPrimitive.Panel>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionPanel };
