/**
 * Genereerib näidis-HEAVY-faili (data/naidis-heavy.xml) ja selle juurde
 * kuuluva eestikeelse tõlketabeli (data/tolked.csv).
 *
 * Päris feed asub aadressil b2b.spechurt.pl ja nõuab IP-põhist kliendivõtit,
 * seega arenduseks ja testimiseks kasutame sama struktuuriga näidisandmeid.
 *
 * Kasutus: npm run genereeri-naidis
 */
import fs from "node:fs";
import path from "node:path";

type Mall = {
  kategooria: string;
  kategooriaEt: string;
  tootja: string;
  nimi: string;
  nimiEt: string;
  kirjeldus: string;
  kirjeldusEt: string;
  hindPln: number;
  kaal: number;
  variandiNimi?: string;
  variandid?: string[];
};

const MALLID: Mall[] = [
  {
    kategooria: "Odzież robocza/Spodnie robocze",
    kategooriaEt: "Tööriided/Tööpüksid",
    tootja: "Lahti Pro",
    nimi: "Spodnie robocze do pasa PREMIUM",
    nimiEt: "Tööpüksid PREMIUM",
    kirjeldus:
      "<p>Wytrzymałe spodnie robocze z tkaniny 65% poliester / 35% bawełna, gramatura 260 g/m². Wzmocnienia na kolanach, sześć kieszeni.</p>",
    kirjeldusEt:
      "<p>Vastupidavad tööpüksid segamaterjalist (65% polüester, 35% puuvill), pindtihedus 260 g/m². Tugevdatud põlveosa koos taskutega põlvekaitsmetele, kuus taskut.</p><p>Sobib igapäevaseks kasutamiseks ehitusel ja tootmises.</p>",
    hindPln: 129.9,
    kaal: 0.75,
    variandiNimi: "Suurus",
    variandid: ["S", "M", "L", "XL", "XXL"],
  },
  {
    kategooria: "Odzież robocza/Spodnie robocze",
    kategooriaEt: "Tööriided/Tööpüksid",
    tootja: "Portwest",
    nimi: "Spodnie ogrodniczki HD",
    nimiEt: "Traksipüksid HD",
    kirjeldus:
      "<p>Ogrodniczki z regulowanymi szelkami i kieszenią na miarę. Materiał odporny na rozdarcia.</p>",
    kirjeldusEt:
      "<p>Traksipüksid reguleeritavate õlarihmadega ja mõõdulindi taskuga. Rebenemiskindel materjal, tugevdatud õmblused.</p>",
    hindPln: 179.0,
    kaal: 0.9,
    variandiNimi: "Suurus",
    variandid: ["M", "L", "XL", "XXL"],
  },
  {
    kategooria: "Odzież robocza/Kurtki robocze",
    kategooriaEt: "Tööriided/Tööjoped",
    tootja: "Reis",
    nimi: "Kurtka robocza ocieplana WINTER",
    nimiEt: "Soojustatud tööjope WINTER",
    kirjeldus:
      "<p>Kurtka ocieplana z odpinanym kapturem, elementy odblaskowe, wodoodporna powłoka.</p>",
    kirjeldusEt:
      "<p>Soojustatud tööjope eemaldatava kapuutsiga. Helkurribad, veetõrjuv pealiskiht ja tuulekindel vooder. Sobib talviseks välitööks.</p>",
    hindPln: 259.0,
    kaal: 1.4,
    variandiNimi: "Suurus",
    variandid: ["M", "L", "XL", "XXL", "3XL"],
  },
  {
    kategooria: "Odzież robocza/Koszulki",
    kategooriaEt: "Tööriided/T-särgid",
    tootja: "Reis",
    nimi: "Koszulka T-shirt robocza bawełniana",
    nimiEt: "Tööt-särk puuvillane",
    kirjeldus: "<p>Koszulka z bawełny czesanej 180 g/m², wzmocniony dekolt.</p>",
    kirjeldusEt:
      "<p>Kammitud puuvillast t-särk (180 g/m²), tugevdatud kaelusega. Hea õhuvahetus ja pesukindel värv.</p>",
    hindPln: 39.9,
    kaal: 0.2,
    variandiNimi: "Suurus",
    variandid: ["S", "M", "L", "XL", "XXL"],
  },
  {
    kategooria: "Odzież robocza/Odzież ostrzegawcza",
    kategooriaEt: "Tööriided/Ohutusriided",
    tootja: "Portwest",
    nimi: "Kamizelka ostrzegawcza EN ISO 20471",
    nimiEt: "Helkurvest EN ISO 20471",
    kirjeldus:
      "<p>Kamizelka ostrzegawcza klasy 2, zapinana na rzep, dwa pasy odblaskowe.</p>",
    kirjeldusEt:
      "<p>2. klassi helkurvest takjakinnitusega, kaks helkurriba. Vastab standardile EN ISO 20471.</p>",
    hindPln: 24.5,
    kaal: 0.15,
    variandiNimi: "Suurus",
    variandid: ["M", "L", "XL"],
  },
  {
    kategooria: "Obuwie robocze/Buty robocze",
    kategooriaEt: "Tööjalatsid/Turvajalatsid",
    tootja: "Lahti Pro",
    nimi: "Buty robocze S3 SRC z podnoskiem kompozytowym",
    nimiEt: "Turvajalatsid S3 SRC komposiitninaga",
    kirjeldus:
      "<p>Buty robocze w klasie S3, podnosek kompozytowy 200 J, wkładka antyprzebiciowa, podeszwa olejoodporna.</p>",
    kirjeldusEt:
      "<p>S3 SRC klassi turvajalatsid: komposiitnina (löögikindlus 200 J), läbistuskindel vahetald, õli- ja libisemiskindel tald. Metallivaba, sobib metallidetektoriga aladel.</p>",
    hindPln: 249.0,
    kaal: 1.2,
    variandiNimi: "Suurus",
    variandid: ["39", "40", "41", "42", "43", "44", "45", "46"],
  },
  {
    kategooria: "Obuwie robocze/Trzewiki",
    kategooriaEt: "Tööjalatsid/Töösaapad",
    tootja: "Portwest",
    nimi: "Trzewiki robocze zimowe S3 CI",
    nimiEt: "Talvised tööpoolsaapad S3 CI",
    kirjeldus:
      "<p>Ocieplane trzewiki zimowe, izolacja od zimna CI, stalowy podnosek.</p>",
    kirjeldusEt:
      "<p>Soojustatud talvised tööpoolsaapad, külmaisolatsioon CI, terasnina ja läbistuskindel tald. Veekindel nahk.</p>",
    hindPln: 319.0,
    kaal: 1.6,
    variandiNimi: "Suurus",
    variandid: ["40", "41", "42", "43", "44", "45"],
  },
  {
    kategooria: "Obuwie robocze/Wkładki i akcesoria",
    kategooriaEt: "Tööjalatsid/Sisetallad ja tarvikud",
    tootja: "Reis",
    nimi: "Wkładki do butów roboczych antybakteryjne",
    nimiEt: "Antibakteriaalsed sisetallad",
    kirjeldus: "<p>Wkładki z węglem aktywnym, do przycięcia.</p>",
    kirjeldusEt:
      "<p>Aktiivsöega sisetallad, lõigatavad õige suuruse saamiseks. Vähendavad higistamist ja lõhna.</p>",
    hindPln: 19.9,
    kaal: 0.1,
    variandiNimi: "Suurus",
    variandid: ["41", "43", "45"],
  },
  {
    kategooria: "Ochrona rąk/Rękawice robocze",
    kategooriaEt: "Kätekaitse/Töökindad",
    tootja: "Reis",
    nimi: "Rękawice robocze powlekane nitrylem",
    nimiEt: "Nitriilkattega töökindad",
    kirjeldus:
      "<p>Rękawice dziane powlekane nitrylem, bardzo dobra chwytność, EN 388.</p>",
    kirjeldusEt:
      "<p>Kootud töökindad nitriilkattega. Väga hea haardevõime nii kuivas kui õlises keskkonnas. Vastab standardile EN 388.</p>",
    hindPln: 12.9,
    kaal: 0.08,
    variandiNimi: "Suurus",
    variandid: ["8", "9", "10", "11"],
  },
  {
    kategooria: "Ochrona rąk/Rękawice antyprzecięciowe",
    kategooriaEt: "Kätekaitse/Lõikekindlad kindad",
    tootja: "Portwest",
    nimi: "Rękawice antyprzecięciowe poziom C",
    nimiEt: "Lõikekindlad kindad tase C",
    kirjeldus: "<p>Rękawice z włóknem HPPE, odporność na przecięcie poziom C.</p>",
    kirjeldusEt:
      "<p>HPPE-kiust lõikekindlad kindad, lõikekindluse tase C. Õhuke ja painduv, säilitab sõrmetundlikkuse.</p>",
    hindPln: 34.9,
    kaal: 0.09,
    variandiNimi: "Suurus",
    variandid: ["8", "9", "10", "11"],
  },
  {
    kategooria: "Ochrona głowy/Hełmy ochronne",
    kategooriaEt: "Peakaitse/Kaitsekiivrid",
    tootja: "Stalco",
    nimi: "Hełm ochronny budowlany z regulacją",
    nimiEt: "Ehituskiiver reguleeritava rihmaga",
    kirjeldus: "<p>Hełm z tworzywa ABS, regulacja pokrętłem, EN 397.</p>",
    kirjeldusEt:
      "<p>ABS-plastist ehituskiiver, nupuga reguleeritav peavõru, lõuarihma kinnituskohad. Vastab standardile EN 397.</p>",
    hindPln: 59.0,
    kaal: 0.4,
  },
  {
    kategooria: "Ochrona głowy/Okulary ochronne",
    kategooriaEt: "Peakaitse/Kaitseprillid",
    tootja: "Stalco",
    nimi: "Okulary ochronne bezbarwne z powłoką anti-fog",
    nimiEt: "Kaitseprillid udukindla kattega",
    kirjeldus: "<p>Okulary z poliwęglanu, powłoka anti-fog i anti-scratch.</p>",
    kirjeldusEt:
      "<p>Polükarbonaadist kaitseprillid udukindla ja kriimustuskindla kattega. UV-kaitse, reguleeritavad sangad.</p>",
    hindPln: 22.9,
    kaal: 0.06,
  },
  {
    kategooria: "Ochrona głowy/Ochronniki słuchu",
    kategooriaEt: "Peakaitse/Kuulmiskaitsmed",
    tootja: "Stalco",
    nimi: "Ochronniki słuchu nauszne SNR 30 dB",
    nimiEt: "Kõrvaklapid SNR 30 dB",
    kirjeldus: "<p>Nauszniki przeciwhałasowe, tłumienie SNR 30 dB, EN 352-1.</p>",
    kirjeldusEt:
      "<p>Mürakaitseklapid summutusega SNR 30 dB. Pehmed padjad ja reguleeritav peavõru. Vastab standardile EN 352-1.</p>",
    hindPln: 49.9,
    kaal: 0.25,
  },
  {
    kategooria: "Narzędzia ręczne/Klucze",
    kategooriaEt: "Käsitööriistad/Võtmed",
    tootja: "Yato",
    nimi: "Zestaw kluczy płasko-oczkowych 12 szt. 8-22 mm",
    nimiEt: "Lehtsilmusvõtmete komplekt 12 tk 8–22 mm",
    kirjeldus:
      "<p>Zestaw kluczy ze stali chromowo-wanadowej, satynowe wykończenie, etui.</p>",
    kirjeldusEt:
      "<p>Kroom-vanaadiumterasest lehtsilmusvõtmete komplekt, satiinviimistlus. Kaasas hoiukott. Mõõdud 8, 9, 10, 11, 12, 13, 14, 15, 17, 19, 21, 22 mm.</p>",
    hindPln: 149.0,
    kaal: 1.8,
  },
  {
    kategooria: "Narzędzia ręczne/Młotki",
    kategooriaEt: "Käsitööriistad/Haamrid",
    tootja: "Bahco",
    nimi: "Młotek ślusarski 500 g rączka z włókna szklanego",
    nimiEt: "Lukksepavasar 500 g klaaskiudvarrega",
    kirjeldus: "<p>Młotek z kutej stali, antypoślizgowa rękojeść.</p>",
    kirjeldusEt:
      "<p>Sepistatud terasest lukksepavasar, libisemiskindel klaaskiudvars. Kaal 500 g.</p>",
    hindPln: 79.0,
    kaal: 0.7,
  },
  {
    kategooria: "Narzędzia ręczne/Wkrętaki",
    kategooriaEt: "Käsitööriistad/Kruvikeerajad",
    tootja: "Yato",
    nimi: "Zestaw wkrętaków precyzyjnych 6 szt.",
    nimiEt: "Täppiskruvikeerajate komplekt 6 tk",
    kirjeldus: "<p>Wkrętaki precyzyjne z obrotową końcówką, stal S2.</p>",
    kirjeldusEt:
      "<p>S2-terasest täppiskruvikeerajad pöörleva otsaga. Sobivad elektroonikatöödeks.</p>",
    hindPln: 45.0,
    kaal: 0.3,
  },
  {
    kategooria: "Narzędzia ręczne/Miary i poziomice",
    kategooriaEt: "Käsitööriistad/Mõõdulindid ja loodid",
    tootja: "Stalco",
    nimi: "Miara zwijana 5 m z magnesem",
    nimiEt: "Mõõdulint 5 m magnetiga",
    kirjeldus: "<p>Miara z blokadą taśmy, magnetyczny zaczep, obudowa gumowana.</p>",
    kirjeldusEt:
      "<p>Mõõdulint lindilukuga ja magnetiga otsakinnitusel. Kummeeritud korpus, vöökinnitus. Pikkus 5 m, laius 25 mm.</p>",
    hindPln: 29.9,
    kaal: 0.28,
  },
  {
    kategooria: "Elektronarzędzia/Wiertarki",
    kategooriaEt: "Elektritööriistad/Trellid",
    tootja: "Neo Tools",
    nimi: "Wiertarko-wkrętarka akumulatorowa 18V 2x2.0Ah",
    nimiEt: "Akutrell-kruvikeeraja 18V 2x2.0Ah",
    kirjeldus:
      "<p>Wiertarko-wkrętarka 18V, moment 45 Nm, dwie baterie, walizka.</p>",
    kirjeldusEt:
      "<p>18 V akutrell-kruvikeeraja pöördemomendiga 45 Nm. Komplektis kaks 2.0 Ah akut, laadija ja kohver. Kaheastmeline käigukast, LED-valgusti.</p>",
    hindPln: 449.0,
    kaal: 2.4,
  },
  {
    kategooria: "Elektronarzędzia/Szlifierki",
    kategooriaEt: "Elektritööriistad/Lihvijad",
    tootja: "Neo Tools",
    nimi: "Szlifierka kątowa 125 mm 900 W",
    nimiEt: "Nurklihvija 125 mm 900 W",
    kirjeldus: "<p>Szlifierka kątowa 900 W, blokada wrzeciona, osłona tarczy.</p>",
    kirjeldusEt:
      "<p>900 W nurklihvija ketta läbimõõduga 125 mm. Spindlilukk kiireks kettavahetuseks, reguleeritav kettakaitse.</p>",
    hindPln: 269.0,
    kaal: 2.1,
  },
  {
    kategooria: "Elektronarzędzia/Akcesoria",
    kategooriaEt: "Elektritööriistad/Tarvikud",
    tootja: "Yato",
    nimi: "Tarcze do cięcia metalu 125 mm 10 szt.",
    nimiEt: "Metallilõikekettad 125 mm 10 tk",
    kirjeldus: "<p>Tarcze tnące do metalu, grubość 1.0 mm, opakowanie 10 szt.</p>",
    kirjeldusEt:
      "<p>Metallilõikekettad paksusega 1,0 mm, läbimõõt 125 mm. Pakis 10 tükki.</p>",
    hindPln: 39.0,
    kaal: 0.5,
  },
];

