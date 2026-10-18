import { randomUUID } from "node:crypto";

export function createCommandHistory() {
  const entries = [];

  return {
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
    recordWebCommand(query, guild) {
      const entry = {
        id: randomUUID(),
        command: `/play ${query}`,
        user: "Web client",
        guild,
        timestamp: new Date().toISOString(),
        state: "received",
      };

      entries.unshift(entry);
      return entry;
    },
    updateState(id, state) {
      const entry = entries.find((item) => item.id === id);

      if (entry) {
        entry.state = state;
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
