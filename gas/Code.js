/**
 * ============================================================
 *  SisKEN — Backend Google Sheets (Google Apps Script)
 *  VERSI 2 — dengan Log Masuk, Token Sesi & Peranan
 * ============================================================
 *  Helaian (tab) dicipta secara AUTOMATIK:
 *  Kenderaan · Pemandu · Tempahan · Selenggaraan ·
 *  Pengguna · Sesi · Tetapan
 *
 *  LANGKAH PENTING SELEPAS TAMPAL:
 *  1. Run fungsi `setup` sekali (beri kebenaran)
 *  2. Akaun admin pertama dicipta automatik:
 *       ID Pengguna : admin
 *       Kata Laluan : admin123
 *     >> TUKAR kata laluan ini selepas log masuk pertama! <<
 *  3. Deploy > New deployment > Web app
 *     (Execute as: Me, Access: Anyone)
 * ============================================================
 */

const TZ = "Asia/Kuala_Lumpur";
const SESI_JAM = 12; // tempoh sah token log masuk (jam)

const SHEET_DEFS = {
  Kenderaan:    ["id","plat","model","jenis","kapasiti","status","lokasi","odometer","roadtax","bahanApi"],
  Pemandu:      ["id","nama","telefon","lesen","status"],
  Tempahan:     ["id","pemohon","bahagian","tujuan","destinasi","tarikh","masaMula","masaTamat","penumpang","status","vehicleId","driverId","userId","masaSelesai","tarikhTamat"],
  Selenggaraan: ["id","vehicleId","tarikh","jenis","butiran","kos","odometer","bengkel","status"],
  Pengguna:     ["userId","nama","peranan","passwordHash","salt","driverId"],
  Sesi:         ["token","userId","tamat"],
  Tetapan:      ["key","value"],
  Keselamatan:  ["userId","gagal","kunciSehingga"],   // kawalan cubaan log masuk
  Log:          ["masa","userId","tindakan","tempahanId","butiran"], // jejak audit
};

const MAP = {
  Kenderaan: "vehicles",
  Pemandu: "drivers",
  Tempahan: "bookings",
  Selenggaraan: "maintenance",
};

const NUMERIC = new Set(["kapasiti","odometer","bahanApi","penumpang","kos","value","tamat","gagal","kunciSehingga"]);

/* Kawalan brute-force log masuk */
const MAX_CUBAAN = 5;     // cubaan gagal sebelum dikunci
const KUNCI_MINIT = 15;   // tempoh kunci (minit)

/* ---------- JALANKAN SEKALI: setup, kebenaran & admin pertama ---------- */
function setup() {
  const ss = ensureSheets_();
  pastikanAdmin_(ss);
  SpreadsheetApp.getActiveSpreadsheet().toast(
    "Sedia! Akaun pertama -> ID: admin | Kata laluan: admin123 (sila tukar selepas log masuk)",
    "SisKEN", 10);
}

/* ---------- Utiliti kata laluan ---------- */
function hash_(salt, password) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, salt + String(password), Utilities.Charset.UTF_8);
  return bytes.map(b => ((b + 256) % 256).toString(16).padStart(2, "0")).join("");
}
function saltBaru_() { return Utilities.getUuid().replace(/-/g, "").slice(0, 12); }

/* ---------- Pastikan helaian & akaun admin wujud ---------- */
function ensureSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  for (const [name, headers] of Object.entries(SHEET_DEFS)) {
    let sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.getRange(1, 1, 1000, headers.length).setNumberFormat("@");
      sh.getRange(1, 1, 1, headers.length)
        .setValues([headers]).setFontWeight("bold")
        .setBackground("#0f172a").setFontColor("#fbbf24");
      sh.setFrozenRows(1);
    }
  }
  const s1 = ss.getSheetByName("Sheet1") || ss.getSheetByName("Helaian1");
  if (s1 && s1.getLastRow() === 0 && ss.getSheets().length > 7) ss.deleteSheet(s1);
  return ss;
}

function pastikanAdmin_(ss) {
  if (readSheet_(ss, "Pengguna").length === 0) {
    const salt = saltBaru_();
    writeSheet_(ss, "Pengguna", [{
      userId: "admin", nama: "Admin PPAT", peranan: "admin",
      passwordHash: hash_(salt, "admin123"), salt: salt,
    }]);
  }
}

