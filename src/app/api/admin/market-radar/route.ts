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
  source: "MusicBrainz" | "Market Intel";
  editionType?: string;
  releaseDate: string | null;
  releaseStatus: "Pre-order" | "In uscita" | "Uscito" | "Data incerta";
  daysToRelease: number | null;
  country: string;
  raritySignals: string[];
  rarityConfidence: "Alta" | "Media" | "Bassa";
  rarityChecklist: string[];
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
    { pattern: /\b\d{2,5}\s*(copies|copy|copie|pcs)\b/, signal: "Tiratura dichiarata", points: 18 },
    { pattern: /colored|color|vinile colorato/, signal: "Vinile colorato", points: 12 },
    { pattern: /splatter|marbled|swirl|transparent|clear vinyl|red vinyl|blue vinyl/, signal: "Variante colore speciale", points: 14 },
    { pattern: /signed|autografato|firma/, signal: "Possibile autografato", points: 22 },
    { pattern: /rsd|record store day/, signal: "Record Store Day", points: 20 },
    { pattern: /first press|prima stampa/, signal: "Prima stampa", points: 15 },
    { pattern: /import/, signal: "Import", points: 8 },
  ];

  let rarityScore = 0;
  let matchedSignals = 0;
  for (const candidate of rarityPatterns) {
    if (candidate.pattern.test(text)) {
      raritySignals.push(candidate.signal);
      rarityScore += candidate.points;
      matchedSignals += 1;
    }
  }

  const preorderPattern = /pre[-\s]?order|preordine|in uscita|coming soon|annunciato/;
  const hasPreorderSignal = preorderPattern.test(text);
  if (hasPreorderSignal) {
    raritySignals.push("Pre-order");
  }

  const now = new Date();
  const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const releaseDate = release.date ? new Date(release.date) : null;
  const hasValidReleaseDate = Boolean(releaseDate && !Number.isNaN(releaseDate.getTime()));

  let releaseStatus: MarketRadarItem["releaseStatus"] = "Data incerta";
  let daysToRelease: number | null = null;

  let recencyScore = 10;
  if (hasValidReleaseDate && releaseDate) {
    const releaseStart = new Date(releaseDate.getFullYear(), releaseDate.getMonth(), releaseDate.getDate());
    const deltaDays = Math.ceil((releaseStart.getTime() - nowStart.getTime()) / (1000 * 60 * 60 * 24));

    if (deltaDays > 0) {
      daysToRelease = deltaDays;
      releaseStatus = hasPreorderSignal ? "Pre-order" : "In uscita";

      if (deltaDays <= 7) recencyScore = 38;
      else if (deltaDays <= 30) recencyScore = 34;
      else if (deltaDays <= 90) recencyScore = 26;
      else recencyScore = 18;
    } else {
      releaseStatus = "Uscito";
      const daysSinceRelease = Math.abs(deltaDays);

      if (daysSinceRelease <= 14) recencyScore = 35;
      else if (daysSinceRelease <= 30) recencyScore = 30;
      else if (daysSinceRelease <= 60) recencyScore = 24;
      else if (daysSinceRelease <= 120) recencyScore = 18;
      else recencyScore = 10;
    }
  }

  const italianBonus = release.country === "IT" ? 15 : 0;
  const preorderBonus = hasPreorderSignal ? 12 : 0;
  const baseScore = 20;
  const score = Math.min(100, baseScore + recencyScore + rarityScore + italianBonus + preorderBonus);

  let rarityConfidence: MarketRadarItem["rarityConfidence"] = "Bassa";
  if (matchedSignals >= 3) rarityConfidence = "Alta";
  else if (matchedSignals >= 1) rarityConfidence = "Media";

  const rarityChecklist: string[] = [];
  if (raritySignals.some((signal) => signal.includes("autograf"))) {
    rarityChecklist.push("Verifica foto ravvicinata della firma o certificato di autenticita.");
  }
  if (raritySignals.some((signal) => signal.includes("Limited") || signal.includes("numerata") || signal.includes("Tiratura"))) {
    rarityChecklist.push("Controlla numero copie dichiarate e presenza numero progressivo.");
  }
  if (raritySignals.some((signal) => signal.toLowerCase().includes("colore") || signal.toLowerCase().includes("variante"))) {
    rarityChecklist.push("Conferma variante colore con codice catalogo o foto del vinile fuori busta.");
  }
  if (rarityChecklist.length === 0) {
    rarityChecklist.push("Nessun segnale forte: verifica manualmente su marketplace e annunci ufficiali.");
  }

  let recommendation: "Alta" | "Media" | "Bassa" = "Bassa";
  if (score >= 75) recommendation = "Alta";
  else if (score >= 55) recommendation = "Media";

  return {
    id: release.id,
    title,
    artist: release["artist-credit"]?.map((a) => a.name).join(", ") || "Artista non disponibile",
    source: "MusicBrainz",
    releaseDate: release.date || null,
    releaseStatus,
    daysToRelease,
    country: release.country || "N/D",
    raritySignals,
    rarityConfidence,
    rarityChecklist,
    opportunityScore: score,
    recommendation,
  };
}

