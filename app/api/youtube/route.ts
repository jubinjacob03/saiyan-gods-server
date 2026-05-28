import { NextRequest, NextResponse } from "next/server";

const MUSIC_BOT_API_URL = process.env.MUSIC_BOT_API_URL;
const MUSIC_BOT_API_KEY = process.env.MUSIC_BOT_API_KEY;

function parseDuration(seconds: number): string {
  if (!seconds) return "0:00";
  const h = Math.floor(seconds / 3600);
  const min = Math.floor((seconds % 3600) / 60);
  const sec = seconds % 60;
  if (h > 0)
    return `${h}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

export async function GET(request: NextRequest) {
  if (!MUSIC_BOT_API_URL || !MUSIC_BOT_API_KEY) {
    return NextResponse.json(
      { error: "Music bot API not configured" },
      { status: 500 },
    );
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  try {
    if (!q) {
      const itunesRes = await fetch("https://itunes.apple.com/us/rss/topsongs/limit=24/json");
      if (itunesRes.ok) {
        const itunesData = await itunesRes.json();
        const videos = (itunesData.feed?.entry || []).map((item: any) => {
          const title = item["im:name"]?.label || "Unknown Title";
          const artist = item["im:artist"]?.label || "Unknown Artist";
          return {
            id: item.id?.attributes?.["im:id"] || Math.random().toString(),
            title: title,
            channel: artist,
            thumbnail: item["im:image"]?.[2]?.label || item["im:image"]?.[0]?.label || "",
            duration: "", // iTunes RSS does not provide full track duration
            url: `scsearch:${title} ${artist}`,
          };
        });
        return NextResponse.json({ videos });
      }
    }

    const response = await fetch(`${MUSIC_BOT_API_URL}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MUSIC_BOT_API_KEY}`,
      },
      body: JSON.stringify({
        query: q,
        limit: 24,
      }),
    });

    if (!response.ok) {
      throw new Error(`Music bot API returned ${response.status}`);
    }

    const data = await response.json();

    const videos = (data.results || []).map((item: any) => ({
      id: item.id || item.url?.split("v=")[1] || "",
      title: item.title || "",
      channel: item.author || "",
      thumbnail: item.thumbnail || "",
      duration: parseDuration(item.duration || 0), // duration now in seconds from zyra
      url: item.url || "",
    }));

    return NextResponse.json({ videos });
  } catch (err) {
    console.error("[music-bot/search]", err);
    return NextResponse.json(
      { error: "Music search failed" },
      { status: 500 },
    );
  }
}
