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
    recordMessage(message, command) {
      const entry = {
        id: message.id,
        command,
        user: message.member?.displayName ?? message.author.username,
        guild: message.guild?.name ?? "Direct message",
        channelId: message.channelId,
        timestamp: new Date().toISOString(),
        state: "received",
      };

      entries.unshift(entry);
      return entry;
    },
    recordWebCommand(command, guild, user = "Web client") {
      const entry = {
        id: randomUUID(),
        command: command.startsWith("/") ? command : `/play ${command}`,
        user,
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
