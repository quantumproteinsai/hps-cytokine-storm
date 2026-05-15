import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HPS Patient Triage — Clinical Risk Assessment",
  description:
    "Bedside clinical triage tool for Hantavirus Pulmonary Syndrome. " +
    "Enter CD8+ count, IL-6, IL-10, platelets and chest X-ray score " +
    "to compute the HPS Storm Risk Score (0–10) and 14-day forward projection.",
  keywords: [
    "HPS triage",
    "hantavirus patient assessment",
    "cytokine storm risk score",
    "CD8 IL-6 IL-10 platelets HPS",
    "Andes hantavirus clinical tool",
    "HPS prognosis",
    "hantavirus ICU",
    "storm risk stratification",
  ],
  openGraph: {
    title: "HPS Patient Triage — xvirus.org",
    description:
      "Bedside risk score for HPS cytokine storm. " +
      "CD8⁺, IL-6, IL-10, platelets, chest X-ray → Storm Risk Score (0–10) → 14-day projection.",
    url: "https://xvirus.org/triage",
    images: [{ url: "/triage/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "HPS Patient Triage Tool — xvirus.org",
    description: "Bedside HPS storm risk score from routine lab values. 2026 Andes hantavirus.",
    images: ["/triage/opengraph-image"],
  },
  alternates: {
    canonical: "https://xvirus.org/triage",
  },
};

// JSON-LD for triage page
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "MedicalWebPage",
  name: "HPS Patient Triage — Clinical Risk Assessment",
  url: "https://xvirus.org/triage",
  description:
    "Clinical decision support tool for Hantavirus Pulmonary Syndrome patient triage. " +
    "Computes the HPS Storm Risk Score from routine ICU laboratory measurements.",
  about: {
    "@type": "MedicalCondition",
    name: "Hantavirus Pulmonary Syndrome",
    alternateName: "HPS",
  },
  audience: { "@type": "MedicalAudience", audienceType: "Clinician" },
  medicalAudience: { "@type": "MedicalAudience", audienceType: "Physician" },
  lastReviewed: "2026-05-15",
  mainContentOfPage: {
    "@type": "WebPageElement",
    cssSelector: "main",
  },
};

export default function TriageLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
