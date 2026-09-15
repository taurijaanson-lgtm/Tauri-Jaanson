import { JOONISED } from "./Ikoonid";

/**
 * Avalehe hero-illustratsioon: töö- ja kaitsevahendid kamuflaažitaustal.
 *
 * Kogu stseen on üks inline-SVG – laadib kohe, skaleerub teravalt igal ekraanil
 * ja töötab ka siis, kui väline pildiserver ei vasta. Kui poe haldaja soovib
 * siia Canvas tehtud illustratsiooni, piisab faili `public/pildid/hero.png`
 * lisamisest (vt README) – siis kuvatakse selle asemel pilti.
 */
export default function Hero({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 640 520"
      className={className}
      role="img"
      aria-label="Illustratsioon tööriietest, turvajalatsitest, kaitsekiivrist ja tööriistadest"
    >
      <defs>
        {/* Kamuflaažimuster taustale. */}
        <pattern
          id="hero-kamuflaaz"
          width="160"
          height="160"
          patternUnits="userSpaceOnUse"
        >
          <rect width="160" height="160" fill="#23301b" />
          <path
            d="M-10 30c30-18 52 6 78-4s38-26 66-18 34 30 18 44-46 2-66 14-38 26-62 14-34-42-34-50Z"
            fill="#334527"
          />
          <path
            d="M40 96c22-10 30 10 52 6s28-16 46-8 12 30-6 38-44 10-62 2-52-28-30-38Z"
            fill="#405530"
          />
          <path
            d="M96 12c14-8 30 4 30 16s-16 18-28 14-16-22-2-30Z"
            fill="#182113"
          />
          <path
            d="M6 118c12-8 26 2 24 14s-18 16-28 8-8-14 4-22Z"
            fill="#182113"
          />
        </pattern>

        {/* Pehme vinjett, et tekst jääks vasakul loetavaks. */}
        <linearGradient id="hero-vari" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#161c11" stopOpacity="0.85" />
          <stop offset="55%" stopColor="#161c11" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#161c11" stopOpacity="0.35" />
        </linearGradient>

        <clipPath id="hero-raam">
          <rect x="0" y="0" width="640" height="520" rx="24" />
        </clipPath>
      </defs>

      <g clipPath="url(#hero-raam)">
        <rect width="640" height="520" fill="url(#hero-kamuflaaz)" />
        <rect width="640" height="520" fill="url(#hero-vari)" />

        {/* Trafarettjooned – laoriiuli tunne. */}
        <g stroke="#6b7f4e" strokeOpacity="0.35" strokeWidth="2">
          <path d="M0 176h640M0 344h640" />
          <path d="M96 0v520M320 0v520M544 0v520" strokeOpacity="0.16" />
        </g>

        {/* Kollane hoiatustriip ülemises paremas nurgas. */}
        <g transform="rotate(-45 596 -24)">
          <rect x="470" y="-36" width="260" height="22" fill="#c9a227" />
          <g fill="#23301b">
            {Array.from({ length: 9 }, (_, i) => (
              <rect key={i} x={478 + i * 28} y="-36" width="12" height="22" />
            ))}
          </g>
        </g>

        {/* Esiplaani esemed. Iga joonis on 64×64 ruudustikus, skaleerime need
            erinevasse suurusse ja asendisse, et tekiks diagonaalne rütm. */}
        <g
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          stroke="#dfe6d3"
          strokeWidth="2.6"
        >
          <g transform="translate(150 40) scale(2.1)">{JOONISED.kiiver}</g>
          <g transform="translate(360 24) scale(1.6)" stroke="#c9a227">
            {JOONISED.prillid}
          </g>
          <g transform="translate(468 96) scale(1.5)">{JOONISED.klapid}</g>

          <g transform="translate(64 206) scale(1.9)" stroke="#a9bd8c">
            {JOONISED.puksid}
          </g>
          <g transform="translate(250 190) scale(2.3)">{JOONISED.vest}</g>
          <g transform="translate(452 214) scale(1.7)" stroke="#a9bd8c">
            {JOONISED.kinnas}
          </g>

          <g transform="translate(96 372) scale(1.8)" stroke="#c9a227">
            {JOONISED.saabas}
          </g>
          <g transform="translate(272 378) scale(1.6)">{JOONISED.trell}</g>
          <g transform="translate(446 380) scale(1.7)" stroke="#a9bd8c">
            {JOONISED.votme}
          </g>
        </g>
      </g>

      <rect
        x="1"
        y="1"
        width="638"
        height="518"
        rx="24"
        fill="none"
        stroke="#4d6139"
        strokeWidth="2"
      />
    </svg>
  );
}
