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
  "Mint":      "Perfetto",
  "Near Mint": "Quasi Perfetto",
  "Very Good": "Molto Buono",
  "Good":      "Buono",
  "Fair":      "Discreto",
  "Poor":      "Mediocre",
};
