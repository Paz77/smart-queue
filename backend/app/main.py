"""The FastAPI app.

Run from backend/:  uvicorn app.main:app --reload --port 8000
API docs:           http://localhost:8000/docs
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlmodel import Session

from app.db import create_tables, engine
from app.errors import register_error_handlers
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

# Each module's router goes here, under /api. For example:
#     from app.routes import auth
#     app.include_router(auth.router, prefix="/api")
# Dev-only routers go inside `if IS_DEV:` (from app.config).
