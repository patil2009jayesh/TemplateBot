const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription("Get a user's avatar.")
    .addUserOption(o => o.setName('user').setDescription('User to get avatar of')),

  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`${target.username}'s Avatar`)
      .setImage(target.displayAvatarURL({ dynamic: true, size: 512 }))
      .addFields({
        name: 'Links',
        value: `[PNG](${target.displayAvatarURL({ format: 'png', size: 512 })}) | [JPG](${target.displayAvatarURL({ format: 'jpg', size: 512 })}) | [WEBP](${target.displayAvatarURL({ format: 'webp', size: 512 })})`,
      });

    await interaction.reply({ embeds: [embed] });
  },
};
