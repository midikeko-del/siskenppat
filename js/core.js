/* SisKEN — core.js (edit di sini) */
/* ============================================================
   SAMBUNGAN BACKEND — PHP + MySQL (php/api.php)
   Backend kini dihoskan bersama frontend (satu server, satu asal
   [same-origin]), jadi laluan relatif "php/api.php" sudah cukup.
   Kalau backend dihoskan di domain/port lain, tukar kepada URL
   penuh (cth: "https://sisken.ppat.gov.my/php/api.php").
   Jika dibiarkan kosong, app berjalan dalam mod tempatan (data
   contoh, tidak disimpan). Lihat README.md bahagian "Backend PHP".
   ============================================================ */
const API_URL = "php/api.php";

/* ================= DATA ================= */
/* ===== Tarikh & masa sebenar — zon Asia/Kuala_Lumpur (GMT+8) ===== */
const pad2 = n => String(n).padStart(2, "0");
function klNow(){
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const g = (t) => parts.find(x => x.type === t).value;
  return { tarikh: `${g("year")}-${g("month")}-${g("day")}`, masa: `${g("hour")}:${g("minute")}` };
}
/* Tambah n hari kepada tarikh ISO (yyyy-mm-dd) */
function tambahHari(iso, n){
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
/* Array 7 hari (Ahad–Sabtu) untuk minggu pada offset tertentu (0 = minggu ini,
   -1 = minggu lepas, +1 = minggu hadapan). Minggu Terengganu bermula Ahad. */
function mingguUntuk(offset){
  const hari = new Date(HARI_INI + "T00:00:00Z").getUTCDay(); // 0 = Ahad
  const ahad = tambahHari(HARI_INI, -hari + offset * 7);
  return Array.from({ length: 7 }, (_, i) => tambahHari(ahad, i));
}
/* HARI_INI & MINGGU dikira SEMULA setiap render (lihat render()) supaya tetap
   betul walaupun app dibuka melepasi tengah malam tanpa reload. */
let HARI_INI, MINGGU;
function segarTarikh(){
  HARI_INI = klNow().tarikh; // tarikh hari ini di Malaysia
  MINGGU = mingguUntuk(0);   // minggu semasa (untuk paparan umum)
}
segarTarikh();
const HARI = ["Ahad","Isnin","Selasa","Rabu","Khamis","Jumaat","Sabtu"];

let vehicles = [
  {id:"K1", plat:"WUM 3271", model:"Toyota Vellfire", jenis:"Kenderaan Rasmi", kapasiti:7, status:"tersedia", lokasi:"Garaj Utama, Aras B1", odometer:48210, roadtax:"2026-11-30", bahanApi:85},
  {id:"K2", plat:"VFC 8842", model:"Proton Persona", jenis:"Kereta Pejabat", kapasiti:5, status:"dalam_perjalanan", lokasi:"Putrajaya — Presint 1", odometer:91450, roadtax:"2026-08-15", bahanApi:60},
  {id:"K3", plat:"WXD 5190", model:"Toyota Hiace", jenis:"Van Jabatan", kapasiti:11, status:"tersedia", lokasi:"Garaj Utama, Aras B1", odometer:120300, roadtax:"2026-07-02", bahanApi:92},
  {id:"K4", plat:"VHQ 2236", model:"Toyota Hilux", jenis:"Pacuan 4 Roda", kapasiti:5, status:"selenggara", lokasi:"Bengkel Panel — Cheras", odometer:156780, roadtax:"2027-01-19", bahanApi:40},
  {id:"K5", plat:"WC 5012 Q", model:"Perodua Aruz", jenis:"Kereta Pejabat", kapasiti:7, status:"tersedia", lokasi:"Parkir Berbumbung, Blok C", odometer:33980, roadtax:"2026-09-08", bahanApi:75},
];

let drivers = [
  {id:"P1", nama:"En. Azman bin Hashim", telefon:"012-338 4471", lesen:"D, E", status:"bertugas"},
  {id:"P2", nama:"En. Ravi a/l Subramaniam", telefon:"017-220 9183", lesen:"D", status:"bertugas"},
  {id:"P3", nama:"En. Mohd Faiz bin Omar", telefon:"019-774 5520", lesen:"D, E, GDL", status:"bertugas"},
  {id:"P4", nama:"En. Lim Chee Keong", telefon:"011-1452 8830", lesen:"D", status:"cuti"},
];

let bookings = [
  {id:"T-1042", pemohon:"Pn. Nurul Aina", bahagian:"Bahagian Khidmat Pengurusan", tujuan:"Mesyuarat Penyelarasan KPI", destinasi:"Putrajaya, Presint 1", tarikh:"2026-06-10", masaMula:"08:30", masaTamat:"13:00", penumpang:3, status:"diluluskan", vehicleId:"K2", driverId:"P1"},
  {id:"T-1043", pemohon:"En. Hafiz Rahman", bahagian:"Unit Audit Dalam", tujuan:"Lawatan audit cawangan", destinasi:"Shah Alam, Seksyen 14", tarikh:"2026-06-11", masaMula:"09:00", masaTamat:"17:00", penumpang:4, status:"menunggu", vehicleId:null, driverId:null},
  {id:"T-1044", pemohon:"Cik Tan Mei Ling", bahagian:"Bahagian Dasar & Perancangan", tujuan:"Bengkel pemurnian pelan strategik", destinasi:"Port Dickson", tarikh:"2026-06-12", masaMula:"07:30", masaTamat:"18:30", penumpang:9, status:"menunggu", vehicleId:null, driverId:null},
  {id:"T-1041", pemohon:"En. Syafiq Idris", bahagian:"Unit Komunikasi Korporat", tujuan:"Liputan majlis perasmian", destinasi:"KLCC, Kuala Lumpur", tarikh:"2026-06-09", masaMula:"13:00", masaTamat:"17:30", penumpang:2, status:"selesai", vehicleId:"K5", driverId:"P2"},
  {id:"T-1045", pemohon:"Pn. Salmah Yusof", bahagian:"Bahagian Kewangan", tujuan:"Urusan perbendaharaan", destinasi:"Kompleks Kementerian Kewangan, Putrajaya", tarikh:"2026-06-11", masaMula:"10:00", masaTamat:"12:30", penumpang:2, status:"menunggu", vehicleId:null, driverId:null},
];

let maintenance = [
  {id:"S1", vehicleId:"K4", tarikh:"2026-06-05", jenis:"Servis Berkala", butiran:"Servis 155,000 km — tukar minyak enjin, penapis & semakan brek", kos:850, odometer:156780, bengkel:"Bengkel Panel — Cheras", status:"dalam_proses"},
  {id:"S2", vehicleId:"K2", tarikh:"2026-05-18", jenis:"Tayar", butiran:"Tukar 4 tayar baharu + penjajaran (alignment) & pengimbangan", kos:1280, odometer:90100, bengkel:"Syarikat Tayar Maju Sdn Bhd", status:"selesai"},
  {id:"S3", vehicleId:"K3", tarikh:"2026-05-02", jenis:"Servis Berkala", butiran:"Servis 118,000 km — minyak enjin, penapis udara & gear box", kos:620, odometer:118020, bengkel:"Pusat Servis Toyota, Cheras", status:"selesai"},
  {id:"S4", vehicleId:"K1", tarikh:"2026-04-22", jenis:"Elektrikal", butiran:"Ganti bateri & semakan sistem pengecasan", kos:540, odometer:47100, bengkel:"Pusat Servis Toyota, Cheras", status:"selesai"},
  {id:"S5", vehicleId:"K5", tarikh:"2026-06-20", jenis:"Servis Berkala", butiran:"Servis berjadual 35,000 km", kos:0, odometer:33980, bengkel:"Pusat Servis Perodua, Sg. Besi", status:"dijadual"},
];

let nextNum = 1046;
let nextVeh = 6;
let nextDrv = 5;
let nextSel = 6;
let rptBulan = HARI_INI.slice(0, 7); // bulan semasa
let selFilter = "semua";
let tempahanFilter = "semua";  // penapis menu Tempahan (admin & pemohon): semua|menunggu|diluluskan|selesai|ditolak|dibatalkan
let tempahanCari = "";         // teks carian menu Tempahan
let tempahanPage = 1;          // muka surat semasa menu Tempahan
let tempahanDari = "", tempahanHingga = "";   // penapis julat tarikh menu Tempahan ("" = lalai)
let tugasanDari = "", tugasanHingga = "";     // penapis julat tarikh menu Tugasan Saya
/* Tarikh paling awal bagi rekod sejarah yang telah dimuat daripada pelayan. Pelayan
   hanya menghantar tempahan aktif + rekod sejak tarikh ini (lalai 90 hari lalu);
   pastikanData() memintanya lebih awal apabila pengguna memilih julat/bulan lama. */
let dataDari = null;
let tugasanFilter = "aktif";   // penapis menu Tugasan Saya (pemandu): aktif|selesai|semua
let tugasanCari = "";          // teks carian menu Tugasan Saya
let tugasanPage = 1;           // muka surat semasa menu Tugasan Saya
const SAIZ_HALAMAN = 20;       // bilangan rekod setiap muka surat (pagination)
let tab = "dashboard";
let tabAwam = "awam";      // paparan sebelum log masuk: "awam" | "manual"
let manualPeranan = "pemohon"; // bahagian manual yang dipilih: "pemohon" | "pemandu"
let editVehId = null; // id kenderaan yang sedang diedit (null = tambah baharu)
let mingguOffset = 0;     // offset minggu jadual pemandu (admin) — 0 = minggu ini
let mingguOffsetAwam = 0; // offset minggu jadual pemandu (paparan umum)

const VSTATUS = {
  tersedia:{label:"Tersedia", cls:"green"},
  menunggu_perjalanan:{label:"Tidak Tersedia — Sedang Disiapkan", cls:"amber"},
  belum_disahkan:{label:"Belum Disahkan Pemandu", cls:"red"},
  dalam_perjalanan:{label:"Dalam Perjalanan", cls:"amber"},
  selenggara:{label:"Selenggaraan", cls:"red"},
};
const BSTATUS = {
  menunggu:{label:"Menunggu Kelulusan", cls:"amber"},
  diluluskan:{label:"Diluluskan", cls:"green"},
  ditolak:{label:"Ditolak", cls:"red"},
  selesai:{label:"Selesai", cls:"gray"},
  dibatalkan:{label:"Dibatalkan", cls:"gray"},
};
const SSTATUS = {
  dijadual:{label:"Dijadualkan", cls:"amber"},
  dalam_proses:{label:"Dalam Proses", cls:"red"},
  selesai:{label:"Selesai", cls:"green"},
};
const JENIS_SEL = ["Servis Berkala","Tayar","Brek","Elektrikal","Penghawa Dingin","Badan / Cat","Enjin / Transmisi","Lain-lain"];

/* ================= UTILITI ================= */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const overlap = (a1,a2,b1,b2) => a1 < b2 && b1 < a2;
/* Jika masa tamat kosong, tempahan dianggap berjalan sehingga pemandu tekan Selesai
   (untuk semakan konflik, ia menghalang sehingga 23:59 atau sehingga ditanda selesai) */
const tamatEf = (b) => b.masaTamat || "23:59";
const paparMasa = (b) => b.masaTamat ? `${b.masaMula}–${b.masaTamat}` : `${b.masaMula} → <i style="font-weight:400">(belum tamat)</i>`;
/* Sokongan tempahan berbilang hari */
const tarikhTamatEf = (b) => b.tarikhTamat || b.tarikh;                       // tarikh hujung efektif
const mulaDT  = (b) => `${b.tarikh} ${b.masaMula}`;                           // titik mula (tarikh+masa)
/* Tempoh bersedia: setelah pemandu menekan "Terima Tugas", kenderaan ditanda tidak
   tersedia lebih awal supaya ia & pemandu sempat disiapkan sebelum bertolak. */
const MINIT_SEDIA = 30;
function tolakMinit(dt, n){
  const [t, m] = String(dt).split(" ");
  const [Y, M, D] = t.split("-").map(Number);
  const [h, mi] = m.split(":").map(Number);
  const d = new Date(Date.UTC(Y, M - 1, D, h, mi - n));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth()+1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}
/* Titik kenderaan mula dikira sibuk — 30 minit lebih awal HANYA jika tugasan telah diterima */
const mulaSibuk = (b) => b.diterima ? tolakMinit(mulaDT(b), MINIT_SEDIA) : mulaDT(b);
const tamatDT = (b) => `${tarikhTamatEf(b)} ${tamatEf(b)}`;                   // titik tamat (tarikh+masa)
const dudukiHari = (b, hari) => b.tarikh <= hari && hari <= tarikhTamatEf(b); // adakah tempahan meliputi hari ini?
const paparTarikh = (b) => (b.tarikhTamat && b.tarikhTamat !== b.tarikh)
  ? `${fmtTarikh(b.tarikh)} – ${fmtTarikh(b.tarikhTamat)}`
  : fmtTarikh(b.tarikh);
const veh = (id) => vehicles.find(v => v.id === id);
const drv = (id) => drivers.find(d => d.id === id);
/* Nombor tempahan daripada ID (cth "T-1055" -> 1055) — untuk susun terbaru dahulu */
const noTempahan = (b) => { const m = /^T-(\d+)$/.exec(String(b.id)); return m ? Number(m[1]) : 0; };
/* Susun senarai tempahan supaya tempahan TERBARU (ID tertinggi) berada paling atas */
const terbaruDahulu = (arr) => [...arr].sort((a, b) => noTempahan(b) - noTempahan(a));
/* Senarai AKTIF (sembunyikan rekod yang diarkib) — veh()/drv() kekal cari semua untuk sejarah */
const kenderaanAktif = () => vehicles.filter(v => v.status !== "dipadam");
const pemanduAktif   = () => drivers.filter(d => d.status !== "dipadam");

function fmtTarikh(iso){
  const bln = ["Jan","Feb","Mac","Apr","Mei","Jun","Jul","Ogo","Sep","Okt","Nov","Dis"];
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return "—"; // tarikh kosong/tidak sah (cth. rekod diimport)
  const [y,m,d] = iso.split("-");
  return `${parseInt(d)} ${bln[parseInt(m)-1]} ${y}`;
}

/* Peraturan sama seperti telefonSah_() di pelayan */
const telefonSahJs = (t) => {
  const s = String(t || "").trim();
  return /^[0-9 +()\-]{7,30}$/.test(s) && s.replace(/\D/g, "").length >= 7;
};

/* Nombor telefon sebagai pautan boleh tekan (berguna pada telefon bimbit) */
const telPaut = (no) => {
  const t = String(no || "").trim();
  if(!t) return "";
  return `<a href="tel:${esc(t.replace(/[^0-9+]/g, ""))}" style="color:inherit;font-weight:600;text-decoration:underline">📞 ${esc(t)}</a>`;
};

const chip = (cfg) => `<span class="chip ${cfg.cls}"><span class="dot"></span>${cfg.label}</span>`;
const rm = (n) => "RM " + n.toLocaleString("ms-MY", {minimumFractionDigits:2});
/* Jumlah jam sebenar tempahan, termasuk yang merentas hari */
const jamTempahan = (b) => {
  if(!b.masaTamat) return 0; // masih berjalan
  const a = new Date(`${b.tarikh}T${b.masaMula}:00`);
  const z = new Date(`${tarikhTamatEf(b)}T${b.masaTamat}:00`);
  return Math.max(0, (z - a) / 3600000);
};
const jam = (m1, m2) => {
  if(!m1 || !m2) return 0; // tempahan masih berjalan (belum ada masa tamat)
  const [h1,n1] = m1.split(":").map(Number), [h2,n2] = m2.split(":").map(Number);
  return Math.max(0, (h2*60+n2 - h1*60-n1) / 60);
};
const fmtBulan = (ym) => {
  const bln = ["Januari","Februari","Mac","April","Mei","Jun","Julai","Ogos","September","Oktober","November","Disember"];
  const [y,m] = ym.split("-");
  return `${bln[parseInt(m)-1]} ${y}`;
};

/* type: undefined/"" = berjaya (✔), "warn" = amaran (⚠️), "err" = ralat (✕) */
function notify(msg, type){
  const t = $("toast");
  const ikon = type === "warn" ? `<span style="color:#fbbf24">⚠️</span>`
             : type === "err"  ? `<span style="color:#f87171">✕</span>`
             :                    `<span style="color:#34d399">✔</span>`;
  t.innerHTML = `${ikon} ${esc(msg)}`;
  t.classList.add("show");
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.remove("show"), 3000);
}

