import { NextRequest, NextResponse } from "next/server";

const BOT_URL = process.env.MUSIC_BOT_API_URL!;
const BOT_KEY = process.env.MUSIC_BOT_API_KEY!;

export async function GET(request: NextRequest) {
  try {
    const guildId = request.nextUrl.searchParams.get("guildId");
    const botIndex = request.nextUrl.searchParams.get("botIndex") || "0";
    const response = await fetch(
      `${BOT_URL}/status?guildId=${guildId}&botIndex=${botIndex}`,
      {
        headers: { Authorization: `Bearer ${BOT_KEY}` },
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
