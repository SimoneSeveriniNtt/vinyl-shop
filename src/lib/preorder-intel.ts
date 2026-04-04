import { rarityLabelIt, type DiscogsRadarItem, type RaritySignal } from "@/lib/discogs";

interface WebResult {
  title: string;
  link: string;
  description: string;
  pubDate: string | null;
}

interface FeltrinelliProduct {
  item_name?: string;
  item_author?: string | null;
  item_category?: string | null;
  item_category2?: string | null;
  delivery_availability?: string | null;
  bookability?: boolean;
  price?: string | number;
  item_brand?: string | null;
  vendor?: string | null;
  year_edition?: string | number | null;
  item_id?: string | null;
}

const VINYL_TERMS = /(vinyl|vinile|lp|180g|33 giri)/i;
const PREORDER_TERMS = /(pre[ -]?order|preorder|pre-ordine|in uscita|release date|uscita)/i;
const NON_RECORD_TERMS = /(funko|action figure|figurina|giocattol|merch|t-shirt|cd\b|dvd\b|blu-?ray)/i;
const SIGNAL_PATTERNS: Array<{ type: RaritySignal["type"]; pattern: RegExp; description: string; weight: number }> = [
  { type: "limited", pattern: /(limited|edizione limitata|tiratura limitata|exclusive|esclusiva)/i, description: "Limited Edition", weight: 9 },
  { type: "signed", pattern: /(signed|autographed|firmato|autografato)/i, description: "Signed / Autographed", weight: 10 },
  { type: "colored", pattern: /(colored|coloured|vinile colorato|transparent|trasparente|splatter|marbled)/i, description: "Colored Vinyl", weight: 7 },
  { type: "alt_cover", pattern: /(alternate cover|alternative cover|cover variant|cover alternativa)/i, description: "Alternate Cover", weight: 8 },
  { type: "upcoming", pattern: PREORDER_TERMS, description: "Upcoming / Pre-order", weight: 5 },
];

function decodeEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractStoreName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const parts = host.split(".");
    if (parts.length >= 2) {
      return parts[parts.length - 2];
    }
    return host;
  } catch {
    return "store";
  }
}

function computeSignals(text: string): RaritySignal[] {
  const signals: RaritySignal[] = [];
  for (const rule of SIGNAL_PATTERNS) {
    if (rule.pattern.test(text)) {
      signals.push({
        type: rule.type,
        description: rule.description,
        rarity_weight: rule.weight,
      });
    }
  }
  return signals;
}

function computeScore(signals: RaritySignal[], isPreorder: boolean): number {
  let score = isPreorder ? 45 : 25;
  for (const signal of signals) {
    score += signal.rarity_weight * 3;
  }
  return Math.min(100, score);
}

function toCategory(score: number): DiscogsRadarItem["estimated_rarity"] {
  if (score >= 80) return "Collectible";
  if (score >= 65) return "Very Rare";
  if (score >= 50) return "Rare";
  if (score >= 35) return "Uncommon";
  return "Common";
}

