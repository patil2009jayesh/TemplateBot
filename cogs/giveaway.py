import datetime
import random
import discord
from discord import app_commands
from discord.ext import commands, tasks
from database.connection import get_db
from utils.helpers import success_embed, error_embed, info_embed
from utils.time_parser import parse_duration, format_duration

class GiveawayView(discord.ui.View):
    def __init__(self, giveaway_id: int):
        super().__init__(timeout=None)
        self.giveaway_id = giveaway_id

    @discord.ui.button(label="Enter Giveaway", style=discord.ButtonStyle.primary, emoji="🎉", custom_id="gw_enter_btn")
    async def enter_btn(self, interaction: discord.Interaction, button: discord.ui.Button):
        # Fetch giveaway
        async with get_db() as db:
            async with db.execute("SELECT * FROM giveaways WHERE id = ? AND status = 'active'", (self.giveaway_id,)) as cursor:
                gw = await cursor.fetchone()
                if not gw:
                    return await interaction.response.send_message("❌ This giveaway has already ended.", ephemeral=True)

                # Check minimum invites if required
                if gw["min_invites"] > 0:
                    async with db.execute(
                        "SELECT (invites_count - left_invites - fake_invites) as real_invites FROM invites WHERE guild_id = ? AND user_id = ?",
                        (str(interaction.guild.id), str(interaction.user.id))
                    ) as inv_cur:
                        inv_row = await inv_cur.fetchone()
                        real_inv = inv_row["real_invites"] if inv_row else 0
                        if real_inv < gw["min_invites"]:
                            return await interaction.response.send_message(
                                f"❌ You need at least **{gw['min_invites']} invites** to enter. You have: **{real_inv}**.",
                                ephemeral=True
                            )

                # Check if already entered
                async with db.execute(
                    "SELECT * FROM giveaway_participants WHERE giveaway_id = ? AND user_id = ?",
                    (self.giveaway_id, str(interaction.user.id))
                ) as p_cur:
                    p = await p_cur.fetchone()
                    if p:
                        # Leave giveaway
                        await db.execute(
                            "DELETE FROM giveaway_participants WHERE giveaway_id = ? AND user_id = ?",
                            (self.giveaway_id, str(interaction.user.id))
                        )
                        await db.commit()
                        return await interaction.response.send_message("👋 You left the giveaway.", ephemeral=True)

                # Add participant
                now = datetime.datetime.utcnow().isoformat()
                await db.execute(
                    "INSERT INTO giveaway_participants (giveaway_id, user_id, entry_value, timestamp) VALUES (?, ?, 1, ?)",
                    (self.giveaway_id, str(interaction.user.id), now)
                )
                await db.commit()

        await interaction.response.send_message("🎉 You entered the giveaway! Good luck!", ephemeral=True)

class GiveawayCog(commands.Cog, name="giveaway"):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.giveaway_loop.start()

    def cog_unload(self):
        self.giveaway_loop.cancel()

    @app_commands.command(name="giveaway", description="Launch an interactive giveaway")
    @app_commands.describe(
        prize="What is being given away",
        duration="Duration of giveaway (e.g. 10m, 2h, 1d)",
        winners="Number of winners",
        giveaway_type="Participation mode",
        min_invites="Minimum invites required to enter"
    )
    @app_commands.choices(giveaway_type=[
        app_commands.Choice(name="Standard (Click to Enter)", value="button"),
        app_commands.Choice(name="XP Weighted (Active Chatters)", value="xp"),
        app_commands.Choice(name="Invite Weighted", value="invite")
    ])
    @app_commands.checks.has_permissions(manage_guild=True)
    async def giveaway(
        self,
        interaction: discord.Interaction,
        prize: str,
        duration: str,
        winners: int = 1,
        giveaway_type: str = "button",
        min_invites: int = 0
    ):
        seconds = parse_duration(duration)
        if not seconds:
            return await interaction.response.send_message(embed=error_embed("Invalid duration format! Use `10m`, `2h`, `1d`."), ephemeral=True)

        end_dt = datetime.datetime.utcnow() + datetime.timedelta(seconds=seconds)
        end_iso = end_dt.isoformat()
        end_timestamp = int(end_dt.timestamp())

        embed = discord.Embed(
            title=f"🎁 GIVEAWAY: {prize}",
            description=(
                f"Click the 🎉 button below to enter!\n\n"
                f"• **Winners:** `{winners}`\n"
                f"• **Ends:** <t:{end_timestamp}:R> (<t:{end_timestamp}:f>)\n"
                f"• **Hosted by:** {interaction.user.mention}\n"
                + (f"• **Requirement:** `{min_invites}+ invites`\n" if min_invites > 0 else "")
            ),
            color=discord.Color.gold()
        )
        embed.set_footer(text="Tachos Dev Giveaway System")

        await interaction.response.send_message("Launching giveaway...", ephemeral=True)
        gw_msg = await interaction.channel.send(embed=embed)

        async with get_db() as db:
            cursor = await db.execute(
                """
                INSERT INTO giveaways (guild_id, type, prize, end_time, channel_id, message_id, winner_count, min_invites, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
                """,
                (str(interaction.guild.id), giveaway_type, prize, end_iso, str(interaction.channel.id), str(gw_msg.id), winners, min_invites)
            )
            gw_id = cursor.lastrowid
            await db.commit()

        view = GiveawayView(gw_id)
        await gw_msg.edit(view=view)

    @tasks.loop(seconds=15)
    async def giveaway_loop(self):
        now = datetime.datetime.utcnow().isoformat()
        async with get_db() as db:
            async with db.execute("SELECT * FROM giveaways WHERE status = 'active' AND end_time <= ?", (now,)) as cursor:
                ended_giveaways = await cursor.fetchall()
                for gw in ended_giveaways:
                    await self.finish_giveaway(dict(gw))

    @giveaway_loop.before_loop
    async def before_gw_loop(self):
        await self.bot.wait_until_ready()

    async def finish_giveaway(self, gw: dict):
        gw_id = gw["id"]
        channel = self.bot.get_channel(int(gw["channel_id"]))
        
        async with get_db() as db:
            await db.execute("UPDATE giveaways SET status = 'ended' WHERE id = ?", (gw_id,))
            async with db.execute("SELECT user_id FROM giveaway_participants WHERE giveaway_id = ?", (gw_id,)) as cursor:
                participants = [r["user_id"] for r in await cursor.fetchall()]
            await db.commit()

        if not channel:
            return

        try:
            msg = await channel.fetch_message(int(gw["message_id"]))
        except Exception:
            msg = None

        if not participants:
            if msg:
                embed = discord.Embed(
                    title=f"🎁 GIVEAWAY ENDED: {gw['prize']}",
                    description="No participants entered the giveaway.",
                    color=discord.Color.dark_grey()
                )
                await msg.edit(embed=embed, view=None)
            return

        winner_count = min(gw["winner_count"], len(participants))
        winners = random.sample(participants, winner_count)
        winner_mentions = ", ".join(f"<@{uid}>" for uid in winners)

        if msg:
            embed = discord.Embed(
                title=f"🎁 GIVEAWAY ENDED: {gw['prize']}",
                description=f"🏆 **Winner(s):** {winner_mentions}\n**Hosted by:** <@{gw.get('user_id', '')}>\n\nCongratulations!",
                color=discord.Color.green()
            )
            await msg.edit(embed=embed, view=None)

        await channel.send(f"🎉 Congratulations {winner_mentions}! You won the **{gw['prize']}**!")

async def setup(bot: commands.Bot):
    await bot.add_cog(GiveawayCog(bot))
