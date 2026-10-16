import { fail, redirect, type Actions } from '@sveltejs/kit';
import type { ServerLoad as PageServerLoad } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { units, agents, customers, accounts, absensi, masalah } from '$lib/server/db/schema';
import { eq, asc, and } from 'drizzle-orm';
import { CREATE } from '$lib/server/upload_cloudinary';

const accountTypes = ["FO", "HK", "T", "H"] as const;
type AccountType = typeof accountTypes[number];
function toAccountType(value: string): AccountType | undefined {
  return accountTypes.find(c => c === value);
}

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user || locals.user.accountType !== 'T') {
        throw redirect(302, '/');
    }

    try{
        const [
            dataUnits,
            dataAgents,
            dataAbsensi,
            dataMasalah,
        ] = await Promise.all(
            [
                db.select().from(units).where(eq(units.createdByWho, locals.user.createdByWho)).orderBy(asc(units.unitState)),
                db.select().from(agents).where(eq(agents.createdByWho, locals.user.createdByWho)),
                db.select().from(absensi).where(eq(absensi.name, locals.user.username)),
                db
                .select({
                    id: masalah.id,
                    unitId: masalah.unitId,
                    desc: masalah.desc,
                    imageUrl: masalah.imageUrl,
                    when: masalah.when,
                })
                .from(masalah)
                .leftJoin(units, eq(masalah.unitId, units.id))
                .innerJoin(accounts, eq(units.createdByWho, accounts.username))
                .where(and(eq(accounts.createdByWho, locals.user.createdByWho), eq(masalah.done, false)))
            ]

        );
        return {
            dataUnits,
            dataAgents,
            dataAbsensi,
            dataMasalah,
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
    repairman: async (event) => {
        const formData: FormData = await event.request.formData();
        const masalahId: string = formData.get('masalah_id')?.toString() ?? '';
        try {
            const [m] = await db
                .select({
                    id: masalah.id,
                    unitId: masalah.unitId,
                    berat: masalah.berat,
                })
                .from(masalah)
                .where(eq(masalah.id, masalahId));

            if (!m) {
                return fail(422, {
                    success: false,
                    message: "Masalah tidak ditemukan",
                    error: "Terjadi kesalahan saat mencari masalah (buset)",
                })
            }

            // 2. Get the related unit
            if(m.berat){
                const [unit] = await db
                .select()
                .from(units)
                .where(eq(units.id, m.unitId ?? ''));
                if (!unit) {
                    return fail(422, {
                        success: false,
                        message: "Unit tidak ditemukan",
                        error: "Terjadi kesalahan saat mencari Unit, Hubungi Developer",
                    })
                }
                await db
                .update(units)
                .set({ unitState: 'Ready' })
                .where(eq(units.id, m.unitId ?? ''));

            }
            await db.update(masalah).set({
                done: true
            }).where(eq(masalah.id, masalahId))
        } catch (error) {
            console.log(error);
            return fail(422, {
                success: false,
                message: "Terjadi Error",
                error: "Terjadi kesalahan melakukan pengubahan data, harap hubungi developer",
            })
        }
        return {
            success: true,
            message: "Selamat anda berhasil melakukan berbaikan ruangan, terima kasih",
            error: null,
        }
    },
    absen: async (event) => {
        //console.log("Apa yang terjadi dengan dirimu");
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
}
