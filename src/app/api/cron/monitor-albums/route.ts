import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

// Scansione Feltrinelli
async function scanFeltrinelliForArtists(
  artistNames: string[]
): Promise<any[]> {
  const results: any[] = [];

  for (const artist of artistNames) {
    try {
      const searchUrl = `https://www.feltrinelli.it/search?q=${encodeURIComponent(
        artist
      )}+vinile&text=`;

      const response = await fetch(searchUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!response.ok) {
        console.log(`Feltrinelli: ${artist} - status ${response.status}`);
        continue;
      }

      const html = await response.text();

      // Cerchiamo pattern di preorder: "Disponibile dal"
      const availabilityPattern =
        /Disponibile\s+dal\s+(\d{1,2}\s+\w+\s+\d{4})/gi;
      const matches = html.matchAll(availabilityPattern);

      let foundAny = false;
      for (const match of matches) {
        foundAny = true;
        const releaseDate = match[1];

        // Estrai titoli dal contesto HTML
        const titleMatches = html.matchAll(
          new RegExp(
            `([\\w\\s-]+).*?Disponibile\\s+dal\\s+${releaseDate}`,
            "i"
          )
        );

        for (const titleMatch of titleMatches) {
          const title = titleMatch[1]?.trim() || `Album di ${artist}`;

          results.push({
            artist: artist,
            title: title,
            releaseDate: releaseDate,
            source: "Feltrinelli",
            url: searchUrl,
          });
          break; // Una volta trovato il primo, basta
        }
      }

      if (foundAny) {
        console.log(`✅ Feltrinelli: trovati album per ${artist}`);
      } else {
        console.log(`⏸️  Feltrinelli: nessun preorder per ${artist}`);
      }
    } catch (err) {
      console.error(`Errore Feltrinelli per ${artist}:`, err);
    }
  }

  return results;
}

// Scansione IBS
async function scanIBSForArtists(artistNames: string[]): Promise<any[]> {
  const results: any[] = [];

  for (const artist of artistNames) {
    try {
      const searchUrl = `https://www.ibs.it/ricerca/?q=${encodeURIComponent(
        artist
      )}+vinile`;

      const response = await fetch(searchUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!response.ok) {
        console.log(`IBS: ${artist} - status ${response.status}`);
        continue;
      }

      const html = await response.text();

      // Pattern simile
      const availabilityPattern =
        /Disponibile\s+dal\s+(\d{1,2}\s+\w+\s+\d{4})/gi;
      const matches = html.matchAll(availabilityPattern);

      let foundAny = false;
      for (const match of matches) {
        foundAny = true;
        const releaseDate = match[1];

        results.push({
          artist: artist,
          title: `Album ${artist}`,
          releaseDate: releaseDate,
          source: "IBS",
          url: searchUrl,
        });
      }

      if (foundAny) {
        console.log(`✅ IBS: trovati album per ${artist}`);
      } else {
        console.log(`⏸️  IBS: nessun preorder per ${artist}`);
      }
    } catch (err) {
      console.error(`Errore IBS per ${artist}:`, err);
    }
  }

  return results;
}

// Scansione Discogs (fonte terza per ampliare ricerca)
async function scanDiscogsForArtists(
  artistNames: string[]
): Promise<any[]> {
  const results: any[] = [];

  for (const artist of artistNames) {
    try {
      const searchUrl = `https://www.discogs.com/search/?q=${encodeURIComponent(
        artist
      )}&type=release&format=Vinyl`;

      const response = await fetch(searchUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!response.ok) {
        console.log(`Discogs: ${artist} - status ${response.status}`);
        continue;
      }

      const html = await response.text();

      // Discogs ha pattern di uscite imminenti: "Released 202[67]", "Pending", "Forthcoming"
      const releasePatterns = [
        /Released\s+(202[67])/gi, // Future years
        /Forthcoming|Pending/gi,
      ];

      let foundAny = false;

      for (const pattern of releasePatterns) {
        const matches = html.matchAll(pattern);
        for (const match of matches) {
          foundAny = true;
          const year = match[1] || "2026+";

          // Estrai titoli vicino ai match
          const titleRegex = new RegExp(
            `([\\w\\s'-]+).*?${match[0]}`,
            "i"
          );
          const titleMatch = html.match(titleRegex);
          const title = titleMatch?.[1]?.trim() || `Album ${artist}`;

          results.push({
            artist: artist,
            title: title,
            releaseDate: `Anno ${year}`,
            source: "Discogs",
            url: searchUrl,
          });

          break; // Una volta trovato il primo per questo artista, basta
        }
      }

      if (foundAny) {
        console.log(`✅ Discogs: trovati album per ${artist}`);
      } else {
        console.log(`⏸️  Discogs: nessun risultato per ${artist}`);
      }
    } catch (err) {
      console.error(`Errore Discogs per ${artist}:`, err);
    }
  }

  return results;
}

