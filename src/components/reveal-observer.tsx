"use client";

import { useEffect } from "react";

/**
 * Marks `[data-reveal]` elements as `data-in` the first time they scroll into
 * view, which plays the blur-to-sharp rise defined in globals.css. Also picks
 * up elements added later (route changes, opened panels). Mounted once in the
 * root layout.
 */
export function RevealObserver() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      document.documentElement.classList.remove("reveal-ready");
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-in", "");
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.04 },
    );

    const watched = new WeakSet<Element>();
    const scan = () => {
      document.querySelectorAll("[data-reveal]:not([data-in])").forEach((el) => {
        if (watched.has(el)) return;
        watched.add(el);
        io.observe(el);
      });
    };

    scan();
    const mutations = new MutationObserver(scan);
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mutations.disconnect();
    };
  }, []);

  return null;
}
