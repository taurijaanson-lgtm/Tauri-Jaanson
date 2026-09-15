import fs from "node:fs";
import path from "node:path";

/**
 * Tõlketabel. SPECHURT-i feed on poolakeelne, pood aga eestikeelne, seega
 * hoiame eestikeelseid nimetusi eraldi CSV-failis, mida poe haldaja saab
 * täiendada ilma koodi muutmata.
 *
 * Vorming (semikooloniga eraldatud, esimene rida on päis):
 *   tyyp;votme;nimi;kirjeldus
 *   toode;SP-1001;Tööpüksid Classic;<p>Vastupidavad tööpüksid…</p>
 *   kategooria;Odzież robocza;Tööriided;
 *
 * `tyyp` on "toode" (võti = toote ID feedis) või "kategooria"
 * (võti = kategooria nimi feedis).
 */

export type Tõlge = { nimi: string | null; kirjeldus: string | null };

export type Tõlked = {
  tooted: Map<string, Tõlge>;
  kategooriad: Map<string, Tõlge>;
};

export function tühjadTõlked(): Tõlked {
  return { tooted: new Map(), kategooriad: new Map() };
}

/** Jagab CSV-rea väljadeks; toetab jutumärkides välju ja "" paomärki. */
export function parsiRida(rida: string, eraldaja = ";"): string[] {
  const väljad: string[] = [];
  let praegune = "";
  let jutumärkides = false;
  for (let i = 0; i < rida.length; i += 1) {
    const märk = rida[i];
    if (jutumärkides) {
      if (märk === '"') {
        if (rida[i + 1] === '"') {
          praegune += '"';
          i += 1;
        } else {
          jutumärkides = false;
        }
      } else {
        praegune += märk;
      }
    } else if (märk === '"') {
      jutumärkides = true;
    } else if (märk === eraldaja) {
      väljad.push(praegune.trim());
      praegune = "";
    } else {
      praegune += märk;
    }
  }
  väljad.push(praegune.trim());
  return väljad;
}

export function parsiTõlked(csv: string): Tõlked {
  const tõlked = tühjadTõlked();
  const read = csv.split(/\r?\n/).filter((rida) => rida.trim() !== "");
  for (const rida of read) {
    if (rida.startsWith("#")) continue;
    const [tüüp, võti, nimi, kirjeldus] = parsiRida(rida);
    if (!tüüp || !võti) continue;
    const liik = tüüp.toLowerCase();
    if (liik === "tyyp" || liik === "tüüp") continue; // päiserida
    const väärtus: Tõlge = {
      nimi: nimi && nimi !== "" ? nimi : null,
      kirjeldus: kirjeldus && kirjeldus !== "" ? kirjeldus : null,
    };
    if (liik === "toode") tõlked.tooted.set(võti, väärtus);
    else if (liik === "kategooria") tõlked.kategooriad.set(võti, väärtus);
  }
  return tõlked;
}

export function laeTõlked(tee?: string): Tõlked {
  const failitee = tee ?? path.join(process.cwd(), "data", "tolked.csv");
  if (!fs.existsSync(failitee)) return tühjadTõlked();
  return parsiTõlked(fs.readFileSync(failitee, "utf-8"));
}
