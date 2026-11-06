"""App settings, read from environment variables.

DATABASE_URL    Defaults to backend/queuesmart.db, a SQLite file that keeps data between
                restarts. Set it to "sqlite://" for an in-memory database that resets.
QUEUESMART_ENV  "dev" (the default) or "prod". The /dev endpoints only exist in dev;
                any other value turns them off.
"""

import os
from pathlib import Path

# Anchored to backend/ so starting the server from another folder doesn't create a second, empty database.
DEFAULT_DATABASE_PATH = Path(__file__).resolve().parent.parent / "queuesmart.db"

DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{DEFAULT_DATABASE_PATH}")
QUEUESMART_ENV = os.environ.get("QUEUESMART_ENV", "dev")
IS_DEV = QUEUESMART_ENV == "dev"
