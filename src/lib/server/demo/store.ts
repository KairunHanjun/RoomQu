import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

export type Role = 'H' | 'FO' | 'HK' | 'T';
export type State = 'Ready' | 'Working' | 'StandBy' | 'Closed';
export interface DemoUser {
	id: string;
	username: string;
	name: string;
	role: Role;
	hostId: string;
	email: string;
	phone: string;
	active: number;
}
export interface Unit {
	id: string;
	name: string;
	type: string;
	rate: number;
	state: State;
	guest: string | null;
	bookingId: string | null;
	checkoutAt: string | null;
}
export interface Agent {
	id: string;
	name: string;
	email: string;
	commission: number;
}
export interface Booking {
 durationLabel?: string;
	id: string;
	unitId: string;
	unitName: string;
	guestName: string;
	agentName: string;
	nights: number;
	amount: number;
	commission: number;
	checkinAt: string;
	checkoutAt: string;
	status: string;
}
export interface Issue {
	id: string;
	unitId: string;
	unitName: string;
	reporter: string;
	description: string;
	severe: number;
	done: number;
	image: string;
	createdAt: string;
	resolvedAt: string | null;
}
export interface Cleaning {
	id: string;
	unitId: string;
	unitName: string;
	reporter: string;
	roomImage: string;
	bathroomImage: string;
	notes: string;
	status: string;
	createdAt: string;
}
export interface Attendance {
	id: string;
	name: string;
	role: Role;
	day: string;
	createdAt: string;
	image: string;
}
export interface Snapshot {
	user: DemoUser;
	units: Unit[];
	agents: Agent[];
	bookings: Booking[];
	issues: Issue[];
	cleanings: Cleaning[];
	attendance: Attendance[];
	staff: DemoUser[];
	today: string;
	stats: {
		total: number;
		ready: number;
		occupied: number;
		cleaning: number;
		closed: number;
		revenue: number;
		openIssues: number;
		pendingCleaning: number;
		present: number;
	};
}
export class DemoError extends Error {
	status: number;
	constructor(message: string, status = 400) {
		super(message);
		this.status = status;
	}
}
export const DEMO_PASSWORD = 'DemoRoom123!';
export const roleNames: Record<Role, string> = {
	H: 'Host',
	FO: 'Front Office',
	HK: 'House Keeping',
	T: 'Teknisi'
};
export const roleAreas: Record<Role, string> = {
	H: 'host',
	FO: 'front-office',
	HK: 'housekeeping',
	T: 'technician'
};
export function dayKey(date = new Date()) {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Bangkok',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(date);
}
function check(valid: unknown, message: string, status = 400): asserts valid {
	if (!valid) throw new DemoError(message, status);
}
function text(value: unknown, label: string, max = 100) {
	check(
		typeof value === 'string' && value.trim().length > 0 && value.length <= max,
		`${label} wajib diisi, maksimal ${max} karakter.`
	);
	return value.trim();
}
function integer(value: unknown, min: number, max: number, label: string) {
	const result =
		typeof value === 'number'
			? value
			: typeof value === 'string' && value.trim() !== ''
				? Number(value)
				: NaN;
	check(
		Number.isSafeInteger(result) && result >= min && result <= max,
		`${label} harus bilangan bulat ${min}–${max}.`
	);
	return result;
}
export function passwordHash(password: string) {
	const salt = randomBytes(16).toString('hex');
	return `${salt}:${scryptSync(password, salt, 32).toString('hex')}`;
}
function passwordMatches(password: string, encoded: string) {
	const [salt, digest] = encoded.split(':');
	if (!salt || !digest) return false;
	const expected = Buffer.from(digest, 'hex');
	const actual = scryptSync(password, salt, 32);
	return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export class DemoStore {
	db: DatabaseSync;
	constructor(filename: string, seed = true) {
		if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
		this.db = new DatabaseSync(filename);
		this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('H','FO','HK','T')), host_id TEXT NOT NULL, email TEXT UNIQUE NOT NULL, phone TEXT NOT NULL, password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE IF NOT EXISTS units(id TEXT PRIMARY KEY, host_id TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, rate INTEGER NOT NULL CHECK(rate>0), state TEXT NOT NULL CHECK(state IN ('Ready','Working','StandBy','Closed')), UNIQUE(host_id,name));
      CREATE TABLE IF NOT EXISTS agents(id TEXT PRIMARY KEY, host_id TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, commission INTEGER NOT NULL CHECK(commission BETWEEN 0 AND 50), UNIQUE(host_id,name));
      CREATE TABLE IF NOT EXISTS bookings(id TEXT PRIMARY KEY, host_id TEXT NOT NULL, unit_id TEXT NOT NULL REFERENCES units(id), agent_id TEXT NOT NULL REFERENCES agents(id), guest_name TEXT NOT NULL, nights INTEGER NOT NULL, amount INTEGER NOT NULL, commission INTEGER NOT NULL, checkin_at TEXT NOT NULL, checkout_at TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('Active','Completed')));
      CREATE UNIQUE INDEX IF NOT EXISTS active_booking_per_unit ON bookings(unit_id) WHERE status='Active';
      CREATE TABLE IF NOT EXISTS issues(id TEXT PRIMARY KEY, unit_id TEXT NOT NULL REFERENCES units(id), reporter_id TEXT NOT NULL REFERENCES accounts(id), description TEXT NOT NULL, severe INTEGER NOT NULL, done INTEGER NOT NULL DEFAULT 0, image TEXT NOT NULL, created_at TEXT NOT NULL, resolved_at TEXT);
      CREATE TABLE IF NOT EXISTS cleanings(id TEXT PRIMARY KEY, unit_id TEXT NOT NULL REFERENCES units(id), reporter_id TEXT NOT NULL REFERENCES accounts(id), room_image TEXT NOT NULL, bathroom_image TEXT NOT NULL, notes TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('Pending','Approved','Rejected')), created_at TEXT NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS pending_cleaning_per_unit ON cleanings(unit_id) WHERE status='Pending';
      CREATE TABLE IF NOT EXISTS attendance(id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), day TEXT NOT NULL, created_at TEXT NOT NULL, image TEXT NOT NULL, UNIQUE(account_id,day));
      CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY, host_id TEXT NOT NULL, mime TEXT NOT NULL, content BLOB NOT NULL);
    `);
		if (seed && !this.db.prepare(`SELECT id FROM accounts LIMIT 1`).get()) this.seed();
	}
	close() {
		this.db.close();
	}
	transaction<T>(callback: () => T): T {
		this.db.exec('BEGIN IMMEDIATE');
		try {
			const result = callback();
			this.db.exec('COMMIT');
			return result;
		} catch (error) {
			this.db.exec('ROLLBACK');
			throw error;
		}
	}
	private seed() {
		this.transaction(() => {
			const hash = passwordHash(DEMO_PASSWORD);
			const addUser = this.db.prepare(
				`INSERT INTO accounts(id,username,name,role,host_id,email,phone,password_hash) VALUES(?,?,?,?,?,?,?,?)`
			);
			for (const [id, username, name, role, host] of [
				['host-demo', 'host.demo', 'Nadia Prameswari', 'H', 'host-demo'],
				['fo-demo', 'front.demo', 'Dimas Saputra', 'FO', 'host-demo'],
				['hk-demo', 'clean.demo', 'Ratna Lestari', 'HK', 'host-demo'],
				['tech-demo', 'tech.demo', 'Bima Mahendra', 'T', 'host-demo'],
				['other-host', 'other.host', 'Host Contoh Lain', 'H', 'other-host'],
				['other-fo', 'other.front', 'Staf Contoh Lain', 'FO', 'other-host']
			])
				addUser.run(id, username, name, role, host, `${username}@example.test`, '0000000000', hash);
			const addUnit = this.db.prepare(`INSERT INTO units VALUES(?,?,?,?,?,?)`);
			for (const [name, type, rate, state] of [
				['101', 'Studio', 280000, 'Working'],
				['102', 'Deluxe', 350000, 'Working'],
				['103', 'Studio', 280000, 'Ready'],
				['104', 'Family', 450000, 'Ready'],
				['105', 'Deluxe', 350000, 'StandBy'],
				['201', 'Deluxe', 350000, 'Working'],
				['202', 'Studio', 280000, 'Ready'],
				['203', 'Family', 450000, 'Ready'],
				['204', 'Studio', 280000, 'StandBy'],
				['205', 'Deluxe', 350000, 'Closed'],
				['301', 'Family', 450000, 'Ready'],
				['302', 'Deluxe', 350000, 'Closed']
			])
				addUnit.run(`unit-${name}`, 'host-demo', name, type, rate, state);
			addUnit.run('unit-other', 'other-host', 'X01', 'Studio', 250000, 'Ready');
			this.db
				.prepare(`INSERT INTO agents VALUES(?,?,?,?,?)`)
				.run('agent-walkin', 'host-demo', 'Walk-in', 'walkin@example.test', 0);
			this.db
				.prepare(`INSERT INTO agents VALUES(?,?,?,?,?)`)
				.run('agent-urban', 'host-demo', 'Urban Stay', 'urban@example.test', 10);
			this.db
				.prepare(`INSERT INTO agents VALUES(?,?,?,?,?)`)
				.run('agent-raya', 'host-demo', 'Raya Travel', 'raya@example.test', 8);
			this.db
				.prepare(`INSERT INTO agents VALUES(?,?,?,?,?)`)
				.run('agent-other', 'other-host', 'Agen Lain', 'other@example.test', 5);
			const now = new Date();
			const yesterday = new Date(now.getTime() - 86400000).toISOString();
			const checkout = new Date(now.getTime() + 86400000).toISOString();
			const addBooking = this.db.prepare(`INSERT INTO bookings VALUES(?,?,?,?,?,?,?,?,?,?,?)`);
			for (const [unit, guest, agent, amount] of [
				['101', 'Alya Putri (Demo)', 'agent-urban', 560000],
				['102', 'Raka Wijaya (Demo)', 'agent-walkin', 700000],
				['201', 'Citra Amalia (Demo)', 'agent-raya', 700000]
			])
				addBooking.run(
					`booking-${unit}`,
					'host-demo',
					`unit-${unit}`,
					agent,
					guest,
					2,
					amount,
					agent === 'agent-urban' ? 56000 : agent === 'agent-raya' ? 56000 : 0,
					yesterday,
					checkout,
					'Active'
				);
			addBooking.run(
				'booking-history',
				'host-demo',
				'unit-103',
				'agent-walkin',
				'Fajar Pratama (Demo)',
				1,
				280000,
				0,
				new Date(now.getTime() - 172800000).toISOString(),
				yesterday,
				'Completed'
			);
			const issue = this.db.prepare(`INSERT INTO issues VALUES(?,?,?,?,?,?,?,?,?)`);
			issue.run(
				'issue-ac',
				'unit-205',
				'hk-demo',
				'AC tidak dingin; perlu pemeriksaan filter dan refrigeran.',
				1,
				0,
				'/demo/issue.svg',
				yesterday,
				null
			);
			issue.run(
				'issue-light',
				'unit-302',
				'fo-demo',
				'Lampu kamar mandi perlu diganti.',
				1,
				0,
				'/demo/issue.svg',
				yesterday,
				null
			);
			issue.run(
				'issue-handle',
				'unit-201',
				'fo-demo',
				'Pegangan lemari longgar; dapat diperbaiki setelah tamu keluar.',
				0,
				0,
				'/demo/issue.svg',
				now.toISOString(),
				null
			);
			this.db
				.prepare(`INSERT INTO cleanings VALUES(?,?,?,?,?,?,?,?)`)
				.run(
					'clean-pending',
					'unit-105',
					'hk-demo',
					'/demo/room.svg',
					'/demo/bathroom.svg',
					'Linen diganti, lantai dan kamar mandi sudah dibersihkan.',
					'Pending',
					now.toISOString()
				);
			this.db
				.prepare(`INSERT INTO cleanings VALUES(?,?,?,?,?,?,?,?)`)
				.run(
					'clean-approved',
					'unit-103',
					'hk-demo',
					'/demo/room.svg',
					'/demo/bathroom.svg',
					'Pemeriksaan kebersihan selesai.',
					'Approved',
					yesterday
				);
			for (const id of ['fo-demo', 'hk-demo', 'tech-demo'])
				this.db
					.prepare(`INSERT INTO attendance VALUES(?,?,?,?,?)`)
					.run(randomUUID(), id, dayKey(new Date(yesterday)), yesterday, '/demo/attendance.svg');
		});
	}
	reset() {
		this.transaction(() => {
			for (const table of [
				'sessions',
				'media',
				'attendance',
				'cleanings',
				'issues',
				'bookings',
				'agents',
				'units',
				'accounts'
			])
				this.db.exec(`DELETE FROM ${table}`);
		});
		this.seed();
	}
	user(id: string): DemoUser {
		const row = this.db
			.prepare(
				`SELECT id,username,name,role,host_id AS hostId,email,phone,active FROM accounts WHERE id=? AND active=1`
			)
			.get(id) as unknown as DemoUser | undefined;
		check(row, 'Akun tidak ditemukan.', 401);
		return row;
	}
	private requireRole(user: DemoUser, roles: Role[]) {
		const current = this.user(user.id);
		check(roles.includes(current.role), 'Anda tidak memiliki akses untuk tindakan ini.', 403);
		return current;
	}
	private unit(user: DemoUser, id: string) {
		const row = this.db
			.prepare(`SELECT * FROM units WHERE id=? AND host_id=?`)
			.get(id, user.hostId);
		check(row, 'Unit tidak ditemukan.', 404);
		return row as unknown as { id: string; name: string; type: string; rate: number; state: State };
	}
	login(username: string, password: string) {
		const row = this.db
			.prepare(`SELECT id,password_hash FROM accounts WHERE username=? AND active=1`)
			.get(username.trim().toLowerCase()) as { id: string; password_hash: string } | undefined;
		const hash = row?.password_hash ?? `00000000000000000000000000000000:${'0'.repeat(64)}`;
		check(
			password.length <= 200 && passwordMatches(password, hash) && row,
			'Username atau kata sandi salah.',
			400
		);
		const token = randomBytes(32).toString('hex');
		const expires = Date.now() + 8 * 60 * 60 * 1000;
		this.db
			.prepare(`INSERT INTO sessions VALUES(?,?,?)`)
			.run(createHash('sha256').update(token).digest('hex'), row.id, expires);
		return { token, expires, user: this.user(row.id) };
	}
	session(token: string): DemoUser | null {
		if (!/^[a-f0-9]{64}$/.test(token)) return null;
		const hash = createHash('sha256').update(token).digest('hex');
		const row = this.db
			.prepare(`SELECT account_id,expires_at FROM sessions WHERE token_hash=?`)
			.get(hash) as { account_id: string; expires_at: number } | undefined;
		if (!row) return null;
		if (row.expires_at <= Date.now()) {
			this.logout(token);
			return null;
		}
		try {
			return this.user(row.account_id);
		} catch {
			return null;
		}
	}
	logout(token: string) {
		this.db
			.prepare(`DELETE FROM sessions WHERE token_hash=?`)
			.run(createHash('sha256').update(token).digest('hex'));
	}
	snapshot(user: DemoUser): Snapshot {
		user = this.user(user.id);
		const privileged = user.role === 'H' || user.role === 'FO';
		const units = this.db
			.prepare(
				`SELECT u.id,u.name,u.type,u.rate,u.state,b.guest_name AS guest,b.id AS bookingId,b.checkout_at AS checkoutAt FROM units u LEFT JOIN bookings b ON b.unit_id=u.id AND b.status='Active' WHERE u.host_id=? ORDER BY u.name`
			)
			.all(user.hostId) as unknown as Unit[];
		if (!privileged) for (const unit of units) unit.guest = null;
		const agents = privileged
			? (this.db
					.prepare(`SELECT id,name,email,commission FROM agents WHERE host_id=? ORDER BY name`)
					.all(user.hostId) as unknown as Agent[])
			: [];
		const bookings = privileged
			? (this.db
					.prepare(
						`SELECT b.id,b.unit_id AS unitId,u.name AS unitName,b.guest_name AS guestName,a.name AS agentName,b.nights,b.amount,b.commission,b.checkin_at AS checkinAt,b.checkout_at AS checkoutAt,b.status FROM bookings b JOIN units u ON u.id=b.unit_id JOIN agents a ON a.id=b.agent_id WHERE b.host_id=? ORDER BY b.checkin_at DESC`
					)
					.all(user.hostId) as unknown as Booking[])
			: [];
		const issues = this.db
			.prepare(
				`SELECT i.id,i.unit_id AS unitId,u.name AS unitName,a.name AS reporter,i.description,i.severe,i.done,i.image,i.created_at AS createdAt,i.resolved_at AS resolvedAt FROM issues i JOIN units u ON u.id=i.unit_id JOIN accounts a ON a.id=i.reporter_id WHERE u.host_id=? ORDER BY i.done,i.created_at DESC`
			)
			.all(user.hostId) as unknown as Issue[];
		const cleanings = this.db
			.prepare(
				`SELECT c.id,c.unit_id AS unitId,u.name AS unitName,a.name AS reporter,c.room_image AS roomImage,c.bathroom_image AS bathroomImage,c.notes,c.status,c.created_at AS createdAt FROM cleanings c JOIN units u ON u.id=c.unit_id JOIN accounts a ON a.id=c.reporter_id WHERE u.host_id=? ORDER BY c.created_at DESC`
			)
			.all(user.hostId) as unknown as Cleaning[];
		const attendance = this.db
			.prepare(
				`SELECT d.id,a.name,a.role,d.day,d.created_at AS createdAt,d.image FROM attendance d JOIN accounts a ON a.id=d.account_id WHERE a.host_id=? ${user.role === 'H' ? '' : 'AND a.id=?'} ORDER BY d.created_at DESC`
			)
			.all(
				...(user.role === 'H' ? [user.hostId] : [user.hostId, user.id])
			) as unknown as Attendance[];
		const staff =
			user.role === 'H'
				? (this.db
						.prepare(
							`SELECT id,username,name,role,host_id AS hostId,email,phone,active FROM accounts WHERE host_id=? AND role!='H' ORDER BY role,name`
						)
						.all(user.hostId) as unknown as DemoUser[])
				: [];
		return {
			user,
			units,
			agents,
			bookings,
			issues,
			cleanings,
			attendance,
			staff,
			today: dayKey(),
			stats: {
				total: units.length,
				ready: units.filter((u) => u.state === 'Ready').length,
				occupied: units.filter((u) => u.state === 'Working').length,
				cleaning: units.filter((u) => u.state === 'StandBy').length,
				closed: units.filter((u) => u.state === 'Closed').length,
				revenue: bookings.reduce((sum, b) => sum + b.amount, 0),
				openIssues: issues.filter((i) => !i.done).length,
				pendingCleaning: cleanings.filter((c) => c.status === 'Pending').length,
				present: attendance.filter((a) => a.day === dayKey()).length
			}
		};
	}
	checkin(
		user: DemoUser,
		input: { unitId: string; agentId: string; guestName: string; nights: unknown }
	) {
		user = this.requireRole(user, ['FO']);
		const guest = text(input.guestName, 'Nama tamu');
		const nights = integer(input.nights, 1, 30, 'Durasi menginap');
		return this.transaction(() => {
			const unit = this.unit(user, input.unitId);
			check(unit.state === 'Ready', 'Unit harus berstatus Siap sebelum tamu masuk.');
			const agent = this.db
				.prepare(`SELECT commission FROM agents WHERE id=? AND host_id=?`)
				.get(input.agentId, user.hostId) as { commission: number } | undefined;
			check(agent, 'Agen tidak ditemukan.', 404);
			check(
				!this.db
					.prepare(`SELECT id FROM issues WHERE unit_id=? AND severe=1 AND done=0`)
					.get(unit.id),
				'Unit masih memiliki masalah berat.'
			);
			const now = new Date();
			const id = randomUUID();
			const amount = unit.rate * nights;
			this.db
				.prepare(`INSERT INTO bookings VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
				.run(
					id,
					user.hostId,
					unit.id,
					input.agentId,
					guest,
					nights,
					amount,
					Math.round((amount * agent.commission) / 100),
					now.toISOString(),
					new Date(now.getTime() + nights * 86400000).toISOString(),
					'Active'
				);
			this.db.prepare(`UPDATE units SET state='Working' WHERE id=?`).run(unit.id);
			return id;
		});
	}
	checkout(user: DemoUser, unitId: string) {
		user = this.requireRole(user, ['FO']);
		this.transaction(() => {
			const unit = this.unit(user, unitId);
			check(unit.state === 'Working', 'Unit tidak sedang ditempati.');
			const result = this.db
				.prepare(
					`UPDATE bookings SET status='Completed',checkout_at=? WHERE unit_id=? AND status='Active'`
				)
				.run(new Date().toISOString(), unitId);
			check(result.changes === 1, 'Data tamu aktif tidak ditemukan.');
			const blocked = this.db
				.prepare(`SELECT id FROM issues WHERE unit_id=? AND severe=1 AND done=0`)
				.get(unitId);
			this.db
				.prepare(`UPDATE units SET state=? WHERE id=?`)
				.run(blocked ? 'Closed' : 'StandBy', unitId);
		});
	}
	cleaning(
		user: DemoUser,
		input: { unitId: string; notes: string; roomImage: string; bathroomImage: string }
	) {
		user = this.requireRole(user, ['HK']);
		const notes = text(input.notes, 'Catatan kebersihan', 500);
		this.validateImage(user, input.roomImage);
		this.validateImage(user, input.bathroomImage);
		return this.transaction(() => {
			const unit = this.unit(user, input.unitId);
			check(unit.state === 'StandBy', 'Hanya unit Menunggu bersih yang bisa diajukan.');
			check(
				!this.db
					.prepare(`SELECT id FROM cleanings WHERE unit_id=? AND status='Pending'`)
					.get(unit.id),
				'Unit ini sudah menunggu persetujuan Host.'
			);
			const id = randomUUID();
			this.db
				.prepare(`INSERT INTO cleanings VALUES(?,?,?,?,?,?,?,?)`)
				.run(
					id,
					unit.id,
					user.id,
					input.roomImage,
					input.bathroomImage,
					notes,
					'Pending',
					new Date().toISOString()
				);
			return id;
		});
	}
	approveCleaning(user: DemoUser, id: string, approve: boolean) {
		user = this.requireRole(user, ['H']);
		this.transaction(() => {
			const row = this.db
				.prepare(
					`SELECT c.unit_id,c.status FROM cleanings c JOIN units u ON u.id=c.unit_id WHERE c.id=? AND u.host_id=?`
				)
				.get(id, user.hostId) as { unit_id: string; status: string } | undefined;
			check(row, 'Laporan kebersihan tidak ditemukan.', 404);
			check(row.status === 'Pending', 'Laporan sudah diproses.');
			const unit = this.unit(user, row.unit_id);
			check(unit.state === 'StandBy', 'Status unit sudah berubah.');
			if (approve)
				check(
					!this.db
						.prepare(`SELECT id FROM issues WHERE unit_id=? AND severe=1 AND done=0`)
						.get(unit.id),
					'Selesaikan masalah berat sebelum menyetujui kebersihan.'
				);
			this.db
				.prepare(`UPDATE cleanings SET status=? WHERE id=?`)
				.run(approve ? 'Approved' : 'Rejected', id);
			if (approve) this.db.prepare(`UPDATE units SET state='Ready' WHERE id=?`).run(unit.id);
		});
	}
	reportIssue(
		user: DemoUser,
		input: { unitId: string; description: string; severe: boolean; image: string }
	) {
		user = this.requireRole(user, ['FO', 'HK', 'T']);
		const description = text(input.description, 'Penjelasan masalah', 500);
		this.validateImage(user, input.image);
		return this.transaction(() => {
			const unit = this.unit(user, input.unitId);
			const id = randomUUID();
			this.db
				.prepare(`INSERT INTO issues VALUES(?,?,?,?,?,?,?,?,?)`)
				.run(
					id,
					unit.id,
					user.id,
					description,
					input.severe ? 1 : 0,
					0,
					input.image,
					new Date().toISOString(),
					null
				);
			if (input.severe && unit.state !== 'Working') {
				this.db.prepare(`UPDATE units SET state='Closed' WHERE id=?`).run(unit.id);
				this.db
					.prepare(`UPDATE cleanings SET status='Rejected' WHERE unit_id=? AND status='Pending'`)
					.run(unit.id);
			}
			return id;
		});
	}
	resolveIssue(user: DemoUser, id: string) {
		user = this.requireRole(user, ['T']);
		this.transaction(() => {
			const row = this.db
				.prepare(
					`SELECT i.unit_id,i.done FROM issues i JOIN units u ON u.id=i.unit_id WHERE i.id=? AND u.host_id=?`
				)
				.get(id, user.hostId) as { unit_id: string; done: number } | undefined;
			check(row, 'Laporan masalah tidak ditemukan.', 404);
			check(!row.done, 'Masalah sudah diselesaikan.');
			this.db
				.prepare(`UPDATE issues SET done=1,resolved_at=? WHERE id=?`)
				.run(new Date().toISOString(), id);
			const open = this.db
				.prepare(`SELECT id FROM issues WHERE unit_id=? AND severe=1 AND done=0`)
				.get(row.unit_id);
			if (!open)
				this.db
					.prepare(`UPDATE units SET state='StandBy' WHERE id=? AND state='Closed'`)
					.run(row.unit_id);
		});
	}
	attend(user: DemoUser, image: string) {
		user = this.requireRole(user, ['FO', 'HK', 'T']);
		this.validateImage(user, image);
		check(
			!this.db
				.prepare(`SELECT id FROM attendance WHERE account_id=? AND day=?`)
				.get(user.id, dayKey()),
			'Anda sudah melakukan absensi hari ini.'
		);
		this.db
			.prepare(`INSERT INTO attendance VALUES(?,?,?,?,?)`)
			.run(randomUUID(), user.id, dayKey(), new Date().toISOString(), image);
	}
	addUnit(user: DemoUser, input: { name: string; type: string; rate: unknown }) {
		user = this.requireRole(user, ['H']);
		const name = text(input.name, 'Nama unit', 20);
		const type = text(input.type, 'Tipe unit', 30);
		const rate = integer(input.rate, 10000, 5000000, 'Tarif per malam');
		check(
			!this.db.prepare(`SELECT id FROM units WHERE host_id=? AND name=?`).get(user.hostId, name),
			'Nama unit sudah terdaftar.'
		);
		this.db
			.prepare(`INSERT INTO units VALUES(?,?,?,?,?,?)`)
			.run(randomUUID(), user.hostId, name, type, rate, 'Ready');
	}
	addAgent(user: DemoUser, input: { name: string; email: string; commission: unknown }) {
		user = this.requireRole(user, ['H']);
		const name = text(input.name, 'Nama agen');
		const email = text(input.email, 'Email', 150);
		check(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Format email tidak valid.');
		const commission = integer(input.commission, 0, 50, 'Komisi');
		check(
			!this.db.prepare(`SELECT id FROM agents WHERE host_id=? AND name=?`).get(user.hostId, name),
			'Nama agen sudah terdaftar.'
		);
		this.db
			.prepare(`INSERT INTO agents VALUES(?,?,?,?,?)`)
			.run(randomUUID(), user.hostId, name, email, commission);
	}
	addStaff(
		user: DemoUser,
		input: { username: string; name: string; role: string; email: string; password: string }
	) {
		user = this.requireRole(user, ['H']);
		check(
			/^[a-z0-9._-]{3,30}$/.test(input.username),
			'Username harus 3–30 karakter huruf kecil, angka, titik, atau garis.'
		);
		check(['FO', 'HK', 'T'].includes(input.role), 'Pilih peran staf yang valid.');
		const name = text(input.name, 'Nama staf');
		const email = text(input.email, 'Email', 150);
		check(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Format email tidak valid.');
		check(
			input.password.length >= 8 && Buffer.byteLength(input.password) <= 72,
			'Kata sandi harus 8–72 byte.'
		);
		check(
			!this.db
				.prepare(`SELECT id FROM accounts WHERE username=? OR email=?`)
				.get(input.username, email),
			'Username atau email sudah terdaftar.'
		);
		this.db
			.prepare(`INSERT INTO accounts VALUES(?,?,?,?,?,?,?,?,1)`)
			.run(
				randomUUID(),
				input.username,
				name,
				input.role,
				user.hostId,
				email,
				'0000000000',
				passwordHash(input.password)
			);
	}
	disableStaff(user: DemoUser, id: string) {
		user = this.requireRole(user, ['H']);
		this.transaction(() => {
			const target = this.db
				.prepare(`SELECT id FROM accounts WHERE id=? AND host_id=? AND role!='H' AND active=1`)
				.get(id, user.hostId);
			check(target, 'Staf aktif tidak ditemukan.', 404);
			this.db.prepare(`UPDATE accounts SET active=0 WHERE id=?`).run(id);
			this.db.prepare(`DELETE FROM sessions WHERE account_id=?`).run(id);
		});
	}
	validateImage(user: DemoUser, path: string) {
		if (
			['/demo/room.svg', '/demo/bathroom.svg', '/demo/issue.svg', '/demo/attendance.svg'].includes(
				path
			)
		)
			return;
		const match = /^\/demo\/media\/([a-f0-9-]{36})$/.exec(path);
		check(
			match &&
				this.db.prepare(`SELECT id FROM media WHERE id=? AND host_id=?`).get(match[1], user.hostId),
			'Gambar tidak ditemukan pada demo ini.'
		);
	}
	saveMedia(user: DemoUser, content: Uint8Array, mime: string) {
		user = this.requireRole(user, ['FO', 'HK', 'T']);
		check(content.length > 0 && content.length <= 2 * 1024 * 1024, 'Ukuran gambar maksimal 2 MB.');
		const data = Buffer.from(content);
		const valid =
			mime === 'image/png'
				? data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
				: mime === 'image/jpeg'
					? data[0] === 255 && data[1] === 216 && data[2] === 255
					: mime === 'image/webp'
						? data.subarray(0, 4).toString() === 'RIFF' &&
							data.subarray(8, 12).toString() === 'WEBP'
						: false;
		check(valid, 'Gunakan gambar PNG, JPEG, atau WebP yang valid.');
		const id = randomUUID();
		this.db.prepare(`INSERT INTO media VALUES(?,?,?,?)`).run(id, user.hostId, mime, data);
		return `/demo/media/${id}`;
	}
	readMedia(user: DemoUser, id: string) {
		const row = this.db
			.prepare(`SELECT mime,content FROM media WHERE id=? AND host_id=?`)
			.get(id, this.user(user.id).hostId) as { mime: string; content: Uint8Array } | undefined;
		check(row, 'Gambar tidak ditemukan.', 404);
		return row;
	}
}
let store: DemoStore | undefined;
export function getStore() {
	return (store ??= new DemoStore(
		resolve(process.env.ROOMQU_DEMO_DIR || '.demo', 'roomqu.sqlite')
	));
}
