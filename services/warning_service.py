from datetime import datetime
from database.connection import get_db

async def add_warning(guild_id: str | int, user_id: str | int, moderator_id: str | int, reason: str, warn_type: str = "warn") -> int:
    gid, uid, mid = str(guild_id), str(user_id), str(moderator_id)
    now = datetime.utcnow().isoformat()
    async with get_db() as db:
        cursor = await db.execute(
            """
            INSERT INTO warnings (guild_id, user_id, moderator_id, reason, type, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (gid, uid, mid, reason, warn_type, now)
        )
        await db.commit()
        return cursor.lastrowid

async def get_warnings(guild_id: str | int, user_id: str | int) -> list[dict]:
    gid, uid = str(guild_id), str(user_id)
    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY id DESC",
            (gid, uid)
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

async def clear_warnings(guild_id: str | int, user_id: str | int) -> int:
    gid, uid = str(guild_id), str(user_id)
    async with get_db() as db:
        cursor = await db.execute(
            "DELETE FROM warnings WHERE guild_id = ? AND user_id = ?",
            (gid, uid)
        )
        await db.commit()
        return cursor.rowcount
