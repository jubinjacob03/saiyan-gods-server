const GUILD_ID = process.env.NEXT_PUBLIC_DISCORD_GUILD_ID ?? "";

export interface Song {
  name: string;
  url: string;
  thumbnail: string;
  duration: number;
  formattedDuration: string;
  author: string;
}

export interface QueueEntry {
  index: number;
  name: string;
  url?: string;
  thumbnail: string;
  formattedDuration: string;
  author: string;
}

export interface MusicStatus {
  playing: boolean;
  paused: boolean;
  repeatMode: number;
  volume: number;
  elapsed: number;
  currentFilter?: string;
  song: Song | null;
  queue: QueueEntry[];
  queueLength: number;
}

export interface SearchResult {
  title: string;
  author: string;
  duration: number;
  url: string;
  thumbnail: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function cmd<T = { success?: boolean; error?: string }>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  return fetch(`/api/bot/music/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guildId: GUILD_ID, ...body }),
  }).then((r) => r.json());
}

// ── Play ─────────────────────────────────────────────────────────────────────

export function musicPlay(
  voiceChannelId: string,
  query: string,
  userId: string,
  username: string,
): Promise<{ success?: boolean; song?: Song; added?: number; error?: string }> {
  return fetch("/api/bot/music/play", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      guildId: GUILD_ID,
      voiceChannelId,
      query,
      userId,
      username,
    }),
  }).then((r) => r.json());
}

// ── Status (polled every 2 s) ─────────────────────────────────────────────────

export function musicStatus(): Promise<MusicStatus> {
  return fetch(`/api/bot/music/status?guildId=${GUILD_ID}`, {
    cache: "no-store",
  }).then((r) => r.json());
}

// ── Queue details ─────────────────────────────────────────────────────────────

export function musicQueue(): Promise<{
  queue: QueueEntry[];
  queueLength: number;
}> {
  return fetch(`/api/bot/music/queue?guildId=${GUILD_ID}`, {
    cache: "no-store",
  }).then((r) => r.json());
}

// ── Search ────────────────────────────────────────────────────────────────────

export function musicSearch(
  query: string,
  limit = 10,
): Promise<{ results: SearchResult[] }> {
  return cmd("search", { query, limit });
}

// ── Direct command endpoints (no action string, no switch overhead) ───────────

export const musicSkip = () => cmd("skip", {});
export const musicPause = () => cmd("pause", {});
export const musicResume = () => cmd("resume", {});
export const musicToggle = () => cmd("toggle", {});
export const musicStop = () => cmd("stop", {});
export const musicShuffle = () => cmd("shuffle", {});
export const musicSeek = (secs: number) => cmd("seek", { value: secs });
export const musicRemove = (index: number) => cmd("remove", { value: index });
export const musicFilter = (name: string) => cmd("filter", { value: name });

export function musicLoop(mode?: number) {
  return cmd("loop", mode !== undefined ? { value: mode } : {});
}

export function musicVolume(vol: number) {
  return cmd<{ success?: boolean; volume?: number; error?: string }>("volume", {
    value: Math.max(0, Math.min(100, vol)),
  });
}

// ── Legacy generic control (kept so nothing breaks during rollout) ────────────

export function musicControl(
  action: "toggle" | "skip" | "stop" | "shuffle" | "loop" | "volume" | "seek",
  value?: number,
): Promise<{ success?: boolean; error?: string }> {
  return fetch("/api/bot/music/control", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guildId: GUILD_ID, action, value }),
  }).then((r) => r.json());
}
