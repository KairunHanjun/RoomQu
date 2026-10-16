import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import ExcelJS from 'exceljs';
import { DemoStore, DemoError, DEMO_PASSWORD, dayKey } from '../src/lib/server/demo/store.ts';
import { exportWorkbook } from '../src/lib/server/demo/export.ts';

describe('RoomQu local demo workflows', () => {
	let store: DemoStore;
	beforeEach(() => {
		store = new DemoStore(':memory:');
	});
	afterEach(() => store.close());
	const rejects = (callback: () => unknown, status = 400) =>
		assert.throws(
			callback,
			(error: unknown) => error instanceof DemoError && error.status === status
		);
	it('seeds isolated tenants with sample occupancy and no password in snapshots', () => {
		const snapshot = store.snapshot(store.user('host-demo'));
		assert.equal(snapshot.stats.total, 12);
		assert.equal(snapshot.stats.ready, 5);
		assert.equal(snapshot.stats.occupied, 3);
		assert.equal(snapshot.stats.pendingCleaning, 1);
		assert.equal(snapshot.staff.length, 3);
		assert.ok(!JSON.stringify(snapshot).includes('password'));
		assert.ok(!snapshot.units.some((u) => u.name === 'X01'));
		assert.equal(store.snapshot(store.user('other-host')).units.length, 1);
	});
	it('authenticates all four seeded roles and stores only token hashes', () => {
		for (const username of ['host.demo', 'front.demo', 'clean.demo', 'tech.demo']) {
			const session = store.login(username, DEMO_PASSWORD);
			assert.equal(store.session(session.token)?.username, username);
			assert.ok(
				!JSON.stringify(store.db.prepare('SELECT * FROM sessions').all()).includes(session.token)
			);
		}
	});
	it('rejects incorrect and unknown account credentials', () => {
		rejects(() => store.login('front.demo', 'wrong'));
		rejects(() => store.login('unknown', DEMO_PASSWORD));
	});
	it('expires and revokes sessions', () => {
		const session = store.login('front.demo', DEMO_PASSWORD);
		store.logout(session.token);
		assert.equal(store.session(session.token), null);
		const second = store.login('front.demo', DEMO_PASSWORD);
		store.db.prepare('UPDATE sessions SET expires_at=0').run();
		assert.equal(store.session(second.token), null);
		assert.equal(store.session('bad-token'), null);
	});
	it('calculates rates and commissions from server records', () => {
		const user = store.user('fo-demo');
		const input = {
			unitId: 'unit-103',
			agentId: 'agent-urban',
			guestName: 'Tamu Baru Demo',
			nights: 2,
			amount: 1
		};
		const id = store.checkin(user, input);
		const booking = store.snapshot(user).bookings.find((b) => b.id === id)!;
		assert.equal(booking.amount, 560000);
		assert.equal(booking.commission, 56000);
		assert.equal(store.snapshot(user).units.find((u) => u.id === 'unit-103')?.state, 'Working');
	});
	it('rejects duplicate check-in and keeps one active booking', () => {
		const user = store.user('fo-demo');
		const input = {
			unitId: 'unit-103',
			agentId: 'agent-walkin',
			guestName: 'Tamu Demo',
			nights: 1
		};
		store.checkin(user, input);
		rejects(() => store.checkin(user, input));
		assert.equal(
			store.snapshot(user).bookings.filter((b) => b.unitId === 'unit-103' && b.status === 'Active')
				.length,
			1
		);
	});
	it('rejects checkout on vacant units', () =>
		rejects(() => store.checkout(store.user('fo-demo'), 'unit-103')));
	it('checks guests out and queues their unit for cleaning', () => {
		const user = store.user('fo-demo');
		store.checkout(user, 'unit-101');
		const data = store.snapshot(user);
		assert.equal(data.units.find((u) => u.id === 'unit-101')?.state, 'StandBy');
		assert.equal(data.bookings.find((b) => b.id === 'booking-101')?.status, 'Completed');
	});
	it('rejects invalid duration and unavailable units without partial writes', () => {
		const user = store.user('fo-demo');
		for (const nights of [0, -1, 1.5, 31, '', 'abc'])
			rejects(() =>
				store.checkin(user, {
					unitId: 'unit-103',
					agentId: 'agent-walkin',
					guestName: 'Demo',
					nights
				})
			);
		for (const unitId of ['unit-101', 'unit-105', 'unit-205'])
			rejects(() =>
				store.checkin(user, { unitId, agentId: 'agent-walkin', guestName: 'Demo', nights: 1 })
			);
		assert.equal(store.snapshot(user).bookings.length, 4);
	});
	it('prevents cross-tenant unit and agent use', () => {
		const user = store.user('fo-demo');
		rejects(
			() =>
				store.checkin(user, {
					unitId: 'unit-other',
					agentId: 'agent-walkin',
					guestName: 'Demo',
					nights: 1
				}),
			404
		);
		rejects(
			() =>
				store.checkin(user, {
					unitId: 'unit-103',
					agentId: 'agent-other',
					guestName: 'Demo',
					nights: 1
				}),
			404
		);
		assert.equal(store.snapshot(user).bookings.length, 4);
	});
	it('does not accept forged role information from callers', () => {
		const forged = { ...store.user('fo-demo'), role: 'H' as const };
		rejects(() => store.addUnit(forged, { name: '999', type: 'Studio', rate: 280000 }), 403);
	});
	it('requires Front Office for check-in and checkout', () => {
		for (const id of ['host-demo', 'hk-demo', 'tech-demo']) {
			rejects(
				() =>
					store.checkin(store.user(id), {
						unitId: 'unit-103',
						agentId: 'agent-walkin',
						guestName: 'Demo',
						nights: 1
					}),
				403
			);
			rejects(() => store.checkout(store.user(id), 'unit-101'), 403);
		}
	});
	it('submits cleaning documentation and waits for Host approval', () => {
		const hk = store.user('hk-demo');
		const id = store.cleaning(hk, {
			unitId: 'unit-204',
			notes: 'Pemeriksaan demo selesai',
			roomImage: '/demo/room.svg',
			bathroomImage: '/demo/bathroom.svg'
		});
		assert.equal(store.snapshot(hk).cleanings.find((c) => c.id === id)?.status, 'Pending');
		assert.equal(store.snapshot(hk).units.find((u) => u.id === 'unit-204')?.state, 'StandBy');
		store.approveCleaning(store.user('host-demo'), id, true);
		assert.equal(store.snapshot(hk).units.find((u) => u.id === 'unit-204')?.state, 'Ready');
	});
	it('rejects duplicate or inappropriate cleaning submissions', () => {
		const hk = store.user('hk-demo');
		for (const unitId of ['unit-105', 'unit-103', 'unit-205'])
			rejects(() =>
				store.cleaning(hk, {
					unitId,
					notes: 'Demo',
					roomImage: '/demo/room.svg',
					bathroomImage: '/demo/bathroom.svg'
				})
			);
	});
	it('allows only Host to approve cleaning and scopes approvals to tenant', () => {
		rejects(() => store.approveCleaning(store.user('hk-demo'), 'clean-pending', true), 403);
		rejects(() => store.approveCleaning(store.user('other-host'), 'clean-pending', true), 404);
	});
	it('returns rejected cleaning to the housekeeping queue', () => {
		const host = store.user('host-demo');
		store.approveCleaning(host, 'clean-pending', false);
		assert.equal(
			store.snapshot(host).cleanings.find((c) => c.id === 'clean-pending')?.status,
			'Rejected'
		);
		assert.equal(store.snapshot(host).units.find((u) => u.id === 'unit-105')?.state, 'StandBy');
		const id = store.cleaning(store.user('hk-demo'), {
			unitId: 'unit-105',
			notes: 'Diperiksa ulang',
			roomImage: '/demo/room.svg',
			bathroomImage: '/demo/bathroom.svg'
		});
		assert.ok(id);
	});
	it('blocks approval when unit status changed after a severe issue', () => {
		store.reportIssue(store.user('fo-demo'), {
			unitId: 'unit-105',
			description: 'Gangguan berat demo',
			severe: true,
			image: '/demo/issue.svg'
		});
		rejects(() => store.approveCleaning(store.user('host-demo'), 'clean-pending', true));
		assert.equal(
			store.snapshot(store.user('host-demo')).units.find((u) => u.id === 'unit-105')?.state,
			'Closed'
		);
	});
	it('creates severe issues and makes vacant units unavailable', () => {
		store.reportIssue(store.user('hk-demo'), {
			unitId: 'unit-103',
			description: 'Listrik perlu diperiksa',
			severe: true,
			image: '/demo/issue.svg'
		});
		assert.equal(
			store.snapshot(store.user('host-demo')).units.find((u) => u.id === 'unit-103')?.state,
			'Closed'
		);
	});
	it('does not overwrite an occupied unit when an issue is reported', () => {
		store.reportIssue(store.user('fo-demo'), {
			unitId: 'unit-101',
			description: 'Gangguan fasilitas berat',
			severe: true,
			image: '/demo/issue.svg'
		});
		assert.equal(
			store.snapshot(store.user('fo-demo')).units.find((u) => u.id === 'unit-101')?.state,
			'Working'
		);
		store.checkout(store.user('fo-demo'), 'unit-101');
		assert.equal(
			store.snapshot(store.user('fo-demo')).units.find((u) => u.id === 'unit-101')?.state,
			'Closed'
		);
	});
	it('requires Technician to resolve issues and sends repaired rooms to cleaning', () => {
		rejects(() => store.resolveIssue(store.user('fo-demo'), 'issue-ac'), 403);
		store.resolveIssue(store.user('tech-demo'), 'issue-ac');
		const snapshot = store.snapshot(store.user('host-demo'));
		assert.equal(snapshot.issues.find((i) => i.id === 'issue-ac')?.done, 1);
		assert.equal(snapshot.units.find((u) => u.id === 'unit-205')?.state, 'StandBy');
		rejects(() => store.resolveIssue(store.user('tech-demo'), 'issue-ac'));
	});
	it('keeps rooms closed while another severe issue remains', () => {
		const id = store.reportIssue(store.user('hk-demo'), {
			unitId: 'unit-205',
			description: 'Gangguan kedua',
			severe: true,
			image: '/demo/issue.svg'
		});
		store.resolveIssue(store.user('tech-demo'), 'issue-ac');
		assert.equal(
			store.snapshot(store.user('host-demo')).units.find((u) => u.id === 'unit-205')?.state,
			'Closed'
		);
		store.resolveIssue(store.user('tech-demo'), id);
		assert.equal(
			store.snapshot(store.user('host-demo')).units.find((u) => u.id === 'unit-205')?.state,
			'StandBy'
		);
	});
	it('does not expose guest names and booking amounts to HK or Technician', () => {
		for (const id of ['hk-demo', 'tech-demo']) {
			const snapshot = store.snapshot(store.user(id));
			assert.equal(snapshot.bookings.length, 0);
			assert.equal(snapshot.agents.length, 0);
			assert.equal(snapshot.stats.revenue, 0);
			assert.ok(snapshot.units.every((u) => u.guest === null));
		}
	});
	it('records attendance once per Bangkok date for the current staff account', () => {
		const user = store.user('fo-demo');
		store.attend(user, '/demo/attendance.svg');
		rejects(() => store.attend(user, '/demo/attendance.svg'));
		const rows = store.snapshot(user).attendance.filter((a) => a.day === dayKey());
		assert.equal(rows.length, 1);
		assert.equal(rows[0].name, user.name);
		assert.equal(dayKey(new Date('2026-10-15T18:00:00Z')), '2026-10-16');
	});
	it('shows only own attendance to staff and all tenant attendance to Host', () => {
		store.attend(store.user('fo-demo'), '/demo/attendance.svg');
		const staff = store.snapshot(store.user('hk-demo'));
		assert.ok(staff.attendance.every((a) => a.name === 'Ratna Lestari'));
		assert.equal(store.snapshot(store.user('host-demo')).stats.present, 1);
	});
	it('creates staff with validated credentials and tenant-bound scope', () => {
		const host = store.user('host-demo');
		store.addStaff(host, {
			username: 'new.staff',
			name: 'Staf Demo',
			role: 'FO',
			email: 'new@example.test',
			password: 'Password123!'
		});
		const user = store.login('new.staff', 'Password123!').user;
		assert.equal(user.hostId, 'host-demo');
		assert.equal(user.role, 'FO');
		rejects(() =>
			store.addStaff(host, {
				username: 'new.host',
				name: 'Demo',
				role: 'H',
				email: 'other-new@example.test',
				password: 'Password123!'
			})
		);
	});
	it('disables staff sessions while preserving operational history', () => {
		const session = store.login('front.demo', DEMO_PASSWORD);
		store.disableStaff(store.user('host-demo'), 'fo-demo');
		assert.equal(store.session(session.token), null);
		rejects(() => store.login('front.demo', DEMO_PASSWORD));
		assert.equal(store.snapshot(store.user('host-demo')).bookings.length, 4);
		rejects(() => store.disableStaff(store.user('host-demo'), 'host-demo'), 404);
	});
	it('restricts staff management to the owning Host', () => {
		rejects(() => store.disableStaff(store.user('fo-demo'), 'hk-demo'), 403);
		rejects(() => store.disableStaff(store.user('other-host'), 'fo-demo'), 404);
	});
	it('validates new unit rates and avoids duplicate room names', () => {
		const host = store.user('host-demo');
		for (const rate of [0, -1, 12.5, 5000001, ''])
			rejects(() => store.addUnit(host, { name: '401', type: 'Studio', rate }));
		store.addUnit(host, { name: '401', type: 'Studio', rate: 300000 });
		rejects(() => store.addUnit(host, { name: '401', type: 'Studio', rate: 300000 }));
		assert.equal(store.snapshot(host).units.length, 13);
	});
	it('validates agent commission including zero commission', () => {
		const host = store.user('host-demo');
		store.addAgent(host, { name: 'Agen Demo', email: 'agent-new@example.test', commission: 0 });
		assert.ok(
			store.snapshot(host).agents.some((a) => a.name === 'Agen Demo' && a.commission === 0)
		);
		rejects(() => store.addAgent(host, { name: 'Bad', email: 'bad@example.test', commission: 51 }));
	});
	it('stores validated local images and enforces tenant access', () => {
		const png = Buffer.from(
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=',
			'base64'
		);
		const user = store.user('hk-demo');
		const url = store.saveMedia(user, png, 'image/png');
		const id = url.split('/').pop()!;
		assert.equal(store.readMedia(store.user('host-demo'), id).mime, 'image/png');
		rejects(() => store.readMedia(store.user('other-host'), id), 404);
		rejects(() => store.saveMedia(user, Buffer.from('<svg/>'), 'image/svg+xml'));
		rejects(() => store.saveMedia(user, new Uint8Array(2 * 1024 * 1024 + 1), 'image/png'));
	});
	it('rejects unknown, external or cross-tenant documentation paths', () => {
		const user = store.user('hk-demo');
		for (const image of ['https://example.com/a.png', '/demo/media/unknown', '../../secret'])
			rejects(() => store.attend(user, image));
	});
	it('exports server-side bookings with numeric prices and real date cells', async () => {
		const buffer = await exportWorkbook(store.snapshot(store.user('host-demo')), 'bookings');
		const book = new ExcelJS.Workbook();
		await book.xlsx.load(buffer as never);
		const sheet = book.getWorksheet('Tamu')!;
		assert.equal(sheet.rowCount, 5);
		assert.equal(typeof sheet.getCell('E2').value, 'number');
		assert.ok(sheet.getCell('G2').value instanceof Date);
		assert.ok(!JSON.stringify(sheet.getSheetValues()).includes('X01'));
	});
	it('exports issues and attendance from tenant-filtered data', async () => {
		for (const kind of ['issues', 'attendance']) {
			const buffer = await exportWorkbook(store.snapshot(store.user('host-demo')), kind);
			const book = new ExcelJS.Workbook();
			await book.xlsx.load(buffer as never);
			assert.equal(book.worksheets[0].rowCount, 4);
		}
	});
	it('resets dummy changes and sessions without touching external databases', () => {
		store.addUnit(store.user('host-demo'), { name: '401', type: 'Family', rate: 400000 });
		const session = store.login('front.demo', DEMO_PASSWORD);
		store.reset();
		assert.equal(store.snapshot(store.user('host-demo')).units.length, 12);
		assert.equal(store.session(session.token), null);
	});
});

describe('SQLite demo persistence', () => {
	it('keeps dummy changes across process-style reopen', () => {
		const dir = mkdtempSync(join(tmpdir(), 'roomqu-test-'));
		const filename = join(dir, 'demo.sqlite');
		try {
			const first = new DemoStore(filename);
			first.addUnit(first.user('host-demo'), { name: '401', type: 'Studio', rate: 300000 });
			first.close();
			const second = new DemoStore(filename);
			try {
				assert.equal(second.snapshot(second.user('host-demo')).units.length, 13);
			} finally {
				second.close();
			}
		} finally {
			assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep));
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
