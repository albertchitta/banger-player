import { useEffect, useRef, useState, type FormEvent } from "react";

type BackendStatus = {
  api: string;
  discord: {
    enabled: boolean;
    state: "connecting" | "disabled" | "error" | "ready" | "stopped";
    user: string | null;
    guilds: number;
  };
};

type DiscordUser = {
  id: string;
  username: string;
};

type CommandLogChannel = {
  guildId: string;
  channelId: string;
  name: string | null;
};

type CommandLogMessage = {
  id: string;
  content: string;
  author: string;
  timestamp: string;
};

type VoiceChannel = {
  id: string;
  name: string;
};

type DiscordGuild = {
  id: string;
  name: string;
  channels: VoiceChannel[];
  textChannels: VoiceChannel[];
};

type GuildQueue = {
  guildId?: string;
  current: {
    title: string;
    duration: string;
    requester?: DiscordUser;
    state: "loading" | "playing" | "paused";
  } | null;
  songs: {
    title: string;
    duration: string;
    requester?: DiscordUser;
  }[];
};

export default function App() {
  const [controlsPage, setControlsPage] = useState(
    () => window.location.pathname === "/controls",
  );
  const [status, setStatus] = useState<BackendStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [discordUser, setDiscordUser] = useState<DiscordUser | null>(null);
  const [discordAuthEnabled, setDiscordAuthEnabled] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
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
  const [logGuildId, setLogGuildId] = useState("");
  const [logChannelId, setLogChannelId] = useState("");
  const [logChannel, setLogChannel] = useState<CommandLogChannel | null>(null);
  const [logMessages, setLogMessages] = useState<CommandLogMessage[]>([]);
  const [logLoading, setLogLoading] = useState(true);
  const [logError, setLogError] = useState<string | null>(null);
  const [logSaving, setLogSaving] = useState(false);
  const [logSaveError, setLogSaveError] = useState<string | null>(null);
  const [logRefreshKey, setLogRefreshKey] = useState(0);
  const logMessagesRef = useRef<HTMLOListElement>(null);
  const [guildRefreshKey, setGuildRefreshKey] = useState(0);

  useEffect(() => {
    function handlePopState() {
      const requestedControls = window.location.pathname === "/controls";
      if (requestedControls && !authLoading && !discordUser) {
        window.history.replaceState(null, "", "/");
        setControlsPage(false);
        return;
      }

      setControlsPage(requestedControls);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [authLoading, discordUser]);

  useEffect(() => {
    const messageList = logMessagesRef.current;
    if (messageList) {
      messageList.scrollTop = messageList.scrollHeight;
    }
  }, [logMessages]);

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
    const controller = new AbortController();

    fetch("/api/auth/me", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Backend returned ${response.status}`);
        }

        return (await response.json()) as {
          enabled: boolean;
          user: DiscordUser | null;
        };
      })
      .then(({ enabled, user }) => {
        setDiscordAuthEnabled(enabled);
        setDiscordUser(user);
        const path = user ? "/controls" : "/";
        window.history.replaceState(null, "", path);
        setControlsPage(Boolean(user));
        setAuthError(null);
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }

        setAuthError(
          fetchError instanceof Error
            ? fetchError.message
            : "Could not check Discord sign-in",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setAuthLoading(false);
        }
      });

    return () => controller.abort();
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
          availableGuilds.filter(
            (guild) =>
              guild.channels.length > 0 || guild.textChannels.length > 0,
          ),
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

    async function loadCommandLog() {
      try {
        const response = await fetch("/api/command-log", {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Backend returned ${response.status}`);
        }

        const result = (await response.json()) as {
          channel: CommandLogChannel | null;
          messages: CommandLogMessage[];
        };
        setLogChannel(result.channel);
        setLogMessages(result.messages);
        const configuredChannel = result.channel;
        if (configuredChannel) {
          setLogGuildId((current) => current || configuredChannel.guildId);
          setLogChannelId((current) => current || configuredChannel.channelId);
        }
        setLogError(null);
      } catch (fetchError: unknown) {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }

        setLogError(
          fetchError instanceof Error
            ? fetchError.message
            : "Could not load the selected Discord channel",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLogLoading(false);
        }
      }

      timeout = setTimeout(() => void loadCommandLog(), 5000);
    }

    void loadCommandLog();

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [logRefreshKey]);

  async function selectCommandLogChannel() {
    setLogSaving(true);
    setLogSaveError(null);

    try {
      const response = await fetch("/api/command-log/channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId: logGuildId, channelId: logChannelId }),
      });
      const result = (await response.json()) as {
        error?: string;
        channel?: CommandLogChannel;
      };
      if (!response.ok) {
        throw new Error(result.error ?? `Backend returned ${response.status}`);
      }

      setLogChannel(result.channel ?? null);
      setLogMessages([]);
      setLogLoading(true);
      setLogRefreshKey((key) => key + 1);
    } catch (saveError: unknown) {
      setLogSaveError(
        saveError instanceof Error
          ? saveError.message
          : "Could not select the command log channel",
      );
    } finally {
      setLogSaving(false);
    }
  }

  async function signOut() {
    setSigningOut(true);
    setAuthError(null);

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}`);
      }

      setDiscordUser(null);
      window.history.replaceState(null, "", "/");
      setControlsPage(false);
    } catch (signOutError: unknown) {
      setAuthError(
        signOutError instanceof Error
          ? signOutError.message
          : "Could not sign out of Discord",
      );
    } finally {
      setSigningOut(false);
    }
  }

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
  const selectedLogGuild = guilds.find((guild) => guild.id === logGuildId);
  const selectedQueue =
    queue.guildId === guildId ? queue : { current: null, songs: [] };

  if (!controlsPage || authLoading || !discordUser) {
    return (
      <div className="grid min-h-screen place-items-center bg-cladd-bg p-6 text-white">
        <main className="w-full max-w-md rounded-2xl border border-white/10 bg-black/20 p-8 text-center shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/50">
            Banger Player
          </p>
          <h1 className="mt-4 text-3xl font-bold">Sign in to continue</h1>
          <p className="mt-3 text-white/65">
            Sign in with Discord to open the music controls and queue songs
            under your verified name.
          </p>
          {authError && (
            <p role="alert" className="mt-4 text-sm text-red-300">
              {authError}
            </p>
          )}
          {!authLoading && !discordAuthEnabled && (
            <p role="status" className="mt-4 text-sm text-amber-200">
              Discord sign-in is not configured. Set the Discord OAuth
              credentials and session secret in the backend environment, then
              restart the backend.
            </p>
          )}
          <button
            className="mt-6 w-full rounded-lg bg-indigo-500 px-5 py-3 font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
            type="button"
            disabled={authLoading || !discordAuthEnabled}
            onClick={() => window.location.assign("/api/auth/discord")}
          >
            {authLoading
              ? "Checking sign-in…"
              : discordAuthEnabled
                ? "Sign in with Discord"
                : "Discord sign-in unavailable"}
          </button>
        </main>
      </div>
    );
  }

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
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white/5 px-4 py-3">
          <p className="text-sm text-white/65">
            Signed in as{" "}
            <span className="font-semibold text-white">
              {discordUser.username}
            </span>
          </p>
          <button
            className="rounded-md border border-white/15 px-3 py-2 text-sm text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            type="button"
            disabled={signingOut}
            onClick={() => void signOut()}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>

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
                    !discordUser ||
                    authLoading ||
                    !songQuery.trim() ||
                    !guildId ||
                    !channelId ||
                    guildsLoading
                  }
                >
                  {queueing
                    ? "Searching…"
                    : discordUser
                      ? "Play / queue"
                      : "Sign in to queue"}
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
                  <p className="mt-1 text-xs text-white/45">
                    Queued by{" "}
                    {selectedQueue.current.requester?.username ??
                      "Unknown requester"}
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
                    <p className="mt-1 text-xs text-white/45">
                      Queued by {song.requester?.username ?? "Unknown requester"}
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
            <label className="space-y-2 text-sm text-white/70">
              <span className="block">Discord server</span>
              <select
                className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-3 text-white disabled:opacity-50"
                value={logGuildId}
                disabled={guildsLoading || guilds.length === 0}
                onChange={(event) => {
                  setLogGuildId(event.target.value);
                  setLogChannelId("");
                }}
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
              <span className="block">Text channel</span>
              <select
                className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-3 text-white disabled:opacity-50"
                value={logChannelId}
                disabled={!selectedLogGuild}
                onChange={(event) => setLogChannelId(event.target.value)}
              >
                <option value="">Select a text channel</option>
                {selectedLogGuild?.textChannels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    #{channel.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              className="rounded-lg bg-white px-4 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-40"
              type="button"
              disabled={
                logSaving ||
                !logGuildId ||
                !logChannelId ||
                status?.discord.state !== "ready"
              }
              onClick={() => void selectCommandLogChannel()}
            >
              {logSaving ? "Saving…" : "Use channel"}
            </button>
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
              Select a text channel to start logging commands and view its
              messages.
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
                <li key={message.id} className="rounded-lg bg-white/5 px-4 py-3">
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
