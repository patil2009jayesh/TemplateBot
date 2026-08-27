import aiosqlite
import os
import json
from pathlib import Path
from contextlib import asynccontextmanager

# BOT_DB env var lets each bot instance use its own database file
_db_name = os.getenv("BOT_DB", "bot.sqlite")
DB_PATH = Path(__file__).parent.parent / _db_name

SCHEMA = """
CREATE TABLE IF NOT EXISTS guilds (
    guild_id TEXT PRIMARY KEY,
    modules TEXT,
    channels TEXT,
    roles TEXT,
    settings TEXT
);

CREATE TABLE IF NOT EXISTS users (
    user_id TEXT,
    guild_id TEXT,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 0,
    afk INTEGER DEFAULT 0,
    afk_reason TEXT,
    afk_since TEXT,
    username TEXT,
    display_name TEXT,
    PRIMARY KEY (user_id, guild_id)
);

CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    channel_id TEXT,
    message TEXT,
    remind_at TEXT
);

CREATE TABLE IF NOT EXISTS auto_vcs (
    channel_id TEXT PRIMARY KEY,
    guild_id TEXT,
    user_id TEXT
);

CREATE TABLE IF NOT EXISTS giveaways (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT,
    type TEXT,
    prize TEXT,
    end_time TEXT,
    channel_id TEXT,
    message_id TEXT,
    winner_count INTEGER DEFAULT 1,
    min_invites INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS giveaway_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    giveaway_id INTEGER,
    user_id TEXT,
    entry_value REAL DEFAULT 0,
    timestamp TEXT,
    UNIQUE(giveaway_id, user_id)
);

CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT,
    channel_id TEXT,
    creator_id TEXT,
    staff_id TEXT,
    reason TEXT,
    status TEXT DEFAULT 'open',
    team_id INTEGER,
    message_id TEXT
);

CREATE TABLE IF NOT EXISTS ticket_teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT,
    team_name TEXT,
    staff_role_id TEXT,
    category_id TEXT
);

CREATE TABLE IF NOT EXISTS warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT,
    user_id TEXT,
    moderator_id TEXT,
    reason TEXT,
    type TEXT,
    timestamp TEXT
);

CREATE TABLE IF NOT EXISTS custom_commands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT,
    name TEXT,
    response TEXT,
    created_by TEXT,
    UNIQUE(guild_id, name)
);

CREATE TABLE IF NOT EXISTS invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT,
    user_id TEXT,
    inviter_id TEXT,
    invites_count INTEGER DEFAULT 0,
    fake_invites INTEGER DEFAULT 0,
    left_invites INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reaction_roles (
    message_id TEXT PRIMARY KEY,
    guild_id TEXT,
    channel_id TEXT,
    role_id TEXT,
    emoji TEXT
);

CREATE TABLE IF NOT EXISTS button_roles (
    message_id TEXT PRIMARY KEY,
    guild_id TEXT,
    channel_id TEXT,
    role_id TEXT,
    label TEXT,
    custom_id TEXT
);
"""

@asynccontextmanager
async def get_db():
    db = await aiosqlite.connect(DB_PATH, timeout=30.0)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode = WAL")
    try:
        yield db
    finally:
        await db.close()

async def init_db():
    async with get_db() as db:
        await db.executescript(SCHEMA)
        await db.commit()
