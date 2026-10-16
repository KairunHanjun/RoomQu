import { error } from '@sveltejs/kit';
import { getStore } from '$lib/server/demo/store';
import { exportWorkbook } from '$lib/server/demo/export';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async ({ locals, params }) => {
	const user = locals.demoUser;
	if (!user || user.role !== 'H') error(403, 'Ekspor hanya tersedia untuk Host.');
	if (!['bookings', 'issues', 'attendance'].includes(params.kind))
		error(404, 'Laporan tidak ditemukan.');
	const buffer = await exportWorkbook(getStore().snapshot(user), params.kind);
	return new Response(buffer, {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': `attachment; filename="roomqu-demo-${params.kind}.xlsx"`,
			'Cache-Control': 'no-store'
		}
	});
};
