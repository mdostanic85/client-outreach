import type { Metadata } from "next";
import { Inter_Tight } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Optra",
  description:
    "Optra reads your CV and shows a short list of jobs that fit, with a plain reason for each one.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${interTight.variable} h-full`}
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
