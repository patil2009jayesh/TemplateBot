const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { updateGuildSetting, getGuild } = require('../../services/guildService');
const { successEmbed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setautomod')
    .setDescription('Configure the automod system.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('antispam')
        .setDescription('Toggle anti-spam.')
        .addBooleanOption(o => o.setName('enabled').setDescription('Enable or disable').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('antiduplicate')
        .setDescription('Toggle anti-duplicate messages.')
        .addBooleanOption(o => o.setName('enabled').setDescription('Enable or disable').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('antilinks')
        .setDescription('Toggle anti-links.')
        .addBooleanOption(o => o.setName('enabled').setDescription('Enable or disable').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('anticaps')
        .setDescription('Toggle anti-caps (>70% uppercase).')
        .addBooleanOption(o => o.setName('enabled').setDescription('Enable or disable').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('badword')
        .setDescription('Add or remove a bad word from the filter.')
        .addStringOption(o => o.setName('word').setDescription('Word to add/remove').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('mentionlimit')
        .setDescription('Set the max number of mentions allowed per message.')
        .addIntegerOption(o => o.setName('limit').setDescription('Max mentions (1-20)').setMinValue(1).setMaxValue(20).setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('punishment')
        .setDescription('Set the default punishment for automod violations.')
        .addStringOption(o =>
          o.setName('type')
            .setDescription('Punishment type')
            .setRequired(true)
            .addChoices(
              { name: 'Warn', value: 'warn' },
              { name: 'Timeout (5 min)', value: 'timeout' },
              { name: 'Kick', value: 'kick' },
              { name: 'Ban', value: 'ban' }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View current automod settings.')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'antispam') {
      const enabled = interaction.options.getBoolean('enabled');
      await updateGuildSetting(guildId, 'automod', { antiSpam: enabled });
      return interaction.reply({ embeds: [successEmbed(`Anti-spam **${enabled ? 'enabled' : 'disabled'}**.`)] });
    }
    if (sub === 'antiduplicate') {
      const enabled = interaction.options.getBoolean('enabled');
      await updateGuildSetting(guildId, 'automod', { antiDuplicate: enabled });
      return interaction.reply({ embeds: [successEmbed(`Anti-duplicate **${enabled ? 'enabled' : 'disabled'}**.`)] });
    }
    if (sub === 'antilinks') {
      const enabled = interaction.options.getBoolean('enabled');
      await updateGuildSetting(guildId, 'automod', { antiLinks: enabled });
      return interaction.reply({ embeds: [successEmbed(`Anti-links **${enabled ? 'enabled' : 'disabled'}**.`)] });
    }
    if (sub === 'anticaps') {
      const enabled = interaction.options.getBoolean('enabled');
      await updateGuildSetting(guildId, 'automod', { antiCaps: enabled });
      return interaction.reply({ embeds: [successEmbed(`Anti-caps **${enabled ? 'enabled' : 'disabled'}**.`)] });
    }
    if (sub === 'badword') {
      const word = interaction.options.getString('word').toLowerCase();
      const guildData = await getGuild(guildId);
      const words = guildData.settings.automod.badWords || [];
      let msg;
      if (words.includes(word)) {
        const updated = words.filter(w => w !== word);
        await updateGuildSetting(guildId, 'automod', { badWords: updated });
        msg = `Removed **${word}** from the bad word filter.`;
      } else {
        words.push(word);
        await updateGuildSetting(guildId, 'automod', { badWords: words });
        msg = `Added **${word}** to the bad word filter.`;
      }
      return interaction.reply({ embeds: [successEmbed(msg)] });
    }
    if (sub === 'mentionlimit') {
      const limit = interaction.options.getInteger('limit');
      await updateGuildSetting(guildId, 'automod', { mentionLimit: limit });
      return interaction.reply({ embeds: [successEmbed(`Mention limit set to **${limit}**.`)] });
    }
    if (sub === 'punishment') {
      const type = interaction.options.getString('type');
      await updateGuildSetting(guildId, 'automod', { punishment: type });
      return interaction.reply({ embeds: [successEmbed(`AutoMod punishment set to **${type}**.`)] });
    }
    if (sub === 'view') {
      const guildData = await getGuild(guildId);
      const am = guildData.settings.automod;
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('AutoMod Settings')
        .addFields(
          { name: 'Anti-Spam', value: am.antiSpam ? '✅' : '❌', inline: true },
          { name: 'Anti-Duplicate', value: am.antiDuplicate ? '✅' : '❌', inline: true },
          { name: 'Anti-Links', value: am.antiLinks ? '✅' : '❌', inline: true },
          { name: 'Anti-Caps', value: am.antiCaps ? '✅' : '❌', inline: true },
          { name: 'Mention Limit', value: `${am.mentionLimit}`, inline: true },
          { name: 'Punishment', value: am.punishment, inline: true },
          { name: 'Bad Words', value: am.badWords?.length ? am.badWords.join(', ') : 'None' }
        );
      return interaction.reply({ embeds: [embed] });
    }
  },
};
