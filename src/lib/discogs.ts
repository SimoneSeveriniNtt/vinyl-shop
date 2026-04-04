/**
 * Discogs API client for vinyl discovery and rare editions tracking
 * Rate limit: 60 requests per minute (anonymous)
 */

const DISCOGS_BASE = "https://api.discogs.com";
const USER_AGENT = "VinylShopRadar/1.0 (+http://vinyl-shop.local)";
const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN;

interface DiscogsArtist {
  id: number;
  name: string;
  resource_url: string;
}

interface DiscogsRelease {
  id: number;
  title: string;
  artists?: DiscogsArtist[];
  year?: number;
  resource_url: string;
  uri?: string;
  catalog_number?: string;
  labels?: Array<{ name: string; catno: string }>;
  formats?: Array<{ name: string; descriptions?: string[] }>;
  genres?: string[];
  styles?: string[];
  country?: string;
}

interface DiscogsReleaseDetail extends DiscogsRelease {
  released?: string;
  notes?: string;
  videos?: Array<{ title: string; description: string; uri: string }>;
  images?: Array<{ type: string; uri: string; resource_url: string; uri150: string; width: number; height: number }>;
  master_id?: number;
  master_url?: string;
  num_for_sale?: number;
  lowest_price?: number;
  community?: {
    have?: number;
    want?: number;
    rating?: {
      average?: number;
      count?: number;
    };
  };
}

export interface RaritySignal {
  type:
    | "limited"
    | "colored"
    | "numbered"
    | "box_set"
    | "reissue"
    | "original_pressing"
    | "special_edition"
    | "picture_disc"
    | "signed"
    | "alt_cover"
    | "upcoming";
  description: string;
  rarity_weight: number; // 1-10
}

export interface DiscogsRadarItem {
  id: number;
  artist: string;
  title: string;
  source: "Discogs" | "Web Preorder Intel";
  releaseYear: number | null;
  releaseDate: string | null;
  catalogNumber: string | null;
  country: string | null;
  format: string; // "Vinyl", "CD", etc
  formatDetails: string[]; // ["LP", "Album"], ["12\""], ["Stereo"], ["180g"], etc
  genres: string[];
  styles: string[];
  rarity_signals: RaritySignal[];
  rarity_score: number; // 0-100
  estimated_rarity: "Common" | "Uncommon" | "Rare" | "Very Rare" | "Collectible";
  notes: string;
  discogs_url: string;
  resource_url: string;
  images: Array<{ uri: string; uri150: string }>;
  rarity_description: string;
  marketplace: {
    have: number;
    want: number;
    numForSale: number | null;
    lowestPrice: number | null;
  };
  preorder: {
    isPreorder: boolean;
    store: string | null;
    url: string | null;
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(res: Response, attempt: number): number {
  const retryAfter = Number.parseInt(res.headers.get("retry-after") || "", 10);
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return retryAfter * 1000;
  }

  // Discogs usually resets quickly; keep retries short and bounded.
  return Math.min(3000, 1000 * (attempt + 1));
}

async function fetchDiscogs(path: string, attempt = 0): Promise<any> {
  const url = `${DISCOGS_BASE}${path}`;
  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    "Accept": "application/json",
  };

  if (DISCOGS_TOKEN) {
    headers["Authorization"] = `Discogs token=${DISCOGS_TOKEN}`;
  }

  const res = await fetch(url, {
    headers,
    cache: "no-store",
  });

  if (res.status === 429 && attempt < 2) {
    await sleep(getRetryDelayMs(res, attempt));
    return fetchDiscogs(path, attempt + 1);
  }

  if (!res.ok) {
    throw new Error(`Discogs API error: ${res.status}`);
  }

  return res.json();
}

