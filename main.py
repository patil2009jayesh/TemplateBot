import os
import sys
from pathlib import Path

# Ensure root directory is always in sys.path
BASE_DIR = Path(__file__).parent.resolve()

# Auto-fix Windows backslash filenames on Linux containers
import shutil
for item in list(BASE_DIR.iterdir()):
    if "\\" in item.name:
        parts = item.name.split("\\")
        target_dir = BASE_DIR
        for part in parts[:-1]:
            target_dir = target_dir / part
            target_dir.mkdir(exist_ok=True)
        target_file = target_dir / parts[-1]
        try:
            shutil.move(str(item), str(target_file))
        except Exception:
            pass

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

        # Ensure all possible cog locations are in sys.path
        possible_dirs = [
            BASE_DIR,
            BASE_DIR / "cogs",
            Path("/home/container"),
            Path("/home/container/cogs"),
            Path.cwd(),
            Path.cwd() / "cogs"
        ]
        for root_p in [BASE_DIR, Path("/home/container"), Path.cwd()]:
            if root_p.exists():
                for sub in root_p.glob("**/cogs"):
                    if sub.is_dir() and sub.parent not in possible_dirs:
                        possible_dirs.insert(0, sub.parent)

        for p in possible_dirs:
            if p.exists() and str(p) not in sys.path:
                sys.path.insert(0, str(p))

        logger.info(f"Current container files: {[f.name for f in BASE_DIR.iterdir()] if BASE_DIR.exists() else 'N/A'}")

        # Load all cogs
        import importlib
        for cog_name in COGS_LIST:
            loaded = False
            try:
                await self.load_extension(cog_name)
                logger.info(f"Loaded Cog: {cog_name}")
                loaded = True
            except Exception as e1:
                try:
                    mod = importlib.import_module(cog_name)
                    if hasattr(mod, "setup"):
                        await mod.setup(self)
                        logger.info(f"Loaded Cog directly: {cog_name}")
                        loaded = True
                except Exception as e2:
                    try:
                        short_name = cog_name.split(".")[-1]
                        mod = importlib.import_module(short_name)
                        if hasattr(mod, "setup"):
                            await mod.setup(self)
                            logger.info(f"Loaded Cog short: {short_name}")
                            loaded = True
                    except Exception as e3:
                        logger.error(f"Failed to load cog {cog_name}: {e1} | {e2} | {e3}")

        # ── ONE global sync only ──
        # DO NOT also sync per-guild in on_ready — that causes every command
        # to appear twice in Discord's slash menu.
        logger.info("Syncing slash commands globally with Discord (this may take up to 1 hour to propagate)...")
        try:
            synced = await self.tree.sync()
            logger.info(f"Successfully synced {len(synced)} global slash command(s).")
        except Exception as e:
            logger.error(f"Failed to sync slash commands: {e}")

    async def on_ready(self):
        logger.info(f"Logged in as {self.user} (ID: {self.user.id})")
        logger.info(f"Serving {len(self.guilds)} guild(s) with {len(self.users)} cached members.")
        # NOTE: Do NOT call tree.sync(guild=...) here.
        # That registers guild-specific duplicates of every global command.

        activity = discord.Activity(type=discord.ActivityType.watching, name="Axquen Server | /help")
        await self.change_presence(activity=activity, status=discord.Status.online)
        logger.info("Tachos Dev presence initialized.")

    async def on_tree_error(self, interaction: discord.Interaction, error: discord.app_commands.AppCommandError):
        if isinstance(error, discord.app_commands.MissingPermissions):
            perms = ", ".join(error.missing_permissions)
            msg = f"❌ You are missing required permissions: `{perms}`."
        elif isinstance(error, discord.app_commands.BotMissingPermissions):
            perms = ", ".join(error.missing_permissions)
            msg = f"❌ I am missing required bot permissions: `{perms}`."
        else:
            logger.error(f"Command error in {interaction.command}: {error}", exc_info=True)
            msg = f"❌ An error occurred: {str(error)}"

        try:
            if not interaction.response.is_done():
                await interaction.response.send_message(msg, ephemeral=True)
            else:
                await interaction.followup.send(msg, ephemeral=True)
        except Exception:
            pass

async def run_bot():
    global bot
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
    if os.getenv("RUNNING_SUB_BOT") != "1" and (BASE_DIR / ".env.bot2").exists():
        from bot import run_multi_bot
        run_multi_bot()
    else:
        try:
            main()
        except KeyboardInterrupt:
            logger.info("Bot shutting down...")

