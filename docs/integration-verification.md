# Verifikasi integrasi UI / backend asli — 16 Oktober 2026

## Asal source

- Commit dasar: `520b0eb6c812023e116ff474ad7b9f8abe20bf84`.
- Backup UI: 30 berkas/aset di `backups/original-mobile-ui-520b0eb.zip`. Semua byte diverifikasi terhadap objek Git dan SHA-256 manifest.
- Empat blok `export const actions` asli (Host, FO, HK, T) diverifikasi **identik setelah normalisasi LF dan penghapusan spasi akhir baris**. Bukti hash: `backups/backend-provenance.json`. Modul dipindahkan ke `src/lib/server/original`, bukan diganti oleh SQLite store.
- Login tetap memakai Argon2, fungsi sesi, dan schema asli. Perubahan baru berupa UI, adapter form/data, driver PGlite lokal, validasi batas akses/input, penyimpanan gambar dummy lokal, dan ekspor.

## Hasil otomatis

- `pnpm test:integrated`: **52 pemeriksaan HTTP lulus**, menggunakan server sendiri pada port 1251 dan database file baru yang terisolasi.
- `pnpm check`: 0 error, 0 warning.
- Build SvelteKit: berhasil; adapter deployment belum dipilih.
- Verifikasi 30 berkas backup dan empat blok aksi asli: lulus.
- Server final dijalankan ulang pada port 1231: login asli berhasil, dan pemesanan Citra (Demo) tetap ada setelah restart database file.

Pemeriksaan mencakup login benar/salah dan cookie sesi asli; dashboard empat peran; akses role/properti; origin mutasi; check-in harian dan jam; harga serta nominal komisi sesuai input asli; penolakan pemesanan ganda; checkout; laporan kebersihan, penolakan pengiriman ganda dan persetujuan Host; perbaikan Teknisi; absensi harian dan duplikat; pembuatan staf/agen/unit dan login staf baru; gambar lokal PNG dan penolakan akses properti lain; ekspor Excel; penutupan API lama; logout dan pencabutan sesi.

## Masalah yang ditemukan dan diperbaiki

Pada percobaan browser, pemesanan per jam langsung menjadi StandBy. Drizzle menyimpan kolom timestamp unit sebagai waktu UTC, sedangkan perbandingan `NOW()` dapat mengikuti zona sesi PostgreSQL. Middleware sekarang membandingkan timestamp tanpa zona terhadap `CURRENT_TIMESTAMP AT TIME ZONE 'UTC'` dan hanya memeriksa unit Working. Tes regresi memastikan nama tamu masih muncul dalam kartu unit terisi sesudah pemesanan tiga jam.

## Browser mobile

Login melalui `/` menuju `/User/FO` dengan sesi backend asli. Formulir pemesanan per jam berhasil mengirim ke `?/integrated`, menampilkan pesan simpan dari adapter handler asli, dan unit 103 tetap Terisi untuk Citra (Demo), tiga jam, harga Rp150.000 dan komisi Rp10.000. Screenshot di `docs/screenshots` berasal dari aplikasi berjalan pada viewport 390 × 844. Ini UI baru terintegrasi, bukan tampilan mobile asli yang tidak berubah.

## Batas

Database/akun/file seluruhnya dummy lokal. PostgreSQL eksternal, Cloudinary live, deployment publik, beban serentak produksi, dan Tauri belum diverifikasi. `test:prototype` adalah tes SQLite prototipe terpisah, bukan pengujian integrasi asli. Backend asli tetap memiliki perilaku penghapusan dokumentasi saat approve dan pengembalian Ready setelah perbaikan berat; UI tidak mengarang kolom yang tidak ada pada schema. Tidak ada klaim bahwa semua fitur UI lama sudah direplikasi.
