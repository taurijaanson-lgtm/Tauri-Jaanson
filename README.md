# Spetspood – eestikeelne e-pood SPECHURT-i XML-feedi põhjal

Eestikeelne e-pood, mille tootekataloog imporditakse SPECHURT-i (b2b.spechurt.pl)
HEAVY XML-failist vastavalt integratsioonispetsifikatsioonile (kehtiv alates
01.11.2023). Pood teisendab poolakeelse ja PLN-hindades feedi eestikeelseks
eurohindadega kataloogiks, millel on ostukorv, kassa ja tellimuste haldus.

## Tehnoloogia

| Osa | Valik |
| --- | --- |
| Raamistik | Next.js 16 (App Router, React 19, Turbopack) |
| Keel | TypeScript |
| Kujundus | Tailwind CSS 4 |
| Andmebaas | SQLite (`better-sqlite3`), üks fail `data/pood.db` |
| XML | `fast-xml-parser` + voogtöötlus (suured failid ei lähe tervikuna mällu) |
| E-post | `nodemailer` (valikuline; seadistamata SMTP korral kirjutatakse kiri logisse) |

## Kiire algus

```bash
npm install

# 1. Genereeri näidisfeed (päris feed nõuab IP-whitelisti) ja impordi see
npm run seemne

# 2. Käivita arendusserver
npm run dev           # http://localhost:3000
```

Tootmiseks:

```bash
npm run build && npm run start
```

## Andmete import

Tarnija genereerib HEAVY-faili kord ööpäevas kella **03:00–04:00** vahel, seega
mõistlik on import ajastada hommikusse.

```bash
# Kohalikust failist
npm run impordi -- --fail data/naidis-heavy.xml

# Otse tarnija serverist (URL ja võti .env-failist)
npm run impordi

# Lisavõtmed
npm run impordi -- --peida-laota          # peidab tooted, mille laoseis on 0
npm run impordi -- --kustuta-puuduvad     # kustutab feedist kadunud tooted (vaikimisi peidetakse)
```

Cron-näide (import igal hommikul 05:30):

```cron
30 5 * * * cd /var/www/spetspood && /usr/bin/npm run impordi >> /var/log/spetspood-import.log 2>&1
```

Import on **idempotentne**: korduv käivitamine uuendab olemasolevaid tooteid,
säilitab toote URL-i (slug) ka siis, kui nimi muutub, ja märgib feedist kadunud
tooted peidetuks. Iga import logitakse tabelisse `impordi_logi`.

### Ligipääs päris feedile

Spetsifikatsiooni järgi tuleb ligipääsuks:

1. Leppida tingimused kokku SPECHURT-i B2B osakonnaga (b4b@spechurt.pl).
2. Esitada 1–5 **staatilist IP-aadressi**, millelt faili alla laaditakse.
3. Saada link kujul
   `https://b2b.spechurt.pl/xml_plik_eksportu_export.php?key=KLIENDI_VOTI`
   ja panna see `.env`-faili muutujasse `SPECHURT_XML_URL`.

Importer tunneb ära spetsifikatsioonis kirjeldatud veakoodid ja selgitab need
eesti keeles lahti:

| Kood | Tähendus |
| --- | --- |
| ERR104 | Kontol puuduvad ekspordiõigused või konto on peatatud |
| ERR105 | Vigane API võti või registreerimata IP-aadress |
| ERR106 | Faili pole veel genereeritud (oota 24 h pärast aktiveerimist) |

## Feedi väljade vastendus

| SPECHURT | Pood | Märkus |
| --- | --- | --- |
| `<id>`, `<sku>` | `tooted.id`, `tooted.sku` | tootekood |
| `<ean>` | `tooted.ean` | valideeritakse EAN-13 kontrollnumbriga; vigane jäetakse välja |
| `<kzs>` | – | spetsifikatsioonis DEPRECATED, ei impordita |
| `<producent>` | `tooted.tootja` | kasutatakse ka filtrina |
| `<nazwa>` | `tooted.nimi_algne` | eestikeelne nimi tuleb `data/tolked.csv`-st |
| `<dlugi_opis>` | `tooted.kirjeldus` | HTML säilib, kuvatakse `.kirjeldus` stiiliga |
| `<kategoria>` | `kategooriad` | kaldkriipsuga tee muudetakse kategooriapuuks |
| `<waga>` | `tooted.kaal` | kg |
| `<zdjecie pozycja>` | `pildid` | järjestatakse atribuudi `pozycja` järgi |
| `<wariant_*>` | `variandid` | nt suurus või värv koos oma laoseisuga |
| `<stan_magazynowy>` | `tooted.laoseis` | variantide olemasolul kasutatakse nende summat |
| `<cena_zewnetrzna>` | `tooted.hind_sendid` | jaehind bruto PLN → müügihind EUR |
| `<cena_zewnetrzna_hurt>` | `tooted.omahind_sendid` | sisekasutuseks (marginaali jälgimine) |
| `<vat>` | – | tarnija KM arvestatakse hinnast maha, asemele Eesti KM |

