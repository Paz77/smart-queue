"""The admin queue endpoints: view a line, serve next, move, set priority, remove."""

import pytest
from sqlmodel import select

from app.logic import services
from app.models import Notification, QueueEntry, Service, Visit

ADVISING_QUEUE = "/api/admin/services/svc-advising/queue"
SERVE_NEXT = "/api/admin/services/svc-advising/serve-next"
ENTRY = "/api/admin/queue-entries/{}"
ENTRY_KEYS = {"id", "userId", "userName", "priority", "position", "status", "joinedAt", "estimatedWait"}


def assert_error(response, status, code, field=None):
    assert response.status_code == status, response.text
    error = response.json()["error"]
    assert error["code"] == code
    assert error["message"].strip()
    if field is not None:
        assert error["fields"][field].strip()


def order(queue):
    """(name, position, status) for each entry in an AdminQueue response."""
    return [(e["userName"], e["position"], e["status"]) for e in queue["entries"]]


def titles_for(session, user_id):
    return [n.title for n in session.exec(select(Notification).where(Notification.user_id == user_id)).all()]


# --- access


ENDPOINTS = [
    ("GET", ADVISING_QUEUE, None),
    ("POST", SERVE_NEXT, None),
    ("PATCH", ENTRY.format("q-3"), {"position": 1}),
    ("DELETE", ENTRY.format("q-3"), None),
]
ENDPOINT_IDS = ["view", "serve-next", "update", "remove"]


@pytest.mark.parametrize("method,path,body", ENDPOINTS, ids=ENDPOINT_IDS)
def test_endpoints_need_a_login(client, method, path, body):
    assert_error(client.request(method, path, json=body), 401, "unauthorized")


@pytest.mark.parametrize("user_id", ["u-1", "a-2"], ids=["visitor", "other-organization-admin"])
@pytest.mark.parametrize("method,path,body", ENDPOINTS, ids=ENDPOINT_IDS)
def test_endpoints_need_this_organizations_admin(login_as, session, user_id, method, path, body):
    before = [(e.id, e.position) for e in session.exec(select(QueueEntry)).all()]
    assert_error(login_as(user_id).request(method, path, json=body), 403, "forbidden")
    session.expire_all()
    assert [(e.id, e.position) for e in session.exec(select(QueueEntry)).all()] == before


@pytest.mark.parametrize(
    "method,path,body",
    [
        ("GET", "/api/admin/services/svc-nope/queue", None),
        ("POST", "/api/admin/services/svc-nope/serve-next", None),
        ("PATCH", ENTRY.format("q-nope"), {"position": 1}),
        ("DELETE", ENTRY.format("q-nope"), None),
    ],
    ids=ENDPOINT_IDS,
)
def test_unknown_service_or_entry_is_not_found(admin_client, method, path, body):
    assert_error(admin_client.request(method, path, json=body), 404, "not_found")


# --- viewing


def test_view_shows_names_priority_and_wait(admin_client):
    response = admin_client.get(ADVISING_QUEUE)
    assert response.status_code == 200, response.text
    queue = response.json()
    assert queue["service"]["id"] == "svc-advising"
    assert queue["service"]["queueLength"] == 5
    assert queue["lastCalled"] is None
    assert all(set(e) == ENTRY_KEYS for e in queue["entries"])
    assert order(queue) == [
        ("Priya Shah", 1, "almost_ready"),
        ("Marcus Webb", 2, "almost_ready"),
        ("Elena Park", 3, "waiting"),
        ("Jordan Lee", 4, "waiting"),
        ("Sam Okafor", 5, "waiting"),
    ]
    assert [e["estimatedWait"] for e in queue["entries"]] == [15, 30, 45, 60, 75]


# --- serving


def test_serve_next_calls_the_front_of_the_line(admin_client, session):
    response = admin_client.post(SERVE_NEXT)
    assert response.status_code == 200, response.text
    queue = response.json()
    assert order(queue)[0] == ("Marcus Webb", 1, "almost_ready")
    assert len(queue["entries"]) == 4
    assert queue["lastCalled"]["userName"] == "Priya Shah"

    visit = session.exec(select(Visit).where(Visit.user_id == "u-2", Visit.outcome == "served")).one()
    assert visit.served_at is not None
    assert session.get(Service, "svc-advising").last_called_visit_id == visit.id
    assert "It is your turn" in titles_for(session, "u-2")
    assert "Almost your turn" in titles_for(session, "u-4")  # Elena moved from 3rd to 2nd


