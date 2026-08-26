const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { formatDuration } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('uptime')
    .setDescription('View how long the bot has been online.'),

  async execute(interaction) {
    const uptimeMs = interaction.client.uptime || 0;

    const embed = new EmbedBuilder()
      .setColor(0x44ff88)
      .setTitle('🟢 Bot Uptime')
      .addFields(
        { name: 'Uptime', value: formatDuration(uptimeMs), inline: true },
        { name: 'Guilds', value: `${interaction.client.guilds.cache.size}`, inline: true },
        { name: 'Users', value: `${interaction.client.users.cache.size}`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
