import os
import sys
import shutil
import time
import subprocess
import signal
from pathlib import Path

BASE_DIR = Path(__file__).parent.resolve()

# Auto-fix Windows backslash filenames on Linux containers
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

def parse_env_file(path: Path) -> dict:
    env = {}
    if not path.exists():
        return env
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip()
    return env

def run_multi_bot():
    bot_configs = []
    
    # Check for .env.bot1, .env.bot2, .env.bot3
    for i in range(1, 10):
        env_f = BASE_DIR / f".env.bot{i}"
        if env_f.exists():
            cfg = parse_env_file(env_f)
            if cfg.get("DISCORD_TOKEN"):
                bot_configs.append((f"Bot-{i}", env_f, cfg))

    # If no .env.bot* found, fall back to single standard .env
    if not bot_configs:
        from main import main
        main()
        return

    print(f"🚀 [Multi-Bot Supervisor] Found {len(bot_configs)} bot profile(s) to run concurrently.")

    processes = {}

    def spawn_bot(name, env_file, cfg):
        child_env = os.environ.copy()
        child_env.update(cfg)
        child_env["RUNNING_SUB_BOT"] = "1"
        # Bot 1 uses bot.sqlite (preserving all existing settings)
        db_name = cfg.get("BOT_DB", f"bot{name[-1]}.sqlite" if name != "Bot-1" else "bot.sqlite")
        child_env["BOT_DB"] = db_name
        
        print(f"[{name}] Starting instance with database: {db_name} ...")
        proc = subprocess.Popen(
            [sys.executable, str(BASE_DIR / "main.py")],
            env=child_env,
            cwd=str(BASE_DIR),
            stdout=sys.stdout,
            stderr=sys.stderr
        )
        return proc

    for name, env_file, cfg in bot_configs:
        processes[name] = (spawn_bot(name, env_file, cfg), env_file, cfg)
        time.sleep(2)  # Stagger to avoid Discord gateway burst limits

    def handle_shutdown(sig, frame):
        print("\n🛑 [Multi-Bot Supervisor] Stopping all bot instances...")
        for name, (proc, _, _) in processes.items():
            try:
                proc.terminate()
            except Exception:
                pass
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)

    # Monitor and auto-restart loop
    while True:
        time.sleep(10)
        for name, (proc, env_file, cfg) in list(processes.items()):
            if proc.poll() is not None:
                print(f"⚠️ [{name}] Process exited (Code: {proc.returncode}). Restarting in 5s...")
                time.sleep(5)
                new_proc = spawn_bot(name, env_file, cfg)
                processes[name] = (new_proc, env_file, cfg)

if __name__ == "__main__":
    if os.getenv("RUNNING_SUB_BOT") == "1":
        from main import main
        main()
    else:
        run_multi_bot()
