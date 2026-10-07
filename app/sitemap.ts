import type { MetadataRoute } from "next";
import { getCorpora } from "@/lib/data";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ["", "/corpora", "/search", "/insights", "/about"];
  return [
    ...staticRoutes.map((route) => ({
      url: `${siteUrl}${route}`,
      changeFrequency: "weekly" as const,
      priority: route === "" ? 1 : 0.7,
    })),
    ...getCorpora().flatMap((corpus) => [
      {
        url: `${siteUrl}/corpora/${corpus.key}`,
        changeFrequency: "monthly" as const,
        priority: 0.8,
      },
      {
        url: `${siteUrl}/insights/${corpus.key}`,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      },
    ]),
  ];
}
