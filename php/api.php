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
header("X-Content-Type-Options: nosniff");
header("Cache-Control: no-store");
// Tiada pengepala CORS: frontend & API berkongsi asal (same-origin). Laman lain TIDAK boleh membaca balasan API ini.

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
    $u = db()->prepare("SELECT userId, nama, peranan, driverId, superadmin FROM pengguna WHERE userId = :u");
    $u->execute([":u" => $row["userId"]]);
    $user = $u->fetch();
    if (!$user) return null;
    return ["userId" => $user["userId"], "nama" => $user["nama"], "peranan" => $user["peranan"],
            "driverId" => $user["driverId"] ?: null, "superadmin" => (int) $user["superadmin"] === 1];
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
        /* Nombor telefon pemandu hanya didedahkan bagi tempahan yang benar-benar
           melibatkan pengguna ini dan telah diluluskan — untuk menyelaras tempat
           berjumpa. Pemandu lain kekal tanpa nombor. */
        $bolehHubungi = [];
        foreach ($bookings as $b) {
            if (!empty($b["driverId"]) && ($b["status"] === "diluluskan" || $b["status"] === "selesai"))
                $bolehHubungi[$b["driverId"]] = true;
        }
        $drivers = array_map(function ($d) use ($bolehHubungi) {
            $o = ["id" => $d["id"], "nama" => $d["nama"], "status" => $d["status"]];
            if (isset($bolehHubungi[$d["id"]])) $o["telefon"] = $d["telefon"];
            return $o;
        }, $drivers);
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
            fn($u) => ["userId" => $u["userId"], "nama" => $u["nama"], "peranan" => $u["peranan"],
                       "driverId" => $u["driverId"] ?: null, "superadmin" => (int) ($u["superadmin"] ?? 0) === 1],
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
        "diterima" => $b["diterima"] ?: "",
    ], $bookings);
    $drivers = array_map(fn($d) => ["id" => $d["id"], "nama" => $d["nama"], "status" => $d["status"]], readPemandu());
    $vehicles = array_map(fn($v) => ["id" => $v["id"], "plat" => $v["plat"], "model" => $v["model"], "jenis" => $v["jenis"], "status" => $v["status"]], readKenderaan());
    return ["bookings" => $bookings, "drivers" => $drivers, "vehicles" => $vehicles];
}

function adminSahaja_(array $user): ?array {
    return $user["peranan"] === "admin" ? null : ["ok" => false, "ralat" => "Hanya admin dibenarkan."];
}

/* ============================================================
   SUPERADMIN — lapisan perlindungan nipis di atas peranan "admin".
   Admin biasa menguruskan operasi harian (tempahan, kenderaan, pemandu,
   akaun pemohon/pemandu). Hanya superadmin boleh menyentuh akaun admin,
   menukar status superadmin, dan memadam log audit — supaya seorang admin
   tidak boleh menaikkan dirinya sendiri atau membuang jejak auditnya.
   ============================================================ */
function isSuper_(array $user): bool {
    return !empty($user["superadmin"]);
}

function superSahaja_(array $user): ?array {
    if ($user["peranan"] !== "admin") return ["ok" => false, "ralat" => "Hanya admin dibenarkan."];
    return isSuper_($user) ? null : ["ok" => false, "ralat" => "Tindakan ini hanya untuk superadmin."];
}

/** Akaun yang dilindungi daripada admin biasa (admin & superadmin) */
function akaunDilindungi_(?array $sasaran): bool {
    return $sasaran && ($sasaran["peranan"] === "admin" || (int) ($sasaran["superadmin"] ?? 0) === 1);
}

function ambilPengguna_(string $userId): ?array {
    $stmt = db()->prepare("SELECT userId, nama, peranan, driverId, superadmin FROM pengguna WHERE userId = :u");
    $stmt->execute([":u" => $userId]);
    $r = $stmt->fetch();
    return $r ?: null;
}

