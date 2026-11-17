# Event Registration App

A full-stack event registration demo built from a high-fidelity Figma prototype. The frontend is React + Tailwind CSS; the backend is plain PHP with a SQLite database.

The app covers the complete flow: browse upcoming events, register attendees, view a ticket, update or cancel a registration, manage a profile, and administer events as an administrator. It also includes an optional AI event assistant and AI-ranked recommendations, both with rule-based fallbacks that work without an API key.

## Tech stack

| Layer    | Technology                                                       |
| -------- | ---------------------------------------------------------------- |
| Frontend | React 18, React Router 6, Tailwind CSS 3, Vite 5                 |
| Backend  | PHP 8 (no framework), PDO SQLite                                 |
| Auth     | Opaque bearer tokens, SHA-256 token hashes, `password_hash()`    |
| Database | SQLite (`backend/storage/app.sqlite`), WAL mode, auto-migrated   |
| AI       | Optional OpenAI-compatible chat completions + local rule engine  |

## Project layout

```
event-registration-app/
├─ backend/
│  ├─ public/index.php        # HTTP entry point and all API routes
│  ├─ src/Database.php        # connection, schema, demo seed data
│  ├─ src/Auth.php            # bearer tokens, require_user/require_admin
│  ├─ src/Http.php            # JSON helpers, CORS, validation utilities
│  ├─ src/Env.php             # tiny .env loader (no Composer)
│  ├─ src/Ai.php              # AI provider client, rules fallback, cache, quota
│  ├─ .env.example            # AI provider configuration template
│  ├─ storage/                # SQLite database (created on first request)
│  ├─ run.ps1                 # starts PHP with SQLite extensions enabled
│  └─ run.bat
└─ frontend/
   ├─ src/pages/              # login, dashboard, registration, my events, …
   ├─ src/components/         # header, layout, cards, forms, modals, AI widgets
   ├─ src/context/            # auth and toast providers
   ├─ src/lib/                # API client, formatting, saved events/avatar
   ├─ vite.config.js          # dev + preview proxy for /api
   └─ tailwind.config.js
```

## Requirements

- Node.js 18+ and npm
- PHP 8.1+ with the `pdo_sqlite` and `sqlite3` extensions available (tested on PHP 8.5)

On this machine the SQLite DLLs exist but are disabled in `php.ini`. The bundled run scripts enable them for that PHP process only, without changing global configuration.

## Run locally

Start the API and the frontend in two terminals.

**1. Backend**

```powershell
cd backend
.\run.bat
```

or:

```powershell
powershell -ExecutionPolicy Bypass -File .\run.ps1
```

The API runs at <http://127.0.0.1:8000/api>. On the first request it creates and seeds `backend/storage/app.sqlite`.

To use a different port, set `PORT` before starting, for example `$env:PORT = 9000`.

**2. Frontend**

```powershell
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api` to `http://127.0.0.1:8000`.

**Production build**

```powershell
cd frontend
npm run build
npm run preview
```

The preview server runs at <http://localhost:4173> and also proxies `/api`. When deploying elsewhere, serve `frontend/dist` and forward `/api` to the PHP API (or set `VITE_API_URL` to an absolute API URL at build time).

## AI features (optional)

The app ships with two AI features:

- **Event assistant** — a floating “Ask AI” chat panel that answers questions about upcoming events, venues, schedules, and the signed-in user’s registrations.
- **Recommended for you** — a dashboard section that suggests up to three events the user has not registered for, ranked from their registrations and saved events, with a short reason for each pick.

Both features work with **no API key**: the server answers from the real SQLite data with a deterministic rule engine. To enable the AI provider, copy the template and add a key:

```powershell
cd backend
Copy-Item .env.example .env
```

Then edit `backend/.env`:

```dotenv
AI_API_KEY=your-key-here
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
AI_TIMEOUT=20
```

Any OpenAI-compatible `/chat/completions` endpoint works. For a local Ollama server:

```dotenv
AI_API_KEY=
AI_BASE_URL=http://localhost:11434/v1
AI_MODEL=llama3.1
```

Local base URLs (`localhost` / `127.0.0.1`) are enabled without a key.

Important behavior:

- The key is read only by the PHP server. It is never sent to the browser or bundled by Vite.
- `backend/.env` is ignored by Git; commit `.env.example` instead.
- If the provider is unreachable, times out, or returns an unusable reply, the server falls back to the rule engine and the app keeps working.
- Assistant requests are limited to 30 per user per hour. Recommendation results are cached per user for 30 minutes and invalidated when the user’s saved events change.
- The assistant only receives the current user’s own registrations plus public upcoming event data.

## Demo accounts

| Role    | Email                    | Password      |
| ------- | ------------------------ | ------------- |
| Student | `alex.santos@email.com`  | `Password123` |
| Admin   | `admin@eventapp.test`    | `Admin123`    |

Both can be used with the demo buttons on the login screen. The student account comes with seeded registrations for past and upcoming events.

## Screens