/* Semakan konflik: tempahan diluluskan yang bertindih tarikh & masa pada kenderaan/pemandu sama */
function conflicts(booking, vehicleId, driverId){
  // Konflik = julat (tarikh mula + masa mula) hingga (tarikh tamat + masa tamat) bertindih.
  // Tempahan berbilang hari menyekat KESEMUA hari dalam julatnya.
  return bookings.filter(b =>
    b.id !== booking.id &&
    b.status === "diluluskan" &&
    mulaDT(b) < tamatDT(booking) && mulaDT(booking) < tamatDT(b) &&
    (b.vehicleId === vehicleId || b.driverId === driverId)
  );
}

/* ================= NAVIGASI ================= */
let menuOpen = false; // keadaan menu hamburger (telefon)
function toggleMenu(){ menuOpen = !menuOpen; renderNav(); }

/* ============================================================
   STRUKTUR MENU
   Admin mempunyai banyak modul, jadi ia dikumpulkan dalam menu lungsur
   supaya bar navigasi tidak perlu di-skrol. Tukar susunan di sini sahaja —
   tiada perubahan lain diperlukan.
   ============================================================ */
const NAV_ADMIN = [
  {id:"dashboard", label:"📊 Papan Pemuka"},
  {id:"tempahan",  label:"📅 Tempahan"},
  {grup:"aset",        label:"🚗 Aset", items:[
    {id:"kenderaan",  label:"🚗 Kenderaan"},
    {id:"pemandu",    label:"👥 Jadual Pemandu"},
    {id:"selenggara", label:"🔧 Selenggaraan"},
  ]},
  {grup:"laporan",     label:"📈 Laporan", items:[
    {id:"laporan",   label:"📈 Laporan Bulanan"},
    {id:"penolakan", label:"🚫 Tugasan Ditolak"},
  ]},
  {grup:"pentadbiran", label:"🔐 Pentadbiran", items:[
    {id:"pengguna", label:"🔐 Pengguna"},
    {id:"log",      label:"📜 Log Audit"},
  ]},
];
const NAV_PEMANDU = [
  {id:"tugasan",   label:"🚘 Tugasan Saya"},
  {id:"penolakan", label:"🚫 Tugasan Ditolak"},
  {id:"manual",    label:"📖 Manual Pengguna"},
];
const NAV_PEMOHON = [
  {id:"tempahan", label:"📅 Tempahan"},
  {id:"manual",   label:"📖 Manual Pengguna"},
];

