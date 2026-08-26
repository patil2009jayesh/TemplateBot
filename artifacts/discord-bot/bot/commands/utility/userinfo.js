const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('View information about a user.')
    .addUserOption(o => o.setName('user').setDescription('User to inspect')),

  async execute(interaction) {
    const target = interaction.options.getMember('user') || interaction.member;
    const user = target.user;

    const roles = target.roles.cache
      .filter(r => r.id !== interaction.guild.id)
      .sort((a, b) => b.position - a.position)
      .map(r => `<@&${r.id}>`)
      .slice(0, 10)
      .join(', ') || 'None';

    const embed = new EmbedBuilder()
      .setColor(target.displayHexColor || 0x5865f2)
      .setTitle(`${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '🆔 User ID', value: user.id, inline: true },
        { name: '🤖 Bot', value: user.bot ? 'Yes' : 'No', inline: true },
        { name: '📅 Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: '📥 Joined Server', value: target.joinedAt ? `<t:${Math.floor(target.joinedTimestamp / 1000)}:R>` : 'Unknown', inline: true },
        { name: '🎭 Nickname', value: target.nickname || 'None', inline: true },
        { name: `🏷️ Roles (${target.roles.cache.size - 1})`, value: roles }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
