# RoomQu — UI baru terintegrasi dengan backend asli

RoomQu awalnya dirancang untuk **mobile**. Versi ini mengintegrasikan frontend baru yang dibantu Codex dengan login, sesi, schema Drizzle/PostgreSQL, dan handler operasional asli. UI/aset mobile asli telah diarsipkan dari commit `520b0eb`; lihat [backup dan asal perubahan](backups/README.md). Tampilan dipertahankan sebagai antarmuka mobile, termasuk dalam bingkai maksimal 480 px saat dibuka di desktop. Implementasi Tauri belum dilakukan.

Dokumentasi Inggris: [README.en.md](README.en.md).

## Menjalankan demo lokal

Memerlukan Node.js 24+ dan pnpm. Dari folder RoomQu:

```powershell
pnpm install --frozen-lockfile
.\start-demo.ps1
```

Buka http://127.0.0.1:1231. Launcher memakai `ROOMQU_MODE=integrated`. Bila dependensi sudah terpasang, cukup jalankan launcher. Port lain: `.\start-demo.ps1 -Port 1232`. Alternatif: `pnpm dev:demo` tanpa environment mode lain.

| Peran | Username | Kata sandi |
| --- | --- | --- |
| Host | host.demo | DemoRoom123! |
| Front Office | front.demo | DemoRoom123! |
| House Keeping | clean.demo | DemoRoom123! |
| Teknisi | tech.demo | DemoRoom123! |

Semua akun, tamu, dan nominal bersifat dummy. Tidak perlu PostgreSQL server atau Cloudinary. Database lokal berbasis file menggunakan **[PGlite](https://pglite.dev/docs/filesystems)**, dengan SQL yang dihasilkan dari **schema asli**, bukan tabel SQLite prototipe. Data tetap ada sesudah restart; gunakan hanya satu proses server untuk direktori database yang sama.

## Hubungan frontend dan backend

```text
UI baru pada / dan /User/H, /User/FO, /User/HK, /User/T
  -> adapter form ?/integrated (validasi peran, properti, dan input)
  -> handler asli di src/lib/server/original
  -> Drizzle dengan schema asli di src/lib/server/db/schema.ts
  -> PGlite file lokal untuk demo
```

Login tetap memverifikasi Argon2 dan membuat sesi `auth-session`. Check-in memakai aksi `costumer`; check-out memakai `editcostumer`; kebersihan memakai `keep`/`approve`; perbaikan memakai `repairman`; absensi memakai `absen`; tambah staf, unit, dan agen memakai aksi Host asli. Adapter data membaca tabel `accounts`, `session`, `units`, `agents`, `customers`, `kebersihan`, `masalah`, dan `absen` yang sama.

Tarif dan **nominal komisi diisi per pemesanan**, sesuai model asli. Tidak ditambahkan kolom tarif unit, tipe unit, komisi persentase agen, nama lengkap staf, atau status nonaktif yang tidak tersedia pada schema asli. UI menyembunyikan kontrol prototipe untuk fitur-fitur tersebut. Durasi mendukung hari dan 1–23 jam melalui kontrak handler asli. Persetujuan kebersihan menghapus dokumentasi sebagaimana handler asli; perbaikan berat mengembalikan unit menjadi Ready sesuai perilaku asli.

Gambar opsional tersimpan lokal, maksimal 2 MB (PNG/JPEG/WebP), dan hanya dapat diakses akun dalam properti yang sama. Tanpa unggahan, digunakan ilustrasi berlabel demo. Tidak ada KTP atau pembayaran nyata. Endpoint API lama dibatasi agar tidak melewati adapter; ini integrasi alur yang didukung UI baru, bukan pernyataan bahwa seluruh fitur UI lama telah direplikasi.

## Penyimpanan dan reset

Default: `.demo/original-postgres` untuk database; `.demo/original-media` untuk gambar. Lokasi dapat ditentukan lewat `ROOMQU_PG_DIR` dan `ROOMQU_MEDIA_DIR`. Folder `.demo` tidak di-commit.

Hentikan server sebelum reset:

```powershell
pnpm demo:reset
.\start-demo.ps1
```

Reset mengembalikan akun dan data operasional dummy, termasuk sesi. Berkas gambar lokal dipertahankan. Jangan menjalankan reset saat server masih memakai database itu.

## Verifikasi

```powershell
pnpm test:integrated
pnpm check
pnpm build
```

Tes integrasi menjalankan server sendiri pada port 1251 dan database file baru yang terisolasi, lalu menguji login asli, role/properti, tamu harian/jam, kebersihan, perawatan, absensi, staf/agen/unit, gambar lokal, dan ekspor. Folder tes berada di `.demo/integration-test-*` dan tidak di-push. [Laporan pemeriksaan](docs/integration-verification.md).

## Prototipe sebelumnya dan batas

`ROOMQU_MODE=demo` hanya untuk prototipe SQLite terpisah di `/demo`. `pnpm test:prototype` menguji prototipe itu; hasilnya **bukan** bukti pengujian backend asli. `pnpm prototype:reset` mereset SQLite tersebut. Screenshot portofolio lama dari `/demo` bukan bukti integrasi baru.

Konfigurasi PostgreSQL/Cloudinary eksternal tetap tersedia lewat `ROOMQU_MODE=live`, tetapi belum diverifikasi untuk produksi. Tidak ada deployment publik atau build Tauri dalam perubahan ini. PWA caching hanya aktif bila dipilih secara eksplisit melalui mode live saat build. Dependensi yang diverifikasi mengikuti `pnpm-lock.yaml`; npm ci belum diuji.

Kontribusi pemilik pada proyek awal dikonfirmasi 100%. Frontend dan integrasi dalam perubahan ini merupakan pengembangan lanjutan **dengan bantuan Codex**, bukan UI mobile asli yang tidak berubah.
