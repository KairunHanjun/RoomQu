FROM node:24-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install --global pnpm@11.25.0 && pnpm install --prod --frozen-lockfile --ignore-scripts
COPY build ./build
COPY drizzle/0000_original-schema.sql ./drizzle/0000_original-schema.sql
COPY scripts/reset-integrated.ts ./scripts/reset-integrated.ts
COPY src/lib/server/db/local-postgres.ts ./src/lib/server/db/local-postgres.ts
USER 10003:10003
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 ROOMQU_MODE=integrated ROOMQU_PG_DIR=/data/postgres ROOMQU_MEDIA_DIR=/data/media NODE_OPTIONS=--max-old-space-size=128
CMD ["node","build"]
