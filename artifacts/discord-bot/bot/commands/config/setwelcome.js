const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { updateGuildSetting, getGuild } = require('../../services/guildService');
const { successEmbed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setwelcome')
    .setDescription('Configure the welcome message.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('message')
        .setDescription('Set the welcome message. Variables: {user} {server} {memberCount} {inviter}')
        .addStringOption(o => o.setName('text').setDescription('Welcome message').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('embed')
        .setDescription('Toggle embed mode for welcome messages.')
        .addBooleanOption(o => o.setName('enabled').setDescription('Enable or disable embed').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('dm')
        .setDescription('Toggle DM welcome message.')
        .addBooleanOption(o => o.setName('enabled').setDescription('Enable or disable DM').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('delay')
        .setDescription('Set delay before sending welcome message (seconds).')
        .addIntegerOption(o => o.setName('seconds').setDescription('Delay in seconds (0 = instant)').setMinValue(0).setMaxValue(30).setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('test')
        .setDescription('Test the current welcome message.')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'message') {
      const text = interaction.options.getString('text');
      await updateGuildSetting(interaction.guild.id, 'welcome', { message: text });
      return interaction.reply({ embeds: [successEmbed(`Welcome message updated!\n**Preview:** ${text}`)] });
    }

    if (sub === 'embed') {
      const enabled = interaction.options.getBoolean('enabled');
      await updateGuildSetting(interaction.guild.id, 'welcome', { embed: enabled });
      return interaction.reply({ embeds: [successEmbed(`Welcome embed mode **${enabled ? 'enabled' : 'disabled'}**.`)] });
    }

    if (sub === 'dm') {
      const enabled = interaction.options.getBoolean('enabled');
      await updateGuildSetting(interaction.guild.id, 'welcome', { dm: enabled });
      return interaction.reply({ embeds: [successEmbed(`Welcome DM **${enabled ? 'enabled' : 'disabled'}**.`)] });
    }

    if (sub === 'delay') {
      const seconds = interaction.options.getInteger('seconds');
      await updateGuildSetting(interaction.guild.id, 'welcome', { delay: seconds });
      return interaction.reply({ embeds: [successEmbed(`Welcome delay set to **${seconds}s**.`)] });
    }

    if (sub === 'test') {
      const guildData = await getGuild(interaction.guild.id);
      const welcomeSettings = guildData.settings.welcome;
      const { formatMessage } = require('../../utils/helpers');

      const vars = {
        user: `<@${interaction.user.id}>`,
        server: interaction.guild.name,
        memberCount: interaction.guild.memberCount,
        inviter: 'TestInviter#0000',
      };

      const formatted = formatMessage(welcomeSettings.message, vars);

      if (welcomeSettings.embed) {
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`Welcome to ${interaction.guild.name}!`)
          .setDescription(formatted)
          .setThumbnail(interaction.user.displayAvatarURL())
          .setFooter({ text: `Member #${interaction.guild.memberCount}` });
        return interaction.reply({ embeds: [embed] });
      }
      return interaction.reply({ content: formatted });
    }
  },
};
