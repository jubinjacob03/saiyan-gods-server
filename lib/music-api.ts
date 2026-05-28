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
  botIndex = 0,
): Promise<T> {
  return fetch(`/api/bot/music/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guildId: GUILD_ID, botIndex, ...body }),
  }).then((r) => r.json());
}

export function musicPlay(
  voiceChannelId: string,
  query: string,
  userId: string,
  username: string,
  fromPlaylist?: boolean,
  botIndex = 0,
  fallbackQuery?: string,
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
      fromPlaylist,
      botIndex,
      fallbackQuery,
    }),
  }).then((r) => r.json());
}

export function musicStatus(botIndex = 0): Promise<MusicStatus> {
  return fetch(`/api/bot/music/status?guildId=${GUILD_ID}&botIndex=${botIndex}`, {
    cache: "no-store",
  }).then((r) => r.json());
}

export function musicQueue(botIndex = 0): Promise<{
  queue: QueueEntry[];
  queueLength: number;
}> {
  return fetch(`/api/bot/music/queue?guildId=${GUILD_ID}&botIndex=${botIndex}`, {
    cache: "no-store",
  }).then((r) => r.json());
}

export function musicSearch(
  query: string,
  limit = 10,
  botIndex = 0,
): Promise<{ results: SearchResult[] }> {
  return cmd("search", { query, limit }, botIndex);
}

export const musicSkip = (botIndex = 0) => cmd("skip", {}, botIndex);
export const musicPause = (botIndex = 0) => cmd("pause", {}, botIndex);
export const musicResume = (botIndex = 0) => cmd("resume", {}, botIndex);
export const musicToggle = (botIndex = 0) => cmd("toggle", {}, botIndex);
export const musicStop = (botIndex = 0) => cmd("stop", {}, botIndex);
export const musicShuffle = (botIndex = 0) => cmd("shuffle", {}, botIndex);
export const musicRemove = (index: number, botIndex = 0) => cmd("remove", { value: index }, botIndex);

export function musicLoop(mode?: number, botIndex = 0) {
  return cmd("loop", mode !== undefined ? { value: mode } : {}, botIndex);
}

export function musicVolume(vol: number, botIndex = 0) {
  return cmd<{ success?: boolean; volume?: number; error?: string }>("volume", {
    value: Math.max(0, Math.min(100, vol)),
  }, botIndex);
}

export function musicControl(
  action: "toggle" | "skip" | "stop" | "shuffle" | "loop" | "volume",
  value?: number,
  botIndex = 0,
): Promise<{ success?: boolean; error?: string }> {
  return fetch("/api/bot/music/control", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guildId: GUILD_ID, action, value, botIndex }),
  }).then((r) => r.json());
}
