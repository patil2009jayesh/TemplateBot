const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { getGuild, isModuleEnabled } = require('../services/guildService');
const db = require('../database/sqlite');

/**
 * Handle voice state updates for auto-VC creation/deletion.
 */
async function handleVoiceStateUpdate(oldState, newState) {
  const guild = newState.guild || oldState.guild;

  const enabled = await isModuleEnabled(guild.id, 'autovc');
  if (!enabled) return;

  const guildData = await getGuild(guild.id);
  const vcSettings = guildData.settings.autovc;

  if (!vcSettings.lobby) return;

  // Member joined the lobby channel — create a personal VC
  if (newState.channelId === vcSettings.lobby && newState.member) {
    await createPersonalVC(newState.member, guild, vcSettings);
  }

  // Member left a channel — check if it was a personal VC and is now empty
  if (oldState.channelId && oldState.channelId !== vcSettings.lobby) {
    await cleanupEmptyVC(oldState.channelId, guild);
  }
}

/**
 * Create a personal voice channel for a member.
 */
async function createPersonalVC(member, guild, vcSettings) {
  try {
    const category = vcSettings.category ? guild.channels.cache.get(vcSettings.category) : null;

    const channel = await guild.channels.create({
      name: `${member.displayName}'s Channel`,
      type: ChannelType.GuildVoice,
      parent: category || null,
      permissionOverwrites: [
        {
          id: member.id,
          allow: [
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.MoveMembers,
            PermissionFlagsBits.MuteMembers,
          ],
        },
      ],
    });

    // Move the member to the new channel
    await member.voice.setChannel(channel);

    // Track in DB
    try {
      db.prepare(`
        INSERT INTO auto_vcs (guild_id, channel_id, user_id)
        VALUES (?, ?, ?)
      `).run(guild.id, channel.id, member.id);
    } catch { /* non-critical */ }
  } catch (err) {
    console.error('[AUTO-VC] Error creating channel:', err.message);
  }
}

/**
 * Delete empty personal VCs.
 */
async function cleanupEmptyVC(channelId, guild) {
  try {
    // Check if it's tracked as a personal VC
    const data = db.prepare('SELECT * FROM auto_vcs WHERE channel_id = ? AND guild_id = ?').get(channelId, guild.id);

    if (!data) return;

    const channel = guild.channels.cache.get(channelId);
    if (!channel || channel.members.size > 0) return;

    await channel.delete('Auto-VC: channel is empty');

    db.prepare('DELETE FROM auto_vcs WHERE channel_id = ?').run(channelId);
  } catch {
    // Channel may already be deleted
  }
}

module.exports = { handleVoiceStateUpdate };