let navBuka = null; // id kumpulan yang sedang terbuka (desktop)
function toggleNavGrup(g){ navBuka = (navBuka === g) ? null : g; renderNav(); }

/* Cari satu item menu (termasuk dalam kumpulan) mengikut id tab */
function cariNavItem(id){
  for(const n of navSemasa()){
    if(n.id === id) return n;
    if(n.items){ const dlm = n.items.find(x => x.id === id); if(dlm) return dlm; }
  }
  return null;
}
function navSemasa(){
  if(!currentUser) return [];
  return isAdmin() ? NAV_ADMIN : (currentUser.peranan === "pemandu" ? NAV_PEMANDU : NAV_PEMOHON);
}

/* Tutup menu lungsur apabila klik di luar nav atau tekan Esc */
document.addEventListener("click", (e) => {
  if(!navBuka) return;
  if(e.target && e.target.closest && e.target.closest("#nav")) return;
  navBuka = null; renderNav();
});
document.addEventListener("keydown", (e) => {
  if(e.key === "Escape" && navBuka){ navBuka = null; renderNav(); }
});

function renderNav(){
  const toggle = $("nav-toggle");
  /* Sebelum log masuk: paparan umum + manual pengguna (untuk pengguna baharu) */
  if(!currentUser){
    const awamItems = [
      {id:"awam", label:"📅 Jadual & Tempahan"},
      {id:"manual", label:"📖 Manual Pengguna"},
    ];
    $("nav").innerHTML = awamItems.map(n => `
      <button class="${tabAwam===n.id?'active':''}" onclick="setTabAwam('${n.id}')">${n.label}</button>`).join("");
    $("nav").classList.toggle("open", menuOpen);
    if(toggle){
      toggle.style.display = "";
      const aktif = awamItems.find(n => n.id === tabAwam);
      toggle.innerHTML = `<span>${menuOpen ? "✕ Tutup Menu" : "☰ " + (aktif ? aktif.label : "Menu")}</span>`;
    }
    return;
  }
  const items = navSemasa();

  /* Lencana = bilangan perkara yang menunggu tindakan pengguna ini */
  const kiraLencana = (n) => {
    if(n.id === "tempahan" && isAdmin()) return bookings.filter(b => b.status === "menunggu").length;
    if(n.id === "tugasan") return bookings.filter(b =>
      b.driverId === currentUser.driverId && b.status === "diluluskan" && !b.diterima).length;
    return 0;
  };
  const butang = (n) => {
    const bil = kiraLencana(n);
    const lencana = bil ? `<span class="badge">${bil}</span>` : "";
    return `<button class="${tab===n.id?'active':''}" onclick="setTab('${n.id}')">${n.label}${lencana}</button>`;
  };
  const kumpulan = (g) => {
    const aktifDalam = g.items.some(x => x.id === tab);
    return `<div class="nav-group">
      <button class="${aktifDalam?'active':''}" onclick="event.stopPropagation();toggleNavGrup('${g.grup}')">
        ${g.label}<span class="nav-caret">▾</span>
      </button>
      <div class="nav-menu ${navBuka===g.grup?'open':''}">${g.items.map(butang).join("")}</div>
    </div>`;
  };

  $("nav").innerHTML = items.map(n => n.items ? kumpulan(n) : butang(n)).join("");
  $("nav").classList.toggle("open", menuOpen);
  if(toggle){
    toggle.style.display = ""; // CSS kawal: tersembunyi di desktop, tampil di telefon
    const aktif = cariNavItem(tab);
    toggle.innerHTML = `<span>${menuOpen ? "✕ Tutup Menu" : "☰ " + (aktif ? aktif.label : "Menu")}</span>`;
  }
}
function setTab(t){ tab = t; menuOpen = false; navBuka = null; render(); } // pilih tab → tutup menu
function setTabAwam(t){ tabAwam = t; menuOpen = false; render(); }

