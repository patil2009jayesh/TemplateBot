const { ChannelType } = require('discord.js');

const SUPPORTED_CHANNEL_TYPES = new Set([
  ChannelType.GuildText,
  ChannelType.GuildVoice,
  ChannelType.GuildCategory,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildStageVoice,
  ChannelType.GuildForum,
  ChannelType.GuildMedia,
]);

const BULK_API_DELAY_MS = 250;

function delayBetweenBulkRequests() {
  return new Promise((resolve) => setTimeout(resolve, BULK_API_DELAY_MS));
}

function isRecord(value) {
  return Boolean(value && typeof value === 'object');
}

function nullableString(value) {
  return typeof value === 'string' ? value : null;
}

function asNumber(value, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function stringArray(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === 'string')
    : [];
}

async function exportOnboarding(guild) {
  try {
    const onboarding = await guild.fetchOnboarding();
    if (!onboarding) return undefined;
    return {
      prompts: onboarding.prompts?.map((prompt) => ({
        id: prompt.id,
        title: prompt.title,
        single_select: prompt.singleSelect,
        required: prompt.required,
        in_onboarding: prompt.inOnboarding,
        type: prompt.type,
        options: prompt.options?.map((option) => ({
          id: option.id,
          title: option.title,
          description: option.description,
          channels: option.channels?.map((c) => c.id) || [],
          roles: option.roles?.map((r) => r.id) || [],
          emoji: option.emoji
            ? {
                id: option.emoji.id,
                name: option.emoji.name,
                animated: option.emoji.animated ?? undefined,
              }
            : null,
        })) || [],
      })) || [],
      enabled: onboarding.enabled ?? false,
      mode: onboarding.mode ?? 0,
      defaultChannelIds: onboarding.defaultChannels?.map((c) => c.id) || [],
    };
  } catch {
    return undefined;
  }
}

async function exportAutoModerationRules(guild) {
  try {
    const rules = await guild.autoModerationRules.fetch();
    return rules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      event_type: rule.eventType,
      trigger_type: rule.triggerType,
      trigger_metadata: {
        keyword_filter: rule.triggerMetadata?.keywordFilter,
        regex_patterns: rule.triggerMetadata?.regexPatterns,
        presets: rule.triggerMetadata?.presets,
        allow_list: rule.triggerMetadata?.allowList,
        mention_total_limit: rule.triggerMetadata?.mentionTotalLimit,
        mention_raid_protection_enabled: rule.triggerMetadata?.mentionRaidProtectionEnabled,
      },
      actions: rule.actions?.map((action) => ({
        type: action.type,
        metadata: {
          channel_id: action.metadata?.channelId,
          duration_seconds: action.metadata?.durationSeconds,
          custom_message: action.metadata?.customMessage,
        },
      })) || [],
      enabled: rule.enabled,
      exempt_role_ids: rule.exemptRoles?.map((role) => role.id) || [],
      exempt_channel_ids: rule.exemptChannels?.map((channel) => channel.id) || [],
    }));
  } catch {
    return [];
  }
}

function roleToExport(role) {
  return {
    id: role.id,
    name: role.name,
    description: null,
    // Preserve 100% exact permissions bitfield without artificial stripping
    permissions: role.permissions.bitfield.toString(),
    position: role.position,
    color: role.color,
    colors: {
      primary_color: role.colors?.primaryColor,
      secondary_color: role.colors?.secondaryColor,
      tertiary_color: role.colors?.tertiaryColor,
    },
    hoist: role.hoist,
    managed: role.managed,
    mentionable: role.mentionable,
    icon: role.iconURL ? role.iconURL({ size: 128, extension: 'png' }) : role.icon,
    unicode_emoji: role.unicodeEmoji,
    tags: role.tags
      ? {
          bot_id: role.tags.botId ?? null,
          integration_id: role.tags.integrationId ?? null,
          subscription_listing_id: role.tags.subscriptionListingId ?? null,
          premium_subscriber: Boolean(role.tags.premiumSubscriberRole),
        }
      : undefined,
    flags: role.flags?.bitfield ?? 0,
  };
}

