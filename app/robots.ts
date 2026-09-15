import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const alus = process.env.SAIDI_URL ?? "http://localhost:3000";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Ostukorv ja kassa on iga külastaja jaoks erinevad – neid ei indekseerita.
        disallow: ["/ostukorv", "/kassa", "/tellimus/"],
      },
    ],
    sitemap: `${alus}/sitemap.xml`,
  };
}