/* ================= RENDER UTAMA ================= */
function render(){
  segarTarikh(); // pastikan HARI_INI & MINGGU sentiasa terkini
  renderNav();
  const m = $("main");
  if(!currentUser){ m.innerHTML = tabAwam === "manual" ? renderManual() : renderAwam(); return; }
  if(tab === "manual") m.innerHTML = renderManual();
  if(tab === "dashboard") m.innerHTML = renderDashboard();
  if(tab === "tempahan") m.innerHTML = renderTempahan();
  if(tab === "kenderaan") m.innerHTML = renderKenderaan();
  if(tab === "pemandu") m.innerHTML = renderPemandu();
  if(tab === "selenggara") m.innerHTML = renderSelenggara();
  if(tab === "laporan") m.innerHTML = renderLaporan();
  if(tab === "pengguna") m.innerHTML = renderPengguna();
  if(tab === "penolakan") m.innerHTML = renderPenolakan();
  if(tab === "log") m.innerHTML = renderLog();
  if(tab === "tugasan") m.innerHTML = renderTugasan();
}

/* ============================================================
   SAMBUNGAN API (backend PHP) + LOG MASUK
   ============================================================ */
const apiAktif = () => !!API_URL; // API_URL relatif ("php/api.php") ATAU URL penuh — kosongkan untuk mod tempatan
/* Data contoh di atas HANYA untuk mod tempatan/demo. Bila backend aktif, mula dengan
   senarai kosong — supaya data rekaan tidak pernah dipaparkan jika pelayan tidak dapat
   dihubungi (luar talian / XAMPP mati). */
