import { useSyncExternalStore } from "react";

/**
 * sessionStorage-backed value shared across components. Server render and the
 * hydration pass see `fallback`; the stored value arrives right after, without
 * a setState-in-effect round trip.
 */
export function createSessionStore<T>(key: string, fallback: T) {
  let cache: T | undefined;
  const listeners = new Set<() => void>();

  const get = (): T => {
    if (cache === undefined) {
      try {
        const raw = sessionStorage.getItem(key);
        cache = raw ? (JSON.parse(raw) as T) : fallback;
      } catch {
        cache = fallback;
      }
    }
    return cache;
  };

  const set = (next: T | ((prev: T) => T)) => {
    cache = typeof next === "function" ? (next as (prev: T) => T)(get()) : next;
    try {
      sessionStorage.setItem(key, JSON.stringify(cache));
    } catch {
      /* storage unavailable or full — keep the in-memory value */
    }
    listeners.forEach((listener) => listener());
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const useValue = (): T => useSyncExternalStore(subscribe, get, () => fallback);

  return { get, set, useValue };
}
