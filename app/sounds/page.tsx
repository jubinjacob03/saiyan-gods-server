"use client";

import { useEffect, useRef, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { createClient } from "@/lib/supabase";
import { playSound } from "@/lib/bot-api";
import { BotSocket } from "@/lib/bot-socket";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { designTokens } from "@/lib/design-tokens";
import ConfirmDialog from "@/components/ConfirmDialog";
import axios from "axios";

interface Sound {
  id: string;
  name: string;
  file_url: string;
  duration: number;
  uploaded_by: string;
  created_at: string;
  play_count: number;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const item = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1 },
};

interface VoiceChannel {
  id: string;
  name: string;
  memberCount: number;
  memberIds?: string[];
}

export default function SoundsPage() {
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [filteredSounds, setFilteredSounds] = useState<Sound[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [soundToDelete, setSoundToDelete] = useState<Sound | null>(null);
  // Upload modal
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [voiceChannels, setVoiceChannels] = useState<VoiceChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [discordUserId, setDiscordUserId] = useState<string>("");
  const [discordUsername, setDiscordUsername] = useState<string>("Web User");
  const guildId = process.env.NEXT_PUBLIC_DISCORD_GUILD_ID!;
  const botSocket = useRef<BotSocket | null>(null);

  // Connect WebSocket on mount, disconnect on unmount
  useEffect(() => {
    const socket = new BotSocket();
    botSocket.current = socket;
    socket
      .connect()
      .catch((err) =>
        console.warn(
          "[WS] Could not connect, will use HTTP fallback:",
          err.message,
        ),
      );
    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    loadSounds();
    loadVoiceChannels();
    loadUserSession();
  }, []);

  useEffect(() => {
    if (search) {
      setFilteredSounds(
        sounds.filter((s) =>
          s.name.toLowerCase().includes(search.toLowerCase()),
        ),
      );
    } else {
      setFilteredSounds(sounds);
    }
  }, [search, sounds]);

  // Once both channels and userId are known, snap to the user's current VC
  useEffect(() => {
    if (!discordUserId || voiceChannels.length === 0) return;
    const userChannel = voiceChannels.find((c) => c.memberIds?.includes(discordUserId));
    if (userChannel) {
      setSelectedChannel(userChannel.id);
    }
  }, [discordUserId, voiceChannels]);

  const loadSounds = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("sounds")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSounds(data || []);
      setFilteredSounds(data || []);
    } catch (error) {
      console.error("Error loading sounds:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadVoiceChannels = async () => {
    try {
      const res = await axios.get("/api/bot/channels");
      if (res.data?.data) {
        const channels: VoiceChannel[] = res.data.data;
        setVoiceChannels(channels);
        // Will pick the right default once discordUserId is known (see effect below)
        const lobby = channels.find((c) => c.name.toLowerCase().includes("lobby"));
        setSelectedChannel(lobby?.id ?? channels[0]?.id ?? "");
      }
    } catch (error) {
      console.error("Error loading voice channels:", error);
    }
  };

  const loadUserSession = async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // Discord user ID is stored in identities
        const discordIdentity = user.identities?.find(
          (i) => i.provider === "discord",
        );
        const id = discordIdentity?.identity_data?.sub || user.id;
        const username =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email ||
          "Web User";
        setDiscordUserId(id);
        setDiscordUsername(username);
      }
    } catch (error) {
      console.error("Error loading user session:", error);
    }
  };

  const handlePlay = async (sound: Sound) => {
    if (!selectedChannel) {
      alert("Please select a voice channel first.");
      return;
    }
    try {
      setPlaying(sound.id);

      const payload = {
        soundId: sound.id,
        soundUrl: sound.file_url,
        soundName: sound.name,
        guildId,
        channelId: selectedChannel,
        channelName: voiceChannels.find((c) => c.id === selectedChannel)?.name,
        userId: discordUserId || "unknown",
        username: discordUsername,
      };

      if (botSocket.current?.ready) {
        await botSocket.current.play(payload);
      } else {
        // HTTP fallback (WS not yet connected or failed)
        await playSound(
          payload.soundId,
          payload.guildId,
          payload.channelId,
          payload.userId,
          payload.username,
          payload.soundUrl,
          payload.soundName,
        );
      }
    } catch (error) {
      console.error("Error playing sound:", error);
    } finally {
      setTimeout(() => setPlaying(null), 2000);
    }
  };

  const handleDelete = (sound: Sound) => {
    setSoundToDelete(sound);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!soundToDelete) return;

    try {
      setDeleting(soundToDelete.id);
      const supabase = createClient();

      // Delete from database first
      const { error: dbError } = await supabase
        .from("sounds")
        .delete()
        .eq("id", soundToDelete.id);

      if (dbError) {
        console.error("Database delete error:", dbError);
        throw new Error(`Database error: ${dbError.message}`);
      }

      // Delete from storage
      const fileName = soundToDelete.file_url.split("/").pop();
      console.log("Attempting to delete file:", fileName);
      console.log("Full URL:", soundToDelete.file_url);

      if (fileName) {
        // Decode URL-encoded filename (e.g., %20 -> space)
        const decodedFileName = decodeURIComponent(fileName);
        console.log("Decoded filename:", decodedFileName);

        const { data, error: storageError } = await supabase.storage
          .from("sounds")
          .remove([decodedFileName]);

        console.log("Storage delete result:", { data, error: storageError });

        if (storageError) {
          console.error("Storage delete error:", storageError);
          // Don't throw - database is already deleted, just log the error
          console.warn(
            "Failed to delete file from storage, but database record removed",
          );
        }
      }

      // Update local state
      setSounds((prev) => prev.filter((s) => s.id !== soundToDelete.id));
      setFilteredSounds((prev) =>
        prev.filter((s) => s.id !== soundToDelete.id),
      );
    } catch (error) {
      console.error("Error deleting sound:", error);
      alert(
        `Failed to delete sound: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setDeleting(null);
      setSoundToDelete(null);
    }
  };

  // Upload helpers
  const getAudioDuration = (file: File): Promise<number> =>
    new Promise((resolve) => {
      const audio = document.createElement("audio");
      audio.src = URL.createObjectURL(file);
      audio.onloadedmetadata = () => { URL.revokeObjectURL(audio.src); resolve(audio.duration); };
    });

  const handleUploadDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleUploadDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f?.type.startsWith("audio/")) {
      setUploadFile(f);
      if (!uploadName) setUploadName(f.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const handleUploadFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setUploadFile(f); if (!uploadName) setUploadName(f.name.replace(/\.[^/.]+$/, "")); }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !uploadName) { setUploadMsg("Please provide both file and name"); return; }
    if (uploadFile.size > 15 * 1024 * 1024) { setUploadMsg("File must be under 15MB"); return; }
    const duration = await getAudioDuration(uploadFile);
    if (duration > 600) { setUploadMsg("Audio must be under 10 minutes"); return; }
    setUploading(true); setUploadMsg("");
    try {
      const supabase = createClient();
      const fileName = `${Date.now()}-${uploadFile.name}`;
      const { error: uploadError } = await supabase.storage.from("sounds").upload(fileName, uploadFile);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("sounds").getPublicUrl(fileName);
      const { error: dbError } = await supabase.from("sounds").insert({
        name: uploadName, file_url: publicUrl, file_size: uploadFile.size,
        duration: Math.floor(duration), uploaded_by: "user",
      });
      if (dbError) throw dbError;
      setUploadMsg("✅ Uploaded!");
      setUploadFile(null); setUploadName("");
      await loadSounds();
      setTimeout(() => { setUploadOpen(false); setUploadMsg(""); }, 1200);
    } catch (err: any) {
      setUploadMsg(`❌ ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const truncateName = (name: string, maxLength: number = 30) => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength) + "...";
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <AppLayout>
        <motion.div
          className="flex items-center justify-center py-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="text-center space-y-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="inline-block"
            >
              <svg
                className="h-12 w-12 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </motion.div>
            <p className="text-lg text-muted-foreground">Loading sounds...</p>
          </div>
        </motion.div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className={designTokens.spacing.cardSection}>
        <motion.div
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <h1 className={`${designTokens.typography.h1} mb-3`}>
              Sound Library
            </h1>
            <p
              className={`${designTokens.typography.bodyMuted} flex items-center gap-2`}
            >
              <svg
                className={designTokens.icons.md}
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
              <span className="font-semibold">{sounds.length}</span> sound(s)
              available
            </p>
          </div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={() => { setUploadOpen(true); setUploadMsg(""); }}
              size="lg"
              className={`${designTokens.components.button} shadow-lg`}
            >
              <svg
                className={`${designTokens.icons.md} mr-2`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Upload New
            </Button>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative"
        >
          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg
              className={`${designTokens.icons.md} ${designTokens.iconColors.muted}`}
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
          </div>
          <Input
            placeholder="Search sounds..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`max-w-md ${designTokens.components.input} pl-12 shadow-sm`}
          />
        </motion.div>

        {/* Voice Channel Selector */}
        {voiceChannels.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex items-center gap-3"
          >
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <svg
                className={designTokens.icons.md}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.536 8.464a5 5 0 010 7.072M12 6a7.071 7.071 0 000 12M8.464 8.464a5 5 0 000 7.072"
                />
              </svg>
              <span>Play in:</span>
            </div>
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className={`${designTokens.components.input} text-sm py-1.5 px-3 rounded-lg border cursor-pointer min-w-[180px]`}
            >
              {voiceChannels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.name}
                  {ch.memberCount > 0 ? ` (${ch.memberCount})` : ""}
                </option>
              ))}
            </select>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {filteredSounds.length > 0 ? (
            <motion.div
              key="grid"
              variants={container}
              initial="hidden"
              animate="show"
              exit="hidden"
              className={`grid ${designTokens.spacing.cardGap} md:grid-cols-2 lg:grid-cols-3`}
            >
              {filteredSounds.map((sound) => (
                <motion.div
                  key={sound.id}
                  variants={item}
                  layout
                  whileHover={{ y: -5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <Card
                    className={`h-full ${designTokens.cards.elevated} hover:shadow-xl transition-shadow bg-linear-to-br from-background to-muted/10`}
                  >
                    <CardHeader className="pb-4">
                      <div className="flex items-start gap-3">
                        <div
                          className={`${designTokens.iconContainer} ${designTokens.iconBackgrounds.primary}`}
                        >
                          <svg
                            className={
                              designTokens.icons.md +
                              " " +
                              designTokens.iconColors.primary
                            }
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
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle
                            className={`${designTokens.typography.h3} mb-2`}
                            title={sound.name}
                          >
                            {truncateName(sound.name)}
                          </CardTitle>
                          <CardDescription
                            className={`${designTokens.typography.smallMuted} flex flex-col gap-1.5`}
                          >
                            <span className="flex items-center gap-1.5">
                              <svg
                                className={designTokens.icons.sm}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              {formatDuration(sound.duration)}
                            </span>
                            {sound.play_count > 0 && (
                              <span className="flex items-center gap-1.5">
                                <svg
                                  className={designTokens.icons.sm}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                                  />
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                                Played {sound.play_count}x
                              </span>
                            )}
                          </CardDescription>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleDelete(sound)}
                          disabled={deleting === sound.id}
                          className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                          title="Delete sound"
                        >
                          {deleting === sound.id ? (
                            <motion.svg
                              animate={{ rotate: 360 }}
                              transition={{
                                repeat: Infinity,
                                duration: 1,
                                ease: "linear",
                              }}
                              className={designTokens.icons.sm}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                              />
                            </motion.svg>
                          ) : (
                            <svg
                              className={designTokens.icons.sm}
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
                          )}
                        </motion.button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Button
                          onClick={() => handlePlay(sound)}
                          disabled={playing === sound.id}
                          className={`w-full ${designTokens.components.button}`}
                          variant={
                            playing === sound.id ? "secondary" : "default"
                          }
                        >
                          {playing === sound.id ? (
                            <motion.span
                              className="flex items-center gap-2"
                              animate={{ opacity: [1, 0.5, 1] }}
                              transition={{ repeat: Infinity, duration: 1.5 }}
                            >
                              <svg
                                className={designTokens.icons.md}
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M8 5v14l11-7z" />
                              </svg>
                              Playing...
                            </motion.span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <svg
                                className={designTokens.icons.md}
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M8 5v14l11-7z" />
                              </svg>
                              Play in Voice
                            </span>
                          )}
                        </Button>
                      </motion.div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <Card className="border-none shadow-lg">
                <CardContent className="py-20 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                    className="inline-block p-6 rounded-full bg-muted/50 mb-6"
                  >
                    <svg
                      className={`${designTokens.icons.md} text-muted-foreground`}
                      style={{ height: "4rem", width: "4rem" }}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      {search ? (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      ) : (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                        />
                      )}
                    </svg>
                  </motion.div>
                  <p className={`${designTokens.typography.h2} mb-3`}>
                    {search ? "No sounds found" : "No sounds uploaded yet"}
                  </p>
                  <p className={`${designTokens.typography.bodyMuted} mb-8`}>
                    {search
                      ? "Try adjusting your search terms"
                      : "Get started by uploading your first audio file"}
                  </p>
                  {!search && (
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button
                        onClick={() => { setUploadOpen(true); setUploadMsg(""); }}
                        size="lg"
                        className={designTokens.components.button}
                      >
                        <svg
                          className={`${designTokens.icons.md} mr-2`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                        Upload Your First Sound
                      </Button>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {uploadOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setUploadOpen(false); }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="w-full max-w-lg mx-4 bg-background border border-border rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-border">
                <div>
                  <h2 className="text-lg font-semibold">Upload Sound</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Max 15MB · Max 10 minutes</p>
                </div>
                <button onClick={() => setUploadOpen(false)} className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <form onSubmit={handleUpload} className="p-6 space-y-5">
                {/* Drag & drop zone */}
                <div
                  onDragEnter={handleUploadDrag} onDragOver={handleUploadDrag}
                  onDragLeave={handleUploadDrag} onDrop={handleUploadDrop}
                  className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
                    dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
                  }`}
                  onClick={() => document.getElementById("upload-file-input")?.click()}
                >
                  <input id="upload-file-input" type="file" accept="audio/*" className="hidden" onChange={handleUploadFileChange} />
                  <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  {uploadFile ? (
                    <div>
                      <p className="text-sm font-medium text-primary">{uploadFile.name}</p>
                      <p className="text-xs text-muted-foreground">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium">Drop audio file here</p>
                      <p className="text-xs text-muted-foreground">or click to browse</p>
                    </div>
                  )}
                </div>
                {/* Name input */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Sound Name</label>
                  <Input
                    placeholder="e.g. Airhorn"
                    value={uploadName}
                    onChange={(e) => setUploadName(e.target.value)}
                    required
                  />
                </div>
                {uploadMsg && (
                  <p className={`text-sm ${uploadMsg.startsWith("✅") ? "text-green-500" : "text-red-500"}`}>{uploadMsg}</p>
                )}
                <div className="flex gap-3 justify-end pt-1">
                  <Button type="button" variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>Cancel</Button>
                  <Button type="submit" disabled={uploading || !uploadFile || !uploadName}>
                    {uploading ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Uploading...</>
                    ) : "Upload"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setSoundToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Sound"
        description={`Are you sure you want to delete "${soundToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </AppLayout>
  );
}
