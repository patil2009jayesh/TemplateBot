const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { errorEmbed, successEmbed, parseDuration, formatDuration } = require('../../utils/helpers');
const { logModAction } = require('../../systems/loggingSystem');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout (mute) a member.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('Member to timeout').setRequired(true))
    .addStringOption(o => o.setName('duration').setDescription('Duration (e.g. 10m, 2h, 1d)').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for timeout')),

  async execute(interaction) {
    const target = interaction.options.getMember('user');
    const durationStr = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!target) return interaction.reply({ embeds: [errorEmbed('Member not found.')], ephemeral: true });
    if (!target.moderatable) return interaction.reply({ embeds: [errorEmbed('I cannot timeout this member.')], ephemeral: true });

    const durationMs = parseDuration(durationStr);
    if (!durationMs) return interaction.reply({ embeds: [errorEmbed('Invalid duration. Use format: `10s`, `5m`, `2h`, `1d`.')], ephemeral: true });

    // Max 28 days
    if (durationMs > 28 * 24 * 3600 * 1000) {
      return interaction.reply({ embeds: [errorEmbed('Maximum timeout duration is 28 days.')], ephemeral: true });
    }

    await target.timeout(durationMs, reason);
    await logModAction(interaction.guild, 'timeout', target, interaction.member, reason);

    await interaction.reply({
      embeds: [successEmbed(`**${target.user.tag}** has been timed out for **${formatDuration(durationMs)}**.\n**Reason:** ${reason}`)],
    });
  },
};
