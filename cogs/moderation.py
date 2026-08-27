import re
import datetime
import discord
from discord import app_commands
from discord.ext import commands
from services.warning_service import add_warning, get_warnings, clear_warnings
from services.guild_service import get_guild, is_module_enabled
from utils.helpers import success_embed, error_embed, info_embed
from utils.time_parser import parse_duration

class ModerationCog(commands.Cog, name="moderation"):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.spam_tracker = {} # (guild_id, user_id) -> [timestamps]

    @app_commands.command(name="ban", description="Ban a member from the server")
    @app_commands.describe(user="The member to ban", reason="Reason for the ban")
    @app_commands.checks.has_permissions(ban_members=True)
    async def ban(self, interaction: discord.Interaction, user: discord.Member, reason: str = "No reason provided"):
        if user.id == interaction.user.id:
            return await interaction.response.send_message(embed=error_embed("You cannot ban yourself."), ephemeral=True)
        if user.top_role >= interaction.user.top_role and interaction.user.id != interaction.guild.owner_id:
            return await interaction.response.send_message(embed=error_embed("You cannot ban someone with a higher or equal role."), ephemeral=True)
        if not interaction.guild.me.guild_permissions.ban_members:
            return await interaction.response.send_message(embed=error_embed("I don't have permission to ban members."), ephemeral=True)

        try:
            await user.ban(reason=f"{reason} (Banned by {interaction.user})")
            await add_warning(interaction.guild.id, user.id, interaction.user.id, reason, warn_type="ban")
            await interaction.response.send_message(
                embed=success_embed(f"Successfully banned **{user}**.\n**Reason:** {reason}")
            )
        except Exception as e:
            await interaction.response.send_message(embed=error_embed(f"Could not ban member: {str(e)}"), ephemeral=True)

    @app_commands.command(name="kick", description="Kick a member from the server")
    @app_commands.describe(user="The member to kick", reason="Reason for the kick")
    @app_commands.checks.has_permissions(kick_members=True)
    async def kick(self, interaction: discord.Interaction, user: discord.Member, reason: str = "No reason provided"):
        if user.id == interaction.user.id:
            return await interaction.response.send_message(embed=error_embed("You cannot kick yourself."), ephemeral=True)
        if user.top_role >= interaction.user.top_role and interaction.user.id != interaction.guild.owner_id:
            return await interaction.response.send_message(embed=error_embed("You cannot kick someone with a higher or equal role."), ephemeral=True)
        if not interaction.guild.me.guild_permissions.kick_members:
            return await interaction.response.send_message(embed=error_embed("I don't have permission to kick members."), ephemeral=True)

        try:
            await user.kick(reason=f"{reason} (Kicked by {interaction.user})")
            await add_warning(interaction.guild.id, user.id, interaction.user.id, reason, warn_type="kick")
            await interaction.response.send_message(
                embed=success_embed(f"Successfully kicked **{user}**.\n**Reason:** {reason}")
            )
        except Exception as e:
            await interaction.response.send_message(embed=error_embed(f"Could not kick member: {str(e)}"), ephemeral=True)

    @app_commands.command(name="timeout", description="Mute / Timeout a member temporarily")
    @app_commands.describe(user="The member to timeout", duration="Duration (e.g. 10m, 2h, 1d)", reason="Reason")
    @app_commands.checks.has_permissions(moderate_members=True)
    async def timeout(self, interaction: discord.Interaction, user: discord.Member, duration: str, reason: str = "No reason provided"):
        seconds = parse_duration(duration)
        if not seconds:
            return await interaction.response.send_message(embed=error_embed("Invalid duration format! Use `10s`, `5m`, `2h`, `1d`."), ephemeral=True)
        if seconds > 86400 * 28:
            return await interaction.response.send_message(embed=error_embed("Maximum timeout duration is 28 days."), ephemeral=True)

        if user.top_role >= interaction.user.top_role and interaction.user.id != interaction.guild.owner_id:
            return await interaction.response.send_message(embed=error_embed("You cannot timeout someone with a higher or equal role."), ephemeral=True)

        until = discord.utils.utcnow() + datetime.timedelta(seconds=seconds)
        try:
            await user.timeout(until, reason=f"{reason} (Timed out by {interaction.user})")
            await add_warning(interaction.guild.id, user.id, interaction.user.id, f"{reason} ({duration})", warn_type="timeout")
            await interaction.response.send_message(
                embed=success_embed(f"Timed out **{user}** for `{duration}`.\n**Reason:** {reason}")
            )
        except Exception as e:
            await interaction.response.send_message(embed=error_embed(f"Could not timeout member: {str(e)}"), ephemeral=True)

    @app_commands.command(name="unban", description="Unban a user by their Discord User ID")
    @app_commands.describe(user_id="The User ID to unban", reason="Reason for unbanning")
    @app_commands.checks.has_permissions(ban_members=True)
    async def unban(self, interaction: discord.Interaction, user_id: str, reason: str = "No reason provided"):
        try:
            user = await self.bot.fetch_user(int(user_id.strip()))
            await interaction.guild.unban(user, reason=f"{reason} (Unbanned by {interaction.user})")
            await interaction.response.send_message(
                embed=success_embed(f"Successfully unbanned **{user}** ({user.id}).\n**Reason:** {reason}")
            )
        except Exception as e:
            await interaction.response.send_message(embed=error_embed(f"Could not unban user: {str(e)}"), ephemeral=True)

    @app_commands.command(name="warn", description="Issue a formal recorded warning to a member")
    @app_commands.describe(user="The member to warn", reason="Reason for the warning")
    @app_commands.checks.has_permissions(moderate_members=True)
    async def warn(self, interaction: discord.Interaction, user: discord.Member, reason: str):
        if user.bot:
            return await interaction.response.send_message(embed=error_embed("Cannot warn bots."), ephemeral=True)
        warn_id = await add_warning(interaction.guild.id, user.id, interaction.user.id, reason, warn_type="warn")
        await interaction.response.send_message(
            embed=success_embed(f"Issued warning **#{warn_id}** to **{user}**.\n**Reason:** {reason}")
        )

    @app_commands.command(name="warnings", description="View past warnings for a user")
    @app_commands.describe(user="The member whose warnings to view")
    @app_commands.checks.has_permissions(moderate_members=True)
    async def warnings(self, interaction: discord.Interaction, user: discord.Member):
        warns = await get_warnings(interaction.guild.id, user.id)
        if not warns:
            return await interaction.response.send_message(
                embed=info_embed(f"**{user}** has no recorded warnings.", "Warning History"),
                ephemeral=True
            )
        desc = ""
        for w in warns[:15]:
            desc += f"• **ID #{w['id']}** | Type: `{w.get('type','warn').upper()}`\n  **Reason:** {w['reason']}\n  **Date:** {w['timestamp']}\n\n"
        embed = info_embed(desc, f"⚠️ Warning History for {user}")
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="clearwarnings", description="Clear all recorded warnings for a user")
    @app_commands.describe(user="The member whose warnings to clear")
    @app_commands.checks.has_permissions(moderate_members=True)
    async def clearwarnings(self, interaction: discord.Interaction, user: discord.Member):
        count = await clear_warnings(interaction.guild.id, user.id)
        await interaction.response.send_message(
            embed=success_embed(f"Cleared **{count}** warning(s) for **{user}**."),
            ephemeral=True
        )

    @app_commands.command(name="clear", description="Bulk delete messages from the channel")
    @app_commands.describe(amount="Number of messages to delete (1-100)")
    @app_commands.checks.has_permissions(manage_messages=True)
    async def clear(self, interaction: discord.Interaction, amount: int):
        if amount < 1 or amount > 100:
            return await interaction.response.send_message(embed=error_embed("Amount must be between 1 and 100."), ephemeral=True)
        await interaction.response.defer(ephemeral=True)
        deleted = await interaction.channel.purge(limit=amount)
        await interaction.followup.send(embed=success_embed(f"Deleted **{len(deleted)}** message(s)."), ephemeral=True)

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        if not message.guild or message.author.bot or message.author.guild_permissions.administrator:
            return

        enabled = await is_module_enabled(message.guild.id, "moderation")
        if not enabled:
            return

        guild_data = await get_guild(message.guild.id)
        automod = guild_data.get("settings", {}).get("automod", {})

        # 1. Anti-Links
        if automod.get("anti_links"):
            if re.search(r"(https?://|discord\.gg/|discord\.com/invite/)", message.content, re.IGNORECASE):
                try:
                    await message.delete()
                    await message.channel.send(
                        f"⚠️ {message.author.mention}, posting links is prohibited in this server.",
                        delete_after=5
                    )
                    return
                except Exception:
                    pass

        # 2. Caps limit
        caps_limit = automod.get("caps_limit", 0)
        if caps_limit > 0 and len(message.content) > 10:
            caps_count = sum(1 for c in message.content if c.isupper())
            ratio = (caps_count / len(message.content)) * 100
            if ratio >= caps_limit:
                try:
                    await message.delete()
                    await message.channel.send(
                        f"⚠️ {message.author.mention}, please avoid excessive capital letters.",
                        delete_after=5
                    )
                    return
                except Exception:
                    pass

        # 3. Mention limit
        mention_limit = automod.get("mention_limit", 0)
        if mention_limit > 0 and len(message.mentions) > mention_limit:
            try:
                await message.delete()
                await message.channel.send(
                    f"⚠️ {message.author.mention}, please do not mass-mention users.",
                    delete_after=5
                )
                return
            except Exception:
                pass

async def setup(bot: commands.Bot):
    await bot.add_cog(ModerationCog(bot))
