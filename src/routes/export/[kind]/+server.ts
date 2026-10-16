import { error, type RequestHandler } from '@sveltejs/kit';
import { snapshot } from '$lib/server/integrated/snapshot';
import { exportWorkbook } from '$lib/server/demo/export';
export const GET: RequestHandler = async (event) => {
	if (event.locals.user?.accountType !== 'H') error(403, 'Hanya Host.');
	if (!['bookings', 'issues', 'attendance'].includes(event.params.kind || ''))
		error(404, 'Ekspor tidak tersedia.');
	const bytes = await exportWorkbook(await snapshot(event), event.params.kind || '');
	return new Response(new Uint8Array(bytes), {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': `attachment; filename="roomqu-original-${event.params.kind || ''}.xlsx"`
		}
	});
};
