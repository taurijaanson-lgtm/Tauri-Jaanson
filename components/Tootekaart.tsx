import Link from "next/link";
import Toodepilt from "@/components/Toodepilt";
import { vormindaHind } from "@/lib/hinnad";
import type { ToodeKaart } from "@/lib/kataloog";

/** Toote kaart kataloogis ja avalehel. */
export default function Tootekaart({ toode }: { toode: ToodeKaart }) {
  const laos = toode.laoseis > 0;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-hall-200 bg-white transition hover:border-oliiv-200 hover:shadow-md">
      <Link
        href={`/tooted/${toode.slug}`}
        className="relative block aspect-square overflow-hidden bg-hall-100"
      >
        <Toodepilt
          url={toode.pilt}
          alt={toode.nimi}
          klass="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
        {!laos && (
          <span className="absolute left-3 top-3 rounded-md bg-hall-800/90 px-2 py-1 text-xs font-medium text-white">
            Otsas
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        {toode.tootja && (
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-hall-400">
            {toode.tootja}
          </p>
        )}
        <h3 className="mb-3 line-clamp-2 text-sm font-semibold leading-snug text-oliiv-800">
          <Link href={`/tooted/${toode.slug}`} className="hover:underline">
            {toode.nimi}
          </Link>
        </h3>

        <div className="mt-auto flex items-end justify-between gap-2">
          <div>
            <p className="text-lg font-bold text-oliiv-900">
              {vormindaHind(toode.hind_sendid)}
            </p>
            <p className="text-xs text-hall-400">koos käibemaksuga</p>
          </div>
          <span
            className={`rounded-md px-2 py-1 text-xs font-medium ${
              laos ? "bg-emerald-50 text-emerald-700" : "bg-hall-100 text-hall-600"
            }`}
          >
            {laos ? `Laos ${toode.laoseis} tk` : "Tellimisel"}
          </span>
        </div>
      </div>
    </article>
  );
}
