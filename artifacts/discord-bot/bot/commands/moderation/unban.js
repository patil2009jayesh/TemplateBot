const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { errorEmbed, successEmbed } = require('../../utils/helpers');
const { logModAction } = require('../../systems/loggingSystem');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user from the server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption(o => o.setName('user_id').setDescription('User ID to unban').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for unban')),

  async execute(interaction) {
    const userId = interaction.options.getString('user_id');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      const ban = await interaction.guild.bans.fetch(userId);
      await interaction.guild.members.unban(userId, reason);
      await logModAction(interaction.guild, 'unban', ban.user, interaction.member, reason);

      await interaction.reply({
        embeds: [successEmbed(`**${ban.user.tag}** has been unbanned.\n**Reason:** ${reason}`)],
      });
    } catch {
      await interaction.reply({ embeds: [errorEmbed('User is not banned or invalid ID.')], ephemeral: true });
    }
  },
};
