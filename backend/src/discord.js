import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
} from "discord.js";

const PREFIX = "!!";
const CONTROL_COMMANDS = new Set(["skip", "clear", "pause", "resume", "stop"]);

export function createDiscordBot(commandHistory, musicPlayer) {
  const token = process.env.DISCORD_TOKEN;
  const status = {
    enabled: Boolean(token),
    state: token ? "connecting" : "disabled",
    user: null,
    guilds: 0,
  };
  let commandChannel = null;
  let client = null;

  function requireReadyClient() {
    if (!client?.isReady()) {
      const error = new Error("The Discord bot is not connected yet");
      error.statusCode = 503;
      throw error;
    }

    return client;
  }

  function getCommandChannel() {
    if (!commandChannel) {
      return null;
    }

    const activeClient = client;
    if (!activeClient?.isReady()) {
      return {
        guildId: commandChannel.guildId,
        channelId: commandChannel.channelId,
        name: null,
      };
    }

    const guild = activeClient.guilds.cache.get(commandChannel.guildId);
    const channel = guild?.channels.cache.get(commandChannel.channelId);
    if (!channel) {
      const error = new Error("The selected command log channel is unavailable");
      error.statusCode = 404;
      throw error;
    }

    return {
      guildId: guild.id,
      channelId: channel.id,
      name: channel.name,
    };
  }

  function createClient() {
    const discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
      ],
    });

    discordClient.once(Events.ClientReady, async (readyClient) => {
      if (client !== readyClient) {
        return;
      }

      status.state = "ready";
      status.user = readyClient.user.tag;
      status.guilds = readyClient.guilds.cache.size;

      try {
        await readyClient.application.commands.set([]);
        for (const guild of readyClient.guilds.cache.values()) {
          try {
            await readyClient.application.commands.set([], guild.id);
          } catch (error) {
            console.error(
              `Failed to remove old slash commands from ${guild.id}:`,
              error,
            );
          }
        }
      } catch (error) {
        console.error("Failed to remove old global slash commands:", error);
      }
    });

    discordClient.on(Events.MessageCreate, async (message) => {
      if (message.author.bot || !message.content.startsWith(PREFIX)) {
        return;
      }

      const input = message.content.slice(PREFIX.length).trim();
      const [rawCommand, ...args] = input.split(/\s+/);
      const query = args.join(" ").trim();
      const commandName = rawCommand?.toLowerCase();
      const command = {
        p: "play",
        playing: "play",
        q: "queue",
        s: "skip",
        r: "resume",
        c: "clear",
        bin: "clear",
        l: "stop",
        d: "stop",
        disconnect: "stop",
      }[commandName] ?? commandName;
      const recordedCommand = `${PREFIX}${rawCommand ?? ""}${
        args.length ? ` ${args.join(" ")}` : ""
      }`;

      if (
        !["help", "ping", "play", "queue", ...CONTROL_COMMANDS].includes(command)
      ) {
        return;
      }

      const historyEntry = commandHistory.recordMessage(
        message,
        recordedCommand,
      );

      async function reply(content) {
        await message.reply({
          content,
          allowedMentions: { parse: [] },
        });
      }

      try {
        if (command === "help") {
          await reply(
            "Commands: `!!play <song>` (alias `!!p`), `!!queue` (`!!q`), `!!skip` (`!!s`), `!!pause`, `!!resume` (`!!r`), `!!clear` (`!!c`), and `!!stop` (`!!disconnect`).",
          );
          commandHistory.updateState(
            historyEntry.id,
            "completed",
            "!!help command completed",
          );
          return;
        }

        if (command === "ping") {
          await reply(`Pong! WebSocket latency: ${discordClient.ws.ping}ms`);
          commandHistory.updateState(
            historyEntry.id,
            "completed",
            "!!ping command completed",
          );
          return;
        }

        if (!message.guild) {
          const error = new Error("Music commands are only available in a server.");
          error.statusCode = 400;
          throw error;
        }

        if (command === "play") {
          if (!query || query.length > 200) {
            const error = new Error(
              "Use `!!play <song name>` with a song name up to 200 characters.",
            );
            error.statusCode = 400;
            throw error;
          }

          const channelId = message.guild.voiceStates.cache.get(
            message.author.id,
          )?.channelId;
          if (!channelId) {
            const error = new Error(
              "Join a voice channel first, then use `!!play` again.",
            );
            error.statusCode = 400;
            throw error;
          }

          const song = await musicPlayer.enqueue({
            query,
            guildId: message.guild.id,
            channelId,
            requester: {
              id: message.author.id,
              username:
                message.member?.displayName ??
                message.author.globalName ??
                message.author.username,
            },
            historyId: historyEntry.id,
          });
          await reply(
            `Added **${song.title}** to the queue at position ${song.position} by **${historyEntry.user}**.`,
          );
          return;
        }

        if (command === "queue") {
          const queue = musicPlayer.getQueue(message.guild.id);
          const lines = [];
          if (queue.current) {
            lines.push(
              `Now playing: **${queue.current.title}** (${queue.current.state})`,
            );
          }
          lines.push(
            ...queue.songs.slice(0, 15).map((song, index) =>
              `${index + 1}. **${song.title}**${
                song.requester?.username
                  ? ` — queued by ${song.requester.username}`
                  : ""
              }`,
            ),
          );
          await reply(
            lines.length > 0
              ? `**Song queue**\n${lines.join("\n")}`.slice(0, 1900)
              : "The queue is empty.",
          );
          commandHistory.updateState(
            historyEntry.id,
            "completed",
            "!!queue command completed",
          );
          return;
        }

        if (CONTROL_COMMANDS.has(command)) {
          musicPlayer.control(message.guild.id, command, {
            historyId: historyEntry.id,
          });
          const response = {
            skip: "Skipped the current song",
            clear: "Queue cleared",
            pause: "Song paused",
            resume: "Song resumed",
            stop: "Disconnected from voice",
          }[command];
          await reply(`${response} by **${historyEntry.user}**.`);
        }
      } catch (error) {
        commandHistory.updateState(
          historyEntry.id,
          "failed",
          `${recordedCommand} failed`,
        );
        console.error(`Failed to handle Discord command ${recordedCommand}:`, error);
        try {
          await reply(
            error?.statusCode && typeof error.message === "string"
              ? error.message
              : "The command could not be completed. Please try again.",
          );
        } catch (replyError) {
          console.error(
            `Could not send a response for ${recordedCommand}:`,
            replyError,
          );
        }
      }
    });

    return discordClient;
  }

  let lifecycle = Promise.resolve();

  function serialize(operation) {
    const result = lifecycle.then(operation, operation);
    lifecycle = result.catch(() => {});
    return result;
  }

  return {
    status,
    get client() {
      return client;
    },
    setCommandChannel({ guildId: targetGuildId, channelId }) {
      const activeClient = requireReadyClient();
      const guild = activeClient.guilds.cache.get(targetGuildId);
      const channel = guild?.channels.cache.get(channelId);
      if (
        !channel ||
        ![
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement,
        ].includes(channel.type)
      ) {
        const error = new Error("Choose a text channel in a server the bot joined");
        error.statusCode = 400;
        throw error;
      }

      const botMember = guild.members.me;
      const permissions = botMember && channel.permissionsFor(botMember);
      if (
        !permissions?.has(PermissionFlagsBits.ViewChannel) ||
        !permissions.has(PermissionFlagsBits.ReadMessageHistory) ||
        !permissions.has(PermissionFlagsBits.SendMessages)
      ) {
        const error = new Error(
          "The bot needs View Channel, Read Message History, and Send Messages permissions in that channel",
        );
        error.statusCode = 403;
        throw error;
      }

      commandChannel = { guildId: guild.id, channelId: channel.id };
      return getCommandChannel();
    },
    async getCommandLog() {
      const channelInfo = getCommandChannel();
      if (!channelInfo || !client?.isReady()) {
        return { channel: channelInfo, messages: [] };
      }

      const channel = client.channels.cache.get(channelInfo.channelId);
      if (!channel?.isTextBased() || !("messages" in channel)) {
        const error = new Error("The selected command log channel is unavailable");
        error.statusCode = 404;
        throw error;
      }

      const messages = await channel.messages.fetch({ limit: 50 });
      return {
        channel: channelInfo,
        messages: [...messages.values()].reverse().map((message) => {
          const attribution =
            message.author.id === client.user.id
              ? / by \*\*([^*\r\n]+)\*\*\.?$/.exec(message.content)
              : null;

          return {
            id: message.id,
            content: attribution
              ? message.content.slice(0, -attribution[0].length)
              : message.content,
            author: attribution?.[1] ?? message.author.tag,
            timestamp: message.createdAt.toISOString(),
          };
        }),
      };
    },
    async logCommand(entry) {
      if (!commandChannel || entry.channelId === commandChannel.channelId) {
        return;
      }

      const activeClient = requireReadyClient();
      const channel = activeClient.channels.cache.get(commandChannel.channelId);
      if (!channel?.isTextBased() || !("send" in channel)) {
        throw new Error("The selected command log channel is unavailable");
      }

      const logMessage = entry.logMessage.replace(/[\r\n]+/g, " ").trim();
      const username = entry.user.replace(/[\r\n]+/g, " ").trim();
      await channel.send({
        content: `${logMessage} by **${username}**`,
        allowedMentions: { parse: [] },
      });
    },
    start() {
      return serialize(async () => {
        if (!token) {
          const error = new Error(
            "Set DISCORD_TOKEN in the backend environment before starting the bot",
          );
          error.statusCode = 503;
          throw error;
        }

        if (client?.isReady() || (client && status.state === "connecting")) {
          return status;
        }

        status.state = "connecting";
        client = createClient();
        const startingClient = client;

        try {
          await startingClient.login(token);
          return status;
        } catch (error) {
          status.state = "error";
          status.user = null;
          status.guilds = 0;
          client = null;
          await startingClient.destroy();
          throw error;
        }
      });
    },
    stop() {
      return serialize(async () => {
        const stoppingClient = client;
        client = null;
        status.state = token ? "stopped" : "disabled";
        status.user = null;
        status.guilds = 0;
        await stoppingClient?.destroy();
        return status;
      });
    },
  };
}
