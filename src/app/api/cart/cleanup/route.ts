import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    // Verifiche di sicurezza semplice (in produzione usa un token segreto)
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CLEANUP_SECRET_TOKEN || "dev"}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Chiama la funzione PL/pgSQL per pulire le sessioni scadute
    const { data, error } = await supabase.rpc("cleanup_expired_cart_sessions");

    if (error) {
      console.error("Cleanup error:", error);
      return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deletedSessions: data || 0,
      message: "Expired cart sessions cleaned up"
    });
  } catch (error) {
    console.error("Cleanup endpoint error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// Cleanup automatico ogni 1 ora (se vuoi far girare periodicamente)
// Puoi aggiungere questo a un route handler separato con Vercel Cron
