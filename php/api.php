<?php
/**
 * ============================================================
 *  SisKEN — Backend PHP + MySQL
 *  Log Masuk, Token Sesi & Peranan
 * ============================================================
 *  POST JSON: { action, token, ...payload } → balas JSON.
 * ============================================================
 */

// Jangan cetak amaran/ralat PHP ke dalam respons — ia merosakkan JSON & boleh dedahkan butiran pelayan
ini_set("display_errors", "0");

require_once __DIR__ . "/lib.php";

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

const SESI_JAM = 12;      // tempoh sah token log masuk (jam)
const MAX_CUBAAN = 5;     // cubaan gagal sebelum dikunci
const KUNCI_MINIT = 15;   // tempoh kunci (minit)

/* Lengah balasan selepas kata laluan salah (perlahankan brute-force) — dilakukan
   SELEPAS kunci API dilepaskan supaya tidak menyekat permintaan pengguna lain. */
$LENGAH_GAGAL = false;
function tandaLengah_(): void { $GLOBALS["LENGAH_GAGAL"] = true; }

/* ---------- GET: semakan ringkas sahaja ---------- */
if ($_SERVER["REQUEST_METHOD"] === "GET") {
    echo json_encode(["ok" => true, "mesej" => "SisKEN API aktif. Gunakan app untuk log masuk."]);
    exit;
}

/* ---------- Utiliti baca jadual ---------- */
function castRow(array $row, array $intCols = [], array $floatCols = [], array $nullEmptyCols = []): array {
    foreach ($row as $k => $v) {
        if (in_array($k, $intCols, true)) $row[$k] = (int) $v;
        elseif (in_array($k, $floatCols, true)) $row[$k] = (float) $v;
        elseif (in_array($k, $nullEmptyCols, true) && ($v === "" || $v === null)) $row[$k] = null;
    }
    return $row;
}

function readKenderaan(): array {
    $rows = db()->query("SELECT * FROM kenderaan")->fetchAll();
    return array_map(fn($r) => castRow($r, ["kapasiti", "odometer", "bahanApi"]), $rows);
}
function readPemandu(): array {
    return db()->query("SELECT * FROM pemandu")->fetchAll();
}
function readTempahan(): array {
    $rows = db()->query("SELECT * FROM tempahan")->fetchAll();
    return array_map(fn($r) => castRow($r, ["penumpang"], [], ["vehicleId", "driverId", "userId"]), $rows);
}
function readSelenggaraan(): array {
    $rows = db()->query("SELECT * FROM selenggaraan")->fetchAll();
    return array_map(fn($r) => castRow($r, ["odometer"], ["kos"]), $rows);
}
function readPengguna(): array {
    $rows = db()->query("SELECT * FROM pengguna")->fetchAll();
    return array_map(fn($r) => castRow($r, [], [], ["driverId"]), $rows);
}
function readTetapan(): array {
    $rows = db()->query("SELECT * FROM tetapan")->fetchAll();
    return array_map(fn($r) => castRow($r, ["value"]), $rows);
}
/** 200 rekod log terkini (terbaru dahulu) */
function readLogTerkini(): array {
    return db()->query("SELECT masa, userId, tindakan, tempahanId, butiran FROM log ORDER BY id DESC LIMIT 200")->fetchAll();
}

/** ID seterusnya bagi awalan tertentu (cth "K" -> "K6") berdasarkan rekod sedia ada */
function nextId_(string $table, string $prefix): string {
    $max = 0;
    $ids = db()->query("SELECT id FROM `$table`")->fetchAll(PDO::FETCH_COLUMN);
    foreach ($ids as $id) {
        if (preg_match('/^' . preg_quote($prefix, "/") . '(\d+)$/', (string) $id, $m) && (int) $m[1] > $max) $max = (int) $m[1];
    }
    return $prefix . ($max + 1);
}

/* ---------- Sesi (token) ---------- */
function cekSesi_(?string $token): ?array {
    if (!$token) return null;
    $pdo = db();
    $now = (int) round(microtime(true) * 1000);
    // bersihkan token luput secara oportunis
    $pdo->prepare("DELETE FROM sesi WHERE tamat <= :now")->execute([":now" => $now]);
    $stmt = $pdo->prepare("SELECT userId FROM sesi WHERE token = :token AND tamat > :now");
    $stmt->execute([":token" => $token, ":now" => $now]);
    $row = $stmt->fetch();
    if (!$row) return null;
    $u = db()->prepare("SELECT userId, nama, peranan, driverId FROM pengguna WHERE userId = :u");
    $u->execute([":u" => $row["userId"]]);
    $user = $u->fetch();
    if (!$user) return null;
    return ["userId" => $user["userId"], "nama" => $user["nama"], "peranan" => $user["peranan"], "driverId" => $user["driverId"] ?: null];
}

function bukaSesi_(string $userId): string {
    $token = bin2hex(random_bytes(16));
    $tamat = (int) round(microtime(true) * 1000) + SESI_JAM * 3600 * 1000;
    db()->prepare("INSERT INTO sesi (token, userId, tamat) VALUES (:t, :u, :x)")
        ->execute([":t" => $token, ":u" => $userId, ":x" => $tamat]);
    return $token;
}

/* ---------- Bina payload data untuk app ---------- */
function buildData_(array $user): array {
    $isAdmin = $user["peranan"] === "admin";
    $bookings = readTempahan();
    $drivers = readPemandu();
    $vehicles = readKenderaan();
    $maintenance = readSelenggaraan();

    if (!$isAdmin) {
        $bookings = array_values(array_filter($bookings, function ($b) use ($user) {
            return $b["userId"] === $user["userId"] || (!empty($user["driverId"]) && $b["driverId"] === $user["driverId"]);
        }));
        $drivers = array_map(fn($d) => ["id" => $d["id"], "nama" => $d["nama"], "status" => $d["status"]], $drivers);
        $maintenance = [];
    }

    $out = [
        "vehicles" => $vehicles,
        "drivers" => $drivers,
        "bookings" => $bookings,
        "maintenance" => $maintenance,
        "counters" => [],
    ];
    foreach (readTetapan() as $r) $out["counters"][$r["key"]] = (int) $r["value"];
    if ($isAdmin) {
        $out["users"] = array_map(
            fn($u) => ["userId" => $u["userId"], "nama" => $u["nama"], "peranan" => $u["peranan"], "driverId" => $u["driverId"] ?: null],
            readPengguna()
        );
    }
    return $out;
}

