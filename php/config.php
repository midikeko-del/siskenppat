<?php
/**
 * ============================================================
 *  SisKEN — Konfigurasi pangkalan data (MySQL / MariaDB via XAMPP)
 * ============================================================
 *  Tukar nilai di bawah ikut persekitaran anda. Lalai sesuai untuk
 *  XAMPP tempatan (localhost, root, tiada kata laluan).
 * ============================================================
 */

const DB_HOST = "127.0.0.1";
const DB_NAME = "sisken";
const DB_USER = "root";
const DB_PASS = "";
const DB_CHARSET = "utf8mb4";

const TZ = "Asia/Kuala_Lumpur";
date_default_timezone_set(TZ);

function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}