async function fetchBingRss(query: string): Promise<WebResult[]> {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&format=rss&count=20`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "VinylShopRadar/1.0 (+http://vinyl-shop.local)",
      Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return [];
  }

  const xml = await res.text();
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

  return items.slice(0, 20).map((item) => {
    const title = decodeEntities(item.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "");
    const link = decodeEntities(item.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || "");
    const description = decodeEntities(item.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || "");
    const pubDateRaw = decodeEntities(item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] || "");
    const pubDate = pubDateRaw || null;

    return { title, link, description, pubDate };
  });
}

function flattenFeltrinelliImpressions(raw: unknown): FeltrinelliProduct[] {
  if (!Array.isArray(raw)) return [];
  const out: FeltrinelliProduct[] = [];

  for (const entry of raw) {
    if (Array.isArray(entry)) {
      for (const nested of entry) {
        if (Array.isArray(nested)) {
          for (const product of nested) {
            if (product && typeof product === "object") {
              out.push(product as FeltrinelliProduct);
            }
          }
        } else if (nested && typeof nested === "object") {
          out.push(nested as FeltrinelliProduct);
        }
      }
    } else if (entry && typeof entry === "object") {
      out.push(entry as FeltrinelliProduct);
    }
  }

  return out;
}

async function fetchStorePreorders(
  input: { artist?: string; album?: string; genre?: string },
  storeBaseUrl: string,
  storeDefaultName: string
): Promise<DiscogsRadarItem[]> {
  const q = [input.artist, input.album, "vinile"].filter(Boolean).join(" ");
  if (!q.trim()) return [];
  const url = `${storeBaseUrl}/search/?query=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      Accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
  });

  if (!res.ok) return [];

  const html = await res.text();
  const marker = 'dataLayer.push({"ecommerce"';
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return [];

  const jsonStart = markerIndex + "dataLayer.push(".length;
  const scriptEnd = html.indexOf("</script>", jsonStart);
  if (scriptEnd < 0) return [];

  let jsonText = html.slice(jsonStart, scriptEnd).trim();
  if (jsonText.endsWith(";")) {
    jsonText = jsonText.slice(0, -1).trim();
  }
  if (jsonText.endsWith(")")) {
    jsonText = jsonText.slice(0, -1).trim();
  }

  let payload: any;
  try {
    payload = JSON.parse(jsonText);
  } catch {
    return [];
  }

  const products = flattenFeltrinelliImpressions(payload?.ecommerce?.impression);
  const artistLower = (input.artist || "").toLowerCase();
  const albumLower = (input.album || "").toLowerCase();

  const mapped: DiscogsRadarItem[] = [];
  for (const p of products) {
    const title = p.item_name || "";
    const author = p.item_author || "";
    const delivery = p.delivery_availability || "";
    const text = `${title} ${author} ${delivery} ${p.item_category || ""} ${p.item_category2 || ""}`;

    const isVinyl = VINYL_TERMS.test(text);
    const hasNonRecordNoise = NON_RECORD_TERMS.test(text);
    const artistMatch = artistLower ? text.toLowerCase().includes(artistLower) : true;
    const albumMatch = albumLower ? text.toLowerCase().includes(albumLower) : true;
    const isPreorder = /disponibile dal|prenot|preordin|uscita/i.test(delivery) || Boolean(p.bookability);

    if (!isVinyl || hasNonRecordNoise || !artistMatch || !albumMatch) continue;

    const signals = computeSignals(text);
    if (isPreorder) {
      signals.push({ type: "upcoming", description: "Upcoming / Pre-order", rarity_weight: 5 });
    }

    const score = computeScore(signals, isPreorder);
    const category = toCategory(score);
    const categoryIt = rarityLabelIt(category);
    const priceNum = typeof p.price === "number" ? p.price : Number.parseFloat(String(p.price || "").replace(",", "."));

    mapped.push({
      id: -(1000 + mapped.length + 1),
      artist: input.artist || author || "Sconosciuto",
      title,
      source: "Web Preorder Intel",
      releaseYear: p.year_edition ? Number.parseInt(String(p.year_edition), 10) || null : null,
      releaseDate: delivery || null,
      catalogNumber: p.item_id || null,
      country: "IT",
      format: "Vinyl",
      formatDetails: [p.item_brand || "", p.item_category2 || ""].filter(Boolean) as string[],
      genres: input.genre ? [input.genre] : [p.item_category2 || ""].filter(Boolean) as string[],
      styles: [],
      rarity_signals: signals,
      rarity_score: score,
      estimated_rarity: category,
      notes: `Disponibilità: ${delivery || "n/d"}`,
      discogs_url: url,
      resource_url: url,
      images: [],
      rarity_description: `${categoryIt}. ${isPreorder ? "Pre-order attivo" : "Disponibilità standard"}. ${signals.map((s) => s.description).join(", ") || "Nessun segnale specifico"}.`,
      marketplace: {
        have: 0,
        want: 0,
        numForSale: null,
        lowestPrice: Number.isFinite(priceNum) ? priceNum : null,
      },
      preorder: {
        isPreorder,
        store: p.vendor || storeDefaultName,
        url,
      },
    });
  }

  return mapped;
}

