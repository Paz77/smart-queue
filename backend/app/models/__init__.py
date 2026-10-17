"""Every table class, imported in one place.

Tables only get created for classes Python has imported, so a new model file
must be added here too. Elsewhere, import models from here:
    from app.models import Service, QueueEntry
"""

from app.models.auth_token import AuthToken
from app.models.notification import Notification
from app.models.organization import Organization
from app.models.queue_entry import QueueEntry
from app.models.service import Service
from app.models.user import User
from app.models.visit import Visit

__all__ = ["AuthToken", "Notification", "Organization", "QueueEntry", "Service", "User", "Visit"]
