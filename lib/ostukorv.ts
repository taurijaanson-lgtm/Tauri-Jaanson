import "server-only";
import { cookies } from "next/headers";
import { db } from "./db";
import { arvutaTarne } from "./hinnad";
import {
  hinnastamine,
  tarneviisid,
  tasutaTarneAlates,
  type Tarneviis,
} from "./konfiguratsioon";

export const KÜPSISE_NIMI = "ostukorv";
const MAKS_KOGUS = 99;

/** Ostukorvi kirje küpsises: toode, variant, kogus. */
export type KorviKirje = { t: string; v: string | null; k: number };

export type KorviRida = {
  võti: string;
  tooteId: string;
  variandiId: string | null;
  slug: string;
  nimi: string;
  variandiNimi: string | null;
  pilt: string | null;
  hindSendid: number;
  kogus: number;
  summaSendid: number;
  laoseis: number;
  /** Laos on vähem kui soovitud kogus. */
  puudulik: boolean;
};

export type Ostukorv = {
  read: KorviRida[];
  kaupadeSummaSendid: number;
  esemeid: number;
  tühi: boolean;
};

export type KorviKokkuvõte = Ostukorv & {
  tarneSendid: number;
  kokkuSendid: number;
  kmSendid: number;
  tarneviis: Tarneviis | null;
  tasutaTarneniSendid: number;
};

export function reaVõti(tooteId: string, variandiId: string | null): string {
  return variandiId ? `${tooteId}::${variandiId}` : tooteId;
}

/** Parsib küpsise sisu; vigane sisu annab tühja korvi. */
export function parsiKüpsis(väärtus: string | undefined): KorviKirje[] {
  if (!väärtus) return [];
  try {
    const andmed = JSON.parse(
      Buffer.from(väärtus, "base64url").toString("utf-8"),
    );
    if (!Array.isArray(andmed)) return [];
    return andmed
      .filter(
        (kirje): kirje is KorviKirje =>
          typeof kirje?.t === "string" &&
          (kirje.v === null || typeof kirje.v === "string") &&
          Number.isFinite(kirje?.k),
      )
      .map((kirje) => ({
        t: kirje.t,
        v: kirje.v ?? null,
        k: Math.min(MAKS_KOGUS, Math.max(1, Math.trunc(kirje.k))),
      }))
      .slice(0, 50);
  } catch {
    return [];
  }
}

export function kodeeriKüpsis(kirjed: KorviKirje[]): string {
  return Buffer.from(JSON.stringify(kirjed), "utf-8").toString("base64url");
}

export async function loeKirjed(): Promise<KorviKirje[]> {
  const küpsised = await cookies();
  return parsiKüpsis(küpsised.get(KÜPSISE_NIMI)?.value);
}

export async function salvestaKirjed(kirjed: KorviKirje[]): Promise<void> {
  const küpsised = await cookies();
  if (kirjed.length === 0) {
    küpsised.delete(KÜPSISE_NIMI);
    return;
  }
  küpsised.set(KÜPSISE_NIMI, kodeeriKüpsis(kirjed), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production",
  });
}

type KorviAndmed = {
  id: string;
  slug: string;
  nimi: string;
  hind_sendid: number;
  laoseis: number;
  pilt: string | null;
  variandi_nimi: string | null;
  variandi_vaartus: string | null;
  variandi_laoseis: number | null;
};

/**
 * Teisendab küpsise kirjed korviridadeks. Hinnad ja laoseisud võetakse alati
 * andmebaasist, nii et küpsisesse kirjutatud väärtusi ei saa võltsida.
 */
export function koostaOstukorv(kirjed: KorviKirje[]): Ostukorv {
  if (kirjed.length === 0) {
    return { read: [], kaupadeSummaSendid: 0, esemeid: 0, tühi: true };
  }

  const päring = db().prepare(`
    SELECT t.id, t.slug, t.nimi, t.hind_sendid, t.laoseis,
           (SELECT p.url FROM pildid p WHERE p.toode_id = t.id ORDER BY p.jarjekord LIMIT 1) AS pilt,
           v.nimi AS variandi_nimi, v.vaartus AS variandi_vaartus,
           v.laoseis AS variandi_laoseis
      FROM tooted t
      LEFT JOIN variandid v ON v.id = ? AND v.toode_id = t.id
     WHERE t.id = ?
  `);

  const read: KorviRida[] = [];
  for (const kirje of kirjed) {
    const rida = päring.get(kirje.v, kirje.t) as KorviAndmed | undefined;
    if (!rida) continue;
    const laoseis = rida.variandi_laoseis ?? rida.laoseis;
    const kogus = Math.min(kirje.k, MAKS_KOGUS);
    read.push({
      võti: reaVõti(rida.id, kirje.v),
      tooteId: rida.id,
      variandiId: kirje.v,
      slug: rida.slug,
      nimi: rida.nimi,
      variandiNimi:
        rida.variandi_vaartus && rida.variandi_nimi
          ? `${rida.variandi_nimi}: ${rida.variandi_vaartus}`
          : rida.variandi_vaartus,
      pilt: rida.pilt,
      hindSendid: rida.hind_sendid,
      kogus,
      summaSendid: rida.hind_sendid * kogus,
      laoseis,
      puudulik: kogus > laoseis,
    });
  }

  const kaupadeSummaSendid = read.reduce((s, r) => s + r.summaSendid, 0);
  return {
    read,
    kaupadeSummaSendid,
    esemeid: read.reduce((s, r) => s + r.kogus, 0),
    tühi: read.length === 0,
  };
}

export async function loeOstukorv(): Promise<Ostukorv> {
  return koostaOstukorv(await loeKirjed());
}

export function leiaTarneviis(kood: string | null | undefined): Tarneviis | null {
  return tarneviisid.find((t) => t.kood === kood) ?? null;
}

/** Lisab korvile tarne ja käibemaksu arvestuse. */
export function kokkuvõte(
  korv: Ostukorv,
  tarneviisiKood?: string | null,
): KorviKokkuvõte {
  const tarneviis = leiaTarneviis(tarneviisiKood);
  const tarneSendid = tarneviis
    ? arvutaTarne(korv.kaupadeSummaSendid, tarneviis.hindSendid, tasutaTarneAlates)
    : 0;
  const kokkuSendid = korv.kaupadeSummaSendid + tarneSendid;
  const netoSendid = Math.round(kokkuSendid / (1 + hinnastamine.kmMäär));
  return {
    ...korv,
    tarneviis,
    tarneSendid,
    kokkuSendid,
    kmSendid: kokkuSendid - netoSendid,
    tasutaTarneniSendid: Math.max(0, tasutaTarneAlates - korv.kaupadeSummaSendid),
  };
}
