# SisKEN — Sistem Tempahan Kenderaan PPAT

Nota projek & panduan **sambung kerja di PC lain**. Baca fail ni dulu.
> Untuk AI/Claude di PC baharu: baca README ini sepenuhnya sebelum buat apa-apa.

---

## 1. Apa ini
PWA tempahan kenderaan untuk **Perbadanan Perpustakaan Awam Terengganu (PPAT)**.
- **Frontend** — fail statik (HTML/CSS/JS biasa, tiada build tool). Di-host di mana-mana server web.
- **Backend (SEMASA)** — PHP + MySQL (`php/api.php`), guna PDO + prepared statements. Dihoskan sama server dengan frontend (mis. XAMPP), berjalan on-premise/LAN — konsisten dengan seni bina SisRIN.
- **Backend (LEGASI/rujukan)** — Google Apps Script (`gas/Code.js`) + Google Sheets. Kod asal masih disimpan dalam repo untuk rujukan/rollback, tetapi TIDAK lagi dipakai oleh frontend (lihat bahagian 6 kalau perlu kembali kepadanya).
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
  php/              ← BACKEND SEMASA (PHP + MySQL)
    config.php      ← kredensial DB (DB_HOST/DB_NAME/DB_USER/DB_PASS)
    lib.php         ← utiliti dikongsi (hash kata laluan, masa KL)
    schema.sql      ← struktur jadual MySQL (CREATE DATABASE + semua jadual)
    install.php     ← jalankan SEKALI melalui pelayar: cipta DB + akaun admin pertama
    api.php         ← titik masuk API tunggal (setara doGet/doPost gas/Code.js)
  gas/              ← LEGASI (rujukan sahaja, tidak dipakai lagi)
    Code.js         ← backend Apps Script asal (SUMBER RUJUKAN untuk clasp push)
    appsscript.json .clasp.json (ada scriptId)
  Code.gs.txt       ← salinan backend legasi (selari dgn gas/Code.js)
  public/           ← folder DEPLOY (salinan fail web; git-ignored)
  .node18/          ← Node 18 mudah-alih untuk clasp (git-ignored, legasi sahaja)
```
- Frontend semua **global scope**, dimuat ikut urutan (core dulu, boot akhir). Tiada modul/bundler.
- Edit ciri → edit `js/<menu>.js` berkaitan. Edit backend → `php/api.php` (bukan `gas/Code.js` lagi).

## 3. Kontrak API (tidak berubah)
Frontend memanggil satu fungsi `api(action, payload)` dalam `js/core.js` yang POST JSON
`{ action, token, ...payload }` ke `API_URL` dan menerima balasan JSON `{ ok, ... }`.
Kontrak ini **sama** sebelum & selepas migrasi — sebab itu tiada logik frontend perlu
diubah, cuma `API_URL` (kini `"php/api.php"`, laluan relatif same-origin).

| Perkara | Nilai |
|---|---|
| API_URL (dalam `js/core.js`) | `php/api.php` (relatif, same-origin dengan frontend) |
| Pangkalan data | MySQL/MariaDB — nama lalai `sisken` (tukar di `php/config.php`) |
| Akaun admin pertama | ID: `admin` · Kata laluan: `admin123` (dicipta oleh `install.php`) |
| *(Legasi)* Apps Script ID | `1cWtkQE7c9IHRuygS2eeyxxacb-NuMaPSiw1pqtnJuHyR-iLzexYYAG1p` |
| *(Legasi)* Akaun Google pemilik Sheet | midikeko@gmail.com |

## 4. Pindah ke PC lain
Repo ada di **GitHub (PRIVATE):** `https://github.com/midikeko-del/siskenppat`
Di PC baharu:
```bash
gh auth login          # log masuk akaun GitHub midikeko-del
gh repo clone midikeko-del/siskenppat
# ATAU: git clone https://github.com/midikeko-del/siskenppat.git
```
Kemudian ikut langkah 5 (setup backend PHP) untuk jalankan/deploy semula.
> `.node18/` dan `public/` TIDAK disimpan dalam git (gitignore) — jana/pasang semula di PC baharu jika perlu (legasi clasp sahaja).
> Selepas buat perubahan: `git add -A && git commit -m "…" && git push`.

