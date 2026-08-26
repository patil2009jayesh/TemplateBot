const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { createReminder } = require('../../systems/reminderSystem');
const { parseDuration, formatDuration, errorEmbed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Set a reminder.')
    .addStringOption(o => o.setName('duration').setDescription('When to remind you (e.g. 10m, 2h, 1d)').setRequired(true))
    .addStringOption(o => o.setName('message').setDescription('What to remind you about').setRequired(true)),

  async execute(interaction) {
    const durationStr = interaction.options.getString('duration');
    const message = interaction.options.getString('message');

    const ms = parseDuration(durationStr);
    if (!ms) return interaction.reply({ embeds: [errorEmbed('Invalid duration. Use: `10s`, `5m`, `2h`, `1d`.')], flags: 64 });

    const remindAt = new Date(Date.now() + ms).toISOString();

    await createReminder(
      interaction.user.id,
      interaction.guild.id,
      interaction.channel.id,
      message,
      remindAt
    );

    const embed = new EmbedBuilder()
      .setColor(0x44ff88)
      .setDescription(`✅ I'll remind you in **${formatDuration(ms)}**!\n**Message:** ${message}`);

    await interaction.reply({ embeds: [embed] });
  },
};
