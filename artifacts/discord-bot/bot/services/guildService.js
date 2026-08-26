const db = require('../database/sqlite');

/**
 * Default guild configuration values.
 */
const defaultGuild = {
  modules: {
    leveling: true,
    invites: true,
    welcome: true,
    moderation: true,
    afk: true,
    logging: true,
    autorole: true,
    autovc: true,
    ai: true,
  },
  channels: {
    welcome: null,
    leave: null,
    logs: null,
    modLogs: null,
    inviteLogs: null,
    levelLogs: null,
  },
  roles: {
    autorole: null,
    muteRole: null,
    levelRoles: [],
  },
  settings: {
    welcome: {
      message: 'Welcome {user} to **{server}**! You are member #{memberCount}.',
      embed: true,
      dm: false,
      delay: 0,
    },
    leave: {
      message: '**{user}** has left **{server}**. We now have {memberCount} members.',
      embed: false,
    },
    leveling: {
      xpMin: 15,
      xpMax: 25,
      cooldown: 60,
      levelUpMessage: 'Congratulations {user}! You reached level **{level}**!',
      blacklistedChannels: [],
    },
    automod: {
      antiSpam: true,
      antiDuplicate: true,
      antiLinks: false,
      antiCaps: false,
      badWords: [],
      mentionLimit: 5,
      punishment: 'warn',
    },
    invites: { rewards: [] },
    autovc: { category: null, lobby: null },
    ai: {
      chatChannel: null,
      hubChannel: null,
      silenceHours: 6,
      emotionEnabled: true,
    },
  },
};

/**
 * Utility to parse JSON safely
 */
function safeParse(str, def) {
  if (!str) return def;
  try {
    return JSON.parse(str);
  } catch {
    return def;
  }
}

/**
 * Get guild config, creating it with defaults if it doesn't exist.
 */
async function getGuild(guildId) {
  const row = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(guildId);

  if (!row) {
    return createGuild(guildId);
  }

  return {
    guild_id: row.guild_id,
    modules: safeParse(row.modules, defaultGuild.modules),
    channels: safeParse(row.channels, defaultGuild.channels),
    roles: safeParse(row.roles, defaultGuild.roles),
    settings: safeParse(row.settings, defaultGuild.settings),
  };
}

/**
 * Create a new guild with default settings.
 */
async function createGuild(guildId) {
  db.prepare('INSERT INTO guilds (guild_id, modules, channels, roles, settings) VALUES (?, ?, ?, ?, ?)').run(
    guildId,
    JSON.stringify(defaultGuild.modules),
    JSON.stringify(defaultGuild.channels),
    JSON.stringify(defaultGuild.roles),
    JSON.stringify(defaultGuild.settings)
  );

  return {
    guild_id: guildId,
    ...defaultGuild,
  };
}

/**
 * Update a specific top-level field (modules, channels, roles, settings) by merging.
 */
async function updateGuildField(guildId, field, updates) {
  const guild = await getGuild(guildId);
  const merged = { ...guild[field], ...updates };

  db.prepare(`UPDATE guilds SET ${field} = ? WHERE guild_id = ?`).run(
    JSON.stringify(merged),
    guildId
  );

  return { ...guild, [field]: merged };
}

/**
 * Update a nested setting inside the settings JSONB column.
 * e.g. updateGuildSetting(guildId, 'leveling', { xpMin: 10 })
 */
async function updateGuildSetting(guildId, key, updates) {
  const guild = await getGuild(guildId);
  const merged = { ...guild.settings, [key]: { ...guild.settings[key], ...updates } };

  db.prepare('UPDATE guilds SET settings = ? WHERE guild_id = ?').run(
    JSON.stringify(merged),
    guildId
  );

  return { ...guild, settings: merged };
}

/**
 * Toggle a module on/off. Returns the new boolean value.
 */
async function toggleModule(guildId, moduleName) {
  const guild = await getGuild(guildId);
  const current = guild.modules[moduleName];
  if (current === undefined) throw new Error(`Unknown module: ${moduleName}`);

  const updated = { ...guild.modules, [moduleName]: !current };

  db.prepare('UPDATE guilds SET modules = ? WHERE guild_id = ?').run(
    JSON.stringify(updated),
    guildId
  );

  return !current;
}

/**
 * Check if a module is enabled for a guild.
 */
async function isModuleEnabled(guildId, moduleName) {
  const guild = await getGuild(guildId);
  return guild.modules[moduleName] === true;
}

module.exports = {
  getGuild,
  createGuild,
  updateGuildField,
  updateGuildSetting,
  toggleModule,
  isModuleEnabled,
};
