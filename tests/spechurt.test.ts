import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { describe, it } from "node:test";
import {
  kehtivEan,
  loeTootedVoost,
  parsiToode,
  tuvastaVeakood,
  tükeldaTooted,
} from "../lib/spechurt";

/** Spetsifikatsiooni näite järgi koostatud toode. */
const NÄIDE = `
<produkt>
  <id>12345</id>
  <sku>12345</sku>
  <kzs>5901234123457</kzs>
  <ean>5901234123457</ean>
  <producent><![CDATA[Lahti Pro]]></producent>
  <nazwa><![CDATA[Spodnie robocze]]></nazwa>
  <dlugi_opis><![CDATA[<p>Opis produktu</p>]]></dlugi_opis>
  <kategoria>Odzież robocza/Spodnie robocze</kategoria>
  <waga>0,75</waga>
  <zdjecia>
    <zdjecie pozycja="2"><![CDATA[http://site.pl/images/image_02.jpg]]></zdjecie>
    <zdjecie pozycja="1"><![CDATA[http://site.pl/images/image_01.jpg]]></zdjecie>
  </zdjecia>
  <warianty>
    <wariant>
      <wariant_id>12345-M</wariant_id>
      <wariant_ean>5901234123457</wariant_ean>
      <wariant_nazwa>Rozmiar</wariant_nazwa>
      <wariant_wartosc>M</wariant_wartosc>
      <wariant_stan_magazynowy>4</wariant_stan_magazynowy>
    </wariant>
    <wariant>
      <wariant_id>12345-L</wariant_id>
      <wariant_nazwa>Rozmiar</wariant_nazwa>
      <wariant_wartosc>L</wariant_wartosc>
      <wariant_stan_magazynowy>6</wariant_stan_magazynowy>
    </wariant>
  </warianty>
  <stan_magazynowy>999</stan_magazynowy>
  <cena_zewnetrzna>129,90</cena_zewnetrzna>
  <cena_zewnetrzna_hurt>89.90</cena_zewnetrzna_hurt>
  <vat>0.23</vat>
</produkt>`;

describe("kehtivEan", () => {
  it("aktsepteerib kehtiva kontrollnumbriga EAN-13 koodi", () => {
    assert.equal(kehtivEan("5901234123457"), "5901234123457");
  });

  it("lükkab tagasi vale kontrollnumbri", () => {
    assert.equal(kehtivEan("5901234123450"), null);
  });

  it("lükkab tagasi vale pikkuse ja tühja väärtuse", () => {
    assert.equal(kehtivEan("123"), null);
    assert.equal(kehtivEan(null), null);
  });
});

describe("parsiToode", () => {
  const toode = parsiToode(NÄIDE);

  it("loeb põhiväljad", () => {
    assert.ok(toode);
    assert.equal(toode.id, "12345");
    assert.equal(toode.nimi, "Spodnie robocze");
    assert.equal(toode.tootja, "Lahti Pro");
    assert.equal(toode.kategooria, "Odzież robocza/Spodnie robocze");
    assert.equal(toode.kirjeldus, "<p>Opis produktu</p>");
  });

  it("loeb komaga kirjutatud arvud", () => {
    assert.equal(toode?.kaal, 0.75);
    assert.equal(toode?.jaehindBrutoPln, 129.9);
    assert.equal(toode?.hulgihindBrutoPln, 89.9);
    assert.equal(toode?.km, 0.23);
  });

  it("järjestab pildid atribuudi pozycja järgi", () => {
    assert.deepEqual(toode?.pildid, [
      "http://site.pl/images/image_01.jpg",
      "http://site.pl/images/image_02.jpg",
    ]);
  });

  it("eelistab variantide summat toote laoseisule", () => {
    assert.equal(toode?.variandid.length, 2);
    assert.equal(toode?.laoseis, 10);
  });

  it("jätab vigase variandi EAN-i välja", () => {
    assert.equal(toode?.variandid[0].ean, "5901234123457");
    assert.equal(toode?.variandid[1].ean, null);
  });

  it("tagastab null, kui kohustuslikud väljad puuduvad", () => {
    assert.equal(parsiToode("<produkt><id>1</id></produkt>"), null);
    assert.equal(parsiToode("<produkt><nazwa>X</nazwa></produkt>"), null);
  });

  it("kasutab toote laoseisu, kui variante pole", () => {
    const ilmaVariantideta = parsiToode(`
      <produkt><id>7</id><nazwa>Test</nazwa>
      <stan_magazynowy>12</stan_magazynowy>
      <cena_zewnetrzna>10</cena_zewnetrzna><vat>0.23</vat></produkt>`);
    assert.equal(ilmaVariantideta?.laoseis, 12);
    assert.equal(ilmaVariantideta?.variandid.length, 0);
  });

  it("ei lase laoseisul minna negatiivseks", () => {
    const negatiivne = parsiToode(`
      <produkt><id>8</id><nazwa>Test</nazwa>
      <stan_magazynowy>-5</stan_magazynowy></produkt>`);
    assert.equal(negatiivne?.laoseis, 0);
  });
});

describe("tükeldaTooted", () => {
  it("leiab kõik tooted juurelemendiga failist", () => {
    const xml = `<?xml version="1.0"?><produkty>${NÄIDE}${NÄIDE}</produkty>`;
    assert.equal([...tükeldaTooted(xml)].length, 2);
  });

  it("töötab ka üksiku produkt-elemendiga (spetsifikatsiooni näide)", () => {
    assert.equal([...tükeldaTooted(NÄIDE)].length, 1);
  });
});

describe("loeTootedVoost", () => {
  it("loeb tooted mitmeks tükiks jagatud voost", async () => {
    const xml = `<produkty>${NÄIDE}${NÄIDE.replace("<id>12345</id>", "<id>99999</id>")}</produkty>`;
    // Jagame voo 64-baidisteks tükkideks, nii et sildid katkevad tükkide vahelt.
    const tükid: string[] = [];
    for (let i = 0; i < xml.length; i += 64) tükid.push(xml.slice(i, i + 64));

    const tooted = [];
    for await (const toode of loeTootedVoost(Readable.from(tükid))) {
      tooted.push(toode);
    }

    assert.equal(tooted.length, 2);
    assert.deepEqual(
      tooted.map((t) => t.id),
      ["12345", "99999"],
    );
  });

  it("loeb tooted baidivoost (UTF-8 mitmebaidised tähed)", async () => {
    const puhver = Buffer.from(`<produkty>${NÄIDE}</produkty>`, "utf-8");
    const tükid: Buffer[] = [];
    for (let i = 0; i < puhver.length; i += 30) tükid.push(puhver.subarray(i, i + 30));

    const tooted = [];
    for await (const toode of loeTootedVoost(Readable.from(tükid))) {
      tooted.push(toode);
    }

    assert.equal(tooted.length, 1);
    assert.equal(tooted[0].kategooria, "Odzież robocza/Spodnie robocze");
  });
});

describe("tuvastaVeakood", () => {
  it("leiab spetsifikatsioonis kirjeldatud veakoodid", () => {
    assert.equal(tuvastaVeakood("[ ERR104 ] Brak uprawnien"), "ERR104");
    assert.equal(tuvastaVeakood("ERR105"), "ERR105");
    assert.equal(tuvastaVeakood("ERR106"), "ERR106");
  });

  it("tagastab null tavalise sisu korral", () => {
    assert.equal(tuvastaVeakood("<produkty></produkty>"), null);
  });
});