/* ---------- Baca / tulis helaian ---------- */
function readSheet_(ss, name) {
  const headers = SHEET_DEFS[name];
  const sh = ss.getSheetByName(name);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const values = sh.getRange(2, 1, last - 1, headers.length).getValues();
  return values
    .filter(r => String(r[0]).trim() !== "")
    .map(r => {
      const obj = {};
      headers.forEach((h, i) => {
        let v = r[i];
        if (v instanceof Date) {
          v = (h === "masaMula" || h === "masaTamat")
            ? Utilities.formatDate(v, TZ, "HH:mm")
            : (h === "masaSelesai"
              ? Utilities.formatDate(v, TZ, "yyyy-MM-dd HH:mm")
              : Utilities.formatDate(v, TZ, "yyyy-MM-dd"));
        }
        if (NUMERIC.has(h)) v = Number(v) || 0;
        else {
          v = String(v);
          if ((h === "vehicleId" || h === "driverId" || h === "userId") && v === "") v = null;
        }
        obj[h] = v;
      });
      return obj;
    });
}

function writeSheet_(ss, name, rows) {
  const headers = SHEET_DEFS[name];
  const sh = ss.getSheetByName(name);
  const last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, headers.length).clearContent();
  if (!rows || rows.length === 0) return;
  const values = rows.map(o => headers.map(h => (o[h] === null || o[h] === undefined) ? "" : o[h]));
  sh.getRange(2, 1, values.length, headers.length).setNumberFormat("@").setValues(values);
}

/* ---------- Sesi (token) ---------- */
function cekSesi_(ss, token) {
  if (!token) return null;
  const now = Date.now();
  const semua = readSheet_(ss, "Sesi");
  const sah = semua.filter(s => Number(s.tamat) > now);
  if (sah.length !== semua.length) writeSheet_(ss, "Sesi", sah); // bersihkan token tamat tempoh
  const sesi = sah.find(s => s.token === token);
  if (!sesi) return null;
  const u = readSheet_(ss, "Pengguna").find(x => x.userId === sesi.userId);
  return u ? { userId: u.userId, nama: u.nama, peranan: u.peranan, driverId: u.driverId || null } : null;
}

function bukaSesi_(ss, userId) {
  const token = Utilities.getUuid();
  const tamat = Date.now() + SESI_JAM * 3600 * 1000;
  ss.getSheetByName("Sesi").appendRow([token, userId, String(tamat)]);
  return token;
}

/* ---------- Bina payload data untuk app ---------- */
function buildData_(ss, user) {
  const isAdmin = user && user.peranan === "admin";
  const out = {};
  let bookings = readSheet_(ss, "Tempahan");
  let drivers = readSheet_(ss, "Pemandu");
  const vehicles = readSheet_(ss, "Kenderaan");
  let maintenance = readSheet_(ss, "Selenggaraan");

  if (!isAdmin) {
    // Pemohon/pemandu: hanya tempahan berkaitan diri sendiri (yang dibuat sendiri
    // atau yang ditugaskan kepada pemandu ini) — bukan keseluruhan data.
    bookings = bookings.filter(b =>
      b.userId === user.userId || (user.driverId && b.driverId === user.driverId));
    // Buang maklumat peribadi pemandu (telefon & lesen) daripada respons.
    drivers = drivers.map(d => ({ id: d.id, nama: d.nama, status: d.status }));
    // Bukan-admin tidak perlu rekod selenggaraan.
    maintenance = [];
  }

  out.vehicles = vehicles;
  out.drivers = drivers;
  out.bookings = bookings;
  out.maintenance = maintenance;
  out.counters = {};
  readSheet_(ss, "Tetapan").forEach(r => { out.counters[r.key] = Number(r.value) || 0; });
  if (isAdmin) {
    out.users = readSheet_(ss, "Pengguna")
      .map(u => ({ userId: u.userId, nama: u.nama, peranan: u.peranan, driverId: u.driverId || null })); // TANPA hash
  }
  return out;
}

