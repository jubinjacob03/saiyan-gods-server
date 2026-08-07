import { NextRequest, NextResponse } from "next/server";

function getBotUrl(botIndex: string) {
  const base = process.env.MUSIC_BOT_API_URL!;
  try {
    const url = new URL(base);
    const port =
      parseInt(url.port || "8000", 10) + parseInt(botIndex || "0", 10);
    url.port = port.toString();
    return url.toString().replace(/\/$/, "");
  } catch {
    return base;
  }
}

export async function GET(request: NextRequest) {
  try {
    const guildId = request.nextUrl.searchParams.get("guildId");
    const botIndex = request.nextUrl.searchParams.get("botIndex") || "0";
    const response = await fetch(
      `${getBotUrl(botIndex)}/status?guildId=${guildId}`,
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
