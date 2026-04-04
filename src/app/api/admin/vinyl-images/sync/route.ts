import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const [type, token] = authHeader.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

function getAllowedAdminEmails(): string[] {
  const source = process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "simone.severini@gmail.com";
  return source
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req.headers.get("authorization"));
    if (!token) {
      return NextResponse.json({ success: false, error: "Token mancante" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return NextResponse.json({ success: false, error: "Config Supabase mancante" }, { status: 500 });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData.user?.email) {
      return NextResponse.json({ success: false, error: "Utente non autenticato" }, { status: 401 });
    }

    const allowedAdminEmails = getAllowedAdminEmails();
    if (!allowedAdminEmails.includes(userData.user.email.toLowerCase())) {
      return NextResponse.json({ success: false, error: "Non autorizzato" }, { status: 403 });
    }

    const body = await req.json();
    const vinylId = String(body?.vinylId || "").trim();
    const images = Array.isArray(body?.images) ? body.images : [];

    if (!vinylId) {
      return NextResponse.json({ success: false, error: "vinylId mancante" }, { status: 400 });
    }

    if (!Array.isArray(images) || images.some((img) => typeof img !== "string")) {
      return NextResponse.json({ success: false, error: "Formato immagini non valido" }, { status: 400 });
    }

    const normalizedImages = images.map((img: string) => img.trim()).filter(Boolean);

    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { error: deleteError } = await serviceClient.from("vinyl_images").delete().eq("vinyl_id", vinylId);
    if (deleteError) {
      return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 });
    }

    if (normalizedImages.length > 0) {
      const rows = normalizedImages.map((imageUrl, index) => ({
        vinyl_id: vinylId,
        image_url: imageUrl,
        sort_order: index,
      }));

      const { error: insertError } = await serviceClient.from("vinyl_images").insert(rows);
      if (insertError) {
        return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, count: normalizedImages.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync immagini fallito";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
