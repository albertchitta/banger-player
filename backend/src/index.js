import "dotenv/config";
import cors from "cors";
import express from "express";
import { createCommandHistory } from "./commandHistory.js";
import { createDiscordBot } from "./discord.js";
import { createMusicPlayer } from "./musicPlayer.js";

const port = Number(process.env.PORT ?? 3001);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const app = express();
const commandHistory = createCommandHistory();
const discordBot = createDiscordBot(commandHistory);
commandHistory.setReporter((entry) => discordBot.logCommand(entry));
const musicPlayer = createMusicPlayer(() => discordBot.client, commandHistory);
const allowedOrigins = (process.env.CLIENT_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", uptime: process.uptime() });
});

app.get("/api/status", (_request, response) => {
  response.json({
    api: "ready",
    discord: discordBot.status,
  });
});

app.post("/api/bot/control", async (request, response) => {
  const { action } = request.body ?? {};
  if (action !== "start" && action !== "stop") {
    response.status(400).json({ error: "Provide a supported bot action" });
    return;
  }

  if (action === "stop") {
    musicPlayer.stop();
  }
  await discordBot[action]();
  response.json({ discord: discordBot.status });
});

app.get("/api/commands", (_request, response) => {
  response.json({ commands: commandHistory.list() });
});

app.get("/api/guilds", (_request, response) => {
  response.json({ guilds: musicPlayer.listGuilds() });
});

app.get("/api/command-log", async (_request, response) => {
  response.json(await discordBot.getCommandLog());
});

app.post("/api/command-log/channel", (request, response) => {
  const { guildId, channelId } = request.body ?? {};
  if (
    typeof guildId !== "string" ||
    guildId.length === 0 ||
    typeof channelId !== "string" ||
    channelId.length === 0
  ) {
    response.status(400).json({ error: "Provide a server ID and text channel ID" });
    return;
  }

  response.json({
    channel: discordBot.setCommandChannel({ guildId, channelId }),
  });
});

app.get("/api/queue", (request, response) => {
  const { guildId } = request.query;
  if (typeof guildId !== "string" || guildId.length === 0) {
    response.status(400).json({ error: "Provide a Discord server ID" });
    return;
  }

  response.json(musicPlayer.getQueue(guildId));
});

app.post("/api/queue/control", (request, response) => {
  const { action, guildId } = request.body ?? {};
  if (
    !["skip", "clear", "pause", "resume"].includes(action) ||
    typeof guildId !== "string" ||
    guildId.length === 0
  ) {
    response.status(400).json({
      error: "Provide a server ID and a supported queue action",
    });
    return;
  }

  response.json(musicPlayer.control(guildId, action));
});

app.post("/api/queue", async (request, response) => {
  const { query, guildId, channelId } = request.body ?? {};
  if (
    typeof query !== "string" ||
    query.trim().length === 0 ||
    query.length > 200 ||
    typeof guildId !== "string" ||
    typeof channelId !== "string"
  ) {
    response.status(400).json({
      error: "Provide a song name (up to 200 characters), server, and voice channel",
    });
    return;
  }

  const song = await musicPlayer.enqueue({
    query: query.trim(),
    guildId,
    channelId,
  });
  response.status(202).json(song);
});

app.use((error, _request, response, _next) => {
  const statusCode = Number.isInteger(error.statusCode)
    ? error.statusCode
    : 500;
  if (statusCode === 500) {
    console.error("API request failed:", error);
  }

  response.status(statusCode).json({
    error: statusCode === 500 ? "An unexpected server error occurred" : error.message,
  });
});

const server = app.listen(port, () => {
  console.info(`Banger Player API listening on http://localhost:${port}`);
});

void discordBot.start().catch((error) => {
  console.error("Failed to connect the Discord bot:", error);
});

let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.info(`${signal} received; shutting down`);
  musicPlayer.stop();
  await discordBot.stop();
  server.close((error) => {
    if (error) {
      console.error("Failed to close the API server cleanly:", error);
      process.exitCode = 1;
    }
  });
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
