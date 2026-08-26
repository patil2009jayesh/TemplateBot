const db = require('../database/sqlite');

/**
 * Get or create an invite record for a user in a guild.
 */
async function getInviteRecord(userId, guildId) {
  let data = db.prepare('SELECT * FROM invites WHERE user_id = ? AND guild_id = ?').get(userId, guildId);

  if (!data) {
    const info = db.prepare(`
      INSERT INTO invites (user_id, guild_id)
      VALUES (?, ?)
    `).run(userId, guildId);
    
    data = {
      id: info.lastInsertRowid,
      user_id: userId,
      guild_id: guildId,
      inviter_id: null,
      invites_count: 0,
      fake_invites: 0,
      left_invites: 0
    };
  }
  return data;
}

/**
 * Increment invite count for an inviter.
 */
async function incrementInvites(inviterId, guildId) {
  const rec = await getInviteRecord(inviterId, guildId);
  db.prepare(`
    UPDATE invites SET invites_count = ? 
    WHERE user_id = ? AND guild_id = ?
  `).run(rec.invites_count + 1, inviterId, guildId);

  // Track for active Invite giveaways
  try {
    const { recordGiveawayActivity } = require('../systems/giveawaySystem');
    recordGiveawayActivity(guildId, inviterId, 'invite', 1);
  } catch (err) { }
}

/**
 * Increment left (fake) invites when a member leaves.
 */
async function incrementLeftInvites(inviterId, guildId) {
  const rec = await getInviteRecord(inviterId, guildId);
  db.prepare(`
    UPDATE invites SET left_invites = ? 
    WHERE user_id = ? AND guild_id = ?
  `).run(rec.left_invites + 1, inviterId, guildId);
}

/**
 * Set the inviter for a new member.
 */
async function setInviter(userId, guildId, inviterId) {
  db.prepare(`
    INSERT INTO invites (user_id, guild_id, inviter_id)
    VALUES (?, ?, ?)
    ON CONFLICT(guild_id, user_id) DO UPDATE SET
      inviter_id = excluded.inviter_id
  `).run(userId, guildId, inviterId);
}

/**
 * Get invite leaderboard for a guild.
 */
async function getInviteLeaderboard(guildId, limit = 10) {
  return db.prepare(`
    SELECT user_id, invites_count, fake_invites, left_invites 
    FROM invites 
    WHERE guild_id = ? 
    ORDER BY invites_count DESC 
    LIMIT ?
  `).all(guildId, limit);
}

module.exports = {
  getInviteRecord,
  incrementInvites,
  incrementLeftInvites,
  setInviter,
  getInviteLeaderboard,
};
