import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { kategooriaIkoon } from "@/components/illustratsioonid/Ikoonid";
import Kataloogivaade, { loeParameetrid } from "@/components/Kataloogivaade";
import {
  leiaKategooria,
  loeKategooriad,
  loeTootjad,
  otsiTooted,
} from "@/lib/kataloog";

export async function generateMetadata(
  props: PageProps<"/kategooria/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const kategooria = leiaKategooria(slug);
  if (!kategooria) return { title: "Kategooriat ei leitud" };
  return {
    title: kategooria.nimi,
    description: `${kategooria.nimi} – vaata valikut ja telli kohe.`,
  };
}

export default async function KategooriaLeht(
  props: PageProps<"/kategooria/[slug]">,
) {
  const [{ slug }, otsinguParameetrid] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const kategooria = leiaKategooria(slug);
  if (!kategooria) notFound();

  const parameetrid = loeParameetrid(otsinguParameetrid);
  const loend = otsiTooted({
    kategooriaId: kategooria.id,
    otsing: parameetrid.otsing,
    järjestus: parameetrid.järjestus,
    ainultLaos: parameetrid.ainultLaos,
    tootja: parameetrid.tootja || null,
    leht: parameetrid.leht,
  });

  const kõik = loeKategooriad();
  const alamkategooriad = kõik.filter(
    (k) => k.vanem_id === kategooria.id && k.tooteid > 0,
  );
  const vanem = kategooria.vanem_id
    ? (kõik.find((k) => k.id === kategooria.vanem_id) ?? null)
    : null;

  return (
    <>
      <nav aria-label="Teekond" className="mx-auto max-w-7xl px-4 pt-6 text-sm text-hall-600">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:text-oliiv-800 hover:underline">
              Avaleht
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          {vanem && (
            <>
              <li>
                <Link
                  href={`/kategooria/${vanem.slug}`}
                  className="hover:text-oliiv-800 hover:underline"
                >
                  {vanem.nimi}
                </Link>
              </li>
              <li aria-hidden="true">/</li>
            </>
          )}
          <li className="font-medium text-oliiv-800">{kategooria.nimi}</li>
        </ol>
      </nav>

      {alamkategooriad.length > 0 && (
        <div className="mx-auto max-w-7xl px-4 pt-6">
          <ul className="flex flex-wrap gap-2">
            {alamkategooriad.map((alam) => (
              <li key={alam.id}>
                <Link
                  href={`/kategooria/${alam.slug}`}
                  className="inline-flex items-center gap-2 rounded-full border border-hall-200 bg-white px-4 py-2 text-sm text-oliiv-800 transition hover:border-oliiv-600"
                >
                  {alam.nimi}
                  <span className="text-xs text-hall-400">{alam.tooteid}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Kataloogivaade
        pealkiri={kategooria.nimi}
        alusTee={`/kategooria/${kategooria.slug}`}
        loend={loend}
        parameetrid={parameetrid}
        tootjad={loeTootjad()}
        ikoon={kategooriaIkoon(kategooria.nimi, kategooria.tee)}
      />
    </>
  );
}
