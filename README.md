# Waypoint

A deployment and release console for small platform teams.

Once a build passes CI, moving it through environments usually falls to scattered scripts, a
shared spreadsheet and a chat thread. Nobody can say for certain what is running where, a bad
release is noticed late, and recovering depends on someone remembering what the previous
version was. Waypoint keeps that in one place: every build is recorded as an immutable release,
every deployment runs as a tracked background job with its own log, a release advances one
environment at a time behind a health check, and any environment can be returned to an earlier
release in a single action.

Two roles share the workspace. Release managers configure environments, promote releases, roll
back, and manage secrets. Contributors can read everything, cut releases, and deploy to the
first stage of the promotion order, but cannot act beyond it. Both roles are demonstrated by
switching profiles rather than by signing in twice.

## Technology stack

| Layer | Choice | What it does here |
|---|---|---|
| Runtime and package manager | Bun 1.4 | Runs both servers, installs the workspaces, and watches the backend for reload |
| Frontend | React 19.2.4 with `react-dom` 19.2.4 | The console UI, one feature folder per product area |
| Build tool | Vite 8.2.2 with `@vitejs/plugin-react` 6.1.1 | Dev server on port 3000, proxies `/api` to the backend, and produces the production build |
| Backend | Express 5.2.1 | HTTP layer, one router per feature under `/api/v1` |
| Database | MongoDB 8 with Mongoose 8.24.1 | All product data; also the job queue and the environment locks |
| Validation | Zod 4.3.6 | Parses and rejects every request body and query string at the controller boundary |
| Authentication | `jsonwebtoken` 9.0.2 | Issues a workspace token at sign-in and a profile token when a profile is chosen |
| Password hashing | `bcryptjs` 3.0.2 | Hashes seeded account passwords and verifies them at sign-in |
| Process orchestration | `concurrently` 9.2.1 | Runs the backend and frontend together under one command |
| Backend utilities | `cors` 2.8.6, `dotenv` 17.3.1 | Cross-origin headers for the API, and `.env` loading at startup |
| Typeface | `@fontsource/roboto` 5.3.0 | Self-hosted font, so the UI needs no external requests |

No job queue library, cache or WebSocket layer is used. The background worker, its retries and
the environment locks are plain timers and atomic MongoDB updates; live logs are polled.

## Project structure

```text
.
├── backend/
│   ├── src/
│   │   ├── app.js                  Express app: middleware and route mounting
│   │   ├── index.js                Process entry: connects Mongo, starts the server and worker
│   │   ├── features/               One folder per product area
│   │   │   ├── auth/               Sign-in, session, profile switching
│   │   │   ├── members/            Workspace members, exposed as selectable profiles
│   │   │   ├── projects/           Projects, owner-scoped, archive and restore
│   │   │   ├── environments/       Ranked environments and the atomic promotion lock
│   │   │   ├── releases/           Immutable build records and the release diff
│   │   │   ├── variables/          Per-environment variables with server-side secret masking
│   │   │   ├── deployments/        Deploy, promote, rollback, plus the job queue and worker
│   │   │   └── dashboard/          Read-only aggregation across the other features
│   │   ├── shared/
│   │   │   ├── config/             Environment loading and the Mongo connection
│   │   │   ├── constants/          Roles and seeded avatar colors
│   │   │   ├── errors/             The AppError contract used by every service
│   │   │   └── middleware/         Auth, profile context, role gating, error handling
│   │   └── scripts/
│   │       ├── seed.js             Reseeds every collection to the documented baseline
│   │       └── *-seed-data.js      Deterministic release, variable and deployment history
│   ├── public/                     Served landing page for the API port
│   └── .env.example                Committed template; setup.sh copies it to .env
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 Auth bootstrap, profile gate, console handoff
│   │   ├── main.jsx                React entry
│   │   ├── styles.css              Whole-app stylesheet, dark and light themes
│   │   ├── features/               Mirrors the backend feature folders
│   │   │   └── console/            Shell: header, sidebar, section routing
│   │   └── shared/
│   │       ├── api/                Fetch client, token storage, error shaping
│   │       ├── components/         Modal, confirmation dialog, select menu, icons
│   │       ├── constants/          Role labels
│   │       └── utils/              Date formatting, initials, theme persistence
│   ├── index.html                  Vite entry and pre-React boot screen
│   ├── vite.config.js              Port 3000 and the /api proxy to port 8000
│   └── .env.example                Committed template; setup.sh copies it to .env
├── skills/validate/                The submission verifier and its reference checks
├── transcripts/
│   └── log.txt                     Exported AI transcript, one entry per conversation turn
├── hackerrank.yml                  Install and run configuration
├── setup.sh                        Environment files, MongoDB readiness, seed reset
├── package.json                    Bun workspaces and the start scripts
└── bun.lock                        Pinned dependency graph
```

