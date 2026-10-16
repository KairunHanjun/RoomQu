import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL_DEV) throw new Error('DATABASE_URL_DEV is not set');

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'postgresql',
	dbCredentials: {ssl: {
		requestCert: true
	},
	url: process.env.DATABASE_URL_DEV },
	verbose: true,
	strict: true
});