/* ---------- Data untuk paparan umum (disanitasi) ---------- */
function dataAwam_(ss) {
  const bookings = readSheet_(ss, "Tempahan")
    .filter(b => b.status === "diluluskan" || b.status === "selesai")
    .map(b => ({
      id: b.id, bahagian: b.bahagian, tujuan: b.tujuan, destinasi: b.destinasi,
      tarikh: b.tarikh, masaMula: b.masaMula, masaTamat: b.masaTamat,
      status: b.status, vehicleId: b.vehicleId, driverId: b.driverId,
      masaSelesai: b.masaSelesai || "", tarikhTamat: b.tarikhTamat || "",
    }));
  const drivers = readSheet_(ss, "Pemandu")
    .map(d => ({ id: d.id, nama: d.nama, status: d.status })); // tiada telefon/lesen
  const vehicles = readSheet_(ss, "Kenderaan")
    .map(v => ({ id: v.id, plat: v.plat, model: v.model, jenis: v.jenis, status: v.status }));
  return { bookings: bookings, drivers: drivers, vehicles: vehicles };
}

/* ---------- GET: semakan ringkas sahaja ---------- */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, mesej: "SisKEN API aktif. Gunakan app untuk log masuk." }))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------- POST: semua operasi ---------- */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse(e.postData.contents);
    const ss = ensureSheets_();
    pastikanAdmin_(ss);
    let res;

    if (d.action === "login") {
      res = login_(ss, d);
    } else if (d.action === "awam") {
      res = { ok: true, data: dataAwam_(ss) }; // paparan umum — tiada token diperlukan
    } else {
      const user = cekSesi_(ss, d.token);
      if (!user) {
        res = { ok: false, ralat: "Sesi tidak sah atau telah tamat. Sila log masuk semula.", sesiTamat: true };
      } else if (d.action === "load") {
        res = { ok: true, data: buildData_(ss, user) };
      } else if (d.action === "save") {
        res = save_(ss, user, d.data || {});
      } else if (d.action === "bookingAdd") {
        res = bookingAdd_(ss, user, d.booking || {});
      } else if (d.action === "bookingComplete") {
        res = bookingComplete_(ss, user, d);
      } else if (d.action === "bookingApprove") {
        res = adminSahaja_(user) || bookingApprove_(ss, user, d);
      } else if (d.action === "bookingReject") {
        res = adminSahaja_(user) || bookingReject_(ss, user, d);
      } else if (d.action === "bookingEdit") {
        res = adminSahaja_(user) || bookingEdit_(ss, user, d);
      } else if (d.action === "auditLog") {
        res = adminSahaja_(user) || { ok: true, log: readSheet_(ss, "Log").slice(-200).reverse() };
      } else if (d.action === "logPurge") {
        res = adminSahaja_(user) || logPurge_(ss, user);
      } else if (d.action === "logout") {
        writeSheet_(ss, "Sesi", readSheet_(ss, "Sesi").filter(s => s.token !== d.token));
        res = { ok: true };
      } else if (d.action === "tukarPw") {
        res = tukarPw_(ss, user, d);
      } else if (d.action === "drvStatus") {
        res = drvStatus_(ss, user, d);
      } else if (d.action === "userAdd") {
        res = adminSahaja_(user) || userAdd_(ss, d);
        if (res.ok) logAudit_(ss, user.userId, "Tambah Pengguna", "", String(d.userId || ""));
      } else if (d.action === "userReset") {
        res = adminSahaja_(user) || userReset_(ss, d);
        if (res.ok) logAudit_(ss, user.userId, "Reset Kata Laluan", "", String(d.userId || ""));
      } else if (d.action === "userDel") {
        res = adminSahaja_(user) || userDel_(ss, user, d);
        if (res.ok) logAudit_(ss, user.userId, "Padam Pengguna", "", String(d.userId || ""));
      } else {
        res = { ok: false, ralat: "Tindakan tidak dikenali." };
      }
    }
    return ContentService.createTextOutput(JSON.stringify(res))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, ralat: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function adminSahaja_(user) {
  return user.peranan === "admin" ? null : { ok: false, ralat: "Hanya admin dibenarkan." };
}

/* ---------- Log masuk ---------- */
/* ---------- Kawalan cubaan log masuk (anti brute-force) ---------- */
function bacaCubaan_(ss, userId) {
  return readSheet_(ss, "Keselamatan").find(x => x.userId === userId) || null;
}
function tulisCubaan_(ss, userId, gagal, kunciSehingga) {
  const semua = readSheet_(ss, "Keselamatan").filter(x => x.userId !== userId);
  if (gagal > 0 || kunciSehingga > 0) semua.push({ userId: userId, gagal: gagal, kunciSehingga: kunciSehingga });
  writeSheet_(ss, "Keselamatan", semua);
}

