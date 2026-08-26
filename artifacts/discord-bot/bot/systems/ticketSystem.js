const { 
  EmbedBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ActionRowBuilder, 
  PermissionFlagsBits, 
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const db = require('../database/sqlite');

/**
 * TICKET SYSTEM
 * Supports: Private channels, Staff teams, Modals for reasons, Claiming/Closing.
 */

/** Setup a ticket team (Staff Role + Category) */
async function setupTicketTeam(interaction, teamName, staffRoleId, categoryId) {
  const guildId = interaction.guildId;
  
  db.prepare(`
    INSERT INTO ticket_teams (guild_id, team_name, staff_role_id, category_id)
    VALUES (?, ?, ?, ?)
  `).run(guildId, teamName, staffRoleId, categoryId);

  return interaction.reply({ content: `✅ Ticket team **${teamName}** has been setup!`, ephemeral: true });
}

/** Post the ticket creation message */
async function postTicketMessage(interaction, title, description, teamId) {
  const guildId = interaction.guildId;
  const team = db.prepare('SELECT * FROM ticket_teams WHERE id = ? AND guild_id = ?').get(teamId, guildId);
  
  if (!team) return interaction.reply({ content: '❌ Ticket team not found.', ephemeral: true });

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor('#00AAFF')
    .setFooter({ text: 'Click the button below to open a ticket' });

  const btn = new ButtonBuilder()
    .setCustomId(`ticket_create_${teamId}`)
    .setLabel('Create Ticket')
    .setEmoji('📩')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(btn);

  await interaction.channel.send({ embeds: [embed], components: [row] });
  return interaction.reply({ content: '✅ Ticket message posted!', ephemeral: true });
}

/** Handle ticket interactions (Buttons & Modals) */
async function handleTicketInteraction(interaction) {
  const { customId } = interaction;

  // 1. CLICK CREATE BUTTON -> SHOW MODAL
  if (customId.startsWith('ticket_create_')) {
    const teamId = customId.split('_')[2];
    const modal = new ModalBuilder()
      .setCustomId(`ticket_modal_submit_${teamId}`)
      .setTitle('Create Support Ticket');

    const reasonInput = new TextInputBuilder()
      .setCustomId('ticket_reason')
      .setLabel('Reason for opening this ticket')
      .setPlaceholder('Describe your issue or request...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMinLength(10);

    modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
    return interaction.showModal(modal);
  }

  // 2. SUBMIT MODAL -> CREATE CHANNEL
  if (interaction.isModalSubmit() && customId.startsWith('ticket_modal_submit_')) {
    const teamId = customId.split('_')[3];
    const reason = interaction.fields.getTextInputValue('ticket_reason');
    return await createTicketChannel(interaction, teamId, reason);
  }

  // 3. CLAIM TICKET
  if (customId.startsWith('ticket_claim_')) {
    const ticketId = customId.split('_')[2];
    return await claimTicket(interaction, ticketId);
  }

  // 4. CLOSE TICKET (Prompt reason)
  if (customId === `ticket_close_${customId.split('_')[2]}`) { // Specific button match
    const ticketId = customId.split('_')[2];
    const modal = new ModalBuilder()
      .setCustomId(`ticket_close_modal_submit_${ticketId}`)
      .setTitle('Close Ticket');

    const reasonInput = new TextInputBuilder()
      .setCustomId('close_reason')
      .setLabel('Reason for closing')
      .setPlaceholder('Issue resolved / No response...')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
    return interaction.showModal(modal);
  }

  // 5. SUBMIT CLOSE MODAL
  if (interaction.isModalSubmit() && customId.startsWith('ticket_close_modal_submit_')) {
    const ticketId = customId.split('_')[4];
    const reason = interaction.fields.getTextInputValue('close_reason');
    console.log(`[TICKET] Closing ticket ID: ${ticketId} for reason: ${reason}`);
    return await closeTicket(interaction, ticketId, reason);
  }
}

/** Create the private ticket channel */
async function createTicketChannel(interaction, teamId, reason) {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  const user = interaction.user;
  const team = db.prepare('SELECT * FROM ticket_teams WHERE id = ?').get(teamId);

  if (!team) return interaction.editReply('❌ Ticket team configuration error.');

  // Create channel name: ticket-user-123
  const channelName = `ticket-${user.username.toLowerCase()}`;
  
  const permissionOverwrites = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }, // Hide from everyone
    { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] }, // Show to user
    { id: team.staff_role_id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] }, // Show to staff
  ];

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: team.category_id || null,
    permissionOverwrites,
    topic: `Reason: ${reason} | Creator: ${user.tag}`
  });

  // DB entry
  const result = db.prepare(`
    INSERT INTO tickets (guild_id, channel_id, creator_id, reason, team_id, status)
    VALUES (?, ?, ?, ?, ?, 'open')
  `).run(guild.id, channel.id, user.id, reason, teamId);
  
  const ticketId = result.lastInsertRowid;

  const embed = new EmbedBuilder()
    .setTitle('🎫 New Support Ticket')
    .setDescription(`
**Ticket ID:** #${ticketId}
**Topic:** ${team.team_name}
**Creator:** <@${user.id}>
**Reason:** ${reason}

Welcome! A member of the **${team.team_name}** team will be with you shortly.
    `)
    .addFields({ name: 'Instructions', value: 'Staff members can click "Claim" to handle this ticket. Both users and staff can "Close" the ticket.' })
    .setColor('#FFA500')
    .setTimestamp();

  const claimBtn = new ButtonBuilder()
    .setCustomId(`ticket_claim_${ticketId}`)
    .setLabel('Claim Ticket')
    .setEmoji('🙋‍♂️')
    .setStyle(ButtonStyle.Success);

  const closeBtn = new ButtonBuilder()
    .setCustomId(`ticket_close_${ticketId}`)
    .setLabel('Close Ticket')
    .setEmoji('🔒')
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder().addComponents(claimBtn, closeBtn);

  const msg = await channel.send({ content: `<@${user.id}> | <@&${team.staff_role_id}>`, embeds: [embed], components: [row] });
  db.prepare('UPDATE tickets SET message_id = ? WHERE id = ?').run(msg.id, ticketId);

  await interaction.editReply(`✅ Ticket created successfully: <#${channel.id}>`);
}

