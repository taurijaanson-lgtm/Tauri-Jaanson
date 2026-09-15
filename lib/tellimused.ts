import "server-only";
import { db } from "./db";
import { hinnastamine, tarneviisid } from "./konfiguratsioon";
import type { KorviKokkuvõte } from "./ostukorv";

export type TellimuseAndmed = {
  nimi: string;
  epost: string;
  telefon: string;
  tarneviis: string;
  tarnepunkt?: string | null;
  aadress?: string | null;
  linn?: string | null;
  indeks?: string | null;
  markused?: string | null;
};

export type TellimuseRida = {
  toode_id: string;
  variant_id: string | null;
  nimi: string;
  variant_nimi: string | null;
  kogus: number;
  hind_sendid: number;
  summa_sendid: number;
};

export type Tellimus = TellimuseAndmed & {
  id: number;
  number: string;
  loodud: string;
  seisund: string;
  kaubad_sendid: number;
  tarne_sendid: number;
  km_sendid: number;
  kokku_sendid: number;
  read: TellimuseRida[];
};

export type Valideerimisviga = { väli: string; teade: string };

const EPOSTI_MUSTER = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/** Kontrollib kassa vormi. Tagastab vead väljade kaupa. */
export function valideeriTellimus(
  andmed: Partial<TellimuseAndmed>,
): Valideerimisviga[] {
  const vead: Valideerimisviga[] = [];
  const nõua = (väli: keyof TellimuseAndmed, teade: string, min = 2) => {
    const väärtus = (andmed[väli] ?? "").toString().trim();
    if (väärtus.length < min) vead.push({ väli, teade });
  };

  nõua("nimi", "Palun sisesta ees- ja perekonnanimi.", 3);
  if (!EPOSTI_MUSTER.test((andmed.epost ?? "").trim())) {
    vead.push({ väli: "epost", teade: "Palun sisesta kehtiv e-posti aadress." });
  }
  const telefon = (andmed.telefon ?? "").replace(/[\s-]/g, "");
  if (!/^\+?\d{7,15}$/.test(telefon)) {
    vead.push({ väli: "telefon", teade: "Palun sisesta kehtiv telefoninumber." });
  }

  const tarneviis = tarneviisid.find((t) => t.kood === andmed.tarneviis);
  if (!tarneviis) {
    vead.push({ väli: "tarneviis", teade: "Palun vali tarneviis." });
  } else if (tarneviis.pakiautomaat) {
    if (!(andmed.tarnepunkt ?? "").trim()) {
      vead.push({ väli: "tarnepunkt", teade: "Palun vali pakiautomaat." });
    }
  } else {
    nõua("aadress", "Palun sisesta tarneaadress.", 5);
    nõua("linn", "Palun sisesta linn või vald.");
    if (!/^\d{5}$/.test((andmed.indeks ?? "").replace(/\s/g, ""))) {
      vead.push({ väli: "indeks", teade: "Postiindeks peab olema 5-kohaline." });
    }
  }
  return vead;
}

/** Järjekorranumber kujul TJ-2026-0001. */
function järgmineNumber(): string {
  const aasta = new Date().getFullYear();
  const eesliide = `TJ-${aasta}-`;
  const viimane = db()
    .prepare(
      "SELECT number FROM tellimused WHERE number LIKE ? ORDER BY id DESC LIMIT 1",
    )
    .get(`${eesliide}%`) as { number: string } | undefined;
  const number = viimane ? Number(viimane.number.slice(eesliide.length)) + 1 : 1;
  return `${eesliide}${String(number).padStart(4, "0")}`;
}

/**
 * Salvestab tellimuse ja vähendab laoseisu. Laoseis kontrollitakse uuesti
 * transaktsiooni sees, et kaks samaaegset tellimust ei saaks sama viimast
 * toodet.
 */
