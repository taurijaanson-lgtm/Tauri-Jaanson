import Link from "next/link";
import { kataloogiStatistika } from "@/lib/kataloog";
import { pood, tarneviisid } from "@/lib/konfiguratsioon";
import { vormindaKuupäev } from "@/lib/hinnad";

export default function Jalus() {
  const statistika = kataloogiStatistika();

  return (
    <footer className="mt-16 border-t border-hall-200 bg-navi-900 text-navi-100">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <h2 className="mb-3 text-base font-bold text-white">{pood.nimi}</h2>
          <p className="text-sm leading-relaxed text-navi-200">
            {pood.slogan}. Kataloogis {statistika.tooteid} toodet{" "}
            {statistika.kategooriaid} kategoorias.
          </p>
          {statistika.uuendatud && (
            <p className="mt-3 text-xs text-navi-200">
              Hinnad ja laoseisud uuendatud: {vormindaKuupäev(statistika.uuendatud)}
            </p>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-kollane-400">
            Klienditugi
          </h2>
          <ul className="space-y-2 text-sm">
            <li>
              <a className="hover:text-kollane-400" href={`mailto:${pood.epost}`}>
                {pood.epost}
              </a>
            </li>
            <li>
              <a
                className="hover:text-kollane-400"
                href={`tel:${pood.telefon.replace(/\s/g, "")}`}
              >
                {pood.telefon}
              </a>
            </li>
            <li className="text-navi-200">{pood.aadress}</li>
            <li className="text-navi-200">E–R 9:00–17:00</li>
          </ul>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-kollane-400">
            Info
          </h2>
          <ul className="space-y-2 text-sm">
            <li>
              <Link className="hover:text-kollane-400" href="/tooted">
                Kõik tooted
              </Link>
            </li>
            <li>
              <Link className="hover:text-kollane-400" href="/info/tarne">
                Tarne ja tagastus
              </Link>
            </li>
            <li>
              <Link className="hover:text-kollane-400" href="/info/tingimused">
                Müügitingimused
              </Link>
            </li>
            <li>
              <Link className="hover:text-kollane-400" href="/info/kontakt">
                Kontakt
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-kollane-400">
            Tarneviisid
          </h2>
          <ul className="space-y-2 text-sm text-navi-200">
            {tarneviisid.map((viis) => (
              <li key={viis.kood}>{viis.nimi}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-navi-700">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-xs text-navi-200 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {pood.nimi}. Reg nr {pood.registrikood}, KMKR{" "}
            {pood.kmNumber}.
          </p>
          <p>Hinnad sisaldavad käibemaksu.</p>
        </div>
      </div>
    </footer>
  );
}
