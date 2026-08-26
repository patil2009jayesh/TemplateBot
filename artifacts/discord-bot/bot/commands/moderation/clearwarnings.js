const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { errorEmbed, successEmbed } = require('../../utils/helpers');
const { clearWarnings } = require('../../services/warningService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearwarnings')
    .setDescription('Clear all warnings for a member.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(o => o.setName('user').setDescription('Member to clear warnings for').setRequired(true)),

  async execute(interaction) {
    const target = interaction.options.getUser('user');
    await clearWarnings(target.id, interaction.guild.id);

    await interaction.reply({
      embeds: [successEmbed(`All warnings for **${target.tag}** have been cleared.`)],
    });
  },
};
