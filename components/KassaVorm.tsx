"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { esitaTellimus, type KassaOlek } from "@/app/toimingud";
import { vormindaHind } from "@/lib/hinnad";
import type { Tarneviis } from "@/lib/konfiguratsioon";
import type { KorviRida } from "@/lib/ostukorv";

const ALGOLEK: KassaOlek = { vead: {}, väärtused: {} };

/** Näidisloend pakiautomaatidest. Päris poes tuleks see tarnija API-st. */
const PAKIAUTOMAADID: Record<string, string[]> = {
  omniva: [
    "Tallinn, Kristiine keskuse pakiautomaat",
    "Tallinn, Ülemiste keskuse pakiautomaat",
    "Tartu, Lõunakeskuse pakiautomaat",
    "Pärnu, Port Arturi pakiautomaat",
    "Narva, Fama keskuse pakiautomaat",
  ],
  smartpost: [
    "Tallinn, Rocca al Mare SmartPOST",
    "Tallinn, Mustamäe Kaubanduskeskuse SmartPOST",
    "Tartu, Eeden SmartPOST",
    "Viljandi, Centrumi SmartPOST",
  ],
  dpd: [
    "Tallinn, Järve keskuse DPD pakiautomaat",
    "Tallinn, Magistrali keskuse DPD pakiautomaat",
    "Tartu, Kvartali DPD pakiautomaat",
    "Rakvere, Põhjakeskuse DPD pakiautomaat",
  ],
};