if(apiAktif()){ vehicles = []; drivers = []; bookings = []; maintenance = []; }
/* ============================================================
   SESI DISIMPAN DALAM sessionStorage
   Token kekal ketika pelayar dimuat semula / butang back ditekan, tetapi
   HILANG apabila tab ditutup — jadi sesi tidak tertinggal terbuka pada
   komputer yang dikongsi. Hanya token disimpan; peranan & kebenaran
   sentiasa diambil segar daripada pelayan.
   ============================================================ */
const SESI_KEY = "sisken_token";
function simpanSesi(t){ try{ sessionStorage.setItem(SESI_KEY, t); }catch(e){} }
function bacaSesi(){ try{ return sessionStorage.getItem(SESI_KEY) || null; }catch(e){ return null; } }
function buangSesi(){ try{ sessionStorage.removeItem(SESI_KEY); }catch(e){} }

let TOKEN = null;
let currentUser = null;
let users = [];
const isAdmin = () => currentUser && currentUser.peranan === "admin";
/* Superadmin: admin yang boleh mengurus akaun admin lain, menukar status
   superadmin, dan memadam log audit. Admin biasa tidak boleh. */
const isSuper = () => !!(currentUser && currentUser.superadmin);

async function api(action, payload = {}){
  const r = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" }, // elak isu CORS preflight
    body: JSON.stringify({ action, token: TOKEN, dari: dataDari || undefined, ...payload }),
  });
  return await r.json();
}

function setSync(mode){
  const el = $("sync");
  const cfg = {
    local:  ["local", "⬤ Mod Tempatan"],
    loading:["saving","⬤ Memuatkan…"],
    saving: ["saving","⬤ Menyimpan…"],
    ok:     ["ok",    "⬤ Online"],
    err:    ["err",   "⬤ Gagal sambung — data tidak disimpan"],
  }[mode];
  el.className = "sync " + cfg[0];
  el.textContent = cfg[1];
}

function pakaiData(d){
  vehicles = d.vehicles || [];
  drivers = d.drivers || [];
  bookings = d.bookings || [];
  maintenance = d.maintenance || [];
  if(d.users) users = d.users;
  if(d.dari) dataDari = d.dari;
  /* Data yang datang daripada tindakan pengguna sendiri tidak perlu beri amaran —
     rakam keadaan terus. Hanya segarData() yang membandingkan dan memberi amaran. */
  if(!_sedangSegar && currentUser) jejakTempahan = ambilJejak();
  if(d.counters){
    nextNum = d.counters.nextNum || nextNum;
    nextVeh = d.counters.nextVeh || nextVeh;
    nextDrv = d.counters.nextDrv || nextDrv;
    nextSel = d.counters.nextSel || nextSel;
  }
}

/* Simpan SATU rekod melalui tindakan API khusus (vehicleSave/driverSave/maintSave/maintDel).
   Server hanya mengubah rekod tersebut dan memulangkan data terkini — tiada lagi
   tulis-ganti seluruh jadual daripada salinan pelayar (yang boleh memadam tempahan
   pengguna lain). Mod tempatan/demo: jalankan ubahTempatan() sahaja.
   Pulang true jika berjaya. */
async function simpanRekod(action, payload, ubahTempatan, mesejOK){
  if(!apiAktif() || !TOKEN){
    ubahTempatan(); setSync("local"); render();
    if(mesejOK) notify(mesejOK);
    return true;
  }
  setSync("saving");
  try{
    const res = await api(action, payload);
    if(res.sesiTamat){ sesiTamat(); return false; }
    if(res.data) pakaiData(res.data);
    setSync("ok"); render();
    if(!res.ok){ notify(res.ralat || "Gagal menyimpan.", "err"); return false; }
    if(mesejOK) notify(mesejOK);
    return true;
  }catch(e){
    setSync("err"); render(); // render semula — pulihkan kawalan (cth. select) kepada nilai tersimpan
    notify("Gagal menghubungi pelayan — perubahan tidak disimpan.", "err");
    return false;
  }
}

/* ============================================================
   PEMBERITAHUAN DALAM APP
   Sistem menyemak pelayan secara berkala dan memberi amaran apabila ada
   perkara yang memerlukan tindakan. Ini BUKAN Web Push (yang memerlukan
   HTTPS + sambungan internet keluar dari pelayan) — kaedah ini berfungsi
   sepenuhnya dalam LAN jabatan, tetapi hanya semasa app dibuka.
   ============================================================ */
const SELANG_SEMAK = 60000;   // semak pelayan setiap 60 saat
let jejakTempahan = null;     // keadaan tempahan pada semakan sebelumnya
let bilAmaran = 0;            // kiraan untuk tajuk tab pelayar
let _timerSemak = null;
const TAJUK_ASAL = document.title;

function ambilJejak(){
  const m = {};
  for(const b of bookings) m[b.id] = { status:b.status, driverId:b.driverId || "", diterima:b.diterima || "" };
  return m;
}
function kemasTajuk(){ document.title = bilAmaran > 0 ? `(${bilAmaran}) ${TAJUK_ASAL}` : TAJUK_ASAL; }

/* Bandingkan data baharu dengan semakan sebelumnya dan beri amaran yang berkaitan
   dengan peranan pengguna sahaja. Muat pertama hanya merakam keadaan (tiada amaran). */
