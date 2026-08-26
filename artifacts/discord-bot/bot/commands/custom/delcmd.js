const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { deleteCustomCommand, getCustomCommand } = require('../../services/customCommandService');
const { errorEmbed, successEmbed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delcmd')
    .setDescription('Delete a custom command.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('name').setDescription('Command name to delete').setRequired(true)),

  async execute(interaction) {
    const name = interaction.options.getString('name').toLowerCase();

    const existing = await getCustomCommand(interaction.guild.id, name);
    if (!existing) {
      return interaction.reply({ embeds: [errorEmbed(`Command \`/${name}\` does not exist.`)], flags: 64 });
    }

    await deleteCustomCommand(interaction.guild.id, name);
    await interaction.reply({ embeds: [successEmbed(`Custom command \`/${name}\` deleted.`)] });
  },
};
