"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { lisaKorvi } from "@/app/toimingud";
import type { Variant } from "@/lib/kataloog";

function Nupp({ keelatud }: { keelatud: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={keelatud || pending}
      className="flex-1 rounded-lg bg-liiv-500 px-6 py-3 text-base font-bold text-oliiv-900 transition hover:bg-liiv-400 disabled:cursor-not-allowed disabled:bg-hall-200 disabled:text-hall-600"
    >
      {pending ? "Lisan…" : "Lisa ostukorvi"}
    </button>
  );
}

export default function LisaKorvi({
  tooteId,
  laoseis,
  variandid,
}: {
  tooteId: string;
  laoseis: number;
  variandid: Variant[];
}) {
  const laosVariandid = variandid.filter((v) => v.laoseis > 0);
  const [variandiId, setVariandiId] = useState<string>(
    laosVariandid.length === 1 ? laosVariandid[0].id : "",
  );
  const [kogus, setKogus] = useState(1);

  const valitud = variandid.find((v) => v.id === variandiId) ?? null;
  const saadaval = variandid.length > 0 ? (valitud?.laoseis ?? 0) : laoseis;
  const variantValimata = variandid.length > 0 && !variandiId;
  const otsas = variandid.length > 0 ? laosVariandid.length === 0 : laoseis <= 0;
  const variandiNimi = variandid.find((v) => v.nimi)?.nimi ?? "Variant";

  return (
    <form action={lisaKorvi} className="space-y-5">
      <input type="hidden" name="toode" value={tooteId} />
      <input type="hidden" name="variant" value={variandiId} />
      <input type="hidden" name="kogus" value={kogus} />

      {variandid.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-oliiv-800">
            Vali {variandiNimi.toLowerCase()}
          </legend>
          <div className="flex flex-wrap gap-2">
            {variandid.map((variant) => {
              const pole = variant.laoseis <= 0;
              const aktiivne = variant.id === variandiId;
              return (
                <button
                  key={variant.id}
                  type="button"
                  disabled={pole}
                  onClick={() => {
                    setVariandiId(variant.id);
                    setKogus(1);
                  }}
                  title={
                    pole ? "Otsas" : `Laos ${variant.laoseis} tk`
                  }
                  className={`min-w-14 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    aktiivne
                      ? "border-oliiv-800 bg-oliiv-800 text-white"
                      : pole
                        ? "cursor-not-allowed border-hall-200 bg-hall-50 text-hall-400 line-through"
                        : "border-hall-200 bg-white text-oliiv-800 hover:border-oliiv-600"
                  }`}
                >
                  {variant.vaartus ?? variant.id}
                </button>
              );
            })}
          </div>
          {variantValimata && !otsas && (
            <p className="mt-2 text-xs text-hall-600">
              Ostukorvi lisamiseks vali sobiv {variandiNimi.toLowerCase()}.
            </p>
          )}
        </fieldset>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-lg border border-hall-200 bg-white">
          <button
            type="button"
            onClick={() => setKogus((k) => Math.max(1, k - 1))}
            aria-label="Vähenda kogust"
            className="px-3 py-2 text-lg text-hall-600 hover:text-oliiv-800"
          >
            −
          </button>
          <span className="w-10 text-center text-sm font-semibold" aria-live="polite">
            {kogus}
          </span>
          <button
            type="button"
            onClick={() => setKogus((k) => Math.min(Math.max(1, saadaval), k + 1))}
            aria-label="Suurenda kogust"
            className="px-3 py-2 text-lg text-hall-600 hover:text-oliiv-800"
          >
            +
          </button>
        </div>
        <Nupp keelatud={otsas || variantValimata} />
      </div>

      {otsas ? (
        <p className="text-sm font-medium text-hall-600">
          Toode on hetkel laost otsas. Uus saadetis saabub tavaliselt 1–2 nädalaga.
        </p>
      ) : (
        saadaval > 0 &&
        saadaval <= 5 && (
          <p className="text-sm font-medium text-amber-700">
            Laos ainult {saadaval} tk – telli kiiresti!
          </p>
        )
      )}
    </form>
  );
}
