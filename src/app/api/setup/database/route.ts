import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function isMissingTableError(code?: string | null) {
  return code === "PGRST205" || code === "42P01";
}

async function setupDatabase() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Variabili di ambiente non configurate");
    }

    // Crea client con service role (accesso admin)
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const tables = [];
    const diagnostics: Array<{ table: string; code: string | null; message: string }> = [];

    // Controllo watched_artists
    console.log("📋 Controllo tabella watched_artists...");
    try {
      const { error: checkError } = await supabase
        .from("watched_artists")
        .select("*", { count: "exact", head: true });

      if (checkError && isMissingTableError(checkError.code)) {
        console.log("⚠️  Tabella watched_artists non esiste ancora");
        tables.push("watched_artists");
        diagnostics.push({
          table: "watched_artists",
          code: checkError.code || null,
          message: checkError.message,
        });
      } else if (checkError) {
        diagnostics.push({
          table: "watched_artists",
          code: checkError.code || null,
          message: checkError.message,
        });
        console.log("⚠️  Errore controllo watched_artists:", checkError.message);
      } else if (!checkError) {
        console.log("✅ Tabella watched_artists esiste");
      }
    } catch (err) {
      console.log("⚠️  Errore controllo watched_artists:", err);
    }

    // Controllo album_alerts
    console.log("📋 Controllo tabella album_alerts...");
    try {
      const { error: checkError } = await supabase
        .from("album_alerts")
        .select("*", { count: "exact", head: true });

      if (checkError && isMissingTableError(checkError.code)) {
        console.log("⚠️  Tabella album_alerts non esiste ancora");
        tables.push("album_alerts");
        diagnostics.push({
          table: "album_alerts",
          code: checkError.code || null,
          message: checkError.message,
        });
      } else if (checkError) {
        diagnostics.push({
          table: "album_alerts",
          code: checkError.code || null,
          message: checkError.message,
        });
        console.log("⚠️  Errore controllo album_alerts:", checkError.message);
      } else if (!checkError) {
        console.log("✅ Tabella album_alerts esiste");
      }
    } catch (err) {
      console.log("⚠️  Errore controllo album_alerts:", err);
    }

    return {
      success: tables.length === 0,
      missingTables: tables,
      message:
        tables.length === 0
          ? "Tutte le tabelle sono create!"
          : `Tabelle mancanti: ${tables.join(", ")}`,
      diagnostics,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Errore sconosciuto",
    };
  }
}

export async function GET(req: NextRequest) {
  try {
    const result = await setupDatabase();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Setup fallito",
      },
      { status: 500 }
    );
  }
}
