"""Queue engine rules, tested directly (no HTTP yet)

"""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.errors import ApiError
from app.logic import history, notifications, queue_engine, wait_time
from app.models import QueueEntry, Service, User, Visit
from app.models.queue_entry import QueueEntryPublic

ADVISING = "svc-advising"
ADVISING_SEED = [
    ("q-1", 1, "almost_ready"),
    ("q-2", 2, "almost_ready"),
    ("q-3", 3, "waiting"),
    ("q-4", 4, "waiting"),
    ("q-5", 5, "waiting"),
]
SEED_POSITIONS = {entry_id: position for entry_id, position, _ in ADVISING_SEED}


def snapshot(session, service_id=ADVISING):
    #(id, position, status) for each waiting entry
    # Plain values, because model objects change under you and compare equal once the session expires them
    return [(e.id, e.position, e.status) for e in queue_engine.line(session, service_id)]


def ids(session, service_id=ADVISING):
    return [e.id for e in queue_engine.line(session, service_id)]


def assert_dense(session, service_id=ADVISING):
    """Positions run 1..n; 1-2 are almost_ready and 3+ are waiting."""
    entries = queue_engine.line(session, service_id)
    assert [e.position for e in entries] == list(range(1, len(entries) + 1))
    assert [e.status for e in entries] == ["almost_ready" if e.position <= 2 else "waiting" for e in entries]


def assert_gone(session, entry_id):
    """session.get still hands back a deleted row until the delete is flushed."""
    session.flush()
    assert session.get(QueueEntry, entry_id) is None


def assert_api_error(caught, status, code, field=None):
    assert caught.value.status == status
    assert caught.value.code == code
    assert caught.value.message.strip()
    if field is not None:
        assert caught.value.fields[field].strip()


def new_visitor(session):
    #A visitor in no line, so tests don't depend on which seed users are free
    # Flushed, not committed, so calling it mid-test never commits the engine's work.
    
    user = User(name="Test Visitor", email=f"visitor-{uuid4().hex[:8]}@test.dev", password_hash="unused")
    session.add(user)
    session.flush()
    return user


@pytest.fixture(autouse=True)
def calls(monkeypatch):
    """Record what the engine hands Tina's functions instead of running them."""
    recorded = SimpleNamespace(notify=[], announce=[], visits=[], last_visit=None)

    def notify(session, user_id, organization_id, type, title, message):
        recorded.notify.append((user_id, organization_id, type, title, message))

    def announce_line_changes(session, service, before_positions):
        recorded.announce.append((service.id, dict(before_positions)))

    def record_visit(session, entry, outcome, served_at=None):
        assert entry not in session.deleted, "record_visit must run before the row is deleted"
        recorded.visits.append((entry.id, outcome, served_at))
        # Never added to the session, so it doesn't reach the database.
        recorded.last_visit = Visit(
            user_id=entry.user_id,
            service_id=entry.service_id,
            joined_at=entry.joined_at,
            served_at=served_at,
            outcome=outcome,
        )
        return recorded.last_visit

    monkeypatch.setattr(notifications, "notify", notify)
    monkeypatch.setattr(notifications, "announce_line_changes", announce_line_changes)
    monkeypatch.setattr(history, "record_visit", record_visit)
    return recorded


# --- LINE 


def test_line_is_in_position_order(session):
    assert snapshot(session) == ADVISING_SEED


def test_line_breaks_position_ties_by_join_time(session):
    tied = session.get(QueueEntry, "q-5")
    tied.position = 1
    tied.joined_at = datetime.now(timezone.utc) - timedelta(hours=1)  # earlier than q-1
    assert ids(session)[:2] == ["q-5", "q-1"]


# --- JOIN 


def test_normal_join_goes_to_the_back(session):
    entry = queue_engine.join(session, new_visitor(session), session.get(Service, ADVISING))
    assert (entry.position, entry.status, entry.priority) == (6, "waiting", "normal")
    assert ids(session) == ["q-1", "q-2", "q-3", "q-4", "q-5", entry.id]
    assert_dense(session)


