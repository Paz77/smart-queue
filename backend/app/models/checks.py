"""Database rules that limit a text column to a fixed list of values."""

from sqlalchemy import CheckConstraint


def one_of(table: str, column: str, values: tuple[str, ...]) -> CheckConstraint:
    """CHECK (column IN (...)), so the database itself rejects any other value.

    Named <table>_<column>_allowed, so the error says which rule failed.
    """
    listed = ", ".join(f"'{value}'" for value in values)
    return CheckConstraint(f"{column} IN ({listed})", name=f"{table}_{column}_allowed")
