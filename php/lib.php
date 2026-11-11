<?php
/**
 * SisKEN — utiliti dikongsi (kata laluan & masa)
 * Dipanggil oleh install.php dan api.php.
 */

require_once __DIR__ . "/config.php";

/** LEGASI: SHA-256 hex(salt + password) — hanya untuk mengesahkan akaun lama sebelum dinaik taraf */
function hash_(string $salt, string $password): string {
    return hash("sha256", $salt . $password);
}

/** Hash kata laluan baharu (bcrypt/argon ikut PASSWORD_DEFAULT PHP). Lajur `salt` dibiar kosong. */
function hashBaru_(string $password): string {
    return password_hash($password, PASSWORD_DEFAULT);
}

/** Sahkan kata laluan terhadap rekod pengguna — menyokong hash baharu DAN hash legasi (salt tidak kosong). */
function sahKataLaluan_(array $u, string $password): bool {
    if (($u["salt"] ?? "") === "") return password_verify($password, (string) $u["passwordHash"]);
    return hash_equals((string) $u["passwordHash"], hash_($u["salt"], $password));
}

/** Adakah rekod ini masih guna hash legasi / kos lama dan perlu dinaik taraf? */
function perluNaikTaraf_(array $u): bool {
    return ($u["salt"] ?? "") !== "" || password_needs_rehash((string) $u["passwordHash"], PASSWORD_DEFAULT);
}

/** Simpan kata laluan baharu untuk pengguna (hash moden, salt dikosongkan) */
function setKataLaluan_(string $userId, string $password): void {
    db()->prepare("UPDATE pengguna SET salt='', passwordHash=:h WHERE userId=:u")
        ->execute([":h" => hashBaru_($password), ":u" => $userId]);
}

/** Tarikh "yyyy-mm-dd" yang sah (wujud dalam kalendar) */
function tarikhSah_(string $s): bool {
    return (bool) preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $s, $m) && checkdate((int) $m[2], (int) $m[3], (int) $m[1]);
}

/** Masa "HH:mm" 24 jam yang sah */
function masaSah_(string $s): bool {
    return (bool) preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $s);
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
