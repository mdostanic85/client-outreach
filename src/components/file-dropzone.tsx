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
          "border-border bg-muted/20 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed px-6 py-8 text-center transition-colors",
          "hover:border-primary/50 hover:bg-muted/35",
          "focus-within:border-ring focus-within:ring-ring/40 focus-within:ring-3",
          dragging && "border-primary bg-accent/40",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <span className="bg-secondary text-accent-foreground flex size-10 items-center justify-center rounded-xl">
          <Upload className="size-4" aria-hidden />
        </span>
        <span className="text-card-foreground text-[14px] font-medium">
          {label}
        </span>
        <span className="text-muted-foreground text-[12px]">{hint}</span>
      </label>
    </div>
  );
}
