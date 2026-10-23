"""Service management: listing, creating, editing, opening and closing."""

import pytest
from sqlmodel import select

from app.logic import services
from app.models import Notification, Service

NORTHGATE_SERVICES = "/api/organizations/org-northgate/services"
ADVISING = "/api/services/svc-advising"
SERVICE_KEYS = {
    "id", "organizationId", "name", "description", "expectedDuration",
    "priority", "isOpen", "queueLength", "estimatedWait",
}
NEW_SERVICE = {"name": "Housing", "description": "Room changes and move-in questions.", "expectedDuration": 12, "priority": "low"}


def assert_error(response, status, code, field=None):
    assert response.status_code == status, response.text
    error = response.json()["error"]
    assert error["code"] == code
    assert error["message"].strip()
    if field is not None:
        assert error["fields"][field].strip()


def service_count(session):
    return len(session.exec(select(Service)).all())


def notified(session, title):
    """User ids that received a notification with this title."""
    return sorted(n.user_id for n in session.exec(select(Notification).where(Notification.title == title)).all())


# --- listing


def test_list_needs_a_login(client):
    assert_error(client.get(NORTHGATE_SERVICES), 401, "unauthorized")


def test_list_shows_line_length_and_wait(user_client):
    response = user_client.get(NORTHGATE_SERVICES)
    assert response.status_code == 200, response.text
    listed = response.json()
    assert [s["name"] for s in listed] == [
        "Academic Advising", "Career Services", "Financial Aid", "IT Help Desk", "Registrar",
    ]
    assert all(set(s) == SERVICE_KEYS for s in listed)

    advising, registrar = listed[0], listed[4]
    assert (advising["queueLength"], advising["estimatedWait"]) == (5, 6 * 15)  # a new joiner would be 6th
    assert (registrar["queueLength"], registrar["estimatedWait"]) == (0, 8)


def test_list_only_shows_that_organization(admin_client):
    listed = admin_client.get("/api/organizations/org-riverside/services").json()
    assert {s["organizationId"] for s in listed} == {"org-riverside"}
    assert len(listed) == 5


def test_list_unknown_organization_is_not_found(user_client):
    assert_error(user_client.get("/api/organizations/org-nope/services"), 404, "not_found")


# --- creating


def test_create_starts_closed(admin_client, session):
    response = admin_client.post(NORTHGATE_SERVICES, json=NEW_SERVICE)
    assert response.status_code == 201, response.text
    created = response.json()
    assert set(created) == SERVICE_KEYS
    assert created["isOpen"] is False
    assert (created["queueLength"], created["estimatedWait"]) == (0, 12)
    assert created["organizationId"] == "org-northgate"

    row = session.get(Service, created["id"])
    assert (row.name, row.expected_duration, row.priority) == ("Housing", 12, "low")


def test_create_ignores_is_open_and_trims_text(admin_client):
    body = {**NEW_SERVICE, "name": "  Housing  ", "isOpen": True}
    created = admin_client.post(NORTHGATE_SERVICES, json=body).json()
    assert (created["name"], created["isOpen"]) == ("Housing", False)


def test_create_priority_defaults_to_medium(admin_client):
    body = {k: v for k, v in NEW_SERVICE.items() if k != "priority"}
    assert admin_client.post(NORTHGATE_SERVICES, json=body).json()["priority"] == "medium"


@pytest.mark.parametrize(
    "field,value",
    [
        ("name", ""),
        ("name", "   "),
        ("name", "x" * 101),
        ("name", 5),
        ("description", ""),
        ("description", "x" * 501),
        ("expectedDuration", "15"),
        ("expectedDuration", 15.5),
        ("expectedDuration", True),
        ("expectedDuration", 0),
        ("expectedDuration", 481),
        ("priority", "urgent"),
        ("priority", "HIGH"),
    ],
    ids=[
        "empty-name", "blank-name", "long-name", "number-name", "empty-description", "long-description",
        "text-duration", "decimal-duration", "boolean-duration", "zero-duration", "long-duration",
        "unknown-priority", "wrong-case-priority",
    ],
)
def test_create_rejects_bad_fields(admin_client, session, field, value):
    before = service_count(session)
    response = admin_client.post(NORTHGATE_SERVICES, json={**NEW_SERVICE, field: value})
    assert_error(response, 422, "validation_error", field)
    assert service_count(session) == before


@pytest.mark.parametrize("field", ["name", "description", "expectedDuration"])
def test_create_requires_fields(admin_client, field):
    body = {k: v for k, v in NEW_SERVICE.items() if k != field}
    assert_error(admin_client.post(NORTHGATE_SERVICES, json=body), 422, "validation_error", field)


