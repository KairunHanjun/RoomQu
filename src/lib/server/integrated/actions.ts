import { error, fail, type Actions, type RequestEvent } from '@sveltejs/kit';
import { db, localClient } from '$lib/server/db';
import {
	accounts,
	agents,
	units,
	customers,
	kebersihan,
	masalah,
	absensi
} from '$lib/server/db/schema';
import { and, eq, gte, lt } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import * as host from '$lib/server/original/host';
import * as front from '$lib/server/original/front-office';
import * as hk from '$lib/server/original/housekeeping';
import * as tech from '$lib/server/original/technician';
import { owner, day } from './snapshot';
import { saveImage } from './media';

let queue: Promise<unknown> = Promise.resolve();
export const integratedAction: NonNullable<Actions[string]> = (event) => {
	const run = queue.then(() => dispatch(event));
	queue = run.catch(() => {});
	return run;
};
async function dispatch(event: RequestEvent) {
	const who = owner(event),
		user = event.locals.user!;
	if (event.url.pathname !== '/User/' + user.accountType) error(403, 'Peran tidak sesuai.');
	const input = await event.request.formData(),
		field = (k: string) => String(input.get(k) || '');
	const intent = field('intent');
	const roleMap: Record<string, string[]> = {
		checkin: ['FO'],
		checkout: ['FO'],
		cleaning: ['HK'],
		approve: ['H'],
		reject: ['H'],
		resolve: ['T'],
		attendance: ['FO', 'HK', 'T'],
		issue: ['FO', 'HK', 'T'],
		unit: ['H'],
		agent: ['H'],
		staff: ['H']
	};
	if (!roleMap[intent]?.includes(user.accountType))
		error(403, 'Tindakan tidak tersedia untuk peran ini.');
	const output = new FormData();
	const put = (k: string, v: unknown) => output.set(k, String(v));
	put('name', user.username);
	put('accountType', user.accountType);
	put(
		'jam',
		new Intl.DateTimeFormat('en-GB', {
			timeZone: 'Asia/Bangkok',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		}).format(new Date())
	);
	let actions: Actions = host.actions,
		key = '';
	let message = 'Data tersimpan melalui backend asli RoomQu.';
	const roomId = field('unitId');
	let room: typeof units.$inferSelect | undefined;
	if (['checkin', 'checkout', 'cleaning', 'issue'].includes(intent)) {
		[room] = await db
			.select()
			.from(units)
			.where(and(eq(units.id, roomId), eq(units.createdByWho, who)));
		if (!room) error(404, 'Unit tidak ditemukan.');
		put('unit_id', roomId);
	}
	async function image(key: string, sample: string) {
		const file = input.get(key);
		if (file instanceof File && file.size)
			return localClient
				? saveImage(file, who)
				: (await import('$lib/server/upload_cloudinary')).CREATE(file).then((r) => {
						if (!r) error(400, 'Unggah gambar gagal.');
						return r.public_id;
					});
		if (!localClient) error(400, 'Unggah gambar diperlukan pada database eksternal.');
		return sample;
	}
	const integer = (key: string, min: number, max: number) => {
		const n = Number(field(key));
		if (!field(key) || !Number.isInteger(n) || n < min || n > max)
			error(400, 'Nilai ' + key + ' tidak valid.');
		return n;
	};
	switch (intent) {
		case 'checkin': {
			if (room!.unitState !== 'Ready') error(409, 'Unit belum siap.');
			const [agent] = await db
				.select()
				.from(agents)
				.where(and(eq(agents.id, field('agentId')), eq(agents.createdByWho, who)));
			if (!agent) error(404, 'Agen tidak ditemukan.');
			const name = field('guestName').trim();
			if (!name || name.length > 100) error(400, 'Nama tamu tidak valid.');
			const hourly = field('durationUnit') === 'hours';
			const nights = integer('nights', 1, hourly ? 23 : 30),
				price = integer('price', 0, 100000000),
				commission = integer('komisi', 0, price);
			const from = new Date(),
				to = new Date(from.getTime() + nights * (hourly ? 3600000 : 86400000));
			put('name', name);
			const time = (date: Date) =>
				`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
			put('duration', hourly ? nights : 9999);
			put('enter', hourly ? time(from) : from.toISOString());
			put('out', hourly ? time(to) : to.toISOString());
			put('price', price);
			put('komisi', commission);
			put('agent', agent.id + '|' + who);
			if (!localClient) error(400, 'Alur portofolio hanya memakai database dummy lokal.');
			put('pic1Id', 'local-demo-no-identity-' + randomUUID());
			actions = front.actions;
			key = 'costumer';
			message = 'Check-in tersimpan pada tabel customers dan units asli.';
			break;
		}
		case 'checkout':
			if (room!.unitState !== 'Working') error(409, 'Unit tidak sedang terisi.');
			put('readyState', 'true');
			actions = front.actions;
			key = 'editcostumer';
			message = 'Check-out tersimpan; unit menunggu dibersihkan.';
			break;
		case 'cleaning':
			if (room!.unitState !== 'StandBy' || room!.pending)
				error(409, 'Unit tidak siap untuk laporan baru.');
			put('pic1Id', await image('roomImage', '/demo/room.svg'));
			put('pic2Id', await image('bathroomImage', '/demo/bathroom.svg'));
			if (room!.kebersihan) put('kebersihanId', room!.kebersihan);
			actions = hk.actions;
			key = 'keep';
			message = 'Dokumentasi tersimpan pada tabel kebersihan asli, menunggu persetujuan.';
			break;
		case 'approve':
		case 'reject': {
			const [linked] = await db
				.select()
				.from(units)
				.where(and(eq(units.kebersihan, field('id')), eq(units.createdByWho, who)));
			if (!linked || !linked.pending) error(409, 'Laporan tidak ditemukan atau sudah ditinjau.');
			if (intent === 'approve' && linked.unitState !== 'StandBy')
				error(409, 'Unit belum dapat disetujui.');
			put('unitId', linked.id);
			put('kebersihanId', field('id'));
			put('approve', intent === 'approve' ? 'Terima' : 'Tolak');
			key = 'approve';
			message =
				intent === 'approve'
					? 'Kebersihan disetujui melalui backend asli.'
					: 'Laporan dikembalikan untuk pemeriksaan ulang.';
			break;
		}
		case 'issue': {
			const description = field('description').trim();
			if (!description || description.length > 1000) error(400, 'Penjelasan masalah wajib diisi.');
			if (field('severe') === 'on' && room!.unitState === 'Working')
				error(409, 'Check-out tamu sebelum menutup unit untuk perawatan berat.');
			put('masalah', description);
			if (field('severe') === 'on') put('berat', 'true');
			put('pic1Id', await image('issueImage', '/demo/issue.svg'));
			actions = user.accountType === 'FO' ? front.actions : hk.actions;
			key = 'masalah';
			message = 'Laporan tersimpan pada tabel masalah asli.';
			break;
		}
		case 'resolve': {
			const [item] = await db
				.select({ id: masalah.id })
				.from(masalah)
				.innerJoin(units, eq(masalah.unitId, units.id))
				.where(
					and(eq(masalah.id, field('id')), eq(units.createdByWho, who), eq(masalah.done, false))
				);
			if (!item) error(404, 'Masalah tidak ditemukan.');
			put('masalah_id', item.id);
			actions = tech.actions;
			key = 'repairman';
			message = 'Perbaikan diselesaikan melalui aksi repairman asli.';
			break;
		}
		case 'attendance': {
			const records = await db.select().from(absensi).where(eq(absensi.name, user.username));
			if (records.some((r) => day(r.whenEntry) === day(new Date())))
				error(409, 'Absensi hari ini sudah tercatat.');
			// Original FO accepts an image identifier; reuse that handler for all allowed staff roles.
			put('pic1Id', await image('attendanceImage', '/demo/attendance.svg'));
			actions = front.actions;
			key = 'absen';
			message = 'Absensi tersimpan pada tabel absen asli.';
			break;
		}
		case 'unit':
			if (!field('name').trim() || field('name').length > 20) error(400, 'Nama unit tidak valid.');
			put('UnitName', field('name').trim());
			put('Status', 'Ready');
			key = 'addUnit';
			break;
		case 'agent':
			if (!field('name').trim() || !/^.+@.+\..+$/.test(field('email')))
				error(400, 'Nama dan email agen wajib diisi.');
			put('AgentName', field('name').trim());
			put('EmailAgent', field('email'));
			put('PhoneAgent', '');
			key = 'addAgent';
			break;
		case 'staff':
			if (!['FO', 'HK', 'T'].includes(field('role'))) error(400, 'Peran staf tidak valid.');
			put('Username', field('username'));
			put('Password', field('password'));
			put('Role', field('role'));
			put('Email', field('email'));
			put('Telp', '');
			key = 'addAccount';
			break;
	}
	const handler = actions[key];
	if (!handler) error(400, 'Aksi backend tidak ditemukan.');
	const request = new Request(event.request.url, { method: 'POST', body: output });
	// Calls the original SvelteKit action rather than maintaining a second business implementation.
	const result = await handler({ ...event, request });
	if (result && typeof result === 'object' && 'status' in result && 'data' in result) {
		const data = result.data as { message?: string; error?: string; description?: string };
		return fail(Number(result.status), {
			success: false,
			message: data.description || data.message || data.error || 'Data gagal disimpan.'
		});
	}
	return { success: true, message };
}
