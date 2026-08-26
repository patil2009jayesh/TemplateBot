const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { errorEmbed, successEmbed } = require('../../utils/helpers');
const { logModAction } = require('../../systems/loggingSystem');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(o => o.setName('user').setDescription('Member to kick').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for kick')),

  async execute(interaction) {
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!target) return interaction.reply({ embeds: [errorEmbed('Member not found.')], flags: 64 });
    if (!target.kickable) return interaction.reply({ embeds: [errorEmbed('I cannot kick this member.')], flags: 64 });
    if (target.id === interaction.user.id) return interaction.reply({ embeds: [errorEmbed('You cannot kick yourself.')], flags: 64 });

    await target.kick(reason);
    await logModAction(interaction.guild, 'kick', target, interaction.member, reason);

    await interaction.reply({
      embeds: [successEmbed(`**${target.user.tag}** has been kicked.\n**Reason:** ${reason}`)],
    });
  },
};
