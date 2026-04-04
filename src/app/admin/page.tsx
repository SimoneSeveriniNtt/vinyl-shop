"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Genre, Vinyl, CONDITIONS, CONDITION_LABELS } from "@/lib/types";
import { Plus, Pencil, Trash2, Loader2, X, Save, LogOut, ShoppingBag, Disc3, RotateCcw, PackageCheck, Radar, Sparkles, ExternalLink } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import AdminLogin from "@/components/AdminLogin";
import ImageUpload from "@/components/ImageUpload";

interface VinylForm {
  title: string;
  artist: string;
  description: string;
  price: string;
  condition: string;
  genre_id: string;
  cover_url: string;
  available: boolean;
  is_signed: boolean;
  release_year: string;
}

interface EbayPublishResponse {
  success: boolean;
  listingId?: string;
  offerId?: string;
  note?: string;
  error?: string;
}

const emptyForm: VinylForm = {
  title: "",
  artist: "",
  description: "",
  price: "",
  condition: "Good",
  genre_id: "",
  cover_url: "",
  available: true,
  is_signed: false,
  release_year: "",
};

interface OrderRow {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  total: number;
  status: string;
  created_at: string;
  order_items: { quantity: number; price_at_purchase: number; vinyls: { title: string; artist: string } | null }[];
}

interface MarketRadarItem {
  id: string;
  title: string;
  artist: string;
  releaseDate: string | null;
  country: string;
  raritySignals: string[];
  opportunityScore: number;
  recommendation: "Alta" | "Media" | "Bassa";
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending:   "In attesa",
  confirmed: "Confermato",
  shipped:   "Spedito",
  completed: "Completato",
  cancelled: "Annullato",
};

