import type { Handle } from '@sveltejs/kit';
import * as auth from '$lib/server/auth';
import { sequence } from '@sveltejs/kit/hooks';
import { db } from '$lib/server/db';
import { session, units } from '$lib/server/db/schema';
import { lt, eq, sql, and } from 'drizzle-orm';

export const checkUnitsMiddleware: Handle = async ({ event, resolve }) => {
	try {
		const expiredUnits = await db
			.select()
			.from(units)
			.where(
				and(
					eq(units.unitState, 'Working'),
					lt(units.toTime, sql`(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')`)
				)
			);
		for (const u of expiredUnits) {
			await db.update(units).set({ unitState: 'StandBy' }).where(eq(units.id, u.id));
		}
	} catch (error) {}

	return resolve(event);
};

const authMiddleware: Handle = async ({ event, resolve }) => {
	const sessionToken = event.cookies.get(auth.sessionCookieName);
	let user = null;
	let session = null;
	if (sessionToken) {
		const result = await auth.validateSessionToken(sessionToken, event);
		user = result.user;
		session = result.session;

		if (session) {
			auth.setSessionTokenCookie(event, sessionToken, session.expiresAt, '/');
		} else {
			auth.deleteSessionTokenCookie(event, '/');
		}
	}
	event.locals.user = user;
	event.locals.session = session;
	// Path and route control
	const pathname = event.url.pathname;
	const publicRoutes = ['/', '/offline'];
	const isPublic = publicRoutes.some((r) => pathname === r);

	// Define each accountType’s dashboard
	const homeRoutes = {
		FO: '/User/FO',
		HK: '/User/HK',
		T: '/User/T',
		H: '/User/H'
	} as const;

	// 🧭 1. Not logged in trying to access protected route → send to landing
	if (!user && !isPublic) {
		return Response.redirect(new URL('/', event.url), 302);
	}

	// 🧭 2. Logged in but tries to access public routes → send to dashboard
	if (user && isPublic) {
		const redirectTo = homeRoutes[user.accountType as keyof typeof homeRoutes] ?? '/';
		return Response.redirect(new URL(redirectTo, event.url), 302);
	}

	// 🧭 3. Role restriction: ensure users only access their area
	if (user) {
		for (const [type, route] of Object.entries(homeRoutes)) {
			// Example: FO can only access /fo/*
			if (pathname === `/User/${type.toUpperCase()}` && user.accountType !== type) {
				const redirectTo = homeRoutes[user.accountType as keyof typeof homeRoutes] ?? '/';
				return Response.redirect(new URL(redirectTo, event.url), 302);
			}
		}
	}

	// Continue normally
	return await resolve(event);
};

const checkOutdatedSession: Handle = async ({ event, resolve }) => {
	await db.delete(session).where(lt(session.expiresAt, new Date()));
	return await resolve(event);
};

export const handle: Handle = sequence(authMiddleware, checkOutdatedSession, checkUnitsMiddleware);
