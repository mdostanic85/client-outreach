"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Content for `<Button variant="capsule">`: a verdigris icon capsule and a
 * label that swap sides on hover or keyboard focus (700ms, `ease-standard`).
 * Reserved for the single hero CTA on welcome / onboarding and the main
 * search action. Reduced motion keeps both in place.
 */
export function CapsuleLabel({
  children,
  icon = <ArrowRight />,
  className,
}: {
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  const capsuleRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState({ capsule: 0, label: 0 });

  useLayoutEffect(() => {
    const capsule = capsuleRef.current;
    const label = labelRef.current;
    if (!capsule || !label) return;
    const measure = () =>
      setShift({ capsule: label.offsetWidth, label: capsule.offsetWidth });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(capsule);
    observer.observe(label);
    return () => observer.disconnect();
  }, []);

  return (
    <span
      className={cn("relative flex h-full items-center", className)}
      style={
        {
          "--capsule-shift": `${shift.capsule}px`,
          "--label-shift": `-${shift.label}px`,
        } as CSSProperties
      }
    >
      <span
        ref={capsuleRef}
        aria-hidden
        className="bg-brand-gradient text-on-brand relative z-10 flex h-10 w-14 shrink-0 items-center justify-center rounded-full transition-transform duration-700 ease-standard group-hover/button:translate-x-(--capsule-shift) group-focus-visible/button:translate-x-(--capsule-shift) motion-reduce:transition-none motion-reduce:group-hover/button:translate-x-0 motion-reduce:group-focus-visible/button:translate-x-0 [&_svg:not([class*='size-'])]:size-[18px]"
      >
        {icon}
      </span>
      <span
        ref={labelRef}
        className="flex-1 px-5 text-center transition-transform duration-700 ease-standard group-hover/button:translate-x-(--label-shift) group-focus-visible/button:translate-x-(--label-shift) motion-reduce:transition-none motion-reduce:group-hover/button:translate-x-0 motion-reduce:group-focus-visible/button:translate-x-0"
      >
        {children}
      </span>
    </span>
  );
}