## Prerequisites

- **Bun 1.4 or newer.** It is the runtime and the package manager; Node.js is not required.
- **A MongoDB 8 server reachable on `127.0.0.1:27017`.** Any local server works, whether run
  directly or in a container. `setup.sh` checks that the port answers before seeding and, if a
  local `mongod` binary is installed, tries to start one when nothing is listening.
- **Bash**, to run `setup.sh`.

Ports `3000` and `8000` must be free.

## MongoDB behavior

The backend reads `MONGODB_URI` from `backend/.env`. That file is not committed; `setup.sh`
creates it from the committed `backend/.env.example`, which points at
`mongodb://localhost:27017/waypoint_db`. The same step creates `frontend/.env` from its
template. No manual environment editing is needed.

Seeding is deterministic and rebuilds the whole database:

```text
5 members (2 release managers, 3 contributors)
5 sign-in accounts, each able to open any of the 5 profiles
11 projects (10 active, 1 archived)
33 environments (3 per project)
204 variables (48 secret, 156 plain)
52 releases (163 recorded file changes)
54 deployments (26 live, 23 superseded, 5 failed)
1576 deployment log lines and 54 completed jobs
26 of 33 environments holding a release
```

**A restart reseeds.** `bun start` runs `setup.sh --start` before the servers come up, which
drops every collection and rebuilds the baseline above. Anything created while the application
was running is discarded. This is intentional: it guarantees a known starting state for review,
so the console always opens with the same history rather than whatever a previous session left
behind. To keep working data across restarts, start the servers directly instead
(`bun run dev:backend` and `bun run dev:frontend`), which skips the reseed.

## Run instructions

These are the exact commands declared in `hackerrank.yml`.

Install, from a clean checkout:

```sh
bun install && bash setup.sh --seed
```

Start:

```sh
bun start
```

The console is then at **http://localhost:3000** and the API at **http://localhost:8000**. The
Vite dev server proxies `/api` to the backend, so the browser only ever talks to port 3000.
`GET http://localhost:8000/api/v1/health` reports service status and the MongoDB connection
state.

## Command reference

| Command | Purpose |
|---|---|
| `bun install` | Installs dependencies for both workspaces |
| `bash setup.sh --seed` | Creates missing `.env` files, verifies MongoDB, and reseeds |
| `bun start` | Reseeds, then runs backend and frontend together |
| `bun run seed` | Reseeds the database without starting anything |
| `bun run dev:backend` | Runs only the API, with reload, and no reseed |
| `bun run dev:frontend` | Runs only the Vite dev server, and no reseed |
| `cd frontend && bun run build` | Produces the production build in `frontend/dist` |
| `cd frontend && bun run preview` | Serves that production build locally |

`setup.sh --start` is the same as `--seed`; it is the name `prestart` uses.

## Seeded access

Every seeded account uses the same password:

```text
password123
```

| Email | Name | Role |
|---|---|---|
| `avery.chen@waypoint.dev` | Avery Chen | Release manager |
| `marcus.hale@waypoint.dev` | Marcus Hale | Release manager |
| `priya.raman@waypoint.dev` | Priya Raman | Contributor |
| `devon.brooks@waypoint.dev` | Devon Brooks | Contributor |
| `sofia.marino@waypoint.dev` | Sofia Marino | Contributor |

Signing in gets you into the workspace; it does not yet decide what you can do. After sign-in
you pick a **profile**, and that profile's role governs every action. Every account can open
any of the five profiles, so the role difference can be reviewed in one session: sign in as
Avery Chen, work as a release manager, then use **Switch profile** in the profile menu and
choose Priya Raman to see the same screens as a contributor, with the actions you no longer
have disabled and explained.

Projects are owned by the profile that created them, so each profile sees its own projects.
Avery Chen owns Checkout API and Payments Gateway, which carry the fullest seeded history.
