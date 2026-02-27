"use client";

import { useEffect, useRef, useState, useMemo } from "react";
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
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

// ─── Role constants
const MODERATOR_ROLE_ID = "1473075468088377349";
const MANAGER_ROLE_ID = "1473075468088377350";
const OWNER_ROLE_ID = "1473075468088377352";
const UPLOAD_ROLES = new Set([
  MODERATOR_ROLE_ID,
  MANAGER_ROLE_ID,
  OWNER_ROLE_ID,
]);

// ─── Interfaces
interface Sound {
  id: string;
  name: string;
  file_url: string;
  duration: number;
  uploaded_by: string;
  created_at: string;
  play_count: number;
  category_id: string | null;
}

interface Category {
  id: string;
  name: string;
  position: number;
}

interface VoiceChannel {
  id: string;
  name: string;
  memberCount: number;
  memberIds?: string[];
}

// ─── Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1 },
};

// ─── Draggable sound card (compact horizontal layout)
function DraggableSoundCard({
  sound,
  playing,
  deleting,
  canDelete,
  onPlay,
  onDelete,
  formatDuration,
  truncateName,
  overlay = false,
}: {
  sound: Sound;
  playing: string | null;
  deleting: string | null;
  canDelete: boolean;
  onPlay: (sound: Sound) => void;
  onDelete: (sound: Sound) => void;
  formatDuration: (s: number) => string;
  truncateName: (name: string) => string;
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: sound.id, data: { sound } });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging && !overlay ? "opacity-40" : undefined}
    >
      <Card
        className={`h-16 border border-black/20 dark:border-white/15 shadow-none${overlay ? " shadow-2xl ring-2 ring-primary/50" : ""}`}
      >
        <div className="flex h-full items-center gap-2 px-3">
          {/* Drag handle */}
          <button
            {...listeners}
            {...attributes}
            style={{ touchAction: "none" }}
            className="p-0.5 rounded cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-foreground hover:bg-muted/40 transition-colors shrink-0"
            title="Drag to change category"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8h16M4 16h16"
              />
            </svg>
          </button>

          {/* Music icon */}
          <div className="p-1.5 rounded-md bg-primary/10 shrink-0">
            <svg
              className="h-3.5 w-3.5 text-primary"
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

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-medium leading-tight truncate"
              title={sound.name}
            >
              {truncateName(sound.name)}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <svg
                className="h-3 w-3 shrink-0"
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
              {sound.play_count > 0 && (
                <span className="ml-1 text-muted-foreground/70">
                  · {sound.play_count}x
                </span>
              )}
            </p>
          </div>

          {/* Play button */}
          <motion.button
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onPlay(sound)}
            disabled={playing === sound.id}
            className={`p-1.5 rounded-lg shrink-0 transition-colors disabled:opacity-60 ${
              playing === sound.id
                ? "bg-primary/20 text-primary"
                : "hover:bg-primary/10 text-muted-foreground hover:text-primary"
            }`}
            title="Play in Voice"
          >
            {playing === sound.id ? (
              <motion.svg
                className="h-4 w-4"
                fill="currentColor"
                viewBox="0 0 24 24"
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
              >
                <path d="M8 5v14l11-7z" />
              </motion.svg>
            ) : (
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </motion.button>

          {/* Delete button */}
          {canDelete && (
            <motion.button
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onDelete(sound)}
              disabled={deleting === sound.id}
              className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground/50 hover:text-destructive transition-colors disabled:opacity-50 shrink-0"
              title="Delete sound"
            >
              {deleting === sound.id ? (
                <motion.svg
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="h-4 w-4"
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
              )}
            </motion.button>
          )}
        </div>
      </Card>
    </div>
  );
}
function DroppableCategorySection({
  id,
  label,
  sounds,
  playing,
  deleting,
  discordUserId,
  isOwner,
  onPlay,
  onDelete,
  formatDuration,
  truncateName,
  isDraggingAny,
  onEditCategory,
  onDeleteCategory,
  isDefault,
}: {
  id: string;
  label: string;
  sounds: Sound[];
  playing: string | null;
  deleting: string | null;
  discordUserId: string;
  isOwner: boolean;
  onPlay: (sound: Sound) => void;
  onDelete: (sound: Sound) => void;
  formatDuration: (s: number) => string;
  truncateName: (name: string) => string;
  isDraggingAny: boolean;
  onEditCategory?: () => void;
  onDeleteCategory?: () => void;
  isDefault: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      ref={setNodeRef} 
      className="space-y-2"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Section header — visual drop indicator */}
      <div
        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all duration-200 ${
          isOver
            ? "bg-primary/10 border-primary/40 shadow-inner"
            : isDraggingAny
              ? "border-dashed border-primary/30 bg-muted/30"
              : "border-border/40 bg-muted/20"
        }`}
      >
        <div
          className={`w-2 h-2 rounded-full ${isOver ? "bg-primary animate-pulse" : "bg-muted-foreground/40"}`}
        />
        <span className="font-semibold text-sm text-foreground/80 flex-1">
          {label}
        </span>
        <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
          {sounds.length} sound{sounds.length !== 1 ? "s" : ""}
        </span>
        {isDraggingAny && (
          <span className="text-xs text-primary/70 font-medium">Drop here</span>
        )}
        {!isDefault && (
          <div className="flex items-center gap-1">
            {onEditCategory && (
              <button
                onClick={onEditCategory}
                className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Rename category"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              </button>
            )}
            {onDeleteCategory && (
              <button
                onClick={onDeleteCategory}
                className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                title="Delete category"
              >
                <svg
                  className="w-3.5 h-3.5"
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
        )}
      </div>
      {/* Sound cards — 2-col layout; max 3 rows then scroll */}
      {sounds.length > 0 ? (
        <div
          className="overflow-y-auto p-px"
          style={{ maxHeight: "calc(3 * 64px + 2 * 6px + 2px)" }}
        >
          <div className="grid gap-1.5 pb-px grid-cols-2">
            {(isHovered ? sounds : sounds.slice(0, 2)).map((sound) => (
              <DraggableSoundCard
                key={sound.id}
                sound={sound}
                playing={playing}
                deleting={deleting}
                canDelete={isOwner || sound.uploaded_by === discordUserId}
                onPlay={onPlay}
                onDelete={onDelete}
                formatDuration={formatDuration}
                truncateName={truncateName}
              />
            ))}
          </div>
        </div>
      ) : (
        <div
          className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors duration-200 ${
            isOver ? "border-primary/50 bg-primary/5" : "border-border/30"
          }`}
        >
          <p className="text-sm text-muted-foreground">
            {isDraggingAny
              ? "Drop here to add to this category"
              : "No sounds — drag a card here"}
          </p>
        </div>
      )}
    </div>
  );
}

