/**
 * Otspunkti-test: läbib poe ostuvoo päris brauseris.
 *
 * Eeldab, et pood töötab aadressil http://localhost:3000 (`npm run build && npm run start`)
 * ja et Chromium on paigaldatud (`npx playwright install chromium`).
 * Kasutus: npm run test:e2e
 */
import fs from "node:fs";
import { chromium } from "playwright";

const ALUS = "http://localhost:3000";
const PILDID = process.env.PILDIKAUST ?? "./e2e-pildid";

fs.mkdirSync(PILDID, { recursive: true });

const brauser = await chromium.launch(
  process.env.CHROMIUM_TEE ? { executablePath: process.env.CHROMIUM_TEE } : {},
);
const leht = await brauser.newPage({ viewport: { width: 1440, height: 1000 } });
const vead = [];
leht.on("pageerror", (e) => vead.push(`pageerror: ${e.message}`));
leht.on("console", (m) => {
  if (m.type() === "error") vead.push(`console: ${m.text()}`);
});

const samm = async (nimi, fn) => {
  try {
    await fn();
    console.log(`✓ ${nimi}`);
  } catch (e) {
    console.log(`✗ ${nimi}: ${e.message}`);
    process.exitCode = 1;
  }
};

await samm("avaleht laeb", async () => {
  await leht.goto(ALUS, { waitUntil: "networkidle" });
  await leht.waitForSelector("h1");
  await leht.screenshot({ path: `${PILDID}/01-avaleht.png`, fullPage: true });
});

await samm("kategooria navigatsioon", async () => {
  await leht.goto(`${ALUS}/kategooria/toojalatsid`, { waitUntil: "networkidle" });
  await leht.waitForSelector("article");
  await leht.screenshot({ path: `${PILDID}/02-kategooria.png`, fullPage: true });
});

await samm("otsing päisest", async () => {
  await leht.goto(ALUS);
  await leht.fill("#otsing", "kindad");
  await leht.press("#otsing", "Enter");
  await leht.waitForURL("**/tooted?otsing=kindad");
  const arv = await leht.locator("article").count();
  if (arv === 0) throw new Error("otsing ei andnud tulemusi");
});

await samm("tootelehel variandi valik ja korvi lisamine", async () => {
  await leht.goto(`${ALUS}/tooted/toopuksid-premium`, { waitUntil: "networkidle" });
  await leht.screenshot({ path: `${PILDID}/03-toode.png`, fullPage: true });
  // Vali esimene laos olev variant
  await leht.locator("fieldset button:not([disabled])").first().click();
  await leht.click('button:has-text("Lisa ostukorvi")');
  await leht.waitForFunction(
    () => document.querySelector('a[href="/ostukorv"] span[aria-label]')?.textContent !== "0",
    { timeout: 10000 },
  );
});

await samm("ostukorvis koguse muutmine", async () => {
  await leht.goto(`${ALUS}/ostukorv`, { waitUntil: "networkidle" });
  await leht.click('button[aria-label^="Suurenda kogust"]');
  await leht.waitForTimeout(1200);
  const tekst = await leht.locator("body").innerText();
  if (!tekst.includes("Tööpüksid")) throw new Error("toode kadus korvist");
  await leht.screenshot({ path: `${PILDID}/04-ostukorv.png`, fullPage: true });
});

await samm("kassa nõuab müügitingimustega nõustumist", async () => {
  await leht.goto(`${ALUS}/kassa`, { waitUntil: "networkidle" });
  await leht.fill("#nimi", "Mari Maasikas");
  await leht.fill("#epost", "mari@naide.ee");
  await leht.fill("#telefon", "+372 5555 1234");
  await leht.selectOption("#tarnepunkt", { index: 1 });
  await leht.click('button:has-text("Esita tellimus")');
  await leht.waitForSelector("text=Palun nõustu müügitingimustega", { timeout: 10000 });
});

await samm("server valideerib nime ja telefoni", async () => {
  await leht.fill("#nimi", "X");
  await leht.fill("#telefon", "12");
  await leht.check('input[name="tingimused"]');
  await leht.click('button:has-text("Esita tellimus")');
  await leht.waitForSelector("text=Palun sisesta kehtiv telefoninumber", { timeout: 10000 });
  await leht.waitForSelector("text=Palun sisesta ees- ja perekonnanimi", { timeout: 10000 });
  await leht.screenshot({ path: `${PILDID}/05-kassa-vead.png`, fullPage: true });
});

await samm("kulleri valikul küsitakse aadressi", async () => {
  await leht.check('input[value="kuller"]');
  await leht.waitForSelector("#aadress", { timeout: 5000 });
  await leht.check('input[value="omniva"]');
  await leht.waitForSelector("#tarnepunkt", { timeout: 5000 });
});

await samm("tellimuse esitamine õnnestub", async () => {
  await leht.fill("#nimi", "Mari Maasikas");
  await leht.fill("#epost", "mari@naide.ee");
  await leht.fill("#telefon", "+372 5555 1234");
  await leht.selectOption("#tarnepunkt", { index: 1 });
  await leht.fill("#markused", "Palun helistage enne kohaletoimetamist.");
  await leht.check('input[name="tingimused"]');
  await leht.click('button:has-text("Esita tellimus")');
  await leht.waitForURL("**/tellimus/**", { timeout: 15000 });
  await leht.waitForSelector("text=Tellimus on vastu võetud");
  await leht.screenshot({ path: `${PILDID}/06-tellimus.png`, fullPage: true });
});

await samm("ostukorv on pärast tellimust tühi", async () => {
  await leht.goto(`${ALUS}/ostukorv`, { waitUntil: "networkidle" });
  await leht.waitForSelector("text=Ostukorv on tühi");
});

await samm("mobiilivaade", async () => {
  const mobiil = await brauser.newPage({ viewport: { width: 390, height: 844 } });
  await mobiil.goto(ALUS, { waitUntil: "networkidle" });
  await mobiil.screenshot({ path: `${PILDID}/07-mobiil.png`, fullPage: true });
  const laius = await mobiil.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  if (laius) throw new Error("mobiilis tekib horisontaalne kerimine");
  await mobiil.close();
});

await brauser.close();

if (vead.length) {
  console.log("\nBrauseri vead:");
  for (const v of [...new Set(vead)]) console.log(`  ${v}`);
}
