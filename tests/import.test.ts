import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import Database from "better-sqlite3";
import { loo } from "../lib/db";
import { impordiTooted } from "../lib/import";
import { loeTootedVoost, type ToorToode } from "../lib/spechurt";
import { parsiTõlked } from "../lib/tolked";

const XML = `<produkty>
  <produkt>
    <id>A-1</id><sku>A-1</sku><ean>5901234123457</ean>
    <producent><![CDATA[Lahti Pro]]></producent>
    <nazwa><![CDATA[Spodnie robocze]]></nazwa>
    <dlugi_opis><![CDATA[<p>Opis</p>]]></dlugi_opis>
    <kategoria>Odzież robocza/Spodnie robocze</kategoria>
    <waga>0.75</waga>
    <zdjecia><zdjecie pozycja="1"><![CDATA[http://a/1.jpg]]></zdjecie></zdjecia>
    <warianty>
      <wariant><wariant_id>A-1-M</wariant_id><wariant_nazwa>Rozmiar</wariant_nazwa>
        <wariant_wartosc>M</wariant_wartosc><wariant_stan_magazynowy>3</wariant_stan_magazynowy></wariant>
    </warianty>
    <stan_magazynowy>3</stan_magazynowy>
    <cena_zewnetrzna>123.00</cena_zewnetrzna>
    <cena_zewnetrzna_hurt>80.00</cena_zewnetrzna_hurt>
    <vat>0.23</vat>
  </produkt>
  <produkt>
    <id>A-2</id><nazwa><![CDATA[Kask ochronny]]></nazwa>
    <kategoria>Ochrona głowy/Hełmy</kategoria>
    <stan_magazynowy>0</stan_magazynowy>
    <cena_zewnetrzna>59.00</cena_zewnetrzna><vat>0.23</vat>
  </produkt>
</produkty>`;

const TÕLKED = parsiTõlked(
  [
    "tyyp;votme;nimi;kirjeldus",
    'toode;A-1;Tööpüksid;"<p>Vastupidavad tööpüksid</p>"',
    "kategooria;Odzież robocza;Tööriided;",
    "kategooria;Spodnie robocze;Tööpüksid;",
  ].join("\n"),
);

function voog(xml: string) {
  return loeTootedVoost((async function* () {
    yield xml;
  })());
}

