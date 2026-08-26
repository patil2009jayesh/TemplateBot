const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { errorEmbed, successEmbed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Delete a number of messages from the channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(o => o.setName('amount').setDescription('Number of messages to delete (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption(o => o.setName('user').setDescription('Only delete messages from this user')),

  async execute(interaction) {
    const amount = interaction.options.getInteger('amount');
    const targetUser = interaction.options.getUser('user');

    await interaction.deferReply({ ephemeral: true });

    let messages = await interaction.channel.messages.fetch({ limit: 100 });

    if (targetUser) {
      messages = messages.filter(m => m.author.id === targetUser.id);
    }

    // Limit to the requested amount
    messages = messages.first(amount);

    // Bulk delete only works for messages < 14 days old
    const deleted = await interaction.channel.bulkDelete(messages, true).catch(() => null);

    const count = deleted ? deleted.size : 0;
    await interaction.editReply({
      embeds: [successEmbed(`Deleted **${count}** message(s).`)],
    });
  },
};
