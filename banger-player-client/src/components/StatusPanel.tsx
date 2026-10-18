import { Button, Chip, Surface } from "@cladd-ui/react";
import type { BackendStatus } from "../types";

type StatusPanelProps = {
  status: BackendStatus | null;
  error: string | null;
  botControlBusy: boolean;
  botControlError: string | null;
  queueSize: number;
  onControlBot: (action: "start" | "stop") => void;
};

export function StatusPanel({
  status,
  error,
  botControlBusy,
  botControlError,
  queueSize,
  onControlBot,
}: StatusPanelProps) {
  const botIsActive =
    status?.discord.state === "ready" || status?.discord.state === "connecting";

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Surface className="rounded-2xl p-4" variant="solid" outline>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
            API
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-lg font-semibold capitalize">
              {error ? "Unavailable" : (status?.api ?? "Checking…")}
            </p>
            <Chip
              color={
                error ? "red" : status?.api === "ready" ? "green" : "yellow"
              }
              size="md"
              rounded
            >
              {error
                ? "Offline"
                : status?.api === "ready"
                  ? "Online"
                  : "Pending"}
            </Chip>
          </div>
        </Surface>
        <Surface className="rounded-2xl p-4" variant="solid" outline>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
            Discord bot
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="truncate text-lg font-semibold capitalize">
              {status?.discord.user ?? status?.discord.state ?? "Checking…"}
            </p>
            <Chip
              color={
                status?.discord.state === "ready"
                  ? "green"
                  : status?.discord.state === "error"
                    ? "red"
                    : "yellow"
              }
              size="md"
              rounded
            >
              {status?.discord.state === "ready"
                ? "Connected"
                : status?.discord.state === "connecting"
                  ? "Connecting"
                  : (status?.discord.state ?? "Checking")}
            </Chip>
          </div>
        </Surface>
        <Surface className="rounded-2xl p-4" variant="solid" outline>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
            Queue
          </p>
          <p className="mt-2 text-lg font-semibold">
            {queueSize} {queueSize === 1 ? "track" : "tracks"}
          </p>
        </Surface>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          className="w-full"
          color={botIsActive ? "red" : "green"}
          variant="gradient-fill"
          size="lg"
          type="button"
          disabled={
            botControlBusy || (!botIsActive && !status?.discord.enabled)
          }
          loading={botControlBusy}
          onClick={() => onControlBot(botIsActive ? "stop" : "start")}
        >
          {botControlBusy ? "Working…" : botIsActive ? "Stop bot" : "Start bot"}
        </Button>
        {(error || (status && !status.discord.enabled) || botControlError) && (
          <div className="space-y-4">
            {error && (
              <p role="alert" className="break-words text-sm text-red-300">
                {error}. Start the backend with{" "}
                <code className="rounded bg-white/10 px-1">npm run dev</code> in{" "}
                <code className="rounded bg-white/10 px-1">backend</code>.
              </p>
            )}
            {status && !status.discord.enabled && (
              <p className="break-words text-sm text-white/55">
                Add DISCORD_TOKEN to the backend environment to connect the bot.
              </p>
            )}
            {botControlError && (
              <p role="alert" className="break-words text-sm text-red-300">
                {botControlError}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