/** Staff claims a ticket */
async function claimTicket(interaction, ticketId) {
  const guildId = interaction.guildId;
  const staffId = interaction.user.id;
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);

  if (!ticket) return interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });
  if (ticket.staff_id) return interaction.reply({ content: `❌ This ticket is already claimed by <@${ticket.staff_id}>.`, ephemeral: true });
  if (ticket.creator_id === staffId) return interaction.reply({ content: '❌ You cannot claim your own ticket!', ephemeral: true });

  db.prepare('UPDATE tickets SET staff_id = ? WHERE id = ?').run(staffId, ticketId);

  const embed = EmbedBuilder.from(interaction.message.embeds[0])
    .addFields({ name: 'Claimed By', value: `<@${staffId}>` })
    .setColor('#00FF00');

  // Disable claim button
  const row = ActionRowBuilder.from(interaction.message.components[0]);
  row.components[0].setDisabled(true).setLabel('Claimed');

  await interaction.message.edit({ embeds: [embed], components: [row] });
  await interaction.reply({ content: `✅ You have claimed this ticket.`, ephemeral: false });
}

/** Close a ticket */
async function closeTicket(interaction, ticketId, reason) {
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
  if (!ticket) return interaction.reply({ content: '❌ Ticket record not found.', ephemeral: true });

  db.prepare('UPDATE tickets SET status = \'closed\' WHERE id = ?').run(ticketId);

  await interaction.reply({ content: `📤 Closing ticket... Reason: ${reason}` });

  // Update permissions
  const channel = interaction.channel;
  await channel.permissionOverwrites.edit(ticket.creator_id, { [PermissionFlagsBits.ViewChannel]: false });

  const endEmbed = new EmbedBuilder()
    .setTitle('🛑 Ticket Closed')
    .setDescription(`
**Closed By:** <@${interaction.user.id}>
**Reason:** ${reason}
**Ticket ID:** #${ticketId}
    `)
    .setColor('#FF0000')
    .setTimestamp();

  await channel.send({ embeds: [endEmbed] });
  
  // Actually the user wants it to be clean. Many bots delete after X seconds.
  await channel.send("This channel will be deleted in 10 seconds.");
  setTimeout(() => channel.delete().catch(() => {}), 10000);
}

module.exports = {
  setupTicketTeam,
  postTicketMessage,
  handleTicketInteraction
};
