"""The Queue table: one per service, holding whether the line is open."""

from datetime import datetime

import pytest
from sqlalchemy.exc import IntegrityError

from app.models import Queue


def test_new_queue_starts_closed_with_a_created_date(session):
    queue = Queue(service_id="svc-advising")
    session.add(queue)
    session.commit()

    saved = session.get(Queue, queue.id)
    assert saved.id.startswith("queue-")
    assert saved.service_id == "svc-advising"
    assert saved.status == "closed"
    assert isinstance(saved.created_at, datetime)


def test_queue_for_missing_service_is_rejected(session):
    session.add(Queue(service_id="svc-does-not-exist"))
    with pytest.raises(IntegrityError, match="FOREIGN KEY"):
        session.commit()


def test_a_service_cannot_have_two_queues(session):
    session.add(Queue(service_id="svc-advising"))
    session.commit()

    session.add(Queue(service_id="svc-advising"))
    with pytest.raises(IntegrityError, match="UNIQUE"):
        session.commit()
