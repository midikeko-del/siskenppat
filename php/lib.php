<?php
/**
 * SisKEN — utiliti dikongsi (kata laluan & masa)
 * Dipanggil oleh install.php dan api.php.
 */

require_once __DIR__ . "/config.php";

/** SHA-256 hex(salt + password) */
function hash_(string $salt, string $password): string {
    return hash("sha256", $salt . $password);
}

function saltBaru_(): string {
    // 12 aksara hex rawak
    return substr(bin2hex(random_bytes(8)), 0, 12);
}

/** Masa semasa zon Asia/Kuala_Lumpur, format "yyyy-MM-dd HH:mm" (dijana SERVER) */
function nowKL_(): string {
    $dt = new DateTime("now", new DateTimeZone(TZ));
    return $dt->format("Y-m-d H:i");
}
