import { NextRequest, NextResponse } from "next/server";

const BOT_URL = process.env.BOT_API_URL!;
const BOT_KEY = process.env.BOT_API_KEY!;

// Handles all direct-action music endpoints: /skip /pause /resume /toggle
// /stop /shuffle /loop /volume /remove /search /queue
// Note: seek and filter not supported in yt-dlp implementation
// Static segments (play, control, status) take priority in Next.js App Router.

const getTargetUrl = (action: string, botIndex: string, searchParams?: string) => {
  try {
    const url = new URL(BOT_URL);
    const basePort = parseInt(url.port || "8000", 10);
    const index = parseInt(botIndex || "0", 10);
    if (!isNaN(basePort) && !isNaN(index)) {
      url.port = (basePort + index).toString();
    }
    const baseUrl = url.toString().replace(/\/$/, "");
    return `${baseUrl}/api/music/${action}${searchParams ? `?${searchParams}` : ""}`;
  } catch {
    return `${BOT_URL}/api/music/${action}${searchParams ? `?${searchParams}` : ""}`;
  }
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    const { action } = await params;
    const body = await request.json();
    const botIndex = request.nextUrl.searchParams.get("botIndex") || body.botIndex || "0";
    
    const response = await fetch(getTargetUrl(action, botIndex.toString()), {
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    const { action } = await params;
    const botIndex = request.nextUrl.searchParams.get("botIndex") || "0";
    const guildId = request.nextUrl.searchParams.get("guildId") || "";
    
    const response = await fetch(
      getTargetUrl(action, botIndex, `guildId=${guildId}&botIndex=${botIndex}`),
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
