import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://xvirus.org"),
  title: {
    default: "xvirus.org — HPS Cytokine Storm Simulator",
    template: "%s | xvirus.org",
  },
  description:
    "Real-time mathematical simulation of Hantavirus Pulmonary Syndrome cytokine storm. " +
    "Wasserstein early-warning score and clinical triage tool for the 2026 Andes hantavirus (MV Hondius) outbreak.",
  keywords: [
    "hantavirus pulmonary syndrome",
    "HPS simulator",
    "cytokine storm",
    "Andes hantavirus 2026",
    "MV Hondius outbreak",
    "hantavirus triage",
    "hantavirus treatment",
    "CTL IFN-gamma storm",
    "IL-10 HPS",
    "mathematical biology",
    "ODE immunology model",
    "Wasserstein patient score",
    "ANDV outbreak",
    "hantavirus cardiopulmonary syndrome",
  ],
  authors: [{ name: "Bertrand Mercier des Rochettes", url: "https://quantum-proteins.ai" }],
  creator: "Bertrand Mercier des Rochettes",
  publisher: "Quantum Proteins AI",
  category: "Medical Research",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://xvirus.org",
    siteName: "xvirus.org",
    title: "xvirus.org — HPS Cytokine Storm Simulator",
    description:
      "Real-time 14-variable ODE simulation of HPS immunopathology. " +
      "Wasserstein storm risk score. Built for the 2026 Andes hantavirus outbreak.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "xvirus.org HPS Cytokine Storm Simulator" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "xvirus.org — HPS Cytokine Storm Simulator",
    description:
      "Real-time HPS cytokine storm model + clinical triage tool. 2026 Andes hantavirus outbreak.",
    images: ["/opengraph-image"],
    creator: "@quantumproteins",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://xvirus.org",
  },
  verification: {
    // Add Google/Bing verification tokens here when available
    // google: "YOUR_TOKEN",
  },
};

// JSON-LD structured data
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": "https://xvirus.org/#app",
      name: "HPS Cytokine Storm Simulator",
      url: "https://xvirus.org",
      description:
        "Real-time mathematical simulation of Hantavirus Pulmonary Syndrome cytokine storm dynamics, " +
        "with a clinical triage tool for patient risk stratification.",
      applicationCategory: "MedicalApplication",
      operatingSystem: "Web browser",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      author: {
        "@type": "Person",
        name: "Bertrand Mercier des Rochettes",
        affiliation: { "@type": "Organization", name: "Quantum Proteins AI", url: "https://quantum-proteins.ai" },
      },
      datePublished: "2026-05-15",
      license: "https://opensource.org/licenses/MIT",
      codeRepository: "https://github.com/quantumproteinsai/hps-cytokine-storm",
    },
    {
      "@type": "MedicalStudy",
      "@id": "https://xvirus.org/#study",
      name: "Cytokine storm dynamics in hantavirus pulmonary syndrome: a multiscale ODE model",
      url: "https://www.medrxiv.org",
      studySubject: {
        "@type": "MedicalCondition",
        name: "Hantavirus Pulmonary Syndrome",
        alternateName: ["HPS", "Hantavirus Cardiopulmonary Syndrome", "HCPS"],
        associatedAnatomy: { "@type": "AnatomicalStructure", name: "Pulmonary endothelium" },
      },
      author: { "@type": "Person", name: "Bertrand Mercier des Rochettes" },
    },
    {
      "@type": "WebSite",
      "@id": "https://xvirus.org/#website",
      url: "https://xvirus.org",
      name: "xvirus.org",
      description: "Mathematical virus immunopathology simulators",
      publisher: { "@type": "Organization", name: "Quantum Proteins AI", url: "https://quantum-proteins.ai" },
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: "https://xvirus.org/triage" },
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Oxanium:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="bg-[#0e1f35] text-slate-200 antialiased">{children}</body>
    </html>
  );
}
