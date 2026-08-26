const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { errorEmbed, successEmbed } = require('../../utils/helpers');
const { addWarning, getWarningCount } = require('../../services/warningService');
const { logModAction } = require('../../systems/loggingSystem');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('Member to warn').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for warning').setRequired(true)),

  async execute(interaction) {
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason');

    if (!target) return interaction.reply({ embeds: [errorEmbed('Member not found.')], flags: 64 });
    if (target.user.bot) return interaction.reply({ embeds: [errorEmbed('Cannot warn a bot.')], flags: 64 });

    await addWarning(target.id, interaction.guild.id, interaction.user.id, reason);
    const count = await getWarningCount(target.id, interaction.guild.id);

    await logModAction(interaction.guild, 'warn', target, interaction.member, reason);

    // Try to DM the user
    await target.user.send(`You have been warned in **${interaction.guild.name}**.\n**Reason:** ${reason}`).catch(() => {});

    await interaction.reply({
      embeds: [successEmbed(`**${target.user.tag}** has been warned.\n**Reason:** ${reason}\n**Total warnings:** ${count}`)],
    });
  },
};
