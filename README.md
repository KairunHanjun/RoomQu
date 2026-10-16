# RoomQu

**Aplikasi operasional properti dengan alur kerja yang dirancang untuk mobile.**

[English](README.en.md) · [Source integrasi](https://github.com/KairunHanjun/RoomQu) · [Apache 2.0](LICENSE)

RoomQu menghubungkan pekerjaan **Host, Front Office, House Keeping, dan Teknisi**: mengelola unit, menerima tamu, mendokumentasikan kebersihan, dan menangani masalah. Proyek ini mengeksplorasi bagaimana status unit dan tanggung jawab tiap peran dapat terhubung dalam satu aplikasi.

Antarmuka tetap berorientasi mobile, termasuk bingkai maksimal 480 px pada desktop. **Tauri masih rencana pengembangan**, bukan fitur yang sudah tersedia.

## Sekilas aplikasi

<p>
  <img src="docs/screenshots/01-mobile-front-office.jpg" width="230" alt="Dashboard Front Office dengan data dummy" />
  <img src="docs/screenshots/02-mobile-hourly-checkin.jpg" width="230" alt="Form check-in per jam dengan data dummy" />
  <img src="docs/screenshots/03-mobile-occupied-units.jpg" width="230" alt="Status unit terisi setelah pemesanan disimpan" />
</p>

Screenshot berasal dari aplikasi berjalan dengan data fiktif. Galeri: [dokumentasi mobile](docs/screenshots/README.md).

## Fitur utama

| Peran | Alur kerja |
| --- | --- |
| Host | Memantau operasional, mengelola staf/unit/agen, dan menyetujui dokumentasi kebersihan. |
| Front Office | Check-in harian atau per jam, check-out, dan pemantauan status unit. |
| House Keeping | Absensi dan pengiriman dokumentasi kebersihan. |
| Teknisi | Absensi, laporan masalah, dan penyelesaian perawatan unit. |

Login memakai Argon2 dan sesi asli. Fitur lain mencakup gambar dokumentasi lokal, pembatasan akses berdasarkan properti, dan ekspor Excel. Harga serta nominal komisi dimasukkan per pemesanan sesuai model data asli.

## Teknologi

TypeScript, Svelte 5, SvelteKit 2, Tailwind CSS, Drizzle ORM, schema PostgreSQL, PGlite, Argon2, dan ExcelJS. Demo menggunakan **database PGlite berbasis file** tanpa PostgreSQL server atau Cloudinary eksternal.

## Menjalankan demo

Memerlukan **Node.js 24+** dan **pnpm**. Versi integrasi sudah tersedia pada cabang `main`:

```sh
git clone https://github.com/KairunHanjun/RoomQu.git
cd RoomQu
pnpm install --frozen-lockfile
pnpm dev:demo
```

Pada Windows, launcher juga tersedia:

```powershell
.\start-demo.ps1
# Port alternatif:
.\start-demo.ps1 -Port 1232
```

Buka **http://127.0.0.1:1231** dan hentikan dengan `Ctrl+C`. Gunakan mode integrasi bawaan; jangan mengatur `ROOMQU_MODE=demo` bila ingin menjalankan frontend yang terhubung ke backend asli.

| Peran | Username | Kata sandi demo |
| --- | --- | --- |
| Host | `host.demo` | `DemoRoom123!` |
| Front Office | `front.demo` | `DemoRoom123!` |
| House Keeping | `clean.demo` | `DemoRoom123!` |
| Teknisi | `tech.demo` | `DemoRoom123!` |

Seluruh akun, tamu, gambar contoh, dan nominal bersifat dummy. Tidak ada dokumen identitas atau pembayaran nyata.

## Cara integrasi bekerja

```text
UI mobile: / dan /User/H, /User/FO, /User/HK, /User/T
  -> adapter form ?/integrated
  -> handler bisnis asli: src/lib/server/original
  -> schema Drizzle asli: src/lib/server/db/schema.ts
  -> database PGlite file untuk demo lokal
```

Adapter memvalidasi peran, properti, dan input sebelum memanggil handler asli. Frontend tidak menambahkan kolom yang tidak ada pada schema, seperti komisi persentase agen atau tarif tetap unit. Durasi per jam mengikuti kontrak asli: **1–23 jam**.

Source UI mobile awal dari commit `520b0eb` disimpan pada [backup](backups/README.md). Frontend terbaru dan adapter merupakan penyempurnaan yang dibantu Codex atas persetujuan pemilik; tampilannya tidak diklaim sebagai UI awal yang tidak berubah.

## Penyimpanan dan reset

| Data | Lokasi bawaan | Override |
| --- | --- | --- |
| Database | `.demo/original-postgres` | `ROOMQU_PG_DIR` |
| Gambar | `.demo/original-media` | `ROOMQU_MEDIA_DIR` |

Data bertahan setelah restart. Jalankan hanya satu server untuk satu direktori database. Unggahan PNG/JPEG/WebP dibatasi 2 MB dan hanya dapat diakses akun dalam properti terkait.

Untuk mengembalikan data demo, **hentikan server terlebih dahulu**:

```sh
pnpm demo:reset
pnpm dev:demo
```

Reset mengembalikan akun, sesi, dan data operasional dummy. Gambar yang sudah tersimpan tetap dipertahankan.

## Pemeriksaan dan build

```sh
pnpm test:integrated
pnpm check
pnpm build
```

Verifikasi lokal pada 16 Oktober 2026 mencatat **52 pemeriksaan integrasi HTTP lulus**, pemeriksaan Svelte tanpa error/warning, dan build berhasil. Tes memakai server sendiri pada port 1251 dan database terisolasi. Detail cakupan dan batas: [laporan integrasi](docs/integration-verification.md).

## Batas pengembangan

- PostgreSQL/Cloudinary eksternal, deployment produksi, dan packaging Tauri belum diverifikasi.
- Persetujuan kebersihan menghapus dokumentasi; penyelesaian perawatan berat mengembalikan unit menjadi Ready, mengikuti handler asli.
- Belum seluruh fitur UI awal direplikasi pada frontend terbaru.
- `ROOMQU_MODE=demo` dan `pnpm test:prototype` hanya untuk prototipe SQLite terpisah; hasilnya tidak mewakili integrasi backend asli.
- `ROOMQU_MODE=live` memilih integrasi eksternal yang membutuhkan konfigurasi tersendiri. PWA caching hanya aktif bila mode live dipilih saat build.

## Lisensi

Kode proyek dilisensikan dengan **Apache License 2.0**; lihat [LICENSE](LICENSE). Dependensi dan aset pihak ketiga tetap mengikuti lisensinya masing-masing.
