const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageFlags,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('View all available Tachos Dev commands and system features')
    .addStringOption((opt) =>
      opt
        .setName('category')
        .setDescription('Quickly jump to a command category')
        .addChoices(
          { name: '📦 Server Backup & Exporter', value: 'backup' },
          { name: '🛡️ Moderation & AutoMod', value: 'mod' },
          { name: '🎫 Tickets & Support', value: 'ticket' },
          { name: '🎁 Giveaways', value: 'giveaway' },
          { name: '⭐ Leveling & XP', value: 'leveling' },
          { name: '🔗 Invites & Roles', value: 'roles' },
          { name: '⚙️ Configuration', value: 'config' },
          { name: '🛠️ General Utility', value: 'utility' }
        )
        .setRequired(false)
    ),

  async execute(interaction) {
    const selected = interaction.options.getString('category') || 'main';

    const categories = {
      main: {
        title: '⚡ Tachos Dev — Command Dashboard',
        description:
          'Welcome! **Tachos Dev** is a comprehensive Discord bot featuring complete server backup & export tools, moderation, leveling, tickets, giveaways, auto-moderation, and community utilities.\n\n' +
          '**Select a category below or use `/help <category>` to view specific commands.**',
        fields: [
          { name: '📦 Server Exporter', value: '`/backup` — Export, inspect, dry-run & restore server JSONs', inline: true },
          { name: '🛡️ Moderation', value: '`/ban`, `/kick`, `/timeout`, `/warn`, `/clear`, `/setautomod`', inline: true },
          { name: '🎫 Tickets', value: '`/ticket` — Dynamic support tickets with private channels & staff teams', inline: true },
          { name: '🎁 Giveaways', value: '`/giveaway` — Standard, XP-based & Invite-based giveaway draws', inline: true },
          { name: '⭐ Leveling & XP', value: '`/rank`, `/leaderboard`, `/levelreward`, `/setleveling`', inline: true },
          { name: '🔗 Invites & Roles', value: '`/invites`, `/inviteleaderboard`, `/reactionrole`, `/buttonrole`', inline: true },
          { name: '⚙️ Configuration', value: '`/module`, `/setchannel`, `/setautorole`, `/setwelcome`, `/setupvc`', inline: true },
        ],
      },
      backup: {
        title: '📦 Server Backup & Exporter',
        description: 'Complete server structure snapshotting, dry-run diffs, and migration engine.',
        fields: [
          { name: '`/backup export`', value: 'Downloads complete server configuration (roles, channels, permissions, emojis, stickers) as a JSON file and saves a local checkpoint.', inline: false },
          { name: '`/backup inspect`', value: 'Displays real-time counts and health metrics for the server structure.', inline: false },
          { name: '`/backup restore <file> [mode] [dry_run]`', value: 'Upload a backup JSON to preview changes in safe dry-run mode or apply a Merge/Replace restore.', inline: false },
          { name: '`/backup list`', value: 'Lists recent backup checkpoints saved on the bot server.', inline: false },
        ],
      },
      mod: {
        title: '🛡️ Moderation & AutoMod',
        description: 'Keep your community safe with automated filters and quick staff actions.',
        fields: [
          { name: '`/ban <user> [reason]`', value: 'Ban a member from the server.', inline: true },
          { name: '`/kick <user> [reason]`', value: 'Kick a member from the server.', inline: true },
          { name: '`/timeout <user> <duration>`', value: 'Mute/timeout a user temporarily.', inline: true },
          { name: '`/unban <user_id>`', value: 'Unban a user by their Discord ID.', inline: true },
          { name: '`/warn <user> <reason>`', value: 'Issue a formal recorded warning.', inline: true },
          { name: '`/warnings <user>`', value: 'View past warnings for a user.', inline: true },
          { name: '`/clearwarnings <user>`', value: 'Clear warning history for a user.', inline: true },
          { name: '`/clear <amount>`', value: 'Bulk delete messages from the channel.', inline: true },
          { name: '`/setautomod`', value: 'Toggle anti-spam, anti-links, caps limit, and mention thresholds.', inline: false },
        ],
      },
      ticket: {
        title: '🎫 Ticket & Support System',
        description: 'Modal-driven ticket panels for staff-to-user support.',
        fields: [
          { name: '`/ticket`', value: 'Create support ticket teams and deploy interactive ticket creation buttons.', inline: false },
        ],
      },
      giveaway: {
        title: '🎁 Giveaway System',
        description: 'Host classic, message-XP weighted, or invite weighted giveaways.',
        fields: [
          { name: '`/giveaway`', value: 'Launch a giveaway with custom duration, winner count, and entry criteria.', inline: false },
        ],
      },
      leveling: {
        title: '⭐ Leveling & XP',
        description: 'Reward active chatters with XP and role perks.',
        fields: [
          { name: '`/rank [user]`', value: 'Check your or another member\'s XP rank card.', inline: true },
          { name: '`/leaderboard`', value: 'View the top XP chatters in the server.', inline: true },
          { name: '`/levelreward`', value: 'Set up automatic role unlocks at specified levels.', inline: true },
          { name: '`/setleveling`', value: 'Configure XP rate multiplier, rate limits, and announcement channels.', inline: false },
        ],
      },
      roles: {
        title: '🔗 Invites & Role Management',
        description: 'Track server invitations and let members pick self-assignable roles.',
        fields: [
          { name: '`/invites [user]`', value: 'Check total, real, fake, and left invites.', inline: true },
          { name: '`/inviteleaderboard`', value: 'View top server inviters.', inline: true },
          { name: '`/inviteinfo <code>`', value: 'Lookup metadata for an invite code.', inline: true },
          { name: '`/reactionrole`', value: 'Create reaction-based role assignment.', inline: true },
          { name: '`/buttonrole`', value: 'Create sleek button-based role assignment.', inline: true },
        ],
      },
      config: {
        title: '⚙️ Server Configuration',
        description: 'Manage server-wide settings, channels, and modules.',
        fields: [
          { name: '`/module`', value: 'Enable or disable specific features (Leveling, Tickets, Moderation, etc.).', inline: false },
          { name: '`/setchannel`', value: 'Set dedicated channels (logging, mod logs, leveling, welcome).', inline: false },
          { name: '`/setautorole`', value: 'Assign a default role to new members on join.', inline: false },
          { name: '`/setwelcome`', value: 'Customize welcome cards and messages.', inline: false },
          { name: '`/setupvc`', value: 'Set up automatic Temporary Voice Channels (Auto-VC).', inline: false },
          { name: '`/addcmd`, `/delcmd`, `/listcmds`', value: 'Manage custom server commands.', inline: false },
        ],
      },
      utility: {
        title: '🛠️ General Utility',
        description: 'Helpful everyday tools for members and staff.',
        fields: [
          { name: '`/avatar [user]`', value: 'View high-res avatar of a member.', inline: true },
          { name: '`/userinfo [user]`', value: 'Display joined dates, badges, and roles.', inline: true },
          { name: '`/serverinfo`', value: 'Display detailed server metrics.', inline: true },
          { name: '`/poll <question>`', value: 'Create an interactive server poll.', inline: true },
          { name: '`/remind <time> <msg>`', value: 'Set a timed reminder.', inline: true },
          { name: '`/afk [reason]`', value: 'Set your AFK status with auto-replies.', inline: true },
          { name: '`/ping`', value: 'Check bot latency & API response times.', inline: true },
          { name: '`/uptime`', value: 'Show Tachos Dev online duration.', inline: true },
        ],
      },
    };

    const catData = categories[selected] || categories.main;
    const embed = new EmbedBuilder()
      .setTitle(catData.title)
      .setDescription(catData.description)
      .setColor(0x5865f2)
      .addFields(catData.fields)
      .setFooter({ text: 'Tachos Dev • Server Management & Utilities' })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  },
};
