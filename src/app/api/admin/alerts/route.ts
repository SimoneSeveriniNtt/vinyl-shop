import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

function isMissingTableError(code?: string | null) {
  return code === "PGRST205" || code === "42P01";
}

async function isAdminAuthenticated(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.slice(7);

  try {
    const { data, error } = await supabase.auth.getUser(token);
    return !error && !!data.user;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const isAuthenticated = await isAdminAuthenticated(req);
    if (!isAuthenticated) {
      return NextResponse.json({ success: false, error: "Non autorizzato" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const searchArtist = (searchParams.get("search") || "").trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") || "20", 10)));
    const offset = (page - 1) * perPage;

    let alertsQuery = supabase
      .from("album_alerts")
      .select("*", { count: "exact" })
      .order("discovered_at", { ascending: false })
      .range(offset, offset + perPage - 1);

    if (searchArtist) {
      alertsQuery = alertsQuery.ilike("artist_name", `%${searchArtist}%`);
    }

    const [{ data: watchedArtists, error: watchedError }, { data: albumAlerts, error: alertsError, count: alertsTotal }] =
      await Promise.all([
        supabase
          .from("watched_artists")
          .select("*")
          .eq("is_active", true)
          .order("added_at", { ascending: false }),
        alertsQuery,
      ]);

    if (watchedError && isMissingTableError(watchedError.code)) {
      return NextResponse.json({
        success: true,
        watchedArtists: [],
        albumAlerts: [],
        setupRequired: true,
        missingTables: ["watched_artists", "album_alerts"],
        warning: "Tabelle alert non trovate nel database. Esegui il bootstrap SQL per watched_artists e album_alerts.",
        code: watchedError.code || null,
      });
    }

    if (alertsError && isMissingTableError(alertsError.code)) {
      return NextResponse.json({
        success: true,
        watchedArtists: watchedArtists || [],
        albumAlerts: [],
        setupRequired: true,
        missingTables: ["album_alerts"],
        warning: "Tabella album_alerts non trovata nel database. Esegui il bootstrap SQL.",
        code: alertsError.code || null,
      });
    }

    if (watchedError) {
      return NextResponse.json(
        {
          success: false,
          error: watchedError.message,
          code: watchedError.code || null,
          details: watchedError.details || null,
        },
        { status: 400 }
      );
    }

    if (alertsError) {
      return NextResponse.json(
        {
          success: false,
          error: alertsError.message,
          code: alertsError.code || null,
          details: alertsError.details || null,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      watchedArtists: watchedArtists || [],
      albumAlerts: albumAlerts || [],
      alertsPagination: {
        total: alertsTotal ?? 0,
        page,
        perPage,
        totalPages: Math.ceil((alertsTotal ?? 0) / perPage),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Errore caricamento alerts",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const isAuthenticated = await isAdminAuthenticated(req);
    if (!isAuthenticated) {
      return NextResponse.json({ success: false, error: "Non autorizzato" }, { status: 401 });
    }

    const body = await req.json();
    const action = body?.action;

    if (action === "addArtist") {
      const artistName = String(body?.artistName || "").trim();
      const genre = String(body?.genre || "").trim() || null;

      if (!artistName) {
        return NextResponse.json({ success: false, error: "Nome artista mancante" }, { status: 400 });
      }

      const { error } = await supabase.from("watched_artists").insert({
        artist_name: artistName,
        artist_name_lower: artistName.toLowerCase(),
        genre,
      });

      if (error) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
            code: error.code || null,
            details: error.details || null,
          },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true });
    }

    if (action === "removeArtist") {
      const artistId = String(body?.artistId || "").trim();
      if (!artistId) {
        return NextResponse.json({ success: false, error: "ID artista mancante" }, { status: 400 });
      }

      const { error } = await supabase
        .from("watched_artists")
        .update({ is_active: false })
        .eq("id", artistId);

      if (error) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
            code: error.code || null,
            details: error.details || null,
          },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true });
    }

    if (action === "updateAlertStatus") {
      const alertId = String(body?.alertId || "").trim();
      const status = String(body?.status || "").trim();

      if (!alertId || !["viewed", "purchased", "dismissed"].includes(status)) {
        return NextResponse.json({ success: false, error: "Parametri status non validi" }, { status: 400 });
      }

      const { error } = await supabase
        .from("album_alerts")
        .update({
          status,
          notified_at: status === "viewed" ? new Date().toISOString() : null,
        })
        .eq("id", alertId);

      if (error) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
            code: error.code || null,
            details: error.details || null,
          },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Azione non supportata" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Errore aggiornamento alerts",
      },
      { status: 500 }
    );
  }
}
