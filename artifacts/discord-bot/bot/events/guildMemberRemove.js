const { Events } = require('discord.js');
const { handleMemberLeave } = require('../systems/welcomeSystem');
const { handleInviteLeave } = require('../systems/inviteSystem');
const { logMemberLeave } = require('../systems/loggingSystem');

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(member) {
    await Promise.allSettled([
      handleInviteLeave(member),
      handleMemberLeave(member),
      logMemberLeave(member),
    ]);
  },
};
