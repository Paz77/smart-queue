"""Recording visits and reading back a person's history."""

from datetime import datetime, timedelta, timezone

import pytest
from sqlmodel import select

from app.logic.history import list_for_user, record_visit
from app.models import QueueEntry, Visit


def entry(session, service_id="svc-advising", user_id="u-1", position=1) -> QueueEntry:
    """A queue entry to record a visit from."""
    row = QueueEntry(
        service_id=service_id,
        user_id=user_id,
        position=position,
        joined_at=datetime.now(timezone.utc) - timedelta(minutes=30),
    )
    session.add(row)
    session.commit()
    return row


# --- record_visit -----------------------------------------------------------


def test_served_visit_keeps_the_time_it_was_called(session):
    served_at = datetime.now(timezone.utc)
    visit = record_visit(session, entry(session), "served", served_at)

    assert visit.outcome == "served"
    assert visit.served_at == served_at


@pytest.mark.parametrize("outcome", ["left", "removed", "no_show"])
def test_unfinished_visits_have_no_served_time(session, outcome):
    assert record_visit(session, entry(session), outcome).served_at is None


def test_served_at_is_ignored_unless_the_visit_was_served(session):
    """A caller passing a time with the wrong outcome should not produce a row
    that claims the person was seen."""
    visit = record_visit(session, entry(session), "left", datetime.now(timezone.utc))
    assert visit.served_at is None


def test_visit_copies_the_facts_off_the_entry(session):
    """The entry is deleted when someone leaves the line, so the visit has to
    carry its own copy of who, what and when."""
    row = entry(session, service_id="svc-finaid", user_id="u-2")
    visit = record_visit(session, row, "served", datetime.now(timezone.utc))

    assert visit.user_id == "u-2"
    assert visit.service_id == "svc-finaid"
    assert visit.joined_at == row.joined_at


def test_visit_survives_the_entry_being_deleted(session):
    row = entry(session)
    visit = record_visit(session, row, "left")
    session.commit()

    session.delete(row)
    session.commit()

    assert session.get(Visit, visit.id) is not None


def test_unknown_outcome_is_rejected(session):
    with pytest.raises(ValueError, match="Unknown outcome"):
        record_visit(session, entry(session), "finished")


def test_record_visit_does_not_commit(session):
    """Logic functions leave committing to the route, so one request is
    all-or-nothing."""
    before = len(session.exec(select(Visit)).all())
    record_visit(session, entry(session), "left")
    session.rollback()

    assert len(session.exec(select(Visit)).all()) == before


# --- list_for_user ----------------------------------------------------------


def test_history_is_scoped_to_one_person(session):
    for visit in list_for_user(session, "u-1", "org-northgate"):
        assert visit.user_id == "u-1"


def test_history_is_scoped_to_one_organization(session):
    """Visits point at a service, and the service decides the organization."""
    northgate = {v.id for v in list_for_user(session, "u-1", "org-northgate")}
    riverside = {v.id for v in list_for_user(session, "u-1", "org-riverside")}

    assert northgate and riverside
    assert northgate.isdisjoint(riverside)


def test_history_is_newest_first(session):
    joined = [visit.joined_at for visit in list_for_user(session, "u-1", "org-northgate")]
    assert joined == sorted(joined, reverse=True)


def test_history_is_empty_for_someone_with_no_visits(session):
    assert list_for_user(session, "u-5", "org-northgate") == []


def test_a_new_visit_shows_up_in_history(session):
    before = len(list_for_user(session, "u-1", "org-northgate"))
    record_visit(session, entry(session), "served", datetime.now(timezone.utc))
    session.commit()

    assert len(list_for_user(session, "u-1", "org-northgate")) == before + 1


# --- GET /api/me/history ----------------------------------------------------


def test_endpoint_returns_this_users_visits(user_client):
    response = user_client.get("/api/me/history", params={"organizationId": "org-northgate"})

    assert response.status_code == 200
    assert len(response.json()) > 0


def test_endpoint_uses_camel_case_and_includes_the_service_name(user_client):
    visit = user_client.get("/api/me/history", params={"organizationId": "org-northgate"}).json()[0]

    assert set(visit) == {"id", "serviceId", "serviceName", "joinedAt", "servedAt", "outcome"}
    assert visit["serviceName"]


def test_endpoint_does_not_leak_the_user_id(user_client):
    """The caller is the user, so repeating their id back is noise the client
    could accidentally trust."""
    visit = user_client.get("/api/me/history", params={"organizationId": "org-northgate"}).json()[0]
    assert "userId" not in visit


def test_endpoint_filters_by_organization(user_client):
    northgate = user_client.get("/api/me/history", params={"organizationId": "org-northgate"}).json()
    riverside = user_client.get("/api/me/history", params={"organizationId": "org-riverside"}).json()

    assert {v["id"] for v in northgate}.isdisjoint({v["id"] for v in riverside})


def test_endpoint_needs_the_organization(user_client):
    response = user_client.get("/api/me/history")

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_endpoint_needs_a_login(client):
    response = client.get("/api/me/history", params={"organizationId": "org-northgate"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


def test_two_people_see_different_histories(login_as):
    jordan = login_as("u-1").get("/api/me/history", params={"organizationId": "org-northgate"}).json()
    priya = login_as("u-2").get("/api/me/history", params={"organizationId": "org-northgate"}).json()

    assert {v["id"] for v in jordan}.isdisjoint({v["id"] for v in priya})
