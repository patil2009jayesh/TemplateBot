try:
    from database.connection import get_db
except ModuleNotFoundError:
    try:
        from database import get_db
    except ModuleNotFoundError:
        import database
        get_db = database.get_db

async def get_custom_command(guild_id: str | int, name: str) -> dict | None:
    gid = str(guild_id)
    cmd_name = name.strip().lower()
    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM custom_commands WHERE guild_id = ? AND LOWER(name) = ?",
            (gid, cmd_name)
        ) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None

async def add_custom_command(guild_id: str | int, name: str, response: str, created_by: str | int):
    gid = str(guild_id)
    cmd_name = name.strip().lower()
    async with get_db() as db:
        await db.execute(
            """
            INSERT INTO custom_commands (guild_id, name, response, created_by)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(guild_id, name) DO UPDATE SET response = ?, created_by = ?
            """,
            (gid, cmd_name, response, str(created_by), response, str(created_by))
        )
        await db.commit()

async def delete_custom_command(guild_id: str | int, name: str) -> bool:
    gid = str(guild_id)
    cmd_name = name.strip().lower()
    async with get_db() as db:
        cursor = await db.execute(
            "DELETE FROM custom_commands WHERE guild_id = ? AND LOWER(name) = ?",
            (gid, cmd_name)
        )
        await db.commit()
        return cursor.rowcount > 0

async def list_custom_commands(guild_id: str | int) -> list[dict]:
    gid = str(guild_id)
    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM custom_commands WHERE guild_id = ? ORDER BY name ASC",
            (gid,)
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]
