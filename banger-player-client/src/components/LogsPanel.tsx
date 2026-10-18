import { Button, Select, Surface } from "@cladd-ui/react";
import type { RefObject } from "react";
import type {
  CommandLogChannel,
  CommandLogMessage,
  DiscordGuild,
  BackendStatus,
} from "../types";

type LogsPanelProps = {
  guilds: DiscordGuild[];
  selectedGuild: DiscordGuild | undefined;
  guildsLoading: boolean;
  logGuildId: string;
  logChannelId: string;
  logChannel: CommandLogChannel | null;
  logMessages: CommandLogMessage[];
  logLoading: boolean;
  logError: string | null;
  logSaving: boolean;
  logSaveError: string | null;
  status: BackendStatus | null;
  logMessagesRef: RefObject<HTMLOListElement | null>;
  onGuildChange: (guildId: string) => void;
  onChannelChange: (channelId: string) => void;
  onSelectChannel: () => void;
};

export function LogsPanel({
  guilds,
  selectedGuild,
  guildsLoading,
  logGuildId,
  logChannelId,
  logChannel,
  logMessages,
  logLoading,
  logError,
  logSaving,
  logSaveError,
  status,
  logMessagesRef,
  onGuildChange,
  onChannelChange,
  onSelectChannel,
}: LogsPanelProps) {
  return (
    <Surface
      as="section"
      className="rounded-2xl p-5"
      variant="solid"
      outline
      aria-labelledby="command-history-title"
    >
      <div>
        <h2 id="command-history-title" className="text-xl font-semibold">
          Logs
        </h2>
        <p className="mt-2 text-sm text-white/55">
          Choose a Discord text channel to log bot commands and view recent
          messages.
        </p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-2 text-sm text-white/70">
          <span className="block">Discord server</span>
          <Select
            className="w-full"
            aria-label="Discord server"
            options={guilds}
            value={logGuildId}
            placeholder="Select a server"
            getOptionValue={(guild) => guild.id}
            renderOption={({ value }) => value.name}
            keyboardHints={false}
            disabled={guildsLoading || guilds.length === 0}
            onChange={onGuildChange}
          />
        </div>

        <div className="space-y-2 text-sm text-white/70">
          <span className="block">Text channel</span>
          <Select
            className="w-full"
            aria-label="Text channel"
            options={selectedGuild?.textChannels ?? []}
            value={logChannelId}
            placeholder="Select a text channel"
            getOptionValue={(channel) => channel.id}
            renderOption={({ value }) => `#${value.name}`}
            keyboardHints={false}
            disabled={!selectedGuild}
            onChange={onChannelChange}
          />
        </div>

        <Button
          color="brand"
          variant="gradient-fill"
          size="lg"
          type="button"
          disabled={
            logSaving ||
            !logGuildId ||
            !logChannelId ||
            status?.discord.state !== "ready"
          }
          loading={logSaving}
          onClick={onSelectChannel}
        >
          {logSaving ? "Saving…" : "Use channel"}
        </Button>
      </div>

      <p className="mt-2 text-xs text-white/45">
        The bot needs View Channel, Read Message History, and Send Messages
        permissions. The selected channel is kept until the backend restarts.
      </p>
      {logSaveError && (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {logSaveError}
        </p>
      )}

      <div className="mt-6 flex items-center justify-between">
        <h3 className="font-semibold text-white">
          {logChannel?.name
            ? `#${logChannel.name}`
            : logChannel
              ? "Selected text channel"
              : "No command channel selected"}
        </h3>
        <span className="text-sm text-white/50">
          {logMessages.length} recent{" "}
          {logMessages.length === 1 ? "message" : "messages"}
        </span>
      </div>

      {logError ? (
        <p role="alert" className="mt-4 text-sm text-red-300">
          Could not load the selected Discord channel: {logError}
        </p>
      ) : !logChannel ? (
        <p className="mt-4 rounded-lg bg-white/5 px-4 py-6 text-center text-white/55">
          Select a text channel to start logging commands and view its messages.
        </p>
      ) : status?.discord.state !== "ready" ? (
        <p className="mt-4 rounded-lg bg-white/5 px-4 py-6 text-center text-white/55">
          Start the Discord bot to view this channel and write command logs.
        </p>
      ) : logLoading ? (
        <p className="mt-4 rounded-lg bg-white/5 px-4 py-6 text-center text-white/55">
          Loading channel messages…
        </p>
      ) : logMessages.length === 0 ? (
        <p className="mt-4 rounded-lg bg-white/5 px-4 py-6 text-center text-white/55">
          No messages in this channel yet.
        </p>
      ) : (
        <ol
          ref={logMessagesRef}
          className="mt-4 max-h-96 space-y-3 overflow-y-auto"
        >
          {logMessages.map((message) => (
            <Surface
              as="li"
              key={message.id}
              className="rounded-xl p-3"
              variant="solid"
              outline
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-white">
                  {message.author}
                </span>
                <time
                  className="text-xs text-white/40"
                  dateTime={message.timestamp}
                >
                  {new Date(message.timestamp).toLocaleString()}
                </time>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-white/70">
                {message.content || "(Message has no text content)"}
              </p>
            </Surface>
          ))}
        </ol>
      )}
    </Surface>
  );
}
