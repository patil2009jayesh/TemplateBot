const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a poll.')
    .addStringOption(o => o.setName('question').setDescription('Poll question').setRequired(true))
    .addStringOption(o => o.setName('options').setDescription('Options separated by | (e.g. Yes|No|Maybe). Leave empty for yes/no.')),

  async execute(interaction) {
    const question = interaction.options.getString('question');
    const raw = interaction.options.getString('options');

    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

    let options;
    if (raw) {
      options = raw.split('|').map(s => s.trim()).filter(Boolean).slice(0, 10);
      if (options.length < 2) {
        return interaction.reply({ content: 'Please provide at least 2 options separated by `|`.', ephemeral: true });
      }
    } else {
      options = ['Yes', 'No'];
    }

    const description = options.map((opt, i) => `${emojis[i]} ${opt}`).join('\n');

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📊 ${question}`)
      .setDescription(description)
      .setFooter({ text: `Poll by ${interaction.user.tag}` })
      .setTimestamp();

    const msg = await interaction.reply({ embeds: [embed], fetchReply: true });

    // Add reactions
    for (let i = 0; i < options.length; i++) {
      await msg.react(emojis[i]).catch(() => {});
    }
  },
};
