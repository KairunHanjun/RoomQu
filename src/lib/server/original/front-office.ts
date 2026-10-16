import { fail, redirect, type Actions } from "@sveltejs/kit";
import type { ServerLoad as PageServerLoad } from '@sveltejs/kit';
import { db } from "$lib/server/db";
import { absensi, accounts, agents, customers, kebersihan, masalah, units } from "$lib/server/db/schema";
import { asc, eq } from "drizzle-orm";
import { CREATE, DELETE } from "$lib/server/upload_cloudinary";
import { and } from "drizzle-orm";
import { desc } from "drizzle-orm";

const accountTypes = ["FO", "HK", "T", "H"] as const;
type AccountType = typeof accountTypes[number];
function toAccountType(value: string): AccountType | undefined {
  return accountTypes.find(c => c === value);
}

function formatDateLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // fix month +1
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:00`;
}

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user || locals.user.accountType !== 'FO') {
		throw redirect(302, '/');
	}

    try{
        const [
            dataUnits,
            dataAgents,
            dataCustomers,
            dataAbsensi,
            dataKebersihan
        ] = await Promise.all([
            db.select().from(units).where(eq(units.createdByWho, locals.user.createdByWho)).orderBy(asc(units.unitState)),
            db.select().from(agents).where(eq(agents.createdByWho, locals.user.createdByWho)),
            db
            .select({
                id: customers.idCostumers,
                name: customers.customersName,
                hostName: customers.hostName,
                unitId: customers.unitId,
                price: customers.price,
                duration: customers.duration,
                fromTime: customers.fromTime,
                toTime: customers.toTime
            })
            .from(customers)
            .innerJoin(accounts, eq(customers.hostName, accounts.username))
            .where(eq(accounts.createdByWho, locals.user.createdByWho)),
            db.select().from(absensi).where(eq(absensi.name, locals.user.username)),
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
            .where(and(eq(accounts.createdByWho, units.createdByWho)))
        ]);
        return {
            dataUnits,
            dataAgents,
            dataCustomers,
            dataAbsensi,
            dataKebersihan,
            userNow: locals.user
        }
    }catch(error){
        return {
            error: ((error as Error).message as string) ?? '',
            description: "Terjadi kesalahan saat mengambil data",
            userNow: locals.user
        };
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
                    await db.update(units).set({
                        kebersihan: null,
                        pending: false,
                        unitState: 'Ready',
                        fromTime: null,
                        toTime: null,
                    }).where(eq(units.id, unitId));
                    await db.delete(kebersihan).where(eq(kebersihan.id, kebersihanId));
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
                console.error(error);
                return fail(422, {
                    success: false,
                    message: "Terjadi kegagalan",
                    error: "Terjadi Kegagalan, harap hubungi developernya",
                })
            }
            return {
			success: true,
			message: "Kebersihan berhasil disetujui",
			error: null
		}
        },
    costumer: async (event) => {
        const formData: FormData = await event.request.formData();
        const customerName: string = (formData.get("name")?.toString() ?? '');
        let duration: number = +(formData.get("duration")?.toString() ?? '0');
        let durationDays: boolean = false;
        const formTime: string = (formData.get("enter")?.toString() ?? '');
        const toTime: string = (formData.get("out")?.toString() ?? '');
        const [agent_id, agent_host]: string[] = (formData.get("agent")?.toString() ?? '|').split("|");
        const price: number = +(formData.get("price")?.toString() ?? '0');
        const komisi: number = +(formData.get("komisi")?.toString() ?? '0');
        const fotoKtp: string = (formData.get("pic1Id")?.toString() ?? '');
        const unit_id: string = (formData.get("unit_id")?.toString() ?? '');

        try {

            //CHECK IF RESULT UPLOAD IS THERE
            if(fotoKtp == ''){
                return fail(422, {
                    success: false,
                    message: "Upload KTP gagal",
                    error: "Upload KTP Gagal dilakukan (entah kenapa)",
                })
            }
            //CHECK IF UPLOAD IS DONE OR ERROR
            else{
                //Check if custom duration

                const [fromHour, fromMin] = formTime.split(":").map(Number);
                const [toHour, toMin] = toTime.split(":").map(Number);
                const today = new Date();
                let fromDate = new Date(today);
                fromDate.setHours(fromHour, fromMin, 0, 0);
                let toDate = new Date(today);
                toDate.setHours(toHour, toMin, 0, 0);
                if (toDate < fromDate) toDate.setDate(toDate.getDate() + 1);
                if(duration == 0) {
                    const diffMs = toDate.getTime() - fromDate.getTime();
                    duration = diffMs / (1000 * 60 * 60);
                }else if(duration == 9999){
                    fromDate = new Date(formTime);
                    toDate = new Date(toTime);
                    const diffMs = toDate.getTime() - fromDate.getTime();
                    duration = diffMs / (1000 * 60 * 60 * 24);
                    durationDays = true;
                }

                await db.insert(customers).values({
                    hostName: agent_host,
                    agent: agent_id,
                    unitId: unit_id,
                    customersName: customerName,
                    duration: duration,
                    fromTime: formatDateLocal(fromDate),
                    toTime: formatDateLocal(toDate),
                    price: price,
                    fotoKTP: fotoKtp,
                    durationDays: durationDays,
                    komisi: komisi
                });
                await db.update(units).set({
                    unitState: 'Working',
                    fromTime: fromDate,
                    toTime: toDate,
                    pending: null
                }).where(eq(units.id, unit_id))
            }
        } catch (error) {
            console.log(error);
            await db.update(units).set({
                unitState: 'Ready'
            }).where(eq(units.id, unit_id))
            return fail(422, {
                success: false,
                message: "Data gagal ditambahkan",
                error: "Terjadi kesalahan saat data ditambahkan terjadi, harap hubungi developer",
            })
        }
        return {
			success: true,
			message: "Data berhasil ditambahkan",
			error: null
		}
    },
    editcostumer: async (event) => {
        const formData: FormData = await event.request.formData();
        const unit_id: string = (formData.get("unit_id")?.toString() ?? '');
        const changeStateToReady: boolean = (formData.get('readyState') as unknown as boolean ?? false)
        const price: number = +(formData.get("price")?.toString() ?? '0');
        let duration: number | undefined = +(formData.get("duration")?.toString() ?? '-1');
        try {
            if(!changeStateToReady){
                const fromTime: string = (formData.get("enter")?.toString() ?? '');
                const toTime: string = (formData.get("out")?.toString() ?? '');
                let durationDays = false;
                let fromDate: Date = new Date();
                let toDate: Date = new Date();
                if(duration == 0) {
                    const [fromHour, fromMin] = fromTime.split(":").map(Number);
                    const [toHour, toMin] = toTime.split(":").map(Number);
                    const today = new Date();
                    fromDate = new Date(today);
                    fromDate.setHours(fromHour, fromMin, 0, 0);
                    toDate = new Date(today);
                    toDate.setHours(toHour, toMin, 0, 0);
                    if (toDate < fromDate) {
                        toDate.setDate(toDate.getDate() + 1);
                    }
                    const diffMs = toDate.getTime() - fromDate.getTime();
                    duration = diffMs / (1000 * 60 * 60);
                }else if(duration == 9999){
                    fromDate = new Date(fromTime);
                    toDate = new Date(toTime);
                    const diffMs = toDate.getTime() - fromDate.getTime();
                    duration = diffMs / (1000 * 60 * 60 * 24);
                    durationDays = true;
                }

                const current = await db
                    .select({
                        oldToTime: customers.toTime,
                        oldDuration: customers.duration,
                        price: customers.price
                    })
                    .from(customers)
                    .where(eq(customers.unitId, unit_id))
                    .limit(1);

                if (current.length > 0) {
                    const prevTo = new Date(current[0].oldToTime as string);
                    const prevDuration = current[0].oldDuration ?? 0;
                    const priceY = current[0].price;

                    const newTotalDuration = prevDuration + duration!;
                    const newToTime = new Date(prevTo);

                    if (durationDays) {
                        newToTime.setDate(newToTime.getDate() + duration!);
                    } else {
                        newToTime.setHours(newToTime.getHours() + duration!);
                    }

                    await db.update(customers).set({
                        toTime: `${newToTime.getFullYear()}-${newToTime.getMonth()+1}-${(newToTime.getDate()<10?'0':'')+newToTime.getDate()} ${newToTime.getHours()}:${newToTime.getMinutes()}:00`,
                        duration: newTotalDuration,
                        durationDays,
                        price: priceY+price,
                    }).where(eq(customers.unitId, unit_id));
                }
            }else{
                const getPublic_ID = (await db.select().from(customers).where(eq(customers.unitId, unit_id)))[0].fotoKTP ?? '';
                //If you want to delete it
                // await db.delete(customers).where(eq(customers.unitId, unit_id));
                //if you want to keep it, (update the picture id to null please or just empty string)
                await db.update(customers).set({
                    fotoKTP: null,
                    unitId: null
                }).where(eq(customers.fotoKTP, getPublic_ID));
                await db.update(units).set({
                    unitState: 'StandBy',
                    fromTime: null,
                    toTime: null,
                    pending: null,
                    kebersihan: null
                }).where(eq(units.id, unit_id));
                await DELETE(getPublic_ID);
            }
        } catch (error) {
            return fail(422, {
                success: false,
                message: "Data gagal diubah",
                error: "Terjadi kesalahan saat data diubah terjadi, harap hubungi developer",
            })
        }
        return {
			success: true,
			message: "Data berhasil diubah",
			error: null
		}
    },
    absen: async (event) => {
        //console.log("Apa yang terjadi dengan dirimu");
        const formData: FormData = await event.request.formData();
        const nama: string = formData.get('name')?.toString() ?? '';
        const jabatan: "FO" | "HK" | "T" | "H"  = toAccountType(formData.get("accountType")?.toString() ?? '') ?? 'FO';
        const jamBerapa: string = formData.get("jam")?.toString() ?? '';
        const [toHour, toMin] = jamBerapa.split(":").map(Number);
        const trullyJamBerapa: Date = new Date((new Date()).setHours(toHour, toMin, 0, 0));
        const fotoAbsensi: string = (formData.get("pic1Id")?.toString() ?? '');
        //const unitId: string = formData.get("unit_id")?.toString() ?? '';

        try {
            //CHECK IF RESULT UPLOAD IS THERE
            if(fotoAbsensi == ''){
                return fail(422, {
                    success: false,
                    message: "Upload Foto Masalah gagal",
                    error: "Upload Foto Masalah Gagal dilakukan (entah kenapa)",
                })
            }
            //CHECK IF UPLOAD IS DONE OR ERROR
            else{
                await db.insert(absensi).values({
                    name: nama,
                    accountType: jabatan,
                    whenEntry: trullyJamBerapa,
                    fotoUrl: fotoAbsensi

                });
            }
        } catch (error) {
            console.log(error);
            return fail(422, {
                success: false,
                message: "Data gagal diubah",
                error: "Terjadi kesalahan saat data ditambahkan terjadi, harap hubungi developer",
            })
        }
        return {
			success: true,
			message: "Data berhasil ditambahkan",
			error: null
		}

    },
    masalah: async (event) => {
        const formData: FormData = await event.request.formData();
        const nama: string = formData.get("name")?.toString() ?? '';
        const jabatan: string = formData.get("accountType")?.toString() ?? '';
        const jamBerapa: string = formData.get("jam")?.toString() ?? '';
        const [toHour, toMin] = jamBerapa.split(":").map(Number);
        const trullyJamBerapa: Date = new Date((new Date()).setHours(toHour, toMin, 0, 0));
        const desc: string = formData.get("masalah")?.toString()  ?? '';
        const berat: boolean = (formData.get("berat") as unknown as boolean);
        const fotoMasalah: string = (formData.get("pic1Id")?.toString() ?? '');
        const unitId: string = formData.get("unit_id")?.toString() ?? '';
        try {
            //CHECK IF RESULT UPLOAD IS THERE
            if(fotoMasalah == ''){
                return fail(422, {
                    success: false,
                    message: "Upload Foto Masalah gagal",
                    error: "Upload Foto Masalah Gagal dilakukan (entah kenapa)",
                })
            }
            //CHECK IF UPLOAD IS DONE OR ERROR
            else{
                await db.insert(masalah).values({
                    unitId: unitId,
                    name: nama,
                    accountType: toAccountType(jabatan) ?? 'FO',
                    imageUrl: fotoMasalah,
                    desc: desc,
                    when: trullyJamBerapa,
                    berat: berat
                });
                if(berat){
                    await db.update(units).set({
                        unitState: 'Closed'
                    }).where(eq(units.id, unitId))
                    const getPublic_ID = (await db.select().from(customers).where(eq(customers.unitId, unitId))) ?? false;
                    //If you want to delete it
                    // await db.delete(customers).where(eq(customers.unitId, unit_id));
                    //if you want to keep it, (update the picture id to null please or just empty string)
                    if(getPublic_ID.length > 0){
                        await db.update(customers).set({
                            fotoKTP: null,
                            unitId: null
                        }).where(eq(customers.fotoKTP, getPublic_ID[0].fotoKTP ?? ''));
                        await db.update(units).set({ unitState: 'Ready' }).where(eq(units.id, unitId));
                        await DELETE(getPublic_ID[0].fotoKTP ?? '');
                    }
                }

            }
        } catch (error) {
            console.log(error);
            return fail(422, {
                success: false,
                message: "Data gagal diubah",
                error: "Terjadi kesalahan saat data ditambahkan terjadi, harap hubungi developer",
            })
        }
        return {
			success: true,
			message: "Data berhasil ditambahkan",
			error: null
		}
    }
}
