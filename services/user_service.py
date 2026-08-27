import math
from datetime import datetime
from database.connection import get_db

def xp_for_level(level: int) -> int:
    return int(5 * (level ** 2) + 50 * level + 100)

def level_from_xp(xp: int) -> int:
    # 5L^2 + 50L + (100 - xp) = 0
    # L = (-50 + sqrt(2500 - 20*(100 - xp))) / 10
    level = 0
    while True:
        req = xp_for_level(level)
        if xp >= req:
            xp -= req
            level += 1
        else:
            break
    return level

async def get_user(user_id: str | int, guild_id: str | int) -> dict:
    uid, gid = str(user_id), str(guild_id)
    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM users WHERE user_id = ? AND guild_id = ?", (uid, gid)
        ) as cursor:
            row = await cursor.fetchone()
            if row:
                return dict(row)
            
            await db.execute(
                "INSERT OR IGNORE INTO users (user_id, guild_id, xp, level, afk) VALUES (?, ?, 0, 0, 0)",
                (uid, gid)
            )
            await db.commit()
            return {
                "user_id": uid,
                "guild_id": gid,
                "xp": 0,
                "level": 0,
                "afk": 0,
                "afk_reason": None,
                "afk_since": None,
                "username": None,
                "display_name": None
            }

async def add_xp(user_id: str | int, guild_id: str | int, xp_amount: int, username: str = None, display_name: str = None) -> tuple[int, int, bool]:
    uid, gid = str(user_id), str(guild_id)
    user = await get_user(uid, gid)
    old_xp = user.get("xp", 0)
    old_level = user.get("level", 0)
    
    new_xp = old_xp + xp_amount
    new_level = level_from_xp(new_xp)
    leveled_up = new_level > old_level

    async with get_db() as db:
        await db.execute(
            """
            UPDATE users 
            SET xp = ?, level = ?, username = COALESCE(?, username), display_name = COALESCE(?, display_name) 
            WHERE user_id = ? AND guild_id = ?
            """,
            (new_xp, new_level, username, display_name, uid, gid)
        )
        await db.commit()
        
    return new_xp, new_level, leveled_up

async def get_leaderboard(guild_id: str | int, limit: int = 10) -> list[dict]:
    gid = str(guild_id)
    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM users WHERE guild_id = ? ORDER BY xp DESC LIMIT ?",
            (gid, limit)
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

async def get_user_rank(user_id: str | int, guild_id: str | int) -> int:
    uid, gid = str(user_id), str(guild_id)
    user = await get_user(uid, gid)
    user_xp = user.get("xp", 0)
    async with get_db() as db:
        async with db.execute(
            "SELECT COUNT(*) as rank FROM users WHERE guild_id = ? AND xp > ?",
            (gid, user_xp)
        ) as cursor:
            row = await cursor.fetchone()
            return (row["rank"] or 0) + 1

async def set_afk(user_id: str | int, guild_id: str | int, reason: str = "AFK"):
    uid, gid = str(user_id), str(guild_id)
    now = datetime.utcnow().isoformat()
    await get_user(uid, gid)
    async with get_db() as db:
        await db.execute(
            "UPDATE users SET afk = 1, afk_reason = ?, afk_since = ? WHERE user_id = ? AND guild_id = ?",
            (reason, now, uid, gid)
        )
        await db.commit()

async def remove_afk(user_id: str | int, guild_id: str | int):
    uid, gid = str(user_id), str(guild_id)
    async with get_db() as db:
        await db.execute(
            "UPDATE users SET afk = 0, afk_reason = NULL, afk_since = NULL WHERE user_id = ? AND guild_id = ?",
            (uid, gid)
        )
        await db.commit()
