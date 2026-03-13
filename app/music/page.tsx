"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import { getSession } from "@/lib/auth";
import {
  musicPlay,
  musicStatus,
  musicSkip,
  musicToggle,
  musicStop,
  musicShuffle,
  musicLoop,
  musicVolume,
  type MusicStatus,
} from "@/lib/music-api";
import { motion, AnimatePresence } from "framer-motion";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ConfirmDialog from "@/components/ConfirmDialog";

interface Video {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration: string;
  url: string;
}

interface VoiceChannel {
  id: string;
  name: string;
  memberCount: number;
  memberIds?: string[];
}

interface Playlist {
  id: string;
  name: string;
  created_by: string;
  creator_name?: string;
  is_locked: boolean;
  position: number;
  created_at: string;
  updated_at: string;
  song_count: number;
  thumbnail: string | null;
}

interface PlaylistSong {
  id: string;
  playlist_id: string;
  youtube_url: string;
  song_title: string;
  song_channel: string;
  song_thumbnail: string;
  song_duration: string;
  position: number;
  added_by: string;
  adder_name?: string;
  created_at: string;
}

interface ContextMenu {
  video: Video;
  x: number;
  y: number;
}

const GUILD_ID = process.env.NEXT_PUBLIC_DISCORD_GUILD_ID!;
const OWNER_ROLE_ID = "1473075468088377352";

function VolumeIcon({ vol }: { vol: number }) {
  if (vol === 0)
    return (
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
        />
      </svg>
    );
  if (vol < 50)
    return (
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15.536 8.464a5 5 0 010 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
        />
      </svg>
    );
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.536 8.464a5 5 0 010 7.072M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
      />
    </svg>
  );
}

