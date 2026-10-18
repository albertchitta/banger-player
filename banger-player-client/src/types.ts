export type BackendStatus = {
  api: string;
  discord: {
    enabled: boolean;
    state: "connecting" | "disabled" | "error" | "ready" | "stopped";
    user: string | null;
    guilds: number;
  };
};

export type DiscordUser = {
  id: string;
  username: string;
};

export type CommandLogChannel = {
  guildId: string;
  channelId: string;
  name: string | null;
};

export type CommandLogMessage = {
  id: string;
  content: string;
  author: string;
  timestamp: string;
};

export type VoiceChannel = {
  id: string;
  name: string;
};

export type DiscordGuild = {
  id: string;
  name: string;
  channels: VoiceChannel[];
  textChannels: VoiceChannel[];
};

export type QueuedSong = {
  title: string;
  duration: string;
  requester?: DiscordUser;
};

export type GuildQueue = {
  guildId?: string;
  current: (QueuedSong & {
    state: "loading" | "playing" | "paused";
  }) | null;
  songs: QueuedSong[];
};

export type QueueControlAction = "skip" | "clear" | "pause" | "resume";
