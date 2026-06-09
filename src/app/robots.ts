import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/signup"],
        disallow: [
          "/api/",
          "/admin",
          "/admin/",
          "/profile",
          "/profile/",
          "/predict",
          "/predict/",
          "/matches",
          "/matches/",
          "/groups",
          "/groups/",
          "/bracket",
          "/bracket/",
          "/board",
          "/board/",
          "/leagues",
          "/leagues/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
