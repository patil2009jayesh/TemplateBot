const db = require('../database/sqlite');

/**
 * Add a warning for a user in a guild.
 */
async function addWarning(userId, guildId, moderatorId, reason) {
  const timestamp = new Date().toISOString();
  const info = db.prepare(`
    INSERT INTO warnings (user_id, guild_id, moderator_id, reason, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, guildId, moderatorId, reason, timestamp);
  
  return { id: info.lastInsertRowid, user_id: userId, guild_id: guildId, moderator_id: moderatorId, reason, timestamp };
}

/**
 * Get all warnings for a user in a guild.
 */
async function getWarnings(userId, guildId) {
  return db.prepare(`
    SELECT * FROM warnings 
    WHERE user_id = ? AND guild_id = ? 
    ORDER BY timestamp DESC
  `).all(userId, guildId);
}

/**
 * Get warning count for a user in a guild.
 */
async function getWarningCount(userId, guildId) {
  const row = db.prepare(`
    SELECT COUNT(*) as count FROM warnings 
    WHERE user_id = ? AND guild_id = ?
  `).get(userId, guildId);
  return row ? row.count : 0;
}

/**
 * Clear all warnings for a user in a guild.
 */
async function clearWarnings(userId, guildId) {
  db.prepare(`
    DELETE FROM warnings 
    WHERE user_id = ? AND guild_id = ?
  `).run(userId, guildId);
}

module.exports = { addWarning, getWarnings, getWarningCount, clearWarnings };
