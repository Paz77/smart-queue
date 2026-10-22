"""The visitor queue endpoints, tested over HTTP."""

from datetime import datetime, timedelta

import pytest

from app.logic import queue_engine, wait_time
from app.models import QueueEntry, Service

ADVISING = "/api/services/svc-advising/queue"
MY_ENTRY = "/api/me/queue-entry"
SERVED = MY_ENTRY + "/served"
NORTHGATE = {"organizationId": "org-northgate"}
ENTRY_KEYS = {"id", "serviceId", "priority", "position", "status", "joinedAt", "servedAt", "estimatedWait"}


def assert_error(response, status, code, field=None):
    assert response.status_code == status, response.text
    error = response.json()["error"]
    assert error["code"] == code
    assert error["message"].strip()
    assert isinstance(error["fields"], dict)
    if field is not None:
        assert error["fields"][field].strip()


def snapshot(session, service_id="svc-advising"):
    # (id, position, status) for each waiting entry, as plain values
    return [(e.id, e.position, e.status) for e in queue_engine.line(session, service_id)]


def serve_front(session):
    """Serve q-1 (Priya, u-2) at Academic Advising and commit, the way an admin would."""
    queue_engine.serve_next(session, session.get(Service, "svc-advising"))
    session.commit()


@pytest.fixture
def fake_wait(monkeypatch):
    """A made-up wait, so a wrong position can't hide behind a 0-minute estimate."""
    monkeypatch.setattr(wait_time, "estimate_wait", lambda position, service: position * 100)


# --- login and lookups


@pytest.mark.parametrize(
    "method,path",
    [("GET", ADVISING), ("POST", ADVISING), ("GET", MY_ENTRY), ("DELETE", MY_ENTRY), ("DELETE", SERVED)],
    ids=["view-line", "join", "my-entry", "leave", "dismiss-served"],
)
def test_endpoints_need_a_login(client, method, path):
    # A valid organizationId (the service endpoints ignore it), so only the missing token is wrong
    assert_error(client.request(method, path, params=NORTHGATE), 401, "unauthorized")


@pytest.mark.parametrize(
    "method,path,params,message",
    [
        ("GET", "/api/services/svc-nope/queue", None, "Service not found."),
        ("POST", "/api/services/svc-nope/queue", None, "Service not found."),
        ("GET", MY_ENTRY, {"organizationId": "org-nope"}, "Organization not found."),
        ("DELETE", MY_ENTRY, {"organizationId": "org-nope"}, "Organization not found."),
        ("DELETE", SERVED, {"organizationId": "org-nope"}, "Organization not found."),
    ],
    ids=["view-line", "join", "my-entry", "leave", "dismiss-served"],
)
def test_unknown_service_or_organization_is_not_found(user_client, method, path, params, message):
    response = user_client.request(method, path, params=params)
    assert_error(response, 404, "not_found")
    assert response.json()["error"]["message"] == message  # not FastAPI's own 404 for a missing route


@pytest.mark.parametrize(
    "method,path",
    [("GET", MY_ENTRY), ("DELETE", MY_ENTRY), ("DELETE", SERVED)],
    ids=["my-entry", "leave", "dismiss-served"],
)
def test_organization_id_is_required(user_client, method, path):
    assert_error(user_client.request(method, path), 422, "validation_error", "organizationId")


# --- join: validation


@pytest.mark.parametrize(
    "priority",
    ["urgent", "Normal", 1, True, None, []],
    ids=["unknown-word", "wrong-case", "number", "boolean", "null", "list"],
)
def test_join_rejects_a_bad_priority(login_as, session, priority):
    # Aisha (u-6) isn't in a Northgate line, so only validation can turn her away
    before = snapshot(session)
    response = login_as("u-6").post(ADVISING, json={"priority": priority})
    assert_error(response, 422, "validation_error", "priority")
    assert snapshot(session) == before


@pytest.mark.parametrize("body", [[], "priority", 1], ids=["list", "string", "number"])
def test_join_body_must_be_an_object(login_as, session, body):
    before = snapshot(session)
    response = login_as("u-6").post(ADVISING, json=body)
    assert_error(response, 422, "validation_error", "body")
    assert set(response.json()["error"]["fields"]) == {"body"}
    assert snapshot(session) == before


