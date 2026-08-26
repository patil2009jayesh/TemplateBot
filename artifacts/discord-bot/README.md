# 🐾 Tachos Dev Bot (Discord Server Management & Utility System)

Welcome to the **Tachos Dev Discord Bot**. This is a powerful, native Node.js application (using `node:sqlite`) designed to bring comprehensive server backup & export tools, moderation, advanced leveling, and ticket management directly into your server without complex database setups.

## 🌟 Key Features

*   **Server Backup & Exporter (`/backup`)**: Export complete server structures (roles, channels, permission overwrites, emojis, stickers, automod) to JSON, inspect metrics, and restore with dry-run previews or replace mode.
*   **Modular Architecture**: Easily enable/disable modules like Leveling, Invites, and AutoMod per server.
*   **Dynamic Giveaways**: Includes standard giveaways, Message-Count (XP), and Invite-tracking giveaways.
*   **Ticket System**: Professional modal-driven private categories for staff-to-user support with tracking.
*   **Built-in SQLite**: Zero external database dependency, perfectly configured for Windows environments.

---

## 📜 Full Command List (38 Commands)

### 📦 Server Backup & Exporter
*   `/backup export` - Export full server configuration as a downloadable JSON file
*   `/backup inspect` - Inspect current server structure, counts, and metadata
*   `/backup restore` - Upload a JSON backup with dry-run previews (Merge / Replace mode)
*   `/backup list` - List recent local server export checkpoints

### ⚙️ Server Configuration
*   `/module` - Enable or disable server modules (AI, leveling, tickets, etc.)
*   `/setautomod` - Setup auto-moderation settings
*   `/setautorole` - Automatically assign a role when a user joins
*   `/setchannel` - Setup essential channels (logs, AI, leveling, etc.)
*   `/setwelcome` - Configure the welcome channel and message structure
*   `/setupvc` - Setup automatic temp VC creation channels

### 🔐 Moderation
*   `/ban` - Ban a user from the server
*   `/kick` - Kick a user from the server
*   `/timeout` - Mute/timeout a user temporarily
*   `/unban` - Unban a previously banned user
*   `/warn` - Issue a warning to a member
*   `/warnings` - View someone's warnings
*   `/clearwarnings` - Clear all warnings for a user
*   `/clear` - Purge a specific number of messages

### 🎫 Utility & Management
*   `/ticket` - Create a new support ticket team/panel
*   `/giveaway` - Start a new giveaway (Classic, XP-Based, Invite-Based)
*   `/remind` - Set a timed reminder
*   `/poll` - Create a quick server poll
*   `/afk` - Set an AFK status

### ⭐ Leveling & Engagement
*   `/setleveling` - Setup leveling multipliers
*   `/levelreward` - Add role rewards for reaching certain levels
*   `/rank` - Check your current XP and rank
*   `/leaderboard` - View the longest active chatters

### 🔗 Invites System
*   `/invites` - Check how many people you've invited
*   `/inviteinfo` - Get details on a specific invite link
*   `/inviteleaderboard` - Top inviters within the server

### 📐 Custom Commands
*   `/addcmd` - Create a custom command unique to your server
*   `/delcmd` - Delete a custom command
*   `/listcmds` - View all server custom commands

### 🎭 Role Management
*   `/reactionrole` - Make a message that assigns roles when reacted to
*   `/buttonrole` - Make a message that assigns roles when buttons are clicked

### ℹ️ General Information
*   `/help` - View interactive command dashboard with category navigation
*   `/avatar` - Get the profile picture of a user
*   `/serverinfo` - Display statistics about the guild
*   `/userinfo` - Display detailed metrics about a user
*   `/ping` - Check Tachos Dev's websocket connection speed
*   `/uptime` - Show how long Tachos Dev has been active

---

## 🚀 How to Run

1.  Make sure you have **Node.js v24.11+** installed.
2.  Install dependencies:
    ```bash
    pnpm install
    ```
3.  Set your environment variables in `.env`:
    *   `DISCORD_TOKEN="YOUR_BOT_TOKEN"`
    *   `OPENROUTER_API_KEY="YOUR_KEY"`
4.  Start the bot:
    ```bash
    pnpm --filter "@workspace/discord-bot" start
    ```

**Enjoy the ultimate Discord experience! 💖✨**
