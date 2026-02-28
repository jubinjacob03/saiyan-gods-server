"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import { getSession } from "@/lib/auth";
import {
  musicPlay,
  musicControl,
  musicStatus,
  type MusicStatus,
} from "@/lib/music-api";
import { motion, AnimatePresence } from "framer-motion";
import type { Session } from "@supabase/supabase-js";

interface Video {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration: string;
  url: string;
}

const GUILD_ID = process.env.NEXT_PUBLIC_DISCORD_GUILD_ID!;

function ProgressBar({
  elapsed,
  duration,
}: {
  elapsed: number;
  duration: number;
}) {
  const pct = duration > 0 ? Math.min((elapsed / duration) * 100, 100) : 0;
  return (
    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
      <motion.div
        className="h-full bg-white/70 rounded-full"
        style={{ width: `${pct}%` }}
        transition={{ ease: "linear", duration: 1 }}
      />
    </div>
  );
}

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
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  const [selectedChannel, setSelectedChannel] = useState("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [videos, setVideos] = useState<Video[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [videoError, setVideoError]       = useState<string | null>(null);
  const [loadingPlay, setLoadingPlay]     = useState<string | null>(null);
  const [status, setStatus] = useState<MusicStatus | null>(null);
  const [volume, setVolume] = useState(50);
  const [showQueue, setShowQueue] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getSession().then(setSession);
  }, []);

  useEffect(() => {
    if (!GUILD_ID) return;
    fetch("/api/bot/channels")
      .then((r) => r.json())
      .then((d) => {
        const voiceChannels: { id: string; name: string }[] = d?.data ?? [];
        setChannels(voiceChannels);
        if (voiceChannels.length) setSelectedChannel(voiceChannels[0].id);
      })
      .catch(() => {});
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const s = await musicStatus();
      setStatus(s);
      if (s.volume !== undefined) setVolume(s.volume);
    } catch {}
  }, []);

  useEffect(() => {
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchStatus]);

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => setDebouncedQuery(query), 400);
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
        if (d.error) { setVideoError(d.error); setVideos([]); }
        else setVideos(d.videos ?? []);
      })
      .catch(() => { setVideoError("Failed to fetch results."); setVideos([]); })
      .finally(() => setLoadingVideos(false));
  }, [debouncedQuery]);

  const handlePlay = async (video: Video) => {
    if (!selectedChannel) return;
    setLoadingPlay(video.id);
    try {
      await musicPlay(
        selectedChannel,
        video.url,
        session?.user?.user_metadata?.provider_id ?? "web",
        session?.user?.user_metadata?.full_name ?? "Web Player",
      );
      setTimeout(fetchStatus, 1500);
    } catch {}
    setLoadingPlay(null);
  };

  const handleControl = async (
    action: "toggle" | "skip" | "stop" | "shuffle" | "loop" | "volume",
    value?: number,
  ) => {
    await musicControl(action, value);
    setTimeout(fetchStatus, 500);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setVolume(v);
    handleControl("volume", v);
  };

  const isPlaying = status?.playing && !status?.paused;
  const loopLabels = ["Off", "Song", "Queue"];

  return (
    <AppLayout>
    <div className="flex flex-col min-h-full pb-36">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Music</h1>
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            className="text-sm bg-muted border border-border/50 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {channels.length === 0 && <option value="">No channels</option>}
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
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
            placeholder="Search for songs…"
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
      <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-4">
        {debouncedQuery ? `Results for "${debouncedQuery}"` : "Trending Music"}
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
          <svg className="h-10 w-10 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
            const isQueued = status?.queue?.some((q) => q.name === video.title);
            return (
              <motion.button
                key={video.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handlePlay(video)}
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

      {/* Mini Player */}
      <AnimatePresence>
        {status?.song && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="fixed bottom-0 left-0 right-0 z-50 md:left-72"
          >
            <div className="mx-auto max-w-5xl m-3">
              <div className="rounded-2xl bg-zinc-900/95 backdrop-blur-xl border border-white/10 shadow-2xl p-3 flex flex-col gap-2">
                <ProgressBar
                  elapsed={status.elapsed ?? 0}
                  duration={status.song.duration}
                />

                <div className="flex items-center gap-3">
                  {/* Thumbnail */}
                  <div className="relative shrink-0 w-11 h-11 rounded-lg overflow-hidden">
                    <img
                      src={status.song.thumbnail}
                      alt={status.song.name}
                      className="w-full h-full object-cover"
                    />
                    {isPlaying && (
                      <div className="absolute inset-0 bg-black/30 flex items-end justify-center pb-1">
                        <div className="flex gap-0.5 items-end h-3">
                          {[0, 150, 75].map((d, i) => (
                            <motion.div
                              key={i}
                              className="w-0.5 bg-blue-400 rounded-full"
                              animate={{ height: ["2px", "10px", "2px"] }}
                              transition={{
                                repeat: Infinity,
                                duration: 0.8,
                                delay: d / 1000,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Song info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {status.song.name}
                    </p>
                    <p className="text-xs text-white/50 truncate">
                      {status.song.author}
                    </p>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleControl("shuffle")}
                      className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
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
                          d="M16 3h5m0 0v5m0-5l-6 6M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-1M15 4l6 6M5 21a2 2 0 01-2-2v-1c0-8.284 6.716-15 15-15h1"
                        />
                      </svg>
                    </button>

                    <button
                      onClick={() => handleControl("toggle")}
                      className="p-2 rounded-xl bg-white text-black hover:bg-white/80 transition-colors"
                    >
                      {isPlaying ? (
                        <svg
                          className="h-5 w-5"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                        </svg>
                      ) : (
                        <svg
                          className="h-5 w-5 ml-0.5"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </button>

                    <button
                      onClick={() => handleControl("skip")}
                      className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                      </svg>
                    </button>

                    <button
                      onClick={() => handleControl("loop")}
                      className={`p-2 rounded-lg transition-colors text-xs font-medium ${
                        status.repeatMode > 0
                          ? "text-blue-400 hover:bg-blue-400/10"
                          : "text-white/50 hover:text-white hover:bg-white/10"
                      }`}
                      title={`Loop: ${loopLabels[status.repeatMode]}`}
                    >
                      <svg
                        className="h-4 w-4"
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
                      className={`p-2 rounded-lg transition-colors text-xs ${
                        showQueue
                          ? "text-primary"
                          : "text-white/50 hover:text-white hover:bg-white/10"
                      }`}
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
                          d="M4 6h16M4 10h16M4 14h10"
                        />
                      </svg>
                    </button>

                    <button
                      onClick={() => handleControl("stop")}
                      className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M6 6h12v12H6z" />
                      </svg>
                    </button>

                    {/* Volume */}
                    <div className="hidden sm:flex items-center gap-2 ml-1 text-white/50">
                      <VolumeIcon vol={volume} />
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={volume}
                        onChange={handleVolumeChange}
                        className="w-20 accent-white h-1 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Queue drawer */}
                <AnimatePresence>
                  {showQueue && status.queueLength > 1 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-1 border-t border-white/10">
                        <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2 px-1">
                          Up next · {status.queueLength - 1} song
                          {status.queueLength !== 2 ? "s" : ""}
                        </p>
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                          {status.queue.map((entry) => (
                            <div key={entry.index} className="shrink-0 w-36">
                              <div className="aspect-video rounded-lg overflow-hidden bg-white/5">
                                <img
                                  src={entry.thumbnail}
                                  alt={entry.name}
                                  className="w-full h-full object-cover opacity-80"
                                />
                              </div>
                              <p className="text-[10px] text-white/60 mt-1 truncate">
                                {entry.name}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </AppLayout>  );
}