const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  AttachmentBuilder,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const {
  exportGuild,
  parseBackup,
  createRestorePlan,
  restoreGuild,
} = require('../../services/backupService');
const { successEmbed, errorEmbed } = require('../../utils/helpers');

const backupDirectory = path.resolve(__dirname, '..', '..', '..', 'backups');

function shortNumber(value) {
  return (value || 0).toLocaleString('en-US');
}

function formatPlanEmbed(plan) {
  const embed = new EmbedBuilder()
    .setTitle(`📦 ${plan.mode === 'replace' ? 'Replace' : 'Merge'} Preview: ${plan.backupName}`)
    .setColor(plan.mode === 'replace' ? 0xff4d4d : 0x5865f2)
    .addFields(
      {
        name: '🎭 Roles',
        value: `**Create:** ${shortNumber(plan.roles.create)} | **Update:** ${shortNumber(plan.roles.update)} | **Managed Skip:** ${shortNumber(plan.roles.skipManaged)}`,
        inline: false,
      },
      {
        name: '📁 Categories',
        value: `**Create:** ${shortNumber(plan.categories.create)} | **Update:** ${shortNumber(plan.categories.update)}`,
        inline: true,
      },
      {
        name: '💬 Channels',
        value: `**Create:** ${shortNumber(plan.channels.create)} | **Update:** ${shortNumber(plan.channels.update)} | **Unsupported Skip:** ${shortNumber(plan.channels.skipUnsupported)}`,
        inline: true,
      },
      {
        name: '🎨 Emojis & Stickers',
        value: `**Emojis:** ${shortNumber(plan.emojis.create)} create (${shortNumber(plan.emojis.skipExisting)} skip)\n**Stickers:** ${shortNumber(plan.stickers.create)} create (${shortNumber(plan.stickers.skipExisting)} skip)`,
        inline: false,
      }
    )
    .setTimestamp();

  if (plan.warnings && plan.warnings.length > 0) {
    embed.addFields({
      name: '⚠️ Warnings',
      value: plan.warnings.slice(0, 8).map((w) => `• ${w}`).join('\n'),
      inline: false,
    });
  }

  return embed;
}

