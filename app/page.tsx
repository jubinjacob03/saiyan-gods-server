"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getBotStatus } from "@/lib/bot-api";
import { createClient } from "@/lib/supabase";
import { motion } from "framer-motion";
import { designTokens } from "@/lib/design-tokens";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

function formatUptime(seconds: number): string {
  if (seconds <= 0) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

interface Stats {
  // Bot
  botStatus: "online" | "offline";
  ping: number;
  guilds: number;
  voiceConnections: number;
  uptime: number;
  totalUsers: number;
  totalChannels: number;
  // Community
  activePrivateVCs: number;
  membersInPrivateVCs: number;
  // Library
  totalSounds: number;
  totalPlays: number;
  totalCategories: number;
  mostPlayedSound: string | null;
  mostPlayedCount: number;
}

export default function Home() {
  const CACHE_KEY = "dashboard_stats_v1";

  const defaultStats: Stats = {
    botStatus: "offline",
    ping: 0,
    guilds: 0,
    voiceConnections: 0,
    uptime: 0,
    totalUsers: 0,
    totalChannels: 0,
    activePrivateVCs: 0,
    membersInPrivateVCs: 0,
    totalSounds: 0,
    totalPlays: 0,
    totalCategories: 0,
    mostPlayedSound: null,
    mostPlayedCount: 0,
  };

  // Paint cached stats instantly on mount — zero loading flicker on revisit
  const getCachedStats = (): Stats => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) return { ...defaultStats, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    return defaultStats;
  };

  const [stats, setStats] = useState<Stats>(defaultStats);
  // loading = true only when there's no data yet (cold first visit)
  const [loading, setLoading] = useState(true);
  // refreshing = true during background re-fetches (spinner only, cards stay visible)
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  // track whether we've ever loaded data so loadStats needn't depend on [loading]
  const hasDataRef = useRef(false);

  // Rehydrate from cache before first render
  useEffect(() => {
    const cached = getCachedStats();
    const hasCached = localStorage.getItem(CACHE_KEY) !== null;
    if (hasCached) {
      setStats(cached);
      setLoading(false);
      hasDataRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStats = useCallback(async () => {
    // If we already have data, refresh silently without blanking the cards
    if (hasDataRef.current) setRefreshing(true);
    else setLoading(true);
    try {
      const supabase = createClient();

      // ── Supabase queries in parallel
      const [soundsRes, playsRes, categoriesRes, topSoundRes] =
        await Promise.all([
          supabase.from("sounds").select("*", { count: "exact", head: true }),
          supabase.from("sounds").select("play_count"),
          supabase
            .from("sound_categories")
            .select("*", { count: "exact", head: true }),
          supabase
            .from("sounds")
            .select("name, play_count")
            .order("play_count", { ascending: false })
            .limit(1)
            .single(),
        ]);

      const totalSounds = soundsRes.count ?? 0;
      const totalPlays = (playsRes.data ?? []).reduce(
        (s, r) => s + (r.play_count || 0),
        0,
      );
      const totalCategories = categoriesRes.count ?? 0;
      const mostPlayedSound = topSoundRes.data?.name ?? null;
      const mostPlayedCount = topSoundRes.data?.play_count ?? 0;

      // ── Bot status + private VC in parallel
      try {
        const [botStatus, privateVcRes] = await Promise.all([
          getBotStatus(),
          fetch("/api/bot/private-vc")
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
        ]);
        const d = botStatus.data ?? {};
        const vcs: { memberCount: number }[] = privateVcRes?.data?.vcs ?? [];
        const activePrivateVCs: number = privateVcRes?.data?.count ?? 0;
        const membersInPrivateVCs: number = vcs.reduce(
          (sum, vc) => sum + (vc.memberCount ?? 0),
          0,
        );
        setStats({
          botStatus: "online",
          ping: d.ping ?? 0,
          guilds: d.guilds ?? 0,
          voiceConnections: d.voiceConnections ?? 0,
          uptime: d.uptime ?? 0,
          totalUsers: d.totalUsers ?? 0,
          totalChannels: d.totalChannels ?? 0,
          activePrivateVCs,
          membersInPrivateVCs,
          totalSounds,
          totalPlays,
          totalCategories,
          mostPlayedSound,
          mostPlayedCount,
        });
      } catch {
        setStats((prev) => ({
          ...prev,
          botStatus: "offline",
          totalSounds,
          totalPlays,
          totalCategories,
          mostPlayedSound,
          mostPlayedCount,
        }));
      }
      setLastUpdated(new Date());
      hasDataRef.current = true;
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Persist fresh stats to localStorage after each successful fetch
  useEffect(() => {
    if (!loading && !refreshing && hasDataRef.current) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(stats));
      } catch {
        /* ignore */
      }
    }
  }, [stats, loading, refreshing]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const dash = loading ? "—" : undefined;

  return (
    <AppLayout>
      <div className={designTokens.spacing.pageSection}>
        {/* ── Header ── */}
        <motion.div
          className="flex items-end justify-between gap-4 flex-wrap"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div>
            <h1 className={`${designTokens.typography.h1} mb-2`}>Dashboard</h1>
            <p className={designTokens.typography.bodyMuted}>
              Server overview — bot health, community &amp; sound library stats
            </p>
          </div>
          <button
            onClick={loadStats}
            disabled={loading || refreshing}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted/50 disabled:opacity-40"
          >
            <motion.svg
              animate={loading || refreshing ? { rotate: 360 } : { rotate: 0 }}
              transition={
                loading || refreshing
                  ? { repeat: Infinity, duration: 1, ease: "linear" }
                  : {}
              }
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
            {lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : "Refresh"}
          </button>
        </motion.div>

        {/* ── Section label: Bot ── */}
        <motion.p
          className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          Bot &amp; Server
        </motion.p>

        {/* ── Row 1: Bot stats (4 cards) ── */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className={`stat-cards grid grid-cols-2 ${designTokens.spacing.cardGap} md:grid-cols-2 lg:grid-cols-4`}
        >
          {/* Bot Status */
          <motion.div variants={item}>
            <Card className={`${designTokens.cards.default} h-full`}>
              <CardHeader className={designTokens.components.cardPadding}>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`${designTokens.iconContainer} ${stats.botStatus === "online" ? designTokens.iconBackgrounds.green : designTokens.iconBackgrounds.red}`}
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${stats.botStatus === "online" ? "bg-green-500 animate-pulse" : "bg-red-500"} inline-block`}
                    />
                  </div>
                  <CardTitle
                    className={`${designTokens.typography.h3} text-muted-foreground`}
                  >
                    Bot Status
                  </CardTitle>
                </div>
                <div className={`${designTokens.typography.h2} capitalize`}>
                  {dash ?? stats.botStatus}
                </div>
                <p className={`${designTokens.typography.small} mt-1`}>
                  {stats.botStatus === "online" && !loading
                    ? `${stats.ping} ms latency`
                    : "connection state"}
                </p>
              </CardHeader>
            </Card>
          </motion.div>

          {/* Servers */}
          <motion.div variants={item}>
            <Card className={`${designTokens.cards.default} h-full`}>
              <CardHeader className={designTokens.components.cardPadding}>
                <div className="flex items-center gap-3 mb-4">
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
                        d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                      />
                    </svg>
                  </div>
                  <CardTitle
                    className={`${designTokens.typography.h3} text-muted-foreground`}
                  >
                    Servers
                  </CardTitle>
                </div>
                <div className={designTokens.typography.h2}>
                  {dash ?? stats.guilds}
                </div>
                <p className={`${designTokens.typography.small} mt-1`}>
                  connected
                </p>
              </CardHeader>
            </Card>
          </motion.div>

          {/* Active Voice */}
          <motion.div variants={item}>
            <Card className={`${designTokens.cards.default} h-full`}>
              <CardHeader className={designTokens.components.cardPadding}>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`${designTokens.iconContainer} ${designTokens.iconBackgrounds.orange}`}
                  >
                    <svg
                      className={`${designTokens.icons.md} ${designTokens.iconColors.orange}`}
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
                  </div>
                  <CardTitle
                    className={`${designTokens.typography.h3} text-muted-foreground`}
                  >
                    Active Voice
                  </CardTitle>
                </div>
                <div className={designTokens.typography.h2}>
                  {dash ?? stats.voiceConnections}
                </div>
                <p className={`${designTokens.typography.small} mt-1`}>
                  connections
                </p>
              </CardHeader>
            </Card>
          </motion.div>

          {/* Uptime */}
          <motion.div variants={item}>
            <Card className={`${designTokens.cards.default} h-full`}>
              <CardHeader className={designTokens.components.cardPadding}>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`${designTokens.iconContainer} ${designTokens.iconBackgrounds.blue}`}
                  >
                    <svg
                      className={`${designTokens.icons.md} ${designTokens.iconColors.blue}`}
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
                  </div>
                  <CardTitle
                    className={`${designTokens.typography.h3} text-muted-foreground`}
                  >
                    Uptime
                  </CardTitle>
                </div>
                <div className={designTokens.typography.h2}>
                  {loading ? "—" : formatUptime(stats.uptime)}
                </div>
                <p className={`${designTokens.typography.small} mt-1`}>
                  {!loading && stats.totalUsers > 0
                    ? `${stats.totalUsers.toLocaleString()} members in server`
                    : "bot runtime"}
                </p>
              </CardHeader>
            </Card>
          </motion.div>
        </motion.div>

        {/* ── Section label: Community ── */}
        <motion.p
          className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.28 }}
        >
          Community
        </motion.p>

        {/* ── Row 2: Community stats (4 cards) ── */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className={`stat-cards grid grid-cols-2 ${designTokens.spacing.cardGap} md:grid-cols-2 lg:grid-cols-4`}
        >
          {/* Members cached */
          <motion.div variants={item}>
            <Card className={`${designTokens.cards.default} h-full`}>
              <CardHeader className={designTokens.components.cardPadding}>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`${designTokens.iconContainer} ${designTokens.iconBackgrounds.blue}`}
                  >
                    <svg
                      className={`${designTokens.icons.md} ${designTokens.iconColors.blue}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </div>
                  <CardTitle
                    className={`${designTokens.typography.h3} text-muted-foreground`}
                  >
                    Members
                  </CardTitle>
                </div>
                <div className={designTokens.typography.h2}>
                  {dash ?? stats.totalUsers.toLocaleString()}
                </div>
                <p className={`${designTokens.typography.small} mt-1`}>
                  in this server
                </p>
              </CardHeader>
            </Card>
          </motion.div>

          {/* Total Channels */}
          <motion.div variants={item}>
            <Card className={`${designTokens.cards.default} h-full`}>
              <CardHeader className={designTokens.components.cardPadding}>
                <div className="flex items-center gap-3 mb-4">
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
                        d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
                      />
                    </svg>
                  </div>
                  <CardTitle
                    className={`${designTokens.typography.h3} text-muted-foreground`}
                  >
                    Channels
                  </CardTitle>
                </div>
                <div className={designTokens.typography.h2}>
                  {dash ?? stats.totalChannels}
                </div>
                <p className={`${designTokens.typography.small} mt-1`}>
                  total channels
                </p>
              </CardHeader>
            </Card>
          </motion.div>

          {/* Active Private VCs */}
          <motion.div variants={item}>
            <Card className={`${designTokens.cards.default} h-full`}>
              <CardHeader className={designTokens.components.cardPadding}>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`${designTokens.iconContainer} ${designTokens.iconBackgrounds.green}`}
                  >
                    <svg
                      className={`${designTokens.icons.md} ${designTokens.iconColors.green}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </div>
                  <CardTitle
                    className={`${designTokens.typography.h3} text-muted-foreground`}
                  >
                    Private VCs
                  </CardTitle>
                </div>
                <div className={designTokens.typography.h2}>
                  {dash ?? stats.activePrivateVCs}
                </div>
                <p className={`${designTokens.typography.small} mt-1`}>
                  active right now
                </p>
              </CardHeader>
            </Card>
          </motion.div>

          {/* Members in Private VCs */}
          <motion.div variants={item}>
            <Card className={`${designTokens.cards.default} h-full`}>
              <CardHeader className={designTokens.components.cardPadding}>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`${designTokens.iconContainer} ${designTokens.iconBackgrounds.orange}`}
                  >
                    <svg
                      className={`${designTokens.icons.md} ${designTokens.iconColors.orange}`}
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
                  </div>
                  <CardTitle
                    className={`${designTokens.typography.h3} text-muted-foreground`}
                  >
                    In Private VCs
                  </CardTitle>
                </div>
                <div className={designTokens.typography.h2}>
                  {dash ?? stats.membersInPrivateVCs}
                </div>
                <p className={`${designTokens.typography.small} mt-1`}>
                  members connected
                </p>
              </CardHeader>
            </Card>
          </motion.div>
        </motion.div>

        {/* ── Section label: Library ── */}
        <motion.p
          className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
        >
          Sound Library
        </motion.p>
        {/* ── Row 2: Library stats (4 cards) ── */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className={`stat-cards grid grid-cols-2 ${designTokens.spacing.cardGap} md:grid-cols-2 lg:grid-cols-4`}
        >
          {/* Total Sounds */
          <motion.div variants={item}>
            <Card className={`${designTokens.cards.default} h-full`}>
              <CardHeader className={designTokens.components.cardPadding}>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`${designTokens.iconContainer} ${designTokens.iconBackgrounds.blue}`}
                  >
                    <svg
                      className={`${designTokens.icons.md} ${designTokens.iconColors.blue}`}
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
                  <CardTitle
                    className={`${designTokens.typography.h3} text-muted-foreground`}
                  >
                    Total Sounds
                  </CardTitle>
                </div>
                <div className={designTokens.typography.h2}>
                  {dash ?? stats.totalSounds}
                </div>
                <p className={`${designTokens.typography.small} mt-1`}>
                  in your library
                </p>
              </CardHeader>
            </Card>
          </motion.div>

          {/* Total Plays */}
          <motion.div variants={item}>
            <Card className={`${designTokens.cards.default} h-full`}>
              <CardHeader className={designTokens.components.cardPadding}>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`${designTokens.iconContainer} ${designTokens.iconBackgrounds.green}`}
                  >
                    <svg
                      className={`${designTokens.icons.md} ${designTokens.iconColors.green}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <CardTitle
                    className={`${designTokens.typography.h3} text-muted-foreground`}
                  >
                    Total Plays
                  </CardTitle>
                </div>
                <div className={designTokens.typography.h2}>
                  {dash ?? stats.totalPlays.toLocaleString()}
                </div>
                <p className={`${designTokens.typography.small} mt-1`}>
                  sound plays all time
                </p>
              </CardHeader>
            </Card>
          </motion.div>

          {/* Categories */}
          <motion.div variants={item}>
            <Card className={`${designTokens.cards.default} h-full`}>
              <CardHeader className={designTokens.components.cardPadding}>
                <div className="flex items-center gap-3 mb-4">
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
                  <CardTitle
                    className={`${designTokens.typography.h3} text-muted-foreground`}
                  >
                    Categories
                  </CardTitle>
                </div>
                <div className={designTokens.typography.h2}>
                  {dash ?? stats.totalCategories}
                </div>
                <p className={`${designTokens.typography.small} mt-1`}>
                  sound categories
                </p>
              </CardHeader>
            </Card>
          </motion.div>

          {/* Most Played */}
          <motion.div variants={item}>
            <Card className={`${designTokens.cards.default} h-full`}>
              <CardHeader className={designTokens.components.cardPadding}>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`${designTokens.iconContainer} ${designTokens.iconBackgrounds.orange}`}
                  >
                    <svg
                      className={`${designTokens.icons.md} ${designTokens.iconColors.orange}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                      />
                    </svg>
                  </div>
                  <CardTitle
                    className={`${designTokens.typography.h3} text-muted-foreground`}
                  >
                    Most Played
                  </CardTitle>
                </div>
                <div
                  className="text-xl font-bold truncate"
                  title={stats.mostPlayedSound ?? undefined}
                >
                  {loading
                    ? "—"
                    : stats.mostPlayedSound
                      ? stats.mostPlayedSound
                      : "—"}
                </div>
                <p className={`${designTokens.typography.small} mt-1`}>
                  {!loading && stats.mostPlayedCount > 0
                    ? `${stats.mostPlayedCount} plays`
                    : "top sound"}
                </p>
              </CardHeader>
            </Card>
          </motion.div>
        </motion.div>

        {/* ── Section label: Quick Actions ── */}
        <motion.p
          className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Quick Actions
        </motion.p>

        {/* ── Row 3: Quick action cards (3) ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className={`grid md:grid-cols-3 ${designTokens.spacing.cardGap}`}
        >
          <motion.div
            whileHover={{ y: -4 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <Card
              className={`cursor-pointer ${designTokens.cards.default} h-full`}
              onClick={() => (window.location.href = "/sounds")}
            >
              <CardHeader className="pb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className={`${designTokens.iconContainer} ${designTokens.iconBackgrounds.blue}`}
                  >
                    <svg
                      className={`${designTokens.icons.md} ${designTokens.iconColors.blue}`}
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
                  <CardTitle className={designTokens.typography.h3}>
                    Sound Library
                  </CardTitle>
                </div>
                <CardDescription className={designTokens.typography.small}>
                  Browse, play and manage your audio collection
                </CardDescription>
              </CardHeader>
            </Card>
          </motion.div>

          <motion.div
            whileHover={{ y: -4 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <Card
              className={`cursor-pointer ${designTokens.cards.default} h-full`}
              onClick={() => (window.location.href = "/private-vc")}
            >
              <CardHeader className="pb-6">
                <div className="flex items-center gap-3 mb-2">
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
                        d="M15.536 8.464a5 5 0 010 7.072M12 6a7.071 7.071 0 000 12M8.464 8.464a5 5 0 000 7.072"
                      />
                    </svg>
                  </div>
                  <CardTitle className={designTokens.typography.h3}>
                    Private Voice
                  </CardTitle>
                </div>
                <CardDescription className={designTokens.typography.small}>
                  Manage private voice channels for your server
                </CardDescription>
              </CardHeader>
            </Card>
          </motion.div>

          <motion.div
            whileHover={{ y: -4 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <Card
              className={`cursor-pointer ${designTokens.cards.default} h-full`}
              onClick={() => (window.location.href = "/settings")}
            >
              <CardHeader className="pb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className={`${designTokens.iconContainer} ${designTokens.iconBackgrounds.orange}`}
                  >
                    <svg
                      className={`${designTokens.icons.md} ${designTokens.iconColors.orange}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </div>
                  <CardTitle className={designTokens.typography.h3}>
                    Settings
                  </CardTitle>
                </div>
                <CardDescription className={designTokens.typography.small}>
                  Configure bot preferences and server options
                </CardDescription>
              </CardHeader>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