function login_(ss, d) {
  const userId = String(d.userId || "").trim();
  const now = Date.now();
  const rec = bacaCubaan_(ss, userId);

  // 1) Akaun sedang dikunci?
  if (rec && Number(rec.kunciSehingga) > now) {
    const minit = Math.ceil((Number(rec.kunciSehingga) - now) / 60000);
    return { ok: false, ralat: "Akaun dikunci sementara kerana terlalu banyak cubaan. Cuba lagi dalam " + minit + " minit." };
  }

  const u = readSheet_(ss, "Pengguna").find(x => x.userId === userId);
  // 2) Kata laluan salah → naikkan kiraan, kunci jika cukup
  if (!u || hash_(u.salt, d.password) !== u.passwordHash) {
    const gagal = (rec ? Number(rec.gagal) : 0) + 1;
    const dikunci = gagal >= MAX_CUBAAN;
    tulisCubaan_(ss, userId, dikunci ? 0 : gagal, dikunci ? now + KUNCI_MINIT * 60000 : 0);
    Utilities.sleep(500);
    if (dikunci)
      return { ok: false, ralat: "Terlalu banyak cubaan gagal. Akaun dikunci " + KUNCI_MINIT + " minit." };
    const baki = MAX_CUBAAN - gagal;
    return { ok: false, ralat: "ID pengguna atau kata laluan salah." +
      (baki <= 2 ? " (" + baki + " cubaan lagi sebelum dikunci)" : "") };
  }

  // 3) Berjaya → kosongkan kiraan & log
  if (rec) tulisCubaan_(ss, userId, 0, 0);
  const user = { userId: u.userId, nama: u.nama, peranan: u.peranan, driverId: u.driverId || null };
  logAudit_(ss, u.userId, "Log Masuk", "", "");
  return { ok: true, token: bukaSesi_(ss, u.userId), user: user, data: buildData_(ss, user) };
}

/* ---------- Simpan data (admin sahaja) ----------
 * Hanya admin boleh menyimpan keseluruhan dataset. Pemohon & pemandu
 * MESTI guna aksi berbutir (bookingAdd / bookingComplete / drvStatus)
 * supaya mereka tidak boleh menulis-ganti atau meluluskan tempahan sendiri.
 */
function save_(ss, user, data) {
  if (user.peranan !== "admin")
    return { ok: false, ralat: "Tindakan tidak dibenarkan untuk peranan ini." };
  for (const [sheetName, dataName] of Object.entries(MAP)) {
    if (Array.isArray(data[dataName])) writeSheet_(ss, sheetName, data[dataName]);
  }
  if (data.counters) {
    writeSheet_(ss, "Tetapan",
      Object.entries(data.counters).map(([key, value]) => ({ key, value })));
  }
  return { ok: true, masa: new Date().toISOString() };
}

/* ---------- Masa semasa zon KL (dijana server, bukan peranti client) ---------- */
function nowKL_() {
  return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd HH:mm");
}

/* ---------- Jejak audit: catat siapa buat apa, bila ---------- */
function logAudit_(ss, userId, tindakan, tempahanId, butiran) {
  try {
    ss.getSheetByName("Log").appendRow([nowKL_(), userId || "", tindakan, tempahanId || "", butiran || ""]);
  } catch (e) { /* jangan biar kegagalan log menggagalkan operasi utama */ }
}

/* Tarikh setahun lalu (zon KL) */
function setahunLalu_() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return Utilities.formatDate(d, TZ, "yyyy-MM-dd");
}

/* ---------- Padam log audit melebihi 1 tahun (admin) ---------- */
function logPurge_(ss, user) {
  const cutoff = setahunLalu_();
  const semua = readSheet_(ss, "Log");
  const kekal = semua.filter(r => String(r.masa).slice(0, 10) >= cutoff);
  const dibuang = semua.length - kekal.length;
  writeSheet_(ss, "Log", kekal);
  logAudit_(ss, user.userId, "Padam Log", "", dibuang + " rekod melebihi 1 tahun");
  return { ok: true, dibuang: dibuang };
}

/* ---------- ID tempahan seterusnya (berdasarkan rekod sedia ada di server) ---------- */
function nextBookingId_(semua) {
  let max = 1045;
  semua.forEach(b => {
    const m = /^T-(\d+)$/.exec(String(b.id));
    if (m && Number(m[1]) > max) max = Number(m[1]);
  });
  return "T-" + (max + 1);
}

