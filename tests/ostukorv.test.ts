import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import { db } from "../lib/db";
import { impordiTooted } from "../lib/import";
import {
  kodeeriKüpsis,
  kokkuvõte,
  koostaOstukorv,
  parsiKüpsis,
} from "../lib/ostukorv";
import { loeTootedVoost } from "../lib/spechurt";
import { leiaTellimus, looTellimus, valideeriTellimus } from "../lib/tellimused";

// Andmebaasi tee loetakse alles esimesel db() kutsel, seega piisab sellest,
// kui seadistame testiandmebaasi enne testide käivitumist.
const kaust = fs.mkdtempSync(path.join(os.tmpdir(), "pood-korv-"));
process.env.ANDMEBAAS = path.join(kaust, "test.db");

const XML = `<produkty>
  <produkt>
    <id>K-1</id><nazwa><![CDATA[Tööpüksid]]></nazwa>
    <kategoria>Odzież/Spodnie</kategoria>
    <zdjecia><zdjecie pozycja="1"><![CDATA[http://a/1.jpg]]></zdjecie></zdjecia>
    <warianty>
      <wariant><wariant_id>K-1-M</wariant_id><wariant_nazwa>Rozmiar</wariant_nazwa>
        <wariant_wartosc>M</wariant_wartosc><wariant_stan_magazynowy>2</wariant_stan_magazynowy></wariant>
      <wariant><wariant_id>K-1-L</wariant_id><wariant_nazwa>Rozmiar</wariant_nazwa>
        <wariant_wartosc>L</wariant_wartosc><wariant_stan_magazynowy>5</wariant_stan_magazynowy></wariant>
    </warianty>
    <cena_zewnetrzna>123.00</cena_zewnetrzna><vat>0.23</vat>
  </produkt>
  <produkt>
    <id>K-2</id><nazwa><![CDATA[Kiiver]]></nazwa>
    <kategoria>Ochrona/Hełmy</kategoria>
    <stan_magazynowy>10</stan_magazynowy>
    <cena_zewnetrzna>59.00</cena_zewnetrzna><vat>0.23</vat>
  </produkt>
</produkty>`;