def test_priority_join_goes_after_the_last_priority_person(session):
    advising = session.get(Service, ADVISING)
    first = queue_engine.join(session, new_visitor(session), advising, "priority")
    second = queue_engine.join(session, new_visitor(session), advising, "priority")
    assert ids(session) == [first.id, second.id, "q-1", "q-2", "q-3", "q-4", "q-5"]
    assert_dense(session)


def test_priority_join_after_a_manual_move(session):
    advising = session.get(Service, ADVISING)
    first = queue_engine.join(session, new_visitor(session), advising, "priority")
    queue_engine.move(session, first, 3)  # an admin moves the priority person back
    second = queue_engine.join(session, new_visitor(session), advising, "priority")
    assert ids(session) == ["q-1", "q-2", first.id, second.id, "q-3", "q-4", "q-5"]


@pytest.mark.parametrize(
    "position,status",
    [(1, "almost_ready"), (2, "almost_ready"), (3, "waiting")],
    ids=["first", "second", "third"],
)
def test_join_status_depends_on_position(session, position, status):
    registrar = session.get(Service, "svc-registrar")  # open and empty
    for _ in range(position):
        entry = queue_engine.join(session, new_visitor(session), registrar)
    assert (entry.position, entry.status) == (position, status)


@pytest.mark.parametrize(
    "user_id,service_id,priority,status,code,field",
    [
        ("a-1", ADVISING, "normal", 403, "forbidden", None),
        ("a-2", ADVISING, "normal", 403, "forbidden", None),
        ("u-6", ADVISING, "urgent", 422, "validation_error", "priority"),
        ("u-6", "svc-career", "normal", 409, "service_closed", None),
        ("u-1", "svc-it", "normal", 409, "already_in_line", None),
        ("a-1", "svc-career", "urgent", 403, "forbidden", None),
        ("u-6", "svc-career", "urgent", 422, "validation_error", "priority"),
        ("u-1", "svc-career", "normal", 409, "service_closed", None),
    ],
    ids=[
        "own-org-admin",
        "other-org-admin",
        "bad-priority",
        "closed",
        "already-in-line",
        "admin-checked-first",
        "priority-checked-before-closed",
        "closed-checked-before-already-in-line",
    ],
)
def test_join_rejections_change_nothing(session, calls, user_id, service_id, priority, status, code, field):
    before = snapshot(session, service_id)
    with pytest.raises(ApiError) as caught:
        queue_engine.join(session, session.get(User, user_id), session.get(Service, service_id), priority)
    assert_api_error(caught, status, code, field)
    assert not (session.new or session.dirty or session.deleted)  # checked before snapshot() flushes
    assert snapshot(session, service_id) == before
    assert calls.notify == calls.announce == calls.visits == []


def test_joining_in_another_organization_is_allowed(session):
    # u-6 waits at Riverside's General Consultation (q-9) and can still join a Northgate line.
    entry = queue_engine.join(session, session.get(User, "u-6"), session.get(Service, ADVISING))
    assert entry.position == 6


def test_join_announces_and_notifies(session, calls, monkeypatch):
    # A made-up wait, so a wrong position can't hide behind a 0-minute estimate.
    monkeypatch.setattr(wait_time, "estimate_wait", lambda position, service: position * 100)
    visitor = new_visitor(session)
    queue_engine.join(session, visitor, session.get(Service, ADVISING))
    assert calls.announce == [(ADVISING, SEED_POSITIONS)]
    assert calls.notify == [
        (
            visitor.id,
            "org-northgate",
            "queue_update",
            "Joined Academic Advising",
            "You are 6th in line. Estimated wait is 10 hr.",
        )
    ]



# --- SERVE 


def test_serve_next_serves_the_front_and_keeps_the_row(session, calls):
    advising = session.get(Service, ADVISING)
    started = datetime.now(timezone.utc)
    served = queue_engine.serve_next(session, advising)

    assert (served.id, served.status, served.position) == ("q-1", "served", 0)
    assert started <= served.served_at <= datetime.now(timezone.utc)
    assert calls.visits == [("q-1", "served", served.served_at)]
    assert advising.last_called_visit_id == calls.last_visit.id
    assert calls.announce == [(ADVISING, SEED_POSITIONS)]
    assert calls.notify == [
        (
            "u-2",
            "org-northgate",
            "status_change",
            "It is your turn",
            "Academic Advising is ready for you. Please go to the service desk.",
        )
    ]
    assert ids(session) == ["q-2", "q-3", "q-4", "q-5"]
    assert_dense(session)
    assert session.get(QueueEntry, "q-1").status == "served"  # the row is kept


