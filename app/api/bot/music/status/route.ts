import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const guildId = request.nextUrl.searchParams.get("guildId");
    const response = await fetch(
      `${process.env.MUSIC_BOT_API_URL}/api/music/status?guildId=${guildId}`,
      {
        headers: { Authorization: `Bearer ${process.env.MUSIC_BOT_API_KEY}` },
        cache: "no-store",
      },
    );
    const data = await response.json();
    return NextResponse.json(data, {
      status: response.ok ? 200 : response.status,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to reach bot API" },
      { status: 502 },
    );
  }
}