def test_last_called_shows_on_the_next_view(admin_client):
    admin_client.post(SERVE_NEXT)
    admin_client.post(SERVE_NEXT)
    assert admin_client.get(ADVISING_QUEUE).json()["lastCalled"]["userName"] == "Marcus Webb"


def test_serve_next_on_an_empty_line_is_a_conflict(admin_client):
    assert_error(admin_client.post("/api/admin/services/svc-registrar/serve-next"), 409, "queue_empty")


def test_serve_next_works_while_closed(admin_client):
    # Closing stops new joins, but the people already waiting still get served.
    admin_client.patch("/api/services/svc-advising", json={"isOpen": False})
    assert admin_client.post(SERVE_NEXT).status_code == 200


# --- moving and priority


def test_move_to_the_front(admin_client, session):
    response = admin_client.patch(ENTRY.format("q-5"), json={"position": 1})
    assert response.status_code == 200, response.text
    assert [name for name, _, _ in order(response.json())] == [
        "Sam Okafor", "Priya Shah", "Marcus Webb", "Elena Park", "Jordan Lee",
    ]
    assert "Almost your turn" in titles_for(session, "u-5")


def test_move_past_the_end_goes_to_the_back(admin_client):
    queue = admin_client.patch(ENTRY.format("q-1"), json={"position": 99}).json()
    assert order(queue)[-1] == ("Priya Shah", 5, "waiting")


def test_set_priority_moves_ahead_of_normal_people(admin_client):
    queue = admin_client.patch(ENTRY.format("q-4"), json={"priority": "priority"}).json()
    assert order(queue)[0] == ("Jordan Lee", 1, "almost_ready")
    assert queue["entries"][0]["priority"] == "priority"


def test_priority_and_position_together(admin_client):
    queue = admin_client.patch(ENTRY.format("q-4"), json={"priority": "priority", "position": 3}).json()
    jordan = next(e for e in queue["entries"] if e["userName"] == "Jordan Lee")
    assert (jordan["priority"], jordan["position"]) == ("priority", 3)


@pytest.mark.parametrize(
    "body,field",
    [
        ({"position": 0}, "position"),
        ({"position": -1}, "position"),
        ({"position": "2"}, "position"),
        ({"position": 1.5}, "position"),
        ({"priority": "urgent"}, "priority"),
        ({}, "body"),
        ({"position": None, "priority": None}, "body"),
    ],
    ids=["zero", "negative", "text", "decimal", "unknown-priority", "empty", "all-null"],
)
def test_update_rejects_bad_fields(admin_client, body, field):
    assert_error(admin_client.patch(ENTRY.format("q-3"), json=body), 422, "validation_error", field)
    assert order(admin_client.get(ADVISING_QUEUE).json())[2] == ("Elena Park", 3, "waiting")


def test_cant_move_someone_already_served(admin_client):
    admin_client.post(SERVE_NEXT)  # serves q-1
    assert_error(admin_client.patch(ENTRY.format("q-1"), json={"position": 2}), 409, "not_in_line")
    assert_error(admin_client.delete(ENTRY.format("q-1")), 409, "not_in_line")


# --- removing


def test_remove_closes_the_gap_and_records_the_visit(admin_client, session):
    response = admin_client.delete(ENTRY.format("q-3"))
    assert response.status_code == 200, response.text
    assert order(response.json()) == [
        ("Priya Shah", 1, "almost_ready"),
        ("Marcus Webb", 2, "almost_ready"),
        ("Jordan Lee", 3, "waiting"),
        ("Sam Okafor", 4, "waiting"),
    ]
    assert session.get(QueueEntry, "q-3") is None
    assert session.exec(select(Visit).where(Visit.user_id == "u-4", Visit.outcome == "removed")).one()
    assert "Removed from Academic Advising" in titles_for(session, "u-4")


# --- last_called


def test_last_called_ignores_a_visit_that_was_not_served(session):
    advising = session.get(Service, "svc-advising")
    advising.last_called_visit_id = "v-3"  # Jordan left this one
    assert services.last_called(session, advising) is None
    advising.last_called_visit_id = "v-gone"
    assert services.last_called(session, advising) is None
