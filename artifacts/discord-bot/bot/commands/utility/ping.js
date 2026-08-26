const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot latency.'),

  async execute(interaction) {
    const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
    const ws = interaction.client.ws.ping;

    const embed = new EmbedBuilder()
      .setColor(ws < 100 ? 0x44ff88 : ws < 200 ? 0xf1c40f : 0xff4444)
      .setTitle('🏓 Pong!')
      .addFields(
        { name: 'Roundtrip', value: `${roundtrip}ms`, inline: true },
        { name: 'WebSocket', value: `${ws}ms`, inline: true }
      );

    await interaction.editReply({ content: null, embeds: [embed] });
  },
};
