import random
import time
import discord
from discord import app_commands
from discord.ext import commands
from services.user_service import get_user, add_xp, get_leaderboard, get_user_rank, xp_for_level
from services.guild_service import get_guild, update_guild, is_module_enabled
from utils.helpers import success_embed, error_embed, info_embed

class LevelingCog(commands.Cog, name="leveling"):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.cooldowns = {} # (guild_id, user_id) -> last_timestamp

    @app_commands.command(name="rank", description="Check your or another member's level, XP, and rank card")
    @app_commands.describe(user="Member whose rank to check (defaults to you)")
    async def rank(self, interaction: discord.Interaction, user: discord.Member = None):
        target = user or interaction.user
        data = await get_user(target.id, interaction.guild.id)
        rank_num = await get_user_rank(target.id, interaction.guild.id)
        
        current_xp = data.get("xp", 0)
        current_level = data.get("level", 0)
        needed_xp = xp_for_level(current_level)

        embed = discord.Embed(
            title=f"⭐ Rank & Level — {target.display_name}",
            color=discord.Color.gold()
        )
        if target.display_avatar:
            embed.set_thumbnail(url=target.display_avatar.url)

        embed.add_field(name="🏆 Server Rank", value=f"#{rank_num}", inline=True)
        embed.add_field(name="⭐ Level", value=str(current_level), inline=True)
        embed.add_field(name="✨ Total XP", value=f"{current_xp:,} XP", inline=True)
        embed.add_field(name="📈 Next Level", value=f"{needed_xp:,} XP needed", inline=False)
        embed.set_footer(text="Keep chatting to earn more XP!")

        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="leaderboard", description="View the top XP chatters in this server")
    async def leaderboard(self, interaction: discord.Interaction):
        top_users = await get_leaderboard(interaction.guild.id, limit=10)
        if not top_users:
            return await interaction.response.send_message(
                embed=info_embed("No chat activity recorded yet.", "Server Leaderboard"),
                ephemeral=True
            )

        medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"]
        desc = ""
        for i, u in enumerate(top_users):
            medal = medals[i] if i < len(medals) else f"#{i+1}"
            member = interaction.guild.get_member(int(u["user_id"]))
            name = member.display_name if member else (u.get("display_name") or u.get("username") or f"User {u['user_id']}")
            desc += f"{medal} **{name}** — Level `{u.get('level', 0)}` • `{u.get('xp', 0):,} XP`\n"

        embed = discord.Embed(
            title=f"🏆 XP Leaderboard — {interaction.guild.name}",
            description=desc,
            color=discord.Color.gold()
        )
        embed.set_footer(text="Tachos Dev Leveling System")
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="levelreward", description="Set up an automatic role unlock when reaching a specific level")
    @app_commands.describe(level="Target level required", role="Role awarded upon reaching level (omit to remove)")
    @app_commands.checks.has_permissions(administrator=True)
    async def levelreward(self, interaction: discord.Interaction, level: int, role: discord.Role = None):
        guild_data = await get_guild(interaction.guild.id)
        settings = guild_data.get("settings", {})
        lvl_settings = settings.get("leveling", {})
        rewards = lvl_settings.get("rewards", {})

        lvl_key = str(level)
        if role:
            rewards[lvl_key] = str(role.id)
            lvl_settings["rewards"] = rewards
            settings["leveling"] = lvl_settings
            await update_guild(interaction.guild.id, "settings", settings)
            await interaction.response.send_message(
                embed=success_embed(f"Members will now receive {role.mention} when reaching **Level {level}**."),
                ephemeral=True
            )
        else:
            rewards.pop(lvl_key, None)
            lvl_settings["rewards"] = rewards
            settings["leveling"] = lvl_settings
            await update_guild(interaction.guild.id, "settings", settings)
            await interaction.response.send_message(
                embed=info_embed(f"Reward for **Level {level}** removed.", "Level Reward Removed"),
                ephemeral=True
            )

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        if not message.guild or message.author.bot:
            return

        enabled = await is_module_enabled(message.guild.id, "leveling")
        if not enabled:
            return

        guild_data = await get_guild(message.guild.id)
        lvl_settings = guild_data.get("settings", {}).get("leveling", {})

        cooldown = lvl_settings.get("cooldown", 60)
        now = time.time()
        key = (message.guild.id, message.author.id)

        if key in self.cooldowns and (now - self.cooldowns[key]) < cooldown:
            return

        self.cooldowns[key] = now

        min_xp = lvl_settings.get("min_xp", 15)
        max_xp = lvl_settings.get("max_xp", 25)
        multiplier = lvl_settings.get("xp_multiplier", 1.0)
        xp_gain = int(random.randint(min_xp, max_xp) * multiplier)

        new_xp, new_level, leveled_up = await add_xp(
            message.author.id,
            message.guild.id,
            xp_gain,
            username=str(message.author),
            display_name=message.author.display_name
        )

        if leveled_up:
            # Check Level Role Rewards
            rewards = lvl_settings.get("rewards", {})
            reward_role_id = rewards.get(str(new_level))
            reward_mention = ""
            if reward_role_id:
                role = message.guild.get_role(int(reward_role_id))
                if role:
                    try:
                        await message.author.add_roles(role, reason=f"Level {new_level} Reward")
                        reward_mention = f"\n🎁 **Unlocked Role:** {role.mention}"
                    except Exception:
                        pass

            # Level Announcement
            lvl_channel_id = guild_data.get("channels", {}).get("leveling")
            target_channel = message.guild.get_channel(int(lvl_channel_id)) if lvl_channel_id else message.channel
            
            if target_channel:
                embed = discord.Embed(
                    title="🎉 Level Up!",
                    description=f"Congratulations {message.author.mention}, you reached **Level {new_level}**!{reward_mention}",
                    color=discord.Color.green()
                )
                if message.author.display_avatar:
                    embed.set_thumbnail(url=message.author.display_avatar.url)
                await target_channel.send(embed=embed)

async def setup(bot: commands.Bot):
    await bot.add_cog(LevelingCog(bot))
