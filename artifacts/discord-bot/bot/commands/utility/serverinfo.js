const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('View information about this server.'),

  async execute(interaction) {
    const guild = interaction.guild;
    await guild.fetch();

    const owner = await guild.fetchOwner().catch(() => null);
    const bots = guild.members.cache.filter(m => m.user.bot).size;
    const humans = guild.memberCount - bots;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(guild.name)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .addFields(
        { name: '🆔 ID', value: guild.id, inline: true },
        { name: '👑 Owner', value: owner ? `${owner.user.tag}` : 'Unknown', inline: true },
        { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
        { name: '👥 Members', value: `${guild.memberCount} (${humans} humans, ${bots} bots)`, inline: true },
        { name: '📣 Channels', value: `${guild.channels.cache.size}`, inline: true },
        { name: '🎭 Roles', value: `${guild.roles.cache.size}`, inline: true },
        { name: '💎 Boost Level', value: `Level ${guild.premiumTier}`, inline: true },
        { name: '🌟 Boosts', value: `${guild.premiumSubscriptionCount}`, inline: true },
        { name: '🌍 Region', value: guild.preferredLocale, inline: true }
      )
      .setImage(guild.bannerURL({ size: 1024 }) || null)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
