"""App settings, read from environment variables.

DATABASE_URL    Defaults to an in-memory SQLite database, which resets on restart.
                For A4, point it at a file, e.g. sqlite:///queuesmart.db
QUEUESMART_ENV  "dev" (the default) or "prod". The /dev endpoints only exist in dev;
                any other value turns them off.
"""

import os

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite://")
QUEUESMART_ENV = os.environ.get("QUEUESMART_ENV", "dev")
IS_DEV = QUEUESMART_ENV == "dev"