def test_serve_next_on_an_empty_line_is_rejected(session, calls):
    with pytest.raises(ApiError) as caught:
        queue_engine.serve_next(session, session.get(Service, "svc-registrar"))
    assert_api_error(caught, 409, "queue_empty")
    assert calls.visits == []


def test_a_closed_line_can_still_be_served(session):
    served = queue_engine.serve_next(session, session.get(Service, "svc-career"))
    assert served.id == "q-15"
    assert ids(session, "svc-career") == ["q-16"]


def test_serving_mid_line_moves_the_rest_up(session):
    queue_engine.serve_entry(session, session.get(QueueEntry, "q-3"))
    assert ids(session) == ["q-1", "q-2", "q-4", "q-5"]
    assert_dense(session)


def test_served_at_comes_back_from_the_database_in_utc(session):
    served = queue_engine.serve_next(session, session.get(Service, ADVISING))
    stamped = served.served_at
    session.commit()  # the test's own commit, so the next read comes from SQLite
    assert served.served_at == stamped
    assert served.served_at.utcoffset() == timedelta(0)


def test_public_schema_is_camel_case_with_utc_times(session):
    entry = session.get(QueueEntry, "q-4")
    data = QueueEntryPublic.model_validate(entry, update={"estimated_wait": 7}).model_dump(mode="json", by_alias=True)
    assert set(data) == {"id", "serviceId", "priority", "position", "status", "joinedAt", "servedAt", "estimatedWait"}
    assert data["joinedAt"].endswith("Z")
    assert data["servedAt"] is None
    assert data["estimatedWait"] == 7


# --- SERVED ROWS ---------------------------


@pytest.mark.parametrize(
    "action",
    [
        lambda session, entry: queue_engine.move(session, entry, 1),
        lambda session, entry: queue_engine.remove(session, entry),
        lambda session, entry: queue_engine.set_priority(session, entry, "priority"),
        lambda session, entry: queue_engine.serve_entry(session, entry),
    ],
    ids=["move", "remove", "set-priority", "serve-entry"],
)
def test_served_entries_cannot_be_changed(session, action):
    served = queue_engine.serve_next(session, session.get(Service, ADVISING))
    before = snapshot(session)
    with pytest.raises(ApiError) as caught:
        action(session, served)
    assert_api_error(caught, 409, "not_in_line")
    assert (served.status, served.position) == ("served", 0)
    assert snapshot(session) == before


def test_dismiss_served_deletes_the_row_and_is_safe_to_repeat(session):
    priya = session.get(User, "u-2")
    queue_engine.serve_next(session, session.get(Service, ADVISING))  # serves q-1, Priya's entry
    queue_engine.dismiss_served(session, priya, "org-northgate")
    assert_gone(session, "q-1")
    queue_engine.dismiss_served(session, priya, "org-northgate")  # nothing left; no error
    assert queue_engine.my_entry(session, priya, "org-northgate") is None


def test_rejoining_clears_the_old_served_row(session):
    priya = session.get(User, "u-2")
    queue_engine.serve_next(session, session.get(Service, ADVISING))  # serves q-1, Priya's entry
    entry = queue_engine.join(session, priya, session.get(Service, "svc-it"))
    assert_gone(session, "q-1")
    assert queue_engine.my_entry(session, priya, "org-northgate").id == entry.id


# --- my_entry -----------------------------------------------------------------


def test_my_entry_prefers_the_active_entry(session):
    # Elena (u-4) waits in Academic Advising (q-3) and Financial Aid (q-6).
    queue_engine.serve_entry(session, session.get(QueueEntry, "q-3"))
    assert queue_engine.my_entry(session, session.get(User, "u-4"), "org-northgate").id == "q-6"


def test_my_entry_returns_the_served_entry_when_not_waiting(session):
    queue_engine.serve_next(session, session.get(Service, ADVISING))  # serves q-1, Priya's entry
    entry = queue_engine.my_entry(session, session.get(User, "u-2"), "org-northgate")
    assert (entry.id, entry.status) == ("q-1", "served")


