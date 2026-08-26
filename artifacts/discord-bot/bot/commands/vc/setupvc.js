const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { updateGuildSetting } = require('../../services/guildService');
const { errorEmbed, successEmbed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setupvc')
    .setDescription('Set up the auto voice channel system.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(o =>
      o.setName('lobby')
        .setDescription('Lobby voice channel — joining this creates a personal VC')
        .addChannelTypes(ChannelType.GuildVoice)
        .setRequired(true)
    )
    .addChannelOption(o =>
      o.setName('category')
        .setDescription('Category to create voice channels under')
        .addChannelTypes(ChannelType.GuildCategory)
    ),

  async execute(interaction) {
    const lobby = interaction.options.getChannel('lobby');
    const category = interaction.options.getChannel('category');

    await updateGuildSetting(interaction.guild.id, 'autovc', {
      lobby: lobby.id,
      category: category ? category.id : null,
    });

    await interaction.reply({
      embeds: [successEmbed(`Auto VC configured!\n**Lobby:** ${lobby}\n**Category:** ${category || 'None'}`)],
    });
  },
};
