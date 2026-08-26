const { Events } = require('discord.js');
const { handleReactionAdd } = require('../systems/roleSystem');

module.exports = {
  name: Events.MessageReactionAdd,
  async execute(reaction, user) {
    await handleReactionAdd(reaction, user).catch(() => {});
  },
};
