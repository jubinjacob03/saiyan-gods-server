import { NextRequest, NextResponse } from "next/server";

const BOT = process.env.BOT_API_URL;
const KEY = process.env.BOT_API_KEY;
const headers = () => ({ Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" });

export async function GET() {
  try {
    const res = await fetch(`${BOT}/api/private-vc`, { headers: headers(), cache: "no-store" });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Failed to reach bot API" }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetch(`${BOT}/api/private-vc/create`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Failed to reach bot API" }, { status: 502 });
  }
}