function channelToExport(channel) {
  const rawChannel = channel;
  const permissionOverwrites =
    rawChannel.permissionOverwrites?.cache?.map((overwrite) => ({
      id: overwrite.id,
      type: overwrite.type,
      allow: overwrite.allow.bitfield.toString(),
      deny: overwrite.deny.bitfield.toString(),
    })) ?? [];

  const base = {
    id: channel.id,
    type: channel.type,
    name: channel.name,
    parent_id: channel.parentId,
    position: rawChannel.rawPosition ?? 0,
    flags: channel.flags?.bitfield ?? 0,
    permission_overwrites: permissionOverwrites,
  };

  if (channel.isTextBased() && 'topic' in channel) {
    base.topic = nullableString(channel.topic);
  }
  if ('nsfw' in channel) base.nsfw = asBoolean(channel.nsfw);
  if ('rateLimitPerUser' in channel) base.rate_limit_per_user = asNumber(channel.rateLimitPerUser);
  if ('bitrate' in channel) base.bitrate = asNumber(channel.bitrate);
  if ('userLimit' in channel) base.user_limit = asNumber(channel.userLimit);
  if ('rtcRegion' in channel) base.rtc_region = nullableString(channel.rtcRegion);
  if ('videoQualityMode' in channel) base.video_quality_mode = channel.videoQualityMode ?? null;
  if ('defaultAutoArchiveDuration' in channel) {
    base.default_auto_archive_duration = channel.defaultAutoArchiveDuration ?? null;
  }
  if ('defaultThreadRateLimitPerUser' in channel) {
    base.default_thread_rate_limit_per_user = channel.defaultThreadRateLimitPerUser ?? undefined;
  }
  if ('defaultReactionEmoji' in channel && channel.defaultReactionEmoji) {
    base.default_reaction_emoji = {
      emoji_id: channel.defaultReactionEmoji.id,
      emoji_name: channel.defaultReactionEmoji.name,
    };
  }
  if ('availableTags' in channel && Array.isArray(channel.availableTags)) {
    base.available_tags = channel.availableTags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      moderated: tag.moderated,
      emoji_id: tag.emoji?.id ?? null,
      emoji_name: tag.emoji?.name ?? null,
    }));
  }
  if ('defaultSortOrder' in channel) {
    base.default_sort_order = channel.defaultSortOrder ?? null;
  }
  if ('defaultForumLayout' in channel) {
    base.default_forum_layout = channel.defaultForumLayout ?? null;
  }

  return base;
}

