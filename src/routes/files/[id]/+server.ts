import { readImage } from '$lib/server/integrated/media';
import { owner } from '$lib/server/integrated/snapshot';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async (event) => {
	const img = await readImage(event.params.id, owner(event));
	return new Response(new Uint8Array(img.bytes), {
		headers: {
			'Content-Type': img.mime,
			'Cache-Control': 'private, no-store',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
