/** Täpitähtede teisendustabel (poola ja eesti tähed URL-sõbralikuks). */
const TÄHED: Record<string, string> = {
  ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z",
  ä: "a", ö: "o", õ: "o", ü: "u", š: "s", ž: "z",
  à: "a", á: "a", â: "a", ã: "a", å: "a", è: "e", é: "e", ê: "e", ë: "e",
  ì: "i", í: "i", î: "i", ï: "i", ò: "o", ô: "o", ù: "u", ú: "u", û: "u",
  ý: "y", ÿ: "y", ñ: "n", ç: "c", ß: "ss",
};

/** Teisendab teksti ASCII-kujule: "Kõrgõzstan" -> "korgozstan". */
export function lihtsusta(tekst: string): string {
  return tekst
    .toLowerCase()
    .replace(/[^\x00-\x7F]/g, (t) => TÄHED[t] ?? t)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** URL-i jaoks sobiv lühinimi. */
export function slugi(tekst: string): string {
  const alus = lihtsusta(tekst)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return alus || "toode";
}

/** Otsinguindeksi jaoks normaliseeritud tekst. */
export function otsinguTekst(...osad: (string | null | undefined)[]): string {
  return lihtsusta(osad.filter(Boolean).join(" "))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Eemaldab HTML-margendid ja lühendab teksti etteantud pikkuseni, katkestades
 * võimalusel sõna piirilt.
 */
export function lühikokkuvõte(html: string, maksPikkus = 160): string {
  const puhas = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  if (puhas.length <= maksPikkus) return puhas;
  const lõigatud = puhas.slice(0, maksPikkus);
  const viimaneTühik = lõigatud.lastIndexOf(" ");
  const tulemus = viimaneTühik > 40 ? lõigatud.slice(0, viimaneTühik) : lõigatud;
  return `${tulemus.trim()}…`;
}

/** Eesti mitmuse abiline, nt kogusSõna(1, "toode", "toodet") -> "1 toode". */
export function kogusSõna(arv: number, ainsus: string, mitmus: string): string {
  return `${arv} ${arv === 1 ? ainsus : mitmus}`;
}
