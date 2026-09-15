import "server-only";
import { db } from "./db";
import { tooteidLehel } from "./konfiguratsioon";
import { lihtsusta } from "./tekst";

export type Kategooria = {
  id: number;
  tee: string;
  slug: string;
  nimi: string;
  vanem_id: number | null;
  tase: number;
  tooteid: number;
};

export type KategooriaPuuga = Kategooria & { lapsed: KategooriaPuuga[] };

export type ToodeKaart = {
  id: string;
  slug: string;
  nimi: string;
  tootja: string | null;
  hind_sendid: number;
  laoseis: number;
  pilt: string | null;
  kategooria_nimi: string | null;
  kategooria_slug: string | null;
};

export type Variant = {
  id: string;
  ean: string | null;
  nimi: string | null;
  vaartus: string | null;
  laoseis: number;
};

export type ToodeTäis = ToodeKaart & {
  sku: string | null;
  ean: string | null;
  kirjeldus: string;
  nimi_algne: string;
  kaal: number | null;
  hind_neto_sendid: number;
  uuendatud: string;
  pildid: string[];
  variandid: Variant[];
};

const KAARDI_VÄLJAD = `
  t.id, t.slug, t.nimi, t.tootja, t.hind_sendid, t.laoseis,
  (SELECT p.url FROM pildid p WHERE p.toode_id = t.id ORDER BY p.jarjekord LIMIT 1) AS pilt,
  k.nimi AS kategooria_nimi, k.slug AS kategooria_slug
`;

export function loeKategooriad(): Kategooria[] {
  return db()
    .prepare(
      `SELECT k.id, k.tee, k.slug, k.nimi, k.vanem_id, k.tase,
              (SELECT COUNT(*) FROM tooted t
                WHERE t.nahtav = 1
                  AND (t.kategooria_id = k.id
                       OR t.kategooria_id IN (SELECT id FROM kategooriad WHERE vanem_id = k.id))
              ) AS tooteid
         FROM kategooriad k
        ORDER BY k.tase, k.nimi COLLATE NOCASE`,
    )
    .all() as Kategooria[];
}

/** Kategooriad puukujul (kaks taset, nagu feedis). */
export function loeKategooriaPuu(): KategooriaPuuga[] {
  const kõik = loeKategooriad();
  const kaart = new Map<number, KategooriaPuuga>();
  kõik.forEach((k) => kaart.set(k.id, { ...k, lapsed: [] }));
  const juured: KategooriaPuuga[] = [];
  kaart.forEach((k) => {
    if (k.vanem_id && kaart.has(k.vanem_id)) kaart.get(k.vanem_id)!.lapsed.push(k);
    else juured.push(k);
  });
  return juured.filter((k) => k.tooteid > 0);
}

export function leiaKategooria(slug: string): Kategooria | null {
  const rida = db()
    .prepare(
      `SELECT k.id, k.tee, k.slug, k.nimi, k.vanem_id, k.tase, 0 AS tooteid
         FROM kategooriad k WHERE k.slug = ?`,
    )
    .get(slug) as Kategooria | undefined;
  return rida ?? null;
}

export type Järjestus = "uued" | "odavamad" | "kallimad" | "nimi";

const JÄRJESTUSED: Record<Järjestus, string> = {
  uued: "t.uuendatud DESC, t.nimi COLLATE NOCASE",
  odavamad: "t.hind_sendid ASC",
  kallimad: "t.hind_sendid DESC",
  nimi: "t.nimi COLLATE NOCASE ASC",
};

export type Filtrid = {
  kategooriaId?: number | null;
  otsing?: string | null;
  tootja?: string | null;
  ainultLaos?: boolean;
  järjestus?: Järjestus;
  leht?: number;
  lehePikkus?: number;
};

export type Loend = {
  tooted: ToodeKaart[];
  kokku: number;
  leht: number;
  lehti: number;
};

