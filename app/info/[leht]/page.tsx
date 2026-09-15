import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { vormindaHind } from "@/lib/hinnad";
import { pood, tarneviisid, tasutaTarneAlates } from "@/lib/konfiguratsioon";

type Lõik = { pealkiri: string; tekst: string[] };
type Infoleht = { pealkiri: string; sissejuhatus: string; lõigud: Lõik[] };

const LEHED: Record<string, Infoleht> = {
  tarne: {
    pealkiri: "Tarne ja tagastus",
    sissejuhatus:
      "Saadame laos olevad tooted välja ühe tööpäeva jooksul pärast makse laekumist.",
    lõigud: [
      {
        pealkiri: "Tarneviisid ja hinnad",
        tekst: [
          ...tarneviisid.map(
            (viis) => `${viis.nimi} – ${vormindaHind(viis.hindSendid)}. ${viis.kirjeldus}.`,
          ),
          `Tellimused alates ${vormindaHind(tasutaTarneAlates)} saadame tasuta.`,
        ],
      },
      {
        pealkiri: "Tarneaeg",
        tekst: [
          "Laos olevad tooted jõuavad valitud pakiautomaati või aadressile tavaliselt 1–3 tööpäevaga.",
          "Kui toode ei ole laos, tellime selle hulgilaost ja teavitame sind e-postiga eeldatavast tarneajast (tavaliselt 5–10 tööpäeva).",
        ],
      },
      {
        pealkiri: "Tagastusõigus",
        tekst: [
          "Eraisikust ostjal on õigus tellimusest taganeda 14 päeva jooksul alates kauba kättesaamisest.",
          "Tagastatav toode peab olema kasutamata ja originaalpakendis. Tagastuskulud kannab ostja, välja arvatud juhul, kui toode oli defektne või saadeti ekslikult.",
          `Tagastussoovist teata e-posti aadressil ${pood.epost}. Tagastame raha 14 päeva jooksul pärast kauba kättesaamist.`,
        ],
      },
      {
        pealkiri: "Pretensiooni esitamine",
        tekst: [
          "Toodetele kehtib 2-aastane pretensiooni esitamise õigus. Kuluvate osade ja tavapärase kulumise puhul garantii ei kehti.",
          "Puuduse ilmnemisel võta ühendust esimesel võimalusel ning lisa võimalusel foto ja tellimuse number.",
        ],
      },
    ],
  },
  tingimused: {
    pealkiri: "Müügitingimused",
    sissejuhatus: `Käesolevad tingimused kehtivad ${pood.nimi} e-poes tehtud ostudele.`,
    lõigud: [
      {
        pealkiri: "Üldsätted",
        tekst: [
          `E-poe omanik on ${pood.pank.saaja} (registrikood ${pood.registrikood}, KMKR ${pood.kmNumber}), aadress ${pood.aadress}.`,
          "Tellimuse esitamisega kinnitab ostja, et on tingimustega tutvunud ja nendega nõus.",
        ],
      },
      {
        pealkiri: "Hinnad",
        tekst: [
          "Kõik hinnad on eurodes ja sisaldavad käibemaksu. Tarnehind lisandub tellimuse summale ja kuvatakse enne tellimuse kinnitamist.",
          "Jätame endale õiguse hindu muuta. Juba esitatud tellimuse hind ei muutu.",
        ],
      },
      {
        pealkiri: "Tellimine ja maksmine",
        tekst: [
          "Tellimus loetakse esitatuks pärast kinnituslehe kuvamist ja kinnituskirja saatmist.",
          "Tasumine toimub pangaülekandega arve alusel. Arve saadetakse e-postiga kohe pärast tellimuse esitamist.",
          "Kui makse ei laeku 7 päeva jooksul, tellimus tühistatakse.",
        ],
      },
      {
        pealkiri: "Isikuandmed",
        tekst: [
          "Kogume ainult tellimuse täitmiseks vajalikke andmeid: nimi, e-post, telefon ja tarneaadress.",
          "Andmeid ei edastata kolmandatele isikutele peale tarnepartneri, kellele edastame saadetise kohaletoimetamiseks vajaliku info.",
          `Andmete kustutamise sooviga pöördu aadressil ${pood.epost}.`,
        ],
      },
      {
        pealkiri: "Vaidluste lahendamine",
        tekst: [
          "Lahkarvamused püütakse lahendada läbirääkimiste teel. Kokkuleppe puudumisel on ostjal õigus pöörduda Tarbijavaidluste komisjoni või kohtu poole.",
        ],
      },
    ],
  },
  kontakt: {
    pealkiri: "Kontakt",
    sissejuhatus: "Küsi julgelt nõu – aitame sobiva toote valida.",
    lõigud: [
      {
        pealkiri: "Klienditugi",
        tekst: [
          `E-post: ${pood.epost}`,
          `Telefon: ${pood.telefon}`,
          "Avatud E–R 9:00–17:00",
        ],
      },
      {
        pealkiri: "Ettevõte",
        tekst: [
          pood.pank.saaja,
          `Registrikood: ${pood.registrikood}`,
          `KMKR number: ${pood.kmNumber}`,
          `Aadress: ${pood.aadress}`,
        ],
      },
      {
        pealkiri: "Ärikliendile",
        tekst: [
          "Suuremate koguste ja püsitellimuste puhul teeme personaalse hinnapakkumise.",
          `Saada päring aadressile ${pood.epost} ja lisa soovitud tooted ning kogused.`,
        ],
      },
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(LEHED).map((leht) => ({ leht }));
}

export async function generateMetadata(
  props: PageProps<"/info/[leht]">,
): Promise<Metadata> {
  const { leht } = await props.params;
  const sisu = LEHED[leht];
  return sisu
    ? { title: sisu.pealkiri, description: sisu.sissejuhatus }
    : { title: "Lehte ei leitud" };
}

export default async function InfoLeht(props: PageProps<"/info/[leht]">) {
  const { leht } = await props.params;
  const sisu = LEHED[leht];
  if (!sisu) notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold text-navi-900">{sisu.pealkiri}</h1>
      <p className="mt-3 text-lg text-hall-600">{sisu.sissejuhatus}</p>

      <div className="mt-8 space-y-8">
        {sisu.lõigud.map((lõik) => (
          <section key={lõik.pealkiri}>
            <h2 className="mb-3 text-xl font-bold text-navi-800">{lõik.pealkiri}</h2>
            <div className="space-y-2 text-hall-800">
              {lõik.tekst.map((rida) => (
                <p key={rida} className="leading-relaxed">
                  {rida}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
