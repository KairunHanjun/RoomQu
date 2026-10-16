import { PGlite } from '@electric-sql/pglite';
import { resolve } from 'node:path';
import { initializeLocalPostgres } from '../src/lib/server/db/local-postgres.ts';
if (process.env.ROOMQU_MODE === 'live')
	throw new Error('Reset only supports a local dummy database.');
const pg = new PGlite(resolve(process.env.ROOMQU_PG_DIR || '.demo/original-postgres'));
await pg.waitReady;
const exists = await pg.query("SELECT to_regclass('public.accounts') AS name");
if ((exists.rows[0] as { name: string | null })?.name)
	await pg.exec(
		'TRUNCATE TABLE absen, session, customers, masalah, units, kebersihan, agents, accounts CASCADE'
	);
await initializeLocalPostgres(pg);
await pg.close();
console.log('Original-schema dummy database reset. Uploaded image files were retained.');
