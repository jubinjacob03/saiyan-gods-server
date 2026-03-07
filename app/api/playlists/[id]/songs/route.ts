import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  getServerSession,
} from "@/lib/supabase-server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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

    const { id: playlistId } = await params;
    const body = await request.json();
    const {
      youtube_url,
      song_title,
      song_channel,
      song_thumbnail,
      song_duration,
    } = body;

    if (!youtube_url || !song_title) {
      return NextResponse.json(
        { error: "YouTube URL and title are required" },
        { status: 400 },
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
        { status: 403 },
      );
    }

    const { data: existingSong } = await supabase
      .from("music_playlist_songs")
      .select("id")
      .eq("playlist_id", playlistId)
      .eq("youtube_url", youtube_url)
      .single();

    if (existingSong) {
      return NextResponse.json(
        { error: "Song already exists in this playlist" },
        { status: 409 },
      );
    }

    const { data: maxPos } = await supabase
      .from("music_playlist_songs")
      .select("position")
      .eq("playlist_id", playlistId)
      .order("position", { ascending: false })
      .limit(1)
      .single();

    const { data: song, error: songError } = await supabase
      .from("music_playlist_songs")
      .insert({
        playlist_id: playlistId,
        youtube_url,
        song_title,
        song_channel: song_channel || "",
        song_thumbnail: song_thumbnail || "",
        song_duration: song_duration || "",
        position: (maxPos?.position || 0) + 1,
        added_by: discordUserId,
      })
      .select()
      .single();

    if (songError) throw songError;

    fetch(`${process.env.BOT_API_URL}/cache-song`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.BOT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ youtubeUrl: youtube_url }),
    }).catch((err) =>
      console.error("[cache-song] Background caching failed:", err),
    );

    return NextResponse.json({ song });
  } catch (error) {
    console.error("[playlists/id/songs] POST error:", error);
    return NextResponse.json(
      { error: "Failed to add song to playlist" },
      { status: 500 },
    );
  }
}