/* ---------- Data untuk paparan umum (disanitasi) ---------- */
function dataAwam_(): array {
    $bookings = array_values(array_filter(readTempahan(), fn($b) => $b["status"] === "diluluskan" || $b["status"] === "selesai"));
    $bookings = array_map(fn($b) => [
        "id" => $b["id"], "bahagian" => $b["bahagian"], "tujuan" => $b["tujuan"], "destinasi" => $b["destinasi"],
        "tarikh" => $b["tarikh"], "masaMula" => $b["masaMula"], "masaTamat" => $b["masaTamat"],
        "status" => $b["status"], "vehicleId" => $b["vehicleId"], "driverId" => $b["driverId"],
        "masaSelesai" => $b["masaSelesai"] ?: "", "tarikhTamat" => $b["tarikhTamat"] ?: "",
    ], $bookings);
    $drivers = array_map(fn($d) => ["id" => $d["id"], "nama" => $d["nama"], "status" => $d["status"]], readPemandu());
    $vehicles = array_map(fn($v) => ["id" => $v["id"], "plat" => $v["plat"], "model" => $v["model"], "jenis" => $v["jenis"], "status" => $v["status"]], readKenderaan());
    return ["bookings" => $bookings, "drivers" => $drivers, "vehicles" => $vehicles];
}

function adminSahaja_(array $user): ?array {
    return $user["peranan"] === "admin" ? null : ["ok" => false, "ralat" => "Hanya admin dibenarkan."];
}

/* ---------- Log masuk (dengan kawalan brute-force) ---------- */
function bacaCubaan_(string $userId): ?array {
    $stmt = db()->prepare("SELECT userId, gagal, kunciSehingga FROM keselamatan WHERE userId = :u");
    $stmt->execute([":u" => $userId]);
    $r = $stmt->fetch();
    return $r ?: null;
}
function tulisCubaan_(string $userId, int $gagal, int $kunciSehingga): void {
    $pdo = db();
    $pdo->prepare("DELETE FROM keselamatan WHERE userId = :u")->execute([":u" => $userId]);
    if ($gagal > 0 || $kunciSehingga > 0) {
        $pdo->prepare("INSERT INTO keselamatan (userId, gagal, kunciSehingga) VALUES (:u, :g, :k)")
            ->execute([":u" => $userId, ":g" => $gagal, ":k" => $kunciSehingga]);
    }
}

function login_(array $d): array {
    $userId = trim((string) ($d["userId"] ?? ""));
    $now = (int) round(microtime(true) * 1000);
    $rec = bacaCubaan_($userId);

    if ($rec && (int) $rec["kunciSehingga"] > $now) {
        $minit = (int) ceil(((int) $rec["kunciSehingga"] - $now) / 60000);
        return ["ok" => false, "ralat" => "Akaun dikunci sementara kerana terlalu banyak cubaan. Cuba lagi dalam {$minit} minit."];
    }

    $stmt = db()->prepare("SELECT * FROM pengguna WHERE userId = :u");
    $stmt->execute([":u" => $userId]);
    $u = $stmt->fetch();

    if (!$u || hash_($u["salt"], (string) ($d["password"] ?? "")) !== $u["passwordHash"]) {
        $gagal = ($rec ? (int) $rec["gagal"] : 0) + 1;
        $dikunci = $gagal >= MAX_CUBAAN;
        tulisCubaan_($userId, $dikunci ? 0 : $gagal, $dikunci ? $now + KUNCI_MINIT * 60000 : 0);
        tandaLengah_();
        if ($dikunci) return ["ok" => false, "ralat" => "Terlalu banyak cubaan gagal. Akaun dikunci " . KUNCI_MINIT . " minit."];
        $baki = MAX_CUBAAN - $gagal;
        return ["ok" => false, "ralat" => "ID pengguna atau kata laluan salah." . ($baki <= 2 ? " ({$baki} cubaan lagi sebelum dikunci)" : "")];
    }

    if ($rec) tulisCubaan_($userId, 0, 0);
    $user = ["userId" => $u["userId"], "nama" => $u["nama"], "peranan" => $u["peranan"], "driverId" => $u["driverId"] ?: null];
    logAudit_($u["userId"], "Log Masuk", "", "");
    return ["ok" => true, "token" => bukaSesi_($u["userId"]), "user" => $user, "data" => buildData_($user)];
}

/* ============================================================
   Simpan SATU rekod (admin) — gantian save_ lama yang menulis-ganti
   seluruh jadual daripada salinan pelayar admin (boleh memadam tempahan/
   kemas kini pengguna lain yang dibuat selepas admin log masuk).
   Setiap tindakan hanya mengubah rekod berkenaan, kemudian memulangkan
   data terkini supaya paparan admin segar semula.
   ============================================================ */
function ambilRekod_(string $table, string $id): ?array {
    $stmt = db()->prepare("SELECT * FROM `$table` WHERE id = :id");
    $stmt->execute([":id" => $id]);
    $r = $stmt->fetch();
    return $r ?: null;
}

function adaTempahanAktif_(string $kolum, string $id): array {
    $stmt = db()->prepare("SELECT id FROM tempahan WHERE `$kolum` = :id AND status = 'diluluskan'");
    $stmt->execute([":id" => $id]);
    return $stmt->fetchAll(PDO::FETCH_COLUMN);
}

