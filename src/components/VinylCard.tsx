"use client";

import { useState } from "react";
import Link from "next/link";
import { ShoppingCart, Check } from "lucide-react";
import { Vinyl, getConditionLabel, getConditionQuality, isConditionSealed } from "@/lib/types";
import { useCart } from "@/context/CartContext";
import CartToast from "@/components/CartToast";

interface VinylCardProps {
  vinyl: Vinyl;
}

export default function VinylCard({ vinyl }: VinylCardProps) {
  const { addToCart, items } = useCart();
  const [toastVisible, setToastVisible] = useState(false);
  const isInCart = items.some((item) => item.vinyl.id === vinyl.id);
  const sealed = isConditionSealed(vinyl.condition, vinyl.is_sealed);
  const quality = getConditionQuality(vinyl.condition);

  const conditionColor: Record<string, string> = {
    Mint: "bg-green-500",
    "Near Mint": "bg-green-400",
    "Very Good": "bg-blue-500",
    Good: "bg-yellow-500",
    Fair: "bg-orange-500",
    Poor: "bg-red-500",
  };

  return (
    <div className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden flex flex-col group">
      {/* Cover Image */}
      <Link href={`/catalog/${vinyl.id}`} className="relative aspect-square overflow-hidden bg-zinc-100">
        {vinyl.cover_url ? (
          <img
            src={vinyl.cover_url}
            alt={vinyl.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-300">
            <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1" />
              <circle cx="12" cy="12" r="3" />
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" />
            </svg>
          </div>
        )}
        {/* Sold overlay */}
        {!vinyl.available && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="bg-red-600 text-white font-bold text-lg px-4 py-2 rounded-xl tracking-widest rotate-[-10deg] shadow-lg">VENDUTO</span>
          </div>
        )}
        {/* Condition badge */}
        <span className={`absolute top-3 right-3 text-white text-xs font-semibold px-2 py-1 rounded-full ${conditionColor[quality] || "bg-zinc-500"}`}>
          {getConditionLabel(vinyl.condition, vinyl.is_sealed)}
        </span>
      </Link>

      {/* Info */}
      <div className="p-3 sm:p-4 flex flex-col flex-1">
        <Link href={`/catalog/${vinyl.id}`}>
          <h3 className="font-bold text-base lg:text-lg text-zinc-900 hover:text-amber-600 transition-colors line-clamp-1">
            {vinyl.title}
          </h3>
        </Link>
        <p className="text-zinc-500 text-xs sm:text-sm mt-1 line-clamp-1">{vinyl.artist}</p>
        {(vinyl.genres || vinyl.is_signed || sealed) && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {vinyl.genres && (
              <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-1 text-[11px] leading-none text-zinc-600">
                {vinyl.genres.name}
              </span>
            )}
            {vinyl.is_signed && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-1 text-[11px] leading-none font-semibold text-amber-800">
                Autografato
              </span>
            )}
            {sealed && (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-[11px] leading-none font-semibold text-blue-800">
                Sigillato
              </span>
            )}
          </div>
        )}

        <div className="mt-auto pt-3 flex items-center justify-between gap-2">
          <span className={`text-lg sm:text-xl font-bold ${vinyl.available ? "text-zinc-900" : "text-zinc-400"}`}>
            €{Number(vinyl.price).toFixed(2)}
          </span>
          <button
            onClick={() => {
              if (!isInCart) {
                addToCart(vinyl);
                setToastVisible(true);
              }
            }}
            disabled={!vinyl.available || isInCart}
            className={`p-2 rounded-xl transition-all ${
              isInCart
                ? "bg-green-500 text-white cursor-default"
                : "bg-amber-400 hover:bg-amber-500 disabled:bg-zinc-200 disabled:cursor-not-allowed text-zinc-900 disabled:text-zinc-400"
            }`}
            title={isInCart ? "Già nel carrello" : vinyl.available ? "Aggiungi al carrello" : "Vinile venduto"}
          >
            {isInCart ? (
              <Check className="w-4 h-4 sm:w-5 sm:h-5" />
            ) : (
              <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </button>
        </div>
      </div>
      <CartToast
        message={`"${vinyl.title}" aggiunto al carrello`}
        visible={toastVisible}
        onHide={() => setToastVisible(false)}
      />
    </div>
  );
}
