"""Creating notifications, announcing line changes, and reading them back."""

import pytest
from sqlmodel import select

from app.logic.notifications import (
    announce_line_changes,
    list_for_user,
    mark_all_read,
    notify,
    ordinal,
    set_read,
    snapshot_positions,
)
from app.models import Notification, QueueEntry, Service


def existing_ids(session) -> set[str]:
    """Snapshot before acting. The seed already contains notifications with the
    same titles these tests look for, so assertions have to be limited to the
    ones the test itself caused."""
    return {n.id for n in session.exec(select(Notification)).all()}


def new_for(session, known: set[str], user_id="u-1") -> list[Notification]:
    statement = select(Notification).where(Notification.user_id == user_id)
    return [n for n in session.exec(statement).all() if n.id not in known]


def new_titles(session, known: set[str], user_id="u-1") -> list[str]:
    return [n.title for n in new_for(session, known, user_id)]


def set_positions(session, service_id, positions: dict[str, int]) -> None:
    """Rewrite a line so each entry id sits at the given position."""
    for entry_id, position in positions.items():
        entry = session.get(QueueEntry, entry_id)
        entry.position = position
        entry.status = "almost_ready" if position <= 2 else "waiting"
        session.add(entry)
    session.commit()


# --- ordinal ----------------------------------------------------------------


@pytest.mark.parametrize(
    ("number", "expected"),
    [(1, "1st"), (2, "2nd"), (3, "3rd"), (4, "4th"), (11, "11th"), (12, "12th"), (13, "13th"), (21, "21st"), (102, "102nd")],
)
def test_ordinal(number, expected):
    assert ordinal(number) == expected


# --- notify -----------------------------------------------------------------


def test_notify_creates_an_unread_notification(session):
    notify(session, "u-1", "org-northgate", "queue_update", "Joined", "You are 3rd in line.")
    session.commit()

    created = session.exec(select(Notification).where(Notification.title == "Joined")).one()
    assert created.read is False
    assert created.message == "You are 3rd in line."
    assert created.organization_id == "org-northgate"


def test_notify_does_not_commit(session):
    before = len(session.exec(select(Notification)).all())
    notify(session, "u-1", "org-northgate", "queue_update", "Dropped", "Should not persist.")
    session.rollback()

    assert len(session.exec(select(Notification)).all()) == before


# --- announce_line_changes --------------------------------------------------


def my_entry_id(session, service_id="svc-advising", user_id="u-1") -> str:
    return next(
        entry_id
        for entry_id in snapshot_positions(session, service_id)
        if session.get(QueueEntry, entry_id).user_id == user_id
    )


def test_moving_up_notifies_the_person(session):
    """Jordan (u-1) is 4th for Academic Advising in the seed data."""
    service = session.get(Service, "svc-advising")
    before = snapshot_positions(session, "svc-advising")
    known = existing_ids(session)

    set_positions(session, "svc-advising", {my_entry_id(session): 3})
    announce_line_changes(session, service, before)
    session.commit()

    assert new_titles(session, known) == ["You moved up in line"]


def test_reaching_the_front_two_says_almost_your_turn(session):
    service = session.get(Service, "svc-advising")
    before = snapshot_positions(session, "svc-advising")
    known = existing_ids(session)

    set_positions(session, "svc-advising", {my_entry_id(session): 2})
    announce_line_changes(session, service, before)
    session.commit()

    assert new_titles(session, known) == ["Almost your turn"]


def test_almost_your_turn_only_fires_on_the_way_in(session):
    """Someone already 2nd who moves to 1st has heard this already; they get the
    ordinary "moved up" instead of a second warning."""
    service = session.get(Service, "svc-advising")
    mine = my_entry_id(session)

    set_positions(session, "svc-advising", {mine: 2})
    before = snapshot_positions(session, "svc-advising")
    known = existing_ids(session)

    set_positions(session, "svc-advising", {mine: 1})
    announce_line_changes(session, service, before)
    session.commit()

    assert new_titles(session, known) == ["You moved up in line"]


def test_slipping_back_is_reported_without_claiming_progress(session):
    service = session.get(Service, "svc-advising")
    before = snapshot_positions(session, "svc-advising")
    known = existing_ids(session)

    set_positions(session, "svc-advising", {my_entry_id(session): 5})
    announce_line_changes(session, service, before)
    session.commit()

    assert new_titles(session, known) == ["Your place in line changed"]


def test_nobody_is_notified_when_nothing_moved(session):
    service = session.get(Service, "svc-advising")
    before = snapshot_positions(session, "svc-advising")
    count_before = len(session.exec(select(Notification)).all())

    announce_line_changes(session, service, before)
    session.commit()

    assert len(session.exec(select(Notification)).all()) == count_before


def test_new_arrivals_are_skipped(session):
    """A joiner is not in the snapshot; the engine sends their "joined"
    notification, so this must not send a second one."""
    service = session.get(Service, "svc-advising")
    before = snapshot_positions(session, "svc-advising")

    session.add(QueueEntry(id="q-new", service_id="svc-advising", user_id="u-5", position=99, status="waiting"))
    session.commit()

    count_before = len(session.exec(select(Notification)).all())
    announce_line_changes(session, service, before)
    session.commit()

    assert len(session.exec(select(Notification)).all()) == count_before


