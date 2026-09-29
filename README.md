# SisKEN — Sistem Tempahan Kenderaan PPAT

Nota projek & panduan **sambung kerja di PC lain**. Baca fail ni dulu.
> Untuk AI/Claude di PC baharu: baca README ini sepenuhnya sebelum buat apa-apa.

---

## 1. Apa ini
PWA tempahan kenderaan untuk **Perbadanan Perpustakaan Awam Terengganu (PPAT)**.
- **Frontend** — fail statik (HTML/CSS/JS biasa, tiada build tool).
- **Backend** — PHP + MySQL (`php/api.php`), guna PDO + prepared statements. Dihoskan sama server dengan frontend (mis. XAMPP), berjalan on-premise/LAN — konsisten dengan seni bina SisRIN.
- Peranan: **admin** (urus semua), **pemandu** (tugasan sendiri + tanda selesai), **pemohon** (hantar & lihat tempahan sendiri).

## 2. Struktur fail
```
sisken/
  index.html        ← shell nipis: <link> + <script src>
  style.css         ← semua CSS
  js/
    core.js         ← state, utiliti, API (API_URL -> php/api.php), login, render(), nav (DIKONGSI)
    awam.js dashboard.js tempahan.js kenderaan.js pemandu.js
    selenggara.js laporan.js pengguna.js tugasan.js log.js
    boot.js         ← mulaApp() + daftar service worker (MUAT TERAKHIR)
  sw.js             ← service worker PWA (ada senarai ASET + nombor CACHE)
  manifest.json  icon-192.png  icon-512.png
  php/
    config.php      ← kredensial DB (DB_HOST/DB_NAME/DB_USER/DB_PASS)
    lib.php         ← utiliti dikongsi (hash kata laluan, masa KL)
    schema.sql      ← struktur jadual MySQL
    install.php     ← jalankan SEKALI melalui pelayar: cipta DB + akaun admin pertama
    api.php         ← titik masuk API tunggal
  public/           ← folder DEPLOY (salinan fail web; git-ignored)
```
- Frontend semua **global scope**, dimuat ikut urutan (core dulu, boot akhir). Tiada modul/bundler.
- Edit ciri → edit `js/<menu>.js` berkaitan. Edit backend → `php/api.php`.

## 3. Kontrak API
Frontend memanggil satu fungsi `api(action, payload)` dalam `js/core.js` yang POST JSON
`{ action, token, ...payload }` ke `API_URL` dan menerima balasan JSON `{ ok, ... }`.
Admin menyimpan kenderaan/pemandu/selenggaraan melalui `simpanRekod()` (satu rekod setiap
panggilan — `vehicleSave`, `driverSave`, `maintSave`, `maintDel`); server memulangkan data terkini.

| Perkara | Nilai |
|---|---|
| API_URL (dalam `js/core.js`) | `php/api.php` (relatif, same-origin dengan frontend) |
| Pangkalan data | MySQL/MariaDB — nama lalai `sisken` (tukar `DB_NAME` di `php/config.php`) |
| Akaun admin pertama | ID: `admin` · Kata laluan: `admin123` (dicipta oleh `install.php`) |

## 4. Pindah ke PC lain
Repo ada di **GitHub (PRIVATE):** `https://github.com/midikeko-del/siskenppat`
Di PC baharu:
```bash
gh auth login          # log masuk akaun GitHub midikeko-del
gh repo clone midikeko-del/siskenppat
# ATAU: git clone https://github.com/midikeko-del/siskenppat.git
```
Kemudian ikut langkah 5 (setup backend PHP) untuk jalankan/deploy semula.
> `public/` TIDAK disimpan dalam git (gitignore) — jana semula bila deploy (lihat bahagian 6).
> Sebelum mula kerja: `git pull`. Selepas buat perubahan: `git add -A && git commit -m "…" && git push`.

