import discord
from discord import app_commands
from discord.ext import commands
try:
    from database.connection import get_db
except ModuleNotFoundError:
    try:
        from database import get_db
    except ModuleNotFoundError:
        import database
        get_db = database.get_db
from utils.helpers import success_embed, error_embed, info_embed

class DynamicButtonRoleView(discord.ui.View):
    def __init__(self, custom_id: str, label: str, role_id: int, color_style: discord.ButtonStyle):
        super().__init__(timeout=None)
        btn = discord.ui.Button(
            label=label,
            style=color_style,
            custom_id=custom_id,
            emoji="✨"
        )
        btn.callback = self.button_callback
        self.add_item(btn)
        self.role_id = role_id

    async def button_callback(self, interaction: discord.Interaction):
        role = interaction.guild.get_role(self.role_id)
        if not role:
            return await interaction.response.send_message("❌ This role no longer exists.", ephemeral=True)

        if role in interaction.user.roles:
            try:
                await interaction.user.remove_roles(role, reason="Button role toggle")
                await interaction.response.send_message(f"Removed role **{role.name}**.", ephemeral=True)
            except Exception as e:
                await interaction.response.send_message(f"❌ Failed to remove role: {str(e)}", ephemeral=True)
        else:
            try:
                await interaction.user.add_roles(role, reason="Button role toggle")
                await interaction.response.send_message(f"Added role **{role.name}**!", ephemeral=True)
            except Exception as e:
                await interaction.response.send_message(f"❌ Failed to add role: {str(e)}", ephemeral=True)

class RolesCog(commands.Cog, name="roles"):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @app_commands.command(name="reactionrole", description="Bind an emoji reaction on a message to give a role")
    @app_commands.describe(channel="Channel containing target message", message_id="Message ID to react to", emoji="Emoji to use", role="Role to give")
    @app_commands.checks.has_permissions(manage_roles=True)
    async def reactionrole(
        self,
        interaction: discord.Interaction,
        channel: discord.TextChannel,
        message_id: str,
        emoji: str,
        role: discord.Role
    ):
        try:
            msg = await channel.fetch_message(int(message_id.strip()))
            await msg.add_reaction(emoji)
        except Exception as e:
            return await interaction.response.send_message(embed=error_embed(f"Could not find message or add reaction: {str(e)}"), ephemeral=True)

        async with get_db() as db:
            await db.execute(
                """
                INSERT INTO reaction_roles (message_id, guild_id, channel_id, role_id, emoji)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(message_id) DO UPDATE SET role_id = ?, emoji = ?
                """,
                (str(msg.id), str(interaction.guild.id), str(channel.id), str(role.id), emoji, str(role.id), emoji)
            )
            await db.commit()

        await interaction.response.send_message(
            embed=success_embed(f"Reaction role created!\n• **Message:** {msg.jump_url}\n• **Emoji:** {emoji}\n• **Role:** {role.mention}"),
            ephemeral=True
        )

    @app_commands.command(name="buttonrole", description="Create a sleek interactive button role selector message")
    @app_commands.describe(
        channel="Target channel for button",
        role="Role to toggle with button",
        label="Text shown on button",
        color="Button color style"
    )
    @app_commands.choices(color=[
        app_commands.Choice(name="Blurple (Primary)", value="primary"),
        app_commands.Choice(name="Green (Success)", value="success"),
        app_commands.Choice(name="Grey (Secondary)", value="secondary"),
        app_commands.Choice(name="Red (Danger)", value="danger")
    ])
    @app_commands.checks.has_permissions(manage_roles=True)
    async def buttonrole(
        self,
        interaction: discord.Interaction,
        channel: discord.TextChannel,
        role: discord.Role,
        label: str,
        color: str = "primary"
    ):
        style_map = {
            "primary": discord.ButtonStyle.primary,
            "success": discord.ButtonStyle.success,
            "secondary": discord.ButtonStyle.secondary,
            "danger": discord.ButtonStyle.danger
        }
        style = style_map.get(color, discord.ButtonStyle.primary)
        custom_id = f"btn_role_{role.id}"

        embed = discord.Embed(
            title="🎭 Role Assignment",
            description=f"Click the button below to get or remove the {role.mention} role.",
            color=role.color if role.color.value != 0 else discord.Color.blue()
        )

        view = DynamicButtonRoleView(custom_id, label, role.id, style)
        msg = await channel.send(embed=embed, view=view)

        async with get_db() as db:
            await db.execute(
                """
                INSERT INTO button_roles (message_id, guild_id, channel_id, role_id, label, custom_id)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (str(msg.id), str(interaction.guild.id), str(channel.id), str(role.id), label, custom_id)
            )
            await db.commit()

        await interaction.response.send_message(
            embed=success_embed(f"Button role message deployed to {channel.mention}!"),
            ephemeral=True
        )

    @commands.Cog.listener()
    async def on_raw_reaction_add(self, payload: discord.RawReactionActionEvent):
        if not payload.guild_id or payload.user_id == self.bot.user.id:
            return

        async with get_db() as db:
            async with db.execute(
                "SELECT * FROM reaction_roles WHERE message_id = ? AND emoji = ?",
                (str(payload.message_id), str(payload.emoji))
            ) as cursor:
                row = await cursor.fetchone()

        if row:
            guild = self.bot.get_guild(payload.guild_id)
            if guild:
                role = guild.get_role(int(row["role_id"]))
                member = guild.get_member(payload.user_id)
                if role and member and role not in member.roles:
                    try:
                        await member.add_roles(role, reason="Reaction Role toggle")
                    except Exception:
                        pass

    @commands.Cog.listener()
    async def on_raw_reaction_remove(self, payload: discord.RawReactionActionEvent):
        if not payload.guild_id or payload.user_id == self.bot.user.id:
            return

        async with get_db() as db:
            async with db.execute(
                "SELECT * FROM reaction_roles WHERE message_id = ? AND emoji = ?",
                (str(payload.message_id), str(payload.emoji))
            ) as cursor:
                row = await cursor.fetchone()

        if row:
            guild = self.bot.get_guild(payload.guild_id)
            if guild:
                role = guild.get_role(int(row["role_id"]))
                member = guild.get_member(payload.user_id)
                if role and member and role in member.roles:
                    try:
                        await member.remove_roles(role, reason="Reaction Role toggle")
                    except Exception:
                        pass

async def setup(bot: commands.Bot):
    await bot.add_cog(RolesCog(bot))
