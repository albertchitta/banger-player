const { EmbedBuilder } = require('discord.js');
const { Translate } = require('../../process_tools');

module.exports = {
    name: 'help',
    description:("All the commands this bot has!"),
    showHelp: false,

    async execute({ client, inter }) {
        const commands = client.commands.filter(x => x.showHelp !== false);

        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setAuthor({
                name: client.user.username,
                iconURL: client.user.displayAvatarURL({
                    size: 1024,
                    dynamic: true
                })
            })
            .setDescription(await Translate("Here's a list of commands:"))
            .addFields([{
                name: `Enabled - ${commands.size}`,
                value: commands.map(x => `\`${x.name}\``).join(' | ')
            }])
            .setTimestamp()
            .setFooter({
                text: await Translate('Click <[here](https://github.com/albertchitta/banger-player)>) for more help.'), iconURL: inter.member.avatarURL({ dynamic: true })
            });

        inter.editReply({ embeds: [embed] });
    }
};