## Hinnastamine

Feedi hind on **bruto PLN koos Poola käibemaksuga**. Teisendus:

```
bruto PLN → /(1 + tarnija KM) → neto PLN
          → × PLN_EUR_KURSS    → neto EUR
          → × (1 + JUURDEHINDLUS)
          → × (1 + KM_MAAR)    → bruto EUR
          → ümardamine (HINNA_UMARDAMINE)
```

Näide vaikeseadetega (kurss 0,232, juurdehindlus 35%, KM 24%, ümardus „95”):
**129,90 PLN → 41,95 €**.

Kõik tegurid on `.env`-failis (vt `.env.example`), koodimuudatusi ei ole vaja.
Kursi uuendamine tähendab ühe muutuja muutmist ja importi uuesti käivitamist.

## Eestikeelsed nimetused

Feed on poolakeelne. Failis `data/tolked.csv` saab anda eestikeelsed nimed nii
toodetele kui kategooriatele:

```csv
tyyp;votme;nimi;kirjeldus
toode;SP-1001;Tööpüksid PREMIUM;"<p>Vastupidavad tööpüksid…</p>"
kategooria;Odzież robocza;Tööriided;
```

Tõlketa toode kuvatakse algses keeles, nii et kataloog ei jää kunagi tühjaks.
Algne nimi säilib andmebaasis (`nimi_algne`) ja on otsitav, seega tarnija
tootenimega leiab toote ka siis, kui see on tõlgitud.

## Poe struktuur

| Tee | Sisu |
| --- | --- |
| `/` | avaleht: kategooriad, esiletõstetud tooted |
| `/tooted` | kogu kataloog: otsing, filtrid, sortimine, lehekülgedeks jaotus |
| `/tooted/[slug]` | tootekaart: pildigalerii, variandid, laoseis, schema.org andmed |
| `/kategooria/[slug]` | kategooria koos alamkategooriatega |
| `/ostukorv` | ostukorv (küpsisepõhine, hinnad alati serverist) |
| `/kassa` | tellimuse vormistamine ja valideerimine |
| `/tellimus/[number]` | tellimuse kinnitus ja maksejuhised |
| `/info/tarne`, `/info/tingimused`, `/info/kontakt` | infolehed |
| `/sitemap.xml`, `/robots.txt` | otsimootoritele |

## Testid

```bash
npm test          # ühikutestid (hinnad, XML-parser, import, ostukorv, tellimused)
npm run typecheck # TypeScript
npx eslint .      # lint

# Otspunkti-test päris brauseris (eeldab töötavat serverit ja Chromiumi)
npx playwright install chromium
npm run build && npm run start &
npm run test:e2e
```

`npm test` kasutab Node'i sisseehitatud testijooksutajat. Lipp
`--conditions=react-server` on vajalik, sest osa mooduleid on `server-only`
kaitsega – nii ei saa andmebaasi- ega ostukorvikood kogemata kliendipaketti
sattuda.

## Turvalisus ja andmed

- Ostukorv hoitakse `httpOnly` küpsises, kuid **hinnad ja laoseisud loetakse
  alati andmebaasist** – küpsisesse kirjutatud summat ei usaldata.
- Tellimuse salvestamine käib transaktsioonis koos laoseisu uue kontrolliga, nii
  et kaks samaaegset ostjat ei saa sama viimast toodet.
- Kliendivõti eemaldatakse impordi logikirjetest (`key=***`).
- Hulgihind (omahind) salvestatakse andmebaasi, kuid seda ei kuvata kunagi
  poe avalikus osas.

## Mis on veel tegemata

- **Makselahendus.** Praegu tasutakse pangaülekandega arve alusel. Montonio või
  Stripe lisandub `app/toimingud.ts`-i `esitaTellimus` funktsiooni järele.
- **Pakiautomaatide nimekiri** on `components/KassaVorm.tsx`-is näidisloendina;
  päris poes tuleks see laadida tarnepartneri API-st.
- **Tellimuste haldusvaade** puudub – tellimusi saab praegu vaadata otse
  andmebaasist (`tellimused`, `tellimuse_read`).
