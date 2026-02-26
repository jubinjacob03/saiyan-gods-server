import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const guildId = process.env.NEXT_PUBLIC_DISCORD_GUILD_ID;

    const response = await fetch(
      `${process.env.BOT_API_URL}/api/channels?guildId=${guildId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.BOT_API_KEY}`,
        },
        cache: "no-store",
      },
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[bot/channels] Error:", error);
    return NextResponse.json(
      { error: "Failed to reach bot API" },
      { status: 502 },
    );
  }
}
