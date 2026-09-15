"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { leiaToodeIdJärgi } from "@/lib/kataloog";
import { saadaKinnitus } from "@/lib/kiri";
import {
  kokkuvõte,
  loeKirjed,
  loeOstukorv,
  salvestaKirjed,
  type KorviKirje,
} from "@/lib/ostukorv";
import {
  looTellimus,
  valideeriTellimus,
  type TellimuseAndmed,
} from "@/lib/tellimused";

const MAKS_KOGUS = 99;

function sama(kirje: KorviKirje, tooteId: string, variandiId: string | null) {
  return kirje.t === tooteId && (kirje.v ?? null) === variandiId;
}

/** Lisab toote ostukorvi. Kogus piiratakse laoseisuga. */
export async function lisaKorvi(formData: FormData): Promise<void> {
  const tooteId = String(formData.get("toode") ?? "");
  const variandiId = (formData.get("variant") as string) || null;
  const soovitudKogus = Number(formData.get("kogus") ?? 1);
  const kogus = Number.isFinite(soovitudKogus)
    ? Math.min(MAKS_KOGUS, Math.max(1, Math.trunc(soovitudKogus)))
    : 1;

  const toode = leiaToodeIdJärgi(tooteId);
  if (!toode) return;

  // Variandiga toote puhul nõuame kehtivat varianti.
  if (toode.variandid.length > 0) {
    const variant = toode.variandid.find((v) => v.id === variandiId);
    if (!variant) return;
  }

  const laoseis = variandiId
    ? (toode.variandid.find((v) => v.id === variandiId)?.laoseis ?? 0)
    : toode.laoseis;
  if (laoseis <= 0) return;

  const kirjed = await loeKirjed();
  const olemas = kirjed.find((k) => sama(k, tooteId, variandiId));
  if (olemas) {
    olemas.k = Math.min(laoseis, MAKS_KOGUS, olemas.k + kogus);
  } else {
    kirjed.push({ t: tooteId, v: variandiId, k: Math.min(kogus, laoseis) });
  }
  await salvestaKirjed(kirjed);
  revalidatePath("/", "layout");

  if (formData.get("kassasse") === "1") redirect("/ostukorv");
}

/** Muudab rea kogust; kogus 0 eemaldab rea. */
export async function muudaKogust(formData: FormData): Promise<void> {
  const tooteId = String(formData.get("toode") ?? "");
  const variandiId = (formData.get("variant") as string) || null;
  const uusKogus = Math.trunc(Number(formData.get("kogus") ?? 0));

  const kirjed = await loeKirjed();
  const järel = kirjed
    .map((kirje) =>
      sama(kirje, tooteId, variandiId)
        ? { ...kirje, k: Math.min(MAKS_KOGUS, uusKogus) }
        : kirje,
    )
    .filter((kirje) => kirje.k > 0);
  await salvestaKirjed(järel);
  revalidatePath("/ostukorv");
  revalidatePath("/", "layout");
}

export async function eemaldaKorvist(formData: FormData): Promise<void> {
  const tooteId = String(formData.get("toode") ?? "");
  const variandiId = (formData.get("variant") as string) || null;
  const kirjed = await loeKirjed();
  await salvestaKirjed(kirjed.filter((k) => !sama(k, tooteId, variandiId)));
  revalidatePath("/ostukorv");
  revalidatePath("/", "layout");
}

export async function tühjendaKorv(): Promise<void> {
  await salvestaKirjed([]);
  revalidatePath("/ostukorv");
  revalidatePath("/", "layout");
}

export type KassaOlek = {
  vead: Record<string, string>;
  üldineViga?: string;
  väärtused: Record<string, string>;
};

/** Kassa vormi esitamine: valideerib, salvestab tellimuse ja saadab kinnituse. */
export async function esitaTellimus(
  _eelmine: KassaOlek,
  formData: FormData,
): Promise<KassaOlek> {
  const väärtused: Record<string, string> = {};
  for (const väli of [
    "nimi",
    "epost",
    "telefon",
    "tarneviis",
    "tarnepunkt",
    "aadress",
    "linn",
    "indeks",
    "markused",
  ]) {
    väärtused[väli] = String(formData.get(väli) ?? "").trim();
  }

  if (formData.get("tingimused") !== "1") {
    return {
      väärtused,
      vead: { tingimused: "Palun nõustu müügitingimustega." },
    };
  }

  const vead = valideeriTellimus(väärtused as Partial<TellimuseAndmed>);
  if (vead.length > 0) {
    return {
      väärtused,
      vead: Object.fromEntries(vead.map((v) => [v.väli, v.teade])),
    };
  }

  const korv = kokkuvõte(await loeOstukorv(), väärtused.tarneviis);
  if (korv.tühi) {
    return { väärtused, vead: {}, üldineViga: "Ostukorv on tühi." };
  }

  const tulemus = looTellimus(väärtused as unknown as TellimuseAndmed, korv);
  if ("viga" in tulemus) {
    return { väärtused, vead: {}, üldineViga: tulemus.viga };
  }

  await saadaKinnitus(tulemus.tellimus);
  await salvestaKirjed([]);
  revalidatePath("/", "layout");
  redirect(`/tellimus/${tulemus.tellimus.number}`);
}
