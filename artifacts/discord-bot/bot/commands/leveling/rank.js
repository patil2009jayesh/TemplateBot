const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, getUserRank } = require('../../services/userService');
const { getXPForLevel } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('View your rank and XP progress.')
    .addUserOption(o => o.setName('user').setDescription('User to check rank for')),

  async execute(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser('user') || interaction.user;
    const guildId = interaction.guild.id;

    const user = await getUser(target.id, guildId);
    const rank = await getUserRank(target.id, guildId);
    const nextLevelXP = getXPForLevel(user.level + 1);
    const currentLevelXP = getXPForLevel(user.level);
    const progress = user.xp - currentLevelXP;
    const needed = nextLevelXP - currentLevelXP;

    const barLength = 20;
    const filled = Math.round((progress / needed) * barLength);
    const bar = '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, barLength - filled));

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`${target.username}'s Rank`)
      .setThumbnail(target.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'Rank', value: rank ? `#${rank}` : 'Unranked', inline: true },
        { name: 'Level', value: `${user.level}`, inline: true },
        { name: 'XP', value: `${user.xp.toLocaleString()}`, inline: true },
        { name: `Progress to Level ${user.level + 1}`, value: `\`${bar}\` ${progress}/${needed}` }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
