import { NextRequest, NextResponse } from "next/server";

export async function GET(_request: NextRequest) {
  try {
    const response = await fetch(`${process.env.BOT_API_URL}/api/status`, {
      headers: {
        Authorization: `Bearer ${process.env.BOT_API_KEY}`,
      },
      // Don't cache - always fetch fresh status
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[bot/status] Error:", error);
    return NextResponse.json(
      { error: "Failed to reach bot API" },
      { status: 502 },
    );
  }
}
