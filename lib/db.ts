import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

/**
 * SQLite-ühendus. Andmebaas on üks fail (vaikimisi `data/pood.db`), mille
 * kataloogipuu luuakse vajadusel. Ühendust hoiame globaalselt, et Next.js-i
 * kuuma taaslaadimine ei avaks iga muudatuse järel uut faili.
 */

const globaalne = globalThis as unknown as { __pood_db?: Database.Database };

export function andmebaasiTee(): string {
  return process.env.ANDMEBAAS ?? path.join(process.cwd(), "data", "pood.db");
}

export function db(): Database.Database {
  if (globaalne.__pood_db) return globaalne.__pood_db;
  const tee = andmebaasiTee();
  fs.mkdirSync(path.dirname(tee), { recursive: true });
  const ühendus = new Database(tee);
  ühendus.pragma("journal_mode = WAL");
  ühendus.pragma("foreign_keys = ON");
  loo(ühendus);
  globaalne.__pood_db = ühendus;
  return ühendus;
}

/** Loob skeemi, kui seda veel pole. Turvaline korduvalt käivitada. */
export function loo(ühendus: Database.Database = db()): void {
  ühendus.exec(`
    CREATE TABLE IF NOT EXISTS kategooriad (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tee TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      nimi TEXT NOT NULL,
      nimi_algne TEXT NOT NULL,
      vanem_id INTEGER REFERENCES kategooriad(id),
      tase INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tooted (
      id TEXT PRIMARY KEY,
      sku TEXT,
      ean TEXT,
      tootja TEXT,
      slug TEXT NOT NULL UNIQUE,
      nimi TEXT NOT NULL,
      nimi_algne TEXT NOT NULL,
      kirjeldus TEXT NOT NULL DEFAULT '',
      kirjeldus_algne TEXT NOT NULL DEFAULT '',
      kategooria_id INTEGER REFERENCES kategooriad(id),
      kaal REAL,
      laoseis INTEGER NOT NULL DEFAULT 0,
      hind_sendid INTEGER NOT NULL DEFAULT 0,
      hind_neto_sendid INTEGER NOT NULL DEFAULT 0,
      omahind_sendid INTEGER NOT NULL DEFAULT 0,
      otsing TEXT NOT NULL DEFAULT '',
      uuendatud TEXT NOT NULL,
      nahtav INTEGER NOT NULL DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_tooted_kategooria ON tooted(kategooria_id);
    CREATE INDEX IF NOT EXISTS idx_tooted_nahtav ON tooted(nahtav, laoseis);
    CREATE INDEX IF NOT EXISTS idx_tooted_hind ON tooted(hind_sendid);

    CREATE TABLE IF NOT EXISTS pildid (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      toode_id TEXT NOT NULL REFERENCES tooted(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      jarjekord INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_pildid_toode ON pildid(toode_id, jarjekord);

    CREATE TABLE IF NOT EXISTS variandid (
      id TEXT PRIMARY KEY,
      toode_id TEXT NOT NULL REFERENCES tooted(id) ON DELETE CASCADE,
      ean TEXT,
      nimi TEXT,
      vaartus TEXT,
      laoseis INTEGER NOT NULL DEFAULT 0,
      jarjekord INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_variandid_toode ON variandid(toode_id, jarjekord);

    CREATE TABLE IF NOT EXISTS tellimused (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT NOT NULL UNIQUE,
      loodud TEXT NOT NULL,
      seisund TEXT NOT NULL DEFAULT 'uus',
      nimi TEXT NOT NULL,
      epost TEXT NOT NULL,
      telefon TEXT NOT NULL,
      tarneviis TEXT NOT NULL,
      tarnepunkt TEXT,
      aadress TEXT,
      linn TEXT,
      indeks TEXT,
      markused TEXT,
      kaubad_sendid INTEGER NOT NULL,
      tarne_sendid INTEGER NOT NULL,
      km_sendid INTEGER NOT NULL,
      kokku_sendid INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tellimuse_read (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tellimus_id INTEGER NOT NULL REFERENCES tellimused(id) ON DELETE CASCADE,
      toode_id TEXT NOT NULL,
      variant_id TEXT,
      nimi TEXT NOT NULL,
      variant_nimi TEXT,
      kogus INTEGER NOT NULL,
      hind_sendid INTEGER NOT NULL,
      summa_sendid INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_read_tellimus ON tellimuse_read(tellimus_id);

    CREATE TABLE IF NOT EXISTS impordi_logi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      algus TEXT NOT NULL,
      lopp TEXT,
      allikas TEXT NOT NULL,
      tooteid INTEGER NOT NULL DEFAULT 0,
      vigu INTEGER NOT NULL DEFAULT 0,
      onnestus INTEGER NOT NULL DEFAULT 0,
      teade TEXT
    );
  `);
}

/** Tühjendab kataloogi (tooted, variandid, pildid, kategooriad). Testideks. */
export function tühjendaKataloog(ühendus: Database.Database = db()): void {
  ühendus.exec(`
    DELETE FROM pildid;
    DELETE FROM variandid;
    DELETE FROM tooted;
    DELETE FROM kategooriad;
  `);
}
