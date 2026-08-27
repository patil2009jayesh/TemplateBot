import discord

def success_embed(description: str, title: str = None) -> discord.Embed:
    embed = discord.Embed(
        title=title if title else "✅ Success",
        description=description,
        color=discord.Color.green()
    )
    return embed

def error_embed(description: str, title: str = None) -> discord.Embed:
    embed = discord.Embed(
        title=title if title else "❌ Error",
        description=description,
        color=discord.Color.red()
    )
    return embed

def info_embed(description: str, title: str = None) -> discord.Embed:
    embed = discord.Embed(
        title=title,
        description=description,
        color=discord.Color.blurple()
    )
    return embed
