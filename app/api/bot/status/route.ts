import { NextRequest, NextResponse } from "next/server";

export async function GET(_request: NextRequest) {
  try {
    const response = await fetch(`${process.env.BOT_API_URL}/api/status`, {
      headers: {
        Authorization: `Bearer ${process.env.BOT_API_KEY}`,
      },
      // Cache at the Next.js server layer for 30 s so every browser request
      // is served from the edge instead of waiting on the Railway bot each time.
      next: { revalidate: 30 },
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
