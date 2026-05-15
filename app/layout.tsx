import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "xvirus.org — HPS Cytokine Storm Simulator",
  description:
    "Real-time simulation of Hantavirus Pulmonary Syndrome immunopathology. Wasserstein early-warning score for the 2026 Andes virus outbreak.",
  openGraph: {
    title: "xvirus.org — HPS Cytokine Storm Simulator",
    description: "Mathematical model of HPS cytokine storm for the 2026 Andes virus (MV Hondius) outbreak.",
    url: "https://xvirus.org",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Syne:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#060d1a] text-slate-200 antialiased">{children}</body>
    </html>
  );
}