function bilSuperadmin_(string $kecuali = ""): int {
    $stmt = db()->prepare("SELECT COUNT(*) FROM pengguna WHERE superadmin = 1 AND userId <> :u");
    $stmt->execute([":u" => $kecuali]);
    return (int) $stmt->fetchColumn();
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

/** Kunci kawalan cubaan = (userId + IP pelanggan), supaya orang lain tidak boleh mengunci
    akaun seseorang (cth. admin) dari komputer lain dengan sengaja memasukkan kata laluan salah. */
function ipPelanggan_(): string { return (string) ($_SERVER["REMOTE_ADDR"] ?? ""); }
function kunciCubaan_(string $userId): string {
    return substr(hash("sha256", strtolower($userId) . "|" . ipPelanggan_()), 0, 50);
}

function login_(array $d): array {
    $userId = trim((string) ($d["userId"] ?? ""));
    $now = (int) round(microtime(true) * 1000);
    $kunci = kunciCubaan_($userId);
    $rec = bacaCubaan_($kunci);

    if ($rec && (int) $rec["kunciSehingga"] > $now) {
        $minit = (int) ceil(((int) $rec["kunciSehingga"] - $now) / 60000);
        return ["ok" => false, "ralat" => "Akaun dikunci sementara kerana terlalu banyak cubaan. Cuba lagi dalam {$minit} minit."];
    }

    $stmt = db()->prepare("SELECT * FROM pengguna WHERE userId = :u");
    $stmt->execute([":u" => $userId]);
    $u = $stmt->fetch();

    $password = (string) ($d["password"] ?? "");
    if (!$u || !sahKataLaluan_($u, $password)) {
        $gagal = ($rec ? (int) $rec["gagal"] : 0) + 1;
        $dikunci = $gagal >= MAX_CUBAAN;
        tulisCubaan_($kunci, $dikunci ? 0 : $gagal, $dikunci ? $now + KUNCI_MINIT * 60000 : 0);
        tandaLengah_();
        // Catat dalam log audit (hanya akaun yang wujud — elak log dibanjiri ID rawak)
        if ($u) logAudit_($u["userId"], $dikunci ? "Akaun Dikunci" : "Log Masuk Gagal", "", "IP " . ipPelanggan_());
        if ($dikunci) return ["ok" => false, "ralat" => "Terlalu banyak cubaan gagal. Akaun dikunci " . KUNCI_MINIT . " minit."];
        $baki = MAX_CUBAAN - $gagal;
        return ["ok" => false, "ralat" => "ID pengguna atau kata laluan salah." . ($baki <= 2 ? " ({$baki} cubaan lagi sebelum dikunci)" : "")];
    }

    if ($rec) tulisCubaan_($kunci, 0, 0);
    // Naik taraf hash legasi (SHA-256) kepada password_hash() secara automatik semasa log masuk berjaya
    if (perluNaikTaraf_($u)) setKataLaluan_($u["userId"], $password);
    $user = ["userId" => $u["userId"], "nama" => $u["nama"], "peranan" => $u["peranan"],
             "driverId" => $u["driverId"] ?: null, "superadmin" => (int) ($u["superadmin"] ?? 0) === 1];
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
    // Akaun log masuk yang dipautkan guna nama yang sama — kemas kini serentak
    db()->prepare("UPDATE pengguna SET nama=:n WHERE driverId=:id")->execute([":n" => $p["nama"], ":id" => $id]);
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
    if (!tarikhSah_($s["tarikh"])) return ["ok" => false, "ralat" => "Tarikh selenggaraan tidak sah."];
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

/* ---------- Senarai penolakan tugasan (admin: semua; pemandu: miliknya sahaja) ---------- */
function readPenolakan_(array $user): array {
    $isAdmin = $user["peranan"] === "admin";
    $sql = "SELECT p.id, p.tempahanId, p.driverId, p.userId, p.vehicleId, p.masa, p.sebab,
                   t.tujuan, t.destinasi, t.tarikh, t.masaMula, t.masaTamat, t.tarikhTamat,
                   t.pemohon, t.bahagian, t.status AS statusKini,
                   d.nama AS namaPemandu, v.plat AS plat, v.model AS model
            FROM penolakan p
            LEFT JOIN tempahan t ON t.id = p.tempahanId
            LEFT JOIN pemandu  d ON d.id = p.driverId
            LEFT JOIN kenderaan v ON v.id = p.vehicleId";
    $params = [];
    if (!$isAdmin) {
        if (empty($user["driverId"])) return [];
        $sql .= " WHERE p.driverId = :d";
        $params[":d"] = $user["driverId"];
    }
    $sql .= " ORDER BY p.id DESC LIMIT 200";
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

function penolakanList_(array $user): array {
    if ($user["peranan"] !== "admin" && $user["peranan"] !== "pemandu")
        return ["ok" => false, "ralat" => "Hanya admin dan pemandu boleh melihat senarai ini."];
    return ["ok" => true, "senarai" => readPenolakan_($user)];
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

/* ---------- Sahkan format & susunan tarikh/masa tempahan (pulang mesej ralat atau null) ---------- */
function semakMasaTempahan_(array $r): ?string {
    if (!tarikhSah_($r["tarikh"])) return "Tarikh tempahan tidak sah.";
    if (!masaSah_($r["masaMula"])) return "Masa mula tidak sah.";
    if ($r["masaTamat"] !== "" && !masaSah_($r["masaTamat"])) return "Masa tamat tidak sah.";
    if ($r["tarikhTamat"] !== "" && !tarikhSah_($r["tarikhTamat"])) return "Tarikh tamat tidak sah.";
    if ($r["tarikhTamat"] !== "" && $r["tarikhTamat"] < $r["tarikh"]) return "Tarikh tamat mesti pada atau selepas tarikh mula.";
    if ($r["masaTamat"] !== "") {
        $mula = $r["tarikh"] . " " . $r["masaMula"];
        $tamat = ($r["tarikhTamat"] ?: $r["tarikh"]) . " " . $r["masaTamat"];
        if ($tamat <= $mula) return "Masa tamat mesti selepas masa mula.";
    }
    return null;
}

/* ---------- Pemohon/pemandu: cipta tempahan baharu ---------- */
function bookingAdd_(array $user, array $b): array {
    $rec = [
        "id" => nextBookingId_(),
        "pemohon" => trim((string) ($b["pemohon"] ?? "")),
        "bahagian" => trim((string) ($b["bahagian"] ?? "")),
        "telefonPemohon" => trim((string) ($b["telefon"] ?? "")),
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
    if ($rec["telefonPemohon"] === "") return ["ok" => false, "ralat" => "No. telefon untuk dihubungi wajib diisi."];
    if (!telefonSah_($rec["telefonPemohon"])) return ["ok" => false, "ralat" => "No. telefon tidak sah."];
    if ($ralat = semakMasaTempahan_($rec)) return ["ok" => false, "ralat" => $ralat];
    $now = nowKL_(); $hariIni = substr($now, 0, 10); $masaIni = substr($now, 11, 5);
    if ($rec["tarikh"] < $hariIni) return ["ok" => false, "ralat" => "Tarikh tempahan tidak boleh pada masa lampau."];
    if ($rec["tarikh"] === $hariIni && $rec["masaMula"] < $masaIni) return ["ok" => false, "ralat" => "Masa mula tempahan sudah berlalu."];
    if ($rec["tarikhTamat"] && $rec["tarikhTamat"] < $rec["tarikh"]) return ["ok" => false, "ralat" => "Tarikh tamat mesti pada atau selepas tarikh mula."];

    db()->prepare(
        "INSERT INTO tempahan (id,pemohon,bahagian,telefonPemohon,tujuan,destinasi,tarikh,masaMula,masaTamat,penumpang,status,vehicleId,driverId,userId,masaSelesai,tarikhTamat)
         VALUES (:id,:pemohon,:bahagian,:tel,:tujuan,:destinasi,:tarikh,:masaMula,:masaTamat,:penumpang,:status,NULL,NULL,:userId,:masaSelesai,:tarikhTamat)"
    )->execute([
        ":id" => $rec["id"], ":pemohon" => $rec["pemohon"], ":bahagian" => $rec["bahagian"],
        ":tel" => $rec["telefonPemohon"], ":tujuan" => $rec["tujuan"],
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
    /* Pemandu mesti menerima tugasan dahulu; admin tiada had. */
    if (!$bolehAdmin && empty($b["diterima"]))
        return ["ok" => false, "ralat" => "Sila tekan butang Terima Tugas dahulu sebelum menandakan tugasan ini selesai."];
    /* Pemandu hanya boleh menanda selesai setelah perjalanan bermula; admin tiada had. */
    if (!$bolehAdmin && ($b["tarikh"] . " " . $b["masaMula"]) > nowKL_())
        return ["ok" => false, "ralat" => "Tugasan ini belum bermula. Anda hanya boleh menanda selesai setelah perjalanan bermula."];

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
    /* Admin boleh menanda selesai bila-bila masa — termasuk tempahan yang BELUM bermula
       (cth. perjalanan dibatalkan). Dalam kes itu masa kini lebih awal daripada masa mula,
       jadi jangan tulis tarikh/masa tamat yang mendahului masa mula (rekod jadi tidak sah
       dan merosakkan laporan serta semakan konflik) — guna masa mula sebagai masa tamat. */
    if (($tgl . " " . $jam) < ($b["tarikh"] . " " . $b["masaMula"])) {
        $b["tarikhTamat"] = "";
        if (!$b["masaTamat"]) $b["masaTamat"] = $b["masaMula"];
    } else {
        if (!$b["masaTamat"]) $b["masaTamat"] = $jam;
        if ($tgl !== $b["tarikh"]) $b["tarikhTamat"] = $tgl;
    }

    db()->prepare("UPDATE tempahan SET status=:s, masaSelesai=:ms, masaTamat=:mt, tarikhTamat=:tt WHERE id=:id")
        ->execute([":s" => $b["status"], ":ms" => $b["masaSelesai"], ":mt" => $b["masaTamat"], ":tt" => $b["tarikhTamat"], ":id" => $b["id"]]);

    logAudit_($user["userId"], "Selesai", $b["id"], $vehicleOut ? ("odo " . $vehicleOut["odometer"] . "km, api " . $vehicleOut["bahanApi"] . "%") : $b["masaSelesai"]);
    return ["ok" => true, "booking" => $b, "vehicle" => $vehicleOut];
}

/* ============================================================
   PENGESAHAN PEMANDU — tugasan yang diluluskan admin perlu diterima
   oleh pemandu sebelum ia dianggap muktamad. Setelah diterima, paparan
   kenderaan bertukar "Tidak Tersedia" 30 minit lebih awal (dikira di
   pelayar) supaya kenderaan & pemandu bersedia sebelum masa bertolak.
   ============================================================ */
function pemanduTugasanIni_(array $user, array $b): bool {
    return $user["peranan"] === "pemandu" && !empty($user["driverId"]) && $b["driverId"] === $user["driverId"];
}

/* ---------- Pemandu TERIMA tugasan ---------- */
function bookingAccept_(array $user, array $d): array {
    $b = ambilTempahan_((string) ($d["id"] ?? ""));
    if (!$b) return ["ok" => false, "ralat" => "Tempahan tidak dijumpai."];
    if (!pemanduTugasanIni_($user, $b)) return ["ok" => false, "ralat" => "Hanya pemandu yang ditugaskan boleh menerima tugasan ini."];
    if ($b["status"] !== "diluluskan") return ["ok" => false, "ralat" => "Hanya tugasan yang diluluskan boleh diterima."];
    if (!empty($b["diterima"])) return ["ok" => true, "booking" => $b]; // sudah diterima - tiada perubahan

    $b["diterima"] = nowKL_();
    db()->prepare("UPDATE tempahan SET diterima=:t WHERE id=:id")->execute([":t" => $b["diterima"], ":id" => $b["id"]]);
    logAudit_($user["userId"], "Terima Tugas", $b["id"], (string) $b["vehicleId"]);
    return ["ok" => true, "booking" => $b];
}

/* ---------- Pemandu TOLAK tugasan - dikembalikan kepada admin ---------- */
function bookingDecline_(array $user, array $d): array {
    $b = ambilTempahan_((string) ($d["id"] ?? ""));
    if (!$b) return ["ok" => false, "ralat" => "Tempahan tidak dijumpai."];
    if (!pemanduTugasanIni_($user, $b)) return ["ok" => false, "ralat" => "Hanya pemandu yang ditugaskan boleh menolak tugasan ini."];
    if ($b["status"] !== "diluluskan") return ["ok" => false, "ralat" => "Hanya tugasan yang diluluskan boleh ditolak."];
    if (!empty($b["diterima"]))
        return ["ok" => false, "ralat" => "Tugasan ini sudah anda terima. Sila hubungi admin untuk sebarang perubahan."];
    $sebab = trim((string) ($d["sebab"] ?? ""));
    if ($sebab === "") return ["ok" => false, "ralat" => "Sila nyatakan sebab menolak tugasan."];
    if (mb_strlen($sebab) > 200) $sebab = mb_substr($sebab, 0, 200);

    $lama = ((string) $b["vehicleId"]) . " / " . ((string) $b["driverId"]);
    $masa = nowKL_();
    db()->prepare("UPDATE tempahan SET status='menunggu', vehicleId=NULL, driverId=NULL, diterima='' WHERE id=:id")
        ->execute([":id" => $b["id"]]);
    /* Rekod kekal untuk tab "Tugasan Ditolak" (log audit kekal seperti biasa) */
    db()->prepare(
        "INSERT INTO penolakan (tempahanId, driverId, userId, vehicleId, masa, sebab)
         VALUES (:t, :d, :u, :v, :m, :s)"
    )->execute([
        ":t" => $b["id"], ":d" => (string) $b["driverId"], ":u" => $user["userId"],
        ":v" => (string) $b["vehicleId"], ":m" => $masa, ":s" => $sebab,
    ]);
    logAudit_($user["userId"], "Tolak Tugas", $b["id"], $lama . " - " . $sebab);
    $b["status"] = "menunggu"; $b["vehicleId"] = null; $b["driverId"] = null; $b["diterima"] = "";
    return ["ok" => true, "booking" => $b, "data" => buildData_($user)];
}

/* ---------- Semakan pertindihan tempahan (tarikh + masa) ---------- */
function tamatEf_(array $b): string { return $b["masaTamat"] ?: "23:59"; }
function tarikhTamatEf_(array $b): string { return $b["tarikhTamat"] ?: $b["tarikh"]; }
function bertindih_(array $a, array $b): bool {
    $aMula = $a["tarikh"] . " " . $a["masaMula"]; $aTamat = tarikhTamatEf_($a) . " " . tamatEf_($a);
    $bMula = $b["tarikh"] . " " . $b["masaMula"]; $bTamat = tarikhTamatEf_($b) . " " . tamatEf_($b);
    return $aMula < $bTamat && $bMula < $aTamat;
}

/* ---------- Semakan kenderaan + pemandu (dikongsi oleh lulus & tukar tugasan) ----------
   Status kenderaan/pemandu (arkib, selenggaraan, cuti) hanya disemak apabila ia
   BERUBAH: kalau admin hanya menukar kenderaan sementara mengekalkan pemandu yang
   sama, pemandu itu tidak perlu lulus semula semakan status. Kapasiti dan
   pertindihan jadual sentiasa disemak. Pulang mesej ralat, atau null jika sah. */
function semakTugasan_(array $b, string $vId, string $dId): ?string {
    $stmt = db()->prepare("SELECT * FROM kenderaan WHERE id = :id"); $stmt->execute([":id" => $vId]); $v = $stmt->fetch();
    $stmt = db()->prepare("SELECT * FROM pemandu WHERE id = :id"); $stmt->execute([":id" => $dId]); $p = $stmt->fetch();
    if (!$v) return "Kenderaan tidak dijumpai.";
    if (!$p) return "Pemandu tidak dijumpai.";
    $v = castRow($v, ["kapasiti", "odometer", "bahanApi"]);

    if ($vId !== ($b["vehicleId"] ?? null)) {
        if ($v["status"] === "dipadam") return "Kenderaan telah diarkibkan.";
        if ($v["status"] === "selenggara") return "Kenderaan sedang dalam selenggaraan.";
    }
    if ($dId !== ($b["driverId"] ?? null)) {
        if ($p["status"] === "dipadam") return "Pemandu telah diarkibkan.";
        if ($p["status"] === "cuti") return "Pemandu sedang bercuti.";
    }
    if ((int) $v["kapasiti"] < (int) $b["penumpang"]) return "Kapasiti kenderaan tidak mencukupi.";

    $konflik = array_values(array_filter(readTempahan(), fn($x) =>
        $x["id"] !== $b["id"] && $x["status"] === "diluluskan" && bertindih_($x, $b) && ($x["vehicleId"] === $vId || $x["driverId"] === $dId)
    ));
    if (!empty($konflik))
        return "Konflik jadual dengan " . implode(", ", array_map(fn($c) => $c["id"], $konflik)) . " — kenderaan/pemandu sudah ditugaskan pada masa bertindih.";
    return null;
}

/* ---------- Tukar kenderaan / pemandu bagi tempahan yang telah diluluskan (admin) ----------
   Hanya sebelum perjalanan bermula. Sebarang pertukaran membatalkan pengesahan
   pemandu, supaya pemandu (lama atau baharu) mengesahkan pasangan kenderaan &
   tugasan yang terkini. */
function bookingReassign_(array $user, array $d): array {
    $b = ambilTempahan_((string) ($d["id"] ?? ""));
    if (!$b) return ["ok" => false, "ralat" => "Tempahan tidak dijumpai."];
    if ($b["status"] !== "diluluskan") return ["ok" => false, "ralat" => "Hanya tempahan yang diluluskan boleh ditukar tugasannya."];
    if (($b["tarikh"] . " " . $b["masaMula"]) <= nowKL_())
        return ["ok" => false, "ralat" => "Perjalanan telah bermula. Tiada pertukaran kenderaan atau pemandu dibenarkan."];

    $vId = (string) ($d["vehicleId"] ?? ""); $dId = (string) ($d["driverId"] ?? "");
    if (!$vId || !$dId) return ["ok" => false, "ralat" => "Sila pilih kenderaan dan pemandu."];
    if ($vId === $b["vehicleId"] && $dId === $b["driverId"])
        return ["ok" => false, "ralat" => "Tiada perubahan — kenderaan dan pemandu masih sama."];
    if ($ralat = semakTugasan_($b, $vId, $dId)) return ["ok" => false, "ralat" => $ralat];

    $lama = ((string) $b["vehicleId"]) . " / " . ((string) $b["driverId"]);
    db()->prepare("UPDATE tempahan SET vehicleId=:v, driverId=:d, diterima='' WHERE id=:id")
        ->execute([":v" => $vId, ":d" => $dId, ":id" => $b["id"]]);
    logAudit_($user["userId"], "Tukar Tugasan", $b["id"], $lama . " -> " . $vId . " / " . $dId);
    $b["vehicleId"] = $vId; $b["driverId"] = $dId; $b["diterima"] = "";
    return ["ok" => true, "booking" => $b, "data" => buildData_($user)];
}

/* ---------- Luluskan tempahan (admin) — konflik disahkan di SERVER ---------- */
function bookingApprove_(array $user, array $d): array {
    $b = ambilTempahan_((string) ($d["id"] ?? ""));
    if (!$b) return ["ok" => false, "ralat" => "Tempahan tidak dijumpai."];
    if ($b["status"] !== "menunggu") return ["ok" => false, "ralat" => "Hanya tempahan menunggu boleh diluluskan."];
    $vId = (string) ($d["vehicleId"] ?? ""); $dId = (string) ($d["driverId"] ?? "");
    if (!$vId || !$dId) return ["ok" => false, "ralat" => "Sila pilih kenderaan dan pemandu."];

    if ($ralat = semakTugasan_($b, $vId, $dId)) return ["ok" => false, "ralat" => $ralat];

    $b["status"] = "diluluskan"; $b["vehicleId"] = $vId; $b["driverId"] = $dId; $b["diterima"] = "";
    db()->prepare("UPDATE tempahan SET status=:s, vehicleId=:v, driverId=:d, diterima='' WHERE id=:id")
        ->execute([":s" => $b["status"], ":v" => $vId, ":d" => $dId, ":id" => $b["id"]]);
    logAudit_($user["userId"], "Lulus", $b["id"], $vId . " / " . $dId);
    return ["ok" => true, "booking" => $b];
}

/* ---------- Admin tarik balik tugasan yang belum disahkan pemandu ----------
   Tempahan kembali kepada "menunggu" supaya kenderaan/pemandu lain boleh
   ditugaskan. Tidak dibenarkan jika pemandu sudah mengesahkan tugasan. */
function bookingUnassign_(array $user, array $d): array {
    $b = ambilTempahan_((string) ($d["id"] ?? ""));
    if (!$b) return ["ok" => false, "ralat" => "Tempahan tidak dijumpai."];
    if ($b["status"] !== "diluluskan") return ["ok" => false, "ralat" => "Hanya tempahan yang diluluskan boleh ditarik balik."];
    if (!empty($b["diterima"]))
        return ["ok" => false, "ralat" => "Pemandu telah mengesahkan tugasan ini. Sila edit tempahan atau tandakan ia selesai."];

    $lama = ((string) $b["vehicleId"]) . " / " . ((string) $b["driverId"]);
    db()->prepare("UPDATE tempahan SET status='menunggu', vehicleId=NULL, driverId=NULL, diterima='' WHERE id=:id")
        ->execute([":id" => $b["id"]]);
    logAudit_($user["userId"], "Tarik Balik Tugasan", $b["id"], $lama);
    $b["status"] = "menunggu"; $b["vehicleId"] = null; $b["driverId"] = null; $b["diterima"] = "";
    return ["ok" => true, "booking" => $b, "data" => buildData_($user)];
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
    /* Tempahan yang telah bermula tidak boleh diubah — KECUALI jika pemandu masih belum
       mengesahkan tugasan. Dalam kes itu perjalanan sebenarnya belum berlaku, jadi admin
       tidak sepatutnya terkunci daripada membetulkan tempahan tersebut. */
    if (($b["tarikh"] . " " . $b["masaMula"]) <= $now && !empty($b["diterima"]))
        return ["ok" => false, "ralat" => "Tempahan sedang berjalan. Tiada perubahan dibenarkan."];

    $calon = [
        "id" => $b["id"],
        "pemohon" => trim((string) ($d["pemohon"] ?? "")),
        "bahagian" => trim((string) ($d["bahagian"] ?? "")),
        "telefonPemohon" => trim((string) ($d["telefon"] ?? "")),
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
    if ($calon["telefonPemohon"] === "") return ["ok" => false, "ralat" => "No. telefon untuk dihubungi wajib diisi."];
    if (!telefonSah_($calon["telefonPemohon"])) return ["ok" => false, "ralat" => "No. telefon tidak sah."];
    if ($ralat = semakMasaTempahan_($calon)) return ["ok" => false, "ralat" => $ralat];

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

    /* Jika tarikh/masa berubah, pengesahan pemandu terbatal - dia perlu terima semula
       supaya tiada pemandu terikat kepada jadual yang dia tidak pernah setuju. */
    $masaBerubah = $calon["tarikh"] !== $b["tarikh"] || $calon["masaMula"] !== $b["masaMula"]
        || $calon["masaTamat"] !== $b["masaTamat"] || $calon["tarikhTamat"] !== $b["tarikhTamat"];
    $diterimaBaru = $masaBerubah ? "" : (string) ($b["diterima"] ?? "");

    db()->prepare(
        "UPDATE tempahan SET pemohon=:pemohon, bahagian=:bahagian, telefonPemohon=:tel, tujuan=:tujuan, destinasi=:destinasi,
         tarikh=:tarikh, masaMula=:masaMula, masaTamat=:masaTamat, tarikhTamat=:tarikhTamat,
         penumpang=:penumpang, diterima=:diterima WHERE id=:id"
    )->execute([
        ":pemohon" => $calon["pemohon"], ":bahagian" => $calon["bahagian"], ":tel" => $calon["telefonPemohon"],
        ":tujuan" => $calon["tujuan"], ":destinasi" => $calon["destinasi"],
        ":tarikh" => $calon["tarikh"], ":masaMula" => $calon["masaMula"], ":masaTamat" => $calon["masaTamat"],
        ":tarikhTamat" => $calon["tarikhTamat"], ":penumpang" => $calon["penumpang"], ":diterima" => $diterimaBaru, ":id" => $b["id"],
    ]);
    $b = array_merge($b, $calon);
    $b["diterima"] = $diterimaBaru;
    logAudit_($user["userId"], "Edit Tempahan", $b["id"], $calon["destinasi"]);
    return ["ok" => true, "booking" => $b];
}

/* ---------- Pengguna tukar kata laluan sendiri ---------- */
function tukarPw_(array $user, array $d): array {
    $stmt = db()->prepare("SELECT * FROM pengguna WHERE userId = :u"); $stmt->execute([":u" => $user["userId"]]);
    $u = $stmt->fetch();
    if (!$u) return ["ok" => false, "ralat" => "Akaun tidak dijumpai."];
    if (!sahKataLaluan_($u, (string) ($d["passwordLama"] ?? ""))) {
        tandaLengah_();
        return ["ok" => false, "ralat" => "Kata laluan semasa salah."];
    }
    $baru = (string) ($d["passwordBaru"] ?? "");
    if (strlen($baru) < 6) return ["ok" => false, "ralat" => "Kata laluan baharu mestilah sekurang-kurangnya 6 aksara."];
    setKataLaluan_($user["userId"], $baru);
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
        fn($u) => ["userId" => $u["userId"], "nama" => $u["nama"], "peranan" => $u["peranan"],
                   "driverId" => $u["driverId"] ?: null, "superadmin" => (int) ($u["superadmin"] ?? 0) === 1],
        readPengguna()
    );
}

function userAdd_(array $d, array $user): array {
    $userId = trim((string) ($d["userId"] ?? ""));
    if (!$userId || empty($d["nama"]) || empty($d["password"])) return ["ok" => false, "ralat" => "Maklumat tidak lengkap."];
    if (($d["peranan"] ?? "") === "admin" && !isSuper_($user))
        return ["ok" => false, "ralat" => "Hanya superadmin boleh mencipta akaun admin."];
    if (!preg_match('/^[A-Za-z0-9._-]{3,50}$/', $userId))
        return ["ok" => false, "ralat" => "ID pengguna hanya boleh mengandungi huruf, nombor, titik, sengkang dan garis bawah (3–50 aksara, tanpa ruang)."];
    if (strlen((string) $d["password"]) < 6) return ["ok" => false, "ralat" => "Kata laluan mestilah sekurang-kurangnya 6 aksara."];
    $stmt = db()->prepare("SELECT userId FROM pengguna WHERE LOWER(userId) = LOWER(:u)");
    $stmt->execute([":u" => $userId]);
    if ($stmt->fetch()) return ["ok" => false, "ralat" => "ID pengguna ini sudah wujud."];
    $peranan = in_array($d["peranan"] ?? "", ["admin", "pemandu"], true) ? $d["peranan"] : "pemohon";
    $jadiSuper = $peranan === "admin" && !empty($d["superadmin"]);
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
        $pdo->prepare("INSERT INTO pengguna (userId, nama, peranan, passwordHash, salt, driverId, superadmin) VALUES (:u,:n,:p,:h,'',:d,:s)")
            ->execute([":u" => $userId, ":n" => $nama, ":p" => $peranan, ":h" => hashBaru_((string) $d["password"]),
                       ":d" => $driverId, ":s" => $jadiSuper ? 1 : 0]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    return ["ok" => true, "users" => senaraiUsers_(), "drivers" => readPemandu()];
}

function userReset_(array $d, array $user): array {
    $userId = (string) ($d["userId"] ?? "");
    $sasaran = ambilPengguna_($userId);
    if (!$sasaran) return ["ok" => false, "ralat" => "Pengguna tidak dijumpai."];
    /* Admin biasa tidak boleh menetapkan semula kata laluan akaun admin lain —
       jika tidak, dia boleh mengambil alih akaun tersebut. */
    if ($userId !== $user["userId"] && akaunDilindungi_($sasaran) && !isSuper_($user))
        return ["ok" => false, "ralat" => "Hanya superadmin boleh menetapkan semula kata laluan akaun admin."];
    $pw = (string) ($d["password"] ?? "");
    if (strlen($pw) < 6) return ["ok" => false, "ralat" => "Kata laluan mestilah sekurang-kurangnya 6 aksara."];
    setKataLaluan_($userId, $pw);
    $token = (string) ($d["token"] ?? "");
    db()->prepare("DELETE FROM sesi WHERE userId = :u AND token <> :t")->execute([":u" => $userId, ":t" => $token]);
    return ["ok" => true, "users" => senaraiUsers_()];
}

function userDel_(array $user, array $d): array {
    $userId = (string) ($d["userId"] ?? "");
    if ($userId === $user["userId"]) return ["ok" => false, "ralat" => "Anda tidak boleh memadam akaun sendiri."];
    $pdo = db();
    $sasaran = ambilPengguna_($userId);
    if (!$sasaran) return ["ok" => false, "ralat" => "Pengguna tidak dijumpai."];
    if (akaunDilindungi_($sasaran) && !isSuper_($user))
        return ["ok" => false, "ralat" => "Hanya superadmin boleh memadam akaun admin."];
    if ((int) ($sasaran["superadmin"] ?? 0) === 1 && bilSuperadmin_($userId) === 0)
        return ["ok" => false, "ralat" => "Mesti ada sekurang-kurangnya seorang superadmin."];
    $admins = (int) $pdo->query("SELECT COUNT(*) FROM pengguna WHERE peranan='admin' AND userId <> " . $pdo->quote($userId))->fetchColumn();
    if ($admins === 0) return ["ok" => false, "ralat" => "Mesti ada sekurang-kurangnya seorang admin."];
    $pdo->prepare("DELETE FROM pengguna WHERE userId = :u")->execute([":u" => $userId]);
    $pdo->prepare("DELETE FROM sesi WHERE userId = :u")->execute([":u" => $userId]);
    return ["ok" => true, "users" => senaraiUsers_()];
}

/* ---------- Tukar nama penuh akaun ----------
   Admin biasa boleh menukar nama akaun pemohon/pemandu & namanya sendiri;
   akaun admin hanya boleh ditukar oleh superadmin. Nama rekod pemandu yang
   dipautkan dikemas kini serentak supaya kedua-duanya tidak terpesong. */
function userRename_(array $user, array $d): array {
    $userId = (string) ($d["userId"] ?? "");
    $nama = trim((string) ($d["nama"] ?? ""));
    $sasaran = ambilPengguna_($userId);
    if (!$sasaran) return ["ok" => false, "ralat" => "Pengguna tidak dijumpai."];
    if ($userId !== $user["userId"] && akaunDilindungi_($sasaran) && !isSuper_($user))
        return ["ok" => false, "ralat" => "Hanya superadmin boleh menukar nama akaun admin."];
    if ($nama === "") return ["ok" => false, "ralat" => "Nama tidak boleh kosong."];
    if (mb_strlen($nama) > 100) return ["ok" => false, "ralat" => "Nama terlalu panjang (maksimum 100 aksara)."];
    if ($nama === $sasaran["nama"]) return ["ok" => true, "users" => senaraiUsers_(), "drivers" => readPemandu()];

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $pdo->prepare("UPDATE pengguna SET nama=:n WHERE userId=:u")->execute([":n" => $nama, ":u" => $userId]);
        if (!empty($sasaran["driverId"]))
            $pdo->prepare("UPDATE pemandu SET nama=:n WHERE id=:id")->execute([":n" => $nama, ":id" => $sasaran["driverId"]]);
        $pdo->commit();
    } catch (Throwable $e) { $pdo->rollBack(); throw $e; }

    logAudit_($user["userId"], "Tukar Nama Pengguna", "", $userId . ": " . $sasaran["nama"] . " -> " . $nama);
    return ["ok" => true, "users" => senaraiUsers_(), "drivers" => readPemandu()];
}

/* ---------- Naik taraf / tarik balik status superadmin (superadmin sahaja) ---------- */
function userSetSuper_(array $user, array $d): array {
    $userId = (string) ($d["userId"] ?? "");
    $jadi = !empty($d["superadmin"]);
    $sasaran = ambilPengguna_($userId);
    if (!$sasaran) return ["ok" => false, "ralat" => "Pengguna tidak dijumpai."];
    if ($sasaran["peranan"] !== "admin")
        return ["ok" => false, "ralat" => "Hanya akaun berperanan Admin boleh dijadikan superadmin."];
    if (!$jadi && (int) ($sasaran["superadmin"] ?? 0) === 1 && bilSuperadmin_($userId) === 0)
        return ["ok" => false, "ralat" => "Mesti ada sekurang-kurangnya seorang superadmin."];

    db()->prepare("UPDATE pengguna SET superadmin = :s WHERE userId = :u")
        ->execute([":s" => $jadi ? 1 : 0, ":u" => $userId]);
    logAudit_($user["userId"], $jadi ? "Lantik Superadmin" : "Tarik Superadmin", "", $userId);
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
        /* "user" disertakan supaya pelayar boleh memulihkan sesi selepas muat semula
           tanpa menyimpan peranan di sisi klien — peranan sentiasa segar dari DB. */
        case "load": return ["ok" => true, "user" => $user, "data" => buildData_($user)];
        case "vehicleSave": return adminSahaja_($user) ?? vehicleSave_($user, $d);
        case "driverSave": return adminSahaja_($user) ?? driverSave_($user, $d);
        case "maintSave": return adminSahaja_($user) ?? maintSave_($user, $d);
        case "maintDel": return adminSahaja_($user) ?? maintDel_($user, $d);
        case "bookingAdd": return bookingAdd_($user, $d["booking"] ?? []);
        case "bookingComplete": return bookingComplete_($user, $d);
        case "bookingAccept": return bookingAccept_($user, $d);
        case "bookingDecline": return bookingDecline_($user, $d);
        case "bookingApprove": return adminSahaja_($user) ?? bookingApprove_($user, $d);
        case "bookingReject": return adminSahaja_($user) ?? bookingReject_($user, $d);
        case "bookingEdit": return adminSahaja_($user) ?? bookingEdit_($user, $d);
        case "bookingUnassign": return adminSahaja_($user) ?? bookingUnassign_($user, $d);
        case "bookingReassign": return adminSahaja_($user) ?? bookingReassign_($user, $d);
        case "auditLog": return adminSahaja_($user) ?? ["ok" => true, "log" => readLogTerkini()];
        case "penolakanList": return penolakanList_($user);
        case "logPurge": return superSahaja_($user) ?? logPurge_($user);
        case "logout":
            db()->prepare("DELETE FROM sesi WHERE token = :t")->execute([":t" => $d["token"] ?? ""]);
            return ["ok" => true];
        case "tukarPw": return tukarPw_($user, $d);
        case "drvStatus": return drvStatus_($user, $d);
        case "userSetSuper": return superSahaja_($user) ?? userSetSuper_($user, $d);
        case "userRename": return adminSahaja_($user) ?? userRename_($user, $d);
        case "userAdd": {
            $res = adminSahaja_($user) ?? userAdd_($d, $user);
            if ($res["ok"] ?? false) logAudit_($user["userId"], "Tambah Pengguna", "", (string) ($d["userId"] ?? ""));
            return $res;
        }
        case "userReset": {
            $res = adminSahaja_($user) ?? userReset_($d, $user);
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