/* ---------- Pemohon/pemandu: cipta tempahan baharu (kawalan penuh server) ----------
 * Medan kritikal (id, status, vehicleId, driverId, userId) ditetapkan oleh server —
 * input client untuk medan ini DIABAIKAN. Jadi tiada siapa boleh lulus sendiri.
 */
function bookingAdd_(ss, user, b) {
  const semua = readSheet_(ss, "Tempahan");
  const rec = {
    id: nextBookingId_(semua),
    pemohon: String(b.pemohon || "").trim(),
    bahagian: String(b.bahagian || "").trim(),
    tujuan: String(b.tujuan || "").trim(),
    destinasi: String(b.destinasi || "").trim(),
    tarikh: String(b.tarikh || "").trim(),
    masaMula: String(b.masaMula || "").trim(),
    masaTamat: String(b.masaTamat || "").trim(),
    penumpang: Math.max(1, Number(b.penumpang) || 1),
    status: "menunggu",   // sentiasa menunggu — tidak boleh diluluskan sendiri
    vehicleId: null,      // hanya ditetapkan semasa kelulusan admin
    driverId: null,
    userId: user.userId,  // diikat kepada pengguna sesi, bukan input client
    masaSelesai: "",
    tarikhTamat: String(b.tarikhTamat || "").trim(),
  };
  if (!rec.pemohon || !rec.tujuan || !rec.destinasi || !rec.tarikh || !rec.masaMula)
    return { ok: false, ralat: "Maklumat tempahan tidak lengkap." };
  const now = nowKL_(), hariIni = now.slice(0, 10), masaIni = now.slice(11, 16);
  if (rec.tarikh < hariIni)
    return { ok: false, ralat: "Tarikh tempahan tidak boleh pada masa lampau." };
  if (rec.tarikh === hariIni && rec.masaMula < masaIni)
    return { ok: false, ralat: "Masa mula tempahan sudah berlalu." };
  if (rec.tarikhTamat && rec.tarikhTamat < rec.tarikh)
    return { ok: false, ralat: "Tarikh tamat mesti pada atau selepas tarikh mula." };
  semua.unshift(rec);
  writeSheet_(ss, "Tempahan", semua);
  logAudit_(ss, user.userId, "Tempahan Baharu", rec.id, rec.destinasi);
  return { ok: true, booking: rec };
}

/* ---------- Tandakan tempahan selesai (admin ATAU pemandu yang ditugaskan sahaja) ----------
 * Pemandu WAJIB kemas kini odometer, bahan api & lokasi kenderaan.
 * Admin boleh selesaikan tanpa input (kekal seperti asal).
 */
function bookingComplete_(ss, user, d) {
  const semua = readSheet_(ss, "Tempahan");
  const b = semua.find(x => x.id === d.id);
  if (!b) return { ok: false, ralat: "Tempahan tidak dijumpai." };
  const bolehAdmin = user.peranan === "admin";
  const bolehPemandu = user.peranan === "pemandu" && user.driverId && b.driverId === user.driverId;
  if (!bolehAdmin && !bolehPemandu)
    return { ok: false, ralat: "Anda tidak dibenarkan menyelesaikan tempahan ini." };
  if (b.status !== "diluluskan")
    return { ok: false, ralat: "Hanya tempahan yang diluluskan boleh ditanda selesai." };

  const adaOdo  = d.odometer !== undefined && d.odometer !== "" && d.odometer !== null;
  const adaApi  = d.bahanApi !== undefined && d.bahanApi !== "" && d.bahanApi !== null;
  const adaLok  = d.lokasi !== undefined && String(d.lokasi || "").trim() !== "";

  // Pemandu wajib lengkapkan ketiga-tiga maklumat kenderaan
  if (user.peranan === "pemandu" && (!adaOdo || !adaApi || !adaLok))
    return { ok: false, ralat: "Sila lengkapkan odometer, bahan api dan lokasi kenderaan." };

  // Kemas kini rekod kenderaan (jika ada input & tempahan ada kenderaan) — SAHKAN dahulu
  let vehicleOut = null;
  if (b.vehicleId && (adaOdo || adaApi || adaLok)) {
    const vehs = readSheet_(ss, "Kenderaan");
    const v = vehs.find(x => x.id === b.vehicleId);
    if (v) {
      if (adaOdo) {
        const odoBaru = Number(d.odometer);
        if (isNaN(odoBaru) || odoBaru < Number(v.odometer))
          return { ok: false, ralat: "Odometer tidak boleh kurang daripada bacaan semasa (" + Number(v.odometer).toLocaleString() + " km)." };
        v.odometer = odoBaru;
      }
      if (adaApi) v.bahanApi = Math.min(100, Math.max(0, Number(d.bahanApi) || 0));
      if (adaLok) v.lokasi = String(d.lokasi).trim();
      writeSheet_(ss, "Kenderaan", vehs);
      vehicleOut = v;
    }
  }

  const ms = nowKL_();                 // masa server — client tidak boleh memalsukan masa
  b.status = "selesai";
  b.masaSelesai = ms;
  const bhg = ms.split(" ");
  if (!b.masaTamat) b.masaTamat = bhg[1];
  if (bhg[0] !== b.tarikh) b.tarikhTamat = bhg[0];
  writeSheet_(ss, "Tempahan", semua);
  logAudit_(ss, user.userId, "Selesai", b.id,
    vehicleOut ? ("odo " + vehicleOut.odometer + "km, api " + vehicleOut.bahanApi + "%") : b.masaSelesai);
  return { ok: true, booking: b, vehicle: vehicleOut };
}

