import time
import datetime
import discord
from discord import app_commands
from discord.ext import commands, tasks
try:
    from database.connection import get_db
except ModuleNotFoundError:
    try:
        from database import get_db
    except ModuleNotFoundError:
        import database
        get_db = database.get_db
from services.user_service import get_user, set_afk, remove_afk
from utils.helpers import success_embed, error_embed, info_embed
from utils.time_parser import parse_duration, format_duration

class HelpCategorySelect(discord.ui.Select):
    def __init__(self):
        options = [
            discord.SelectOption(label="Dashboard Overview", value="main", emoji="⚡", description="General system overview"),
            discord.SelectOption(label="Server Backup & Exporter", value="backup", emoji="📦", description="Snapshot & restore tools"),
            discord.SelectOption(label="Moderation & AutoMod", value="mod", emoji="🛡️", description="Filters & staff actions"),
            discord.SelectOption(label="Tickets & Support", value="ticket", emoji="🎫", description="Modal support channels"),
            discord.SelectOption(label="Giveaways", value="giveaway", emoji="🎁", description="Timed giveaway draws"),
            discord.SelectOption(label="Leveling & XP", value="leveling", emoji="⭐", description="XP rank cards & rewards"),
            discord.SelectOption(label="Invites & Roles", value="roles", emoji="🔗", description="Self-roles & invite stats"),
            discord.SelectOption(label="Configuration", value="config", emoji="⚙️", description="Server modules & channels"),
            discord.SelectOption(label="General Utility", value="utility", emoji="🛠️", description="Everyday community tools"),
        ]
        super().__init__(placeholder="Select a command category...", min_values=1, max_values=1, options=options)

    async def callback(self, interaction: discord.Interaction):
        cat = self.values[0]
        embed = get_help_embed(cat)
        await interaction.response.edit_message(embed=embed)

class HelpView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=180.0)
        self.add_item(HelpCategorySelect())

