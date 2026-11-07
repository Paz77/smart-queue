"""The schema script prints CREATE TABLE SQL that matches the table classes (A4 submission, schema section)."""

import sqlite3
import subprocess
import sys
from pathlib import Path

import pytest
from sqlmodel import SQLModel

from app.schema_sql import schema_sql

BACKEND = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def sql():
    return schema_sql()


def test_parents_come_before_the_tables_that_point_at_them(sql):
    starts = [sql.index(f"CREATE TABLE {name} (") for name in ("organization", "service", "queue", "queueentry")]
    assert starts == sorted(starts)


def test_keys_and_rules_are_in_the_sql(sql):
    assert "FOREIGN KEY(queue_id) REFERENCES queue (id)" in sql
    assert "CREATE UNIQUE INDEX ix_user_email ON" in sql  # unique=True, index=True is an index, not a column rule
    assert "CONSTRAINT queue_status_allowed CHECK (status IN ('open', 'closed'))" in sql


def test_the_sql_builds_a_database_with_every_table_and_rule(sql):
    """Proves the printed SQL matches the code: run it, then compare and try a bad row."""
    database = sqlite3.connect(":memory:")
    database.executescript(sql)
    tables = {name for (name,) in database.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    assert tables == set(SQLModel.metadata.tables)

    insert = "INSERT INTO queue (id, service_id, status, created_at) VALUES (?, ?, ?, '2026-11-06')"
    database.execute(insert, ("queue-1", "svc-1", "open"))
    with pytest.raises(sqlite3.IntegrityError, match="CHECK constraint failed: queue_status_allowed"):
        database.execute(insert, ("queue-2", "svc-2", "bogus"))
    database.close()


def test_running_the_module_prints_the_same_sql(sql):
    """The command the submission uses, run for real from backend/."""
    result = subprocess.run(
        [sys.executable, "-m", "app.schema_sql"], cwd=BACKEND, capture_output=True, text=True, check=True
    )
    assert result.stdout == sql
