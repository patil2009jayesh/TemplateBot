const { Events } = require('discord.js');
const { handleReactionRemove } = require('../systems/roleSystem');

module.exports = {
  name: Events.MessageReactionRemove,
  async execute(reaction, user) {
    await handleReactionRemove(reaction, user).catch(() => {});
  },
};
