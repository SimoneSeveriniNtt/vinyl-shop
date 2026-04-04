import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

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

// Scansiona Feltrinelli per album degli artisti monitorati
async function scanFeltrinelli(artistNames: string[]): Promise<AlbumFound[]> {
  const results: AlbumFound[] = [];

  try {
    for (const artist of artistNames) {
      try {
        const searchUrl = `https://www.feltrinelli.it/search?q=${encodeURIComponent(artist)}%20vinile&text=`;
        const response = await fetch(searchUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });

        if (!response.ok) continue;

        const html = await response.text();

        // Cerca pattern per album in preorder: "Disponibile dal [DATA]"
        const preorderMatches = html.matchAll(
          /Disponibile\s+dal\s+(\d+\s+\w+\s+\d{4})/gi
        );

        for (const match of preorderMatches) {
          const releaseDate = match[1];
          // Estrai titolo dell'album e altri dettagli dal contesto HTML
          // Questo è un pattern semplificato - in realtà occorrerebbe parsare meglio
          results.push({
            artist_name: artist,
            album_title: `Album ${artist}`,
            source: "Feltrinelli",
            release_date: releaseDate,
            retailer_url: searchUrl,
          });
        }
      } catch (err) {
        console.error(`Errore scansione Feltrinelli per ${artist}:`, err);
      }
    }
  } catch (err) {
    console.error("Errore scansione Feltrinelli:", err);
  }

  return results;
}

// Scansiona IBS per album degli artisti monitorati
async function scanIBS(artistNames: string[]): Promise<AlbumFound[]> {
  const results: AlbumFound[] = [];

  try {
    for (const artist of artistNames) {
      try {
        const searchUrl = `https://www.ibs.it/ricerca/?q=${encodeURIComponent(artist)}%20vinile`;
        const response = await fetch(searchUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });

        if (!response.ok) continue;

        const html = await response.text();

        // Pattern simile a Feltrinelli
        const preorderMatches = html.matchAll(
          /Disponibile\s+dal\s+(\d+\s+\w+\s+\d{4})/gi
        );

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
      } catch (err) {
        console.error(`Errore scansione IBS per ${artist}:`, err);
      }
    }
  } catch (err) {
    console.error("Errore scansione IBS:", err);
  }

  return results;
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
  try {
    // Verifica autenticazione
    const isAuthenticated = await isAdminAuthenticated(req);
    if (!isAuthenticated) {
      return NextResponse.json(
        { success: false, error: "Non autorizzato" },
        { status: 401 }
      );
    }

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
      return NextResponse.json({
        success: true,
        message: "Nessun artista da monitorare",
        newAlerts: 0,
      });
    }

    // Scansiona fonti
    const feltrinelliResults = await scanFeltrinelli(artistNames);
    const ibsResults = await scanIBS(artistNames);

    const allResults = [...feltrinelliResults, ...ibsResults];

    if (allResults.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Nessun nuovo album trovato",
        newAlerts: 0,
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

    return NextResponse.json({
      success: true,
      message: `Monitoraggio completato. ${insertedCount} nuovi album trovati.`,
      newAlerts: insertedCount,
      monitored: artistNames.length,
    });
  } catch (error) {
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

    return NextResponse.json({
      success: true,
      status: "Monitoraggio attivo",
      watchedCount: watched?.length || 0,
      newAlertsCount: newAlerts?.length || 0,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Errore status check" },
      { status: 500 }
    );
  }
}
