import Link from "next/link";
import { cn } from "@/lib/utils";

type OptraLogoProps = {
  href?: string;
  /** Wordmark height in px (width scales from Figma artboard). */
  height?: number;
  /** Wordmark width in px — takes precedence over height when set. */
  width?: number;
  className?: string;
  onClick?: () => void;
};

/** Official Optra wordmark artboard (Figma). */
const VIEW_W = 100.118;
const VIEW_H = 38.47;

/**
 * Official Optra wordmark (SVG) — white type + teal p-descender.
 */
export function OptraLogo({
  href = "/",
  height,
  width,
  className,
  onClick,
}: OptraLogoProps) {
  const w =
    width ?? Math.round(((height ?? 22) * VIEW_W) / VIEW_H);
  const h = height ?? Math.round((w * VIEW_H) / VIEW_W);

  const mark = (
    // eslint-disable-next-line @next/next/no-img-element -- SVG wordmark; avoid next/image SVG quirks
    <img
      src="/optra-logo.svg"
      alt="Optra"
      width={w}
      height={h}
      decoding="async"
      className={cn("select-none", className)}
      style={{ width: w, height: h }}
    />
  );

  if (!href) return mark;

  return (
    <Link
      href={href}
      onClick={onClick}
      className="inline-flex items-center"
      aria-label="Optra"
    >
      {mark}
    </Link>
  );
}
