from app.models import Service


def estimate_wait(position: int, service: Service) -> int:
    """Estimated wait in minutes for someone at this position.

    Place in line times the service's minutes per person: the people ahead plus
    this person's own turn. Someone 3rd in line for a 15-minute service waits
    about 45 minutes.

    To quote a wait to somebody who has not joined yet, pass the position they
    would take, i.e. the length of the line plus one.

    Pure arithmetic, so it takes no session. A position of 0 or less means the
    person has been called and is no longer waiting, so the wait is 0.
    """
    if position <= 0:
        return 0
    return position * service.expected_duration
