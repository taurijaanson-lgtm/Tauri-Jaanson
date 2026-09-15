/**
 * SPECHURT HEAVY XML-i lugemine.
 *
 * Spetsifikatsioon (XML INTEGRATION SPECIFICATION, kehtiv alates 01.11.2023)
 * kirjeldab UTF-8 faili, mis genereeritakse kord ööpäevas kella 03:00 ja 04:00
 * vahel. Fail võib olla sadu megabaite, seepärast loeme selle tükkidena ja
 * parsime ühe <produkt> elemendi korraga.
 */
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
});

export type ToorVariant = {
  id: string;
  ean: string | null;
  /** Variandi nimi, nt "Suurus" või "Värv". */
  nimi: string | null;
  /** Variandi väärtus, nt "41" või "punane". */
  väärtus: string | null;
  laoseis: number;
};

export type ToorToode = {
  id: string;
  sku: string | null;
  ean: string | null;
  tootja: string | null;
  nimi: string;
  kirjeldus: string;
  kategooria: string;
  kaal: number | null;
  pildid: string[];
  variandid: ToorVariant[];
  laoseis: number;
  jaehindBrutoPln: number;
  hulgihindBrutoPln: number;
  km: number;
};

/** Teeb ühest või mitmest elemendist alati massiivi. */
function massiiv<T>(väärtus: T | T[] | undefined | null): T[] {
  if (väärtus === undefined || väärtus === null) return [];
  return Array.isArray(väärtus) ? väärtus : [väärtus];
}

function tekstiks(väärtus: unknown): string | null {
  if (väärtus === undefined || väärtus === null) return null;
  if (typeof väärtus === "object") {
    const sisu = (väärtus as Record<string, unknown>)["#text"];
    return sisu === undefined || sisu === null ? null : String(sisu).trim();
  }
  const tekst = String(väärtus).trim();
  return tekst === "" ? null : tekst;
}

/**
 * Feed kasutab nii koma- kui punktieraldajat ja lisab kohati tühikuid
 * tuhandete eraldajaks ("1 234,56").
 */
function arvuks(väärtus: unknown, vaikimisi = 0): number {
  const tekst = tekstiks(väärtus);
  if (tekst === null) return vaikimisi;
  const puhas = tekst.replace(/\s/g, "").replace(",", ".").replace(/[^0-9.\-]/g, "");
  const arv = Number.parseFloat(puhas);
  return Number.isFinite(arv) ? arv : vaikimisi;
}

function täisarvuks(väärtus: unknown, vaikimisi = 0): number {
  return Math.trunc(arvuks(väärtus, vaikimisi));
}

