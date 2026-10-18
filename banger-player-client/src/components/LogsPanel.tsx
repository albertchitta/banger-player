import { Surface } from "@cladd-ui/react";
import type { RefObject } from "react";
import type {
  CommandLogChannel,
  CommandLogMessage,
  BackendStatus,
} from "../types";

type LogsPanelProps = {
  logChannel: CommandLogChannel | null;
  logMessages: CommandLogMessage[];
  logLoading: boolean;
  logError: string | null;
  status: BackendStatus | null;
  logMessagesRef: RefObject<HTMLDivElement | null>;
};

export function LogsPanel({
  logChannel,
  logMessages,
  logLoading,
  logError,
  status,
  logMessagesRef,
}: LogsPanelProps) {
  return (
    <Surface
      as="section"
      className="h-full min-h-0 min-w-0 rounded-2xl p-3 sm:p-5"
      contentClassName="flex h-full min-h-0 flex-col"
      variant="solid"
      outline
      wrapContent
      aria-labelledby="command-history-title"
    >
      <div className="min-w-0 shrink-0">
        <h2 id="command-history-title" className="text-xl font-semibold">
          Logs
        </h2>
        <p className="mt-2 text-sm text-white/55">
          View recent messages from the configured command log channel.
        </p>
      </div>

      <div className="mt-4 flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-2 sm:mt-6">
        <h3 className="min-w-0 truncate font-semibold text-white">
          {logChannel?.name
            ? `#${logChannel.name}`
            : logChannel
              ? "Selected text channel"
              : "No command channel selected"}
        </h3>
        <span className="shrink-0 text-xs text-white/50 sm:text-sm">
          {logMessages.length} recent{" "}
          {logMessages.length === 1 ? "message" : "messages"}
        </span>
      </div>

      <div
        ref={logMessagesRef}
        className="mt-3 min-h-0 min-w-0 flex-1 overflow-y-auto pr-1 sm:mt-4"
      >
        {logError ? (
          <p role="alert" className="text-sm text-red-300">
            Could not load the selected Discord channel: {logError}
          </p>
        ) : !logChannel ? (
          <p className="rounded-lg bg-white/5 px-4 py-6 text-center text-white/55">
            Select a text channel to start logging commands and view its
            messages.
          </p>
        ) : status?.discord.state !== "ready" ? (
          <p className="rounded-lg bg-white/5 px-4 py-6 text-center text-white/55">
            Start the Discord bot to view this channel and write command logs.
          </p>
        ) : logLoading ? (
          <p className="rounded-lg bg-white/5 px-4 py-6 text-center text-white/55">
            Loading channel messages…
          </p>
        ) : logMessages.length === 0 ? (
          <p className="rounded-lg bg-white/5 px-4 py-6 text-center text-white/55">
            No messages in this channel yet.
          </p>
        ) : (
          <ol className="space-y-3">
            {logMessages.map((message) => (
              <Surface
                as="li"
                key={message.id}
                className="min-w-0 rounded-xl p-2.5 sm:p-3"
                variant="solid"
                outline
              >
                <div className="flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
                  <span className="max-w-full break-words font-semibold text-white">
                    {message.author}
                  </span>
                  <time
                    className="max-w-full break-words text-left text-xs text-white/40 sm:text-right"
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
      </div>
    </Surface>
  );
}
