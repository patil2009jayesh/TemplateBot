const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getInviteLeaderboard } = require('../../services/inviteService');
const { getDBErrorMessage } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inviteleaderboard')
    .setDescription('View the top inviters in this server.'),

  async execute(interaction) {
    await interaction.deferReply();

    let entries;
    try {
      entries = await getInviteLeaderboard(interaction.guild.id, 10);
    } catch (err) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff4444)
            .setDescription(`❌ ${getDBErrorMessage(err)}`),
        ],
      });
    }

    if (!entries.length) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setDescription('No invite data yet! Invite some people to get started.'),
        ],
      });
    }

    const medals = ['🥇', '🥈', '🥉'];

    const lines = await Promise.all(
      entries.map(async (e, i) => {
        const user = await interaction.client.users.fetch(e.user_id).catch(() => ({ username: 'Unknown User' }));
        const real = Math.max(0, e.invites_count - e.left_invites - e.fake_invites);
        const prefix = medals[i] || `**#${i + 1}**`;
        return `${prefix} **${user.username}** — ${real} real invites *(${e.invites_count} total, ${e.left_invites} left, ${e.fake_invites} fake)*`;
      })
    );

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📨 ${interaction.guild.name} — Invite Leaderboard`)
      .setDescription(lines.join('\n'))
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
