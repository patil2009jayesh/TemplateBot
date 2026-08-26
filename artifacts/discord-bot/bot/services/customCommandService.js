const db = require('../database/sqlite');

/**
 * Add a custom command to a guild.
 */
async function addCustomCommand(guildId, name, response, createdBy) {
  const info = db.prepare(`
    INSERT INTO custom_commands (guild_id, name, response, created_by)
    VALUES (?, ?, ?, ?)
  `).run(guildId, name.toLowerCase(), response, createdBy);

  return { id: info.lastInsertRowid, guild_id: guildId, name: name.toLowerCase(), response, created_by: createdBy };
}

/**
 * Delete a custom command from a guild.
 */
async function deleteCustomCommand(guildId, name) {
  db.prepare(`
    DELETE FROM custom_commands 
    WHERE guild_id = ? AND name = ?
  `).run(guildId, name.toLowerCase());
}

/**
 * Get a specific custom command by name.
 */
async function getCustomCommand(guildId, name) {
  return db.prepare(`
    SELECT * FROM custom_commands 
    WHERE guild_id = ? AND name = ?
  `).get(guildId, name.toLowerCase()) || null;
}

/**
 * List all custom commands for a guild.
 */
async function listCustomCommands(guildId) {
  return db.prepare(`
    SELECT name, response FROM custom_commands 
    WHERE guild_id = ? 
    ORDER BY name
  `).all(guildId);
}

module.exports = {
  addCustomCommand,
  deleteCustomCommand,
  getCustomCommand,
  listCustomCommands,
};
