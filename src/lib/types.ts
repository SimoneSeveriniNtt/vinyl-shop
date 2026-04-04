export interface Genre {
  id: string;
  name: string;
}

export interface Vinyl {
  id: string;
  title: string;
  artist: string;
  description: string | null;
  price: number;
  condition: string;
  is_sealed?: boolean;
  genre_id: string | null;
  cover_url: string | null;
  available: boolean;
  is_signed: boolean;
  release_year: number | null;
  created_at: string;
  updated_at: string;
  genres?: Genre | null;
  vinyl_images?: VinylImage[];
}

export interface VinylImage {
  id: string;
  vinyl_id: string;
  image_url: string;
  sort_order: number;
}

export interface CartItem {
  vinyl: Vinyl;
  quantity: number;
}

export interface Order {
  id: string;
  customer_email: string | null;
  customer_name: string | null;
  total: number;
  status: string;
  created_at: string;
}

export const CONDITIONS = ["Mint", "Near Mint", "Very Good", "Good", "Fair", "Poor"] as const;

export const CONDITION_LABELS: Record<string, string> = {
  "Sealed":    "Sigillato",
  "Mint":      "Perfetto",
  "Near Mint": "Quasi Perfetto",
  "Very Good": "Molto Buono",
  "Good":      "Buono",
  "Fair":      "Discreto",
  "Poor":      "Mediocre",
};

export function parseCondition(condition: string): { quality: string; sealed: boolean } {
  if (!condition) return { quality: "Good", sealed: false };

  const raw = condition.trim();
  if (!raw) return { quality: "Good", sealed: false };

  if (/^sealed$/i.test(raw) || /^sigillat/i.test(raw)) {
    return { quality: "Mint", sealed: true };
  }

  let sealed = false;
  let quality = raw;

  if (/^sealed\s*[-:/|]\s*/i.test(quality)) {
    sealed = true;
    quality = quality.replace(/^sealed\s*[-:/|]\s*/i, "").trim();
  }

  if (/\((sealed|sigillat[oa]?)\)$/i.test(quality)) {
    sealed = true;
    quality = quality.replace(/\((sealed|sigillat[oa]?)\)$/i, "").trim();
  }

  if (!CONDITIONS.includes(quality as (typeof CONDITIONS)[number])) {
    quality = "Good";
  }

  return { quality, sealed };
}

export function formatCondition(quality: string, sealed: boolean): string {
  const safeQuality = CONDITIONS.includes(quality as (typeof CONDITIONS)[number]) ? quality : "Good";
  return sealed ? `Sealed - ${safeQuality}` : safeQuality;
}

export function getConditionLabel(condition: string, sealedOverride?: boolean): string {
  const parsed = parseCondition(condition);
  const sealed = sealedOverride ?? parsed.sealed;
  const qualityLabel = CONDITION_LABELS[parsed.quality] || parsed.quality;
  return sealed ? `Sigillato - ${qualityLabel}` : qualityLabel;
}

export function getConditionQuality(condition: string): string {
  return parseCondition(condition).quality;
}

export function isConditionSealed(condition: string, sealedOverride?: boolean): boolean {
  return sealedOverride ?? parseCondition(condition).sealed;
}
