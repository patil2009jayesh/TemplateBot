const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { updateGuildField } = require('../../services/guildService');
const { successEmbed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setautorole')
    .setDescription('Set the role given to new members automatically.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addRoleOption(o => o.setName('role').setDescription('Role to auto-assign (leave empty to clear)')),

  async execute(interaction) {
    const role = interaction.options.getRole('role');

    await updateGuildField(interaction.guild.id, 'roles', { autorole: role ? role.id : null });

    const msg = role
      ? `Auto role set to ${role}. New members will automatically receive this role.`
      : 'Auto role has been cleared.';

    await interaction.reply({ embeds: [successEmbed(msg)] });
  },
};
