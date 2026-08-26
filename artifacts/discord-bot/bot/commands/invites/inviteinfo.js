const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getInviteRecord } = require('../../services/inviteService');
const { getDBErrorMessage } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inviteinfo')
    .setDescription('View who invited a member.')
    .addUserOption(o => o.setName('user').setDescription('Member to check').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser('user');

    let record;
    try {
      record = await getInviteRecord(target.id, interaction.guild.id);
    } catch (err) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff4444)
            .setDescription(`❌ ${getDBErrorMessage(err)}`),
        ],
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`Invite Info — ${target.username}`)
      .setThumbnail(target.displayAvatarURL());

    if (record.inviter_id) {
      const inviter = await interaction.client.users.fetch(record.inviter_id).catch(() => null);
      embed.setDescription(
        `**${target.username}** was invited by ${inviter ? `**${inviter.tag}** (<@${inviter.id}>)` : `Unknown user (ID: ${record.inviter_id})`}`
      );
    } else {
      embed.setDescription(`No invite data found for **${target.username}**.\nThey may have joined before invite tracking was set up.`);
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
