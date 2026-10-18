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
3. From `backend`, install dependencies and start the service:

   ```sh
   pnpm install
   pnpm dev
   ```

The backend listens on port `3001` by default. It registers the Discord slash
commands `/help` and `/ping` when the bot connects. Set `DISCORD_GUILD_ID` to
register them in one server during development; otherwise they are registered
globally. `PORT` changes the API port, and `CLIENT_ORIGIN` configures allowed
browser origins (comma-separated).
The web app can log the Discord bot in and out. Stopping it clears any current
playback and queue and disconnects it from voice; the API remains available so
the bot can be started again.

## Run the React app

In another terminal, from `banger-player-client`:

```sh
pnpm install
pnpm dev
```

The Vite server proxies `/api` requests to the backend. The app displays the
connection status fetched from `GET /api/status` and polls command history
every five seconds.

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
- `GET /api/guilds` lists available Discord servers and voice channels.
- `GET /api/queue?guildId=<id>` returns the current song and waiting songs.
- `POST /api/queue/control` accepts `guildId` and an action of `skip`, `clear`,
  `pause`, or `resume`.
- `POST /api/queue` searches for a song and queues it in the selected server
  and voice channel.
- `GET /api/commands` returns Discord slash commands and web song submissions
  since the backend started, newest first. This history is kept in memory and
  resets on restart.

The queue endpoint has no user authentication. Keep the backend restricted to
trusted users and networks unless you add an authentication layer.

## Existing Python music bot

`main.py` and its cogs are the original Python music bot. Its message-command
prefix is `!!`; its music commands have not been migrated to the new Discord.js
backend. Run only one bot process per Discord token to avoid conflicting
connections.
