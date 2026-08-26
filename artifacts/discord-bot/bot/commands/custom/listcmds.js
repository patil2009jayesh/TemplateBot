const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { listCustomCommands } = require('../../services/customCommandService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('listcmds')
    .setDescription('List all custom commands in this server.'),

  async execute(interaction) {
    const cmds = await listCustomCommands(interaction.guild.id);

    if (cmds.length === 0) {
      return interaction.reply({ content: 'No custom commands set up yet. Use `/addcmd` to create one.' });
    }

    const lines = cmds.map(c => `\`/${c.name}\` — ${c.response.slice(0, 50)}${c.response.length > 50 ? '...' : ''}`);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`Custom Commands (${cmds.length})`)
      .setDescription(lines.join('\n'))
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
