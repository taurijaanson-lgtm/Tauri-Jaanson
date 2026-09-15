import type { Metadata } from "next";
import Link from "next/link";
import { eemaldaKorvist, muudaKogust, tühjendaKorv } from "@/app/toimingud";
import Toodepilt from "@/components/Toodepilt";
import { vormindaHind } from "@/lib/hinnad";
import { tasutaTarneAlates } from "@/lib/konfiguratsioon";
import { kokkuvõte, loeOstukorv } from "@/lib/ostukorv";
import { kogusSõna } from "@/lib/tekst";

export const metadata: Metadata = {
  title: "Ostukorv",
  robots: { index: false },
};

export default async function OstukorvLeht() {
  const korv = kokkuvõte(await loeOstukorv());

  if (korv.tühi) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-3xl font-bold text-oliiv-900">Ostukorv on tühi</h1>
        <p className="mt-3 text-hall-600">
          Lisa tooteid ostukorvi, et tellimust vormistada.
        </p>
        <Link
          href="/tooted"
          className="mt-8 inline-block rounded-lg bg-oliiv-800 px-6 py-3 font-semibold text-white transition hover:bg-oliiv-700"
        >
          Vaata tooteid
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-1 text-3xl font-bold text-oliiv-900">Ostukorv</h1>
      <p className="mb-8 text-sm text-hall-600">
        {kogusSõna(korv.esemeid, "toode", "toodet")} ostukorvis
      </p>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {korv.read.map((rida) => (
            <article
              key={rida.võti}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-hall-200 bg-white p-4"
            >
              <Link
                href={`/tooted/${rida.slug}`}
                className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-hall-100"
              >
                <Toodepilt
                  url={rida.pilt}
                  alt={rida.nimi}
                  klass="h-full w-full object-cover"
                />
              </Link>

              <div className="min-w-48 flex-1">
                <h2 className="font-semibold text-oliiv-800">
                  <Link href={`/tooted/${rida.slug}`} className="hover:underline">
                    {rida.nimi}
                  </Link>
                </h2>
                {rida.variandiNimi && (
                  <p className="text-sm text-hall-600">{rida.variandiNimi}</p>
                )}
                <p className="text-sm text-hall-600">
                  {vormindaHind(rida.hindSendid)} / tk
                </p>
                {rida.puudulik && (
                  <p className="mt-1 text-sm font-medium text-amber-700">
                    Laos on ainult {rida.laoseis} tk – palun vähenda kogust.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <form action={muudaKogust} className="flex items-center gap-1">
                  <input type="hidden" name="toode" value={rida.tooteId} />
                  <input type="hidden" name="variant" value={rida.variandiId ?? ""} />
                  <input type="hidden" name="kogus" value={rida.kogus - 1} />
                  <button
                    type="submit"
                    aria-label={`Vähenda kogust: ${rida.nimi}`}
                    className="h-9 w-9 rounded-lg border border-hall-200 text-lg text-hall-600 hover:border-oliiv-600"
                  >
                    −
                  </button>
                </form>
                <span className="w-8 text-center font-semibold">{rida.kogus}</span>
                <form action={muudaKogust} className="flex items-center gap-1">
                  <input type="hidden" name="toode" value={rida.tooteId} />
                  <input type="hidden" name="variant" value={rida.variandiId ?? ""} />
                  <input type="hidden" name="kogus" value={rida.kogus + 1} />
                  <button
                    type="submit"
                    disabled={rida.kogus >= rida.laoseis}
                    aria-label={`Suurenda kogust: ${rida.nimi}`}
                    className="h-9 w-9 rounded-lg border border-hall-200 text-lg text-hall-600 hover:border-oliiv-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    +
                  </button>
                </form>
              </div>

              <p className="w-24 text-right font-bold text-oliiv-900">
                {vormindaHind(rida.summaSendid)}
              </p>

              <form action={eemaldaKorvist}>
                <input type="hidden" name="toode" value={rida.tooteId} />
                <input type="hidden" name="variant" value={rida.variandiId ?? ""} />
                <button
                  type="submit"
                  className="rounded-lg p-2 text-sm text-hall-400 transition hover:text-red-600"
                  aria-label={`Eemalda ostukorvist: ${rida.nimi}`}
                >
                  ✕
                </button>
              </form>
            </article>
          ))}

          <div className="flex justify-between">
            <Link
              href="/tooted"
              className="text-sm font-medium text-oliiv-600 hover:underline"
            >
              ← Jätka ostlemist
            </Link>
            <form action={tühjendaKorv}>
              <button
                type="submit"
                className="text-sm text-hall-600 hover:text-red-600 hover:underline"
              >
                Tühjenda ostukorv
              </button>
            </form>
          </div>
        </div>

        <aside className="h-fit rounded-xl border border-hall-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-bold text-oliiv-900">Kokkuvõte</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-hall-600">Kaubad</dt>
              <dd className="font-medium">{vormindaHind(korv.kaupadeSummaSendid)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-hall-600">Tarne</dt>
              <dd className="font-medium">arvutatakse kassas</dd>
            </div>
          </dl>

          {korv.tasutaTarneniSendid > 0 ? (
            <p className="mt-4 rounded-lg bg-oliiv-50 p-3 text-sm text-oliiv-700">
              Lisa veel {vormindaHind(korv.tasutaTarneniSendid)} ja tarne on tasuta.
            </p>
          ) : (
            <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
              Tarne on sellele tellimusele tasuta.
            </p>
          )}

          <div className="mt-4 flex justify-between border-t border-hall-200 pt-4 text-base font-bold text-oliiv-900">
            <span>Vahesumma</span>
            <span>{vormindaHind(korv.kaupadeSummaSendid)}</span>
          </div>

          <Link
            href="/kassa"
            className="mt-6 block rounded-lg bg-liiv-500 px-6 py-3 text-center font-bold text-oliiv-900 transition hover:bg-liiv-400"
          >
            Vormista tellimus
          </Link>
          <p className="mt-3 text-center text-xs text-hall-400">
            Tasuta tarne alates {vormindaHind(tasutaTarneAlates)}
          </p>
        </aside>
      </div>
    </div>
  );
}
