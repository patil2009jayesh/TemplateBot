import discord
from discord import app_commands
from discord.ext import commands
from services.invite_service import get_user_invites, add_invite, record_leave, get_invite_leaderboard
from utils.helpers import success_embed, error_embed, info_embed

class InvitesCog(commands.Cog, name="invites"):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.invites_cache = {} # guild_id -> {code: uses}

    async def cache_guild_invites(self, guild: discord.Guild):
        if not guild.me.guild_permissions.manage_guild:
            return
        try:
            invites = await guild.invites()
            self.invites_cache[guild.id] = {inv.code: inv.uses for inv in invites}
        except Exception:
            pass

    @commands.Cog.listener()
    async def on_ready(self):
        for guild in self.bot.guilds:
            await self.cache_guild_invites(guild)

    @commands.Cog.listener()
    async def on_member_join(self, member: discord.Member):
        if member.bot:
            return
        guild = member.guild
        old_cache = self.invites_cache.get(guild.id, {})
        new_invites = {}
        inviter = None

        if guild.me.guild_permissions.manage_guild:
            try:
                invites = await guild.invites()
                for inv in invites:
                    new_invites[inv.code] = inv.uses
                    if inv.code in old_cache and inv.uses > old_cache[inv.code]:
                        inviter = inv.inviter
                self.invites_cache[guild.id] = new_invites
            except Exception:
                pass

        if inviter and inviter.id != member.id:
            # Check if account created < 24 hours ago (fake account)
            is_fake = (discord.utils.utcnow() - member.created_at).total_seconds() < 86400
            await add_invite(guild.id, inviter.id, is_fake=is_fake)

    @commands.Cog.listener()
    async def on_member_remove(self, member: discord.Member):
        if member.bot:
            return
        data = await get_user_invites(member.guild.id, member.id)
        if data.get("inviter_id"):
            await record_leave(member.guild.id, data["inviter_id"])

    @app_commands.command(name="invites", description="Check invite statistics for yourself or another member")
    @app_commands.describe(user="The member to check (defaults to you)")
    async def invites(self, interaction: discord.Interaction, user: discord.Member = None):
        target = user or interaction.user
        data = await get_user_invites(interaction.guild.id, target.id)
        
        total = data.get("invites_count", 0)
        left = data.get("left_invites", 0)
        fake = data.get("fake_invites", 0)
        real = max(0, total - left - fake)

        embed = discord.Embed(
            title=f"🔗 Invite Statistics — {target.display_name}",
            color=discord.Color.blue()
        )
        if target.display_avatar:
            embed.set_thumbnail(url=target.display_avatar.url)

        embed.add_field(name="✨ Real Invites", value=str(real), inline=True)
        embed.add_field(name="📈 Total Joins", value=str(total), inline=True)
        embed.add_field(name="🚪 Left Members", value=str(left), inline=True)
        embed.add_field(name="🤖 Fake / Suspicious", value=str(fake), inline=True)
        embed.set_footer(text="Tachos Dev Invite Tracking")

        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="inviteleaderboard", description="Display the top server inviters")
    async def inviteleaderboard(self, interaction: discord.Interaction):
        top_inviters = await get_invite_leaderboard(interaction.guild.id, limit=10)
        if not top_inviters:
            return await interaction.response.send_message(
                embed=info_embed("No invite records found for this server.", "Invite Leaderboard"),
                ephemeral=True
            )

        medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"]
        desc = ""
        for i, u in enumerate(top_inviters):
            medal = medals[i] if i < len(medals) else f"#{i+1}"
            member = interaction.guild.get_member(int(u["user_id"]))
            name = member.display_name if member else f"User {u['user_id']}"
            desc += f"{medal} **{name}** — **{u.get('real_invites', 0)}** Real (`{u.get('invites_count', 0)}` total)\n"

        embed = discord.Embed(
            title=f"🏆 Invite Leaderboard — {interaction.guild.name}",
            description=desc,
            color=discord.Color.gold()
        )
        embed.set_footer(text="Tachos Dev Invite System")
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="inviteinfo", description="Lookup details for a Discord invite code")
    @app_commands.describe(code="The invite code (e.g. discord.gg/code or just code)")
    async def inviteinfo(self, interaction: discord.Interaction, code: str):
        clean_code = code.split("/")[-1].strip()
        try:
            invite = await self.bot.fetch_invite(clean_code)
            embed = discord.Embed(
                title=f"🔎 Invite Info: {invite.code}",
                color=discord.Color.blurple()
            )
            embed.add_field(name="🏠 Server", value=f"**{invite.guild.name}** (`{invite.guild.id}`)", inline=False)
            embed.add_field(name="👤 Inviter", value=str(invite.inviter) if invite.inviter else "Unknown", inline=True)
            embed.add_field(name="💬 Channel", value=invite.channel.name if invite.channel else "Unknown", inline=True)
            if invite.approximate_member_count:
                embed.add_field(name="👥 Members", value=f"{invite.approximate_member_count:,} total", inline=True)
            await interaction.response.send_message(embed=embed)
        except Exception as e:
            await interaction.response.send_message(embed=error_embed(f"Could not fetch invite: {str(e)}"), ephemeral=True)

async def setup(bot: commands.Bot):
    await bot.add_cog(InvitesCog(bot))
