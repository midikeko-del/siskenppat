# SisKEN — Sistem Tempahan Kenderaan PPAT

Nota projek & panduan **sambung kerja di PC lain**. Baca fail ni dulu.
> Untuk AI/Claude di PC baharu: baca README ini sepenuhnya sebelum buat apa-apa.

---

## 1. Apa ini
PWA tempahan kenderaan untuk **Perbadanan Perpustakaan Awam Terengganu (PPAT)**.
- **Frontend** — fail statik (HTML/CSS/JS biasa, tiada build tool). Di-host di mana-mana server web.
- **Backend** — Google Apps Script (`gas/Code.js`) + Google Sheets sebagai pangkalan data. Berjalan di pelayan Google, dipanggil melalui URL `/exec`.
- Peranan: **admin** (urus semua), **pemandu** (tugasan sendiri + tanda selesai), **pemohon** (hantar & lihat tempahan sendiri).

## 2. Struktur fail
```
sisken/
  index.html        ← shell nipis: <link> + <script src>
  style.css         ← semua CSS
  js/
    core.js         ← state, utiliti, API, login, render(), nav (DIKONGSI)
    awam.js dashboard.js tempahan.js kenderaan.js pemandu.js
    selenggara.js laporan.js pengguna.js tugasan.js log.js
    boot.js         ← mulaApp() + daftar service worker (MUAT TERAKHIR)
  sw.js             ← service worker PWA (ada senarai ASET + nombor CACHE)
  manifest.json  icon-192.png  icon-512.png
  gas/
    Code.js         ← backend Apps Script (SUMBER RUJUKAN untuk clasp push)
    appsscript.json .clasp.json (ada scriptId)
  Code.gs.txt       ← salinan backend (selari dgn gas/Code.js)
  public/           ← folder DEPLOY (salinan fail web; git-ignored)
  .node18/          ← Node 18 mudah-alih untuk clasp (git-ignored)
```
- Frontend semua **global scope**, dimuat ikut urutan (core dulu, boot akhir). Tiada modul/bundler.
- Edit ciri → edit `js/<menu>.js` berkaitan. Edit backend → `gas/Code.js`.

## 3. ID & URL penting
| Perkara | Nilai |
|---|---|
| Apps Script ID | `1cWtkQE7c9IHRuygS2eeyxxacb-NuMaPSiw1pqtnJuHyR-iLzexYYAG1p` |
| Deployment web app (live) | `AKfycbzIv8zPV-KGmKJCTc345abS62abIGstMgYcDhvOVvvc6k03h3165g0GZzITa5iA0sHaeg` |
| API_URL (dalam `js/core.js`) | `https://script.google.com/macros/s/AKfycbzIv8zPV-KG…/exec` |
| Akaun Google pemilik Sheet | midikeko@gmail.com |

## 4. Pindah ke PC lain
Repo ada di **GitHub (PRIVATE):** `https://github.com/midikeko-del/siskenppat`
Di PC baharu:
```bash
gh auth login          # log masuk akaun GitHub midikeko-del
gh repo clone midikeko-del/siskenppat
# ATAU: git clone https://github.com/midikeko-del/siskenppat.git
```
Kemudian ikut langkah 5 (setup clasp) kalau nak deploy backend.
> `.node18/` dan `public/` TIDAK disimpan dalam git (gitignore) — jana/pasang semula di PC baharu.
> Selepas buat perubahan: `git add -A && git commit -m "…" && git push`.

## 5. Setup di PC baharu (untuk deploy backend via clasp)
> Hanya perlu kalau nak `clasp push` backend. Untuk edit frontend sahaja, tak perlu.

