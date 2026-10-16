# RoomQu — refreshed UI with the original backend

RoomQu was originally designed for mobile. This change connects a Codex-assisted refreshed UI to the original Argon2 login, sessions, Drizzle/PostgreSQL schema, and operational handlers. The original mobile UI and assets are archived from commit `520b0eb`, with SHA-256 hashes in [backups](backups/README.md). The UI remains mobile-oriented, including a maximum 480 px frame when previewed on desktop. Tauri packaging is not implemented.

## Run locally

Requires Node.js 24+ and pnpm:

```powershell
pnpm install --frozen-lockfile
.\start-demo.ps1
```

Open http://127.0.0.1:1231. The launcher selects `ROOMQU_MODE=integrated`; a custom port can be supplied with `-Port 1232`. Four fictional accounts share password `DemoRoom123!`: `host.demo`, `front.demo`, `clean.demo`, and `tech.demo`.

The local file database is **PGlite**, initialized from SQL generated from the original schema. No external PostgreSQL server or Cloudinary account is needed. Data persists across restarts. Run only one server per database directory.

## Integration

The refreshed UI runs at `/` and the original `/User/H`, `/User/FO`, `/User/HK`, `/User/T` routes. Forms call `?/integrated`, whose adapter validates role/property/input and delegates to the original server actions in `src/lib/server/original`. The existing `accounts`, `session`, `units`, `agents`, `customers`, `kebersihan`, `masalah`, and `absen` tables remain the source of operational data. The independent SQLite prototype is not used by this flow.

Daily and hourly (1–23 hours) check-in, checkout, cleaning submission/approval, maintenance resolution, attendance, and Host staff/unit/agent creation use the original handlers. Price and commission are explicit booking amounts, as in the original model. Unsupported prototype fields such as unit rate/type, agent percentage, staff full name, and inactive status are hidden rather than inventing schema columns. Original cleaning approval deletes its documentation record; original severe maintenance resolution returns the room to Ready.

Optional PNG/JPEG/WebP evidence up to 2 MB is stored locally with property-scoped access. Labeled demo illustrations are used when no file is uploaded. No real identity documents or payments are processed. Old API endpoints are restricted to avoid bypassing the new adapter. This is not a claim that every original UI feature has been replicated.

## Data and tests

Database directory: `.demo/original-postgres`; images: `.demo/original-media`. Override via `ROOMQU_PG_DIR`/`ROOMQU_MEDIA_DIR`. Stop the server before `pnpm demo:reset`; this resets accounts, sessions and operational dummy records while retaining uploaded image files.

```powershell
pnpm test:integrated
pnpm check
pnpm build
```

Integration tests start an isolated local server on port 1251 with a fresh file database. See [verification](docs/integration-verification.md). Temporary test databases and private uploads are excluded from Git.

`ROOMQU_MODE=demo` explicitly selects the previous standalone SQLite prototype. Its `test:prototype` tests and old screenshots do not verify the original backend. `prototype:reset` resets only that prototype. External PostgreSQL/Cloudinary mode (`ROOMQU_MODE=live`), production deployment, and Tauri packaging have not been verified. Dependencies were verified against `pnpm-lock.yaml`; npm ci was not tested.

The owner reports 100% contribution to the initial project. The refreshed UI and integration are subsequent Codex-assisted changes, not the unchanged original mobile interface.
