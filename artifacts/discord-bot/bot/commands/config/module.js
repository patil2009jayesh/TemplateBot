const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { toggleModule, getGuild } = require('../../services/guildService');
const { errorEmbed } = require('../../utils/helpers');

const MODULES = ['leveling', 'invites', 'welcome', 'moderation', 'afk', 'logging', 'autorole', 'autovc'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('module')
    .setDescription('Enable or disable a bot module.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o =>
      o.setName('name')
        .setDescription('Module to toggle')
        .setRequired(true)
        .addChoices(...MODULES.map(m => ({ name: m, value: m })))
    ),

  async execute(interaction) {
    const moduleName = interaction.options.getString('name');

    if (!MODULES.includes(moduleName)) {
      return interaction.reply({ embeds: [errorEmbed(`Unknown module: \`${moduleName}\``)], ephemeral: true });
    }

    const newState = await toggleModule(interaction.guild.id, moduleName);

    const embed = new EmbedBuilder()
      .setColor(newState ? 0x44ff88 : 0xff4444)
      .setTitle('Module Updated')
      .setDescription(`**${moduleName}** has been **${newState ? '✅ enabled' : '❌ disabled'}**.`);

    await interaction.reply({ embeds: [embed] });
  },
};
