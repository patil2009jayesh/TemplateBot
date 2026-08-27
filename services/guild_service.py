import json
from database.connection import get_db

DEFAULT_MODULES = {
    "moderation": True,
    "leveling": True,
    "tickets": True,
    "giveaways": True,
    "invites": True,
    "reaction_roles": True,
    "button_roles": True,
    "custom_commands": True,
    "welcome": True,
    "auto_vc": True,
    "logging": True
}

DEFAULT_SETTINGS = {
    "automod": {
        "anti_spam": False,
        "anti_links": False,
        "caps_limit": 0,
        "mention_limit": 0
    },
    "leveling": {
        "xp_multiplier": 1.0,
        "min_xp": 15,
        "max_xp": 25,
        "cooldown": 60,
        "rewards": {}
    }
}

async def get_guild(guild_id: str | int) -> dict:
    gid = str(guild_id)
    async with get_db() as db:
        async with db.execute("SELECT * FROM guilds WHERE guild_id = ?", (gid,)) as cursor:
            row = await cursor.fetchone()
            if row:
                return {
                    "guild_id": row["guild_id"],
                    "modules": json.loads(row["modules"] or "{}"),
                    "channels": json.loads(row["channels"] or "{}"),
                    "roles": json.loads(row["roles"] or "{}"),
                    "settings": json.loads(row["settings"] or "{}"),
                }
            
            # Initialize default
            modules_json = json.dumps(DEFAULT_MODULES)
            channels_json = json.dumps({})
            roles_json = json.dumps({})
            settings_json = json.dumps(DEFAULT_SETTINGS)
            
            await db.execute(
                "INSERT OR IGNORE INTO guilds (guild_id, modules, channels, roles, settings) VALUES (?, ?, ?, ?, ?)",
                (gid, modules_json, channels_json, roles_json, settings_json)
            )
            await db.commit()
            return {
                "guild_id": gid,
                "modules": DEFAULT_MODULES.copy(),
                "channels": {},
                "roles": {},
                "settings": DEFAULT_SETTINGS.copy()
            }

async def update_guild(guild_id: str | int, field: str, value: dict):
    gid = str(guild_id)
    # Ensure guild exists
    await get_guild(gid)
    async with get_db() as db:
        await db.execute(
            f"UPDATE guilds SET {field} = ? WHERE guild_id = ?",
            (json.dumps(value), gid)
        )
        await db.commit()

async def is_module_enabled(guild_id: str | int, module_name: str) -> bool:
    guild_data = await get_guild(guild_id)
    return guild_data.get("modules", {}).get(module_name, True)
