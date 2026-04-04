import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getMissingEbayConfigKeys, publishVinylToEbay } from "@/lib/ebay";

interface PublishPayload {
  vinyl: {
    id: string;
    title: string;
    artist: string;
    description: string | null;
    price: number;
    condition: string;
    is_sealed?: boolean;
    cover_url: string | null;
    available: boolean;
  };
}

const DEFAULT_ADMIN_EMAIL = "simone.severini@gmail.com";

function getAllowedAdminEmails(): string[] {
  const source = process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
  return source
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function getBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const [type, token] = authHeader.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export async function POST(req: NextRequest) {
  try {
    const missingKeys = getMissingEbayConfigKeys();
    if (missingKeys.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Configurazione eBay incompleta",
          missing: missingKeys,
          note: "Completa le variabili eBay in ambiente e riprova.",
        },
        { status: 503 }
      );
    }

    const token = getBearerToken(req.headers.get("authorization"));
    if (!token) {
      return NextResponse.json({ success: false, error: "Token mancante" }, { status: 401 });
    }

    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData.user?.email) {
      return NextResponse.json({ success: false, error: "Utente non autenticato" }, { status: 401 });
    }

    const allowedAdminEmails = getAllowedAdminEmails();
    if (!allowedAdminEmails.includes(userData.user.email.toLowerCase())) {
      return NextResponse.json({ success: false, error: "Non autorizzato" }, { status: 403 });
    }

    const body = (await req.json()) as PublishPayload;
    if (!body?.vinyl?.id || !body.vinyl.title || !body.vinyl.artist) {
      return NextResponse.json({ success: false, error: "Payload vinile non valido" }, { status: 400 });
    }

    const result = await publishVinylToEbay(body.vinyl);

    return NextResponse.json({
      success: true,
      listingId: result.listingId,
      offerId: result.offerId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore pubblicazione eBay";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
