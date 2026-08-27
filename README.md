# ⚡ Tachos Dev Discord Bot (Python Edition)

Welcome to the **Tachos Dev** Discord bot repository! Built using **Python 3.11+**, `discord.py` v2.4+, and asynchronous SQLite (`aiosqlite`).

---

## 🌟 Key Features & Commands (38 Total)

### 📦 Server Backup & Exporter (`/backup`)
* `/backup export` - Export full server configuration (channels, roles, permissions, emojis, stickers) into a downloadable JSON.
* `/backup inspect` - Display server structure metrics and health stats.
* `/backup restore` - Restore server using safe Merge mode or full Replace mode with dry-run previews.
* `/backup list` - View local server backup checkpoints.

### 🛡️ Moderation & AutoMod
* `/ban <user> [reason]` - Ban a member from the server.
* `/kick <user> [reason]` - Kick a member from the server.
* `/timeout <user> <duration> [reason]` - Temporarily mute/timeout a member.
* `/unban <user_id> [reason]` - Unban a user by ID.
* `/warn <user> <reason>` - Issue a formal recorded warning.
* `/warnings <user>` - View a member's warning history.
* `/clearwarnings <user>` - Clear all warnings for a member.
* `/clear <amount>` - Bulk delete messages from the channel.
* `/setautomod` - Configure anti-spam, anti-links, caps limit, and mention flood thresholds.

### 🎁 Dynamic Giveaways
* `/giveaway` - Host Button-based, XP-weighted, or Invite-weighted giveaways with automated winner selection.

### 🎫 Support Ticket System
* `/ticket setup-team` - Create ticket categories and staff handler roles.
* `/ticket panel` - Deploy interactive ticket panels with modal reason prompts and claim/close buttons.

### ⭐ Leveling & Role Rewards
* `/rank [user]` - View XP rank card and level progress.
* `/leaderboard` - View top server chatters.
* `/levelreward <level> [role]` - Automatically award roles when members reach target levels.
* `/setleveling` - Configure XP multipliers, rate limits, and announcement channels.

### 🔗 Invites & Role Assignment
* `/invites [user]` - Check real, total, left, and fake invites.
* `/inviteleaderboard` - View top server inviters.
* `/inviteinfo <code>` - Lookup metadata for an invite code.
* `/buttonrole` - Create interactive button-based role selectors.
* `/reactionrole` - Bind emoji reactions to role assignment.

### ⚙️ Server Configuration
* `/module` - Enable or disable individual bot modules per server.
* `/setchannel` - Set dedicated logging, mod logs, leveling, or welcome channels.
* `/setautorole` - Automatically assign a default role to new members.
* `/setwelcome` - Configure custom welcome cards and messages.
* `/setupvc` - Set up automated Temporary Voice Channels (Auto-VC).
* `/addcmd`, `/delcmd`, `/listcmds` - Manage custom server commands.

### 🛠️ General Utility
* `/help [category]` - Interactive command dashboard with category navigation.
* `/avatar [user]` - View high-resolution member avatar.
* `/userinfo [user]` - Display joined dates, badges, and roles.
* `/serverinfo` - Display comprehensive server metrics.
* `/poll <question> <options>` - Create multi-choice interactive polls.
* `/remind <duration> <message>` - Set timed reminders.
* `/afk [reason]` - Set AFK status with auto-replies and ping notifications.
* `/ping` - Check websocket API latency.
* `/uptime` - Display bot running duration.

---

## 🚀 Quick VPS Deployment (PM2 + Python)

```bash
# 1. Clone repo
git clone https://github.com/patil2009jayesh/TemplateBot.git /root/tachos-dev
cd /root/tachos-dev

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure credentials
cp .env.example .env
nano .env

# 4. Start 24/7 with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```
