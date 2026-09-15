/**
 * Poe keskne seadistus. Kõik väärtused saab üle kirjutada keskkonnamuutujatega
 * (vt `.env.example`), nii et hinnapoliitikat ja kontaktandmeid saab muuta
 * ilma koodi puutumata.
 */

function arv(võti: string, vaikimisi: number): number {
  const väärtus = Number(process.env[võti]);
  return Number.isFinite(väärtus) ? väärtus : vaikimisi;
}

function tekst(võti: string, vaikimisi: string): string {
  const väärtus = process.env[võti];
  return väärtus && väärtus.trim() !== "" ? väärtus.trim() : vaikimisi;
}

export const pood = {
  nimi: tekst("POE_NIMI", "Spetspood"),
  slogan: tekst("POE_SLOGAN", "Töö- ja kaitsevahendid otse hulgilaost"),
  epost: tekst("POE_EPOST", "tellimused@spetspood.ee"),
  telefon: tekst("POE_TELEFON", "+372 5555 1234"),
  aadress: tekst("POE_AADRESS", "Tartu mnt 10, 10145 Tallinn"),
  registrikood: tekst("POE_REGISTRIKOOD", "12345678"),
  kmNumber: tekst("POE_KM_NUMBER", "EE101234567"),
  pank: {
    nimi: tekst("PANGA_NIMI", "LHV Pank"),
    saaja: tekst("PANGA_SAAJA", "Spetspood OÜ"),
    iban: tekst("PANGA_IBAN", "EE12 2200 2210 1234 5678"),
  },
} as const;

/**
 * Hinnastamine. Tarnija (SPECHURT) edastab hinnad Poola zlottides koos Poola
 * käibemaksuga, seega teisendame: bruto PLN -> neto PLN -> neto EUR ->
 * + juurdehindlus -> + Eesti käibemaks.
 */
export const hinnastamine = {
  /** 1 PLN väärtus eurodes. */
  plnEur: arv("PLN_EUR_KURSS", 0.232),
  /** Juurdehindlus netohinnale, nt 0.35 = +35%. */
  juurdehindlus: arv("JUURDEHINDLUS", 0.35),
  /** Eesti käibemaksumäär. */
  kmMäär: arv("KM_MAAR", 0.24),
  /** Ümardamisreegel: "sent" | "kumnesent" | "95" | "99". */
  ümardamine: tekst("HINNA_UMARDAMINE", "95"),
} as const;

export type Tarneviis = {
  kood: string;
  nimi: string;
  kirjeldus: string;
  hindSendid: number;
  /** Kas tarneviis nõuab pakiautomaadi valikut. */
  pakiautomaat: boolean;
};

export const tarneviisid: Tarneviis[] = [
  {
    kood: "omniva",
    nimi: "Omniva pakiautomaat",
    kirjeldus: "Tarneaeg 1–3 tööpäeva",
    hindSendid: 349,
    pakiautomaat: true,
  },
  {
    kood: "smartpost",
    nimi: "Itella SmartPOST pakiautomaat",
    kirjeldus: "Tarneaeg 1–3 tööpäeva",
    hindSendid: 349,
    pakiautomaat: true,
  },
  {
    kood: "dpd",
    nimi: "DPD pakiautomaat",
    kirjeldus: "Tarneaeg 1–3 tööpäeva",
    hindSendid: 329,
    pakiautomaat: true,
  },
  {
    kood: "kuller",
    nimi: "Kullerteenus",
    kirjeldus: "Tarneaeg 1–3 tööpäeva, kohaletoomine aadressile",
    hindSendid: 599,
    pakiautomaat: false,
  },
];

/** Tellimuse summa, millest alates on tarne tasuta (sentides). */
export const tasutaTarneAlates = arv("TASUTA_TARNE_ALATES_SENTI", 7900);

/** Mitu toodet kuvatakse ühel kataloogilehel. */
export const tooteidLehel = arv("TOOTEID_LEHEL", 24);
