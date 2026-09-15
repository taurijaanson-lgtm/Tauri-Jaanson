import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { vormindaHind, vormindaKuupäev } from "@/lib/hinnad";
import { pood, tarneviisid } from "@/lib/konfiguratsioon";
import { kmProtsent, leiaTellimus } from "@/lib/tellimused";

export const metadata: Metadata = {
  title: "Tellimus vastu võetud",
  robots: { index: false },
};

export default async function TellimuseLeht(
  props: PageProps<"/tellimus/[number]">,
) {
  const { number } = await props.params;
  const tellimus = leiaTellimus(decodeURIComponent(number));
  if (!tellimus) notFound();

  const tarneviis = tarneviisid.find((t) => t.kood === tellimus.tarneviis);
  const tarneaadress = tellimus.tarnepunkt
    ? tellimus.tarnepunkt
    : [tellimus.aadress, tellimus.linn, tellimus.indeks].filter(Boolean).join(", ");

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <h1 className="text-2xl font-bold text-emerald-800">
          Aitäh! Tellimus on vastu võetud
        </h1>
        <p className="mt-2 text-emerald-700">
          Tellimuse number on <strong>{tellimus.number}</strong>. Saatsime kinnituse
          aadressile {tellimus.epost}.
        </p>
      </div>

      <section className="mt-8 rounded-xl border border-hall-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-bold text-navi-900">Maksejuhised</h2>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[160px_1fr]">
          <dt className="text-hall-600">Saaja</dt>
          <dd className="font-medium text-navi-800">{pood.pank.saaja}</dd>
          <dt className="text-hall-600">IBAN</dt>
          <dd className="font-mono font-medium text-navi-800">{pood.pank.iban}</dd>
          <dt className="text-hall-600">Pank</dt>
          <dd className="font-medium text-navi-800">{pood.pank.nimi}</dd>
          <dt className="text-hall-600">Summa</dt>
          <dd className="font-bold text-navi-900">
            {vormindaHind(tellimus.kokku_sendid)}
          </dd>
          <dt className="text-hall-600">Selgitus</dt>
          <dd className="font-medium text-navi-800">{tellimus.number}</dd>
        </dl>
        <p className="mt-4 text-sm text-hall-600">
          Saadame kauba teele kohe pärast makse laekumist.
        </p>
      </section>

      <section className="mt-6 rounded-xl border border-hall-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-bold text-navi-900">Tellimuse sisu</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hall-200 text-left text-hall-600">
              <th className="py-2 font-medium">Toode</th>
              <th className="py-2 text-center font-medium">Kogus</th>
              <th className="py-2 text-right font-medium">Summa</th>
            </tr>
          </thead>
          <tbody>
            {tellimus.read.map((rida) => (
              <tr key={rida.toode_id + (rida.variant_id ?? "")} className="border-b border-hall-100">
                <td className="py-2 pr-4 text-navi-800">
                  {rida.nimi}
                  {rida.variant_nimi && (
                    <span className="block text-xs text-hall-600">{rida.variant_nimi}</span>
                  )}
                </td>
                <td className="py-2 text-center">{rida.kogus}</td>
                <td className="py-2 text-right font-medium">
                  {vormindaHind(rida.summa_sendid)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className="py-2 text-right text-hall-600">
                Kaubad
              </td>
              <td className="py-2 text-right font-medium">
                {vormindaHind(tellimus.kaubad_sendid)}
              </td>
            </tr>
            <tr>
              <td colSpan={2} className="py-2 text-right text-hall-600">
                Tarne
              </td>
              <td className="py-2 text-right font-medium">
                {tellimus.tarne_sendid === 0
                  ? "tasuta"
                  : vormindaHind(tellimus.tarne_sendid)}
              </td>
            </tr>
            <tr className="border-t border-hall-200">
              <td colSpan={2} className="py-2 text-right font-bold text-navi-900">
                Kokku
              </td>
              <td className="py-2 text-right font-bold text-navi-900">
                {vormindaHind(tellimus.kokku_sendid)}
              </td>
            </tr>
            <tr>
              <td colSpan={2} className="py-1 text-right text-xs text-hall-400">
                sh käibemaks {kmProtsent()}
              </td>
              <td className="py-1 text-right text-xs text-hall-400">
                {vormindaHind(tellimus.km_sendid)}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section className="mt-6 rounded-xl border border-hall-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-bold text-navi-900">Tarne</h2>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[160px_1fr]">
          <dt className="text-hall-600">Tarneviis</dt>
          <dd className="font-medium text-navi-800">
            {tarneviis?.nimi ?? tellimus.tarneviis}
          </dd>
          <dt className="text-hall-600">Sihtkoht</dt>
          <dd className="font-medium text-navi-800">{tarneaadress}</dd>
          <dt className="text-hall-600">Saaja</dt>
          <dd className="font-medium text-navi-800">
            {tellimus.nimi}, {tellimus.telefon}
          </dd>
          <dt className="text-hall-600">Tellimuse aeg</dt>
          <dd className="font-medium text-navi-800">
            {vormindaKuupäev(tellimus.loodud)}
          </dd>
          {tellimus.markused && (
            <>
              <dt className="text-hall-600">Märkused</dt>
              <dd className="text-navi-800">{tellimus.markused}</dd>
            </>
          )}
        </dl>
      </section>

      <div className="mt-8 text-center">
        <Link
          href="/tooted"
          className="inline-block rounded-lg bg-navi-800 px-6 py-3 font-semibold text-white transition hover:bg-navi-700"
        >
          Jätka ostlemist
        </Link>
      </div>
    </div>
  );
}
