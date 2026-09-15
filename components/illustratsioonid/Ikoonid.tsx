import type { ReactNode } from "react";

/**
 * Illustratsioonide komplekt: lamedad joonvektorid töö- ja kaitsevahenditest.
 *
 * Iga joonistus on kirjeldatud 64×64 koordinaatruudustikus ilma oma `<svg>`
 * ümbriseta, nii et sama teed saab kasutada nii üksiku ikoonina (`<Ikoon />`)
 * kui ka suuremas stseenis (`components/illustratsioonid/Hero.tsx`).
 * Värv tuleb `currentColor`-ist, seega toonime neid Tailwindi klassidega.
 */

export const JOONISED = {
  kiiver: (
    <>
      <path d="M16 42a16 16 0 0 1 32 0" />
      <path d="M24 42a8 16 0 0 1 16 0" />
      <path d="M8 42q24 7 48 0" />
      <path d="M20 48h24" />
    </>
  ),
  saabas: (
    <>
      <path d="M18 14h12l2 16 14 8a6 6 0 0 1 3 5v5H14a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4h4Z" />
      <path d="M10 40h39" />
      <path d="M22 14v12" />
      <path d="M34 34l6 3M31 27l7 4" />
    </>
  ),
  kinnas: (
    <>
      <path d="M22 54V30l-6-4a5 5 0 0 1 5-8l6 4V14a4 4 0 0 1 8 0v8" />
      <path d="M35 22a4 4 0 0 1 8 0v6" />
      <path d="M43 28a4 4 0 0 1 7 3v12a12 12 0 0 1-12 11H22" />
      <path d="M22 44h20" />
    </>
  ),
  puksid: (
    <>
      <path d="M18 10h28v10l-3 34h-9l-2-24-2 24h-9l-3-34V10Z" />
      <path d="M18 20h28" />
      <rect x="22" y="30" width="7" height="8" rx="1" />
      <rect x="36" y="30" width="7" height="8" rx="1" />
    </>
  ),
  prillid: (
    <>
      <path d="M10 26h44v8a8 8 0 0 1-8 8h-6l-8-6-8 6h-6a8 8 0 0 1-8-8v-8Z" />
      <path d="M4 30l6-4M60 30l-6-4" />
      <path d="M32 36v6" />
    </>
  ),
  trell: (
    <>
      <path d="M12 18h24v14H12z" />
      <path d="M36 22h8l8 3v4l-8 3h-8" />
      <path d="M52 25h6" />
      <path d="M16 32l-3 12h12l2-12" />
      <path d="M11 44h18v8H11z" />
    </>
  ),
  votme: (
    <>
      <path d="M44 10a10 10 0 0 0-9 15L14 46a5 5 0 0 0 7 7l21-21a10 10 0 0 0 12-14l-7 7-6-2-2-6 7-7Z" />
    </>
  ),
  vest: (
    <>
      <path d="M22 8l10 8 10-8 10 6-4 10v30H16V24l-4-10 10-6Z" />
      <path d="M32 16v38" />
      <path d="M22 30h4M38 30h4M22 40h4M38 40h4" />
    </>
  ),
  klapid: (
    <>
      <path d="M12 34v-2a20 20 0 0 1 40 0v2" />
      <rect x="6" y="32" width="14" height="20" rx="4" />
      <rect x="44" y="32" width="14" height="20" rx="4" />
    </>
  ),
  moodulint: (
    <>
      <rect x="8" y="18" width="34" height="28" rx="6" />
      <circle cx="25" cy="32" r="7" />
      <path d="M42 30h14v8H42" />
      <path d="M46 30v8M50 30v5M54 30v8" />
    </>
  ),
  jope: (
    <>
      <path d="M24 8l8 6 8-6 12 7-4 11v28H16V26l-4-11 12-7Z" />
      <path d="M32 14v36" />
      <path d="M20 34h5M39 34h5" />
    </>
  ),
  haamer: (
    <>
      <path d="M14 14h20l6 6-6 6H14l-4-6 4-6Z" />
      <path d="M24 26l18 26a4 4 0 0 1-7 4L18 30" />
      <path d="M34 14v12" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IkooniNimi = keyof typeof JOONISED;

/**
 * Valib kategooriale ikooni nime või sisu järgi. Kategooriad tulevad tarnija
 * feedist, seega ei saa loota kindlale nimekirjale – otsime märksõnu nii eesti
 * kui poola keeles ja langeme vajadusel tagasi üldisele ikoonile.
 */
export function kategooriaIkoon(
  ...vihjed: (string | null | undefined)[]
): IkooniNimi {
  const tekst = vihjed.filter(Boolean).join(" ").toLowerCase();
  const reeglid: [RegExp, IkooniNimi][] = [
    [/kiiv|helm|peakaitse/, "kiiver"],
    [/prill|okular|silmakaitse/, "prillid"],
    [/kuulmis|klapp|nausz|ochronniki/, "klapid"],
    [/kinda|kinnas|rekawic|rękawic/, "kinnas"],
    [/jalats|saap|buty|obuwie|trzewik|tall/, "saabas"],
    [/puks|püks|spodnie|traksi|ogrodnicz/, "puksid"],
    [/jope|kurtk/, "jope"],
    [/vest|ohutus|ostrzegaw|helkur|kamizel|sarg|särk|koszul/, "vest"],
    [/trell|wiertar|lihvij|szlifier|elektri|elektronarz/, "trell"],
    [/haamer|mlot|młot/, "haamer"],
    [/votme|võtme|klucz|mutri|kruvikeeraj|wkret|wkręt/, "votme"],
    [/moodu|mõõdu|miara|lood|poziomic/, "moodulint"],
    [/riide|odziez|odzież/, "puksid"],
    [/tooriist|narzedzi|narzędzi|tarvik|akcesori/, "votme"],
  ];
  for (const [muster, nimi] of reeglid) {
    if (muster.test(tekst)) return nimi;
  }
  return "vest";
}

/** Üksik ikoon. Suurus ja värv tulevad `className`-ist. */
export default function Ikoon({
  nimi,
  className = "",
  title,
  joonePaksus = 2,
}: {
  nimi: IkooniNimi;
  className?: string;
  title?: string;
  joonePaksus?: number;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={joonePaksus}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      className={className}
    >
      {title && <title>{title}</title>}
      {JOONISED[nimi]}
    </svg>
  );
}
