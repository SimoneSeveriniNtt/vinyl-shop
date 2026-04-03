-- =============================================
-- VINYL SHOP - Supabase Database Schema
-- =============================================

-- 1. Generi musicali
CREATE TABLE genres (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Vinili
CREATE TABLE vinyls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  condition TEXT NOT NULL DEFAULT 'Good' CHECK (condition IN ('Mint', 'Near Mint', 'Very Good', 'Good', 'Fair', 'Poor')),
  genre_id UUID REFERENCES genres(id) ON DELETE SET NULL,
  cover_url TEXT,
  is_signed BOOLEAN NOT NULL DEFAULT false,
  available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Immagini aggiuntive per ogni vinile
CREATE TABLE vinyl_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vinyl_id UUID NOT NULL REFERENCES vinyls(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Ordini
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_email TEXT,
  customer_name TEXT,
  total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Dettaglio ordini
CREATE TABLE order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  vinyl_id UUID NOT NULL REFERENCES vinyls(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 1,
  price_at_purchase NUMERIC(10, 2) NOT NULL
);

-- 6. Inserisci generi di default
INSERT INTO genres (name) VALUES
  ('Pop'),
  ('Rock'),
  ('House'),
  ('Rap'),
  ('Hip Hop'),
  ('Jazz'),
  ('Classical'),
  ('Electronic'),
  ('R&B'),
  ('Metal'),
  ('Funk'),
  ('Soul'),
  ('Reggae'),
  ('Country'),
  ('Blues'),
  ('Disco'),
  ('Techno'),
  ('Punk'),
  ('Indie'),
  ('Latin');

-- 7. RLS Policies (Row Level Security)
ALTER TABLE genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE vinyls ENABLE ROW LEVEL SECURITY;
ALTER TABLE vinyl_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Lettura pubblica per catalogo
CREATE POLICY "Public read genres" ON genres FOR SELECT USING (true);
CREATE POLICY "Public read vinyls" ON vinyls FOR SELECT USING (true);
CREATE POLICY "Public read vinyl_images" ON vinyl_images FOR SELECT USING (true);

-- Per admin: insert/update/delete (usa service_role o auth)
CREATE POLICY "Allow all for authenticated" ON vinyls FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all images for authenticated" ON vinyl_images FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all orders" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all order_items" ON order_items FOR ALL USING (true) WITH CHECK (true);

-- 8. Storage bucket per immagini vinili
-- Esegui in Supabase Dashboard > Storage > New Bucket: "vinyl-images" (public)
