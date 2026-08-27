import os
import sys
import shutil
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

from main import main

if __name__ == "__main__":
    main()
