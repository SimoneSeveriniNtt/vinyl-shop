import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const BUCKET_NAME = "vinyl-images";
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

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

async function ensureBucketExists(serviceClient: any) {
  const { data: buckets, error: listError } = await serviceClient.storage.listBuckets();
  if (listError) throw new Error(`Storage list error: ${listError.message}`);

  const found = (buckets || []).some((bucket: { id?: string; name?: string }) => {
    return bucket.name === BUCKET_NAME || bucket.id === BUCKET_NAME;
  });
  if (found) return;

  const { error: createError } = await serviceClient.storage.createBucket(BUCKET_NAME, {
    public: true,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
    fileSizeLimit: MAX_SIZE_BYTES,
  });

  if (createError && !createError.message.toLowerCase().includes("already")) {
    throw new Error(`Storage create bucket error: ${createError.message}`);
  }
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

    const formData = await req.formData();
    const file = formData.get("file");
    const fileName = String(formData.get("fileName") || "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "File non valido" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ success: false, error: "Il file deve essere un'immagine" }, { status: 400 });
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ success: false, error: "L'immagine non puo superare 5MB" }, { status: 400 });
    }

    const extFromName = fileName.includes(".") ? fileName.split(".").pop() : "";
    const safeExt = (extFromName || file.type.split("/")[1] || "jpg").replace(/[^a-zA-Z0-9]/g, "");
    const finalName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
    const filePath = `uploads/${finalName}`;

    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    await ensureBucketExists(serviceClient);

    const bytes = await file.arrayBuffer();
    const { error: uploadError } = await serviceClient.storage
      .from(BUCKET_NAME)
      .upload(filePath, bytes, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ success: false, error: uploadError.message }, { status: 500 });
    }

    const {
      data: { publicUrl },
    } = serviceClient.storage.from(BUCKET_NAME).getPublicUrl(filePath);

    return NextResponse.json({ success: true, publicUrl, filePath });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload fallito";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
