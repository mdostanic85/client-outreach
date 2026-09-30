import type { CSSProperties, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

type AnimateInProps = {
  children: ReactNode;
  className?: string;
  /** fade-up (default) | fade | scale */
  variant?: "up" | "fade" | "scale";
  /** Extra delay before entrance, in ms */
  delayMs?: number;
  as?: ElementType;
};

/**
 * First-load reveal for page headers and empty states: opacity, 8px rise and
 * 8px blur resolving to sharp over ~360ms (`ease/enter`). Reduced motion
 * turns it off in globals.css. Do not wrap list rows in this.
 */
export function AnimateIn({
  children,
  className,
  variant = "up",
  delayMs = 0,
  as: Tag = "div",
}: AnimateInProps) {
  const anim =
    variant === "fade"
      ? "animate-enter-fade"
      : variant === "scale"
        ? "animate-enter-scale"
        : "animate-enter";

  return (
    <Tag
      className={cn(anim, className)}
      style={
        delayMs > 0
          ? ({ animationDelay: `${delayMs}ms` } as CSSProperties)
          : undefined
      }
    >
      {children}
    </Tag>
  );
}

type StaggerProps = {
  children: ReactNode;
  className?: string;
  as?: ElementType;
};

/** Parent for list/grid children. */
export function Stagger({
  children,
  className,
  as: Tag = "div",
}: StaggerProps) {
  return <Tag className={className}>{children}</Tag>;
}

type StaggerItemProps = {
  children: ReactNode;
  className?: string;
  /** Position in the list; staggers the reveal by 50ms (capped at 5 steps). */
  index?: number;
  as?: ElementType;
  maxIndex?: number;
};

/**
 * List/grid child. It comes into focus (blur → sharp, rising) the first time
 * it scrolls into view; siblings revealed together are staggered by index.
 */
export function StaggerItem({
  children,
  className,
  index = 0,
  as: Tag = "div",
}: StaggerItemProps) {
  const step = Math.min(Math.max(index, 0), 5);
  return (
    <Tag
      data-reveal
      className={className}
      style={step > 0 ? ({ "--reveal-delay": `${step * 50}ms` } as CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