/** EAN-13 valideerimine kontrollnumbri järgi; vigase koodi jätame välja. */
export function kehtivEan(kood: string | null): string | null {
  if (!kood) return null;
  const puhas = kood.replace(/\D/g, "");
  if (puhas.length !== 13) return null;
  let summa = 0;
  for (let i = 0; i < 12; i += 1) {
    summa += Number(puhas[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const kontroll = (10 - (summa % 10)) % 10;
  return kontroll === Number(puhas[12]) ? puhas : null;
}

/** Parsib ühe <produkt>...</produkt> fragmendi. */
export function parsiToode(fragment: string): ToorToode | null {
  const puu = parser.parse(fragment) as Record<string, unknown>;
  const p = (puu.produkt ?? puu) as Record<string, unknown>;
  const id = tekstiks(p.id);
  const nimi = tekstiks(p.nazwa);
  if (!id || !nimi) return null;

  const pildid = massiiv(
    (p.zdjecia as Record<string, unknown> | undefined)?.zdjecie ??
      (p.zdjecie as unknown),
  )
    .map((pilt) => ({
      url: tekstiks(pilt),
      järjekord: täisarvuks(
        (pilt as Record<string, unknown> | null)?.["@_pozycja"],
        999,
      ),
    }))
    .filter((pilt): pilt is { url: string; järjekord: number } => Boolean(pilt.url))
    .sort((a, b) => a.järjekord - b.järjekord)
    .map((pilt) => pilt.url);

  const variandid = massiiv(
    (p.warianty as Record<string, unknown> | undefined)?.wariant ??
      (p.wariant as unknown),
  )
    .map((v): ToorVariant | null => {
      const rida = v as Record<string, unknown>;
      const variandiId = tekstiks(rida.wariant_id) ?? tekstiks(rida.wariant_sku);
      if (!variandiId) return null;
      return {
        id: variandiId,
        ean: kehtivEan(tekstiks(rida.wariant_ean)),
        nimi: tekstiks(rida.wariant_nazwa),
        väärtus: tekstiks(rida.wariant_wartosc),
        laoseis: Math.max(0, täisarvuks(rida.wariant_stan_magazynowy)),
      };
    })
    .filter((v): v is ToorVariant => v !== null);

  // Spetsifikatsiooni järgi on <stan_magazynowy> kas toote laoseis või
  // variantide summa. Kui variandid on olemas, usaldame variantide summat.
  const variandiLaoseis = variandid.reduce((summa, v) => summa + v.laoseis, 0);
  const laoseis =
    variandid.length > 0
      ? variandiLaoseis
      : Math.max(0, täisarvuks(p.stan_magazynowy));

  return {
    id,
    sku: tekstiks(p.sku) ?? id,
    ean: kehtivEan(tekstiks(p.ean)),
    tootja: tekstiks(p.producent),
    nimi,
    kirjeldus: tekstiks(p.dlugi_opis) ?? "",
    kategooria: tekstiks(p.kategoria) ?? "Muu",
    kaal: tekstiks(p.waga) === null ? null : arvuks(p.waga),
    pildid,
    variandid,
    laoseis,
    jaehindBrutoPln: arvuks(p.cena_zewnetrzna),
    hulgihindBrutoPln: arvuks(p.cena_zewnetrzna_hurt),
    km: arvuks(p.vat, 0.23),
  };
}

/**
 * Tükeldab XML-teksti <produkt> elementideks. Töötab nii juurelemendiga
 * (<produkty>...) kui ilma, sest spetsifikatsiooni näide esitab <produkt>
 * elemendi üksi.
 */
export function* tükeldaTooted(xml: string): Generator<string> {
  const muster = /<produkt(?:\s[^>]*)?>[\s\S]*?<\/produkt>/g;
  for (const vaste of xml.matchAll(muster)) {
    yield vaste[0];
  }
}

/**
 * Loeb tooted voost (fail või HTTP-vastus) ilma tervet XML-i mällu lugemata.
 * Puhvrist võtame välja terviklikud <produkt> elemendid ja ülejäänu jätame
 * järgmise tüki ette.
 */
export async function* loeTootedVoost(
  voog: AsyncIterable<Uint8Array | string>,
): AsyncGenerator<ToorToode> {
  const dekooder = new TextDecoder("utf-8");
  let puhver = "";
  for await (const tükk of voog) {
    puhver +=
      typeof tükk === "string" ? tükk : dekooder.decode(tükk, { stream: true });
    let lõpp = puhver.indexOf("</produkt>");
    while (lõpp !== -1) {
      const fragment = puhver.slice(0, lõpp + "</produkt>".length);
      const algus = fragment.search(/<produkt(?:\s|>)/);
      if (algus !== -1) {
        const toode = parsiToode(fragment.slice(algus));
        if (toode) yield toode;
      }
      puhver = puhver.slice(lõpp + "</produkt>".length);
      lõpp = puhver.indexOf("</produkt>");
    }
    // Hoiame puhvri kasvamise piires: ilma sulgeva sildita osa võib olla pikk,
    // aga mitte lõputu.
    if (puhver.length > 50_000_000) {
      throw new Error(
        "XML-i puhver kasvas üle 50 MB ilma terve <produkt> elemendita – kas fail on katki?",
      );
    }
  }
}

/** Tuntud veakoodid spetsifikatsiooni peatükist "Errors when downloading exports". */
export const VEAKOODID: Record<string, string> = {
  ERR104:
    "Kontol puuduvad XML-ekspordi õigused või hulgimüügikonto on peatatud. Võta ühendust SPECHURT B2B osakonnaga.",
  ERR105:
    "Vigane API võti või IP-aadress. Kontrolli, et allalaadimise IP on SPECHURT-is registreeritud.",
  ERR106:
    "Ekspordifaili pole veel genereeritud. Uus fail valmib igal ööl kella 03:00–04:00.",
};

/** Kontrollib, kas server vastas veakoodiga (ERR104 / ERR105 / ERR106). */
export function tuvastaVeakood(vastus: string): string | null {
  const vaste = vastus.match(/ERR10[456]/);
  return vaste ? vaste[0] : null;
}
