import asyncio
import json
from datetime import datetime
import discord
from pathlib import Path
import aiohttp

BACKUP_DIR = Path(__file__).parent.parent / "backups"
BACKUP_DIR.mkdir(exist_ok=True)

async def delay_bulk():
    await asyncio.sleep(0.5)

def get_channel_type_int(channel: discord.abc.GuildChannel) -> int:
    if isinstance(channel, discord.TextChannel):
        return 0
    elif isinstance(channel, discord.VoiceChannel):
        return 2
    elif isinstance(channel, discord.CategoryChannel):
        return 4
    elif isinstance(channel, discord.StageChannel):
        return 13
    elif isinstance(channel, discord.ForumChannel):
        return 15
    return 0

def export_guild(guild: discord.Guild, app_id: int | str = None) -> dict:
    # 1. Export Roles
    roles = []
    for role in sorted(guild.roles, key=lambda r: r.position):
        roles.append({
            "id": str(role.id),
            "name": role.name,
            "color": role.color.value,
            "hoist": role.hoist,
            "position": role.position,
            "permissions": str(role.permissions.value),
            "managed": role.managed,
            "mentionable": role.mentionable,
            "icon_url": role.display_icon.url if hasattr(role, 'display_icon') and role.display_icon else None
        })

    # 2. Export Channels
    channels = []
    for ch in sorted(guild.channels, key=lambda c: c.position):
        overwrites = []
        for target, overwrite in ch.overwrites.items():
            target_type = 0 if isinstance(target, discord.Role) else 1
            allow, deny = overwrite.pair()
            overwrites.append({
                "id": str(target.id),
                "type": target_type,
                "allow": str(allow.value),
                "deny": str(deny.value)
            })

        channel_data = {
            "id": str(ch.id),
            "name": ch.name,
            "type": get_channel_type_int(ch),
            "position": ch.position,
            "parent_id": str(ch.category_id) if ch.category_id else None,
            "topic": getattr(ch, "topic", None),
            "nsfw": getattr(ch, "nsfw", False),
            "bitrate": getattr(ch, "bitrate", None),
            "user_limit": getattr(ch, "user_limit", None),
            "rate_limit_per_user": getattr(ch, "slowmode_delay", None),
            "permission_overwrites": overwrites
        }
        channels.append(channel_data)

    # 3. Export Emojis & Stickers
    emojis = [{
        "id": str(e.id),
        "name": e.name,
        "url": str(e.url),
        "animated": e.animated,
        "roles": [str(r.id) for r in e.roles]
    } for e in guild.emojis]

    stickers = [{
        "id": str(s.id),
        "name": s.name,
        "description": s.description,
        "tags": s.emoji,
        "format_type": s.format.value if hasattr(s.format, 'value') else 1
    } for s in guild.stickers]

    return {
        "schema_version": 2,
        "exported_at": datetime.utcnow().isoformat(),
        "exporter": {
            "name": "Tachos Dev Exporter Suite",
            "version": "2.0.0",
            "application_id": str(app_id or "")
        },
        "id": str(guild.id),
        "name": guild.name,
        "icon": guild.icon.key if guild.icon else None,
        "icon_url": guild.icon.url if guild.icon else None,
        "banner": guild.banner.key if guild.banner else None,
        "banner_url": guild.banner.url if guild.banner else None,
        "splash": guild.splash.key if guild.splash else None,
        "splash_url": guild.splash.url if guild.splash else None,
        "description": guild.description,
        "afk_channel_id": str(guild.afk_channel.id) if guild.afk_channel else None,
        "afk_timeout": guild.afk_timeout,
        "system_channel_id": str(guild.system_channel.id) if guild.system_channel else None,
        "rules_channel_id": str(guild.rules_channel.id) if guild.rules_channel else None,
        "public_updates_channel_id": str(guild.public_updates_channel.id) if guild.public_updates_channel else None,
        "verification_level": guild.verification_level.value,
        "default_message_notifications": guild.default_notifications.value,
        "explicit_content_filter": guild.explicit_content_filter.value,
        "roles": roles,
        "channels": channels,
        "emojis": emojis,
        "stickers": stickers
    }

