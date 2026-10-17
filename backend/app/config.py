"""App settings, read from environment variables.

DATABASE_URL    Defaults to an in-memory SQLite database, which resets on restart.
                For A4, point it at a file, e.g. sqlite:///queuesmart.db
"""

import os

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite://")
