const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { startGiveaway } = require('../../systems/giveawaySystem');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('🎉 Manage giveaways')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('start')
        .setDescription('🚀 Start a new giveaway')
        .addStringOption(opt => 
          opt.setName('type')
            .setDescription('Type of giveaway')
            .setRequired(true)
            .addChoices(
              { name: 'Button (Click to Join)', value: 'button' },
              { name: 'XP Gainer (Most active chatter)', value: 'xp' },
              { name: 'Invite Gainer (Most invites)', value: 'invite' }
            ))
        .addStringOption(opt => opt.setName('prize').setDescription('What are you giving away?').setRequired(true))
        .addStringOption(opt => opt.setName('duration').setDescription('e.g. 10m, 1h, 1d').setRequired(true))
        .addIntegerOption(opt => opt.setName('winners').setDescription('Number of winners (default 1)'))
        .addIntegerOption(opt => opt.setName('min_invites').setDescription('Minimum invites required (for Invite mode)'))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      const type = interaction.options.getString('type');
      const prize = interaction.options.getString('prize');
      const durationStr = interaction.options.getString('duration');
      const winners = interaction.options.getInteger('winners') || 1;
      const minInvites = interaction.options.getInteger('min_invites') || 0;

      // Parse duration
      const durationMs = parseDuration(durationStr);
      if (!durationMs) {
        return interaction.reply({ content: '❌ Invalid duration format! Use 10m, 1h, 1d, etc.', ephemeral: true });
      }

      await startGiveaway(interaction, type, prize, durationMs, winners, minInvites);
    }
  },
};

function parseDuration(str) {
  const match = str.match(/^(\d+)([smhd])$/);
  if (!match) return null;
  const val = parseInt(match[1]);
  const unit = match[2];
  const multiplier = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };
  return val * multiplier[unit];
}