async def save_backup(guild_id: str | int, backup_data: dict) -> str:
    gid = str(guild_id)
    guild_dir = BACKUP_DIR / gid
    guild_dir.mkdir(exist_ok=True)
    
    timestamp = datetime.utcnow().strftime("%Y-%m-%d_%H-%M-%S")
    file_path = guild_dir / f"{timestamp}.json"
    
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(backup_data, f, indent=2, ensure_ascii=False)
        
    return str(file_path)

def list_backups(guild_id: str | int) -> list[dict]:
    gid = str(guild_id)
    guild_dir = BACKUP_DIR / gid
    if not guild_dir.exists():
        return []
    
    backups = []
    for p in sorted(guild_dir.glob("*.json"), reverse=True):
        try:
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
                backups.append({
                    "filename": p.name,
                    "exported_at": data.get("exported_at", "Unknown"),
                    "name": data.get("name", "Unknown"),
                    "roles_count": len(data.get("roles", [])),
                    "channels_count": len(data.get("channels", []))
                })
        except Exception:
            pass
    return backups

def create_restore_plan(backup_data: dict, guild: discord.Guild, mode: str = "merge") -> dict:
    plan = {
        "mode": mode,
        "roles_to_create": 0,
        "roles_to_delete": 0,
        "channels_to_create": 0,
        "channels_to_delete": 0,
        "emojis_to_create": len(backup_data.get("emojis", [])),
        "stickers_to_create": len(backup_data.get("stickers", [])),
        "warnings": []
    }
    
    source_roles = [r for r in backup_data.get("roles", []) if not r.get("managed") and r.get("name") != "@everyone"]
    source_channels = backup_data.get("channels", [])

    if mode == "replace":
        plan["roles_to_delete"] = len([r for r in guild.roles if not r.managed and r != guild.default_role])
        plan["channels_to_delete"] = len(guild.channels)
        plan["roles_to_create"] = len(source_roles)
        plan["channels_to_create"] = len(source_channels)
    else:
        existing_role_names = {r.name.lower() for r in guild.roles}
        plan["roles_to_create"] = len([r for r in source_roles if r.get("name", "").lower() not in existing_role_names])
        existing_channel_names = {c.name.lower() for c in guild.channels}
        plan["channels_to_create"] = len([c for c in source_channels if c.get("name", "").lower() not in existing_channel_names])

    if "COMMUNITY" not in guild.features and (backup_data.get("rules_channel_id") or backup_data.get("public_updates_channel_id")):
        plan["warnings"].append("Target server is not Community-enabled. Community channels will be restored as normal channels.")

    return plan

