import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const MONITOR_STATE_ID = "album_monitor_manual";
const MONITOR_STALE_MS = 20 * 60 * 1000;
const SCAN_CONCURRENCY = 10;
const FETCH_TIMEOUT_MS = 7000;

type MonitorStateRow = {
  id: string;
  is_running: boolean;
  started_at: string | null;
  heartbeat_at: string | null;
  finished_at: string | null;
  last_message: string | null;
  last_new_alerts: number | null;
  monitored_count: number | null;
  updated_at: string | null;
};

function normalizeArtistName(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAlbumTitle(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\[\](){}]/g, " ")
    .replace(/\b(vinyl|lp|l\.p\.|edizione|edition|limited|deluxe|colored|colour|color)\b/gi, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface AlbumFound {
  artist_name: string;
  album_title: string;
  source: "Feltrinelli" | "IBS" | "Spotify" | "Discogs";
  release_date?: string;
  retailer_url?: string;
  cover_url?: string;
  edition_details?: string;
  price_eur?: number;
}

function hasMonitorStateTableError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const msg = (error.message || "").toLowerCase();
  return error.code === "PGRST205" || msg.includes("monitoring_state") || msg.includes("relation") && msg.includes("does not exist");
}

function nowIso(): string {
  return new Date().toISOString();
}

function isFreshHeartbeat(heartbeatAt: string | null | undefined): boolean {
  if (!heartbeatAt) return false;
  const time = Date.parse(heartbeatAt);
  if (Number.isNaN(time)) return false;
  return Date.now() - time < MONITOR_STALE_MS;
}

async function getMonitorState(): Promise<MonitorStateRow | null> {
  const { data, error } = await supabase
    .from("monitoring_state")
    .select("id, is_running, started_at, heartbeat_at, finished_at, last_message, last_new_alerts, monitored_count, updated_at")
    .eq("id", MONITOR_STATE_ID)
    .maybeSingle();

  if (error) {
    if (hasMonitorStateTableError(error)) return null;
    throw error;
  }

  return (data as MonitorStateRow | null) || null;
}

async function writeMonitorState(patch: Partial<MonitorStateRow>): Promise<void> {
  const payload = {
    id: MONITOR_STATE_ID,
    updated_at: nowIso(),
    ...patch,
  };

  const { error } = await supabase.from("monitoring_state").upsert(payload, { onConflict: "id" });
  if (error && !hasMonitorStateTableError(error)) {
    throw error;
  }
}

