import "server-only";
import { vormindaHind } from "./hinnad";
import { pood, tarneviisid } from "./konfiguratsioon";
import type { Tellimus } from "./tellimused";

/**
 * Tellimuse kinnituskiri. SMTP on valikuline: kui SMTP_HOST on seadistamata,
 * kirjutame kirja serveri logisse, nii et arenduses ei ole meiliserverit vaja.
 */

function tarneRida(tellimus: Tellimus): string {
  const viis = tarneviisid.find((t) => t.kood === tellimus.tarneviis);
  const nimi = viis?.nimi ?? tellimus.tarneviis;
  if (tellimus.tarnepunkt) return `${nimi} – ${tellimus.tarnepunkt}`;
  const aadress = [tellimus.aadress, tellimus.linn, tellimus.indeks]
    .filter(Boolean)
    .join(", ");
  return aadress ? `${nimi} – ${aadress}` : nimi;
}

export function kinnituseTekst(tellimus: Tellimus): string {
  const read = tellimus.read
    .map(
      (r) =>
        `  ${r.kogus} x ${r.nimi}${r.variant_nimi ? ` (${r.variant_nimi})` : ""} – ${vormindaHind(r.summa_sendid)}`,
    )
    .join("\n");

  return [
    `Tere, ${tellimus.nimi}!`,
    "",
    `Täname tellimuse eest ${pood.nimi} e-poes. Tellimuse number on ${tellimus.number}.`,
    "",
    "Tellitud tooted:",
    read,
    "",
    `Kaubad kokku: ${vormindaHind(tellimus.kaubad_sendid)}`,
    `Tarne: ${vormindaHind(tellimus.tarne_sendid)}`,
    `Kokku koos käibemaksuga: ${vormindaHind(tellimus.kokku_sendid)}`,
    "",
    `Tarneviis: ${tarneRida(tellimus)}`,
    "",
    "Maksmine pangaülekandega:",
    `  Saaja: ${pood.pank.saaja}`,
    `  IBAN: ${pood.pank.iban}`,
    `  Pank: ${pood.pank.nimi}`,
    `  Summa: ${vormindaHind(tellimus.kokku_sendid)}`,
    `  Selgitus: ${tellimus.number}`,
    "",
    "Saadame kauba teele kohe pärast makse laekumist.",
    "",
    "Küsimuste korral vasta sellele kirjale või helista.",
    `${pood.nimi} | ${pood.epost} | ${pood.telefon}`,
  ].join("\n");
}

export async function saadaKinnitus(tellimus: Tellimus): Promise<void> {
  const tekst = kinnituseTekst(tellimus);
  const teema = `${pood.nimi} – tellimus ${tellimus.number}`;

  if (!process.env.SMTP_HOST) {
    console.info(
      `[kiri] SMTP seadistamata, kinnituskirja ei saadetud.\nSaaja: ${tellimus.epost}\nTeema: ${teema}\n${tekst}`,
    );
    return;
  }

  try {
    const nodemailer = (await import("nodemailer")).default;
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_TURVALINE === "1",
      auth: process.env.SMTP_KASUTAJA
        ? {
            user: process.env.SMTP_KASUTAJA,
            pass: process.env.SMTP_PAROOL ?? "",
          }
        : undefined,
    });
    await transport.sendMail({
      from: process.env.SMTP_SAATJA ?? `${pood.nimi} <${pood.epost}>`,
      to: tellimus.epost,
      bcc: pood.epost,
      subject: teema,
      text: tekst,
    });
  } catch (viga) {
    // Kirja saatmise viga ei tohi tellimust katkestada – tellimus on juba salvestatud.
    console.error(
      `[kiri] Kinnituskirja saatmine ebaõnnestus (${tellimus.number}):`,
      viga instanceof Error ? viga.message : viga,
    );
  }
}
