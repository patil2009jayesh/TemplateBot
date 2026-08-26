const { EmbedBuilder } = require('discord.js');
const { addXP } = require('../services/userService');
const { getGuild, isModuleEnabled } = require('../services/guildService');
const { getXPForLevel } = require('../utils/helpers');

// In-memory XP cooldown map: key = `${userId}-${guildId}`
const xpCooldowns = new Map();

/**
 * Handle XP gain for a message.
 * Called from the messageCreate event.
 */
async function handleXP(message) {
  if (!message.guild || message.author.bot) return;

  const { guild, author, channel } = message;
  const guildId = guild.id;
  const userId = author.id;

  // Check if leveling module is enabled
  const enabled = await isModuleEnabled(guildId, 'leveling');
  if (!enabled) return;

  const guildData = await getGuild(guildId);
  const lvlSettings = guildData.settings.leveling;

  // Check if channel is blacklisted
  if (lvlSettings.blacklistedChannels?.includes(channel.id)) return;

  // Cooldown check
  const cooldownKey = `${userId}-${guildId}`;
  const now = Date.now();
  const lastTime = xpCooldowns.get(cooldownKey) || 0;
  const cooldownMs = (lvlSettings.cooldown || 60) * 1000;

  if (now - lastTime < cooldownMs) return;

  // Set cooldown
  xpCooldowns.set(cooldownKey, now);

  // Random XP in range
  const xpMin = lvlSettings.xpMin || 15;
  const xpMax = lvlSettings.xpMax || 25;
  const xpGain = Math.floor(Math.random() * (xpMax - xpMin + 1)) + xpMin;

  // Add XP and check for level up
  const result = await addXP(userId, guildId, xpGain);

  if (result.leveledUp) {
    await sendLevelUpMessage(message, guildData, result.newLevel);
    await applyLevelRoles(message.member, guild, guildData, result.newLevel);
  }
}

/**
 * Send the level-up notification.
 */
async function sendLevelUpMessage(message, guildData, newLevel) {
  const lvlSettings = guildData.settings.leveling;
  const levelLogs = guildData.channels.levelLogs;

  const msgText = (lvlSettings.levelUpMessage || 'Congratulations {user}! You reached level **{level}**!')
    .replace(/{user}/g, `<@${message.author.id}>`)
    .replace(/{level}/g, newLevel);

  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle('Level Up!')
    .setDescription(msgText)
    .setThumbnail(message.author.displayAvatarURL())
    .setTimestamp();

  // Send in level log channel if configured, otherwise in current channel
  const targetChannel = levelLogs
    ? message.guild.channels.cache.get(levelLogs) || message.channel
    : message.channel;

  await targetChannel.send({ embeds: [embed] }).catch(() => {});
}

/**
 * Give level roles to a member if configured.
 */
async function applyLevelRoles(member, guild, guildData, level) {
  const levelRoles = guildData.roles.levelRoles || [];
  for (const reward of levelRoles) {
    if (reward.level <= level) {
      const role = guild.roles.cache.get(reward.roleId);
      if (role && !member.roles.cache.has(role.id)) {
        await member.roles.add(role).catch(() => {});
      }
    }
  }
}

module.exports = { handleXP };
