import { hinnastamine } from "./konfiguratsioon";

/** Eesti vormingus hind, nt 1234 -> "12,34 €". */
export function vormindaHind(sendid: number): string {
  const eurod = (sendid / 100).toFixed(2).replace(".", ",");
  return `${eurod} €`;
}

/** Eesti vormingus kuupäev ja kellaaeg. */
export function vormindaKuupäev(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Ümardab lõpliku müügihinna vastavalt seadistatud reeglile.
 * - "sent"       – tavaline ümardamine sendi täpsusega
 * - "kumnesent"  – üles lähima 10 sendini
 * - "95" / "99"  – üles lähima ...,95 / ...,99 lõpuni
 */
export function ümardaSendid(
  sendid: number,
  reegel: string = hinnastamine.ümardamine,
): number {
  const ümmargune = Math.max(0, Math.round(sendid));
  switch (reegel) {
    case "sent":
      return ümmargune;
    case "kumnesent":
      return Math.ceil(ümmargune / 10) * 10;
    case "95":
    case "99": {
      const lõpp = reegel === "95" ? 95 : 99;
      const eurod = Math.floor(ümmargune / 100);
      const kandidaat = eurod * 100 + lõpp;
      return kandidaat >= ümmargune ? kandidaat : kandidaat + 100;
    }
    default:
      return ümmargune;
  }
}

export type Hinnasisend = {
  /** Tarnija jaehind bruto (PLN), feedi väli <cena_zewnetrzna>. */
  jaehindBrutoPln: number;
  /** Tarnija hulgihind bruto (PLN), feedi väli <cena_zewnetrzna_hurt>. */
  hulgihindBrutoPln?: number;
  /** Tarnija käibemaksumäär kümnendarvuna, feedi väli <vat>, nt 0.23. */
  tarnijaKm: number;
};

export type Hinnatulemus = {
  /** Müügihind koos Eesti käibemaksuga, sentides. */
  brutoSendid: number;
  /** Müügihind ilma käibemaksuta, sentides. */
  netoSendid: number;
  /** Käibemaksu osa, sentides. */
  kmSendid: number;
  /** Meie sisseostuhind eurodes sentides (ainult sisekasutuseks). */
  omahindSendid: number;
};

/**
 * Teisendab tarnija PLN-hinna Eesti poe eurohinnaks.
 *
 * bruto PLN -> neto PLN (tarnija KM maha) -> EUR (kurss) ->
 * + juurdehindlus -> + Eesti KM -> ümardamine.
 */
export function arvutaHind(
  sisend: Hinnasisend,
  seaded = hinnastamine,
): Hinnatulemus {
  const tarnijaKm = Number.isFinite(sisend.tarnijaKm) ? sisend.tarnijaKm : 0;
  const netoPln = sisend.jaehindBrutoPln / (1 + tarnijaKm);
  const netoEur = netoPln * seaded.plnEur;
  const müügiNetoEur = netoEur * (1 + seaded.juurdehindlus);
  const brutoSendid = ümardaSendid(
    müügiNetoEur * (1 + seaded.kmMäär) * 100,
    seaded.ümardamine,
  );
  // Neto arvutame lõplikust brutost tagasi, et neto + KM = bruto alati klapiks.
  const netoSendid = Math.round(brutoSendid / (1 + seaded.kmMäär));
  const omahindBrutoPln = sisend.hulgihindBrutoPln ?? 0;
  const omahindSendid = Math.round(
    (omahindBrutoPln / (1 + tarnijaKm)) * seaded.plnEur * 100,
  );
  return {
    brutoSendid,
    netoSendid,
    kmSendid: brutoSendid - netoSendid,
    omahindSendid,
  };
}

/** Tarne hind ostukorvi summa põhjal (tasuta alates seadistatud piirist). */
export function arvutaTarne(
  kaupadeSummaSendid: number,
  tarneHindSendid: number,
  tasutaAlates: number,
): number {
  if (tasutaAlates > 0 && kaupadeSummaSendid >= tasutaAlates) return 0;
  return tarneHindSendid;
}
