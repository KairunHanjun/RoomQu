import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getStore } from '$lib/server/demo/store';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.demoUser = null;
	if (env.ROOMQU_MODE === 'live') {
		const legacy = await import('./hooks.legacy.server');
		return legacy.handle({ event, resolve });
	}
	event.locals.user = null;
	event.locals.session = null;
	const pathname = event.url.pathname;
	if (
		['POST', 'PUT', 'PATCH', 'DELETE'].includes(event.request.method) &&
		event.request.headers.get('origin') !== event.url.origin
	)
		return new Response('Permintaan harus berasal dari aplikasi RoomQu.', { status: 403 });
	if (!pathname.startsWith('/demo')) {
		if (pathname === '/' || pathname.startsWith('/User') || pathname === '/logout')
			return new Response(null, { status: 303, headers: { location: '/demo/login' } });
		if (pathname.startsWith('/api'))
			return new Response('Endpoint lama tidak aktif pada mode demo.', { status: 403 });
		return resolve(event);
	}
	const token = event.cookies.get('roomqu-demo-session');
	event.locals.demoUser = token ? getStore().session(token) : null;
	if (token && !event.locals.demoUser)
		event.cookies.delete('roomqu-demo-session', { path: '/demo' });
	if (!event.locals.demoUser && pathname !== '/demo/login')
		return new Response(null, { status: 303, headers: { location: '/demo/login' } });
	const response = await resolve(event);
	response.headers.set('Cache-Control', 'private, no-store');
	return response;
};
