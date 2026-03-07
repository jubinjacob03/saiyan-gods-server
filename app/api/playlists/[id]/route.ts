import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getServerSession } from "@/lib/supabase-server";

const OWNER_ROLE_ID = "1473075468088377352";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    const { data: playlist, error: playlistError } = await supabase
      .from("music_playlists")
      .select("*")
      .eq("id", id)
      .single();

    if (playlistError) throw playlistError;

    const { data: songs, error: songsError } = await supabase
      .from("music_playlist_songs")
      .select("*")
      .eq("playlist_id", id)
      .order("position", { ascending: true });

    if (songsError) throw songsError;

    return NextResponse.json({ playlist, songs: songs || [] });
  } catch (error) {
    console.error("[playlists/id] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch playlist" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
        { status: 400 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { name, is_locked } = body;

    const supabase = await createServerSupabaseClient();

    const { data: playlist, error: fetchError } = await supabase
      .from("music_playlists")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError) throw fetchError;

    if (playlist.created_by !== discordUserId) {
      return NextResponse.json(
        { error: "Only the creator can modify this playlist" },
        { status: 403 }
      );
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name.trim();
    if (is_locked !== undefined) updates.is_locked = is_locked;

    const { data: updated, error: updateError } = await supabase
      .from("music_playlists")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ playlist: updated });
  } catch (error) {
    console.error("[playlists/id] PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update playlist" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const discordUserId = session.user?.user_metadata?.provider_id;
    const userRoles = session.user?.user_metadata?.roles || [];
    const isOwner = userRoles.includes(OWNER_ROLE_ID);

    if (!discordUserId) {
      return NextResponse.json(
        { error: "Discord ID not found" },
        { status: 400 }
      );
    }

    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    const { data: playlist, error: fetchError } = await supabase
      .from("music_playlists")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError) throw fetchError;

    if (!isOwner && playlist.created_by !== discordUserId) {
      return NextResponse.json(
        { error: "Permission denied" },
        { status: 403 }
      );
    }

    const { error: deleteError } = await supabase
      .from("music_playlists")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[playlists/id] DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete playlist" },
      { status: 500 }
    );
  }
}