describe("impordiTooted", () => {
  let kaust: string;
  let ühendus: Database.Database;

  before(() => {
    kaust = fs.mkdtempSync(path.join(os.tmpdir(), "pood-test-"));
    ühendus = new Database(path.join(kaust, "test.db"));
    loo(ühendus);
  });

  after(() => {
    ühendus.close();
    fs.rmSync(kaust, { recursive: true, force: true });
  });

  it("impordib tooted, variandid, pildid ja kategooriad", async () => {
    const tulemus = await impordiTooted(voog(XML), { ühendus, tõlked: TÕLKED });

    assert.equal(tulemus.tooteid, 2);
    assert.equal(tulemus.variante, 1);
    assert.equal(tulemus.vigu, 0);
    assert.equal(
      (ühendus.prepare("SELECT COUNT(*) n FROM pildid").get() as { n: number }).n,
      1,
    );
  });

  it("kasutab eestikeelset nimetust ja hoiab algse alles", () => {
    const toode = ühendus
      .prepare("SELECT nimi, nimi_algne, kirjeldus, slug FROM tooted WHERE id = 'A-1'")
      .get() as { nimi: string; nimi_algne: string; kirjeldus: string; slug: string };

    assert.equal(toode.nimi, "Tööpüksid");
    assert.equal(toode.nimi_algne, "Spodnie robocze");
    assert.equal(toode.kirjeldus, "<p>Vastupidavad tööpüksid</p>");
    assert.equal(toode.slug, "toopuksid");
  });

  it("jätab tõlketa toote algsesse keelde", () => {
    const toode = ühendus
      .prepare("SELECT nimi FROM tooted WHERE id = 'A-2'")
      .get() as { nimi: string };
    assert.equal(toode.nimi, "Kask ochronny");
  });

  it("ehitab kategooriapuu ja tõlgib kategooriad", () => {
    const kategooria = ühendus
      .prepare(
        "SELECT nimi, slug, tase, vanem_id FROM kategooriad WHERE tee = 'Odzież robocza/Spodnie robocze'",
      )
      .get() as { nimi: string; slug: string; tase: number; vanem_id: number };
    const vanem = ühendus
      .prepare("SELECT nimi FROM kategooriad WHERE id = ?")
      .get(kategooria.vanem_id) as { nimi: string };

    assert.equal(kategooria.nimi, "Tööpüksid");
    assert.equal(kategooria.tase, 1);
    assert.equal(vanem.nimi, "Tööriided");
  });

  it("arvutab eurohinna ja salvestab omahinna", () => {
    const toode = ühendus
      .prepare("SELECT hind_sendid, hind_neto_sendid, omahind_sendid FROM tooted WHERE id = 'A-1'")
      .get() as { hind_sendid: number; hind_neto_sendid: number; omahind_sendid: number };

    assert.ok(toode.hind_sendid > 0);
    assert.ok(toode.hind_neto_sendid < toode.hind_sendid);
    assert.ok(toode.omahind_sendid > 0);
    assert.ok(toode.omahind_sendid < toode.hind_sendid);
  });

  it("hoiab slugi muutumatuna, kui nimi muutub (lingid ei katke)", async () => {
    const uueNimega = XML.replace(
      "Spodnie robocze]]></nazwa>",
      "Spodnie robocze PRO]]></nazwa>",
    );
    await impordiTooted(voog(uueNimega), {
      ühendus,
      tõlked: parsiTõlked("tyyp;votme;nimi;kirjeldus\ntoode;A-1;Tööpüksid PRO;"),
    });

    const toode = ühendus
      .prepare("SELECT slug, nimi FROM tooted WHERE id = 'A-1'")
      .get() as { slug: string; nimi: string };
    assert.equal(toode.slug, "toopuksid");
    assert.equal(toode.nimi, "Tööpüksid PRO");
  });

  it("ei tekita korduval impordil topeltkirjeid", async () => {
    await impordiTooted(voog(XML), { ühendus, tõlked: TÕLKED });

    const arv = (võti: string) =>
      (ühendus.prepare(`SELECT COUNT(*) n FROM ${võti}`).get() as { n: number }).n;
    assert.equal(arv("tooted"), 2);
    assert.equal(arv("pildid"), 1);
    assert.equal(arv("variandid"), 1);
    assert.equal(arv("kategooriad"), 4);
  });

  it("peidab tooted, mida uues feedis enam ei ole", async () => {
    const ainultEsimene = XML.replace(
      /<produkt>\s*<id>A-2<\/id>[\s\S]*?<\/produkt>/,
      "",
    );
    const tulemus = await impordiTooted(voog(ainultEsimene), {
      ühendus,
      tõlked: TÕLKED,
    });

    assert.equal(tulemus.peidetud, 1);
    const puuduv = ühendus
      .prepare("SELECT nahtav, laoseis FROM tooted WHERE id = 'A-2'")
      .get() as { nahtav: number; laoseis: number };
    assert.equal(puuduv.nahtav, 0);
    assert.equal(puuduv.laoseis, 0);
  });

  it("peidab soovi korral laoseisuta tooted", async () => {
    await impordiTooted(voog(XML), {
      ühendus,
      tõlked: TÕLKED,
      peidaLaoseisuta: true,
    });
    const laota = ühendus
      .prepare("SELECT nahtav FROM tooted WHERE id = 'A-2'")
      .get() as { nahtav: number };
    assert.equal(laota.nahtav, 0);
  });

  it("loeb vigase toote vigade hulka, kuid ei katkesta importi", async () => {
    const vigane: ToorToode = {
      id: "A-3",
      sku: "A-3",
      ean: null,
      tootja: null,
      // Nimi puudub -> slugi() saab tühja sisendi, aga kategooria viitab olematule teele
      nimi: "Katkine",
      kirjeldus: "",
      kategooria: "",
      kaal: null,
      pildid: [],
      variandid: [],
      laoseis: 1,
      jaehindBrutoPln: 10,
      hulgihindBrutoPln: 5,
      km: 0.23,
    };
    const tulemus = await impordiTooted([vigane], { ühendus, tõlked: TÕLKED });
    assert.equal(tulemus.tooteid, 1);
    assert.equal(tulemus.vigu, 0);

    const salvestatud = ühendus
      .prepare("SELECT kategooria_id FROM tooted WHERE id = 'A-3'")
      .get() as { kategooria_id: number | null };
    assert.equal(salvestatud.kategooria_id, null);
  });
});

describe("parsiTõlked", () => {
  it("loeb semikooloniga eraldatud read ja jutumärkides väljad", () => {
    const tõlked = parsiTõlked(
      'tyyp;votme;nimi;kirjeldus\ntoode;X-1;Nimi;"Kirjeldus; koos semikooloniga"\n',
    );
    assert.equal(tõlked.tooted.get("X-1")?.nimi, "Nimi");
    assert.equal(
      tõlked.tooted.get("X-1")?.kirjeldus,
      "Kirjeldus; koos semikooloniga",
    );
  });

  it("jätab kommentaarid ja tühjad read vahele", () => {
    const tõlked = parsiTõlked("# kommentaar\n\nkategooria;Odzież;Riided;\n");
    assert.equal(tõlked.kategooriad.get("Odzież")?.nimi, "Riided");
    assert.equal(tõlked.tooted.size, 0);
  });
});
