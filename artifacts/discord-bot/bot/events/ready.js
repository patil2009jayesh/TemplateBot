const { Events, ActivityType } = require('discord.js');
const { cacheInvites } = require('../systems/inviteSystem');
const { initReminderSystem } = require('../systems/reminderSystem');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`[BOT] Logged in as ${client.user.tag}`);
    console.log(`[BOT] Serving ${client.guilds.cache.size} guild(s)`);

    // Cache invites for all guilds
    for (const guild of client.guilds.cache.values()) {
      await cacheInvites(guild).catch(() => {});
    }

    // Start background systems
    const { initGiveaways } = require('../systems/giveawaySystem');
    initReminderSystem(client);
    initGiveaways(client);

    // Set bot activity
    client.user.setPresence({
      activities: [{ name: 'Tachos Dev | /help', type: ActivityType.Watching }],
      status: 'online',
    });
  },
};