export default function MusicPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [channels, setChannels] = useState<VoiceChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [videos, setVideos] = useState<Video[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [loadingPlay, setLoadingPlay] = useState<string | null>(null);
  const [status, setStatus] = useState<MusicStatus | null>(null);
  const [volume, setVolume] = useState(() => {
    if (typeof window === "undefined") return 50;
    const saved = localStorage.getItem("music_volume");
    return saved !== null ? Number(saved) : 50;
  });
  const volumeSyncedRef = useRef(false);
  const [showQueue, setShowQueue] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [optimisticQueue, setOptimisticQueue] = useState<
    {
      id: string;
      title: string;
      channel: string;
      thumbnail: string;
      duration: string;
    }[]
  >([]);

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [playlistPanelOpen, setPlaylistPanelOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [savingPlaylist, setSavingPlaylist] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [editPlaylistName, setEditPlaylistName] = useState("");
  const [deletePlaylistTarget, setDeletePlaylistTarget] =
    useState<Playlist | null>(null);
  const [deletePlaylistDialogOpen, setDeletePlaylistDialogOpen] =
    useState(false);
  const [selectedPlaylistForView, setSelectedPlaylistForView] =
    useState<Playlist | null>(null);
  const [playlistSongs, setPlaylistSongs] = useState<PlaylistSong[]>([]);
  const [draggedSongIndex, setDraggedSongIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [loadingPlaylistSongs, setLoadingPlaylistSongs] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [addingToPlaylist, setAddingToPlaylist] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rapidPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rapidTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitioningRef = useRef(false);
  const preActionUrlRef = useRef<string | null>(null);
  const currentSongUrlRef = useRef<string | null>(null);
  const prevQueueLengthRef = useRef(0);
  const fetchStatusRef = useRef<() => void>(() => {});

  const discordUserId: string | undefined =
    session?.user?.user_metadata?.provider_id;

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    getSession().then(setSession);
  }, []);

  const fetchVoiceChannels = useCallback(async () => {
    if (!GUILD_ID) return;
    try {
      const r = await fetch("/api/bot/channels");
      const d = await r.json();
      const vcs: VoiceChannel[] = d?.data ?? [];
      setChannels((prev) => {
        if (prev.length === 0) {
          const lobby = vcs.find((c) => c.name.toLowerCase().includes("lobby"));
          setSelectedChannel(lobby?.id ?? vcs[0]?.id ?? "");
        }
        return vcs;
      });
    } catch {}
  }, []);

  useEffect(() => {
    fetchVoiceChannels();
    const interval = setInterval(fetchVoiceChannels, 10000);
    return () => clearInterval(interval);
  }, [fetchVoiceChannels]);

  useEffect(() => {
    if (!discordUserId || channels.length === 0) return;
    const userCh = channels.find((c) => c.memberIds?.includes(discordUserId));
    if (userCh) setSelectedChannel(userCh.id);
  }, [discordUserId, channels]);

  useEffect(() => {
    currentSongUrlRef.current = status?.song?.url ?? null;
  }, [status]);

  useEffect(() => {
    const len = status?.queueLength ?? 0;
    if (len > 1 && len > prevQueueLengthRef.current) setShowQueue(true);
    if (status?.queue && status.queue.length > 0) {
      const realNames = new Set(status.queue.map((q) => q.name));
      setOptimisticQueue((prev) => prev.filter((o) => !realNames.has(o.title)));
    }
    prevQueueLengthRef.current = len;
  }, [status?.queueLength, status?.queue]);

  const stopRapidPoll = useCallback(() => {
    if (rapidPollRef.current) {
      clearInterval(rapidPollRef.current);
      rapidPollRef.current = null;
    }
    if (rapidTimeoutRef.current) {
      clearTimeout(rapidTimeoutRef.current);
      rapidTimeoutRef.current = null;
    }
    transitioningRef.current = false;
    setTransitioning(false);
    preActionUrlRef.current = null;
  }, []);

  /** Kick off rapid polling (400 ms) until song URL changes, auto-aborts after 15 s. */
  const startTransition = useCallback(
    (prevUrl: string | null) => {
      preActionUrlRef.current = prevUrl;
      transitioningRef.current = true;
      setTransitioning(true);
      if (rapidPollRef.current) clearInterval(rapidPollRef.current);
      if (rapidTimeoutRef.current) clearTimeout(rapidTimeoutRef.current);
      rapidPollRef.current = setInterval(() => fetchStatusRef.current(), 400);
      rapidTimeoutRef.current = setTimeout(stopRapidPoll, 15_000);
    },
    [stopRapidPoll],
  );

  useEffect(() => {
    fetch("/api/bot/music/config")
      .then((r) => r.json())
      .then(({ volume: v }) => {
        if (typeof v === "number") {
          const globalVol = Math.round(v);
          setVolume(globalVol);
          localStorage.setItem("music_volume", String(globalVol));
          musicVolume(globalVol).catch(() => {});
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const s = await musicStatus();
      if (transitioningRef.current && s.song?.url !== preActionUrlRef.current) {
        stopRapidPoll();
      }
      setStatus(s);
      if (!volumeSyncedRef.current) {
        volumeSyncedRef.current = true;
        const saved = (() => {
          const v = localStorage.getItem("music_volume");
          return v !== null ? Number(v) : 50;
        })();
        if (s.volume !== undefined && s.volume !== saved)
          musicVolume(saved).catch(() => {});
        setVolume(saved);
      }
    } catch {}
  }, [stopRapidPoll]);

  useEffect(() => {
    fetchStatusRef.current = fetchStatus;
  }, [fetchStatus]);

  useEffect(() => {
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 1500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (rapidPollRef.current) clearInterval(rapidPollRef.current);
      if (rapidTimeoutRef.current) clearTimeout(rapidTimeoutRef.current);
    };
  }, [fetchStatus]);

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => setDebouncedQuery(query), 600);
  }, [query]);

  useEffect(() => {
    setLoadingVideos(true);
    setVideoError(null);
    const url = debouncedQuery
      ? `/api/youtube?q=${encodeURIComponent(debouncedQuery)}`
      : "/api/youtube";
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          const errorMsg = d.details?.errors?.[0]?.reason
            ? `YouTube API: ${d.details.errors[0].reason} - ${d.details.errors[0].message}`
            : d.error;
          setVideoError(errorMsg);
          setVideos([]);
        } else setVideos(d.videos ?? []);
      })
      .catch((err) => {
        console.error("YouTube fetch error:", err);
        setVideoError("Failed to fetch results. Please try again.");
        setVideos([]);
      })
      .finally(() => setLoadingVideos(false));
  }, [debouncedQuery]);

  const fetchMemberName = useCallback(
    async (userId: string) => {
      if (memberNames[userId]) return memberNames[userId];
      try {
        const res = await fetch(`/api/bot/members?userId=${userId}`);
        const data = await res.json();
        const displayName =
          data.data?.displayName || data.data?.username || userId;
        setMemberNames((prev) => ({ ...prev, [userId]: displayName }));
        return displayName;
      } catch {
        return userId;
      }
    },
    [memberNames],
  );

  const fetchPlaylists = useCallback(async () => {
    try {
      const res = await fetch("/api/playlists");
      const data = await res.json();
      const playlistsData = data.playlists || [];

      const uniqueUserIds = [
        ...new Set(playlistsData.map((p: Playlist) => p.created_by)),
      ];
      const namePromises = uniqueUserIds.map(async (userId) => {
        const name = await fetchMemberName(userId as string);
        return [userId, name];
      });
      const nameEntries = await Promise.all(namePromises);
      const nameMap = Object.fromEntries(nameEntries);

      const enrichedPlaylists = playlistsData.map((p: Playlist) => ({
        ...p,
        creator_name: nameMap[p.created_by] || p.created_by,
      }));

      setPlaylists(enrichedPlaylists);
    } catch (error) {
      console.error("Failed to fetch playlists:", error);
    }
  }, [fetchMemberName]);

  useEffect(() => {
    fetchPlaylists();
    const interval = setInterval(fetchPlaylists, 10000);
    return () => clearInterval(interval);
  }, [fetchPlaylists]);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [contextMenu]);

  const handleCreatePlaylist = async () => {
    const name = newPlaylistName.trim();
    if (!name) {
      showToast("Playlist name cannot be empty", "error");
      return;
    }
    if (name.length > 50) {
      showToast("Playlist name is too long (max 50 characters)", "error");
      return;
    }
    setSavingPlaylist(true);
    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (res.ok && data.playlist) {
        setPlaylists((prev) => [...prev, { ...data.playlist, song_count: 0 }]);
        setNewPlaylistName("");
        showToast(`Playlist "${name}" created!`, "success");
      } else {
        showToast(data.error || "Failed to create playlist", "error");
      }
    } catch (error) {
      console.error("Failed to create playlist:", error);
      showToast("Failed to create playlist. Please try again.", "error");
    } finally {
      setSavingPlaylist(false);
    }
  };

  const handleRenamePlaylist = async () => {
    if (!editingPlaylist) return;
    const name = editPlaylistName.trim();
    if (!name) {
      showToast("Playlist name cannot be empty", "error");
      return;
    }
    if (name.length > 50) {
      showToast("Playlist name is too long (max 50 characters)", "error");
      return;
    }
    if (name === editingPlaylist.name) {
      setEditingPlaylist(null);
      setEditPlaylistName("");
      return;
    }
    setSavingPlaylist(true);
    try {
      const res = await fetch(`/api/playlists/${editingPlaylist.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (res.ok && data.playlist) {
        setPlaylists((prev) =>
          prev.map((p) => (p.id === editingPlaylist.id ? { ...p, name } : p)),
        );
        setEditingPlaylist(null);
        setEditPlaylistName("");
        showToast(`Playlist renamed to "${name}"!`, "success");
      } else {
        showToast(data.error || "Failed to rename playlist", "error");
      }
    } catch (error) {
      console.error("Failed to rename playlist:", error);
      showToast("Failed to rename playlist. Please try again.", "error");
    } finally {
      setSavingPlaylist(false);
    }
  };

  const handleTogglePlaylistLock = async (playlist: Playlist) => {
    if (playlist.created_by !== discordUserId) {
      showToast("Only the creator can lock/unlock this playlist", "error");
      return;
    }
    try {
      const res = await fetch(`/api/playlists/${playlist.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_locked: !playlist.is_locked }),
      });
      const data = await res.json();
      if (res.ok && data.playlist) {
        setPlaylists((prev) =>
          prev.map((p) =>
            p.id === playlist.id ? { ...p, is_locked: !playlist.is_locked } : p,
          ),
        );
        showToast(
          `Playlist ${!playlist.is_locked ? "locked" : "unlocked"}!`,
          "success",
        );
      } else {
        showToast(data.error || "Failed to update playlist", "error");
      }
    } catch (error) {
      console.error("Failed to toggle lock:", error);
      showToast("Failed to update playlist. Please try again.", "error");
    }
  };

  const confirmDeletePlaylist = async () => {
    if (!deletePlaylistTarget) return;
    try {
      const res = await fetch(`/api/playlists/${deletePlaylistTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showToast("Playlist deleted successfully", "success");
        setPlaylists((prev) =>
          prev.filter((p) => p.id !== deletePlaylistTarget.id),
        );
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to delete playlist", "error");
      }
    } catch (error) {
      console.error("Failed to delete playlist:", error);
      showToast("Failed to delete playlist. Please try again.", "error");
    } finally {
      setDeletePlaylistDialogOpen(false);
      setDeletePlaylistTarget(null);
    }
  };

  const handleViewPlaylist = async (playlist: Playlist) => {
    setSelectedPlaylistForView(playlist);
    setLoadingPlaylistSongs(true);
    try {
      const res = await fetch(`/api/playlists/${playlist.id}`);
      const data = await res.json();
      const songsData = data.songs || [];

      const uniqueUserIds = [
        ...new Set(songsData.map((s: PlaylistSong) => s.added_by)),
      ];
      const namePromises = uniqueUserIds.map(async (userId) => {
        const name = await fetchMemberName(userId as string);
        return [userId, name];
      });
      const nameEntries = await Promise.all(namePromises);
      const nameMap = Object.fromEntries(nameEntries);

      const enrichedSongs = songsData.map((s: PlaylistSong) => ({
        ...s,
        adder_name: nameMap[s.added_by] || s.added_by,
      }));

      setPlaylistSongs(enrichedSongs);
    } catch (error) {
      console.error("Failed to fetch playlist songs:", error);
      setPlaylistSongs([]);
    } finally {
      setLoadingPlaylistSongs(false);
    }
  };

  const handleAddToPlaylist = async (playlistId: string, video: Video) => {
    setAddingToPlaylist(true);
    try {
      const res = await fetch(`/api/playlists/${playlistId}/songs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          youtube_url: video.url,
          song_title: video.title,
          song_channel: video.channel,
          song_thumbnail: video.thumbnail,
          song_duration: video.duration,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPlaylists((prev) =>
          prev.map((p) =>
            p.id === playlistId ? { ...p, song_count: p.song_count + 1 } : p,
          ),
        );
        const playlistName =
          playlists.find((p) => p.id === playlistId)?.name || "playlist";
        showToast(`Added "${video.title}" to ${playlistName}!`);
      } else {
        showToast(data.error || "Failed to add song to playlist", "error");
      }
    } catch (error) {
      console.error("Failed to add to playlist:", error);
      showToast("Failed to add song to playlist", "error");
    } finally {
      setAddingToPlaylist(false);
      setContextMenu(null);
    }
  };

  const handleRemoveFromPlaylist = async (songId: string) => {
    if (!selectedPlaylistForView) return;
    try {
      const res = await fetch(
        `/api/playlists/${selectedPlaylistForView.id}/songs/${songId}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        setPlaylistSongs((prev) => prev.filter((s) => s.id !== songId));
        setPlaylists((prev) =>
          prev.map((p) =>
            p.id === selectedPlaylistForView.id
              ? { ...p, song_count: Math.max(0, p.song_count - 1) }
              : p,
          ),
        );
      }
    } catch (error) {
      console.error("Failed to remove from playlist:", error);
    }
  };

  const handlePlayPlaylist = async (
    playlist: Playlist,
    closeDialog = false,
  ) => {
    if (!selectedChannel) {
      showToast("Please select a voice channel first", "error");
      return;
    }

    if (closeDialog) {
      setPlaylistPanelOpen(false); // Close the dialog
    }
    showToast(`Playing ${playlist.name}...`, "success");

    try {
      const res = await fetch(`/api/playlists/${playlist.id}`);
      if (!res.ok) {
        throw new Error("Failed to load playlist");
      }
      const data = await res.json();
      const songs: PlaylistSong[] = data.songs || [];

      if (songs.length === 0) {
        showToast("This playlist is empty", "error");
        return;
      }

      let failedCount = 0;
      for (const song of songs) {
        try {
          const result = await musicPlay(
            selectedChannel,
            song.youtube_url,
            discordUserId ?? "web",
            session?.user?.user_metadata?.full_name ?? "Web Player",
            true,
          );
          if (result.error) {
            failedCount++;
          }
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          failedCount++;
        }
      }

      if (failedCount > 0) {
        showToast(
          `${songs.length - failedCount}/${songs.length} songs added (${failedCount} failed due to restrictions)`,
          "error",
        );
      }

      multiPoll([500, 1500]);
    } catch (error) {
      console.error("Failed to play playlist:", error);
      showToast("Failed to load playlist", "error");
    }
  };

  const handlePlaySongFromPlaylist = async (song: PlaylistSong) => {
    if (!selectedChannel) {
      showToast("Please select a voice channel first", "error");
      return;
    }
    try {
      const result = await musicPlay(
        selectedChannel,
        song.youtube_url,
        discordUserId ?? "web",
        session?.user?.user_metadata?.full_name ?? "Web Player",
        true,
      );
      if (result.error) {
        showToast(
          `⚠️ YouTube has rate-limited us. Please try again in a bit.`,
          "error",
        );
      } else {
        showToast(`Playing ${song.song_title}`, "success");
        startTransition(currentSongUrlRef.current);
      }
    } catch (error) {
      showToast("Failed to play song. Please try another.", "error");
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedSongIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedSongIndex === null || draggedSongIndex === dropIndex) {
      setDraggedSongIndex(null);
      setDragOverIndex(null);
      return;
    }

    if (!selectedPlaylistForView) return;

    // Check if user can reorder
    const isLocked = selectedPlaylistForView.is_locked;
    const isCreator = selectedPlaylistForView.created_by === discordUserId;
    if (isLocked && !isCreator) {
      showToast("This playlist is locked", "error");
      setDraggedSongIndex(null);
      setDragOverIndex(null);
      return;
    }

    // Reorder locally
    const newSongs = [...playlistSongs];
    const [draggedSong] = newSongs.splice(draggedSongIndex, 1);
    newSongs.splice(dropIndex, 0, draggedSong);

    // Update positions
    const updatedSongs = newSongs.map((song, idx) => ({
      ...song,
      position: idx,
    }));

    setPlaylistSongs(updatedSongs);
    setDraggedSongIndex(null);
    setDragOverIndex(null);

    // Save to database
    try {
      const response = await fetch(
        `/api/playlists/${selectedPlaylistForView.id}/songs/reorder`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            songs: updatedSongs.map((s) => ({
              id: s.id,
              position: s.position,
            })),
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reorder");
      }

      showToast("Playlist order updated", "success");
      // Refresh playlists to update thumbnails if needed
      fetchPlaylists();
    } catch (error: any) {
      showToast(error.message || "Failed to reorder songs", "error");
      // Revert on error
      await handleViewPlaylist(selectedPlaylistForView);
    }
  };

  const handleVideoContextMenu = (e: React.MouseEvent, video: Video) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      video,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleVideoLongPress = (video: Video, e: TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    setContextMenu({
      video,
      x: touch.clientX,
      y: touch.clientY,
    });
  };

  const multiPoll = useCallback(
    (delays: number[]) => {
      delays.forEach((ms) => setTimeout(fetchStatus, ms));
    },
    [fetchStatus],
  );

  const handlePlay = async (video: Video) => {
    if (!selectedChannel) return;
    setLoadingPlay(video.id);
    if (currentSongUrlRef.current) {
      setOptimisticQueue((prev) => [
        ...prev,
        {
          id: video.id,
          title: video.title,
          channel: video.channel,
          thumbnail: video.thumbnail,
          duration: video.duration,
        },
      ]);
      setShowQueue(true);
    }
    try {
      const prevUrl = currentSongUrlRef.current;
      const result = await musicPlay(
        selectedChannel,
        video.url,
        discordUserId ?? "web",
        session?.user?.user_metadata?.full_name ?? "Web Player",
      );

      if (result.error) {
        showToast(
          `⚠️ YouTube has rate-limited us. Please try again in a bit.`,
          "error",
        );
        setOptimisticQueue((prev) => prev.filter((o) => o.id !== video.id));
      } else {
        startTransition(prevUrl);
      }
    } catch (error) {
      showToast("Failed to play song. Please try another.", "error");
      setOptimisticQueue((prev) => prev.filter((o) => o.id !== video.id));
    }
    setLoadingPlay(null);
  };

  const handleToggle = useCallback(() => {
    setStatus((prev) =>
      prev ? { ...prev, paused: !prev.paused, playing: prev.paused } : prev,
    );
    musicToggle().catch(() => {});
    multiPoll([300, 1000]);
  }, [multiPoll]);

  const handleSkip = useCallback(() => {
    startTransition(currentSongUrlRef.current);
    musicSkip().catch(() => {});
  }, [startTransition]);

  const handleStop = useCallback(() => {
    setStatus(null);
    musicStop().catch(() => {});
  }, []);

  const handleShuffle = useCallback(() => {
    musicShuffle().catch(() => {});
    multiPoll([400, 1200]);
  }, [multiPoll]);

  const handleLoop = useCallback(() => {
    setStatus((prev) =>
      prev ? { ...prev, repeatMode: (prev.repeatMode + 1) % 3 } : prev,
    );
    musicLoop().catch(() => {});
    multiPoll([300, 900]);
  }, [multiPoll]);

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      setVolume(v);
      localStorage.setItem("music_volume", String(v));
      setStatus((prev) => (prev ? { ...prev, volume: v } : prev));
      musicVolume(v).catch(() => {});
      fetch("/api/bot/music/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ volume: v }),
      }).catch(() => {});
    },
    [],
  );

  const isPlaying = status?.playing && !status?.paused;
  const loopLabels = ["Off", "Song", "Queue"];

  return (
    <AppLayout>
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
              toast.type === "success"
                ? "bg-green-500/90 text-white"
                : "bg-red-500/90 text-white"
            }`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col min-h-full pb-36">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Music</h1>
              {status?.song && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isPlaying ? "▶ Playing" : "⏸ Paused"} in{" "}
                  {channels.find((c) => c.id === selectedChannel)?.name ?? "…"}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Manage Playlists Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPlaylistPanelOpen(true)}
                className="gap-2"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                  />
                </svg>
                Manage Playlists
              </Button>

              {/* Voice channel selector */}
              <div className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 text-muted-foreground shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.536 8.464a5 5 0 010 7.072M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
                <select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                  className="text-sm bg-muted border border-border/50 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {channels.length === 0 && (
                    <option value="">Loading...</option>
                  )}
                  {channels.map((c) => {
                    const isUserHere = discordUserId
                      ? c.memberIds?.includes(discordUserId)
                      : false;
                    return (
                      <option key={c.id} value={c.id}>
                        {isUserHere ? "● " : ""}
                        {c.name}
                        {c.memberCount > 0 ? ` (${c.memberCount})` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>

          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search for songs..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border/50 bg-muted/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground/60"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Section label */}
        {!debouncedQuery && playlists.length > 0 && (
          <>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-4">
              Your Playlists
            </p>

            {/* Playlists grid - matching video card style */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8"
            >
              {playlists.slice(0, 12).map((playlist) => (
                <motion.div
                  key={playlist.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className="group"
                >
                  <button
                    onClick={() => handlePlayPlaylist(playlist, true)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setSelectedPlaylistForView(playlist);
                      handleViewPlaylist(playlist);
                      setPlaylistPanelOpen(true);
                    }}
                    className="w-full text-left rounded-xl overflow-hidden border border-border/40 hover:border-primary/40 bg-card hover:bg-muted/30 transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    {/* Playlist card header */}
                    <div className="relative aspect-video bg-linear-to-br from-primary/10 via-primary/5 to-transparent flex items-center justify-center group-hover:from-primary/20 group-hover:via-primary/10 transition-all duration-300 overflow-hidden">
                      {playlist.thumbnail ? (
                        <>
                          <img
                            src={playlist.thumbnail}
                            alt={playlist.name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/20 to-transparent" />
                        </>
                      ) : (
                        <>
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.05),rgba(255,255,255,0))]" />
                          <svg
                            className="h-14 w-14 text-primary/40 group-hover:text-primary/60 transition-colors duration-300"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                          </svg>
                        </>
                      )}

                      {/* Top badges */}
                      <div className="absolute top-2 left-2 right-2 flex items-start justify-between">
                        {playlist.is_locked && (
                          <div className="px-2 py-1 bg-background/90 backdrop-blur-sm rounded-md border border-border/50">
                            <svg
                              className="h-3 w-3 text-muted-foreground"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                        )}
                        <div className="ml-auto px-2 py-1 bg-background/90 backdrop-blur-sm rounded-md border border-border/50 flex items-center gap-1.5">
                          <svg
                            className="h-3 w-3 text-muted-foreground"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                          </svg>
                          <span className="text-[10px] font-semibold text-foreground">
                            {playlist.song_count}
                          </span>
                        </div>
                      </div>

                      {/* Play button overlay on hover */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <motion.div
                          initial={{ scale: 0.8 }}
                          whileHover={{ scale: 1.1 }}
                          className="p-3 bg-primary rounded-full shadow-lg"
                        >
                          <svg
                            className="h-6 w-6 text-primary-foreground"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </motion.div>
                      </div>
                    </div>

                    {/* Playlist info */}
                    <div className="p-2.5">
                      <p className="text-xs font-medium leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                        {playlist.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <span>Playlist</span>
                        <span>•</span>
                        <span>
                          {playlist.song_count} song
                          {playlist.song_count !== 1 ? "s" : ""}
                        </span>
                      </p>
                    </div>
                  </button>

                  {/* Manage button - right click hint */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPlaylistForView(playlist);
                      handleViewPlaylist(playlist);
                      setPlaylistPanelOpen(true);
                    }}
                    className="mt-1.5 w-full text-[10px] text-muted-foreground hover:text-foreground transition-colors py-1.5 px-2 rounded-lg hover:bg-muted/50 flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100"
                  >
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                      />
                    </svg>
                    <span>Manage</span>
                  </button>
                </motion.div>
              ))}
            </motion.div>
          </>
        )}

        <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-4">
          {debouncedQuery
            ? `Results for "${debouncedQuery}"`
            : "Trending Music"}
        </p>

        {/* Video grid */}
        {loadingVideos ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-muted/30 animate-pulse">
                <div className="aspect-video rounded-t-xl bg-muted/50" />
                <div className="p-2.5 space-y-1.5">
                  <div className="h-3 bg-muted/60 rounded w-3/4" />
                  <div className="h-2.5 bg-muted/40 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : videoError ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <svg
              className="h-10 w-10 text-muted-foreground/40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-muted-foreground">{videoError}</p>
          </div>
        ) : (
          <motion.div
            key={debouncedQuery}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
          >
            {videos.map((video) => {
              const isCurrentlyPlaying =
                status?.song?.url?.includes(video.id) && isPlaying;
              const isQueued = status?.queue?.some(
                (q) => q.name === video.title,
              );
              return (
                <motion.button
                  key={video.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handlePlay(video)}
                  onContextMenu={(e) => handleVideoContextMenu(e, video)}
                  onTouchStart={(e) => {
                    const longPressTimer = setTimeout(() => {
                      handleVideoLongPress(video, e.nativeEvent);
                    }, 500);
                    const clearTimer = () => clearTimeout(longPressTimer);
                    e.currentTarget.addEventListener("touchend", clearTimer, {
                      once: true,
                    });
                    e.currentTarget.addEventListener("touchmove", clearTimer, {
                      once: true,
                    });
                  }}
                  disabled={!selectedChannel || loadingPlay === video.id}
                  className={`group relative text-left rounded-xl overflow-hidden border transition-all duration-200 ${
                    isCurrentlyPlaying
                      ? "border-blue-500/60 shadow-lg shadow-blue-500/20"
                      : isQueued
                        ? "border-primary/30"
                        : "border-border/30 hover:border-border/60"
                  } bg-card/50 hover:bg-card`}
                >
                  <div className="relative aspect-video overflow-hidden">
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center">
                      {loadingPlay === video.id ? (
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <svg
                            className="h-5 w-5 animate-spin text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            />
                          </svg>
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg
                            className="h-5 w-5 text-white ml-0.5"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[10px] px-1 rounded">
                      {video.duration}
                    </span>
                    {isCurrentlyPlaying && (
                      <div className="absolute top-1.5 left-1.5 flex gap-0.5 items-end h-4">
                        {[0, 150, 75].map((d, i) => (
                          <motion.div
                            key={i}
                            className="w-1 bg-blue-400 rounded-full"
                            animate={{ height: ["4px", "14px", "4px"] }}
                            transition={{
                              repeat: Infinity,
                              duration: 0.8,
                              delay: d / 1000,
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-medium leading-tight line-clamp-2">
                      {video.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      {video.channel}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        )}

        {/* ── Mini Player ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {(status?.song || transitioning) && (
            <motion.div
              initial={{ y: 120, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 120, opacity: 0 }}
              transition={{ type: "spring", stiffness: 340, damping: 38 }}
              className="fixed bottom-0 left-0 right-0 z-50 md:left-72"
            >
              <div className="mx-3 mb-3">
                <div className="relative overflow-hidden rounded-2xl border border-white/6 shadow-[0_-2px_60px_rgba(0,0,0,0.7)]">
                  {/* Ambient background */}
                  <div className="absolute inset-0 pointer-events-none">
                    {status?.song && (
                      <img
                        src={status.song.thumbnail}
                        alt=""
                        className="w-full h-full object-cover scale-150 blur-2xl opacity-20"
                      />
                    )}
                    <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-md" />
                  </div>

                  {/* Loading overlay while transitioning */}
                  <AnimatePresence>
                    {transitioning && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-20 flex items-center justify-center gap-2 bg-zinc-950/60 backdrop-blur-sm rounded-2xl"
                      >
                        <svg
                          className="h-4 w-4 animate-spin text-white/50"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        <span className="text-xs text-white/40 font-medium">
                          Loading...
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="relative">
                    {status?.song ? (
                      <>
                        {/* ── Queue panel ── */}
                        <AnimatePresence>
                          {showQueue && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{
                                duration: 0.25,
                                ease: [0.25, 0.46, 0.45, 0.94],
                              }}
                              className="overflow-hidden"
                            >
                              <div className="px-3 pt-3 pb-2.5 border-b border-white/5">
                                {/* Now playing row */}
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="flex gap-0.75 items-end h-4 shrink-0">
                                    {isPlaying ? (
                                      [0, 200, 100].map((d, i) => (
                                        <motion.div
                                          key={i}
                                          className="w-0.75 bg-indigo-400 rounded-full"
                                          animate={{
                                            height: ["4px", "14px", "4px"],
                                          }}
                                          transition={{
                                            repeat: Infinity,
                                            duration: 0.7,
                                            delay: d / 1000,
                                          }}
                                        />
                                      ))
                                    ) : (
                                      <div className="w-0.75 h-2.5 bg-white/30 rounded-full" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-semibold text-white truncate">
                                      {status.song.name}
                                    </p>
                                    <p className="text-[10px] text-white/35 truncate">
                                      {status.song.author}
                                    </p>
                                  </div>
                                  <span className="text-[10px] text-white/25 shrink-0">
                                    Now playing
                                  </span>
                                </div>

                                {/* Up next list */}
                                {status.queue.length > 0 ||
                                optimisticQueue.length > 0 ? (
                                  <>
                                    <p className="text-[9px] uppercase tracking-[0.12em] text-white/20 font-medium mb-2">
                                      Up next &middot;{" "}
                                      {status.queueLength -
                                        1 +
                                        optimisticQueue.length}{" "}
                                      track
                                      {status.queueLength -
                                        1 +
                                        optimisticQueue.length !==
                                      1
                                        ? "s"
                                        : ""}
                                    </p>
                                    <div className="flex gap-2.5 overflow-x-auto pb-0.5 scrollbar-none">
                                      {status.queue.map((entry) => (
                                        <div
                                          key={entry.index}
                                          className="shrink-0 w-28 group"
                                        >
                                          <div className="aspect-video rounded-lg overflow-hidden bg-white/5 ring-1 ring-white/6">
                                            <img
                                              src={entry.thumbnail}
                                              alt={entry.name}
                                              className="w-full h-full object-cover opacity-75 group-hover:opacity-100 transition-opacity duration-200"
                                            />
                                          </div>
                                          <p className="text-[10px] text-white/45 mt-1 truncate leading-tight">
                                            {entry.name}
                                          </p>
                                          <p className="text-[9px] text-white/25 truncate">
                                            {entry.author}
                                          </p>
                                        </div>
                                      ))}
                                      {optimisticQueue.map((entry) => (
                                        <div
                                          key={entry.id}
                                          className="shrink-0 w-28 opacity-55"
                                        >
                                          <div className="relative aspect-video rounded-lg overflow-hidden bg-white/5 ring-1 ring-indigo-400/20">
                                            <img
                                              src={entry.thumbnail}
                                              alt={entry.title}
                                              className="w-full h-full object-cover opacity-50"
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                              <svg
                                                className="h-3 w-3 animate-spin text-white/60"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                              >
                                                <circle
                                                  className="opacity-25"
                                                  cx="12"
                                                  cy="12"
                                                  r="10"
                                                  stroke="currentColor"
                                                  strokeWidth="4"
                                                />
                                                <path
                                                  className="opacity-75"
                                                  fill="currentColor"
                                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                                />
                                              </svg>
                                            </div>
                                          </div>
                                          <p className="text-[10px] text-white/35 mt-1 truncate leading-tight">
                                            {entry.title}
                                          </p>
                                          <p className="text-[9px] text-white/20 truncate">
                                            {entry.channel}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                ) : (
                                  <p className="text-[11px] text-white/20 py-1">
                                    Queue is empty
                                  </p>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* ── Controls bar ── */}
                        <div className="flex items-center gap-2.5 px-3 py-2.5">
                          <motion.div
                            key={status.song.url}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.25 }}
                            className="shrink-0 w-10 h-10 rounded-xl overflow-hidden shadow-lg ring-1 ring-white/10"
                          >
                            <img
                              src={status.song.thumbnail}
                              alt={status.song.name}
                              className="w-full h-full object-cover"
                            />
                          </motion.div>

                          <div className="flex-1 min-w-0">
                            <motion.p
                              key={status.song.name}
                              initial={{ opacity: 0, y: 3 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.2 }}
                              className="text-sm font-semibold text-white truncate leading-tight"
                            >
                              {status.song.name}
                            </motion.p>
                            <p className="text-[11px] text-white/35 truncate mt-0.5">
                              {status.song.author}
                            </p>
                          </div>

                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              onClick={handleShuffle}
                              title="Shuffle"
                              className="p-1.5 rounded-lg text-white/35 hover:text-white/70 hover:bg-white/8 transition-all duration-150"
                            >
                              <svg
                                className="h-3.5 w-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M16 3h5m0 0v5m0-5l-6 6M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-1M15 4l6 6M5 21a2 2 0 01-2-2v-1c0-8.284 6.716-15 15-15h1"
                                />
                              </svg>
                            </button>

                            <motion.button
                              onClick={handleToggle}
                              whileTap={{ scale: 0.88 }}
                              className="mx-1.5 p-2.5 rounded-xl bg-white text-black hover:bg-white/90 active:bg-white/70 shadow-md transition-all duration-150"
                            >
                              {isPlaying ? (
                                <svg
                                  className="h-4 w-4"
                                  fill="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                                </svg>
                              ) : (
                                <svg
                                  className="h-4 w-4 ml-0.5"
                                  fill="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              )}
                            </motion.button>

                            <button
                              onClick={handleSkip}
                              title="Skip"
                              className="p-1.5 rounded-lg text-white/35 hover:text-white/70 hover:bg-white/8 transition-all duration-150"
                            >
                              <svg
                                className="h-3.5 w-3.5"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                              </svg>
                            </button>

                            <button
                              onClick={handleLoop}
                              title={`Loop: ${loopLabels[status.repeatMode]}`}
                              className={`p-1.5 rounded-lg transition-all duration-150 ${status.repeatMode > 0 ? "text-indigo-400 bg-indigo-400/10" : "text-white/35 hover:text-white/70 hover:bg-white/8"}`}
                            >
                              <svg
                                className="h-3.5 w-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                {status.repeatMode === 1 ? (
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15M12 8v8m0-8l-2 2m2-2l2 2"
                                  />
                                ) : (
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                  />
                                )}
                              </svg>
                            </button>

                            <button
                              onClick={() => setShowQueue((p) => !p)}
                              title="Queue"
                              className={`relative p-1.5 rounded-lg transition-all duration-150 ${showQueue ? "text-indigo-400 bg-indigo-400/10" : "text-white/35 hover:text-white/70 hover:bg-white/8"}`}
                            >
                              <svg
                                className="h-3.5 w-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 6h16M4 10h16M4 14h10"
                                />
                              </svg>
                              {(status.queueLength > 1 ||
                                optimisticQueue.length > 0) && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-3.5 h-3.5 px-0.75 rounded-full bg-indigo-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                                  {status.queueLength -
                                    1 +
                                    optimisticQueue.length}
                                </span>
                              )}
                            </button>

                            <button
                              onClick={handleStop}
                              title="Stop"
                              className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-all duration-150"
                            >
                              <svg
                                className="h-3.5 w-3.5"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M6 6h12v12H6z" />
                              </svg>
                            </button>

                            <div className="hidden sm:flex items-center gap-1.5 ml-2 pl-2.5 border-l border-white/8 text-white/35">
                              <VolumeIcon vol={volume} />
                              <input
                                type="range"
                                min={0}
                                max={100}
                                value={volume}
                                onChange={handleVolumeChange}
                                className="w-16 accent-white h-0.5 cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="h-14 flex items-center justify-center">
                        <span className="text-xs text-white/25">
                          Connecting...
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Context Menu for Add to Playlist */}
        {contextMenu && (
          <div
            className="fixed bg-card border border-border rounded-lg shadow-xl py-1 z-50 min-w-50"
            style={{
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`,
            }}
          >
            <div className="px-3 py-2 border-b border-border/50">
              <p className="text-xs font-medium truncate">
                {contextMenu.video.title}
              </p>
            </div>
            <button
              onClick={() => handlePlay(contextMenu.video)}
              className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 flex items-center gap-2"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Play Now
            </button>
            <div className="border-t border-border/50 my-1" />
            <div className="px-3 py-1.5 text-xs text-muted-foreground font-medium">
              Add to Playlist
            </div>
            {playlists.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                No playlists yet
              </div>
            ) : (
              playlists.map((playlist) => {
                const isLocked =
                  playlist.is_locked && playlist.created_by !== discordUserId;
                return (
                  <button
                    key={playlist.id}
                    onClick={() =>
                      !isLocked &&
                      handleAddToPlaylist(playlist.id, contextMenu.video)
                    }
                    disabled={isLocked || addingToPlaylist}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between ${
                      isLocked
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <span className="truncate">{playlist.name}</span>
                    {playlist.is_locked && (
                      <svg
                        className="h-3 w-3 shrink-0 ml-2"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Playlist Management Panel */}
        <AnimatePresence>
          {playlistPanelOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              onClick={() => {
                setPlaylistPanelOpen(false);
                setEditingPlaylist(null);
                setSelectedPlaylistForView(null);
              }}
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-card border border-border rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
              >
                <div className="p-6 border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold">Manage Playlists</h2>
                    <button
                      onClick={() => {
                        setPlaylistPanelOpen(false);
                        setEditingPlaylist(null);
                        setSelectedPlaylistForView(null);
                      }}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                    >
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>

                  {!selectedPlaylistForView && (
                    <div className="mt-4 flex gap-2">
                      <Input
                        placeholder="New playlist name..."
                        value={newPlaylistName}
                        onChange={(e) => setNewPlaylistName(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleCreatePlaylist()
                        }
                        className="flex-1"
                      />
                      <Button
                        onClick={handleCreatePlaylist}
                        disabled={!newPlaylistName.trim() || savingPlaylist}
                      >
                        {savingPlaylist ? "Creating..." : "Create"}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  {selectedPlaylistForView ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setSelectedPlaylistForView(null)}
                          className="p-2 hover:bg-muted rounded-lg"
                        >
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 19l-7-7 7-7"
                            />
                          </svg>
                        </button>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold">
                            {selectedPlaylistForView.name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {playlistSongs.length} song(s)
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handlePlayPlaylist(selectedPlaylistForView)
                          }
                          disabled={playlistSongs.length === 0}
                        >
                          Play All
                        </Button>
                      </div>

                      {loadingPlaylistSongs ? (
                        <div className="text-center py-8 text-muted-foreground">
                          Loading songs...
                        </div>
                      ) : playlistSongs.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No songs in this playlist yet
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {playlistSongs.map((song, index) => {
                            const isCurrentlyPlaying =
                              status?.song?.url?.includes(song.youtube_url);
                            const canRemove =
                              !selectedPlaylistForView.is_locked ||
                              selectedPlaylistForView.created_by ===
                                discordUserId ||
                              song.added_by === discordUserId;
                            const isDragging = draggedSongIndex === index;
                            const isDragOver = dragOverIndex === index;

                            return (
                              <motion.div
                                key={song.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.02 }}
                                className="group"
                                draggable
                                onDragStart={() => handleDragStart(index)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, index)}
                              >
                                <div
                                  className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
                                    isCurrentlyPlaying
                                      ? "bg-primary/10 border border-primary/40"
                                      : isDragOver
                                        ? "bg-primary/5 border border-primary/60 border-dashed"
                                        : isDragging
                                          ? "bg-muted/20 border border-border/30 opacity-50"
                                          : "bg-muted/30 hover:bg-muted/50 border border-transparent hover:border-border/50"
                                  } ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
                                >
                                  {/* Drag handle */}
                                  <div className="shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground/80 transition-colors">
                                    <svg
                                      className="h-4 w-4"
                                      fill="currentColor"
                                      viewBox="0 0 16 16"
                                    >
                                      <path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
                                    </svg>
                                  </div>
                                  <span className="text-xs text-muted-foreground w-6 shrink-0">
                                    {index + 1}
                                  </span>
                                  <button
                                    onClick={() =>
                                      handlePlaySongFromPlaylist(song)
                                    }
                                    className="relative shrink-0 group/play"
                                  >
                                    <img
                                      src={song.song_thumbnail}
                                      alt={song.song_title}
                                      className="w-12 h-12 rounded object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover/play:bg-black/60 transition-all duration-200 rounded flex items-center justify-center">
                                      <svg
                                        className="h-6 w-6 text-white opacity-0 group-hover/play:opacity-100 transition-opacity duration-200"
                                        fill="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path d="M8 5v14l11-7z" />
                                      </svg>
                                    </div>
                                    {isCurrentlyPlaying && (
                                      <div className="absolute -top-0.5 -right-0.5 flex gap-0.5 items-end h-4">
                                        {[0, 150, 75].map((d, i) => (
                                          <motion.div
                                            key={i}
                                            className="w-1 bg-primary rounded-full"
                                            animate={{
                                              height: ["4px", "14px", "4px"],
                                            }}
                                            transition={{
                                              repeat: Infinity,
                                              duration: 0.8,
                                              delay: d / 1000,
                                            }}
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </button>
                                  <button
                                    onClick={() =>
                                      handlePlaySongFromPlaylist(song)
                                    }
                                    className="flex-1 min-w-0 text-left"
                                  >
                                    <p
                                      className={`text-sm font-medium truncate transition-colors ${
                                        isCurrentlyPlaying
                                          ? "text-primary"
                                          : "group-hover:text-foreground"
                                      }`}
                                    >
                                      {song.song_title}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {song.song_channel} • {song.song_duration}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground/60">
                                      Added by{" "}
                                      {song.adder_name || song.added_by}
                                    </p>
                                  </button>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      onClick={() =>
                                        handlePlaySongFromPlaylist(song)
                                      }
                                      className="p-2 hover:bg-primary/10 hover:text-primary rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                      title="Play now"
                                    >
                                      <svg
                                        className="h-4 w-4"
                                        fill="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path d="M8 5v14l11-7z" />
                                      </svg>
                                    </button>
                                    {canRemove && (
                                      <button
                                        onClick={() =>
                                          handleRemoveFromPlaylist(song.id)
                                        }
                                        className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                        title="Remove from playlist"
                                      >
                                        <svg
                                          className="h-4 w-4"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          stroke="currentColor"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                          />
                                        </svg>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : playlists.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <svg
                        className="h-16 w-16 mx-auto mb-4 opacity-50"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                        />
                      </svg>
                      <p className="text-sm">No playlists yet</p>
                      <p className="text-xs mt-1">Create one to get started!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {playlists.map((playlist) => {
                        const isOwner =
                          session?.user?.user_metadata?.roles?.includes(
                            OWNER_ROLE_ID,
                          );
                        const isCreator = playlist.created_by === discordUserId;

                        if (editingPlaylist?.id === playlist.id) {
                          return (
                            <div
                              key={playlist.id}
                              className="flex items-center gap-2 p-4 bg-muted/30 rounded-lg"
                            >
                              <Input
                                value={editPlaylistName}
                                onChange={(e) =>
                                  setEditPlaylistName(e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleRenamePlaylist();
                                  if (e.key === "Escape") {
                                    setEditingPlaylist(null);
                                    setEditPlaylistName("");
                                  }
                                }}
                                className="flex-1"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                onClick={handleRenamePlaylist}
                                disabled={savingPlaylist}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingPlaylist(null);
                                  setEditPlaylistName("");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={playlist.id}
                            className="flex items-center gap-3 p-4 bg-muted/30 hover:bg-muted/50 rounded-lg transition-colors group"
                          >
                            <button
                              onClick={() => handleViewPlaylist(playlist)}
                              className="flex-1 flex items-center gap-3 min-w-0 text-left"
                            >
                              <div className="p-2 bg-primary/10 rounded-lg">
                                <svg
                                  className="h-5 w-5 text-primary"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium truncate">
                                    {playlist.name}
                                  </p>
                                  {playlist.is_locked && (
                                    <svg
                                      className="h-3.5 w-3.5 text-muted-foreground shrink-0"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {playlist.song_count} song(s) • Created by{" "}
                                  {playlist.creator_name || playlist.created_by}
                                </p>
                              </div>
                            </button>

                            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              {isCreator && (
                                <>
                                  <button
                                    onClick={() =>
                                      handleTogglePlaylistLock(playlist)
                                    }
                                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                                    title={
                                      playlist.is_locked ? "Unlock" : "Lock"
                                    }
                                  >
                                    <svg
                                      className="h-4 w-4"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      {playlist.is_locked ? (
                                        <path
                                          fillRule="evenodd"
                                          d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                                          clipRule="evenodd"
                                        />
                                      ) : (
                                        <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
                                      )}
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingPlaylist(playlist);
                                      setEditPlaylistName(playlist.name);
                                    }}
                                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                                    title="Rename"
                                  >
                                    <svg
                                      className="h-4 w-4"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                      />
                                    </svg>
                                  </button>
                                </>
                              )}
                              {(isCreator || isOwner) && (
                                <button
                                  onClick={() => {
                                    setDeletePlaylistTarget(playlist);
                                    setDeletePlaylistDialogOpen(true);
                                  }}
                                  className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
                                  title="Delete"
                                >
                                  <svg
                                    className="h-4 w-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete Playlist Confirmation */}
        <ConfirmDialog
          isOpen={deletePlaylistDialogOpen}
          onClose={() => {
            setDeletePlaylistDialogOpen(false);
            setDeletePlaylistTarget(null);
          }}
          onConfirm={confirmDeletePlaylist}
          title="Delete Playlist"
          description={`Are you sure you want to delete "${deletePlaylistTarget?.name}"? This will remove all songs from this playlist.`}
          confirmText="Delete"
          variant="danger"
        />
      </div>
    </AppLayout>
  );
}
