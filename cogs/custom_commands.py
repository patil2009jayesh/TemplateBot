import discord
from discord import app_commands
from discord.ext import commands
from services.custom_cmd_service import get_custom_command, add_custom_command, delete_custom_command, list_custom_commands
from utils.helpers import success_embed, error_embed, info_embed

class CustomCommandsCog(commands.Cog, name="custom_commands"):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @app_commands.command(name="addcmd", description="Create or update a custom server command")
    @app_commands.describe(name="Command name (without prefix)", response="Response text from bot")
    @app_commands.checks.has_permissions(manage_guild=True)
    async def addcmd(self, interaction: discord.Interaction, name: str, response: str):
        clean_name = name.strip().lower()
        # Ensure not overriding built-in commands
        builtin_names = {cmd.name for cmd in self.bot.tree.get_commands()}
        if clean_name in builtin_names:
            return await interaction.response.send_message(
                embed=error_embed(f"`{clean_name}` is a built-in bot command and cannot be overridden."),
                ephemeral=True
            )

        await add_custom_command(interaction.guild.id, clean_name, response, interaction.user.id)
        await interaction.response.send_message(
            embed=success_embed(f"Custom command `!{clean_name}` created!\n**Response:** {response}"),
            ephemeral=True
        )

    @app_commands.command(name="delcmd", description="Delete an existing custom server command")
    @app_commands.describe(name="Command name to delete")
    @app_commands.checks.has_permissions(manage_guild=True)
    async def delcmd(self, interaction: discord.Interaction, name: str):
        clean_name = name.strip().lower()
        success = await delete_custom_command(interaction.guild.id, clean_name)
        if success:
            await interaction.response.send_message(
                embed=success_embed(f"Custom command `!{clean_name}` deleted."),
                ephemeral=True
            )
        else:
            await interaction.response.send_message(
                embed=error_embed(f"Custom command `!{clean_name}` does not exist."),
                ephemeral=True
            )

    @app_commands.command(name="listcmds", description="List all custom commands on this server")
    async def listcmds(self, interaction: discord.Interaction):
        cmds = await list_custom_commands(interaction.guild.id)
        if not cmds:
            return await interaction.response.send_message(
                embed=info_embed("No custom commands found on this server. Add one with `/addcmd`.", "Custom Commands"),
                ephemeral=True
            )

        desc = ""
        for c in cmds:
            desc += f"• `!{c['name']}` — {c['response'][:60]}{'...' if len(c['response']) > 60 else ''}\n"

        embed = info_embed(desc, f"📜 Custom Commands ({len(cmds)})")
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        if not message.guild or message.author.bot or not message.content.startswith(("!", "?", ".")):
            return

        cmd_name = message.content[1:].split()[0].lower()
        custom = await get_custom_command(message.guild.id, cmd_name)
        if custom:
            await message.channel.send(custom["response"])

async def setup(bot: commands.Bot):
    await bot.add_cog(CustomCommandsCog(bot))