def test_join_rejects_malformed_json(login_as, session):
    before = snapshot(session)
    # Without the header FastAPI wouldn't try to read the body as JSON at all
    response = login_as("u-6").post(ADVISING, content="{bad", headers={"Content-Type": "application/json"})
    assert_error(response, 422, "validation_error")
    assert list(response.json()["error"]["fields"].values()) == ["JSON decode error"]
    assert snapshot(session) == before


# --- join


@pytest.mark.parametrize(
    "request_body",
    [{}, {"json": {}}, {"content": "null", "headers": {"Content-Type": "application/json"}}],
    ids=["no-body", "empty-object", "null-body"],
)
def test_join_defaults_to_normal(login_as, session, fake_wait, request_body):
    # Aisha waits at Riverside, so this also shows a line in another organization doesn't block joining
    response = login_as("u-6").post(ADVISING, **request_body)
    assert response.status_code == 201, response.text
    entry = response.json()
    assert set(entry) == ENTRY_KEYS
    assert entry["serviceId"] == "svc-advising"
    assert (entry["priority"], entry["position"], entry["status"]) == ("normal", 6, "waiting")
    assert entry["estimatedWait"] == wait_time.estimate_wait(6, session.get(Service, "svc-advising"))
    assert entry["servedAt"] is None
    assert datetime.fromisoformat(entry["joinedAt"]).utcoffset() == timedelta(0)
    assert session.get(QueueEntry, entry["id"]).user_id == "u-6"


def test_priority_join_goes_to_the_front(login_as):
    aisha = login_as("u-6")
    response = aisha.post(ADVISING, json={"priority": "priority"})
    assert response.status_code == 201, response.text
    entry = response.json()
    assert (entry["priority"], entry["position"], entry["status"]) == ("priority", 1, "almost_ready")

    line = aisha.get(ADVISING).json()
    assert line["entries"][0] == {"id": entry["id"], "position": 1, "status": "almost_ready", "isMe": True}
    assert line["priorityJoinPosition"] == 2  # the next priority joiner goes behind her


def test_join_ignores_fields_a_visitor_cant_set(login_as, session):
    body = {"priority": "priority", "position": 5, "userId": "u-2", "status": "served"}
    response = login_as("u-6").post(ADVISING, json=body)
    assert response.status_code == 201, response.text
    entry = response.json()
    assert (entry["position"], entry["status"]) == (1, "almost_ready")
    assert session.get(QueueEntry, entry["id"]).user_id == "u-6"


@pytest.mark.parametrize(
    "user_id,service_id,status,code",
    [
        ("a-1", "svc-advising", 403, "forbidden"),
        ("u-6", "svc-career", 409, "service_closed"),
        ("u-1", "svc-it", 409, "already_in_line"),
    ],
    ids=["admin", "closed", "already-in-line"],
)
def test_join_conflicts_change_nothing(login_as, session, user_id, service_id, status, code):
    before = snapshot(session, service_id)
    assert_error(login_as(user_id).post(f"/api/services/{service_id}/queue"), status, code)
    assert snapshot(session, service_id) == before


# --- viewing a line


def test_line_shows_spots_but_no_names(user_client, session, fake_wait):
    advising = session.get(Service, "svc-advising")
    response = user_client.get(ADVISING)
    assert response.status_code == 200, response.text
    assert response.json() == {
        "serviceId": "svc-advising",
        "isOpen": True,
        "length": 5,
        "entries": [
            {"id": "q-1", "position": 1, "status": "almost_ready", "isMe": False},
            {"id": "q-2", "position": 2, "status": "almost_ready", "isMe": False},
            {"id": "q-3", "position": 3, "status": "waiting", "isMe": False},
            {"id": "q-4", "position": 4, "status": "waiting", "isMe": True},
            {"id": "q-5", "position": 5, "status": "waiting", "isMe": False},
        ],
        "joinPosition": 6,
        "joinWait": wait_time.estimate_wait(6, advising),
        "priorityJoinPosition": 1,
        "priorityJoinWait": wait_time.estimate_wait(1, advising),
    }


