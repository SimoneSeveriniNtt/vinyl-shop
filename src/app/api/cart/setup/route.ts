import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    // Check if table exists
    const { data, error } = await supabase
      .from("cart_sessions")
      .select("*")
      .limit(1);

    if (!error) {
      return NextResponse.json({ success: true, message: "Table already exists" });
    }

    // Crea la tabella e tutto il necessario
    const sqlStatements = `
      CREATE TABLE IF NOT EXISTS cart_sessions (
        session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        items JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW(),
        last_updated TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours',
        ip_address TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_cart_sessions_expires_at ON cart_sessions(expires_at);

      ALTER TABLE cart_sessions ENABLE ROW LEVEL SECURITY;

      Drop POLICY IF EXISTS "Allow anyone to read their own cart session" ON cart_sessions;
      Drop POLICY IF EXISTS "Allow anyone to insert a cart session" ON cart_sessions;
      Drop POLICY IF EXISTS "Allow anyone to update their own cart session" ON cart_sessions;

      CREATE POLICY "Allow anyone to read their own cart session" ON cart_sessions
        FOR SELECT USING (true);

      CREATE POLICY "Allow anyone to insert a cart session" ON cart_sessions
        FOR INSERT WITH CHECK (true);

      CREATE POLICY "Allow anyone to update their own cart session" ON cart_sessions
        FOR UPDATE USING (true);

      CREATE OR REPLACE FUNCTION update_cart_session_timestamp()
      RETURNS TRIGGER AS $trigger$
      BEGIN
        NEW.last_updated = NOW();
        NEW.expires_at = NOW() + INTERVAL '24 hours';
        RETURN NEW;
      END;
      $trigger$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_update_cart_session_timestamp ON cart_sessions;
      CREATE TRIGGER trigger_update_cart_session_timestamp
        BEFORE UPDATE ON cart_sessions
        FOR EACH ROW
        EXECUTE FUNCTION update_cart_session_timestamp();

      CREATE OR REPLACE FUNCTION cleanup_expired_cart_sessions()
      RETURNS integer AS $cleanup$
      DECLARE
        deleted_count integer;
      BEGIN
        DELETE FROM cart_sessions WHERE expires_at < NOW();
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RETURN deleted_count;
      END;
      $cleanup$ LANGUAGE plpgsql;
    `;

    // Esegui via RPC se possibile, altrimenti usa il client
    const statements = sqlStatements
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      try {
        const { error: execError } = await supabase.rpc("exec_sql", {
          sql_query: statement,
        });

        if (execError && !execError.toString().includes("exec_sql")) {
          console.warn("Statement execution warning:", execError);
        }
      } catch (queryError) {
        console.warn("Query execution skipped (expected if RPC doesn't exist):", queryError);
      }
    }

    // Verifica se la tabella è stata creata
    const { error: checkError } = await supabase
      .from("cart_sessions")
      .select("*")
      .limit(1);

    if (!checkError) {
      return NextResponse.json({
        success: true,
        message: "Cart sessions table setup complete",
      });
    }

    return NextResponse.json({
      success: false,
      message: "Table creation may require manual SQL execution. Check Supabase console.",
      hint: "Go to SQL Editor and run: CREATE TABLE cart_sessions (...)",
    });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json({
      success: false,
      error: String(error),
      message: "Check server logs for details",
    }, { status: 500 });
  }
}
