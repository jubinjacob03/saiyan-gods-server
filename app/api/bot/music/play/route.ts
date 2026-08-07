import { NextRequest, NextResponse } from "next/server";

const BOT_URL = process.env.MUSIC_BOT_API_URL!;
const BOT_KEY = process.env.MUSIC_BOT_API_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const response = await fetch(`${BOT_URL}/play`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${BOT_KEY}`,
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
