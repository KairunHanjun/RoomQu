# Backup UI mobile asli

`original-mobile-ui-520b0eb.zip` memuat 30 berkas UI/aset asli dari commit **520b0eb6c812023e116ff474ad7b9f8abe20bf84**, sebelum pekerjaan portofolio Codex. Daftar berkas dan SHA-256 tersedia di `original-mobile-ui-manifest.json`. ZIP tidak menyertakan `.env`, database, atau data pengguna.

`before-backend-integration.zip` menyimpan source saat sebelum integrasi backend pada 16 Oktober 2026, termasuk prototipe SQLite sebelumnya. Ini backup source, bukan data operasional.

Riwayat Git commit sumber juga tetap tersedia. ZIP UI merupakan arsip pemulihan, bukan route aktif. Untuk mengembalikan UI lama, gunakan branch/worktree terpisah: ekstrak ZIP di root checkout, sambungkan ulang `load` dan `actions` setiap `/User/{H,FO,HK,T}/+page.server.ts` ke modul yang sesuai di `src/lib/server/original`, dan sesuaikan endpoint API lama yang dibutuhkan UI lama. Jangan menimpa checkout yang memiliki pekerjaan belum disimpan. Integrasi saat ini sengaja membatasi endpoint lama dan memakai kontrak frontend baru; hanya menyalin UI lama tanpa server route yang sesuai tidak cukup.

## Provenance / Asal perubahan

- Original mobile UI: commit 520b0eb, milik pemilik proyek.
- Original business handlers: dipindahkan ke `src/lib/server/original`; implementasi aksi tetap dipakai, dengan import tipe yang disesuaikan setelah pemindahan.
- Refreshed frontend, adapter form/data, local PGlite setup, boundary validation, and tests: Codex-assisted changes, explicitly authorized after review by the owner.

The new UI must not be described as the unchanged original mobile interface. Tauri packaging is not implemented in this change.
