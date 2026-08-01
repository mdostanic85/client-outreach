import { nanoid } from "nanoid";

export function newId(prefix?: string) {
  const id = nanoid(12);
  return prefix ? `${prefix}_${id}` : id;
}

export function nowIso() {
  return new Date().toISOString();
}
