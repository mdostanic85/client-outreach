import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Keep the last two words of each sentence together so one word never sits alone on a line. */
export function noWidow(text: string): string {
  return text
    .split(/([.!?…]+\s*)/)
    .map((part) => {
      if (/^[.!?…]+\s*$/.test(part)) return part
      const trailing = part.match(/\s*$/)?.[0] ?? ""
      const core = part.slice(0, part.length - trailing.length)
      const i = core.lastIndexOf(" ")
      if (i === -1) return part
      return `${core.slice(0, i)}\u00A0${core.slice(i + 1)}${trailing}`
    })
    .join("")
}
