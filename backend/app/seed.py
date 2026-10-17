"""Sample data, ported 1:1 from frontend/src/mocks with the same ids.

Sample logins (every visitor uses password123, both admins use admin123):
    jordan@queuesmart.dev        visitor (the account the mocks are written around)
    alex.rivera@queuesmart.dev   admin of Northgate Student Services
    dana.brooks@queuesmart.dev   admin of Riverside Family Clinic
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from functools import cache

from sqlmodel import Session, select

from app.models import Notification, Organization, QueueEntry, Service, User, Visit


@cache
def hash_password(password: str) -> str:
    """scrypt hash stored as "scrypt$<salt hex>$<hash hex>".

    Cached, so each distinct sample password is hashed once per run instead of for every
    user in every test. Auth's verify_password must read this same format.
    """
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return f"scrypt${salt.hex()}${digest.hex()}"


def minutes_ago(minutes: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(minutes=minutes)


def local(timestamp: str) -> datetime:
    """A mock timestamp like "2026-09-23T14:05:00" (local time), converted to UTC."""
    return datetime.fromisoformat(timestamp).astimezone(timezone.utc)


ORGANIZATIONS = [
    ("org-northgate", "Northgate Student Services", "Student", "Students", "/backdrops/northgate.jpg"),
    ("org-riverside", "Riverside Family Clinic", "Patient", "Patients", "/backdrops/riverside.jpg"),
]

USERS = [
    ("u-1", "Jordan Lee", "jordan@queuesmart.dev", "password123", "user", None),
    ("u-2", "Priya Shah", "priya@queuesmart.dev", "password123", "user", None),
    ("u-3", "Marcus Webb", "marcus@queuesmart.dev", "password123", "user", None),
    ("u-4", "Elena Park", "elena@queuesmart.dev", "password123", "user", None),
    ("u-5", "Sam Okafor", "sam@queuesmart.dev", "password123", "user", None),
    ("u-6", "Aisha Rahman", "aisha@queuesmart.dev", "password123", "user", None),
    ("u-7", "Tom Becker", "tom@queuesmart.dev", "password123", "user", None),
    ("u-8", "Lucia Ferreira", "lucia@queuesmart.dev", "password123", "user", None),
    ("u-9", "Noah Kim", "noah@queuesmart.dev", "password123", "user", None),
    ("a-1", "Alex Rivera", "alex.rivera@queuesmart.dev", "admin123", "admin", "org-northgate"),
    ("a-2", "Dana Brooks", "dana.brooks@queuesmart.dev", "admin123", "admin", "org-riverside"),
]

# id, organization, name, description, expected duration (minutes), priority, open
SERVICES = [
    # Northgate Student Services
    ("svc-advising", "org-northgate", "Academic Advising", "Course planning, degree audits and registration holds.", 15, "high", True),
    ("svc-finaid", "org-northgate", "Financial Aid", "Aid packages, verification documents and disbursement questions.", 20, "high", True),
    ("svc-it", "org-northgate", "IT Help Desk", "Account access, password resets and device setup.", 10, "medium", True),
    ("svc-registrar", "org-northgate", "Registrar", "Transcripts, enrollment verification and records updates.", 8, "medium", True),
    ("svc-career", "org-northgate", "Career Services", "Resume reviews, mock interviews and internship guidance.", 25, "low", False),
    # Riverside Family Clinic
    ("svc-consult", "org-riverside", "General Consultation", "Same-day visits with a family physician for new or ongoing concerns.", 15, "high", True),
    ("svc-lab", "org-riverside", "Lab Work", "Blood draws and sample collection. Please bring your lab order.", 10, "medium", True),
    ("svc-vaccines", "org-riverside", "Vaccinations", "Flu shots, boosters and routine immunizations.", 8, "medium", True),
    ("svc-pharmacy", "org-riverside", "Prescription Pickup", "Collect prescriptions that are ready at the clinic pharmacy.", 5, "low", True),
    ("svc-pt", "org-riverside", "Physical Therapy Intake", "First assessment for new physical therapy patients.", 25, "low", False),
]

# id, service, user, position, joined (minutes ago), status. The mocks have no priority, so all are "normal".
QUEUE_ENTRIES = [
    # Northgate Student Services
    ("q-1", "svc-advising", "u-2", 1, 41, "almost_ready"),
    ("q-2", "svc-advising", "u-3", 2, 33, "almost_ready"),
    ("q-3", "svc-advising", "u-4", 3, 26, "waiting"),
    ("q-4", "svc-advising", "u-1", 4, 18, "waiting"),
    ("q-5", "svc-advising", "u-5", 5, 9, "waiting"),
    ("q-6", "svc-finaid", "u-4", 1, 22, "almost_ready"),
    ("q-7", "svc-finaid", "u-3", 2, 14, "almost_ready"),
    ("q-8", "svc-it", "u-5", 1, 6, "almost_ready"),
    # Career Services is closed; these two joined before it closed and keep their place.
    ("q-15", "svc-career", "u-8", 1, 22, "almost_ready"),
    ("q-16", "svc-career", "u-9", 2, 15, "almost_ready"),
    # Riverside Family Clinic
    ("q-9", "svc-consult", "u-6", 1, 28, "almost_ready"),
    ("q-10", "svc-consult", "u-7", 2, 21, "almost_ready"),
    ("q-11", "svc-consult", "u-1", 3, 12, "waiting"),
    ("q-12", "svc-consult", "u-8", 4, 7, "waiting"),
    ("q-13", "svc-lab", "u-9", 1, 5, "almost_ready"),
    ("q-14", "svc-vaccines", "u-2", 1, 3, "almost_ready"),
]

# id, user, service, joined, served (None if they left or didn't show), outcome
VISITS = [
    # Northgate Student Services
    ("v-1", "u-1", "svc-registrar", "2026-09-23T14:05:00", "2026-09-23T14:21:00", "served"),
    ("v-2", "u-1", "svc-it", "2026-09-22T09:40:00", "2026-09-22T09:52:00", "served"),
    ("v-3", "u-1", "svc-finaid", "2026-09-19T11:10:00", None, "left"),
    ("v-4", "u-1", "svc-advising", "2026-09-17T13:30:00", "2026-09-17T14:14:00", "served"),
    ("v-5", "u-1", "svc-career", "2026-09-15T15:00:00", None, "no_show"),
    ("v-6", "u-1", "svc-finaid", "2026-09-12T10:25:00", "2026-09-12T11:02:00", "served"),
    ("v-7", "u-1", "svc-registrar", "2026-09-08T08:50:00", "2026-09-08T09:01:00", "served"),
    ("v-8", "u-1", "svc-it", "2026-09-03T16:20:00", None, "left"),
    ("v-9", "u-1", "svc-advising", "2026-08-28T10:00:00", "2026-08-28T10:38:00", "served"),
    ("v-10", "u-1", "svc-career", "2026-08-21T13:15:00", "2026-08-21T14:02:00", "served"),
    # Riverside Family Clinic
    ("v-11", "u-1", "svc-pharmacy", "2026-09-21T16:10:00", "2026-09-21T16:16:00", "served"),
    ("v-12", "u-1", "svc-consult", "2026-09-10T09:05:00", "2026-09-10T09:48:00", "served"),
    ("v-13", "u-1", "svc-lab", "2026-08-30T08:15:00", None, "left"),
    ("v-14", "u-1", "svc-vaccines", "2026-08-19T12:40:00", "2026-08-19T12:52:00", "served"),
    ("v-15", "u-1", "svc-consult", "2026-08-05T14:30:00", None, "no_show"),
]


def _notifications() -> list[Notification]:
    # A function because most of these times are relative to now.
    rows = [
        # Northgate Student Services
        ("n-4", "org-northgate", "queue_update", "You moved up in line", "Academic Advising: you are now 4th in line.", minutes_ago(6), False),
        ("n-3", "org-northgate", "queue_update", "Career Services has closed", "This queue is not accepting new visitors for the rest of the day.", minutes_ago(12), False),
        ("n-2", "org-northgate", "queue_update", "Joined Academic Advising", "You are 5th in line. Estimated wait is 1 hr 15 min.", minutes_ago(18), True),
        ("n-1", "org-northgate", "status_change", "Registrar visit complete", "You were served on Sep 23 at 2:21 PM.", local("2026-09-23T14:21:00"), True),
        # Riverside Family Clinic
        ("n-8", "org-riverside", "queue_update", "You moved up in line", "General Consultation: you are now 3rd in line.", minutes_ago(4), False),
        ("n-7", "org-riverside", "queue_update", "Joined General Consultation", "You are 4th in line. Estimated wait is 1 hr.", minutes_ago(12), True),
        ("n-6", "org-riverside", "queue_update", "Physical Therapy Intake is closed", "New intake visits resume tomorrow morning.", minutes_ago(30), False),
        ("n-5", "org-riverside", "status_change", "Pharmacy visit complete", "You were served on Sep 21 at 4:16 PM.", local("2026-09-21T16:16:00"), True),
    ]
    return [
        Notification(id=id, user_id="u-1", organization_id=org, type=type, title=title, message=message, created_at=created_at, read=read)
        for id, org, type, title, message, created_at, read in rows
    ]


def seed(session: Session) -> None:
    """Load the sample data. Does nothing if the database already has data."""
    if session.exec(select(Organization)).first():
        return

    session.add_all(
        Organization(id=id, name=name, person_singular=singular, person_plural=plural, backdrop_url=backdrop)
        for id, name, singular, plural, backdrop in ORGANIZATIONS
    )
    session.add_all(
        User(id=id, name=name, email=email, password_hash=hash_password(password), role=role, organization_id=org)
        for id, name, email, password, role, org in USERS
    )
    session.add_all(
        Service(id=id, organization_id=org, name=name, description=description, expected_duration=duration, priority=priority, is_open=is_open)
        for id, org, name, description, duration, priority, is_open in SERVICES
    )
    session.add_all(
        QueueEntry(id=id, service_id=service, user_id=user, position=position, joined_at=minutes_ago(joined), status=status)
        for id, service, user, position, joined, status in QUEUE_ENTRIES
    )
    session.add_all(
        Visit(id=id, user_id=user, service_id=service, joined_at=local(joined), served_at=local(served) if served else None, outcome=outcome)
        for id, user, service, joined, served, outcome in VISITS
    )
    session.add_all(_notifications())
    session.commit()
