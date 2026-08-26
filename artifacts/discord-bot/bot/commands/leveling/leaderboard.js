const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getLeaderboard } = require('../../services/userService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the XP leaderboard for this server.')
    .addIntegerOption(o => o.setName('page').setDescription('Page number').setMinValue(1)),

  async execute(interaction) {
    await interaction.deferReply();
    const page = interaction.options.getInteger('page') || 1;
    const perPage = 10;
    const offset = (page - 1) * perPage;

    const all = await getLeaderboard(interaction.guild.id, 50);
    const slice = all.slice(offset, offset + perPage);

    if (slice.length === 0) {
      return interaction.editReply({ content: 'No one is on the leaderboard yet!' });
    }

    const lines = await Promise.all(
      slice.map(async (entry, i) => {
        const rank = offset + i + 1;
        const user = await interaction.client.users.fetch(entry.user_id).catch(() => ({ username: 'Unknown' }));
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `**#${rank}**`;
        return `${medal} ${user.username} — Level ${entry.level} | ${entry.xp.toLocaleString()} XP`;
      })
    );

    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle(`🏆 ${interaction.guild.name} Leaderboard — Page ${page}`)
      .setDescription(lines.join('\n'))
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
