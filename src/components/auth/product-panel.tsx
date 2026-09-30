"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { cn, noWidow } from "@/lib/utils";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const HOLD_MS = 4200;

type Match = {
  id: string;
  role: string;
  company: string;
  score: number;
  tag: string;
  why: string;
  watch: string;
};

/** Product-true sample shortlist — denser than marketing copy alone. */
const MATCHES: Match[] = [
  {
    id: "m1",
    role: "Nurse, Intensive Care",
    company: "Clinical Centre, Belgrade",
    score: 91,
    tag: "Strong fit",
    why: "Five years in ICU and a valid licence match what the ward asks for.",
    watch: "Night shifts every other week — you said nights are fine.",
  },
  {
    id: "m2",
    role: "Truck Driver CE",
    company: "Logistics firm, Novi Sad",
    score: 86,
    tag: "Worth a look",
    why: "CE, ADR and a tachograph card — every required licence is on your profile.",
    watch: "Two-week tours; you prefer weekends at home.",
  },
  {
    id: "m3",
    role: "Senior Frontend Developer",
    company: "Product studio, remote",
    score: 79,
    tag: "Worth a look",
    why: "React and TypeScript work on your last two roles lines up with the stack.",
    watch: "Remote within the EU only — confirm your contract setup.",
  },
];

/**
 * Pin / Remote–inspired auth panel: large product mock fills the pane.
 * Highlight cycles inside the mock — no single-headline carousel, no empty void.
 */