## 5. Setup backend PHP (XAMPP) di PC baharu
1. Pasang **XAMPP** (Apache + MySQL/MariaDB + PHP 8+).
2. Salin/clone keseluruhan folder `sisken/` ke dalam `htdocs/` (cth: `C:\xampp\htdocs\sisken\`).
3. Mulakan servis **Apache** dan **MySQL** dalam XAMPP Control Panel.
4. Semak/kemas kini kredensial DB di `php/config.php` (lalai sesuai untuk XAMPP: host `127.0.0.1`, user `root`, tiada kata laluan).
5. Buka pelayar ke `http://localhost/sisken/php/install.php` — ini akan:
   - Cipta pangkalan data `sisken` & semua jadual (`php/schema.sql`)
   - Cipta akaun admin pertama (`admin` / `admin123`) jika jadual Pengguna masih kosong
6. **Selepas berjaya, PADAM atau lindungi `php/install.php`** (elak sesiapa jalankan semula/reset di server produksi).
7. Buka `http://localhost/sisken/index.html`, log masuk dengan `admin` / `admin123`, **tukar kata laluan serta-merta** (butang 🔑 dalam app).
8. `API_URL` dalam `js/core.js` sudah ditetapkan kepada `"php/api.php"` (laluan relatif) — tidak perlu diubah selagi frontend & backend berkongsi server yang sama. Kalau backend dihoskan berasingan, tukar kepada URL penuh.

### Migrasi data sedia ada dari Google Sheets (jika perlu)
Kalau ada data produksi (Kenderaan/Pemandu/Tempahan/Selenggaraan/Pengguna) dalam Google Sheet
lama yang perlu dibawa masuk: eksport setiap helaian sebagai CSV, kemudian import ke jadual
MySQL yang sepadan (`kenderaan`, `pemandu`, `tempahan`, `selenggaraan`, `pengguna`) — lajur
sama nama seperti header CSV. `phpMyAdmin` (disertakan dalam XAMPP) boleh import CSV terus ke
jadual sedia ada, atau minta Claude Code tulis skrip import khusus ikut format CSV sebenar.

## 6. Kembali kepada backend legasi (Google Apps Script) — jika perlu
Kod asal masih ada di `gas/Code.js` / `Code.gs.txt`. Untuk guna semula:
1. Tukar `API_URL` dalam `js/core.js` kembali kepada URL `/exec` Apps Script.
2. Ikut langkah clasp seperti biasa (perlukan Node 18 kerana clasp ada pepijat dengan Node 24):
```bash
npm install -g @google/clasp@2.4.2
# Dapatkan Node 18 mudah-alih, ekstrak ke sisken/.node18/
"<path>/.node18/node-v18.20.5-win-x64/node.exe" "<path-npm-global>/@google/clasp/build/src/index.js" login
```
```bash
N18="sisken/.node18/node-v18.20.5-win-x64/node.exe"
CLASP="<npm-global>/@google/clasp/build/src/index.js"
cd sisken/gas
"$N18" "$CLASP" push --force
"$N18" "$CLASP" deploy -i AKfycbzIv8zPV-KG…<deployment-id-penuh> -d "nota versi"
```

**Deploy frontend (selepas edit mana-mana fail web, tak kira backend PHP atau GAS):**
```bash
cd sisken
rm -rf public && mkdir -p public/js public/php
cp index.html style.css sw.js manifest.json icon-192.png icon-512.png public/
cp js/*.js public/js/
cp php/*.php public/php/          # jika deploy backend PHP sekali
# upload SELURUH folder public/ ke hosting
# kalau tambah/buang fail js → kemas kini senarai ASET + naikkan CACHE dalam sw.js
```

## 7. Perkara penting (gotchas)
- ⚠️ **Kata laluan admin default `admin / admin123` MASIH AKTIF** — TUKAR segera (butang 🔑 dalam app).
- ⚠️ **PADAM/lindungi `php/install.php`** selepas pemasangan pertama — ia boleh mencipta semula akaun admin jika jadual Pengguna kosong.
- **HTTPS** diperlukan untuk ciri PWA (offline/install). HTTP biasa app masih jalan tapi tanpa PWA.
- Backend PHP berjalan on-premise/LAN — **tiada pergantungan internet** untuk operasi harian (berbeza daripada backend GAS lama yang perlukan capaian ke `script.google.com`).
- **Data kini di MySQL tempatan** (`php/config.php`), bukan Google Sheets — pastikan backup DB berkala (`mysqldump`).
- Backend rujukan semasa = `php/api.php` (port terus logik daripada `gas/Code.js` — sama kontrak, sama peraturan kelulusan/konflik/audit).
- Jadual MySQL (`php/schema.sql`): Kenderaan, Pemandu, Tempahan, Selenggaraan, Pengguna, Sesi, Tetapan, Keselamatan, Log — nama sama seperti helaian Google Sheets asal (huruf kecil untuk nama jadual).

## 8. Apa yang dah disiapkan (ikut commit)
- **Migrasi backend**: Google Apps Script/Sheets → PHP + MySQL (PDO, prepared statements), port setiap tindakan API (login, awam, load, vehicleSave, driverSave, maintSave, maintDel, bookingAdd/Approve/Reject/Complete/Edit, tukarPw, drvStatus, userAdd/Reset/Del, auditLog, logPurge, logout). Dikunci dengan `GET_LOCK` MySQL (setara `LockService` GAS) untuk elak race condition.
- Keselamatan: kawalan peranan server (anti lulus-sendiri), tapis data bukan-admin, kunci brute-force (5 cubaan/15 min), hash bersalt (SHA-256+salt, sama algoritma seperti asal).
- Integriti: kelulusan + semakan konflik di server, sekat tarikh/masa lampau, ID tempahan dijana server.
- Ciri: status kenderaan auto, arkib (soft-delete) kenderaan/pemandu, pemandu kemas kini odometer/minyak/lokasi semasa selesai, log audit + padam >1 tahun.
- UI: menu hamburger telefon, navigasi minggu (kalendar) jadual pemandu (admin + paparan umum), label "Bersedia".
- Senibina: frontend dipecahkan kepada `style.css` + `js/*.js` setiap menu.

## 9. Cadangan kerja seterusnya (belum dibuat)
- Tukar `admin123` (PALING penting) selepas setiap pemasangan baharu.
- Hashing PBKDF2 (regang) — sekarang SHA-256 satu pusingan + salt (sama seperti asal GAS).
- Butang "nyaharkib" untuk pulih kenderaan/pemandu.
- Auto-padam log audit (cron/scheduled task) — sekarang manual melalui aksi `logPurge`.
- Skrip import CSV khusus untuk bawa masuk data sejarah dari Google Sheets lama ke MySQL (rujuk bahagian 5).
- Padam/lindungi `php/install.php` selepas pemasangan produksi (jangan tinggal boleh diakses awam).
- Backup automatik `mysqldump` berjadual untuk DB `sisken`.

## 10. Uji cepat
- Backend PHP hidup: buka `php/api.php` dalam browser (kaedah GET) → patut papar `{"ok":true,"mesej":"SisKEN API aktif…"}`.
- Log masuk: `admin` / `admin123` (selepas `install.php` dijalankan) — patut terus papar Papan Pemuka dengan data yang disimpan di MySQL.
- Pratonton frontend tempatan: server statik mudah di port mana-mana (atau terus melalui Apache/XAMPP), buka `index.html`.
