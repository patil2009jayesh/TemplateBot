const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { errorEmbed, successEmbed } = require('../../utils/helpers');
const db = require('../../database/sqlite');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Set up a reaction role.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addStringOption(o => o.setName('message_id').setDescription('Message ID to add reaction to').setRequired(true))
    .addStringOption(o => o.setName('emoji').setDescription('Emoji to use').setRequired(true))
    .addRoleOption(o => o.setName('role').setDescription('Role to assign').setRequired(true))
    .addChannelOption(o => o.setName('channel').setDescription('Channel containing the message')),

  async execute(interaction) {
    const messageId = interaction.options.getString('message_id');
    const emoji = interaction.options.getString('emoji');
    const role = interaction.options.getRole('role');
    const channel = interaction.options.getChannel('channel') || interaction.channel;

    // Verify message exists
    const msg = await channel.messages.fetch(messageId).catch(() => null);
    if (!msg) return interaction.reply({ embeds: [errorEmbed('Message not found in that channel.')], ephemeral: true });

    // Add reaction to the message
    await msg.react(emoji).catch(() => {
      return interaction.reply({ embeds: [errorEmbed('Invalid emoji or I cannot use it.')], ephemeral: true });
    });

    // Save to DB
    try {
      db.prepare(`
        INSERT INTO reaction_roles (message_id, guild_id, channel_id, emoji, role_id)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(message_id) DO UPDATE SET
          emoji = excluded.emoji,
          role_id = excluded.role_id
      `).run(messageId, interaction.guild.id, channel.id, emoji, role.id);
    } catch (error) {
      return interaction.reply({ embeds: [errorEmbed('Database error: ' + error.message)], ephemeral: true });
    }

    await interaction.reply({
      embeds: [successEmbed(`Reaction role set up!\n**Emoji:** ${emoji}\n**Role:** ${role}\n**Message:** ${messageId}`)],
    });
  },
};
