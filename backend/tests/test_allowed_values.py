"""Status, role, priority, outcome and type columns only take the values on their lists.

The database enforces this itself (see app/models/checks.py), so a bad value is
refused even when it doesn't come through the API.
"""

from typing import Literal, get_args, get_origin

import pytest
from sqlalchemy.exc import IntegrityError

from app.models import Notification, Queue, QueueEntry, Service, User, Visit
from app.models.notification import NOTIFICATION_TYPES
from app.models.queue import QUEUE_STATUSES
from app.models.queue_entry import ENTRY_STATUSES, PRIORITIES, QueueJoin
from app.models.service import SERVICE_PRIORITIES, QueueEntryUpdate, ServiceCreate, ServiceUpdate
from app.models.user import ROLES
from app.models.visit import OUTCOMES

# Every column with a fixed list: (table, a seeded row, column, allowed values)
CASES = [
    (User, "a-1", "role", ROLES),
    (Queue, "queue-advising", "status", QUEUE_STATUSES),
    (QueueEntry, "q-1", "status", ENTRY_STATUSES),
    (QueueEntry, "q-1", "priority", PRIORITIES),
    (Service, "svc-advising", "priority", SERVICE_PRIORITIES),
    (Visit, "v-1", "outcome", OUTCOMES),
    (Notification, "n-1", "type", NOTIFICATION_TYPES),
]

# Two bad values per column: one made up, and an allowed one in capitals (case matters).
BAD_VALUES = [
    (model, row_id, column, bad)
    for model, row_id, column, allowed in CASES
    for bad in ("bogus", allowed[0].upper())
]


@pytest.mark.parametrize(
    ("model", "row_id", "column", "bad"),
    BAD_VALUES,
    ids=[f"{model.__table__.name}.{column}={bad}" for model, _, column, bad in BAD_VALUES],
)
def test_database_rejects_a_value_not_on_the_list(session, model, row_id, column, bad):
    row = session.get(model, row_id)
    setattr(row, column, bad)
    with pytest.raises(IntegrityError, match=f"CHECK constraint failed: {model.__table__.name}_{column}_allowed"):
        session.commit()


@pytest.mark.parametrize(
    ("model", "row_id", "column", "allowed"),
    CASES,
    ids=[f"{model.__table__.name}.{column}" for model, _, column, _ in CASES],
)
def test_database_accepts_every_value_on_the_list(session, model, row_id, column, allowed):
    row = session.get(model, row_id)
    for value in allowed:
        setattr(row, column, value)
        session.commit()
        session.refresh(row)  # reload from the database, so this checks what was saved
        assert getattr(row, column) == value


def accepted_by_request(model, field: str) -> set[str]:
    """The values a request body's Literal field accepts. An optional field's None doesn't count."""
    annotation = model.model_fields[field].annotation
    if get_origin(annotation) is not Literal:  # Literal[...] | None
        annotation = next(arg for arg in get_args(annotation) if get_origin(arg) is Literal)
    return set(get_args(annotation))


@pytest.mark.parametrize(
    ("model", "allowed"),
    [(QueueJoin, PRIORITIES), (QueueEntryUpdate, PRIORITIES), (ServiceCreate, SERVICE_PRIORITIES), (ServiceUpdate, SERVICE_PRIORITIES)],
    ids=["QueueJoin", "QueueEntryUpdate", "ServiceCreate", "ServiceUpdate"],
)
def test_api_accepts_the_same_priorities_as_the_database(model, allowed):
    """The request bodies keep their own copy of the list. This catches the two drifting apart."""
    assert accepted_by_request(model, "priority") == set(allowed)
