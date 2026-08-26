const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const db = require('../database/sqlite');

/**
 * GIVEAWAY SYSTEM
 * Supports: Button-based, Most XP (Chatting), and Invite-based.
 */

/** Start a new giveaway */
async function startGiveaway(interaction, type, prize, durationMs, winnerCount = 1, minInvites = 0) {
  const guildId = interaction.guildId;
  const channelId = interaction.channelId;
  const endTime = new Date(Date.now() + durationMs).toISOString();

  // Create DB record
  const result = db.prepare(`
    INSERT INTO giveaways (guild_id, type, prize, end_time, channel_id, winner_count, min_invites, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
  `).run(guildId, type, prize, endTime, channelId, winnerCount, minInvites);

  const giveawayId = result.lastInsertRowid;

  const embed = new EmbedBuilder()
    .setTitle(`🎉 NEW GIVEAWAY: ${prize}`)
    .setDescription(`
**Type:** ${type.toUpperCase()}
**Winners:** ${winnerCount}
${type === 'invite' ? `**Min Invites Needed:** ${minInvites}\n` : ''}
Ending <t:${Math.floor((Date.now() + durationMs) / 1000)}:R>!
    `)
    .setColor('#FF69B4')
    .setFooter({ text: `ID: ${giveawayId} | Participant count: 0` });

  let components = [];
  if (type === 'button') {
    const joinBtn = new ButtonBuilder()
      .setCustomId(`giveaway_join_${giveawayId}`)
      .setLabel('Join Giveaway')
      .setEmoji('🎁')
      .setStyle(ButtonStyle.Primary);
    components.push(new ActionRowBuilder().addComponents(joinBtn));
  } else if (type === 'xp' || type === 'invite') {
    const lbBtn = new ButtonBuilder()
      .setCustomId(`giveaway_lb_${giveawayId}`)
      .setLabel('View Leaderboard')
      .setEmoji('📊')
      .setStyle(ButtonStyle.Secondary);
    components.push(new ActionRowBuilder().addComponents(lbBtn));
  }

  const msg = await interaction.reply({ embeds: [embed], components, fetchReply: true });

  // Update record with message ID
  db.prepare('UPDATE giveaways SET message_id = ? WHERE id = ?').run(msg.id, giveawayId);

  // Set timer to end
  setTimeout(() => endGiveaway(interaction.client, giveawayId), durationMs);
}

