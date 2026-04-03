import Link from "next/link";
import { Disc3, Search, ShieldCheck, ShoppingCart } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-zinc-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32 text-center">
          <Disc3 className="w-16 h-16 text-amber-400 mx-auto mb-6 animate-spin" style={{ animationDuration: "3s" }} />
          <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
            La tua musica in <span className="text-amber-400">vinile</span>
          </h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-10">
            Scopri la nostra collezione di dischi in vinile. Pop, Rock, House, Rap e molto altro. Ogni disco ha una storia da raccontare.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/catalog"
              className="bg-amber-400 hover:bg-amber-500 text-zinc-900 font-bold px-8 py-4 rounded-xl transition-colors text-lg"
            >
              Esplora il Catalogo
            </Link>
            <Link
              href="/admin"
              className="border-2 border-zinc-700 hover:border-amber-400 text-white hover:text-amber-400 font-semibold px-8 py-4 rounded-xl transition-colors text-lg"
            >
              Area Admin
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-zinc-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-zinc-900 mb-12">Come funziona</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-sm text-center">
              <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <Search className="w-7 h-7 text-amber-600" />
              </div>
              <h3 className="font-bold text-lg text-zinc-900 mb-3">Cerca e Filtra</h3>
              <p className="text-zinc-500">
                Trova il vinile perfetto cercando per nome, artista, genere musicale o condizione.
              </p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-sm text-center">
              <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <ShoppingCart className="w-7 h-7 text-amber-600" />
              </div>
              <h3 className="font-bold text-lg text-zinc-900 mb-3">Aggiungi al Carrello</h3>
              <p className="text-zinc-500">
                Seleziona i vinili che desideri e aggiungili al carrello con un click.
              </p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-sm text-center">
              <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <ShieldCheck className="w-7 h-7 text-amber-600" />
              </div>
              <h3 className="font-bold text-lg text-zinc-900 mb-3">Acquista Sicuro</h3>
              <p className="text-zinc-500">
                Ogni vinile è descritto con condizioni precise. Quello che vedi è quello che ricevi.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-zinc-900 text-white py-16">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Pronto a scoprire la collezione?</h2>
          <p className="text-zinc-400 mb-8">Nuovi vinili aggiunti regolarmente. Non perderti i pezzi rari!</p>
          <Link
            href="/catalog"
            className="inline-block bg-amber-400 hover:bg-amber-500 text-zinc-900 font-bold px-8 py-4 rounded-xl transition-colors text-lg"
          >
            Vai al Catalogo
          </Link>
        </div>
      </section>
    </div>
  );
}
