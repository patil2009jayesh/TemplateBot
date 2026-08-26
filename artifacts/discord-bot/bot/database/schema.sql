-- ============================================================
--  FULL BOT SCHEMA — paste everything into Supabase SQL Editor
--  and click RUN. Safe to run multiple times (IF NOT EXISTS).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. GUILDS
--    Stores per-guild config: modules on/off, channel IDs,
--    role IDs, and miscellaneous settings.
--    All complex defaults are managed by the application.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guilds (
  guild_id   TEXT        PRIMARY KEY,
  modules    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  channels   JSONB       NOT NULL DEFAULT '{}'::jsonb,
  roles      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  settings   JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 2. USERS
--    XP, level, and AFK state per user per guild.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id         BIGSERIAL   PRIMARY KEY,
  user_id    TEXT        NOT NULL,
  guild_id   TEXT        NOT NULL,
  xp         BIGINT      NOT NULL DEFAULT 0,
  level      INTEGER     NOT NULL DEFAULT 0,
  afk        BOOLEAN     NOT NULL DEFAULT FALSE,
  afk_reason TEXT,
  afk_since  TIMESTAMPTZ,
  UNIQUE (user_id, guild_id)
);

-- ────────────────────────────────────────────────────────────
-- 3. INVITES
--    Tracks invite counts, fakes, and who invited whom.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invites (
  id             BIGSERIAL PRIMARY KEY,
  guild_id       TEXT      NOT NULL,
  user_id        TEXT      NOT NULL,
  inviter_id     TEXT,
  invites_count  INTEGER   NOT NULL DEFAULT 0,
  fake_invites   INTEGER   NOT NULL DEFAULT 0,
  left_invites   INTEGER   NOT NULL DEFAULT 0,
  UNIQUE (guild_id, user_id)
);

-- ────────────────────────────────────────────────────────────
-- 4. WARNINGS
--    One row per warning issued by a moderator.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warnings (
  id           BIGSERIAL   PRIMARY KEY,
  user_id      TEXT        NOT NULL,
  guild_id     TEXT        NOT NULL,
  moderator_id TEXT        NOT NULL,
  reason       TEXT        NOT NULL DEFAULT 'No reason provided',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 5. CUSTOM COMMANDS
--    Guild-specific slash/text commands with a text response.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS custom_commands (
  id         BIGSERIAL   PRIMARY KEY,
  guild_id   TEXT        NOT NULL,
  name       TEXT        NOT NULL,
  response   TEXT        NOT NULL,
  created_by TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guild_id, name)
);

-- ────────────────────────────────────────────────────────────
-- 6. REACTION ROLES
--    Maps a message + emoji combination to a Discord role.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reaction_roles (
  id         BIGSERIAL PRIMARY KEY,
  guild_id   TEXT      NOT NULL,
  message_id TEXT      NOT NULL,
  channel_id TEXT      NOT NULL,
  emoji      TEXT      NOT NULL,
  role_id    TEXT      NOT NULL,
  UNIQUE (message_id, emoji)
);

-- ────────────────────────────────────────────────────────────
-- 7. BUTTON ROLES
--    Maps a button custom_id to a Discord role.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS button_roles (
  id         BIGSERIAL PRIMARY KEY,
  guild_id   TEXT      NOT NULL,
  message_id TEXT      NOT NULL,
  channel_id TEXT      NOT NULL,
  label      TEXT      NOT NULL,
  role_id    TEXT      NOT NULL,
  custom_id  TEXT      NOT NULL,
  UNIQUE (custom_id)
);

-- ────────────────────────────────────────────────────────────
-- 8. REMINDERS
--    Scheduled reminders sent back to the user's channel.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reminders (
  id         BIGSERIAL   PRIMARY KEY,
  user_id    TEXT        NOT NULL,
  guild_id   TEXT        NOT NULL,
  channel_id TEXT        NOT NULL,
  message    TEXT        NOT NULL,
  remind_at  TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 9. AUTO VCS
--    Tracks auto-created personal voice channels so they can
--    be deleted when the owner leaves.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auto_vcs (
  id         BIGSERIAL   PRIMARY KEY,
  guild_id   TEXT        NOT NULL,
  channel_id TEXT        NOT NULL,
  owner_id   TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (channel_id)
);

-- ────────────────────────────────────────────────────────────
-- 10. AI CONVERSATIONS
--     Short-term (5-minute) memory for the AI personality.
--     Stores every message the AI was involved in so it can
--     reply with full context. Auto-cleaned by the bot.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_conversations (
  id         BIGSERIAL   PRIMARY KEY,
  guild_id   TEXT        NOT NULL,
  channel_id TEXT        NOT NULL,
  user_id    TEXT        NOT NULL,
  role       TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  message    TEXT        NOT NULL,
  timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- INDEXES — speeds up all common lookups
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_guild        ON users          (guild_id);
CREATE INDEX IF NOT EXISTS idx_users_xp           ON users          (guild_id, xp DESC);
CREATE INDEX IF NOT EXISTS idx_users_afk          ON users          (guild_id, afk) WHERE afk = TRUE;
CREATE INDEX IF NOT EXISTS idx_invites_guild      ON invites        (guild_id, invites_count DESC);
CREATE INDEX IF NOT EXISTS idx_warnings_user      ON warnings       (user_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_warnings_guild     ON warnings       (guild_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_custom_cmds_guild  ON custom_commands(guild_id, name);
CREATE INDEX IF NOT EXISTS idx_reaction_message   ON reaction_roles (message_id, emoji);
CREATE INDEX IF NOT EXISTS idx_button_custom_id   ON button_roles   (custom_id);
CREATE INDEX IF NOT EXISTS idx_reminders_time     ON reminders      (remind_at ASC);
CREATE INDEX IF NOT EXISTS idx_auto_vcs_guild     ON auto_vcs       (guild_id);
CREATE INDEX IF NOT EXISTS idx_ai_conv_lookup     ON ai_conversations (guild_id, channel_id, timestamp DESC);