/** Handle button interactions (Join / Leaderboard) */
async function handleGiveawayInteraction(interaction) {
  const { customId } = interaction;
  
  if (customId.startsWith('giveaway_join_')) {
    const giveawayId = customId.split('_')[2];
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const giveaway = db.prepare('SELECT status FROM giveaways WHERE id = ?').get(giveawayId);
    if (!giveaway || giveaway.status !== 'active') {
      return interaction.reply({ content: '❌ This giveaway has ended!', ephemeral: true });
    }

    // Check if already joined
    const joined = db.prepare('SELECT id FROM giveaway_participants WHERE giveaway_id = ? AND user_id = ?').get(giveawayId, userId);
    if (joined) {
      return interaction.reply({ content: '❌ You have already joined this giveaway!', ephemeral: true });
    }

    db.prepare('INSERT INTO giveaway_participants (giveaway_id, user_id, timestamp) VALUES (?, ?, ?)')
      .run(giveawayId, userId, new Date().toISOString());

    // Update message count (optional but nice)
    const count = db.prepare('SELECT COUNT(*) as count FROM giveaway_participants WHERE giveaway_id = ?').get(giveawayId).count;
    
    // We don't edit the main embed every time to avoid rate limits, but we can if we want
    interaction.reply({ content: '✅ You have successfully joined the giveaway!', ephemeral: true });
  }

  if (customId.startsWith('giveaway_lb_')) {
    const giveawayId = customId.split('_')[2];
    const giveaway = db.prepare('SELECT * FROM giveaways WHERE id = ?').get(giveawayId);
    if (!giveaway) return interaction.reply({ content: '❌ Giveaway not found.', ephemeral: true });

    let participants = [];
    if (giveaway.type === 'xp') {
      participants = db.prepare(`
        SELECT user_id, entry_value 
        FROM giveaway_participants 
        WHERE giveaway_id = ? 
        ORDER BY entry_value DESC LIMIT 10
      `).all(giveawayId);
    } else if (giveaway.type === 'invite') {
      participants = db.prepare(`
        SELECT user_id, entry_value 
        FROM giveaway_participants 
        WHERE giveaway_id = ? 
        ORDER BY entry_value DESC LIMIT 10
      `).all(giveawayId);
    }

    const lbText = participants.length > 0 
      ? participants.map((p, i) => `${i + 1}. <@${p.user_id}> - **${Math.floor(p.entry_value)}** ${giveaway.type === 'xp' ? 'XP' : 'Invites'}`).join('\n')
      : "No participants yet!";

    const embed = new EmbedBuilder()
      .setTitle(`📊 Giveaway Leaderboard: ${giveaway.prize}`)
      .setDescription(lbText)
      .setColor('#FF69B4')
      .setTimestamp();

    interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

/** End giveaway and pick winner */
async function endGiveaway(client, giveawayId) {
  const giveaway = db.prepare('SELECT * FROM giveaways WHERE id = ?').get(giveawayId);
  if (!giveaway || giveaway.status !== 'active') return;

  // Mark as ended
  db.prepare('UPDATE giveaways SET status = \'ended\' WHERE id = ?').run(giveawayId);

  let participants = db.prepare('SELECT user_id, entry_value FROM giveaway_participants WHERE giveaway_id = ?').all(giveawayId);
  
  // Filter for invite min threshold if needed
  if (giveaway.type === 'invite' && giveaway.min_invites > 0) {
    participants = participants.filter(p => p.entry_value >= giveaway.min_invites);
  }

  if (participants.length === 0) {
    const channel = await client.channels.fetch(giveaway.channel_id).catch(() => null);
    if (channel) channel.send(`❌ The giveaway for **${giveaway.prize}** ended, but no one qualified!`);
    return;
  }

  // Pick winners
  let winners = [];
  if (giveaway.type === 'button') {
    // Random pick
    const shuffled = participants.sort(() => 0.5 - Math.random());
    winners = shuffled.slice(0, giveaway.winner_count);
  } else {
    // Top XP/Invites are winners
    winners = participants.sort((a, b) => b.entry_value - a.entry_value).slice(0, giveaway.winner_count);
  }

  const winnerMentions = winners.map(w => `<@${w.user_id}>`).join(', ');
  const channel = await client.channels.fetch(giveaway.channel_id).catch(() => null);
  
  if (channel) {
    const embed = new EmbedBuilder()
      .setTitle(`🎊 GIVEAWAY ENDED 🎊`)
      .setDescription(`
**Prize:** ${giveaway.prize}
**Winner(s):** ${winnerMentions}

Congratulations! Check your DMs or contact staff to claim.
      `)
      .setColor('#00FF00')
      .setTimestamp();
    
    channel.send({ content: `Congratulations ${winnerMentions}!`, embeds: [embed] });
  }
}

/** Record XP/Invite entry for active giveaways */
async function recordGiveawayActivity(guildId, userId, type, value = 1) {
  const activeGiveaways = db.prepare('SELECT id FROM giveaways WHERE guild_id = ? AND type = ? AND status = \'active\'').all(guildId, type);
  
  for (const gw of activeGiveaways) {
    db.prepare(`
      INSERT INTO giveaway_participants (giveaway_id, user_id, entry_value, timestamp)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(giveaway_id, user_id) DO UPDATE SET
        entry_value = entry_value + ?
    `).run(gw.id, userId, value, new Date().toISOString(), value);
  }
}

/** Initialize giveaways on startup (restart timers) */
async function initGiveaways(client) {
  const active = db.prepare('SELECT id, end_time FROM giveaways WHERE status = \'active\'').all();
  for (const gw of active) {
    const remaining = new Date(gw.end_time).getTime() - Date.now();
    if (remaining <= 0) {
      endGiveaway(client, gw.id);
    } else {
      setTimeout(() => endGiveaway(client, gw.id), remaining);
    }
  }
}

module.exports = {
  startGiveaway,
  handleGiveawayInteraction,
  recordGiveawayActivity,
  endGiveaway,
  initGiveaways
};