export async function GET(req: NextRequest) {
  try {
    // Verifica Vercel Cron token se configurato
    const cronSecret = req.headers.get("authorization");
    if (
      process.env.CRON_SECRET &&
      cronSecret !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      console.warn("❌ Cron token non valido");
      return NextResponse.json(
        { error: "Non autorizzato" },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Variabili di ambiente non configurate" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    console.log("🔍 Inizio monitoraggio album...");

    // Fetch artisti da monitorare
    const { data: watchedArtists, error: fetchError } = await supabase
      .from("watched_artists")
      .select("id, artist_name")
      .eq("is_active", true);

    if (fetchError || !watchedArtists || watchedArtists.length === 0) {
      console.log("⏸️  Nessun artista da monitorare");
      return NextResponse.json({
        success: true,
        message: "Nessun artista configurato",
        monitored: 0,
        foundAlbums: 0,
      });
    }

    const artistNames = watchedArtists.map((a) => a.artist_name);
    console.log(`📋 Monitoraggio ${artistNames.length} artisti:`, artistNames);

    // Scansiona fonti multiple
    const feltrinelliResults = await scanFeltrinelliForArtists(artistNames);
    const ibsResults = await scanIBSForArtists(artistNames);
    const discogsResults = await scanDiscogsForArtists(artistNames);

    const allResults = [...feltrinelliResults, ...ibsResults, ...discogsResults];
    console.log(`📊 Trovati ${allResults.length} potenziali album`);

    // Salva i risultati come alert
    let newAlertsCount = 0;

    for (const album of allResults) {
      try {
        const normalizedArtist = normalizeArtistName(album.artist);
        const normalizedTitle = normalizeAlbumTitle(album.title || "");

        // Controlla duplicati esatti
        const { data: exactExisting } = await supabase
          .from("album_alerts")
          .select("id, album_title")
          .eq("artist_name", album.artist)
          .eq("album_title", album.title)
          .eq("source", album.source)
          .single();

        if (exactExisting) {
          console.log(`⏭️  Saltato duplicato: ${album.artist} - ${album.title}`);
          continue;
        }

        // Controlla duplicati normalizzati (stesso artista/fonte, titolo leggermente diverso)
        const { data: sourceExisting } = await supabase
          .from("album_alerts")
          .select("id, artist_name, album_title")
          .eq("source", album.source)
          .ilike("artist_name", album.artist)
          .limit(100);

        const hasNormalizedDuplicate = (sourceExisting || []).some((row) => {
          return (
            normalizeArtistName(row.artist_name || "") === normalizedArtist &&
            normalizeAlbumTitle(row.album_title || "") === normalizedTitle
          );
        });

        if (hasNormalizedDuplicate) {
          console.log(`⏭️  Saltato duplicato normalizzato: ${album.artist} - ${album.title}`);
          continue;
        }

        // Trova artist ID
        const watchedArtist = watchedArtists.find(
          (a) => a.artist_name.toLowerCase() === album.artist.toLowerCase()
        );

        // Inserisci nuovo alert
        const { error: insertError } = await supabase
          .from("album_alerts")
          .insert({
            artist_id: watchedArtist?.id || null,
            artist_name: album.artist,
            album_title: album.title,
            release_date: album.releaseDate || null,
            source: album.source,
            retailer_url: album.url || null,
            status: "new",
          });

        if (!insertError) {
          newAlertsCount++;
          console.log(
            `✅ Alert creato: ${album.artist} - ${album.title} (${album.source})`
          );
        } else if (insertError.code === "23505") {
          // Unique violation (possible concurrent run): treat as already seen.
          console.log(`⏭️  Saltato duplicato (vincolo DB): ${album.artist} - ${album.title}`);
        } else {
          console.error(
            `❌ Errore inserimento: ${album.artist} - ${insertError.message}`
          );
        }
      } catch (err) {
        console.error("Errore processing album:", err);
      }
    }

    // Aggiorna last_check
    const now = new Date().toISOString();
    for (const artist of watchedArtists) {
      await supabase
        .from("watched_artists")
        .update({ last_check: now })
        .eq("id", artist.id);
    }

    console.log(
      `✨ Monitoraggio completato: ${newAlertsCount} nuovi alert creati`
    );

    return NextResponse.json({
      success: true,
      message: `Monitoraggio completato. ${newAlertsCount} nuovi album trovati.`,
      timestamp: now,
      monitored: artistNames.length,
      foundAlbums: allResults.length,
      newAlerts: newAlertsCount,
      sources: {
        feltrinelli: feltrinelliResults.length,
        ibs: ibsResults.length,
        discogs: discogsResults.length,
      },
    });
  } catch (error) {
    console.error("❌ Cron error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Errore cron",
      },
      { status: 500 }
    );
  }
}

// Configurazione Vercel Cron
export const maxDuration = 60; // Timeout di 60 secondi per le cron functions
