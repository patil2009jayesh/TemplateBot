const { getAFKUser, disableAFK } = require('../services/userService');
const { isModuleEnabled } = require('../services/guildService');
const { EmbedBuilder } = require('discord.js');

// Cooldown set to prevent the AFK removal from firing twice in quick succession
// Key: userId-guildId → timestamp of last removal
const removalCooldown = new Map();

/**
 * Handle AFK detection on incoming messages.
 *
 * Two behaviours:
 *  1. If the message AUTHOR is AFK → remove their AFK and notify them
 *  2. If the message MENTIONS an AFK user → notify the sender
 *
 * This runs BEFORE automod so the reply is always delivered even if
 * automod later deletes the triggering message.
 */
async function handleAFKCheck(message) {
  if (!message.guild || message.author.bot) return;

  const guildId = message.guild.id;
  const userId = message.author.id;

  try {
    const enabled = await isModuleEnabled(guildId, 'afk');
    if (!enabled) return;
  } catch {
    return; // Guild not set up yet — skip silently
  }

  // ── 1. Remove AFK from the message author ─────────────────────────────────
  try {
    const cooldownKey = `${userId}-${guildId}`;
    const lastRemoval = removalCooldown.get(cooldownKey) || 0;
    const now = Date.now();

    // Skip if we already removed their AFK in the last 3 seconds (prevent double-fires)
    if (now - lastRemoval > 3000) {
      const authorAFK = await getAFKUser(userId, guildId);

      if (authorAFK && authorAFK.afk === true) {
        // Mark cooldown BEFORE the async DB call to prevent race conditions
        removalCooldown.set(cooldownKey, now);

        await disableAFK(userId, guildId);

        const afkSince = authorAFK.afk_since
          ? `<t:${Math.floor(new Date(authorAFK.afk_since).getTime() / 1000)}:R>`
          : null;

        const desc = afkSince
          ? `Welcome back, <@${userId}>! You were AFK ${afkSince}.`
          : `Welcome back, <@${userId}>! Your AFK status has been removed.`;

        const embed = new EmbedBuilder()
          .setColor(0x44ff88)
          .setDescription(desc);

        const reply = await message.reply({ embeds: [embed] }).catch(() => null);
        if (reply) setTimeout(() => reply.delete().catch(() => {}), 6000);

        // Clean up cooldown entry after 10 seconds
        setTimeout(() => removalCooldown.delete(cooldownKey), 10000);

        // No mention check if the author just returned from AFK — avoid spam
        return;
      }
    }
  } catch (err) {
    console.error('[AFK] Error checking author AFK:', err.message);
  }

  // ── 2. Check if any mentioned user is AFK ─────────────────────────────────
  if (message.mentions.users.size === 0) return;

  for (const mentioned of message.mentions.users.values()) {
    if (mentioned.bot || mentioned.id === userId) continue;

    try {
      const afkData = await getAFKUser(mentioned.id, guildId);
      if (!afkData || afkData.afk !== true) continue;

      const since = afkData.afk_since
        ? `<t:${Math.floor(new Date(afkData.afk_since).getTime() / 1000)}:R>`
        : 'some time ago';

      const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('💤 User is AFK')
        .setDescription(
          `<@${mentioned.id}> is currently AFK (${since})\n**Reason:** ${afkData.afk_reason || 'No reason provided'}`
        );

      await message.reply({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      console.error('[AFK] Error checking mention AFK:', err.message);
    }
  }
}

module.exports = { handleAFKCheck };
