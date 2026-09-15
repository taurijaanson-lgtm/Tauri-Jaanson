import type { Metadata } from "next";
import Kataloogivaade, { loeParameetrid } from "@/components/Kataloogivaade";
import { loeTootjad, otsiTooted } from "@/lib/kataloog";

export const metadata: Metadata = {
  title: "Kõik tooted",
  description:
    "Sirvi kogu valikut: tööriided, turvajalatsid, kaitsevahendid ja tööriistad.",
};

export default async function TootedLeht(props: PageProps<"/tooted">) {
  const otsinguParameetrid = await props.searchParams;
  const parameetrid = loeParameetrid(otsinguParameetrid);

  const loend = otsiTooted({
    otsing: parameetrid.otsing,
    järjestus: parameetrid.järjestus,
    ainultLaos: parameetrid.ainultLaos,
    tootja: parameetrid.tootja || null,
    leht: parameetrid.leht,
  });

  return (
    <Kataloogivaade
      pealkiri={parameetrid.otsing ? `Otsingu tulemused` : "Kõik tooted"}
      kirjeldus={
        parameetrid.otsing
          ? `Otsisid: „${parameetrid.otsing}”`
          : "Kogu valik ühes vaates."
      }
      alusTee="/tooted"
      loend={loend}
      parameetrid={parameetrid}
      tootjad={loeTootjad()}
    />
  );
}