def get_help_embed(category: str = "main") -> discord.Embed:
    categories = {
        "main": {
            "title": "⚡ Tachos Dev — Command Dashboard",
            "description": (
                "Welcome! **Tachos Dev** is a comprehensive Discord bot featuring complete server backup & export tools, "
                "moderation, leveling, tickets, giveaways, auto-moderation, and community utilities.\n\n"
                "**Select a category below or use `/help <category>` to view specific commands.**"
            ),
            "fields": [
                ("📦 Server Exporter", "`/backup` — Export, inspect, dry-run & restore server JSONs", True),
                ("🛡️ Moderation", "`/ban`, `/kick`, `/timeout`, `/warn`, `/clear`, `/setautomod`", True),
                ("🎫 Tickets", "`/ticket` — Dynamic support tickets with private channels & staff teams", True),
                ("🎁 Giveaways", "`/giveaway` — Standard, XP-based & Invite-based giveaway draws", True),
                ("⭐ Leveling & XP", "`/rank`, `/leaderboard`, `/levelreward`, `/setleveling`", True),
                ("🔗 Invites & Roles", "`/invites`, `/inviteleaderboard`, `/reactionrole`, `/buttonrole`", True),
                ("⚙️ Configuration", "`/module`, `/setchannel`, `/setautorole`, `/setwelcome`, `/setupvc`", True),
            ]
        },
        "backup": {
            "title": "📦 Server Backup & Exporter",
            "description": "Complete server structure snapshotting, dry-run diffs, and migration engine.",
            "fields": [
                ("`/backup export`", "Downloads complete server configuration (roles, channels, permissions, emojis, stickers) as a JSON file and saves a local checkpoint.", False),
                ("`/backup inspect`", "Displays real-time counts and health metrics for the server structure.", False),
                ("`/backup restore <file> [mode] [dry_run]`", "Upload a backup JSON to preview changes in safe dry-run mode or apply a Merge/Replace restore.", False),
                ("`/backup list`", "Lists recent backup checkpoints saved on the bot server.", False),
            ]
        },
        "mod": {
            "title": "🛡️ Moderation & AutoMod",
            "description": "Keep your community safe with automated filters and quick staff actions.",
            "fields": [
                ("`/ban <user> [reason]`", "Ban a member from the server.", True),
                ("`/kick <user> [reason]`", "Kick a member from the server.", True),
                ("`/timeout <user> <duration>`", "Mute/timeout a user temporarily.", True),
                ("`/unban <user_id>`", "Unban a user by their Discord ID.", True),
                ("`/warn <user> <reason>`", "Issue a formal recorded warning.", True),
                ("`/warnings <user>`", "View past warnings for a user.", True),
                ("`/clearwarnings <user>`", "Clear warning history for a user.", True),
                ("`/clear <amount>`", "Bulk delete messages from the channel.", True),
                ("`/setautomod`", "Toggle anti-spam, anti-links, caps limit, and mention thresholds.", False),
            ]
        },
        "ticket": {
            "title": "🎫 Ticket & Support System",
            "description": "Modal-driven ticket panels for staff-to-user support.",
            "fields": [
                ("`/ticket setup-team`", "Create support ticket teams and categories.", False),
                ("`/ticket panel`", "Deploy interactive ticket creation buttons in channels.", False),
            ]
        },
        "giveaway": {
            "title": "🎁 Giveaway System",
            "description": "Host classic, message-XP weighted, or invite weighted giveaways.",
            "fields": [
                ("`/giveaway`", "Launch a giveaway with custom duration, winner count, and entry criteria.", False),
            ]
        },
        "leveling": {
            "title": "⭐ Leveling & XP",
            "description": "Reward active chatters with XP and role perks.",
            "fields": [
                ("`/rank [user]`", "Check your or another member's XP rank card.", True),
                ("`/leaderboard`", "View the top XP chatters in the server.", True),
                ("`/levelreward`", "Set up automatic role unlocks at specified levels.", True),
                ("`/setleveling`", "Configure XP rate multiplier, rate limits, and announcement channels.", False),
            ]
        },
        "roles": {
            "title": "🔗 Invites & Role Management",
            "description": "Track server invitations and let members pick self-assignable roles.",
            "fields": [
                ("`/invites [user]`", "Check total, real, fake, and left invites.", True),
                ("`/inviteleaderboard`", "View top server inviters.", True),
                ("`/inviteinfo <code>`", "Lookup metadata for an invite code.", True),
                ("`/reactionrole`", "Create reaction-based role assignment.", True),
                ("`/buttonrole`", "Create sleek button-based role assignment.", True),
            ]
        },
        "config": {
            "title": "⚙️ Server Configuration",
            "description": "Manage server-wide settings, channels, and modules.",
            "fields": [
                ("`/module`", "Enable or disable specific features (Leveling, Tickets, Moderation, etc.).", False),
                ("`/setchannel`", "Set dedicated channels (logging, mod logs, leveling, welcome).", False),
                ("`/setautorole`", "Assign a default role to new members on join.", False),
                ("`/setwelcome`", "Customize welcome cards and messages.", False),
                ("`/setupvc`", "Set up automatic Temporary Voice Channels (Auto-VC).", False),
                ("`/addcmd`, `/delcmd`, `/listcmds`", "Manage custom server commands.", False),
            ]
        },
        "utility": {
            "title": "🛠️ General Utility",
            "description": "Helpful everyday tools for members and staff.",
            "fields": [
                ("`/avatar [user]`", "View high-res avatar of a member.", True),
                ("`/userinfo [user]`", "Display joined dates, badges, and roles.", True),
                ("`/serverinfo`", "Display detailed server metrics.", True),
                ("`/poll <question> <options>`", "Create an interactive server poll.", True),
                ("`/remind <time> <msg>`", "Set a timed reminder.", True),
                ("`/afk [reason]`", "Set your AFK status with auto-replies.", True),
                ("`/ping`", "Check bot latency & API response times.", True),
                ("`/uptime`", "Show Tachos Dev online duration.", True),
            ]
        }
    }

    data = categories.get(category, categories["main"])
    embed = discord.Embed(
        title=data["title"],
        description=data["description"],
        color=discord.Color.blurple()
    )
    for name, val, inline in data.get("fields", []):
        embed.add_field(name=name, value=val, inline=inline)
    embed.set_footer(text="Tachos Dev • Server Management & Utilities")
    return embed