## 5. Setup backend PHP (XAMPP) di PC baharu
1. Pasang **XAMPP** (Apache + MySQL/MariaDB + PHP 8+).
2. Salin/clone keseluruhan folder `sisken/` ke dalam `htdocs/` (cth: `C:\xampp\htdocs\sisken\`).
3. Mulakan servis **Apache** dan **MySQL** dalam XAMPP Control Panel.
4. Semak/kemas kini kredensial DB di `php/config.php` (lalai sesuai untuk XAMPP: host `127.0.0.1`, user `root`, tiada kata laluan).
5. Buka pelayar ke `http://localhost/sisken/php/install.php` — ini akan:
   - Cipta pangkalan data (ikut `DB_NAME`) & semua jadual (`php/schema.sql`)
   - Cipta akaun admin pertama (`admin` / `admin123`) jika jadual Pengguna masih kosong
6. **Selepas berjaya, PADAM atau lindungi `php/install.php`** (elak sesiapa jalankan semula/reset di server produksi).
7. Buka `http://localhost/sisken/index.html`, log masuk dengan `admin` / `admin123`, **tukar kata laluan serta-merta** (butang 🔑 dalam app).
8. `API_URL` dalam `js/core.js` sudah ditetapkan kepada `"php/api.php"` (laluan relatif) — tidak perlu diubah selagi frontend & backend berkongsi server yang sama. Kalau backend dihoskan berasingan, tukar kepada URL penuh.

### Bawa masuk data lama (jika perlu)
Kalau ada data lama (Kenderaan/Pemandu/Tempahan/Selenggaraan/Pengguna) dalam hamparan
(cth. eksport CSV): import ke jadual MySQL yang sepadan (`kenderaan`, `pemandu`, `tempahan`,
`selenggaraan`, `pengguna`) — lajur sama nama seperti header CSV. `phpMyAdmin` (disertakan
dalam XAMPP) boleh import CSV terus, atau minta Claude Code tulis skrip import khusus.
Pemandu yang diimport boleh dipautkan kepada akaun log masuk melalui tab **Pengguna →
Tambah Pengguna → Peranan: Pemandu → Rekod Pemandu: "Pautkan: …"**.

## 6. Deploy
```bash
cd sisken
rm -rf public && mkdir -p public/js public/php
cp index.html style.css sw.js manifest.json icon-192.png icon-512.png public/
cp js/*.js public/js/
cp php/*.php php/schema.sql public/php/
# upload SELURUH folder public/ ke hosting (php/api.php & js/*.js MESTI dikemas kini serentak)
# kalau tambah/buang fail js → kemas kini senarai ASET + naikkan CACHE dalam sw.js
```

## 7. Perkara penting (gotchas)
- ⚠️ **Kata laluan admin default `admin / admin123` MASIH AKTIF** — TUKAR segera (butang 🔑 dalam app).
- ⚠️ **PADAM/lindungi `php/install.php`** selepas pemasangan pertama — ia boleh mencipta semula akaun admin jika jadual Pengguna kosong.
- **HTTPS** diperlukan untuk ciri PWA (offline/install). HTTP biasa app masih jalan tapi tanpa PWA.
- Backend berjalan on-premise/LAN — **tiada pergantungan internet** untuk operasi harian.
- **Data di MySQL tempatan** (`php/config.php`) — pastikan backup DB berkala (`mysqldump`).
- Jadual MySQL (`php/schema.sql`): kenderaan, pemandu, tempahan, selenggaraan, pengguna, sesi, tetapan, keselamatan, log.
- Ralat pelayan dicatat dalam log ralat PHP (XAMPP: `C:\xampp\php\logs\php_error_log` / log Apache) — pengguna hanya nampak mesej umum.

## 8. Apa yang dah disiapkan (ikut commit)
- **Backend PHP + MySQL** (PDO, prepared statements): login, awam, load, vehicleSave, driverSave, maintSave, maintDel, bookingAdd/Approve/Reject/Complete/Edit, tukarPw, drvStatus, userAdd/Reset/Del, auditLog, logPurge, logout. Setiap permintaan dikunci dengan `GET_LOCK` MySQL untuk elak race condition.
- Keselamatan: kawalan peranan server (anti lulus-sendiri), tapis data bukan-admin, kunci brute-force (5 cubaan/15 min), hash bersalt (SHA-256+salt).
- Integriti: kelulusan + semakan konflik di server, sekat tarikh/masa lampau, ID rekod dijana server, simpanan satu rekod (tiada tulis-ganti jadual).
- Ciri: status kenderaan auto, arkib (soft-delete) kenderaan/pemandu, pemandu kemas kini odometer/minyak/lokasi semasa selesai, log audit + padam >1 tahun, penapis/carian/paginasi Tempahan & Tugasan.
- UI: menu hamburger telefon, navigasi minggu (kalendar) jadual pemandu (admin + paparan umum), label "Bersedia".
- Senibina: frontend dipecahkan kepada `style.css` + `js/*.js` setiap menu.

## 9. Cadangan kerja seterusnya (belum dibuat)
- Tukar `admin123` (PALING penting) selepas setiap pemasangan baharu.
- Hashing PBKDF2 / `password_hash()` (regang) — sekarang SHA-256 satu pusingan + salt.
- Butang "nyaharkib" untuk pulih kenderaan/pemandu.
- Auto-padam log audit (cron/scheduled task) — sekarang manual melalui aksi `logPurge`.
- Padam/lindungi `php/install.php` selepas pemasangan produksi (jangan tinggal boleh diakses awam).
- Backup automatik `mysqldump` berjadual untuk DB `sisken`.

## 10. Uji cepat
- Backend PHP hidup: buka `php/api.php` dalam browser (kaedah GET) → patut papar `{"ok":true,"mesej":"SisKEN API aktif…"}`.
- Log masuk: `admin` / `admin123` (selepas `install.php` dijalankan) — patut terus papar Papan Pemuka dengan data yang disimpan di MySQL.
- Pratonton frontend tempatan: terus melalui Apache/XAMPP (`http://localhost/sisken/index.html`).
