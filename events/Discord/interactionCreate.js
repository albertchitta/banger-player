const { EmbedBuilder, InteractionType } = require('discord.js');
const { useQueue } = require('discord-player');
const { Translate } = require('../../process_tools');

module.exports = async (client, inter) => {
  await inter.deferReply({ ephemeral: true });

  if (inter.type === InteractionType.ApplicationCommand) {
    const dj = client.config.opt.dj;
    const command = client.commands.get(inter.commandName);
    const errorEmbed = new EmbedBuilder().setColor('#ff0000');

    command.execute({ inter, client });
  } else if (inter.type === InteractionType.MessageComponent) {
    const customId = inter.customId;
    
    if (!customId) return;

    const queue = useQueue(inter.guild);
    const path = `../../buttons/${customId}.js`;

    delete require.cache[require.resolve(path)];
    const button = require(path);
    
    if (button) return button({ client, inter, customId, queue });
  }

}
