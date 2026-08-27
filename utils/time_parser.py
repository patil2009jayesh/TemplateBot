import re
from datetime import timedelta

def parse_duration(duration_str: str) -> int | None:
    """
    Parses duration string like '10s', '5m', '2h', '1d' into total seconds.
    Returns None if invalid format.
    """
    if not duration_str:
        return None
    match = re.match(r"^(\d+)([smhd])$", duration_str.strip().lower())
    if not match:
        return None
    amount, unit = int(match.group(1)), match.group(2)
    multipliers = {"s": 1, "m": 60, "h": 3600, "d": 86400}
    return amount * multipliers.get(unit, 1)

def format_duration(seconds: int) -> str:
    """
    Formats total seconds into human readable string.
    """
    td = timedelta(seconds=int(seconds))
    days = td.days
    hours, remainder = divmod(td.seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    parts = []
    if days > 0:
        parts.append(f"{days}d")
    if hours > 0:
        parts.append(f"{hours}h")
    if minutes > 0:
        parts.append(f"{minutes}m")
    if seconds > 0 or not parts:
        parts.append(f"{seconds}s")
    return " ".join(parts)
