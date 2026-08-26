const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { enableAFK, getAFKUser, disableAFK } = require('../../services/userService');
const { isModuleEnabled } = require('../../services/guildService');
const { errorEmbed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('afk')
    .setDescription('Set or clear your AFK status.')
    .addStringOption(o =>
      o.setName('reason')
        .setDescription('Why are you going AFK? (leave empty to remove AFK)')
        .setRequired(false)
        .setMaxLength(200)
    ),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    // Check module is enabled
    try {
      const enabled = await isModuleEnabled(guildId, 'afk');
      if (!enabled) {
        return interaction.reply({
          embeds: [errorEmbed('The AFK module is disabled on this server.')],
          flags: 64,
        });
      }
    } catch {
      return interaction.reply({
        embeds: [errorEmbed('Could not check module status. Make sure the database tables are set up.')],
        flags: 64,
      });
    }

    const reason = interaction.options.getString('reason');

    // If no reason provided, check if they are AFK and remove it
    if (!reason) {
      let currentAFK = null;
      try {
        currentAFK = await getAFKUser(userId, guildId);
      } catch (err) {
        return interaction.reply({
          embeds: [errorEmbed(`Database error: ${err.message}`)],
          flags: 64,
        });
      }

      if (currentAFK && currentAFK.afk === true) {
        try {
          await disableAFK(userId, guildId);
        } catch (err) {
          return interaction.reply({
            embeds: [errorEmbed(`Failed to remove AFK: ${err.message}`)],
            flags: 64,
          });
        }

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x44ff88)
              .setDescription(`✅ <@${userId}>, your AFK status has been removed.`),
          ],
        });
      }

      // Not AFK — tell them how to use the command
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf1c40f)
            .setTitle('AFK Command')
            .setDescription(
              `You are not currently AFK.\n\n` +
              `**Set AFK:** \`/afk reason:Going to sleep\`\n` +
              `**Remove AFK:** \`/afk\` (no reason) or just send any message`
            ),
        ],
        flags: 64,
      });
    }

    // Set AFK
    try {
      await enableAFK(userId, guildId, reason);
    } catch (err) {
      return interaction.reply({
        embeds: [errorEmbed(`Failed to set AFK: ${err.message}\n\nMake sure the database schema is set up (run schema.sql in Supabase).`)],
        flags: 64,
      });
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xf1c40f)
          .setTitle('💤 You are now AFK')
          .setDescription(
            `**Reason:** ${reason}\n\nI'll notify people who mention you. Send any message to remove your AFK status.`
          )
          .setFooter({ text: `AFK set at ${new Date().toLocaleTimeString()}` }),
      ],
    });
  },
};