def test_a_closed_line_can_still_be_viewed(user_client):
    response = user_client.get("/api/services/svc-career/queue")
    assert response.status_code == 200, response.text
    line = response.json()
    assert (line["serviceId"], line["isOpen"], line["length"]) == ("svc-career", False, 2)


# --- my entry


def test_my_entry_is_null_when_not_in_a_line(login_as):
    response = login_as("u-6").get(MY_ENTRY, params=NORTHGATE)
    assert response.status_code == 200, response.text
    assert response.json() is None


@pytest.mark.parametrize(
    "organization_id,entry_id,service_id,position",
    [("org-northgate", "q-4", "svc-advising", 4), ("org-riverside", "q-11", "svc-consult", 3)],
    ids=["northgate", "riverside"],
)
def test_my_entry_is_the_one_in_that_organization(
    user_client, session, fake_wait, organization_id, entry_id, service_id, position
):
    response = user_client.get(MY_ENTRY, params={"organizationId": organization_id})
    assert response.status_code == 200, response.text
    entry = response.json()
    assert set(entry) == ENTRY_KEYS
    assert (entry["id"], entry["serviceId"], entry["position"], entry["status"]) == (
        entry_id,
        service_id,
        position,
        "waiting",
    )
    assert entry["estimatedWait"] == wait_time.estimate_wait(position, session.get(Service, service_id))


def test_my_entry_shows_a_served_entry(login_as, session, fake_wait):
    serve_front(session)
    priya = login_as("u-2")
    response = priya.get(MY_ENTRY, params=NORTHGATE)
    assert response.status_code == 200, response.text
    entry = response.json()
    assert (entry["id"], entry["status"], entry["position"]) == ("q-1", "served", 0)
    assert datetime.fromisoformat(entry["servedAt"]).utcoffset() == timedelta(0)
    assert entry["estimatedWait"] == wait_time.estimate_wait(0, session.get(Service, "svc-advising"))
    assert priya.get(ADVISING).json()["length"] == 4  # served people aren't in the line


# --- leave and dismiss
# The client shares the test's session. Test-side commits (login_as, serve_front) go before the requests,
# and session.rollback() comes right after them, so it drops anything the route didn't commit.


def test_join_is_committed(login_as, session):
    response = login_as("u-6").post(ADVISING)
    assert response.status_code == 201, response.text
    session.rollback()
    entry = session.get(QueueEntry, response.json()["id"])
    assert entry is not None
    assert (entry.user_id, entry.position) == ("u-6", 6)


def test_leave_is_committed_and_moves_the_line_up(user_client, session):
    response = user_client.delete(MY_ENTRY, params=NORTHGATE)
    assert response.status_code == 204, response.text
    assert response.content == b""
    session.rollback()
    assert session.get(QueueEntry, "q-4") is None
    assert snapshot(session) == [
        ("q-1", 1, "almost_ready"),
        ("q-2", 2, "almost_ready"),
        ("q-3", 3, "waiting"),
        ("q-5", 4, "waiting"),
    ]
    assert snapshot(session, "svc-consult") == [  # Jordan's Riverside spot is untouched
        ("q-9", 1, "almost_ready"),
        ("q-10", 2, "almost_ready"),
        ("q-11", 3, "waiting"),
        ("q-12", 4, "waiting"),
    ]
    assert user_client.get(MY_ENTRY, params=NORTHGATE).json() is None


def test_leave_when_not_in_a_line_is_rejected(login_as):
    assert_error(login_as("u-6").delete(MY_ENTRY, params=NORTHGATE), 404, "not_in_line")


def test_dismiss_is_committed_and_safe_to_repeat(login_as, session):
    serve_front(session)
    priya = login_as("u-2")
    for _ in range(2):
        response = priya.delete(SERVED, params=NORTHGATE)
        assert response.status_code == 204, response.text
    session.rollback()
    assert session.get(QueueEntry, "q-1") is None
    assert priya.get(MY_ENTRY, params=NORTHGATE).json() is None


def test_dismiss_leaves_a_waiting_entry_alone(user_client, session):
    response = user_client.delete(SERVED, params=NORTHGATE)
    assert response.status_code == 204, response.text
    assert ("q-4", 4, "waiting") in snapshot(session)
