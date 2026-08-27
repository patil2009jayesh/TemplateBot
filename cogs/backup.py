import json
import io
import discord
from discord import app_commands
from discord.ext import commands
from services.backup_service import export_guild, save_backup, list_backups, create_restore_plan, restore_guild
from utils.helpers import success_embed, error_embed, info_embed

class RestoreConfirmView(discord.ui.View):
    def __init__(self, backup_data: dict, mode: str):
        super().__init__(timeout=60.0)
        self.backup_data = backup_data
        self.mode = mode
        self.value = None

    @discord.ui.button(label="Confirm & Restore", style=discord.ButtonStyle.danger, emoji="⚠️")
    async def confirm(self, interaction: discord.Interaction, button: discord.ui.Button):
        self.value = True
        self.stop()
        await interaction.response.defer(ephemeral=True)
        
        status_msg = await interaction.followup.send(
            embed=info_embed("⏳ Applying restore... Please do not edit server settings.", "Server Restore in Progress"),
            ephemeral=True
        )
        
        try:
            plan = await restore_guild(self.backup_data, interaction.guild, self.mode)
            warn_text = ("\n\n**Warnings:**\n" + "\n".join(plan["warnings"])) if plan["warnings"] else ""
            await interaction.followup.send(
                embed=success_embed(
                    f"Server restored successfully in `{self.mode.upper()}` mode!{warn_text}",
                    "Restore Completed"
                ),
                ephemeral=True
            )
        except Exception as e:
            await interaction.followup.send(
                embed=error_embed(f"Failed to restore: {str(e)}"),
                ephemeral=True
            )

    @discord.ui.button(label="Cancel", style=discord.ButtonStyle.secondary)
    async def cancel(self, interaction: discord.Interaction, button: discord.ui.Button):
        self.value = False
        self.stop()
        await interaction.response.edit_message(
            embed=info_embed("Restore operation cancelled.", "Cancelled"),
            view=None
        )

