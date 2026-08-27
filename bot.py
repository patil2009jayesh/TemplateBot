import os
import sys
from pathlib import Path

# Ensure root directory is always in sys.path
BASE_DIR = Path(__file__).parent.resolve()
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import asyncio
from main import main

if __name__ == "__main__":
    asyncio.run(main())