export async function searchDiscogsReleases(
  artist: string,
  album?: string,
  page = 1,
  perPage = 20
): Promise<{ results: DiscogsRelease[]; pages: number; page: number; perPage: number }> {
  const toPage = (data: any) => ({
    results: data.results || [],
    pages: data.pagination?.pages || 1,
    page: data.pagination?.page || page,
    perPage: data.pagination?.per_page || perPage,
  });

  const params = new URLSearchParams({
    type: "release",
    format: "Vinyl",
    artist,
    page: String(page),
    per_page: String(perPage),
  });

  if (album?.trim()) {
    params.set("release_title", album.trim());
  }

  const primaryData = await fetchDiscogs(`/database/search?${params.toString()}`);
  const primaryPage = toPage(primaryData);
  if (primaryPage.results.length > 0) {
    return primaryPage;
  }

  // Fallback for artists that are poorly indexed in the strict artist field.
  const query = album ? `${artist} ${album}` : artist;
  const fallbackData = await fetchDiscogs(
    `/database/search?q=${encodeURIComponent(query)}&type=release&format=Vinyl&page=${page}&per_page=${perPage}`
  );
  const fallbackPage = toPage(fallbackData);

  // Keep only releases that still resemble the artist name to avoid noisy matches.
  const artistLower = artist.trim().toLowerCase();
  const filtered = fallbackPage.results.filter((r: DiscogsRelease) =>
    `${r.title} ${(r.artists || []).map((a: DiscogsArtist) => a.name).join(" ")}`.toLowerCase().includes(artistLower)
  );

  return {
    ...fallbackPage,
    results: filtered.length > 0 ? filtered : fallbackPage.results,
  };
}

export async function getReleaseDetails(releaseId: number): Promise<DiscogsReleaseDetail> {
  return fetchDiscogs(`/releases/${releaseId}`);
}

