# Banger Player

Banger Player runs an Express API and a Discord.js bot together in one Node.js
backend. The React app uses the backend API through the Vite development proxy.

## Run the shared backend

Requires Node.js 22.12 or newer.
The backend bundles FFmpeg and an Opus fallback for Discord audio playback.
YouTube audio extraction uses yt-dlp from the Python requirements. Install it
in the default Python 3 environment (`py -3 -m pip install -r requirements.txt`
on Windows, or `python3 -m pip install -r requirements.txt` on macOS/Linux).

1. Copy `.env.example` to `backend/.env`.
2. Set `DISCORD_TOKEN` in `backend/.env` to enable the Discord bot. The API can
   run without a token while the bot is being configured.
3. To let users sign in and have their verified Discord names shown beside
   queued songs, configure the OAuth2 settings in the Discord Developer Portal:
   add `http://localhost:3001/api/auth/discord/callback` as a redirect URI, then
   set `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, and
   `DISCORD_REDIRECT_URI` in `backend/.env`. Generate a random session secret
   with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`
   and set it as `SESSION_SECRET`. Set `DISCORD_USER_ALLOWLIST` to a
   comma-separated list of allowed Discord user IDs. You can copy a user's ID
   from Discord with Developer Mode enabled. Sign-in stays disabled if the
   allowlist is empty. For HTTPS deployments, set `COOKIE_SECURE=true` and use
   the public HTTPS callback URI.
4. From `backend`, install dependencies and start the service:

   ```sh
   pnpm install
   pnpm dev
   ```

The backend listens on port `3001` by default. Discord music commands use the
`!!` prefix and the same queue and playback controls as the web client. Enable
the **Message Content Intent** under **Privileged Gateway Intents** in the
Discord Developer Portal, and give the bot permission to view and send messages
in the command channel. Available commands include `!!play <song>` (alias
`!!p`), `!!queue` (`!!q`), `!!skip` (`!!s`), `!!pause`, `!!resume` (`!!r`),
`!!clear` (`!!c`), `!!stop` (`!!disconnect`), `!!help`, and `!!ping`. `!!play`
uses the voice channel the command user has joined. `PORT` changes the API port,
and `CLIENT_ORIGIN` configures allowed browser origins (comma-separated).
The web app can log the Discord bot in and out. Stopping it clears any current
playback and queue and disconnects it from voice; the API remains available so
the bot can be started again.
In Logs, select a server and text channel to send bot and web
activity to that channel and view its latest messages. The selected channel is
kept in memory until the backend restarts.
Successful song and queue actions are logged in a readable format, such as
`Artist - Song added to the queue by Display Name`,
`Artist - Song paused by Display Name`, and `Queue cleared by Display Name`.
Users must sign in with Discord before queueing songs; the queue displays the
verified Discord username of each requester. The app opens on a dedicated
Discord sign-in page; after sign-in it navigates to `/controls`. The controls
page redirects signed-out visitors back to sign-in.

## Run the React app

In another terminal, from `banger-player-client`:

```sh
pnpm install
pnpm dev
```

The Vite server proxies `/api` requests to the backend. The app displays the
connection status fetched from `GET /api/status` and polls the Discord channel
logs every five seconds.

The client lets users select a server and voice channel to play or queue songs.
It displays that selection, the current song, and queued songs, refreshing the
queue every five seconds. The bot needs Connect and Speak permissions in the
selected voice channel. Queue controls can skip the current song, clear the
queue, and pause or resume playback. The bot stays connected to its voice
channel when the queue becomes empty or is cleared.

## API routes

- `GET /api/health` returns API health and uptime.
- `GET /api/status` returns API and Discord bot connection status.
- `POST /api/bot/control` accepts an action of `start` or `stop` to log the
  Discord bot in or out.
- `GET /api/auth/discord` starts Discord OAuth2 sign-in, and
  `GET /api/auth/discord/callback` completes it.
- `GET /api/auth/me` returns the signed-in Discord user, if any.
- `POST /api/auth/logout` clears the current sign-in session.
- `GET /api/guilds` lists available Discord servers, voice channels, and text
  channels.
- `GET /api/command-log` returns the selected log channel and its latest
  messages.
- `POST /api/command-log/channel` accepts `guildId` and `channelId` to select
  where activity is logged. The bot needs View Channel, Read Message History,
  and Send Messages permissions there.
- `GET /api/queue?guildId=<id>` returns the current song and waiting songs.
- `POST /api/queue/control` accepts `guildId` and an action of `skip`, `clear`,
  `pause`, or `resume`.
- `POST /api/queue` searches for a song and queues it in the selected server
  and voice channel.
- `GET /api/commands` returns Discord message commands and web song submissions
  since the backend started, newest first. This history is kept in memory and
  resets on restart.

Web users must sign in with an ID in `DISCORD_USER_ALLOWLIST`. The allowlist is
required to enable sign-in and protects web queue submissions, queue controls,
bot start/stop, server and queue data, command history, and command-log
management. Discord server members can use the `!!` commands directly in
Discord; this web allowlist does not restrict Discord message commands.

## Legacy Python music bot

`main.py` and its cogs contain an older Python bot with `!!` message commands.
Run only one bot process per Discord token to avoid conflicting connections.
