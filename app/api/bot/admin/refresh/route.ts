import { NextResponse } from "next/server";

const BOT = process.env.BOT_API_URL;
const KEY = process.env.BOT_API_KEY;

export async function POST() {
  try {
    const res = await fetch(`${BOT}/api/admin/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}` },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Failed to reach bot API" }, { status: 502 });
  }
}
