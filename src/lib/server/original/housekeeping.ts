import { fail, redirect, type Actions } from "@sveltejs/kit";
import type { ServerLoad as PageServerLoad } from '@sveltejs/kit';
import { db } from "$lib/server/db";
import { absensi, accounts, agents, customers, kebersihan, masalah, units } from "$lib/server/db/schema";
import { asc, eq } from "drizzle-orm";
import { CREATE, DELETE } from "$lib/server/upload_cloudinary";
import { and } from "drizzle-orm";

const accountTypes = ["FO", "HK", "T", "H"] as const;
type AccountType = typeof accountTypes[number];
function toAccountType(value: string): AccountType | undefined {
  return accountTypes.find(c => c === value);
}

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user || locals.user.accountType !== 'HK') {
		throw redirect(302, '/');
	}

    try{
        const [
            dataUnits,
            dataAgents,
            dataCustomers,
            dataAbsensi,
            dataKebersihan,
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
            .where(and(eq(accounts.createdByWho, units.createdByWho))),

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
        console.log(error);
        return {
            error: (error as Error).message,
            description: "Terjadi kesalahan saat mengambil data",
            userNow: locals.user
        };
    }
}

export const actions: Actions = {
    keep: async (event) => {
        const formData: FormData = await event.request.formData();
        const nama: string = formData.get("name")?.toString() ?? '';
        const jabatan: string = formData.get("accountType")?.toString() ?? '';
        const gambarRuangan: string = (formData.get("pic1Id")?.toString() ?? '');
        const gambarKamarMandi: string = (formData.get("pic2Id")?.toString() ?? '');
        const unitId: string = formData.get("unit_id")?.toString() ?? '';
        const kebersihanId: string | undefined = formData.get("kebersihanId")?.toString();
        try {
            //CHECK IF RESULT UPLOAD IS THERE
            if(gambarRuangan == '' && gambarKamarMandi == ''){
                return fail(422, {
                    success: false,
                    message: "Upload Foto Masalah gagal",
                    error: "Upload Foto Masalah Gagal dilakukan (entah kenapa)",
                })
            }
            //CHECK IF UPLOAD IS DONE OR ERROR
            else{
                if(!kebersihanId){
                    const kebersihan_return = await db.insert(kebersihan).values({
                        name: nama,
                        accountType: toAccountType(jabatan) ?? 'HK',
                        gambarRuangan: gambarRuangan,
                        gambarKamarMandi: gambarKamarMandi,
                        approve: null,
                    }).returning({id: kebersihan.id});
                    await db.update(units).set({kebersihan: kebersihan_return[0].id, pending: true}).where(eq(units.id, unitId));
                    return {
                        success: true,
                        message: "Ruangan berhasil dibersihkan",
                        error: null
                    }
                }
                await db.update(kebersihan).set({
                    gambarRuangan: gambarRuangan,
                    gambarKamarMandi: gambarKamarMandi,
                    when: new Date()
                }).where(eq(kebersihan.id, kebersihanId));
                await db.update(units).set({pending: true}).where(eq(units.id, unitId));
            }
        } catch (error) {
            console.log(error);
            return fail(422, {
                success: false,
                message: "Ruangan gagal dibersihkan",
                error: "Terjadi kesalahan saat ruangan sendang dibersihkan terjadi, harap hubungi developer",
            })
        }
        return {
			success: true,
			message: "Ruangan berhasil dibersihkan",
			error: null
		}
    },
    absen: async (event) => {
        const formData: FormData = await event.request.formData();
        const nama: string = formData.get('name')?.toString() ?? '';
        const jabatan: "FO" | "HK" | "T" | "H"  = toAccountType(formData.get("accountType")?.toString() ?? '') ?? 'HK';
        const jamBerapa: string = formData.get("jam")?.toString() ?? '';
        const [toHour, toMin] = jamBerapa.split(":").map(Number);
        const trullyJamBerapa: Date = new Date((new Date()).setHours(toHour, toMin, 0, 0));
        const fotoAbsensi: File = (formData.get("foto") as File);
        //const unitId: string = formData.get("unit_id")?.toString() ?? '';

        try {
            const result_upload = await CREATE(fotoAbsensi);
            //CHECK IF RESULT UPLOAD IS THERE
            if(!result_upload){
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
                    fotoUrl: result_upload.public_id

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
        const fotoMasalah: File = (formData.get("foto") as File);
        const unitId: string = formData.get("unit_id")?.toString() ?? '';
        try {
            const result_upload = await CREATE(fotoMasalah);
            //CHECK IF RESULT UPLOAD IS THERE
            if(!result_upload){
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
                    accountType: toAccountType(jabatan) ?? 'HK',
                    imageUrl: result_upload.public_id,
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
