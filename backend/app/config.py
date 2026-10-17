"""App settings, read from environment variables.

QUEUESMART_ENV  "dev" (default) or "prod". Dev turns on the /api/dev endpoints.
DATABASE_URL    Defaults to an in-memory SQLite database, which resets on restart.
                For A4, point it at a file, e.g. sqlite:///queuesmart.db
"""

import os

ENV = os.environ.get("QUEUESMART_ENV", "dev")
IS_DEV = ENV == "dev"

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite://")
