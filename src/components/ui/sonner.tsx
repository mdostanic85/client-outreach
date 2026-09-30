"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "transparent",
          "--border-radius": "16px",
          "--success-bg": "var(--success-wash)",
          "--success-text": "var(--success)",
          "--success-border": "transparent",
          "--error-bg": "var(--destructive-wash)",
          "--error-text": "var(--destructive)",
          "--error-border": "transparent",
          "--warning-bg": "var(--warn-wash)",
          "--warning-text": "var(--warn)",
          "--warning-border": "transparent",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast font-sans text-body-sm",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
