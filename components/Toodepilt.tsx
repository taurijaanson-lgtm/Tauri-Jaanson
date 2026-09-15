"use client";

import { useState } from "react";

/**
 * Tootepilt koos varuvariandiga. Tarnija feedis on pildid absoluutsete
 * URL-idena tema serveris – kui link on katki, näitame kohatäidet, mitte
 * katkist pildiikooni.
 */
export default function Toodepilt({
  url,
  alt,
  klass = "",
  laisk = true,
}: {
  url: string | null;
  alt: string;
  klass?: string;
  laisk?: boolean;
}) {
  const [katki, setKatki] = useState(false);

  if (!url || katki) {
    return (
      <div
        className={`flex items-center justify-center bg-oliiv-100 ${klass}`}
        role="img"
        aria-label={`${alt} – pilt puudub`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          className="h-10 w-10 text-oliiv-300"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="8.5" cy="9.5" r="1.5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="m4 17 5-5 4 4 3-2 4 4" />
        </svg>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- pildid on tarnija serveris, neid ei optimeerita
    <img
      src={url}
      alt={alt}
      loading={laisk ? "lazy" : undefined}
      onError={() => setKatki(true)}
      className={klass}
    />
  );
}
