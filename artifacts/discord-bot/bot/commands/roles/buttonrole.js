const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { errorEmbed, successEmbed } = require('../../utils/helpers');
const db = require('../../database/sqlite');
const { v4: uuidv4 } = require('crypto');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('buttonrole')
    .setDescription('Create a button role message.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addRoleOption(o => o.setName('role').setDescription('Role to assign with button').setRequired(true))
    .addStringOption(o => o.setName('label').setDescription('Button label').setRequired(true))
    .addStringOption(o => o.setName('title').setDescription('Embed title'))
    .addStringOption(o => o.setName('description').setDescription('Embed description')),

  async execute(interaction) {
    const role = interaction.options.getRole('role');
    const label = interaction.options.getString('label');
    const title = interaction.options.getString('title') || 'Role Selection';
    const description = interaction.options.getString('description') || `Click the button below to get the **${role.name}** role.`;

    // Generate unique custom_id
    const customId = `btn_role_${role.id}_${Date.now()}`;

    const button = new ButtonBuilder()
      .setCustomId(customId)
      .setLabel(label)
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    const { EmbedBuilder } = require('discord.js');
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(title)
      .setDescription(description);

    const sent = await interaction.channel.send({ embeds: [embed], components: [row] });

    // Save to DB
    try {
      db.prepare(`
        INSERT INTO button_roles (message_id, guild_id, channel_id, label, role_id, custom_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(sent.id, interaction.guild.id, interaction.channel.id, label, role.id, customId);
    } catch (error) {
      await sent.delete().catch(() => {});
      return interaction.reply({ embeds: [errorEmbed('Database error: ' + error.message)], ephemeral: true });
    }

    await interaction.reply({ embeds: [successEmbed(`Button role message created for **${role.name}**.`)], ephemeral: true });
  },
};
