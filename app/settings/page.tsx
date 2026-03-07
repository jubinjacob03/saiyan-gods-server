"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import AppLayout from "@/components/AppLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { designTokens } from "@/lib/design-tokens";
import { createClient } from "@/lib/supabase";
import ConfirmDialog from "@/components/ConfirmDialog";

const OWNER_ROLE_ID = "1473075468088377352";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

interface UserProfile {
  name: string;
  email: string;
  avatar: string;
  discordId: string;
}

interface PlaybackEntry {
  id: string;
  discord_username: string;
  channel_id: string;
  channel_name: string | null;
  played_at: string;
  sounds: { name: string } | null;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export default function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [discordId, setDiscordId] = useState("");
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearDone, setClearDone] = useState(false);
  const [migrateLoading, setMigrateLoading] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{
    total: number;
    successful: number;
    failed: number;
    errors?: string[];
  } | null>(null);
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [logEntries, setLogEntries] = useState<PlaybackEntry[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logLoaded, setLogLoaded] = useState(false);
  const [channelMap, setChannelMap] = useState<Record<string, string>>({});

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchPlaybackLog = async () => {
    try {
      setLogLoading(true);

      // Fetch channel names from bot API in parallel with DB query
      const [channelsRes, supabaseResult] = await Promise.all([
        fetch("/api/bot/channels").catch(() => null),
        (async () => {
          const supabase = createClient();
          return supabase
            .from("playback_history")
            .select(
              "id, discord_username, channel_id, channel_name, played_at, sounds(name)",
            )
            .order("played_at", { ascending: false })
            .limit(50);
        })(),
      ]);

      if (channelsRes?.ok) {
        const json = await channelsRes.json();
        const channels: { id: string; name: string }[] = json?.data || [];
        const map: Record<string, string> = {};
        channels.forEach((c) => {
          map[c.id] = c.name;
        });
        setChannelMap(map);
      }

      const { data, error } = supabaseResult;
      if (!error && data) setLogEntries(data as unknown as PlaybackEntry[]);
    } catch {
    } finally {
      setLogLoading(false);
      setLogLoaded(true);
    }
  };

  const toggleLog = () => {
    if (!logOpen && !logLoaded) fetchPlaybackLog();
    setLogOpen((prev) => !prev);
  };

  const fetchUserProfile = async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const id =
          user.identities?.find((i) => i.provider === "discord")?.identity_data
            ?.sub || user.id;
        setDiscordId(id);
        setUser({
          name:
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            "Unknown",
          email: user.email || "",
          avatar: user.user_metadata?.avatar_url || "",
          discordId: id,
        });
        // Restore per-user theme preference
        const savedTheme = localStorage.getItem(`theme_${id}`);
        if (savedTheme) setTheme(savedTheme);
        // Check owner role
        try {
          const res = await fetch(`/api/bot/members?userId=${id}`);
          if (res.ok) {
            const json = await res.json();
            const roleIds: string[] = json.data?.roleIds ?? [];
            setIsOwner(roleIds.includes(OWNER_ROLE_ID));
          } else {
            setIsOwner(false);
          }
        } catch {
          setIsOwner(false);
        }
      }
    } catch {}
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const handleClearLibrary = async () => {
    try {
      setClearing(true);
      const supabase = createClient();

      // Get all sounds to delete their storage files
      const { data: sounds } = await supabase.from("sounds").select("file_url");

      // Delete all storage files
      if (sounds && sounds.length > 0) {
        const fileNames = sounds
          .map((s) => decodeURIComponent(s.file_url.split("/").pop() || ""))
          .filter(Boolean);
        if (fileNames.length > 0) {
          await supabase.storage.from("sounds").remove(fileNames);
        }
      }

      // Delete all DB records
      await supabase
        .from("playback_history")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase
        .from("sounds")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      setClearDone(true);
      setTimeout(() => setClearDone(false), 3000);
    } catch (err) {
      console.error("Error clearing library:", err);
    } finally {
      setClearing(false);
      setClearDialogOpen(false);
    }
  };

  const handleMigrateCache = async () => {
    if (!isOwner) {
      console.log("[Migration] Access denied - not owner");
      showToast("Only owners can run migration", "error");
      return;
    }
    
    console.log("[Migration] Starting playlist cache migration...");
    setMigrateLoading(true);
    setMigrationResult(null);
    showToast("Migration started... This may take several minutes.", "success");
    
    try {
      console.log("[Migration] Calling /api/playlists/migrate-cache");
      const res = await fetch("/api/playlists/migrate-cache", {
        method: "POST",
      });
      
      console.log(`[Migration] Response status: ${res.status}`);
      const json = await res.json();
      console.log("[Migration] Response data:", json);
      
      if (res.ok) {
        setMigrationResult(json);
        const message = `Migration complete! ${json.successful}/${json.total} songs cached successfully.`;
        console.log(`[Migration] ${message}`);
        
        if (json.errors && json.errors.length > 0) {
          console.log("[Migration] Errors:", json.errors);
        }
        
        showToast(message, json.failed > 0 ? "error" : "success");
      } else {
        console.error("[Migration] Failed:", json.error);
        showToast(json.error || "Migration failed", "error");
      }
    } catch (error) {
      console.error("[Migration] Network error:", error);
      showToast("Network error during migration", "error");
    } finally {
      setMigrateLoading(false);
      console.log("[Migration] Process complete");
    }
  };

  return (
    <AppLayout>
      <motion.div
        className={`max-w-3xl mx-auto ${designTokens.spacing.cardSection + " space-y-10"}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h1 className={`${designTokens.typography.h1} mb-3`}>Settings</h1>
          <p className={designTokens.typography.bodyMuted}>
            Account and library management
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-8"
        >
          {/* Account Card */}
          <motion.div variants={item}>
            <Card className="border-none shadow-lg">
              <CardHeader className="pb-6">
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
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>
                  <div>
                    <CardTitle className={designTokens.typography.h2}>
                      Your Account
                    </CardTitle>
                    <CardDescription
                      className={`${designTokens.typography.smallMuted} mt-1`}
                    >
                      Logged in via Discord OAuth
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {user ? (
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.name}
                          className="w-14 h-14 rounded-full ring-2 ring-primary/20"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
                          {user.name[0]}
                        </div>
                      )}
                      <div className="space-y-1">
                        <p className={designTokens.typography.h3}>
                          {user.name}
                        </p>
                        <p className={designTokens.typography.smallMuted}>
                          {user.email}
                        </p>
                        <p className="text-xs text-muted-foreground/60 font-mono">
                          ID: {user.discordId}
                        </p>
                      </div>
                    </div>
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button
                        variant="outline"
                        onClick={handleSignOut}
                        className="text-red-500 border-red-500/30 hover:bg-red-500/10 hover:border-red-500/50"
                      >
                        <svg
                          className="h-4 w-4 mr-2"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                          />
                        </svg>
                        Sign Out
                      </Button>
                    </motion.div>
                  </div>
                ) : (
                  <div className="h-14 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-muted/40 animate-pulse" />
                    <div className="space-y-2">
                      <div className="h-4 w-32 bg-muted/40 rounded animate-pulse" />
                      <div className="h-3 w-48 bg-muted/30 rounded animate-pulse" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Playback Log Accordion */}
          <motion.div variants={item}>
            <Card className="border-none shadow-lg overflow-hidden">
              <button
                onClick={toggleLog}
                className="w-full text-left focus:outline-none"
                aria-expanded={logOpen}
              >
                <CardHeader className="pb-4 cursor-pointer select-none">
                  <div className="flex items-center justify-between">
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
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                          />
                        </svg>
                      </div>
                      <div>
                        <CardTitle className={designTokens.typography.h2}>
                          Playback Log
                        </CardTitle>
                        <CardDescription
                          className={`${designTokens.typography.smallMuted} mt-1`}
                        >
                          Recent audio activity — last 50 entries
                        </CardDescription>
                      </div>
                    </div>
                    <motion.div
                      animate={{ rotate: logOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="shrink-0 mr-2"
                    >
                      <svg
                        className="h-5 w-5 text-muted-foreground"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </motion.div>
                  </div>
                </CardHeader>
              </button>

              <AnimatePresence initial={false}>
                {logOpen && (
                  <motion.div
                    key="log-content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    style={{ overflow: "hidden" }}
                  >
                    <CardContent className="pt-0 pb-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs text-muted-foreground/60">
                          Sorted by most recent
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            fetchPlaybackLog();
                          }}
                        >
                          <svg
                            className={`h-3.5 w-3.5 mr-1 ${logLoading ? "animate-spin" : ""}`}
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
                          Refresh
                        </Button>
                      </div>

                      {logLoading ? (
                        <div className="space-y-2">
                          {[...Array(5)].map((_, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 animate-pulse"
                            >
                              <div className="h-8 w-8 rounded-full bg-muted/40 shrink-0" />
                              <div className="flex-1 space-y-1.5">
                                <div className="h-3 w-1/3 bg-muted/40 rounded" />
                                <div className="h-3 w-2/3 bg-muted/30 rounded" />
                              </div>
                              <div className="h-3 w-16 bg-muted/30 rounded" />
                            </div>
                          ))}
                        </div>
                      ) : logEntries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                          <svg
                            className="h-10 w-10 text-muted-foreground/30 mb-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                            />
                          </svg>
                          <p className={designTokens.typography.bodyMuted}>
                            No playback history yet
                          </p>
                          <p className="text-xs text-muted-foreground/50 mt-1">
                            Play a sound to see it here
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                          {logEntries.map((entry, idx) => (
                            <motion.div
                              key={entry.id}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.02 }}
                              className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/20 transition-colors group"
                            >
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-semibold text-primary">
                                {(entry.discord_username ||
                                  "?")[0].toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0 space-y-0.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-sm font-medium truncate max-w-30">
                                    {entry.discord_username || "Unknown"}
                                  </span>
                                  <span className="text-xs text-muted-foreground/50">
                                    played
                                  </span>
                                  <span className="text-sm font-medium text-primary/80 truncate max-w-35">
                                    {entry.sounds?.name || "Deleted sound"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
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
                                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                                    />
                                  </svg>
                                  <span className="truncate max-w-30">
                                    {channelMap[entry.channel_id] ||
                                      entry.channel_name ||
                                      entry.channel_id}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right shrink-0 space-y-0.5">
                                <p className="text-xs font-medium text-muted-foreground">
                                  {formatTime(entry.played_at)}
                                </p>
                                <p className="text-xs text-muted-foreground/50">
                                  {formatDate(entry.played_at)}
                                </p>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>

          {/* Appearance */}
          <motion.div variants={item}>
            <Card className="border-none shadow-lg">
              <CardHeader className="pb-6">
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
                        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                      />
                    </svg>
                  </div>
                  <div>
                    <CardTitle className={designTokens.typography.h2}>
                      Appearance
                    </CardTitle>
                    <CardDescription
                      className={`${designTokens.typography.smallMuted} mt-1`}
                    >
                      Choose how the dashboard looks
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p
                      className={designTokens.typography.body + " font-medium"}
                    >
                      Dark Mode
                    </p>
                    <p className={designTokens.typography.smallMuted}>
                      {mounted
                        ? resolvedTheme === "dark"
                          ? "Dark theme active"
                          : "Light theme active"
                        : "Loading theme…"}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const next = resolvedTheme === "dark" ? "light" : "dark";
                      setTheme(next);
                      if (discordId)
                        localStorage.setItem(`theme_${discordId}`, next);
                    }}
                    disabled={!mounted}
                    aria-label="Toggle dark mode"
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                      mounted && resolvedTheme === "dark"
                        ? "bg-primary"
                        : "bg-muted-foreground/25"
                    }`}
                  >
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-md transform transition-transform duration-300 ${
                        mounted && resolvedTheme === "dark"
                          ? "translate-x-6"
                          : "translate-x-1"
                      }`}
                    >
                      {mounted && resolvedTheme === "dark" ? (
                        <svg
                          className="h-3 w-3 text-primary"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M21.752 15.002A9.718 9.718 0 0118 15.75 9.75 9.75 0 018.25 6c0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 12c0 5.385 4.365 9.75 9.75 9.75 4.662 0 8.574-3.254 9.753-7.748-.001 0-.001-.001-.001-.001z" />
                        </svg>
                      ) : (
                        <svg
                          className="h-3 w-3 text-yellow-500"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
                        </svg>
                      )}
                    </span>
                  </button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Playlist Cache Migration - owner only */}
          {isOwner === true && (
            <motion.div variants={item}>
              <Card className="border-blue-500/20 shadow-lg">
                <CardHeader className="pb-6">
                  <div className="flex items-center gap-3">
                    <div
                      className={`${designTokens.iconContainer} ${designTokens.iconBackgrounds.blue}`}
                    >
                      <svg
                        className={`${designTokens.icons.md} text-blue-500`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                        />
                      </svg>
                    </div>
                    <div>
                      <CardTitle className={designTokens.typography.h2}>
                        Playlist Cache Migration
                      </CardTitle>
                      <CardDescription
                        className={`${designTokens.typography.smallMuted} mt-1`}
                      >
                        Owner only - One-time setup
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className={designTokens.typography.body}>
                      Downloads all existing playlist songs to Supabase cache.
                      Run this once after enabling the new caching system.
                    </p>
                    {migrationResult && (
                      <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-2">
                        <p className="text-sm font-medium">Migration Results:</p>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Total</p>
                            <p className="text-xl font-bold">
                              {migrationResult.total}
                            </p>
                          </div>
                          <div>
                            <p className="text-green-600">Successful</p>
                            <p className="text-xl font-bold text-green-600">
                              {migrationResult.successful}
                            </p>
                          </div>
                          <div>
                            <p className="text-destructive">Failed</p>
                            <p className="text-xl font-bold text-destructive">
                              {migrationResult.failed}
                            </p>
                          </div>
                        </div>
                        {migrationResult.errors && migrationResult.errors.length > 0 && (
                          <details className="mt-3">
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                              View errors ({migrationResult.errors.length})
                            </summary>
                            <div className="mt-2 max-h-40 overflow-y-auto">
                              {migrationResult.errors.slice(0, 10).map((err, i) => (
                                <p key={i} className="text-xs text-destructive font-mono mt-1">
                                  {err}
                                </p>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    )}
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button
                        onClick={handleMigrateCache}
                        disabled={migrateLoading}
                        className="w-full bg-blue-500 hover:bg-blue-600"
                      >
                        {migrateLoading ? (
                          <span className="flex items-center gap-2">
                            <svg
                              className="animate-spin h-4 w-4"
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
                                d="M4 12a8 8 0 018-8v8H4z"
                              />
                            </svg>
                            Migrating... (check console for progress)
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
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
                                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                              />
                            </svg>
                            Start Migration
                          </span>
                        )}
                      </Button>
                    </motion.div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Danger Zone — owner only */}
          {isOwner === true && (
            <motion.div variants={item}>
              <Card className="border-red-500/20 shadow-lg">
                <CardHeader className="pb-6">
                  <div className="flex items-center gap-3">
                    <div
                      className={`${designTokens.iconContainer} ${designTokens.iconBackgrounds.red}`}
                    >
                      <svg
                        className={`${designTokens.icons.md} ${designTokens.iconColors.red}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                    </div>
                    <div>
                      <CardTitle
                        className={`${designTokens.typography.h2} text-red-500`}
                      >
                        Danger Zone
                      </CardTitle>
                      <CardDescription
                        className={`${designTokens.typography.smallMuted} mt-1`}
                      >
                        Irreversible actions — proceed with caution
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between flex-wrap gap-4 p-4 rounded-xl border border-red-500/20 bg-red-500/5">
                    <div>
                      <p
                        className={
                          designTokens.typography.body + " font-medium"
                        }
                      >
                        Clear Library
                      </p>
                      <p className={designTokens.typography.smallMuted}>
                        Permanently delete all sounds and playback history from
                        the database and storage.
                      </p>
                    </div>
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button
                        variant="outline"
                        disabled={clearing}
                        onClick={() => setClearDialogOpen(true)}
                        className="text-red-500 border-red-500/40 hover:bg-red-500/10 hover:border-red-500/60 shrink-0"
                      >
                        {clearDone ? (
                          <span className="flex items-center gap-2">
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
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            Cleared!
                          </span>
                        ) : clearing ? (
                          <span className="flex items-center gap-2">
                            <svg
                              className="animate-spin h-4 w-4"
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
                                d="M4 12a8 8 0 018-8v8H4z"
                              />
                            </svg>
                            Clearing...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
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
                            Clear DB
                          </span>
                        )}
                      </Button>
                    </motion.div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* About */}
          <motion.div variants={item}>
            <Card
              className={`border-none shadow-lg bg-linear-to-br from-primary/5 to-primary/10`}
            >
              <CardHeader className="pb-6">
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
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <CardTitle className={designTokens.typography.h2}>
                    About
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <p className={designTokens.typography.h3}>
                    Saiyan Gods Dashboard v1.0
                  </p>
                  <p
                    className={
                      designTokens.typography.bodyMuted + " leading-relaxed"
                    }
                  >
                    Integrated with the Shantha Discord bot for seamless voice
                    channel playback. Upload, manage, and play audio files
                    directly from your web dashboard.
                  </p>
                </div>
                <div className="flex gap-3 pt-2">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button variant="outline" size="sm" className="h-10 px-4">
                      <svg
                        className="h-4 w-4 mr-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                        />
                      </svg>
                      Documentation
                    </Button>
                  </motion.div>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 px-4"
                      onClick={() =>
                        window.open("https://github.com/jubinjacob03", "_blank")
                      }
                    >
                      <svg
                        className="h-4 w-4 mr-2"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fillRule="evenodd"
                          d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                          clipRule="evenodd"
                        />
                      </svg>
                      GitHub
                    </Button>
                  </motion.div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </motion.div>

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

      <ConfirmDialog
        isOpen={clearDialogOpen}
        onClose={() => setClearDialogOpen(false)}
        title="Clear Entire Library?"
        description="This will permanently delete ALL sounds, storage files, and playback history. This action cannot be undone."
        confirmText="Yes, Clear Everything"
        onConfirm={handleClearLibrary}
        variant="danger"
      />
    </AppLayout>
  );
}
