const { Events } = require('discord.js');
const { handleVoiceStateUpdate } = require('../systems/autovcSystem');

module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState) {
    await handleVoiceStateUpdate(oldState, newState).catch(() => {});
  },
};
