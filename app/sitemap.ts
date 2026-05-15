import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: "https://xvirus.org",
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: "https://xvirus.org/triage",
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];
}
