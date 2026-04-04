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

async function fetchMusicBrainzReleases(genreKey: string): Promise<MusicBrainzRelease[]> {
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;
  const genreTerms = GENRE_TERMS[genreKey] || GENRE_TERMS.rock;
  const genreClause = genreTerms.map((term) => `(release:${term} OR artist:${term})`).join(" OR ");

  const query = `country:IT AND format:vinyl AND date:[${previousYear}-01-01 TO ${currentYear}-12-31] AND (${genreClause})`;
  const url = `https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(query)}&fmt=json&limit=40`;

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
    const releases = await fetchMusicBrainzReleases(genre);

    const ranked = releases
      .map(scoreRelease)
      .sort((a, b) => b.opportunityScore - a.opportunityScore)
      .slice(0, 20);

    return NextResponse.json({
      success: true,
      source: "MusicBrainz",
      genre,
      generatedAt: new Date().toISOString(),
      items: ranked,
      note: "Punteggio euristico: valida sempre disponibilita reale e prezzo prima dell'acquisto.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore radar mercato";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
