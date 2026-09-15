import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Jalus from "@/components/Jalus";
import Pais from "@/components/Pais";
import { pood } from "@/lib/konfiguratsioon";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${pood.nimi} – ${pood.slogan}`,
    template: `%s | ${pood.nimi}`,
  },
  description:
    "Tööriided, turvajalatsid, kaitsevahendid ja tööriistad. Kiire tarne pakiautomaati üle Eesti.",
  openGraph: {
    type: "website",
    locale: "et_EE",
    siteName: pood.nimi,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="et" className={inter.variable}>
      <body className="flex min-h-screen flex-col font-sans">
        <a
          href="#sisu"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-oliiv-800 focus:px-4 focus:py-2 focus:text-white"
        >
          Liigu sisu juurde
        </a>
        <Pais />
        <main id="sisu" className="flex-1">
          {children}
        </main>
        <Jalus />
      </body>
    </html>
  );
}