export function extractRaritySignals(release: DiscogsReleaseDetail): RaritySignal[] {
  const signals: RaritySignal[] = [];
  const text = [
    release.title,
    release.notes,
    ...(release.formats || []).flatMap(f => f.descriptions || []),
    ...(release.styles || []),
  ]
    .join(" ")
    .toLowerCase();

  const patterns: Array<{ pattern: RegExp; type: RaritySignal["type"]; desc: string; weight: number }> = [
    { pattern: /limited[\s-]?edition|ltd[\s.]?ed|only.*copies|numbered copy|numbered edition/i, type: "limited", desc: "Limited Edition", weight: 9 },
    { pattern: /colored vinyl|coloured vinyl|color variant|colour variant|vinyl.*color|red vinyl|blue vinyl|white vinyl|splatter|swirl|marbled/i, type: "colored", desc: "Colored Vinyl", weight: 7 },
    { pattern: /numbered|copy.*of|copia.*di|#\d+|n°\d+/i, type: "numbered", desc: "Numbered Copy", weight: 8 },
    { pattern: /box[\s-]?set|deluxe|remaster|reissue|gatefold|poster|booklet|exclusive/i, type: "box_set", desc: "Special Edition Package", weight: 6 },
    { pattern: /reissue|re-issue|remaster|remastered/i, type: "reissue", desc: "Reissue", weight: 3 },
    { pattern: /first.*press|original press|original.*release|1st.*press/i, type: "original_pressing", desc: "Original Pressing", weight: 8 },
    { pattern: /picture[\s-]?disc|picture.*disc|shaped vinyl/i, type: "picture_disc", desc: "Picture Disc", weight: 8 },
    { pattern: /signed|autograph|autographed|firmato|autografato/i, type: "signed", desc: "Signed / Autographed", weight: 10 },
    { pattern: /alternate cover|alternative cover|alt cover|variant cover|cover variant|sleeve variant/i, type: "alt_cover", desc: "Alternate Cover", weight: 8 },
  ];

  for (const { pattern, type, desc, weight } of patterns) {
    if (pattern.test(text)) {
      signals.push({ type, description: desc, rarity_weight: weight });
    }
  }

  const currentYear = new Date().getFullYear();
  if (release.year && release.year >= currentYear) {
    signals.push({ type: "upcoming", description: "Upcoming / Pre-order Window", rarity_weight: 4 });
  }

  return signals;
}

export function calculateRarityScore(release: DiscogsReleaseDetail, signals: RaritySignal[]): number {
  let score = 20; // base

  // Year bonus (older = rarer, but not original 1960s)
  if (release.year) {
    const age = new Date().getFullYear() - release.year;
    if (age > 20 && age < 50) score += 15;
    else if (age >= 50) score += 20;
    else if (age > 5) score += 8;
  }

  // Signals
  for (const signal of signals) {
    score += signal.rarity_weight * 3;
  }

  // Format bonuses
  if (release.formats) {
    const formatText = release.formats.map(f => f.name).join(" ").toLowerCase();
    if (formatText.includes("180")) score += 10;
    if (formatText.includes("200")) score += 12;
    if (formatText.includes("audiophile")) score += 15;
  }

  // Styles/genre premium
  if (release.styles?.some(s => s.match(/jazz|classical|jazz fusion/i))) {
    score += 10;
  }

  const want = release.community?.want ?? 0;
  const have = release.community?.have ?? 0;
  const numForSale = release.num_for_sale;

  if (want > 0 && have > 0) {
    const demandRatio = want / have;
    if (demandRatio >= 0.45) score += 10;
    else if (demandRatio >= 0.25) score += 6;
  }

  if (typeof numForSale === "number") {
    if (numForSale === 0) score += 15;
    else if (numForSale <= 3) score += 12;
    else if (numForSale <= 10) score += 8;
  }

  return Math.min(100, score);
}

function buildRarityDescription(
  item: Pick<DiscogsRadarItem, "title" | "estimated_rarity" | "rarity_signals" | "marketplace" | "releaseYear" | "formatDetails">
): string {
  const signalText = item.rarity_signals.length
    ? `Segnali forti: ${item.rarity_signals.slice(0, 3).map((s) => s.description).join(", ")}.`
    : "Nessun segnale testuale forte nella scheda release.";

  const scarcityText =
    item.marketplace.numForSale === null
      ? "Disponibilità marketplace non dichiarata."
      : item.marketplace.numForSale <= 3
      ? `Molto poca disponibilità: solo ${item.marketplace.numForSale} copie in vendita.`
      : `Disponibilità attuale: ${item.marketplace.numForSale} copie in vendita.`;

  const demandText =
    item.marketplace.want > 0 || item.marketplace.have > 0
      ? `Domanda Discogs: ${item.marketplace.want} utenti la cercano, ${item.marketplace.have} la possiedono.`
      : "Domanda Discogs non disponibile.";

  const yearText = item.releaseYear ? `Anno release: ${item.releaseYear}.` : "Anno release non disponibile.";
  const formatText = item.formatDetails.length ? `Dettagli formato: ${item.formatDetails.slice(0, 3).join(", ")}.` : "";

  return `${item.estimated_rarity}. ${signalText} ${scarcityText} ${demandText} ${yearText} ${formatText}`.trim();
}

export function matchesGenreFilter(item: DiscogsRadarItem, genreFilter: string): boolean {
  const normalized = genreFilter.trim().toLowerCase();
  if (!normalized) return true;

  const pool = [...item.genres, ...item.styles].map((x) => x.toLowerCase());
  return pool.some((entry) => entry.includes(normalized));
}

export function estimateRarityCategory(score: number): DiscogsRadarItem["estimated_rarity"] {
  if (score >= 80) return "Collectible";
  if (score >= 65) return "Very Rare";
  if (score >= 50) return "Rare";
  if (score >= 35) return "Uncommon";
  return "Common";
}

export async function buildRadarItem(release: DiscogsReleaseDetail): Promise<DiscogsRadarItem> {
  const artist = release.artists?.[0]?.name || "Unknown";
  const signals = extractRaritySignals(release);
  const rarity_score = calculateRarityScore(release, signals);
  const marketplace = {
    have: release.community?.have ?? 0,
    want: release.community?.want ?? 0,
    numForSale: typeof release.num_for_sale === "number" ? release.num_for_sale : null,
    lowestPrice: typeof release.lowest_price === "number" ? release.lowest_price : null,
  };

  const baseItem: DiscogsRadarItem = {
    id: release.id,
    artist,
    title: release.title,
    source: "Discogs",
    releaseYear: release.year || null,
    releaseDate: release.released || null,
    catalogNumber: release.catalog_number || null,
    country: release.country || null,
    format: "Vinyl",
    formatDetails: release.formats?.[0]?.descriptions || [],
    genres: release.genres || [],
    styles: release.styles || [],
    rarity_signals: signals,
    rarity_score,
    estimated_rarity: estimateRarityCategory(rarity_score),
    notes: release.notes || "",
    discogs_url: release.uri || `https://www.discogs.com/release/${release.id}`,
    resource_url: release.resource_url,
    images: release.images?.map(img => ({ uri: img.uri, uri150: img.uri150 })) || [],
    rarity_description: "",
    marketplace,
    preorder: {
      isPreorder: Boolean(release.year && release.year >= new Date().getFullYear()),
      store: null,
      url: release.uri || `https://www.discogs.com/release/${release.id}`,
    },
  };

  return {
    ...baseItem,
    rarity_description: buildRarityDescription(baseItem),
  };
}
