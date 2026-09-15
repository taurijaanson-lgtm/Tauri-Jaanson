/**
 * SPECHURT HEAVY XML-i import.
 *
 * Kasutus:
 *   npm run impordi -- --fail data/naidis-heavy.xml
 *   npm run impordi -- --url "https://b2b.spechurt.pl/xml_plik_eksportu_export.php?key=KLIENDI_VOTI"
 *   npm run impordi                # kasutab keskkonnamuutujat SPECHURT_XML_URL
 *
 * Lisavõtmed:
 *   --kustuta-puuduvad   kustutab tooted, mida feedis enam pole (vaikimisi peidab)
 *   --peida-laota        peidab tooted, mille laoseis on 0
 *
 * Tarnija genereerib faili kord ööpäevas kella 03:00–04:00 vahel, seega
 * mõistlik on seada cron tööle nt kell 05:30.
 */
import fs from "node:fs";
import { Readable } from "node:stream";
import { impordiTooted, logiImport } from "../lib/import";
import { loeTootedVoost, tuvastaVeakood, VEAKOODID } from "../lib/spechurt";
import { laeTõlked } from "../lib/tolked";

type Argumendid = {
  fail?: string;
  url?: string;
  kustutaPuuduvad: boolean;
  peidaLaota: boolean;
};

function loeArgumendid(argv: string[]): Argumendid {
  const tulemus: Argumendid = { kustutaPuuduvad: false, peidaLaota: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--fail" || arg === "-f") tulemus.fail = argv[++i];
    else if (arg === "--url" || arg === "-u") tulemus.url = argv[++i];
    else if (arg === "--kustuta-puuduvad") tulemus.kustutaPuuduvad = true;
    else if (arg === "--peida-laota") tulemus.peidaLaota = true;
  }
  return tulemus;
}

function ehitaUrl(seaded: Argumendid): string | undefined {
  if (seaded.url) return seaded.url;
  const url = process.env.SPECHURT_XML_URL;
  if (!url) return undefined;
  const võti = process.env.SPECHURT_KLIENDI_VOTI;
  if (võti && !url.includes("key=")) {
    return `${url}${url.includes("?") ? "&" : "?"}key=${encodeURIComponent(võti)}`;
  }
  return url;
}

async function avaVoog(
  seaded: Argumendid,
): Promise<{ voog: AsyncIterable<Uint8Array | string>; allikas: string }> {
  if (seaded.fail) {
    if (!fs.existsSync(seaded.fail)) {
      throw new Error(`Faili ei leitud: ${seaded.fail}`);
    }
    return { voog: fs.createReadStream(seaded.fail), allikas: seaded.fail };
  }

  const url = ehitaUrl(seaded);
  if (!url) {
    throw new Error(
      "Määra --fail või --url, või seadista keskkonnamuutuja SPECHURT_XML_URL.",
    );
  }

  const vastus = await fetch(url, {
    headers: { "User-Agent": "Spetspood-XML-import/1.0" },
  });
  if (!vastus.ok) {
    throw new Error(
      `Allalaadimine ebaõnnestus: HTTP ${vastus.status} ${vastus.statusText}`,
    );
  }
  if (!vastus.body) throw new Error("Server ei tagastanud sisu.");

  // Veateated (ERR104/105/106) tulevad lühikese tekstivastusena, mitte XML-ina.
  const tüüp = vastus.headers.get("content-type") ?? "";
  const pikkus = Number(vastus.headers.get("content-length") ?? "0");
  if (!tüüp.includes("xml") && pikkus > 0 && pikkus < 4096) {
    const tekst = await vastus.text();
    const kood = tuvastaVeakood(tekst);
    if (kood) throw new Error(`[${kood}] ${VEAKOODID[kood]}`);
    throw new Error(`Ootamatu vastus serverilt: ${tekst.slice(0, 200)}`);
  }

  // URL-i logime ilma kliendivõtmeta, et võti logidesse ei satuks.
  const puhasUrl = url.replace(/key=[^&]*/i, "key=***");
  return {
    voog: Readable.fromWeb(vastus.body as Parameters<typeof Readable.fromWeb>[0]),
    allikas: puhasUrl,
  };
}

async function main(): Promise<void> {
  const seaded = loeArgumendid(process.argv.slice(2));
  const algus = new Date();
  let allikas = "tundmatu";
  try {
    const avatud = await avaVoog(seaded);
    allikas = avatud.allikas;
    console.log(`Impordin: ${allikas}`);
    const tulemus = await impordiTooted(loeTootedVoost(avatud.voog), {
      tõlked: laeTõlked(),
      kustutaPuuduvad: seaded.kustutaPuuduvad,
      peidaLaoseisuta: seaded.peidaLaota,
      logi: (teade) => console.log(teade),
    });
    logiImport(allikas, algus, tulemus);
    console.log(
      [
        "Import valmis.",
        `  tooteid:      ${tulemus.tooteid}`,
        `  variante:     ${tulemus.variante}`,
        `  uusi kategooriaid: ${tulemus.kategooriaid}`,
        `  peidetud:     ${tulemus.peidetud}`,
        `  kustutatud:   ${tulemus.kustutatud}`,
        `  vigu:         ${tulemus.vigu}`,
      ].join("\n"),
    );
    if (tulemus.tooteid === 0) {
      console.warn("Hoiatus: ühtegi toodet ei imporditud. Kontrolli faili sisu.");
      process.exitCode = 1;
    }
  } catch (viga) {
    const teade = viga instanceof Error ? viga.message : String(viga);
    logiImport(allikas, algus, null, teade);
    console.error(`Import ebaõnnestus: ${teade}`);
    process.exitCode = 1;
  }
}

void main();
