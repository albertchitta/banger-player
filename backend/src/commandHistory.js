import { randomUUID } from "node:crypto";

export function createCommandHistory() {
  const entries = [];
  let reporter = null;

  function report(entry, message) {
    if (!reporter) {
      return;
    }

    void Promise.resolve()
      .then(() => reporter({ ...entry, logMessage: message }))
      .catch((error) => {
        console.error(`Failed to write command "${entry.command}" to Discord:`, error);
      });
  }

  return {
    setReporter(commandReporter) {
      reporter = commandReporter;
    },
    record(interaction) {
      const options = formatOptions(interaction.options.data);
      const entry = {
        id: interaction.id,
        command: `/${interaction.commandName}${options ? ` ${options}` : ""}`,
        user: interaction.user.tag,
        guild: interaction.guild?.name ?? "Direct message",
        timestamp: new Date().toISOString(),
        state: "received",
      };

      entries.unshift(entry);
      return entry;
    },
    recordWebCommand(command, guild) {
      const entry = {
        id: randomUUID(),
        command: command.startsWith("/") ? command : `/play ${command}`,
        user: "Web client",
        guild,
        timestamp: new Date().toISOString(),
        state: "received",
      };

      entries.unshift(entry);
      return entry;
    },
    updateState(id, state, logMessage) {
      const entry = entries.find((item) => item.id === id);

      if (entry) {
        entry.state = state;
        if (logMessage) {
          report(entry, logMessage);
        }
      }
    },
    list() {
      return entries;
    },
  };
}

function formatOptions(options) {
  return options
    .flatMap(({ name, value, options: nestedOptions }) =>
      nestedOptions
        ? formatOptions(nestedOptions)
        : value === undefined
          ? []
          : [`${name}: ${value}`],
    )
    .join(" ");
}
