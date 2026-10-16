// routes/signup/+page.server.ts

import { fail, redirect } from "@sveltejs/kit";
import type { Actions, ServerLoad as PageServerLoad } from '@sveltejs/kit';
import { hash } from "argon2";
import { generateIdFromEntropySize } from "lucia";
import { db } from "$lib/server/db";
import { absensi, accounts, agents, customers, kebersihan, masalah, units } from "$lib/server/db/schema";
import { eq, ne, and } from "drizzle-orm/sql/expressions/conditions";
import { asc, desc } from "drizzle-orm";

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || locals.user.accountType !== 'H') {
		throw redirect(302, '/');
	}
	try {
		const [
			dataAkun,
			dataUnits,
			dataAgents,
			dataMasalah,
			dataAbsensi,
			dataKebersihan,
			dataCustomers,
		] = await Promise.all([
			db.select({
				id: accounts.id,
				username: accounts.username,
				accountType: accounts.accountType
			}).from(accounts).where(and(ne(accounts.accountType, 'H'), eq(accounts.createdByWho, locals.user.username))),
			db.select().from(units).where(eq(units.createdByWho, locals.user.username)).orderBy(asc(units.unitState)),
			db.select().from(agents).where(eq(agents.createdByWho, locals.user.username)),
			db
			.select({
				id: masalah.id,
				unitId: masalah.unitId,
				desc: masalah.desc,
				imageUrl: masalah.imageUrl,
				when: masalah.when,
				berat: masalah.berat,
				done: masalah.done
			})
			.from(masalah)
			.leftJoin(units, eq(masalah.unitId, units.id))
			.innerJoin(accounts, eq(units.createdByWho, accounts.username))
			.where(eq(accounts.createdByWho, locals.user.createdByWho)),
			db
			.select({
				id: absensi.id,
				name: absensi.name,
				accountType: absensi.accountType,
				when: absensi.whenEntry,
				fotoUrl: absensi.fotoUrl
			})
			.from(absensi)
			.innerJoin(accounts, eq(absensi.name, accounts.username))
			.where(eq(accounts.createdByWho, locals.user.username)),
			db
			.select({
				id: kebersihan.id,
				when: kebersihan.when,
				imgRuang: kebersihan.gambarRuangan,
				imgMandi: kebersihan.gambarKamarMandi,
				approve: kebersihan.approve
			})
			.from(units)
			.innerJoin(kebersihan, eq(units.kebersihan, kebersihan.id))
			.innerJoin(accounts, eq(kebersihan.name, accounts.username))
			.where(and(eq(accounts.createdByWho, units.createdByWho))),
			db
			.select({
				id: customers.idCostumers,
				customersName: customers.customersName,
				hostName: customers.hostName,
				price: customers.price,
				duration: customers.duration,
				agents: agents.nameAgent,
				fromTime: customers.fromTime,
				toTime: customers.toTime,
				commision: customers.komisi
			})
			.from(customers)
			.innerJoin(accounts, eq(customers.hostName, accounts.username))
			.innerJoin(agents, eq(agents.id, customers.agent))
			.where(eq(accounts.createdByWho, locals.user.createdByWho)),

		]);
		const userNow = locals.user;
		return {
			dataAkun,
			dataUnits,
			dataAgents,
			dataKebersihan,
			dataAbsensi,
			dataMasalah,
			dataCustomers,
			userNow
		}
	} catch (error) {
		//console.log((error as Error).cause || '');
		return {
			error: (error as Error).name,
			description: (error as Error).message
		}
	}
}