async function fetchJsonAttachment(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Discord returned HTTP ${response.status} while downloading the attachment.`);
  }
  const text = await response.text();
  if (text.length > 25 * 1024 * 1024) {
    throw new Error("The file is larger than Discord's 25 MB attachment limit.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('The uploaded attachment is not valid JSON.');
  }
}

async function saveBackupLocal(backup) {
  if (!fs.existsSync(backupDirectory)) {
    fs.mkdirSync(backupDirectory, { recursive: true });
  }
  const safeName = backup.name.replace(/[^a-z0-9-_]+/gi, '-').slice(0, 50) || 'server';
  const filename = `${safeName}-${backup.id}-${Date.now()}.json`;
  fs.writeFileSync(path.join(backupDirectory, filename), JSON.stringify(backup, null, 2), 'utf8');
  return filename;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Export, inspect, or restore this server configuration')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('export')
        .setDescription('Export complete server configuration as a JSON file')
    )
    .addSubcommand((sub) =>
      sub
        .setName('inspect')
        .setDescription('Show counts of server roles, channels, emojis, and settings')
    )
    .addSubcommand((sub) =>
      sub
        .setName('restore')
        .setDescription('Validate and restore a JSON server export')
        .addAttachmentOption((opt) =>
          opt
            .setName('file')
            .setDescription('A valid JSON server export file')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('mode')
            .setDescription('Merge into server (safe) or replace all structures (destructive)')
            .addChoices(
              { name: 'Merge (safe)', value: 'merge' },
              { name: 'Replace (destructive)', value: 'replace' }
            )
            .setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt
            .setName('dry_run')
            .setDescription('Only show what would change without applying; default is true')
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('confirm')
            .setDescription('Required for Replace mode: type "RESTORE"')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('List recent server export checkpoints saved by the bot')
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        embeds: [errorEmbed('This command can only be used inside a Discord server.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        embeds: [errorEmbed('You need the **Manage Server** permission to use `/backup`.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const subcommand = interaction.options.getSubcommand();

    try {
      if (subcommand === 'export') {
        const backup = await exportGuild(interaction.guild, interaction.client.application?.id);
        const filename = await saveBackupLocal(backup);
        const jsonBuffer = Buffer.from(JSON.stringify(backup, null, 2), 'utf8');

        const embed = successEmbed(
          `Exported **${backup.name}** successfully!\n\n` +
          `• **Roles:** ${shortNumber(backup.roles.length)}\n` +
          `• **Channels & Categories:** ${shortNumber(backup.channels.length)}\n` +
          `• **Emojis:** ${shortNumber(backup.emojis.length)}\n` +
          `• **Stickers:** ${shortNumber(backup.stickers.length)}\n` +
          `• **Saved Local File:** \`${filename}\``
        ).setTitle('📤 Server Export Complete');

        const safeAttachmentName = `${backup.name.replace(/[^a-z0-9-_]+/gi, '-') || 'server'}-backup.json`;
        const fileAttachment = new AttachmentBuilder(jsonBuffer, { name: safeAttachmentName });

        return interaction.editReply({
          embeds: [embed],
          files: [fileAttachment],
        });
      }

      if (subcommand === 'inspect') {
        const backup = await exportGuild(interaction.guild, interaction.client.application?.id);
        const categories = backup.channels.filter((c) => c.type === 4).length;
        const textAndVoice = backup.channels.length - categories;
        const restorableRoles = backup.roles.filter((r) => !r.managed).length;

        const embed = new EmbedBuilder()
          .setTitle(`🔍 Server Inspection: ${backup.name}`)
          .setColor(0x5865f2)
          .addFields(
            { name: '🆔 Server ID', value: `\`${backup.id}\``, inline: true },
            { name: '👑 Owner ID', value: `\`${backup.owner_id}\``, inline: true },
            { name: '🌐 Locale & Verification', value: `${backup.preferred_locale} | Level ${backup.verification_level}`, inline: true },
            { name: '🎭 Roles', value: `${shortNumber(backup.roles.length)} total (${shortNumber(restorableRoles)} restorable)`, inline: true },
            { name: '📁 Channels', value: `${shortNumber(backup.channels.length)} total (${categories} categories, ${textAndVoice} channels)`, inline: true },
            { name: '🎨 Assets', value: `${shortNumber(backup.emojis.length)} emojis, ${shortNumber(backup.stickers.length)} stickers`, inline: true }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === 'restore') {
        const attachment = interaction.options.getAttachment('file', true);
        if (!attachment.name.toLowerCase().endsWith('.json') && attachment.contentType !== 'application/json') {
          return interaction.editReply({
            embeds: [errorEmbed('Please provide a valid `.json` server export attachment.')],
          });
        }

        const mode = interaction.options.getString('mode') || 'merge';
        const dryRun = interaction.options.getBoolean('dry_run') ?? true;
        const confirmation = interaction.options.getString('confirm') || '';

        if (mode === 'replace' && confirmation !== 'RESTORE') {
          return interaction.editReply({
            embeds: [
              errorEmbed(
                '⚠️ **Replace mode is destructive.** It wipes existing channels/roles before restoring.\n\n' +
                'To proceed, run the command again with option `confirm: RESTORE`.'
              ),
            ],
          });
        }

        if (!dryRun && mode === 'replace' && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          return interaction.editReply({
            embeds: [errorEmbed('Only server **Administrators** can run a live replace restore.')],
          });
        }

        const rawData = await fetchJsonAttachment(attachment.url);
        const backup = parseBackup(rawData);
        const plan = createRestorePlan(interaction.guild, backup, mode);

        if (dryRun) {
          const embed = formatPlanEmbed(plan);
          embed.setDescription(
            'ℹ️ **Dry-Run Preview Only** — No changes have been made to your server.\n' +
            'To apply these changes live, run `/backup restore` with `dry_run: False`.'
          );
          return interaction.editReply({ embeds: [embed] });
        }

        const appliedPlan = await restoreGuild(interaction.guild, backup, mode);
        const embed = formatPlanEmbed(appliedPlan);
        embed.setDescription('✅ **Server Restore Successfully Completed!**');

        return interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === 'list') {
        if (!fs.existsSync(backupDirectory)) {
          return interaction.editReply({
            embeds: [successEmbed('No saved server export checkpoints found yet.')],
          });
        }

        const files = fs
          .readdirSync(backupDirectory)
          .filter((f) => f.endsWith('.json'))
          .sort()
          .reverse()
          .slice(0, 15);

        if (files.length === 0) {
          return interaction.editReply({
            embeds: [successEmbed('No saved server export checkpoints found yet.')],
          });
        }

        const listContent = files.map((f, idx) => `**${idx + 1}.** \`${f}\``).join('\n');
        const embed = successEmbed(listContent).setTitle('📂 Recent Server Export Checkpoints');
        return interaction.editReply({ embeds: [embed] });
      }
    } catch (err) {
      console.error('[BACKUP ERROR]', err);
      return interaction.editReply({
        embeds: [errorEmbed(`Operation failed: ${err.message}`)],
      });
    }
  },
};