describe("ostukorv ja tellimus", () => {
  before(async () => {
    await impordiTooted(
      loeTootedVoost(
        (async function* () {
          yield XML;
        })(),
      ),
    );
  });

  after(() => {
    db().close();
    fs.rmSync(kaust, { recursive: true, force: true });
  });

  describe("parsiKüpsis", () => {
    it("loeb enda kodeeritud küpsise", () => {
      const kirjed = [{ t: "K-1", v: "K-1-M", k: 2 }];
      assert.deepEqual(parsiKüpsis(kodeeriKüpsis(kirjed)), kirjed);
    });

    it("tagastab tühja korvi vigase sisu korral", () => {
      assert.deepEqual(parsiKüpsis("mitte-base64!!"), []);
      assert.deepEqual(parsiKüpsis(undefined), []);
      assert.deepEqual(
        parsiKüpsis(Buffer.from('{"ei ole massiiv":1}').toString("base64url")),
        [],
      );
    });

    it("piirab koguse ja jätab vigased read välja", () => {
      const räpane = Buffer.from(
        JSON.stringify([
          { t: "K-1", v: null, k: 1000 },
          { t: "K-2", v: null, k: -3 },
          { t: 42, v: null, k: 1 },
        ]),
      ).toString("base64url");
      assert.deepEqual(parsiKüpsis(räpane), [
        { t: "K-1", v: null, k: 99 },
        { t: "K-2", v: null, k: 1 },
      ]);
    });
  });

  describe("koostaOstukorv", () => {
    it("võtab hinna andmebaasist, mitte küpsisest", () => {
      const korv = koostaOstukorv([{ t: "K-2", v: null, k: 2 }]);
      const oodatudHind = (
        db().prepare("SELECT hind_sendid h FROM tooted WHERE id = 'K-2'").get() as {
          h: number;
        }
      ).h;

      assert.equal(korv.read.length, 1);
      assert.equal(korv.read[0].hindSendid, oodatudHind);
      assert.equal(korv.read[0].summaSendid, oodatudHind * 2);
      assert.equal(korv.esemeid, 2);
    });

    it("kuvab variandi nime ja laoseisu", () => {
      const korv = koostaOstukorv([{ t: "K-1", v: "K-1-M", k: 1 }]);
      assert.equal(korv.read[0].variandiNimi, "Rozmiar: M");
      assert.equal(korv.read[0].laoseis, 2);
    });

    it("märgistab laoseisu ületava koguse", () => {
      const korv = koostaOstukorv([{ t: "K-1", v: "K-1-M", k: 5 }]);
      assert.equal(korv.read[0].puudulik, true);
    });

    it("jätab olematu toote vahele", () => {
      const korv = koostaOstukorv([{ t: "PUUDUB", v: null, k: 1 }]);
      assert.equal(korv.tühi, true);
    });
  });

  describe("kokkuvõte", () => {
    it("lisab tarnehinna ja arvutab käibemaksu", () => {
      const korv = kokkuvõte(koostaOstukorv([{ t: "K-2", v: null, k: 1 }]), "omniva");
      assert.equal(korv.tarneSendid, 349);
      assert.equal(korv.kokkuSendid, korv.kaupadeSummaSendid + 349);
      assert.ok(korv.kmSendid > 0 && korv.kmSendid < korv.kokkuSendid);
    });

    it("annab tasuta tarne suure tellimuse korral", () => {
      const korv = kokkuvõte(koostaOstukorv([{ t: "K-2", v: null, k: 40 }]), "omniva");
      assert.equal(korv.tarneSendid, 0);
      assert.equal(korv.tasutaTarneniSendid, 0);
    });
  });

  describe("valideeriTellimus", () => {
    const kehtiv = {
      nimi: "Mari Maasikas",
      epost: "mari@naide.ee",
      telefon: "+372 5555 1234",
      tarneviis: "omniva",
      tarnepunkt: "Tallinn, Kristiine keskuse pakiautomaat",
    };

    it("lubab korrektsed andmed", () => {
      assert.deepEqual(valideeriTellimus(kehtiv), []);
    });

    it("nõuab pakiautomaadi valikut", () => {
      const vead = valideeriTellimus({ ...kehtiv, tarnepunkt: "" });
      assert.deepEqual(
        vead.map((v) => v.väli),
        ["tarnepunkt"],
      );
    });

    it("nõuab kulleri puhul aadressi ja indeksit", () => {
      const vead = valideeriTellimus({ ...kehtiv, tarneviis: "kuller", tarnepunkt: "" });
      const väljad = vead.map((v) => v.väli);
      assert.deepEqual(väljad, ["aadress", "linn", "indeks"]);
    });

    it("kontrollib e-posti ja telefoni vormingut", () => {
      const vead = valideeriTellimus({
        ...kehtiv,
        epost: "vale-aadress",
        telefon: "123",
      });
      const väljad = vead.map((v) => v.väli);
      assert.ok(väljad.includes("epost"));
      assert.ok(väljad.includes("telefon"));
    });

    it("nõuab kehtivat tarneviisi", () => {
      const vead = valideeriTellimus({ ...kehtiv, tarneviis: "lohe" });
      assert.deepEqual(
        vead.map((v) => v.väli),
        ["tarneviis"],
      );
    });
  });

  describe("looTellimus", () => {
    const andmed = {
      nimi: "Mari Maasikas",
      epost: "mari@naide.ee",
      telefon: "+372 5555 1234",
      tarneviis: "omniva",
      tarnepunkt: "Tallinn, Kristiine keskuse pakiautomaat",
    };

    it("salvestab tellimuse, vähendab laoseisu ja annab numbri", () => {
      const korv = kokkuvõte(koostaOstukorv([{ t: "K-1", v: "K-1-L", k: 2 }]), "omniva");
      const tulemus = looTellimus(andmed, korv);

      assert.ok("tellimus" in tulemus);
      const tellimus = tulemus.tellimus;
      assert.match(tellimus.number, /^TJ-\d{4}-0001$/);
      assert.equal(tellimus.read.length, 1);
      assert.equal(tellimus.kokku_sendid, korv.kokkuSendid);

      const variant = db()
        .prepare("SELECT laoseis FROM variandid WHERE id = 'K-1-L'")
        .get() as { laoseis: number };
      assert.equal(variant.laoseis, 3);

      const salvestatud = leiaTellimus(tellimus.number);
      assert.equal(salvestatud?.read.length, 1);
      assert.equal(salvestatud?.epost, "mari@naide.ee");
    });

    it("annab järgmise järjekorranumbri", () => {
      const korv = kokkuvõte(koostaOstukorv([{ t: "K-2", v: null, k: 1 }]), "kuller");
      const tulemus = looTellimus(andmed, korv);
      assert.ok("tellimus" in tulemus);
      assert.match(tulemus.tellimus.number, /^TJ-\d{4}-0002$/);
    });

    it("keeldub, kui laoseisu ei jätku", () => {
      const korv = kokkuvõte(koostaOstukorv([{ t: "K-1", v: "K-1-M", k: 2 }]), "omniva");
      // Tühjendame laoseisu pärast korvi koostamist (nagu teine ostja oleks jõudnud ette).
      db().prepare("UPDATE variandid SET laoseis = 0 WHERE id = 'K-1-M'").run();

      const tulemus = looTellimus(andmed, korv);
      assert.ok("viga" in tulemus);
      assert.match(tulemus.viga, /laos ainult 0/);
    });

    it("keeldub tühjast ostukorvist", () => {
      const tulemus = looTellimus(andmed, kokkuvõte(koostaOstukorv([]), "omniva"));
      assert.ok("viga" in tulemus);
    });
  });
});
