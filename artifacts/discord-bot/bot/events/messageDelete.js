const { Events } = require('discord.js');
const { logMessageDelete } = require('../systems/loggingSystem');

module.exports = {
  name: Events.MessageDelete,
  async execute(message) {
    await logMessageDelete(message).catch(() => {});
  },
};
