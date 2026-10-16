import { error } from '@sveltejs/kit';
import { getStore, DemoError } from '$lib/server/demo/store';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = ({ locals, params }) => {
	if (!locals.demoUser) error(401);
	try {
		const row = getStore().readMedia(locals.demoUser, params.id);
		return new Response(new Uint8Array(row.content), {
			headers: {
				'Content-Type': row.mime,
				'X-Content-Type-Options': 'nosniff',
				'Cache-Control': 'private,no-store'
			}
		});
	} catch (caught) {
		if (caught instanceof DemoError) error(caught.status, caught.message);
		throw caught;
	}
};
