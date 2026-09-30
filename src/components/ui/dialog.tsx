"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** Scrim: ink at 35% + 14px blur. Fades in 220ms, out 160ms. */
export const OVERLAY_CLASSES =
  "fixed inset-0 z-50 bg-(--scrim) supports-backdrop-filter:backdrop-blur-[14px] transition-opacity duration-220 ease-enter data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-160 data-ending-style:ease-exit";

/**
 * Modal choreography (audit §5.16). Panel rises from y 28 / scale .94 over
 * 320ms; its direct children follow from y 16 with a 45ms stagger. Exit is
 * ~60% of that with `ease-exit`. Reduced motion keeps only the fade.
 */
const DIALOG_MOTION =
  "transition-[opacity,transform] duration-320 ease-enter data-starting-style:opacity-0 data-starting-style:[transform:translateY(28px)_scale(0.94)] data-ending-style:opacity-0 data-ending-style:duration-180 data-ending-style:ease-exit data-ending-style:[transform:translateY(16px)_scale(0.96)] [&>*]:transition-[opacity,transform] [&>*]:duration-280 [&>*]:ease-enter [&>*:nth-child(2)]:delay-45 [&>*:nth-child(3)]:delay-90 [&>*:nth-child(4)]:delay-135 data-starting-style:[&>*]:opacity-0 data-starting-style:[&>*]:[transform:translateY(16px)] data-ending-style:[&>*]:opacity-0 data-ending-style:[&>*]:delay-0 data-ending-style:[&>*]:duration-120 data-ending-style:[&>*]:ease-exit data-ending-style:[&>*]:[transform:translateY(8px)] motion-reduce:data-starting-style:[transform:none] motion-reduce:data-ending-style:[transform:none] motion-reduce:data-starting-style:[&>*]:[transform:none] motion-reduce:data-ending-style:[&>*]:[transform:none]";

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(OVERLAY_CLASSES, className)}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean;
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "bg-popover text-popover-foreground shadow-overlay fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100svh-2rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-0 overflow-hidden rounded-card text-body-sm outline-none sm:max-w-lg",
          DIALOG_MOTION,
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-4 right-4"
                size="icon-sm"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1 p-6 pr-16 max-sm:p-5 max-sm:pr-14", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "mt-auto flex flex-col-reverse gap-2 border-t border-border p-5 sm:flex-row sm:items-center sm:justify-end sm:px-6",
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-h5 text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-body-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
