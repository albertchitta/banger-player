module.exports = {
  app: {
    token: 'xxx',
    playing: 'by the Community ❤️',
    global: true,
    guild: 'xxx',
    extraMessages: false,
    loopMessage: false,
    lang: 'en',
    enableEmojis: false,
  },

  emojis: {
    'back': '⏪',
    'skip': '⏩',
    'resumePause': '⏯️',
    'saveTrack': '💾',
    'volumeUp': '🔊',
    'volumeDown': '🔉',
    'loop': '🔁',
  },

  opt: {
    dj: {
      enabled: false,
      roleName: '',
      commands: [],
    },
    translate_timeout: 10000,
    maxVol: 100,
    spotifyBridge: true,
    volume: 75,
    leaveOnEmpty: true,
    leaveOnEmptyCooldown: 30000,
    leaveOnEnd: true,
    leaveOnEndCooldown: 30000,
    discordPlayer: {
      ytdlOptions: {
        quality: 'highestaudio',
        highWaterMark: 1 << 25,
      }
    },
  },
}
