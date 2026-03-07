import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const discordUserId = session.user?.user_metadata?.provider_id;
    if (!discordUserId) {
      return NextResponse.json(
        { error: "Discord ID not found" },
        { status: 400 }
      );
    }

    const { id: playlistId } = await params;
    const body = await request.json();
    const { songs } = body;

    if (!Array.isArray(songs)) {
      return NextResponse.json(
        { error: "Invalid songs data" },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();

    const { data: playlist, error: playlistError } = await supabase
      .from("music_playlists")
      .select("*")
      .eq("id", playlistId)
      .single();

    if (playlistError) throw playlistError;

    if (playlist.is_locked && playlist.created_by !== discordUserId) {
      return NextResponse.json(
        { error: "This playlist is locked" },
        { status: 403 }
      );
    }

    const updates = songs.map(({ id, position }: any) =>
      supabase
        .from("music_playlist_songs")
        .update({ position })
        .eq("id", id)
        .eq("playlist_id", playlistId)
    );

    await Promise.all(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[playlists/id/songs/reorder] PUT error:", error);
    return NextResponse.json(
      { error: "Failed to reorder songs" },
      { status: 500 }
    );
  }
}
