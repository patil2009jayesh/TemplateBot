from database.connection import get_db

async def get_user_invites(guild_id: str | int, user_id: str | int) -> dict:
    gid, uid = str(guild_id), str(user_id)
    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM invites WHERE guild_id = ? AND user_id = ?", (gid, uid)
        ) as cursor:
            row = await cursor.fetchone()
            if row:
                return dict(row)
            
            await db.execute(
                """
                INSERT INTO invites (guild_id, user_id, inviter_id, invites_count, fake_invites, left_invites)
                VALUES (?, ?, NULL, 0, 0, 0)
                """,
                (gid, uid)
            )
            await db.commit()
            return {
                "guild_id": gid,
                "user_id": uid,
                "inviter_id": None,
                "invites_count": 0,
                "fake_invites": 0,
                "left_invites": 0
            }

async def add_invite(guild_id: str | int, inviter_id: str | int, is_fake: bool = False):
    gid, uid = str(guild_id), str(inviter_id)
    await get_user_invites(gid, uid)
    async with get_db() as db:
        if is_fake:
            await db.execute(
                "UPDATE invites SET fake_invites = fake_invites + 1 WHERE guild_id = ? AND user_id = ?",
                (gid, uid)
            )
        else:
            await db.execute(
                "UPDATE invites SET invites_count = invites_count + 1 WHERE guild_id = ? AND user_id = ?",
                (gid, uid)
            )
        await db.commit()

async def record_leave(guild_id: str | int, inviter_id: str | int):
    gid, uid = str(guild_id), str(inviter_id)
    if not inviter_id:
        return
    async with get_db() as db:
        await db.execute(
            "UPDATE invites SET left_invites = left_invites + 1 WHERE guild_id = ? AND user_id = ?",
            (gid, uid)
        )
        await db.commit()

async def get_invite_leaderboard(guild_id: str | int, limit: int = 10) -> list[dict]:
    gid = str(guild_id)
    async with get_db() as db:
        async with db.execute(
            """
            SELECT *, (invites_count - left_invites - fake_invites) as real_invites 
            FROM invites 
            WHERE guild_id = ? 
            ORDER BY real_invites DESC 
            LIMIT ?
            """,
            (gid, limit)
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]
