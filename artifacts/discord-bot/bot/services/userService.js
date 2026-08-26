const db = require('../database/sqlite');
const { getLevelFromXP } = require('../utils/helpers');

/**
 * Get or create a user record for the given guild.
 */
async function getUser(userId, guildId) {
  let row = db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?').get(userId, guildId);

  if (!row) {
    return createUser(userId, guildId);
  }
  
  return row;
}

const defaultUser = { xp: 0, level: 0, afk: 0, afk_reason: null, afk_since: null };

/**
 * Create a new user record with 0 XP and level 0.
 */
async function createUser(userId, guildId, extra = {}) {
  const data = { ...defaultUser, ...extra, user_id: userId, guild_id: guildId };
  
  db.prepare('INSERT INTO users (user_id, guild_id, xp, level, afk, afk_reason, afk_since, username, display_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(userId, guildId, data.xp, data.level, data.afk, data.afk_reason, data.afk_since, data.username || null, data.display_name || null);
    
  return data;
}

/**
 * Add XP to a user. Returns { user, leveledUp, newLevel }.
 */
async function addXP(userId, guildId, xpAmount) {
  const user = await getUser(userId, guildId);
  const oldLevel = user.level;
  const newXP = user.xp + xpAmount;
  const newLevel = getLevelFromXP(newXP);

  db.prepare('UPDATE users SET xp = ?, level = ? WHERE user_id = ? AND guild_id = ?')
    .run(newXP, newLevel, userId, guildId);

  user.xp = newXP;
  user.level = newLevel;

  return {
    user,
    leveledUp: newLevel > oldLevel,
    newLevel,
    oldLevel,
  };
}

/**
 * Get the leaderboard for a guild (top N users by XP).
 */
async function getLeaderboard(guildId, limit = 10) {
  return db.prepare('SELECT user_id, xp, level FROM users WHERE guild_id = ? ORDER BY xp DESC LIMIT ?')
    .all(guildId, limit);
}

/**
 * Get a user's rank position in a guild.
 */
async function getUserRank(userId, guildId) {
  const allUsers = db.prepare('SELECT user_id, xp FROM users WHERE guild_id = ? ORDER BY xp DESC').all(guildId);
  const rank = allUsers.findIndex(u => u.user_id === userId);
  return rank === -1 ? null : rank + 1;
}

/**
 * Enable AFK for a user.
 */
async function enableAFK(userId, guildId, reason) {
  const row = db.prepare('SELECT 1 FROM users WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
  const now = new Date().toISOString();

  if (row) {
    db.prepare('UPDATE users SET afk = 1, afk_reason = ?, afk_since = ? WHERE user_id = ? AND guild_id = ?')
      .run(reason, now, userId, guildId);
  } else {
    try {
      db.prepare('INSERT INTO users (user_id, guild_id, afk, afk_reason, afk_since) VALUES (?, ?, 1, ?, ?)')
        .run(userId, guildId, reason, now);
    } catch {
       db.prepare('UPDATE users SET afk = 1, afk_reason = ?, afk_since = ? WHERE user_id = ? AND guild_id = ?').run(reason, now, userId, guildId);
    }
  }
}

/**
 * Disable AFK for a user.
 */
async function disableAFK(userId, guildId) {
  db.prepare('UPDATE users SET afk = 0, afk_reason = NULL, afk_since = NULL WHERE user_id = ? AND guild_id = ?')
    .run(userId, guildId);
}

/**
 * Get AFK state for a user. Returns null if no record found, or afk=0.
 */
async function getAFKUser(userId, guildId) {
  const row = db.prepare('SELECT afk, afk_reason, afk_since FROM users WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
  if (!row || row.afk === 0) return null;
  return row;
}

module.exports = {
  getUser,
  createUser,
  addXP,
  getLeaderboard,
  getUserRank,
  enableAFK,
  disableAFK,
  getAFKUser,
};