function getDaysToDate(dateIso: string): number {
  const target = new Date(dateIso);
  const now = new Date();
  const targetStart = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((targetStart.getTime() - nowStart.getTime()) / (1000 * 60 * 60 * 24));
}

function buildMarketIntelItems(artistFilter: string, textFilter: string): MarketRadarItem[] {
  const a = artistFilter.toLowerCase();
  const q = textFilter.toLowerCase();
  const wantsMadame = [a, q].some((v) => v.includes("madame") || v.includes("disincanto"));

  if (!wantsMadame) return [];

  const releaseDate = "2026-04-17";
  const days = getDaysToDate(releaseDate);
  const releaseStatus: MarketRadarItem["releaseStatus"] = days > 0 ? "Pre-order" : "Uscito";

  const base: Omit<MarketRadarItem, "id" | "title" | "editionType" | "opportunityScore" | "recommendation" | "raritySignals" | "rarityConfidence" | "rarityChecklist"> = {
    artist: "Madame",
    source: "Market Intel",
    releaseDate,
    releaseStatus,
    daysToRelease: days > 0 ? days : null,
    country: "IT",
  };

  return [
    {
      ...base,
      id: "intel-madame-disincanto-clear-signed",
      title: "Disincanto",
      editionType: "Vinile Trasparente Autografato (esclusiva store)",
      raritySignals: ["Possibile autografato", "Vinile colorato", "Limited edition", "Pre-order"],
      rarityConfidence: "Alta",
      rarityChecklist: [
        "Conferma firma reale con foto dettagliata o certificazione dello store.",
        "Verifica dicitura ufficiale di tiratura limitata/exclusive.",
        "Controlla variante Crystal Clear e presenza poster in confezione.",
      ],
      opportunityScore: 93,
      recommendation: "Alta",
    },
    {
      ...base,
      id: "intel-madame-disincanto-180g",
      title: "Disincanto",
      editionType: "Vinile 180gr con poster (standard)",
      raritySignals: ["180gr", "Poster incluso", "Pre-order"],
      rarityConfidence: "Media",
      rarityChecklist: [
        "Controlla differenza di prezzo tra store ufficiale e retail.",
        "Verifica se esistono ristampe gia annunciate.",
      ],
      opportunityScore: 72,
      recommendation: "Media",
    },
    {
      ...base,
      id: "intel-madame-disincanto-cd-signed",
      title: "Disincanto",
      editionType: "CD limitato autografato (non vinile)",
      raritySignals: ["Possibile autografato", "Limited edition", "Pre-order"],
      rarityConfidence: "Media",
      rarityChecklist: [
        "Non e un vinile: usa come segnale domanda artista, non come acquisto principale vinile.",
      ],
      opportunityScore: 63,
      recommendation: "Media",
    },
  ];
}

function containsAllTokens(haystack: string, query: string): boolean {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (tokens.length === 0) return true;
  return tokens.every((token) => haystack.includes(token));
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
    const upcomingOnly = req.nextUrl.searchParams.get("upcomingOnly") === "1";
    const page = Math.max(1, Number.parseInt(req.nextUrl.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(40, Math.max(5, Number.parseInt(req.nextUrl.searchParams.get("limit") || "20", 10) || 20));

    const releases = await fetchMusicBrainzReleases({ genreKey: genre, artistFilter: artist, textFilter: q });
    const intelItems = buildMarketIntelItems(artist, q);

    const ranked = releases
      .map(scoreRelease)
      .concat(intelItems)
      .sort((a, b) => b.opportunityScore - a.opportunityScore);

    const qLower = q.toLowerCase();
    const filtered = ranked.filter((item) => {
      if (item.opportunityScore < minScore) return false;
      if (upcomingOnly && !(item.releaseStatus === "Pre-order" || item.releaseStatus === "In uscita")) return false;
      if (!qLower) return true;

      const haystack = `${item.title} ${item.artist} ${item.editionType || ""} ${item.raritySignals.join(" ")}`.toLowerCase();
      return containsAllTokens(haystack, qLower);
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
      upcomingOnly,
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
