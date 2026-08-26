const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { updateGuildField } = require('../../services/guildService');
const { successEmbed, errorEmbed } = require('../../utils/helpers');

const CHANNEL_KEYS = ['welcome', 'leave', 'logs', 'modLogs', 'inviteLogs', 'levelLogs'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setchannel')
    .setDescription('Configure a channel for a bot feature.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o =>
      o.setName('type')
        .setDescription('Channel type')
        .setRequired(true)
        .addChoices(...CHANNEL_KEYS.map(k => ({ name: k, value: k })))
    )
    .addChannelOption(o =>
      o.setName('channel')
        .setDescription('Channel to use (leave empty to clear)')
        .addChannelTypes(ChannelType.GuildText)
    ),

  async execute(interaction) {
    const type = interaction.options.getString('type');
    const channel = interaction.options.getChannel('channel');

    if (!CHANNEL_KEYS.includes(type)) {
      return interaction.reply({ embeds: [errorEmbed(`Unknown channel type: \`${type}\``)], flags: 64 });
    }

    await updateGuildField(interaction.guild.id, 'channels', { [type]: channel ? channel.id : null });

    const msg = channel
      ? `**${type}** channel set to ${channel}.`
      : `**${type}** channel has been cleared.`;

    await interaction.reply({ embeds: [successEmbed(msg)] });
  },
};