export async function searchWebPreorderIntel(input: {
  artist?: string;
  album?: string;
  genre?: string;
  limit?: number;
}): Promise<DiscogsRadarItem[]> {
  const artist = input.artist?.trim() || "";
  const album = input.album?.trim() || "";
  const genre = input.genre?.trim() || "";
  const limit = input.limit ?? 10;

  if (!artist && !album) return [];

  const [feltrinelliItems, ibsItems] = await Promise.all([
    fetchStorePreorders({ artist, album, genre }, "https://www.lafeltrinelli.it", "Feltrinelli"),
    fetchStorePreorders({ artist, album, genre }, "https://www.ibs.it", "IBS"),
  ]);
  const primaryStoreItems = [...feltrinelliItems, ...ibsItems];

  const baseTerm = [artist, album, "vinyl"].filter(Boolean).join(" ");
  const queries = [
    `${baseTerm} pre order limited signed`,
    `${baseTerm} pre-ordine vinile edizione limitata`,
    `${baseTerm} sugar music store feltrinelli amazon ibs`,
    `${baseTerm} release date preorder`,
    genre ? `${baseTerm} ${genre} vinyl preorder` : "",
  ].filter(Boolean);

  const fetched = await Promise.all(queries.map((q) => fetchBingRss(q)));
  const rawResults = fetched.flat();

  const seen = new Set<string>();
  const filtered = rawResults.filter((r) => {
    const key = `${r.title}::${r.link}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);

    const text = `${r.title} ${r.description}`;
    const artistMatch = artist ? text.toLowerCase().includes(artist.toLowerCase()) : true;
    const albumMatch = album ? text.toLowerCase().includes(album.toLowerCase()) : true;
    const vinylMatch = VINYL_TERMS.test(text);
    const preorderMatch = PREORDER_TERMS.test(text);

    return artistMatch && albumMatch && vinylMatch && preorderMatch;
  });

  const fallbackItems: DiscogsRadarItem[] = filtered.slice(0, limit).map((result, index) => {
    const text = `${result.title} ${result.description}`;
    const signals = computeSignals(text);
    const score = computeScore(signals, true);
    const category = toCategory(score);
    const categoryIt = rarityLabelIt(category);
    const store = extractStoreName(result.link);

    return {
      id: -(index + 1),
      artist: artist || "Sconosciuto",
      title: result.title,
      source: "Web Preorder Intel" as const,
      releaseYear: null,
      releaseDate: result.pubDate,
      catalogNumber: null,
      country: null,
      format: "Vinyl",
      formatDetails: [],
      genres: genre ? [genre] : [],
      styles: [],
      rarity_signals: signals,
      rarity_score: score,
      estimated_rarity: category,
      notes: result.description,
      discogs_url: result.link,
      resource_url: result.link,
      images: [],
      rarity_description: `${categoryIt}. Segnali: ${signals.map((s) => s.description).join(", ") || "Pre-order generic"}. Fonte: ${store}.`,
      marketplace: {
        have: 0,
        want: 0,
        numForSale: null,
        lowestPrice: null,
      },
      preorder: {
        isPreorder: true,
        store,
        url: result.link,
      },
    };
  });

  const merged = [...primaryStoreItems, ...fallbackItems].sort((a, b) => b.rarity_score - a.rarity_score);
  const uniq = new Map<string, DiscogsRadarItem>();
  for (const item of merged) {
    const key = `${item.artist}|${item.title}`.toLowerCase();
    if (!uniq.has(key)) {
      uniq.set(key, item);
    }
  }

  return Array.from(uniq.values()).slice(0, limit);
}
