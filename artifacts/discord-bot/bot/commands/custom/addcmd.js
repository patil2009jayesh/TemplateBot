const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { addCustomCommand } = require('../../services/customCommandService');
const { errorEmbed, successEmbed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addcmd')
    .setDescription('Add a custom command.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('name').setDescription('Command name (no spaces)').setRequired(true))
    .addStringOption(o => o.setName('response').setDescription('Response text').setRequired(true)),

  async execute(interaction) {
    const name = interaction.options.getString('name').toLowerCase().replace(/\s+/g, '');
    const response = interaction.options.getString('response');

    // Prevent overriding built-in commands
    const builtIn = interaction.client.commands.has(name);
    if (builtIn) {
      return interaction.reply({ embeds: [errorEmbed(`\`${name}\` is a built-in command and cannot be overridden.`)], ephemeral: true });
    }

    try {
      await addCustomCommand(interaction.guild.id, name, response, interaction.user.id);
      await interaction.reply({ embeds: [successEmbed(`Custom command \`/${name}\` created!\n**Response:** ${response}`)] });
    } catch (err) {
      if (err.code === '23505') {
        return interaction.reply({ embeds: [errorEmbed(`Command \`/${name}\` already exists. Delete it first with \`/delcmd\`.`)], ephemeral: true });
      }
      throw err;
    }
  },
};