class BackupCog(commands.GroupCog, name="backup"):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        super().__init__()

    @app_commands.command(name="export", description="Export full server configuration as a JSON file")
    @app_commands.checks.has_permissions(administrator=True)
    async def export(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)
        try:
            data = export_guild(interaction.guild, self.bot.user.id)
            saved_path = await save_backup(interaction.guild.id, data)
            
            json_str = json.dumps(data, indent=2, ensure_ascii=False)
            file_data = io.BytesIO(json_str.encode("utf-8"))
            file = discord.File(file_data, filename=f"backup-{interaction.guild.name}-{interaction.guild.id}.json")
            
            embed = success_embed(
                f"Exported **{len(data['roles'])}** roles, **{len(data['channels'])}** channels, "
                f"**{len(data['emojis'])}** emojis, and **{len(data['stickers'])}** stickers.",
                "Server Backup Created"
            )
            embed.set_footer(text="Tachos Dev Exporter Suite • Store this JSON safely")
            
            await interaction.followup.send(embed=embed, file=file, ephemeral=True)
        except Exception as e:
            await interaction.followup.send(embed=error_embed(f"Export failed: {str(e)}"), ephemeral=True)

    @app_commands.command(name="inspect", description="Inspect server metrics and structure counts")
    @app_commands.checks.has_permissions(manage_guild=True)
    async def inspect(self, interaction: discord.Interaction):
        guild = interaction.guild
        embed = discord.Embed(
            title=f"🔍 Server Structure Inspection — {guild.name}",
            color=discord.Color.blue()
        )
        if guild.icon:
            embed.set_thumbnail(url=guild.icon.url)
            
        embed.add_field(name="👥 Total Members", value=str(guild.member_count), inline=True)
        embed.add_field(name="🛡️ Total Roles", value=str(len(guild.roles)), inline=True)
        embed.add_field(name="📁 Categories", value=str(len(guild.categories)), inline=True)
        embed.add_field(name="💬 Text Channels", value=str(len(guild.text_channels)), inline=True)
        embed.add_field(name="🔊 Voice Channels", value=str(len(guild.voice_channels)), inline=True)
        embed.add_field(name="😃 Custom Emojis", value=str(len(guild.emojis)), inline=True)
        embed.set_footer(text="Tachos Dev Exporter Suite")
        
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="restore", description="Restore or migrate server structure from a backup JSON")
    @app_commands.describe(
        file="Backup JSON file to upload",
        mode="Merge (safe add missing) or Replace (recreate entire server)",
        dry_run="Preview changes without modifying the server"
    )
    @app_commands.choices(mode=[
        app_commands.Choice(name="Merge (Safe Add)", value="merge"),
        app_commands.Choice(name="Replace (Full Wipe & Recreate)", value="replace")
    ])
    @app_commands.checks.has_permissions(administrator=True)
    async def restore(
        self,
        interaction: discord.Interaction,
        file: discord.Attachment,
        mode: str = "merge",
        dry_run: bool = False
    ):
        await interaction.response.defer(ephemeral=True)
        if not file.filename.endswith(".json"):
            return await interaction.followup.send(embed=error_embed("File must be a `.json` backup file."), ephemeral=True)
            
        try:
            content = await file.read()
            backup_data = json.loads(content.decode("utf-8"))
        except Exception as e:
            return await interaction.followup.send(embed=error_embed(f"Invalid JSON file: {str(e)}"), ephemeral=True)

        plan = create_restore_plan(backup_data, interaction.guild, mode)
        
        plan_desc = (
            f"**Mode:** `{mode.upper()}`\n"
            f"• Roles to Create: **{plan['roles_to_create']}**\n"
            f"• Channels to Create: **{plan['channels_to_create']}**\n"
            f"• Emojis in Backup: **{plan['emojis_to_create']}**\n"
            f"• Stickers in Backup: **{plan['stickers_to_create']}**\n"
        )
        if mode == "replace":
            plan_desc += (
                f"\n⚠️ **CAUTION:** Replace mode will delete **{plan['roles_to_delete']}** existing roles "
                f"and **{plan['channels_to_delete']}** channels before recreating!"
            )
            
        if plan["warnings"]:
            plan_desc += "\n\n**Warnings:**\n" + "\n".join(f"• {w}" for w in plan["warnings"])

        if dry_run:
            embed = info_embed(plan_desc, "🔎 Dry-Run Restore Plan Preview")
            embed.set_footer(text="Dry-run completed. No server modifications made.")
            return await interaction.followup.send(embed=embed, ephemeral=True)

        embed = discord.Embed(
            title="⚠️ Confirm Server Restore",
            description=plan_desc,
            color=discord.Color.red() if mode == "replace" else discord.Color.orange()
        )
        embed.set_footer(text="Click below to proceed. This action cannot be undone.")
        
        view = RestoreConfirmView(backup_data, mode)
        await interaction.followup.send(embed=embed, view=view, ephemeral=True)

    @app_commands.command(name="list", description="List recent backup checkpoints on this server")
    @app_commands.checks.has_permissions(administrator=True)
    async def list_cmd(self, interaction: discord.Interaction):
        backups = list_backups(interaction.guild.id)
        if not backups:
            return await interaction.response.send_message(
                embed=info_embed("No saved local backups found. Use `/backup export` to create one.", "Backup Checkpoints"),
                ephemeral=True
            )
            
        desc = ""
        for i, b in enumerate(backups[:10], 1):
            desc += f"**{i}. `{b['filename']}`**\n• Date: {b['exported_at']}\n• Roles: {b['roles_count']} | Channels: {b['channels_count']}\n\n"
            
        embed = info_embed(desc, "📦 Local Server Backup Checkpoints")
        await interaction.response.send_message(embed=embed, ephemeral=True)

async def setup(bot: commands.Bot):
    await bot.add_cog(BackupCog(bot))
