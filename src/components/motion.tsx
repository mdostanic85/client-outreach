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
 * Single-element entrance. Corporate ease — Mobbin (Vercel / Basedash).
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

/** Parent for staggered list/grid entrances. */
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
  index: number;
  as?: ElementType;
  /** Cap delay so long lists don't feel slow (default 10 → 400ms) */
  maxIndex?: number;
};

/**
 * Child entrance with 40ms cascade (motion skill micro-cascade).
 * Caps at maxIndex so 50-item lists don't wait seconds.
 */
export function StaggerItem({
  children,
  className,
  index,
  as: Tag = "div",
  maxIndex = 10,
}: StaggerItemProps) {
  const capped = Math.min(Math.max(index, 0), maxIndex);
  return (
    <Tag
      className={cn("stagger-item", className)}
      style={{ "--stagger-index": capped } as CSSProperties}
    >
      {children}
    </Tag>
  );
}
