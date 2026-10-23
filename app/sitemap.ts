import type { MetadataRoute } from "next";
import { getCorpora } from "@/lib/data";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ["", "/corpora", "/insights"];
  return [
    ...staticRoutes.map((route) => ({
      url: `${siteUrl}${route}`,
      changeFrequency: "weekly" as const,
      priority: route === "" ? 1 : 0.7,
    })),
    ...getCorpora().map((corpus) => ({
      url: `${siteUrl}/corpora/${corpus.key}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
