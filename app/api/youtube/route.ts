import { NextRequest, NextResponse } from "next/server";

const YT_KEY = process.env.YOUTUBE_API_KEY;
const YT_BASE = "https://www.googleapis.com/youtube/v3";

function parseDuration(iso: string): string {
  const m = iso?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return "0:00";
  const h = parseInt(m[1] || "0");
  const min = parseInt(m[2] || "0");
  const sec = parseInt(m[3] || "0");
  if (h > 0)
    return `${h}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

const MIX_RE = /\b(mix|megamix|compilation|mashup)\b/i;

export async function GET(request: NextRequest) {
  if (!YT_KEY) {
    return NextResponse.json(
      { error: "YOUTUBE_API_KEY not configured" },
      { status: 500 },
    );
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const searchQuery = q;

  try {
    let videoIds: string[] = [];
    const snippets: Record<string, any> = {};

    if (searchQuery) {
      const searchRes = await fetch(
        `${YT_BASE}/search?part=snippet&type=video&videoCategoryId=10` +
          `&q=${encodeURIComponent(searchQuery)}&maxResults=24&key=${YT_KEY}`,
        { next: { revalidate: 60 } },
      );
      const searchData = await searchRes.json();

      // Check for YouTube API errors
      if (searchData.error) {
        console.error("[YouTube API Error]", searchData.error);
        return NextResponse.json(
          { 
            error: searchData.error.message || "YouTube API error",
            details: searchData.error
          },
          { status: searchData.error.code || 500 },
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filtered = (searchData.items ?? []).filter(
        (item: any) => !MIX_RE.test(item.snippet.title),
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      filtered.forEach((i: any) => {
        snippets[i.id.videoId] = i.snippet;
      });
      videoIds = filtered.map((i: any) => i.id.videoId);
    } else {
      const trendRes = await fetch(
        `${YT_BASE}/videos?part=snippet&chart=mostPopular` +
          `&videoCategoryId=10&regionCode=US&maxResults=24&key=${YT_KEY}`,
        { next: { revalidate: 3600 } },
      );
      const trendData = await trendRes.json();

      // Check for YouTube API errors
      if (trendData.error) {
        console.error("[YouTube API Error]", trendData.error);
        return NextResponse.json(
          { 
            error: trendData.error.message || "YouTube API error",
            details: trendData.error
          },
          { status: trendData.error.code || 500 },
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filtered = (trendData.items ?? []).filter(
        (item: any) => !MIX_RE.test(item.snippet.title),
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      filtered.forEach((i: any) => {
        snippets[i.id] = i.snippet;
      });
      videoIds = filtered.map((i: any) => i.id);
    }

    if (!videoIds.length) return NextResponse.json({ videos: [] });

    const detailsRes = await fetch(
      `${YT_BASE}/videos?part=contentDetails,status&id=${videoIds.join(",")}&key=${YT_KEY}`,
      { next: { revalidate: 3600 } },
    );
    const detailsData = await detailsRes.json();

    // Check for YouTube API errors
    if (detailsData.error) {
      console.error("[YouTube API Error]", detailsData.error);
      return NextResponse.json(
        { 
          error: detailsData.error.message || "YouTube API error",
          details: detailsData.error
        },
        { status: detailsData.error.code || 500 },
      );
    }

    const durations: Record<string, string> = {};
    const restrictedIds = new Set<string>();

    (detailsData.items ?? []).forEach((item: any) => {
      durations[item.id] = parseDuration(item.contentDetails.duration);

      // Filter out age-restricted or non-embeddable videos
      const hasAgeRestriction =
        item.contentDetails?.contentRating?.ytRating === "ytAgeRestricted";
      const isNotEmbeddable = item.status?.embeddable === false;

      if (hasAgeRestriction || isNotEmbeddable) {
        restrictedIds.add(item.id);
      }
    });

    const videos = videoIds
      .filter((id) => !restrictedIds.has(id)) // Filter out restricted videos
      .map((id) => ({
        id,
        title: snippets[id]?.title ?? "",
        channel: snippets[id]?.channelTitle ?? "",
        thumbnail:
          snippets[id]?.thumbnails?.medium?.url ??
          snippets[id]?.thumbnails?.default?.url ??
          "",
        duration: durations[id] ?? "0:00",
        url: `https://www.youtube.com/watch?v=${id}`,
      }));

    return NextResponse.json({ videos });
  } catch (err) {
    console.error("[youtube/search]", err);
    return NextResponse.json(
      { error: "YouTube search failed" },
      { status: 500 },
    );
  }
}
