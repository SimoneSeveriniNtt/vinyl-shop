-- =============================================
-- ALBUM ALERTS - Supabase Schema Addition
-- =============================================

-- 1. Artisti da monitorare
CREATE TABLE watched_artists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  artist_name TEXT NOT NULL,
  artist_name_lower TEXT NOT NULL UNIQUE,
  genre TEXT, -- e.g., "Rap", "Pop", "Hip Hop"
  added_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  last_check TIMESTAMPTZ
);

-- 2. Album trovati & notifiche
CREATE TABLE album_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  artist_id UUID REFERENCES watched_artists(id) ON DELETE CASCADE,
  artist_name TEXT NOT NULL,
  album_title TEXT NOT NULL,
  release_date TEXT, -- e.g., "15 Aprile 2026"
  source TEXT NOT NULL, -- "Feltrinelli", "IBS", "Discogs", "Spotify"
  retailer_url TEXT,
  cover_url TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'viewed', 'purchased', 'dismissed')), -- "new", "viewed", "purchased", "dismissed"
  edition_details TEXT, -- "White Colored Vinyl Limited Edition", "Numerato 100 copie", etc.
  price_eur NUMERIC(10, 2),
  discovered_at TIMESTAMPTZ DEFAULT now(),
  notified_at TIMESTAMPTZ
);

-- 3. RLS Policies
ALTER TABLE watched_artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE album_alerts ENABLE ROW LEVEL SECURITY;

-- Allow all for authenticated (admin only via auth context check)
CREATE POLICY "Allow all watched_artists" ON watched_artists FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all album_alerts" ON album_alerts FOR ALL USING (true) WITH CHECK (true);

-- 4. Index per velocità
CREATE INDEX idx_watched_artists_active ON watched_artists(is_active) WHERE is_active = true;
CREATE INDEX idx_album_alerts_status ON album_alerts(status);
CREATE INDEX idx_album_alerts_artist_id ON album_alerts(artist_id);
CREATE INDEX idx_album_alerts_created ON album_alerts(discovered_at DESC);

-- Evita duplicati semantici sullo stesso retailer (stesso artista+titolo normalizzati)
CREATE UNIQUE INDEX idx_album_alerts_dedup_norm ON album_alerts (
  lower(trim(artist_name)),
  lower(trim(regexp_replace(album_title, '\\s+', ' ', 'g'))),
  source
);
