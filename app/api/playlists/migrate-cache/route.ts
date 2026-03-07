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
        const botUrl = process.env.MUSIC_BOT_API_URL;
        if (!botUrl) {
          throw new Error("MUSIC_BOT_API_URL not configured");
        }

        console.log(`[Migrate] Calling: ${botUrl}/cache-song`);

        const response = await fetch(`${botUrl}/cache-song`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.MUSIC_BOT_API_KEY}`,
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
        results.errors.push(`${url}: ${errorMsg}`);
        console.error(`[Migrate] ❌ Exception: ${url} - ${errorMsg}`);
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
