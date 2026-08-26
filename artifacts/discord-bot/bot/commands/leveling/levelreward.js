const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuild, updateGuildField } = require('../../services/guildService');
const { successEmbed, errorEmbed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('levelreward')
    .setDescription('Manage role rewards given automatically when a member reaches a level.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Give a role when a member reaches a specific level.')
        .addIntegerOption(o =>
          o.setName('level')
            .setDescription('Level required to earn the role (e.g. 5)')
            .setMinValue(1)
            .setMaxValue(500)
            .setRequired(true))
        .addRoleOption(o =>
          o.setName('role')
            .setDescription('Role to award')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove the role reward for a specific level.')
        .addIntegerOption(o =>
          o.setName('level')
            .setDescription('Level whose reward you want to remove')
            .setMinValue(1)
            .setMaxValue(500)
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Show all configured level rewards.')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const guildData = await getGuild(guildId);
    const levelRoles = Array.isArray(guildData.roles.levelRoles) ? guildData.roles.levelRoles : [];

    // ── ADD ─────────────────────────────────────────────────────────────────
    if (sub === 'add') {
      const level = interaction.options.getInteger('level');
      const role  = interaction.options.getRole('role');

      // Prevent @everyone
      if (role.id === interaction.guild.id) {
        return interaction.editReply({ embeds: [errorEmbed('You cannot use @everyone as a reward.')] });
      }

      // Prevent roles higher than the bot's highest role
      const botMember = interaction.guild.members.me;
      if (role.position >= botMember.roles.highest.position) {
        return interaction.editReply({
          embeds: [errorEmbed(`I can't assign **${role.name}** — it's higher than or equal to my highest role. Move my role above it first.`)],
        });
      }

      // Replace if a reward for this level already exists
      const filtered = levelRoles.filter(r => r.level !== level);
      filtered.push({ level, roleId: role.id });
      filtered.sort((a, b) => a.level - b.level);

      await updateGuildField(guildId, 'roles', { levelRoles: filtered });

      return interaction.editReply({
        embeds: [
          successEmbed(`**Level ${level} reward set!**\n\nMembers who reach level **${level}** will receive ${role}.`),
        ],
      });
    }

    // ── REMOVE ───────────────────────────────────────────────────────────────
    if (sub === 'remove') {
      const level = interaction.options.getInteger('level');
      const exists = levelRoles.some(r => r.level === level);

      if (!exists) {
        return interaction.editReply({ embeds: [errorEmbed(`No reward is set for level **${level}**.`)] });
      }

      const filtered = levelRoles.filter(r => r.level !== level);
      await updateGuildField(guildId, 'roles', { levelRoles: filtered });

      return interaction.editReply({
        embeds: [successEmbed(`Removed the role reward for level **${level}**.`)],
      });
    }

    // ── LIST ─────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      if (!levelRoles.length) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x5865f2)
              .setTitle('Level Rewards')
              .setDescription('No level rewards configured yet.\nUse `/levelreward add` to create one.'),
          ],
        });
      }

      const lines = levelRoles
        .sort((a, b) => a.level - b.level)
        .map(r => {
          const role = interaction.guild.roles.cache.get(r.roleId);
          return `**Level ${r.level}** → ${role ? role.toString() : `~~Deleted Role~~ (${r.roleId})`}`;
        });

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('🏆 Level Rewards')
            .setDescription(lines.join('\n'))
            .setFooter({ text: 'Rewards are cumulative — members keep all roles earned at lower levels.' }),
        ],
      });
    }
  },
};
