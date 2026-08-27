import os
import sys
from pathlib import Path

# Ensure root directory is always in sys.path
BASE_DIR = Path(__file__).parent.resolve()
for p in [str(BASE_DIR), str(Path.cwd()), "/home/container"]:
    if p not in sys.path:
        sys.path.insert(0, p)

from main import main

if __name__ == "__main__":
    main()
