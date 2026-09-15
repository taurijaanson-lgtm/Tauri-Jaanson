import type BetterSqlite3 from "better-sqlite3";
import { db, loo } from "./db";
import { arvutaHind } from "./hinnad";
import { hinnastamine } from "./konfiguratsioon";
import type { ToorToode } from "./spechurt";
import { otsinguTekst, slugi } from "./tekst";
import { tühjadTõlked, type Tõlked } from "./tolked";

export type ImpordiSeaded = {
  ühendus?: BetterSqlite3.Database;
  tõlked?: Tõlked;
  /** Kustuta tooted, mida uues feedis enam pole (vaikimisi peidame need). */
  kustutaPuuduvad?: boolean;
  /** Peida tooted, mille laoseis on 0. */
  peidaLaoseisuta?: boolean;
  logi?: (teade: string) => void;
};

export type ImpordiTulemus = {
  tooteid: number;
  variante: number;
  kategooriaid: number;
  peidetud: number;
  kustutatud: number;
  vigu: number;
};

/** Leiab või loob kategooriapuu feedi kategooriatee järgi ("A/B/C"). */
function kategooriaId(
  ühendus: BetterSqlite3.Database,
  tee: string,
  tõlked: Tõlked,
  vahemälu: Map<string, number>,
): number | null {
  const osad = tee
    .split("/")
    .map((osa) => osa.trim())
    .filter((osa) => osa !== "");
  if (osad.length === 0) return null;

  let vanemId: number | null = null;
  let jooksevTee = "";
  for (let tase = 0; tase < osad.length; tase += 1) {
    const algne = osad[tase];
    jooksevTee = jooksevTee === "" ? algne : `${jooksevTee}/${algne}`;
    const vahemälus = vahemälu.get(jooksevTee);
    if (vahemälus !== undefined) {
      vanemId = vahemälus;
      continue;
    }
    const olemas = ühendus
      .prepare("SELECT id FROM kategooriad WHERE tee = ?")
      .get(jooksevTee) as { id: number } | undefined;
    if (olemas) {
      vahemälu.set(jooksevTee, olemas.id);
      vanemId = olemas.id;
      continue;
    }
    const nimi = tõlked.kategooriad.get(algne)?.nimi ?? algne;
    const slug = vabaSlug(ühendus, "kategooriad", slugi(nimi));
    const tulemus = ühendus
      .prepare(
        `INSERT INTO kategooriad (tee, slug, nimi, nimi_algne, vanem_id, tase)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(jooksevTee, slug, nimi, algne, vanemId, tase);
    const id = Number(tulemus.lastInsertRowid);
    vahemälu.set(jooksevTee, id);
    vanemId = id;
  }
  return vanemId;
}

/** Leiab vaba slugi, lisades vajadusel järjenumbri. */
function vabaSlug(
  ühendus: BetterSqlite3.Database,
  tabel: "kategooriad" | "tooted",
  alus: string,
  omaId?: string,
): string {
  const päring = ühendus.prepare(
    `SELECT id FROM ${tabel} WHERE slug = ? LIMIT 1`,
  );
  let kandidaat = alus;
  let number = 2;
  for (;;) {
    const rida = päring.get(kandidaat) as { id: string | number } | undefined;
    if (!rida) return kandidaat;
    if (omaId !== undefined && String(rida.id) === omaId) return kandidaat;
    kandidaat = `${alus}-${number}`;
    number += 1;
  }
}

/**
 * Impordib tooted andmebaasi. Sisendiks on voog (async generator), et suuri
 * HEAVY-faile ei peaks mällu lugema.
 */
export async function impordiTooted(
  tooted: AsyncIterable<ToorToode> | Iterable<ToorToode>,
  seaded: ImpordiSeaded = {},
): Promise<ImpordiTulemus> {
  const ühendus = seaded.ühendus ?? db();
  loo(ühendus);
  const tõlked = seaded.tõlked ?? tühjadTõlked();
  const logi = seaded.logi ?? (() => {});
  const tulemus: ImpordiTulemus = {
    tooteid: 0,
    variante: 0,
    kategooriaid: 0,
    peidetud: 0,
    kustutatud: 0,
    vigu: 0,
  };

  const kategooriaVahemälu = new Map<string, number>();
  const nähtudEnne = ühendus
    .prepare("SELECT COUNT(*) AS n FROM kategooriad")
    .get() as { n: number };

  ühendus.exec(`
    CREATE TEMP TABLE IF NOT EXISTS nahtud_tooted (id TEXT PRIMARY KEY);
    DELETE FROM nahtud_tooted;
  `);
  const märgiNähtuks = ühendus.prepare(
    "INSERT OR IGNORE INTO nahtud_tooted (id) VALUES (?)",
  );

  const salvestaToode = ühendus.prepare(`
    INSERT INTO tooted (
      id, sku, ean, tootja, slug, nimi, nimi_algne, kirjeldus, kirjeldus_algne,
      kategooria_id, kaal, laoseis, hind_sendid, hind_neto_sendid,
      omahind_sendid, otsing, uuendatud, nahtav
    ) VALUES (
      @id, @sku, @ean, @tootja, @slug, @nimi, @nimi_algne, @kirjeldus, @kirjeldus_algne,
      @kategooria_id, @kaal, @laoseis, @hind_sendid, @hind_neto_sendid,
      @omahind_sendid, @otsing, @uuendatud, @nahtav
    )
    ON CONFLICT(id) DO UPDATE SET
      sku = excluded.sku,
      ean = excluded.ean,
      tootja = excluded.tootja,
      slug = excluded.slug,
      nimi = excluded.nimi,
      nimi_algne = excluded.nimi_algne,
      kirjeldus = excluded.kirjeldus,
      kirjeldus_algne = excluded.kirjeldus_algne,
      kategooria_id = excluded.kategooria_id,
      kaal = excluded.kaal,
      laoseis = excluded.laoseis,
      hind_sendid = excluded.hind_sendid,
      hind_neto_sendid = excluded.hind_neto_sendid,
      omahind_sendid = excluded.omahind_sendid,
      otsing = excluded.otsing,
      uuendatud = excluded.uuendatud,
      nahtav = excluded.nahtav
  `);
  const kustutaPildid = ühendus.prepare("DELETE FROM pildid WHERE toode_id = ?");
  const lisaPilt = ühendus.prepare(
    "INSERT INTO pildid (toode_id, url, jarjekord) VALUES (?, ?, ?)",
  );
  const kustutaVariandid = ühendus.prepare(
    "DELETE FROM variandid WHERE toode_id = ?",
  );
  const lisaVariant = ühendus.prepare(`
    INSERT INTO variandid (id, toode_id, ean, nimi, vaartus, laoseis, jarjekord)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const olemasolevSlug = ühendus.prepare(
    "SELECT slug FROM tooted WHERE id = ?",
  );

  ühendus.exec("BEGIN IMMEDIATE");
  try {
    for await (const toor of tooted) {
      try {
        const tõlge = tõlked.tooted.get(toor.id);
        const nimi = tõlge?.nimi ?? toor.nimi;
        const kirjeldus = tõlge?.kirjeldus ?? toor.kirjeldus;
        const hind = arvutaHind(
          {
            jaehindBrutoPln: toor.jaehindBrutoPln,
            hulgihindBrutoPln: toor.hulgihindBrutoPln,
            tarnijaKm: toor.km,
          },
          hinnastamine,
        );
        const varasem = olemasolevSlug.get(toor.id) as
          | { slug: string }
          | undefined;
        const slug =
          varasem?.slug ?? vabaSlug(ühendus, "tooted", slugi(nimi), toor.id);
        const kategooria = kategooriaId(
          ühendus,
          toor.kategooria,
          tõlked,
          kategooriaVahemälu,
        );
        const nähtav =
          hind.brutoSendid > 0 &&
          (!seaded.peidaLaoseisuta || toor.laoseis > 0);

        salvestaToode.run({
          id: toor.id,
          sku: toor.sku,
          ean: toor.ean,
          tootja: toor.tootja,
          slug,
          nimi,
          nimi_algne: toor.nimi,
          kirjeldus,
          kirjeldus_algne: toor.kirjeldus,
          kategooria_id: kategooria,
          kaal: toor.kaal,
          laoseis: toor.laoseis,
          hind_sendid: hind.brutoSendid,
          hind_neto_sendid: hind.netoSendid,
          omahind_sendid: hind.omahindSendid,
          otsing: otsinguTekst(
            nimi,
            toor.nimi,
            toor.tootja,
            toor.ean,
            toor.id,
            toor.kategooria,
          ),
          uuendatud: new Date().toISOString(),
          nahtav: nähtav ? 1 : 0,
        });

        kustutaPildid.run(toor.id);
        toor.pildid.forEach((url, indeks) => lisaPilt.run(toor.id, url, indeks));

        kustutaVariandid.run(toor.id);
        toor.variandid.forEach((variant, indeks) => {
          lisaVariant.run(
            variant.id,
            toor.id,
            variant.ean,
            variant.nimi,
            variant.väärtus,
            variant.laoseis,
            indeks,
          );
          tulemus.variante += 1;
        });

        märgiNähtuks.run(toor.id);
        tulemus.tooteid += 1;
        if (tulemus.tooteid % 500 === 0) {
          logi(`Imporditud ${tulemus.tooteid} toodet…`);
        }
      } catch (viga) {
        tulemus.vigu += 1;
        logi(
          `Toote ${toor.id} import ebaõnnestus: ${
            viga instanceof Error ? viga.message : String(viga)
          }`,
        );
      }
    }

    if (seaded.kustutaPuuduvad) {
      const kustutatud = ühendus
        .prepare(
          "DELETE FROM tooted WHERE id NOT IN (SELECT id FROM nahtud_tooted)",
        )
        .run();
      tulemus.kustutatud = kustutatud.changes;
    } else {
      const peidetud = ühendus
        .prepare(
          `UPDATE tooted SET nahtav = 0, laoseis = 0
           WHERE id NOT IN (SELECT id FROM nahtud_tooted)`,
        )
        .run();
      tulemus.peidetud = peidetud.changes;
    }

    ühendus.exec("COMMIT");
  } catch (viga) {
    ühendus.exec("ROLLBACK");
    throw viga;
  }

  const nähtudPärast = ühendus
    .prepare("SELECT COUNT(*) AS n FROM kategooriad")
    .get() as { n: number };
  tulemus.kategooriaid = nähtudPärast.n - nähtudEnne.n;
  return tulemus;
}

/** Kirjutab impordi tulemuse logitabelisse. */
export function logiImport(
  allikas: string,
  algus: Date,
  tulemus: ImpordiTulemus | null,
  viga?: string,
  ühendus: BetterSqlite3.Database = db(),
): void {
  ühendus
    .prepare(
      `INSERT INTO impordi_logi (algus, lopp, allikas, tooteid, vigu, onnestus, teade)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      algus.toISOString(),
      new Date().toISOString(),
      allikas,
      tulemus?.tooteid ?? 0,
      tulemus?.vigu ?? 0,
      viga ? 0 : 1,
      viga ?? null,
    );
}