export const actions: Actions = {
	approve: async (event) => {
		const fromData: FormData = await event.request.formData();
		const unitId: string = fromData.get('unitId')?.toString() ?? '';
		const kebersihanId: string = fromData.get('kebersihanId')?.toString() ?? '';
		const approve: boolean = ((fromData.get('approve')?.toString() ?? '') == "Terima") ? true : false;
		try {
			if(approve){
				const check_kebersihan = await db.select().from(kebersihan).where(eq(kebersihan.id, kebersihanId));
				if(check_kebersihan.length === 0){
					return fail(422, {
						success: false,
						message: "Data telah disetujui dari tempat lain",
						error: "Already Approve",
					});
				}
				const customers_get = await db
				.select()
				.from(customers)
				.where(eq(customers.unitId, unitId))
				.orderBy(desc(customers.fromTime))
				.limit(1);
				await db.update(units).set({
					kebersihan: null,
					pending: false,
					unitState: 'Ready',
					fromTime: null,
                    toTime: null,
				}).where(eq(units.id, unitId));
				await db.delete(kebersihan).where(eq(kebersihan.id, kebersihanId));
			}else if((fromData.get('approve')?.toString() ?? '').trim().length <= 0){
				return fail(422, {
					success: false,
					message: "Approve Gagal",
					error: "Aprrove tidak ada, gagal disetujui",
				})
			}else{
				await db.update(kebersihan).set({
					approve: false,
					gambarRuangan: "",
					gambarKamarMandi: "",
				}).where(eq(kebersihan.id, kebersihanId));
				await db.update(units).set({
					pending: false
				}).where(eq(units.kebersihan, kebersihanId));
			}
			await db.update(units)
		} catch (error) {
			return fail(422, {
				success: false,
				message: "Data gagal disetujui",
				error: (error as Error).message,
			})
		}
		return {
			success: true,
			message: "Data berhasil disetujui",
			error: null,
		}

	},
	addAgent: async (event) => {
		const fromData: FormData = await event.request.formData();
		const AgentName: string = (fromData.get("AgentName"))?.toString() ?? '';
		const EmailAgent: string = (fromData.get("EmailAgent"))?.toString() ?? '';
		const PhoneAgent: string = (fromData.get("PhoneAgent"))?.toString() ?? '';
		try {
			await db.insert(agents).values({
				nameAgent: AgentName as string,
				email: EmailAgent as string,
				phoneNumber: PhoneAgent as string,
				createdByWho: event.locals.user?.username ?? ''
			});
		} catch (error) {
			return fail(422, {
				success: false,
				message: "Data gagal ditambahkan",
				error: (error as Error).message,
			})
		}
		return {
			success: true,
			message: "Data berhasil ditambahkan",
			error: null
		}
	},
	addUnit: async (event) => {
		const fromData: FormData = await event.request.formData();
		const UnitName: string = (fromData.get("UnitName"))?.toString() ?? '';
		const Status: string = (fromData.get("Status"))?.toString() ?? '';
		const FromTime: string | null = (fromData.get("from-time"))?.toString() ?? null;
		const ToTime: string | null = (fromData.get("to-time"))?.toString() ?? null;
		try {
			await db.insert(units).values({
				nameUnit: UnitName as string,
				unitState: Status as any,
				fromTime: (FromTime) ? new Date(FromTime) : null,
				toTime: (ToTime) ? new Date(ToTime) : null,
				createdByWho: event.locals.user?.username
			});
		} catch (error) {
			return fail(422, {
				success: false,
				message: "Data gagal ditambahkan",
				error: (error as Error).message,
			})
		}
		return {
			success: true,
			message: "Data berhasil ditambahkan",
			error: null
		}
	},
	addAccount: async (event) => {
		const formData: FormData = await event.request.formData();
		const username: string = (formData.get("Username"))?.toString() ?? '';
		const password: string = (formData.get("Password"))?.toString() ?? '';
        const role = formData.get("Role");
        const email: string = (formData.get("Email"))?.toString() ?? '';
        const telp: string = (formData.get("Telp"))?.toString() ?? '';
        const createdAt: Date = new Date(Date.now());

		// username must be between 4 ~ 31 characters, and only consists of lowercase letters, 0-9, -, and _
		// keep in mind some database (e.g. mysql) are case insensitive
		if (
			username.length < 3 ||
			username.length > 31 ||
			!/^[a-z0-9_-]+$/.test(username)
		) {
			return fail(400, {
				error: "Invalid Username",
				description: "username harus lebih dari 3 dan kurang dari 31 dan harus huruf kecil semua"
			});
		}
		if (password.length < 6 || password.length > 255) {
			return fail(400, {
				error: "Invalid password",
				description: "Password harus lebih dari 6 dan kurang dari 255"
			});
		}

		const userId = generateIdFromEntropySize(10); // 16 characters long
		const passwordHash = await hash(password, {
			// recommended minimum parameters
			memoryCost: 19456,
			timeCost: 2,
			parallelism: 1
		});


		try {
			//console.log("Trying to insert data...");
			await db.insert(accounts).values({
				id: userId as string,
				username: username as string,
				email: email as string,
				accountType: role as any,
				passwordHash: passwordHash as string,
				phoneNumber: telp as string ,
				createdAt: new Date(createdAt),

				createdByWho: event.locals.user?.username ?? ''
			});
		} catch (error) {
			console.log("Error: " + (error as Error).message);
			return fail(422, {
				description: "Nama telah terdaftar pada database",
				error: (error instanceof Error) ? (error as Error).message : "Username already taken"
			})
		}

		// const session = await createSession(generateSessionToken(), userId);
		// const sessionCookie = setSessionTokenCookie(event, session.id, new Date(new Date().getTime() + 24 * 60 * 60 * 1000));
		//console.log("Done: " + dataAkun);
		return {
			horay: true
		}
	},
	editUnit: async (event) => {
		const fromData: FormData = await event.request.formData();
		const UnitName: string = (fromData.get("UnitName"))?.toString() ?? '';
		const Status: string = (fromData.get("Status"))?.toString() ?? '';
		const FromTime: string | null = (fromData.get("from-time"))?.toString() ?? null;
		const ToTime: string | null = (fromData.get("to-time"))?.toString() ?? null;
		try {
			await db.update(units).set({
				nameUnit: UnitName as string,
				unitState: Status as any,
				fromTime: (FromTime) ? new Date(FromTime) : null,
				toTime: (ToTime) ? new Date(ToTime) : null
			}).where(eq(units.nameUnit, (UnitName as string)));
		} catch (error) {
			return fail(422, {
				success: false,
				message: "Gagal terjadi kesalahan",
				error: (error as Error).message,
			})
		}
		return {
			success: true,
			message: "Data berhasil diubah",
			error: null
		}
	},
	editAgent: async (event) => {
		const fromData: FormData = await event.request.formData();
		const AgentName: string = (fromData.get("AgentName"))?.toString() ?? '';
		const EmailAgent: string = (fromData.get("EmailAgent"))?.toString() ?? '';
		const PhoneAgent: string = (fromData.get("PhoneAgent"))?.toString() ?? '';
		const IdAgent: string = (fromData.get("IdAgent"))?.toString() ?? '';
		try {
			await db.update(agents).set({
				nameAgent: AgentName as string,
				email: EmailAgent as string,
				phoneNumber: PhoneAgent as string,
				createdByWho: event.locals.user?.username ?? ''
			}).where(eq(agents.id, (IdAgent as string)));
		} catch (error) {
			return fail(422, {
				success: false,
				message: "Gagal terjadi kesalahan",
				error: (error as Error).message,
			})
		}
		return {
			success: true,
			message: "Data berhasil diubah",
			error: null
		}
	},
	editAccount: async (event) => {
		const formData: FormData = await event.request.formData();
		const username: string = (formData.get("Username"))?.toString() ?? '';
		const password: string = (formData.get("Password"))?.toString() ?? '';
        const role = formData.get("Role");
        const email: string = (formData.get("Email"))?.toString() ?? '';
        const telp: string = (formData.get("Telp"))?.toString() ?? '';
		const editAkunId: string = (formData.get("editAkunId")?.toString() ?? '');
        const createdAt: Date = new Date(Date.now());

		// username must be between 4 ~ 31 characters, and only consists of lowercase letters, 0-9, -, and _
		// keep in mind some database (e.g. mysql) are case insensitive
		if (
			username.length < 3 ||
			username.length > 31 ||
			!/^[a-z0-9_-]+$/.test(username)
		) {
			return fail(400, {
				error: "Invalid Username",
				description: "username harus lebih dari 3 dan kurang dari 31"
			});
		}
		if (password.length < 6 || password.length > 255) {
			return fail(400, {
				error: "Invalid password",
				description: "Password harus lebih dari 6 dan kurang dari 255"
			});
		}

		const userId = generateIdFromEntropySize(10); // 16 characters long
		const passwordHash = await hash(password, {
			// recommended minimum parameters
			memoryCost: 19456,
			timeCost: 2,
			parallelism: 1
		});


		try {
			await db.update(accounts).set({
				id: userId as string,
				username: username as string,
				email: email as string,
				accountType: role as any,
				passwordHash: passwordHash as string,
				phoneNumber: telp as string ,
				createdAt: new Date(createdAt)
			}).where(eq(accounts.id, (editAkunId as string)));
		} catch (error) {
			return fail(422, {
				description: "Tidak bisa diubah datanya....",
				error: (error instanceof Error) ? (error as Error).message : "Data cannot be changed"
			})
		}

		// const session = await createSession(generateSessionToken(), userId);
		// const sessionCookie = setSessionTokenCookie(event, session.id, new Date(new Date().getTime() + 24 * 60 * 60 * 1000));
		return {
			horay: true
		}
	},
	deleteAgent: async (event) => {
		const formData: FormData = await event.request.formData();
		const IdAgent: string = (formData.get("agentName"))?.toString() ?? '';
		try {
			const check_agent_still_there = await db.select().from(agents).where(eq(agents.nameAgent, (IdAgent as string)));
			if(check_agent_still_there.length === 0)
				return fail(422, {
					success: false,
					message: "Data agent telah dihapus dari tempat lain",
					error: "Already Deleted",
				});

			await db.delete(agents).where(eq(agents.nameAgent, (IdAgent as string)));
		} catch (error) {
			//console.log("Delete Data Error...");
			return fail(422, {
				success: false,
				message: "Tidak bisa diubah datanya....",
				error: (error instanceof Error) ? (error as Error).message : "Data cannot be changed"
			})
		}
		return {
			success: true,
			message: "Data berhasil dihapus",
			error: null
		}
	},
	deleteUnit: async (event) => {
		const formData: FormData = await event.request.formData();
		const unitName: string = (formData.get("unitName"))?.toString() ?? '';
		try {
			const check_unit_still_there = await db.select().from(units).where(eq(units.nameUnit, (unitName as string)));
			if(check_unit_still_there.length === 0)
				return fail(422, {
					success: false,
					message: "Data agent telah dihapus dari tempat lain",
					error: "Already Deleted",
				});
			await db.delete(units).where(eq(units.nameUnit, (unitName as string)));
		} catch (error) {
			//console.log("Delete Data Error...");
			return fail(422, {
				success: false,
				message: "Tidak bisa diubah datanya....",
				error: (error instanceof Error) ? (error as Error).message : "Data cannot be changed"
			})
		}
		return {
			success: true,
			message: "Data berhasil dihapus",
			error: null
		}
	},
	deleteAccount: async (event) => {

		const formData: FormData = await event.request.formData();
		//console.log(formData);
		const id: string = (formData.get("id"))?.toString() ?? '';
		try {
			const check_accounts_still_there = await db.select().from(accounts).where(eq(accounts.id, (id as string)));
			if(check_accounts_still_there.length === 0)
				return fail(422, {
					success: false,
					message: "Data agent telah dihapus dari tempat lain",
					error: "Already Deleted",
				});
			await db.delete(accounts).where(eq(accounts.id, (id as string)));
		} catch (error) {
			//console.log("Delete Data Error...");
			return fail(422, {
				success: false,
				message: "Tidak bisa diubah datanya....",
				error: (error instanceof Error) ? (error as Error).message : "Data cannot be changed"
			})
		}
		return {
			success: true,
			message: "Data berhasil dihapus",
			error: null
		}
	}
};