/* ---------- Semakan pertindihan tempahan (tarikh + masa) ---------- */
function tamatEf_(b)        { return b.masaTamat || "23:59"; }
function tarikhTamatEf_(b)  { return b.tarikhTamat || b.tarikh; }
function bertindih_(a, b) {
  const aMula = a.tarikh + " " + a.masaMula, aTamat = tarikhTamatEf_(a) + " " + tamatEf_(a);
  const bMula = b.tarikh + " " + b.masaMula, bTamat = tarikhTamatEf_(b) + " " + tamatEf_(b);
  return aMula < bTamat && bMula < aTamat;
}

/* ---------- Luluskan tempahan (admin) — konflik disahkan di SERVER ---------- */
function bookingApprove_(ss, user, d) {
  const semua = readSheet_(ss, "Tempahan");
  const b = semua.find(x => x.id === d.id);
  if (!b) return { ok: false, ralat: "Tempahan tidak dijumpai." };
  if (b.status !== "menunggu")
    return { ok: false, ralat: "Hanya tempahan menunggu boleh diluluskan." };
  const vId = String(d.vehicleId || ""), dId = String(d.driverId || "");
  if (!vId || !dId) return { ok: false, ralat: "Sila pilih kenderaan dan pemandu." };
  const v = readSheet_(ss, "Kenderaan").find(x => x.id === vId);
  const p = readSheet_(ss, "Pemandu").find(x => x.id === dId);
  if (!v) return { ok: false, ralat: "Kenderaan tidak dijumpai." };
  if (!p) return { ok: false, ralat: "Pemandu tidak dijumpai." };
  if (v.status === "dipadam")
    return { ok: false, ralat: "Kenderaan telah diarkibkan." };
  if (v.status === "selenggara")
    return { ok: false, ralat: "Kenderaan sedang dalam selenggaraan." };
  if (Number(v.kapasiti) < Number(b.penumpang))
    return { ok: false, ralat: "Kapasiti kenderaan tidak mencukupi." };
  if (p.status === "dipadam")
    return { ok: false, ralat: "Pemandu telah diarkibkan." };
  if (p.status === "cuti")
    return { ok: false, ralat: "Pemandu sedang bercuti." };
  // Konflik: tempahan diluluskan lain yang bertindih masa pada kenderaan/pemandu sama
  const konflik = semua.filter(x =>
    x.id !== b.id && x.status === "diluluskan" &&
    bertindih_(x, b) && (x.vehicleId === vId || x.driverId === dId));
  if (konflik.length)
    return { ok: false, ralat: "Konflik jadual dengan " + konflik.map(c => c.id).join(", ") +
      " — kenderaan/pemandu sudah ditugaskan pada masa bertindih." };
  b.status = "diluluskan";
  b.vehicleId = vId;
  b.driverId = dId;
  writeSheet_(ss, "Tempahan", semua);
  logAudit_(ss, user.userId, "Lulus", b.id, vId + " / " + dId);
  return { ok: true, booking: b };
}

