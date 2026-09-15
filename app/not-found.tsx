import Link from "next/link";

export default function Leidmata() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <p className="text-5xl font-black text-liiv-500">404</p>
      <h1 className="mt-4 text-3xl font-bold text-oliiv-900">Lehte ei leitud</h1>
      <p className="mt-3 text-hall-600">
        Otsitud lehte ei ole olemas või on toode müügilt eemaldatud.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link
          href="/"
          className="rounded-lg bg-oliiv-800 px-6 py-3 font-semibold text-white transition hover:bg-oliiv-700"
        >
          Avalehele
        </Link>
        <Link
          href="/tooted"
          className="rounded-lg border border-hall-200 bg-white px-6 py-3 font-semibold text-oliiv-800 transition hover:border-oliiv-600"
        >
          Vaata tooteid
        </Link>
      </div>
    </div>
  );
}