function semakPerubahan(){
  if(!currentUser) return;
  if(jejakTempahan === null){ jejakTempahan = ambilJejak(); return; }
  const mesej = [];
  const me = currentUser.driverId;

  for(const b of bookings){
    const lama = jejakTempahan[b.id];
    if(isAdmin()){
      if(b.status === "menunggu" && (!lama || lama.status !== "menunggu"))
        mesej.push(`Tempahan ${b.id} menunggu kelulusan.`);
    } else if(currentUser.peranan === "pemandu"){
      const kini  = me && b.driverId === me && b.status === "diluluskan" && !b.diterima;
      const dulu  = lama && me && lama.driverId === me && lama.status === "diluluskan" && !lama.diterima;
      if(kini && !dulu) mesej.push(`Tugasan baharu ${b.id} — sila terima tugasan.`);
    } else {
      if(lama && lama.status === "menunggu"){
        if(b.status === "diluluskan") mesej.push(`Tempahan ${b.id} telah diluluskan.`);
        if(b.status === "ditolak")    mesej.push(`Tempahan ${b.id} telah ditolak${b.sebabTolak ? ` — ${b.sebabTolak}` : ""}.`);
      }
    }
  }
  jejakTempahan = ambilJejak();
  if(mesej.length){
    bilAmaran += mesej.length;
    kemasTajuk();
    notify(mesej.length === 1 ? mesej[0] : `${mesej.length} kemas kini baharu — sila semak senarai.`, "warn");
  }
}

/* Kiraan amaran dikosongkan sebaik pengguna berinteraksi dengan app */
document.addEventListener("click", () => { if(bilAmaran){ bilAmaran = 0; kemasTajuk(); } });

function mulaSemakBerkala(){
  if(_timerSemak) clearInterval(_timerSemak);
  _timerSemak = setInterval(() => {
    if(document.visibilityState === "visible") segarData();
  }, SELANG_SEMAK);
}
function hentiSemakBerkala(){
  if(_timerSemak){ clearInterval(_timerSemak); _timerSemak = null; }
  jejakTempahan = null; bilAmaran = 0; kemasTajuk();
}

/* Muat semula data dari server (bila pengguna kembali ke tab, atau setiap
   SELANG_SEMAK) supaya perubahan pengguna lain kelihatan tanpa log masuk semula. */
let _segarBerjalan = false;
let _sedangSegar = false;
async function segarData(){
  if(!apiAktif() || !TOKEN || _segarBerjalan) return;
  _segarBerjalan = true; _sedangSegar = true;
  try{
    const res = await api("load");
    if(res.sesiTamat){ sesiTamat(); return; }
    if(res.ok && res.data){ pakaiData(res.data); semakPerubahan(); render(); }
  }catch(e){ /* senyap — cuba lagi pada peluang seterusnya */ }
  finally{ _segarBerjalan = false; _sedangSegar = false; }
}
document.addEventListener("visibilitychange", () => { if(document.visibilityState === "visible") segarData(); });

/* ============================================================
   JULAT TARIKH — muat rekod lama atas permintaan + penapis tarikh
   ============================================================ */
/* Pastikan rekod sejak `dari` sudah dimuat. Tiada apa dibuat jika sudah ada. */
async function pastikanData(dari){
  if(!apiAktif() || !TOKEN || !dari || (dataDari && dari >= dataDari)) return;
  while(_segarBerjalan) await new Promise(r => setTimeout(r, 100)); // tunggu semakan berkala selesai
  const lama = dataDari;
  _segarBerjalan = true; dataDari = dari; setSync("loading");
  try{
    const res = await api("load");
    if(res.sesiTamat){ sesiTamat(); return; }
    if(res.ok && res.data){ pakaiData(res.data); setSync("ok"); }
    else { dataDari = lama; setSync("err"); }
  }catch(e){
    dataDari = lama; setSync("err");
    notify("Gagal memuatkan rekod lama daripada pelayan.", "err");
  }finally{ _segarBerjalan = false; }
}

/* Adakah tempahan bertindih dengan julat [dari, hingga]? Kosong = tiada had. */
const dalamJulat = (b, dari, hingga) =>
  (!dari || tarikhTamatEf(b) >= dari) && (!hingga || b.tarikh <= hingga);

/* Kawalan penapis tarikh (dikongsi oleh menu Tempahan & Tugasan Saya) */
function julatTarikhHTML(jenis, dari, hingga){
  const aktif = dari || hingga;
  return `
    <div class="no-print" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px">
      <span class="muted">📆 Tarikh dari</span>
      <input type="date" aria-label="Dari tarikh" style="width:auto" value="${dari}" ${hingga ? `max="${hingga}"` : ""} onchange="setJulat('${jenis}','dari',this.value)">
      <span class="muted">hingga</span>
      <input type="date" aria-label="Hingga tarikh" style="width:auto" value="${hingga}" ${dari ? `min="${dari}"` : ""} onchange="setJulat('${jenis}','hingga',this.value)">
      ${aktif ? `<button class="btn btn-dark" style="padding:6px 12px;font-size:13px" onclick="setJulat('${jenis}','reset')">✕ Set Semula</button>` : ""}
      ${!aktif && dataDari ? `<span class="muted" style="font-size:12px">Lalai: semua yang aktif + rekod sejak ${fmtTarikh(dataDari)}. Pilih tarikh untuk rekod lebih lama.</span>` : ""}
    </div>`;
}

async function setJulat(jenis, medan, v){
  const t = jenis === "tugasan";
  let dari = t ? tugasanDari : tempahanDari, hingga = t ? tugasanHingga : tempahanHingga;
  if(medan === "reset"){ dari = ""; hingga = ""; }
  else if(medan === "dari") dari = v;
  else hingga = v;
  /* "Hingga" sahaja pada tarikh lama → isi "Dari" setahun sebelumnya supaya julat ada sempadan */
  if(!dari && hingga && dataDari && hingga < dataDari) dari = tambahHari(hingga, -365);
  if(dari && hingga && hingga < dari) hingga = dari;
  if(t){ tugasanDari = dari; tugasanHingga = hingga; tugasanPage = 1; }
  else { tempahanDari = dari; tempahanHingga = hingga; tempahanPage = 1; }
  if(dari) await pastikanData(dari);
  render();
}

/* ============================================================
   SKRIN LOG MASUK
   ============================================================ */
