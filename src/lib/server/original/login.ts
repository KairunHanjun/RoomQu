import { fail, redirect, type Actions } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import * as auth from '$lib/server/auth';
import { accounts, session } from '$lib/server/db/schema';
import { verify } from 'argon2';

const homeRoutes = {
	FO: '/User/FO',
	HK: '/User/HK',
	T: '/User/T',
	H: '/User/H'
} as const;

export const actions: Actions = {
	default: async ({ request, cookies, locals }) => {
		const formData = await request.formData();
		const username = formData.get('username')?.toString().trim() ?? '';
		const password = formData.get('password')?.toString().trim() ?? '';
		if (!username || !password)
			return fail(400, { error: 'Harap masukan username dan password yang benar' });
		let user: {
			id: string;
			accountType: "FO" | "HK" | "T" | "H";
			username: string;
			passwordHash: string;
			email: string;
			phoneNumber: string | null;
			createdAt: Date;
			createdByWho: string;
		} | undefined = undefined;
		try {

			// Fetch user
			[user] = await db.select().from(accounts).where(eq(accounts.username, username.toLocaleLowerCase()));
			if (!user)
				return fail(400, { error: 'Username atau password salah' });

			// Verify password hash
			const validPassword = await verify(user.passwordHash, password);
			if (!validPassword) {
				return fail(400, {
					error: "Username atau password salah"
				});
			}

			// Check if someone already login with the account
			// const check_session = await db.select().from(session).where(eq(session.userId, user.id));
			// if(check_session.length > 0){
			// 	return fail(400, {
			// 		error: "Anda sudah login pada perangkat lain"
			// 	});
			// }

			// Create session
			const token = auth.generateSessionToken();
			const session2 = await auth.createSession(token, user.id);

			// Set cookie
			auth.setSessionTokenCookie(
				{ cookies } as any, // compatible with RequestEvent
				token,
				session2.expiresAt,
				'/'
			);

			// Redirect to dashboard based on accountType


		} catch (error) {
			console.log(error);
			return fail(422, {
				error: "Periksa kembali internet anda"
			});
		}
		redirect(302, homeRoutes[user.accountType as keyof typeof homeRoutes] ?? '/');
	}
};