def test_my_entry_is_none_when_not_in_a_line(session):
    assert queue_engine.my_entry(session, session.get(User, "u-6"), "org-northgate") is None


def test_my_entry_returns_the_newest_served_entry(session):
    first = queue_engine.serve_entry(session, session.get(QueueEntry, "q-3"))
    second = queue_engine.serve_entry(session, session.get(QueueEntry, "q-6"))
    # Served first but stamped later, so the order must come from served_at.
    first.served_at = datetime(2026, 10, 22, 9, 5, tzinfo=timezone.utc)
    second.served_at = datetime(2026, 10, 22, 9, 0, tzinfo=timezone.utc)
    assert queue_engine.my_entry(session, session.get(User, "u-4"), "org-northgate").id == "q-3"


# --- leave and remove ---------------------------------------------------------


def test_leave_deletes_the_entry_and_moves_the_line_up(session, calls):
    queue_engine.leave(session, session.get(User, "u-1"), "org-northgate")
    assert_gone(session, "q-4")
    assert ids(session) == ["q-1", "q-2", "q-3", "q-5"]
    assert_dense(session)
    assert ids(session, "svc-consult") == ["q-9", "q-10", "q-11", "q-12"]  # Jordan's Riverside spot is untouched
    assert calls.visits == [("q-4", "left", None)]
    assert calls.announce == [(ADVISING, SEED_POSITIONS)]
    assert calls.notify == [
        ("u-1", "org-northgate", "status_change", "Left Academic Advising", "You gave up your place in line.")
    ]


def test_leave_when_not_in_a_line_is_rejected(session, calls):
    with pytest.raises(ApiError) as caught:
        queue_engine.leave(session, session.get(User, "u-6"), "org-northgate")
    assert_api_error(caught, 404, "not_in_line")
    assert calls.visits == []


def test_remove_deletes_the_entry_and_moves_the_line_up(session, calls):
    queue_engine.remove(session, session.get(QueueEntry, "q-2"))
    assert_gone(session, "q-2")
    assert ids(session) == ["q-1", "q-3", "q-4", "q-5"]
    assert_dense(session)
    assert calls.visits == [("q-2", "removed", None)]
    assert calls.notify == [
        ("u-3", "org-northgate", "status_change", "Removed from Academic Advising", "Staff took you out of the line.")
    ]


# --- move ---------------------------------------------------------------------


@pytest.mark.parametrize(
    "entry_id,position,expected",
    [
        ("q-5", 1, ["q-5", "q-1", "q-2", "q-3", "q-4"]),
        ("q-1", 3, ["q-2", "q-3", "q-1", "q-4", "q-5"]),
        ("q-4", 0, ["q-4", "q-1", "q-2", "q-3", "q-5"]),
        ("q-2", 99, ["q-1", "q-3", "q-4", "q-5", "q-2"]),
    ],
    ids=["to-front", "back-two", "clamped-to-front", "clamped-to-back"],
)
def test_move(session, calls, entry_id, position, expected):
    queue_engine.move(session, session.get(QueueEntry, entry_id), position)
    assert ids(session) == expected
    assert_dense(session)
    assert calls.announce == [(ADVISING, SEED_POSITIONS)]


def test_move_to_the_same_spot_does_nothing(session, calls):
    queue_engine.move(session, session.get(QueueEntry, "q-3"), 3)
    queue_engine.move(session, session.get(QueueEntry, "q-5"), 99)  # clamps to 5, where it already is
    assert snapshot(session) == ADVISING_SEED
    assert calls.announce == []


# --- set_priority -------------------------------------------------------------


def test_promote_moves_up_behind_the_other_priority_people(session, calls):
    first = queue_engine.join(session, new_visitor(session), session.get(Service, ADVISING), "priority")
    before = {entry_id: position for entry_id, position, _ in snapshot(session)}
    calls.announce.clear()
    calls.notify.clear()

    queue_engine.set_priority(session, session.get(QueueEntry, "q-4"), "priority")
    assert ids(session) == [first.id, "q-4", "q-1", "q-2", "q-3", "q-5"]
    assert session.get(QueueEntry, "q-4").priority == "priority"
    assert_dense(session)
    assert calls.announce == [(ADVISING, before)]
    assert calls.notify == []