function renderLogin(){
  $("login-root").innerHTML = `
  <div class="login-bg">
    <div class="login-card">
      <img class="login-logo-ppat" src="logo-ppat.png?v=34" alt="Logo Perbadanan Perpustakaan Awam Terengganu">
      <div class="login-logo">🚐</div>
      <h2>SisKEN</h2>
      <p class="login-sub">Sistem Tempahan Kenderaan<br>PERBADANAN PERPUSTAKAAN AWAM TERENGGANU</p>
      ${apiAktif() ? `
        <label class="fld"><span>ID Pengguna</span><input id="lg-id" autocomplete="username" placeholder="cth: admin" onkeydown="if(event.key==='Enter')doLogin()"></label>
        <label class="fld"><span>Kata Laluan</span><input id="lg-pw" type="password" autocomplete="current-password" onkeydown="if(event.key==='Enter')doLogin()"></label>
        <div id="lg-err"></div>
        <button class="btn btn-amber" id="lg-ok" style="justify-content:center;width:100%" onclick="doLogin()">Log Masuk</button>
        <button class="btn" style="justify-content:center;width:100%;color:var(--slate)" onclick="$('login-root').innerHTML=''">‹ Kembali ke paparan umum</button>
      ` : `
        <div class="login-note">⚠️ Sambungan backend belum ditetapkan (API_URL), jadi log masuk sebenar belum aktif. Anda boleh masuk dalam <b>mod demo</b> dengan data contoh — data tidak akan disimpan.</div>
        <button class="btn btn-amber" style="justify-content:center;width:100%" onclick="demoLogin()">Masuk Mod Demo (Admin)</button>
        <button class="btn" style="justify-content:center;width:100%;color:var(--slate)" onclick="$('login-root').innerHTML=''">‹ Kembali ke paparan umum</button>
      `}
    </div>
  </div>`;
  if(apiAktif()) setTimeout(() => { const el = $("lg-id"); if(el) el.focus(); }, 50);
}

async function doLogin(){
  const id = $("lg-id").value.trim(), pw = $("lg-pw").value;
  if(!id || !pw){ $("lg-err").innerHTML = '<span class="err">Sila isi ID pengguna dan kata laluan.</span>'; return; }
  const btn = $("lg-ok"); btn.disabled = true; btn.textContent = "Menyemak…";
  try{
    const res = await api("login", { userId: id, password: pw });
    if(!res.ok && res.wajibTukar){ renderWajibTukar(id, pw, res.ralat); return; }
    if(!res.ok){
      $("lg-err").innerHTML = `<span class="err">${esc(res.ralat || "Log masuk gagal.")}</span>`;
      btn.disabled = false; btn.textContent = "Log Masuk"; return;
    }
    TOKEN = res.token;
    simpanSesi(res.token);
    currentUser = res.user;
    // Guna data server walaupun kosong (pemasangan baharu) — JANGAN hantar data contoh ke pangkalan data sebenar
    if(res.data) pakaiData(res.data);
    masukApp();
    setSync("ok");
  }catch(e){
    $("lg-err").innerHTML = '<span class="err">Tidak dapat menghubungi pelayan. Semak API_URL dan sambungan rangkaian.</span>';
    btn.disabled = false; btn.textContent = "Log Masuk";
  }
}

/* ============================================================
   KATA LALUAN LALAI — pelayan enggan membuka sesi selagi akaun masih guna
   kata laluan pemasangan. Pengguna mesti menetapkan kata laluan baharu di
   sini; ia dihantar bersama permintaan log masuk yang sama.
   ============================================================ */
let _lgLalai = null; // { id, pw } — disimpan dalam memori sahaja semasa borang ini dibuka
function renderWajibTukar(id, pw, mesej){
  _lgLalai = { id, pw };
  $("login-root").innerHTML = `
  <div class="login-bg">
    <div class="login-card">
      <div class="login-logo">🔑</div>
      <h2>Tetapkan Kata Laluan Baharu</h2>
      <div class="login-note">⚠️ ${esc(mesej || "Akaun ini masih menggunakan kata laluan lalai.")}</div>
      <label class="fld"><span>Kata Laluan Baharu</span><input id="lg-pw1" type="password" autocomplete="new-password" onkeydown="if(event.key==='Enter')hantarWajibTukar()"></label>
      <label class="fld"><span>Ulang Kata Laluan Baharu</span><input id="lg-pw2" type="password" autocomplete="new-password" onkeydown="if(event.key==='Enter')hantarWajibTukar()"></label>
      <div id="lg-err"></div>
      <button class="btn btn-amber" id="lg-ok" style="justify-content:center;width:100%" onclick="hantarWajibTukar()">Simpan & Log Masuk</button>
      <button class="btn" style="justify-content:center;width:100%;color:var(--slate)" onclick="_lgLalai=null;renderLogin()">‹ Batal</button>
    </div>
  </div>`;
  setTimeout(() => { const el = $("lg-pw1"); if(el) el.focus(); }, 50);
}

async function hantarWajibTukar(){
  if(!_lgLalai) return;
  const p1 = $("lg-pw1").value, p2 = $("lg-pw2").value;
  const ralat = (m) => { $("lg-err").innerHTML = `<span class="err">${esc(m)}</span>`; };
  if(p1.length < 6) return ralat("Kata laluan baharu mestilah sekurang-kurangnya 6 aksara.");
  if(p1 !== p2) return ralat("Kedua-dua kata laluan tidak sepadan.");
  if(p1 === _lgLalai.pw) return ralat("Kata laluan baharu mesti berbeza daripada kata laluan lalai.");
  const btn = $("lg-ok"); btn.disabled = true; btn.textContent = "Menyimpan…";
  try{
    const res = await api("login", { userId: _lgLalai.id, password: _lgLalai.pw, passwordBaru: p1 });
    if(!res.ok){ ralat(res.ralat || "Gagal menetapkan kata laluan."); btn.disabled = false; btn.textContent = "Simpan & Log Masuk"; return; }
    _lgLalai = null;
    TOKEN = res.token;
    simpanSesi(res.token);
    currentUser = res.user;
    if(res.data) pakaiData(res.data);
    masukApp();
    setSync("ok");
    notify("Kata laluan baharu disimpan.");
  }catch(e){
    ralat("Tidak dapat menghubungi pelayan.");
    btn.disabled = false; btn.textContent = "Simpan & Log Masuk";
  }
}