function Väli({
  nimi,
  silt,
  viga,
  vaikeväärtus,
  tüüp = "text",
  vihje,
  ...rest
}: {
  nimi: string;
  silt: string;
  viga?: string;
  vaikeväärtus?: string;
  tüüp?: string;
  vihje?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <p className="space-y-1">
      <label htmlFor={nimi} className="block text-sm font-medium text-navi-800">
        {silt}
      </label>
      <input
        id={nimi}
        name={nimi}
        type={tüüp}
        defaultValue={vaikeväärtus}
        aria-invalid={viga ? true : undefined}
        aria-describedby={viga ? `${nimi}-viga` : undefined}
        className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-hall-800 focus:outline-none ${
          viga
            ? "border-red-400 focus:border-red-500"
            : "border-hall-200 focus:border-navi-600"
        }`}
        {...rest}
      />
      {vihje && !viga && <span className="block text-xs text-hall-400">{vihje}</span>}
      {viga && (
        <span id={`${nimi}-viga`} className="block text-xs font-medium text-red-600">
          {viga}
        </span>
      )}
    </p>
  );
}

function EsitaNupp({ summa }: { summa: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-kollane-500 px-6 py-3.5 text-base font-bold text-navi-900 transition hover:bg-kollane-400 disabled:cursor-not-allowed disabled:bg-hall-200"
    >
      {pending ? "Saadan tellimust…" : `Esita tellimus – ${vormindaHind(summa)}`}
    </button>
  );
}

export default function KassaVorm({
  read,
  kaupadeSummaSendid,
  tarneviisid,
  tasutaTarneAlates,
  kmProtsent,
}: {
  read: KorviRida[];
  kaupadeSummaSendid: number;
  tarneviisid: Tarneviis[];
  tasutaTarneAlates: number;
  kmProtsent: string;
}) {
  const [olek, tegevus] = useActionState(esitaTellimus, ALGOLEK);
  const [valitudTarne, setValitudTarne] = useState(
    olek.väärtused.tarneviis || tarneviisid[0]?.kood || "",
  );

  const tarneviis = tarneviisid.find((t) => t.kood === valitudTarne) ?? null;
  const tasuta = kaupadeSummaSendid >= tasutaTarneAlates;
  const tarneSendid = tasuta ? 0 : (tarneviis?.hindSendid ?? 0);
  const kokkuSendid = kaupadeSummaSendid + tarneSendid;

  return (
    <form action={tegevus} className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-8">
        {olek.üldineViga && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700"
          >
            {olek.üldineViga}
          </p>
        )}

        <section className="rounded-xl border border-hall-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-bold text-navi-900">Kontaktandmed</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Väli
                nimi="nimi"
                silt="Ees- ja perekonnanimi"
                autoComplete="name"
                viga={olek.vead.nimi}
                vaikeväärtus={olek.väärtused.nimi}
                required
              />
            </div>
            <Väli
              nimi="epost"
              silt="E-post"
              tüüp="email"
              autoComplete="email"
              viga={olek.vead.epost}
              vaikeväärtus={olek.väärtused.epost}
              vihje="Saadame siia tellimuse kinnituse"
              required
            />
            <Väli
              nimi="telefon"
              silt="Telefon"
              tüüp="tel"
              autoComplete="tel"
              viga={olek.vead.telefon}
              vaikeväärtus={olek.väärtused.telefon}
              vihje="Kulleri või pakiautomaadi teavituseks"
              required
            />
          </div>
        </section>

        <section className="rounded-xl border border-hall-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-bold text-navi-900">Tarneviis</h2>
          {olek.vead.tarneviis && (
            <p className="mb-3 text-sm font-medium text-red-600">{olek.vead.tarneviis}</p>
          )}
          <ul className="space-y-3">
            {tarneviisid.map((viis) => (
              <li key={viis.kood}>
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition ${
                    valitudTarne === viis.kood
                      ? "border-navi-800 bg-navi-50"
                      : "border-hall-200 hover:border-navi-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="tarneviis"
                    value={viis.kood}
                    checked={valitudTarne === viis.kood}
                    onChange={() => setValitudTarne(viis.kood)}
                    className="h-4 w-4"
                  />
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-navi-800">
                      {viis.nimi}
                    </span>
                    <span className="block text-xs text-hall-600">{viis.kirjeldus}</span>
                  </span>
                  <span className="text-sm font-bold text-navi-900">
                    {tasuta ? "0,00 €" : vormindaHind(viis.hindSendid)}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          {tarneviis?.pakiautomaat ? (
            <p className="mt-5 space-y-1">
              <label
                htmlFor="tarnepunkt"
                className="block text-sm font-medium text-navi-800"
              >
                Vali pakiautomaat
              </label>
              <select
                id="tarnepunkt"
                name="tarnepunkt"
                defaultValue={olek.väärtused.tarnepunkt}
                className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-hall-800 focus:outline-none ${
                  olek.vead.tarnepunkt
                    ? "border-red-400"
                    : "border-hall-200 focus:border-navi-600"
                }`}
              >
                <option value="">— vali pakiautomaat —</option>
                {(PAKIAUTOMAADID[tarneviis.kood] ?? []).map((punkt) => (
                  <option key={punkt} value={punkt}>
                    {punkt}
                  </option>
                ))}
              </select>
              {olek.vead.tarnepunkt && (
                <span className="block text-xs font-medium text-red-600">
                  {olek.vead.tarnepunkt}
                </span>
              )}
            </p>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Väli
                  nimi="aadress"
                  silt="Tänav, maja ja korter"
                  autoComplete="street-address"
                  viga={olek.vead.aadress}
                  vaikeväärtus={olek.väärtused.aadress}
                />
              </div>
              <Väli
                nimi="linn"
                silt="Linn või vald"
                autoComplete="address-level2"
                viga={olek.vead.linn}
                vaikeväärtus={olek.väärtused.linn}
              />
              <Väli
                nimi="indeks"
                silt="Postiindeks"
                autoComplete="postal-code"
                inputMode="numeric"
                viga={olek.vead.indeks}
                vaikeväärtus={olek.väärtused.indeks}
              />
            </div>
          )}
        </section>

        <section className="rounded-xl border border-hall-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-bold text-navi-900">Maksmine</h2>
          <p className="rounded-lg border border-hall-200 bg-hall-50 p-4 text-sm text-hall-800">
            Tellimuse kinnitamisel saadame e-postiga arve koos maksejuhistega.
            Saadame kauba teele kohe pärast makse laekumist.
          </p>

          <p className="mt-5 space-y-1">
            <label htmlFor="markused" className="block text-sm font-medium text-navi-800">
              Märkused tellimuse kohta (valikuline)
            </label>
            <textarea
              id="markused"
              name="markused"
              rows={3}
              defaultValue={olek.väärtused.markused}
              className="w-full rounded-lg border border-hall-200 bg-white px-3 py-2.5 text-sm text-hall-800 focus:border-navi-600 focus:outline-none"
            />
          </p>

          <label className="mt-5 flex items-start gap-3 text-sm text-hall-800">
            <input
              type="checkbox"
              name="tingimused"
              value="1"
              className="mt-0.5 h-4 w-4 rounded border-hall-400"
            />
            <span>
              Olen tutvunud{" "}
              <Link href="/info/tingimused" className="text-navi-600 hover:underline">
                müügitingimustega
              </Link>{" "}
              ja nõustun nendega.
            </span>
          </label>
          {olek.vead.tingimused && (
            <p className="mt-2 text-xs font-medium text-red-600">
              {olek.vead.tingimused}
            </p>
          )}
        </section>
      </div>

      <aside className="h-fit rounded-xl border border-hall-200 bg-white p-6 lg:sticky lg:top-40">
        <h2 className="mb-4 text-lg font-bold text-navi-900">Sinu tellimus</h2>
        <ul className="mb-4 space-y-3 border-b border-hall-200 pb-4">
          {read.map((rida) => (
            <li key={rida.võti} className="flex justify-between gap-3 text-sm">
              <span className="text-hall-800">
                <span className="font-medium">{rida.kogus} ×</span> {rida.nimi}
                {rida.variandiNimi && (
                  <span className="block text-xs text-hall-600">{rida.variandiNimi}</span>
                )}
              </span>
              <span className="whitespace-nowrap font-medium">
                {vormindaHind(rida.summaSendid)}
              </span>
            </li>
          ))}
        </ul>

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-hall-600">Kaubad</dt>
            <dd className="font-medium">{vormindaHind(kaupadeSummaSendid)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-hall-600">Tarne</dt>
            <dd className="font-medium">
              {tarneSendid === 0 ? "tasuta" : vormindaHind(tarneSendid)}
            </dd>
          </div>
          <div className="flex justify-between border-t border-hall-200 pt-2 text-base font-bold text-navi-900">
            <dt>Kokku</dt>
            <dd>{vormindaHind(kokkuSendid)}</dd>
          </div>
          <div className="flex justify-between text-xs text-hall-400">
            <dt>sh käibemaks {kmProtsent}</dt>
            <dd>
              {vormindaHind(
                kokkuSendid - Math.round(kokkuSendid / (1 + Number(kmProtsent.replace("%", "")) / 100)),
              )}
            </dd>
          </div>
        </dl>

        <div className="mt-6">
          <EsitaNupp summa={kokkuSendid} />
        </div>
        <p className="mt-3 text-center text-xs text-hall-400">
          Tellimuse esitamine ei kohusta kohe maksma – arve saadame e-postiga.
        </p>
      </aside>
    </form>
  );
}
