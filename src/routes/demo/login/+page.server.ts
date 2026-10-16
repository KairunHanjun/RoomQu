import { fail, redirect } from '@sveltejs/kit';
import { getStore, DemoError, roleAreas } from '$lib/server/demo/store';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = ({ locals }) => {
	if (locals.demoUser) redirect(303, `/demo/${roleAreas[locals.demoUser.role]}`);
};
export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		try {
			const session = getStore().login(
				String(data.get('username') ?? ''),
				String(data.get('password') ?? '')
			);
			const old = cookies.get('roomqu-demo-session');
			if (old) getStore().logout(old);
			cookies.set('roomqu-demo-session', session.token, {
				path: '/demo',
				httpOnly: true,
				sameSite: 'lax',
				secure: new URL(request.url).protocol === 'https:',
				expires: new Date(session.expires)
			});
			redirect(303, `/demo/${roleAreas[session.user.role]}`);
		} catch (error) {
			if (error instanceof DemoError) return fail(error.status, { error: error.message });
			throw error;
		}
	}
};
