import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
export const handle: Handle = async ({ event, resolve }) => {
	event.locals.demoUser = null;
	if (env.ROOMQU_MODE === 'demo')
		return (await import('./hooks.demo.server')).handle({ event, resolve });
	if (
		['POST', 'PUT', 'PATCH', 'DELETE'].includes(event.request.method) &&
		event.request.headers.get('origin') !== event.url.origin
	)
		return new Response('Origin tidak diizinkan.', { status: 403 });
	if (
		event.url.pathname.startsWith('/demo/') &&
		!event.url.pathname.endsWith('.svg') &&
		!event.url.pathname.endsWith('.ttf')
	)
		return new Response('Prototipe terpisah hanya tersedia dalam ROOMQU_MODE=demo.', {
			status: 404
		});
	if (event.url.pathname.startsWith('/api/'))
		return new Response('Gunakan aksi terintegrasi RoomQu.', { status: 403 });
	await (await import('$lib/server/db')).ensureDatabase();
	const original = await (await import('./hooks.legacy.server')).handle({ event, resolve });
	const response = new Response(original.body, {
		status: original.status,
		statusText: original.statusText,
		headers: new Headers(original.headers)
	});
	response.headers.set('Cache-Control', 'private, no-store');
	response.headers.set('X-RoomQu-Backend', 'original-drizzle');
	return response;
};
