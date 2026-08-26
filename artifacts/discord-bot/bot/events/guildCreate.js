const { Events } = require('discord.js');
const { getGuild } = require('../services/guildService');
const { cacheInvites } = require('../systems/inviteSystem');

module.exports = {
  name: Events.GuildCreate,
  async execute(guild) {
    console.log(`[BOT] Joined guild: ${guild.name} (${guild.id})`);
    // Initialize guild config in DB
    await getGuild(guild.id).catch(console.error);
    // Cache invites
    await cacheInvites(guild).catch(() => {});
  },
};
