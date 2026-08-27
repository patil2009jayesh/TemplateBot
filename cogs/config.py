import discord
from discord import app_commands
from discord.ext import commands
from services.guild_service import get_guild, update_guild
try:
    from database.connection import get_db
except ModuleNotFoundError:
    try:
        from database import get_db
    except ModuleNotFoundError:
        import database
        get_db = database.get_db
from utils.helpers import success_embed, error_embed, info_embed

class ConfigCog(commands.Cog, name="config"):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @app_commands.command(name="module", description="Enable or disable a bot module for this server")
    @app_commands.describe(module_name="The module to toggle", enabled="Enable (True) or Disable (False)")
    @app_commands.choices(module_name=[
        app_commands.Choice(name="Moderation & AutoMod", value="moderation"),
        app_commands.Choice(name="Leveling & XP", value="leveling"),
        app_commands.Choice(name="Tickets & Support", value="tickets"),
        app_commands.Choice(name="Giveaways", value="giveaways"),
        app_commands.Choice(name="Invites Tracking", value="invites"),
        app_commands.Choice(name="Reaction Roles", value="reaction_roles"),
        app_commands.Choice(name="Button Roles", value="button_roles"),
        app_commands.Choice(name="Custom Commands", value="custom_commands"),
        app_commands.Choice(name="Welcome System", value="welcome"),
        app_commands.Choice(name="Auto-VC", value="auto_vc"),
        app_commands.Choice(name="Server Logging", value="logging"),
    ])
    @app_commands.checks.has_permissions(administrator=True)
    async def module_cmd(self, interaction: discord.Interaction, module_name: str, enabled: bool):
        guild_data = await get_guild(interaction.guild.id)
        modules = guild_data.get("modules", {})
        modules[module_name] = enabled
        await update_guild(interaction.guild.id, "modules", modules)
        
        status = "ENABLED 🟢" if enabled else "DISABLED 🔴"
        await interaction.response.send_message(
            embed=success_embed(f"Module **{module_name.upper()}** is now **{status}** for this server."),
            ephemeral=True
        )

    @app_commands.command(name="setautomod", description="Configure AutoMod protection filters")
    @app_commands.describe(
        anti_spam="Toggle anti-spam detector",
        anti_links="Block invite and external links",
        caps_limit="Max percentage of caps allowed (0 to disable)",
        mention_limit="Max mentions allowed in a single message (0 to disable)"
    )
    @app_commands.checks.has_permissions(administrator=True)
    async def setautomod(
        self,
        interaction: discord.Interaction,
        anti_spam: bool = None,
        anti_links: bool = None,
        caps_limit: int = None,
        mention_limit: int = None
    ):
        guild_data = await get_guild(interaction.guild.id)
        settings = guild_data.get("settings", {})
        automod = settings.get("automod", {})

        if anti_spam is not None:
            automod["anti_spam"] = anti_spam
        if anti_links is not None:
            automod["anti_links"] = anti_links
        if caps_limit is not None:
            automod["caps_limit"] = max(0, min(100, caps_limit))
        if mention_limit is not None:
            automod["mention_limit"] = max(0, mention_limit)

        settings["automod"] = automod
        await update_guild(interaction.guild.id, "settings", settings)

        desc = (
            f"• **Anti-Links:** `{'ENABLED' if automod.get('anti_links') else 'DISABLED'}`\n"
            f"• **Anti-Spam:** `{'ENABLED' if automod.get('anti_spam') else 'DISABLED'}`\n"
            f"• **Caps Limit:** `{automod.get('caps_limit', 0)}%`\n"
            f"• **Mention Limit:** `{automod.get('mention_limit', 0)} mentions`\n"
        )
        await interaction.response.send_message(embed=success_embed(desc, "AutoMod Settings Updated"), ephemeral=True)

    @app_commands.command(name="setautorole", description="Set a role automatically given to new members when they join")
    @app_commands.describe(role="The role to assign (or omit to disable)")
    @app_commands.checks.has_permissions(administrator=True)
    async def setautorole(self, interaction: discord.Interaction, role: discord.Role = None):
        guild_data = await get_guild(interaction.guild.id)
        roles = guild_data.get("roles", {})
        roles["autorole"] = str(role.id) if role else None
        await update_guild(interaction.guild.id, "roles", roles)

        if role:
            await interaction.response.send_message(
                embed=success_embed(f"Auto-role set to {role.mention}."),
                ephemeral=True
            )
        else:
            await interaction.response.send_message(
                embed=info_embed("Auto-role has been disabled.", "Auto-Role Removed"),
                ephemeral=True
            )

    @app_commands.command(name="setchannel", description="Set a dedicated channel for logs, welcome, or leveling")
    @app_commands.describe(channel_type="Type of log/feature channel", channel="Target channel")
    @app_commands.choices(channel_type=[
        app_commands.Choice(name="Logging / Audit Logs", value="logging"),
        app_commands.Choice(name="Moderation Logs", value="mod_logs"),
        app_commands.Choice(name="Leveling Announcements", value="leveling"),
        app_commands.Choice(name="Welcome Channel", value="welcome")
    ])
    @app_commands.checks.has_permissions(administrator=True)
    async def setchannel(self, interaction: discord.Interaction, channel_type: str, channel: discord.TextChannel = None):
        guild_data = await get_guild(interaction.guild.id)
        channels = guild_data.get("channels", {})
        channels[channel_type] = str(channel.id) if channel else None
        await update_guild(interaction.guild.id, "channels", channels)

        if channel:
            await interaction.response.send_message(
                embed=success_embed(f"Channel for `{channel_type}` set to {channel.mention}."),
                ephemeral=True
            )
        else:
            await interaction.response.send_message(
                embed=info_embed(f"Channel for `{channel_type}` removed.", "Channel Reset"),
                ephemeral=True
            )

    @app_commands.command(name="setleveling", description="Configure XP leveling multiplier and chat rates")
    @app_commands.describe(
        xp_multiplier="XP multiplier (e.g. 1.0, 1.5, 2.0)",
        min_xp="Minimum XP per message (default: 15)",
        max_xp="Maximum XP per message (default: 25)",
        cooldown="Message cooldown in seconds (default: 60)"
    )
    @app_commands.checks.has_permissions(administrator=True)
    async def setleveling(
        self,
        interaction: discord.Interaction,
        xp_multiplier: float = None,
        min_xp: int = None,
        max_xp: int = None,
        cooldown: int = None
    ):
        guild_data = await get_guild(interaction.guild.id)
        settings = guild_data.get("settings", {})
        lvl_settings = settings.get("leveling", {})

        if xp_multiplier is not None:
            lvl_settings["xp_multiplier"] = max(0.1, xp_multiplier)
        if min_xp is not None:
            lvl_settings["min_xp"] = max(1, min_xp)
        if max_xp is not None:
            lvl_settings["max_xp"] = max(lvl_settings.get("min_xp", 15), max_xp)
        if cooldown is not None:
            lvl_settings["cooldown"] = max(5, cooldown)

        settings["leveling"] = lvl_settings
        await update_guild(interaction.guild.id, "settings", settings)

        desc = (
            f"• **XP Multiplier:** `{lvl_settings.get('xp_multiplier', 1.0)}x`\n"
            f"• **Min XP:** `{lvl_settings.get('min_xp', 15)}`\n"
            f"• **Max XP:** `{lvl_settings.get('max_xp', 25)}`\n"
            f"• **Cooldown:** `{lvl_settings.get('cooldown', 60)}s`\n"
        )
        await interaction.response.send_message(embed=success_embed(desc, "Leveling Config Updated"), ephemeral=True)

    @app_commands.command(name="setwelcome", description="Configure welcome message system")
    @app_commands.describe(enabled="Enable welcome messages", channel="Channel for welcome messages", message="Custom welcome message")
    @app_commands.checks.has_permissions(administrator=True)
    async def setwelcome(
        self,
        interaction: discord.Interaction,
        enabled: bool,
        channel: discord.TextChannel = None,
        message: str = None
    ):
        guild_data = await get_guild(interaction.guild.id)
        settings = guild_data.get("settings", {})
        channels = guild_data.get("channels", {})
        
        welcome_data = settings.get("welcome", {})
        welcome_data["enabled"] = enabled
        if message:
            welcome_data["message"] = message
        if channel:
            channels["welcome"] = str(channel.id)

        settings["welcome"] = welcome_data
        await update_guild(interaction.guild.id, "settings", settings)
        await update_guild(interaction.guild.id, "channels", channels)

        desc = (
            f"• **Welcome Status:** `{'ENABLED' if enabled else 'DISABLED'}`\n"
            f"• **Channel:** `{channel.mention if channel else 'None'}`\n"
            f"• **Message Template:** `{welcome_data.get('message', 'Welcome {user} to {server}!')}`\n"
        )
        await interaction.response.send_message(embed=success_embed(desc, "Welcome System Updated"), ephemeral=True)

    @app_commands.command(name="setupvc", description="Configure automatic Temporary Voice Channel creator (Auto-VC)")
    @app_commands.describe(trigger_channel="Voice channel that members join to create private VC", category="Category where temp VCs are created")
    @app_commands.checks.has_permissions(administrator=True)
    async def setupvc(self, interaction: discord.Interaction, trigger_channel: discord.VoiceChannel, category: discord.CategoryChannel = None):
        guild_data = await get_guild(interaction.guild.id)
        settings = guild_data.get("settings", {})
        settings["autovc"] = {
            "trigger_channel_id": str(trigger_channel.id),
            "category_id": str(category.id) if category else str(trigger_channel.category_id or "")
        }
        await update_guild(interaction.guild.id, "settings", settings)
        
        await interaction.response.send_message(
            embed=success_embed(f"Auto-VC configured!\n• **Trigger Channel:** {trigger_channel.mention}\n• **Category:** {category.name if category else 'Default'}"),
            ephemeral=True
        )

    @commands.Cog.listener()
    async def on_voice_state_update(self, member: discord.Member, before: discord.VoiceState, after: discord.VoiceState):
        if member.bot:
            return

        guild = member.guild
        guild_data = await get_guild(guild.id)
        autovc_config = guild_data.get("settings", {}).get("autovc", {})
        trigger_id = autovc_config.get("trigger_channel_id")

        # Member joined trigger channel -> Create temp VC
        if after.channel and str(after.channel.id) == trigger_id:
            category_id = autovc_config.get("category_id")
            category = guild.get_channel(int(category_id)) if category_id else after.channel.category
            try:
                temp_vc = await guild.create_voice_channel(
                    name=f"🔊 {member.display_name}'s VC",
                    category=category,
                    user_limit=10,
                    reason="Auto-VC temporary channel creation"
                )
                await member.move_to(temp_vc)

                # Record in database
                async with get_db() as db:
                    await db.execute(
                        "INSERT INTO auto_vcs (channel_id, guild_id, user_id) VALUES (?, ?, ?)",
                        (str(temp_vc.id), str(guild.id), str(member.id))
                    )
                    await db.commit()
            except Exception as e:
                print(f"[AutoVC] Error creating channel: {e}")

        # Member left a channel -> Check if it was an empty temp VC and delete it
        if before.channel:
            async with get_db() as db:
                async with db.execute("SELECT * FROM auto_vcs WHERE channel_id = ?", (str(before.channel.id),)) as cursor:
                    row = await cursor.fetchone()
                    if row and len(before.channel.members) == 0:
                        try:
                            await before.channel.delete(reason="Auto-VC empty temp channel cleanup")
                            await db.execute("DELETE FROM auto_vcs WHERE channel_id = ?", (str(before.channel.id),))
                            await db.commit()
                        except Exception as e:
                            print(f"[AutoVC] Error deleting channel: {e}")

    @commands.Cog.listener()
    async def on_member_join(self, member: discord.Member):
        if member.bot:
            return
        guild_data = await get_guild(member.guild.id)
        
        # 1. Autorole
        autorole_id = guild_data.get("roles", {}).get("autorole")
        if autorole_id:
            role = member.guild.get_role(int(autorole_id))
            if role:
                try:
                    await member.add_roles(role, reason="Auto-Role on join")
                except Exception:
                    pass

        # 2. Welcome Message
        welcome_settings = guild_data.get("settings", {}).get("welcome", {})
        if welcome_settings.get("enabled"):
            welcome_ch_id = guild_data.get("channels", {}).get("welcome")
            if welcome_ch_id:
                ch = member.guild.get_channel(int(welcome_ch_id))
                if ch:
                    tmpl = welcome_settings.get("message", "Welcome {user} to {server}!")
                    msg = tmpl.replace("{user}", member.mention).replace("{server}", member.guild.name)
                    embed = discord.Embed(
                        title=f"👋 Welcome to {member.guild.name}!",
                        description=msg,
                        color=discord.Color.green()
                    )
                    if member.display_avatar:
                        embed.set_thumbnail(url=member.display_avatar.url)
                    await ch.send(embed=embed)

async def setup(bot: commands.Bot):
    await bot.add_cog(ConfigCog(bot))
