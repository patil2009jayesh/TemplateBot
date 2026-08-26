const { EmbedBuilder } = require('discord.js');
const { getGuild, isModuleEnabled } = require('../services/guildService');
const { formatMessage } = require('../utils/helpers');

/**
 * Handle a new member joining the guild.
 */
async function handleMemberJoin(member) {
  const { guild } = member;

  const enabled = await isModuleEnabled(guild.id, 'welcome');
  if (!enabled) return;

  const guildData = await getGuild(guild.id);
  const welcomeSettings = guildData.settings.welcome;
  const welcomeChannelId = guildData.channels.welcome;

  if (!welcomeChannelId) return;

  const channel = guild.channels.cache.get(welcomeChannelId);
  if (!channel) return;

  const vars = {
    user: `<@${member.id}>`,
    server: guild.name,
    memberCount: guild.memberCount,
    inviter: 'Unknown',
  };

  const delay = (welcomeSettings.delay || 0) * 1000;

  const sendWelcome = async () => {
    if (welcomeSettings.embed) {
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`Welcome to ${guild.name}!`)
        .setDescription(formatMessage(welcomeSettings.message, vars))
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `Member #${guild.memberCount}` })
        .setTimestamp();
      await channel.send({ embeds: [embed] }).catch(() => {});
    } else {
      await channel.send(formatMessage(welcomeSettings.message, vars)).catch(() => {});
    }

    // DM the user if configured
    if (welcomeSettings.dm) {
      const dmMsg = formatMessage(welcomeSettings.message, vars);
      await member.user.send(dmMsg).catch(() => {});
    }
  };

  if (delay > 0) {
    setTimeout(sendWelcome, delay);
  } else {
    await sendWelcome();
  }
}

/**
 * Handle a member leaving the guild.
 */
async function handleMemberLeave(member) {
  const { guild } = member;

  const enabled = await isModuleEnabled(guild.id, 'welcome');
  if (!enabled) return;

  const guildData = await getGuild(guild.id);
  const leaveSettings = guildData.settings.leave;
  const leaveChannelId = guildData.channels.leave;

  if (!leaveChannelId) return;

  const channel = guild.channels.cache.get(leaveChannelId);
  if (!channel) return;

  const vars = {
    user: member.user.tag,
    server: guild.name,
    memberCount: guild.memberCount,
  };

  if (leaveSettings.embed) {
    const embed = new EmbedBuilder()
      .setColor(0xff4444)
      .setTitle('Member Left')
      .setDescription(formatMessage(leaveSettings.message, vars))
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();
    await channel.send({ embeds: [embed] }).catch(() => {});
  } else {
    await channel.send(formatMessage(leaveSettings.message, vars)).catch(() => {});
  }
}

module.exports = { handleMemberJoin, handleMemberLeave };
