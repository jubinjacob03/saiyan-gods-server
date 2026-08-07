import { NextRequest, NextResponse } from "next/server";

function getBotUrl(botIndex: number) {
  const base = process.env.MUSIC_BOT_API_URL!;
  try {
    const url = new URL(base);
    url.port = (parseInt(url.port || "8000", 10) + botIndex).toString();
    return url.toString().replace(/\/$/, "");
  } catch {
    return base;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const botIndex = body.botIndex || 0;
    const response = await fetch(`${getBotUrl(botIndex)}/play`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MUSIC_BOT_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
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