/* Cuba sambung semula sesi tersimpan. Pulang true jika berjaya masuk app. */
async function pulihSesi(){
  if(!apiAktif()) return false;
  const token = bacaSesi();
  if(!token) return false;
  TOKEN = token;
  try{
    const res = await api("load");
    if(res.ok && res.user){
      currentUser = res.user;
      if(res.data) pakaiData(res.data);
      masukApp();
      setSync("ok");
      return true;
    }
    buangSesi(); TOKEN = null;   // token tidak sah atau telah tamat
    return false;
  }catch(e){
    TOKEN = null;                // pelayan tidak dapat dihubungi — token dikekalkan untuk cubaan seterusnya
    return false;
  }
}

function demoLogin(){
  currentUser = { userId: "demo", nama: "Admin (Demo)", peranan: "admin", superadmin: true };
  masukApp();
  setSync("local");
}

function masukApp(){
  $("login-root").innerHTML = "";
  $("u-nama").textContent = currentUser.nama;
  $("u-peranan").textContent = currentUser.superadmin ? "Superadmin"
    : currentUser.peranan === "admin" ? "Admin"
    : currentUser.peranan === "pemandu" ? "Pemandu" : "Pemohon";
  $("u-avatar").textContent = currentUser.nama.replace(/^(En\.|Pn\.|Cik|Dr\.)\s*/i, "").charAt(0).toUpperCase() || "?";
  tab = isAdmin() ? "dashboard" : (currentUser.peranan === "pemandu" ? "tugasan" : "tempahan");
  manualPeranan = currentUser.peranan === "pemandu" ? "pemandu" : "pemohon";
  jejakTempahan = ambilJejak();   // rakam keadaan awal — jangan beri amaran untuk data sedia ada
  mulaSemakBerkala();
  $("btn-auth").textContent = "⎋ Keluar";
  $("btn-pw").style.display = (apiAktif() && TOKEN) ? "" : "none"; // mod demo tiada kata laluan
  render();
}

function sesiTamat(){
  hentiSemakBerkala();
  buangSesi();
  TOKEN = null; currentUser = null; users = [];
  dataDari = null; tempahanDari = tempahanHingga = tugasanDari = tugasanHingga = "";
  $("u-nama").textContent = "—";
  $("u-peranan").textContent = "Belum log masuk";
  $("u-avatar").textContent = "?";
  $("btn-auth").textContent = "Login";
  $("btn-pw").style.display = "none";
  render();
  renderLogin();
  notify("Sesi anda telah tamat. Sila log masuk semula.");
}

async function doLogout(){
  if(!currentUser) return;
  if(TOKEN){ try{ api("logout"); }catch(e){} }
  hentiSemakBerkala();
  buangSesi();
  TOKEN = null; currentUser = null; users = [];
  dataDari = null; tempahanDari = tempahanHingga = tugasanDari = tugasanHingga = "";
  $("u-nama").textContent = "—";
  $("u-peranan").textContent = "Belum log masuk";
  $("u-avatar").textContent = "?";
  $("btn-auth").textContent = "Login";
  $("btn-pw").style.display = "none";
  mulaApp(); // kembali ke paparan umum (data disanitasi semula)
}

function authBtn(){ currentUser ? doLogout() : renderLogin(); }

/* ============================================================
   TUGASAN PEMANDU
   ============================================================ */
function skrgStr(){
  const k = klNow(); // masa zon Kuala Lumpur, bukan masa peranti
  return `${k.tarikh} ${k.masa}`;
}
function fmtMasaSelesai(s){
  const [t, m] = String(s).split(" ");
  return t && m ? `${fmtTarikh(t)}, ${m}` : esc(String(s));
}

/* Status kenderaan dikira automatik: 'selenggara' ditetap admin; selainnya
   'dalam_perjalanan' jika ada tempahan diluluskan meliputi masa kini, jika tidak 'tersedia'. */
function statusKenderaan(v){
  if(v.status === "selenggara") return "selenggara";
  const k = klNow(); const skrg = `${k.tarikh} ${k.masa}`;
  const tugas = bookings.find(b => b.vehicleId === v.id && b.status === "diluluskan"
    && mulaSibuk(b) <= skrg && skrg <= tamatDT(b));
  if(!tugas) return "tersedia";
  /* Pemandu belum menekan "Terima Tugas" — perjalanan tidak dianggap bermula walaupun
     masanya sudah tiba. Tanda MERAH supaya admin tahu tugasan ini perlu tindakan. */
  if(!tugas.diterima) return "belum_disahkan";
  // Dalam tempoh bersedia (sebelum masa bertolak) vs benar-benar di atas jalan
  return skrg < mulaDT(tugas) ? "menunggu_perjalanan" : "dalam_perjalanan";
}

function closeModal(){ $("modal-root").innerHTML = ""; }

/* ---------- Modal pengesahan generik ---------- */
let _confirmCb = null;
function confirmModal(title, htmlMsg, onYes, yesLabel, yesClass){
  _confirmCb = onYes;
  $("modal-root").innerHTML = `
  <div class="overlay" onclick="if(event.target===this)closeModal()">
    <div class="modal" style="max-width:440px">
      <div class="modal-h"><h3>${esc(title)}</h3><button class="modal-x" onclick="closeModal()">✕</button></div>
      <div class="modal-b">
        <div class="confirm-txt">${htmlMsg}</div>
        <div class="btn-row">
          ${onYes
            ? `<button class="btn ${yesClass || "btn-red"}" onclick="_confirmCb()">${yesLabel || "🗑 Ya, Padam"}</button>
               <button class="btn btn-dark" style="flex:1;justify-content:center" onclick="closeModal()">Batal</button>`
            : `<button class="btn btn-dark" style="flex:1;justify-content:center" onclick="closeModal()">Faham</button>`}
        </div>
      </div>
    </div>
  </div>`;
}
