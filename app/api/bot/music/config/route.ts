import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Server-side only — uses service role key, never exposed to client
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("bot_settings")
      .select("value")
      .eq("key", "music_volume")
      .single();
    if (error || !data) return NextResponse.json({ volume: 50 });
    return NextResponse.json({ volume: Number(data.value) });
  } catch {
    return NextResponse.json({ volume: 50 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { volume } = await req.json();
    if (typeof volume !== "number" || volume < 0 || volume > 100) {
      return NextResponse.json({ ok: false, error: "Invalid volume" }, { status: 400 });
    }
    const supabase = getSupabase();
    const { error } = await supabase.from("bot_settings").upsert(
      { key: "music_volume", value: String(Math.round(volume)), updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
