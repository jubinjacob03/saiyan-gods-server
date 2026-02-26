import { NextResponse } from "next/server";

/**
 * GET /api/bot/ws-token
 * Exchanges the current user session for a short-lived WS token issued by the bot.
 * The browser never sees BOT_API_KEY — this server-side route adds it.
 */
export async function GET() {
  try {
    const response = await fetch(`${process.env.BOT_API_URL}/api/ws-token`, {
      headers: {
        Authorization: `Bearer ${process.env.BOT_API_KEY}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    // Also return the WS URL so the client doesn't need to hardcode it.
    // Convert http(s):// → ws(s)://
    const wsUrl = process.env.BOT_API_URL!.replace(/^http/, "ws") + "/ws";

    return NextResponse.json({
      ...data,
      data: { ...data.data, wsUrl },
    });
  } catch (error) {
    console.error("[bot/ws-token] Error:", error);
    return NextResponse.json(
      { error: "Failed to reach bot API" },
      { status: 502 },
    );
  }
}