function parseBackup(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('The uploaded file must contain a JSON object.');
  }

  const value = input;
  if (!Array.isArray(value.roles) || !Array.isArray(value.channels)) {
    throw new Error('Invalid backup file: server "roles" and "channels" arrays are required.');
  }
  if (typeof value.name !== 'string' || value.name.trim().length === 0) {
    throw new Error('The backup must include a valid server name.');
  }

  const roles = value.roles.filter((r) => r && typeof r === 'object');
  const channels = value.channels.filter((c) => c && typeof c === 'object');

  return {
    ...value,
    schema_version: 2,
    exported_at: typeof value.exported_at === 'string' ? value.exported_at : new Date().toISOString(),
    id: typeof value.id === 'string' ? value.id : 'unknown',
    name: value.name,
    icon_url: nullableString(value.icon_url),
    banner_url: nullableString(value.banner_url),
    splash_url: nullableString(value.splash_url),
    description: nullableString(value.description),
    owner_id: typeof value.owner_id === 'string' ? value.owner_id : 'unknown',
    application_id: nullableString(value.application_id),
    features: Array.isArray(value.features) ? value.features.filter((f) => typeof f === 'string') : [],
    roles: roles.map((role, index) => ({
      id: typeof role.id === 'string' ? role.id : `role-${index}`,
      name: typeof role.name === 'string' ? role.name : 'Role',
      permissions: typeof role.permissions === 'string' ? role.permissions : '0',
      position: asNumber(role.position),
      color: asNumber(role.color),
      colors: role.colors,
      hoist: asBoolean(role.hoist),
      managed: asBoolean(role.managed),
      mentionable: asBoolean(role.mentionable),
      icon: nullableString(role.icon),
      unicode_emoji: nullableString(role.unicode_emoji),
      tags: role.tags,
      flags: asNumber(role.flags),
    })),
    channels: channels.map((channel, index) => ({
      id: typeof channel.id === 'string' ? channel.id : `channel-${index}`,
      type: asNumber(channel.type),
      guild_id: nullableString(channel.guild_id) ?? undefined,
      name: typeof channel.name === 'string' ? channel.name : 'channel',
      parent_id: nullableString(channel.parent_id),
      position: asNumber(channel.position),
      flags: asNumber(channel.flags),
      topic: nullableString(channel.topic),
      nsfw: asBoolean(channel.nsfw),
      rate_limit_per_user: asNumber(channel.rate_limit_per_user),
      bitrate: asNumber(channel.bitrate),
      user_limit: asNumber(channel.user_limit),
      rtc_region: nullableString(channel.rtc_region),
      video_quality_mode: typeof channel.video_quality_mode === 'number' ? channel.video_quality_mode : null,
      default_auto_archive_duration: typeof channel.default_auto_archive_duration === 'number' ? channel.default_auto_archive_duration : null,
      default_thread_rate_limit_per_user: asNumber(channel.default_thread_rate_limit_per_user),
      permission_overwrites: Array.isArray(channel.permission_overwrites)
        ? channel.permission_overwrites.filter((item) => item && typeof item === 'object' && typeof item.id === 'string')
        : [],
      default_reaction_emoji: channel.default_reaction_emoji,
      available_tags: channel.available_tags,
      default_sort_order: typeof channel.default_sort_order === 'number' ? channel.default_sort_order : null,
      default_forum_layout: typeof channel.default_forum_layout === 'number' ? channel.default_forum_layout : null,
    })),
    emojis: Array.isArray(value.emojis)
      ? value.emojis.filter((item) => item && typeof item === 'object' && typeof item.name === 'string' && typeof item.url === 'string')
      : [],
    stickers: Array.isArray(value.stickers)
      ? value.stickers.filter((item) => item && typeof item === 'object' && typeof item.name === 'string' && typeof item.url === 'string')
      : [],
    onboarding_prompts: value.onboarding_prompts,
    onboarding_enabled: typeof value.onboarding_enabled === 'boolean' ? value.onboarding_enabled : undefined,
    onboarding_mode: typeof value.onboarding_mode === 'number' ? value.onboarding_mode : undefined,
    onboarding_default_channel_ids: Array.isArray(value.onboarding_default_channel_ids)
      ? value.onboarding_default_channel_ids.filter((id) => typeof id === 'string')
      : undefined,
    auto_moderation_rules: value.auto_moderation_rules,
  };
}

async function exportGuild(guild, applicationId) {
  await Promise.all([
    guild.roles.fetch().catch(() => {}),
    guild.channels.fetch().catch(() => {}),
    guild.emojis.fetch().catch(() => {}),
    guild.stickers.fetch().catch(() => {}),
  ]);

  const [onboarding, autoModerationRules] = await Promise.all([
    exportOnboarding(guild),
    exportAutoModerationRules(guild),
  ]);

  const channels = guild.channels.cache
    .filter(Boolean)
    .sort((a, b) => (a.rawPosition ?? 0) - (b.rawPosition ?? 0))
    .map(channelToExport);

  return {
    schema_version: 2,
    exported_at: new Date().toISOString(),
    exporter: { name: 'Tachos Dev Exporter Suite', version: '2.0.0', application_id: applicationId },
    id: guild.id,
    name: guild.name,
    icon: guild.icon,
    icon_url: guild.iconURL({ size: 1024, extension: 'png' }),
    banner: guild.banner,
    banner_url: guild.bannerURL ? guild.bannerURL({ size: 1024, extension: 'png' }) : null,
    splash: guild.splash,
    splash_url: guild.splashURL ? guild.splashURL({ size: 1024, extension: 'png' }) : null,
    discovery_splash: guild.discoverySplash,
    discovery_splash_url: guild.discoverySplashURL ? guild.discoverySplashURL({ size: 1024, extension: 'png' }) : null,
    description: guild.description,
    features: [...guild.features],
    owner_id: guild.ownerId,
    application_id: guild.client.application?.id || applicationId,
    afk_channel_id: guild.afkChannelId,
    afk_timeout: guild.afkTimeout,
    system_channel_id: guild.systemChannelId,
    system_channel_flags: guild.systemChannelFlags?.bitfield ?? 0,
    widget_enabled: guild.widgetEnabled ?? false,
    widget_channel_id: guild.widgetChannelId,
    verification_level: guild.verificationLevel,
    default_message_notifications: guild.defaultMessageNotifications,
    mfa_level: guild.mfaLevel,
    explicit_content_filter: guild.explicitContentFilter,
    preferred_locale: guild.preferredLocale,
    rules_channel_id: guild.rulesChannelId,
    safety_alerts_channel_id: guild.safetyAlertsChannelId,
    public_updates_channel_id: guild.publicUpdatesChannelId,
    premium_progress_bar_enabled: guild.premiumProgressBarEnabled ?? false,
    roles: guild.roles.cache
      .sort((a, b) => a.position - b.position)
      .map(roleToExport),
    emojis: guild.emojis.cache.map((emoji) => ({
      id: emoji.id,
      name: emoji.name ?? 'emoji',
      url: emoji.url,
      animated: Boolean(emoji.animated),
      roles: emoji.roles?.cache?.map((role) => role.id) || [],
    })),
    stickers: guild.stickers.cache.map((sticker) => ({
      id: sticker.id,
      name: sticker.name,
      description: sticker.description,
      tags: sticker.tags ?? 'restored',
      url: sticker.url,
      format_type: sticker.format,
    })),
    onboarding_prompts: onboarding?.prompts,
    onboarding_enabled: onboarding?.enabled,
    onboarding_mode: onboarding?.mode,
    onboarding_default_channel_ids: onboarding?.defaultChannelIds,
    auto_moderation_rules: autoModerationRules,
    channels,
  };
}

