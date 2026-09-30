"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useReducedMotion,
} from "motion/react";

import { cn } from "@/lib/utils";

const ENTER = [0.22, 1, 0.36, 1] as const;
const EXIT = [0.32, 0, 0.67, 0] as const;

/**
 * Value swap for numbers or short labels that change on a toggle or filter:
 * the old value leaves up 12px (220ms), the new one arrives from 12px below
 * (280ms). Reduced motion swaps instantly.
 */
export function ValueSwap({
  value,
  children,
  className,
}: {
  /** Changing this key triggers the swap. */
  value: string | number;
  children?: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <span className={cn("relative inline-grid overflow-hidden align-bottom", className)}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          className="col-start-1 row-start-1"
          initial={reduce ? false : { y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1, transition: { duration: 0.28, ease: ENTER } }}
          exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { y: -12, opacity: 0, transition: { duration: 0.22, ease: EXIT } }}
        >
          {children ?? value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/**
 * Counts up to `value` once, the first time it scrolls into view. Renders the
 * final value on the server and under reduced motion.
 */
export function CountUp({
  value,
  format = (n) => Math.round(n).toLocaleString(),
  duration = 1.2,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState<number | null>(null);
  const played = useRef(false);

  useEffect(() => {
    if (!inView || reduce || played.current) return;
    played.current = true;
    const controls = animate(0, value, {
      duration,
      ease: ENTER,
      onUpdate: setDisplay,
      onComplete: () => setDisplay(null),
    });
    return () => controls.stop();
  }, [inView, reduce, value, duration]);

  return (
    <span ref={ref} className={cn("tabular", className)}>
      {format(display ?? value)}
    </span>
  );
}
