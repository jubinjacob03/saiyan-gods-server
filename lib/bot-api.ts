import axios from "axios";

// Calls go through Next.js API routes (server-side) so BOT_API_KEY stays secret
const botApi = axios.create({
  baseURL: "/api/bot",
});

export async function playSound(
  soundId: string,
  guildId: string,
  channelId: string,
  userId: string,
  username: string,
  soundUrl: string,
  soundName: string,
) {
  const response = await botApi.post("/play", {
    soundId,
    guildId,
    channelId,
    userId,
    username,
    soundUrl,
    soundName,
  });
  return response.data;
}

export async function getBotStatus() {
  const response = await botApi.get("/status");
  return response.data;
}

export default botApi;
