import os
import sys
from pathlib import Path

# Ensure root directory is always in sys.path
BASE_DIR = Path(__file__).parent.resolve()
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import asyncio
import logging
from dotenv import load_dotenv
import discord
from discord.ext import commands
try:
    from database.connection import init_db
except ModuleNotFoundError:
    try:
        from database import init_db
    except ModuleNotFoundError:
        import database
        init_db = database.init_db

# Load environment variables
load_dotenv()

TOKEN = os.getenv("DISCORD_TOKEN")
if not TOKEN:
    print("[ERROR] DISCORD_TOKEN is missing in .env!")
    sys.exit(1)

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("TachosDev")

intents = discord.Intents.default()
intents.message_content = True
intents.members = True
intents.guilds = True
intents.voice_states = True
intents.reactions = True

class TachosDevBot(commands.Bot):
    def __init__(self):
        super().__init__(
            command_prefix=commands.when_mentioned_or("!"),
            intents=intents,
            help_command=None
        )

    async def setup_hook(self):
        logger.info("Initializing SQLite database tables...")
        await init_db()

        # Dynamically load all cogs from cogs/
        cogs_dir = Path(__file__).parent / "cogs"
        if cogs_dir.exists():
            for file in cogs_dir.glob("*.py"):
                if not file.name.startswith("_"):
                    cog_name = f"cogs.{file.stem}"
                    try:
                        await self.load_extension(cog_name)
                        logger.info(f"Loaded Cog: {cog_name}")
                    except Exception as e:
                        logger.error(f"Failed to load cog {cog_name}: {e}", exc_info=True)

        # Sync application slash commands globally
        logger.info("Syncing slash commands globally with Discord...")
        try:
            synced = await self.tree.sync()
            logger.info(f"Successfully synced {len(synced)} slash command(s) globally!")
        except Exception as e:
            logger.error(f"Failed to sync slash commands: {e}")

    async def on_ready(self):
        logger.info(f"Logged in as {self.user} (ID: {self.user.id})")
        logger.info(f"Serving {len(self.guilds)} guild(s) with {len(self.users)} cached members.")

        activity = discord.Activity(type=discord.ActivityType.watching, name="Tachos Dev | /help")
        await self.change_presence(activity=activity, status=discord.Status.online)
        logger.info("Tachos Dev presence initialized.")

    async def on_tree_error(self, interaction: discord.Interaction, error: discord.app_commands.AppCommandError):
        if isinstance(error, discord.app_commands.MissingPermissions):
            perms = ", ".join(error.missing_permissions)
            if not interaction.response.is_done():
                await interaction.response.send_message(f"❌ You are missing required permissions: `{perms}`.", ephemeral=True)
            else:
                await interaction.followup.send(f"❌ You are missing required permissions: `{perms}`.", ephemeral=True)
        elif isinstance(error, discord.app_commands.BotMissingPermissions):
            perms = ", ".join(error.missing_permissions)
            if not interaction.response.is_done():
                await interaction.response.send_message(f"❌ I am missing required bot permissions: `{perms}`.", ephemeral=True)
            else:
                await interaction.followup.send(f"❌ I am missing required bot permissions: `{perms}`.", ephemeral=True)
        else:
            logger.error(f"Command error in {interaction.command}: {error}", exc_info=True)
            msg = f"❌ An error occurred while executing this command: {str(error)}"
            if not interaction.response.is_done():
                await interaction.response.send_message(msg, ephemeral=True)
            else:
                await interaction.followup.send(msg, ephemeral=True)

bot = TachosDevBot()
bot.tree.on_error = bot.on_tree_error

async def main():
    try:
        async with bot:
            await bot.start(TOKEN)
    except discord.errors.PrivilegedIntentsRequired:
        logger.warning("Privileged Intents are not enabled on Discord Developer Portal! Starting with basic intents fallback...")
        bot.intents.message_content = False
        bot.intents.members = False
        bot.intents.presences = False
        async with bot:
            await bot.start(TOKEN)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Bot shutting down...")
