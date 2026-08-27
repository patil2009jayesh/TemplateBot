import os
import sys
from pathlib import Path

# Ensure root directory is always in sys.path
BASE_DIR = Path(__file__).parent.resolve()
for p in [str(BASE_DIR), str(Path.cwd()), "/home/container"]:
    if p not in sys.path:
        sys.path.insert(0, p)

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

# Default safe intents that connect on any Discord bot without requiring verification
intents = discord.Intents.default()
try:
    intents.message_content = True
    intents.members = True
except Exception:
    pass

COGS_LIST = [
    "cogs.backup",
    "cogs.moderation",
    "cogs.config",
    "cogs.leveling",
    "cogs.giveaway",
    "cogs.tickets",
    "cogs.invites",
    "cogs.roles",
    "cogs.custom_commands",
    "cogs.utility"
]

class TachosDevBot(commands.Bot):
    def __init__(self, bot_intents):
        super().__init__(
            command_prefix=commands.when_mentioned_or("!"),
            intents=bot_intents,
            help_command=None
        )

    async def setup_hook(self):
        logger.info("Initializing SQLite database tables...")
        await init_db()

        # Load all 10 cogs explicitly
        for cog_name in COGS_LIST:
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

async def run_bot():
    global bot
    # First attempt with configured intents
    bot = TachosDevBot(intents)
    bot.tree.on_error = bot.on_tree_error
    try:
        async with bot:
            await bot.start(TOKEN)
    except discord.errors.PrivilegedIntentsRequired:
        logger.warning("Privileged Intents not enabled on Discord Portal. Starting with basic default intents...")
        safe_intents = discord.Intents.default()
        bot = TachosDevBot(safe_intents)
        bot.tree.on_error = bot.on_tree_error
        async with bot:
            await bot.start(TOKEN)

def main():
    asyncio.run(run_bot())

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("Bot shutting down...")
