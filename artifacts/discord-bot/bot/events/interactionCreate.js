const { Events, MessageFlags } = require('discord.js');
const { handleButtonRoleInteraction } = require('../systems/roleSystem');
const { getCustomCommand } = require('../services/customCommandService');
const { errorEmbed, getDBErrorMessage } = require('../utils/helpers');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {

    // ── Button interactions ──────────────────────────────────────────────────
    if (interaction.isButton()) {
      if (interaction.customId.startsWith('giveaway_')) {
        const { handleGiveawayInteraction } = require('../systems/giveawaySystem');
        return await handleGiveawayInteraction(interaction).catch(() => {});
      }
      if (interaction.customId.startsWith('ticket_')) {
        const { handleTicketInteraction } = require('../systems/ticketSystem');
        return await handleTicketInteraction(interaction).catch(() => {});
      }
      await handleButtonRoleInteraction(interaction).catch(() => {});
      return;
    }

    // ── Modal Submissions ────────────────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('ticket_')) {
        const { handleTicketInteraction } = require('../systems/ticketSystem');
        return await handleTicketInteraction(interaction).catch(err => {
          console.error('[TICKET ERROR] Interaction handling failed:', err);
        });
      }
    }

    // ── Only handle slash commands from here ─────────────────────────────────
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
      // Check if it's a guild custom command
      if (interaction.guild) {
        const custom = await getCustomCommand(interaction.guild.id, interaction.commandName).catch(() => null);
        if (custom) {
          return interaction.reply({ content: custom.response });
        }
      }
      return interaction.reply({
        embeds: [errorEmbed('Unknown command.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`[CMD ERROR] ${interaction.commandName}:`, err.message);

      // Give a user-friendly message for DB setup errors
      const description = getDBErrorMessage(err);

      const errPayload = {
        embeds: [errorEmbed(description)],
        flags: MessageFlags.Ephemeral,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errPayload).catch(() => {});
      } else {
        await interaction.reply(errPayload).catch(() => {});
      }
    }
  },
};
