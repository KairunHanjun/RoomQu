import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
	accounts,
	agents,
	units,
	customers,
	kebersihan,
	masalah,
	absensi
} from '$lib/server/db/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';
import type { Snapshot, DemoUser, Role, State } from '$lib/server/demo/store';
import type { RequestEvent } from '@sveltejs/kit';
export const tabs: Record<Role, string[]> = {
	H: ['overview', 'units', 'bookings', 'cleaning', 'issues', 'attendance', 'staff', 'agents'],
	FO: ['overview', 'units', 'bookings', 'issues', 'attendance'],
	HK: ['overview', 'units', 'cleaning', 'issues', 'attendance'],
	T: ['overview', 'units', 'issues', 'attendance']
};
export function owner(event: RequestEvent) {
	const u = event.locals.user;
	if (!u) error(401, 'Silakan masuk.');
	return u.accountType === 'H' ? u.username : u.createdByWho;
}
export const day = (d: Date) =>
	new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Bangkok',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(d);
export async function snapshot(event: RequestEvent): Promise<Snapshot> {
	const who = owner(event),
		user = event.locals.user!;
	const [team, rooms, partner, guests, issues, cleanings, attendance] = await Promise.all([
		db.select().from(accounts).where(eq(accounts.createdByWho, who)),
		db.select().from(units).where(eq(units.createdByWho, who)),
		db.select().from(agents).where(eq(agents.createdByWho, who)),
		db
			.select()
			.from(customers)
			.where(eq(customers.hostName, who))
			.orderBy(desc(customers.fromTime)),
		db
			.select({ issue: masalah, unitName: units.nameUnit })
			.from(masalah)
			.innerJoin(units, eq(masalah.unitId, units.id))
			.where(eq(units.createdByWho, who))
			.orderBy(desc(masalah.when)),
		db
			.select({ item: kebersihan, unit: units })
			.from(units)
			.innerJoin(kebersihan, eq(units.kebersihan, kebersihan.id))
			.where(eq(units.createdByWho, who)),
		db
			.select({ item: absensi })
			.from(absensi)
			.innerJoin(accounts, eq(absensi.name, accounts.username))
			.where(
				and(
					eq(accounts.createdByWho, who),
					...(user.accountType === 'H' ? [] : [eq(absensi.name, user.username)])
				)
			)
			.orderBy(desc(absensi.whenEntry))
	]);
	rooms.sort((a, b) => a.nameUnit.localeCompare(b.nameUnit, undefined, { numeric: true }));
	const asUser = (a: (typeof team)[number]): DemoUser => ({
		id: a.id,
		username: a.username,
		name: a.username,
		role: a.accountType,
		hostId: who,
		email: a.email,
		phone: a.phoneNumber || '',
		active: 1
	});
	const current = team.find((a) => a.id === user.id);
	if (!current) error(403, 'Akun tidak termasuk properti ini.');
	const seeGuests = ['H', 'FO'].includes(user.accountType);
	const today = day(new Date());
	const data: Snapshot = {
		user: asUser(current),
		today,
		units: rooms.map((u) => {
			const g = guests.find((g) => g.unitId === u.id && u.unitState === 'Working');
			return {
				id: u.id,
				name: u.nameUnit,
				type: 'Unit',
				rate: 0,
				state: (u.unitState || 'Ready') as State,
				guest: seeGuests ? g?.customersName || null : null,
				bookingId: g?.idCostumers || null,
				checkoutAt: u.toTime?.toISOString() || null
			};
		}),
		agents: seeGuests
			? partner.map((a) => ({ id: a.id, name: a.nameAgent, email: a.email, commission: 0 }))
			: [],
		bookings: seeGuests
			? guests.map((g) => ({
					id: g.idCostumers,
					unitId: g.unitId || '',
					unitName: rooms.find((u) => u.id === g.unitId)?.nameUnit || 'Riwayat',
					guestName: g.customersName,
					agentName: partner.find((a) => a.id === g.agent)?.nameAgent || '',
					nights: g.duration,
					durationLabel: g.duration + ' ' + (g.durationDays ? 'hari' : 'jam'),
					amount: g.price,
					commission: g.komisi,
					checkinAt: new Date(g.fromTime).toISOString(),
					checkoutAt: new Date(g.toTime).toISOString(),
					status:
						g.unitId && rooms.find((u) => u.id === g.unitId)?.unitState === 'Working'
							? 'Active'
							: 'Completed'
				}))
			: [],
		issues: issues.map(({ issue: i, unitName }) => ({
			id: i.id,
			unitId: i.unitId || '',
			unitName,
			reporter: i.name,
			description: i.desc,
			severe: Number(i.berat),
			done: Number(i.done),
			image: i.imageUrl,
			createdAt: i.when.toISOString(),
			resolvedAt: null
		})),
		cleanings: cleanings.map(({ item: i, unit: u }) => ({
			id: i.id,
			unitId: u.id,
			unitName: u.nameUnit,
			reporter: i.name,
			roomImage: i.gambarRuangan,
			bathroomImage: i.gambarKamarMandi,
			notes: 'Dokumentasi dari backend asli RoomQu.',
			status: u.pending ? 'Pending' : i.approve === false ? 'Rejected' : 'Approved',
			createdAt: i.when.toISOString()
		})),
		attendance: attendance.map(({ item: i }) => ({
			id: i.id,
			name: i.name,
			role: i.accountType,
			day: day(i.whenEntry),
			createdAt: i.whenEntry.toISOString(),
			image: i.fotoUrl
		})),
		staff: user.accountType === 'H' ? team.filter((a) => a.accountType !== 'H').map(asUser) : [],
		stats: {
			total: rooms.length,
			ready: rooms.filter((u) => u.unitState === 'Ready').length,
			occupied: rooms.filter((u) => u.unitState === 'Working').length,
			cleaning: rooms.filter((u) => u.unitState === 'StandBy').length,
			closed: rooms.filter((u) => u.unitState === 'Closed').length,
			revenue: seeGuests ? guests.reduce((s, g) => s + g.price, 0) : 0,
			openIssues: issues.filter(({ issue: i }) => !i.done).length,
			pendingCleaning: cleanings.filter(({ unit: u }) => u.pending).length,
			present: new Set(
				attendance.filter(({ item: i }) => day(i.whenEntry) === today).map(({ item: i }) => i.name)
			).size
		}
	};
	return data;
}
export async function loadIntegrated(event: RequestEvent) {
	const u = event.locals.user;
	if (!u) error(401, 'Silakan masuk.');
	if (event.url.pathname !== '/User/' + u.accountType) error(403, 'Peran tidak sesuai.');
	const view = event.url.searchParams.get('view') || 'overview';
	if (!tabs[u.accountType].includes(view)) error(403, 'Menu tidak tersedia.');
	return { snapshot: await snapshot(event), view };
}
