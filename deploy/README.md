# Public integrated demo on Node

Use branch `demo`, Node 24+, pnpm 11.25.0. `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test:integrated`, `pnpm build`. The Node adapter 5.x supports the retained SvelteKit 2 framework. `pnpm start` serves the production build; Vite dev/preview are not deployment runtimes.

Copy `build/`, package/lock/workspace files, `drizzle/0000_original-schema.sql`, `scripts/reset-integrated.ts`, `src/lib/server/db/local-postgres.ts` and the Dockerfile into a clean image context. Install Linux production dependencies there; do not copy Windows node_modules. No .env, database, media, logs, or credentials belong in the image/repository.

Run `ROOMQU_MODE=integrated`, never `live` or prototype `demo`, with `ORIGIN=https://roomqu.hamour.web.id`. Database `/data/postgres` and uploads `/data/media` belong to UID 10003. One process/container owns that database. Original schema is loaded and fictional accounts seeded automatically. Shared accounts/data can collide between visitors; do not upload personal documents.

Stop the running server before reset. The reset script truncates dummy records and reseeds, retaining uploaded media. Central operational reset additionally archives the entire `/data` directory and starts with an empty directory, removing public uploads from the active demo. See KairunHanjun/Astrofy `deploy/demos/` for compose, resource limits, restart/log/reset commands. Mobile styling is unchanged.
