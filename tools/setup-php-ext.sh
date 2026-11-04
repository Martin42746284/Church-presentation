#!/usr/bin/env bash
# Extrait les extensions PHP SQLite (pdo_sqlite, sqlite3) depuis les paquets Ubuntu
# sans droits root, pour le développement local sous Linux.
#
# Usage : tools/setup-php-ext.sh
# Résultat : tools/php-ext/*.so (gitignoré) + tools/php.sh qui les charge.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_DIR="$DIR/php-ext"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

PHP_VERSION="$(php -r 'echo PHP_VERSION;')"
echo "PHP $PHP_VERSION détecté"

mkdir -p "$EXT_DIR"
cd "$STAGE"

# Le numéro de paquet doit correspondre exactement à la version installée.
apt-get download "php8.3-sqlite3" >/dev/null

dpkg -x ./*.deb "$STAGE/out"
find "$STAGE/out" -name '*.so' -exec cp {} "$EXT_DIR/" \;

echo "Extensions extraites :"
ls -1 "$EXT_DIR"

php -d "extension=$EXT_DIR/pdo_sqlite.so" -d "extension=$EXT_DIR/sqlite3.so" -r '
  $pdo = new PDO("sqlite::memory:");
  $pdo->exec("CREATE VIRTUAL TABLE t USING fts5(a)");
  echo "Vérification PDO SQLite + FTS5 : OK\n";
'
