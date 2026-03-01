import { NextRequest, NextResponse } from "next/server";

const BOT_URL = process.env.BOT_API_URL!;
const BOT_KEY = process.env.BOT_API_KEY!;

// Handles all direct-action music endpoints: /skip /pause /resume /toggle
// /stop /shuffle /loop /volume /seek /remove /filter /search /queue
// Static segments (play, control, status) take priority in Next.js App Router.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    const { action } = await params;
    const body = await request.json();
    const response = await fetch(`${BOT_URL}/api/music/${action}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${BOT_KEY}`,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.ok ? 200 : response.status });
  } catch {
    return NextResponse.json({ error: "Failed to reach bot API" }, { status: 502 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    const { action } = await params;
    const guildId = request.nextUrl.searchParams.get("guildId");
    const response = await fetch(
      `${BOT_URL}/api/music/${action}?guildId=${guildId}`,
      {
        headers: { Authorization: `Bearer ${BOT_KEY}` },
        cache: "no-store",
      },
    );
    const data = await response.json();
    return NextResponse.json(data, { status: response.ok ? 200 : response.status });
  } catch {
    return NextResponse.json({ error: "Failed to reach bot API" }, { status: 502 });
  }
}
