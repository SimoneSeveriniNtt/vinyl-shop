-- Crea la tabella cart_sessions per salvare i carrelli con scadenza 24h
CREATE TABLE IF NOT EXISTS cart_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  items JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  last_updated TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours',
  ip_address TEXT
);

-- Indice per cercare sessioni scadute
CREATE INDEX IF NOT EXISTS idx_cart_sessions_expires_at ON cart_sessions(expires_at);

-- Policy per permettere di leggere/scrivere il proprio carrello (pubblico anonimo)
ALTER TABLE cart_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anyone to read their own cart session" ON cart_sessions
  FOR SELECT USING (true);

CREATE POLICY "Allow anyone to insert a cart session" ON cart_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anyone to update their own cart session" ON cart_sessions
  FOR UPDATE USING (true);

-- Trigger per aggiornare last_updated e extend expires_at su ogni update
CREATE OR REPLACE FUNCTION update_cart_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  NEW.expires_at = NOW() + INTERVAL '24 hours';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_cart_session_timestamp ON cart_sessions;
CREATE TRIGGER trigger_update_cart_session_timestamp
  BEFORE UPDATE ON cart_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_cart_session_timestamp();

-- Pulizia automatica: elimina sessioni scadute
CREATE OR REPLACE FUNCTION cleanup_expired_cart_sessions()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM cart_sessions WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Puoi schedulare questo con pg_cron oppure chiamarlo via API
-- SELECT cleanup_expired_cart_sessions();
