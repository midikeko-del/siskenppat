-- ============================================================
--  SisKEN — Skema MySQL (gantian backend Google Apps Script)
--  Struktur jadual selari dengan SHEET_DEFS dalam gas/Code.js
--  Nota: install.php mencipta pangkalan data ikut DB_NAME (config.php)
--  dan MENGABAIKAN dua baris CREATE DATABASE / USE di bawah. Baris itu
--  hanya untuk import manual (cth. phpMyAdmin) dengan nama lalai "sisken".
-- ============================================================

CREATE DATABASE IF NOT EXISTS sisken CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sisken;

-- Kenderaan -----------------------------------------------------
CREATE TABLE IF NOT EXISTS kenderaan (
  id        VARCHAR(20)  NOT NULL PRIMARY KEY,
  plat      VARCHAR(20)  NOT NULL DEFAULT '',
  model     VARCHAR(100) NOT NULL DEFAULT '',
  jenis     VARCHAR(50)  NOT NULL DEFAULT '',
  kapasiti  INT          NOT NULL DEFAULT 0,
  status    VARCHAR(30)  NOT NULL DEFAULT 'tersedia',
  lokasi    VARCHAR(150) NOT NULL DEFAULT '',
  odometer  INT          NOT NULL DEFAULT 0,
  roadtax   VARCHAR(20)  NOT NULL DEFAULT '',
  bahanApi  INT          NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Pemandu ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS pemandu (
  id       VARCHAR(20)  NOT NULL PRIMARY KEY,
  nama     VARCHAR(100) NOT NULL DEFAULT '',
  telefon  VARCHAR(30)  NOT NULL DEFAULT '',
  lesen    VARCHAR(30)  NOT NULL DEFAULT '',
  status   VARCHAR(30)  NOT NULL DEFAULT 'bertugas'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tempahan --------------------------------------------------------
CREATE TABLE IF NOT EXISTS tempahan (
  id           VARCHAR(20)  NOT NULL PRIMARY KEY,
  pemohon      VARCHAR(150) NOT NULL DEFAULT '',
  bahagian     VARCHAR(150) NOT NULL DEFAULT '',
  tujuan       VARCHAR(255) NOT NULL DEFAULT '',
  destinasi    VARCHAR(255) NOT NULL DEFAULT '',
  tarikh       VARCHAR(10)  NOT NULL DEFAULT '',
  masaMula     VARCHAR(5)   NOT NULL DEFAULT '',
  masaTamat    VARCHAR(5)   NOT NULL DEFAULT '',
  penumpang    INT          NOT NULL DEFAULT 1,
  status       VARCHAR(30)  NOT NULL DEFAULT 'menunggu',
  vehicleId    VARCHAR(20)  NULL,
  driverId     VARCHAR(20)  NULL,
  userId       VARCHAR(50)  NULL,
  masaSelesai  VARCHAR(20)  NOT NULL DEFAULT '',
  tarikhTamat  VARCHAR(10)  NOT NULL DEFAULT '',
  KEY idx_status (status),
  KEY idx_vehicle (vehicleId),
  KEY idx_driver (driverId),
  KEY idx_user (userId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Selenggaraan ------------------------------------------------------
CREATE TABLE IF NOT EXISTS selenggaraan (
  id         VARCHAR(20)  NOT NULL PRIMARY KEY,
  vehicleId  VARCHAR(20)  NOT NULL DEFAULT '',
  tarikh     VARCHAR(10)  NOT NULL DEFAULT '',
  jenis      VARCHAR(50)  NOT NULL DEFAULT '',
  butiran    TEXT,
  kos        DECIMAL(10,2) NOT NULL DEFAULT 0,
  odometer   INT          NOT NULL DEFAULT 0,
  bengkel    VARCHAR(150) NOT NULL DEFAULT '',
  status     VARCHAR(30)  NOT NULL DEFAULT 'dijadual',
  KEY idx_vehicle (vehicleId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Pengguna (akaun log masuk) ----------------------------------------
CREATE TABLE IF NOT EXISTS pengguna (
  userId        VARCHAR(50)  NOT NULL PRIMARY KEY,
  nama          VARCHAR(100) NOT NULL DEFAULT '',
  peranan       VARCHAR(20)  NOT NULL DEFAULT 'pemohon',
  passwordHash  VARCHAR(100) NOT NULL DEFAULT '',
  salt          VARCHAR(30)  NOT NULL DEFAULT '',
  driverId      VARCHAR(20)  NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sesi (token log masuk) ---------------------------------------------
CREATE TABLE IF NOT EXISTS sesi (
  token   VARCHAR(64)  NOT NULL PRIMARY KEY,
  userId  VARCHAR(50)  NOT NULL,
  tamat   BIGINT       NOT NULL,
  KEY idx_userId (userId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tetapan (kaunter & konfigurasi umum) --------------------------------
CREATE TABLE IF NOT EXISTS tetapan (
  `key`   VARCHAR(50)  NOT NULL PRIMARY KEY,
  `value` VARCHAR(100) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Keselamatan (kawalan cubaan log masuk / anti brute-force) ----------
CREATE TABLE IF NOT EXISTS keselamatan (
  userId        VARCHAR(50) NOT NULL PRIMARY KEY,
  gagal         INT         NOT NULL DEFAULT 0,
  kunciSehingga BIGINT      NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Log (jejak audit) ----------------------------------------------------
CREATE TABLE IF NOT EXISTS log (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  masa        VARCHAR(20)  NOT NULL DEFAULT '',
  userId      VARCHAR(50)  NOT NULL DEFAULT '',
  tindakan    VARCHAR(50)  NOT NULL DEFAULT '',
  tempahanId  VARCHAR(20)  NOT NULL DEFAULT '',
  butiran     TEXT,
  KEY idx_masa (masa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
