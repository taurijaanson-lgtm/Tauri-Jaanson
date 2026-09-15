"use client";

import { useRef } from "react";

/**
 * Filtrite ja sortimise vorm. Tavaline GET-vorm (töötab ilma JavaScriptita),
 * mis JavaScripti olemasolul saadetakse ära kohe valiku muutmisel.
 */
export default function Filtrivorm({
  tegevus,
  otsing,
  järjestus,
  ainultLaos,
  tootja,
  tootjad,
}: {
  tegevus: string;
  otsing: string;
  järjestus: string;
  ainultLaos: boolean;
  tootja: string;
  tootjad: string[];
}) {
  const vorm = useRef<HTMLFormElement>(null);
  const saada = () => vorm.current?.requestSubmit();

  return (
    <form
      ref={vorm}
      action={tegevus}
      method="get"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-hall-200 bg-white p-4"
    >
      {otsing && <input type="hidden" name="otsing" value={otsing} />}

      <div className="flex items-center gap-2">
        <label htmlFor="jarjesta" className="text-sm text-hall-600">
          Järjesta:
        </label>
        <select
          id="jarjesta"
          name="jarjesta"
          defaultValue={järjestus}
          onChange={saada}
          className="rounded-lg border border-hall-200 bg-white px-3 py-2 text-sm text-navi-800"
        >
          <option value="uued">Uuemad enne</option>
          <option value="odavamad">Odavamad enne</option>
          <option value="kallimad">Kallimad enne</option>
          <option value="nimi">Nime järgi (A–Ü)</option>
        </select>
      </div>

      {tootjad.length > 1 && (
        <div className="flex items-center gap-2">
          <label htmlFor="tootja" className="text-sm text-hall-600">
            Tootja:
          </label>
          <select
            id="tootja"
            name="tootja"
            defaultValue={tootja}
            onChange={saada}
            className="rounded-lg border border-hall-200 bg-white px-3 py-2 text-sm text-navi-800"
          >
            <option value="">Kõik tootjad</option>
            {tootjad.map((nimi) => (
              <option key={nimi} value={nimi}>
                {nimi}
              </option>
            ))}
          </select>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-hall-600">
        <input
          type="checkbox"
          name="laos"
          value="1"
          defaultChecked={ainultLaos}
          onChange={saada}
          className="h-4 w-4 rounded border-hall-400 text-navi-800"
        />
        Ainult laos olevad
      </label>

      <noscript>
        <button
          type="submit"
          className="rounded-lg bg-navi-800 px-4 py-2 text-sm font-medium text-white"
        >
          Rakenda
        </button>
      </noscript>
    </form>
  );
}
