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

class TicketModal(discord.ui.Modal, title="Create Support Ticket"):
    subject = discord.ui.TextInput(
        label="Ticket Subject",
        placeholder="Brief description of your inquiry...",
        max_length=100,
        required=True
    )
    details = discord.ui.TextInput(
        label="Details & Reason",
        style=discord.TextStyle.paragraph,
        placeholder="Describe how staff can assist you...",
        max_length=1000,
        required=True
    )

    def __init__(self, team_id: int):
        super().__init__()
        self.team_id = team_id

    async def on_submit(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)
        guild = interaction.guild

        # Fetch team config
        cat_id = None
        staff_id = None
        async with get_db() as db:
            async with db.execute("SELECT * FROM ticket_teams WHERE id = ?", (self.team_id,)) as cursor:
                team = await cursor.fetchone()
                if team:
                    try:
                        cat_id = team["category_id"]
                        staff_id = team["staff_role_id"]
                    except (TypeError, KeyError, IndexError):
                        staff_id = team[3] if len(team) > 3 else None
                        cat_id = team[4] if len(team) > 4 else None

        category = guild.get_channel(int(cat_id)) if cat_id else None
        staff_role = guild.get_role(int(staff_id)) if staff_id else None

        # Permissions: Creator + Staff + Bot
        overwrites = {
            guild.default_role: discord.PermissionOverwrite(read_messages=False),
            interaction.user: discord.PermissionOverwrite(read_messages=True, send_messages=True, attach_files=True),
            guild.me: discord.PermissionOverwrite(read_messages=True, send_messages=True, manage_channels=True)
        }
        if staff_role:
            overwrites[staff_role] = discord.PermissionOverwrite(read_messages=True, send_messages=True)

        try:
            user_suffix = interaction.user.discriminator if (interaction.user.discriminator and interaction.user.discriminator != '0') else str(interaction.user.id)[-4:]
            channel_name = f"ticket-{interaction.user.name[:12]}-{user_suffix}"
            ticket_ch = await guild.create_text_channel(
                name=channel_name,
                category=category,
                overwrites=overwrites,
                topic=f"Support Ticket for {interaction.user} | Subject: {self.subject.value}",
                reason="Ticket creation"
            )

            # Record in database
            async with get_db() as db:
                cursor = await db.execute(
                    """
                    INSERT INTO tickets (guild_id, channel_id, creator_id, staff_id, reason, status, team_id)
                    VALUES (?, ?, ?, NULL, ?, 'open', ?)
                    """,
                    (str(guild.id), str(ticket_ch.id), str(interaction.user.id), f"{self.subject.value}: {self.details.value}", self.team_id)
                )
                ticket_id = cursor.lastrowid
                await db.commit()

            ticket_embed = discord.Embed(
                title=f"🎫 Support Ticket #{ticket_id}",
                description=f"**User:** {interaction.user.mention}\n**Subject:** {self.subject.value}\n\n**Details:**\n{self.details.value}",
                color=discord.Color.blue()
            )
            ticket_embed.set_footer(text="Staff will assist you shortly. Use buttons below to manage.")

            view = TicketActionView(ticket_id)
            await ticket_ch.send(
                content=f"{interaction.user.mention} {staff_role.mention if staff_role else ''}",
                embed=ticket_embed,
                view=view
            )

            await interaction.followup.send(
                embed=success_embed(f"Your ticket has been created: {ticket_ch.mention}"),
                ephemeral=True
            )
        except Exception as e:
            await interaction.followup.send(embed=error_embed(f"Could not create ticket channel: {str(e)}"), ephemeral=True)

