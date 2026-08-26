const { EmbedBuilder, MessageFlags } = require('discord.js');

/**
 * Calculate level from total XP using a standard curve.
 * Formula: level = floor(0.1 * sqrt(xp))
 */
function getLevelFromXP(xp) {
  return Math.floor(0.1 * Math.sqrt(xp));
}

/**
 * Calculate total XP required to reach a given level.
 * Inverse: xp = (level / 0.1)^2 = (level * 10)^2
 */
function getXPForLevel(level) {
  return Math.pow(level * 10, 2);
}

/**
 * Build a clean error embed.
 */
function errorEmbed(message) {
  return new EmbedBuilder()
    .setColor(0xff4444)
    .setDescription(`❌ ${message}`);
}

/**
 * Build a success embed.
 */
function successEmbed(message) {
  return new EmbedBuilder()
    .setColor(0x44ff88)
    .setDescription(`✅ ${message}`);
}

/**
 * Build an info embed with a title.
 */
function infoEmbed(title, description, color = 0x5865f2) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description);
}

/**
 * Send an ephemeral error reply. Uses MessageFlags to avoid the
 * discord.js v14 deprecation warning for { ephemeral: true }.
 */
async function replyError(interaction, message) {
  const payload = {
    embeds: [errorEmbed(message)],
    flags: MessageFlags.Ephemeral,
  };
  if (interaction.replied || interaction.deferred) {
    return interaction.followUp(payload).catch(() => {});
  }
  return interaction.reply(payload).catch(() => {});
}

/**
 * Detect a Supabase "table not found in schema cache" error and return
 * a human-friendly message. Returns null if it's a different error.
 */
function getDBErrorMessage(err) {
  const msg = err?.message || '';
  if (msg.includes('schema cache') || msg.includes('relation') || msg.includes('does not exist')) {
    return (
      '**Database tables are not set up yet.**\n\n' +
      'Please run the SQL schema in your Supabase dashboard:\n' +
      '1. Go to **Supabase → SQL Editor → New query**\n' +
      '2. Paste the contents of `artifacts/discord-bot/bot/database/schema.sql`\n' +
      '3. Click **Run**\n\n' +
      'Then try this command again.'
    );
  }
  return `Database error: ${msg}`;
}

/**
 * Replace template variables in a welcome/leave message string.
 */
function formatMessage(template, vars) {
  return template
    .replace(/{user}/g, vars.user || '')
    .replace(/{server}/g, vars.server || '')
    .replace(/{memberCount}/g, vars.memberCount || '')
    .replace(/{inviter}/g, vars.inviter || 'Unknown');
}

/**
 * Parse a duration string like "10m", "2h", "1d" into milliseconds.
 * Returns null if invalid.
 */
function parseDuration(str) {
  const match = str.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;
  const value = parseInt(match[1]);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * multipliers[unit];
}

/**
 * Format milliseconds into a human-readable duration string.
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

/**
 * Check if a member has admin/management permissions.
 */
function hasAdminPermission(member) {
  return (
    member.permissions.has('Administrator') ||
    member.permissions.has('ManageGuild')
  );
}

/**
 * Check if a member is the guild owner.
 */
function isOwner(member) {
  return member.guild.ownerId === member.id;
}

module.exports = {
  getLevelFromXP,
  getXPForLevel,
  errorEmbed,
  successEmbed,
  infoEmbed,
  replyError,
  getDBErrorMessage,
  formatMessage,
  parseDuration,
  formatDuration,
  hasAdminPermission,
  isOwner,
};