clasp ada **pepijat dengan Node 24** (`node-fetch` "Premature close"). **WAJIB guna Node 18.**
```bash
# 1. Pasang Node.js (mana-mana versi untuk npm)        cth: winget install OpenJS.NodeJS.LTS
# 2. Pasang clasp versi stabil
npm install -g @google/clasp@2.4.2
# 3. Dapatkan Node 18 mudah-alih (clasp jalankan ATAS ni)
#    Muat turun node-v18.20.5-win-x64.zip dari nodejs.org → ekstrak ke sisken/.node18/
# 4. Login (sekali) — guna Node 18:
"<path>/.node18/node-v18.20.5-win-x64/node.exe" "<path-npm-global>/@google/clasp/build/src/index.js" login
#    Hidupkan juga "Google Apps Script API" di https://script.google.com/home/usersettings
```
`gas/.clasp.json` sudah ada scriptId, jadi tak perlu clone semula.

## 6. Cara deploy
**Frontend (selepas edit mana-mana fail web):**
```bash
cd sisken
rm -rf public && mkdir -p public/js
cp index.html style.css sw.js manifest.json icon-192.png icon-512.png public/
cp js/*.js public/js/
# upload SELURUH folder public/ (termasuk js/) ke hosting
# kalau tambah/buang fail js → kemas kini senarai ASET + naikkan CACHE dalam sw.js
```
**Backend (selepas edit `gas/Code.js`) — guna Node 18:**
```bash
N18="sisken/.node18/node-v18.20.5-win-x64/node.exe"
CLASP="<npm-global>/@google/clasp/build/src/index.js"
cd sisken/gas
"$N18" "$CLASP" push --force
"$N18" "$CLASP" deploy -i AKfycbzIv8zPV-KG…<deployment-id-penuh> -d "nota versi"
# guna deploy -i <id sedia ada> supaya URL /exec KEKAL sama (index.html tak perlu tukar)
```

## 7. Perkara penting (gotchas)
- ⚠️ **Kata laluan admin default `admin / admin123` MASIH AKTIF** — TUKAR segera (butang 🔑 dalam app).
- **HTTPS** diperlukan untuk ciri PWA (offline/install). HTTP biasa app masih jalan tapi tanpa PWA.
- **Internet diperlukan** — backend di Google; rangkaian tertutup tak boleh capai `script.google.com`.
- **Data di Google Sheets** (cloud Google), bukan on-premise — semak dasar data jabatan.
- Backend rujukan = `gas/Code.js` (yang clasp push). `Code.gs.txt` cuma salinan.
- Helaian Google Sheet dicipta automatik: Kenderaan, Pemandu, Tempahan, Selenggaraan, Pengguna, Sesi, Tetapan, **Keselamatan** (cubaan login), **Log** (audit).

## 8. Apa yang dah disiapkan (ikut commit)
- Keselamatan: kawalan peranan server (anti lulus-sendiri), tapis data bukan-admin, kunci brute-force (5 cubaan/15 min), hash bersalt.
- Integriti: kelulusan + semakan konflik di server, sekat tarikh/masa lampau, ID tempahan dijana server.
- Ciri: status kenderaan auto, arkib (soft-delete) kenderaan/pemandu, pemandu kemas kini odometer/minyak/lokasi semasa selesai, log audit + padam >1 tahun.
- UI: menu hamburger telefon, navigasi minggu (kalendar) jadual pemandu (admin + paparan umum), label "Bersedia".
- Senibina: frontend dipecahkan kepada `style.css` + `js/*.js` setiap menu.

## 9. Cadangan kerja seterusnya (belum dibuat)
- Tukar `admin123` (PALING penting).
- Hashing PBKDF2 (regang) — sekarang SHA-256 satu pusingan + salt.
- Butang "nyaharkib" untuk pulih kenderaan/pemandu.
- Auto-padam log audit (time-driven trigger) — sekarang manual.
- Jangka panjang: tukar model "save semua" (admin) → update per-rekod; atau migrasi backend ke pelayan jabatan + pangkalan data kalau perlu on-premise.

## 10. Uji cepat
- Backend hidup: buka API_URL dalam browser → patut papar `{"ok":true,"mesej":"SisKEN API aktif…"}`.
- Pratonton frontend tempatan: server statik mudah di port mana-mana, buka `index.html`.
