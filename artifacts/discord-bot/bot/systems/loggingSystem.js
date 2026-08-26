const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getGuild, isModuleEnabled } = require('../services/guildService');

/**
 * Send a log embed to the configured log channel.
 */
async function sendLog(guild, channelKey, embed) {
  try {
    const guildData = await getGuild(guild.id);
    const channelId = guildData.channels[channelKey];
    if (!channelId) return;

    const channel = guild.channels.cache.get(channelId);
    if (!channel) return;

    await channel.send({ embeds: [embed] });
  } catch {
    // Silent — logging must never crash the bot
  }
}

/**
 * Log a message edit.
 */
async function logMessageEdit(oldMessage, newMessage) {
  if (!oldMessage.guild || oldMessage.author?.bot) return;
  if (!await isModuleEnabled(oldMessage.guild.id, 'logging')) return;
  if (oldMessage.content === newMessage.content) return;

  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle('Message Edited')
    .addFields(
      { name: 'Author', value: `${oldMessage.author.tag} (${oldMessage.author.id})` },
      { name: 'Channel', value: `<#${oldMessage.channel.id}>` },
      { name: 'Before', value: (oldMessage.content || '*empty*').slice(0, 1000) },
      { name: 'After', value: (newMessage.content || '*empty*').slice(0, 1000) }
    )
    .setTimestamp();

  await sendLog(oldMessage.guild, 'logs', embed);
}

/**
 * Log a message deletion.
 */
async function logMessageDelete(message) {
  if (!message.guild || message.author?.bot) return;
  if (!await isModuleEnabled(message.guild.id, 'logging')) return;

  const embed = new EmbedBuilder()
    .setColor(0xff4444)
    .setTitle('Message Deleted')
    .addFields(
      { name: 'Author', value: `${message.author?.tag || 'Unknown'} (${message.author?.id || 'Unknown'})` },
      { name: 'Channel', value: `<#${message.channel.id}>` },
      { name: 'Content', value: (message.content || '*empty*').slice(0, 1000) }
    )
    .setTimestamp();

  await sendLog(message.guild, 'logs', embed);
}

/**
 * Log a member joining.
 */
async function logMemberJoin(member) {
  if (!await isModuleEnabled(member.guild.id, 'logging')) return;

  const embed = new EmbedBuilder()
    .setColor(0x44ff88)
    .setTitle('Member Joined')
    .setThumbnail(member.user.displayAvatarURL())
    .addFields(
      { name: 'User', value: `${member.user.tag} (${member.id})` },
      { name: 'Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>` },
      { name: 'Member Count', value: `${member.guild.memberCount}` }
    )
    .setTimestamp();

  await sendLog(member.guild, 'logs', embed);
}

/**
 * Log a member leaving.
 */
async function logMemberLeave(member) {
  if (!await isModuleEnabled(member.guild.id, 'logging')) return;

  const embed = new EmbedBuilder()
    .setColor(0xff4444)
    .setTitle('Member Left')
    .setThumbnail(member.user.displayAvatarURL())
    .addFields(
      { name: 'User', value: `${member.user.tag} (${member.id})` },
      { name: 'Roles', value: member.roles.cache.filter(r => r.id !== member.guild.id).map(r => `<@&${r.id}>`).join(', ') || 'None' }
    )
    .setTimestamp();

  await sendLog(member.guild, 'logs', embed);
}

/**
 * Log a moderation action (ban, kick, etc).
 */
async function logModAction(guild, action, target, moderator, reason) {
  if (!await isModuleEnabled(guild.id, 'logging')) return;

  const colorMap = { ban: 0xff0000, kick: 0xff9900, warn: 0xf1c40f, unban: 0x44ff88, timeout: 0xffa500 };

  const embed = new EmbedBuilder()
    .setColor(colorMap[action] || 0x5865f2)
    .setTitle(`Moderation: ${action.toUpperCase()}`)
    .addFields(
      { name: 'Target', value: `${target.tag || target.user?.tag || target} (${target.id})`, inline: true },
      { name: 'Moderator', value: `${moderator.tag || moderator.user?.tag || moderator}`, inline: true },
      { name: 'Reason', value: reason || 'No reason provided' }
    )
    .setTimestamp();

  await sendLog(guild, 'modLogs', embed);
}

module.exports = {
  logMessageEdit,
  logMessageDelete,
  logMemberJoin,
  logMemberLeave,
  logModAction,
};
