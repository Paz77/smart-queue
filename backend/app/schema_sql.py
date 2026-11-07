"""Print the CREATE TABLE statements for the whole database (A4 submission, schema section).

From backend/:  python -m app.schema_sql
"""

from sqlalchemy.dialects import sqlite
from sqlalchemy.schema import CreateIndex, CreateTable
from sqlmodel import SQLModel

import app.models  # noqa: F401  Registers every table on SQLModel.metadata.


def schema_sql() -> str:
    """Every table, parents before the tables that point at them, each followed by its indexes."""
    dialect = sqlite.dialect()
    statements = []
    for table in SQLModel.metadata.sorted_tables:
        statements.append(f"{str(CreateTable(table).compile(dialect=dialect)).strip()};")
        for index in sorted(table.indexes, key=lambda index: index.name):
            statements.append(f"{str(CreateIndex(index).compile(dialect=dialect)).strip()};")
    return "\n\n".join(statements) + "\n"


if __name__ == "__main__":
    print(schema_sql(), end="")
