import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  searchDiscogsReleases,
  getReleaseDetails,
  buildRadarItem,
  matchesGenreFilter,
  type DiscogsRadarItem,
} from "@/lib/discogs";
import { searchWebPreorderIntel } from "@/lib/preorder-intel";

function getBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const [type, token] = authHeader.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

function getAllowedAdminEmails(): string[] {
  const source = process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "simone.severini@gmail.com";
  return source
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function GET(req: NextRequest) {
  try {
    const token = getBearerToken(req.headers.get("authorization"));
    if (!token) {
      return NextResponse.json({ success: false, error: "Token mancante" }, { status: 401 });
    }

    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData.user?.email) {
      return NextResponse.json({ success: false, error: "Utente non autenticato" }, { status: 401 });
    }

    const allowedAdminEmails = getAllowedAdminEmails();
    if (!allowedAdminEmails.includes(userData.user.email.toLowerCase())) {
      return NextResponse.json({ success: false, error: "Non autorizzato" }, { status: 403 });
    }

    const artist = (req.nextUrl.searchParams.get("artist") || "").trim();
    const album = (req.nextUrl.searchParams.get("album") || "").trim();
    const genre = (req.nextUrl.searchParams.get("genre") || "").trim();
    const includePreorders = req.nextUrl.searchParams.get("includePreorders") !== "0";
    const minRarity = Math.max(0, Math.min(100, Number.parseInt(req.nextUrl.searchParams.get("minRarity") || "0", 10) || 0));
    const page = Math.max(1, Number.parseInt(req.nextUrl.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(40, Math.max(5, Number.parseInt(req.nextUrl.searchParams.get("limit") || "20", 10) || 20));

    if (!artist) {
      return NextResponse.json(
        { success: false, error: "Parametro 'artist' richiesto" },
        { status: 400 }
      );
    }

    // Fetch a single Discogs page to avoid burst calls that trigger rate limiting.
    const searchPage = await searchDiscogsReleases(artist, album || undefined, page, limit);
    const releases = searchPage.results;

    if (releases.length === 0) {
      return NextResponse.json({
        success: true,
        artist,
        album: album || null,
        minRarity,
        page,
        limit,
        total: 0,
        hasMore: false,
        items: [],
        generatedAt: new Date().toISOString(),
        note: "Nessun vinile trovato per questo artista",
      });
    }

    // Fetch full details for each release and build radar items
    const radarItems: DiscogsRadarItem[] = [];
    for (const release of releases) {
      try {
        const details = await getReleaseDetails(release.id);
        const item = await buildRadarItem(details);

        // Apply minRarity + genre filter
        if (item.rarity_score >= minRarity && matchesGenreFilter(item, genre)) {
          radarItems.push(item);
        }
      } catch (e) {
        // Skip releases that fail to fetch details
        console.error(`Failed to fetch details for release ${release.id}:`, e);
      }
    }

    // Sort by album relevance first (if album provided), then rarity.
    const normalizedAlbum = album.toLowerCase();
    radarItems.sort((a, b) => {
      const aAlbumMatch = normalizedAlbum ? a.title.toLowerCase().includes(normalizedAlbum) : false;
      const bAlbumMatch = normalizedAlbum ? b.title.toLowerCase().includes(normalizedAlbum) : false;

      if (aAlbumMatch !== bAlbumMatch) {
        return aAlbumMatch ? -1 : 1;
      }

      return b.rarity_score - a.rarity_score;
    });

    const preorderItems = includePreorders
      ? await searchWebPreorderIntel({ artist, album: album || undefined, genre: genre || undefined, limit: 8 })
      : [];

    const merged = [...radarItems, ...preorderItems].sort((a, b) => b.rarity_score - a.rarity_score);
    const deduped: DiscogsRadarItem[] = [];
    const seen = new Set<string>();

    for (const item of merged) {
      const key = `${item.artist}|${item.title}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
    }

    const hasMore = searchPage.page < searchPage.pages;

    return NextResponse.json({
      success: true,
      source: "Discogs",
      artist,
      album: album || null,
      genre: genre || null,
      includePreorders,
      minRarity,
      page,
      limit,
      total: deduped.length,
      hasMore,
      items: deduped,
      generatedAt: new Date().toISOString(),
      note: includePreorders
        ? "Dati Discogs + Web Preorder Intel per edizioni rare e pre-order"
        : "Dati Discogs con calcolo rarità basato su edizioni, formati, anni",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore radar Discogs";
    if (message.includes("429")) {
      return NextResponse.json(
        {
          success: false,
          error: "Discogs sta limitando temporaneamente le richieste (429). Riprova tra pochi secondi.",
        },
        { status: 429 }
      );
    }

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
