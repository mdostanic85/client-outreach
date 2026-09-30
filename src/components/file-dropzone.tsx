"use client";

import { Upload } from "lucide-react";
import { useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function FileDropzone({
  accept = ".pdf,.txt,.md",
  disabled,
  label = "Drop a file here, or click to browse",
  hint = "PDF, TXT, or MD",
  onFile,
  className,
}: {
  accept?: string;
  disabled?: boolean;
  label?: string;
  hint?: string;
  onFile: (file: File) => void;
  className?: string;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function takeFile(file: File | undefined | null) {
    if (!file || disabled) return;
    onFile(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className={cn("relative", className)}>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => takeFile(e.target.files?.[0])}
      />
      <label
        htmlFor={inputId}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled) setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragging(false);
          takeFile(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "border-ink-tertiary bg-card flex cursor-pointer flex-col items-center justify-center gap-3 rounded-card border border-dashed px-6 py-8 text-center transition-[border-color,background-color] duration-150 ease-standard hover:border-brand in-[.bg-card]:bg-subtle in-[.bg-card]:shadow-none shadow-card",
          "focus-within:outline-ring focus-within:outline-2 focus-within:outline-offset-2",
          dragging && "border-brand bg-brand-wash",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <span className="bg-brand-wash text-brand-ink flex size-12 items-center justify-center rounded-tile">
          <Upload className="size-5" aria-hidden />
        </span>
        <span className="text-foreground text-body font-medium">
          {label}
        </span>
        <span className="text-muted-foreground text-body-sm">
          {hint}
        </span>
      </label>
    </div>
  );
}
