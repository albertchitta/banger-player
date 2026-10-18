import { spawn } from "node:child_process";
import { PassThrough } from "node:stream";
import {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
} from "@discordjs/voice";
import { ChannelType, PermissionFlagsBits } from "discord.js";
import { search } from "play-dl";

function createYoutubeAudioStream(url) {
  const python = process.platform === "win32" ? "py" : "python3";
  const pythonArgs =
    process.platform === "win32" ? ["-3", "-m", "yt_dlp"] : ["-m", "yt_dlp"];
  const extractor = spawn(
    python,
    [
      ...pythonArgs,
      "--no-playlist",
      "--format",
      "bestaudio",
      "--output",
      "-",
      "--quiet",
      "--no-warnings",
      "--no-progress",
      "--",
      url,
    ],
    { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
  );
  const audio = new PassThrough();
  let errorOutput = "";
  let exited = false;

  extractor.stderr.setEncoding("utf8").on("data", (chunk) => {
    errorOutput = `${errorOutput}${chunk}`.slice(-8192);
  });
  extractor.once("error", (error) => {
    audio.destroy(new Error("Could not start yt-dlp", { cause: error }));
  });
  extractor.once("close", (code, signal) => {
    exited = true;
    if (code === 0) {
      audio.end();
    } else if (!audio.destroyed) {
      const details = errorOutput.trim();
      audio.destroy(
        new Error(
          details || `yt-dlp exited with code ${code ?? signal ?? "unknown"}`,
        ),
      );
    }
  });
  audio.once("close", () => {
    if (!exited) {
      extractor.kill();
    }
  });
  extractor.stdout.pipe(audio, { end: false });

  return audio;
}

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function createMusicPlayer(getClient, commandHistory) {
  const guildQueues = new Map();

  function getQueue(guildId) {
    let queue = guildQueues.get(guildId);

    if (!queue) {
      const player = createAudioPlayer({
        behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
      });
      queue = {
        player,
        connection: null,
        channelId: null,
        current: null,
        startingSong: null,
        songs: [],
        starting: false,
        paused: false,
      };
      guildQueues.set(guildId, queue);

      player.on(AudioPlayerStatus.Idle, () => {
        if (queue.current) {
          commandHistory.updateState(queue.current.historyId, "completed");
          queue.current = null;
        }
        void startNext(guildId, queue);
      });

      player.on("error", (error) => {
        console.error("Discord audio player failed:", error);
        if (queue.current) {
          commandHistory.updateState(queue.current.historyId, "failed");
          queue.current = null;
        }
        void startNext(guildId, queue);
      });
    }

    return queue;
  }

  async function startNext(guildId, queue) {
    if (queue.starting || queue.current) {
      return;
    }

    if (queue.songs.length === 0) {
      return;
    }

    queue.starting = true;
    try {
      while (!queue.current && queue.songs.length > 0) {
        const song = queue.songs.shift();
        queue.startingSong = song;
        try {
          const client = getClient();
          if (!client) {
            throw createHttpError("The Discord bot is not connected", 503);
          }

          const guild = client.guilds.cache.get(guildId);
          const channel = guild?.channels.cache.get(song.channelId);
          if (!guild || !channel || channel.type !== ChannelType.GuildVoice) {
            throw new Error("The selected Discord voice channel is unavailable");
          }

          if (!queue.connection || queue.channelId !== song.channelId) {
            queue.connection?.destroy();
            queue.connection = joinVoiceChannel({
              channelId: channel.id,
              guildId: guild.id,
              adapterCreator: guild.voiceAdapterCreator,
            });
            queue.channelId = channel.id;
            queue.connection.on("stateChange", (oldState, newState) => {
              console.info(
                `Voice connection ${guildId}/${channel.id}: ${oldState.status} -> ${newState.status}`,
              );
            });
            queue.connection.on("error", (error) => {
              console.error(
                `Voice connection failed for ${guildId}/${channel.id}:`,
                error,
              );
            });
            queue.connection.subscribe(queue.player);
          }

          await entersState(
            queue.connection,
            VoiceConnectionStatus.Ready,
            20_000,
          );
          if (queue.startingSong !== song) {
            continue;
          }

          const audioStream = createYoutubeAudioStream(song.url);
          if (queue.startingSong !== song) {
            audioStream.destroy();
            continue;
          }

          const resource = createAudioResource(audioStream, {
            inputType: StreamType.Arbitrary,
            metadata: { historyId: song.historyId },
          });

          queue.current = song;
          queue.startingSong = null;
          queue.paused = false;
          commandHistory.updateState(song.historyId, "playing");
          queue.player.play(resource);
        } catch (error) {
          if (queue.startingSong !== song && queue.current !== song) {
            continue;
          }

          queue.startingSong = null;
          if (queue.current === song) {
            queue.current = null;
          }
          commandHistory.updateState(song.historyId, "failed");
          console.error(`Could not play "${song.title}":`, error);
        }
      }

    } finally {
      queue.starting = false;
    }
  }

  function getQueueState(guildId) {
    const queue = guildQueues.get(guildId);
    const activeSong = queue?.current ?? queue?.startingSong ?? null;

    return {
      current: activeSong
        ? {
            title: activeSong.title,
            duration: activeSong.duration,
            state: queue.current
              ? queue.paused
                ? "paused"
                : "playing"
              : "loading",
          }
        : null,
      songs: (queue?.songs ?? []).map((song) => ({
        title: song.title,
        duration: song.duration,
      })),
    };
  }

  return {
    stop() {
      for (const queue of guildQueues.values()) {
        for (const song of [
          queue.current,
          queue.startingSong,
          ...queue.songs,
        ]) {
          if (song) {
            commandHistory.updateState(song.historyId, "cleared");
          }
        }

        queue.current = null;
        queue.startingSong = null;
        queue.songs = [];
        queue.paused = false;
        if (queue.player.state.status !== AudioPlayerStatus.Idle) {
          queue.player.stop(true);
        }
        queue.connection?.destroy();
        queue.connection = null;
        queue.channelId = null;
      }
    },
    getQueue(guildId) {
      return getQueueState(guildId);
    },
    control(guildId, action) {
      const client = getClient();
      if (!client?.isReady()) {
        throw createHttpError("The Discord bot is not connected yet", 503);
      }

      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        throw createHttpError("The selected Discord server is unavailable", 404);
      }

      const queue = getQueue(guildId);
      const historyEntry = commandHistory.recordWebCommand(
        `/${action}`,
        guild.name,
      );
      let logMessage;

      try {
        switch (action) {
          case "skip": {
            const activeSong = queue.current ?? queue.startingSong;
            if (!activeSong) {
              throw createHttpError("There is no current song to skip", 409);
            }

            logMessage = `🎵 **${activeSong.title}** skipped`;
            commandHistory.updateState(activeSong.historyId, "skipped");
            queue.current = null;
            queue.startingSong = null;
            queue.paused = false;
            if (queue.player.state.status !== AudioPlayerStatus.Idle) {
              queue.player.stop(true);
            }
            break;
          }
          case "clear": {
            logMessage = "Queue cleared";
            for (const song of [
              queue.current,
              queue.startingSong,
              ...queue.songs,
            ]) {
              if (song) {
                commandHistory.updateState(song.historyId, "cleared");
              }
            }

            queue.songs = [];
            queue.current = null;
            queue.startingSong = null;
            queue.paused = false;
            if (queue.player.state.status !== AudioPlayerStatus.Idle) {
              queue.player.stop(true);
            }
            break;
          }
          case "pause":
            if (!queue.current || queue.paused || !queue.player.pause()) {
              throw createHttpError("There is no playing song to pause", 409);
            }

            logMessage = `🎵 **${queue.current.title}** paused`;
            queue.paused = true;
            commandHistory.updateState(queue.current.historyId, "paused");
            break;
          case "resume":
            if (!queue.current || !queue.paused || !queue.player.unpause()) {
              throw createHttpError("There is no paused song to resume", 409);
            }

            logMessage = `🎵 **${queue.current.title}** resumed`;
            queue.paused = false;
            commandHistory.updateState(queue.current.historyId, "playing");
            break;
          default:
            throw createHttpError("Unknown queue action", 400);
        }

        commandHistory.updateState(historyEntry.id, "completed", logMessage);
        if (action === "skip") {
          void startNext(guildId, queue);
        }
        return getQueueState(guildId);
      } catch (error) {
        commandHistory.updateState(
          historyEntry.id,
          "failed",
          `Could not ${action}: ${error.message}`,
        );
        throw error;
      }
    },
    listGuilds() {
      const client = getClient();
      if (!client?.isReady()) {
        return [];
      }

      return client.guilds.cache.map((guild) => ({
        id: guild.id,
        name: guild.name,
        channels: guild.channels.cache
          .filter((channel) => channel.type === ChannelType.GuildVoice)
          .map((channel) => ({ id: channel.id, name: channel.name })),
        textChannels: guild.channels.cache
          .filter((channel) =>
            [
              ChannelType.GuildText,
              ChannelType.GuildAnnouncement,
            ].includes(channel.type),
          )
          .map((channel) => ({ id: channel.id, name: channel.name })),
      }));
    },
    async enqueue({ query, guildId, channelId }) {
      const client = getClient();
      if (!client?.isReady()) {
        throw createHttpError("The Discord bot is not connected yet", 503);
      }

      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        throw createHttpError("The selected Discord server is unavailable", 404);
      }

      const channel = guild.channels.cache.get(channelId);
      if (!channel || channel.type !== ChannelType.GuildVoice) {
        throw createHttpError(
          "Choose a voice channel in the selected server",
          400,
        );
      }

      const botMember = guild.members.me;
      const permissions = botMember && channel.permissionsFor(botMember);
      if (
        !permissions?.has(PermissionFlagsBits.Connect) ||
        !permissions.has(PermissionFlagsBits.Speak)
      ) {
        throw createHttpError(
          "The bot needs Connect and Speak permissions in that channel",
          403,
        );
      }

      const queue = getQueue(guildId);
      if (
        (queue.current || queue.songs.length > 0) &&
        queue.channelId !== channelId
      ) {
        throw createHttpError(
          "This server already has playback in another voice channel",
          409,
        );
      }

      const historyEntry = commandHistory.recordWebCommand(query, guild.name);

      try {
        const results = await search(query, {
          limit: 1,
          source: { youtube: "video" },
        });
        const result = results[0];
        if (!result?.url || !result.title) {
          throw createHttpError("No matching song was found", 404);
        }

        if (
          (queue.current || queue.songs.length > 0) &&
          queue.channelId !== channelId
        ) {
          throw createHttpError(
            "This server already has playback in another voice channel",
            409,
          );
        }

        const song = {
          title: result.title,
          url: result.url,
          duration: result.durationRaw,
          channelId,
          historyId: historyEntry.id,
        };

        queue.channelId = channelId;
        queue.songs.push(song);
        commandHistory.updateState(
          historyEntry.id,
          "queued",
          `🎵 **${result.title}** added to the queue`,
        );
        void startNext(guildId, queue);

        return {
          title: song.title,
          duration: song.duration,
          position:
            queue.songs.length + (queue.current || queue.starting ? 1 : 0),
        };
      } catch (error) {
        commandHistory.updateState(
          historyEntry.id,
          "failed",
          `Could not add "${query}" to the queue`,
        );
        if (error.statusCode) {
          throw error;
        }

        console.error(`Could not search for "${query}":`, error);
        throw createHttpError("Song search failed; try again later", 502);
      }
    },
  };
}
