const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { errorEmbed } = require('../../utils/helpers');
const { getWarnings } = require('../../services/warningService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View warnings for a member.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('Member to check').setRequired(true)),

  async execute(interaction) {
    const target = interaction.options.getUser('user');
    const warnings = await getWarnings(target.id, interaction.guild.id);

    if (warnings.length === 0) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x44ff88)
            .setDescription(`✅ **${target.tag}** has no warnings.`),
        ],
      });
    }

    const lines = warnings.map((w, i) => {
      const date = new Date(w.created_at).toLocaleDateString();
      return `**${i + 1}.** ${w.reason} — <@${w.moderator_id}> • ${date}`;
    });

    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle(`Warnings for ${target.tag}`)
      .setDescription(lines.join('\n'))
      .setFooter({ text: `Total: ${warnings.length}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
