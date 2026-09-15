import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import Hero from "@/components/illustratsioonid/Hero";
import Ikoon, { kategooriaIkoon } from "@/components/illustratsioonid/Ikoonid";
import Tootekaart from "@/components/Tootekaart";
import { vormindaHind } from "@/lib/hinnad";
import { esiletõstetud, kataloogiStatistika, loeKategooriaPuu } from "@/lib/kataloog";
import { pood, tasutaTarneAlates } from "@/lib/konfiguratsioon";

const EELISED = [
  {
    ikoon: "moodulint" as const,
    pealkiri: "Laoseisud reaalajas",
    tekst: "Laoseisud ja hinnad uuenevad igal hommikul otse hulgilao süsteemist.",
  },
  {
    ikoon: "saabas" as const,
    pealkiri: "Kiire tarne",
    tekst: "Saadame laos olevad tooted välja samal tööpäeval, kohal 1–3 päevaga.",
  },
  {
    ikoon: "kiiver" as const,
    pealkiri: "Sertifitseeritud kaitse",
    tekst: "Kõik isikukaitsevahendid vastavad kehtivatele EN-standarditele.",
  },
  {
    ikoon: "votme" as const,
    pealkiri: "Ärikliendile arve",
    tekst: "Võimalik tasuda pangaülekandega arve alusel, KMKR nõuetekohaselt.",
  },
];

/**
 * Kui poe haldaja on lisanud kausta `public/pildid` oma hero-pildi (nt Canvas
 * tehtud illustratsiooni), kasutame seda. Muidu kuvame vektorillustratsiooni.
 */
function leiaHeroPilt(): string | null {
  const kaust = path.join(process.cwd(), "public", "pildid");
  for (const nimi of ["hero.png", "hero.jpg", "hero.webp", "hero.svg"]) {
    if (fs.existsSync(path.join(kaust, nimi))) return `/pildid/${nimi}`;
  }
  return null;
}

export default function Avaleht() {
  const kategooriad = loeKategooriaPuu();
  const tooted = esiletõstetud(8);
  const statistika = kataloogiStatistika();
  const heroPilt = leiaHeroPilt();

  return (
    <>
      <section className="kamuflaaz relative overflow-hidden text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div>
            <p className="trafarett mb-4 inline-flex items-center gap-2 rounded-sm border-2 border-liiv-500 px-3 py-1 text-xs font-bold text-liiv-400">
              <span className="h-2 w-2 bg-liiv-500" />
              {statistika.tooteid} toodet laos
            </p>
            <h1 className="text-4xl font-black leading-[1.05] sm:text-6xl">
              Tööriided ja
              <span className="block">kaitsevahendid,</span>
              <span className="block text-liiv-400">mis peavad vastu</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-oliiv-100">
              {pood.slogan}. Turvajalatsid, tööriided, kindad ja tööriistad otse
              hulgilaost – ilma vahendajate juurdehindluseta.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/tooted"
                className="rounded-sm bg-liiv-500 px-7 py-3.5 font-bold text-oliiv-900 transition hover:bg-liiv-400"
              >
                Vaata kõiki tooteid
              </Link>
              <Link
                href="/info/tarne"
                className="rounded-sm border-2 border-oliiv-500 px-7 py-3.5 font-semibold text-white transition hover:border-liiv-500 hover:text-liiv-400"
              >
                Tarnetingimused
              </Link>
            </div>
            <p className="mt-6 text-sm text-oliiv-200">
              Tasuta tarne tellimustele alates {vormindaHind(tasutaTarneAlates)}
            </p>
          </div>

          <div className="relative">
            {heroPilt ? (
              // eslint-disable-next-line @next/next/no-img-element -- poe enda kujundusfail kaustas public/
              <img
                src={heroPilt}
                alt="Tööriided ja kaitsevahendid"
                className="w-full rounded-3xl border-2 border-oliiv-600"
              />
            ) : (
              <Hero className="w-full" />
            )}
          </div>
        </div>

        <div className="hoiatustriip h-3 w-full" />
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {EELISED.map((eelis) => (
            <li
              key={eelis.pealkiri}
              className="rounded-xl border border-oliiv-200 bg-white p-5"
            >
              <Ikoon nimi={eelis.ikoon} className="mb-3 h-9 w-9 text-oliiv-600" />
              <h2 className="mb-1 font-bold text-oliiv-800">{eelis.pealkiri}</h2>
              <p className="text-sm text-hall-600">{eelis.tekst}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-14">
        <h2 className="trafarett mb-6 text-sm font-bold text-oliiv-600">
          Tootekategooriad
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kategooriad.map((kategooria) => (
            <li
              key={kategooria.id}
              className="group relative overflow-hidden rounded-xl border border-oliiv-200 bg-white p-5 transition hover:border-oliiv-600 hover:shadow-md"
            >
              <Ikoon
                nimi={kategooriaIkoon(kategooria.nimi, kategooria.tee)}
                className="absolute -right-4 -top-4 h-28 w-28 text-oliiv-100 transition group-hover:text-oliiv-200"
              />
              <div className="relative">
                <h3 className="mb-1 text-lg font-bold text-oliiv-800">
                  <Link
                    href={`/kategooria/${kategooria.slug}`}
                    className="hover:underline"
                  >
                    {kategooria.nimi}
                  </Link>
                </h3>
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-hall-400">
                  {kategooria.tooteid} toodet
                </p>
                <ul className="space-y-1 text-sm">
                  {kategooria.lapsed.slice(0, 4).map((laps) => (
                    <li key={laps.id}>
                      <Link
                        href={`/kategooria/${laps.slug}`}
                        className="text-hall-600 hover:text-oliiv-700 hover:underline"
                      >
                        {laps.nimi}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-14">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="trafarett text-sm font-bold text-oliiv-600">
            Populaarsed tooted
          </h2>
          <Link
            href="/tooted"
            className="text-sm font-medium text-oliiv-700 hover:underline"
          >
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
