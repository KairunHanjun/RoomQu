import { error, fail } from '@sveltejs/kit';
import { DemoError, getStore, roleAreas, type Role } from '$lib/server/demo/store';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = ({ locals, params, url }) => {
	const user = locals.demoUser;
	if (!user) error(401, 'Silakan masuk.');
	if (params.area !== roleAreas[user.role])
		error(403, 'Halaman ini tidak tersedia untuk peran Anda.');
	const tabs: Record<Role, string[]> = {
		H: ['overview', 'units', 'bookings', 'cleaning', 'issues', 'attendance', 'staff', 'agents'],
		FO: ['overview', 'units', 'bookings', 'issues', 'attendance'],
		HK: ['overview', 'units', 'cleaning', 'issues', 'attendance'],
		T: ['overview', 'units', 'issues', 'attendance']
	};
	const view = url.searchParams.get('view') || 'overview';
	if (!tabs[user.role].includes(view)) error(403, 'Menu ini tidak tersedia untuk peran Anda.');
	return { snapshot: getStore().snapshot(user), view };
};
const action: NonNullable<Actions[string]> = async ({ locals, params, request }) => {
	const user = locals.demoUser;
	if (!user) error(401, 'Silakan masuk.');
	if (params.area !== roleAreas[user.role]) error(403, 'Akses ditolak.');
	const input = await request.formData();
	const field = (key: string) => String(input.get(key) ?? '');
	const store = getStore();
	let message = 'Data demo berhasil disimpan.';
	async function image(key: string, fallback: string) {
		const file = input.get(key);
		if (file instanceof File && file.size > 0) {
			if (file.size > 2 * 1024 * 1024) throw new DemoError('Ukuran gambar maksimal 2 MB.');
			return store.saveMedia(user!, new Uint8Array(await file.arrayBuffer()), file.type);
		}
		return fallback;
	}
	try {
		switch (field('intent')) {
			case 'checkin':
				store.checkin(user, {
					unitId: field('unitId'),
					agentId: field('agentId'),
					guestName: field('guestName'),
					nights: field('nights')
				});
				message = 'Tamu demo berhasil check-in. Unit sekarang terisi.';
				break;
			case 'checkout':
				store.checkout(user, field('unitId'));
				message = 'Tamu berhasil check-out. Unit diteruskan untuk dibersihkan.';
				break;
			case 'cleaning':
				store.cleaning(user, {
					unitId: field('unitId'),
					notes: field('notes'),
					roomImage: await image('roomImage', '/demo/room.svg'),
					bathroomImage: await image('bathroomImage', '/demo/bathroom.svg')
				});
				message = 'Laporan kebersihan dikirim. Menunggu persetujuan Host.';
				break;
			case 'approve':
				store.approveCleaning(user, field('id'), true);
				message = 'Kebersihan disetujui. Unit siap digunakan.';
				break;
			case 'reject':
				store.approveCleaning(user, field('id'), false);
				message = 'Laporan dikembalikan untuk pemeriksaan ulang.';
				break;
			case 'issue':
				store.reportIssue(user, {
					unitId: field('unitId'),
					description: field('description'),
					severe: field('severe') === 'on',
					image: await image('issueImage', '/demo/issue.svg')
				});
				message = 'Laporan masalah tersimpan untuk tim Teknisi.';
				break;
			case 'resolve':
				store.resolveIssue(user, field('id'));
				message = 'Masalah ditandai selesai. Unit kosong perlu diperiksa kebersihannya.';
				break;
			case 'attendance':
				store.attend(user, await image('attendanceImage', '/demo/attendance.svg'));
				message = 'Absensi hari ini berhasil dicatat.';
				break;
			case 'unit':
				store.addUnit(user, { name: field('name'), type: field('type'), rate: field('rate') });
				message = 'Unit demo berhasil ditambahkan.';
				break;
			case 'agent':
				store.addAgent(user, {
					name: field('name'),
					email: field('email'),
					commission: field('commission')
				});
				message = 'Agen demo berhasil ditambahkan.';
				break;
			case 'staff':
				store.addStaff(user, {
					username: field('username'),
					name: field('name'),
					role: field('role'),
					email: field('email'),
					password: field('password')
				});
				message = 'Akun staf demo berhasil dibuat.';
				break;
			case 'disable':
				store.disableStaff(user, field('id'));
				message = 'Staf dinonaktifkan; riwayat operasional tetap tersimpan.';
				break;
			default:
				throw new DemoError('Tindakan tidak dikenali.');
		}
		return { success: true, message };
	} catch (error) {
		if (error instanceof DemoError)
			return fail(error.status, { success: false, message: error.message });
		throw error;
	}
};
export const actions: Actions = { default: action };