async function fetchTextWithTimeout(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  limit: number,
  worker: (item: TInput) => Promise<TOutput>
): Promise<TOutput[]> {
  const results: TOutput[] = new Array(items.length);
  let index = 0;

  async function runWorker() {
    while (true) {
      const current = index;
      index += 1;
      if (current >= items.length) break;
      results[current] = await worker(items[current]);
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => runWorker());
  await Promise.all(workers);
  return results;
}

// Scansiona Feltrinelli per album degli artisti monitorati
async function scanFeltrinelli(artistNames: string[]): Promise<AlbumFound[]> {
  const perArtist = await mapWithConcurrency(artistNames, SCAN_CONCURRENCY, async (artist) => {
    const searchUrl = `https://www.feltrinelli.it/search?q=${encodeURIComponent(artist)}%20vinile&text=`;
    const html = await fetchTextWithTimeout(searchUrl);
    if (!html) return [] as AlbumFound[];

    const results: AlbumFound[] = [];
    const preorderMatches = html.matchAll(/Disponibile\s+dal\s+(\d+\s+\w+\s+\d{4})/gi);
    for (const match of preorderMatches) {
      const releaseDate = match[1];
      results.push({
        artist_name: artist,
        album_title: `Album ${artist}`,
        source: "Feltrinelli",
        release_date: releaseDate,
        retailer_url: searchUrl,
      });
    }

    return results;
  });

  return perArtist.flat();
}

// Scansiona IBS per album degli artisti monitorati
async function scanIBS(artistNames: string[]): Promise<AlbumFound[]> {
  const perArtist = await mapWithConcurrency(artistNames, SCAN_CONCURRENCY, async (artist) => {
    const searchUrl = `https://www.ibs.it/ricerca/?q=${encodeURIComponent(artist)}%20vinile`;
    const html = await fetchTextWithTimeout(searchUrl);
    if (!html) return [] as AlbumFound[];

    const results: AlbumFound[] = [];
    const preorderMatches = html.matchAll(/Disponibile\s+dal\s+(\d+\s+\w+\s+\d{4})/gi);
    for (const match of preorderMatches) {
      const releaseDate = match[1];
      results.push({
        artist_name: artist,
        album_title: `Album ${artist}`,
        source: "IBS",
        release_date: releaseDate,
        retailer_url: searchUrl,
      });
    }

    return results;
  });

  return perArtist.flat();
}

// Verifica autenticazione admin
async function isAdminAuthenticated(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.slice(7);

  try {
    const { data, error } = await supabase.auth.getUser(token);
    return !error && !!data.user;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  let runStarted = false;
  try {
    // Verifica autenticazione
    const isAuthenticated = await isAdminAuthenticated(req);
    if (!isAuthenticated) {
      return NextResponse.json(
        { success: false, error: "Non autorizzato" },
        { status: 401 }
      );
    }

    const currentState = await getMonitorState();
    if (currentState?.is_running && isFreshHeartbeat(currentState.heartbeat_at)) {
      return NextResponse.json(
        {
          success: false,
          error: "Monitoraggio gia in corso. Attendi il completamento prima di rilanciare.",
          monitoring: {
            isRunning: true,
            startedAt: currentState.started_at,
            heartbeatAt: currentState.heartbeat_at,
            lastMessage: currentState.last_message,
          },
        },
        { status: 409 }
      );
    }

    await writeMonitorState({
      is_running: true,
      started_at: nowIso(),
      heartbeat_at: nowIso(),
      finished_at: null,
      monitored_count: null,
      last_message: "Monitoraggio in corso...",
    });
    runStarted = true;

    // Fetch artisti da monitorare
    const { data: watchedArtists, error: fetchError } = await supabase
      .from("watched_artists")
      .select("id, artist_name")
      .eq("is_active", true);

    if (fetchError || !watchedArtists) {
      throw fetchError || new Error("Nessun artista da monitorare");
    }

    const artistNames = watchedArtists.map((a) => a.artist_name);

    if (artistNames.length === 0) {
      await writeMonitorState({
        is_running: false,
        finished_at: nowIso(),
        monitored_count: 0,
        last_new_alerts: 0,
        last_message: "Nessun artista da monitorare",
      });
      return NextResponse.json({
        success: true,
        message: "Nessun artista da monitorare",
        newAlerts: 0,
        monitoring: { isRunning: false },
      });
    }

    // Scansiona fonti in parallelo
    const [feltrinelliResults, ibsResults] = await Promise.all([
      scanFeltrinelli(artistNames),
      scanIBS(artistNames),
    ]);

    await writeMonitorState({
      heartbeat_at: nowIso(),
      monitored_count: artistNames.length,
      last_message: `Scansione completata: ${artistNames.length} artisti`,
    });

    const allResults = [...feltrinelliResults, ...ibsResults];

    if (allResults.length === 0) {
      await writeMonitorState({
        is_running: false,
        finished_at: nowIso(),
        monitored_count: artistNames.length,
        last_new_alerts: 0,
        last_message: "Nessun nuovo album trovato",
      });
      return NextResponse.json({
        success: true,
        message: "Nessun nuovo album trovato",
        newAlerts: 0,
        monitored: artistNames.length,
        sources: {
          feltrinelli: feltrinelliResults.length,
          ibs: ibsResults.length,
        },
        monitoring: { isRunning: false },
      });
    }

    // Salva gli album trovati come nuovi alert (evita duplicati)
    let insertedCount = 0;

    for (const album of allResults) {
      try {
        const normalizedArtist = normalizeArtistName(album.artist_name);
        const normalizedTitle = normalizeAlbumTitle(album.album_title || "");

        // Controlla se esiste gia (exact)
        const { data: existing } = await supabase
          .from("album_alerts")
          .select("id")
          .eq("artist_name", album.artist_name)
          .eq("album_title", album.album_title)
          .eq("source", album.source)
          .single();

        if (existing) {
          continue; // Salta duplicati
        }

        // Controlla varianti del titolo (normalizzato)
        const { data: sourceExisting } = await supabase
          .from("album_alerts")
          .select("id, artist_name, album_title")
          .eq("source", album.source)
          .ilike("artist_name", album.artist_name)
          .limit(100);

        const hasNormalizedDuplicate = (sourceExisting || []).some((row) => {
          return (
            normalizeArtistName(row.artist_name || "") === normalizedArtist &&
            normalizeAlbumTitle(row.album_title || "") === normalizedTitle
          );
        });

        if (hasNormalizedDuplicate) {
          continue;
        }

        // Trova l'ID dell'artista monitorato
        const watchedArtist = watchedArtists.find(
          (a) => a.artist_name.toLowerCase() === album.artist_name.toLowerCase()
        );

        const { error: insertError } = await supabase
          .from("album_alerts")
          .insert({
            artist_id: watchedArtist?.id || null,
            artist_name: album.artist_name,
            album_title: album.album_title,
            release_date: album.release_date || null,
            source: album.source,
            retailer_url: album.retailer_url || null,
            cover_url: album.cover_url || null,
            edition_details: album.edition_details || null,
            price_eur: album.price_eur || null,
            status: "new",
          });

        if (!insertError) {
          insertedCount++;
        } else if (insertError.code === "23505") {
          // Duplicate caught by DB unique index/constraint.
          continue;
        } else {
          console.error("Errore inserimento alert:", insertError.message);
        }
      } catch (err) {
        console.error("Errore inserimento alert:", err);
      }
    }

    // Aggiorna last_check per gli artisti
    for (const artist of watchedArtists) {
      await supabase
        .from("watched_artists")
        .update({ last_check: new Date().toISOString() })
        .eq("id", artist.id);
    }

    await writeMonitorState({
      is_running: false,
      finished_at: nowIso(),
      heartbeat_at: nowIso(),
      monitored_count: artistNames.length,
      last_new_alerts: insertedCount,
      last_message: `Monitoraggio completato: ${insertedCount} nuovi album`,
    });
    runStarted = false;

    return NextResponse.json({
      success: true,
      message: `Monitoraggio completato. ${insertedCount} nuovi album trovati.`,
      newAlerts: insertedCount,
      monitored: artistNames.length,
      sources: {
        feltrinelli: feltrinelliResults.length,
        ibs: ibsResults.length,
      },
      monitoring: {
        isRunning: false,
      },
    });
  } catch (error) {
    if (runStarted) {
      await writeMonitorState({
        is_running: false,
        finished_at: nowIso(),
        heartbeat_at: nowIso(),
        last_message: error instanceof Error ? `Errore monitoraggio: ${error.message}` : "Errore monitoraggio",
      });
      runStarted = false;
    }
    console.error("Errore API album-monitor:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Errore durante il monitoraggio",
      },
      { status: 500 }
    );
  } finally {
    if (runStarted) {
      await writeMonitorState({
        is_running: false,
        finished_at: nowIso(),
        heartbeat_at: nowIso(),
      });
    }
  }
}

export async function GET(req: NextRequest) {
  // GET endpoint per trigger manuale o status check
  try {
    const isAuthenticated = await isAdminAuthenticated(req);
    if (!isAuthenticated) {
      return NextResponse.json(
        { success: false, error: "Non autorizzato" },
        { status: 401 }
      );
    }

    // Conta artisti monitorati
    const { data: watched } = await supabase
      .from("watched_artists")
      .select("id", { count: "exact" })
      .eq("is_active", true);

    // Conta alert nuovi
    const { data: newAlerts } = await supabase
      .from("album_alerts")
      .select("id", { count: "exact" })
      .eq("status", "new");

    const monitoringState = await getMonitorState();

    return NextResponse.json({
      success: true,
      status: "Monitoraggio attivo",
      watchedCount: watched?.length || 0,
      newAlertsCount: newAlerts?.length || 0,
      monitoring: {
        isRunning: Boolean(monitoringState?.is_running && isFreshHeartbeat(monitoringState?.heartbeat_at)),
        startedAt: monitoringState?.started_at || null,
        heartbeatAt: monitoringState?.heartbeat_at || null,
        finishedAt: monitoringState?.finished_at || null,
        lastMessage: monitoringState?.last_message || null,
        lastNewAlerts: monitoringState?.last_new_alerts ?? null,
        monitoredCount: monitoringState?.monitored_count ?? null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Errore status check" },
      { status: 500 }
    );
  }
}
