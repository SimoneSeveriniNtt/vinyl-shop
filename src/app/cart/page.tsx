"use client";

import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { getConditionLabel } from "@/lib/types";
import { Trash2, ArrowLeft, ShoppingBag, ArrowRight, AlertCircle, Clock } from "lucide-react";

function formatTimeRemaining(seconds?: number): string {
  if (!seconds) return "";
  if (seconds <= 0) return "Scaduto";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

export default function CartPage() {
  const { items, removeFromCart, clearCart, totalPrice, expiresInSeconds, isExpired } = useCart();

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center px-4">
        <ShoppingBag className="w-16 h-16 text-zinc-300 mb-4" />
        <h2 className="text-2xl font-bold text-zinc-700 mb-2">Il carrello è vuoto</h2>
        <p className="text-zinc-400 mb-6">Aggiungi qualche vinile dalla nostra collezione!</p>
        <Link
          href="/catalog"
          className="bg-amber-400 hover:bg-amber-500 text-zinc-900 font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          Vai al catalogo
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/catalog" className="inline-flex items-center gap-2 text-zinc-500 hover:text-amber-600 transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" />
          Continua gli acquisti
        </Link>

        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-zinc-900">Carrello</h1>
        </div>

        {/* Timer scadenza */}
        {expiresInSeconds !== undefined && !isExpired && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-900">
                Carrello scade tra <span className="text-amber-700 font-bold">{formatTimeRemaining(expiresInSeconds)}</span>
              </p>
              <p className="text-xs text-amber-700 mt-1">Completa l&apos;acquisto prima che il carrello si svuoti automaticamente</p>
            </div>
          </div>
        )}

        {/* Avviso scadenza */}
        {isExpired && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-900">Il carrello è scaduto</p>
              <p className="text-xs text-red-700 mt-1">Scorri la pagina per aggiungere nuovi prodotti</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {items.map(({ vinyl, quantity }) => (
            <div key={vinyl.id} className="bg-white rounded-2xl shadow-sm p-4 sm:p-6 flex gap-4 sm:gap-6">
              {/* Image */}
              <Link href={`/catalog/${vinyl.id}`} className="flex-shrink-0 w-24 h-24 sm:w-32 sm:h-32 rounded-xl overflow-hidden bg-zinc-100">
                {vinyl.cover_url ? (
                  <img src={vinyl.cover_url} alt={vinyl.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-300">
                    <ShoppingBag className="w-8 h-8" />
                  </div>
                )}
              </Link>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <Link href={`/catalog/${vinyl.id}`}>
                  <h3 className="font-bold text-zinc-900 hover:text-amber-600 transition-colors truncate">{vinyl.title}</h3>
                </Link>
                <p className="text-sm text-zinc-500">{vinyl.artist}</p>
                <p className="text-sm text-zinc-400 mt-1">{getConditionLabel(vinyl.condition, vinyl.is_sealed)}</p>

                <div className="flex items-center justify-between mt-4">
                  {/* Quantity — vinile unico, quantità fissa a 1 */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-400 font-medium">Quantità: 1</span>
                  </div>

                  {/* Price + delete */}
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-zinc-900">€{(vinyl.price * quantity).toFixed(2)}</span>
                    <button
                      onClick={() => removeFromCart(vinyl.id)}
                      className="text-zinc-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mt-8">
          <div className="flex items-center justify-between mb-4">
            <span className="text-zinc-600">Subtotale</span>
            <span className="font-bold text-xl text-zinc-900">€{totalPrice.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between mb-6 text-sm text-zinc-400">
            <span>Spedizione</span>
            <span>Calcolata al checkout</span>
          </div>
          {isExpired ? (
            <button
              type="button"
              disabled
              className="w-full bg-zinc-200 text-zinc-500 font-bold py-4 rounded-xl text-lg flex items-center justify-center gap-2 cursor-not-allowed"
            >
              Carrello scaduto
            </button>
          ) : (
            <Link href="/checkout" className="w-full bg-amber-400 hover:bg-amber-500 text-zinc-900 font-bold py-4 rounded-xl transition-colors text-lg flex items-center justify-center gap-2">
              Procedi al checkout <ArrowRight className="w-5 h-5" />
            </Link>
          )}
          <button
            onClick={clearCart}
            className="w-full mt-3 text-zinc-400 hover:text-red-500 transition-colors text-sm py-2"
          >
            Svuota carrello
          </button>
        </div>
      </div>
    </div>
  );
}
