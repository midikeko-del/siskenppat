<?php
/**
 * ============================================================
 *  SisKEN — Pemasangan (jalankan SEKALI melalui pelayar)
 *   1. Cipta pangkalan data & jadual (schema.sql)
 *   2. Cipta akaun admin pertama (admin / admin123) jika belum ada
 * ============================================================
 *  Selepas berjaya, PADAM atau lindungi fail ini (jangan tinggal
 *  boleh diakses awam di server produksi).
 * ============================================================
 */

require_once __DIR__ . "/lib.php";

header("Content-Type: text/plain; charset=utf-8");

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

    // 3) Jalankan CREATE TABLE dalam schema.sql (abaikan CREATE DATABASE / USE di dalamnya)
    $sql = file_get_contents(__DIR__ . "/schema.sql");
    if ($sql === false) {
        throw new RuntimeException("Tidak jumpa schema.sql di folder yang sama.");
    }
    $sql = preg_replace('/^\s*--.*$/m', "", $sql); // buang baris komen
    foreach (array_filter(array_map("trim", explode(";", $sql))) as $stmt) {
        if (preg_match('/^(CREATE\s+DATABASE|USE)\b/i', $stmt)) continue;
        $root->exec($stmt);
    }
    echo "✔ Pangkalan data & jadual sedia.\n";

    // 4) Cipta akaun admin pertama jika jadual Pengguna masih kosong
    $pdo = db();
    $count = (int) $pdo->query("SELECT COUNT(*) FROM pengguna")->fetchColumn();
    if ($count === 0) {
        $salt = saltBaru_();
        $stmt = $pdo->prepare(
            "INSERT INTO pengguna (userId, nama, peranan, passwordHash, salt, driverId)
             VALUES (:userId, :nama, :peranan, :hash, :salt, NULL)"
        );
        $stmt->execute([
            ":userId" => "admin",
            ":nama"   => "Admin PPAT",
            ":peranan"=> "admin",
            ":hash"   => hash_($salt, "admin123"),
            ":salt"   => $salt,
        ]);
        echo "✔ Akaun pertama dicipta -> ID: admin | Kata Laluan: admin123\n";
        echo "  >> TUKAR kata laluan ini selepas log masuk pertama! <<\n";
    } else {
        echo "ℹ Jadual Pengguna sudah ada rekod ({$count}) — akaun admin tidak dicipta semula.\n";
    }

    echo "\nSedia! Kemas kini API_URL/laluan di js/core.js kepada php/api.php, kemudian buka index.html.\n";
} catch (Throwable $e) {
    http_response_code(500);
    echo "✕ Ralat pemasangan: " . $e->getMessage() . "\n";
}
