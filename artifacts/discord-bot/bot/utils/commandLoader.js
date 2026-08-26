const fs = require('fs');
const path = require('path');

/**
 * Recursively loads all command files from the commands directory
 * and registers them onto the client.commands Collection.
 */
async function loadCommands(client) {
  const commandsDir = path.join(__dirname, '..', 'commands');
  let loaded = 0;

  function readDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        readDir(fullPath);
      } else if (entry.name.endsWith('.js')) {
        try {
          const command = require(fullPath);
          if (!command.data || !command.execute) {
            console.warn(`[CMD LOADER] Skipping ${fullPath}: missing data or execute.`);
            continue;
          }
          client.commands.set(command.data.name, command);
          loaded++;
        } catch (err) {
          console.error(`[CMD LOADER] Error loading ${fullPath}:`, err.message);
        }
      }
    }
  }

  readDir(commandsDir);
  console.log(`[CMD LOADER] Loaded ${loaded} commands.`);
}

module.exports = { loadCommands };