function channelMatch(channel, source, parentId) {
  return (
    channel.type === source.type &&
    channel.name === source.name &&
    (channel.parentId ?? null) === parentId
  );
}

function roleMatch(role, source) {
  return !role.managed && role.name === source.name;
}

function supportedChannelType(type) {
  return SUPPORTED_CHANNEL_TYPES.has(type);
}

function isManagedSourceRole(role) {
  return Boolean(role.managed || (typeof role.tags?.bot_id === 'string' && role.tags.bot_id.length > 0));
}

function sourceRoleCanBeCreated(role) {
  return role.name !== '@everyone' && !isManagedSourceRole(role);
}

function mapSourceId(id, roleMap, channelMap, guild) {
  if (!id) return null;
  if (id === guild.id) return guild.id;
  return roleMap.get(id) ?? channelMap.get(id) ?? null;
}

function createRestorePlan(guild, backup, mode) {
  const warnings = [];
  const existingRoles = [...guild.roles.cache.values()];
  const existingChannels = [...guild.channels.cache.values()].filter(Boolean);
  const sourceRoles = backup.roles.filter((role) => role.id !== backup.id && sourceRoleCanBeCreated(role));
  const sourceCategories = backup.channels.filter((channel) => channel.type === ChannelType.GuildCategory);
  const sourceChannels = backup.channels.filter((channel) => channel.type !== ChannelType.GuildCategory);

  if (mode === 'replace') {
    warnings.push('Replace mode wipes all existing non-managed channels and roles before recreating structure.');
  }
  if (backup.owner_id !== guild.ownerId) {
    warnings.push('Backup owner differs from destination server owner; ownership remains unchanged.');
  }
  if (backup.features?.includes('COMMUNITY') && !guild.features.includes('COMMUNITY')) {
    warnings.push('Destination server is not Community-enabled; community channels (rules/announcements) will fall back safely.');
  }

  const roleCreate = mode === 'replace'
    ? sourceRoles.length
    : sourceRoles.filter((source) => !existingRoles.some((role) => roleMatch(role, source))).length;
  const roleUpdate = mode === 'replace' ? 0 : sourceRoles.length - roleCreate;

  const categoryCreate = mode === 'replace'
    ? sourceCategories.length
    : sourceCategories.filter((source) => !existingChannels.some((channel) => channelMatch(channel, source, null))).length;
  const categoryUpdate = sourceCategories.length - categoryCreate;

  const supportedSources = sourceChannels.filter((source) => supportedChannelType(source.type));

  return {
    mode,
    backupName: backup.name,
    roles: {
      create: roleCreate,
      update: roleUpdate,
      skipManaged: backup.roles.filter(isManagedSourceRole).length,
    },
    categories: { create: categoryCreate, update: categoryUpdate },
    channels: {
      create: mode === 'replace'
        ? supportedSources.length
        : supportedSources.filter((source) => !existingChannels.some((channel) => channelMatch(channel, source, source.parent_id))).length,
      update: mode === 'replace'
        ? 0
        : supportedSources.filter((source) => existingChannels.some((channel) => channelMatch(channel, source, source.parent_id))).length,
      skipUnsupported: backup.channels.filter((channel) => !supportedChannelType(channel.type)).length,
    },
    emojis: {
      create: mode === 'replace'
        ? backup.emojis.length
        : backup.emojis.filter((emoji) => !guild.emojis.cache.some((existing) => existing.name === emoji.name)).length,
      skipExisting: mode === 'replace'
        ? 0
        : backup.emojis.filter((emoji) => guild.emojis.cache.some((existing) => existing.name === emoji.name)).length,
    },
    stickers: {
      create: mode === 'replace'
        ? backup.stickers.length
        : backup.stickers.filter((sticker) => !guild.stickers.cache.some((existing) => existing.name === sticker.name)).length,
      skipExisting: mode === 'replace'
        ? 0
        : backup.stickers.filter((sticker) => guild.stickers.cache.some((existing) => existing.name === sticker.name)).length,
    },
    onboardingPrompts: {
      create: backup.onboarding_prompts?.length ?? 0,
      skipped: 0,
    },
    autoModerationRules: {
      create: backup.auto_moderation_rules?.length ?? 0,
      update: 0,
      skipped: 0,
    },
    warnings,
  };
}