def test_demote_moves_back_to_the_front_of_the_normal_group(session):
    advising = session.get(Service, ADVISING)
    first = queue_engine.join(session, new_visitor(session), advising, "priority")
    second = queue_engine.join(session, new_visitor(session), advising, "priority")
    queue_engine.set_priority(session, first, "normal")
    assert ids(session) == [second.id, first.id, "q-1", "q-2", "q-3", "q-4", "q-5"]
    assert first.priority == "normal"
    assert_dense(session)


def test_promote_never_moves_back_and_demote_never_moves_forward(session):
    queue_engine.set_priority(session, session.get(QueueEntry, "q-4"), "priority")  # q-4 goes to the front
    queue_engine.move(session, session.get(QueueEntry, "q-4"), 5)  # then an admin sends it to the back
    assert ids(session) == ["q-1", "q-2", "q-3", "q-5", "q-4"]

    queue_engine.set_priority(session, session.get(QueueEntry, "q-1"), "priority")
    assert ids(session)[0] == "q-1"  # already ahead of the last priority person, so it stays 1st

    queue_engine.set_priority(session, session.get(QueueEntry, "q-4"), "normal")
    assert ids(session)[-1] == "q-4"  # already behind the priority group, so it stays last
    assert_dense(session)


def test_setting_the_same_priority_does_nothing(session, calls):
    queue_engine.set_priority(session, session.get(QueueEntry, "q-3"), "normal")
    assert snapshot(session) == ADVISING_SEED
    assert calls.announce == []


def test_set_priority_rejects_unknown_values(session, calls):
    with pytest.raises(ApiError) as caught:
        queue_engine.set_priority(session, session.get(QueueEntry, "q-3"), "urgent")
    assert_api_error(caught, 422, "validation_error", "priority")
    assert snapshot(session) == ADVISING_SEED
    assert calls.announce == []



# --- the engine never commits

ACTIONS = {
    "join": lambda session, visitor: queue_engine.join(session, visitor, session.get(Service, ADVISING)),
    "serve_next": lambda session, visitor: queue_engine.serve_next(session, session.get(Service, ADVISING)),
    "leave": lambda session, visitor: queue_engine.leave(session, session.get(User, "u-1"), "org-northgate"),
    "remove": lambda session, visitor: queue_engine.remove(session, session.get(QueueEntry, "q-3")),
    "move": lambda session, visitor: queue_engine.move(session, session.get(QueueEntry, "q-5"), 1),
    "set_priority": lambda session, visitor: queue_engine.set_priority(
        session, session.get(QueueEntry, "q-4"), "priority"
    ),
}


@pytest.mark.parametrize("action", list(ACTIONS), ids=list(ACTIONS))
def test_engine_never_commits(session, monkeypatch, action):
    visitor = new_visitor(session)
    session.commit()  # the test's own commit, before the guard goes on

    def no_commit():
        raise AssertionError("the queue engine must not commit; the route does")

    monkeypatch.setattr(session, "commit", no_commit)
    ACTIONS[action](session, visitor)
    assert snapshot(session) != ADVISING_SEED  # the change happened and is waiting to be saved
    session.rollback()
    assert snapshot(session) == ADVISING_SEED  # and none of it was saved


# --- FORMATTING

@pytest.mark.parametrize(
    "minutes,expected",
    [(0, "0 min"), (45, "45 min"), (60, "1 hr"), (75, "1 hr 15 min"), (125, "2 hr 5 min")],
    ids=["zero", "under-an-hour", "one-hour", "hour-and-minutes", "two-hours"],
)
def test_format_wait(minutes, expected):
    assert queue_engine.format_wait(minutes) == expected

#REMINDER TO DELERTE WITH _ordinal once Tina merges her branch
@pytest.mark.parametrize(
    "number,expected",
    [(1, "1st"), (2, "2nd"), (3, "3rd"), (4, "4th"), (11, "11th"), (12, "12th"), (13, "13th"), (21, "21st"), (102, "102nd")],
)
def test_ordinal(number, expected):
    assert queue_engine._ordinal(number) == expected
