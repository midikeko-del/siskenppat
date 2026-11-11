<?php
/**
 * ============================================================
 *  SisKEN — Pemasangan (jalankan SEKALI melalui pelayar)
 *   1. Cipta pangkalan data & jadual (schema.sql)
 *   2. Cipta akaun admin pertama (admin / admin123) jika belum ada
 * ============================================================
 *  Selepas sistem dipasang (jadual Pengguna sudah ada rekod), fail ini
 *  TERKUNCI SENDIRI: ia tidak lagi mencipta pangkalan data/akaun dan tidak
 *  memaparkan butiran ralat. Ia hanya menambah lajur baharu yang belum
 *  wujud (migrasi naik taraf — selamat diulang). Masih disyorkan untuk
 *  MEMADAM fail ini daripada pelayan produksi.
 * ============================================================
 */

require_once __DIR__ . "/lib.php";

ini_set("display_errors", "0");
header("Content-Type: text/plain; charset=utf-8");
header("Cache-Control: no-store");

/** Tambah lajur baharu yang belum wujud (CREATE TABLE IF NOT EXISTS tidak mengubah
    jadual sedia ada). Selamat diulang. Pulang senarai mesej tindakan. */
function migrasiLajur_(PDO $pdo): array {
    $mesej = [];
    $lajurBaharu = [
        "tempahan" => [
            "diterima"       => "VARCHAR(20) NOT NULL DEFAULT ''",
            "telefonPemohon" => "VARCHAR(30) NOT NULL DEFAULT ''",
            "sebabTolak"     => "VARCHAR(200) NOT NULL DEFAULT ''",
        ],
        "pengguna" => ["superadmin" => "TINYINT(1) NOT NULL DEFAULT 0"],
    ];
    foreach ($lajurBaharu as $jadual => $medan) {
        foreach ($medan as $nama => $takrif) {
            $semak = $pdo->prepare(
                "SELECT COUNT(*) FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = :db AND TABLE_NAME = :t AND COLUMN_NAME = :c"
            );
            $semak->execute([":db" => DB_NAME, ":t" => $jadual, ":c" => $nama]);
            if ((int) $semak->fetchColumn() !== 0) continue;
            $pdo->exec("ALTER TABLE `$jadual` ADD COLUMN `$nama` $takrif");
            $mesej[] = "✔ Lajur baharu ditambah: {$jadual}.{$nama}";
            /* Naik taraf SEMUA admin sedia ada kepada superadmin supaya tiada sesiapa
               terkunci daripada mengurus akaun. Tarik balik yang tidak perlu melalui
               tab Pengguna selepas ini. */
            if ($jadual === "pengguna" && $nama === "superadmin") {
                $n = $pdo->exec("UPDATE pengguna SET superadmin = 1 WHERE peranan = 'admin'");
                $mesej[] = "✔ {$n} akaun admin sedia ada dinaik taraf kepada superadmin (tarik balik yang tidak perlu melalui tab Pengguna).";
            }
        }
    }
    return $mesej;
}

/** Jalankan CREATE TABLE dalam schema.sql (abaikan CREATE DATABASE / USE di dalamnya) */
function jalankanSkema_(PDO $pdo): void {
    $sql = file_get_contents(__DIR__ . "/schema.sql");
    if ($sql === false) throw new RuntimeException("Tidak jumpa schema.sql di folder yang sama.");
    $sql = preg_replace('/^\s*--.*$/m', "", $sql); // buang baris komen
    foreach (array_filter(array_map("trim", explode(";", $sql))) as $stmt) {
        if (preg_match('/^(CREATE\s+DATABASE|USE)\b/i', $stmt)) continue;
        $pdo->exec($stmt);
    }
}

/* ---------- Sudah dipasang? (pangkalan data boleh dicapai & ada akaun) ---------- */
$terpasang = false;
try {
    $terpasang = (int) db()->query("SELECT COUNT(*) FROM pengguna")->fetchColumn() > 0;
} catch (Throwable $e) { /* pangkalan data / jadual belum wujud — teruskan pemasangan baharu */ }

if ($terpasang) {
    /* MOD TERKUNCI: tiada akaun dicipta, tiada butiran ralat didedahkan. Hanya
       migrasi skema (jadual/lajur baharu selepas naik taraf versi). */
    try {
        jalankanSkema_(db());
        $mesej = migrasiLajur_(db());
        echo "ℹ SisKEN sudah dipasang — pemasangan tidak dijalankan semula.\n";
        echo $mesej ? implode("\n", $mesej) . "\n" : "✔ Skema pangkalan data sudah terkini.\n";
        echo "\nSila PADAM php/install.php daripada pelayan produksi.\n";
    } catch (Throwable $e) {
        error_log("SisKEN install (migrasi): " . $e->getMessage());
        http_response_code(500);
        echo "✕ Migrasi gagal. Rujuk log ralat PHP pada pelayan.\n";
    }
    exit;
}

/* ---------- Pemasangan baharu (butiran ralat dipaparkan untuk membantu Unit IT) ---------- */
try {
    // 1) Sambung ke pelayan MySQL TANPA nama pangkalan data (mungkin belum wujud)
    $dsn = "mysql:host=" . DB_HOST . ";charset=" . DB_CHARSET;
    $root = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);

    // 2) Cipta pangkalan data ikut DB_NAME dalam config.php (bukan nama tetap dalam schema.sql)
    $namaDb = "`" . str_replace("`", "``", DB_NAME) . "`";
    $root->exec("CREATE DATABASE IF NOT EXISTS $namaDb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $root->exec("USE $namaDb");

    // 3) Jadual + lajur baharu (jika jadual lama wujud tanpa akaun)
    jalankanSkema_($root);
    echo "✔ Pangkalan data & jadual sedia.\n";
    foreach (migrasiLajur_($root) as $m) echo $m . "\n";

    // 4) Cipta akaun admin pertama (jadual Pengguna kosong)
    $pdo = db();
    $count = (int) $pdo->query("SELECT COUNT(*) FROM pengguna")->fetchColumn();
    if ($count === 0) {
        $stmt = $pdo->prepare(
            "INSERT INTO pengguna (userId, nama, peranan, passwordHash, salt, driverId, superadmin)
             VALUES (:userId, :nama, :peranan, :hash, :salt, NULL, 1)"
        );
        $stmt->execute([
            ":userId" => "admin",
            ":nama"   => "Admin PPAT",
            ":peranan"=> "admin",
            ":hash"   => hashBaru_(PW_LALAI),
            ":salt"   => "",
        ]);
        echo "✔ Akaun pertama dicipta -> ID: admin | Kata Laluan: " . PW_LALAI . "\n";
        echo "  >> Sistem akan MEMAKSA anda menetapkan kata laluan baharu pada log masuk pertama. <<\n";
    }

    echo "\nSedia! Buka index.html dan log masuk. Kemudian PADAM php/install.php daripada pelayan.\n";
} catch (Throwable $e) {
    http_response_code(500);
    echo "✕ Ralat pemasangan: " . $e->getMessage() . "\n";
}