function roleOptions(source) {
  return {
    name: source.name.slice(0, 100),
    color: source.color,
    hoist: source.hoist,
    mentionable: source.mentionable,
    permissions: BigInt(source.permissions || '0'),
    unicodeEmoji: source.unicode_emoji ?? undefined,
  };
}

function channelOptions(source, parent) {
  const options = {
    name: source.name.slice(0, 100),
    type: source.type,
    parent: parent ?? undefined,
    topic: source.topic ?? undefined,
    nsfw: Boolean(source.nsfw),
    rateLimitPerUser: source.rate_limit_per_user || 0,
    userLimit: source.user_limit || 0,
    rtcRegion: source.rtc_region ?? undefined,
    videoQualityMode: source.video_quality_mode ?? undefined,
    defaultAutoArchiveDuration: source.default_auto_archive_duration ?? undefined,
    defaultThreadRateLimitPerUser: source.default_thread_rate_limit_per_user ?? undefined,
    defaultSortOrder: source.default_sort_order ?? undefined,
    defaultForumLayout: source.default_forum_layout ?? undefined,
  };

  if (source.type === ChannelType.GuildVoice) {
    const rawBitrate = typeof source.bitrate === 'number' && Number.isFinite(source.bitrate) ? Math.trunc(source.bitrate) : 64000;
    options.bitrate = Math.min(96000, Math.max(8000, rawBitrate || 64000));
  }

  if (source.default_reaction_emoji) {
    options.defaultReactionEmoji = {
      emojiId: source.default_reaction_emoji.emoji_id ?? undefined,
      emojiName: source.default_reaction_emoji.emoji_name ?? undefined,
    };
  }
  if (source.available_tags && Array.isArray(source.available_tags)) {
    options.availableTags = source.available_tags.map((tag) => ({
      name: tag.name,
      moderated: Boolean(tag.moderated),
      emoji: tag.emoji_id ?? tag.emoji_name ?? undefined,
    }));
  }
  return options;
}

function permissionOverwrites(source, roleMap, channelMap, guild) {
  const result = [];
  for (const overwrite of source ?? []) {
    const id = overwrite.type === 0
      ? (overwrite.id === guild.id ? guild.id : roleMap.get(overwrite.id))
      : guild.members.cache.has(overwrite.id) ? overwrite.id : null;

    if (!id) continue;
    result.push({
      id,
      type: overwrite.type,
      allow: BigInt(overwrite.allow || '0'),
      deny: BigInt(overwrite.deny || '0'),
    });
  }
  return result;
}

