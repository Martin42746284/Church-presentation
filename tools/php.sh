#!/usr/bin/env bash
# Wrapper PHP local : active l'extension SQLite extraite sans droits root.
#
# Sur ce poste (Ubuntu, pas de sudo), l'extension pdo_sqlite n'est pas installée
# dans le système. tools/setup-php-ext.sh télécharge le .deb correspondant à la
# version de PHP installée et l'extrait dans tools/php-ext/ (fichiers gitignorés).
# Ce wrapper ajoute simplement les flags -d nécessaires.
#
# Sur Windows (runtime PHP embarqué), l'extension pdo_sqlite est déjà incluse :
# ce wrapper n'est alors qu'un alias de `php`.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ARGS=()
if [[ -f "$DIR/php-ext/pdo_sqlite.so" ]]; then
  ARGS+=(-d "extension=$DIR/php-ext/pdo_sqlite.so")
fi
if [[ -f "$DIR/php-ext/sqlite3.so" ]]; then
  ARGS+=(-d "extension=$DIR/php-ext/sqlite3.so")
fi

exec php "${ARGS[@]}" "$@"
