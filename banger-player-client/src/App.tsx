import { useEffect, useRef, useState, type FormEvent } from "react";
import { DashboardHeader } from "./components/DashboardHeader";
import { LogsPanel } from "./components/LogsPanel";
import { QueuePanel } from "./components/QueuePanel";
import { SignInPage } from "./components/SignInPage";
import { SongForm } from "./components/SongForm";
import { StatusPanel } from "./components/StatusPanel";
import type {
  BackendStatus,
  CommandLogChannel,
  CommandLogMessage,
  DiscordGuild,
  DiscordUser,
  GuildQueue,
  QueueControlAction,
} from "./types";

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

  async function controlQueue(action: QueueControlAction) {
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
      <SignInPage
        authLoading={authLoading}
        authError={authError}
        discordAuthEnabled={discordAuthEnabled}
      />
    );
  }

  return (
    <div className="min-h-screen bg-cladd-bg px-4 pb-6 pt-24 text-white sm:px-6 lg:px-8">
      <main className="mx-auto w-full max-w-7xl space-y-6">
        <DashboardHeader
          user={discordUser}
          signingOut={signingOut}
          onSignOut={() => void signOut()}
        />
        <StatusPanel
          status={status}
          error={error}
          botControlBusy={botControlBusy}
          botControlError={botControlError}
          queueSize={selectedQueue.songs.length + (selectedQueue.current ? 1 : 0)}
          onControlBot={(action) => void controlBot(action)}
        />
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <SongForm
            guilds={guilds}
            guildsLoading={guildsLoading}
            guildsError={guildsError}
            guildId={guildId}
            channelId={channelId}
            songQuery={songQuery}
            queueing={queueing}
            queueMessage={queueMessage}
            queueError={queueError}
            authLoading={authLoading}
            discordUser={discordUser}
            onGuildChange={(value) => {
              setGuildId(value);
              setChannelId("");
              setQueue({ current: null, songs: [] });
              setQueueLoadError(null);
            }}
            onChannelChange={setChannelId}
            onSongQueryChange={setSongQuery}
            onSubmit={submitSong}
            onRefreshGuilds={refreshGuilds}
          />
          <QueuePanel
            selectedGuild={selectedGuild}
            channelId={channelId}
            guildId={guildId}
            queue={selectedQueue}
            loadError={queueLoadError}
            controlBusy={queueControlBusy}
            controlError={queueControlError}
            onControl={(action) => void controlQueue(action)}
          />
        </div>
        <LogsPanel
          guilds={guilds}
          selectedGuild={selectedLogGuild}
          guildsLoading={guildsLoading}
          logGuildId={logGuildId}
          logChannelId={logChannelId}
          logChannel={logChannel}
          logMessages={logMessages}
          logLoading={logLoading}
          logError={logError}
          logSaving={logSaving}
          logSaveError={logSaveError}
          status={status}
          logMessagesRef={logMessagesRef}
          onGuildChange={(value) => {
            setLogGuildId(value);
            setLogChannelId("");
          }}
          onChannelChange={setLogChannelId}
          onSelectChannel={() => void selectCommandLogChannel()}
        />
      </main>
    </div>
  );
}
