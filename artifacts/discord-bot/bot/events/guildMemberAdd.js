const { Events } = require('discord.js');
const { handleMemberJoin } = require('../systems/welcomeSystem');
const { handleInviteJoin } = require('../systems/inviteSystem');
const { applyAutorole } = require('../systems/roleSystem');
const { logMemberJoin } = require('../systems/loggingSystem');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    await Promise.allSettled([
      handleInviteJoin(member),
      handleMemberJoin(member),
      applyAutorole(member),
      logMemberJoin(member),
    ]);
  },
};
