import { redirect } from '@sveltejs/kit';
import { getStore } from '$lib/server/demo/store';
import type { RequestHandler } from './$types';
export const POST: RequestHandler = ({ cookies }) => {
	const token = cookies.get('roomqu-demo-session');
	if (token) getStore().logout(token);
	cookies.delete('roomqu-demo-session', { path: '/demo' });
	redirect(303, '/demo/login');
};