def test_the_message_names_the_service_and_the_new_place(session):
    service = session.get(Service, "svc-advising")
    before = snapshot_positions(session, "svc-advising")
    known = existing_ids(session)

    set_positions(session, "svc-advising", {my_entry_id(session): 3})
    announce_line_changes(session, service, before)
    session.commit()

    [created] = new_for(session, known)
    assert "Academic Advising" in created.message
    assert "3rd" in created.message


def test_served_entries_are_not_announced(session):
    """Someone already called is out of the line and gets their own
    "it's your turn" notification from the engine."""
    service = session.get(Service, "svc-advising")
    before = snapshot_positions(session, "svc-advising")
    known = existing_ids(session)

    entry = session.get(QueueEntry, my_entry_id(session))
    entry.status = "served"
    entry.position = 0
    session.add(entry)
    session.commit()

    announce_line_changes(session, service, before)
    session.commit()

    assert new_titles(session, known) == []


# --- reading and marking read -----------------------------------------------


def test_list_is_scoped_by_person_and_organization(session):
    for notification in list_for_user(session, "u-1", "org-northgate"):
        assert notification.user_id == "u-1"
        assert notification.organization_id == "org-northgate"


def test_list_is_newest_first(session):
    created = [n.created_at for n in list_for_user(session, "u-1", "org-northgate")]
    assert created == sorted(created, reverse=True)


def test_set_read_marks_one_notification(session):
    first = list_for_user(session, "u-1", "org-northgate")[0]
    assert set_read(session, "u-1", first.id, True).read is True
    assert set_read(session, "u-1", first.id, False).read is False


def test_set_read_refuses_someone_elses_notification(session):
    from app.errors import ApiError

    first = list_for_user(session, "u-1", "org-northgate")[0]
    with pytest.raises(ApiError) as caught:
        set_read(session, "u-2", first.id, True)

    assert caught.value.status == 404


def test_mark_all_read_only_touches_the_chosen_organization(session):
    riverside_unread = [n for n in list_for_user(session, "u-1", "org-riverside") if not n.read]
    assert riverside_unread  # the seed has some, otherwise this proves nothing

    mark_all_read(session, "u-1", "org-northgate")
    session.commit()

    assert all(n.read for n in list_for_user(session, "u-1", "org-northgate"))
    assert any(not n.read for n in list_for_user(session, "u-1", "org-riverside"))


# --- the endpoints ----------------------------------------------------------


def test_endpoint_lists_notifications(user_client):
    response = user_client.get("/api/me/notifications", params={"organizationId": "org-northgate"})

    assert response.status_code == 200
    assert len(response.json()) > 0


def test_endpoint_uses_camel_case_and_hides_the_owner(user_client):
    first = user_client.get("/api/me/notifications", params={"organizationId": "org-northgate"}).json()[0]

    assert set(first) == {"id", "type", "title", "message", "createdAt", "read"}


def test_endpoint_marks_one_read(user_client):
    unread = [
        n
        for n in user_client.get("/api/me/notifications", params={"organizationId": "org-northgate"}).json()
        if not n["read"]
    ][0]

    response = user_client.patch(f"/api/me/notifications/{unread['id']}", json={"read": True})

    assert response.status_code == 200
    assert response.json()["read"] is True


def test_marking_read_survives_a_reread(user_client):
    unread = [
        n
        for n in user_client.get("/api/me/notifications", params={"organizationId": "org-northgate"}).json()
        if not n["read"]
    ][0]
    user_client.patch(f"/api/me/notifications/{unread['id']}", json={"read": True})

    again = user_client.get("/api/me/notifications", params={"organizationId": "org-northgate"}).json()
    assert next(n for n in again if n["id"] == unread["id"])["read"] is True


def test_endpoint_rejects_a_non_boolean_read(user_client):
    first = user_client.get("/api/me/notifications", params={"organizationId": "org-northgate"}).json()[0]

    response = user_client.patch(f"/api/me/notifications/{first['id']}", json={"read": "yes"})

    assert response.status_code == 422
    assert "read" in response.json()["error"]["fields"]


def test_endpoint_404s_for_an_unknown_notification(user_client):
    response = user_client.patch("/api/me/notifications/n-nope", json={"read": True})

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_endpoint_marks_all_read(user_client):
    response = user_client.post("/api/me/notifications/read-all", params={"organizationId": "org-northgate"})

    assert response.status_code == 204
    after = user_client.get("/api/me/notifications", params={"organizationId": "org-northgate"}).json()
    assert all(n["read"] for n in after)


def test_endpoints_need_a_login(client):
    assert client.get("/api/me/notifications", params={"organizationId": "org-northgate"}).status_code == 401
    assert client.patch("/api/me/notifications/n-1", json={"read": True}).status_code == 401
    assert client.post("/api/me/notifications/read-all", params={"organizationId": "org-northgate"}).status_code == 401


def test_one_person_cannot_read_anothers_notification(login_as):
    jordan = login_as("u-1")
    priya = login_as("u-2")
    theirs = jordan.get("/api/me/notifications", params={"organizationId": "org-northgate"}).json()[0]

    assert priya.patch(f"/api/me/notifications/{theirs['id']}", json={"read": True}).status_code == 404
