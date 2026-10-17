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
