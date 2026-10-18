import { useEffect, useState, type FormEvent } from "react";

type BackendStatus = {
  api: string;
  discord: {
    enabled: boolean;
    state: "connecting" | "disabled" | "error" | "ready" | "stopped";
    user: string | null;
    guilds: number;
  };
};

type CommandHistoryEntry = {
  id: string;
  command: string;
  user: string;
  guild: string;
  timestamp: string;
  state:
    | "received"
    | "queued"
    | "playing"
    | "paused"
    | "completed"
    | "skipped"
    | "cleared"
    | "failed";
};

type VoiceChannel = {
  id: string;
  name: string;
};

type DiscordGuild = {
  id: string;
  name: string;
  channels: VoiceChannel[];
};

type GuildQueue = {
  guildId?: string;
  current: {
    title: string;
    duration: string;
    state: "loading" | "playing" | "paused";
  } | null;
  songs: {
    title: string;
    duration: string;
  }[];
};

export default function App() {
  const [status, setStatus] = useState<BackendStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commands, setCommands] = useState<CommandHistoryEntry[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [guilds, setGuilds] = useState<DiscordGuild[]>([]);
  const [guildsLoading, setGuildsLoading] = useState(true);
  const [guildsError, setGuildsError] = useState<string | null>(null);
  const [guildId, setGuildId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [songQuery, setSongQuery] = useState("");
  const [queueing, setQueueing] = useState(false);
  const [queueMessage, setQueueMessage] = useState<string | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [queue, setQueue] = useState<GuildQueue>({ current: null, songs: [] });
  const [queueLoadError, setQueueLoadError] = useState<string | null>(null);
  const [queueRefreshKey, setQueueRefreshKey] = useState(0);
  const [queueControlBusy, setQueueControlBusy] = useState(false);
  const [queueControlError, setQueueControlError] = useState<string | null>(null);
  const [botControlBusy, setBotControlBusy] = useState(false);
  const [botControlError, setBotControlError] = useState<string | null>(null);
  const [guildRefreshKey, setGuildRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout>;

    async function loadStatus() {
      try {
        const response = await fetch("/api/status", {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Backend returned ${response.status}`);
        }

        const backendStatus = (await response.json()) as BackendStatus;
        setStatus(backendStatus);
        if (backendStatus.discord.state !== "ready") {
          setGuilds([]);
          setGuildsLoading(
            backendStatus.discord.state === "connecting",
          );
          if (backendStatus.discord.state !== "connecting") {
            setGuildId("");
            setChannelId("");
          }
        }
        setError(null);
      } catch (fetchError: unknown) {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }

        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Could not connect to the backend",
        );
      }

      timeout = setTimeout(() => void loadStatus(), 5000);
    }

    void loadStatus();

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (status?.discord.state !== "ready") {
      return;
    }

    const controller = new AbortController();

    fetch("/api/guilds", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Backend returned ${response.status}`);
        }

        return (await response.json()) as { guilds: DiscordGuild[] };
      })
      .then(({ guilds: availableGuilds }) => {
        setGuilds(
          availableGuilds.filter((guild) => guild.channels.length > 0),
        );
        setGuildsError(null);
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }

        setGuildsError(
          fetchError instanceof Error
            ? fetchError.message
            : "Could not load Discord servers",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setGuildsLoading(false);
        }
      });

    return () => controller.abort();
  }, [guildRefreshKey, status?.discord.state]);

  useEffect(() => {
    if (!guildId) {
      return;
    }

    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout>;

    async function loadQueue() {
      try {
        const response = await fetch(
          `/api/queue?guildId=${encodeURIComponent(guildId)}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error(`Backend returned ${response.status}`);
        }

        setQueue({
          ...(await response.json() as GuildQueue),
          guildId,
        });
        setQueueLoadError(null);
      } catch (fetchError: unknown) {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }

        setQueueLoadError(
          fetchError instanceof Error
            ? fetchError.message
            : "Could not load song queue",
        );
      }

      timeout = setTimeout(() => void loadQueue(), 5000);
    }

    void loadQueue();

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [guildId, queueRefreshKey]);

  function refreshGuilds() {
    setGuildsLoading(true);
    setGuildsError(null);
    setGuildRefreshKey((key) => key + 1);
  }

  useEffect(() => {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout>;

    async function loadHistory() {
      try {
        const response = await fetch("/api/commands", {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Backend returned ${response.status}`);
        }

        const history = (await response.json()) as {
          commands: CommandHistoryEntry[];
        };
        setCommands(history.commands);
        setHistoryError(null);
      } catch (fetchError: unknown) {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }

        setHistoryError(
          fetchError instanceof Error
            ? fetchError.message
            : "Could not load command history",
        );
      }

      timeout = setTimeout(() => void loadHistory(), 5000);
    }

    void loadHistory();

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, []);

  async function submitSong(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQueueing(true);
    setQueueMessage(null);
    setQueueError(null);

    try {
      const response = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: songQuery, guildId, channelId }),
      });
      const result = (await response.json()) as {
        error?: string;
        title?: string;
        duration?: string;
        position?: number;
      };
      if (!response.ok) {
        throw new Error(result.error ?? `Backend returned ${response.status}`);
      }

      setQueueMessage(
        `Added "${result.title}" (${result.duration}) to the queue at position ${result.position}.`,
      );
      setQueueRefreshKey((key) => key + 1);
      setSongQuery("");
    } catch (submitError: unknown) {
      setQueueError(
        submitError instanceof Error
          ? submitError.message
          : "Could not queue that song",
      );
    } finally {
      setQueueing(false);
    }
  }

  async function controlQueue(
    action: "skip" | "clear" | "pause" | "resume",
  ) {
    setQueueControlBusy(true);
    setQueueControlError(null);

    try {
      const response = await fetch("/api/queue/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, guildId }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? `Backend returned ${response.status}`);
      }

      setQueueRefreshKey((key) => key + 1);
    } catch (controlError: unknown) {
      setQueueControlError(
        controlError instanceof Error
          ? controlError.message
          : "Could not control the song queue",
      );
    } finally {
      setQueueControlBusy(false);
    }
  }

  async function controlBot(action: "start" | "stop") {
    setBotControlBusy(true);
    setBotControlError(null);

    try {
      const response = await fetch("/api/bot/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = (await response.json()) as {
        error?: string;
        discord?: BackendStatus["discord"];
      };
      if (!response.ok) {
        throw new Error(result.error ?? `Backend returned ${response.status}`);
      }

      const discordStatus = result.discord;
      if (discordStatus) {
        setStatus((current) =>
          current ? { ...current, discord: discordStatus } : current,
        );
      }
      if (action === "stop") {
        setGuilds([]);
        setGuildsLoading(false);
        setGuildId("");
        setChannelId("");
        setQueue({ current: null, songs: [] });
      } else {
        setGuildsLoading(true);
      }
      setQueueRefreshKey((key) => key + 1);
    } catch (controlError: unknown) {
      setBotControlError(
        controlError instanceof Error
          ? controlError.message
          : "Could not control the Discord bot",
      );
    } finally {
      setBotControlBusy(false);
    }
  }

  const selectedGuild = guilds.find((guild) => guild.id === guildId);
  const selectedQueue =
    queue.guildId === guildId ? queue : { current: null, songs: [] };

  return (
    <div className="grid min-h-screen place-items-center bg-cladd-bg p-6 text-white">
      <main className="w-full max-w-2xl rounded-2xl border border-white/10 bg-black/20 p-8 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/50">
          Banger Player
        </p>
        <h1 className="mt-3 text-3xl font-bold">Shared backend</h1>
        <p className="mt-2 text-white/65">
          Discord commands and the web API run together.
        </p>

        <section className="mt-8 space-y-4" aria-live="polite">
          <StatusRow
            label="API"
            value={error ? "Unavailable" : status?.api ?? "Checking…"}
          />
          <StatusRow
            label="Discord bot"
            value={
              error
                ? "Status unavailable"
                : status?.discord.user
                  ? `${status.discord.user} (${status.discord.guilds} servers)`
                  : status?.discord.state ?? "Checking…"
            }
          />
          {error && (
            <p role="alert" className="text-sm text-red-300">
              {error}. Start the backend with{" "}
              <code className="rounded bg-white/10 px-1">npm run dev</code> in{" "}
              <code className="rounded bg-white/10 px-1">backend</code>.
            </p>
          )}
          {status && !status.discord.enabled && (
            <p className="text-sm text-white/55">
              Add DISCORD_TOKEN to the backend environment to connect the bot.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              type="button"
              disabled={
                botControlBusy ||
                (status?.discord.state !== "ready" &&
                  status?.discord.state !== "connecting" &&
                  !status?.discord.enabled)
              }
              onClick={() =>
                void controlBot(
                  status?.discord.state === "ready" ||
                    status?.discord.state === "connecting"
                    ? "stop"
                    : "start",
                )
              }
            >
              {botControlBusy
                ? "Working…"
                : status?.discord.state === "ready" ||
                    status?.discord.state === "connecting"
                  ? "Stop bot"
                  : "Start bot"}
            </button>
          </div>
          {botControlError && (
            <p role="alert" className="text-sm text-red-300">
              {botControlError}
            </p>
          )}
        </section>

        <section className="mt-10" aria-labelledby="play-song-title">
          <h2 id="play-song-title" className="text-xl font-semibold">
            Play a song
          </h2>
          <p className="mt-2 text-sm text-white/55">
            Choose a server and voice channel, then search YouTube by song name
            to play or queue it there.
          </p>

          <form className="mt-4 space-y-4" onSubmit={submitSong}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-white/70">
                <span className="block">Discord server</span>
                <select
                  className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-3 text-white disabled:opacity-50"
                  value={guildId}
                  disabled={guildsLoading || guilds.length === 0}
                  onChange={(event) => {
                    setGuildId(event.target.value);
                    setChannelId("");
                    setQueue({ current: null, songs: [] });
                    setQueueLoadError(null);
                  }}
                  required
                >
                  <option value="">Select a server</option>
                  {guilds.map((guild) => (
                    <option key={guild.id} value={guild.id}>
                      {guild.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm text-white/70">
                <span className="block">Voice channel</span>
                <select
                  className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-3 text-white disabled:opacity-50"
                  value={channelId}
                  disabled={!selectedGuild}
                  onChange={(event) => setChannelId(event.target.value)}
                  required
                >
                  <option value="">Select a voice channel</option>
                  {selectedGuild?.channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block space-y-2 text-sm text-white/70">
              <span className="block">Song name</span>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35"
                  type="text"
                  maxLength={200}
                  placeholder="e.g. Daft Punk - One More Time"
                  value={songQuery}
                  onChange={(event) => setSongQuery(event.target.value)}
                  required
                />
                <button
                  className="rounded-lg bg-white px-5 py-3 font-semibold text-zinc-900 transition hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-50"
                  type="submit"
                  disabled={
                    queueing ||
                    !songQuery.trim() ||
                    !guildId ||
                    !channelId ||
                    guildsLoading
                  }
                >
                  {queueing ? "Searching…" : "Play / queue"}
                </button>
              </div>
            </label>
          </form>

          {guildsLoading && (
            <p className="mt-3 text-sm text-white/50">
              Loading Discord servers and voice channels…
            </p>
          )}
          {guildsError && (
            <p role="alert" className="mt-3 text-sm text-red-300">
              Could not load Discord servers: {guildsError}
            </p>
          )}
          {!guildsLoading && !guildsError && guilds.length === 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-white/55">
              <span>
                No servers available. Make sure the bot is online and has joined
                a server with a voice channel.
              </span>
              <button
                className="rounded-md border border-white/15 px-3 py-2 text-white hover:bg-white/10"
                type="button"
                onClick={refreshGuilds}
              >
                Refresh servers
              </button>
            </div>
          )}
          {queueMessage && (
            <p role="status" className="mt-3 text-sm text-emerald-300">
              {queueMessage}
            </p>
          )}
          {queueError && (
            <p role="alert" className="mt-3 text-sm text-red-300">
              {queueError}
            </p>
          )}
        </section>

        <section className="mt-10" aria-labelledby="song-queue-title">
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
                  <dd>
                    {selectedGuild?.channels.find(
                      (channel) => channel.id === channelId,
                    )?.name ?? "Select a voice channel"}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="text-right">
              <span className="text-sm text-white/50">
                {selectedQueue.songs.length + (selectedQueue.current ? 1 : 0)}{" "}
                {selectedQueue.songs.length + (selectedQueue.current ? 1 : 0) === 1
                  ? "song"
                  : "songs"}
              </span>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <button
                  className="rounded-md border border-white/15 px-3 py-2 text-sm text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  type="button"
                  disabled={queueControlBusy || !selectedQueue.current || !guildId}
                  onClick={() => void controlQueue("skip")}
                >
                  Skip
                </button>
                {selectedQueue.current?.state === "paused" ? (
                  <button
                    className="rounded-md border border-white/15 px-3 py-2 text-sm text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    type="button"
                    disabled={queueControlBusy || !guildId}
                    onClick={() => void controlQueue("resume")}
                  >
                    Resume
                  </button>
                ) : (
                  <button
                    className="rounded-md border border-white/15 px-3 py-2 text-sm text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    type="button"
                    disabled={
                      queueControlBusy ||
                      selectedQueue.current?.state !== "playing" || !guildId
                    }
                    onClick={() => void controlQueue("pause")}
                  >
                    Pause
                  </button>
                )}
                <button
                  className="rounded-md border border-red-300/30 px-3 py-2 text-sm text-red-200 transition hover:bg-red-300/10 disabled:cursor-not-allowed disabled:opacity-40"
                  type="button"
                  disabled={
                    queueControlBusy ||
                    (!selectedQueue.current && selectedQueue.songs.length === 0) ||
                    !guildId
                  }
                  onClick={() => void controlQueue("clear")}
                >
                  Clear queue
                </button>
              </div>
            </div>
          </div>

          {queueControlError && (
            <p role="alert" className="mt-3 text-sm text-red-300">
              {queueControlError}
            </p>
          )}
          {queueLoadError ? (
            <p className="mt-4 text-sm text-red-300">
              Queue unavailable: {queueLoadError}
            </p>
          ) : selectedQueue.songs.length === 0 && !selectedQueue.current ? (
            <p className="mt-4 rounded-lg bg-white/5 px-4 py-6 text-center text-white/55">
              {guildId
                ? "No songs in this server's queue yet."
                : "Select a server to see its queue."}
            </p>
          ) : (
            <ol className="mt-4 space-y-3">
              {selectedQueue.current && (
                <li className="rounded-lg border border-emerald-300/20 bg-emerald-300/5 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-white">
                      {selectedQueue.current.title}
                    </span>
                    <span className="text-sm text-emerald-300">
                      {selectedQueue.current.state === "loading"
                        ? "Starting"
                        : selectedQueue.current.state === "paused"
                          ? "Paused"
                          : "Now playing"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-white/50">
                    {selectedQueue.current.duration}
                  </p>
                </li>
              )}
              {selectedQueue.songs.map((song, index) => (
                <li
                  key={`${song.title}-${index}`}
                  className="flex items-center justify-between gap-4 rounded-lg bg-white/5 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">
                      {song.title}
                    </p>
                    <p className="mt-1 text-sm text-white/50">
                      {song.duration}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm text-white/50">
                    #{index + 1}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="mt-10" aria-labelledby="command-history-title">
          <div className="flex items-center justify-between">
            <h2 id="command-history-title" className="text-xl font-semibold">
              Command history
            </h2>
            <span className="text-sm text-white/50">
              {commands.length} {commands.length === 1 ? "command" : "commands"}
            </span>
          </div>

          {historyError ? (
            <p role="alert" className="mt-4 text-sm text-red-300">
              Could not load command history: {historyError}
            </p>
          ) : commands.length === 0 ? (
            <p className="mt-4 rounded-lg bg-white/5 px-4 py-6 text-center text-white/55">
              No commands received yet.
            </p>
          ) : (
            <ol className="mt-4 max-h-96 space-y-3 overflow-y-auto">
              {commands.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-lg bg-white/5 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <code className="break-all font-semibold text-white">
                      {entry.command}
                    </code>
                    <span
                      className={
                        entry.state === "failed"
                          ? "text-sm text-red-300"
                          : entry.state === "playing"
                            ? "text-sm text-sky-300"
                            : "text-sm text-emerald-300"
                      }
                    >
                      {entry.state}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-white/60">
                    {entry.user} · {entry.guild}
                  </p>
                  <time
                    className="mt-1 block text-xs text-white/40"
                    dateTime={entry.timestamp}
                  >
                    {new Date(entry.timestamp).toLocaleString()}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
      <span className="text-white/60">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
