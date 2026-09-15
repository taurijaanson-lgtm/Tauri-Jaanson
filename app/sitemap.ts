import type { MetadataRoute } from "next";
import { loeKategooriad, otsiTooted } from "@/lib/kataloog";

/** Saidikaart: avaleht, infolehed, kategooriad ja kõik nähtavad tooted. */
export default function sitemap(): MetadataRoute.Sitemap {
  const alus = (process.env.SAIDI_URL ?? "http://localhost:3000").replace(/\/$/, "");

  const staatilised: MetadataRoute.Sitemap = [
    { url: `${alus}/`, changeFrequency: "daily", priority: 1 },
    { url: `${alus}/tooted`, changeFrequency: "daily", priority: 0.9 },
    { url: `${alus}/info/tarne`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${alus}/info/tingimused`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${alus}/info/kontakt`, changeFrequency: "monthly", priority: 0.4 },
  ];

  const kategooriad: MetadataRoute.Sitemap = loeKategooriad()
    .filter((kategooria) => kategooria.tooteid > 0)
    .map((kategooria) => ({
      url: `${alus}/kategooria/${kategooria.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    }));

  // Kataloog võib olla suur, seepärast loeme tooted ühe päringuga.
  const tooted: MetadataRoute.Sitemap = otsiTooted({ lehePikkus: 50_000 }).tooted.map(
    (toode) => ({
      url: `${alus}/tooted/${toode.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.6,
    }),
  );

  return [...staatilised, ...kategooriad, ...tooted];
}
