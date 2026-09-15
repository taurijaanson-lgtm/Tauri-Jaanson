import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import LisaKorvi from "@/components/LisaKorvi";
import Pildigalerii from "@/components/Pildigalerii";
import Tootekaart from "@/components/Tootekaart";
import { vormindaHind } from "@/lib/hinnad";
import { leiaToode, sarnasedTooted } from "@/lib/kataloog";
import { pood, tarneviisid, tasutaTarneAlates } from "@/lib/konfiguratsioon";
import { lühikokkuvõte } from "@/lib/tekst";
import { kmProtsent } from "@/lib/tellimused";

export async function generateMetadata(
  props: PageProps<"/tooted/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const toode = leiaToode(slug);
  if (!toode) return { title: "Toodet ei leitud" };
  return {
    title: toode.nimi,
    description: lühikokkuvõte(toode.kirjeldus, 155),
    openGraph: {
      title: toode.nimi,
      description: lühikokkuvõte(toode.kirjeldus, 155),
      images: toode.pildid.slice(0, 1),
    },
  };
}

export default async function ToodeLeht(props: PageProps<"/tooted/[slug]">) {
  const { slug } = await props.params;
  const toode = leiaToode(slug);
  if (!toode) notFound();

  const sarnased = sarnasedTooted(toode, 4);
  const laos = toode.laoseis > 0;
  const odavaimTarne = Math.min(...tarneviisid.map((t) => t.hindSendid));

  // Struktureeritud andmed otsimootoritele.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: toode.nimi,
    description: lühikokkuvõte(toode.kirjeldus, 300),
    sku: toode.sku ?? toode.id,
    ...(toode.ean ? { gtin13: toode.ean } : {}),
    ...(toode.tootja ? { brand: { "@type": "Brand", name: toode.tootja } } : {}),
    image: toode.pildid,
    offers: {
      "@type": "Offer",
      priceCurrency: "EUR",
      price: (toode.hind_sendid / 100).toFixed(2),
      availability: laos
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: pood.nimi },
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav aria-label="Teekond" className="mb-6 text-sm text-hall-600">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:text-oliiv-800 hover:underline">
              Avaleht
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          {toode.kategooria_slug && (
            <>
              <li>
                <Link
                  href={`/kategooria/${toode.kategooria_slug}`}
                  className="hover:text-oliiv-800 hover:underline"
                >
                  {toode.kategooria_nimi}
                </Link>
              </li>
              <li aria-hidden="true">/</li>
            </>
          )}
          <li className="font-medium text-oliiv-800">{toode.nimi}</li>
        </ol>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <Pildigalerii pildid={toode.pildid} nimi={toode.nimi} />

        <div>
          {toode.tootja && (
            <p className="mb-2 text-sm font-medium uppercase tracking-wide text-hall-400">
              {toode.tootja}
            </p>
          )}
          <h1 className="text-3xl font-bold text-oliiv-900">{toode.nimi}</h1>

          <div className="mt-4 flex flex-wrap items-baseline gap-3">
            <p className="text-4xl font-black text-oliiv-900">
              {vormindaHind(toode.hind_sendid)}
            </p>
            <p className="text-sm text-hall-600">
              sh käibemaks {kmProtsent()} · ilma käibemaksuta{" "}
              {vormindaHind(toode.hind_neto_sendid)}
            </p>
          </div>

          <p className="mt-3">
            {laos ? (
              <span className="inline-flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Laos {toode.laoseis} tk – saadame välja 1 tööpäeva jooksul
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-md bg-hall-100 px-3 py-1.5 text-sm font-medium text-hall-600">
                <span className="h-2 w-2 rounded-full bg-hall-400" />
                Hetkel otsas
              </span>
            )}
          </p>

          <div className="mt-6 rounded-xl border border-hall-200 bg-white p-5">
            <LisaKorvi
              tooteId={toode.id}
              laoseis={toode.laoseis}
              variandid={toode.variandid}
            />
          </div>

          <ul className="mt-6 space-y-2 text-sm text-hall-600">
            <li>
              Tarne pakiautomaati alates {vormindaHind(odavaimTarne)}, tasuta alates{" "}
              {vormindaHind(tasutaTarneAlates)}
            </li>
            <li>14-päevane tagastusõigus</li>
            <li>
              Küsimused:{" "}
              <a className="text-oliiv-600 hover:underline" href={`mailto:${pood.epost}`}>
                {pood.epost}
              </a>
            </li>
          </ul>

          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-hall-200 pt-5 text-sm">
            <dt className="text-hall-600">Tootekood</dt>
            <dd className="font-medium text-oliiv-800">{toode.sku ?? toode.id}</dd>
            {toode.ean && (
              <>
                <dt className="text-hall-600">EAN</dt>
                <dd className="font-medium text-oliiv-800">{toode.ean}</dd>
              </>
            )}
            {toode.kaal !== null && (
              <>
                <dt className="text-hall-600">Kaal</dt>
                <dd className="font-medium text-oliiv-800">
                  {toode.kaal.toString().replace(".", ",")} kg
                </dd>
              </>
            )}
            {toode.kategooria_nimi && (
              <>
                <dt className="text-hall-600">Kategooria</dt>
                <dd className="font-medium text-oliiv-800">{toode.kategooria_nimi}</dd>
              </>
            )}
          </dl>
        </div>
      </div>

      {toode.kirjeldus && (
        <section className="mt-12 max-w-3xl">
          <h2 className="mb-4 text-xl font-bold text-oliiv-900">Tootekirjeldus</h2>
          <div
            className="kirjeldus text-hall-800"
            dangerouslySetInnerHTML={{ __html: toode.kirjeldus }}
          />
          {toode.variandid.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-3 text-base font-semibold text-oliiv-800">
                Saadaolevad variandid
              </h3>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-hall-200 text-left text-hall-600">
                    <th className="py-2 pr-4 font-medium">Variant</th>
                    <th className="py-2 pr-4 font-medium">EAN</th>
                    <th className="py-2 font-medium">Laoseis</th>
                  </tr>
                </thead>
                <tbody>
                  {toode.variandid.map((variant) => (
                    <tr key={variant.id} className="border-b border-hall-100">
                      <td className="py-2 pr-4 font-medium text-oliiv-800">
                        {variant.vaartus ?? variant.id}
                      </td>
                      <td className="py-2 pr-4 text-hall-600">{variant.ean ?? "–"}</td>
                      <td className="py-2 text-hall-600">
                        {variant.laoseis > 0 ? `${variant.laoseis} tk` : "otsas"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {sarnased.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 text-xl font-bold text-oliiv-900">Sarnased tooted</h2>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {sarnased.map((sarnane) => (
              <li key={sarnane.id}>
                <Tootekaart toode={sarnane} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