class UtilityCog(commands.Cog, name="utility"):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.start_time = time.time()
        self.reminder_loop.start()

    def cog_unload(self):
        self.reminder_loop.cancel()

    @app_commands.command(name="help", description="View all available Tachos Dev commands and system features")
    @app_commands.describe(category="Quickly jump to a command category")
    @app_commands.choices(category=[
        app_commands.Choice(name="📦 Server Backup & Exporter", value="backup"),
        app_commands.Choice(name="🛡️ Moderation & AutoMod", value="mod"),
        app_commands.Choice(name="🎫 Tickets & Support", value="ticket"),
        app_commands.Choice(name="🎁 Giveaways", value="giveaway"),
        app_commands.Choice(name="⭐ Leveling & XP", value="leveling"),
        app_commands.Choice(name="🔗 Invites & Roles", value="roles"),
        app_commands.Choice(name="⚙️ Configuration", value="config"),
        app_commands.Choice(name="🛠️ General Utility", value="utility"),
    ])
    async def help_cmd(self, interaction: discord.Interaction, category: str = "main"):
        embed = get_help_embed(category)
        view = HelpView()
        await interaction.response.send_message(embed=embed, view=view)

    @app_commands.command(name="ping", description="Check bot latency and API websocket response time")
    async def ping(self, interaction: discord.Interaction):
        latency_ms = round(self.bot.latency * 1000)
        embed = discord.Embed(
            title="🏓 Pong!",
            description=f"• **Websocket Latency:** `{latency_ms}ms`\n• **Status:** `Operational 🟢`",
            color=discord.Color.green()
        )
        embed.set_footer(text="Tachos Dev Bot")
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="uptime", description="Show how long Tachos Dev has been running")
    async def uptime(self, interaction: discord.Interaction):
        seconds = int(time.time() - self.start_time)
        formatted = format_duration(seconds)
        embed = discord.Embed(
            title="⏱️ Bot Uptime",
            description=f"**Tachos Dev** has been online for **{formatted}**.",
            color=discord.Color.blue()
        )
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="avatar", description="Get the high-resolution profile picture of a member")
    @app_commands.describe(user="The member whose avatar to view")
    async def avatar(self, interaction: discord.Interaction, user: discord.Member = None):
        target = user or interaction.user
        embed = discord.Embed(
            title=f"🖼️ Avatar — {target.display_name}",
            color=discord.Color.blue()
        )
        if target.display_avatar:
            embed.set_image(url=target.display_avatar.url)
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="userinfo", description="Display detailed metrics and roles for a member")
    @app_commands.describe(user="The member to view")
    async def userinfo(self, interaction: discord.Interaction, user: discord.Member = None):
        target = user or interaction.user
        joined_ts = int(target.joined_at.timestamp()) if target.joined_at else 0
        created_ts = int(target.created_at.timestamp())
        
        roles = [r.mention for r in target.roles if r != interaction.guild.default_role]
        roles_str = ", ".join(roles[:10]) if roles else "None"
        if len(roles) > 10:
            roles_str += f" (+{len(roles)-10} more)"

        embed = discord.Embed(
            title=f"👤 User Info — {target.display_name}",
            color=target.color if target.color.value != 0 else discord.Color.blue()
        )
        if target.display_avatar:
            embed.set_thumbnail(url=target.display_avatar.url)

        embed.add_field(name="🏷️ Tag", value=str(target), inline=True)
        embed.add_field(name="🆔 User ID", value=str(target.id), inline=True)
        embed.add_field(name="🤖 Is Bot?", value="Yes" if target.bot else "No", inline=True)
        embed.add_field(name="📅 Joined Server", value=f"<t:{joined_ts}:R>" if joined_ts else "Unknown", inline=True)
        embed.add_field(name="🗓️ Account Created", value=f"<t:{created_ts}:R>", inline=True)
        embed.add_field(name=f"🛡️ Roles ({len(roles)})", value=roles_str, inline=False)
        embed.set_footer(text="Tachos Dev Utilities")

        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="serverinfo", description="Display detailed statistics about this server")
    async def serverinfo(self, interaction: discord.Interaction):
        guild = interaction.guild
        created_ts = int(guild.created_at.timestamp())

        embed = discord.Embed(
            title=f"🏰 Server Info — {guild.name}",
            description=guild.description or "No description set.",
            color=discord.Color.blue()
        )
        if guild.icon:
            embed.set_thumbnail(url=guild.icon.url)

        embed.add_field(name="👑 Owner", value=guild.owner.mention if guild.owner else "Unknown", inline=True)
        embed.add_field(name="🆔 Server ID", value=str(guild.id), inline=True)
        embed.add_field(name="📅 Created On", value=f"<t:{created_ts}:D> (<t:{created_ts}:R>)", inline=True)
        embed.add_field(name="👥 Members", value=f"{guild.member_count:,} members", inline=True)
        embed.add_field(name="💬 Channels", value=f"{len(guild.text_channels)} Text • {len(guild.voice_channels)} Voice • {len(guild.categories)} Categories", inline=True)
        embed.add_field(name="🛡️ Roles", value=f"{len(guild.roles)} roles", inline=True)
        embed.add_field(name="😃 Emojis & Stickers", value=f"{len(guild.emojis)} emojis • {len(guild.stickers)} stickers", inline=True)
        embed.add_field(name="🚀 Boost Tier", value=f"Level {guild.premium_tier} ({guild.premium_subscription_count} boosts)", inline=True)
        embed.set_footer(text="Tachos Dev Utilities")

        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="poll", description="Create an interactive server poll")
    @app_commands.describe(question="The question to ask", options="Options separated by | (e.g. Option A | Option B)")
    async def poll(self, interaction: discord.Interaction, question: str, options: str = "Yes | No"):
        opts = [o.strip() for o in options.split("|") if o.strip()]
        if len(opts) < 2 or len(opts) > 10:
            return await interaction.response.send_message(embed=error_embed("Please provide between 2 and 10 options separated by `|`."), ephemeral=True)

        emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"]
        desc = ""
        for i, opt in enumerate(opts):
            desc += f"{emojis[i]} **{opt}**\n\n"

        embed = discord.Embed(
            title=f"📊 Poll: {question}",
            description=desc,
            color=discord.Color.blurple()
        )
        embed.set_footer(text=f"Poll created by {interaction.user.display_name}")

        await interaction.response.send_message("Poll deployed!", ephemeral=True)
        msg = await interaction.channel.send(embed=embed)
        for i in range(len(opts)):
            await msg.add_reaction(emojis[i])

    @app_commands.command(name="remind", description="Set a timed reminder for yourself")
    @app_commands.describe(duration="When to remind you (e.g. 10m, 2h, 1d)", message="What to remind you about")
    async def remind(self, interaction: discord.Interaction, duration: str, message: str):
        seconds = parse_duration(duration)
        if not seconds:
            return await interaction.response.send_message(embed=error_embed("Invalid duration format! Use `10s`, `5m`, `2h`, `1d`."), ephemeral=True)

        remind_dt = datetime.datetime.utcnow() + datetime.timedelta(seconds=seconds)
        remind_iso = remind_dt.isoformat()
        remind_ts = int(remind_dt.timestamp())

        async with get_db() as db:
            await db.execute(
                "INSERT INTO reminders (user_id, channel_id, message, remind_at) VALUES (?, ?, ?, ?)",
                (str(interaction.user.id), str(interaction.channel.id), message, remind_iso)
            )
            await db.commit()

        await interaction.response.send_message(
            embed=success_embed(f"Reminder set! I will remind you <t:{remind_ts}:R>:\n> **{message}**"),
            ephemeral=True
        )

    @tasks.loop(seconds=10)
    async def reminder_loop(self):
        now = datetime.datetime.utcnow().isoformat()
        async with get_db() as db:
            async with db.execute("SELECT * FROM reminders WHERE remind_at <= ?", (now,)) as cursor:
                due = await cursor.fetchall()

            for r in due:
                await db.execute("DELETE FROM reminders WHERE id = ?", (r["id"],))
                await db.commit()
                channel = self.bot.get_channel(int(r["channel_id"]))
                if channel:
                    try:
                        await channel.send(f"🔔 <@{r['user_id']}>, here is your reminder:\n> **{r['message']}**")
                    except Exception:
                        pass

    @reminder_loop.before_loop
    async def before_reminder_loop(self):
        await self.bot.wait_until_ready()

    @app_commands.command(name="afk", description="Set your AFK status with an auto-reply reason")
    @app_commands.describe(reason="Why you are AFK")
    async def afk(self, interaction: discord.Interaction, reason: str = "AFK"):
        await set_afk(interaction.user.id, interaction.guild.id, reason)
        await interaction.response.send_message(
            embed=info_embed(f"Your AFK status is now set: **{reason}**.\nI'll notify anyone who mentions you and remove AFK when you type.", "AFK Set"),
            ephemeral=True
        )

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        if not message.guild or message.author.bot:
            return

        # 1. Remove AFK if author was AFK
        user_data = await get_user(message.author.id, message.guild.id)
        if user_data.get("afk"):
            await remove_afk(message.author.id, message.guild.id)
            try:
                await message.channel.send(
                    f"👋 Welcome back {message.author.mention}, I removed your AFK status.",
                    delete_after=6
                )
            except Exception:
                pass

        # 2. Check if any mentioned users are AFK
        for member in message.mentions:
            if member.id == message.author.id or member.bot:
                continue
            mentioned_data = await get_user(member.id, message.guild.id)
            if mentioned_data.get("afk"):
                reason = mentioned_data.get("afk_reason") or "AFK"
                since = mentioned_data.get("afk_since") or ""
                try:
                    await message.channel.send(
                        f"💤 **{member.display_name}** is currently AFK: *{reason}*",
                        delete_after=8
                    )
                except Exception:
                    pass

async def setup(bot: commands.Bot):
    await bot.add_cog(UtilityCog(bot))
