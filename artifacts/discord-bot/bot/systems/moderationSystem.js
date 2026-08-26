const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuild, isModuleEnabled } = require('../services/guildService');
const { addWarning, getWarningCount } = require('../services/warningService');

// Anti-spam tracking: userId -> { count, resetAt }
const spamTracker = new Map();
// Anti-duplicate: userId -> last message content
const duplicateTracker = new Map();

/**
 * Main automod handler — called from messageCreate.
 */
async function handleAutomod(message) {
  if (!message.guild || message.author.bot) return;
  if (message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) return;

  const guildId = message.guild.id;
  const enabled = await isModuleEnabled(guildId, 'moderation');
  if (!enabled) return;

  const guildData = await getGuild(guildId);
  const automod = guildData.settings.automod;

  // Anti-spam
  if (automod.antiSpam) {
    const spammed = await checkSpam(message);
    if (spammed) {
      await punish(message, 'Spam detected', automod.punishment, guildData);
      return;
    }
  }

  // Anti-duplicate
  if (automod.antiDuplicate) {
    const key = `${message.author.id}-${guildId}`;
    const last = duplicateTracker.get(key);
    if (last && last === message.content && message.content.length > 5) {
      duplicateTracker.set(key, message.content);
      await punish(message, 'Duplicate message detected', automod.punishment, guildData);
      return;
    }
    duplicateTracker.set(key, message.content);
  }

  // Anti-links
  if (automod.antiLinks) {
    const urlRegex = /(https?:\/\/|www\.)\S+/gi;
    if (urlRegex.test(message.content)) {
      await message.delete().catch(() => {});
      await punish(message, 'Links are not allowed', automod.punishment, guildData);
      return;
    }
  }

  // Anti-caps (>70% caps and >10 chars)
  if (automod.antiCaps && message.content.length > 10) {
    const caps = message.content.replace(/[^A-Z]/g, '').length;
    const ratio = caps / message.content.replace(/\s/g, '').length;
    if (ratio > 0.7) {
      await message.delete().catch(() => {});
      await punish(message, 'Excessive caps', automod.punishment, guildData);
      return;
    }
  }

  // Bad word filter
  if (automod.badWords && automod.badWords.length > 0) {
    const lowerContent = message.content.toLowerCase();
    const found = automod.badWords.some(word => lowerContent.includes(word.toLowerCase()));
    if (found) {
      await message.delete().catch(() => {});
      await punish(message, 'Prohibited language', automod.punishment, guildData);
      return;
    }
  }

  // Mention spam
  if (message.mentions.users.size >= (automod.mentionLimit || 5)) {
    await message.delete().catch(() => {});
    await punish(message, 'Mention spam', automod.punishment, guildData);
  }
}

/**
 * Check if a user is spamming (5 messages in 5 seconds).
 */
async function checkSpam(message) {
  const key = `${message.author.id}-${message.guild.id}`;
  const now = Date.now();
  const data = spamTracker.get(key) || { count: 0, resetAt: now + 5000 };

  if (now > data.resetAt) {
    spamTracker.set(key, { count: 1, resetAt: now + 5000 });
    return false;
  }

  data.count++;
  spamTracker.set(key, data);

  if (data.count >= 5) {
    spamTracker.delete(key);
    return true;
  }
  return false;
}

/**
 * Apply the configured automod punishment.
 */
async function punish(message, reason, punishment, guildData) {
  const { member, guild } = message;
  if (!member) return;

  // Always warn the user
  const warnCount = await addWarning(member.id, guild.id, guild.members.me?.id || 'bot', reason)
    .then(() => getWarningCount(member.id, guild.id))
    .catch(() => 0);

  const reply = await message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xff4444)
        .setTitle('⚠️ AutoMod Action')
        .setDescription(`${member} has been warned: **${reason}**\nTotal warnings: ${warnCount}`),
    ],
  }).catch(() => {});

  if (reply) setTimeout(() => reply.delete().catch(() => {}), 8000);

  // Apply extra punishment if configured
  if (punishment === 'timeout') {
    await member.timeout(5 * 60 * 1000, reason).catch(() => {});
  } else if (punishment === 'kick') {
    await member.kick(reason).catch(() => {});
  } else if (punishment === 'ban') {
    await member.ban({ reason, deleteMessageSeconds: 60 }).catch(() => {});
  }

  // Log to mod logs
  const modLogsId = guildData.channels.modLogs;
  if (modLogsId) {
    const logChannel = guild.channels.cache.get(modLogsId);
    if (logChannel) {
      await logChannel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff9900)
            .setTitle('AutoMod Action')
            .addFields(
              { name: 'User', value: `${member.user.tag} (${member.id})`, inline: true },
              { name: 'Reason', value: reason, inline: true },
              { name: 'Action', value: punishment || 'warn', inline: true }
            )
            .setTimestamp(),
        ],
      }).catch(() => {});
    }
  }
}

module.exports = { handleAutomod };
