"use client";

import { useSearchParams } from "next/navigation";

/** Otsinguvorm. Tavaline GET-vorm, seega töötab ka ilma JavaScriptita. */
export default function Otsinguriba() {
  const parameetrid = useSearchParams();

  return (
    <form action="/tooted" method="get" role="search" className="relative">
      <label htmlFor="otsing" className="sr-only">
        Otsi tooteid
      </label>
      <input
        id="otsing"
        name="otsing"
        type="search"
        defaultValue={parameetrid.get("otsing") ?? ""}
        placeholder="Otsi toodet, tootjat või tootekoodi…"
        className="w-full rounded-lg border border-hall-200 bg-hall-50 py-2.5 pl-10 pr-24 text-sm text-hall-800 placeholder:text-hall-400 focus:border-oliiv-600 focus:bg-white focus:outline-none"
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-hall-400"
      >
        <circle cx="11" cy="11" r="7" />
        <path strokeLinecap="round" d="m20 20-3.5-3.5" />
      </svg>
      <button
        type="submit"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md bg-oliiv-800 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-oliiv-700"
      >
        Otsi
      </button>
    </form>
  );
}
