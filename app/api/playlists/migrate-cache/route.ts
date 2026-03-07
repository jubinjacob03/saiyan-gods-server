import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: songs, error } = await supabase
      .from("music_playlist_songs")
      .select("youtube_url")
      .order("created_at", { ascending: true });

    if (error) throw error;

    const uniqueUrls = [
      ...new Set(songs?.map((s) => s.youtube_url) || []),
    ].filter(Boolean);

    console.log(`[Migrate] Found ${uniqueUrls.length} unique songs to cache`);

    // Verify zyra bot is reachable
    const botUrl = process.env.BOT_API_URL;
    if (!botUrl) {
      return NextResponse.json(
        { error: "BOT_API_URL not configured" },
        { status: 500 },
      );
    }

    console.log(`[Migrate] Testing connection to: ${botUrl}`);
    try {
      const healthCheck = await fetch(`${botUrl}/api/music/health`, {
        headers: { Authorization: `Bearer ${process.env.BOT_API_KEY}` },
      });
      const healthData = await healthCheck.json().catch(() => ({}));
      console.log(`[Migrate] Health check response:`, healthData);
      if (!healthCheck.ok) {
        return NextResponse.json(
          {
            error: `Zyra bot not reachable at ${botUrl}. Health check failed with status ${healthCheck.status}`,
            details: healthData,
          },
          { status: 502 },
        );
      }
    } catch (healthError: any) {
      console.error(`[Migrate] Health check failed:`, healthError);
      return NextResponse.json(
        {
          error: `Cannot connect to zyra bot at ${botUrl}`,
          details: healthError.message,
          cause: healthError.cause?.message,
        },
        { status: 502 },
      );
    }

    const results = {
      total: uniqueUrls.length,
      successful: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (let i = 0; i < uniqueUrls.length; i++) {
      const url = uniqueUrls[i];
      console.log(
        `[Migrate] Caching ${i + 1}/${uniqueUrls.length}: ${url.substring(0, 50)}...`,
      );

      try {
        console.log(`[Migrate] Calling: ${botUrl}/api/music/cache-song`);

        const response = await fetch(`${botUrl}/api/music/cache-song`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.BOT_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ youtubeUrl: url }),
        });

        console.log(`[Migrate] Response status: ${response.status}`);

        const data = await response
          .json()
          .catch(() => ({ error: "Invalid JSON response" }));
        console.log(`[Migrate] Response data:`, data);

        if (response.ok) {
          results.successful++;
          console.log(`[Migrate] ✅ Cached: ${url.substring(0, 50)}...`);
        } else {
          results.failed++;
          const errorMsg =
            typeof data.error === "string"
              ? data.error
              : JSON.stringify(data.error || data || "Unknown error");
          results.errors.push(`${url}: ${errorMsg}`);
          console.error(`[Migrate] ❌ Failed: ${url} - ${errorMsg}`);
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error: any) {
        results.failed++;
        const errorMsg = error.message || String(error);
        const detailedError = {
          message: error.message,
          cause: error.cause,
          stack: error.stack?.split("\n")[0],
          type: error.constructor?.name,
        };
        console.error(`[Migrate] ❌ Exception: ${url}`, detailedError);
        results.errors.push(
          `${url}: ${errorMsg} (${error.constructor?.name || "Error"})`,
        );
      }
    }

    console.log(
      `[Migrate] Complete: ${results.successful} succeeded, ${results.failed} failed`,
    );

    return NextResponse.json(results);
  } catch (error: any) {
    console.error("[migrate-cache] Error:", error);
    return NextResponse.json(
      { error: error.message || "Migration failed" },
      { status: 500 },
    );
  }
}
