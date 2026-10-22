"""Wait-time estimation.

estimate_wait is pure arithmetic, so most of these build a Service directly
rather than going through the database. The last few use the seeded services to
check the numbers the UI actually shows.
"""

import pytest
from sqlmodel import select

from app.logic.wait_time import estimate_wait
from app.models import QueueEntry, Service


def service(expected_duration: int) -> Service:
    """A throwaway service with the only field estimate_wait reads."""
    return Service(
        organization_id="org-northgate",
        name="Test Service",
        description="For tests.",
        expected_duration=expected_duration,
    )


@pytest.mark.parametrize(
    ("position", "duration", "expected"),
    [
        (1, 15, 15),  # front of the line still waits one slot
        (2, 15, 30),
        (3, 15, 45),
        (5, 20, 100),
        (1, 1, 1),
        (10, 8, 80),
    ],
)
def test_wait_is_position_times_duration(position, duration, expected):
    assert estimate_wait(position, service(duration)) == expected


@pytest.mark.parametrize("position", [0, -1, -10])
def test_called_or_invalid_positions_wait_zero(position):
    """Position 0 is someone who has been called, so there is nothing left to wait."""
    assert estimate_wait(position, service(15)) == 0


def test_wait_grows_by_one_slot_per_place():
    """Each extra place in line adds exactly one service duration."""
    svc = service(12)
    waits = [estimate_wait(position, svc) for position in range(1, 6)]
    assert waits == [12, 24, 36, 48, 60]
    assert all(later - earlier == 12 for earlier, later in zip(waits, waits[1:]))


def test_same_position_differs_by_service():
    """A slower service means a longer wait from the same place in line."""
    assert estimate_wait(3, service(25)) > estimate_wait(3, service(5))


def test_returns_a_whole_number_of_minutes():
    result = estimate_wait(3, service(15))
    assert isinstance(result, int)
    assert not isinstance(result, bool)


def test_quote_for_someone_about_to_join(session):
    """The wait quoted before joining counts the line plus the joiner's own turn."""
    advising = session.get(Service, "svc-advising")  # 15 min per person
    waiting = len(session.exec(select(QueueEntry).where(QueueEntry.service_id == "svc-advising")).all())

    assert estimate_wait(waiting + 1, advising) == (waiting + 1) * 15


@pytest.mark.parametrize(
    ("service_id", "position", "expected"),
    [
        ("svc-advising", 4, 60),  # 15 min per person
        ("svc-finaid", 2, 40),  # 20
        ("svc-it", 1, 10),  # 10
        ("svc-registrar", 3, 24),  # 8
        ("svc-pharmacy", 5, 25),  # 5
    ],
)
def test_matches_seeded_services(session, service_id, position, expected):
    """The seeded durations are the ones the frontend mocks use, so these are the
    numbers that have to appear on screen."""
    assert estimate_wait(position, session.get(Service, service_id)) == expected


def test_closed_service_still_estimates(session):
    """Whether a queue is open is a separate question from how long it would take;
    the callers decide whether to show the number."""
    career = session.get(Service, "svc-career")  # closed, 25 min
    assert career.is_open is False
    assert estimate_wait(2, career) == 50
