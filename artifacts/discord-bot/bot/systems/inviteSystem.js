const { EmbedBuilder } = require('discord.js');
const { incrementInvites, incrementLeftInvites, setInviter } = require('../services/inviteService');
const { getGuild, isModuleEnabled } = require('../services/guildService');

// Cache of guild invite uses: guildId -> Map<code, uses>
const inviteCache = new Map();

/**
 * Cache invite uses for a guild when the bot joins or when invites change.
 */
async function cacheInvites(guild) {
  try {
    const invites = await guild.invites.fetch();
    const uses = new Map();
    invites.forEach(invite => uses.set(invite.code, invite.uses));
    inviteCache.set(guild.id, uses);
  } catch {
    // No permission or error — skip
  }
}

/**
 * Find who invited a new member by comparing cached vs current invite uses.
 * Returns the inviter user or null.
 */
async function findInviter(guild) {
  try {
    const before = inviteCache.get(guild.id) || new Map();
    const currentInvites = await guild.invites.fetch();

    let inviter = null;
    for (const invite of currentInvites.values()) {
      const prevUses = before.get(invite.code) || 0;
      if (invite.uses > prevUses) {
        inviter = invite.inviter;
        break;
      }
    }

    // Update cache
    const updated = new Map();
    currentInvites.forEach(inv => updated.set(inv.code, inv.uses));
    inviteCache.set(guild.id, updated);

    return inviter;
  } catch {
    return null;
  }
}

/**
 * Handle a new member joining — track their inviter.
 */
async function handleInviteJoin(member) {
  const { guild } = member;

  const enabled = await isModuleEnabled(guild.id, 'invites');
  if (!enabled) return;

  const inviter = await findInviter(guild);

  if (inviter) {
    await setInviter(member.id, guild.id, inviter.id);
    await incrementInvites(inviter.id, guild.id);

    // Log invite join
    const guildData = await getGuild(guild.id);
    const logChannelId = guildData.channels.inviteLogs;
    if (logChannelId) {
      const logChannel = guild.channels.cache.get(logChannelId);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('Invite Tracked')
          .addFields(
            { name: 'New Member', value: `${member.user.tag} (${member.id})` },
            { name: 'Invited By', value: `${inviter.tag} (${inviter.id})` }
          )
          .setTimestamp();
        await logChannel.send({ embeds: [embed] }).catch(() => {});
      }
    }
  }
}

/**
 * Handle a member leaving — decrement invite count from inviter.
 */
async function handleInviteLeave(member) {
  const { guild } = member;

  const enabled = await isModuleEnabled(guild.id, 'invites');
  if (!enabled) return;

  // Update invite cache
  await cacheInvites(guild).catch(() => {});
}

module.exports = { cacheInvites, handleInviteJoin, handleInviteLeave };
