"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Vinyl, getConditionLabel, getConditionQuality, isConditionSealed } from "@/lib/types";
import { useCart } from "@/context/CartContext";
import ImageGallery from "@/components/ImageGallery";
import { ArrowLeft, ShoppingCart, Check, Loader2 } from "lucide-react";

export default function VinylDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { addToCart, items } = useCart();
  const [vinyl, setVinyl] = useState<Vinyl | null>(null);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);

  const inCart = items.some((item) => item.vinyl.id === id);

  useEffect(() => {
    async function fetchVinyl() {
      setLoading(true);
      const { data } = await supabase
        .from("vinyls")
        .select("*, genres(*), vinyl_images(*)")
        .eq("id", id)
        .single();
      if (data) setVinyl(data);
      setLoading(false);
    }
    if (id) fetchVinyl();
  }, [id]);

  const handleAddToCart = () => {
    if (!vinyl) return;
    addToCart(vinyl);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const conditionColor: Record<string, string> = {
    Sealed: "bg-blue-700",
    Mint: "bg-green-500",
    "Near Mint": "bg-green-400",
    "Very Good": "bg-blue-500",
    Good: "bg-yellow-500",
    Fair: "bg-orange-500",
    Poor: "bg-red-500",
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (!vinyl) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50">
        <p className="text-xl text-zinc-500 mb-4">Vinile non trovato</p>
        <Link href="/catalog" className="text-amber-600 hover:text-amber-700 font-medium flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Torna al catalogo
        </Link>
      </div>
    );
  }

  const allImages = [
    ...(vinyl.cover_url ? [vinyl.cover_url] : []),
    ...(vinyl.vinyl_images?.sort((a, b) => a.sort_order - b.sort_order).map((img) => img.image_url) || []),
  ];
  const sealed = isConditionSealed(vinyl.condition, vinyl.is_sealed);

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back link */}
        <Link href="/catalog" className="inline-flex items-center gap-2 text-zinc-500 hover:text-amber-600 transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" />
          Torna al catalogo
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Gallery */}
          <ImageGallery images={allImages} title={vinyl.title} />

          {/* Details */}
          <div className="space-y-6">
            <div>
              {vinyl.genres && (
                <span className="inline-block text-sm bg-zinc-100 text-zinc-600 px-3 py-1 rounded-full mb-3">
                  {vinyl.genres.name}
                </span>
              )}
              {vinyl.is_signed && (
                <span className="inline-block text-sm bg-amber-100 text-amber-800 px-3 py-1 rounded-full mb-3 ml-2 font-semibold">
                  Autografato
                </span>
              )}
              {sealed && (
                <span className="inline-block text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full mb-3 ml-2 font-semibold">
                  Sigillato
                </span>
              )}
              <h1 className="text-3xl md:text-4xl font-bold text-zinc-900">{vinyl.title}</h1>
              <p className="text-xl text-zinc-500 mt-2">{vinyl.artist}</p>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-3xl font-bold text-zinc-900">€{Number(vinyl.price).toFixed(2)}</span>
              <span className={`text-white text-sm font-semibold px-3 py-1 rounded-full ${conditionColor[getConditionQuality(vinyl.condition)] || "bg-zinc-500"}`}>
                {getConditionLabel(vinyl.condition, vinyl.is_sealed)}
              </span>
              {vinyl.release_year && (
                <span className="text-sm text-zinc-500 bg-zinc-100 px-3 py-1 rounded-full">{vinyl.release_year}</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${vinyl.available ? "bg-green-500" : "bg-red-500"}`} />
              <span className="text-sm text-zinc-600">{vinyl.available ? "Disponibile" : "Venduto"}</span>
            </div>

            {vinyl.description && (
              <div>
                <h3 className="font-semibold text-zinc-800 mb-2">Descrizione</h3>
                <p className="text-zinc-600 leading-relaxed">{vinyl.description}</p>
              </div>
            )}

            {/* Add to cart */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              {!vinyl.available ? (
                <div className="flex items-center justify-center gap-2 bg-red-100 text-red-700 font-bold px-8 py-4 rounded-xl text-lg">
                  Vinile Venduto
                </div>
              ) : (
                <button
                  onClick={handleAddToCart}
                  disabled={!vinyl.available || inCart}
                  className={`flex items-center justify-center gap-2 font-semibold px-8 py-4 rounded-xl transition-colors text-lg ${
                    inCart
                      ? "bg-green-500 text-white cursor-default"
                      : "bg-amber-400 hover:bg-amber-500 disabled:bg-zinc-300 disabled:cursor-not-allowed text-zinc-900"
                  }`}
                >
                  {inCart ? (
                    <>
                      <Check className="w-5 h-5" /> Nel carrello
                    </>
                  ) : added ? (
                    <>
                      <Check className="w-5 h-5" /> Aggiunto!
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-5 h-5" /> Aggiungi al carrello
                    </>
                  )}
                </button>
              )}
              {inCart && vinyl.available && (
                <Link
                  href="/cart"
                  className="flex items-center justify-center gap-2 border-2 border-amber-400 text-amber-600 hover:bg-amber-50 font-semibold px-8 py-4 rounded-xl transition-colors"
                >
                  Vai al carrello
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
