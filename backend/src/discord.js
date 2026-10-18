import {
  Client,
  Events,
  GatewayIntentBits,
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
  let client = null;

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
        commandHistory.updateState(interaction.id, "completed");
      } catch (error) {
        commandHistory.updateState(interaction.id, "failed");
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
