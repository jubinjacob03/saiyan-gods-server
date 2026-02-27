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
  song: Song | null;
  queue: QueueEntry[];
  queueLength: number;
}

export async function musicPlay(
  voiceChannelId: string,
  query: string,
  userId: string,
  username: string,
): Promise<{ success?: boolean; song?: Song; error?: string }> {
  const res = await fetch("/api/bot/music/play", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guildId: GUILD_ID, voiceChannelId, query, userId, username }),
  });
  return res.json();
}

export async function musicControl(
  action: "toggle" | "skip" | "stop" | "shuffle" | "loop" | "volume",
  value?: number,
): Promise<{ success?: boolean; error?: string }> {
  const res = await fetch("/api/bot/music/control", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guildId: GUILD_ID, action, value }),
  });
  return res.json();
}

export async function musicStatus(): Promise<MusicStatus> {
  const res = await fetch(
    `/api/bot/music/status?guildId=${GUILD_ID}`,
    { cache: "no-store" },
  );
  return res.json();
}
