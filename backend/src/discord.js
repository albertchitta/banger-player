import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

const commands = [
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show available bot commands"),
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check whether the bot is responding"),
];

export function createDiscordBot(commandHistory) {
  const token = process.env.DISCORD_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
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
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
    });

    discordClient.once(Events.ClientReady, async (readyClient) => {
      if (client !== readyClient) {
        return;
      }

      status.state = "ready";
      status.user = readyClient.user.tag;
      status.guilds = readyClient.guilds.cache.size;

      try {
        const registeredCommands = await readyClient.application.commands.fetch({
          guildId,
        });

        for (const command of commands) {
          const existingCommand = registeredCommands.find(
            (registered) => registered.name === command.name,
          );

          if (existingCommand) {
            await existingCommand.edit(command.toJSON());
          } else {
            await readyClient.application.commands.create(
              command.toJSON(),
              guildId,
            );
          }
        }
      } catch (error) {
        console.error("Failed to register Discord commands:", error);
      }
    });

    discordClient.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) {
        return;
      }

      commandHistory.record(interaction);
      const response =
        interaction.commandName === "ping"
          ? `Pong! WebSocket latency: ${discordClient.ws.ping}ms`
          : "Available commands: `/help` and `/ping`.";

      try {
        await interaction.reply(response);
        commandHistory.updateState(
          interaction.id,
          "completed",
          `/${interaction.commandName} command completed`,
        );
      } catch (error) {
        commandHistory.updateState(
          interaction.id,
          "failed",
          `/${interaction.commandName} command failed`,
        );
        console.error(`Failed to respond to /${interaction.commandName}:`, error);
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
        messages: [...messages.values()].reverse().map((message) => ({
          id: message.id,
          content: message.content,
          author: message.author.tag,
          timestamp: message.createdAt.toISOString(),
        })),
      };
    },
    async logCommand(entry) {
      if (!commandChannel) {
        return;
      }

      const activeClient = requireReadyClient();
      const channel = activeClient.channels.cache.get(commandChannel.channelId);
      if (!channel?.isTextBased() || !("send" in channel)) {
        throw new Error("The selected command log channel is unavailable");
      }

      await channel.send({
        content: entry.logMessage,
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
