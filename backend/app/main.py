"""The FastAPI app.

Run from backend/:  python -m app.main
API docs:           http://localhost:8000/docs
"""

from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from sqlmodel import Session

from app.db import create_tables, engine
from app.errors import register_error_handlers
from app.routes import auth, history, notifications, organizations
from app.seed import seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Runs once when the server starts.
    create_tables()
    with Session(engine) as session:
        seed(session)
    yield


app = FastAPI(title="QueueSmart API", lifespan=lifespan)
register_error_handlers(app)
app.include_router(auth.router, prefix="/api")
app.include_router(organizations.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(history.router, prefix="/api")

# Each module's router goes here, under /api. For example:
#     from app.routes import auth
#     app.include_router(auth.router, prefix="/api")
#
# The dev router only goes in when IS_DEV is on (see config.py):
#     from app.config import IS_DEV
#     if IS_DEV:
#         app.include_router(dev.router, prefix="/api")


if __name__ == "__main__":
    # reload=True restarts the server whenever a file is saved.
    uvicorn.run("app.main:app", reload=True, port=8000)
