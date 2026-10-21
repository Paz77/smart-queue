# smart-queue

## Running the frontend

Requires Node.js 20.19+ or 22.12+ (needed by Vite 8).

```sh
cd frontend
npm install
npm run dev
```

The app will be served at http://localhost:5173.

## Running the backend

Requires Python 3.11 or newer. Macs ship with Python 3.9, so check yours first:

```sh
python3 --version
```

### First-time setup

```sh
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

On Windows, activate with `.venv\Scripts\activate` instead.

### Start the server

From `backend/`, with the virtual environment active (`source .venv/bin/activate` in each new terminal):

```sh
python -m app.main
```

- Interactive API docs: http://localhost:8000/docs
- The server restarts automatically when you save a file.
- Data lives in memory: it's seeded from `app/seed.py` on startup and resets every time the server restarts.

### Sample accounts

| Email | Password | Role |
|---|---|---|
| jordan@queuesmart.dev | password123 | visitor |
| alex.rivera@queuesmart.dev | admin123 | admin, Northgate Student Services |
| dana.brooks@queuesmart.dev | admin123 | admin, Riverside Family Clinic |

All other visitors in `app/seed.py` also use `password123`.

### Run the tests

From `backend/`:

```sh
python -m pytest
```

With a coverage report:

```sh
python -m pytest --cov=app --cov-report=term-missing
```

### Settings

Optional. Set as an environment variable before starting the server.

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | `sqlite://` | In-memory database. A file like `sqlite:///queuesmart.db` keeps data between restarts |
| `QUEUESMART_ENV` | `dev` | `dev` turns on the `/dev` endpoints used by the Dev Tools panel. Any other value, like `prod`, turns them off |

## Backend code (SQLModel primer)

### Where code goes

| Folder | What goes in it |
|---|---|
| `app/models/` | One file per table: the table class plus its request and response schemas |
| `app/routes/` | Endpoints only: read the request, call logic functions, commit, return the response |
| `app/logic/` | The actual work. Routes never query the database directly |

A new model file must also be imported in `app/models/__init__.py`. Tables only get created for classes Python has imported.

### Table classes and schemas

```python
from pydantic import ConfigDict
from pydantic.alias_generators import to_camel
from sqlmodel import Field, SQLModel


class Service(SQLModel, table=True):  # a table: no validation, no aliases
    id: str = Field(primary_key=True)
    expected_duration: int


class ServiceCreate(SQLModel):  # a request body
    model_config = ConfigDict(alias_generator=to_camel, validate_by_name=True, strict=True)

    expected_duration: int = Field(ge=1, le=480)


class ServicePublic(SQLModel):  # what the API returns
    model_config = ConfigDict(alias_generator=to_camel, validate_by_name=True)

    id: str
    expected_duration: int
```

- **Validation goes on schemas, not tables.** SQLModel skips validation on `table=True` classes.
- **`alias_generator=to_camel`** makes the JSON use `expectedDuration` while Python uses `expected_duration`, for both requests and responses. Validation errors also name the field `expectedDuration`. Don't put aliases on table classes.
- **`strict=True`** on request schemas rejects the wrong type instead of converting it, so `"15"` is not accepted as a number.
- **Response schemas leave out private columns.** `UserPublic` has no `password_hash`.
- Turn a table row into a response with `ServicePublic.model_validate(service)`.

### Using the database

```python
# app/logic/services.py
def set_open(session: Session, service: Service, is_open: bool) -> Service:
    service.is_open = is_open
    session.add(service)
    return service


# app/routes/services.py
@router.patch("/services/{service_id}", response_model=ServicePublic)
def update(
    service_id: str,
    body: ServiceUpdate,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    service = session.get(Service, service_id)
    if service is None:
        raise ApiError(404, "not_found", "Service not found.")
    require_admin(service.organization_id, user)
    services.set_open(session, service, body.is_open)
    session.commit()
    return ServicePublic.model_validate(service)
```

- **Logic functions take `session` first and never commit.** The route commits once at the end, so a request saves everything or nothing.
- Save: `session.add(obj)`
- Fetch by id: `session.get(Service, service_id)`
- Query: `session.exec(select(Service).where(Service.organization_id == org_id)).all()`
- Delete: `session.delete(obj)`

### Errors and permissions

- Raise `ApiError(status, code, message, fields)` from `app/errors.py` for any error. It becomes `{"error": {"code", "message", "fields"}}`.
- `Depends(current_user)` gives the logged-in user, or a 401.
- `Depends(require_admin)` works when the path has `{organization_id}`. Otherwise call `require_admin(service.organization_id, user)` once you've looked up the row.

### Tests

Every test gets a fresh, seeded in-memory database. The fixtures in `tests/conftest.py`:

| Fixture | What it is |
|---|---|
| `session` | The test's database session, for setting up or checking rows |
| `client` | A logged-out client |
| `user_client` | Logged in as Jordan Lee (`u-1`), a visitor |
| `admin_client` | Logged in as Alex Rivera (`a-1`), admin of Northgate |
| `login_as("u-2")` | A client logged in as any seeded user |

The test and the client share one session, so a route that forgets to commit still looks fine in a test. To check that a route commits, call `session.rollback()` after the request, then look the row up again.
