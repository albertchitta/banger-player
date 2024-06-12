require('dotenv').config()

module.exports = {
  app: {
      token: process.env.BOT_TOKEN,
      playing: 'bangers',
      global: true,
      guild: 'xxx',
      extraMessages: false,
      loopMessage: false,
      lang: 'en',
      enableEmojis: true,
  },

  emojis:{
      'back': '⏪',
      'skip': '⏩',
      'ResumePause': '⏯️',
      'savetrack': '💾',
      'volumeUp': '🔊',
      'volumeDown': '🔉',
      'loop': '🔁',
  },

  opt: {
      DJ: {
          enabled: false,
          roleName: '',
          commands: []
      },
      Translate_Timeout: 10000,
      maxVol: 100,
      spotifyBridge: true,
      volume: 75,
      leaveOnEmpty: false,
      leaveOnEmptyCooldown: 30000,
      leaveOnEnd: false,
      leaveOnEndCooldown: 30000,
      discordPlayer: {
          ytdlOptions: {
              quality: 'highestaudio',
              highWaterMark: 1 << 25
          }
      }
  }
};
