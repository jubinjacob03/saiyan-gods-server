import { NextRequest, NextResponse } from "next/server";

const BOT = process.env.BOT_API_URL;
const KEY = process.env.BOT_API_KEY;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const res = await fetch(
      `${BOT}/api/verification/user-status?userId=${userId}`,
      {
        headers: { Authorization: `Bearer ${KEY}` },
        cache: "no-store",
      },
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "Failed to reach bot API" },
      { status: 502 },
    );
  }
}
