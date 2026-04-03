import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { session_id, items } = await req.json();

    if (!session_id) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    // Controlla se la sessione esiste
    const { data: existing } = await supabase
      .from("cart_sessions")
      .select("*")
      .eq("session_id", session_id)
      .single();

    if (existing) {
      // Update sessione esistente (il trigger estenderà la scadenza)
      await supabase
        .from("cart_sessions")
        .update({ items })
        .eq("session_id", session_id);
    } else {
      // Crea nuova sessione
      await supabase
        .from("cart_sessions")
        .insert([{ session_id, items }]);
    }

    return NextResponse.json({ 
      success: true, 
      session_id,
      message: "Cart synced successfully (24h expiry)" 
    });
  } catch (error) {
    console.error("Cart sync error:", error);
    return NextResponse.json({ error: "Failed to sync cart" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("cart_sessions")
      .select("*")
      .eq("session_id", sessionId)
      .single();

    // Se la sessione non esiste, è una nuova sessione (non scaduta!)
    if (error || !data) {
      return NextResponse.json({ 
        items: [], 
        expired: false,
        expiresInSeconds: 86400, // 24 ore di default per nuova sessione
        isNew: true
      }, { status: 200 });
    }

    // Controlla se scaduto
    const expiresAt = new Date(data.expires_at);
    const isExpired = expiresAt < new Date();

    if (isExpired) {
      return NextResponse.json({ items: [], expired: true }, { status: 200 });
    }

    // Calcola secondi rimanenti
    const expiresInSeconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000);

    return NextResponse.json({ 
      items: data.items || [],
      expired: false,
      expiresInSeconds,
      createdAt: data.created_at
    });
  } catch (error) {
    console.error("Cart fetch error:", error);
    return NextResponse.json({ items: [], error: "Failed to fetch cart" }, { status: 500 });
  }
}