export default function SoundsPage() {
  // ── Core state
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [filteredSounds, setFilteredSounds] = useState<Sound[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [soundToDelete, setSoundToDelete] = useState<Sound | null>(null);

  // ── User & permissions
  const [discordUserId, setDiscordUserId] = useState("");
  const [discordUsername, setDiscordUsername] = useState("Web User");
  const [canUpload, setCanUpload] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  // ── Voice channels
  const [voiceChannels, setVoiceChannels] = useState<VoiceChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState("");

  // ── Categories
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryPanelOpen, setCategoryPanelOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [deleteCategoryTarget, setDeleteCategoryTarget] =
    useState<Category | null>(null);
  const [deleteCategoryDialogOpen, setDeleteCategoryDialogOpen] =
    useState(false);
  
  // ── Move all sounds
  const [moveAllDialogOpen, setMoveAllDialogOpen] = useState(false);
  const [moveAllSource, setMoveAllSource] = useState("");
  const [moveAllTarget, setMoveAllTarget] = useState("");

  // ── Upload modal
  interface FileWithName {
    file: File;
    name: string;
    id: string;
  }
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<FileWithName[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploadProgress, setUploadProgress] = useState<Record<string, string>>(
    {},
  );
  const [dragActive, setDragActive] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("uncategorized");

  // ── DnD
  const [draggingSound, setDraggingSound] = useState<Sound | null>(null);

  const guildId = process.env.NEXT_PUBLIC_DISCORD_GUILD_ID!;
  const botSocket = useRef<BotSocket | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  // ── WebSocket
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

  // ── Initial load
  useEffect(() => {
    loadSounds();
    loadCategories();
    loadVoiceChannels();
    loadUserSession();
  }, []);

  // ── Search filter
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

  // ── Auto-select user's VC
  useEffect(() => {
    if (!discordUserId || voiceChannels.length === 0) return;
    const userChannel = voiceChannels.find((c) =>
      c.memberIds?.includes(discordUserId),
    );
    if (userChannel) setSelectedChannel(userChannel.id);
  }, [discordUserId, voiceChannels]);

  // ── Grouped sounds (memoised)
  const soundsByCategory = useMemo(() => {
    const grouped: Record<string, Sound[]> = { uncategorized: [] };
    categories.forEach((cat) => {
      grouped[cat.id] = [];
    });
    filteredSounds.forEach((sound) => {
      const key =
        sound.category_id && grouped[sound.category_id] !== undefined
          ? sound.category_id
          : "uncategorized";
      grouped[key].push(sound);
    });
    return grouped;
  }, [filteredSounds, categories]);

  // ── Load functions
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

  const loadCategories = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("sound_categories")
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  const loadVoiceChannels = async () => {
    try {
      const res = await axios.get("/api/bot/channels");
      if (res.data?.data) {
        const channels: VoiceChannel[] = res.data.data;
        setVoiceChannels(channels);
        const lobby = channels.find((c) =>
          c.name.toLowerCase().includes("lobby"),
        );
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
      if (!user) return;
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
      // Check Discord roles
      try {
        const res = await fetch(`/api/bot/members?userId=${id}`);
        if (res.ok) {
          const json = await res.json();
          const roleIds: string[] = json.data?.roleIds ?? [];
          setCanUpload(roleIds.some((r) => UPLOAD_ROLES.has(r)));
          setIsOwner(roleIds.includes(OWNER_ROLE_ID));
        }
      } catch {
        // Role check failure — permissions stay false
      }
    } catch (error) {
      console.error("Error loading user session:", error);
    }
  };

  // ── Play
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
      // Only clear the playing state if this sound is still the active one.
      // If the user switched to another sound before the timeout fires, leave it alone.
      setTimeout(
        () => setPlaying((prev) => (prev === sound.id ? null : prev)),
        2000,
      );
    }
  };

  // ── Delete sound
  const handleDelete = (sound: Sound) => {
    setSoundToDelete(sound);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!soundToDelete) return;
    try {
      setDeleting(soundToDelete.id);
      const supabase = createClient();
      const { error: dbError } = await supabase
        .from("sounds")
        .delete()
        .eq("id", soundToDelete.id);
      if (dbError) throw new Error(`Database error: ${dbError.message}`);
      const fileName = soundToDelete.file_url.split("/").pop();
      if (fileName) {
        await supabase.storage
          .from("sounds")
          .remove([decodeURIComponent(fileName)]);
      }
      setSounds((prev) => prev.filter((s) => s.id !== soundToDelete.id));
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

  // ── Upload helpers
  const getAudioDuration = (file: File): Promise<number> =>
    new Promise((resolve) => {
      const audio = document.createElement("audio");
      audio.src = URL.createObjectURL(file);
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(audio.src);
        resolve(audio.duration);
      };
    });

  const handleUploadDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleUploadDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("audio/"),
      );
      addUploadFiles(droppedFiles);
    }
  };

  const addUploadFiles = (newFiles: File[]) => {
    const filesWithNames: FileWithName[] = newFiles.map((f) => ({
      file: f,
      name: f.name.replace(/\.[^/.]+$/, ""),
      id: `${Date.now()}-${Math.random()}`,
    }));
    setUploadFiles((prev) => [...prev, ...filesWithNames]);
  };

  const removeUploadFile = (id: string) => {
    setUploadFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const updateUploadFileName = (id: string, newName: string) => {
    setUploadFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, name: newName } : f)),
    );
  };

  const handleUploadFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
    addUploadFiles(selectedFiles);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadFiles.length === 0) {
      setUploadMsg("Please add at least one file");
      return;
    }

    const invalidFiles = uploadFiles.filter(
      (f) => f.file.size > 15 * 1024 * 1024,
    );
    if (invalidFiles.length > 0) {
      setUploadMsg(`${invalidFiles.length} file(s) exceed 15MB limit`);
      return;
    }

    setUploading(true);
    setUploadMsg("");
    setUploadProgress({});

    let successCount = 0;
    let failCount = 0;

    try {
      const supabase = createClient();

      for (const fileData of uploadFiles) {
        try {
          setUploadProgress((prev) => ({
            ...prev,
            [fileData.id]: "Checking duration...",
          }));

          const duration = await getAudioDuration(fileData.file);
          if (duration > 600) {
            setUploadProgress((prev) => ({
              ...prev,
              [fileData.id]: "❌ Exceeds 10 min",
            }));
            failCount++;
            continue;
          }

          setUploadProgress((prev) => ({
            ...prev,
            [fileData.id]: "Uploading...",
          }));

          const fileName = `${Date.now()}-${fileData.file.name}`;
          const { error: uploadError } = await supabase.storage
            .from("sounds")
            .upload(fileName, fileData.file);

          if (uploadError) throw uploadError;

          const {
            data: { publicUrl },
          } = supabase.storage.from("sounds").getPublicUrl(fileName);

          setUploadProgress((prev) => ({
            ...prev,
            [fileData.id]: "Saving to database...",
          }));

          const categoryId = uploadCategory === "uncategorized" ? null : uploadCategory;
          const { error: dbError } = await supabase.from("sounds").insert({
            name: fileData.name,
            file_url: publicUrl,
            file_size: fileData.file.size,
            duration: Math.floor(duration),
            uploaded_by: discordUserId || "unknown",
            category_id: categoryId,
          });

          if (dbError) throw dbError;

          setUploadProgress((prev) => ({
            ...prev,
            [fileData.id]: "✅ Complete",
          }));
          successCount++;
        } catch (error: any) {
          setUploadProgress((prev) => ({
            ...prev,
            [fileData.id]: `❌ ${error.message}`,
          }));
          failCount++;
        }
      }

      setUploadMsg(
        `✅ ${successCount} uploaded${failCount > 0 ? `, ${failCount} failed` : ""}`,
      );
      await loadSounds();

      setTimeout(() => {
        setUploadOpen(false);
        setUploadMsg("");
        setUploadFiles([]);
        setUploadProgress({});
        setUploadCategory("uncategorized");
      }, 2000);
    } catch (err: unknown) {
      setUploadMsg(
        `❌ ${err instanceof Error ? err.message : "Upload failed"}`,
      );
    } finally {
      setUploading(false);
    }
  };

  // ── Category CRUD
  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setSavingCategory(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("sound_categories")
        .insert({ name, position: categories.length })
        .select()
        .single();
      if (error) throw error;
      setCategories((prev) => [...prev, data]);
      setNewCategoryName("");
    } catch (err) {
      console.error("Error creating category:", err);
    } finally {
      setSavingCategory(false);
    }
  };

  const handleRenameCategory = async () => {
    if (!editingCategory) return;
    const name = editCategoryName.trim();
    if (!name) return;
    setSavingCategory(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("sound_categories")
        .update({ name })
        .eq("id", editingCategory.id);
      if (error) throw error;
      setCategories((prev) =>
        prev.map((c) => (c.id === editingCategory.id ? { ...c, name } : c)),
      );
      setEditingCategory(null);
      setEditCategoryName("");
    } catch (err) {
      console.error("Error renaming category:", err);
    } finally {
      setSavingCategory(false);
    }
  };

  const confirmDeleteCategory = async () => {
    if (!deleteCategoryTarget) return;
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("sound_categories")
        .delete()
        .eq("id", deleteCategoryTarget.id);
      if (error) throw error;
      setCategories((prev) =>
        prev.filter((c) => c.id !== deleteCategoryTarget.id),
      );
      setSounds((prev) =>
        prev.map((s) =>
          s.category_id === deleteCategoryTarget.id
            ? { ...s, category_id: null }
            : s,
        ),
      );
    } catch (err) {
      console.error("Error deleting category:", err);
    } finally {
      setDeleteCategoryTarget(null);
    }
  };

  const handleMoveAllSounds = async () => {
    if (!moveAllSource || !moveAllTarget) return;
    try {
      const supabase = createClient();
      const sourceCatId = moveAllSource === "uncategorized" ? null : moveAllSource;
      const targetCatId = moveAllTarget === "uncategorized" ? null : moveAllTarget;
      
      const { error } = await supabase
        .from("sounds")
        .update({ category_id: targetCatId })
        .eq("category_id", sourceCatId);
      
      if (error) throw error;
      
      // Update local state
      setSounds((prev) =>
        prev.map((s) =>
          s.category_id === sourceCatId ? { ...s, category_id: targetCatId } : s,
        ),
      );
      
      setMoveAllDialogOpen(false);
      setMoveAllSource("");
      setMoveAllTarget("");
    } catch (err) {
      console.error("Error moving sounds:", err);
    }
  };

  // ── DnD
  const handleDragStart = (event: DragStartEvent) => {
    const sound = sounds.find((s) => s.id === event.active.id);
    setDraggingSound(sound || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setDraggingSound(null);
    const { active, over } = event;
    if (!over) return;
    const soundId = active.id as string;
    const targetCategoryId = over.id as string;
    const sound = sounds.find((s) => s.id === soundId);
    if (!sound) return;
    const newCatId =
      targetCategoryId === "uncategorized" ? null : targetCategoryId;
    if (sound.category_id === newCatId) return;
    // Optimistic update
    setSounds((prev) =>
      prev.map((s) => (s.id === soundId ? { ...s, category_id: newCatId } : s)),
    );
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("sounds")
        .update({ category_id: newCatId })
        .eq("id", soundId);
      if (error) throw error;
    } catch (err) {
      console.error("Error updating category:", err);
      // Revert
      setSounds((prev) =>
        prev.map((s) =>
          s.id === soundId ? { ...s, category_id: sound.category_id } : s,
        ),
      );
    }
  };

  // ── Helpers
  const truncateName = (name: string, max = 28) =>
    name.length <= max ? name : name.substring(0, max) + "…";

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
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className={designTokens.spacing.cardSection}>
          {/* ── Header ── */}
          <motion.div
            className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"
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
            <div className="flex items-center gap-3 flex-wrap">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setCategoryPanelOpen(true)}
                  className={`${designTokens.components.button} gap-2 shadow-lg`}
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
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"
                    />
                  </svg>
                  Manage Categories
                </Button>
              </motion.div>
              {canUpload && (
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    onClick={() => {
                      setUploadOpen(true);
                      setUploadMsg("");
                    }}
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
              )}
            </div>
          </motion.div>

          {/* ── Search bar ── */}
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
              className={`w-full md:max-w-md ${designTokens.components.input} pl-12 shadow-sm`}
            />
          </motion.div>

          {/* ── Voice channel selector ── */}
          {voiceChannels.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="flex flex-wrap items-center gap-3"
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
                className={`${designTokens.components.input} text-sm py-1.5 px-3 rounded-lg border cursor-pointer w-full sm:w-auto sm:min-w-45`}
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

          {/* ── DnD hint ── */}
          {sounds.length > 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="hidden md:flex text-xs text-muted-foreground/60 items-center gap-1.5"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8h16M4 16h16"
                />
              </svg>
              Drag the handle on a card and drop it onto a category header to
              move it
            </motion.p>
          )}

          {/* ── Grouped sound sections ── */}
          {filteredSounds.length > 0 ? (
            <div className="space-y-6">
              {/* Mobile: stacked categories (no hover-expand) */}
              <div className="md:hidden space-y-4">
                {[
                  ...categories.map((cat) => ({
                    id: cat.id,
                    label: cat.name,
                    isDefault: false as const,
                    sounds: soundsByCategory[cat.id] ?? [],
                    onEdit: () => {
                      setEditingCategory(cat);
                      setEditCategoryName(cat.name);
                    },
                    onDelete: () => {
                      setDeleteCategoryTarget(cat);
                      setDeleteCategoryDialogOpen(true);
                    },
                  })),
                  {
                    id: "uncategorized",
                    label: "Uncategorized",
                    isDefault: true as const,
                    sounds: soundsByCategory["uncategorized"] ?? [],
                    onEdit: undefined,
                    onDelete: undefined,
                  },
                ].map((cat) => (
                  <DroppableCategorySection
                    key={cat.id}
                    id={cat.id}
                    label={cat.label}
                    sounds={cat.sounds}
                    playing={playing}
                    deleting={deleting}
                    discordUserId={discordUserId}
                    isOwner={isOwner}
                    onPlay={handlePlay}
                    onDelete={handleDelete}
                    formatDuration={formatDuration}
                    truncateName={truncateName}
                    isDraggingAny={!!draggingSound}
                    onEditCategory={cat.onEdit}
                    onDeleteCategory={cat.onDelete}
                    isDefault={cat.isDefault}
                  />
                ))}
              </div>

              {/* Desktop: 2-column grid */}
              <div className="hidden md:grid md:grid-cols-2 gap-4">
                {[
                  ...categories.map((cat) => ({
                    id: cat.id,
                    label: cat.name,
                    isDefault: false as const,
                    sounds: soundsByCategory[cat.id] ?? [],
                    onEdit: () => {
                      setEditingCategory(cat);
                      setEditCategoryName(cat.name);
                    },
                    onDelete: () => {
                      setDeleteCategoryTarget(cat);
                      setDeleteCategoryDialogOpen(true);
                    },
                  })),
                  {
                    id: "uncategorized",
                    label: "Uncategorized",
                    isDefault: true as const,
                    sounds: soundsByCategory["uncategorized"] ?? [],
                    onEdit: undefined,
                    onDelete: undefined,
                  },
                ].map((cat) => (
                  <DroppableCategorySection
                    key={cat.id}
                    id={cat.id}
                    label={cat.label}
                    sounds={cat.sounds}
                    playing={playing}
                    deleting={deleting}
                    discordUserId={discordUserId}
                    isOwner={isOwner}
                    onPlay={handlePlay}
                    onDelete={handleDelete}
                    formatDuration={formatDuration}
                    truncateName={truncateName}
                    isDraggingAny={!!draggingSound}
                    onEditCategory={cat.onEdit}
                    onDeleteCategory={cat.onDelete}
                    isDefault={cat.isDefault}
                  />
                ))}
              </div>
            </div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
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
                      : canUpload
                        ? "Get started by uploading your first audio file"
                        : "No sounds have been uploaded yet"}
                  </p>
                  {!search && canUpload && (
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button
                        onClick={() => {
                          setUploadOpen(true);
                          setUploadMsg("");
                        }}
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
        </div>

        {/* ── DnD Drag Overlay ── */}
        <DragOverlay dropAnimation={null}>
          {draggingSound ? (
            <div className="w-72 rotate-2 opacity-95 pointer-events-none">
              <DraggableSoundCard
                sound={draggingSound}
                playing={null}
                deleting={null}
                canDelete={false}
                onPlay={() => {}}
                onDelete={() => {}}
                formatDuration={formatDuration}
                truncateName={truncateName}
                overlay
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* ══════════════ Category Management Modal ══════════════ */}
      <AnimatePresence>
        {categoryPanelOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setCategoryPanelOpen(false);
                setEditingCategory(null);
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-lg bg-background rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`${designTokens.iconContainer} ${designTokens.iconBackgrounds.primary}`}
                  >
                    <svg
                      className={`${designTokens.icons.md} ${designTokens.iconColors.primary}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className={designTokens.typography.h2}>
                      Manage Categories
                    </h2>
                    <p className={designTokens.typography.smallMuted}>
                      Create, rename, or delete sound categories
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setCategoryPanelOpen(false);
                    setEditingCategory(null);
                  }}
                  className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                {/* Create new */}
                <div className="space-y-3">
                  <label
                    className={`${designTokens.typography.body} font-medium`}
                  >
                    New Category
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Category name…"
                      className={`${designTokens.components.input} flex-1`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleCreateCategory();
                        }
                      }}
                    />
                    <Button
                      onClick={handleCreateCategory}
                      disabled={!newCategoryName.trim() || savingCategory}
                      className={designTokens.components.button}
                    >
                      {savingCategory ? (
                        <motion.svg
                          animate={{ rotate: 360 }}
                          transition={{
                            repeat: Infinity,
                            duration: 1,
                            ease: "linear",
                          }}
                          className="w-4 h-4"
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
                          className="w-4 h-4"
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
                      )}
                      <span className="ml-1.5">Add</span>
                    </Button>
                  </div>
                </div>

                {/* Existing categories */}
                <div className="space-y-2">
                  <label
                    className={`${designTokens.typography.body} font-medium`}
                  >
                    Existing Categories
                  </label>

                  {/* Uncategorized — read-only */}
                  <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-muted/30 border border-border/40">
                    <span className="flex-1 text-sm font-medium text-muted-foreground">
                      Uncategorized
                    </span>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {soundsByCategory["uncategorized"]?.length ?? 0} sounds
                    </span>
                    <span className="text-xs text-muted-foreground/50 italic">
                      default
                    </span>
                  </div>

                  {categories.length === 0 && (
                    <p className="text-sm text-muted-foreground/60 text-center py-4">
                      No categories yet. Create one above.
                    </p>
                  )}

                  {categories.map((cat) => (
                    <div key={cat.id}>
                      {editingCategory?.id === cat.id ? (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/30 bg-primary/5">
                          <Input
                            value={editCategoryName}
                            onChange={(e) =>
                              setEditCategoryName(e.target.value)
                            }
                            className={`${designTokens.components.input} flex-1 h-8 text-sm`}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleRenameCategory();
                              }
                              if (e.key === "Escape") setEditingCategory(null);
                            }}
                          />
                          <Button
                            size="sm"
                            onClick={handleRenameCategory}
                            disabled={savingCategory}
                            className="h-8 text-xs"
                          >
                            Save
                          </Button>
                          <button
                            onClick={() => setEditingCategory(null)}
                            className="p-1 text-muted-foreground hover:text-foreground"
                          >
                            <svg
                              className="w-4 h-4"
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
                      ) : (
                        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border/40 hover:border-border/70 hover:bg-muted/20 transition-colors group">
                          <span className="flex-1 text-sm font-medium">
                            {cat.name}
                          </span>
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            {soundsByCategory[cat.id]?.length ?? 0} sounds
                          </span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                setEditingCategory(cat);
                                setEditCategoryName(cat.name);
                              }}
                              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="Rename"
                            >
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={() => {
                                setDeleteCategoryTarget(cat);
                                setDeleteCategoryDialogOpen(true);
                              }}
                              className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              title="Delete"
                            >
                              <svg
                                className="w-3.5 h-3.5"
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
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <p className="text-xs text-muted-foreground/60 flex items-start gap-1.5">
                  <svg
                    className="w-3.5 h-3.5 mt-0.5 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Deleting a category moves all its sounds to Uncategorized.
                </p>

                {/* Move All Sounds */}
                <div className="space-y-3 pt-4 border-t border-border/40">
                  <label
                    className={`${designTokens.typography.body} font-medium flex items-center gap-2`}
                  >
                    <svg
                      className="w-4 h-4 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                      />
                    </svg>
                    Move All Sounds
                  </label>
                  <p className="text-xs text-muted-foreground/70">
                    Move all sounds from one category to another
                  </p>
                  <Button
                    onClick={() => setMoveAllDialogOpen(true)}
                    variant="outline"
                    className="w-full"
                  >
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                      />
                    </svg>
                    Move Sounds Between Categories
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Move All Sounds Dialog */}
      <AnimatePresence>
        {moveAllDialogOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setMoveAllDialogOpen(false);
                setMoveAllSource("");
                setMoveAllTarget("");
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md bg-background rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-border">
                <div className="flex items-center gap-3">
                  <div
                    className={`${designTokens.iconContainer} ${designTokens.iconBackgrounds.primary}`}
                  >
                    <svg
                      className={`${designTokens.icons.md} ${designTokens.iconColors.primary}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className={designTokens.typography.h2}>
                      Move All Sounds
                    </h2>
                    <p className={designTokens.typography.smallMuted}>
                      Transfer all sounds between categories
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className={designTokens.typography.body}>From Category</label>
                  <select
                    value={moveAllSource}
                    onChange={(e) => setMoveAllSource(e.target.value)}
                    className={`${designTokens.components.input} w-full`}
                  >
                    <option value="">Select source category...</option>
                    <option value="uncategorized">Uncategorized ({soundsByCategory["uncategorized"]?.length ?? 0} sounds)</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} ({soundsByCategory[cat.id]?.length ?? 0} sounds)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-muted-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    />
                  </svg>
                </div>

                <div className="space-y-2">
                  <label className={designTokens.typography.body}>To Category</label>
                  <select
                    value={moveAllTarget}
                    onChange={(e) => setMoveAllTarget(e.target.value)}
                    className={`${designTokens.components.input} w-full`}
                  >
                    <option value="">Select target category...</option>
                    <option value="uncategorized">Uncategorized</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id} disabled={cat.id === moveAllSource}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {moveAllSource && moveAllTarget && moveAllSource !== moveAllTarget && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-primary/10 border border-primary/30 rounded-lg text-sm"
                  >
                    <p className="text-foreground/80">
                      This will move <strong>{soundsByCategory[moveAllSource]?.length ?? 0} sounds</strong> from{" "}
                      <strong>{moveAllSource === "uncategorized" ? "Uncategorized" : categories.find(c => c.id === moveAllSource)?.name}</strong> to{" "}
                      <strong>{moveAllTarget === "uncategorized" ? "Uncategorized" : categories.find(c => c.id === moveAllTarget)?.name}</strong>
                    </p>
                  </motion.div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setMoveAllDialogOpen(false);
                      setMoveAllSource("");
                      setMoveAllTarget("");
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleMoveAllSounds}
                    disabled={!moveAllSource || !moveAllTarget || moveAllSource === moveAllTarget}
                    className="flex-1"
                  >
                    Move All
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ══════════════ Upload Modal ══════════════ */}
      <AnimatePresence>
        {uploadOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setUploadOpen(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-2xl bg-background rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`${designTokens.iconContainer} ${designTokens.iconBackgrounds.purple}`}
                    >
                      <svg
                        className={`${designTokens.icons.md} ${designTokens.iconColors.purple}`}
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
                    </div>
                    <div>
                      <h2 className={designTokens.typography.h2}>
                        Bulk Upload Sounds
                      </h2>
                      <div
                        className={`${designTokens.typography.smallMuted} flex items-center gap-4 mt-1`}
                      >
                        <span className="flex items-center gap-1.5">
                          <svg
                            className="h-4 w-4 shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                          15MB max
                        </span>
                        <span className="flex items-center gap-1.5">
                          <svg
                            className="h-4 w-4 shrink-0"
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
                          10 mins max
                        </span>
                        <span className="flex items-center gap-1.5">
                          <svg
                            className="h-4 w-4 shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                            />
                          </svg>
                          Multiple files
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setUploadOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground transition-colors"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6 max-h-[calc(100vh-180px)] overflow-y-auto">
                <form
                  onSubmit={handleUpload}
                  className={designTokens.spacing.cardSection}
                >
                  {/* Category Selection */}
                  <motion.div
                    className={designTokens.spacing.inputGroup}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.02 }}
                  >
                    <label
                      className={`${designTokens.typography.body} flex items-center gap-2`}
                    >
                      <svg
                        className={`${designTokens.icons.sm} ${designTokens.iconColors.muted}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"
                        />
                      </svg>
                      Upload to Category
                    </label>
                    <select
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value)}
                      className={`${designTokens.components.input} w-full`}
                    >
                      <option value="uncategorized">Uncategorized</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                    <p className={`${designTokens.typography.small} text-muted-foreground/70`}>
                      Choose which category to upload sounds to
                    </p>
                  </motion.div>

                  <motion.div
                    className={designTokens.spacing.inputGroup}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 }}
                  >
                    <label
                      className={`${designTokens.typography.body} flex items-center gap-2`}
                    >
                      <svg
                        className={`${designTokens.icons.sm} ${designTokens.iconColors.muted}`}
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
                      Audio Files
                    </label>
                    <motion.div
                      onDragEnter={handleUploadDrag}
                      onDragLeave={handleUploadDrag}
                      onDragOver={handleUploadDrag}
                      onDrop={handleUploadDrop}
                      animate={{
                        borderColor: dragActive
                          ? "hsl(var(--primary))"
                          : "hsl(var(--border))",
                        backgroundColor: dragActive
                          ? "hsl(var(--primary) / 0.05)"
                          : "transparent",
                      }}
                      className="relative border-2 border-dashed rounded-lg p-8 transition-colors"
                    >
                      <input
                        type="file"
                        accept="audio/*"
                        multiple
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={handleUploadFileChange}
                      />
                      <div className="flex flex-col items-center justify-center text-center space-y-3">
                        <motion.div
                          animate={{ y: dragActive ? -5 : 0 }}
                          transition={{ type: "spring", stiffness: 300 }}
                          className={`${designTokens.iconContainer} p-4 rounded-full ${designTokens.iconBackgrounds.primary}`}
                        >
                          <svg
                            className={`${designTokens.icons.md} ${designTokens.iconColors.primary}`}
                            style={{ height: "2rem", width: "2rem" }}
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
                        </motion.div>
                        <div>
                          <p className={designTokens.typography.h3}>
                            {dragActive
                              ? "Drop your files here"
                              : "Click to browse or drag and drop"}
                          </p>
                          <p
                            className={`${designTokens.typography.small} mt-1`}
                          >
                            Select multiple audio files (MP3, WAV, OGG, etc.)
                          </p>
                        </div>
                      </div>
                    </motion.div>
                    <AnimatePresence>
                      {uploadFiles.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden mt-3"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <p
                              className={`${designTokens.typography.small} font-medium`}
                            >
                              {uploadFiles.length} file(s) selected
                            </p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setUploadFiles([])}
                              className="h-7 text-xs"
                            >
                              Clear all
                            </Button>
                          </div>
                          <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
                            {uploadFiles.map((fileData) => (
                              <motion.div
                                key={fileData.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="p-3 rounded-lg bg-primary/5 border border-primary/20"
                              >
                                <div className="flex items-start gap-3">
                                  <div
                                    className={`${designTokens.iconContainer} ${designTokens.iconBackgrounds.primary} mt-1`}
                                  >
                                    <svg
                                      className={`${designTokens.icons.sm} ${designTokens.iconColors.primary}`}
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
                                  <div className="flex-1 min-w-0 space-y-2">
                                    <Input
                                      value={fileData.name}
                                      onChange={(e) =>
                                        updateUploadFileName(
                                          fileData.id,
                                          e.target.value,
                                        )
                                      }
                                      placeholder="Sound name"
                                      className="h-8 text-sm"
                                      disabled={uploading}
                                    />
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <span className="truncate">
                                        {fileData.file.name}
                                      </span>
                                      <span>•</span>
                                      <span>
                                        {(
                                          fileData.file.size /
                                          1024 /
                                          1024
                                        ).toFixed(2)}{" "}
                                        MB
                                      </span>
                                      {uploadProgress[fileData.id] && (
                                        <>
                                          <span>•</span>
                                          <span
                                            className={
                                              uploadProgress[
                                                fileData.id
                                              ].includes("✅")
                                                ? "text-green-600"
                                                : uploadProgress[
                                                      fileData.id
                                                    ].includes("❌")
                                                  ? "text-red-600"
                                                  : ""
                                            }
                                          >
                                            {uploadProgress[fileData.id]}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <motion.button
                                    type="button"
                                    onClick={() =>
                                      removeUploadFile(fileData.id)
                                    }
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    disabled={uploading}
                                    className="p-1 rounded-lg hover:bg-destructive/20 text-destructive transition-colors disabled:opacity-50"
                                  >
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
                                        d="M6 18L18 6M6 6l12 12"
                                      />
                                    </svg>
                                  </motion.button>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                  >
                    <Button
                      type="submit"
                      disabled={uploading}
                      className={`${designTokens.components.button} w-full font-semibold`}
                      size="lg"
                    >
                      {uploading ? (
                        <span className="flex items-center gap-2">
                          <motion.svg
                            animate={{ rotate: 360 }}
                            transition={{
                              repeat: Infinity,
                              duration: 1,
                              ease: "linear",
                            }}
                            className={designTokens.icons.md}
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
                          Uploading...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
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
                              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                            />
                          </svg>
                          Upload{" "}
                          {uploadFiles.length > 0
                            ? `${uploadFiles.length} Sound${uploadFiles.length > 1 ? "s" : ""}`
                            : "Sounds"}
                        </span>
                      )}
                    </Button>
                  </motion.div>

                  <AnimatePresence>
                    {uploadMsg && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: "auto" }}
                        exit={{ opacity: 0, y: -10, height: 0 }}
                        className={`overflow-hidden rounded-lg p-5 text-base font-medium flex items-center gap-3 ${
                          uploadMsg.includes("❌")
                            ? "bg-destructive/15 text-destructive border border-destructive/30"
                            : "bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/30"
                        }`}
                      >
                        {uploadMsg.includes("❌") ? (
                          <svg
                            className="h-5 w-5 shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="h-5 w-5 shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        )}
                        {uploadMsg}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Delete sound confirmation ── */}
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

      {/* ── Delete category confirmation ── */}
      <ConfirmDialog
        isOpen={deleteCategoryDialogOpen}
        onClose={() => {
          setDeleteCategoryDialogOpen(false);
          setDeleteCategoryTarget(null);
        }}
        onConfirm={confirmDeleteCategory}
        title="Delete Category"
        description={`Are you sure you want to delete "${deleteCategoryTarget?.name}"? All sounds will be moved to Uncategorized.`}
        confirmText="Delete Category"
        cancelText="Cancel"
        variant="danger"
      />
    </AppLayout>
  );
}
