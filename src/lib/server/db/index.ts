import { drizzle as postgresDrizzle } from 'drizzle-orm/postgres-js';
import { drizzle as localDrizzle } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';
import { building } from '$app/environment';
import { resolve } from 'node:path';
import { initializeLocalPostgres } from './local-postgres';

const cache = globalThis as typeof globalThis & {
	roomquOriginalPg?: PGlite;
	roomquOriginalReady?: Promise<void>;
};
const remote = postgresDrizzle(
	postgres(env.DATABASE_URL_DEV || 'postgres://unused:unused@127.0.0.1:5432/unused'),
	{ schema }
);
export const localClient =
	building || env.ROOMQU_MODE === 'live'
		? null
		: (cache.roomquOriginalPg ??= new PGlite(
				resolve(env.ROOMQU_PG_DIR || '.demo/original-postgres')
			));
// Both drivers implement Drizzle's PostgreSQL API; existing server actions use the same schema.
export const db: typeof remote = localClient
	? (localDrizzle(localClient, { schema }) as unknown as typeof remote)
	: remote;
export async function ensureDatabase() {
	if (localClient) await (cache.roomquOriginalReady ??= initializeLocalPostgres(localClient));
}