export function ProductPanel() {
  const reducedMotion = useReducedMotion() ?? false;
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    const id = window.setInterval(() => {
      setActive((current) => (current + 1) % MATCHES.length);
    }, HOLD_MS);
    return () => window.clearInterval(id);
  }, [reducedMotion]);

  const current = MATCHES[active]!;

  return (
    <div className="relative flex h-full min-h-[26rem] w-full flex-col overflow-hidden lg:min-h-full">
      {/* Atmosphere — Remote concentric rings + soft wash */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 80% at 50% 18%, #14201c 0%, #0a0c11 55%, #080a0e 100%)",
          }}
        />
        {[42, 58, 74].map((size, i) => (
          <div
            key={size}
            className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 rounded-full border"
            style={{
              width: `${size}%`,
              aspectRatio: "1",
              borderColor: `color-mix(in oklch, var(--primary) ${8 - i * 2}%, transparent)`,
              opacity: 0.55 - i * 0.12,
            }}
          />
        ))}
        <motion.div
          className="absolute left-1/2 top-[36%] size-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[90px]"
          animate={
            reducedMotion
              ? { opacity: 0.22 }
              : { opacity: [0.16, 0.3, 0.16], scale: [1, 1.06, 1] }
          }
          transition={
            reducedMotion
              ? { duration: 0 }
              : { duration: 9, repeat: Infinity, ease: "easeInOut" }
          }
          style={{
            background:
              "radial-gradient(circle, color-mix(in oklch, var(--primary) 50%, transparent), transparent 70%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
      </div>

      <p className="sr-only">
        Optra shows a short daily list of roles with reasons to apply and what
        to watch — you choose interested, save, or pass. Nothing sends itself.
      </p>

      <div className="relative z-10 flex h-full min-h-0 flex-col justify-between px-6 py-8 sm:px-10 sm:py-10 xl:px-14 xl:py-12">
        <div className="shrink-0">
          <p className="text-primary text-[12px] font-medium tracking-[0.14em] uppercase">
            Private shortlist
          </p>
          <h2 className="font-display text-[var(--card-foreground)] mt-3 max-w-lg text-[1.75rem] leading-[1.12] font-semibold tracking-tight sm:text-[2.05rem]">
            {noWidow("A short daily list — with reasons, not noise.")}
          </h2>
        </div>

        {/* Product stage */}
        <div className="relative mx-auto mt-8 flex min-h-0 w-full max-w-[34rem] flex-1 flex-col justify-center sm:mt-10">
          <motion.div
            className="relative"
            animate={
              reducedMotion ? undefined : { y: [0, -6, 0] }
            }
            transition={
              reducedMotion
                ? undefined
                : { duration: 7, repeat: Infinity, ease: "easeInOut" }
            }
          >
            {/* Floating reason chip — Pin-style overlay */}
            <AnimatePresence mode="wait">
              <motion.aside
                key={current.id}
                className="border-border/50 bg-card/90 absolute -right-1 -top-3 z-20 max-w-[15.5rem] rounded-2xl border px-3.5 py-3 backdrop-blur-md sm:-right-4 sm:-top-4 sm:max-w-[17rem]"
                initial={
                  reducedMotion ? false : { opacity: 0, y: 10, scale: 0.96 }
                }
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={
                  reducedMotion
                    ? undefined
                    : { opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.2 } }
                }
                transition={{ duration: 0.4, ease: EASE }}
                aria-hidden
              >
                <p className="text-primary text-[10px] font-medium tracking-[0.12em] uppercase">
                  Why it fits
                </p>
                <p className="text-[var(--card-foreground)] mt-1.5 text-[13px] leading-snug">
                  {current.why}
                </p>
              </motion.aside>
            </AnimatePresence>

            {/* Main inbox mock */}
            <div
              className="border-border/60 bg-card/75 relative overflow-hidden rounded-[1.35rem] border backdrop-blur-sm"
              role="list"
              aria-label="Example daily shortlist"
            >
              <div className="border-border/50 flex items-center justify-between border-b px-4 py-3.5 sm:px-5">
                <div>
                  <p className="text-[var(--card-foreground)] text-[14px] font-medium">
                    Today
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-[12px]">
                    3 matches · reviewed by you
                  </p>
                </div>
                <span className="bg-primary/15 text-primary rounded-full px-2.5 py-1 text-[11px] font-medium">
                  Live preview
                </span>
              </div>

              <div className="divide-border/40 divide-y">
                {MATCHES.map((match, i) => {
                  const isActive = i === active;
                  return (
                    <button
                      key={match.id}
                      type="button"
                      role="listitem"
                      className={cn(
                        "w-full px-4 py-3.5 text-left transition-colors duration-300 sm:px-5 sm:py-4",
                        isActive
                          ? "bg-primary/[0.07]"
                          : "hover:bg-white/[0.02]",
                      )}
                      onClick={() => setActive(i)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p
                              className={cn(
                                "truncate text-[14px] font-medium sm:text-[15px]",
                                isActive
                                  ? "text-[var(--card-foreground)]"
                                  : "text-muted-foreground",
                              )}
                            >
                              {match.role}
                            </p>
                            {isActive ? (
                              <span className="bg-primary/20 text-primary shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase">
                                {match.tag}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-muted-foreground mt-1 text-[12px] sm:text-[13px]">
                            {match.company}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "font-mono shrink-0 text-[13px] tabular-nums",
                            isActive ? "text-primary" : "text-muted-foreground/70",
                          )}
                        >
                          {match.score}
                        </span>
                      </div>

                      <AnimatePresence initial={false}>
                        {isActive ? (
                          <motion.div
                            key={`${match.id}-detail`}
                            initial={
                              reducedMotion
                                ? false
                                : { opacity: 0, height: 0 }
                            }
                            animate={{ opacity: 1, height: "auto" }}
                            exit={
                              reducedMotion
                                ? undefined
                                : {
                                    opacity: 0,
                                    height: 0,
                                    transition: { duration: 0.2 },
                                  }
                            }
                            transition={{ duration: 0.35, ease: EASE }}
                            className="overflow-hidden"
                          >
                            <p className="text-muted-foreground mt-3 text-[13px] leading-relaxed">
                              <span className="text-[var(--card-foreground)]/80 font-medium">
                                Watch:{" "}
                              </span>
                              {match.watch}
                            </p>
                            <div className="mt-3.5 flex flex-wrap gap-2">
                              {["Interested", "Save", "Pass"].map((label) => (
                                <span
                                  key={label}
                                  className={cn(
                                    "rounded-lg border px-2.5 py-1 text-[11px] font-medium",
                                    label === "Interested"
                                      ? "border-primary/40 bg-primary/15 text-primary"
                                      : "border-border/60 text-muted-foreground",
                                  )}
                                >
                                  {label}
                                </span>
                              ))}
                            </div>
                            {!reducedMotion ? (
                              <span className="bg-border/50 relative mt-4 block h-[2px] w-full overflow-hidden rounded-full">
                                <motion.span
                                  key={`bar-${active}`}
                                  className="absolute inset-y-0 left-0 rounded-full bg-primary"
                                  initial={{ width: "0%" }}
                                  animate={{ width: "100%" }}
                                  transition={{
                                    duration: HOLD_MS / 1000,
                                    ease: "linear",
                                  }}
                                />
                              </span>
                            ) : null}
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>

        <p className="text-muted-foreground mt-8 max-w-md shrink-0 text-[14px] leading-relaxed sm:mt-10 sm:text-[15px]">
          {noWidow(
            "Matched to your profile. Explained in plain language. Nothing applies or sends itself.",
          )}
        </p>
      </div>
    </div>
  );
}