export function looTellimus(
  andmed: TellimuseAndmed,
  korv: KorviKokkuvõte,
): { tellimus: Tellimus } | { viga: string } {
  if (korv.tühi) return { viga: "Ostukorv on tühi." };

  const ühendus = db();
  const tehing = ühendus.transaction((): Tellimus | string => {
    // Laoseisu kontroll värskete andmetega.
    for (const rida of korv.read) {
      const laos = rida.variandiId
        ? (
            ühendus
              .prepare("SELECT laoseis FROM variandid WHERE id = ?")
              .get(rida.variandiId) as { laoseis: number } | undefined
          )?.laoseis
        : (
            ühendus
              .prepare("SELECT laoseis FROM tooted WHERE id = ?")
              .get(rida.tooteId) as { laoseis: number } | undefined
          )?.laoseis;
      if (laos === undefined) return `Toodet "${rida.nimi}" ei ole enam müügis.`;
      if (laos < rida.kogus) {
        return `Toodet "${rida.nimi}" on laos ainult ${laos} tk.`;
      }
    }

    const number = järgmineNumber();
    const loodud = new Date().toISOString();
    const tulemus = ühendus
      .prepare(
        `INSERT INTO tellimused (
           number, loodud, seisund, nimi, epost, telefon, tarneviis, tarnepunkt,
           aadress, linn, indeks, markused, kaubad_sendid, tarne_sendid,
           km_sendid, kokku_sendid
         ) VALUES (?, ?, 'uus', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        number,
        loodud,
        andmed.nimi.trim(),
        andmed.epost.trim(),
        andmed.telefon.trim(),
        andmed.tarneviis,
        andmed.tarnepunkt?.trim() || null,
        andmed.aadress?.trim() || null,
        andmed.linn?.trim() || null,
        andmed.indeks?.trim() || null,
        andmed.markused?.trim() || null,
        korv.kaupadeSummaSendid,
        korv.tarneSendid,
        korv.kmSendid,
        korv.kokkuSendid,
      );
    const tellimuseId = Number(tulemus.lastInsertRowid);

    const lisaRida = ühendus.prepare(
      `INSERT INTO tellimuse_read
         (tellimus_id, toode_id, variant_id, nimi, variant_nimi, kogus, hind_sendid, summa_sendid)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const vähendaVarianti = ühendus.prepare(
      "UPDATE variandid SET laoseis = laoseis - ? WHERE id = ?",
    );
    const vähendaToodet = ühendus.prepare(
      "UPDATE tooted SET laoseis = MAX(0, laoseis - ?) WHERE id = ?",
    );

    const read: TellimuseRida[] = [];
    for (const rida of korv.read) {
      lisaRida.run(
        tellimuseId,
        rida.tooteId,
        rida.variandiId,
        rida.nimi,
        rida.variandiNimi,
        rida.kogus,
        rida.hindSendid,
        rida.summaSendid,
      );
      if (rida.variandiId) vähendaVarianti.run(rida.kogus, rida.variandiId);
      vähendaToodet.run(rida.kogus, rida.tooteId);
      read.push({
        toode_id: rida.tooteId,
        variant_id: rida.variandiId,
        nimi: rida.nimi,
        variant_nimi: rida.variandiNimi,
        kogus: rida.kogus,
        hind_sendid: rida.hindSendid,
        summa_sendid: rida.summaSendid,
      });
    }

    return {
      ...andmed,
      id: tellimuseId,
      number,
      loodud,
      seisund: "uus",
      kaubad_sendid: korv.kaupadeSummaSendid,
      tarne_sendid: korv.tarneSendid,
      km_sendid: korv.kmSendid,
      kokku_sendid: korv.kokkuSendid,
      read,
    };
  });

  const tulemus = tehing();
  return typeof tulemus === "string" ? { viga: tulemus } : { tellimus: tulemus };
}

export function leiaTellimus(number: string): Tellimus | null {
  const rida = db()
    .prepare("SELECT * FROM tellimused WHERE number = ?")
    .get(number) as (Omit<Tellimus, "read"> & Record<string, unknown>) | undefined;
  if (!rida) return null;
  const read = db()
    .prepare("SELECT * FROM tellimuse_read WHERE tellimus_id = ? ORDER BY id")
    .all(rida.id) as TellimuseRida[];
  return { ...(rida as unknown as Omit<Tellimus, "read">), read };
}

/** Käibemaksumäär protsendina kuvamiseks, nt "24%". */
export function kmProtsent(): string {
  return `${Math.round(hinnastamine.kmMäär * 100)}%`;
}
