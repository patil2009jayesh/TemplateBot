const db = require('../database/sqlite');
const { EmbedBuilder } = require('discord.js');

let clientRef = null;

/**
 * Initialize the reminder system with the Discord client.
 * Starts a periodic check every 30 seconds.
 */
function initReminderSystem(client) {
  clientRef = client;
  setInterval(checkReminders, 30_000);
  console.log('[REMINDERS] Reminder system started.');
}

/**
 * Check for due reminders and send them.
 */
async function checkReminders() {
  if (!clientRef) return;

  try {
    const now = new Date().toISOString();
    const reminders = db.prepare('SELECT * FROM reminders WHERE remind_at <= ?').all(now);

    if (!reminders?.length) return;

    for (const reminder of reminders) {
      try {
        const channel = await clientRef.channels.fetch(reminder.channel_id).catch(() => null);
        if (channel) {
          const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('⏰ Reminder!')
            .setDescription(`<@${reminder.user_id}>, you asked me to remind you:\n\n**${reminder.message}**`)
            .setTimestamp();
          await channel.send({ embeds: [embed] }).catch(() => {});
        }
      } catch {}

      // Delete the reminder after sending
      db.prepare('DELETE FROM reminders WHERE id = ?').run(reminder.id);
    }
  } catch (err) {
    console.error('[REMINDERS] Error checking reminders:', err.message);
  }
}

/**
 * Create a new reminder.
 */
async function createReminder(userId, guildId, channelId, message, remindAt) {
  const result = db.prepare(`
    INSERT INTO reminders (user_id, channel_id, message, remind_at)
    VALUES (?, ?, ?, ?)
  `).run(userId, channelId, message, remindAt);
  
  return {
    id: result.lastInsertRowid,
    user_id: userId,
    channel_id: channelId,
    message,
    remind_at: remindAt
  };
}

module.exports = { initReminderSystem, createReminder };
