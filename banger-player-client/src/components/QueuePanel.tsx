import { Button, Chip, Surface } from "@cladd-ui/react";
import type { DiscordGuild, GuildQueue, QueueControlAction } from "../types";

type QueuePanelProps = {
  selectedGuild: DiscordGuild | undefined;
  channelId: string;
  guildId: string;
  queue: GuildQueue;
  loadError: string | null;
  controlBusy: boolean;
  controlError: string | null;
  onControl: (action: QueueControlAction) => void;
};

export function QueuePanel({
  selectedGuild,
  channelId,
  guildId,
  queue,
  loadError,
  controlBusy,
  controlError,
  onControl,
}: QueuePanelProps) {
  const songCount = queue.songs.length + (queue.current ? 1 : 0);
  const channelName = selectedGuild?.channels.find(
    (channel) => channel.id === channelId,
  )?.name;

  return (
    <Surface
      as="section"
      className="rounded-2xl p-5"
      variant="solid"
      outline
      aria-labelledby="song-queue-title"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 id="song-queue-title" className="text-xl font-semibold">
            Song queue
          </h2>
          <dl className="mt-2 grid gap-1 text-sm text-white/50">
            <div className="flex gap-2">
              <dt>Server:</dt>
              <dd>{selectedGuild?.name ?? "Select a server"}</dd>
            </div>
            <div className="flex gap-2">
              <dt>Channel:</dt>
              <dd>{channelName ?? "Select a voice channel"}</dd>
            </div>
          </dl>
        </div>
        <div className="text-right">
          <span className="text-sm text-white/50">
            {songCount} {songCount === 1 ? "song" : "songs"}
          </span>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button
              variant="solid"
              size="sm"
              type="button"
              disabled={controlBusy || !queue.current || !guildId}
              onClick={() => onControl("skip")}
            >
              Skip
            </Button>
            {queue.current?.state === "paused" ? (
              <Button
                variant="solid"
                size="sm"
                type="button"
                disabled={controlBusy || !guildId}
                onClick={() => onControl("resume")}
              >
                Resume
              </Button>
            ) : (
              <Button
                variant="solid"
                size="sm"
                type="button"
                disabled={
                  controlBusy || queue.current?.state !== "playing" || !guildId
                }
                onClick={() => onControl("pause")}
              >
                Pause
              </Button>
            )}
            <Button
              color="red"
              variant="solid"
              size="sm"
              type="button"
              disabled={
                controlBusy || (!queue.current && queue.songs.length === 0) || !guildId
              }
              onClick={() => onControl("clear")}
            >
              Clear queue
            </Button>
          </div>
        </div>
      </div>

      {controlError && (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {controlError}
        </p>
      )}
      {loadError ? (
        <p className="mt-4 text-sm text-red-300">
          Queue unavailable: {loadError}
        </p>
      ) : queue.songs.length === 0 && !queue.current ? (
        <p className="mt-4 rounded-lg bg-white/5 px-4 py-6 text-center text-white/55">
          {guildId
            ? "No songs in this server's queue yet."
            : "Select a server to see its queue."}
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {queue.current && (
            <Surface
              as="li"
              className="rounded-xl p-4"
              color="green"
              variant="solid"
              outline
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-white">
                  {queue.current.title}
                </span>
                <Chip color="green" size="xs" rounded>
                  {queue.current.state === "loading"
                    ? "Starting"
                    : queue.current.state === "paused"
                      ? "Paused"
                      : "Now playing"}
                </Chip>
              </div>
              <p className="mt-1 text-sm text-white/50">
                {queue.current.duration}
              </p>
              <p className="mt-1 text-xs text-white/45">
                Queued by{" "}
                {queue.current.requester?.username ?? "Unknown requester"}
              </p>
            </Surface>
          )}
          {queue.songs.map((song, index) => (
            <Surface
              as="li"
              key={`${song.title}-${index}`}
              className="flex items-center justify-between gap-4 rounded-xl p-3"
              variant="solid"
              outline
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-white">{song.title}</p>
                <p className="mt-1 text-sm text-white/50">{song.duration}</p>
                <p className="mt-1 text-xs text-white/45">
                  Queued by {song.requester?.username ?? "Unknown requester"}
                </p>
              </div>
              <span className="shrink-0 text-sm text-white/50">
                #{index + 1}
              </span>
            </Surface>
          ))}
        </ol>
      )}
    </Surface>
  );
}
