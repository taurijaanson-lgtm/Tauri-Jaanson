"use client";

import { useState } from "react";
import Toodepilt from "@/components/Toodepilt";

/** Tootepiltide galerii: suur pilt + pisipildid. */
export default function Pildigalerii({
  pildid,
  nimi,
}: {
  pildid: string[];
  nimi: string;
}) {
  const [aktiivne, setAktiivne] = useState(0);

  if (pildid.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-xl border border-hall-200 bg-hall-100 text-sm text-hall-400">
        Pilt puudub
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-hall-200 bg-white">
        <Toodepilt
          url={pildid[aktiivne]}
          alt={`${nimi} – pilt ${aktiivne + 1}`}
          laisk={false}
          klass="aspect-square w-full object-cover"
        />
      </div>

      {pildid.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto">
          {pildid.map((pilt, indeks) => (
            <li key={pilt}>
              <button
                type="button"
                onClick={() => setAktiivne(indeks)}
                aria-label={`Näita pilti ${indeks + 1}`}
                aria-current={indeks === aktiivne}
                className={`h-20 w-20 overflow-hidden rounded-lg border-2 transition ${
                  indeks === aktiivne
                    ? "border-oliiv-800"
                    : "border-hall-200 hover:border-oliiv-600"
                }`}
              >
                <Toodepilt url={pilt} alt="" klass="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