| Route                        | Screen                                      |
| ---------------------------- | ------------------------------------------- |
| `/login`                     | Log in / create account / reset help        |
| `/`                          | Home — upcoming events dashboard            |
| `/register`                  | Event picker and registration entry point   |
| `/events/:id`                | Event registration form or existing ticket  |
| `/my-events`                 | My events (upcoming / past tabs)            |
| `/registrations/:id/edit`    | Edit registration                           |
| `/more`                      | More — settings and account actions         |
| `/profile`                   | Profile and password                        |
| `/manage-events`             | Manage events (administrators only)         |

Cancel-registration and delete-event confirmations are implemented as accessible modal dialogs on the My events and Manage events screens.

## Features

- Session auth with 30-day bearer tokens; only token hashes are stored server-side.
- Live debounced event search, capacity display, saved-event hearts, and registered badges.
- Registration form with pre-filled attendee details, attendee count, capacity checks, duplicate handling, and a unique ticket reference (for example `SC26-9907`).
- Ticket modal with registration reference, attendee details, event summary, and edit link.
- My events split into upcoming and past; cancel with a confirmation dialog releases the spot.
- Profile editing, browser-side avatar resizing, and password change.
- Notifications preferences, saved events, help, and about dialogs.
- Light/dark appearance toggle persisted in `localStorage`.
- Admin event management: create, edit, delete, with validation and delete confirmation; student accounts see an access gate.
- AI event assistant: floating chat panel with quick prompts, conversation history, saved-event context, and a rules fallback.
- AI recommendations: dashboard cards ranked from registrations, saved events, keywords, and event proximity, with per-user caching.
- Responsive layout with desktop header navigation and a mobile bottom tab bar.
- Loading skeletons, empty states, toasts, and field-level API validation errors.

## API reference

Base URL: `http://127.0.0.1:8000/api`

| Method   | Path                  | Auth              | Description                                    |
| -------- | --------------------- | ----------------- | ---------------------------------------------- |
| `POST`   | `/auth/login`         | Public            | Sign in; returns a bearer token and user       |
| `POST`   | `/auth/register`      | Public            | Create a student account and return a token    |
| `POST`   | `/auth/logout`        | Bearer            | Revoke the current token                       |
| `GET`    | `/auth/me`            | Bearer            | Current user                                   |
| `PUT`    | `/me`                 | Bearer            | Update name, email, contact, avatar            |
| `PUT`    | `/me/password`        | Bearer            | Change password                                |
| `GET`    | `/events`             | Optional bearer   | List events (`scope=upcoming` or `scope=past`, `search=`) |
| `POST`   | `/events`             | Admin             | Create an event                                |
| `GET`    | `/events/{id}`        | Optional bearer   | Event detail, including your registration      |
| `PUT`    | `/events/{id}`        | Admin             | Update an event                                |
| `DELETE` | `/events/{id}`        | Admin             | Delete an event and its registrations          |
| `GET`    | `/registrations`      | Bearer            | Your registrations                             |
| `POST`   | `/registrations`      | Bearer            | Register for an event                          |
| `GET`    | `/registrations/{id}` | Owner or admin    | Registration detail                            |
| `PUT`    | `/registrations/{id}` | Owner or admin    | Update attendee details                        |
| `DELETE` | `/registrations/{id}` | Owner or admin    | Cancel a registration (soft delete)            |
| `POST`   | `/ai/assistant`       | Bearer            | Ask the event assistant; body `{ message, history, saved_event_ids }` |
| `GET`    | `/ai/recommendations` | Bearer            | Ranked suggestions; optional `saved=1,2,3`     |

Errors use `{ "message": "…", "errors": { "field": "…" } }` with an appropriate HTTP status. Send the token as `Authorization: Bearer <token>`.

## Data notes

- The SQLite database is created automatically and seeded only when the `users` table is empty. Seeded event dates are relative to the day the database is first created.
- To reset all demo data, stop the API and delete `backend/storage/app.sqlite` (and any `-wal`/`-shm` files), then make another request.
- Passwords are hashed with PHP's `password_hash()`; API responses never expose them.
- Avatar images are resized in the browser and stored as data URLs in the user record.
- AI usage is stored in `ai_requests` (hourly quota) and `ai_recommendations` (per-user cache). Both tables are created automatically and contain no provider credentials.
- This is a local demo, not a production deployment: CORS is open and tokens are stored in `localStorage`.

## Troubleshooting

- **“Cannot reach the server”** — make sure the PHP API is running on port 8000. The frontend dev server proxies `/api` there.
- **`could not find driver`** — start PHP with `pdo_sqlite`/`sqlite3` enabled, or use `backend/run.ps1`/`run.bat`, which enable them per process.
- **Port already in use** — stop the existing process or start the API with a different `PORT`; update the proxy target in `frontend/vite.config.js` if you change it.
- **`database is locked`** — run a single API process against the SQLite file; WAL mode is enabled to keep reads and writes cooperative.
- **AI replies look rule-based** — no `.env` key is configured, the base URL is wrong, or the provider is unreachable. The app falls back on purpose; check the PHP terminal for `[event-app] AI request failed` lines.
- **`could not find driver`** after adding AI settings — restart the API with `backend/run.ps1` so the SQLite extensions are enabled for the new process.
