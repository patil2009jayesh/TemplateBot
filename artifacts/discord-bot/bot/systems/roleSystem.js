const { EmbedBuilder } = require('discord.js');
const { isModuleEnabled } = require('../services/guildService');
const db = require('../database/sqlite');

/**
 * Handle reaction add for reaction roles.
 */
async function handleReactionAdd(reaction, user) {
  if (user.bot) return;
  if (!reaction.message.guild) return;

  // Fetch partial reactions/messages
  if (reaction.partial) await reaction.fetch().catch(() => {});
  if (reaction.message.partial) await reaction.message.fetch().catch(() => {});

  const enabled = await isModuleEnabled(reaction.message.guild.id, 'autorole');
  if (!enabled) return;

  const emoji = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;

  const data = db.prepare('SELECT role_id FROM reaction_roles WHERE message_id = ? AND emoji = ?').get(reaction.message.id, emoji);

  if (!data) return;

  const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  const role = reaction.message.guild.roles.cache.get(data.role_id);
  if (role) await member.roles.add(role).catch(() => {});
}

/**
 * Handle reaction remove for reaction roles.
 */
async function handleReactionRemove(reaction, user) {
  if (user.bot) return;
  if (!reaction.message.guild) return;

  if (reaction.partial) await reaction.fetch().catch(() => {});
  if (reaction.message.partial) await reaction.message.fetch().catch(() => {});

  const emoji = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;

  const data = db.prepare('SELECT role_id FROM reaction_roles WHERE message_id = ? AND emoji = ?').get(reaction.message.id, emoji);

  if (!data) return;

  const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  const role = reaction.message.guild.roles.cache.get(data.role_id);
  if (role) await member.roles.remove(role).catch(() => {});
}

/**
 * Handle button interactions for button roles.
 */
async function handleButtonRoleInteraction(interaction) {
  if (!interaction.isButton()) return;
  if (!interaction.guild) return;

  const data = db.prepare('SELECT role_id FROM button_roles WHERE custom_id = ?').get(interaction.customId);

  if (!data) return;

  const role = interaction.guild.roles.cache.get(data.role_id);
  if (!role) {
    return interaction.reply({ content: 'Role not found.', ephemeral: true });
  }

  const member = interaction.member;
  if (member.roles.cache.has(role.id)) {
    await member.roles.remove(role);
    await interaction.reply({ content: `Removed **${role.name}** from you.`, ephemeral: true });
  } else {
    await member.roles.add(role);
    await interaction.reply({ content: `Gave you **${role.name}**.`, ephemeral: true });
  }
}

/**
 * Apply autorole to a new member.
 */
async function applyAutorole(member) {
  const { getGuild } = require('../services/guildService');
  try {
    const guildData = await getGuild(member.guild.id);
    const autoroleId = guildData.roles.autorole;
    if (!autoroleId) return;

    const role = member.guild.roles.cache.get(autoroleId);
    if (role) await member.roles.add(role).catch(() => {});
  } catch {}
}

module.exports = {
  handleReactionAdd,
  handleReactionRemove,
  handleButtonRoleInteraction,
  applyAutorole,
};
