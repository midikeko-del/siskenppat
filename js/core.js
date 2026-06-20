/* SisKEN — core.js (edit di sini) */
/* ============================================================
   SAMBUNGAN GOOGLE SHEETS (Apps Script)
   1. Deploy Code.gs sebagai Web App
   2. Salin URL Web App (berakhir dengan /exec)
   3. Tampal di bawah, gantikan teks GANTIKAN_URL_DI_SINI
   Jika dibiarkan, app berjalan dalam mod tempatan (data
   contoh, tidak disimpan).
   ============================================================ */
const API_URL = "https://script.google.com/macros/s/AKfycbzIv8zPV-KGmKJCTc345abS62abIGstMgYcDhvOVvvc6k03h3165g0GZzITa5iA0sHaeg/exec";

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
let tab = "dashboard";
let editVehId = null; // id kenderaan yang sedang diedit (null = tambah baharu)
let mingguOffset = 0;     // offset minggu jadual pemandu (admin) — 0 = minggu ini
let mingguOffsetAwam = 0; // offset minggu jadual pemandu (paparan umum)

const VSTATUS = {
  tersedia:{label:"Tersedia", cls:"green"},
  dalam_perjalanan:{label:"Dalam Perjalanan", cls:"amber"},
  selenggara:{label:"Selenggaraan", cls:"red"},
};
const BSTATUS = {
  menunggu:{label:"Menunggu Kelulusan", cls:"amber"},
  diluluskan:{label:"Diluluskan", cls:"green"},
  ditolak:{label:"Ditolak", cls:"red"},
  selesai:{label:"Selesai", cls:"gray"},
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
const tamatDT = (b) => `${tarikhTamatEf(b)} ${tamatEf(b)}`;                   // titik tamat (tarikh+masa)
const dudukiHari = (b, hari) => b.tarikh <= hari && hari <= tarikhTamatEf(b); // adakah tempahan meliputi hari ini?
const paparTarikh = (b) => (b.tarikhTamat && b.tarikhTamat !== b.tarikh)
  ? `${fmtTarikh(b.tarikh)} – ${fmtTarikh(b.tarikhTamat)}`
  : fmtTarikh(b.tarikh);
const veh = (id) => vehicles.find(v => v.id === id);
const drv = (id) => drivers.find(d => d.id === id);
/* Senarai AKTIF (sembunyikan rekod yang diarkib) — veh()/drv() kekal cari semua untuk sejarah */
const kenderaanAktif = () => vehicles.filter(v => v.status !== "dipadam");
const pemanduAktif   = () => drivers.filter(d => d.status !== "dipadam");

function fmtTarikh(iso){
  const bln = ["Jan","Feb","Mac","Apr","Mei","Jun","Jul","Ogo","Sep","Okt","Nov","Dis"];
  const [y,m,d] = iso.split("-");
  return `${parseInt(d)} ${bln[parseInt(m)-1]} ${y}`;
}

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

function notify(msg){
  const t = $("toast");
  t.innerHTML = `<span style="color:#34d399">✔</span> ${esc(msg)}`;
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

function renderNav(){
  const toggle = $("nav-toggle");
  if(!currentUser){ $("nav").innerHTML = ""; $("nav").classList.remove("open"); if(toggle) toggle.style.display = "none"; return; }
  const menunggu = bookings.filter(b => b.status === "menunggu").length;
  const semua = [
    {id:"dashboard", label:"📊 Papan Pemuka", admin:true},
    {id:"tempahan", label:"📅 Tempahan", badge: isAdmin() ? menunggu : 0},
    {id:"kenderaan", label:"🚗 Kenderaan", admin:true},
    {id:"pemandu", label:"👥 Jadual Pemandu", admin:true},
    {id:"selenggara", label:"🔧 Selenggaraan", admin:true},
    {id:"laporan", label:"📈 Laporan Bulanan", admin:true},
    {id:"pengguna", label:"🔐 Pengguna", admin:true},
    {id:"log", label:"📜 Log Audit", admin:true},
  ];
  const items = currentUser.peranan === "pemandu"
    ? [{id:"tugasan", label:"🚘 Tugasan Saya"}]
    : semua.filter(n => !n.admin || isAdmin());
  $("nav").innerHTML = items.map(n => `
    <button class="${tab===n.id?'active':''}" onclick="setTab('${n.id}')">
      ${n.label}${n.badge ? `<span class="badge">${n.badge}</span>` : ""}
    </button>`).join("");
  $("nav").classList.toggle("open", menuOpen);
  if(toggle){
    toggle.style.display = ""; // CSS kawal: tersembunyi di desktop, tampil di telefon
    const aktif = items.find(n => n.id === tab);
    toggle.innerHTML = `<span>${menuOpen ? "✕ Tutup Menu" : "☰ " + (aktif ? aktif.label : "Menu")}</span>`;
  }
}
function setTab(t){ tab = t; menuOpen = false; render(); } // pilih tab → tutup menu telefon

/* ================= RENDER UTAMA ================= */
function render(){
  segarTarikh(); // pastikan HARI_INI & MINGGU sentiasa terkini
  renderNav();
  const m = $("main");
  if(!currentUser){ m.innerHTML = renderAwam(); return; }
  if(tab === "dashboard") m.innerHTML = renderDashboard();
  if(tab === "tempahan") m.innerHTML = renderTempahan();
  if(tab === "kenderaan") m.innerHTML = renderKenderaan();
  if(tab === "pemandu") m.innerHTML = renderPemandu();
  if(tab === "selenggara") m.innerHTML = renderSelenggara();
  if(tab === "laporan") m.innerHTML = renderLaporan();
  if(tab === "pengguna") m.innerHTML = renderPengguna();
  if(tab === "log") m.innerHTML = renderLog();
  if(tab === "tugasan") m.innerHTML = renderTugasan();
}

/* ============================================================
   SAMBUNGAN API (Apps Script) + LOG MASUK
   ============================================================ */
const apiAktif = () => API_URL.startsWith("http");
let TOKEN = null;
let currentUser = null;
let users = [];
const isAdmin = () => currentUser && currentUser.peranan === "admin";

async function api(action, payload = {}){
  const r = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" }, // elak isu CORS preflight
    body: JSON.stringify({ action, token: TOKEN, ...payload }),
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

function dataKosong(d){
  return ["vehicles","drivers","bookings","maintenance"].every(k => !d[k] || d[k].length === 0);
}

function pakaiData(d){
  vehicles = d.vehicles || [];
  drivers = d.drivers || [];
  bookings = d.bookings || [];
  maintenance = d.maintenance || [];
  if(d.users) users = d.users;
  if(d.counters){
    nextNum = d.counters.nextNum || nextNum;
    nextVeh = d.counters.nextVeh || nextVeh;
    nextDrv = d.counters.nextDrv || nextDrv;
    nextSel = d.counters.nextSel || nextSel;
  }
}

/* Simpan automatik (debounce 600ms supaya tidak membanjiri API) */
let _saveTm = null;
function sync(){
  render();
  if(!apiAktif() || !TOKEN){ setSync("local"); return; }
  setSync("saving");
  clearTimeout(_saveTm);
  _saveTm = setTimeout(saveNow, 600);
}

async function saveNow(){
  if(!apiAktif() || !TOKEN) return;
  try{
    const res = await api("save", { data: {
      vehicles, drivers, bookings, maintenance,
      counters: { nextNum, nextVeh, nextDrv, nextSel },
    }});
    if(res.sesiTamat){ sesiTamat(); return; }
    setSync(res.ok ? "ok" : "err");
  }catch(e){ setSync("err"); }
}

/* ============================================================
   SKRIN LOG MASUK
   ============================================================ */
function renderLogin(){
  $("login-root").innerHTML = `
  <div class="login-bg">
    <div class="login-card">
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
        <div class="login-note">⚠️ Sambungan Google Sheets belum ditetapkan (API_URL), jadi log masuk sebenar belum aktif. Anda boleh masuk dalam <b>mod demo</b> dengan data contoh — data tidak akan disimpan.</div>
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
    if(!res.ok){
      $("lg-err").innerHTML = `<span class="err">${esc(res.ralat || "Log masuk gagal.")}</span>`;
      btn.disabled = false; btn.textContent = "Log Masuk"; return;
    }
    TOKEN = res.token;
    currentUser = res.user;
    if(res.data){
      if(dataKosong(res.data) && currentUser.peranan === "admin"){
        if(res.data.users) users = res.data.users;
        saveNow(); // sheet masih kosong & admin — hantar data contoh sebagai permulaan
      } else pakaiData(res.data);
    }
    masukApp();
    setSync("ok");
  }catch(e){
    $("lg-err").innerHTML = '<span class="err">Tidak dapat menghubungi pelayan. Semak API_URL dan sambungan internet.</span>';
    btn.disabled = false; btn.textContent = "Log Masuk";
  }
}

function demoLogin(){
  currentUser = { userId: "demo", nama: "Admin (Demo)", peranan: "admin" };
  masukApp();
  setSync("local");
}

function masukApp(){
  $("login-root").innerHTML = "";
  $("u-nama").textContent = currentUser.nama;
  $("u-peranan").textContent = currentUser.peranan === "admin" ? "Admin" : (currentUser.peranan === "pemandu" ? "Pemandu" : "Pemohon");
  $("u-avatar").textContent = currentUser.nama.replace(/^(En\.|Pn\.|Cik|Dr\.)\s*/i, "").charAt(0).toUpperCase() || "?";
  tab = isAdmin() ? "dashboard" : (currentUser.peranan === "pemandu" ? "tugasan" : "tempahan");
  $("btn-auth").textContent = "⎋ Keluar";
  $("btn-pw").style.display = (apiAktif() && TOKEN) ? "" : "none"; // mod demo tiada kata laluan
  render();
}

function sesiTamat(){
  TOKEN = null; currentUser = null; users = [];
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
  TOKEN = null; currentUser = null; users = [];
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
  const sibuk = bookings.some(b => b.vehicleId === v.id && b.status === "diluluskan"
    && mulaDT(b) <= skrg && skrg <= tamatDT(b));
  return sibuk ? "dalam_perjalanan" : "tersedia";
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