const ORDER_STATUS_COLORS: Record<string, string> = {
  pending:   "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  shipped:   "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function AdminPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [tab, setTab] = useState<"vinyls" | "sold" | "orders" | "radar">("vinyls");
  const [vinyls, setVinyls] = useState<Vinyl[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [radarItems, setRadarItems] = useState<MarketRadarItem[]>([]);
  const [radarGenre, setRadarGenre] = useState("rock");
  const [radarArtistInput, setRadarArtistInput] = useState("");
  const [radarArtistFilter, setRadarArtistFilter] = useState("");
  const [radarLoading, setRadarLoading] = useState(false);
  const [radarLoadingMore, setRadarLoadingMore] = useState(false);
  const [radarError, setRadarError] = useState("");
  const [radarAutoFetched, setRadarAutoFetched] = useState(false);
  const [radarPage, setRadarPage] = useState(1);
  const [radarHasMore, setRadarHasMore] = useState(false);
  const [radarTotal, setRadarTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VinylForm>(emptyForm);
  const [extraImages, setExtraImages] = useState<string[]>([]);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function fetchData() {
    setLoading(true);
    const [vinylRes, genreRes] = await Promise.all([
      supabase.from("vinyls").select("*, genres(*), vinyl_images(*)").order("created_at", { ascending: false }),
      supabase.from("genres").select("*").order("name"),
    ]);
    if (vinylRes.data) setVinyls(vinylRes.data);
    if (genreRes.data) setGenres(genreRes.data);
    setLoading(false);
  }

  async function fetchOrders() {
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(quantity, price_at_purchase, vinyls(title, artist))")
      .order("created_at", { ascending: false });
    if (data) setOrders(data as OrderRow[]);
  }

  const fetchMarketRadar = useCallback(async (page = 1, append = false) => {
    if (append) {
      setRadarLoadingMore(true);
    } else {
      setRadarLoading(true);
      setRadarError("");
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        throw new Error("Sessione admin non valida. Ricarica la pagina e rifai login.");
      }

      const params = new URLSearchParams({
        genre: radarGenre,
        page: String(page),
        limit: "20",
      });

      if (radarArtistFilter.trim()) {
        params.set("artist", radarArtistFilter.trim());
      }

      const res = await fetch(`/api/admin/market-radar?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Errore caricamento radar");
      }

      const incomingItems = payload.items || [];
      setRadarItems((prev) => (append ? [...prev, ...incomingItems] : incomingItems));
      setRadarPage(payload.page || page);
      setRadarHasMore(Boolean(payload.hasMore));
      setRadarTotal(payload.total || 0);
    } catch (error) {
      setRadarError(error instanceof Error ? error.message : "Errore caricamento radar");
      if (!append) {
        setRadarItems([]);
      }
      setRadarHasMore(false);
    } finally {
      setRadarAutoFetched(true);
      setRadarLoading(false);
      setRadarLoadingMore(false);
    }
  }, [radarGenre, radarArtistFilter]);

  useEffect(() => {
    if (!user) return;

    const timer = setTimeout(() => {
      void fetchData();
      void fetchOrders();
    }, 0);

    return () => clearTimeout(timer);
  }, [user]);

  useEffect(() => {
    if (tab === "radar" && !radarAutoFetched && !radarLoading) {
      void fetchMarketRadar(1, false);
    }
  }, [tab, radarAutoFetched, radarLoading, fetchMarketRadar]);

  useEffect(() => {
    setRadarAutoFetched(false);
    setRadarError("");
    setRadarItems([]);
    setRadarPage(1);
    setRadarHasMore(false);
    setRadarTotal(0);
  }, [radarGenre, radarArtistFilter]);

  function applyRadarArtistFilter() {
    setRadarArtistFilter(radarArtistInput.trim());
  }

  function radarBadgeClass(score: number): string {
    if (score >= 75) return "bg-green-100 text-green-700";
    if (score >= 55) return "bg-amber-100 text-amber-700";
    return "bg-zinc-100 text-zinc-600";
  }

  async function updateOrderStatus(id: string, status: string) {
    await supabase.from("orders").update({ status }).eq("id", id);
    fetchOrders();
  }

  async function toggleAvailability(vinyl: Vinyl) {
    const { error } = await supabase
      .from("vinyls")
      .update({ available: !vinyl.available, updated_at: new Date().toISOString() })
      .eq("id", vinyl.id);

    if (error) {
      showMessage("error", "Errore aggiornamento stato: " + error.message);
      return;
    }

    showMessage("success", !vinyl.available ? "Vinile rimesso in vendita" : "Vinile segnato come venduto");
    fetchData();
  }

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }

  function openNew() {
    setForm(emptyForm);
    setExtraImages([]);
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(vinyl: Vinyl) {
    setForm({
      title: vinyl.title,
      artist: vinyl.artist,
      description: vinyl.description || "",
      price: String(vinyl.price),
      condition: vinyl.condition,
      genre_id: vinyl.genre_id || "",
      cover_url: vinyl.cover_url || "",
      available: vinyl.available,
      is_signed: vinyl.is_signed || false,
      release_year: vinyl.release_year ? String(vinyl.release_year) : "",
    });
    setExtraImages(vinyl.vinyl_images?.sort((a, b) => a.sort_order - b.sort_order).map((i) => i.image_url) || []);
    setEditingId(vinyl.id);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setExtraImages([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.artist || !form.price) {
      showMessage("error", "Titolo, artista e prezzo sono obbligatori");
      return;
    }

    setSaving(true);
    const vinylData = {
      title: form.title.trim(),
      artist: form.artist.trim(),
      description: form.description.trim() || null,
      price: parseFloat(form.price),
      condition: form.condition,
      genre_id: form.genre_id || null,
      cover_url: form.cover_url.trim() || null,
      available: form.available,
      is_signed: form.is_signed,
      release_year: form.release_year ? parseInt(form.release_year) : null,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      // Update
      const { error } = await supabase.from("vinyls").update(vinylData).eq("id", editingId);
      if (error) {
        showMessage("error", "Errore aggiornamento: " + error.message);
        setSaving(false);
        return;
      }
      // Update images: delete old, insert new
      await supabase.from("vinyl_images").delete().eq("vinyl_id", editingId);
      if (extraImages.length > 0) {
        await supabase.from("vinyl_images").insert(
          extraImages.map((url, i) => ({ vinyl_id: editingId, image_url: url, sort_order: i }))
        );
      }
      showMessage("success", "Vinile aggiornato!");
    } else {
      // Insert
      const { data, error } = await supabase.from("vinyls").insert(vinylData).select().single();
      if (error || !data) {
        showMessage("error", "Errore inserimento: " + (error?.message || "Errore sconosciuto"));
        setSaving(false);
        return;
      }
      if (extraImages.length > 0) {
        await supabase.from("vinyl_images").insert(
          extraImages.map((url, i) => ({ vinyl_id: data.id, image_url: url, sort_order: i }))
        );
      }

      let publishMessage = "Vinile aggiunto al catalogo!";
      if (data.available) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token;

          if (token) {
            const ebayRes = await fetch("/api/ebay/publish", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                vinyl: {
                  id: data.id,
                  title: data.title,
                  artist: data.artist,
                  description: data.description,
                  price: data.price,
                  condition: data.condition,
                  cover_url: data.cover_url,
                  available: data.available,
                },
              }),
            });

            const ebayData = (await ebayRes.json()) as EbayPublishResponse;

            if (ebayRes.ok && ebayData.success) {
              publishMessage = ebayData.listingId
                ? `Vinile aggiunto e pubblicato su eBay (#${ebayData.listingId})`
                : "Vinile aggiunto. Pubblicazione eBay completata.";
            } else if (ebayRes.status === 503) {
              publishMessage = "Vinile aggiunto. eBay non configurato ancora: pubblicazione automatica in attesa.";
            } else {
              publishMessage = `Vinile aggiunto. eBay non pubblicato: ${ebayData.error || "errore sconosciuto"}`;
            }
          }
        } catch {
          publishMessage = "Vinile aggiunto. Pubblicazione eBay non riuscita (ritenta dopo).";
        }
      }

      showMessage("success", publishMessage);
    }

    closeForm();
    setSaving(false);
    fetchData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Sei sicuro di voler eliminare questo vinile?")) return;
    const { error } = await supabase.from("vinyls").delete().eq("id", id);
    if (error) {
      showMessage("error", "Errore eliminazione: " + error.message);
    } else {
      showMessage("success", "Vinile eliminato");
      fetchData();
    }
  }

  function addExtraImage(url: string) {
    setExtraImages((prev) => [...prev, url]);
  }

  function removeExtraImage(index: number) {
    setExtraImages((prev) => prev.filter((_, i) => i !== index));
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AdminLogin />;
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">Gestione Vinili</h1>
            <p className="text-zinc-500 mt-1">Accesso come <span className="font-medium text-zinc-700">{user.email}</span></p>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-3 sm:flex sm:items-center sm:justify-end">
            {(tab === "vinyls" || tab === "sold") && (
              <button
                onClick={openNew}
                className="flex w-full items-center justify-center gap-2 bg-amber-400 hover:bg-amber-500 text-zinc-900 font-semibold px-5 py-3 rounded-xl transition-colors sm:w-auto"
              >
                <Plus className="w-5 h-5" />
                Nuovo Vinile
              </button>
            )}
            <button
              onClick={signOut}
              className="flex items-center justify-center gap-2 border border-zinc-200 text-zinc-500 hover:text-red-500 hover:border-red-200 px-4 py-3 rounded-xl transition-colors"
              title="Esci"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toast message */}
        {message && (
          <div
            className={`mb-6 px-4 py-3 rounded-xl text-sm font-medium ${
              message.type === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mb-6 sm:flex sm:flex-wrap">
          <button
            onClick={() => setTab("vinyls")}
            className={`inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
              tab === "vinyls" ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            <Disc3 className="w-4 h-4" />
            In vendita
            {!loading && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                tab === "vinyls" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700"
              }`}>
                {vinyls.filter((v) => v.available).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("sold")}
            className={`inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
              tab === "sold" ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            <PackageCheck className="w-4 h-4" />
            Venduti
            {!loading && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                tab === "sold" ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-600"
              }`}>
                {vinyls.filter((v) => !v.available).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("orders")}
            className={`col-span-2 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-colors sm:col-span-1 ${
              tab === "orders" ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            Ordini
          </button>
          <button
            onClick={() => setTab("radar")}
            className={`col-span-2 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-colors sm:col-span-1 ${
              tab === "radar" ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            <Radar className="w-4 h-4" />
            Radar Acquisti
          </button>
        </div>

        {/* Form modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-10 px-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 sm:p-8 mb-10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-zinc-900">
                  {editingId ? "Modifica Vinile" : "Nuovo Vinile"}
                </h2>
                <button onClick={closeForm} className="text-zinc-400 hover:text-zinc-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Titolo *</label>
                    <input
                      type="text"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      className="w-full px-4 py-3 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Artista *</label>
                    <input
                      type="text"
                      value={form.artist}
                      onChange={(e) => setForm({ ...form, artist: e.target.value })}
                      className="w-full px-4 py-3 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Descrizione</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:outline-none resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Prezzo (€) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                      className="w-full px-4 py-3 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Anno di uscita</label>
                    <input
                      type="number"
                      min="1900"
                      max={new Date().getFullYear()}
                      value={form.release_year}
                      onChange={(e) => setForm({ ...form, release_year: e.target.value })}
                      className="w-full px-4 py-3 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:outline-none"
                      placeholder="es. 2023"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Condizione</label>
                    <select
                      value={form.condition}
                      onChange={(e) => setForm({ ...form, condition: e.target.value })}
                      className="w-full px-4 py-3 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    >
                      {CONDITIONS.map((c) => (
                        <option key={c} value={c}>{CONDITION_LABELS[c]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Genere</label>
                    <select
                      value={form.genre_id}
                      onChange={(e) => setForm({ ...form, genre_id: e.target.value })}
                      className="w-full px-4 py-3 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    >
                      <option value="">-- Seleziona --</option>
                      {genres.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  {form.cover_url ? (
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Copertina</label>
                      <div className="relative w-32 h-32 rounded-xl overflow-hidden bg-zinc-100 group">
                        <img src={form.cover_url} alt="Cover" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, cover_url: "" })}
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                        >
                          <X className="w-5 h-5 text-white" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <ImageUpload
                      label="Copertina"
                      onImageUploaded={(url) => setForm({ ...form, cover_url: url })}
                    />
                  )}
                </div>

                {/* Extra images */}
                <div>
                  <ImageUpload
                    label="Immagini aggiuntive"
                    multiple
                    onImageUploaded={(url) => addExtraImage(url)}
                  />
                  {extraImages.length > 0 && (
                    <div className="flex gap-3 flex-wrap mt-3">
                      {extraImages.map((url, i) => (
                        <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden bg-zinc-100 group">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeExtraImage(i)}
                            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                          >
                            <X className="w-5 h-5 text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-6">
                  <input
                    type="checkbox"
                    id="available"
                    checked={form.available}
                    onChange={(e) => setForm({ ...form, available: e.target.checked })}
                    className="w-4 h-4 text-amber-400 rounded"
                  />
                  <label htmlFor="available" className="text-sm text-zinc-700">Disponibile per la vendita</label>

                  <input
                    type="checkbox"
                    id="is_signed"
                    checked={form.is_signed}
                    onChange={(e) => setForm({ ...form, is_signed: e.target.checked })}
                    className="w-4 h-4 text-amber-400 rounded"
                  />
                  <label htmlFor="is_signed" className="text-sm text-zinc-700">Vinile autografato</label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-500 disabled:bg-zinc-300 text-zinc-900 font-semibold py-4 rounded-xl transition-colors"
                  >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {editingId ? "Aggiorna" : "Aggiungi"}
                  </button>
                  <button type="button" onClick={closeForm} className="px-6 py-4 border border-zinc-200 rounded-xl text-zinc-600 hover:bg-zinc-50 transition-colors">
                    Annulla
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Vinyl list — solo disponibili */}
        {tab === "vinyls" && (loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          </div>
        ) : vinyls.filter((v) => v.available).length === 0 ? (
          <div className="text-center py-20">
            <p className="text-zinc-400 text-lg mb-4">Nessun vinile in vendita</p>
            <button onClick={openNew} className="text-amber-600 hover:text-amber-700 font-medium">
              Aggiungi il primo vinile
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-4 md:hidden">
              {vinyls.filter((v) => v.available).map((vinyl) => (
                <div key={vinyl.id} className="bg-white rounded-2xl shadow-sm p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-zinc-100 flex-shrink-0">
                      {vinyl.cover_url ? (
                        <img src={vinyl.cover_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-300 text-xs">N/A</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-zinc-900 truncate">{vinyl.title}</p>
                          <p className="text-sm text-zinc-500 truncate">{vinyl.artist}</p>
                        </div>
                        <span className="font-semibold text-zinc-900 whitespace-nowrap">€{Number(vinyl.price).toFixed(2)}</span>
                      </div>
                      {vinyl.is_signed && (
                        <span className="inline-flex mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          AUTOGRAFATO
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                    <div className="rounded-xl bg-zinc-50 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-zinc-400">Genere</p>
                      <p className="text-zinc-700 mt-1 truncate">{vinyl.genres?.name || "—"}</p>
                    </div>
                    <div className="rounded-xl bg-zinc-50 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-zinc-400">Condizione</p>
                      <p className="text-zinc-700 mt-1 truncate">{CONDITION_LABELS[vinyl.condition] || vinyl.condition}</p>
                    </div>
                    <div className="rounded-xl bg-zinc-50 px-3 py-2 col-span-2">
                      <p className="text-[11px] uppercase tracking-wide text-zinc-400">Anno</p>
                      <p className="text-zinc-700 mt-1">{vinyl.release_year || "—"}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <button
                      onClick={() => toggleAvailability(vinyl)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-50 px-3 py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100"
                    >
                      Segna venduto
                    </button>
                    <button
                      onClick={() => openEdit(vinyl)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 px-3 py-3 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
                    >
                      <Pencil className="w-4 h-4" />
                      Modifica
                    </button>
                    <button
                      onClick={() => handleDelete(vinyl.id)}
                      className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      Elimina
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-100">
                    <th className="text-left px-6 py-4 text-sm font-semibold text-zinc-600">Vinile</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-zinc-600 hidden md:table-cell">Genere</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-zinc-600 hidden sm:table-cell">Condizione</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-zinc-600 hidden lg:table-cell">Anno</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-zinc-600">Prezzo</th>
                    <th className="text-right px-6 py-4 text-sm font-semibold text-zinc-600">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {vinyls.filter((v) => v.available).map((vinyl) => (
                    <tr key={vinyl.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-zinc-100 flex-shrink-0">
                            {vinyl.cover_url ? (
                              <img src={vinyl.cover_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-300 text-xs">N/A</div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-zinc-900 truncate">{vinyl.title}</p>
                            <p className="text-sm text-zinc-500 truncate">{vinyl.artist}</p>
                            {vinyl.is_signed && (
                              <span className="inline-flex mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                AUTOGRAFATO
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <span className="text-sm text-zinc-600">{vinyl.genres?.name || "—"}</span>
                      </td>
                      <td className="px-6 py-4 hidden sm:table-cell">
                        <span className="text-sm text-zinc-600">{CONDITION_LABELS[vinyl.condition] || vinyl.condition}</span>
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell">
                        <span className="text-sm text-zinc-500">{vinyl.release_year || "—"}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium text-zinc-900">€{Number(vinyl.price).toFixed(2)}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => toggleAvailability(vinyl)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors bg-red-50 text-red-600 hover:bg-red-100"
                          >
                            Segna venduto
                          </button>
                          <button onClick={() => openEdit(vinyl)} className="text-zinc-400 hover:text-amber-600 transition-colors p-1">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(vinyl.id)} className="text-zinc-400 hover:text-red-500 transition-colors p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
          </>
        ))}

        {/* ===== TAB: VENDUTI ===== */}
        {tab === "sold" && (loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          </div>
        ) : vinyls.filter((v) => !v.available).length === 0 ? (
          <div className="text-center py-20">
            <PackageCheck className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
            <p className="text-zinc-400 text-lg">Nessun vinile venduto</p>
            <p className="text-zinc-400 text-sm mt-1">I vinili segnati come venduti appariranno qui</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4 md:mb-0">
              <div className="px-6 py-4 bg-zinc-50 border-b border-zinc-100">
              <p className="text-sm text-zinc-500">
                Se un vinile ti è stato restituito, clicca <strong className="text-green-700">Rimetti in vendita</strong> per riportarlo nel catalogo.
              </p>
            </div>
            <div className="space-y-4 p-4 md:hidden">
              {vinyls.filter((v) => !v.available).map((vinyl) => (
                <div key={vinyl.id} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-zinc-200 flex-shrink-0 opacity-70">
                      {vinyl.cover_url ? (
                        <img src={vinyl.cover_url} alt="" className="w-full h-full object-cover grayscale" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-400 text-xs">N/A</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-zinc-700 truncate">{vinyl.title}</p>
                          <p className="text-sm text-zinc-400 truncate">{vinyl.artist}</p>
                        </div>
                        <span className="font-semibold text-zinc-500 whitespace-nowrap">€{Number(vinyl.price).toFixed(2)}</span>
                      </div>
                      {vinyl.is_signed && (
                        <span className="inline-flex mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          AUTOGRAFATO
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                    <div className="rounded-xl bg-white px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-zinc-400">Genere</p>
                      <p className="text-zinc-600 mt-1 truncate">{vinyl.genres?.name || "—"}</p>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-zinc-400">Condizione</p>
                      <p className="text-zinc-600 mt-1 truncate">{CONDITION_LABELS[vinyl.condition] || vinyl.condition}</p>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2 col-span-2">
                      <p className="text-[11px] uppercase tracking-wide text-zinc-400">Venduto il</p>
                      <p className="text-zinc-600 mt-1">
                        {vinyl.updated_at
                          ? new Date(vinyl.updated_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })
                          : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 mt-4">
                    <button
                      onClick={() => toggleAvailability(vinyl)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-50 px-3 py-3 text-sm font-semibold text-green-700 transition-colors hover:bg-green-100"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Rimetti in vendita
                    </button>
                    <button
                      onClick={() => handleDelete(vinyl.id)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      Elimina definitivamente
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-100">
                    <th className="text-left px-6 py-4 text-sm font-semibold text-zinc-600">Vinile</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-zinc-600 hidden md:table-cell">Genere</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-zinc-600 hidden sm:table-cell">Condizione</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-zinc-600">Prezzo</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-zinc-600 hidden lg:table-cell">Venduto il</th>
                    <th className="text-right px-6 py-4 text-sm font-semibold text-zinc-600">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {vinyls.filter((v) => !v.available).map((vinyl) => (
                    <tr key={vinyl.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-zinc-100 flex-shrink-0 opacity-70">
                            {vinyl.cover_url ? (
                              <img src={vinyl.cover_url} alt="" className="w-full h-full object-cover grayscale" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-300 text-xs">N/A</div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-zinc-700 truncate">{vinyl.title}</p>
                            <p className="text-sm text-zinc-400 truncate">{vinyl.artist}</p>
                            {vinyl.is_signed && (
                              <span className="inline-flex mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                AUTOGRAFATO
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <span className="text-sm text-zinc-500">{vinyl.genres?.name || "—"}</span>
                      </td>
                      <td className="px-6 py-4 hidden sm:table-cell">
                        <span className="text-sm text-zinc-500">{CONDITION_LABELS[vinyl.condition] || vinyl.condition}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium text-zinc-500">€{Number(vinyl.price).toFixed(2)}</span>
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell">
                        <span className="text-sm text-zinc-400">
                          {vinyl.updated_at
                            ? new Date(vinyl.updated_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })
                            : "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => toggleAvailability(vinyl)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors bg-green-50 text-green-700 hover:bg-green-100"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Rimetti in vendita
                          </button>
                          <button onClick={() => handleDelete(vinyl.id)} className="text-zinc-400 hover:text-red-500 transition-colors p-1" title="Elimina definitivamente">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
          </>
        ))}

        {/* ===== TAB: ORDINI ===== */}
        {tab === "orders" && (
          <>
            {orders.length === 0 ? (
              <div className="text-center py-20">
                <ShoppingBag className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                <p className="text-zinc-400 text-lg">Nessun ordine ricevuto</p>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <div key={order.id} className="bg-white rounded-2xl shadow-sm p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-bold text-zinc-900">#{order.id.substring(0, 8).toUpperCase()}</span>
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${ORDER_STATUS_COLORS[order.status] || "bg-zinc-100 text-zinc-600"}`}>
                            {ORDER_STATUS_LABELS[order.status] || order.status}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-500">
                          {new Date(order.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xl font-bold text-zinc-900">€{Number(order.total).toFixed(2)}</span>
                        <select
                          value={order.status}
                          onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                          className="text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-400 focus:outline-none"
                        >
                          {Object.entries(ORDER_STATUS_LABELS).map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 bg-zinc-50 rounded-xl p-4">
                      <div>
                        <p className="text-xs text-zinc-400 mb-0.5">Cliente</p>
                        <p className="text-sm font-medium text-zinc-800">{order.customer_name || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400 mb-0.5">Email</p>
                        <a href={`mailto:${order.customer_email}`} className="text-sm font-medium text-amber-600 hover:text-amber-700">
                          {order.customer_email || "—"}
                        </a>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {order.order_items.map((item, i) => (
                        <div key={i} className="flex justify-between items-center text-sm py-2 border-b border-zinc-50 last:border-0">
                          <div>
                            <span className="font-medium text-zinc-800">{item.vinyls?.title || "Vinile rimosso"}</span>
                            <span className="text-zinc-500 ml-2">{item.vinyls?.artist}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-zinc-500 mr-3">×{item.quantity}</span>
                            <span className="font-medium text-zinc-900">€{(item.price_at_purchase * item.quantity).toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "radar" && (
          <>
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    Radar Opportunita Vinili Italia
                  </h2>
                  <p className="text-sm text-zinc-500 mt-1">
                    Classifica automatica nuove uscite e possibili rarita per aiutarti negli acquisti di rivendita.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <select
                    value={radarGenre}
                    onChange={(e) => setRadarGenre(e.target.value)}
                    className="px-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  >
                    <option value="rock">Rock</option>
                    <option value="pop">Pop Italiano</option>
                    <option value="jazz">Jazz</option>
                    <option value="hiphop">Hip Hop / Rap</option>
                    <option value="elettronica">Elettronica</option>
                    <option value="colonne">Colonne Sonore</option>
                  </select>
                  <input
                    type="text"
                    value={radarArtistInput}
                    onChange={(e) => setRadarArtistInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyRadarArtistFilter();
                      }
                    }}
                    placeholder="Filtra per artista (es. Mina, Calibro 35)"
                    className="px-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none w-full sm:w-72"
                  />
                  <button
                    onClick={applyRadarArtistFilter}
                    className="inline-flex items-center justify-center gap-2 border border-zinc-200 hover:bg-zinc-50 text-zinc-700 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                  >
                    Cerca artista
                  </button>
                  <button
                    onClick={() => void fetchMarketRadar(1, false)}
                    disabled={radarLoading}
                    className="inline-flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                  >
                    {radarLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
                    Aggiorna ricerca
                  </button>
                </div>
              </div>
            </div>

            {radarError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-5 text-sm">
                {radarError}
              </div>
            )}

            {radarLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
              </div>
            ) : radarItems.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl shadow-sm">
                <p className="text-zinc-500">Nessun risultato disponibile per questa categoria.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-zinc-500">
                  {radarTotal > 0 ? `Risultati trovati: ${radarTotal}` : "Nessun risultato"}
                  {radarArtistFilter ? ` • filtro artista: ${radarArtistFilter}` : ""}
                </p>
                {radarItems.map((item) => (
                  <div key={item.id} className="bg-white rounded-2xl shadow-sm p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-zinc-900 truncate">{item.title}</p>
                        <p className="text-sm text-zinc-500 truncate">{item.artist}</p>
                        <div className="flex flex-wrap gap-2 mt-2 text-xs text-zinc-500">
                          <span className="bg-zinc-100 px-2 py-1 rounded-full">Data: {item.releaseDate || "N/D"}</span>
                          <span className="bg-zinc-100 px-2 py-1 rounded-full">Paese: {item.country}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${radarBadgeClass(item.opportunityScore)}`}>
                          Score {item.opportunityScore}/100
                        </span>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${item.recommendation === "Alta" ? "bg-green-100 text-green-700" : item.recommendation === "Media" ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-600"}`}>
                          Priorita {item.recommendation}
                        </span>
                      </div>
                    </div>

                    {item.raritySignals.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.raritySignals.map((signal) => (
                          <span key={signal} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-full">
                            {signal}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-zinc-400">Nessun segnale forte di rarita nel titolo/edizione.</p>
                    )}

                    <a
                      href={`https://musicbrainz.org/release/${item.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-800 font-semibold mt-3"
                    >
                      Apri fonte release
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ))}
                {radarHasMore && (
                  <div className="pt-2">
                    <button
                      onClick={() => void fetchMarketRadar(radarPage + 1, true)}
                      disabled={radarLoadingMore}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-500 disabled:bg-zinc-300 text-zinc-900 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                    >
                      {radarLoadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Carica altri risultati
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
