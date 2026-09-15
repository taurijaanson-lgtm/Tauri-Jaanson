import Link from "next/link";
import Tootekaart from "@/components/Tootekaart";
import { vormindaHind } from "@/lib/hinnad";
import { esiletõstetud, kataloogiStatistika, loeKategooriaPuu } from "@/lib/kataloog";
import { pood, tasutaTarneAlates } from "@/lib/konfiguratsioon";

const EELISED = [
  {
    pealkiri: "Laoseisud reaalajas",
    tekst:
      "Laoseisud ja hinnad uuenevad igal hommikul otse hulgilao süsteemist.",
  },
  {
    pealkiri: "Kiire tarne",
    tekst: "Saadame laos olevad tooted välja samal tööpäeval, kohal 1–3 päevaga.",
  },
  {
    pealkiri: "Sertifitseeritud kaitsevahendid",
    tekst: "Kõik isikukaitsevahendid vastavad kehtivatele EN-standarditele.",
  },
  {
    pealkiri: "Ärikliendile arve",
    tekst: "Võimalik tasuda pangaülekandega arve alusel, KMKR nõuetekohaselt.",
  },
];

export default function Avaleht() {
  const kategooriad = loeKategooriaPuu();
  const tooted = esiletõstetud(8);
  const statistika = kataloogiStatistika();

  return (
    <>
      <section className="bg-navi-800 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="mb-3 inline-block rounded-full bg-kollane-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-navi-900">
              {statistika.tooteid} toodet laos
            </p>
            <h1 className="text-3xl font-black leading-tight sm:text-5xl">
              Tööriided ja kaitsevahendid,
              <span className="block text-kollane-400">mis peavad vastu</span>
            </h1>
            <p className="mt-4 max-w-xl text-navi-100">
              {pood.slogan}. Turvajalatsid, tööriided, kindad ja tööriistad
              otse hulgilaost – ilma vahendajate juurdehindluseta.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/tooted"
                className="rounded-lg bg-kollane-500 px-6 py-3 font-bold text-navi-900 transition hover:bg-kollane-400"
              >
                Vaata kõiki tooteid
              </Link>
              <Link
                href="/info/tarne"
                className="rounded-lg border border-navi-200/40 px-6 py-3 font-semibold text-white transition hover:bg-navi-700"
              >
                Tarnetingimused
              </Link>
            </div>
            <p className="mt-6 text-sm text-navi-100">
              Tasuta tarne tellimustele alates {vormindaHind(tasutaTarneAlates)}
            </p>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2">
            {EELISED.map((eelis) => (
              <li
                key={eelis.pealkiri}
                className="rounded-xl border border-navi-700 bg-navi-900/60 p-5"
              >
                <h2 className="mb-1 font-bold text-kollane-400">{eelis.pealkiri}</h2>
                <p className="text-sm text-navi-100">{eelis.tekst}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14">
        <h2 className="mb-6 text-2xl font-bold text-navi-900">Tootekategooriad</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kategooriad.map((kategooria) => (
            <li
              key={kategooria.id}
              className="rounded-xl border border-hall-200 bg-white p-5 transition hover:border-navi-200 hover:shadow-sm"
            >
              <h3 className="mb-2 text-lg font-bold text-navi-800">
                <Link href={`/kategooria/${kategooria.slug}`} className="hover:underline">
                  {kategooria.nimi}
                </Link>
              </h3>
              <p className="mb-3 text-sm text-hall-400">{kategooria.tooteid} toodet</p>
              <ul className="space-y-1 text-sm">
                {kategooria.lapsed.slice(0, 4).map((laps) => (
                  <li key={laps.id}>
                    <Link
                      href={`/kategooria/${laps.slug}`}
                      className="text-hall-600 hover:text-navi-800 hover:underline"
                    >
                      {laps.nimi}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-14">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="text-2xl font-bold text-navi-900">Populaarsed tooted</h2>
          <Link href="/tooted" className="text-sm font-medium text-navi-600 hover:underline">
            Kõik tooted →
          </Link>
        </div>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {tooted.map((toode) => (
            <li key={toode.id}>
              <Tootekaart toode={toode} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
