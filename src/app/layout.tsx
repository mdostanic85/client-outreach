import type { Metadata } from "next";
import { Inter_Tight } from "next/font/google";
import localFont from "next/font/local";
import { RevealObserver } from "@/components/reveal-observer";
import "./globals.css";

/**
 * One family everywhere. Hierarchy comes from size and opacity, not weight:
 * 400 by default, 500 for titles and labels. 600 is loaded only for the
 * CV / letter documents, which keep a print-style hierarchy.
 */
const interTight = Inter_Tight({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
});

/**
 * Headlines only (h1–h6 and heading-styled titles). Mapped one cut heavier
 * than the CSS weight on purpose: headings keep the app's 400 / 500 scale,
 * but 400 draws Alcyone Medium and 500 draws SemiBold, so every headline is
 * a step bolder without touching each class. Only these two files load.
 */
const alcyone = localFont({
  variable: "--font-display",
  display: "swap",
  src: [
    { path: "../fonts/alcyone/Alcyone-Medium.woff2", weight: "400", style: "normal" },
    { path: "../fonts/alcyone/Alcyone-SemiBold.woff2", weight: "500", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: "Optra",
  description:
    "Add your CV. Optra shows a short list of open jobs that fit, with a plain reason for each one. You decide what happens next.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${interTight.variable} ${alcyone.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        {/* Before first paint: lets [data-reveal] start hidden (unless motion is reduced). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('reveal-ready')",
          }}
        />
      </head>
      <body className="bg-background text-foreground min-h-svh antialiased">
        {children}
        <RevealObserver />
      </body>
    </html>
  );
}