/* ---------- Tolak tempahan (admin) ---------- */
function bookingReject_(ss, user, d) {
  const semua = readSheet_(ss, "Tempahan");
  const b = semua.find(x => x.id === d.id);
  if (!b) return { ok: false, ralat: "Tempahan tidak dijumpai." };
  if (b.status !== "menunggu")
    return { ok: false, ralat: "Hanya tempahan menunggu boleh ditolak." };
  b.status = "ditolak";
  writeSheet_(ss, "Tempahan", semua);
  logAudit_(ss, user.userId, "Tolak", b.id, "");
  return { ok: true, booking: b };
}

/* ---------- Edit tempahan (admin) — hanya SEBELUM tempahan bermula ----------
 * SOP sama dengan permohonan baharu: tiada pertindihan jadual dibenarkan.
 * Hanya medan butiran diubah; status, kenderaan, pemandu & userId KEKAL.
 */
function bookingEdit_(ss, user, d) {
  const semua = readSheet_(ss, "Tempahan");
  const b = semua.find(x => x.id === d.id);
  if (!b) return { ok: false, ralat: "Tempahan tidak dijumpai." };
  if (b.status !== "menunggu" && b.status !== "diluluskan")
    return { ok: false, ralat: "Hanya tempahan menunggu atau diluluskan boleh diedit." };

  // Halang sebarang perubahan selepas tempahan bermula (masa server, bukan client)
  const now = nowKL_();
  if ((b.tarikh + " " + b.masaMula) <= now)
    return { ok: false, ralat: "Tempahan sedang berjalan. Tiada perubahan dibenarkan." };

  const calon = {
    id: b.id,
    pemohon: String(d.pemohon || "").trim(),
    bahagian: String(d.bahagian || "").trim(),
    tujuan: String(d.tujuan || "").trim(),
    destinasi: String(d.destinasi || "").trim(),
    tarikh: String(d.tarikh || "").trim(),
    masaMula: String(d.masaMula || "").trim(),
    masaTamat: String(d.masaTamat || "").trim(),
    tarikhTamat: String(d.tarikhTamat || "").trim(),
    penumpang: Math.max(1, Number(d.penumpang) || 1),
  };
  if (!calon.pemohon || !calon.tujuan || !calon.destinasi || !calon.tarikh || !calon.masaMula)
    return { ok: false, ralat: "Maklumat tempahan tidak lengkap." };

  const hariIni = now.slice(0, 10), masaIni = now.slice(11, 16);
  if (calon.tarikh < hariIni)
    return { ok: false, ralat: "Tarikh tempahan tidak boleh pada masa lampau." };
  if (calon.tarikh === hariIni && calon.masaMula < masaIni)
    return { ok: false, ralat: "Masa mula tempahan sudah berlalu." };
  if (calon.tarikhTamat && calon.tarikhTamat < calon.tarikh)
    return { ok: false, ralat: "Tarikh tamat mesti pada atau selepas tarikh mula." };

  // Tempahan diluluskan ada kenderaan/pemandu — sahkan tiada pertindihan & kapasiti cukup
  if (b.status === "diluluskan" && (b.vehicleId || b.driverId)) {
    const konflik = semua.filter(x =>
      x.id !== b.id && x.status === "diluluskan" &&
      bertindih_(x, calon) &&
      (x.vehicleId === b.vehicleId || x.driverId === b.driverId));
    if (konflik.length)
      return { ok: false, ralat: "Konflik jadual dengan " + konflik.map(c => c.id).join(", ") +
        " — kenderaan/pemandu sudah ditugaskan pada masa bertindih." };
    const v = readSheet_(ss, "Kenderaan").find(x => x.id === b.vehicleId);
    if (v && Number(v.kapasiti) < calon.penumpang)
      return { ok: false, ralat: "Kapasiti kenderaan tidak mencukupi untuk bilangan penumpang." };
  }

  b.pemohon = calon.pemohon;
  b.bahagian = calon.bahagian;
  b.tujuan = calon.tujuan;
  b.destinasi = calon.destinasi;
  b.tarikh = calon.tarikh;
  b.masaMula = calon.masaMula;
  b.masaTamat = calon.masaTamat;
  b.tarikhTamat = calon.tarikhTamat;
  b.penumpang = calon.penumpang;
  writeSheet_(ss, "Tempahan", semua);
  logAudit_(ss, user.userId, "Edit Tempahan", b.id, calon.destinasi);
  return { ok: true, booking: b };
}

