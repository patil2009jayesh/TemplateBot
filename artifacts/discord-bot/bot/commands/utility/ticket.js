const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { setupTicketTeam, postTicketMessage } = require('../../systems/ticketSystem');
const db = require('../../database/sqlite');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('🎫 Manage the ticket system')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('setup-team')
        .setDescription('👥 Create a staff team for handling tickets')
        .addStringOption(opt => opt.setName('name').setDescription('Team Name (e.g. Support Team A)').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Staff role for this team').setRequired(true))
        .addChannelOption(opt => opt.setName('category').setDescription('Category to create tickets in').addChannelTypes(ChannelType.GuildCategory))
    )
    .addSubcommand(sub =>
      sub.setName('post')
        .setDescription('📩 Post the ticket creation message')
        .addIntegerOption(opt => 
          opt.setName('team_id')
            .setDescription('ID of the team to handle these tickets')
            .setRequired(true))
        .addStringOption(opt => opt.setName('title').setDescription('Embed title').setRequired(true))
        .addStringOption(opt => opt.setName('description').setDescription('Embed description').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('list-teams')
        .setDescription('📋 List all setup ticket teams')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup-team') {
      const name = interaction.options.getString('name');
      const role = interaction.options.getRole('role');
      const category = interaction.options.getChannel('category');
      await setupTicketTeam(interaction, name, role.id, category?.id || null);
    }

    if (sub === 'post') {
      const teamId = interaction.options.getInteger('team_id');
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      await postTicketMessage(interaction, title, description, teamId);
    }

    if (sub === 'list-teams') {
      const teams = db.prepare('SELECT * FROM ticket_teams WHERE guild_id = ?').all(interaction.guildId);
      if (!teams.length) return interaction.reply({ content: '❌ No ticket teams found. Create one with `/ticket setup-team`.', flags: 64 });

      const list = teams.map(t => `ID: **${t.id}** | Name: **${t.team_name}** | Staff Role: <@&${t.staff_role_id}>`).join('\n');
      interaction.reply({ content: `**Support Teams:**\n${list}`, flags: 64 });
    }
  },
};
