import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import KassaVorm from "@/components/KassaVorm";
import { tarneviisid, tasutaTarneAlates } from "@/lib/konfiguratsioon";
import { loeOstukorv } from "@/lib/ostukorv";
import { kmProtsent } from "@/lib/tellimused";

export const metadata: Metadata = {
  title: "Kassa",
  robots: { index: false },
};

export default async function KassaLeht() {
  const korv = await loeOstukorv();
  if (korv.tühi) redirect("/ostukorv");

  const puudulikud = korv.read.filter((rida) => rida.puudulik);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-8 text-3xl font-bold text-navi-900">Kassa</h1>

      {puudulikud.length > 0 && (
        <p
          role="alert"
          className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
        >
          Mõne toote soovitud kogus ületab laoseisu. Palun{" "}
          <Link href="/ostukorv" className="font-semibold underline">
            muuda ostukorvi
          </Link>{" "}
          enne tellimuse esitamist.
        </p>
      )}

      <KassaVorm
        read={korv.read}
        kaupadeSummaSendid={korv.kaupadeSummaSendid}
        tarneviisid={[...tarneviisid]}
        tasutaTarneAlates={tasutaTarneAlates}
        kmProtsent={kmProtsent()}
      />
    </div>
  );
}