/* ---------- Pengguna tukar kata laluan sendiri ---------- */
function tukarPw_(ss, user, d) {
  const semua = readSheet_(ss, "Pengguna");
  const u = semua.find(x => x.userId === user.userId);
  if (!u) return { ok: false, ralat: "Akaun tidak dijumpai." };
  if (hash_(u.salt, d.passwordLama) !== u.passwordHash) {
    Utilities.sleep(500);
    return { ok: false, ralat: "Kata laluan semasa salah." };
  }
  if (!d.passwordBaru || String(d.passwordBaru).length < 6)
    return { ok: false, ralat: "Kata laluan baharu mestilah sekurang-kurangnya 6 aksara." };
  u.salt = saltBaru_();
  u.passwordHash = hash_(u.salt, d.passwordBaru);
  writeSheet_(ss, "Pengguna", semua);
  // Batalkan semua sesi lain pengguna ini; kekalkan sesi semasa
  writeSheet_(ss, "Sesi", readSheet_(ss, "Sesi").filter(s => s.userId !== user.userId || s.token === d.token));
  return { ok: true };
}

/* ---------- Pemandu kemas kini status sendiri ---------- */
function drvStatus_(ss, user, d) {
  if (user.peranan !== "pemandu" || !user.driverId)
    return { ok: false, ralat: "Hanya akaun pemandu yang dipautkan boleh menukar status." };
  const semua = readSheet_(ss, "Pemandu");
  const drow = semua.find(x => x.id === user.driverId);
  if (!drow) return { ok: false, ralat: "Rekod pemandu tidak dijumpai." };
  drow.status = d.status === "cuti" ? "cuti" : "bertugas";
  writeSheet_(ss, "Pemandu", semua);
  return { ok: true, status: drow.status };
}

/* ---------- Pengurusan pengguna (admin) ---------- */
function senaraiUsers_(ss) {
  return readSheet_(ss, "Pengguna").map(u => ({ userId: u.userId, nama: u.nama, peranan: u.peranan, driverId: u.driverId || null }));
}

function userAdd_(ss, d) {
  const userId = String(d.userId || "").trim();
  if (!userId || !d.nama || !d.password) return { ok: false, ralat: "Maklumat tidak lengkap." };
  const semua = readSheet_(ss, "Pengguna");
  if (semua.some(u => u.userId.toLowerCase() === userId.toLowerCase()))
    return { ok: false, ralat: "ID pengguna ini sudah wujud." };
  const salt = saltBaru_();
  const peranan = (d.peranan === "admin" || d.peranan === "pemandu") ? d.peranan : "pemohon";
  semua.push({
    userId: userId, nama: String(d.nama).trim(),
    peranan: peranan,
    passwordHash: hash_(salt, d.password), salt: salt,
    driverId: peranan === "pemandu" ? (d.driverId || "") : "",
  });
  writeSheet_(ss, "Pengguna", semua);
  return { ok: true, users: senaraiUsers_(ss) };
}

function userReset_(ss, d) {
  const semua = readSheet_(ss, "Pengguna");
  const u = semua.find(x => x.userId === d.userId);
  if (!u) return { ok: false, ralat: "Pengguna tidak dijumpai." };
  if (!d.password || String(d.password).length < 6)
    return { ok: false, ralat: "Kata laluan mestilah sekurang-kurangnya 6 aksara." };
  u.salt = saltBaru_();
  u.passwordHash = hash_(u.salt, d.password);
  writeSheet_(ss, "Pengguna", semua);
  // batalkan semua sesi pengguna ini supaya perlu log masuk semula
  writeSheet_(ss, "Sesi", readSheet_(ss, "Sesi").filter(s => s.userId !== d.userId || s.token === d.token));
  return { ok: true, users: senaraiUsers_(ss) };
}

function userDel_(ss, user, d) {
  if (d.userId === user.userId) return { ok: false, ralat: "Anda tidak boleh memadam akaun sendiri." };
  const semua = readSheet_(ss, "Pengguna").filter(u => u.userId !== d.userId);
  if (semua.filter(u => u.peranan === "admin").length === 0)
    return { ok: false, ralat: "Mesti ada sekurang-kurangnya seorang admin." };
  writeSheet_(ss, "Pengguna", semua);
  writeSheet_(ss, "Sesi", readSheet_(ss, "Sesi").filter(s => s.userId !== d.userId));
  return { ok: true, users: senaraiUsers_(ss) };
}