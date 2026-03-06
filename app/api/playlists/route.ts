import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const supabase = createClient();

    const { data: playlists, error } = await supabase
      .from("music_playlists")
      .select(`
        *,
        songs:music_playlist_songs(count)
      `)
      .order("position", { ascending: true });

    if (error) throw error;

    const formattedPlaylists = playlists?.map((playlist: any) => ({
      ...playlist,
      song_count: playlist.songs[0]?.count || 0,
      songs: undefined,
    })) || [];

    return NextResponse.json({ playlists: formattedPlaylists });
  } catch (error) {
    console.error("[playlists] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch playlists" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { name } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Playlist name is required" },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const { data: maxPos } = await supabase
      .from("music_playlists")
      .select("position")
      .order("position", { ascending: false })
      .limit(1)
      .single();

    const { data: playlist, error } = await supabase
      .from("music_playlists")
      .insert({
        name: name.trim(),
        created_by: discordUserId,
        position: (maxPos?.position || 0) + 1,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ playlist });
  } catch (error) {
    console.error("[playlists] POST error:", error);
    return NextResponse.json(
      { error: "Failed to create playlist" },
      { status: 500 }
    );
  }
}
