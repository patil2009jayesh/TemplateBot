"""
run_all.py — Launch all 3 bot instances simultaneously (LOCAL USE)
Each bot loads its own .env file and writes to its own database.

Usage:
    python run_all.py                  # Start all 3 bots
    python run_all.py --bot 1          # Start only bot 1
    python run_all.py --bot 2          # Start only bot 2
    python run_all.py --bot 3          # Start only bot 3
"""

import subprocess
import sys
import os
import signal
import time
import argparse
from pathlib import Path

BASE_DIR = Path(__file__).parent.resolve()

BOTS = [
    {
        "name": "Bot 1 — Axquen Manager",
        "env_file": ".env.bot1",
    },
    {
        "name": "Bot 2 — Instance 2",
        "env_file": ".env.bot2",
    },
    {
        "name": "Bot 3 — Instance 3",
        "env_file": ".env.bot3",
    },
]

def load_env(env_file: str) -> dict:
    """Parse a .env file into a dict."""
    env = {}
    path = BASE_DIR / env_file
    if not path.exists():
        print(f"[ERROR] {env_file} not found!")
        return env
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip()
    return env

def start_bot(bot_cfg: dict) -> subprocess.Popen:
    env = {**os.environ.copy(), **load_env(bot_cfg["env_file"])}
    print(f"[LAUNCH] Starting {bot_cfg['name']} (DB: {env.get('BOT_DB', 'bot.sqlite')})")
    proc = subprocess.Popen(
        [sys.executable, str(BASE_DIR / "main.py")],
        env=env,
        cwd=str(BASE_DIR),
        stdout=sys.stdout,
        stderr=sys.stderr,
    )
    return proc

def main():
    parser = argparse.ArgumentParser(description="Launch Tachos Dev bot instances")
    parser.add_argument("--bot", type=int, choices=[1, 2, 3], help="Launch only a specific bot number")
    args = parser.parse_args()

    if args.bot:
        bots_to_run = [BOTS[args.bot - 1]]
    else:
        bots_to_run = BOTS

    processes = []
    for bot_cfg in bots_to_run:
        proc = start_bot(bot_cfg)
        processes.append((bot_cfg["name"], proc))
        time.sleep(2)  # Stagger starts to avoid rate limiting

    print(f"\n[INFO] {len(processes)} bot(s) running. Press Ctrl+C to stop all.\n")

    def shutdown(sig, frame):
        print("\n[SHUTDOWN] Stopping all bots...")
        for name, proc in processes:
            print(f"  Terminating {name} (PID {proc.pid})")
            proc.terminate()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # Monitor — restart if a process dies
    while True:
        time.sleep(10)
        for i, (name, proc) in enumerate(processes):
            if proc.poll() is not None:
                print(f"[RESTART] {name} exited with code {proc.returncode}. Restarting in 5s...")
                time.sleep(5)
                bot_cfg = bots_to_run[i]
                new_proc = start_bot(bot_cfg)
                processes[i] = (name, new_proc)

if __name__ == "__main__":
    main()
