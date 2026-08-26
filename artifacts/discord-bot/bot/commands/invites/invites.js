const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getInviteRecord } = require('../../services/inviteService');
const { getDBErrorMessage } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invites')
    .setDescription('Check your invite count.')
    .addUserOption(o => o.setName('user').setDescription('User to check invites for')),

  async execute(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser('user') || interaction.user;

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

    const real = record.invites_count - record.left_invites - record.fake_invites;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`${target.username}'s Invites`)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: '📨 Total Invited',  value: `${record.invites_count}`, inline: true },
        { name: '✅ Real Invites',   value: `${Math.max(0, real)}`,    inline: true },
        { name: '🚪 Left',           value: `${record.left_invites}`,  inline: true },
        { name: '🚫 Fake',           value: `${record.fake_invites}`,  inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
