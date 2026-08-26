const { Events } = require('discord.js');
const { handleXP } = require('../systems/levelingSystem');
const { handleAFKCheck } = require('../systems/afkSystem');
const { handleAutomod } = require('../systems/moderationSystem');
module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (!message.guild || message.author.bot) return;

    // Track user display name and username
    try {
      const db = require('../database/sqlite');
      const displayName = message.member?.displayName || message.author.displayName || null;
      db.prepare(`
        INSERT INTO users (user_id, guild_id, username, display_name, xp, level, afk)
        VALUES (?, ?, ?, ?, 0, 0, 0)
        ON CONFLICT(user_id, guild_id) DO UPDATE SET
          username = excluded.username,
          display_name = excluded.display_name
      `).run(message.author.id, message.guild.id, message.author.username, displayName);
    } catch (err) { }

    // 1. AFK check runs FIRST — before automod which may delete the message.
    await handleAFKCheck(message).catch(err =>
      console.error('[EVT] AFK check error:', err.message)
    );

    // 2. Automod + XP + Giveaway Tracking run in parallel
    const { recordGiveawayActivity } = require('../systems/giveawaySystem');
    
    await Promise.allSettled([
      handleAutomod(message),
      handleXP(message),
      recordGiveawayActivity(message.guild.id, message.author.id, 'xp', 1)
    ]);
  },
};
