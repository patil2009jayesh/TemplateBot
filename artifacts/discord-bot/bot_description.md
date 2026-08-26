# ⚡ Tachos Dev - The Ultimate Discord Server Management Bot

**Tachos Dev** is a high-performance, modular Discord bot designed to bring total control, security, and engagement to your community. Built with native SQLite and Discord.js v14, it delivers instant response times with zero external database dependencies.

---

## 🌟 Key Features

### 📦 Server Backup & Exporter Suite (`/backup`)
- **Complete Server Snapshots**: Export channels, categories, permissions, roles, emojis, stickers, and server settings to JSON.
- **Safe Dry-Run Previews**: Preview exactly what will change before applying any restore.
- **Merge & Replace Modes**: Add missing channels/roles safely or perform a full server recreation with administrator confirmation.

### 🛡️ Moderation & AutoMod
- **Full Action Suite**: `/ban`, `/kick`, `/timeout`, `/unban`, `/warn`, `/warnings`, `/clearwarnings`, `/clear`.
- **Intelligent AutoMod**: Configurable filters for anti-spam, invite link blocking, caps limiter, and mention flood protection.
- **Audit Tracking**: Persistent record of all moderator actions in SQLite.

### 🎁 Dynamic Giveaways
- **Multiple Modes**: Classic click-to-join, Message-XP weighted, and Invite weighted draws.
- **Persistent Timers**: Automatic background winner draws that survive bot restarts.

### 🎫 Professional Ticket System
- **Category Isolated**: Creates private channels inside designated staff categories.
- **Modal-Driven Workflow**: Pop-up forms for clean user submissions.
- **Claim & Resolve**: Staff can claim tickets, add notes, and close with transcript logs.

### ⭐ Leveling & Role Rewards
- **XP Progression**: Rewards active chatters with dynamic rank cards (`/rank`) and server leaderboards (`/leaderboard`).
- **Role Unlocks**: Automatically assigns custom roles when members reach target levels (`/levelreward`).

### 🔗 Invites & Self-Roles
- **Invite Tracking**: Real-time tracking of invites, leaves, and fake accounts (`/invites`, `/inviteleaderboard`).
- **Interactive Roles**: Sleek button-based (`/buttonrole`) and reaction-based (`/reactionrole`) self-assignment menus.

---

## 🚀 Technical Architecture
- **Node.js 24 + Native SQLite (`DatabaseSync`)**: In-memory speeds with persistent disk reliability and WAL concurrency.
- **Modular Design**: Enable or disable any feature per server with `/module`.
- **Zero Config Hassle**: Works out of the box with standard Discord Gateway intents.