export function otsiTooted(filtrid: Filtrid = {}): Loend {
  const tingimused: string[] = ["t.nahtav = 1"];
  const parameetrid: unknown[] = [];

  if (filtrid.kategooriaId) {
    tingimused.push(
      `(t.kategooria_id = ? OR t.kategooria_id IN (SELECT id FROM kategooriad WHERE vanem_id = ?))`,
    );
    parameetrid.push(filtrid.kategooriaId, filtrid.kategooriaId);
  }
  if (filtrid.otsing && filtrid.otsing.trim() !== "") {
    // Iga sõna peab leiduma otsinguindeksis (JA-loogika).
    for (const sõna of lihtsusta(filtrid.otsing).split(/\s+/).filter(Boolean).slice(0, 6)) {
      tingimused.push("t.otsing LIKE ?");
      parameetrid.push(`%${sõna}%`);
    }
  }
  if (filtrid.tootja) {
    tingimused.push("t.tootja = ?");
    parameetrid.push(filtrid.tootja);
  }
  if (filtrid.ainultLaos) tingimused.push("t.laoseis > 0");

  const kus = tingimused.join(" AND ");
  const kokku = (
    db()
      .prepare(`SELECT COUNT(*) AS n FROM tooted t WHERE ${kus}`)
      .get(...parameetrid) as { n: number }
  ).n;

  const lehePikkus = filtrid.lehePikkus ?? tooteidLehel;
  const lehti = Math.max(1, Math.ceil(kokku / lehePikkus));
  const leht = Math.min(Math.max(1, filtrid.leht ?? 1), lehti);
  const järjestus = JÄRJESTUSED[filtrid.järjestus ?? "uued"];

  const tooted = db()
    .prepare(
      `SELECT ${KAARDI_VÄLJAD}
         FROM tooted t
         LEFT JOIN kategooriad k ON k.id = t.kategooria_id
        WHERE ${kus}
        ORDER BY (t.laoseis > 0) DESC, ${järjestus}
        LIMIT ? OFFSET ?`,
    )
    .all(...parameetrid, lehePikkus, (leht - 1) * lehePikkus) as ToodeKaart[];

  return { tooted, kokku, leht, lehti };
}

export function leiaToode(slug: string): ToodeTäis | null {
  const rida = db()
    .prepare(
      `SELECT ${KAARDI_VÄLJAD}, t.sku, t.ean, t.kirjeldus, t.nimi_algne, t.kaal,
              t.hind_neto_sendid, t.uuendatud
         FROM tooted t
         LEFT JOIN kategooriad k ON k.id = t.kategooria_id
        WHERE t.slug = ? AND t.nahtav = 1`,
    )
    .get(slug) as (ToodeTäis & { pilt: string | null }) | undefined;
  if (!rida) return null;

  const pildid = (
    db()
      .prepare("SELECT url FROM pildid WHERE toode_id = ? ORDER BY jarjekord")
      .all(rida.id) as { url: string }[]
  ).map((p) => p.url);

  const variandid = db()
    .prepare(
      `SELECT id, ean, nimi, vaartus, laoseis FROM variandid
        WHERE toode_id = ? ORDER BY jarjekord`,
    )
    .all(rida.id) as Variant[];

  return { ...rida, pildid, variandid };
}

/** Toode ostukorvi jaoks (ka peidetud toode, et vana korv ei laguneks). */
export function leiaToodeIdJärgi(id: string): ToodeTäis | null {
  const rida = db()
    .prepare("SELECT slug FROM tooted WHERE id = ?")
    .get(id) as { slug: string } | undefined;
  return rida ? leiaToode(rida.slug) : null;
}

export function sarnasedTooted(toode: ToodeTäis, mitu = 4): ToodeKaart[] {
  return db()
    .prepare(
      `SELECT ${KAARDI_VÄLJAD}
         FROM tooted t
         LEFT JOIN kategooriad k ON k.id = t.kategooria_id
        WHERE t.nahtav = 1 AND t.id <> ?
          AND k.slug IS ?
        ORDER BY (t.laoseis > 0) DESC, ABS(t.hind_sendid - ?)
        LIMIT ?`,
    )
    .all(toode.id, toode.kategooria_slug, toode.hind_sendid, mitu) as ToodeKaart[];
}

export function esiletõstetud(mitu = 8): ToodeKaart[] {
  return db()
    .prepare(
      `SELECT ${KAARDI_VÄLJAD}
         FROM tooted t
         LEFT JOIN kategooriad k ON k.id = t.kategooria_id
        WHERE t.nahtav = 1 AND t.laoseis > 0
        ORDER BY t.uuendatud DESC, t.hind_sendid DESC
        LIMIT ?`,
    )
    .all(mitu) as ToodeKaart[];
}

export function loeTootjad(): string[] {
  return (
    db()
      .prepare(
        `SELECT DISTINCT tootja FROM tooted
          WHERE nahtav = 1 AND tootja IS NOT NULL AND tootja <> ''
          ORDER BY tootja COLLATE NOCASE`,
      )
      .all() as { tootja: string }[]
  ).map((r) => r.tootja);
}

export function kataloogiStatistika(): {
  tooteid: number;
  kategooriaid: number;
  uuendatud: string | null;
} {
  const t = db()
    .prepare("SELECT COUNT(*) AS n, MAX(uuendatud) AS uuendatud FROM tooted WHERE nahtav = 1")
    .get() as { n: number; uuendatud: string | null };
  const k = db().prepare("SELECT COUNT(*) AS n FROM kategooriad").get() as {
    n: number;
  };
  return { tooteid: t.n, kategooriaid: k.n, uuendatud: t.uuendatud };
}
