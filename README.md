# SisKEN — Sistem Tempahan Kenderaan PPAT

Nota projek & panduan **sambung kerja di PC lain**. Baca fail ni dulu.
> Untuk AI/Claude di PC baharu: baca README ini sepenuhnya sebelum buat apa-apa.

---

## 1. Apa ini
PWA tempahan kenderaan untuk **Perbadanan Perpustakaan Awam Terengganu (PPAT)**.
- **Frontend** — fail statik (HTML/CSS/JS biasa, tiada build tool).
- **Backend** — PHP + MySQL (`php/api.php`), guna PDO + prepared statements. Dihoskan sama server dengan frontend (mis. XAMPP), berjalan on-premise/LAN — konsisten dengan seni bina SisRIN.
- Peranan: **superadmin** (admin + urus akaun admin & log audit), **admin** (urus operasi harian), **pemandu** (tugasan sendiri + tanda selesai), **pemohon** (hantar & lihat tempahan sendiri).

## 2. Struktur fail
```
sisken/
  index.html        ← shell nipis: <link> + <script src>
  style.css         ← semua CSS
  js/
    core.js         ← state, utiliti, API (API_URL -> php/api.php), login, render(), nav (DIKONGSI)
    awam.js dashboard.js tempahan.js kenderaan.js pemandu.js
    selenggara.js laporan.js pengguna.js tugasan.js penolakan.js log.js
    boot.js         ← mulaApp() + daftar service worker (MUAT TERAKHIR)
  sw.js             ← service worker PWA (ada senarai ASET + nombor CACHE)
  manifest.json  icon-192.png  icon-512.png
  php/
    config.php      ← kredensial DB (DB_HOST/DB_NAME/DB_USER/DB_PASS)
    lib.php         ← utiliti dikongsi (hash kata laluan, masa KL, validasi tarikh/masa)
    .htaccess       ← sekat akses web terus ke config.php / lib.php / schema.sql (perlu AllowOverride)
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
   - Tambah lajur baharu pada pemasangan SEDIA ADA (migrasi) — selamat dijalankan berulang kali
   - Cipta akaun admin pertama (`admin` / `admin123`) jika jadual Pengguna masih kosong
6. **Selepas berjaya, PADAM atau lindungi `php/install.php`** (elak sesiapa jalankan semula/reset di server produksi).
7. Buka `http://localhost/sisken/index.html`, log masuk dengan `admin` / `admin123` — sistem akan **memaksa anda menetapkan kata laluan baharu** sebelum sesi dibuka.
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
cp php/*.php php/schema.sql php/.htaccess public/php/
# upload SELURUH folder public/ ke hosting (php/api.php & js/*.js MESTI dikemas kini serentak)
# kalau tambah/buang fail js → kemas kini senarai ASET + naikkan CACHE dalam sw.js
# setiap kali ubah js/css → naikkan nombor ?v= pada <script>/<link> dalam index.html (sama dengan nombor CACHE) supaya pelayar tidak guna fail lama
```

## 7. Perkara penting (gotchas)
- Kata laluan lalai `admin / admin123` **tidak boleh kekal**: log masuk pertama memaksa pertukaran, dan `admin123` ditolak di semua tempat kata laluan ditetapkan (`PW_LALAI` dalam `php/lib.php`).
- `php/install.php` **terkunci sendiri** selepas dipasang (jadual Pengguna ada rekod): tiada akaun/DB dicipta dan tiada butiran ralat dipaparkan — hanya migrasi lajur baharu. Masih disyorkan PADAM di pelayan produksi.
- **HTTPS** diperlukan untuk ciri PWA (offline/install). HTTP biasa app masih jalan tapi tanpa PWA.
- Backend berjalan on-premise/LAN — **tiada pergantungan internet** untuk operasi harian.
- **Data di MySQL tempatan** (`php/config.php`) — pastikan backup DB berkala (`mysqldump`).
- Jadual MySQL (`php/schema.sql`): kenderaan, pemandu, tempahan, selenggaraan, pengguna, sesi, tetapan, keselamatan, penolakan, log.
- **Selepas menarik kod baharu, jalankan semula `php/install.php` SEKALI** — ia menambah lajur yang baharu (cth. `tempahan.diterima`). Tanpa langkah ini API akan gagal dengan ralat lajur tidak wujud.
- Ralat pelayan dicatat dalam log ralat PHP (XAMPP: `C:\xampp\php\logs\php_error_log` / log Apache) — pengguna hanya nampak mesej umum.

## 8. Apa yang dah disiapkan (ikut commit)
- **Backend PHP + MySQL** (PDO, prepared statements): login, awam, load, vehicleSave, driverSave, maintSave, maintDel, bookingAdd/Approve/Reject/Complete/Edit/Cancel, tukarPw, drvStatus, userAdd/Reset/Del, auditLog, logPurge, logout. Setiap permintaan dikunci dengan `GET_LOCK` MySQL untuk elak race condition.
- Keselamatan: kawalan peranan server (anti lulus-sendiri), tapis data bukan-admin, kunci brute-force (5 cubaan/15 min, ikut ID + IP), kata laluan `password_hash()` (akaun lama SHA-256 dinaik taraf automatik semasa log masuk), tiada CORS (same-origin sahaja), `php/.htaccess` menyekat `config.php`/`lib.php`/`schema.sql`, validasi format tarikh/masa & ID pengguna di server.
- Integriti: kelulusan + semakan konflik di server, sekat tarikh/masa lampau, ID rekod dijana server, simpanan satu rekod (tiada tulis-ganti jadual).
- **Superadmin** (lajur `pengguna.superadmin`): hanya superadmin boleh mencipta/memadam akaun admin, menetapkan semula kata laluan akaun admin, melantik/menarik status superadmin (`userSetSuper`), dan memadam log audit (`logPurge`). Admin biasa kekal menguruskan tempahan, kenderaan, pemandu serta akaun pemohon/pemandu. Sistem sentiasa mengekalkan sekurang-kurangnya seorang superadmin. Migrasi menaik taraf SEMUA admin sedia ada kepada superadmin supaya tiada sesiapa terkunci — tarik balik yang tidak perlu melalui tab Pengguna.
- **Sesi kekal selepas muat semula:** token disimpan dalam `sessionStorage` (kunci `sisken_token`) dan dipulihkan oleh `pulihSesi()` dalam `js/core.js` melalui aksi `load`, yang kini memulangkan rekod `user` segar dari pangkalan data. Token hilang apabila tab ditutup, jadi sesi tidak tertinggal terbuka pada komputer yang dikongsi. Peranan/kebenaran TIDAK disimpan di sisi klien.
- **Tukar nama akaun** (`userRename`): butang "✎ Nama" dalam tab Pengguna. Admin biasa boleh menukar nama akaun pemohon/pemandu & namanya sendiri; akaun admin hanya oleh superadmin. Nama akaun dan nama rekod pemandu yang dipautkan sentiasa diselaraskan (kedua-dua arah: `userRename` dan `driverSave`).
- **Nombor telefon untuk dihubungi** (lajur `tempahan.telefonPemohon`, wajib pada borang tempahan): pemandu yang ditugaskan melihat nombor pemohon; pemohon melihat nombor pemandu — tetapi `buildData_` hanya mendedahkan `pemandu.telefon` bagi pemandu yang terlibat dalam tempahan diluluskan/selesai pengguna itu sendiri. Paparan umum sebelum log masuk tidak mengandungi sebarang nombor telefon.
- **Pengesahan pemandu:** tempahan yang diluluskan admin perlu diterima pemandu (`bookingAccept`). Pemandu boleh menolak dengan sebab (`bookingDecline`) — tempahan kembali ke "Menunggu Kelulusan", kenderaan & pemandu dilepaskan, sebab direkod dalam jadual `penolakan` DAN Log Audit. Butang "Tandakan Selesai" hanya muncul selepas tugasan diterima (admin tiada had). Jika admin mengedit tarikh/masa tempahan yang telah diterima, pengesahan terbatal dan pemandu perlu terima semula.
- **Tiada pengesahan = tiada perjalanan:** kenderaan TIDAK bertukar "Dalam Perjalanan" selagi pemandu belum menekan Terima. Jika masa perjalanan tiba tanpa pengesahan, kenderaan dipapar MERAH "Belum Disahkan Pemandu" dan kad tempahan memberi amaran kepada admin.
- **Pemberitahuan dalam app** (`semakPerubahan()` dalam `js/core.js`): `segarData()` dijalankan setiap `SELANG_SEMAK` (60s) semasa tab kelihatan, dan membandingkan status tempahan dengan semakan sebelumnya. Amaran ikut peranan — pemandu: tugasan baharu; admin: tempahan menunggu kelulusan; pemohon: tempahannya diluluskan/ditolak. Lencana menu menunjukkan bilangan perkara menunggu tindakan, dan tajuk tab pelayar menunjukkan kiraan `(N)`. BUKAN Web Push — tiada keperluan HTTPS atau internet keluar, tetapi hanya berfungsi semasa app dibuka.
- **Tukar Tugasan (admin, `bookingReassign`):** tukar kenderaan dan/atau pemandu bagi tempahan diluluskan, selagi perjalanan belum bermula. Semakan kapasiti & pertindihan sentiasa dijalankan (`semakTugasan_`, dikongsi dengan `bookingApprove`); status arkib/selenggaraan/cuti hanya disemak bagi kenderaan atau pemandu yang BERUBAH. Sebarang pertukaran membatalkan pengesahan pemandu — pemandu perlu menerima semula.
- **Tarik Balik Tugasan (admin, `bookingUnassign`):** untuk tempahan diluluskan yang pemandu belum sahkan — tempahan kembali ke "Menunggu Kelulusan" dan kenderaan/pemandu dilepaskan supaya boleh ditugaskan semula. Tempahan yang telah bermula tetapi belum disahkan pemandu juga masih boleh diedit admin (sekatan "sedang berjalan" hanya terpakai selepas pemandu mengesahkan).
- **Tempoh bersedia 30 minit:** setelah tugasan diterima, kenderaan dipapar "Tidak Tersedia — Sedang Disiapkan" bermula 30 minit sebelum masa bertolak (pemalar `MINIT_SEDIA` dalam `js/core.js`). Ini paparan sahaja — semakan pertindihan di server kekal ikut masa sebenar perjalanan.
- **Pemohon edit/batal tempahan sendiri**: `bookingEdit` & `bookingCancel` dibenarkan kepada pemilik tempahan selagi status `menunggu` (status baharu `dibatalkan`). **Admin tolak mesti beri sebab** (`bookingReject` + `sebab`, disimpan dalam `tempahan.sebabTolak`, dipaparkan kepada pemohon). Pemandu/kenderaan/akaun pemandu tidak boleh dipadam selagi ada tempahan `diluluskan` (belum selesai atau dalam perjalanan).
- **Julat tarikh tempahan**: pelayan hanya menghantar tempahan aktif (`menunggu`/`diluluskan`) + rekod lain sejak `HARI_SEJARAH` (90) hari lalu (`readTempahanJulat_()` dalam `api.php`). Pelayar meminta rekod lebih lama melalui medan `dari` (`pastikanData()` dalam `core.js`) apabila pengguna memilih julat tarikh, bulan laporan lama atau minggu lama pada jadual pemandu. Senarai Tempahan & Tugasan Saya ada penapis tarikh dari/hingga dan paginasi 20/muka.
- **Laporan PDF**: butang "Cetak / Simpan PDF" (`cetakLaporan()` dalam `laporan.js`) menetapkan `@page` A4 melintang dan membuka dialog cetak pelayar (pilih "Save as PDF"). Susun atur cetakan dalam `style.css` (`@media print`): teks dibalut pada sempadan perkataan, kepala jadual berulang, baris tidak dipecah merentas halaman.
- **Tab "Tugasan Ditolak"** (`js/penolakan.js`, aksi `penolakanList`): admin melihat semua penolakan, pemandu melihat penolakannya sendiri — berserta sebab, kenderaan/pemandu asal dan status tempahan terkini. Rekod kekal walaupun tempahan diluluskan semula kemudian. Pelayan memulangkan 200 rekod terkini; carian & paginasi (20/muka) dilakukan di pelayar. Log Audit kekal seperti biasa.
- Ciri: status kenderaan auto, arkib (soft-delete) kenderaan/pemandu, pemandu kemas kini odometer/minyak/lokasi semasa selesai, log audit + padam >1 tahun, penapis/carian/paginasi Tempahan & Tugasan.
- UI: menu hamburger telefon, navigasi minggu (kalendar) jadual pemandu (admin + paparan umum), label "Bersedia".
- Senibina: frontend dipecahkan kepada `style.css` + `js/*.js` setiap menu.

## 9. Cadangan kerja seterusnya (belum dibuat)
- Had panjang input disemak di pelayan (`semakPanjang_()` dalam `php/lib.php`) — jika lajur DB diubah, kemas kini had di `api.php` dan `maxlength` borang sekali.
- Butang "nyaharkib" untuk pulih kenderaan/pemandu.
- Auto-padam log audit (cron/scheduled task) — sekarang manual melalui aksi `logPurge`.
- Padam/lindungi `php/install.php` selepas pemasangan produksi (jangan tinggal boleh diakses awam).
- Backup automatik `mysqldump` berjadual untuk DB `sisken`.

## 10. Uji cepat
- Backend PHP hidup: buka `php/api.php` dalam browser (kaedah GET) → patut papar `{"ok":true,"mesej":"SisKEN API aktif…"}`.
- Log masuk: `admin` / `admin123` (selepas `install.php` dijalankan) — papar skrin "Tetapkan Kata Laluan Baharu", kemudian Papan Pemuka dengan data yang disimpan di MySQL.
- Pratonton frontend tempatan: terus melalui Apache/XAMPP (`http://localhost/sisken/index.html`).
