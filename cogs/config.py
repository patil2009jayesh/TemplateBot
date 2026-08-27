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

    @app_commands.command(name="settings", description="View a detailed audit of all configured channels, roles, filters, and feature setups")
    @app_commands.checks.has_permissions(administrator=True)
    async def settings_cmd(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)
        guild = interaction.guild
        guild_data = await get_guild(guild.id)
        
        modules = guild_data.get("modules", {})
        channels = guild_data.get("channels", {})
        roles = guild_data.get("roles", {})
        settings = guild_data.get("settings", {})
        automod = settings.get("automod", {})
        welcome_cfg = settings.get("welcome", {})
        level_cfg = settings.get("leveling", {})
        level_rewards = settings.get("level_rewards", {})

        def ch_repr(ch_id, hint=""):
            if not ch_id:
                return f"⚠️ *Not Configured* {f'(`{hint}`)' if hint else ''}"
            ch = guild.get_channel(int(ch_id))
            return f"✅ {ch.mention} (`{ch.id}`)" if ch else f"❌ *Deleted Channel (`{ch_id}`)*"

        def role_repr(role_id, hint=""):
            if not role_id:
                return f"⚠️ *Not Configured* {f'(`{hint}`)' if hint else ''}"
            r = guild.get_role(int(role_id))
            return f"✅ {r.mention} (`{r.id}`)" if r else f"❌ *Deleted Role (`{role_id}`)*"

        def mod_badge(mod_key):
            is_on = modules.get(mod_key, True)
            return "🟢 **ENABLED**" if is_on else "🔴 **DISABLED** (`/module`)"

        # Fetch database details
        async with get_db() as db:
            # Ticket teams
            async with db.execute("SELECT id, team_name, staff_role_id, category_id FROM ticket_teams WHERE guild_id = ?", (str(guild.id),)) as tc:
                raw_teams = await tc.fetchall()
            # Active open tickets
            async with db.execute("SELECT COUNT(*) FROM tickets WHERE guild_id = ? AND status = 'open'", (str(guild.id),)) as otc:
                open_tickets = (await otc.fetchone())[0]
            # Active giveaways
            async with db.execute("SELECT COUNT(*) FROM giveaways WHERE guild_id = ? AND status = 'active'", (str(guild.id),)) as gc:
                active_gw = (await gc.fetchone())[0]
            # Custom commands list
            async with db.execute("SELECT name FROM custom_commands WHERE guild_id = ?", (str(guild.id),)) as ccc:
                custom_cmds = [r[0] for r in await ccc.fetchall()]
            # Active temp voice channels
            async with db.execute("SELECT COUNT(*) FROM auto_vcs WHERE guild_id = ?", (str(guild.id),)) as vc_cur:
                active_temp_vcs = (await vc_cur.fetchone())[0]
            # Button & Reaction roles
            async with db.execute("SELECT COUNT(*) FROM button_roles WHERE guild_id = ?", (str(guild.id),)) as br_cur:
                btn_roles_count = (await br_cur.fetchone())[0]
            async with db.execute("SELECT COUNT(*) FROM reaction_roles WHERE guild_id = ?", (str(guild.id),)) as rr_cur:
                rxn_roles_count = (await rr_cur.fetchone())[0]

        embed = discord.Embed(
            title=f"🛠️ Complete Setup Audit & Server Settings — {guild.name}",
            description=f"Detailed diagnostic report of every command, channel, role, and automated feature.\nBot Status: 🟢 **Active** • Serving `{guild.member_count}` members",
            color=discord.Color.blue()
        )
        if guild.icon:
            embed.set_thumbnail(url=guild.icon.url)

        # 1. Auto-VC
        autovc_ch = channels.get("autovc_hub")
        autovc_status = (
            f"• **Module:** {mod_badge('auto_vc')}\n"
            f"• **Join-To-Create Hub:** {ch_repr(autovc_ch, '/setupvc channel:<voice>')}\n"
            f"• **Active Temp VCs:** `{active_temp_vcs} currently open`"
        )
        embed.add_field(name="🔊 1. Auto-VC (Join-To-Create)", value=autovc_status, inline=False)

        # 2. Welcome & Autorole
        welcome_msg = welcome_cfg.get("message", "Welcome {user} to {server}!")
        welcome_status = (
            f"• **Module:** {mod_badge('welcome')}\n"
            f"• **Welcome Channel:** {ch_repr(channels.get('welcome'), '/setchannel type:welcome')}\n"
            f"• **Leave Channel:** {ch_repr(channels.get('leave'), '/setchannel type:leave')}\n"
            f"• **Auto-Role on Join:** {role_repr(roles.get('autorole'), '/setautorole role:<role>')}\n"
            f"• **Welcome Template:** *\"{welcome_msg[:80]}{'...' if len(welcome_msg) > 80 else ''}\"*"
        )
        embed.add_field(name="👋 2. Welcome & Onboarding System", value=welcome_status, inline=False)

        # 3. AutoMod & Logging
        automod_status = (
            f"• **Module:** {mod_badge('moderation')}\n"
            f"• **Mod Logs:** {ch_repr(channels.get('mod_logs'), '/setchannel type:mod_logs')}\n"
            f"• **Server Logs:** {ch_repr(channels.get('server_logs'), '/setchannel type:server_logs')}\n"
            f"• **Anti-Links:** `{'🟢 Enabled' if automod.get('anti_links') else '🔴 Disabled'}` • "
            f"**Anti-Spam:** `{'🟢 Enabled' if automod.get('anti_spam') else '🔴 Disabled'}`\n"
            f"• **Caps Limit:** `{automod.get('caps_limit', 70)}%` • "
            f"**Max Mentions:** `{automod.get('mention_limit', 5)} pings`"
        )
        embed.add_field(name="🛡️ 3. AutoMod & Server Logs", value=automod_status, inline=False)

        # 4. Leveling & Rewards
        rewards_formatted = []
        if level_rewards:
            for lvl, r_id in sorted(level_rewards.items(), key=lambda x: int(x[0])):
                role_obj = guild.get_role(int(r_id))
                rewards_formatted.append(f"Level {lvl} ➡️ {role_obj.mention if role_obj else 'Deleted'}")
        rewards_text = ", ".join(rewards_formatted) if rewards_formatted else "⚠️ *No role rewards configured (`/levelreward`)*"

        level_status = (
            f"• **Module:** {mod_badge('leveling')}\n"
            f"• **XP Rate:** `{level_cfg.get('xp_rate', 1.0)}x`\n"
            f"• **Level-Up Channel:** {ch_repr(channels.get('level_ups'), 'Default: Same Channel')}\n"
            f"• **Level Rewards:** {rewards_text}"
        )
        embed.add_field(name="⭐ 4. Leveling & Role Rewards", value=level_status, inline=False)

        # 5. Tickets System
        teams_formatted = []
        if raw_teams:
            for t in raw_teams:
                t_id, t_name, s_role_id, cat_id = t[0], t[1], t[2], t[3]
                s_role = guild.get_role(int(s_role_id)) if s_role_id else None
                cat = guild.get_channel(int(cat_id)) if cat_id else None
                teams_formatted.append(f"• **Team #{t_id} ({t_name})**: Staff {s_role.mention if s_role else 'None'} | Category: `{cat.name if cat else 'None'}`")
            teams_text = "\n".join(teams_formatted)
        else:
            teams_text = "⚠️ *No ticket teams created yet (`/ticket setup-team`)*"

        ticket_status = (
            f"• **Module:** {mod_badge('tickets')}\n"
            f"• **Configured Teams:**\n{teams_text}\n"
            f"• **Active Open Tickets:** `{open_tickets} currently open`"
        )
        embed.add_field(name="🎫 5. Interactive Ticket System", value=ticket_status, inline=False)

        # 6. Self-Roles, Giveaways & Custom Commands
        cmd_preview = ", ".join(f"`!{c}`" for c in custom_cmds[:8]) if custom_cmds else "*None created (`/addcmd`)*"
        extra_status = (
            f"• **Button Role Panels:** `{btn_roles_count} active panels` (`/buttonrole`)\n"
            f"• **Reaction Role Binds:** `{rxn_roles_count} active binds` (`/reactionrole`)\n"
            f"• **Active Giveaways:** `{active_gw} giveaways running` (`/giveaway`)\n"
            f"• **Custom Prefix Commands:** {cmd_preview}"
        )
        embed.add_field(name="🎁 6. Self-Roles, Giveaways & Commands", value=extra_status, inline=False)

        embed.set_footer(text="Tachos Dev • Use any slash command to configure unconfigured features", icon_url=self.bot.user.display_avatar.url if self.bot.user else None)
        await interaction.followup.send(embed=embed, ephemeral=True)

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
