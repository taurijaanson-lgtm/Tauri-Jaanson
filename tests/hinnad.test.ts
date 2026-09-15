import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  arvutaHind,
  arvutaTarne,
  vormindaHind,
  vormindaKuupäev,
  ümardaSendid,
} from "../lib/hinnad";

const SEADED = {
  plnEur: 0.232,
  juurdehindlus: 0.35,
  kmMäär: 0.24,
  ümardamine: "sent",
} as const;

describe("vormindaHind", () => {
  it("kuvab hinna eesti vormingus", () => {
    assert.equal(vormindaHind(1234), "12,34 €");
    assert.equal(vormindaHind(0), "0,00 €");
    assert.equal(vormindaHind(100000), "1000,00 €");
  });
});

describe("vormindaKuupäev", () => {
  it("kuvab kuupäeva päev.kuu.aasta vormingus", () => {
    const tulemus = vormindaKuupäev("2026-03-09T08:05:00.000Z");
    assert.match(tulemus, /^09\.03\.2026 \d{2}:\d{2}$/);
  });

  it("tagastab vigase sisendi muutmata", () => {
    assert.equal(vormindaKuupäev("mitte kuupäev"), "mitte kuupäev");
  });
});

describe("ümardaSendid", () => {
  it("ümardab sendi täpsusega", () => {
    assert.equal(ümardaSendid(1234.6, "sent"), 1235);
  });

  it("ümardab üles kümne sendini", () => {
    assert.equal(ümardaSendid(1231, "kumnesent"), 1240);
    assert.equal(ümardaSendid(1230, "kumnesent"), 1230);
  });

  it("ümardab ...,95 lõpuni", () => {
    assert.equal(ümardaSendid(1234, "95"), 1295);
    assert.equal(ümardaSendid(1295, "95"), 1295);
    assert.equal(ümardaSendid(1296, "95"), 1395);
  });

  it("ümardab ...,99 lõpuni", () => {
    assert.equal(ümardaSendid(500, "99"), 599);
  });

  it("ei tagasta negatiivset hinda", () => {
    assert.equal(ümardaSendid(-50, "sent"), 0);
  });
});

describe("arvutaHind", () => {
  it("teisendab PLN bruto eurodeks koos juurdehindluse ja Eesti käibemaksuga", () => {
    const hind = arvutaHind(
      { jaehindBrutoPln: 123, hulgihindBrutoPln: 90, tarnijaKm: 0.23 },
      SEADED,
    );
    // 123 / 1.23 = 100 PLN neto -> 23.20 EUR -> x1.35 = 31.32 -> x1.24 = 38.8368
    assert.equal(hind.brutoSendid, 3884);
    assert.equal(hind.netoSendid, 3132);
    assert.equal(hind.kmSendid, 3884 - 3132);
  });

  it("neto ja käibemaks annavad alati kokku bruto", () => {
    for (const pln of [9.99, 45.5, 129.9, 1234.56]) {
      const hind = arvutaHind({ jaehindBrutoPln: pln, tarnijaKm: 0.23 }, SEADED);
      assert.equal(hind.netoSendid + hind.kmSendid, hind.brutoSendid);
    }
  });

  it("arvutab omahinna hulgihinnast", () => {
    const hind = arvutaHind(
      { jaehindBrutoPln: 123, hulgihindBrutoPln: 61.5, tarnijaKm: 0.23 },
      SEADED,
    );
    // 61.5 / 1.23 = 50 PLN -> 11.60 EUR
    assert.equal(hind.omahindSendid, 1160);
  });

  it("talub puuduvat käibemaksumäära", () => {
    const hind = arvutaHind(
      { jaehindBrutoPln: 100, tarnijaKm: Number.NaN },
      SEADED,
    );
    assert.ok(hind.brutoSendid > 0);
  });

  it("rakendab ümardamisreeglit lõpphinnale", () => {
    const hind = arvutaHind(
      { jaehindBrutoPln: 129.9, tarnijaKm: 0.23 },
      { ...SEADED, ümardamine: "95" },
    );
    assert.equal(hind.brutoSendid % 100, 95);
  });
});

describe("arvutaTarne", () => {
  it("on tasuta alates piirmäärast", () => {
    assert.equal(arvutaTarne(7900, 349, 7900), 0);
    assert.equal(arvutaTarne(8000, 349, 7900), 0);
  });

  it("küsib tarneraha alla piirmäära", () => {
    assert.equal(arvutaTarne(7899, 349, 7900), 349);
  });

  it("piirmäär 0 tähendab, et tasuta tarnet ei ole", () => {
    assert.equal(arvutaTarne(100000, 349, 0), 349);
  });
});
