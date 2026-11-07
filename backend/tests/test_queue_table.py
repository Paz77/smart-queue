"""The Queue table: one per service, holding whether the line is open."""

from datetime import datetime

import pytest
from sqlalchemy.exc import IntegrityError
from sqlmodel import select

from app.logic import queue_engine
from app.models import Queue, QueueEntry, Service
from app.seed import SERVICES


@pytest.fixture
def service_without_queue(session):
    """A service saved straight to the database, skipping create_service, so it has no queue yet."""
    service = Service(organization_id="org-northgate", name="Housing", description="Room changes.", expected_duration=12)
    session.add(service)
    session.commit()
    return service


def queue_of(session, service_id):
    return session.exec(select(Queue).where(Queue.service_id == service_id)).one()


# --- the table itself


def test_new_queue_starts_closed_with_a_created_date(session, service_without_queue):
    queue = Queue(service_id=service_without_queue.id)
    session.add(queue)
    session.commit()

    saved = session.get(Queue, queue.id)
    assert saved.id.startswith("queue-")
    assert saved.service_id == service_without_queue.id
    assert saved.status == "closed"
    assert isinstance(saved.created_at, datetime)


def test_queue_for_missing_service_is_rejected(session):
    session.add(Queue(service_id="svc-does-not-exist"))
    with pytest.raises(IntegrityError, match="FOREIGN KEY"):
        session.commit()


def test_a_service_cannot_have_two_queues(session):
    session.add(Queue(service_id="svc-advising"))  # the seed already gave it one
    with pytest.raises(IntegrityError, match="UNIQUE"):
        session.commit()


# --- every service gets a queue


def test_every_seeded_service_has_a_queue_matching_open(session):
    assert len(session.exec(select(Queue)).all()) == len(SERVICES)
    for service_id, *_rest, is_open in SERVICES:
        queue = queue_of(session, service_id)
        assert queue.id == service_id.replace("svc-", "queue-")
        assert queue.status == ("open" if is_open else "closed")


def test_creating_a_service_creates_a_closed_queue(admin_client, session):
    body = {"name": "Housing", "description": "Room changes and move-in questions.", "expectedDuration": 12}
    response = admin_client.post("/api/organizations/org-northgate/services", json=body)
    assert response.status_code == 201, response.text

    queue = queue_of(session, response.json()["id"])
    assert queue.status == "closed"


# --- open/closed lives on the queue


def test_service_table_has_no_open_column():
    assert "is_open" not in Service.__table__.columns


@pytest.mark.parametrize(("service_id", "is_open", "status"), [("svc-advising", False, "closed"), ("svc-career", True, "open")])
def test_opening_or_closing_a_service_sets_its_queue_status(admin_client, session, service_id, is_open, status):
    response = admin_client.patch(f"/api/services/{service_id}", json={"isOpen": is_open})
    assert response.status_code == 200, response.text
    assert response.json()["isOpen"] is is_open

    session.expire_all()
    assert queue_of(session, service_id).status == status


# --- entries belong to a queue, and the database holds the links together


def test_entry_table_points_at_a_queue_not_a_service():
    columns = QueueEntry.__table__.columns
    assert "service_id" not in columns
    assert [key.target_fullname for key in columns["queue_id"].foreign_keys] == ["queue.id"]


def test_an_entry_is_found_through_its_queue(session):
    entry = session.get(QueueEntry, "q-6")  # in Financial Aid's line
    assert entry.queue_id == "queue-finaid"
    assert queue_engine.service_of(session, entry).id == "svc-finaid"


def test_entry_for_missing_queue_is_rejected(session):
    session.add(QueueEntry(queue_id="queue-does-not-exist", user_id="u-6", position=1))
    with pytest.raises(IntegrityError, match="FOREIGN KEY"):
        session.commit()


def test_a_queue_with_people_in_it_cannot_be_deleted(session):
    session.delete(session.get(Queue, "queue-advising"))  # five people are in this line
    with pytest.raises(IntegrityError, match="FOREIGN KEY"):
        session.commit()


def test_a_service_with_a_queue_cannot_be_deleted(session):
    # Physical Therapy Intake: nobody in line and no past visits, so only its queue points at it.
    session.delete(session.get(Service, "svc-pt"))
    with pytest.raises(IntegrityError, match="FOREIGN KEY"):
        session.commit()
