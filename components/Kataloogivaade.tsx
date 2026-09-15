import Link from "next/link";
import Filtrivorm from "@/components/Filtrivorm";
import Tootekaart from "@/components/Tootekaart";
import type { Järjestus, Loend } from "@/lib/kataloog";
import { kogusSõna } from "@/lib/tekst";

export type KataloogiParameetrid = {
  otsing: string;
  järjestus: Järjestus;
  ainultLaos: boolean;
  tootja: string;
};

/** Ehitab lehekülje lingi, säilitades aktiivsed filtrid. */
function lehelink(
  alusTee: string,
  parameetrid: KataloogiParameetrid,
  leht: number,
): string {
  const päring = new URLSearchParams();
  if (parameetrid.otsing) päring.set("otsing", parameetrid.otsing);
  if (parameetrid.järjestus !== "uued") päring.set("jarjesta", parameetrid.järjestus);
  if (parameetrid.ainultLaos) päring.set("laos", "1");
  if (parameetrid.tootja) päring.set("tootja", parameetrid.tootja);
  if (leht > 1) päring.set("leht", String(leht));
  const järjend = päring.toString();
  return järjend ? `${alusTee}?${järjend}` : alusTee;
}

export default function Kataloogivaade({
  pealkiri,
  kirjeldus,
  alusTee,
  loend,
  parameetrid,
  tootjad,
}: {
  pealkiri: string;
  kirjeldus?: string;
  alusTee: string;
  loend: Loend;
  parameetrid: KataloogiParameetrid;
  tootjad: string[];
}) {
  const lehed = Array.from({ length: loend.lehti }, (_, i) => i + 1).filter(
    (nr) =>
      nr === 1 ||
      nr === loend.lehti ||
      Math.abs(nr - loend.leht) <= 2,
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-navi-900">{pealkiri}</h1>
        {kirjeldus && <p className="mt-2 text-hall-600">{kirjeldus}</p>}
        <p className="mt-1 text-sm text-hall-400">
          {kogusSõna(loend.kokku, "toode", "toodet")}
        </p>
      </header>

      <div className="mb-6">
        <Filtrivorm
          tegevus={alusTee}
          otsing={parameetrid.otsing}
          järjestus={parameetrid.järjestus}
          ainultLaos={parameetrid.ainultLaos}
          tootja={parameetrid.tootja}
          tootjad={tootjad}
        />
      </div>

      {loend.tooted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hall-200 bg-white p-12 text-center">
          <h2 className="text-lg font-semibold text-navi-800">
            Ühtegi toodet ei leitud
          </h2>
          <p className="mt-2 text-sm text-hall-600">
            Proovi teist otsingusõna või vaata{" "}
            <Link href="/tooted" className="font-medium text-navi-600 hover:underline">
              kogu valikut
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {loend.tooted.map((toode) => (
            <li key={toode.id}>
              <Tootekaart toode={toode} />
            </li>
          ))}
        </ul>
      )}

      {loend.lehti > 1 && (
        <nav aria-label="Lehekülgede sirvimine" className="mt-10 flex justify-center gap-1">
          {loend.leht > 1 && (
            <Link
              href={lehelink(alusTee, parameetrid, loend.leht - 1)}
              className="rounded-lg border border-hall-200 bg-white px-3 py-2 text-sm text-navi-800 hover:border-navi-600"
            >
              ← Eelmine
            </Link>
          )}
          {lehed.map((nr, indeks) => (
            <span key={nr} className="flex">
              {indeks > 0 && nr - lehed[indeks - 1] > 1 && (
                <span className="px-2 py-2 text-sm text-hall-400">…</span>
              )}
              <Link
                href={lehelink(alusTee, parameetrid, nr)}
                aria-current={nr === loend.leht ? "page" : undefined}
                className={`rounded-lg border px-4 py-2 text-sm ${
                  nr === loend.leht
                    ? "border-navi-800 bg-navi-800 font-semibold text-white"
                    : "border-hall-200 bg-white text-navi-800 hover:border-navi-600"
                }`}
              >
                {nr}
              </Link>
            </span>
          ))}
          {loend.leht < loend.lehti && (
            <Link
              href={lehelink(alusTee, parameetrid, loend.leht + 1)}
              className="rounded-lg border border-hall-200 bg-white px-3 py-2 text-sm text-navi-800 hover:border-navi-600"
            >
              Järgmine →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

/** Loeb URL-i otsinguparameetrid kataloogi filtriteks. */
export function loeParameetrid(
  otsing: Record<string, string | string[] | undefined>,
): KataloogiParameetrid & { leht: number } {
  const võta = (võti: string): string => {
    const väärtus = otsing[võti];
    return Array.isArray(väärtus) ? (väärtus[0] ?? "") : (väärtus ?? "");
  };
  const lubatud: Järjestus[] = ["uued", "odavamad", "kallimad", "nimi"];
  const järjestus = võta("jarjesta") as Järjestus;
  const leht = Number.parseInt(võta("leht"), 10);

  return {
    otsing: võta("otsing").slice(0, 100),
    järjestus: lubatud.includes(järjestus) ? järjestus : "uued",
    ainultLaos: võta("laos") === "1",
    tootja: võta("tootja").slice(0, 100),
    leht: Number.isFinite(leht) && leht > 0 ? leht : 1,
  };
}