class TicketActionView(discord.ui.View):
    def __init__(self, ticket_id: int):
        super().__init__(timeout=None)
        self.ticket_id = ticket_id

    @discord.ui.button(label="Claim Ticket", style=discord.ButtonStyle.primary, emoji="🙋", custom_id="claim_ticket_btn")
    async def claim_btn(self, interaction: discord.Interaction, button: discord.ui.Button):
        async with get_db() as db:
            await db.execute("UPDATE tickets SET staff_id = ? WHERE id = ?", (str(interaction.user.id), self.ticket_id))
            await db.commit()

        button.disabled = True
        button.label = f"Claimed by {interaction.user.display_name}"
        await interaction.response.edit_message(view=self)
        await interaction.channel.send(embed=info_embed(f"Ticket has been claimed by {interaction.user.mention}.", "Ticket Claimed"))

    @discord.ui.button(label="Close Ticket", style=discord.ButtonStyle.danger, emoji="🔒", custom_id="close_ticket_btn")
    async def close_btn(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_message(embed=info_embed("Closing ticket and deleting channel in 5 seconds...", "Ticket Closing"))
        async with get_db() as db:
            await db.execute("UPDATE tickets SET status = 'closed' WHERE id = ?", (self.ticket_id,))
            await db.commit()
        
        await discord.utils.sleep_until(discord.utils.utcnow() + discord.utils.datetime.timedelta(seconds=5))
        try:
            await interaction.channel.delete(reason="Ticket closed by user/staff")
        except Exception:
            pass

class TicketPanelButton(discord.ui.View):
    def __init__(self, team_id: int):
        super().__init__(timeout=None)
        self.team_id = team_id

    @discord.ui.button(label="Create Ticket", style=discord.ButtonStyle.success, emoji="📩", custom_id="open_ticket_modal_btn")
    async def open_modal(self, interaction: discord.Interaction, button: discord.ui.Button):
        modal = TicketModal(self.team_id)
        await interaction.response.send_modal(modal)

class TicketsCog(commands.GroupCog, name="ticket"):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        super().__init__()

    @app_commands.command(name="setup-team", description="Create a support ticket category and staff team")
    @app_commands.describe(name="Team name", staff_role="Role that manages these tickets", category="Category for ticket channels")
    @app_commands.checks.has_permissions(administrator=True)
    async def setup_team(self, interaction: discord.Interaction, name: str, staff_role: discord.Role, category: discord.CategoryChannel):
        async with get_db() as db:
            cursor = await db.execute(
                """
                INSERT INTO ticket_teams (guild_id, team_name, staff_role_id, category_id)
                VALUES (?, ?, ?, ?)
                """,
                (str(interaction.guild.id), name, str(staff_role.id), str(category.id))
            )
            team_id = cursor.lastrowid
            await db.commit()

        await interaction.response.send_message(
            embed=success_embed(f"Ticket Team **#{team_id} ({name})** created!\n• **Staff Role:** {staff_role.mention}\n• **Category:** {category.name}"),
            ephemeral=True
        )

    @app_commands.command(name="panel", description="Deploy a ticket creation panel with interactive buttons")
    @app_commands.describe(team_id="Ticket Team ID", title="Panel Title", description="Instructions for users")
    @app_commands.checks.has_permissions(administrator=True)
    async def panel(self, interaction: discord.Interaction, team_id: int, title: str = "📩 Support Ticket Panel", description: str = "Click below to contact our staff team."):
        async with get_db() as db:
            async with db.execute("SELECT * FROM ticket_teams WHERE id = ? AND guild_id = ?", (team_id, str(interaction.guild.id))) as cursor:
                team = await cursor.fetchone()

        if not team:
            return await interaction.response.send_message(embed=error_embed("Invalid Team ID. Create one with `/ticket setup-team` first."), ephemeral=True)

        try:
            team_name = team["team_name"]
        except (TypeError, KeyError, IndexError):
            team_name = team[2] if len(team) > 2 else "Support"

        embed = discord.Embed(
            title=title,
            description=description,
            color=discord.Color.blurple()
        )
        embed.set_footer(text=f"Team: {team_name} • Tachos Dev Tickets")

        view = TicketPanelButton(team_id)
        await interaction.channel.send(embed=embed, view=view)
        await interaction.response.send_message(embed=success_embed("Ticket panel deployed successfully!"), ephemeral=True)

async def setup(bot: commands.Bot):
    await bot.add_cog(TicketsCog(bot))
