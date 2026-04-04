"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Genre, Vinyl, CONDITIONS, formatCondition, getConditionLabel, getConditionQuality, isConditionSealed } from "@/lib/types";
import { Plus, Pencil, Trash2, Loader2, X, Save, LogOut, ShoppingBag, Disc3, RotateCcw, PackageCheck, Radar, Sparkles, ExternalLink, Bell, Check } from "lucide-react";
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
  is_sealed: boolean;
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
  is_sealed: false,
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

const WATCHED_ARTISTS_PAGE_SIZE = 20;

export default function AdminPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [tab, setTab] = useState<"vinyls" | "sold" | "orders" | "radar" | "alerts">("vinyls");
  const [vinyls, setVinyls] = useState<Vinyl[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [radarItems, setRadarItems] = useState<any[]>([]);
  const [radarArtistInput, setRadarArtistInput] = useState("");
  const [radarArtistFilter, setRadarArtistFilter] = useState("");
  const [radarAlbumInput, setRadarAlbumInput] = useState("");
  const [radarGenreInput, setRadarGenreInput] = useState("");
  const [radarIncludePreorders, setRadarIncludePreorders] = useState(true);
  const [radarPreorderOnly, setRadarPreorderOnly] = useState(false);
  const [radarMinRarity, setRadarMinRarity] = useState(0);
  const [radarLoading, setRadarLoading] = useState(false);
  const [radarLoadingMore, setRadarLoadingMore] = useState(false);
  const [radarError, setRadarError] = useState("");
  const [radarAutoFetched, setRadarAutoFetched] = useState(false);
  const [radarPage, setRadarPage] = useState(1);
  const [radarHasMore, setRadarHasMore] = useState(false);
  const [radarTotal, setRadarTotal] = useState(0);
  const [radarNarrative, setRadarNarrative] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VinylForm>(emptyForm);
  const [extraImages, setExtraImages] = useState<string[]>([]);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [formError, setFormError] = useState("");

  // Alert states
  const [watchedArtists, setWatchedArtists] = useState<any[]>([]);
  const [albumAlerts, setAlbumAlerts] = useState<any[]>([]);
  const [newArtistInput, setNewArtistInput] = useState("");
  const [newArtistGenre, setNewArtistGenre] = useState("Pop");
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState("");
  const [alertsNotice, setAlertsNotice] = useState("");
  const [monitoringInProgress, setMonitoringInProgress] = useState(false);
  const [alertsViewTab, setAlertsViewTab] = useState<"configured" | "received">("configured");
  const [watchedArtistsSearch, setWatchedArtistsSearch] = useState("");
  const [watchedArtistsPage, setWatchedArtistsPage] = useState(1);

  function parseUnknownError(err: unknown): string {
    if (err instanceof Error) return err.message;

    if (typeof err === "string") return err;

    if (err && typeof err === "object") {
      const obj = err as Record<string, unknown>;
      const message = typeof obj.message === "string" ? obj.message : "";
      const details = typeof obj.details === "string" ? obj.details : "";
      const hint = typeof obj.hint === "string" ? obj.hint : "";
      const code = typeof obj.code === "string" ? obj.code : "";

      const composed = [message, details, hint, code ? `code: ${code}` : ""]
        .filter(Boolean)
        .join(" | ");

      if (composed) return composed;

      try {
        return JSON.stringify(obj);
      } catch {
        return "Errore sconosciuto";
      }
    }

    return "Errore sconosciuto";
  }

  function toAlertErrorMessage(err: unknown, fallback: string): string {
    const msg = parseUnknownError(err) || fallback;
    const lower = msg.toLowerCase();

    if (lower.includes("pgrst205") || lower.includes("42p01")) {
      return "Tabelle alert non trovate nel database. Esegui il bootstrap SQL per watched_artists e album_alerts.";
    }

    if (lower.includes("could not find the table") || lower.includes("schema cache")) {
      return "Tabelle alert non trovate nel database. Esegui il bootstrap SQL per watched_artists e album_alerts.";
    }

    if (lower.includes("jwt") || lower.includes("not authorized") || lower.includes("non autorizzato")) {
      return "Sessione admin non valida. Ricarica la pagina e accedi di nuovo.";
    }

    return msg || fallback;
  }

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

  async function getAdminToken(): Promise<string> {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
      throw new Error("Sessione admin non valida. Ricarica la pagina e rifai login.");
    }
    return token;
  }

  async function fetchAlertData() {
    setAlertsLoading(true);
    setAlertsError("");
    setAlertsNotice("");
    try {
      const token = await getAdminToken();
      const res = await fetch("/api/admin/alerts", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw payload;
      }

      setWatchedArtists(payload.watchedArtists || []);
      setAlbumAlerts(payload.albumAlerts || []);
      if (payload.setupRequired && payload.warning) {
        setAlertsNotice(String(payload.warning));
      }
    } catch (err) {
      setAlertsError(toAlertErrorMessage(err, "Errore caricamento alert"));
    } finally {
      setAlertsLoading(false);
    }
  }

  async function addWatchedArtist() {
    if (!newArtistInput.trim()) {
      showMessage("error", "Inserisci il nome dell'artista");
      return;
    }

    try {
      const token = await getAdminToken();
      const response = await fetch("/api/admin/alerts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "addArtist",
          artistName: newArtistInput.trim(),
          genre: newArtistGenre || null,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) throw payload;

      showMessage("success", `${newArtistInput} aggiunto ai monitorati`);
      setNewArtistInput("");
      setNewArtistGenre("Pop");
      await fetchAlertData();
    } catch (err) {
      showMessage("error", toAlertErrorMessage(err, "Errore aggiunta artista"));
    }
  }

  async function removeWatchedArtist(id: string) {
    try {
      const token = await getAdminToken();
      const response = await fetch("/api/admin/alerts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "removeArtist", artistId: id }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) throw payload;

      showMessage("success", "Artista rimosso da monitorati");
      await fetchAlertData();
    } catch (err) {
      showMessage("error", toAlertErrorMessage(err, "Errore rimozione artista"));
    }
  }

  async function updateAlertStatus(alertId: string, status: "viewed" | "purchased" | "dismissed") {
    try {
      const token = await getAdminToken();
      const response = await fetch("/api/admin/alerts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "updateAlertStatus", alertId, status }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) throw payload;

      await fetchAlertData();
    } catch (err) {
      showMessage("error", toAlertErrorMessage(err, "Errore aggiornamento alert"));
    }
  }

  async function triggerMonitoring() {
    setMonitoringInProgress(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        throw new Error("Sessione non valida. Ricarica la pagina.");
      }

      const response = await fetch("/api/admin/album-monitor", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Errore monitoraggio");
      }

      showMessage(
        "success",
        `Monitoraggio completato. ${data.newAlerts} nuovi album trovati.`
      );
      await fetchAlertData();
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Errore monitoraggio");
    } finally {
      setMonitoringInProgress(false);
    }
  }

  const fetchDiscogsRadar = useCallback(async (page = 1, append = false) => {
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

      const effectiveArtist = (radarArtistFilter.trim() || radarArtistInput.trim()).trim();
      const effectiveAlbum = radarAlbumInput.trim();

      if (!effectiveArtist && !effectiveAlbum) {
        throw new Error("Inserisci almeno artista o album");
      }

      if (effectiveArtist !== radarArtistFilter) {
        setRadarArtistFilter(effectiveArtist);
      }

      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });

      if (effectiveArtist) {
        params.set("artist", effectiveArtist);
      }

      if (effectiveAlbum) {
        params.set("album", effectiveAlbum);
      }
      if (radarGenreInput.trim()) {
        params.set("genre", radarGenreInput.trim());
      }
      params.set("includePreorders", radarIncludePreorders ? "1" : "0");
      params.set("preorderOnly", radarPreorderOnly ? "1" : "0");
      if (radarMinRarity > 0) {
        params.set("minRarity", String(radarMinRarity));
      }

      const res = await fetch(`/api/admin/discogs-radar?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Errore caricamento Discogs");
      }

      const incomingItems = payload.items || [];
      setRadarItems((prev) => (append ? [...prev, ...incomingItems] : incomingItems));
      setRadarPage(payload.page || page);
      setRadarHasMore(Boolean(payload.hasMore));
      setRadarTotal(payload.total || 0);
      if (!append) {
        setRadarNarrative(payload.rankingNarrative || null);
      }
    } catch (error) {
      setRadarError(error instanceof Error ? error.message : "Errore caricamento Discogs");
      if (!append) {
        setRadarItems([]);
        setRadarNarrative(null);
      }
      setRadarHasMore(false);
    } finally {
      setRadarAutoFetched(true);
      setRadarLoading(false);
      setRadarLoadingMore(false);
    }
  }, [radarArtistFilter, radarArtistInput, radarAlbumInput, radarGenreInput, radarIncludePreorders, radarPreorderOnly, radarMinRarity]);

  useEffect(() => {
    if (!user) return;

    const timer = setTimeout(() => {
      void fetchData();
      void fetchOrders();
    }, 0);

    return () => clearTimeout(timer);
  }, [user]);

  useEffect(() => {
    if (tab === "alerts") {
      void fetchAlertData();
    }
  }, [tab]);

  const filteredWatchedArtists = watchedArtists.filter((artist) => {
    const normalizedSearch = watchedArtistsSearch.trim().toLowerCase();
    if (!normalizedSearch) return true;

    return String(artist.artist_name || "").toLowerCase().includes(normalizedSearch);
  });

  const watchedArtistsTotalPages = Math.max(
    1,
    Math.ceil(filteredWatchedArtists.length / WATCHED_ARTISTS_PAGE_SIZE)
  );
  const watchedArtistsCurrentPage = Math.min(watchedArtistsPage, watchedArtistsTotalPages);
  const watchedArtistsStartIndex = (watchedArtistsCurrentPage - 1) * WATCHED_ARTISTS_PAGE_SIZE;
  const paginatedWatchedArtists = filteredWatchedArtists.slice(
    watchedArtistsStartIndex,
    watchedArtistsStartIndex + WATCHED_ARTISTS_PAGE_SIZE
  );
  const watchedArtistsPageNumbers = Array.from(
    { length: watchedArtistsTotalPages },
    (_, index) => index + 1
  ).filter((pageNumber) => Math.abs(pageNumber - watchedArtistsCurrentPage) <= 2);

  useEffect(() => {
    if (watchedArtistsPage > watchedArtistsTotalPages) {
      setWatchedArtistsPage(watchedArtistsTotalPages);
    }
  }, [watchedArtistsPage, watchedArtistsTotalPages]);

  function applyRadarSearch() {
    setRadarArtistFilter(radarArtistInput.trim());
    setRadarAutoFetched(false);
    void fetchDiscogsRadar(1, false);
  }

  function radarRarityBadge(rarity: string): string {
    switch (rarity) {
      case "Collectible":
        return "bg-red-100 text-red-700";
      case "Very Rare":
        return "bg-orange-100 text-orange-700";
      case "Rare":
        return "bg-amber-100 text-amber-700";
      case "Uncommon":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-zinc-100 text-zinc-600";
    }
  }

  function radarRarityLabel(rarity: string): string {
    switch (rarity) {
      case "Collectible":
        return "Da Collezione";
      case "Very Rare":
        return "Molto Raro";
      case "Rare":
        return "Raro";
      case "Uncommon":
        return "Non Comune";
      default:
        return "Comune";
    }
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
    setFormError("");
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(vinyl: Vinyl) {
    setForm({
      title: vinyl.title,
      artist: vinyl.artist,
      description: vinyl.description || "",
      price: String(vinyl.price),
      condition: getConditionQuality(vinyl.condition),
      genre_id: vinyl.genre_id || "",
      cover_url: vinyl.cover_url || "",
      available: vinyl.available,
      is_signed: vinyl.is_signed || false,
      is_sealed: isConditionSealed(vinyl.condition, vinyl.is_sealed),
      release_year: vinyl.release_year ? String(vinyl.release_year) : "",
    });
    setExtraImages(vinyl.vinyl_images?.sort((a, b) => a.sort_order - b.sort_order).map((i) => i.image_url) || []);
    setFormError("");
    setEditingId(vinyl.id);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setExtraImages([]);
    setFormError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.artist || !form.price) {
      const errorText = "Titolo, artista e prezzo sono obbligatori";
      setFormError(errorText);
      showMessage("error", errorText);
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const baseVinylData = {
      title: form.title.trim(),
      artist: form.artist.trim(),
      description: form.description.trim() || null,
      price: parseFloat(form.price),
      genre_id: form.genre_id || null,
      cover_url: form.cover_url.trim() || null,
      available: form.available,
      is_signed: form.is_signed,
      release_year: form.release_year ? parseInt(form.release_year) : null,
      updated_at: new Date().toISOString(),
      };

      const vinylDataWithSeparatedSealed = {
      ...baseVinylData,
      condition: form.condition,
      is_sealed: form.is_sealed,
      };

      const { release_year: _dropReleaseYear, ...baseVinylDataNoReleaseYear } = baseVinylData;

      const vinylDataWithSeparatedSealedNoReleaseYear = {
        ...baseVinylDataNoReleaseYear,
        condition: form.condition,
        is_sealed: form.is_sealed,
      };

      const vinylDataLegacy = {
      ...baseVinylData,
      condition: formatCondition(form.condition, form.is_sealed),
      };

      const vinylDataLegacyNoReleaseYear = {
        ...baseVinylDataNoReleaseYear,
        condition: formatCondition(form.condition, form.is_sealed),
      };

      if (editingId) {
      // Update
        let { error } = await supabase.from("vinyls").update(vinylDataWithSeparatedSealed).eq("id", editingId);

        if (error) {
          const updateFallbackPayloads = [
            vinylDataLegacy,
            vinylDataWithSeparatedSealedNoReleaseYear,
            vinylDataLegacyNoReleaseYear,
          ];

          for (const payload of updateFallbackPayloads) {
            const retry = await supabase.from("vinyls").update(payload).eq("id", editingId);
            if (!retry.error) {
              error = null;
              break;
            }
            error = retry.error;
          }
        }

        if (error) {
          const errorText = "Errore aggiornamento: " + error.message;
          setFormError(errorText);
          showMessage("error", errorText);
          return;
        }
        try {
          await syncVinylImages(editingId, extraImages);
        } catch (imageError) {
          try {
            await syncVinylImagesFallback(editingId, extraImages);
          } catch (fallbackError) {
            const errorText =
              "Errore aggiornamento foto: " +
              `${parseUnknownError(imageError)} | fallback: ${parseUnknownError(fallbackError)}`;
            setFormError(errorText);
            showMessage("error", errorText);
            return;
          }
        }
        showMessage("success", "Vinile aggiornato!");
      } else {
      // Insert
        let insertRes = await supabase.from("vinyls").insert(vinylDataWithSeparatedSealed).select().single();

        if (insertRes.error) {
          const insertFallbackPayloads = [
            vinylDataLegacy,
            vinylDataWithSeparatedSealedNoReleaseYear,
            vinylDataLegacyNoReleaseYear,
          ];

          for (const payload of insertFallbackPayloads) {
            const retry = await supabase.from("vinyls").insert(payload).select().single();
            insertRes = retry;
            if (!retry.error) {
              break;
            }
          }
        }

        const data = insertRes.data;
        const error = insertRes.error;

        if (error || !data) {
          const errorText = "Errore inserimento: " + (error?.message || "Errore sconosciuto");
          setFormError(errorText);
          showMessage("error", errorText);
          return;
        }
        try {
          await syncVinylImages(data.id, extraImages);
        } catch (imageError) {
          try {
            await syncVinylImagesFallback(data.id, extraImages);
          } catch (fallbackError) {
            const errorText =
              "Errore salvataggio foto: " +
              `${parseUnknownError(imageError)} | fallback: ${parseUnknownError(fallbackError)}`;
            setFormError(errorText);
            showMessage("error", errorText);
            return;
          }
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
                    is_sealed: form.is_sealed,
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
      fetchData();
    } catch (err) {
      const errorText = "Errore imprevisto: " + parseUnknownError(err);
      setFormError(errorText);
      showMessage("error", errorText);
    } finally {
      setSaving(false);
    }
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

  async function syncVinylImages(vinylId: string, images: string[]) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    if (!token) {
      throw new Error("Sessione admin non valida");
    }

    const response = await fetch("/api/admin/vinyl-images/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ vinylId, images }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || "Errore sincronizzazione immagini");
    }
  }

  async function syncVinylImagesFallback(vinylId: string, images: string[]) {
    const { error: deleteError } = await supabase.from("vinyl_images").delete().eq("vinyl_id", vinylId);
    if (deleteError) {
      throw deleteError;
    }

    const normalized = images.map((img) => img.trim()).filter(Boolean);
    if (normalized.length === 0) return;

    const { error: insertError } = await supabase.from("vinyl_images").insert(
      normalized.map((url, i) => ({ vinyl_id: vinylId, image_url: url, sort_order: i }))
    );

    if (insertError) {
      throw insertError;
    }
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
          <button
            onClick={() => setTab("alerts")}
            className={`col-span-2 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-colors sm:col-span-1 ${
              tab === "alerts" ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            <Bell className="w-4 h-4" />
            Alert Album
            {!alertsLoading && albumAlerts.filter((a) => a.status === "new").length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                tab === "alerts" ? "bg-red-500/30 text-red-200" : "bg-red-100 text-red-700"
              }`}>
                {albumAlerts.filter((a) => a.status === "new").length}
              </span>
            )}
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
                        <option key={c} value={c}>{getConditionLabel(c)}</option>
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

                  <input
                    type="checkbox"
                    id="is_sealed"
                    checked={form.is_sealed}
                    onChange={(e) => setForm({ ...form, is_sealed: e.target.checked })}
                    className="w-4 h-4 text-amber-400 rounded"
                  />
                  <label htmlFor="is_sealed" className="text-sm text-zinc-700">Vinile sigillato</label>
                </div>

                <div className="flex gap-3 pt-4">
                  {formError && (
                    <div className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {formError}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
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
                      {isConditionSealed(vinyl.condition, vinyl.is_sealed) && (
                        <span className="inline-flex mt-2 ml-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          SIGILLATO
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
                      <p className="text-zinc-700 mt-1 truncate">{getConditionLabel(vinyl.condition, vinyl.is_sealed)}</p>
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
                            {isConditionSealed(vinyl.condition, vinyl.is_sealed) && (
                              <span className="inline-flex mt-1 ml-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                SIGILLATO
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <span className="text-sm text-zinc-600">{vinyl.genres?.name || "—"}</span>
                      </td>
                      <td className="px-6 py-4 hidden sm:table-cell">
                        <span className="text-sm text-zinc-600">{getConditionLabel(vinyl.condition, vinyl.is_sealed)}</span>
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
                      {isConditionSealed(vinyl.condition, vinyl.is_sealed) && (
                        <span className="inline-flex mt-2 ml-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          SIGILLATO
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
                      <p className="text-zinc-600 mt-1 truncate">{getConditionLabel(vinyl.condition, vinyl.is_sealed)}</p>
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
                            {isConditionSealed(vinyl.condition, vinyl.is_sealed) && (
                              <span className="inline-flex mt-1 ml-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                SIGILLATO
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <span className="text-sm text-zinc-500">{vinyl.genres?.name || "—"}</span>
                      </td>
                      <td className="px-6 py-4 hidden sm:table-cell">
                        <span className="text-sm text-zinc-500">{getConditionLabel(vinyl.condition, vinyl.is_sealed)}</span>
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
            <div className="bg-zinc-50 rounded-2xl mb-5">
              <div className="bg-white rounded-2xl shadow-sm p-5">
                {/* Header */}
                <div className="mb-5">
                  <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    Discogs Vinyl Rarity Radar
                  </h2>
                  <p className="text-sm text-zinc-500 mt-1">
                    Scopri edizioni rare, varianti colorate e vinili collezionabili su Discogs
                  </p>
                </div>

                {/* RICERCA Section */}
                <div className="mb-5 pb-5 border-b border-zinc-200">
                  <p className="text-xs font-semibold uppercase text-zinc-600 mb-3 tracking-wide">Ricerca</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={radarArtistInput}
                      onChange={(e) => setRadarArtistInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          applyRadarSearch();
                        }
                      }}
                      placeholder="Artista *"
                      className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none"
                      required
                    />
                    <input
                      type="text"
                      value={radarAlbumInput}
                      onChange={(e) => setRadarAlbumInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          applyRadarSearch();
                        }
                      }}
                      placeholder="Album (opzionale)"
                      className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={radarGenreInput}
                      onChange={(e) => setRadarGenreInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          applyRadarSearch();
                        }
                      }}
                      placeholder="Genere (opzionale, es. rap, pop, jazz)"
                      className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* FILTRI Section */}
                <div className="mb-5">
                  <p className="text-xs font-semibold uppercase text-zinc-600 mb-3 tracking-wide">Filtri</p>
                  <div className="flex flex-col gap-4">
                    <label className="flex items-center gap-2 text-sm text-zinc-700">
                      <input
                        type="checkbox"
                        checked={radarIncludePreorders}
                        onChange={(e) => setRadarIncludePreorders(e.target.checked)}
                        className="w-4 h-4 rounded border-zinc-300 text-amber-500 focus:ring-amber-400"
                      />
                      Includi pre-order da web (store/news)
                    </label>
                    <label className="flex items-center gap-2 text-sm text-zinc-700">
                      <input
                        type="checkbox"
                        checked={radarPreorderOnly}
                        onChange={(e) => setRadarPreorderOnly(e.target.checked)}
                        className="w-4 h-4 rounded border-zinc-300 text-amber-500 focus:ring-amber-400"
                      />
                      Mostra solo pre-order rari
                    </label>
                    <div>
                      <label className="text-sm font-medium text-zinc-700 block mb-2">
                        Rarità minima: {radarMinRarity > 0 ? radarMinRarity : "Qualsiasi"}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={radarMinRarity}
                        onChange={(e) => setRadarMinRarity(Number(e.target.value))}
                        className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                      <div className="flex justify-between text-xs text-zinc-500 mt-1">
                        <span>Comune (0)</span>
                        <span>Raro (50)</span>
                        <span>Da Collezione (100)</span>
                      </div>
                    </div>
                    <button
                      onClick={applyRadarSearch}
                      disabled={radarLoading || (!radarArtistInput.trim() && !radarAlbumInput.trim())}
                      className="w-full inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-300 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                    >
                      {radarLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
                      Cerca su Discogs
                    </button>
                  </div>
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
                <p className="text-zinc-500">Nessun risultato su Discogs per questa ricerca.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {radarNarrative?.items?.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-5 border border-amber-100">
                    <h3 className="text-base font-bold text-zinc-900">{radarNarrative.label}</h3>
                    <p className="text-xs text-zinc-500 mt-1">{radarNarrative.intro}</p>
                    <div className="mt-3 space-y-2">
                      {radarNarrative.items.map((entry: any) => (
                        <div key={`${entry.rank}-${entry.title}`} className="rounded-xl border border-zinc-200 p-3 bg-zinc-50">
                          <p className="text-sm font-semibold text-zinc-900">
                            {entry.rank}. {entry.title}
                          </p>
                          <p className="text-xs text-zinc-700 mt-1">{entry.whyRare}</p>
                          <p className="text-xs text-zinc-500 mt-1">{entry.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-xs text-zinc-500">
                  {radarTotal > 0 ? `Risultati trovati: ${radarTotal}` : "Nessun risultato"}
                  {radarArtistFilter ? ` • artista: ${radarArtistFilter}` : ""}
                  {radarAlbumInput ? ` • album: ${radarAlbumInput}` : ""}
                  {radarGenreInput ? ` • genere: ${radarGenreInput}` : ""}
                  {radarIncludePreorders ? " • preorder intel: ON" : " • preorder intel: OFF"}
                  {radarPreorderOnly ? " • solo pre-order rari" : ""}
                  {radarMinRarity > 0 ? ` • rarità >= ${radarMinRarity}` : ""}
                </p>
                {radarItems.map((item) => (
                  <div key={item.id} className="bg-white rounded-2xl shadow-sm p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row gap-4">
                      {/* Image */}
                      {item.images && item.images.length > 0 && (
                        <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-zinc-100">
                          <img
                            src={item.images[0].uri150}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-base font-semibold text-zinc-900 truncate">{item.title}</p>
                            <p className="text-sm text-zinc-500 truncate">{item.artist}</p>
                            {item.releaseYear && (
                              <p className="text-xs text-zinc-500">Anno: {item.releaseYear}</p>
                            )}
                            {item.releaseDate && (
                              <p className="text-xs text-zinc-500">Data: {item.releaseDate}</p>
                            )}
                          </div>
                          <span className={`text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${radarRarityBadge(item.estimated_rarity)}`}>
                            {radarRarityLabel(item.estimated_rarity)}
                          </span>
                        </div>

                        {/* Format & Details */}
                        <div className="flex flex-wrap gap-2 mt-2 text-xs">
                          {item.format && <span className="bg-zinc-100 px-2 py-1 rounded-full">{item.format}</span>}
                          {item.formatDetails.length > 0 && (
                            <span className="bg-zinc-100 px-2 py-1 rounded-full">{item.formatDetails.slice(0, 2).join(", ")}</span>
                          )}
                          {item.country && <span className="bg-zinc-100 px-2 py-1 rounded-full">{item.country}</span>}
                          {item.source && <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full">Fonte: {item.source}</span>}
                          {item.preorder?.isPreorder && <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full">Pre-order</span>}
                          {item.preorder?.store && <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full">Store: {item.preorder.store}</span>}
                          {item.genres.length > 0 && (
                            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full">{item.genres[0]}</span>
                          )}
                          {item.catalogNumber && (
                            <span className="bg-zinc-100 px-2 py-1 rounded-full">Cat: {item.catalogNumber}</span>
                          )}
                        </div>

                        {/* Rarity Signals */}
                        {item.rarity_signals.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {item.rarity_signals.map((signal: any) => (
                              <span
                                key={signal.type}
                                className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full"
                              >
                                ✨ {signal.description}
                              </span>
                            ))}
                          </div>
                        )}

                        {item.rarity_description && (
                          <p className="mt-2 text-xs text-zinc-600 leading-relaxed">{item.rarity_description}</p>
                        )}

                        {/* Scores & Links */}
                        <div className="mt-3 flex items-center gap-2">
                          <span className="text-xs font-semibold text-zinc-700">
                            Rarità: <span className="text-amber-600">{item.rarity_score}/100</span>
                          </span>
                          {item.marketplace?.numForSale !== null && (
                            <span className="text-xs text-zinc-600">In vendita: {item.marketplace.numForSale}</span>
                          )}
                          {item.marketplace?.lowestPrice !== null && (
                            <span className="text-xs text-zinc-600">Prezzo min: {item.marketplace.lowestPrice}</span>
                          )}
                          <a
                            href={item.preorder?.url || item.discogs_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-800 font-semibold ml-auto"
                          >
                            {item.source === "Web Preorder Intel" ? "Apri Store/Fonte" : "Apri Discogs"}
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {radarHasMore && (
                  <div className="pt-2">
                    <button
                      onClick={() => void fetchDiscogsRadar(radarPage + 1, true)}
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

        {/* ===== TAB: ALERT ALBUM ===== */}
        {tab === "alerts" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <div className="inline-flex gap-2 bg-zinc-100 rounded-xl p-1">
                <button
                  onClick={() => setAlertsViewTab("configured")}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                    alertsViewTab === "configured"
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-700 hover:bg-zinc-200"
                  }`}
                >
                  Alert Impostati
                </button>
                <button
                  onClick={() => setAlertsViewTab("received")}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                    alertsViewTab === "received"
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-700 hover:bg-zinc-200"
                  }`}
                >
                  Alert Ricevuti
                </button>
              </div>
            </div>

            {/* Add Artist Section */}
            {alertsViewTab === "configured" && <div className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-amber-500" />
                  Monitora Artisti
                </h2>
                <button
                  onClick={() => void triggerMonitoring()}
                  disabled={monitoringInProgress || watchedArtists.length === 0}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-300 text-white font-semibold rounded-xl text-sm transition-colors"
                >
                  {monitoringInProgress ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
                  Monitora Ora
                </button>
              </div>
              <p className="text-sm text-zinc-500 mb-4">
                Aggiungi artisti italiani per ricevere notifiche quando escono nuovi album in preorder
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={newArtistInput}
                  onChange={(e) => setNewArtistInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void addWatchedArtist();
                    }
                  }}
                  placeholder="Nome artista (es. Blanco, Madame, Geolier)"
                  className="flex-1 px-4 py-3 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:outline-none text-sm"
                />
                <select
                  value={newArtistGenre}
                  onChange={(e) => setNewArtistGenre(e.target.value)}
                  className="px-4 py-3 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:outline-none text-sm"
                >
                  <option value="Pop">Pop</option>
                  <option value="Rap">Rap</option>
                  <option value="Hip Hop">Hip Hop</option>
                  <option value="Rock">Rock</option>
                  <option value="Indie">Indie</option>
                  <option value="Electronic">Electronic</option>
                  <option value="Altro">Altro</option>
                </select>
                <button
                  onClick={() => void addWatchedArtist()}
                  disabled={!newArtistInput.trim() || alertsLoading}
                  className="px-6 py-3 bg-amber-400 hover:bg-amber-500 disabled:bg-zinc-300 text-zinc-900 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Aggiungi
                </button>
              </div>
            </div>}

            {alertsNotice && (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-xl text-sm">
                {alertsNotice}
              </div>
            )}

            {alertsError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {alertsError}
              </div>
            )}

            {/* Watched Artists List */}
            {alertsViewTab === "configured" && <div className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-zinc-900">
                    Artisti Monitorati ({watchedArtists.length})
                  </h3>
                  <p className="text-sm text-zinc-500 mt-1">
                    {filteredWatchedArtists.length === watchedArtists.length
                      ? `Totale artisti monitorati: ${watchedArtists.length}`
                      : `Risultati filtro: ${filteredWatchedArtists.length} su ${watchedArtists.length}`}
                  </p>
                </div>
                <div className="w-full sm:max-w-xs">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1">
                    Cerca artista
                  </label>
                  <input
                    type="text"
                    value={watchedArtistsSearch}
                    onChange={(e) => {
                      setWatchedArtistsSearch(e.target.value);
                      setWatchedArtistsPage(1);
                    }}
                    placeholder="Filtra per nome artista"
                    className="w-full px-4 py-3 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:outline-none text-sm"
                  />
                </div>
              </div>

              {alertsLoading && watchedArtists.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                </div>
              ) : watchedArtists.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-6">
                  Nessun artista monitorato. Aggiungi il primo artista sopra!
                </p>
              ) : filteredWatchedArtists.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-6">
                  Nessun artista trovato per la ricerca inserita.
                </p>
              ) : (
                <div className="space-y-2">
                  {paginatedWatchedArtists.map((artist) => (
                    <div
                      key={artist.id}
                      className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg border border-zinc-100"
                    >
                      <div>
                        <p className="font-medium text-zinc-900">{artist.artist_name}</p>
                        <p className="text-xs text-zinc-500">
                          {artist.genre ? `${artist.genre} • ` : ""}
                          {artist.last_check ? `Ultimo check: ${new Date(artist.last_check).toLocaleDateString("it-IT")}` : "Non sincronizzato"}
                        </p>
                      </div>
                      <button
                        onClick={() => void removeWatchedArtist(artist.id)}
                        className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  <div className="flex flex-col gap-3 border-t border-zinc-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-zinc-500">
                      Visualizzati {filteredWatchedArtists.length === 0 ? 0 : watchedArtistsStartIndex + 1}-
                      {Math.min(
                        watchedArtistsStartIndex + WATCHED_ARTISTS_PAGE_SIZE,
                        filteredWatchedArtists.length
                      )} di {filteredWatchedArtists.length}
                    </p>

                    {watchedArtistsTotalPages > 1 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => setWatchedArtistsPage((page) => Math.max(1, page - 1))}
                          disabled={watchedArtistsCurrentPage === 1}
                          className="px-3 py-2 rounded-lg border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Prec.
                        </button>

                        {watchedArtistsPageNumbers.map((pageNumber) => (
                          <button
                            key={pageNumber}
                            onClick={() => setWatchedArtistsPage(pageNumber)}
                            className={`min-w-10 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                              pageNumber === watchedArtistsCurrentPage
                                ? "bg-zinc-900 text-white"
                                : "border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                            }`}
                          >
                            {pageNumber}
                          </button>
                        ))}

                        <button
                          onClick={() =>
                            setWatchedArtistsPage((page) =>
                              Math.min(watchedArtistsTotalPages, page + 1)
                            )
                          }
                          disabled={watchedArtistsCurrentPage === watchedArtistsTotalPages}
                          className="px-3 py-2 rounded-lg border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Succ.
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>}

            {/* Album Alerts Notification */}
            {alertsViewTab === "received" && <div className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3">
              <p className="text-sm font-semibold text-zinc-800">Qui trovi gli album rilevati dal monitoraggio automatico o manuale.</p>
            </div>}

            {alertsViewTab === "received" && <div className="bg-white rounded-2xl shadow-sm p-5">
              <h3 className="text-base font-semibold text-zinc-900 mb-4 flex items-center gap-2">
                <Bell className="w-4 h-4 text-red-500" />
                Notifiche Album ({albumAlerts.length})
              </h3>

              {alertsLoading && albumAlerts.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                </div>
              ) : albumAlerts.length === 0 ? (
                <div className="text-center py-8">
                  <Bell className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                  <p className="text-sm text-zinc-500">Nessun nuovo album rilevato ancora</p>
                  <p className="text-xs text-zinc-400 mt-1">I nuovi album appariranno qui automaticamente</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {albumAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-4 rounded-xl border-2 ${
                        alert.status === "new"
                          ? "bg-blue-50 border-blue-200"
                          : alert.status === "viewed"
                          ? "bg-zinc-50 border-zinc-200"
                          : alert.status === "purchased"
                          ? "bg-green-50 border-green-200"
                          : "bg-zinc-100 border-zinc-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="font-semibold text-zinc-900">
                            {alert.artist_name} — {alert.album_title}
                          </p>
                          <p className="text-sm text-zinc-600 mt-1">
                            {alert.release_date && `📅 ${alert.release_date}`}
                            {alert.edition_details && (
                              <>
                                <br />
                                <span className="text-xs text-zinc-500">{alert.edition_details}</span>
                              </>
                            )}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                              alert.source === "Feltrinelli"
                                ? "bg-yellow-100 text-yellow-800"
                                : alert.source === "IBS"
                                ? "bg-blue-100 text-blue-800"
                                : alert.source === "Discogs"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-zinc-100 text-zinc-800"
                            }`}>
                              {alert.source}
                            </span>
                            {alert.price_eur && (
                              <span className="text-sm font-medium text-zinc-700">€{Number(alert.price_eur).toFixed(2)}</span>
                            )}
                            {alert.status === "new" && (
                              <span className="text-xs font-bold px-2 py-1 rounded-full bg-red-100 text-red-700">
                                NUOVO
                              </span>
                            )}
                          </div>
                        </div>

                        {alert.retailer_url && (
                          <a
                            href={alert.retailer_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-2 bg-amber-400 hover:bg-amber-500 text-zinc-900 font-semibold rounded-lg text-sm flex items-center gap-1 transition-colors whitespace-nowrap"
                          >
                            Visualizza
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-current border-opacity-20">
                        {alert.status === "new" && (
                          <>
                            <button
                              onClick={() => void updateAlertStatus(alert.id, "viewed")}
                              className="text-xs px-3 py-1.5 rounded-lg bg-white border border-current border-opacity-30 text-zinc-700 hover:bg-zinc-100 transition-colors"
                            >
                              Visto
                            </button>
                            <button
                              onClick={() => void updateAlertStatus(alert.id, "purchased")}
                              className="text-xs px-3 py-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" />
                              Acquistato
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => void updateAlertStatus(alert.id, "dismissed")}
                          className="text-xs px-3 py-1.5 rounded-lg text-zinc-500 hover:text-red-700 transition-colors"
                        >
                          Nascondi
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>}

            {/* Info Alert */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-sm text-amber-900">
                <strong>💡 Come funziona:</strong> Aggiungi gli artisti che vuoi monitorare. Il sistema scansiona automaticamente Feltrinelli, IBS e Discogs ogni giorno a mezzanotte (UTC) per trovare nuovi album in preorder. Riceverai notifiche qui non appena viene rilevato un nuovo album.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
