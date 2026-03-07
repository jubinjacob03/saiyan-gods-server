import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  getServerSession,
} from "@/lib/supabase-server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; songId: string }> },
) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const discordUserId = session.user?.user_metadata?.provider_id;
    if (!discordUserId) {
      return NextResponse.json(
        { error: "Discord ID not found" },
        { status: 400 },
      );
    }

    const { id: playlistId, songId } = await params;
    const supabase = await createServerSupabaseClient();

    const { data: playlist, error: playlistError } = await supabase
      .from("music_playlists")
      .select("*")
      .eq("id", playlistId)
      .single();

    if (playlistError) throw playlistError;

    const { data: song, error: songError } = await supabase
      .from("music_playlist_songs")
      .select("*")
      .eq("id", songId)
      .eq("playlist_id", playlistId)
      .single();

    if (songError) throw songError;

    if (playlist.is_locked && playlist.created_by !== discordUserId) {
      return NextResponse.json(
        { error: "This playlist is locked" },
        { status: 403 },
      );
    }

    if (
      !playlist.is_locked &&
      song.added_by !== discordUserId &&
      playlist.created_by !== discordUserId
    ) {
      return NextResponse.json(
        { error: "You can only delete your own songs" },
        { status: 403 },
      );
    }

    const { error: deleteError } = await supabase
      .from("music_playlist_songs")
      .delete()
      .eq("id", songId);

    if (deleteError) throw deleteError;

    fetch(`${process.env.MUSIC_BOT_API_URL}/delete-cache`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${process.env.BOT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ youtubeUrl: song.youtube_url }),
    }).catch((err) =>
      console.error("[delete-cache] Background deletion failed:", err),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[playlists/id/songs/songId] DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete song" },
      { status: 500 },
    );
  }
}
