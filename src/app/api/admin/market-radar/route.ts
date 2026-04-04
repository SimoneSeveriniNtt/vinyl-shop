import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

interface MusicBrainzArtistCredit {
  name: string;
}

interface MusicBrainzRelease {
  id: string;
  title: string;
  date?: string;
  country?: string;
  disambiguation?: string;
  "artist-credit"?: MusicBrainzArtistCredit[];
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

interface RadarQueryOptions {
  genreKey: string;
  artistFilter: string;
  textFilter: string;
}

const GENRE_TERMS: Record<string, string[]> = {
  rock: ["rock", "alternative", "indie"],
  pop: ["pop", "cantautore", "italiano"],
  jazz: ["jazz", "fusion", "soul"],
  hiphop: ["hip hop", "rap", "urban"],
  elettronica: ["electronic", "techno", "house"],
  colonne: ["soundtrack", "film", "ost"],
};

const DEFAULT_ADMIN_EMAIL = "simone.severini@gmail.com";

function getAllowedAdminEmails(): string[] {
  const source = process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
  return source
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function getBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const [type, token] = authHeader.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

function scoreRelease(release: MusicBrainzRelease): MarketRadarItem {
  const title = release.title || "Senza titolo";
  const extra = release.disambiguation || "";
  const text = `${title} ${extra}`.toLowerCase();

  const raritySignals: string[] = [];

  const rarityPatterns: Array<{ pattern: RegExp; signal: string; points: number }> = [
    { pattern: /limited|edizione limitata/, signal: "Limited edition", points: 18 },
    { pattern: /numbered|numerata/, signal: "Copia numerata", points: 16 },
    { pattern: /colored|color|vinile colorato/, signal: "Vinile colorato", points: 12 },
    { pattern: /rsd|record store day/, signal: "Record Store Day", points: 20 },
    { pattern: /first press|prima stampa/, signal: "Prima stampa", points: 15 },
    { pattern: /import/, signal: "Import", points: 8 },
  ];

  let rarityScore = 0;
  for (const candidate of rarityPatterns) {
    if (candidate.pattern.test(text)) {
      raritySignals.push(candidate.signal);
      rarityScore += candidate.points;
    }
  }

  const now = new Date();
  const releaseDate = release.date ? new Date(release.date) : null;

  let recencyScore = 10;
  if (releaseDate && !Number.isNaN(releaseDate.getTime())) {
    const diffMs = now.getTime() - releaseDate.getTime();
    const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

    if (days <= 14) recencyScore = 35;
    else if (days <= 30) recencyScore = 30;
    else if (days <= 60) recencyScore = 24;
    else if (days <= 120) recencyScore = 18;
    else recencyScore = 10;
  }

  const italianBonus = release.country === "IT" ? 15 : 0;
  const baseScore = 20;
  const score = Math.min(100, baseScore + recencyScore + rarityScore + italianBonus);

  let recommendation: "Alta" | "Media" | "Bassa" = "Bassa";
  if (score >= 75) recommendation = "Alta";
  else if (score >= 55) recommendation = "Media";

  return {
    id: release.id,
    title,
    artist: release["artist-credit"]?.map((a) => a.name).join(", ") || "Artista non disponibile",
    releaseDate: release.date || null,
    country: release.country || "N/D",
    raritySignals,
    opportunityScore: score,
    recommendation,
  };
}

function escapeQueryValue(value: string): string {
  return value.replace(/"/g, "\\\"").trim();
}

async function fetchMusicBrainzReleases(options: RadarQueryOptions): Promise<MusicBrainzRelease[]> {
  const { genreKey, artistFilter, textFilter } = options;
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;
  const genreTerms = GENRE_TERMS[genreKey] || GENRE_TERMS.rock;
  const genreClause = genreTerms.map((term) => `(release:${term} OR artist:${term} OR tag:${term})`).join(" OR ");
  const escapedArtist = escapeQueryValue(artistFilter);
  const artistClause = escapedArtist ? `artist:\"${escapedArtist}\"` : "";
  const escapedText = escapeQueryValue(textFilter);
  const textClause = escapedText
    ? `(release:\"${escapedText}\" OR artist:\"${escapedText}\" OR tag:${escapedText})`
    : "";

  const baseDateClause = `date:[${previousYear}-01-01 TO ${currentYear}-12-31]`;
  const candidateQueries = artistClause || textClause
    ? [
        `country:IT AND ${baseDateClause} AND ${[artistClause, textClause].filter(Boolean).join(" AND ")} AND (${genreClause})`,
        `country:IT AND ${baseDateClause} AND ${[artistClause, textClause].filter(Boolean).join(" AND ")}`,
        `${baseDateClause} AND ${[artistClause, textClause].filter(Boolean).join(" AND ")}`,
      ]
    : [
        `country:IT AND ${baseDateClause} AND (${genreClause})`,
        `country:IT AND ${baseDateClause}`,
        `${baseDateClause} AND (${genreClause})`,
      ];

  async function runQuery(query: string, limit = 40): Promise<MusicBrainzRelease[]> {
    const url = `https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(query)}&fmt=json&limit=${limit}`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "VinylShopRadar/1.0 (contact: admin@vinyl-shop.local)",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`MusicBrainz error: ${res.status}`);
    }

    const data = (await res.json()) as { releases?: MusicBrainzRelease[] };
    return data.releases || [];
  }

  const merged = new Map<string, MusicBrainzRelease>();

  for (const query of candidateQueries) {
    const releases = await runQuery(query, 40);
    for (const release of releases) {
      if (!merged.has(release.id)) {
        merged.set(release.id, release);
      }
    }

    if (merged.size >= 25) {
      break;
    }
  }

  return Array.from(merged.values());
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

    const genre = req.nextUrl.searchParams.get("genre") || "rock";
    const artist = (req.nextUrl.searchParams.get("artist") || "").trim();
    const q = (req.nextUrl.searchParams.get("q") || "").trim();
    const minScore = Math.max(0, Math.min(100, Number.parseInt(req.nextUrl.searchParams.get("minScore") || "0", 10) || 0));
    const page = Math.max(1, Number.parseInt(req.nextUrl.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(40, Math.max(5, Number.parseInt(req.nextUrl.searchParams.get("limit") || "20", 10) || 20));

    const releases = await fetchMusicBrainzReleases({ genreKey: genre, artistFilter: artist, textFilter: q });

    const ranked = releases
      .map(scoreRelease)
      .sort((a, b) => b.opportunityScore - a.opportunityScore);

    const qLower = q.toLowerCase();
    const filtered = ranked.filter((item) => {
      if (item.opportunityScore < minScore) return false;
      if (!qLower) return true;

      const haystack = `${item.title} ${item.artist} ${item.raritySignals.join(" ")}`.toLowerCase();
      return haystack.includes(qLower);
    });

    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit);
    const hasMore = start + limit < filtered.length;

    return NextResponse.json({
      success: true,
      source: "MusicBrainz",
      genre,
      artist,
      q,
      minScore,
      page,
      limit,
      total: filtered.length,
      hasMore,
      generatedAt: new Date().toISOString(),
      items,
      note: "Punteggio euristico: valida sempre disponibilita reale e prezzo prima dell'acquisto.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore radar mercato";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
