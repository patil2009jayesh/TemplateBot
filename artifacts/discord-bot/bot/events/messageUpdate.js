const { Events } = require('discord.js');
const { logMessageEdit } = require('../systems/loggingSystem');

module.exports = {
  name: Events.MessageUpdate,
  async execute(oldMessage, newMessage) {
    await logMessageEdit(oldMessage, newMessage).catch(() => {});
  },
};