/** Lisab EAN-12 numbrile kontrollnumbri (EAN-13). */
function eanKontrollnumbriga(kaksteist: string): string {
  let summa = 0;
  for (let i = 0; i < 12; i += 1) {
    summa += Number(kaksteist[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return `${kaksteist}${(10 - (summa % 10)) % 10}`;
}

/** Lihtne determinismiga pseudojuhuslik generaator, et fail oleks korratav. */
function juhuslik(seeme: number): () => number {
  let olek = seeme;
  return () => {
    olek = (olek * 1103515245 + 12345) % 2147483648;
    return olek / 2147483648;
  };
}

function escapeCdata(tekst: string): string {
  return tekst.replace(/\]\]>/g, "]]&gt;");
}

function genereeri(): { xml: string; csv: string } {
  const rnd = juhuslik(20231101);
  const read: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', "<produkty>"];
  const csv: string[] = [
    "# Eestikeelsed nimetused SPECHURT-i feedi kohta.",
    "# Vorming: tyyp;votme;nimi;kirjeldus",
    "tyyp;votme;nimi;kirjeldus",
  ];
  const kategooriad = new Set<string>();

  MALLID.forEach((mall, indeks) => {
    // Iga mall annab mitu toodet (erinevad värvid/mudelid), et kataloog oleks sisukam.
    const variatsioonid = ["", " CLASSIC", " PRO", " ECO"].slice(
      0,
      2 + Math.floor(rnd() * 3),
    );
    variatsioonid.forEach((lisand, j) => {
      const number = indeks * 10 + j + 1;
      const id = `SP-${String(1000 + number)}`;
      const ean = eanKontrollnumbriga(`59012${String(340000 + number).padStart(7, "0")}`);
      const hind = (mall.hindPln * (1 + j * 0.12)).toFixed(2);
      const hulgihind = (Number(hind) * 0.72).toFixed(2);
      const pildid = [1, 2].map(
        (p) => `https://picsum.photos/seed/${id}-${p}/900/900`,
      );

      read.push("  <produkt>");
      read.push(`    <id>${id}</id>`);
      read.push(`    <sku>${id}</sku>`);
      read.push(`    <kzs>${eanKontrollnumbriga(`59099${String(340000 + number).padStart(7, "0")}`)}</kzs>`);
      read.push(`    <ean>${ean}</ean>`);
      read.push(`    <producent><![CDATA[${mall.tootja}]]></producent>`);
      read.push(`    <nazwa><![CDATA[${escapeCdata(mall.nimi + lisand)}]]></nazwa>`);
      read.push(
        `    <dlugi_opis><![CDATA[${escapeCdata(mall.kirjeldus)}]]></dlugi_opis>`,
      );
      read.push(`    <kategoria>${mall.kategooria}</kategoria>`);
      read.push(`    <waga>${mall.kaal.toFixed(2)}</waga>`);
      read.push("    <zdjecia>");
      pildid.forEach((url, p) =>
        read.push(`      <zdjecie pozycja="${p + 1}"><![CDATA[${url}]]></zdjecie>`),
      );
      read.push("    </zdjecia>");

      let laoseis = 0;
      if (mall.variandid && mall.variandiNimi) {
        read.push("    <warianty>");
        mall.variandid.forEach((väärtus, v) => {
          const variandiLadu = Math.floor(rnd() * 25);
          laoseis += variandiLadu;
          read.push("      <wariant>");
          read.push(`        <wariant_id>${id}-${väärtus}</wariant_id>`);
          read.push(`        <wariant_sku>${id}-${väärtus}</wariant_sku>`);
          read.push(
            `        <wariant_ean>${eanKontrollnumbriga(
              `59012${String(500000 + number * 20 + v).padStart(7, "0")}`,
            )}</wariant_ean>`,
          );
          read.push(
            `        <wariant_nazwa><![CDATA[${mall.variandiNimi}]]></wariant_nazwa>`,
          );
          read.push(`        <wariant_wartosc><![CDATA[${väärtus}]]></wariant_wartosc>`);
          read.push(
            `        <wariant_stan_magazynowy>${variandiLadu}</wariant_stan_magazynowy>`,
          );
          read.push("      </wariant>");
        });
        read.push("    </warianty>");
      } else {
        laoseis = Math.floor(rnd() * 60);
      }

      read.push(`    <stan_magazynowy>${laoseis}</stan_magazynowy>`);
      read.push(`    <cena_zewnetrzna>${hind}</cena_zewnetrzna>`);
      read.push(`    <cena_zewnetrzna_hurt>${hulgihind}</cena_zewnetrzna_hurt>`);
      read.push("    <vat>0.23</vat>");
      read.push("  </produkt>");

      const csvNimi = `${mall.nimiEt}${lisand}`;
      csv.push(
        `toode;${id};${csvNimi};"${mall.kirjeldusEt.replace(/"/g, '""')}"`,
      );
    });

    mall.kategooria.split("/").forEach((osa, tase) => {
      const eesti = mall.kategooriaEt.split("/")[tase];
      if (eesti && !kategooriad.has(osa)) {
        kategooriad.add(osa);
        csv.push(`kategooria;${osa};${eesti};`);
      }
    });
  });

  read.push("</produkty>");
  return { xml: `${read.join("\n")}\n`, csv: `${csv.join("\n")}\n` };
}

const { xml, csv } = genereeri();
const kaust = path.join(process.cwd(), "data");
fs.mkdirSync(kaust, { recursive: true });
fs.writeFileSync(path.join(kaust, "naidis-heavy.xml"), xml, "utf-8");
fs.writeFileSync(path.join(kaust, "tolked.csv"), csv, "utf-8");
console.log(
  `Genereeritud: data/naidis-heavy.xml (${(xml.length / 1024).toFixed(1)} kB), data/tolked.csv`,
);
