import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

    // Funzione per eseguire query SQL via RPC o query builder
    const tables = [];

    // Tenta di creare watched_artists table
    console.log("📋 Creazione tabella watched_artists...");
    try {
      // Verifica se tabella esiste selezionandola
      const { error: checkError } = await supabase
        .from("watched_artists")
        .select("*", { count: "exact", head: true });

      if (checkError && checkError.code === "PGRST116") {
        // Tabella non esiste, tenta di crearla tramite insert su una view o funzione
        // Dato che non possiamo fare raw SQL, contiamo su creazione manuale
        console.log("⚠️  Tabella watched_artists non esiste ancora");
        tables.push("watched_artists");
      } else if (!checkError) {
        console.log("✅ Tabella watched_artists esiste");
      }
    } catch (err) {
      console.log("⚠️  Errore controllo watched_artists:", err);
    }

    // Tenta di creare album_alerts table
    console.log("📋 Creazione tabella album_alerts...");
    try {
      const { error: checkError } = await supabase
        .from("album_alerts")
        .select("*", { count: "exact", head: true });

      if (checkError && checkError.code === "PGRST116") {
        console.log("⚠️  Tabella album_alerts non esiste ancora");
        tables.push("album_alerts");
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
