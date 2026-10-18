import { Button, Input, Select, Surface } from "@cladd-ui/react";
import { useState } from "react";
import type { FormEventHandler } from "react";
import type { DiscordGuild, DiscordUser } from "../types";

type SongFormProps = {
  guilds: DiscordGuild[];
  guildsLoading: boolean;
  guildsError: string | null;
  guildId: string;
  channelId: string;
  songQuery: string;
  queueing: boolean;
  queueMessage: string | null;
  queueError: string | null;
  authLoading: boolean;
  discordUser: DiscordUser | null;
  onGuildChange: (guildId: string) => void;
  onChannelChange: (channelId: string) => void;
  onSongQueryChange: (query: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onRefreshGuilds: () => void;
};

export function SongForm({
  guilds,
  guildsLoading,
  guildsError,
  guildId,
  channelId,
  songQuery,
  queueing,
  queueMessage,
  queueError,
  authLoading,
  discordUser,
  onGuildChange,
  onChannelChange,
  onSongQueryChange,
  onSubmit,
  onRefreshGuilds,
}: SongFormProps) {
  const [songQueryFocused, setSongQueryFocused] = useState(false);
  const [songQueryTouched, setSongQueryTouched] = useState(false);
  const [songQueryEdited, setSongQueryEdited] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const selectedGuild = guilds.find((guild) => guild.id === guildId);
  const selectedChannel = selectedGuild?.channels.find(
    (channel) => channel.id === channelId,
  );
  const songQueryInvalid =
    songQueryEdited && songQueryTouched && !songQueryFocused && !songQuery.trim();
  const missingFields = [
    !guildId && "Discord server",
    !channelId && "voice channel",
    !songQuery.trim() && "song name",
  ].filter(Boolean);

  return (
    <Surface
      as="section"
      className="rounded-2xl p-5"
      variant="solid"
      outline
      aria-labelledby="play-song-title"
    >
      <h2 id="play-song-title" className="text-xl font-semibold">
        Add to queue
      </h2>
      <p className="mt-2 text-sm text-white/55">
        Choose a server and voice channel, then search YouTube by song name to
        play or queue it there.
      </p>

      <form
        className="mt-4 space-y-4"
        onSubmit={(event) => {
          setSubmitAttempted(true);
          if (missingFields.length > 0) {
            event.preventDefault();
            return;
          }
          onSubmit(event);
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 text-sm text-white/70">
            <span className="block">Discord server</span>
            <Select
              className="w-full"
              aria-label="Discord server"
              type="button"
              options={guilds}
              value={guildId}
              placeholder="Select a server"
              getOptionValue={(guild) => guild.id}
              renderOption={({ value }) => value.name}
              keyboardHints={false}
              disabled={guildsLoading || guilds.length === 0}
              onChange={onGuildChange}
            >
              {selectedGuild?.name}
            </Select>
          </div>

          <div className="space-y-2 text-sm text-white/70">
            <span className="block">Voice channel</span>
            <Select
              className="w-full"
              aria-label="Voice channel"
              type="button"
              options={selectedGuild?.channels ?? []}
              value={channelId}
              placeholder="Select a voice channel"
              getOptionValue={(channel) => channel.id}
              renderOption={({ value }) => value.name}
              keyboardHints={false}
              disabled={!selectedGuild}
              onChange={onChannelChange}
            >
              {selectedChannel?.name}
            </Select>
          </div>
        </div>

        <label className="block space-y-2 text-sm text-white/70">
          <span className="block">Song name</span>
          <div className="flex items-center gap-3 sm:flex-row">
            <Input
              className="min-w-0 flex-1"
              inputClassName="text-white placeholder:text-white/35"
              type="text"
              maxLength={200}
              placeholder="e.g. Daft Punk - One More Time"
              value={songQuery}
              onChange={(value) => {
                setSongQueryEdited(true);
                onSongQueryChange(value);
              }}
              onFocus={() => setSongQueryFocused(true)}
              onBlur={() => {
                setSongQueryFocused(false);
                setSongQueryTouched(true);
              }}
              valid={!songQueryInvalid}
              errorMessage="Enter a song name."
            />
            <Button
              className="shrink-0"
              color="brand"
              variant="gradient-fill"
              size="xl"
              type="submit"
              disabled={
                queueing ||
                !discordUser ||
                authLoading ||
                guildsLoading ||
                !guildId ||
                !channelId ||
                !songQuery.trim()
              }
            >
              {queueing
                ? "Searching…"
                : discordUser
                  ? "Play / queue"
                  : "Sign in to queue"}
            </Button>
          </div>
        </label>
        {submitAttempted && missingFields.length > 0 && (
          <p role="alert" className="text-sm text-red-300">
            Please complete the required fields: {missingFields.join(", ")}.
          </p>
        )}
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
            No servers available. Make sure the bot is online and has joined a
            server with a voice channel.
          </span>
          <Button
            variant="solid"
            size="sm"
            type="button"
            onClick={onRefreshGuilds}
          >
            Refresh servers
          </Button>
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
    </Surface>
  );
}
