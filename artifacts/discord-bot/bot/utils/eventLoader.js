const fs = require('fs');
const path = require('path');

/**
 * Loads all event files from the events directory and registers
 * them as Discord client event listeners.
 */
async function loadEvents(client) {
  const eventsDir = path.join(__dirname, '..', 'events');
  let loaded = 0;

  const files = fs.readdirSync(eventsDir).filter(f => f.endsWith('.js'));

  for (const file of files) {
    try {
      const event = require(path.join(eventsDir, file));
      if (!event.name || !event.execute) {
        console.warn(`[EVT LOADER] Skipping ${file}: missing name or execute.`);
        continue;
      }
      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args) => event.execute(...args, client));
      }
      loaded++;
    } catch (err) {
      console.error(`[EVT LOADER] Error loading ${file}:`, err.message);
    }
  }

  console.log(`[EVT LOADER] Loaded ${loaded} events.`);
}

module.exports = { loadEvents };
