import { NextRequest, NextResponse } from "next/server";

const BOT = process.env.BOT_API_URL;
const KEY = process.env.BOT_API_KEY;
const h = () => ({
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetch(`${BOT}/api/verification/apply`, {
      method: "POST",
      headers: h(),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "Failed to reach bot API" },
      { status: 502 },
    );
  }
}
