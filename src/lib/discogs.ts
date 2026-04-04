/**
 * Discogs API client for vinyl discovery and rare editions tracking
 * Rate limit: 60 requests per minute (anonymous)
 */

const DISCOGS_BASE = "https://api.discogs.com";
const USER_AGENT = "VinylShopRadar/1.0 (+http://vinyl-shop.local)";

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
}

export interface RaritySignal {
  type: "limited" | "colored" | "numbered" | "box_set" | "reissue" | "original_pressing" | "special_edition" | "picture_disc";
  description: string;
  rarity_weight: number; // 1-10
}

export interface DiscogsRadarItem {
  id: number;
  artist: string;
  title: string;
  releaseYear: number | null;
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
}

async function fetchDiscogs(path: string): Promise<any> {
  const url = `${DISCOGS_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Discogs API error: ${res.status}`);
  }

  return res.json();
}

export async function searchDiscogsReleases(
  artist: string,
  album?: string,
  limit = 20
): Promise<DiscogsRelease[]> {
  const query = album ? `${artist} ${album}` : artist;
  const encoded = encodeURIComponent(query);

  const data = await fetchDiscogs(
    `/database/search?q=${encoded}&type=release&format=Vinyl&limit=${limit}`
  );

  return data.results || [];
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
  ];

  for (const { pattern, type, desc, weight } of patterns) {
    if (pattern.test(text)) {
      signals.push({ type, description: desc, rarity_weight: weight });
    }
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

  return Math.min(100, score);
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

  return {
    id: release.id,
    artist,
    title: release.title,
    releaseYear: release.year || null,
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
  };
}
