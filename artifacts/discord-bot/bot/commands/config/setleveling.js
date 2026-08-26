const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { updateGuildSetting, getGuild } = require('../../services/guildService');
const { successEmbed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setleveling')
    .setDescription('Configure the leveling system.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('xprange')
        .setDescription('Set the XP range per message.')
        .addIntegerOption(o => o.setName('min').setDescription('Minimum XP').setMinValue(1).setMaxValue(100).setRequired(true))
        .addIntegerOption(o => o.setName('max').setDescription('Maximum XP').setMinValue(1).setMaxValue(100).setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('cooldown')
        .setDescription('Set XP cooldown in seconds.')
        .addIntegerOption(o => o.setName('seconds').setDescription('Cooldown in seconds').setMinValue(0).setMaxValue(300).setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('levelmessage')
        .setDescription('Set the level-up message. Variables: {user} {level}')
        .addStringOption(o => o.setName('text').setDescription('Level-up message').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('levelrole')
        .setDescription('Add a role reward at a specific level.')
        .addIntegerOption(o => o.setName('level').setDescription('Level required').setMinValue(1).setRequired(true))
        .addRoleOption(o => o.setName('role').setDescription('Role to award').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('blacklist')
        .setDescription('Blacklist or unblacklist a channel from giving XP.')
        .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View current leveling settings.')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'xprange') {
      const min = interaction.options.getInteger('min');
      const max = interaction.options.getInteger('max');
      if (min > max) return interaction.reply({ content: 'Min must be less than max.', ephemeral: true });
      await updateGuildSetting(guildId, 'leveling', { xpMin: min, xpMax: max });
      return interaction.reply({ embeds: [successEmbed(`XP range set to **${min}–${max}** per message.`)] });
    }

    if (sub === 'cooldown') {
      const seconds = interaction.options.getInteger('seconds');
      await updateGuildSetting(guildId, 'leveling', { cooldown: seconds });
      return interaction.reply({ embeds: [successEmbed(`XP cooldown set to **${seconds}s**.`)] });
    }

    if (sub === 'levelmessage') {
      const text = interaction.options.getString('text');
      await updateGuildSetting(guildId, 'leveling', { levelUpMessage: text });
      return interaction.reply({ embeds: [successEmbed(`Level-up message updated!`)] });
    }

    if (sub === 'levelrole') {
      const level = interaction.options.getInteger('level');
      const role = interaction.options.getRole('role');
      const guildData = await getGuild(guildId);
      const roles = guildData.roles.levelRoles || [];
      const filtered = roles.filter(r => r.level !== level);
      filtered.push({ level, roleId: role.id });
      const { updateGuildField } = require('../../services/guildService');
      await updateGuildField(guildId, 'roles', { levelRoles: filtered });
      return interaction.reply({ embeds: [successEmbed(`Level role set: Reach level **${level}** → ${role}.`)] });
    }

    if (sub === 'blacklist') {
      const channel = interaction.options.getChannel('channel');
      const guildData = await getGuild(guildId);
      const blacklisted = guildData.settings.leveling.blacklistedChannels || [];
      let msg;
      if (blacklisted.includes(channel.id)) {
        const updated = blacklisted.filter(id => id !== channel.id);
        await updateGuildSetting(guildId, 'leveling', { blacklistedChannels: updated });
        msg = `${channel} has been **removed** from the XP blacklist.`;
      } else {
        blacklisted.push(channel.id);
        await updateGuildSetting(guildId, 'leveling', { blacklistedChannels: blacklisted });
        msg = `${channel} has been **added** to the XP blacklist.`;
      }
      return interaction.reply({ embeds: [successEmbed(msg)] });
    }

    if (sub === 'view') {
      const guildData = await getGuild(guildId);
      const s = guildData.settings.leveling;
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('Leveling Settings')
        .addFields(
          { name: 'XP Range', value: `${s.xpMin}–${s.xpMax}`, inline: true },
          { name: 'Cooldown', value: `${s.cooldown}s`, inline: true },
          { name: 'Level-up Message', value: s.levelUpMessage },
          { name: 'Blacklisted Channels', value: s.blacklistedChannels.length ? s.blacklistedChannels.map(id => `<#${id}>`).join(', ') : 'None' }
        );
      return interaction.reply({ embeds: [embed] });
    }
  },
};