async function deleteExisting(guild) {
  // Delete channels first
  for (const channel of [...guild.channels.cache.values()].filter(Boolean)) {
    try {
      await channel.delete('Tachos Dev Exporter replace restore');
      await delayBetweenBulkRequests();
    } catch (err) {
      console.warn(`[BACKUP] Could not delete channel ${channel.name}:`, err.message);
    }
  }
  // Delete custom non-managed roles
  for (const role of [...guild.roles.cache.values()].filter((r) => !r.managed && r.id !== guild.id)) {
    try {
      await role.delete('Tachos Dev Exporter replace restore');
      await delayBetweenBulkRequests();
    } catch (err) {
      console.warn(`[BACKUP] Could not delete role ${role.name}:`, err.message);
    }
  }
}

async function restoreGuild(guild, backup, mode) {
  const plan = createRestorePlan(guild, backup, mode);
  if (mode === 'replace') await deleteExisting(guild);

  await Promise.all([guild.roles.fetch(), guild.channels.fetch()]);
  const roleMap = new Map();
  const channelMap = new Map();
  roleMap.set(backup.id, guild.id);

  // 1. Update @everyone role permissions
  const sourceEveryone = backup.roles.find((r) => r.name === '@everyone' || r.id === backup.id);
  if (sourceEveryone && guild.roles.everyone) {
    try {
      await guild.roles.everyone.setPermissions(BigInt(sourceEveryone.permissions || '0'), 'Tachos Dev Exporter restore @everyone permissions');
    } catch (err) {
      plan.warnings.push(`Could not update @everyone permissions: ${err.message}`);
    }
  }

  // 2. Map existing roles
  for (const source of backup.roles) {
    const existing = isManagedSourceRole(source)
      ? guild.roles.cache.find((candidate) => candidate.managed && candidate.name === source.name)
      : mode === 'merge'
        ? guild.roles.cache.find((candidate) => roleMatch(candidate, source))
        : undefined;
    if (existing) roleMap.set(source.id, existing.id);
  }

  // 3. Create or Edit Roles
  for (const source of backup.roles.filter(sourceRoleCanBeCreated).sort((a, b) => a.position - b.position)) {
    let role = mode === 'merge' ? guild.roles.cache.get(roleMap.get(source.id) ?? '') : undefined;
    try {
      if (role) {
        await role.edit(roleOptions(source));
      } else {
        role = await guild.roles.create(roleOptions(source));
        await delayBetweenBulkRequests();
      }
      roleMap.set(source.id, role.id);
    } catch (err) {
      plan.warnings.push(`Could not create/edit role "${source.name}": ${err.message}`);
    }
  }

  // Set role ordering safely
  const restorableRoles = backup.roles.filter(sourceRoleCanBeCreated).sort((a, b) => a.position - b.position);
  const botHighestPosition = guild.members.me?.roles.highest.position ?? 0;
  const highestSourcePosition = restorableRoles.at(-1)?.position ?? 0;
  const maxManageablePosition = botHighestPosition - 1;

  if (restorableRoles.length > 0 && maxManageablePosition > 0) {
    const positionOffset = Math.min(0, maxManageablePosition - highestSourcePosition);
    const positionEntries = restorableRoles
      .map((sourceRole) => ({
        role: roleMap.get(sourceRole.id),
        position: Math.max(1, sourceRole.position + positionOffset),
      }))
      .filter((entry) => Boolean(entry.role));

    if (restorableRoles.length <= maxManageablePosition) {
      await guild.roles.setPositions(positionEntries).catch(() => {});
    }
  }

  // 4. Create or Edit Categories
  const categories = backup.channels.filter((c) => c.type === ChannelType.GuildCategory).sort((a, b) => a.position - b.position);
  for (const source of categories) {
    let channel = mode === 'merge' ? guild.channels.cache.find((candidate) => channelMatch(candidate, source, null)) : undefined;
    try {
      if (channel) {
        await channel.edit(channelOptions(source, null));
      } else {
        channel = await guild.channels.create(channelOptions(source, null));
        await delayBetweenBulkRequests();
      }
      channelMap.set(source.id, channel.id);
    } catch (err) {
      plan.warnings.push(`Could not create category "${source.name}": ${err.message}`);
    }
  }

  // 5. Create or Edit Channels
  const channels = backup.channels
    .filter((c) => c.type !== ChannelType.GuildCategory && supportedChannelType(c.type))
    .sort((a, b) => a.position - b.position);

  for (const source of channels) {
    const parent = mapSourceId(source.parent_id, roleMap, channelMap, guild);
    let channel = mode === 'merge' ? guild.channels.cache.find((candidate) => channelMatch(candidate, source, parent)) : undefined;
    try {
      if (channel) {
        await channel.edit(channelOptions(source, parent));
      } else {
        channel = await guild.channels.create(channelOptions(source, parent));
        await delayBetweenBulkRequests();
      }
      channelMap.set(source.id, channel.id);
    } catch (err) {
      plan.warnings.push(`Could not create channel "${source.name}": ${err.message}`);
    }
  }

  // 6. Set Channel Permission Overwrites
  for (const source of backup.channels.filter((item) => channelMap.has(item.id))) {
    const channel = guild.channels.cache.get(channelMap.get(source.id));
    if (!channel || !('permissionOverwrites' in channel)) continue;
    const overwrites = permissionOverwrites(source.permission_overwrites, roleMap, channelMap, guild);
    if (overwrites.length > 0) {
      await channel.permissionOverwrites.set(overwrites, 'Tachos Dev Exporter restore permissions').catch(() => {});
      await delayBetweenBulkRequests();
    }
  }

  // 7. Update Server Settings Safely
  const targetSettings = {
    name: backup.name.slice(0, 100),
    description: backup.description ?? undefined,
    verificationLevel: backup.verification_level,
    defaultMessageNotifications: backup.default_message_notifications,
    explicitContentFilter: backup.explicit_content_filter,
    afkTimeout: backup.afk_timeout,
    preferredLocale: backup.preferred_locale,
    systemChannelFlags: backup.system_channel_flags,
    afkChannel: mapSourceId(backup.afk_channel_id, roleMap, channelMap, guild),
    systemChannel: mapSourceId(backup.system_channel_id, roleMap, channelMap, guild),
  };

  // Only apply community channels if destination is community-enabled
  if (guild.features.includes('COMMUNITY')) {
    targetSettings.rulesChannel = mapSourceId(backup.rules_channel_id, roleMap, channelMap, guild);
    targetSettings.publicUpdatesChannel = mapSourceId(backup.public_updates_channel_id, roleMap, channelMap, guild);
    targetSettings.safetyAlertsChannel = mapSourceId(backup.safety_alerts_channel_id, roleMap, channelMap, guild);
  }

  // Apply server icon if available
  if (backup.icon_url) {
    try {
      targetSettings.icon = backup.icon_url;
    } catch {}
  }

  await guild.edit(targetSettings).catch((err) => {
    plan.warnings.push(`Server base settings update notice: ${err.message}`);
  });

  // 8. Restore Emojis
  for (const emoji of backup.emojis) {
    if (mode === 'merge' && guild.emojis.cache.some((existing) => existing.name === emoji.name)) continue;
    try {
      await guild.emojis.create({
        attachment: emoji.url,
        name: emoji.name.slice(0, 32),
        roles: (emoji.roles ?? []).map((id) => roleMap.get(id)).filter(Boolean),
        reason: 'Tachos Dev Exporter restore',
      });
      await delayBetweenBulkRequests();
    } catch {
      plan.warnings.push(`Could not restore emoji "${emoji.name}".`);
    }
  }

  // 9. Restore Stickers
  for (const sticker of backup.stickers) {
    if (mode === 'merge' && guild.stickers.cache.some((existing) => existing.name === sticker.name)) continue;
    try {
      await guild.stickers.create({
        file: sticker.url,
        name: sticker.name.slice(0, 30),
        description: sticker.description ?? 'Restored server sticker',
        tags: sticker.tags || 'restored',
        reason: 'Tachos Dev Exporter restore',
      });
      await delayBetweenBulkRequests();
    } catch {
      plan.warnings.push(`Could not restore sticker "${sticker.name}".`);
    }
  }

  return plan;
}

module.exports = {
  exportGuild,
  parseBackup,
  createRestorePlan,
  restoreGuild,
};