/* ---------- Kenderaan: tambah / kemas kini sebahagian medan / arkib ---------- */
function vehicleSave_(array $user, array $d): array {
    $in = is_array($d["vehicle"] ?? null) ? $d["vehicle"] : [];
    $id = trim((string) ($in["id"] ?? ""));
    $lama = $id !== "" ? ambilRekod_("kenderaan", $id) : null;
    if ($id !== "" && !$lama) return ["ok" => false, "ralat" => "Kenderaan tidak dijumpai."];

    // Mulakan daripada rekod SEMASA di server; hanya medan yang dihantar diubah
    $v = $lama ?: ["id" => "", "plat" => "", "model" => "", "jenis" => "", "kapasiti" => 1, "status" => "tersedia",
                   "lokasi" => "Garaj Utama", "odometer" => 0, "roadtax" => "", "bahanApi" => 0];
    foreach (["plat", "model", "jenis", "lokasi", "roadtax", "status"] as $k)
        if (array_key_exists($k, $in)) $v[$k] = trim((string) $in[$k]);
    foreach (["kapasiti", "odometer", "bahanApi"] as $k)
        if (array_key_exists($k, $in)) $v[$k] = (int) $in[$k];
    $v["plat"] = strtoupper($v["plat"]);
    $v["bahanApi"] = max(0, min(100, (int) $v["bahanApi"]));

    if ($v["plat"] === "" || $v["model"] === "") return ["ok" => false, "ralat" => "No. pendaftaran dan model wajib diisi."];
    if ((int) $v["kapasiti"] < 1) return ["ok" => false, "ralat" => "Kapasiti mesti sekurang-kurangnya 1."];
    if ((int) $v["odometer"] < 0) return ["ok" => false, "ralat" => "Odometer tidak sah."];
    if (!in_array($v["status"], ["tersedia", "selenggara", "dipadam"], true)) $v["status"] = "tersedia";

    $dup = db()->prepare("SELECT id FROM kenderaan WHERE UPPER(plat) = :p AND id <> :id");
    $dup->execute([":p" => $v["plat"], ":id" => $id]);
    if ($dup->fetch()) return ["ok" => false, "ralat" => "No. pendaftaran ini sudah wujud dalam sistem."];

    if ($v["status"] === "dipadam" && ($lama["status"] ?? "") !== "dipadam") {
        $aktif = adaTempahanAktif_("vehicleId", $id);
        if ($aktif) return ["ok" => false, "ralat" => "Kenderaan mempunyai tempahan aktif (" . implode(", ", $aktif) . ") — selesaikan atau tugaskan semula dahulu."];
    }

    $params = [":plat" => $v["plat"], ":model" => $v["model"], ":jenis" => $v["jenis"], ":kap" => (int) $v["kapasiti"],
               ":st" => $v["status"], ":lok" => $v["lokasi"], ":odo" => (int) $v["odometer"], ":rt" => $v["roadtax"], ":api" => (int) $v["bahanApi"]];
    if ($lama) {
        db()->prepare("UPDATE kenderaan SET plat=:plat, model=:model, jenis=:jenis, kapasiti=:kap, status=:st, lokasi=:lok,
                       odometer=:odo, roadtax=:rt, bahanApi=:api WHERE id=:id")->execute($params + [":id" => $id]);
    } else {
        $id = nextId_("kenderaan", "K");
        db()->prepare("INSERT INTO kenderaan (id, plat, model, jenis, kapasiti, status, lokasi, odometer, roadtax, bahanApi)
                       VALUES (:id, :plat, :model, :jenis, :kap, :st, :lok, :odo, :rt, :api)")->execute($params + [":id" => $id]);
    }
    $tindakan = !$lama ? "Tambah Kenderaan" : ($v["status"] === "dipadam" && $lama["status"] !== "dipadam" ? "Arkib Kenderaan" : "Kemas Kini Kenderaan");
    logAudit_($user["userId"], $tindakan, "", $id . " " . $v["plat"]);
    return ["ok" => true, "id" => $id, "data" => buildData_($user)];
}

/* ---------- Pemandu: kemas kini rekod SEDIA ADA sahaja (rekod baharu melalui userAdd) ---------- */
function driverSave_(array $user, array $d): array {
    $in = is_array($d["driver"] ?? null) ? $d["driver"] : [];
    $id = trim((string) ($in["id"] ?? ""));
    $lama = $id !== "" ? ambilRekod_("pemandu", $id) : null;
    if (!$lama) return ["ok" => false, "ralat" => "Rekod pemandu tidak dijumpai."];

    $p = $lama;
    foreach (["nama", "telefon", "lesen", "status"] as $k)
        if (array_key_exists($k, $in)) $p[$k] = trim((string) $in[$k]);
    if ($p["nama"] === "" || $p["telefon"] === "" || $p["lesen"] === "") return ["ok" => false, "ralat" => "Nama, no. telefon dan kelas lesen wajib diisi."];
    if (!in_array($p["status"], ["bertugas", "cuti", "dipadam"], true)) $p["status"] = "bertugas";

    if ($p["status"] === "dipadam" && $lama["status"] !== "dipadam") {
        $aktif = adaTempahanAktif_("driverId", $id);
        if ($aktif) return ["ok" => false, "ralat" => "Pemandu mempunyai tugasan aktif (" . implode(", ", $aktif) . ") — selesaikan atau tugaskan semula dahulu."];
    }

    db()->prepare("UPDATE pemandu SET nama=:n, telefon=:t, lesen=:l, status=:s WHERE id=:id")
        ->execute([":n" => $p["nama"], ":t" => $p["telefon"], ":l" => $p["lesen"], ":s" => $p["status"], ":id" => $id]);
    $tindakan = $p["status"] === "dipadam" && $lama["status"] !== "dipadam" ? "Arkib Pemandu" : "Kemas Kini Pemandu";
    logAudit_($user["userId"], $tindakan, "", $id . " " . $p["nama"]);
    return ["ok" => true, "data" => buildData_($user)];
}

/* ---------- Selenggaraan: tambah / kemas kini / padam ---------- */
function maintSave_(array $user, array $d): array {
    $in = is_array($d["rec"] ?? null) ? $d["rec"] : [];
    $id = trim((string) ($in["id"] ?? ""));
    $lama = $id !== "" ? ambilRekod_("selenggaraan", $id) : null;
    if ($id !== "" && !$lama) return ["ok" => false, "ralat" => "Rekod selenggaraan tidak dijumpai."];

    $s = [
        "vehicleId" => trim((string) ($in["vehicleId"] ?? "")),
        "tarikh"    => trim((string) ($in["tarikh"] ?? "")),
        "jenis"     => trim((string) ($in["jenis"] ?? "")),
        "butiran"   => trim((string) ($in["butiran"] ?? "")),
        "bengkel"   => trim((string) ($in["bengkel"] ?? "")),
        "kos"       => max(0, (float) ($in["kos"] ?? 0)),
        "odometer"  => max(0, (int) ($in["odometer"] ?? 0)),
        "status"    => in_array($in["status"] ?? "", ["dijadual", "dalam_proses", "selesai"], true) ? $in["status"] : "selesai",
    ];
    if (!$s["tarikh"] || !$s["butiran"] || !$s["bengkel"]) return ["ok" => false, "ralat" => "Tarikh, butiran kerja dan bengkel wajib diisi."];
    if (!ambilRekod_("kenderaan", $s["vehicleId"])) return ["ok" => false, "ralat" => "Kenderaan tidak dijumpai."];

    $params = [":v" => $s["vehicleId"], ":t" => $s["tarikh"], ":j" => $s["jenis"], ":b" => $s["butiran"], ":k" => $s["kos"],
               ":o" => $s["odometer"], ":g" => $s["bengkel"], ":s" => $s["status"]];
    if ($lama) {
        db()->prepare("UPDATE selenggaraan SET vehicleId=:v, tarikh=:t, jenis=:j, butiran=:b, kos=:k, odometer=:o, bengkel=:g, status=:s WHERE id=:id")
            ->execute($params + [":id" => $id]);
    } else {
        $id = nextId_("selenggaraan", "S");
        db()->prepare("INSERT INTO selenggaraan (id, vehicleId, tarikh, jenis, butiran, kos, odometer, bengkel, status)
                       VALUES (:id, :v, :t, :j, :b, :k, :o, :g, :s)")->execute($params + [":id" => $id]);
    }
    logAudit_($user["userId"], $lama ? "Kemas Kini Selenggaraan" : "Tambah Selenggaraan", "", $id . " " . $s["vehicleId"]);
    return ["ok" => true, "id" => $id, "data" => buildData_($user)];
}

function maintDel_(array $user, array $d): array {
    $id = trim((string) ($d["id"] ?? ""));
    $stmt = db()->prepare("DELETE FROM selenggaraan WHERE id = :id");
    $stmt->execute([":id" => $id]);
    if ($stmt->rowCount() === 0) return ["ok" => false, "ralat" => "Rekod selenggaraan tidak dijumpai."];
    logAudit_($user["userId"], "Padam Selenggaraan", "", $id);
    return ["ok" => true, "data" => buildData_($user)];
}

/* ---------- Jejak audit ---------- */
function logAudit_(string $userId, string $tindakan, string $tempahanId = "", string $butiran = ""): void {
    try {
        db()->prepare("INSERT INTO log (masa, userId, tindakan, tempahanId, butiran) VALUES (:m, :u, :t, :id, :b)")
            ->execute([":m" => nowKL_(), ":u" => $userId, ":t" => $tindakan, ":id" => $tempahanId, ":b" => $butiran]);
    } catch (Throwable $e) { /* jangan biar kegagalan log menggagalkan operasi utama */ }
}

function setahunLalu_(): string {
    $d = new DateTime("now", new DateTimeZone(TZ));
    $d->modify("-1 year");
    return $d->format("Y-m-d");
}

/* ---------- Padam log audit melebihi 1 tahun (admin) ---------- */
function logPurge_(array $user): array {
    $cutoff = setahunLalu_();
    $pdo = db();
    $before = (int) $pdo->query("SELECT COUNT(*) FROM log")->fetchColumn();
    $pdo->prepare("DELETE FROM log WHERE SUBSTRING(masa,1,10) < :c")->execute([":c" => $cutoff]);
    $after = (int) $pdo->query("SELECT COUNT(*) FROM log")->fetchColumn();
    $dibuang = $before - $after;
    logAudit_($user["userId"], "Padam Log", "", "{$dibuang} rekod melebihi 1 tahun");
    return ["ok" => true, "dibuang" => $dibuang];
}

/* ---------- ID tempahan seterusnya ---------- */
function nextBookingId_(): string {
    $max = 1045;
    $ids = db()->query("SELECT id FROM tempahan")->fetchAll(PDO::FETCH_COLUMN);
    foreach ($ids as $id) {
        if (preg_match('/^T-(\d+)$/', (string) $id, $m) && (int) $m[1] > $max) $max = (int) $m[1];
    }
    return "T-" . ($max + 1);
}

/* ---------- Pemohon/pemandu: cipta tempahan baharu ---------- */
function bookingAdd_(array $user, array $b): array {
    $rec = [
        "id" => nextBookingId_(),
        "pemohon" => trim((string) ($b["pemohon"] ?? "")),
        "bahagian" => trim((string) ($b["bahagian"] ?? "")),
        "tujuan" => trim((string) ($b["tujuan"] ?? "")),
        "destinasi" => trim((string) ($b["destinasi"] ?? "")),
        "tarikh" => trim((string) ($b["tarikh"] ?? "")),
        "masaMula" => trim((string) ($b["masaMula"] ?? "")),
        "masaTamat" => trim((string) ($b["masaTamat"] ?? "")),
        "penumpang" => max(1, (int) ($b["penumpang"] ?? 1)),
        "status" => "menunggu",
        "vehicleId" => null,
        "driverId" => null,
        "userId" => $user["userId"],
        "masaSelesai" => "",
        "tarikhTamat" => trim((string) ($b["tarikhTamat"] ?? "")),
    ];
    if (!$rec["pemohon"] || !$rec["tujuan"] || !$rec["destinasi"] || !$rec["tarikh"] || !$rec["masaMula"])
        return ["ok" => false, "ralat" => "Maklumat tempahan tidak lengkap."];
    $now = nowKL_(); $hariIni = substr($now, 0, 10); $masaIni = substr($now, 11, 5);
    if ($rec["tarikh"] < $hariIni) return ["ok" => false, "ralat" => "Tarikh tempahan tidak boleh pada masa lampau."];
    if ($rec["tarikh"] === $hariIni && $rec["masaMula"] < $masaIni) return ["ok" => false, "ralat" => "Masa mula tempahan sudah berlalu."];
    if ($rec["tarikhTamat"] && $rec["tarikhTamat"] < $rec["tarikh"]) return ["ok" => false, "ralat" => "Tarikh tamat mesti pada atau selepas tarikh mula."];

    db()->prepare(
        "INSERT INTO tempahan (id,pemohon,bahagian,tujuan,destinasi,tarikh,masaMula,masaTamat,penumpang,status,vehicleId,driverId,userId,masaSelesai,tarikhTamat)
         VALUES (:id,:pemohon,:bahagian,:tujuan,:destinasi,:tarikh,:masaMula,:masaTamat,:penumpang,:status,NULL,NULL,:userId,:masaSelesai,:tarikhTamat)"
    )->execute([
        ":id" => $rec["id"], ":pemohon" => $rec["pemohon"], ":bahagian" => $rec["bahagian"], ":tujuan" => $rec["tujuan"],
        ":destinasi" => $rec["destinasi"], ":tarikh" => $rec["tarikh"], ":masaMula" => $rec["masaMula"], ":masaTamat" => $rec["masaTamat"],
        ":penumpang" => $rec["penumpang"], ":status" => $rec["status"], ":userId" => $rec["userId"],
        ":masaSelesai" => $rec["masaSelesai"], ":tarikhTamat" => $rec["tarikhTamat"],
    ]);
    logAudit_($user["userId"], "Tempahan Baharu", $rec["id"], $rec["destinasi"]);
    return ["ok" => true, "booking" => $rec];
}

function ambilTempahan_(string $id): ?array {
    $stmt = db()->prepare("SELECT * FROM tempahan WHERE id = :id");
    $stmt->execute([":id" => $id]);
    $r = $stmt->fetch();
    return $r ? castRow($r, ["penumpang"], [], ["vehicleId", "driverId", "userId"]) : null;
}

/* ---------- Tandakan tempahan selesai (admin ATAU pemandu ditugaskan) ---------- */
function bookingComplete_(array $user, array $d): array {
    $b = ambilTempahan_((string) ($d["id"] ?? ""));
    if (!$b) return ["ok" => false, "ralat" => "Tempahan tidak dijumpai."];
    $bolehAdmin = $user["peranan"] === "admin";
    $bolehPemandu = $user["peranan"] === "pemandu" && !empty($user["driverId"]) && $b["driverId"] === $user["driverId"];
    if (!$bolehAdmin && !$bolehPemandu) return ["ok" => false, "ralat" => "Anda tidak dibenarkan menyelesaikan tempahan ini."];
    if ($b["status"] !== "diluluskan") return ["ok" => false, "ralat" => "Hanya tempahan yang diluluskan boleh ditanda selesai."];

    $adaOdo = isset($d["odometer"]) && $d["odometer"] !== "" && $d["odometer"] !== null;
    $adaApi = isset($d["bahanApi"]) && $d["bahanApi"] !== "" && $d["bahanApi"] !== null;
    $adaLok = isset($d["lokasi"]) && trim((string) $d["lokasi"]) !== "";

    if ($user["peranan"] === "pemandu" && (!$adaOdo || !$adaApi || !$adaLok))
        return ["ok" => false, "ralat" => "Sila lengkapkan odometer, bahan api dan lokasi kenderaan."];

    $vehicleOut = null;
    if (!empty($b["vehicleId"]) && ($adaOdo || $adaApi || $adaLok)) {
        $stmt = db()->prepare("SELECT * FROM kenderaan WHERE id = :id");
        $stmt->execute([":id" => $b["vehicleId"]]);
        $v = $stmt->fetch();
        if ($v) {
            $v = castRow($v, ["kapasiti", "odometer", "bahanApi"]);
            if ($adaOdo) {
                $odoBaru = (float) $d["odometer"];
                if (!is_numeric($d["odometer"]) || $odoBaru < (float) $v["odometer"])
                    return ["ok" => false, "ralat" => "Odometer tidak boleh kurang daripada bacaan semasa (" . number_format((float) $v["odometer"]) . " km)."];
                $v["odometer"] = (int) $odoBaru;
            }
            if ($adaApi) $v["bahanApi"] = max(0, min(100, (int) $d["bahanApi"]));
            if ($adaLok) $v["lokasi"] = trim((string) $d["lokasi"]);
            db()->prepare("UPDATE kenderaan SET odometer=:o, bahanApi=:a, lokasi=:l WHERE id=:id")
                ->execute([":o" => $v["odometer"], ":a" => $v["bahanApi"], ":l" => $v["lokasi"], ":id" => $v["id"]]);
            $vehicleOut = $v;
        }
    }

    $ms = nowKL_();
    $b["status"] = "selesai";
    $b["masaSelesai"] = $ms;
    [$tgl, $jam] = explode(" ", $ms);
    if (!$b["masaTamat"]) $b["masaTamat"] = $jam;
    if ($tgl !== $b["tarikh"]) $b["tarikhTamat"] = $tgl;

    db()->prepare("UPDATE tempahan SET status=:s, masaSelesai=:ms, masaTamat=:mt, tarikhTamat=:tt WHERE id=:id")
        ->execute([":s" => $b["status"], ":ms" => $b["masaSelesai"], ":mt" => $b["masaTamat"], ":tt" => $b["tarikhTamat"], ":id" => $b["id"]]);

    logAudit_($user["userId"], "Selesai", $b["id"], $vehicleOut ? ("odo " . $vehicleOut["odometer"] . "km, api " . $vehicleOut["bahanApi"] . "%") : $b["masaSelesai"]);
    return ["ok" => true, "booking" => $b, "vehicle" => $vehicleOut];
}

/* ---------- Semakan pertindihan tempahan (tarikh + masa) ---------- */
function tamatEf_(array $b): string { return $b["masaTamat"] ?: "23:59"; }
function tarikhTamatEf_(array $b): string { return $b["tarikhTamat"] ?: $b["tarikh"]; }
function bertindih_(array $a, array $b): bool {
    $aMula = $a["tarikh"] . " " . $a["masaMula"]; $aTamat = tarikhTamatEf_($a) . " " . tamatEf_($a);
    $bMula = $b["tarikh"] . " " . $b["masaMula"]; $bTamat = tarikhTamatEf_($b) . " " . tamatEf_($b);
    return $aMula < $bTamat && $bMula < $aTamat;
}

/* ---------- Luluskan tempahan (admin) — konflik disahkan di SERVER ---------- */
function bookingApprove_(array $user, array $d): array {
    $b = ambilTempahan_((string) ($d["id"] ?? ""));
    if (!$b) return ["ok" => false, "ralat" => "Tempahan tidak dijumpai."];
    if ($b["status"] !== "menunggu") return ["ok" => false, "ralat" => "Hanya tempahan menunggu boleh diluluskan."];
    $vId = (string) ($d["vehicleId"] ?? ""); $dId = (string) ($d["driverId"] ?? "");
    if (!$vId || !$dId) return ["ok" => false, "ralat" => "Sila pilih kenderaan dan pemandu."];

    $stmt = db()->prepare("SELECT * FROM kenderaan WHERE id = :id"); $stmt->execute([":id" => $vId]); $v = $stmt->fetch();
    $stmt = db()->prepare("SELECT * FROM pemandu WHERE id = :id"); $stmt->execute([":id" => $dId]); $p = $stmt->fetch();
    if (!$v) return ["ok" => false, "ralat" => "Kenderaan tidak dijumpai."];
    if (!$p) return ["ok" => false, "ralat" => "Pemandu tidak dijumpai."];
    $v = castRow($v, ["kapasiti", "odometer", "bahanApi"]);
    if ($v["status"] === "dipadam") return ["ok" => false, "ralat" => "Kenderaan telah diarkibkan."];
    if ($v["status"] === "selenggara") return ["ok" => false, "ralat" => "Kenderaan sedang dalam selenggaraan."];
    if ((int) $v["kapasiti"] < (int) $b["penumpang"]) return ["ok" => false, "ralat" => "Kapasiti kenderaan tidak mencukupi."];
    if ($p["status"] === "dipadam") return ["ok" => false, "ralat" => "Pemandu telah diarkibkan."];
    if ($p["status"] === "cuti") return ["ok" => false, "ralat" => "Pemandu sedang bercuti."];

    $semua = readTempahan();
    $konflik = array_values(array_filter($semua, fn($x) =>
        $x["id"] !== $b["id"] && $x["status"] === "diluluskan" && bertindih_($x, $b) && ($x["vehicleId"] === $vId || $x["driverId"] === $dId)
    ));
    if (!empty($konflik))
        return ["ok" => false, "ralat" => "Konflik jadual dengan " . implode(", ", array_map(fn($c) => $c["id"], $konflik)) . " — kenderaan/pemandu sudah ditugaskan pada masa bertindih."];

    $b["status"] = "diluluskan"; $b["vehicleId"] = $vId; $b["driverId"] = $dId;
    db()->prepare("UPDATE tempahan SET status=:s, vehicleId=:v, driverId=:d WHERE id=:id")
        ->execute([":s" => $b["status"], ":v" => $vId, ":d" => $dId, ":id" => $b["id"]]);
    logAudit_($user["userId"], "Lulus", $b["id"], $vId . " / " . $dId);
    return ["ok" => true, "booking" => $b];
}

/* ---------- Tolak tempahan (admin) ---------- */
function bookingReject_(array $user, array $d): array {
    $b = ambilTempahan_((string) ($d["id"] ?? ""));
    if (!$b) return ["ok" => false, "ralat" => "Tempahan tidak dijumpai."];
    if ($b["status"] !== "menunggu") return ["ok" => false, "ralat" => "Hanya tempahan menunggu boleh ditolak."];
    $b["status"] = "ditolak";
    db()->prepare("UPDATE tempahan SET status=:s WHERE id=:id")->execute([":s" => "ditolak", ":id" => $b["id"]]);
    logAudit_($user["userId"], "Tolak", $b["id"], "");
    return ["ok" => true, "booking" => $b];
}

/* ---------- Edit tempahan (admin) — hanya sebelum tempahan bermula ---------- */
function bookingEdit_(array $user, array $d): array {
    $b = ambilTempahan_((string) ($d["id"] ?? ""));
    if (!$b) return ["ok" => false, "ralat" => "Tempahan tidak dijumpai."];
    if ($b["status"] !== "menunggu" && $b["status"] !== "diluluskan")
        return ["ok" => false, "ralat" => "Hanya tempahan menunggu atau diluluskan boleh diedit."];

    $now = nowKL_();
    if (($b["tarikh"] . " " . $b["masaMula"]) <= $now) return ["ok" => false, "ralat" => "Tempahan sedang berjalan. Tiada perubahan dibenarkan."];

    $calon = [
        "id" => $b["id"],
        "pemohon" => trim((string) ($d["pemohon"] ?? "")),
        "bahagian" => trim((string) ($d["bahagian"] ?? "")),
        "tujuan" => trim((string) ($d["tujuan"] ?? "")),
        "destinasi" => trim((string) ($d["destinasi"] ?? "")),
        "tarikh" => trim((string) ($d["tarikh"] ?? "")),
        "masaMula" => trim((string) ($d["masaMula"] ?? "")),
        "masaTamat" => trim((string) ($d["masaTamat"] ?? "")),
        "tarikhTamat" => trim((string) ($d["tarikhTamat"] ?? "")),
        "penumpang" => max(1, (int) ($d["penumpang"] ?? 1)),
    ];
    if (!$calon["pemohon"] || !$calon["tujuan"] || !$calon["destinasi"] || !$calon["tarikh"] || !$calon["masaMula"])
        return ["ok" => false, "ralat" => "Maklumat tempahan tidak lengkap."];

    $hariIni = substr($now, 0, 10); $masaIni = substr($now, 11, 5);
    if ($calon["tarikh"] < $hariIni) return ["ok" => false, "ralat" => "Tarikh tempahan tidak boleh pada masa lampau."];
    if ($calon["tarikh"] === $hariIni && $calon["masaMula"] < $masaIni) return ["ok" => false, "ralat" => "Masa mula tempahan sudah berlalu."];
    if ($calon["tarikhTamat"] && $calon["tarikhTamat"] < $calon["tarikh"]) return ["ok" => false, "ralat" => "Tarikh tamat mesti pada atau selepas tarikh mula."];

    if ($b["status"] === "diluluskan" && (!empty($b["vehicleId"]) || !empty($b["driverId"]))) {
        $semua = readTempahan();
        $konflik = array_values(array_filter($semua, fn($x) =>
            $x["id"] !== $b["id"] && $x["status"] === "diluluskan" && bertindih_($x, $calon) &&
            ($x["vehicleId"] === $b["vehicleId"] || $x["driverId"] === $b["driverId"])
        ));
        if (!empty($konflik))
            return ["ok" => false, "ralat" => "Konflik jadual dengan " . implode(", ", array_map(fn($c) => $c["id"], $konflik)) . " — kenderaan/pemandu sudah ditugaskan pada masa bertindih."];
        if (!empty($b["vehicleId"])) {
            $stmt = db()->prepare("SELECT kapasiti FROM kenderaan WHERE id = :id"); $stmt->execute([":id" => $b["vehicleId"]]);
            $kap = $stmt->fetchColumn();
            if ($kap !== false && (int) $kap < $calon["penumpang"])
                return ["ok" => false, "ralat" => "Kapasiti kenderaan tidak mencukupi untuk bilangan penumpang."];
        }
    }

    db()->prepare(
        "UPDATE tempahan SET pemohon=:pemohon, bahagian=:bahagian, tujuan=:tujuan, destinasi=:destinasi,
         tarikh=:tarikh, masaMula=:masaMula, masaTamat=:masaTamat, tarikhTamat=:tarikhTamat, penumpang=:penumpang WHERE id=:id"
    )->execute([
        ":pemohon" => $calon["pemohon"], ":bahagian" => $calon["bahagian"], ":tujuan" => $calon["tujuan"], ":destinasi" => $calon["destinasi"],
        ":tarikh" => $calon["tarikh"], ":masaMula" => $calon["masaMula"], ":masaTamat" => $calon["masaTamat"],
        ":tarikhTamat" => $calon["tarikhTamat"], ":penumpang" => $calon["penumpang"], ":id" => $b["id"],
    ]);
    $b = array_merge($b, $calon);
    logAudit_($user["userId"], "Edit Tempahan", $b["id"], $calon["destinasi"]);
    return ["ok" => true, "booking" => $b];
}

/* ---------- Pengguna tukar kata laluan sendiri ---------- */
function tukarPw_(array $user, array $d): array {
    $stmt = db()->prepare("SELECT * FROM pengguna WHERE userId = :u"); $stmt->execute([":u" => $user["userId"]]);
    $u = $stmt->fetch();
    if (!$u) return ["ok" => false, "ralat" => "Akaun tidak dijumpai."];
    if (hash_($u["salt"], (string) ($d["passwordLama"] ?? "")) !== $u["passwordHash"]) {
        tandaLengah_();
        return ["ok" => false, "ralat" => "Kata laluan semasa salah."];
    }
    $baru = (string) ($d["passwordBaru"] ?? "");
    if (strlen($baru) < 6) return ["ok" => false, "ralat" => "Kata laluan baharu mestilah sekurang-kurangnya 6 aksara."];
    $salt = saltBaru_();
    db()->prepare("UPDATE pengguna SET salt=:s, passwordHash=:h WHERE userId=:u")
        ->execute([":s" => $salt, ":h" => hash_($salt, $baru), ":u" => $user["userId"]]);
    $token = (string) ($d["token"] ?? "");
    db()->prepare("DELETE FROM sesi WHERE userId = :u AND token <> :t")->execute([":u" => $user["userId"], ":t" => $token]);
    return ["ok" => true];
}

/* ---------- Pemandu kemas kini status sendiri ---------- */
function drvStatus_(array $user, array $d): array {
    if ($user["peranan"] !== "pemandu" || empty($user["driverId"]))
        return ["ok" => false, "ralat" => "Hanya akaun pemandu yang dipautkan boleh menukar status."];
    $status = ($d["status"] ?? "") === "cuti" ? "cuti" : "bertugas";
    $stmt = db()->prepare("UPDATE pemandu SET status=:s WHERE id=:id");
    $stmt->execute([":s" => $status, ":id" => $user["driverId"]]);
    if ($stmt->rowCount() === 0) {
        $chk = db()->prepare("SELECT id FROM pemandu WHERE id=:id"); $chk->execute([":id" => $user["driverId"]]);
        if (!$chk->fetch()) return ["ok" => false, "ralat" => "Rekod pemandu tidak dijumpai."];
    }
    return ["ok" => true, "status" => $status];
}

/* ---------- Pengurusan pengguna (admin) ---------- */
function senaraiUsers_(): array {
    return array_map(
        fn($u) => ["userId" => $u["userId"], "nama" => $u["nama"], "peranan" => $u["peranan"], "driverId" => $u["driverId"] ?: null],
        readPengguna()
    );
}

function userAdd_(array $d): array {
    $userId = trim((string) ($d["userId"] ?? ""));
    if (!$userId || empty($d["nama"]) || empty($d["password"])) return ["ok" => false, "ralat" => "Maklumat tidak lengkap."];
    if (strlen((string) $d["password"]) < 6) return ["ok" => false, "ralat" => "Kata laluan mestilah sekurang-kurangnya 6 aksara."];
    $stmt = db()->prepare("SELECT userId FROM pengguna WHERE LOWER(userId) = LOWER(:u)");
    $stmt->execute([":u" => $userId]);
    if ($stmt->fetch()) return ["ok" => false, "ralat" => "ID pengguna ini sudah wujud."];
    $peranan = in_array($d["peranan"] ?? "", ["admin", "pemandu"], true) ? $d["peranan"] : "pemohon";
    $nama = trim((string) $d["nama"]);

    /* Akaun peranan pemandu mesti dipautkan kepada rekod pemandu:
       - driverId diberi  -> pautkan kepada rekod SEDIA ADA (cth. pemandu yang diimport
         daripada data lama) yang belum mempunyai akaun;
       - driverId kosong  -> cipta rekod pemandu BAHARU serentak (perlu telefon & lesen). */
    $driverId = null; $rekodBaru = null;
    if ($peranan === "pemandu") {
        $pautId = trim((string) ($d["driverId"] ?? ""));
        if ($pautId !== "") {
            $p = ambilRekod_("pemandu", $pautId);
            if (!$p || $p["status"] === "dipadam") return ["ok" => false, "ralat" => "Rekod pemandu tidak dijumpai atau telah diarkibkan."];
            $guna = db()->prepare("SELECT userId FROM pengguna WHERE driverId = :d");
            $guna->execute([":d" => $pautId]);
            if ($lain = $guna->fetchColumn()) return ["ok" => false, "ralat" => "Rekod pemandu ini sudah dipautkan kepada akaun '{$lain}'."];
            $driverId = $pautId;
        } else {
            $telefon = trim((string) ($d["telefon"] ?? ""));
            $lesen = trim((string) ($d["lesen"] ?? ""));
            if (!$telefon || !$lesen) return ["ok" => false, "ralat" => "Sila lengkapkan no. telefon dan kelas lesen pemandu."];
            $driverId = nextId_("pemandu", "P");
            $rekodBaru = [":id" => $driverId, ":n" => $nama, ":t" => $telefon, ":l" => $lesen];
        }
    }

    // Rekod pemandu + akaun disimpan dalam SATU transaksi (elak rekod pemandu yatim jika akaun gagal dicipta)
    $pdo = db();
    $pdo->beginTransaction();
    try {
        if ($rekodBaru) {
            $pdo->prepare("INSERT INTO pemandu (id, nama, telefon, lesen, status) VALUES (:id,:n,:t,:l,'bertugas')")->execute($rekodBaru);
        }
        $salt = saltBaru_();
        $pdo->prepare("INSERT INTO pengguna (userId, nama, peranan, passwordHash, salt, driverId) VALUES (:u,:n,:p,:h,:s,:d)")
            ->execute([":u" => $userId, ":n" => $nama, ":p" => $peranan, ":h" => hash_($salt, (string) $d["password"]), ":s" => $salt, ":d" => $driverId]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    return ["ok" => true, "users" => senaraiUsers_(), "drivers" => readPemandu()];
}

function userReset_(array $d): array {
    $userId = (string) ($d["userId"] ?? "");
    $stmt = db()->prepare("SELECT userId FROM pengguna WHERE userId = :u"); $stmt->execute([":u" => $userId]);
    if (!$stmt->fetch()) return ["ok" => false, "ralat" => "Pengguna tidak dijumpai."];
    $pw = (string) ($d["password"] ?? "");
    if (strlen($pw) < 6) return ["ok" => false, "ralat" => "Kata laluan mestilah sekurang-kurangnya 6 aksara."];
    $salt = saltBaru_();
    db()->prepare("UPDATE pengguna SET salt=:s, passwordHash=:h WHERE userId=:u")
        ->execute([":s" => $salt, ":h" => hash_($salt, $pw), ":u" => $userId]);
    $token = (string) ($d["token"] ?? "");
    db()->prepare("DELETE FROM sesi WHERE userId = :u AND token <> :t")->execute([":u" => $userId, ":t" => $token]);
    return ["ok" => true, "users" => senaraiUsers_()];
}

function userDel_(array $user, array $d): array {
    $userId = (string) ($d["userId"] ?? "");
    if ($userId === $user["userId"]) return ["ok" => false, "ralat" => "Anda tidak boleh memadam akaun sendiri."];
    $pdo = db();
    $admins = (int) $pdo->query("SELECT COUNT(*) FROM pengguna WHERE peranan='admin' AND userId <> " . $pdo->quote($userId))->fetchColumn();
    if ($admins === 0) return ["ok" => false, "ralat" => "Mesti ada sekurang-kurangnya seorang admin."];
    $pdo->prepare("DELETE FROM pengguna WHERE userId = :u")->execute([":u" => $userId]);
    $pdo->prepare("DELETE FROM sesi WHERE userId = :u")->execute([":u" => $userId]);
    return ["ok" => true, "users" => senaraiUsers_()];
}

/* ============================================================
   POST: semua operasi (setiap permintaan dikunci dengan GET_LOCK MySQL)
   ============================================================ */
function handle(): array {
    $raw = file_get_contents("php://input");
    $d = json_decode($raw, true);
    if (!is_array($d)) return ["ok" => false, "ralat" => "Data permintaan tidak sah."];

    $action = $d["action"] ?? "";

    if ($action === "login") return login_($d);
    if ($action === "awam") return ["ok" => true, "data" => dataAwam_()];

    $user = cekSesi_($d["token"] ?? null);
    if (!$user) return ["ok" => false, "ralat" => "Sesi tidak sah atau telah tamat. Sila log masuk semula.", "sesiTamat" => true];

    switch ($action) {
        case "load": return ["ok" => true, "data" => buildData_($user)];
        case "vehicleSave": return adminSahaja_($user) ?? vehicleSave_($user, $d);
        case "driverSave": return adminSahaja_($user) ?? driverSave_($user, $d);
        case "maintSave": return adminSahaja_($user) ?? maintSave_($user, $d);
        case "maintDel": return adminSahaja_($user) ?? maintDel_($user, $d);
        case "bookingAdd": return bookingAdd_($user, $d["booking"] ?? []);
        case "bookingComplete": return bookingComplete_($user, $d);
        case "bookingApprove": return adminSahaja_($user) ?? bookingApprove_($user, $d);
        case "bookingReject": return adminSahaja_($user) ?? bookingReject_($user, $d);
        case "bookingEdit": return adminSahaja_($user) ?? bookingEdit_($user, $d);
        case "auditLog": return adminSahaja_($user) ?? ["ok" => true, "log" => readLogTerkini()];
        case "logPurge": return adminSahaja_($user) ?? logPurge_($user);
        case "logout":
            db()->prepare("DELETE FROM sesi WHERE token = :t")->execute([":t" => $d["token"] ?? ""]);
            return ["ok" => true];
        case "tukarPw": return tukarPw_($user, $d);
        case "drvStatus": return drvStatus_($user, $d);
        case "userAdd": {
            $res = adminSahaja_($user) ?? userAdd_($d);
            if ($res["ok"] ?? false) logAudit_($user["userId"], "Tambah Pengguna", "", (string) ($d["userId"] ?? ""));
            return $res;
        }
        case "userReset": {
            $res = adminSahaja_($user) ?? userReset_($d);
            if ($res["ok"] ?? false) logAudit_($user["userId"], "Reset Kata Laluan", "", (string) ($d["userId"] ?? ""));
            return $res;
        }
        case "userDel": {
            $res = adminSahaja_($user) ?? userDel_($user, $d);
            if ($res["ok"] ?? false) logAudit_($user["userId"], "Padam Pengguna", "", (string) ($d["userId"] ?? ""));
            return $res;
        }
        default: return ["ok" => false, "ralat" => "Tindakan tidak dikenali."];
    }
}

$gotLock = false;
try {
    $pdo = db();
    $gotLock = (int) $pdo->query("SELECT GET_LOCK('sisken_api', 10)")->fetchColumn() === 1;
    // Tanpa kunci, semakan konflik/ID boleh berlumba — lebih selamat tolak daripada teruskan
    $res = $gotLock ? handle() : ["ok" => false, "ralat" => "Pelayan sibuk. Sila cuba sebentar lagi."];
} catch (Throwable $e) {
    error_log("SisKEN API: " . $e->getMessage() . " @ " . $e->getFile() . ":" . $e->getLine());
    $res = ["ok" => false, "ralat" => "Ralat pelayan. Sila cuba lagi atau hubungi pentadbir sistem."];
} finally {
    if ($gotLock) {
        try { $pdo->query("SELECT RELEASE_LOCK('sisken_api')"); } catch (Throwable $e) { /* sambungan terputus — kunci dilepas automatik */ }
    }
}
if ($LENGAH_GAGAL) usleep(500000); // selepas kunci dilepaskan
echo json_encode($res);
