import Link from "next/link";
import { loeKategooriaPuu } from "@/lib/kataloog";
import { pood, tasutaTarneAlates } from "@/lib/konfiguratsioon";
import { vormindaHind } from "@/lib/hinnad";
import { loeOstukorv } from "@/lib/ostukorv";
import Ikoon from "./illustratsioonid/Ikoonid";
import Otsinguriba from "./Otsinguriba";

/** Poe päis: teaderiba, logo, otsing, ostukorv ja kategooriamenüü. */
export default async function Pais() {
  const [kategooriad, korv] = await Promise.all([
    Promise.resolve(loeKategooriaPuu()),
    loeOstukorv(),
  ]);

  return (
    <header className="sticky top-0 z-40 border-b border-hall-200 bg-white/95 backdrop-blur">
      <div className="kamuflaaz text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs sm:text-sm">
          <p>
            Tasuta tarne alates{" "}
            <strong className="text-liiv-400">
              {vormindaHind(tasutaTarneAlates)}
            </strong>{" "}
            · Tarne 1–3 tööpäeva
          </p>
          <p className="hidden sm:block">
            Küsi nõu:{" "}
            <a className="underline hover:text-liiv-400" href={`tel:${pood.telefon.replace(/\s/g, "")}`}>
              {pood.telefon}
            </a>
          </p>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-11 w-11 items-center justify-center rounded-sm bg-oliiv-800 ring-2 ring-liiv-500">
            <Ikoon nimi="kiiver" className="h-7 w-7 text-liiv-400" />
          </span>
          <span className="leading-tight">
            <span className="trafarett block text-lg font-black text-oliiv-800">{pood.nimi}</span>
            <span className="hidden text-xs text-hall-600 sm:block">{pood.slogan}</span>
          </span>
        </Link>

        <div className="order-3 w-full sm:order-2 sm:w-auto sm:flex-1">
          <Otsinguriba />
        </div>

        <Link
          href="/ostukorv"
          className="order-2 ml-auto flex items-center gap-2 rounded-lg border border-hall-200 px-3 py-2 text-sm font-medium text-oliiv-800 transition hover:border-oliiv-600 hover:bg-oliiv-50 sm:order-3"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-5 w-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.5 3h2l2.2 11.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.6L20 7H5.4"
            />
            <circle cx="9.5" cy="20" r="1.4" />
            <circle cx="17.5" cy="20" r="1.4" />
          </svg>
          <span className="hidden sm:inline">Ostukorv</span>
          <span
            className="min-w-6 rounded-full bg-oliiv-800 px-2 py-0.5 text-center text-xs font-bold text-white"
            aria-label={`Ostukorvis ${korv.esemeid} toodet`}
          >
            {korv.esemeid}
          </span>
        </Link>
      </div>

      <nav aria-label="Kategooriad" className="border-t border-oliiv-100 bg-oliiv-50">
        <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 text-sm">
          <li>
            <Link
              href="/tooted"
              className="whitespace-nowrap rounded-sm px-3 py-1.5 font-bold text-oliiv-800 hover:bg-oliiv-100"
            >
              Kõik tooted
            </Link>
          </li>
          {kategooriad.map((kategooria) => (
            <li key={kategooria.id} className="group relative">
              <Link
                href={`/kategooria/${kategooria.slug}`}
                className="block whitespace-nowrap rounded-sm px-3 py-1.5 text-hall-800 hover:bg-oliiv-100"
              >
                {kategooria.nimi}
              </Link>
              {kategooria.lapsed.length > 0 && (
                <ul className="invisible absolute left-0 top-full z-50 min-w-56 rounded-lg border border-hall-200 bg-white p-2 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                  {kategooria.lapsed.map((laps) => (
                    <li key={laps.id}>
                      <Link
                        href={`/kategooria/${laps.slug}`}
                        className="flex items-center justify-between gap-4 rounded-md px-3 py-1.5 text-sm text-hall-800 hover:bg-hall-100"
                      >
                        {laps.nimi}
                        <span className="text-xs text-hall-400">{laps.tooteid}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