def test_create_accepts_the_limits(admin_client):
    body = {"name": "x" * 100, "description": "x" * 500, "expectedDuration": 480}
    assert admin_client.post(NORTHGATE_SERVICES, json=body).status_code == 201
    body["expectedDuration"] = 1
    assert admin_client.post(NORTHGATE_SERVICES, json=body).status_code == 201


@pytest.mark.parametrize(
    "user_id,status,code",
    [(None, 401, "unauthorized"), ("u-1", 403, "forbidden"), ("a-2", 403, "forbidden")],
    ids=["logged-out", "visitor", "other-organization-admin"],
)
def test_create_needs_this_organizations_admin(client, login_as, session, user_id, status, code):
    caller = client if user_id is None else login_as(user_id)
    before = service_count(session)
    assert_error(caller.post(NORTHGATE_SERVICES, json=NEW_SERVICE), status, code)
    assert service_count(session) == before


# --- editing


def test_update_changes_only_what_was_sent(admin_client, session):
    response = admin_client.patch(ADVISING, json={"name": "Advising", "expectedDuration": 30, "description": None})
    assert response.status_code == 200, response.text
    updated = response.json()
    assert (updated["name"], updated["expectedDuration"], updated["estimatedWait"]) == ("Advising", 30, 6 * 30)
    assert updated["description"] == "Course planning, degree audits and registration holds."
    assert (updated["priority"], updated["isOpen"]) == ("high", True)


def test_update_with_an_empty_body_changes_nothing(admin_client):
    before = admin_client.get(NORTHGATE_SERVICES).json()[0]
    response = admin_client.patch(ADVISING, json={})
    assert response.status_code == 200, response.text
    assert response.json() == before


@pytest.mark.parametrize(
    "field,value",
    [("name", ""), ("description", "x" * 501), ("expectedDuration", "15"), ("priority", "urgent"), ("isOpen", "yes")],
)
def test_update_rejects_bad_fields(admin_client, session, field, value):
    assert_error(admin_client.patch(ADVISING, json={field: value}), 422, "validation_error", field)
    session.expire_all()
    service = session.get(Service, "svc-advising")
    assert (service.name, service.expected_duration, service.is_open) == ("Academic Advising", 15, True)


@pytest.mark.parametrize(
    "user_id,status,code",
    [(None, 401, "unauthorized"), ("u-1", 403, "forbidden"), ("a-2", 403, "forbidden")],
    ids=["logged-out", "visitor", "other-organization-admin"],
)
def test_update_needs_this_organizations_admin(client, login_as, session, user_id, status, code):
    caller = client if user_id is None else login_as(user_id)
    assert_error(caller.patch(ADVISING, json={"name": "Hacked"}), status, code)
    session.expire_all()
    assert session.get(Service, "svc-advising").name == "Academic Advising"


def test_update_unknown_service_is_not_found(admin_client):
    assert_error(admin_client.patch("/api/services/svc-nope", json={"name": "X"}), 404, "not_found")


# --- opening and closing


def test_closing_tells_everyone_in_line_and_stops_joins(admin_client, login_as, session):
    response = admin_client.patch(ADVISING, json={"isOpen": False})
    assert response.status_code == 200, response.text
    assert response.json()["isOpen"] is False
    assert response.json()["queueLength"] == 5  # people keep their place
    assert notified(session, "Academic Advising is closed") == ["u-1", "u-2", "u-3", "u-4", "u-5"]

    assert_error(login_as("u-6").post(ADVISING + "/queue"), 409, "service_closed")


def test_opening_tells_everyone_in_line_and_allows_joins(admin_client, login_as, session):
    response = admin_client.patch("/api/services/svc-career", json={"isOpen": True})
    assert response.json()["isOpen"] is True
    assert notified(session, "Career Services is open") == ["u-8", "u-9"]
    assert login_as("u-6").post("/api/services/svc-career/queue").status_code == 201


def test_setting_the_same_state_sends_nothing(admin_client, session):
    admin_client.patch(ADVISING, json={"isOpen": True})
    assert notified(session, "Academic Advising is open") == []


def test_set_open_on_an_empty_line_notifies_nobody(session):
    registrar = session.get(Service, "svc-registrar")
    before = len(session.exec(select(Notification)).all())
    services.set_open(session, registrar, False)
    assert registrar.is_open is False
    assert len(session.exec(select(Notification)).all()) == before
