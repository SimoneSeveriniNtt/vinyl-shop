"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import Link from "next/link";
import { ArrowLeft, Loader2, ShoppingBag, CheckCircle } from "lucide-react";

interface CheckoutForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  province: string;
  cap: string;
  country: string;
  notes: string;
}

interface AddressSuggestion {
  label: string;
  address: string;
  city: string;
  province: string;
  cap: string;
  country: string;
}

const emptyForm: CheckoutForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  province: "",
  cap: "",
  country: "Italia",
  notes: "",
};

export default function CheckoutPage() {
  const { items, totalPrice, clearCart } = useCart();
  const router = useRouter();
  const [form, setForm] = useState<CheckoutForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);

  const shippingCost = totalPrice >= 50 ? 0 : 5.99;
  const grandTotal = totalPrice + shippingCost;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  useEffect(() => {
    if (form.address.trim().length < 3) {
      setAddressSuggestions([]);
      setAddressLoading(false);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        setAddressLoading(true);
        const res = await fetch(`/api/address-search?q=${encodeURIComponent(form.address)}`);
        const data = await res.json();
        setAddressSuggestions(data.suggestions || []);
      } catch {
        setAddressSuggestions([]);
      } finally {
        setAddressLoading(false);
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [form.address]);

  const selectAddressSuggestion = (suggestion: AddressSuggestion) => {
    const typedHouseNumber = form.address.match(/(?:^|\s)(\d+[A-Za-z\/-]*)\b/)?.[1] || "";
    const suggestionHasHouseNumber = /\d/.test(suggestion.address || "");
    const finalAddress = suggestionHasHouseNumber
      ? suggestion.address
      : (typedHouseNumber && suggestion.address ? `${suggestion.address} ${typedHouseNumber}` : (suggestion.address || form.address));

    setForm((prev) => ({
      ...prev,
      address: finalAddress || prev.address,
      city: suggestion.city || prev.city,
      province: suggestion.province || prev.province,
      cap: suggestion.cap || prev.cap,
      country: suggestion.country || prev.country,
    }));
    setShowAddressSuggestions(false);
    setAddressSuggestions([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: form,
          items: items.map((item) => ({
            id: item.vinyl.id,
            title: item.vinyl.title,
            artist: item.vinyl.artist,
            price: item.vinyl.price,
            condition: item.vinyl.condition,
            cover_url: item.vinyl.cover_url,
            quantity: item.quantity,
          })),
          subtotal: totalPrice,
          shipping: shippingCost,
          total: grandTotal,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Errore durante l'invio dell'ordine");
      }

      setSuccess(true);
      clearCart();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 sm:p-12 max-w-lg w-full text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-zinc-900 mb-3">Ordine confermato!</h1>
          <p className="text-zinc-500 mb-2">
            Grazie <span className="font-semibold text-zinc-700">{form.firstName}</span>! Il tuo ordine è stato ricevuto.
          </p>
          <p className="text-zinc-400 text-sm mb-8">
            Riceverai una conferma via email a <span className="font-medium text-zinc-600">{form.email}</span>
          </p>
          <Link
            href="/catalog"
            className="inline-block bg-amber-400 hover:bg-amber-500 text-zinc-900 font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Torna al catalogo
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center px-4">
        <ShoppingBag className="w-16 h-16 text-zinc-300 mb-4" />
        <h2 className="text-2xl font-bold text-zinc-700 mb-2">Carrello vuoto</h2>
        <p className="text-zinc-400 mb-6">Aggiungi dei vinili prima di procedere al checkout.</p>
        <Link href="/catalog" className="bg-amber-400 hover:bg-amber-500 text-zinc-900 font-semibold px-6 py-3 rounded-xl transition-colors">
          Vai al catalogo
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/cart" className="inline-flex items-center gap-2 text-zinc-500 hover:text-amber-600 transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" />
          Torna al carrello
        </Link>

        <h1 className="text-3xl font-bold text-zinc-900 mb-8">Checkout</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Personal info */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="text-lg font-bold text-zinc-900 mb-5">Dati personali</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Nome *</label>
                    <input
                      type="text" name="firstName" required value={form.firstName} onChange={handleChange}
                      className="w-full px-4 py-3 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Cognome *</label>
                    <input
                      type="text" name="lastName" required value={form.lastName} onChange={handleChange}
                      className="w-full px-4 py-3 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Email *</label>
                    <input
                      type="email" name="email" required value={form.email} onChange={handleChange}
                      className="w-full px-4 py-3 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Telefono *</label>
                    <input
                      type="tel" name="phone" required value={form.phone} onChange={handleChange}
                      className="w-full px-4 py-3 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:outline-none"
                      placeholder="+39 ..."
                    />
                  </div>
                </div>
              </div>

              {/* Shipping address */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="text-lg font-bold text-zinc-900 mb-5">Indirizzo di spedizione</h2>
                <div className="space-y-4">
                  <div className="relative">
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Indirizzo *</label>
                    <input
                      type="text" name="address" required value={form.address} onChange={handleChange}
                      onFocus={() => setShowAddressSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowAddressSuggestions(false), 150)}
                      className="w-full px-4 py-3 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:outline-none"
                      placeholder="Via/Piazza, numero civico"
                    />
                    <p className="text-xs text-zinc-400 mt-2">
                      Inizia a digitare la via: ti proporrò indirizzi reali e compilerò CAP, città e provincia.
                    </p>
                    {showAddressSuggestions && (addressLoading || addressSuggestions.length > 0) && (
                      <div className="absolute z-20 mt-2 w-full rounded-xl border border-zinc-200 bg-white shadow-lg overflow-hidden">
                        {addressLoading && (
                          <div className="px-4 py-3 text-sm text-zinc-500 flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Cerco indirizzi reali...
                          </div>
                        )}
                        {!addressLoading && addressSuggestions.map((suggestion, index) => (
                          <button
                            key={`${suggestion.label}-${index}`}
                            type="button"
                            onMouseDown={() => selectAddressSuggestion(suggestion)}
                            className="block w-full text-left px-4 py-3 hover:bg-zinc-50 border-t border-zinc-100 first:border-t-0"
                          >
                            <span className="block text-sm font-medium text-zinc-800">{suggestion.address}</span>
                            <span className="block text-xs text-zinc-500">
                              {[suggestion.cap, suggestion.city, suggestion.province].filter(Boolean).join(" ")}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Città *</label>
                      <input
                        type="text" name="city" required value={form.city} onChange={handleChange}
                        className="w-full px-4 py-3 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Provincia *</label>
                      <input
                        type="text" name="province" required value={form.province} onChange={handleChange}
                        className="w-full px-4 py-3 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:outline-none"
                        placeholder="es. MI"
                        maxLength={2}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">CAP *</label>
                      <input
                        type="text" name="cap" required value={form.cap} onChange={handleChange}
                        className="w-full px-4 py-3 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:outline-none"
                        maxLength={5}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Paese</label>
                    <select
                      name="country" value={form.country} onChange={handleChange}
                      className="w-full px-4 py-3 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    >
                      <option value="Italia">Italia</option>
                      <option value="San Marino">San Marino</option>
                      <option value="Svizzera">Svizzera</option>
                      <option value="Altro">Altro (EU)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="text-lg font-bold text-zinc-900 mb-5">Note ordine</h2>
                <textarea
                  name="notes" value={form.notes} onChange={handleChange} rows={3}
                  className="w-full px-4 py-3 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:outline-none resize-none"
                  placeholder="Note aggiuntive per la spedizione (opzionale)..."
                />
              </div>
            </div>

            {/* Right: Order summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-sm p-6 sticky top-20">
                <h2 className="text-lg font-bold text-zinc-900 mb-5">Riepilogo ordine</h2>

                <div className="space-y-4 mb-6">
                  {items.map(({ vinyl, quantity }) => (
                    <div key={vinyl.id} className="flex gap-3">
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-100 flex-shrink-0">
                        {vinyl.cover_url ? (
                          <img src={vinyl.cover_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-300 text-xs">N/A</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-900 truncate">{vinyl.title}</p>
                        <p className="text-xs text-zinc-500">{vinyl.artist}</p>
                        <p className="text-xs text-zinc-400">Qtà: {quantity}</p>
                      </div>
                      <span className="text-sm font-medium text-zinc-900">€{(vinyl.price * quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-zinc-100 pt-4 space-y-2">
                  <div className="flex justify-between text-sm text-zinc-600">
                    <span>Subtotale</span>
                    <span>€{totalPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-zinc-600">
                    <span>Spedizione</span>
                    <span>{shippingCost === 0 ? <span className="text-green-600 font-medium">Gratis</span> : `€${shippingCost.toFixed(2)}`}</span>
                  </div>
                  {totalPrice < 50 && (
                    <p className="text-xs text-zinc-400">Spedizione gratuita per ordini sopra €50</p>
                  )}
                  <div className="flex justify-between text-lg font-bold text-zinc-900 pt-2 border-t border-zinc-100">
                    <span>Totale</span>
                    <span>€{grandTotal.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full mt-6 bg-amber-400 hover:bg-amber-500 disabled:bg-zinc-300 text-zinc-900 font-bold py-4 rounded-xl transition-colors text-lg flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" /> Invio in corso...
                    </>
                  ) : (
                    "Conferma ordine"
                  )}
                </button>

                <p className="text-xs text-zinc-400 text-center mt-3">
                  Cliccando confermi l&apos;acquisto. Verrai contattato per il pagamento.
                </p>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
