import type { RequestEvent } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { sha256 } from '@oslojs/crypto/sha2';
import { encodeBase64url, encodeHexLowerCase } from '@oslojs/encoding';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';

const FIFTEEN_MINUTES_IN_MS = 15 * 60 * 1000;

export const sessionCookieName = 'auth-session';

export function generateSessionToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(18));
	const token = encodeBase64url(bytes);
	return token;
}

export async function createSession(token: string, userId: string): Promise<{ id: string; userId: string; expiresAt: Date; }> {
	const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
	const session: table.Session = {
		id: sessionId,
		userId,
		expiresAt: new Date(Date.now() + FIFTEEN_MINUTES_IN_MS)
	};
	await db.insert(table.session).values(session);
	return session;
}

export async function validateSessionToken(token: string, event: RequestEvent): Promise<{
    session: null;
    user: null;
} | {
    session: {
        id: string;
        userId: string;
        expiresAt: Date;
    };
    user: {
		accountType: "FO" | "HK" | "T" | "H";
        id: string;
        username: string;
		createdByWho: string;
    };
}> {
	let user: {
		accountType: "FO" | "HK" | "T" | "H";
        id: string;
        username: string;
		createdByWho: string;
    };
	let session: {
        id: string;
        userId: string;
        expiresAt: Date;
    };
	if(!event.locals.session || !event.locals.user){
		const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
		const [result] = await db
			.select({
				// Adjust user table here to tweak returned data
				user: { id: table.accounts.id, username: table.accounts.username, accountType: table.accounts.accountType, createdByWho: table.accounts.createdByWho},
				session: table.session
			})
			.from(table.session)
			.innerJoin(table.accounts, eq(table.session.userId, table.accounts.id))
			.where(eq(table.session.id, sessionId));

		if (!result) {
			return { session: null, user: null };
		}
		user  = result.user;
		session = result.session;
	}else{
		user = event.locals.user;
		session = event.locals.session;
	}

	const sessionExpired = Date.now() >= session.expiresAt.getTime();
	if (sessionExpired) {
		await db.delete(table.session).where(eq(table.session.id, session.id));
		return { session: null, user: null };
	}

	const renewSession = Date.now() >= session.expiresAt.getTime() - 5 * 60 * 1000;
	if (renewSession) {
		session.expiresAt = new Date(Date.now() + FIFTEEN_MINUTES_IN_MS);
		await db
			.update(table.session)
			.set({ expiresAt: session.expiresAt })
			.where(eq(table.session.id, session.id));
	}

	return { session, user };
}

export type SessionValidationResult = Awaited<ReturnType<typeof validateSessionToken>>;

export async function invalidateSession(sessionId: string) {
	try{
		await db.delete(table.session).where(eq(table.session.id, sessionId));
	}catch(error){
		console.log(error);
	}
}

export function setSessionTokenCookie(event: RequestEvent, token: string, expiresAt: Date, path: string) {
	if(!event.cookies.get(sessionCookieName)){
		event.cookies.set(sessionCookieName, token, {
			expires: expiresAt,
            httpOnly: true,
            sameSite: 'lax',
            secure: event.url?.protocol === 'https:',
			path: path
		});
	}
}

export function deleteSessionTokenCookie(event: RequestEvent, path: string) {
	event.cookies.delete(sessionCookieName, {
		path: path
	});
}