async def restore_guild(backup_data: dict, guild: discord.Guild, mode: str = "merge") -> dict:
    role_map = {}
    channel_map = {}
    plan = create_restore_plan(backup_data, guild, mode)

    # 1. If replace mode: Delete existing channels and custom roles
    if mode == "replace":
        for ch in list(guild.channels):
            try:
                await ch.delete(reason="Tachos Dev Exporter replace restore")
                await delay_bulk()
            except Exception as e:
                plan["warnings"].append(f"Could not delete channel {ch.name}: {str(e)}")

        for role in list(guild.roles):
            if not role.managed and role != guild.default_role:
                try:
                    await role.delete(reason="Tachos Dev Exporter replace restore")
                    await delay_bulk()
                except Exception as e:
                    plan["warnings"].append(f"Could not delete role {role.name}: {str(e)}")

    # 2. Update @everyone permissions
    source_everyone = next((r for r in backup_data.get("roles", []) if r.get("name") == "@everyone" or r.get("id") == str(backup_data.get("id"))), None)
    if source_everyone and guild.default_role:
        try:
            perms = discord.Permissions(int(source_everyone.get("permissions", "0")))
            await guild.default_role.edit(permissions=perms, reason="Tachos Dev Exporter restore @everyone")
        except Exception as e:
            plan["warnings"].append(f"Could not update @everyone permissions: {str(e)}")

    # 3. Create Roles
    source_roles = [r for r in backup_data.get("roles", []) if not r.get("managed") and r.get("name") != "@everyone"]
    for src in sorted(source_roles, key=lambda r: r.get("position", 0)):
        existing = next((r for r in guild.roles if r.name.lower() == src.get("name", "").lower() and not r.managed), None)
        if mode == "merge" and existing:
            role_map[src["id"]] = existing
            continue

        try:
            perms = discord.Permissions(int(src.get("permissions", "0")))
            new_role = await guild.create_role(
                name=src.get("name", "Restored Role"),
                colour=discord.Colour(src.get("color", 0)),
                hoist=src.get("hoist", False),
                mentionable=src.get("mentionable", False),
                permissions=perms,
                reason="Tachos Dev Exporter restore"
            )
            role_map[src["id"]] = new_role
            await delay_bulk()
        except Exception as e:
            plan["warnings"].append(f"Could not create role {src.get('name')}: {str(e)}")

    # 4. Create Categories
    categories = [c for c in backup_data.get("channels", []) if c.get("type") == 4]
    for src in sorted(categories, key=lambda c: c.get("position", 0)):
        existing = next((c for c in guild.categories if c.name.lower() == src.get("name", "").lower()), None)
        if mode == "merge" and existing:
            channel_map[src["id"]] = existing
            continue

        try:
            cat = await guild.create_category(
                name=src.get("name", "Category"),
                position=src.get("position", 0),
                reason="Tachos Dev Exporter restore"
            )
            channel_map[src["id"]] = cat
            await delay_bulk()
        except Exception as e:
            plan["warnings"].append(f"Could not create category {src.get('name')}: {str(e)}")

    # 5. Create Text & Voice Channels
    non_categories = [c for c in backup_data.get("channels", []) if c.get("type") != 4]
    for src in sorted(non_categories, key=lambda c: c.get("position", 0)):
        existing = next((c for c in guild.channels if c.name.lower() == src.get("name", "").lower()), None)
        if mode == "merge" and existing:
            channel_map[src["id"]] = existing
            continue

        parent = channel_map.get(src.get("parent_id"))
        ch_type = src.get("type", 0)

        try:
            if ch_type == 2:  # Voice
                bitrate = src.get("bitrate") or 64000
                bitrate = max(8000, min(96000, bitrate))  # Clamp between 8k and 96k
                new_ch = await guild.create_voice_channel(
                    name=src.get("name", "voice"),
                    category=parent,
                    bitrate=bitrate,
                    user_limit=src.get("user_limit") or 0,
                    reason="Tachos Dev Exporter restore"
                )
            elif ch_type == 13: # Stage
                new_ch = await guild.create_stage_channel(
                    name=src.get("name", "stage"),
                    category=parent,
                    reason="Tachos Dev Exporter restore"
                )
            elif ch_type == 15: # Forum
                new_ch = await guild.create_forum_channel(
                    name=src.get("name", "forum"),
                    category=parent,
                    topic=src.get("topic"),
                    reason="Tachos Dev Exporter restore"
                )
            else:  # Text
                new_ch = await guild.create_text_channel(
                    name=src.get("name", "text"),
                    category=parent,
                    topic=src.get("topic"),
                    slowmode_delay=src.get("rate_limit_per_user") or 0,
                    nsfw=src.get("nsfw", False),
                    reason="Tachos Dev Exporter restore"
                )
            channel_map[src["id"]] = new_ch
            await delay_bulk()
        except Exception as e:
            plan["warnings"].append(f"Could not create channel {src.get('name')}: {str(e)}")

    # 6. Restore Channel Permission Overwrites
    for src in backup_data.get("channels", []):
        ch = channel_map.get(src["id"])
        if not ch:
            continue
        overwrites = {}
        for raw_ow in src.get("permission_overwrites", []):
            target = None
            if raw_ow.get("type") == 0:  # Role
                target = role_map.get(raw_ow.get("id"))
                if not target and raw_ow.get("id") == str(backup_data.get("id")):
                    target = guild.default_role
            elif raw_ow.get("type") == 1:  # Member
                target = guild.get_member(int(raw_ow.get("id", 0)))

            if target:
                allow = discord.Permissions(int(raw_ow.get("allow", "0")))
                deny = discord.Permissions(int(raw_ow.get("deny", "0")))
                overwrites[target] = discord.PermissionOverwrite.from_pair(allow, deny)

        if overwrites:
            try:
                await ch.edit(overwrites=overwrites, reason="Tachos Dev Exporter restore permissions")
                await delay_bulk()
            except Exception:
                pass

    return plan
